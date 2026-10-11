// Walk test for any site: drives world.autopilot along waypoints using the real physics,
// logs feet position each second, flags STUCK if it moves < 0.1 m over 240 rendered frames
// (frames, not wall-clock: a loaded machine can freeze the page for seconds without the
// pilgrim being blocked).
// Usage: node scripts/walk.mjs <temple-id> "<startX,startY,startZ>" "<x,z;x,z;...>" [screenshot.jpg]
// Needs the dev server (port 5199). Waypoints are (x, z) on the walkable floors in order.
import puppeteer from 'puppeteer-core';

const [temple, startArg, ptsArg, out] = process.argv.slice(2);
if (!temple || !startArg || !ptsArg) {
  console.error('usage: node scripts/walk.mjs <temple> "x,y,z" "x,z;x,z;..." [out.jpg]');
  process.exit(1);
}
const start = startArg.split(',').map(Number);
const pts = ptsArg.split(';').map((p) => p.split(',').map(Number));
const base = process.env.DEV_URL ?? 'http://localhost:5199/temples.html';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 960, height: 540 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${base}?temple=${temple}&preview=1&at=${start.join(',')},${pts[0][0]},1.6,${pts[0][1]}`, { waitUntil: 'load', timeout: 120000 });

let cur = null;
const init = async () => {
  await page.waitForFunction(() => window.world && document.body.dataset.ready === '1', { timeout: 120000 });
  await page.evaluate(([x, y, z]) => { window.world.pose(x, y, z, x, y + 1.6, z - 1); }, cur ?? start);
  await page.evaluate(() => {
    const w = window.world; w.autopilot = true; w.zones = [];
    window.__frames = 0;
    const tick = () => { window.__frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const o = w.onZone; w.onZone = (z) => { w.zones.push(z); o?.(z); };
  });
};
await init();

let wi = 0, lastLog = 0, stuck = false;
const t0 = Date.now();
let lastMove = { f: 0, p: null };
const log = [];
while (wi < pts.length && Date.now() - t0 < 900000) {
  const [tx, tz] = pts[wi];
  let f;
  try {
    f = await page.evaluate(([tx, tz]) => {
      const w = window.world; w.keys.add('KeyW');
      w.camera.lookAt(tx, w.feet.y + 1.62, tz);
      return [w.feet.x, w.feet.y, w.feet.z, w.zone, window.__frames];
    }, [tx, tz]);
  } catch {
    log.push('  (page reloaded by an edit — resuming from last position)');
    await init();
    lastMove = { f: 0, p: null };
    continue;
  }
  cur = f.slice(0, 3);
  const d = Math.hypot(f[0] - tx, f[2] - tz);
  if (d < 0.3) {
    log.push(`  reached wp${wi} (${tx},${tz}) feet=(${f[0].toFixed(2)},${f[1].toFixed(2)},${f[2].toFixed(2)}) zone=${f[3]}`);
    wi++; lastMove = { f: f[4], p: f }; continue;
  }
  if (Date.now() - lastLog > 1000) {
    lastLog = Date.now();
    log.push(`t=${((Date.now() - t0) / 1000).toFixed(0)}s feet=(${f[0].toFixed(2)},${f[1].toFixed(2)},${f[2].toFixed(2)}) zone=${f[3]} -> wp${wi}`);
  }
  if (!lastMove.p || Math.hypot(f[0] - lastMove.p[0], f[2] - lastMove.p[2]) > 0.1) lastMove = { f: f[4], p: f };
  else if (f[4] - lastMove.f > 240) {
    log.push(`STUCK at (${f.slice(0, 3).map((v) => v.toFixed(2))}) heading to wp${wi} (${tx},${tz})`);
    stuck = true; break;
  }
  await new Promise((r) => setTimeout(r, 100));
}
const zones = await page.evaluate(() => window.world.zones).catch(() => []);
await page.evaluate(() => window.world.keys.clear()).catch(() => {});
if (out) await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
console.log(log.join('\n'));
console.log(`RESULT temple=${temple} reached=${wi}/${pts.length} stuck=${stuck} zones=${JSON.stringify(zones)}`);
await browser.close();

// Screenshot temple scenes in headless Chrome (uses the installed Google Chrome + GPU).
// Usage: node scripts/shoot.mjs <outDir> <name>=<query> [<name>=<query> ...]
//   query example: "temple=somnath&at=0,0,30,0,8,0"  (at = feet x,y,z then look-at x,y,z)
// Needs the dev server: npm run dev -- --port 5199
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const [outDir, ...shots] = process.argv.slice(2);
if (!outDir || !shots.length) {
  console.error('usage: node scripts/shoot.mjs <outDir> name=query ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const base = process.env.DEV_URL ?? 'http://localhost:5199/temples.html';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1440, height: 810 },
});
for (const spec of shots) {
  const i = spec.indexOf('=');
  const name = spec.slice(0, i), query = spec.slice(i + 1);
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(`${base}?${query}&preview=1`, { waitUntil: 'load', timeout: 120000 });
  const ready = await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 120000 }).then(() => true, () => false);
  await new Promise((r) => setTimeout(r, 2500));
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const s = performance.now();
    const f = () => { n++; if (performance.now() - s < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); };
    requestAnimationFrame(f);
  }));
  const file = `${outDir}/${name}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  console.log(`${file}  fps=${fps}${ready ? '' : '  (NOT READY: assets still loading)'}${logs.length ? '\n  errors: ' + logs.join(' | ') : ''}`);
  await page.close();
}
await browser.close();

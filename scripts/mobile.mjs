// Phone / tablet check of the temple explorer, with puppeteer device emulation (touch, mobile UA, DPR).
// For each temple: load, tap to walk in, joystick walk, drag-look (and both at once), Story button, Places
// → darshan, a layout check (no two visible HUD elements overlap, no horizontal scroll) in portrait and
// landscape, screenshots, and the frame rate with the CPU throttled 4× (a proxy only: the GPU is this Mac's).
// Usage: node scripts/mobile.mjs [outDir] [temple:device ...]   devices: iphone13 iphone15 pixel7 ipad
// Needs the dev server (port 5199).
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'mobile-shots';
mkdirSync(out, { recursive: true });
const runs = (process.argv.slice(3).length ? process.argv.slice(3) : [
  'mahakaleshwar:iphone13', 'kedarnath:iphone15', 'kashi-vishwanath:pixel7', 'somnath:iphone13',
]).map((s) => s.split(':'));
const base = process.env.DEV_URL ?? 'http://localhost:5199/temples.html';
const THROTTLE = Number(process.env.THROTTLE ?? 4);

const DEVICES = {
  iphone13: KnownDevices['iPhone 13'],
  iphone15: KnownDevices['iPhone 15'],
  pixel7: {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: false },
  },
  ipad: KnownDevices['iPad Pro 11'],
};

// HUD elements that must never overlap one another while visible
const HUD = ['#chrome .brand', '#progress-chip', '#sound-ctl', '#guide', '#story-toast', '#travel-cue', '#caption', '#story-card',
  '#aarti-chip', '#touch-buttons', '#portal-prompt', '#touch-pad .stick-base', '#osm-credit', '#places-panel'];

const browser = await puppeteer.launch({
  protocolTimeout: 900000,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** visible rects of the HUD (the story card and place title by their visible children) */
async function layout(page) {
  return page.evaluate((sels) => {
    const vis = (el) => {
      if (!el) return false;
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const rectOf = (el) => {
      // boxes that are wider than what they show: measure their visible children
      if (el.id === 'story-card' || el.id === 'caption') {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const c of el.querySelectorAll(el.id === 'caption' ? 'span' : '.cap-head, .cap, .cap-tools')) {
          if (!vis(c) || !c.textContent.trim() && !c.children.length) continue;
          for (const r of c.getClientRects()) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
        }
        return x1 > x0 ? { left: x0, top: y0, right: x1, bottom: y1 } : null;
      }
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const items = [];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!vis(el)) continue;
      const r = rectOf(el);
      if (r) items.push({ s, r: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])) });
    }
    const overlaps = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].r, b = items[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // (the places sheet is a modal: it may cover the HUD)
        if (w > 1 && h > 1 && items[i].s !== '#places-panel' && items[j].s !== '#places-panel') overlaps.push(`${items[i].s} × ${items[j].s} (${w}×${h})`);
      }
    }
    const offscreen = items.filter(({ r }) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map((i) => i.s);
    return { items, overlaps, offscreen, hscroll: document.documentElement.scrollWidth > innerWidth, w: innerWidth, h: innerHeight };
  }, HUD);
}

async function fps(page, ms = 5000) {
  return page.evaluate((ms) => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(Math.round((n * 1000) / (performance.now() - t0) * 10) / 10); };
    requestAnimationFrame(tick);
  }), ms);
}

const feet = (page) => page.evaluate(() => { const f = window.world.feet; return [f.x, f.y, f.z]; });
const yaw = (page) => page.evaluate(() => { const e = new window.world.camera.rotation.constructor().setFromQuaternion(window.world.camera.quaternion, 'YXZ'); return e.y; });

/** a CDP touch drag: start, move in steps, hold, release (several fingers at once when given several paths) */
async function touchDrag(cdp, paths, holdMs = 0, steps = 8) {
  const pts = (k) => paths.map((p, i) => ({ x: p[0] + (p[2] - p[0]) * k, y: p[1] + (p[3] - p[1]) * k, id: i + 1, radiusX: 10, radiusY: 10, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
  for (let s = 1; s <= steps; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(s / steps) }); await sleep(30); }
  if (holdMs) {
    const t0 = Date.now();
    // keep the fingers live (tiny moves) while holding
    while (Date.now() - t0 < holdMs) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(1) }); await sleep(100); }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const dAng = (a, b) => Math.round((Math.atan2(Math.sin(b - a), Math.cos(b - a)) * 180) / Math.PI);
const tapEl = async (page, sel) => {
  const r = await page.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.touchscreen.tap(r[0], r[1]);
};

for (const [temple, dev] of runs) {
  const D = DEVICES[dev];
  const R = { temple, device: dev, notes: [], overlaps: {} };
  results.push(R);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/youtube|ERR_|favicon|net::/i.test(m.text())) errors.push(m.text()); });
  await page.emulate(D);
  const cdp = await page.createCDPSession();
  const t0 = Date.now();
  await page.goto(`${base}?temple=${temple}&preview=1`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1' && document.querySelector('#walk.on'), { timeout: 400000, polling: 1000 });
  R.loadS = Math.round((Date.now() - t0) / 100) / 10;
  R.touchClass = await page.evaluate(() => document.body.classList.contains('touch'));
  R.walkText = await page.$eval('#walk .en', (e) => e.textContent);
  R.profile = await page.evaluate(() => window.world.profile.tier);
  await page.screenshot({ path: `${out}/${temple}-${dev}-0-tap-to-walk.jpg`, type: 'jpeg', quality: 70 });

  // tap to walk in
  const vp = D.viewport;
  await page.touchscreen.tap(vp.width / 2, vp.height * 0.3);
  await page.waitForFunction(() => document.querySelector('#touch-pad.on') && window.world.controls.isLocked, { timeout: 10000 });
  await sleep(1500);
  R.layoutPortrait = await layout(page);
  await page.screenshot({ path: `${out}/${temple}-${dev}-1-portrait.jpg`, type: 'jpeg', quality: 70 });

  // frame rate: unthrottled, then CPU 4×
  R.fps = await fps(page, 4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await sleep(4000); // let the adaptive resolution settle
  R.fpsThrottled = await fps(page, 6000);
  R.pixelRatio = await page.evaluate(() => window.world.pixelRatio);

  // joystick: thumb down in the left zone, push up ~70 px (past the rim: run), hold 2 s
  const a = await feet(page);
  const jx = vp.width * 0.82, jy = vp.height * 0.78; // the joystick zone: right ~40 %
  await touchDrag(cdp, [[jx, jy, jx, jy - 70]], 2000);
  const b = await feet(page);
  R.joystickMoved = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) * 100) / 100;

  // drag to look (left side)
  const y0 = await yaw(page);
  await touchDrag(cdp, [[vp.width * 0.35, vp.height * 0.45, vp.width * 0.35 + 120, vp.height * 0.45]]);
  const y1 = await yaw(page);
  R.lookTurnedDeg = dAng(y0, y1);

  // both thumbs at once: walk and look together
  const c0 = await feet(page), yy0 = await yaw(page);
  await touchDrag(cdp, [[jx, jy, jx, jy - 50], [vp.width * 0.3, vp.height * 0.4, vp.width * 0.3 + 80, vp.height * 0.4]], 1000);
  const c1 = await feet(page), yy1 = await yaw(page);
  R.twoFinger = { moved: Math.round(Math.hypot(c1[0] - c0[0], c1[2] - c0[2]) * 100) / 100, turnedDeg: dAng(yy0, yy1) };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  // jump
  const jy0 = (await feet(page))[1];
  await tapEl(page, '#touch-buttons .jump');
  await sleep(180);
  R.jumped = Math.round(((await feet(page))[1] - jy0) * 100) / 100;
  await sleep(800);

  // Story button (a story may already be playing: it opens on arrival — then the tap pauses it)
  const storyBefore = await page.evaluate(() => window.stories.storyPlaying);
  await tapEl(page, '#touch-buttons .story');
  await sleep(3500);
  R.story = await page.evaluate((before) => ({ before, open: window.stories.card.open, playing: window.stories.storyPlaying, audio: { src: !!window.stories.card.media.getAttribute('src'), paused: window.stories.card.media.paused, t: Math.round(window.stories.card.media.currentTime * 10) / 10 }, id: window.stories.card.current?.id ?? null, toast: document.querySelector('#story-toast.on')?.textContent ?? '' }), storyBefore);
  if (R.story.open && !R.story.playing) {
    // and a second tap plays it again
    await tapEl(page, '#touch-buttons .story');
    await sleep(1500);
    R.story.retap = await page.evaluate(() => window.stories.storyPlaying);
  }
  if (R.story.open) {
    // a caption chip (CC) by touch
    const cc0 = await page.evaluate(() => document.querySelector('#story-card .cc').classList.contains('on'));
    await tapEl(page, '#story-card .cc');
    await sleep(300);
    R.ccToggled = cc0 !== (await page.evaluate(() => document.querySelector('#story-card .cc').classList.contains('on')));
    await tapEl(page, '#story-card .cc');
    await sleep(1500);
    R.overlaps.storyPortrait = (await layout(page)).overlaps;
    await page.screenshot({ path: `${out}/${temple}-${dev}-2-story-portrait.jpg`, type: 'jpeg', quality: 70 });
  }

  // Places → darshan
  await tapEl(page, '#touch-buttons .places');
  await sleep(600);
  R.placesOpen = await page.evaluate(() => document.querySelector('#places-panel').classList.contains('on'));
  await page.screenshot({ path: `${out}/${temple}-${dev}-3-places-portrait.jpg`, type: 'jpeg', quality: 70 });
  const target = await page.evaluate(() => (document.querySelector('#places-panel [data-id="garbhagriha"]') ? 'garbhagriha' : 'darshan'));
  await page.evaluate((id) => document.querySelector(`#places-panel [data-id="${id}"]`).scrollIntoView({ block: 'center' }), target);
  await sleep(300);
  await tapEl(page, `#places-panel [data-id="${target}"]`);
  await sleep(800);
  R.overlaps.travelling = (await layout(page)).overlaps;
  const tt = Date.now();
  await page.waitForFunction(() => !window.travel.active, { timeout: 120000 }).catch(() => R.notes.push('travel timeout'));
  R.travel = await page.evaluate(() => ({ result: window.travel.info?.result, zone: window.world.zone }));
  R.travelS = Math.round((Date.now() - tt) / 100) / 10;
  await sleep(5000); // the aarti dock / darshan toast
  R.layoutDarshanPortrait = await layout(page);
  await page.screenshot({ path: `${out}/${temple}-${dev}-4-darshan-portrait.jpg`, type: 'jpeg', quality: 70 });

  // landscape: same page, rotated
  const land = { ...vp, width: vp.height, height: vp.width, isLandscape: true };
  await page.setViewport(land);
  await sleep(1500);
  R.layoutDarshanLandscape = await layout(page);
  await page.screenshot({ path: `${out}/${temple}-${dev}-5-darshan-landscape.jpg`, type: 'jpeg', quality: 70 });
  // a story in landscape
  if (!(await page.evaluate(() => window.stories.card.open))) { await tapEl(page, '#touch-buttons .story'); await sleep(2500); }
  R.overlaps.storyLandscape = (await layout(page)).overlaps;
  await page.screenshot({ path: `${out}/${temple}-${dev}-6-story-landscape.jpg`, type: 'jpeg', quality: 70 });
  await tapEl(page, '#touch-buttons .places');
  await sleep(600);
  await page.screenshot({ path: `${out}/${temple}-${dev}-7-places-landscape.jpg`, type: 'jpeg', quality: 70 });
  await tapEl(page, '#places-panel .x');
  await sleep(400);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await sleep(3000);
  R.fpsThrottledLandscape = await fps(page, 5000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  R.errors = errors.slice(0, 8);
  console.log(JSON.stringify(R, (k, v) => (k === 'items' ? undefined : v)));
  await page.close();
}
await browser.close();
console.log('\nSUMMARY');
for (const r of results) {
  const ov = [r.layoutPortrait, r.layoutDarshanPortrait, r.layoutDarshanLandscape].flatMap((l) => l?.overlaps ?? []).concat(...Object.values(r.overlaps));
  const hs = [r.layoutPortrait, r.layoutDarshanPortrait, r.layoutDarshanLandscape].some((l) => l?.hscroll);
  console.log(`${r.temple} ${r.device} [${r.profile}] load ${r.loadS}s fps ${r.fps} → ${r.fpsThrottled} @${THROTTLE}× CPU (landscape ${r.fpsThrottledLandscape}), pr ${r.pixelRatio}; joystick ${r.joystickMoved} m; look ${r.lookTurnedDeg}°; two-finger ${JSON.stringify(r.twoFinger)}; jump ${r.jumped}; story ${JSON.stringify(r.story)}; places ${r.placesOpen} → ${JSON.stringify(r.travel)} in ${r.travelS}s; overlaps ${ov.length ? ov.join(' | ') : 'none'}; hscroll ${hs}; errors ${r.errors.length}`);
}

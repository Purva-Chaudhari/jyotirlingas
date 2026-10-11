// Checks a site's Places walking graph (BuiltSite.nav / places, see src/temples/engine/travel.ts and
// docs/content/navigation.md) in the real page, with the real physics:
//   1. static: every node has a floor under it near its y; every edge is walkable in a straight line both ways
//      (TempleWorld.walkable; an edge with a `before` hook — a gate — is reported as "gated" when shut)
//   2. edges: walks EVERY edge both ways (Travel.walkRoute, fast-forward speed); an edge that needs a nudge (the
//      pilgrim stalled) or doesn't arrive is STUCK
//   3. places: from the spawn, travels to every place (Travel.go) and reports arrival, time, nudges, zone
//   (and the longest frames seen during the trips: hitches > 60 ms)
//   route: suggests nodes for a new stretch: a grid search (0.5 m cells, the real collision) from A to B, pulled
//   tight into straight walkable legs — `node scripts/navcheck.mjs <temple> route x,y,z x,y,z [margin m]`
// Usage: node scripts/navcheck.mjs <temple> [static|edges|places|all] [--only=a,b] [--vip]
// Needs the dev server (port 5199; DEV_URL to override).
import puppeteer from 'puppeteer-core';

const [temple, mode = 'all', ...rest] = process.argv.slice(2);
if (!temple) {
  console.error('usage: node scripts/navcheck.mjs <temple> [static|edges|places|all] [--only=id,id]');
  process.exit(1);
}
const only = rest.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const base = process.env.DEV_URL ?? 'http://localhost:5199/temples.html';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 960, height: 540 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${base}?temple=${temple}&preview=1${rest.includes('--vip') ? '&darshan=vip' : ''}&at=0,0,0,0,0,-1`, { waitUntil: 'load', timeout: 180000 });
/** wait for the page (again, after a dev-server reload) and install the frame-time probe */
async function ensure() {
  await page.waitForFunction(() => window.world && window.travel && document.body.dataset.ready === '1', { timeout: 180000 });
  await page.evaluate(() => {
    if (window.__probe) return;
    window.__probe = true;
    window.world.reset();
    // frame times while travelling (hitches)
    window.__long = [];
    let last = performance.now();
    const tick = (t) => {
      const dt = t - last; last = t;
      if (window.world.travelling && dt > 60) window.__long.push([Math.round(dt), +window.world.feet.x.toFixed(1), +window.world.feet.y.toFixed(1), +window.world.feet.z.toFixed(1)]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
await ensure();
if (mode === 'route') {
  const [A, B] = rest.slice(0, 2).map((v) => v.split(',').map(Number));
  const margin = Number(rest[2] ?? 20);
  const out = await page.evaluate(([A, B, margin]) => {
    const w = window.world, h = 0.5;
    const x0 = Math.min(A[0], B[0]) - margin, z0 = Math.min(A[2], B[2]) - margin;
    const nx = Math.ceil((Math.abs(A[0] - B[0]) + 2 * margin) / h), nz = Math.ceil((Math.abs(A[2] - B[2]) + 2 * margin) / h);
    const key = (i, k) => k * nx + i;
    const cell = (x, z) => [Math.round((x - x0) / h), Math.round((z - z0) / h)];
    const [si, sk] = cell(A[0], A[2]), [gi, gk] = cell(B[0], B[2]);
    const ys = new Map([[key(si, sk), A[1]]]), prev = new Map([[key(si, sk), -1]]);
    const q = [[si, sk]];
    let found = false;
    while (q.length && !found) {
      const [i, k] = q.shift();
      const y = ys.get(key(i, k));
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nk = k + dk;
        if (ni < 0 || nk < 0 || ni >= nx || nk >= nz || prev.has(key(ni, nk))) continue;
        const X = x0 + ni * h, Z = z0 + nk * h;
        const f = w.groundAt(X, Z, y);
        if (f === null || f < y - 0.8 || !w.walkable([x0 + i * h, y, z0 + k * h], [X, f, Z])) continue;
        prev.set(key(ni, nk), key(i, k)); ys.set(key(ni, nk), f);
        if (ni === gi && nk === gk) { found = true; break; }
        q.push([ni, nk]);
      }
    }
    if (!found) return null;
    const path = [];
    for (let c = key(gi, gk); c !== -1; c = prev.get(c)) path.unshift([x0 + (c % nx) * h, ys.get(c), z0 + Math.floor(c / nx) * h]);
    path[0] = A; path[path.length - 1] = [B[0], ys.get(key(gi, gk)), B[2]];
    // pull tight: from each node, the farthest later point still reachable in a straight line
    const legs = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !w.walkable(path[i], path[j])) j--;
      legs.push(path[j]); i = j;
    }
    return legs.map((p) => p.map((v) => Math.round(v * 100) / 100));
  }, [A, B, margin]);
  console.log(out ? `route: ${out.map((p) => `[${p.join(', ')}]`).join(' → ')}` : 'route: none found (raise the margin?)');
  await browser.close();
  process.exit(out ? 0 : 1);
}
const graph = await page.evaluate(() => {
  const g = window.world.nav;
  if (!g) return null;
  return { nodes: g.nodes, edges: g.edges.map((e) => [e[0], e[1], !!e[2]?.before]), places: window.world.places.map((p) => ({ id: p.id, node: p.node })) };
});
if (!graph) { console.log(`RESULT temple=${temple}: no nav graph`); await browser.close(); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const fmt = (v) => `(${v.map((n) => n.toFixed(2)).join(',')})`;

if (mode === 'static' || mode === 'all') {
  const res = await page.evaluate((graph) => {
    const w = window.world, out = { nodes: [], edges: [] };
    for (const [id, n] of Object.entries(graph.nodes)) {
      const f = w.groundAt(n[0], n[2], n[1] + 0.3);
      if (f === null || Math.abs(f - n[1]) > 0.3) out.nodes.push([id, n, f]);
    }
    for (const [a, b, gated] of graph.edges) {
      const A = graph.nodes[a], B = graph.nodes[b];
      if (!A || !B) { out.edges.push([a, b, 'missing node']); continue; }
      const ab = w.walkable(A, B), ba = w.walkable(B, A);
      if (!ab || !ba) out.edges.push([a, b, gated ? 'gated' : ab ? 'blocked b→a' : ba ? 'blocked a→b' : 'blocked']);
    }
    return out;
  }, graph);
  console.log(`static: ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);
  for (const [id, n, f] of res.nodes) { bad++; console.log(`  NODE ${id} ${fmt(n)}: floor ${f === null ? 'none' : f.toFixed(2)}`); }
  for (const [a, b, why] of res.edges) { if (why !== 'gated') bad++; console.log(`  EDGE ${a} – ${b}: ${why}`); }
}

/** run a travel (already started by `start`) to its end; returns the trip info */
async function trip(start, arg, timeoutS = 120, tries = 4) {
  try {
    return await tripOnce(start, arg, timeoutS);
  } catch (e) {
    if (tries <= 1) return { result: `error ${e.message}` };
    console.log('  (page reloaded by an edit: again)');
    await sleep(1500);
    await ensure();
    return trip(start, arg, timeoutS, tries - 1);
  }
}
async function tripOnce(start, arg, timeoutS) {
  const ok = await page.evaluate(start, arg);
  if (ok === false) return { result: 'no route' };
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutS * 1000) {
    await sleep(150);
    const s = await page.evaluate(() => ({ active: window.travel.active, info: window.travel.info, feet: window.world.feet.toArray(), zone: window.world.zone }));
    if (!s.active) return { ...s.info, feet: s.feet, zone: s.zone, secs: (s.info.t1 - s.info.t0) / 1000 };
  }
  await page.evaluate(() => window.travel.stop());
  return { result: 'timeout' };
}

if (mode === 'edges' || mode === 'all') {
  let n = 0;
  for (const [a, b] of graph.edges) {
    if (only && !only.includes(a) && !only.includes(b)) continue;
    for (const [p, q] of [[a, b], [b, a]]) {
      const r = await trip(([p, q, nodes]) => {
        const n = nodes[p];
        window.world.feet.set(n[0], window.world.groundAt(n[0], n[2], n[1] + 0.3) ?? n[1], n[2]);
        window.travel.walkRoute([p, q]);
      }, [p, q, graph.nodes]);
      n++;
      if (process.env.VERBOSE) console.log(`  ${p} → ${q}: ${r.result} ${r.secs?.toFixed(1)} s nudges=${r.nudges}`);
      const end = graph.nodes[q];
      const off = r.feet ? Math.hypot(r.feet[0] - end[0], r.feet[2] - end[2]) : NaN;
      const stuck = r.result !== 'arrived' || r.nudges > 0 || off > 0.8 || Math.abs(r.feet[1] - end[1]) > 0.6;
      if (stuck) { bad++; console.log(`  STUCK ${p} → ${q}: ${r.result} nudges=${r.nudges} feet=${r.feet ? fmt(r.feet) : '-'} want ${fmt(end)}`); }
    }
  }
  console.log(`edges: walked ${n} edge directions`);
}

if (mode === 'places' || mode === 'all') {
  for (const pl of graph.places) {
    if (only && !only.includes(pl.id)) continue;
    const r = await trip((id) => { window.world.reset(); return window.travel.go(id); }, pl.id);
    const end = graph.nodes[pl.node];
    const off = r.feet ? Math.hypot(r.feet[0] - end[0], r.feet[2] - end[2]) : NaN;
    const okk = r.result === 'arrived' && off < 1;
    if (!okk) bad++;
    console.log(`  ${okk ? 'ok   ' : 'FAIL '} ${pl.id.padEnd(16)} ${r.result} ${r.secs?.toFixed(1) ?? '-'} s  ${r.length?.toFixed(0) ?? '-'} m  nudges=${r.nudges ?? '-'}  zone=${r.zone ?? '-'}  off=${off.toFixed(2)}${r.stalls?.length ? `  stalled at ${JSON.stringify(r.stalls)}` : ''}`);
  }
}
const long = await page.evaluate(() => window.__long ?? []).catch(() => []);
console.log(`frames > 60 ms while travelling: ${long.length}${long.length ? ' ' + JSON.stringify(long.slice(0, 20)) : ''}`);
console.log(`RESULT temple=${temple} mode=${mode} problems=${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);

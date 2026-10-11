// Builds public/data/landing/india.json — India's outline for the landing's glass hub.
//
// Source: Natural Earth 1:10m (public domain), India point-of-view variant:
//   - ne_10m_admin_0_countries_ind  (India's own boundary depiction: all of Jammu & Kashmir and Ladakh,
//                                     incl. Gilgit-Baltistan and Aksai Chin, Arunachal Pradesh; the islands)
// Douglas-Peucker simplified and rounded to 0.01°, so the file stays small.
//
//   node scripts/build-landing-map.mjs [cacheDir]
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const cache = process.argv[2] ?? join(tmpdir(), 'ne-landing');
mkdirSync(cache, { recursive: true });

async function load(name) {
  const p = join(cache, `${name}.geojson`);
  if (!existsSync(p)) {
    console.log('downloading', name);
    const r = await fetch(BASE + name + '.geojson');
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const flat = (pts) => pts.flatMap(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);

const countries = await load('ne_10m_admin_0_countries_ind');
const india = countries.features.find((f) => f.properties.ADM0_A3 === 'IND');
const polys = india.geometry.type === 'MultiPolygon' ? india.geometry.coordinates : [india.geometry.coordinates];
const outerRings = polys.map((p) => p[0]);
const outline = outerRings
  .map((r) => { const m = r.length >> 1; return [...dp(r.slice(0, m + 1), 0.025).slice(0, -1), ...dp(r.slice(m), 0.025)]; })
  .filter((r) => r.length >= 4 && Math.abs(r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) > 0.004)
  .map(flat)
  // the glass is the mainland alone: every island (Andaman & Nicobar, Lakshadweep, the delta islets) is
  // left out, so the slab reads as one clean shape
  .sort((a, b) => b.length - a.length)
  .slice(0, 1);

const out = {
  source: 'Natural Earth 1:10m (public domain), India point-of-view admin-0 (ne_10m_admin_0_countries_ind)',
  outline,
};
mkdirSync('public/data/landing', { recursive: true });
const json = JSON.stringify(out);
writeFileSync('public/data/landing/india.json', json);
console.log(`india.json ${(json.length / 1024).toFixed(1)} KB · ${outline.length} rings`);

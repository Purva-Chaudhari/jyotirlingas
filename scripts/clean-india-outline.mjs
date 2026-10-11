// Cleans the hub's India outline (public/data/landing/india.json) of hairline slivers — estuary inlets and
// spikes a few km wide (the Narmada / Mahi mouths in the Gulf of Khambhat, the Sundarbans creeks) that the glass
// draws as boxy seams. Wherever the coast comes back within GAP degrees of itself over a short stretch that
// encloses little area, the stretch is cut off and the gap closed with a straight segment.
// Then rebuild the mask: node scripts/build-landing-glass.mjs
//
//   node scripts/clean-india-outline.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'public/data/landing/india.json';
const GAP = 0.22; // degrees: closes slivers narrower than ~24 km
const MAX_SPAN = 60; // vertices: only short stretches
const MAX_AREA = 0.09; // deg²: only thin ones (a real gulf or peninsula is far larger)

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const dry = process.argv.includes('--dry');

function clean(flat) {
  let pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  let cuts = 0;
  for (let changed = true; changed; ) {
    changed = false;
    const n = pts.length;
    outer: for (let i = 0; i < n; i++) {
      for (let k = MAX_SPAN; k >= 3; k--) {
        const j = (i + k) % n;
        const a = pts[i], b = pts[j];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > GAP) continue;
        // the area the stretch i..j encloses with the closing segment (shoelace)
        let area = 0;
        for (let t = 0; t < k; t++) {
          const p = pts[(i + t) % n], q = pts[(i + t + 1) % n];
          area += p[0] * q[1] - q[0] * p[1];
        }
        area += b[0] * a[1] - a[0] * b[1];
        if (Math.abs(area) / 2 > MAX_AREA) continue;
        // cut i+1 .. j-1
        const keep = [];
        for (let t = 0; t < n; t++) {
          const off = (t - i + n) % n;
          if (off > 0 && off < k) continue;
          keep.push(pts[t]);
        }
        pts = keep;
        cuts++;
        changed = true;
        break outer;
      }
    }
  }
  return { flat: pts.flat(), cuts };
}

let total = 0;
const mainland = data.outline.reduce((a, b) => (b.length > a.length ? b : a));
data.outline = data.outline.map((ring) => {
  if (ring !== mainland) return ring; // islands: leave
  const { flat, cuts } = clean(ring);
  console.log(`ring of ${ring.length / 2} → ${flat.length / 2} points (${cuts} slivers cut)`);
  total += cuts;
  return flat.map((v) => Math.round(v * 1e4) / 1e4);
});
if (!dry && total) {
  writeFileSync(FILE, JSON.stringify(data));
  console.log('written', FILE);
}

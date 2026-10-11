import * as THREE from 'three';
import type { Merger } from './merge';
import type { SM } from './mats';
import { frustum, kalashaGeo, domeGeo, barrelGeo, kuduGeo, nasiGeo, hornGeo, figureGeo, squareLathe } from './geo';

/** a small square bulbous roof (kuta) of half-width r and height h */
const squareLatheK = (r: number, h: number) => squareLathe([[0, 0], [r, 0], [r * 1.08, h * 0.3], [r * 0.9, h * 0.6], [r * 0.45, h * 0.88], [0.04, h], [0, h]]);

/**
 * A Vijayanagara gopuram as at Srisailam: a granite/quartzite base storey (upapitha, adhisthana
 * mouldings, pilastered walls with niches, a heavy kapota cornice) pierced by the gate passage,
 * then diminishing lime-stucco tiers — each a pilastered storey with a central opening, figure
 * niches (sculpture as unfeatured massing), a curved cornice and a parapet of miniature shrines
 * (kutas at the corners, shalas in the middle, panjaras between) — crowned by a wagon-vault shala
 * with horned ends and a row of gilded kalashas.
 *
 * Local frame: x along the wall, z through the gate (outward +z), y up from the gate threshold.
 */
export interface GopuramOpts {
  W: number; // base width along the wall
  D: number; // base depth through the gate
  hb: number; // height of the stone base storey
  tiers: number;
  towerH: number; // height of the stucco tiers (excluding the shala roof)
  kalashas: number;
  white?: boolean;
  pw?: number; // passage width
  ph?: number; // passage height
}

const DOOR_STUD = new THREE.SphereGeometry(0.045, 6, 4);
const figCache = new Map<number, THREE.BufferGeometry>();
/** low-poly figure massing, cached by height (there are hundreds per gopuram) */
const figLo = (h: number) => {
  const k = Math.round(h * 20) / 20;
  let g = figCache.get(k);
  if (!g) figCache.set(k, (g = figureGeo(k, true)));
  return g;
};

export function buildGopuram(B: Merger, K: SM, o: GopuramOpts, at: { x: number; y: number; z: number; ry: number }, Dm: Merger = B) {
  B.setFrame(at.x, at.y, at.z, at.ry);
  Dm.setFrame(at.x, at.y, at.z, at.ry);
  const { W, D, hb, tiers: N, towerH } = o;
  const pw = o.pw ?? 4.2, ph = o.ph ?? 6.4;
  const S = K.gopStone, SC = K.gopStoneCarved;
  const Sm = o.white ? K.stuccoWhite : K.stuccoCream, Sm2 = o.white ? K.stuccoWhite2 : K.stuccoCream2, Fg = o.white ? K.figWhite : K.figCream;

  /** a box split around the passage: two halves (and optionally the part above the passage) */
  const split = (mat: THREE.Material, w: number, y: number, h: number, d: number, z = 0) => {
    const half = (w - pw) / 2;
    if (half > 0) {
      B.box(mat, half, h, d, -(pw / 2 + half / 2), y, z);
      B.box(mat, half, h, d, pw / 2 + half / 2, y, z);
    }
    if (y >= ph - 1e-3) B.box(mat, pw, h, d, 0, y, z);
    else if (y + h > ph) B.box(mat, pw, y + h - ph, d, 0, ph, z);
  };

  // ---- upapitha and adhisthana mouldings
  let y = 0;
  const bands: [number, number][] = [[0.45, 0.6], [0.3, 0.42], [0.38, 0.5], [0.15, 0.3], [0.28, 0.55], [0.2, 0.35]];
  bands.forEach(([h, ext], i) => { split(i === 2 ? SC : S, W + 2 * ext, y, h, D + 2 * ext); y += h; });
  const yw = y; // wall foot
  const hw = hb - 1.15; // wall top (start of prastara)

  // ---- walls of the base storey
  split(S, W, yw, hw - yw, D);
  const bh = 0.21 * W, kw = 0.17 * W;
  for (const sz of [1, -1]) {
    // central bay (bhadra) projecting 0.35, corner bays (karna) projecting 0.15
    const zb = sz * (D / 2 + 0.175), zk = sz * (D / 2 + 0.075);
    for (const sx of [-1, 1]) {
      const xa = pw / 2, xb = bh;
      B.box(S, xb - xa, hw - yw, 0.35, sx * (xa + xb) / 2, yw, zb);
      B.box(S, kw, hw - yw, 0.15, sx * (W / 2 - kw / 2), yw, zk);
    }
    B.box(S, 2 * bh, hw - ph, 0.35, 0, ph, zb);
    // pilasters (carved) across the face, with bracket capitals
    const face = (x: number) => sz * (D / 2 + (Math.abs(x) < bh ? 0.35 : Math.abs(x) > W / 2 - kw ? 0.15 : 0));
    for (let x = -W / 2 + 0.3; x <= W / 2 - 0.3; x += 1.15) {
      if (Math.abs(x) < pw / 2 + 0.55) continue;
      const zf = face(x);
      B.box(SC, 0.3, hw - yw - 0.4, 0.12, x, yw + 0.1, zf + sz * 0.06);
      B.box(S, 0.55, 0.28, 0.22, x, hw - 0.3, zf + sz * 0.1);
    }
    // gate jambs: carved stone frames at the passage mouth
    for (const sx of [-1, 1]) B.box(SC, 0.55, ph + 0.4, 0.5, sx * (pw / 2 + 0.27), 0, sz * (D / 2 + 0.35));
    B.box(SC, pw + 1.1, 0.5, 0.5, 0, ph, sz * (D / 2 + 0.35));
    // niches: dvarapala niches either side of the gate, deva-koshtas in the recessed bays
    const niche = (x: number, zf: number, h: number, w: number, fig: boolean) => {
      B.box(K.dark, w, h, 0.06, x, yw + 0.6, zf + sz * 0.02);
      B.box(SC, w + 0.4, 0.25, 0.25, x, yw + 0.6 + h, zf + sz * 0.1);
      for (const ex of [-1, 1]) B.box(SC, 0.18, h, 0.18, x + ex * (w / 2 + 0.09), yw + 0.6, zf + sz * 0.08);
      B.place(SC, kuduGeo(w * 0.42, 0.12, 0.2), x, yw + 0.85 + h, zf + sz * 0.12, sz > 0 ? 0 : Math.PI);
      if (fig) B.place(S, figureGeo(h * 0.92), x, yw + 0.62, zf + sz * 0.12, sz > 0 ? 0 : Math.PI);
    };
    for (const sx of [-1, 1]) {
      niche(sx * (pw / 2 + (bh - pw / 2) / 2 + 0.2), sz * (D / 2 + 0.35), Math.min(3.2, hw - yw - 1.4), 1.1, true);
      niche(sx * ((bh + W / 2 - kw) / 2), sz * (D / 2), Math.min(2.6, hw - yw - 1.6), 0.9, true);
    }
  }
  // side faces: pilasters and a central niche
  for (const sx of [-1, 1]) {
    for (let z = -D / 2 + 0.4; z <= D / 2 - 0.4; z += 1.15) {
      B.box(SC, 0.12, hw - yw - 0.4, 0.3, sx * (W / 2 + 0.06), yw + 0.1, z);
      B.box(S, 0.22, 0.28, 0.55, sx * (W / 2 + 0.1), hw - 0.3, z);
    }
    B.box(K.dark, 0.06, 2.4, 1.0, sx * (W / 2 + 0.02), yw + 0.7, 0);
    B.place(S, figureGeo(2.2), sx * (W / 2 + 0.1), yw + 0.72, 0, sx * Math.PI / 2);
  }
  // prastara: beam, curved kapota, bead course
  y = hw;
  B.box(S, W + 0.8, 0.4, D + 0.8, 0, y, 0); y += 0.4;
  B.place(S, frustum(W + 0.8, D + 0.8, W + 1.9, D + 1.9, 0.45), 0, y, 0); y += 0.45;
  B.box(S, W + 1.9, 0.12, D + 1.9, 0, y, 0); y += 0.12;
  B.box(SC, W + 0.6, hb - y, D + 0.6, 0, y, 0);
  y = hb;

  // ---- the passage: dark soot-stained lining, the blue Telugu signboard over the outer mouth
  for (const sx of [-1, 1]) B.box(K.graniteDark, 0.03, ph, D - 0.2, sx * (pw / 2 - 0.015), 0, 0);
  B.box(K.dark, pw, 0.03, D - 0.2, 0, ph - 0.03, 0);
  B.place(K.signTelugu, new THREE.BoxGeometry(pw + 3.2, 1.0, 0.12), 0, ph + 1.15, D / 2 + 0.68, 0, 1, true);
  // ---- passage: wooden gate leaves standing open against the passage walls, brass bosses
  for (const sx of [-1, 1]) {
    const lw = pw / 2 - 0.05, zc = D / 2 - 1.2 - lw / 2;
    B.box(K.wood, 0.14, ph - 0.25, lw, sx * (pw / 2 - 0.08), 0.05, zc);
    for (let yy = 0.5; yy < ph - 0.4; yy += 0.55) for (let zz = -lw / 2 + 0.2; zz < lw / 2 - 0.1; zz += 0.4) {
      B.place(K.brass, DOOR_STUD, sx * (pw / 2 - 0.16), yy, zc + zz);
    }
  }
  // colliders: the two halves of the base and tower; the passage stays open
  for (const sx of [-1, 1]) {
    const a = pw / 2 - 0.16, b = W / 2 + 0.7;
    B.solid(sx > 0 ? a : -b, 0, -D / 2 - 0.8, sx > 0 ? b : -a, hb + towerH, D / 2 + 0.8);
  }

  // ---- stucco tiers
  const topH = 0;
  const wts: number[] = [];
  for (let t = 0; t < N; t++) wts.push(1.14 - 0.3 * (t / Math.max(1, N - 1)));
  const sum = wts.reduce((a, b) => a + b, 0);
  let wTop = W, dTop = D;
  for (let t = 0; t < N; t++) {
    const f = t / N;
    const w = W * (0.96 - 0.5 * Math.pow(f, 1.12)), d = D * (0.84 - 0.3 * f);
    const ht = ((towerH - topH) * wts[t]) / sum;
    const bodyH = ht * 0.56, corH = ht * 0.12, paraH = ht * 0.32;
    B.box(Sm, w, bodyH, d, 0, y, 0);
    // projecting bays across each long face: centre (bhadra), intermediate (pratibhadra), corners (karna)
    const bays: [number, number, number][] = [[0, 0.26 * w, 0.85], [-0.27 * w, 0.13 * w, 0.5], [0.27 * w, 0.13 * w, 0.5], [-(w / 2 - 0.065 * w), 0.13 * w, 0.34], [w / 2 - 0.065 * w, 0.13 * w, 0.34]];
    const proj = (x: number) => { for (const [c, bw, pz] of bays) if (Math.abs(x - c) < bw / 2) return pz; return 0; };
    for (const sz of [1, -1]) {
      for (const [c, bw, pz] of bays) {
        // alternate bays carry the warmer, slightly darker ochre wash seen on the real towers
        B.box(Math.abs(c) > 0 && Math.abs(c) < w * 0.3 ? Sm2 : Sm, bw, bodyH, pz, c, y, sz * (d / 2 + pz / 2));
        // bay pilasters at its edges, a moulded base and a capital band
        for (const e of [-1, 1]) B.box(Sm, 0.14, bodyH, 0.07, c + e * (bw / 2 - 0.07), y, sz * (d / 2 + pz + 0.035));
        B.box(Sm, bw + 0.06, 0.16, pz + 0.08, c, y, sz * (d / 2 + pz / 2 + 0.04));
        B.box(Sm, bw + 0.1, 0.14, pz + 0.1, c, y + bodyH - 0.14, sz * (d / 2 + pz / 2 + 0.05));
        // a sculpture on every bay except the centre, standing on the bay face
        if (c !== 0) {
          const fh = Math.min(bodyH * 0.84, 2.7);
          Dm.box(K.dark, Math.min(bw - 0.3, fh * 0.55), fh * 1.02, 0.03, c, y + 0.16, sz * (d / 2 + pz + 0.01));
          B.box(Sm, Math.min(bw - 0.3, fh * 0.55) + 0.16, 0.12, 0.3, c, y + 0.16 + fh * 1.02, sz * (d / 2 + pz + 0.15));
          Dm.place(Fg, figLo(fh), c, y + 0.16, sz * (d / 2 + pz + 0.12), sz > 0 ? 0 : Math.PI);
        }
      }
      // the recesses between bays: close-set pilasters with a sculpted figure in a deep shadowed niche between
      // each pair (the dense sculpture of the real towers), smaller figures in the bays' upper registers
      const rh2 = Math.min(bodyH * 0.7, 2.2);
      const fr = figLo(rh2);
      for (let x = -w / 2 + 0.3; x <= w / 2 - 0.3; x += 0.42) {
        if (proj(x) > 0 || Math.abs(x) < 1.0) continue;
        Dm.box(Sm, 0.1, bodyH, 0.1, x, y, sz * (d / 2 + 0.05));
        const xm = x + 0.21;
        if (proj(xm) === 0 && Math.abs(xm) > 1.0 && Math.abs(xm) < w / 2 - 0.25 && Math.round((x + w) / 0.42) % 2 === 0) {
          Dm.box(K.dark, 0.32, rh2 * 1.04, 0.04, xm, y + 0.1, sz * (d / 2 + 0.01));
          Dm.place(Fg, fr, xm, y + 0.1, sz * (d / 2 + 0.08), sz > 0 ? 0 : Math.PI);
        }
      }
      for (const [c, bw, pz] of bays) {
        if (c === 0 || bw < 1.4) continue;
        const sf = figLo(Math.min(bodyH * 0.28, 0.9));
        for (const dx of [-bw * 0.28, bw * 0.28]) {
          Dm.box(K.dark, 0.3, Math.min(bodyH * 0.28, 0.9) * 1.05, 0.03, c + dx, y + bodyH * 0.62, sz * (d / 2 + pz + 0.01));
          Dm.place(Fg, sf, c + dx, y + bodyH * 0.62, sz * (d / 2 + pz + 0.06), sz > 0 ? 0 : Math.PI);
        }
      }
      const oh = Math.min(1.8, bodyH * 0.6);
      B.box(Sm, 1.5, oh + 0.45, 0.1, 0, y + bodyH * 0.12, sz * (d / 2 + 0.9));
      B.box(K.dark, 0.95, oh, 0.08, 0, y + bodyH * 0.18, sz * (d / 2 + 0.95));
      B.place(Sm, kuduGeo(0.55, 0.12, 0.14), 0, y + bodyH * 0.18 + oh + 0.12, sz * (d / 2 + 0.95), sz > 0 ? 0 : Math.PI);
    }
    for (const sx of [-1, 1]) {
      for (let z = -d / 2 + 0.3; z <= d / 2 - 0.3; z += 0.85) B.box(Sm, 0.08, bodyH, 0.16, sx * (w / 2 + 0.04), y, z);
      B.box(Sm, 0.3, bodyH, 0.3 * d, sx * (w / 2 + 0.15), y, 0);
      Dm.place(Fg, figLo(Math.min(bodyH * 0.7, 2.2)), sx * (w / 2 + 0.38), y + 0.12, 0, sx * Math.PI / 2);
    }
    // curved cornice
    B.place(Sm, frustum(w + 1.0, d + 1.0, w + 1.5, d + 1.5, corH * 0.7), 0, y + bodyH, 0);
    B.box(Sm, w + 1.5, corH * 0.3, d + 1.5, 0, y + bodyH + corH * 0.7, 0);
    const yp = y + bodyH + corH;
    // parapet core and the hara of miniature shrines
    B.box(Sm, w - 0.6, paraH * 0.55, d - 0.6, 0, yp, 0);
    const kutaB = Math.min(1.25, w * 0.11);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const kx = sx * (w / 2 - kutaB / 2 + 0.55), kz = sz * (d / 2 - kutaB / 2 + 0.55);
      B.box(Sm, kutaB, paraH * 0.55, kutaB, kx, yp, kz);
      B.place(Sm, frustum(kutaB + 0.12, kutaB + 0.12, kutaB * 0.7, kutaB * 0.7, paraH * 0.18), kx, yp + paraH * 0.55, kz);
      B.place(Sm, squareLatheK(kutaB * 0.36, paraH * 0.3), kx, yp + paraH * 0.73, kz);
      B.place(K.gilt, kalashaGeo(0.36, 8), kx, yp + paraH * 1.02, kz);
    }
    for (const sz of [-1, 1]) {
      // central shala, its little barrel roof and kalashas
      const sl = 0.36 * w;
      B.box(Sm, sl, paraH * 0.5, 1.0, 0, yp, sz * (d / 2 + 0.45));
      B.place(Sm, barrelGeo(sl, 0.5, paraH * 0.48), 0, yp + paraH * 0.5, sz * (d / 2 + 0.45));
      B.place(Sm, nasiGeo(0.42, 0.14), 0, yp + paraH * 0.5, sz * (d / 2 + 0.97), sz > 0 ? 0 : Math.PI);
      for (const kx of [-sl / 3, 0, sl / 3]) B.place(K.gilt, kalashaGeo(0.3, 8), kx, yp + paraH * 0.5 + paraH * 0.55 - 0.04, sz * (d / 2 + 0.45));
      // panjaras between kuta and shala, each with a nasi gable facing out
      for (const sx of [-1, 1]) {
        const xa = sl / 2 + 0.5, xb = w / 2 - kutaB - 0.2;
        for (let x = xa; x <= xb; x += 1.05) {
          B.box(Sm, 0.6, paraH * 0.45, 0.7, sx * x, yp, sz * (d / 2 + 0.35));
          B.place(Sm, nasiGeo(0.3, 0.6), sx * x, yp + paraH * 0.45, sz * (d / 2 + 0.35), 0);
        }
      }
    }
    for (const sx of [-1, 1]) {
      const sl = Math.max(1.2, 0.3 * d);
      B.box(Sm, 0.7, paraH * 0.48, sl, sx * (w / 2 + 0.1), yp, 0);
      B.place(Sm, barrelGeo(sl, 0.38, paraH * 0.4), sx * (w / 2 + 0.1), yp + paraH * 0.48, 0, Math.PI / 2);
    }
    y += ht;
    wTop = w * 0.97; dTop = d;
  }

  // ---- crowning shala: wagon vault with horned ends, kudu windows and the row of kalashas
  const L = wTop * 1.02, rw = dTop * 0.5, rh = rw * 1.35;
  B.box(Sm, wTop, 0.45, dTop, 0, y, 0);
  B.place(Sm, frustum(wTop, dTop, wTop + 0.5, dTop + 0.5, 0.25), 0, y + 0.45, 0);
  const yb = y + 0.7;
  B.place(Sm, barrelGeo(L, rw, rh), 0, yb, 0);
  for (const sx of [-1, 1]) {
    // gable faces: a horseshoe frame, and the kirtimukha crest over it (a rayed disc between flaring
    // fronds, as stylised massing)
    B.place(Sm, kuduGeo(rw * 0.78, 0.2, 0.3), sx * (L / 2 + 0.05), yb + 0.05, 0, Math.PI / 2);
    B.place(Sm, new THREE.CylinderGeometry(rw * 0.32, rw * 0.32, 0.25, 16).rotateZ(Math.PI / 2), sx * (L / 2 + 0.12), yb + rh * 0.95, 0);
    B.place(Sm, nasiGeo(rw * 0.55, 0.15), sx * (L / 2 + 0.06), yb + rh * 0.95, 0, Math.PI / 2);
    B.place(K.gilt, new THREE.SphereGeometry(rw * 0.1, 10, 8), sx * (L / 2 + 0.26), yb + rh * 0.95, 0);
    // horns curling out and up from the ends
    // the makara horns: rising from the gable end and curling outward (a "C" opening down and out)
    const horn = hornGeo(rw * 0.3, rw * 0.11).rotateZ(Math.PI * 0.05);
    B.place(Sm, horn, sx * (L / 2 + rw * 0.12), yb + rh * 0.78, 0, sx > 0 ? 0 : Math.PI, [1, 1.35, 1.8]);
  }
  for (const sz of [1, -1]) {
    B.place(Sm, kuduGeo(Math.min(1.2, rw * 0.5), 0.22, 0.35), 0, yb + rh * 0.18, sz * rw * 0.82, sz > 0 ? 0 : Math.PI);
    B.box(K.dark, 1.3, 1.1, 0.12, 0, yb + rh * 0.12, sz * rw * 0.66);
  }
  const kh = Math.min(2.0, 0.08 * W);
  for (let i = 0; i < o.kalashas; i++) {
    const x = (i / (o.kalashas - 1) - 0.5) * L * 0.74;
    B.place(K.gilt, kalashaGeo(kh, 16), x, yb + rh * 1.12 - 0.15, 0);
  }
  B.resetFrame();
  Dm.resetFrame();
  return { top: yb + rh * 1.12 + kh };
}

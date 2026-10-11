import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { lathe, type Merger } from './merge';
import type { SM } from './mats';
import { SHRINE, NANDI_M, DHWAJA, INNER } from './layout';
import { frustum, kalashaGeo, squareLathe, mergeAll, domeGeo, kuduGeo, figureGeo, barrelGeo } from './geo';
import { yaliPierGeo } from './yali';
import type { Offerings } from './offerings';

/**
 * Shri Mallikarjuna Swamy shrine (sanctum of the 7th c. and later; mukha mandapa of Harihara II /
 * Vijayanagara, 1405): a square dark-granite sanctum whose vimana is a stepped pyramid of gold-plated
 * tiers (photographed: ~10 horizontal tiers with a projecting central spine on each face and a column
 * of medallions on the east), a square griva with a Nandi at each corner and a square lattice dome
 * with a kalasha. East of it the antarala with its gold-clad doorway, the 16-pillared mukha mandapa,
 * the gold dhwajastambha and balipitha, the 42-pillared Nandi mandapa with its great Nandi, and the
 * pillared cloister of the inner court with painted stucco parapets.
 */

/**
 * A Vijayanagara / Kakatiya pillar of height h: square carved blocks alternating with lathe-turned
 * sections (bulb, rings, bell), a turned pot-and-cushion capital and cross brackets with drop pendants.
 * Returns plain (turned, warm buff) and carved geometry.
 */
export function pillarGeos(h: number, s = 1) {
  const plain: THREE.BufferGeometry[] = [], carved: THREE.BufferGeometry[] = [];
  const box = (arr: THREE.BufferGeometry[], w: number, hh: number, y: number) => {
    const g = new THREE.BoxGeometry(w * s, hh, w * s).translate(0, y + hh / 2, 0).toNonIndexed();
    g.deleteAttribute('uv'); arr.push(g);
  };
  /** an octagonal (or 16-sided) shaft with a fillet band at each end */
  const poly = (r: number, hh: number, y: number, sides: number) => {
    const g = new THREE.CylinderGeometry(r * s, r * s, hh, sides).rotateY(Math.PI / sides).translate(0, y + hh / 2, 0).toNonIndexed();
    g.deleteAttribute('uv'); g.computeVertexNormals(); plain.push(g);
    for (const yy of [y + 0.03, y + hh - 0.07]) {
      const f = new THREE.CylinderGeometry(r * 1.12 * s, r * 1.12 * s, 0.05, sides).rotateY(Math.PI / sides).translate(0, yy + 0.025, 0).toNonIndexed();
      f.deleteAttribute('uv'); f.computeVertexNormals(); plain.push(f);
    }
  };
  const k = h / 4.1;
  let y = 0;
  box(plain, 0.8, 0.16 * k, y); y += 0.16 * k;
  box(carved, 0.66, 0.7 * k, y); y += 0.7 * k; // square block with deeply carved panels
  poly(0.31, 0.62 * k, y, 8); y += 0.62 * k; // octagonal
  box(carved, 0.6, 0.6 * k, y); y += 0.6 * k;
  poly(0.27, 0.55 * k, y, 16); y += 0.55 * k; // sixteen-sided
  box(carved, 0.55, 0.42 * k, y); y += 0.42 * k;
  // capital: neck, pot (kalasha), lotus cushion, square abacus
  plain.push(lathe([[0.2, 0], [0.22, 0.05], [0.3, 0.14], [0.32, 0.2], [0.24, 0.28], [0.2, 0.31], [0.34, 0.36], [0.4, 0.42], [0.4, 0.45], [0, 0.45]]
    .map(([a, b]) => [a * s, y + b * k] as [number, number]), 16));
  y += 0.45 * k;
  box(plain, 0.78, Math.max(0.08, (h - y) * 0.3), y);
  const yb = y + Math.max(0.08, (h - y) * 0.3), hb = Math.max(0.1, h - yb);
  // carved bracket capitals (pushpa-potika): four curved corbels with hanging lotus buds
  const L = 0.82 * s, T = 0.28 * s;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, -hb * 0.35); sh.quadraticCurveTo(L * 0.55, -hb * 0.4, L * 0.3, -hb - 0.25 * k); sh.lineTo(0, -hb - 0.25 * k); sh.lineTo(0, 0);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -T / 2).rotateY((i * Math.PI) / 2).translate(0, h, 0).toNonIndexed();
    g.deleteAttribute('uv'); g.computeVertexNormals(); plain.push(g);
    const bud = new THREE.SphereGeometry(0.07 * s, 10, 8).scale(1, 1.4, 1).translate(L - 0.1 * s, h - hb * 0.45, 0).rotateY((i * Math.PI) / 2).toNonIndexed();
    bud.deleteAttribute('uv'); plain.push(bud);
  }
  return { plain: mergeAll(plain.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return g; })), carved: mergeAll(carved) };
}

/** carved collar with a chain of bells, a saddle-cloth band and kumkum dots for a Nandi placed like B.place(…, ry, s) */
function nandiDress(B: Merger, K: SM, x: number, y: number, z: number, ry: number, s: number) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
  const at = (g: THREE.BufferGeometry, mat: THREE.Material) => B.add(mat, g.applyMatrix4(m));
  const axis = new THREE.Vector3(0, 0.24, -0.3).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
  for (const [r, yy, zz] of [[0.25, 0.8, -0.7], [0.27, 0.74, -0.62]] as const) {
    at(new THREE.TorusGeometry(r, 0.028, 6, 28).applyQuaternion(q).translate(0, yy, zz), K.nandi);
  }
  // bells hanging from the lower collar, and a big bell at the dewlap
  for (let k = -4; k <= 4; k++) {
    const a = -Math.PI / 2 + k * 0.28;
    const p = new THREE.Vector3(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0).applyQuaternion(q).add(new THREE.Vector3(0, 0.74, -0.62));
    at(new THREE.SphereGeometry(0.035, 8, 6).translate(p.x, p.y - 0.04, p.z), K.nandi);
  }
  at(new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1.2, 1).translate(0, 0.38, -0.86), K.nandi);
  // a band of carved saddle-cloth across the back
  at(new THREE.TorusGeometry(0.42, 0.03, 6, 32, Math.PI).rotateY(Math.PI / 2).translate(0, 0.5, 0.05), K.nandi);
  // kumkum dots on the flanks and forehead
  for (const [px, py, pz] of [[0.4, 0.55, -0.1], [-0.4, 0.55, -0.1], [0.41, 0.6, 0.35], [-0.41, 0.6, 0.35], [0, 1.2, -1.07]]) {
    at(new THREE.SphereGeometry(0.025, 8, 6).translate(px, py, pz), K.kumkum);
  }
}

export function buildTemple(B: Merger, K: SM, P: Physics, root: THREE.Group, flames: Flames, O: Offerings, nandi: THREE.BufferGeometry) {
  const { half: H, inner: I, plinth: F, wallTop, mandX0, mandX1, mandZ, mandH, doorW, doorH } = SHRINE;
  const lights: THREE.PointLight[] = [];

  // ------------------------------------------------------------- plinth (adhisthana) of sanctum, antarala, mandapa
  const plinthBands: [number, number][] = [[0.22, 0.35], [0.26, 0.22], [0.16, 0.08], [0.26, 0.2]];
  const pieces: [number, number, number][] = [[-H, H, H], [H, mandX0, 3.2], [mandX0, mandX1, mandZ]];
  for (const [xa, xb, hz] of pieces) {
    let y = 0;
    for (const [h, ext] of plinthBands) {
      B.span(K.granite, xa - (xa === -H ? ext : 0), y, -hz - ext, xb + (xb === mandX1 ? ext : 0), y + h, hz + ext);
      y += h;
    }
  }
  B.solid(-H - 0.35, 0, -H - 0.35, mandX1 + 0.35, F, H + 0.35);
  B.solid(mandX0, 0, -mandZ - 0.35, mandX1 + 0.35, F, mandZ + 0.35);

  // ------------------------------------------------------------- sanctum walls (solid granite round the 3.3 m garbhagriha)
  const ceil = F + 3.7;
  B.span(K.granite, -H, F, -H, -I, wallTop, H, true); // west
  B.span(K.granite, I, F, -H, H, wallTop, -doorW / 2, true); // east, north of door
  B.span(K.granite, I, F, doorW / 2, H, wallTop, H, true); // east, south of door
  B.span(K.granite, I, F + doorH, -doorW / 2, H, wallTop, doorW / 2); // over the door
  B.span(K.granite, -I, F, -H, I, wallTop, -I, true); // north
  B.span(K.granite, -I, F, I, I, wallTop, H, true); // south
  B.span(K.graniteDark, -I, ceil, -I, I, wallTop, I); // roof mass over the chamber
  // exterior: plain courses of dark granite (as photographed) over two heavy base mouldings
  for (const [o, y0, y1] of [[0.12, F, F + 0.32], [0.06, F + 0.32, F + 0.5]] as const) {
    B.span(K.granite, -H - o, y0, -H - o, H + o, y1, -H); // north
    B.span(K.granite, -H - o, y0, H, H + o, y1, H + o); // south
    B.span(K.granite, -H - o, y0, -H, -H, y1, H); // west
    B.span(K.granite, H, y0, -H, H + o, y1, -3.2); // east, either side of the antarala
    B.span(K.granite, H, y0, 3.2, H + o, y1, H);
  }
  B.place(K.granite, frustum(2 * H, 2 * H, 2 * H + 0.5, 2 * H + 0.5, 0.35), 0, wallTop - 0.55, 0);

  // ------------------------------------------------------------- gold vimana
  // (photographed from the Nandi, 2024: 8 stepped gilt tiers with a projecting spine on each face and a
  //  framed sculpted panel on the east; then a square griva with a Nandi at each corner and a kudu panel on
  //  each face, a stepped square cupola with lattice, a lotus and a tall kalasha)
  let y = wallTop - 0.2;
  B.place(K.gold, frustum(2 * H + 0.5, 2 * H + 0.5, 2 * H + 0.8, 2 * H + 0.8, 0.3), 0, y, 0); y += 0.3;
  B.box(K.gold, 2 * H + 0.5, 0.35, 2 * H + 0.5, 0, y, 0); y += 0.35;
  const NT = 8, tierH = 0.8;
  const s0 = H + 0.1, s1 = 2.55;
  const yT0 = y;
  const tierS = (t: number) => s0 + (s1 - s0) * (t / (NT - 1));
  // the hara of each tier: embossed miniature shrines along its parapet — a domed kuta at each corner and
  // two barrel-roofed shalas per face either side of the central spine (each ≈0.5–0.6 m)
  const kutaG = mergeAll([frustum(0.5, 0.5, 0.5, 0.5, 0.3), domeGeo(0.27, 1.0, 4, 1.06, Math.PI / 4).translate(0, 0.3, 0), kalashaGeo(0.16, 6).translate(0, 0.55, 0)]);
  const shalaG = mergeAll([frustum(0.72, 0.36, 0.72, 0.36, 0.26), barrelGeo(0.72, 0.2, 0.2).translate(0, 0.26, 0)]);
  for (let t = 0; t < NT; t++) {
    const s = tierS(t);
    const face = tierH * 0.64;
    B.box(K.gold, 2 * s, face, 2 * s, 0, y, 0);
    const bw = 2.7 - t * 0.1;
    B.box(K.gold, bw, face, 2 * s + 0.5, 0, y, 0);
    B.box(K.gold, 2 * s + 0.5, face, bw, 0, y, 0);
    B.place(K.gold, frustum(2 * s - 0.05, 2 * s - 0.05, 2 * s + 0.36, 2 * s + 0.36, tierH * 0.36), 0, y + face, 0);
    B.place(K.gold, frustum(bw, 2 * s + 0.45, bw + 0.3, 2 * s + 0.82, tierH * 0.36), 0, y + face, 0);
    B.place(K.gold, frustum(2 * s + 0.45, bw, 2 * s + 0.82, bw + 0.3, tierH * 0.36), 0, y + face, 0);
    if (t < NT - 1) {
      const sn = tierS(t + 1) + 0.16, yb = y + tierH;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.place(K.gold, kutaG, sx * sn, yb, sz * sn, 0, t > 4 ? 0.8 : 1);
      const off = (bw / 2 + sn) / 2 + 0.05;
      for (const e of [-1, 1]) {
        if (off + 0.36 > sn) continue;
        for (const sd of [-1, 1]) {
          B.place(K.gold, shalaG, e * off, yb, sd * (sn + 0.02), 0, t > 4 ? 0.8 : 1);
          B.place(K.gold, shalaG, sd * (sn + 0.02), yb, e * off, Math.PI / 2, t > 4 ? 0.8 : 1);
        }
      }
    }
    y += tierH;
  }
  // the great relief panel on the east face (tiers 1–3): a makara-torana arch ≈2.4 m wide over a deep
  // niche with Shiva-Parvati and attendants flanking a lingam, under a kirtimukha
  {
    const t = 1.2, s = tierS(t) + 0.3, py = yT0 + t * tierH;
    B.box(K.gold, 0.4, 2.1, 2.5, s, py - 0.25, 0); // the projecting frame block
    B.box(K.goldLattice, 0.06, 1.55, 1.9, s + 0.2, py - 0.15, 0); // the shadowed niche back
    for (const sx of [-1, 1]) {
      B.box(K.gold, 0.32, 1.7, 0.26, s + 0.24, py - 0.25, sx * 1.08); // pilasters
      B.place(K.gold, new THREE.SphereGeometry(0.16, 10, 8).scale(1.4, 1, 1), s + 0.3, py + 1.45, sx * 1.05); // makara heads
    }
    B.place(K.gold, kuduGeo(1.0, 0.24, 0.34), s + 0.28, py + 1.38, 0, Math.PI / 2);
    B.place(K.gold, kuduGeo(1.25, 0.08, 0.2), s + 0.22, py + 1.38, 0, Math.PI / 2);
    B.place(K.gold, new THREE.SphereGeometry(0.24, 12, 10).scale(0.7, 1, 1.1), s + 0.34, py + 2.55, 0); // kirtimukha boss
    for (const [z, fh] of [[-0.62, 1.15], [-0.28, 1.25], [0.28, 1.25], [0.62, 1.15]] as const) B.place(K.gold, figureGeo(fh), s + 0.28, py - 0.1, z, Math.PI / 2);
    B.place(K.gold, frustum(0.4, 0.4, 0.34, 0.34, 0.2), s + 0.3, py - 0.1, 0);
    B.place(K.gold, lathe([[0.1, 0], [0.1, 0.25], [0.08, 0.33], [0, 0.36]], 12), s + 0.3, py + 0.1, 0);
    for (const [i, r] of [[5.2, 0.6], [6.6, 0.45]] as const) {
      const ss = tierS(i) + 0.3;
      B.place(K.gold, new THREE.TorusGeometry(r, r * 0.16, 6, 20), ss, yT0 + i * tierH + 0.4, 0, Math.PI / 2);
      B.place(K.gold, new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.12, 20).rotateX(Math.PI / 2), ss, yT0 + i * tierH + 0.4, 0, Math.PI / 2);
    }
  }
  // griva platform with a seated gilt Nandi (≈0.5 m) at each corner, the square griva with a kudu panel per face
  B.box(K.gold, 2 * s1 + 0.6, 0.35, 2 * s1 + 0.6, 0, y, 0); y += 0.35;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    B.place(K.gold, nandi, sx * (s1 - 0.15), y, sz * (s1 - 0.15), Math.atan2(sx, sz) + Math.PI, 0.42);
  }
  const gw = 2 * s1 - 0.8;
  B.box(K.gold, gw, 0.75, gw, 0, y, 0);
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    B.box(K.gold, nx !== 0 ? 0.12 : 1.3, 0.62, nz !== 0 ? 0.12 : 1.3, nx * (gw / 2 + 0.06), y + 0.06, nz * (gw / 2 + 0.06));
    B.place(K.gold, kuduGeo(0.48, 0.1, 0.16), nx * (gw / 2 + 0.12), y + 0.6, nz * (gw / 2 + 0.12), nx !== 0 ? Math.PI / 2 : 0);
  }
  y += 0.75;
  B.place(K.gold, frustum(gw, gw, gw + 0.5, gw + 0.5, 0.22), 0, y, 0); y += 0.22;
  // the crown: a SQUARE cupola in three straight-sided lattice steps, each with a moulded lip, then a
  // small square dome, a lotus and the tall (≈1.5 m) kalasha
  const steps: [number, number, number][] = [[gw - 0.5, gw - 0.85, 0.6], [gw - 1.15, gw - 1.5, 0.55], [gw - 1.8, gw - 2.1, 0.5]];
  for (const [w0, w1, h] of steps) {
    B.place(K.goldLattice, frustum(w0, w0, w1, w1, h), 0, y, 0);
    B.place(K.gold, frustum(w1 + 0.12, w1 + 0.12, w1 + 0.2, w1 + 0.2, 0.1), 0, y + h, 0);
    B.place(K.gold, frustum(w1 + 0.2, w1 + 0.2, w1 - 0.05, w1 - 0.05, 0.08), 0, y + h + 0.1, 0);
    y += h + 0.18;
  }
  const dw = (gw - 2.1) / 2;
  B.place(K.goldLattice, squareLathe([[0, 0], [dw, 0], [dw * 1.02, 0.18], [dw * 0.85, 0.45], [dw * 0.5, 0.68], [0.12, 0.78], [0, 0.8]]), 0, y, 0);
  y += 0.76;
  B.place(K.gilt, lathe([[0.3, 0], [0.36, 0.06], [0.2, 0.15], [0.18, 0.26], [0, 0.28]], 16), 0, y - 0.04, 0);
  B.place(K.gilt, kalashaGeo(1.5, 20), 0, y + 0.22, 0);
  y += 0.04;
  const vimanaTop = y + 1.8;
  // ------------------------------------------------------------- antarala: passage with gold-clad doorway
  const ax0 = H, ax1 = mandX0, aw = 1.05, aH = F + 3.3;
  B.span(K.granite, ax0, F, -3.2, ax1, 5.0, -aw, true);
  B.span(K.granite, ax0, F, aw, ax1, 5.0, 3.2, true);
  B.span(K.granite, ax0, aH, -aw, ax1, 5.0, aw);
  // gold panels lining the antarala and framing the sanctum door
  B.span(K.goldIn, ax0, F, aw - 0.05, ax1, aH - 0.2, aw);
  B.span(K.goldIn, ax0, F, -aw, ax1, aH - 0.2, -aw + 0.05);
  for (const s of [-1, 1]) {
    B.span(K.goldIn, H + 0.02, F, s * (doorW / 2 + 0.4), H + 0.18, F + doorH + 0.25, s * (doorW / 2)); // jambs
  }
  B.span(K.goldIn, H + 0.02, F + doorH, -doorW / 2 - 0.4, H + 0.2, F + doorH + 0.45, doorW / 2 + 0.4); // lintel
  B.span(K.goldPlain, H - 0.2, F, -doorW / 2, H + 0.25, F + 0.12, doorW / 2); // threshold
  B.span(K.polished, ax0, F - 0.05, -aw, ax1, F + 0.008, aw);
  // silver-clad frame where the antarala opens to the mandapa
  for (const s of [-1, 1]) B.span(K.silver, ax1 - 0.1, F, s * aw, ax1 + 0.12, aH, s * (aw + 0.45));
  B.span(K.silver, ax1 - 0.1, aH - 0.35, -aw - 0.45, ax1 + 0.12, aH + 0.3, aw + 0.45);
  // floral arch over the sanctum doorway
  O.arch(H + 0.3, F + doorH + 0.55, 0, 0.95, 0.35);

  // ------------------------------------------------------------- mukha mandapa (16 pillars)
  const mw = 0.55; // wall thickness
  const eDoor = 1.3, nDoorX: [number, number] = [12.6, 15.0];
  // west wall (against the antarala) with the opening
  B.span(K.granite, mandX0, F, -mandZ, mandX0 + mw, mandH, -aw - 0.45, true);
  B.span(K.granite, mandX0, F, aw + 0.45, mandX0 + mw, mandH, mandZ, true);
  // east wall with the main door
  B.span(K.granite, mandX1 - mw, F, -mandZ, mandX1, mandH, -eDoor, true);
  B.span(K.granite, mandX1 - mw, F, eDoor, mandX1, mandH, mandZ, true);
  B.span(K.granite, mandX1 - mw, F + 3.4, -eDoor, mandX1, mandH, eDoor);
  // north wall with the exit door, south wall with two brass jali windows
  B.span(K.granite, mandX0, F, -mandZ, nDoorX[0], mandH, -mandZ + mw, true);
  B.span(K.granite, nDoorX[1], F, -mandZ, mandX1, mandH, -mandZ + mw, true);
  B.span(K.granite, nDoorX[0], F + 3.1, -mandZ, nDoorX[1], mandH, -mandZ + mw);
  const jali: [number, number][] = [[11.2, 13.6], [16.4, 18.8]];
  let jx = mandX0;
  for (const [a, b] of jali) {
    B.span(K.granite, jx, F, mandZ - mw, a, mandH, mandZ, true);
    B.span(K.granite, a, F, mandZ - mw, b, F + 1.0, mandZ, true);
    B.span(K.granite, a, F + 3.2, mandZ - mw, b, mandH, mandZ, true);
    // jali: a grid of brass tiles with lingam emblems, open between
    for (let yy = F + 1.05; yy < F + 3.15; yy += 0.3) for (let xx = a + 0.15; xx < b - 0.05; xx += 0.3) {
      if ((Math.round((yy - F) / 0.3) + Math.round((xx - a) / 0.3)) % 2 === 0) B.box(K.brass, 0.24, 0.24, 0.05, xx, yy, mandZ - mw / 2);
    }
    B.solid(a, F, mandZ - mw, b, F + 3.2, mandZ);
    jx = b;
  }
  B.span(K.granite, jx, F, mandZ - mw, mandX1, mandH, mandZ, true);
  // pilasters (carved) along the mandapa's outer walls
  for (let x = mandX0 + 0.8; x < mandX1 - 0.3; x += 1.6) {
    for (const s of [-1, 1]) B.box(K.graniteCarved, 0.42, mandH - F - 0.5, 0.12, x, F + 0.1, s * (mandZ + 0.06));
  }
  for (const z of [-6.2, -4.4, -2.6, 2.6, 4.4, 6.2]) B.box(K.graniteCarved, 0.12, mandH - F - 0.5, 0.42, mandX1 + 0.06, F + 0.1, z);
  // pillars, beams, coffered ceiling
  const pg = pillarGeos(4.1);
  const px = [10.6, 13.6, 16.6, 19.6], pz = [-4.5, -1.5, 1.5, 4.5];
  for (const x of px) for (const z of pz) {
    B.place(K.pillarStone, pg.plain, x, F, z);
    B.place(K.graniteCarved, pg.carved, x, F, z);
    P.solid(x - 0.33, F, z - 0.33, x + 0.33, F + 4.1, z + 0.33);
  }
  const ceilY = F + 4.1;
  for (const z of pz) B.span(K.granite, mandX0 + mw, ceilY, z - 0.2, mandX1 - mw, ceilY + 0.38, z + 0.2);
  for (const x of px) B.span(K.granite, x - 0.2, ceilY, -mandZ + mw, x + 0.2, ceilY + 0.38, mandZ - mw);
  B.span(K.granite, mandX0, ceilY + 0.38, -mandZ, mandX1, ceilY + 0.6, mandZ);
  // ceiling coffers: a carved lotus boss in each bay
  for (let i = 0; i < px.length - 1; i++) for (let j = 0; j < pz.length - 1; j++) {
    const cx = (px[i] + px[i + 1]) / 2, cz = (pz[j] + pz[j + 1]) / 2;
    B.place(K.graniteCarved, lathe([[0, 0], [0.6, 0], [0.5, -0.1], [0.32, -0.22], [0.1, -0.3], [0, -0.32]], 12), cx, ceilY + 0.38, cz);
  }
  // polished floor
  B.span(K.polished, mandX0 + mw, F - 0.05, -mandZ + mw, mandX1 - mw, F + 0.008, mandZ - mw);
  B.span(K.polished, mandX1 - mw, F - 0.05, -eDoor, mandX1, F + 0.008, eDoor);
  B.span(K.polished, nDoorX[0], F - 0.05, -mandZ, nDoorX[1], F + 0.008, -mandZ + mw);
  // exterior cornice and painted stucco parapet
  B.place(K.granite, frustum(mandX1 - mandX0, 2 * mandZ, mandX1 - mandX0 + 1.1, 2 * mandZ + 1.1, 0.4), (mandX0 + mandX1) / 2, mandH - 0.4, 0);
  const parapet = (x0: number, x1: number, z0: number, z1: number, y0: number, h: number, mat: THREE.Material) => {
    B.span(mat, x0, y0, z0, x1, y0 + h, z0 + 0.3);
    B.span(mat, x0, y0, z1 - 0.3, x1, y0 + h, z1);
    B.span(mat, x0, y0, z0, x0 + 0.3, y0 + h, z1);
    B.span(mat, x1 - 0.3, y0, z0, x1, y0 + h, z1);
  };
  parapet(mandX0 + 0.1, mandX1 + 0.45, -mandZ - 0.45, mandZ + 0.45, mandH, 1.0, K.paintedMandapa);
  for (const sx of [mandX0 + 0.3, mandX1 + 0.25]) for (const sz of [-mandZ - 0.25, mandZ + 0.25]) {
    B.place(K.stuccoCream, domeGeo(0.45, 1.1, 4, 1.05, Math.PI / 4), sx, mandH + 1.0, sz);
    B.place(K.gilt, kalashaGeo(0.4, 8), sx, mandH + 1.48, sz);
  }
  // the white stucco Nandi with black horns on the mandapa roof, gazing at the vimana
  B.box(K.stuccoWhite, 2.2, 0.35, 1.2, 10.4, mandH, 0);
  B.place(K.stuccoWhite, nandi, 10.4, mandH + 0.35, 0, Math.PI / 2, 1.05);
  B.add(K.gilt, new THREE.TorusGeometry(0.27, 0.035, 6, 24).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.24, -0.3).normalize())).translate(0, 0.78, -0.68).scale(1.05, 1.05, 1.05).rotateY(Math.PI / 2).translate(10.4, mandH + 0.35, 0));
  // east steps and porch, north exit steps
  for (let i = 0; i < 3; i++) {
    B.span(K.granite, mandX1, 0, -2.0, mandX1 + 1.2 - i * 0.4, 0.3 * (i + 1), 2.0);
    B.span(K.granite, nDoorX[0] - 0.4, 0, -mandZ - 1.2 + i * 0.4, nDoorX[1] + 0.4, 0.3 * (i + 1), -mandZ);
    P.floor(root, mandX1, mandX1 + 1.2 - i * 0.4, -2.0, 2.0, 0.3 * (i + 1));
    P.floor(root, nDoorX[0] - 0.4, nDoorX[1] + 0.4, -mandZ - 1.2 + i * 0.4, -mandZ, 0.3 * (i + 1));
  }
  // floors inside: mandapa, antarala, sanctum door passage (sanctum floor is laid in sanctum.ts)
  P.floor(root, mandX0, mandX1, -mandZ + mw, mandZ - mw, F);
  P.floor(root, mandX1 - mw - 0.01, mandX1 + 0.01, -eDoor, eDoor, F);
  P.floor(root, nDoorX[0], nDoorX[1], -mandZ - 0.01, -mandZ + mw + 0.01, F);
  P.floor(root, H - 0.01, mandX0 + 0.01, -aw, aw, F);
  P.floor(root, I - 0.01, H + 0.01, -doorW / 2, doorW / 2, F);
  // the small black Nandi inside the mandapa, garlanded, facing the sanctum
  // (set 1.25 m north of the axis so pilgrims coming up the steps walk straight in)
  const snx = 20.85, snz = -1.25;
  B.box(K.blackStone, 1.4, 0.3, 0.8, snx, F, snz);
  B.place(K.nandi, nandi, snx, F + 0.3, snz, Math.PI / 2, 0.5);
  nandiDress(B, K, snx, F + 0.3, snz, Math.PI / 2, 0.5);
  P.solid(snx - 0.7, F, snz - 0.4, snx + 0.7, F + 1.0, snz + 0.4);
  O.garlandOn(snx - 0.52, F + 0.3 + 0.5 * 0.58, snz, 0.26, 'x');
  // queue barricades (yellow rails) along the mandapa aisle
  for (const z of [-2.6, 2.6]) {
    B.span(K.yellowRail, 9.0, F + 0.95, z - 0.04, 18.8, F + 1.02, z + 0.04);
    B.span(K.yellowRail, 9.0, F + 0.45, z - 0.03, 18.8, F + 0.5, z + 0.03);
    for (let x = 9.0; x <= 18.9; x += 1.65) B.span(K.yellowRail, x - 0.03, F, z - 0.03, x + 0.03, F + 1.02, z + 0.03);
  }
  // hanging brass lamps and wall lamps of the mandapa; two lights (zone-switched)
  for (const x of [12.1, 15.1, 18.1]) {
    B.span(K.brass, x - 0.01, F + 2.6, -0.01, x + 0.01, ceilY, 0.01);
    B.place(K.brass, lathe([[0, 0], [0.16, 0.02], [0.2, 0.06], [0.05, 0.1], [0.02, 0.4]], 12), x, F + 2.5, 0);
    for (let k = 0; k < 5; k++) flames.points.push(new THREE.Vector3(x + Math.cos(k * 1.256) * 0.17, F + 2.6, Math.sin(k * 1.256) * 0.17));
  }
  for (const [x, z] of [[14, 0], [9.5, 0]]) {
    const l = new THREE.PointLight(0xffa860, 9, 11, 1.6);
    l.position.set(x, F + 3.0, z);
    root.add(l); lights.push(l);
  }

  // ------------------------------------------------------------- dhwajastambha and balipitha
  const dx = DHWAJA.x;
  for (const [w, h, y0] of [[1.7, 0.45, 0], [1.35, 0.4, 0.45], [1.0, 0.55, 0.85]] as const) B.box(K.granite, w, h, w, dx, y0, 0);
  B.place(K.dhwaja, lathe([[0.5, 0], [0.55, 0.1], [0.42, 0.25], [0.3, 0.45], [0.2, 0.6], [0.2, 0.7]], 16), dx, 1.4, 0);
  B.place(K.dhwaja, new THREE.CylinderGeometry(0.16, 0.2, 13, 16), dx, 2.1 + 6.5, 0);
  for (let yy = 2.6; yy < 15; yy += 1.25) B.place(K.dhwaja, new THREE.TorusGeometry(0.2, 0.04, 6, 16).rotateX(Math.PI / 2), dx, yy, 0);
  for (const yy of [13.6, 14.3]) {
    B.box(K.dhwaja, 1.3, 0.08, 0.1, dx, yy, 0);
    for (const e of [-0.6, 0.6]) B.place(K.dhwaja, new THREE.ConeGeometry(0.07, 0.18, 8).rotateX(Math.PI), dx + e, yy - 0.12, 0);
  }
  B.place(K.dhwaja, kalashaGeo(0.7, 12), dx, 15.1, 0);
  P.solid(dx - 0.85, 0, -0.85, dx + 0.85, 15, 0.85);
  // balipitha: lotus pedestal on a square base
  B.box(K.granite, 1.1, 0.4, 1.1, dx + 1.6, 0, 0);
  B.place(K.graniteCarved, lathe([[0.45, 0], [0.5, 0.08], [0.38, 0.2], [0.55, 0.32], [0.6, 0.42], [0.5, 0.48], [0, 0.48]], 16), dx + 1.6, 0.4, 0);
  P.solid(dx + 1.05, 0, -0.55, dx + 2.15, 0.9, 0.55);
  O.heap(dx + 1.6, 0.9, 0, 0.22, 0.05, 14);

  // ------------------------------------------------------------- Nandi mandapa (42 pillars)
  const { x0: nx0, x1: nx1, z: nz, plinth: np, h: nh } = NANDI_M;
  let yy = 0;
  for (const [h, ext] of [[0.25, 0.3], [0.3, 0.15], [0.2, 0.0]] as const) { B.span(K.granite, nx0 - ext, yy, -nz - ext, nx1 + ext, yy + h, nz + ext); yy += h; }
  B.span(K.stoneFloor, nx0, np - 0.02, -nz, nx1, np + 0.008, nz);
  P.floor(root, nx0 - 0.3, nx1 + 0.3, -nz - 0.3, nz + 0.3, np);
  // steps on all four sides at the centre
  for (const [sx, sz] of [[1, 0], [-1, 0]]) {
    for (let i = 0; i < 2; i++) {
      const x = sx > 0 ? nx1 + 0.3 + i * 0.4 : nx0 - 0.3 - i * 0.4;
      B.span(K.granite, Math.min(x, x + sx * 0.4), 0, -1.8, Math.max(x, x + sx * 0.4), np - (i + 1) * 0.25, 1.8);
      P.floor(root, Math.min(x, x + sx * 0.4), Math.max(x, x + sx * 0.4), -1.8, 1.8, np - (i + 1) * 0.25);
    }
    void sz;
  }
  const npg = pillarGeos(nh - np - 0.45, 0.8);
  const ncx: number[] = [], ncz: number[] = [];
  for (let i = 0; i < 7; i++) ncx.push(nx0 + 0.5 + i * ((nx1 - nx0 - 1) / 6));
  ncz.push(-nz + 0.5, -nz + 2.4, -2.0, 2.0, nz - 2.4, nz - 0.5);
  for (const x of ncx) for (const z of ncz) {
    B.place(K.pillarStone, npg.plain, x, np, z);
    B.place(K.graniteCarved, npg.carved, x, np, z);
    P.solid(x - 0.3, np, z - 0.3, x + 0.3, nh, z + 0.3);
  }
  const nTop = nh - 0.45;
  for (const z of ncz) B.span(K.granite, nx0 + 0.2, nTop, z - 0.17, nx1 - 0.2, nTop + 0.3, z + 0.17);
  for (const x of ncx) B.span(K.granite, x - 0.17, nTop, -nz + 0.2, x + 0.17, nTop + 0.3, nz - 0.2);
  B.span(K.granite, nx0 - 0.1, nTop + 0.3, -nz - 0.1, nx1 + 0.1, nh, nz + 0.1);
  B.place(K.granite, frustum(nx1 - nx0 + 0.2, 2 * nz + 0.2, nx1 - nx0 + 1.0, 2 * nz + 1.0, 0.3), (nx0 + nx1) / 2, nh - 0.3, 0);
  parapet(nx0 - 0.4, nx1 + 0.4, -nz - 0.4, nz + 0.4, nh, 0.9, K.paintedNandi);
  for (const sx of [nx0 - 0.2, nx1 + 0.2]) for (const sz of [-nz - 0.2, nz + 0.2]) {
    B.place(K.stuccoCream, domeGeo(0.42, 1.1, 4, 1.05, Math.PI / 4), sx, nh + 0.9, sz);
    B.place(K.gilt, kalashaGeo(0.38, 8), sx, nh + 1.35, sz);
  }
  // the great Nandi on its pedestal, facing west to the sanctum
  const ncX = (nx0 + nx1) / 2;
  B.box(K.granite, 4.2, 0.25, 1.9, ncX, np, 0);
  B.box(K.graniteCarved, 3.9, 0.4, 1.6, ncX, np + 0.25, 0);
  B.place(K.nandi, nandi, ncX, np + 0.65, 0, Math.PI / 2, 1.3);
  nandiDress(B, K, ncX, np + 0.65, 0, Math.PI / 2, 1.3);
  P.solid(ncX - 2.1, np, -0.95, ncX + 2.1, np + 2.4, 0.95);
  O.garlandOn(ncX - 1.3 * 0.62 * 1.0, np + 0.65 + 1.3 * 0.6, 0, 0.6, 'x');
  O.scatter(ncX - 1.8, ncX + 1.8, -0.8, 0.8, np + 0.65, 30, 0.3);

  // ------------------------------------------------------------- inner court cloister (north, south, west)
  const { x0: ix0, x1: ix1, z0: iz0, z1: iz1, depth: dep, h: ih } = INNER;
  const cf = 0.45; // cloister floor
  const gaps: Record<string, [number, number][]> = { n: [[9.8, 14.2]], s: [[9.8, 14.2]], w: [[-2.2, 2.2]] };
  const wallRun = (side: 'n' | 's' | 'w') => {
    const along = side === 'w' ? [iz0, iz1] : [ix0, ix1];
    const cuts = gaps[side];
    let a = along[0];
    const segs: [number, number][] = [];
    for (const [g0, g1] of cuts) { segs.push([a, g0]); a = g1; }
    segs.push([a, along[1]]);
    for (const [s0, s1b] of segs) {
      if (side === 'w') B.span(K.granite, ix0, 0, s0, ix0 + 0.5, ih, s1b, true);
      else if (side === 'n') B.span(K.granite, s0, 0, iz0, s1b, ih, iz0 + 0.5, true);
      else B.span(K.granite, s0, 0, iz1 - 0.5, s1b, ih, iz1, true);
    }
    for (const [g0, g1] of cuts) {
      if (side === 'w') B.span(K.granite, ix0, ih - 0.9, g0, ix0 + 0.5, ih, g1);
      else if (side === 'n') B.span(K.granite, g0, ih - 0.9, iz0, g1, ih, iz0 + 0.5);
      else B.span(K.granite, g0, ih - 0.9, iz1 - 0.5, g1, ih, iz1);
    }
  };
  wallRun('n'); wallRun('s'); wallRun('w');
  const cpg = pillarGeos(ih - cf - 0.35, 0.62);
  // floors, pillars, roofs and parapets
  const yali = yaliPierGeo(32);
  const figPanel = figureGeo(0.85, true);
  const cl = (x0: number, x1: number, z0: number, z1: number, line: 'x' | 'z', at: number, toCourt: number) => {
    B.span(K.granite, x0, 0, z0, x1, cf - 0.01, z1);
    B.span(K.darkFlags, x0, cf - 0.01, z0, x1, cf, z1);
    P.floor(root, x0, x1, z0, z1, cf);
    const n = Math.round(((line === 'x' ? x1 - x0 : z1 - z0)) / 2.4);
    for (let i = 0; i <= n; i++) {
      const t = (line === 'x' ? x0 : z0) + (i * (line === 'x' ? x1 - x0 : z1 - z0)) / n;
      const x = line === 'x' ? t : at, z = line === 'x' ? at : t;
      // keep the passages through the cloister clear
      if (line === 'z' && Math.abs(z) < 2.6) continue;
      if (line === 'x' && x > 9.4 && x < 14.6) continue;
      B.place(K.pillarStone, cpg.plain, x, cf, z);
      B.place(K.graniteCarved, cpg.carved, x, cf, z);
      // the rearing yali carved against the court face of each pillar
      const ry = line === 'x' ? (toCourt > 0 ? 0 : Math.PI) : Math.PI / 2;
      B.place(K.yaliStone, yali, x + (line === 'z' ? 0.32 : 0), cf, z + (line === 'x' ? toCourt * 0.32 : 0), ry, 1.6);
      // carved figure panels stacked on the pier's flanks (composite pier)
      for (const e of [-1, 1]) for (const yy of [0.9, 2.1]) {
        const fx = line === 'x' ? x + e * 0.36 : x, fz = line === 'x' ? z : z + e * 0.36;
        B.place(K.yaliStone, figPanel, fx, cf + yy, fz, line === 'x' ? e * Math.PI / 2 : (e > 0 ? 0 : Math.PI));
      }
      P.solid(x - 0.3, cf, z - 0.3, x + 0.3, ih, z + 0.3);
    }
    // the walkway behind: a second (inner) row of plain pillars and the back wall in deep shade
    const mid = line === 'x' ? at - toCourt * 1.55 : at - toCourt * 1.55;
    const n2 = Math.round(((line === 'x' ? x1 - x0 : z1 - z0)) / 4.8);
    for (let i = 0; i <= n2; i++) {
      const t = (line === 'x' ? x0 : z0) + (i * (line === 'x' ? x1 - x0 : z1 - z0)) / n2;
      const x = line === 'x' ? t : mid, z = line === 'x' ? mid : t;
      if (line === 'z' && Math.abs(z) < 2.6) continue;
      if (line === 'x' && x > 9.4 && x < 14.6) continue;
      B.box(K.granite, 0.5, ih - cf - 0.35, 0.5, x, cf, z); // plain square piers in the shade
      P.solid(x - 0.3, cf, z - 0.3, x + 0.3, ih, z + 0.3);
    }
    if (line === 'x') B.span(K.graniteDark, x0, cf, toCourt > 0 ? z0 + 0.5 : z1 - 0.52, x1, ih - 0.35, toCourt > 0 ? z0 + 0.52 : z1 - 0.5);
    else B.span(K.graniteDark, x0 + 0.5, cf, z0, x0 + 0.52, ih - 0.35, z1);
    B.span(K.granite, x0, ih - 0.35, z0, x1, ih + 0.3, z1);
    // a sloping stone eave (kapota) projecting ~1.1 m over the court
    const L = line === 'x' ? x1 - x0 : z1 - z0, slope = 0.32;
    const g = new THREE.BoxGeometry(line === 'x' ? L : 1.25, 0.16, line === 'x' ? 1.25 : L);
    const q = new THREE.Quaternion().setFromAxisAngle(line === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), (line === 'x' ? toCourt : -toCourt) * slope);
    const ex = line === 'x' ? (x0 + x1) / 2 : at + toCourt * 0.75, ez = line === 'x' ? at + toCourt * 0.75 : (z0 + z1) / 2;
    B.add(K.granite, g, new THREE.Matrix4().compose(new THREE.Vector3(ex, ih + 0.08, ez), q, new THREE.Vector3(1, 1, 1)));
  };
  cl(ix0, ix1, iz0, iz0 + dep, 'x', iz0 + dep - 0.35, 1);
  cl(ix0, ix1, iz1 - dep, iz1, 'x', iz1 - dep + 0.35, -1);
  cl(ix0, ix0 + dep, iz0 + dep, iz1 - dep, 'z', ix0 + dep - 0.35, 1);
  // painted parapets on the cloister roofs (outer edge) and a front fascia
  B.span(K.paintedCloister, ix0, ih + 0.3, iz0, ix1, ih + 1.2, iz0 + 0.3);
  B.span(K.paintedCloister, ix0, ih + 0.3, iz1 - 0.3, ix1, ih + 1.2, iz1);
  B.span(K.paintedCloister, ix0, ih + 0.3, iz0, ix0 + 0.3, ih + 1.2, iz1);
  // white coping on the outer parapets
  B.span(K.stuccoWhite, ix0, ih + 1.2, iz0, ix1, ih + 1.28, iz0 + 0.35);
  B.span(K.stuccoWhite, ix0, ih + 1.2, iz1 - 0.35, ix1, ih + 1.28, iz1);
  B.span(K.stuccoWhite, ix0, ih + 1.2, iz0, ix0 + 0.35, ih + 1.28, iz1);
  // the court-facing parapet: a row of stucco kuta-niches, each a recessed shrine with pilasters and a
  //  small barrel (shala) roof holding a 3-D sculpted deity ≈0.7 m tall, painted in muted colours
  const deity = figureGeo(0.72, true);
  const kutaRoof = barrelGeo(0.9, 0.24, 0.26);
  const niches = (ax: number, az: number, bx: number, bz: number, out: [number, number]) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 1.25);
    B.span(K.stuccoWhite, Math.min(ax, bx) - 0.15, ih + 0.3, Math.min(az, bz) - 0.15, Math.max(ax, bx) + 0.15, ih + 0.45, Math.max(az, bz) + 0.15);
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const ry = Math.atan2(out[0], out[1]);
    const at = (along: number, o: number): [number, number] => alongX ? [along, o] : [o, along];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const u = alongX ? x : z, o0 = alongX ? z : x, ox = alongX ? out[1] : out[0];
      const P3 = (du: number, dout: number) => { const [px, pz] = at(u + du, o0 + ox * dout); return [px, pz] as const; };
      // back wall of the recess, painted
      const [bx0, bz0] = P3(0, -0.12);
      B.box(K.nichePaint[i % 4], alongX ? 0.86 : 0.08, 0.95, alongX ? 0.08 : 0.86, bx0, ih + 0.45, bz0);
      // the two pilasters and the lintel framing the recess (white stucco, 0.42 deep)
      for (const e of [-1, 1]) {
        const [px, pz] = P3(e * 0.5, 0.06);
        B.box(K.stuccoWhite, alongX ? 0.16 : 0.42, 0.98, alongX ? 0.42 : 0.16, px, ih + 0.45, pz);
      }
      const [lx, lz] = P3(0, 0.06);
      B.box(K.stuccoWhite, alongX ? 1.18 : 0.46, 0.14, alongX ? 0.46 : 1.18, lx, ih + 1.43, lz);
      // the kuta / shala roof over it, with a gilt finial
      B.place(K.stuccoCream, kutaRoof, lx, ih + 1.57, lz, alongX ? 0 : Math.PI / 2);
      B.place(K.gilt, kalashaGeo(0.2, 8), lx, ih + 1.86, lz);
      // the deity, standing in the recess, in the round
      const [fx, fz] = P3(0, 0.02);
      B.place(K.figPaint[i % 4], deity, fx, ih + 0.5, fz, ry, [1, 1, 1.5]);
      // a muted torana arch inside the frame
      B.place(K.nichePaint[(i + 2) % 4], kuduGeo(0.36, 0.06, 0.08), lx, ih + 1.08, lz, ry);
    }
  };
  niches(ix0 + dep, iz0 + dep - 0.15, ix1, iz0 + dep - 0.15, [0, 1]);
  niches(ix0 + dep, iz1 - dep + 0.15, ix1, iz1 - dep + 0.15, [0, -1]);
  niches(ix0 + dep - 0.15, iz0 + dep, ix0 + dep - 0.15, iz1 - dep, [1, 0]);
  // the inner court is paved in dark grey-black worn granite flags
  B.span(K.courtFlags, ix0 + dep, 0, iz0 + dep, ix1, 0.006, iz1 - dep);
  // rows of small lingams on pithas along the cloister walls (the many sub-shrines of the court)
  for (let x = ix0 + 4; x < ix1 - 2; x += 4.5) {
    if (x > 9 && x < 15) continue;
    for (const s of [-1, 1]) O.shrine(x, cf, s * (iz1 - 0.95), 0.09, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  for (let z = iz0 + dep + 3; z < iz1 - dep - 2; z += 4.5) if (Math.abs(z) > 2.8) O.shrine(ix0 + 0.95, cf, z, 0.09, 0);
  // inner court paving
  return { lights, vimanaTop };
}

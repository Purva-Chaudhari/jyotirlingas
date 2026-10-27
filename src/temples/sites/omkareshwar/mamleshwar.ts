import * as THREE from 'three';
import type { Batch } from './batch';
import type { OM } from './mats';
import { rekhaGeometry, phamsanaGeometry } from './util';

/**
 * Shri Mamleshwar (Amaleshwar) on the south bank, as the tour videos show it (3jCMV-1YFjQ, oWdeNHYmkIo,
 * 1Zs27vszvLY, bhV4szyF1ro) and as ASI describes it: an 11th-century Paramara temple of grey-buff sandstone in a
 * walled court of about seven temples, on a terrace just above the ghats.
 *  - main temple: porch (two pot-and-foliage columns, red drapes, a marigold toran), a flat-roofed mandapa with a
 *    deep chhajja and a parapet of little kapota blocks, an antarala, and the sanctum under a banded Nagara
 *    shikhara (about ten tiers, corner half-spires, a sukanasa niche on the front, ribbed amalaka, brass kalash,
 *    a white flag) ~17 m high;
 *  - beside it to the west, a broader and redder temple whose tiered spire is cut off flat and crowned by a kiosk;
 *  - a mid-size Nagara shrine, little phamsana shrines, a domed open pavilion; pink queue rails under turquoise
 *    shade nets in the court.
 * Seen from the island (the Jhoola pul, the ghat): built for its massing and colour, not to walk in.
 * The temple faces north, across the river to the island. (x, y, z) = the court's centre at its floor level.
 */
export function buildMamleshwar(B: Batch, K: OM, x: number, y: number, z: number) {
  const S = K.mamStone, R = K.mamRed;

  // ---------- the court: a paved terrace, a low compound wall (open towards the river) ----------
  B.span(K.ghat, x - 24, x + 24, y - 7, y, z - 18, z + 18);
  for (const [a, b, c, d] of [[x - 24, x - 23.4, z - 18, z + 18], [x + 23.4, x + 24, z - 18, z + 18], [x - 24, x + 24, z + 17.4, z + 18],
    [x - 24, x - 4, z - 18, z - 17.4], [x + 4, x + 24, z - 18, z - 17.4]] as const) B.span(K.oldPlain, a, b, y, y + 1.7, c, d);

  // a moulded base (pitha): five stacked bands, ~1.2 m
  const pitha = (cx: number, cz: number, hw: number, hd: number, m: THREE.Material) => {
    const bands: [number, number, number][] = [[0, 0.25, 0.3], [0.25, 0.5, 0.15], [0.5, 0.78, 0.25], [0.78, 0.98, 0.1], [0.98, 1.2, 0.3]];
    for (const [a, b, o] of bands) B.span(m, cx - hw - o, cx + hw + o, y + a, y + b, cz - hd - o, cz + hd + o);
  };
  // a wall (jangha) with a projecting central offset (bhadra) and a dark niche on it, on three faces
  const jangha = (cx: number, cz: number, hw: number, y0: number, y1: number, m: THREE.Material, front = true) => {
    B.span(m, cx - hw, cx + hw, y0, y1, cz - hw, cz + hw);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!front && dz < 0) continue;
      const bx = cx + dx * (hw + 0.12), bz = cz + dz * (hw + 0.12);
      B.span(m, bx - (dz ? hw * 0.35 : 0.12), bx + (dz ? hw * 0.35 : 0.12), y0, y1, bz - (dx ? hw * 0.35 : 0.12), bz + (dx ? hw * 0.35 : 0.12));
      const nx = cx + dx * (hw + 0.25), nz = cz + dz * (hw + 0.25);
      B.span(K.dark, nx - (dz ? 0.32 : 0.02), nx + (dz ? 0.32 : 0.02), y0 + 1.2, y0 + 2.2, nz - (dx ? 0.32 : 0.02), nz + (dx ? 0.32 : 0.02));
    }
    B.span(m, cx - hw - 0.35, cx + hw + 0.35, y1, y1 + 0.35, cz - hw - 0.35, cz + hw + 0.35); // the cornice
  };
  // a banded Nagara spire: the rekha body plus a strong bhumi-amalaka band at every storey
  const spire = (cx: number, by: number, cz: number, hw: number, h: number, tiers: number, m: THREE.Material) => {
    const sp = rekhaGeometry(hw, h, tiers);
    sp.translate(cx, by, cz);
    B.add(m, sp);
    for (let i = 1; i < tiers; i++) {
      const t = i / tiers, w = hw * (1 - 0.62 * Math.pow(t, 1.8)) * 1.09;
      B.span(m, cx - w, cx + w, by + t * h * 0.86 - 0.12, by + t * h * 0.86, cz - w, cz + w);
    }
  };

  // ---------- the main temple ----------
  const gz = z + 3; // sanctum centre
  pitha(x, gz, 3.0, 3.0, S);
  jangha(x, gz, 3.0, y + 1.2, y + 5.6, S);
  spire(x, y + 5.95, gz, 3.0, 11.2, 10, S);
  // corner half-spires (urushringas) at the spire's foot
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const u = rekhaGeometry(0.85, 3.6, 5);
    u.translate(x + sx * 2.3, y + 5.95, gz + sz * 2.3);
    B.add(S, u);
  }
  // the sukanasa: a gabled niche projecting from the spire's front a third of the way up
  B.span(S, x - 1.2, x + 1.2, y + 5.95, y + 9.6, gz - 3.6, gz - 2.0);
  for (const p of phamsanaGeometry(4)) { p.scale(1.3, 1.6, 0.9); p.translate(x, y + 9.6, gz - 2.9); B.add(S, p); }
  B.span(K.dark, x - 0.35, x + 0.35, y + 7.6, y + 8.8, gz - 3.62, gz - 3.55);
  // ribbed amalaka's brass kalash and a white flag (the spire's own amalaka is in rekhaGeometry)
  const top = y + 5.95 + 11.2;
  B.lathe(K.brass, [[0, 0], [0.25, 0], [0.32, 0.18], [0.22, 0.36], [0.12, 0.42], [0.16, 0.5], [0.05, 0.62], [0, 0.66]], x, top, gz, 16);
  B.span(K.steel, x - 0.03, x + 0.03, top + 0.6, top + 3.6, gz - 0.03, gz + 0.03);
  {
    const f = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(1.4, -0.3, 0.15)]);
    f.translate(x, top + 3.5, gz);
    f.computeVertexNormals();
    B.add(K.clothWhite, f);
  }
  // antarala
  pitha(x, gz - 4.3, 1.4, 1.3, S);
  B.span(S, x - 1.4, x + 1.4, y + 1.2, y + 5.6, gz - 5.6, gz - 3.0);
  // the mandapa: closed walls with jali windows, a flat roof with a deep chhajja and a kapota parapet
  const mz = gz - 9.6;
  pitha(x, mz, 4.0, 4.0, S);
  B.span(S, x - 4, x + 4, y + 1.2, y + 5.0, mz - 4, mz + 4);
  for (const sx of [-1, 1]) for (const zz of [mz - 1.6, mz + 1.6]) B.span(K.dark, x + sx * 4.02 - 0.03, x + sx * 4.02 + 0.03, y + 2.2, y + 3.8, zz - 0.6, zz + 0.6);
  B.span(S, x - 4.9, x + 4.9, y + 5.0, y + 5.25, mz - 4.9, mz + 4.9); // the chhajja
  B.span(S, x - 4.3, x + 4.3, y + 5.25, y + 5.5, mz - 4.3, mz + 4.3);
  for (let k = -4; k <= 4; k += 0.8) {
    for (const [px, pz] of [[x + k, mz - 4.15], [x + k, mz + 4.15], [x - 4.15, mz + k], [x + 4.15, mz + k]]) B.span(S, px - 0.22, px + 0.22, y + 5.5, y + 5.85, pz - 0.22, pz + 0.22);
  }
  // the porch: two columns (square base, octagonal shaft, pot-and-foliage capital, bracket), a roof and chhajja
  const pz = mz - 4 - 1.5;
  B.span(S, x - 2.6, x + 2.6, y, y + 1.2, pz - 1.6, pz + 1.5);
  for (let i = 0; i < 4; i++) B.span(S, x - 1.4, x + 1.4, y + 0.3 * i, y + 0.3 * (i + 1), pz - 1.6 - (4 - i) * 0.32, pz - 1.6 - (3 - i) * 0.32); // steps down to the court
  for (const sx of [-1, 1]) {
    const cx = x + sx * 1.9, cz = pz - 1.2;
    B.span(S, cx - 0.24, cx + 0.24, y + 1.2, y + 1.9, cz - 0.24, cz + 0.24);
    B.add(S, new THREE.CylinderGeometry(0.17, 0.19, 1.2, 8).translate(cx, y + 2.5, cz));
    B.lathe(S, [[0, 0], [0.2, 0], [0.32, 0.12], [0.34, 0.22], [0.26, 0.34], [0.3, 0.4], [0, 0.4]], cx, y + 3.1, cz, 12);
    B.span(S, cx - 0.42, cx + 0.42, y + 3.5, y + 3.8, cz - 0.42, cz + 0.42);
    // red drapes on the columns, and a marigold toran across the front
    B.add(K.redCloth, new THREE.CylinderGeometry(0.23, 0.3, 1.1, 10, 1, true).translate(cx, y + 2.85, cz));
  }
  B.span(S, x - 2.7, x + 2.7, y + 3.8, y + 4.3, pz - 1.6, pz + 1.5);
  B.span(S, x - 3.2, x + 3.2, y + 4.3, y + 4.5, pz - 2.1, pz + 1.5);
  // the inscribed slab in the beam over the porch
  B.span(K.oldPlain, x - 1.0, x + 1.0, y + 3.85, y + 4.2, pz - 1.63, pz - 1.6);
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(x - 1.9 + 3.8 * t, y + 3.7 - Math.sin(t * Math.PI) * 0.5, pz - 1.5)); }
    B.add(K.marigold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 6));
  }

  // ---------- the broad red temple to the west, its spire cut off flat under a little kiosk ----------
  {
    const cx = x - 14.5, cz = z + 3;
    pitha(cx, cz, 5.4, 5.4, R);
    jangha(cx, cz, 5.4, y + 1.2, y + 6.4, R);
    let w = 5.6, yy = y + 6.75;
    for (let i = 0; i < 9; i++) {
      const hgt = 1.3;
      B.span(R, cx - w, cx + w, yy, yy + hgt - 0.2, cz - w, cz + w);
      B.span(R, cx - w - 0.25, cx + w + 0.25, yy + hgt - 0.2, yy + hgt, cz - w - 0.25, cz + w + 0.25);
      // stacked half-spires on each face
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const u = rekhaGeometry(0.7, 1.25, 3);
        u.translate(cx + dx * (w - 0.3), yy, cz + dz * (w - 0.3));
        B.add(R, u);
      }
      yy += hgt;
      w -= 0.28 + i * 0.035;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.span(R, cx + sx * 1.1 - 0.12, cx + sx * 1.1 + 0.12, yy, yy + 1.7, cz + sz * 1.1 - 0.12, cz + sz * 1.1 + 0.12);
    B.span(R, cx - 1.5, cx + 1.5, yy + 1.7, yy + 1.95, cz - 1.5, cz + 1.5);
    B.lathe(R, [[0, 0], [1.25, 0], [1.1, 0.5], [0.6, 0.95], [0.12, 1.15], [0.05, 1.5], [0, 1.55]], cx, yy + 1.95, cz, 16);
    // a barred window in its flank
    B.span(K.dark, cx + 5.55, cx + 5.6, y + 2.6, y + 4.4, cz - 0.6, cz + 0.6);
  }

  // ---------- a mid-size Nagara shrine, little phamsana shrines, a domed pavilion ----------
  {
    const cx = x + 13, cz = z + 5;
    pitha(cx, cz, 2.0, 2.0, S);
    jangha(cx, cz, 2.0, y + 1.2, y + 4.0, S);
    spire(cx, y + 4.35, cz, 2.1, 6.2, 7, S);
  }
  for (const [cx, cz] of [[x - 6, z + 13], [x + 6, z + 13], [x + 18, z - 7], [x - 21, z - 9]] as const) {
    B.span(S, cx - 1.4, cx + 1.4, y, y + 0.5, cz - 1.4, cz + 1.4);
    B.span(S, cx - 1.15, cx + 1.15, y + 0.5, y + 2.7, cz - 1.15, cz + 1.15);
    B.span(K.dark, cx - 0.35, cx + 0.35, y + 0.6, y + 2.0, cz - 1.17, cz - 1.13);
    for (const p of phamsanaGeometry(5)) { p.scale(1.35, 1.6, 1.35); p.translate(cx, y + 2.7, cz); B.add(S, p); }
  }
  {
    const cx = x + 8, cz = z - 12;
    B.span(S, cx - 2, cx + 2, y, y + 0.6, cz - 2, cz + 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.span(S, cx + sx * 1.6 - 0.18, cx + sx * 1.6 + 0.18, y + 0.6, y + 3.2, cz + sz * 1.6 - 0.18, cz + sz * 1.6 + 0.18);
    B.span(S, cx - 2.2, cx + 2.2, y + 3.2, y + 3.55, cz - 2.2, cz + 2.2);
    B.lathe(S, [[0, 0], [1.7, 0], [1.6, 0.6], [1.15, 1.2], [0.4, 1.55], [0.1, 1.9], [0, 2.0]], cx, y + 3.55, cz, 16);
  }

  // ---------- pink queue rails under turquoise shade nets, in front of the porch ----------
  for (let i = 0; i < 4; i++) {
    const rz = z - 13 - i * 1.4;
    B.span(K.mamRail, x - 9, x + 2, y + 1.0, y + 1.06, rz - 0.03, rz + 0.03);
    for (let rx = x - 9; rx <= x + 2; rx += 1.6) B.span(K.mamRail, rx - 0.03, rx + 0.03, y, y + 1.0, rz - 0.03, rz + 0.03);
  }
  for (let rx = x - 9; rx <= x + 2; rx += 3.5) for (const rz of [z - 12.4, z - 17.4]) B.span(K.steel, rx - 0.04, rx + 0.04, y, y + 3.2, rz - 0.04, rz + 0.04);
  B.span(K.shadeNet, x - 9.3, x + 2.3, y + 3.2, y + 3.24, z - 17.6, z - 12.2);
}

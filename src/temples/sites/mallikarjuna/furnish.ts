import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import type { Merger } from './merge';
import type { SM } from './mats';
import { frustum, kalashaGeo, domeGeo } from './geo';
import { pillarGeos } from './temple';
import type { Offerings } from './offerings';

/**
 * The working life of the outer court, as the satellite view and pilgrims' photos show it: long
 * covered walkways (red and blue sheet roofs on steel posts) that carry the queues round the
 * shrines, open stone mandapas (pillared pavilions) for rest and rituals, the Devasthanam's two-storey
 * office and store blocks along the south, lawns with clipped hedges, a few more shrines and trees.
 */
export const MORE_TREES: [number, number, number][] = [
  [-52, -64, 12], [16, 50, 11],
];

export function buildFurnish(B: Merger, K: SM, P: Physics, root: THREE.Object3D, O: Offerings) {
  // ---- covered walkways: posts + a thin sheet roof with a slight fall
  const walkway = (x0: number, x1: number, z0: number, z1: number, h: number, roof: THREE.Material) => {
    const alongX = x1 - x0 > z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / 4));
    for (let i = 0; i <= n; i++) {
      const t = (alongX ? x0 : z0) + (i * len) / n;
      for (const e of alongX ? [z0, z1] : [x0, x1]) {
        const x = alongX ? t : e, z = alongX ? e : t;
        B.box(K.steel, 0.12, h, 0.12, x, 0, z);
        P.solid(x - 0.1, 0, z - 0.1, x + 0.1, h, z + 0.1);
      }
    }
    B.span(K.steel, x0 - 0.1, h - 0.15, z0 - 0.1, x1 + 0.1, h, z1 + 0.1);
    B.span(roof, x0 - 0.5, h, z0 - 0.5, x1 + 0.5, h + 0.08, z1 + 0.5);
  };
  walkway(-50, 56, 25, 29, 3.6, K.redRoof); // south of the inner court
  walkway(-50, -46, -22, 25, 3.6, K.redRoof); // down the west side to the terrace steps
  walkway(48, 62, -16, -12, 3.4, K.blueRoof); // the exit line by the east gate
  walkway(-50, 20, -34, -30, 3.6, K.blueRoof); // north of the inner court

  // ---- open stone mandapas
  const pavilion = (cx: number, cz: number, w: number, d: number, nx: number, nz: number) => {
    const ph = 0.6, ch = 3.2;
    B.box(K.granite, w + 0.6, ph * 0.5, d + 0.6, cx, 0, cz);
    B.box(K.granite, w + 0.3, ph * 0.5, d + 0.3, cx, ph * 0.5, cz);
    B.span(K.stoneFloor, cx - w / 2, ph - 0.02, cz - d / 2, cx + w / 2, ph + 0.006, cz + d / 2);
    P.floor(root, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, ph);
    const pg = pillarGeos(ch, 0.7);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = cx - w / 2 + 0.4 + (i * (w - 0.8)) / (nx - 1), z = cz - d / 2 + 0.4 + (j * (d - 0.8)) / (nz - 1);
      if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
      B.place(K.pillarStone, pg.plain, x, ph, z);
      B.place(K.graniteCarved, pg.carved, x, ph, z);
      P.solid(x - 0.25, 0, z - 0.25, x + 0.25, ph + ch, z + 0.25);
    }
    B.box(K.granite, w + 0.2, 0.35, d + 0.2, cx, ph + ch, cz);
    B.place(K.granite, frustum(w + 0.2, d + 0.2, w + 0.9, d + 0.9, 0.25), cx, ph + ch + 0.35, cz);
    B.box(K.stuccoCream, w + 0.3, 0.5, d + 0.3, cx, ph + ch + 0.6, cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.place(K.stuccoCream, domeGeo(0.3, 1.1, 4, 1.05, Math.PI / 4), cx + sx * (w / 2), ph + ch + 1.1, cz + sz * (d / 2));
      B.place(K.gilt, kalashaGeo(0.28, 8), cx + sx * (w / 2), ph + ch + 1.42, cz + sz * (d / 2));
    }
    // most pavilions shelter a small lingam or a lamp stand
    O.shrine(cx, ph, cz, 0.08, 0);
    P.solid(cx - 0.35, ph, cz - 0.35, cx + 0.35, ph + 0.6, cz + 0.35);
  };
  pavilion(-38, -16, 6, 6, 3, 3);
  pavilion(30, -64, 7, 5, 4, 3);
  pavilion(-14, 54, 6, 6, 3, 3);
  pavilion(40, 72, 8, 5, 4, 3);
  pavilion(-66, -88, 6, 6, 3, 3);
  pavilion(0, -88, 7, 5, 4, 3);

  // ---- Devasthanam blocks (offices, stores, prasadam counters): two storeys, verandas, flat roofs
  const block = (x0: number, x1: number, z0: number, z1: number, storeys: number, faceZ: number) => {
    const h = storeys * 3.4;
    B.span(K.stuccoCream, x0, 0, z0, x1, h, z1, true);
    B.span(K.stuccoCream, x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.9, z1 + 0.2);
    const zf = faceZ > 0 ? z1 : z0;
    for (let s = 0; s < storeys; s++) for (let x = x0 + 1.2; x < x1 - 0.8; x += 2.6) {
      B.span(K.dark, x, s * 3.4 + (s === 0 ? 0.05 : 1.0), zf - 0.03 * faceZ, x + 1.2, s * 3.4 + 2.4, zf + 0.03 * faceZ);
    }
    // veranda: pillars and a slab
    const vz = zf + faceZ * 2.2;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 3))) {
      B.box(K.stuccoCream, 0.3, 3.2, 0.3, x, 0, vz);
      P.solid(x - 0.2, 0, vz - 0.2, x + 0.2, 3.2, vz + 0.2);
    }
    B.span(K.stuccoCream, x0 - 0.2, 3.2, Math.min(zf, vz) - 0.2, x1 + 0.2, 3.45, Math.max(zf, vz) + 0.2);
    B.span(K.redRoof, x0 - 0.2, 3.45, Math.min(zf, vz) - 0.2, x1 + 0.2, 3.5, Math.max(zf, vz) + 0.2);
  };
  block(-84, -58, 66, 80, 2, -1);
  block(4, 34, 74, 82, 2, -1);
  block(-36, -6, -108, -98, 2, 1);
  block(36, 60, -108, -96, 1, 1);

  // ---- lawns with clipped hedges in the south court
  const lawn = (x0: number, x1: number, z0: number, z1: number) => {
    B.span(K.lawn, x0, -0.02, z0, x1, 0.03, z1);
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.5], [x0, x1, z1 - 0.5, z1], [x0, x0 + 0.5, z0, z1], [x1 - 0.5, x1, z0, z1]] as const) {
      B.span(K.granite, a - 0.08, 0, c - 0.08, b + 0.08, 0.18, d + 0.08); // stone kerb
      B.span(K.hedge, a + 0.05, 0.18, c + 0.05, b - 0.05, 0.7, d - 0.05);
      P.solid(a, 0, c, b, 0.7, d);
    }
  };
  lawn(-34, -4, 38, 50);
  lawn(6, 30, 38, 50);
  lawn(-34, -4, 60, 72);
}

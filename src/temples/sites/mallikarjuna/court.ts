import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { lathe, type Merger } from './merge';
import type { SM } from './mats';
import { WALL, INNER } from './layout';
import { frustum, kalashaGeo, domeGeo } from './geo';
import type { Offerings } from './offerings';

/**
 * The outer court inside the prakara: blue-grey stone paving, the sub-shrines of the complex — the
 * five Pandava lingas in their small stone shrines, Vriddha Mallikarjuna, the Sahasra-linga shrine —
 * the Mallika Gundam (the little sacred tank), a modern green-roofed shelter, lamp posts, queue
 * railings, and the court's big trees (listed in TREES for the shared tree model).
 */
/** the Mallika Gundam tank */
export const GUNDAM = { x: -40, z: 44, w: 7.5 };

export const TREES: [number, number, number][] = [
  [22, -36, 13], [-44, -84, 13], [-30, 58, 12], [52, 44, 11], [-72, 54, 12], [26, 64, 12], [104, -36, 11],
];

/** A small Kadamba-Nagara stone shrine (cella with a stepped pyramidal roof) facing east, with a lingam inside. */
function stoneShrine(B: Merger, K: SM, P: Physics, O: Offerings, x: number, z: number, w: number, face = 0) {
  const h = w * 1.05;
  B.box(K.granite, w + 0.5, 0.35, w + 0.5, x, 0, z);
  B.box(K.granite, w, h, w, x, 0.35, z, true);
  // doorway on the facing side (dark), with a lingam visible in front of it
  const dx = Math.cos(face), dz = -Math.sin(face);
  B.box(K.dark, Math.abs(dx) > 0.5 ? 0.04 : 0.8, 1.5, Math.abs(dx) > 0.5 ? 0.8 : 0.04, x + dx * (w / 2 + 0.01), 0.35, z + dz * (w / 2 + 0.01));
  let y = 0.35 + h;
  B.place(K.granite, frustum(w, w, w + 0.4, w + 0.4, 0.22), x, y, z); y += 0.22;
  for (let i = 0; i < 5; i++) {
    const s = w * (0.95 - i * 0.15);
    B.place(K.granite, frustum(s, s, s - 0.08, s - 0.08, 0.3), x, y, z);
    B.place(K.granite, frustum(s - 0.08, s - 0.08, s + 0.06, s + 0.06, 0.1), x, y + 0.3, z);
    y += 0.4;
  }
  B.place(K.granite, domeGeo(w * 0.22, 0.8, 16, 1.0), x, y, z);
  B.place(K.gilt, kalashaGeo(0.45, 10), x, y + w * 0.17, z);
  O.shrine(x + dx * (w / 2 + 0.55), 0, z + dz * (w / 2 + 0.55), 0.08, face);
  P.solid(x + dx * (w / 2 + 0.55) - 0.3, 0, z + dz * (w / 2 + 0.55) - 0.3, x + dx * (w / 2 + 0.55) + 0.3, 0.5, z + dz * (w / 2 + 0.55) + 0.3);
}

export function buildCourt(B: Merger, K: SM, P: Physics, root: THREE.Group, flames: Flames, O: Offerings, BT: Merger = B) {
  const { x0, x1, z0, z1, T } = WALL;
  // paving of the whole court (the inner court is paved alike)
  const px0 = x0 + T / 2, px1 = x1 - T / 2, pz0 = z0 + T / 2, pz1 = z1 - T / 2;
  const hx0 = GUNDAM.x - GUNDAM.w / 2, hx1 = GUNDAM.x + GUNDAM.w / 2, hz0 = GUNDAM.z - GUNDAM.w / 2, hz1 = GUNDAM.z + GUNDAM.w / 2;
  BT.span(K.paving, px0, -0.1, pz0, px1, 0, hz0);
  BT.span(K.paving, px0, -0.1, hz1, px1, 0, pz1);
  BT.span(K.paving, px0, -0.1, hz0, hx0, 0, hz1);
  BT.span(K.paving, hx1, -0.1, hz0, px1, 0, hz1);
  // one walkable ground plane for the court and everything just outside it
  P.floor(root, -97, 232, -142, 114, 0);

  // the five Pandava lingas, Vriddha Mallikarjuna, the Sahasra-linga shrine
  for (let i = 0; i < 5; i++) stoneShrine(B, K, P, O, -50 + i * 6.2, -44, 2.4);
  stoneShrine(B, K, P, O, -42, 6, 3.6);
  stoneShrine(B, K, P, O, -44, 62, 4.4);
  stoneShrine(B, K, P, O, 52, -60, 3.0, -Math.PI / 2);
  stoneShrine(B, K, P, O, 52, 60, 3.0, Math.PI / 2);

  // Mallika Gundam: a small stepped tank with water, railed
  const gx = GUNDAM.x, gz = GUNDAM.z, gw = GUNDAM.w, depth = 2.2;
  for (let i = 0; i < 6; i++) {
    const s = gw - i * 0.5, y = -i * 0.32;
    for (const [a, b, c, d] of [[-s / 2, s / 2, -s / 2, -s / 2 + 0.5], [-s / 2, s / 2, s / 2 - 0.5, s / 2], [-s / 2, -s / 2 + 0.5, -s / 2, s / 2], [s / 2 - 0.5, s / 2, -s / 2, s / 2]] as const) {
      B.span(K.granite, gx + a, y - 0.32, gz + c, gx + b, y, gz + d);
    }
  }
  B.span(K.granite, gx - gw / 2, -depth - 0.1, gz - gw / 2, gx + gw / 2, -depth, gz + gw / 2);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(gw - 2.4, gw - 2.4).rotateX(-Math.PI / 2), K.water);
  water.position.set(gx, -1.25, gz);
  root.add(water);
  for (const [a, b, c, d] of [[-1, 1, -1, -1], [-1, 1, 1, 1], [-1, -1, -1, 1], [1, 1, -1, 1]] as const) {
    const xa = gx + a * (gw / 2 + 0.2), xb = gx + b * (gw / 2 + 0.2), za = gz + c * (gw / 2 + 0.2), zb = gz + d * (gw / 2 + 0.2);
    B.span(K.steel, Math.min(xa, xb) - 0.03, 0.95, Math.min(za, zb) - 0.03, Math.max(xa, xb) + 0.03, 1.0, Math.max(za, zb) + 0.03);
    B.span(K.steel, Math.min(xa, xb) - 0.02, 0.5, Math.min(za, zb) - 0.02, Math.max(xa, xb) + 0.02, 0.54, Math.max(za, zb) + 0.02);
  }
  for (let t = -1; t <= 1; t += 0.25) for (const [px, pz] of [[t, -1], [t, 1], [-1, t], [1, t]]) {
    B.span(K.steel, gx + px * (gw / 2 + 0.2) - 0.03, 0, gz + pz * (gw / 2 + 0.2) - 0.03, gx + px * (gw / 2 + 0.2) + 0.03, 1.0, gz + pz * (gw / 2 + 0.2) + 0.03);
  }
  P.solid(gx - gw / 2 - 0.4, -3, gz - gw / 2 - 0.4, gx + gw / 2 + 0.4, 1.1, gz + gw / 2 + 0.4);

  // modern pilgrims' shelter (green roof) in the north-west of the court
  const sx0 = -68, sx1 = -40, sz0 = -60, sz1 = -36, sh = 6.0;
  for (let x = sx0; x <= sx1 + 0.01; x += 4) for (const z of [sz0, sz1]) {
    B.span(K.steel, x - 0.12, 0, z - 0.12, x + 0.12, sh, z + 0.12, true);
  }
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(sx1 - sx0 + 1.2, (sz1 - sz0) / 2 + 0.8);
    g.rotateX(-Math.PI / 2 + s * 0.22);
    B.place(K.greenRoof, g, (sx0 + sx1) / 2, sh + 1.1, (sz0 + sz1) / 2 + s * ((sz1 - sz0) / 4 + 0.2));
  }
  B.span(K.steel, sx0 - 0.6, sh, (sz0 + sz1) / 2 - 0.1, sx1 + 0.6, sh + 2.4, (sz0 + sz1) / 2 + 0.1);

  // queue railings from the east gopuram to the mandapa and along the court
  const rail = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za), ry = -Math.atan2(zb - za, xb - xa);
    for (const y of [0.98, 0.5]) B.box(K.steel, len, 0.05, 0.05, (xa + xb) / 2, y, (za + zb) / 2, false, ry);
    for (let t = 0; t <= 1.0001; t += 1 / Math.max(1, Math.round(len / 2))) {
      B.box(K.steel, 0.05, 1.0, 0.05, xa + (xb - xa) * t, 0, za + (zb - za) * t);
    }
    P.solid(Math.min(xa, xb) - 0.05, 0, Math.min(za, zb) - 0.05, Math.max(xa, xb) + 0.05, 1.05, Math.max(za, zb) + 0.05);
  };
  rail(46, 2.6, 56.2, 2.6); rail(46, -2.6, 56.2, -2.6);
  rail(46, 2.6, 46, 9); rail(46, -2.6, 46, -9);
  rail(47.5, 13.4, 56, 13.4); rail(47.5, 16, 62, 16);

  // lamp posts round the court
  const post = lathe([[0.16, 0], [0.12, 0.3], [0.07, 0.4], [0.06, 3.6], [0.1, 3.7], [0.06, 3.8]], 10);
  for (const [x, z] of [[54, -14], [54, 14], [-28, -14], [-28, 14], [0, -32], [0, 32], [-52, -20], [-52, 20], [30, -95], [30, 75], [-60, -95], [-60, 75]]) {
    B.place(K.bronze, post, x, 0, z);
    B.place(K.lampGlow, new THREE.SphereGeometry(0.22, 12, 8), x, 3.95, z);
    P.solid(x - 0.2, 0, z - 0.2, x + 0.2, 3.8, z + 0.2);
  }
  void flames;
  void INNER;
}

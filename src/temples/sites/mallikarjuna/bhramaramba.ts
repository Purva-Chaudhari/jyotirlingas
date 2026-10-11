import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { lathe, type Merger } from './merge';
import type { SM } from './mats';
import { TERRACE } from './layout';
import { frustum, kalashaGeo, domeGeo, kuduGeo } from './geo';
import { pillarGeos } from './temple';
import type { Offerings } from './offerings';

/**
 * Sri Bhramaramba Devi (one of the Shakti Peethas): her shrine stands on the raised terrace at the
 * west of the court, behind Mallikarjuna, reached by a broad flight of steps; the West gopuram rises
 * just behind it. Gold Dravida vimana (two storeys of gilded kutas and shalas, an octagonal griva and a
 * bulbous dome), a pillared mukha mandapa with a painted parapet, a gold dhwajastambha on the terrace,
 * and (as at the entrance of her sannidhi) a stone Sri Chakra meru. The Devi herself is not modelled:
 * her doorway shows the lamp-lit silver arch and a curtain, garlanded.
 */
export const BHRAM = { x: -82.5, half: 3.6, mx0: -78.9, mx1: -67.5, mz: 5.6, plinth: 0.6 };

export function buildBhramaramba(B: Merger, K: SM, P: Physics, root: THREE.Group, flames: Flames, O: Offerings) {
  const T = TERRACE.h;
  const lights: THREE.PointLight[] = [];

  // ---- the terrace: retaining walls, paving, railings, the great flight of steps
  const { x0, x1, z0, z1 } = TERRACE;
  B.span(K.granite, x1 - 0.6, 0, z0, x1, T, z1, true);
  B.span(K.granite, x0, 0, z0, x1, T, z0 + 0.6, true);
  B.span(K.granite, x0, 0, z1 - 0.6, x1, T, z1, true);
  B.span(K.paving, x0, T - 0.05, z0, x1, T + 0.005, z1);
  B.span(K.granite, x0, 0, z0 + 0.6, x1 - 0.6, T - 0.05, z1 - 0.6);
  P.floor(root, x0, x1, z0, z1, T);
  const stairW = 5.5, nStep = 8, rise = T / nStep, tread = 0.95;
  for (let i = 0; i < nStep; i++) {
    const xa = x1 + i * tread, xb = xa + tread;
    const top = T - (i + 1) * rise;
    if (top > 0.001) B.span(K.granite, xa, 0, -stairW, xb, top, stairW);
    P.floor(root, xa, xb, -stairW, stairW, top);
  }
  for (const s of [-1, 1]) {
    // stepped side walls of the flight and the terrace railing
    B.span(K.granite, x1, 0, s * stairW + (s > 0 ? 0 : -0.5), x1 + nStep * tread, 0.5, s * stairW + (s > 0 ? 0.5 : 0), true);
    for (const yy of [T + 0.5, T + 0.95]) B.span(K.steel, x1 - 0.08, yy, s > 0 ? stairW : z0 + 0.6, x1 - 0.02, yy + 0.05, s > 0 ? z1 - 0.6 : -stairW);
  }
  for (const z of [z0 + 0.3, z1 - 0.3]) P.solid(x0, T, z - 0.3, x1, T + 1.1, z + 0.3);
  P.solid(x1 - 0.3, T, z0, x1, T + 1.1, -stairW);
  P.solid(x1 - 0.3, T, stairW, x1, T + 1.1, z1);
  // railing posts + rails along the terrace edge
  for (const [za, zb] of [[z0 + 0.6, -stairW], [stairW, z1 - 0.6]] as const) {
    for (let z = za; z <= zb; z += 1.5) B.span(K.steel, x1 - 0.08, T, z - 0.03, x1 - 0.02, T + 1.0, z + 0.03);
  }

  // ---- sanctum
  const { x: sx, half: h, mx0, mx1, mz, plinth: pl } = BHRAM;
  const F = T + pl;
  for (const [hh, ext, y0] of [[0.25, 0.3, T], [0.2, 0.15, T + 0.25], [0.15, 0.05, T + 0.45]] as const) {
    B.span(K.granite, sx - h - ext, y0, -h - ext, mx1 + ext, y0 + hh, h + ext);
    B.span(K.granite, mx0 - ext, y0, -mz - ext, mx1 + ext, y0 + hh, mz + ext);
  }
  P.solid(sx - h - 0.3, T, -h - 0.3, mx1 + 0.3, F, h + 0.3);
  P.solid(mx0, T, -mz - 0.3, mx1 + 0.3, F, mz + 0.3);
  const wallTop = F + 5.2, inn = 1.4, dW = 1.0, dH = 2.1;
  B.span(K.granite, sx - h, F, -h, sx - inn, wallTop, h, true);
  B.span(K.granite, sx + inn, F, -h, sx + h, wallTop, -dW / 2, true);
  B.span(K.granite, sx + inn, F, dW / 2, sx + h, wallTop, h, true);
  B.span(K.granite, sx + inn, F + dH, -dW / 2, sx + h, wallTop, dW / 2);
  B.span(K.granite, sx - inn, F, -h, sx + inn, wallTop, -inn, true);
  B.span(K.granite, sx - inn, F, inn, sx + inn, wallTop, h, true);
  B.span(K.graniteDark, sx - inn, F + 3.4, -inn, sx + inn, wallTop, inn);
  B.span(K.polished, sx - inn, F - 0.03, -inn, sx + h, F + 0.008, inn);
  // inside: a silver arch (prabhavali) against the west wall, a red silk curtain drawn across, lamps
  B.span(K.graniteDark, sx - inn, F, -inn, sx - inn + 0.02, F + 3.4, inn);
  B.span(K.graniteDark, sx - inn, F, -inn, sx + inn, F + 3.4, -inn + 0.02);
  B.span(K.graniteDark, sx - inn, F, inn - 0.02, sx + inn, F + 3.4, inn);
  B.span(K.blackStone, sx - inn + 0.05, F, -0.6, sx - inn + 0.75, F + 0.55, 0.6);
  B.place(K.silver, kuduGeo(0.72, 0.12, 0.08), sx - inn + 0.12, F + 1.55, 0, Math.PI / 2);
  for (const s of [-1, 1]) B.span(K.silver, sx - inn + 0.06, F + 0.55, s * 0.84 - 0.06, sx - inn + 0.18, F + 1.55, s * 0.84 + 0.06);
  B.span(K.cloth, sx - 0.15, F + 0.05, -0.75, sx - 0.12, F + 2.05, 0.75);
  B.span(K.goldPlain, sx - 0.2, F + 2.05, -0.8, sx - 0.08, F + 2.12, 0.8);
  O.strand(new THREE.Vector3(sx - 0.08, F + 2.0, -0.7), new THREE.Vector3(sx - 0.08, F + 2.0, 0.7), 0.35, 1.0, false);
  O.heap(sx + 0.2, F, 0, 0.22, 0.06, 20);
  P.floor(root, sx - inn, sx + h + 0.01, -inn, inn, F);
  P.solid(sx - 0.3, F, -inn, sx - 0.05, F + 2.2, inn);
  // gold door frame
  for (const s of [-1, 1]) B.span(K.goldIn, sx + h - 0.02, F, s * (dW / 2), sx + h + 0.16, F + dH + 0.3, s * (dW / 2 + 0.38));
  B.span(K.goldIn, sx + h - 0.02, F + dH, -dW / 2 - 0.38, sx + h + 0.16, F + dH + 0.42, dW / 2 + 0.38);
  O.arch(sx + h + 0.25, F + dH + 0.5, 0, 0.85, 0.3);
  for (const z of [-0.9, 0.9]) {
    B.place(K.brass, lathe([[0, 0], [0.13, 0], [0.09, 0.05], [0.03, 0.1], [0.02, 0.75], [0.1, 0.78], [0.12, 0.82], [0.03, 0.83], [0, 0.9]], 14), sx + 0.6, F, z);
    for (let k = 0; k < 4; k++) flames.points.push(new THREE.Vector3(sx + 0.6 + Math.cos(k * 1.57) * 0.1, F + 0.84, z + Math.sin(k * 1.57) * 0.1));
  }
  const lamp = new THREE.PointLight(0xffa04a, 2.6, 4.5, 1.7);
  lamp.position.set(sx + 0.7, F + 1.3, 0);
  root.add(lamp); lights.push(lamp);
  // exterior pilasters and the cornice
  for (const s of [-1, 1]) for (const t of [-h + 0.3, 0, h - 0.3]) {
    B.box(K.graniteCarved, 0.5, wallTop - F - 0.5, 0.12, sx + t, F + 0.1, s * (h + 0.06));
    B.box(K.graniteCarved, 0.12, wallTop - F - 0.5, 0.5, sx - h - 0.06, F + 0.1, t);
  }
  B.place(K.granite, frustum(2 * h, 2 * h, 2 * h + 0.9, 2 * h + 0.9, 0.4), sx, wallTop - 0.4, 0);

  // ---- gold Dravida vimana
  let y = wallTop;
  const tala = (w: number, hh: number) => {
    B.box(K.gold, w, hh * 0.62, w, sx, y, 0);
    B.place(K.gold, frustum(w + 0.1, w + 0.1, w + 0.55, w + 0.55, hh * 0.15), sx, y + hh * 0.62, 0);
    const yp = y + hh * 0.77;
    for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      B.box(K.gold, 0.6, hh * 0.25, 0.6, sx + ax * (w / 2 - 0.1), yp, az * (w / 2 - 0.1));
      B.place(K.gold, domeGeo(0.36, 1.1, 4, 1.05, Math.PI / 4), sx + ax * (w / 2 - 0.1), yp + hh * 0.25, az * (w / 2 - 0.1));
    }
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const along = ax !== 0;
      B.box(K.gold, along ? 0.6 : w * 0.4, hh * 0.25, along ? w * 0.4 : 0.6, sx + ax * (w / 2 - 0.1), yp, az * (w / 2 - 0.1));
      B.place(K.gold, kuduGeo(0.32, 0.1, 0.15), sx + ax * (w / 2 + 0.15), yp + hh * 0.25, az * (w / 2 + 0.15), along ? Math.PI / 2 : 0);
    }
    B.box(K.gold, w - 0.9, hh * 0.3, w - 0.9, sx, yp, 0);
    y += hh;
  };
  tala(2 * h + 0.4, 2.2);
  tala(2 * h - 0.6, 1.9);
  tala(2 * h - 1.6, 1.6);
  // octagonal griva with four small Nandi-like gilt kudus, the bulbous dome, kalasha
  B.place(K.gold, lathe([[2.15, 0], [2.0, 0.1], [1.8, 0.18], [1.8, 1.0], [2.25, 1.15], [0, 1.15]], 8), sx, y, 0); y += 1.15;
  B.place(K.goldLattice, domeGeo(2.4, 1.12, 8, 1.1), sx, y, 0);
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    B.place(K.gold, kuduGeo(0.7, 0.16, 0.3), sx + ax * 2.37, y + 0.4, az * 2.37, ax !== 0 ? Math.PI / 2 : 0);
  }
  y += 2.62;
  B.place(K.gilt, kalashaGeo(1.9, 16), sx, y - 0.1, 0);
  const vimanaTop = y + 1.35;

  // ---- mukha mandapa
  const mh = F + 4.2;
  const mw = 0.5;
  B.span(K.granite, mx0, F, -mz, mx1, mh, -mz + mw, true);
  B.span(K.granite, mx0, F, mz - mw, mx1, mh, mz, true);
  B.span(K.granite, mx1 - mw, F, -mz, mx1, mh, -1.2, true);
  B.span(K.granite, mx1 - mw, F, 1.2, mx1, mh, mz, true);
  for (let x = mx0 + 0.7; x < mx1 - 0.2; x += 1.45) for (const s of [-1, 1]) B.box(K.graniteCarved, 0.4, mh - F - 0.4, 0.1, x, F + 0.1, s * (mz + 0.05));
  for (const z of [-4.6, -3.2, -1.9, 1.9, 3.2, 4.6]) B.box(K.graniteCarved, 0.1, mh - F - 0.4, 0.4, mx1 + 0.05, F + 0.1, z);
  B.span(K.granite, mx1 - mw, F + 3.0, -1.2, mx1, mh, 1.2);
  B.span(K.polished, mx0, F - 0.03, -mz + mw, mx1, F + 0.008, mz - mw);
  P.floor(root, mx0 - 0.01, mx1 + 0.01, -mz + mw, mz - mw, F);
  const pg = pillarGeos(3.6, 0.85);
  for (const x of [-76.0, -72.9, -69.8]) for (const z of [-2.3, 2.3]) {
    B.place(K.pillarStone, pg.plain, x, F, z);
    B.place(K.graniteCarved, pg.carved, x, F, z);
    P.solid(x - 0.3, F, z - 0.3, x + 0.3, F + 3.6, z + 0.3);
  }
  B.span(K.granite, mx0, F + 3.6, -mz, mx1, mh, mz);
  B.place(K.granite, frustum(mx1 - mx0, 2 * mz, mx1 - mx0 + 1.0, 2 * mz + 1.0, 0.35), (mx0 + mx1) / 2, mh - 0.35, 0);
  for (const [a, b, c, d] of [[mx0, mx1 + 0.5, -mz - 0.5, -mz - 0.2], [mx0, mx1 + 0.5, mz + 0.2, mz + 0.5], [mx1 + 0.2, mx1 + 0.5, -mz - 0.5, mz + 0.5]] as const) {
    B.span(K.paintedBhram, a, mh, c, b, mh + 0.9, d);
  }
  for (let i = 0; i < 2; i++) {
    B.span(K.granite, mx1, T, -1.8, mx1 + 0.8 - i * 0.4, T + 0.3 * (i + 1), 1.8);
    P.floor(root, mx1, mx1 + 0.8 - i * 0.4, -1.8, 1.8, T + 0.3 * (i + 1));
  }
  // hanging lamps
  for (const x of [-75, -71]) {
    B.span(K.brass, x - 0.01, F + 2.4, -0.01, x + 0.01, F + 3.6, 0.01);
    B.place(K.brass, lathe([[0, 0], [0.14, 0.02], [0.17, 0.05], [0.04, 0.08]], 12), x, F + 2.35, 0);
    for (let k = 0; k < 5; k++) flames.points.push(new THREE.Vector3(x + Math.cos(k * 1.2566) * 0.14, F + 2.45, Math.sin(k * 1.2566) * 0.14));
  }
  const ml = new THREE.PointLight(0xffa860, 6, 9, 1.6);
  ml.position.set(-73, F + 2.6, 0);
  root.add(ml); lights.push(ml);

  // ---- dhwajastambha, balipitha, Sri Chakra meru
  const dx = -63.4;
  for (const [w, hh, y0] of [[1.4, 0.35, T], [1.1, 0.35, T + 0.35], [0.8, 0.45, T + 0.7]] as const) B.box(K.granite, w, hh, w, dx, y0, 0);
  B.place(K.gilt, new THREE.CylinderGeometry(0.13, 0.17, 10, 14), dx, T + 1.15 + 5, 0);
  for (let yy = T + 1.6; yy < T + 11; yy += 0.9) B.place(K.gilt, new THREE.TorusGeometry(0.17, 0.035, 6, 14).rotateX(Math.PI / 2), dx, yy, 0);
  for (const yy of [T + 10.1, T + 10.6]) B.box(K.gilt, 1.1, 0.07, 0.09, dx, yy, 0);
  B.place(K.gilt, kalashaGeo(0.55, 12), dx, T + 11.15, 0);
  P.solid(dx - 0.7, T, -0.7, dx + 0.7, T + 11, 0.7);
  B.box(K.granite, 0.9, 0.35, 0.9, dx - 1.6, T, 0);
  B.place(K.graniteCarved, lathe([[0.36, 0], [0.4, 0.06], [0.3, 0.16], [0.44, 0.26], [0.48, 0.34], [0, 0.34]], 14), dx - 1.6, T + 0.35, 0);
  P.solid(dx - 2.05, T, -0.45, dx - 1.15, T + 0.7, 0.45);
  O.heap(dx - 1.6, T + 0.69, 0, 0.18, 0.04, 10);
  // Sri Chakra meru: a stepped stone pyramid of nine rings, kumkum on the top
  const meru: [number, number][] = [[0, 0]];
  for (let i = 0; i < 9; i++) meru.push([0.55 - i * 0.055, i * 0.06], [0.55 - i * 0.055, (i + 1) * 0.06]);
  meru.push([0, 0.56]);
  B.box(K.granite, 1.5, 0.5, 1.5, mx1 + 1.8, T, 3.0);
  B.box(K.goldPlain, 1.3, 0.06, 1.3, mx1 + 1.8, T + 0.5, 3.0);
  B.place(K.gilt, lathe(meru, 24), mx1 + 1.8, T + 0.56, 3.0);
  B.place(K.kumkum, new THREE.SphereGeometry(0.05, 8, 6), mx1 + 1.8, T + 1.12, 3.0);
  P.solid(mx1 + 1.2, T, 2.4, mx1 + 2.4, T + 0.6, 3.6);
  O.scatter(mx1 + 1.2, mx1 + 2.4, 2.4, 3.6, T + 0.57, 14, 0.2);

  return { lights, vimanaTop };
}

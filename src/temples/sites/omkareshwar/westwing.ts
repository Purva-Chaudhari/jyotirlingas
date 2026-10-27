import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import { WEST, westPt, COURT_X0, GHAT, HALL } from './layout';
import { pipeRail, phamsanaGeometry, rnd } from './util';

/**
 * West of the grand stair (drone videos; a 2023 river photograph from downstream):
 *  - the galleries' west wing, turned 30° to face SSW where the façade bends: 8 storeys of continuous
 *    balconies, more closed than the east wing, terracotta caps at its corners and middle;
 *  - a narrow stair tower in the bend, standing proud, with a flat-roofed colonnaded kiosk on top;
 *  - beyond the wing, the old fortress wall of the temple terrace, weathered and stained, dropping from
 *    the forecourt to the ghat, with a pink railing along its top;
 *  - grey corrugated sheet roofs on pink steel over the forecourt between the hall and the galleries.
 * The wing is scenery (the walk goes up the stair and along the east galleries), so it is solid only at
 * its faces to the forecourt.
 */
/** the serpentine queue lanes under the west forecourt's sheet roofs: [z, west end x] (each runs east to x -6) */
export const COURT_QUEUE: [number, number][] = [[2.9, -19.5], [4.5, -15.5], [6.1, -11.5]];

export function buildWestWing(root: THREE.Group, K: OM, P: Physics) {
  const { len, depth, y0, storey, roof } = WEST;

  // ---------- the wing, built in its own frame (local x = -u, z = v) ----------
  const w = new THREE.Group();
  w.name = 'west-wing';
  w.position.set(WEST.ox, 0, WEST.oz);
  w.rotation.y = -WEST.ang;
  root.add(w);
  const B = new Batch();
  const pier = new Instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), K.pink);
  const posts = new Instances(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, 0.5, 0), K.steel);
  const bays = 5, bw = len / bays;
  const xs = Array.from({ length: bays + 1 }, (_, i) => -len + i * bw);
  for (const x of xs) for (const z of [0, depth / 2, depth]) pier.at(x, y0, z, 0.78, roof - y0 + (z === depth / 2 ? 0 : 1.1), 0.78);
  // the ghat-level floor and a slab per storey; the floor edges read as thin bands from the river
  B.span(K.ghat, -len - 0.4, 0.4, y0 - 0.4, y0, -0.35, depth + 0.35);
  const levels: number[] = [];
  for (let y = y0 + storey; y <= roof + 0.01; y += storey) levels.push(y);
  for (const y of levels) {
    B.span(K.pink, -len - 0.4, 0.4, y - 0.3, y, -0.35, depth + 0.35);
    B.span(K.pinkCarved, -len - 0.55, 0.55, y - 0.3, y - 0.15, depth + 0.3, depth + 0.55);
    B.span(K.pinkDark, -len - 0.45, 0.45, y - 0.55, y - 0.3, depth - 0.1, depth + 0.42);
    if (y === roof) {
      for (let i = 0; i < bays; i++) for (const z of [0, depth]) B.span(K.pinkCarved, xs[i] + 0.35, xs[i + 1] - 0.35, roof, roof + 0.9, z - 0.1, z + 0.1);
      B.span(K.pink, -len - 0.45, 0.45, roof + 0.9, roof + 1.05, depth - 0.18, depth + 0.18);
      continue;
    }
    // balcony kerb and railing along the river face
    B.span(K.pink, -len - 0.3, 0.3, y, y + 0.22, depth + 0.12, depth + 0.36);
    pipeRail(B, K.steel, posts, -len, depth + 0.24, 0, depth + 0.24, y + 0.22, 0.95);
  }
  // closed: a back wall to the forecourt, end walls, and the inner wall 2.6 m behind the balconies with
  // a door and a window per bay
  B.span(K.pinkDark, -len, 0, y0, roof, -0.2, 0.15);
  for (const x of [-len, 0]) B.span(K.pinkDark, x - 0.15, x + 0.15, y0, roof, 0, depth);
  const inner = depth - 2.6;
  for (let k = 0; k < levels.length; k++) {
    const yb = y0 + k * storey, yt = yb + storey - 0.3;
    B.span(K.pink, -len, 0, yb, yt, inner - 0.1, inner + 0.1);
    for (let i = 0; i < bays; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      B.span(K.dark, cx - 1.5, cx - 0.4, yb, yb + 2.2, inner + 0.1, inner + 0.13);
      B.span(K.dark, cx + 0.3, cx + 1.6, yb + 0.9, yb + 2.2, inner + 0.1, inner + 0.13);
    }
    // windows in the end wall to the bend and the west end
    for (const x of [-len - 0.17, 0.17]) B.span(K.dark, x - 0.02, x + 0.02, yb + 0.9, yb + 2.2, inner - 3.2, inner - 1.8);
  }
  // tube lights under the balconies
  const tubes = new Instances(new THREE.BoxGeometry(1.2, 0.05, 0.08), K.tube);
  for (const y of [y0, ...levels.slice(0, -1)]) for (let i = 0; i < bays; i++) tubes.at((xs[i] + xs[i + 1]) / 2, y + storey - 0.45, depth - 1.3);
  tubes.flush(w, false);
  // terracotta caps: one at each corner and one in the middle
  for (const [x, s] of [[-len + 2.6, 1], [-len / 2, 1], [-2.6, 0.75]] as const) {
    for (const p of phamsanaGeometry(6)) { p.scale(2.4 * s, 2.6 * s, 2.4 * s); p.translate(x, roof, depth / 2 + 0.5); B.add(K.pinkDark, p); }
    B.span(K.pink, x - 2.5 * s, x + 2.5 * s, roof, roof + 0.5, depth / 2 - 2 * s, depth / 2 + 3 * s);
  }
  pier.flush(w);
  posts.flush(w, false);
  B.flush(w);

  // ---------- everything else in world space ----------
  const g = new THREE.Group();
  g.name = 'west-court';
  root.add(g);
  const W = new Batch();
  const [bx, bz] = westPt(len, 0); // back-west corner of the wing
  const [fx, fz] = westPt(len, depth); // front-west corner
  const [ex, ez] = westPt(0, depth); // front-east corner (in the bend)

  // the stair tower in the bend, a little proud of both wings, and its kiosk
  const tower: [number, number][] = [[WEST.ox - 0.1, WEST.oz], [WEST.ox - 0.4, 25.0], [ex - 0.7, ez + 1.25], [ex, ez]];
  W.prism(K.pink, tower, y0, roof + 1.6);
  {
    // a moulded band at every floor, like the wings' slab edges
    const cx = tower.reduce((a, p) => a + p[0], 0) / 4, cz = tower.reduce((a, p) => a + p[1], 0) / 4;
    const band = tower.map(([x, z]) => [cx + (x - cx) * 1.06, cz + (z - cz) * 1.06] as [number, number]);
    for (let y = y0 + storey; y <= roof + 0.01; y += storey) W.prism(K.pinkDark, band, y - 0.5, y - 0.2);
  }
  {
    // narrow slit windows on the tower's river face
    const [ax, az] = tower[1], [cx, cz] = tower[2];
    const ang = Math.atan2(cz - az, cx - ax);
    for (let y = y0 + 1.2; y < roof; y += storey) {
      const slit = new THREE.BoxGeometry(0.7, 1.8, 0.06).rotateY(-ang).translate((ax + cx) / 2, y + 0.9, (az + cz) / 2 + 0.02);
      W.add(K.dark, slit);
    }
  }
  const kx = (tower[0][0] + tower[1][0] + tower[2][0] + tower[3][0]) / 4, kz = (tower[0][1] + tower[1][1] + tower[2][1] + tower[3][1]) / 4;
  const ky = roof + 1.6;
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) W.span(K.pink, kx + dx - 0.17, kx + dx + 0.17, ky, ky + 3.4, kz + dz - 0.17, kz + dz + 0.17);
  W.span(K.pinkDark, kx - 1.9, kx + 1.9, ky + 3.4, ky + 3.75, kz - 1.9, kz + 1.9);
  W.span(K.pink, kx - 1.6, kx + 1.6, ky + 3.75, ky + 4.2, kz - 1.6, kz + 1.6);
  P.solid(Math.min(...tower.map((p) => p[0])), y0, WEST.oz, WEST.ox - 0.1, roof + 1.6, 25.0);

  // the old fortress wall of the terrace, west of the wing, and the forecourt on top of it
  const fort: [number, number][] = [[bx, bz], [fx, fz], [-38, 12.6], [-46, 11.2], [-48, 2], [-48, HALL.z1 - 2.5]];
  W.prism(K.fort, fort, -16.5, -0.5);
  const tri: [number, number][] = [[WEST.ox, HALL.z1], [WEST.ox, WEST.oz], [bx, bz]];
  W.prism(K.rock, tri, -13, -0.5);
  W.prism(K.ghat, fort, -0.5, 0);
  W.prism(K.ghat, tri, -0.5, 0);
  // weathering: dark streaks below the drains and a few small openings in the wall's face
  const faceLine: [number, number][] = [[fx, fz], [-38, 12.6], [-46, 11.2]];
  for (let i = 0; i < faceLine.length - 1; i++) {
    const [ax, az] = faceLine[i], [cx, cz] = faceLine[i + 1];
    const L = Math.hypot(cx - ax, cz - az), ang = Math.atan2(cz - az, cx - ax);
    for (let t = 1.5; t < L - 1; t += 2.2 + rnd() * 2.5) {
      const x = ax + ((cx - ax) * t) / L, z = az + ((cz - az) * t) / L;
      const h = 3 + rnd() * 7;
      W.add(K.ghatWet, new THREE.BoxGeometry(0.25 + rnd() * 0.5, h, 0.04).rotateY(-ang).translate(x, -0.6 - h / 2, z + 0.03));
      if (rnd() < 0.3) W.add(K.dark, new THREE.BoxGeometry(0.7, 1.0, 0.05).rotateY(-ang).translate(x + 0.8, -6 + rnd() * 3, z + 0.04));
    }
    // a pink steel railing along the top, posts every 1.5 m
    const n = Math.max(1, Math.round(L / 1.5));
    for (let k = 0; k <= n; k++) W.span(K.mamRail, ax + ((cx - ax) * k) / n - 0.03, ax + ((cx - ax) * k) / n + 0.03, 0, 1.05, az + ((cz - az) * k) / n - 0.4, az + ((cz - az) * k) / n - 0.34);
    for (const y of [0.5, 1.05]) W.add(K.mamRail, new THREE.BoxGeometry(L, 0.05, 0.05).rotateY(-ang).translate((ax + cx) / 2, y, (az + cz) / 2 - 0.37));
    for (let t = 0; t < L; t += 0.9) {
      const x = ax + ((cx - ax) * t) / L, z = az + ((cz - az) * t) / L;
      P.solid(x - 0.5, 0, z - 0.9, x + 0.5, 1.1, z - 0.2);
    }
  }
  // the ghat paving in front of the wing and the fortress wall (it meets the platform at the stalls)
  const ghatPoly: [number, number][] = [[WEST.ox - 0.4, GHAT.z0 + 0.4], [-48, GHAT.z0 + 0.4], [-48, 11.2], [-46, 11.2], [-38, 12.6], [fx, fz], [ex, ez], [ex - 0.7, ez + 1.25]];
  W.prism(K.ghat, ghatPoly, -16.5, GHAT.y);

  // the forecourt can't be left into the wing: solid along its back and west-end faces
  for (let u = 0; u < len; u += 0.8) {
    const [x, z] = westPt(u + 0.4, 0.3);
    P.solid(x - 0.45, 0, z - 0.45, x + 0.45, roof, z + 0.45);
  }
  for (let v = 0; v < depth; v += 0.8) {
    const [x, z] = westPt(len + 0.3, v + 0.4);
    P.solid(x - 0.45, 0, z - 0.45, x + 0.45, roof, z + 0.45);
  }
  P.floor(g, COURT_X0, WEST.ox, HALL.z1, WEST.oz, 0);

  // ---------- the queue's steel pipe rails between its lanes, closed at the west ends ----------
  {
    const qp = new Instances(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, 0.5, 0), K.steel);
    for (let i = 0; i < COURT_QUEUE.length; i++) {
      const [z, xa] = COURT_QUEUE[i];
      for (const zr of [z - 0.8, z + 0.8]) {
        if (i > 0 && zr === z - 0.8) continue; // (shared with the lane before)
        const xw = i < COURT_QUEUE.length - 1 && zr === z + 0.8 ? COURT_QUEUE[i + 1][1] : xa;
        pipeRail(W, K.steel, qp, xw, zr, -6.2, zr, 0, 1.0);
        P.solid(xw, 0, zr - 0.06, -6.2, 1.0, zr + 0.06);
      }
      pipeRail(W, K.steel, qp, xa, z - 0.8, xa, z + 0.8, 0, 1.0);
      P.solid(xa - 0.06, 0, z - 0.8, xa + 0.06, 1.0, z + 0.8);
    }
    qp.flush(g, false);
  }

  // ---------- sheet roofs over the forecourt, on pink steel ----------
  // One mono-pitch plane (falling towards the river) cut in 1 m strips, each stopping short of the wing,
  // the fortress railing or the east galleries' back wall; posts on a 4 m grid below.
  const roofY = (z: number) => 6.6 - 0.1 * (z - HALL.z1);
  const zLimit = (x: number): number => {
    if (x >= bx) return westPt((WEST.ox - x) / Math.cos(WEST.ang), 0)[1] - 0.4; // the wing's back
    if (x >= fx) return bz + ((bx - x) * (fz - bz)) / (bx - fx) - 0.4; // its west end
    const [p, q] = x >= -38 ? [[fx, fz], [-38, 12.6]] : [[-38, 12.6], [-46, 11.2]];
    return p[1] + ((x - p[0]) * (q[1] - p[1])) / (q[0] - p[0]) - 1.2; // behind the fortress railing
  };
  const strips: [number, number, number][] = [];
  for (let x = COURT_X0; x < WEST.ox - 0.3; x += 1) strips.push([x, Math.min(x + 1, WEST.ox - 0.3), zLimit(x + 0.5)]);
  // and over the court between the hall and the east galleries
  for (let x = WEST.ox + 6.2; x < 14; x += 1) strips.push([x, x + 1, WEST.oz - 0.4]);
  const slope = Math.atan(0.1);
  for (const [xa, xb, z1] of strips) {
    const z0 = HALL.z1 + 0.15;
    if (z1 <= z0 + 0.5) continue;
    const L = (z1 - z0) / Math.cos(slope);
    W.add(K.courtSheet, new THREE.BoxGeometry(xb - xa + 0.02, 0.03, L).rotateX(slope).translate((xa + xb) / 2, roofY((z0 + z1) / 2), (z0 + z1) / 2));
    // corrugation ribs every metre
    W.add(K.courtSheet, new THREE.BoxGeometry(0.05, 0.05, L).rotateX(slope).translate(xa + 0.5, roofY((z0 + z1) / 2) + 0.03, (z0 + z1) / 2));
    // a pink truss beam under it every 4 m
    if (Math.round(xa) % 4 === 0) {
      W.add(K.mamRail, new THREE.BoxGeometry(0.1, 0.35, L).rotateX(slope).translate(xa, roofY((z0 + z1) / 2) - 0.22, (z0 + z1) / 2));
      for (let z = z0 + 1.55; z < z1 - 0.8; z += 4) { // (on the queue's rail lines, not in its lanes)
        if (Math.abs(xa) < 3.6 || (xa > WEST.ox && xa < 4)) continue; // keep the stair and the walk clear
        W.span(K.mamRail, xa - 0.08, xa + 0.08, 0, roofY(z) - 0.3, z - 0.08, z + 0.08);
        P.solid(xa - 0.12, 0, z - 0.12, xa + 0.12, roofY(z) - 0.3, z + 0.12);
      }
    }
  }
  W.flush(g);
  return { wing: w, court: g };
}

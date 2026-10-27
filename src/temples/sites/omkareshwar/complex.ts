import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import { FRAME, GHAT, STAIR, LANE, WATER_Y } from './layout';
import { stairsZ, stairsX, pipeRail, phamsanaGeometry, rekhaGeometry, rnd } from './util';
import { canopyGeometry } from './boats';

/**
 * The riverfront as it stands today (photographs 2021-2026): the old temple sits on the cliff top,
 * and a new multi-storey frame of salmon-pink sandstone - open galleries for the darshan queues,
 * square piers, edge beams, steel railings, little phamsana roofs on the roofline - fills the cliff
 * face from the Koti Tirth ghat up to the temple. A grand stair climbs through its centre bay.
 */
export function buildComplex(root: THREE.Group, K: OM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'complex';
  root.add(g);
  const B = new Batch();
  const posts = new Instances(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, 0.5, 0), K.steel);
  const { xs, zs, levels, front, back, bandBack } = FRAME;
  const X0 = xs[0], X1 = xs[xs.length - 1];
  const hw = STAIR.hw;

  // ---------- piers ----------
  const pier = new Instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), K.pink);
  for (const x of xs) {
    for (const z0 of zs) {
      // the east-end pier on the z = 19 line would stand in the mouth of the lane: it is set back to 17.3
      const z = x === xs[xs.length - 1] && z0 === 19 ? 17.3 : z0;
      const top = z >= bandBack ? 12 : 0.0;
      pier.at(x, -12, z, 0.78, top + 12, 0.78);
      if (z === front || x === X0 || x === X1) P.solid(x - 0.35, -12, z - 0.35, x + 0.35, top, z + 0.35);
      else P.solid(x - 0.33, -12, z - 0.33, x + 0.33, top, z + 0.33);
    }
  }
  // the parapet piers carry on above the roof
  for (const x of xs) for (const z of [bandBack, front]) pier.at(x, 12, z, 0.7, 1.1, 0.7);

  // ---------- slabs (with the stair voids) ----------
  const slab = (y: number, z0: number, z1: number, voidZ?: [number, number]) => {
    const t = 0.32;
    if (!voidZ) {
      B.span(K.pink, X0 - 0.4, X1 + 0.4, y - t, y, z0 - 0.35, z1 + 0.35);
      return;
    }
    B.span(K.pink, X0 - 0.4, -hw - 0.3, y - t, y, z0 - 0.35, z1 + 0.35);
    B.span(K.pink, hw + 0.3, X1 + 0.4, y - t, y, z0 - 0.35, z1 + 0.35);
    if (voidZ[0] > z0) B.span(K.pink, -hw - 0.3, hw + 0.3, y - t, y, z0 - 0.35, voidZ[0]);
    if (voidZ[1] < z1) B.span(K.pink, -hw - 0.3, hw + 0.3, y - t, y, voidZ[1], z1 + 0.35);
  };
  // the ghat-level floor of the frame
  B.span(K.ghat, X0 - 0.4, X1 + 0.4, -12.4, -12, back, front + 0.35);
  slab(-4, back, front, [STAIR.aZ1, front + 1]);
  slab(0, back, front, [STAIR.bZ1 - 0.3, STAIR.landZ + 2.5]);
  slab(4, bandBack, front);
  slab(8, bandBack, front);
  slab(12, bandBack, front);
  // walkable floors: ghat level, -4 gallery (joins the lane), the 0 forecourt/gallery
  P.floor(g, X0 - 0.4, X1 + 0.4, back, front + 0.3, -12);
  for (const [x0, x1] of [[X0, -hw], [hw, X1]]) P.floor(g, x0, x1, back, front, -4);
  P.floor(g, -hw, hw, back, STAIR.aZ1, -4);
  for (const [x0, x1] of [[X0, -hw - 0.3], [hw + 0.3, X1]]) P.floor(g, x0, x1, back, front, 0);
  P.floor(g, -hw - 0.3, hw + 0.3, STAIR.landZ + 2.5, front, 0);
  P.floor(g, -hw - 0.3, hw + 0.3, -1, STAIR.bZ1, 0); // (to the stair's head: no gap between it and the forecourt)

  // ---------- edge beams, parapets, railings on every storey ----------
  for (const y of levels.slice(1)) {
    if (y === -8) continue; // the east wing stands on a tall open stilt storey from the ghat to the -4 gallery
    const zFrontOnly = y > 0;
    const zb = zFrontOnly ? bandBack : back;
    // a moulded cornice band per storey, then the deep edge beam (the horizontal bands that read so strongly from the river)
    B.span(K.pinkCarved, X0 - 0.55, X1 + 0.55, y - 0.3, y - 0.15, front + 0.3, front + 0.55);
    B.span(K.pinkDark, X0 - 0.45, X1 + 0.45, y - 0.55, y - 0.3, front - 0.1, front + 0.42);
    B.span(K.pinkDark, X0 - 0.45, X0 + 0.1, y - 0.55, y - 0.3, zb - 0.4, front + 0.4);
    B.span(K.pinkDark, X1 - 0.1, X1 + 0.45, y - 0.55, y - 0.3, zb - 0.4, front + 0.4);
    if (y === 12) {
      // roof parapet: a pierced pink balustrade (jali panels between the piers)
      for (let i = 0; i < xs.length - 1; i++) {
        B.span(K.pinkCarved, xs[i] + 0.35, xs[i + 1] - 0.35, 12, 12.9, front - 0.1, front + 0.1);
        B.span(K.pinkCarved, xs[i] + 0.35, xs[i + 1] - 0.35, 12, 12.9, bandBack - 0.1, bandBack + 0.1);
      }
      B.span(K.pink, X0 - 0.45, X1 + 0.45, 12.9, 13.05, front - 0.18, front + 0.18);
      continue;
    }
    // low stone kerb + steel railing on the river face and the ends
    B.span(K.pink, X0 - 0.3, X1 + 0.3, y, y + 0.22, front + 0.12, front + 0.36);
    pipeRail(B, K.steel, posts, X0, front + 0.24, X1, front + 0.24, y + 0.22, 0.95);
    pipeRail(B, K.steel, posts, X0, zb, X0, front, y + 0.22, 0.95);
    pipeRail(B, K.steel, posts, X1, zb, X1, y === -4 ? LANE.z0 : front, y + 0.22, 0.95);
  }
  // walls behind the lower galleries (against the cliff) - plain pink with dark doorways
  for (const [a, b] of [[X0, -hw - 0.3], [hw + 0.3, X1]]) {
    B.span(K.rock, a, b, -12, -4, back - 0.4, back); // the cliff, seen between the stilts
    B.span(K.pinkDark, a, b, -4, 0, back - 0.4, back);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    if (Math.abs(cx) < hw + 0.5) continue;
    for (const y of [-4]) B.span(K.dark, cx - 0.7, cx + 0.7, y, y + 2.4, back - 0.02, back + 0.04);
  }
  for (const [a, b] of [[X0 - 1, -hw - 0.3], [hw + 0.3, X1 + 1]]) P.solid(a, -12, back - 3, b, 0, back);
  for (const y of [-4, 0]) {
    P.solid(X0 - 0.6, y, back, X0 - 0.3, y + 1.2, front + 0.4);
    P.solid(X1 + 0.3, y, back, X1 + 0.6, y + 1.2, y === -4 ? LANE.z0 : front + 0.4);
    for (const [a, b] of [[X0, -hw - 0.3], [hw + 0.3, X1]]) P.solid(a, y, front + 0.1, b, y + 1.2, front + 0.4);
  }
  // fill the band's back between storey 0 and the roof with a wall (temple forecourt side), windows
  B.span(K.pink, 9, X1, 0, 12, bandBack - 0.2, bandBack + 0.1);
  B.span(K.pink, X0, 9, 3.6, 12, bandBack - 0.2, bandBack + 0.1);
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (const y of [4, 8]) B.span(K.dark, cx - 1.2, cx + 1.2, y + 0.6, y + 2.8, bandBack - 0.24, bandBack + 0.14);
    if (Math.abs(cx) > 9) B.span(K.dark, cx - 0.8, cx + 0.8, 0, 2.5, bandBack - 0.24, bandBack + 0.14);
  }
  // the forecourt opens to the river gallery through the bays by the stair (x < 9)
  P.solid(9, 0, bandBack - 0.25, X1, 12, bandBack + 0.15);

  // ---------- the grand stair through the centre bay ----------
  stairsZ(B, K.ghat, g, P, -hw, hw, front + 0.35, STAIR.aZ1, -12, -4, -12.4);
  B.span(K.ghat, -hw, hw, -12.4, -4, STAIR.landZ, STAIR.aZ1);
  stairsZ(B, K.ghat, g, P, -hw, hw, STAIR.landZ, STAIR.bZ1, -4, 0, -4.4);
  // side walls of the stair well (pink, with a stone coping), steel handrails
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.15);
    B.span(K.pink, x - 0.15, x + 0.15, -12, -3.0, STAIR.aZ1, front);
    B.span(K.pink, x - 0.15, x + 0.15, -4, 1.0, STAIR.bZ1, STAIR.landZ);
    B.span(K.pink, x - 0.15, x + 0.15, -0.32, 1.0, STAIR.landZ, STAIR.landZ + 2.5);
    P.solid(x - 0.2, -12, STAIR.aZ1 + 0.4, x + 0.2, -3, front);
    P.solid(x - 0.2, -4, STAIR.bZ1, x + 0.2, 1, STAIR.landZ);
    P.solid(x - 0.2, 0, STAIR.landZ, x + 0.2, 1, STAIR.landZ + 2.5);
    for (const [za, ya, zb2, yb] of [[front, -12, STAIR.aZ1, -4], [STAIR.landZ, -4, STAIR.bZ1, 0]] as const) {
      const len = Math.hypot(zb2 - za, yb - ya);
      const r = new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateX(Math.PI / 2 - Math.atan2(yb - ya, za - zb2));
      r.translate(x - s * 0.35, (ya + yb) / 2 + 0.95, (za + zb2) / 2);
      B.add(K.brass, r);
    }
  }
  // stair-well parapet round the forecourt opening
  B.span(K.pink, -hw - 0.3, hw + 0.3, 0, 1.0, STAIR.landZ + 2.5, STAIR.landZ + 2.8);
  P.solid(-hw - 0.3, 0, STAIR.landZ + 2.4, hw + 0.3, 1, STAIR.landZ + 2.9);
  // a gateway over the foot of the stair on the ghat: pink torana with a phamsana crown
  for (const s of [-1, 1]) B.span(K.pinkCarved, s * (hw + 0.2) - 0.45, s * (hw + 0.2) + 0.45, -12, -6.4, front + 0.4, front + 1.3);
  B.span(K.pinkCarved, -hw - 0.9, hw + 0.9, -6.4, -5.4, front + 0.3, front + 1.4);
  for (const p of phamsanaGeometry(5)) { p.scale(1.6, 1.4, 0.8); p.translate(0, -5.4, front + 0.85); B.add(K.pink, p); }
  for (const s of [-1, 1]) P.solid(s * (hw + 0.2) - 0.5, -12, front + 0.35, s * (hw + 0.2) + 0.5, -6, front + 1.35);

  // ---------- phamsana roofs on the roofline ----------
  const roofXs = [20, 26.1, 31.75];
  for (const x of roofXs) {
    for (const p of phamsanaGeometry(6)) { p.scale(2.4, 2.6, 2.4); p.translate(x, 12, (bandBack + front) / 2 + 0.5); B.add(K.pinkDark, p); }
    B.span(K.pink, x - 2.5, x + 2.5, 12, 12.5, (bandBack + front) / 2 - 2, (bandBack + front) / 2 + 3);
  }
  // smaller pyramidal roofs at the east wing's front corners and by the stair (the west wing has its own)
  for (const x of [6.4, 13.1, 33.2]) {
    for (const p of phamsanaGeometry(5)) { p.scale(1.7, 2.0, 1.7); p.translate(x, 12, front - 1.5); B.add(K.pinkDark, p); }
  }

  // ---------- inner gallery details: queue rails, tube lights, sheet roofs on the forecourt edge ----------
  const tubes = new Instances(new THREE.BoxGeometry(1.2, 0.05, 0.08), K.tube);
  for (const y of [-12, -4, 0, 4, 8]) {
    const zb = y >= 0 ? bandBack : back;
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      if (Math.abs(cx) < hw + 0.5) continue;
      tubes.at(cx, y === -12 ? -4.85 : y + 3.55, (zb + front) / 2); // (the stilt storey's under the -4 slab)
    }
    if (y === -4 || y === -12) {
      // serpentine queue rails along the gallery
      for (const zq of [front - 3, front - 6.5]) {
        pipeRail(B, K.steel, posts, X0 + 1, zq, -hw - 1, zq, y, 0.95);
        pipeRail(B, K.steel, posts, hw + 1, zq, X1 - 1, zq, y, 0.95);
      }
    }
  }
  tubes.flush(g, false);

  // ---------- the ghat: platform, river steps, wet steps, stalls, shrines ----------
  B.span(K.ghat, GHAT.x0, GHAT.x1, -16.5, GHAT.y, front + 0.35, GHAT.z1);
  P.floor(g, GHAT.x0, GHAT.x1, front + 0.3, GHAT.z1, GHAT.y);
  const nSteps = Math.round((GHAT.y - (WATER_Y - 0.6)) / 0.24);
  const tread = (GHAT.stepsTo - GHAT.z1) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    const top = GHAT.y - (i + 1) * 0.24;
    const mat = top < WATER_Y + 0.6 ? K.ghatWet : K.ghat;
    B.span(mat, GHAT.x0 + i * 0.25, GHAT.x1 - i * 0.25, -17.5, top, GHAT.z1 + i * tread, GHAT.z1 + (i + 1) * tread);
  }
  P.floor(g, GHAT.x0, GHAT.x1, GHAT.z1, GHAT.stepsTo - 2.5, GHAT.y, WATER_Y + 0.3);
  // stop at the water's edge
  P.solid(GHAT.x0 - 5, WATER_Y - 2, GHAT.stepsTo - 2.6, GHAT.x1 + 5, WATER_Y + 3, GHAT.stepsTo - 2.3);
  for (const x of [GHAT.x0, GHAT.x1]) P.solid(x - 0.5, -18, front, x + 0.3, -6, GHAT.stepsTo);
  // a ghat-front stone parapet at the two ends, with a few chhatri-like shrines
  // stalls with yellow and saffron tarps along the back of the platform (photos: the whole ghat is lined with them)
  // cloth tarps: a sagging roof with a scalloped valance, pitched a little towards the river (unit size, scaled per stall)
  const tarpGeo = canopyGeometry(1, 1, 0.2, 0.2, 1).rotateX(0.1);
  const tarp = new Instances(tarpGeo, K.tarp);
  const tarpColors: THREE.Color[] = [];
  const pole = new Instances(new THREE.CylinderGeometry(0.035, 0.04, 1, 5).translate(0, 0.5, 0), K.wood);
  // lemon-yellow, green and white patchwork, the odd golden-yellow or orange (drone videos)
  const TARP = [0xe9d12f, 0x2e9b4e, 0xeeeeea, 0xe9d12f, 0x2e9b4e, 0xf2b62a, 0xeeeeea, 0xe9d12f, 0x2e9b4e, 0xe8701e];
  const stall = (x: number, z: number, w: number, d: number, h: number) => {
    tarp.at(x, GHAT.y + h, z, w, 1, d, 0);
    tarpColors.push(new THREE.Color(TARP[Math.floor(rnd() * TARP.length)]));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pole.at(x + (dx * w) / 2.1, GHAT.y, z + (dz * d) / 2.1, 1, h + (dz < 0 ? 0.25 : -0.2), 1);
    B.span(K.wood, x - w / 2 + 0.2, x + w / 2 - 0.2, GHAT.y, GHAT.y + 0.8, z - d / 2 + 0.3, z - d / 2 + 0.9);
    B.span(K.wood, x - w / 2 + 0.15, x + w / 2 - 0.15, GHAT.y + 0.8, GHAT.y + 0.86, z - d / 2 + 0.25, z - d / 2 + 0.95);
    P.solid(x - w / 2 + 0.2, GHAT.y, z - d / 2 + 0.3, x + w / 2 - 0.2, GHAT.y + 0.8, z - d / 2 + 0.9);
    // saffron pennant on one pole
    if (rnd() < 0.35) B.add(K.saffron, new THREE.PlaneGeometry(0.5, 0.35).translate(x - w / 2.1 + 0.26, GHAT.y + h + 0.4, z - d / 2.1));
  };
  for (let x = GHAT.x0 + 3; x < GHAT.x1 - 3; x += 3.4 + rnd() * 1.4) {
    if (Math.abs(x) < 9 || (x > -24 && x < -8.5)) continue; // (open behind the Narmada Aarti platform)
    stall(x, front + 2.6 + rnd() * 1.2, 3 + rnd(), 2.8 + rnd() * 0.8, 2.2 + rnd() * 0.3);
  }
  const tarpMesh = tarp.flush(g, true);
  if (tarpMesh) { tarpColors.forEach((c, i) => tarpMesh.setColorAt(i, c)); tarpMesh.instanceColor!.needsUpdate = true; }
  pole.flush(g, false);
  // two small nagara shrines at the foot of the galleries; the old one in the re-entrant corner is orange-red
  // sandstone (drone videos), the other whitewashed
  for (const [x, hwS, hS] of [[-7.2, 1.25, 6.8], [7.0, 0.95, 5.2]] as const) {
    B.span(K.oldPlain, x - hwS - 0.3, x + hwS + 0.3, GHAT.y, GHAT.y + 0.6, 26.6 - hwS - 0.3, 26.6 + hwS + 0.3);
    B.span(K.oldPlain, x - hwS, x + hwS, GHAT.y + 0.6, GHAT.y + 2.4, 26.6 - hwS, 26.6 + hwS);
    B.span(K.dark, x - 0.35, x + 0.35, GHAT.y + 0.6, GHAT.y + 1.9, 26.6 + hwS - 0.05, 26.6 + hwS + 0.02);
    const sp = rekhaGeometry(hwS * 1.02, hS - 2.4, 8);
    sp.translate(x, GHAT.y + 2.4, 26.6);
    B.add(x < 0 ? K.shrineOrange : K.plaster, sp);
    P.solid(x - hwS - 0.3, GHAT.y, 26.6 - hwS - 0.3, x + hwS + 0.3, GHAT.y + 5, 26.6 + hwS + 0.3);
    flames.points.push(new THREE.Vector3(x, GHAT.y + 0.95, 26.6 + hwS + 0.3));
  }
  // evening-aarti brass lamps along the ghat edge
  for (let x = -24; x <= 24; x += 3) if (Math.abs(x) > 4) flames.points.push(new THREE.Vector3(x, GHAT.y + 0.08, GHAT.z1 - 0.3));

  // ---------- lane along the cliff to the Jhoola pul, and a stair down to the ghat's east end ----------
  // The stair is cut into the lane's masonry: from the lane (x = 50, y = -4) down east to the ghat (x = 62, y = -12).
  const SW = { x0: 50, x1: 62, z0: 21.2, z1: 24 }; // the cut keeps clear of the lane's centre line (z = 20)
  const LZ1 = front + 0.35;
  B.span(K.rock, LANE.x0, SW.x0, -12, LANE.y, LANE.z0, LZ1);
  B.span(K.rock, SW.x0, SW.x1, -12, LANE.y, LANE.z0, SW.z0);
  B.span(K.oldPlain, SW.x0, SW.x1, -12, LANE.y, SW.z1, LZ1);
  B.span(K.rock, SW.x1, 70, -12, LANE.y, LANE.z0, SW.z0);
  B.span(K.ghat, SW.x1, 70, LANE.y - 0.5, LANE.y, SW.z0, LZ1);
  B.span(K.rock, 70, LANE.x1, -12, LANE.y, LANE.z0, LZ1);
  B.span(K.ghat, LANE.x0, LANE.x1, LANE.y - 0.25, LANE.y + 0.01, LANE.z0, SW.z0);
  B.span(K.ghat, LANE.x0, SW.x0, LANE.y - 0.25, LANE.y + 0.01, SW.z0, LZ1);
  B.span(K.ghat, SW.x1, LANE.x1, LANE.y - 0.25, LANE.y + 0.01, SW.z0, LZ1);
  P.floor(g, LANE.x0 - 0.5, SW.x0, LANE.z0, LZ1, LANE.y);
  P.floor(g, SW.x0, SW.x1, LANE.z0, SW.z0, LANE.y);
  P.floor(g, SW.x1, LANE.x1, LANE.z0, LZ1, LANE.y);
  stairsX(B, K.ghat, g, P, SW.x0, SW.x1, SW.z0, SW.z1, LANE.y, GHAT.y, -12.4);
  P.floor(g, SW.x1, 70, SW.z0, LZ1, GHAT.y);
  // walls: stair well from the lane, river parapet, the cliff behind the lane
  B.span(K.ghat, SW.x0 + 1, SW.x1, LANE.y, LANE.y + 0.9, SW.z0 - 0.25, SW.z0);
  P.solid(SW.x0 + 1, -12, SW.z0 - 0.3, SW.x1, LANE.y + 1, SW.z0);
  P.solid(SW.x0, -12, SW.z1, SW.x1, LANE.y + 1, SW.z1 + 0.3);
  // (open where the Jhoola pul leaves the lane at x ≈ 121)
  B.span(K.ghat, LANE.x0, LANE.x1 - 1.6, LANE.y, LANE.y + 0.75, LZ1 - 0.3, LZ1);
  P.solid(LANE.x0 + 0.4, LANE.y, LZ1 - 0.35, LANE.x1 - 1.6, LANE.y + 1, LZ1 + 0.1);
  P.solid(LANE.x0 + 0.5, LANE.y, LANE.z0 - 3, LANE.x1, LANE.y + 4, LANE.z0);
  // the ghat's back wall west of the galleries and between the galleries and the stair
  P.solid(GHAT.x0, GHAT.y, 4, X0 - 0.45, 0, front + 0.3);
  P.solid(X1 + 0.45, GHAT.y, LANE.z0, SW.x0, LANE.y - 0.4, LZ1);
  P.solid(SW.x1, GHAT.y, LANE.z0, 70, LANE.y - 0.6, SW.z0);
  P.solid(70, GHAT.y, LANE.z0, 72, LANE.y - 0.6, LZ1);
  // the covered walkway to the Jhoola pul: white pillars along the river edge, a blue-grey sheet roof (drone videos)
  for (let x = LANE.x0 + 2; x < LANE.x1 - 2; x += 4.2) {
    if (x > SW.x0 - 0.5 && x < SW.x1 + 0.5) continue;
    B.span(K.whiteConcrete, x - 0.18, x + 0.18, LANE.y, LANE.y + 3.3, LZ1 - 0.6, LZ1 - 0.24);
    P.solid(x - 0.2, LANE.y, LZ1 - 0.62, x + 0.2, LANE.y + 3.3, LZ1 - 0.22);
  }
  B.add(K.walkRoof, new THREE.BoxGeometry(LANE.x1 - LANE.x0 - 2, 0.06, LZ1 - LANE.z0 + 0.8).rotateX(-0.06).translate((LANE.x0 + LANE.x1) / 2 - 1, LANE.y + 3.45, (LANE.z0 + LZ1) / 2));
  B.span(K.whiteConcrete, LANE.x0 + 1, LANE.x1 - 2, LANE.y + 3.1, LANE.y + 3.35, LZ1 - 0.6, LZ1 - 0.24);
  for (let x = 40; x < LANE.x1; x += 12) B.span(K.tube, x - 0.6, x + 0.6, LANE.y + 3.0, LANE.y + 3.05, (LANE.z0 + LZ1) / 2 - 0.04, (LANE.z0 + LZ1) / 2 + 0.04);

  pier.flush(g);
  posts.flush(g, false);
  B.flush(g);
  return g;
}

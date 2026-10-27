import * as THREE from 'three';
import { Flag, type Physics, type Flames } from '../../engine/kit';
import { worldUV } from '../../engine/materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, Instances, eave } from './batch';
import type { OM } from './mats';
import { HALL, F1, SHIKHARA, GARBHA, FRAME, STAIR, COURT_X0 } from './layout';
import { pipeRail, rekhaGeometry, rnd } from './util';
import { nandiMesh } from './nandi';

/**
 * The old temple on the cliff top (Paramara foundations, rebuilt under the Holkars):
 *  - ground floor: the sabha mandapa of sixty massive carved pillars, ~14 ft (4.4 m) to the ceiling,
 *    its Jyotirlinga chamber opening off the east side - NOT under the shikhara;
 *  - first floor (Mahakaleshwar) with a pillared verandah facing the river, an open terrace;
 *  - second floor (Siddhnath) as a smaller block, with Gupteshwar and Dhwajeshwar inside the spire;
 *  - the nagara shikhara over the hall's centre, today stripped of whitewash to its pinkish sandstone.
 */

/** Pancha-ratha-like plan of one face: (u along the face, outward offset), both relative to half-width. */
const SIDE: [number, number][] = [
  // karna (corner), recess, pratiratha, recess, bhadra (centre): three projecting rathas a side, ~0.25 m apart
  [-1, 0], [-0.78, 0], [-0.78, -0.045], [-0.7, -0.045], [-0.7, 0.0], [-0.42, 0.0], [-0.42, -0.04], [-0.34, -0.04], [-0.34, 0.042],
  [0.34, 0.042], [0.34, -0.04], [0.42, -0.04], [0.42, 0.0], [0.7, 0.0], [0.7, -0.045], [0.78, -0.045], [0.78, 0],
];

function planPts(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of SIDE) {
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/**
 * The stripped shikhara: courses of stone stepping in with a curving (rekha) profile; each bhumi ends
 * in a bold projecting ledge, the way the photographs read (horizontal layers of stone). Unit sizes:
 * half-width 1, height 1 (body); returns geometry already scaled to (hw, H).
 */
function shikharaGeometry(hw: number, H: number, bhumis = 13) {
  const P = planPts();
  const N = P.length;
  // convex 'beehive' rekha: sides bulge in the lower two thirds, rolling over to a broad shoulder ~0.45 of the base
  const width = (t: number) => 1 - 0.55 * Math.pow(t, 2.2);
  const rings: { y: number; s: number }[] = [];
  for (let k = 0; k < bhumis; k++) {
    const t0 = k / bhumis, t1 = (k + 1) / bhumis;
    const ledge = t1 - (t1 - t0) * 0.16;
    rings.push({ y: t0, s: width(t0) * 0.985 });
    rings.push({ y: ledge, s: width(ledge) * 0.985 });
    rings.push({ y: ledge, s: width(ledge) * 1.04 });
    rings.push({ y: t1 - (t1 - t0) * 0.04, s: width(t1) * 1.04 });
    rings.push({ y: t1, s: width(t1) * 0.985 });
  }
  const pos: number[] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], Bq = rings[r + 1];
    for (let i = 0; i < N; i++) {
      const p = P[i], q = P[(i + 1) % N];
      const a = [p.x * A.s * hw, A.y * H, p.y * A.s * hw], b = [q.x * A.s * hw, A.y * H, q.y * A.s * hw];
      const c = [q.x * Bq.s * hw, Bq.y * H, q.y * Bq.s * hw], d = [p.x * Bq.s * hw, Bq.y * H, p.y * Bq.s * hw];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // make faces point outward whatever the plan's handedness
  g.computeVertexNormals();
  const n0 = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, 0);
  const p0 = new THREE.Vector3(pos[0], 0, pos[2]);
  if (n0.dot(p0) < 0) {
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
  }
  return { geo: g, topHalf: width(1) * hw };
}

/**
 * One of the sixty mandapa pillars, 4.4 m to the lintel (photographs: massive, grey, banded):
 * a square base with carved panels, an octagonal neck, a round shaft of fat carved drums,
 * a ghata (pot) and cushion capital, and cross brackets carrying the lintels. Metres; scale per instance.
 */
function hallPillar(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, y0: number, y1: number, d = w) => parts.push(new THREE.BoxGeometry(w, y1 - y0, d).translate(0, (y0 + y1) / 2, 0));
  box(1.12, 0, 0.12);
  box(1.0, 0.12, 0.2);
  box(0.92, 0.2, 0.95);
  box(1.0, 0.95, 1.02);
  // recessed panel frames on the base faces
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    for (const y of [0.3, 0.85]) parts.push(new THREE.BoxGeometry(0.7, 0.05, 0.06).translate(0, y, 0.47).rotateY(a));
    for (const x of [-0.33, 0.33]) parts.push(new THREE.BoxGeometry(0.05, 0.6, 0.06).translate(x, 0.575, 0.47).rotateY(a));
  }
  const oct = new THREE.LatheGeometry([[0, 1.02], [0.56, 1.02], [0.56, 1.06], [0.5, 1.1], [0.5, 1.36], [0.55, 1.4], [0, 1.4]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 8, Math.PI / 8);
  parts.push(oct);
  const prof: [number, number][] = [[0, 1.4], [0.47, 1.4], [0.5, 1.45], [0.5, 1.78], [0.44, 1.82], [0.44, 1.9], [0.51, 1.95], [0.51, 2.32],
    [0.44, 2.36], [0.42, 2.44], [0.49, 2.49], [0.49, 2.82], [0.42, 2.86], [0.38, 3.0], [0.46, 3.08], [0.53, 3.2], [0.52, 3.32], [0.42, 3.42],
    [0.36, 3.48], [0.48, 3.56], [0.56, 3.66], [0.5, 3.76], [0.38, 3.8], [0, 3.8]];
  parts.push(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 22));
  // drip-leaf points hanging off the drum rings (as on the real pillars)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (const y of [2.82, 2.32]) {
      const leaf = new THREE.ConeGeometry(0.055, 0.2, 4).rotateX(Math.PI).translate(0, y - 0.1, 0.48);
      parts.push(leaf.rotateY(a));
    }
  }
  // cross brackets
  box(1.7, 3.8, 3.92, 0.5);
  box(0.5, 3.8, 3.92, 1.7);
  // under each bracket arm a squat kichaka (dwarf) figure holds it up on raised hands (photographs of the capitals)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const fig = [
      new THREE.BoxGeometry(0.24, 0.2, 0.2).translate(0, 3.58, 0.7), // body and folded legs
      new THREE.SphereGeometry(0.08, 8, 6).translate(0, 3.72, 0.8), // head, leaning out
      new THREE.BoxGeometry(0.05, 0.16, 0.05).translate(-0.1, 3.72, 0.72), // raised arms
      new THREE.BoxGeometry(0.05, 0.16, 0.05).translate(0.1, 3.72, 0.72),
      new THREE.BoxGeometry(0.2, 0.08, 0.22).translate(0, 3.49, 0.68), // seat
    ];
    for (const f of fig) parts.push(f.rotateY(a));
  }
  const g = mergeGeometries(parts.map((x) => { const n = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }), false)!;
  g.computeVertexNormals();
  return worldUV(g);
}

export function buildTemple(root: THREE.Group, K: OM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'temple';
  root.add(g);
  const B = new Batch();
  const posts = new Instances(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, 0.5, 0), K.steel);
  const { x0, x1, z0, z1, h } = HALL;
  const EX = 14.0; // east face of the temple block (beyond the garbhagriha)

  // ---------- floors ----------
  B.span(K.hallFloor, x0, x1, -0.5, 0, z0, z1);
  // the forecourt strip between the hall and the galleries
  B.span(K.ghat, COURT_X0, FRAME.xs[FRAME.xs.length - 1], -0.5, 0, z1, FRAME.back);
  P.floor(g, x0, x1, z0, z1, 0);
  for (const [a, b] of [[COURT_X0, -STAIR.hw - 0.3], [STAIR.hw + 0.3, FRAME.xs[FRAME.xs.length - 1]]]) P.floor(g, a, b, z1, FRAME.back + 0.1, 0);
  // the forecourt's north edge beyond the temple: houses and walls
  P.solid(COURT_X0 - 1, 0, z1 - 2.5, x0, 8, z1);
  P.solid(EX, 0, z1 - 2.5, FRAME.xs[FRAME.xs.length - 1] + 1, 8, z1);
  B.span(K.oldPlain, COURT_X0, x0, 0, 7.5, z1 - 2.5, z1);
  B.span(K.oldPlain, EX, FRAME.xs[FRAME.xs.length - 1], 0, 6.5, z1 - 2.5, z1);
  for (const x of [-34, -27, -20, 18, 25, 31]) B.span(K.dark, x - 0.8, x + 0.8, 0, 2.4, z1 - 0.02, z1 + 0.03);

  // ---------- sixty pillars ----------
  const xsP = [-11.0, -8.6, -6.2, -3.8, -1.4, 1.4, 3.8, 6.2];
  const zsP = [0.8, -1.8, -4.4, -7.0, -9.6, -12.2, -14.8];
  const pillarGeo = hallPillar();
  // the stone grades from pinkish-orange sandstone in the bays open to the court (front and west), to grey in
  // the inner bays, to soot-darkened in the last rows before the garbhagriha door (darshan videos)
  const pilPink = new Instances(pillarGeo, K.oldStonePink);
  const pil = new Instances(pillarGeo, K.oldStone);
  const pilSoot = new Instances(pillarGeo, K.oldStoneSoot);
  const pillarAt = (x: number, z: number, y = 0) => {
    (z > -2 || x < -6 ? pilPink : x > 3 && Math.abs(z - GARBHA.doorZ) < 3 ? pilSoot : pil).at(x, y, z);
    P.solid(x - 0.52, y, z - 0.52, x + 0.52, y + h, z + 0.52);
  };
  for (const x of xsP) for (const z of zsP) pillarAt(x, z);
  // kumkum and sindoor smears where hands touch the pillars, and a few tied threads (photographs: builder ref 11)
  for (const x of xsP) for (const z of zsP) {
    if (rnd() < 0.45) continue;
    const f = Math.floor(rnd() * 4), a = (f * Math.PI) / 2;
    const y = 1.1 + rnd() * 0.5;
    B.add(K.kumkum, new THREE.BoxGeometry(0.012, 0.12 + rnd() * 0.18, 0.1 + rnd() * 0.12).translate(0.505, y, (rnd() - 0.5) * 0.3).rotateY(a).translate(x, 0, z));
    if (rnd() < 0.3) B.add(K.saffron, new THREE.TorusGeometry(0.5, 0.008, 4, 24).rotateX(Math.PI / 2).translate(x, 1.5 + rnd() * 0.3, z));
  }
  // four more on the porch
  for (const x of [-8.6, -6.2, 3.8, 6.2]) pillarAt(x, 3.0);
  // lintels between capitals, and the ceiling (first floor slab)
  for (const z of zsP) B.span(K.oldPlain, x0, x1, h - 0.48, h, z - 0.26, z + 0.26);
  for (const x of xsP) B.span(K.oldPlain, x - 0.26, x + 0.26, h - 0.48, h, z0, z1);
  B.span(K.oldPlain, -9.5, 7.2, h - 0.48, h, 2.74, 3.26);
  // first-floor slab, with the well of the first-floor stair (x0+0.1..x0+1.3, z -8..-2.5)
  B.span(K.darkStone, x0, x1, h, F1, z0, -8);
  B.span(K.darkStone, x0, x1, h, F1, -2.5, z1);
  B.span(K.darkStone, x0 + 1.42, x1, h, F1, -8, -2.5);
  // ceiling coffers between lintels: sunken dark squares
  for (let i = 0; i < xsP.length - 1; i++) {
    for (let j = 0; j < zsP.length - 1; j++) {
      const cx = (xsP[i] + xsP[i + 1]) / 2, cz = (zsP[j] + zsP[j + 1]) / 2;
      B.span(K.oldStone, cx - 0.8, cx + 0.8, h - 0.06, h - 0.02, cz - 0.8, cz + 0.8);
    }
  }

  // ---------- walls ----------
  const wallT = 0.6;
  // west and north walls; door gaps where noted
  B.span(K.oldStone, x0 - wallT, x0, 0, F1, z0 - wallT, z1);
  B.span(K.oldStone, x0 - wallT, EX, 0, F1, z0 - wallT, z0);
  P.solid(x0 - wallT, 0, z0 - wallT, x0, 5, z1);
  P.solid(x0 - wallT, 0, z0 - wallT, EX, 5, z0);
  // east side: hall wall at x1 with the garbhagriha in the middle (its own walls in sanctum.ts)
  B.span(K.oldStone, x1, EX, 0, F1, z0, GARBHA.z0 - 0.6);
  B.span(K.oldStone, x1, EX, 0, F1, GARBHA.z1 + 0.6, z1);
  P.solid(x1, 0, z0, EX, 5, GARBHA.z0 - 0.6);
  P.solid(x1, 0, GARBHA.z1 + 0.6, EX, 5, z1);
  // the front: open between pillars; a carved stone screen (jali) on the two outer bays
  for (const [a, b] of [[x0, -9.6], [7.4, EX]]) {
    B.span(K.oldStone, a, b, 0, F1, z1 - 0.4, z1);
    P.solid(a, 0, z1 - 0.4, b, 5, z1);
  }
  // a niche with lamp on the main axis at the back of the hall (the axis of the main door and the spire)
  B.span(K.oldPlain, -1.2, 1.2, 0, 3.4, z0, z0 + 0.5);
  B.span(K.dark, -0.7, 0.7, 0.9, 2.8, z0 + 0.45, z0 + 0.52);
  B.span(K.silver, -0.85, 0.85, 2.8, 2.95, z0 + 0.45, z0 + 0.6);
  flames.points.push(new THREE.Vector3(0, 1.05, z0 + 0.62));
  // the first-floor stair along the west wall, rising north
  const SX0 = x0 + 0.1, SX1 = x0 + 1.3;
  {
    const n = Math.round(F1 / 0.2);
    for (let i = 0; i < n; i++) {
      const za = 0 - (8 * i) / n, zb = 0 - (8 * (i + 1)) / n;
      B.span(K.oldPlain, SX0, SX1, 0, (F1 * (i + 1)) / n, zb, za);
    }
    P.floor(g, SX0, SX1, 0, -8, 0, F1);
    // rail on its open side
    const len = Math.hypot(8, F1);
    const rail = new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateX(Math.PI / 2 + Math.atan2(F1, 8));
    rail.translate(SX1 + 0.05, F1 / 2 + 0.95, -4);
    B.add(K.brass, rail);
    P.solid(SX1, 0.6, -6.9, SX1 + 0.12, F1 + 1, -2.5);
  }

  // ---------- Nandi facing the garbhagriha door ----------
  {
    const nandi = nandiMesh(K.whiteStone);
    nandi.scale.setScalar(0.42);
    nandi.rotation.y = -Math.PI / 2; // local -z → +x (towards the sanctum door)
    nandi.position.set(5.0, 0.32, GARBHA.doorZ);
    g.add(nandi);
    // white marble, on a low black plinth, garlanded in marigold; a brass railing with wheel motifs and spear
    // finials on the queue side (darshan videos; photograph of the Omkareshwar Nandi)
    B.span(K.blackStone, 4.3, 5.7, 0, 0.26, GARBHA.doorZ - 0.45, GARBHA.doorZ + 0.45);
    B.span(K.blackStone, 4.25, 5.75, 0.26, 0.32, GARBHA.doorZ - 0.5, GARBHA.doorZ + 0.5);
    for (const [x, y, r, t] of [[5.33, 0.7, 0.12, 0.6], [5.3, 0.6, 0.17, 0.95]] as const) {
      B.add(K.marigold, new THREE.TorusGeometry(r, 0.03, 6, 20).rotateY(Math.PI / 2).rotateZ(t).translate(x, y, GARBHA.doorZ));
    }
    {
      const zr = GARBHA.doorZ + 0.47, y0r = 0.32, hr = 0.6;
      for (const y of [y0r + 0.08, y0r + hr]) B.span(K.brass, 4.3, 5.7, y - 0.02, y + 0.02, zr - 0.02, zr + 0.02);
      for (let k = 0; k <= 5; k++) {
        const x = 4.3 + (1.4 * k) / 5;
        B.span(K.brass, x - 0.018, x + 0.018, y0r, y0r + hr + 0.06, zr - 0.018, zr + 0.018);
        B.add(K.brass, new THREE.ConeGeometry(0.03, 0.1, 4).translate(x, y0r + hr + 0.11, zr));
        if (k < 5) B.add(K.brass, new THREE.TorusGeometry(0.1, 0.012, 4, 16).translate(x + 0.14, y0r + 0.34, zr));
      }
    }
    P.solid(4.3, 0, GARBHA.doorZ - 0.5, 5.7, 1.4, GARBHA.doorZ + 0.5);
  }

  // steel queue railings along the central aisle (as in the photographs)
  for (const x of [-0.85, 0.85]) {
    pipeRail(B, K.steel, posts, x, 1.6, x, -4.7, 0, 1.0);
    P.solid(x - 0.06, 0, -4.7, x + 0.06, 1.0, 1.6);
  }

  // the aisle's queue is a stainless "tunnel": a gabled portal frame every 1.6 m, joined by pipes (darshan videos)
  {
    const zA = 1.6, zB = -4.7, n = Math.round((zA - zB) / 1.6);
    const rod = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
      const geo = new THREE.CylinderGeometry(0.022, 0.022, a.distanceTo(b), 6).translate(0, a.distanceTo(b) / 2, 0);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      B.add(K.steel, geo.translate(ax, ay, az));
    };
    for (let i = 0; i <= n; i++) {
      const z = zA + ((zB - zA) * i) / n;
      for (const s of [-1, 1]) {
        rod(s * 0.85, 1.0, z, s * 0.85, 2.1, z);
        rod(s * 0.85, 2.1, z, 0, 2.6, z);
      }
    }
    for (const [x, y] of [[-0.85, 2.1], [0.85, 2.1], [0, 2.6]]) rod(x, y, zA, x, y, zB);
  }
  {
    // pink steel lattice above head height in the bays facing the court, and in the porch's side bays
    // with folded yellow collapsible gates below (photographs of the hall front)
    const lat = document.createElement('canvas');
    lat.width = lat.height = 128;
    const c = lat.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#fff';
    c.lineWidth = 9;
    for (let k = -128; k <= 256; k += 32) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 128, 128); c.stroke();
      c.beginPath(); c.moveTo(k, 128); c.lineTo(k + 128, 0); c.stroke();
    }
    const alpha = new THREE.CanvasTexture(lat);
    alpha.wrapS = alpha.wrapT = THREE.RepeatWrapping;
    alpha.repeat.set(4, 4);
    const latMat = new THREE.MeshStandardMaterial({ color: 0xe3a39a, roughness: 0.6, metalness: 0.2, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide });
    const lattice = (xa: number, xb: number, z: number, ya: number, yb: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa - 1.0, yb - ya), latMat);
      m.position.set((xa + xb) / 2, (ya + yb) / 2, z);
      (m.material as THREE.MeshStandardMaterial).alphaMap!.repeat.set((xb - xa - 1.0) / 0.5, (yb - ya) / 0.5);
      g.add(m);
      B.span(K.mamRail, xa + 0.5, xb - 0.5, yb - 0.05, yb, z - 0.03, z + 0.03);
      B.span(K.mamRail, xa + 0.5, xb - 0.5, ya, ya + 0.05, z - 0.03, z + 0.03);
    };
    for (const [xa, xb] of [[-11.0, -8.6], [-8.6, -6.2], [-6.2, -3.8], [3.8, 6.2]]) lattice(xa, xb, 0.8, 2.4, 3.6);
    for (const [xa, xb] of [[-8.6, -6.2], [3.8, 6.2]]) {
      lattice(xa, xb, 3.0, 2.3, 3.6);
      // a collapsible gate pulled across below: yellow flat bars with the X links
      for (let x = xa + 0.55; x < xb - 0.5; x += 0.12) B.span(K.gateYellow, x - 0.012, x + 0.012, 0.05, 2.25, 2.98, 3.02);
      for (const y of [0.1, 1.15, 2.2]) B.span(K.gateYellow, xa + 0.5, xb - 0.5, y - 0.02, y + 0.02, 2.97, 3.03);
      P.solid(xa + 0.5, 0, 2.9, xb - 0.5, 2.3, 3.1);
    }
  }

  // queue rails down the aisle to the garbhagriha door (stopping short of the Nandi)
  pipeRail(B, K.steel, posts, 1.9, -5.0, 7.6, -5.0, 0, 1.0);
  P.solid(1.9, 0, -5.06, 7.6, 1.0, -4.94);
  pipeRail(B, K.steel, posts, 1.9, -6.4, 4.0, -6.4, 0, 1.0);
  P.solid(1.9, 0, -6.46, 4.0, 1.0, -6.34);

  // ---------- hanging bells and lights in the hall ----------
  const bell = new Instances(new THREE.LatheGeometry([[0, 0], [0.12, 0.01], [0.13, 0.08], [0.09, 0.2], [0.04, 0.26], [0, 0.27]].map(([a, b]) => new THREE.Vector2(a, b - 0.27)), 14), K.brass);
  for (const [x, z] of [[0, 2.0], [0, -3.0], [-5, -6], [-5, 1], [4.6, GARBHA.doorZ], [5.4, GARBHA.doorZ]]) { // (the row before the door: sanctum.ts)
    bell.at(x, 3.1, z, 1.3);
    B.span(K.brass, x - 0.01, x + 0.01, 3.1, h - 0.3, z - 0.01, z + 0.01);
  }
  bell.flush(g);
  const tubes = new Instances(new THREE.BoxGeometry(1.2, 0.05, 0.08), K.tube);
  for (const x of [-9.8, -5, 0, 5]) for (const z of [-3.1, -8.3, -13.5]) tubes.at(x, h - 0.55, z);
  tubes.flush(g, false);
  for (const [x, z, i] of [[-4, -4, 4], [-4, -12, 3], [4, -11, 3]] as const) {
    const l = new THREE.PointLight(0xffd9a8, i, 12, 1.6);
    l.position.set(x, 3.4, z);
    g.add(l);
  }

  // ---------- first floor (Mahakaleshwar): terrace, verandah, shrine room ----------
  P.floor(g, x0 - 0.1, x0 + 1.42, z0, -8, F1);
  P.floor(g, x0 - 0.1, x0 + 1.42, -2.5, z1, F1);
  P.floor(g, x0 + 1.42, x1, z0, z1, F1);
  const roomX0 = -9.4;
  // room walls (with windows) and a door from the terrace
  B.span(K.oldStone, roomX0, x1, F1, 8.9, z0, z0 + 0.5);
  B.span(K.oldStone, x1 - 0.5, x1, F1, 8.9, z0, -1);
  B.span(K.oldStone, roomX0, roomX0 + 0.5, F1, 8.9, z0, -8.6);
  B.span(K.oldStone, roomX0, roomX0 + 0.5, F1, 8.9, -6.4, -1);
  B.span(K.oldStone, roomX0, roomX0 + 0.5, F1 + 2.4, 8.9, -8.6, -6.4);
  B.span(K.oldStone, roomX0, x1, F1, 8.9, -1.5, -1);
  B.span(K.dark, -1.2, 1.2, F1, F1 + 2.5, -1.02, -0.98);
  P.solid(roomX0, F1, z0, roomX0 + 0.5, F1 + 4, -8.6);
  P.solid(roomX0, F1, -6.4, roomX0 + 0.5, F1 + 4, -1);
  P.solid(roomX0, F1, -1.5, x1, F1 + 4, -1);
  // Mahakaleshwar: a lingam on a square pitha on the room's axis
  B.span(K.blackStone, -0.55, 0.55, F1, F1 + 0.32, -12.55, -11.45);
  B.lathe(K.lingam, [[0, 0], [0.17, 0], [0.17, 0.25], [0.12, 0.38], [0, 0.42]], 0, F1 + 0.32, -12, 24);
  // dressed in red cloth, under a blue LED-outlined arch (darshan videos)
  B.lathe(K.redCloth, [[0, 0], [0.185, 0], [0.19, 0.12], [0.18, 0.24], [0.13, 0.27], [0, 0.27]], 0, F1 + 0.32, -12, 24);
  B.add(K.ledBlue, new THREE.TorusGeometry(0.7, 0.018, 6, 40, Math.PI).translate(0, F1 + 0.9, -12.7));
  for (const x of [-0.7, 0.7]) B.span(K.ledBlue, x - 0.018, x + 0.018, F1, F1 + 0.9, -12.718, -12.682);
  {
    const sign = (lines: string[], bg: string, fg: string, w: number, h: number) => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = Math.round((512 * h) / w);
      const c = cv.getContext('2d')!;
      c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      let px = Math.round(cv.height / (lines.length + 0.6));
      const font = () => `bold ${px}px "Noto Sans Devanagari", sans-serif`;
      c.font = font();
      while (px > 8 && Math.max(...lines.map((t) => c.measureText(t).width)) > cv.width * 0.92) { px--; c.font = font(); }
      lines.forEach((t, i) => c.fillText(t, cv.width / 2, (cv.height * (i + 0.5)) / lines.length));
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    };
    // over the shrine room's door from the terrace: the white board and the trust's blue strip
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), sign(['श्री महाकालेश्वर मंदिर'], '#f4f2ec', '#c4161c', 2.2, 0.5));
    board.rotation.y = -Math.PI / 2;
    board.position.set(roomX0 - 0.03, F1 + 2.75, -7.5);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.2), sign(['श्री ओंकारेश्वर मंदिर ट्रस्ट, ओंकारेश्वर'], '#1f4fa8', '#ffffff', 2.2, 0.2));
    strip.rotation.y = -Math.PI / 2;
    strip.position.set(roomX0 - 0.03, F1 + 3.15, -7.5);
    g.add(board, strip);
  }
  B.span(K.blackStone, 0.55, 0.95, F1 + 0.22, F1 + 0.3, -12.08, -11.92);
  P.solid(-0.7, F1, -12.7, 0.7, F1 + 1, -11.3);
  flames.points.push(new THREE.Vector3(-0.75, F1 + 0.85, -11.4), new THREE.Vector3(0.75, F1 + 0.85, -11.4));
  {
    const l = new THREE.PointLight(0xffc98a, 3, 9, 1.6);
    l.position.set(0, F1 + 2.4, -10);
    g.add(l);
  }
  // verandah: a row of slender pillars at the front with a railing, and a terrace parapet
  const verandah = new Instances(pillarGeo, K.oldPlain);
  for (let x = roomX0 + 0.8; x <= x1 - 0.5; x += 2.45) {
    verandah.at(x, F1, z1 - 0.4, 0.42, 3.6 / 3.92, 0.42);
    P.solid(x - 0.25, F1, z1 - 0.65, x + 0.25, F1 + 3.5, z1 - 0.15);
  }
  verandah.flush(g);
  pipeRail(B, K.steel, posts, x0, z1 - 0.1, x1, z1 - 0.1, F1, 1.0);
  pipeRail(B, K.steel, posts, x0 - 0.3, z0, x0 - 0.3, z1, F1, 1.0);
  P.solid(x0, F1, z1 - 0.15, x1, F1 + 1.1, z1 + 0.1);
  P.solid(x0 - 0.5, F1, z0, x0 - 0.2, F1 + 1.1, z1);
  P.solid(x1, F1, z0, x1 + 0.3, F1 + 1.1, z1);
  B.span(K.oldPlain, roomX0, x1, 8.5, 8.9, -1, z1 + 0.3);
  eave(B, K.oldPlain, (roomX0 + x1) / 2, (z0 + z1) / 2, x1 - roomX0, z1 - z0, 8.6, 0.55, 0.35);
  // the stair hole in the first floor (visual: a dark well) and its guard
  B.span(K.oldPlain, SX0, SX1 + 0.12, F1, F1 + 0.9, -2.7, -2.5);
  B.span(K.oldPlain, SX1 + 0.02, SX1 + 0.14, F1, F1 + 0.9, -6.9, -2.5);
  P.solid(SX0 - 0.2, F1, -2.8, SX1 + 0.12, F1 + 1, -2.4);
  // stone roof slab of the terrace part and the room roof
  B.span(K.oldPlain, roomX0, x1, 8.9, 9.3, z0, -1);

  // ---------- the open pavilion on the first-floor roof, facing the river (c02, c09) ----------
  {
    const py = 8.9, ph = 2.6;
    // today painted salmon pink like the galleries: a colonnade of six with a balustrade on its roof, a smaller
    // second tier, domed kiosks at its corners and a big silver trishul on the front
    const pv = new Instances(pillarGeo, K.pink);
    for (const x of [-5.0, -3.0, -1.0, 1.0, 3.0, 5.0]) for (const z of [-0.25, 2.0]) pv.at(x, py, z, 0.3, ph / 3.92, 0.3);
    const p2 = py + ph + 0.3, ph2 = 2.0;
    for (const x of [-2.0, -0.7, 0.7, 2.0]) for (const z of [0.1, 1.6]) pv.at(x, p2, z, 0.24, ph2 / 3.92, 0.24);
    pv.flush(g);
    B.span(K.pink, -5.6, 5.6, py + ph, p2, -0.6, 2.6);
    eave(B, K.pinkDark, 0, 1.0, 11.2, 3.2, py + ph + 0.25, 0.45, 0.28);
    for (let x = -5.4; x < 5.4; x += 0.36) B.span(K.pinkCarved, x, x + 0.12, p2, p2 + 0.6, 2.4, 2.52);
    B.span(K.pink, -5.6, 5.6, p2 + 0.6, p2 + 0.72, 2.32, 2.6);
    B.span(K.pink, -2.5, 2.5, p2 + ph2, p2 + ph2 + 0.25, -0.2, 1.9);
    eave(B, K.pinkDark, 0, 0.85, 5.0, 2.1, p2 + ph2 + 0.22, 0.35, 0.22);
    const dome: [number, number][] = [[0, 0], [1.0, 0], [1.0, 0.15], [0.95, 0.3], [0.85, 0.6], [0.6, 0.9], [0.3, 1.05], [0.08, 1.15], [0.06, 1.4], [0, 1.45]];
    B.lathe(K.pink, dome, 0, p2 + ph2 + 0.25, 0.85, 20);
    for (const x of [-5.0, 5.0]) {
      for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) B.span(K.pink, x + dx - 0.07, x + dx + 0.07, p2, p2 + 1.2, 1.0 + dz - 0.07, 1.0 + dz + 0.07);
      B.span(K.pink, x - 0.65, x + 0.65, p2 + 1.2, p2 + 1.35, 0.35, 1.65);
      B.lathe(K.pinkDark, dome.map(([r, y]) => [r * 0.62, y * 0.62] as [number, number]), x, p2 + 1.35, 1.0, 14);
    }
    // the trishul, on a pole before the upper tier
    B.span(K.silverRep, -0.035, 0.035, p2, p2 + 2.7, 2.15, 2.22);
    B.span(K.silverRep, -0.42, 0.42, p2 + 2.0, p2 + 2.07, 2.15, 2.22);
    for (const x of [-0.42, 0, 0.42]) B.add(K.silverRep, new THREE.ConeGeometry(0.06, x === 0 ? 0.9 : 0.6, 4).translate(x, p2 + 2.07 + (x === 0 ? 0.45 : 0.3) + (x === 0 ? 0.6 : 0), 2.18));
  }

  // ---------- second floor (Siddhnath) and the spire base platform ----------
  B.span(K.oldStone, -7.6, 7.6, 9.3, 12.2, -14.6, -0.6);
  for (const x of [-5, -2.5, 0, 2.5, 5]) B.span(K.dark, x - 0.45, x + 0.45, 10.0, 11.6, -0.62, -0.5);
  for (const z of [-12, -9, -6, -3]) for (const x of [-7.62, 7.5]) B.span(K.dark, x, x + 0.12, 10.0, 11.6, z - 0.45, z + 0.45);
  B.span(K.oldPlain, -8.2, 8.2, 12.2, SHIKHARA.y0, -15.2, 0.0);
  eave(B, K.oldPlain, 0, -7.6, 15.2, 14.0, 12.0, 0.5, 0.3);

  // ---------- the shikhara ----------
  const { x: sx, z: sz, y0, hw, H } = SHIKHARA;
  // the plinth storey of the spire (Gupteshwar inside): the same offset plan as the spire, carved,
  // with a moulded base and cornice and a niche on the centre of every face (photograph: builder ref 40)
  const plinthH = 2.4;
  const planAt = (k: number): [number, number][] => planPts().map((p) => [sx + p.x * hw * k, sz + p.y * hw * k]);
  B.prism(K.shikharaPlain, planAt(1.12), y0, y0 + 0.35);
  B.prism(K.shikhara, planAt(1.04), y0 + 0.35, y0 + plinthH - 0.3);
  B.prism(K.shikharaPlain, planAt(1.1), y0 + plinthH - 0.3, y0 + plinthH);
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2, nx = Math.cos(a), nz = Math.sin(a), d = hw * 1.04 * 1.042;
    const niche = new THREE.BoxGeometry(0.08, 1.2, 0.8).rotateY(-a).translate(sx + nx * d, y0 + 1.25, sz + nz * d);
    B.add(K.dark, niche);
    // a weathered stele in the niche (no carved face)
    const stele = new THREE.CapsuleGeometry(0.2, 0.55, 4, 10).scale(1, 1, 0.5).rotateY(-a).translate(sx + nx * (d - 0.02), y0 + 1.2, sz + nz * (d - 0.02));
    B.add(K.oldStone, stele);
    const lintel = new THREE.BoxGeometry(0.2, 0.18, 1.1).rotateY(-a).translate(sx + nx * (d + 0.05), y0 + 1.95, sz + nz * (d + 0.05));
    B.add(K.shikharaPlain, lintel);
  }
  const sh = shikharaGeometry(hw, H - plinthH - 3.2, 13);
  sh.geo.translate(sx, y0 + plinthH, sz);
  const shMesh = new THREE.Mesh(worldUV(sh.geo), K.shikhara);
  shMesh.castShadow = shMesh.receiveShadow = true;
  g.add(shMesh);
  // a small window/dormer (Dhwajeshwar's opening) on the south face, half way up
  const dormerY = y0 + plinthH + (H - plinthH - 3.2) * 0.42;
  const dormerW = hw * (1 - 0.55 * Math.pow(0.42, 2.2)) * 1.1;
  B.span(K.shikharaPlain, sx - 0.9, sx + 0.9, dormerY, dormerY + 2.0, sz + dormerW - 0.6, sz + dormerW + 0.25);
  B.span(K.dark, sx - 0.45, sx + 0.45, dormerY + 0.2, dormerY + 1.5, sz + dormerW + 0.25, sz + dormerW + 0.27);
  // crown: griva, ribbed amalaka, chandrika, kalash, the dhwaja pole
  const topY = y0 + H - 3.2;
  // a stepped shoulder slab closes the broad top, then a smaller griva and amalaka
  B.prism(K.shikharaPlain, planAt(sh.topHalf / hw * 1.02), topY - 0.05, topY + 0.35);
  B.prism(K.shikharaPlain, planAt(sh.topHalf / hw * 0.8), topY + 0.35, topY + 0.65);
  const tw = sh.topHalf * 0.62;
  const amal: [number, number][] = [[0, 0], [tw * 1.0, 0], [tw * 0.8, 0.12], [tw * 0.7, 0.4]];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    amal.push([tw * 0.7 + Math.cos(a) * tw * 0.42, 0.4 + 0.45 + Math.sin(a) * 0.45]);
  }
  amal.push([tw * 0.55, 1.36], [tw * 0.78, 1.46], [tw * 0.7, 1.56], [0, 1.56]);
  const crown = new THREE.LatheGeometry(amal.map(([a, b]) => new THREE.Vector2(a, b)), 28);
  const cp = crown.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    if (y > 0.42 && y < 1.3) {
      const k = 1 + Math.pow(Math.abs(Math.cos(Math.atan2(cp.getZ(i), cp.getX(i)) * 14)), 4) * 0.07;
      cp.setX(i, cp.getX(i) * k);
      cp.setZ(i, cp.getZ(i) * k);
    }
  }
  crown.computeVertexNormals();
  crown.translate(sx, topY + 0.65, sz);
  B.add(K.shikharaPlain, crown);
  const kal: [number, number][] = [[0, 0], [0.3, 0], [0.34, 0.08], [0.22, 0.14], [0.42, 0.34], [0.44, 0.48], [0.3, 0.64], [0.16, 0.7], [0.24, 0.78], [0.12, 0.86], [0.16, 0.96], [0.06, 1.08], [0, 1.15]];
  B.lathe(K.gold, kal, sx, topY + 0.65 + 1.56, sz, 24);
  const flag = new Flag(g, K.steel, K.saffron, sx + 0.5, topY + 1.8, sz, 5.5);

  // ---------- the stair-well rail at the hall front and solid round the first-floor stair top ----------
  void rekhaGeometry;
  posts.flush(g, false);
  pil.flush(g);
  pilPink.flush(g);
  pilSoot.flush(g);
  B.flush(g);
  return { group: g, flag };
}

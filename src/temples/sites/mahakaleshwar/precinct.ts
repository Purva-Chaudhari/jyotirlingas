import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { worldUV, waterNormals, scanMaterial } from '../../engine/materials';
import { weather } from './mats';
import { courtyardPaving, treePlatform, queueCanopy } from './courtyard';
import { buildCrowd, CrowdSpots } from './crowd';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { buildUjjain } from './ujjain';
import { Physics, box, columns, archRow, chhajja, garland, balustrade, type Flames } from '../../engine/kit';
import { peepal, nagaraShrine, buildMiniSpires, ribbedDome, gateway, canopyTrees, courtyardClutter, pagodaTent, coneTent } from './surroundings';

/** The temple precinct around Mahakaleshwar: courtyard, side shrines, Kotitirtha kund, trees, enclosing arcades. */

const COURT = { x0: -62, x1: 34, z0: -44, z1: 40 };
let seed = 4242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const KUND = { cx: -34, cz: -14, half: 11 };
const STAIR = { x0: 10, x1: 12.2, z0: 3, z1: 11 };

export function buildComplex(root: THREE.Group, M: Materials, P: Physics, flames: Flames, sunDir: THREE.Vector3, pending?: Promise<unknown>[],
  /** extra openings in the paving [x0, x1, z0, z1] (the darshan route's ramps; the stair or the mandapam below the hall) */
  holes: [number, number, number, number][] = [[-1.1, 1.1, -0.68, 5.2]]) {
  const g = new THREE.Group();
  g.name = 'precinct';
  root.add(g);

  // ---------- courtyard paving with openings for the kund and the sanctum stair ----------
  const s = new THREE.Shape();
  s.moveTo(COURT.x0, -COURT.z1); s.lineTo(COURT.x1, -COURT.z1); s.lineTo(COURT.x1, -COURT.z0); s.lineTo(COURT.x0, -COURT.z0);
  const rectHole = (x0: number, x1: number, z0: number, z1: number) => {
    const h = new THREE.Path();
    h.moveTo(x0, -z1); h.lineTo(x0, -z0); h.lineTo(x1, -z0); h.lineTo(x1, -z1); h.lineTo(x0, -z1);
    return h;
  };
  s.holes.push(rectHole(KUND.cx - KUND.half, KUND.cx + KUND.half, KUND.cz - KUND.half, KUND.cz + KUND.half));
  s.holes.push(rectHole(STAIR.x0, STAIR.x1, STAIR.z0, STAIR.z1));
  // the main stair (or the Ganesh Mandapam) below the temple, and the darshan route's ramps
  for (const [x0, x1, z0, z1] of holes) s.holes.push(rectHole(x0, x1, z0, z1));
  const pg = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  pg.computeVertexNormals();
  const paving = new THREE.Mesh(worldUV(pg, 4.8), courtyardPaving());
  paving.receiveShadow = true;
  g.add(paving);
  P.floors.push(paving);
  // (the ground beyond the precinct, the town, Rudra Sagar and Mahakal Lok: ujjain.ts, from OpenStreetMap)

  buildWestHall(g, M, P);
  const water = buildKund(g, M, P, flames, sunDir);
  buildTrees(g, M, P);
  buildEnclosure(g, M, P, pending);
  // the great peepal on its platform (right of the temple) and the steel queue canopy (left)
  treePlatform(g, P, 16.5, -2.5);
  peepal(g, P, 16.5, -2.5, 17.5, pending);
  // steel queue barricades from the south gate to the front steps, and coloured shade cloths over them
  courtyardClutter(g, P,
    [[-6.6, 36, -6.6, 16], [-1.6, 36, -1.6, 22], [-6.6, 16, -4.2, 13.6]],
    // small, high (4.8 m) and off the spawn view and the approach to the front steps
    [[14, 8.5, 18.5, 12, 2], [-30, 18.5, -26, 21.5, 3]]);
  // white pagoda tents near the front, right of the approach (temple_front_2025)
  pagodaTent(g, P, 9.8, 22.5);
  pagodaTent(g, P, 13.8, 25.5, 1.6);
  // the big round white cone tent right of the approach (temple_front_2025, foreground)
  coneTent(g, P, 8.2, 17.5, 2.6);
  // the dense broadleaf canopy along the north and east of the courtyard (aerial_1-3)
  canopyTrees(g, P, [
    [-56, -35, 11], [-20, -34.5, 10], [-13, -35.5, 12], [10, -34, 11], [18, -35, 12.5], [26, -33, 10.5],
    [26.5, -22, 12], [27, -12, 10], [26.5, 16, 11.5], [27, 34, 10],
  ], pending);
  queueCanopy(g, P, -14, 12, 30, 3.6);
  // pilgrims (temple_front_2025: the court is never empty): a two-abreast queue inside the steel barricades,
  // a single file under the queue canopy, and loose groups by the west hall, the kund and the gate —
  // all kept ≥4 m from the spawn and the walk from it to the front steps
  const cs = new CrowdSpots(31);
  cs.queue(new THREE.Vector3(-5.2, 0, 35), new THREE.Vector3(-5.2, 0, 17), 0.58, 3);
  cs.queue(new THREE.Vector3(-14, 0, 29.5), new THREE.Vector3(-14, 0, 12.5), 0.65, 1);
  cs.scatter(-21, -10, 8.6, 11.5, 0, 9, Math.PI, 0.2);
  cs.scatter(-44, -24, 0.8, 3.5, 0.0, 10, Math.PI, 0.3, (x, z) => x > KUND.cx - KUND.half - 0.5 && x < KUND.cx + KUND.half + 0.5 && z < KUND.cz + KUND.half + 1.2);
  cs.scatter(-30, -12, 31, 35, 0, 12, Math.PI / 2, 0.1);
  cs.scatter(12, 24, 14, 20, 0, 8, -Math.PI / 2, 0.15, (x, z) => Math.hypot(x - 17, z - 16) < 1.5);
  // the dense crowd massed before the temple (temple_front_2025): either side of the approach, ≥4 m from it
  cs.scatter(-12, -7.2, 10.4, 15.6, 0, 34, Math.PI, 0.05);
  cs.scatter(4.6, 9.5, 10.2, 13.8, 0, 22, Math.PI, 0.05);
  cs.scatter(10, 15.5, 12.5, 21, 0, 22, Math.PI * 0.85, 0.05, (x, z) => Math.hypot(x - 8.2, z - 17.5) < 3.1 || Math.hypot(x - 17, z - 16) < 1.5);
  // the real town round the precinct, Rudra Sagar, Shri Mahakal Lok and Harsiddhi (adds their pilgrims to cs)
  const ujjain = buildUjjain(root, g, P, pending, COURT, cs);
  const pilgrims = buildCrowd(g, cs.list, { clearPaths: [[[1.5, 28], [0, 11], [0, 6]], [[-2, -64], [-2, -44]]], clearRadius: 4, seed: 57, kanwariyaShare: 0.15 });
  const crowd = { update(t: number) { pilgrims.update(t); ujjain.update(t); } };
  return { group: g, water, crowd };
}

// ---------- pillared hall west of the temple, with white shrine roofs ----------

function buildWestHall(g: THREE.Group, M: Materials, P: Physics) {
  const x0 = -21, x1 = -9.6, z0 = -3, z1 = 8;
  box(g, M.plaster, x1 - x0, 0.5, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, P);
  P.floor(g, x0, x1, z0, z1, 0.5);
  const front: [number, number][] = [-20.5, -18.3, -16.1, -13.9, -11.7, -10.1].map((x) => [x, 7.6]);
  columns(g, M.plaster, front, 0.5, 3.4, 0.2, P);
  archRow(g, M.plaster, front, 0.5, 3.4, 0.24, 0.2);
  box(g, M.plaster, x1 - x0, 3.4, 0.4, (x0 + x1) / 2, 0.5, z0 + 0.2, P);
  box(g, M.plaster, 0.4, 3.4, z1 - z0, x0 + 0.2, 0.5, (z0 + z1) / 2, P);
  box(g, M.plaster, x1 - x0 + 0.4, 0.4, z1 - z0 + 0.4, (x0 + x1) / 2, 3.9, (z0 + z1) / 2);
  const roof = new THREE.Group();
  roof.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.add(roof);
  chhajja(roof, M.plaster, x1 - x0 + 0.4, z1 - z0 + 0.4, 4.3, 0.9, 0.5);
  // ribbed Maratha lotus domes (cm19-22), not smooth beehives
  ribbedDome(g, M.plaster, -18.4, 4.3, 4.2, 2.0, 20);
  // the cluster of cream Nagara spires rising just left of the temple in the front view (temple_front_2025)
  {
    const fl = new THREE.MeshStandardMaterial({ color: 0xe8500e, side: THREE.DoubleSide, roughness: 0.8 });
    const sm2 = { white: M.plaster, gold: M.gold, flag: fl, dark: M.velvet };
    for (const [x, z, h] of [[-12.4, 4.6, 7.2], [-14.8, 0.2, 6.2], [-11.6, -0.8, 5.4], [-17.2, 0.6, 5.0]] as const) nagaraShrine(g, P, x, z, h, 0, sm2, 4.3);
  }
  for (let i = 0; i < 5; i++) {
    garland(g, M.marigold, new THREE.Vector3(front[i][0], 3.6, 7.75), new THREE.Vector3(front[i + 1][0], 3.6, 7.75), 0.4);
  }

  // cream-white Nagara shrines with curvilinear spires and saffron flags (temple_front_2025 left, cm24)
  const flag = new THREE.MeshStandardMaterial({ color: 0xe8500e, side: THREE.DoubleSide, roughness: 0.8 });
  const sm = { white: M.plaster, gold: M.gold, flag, dark: M.velvet };
  for (const [x, z, h] of [[-27, 12, 5.0], [-31.5, 12, 4.2], [-36, 12, 4.6], [-40.5, 12, 3.8], [-22, 13.5, 3.6], [24, -16, 4.4]] as const) {
    nagaraShrine(g, P, x, z, h, 0, sm);
  }
  // more shrines round the edges of the court (cm24, temple_front_2025 left): spires and domed kiosks
  for (const [x, z, h] of [[-34, 30, 4.2], [-40, 30, 5.2], [-46, 30, 3.8], [-52, 30, 4.6], [14, 32, 4.0], [19, 32, 4.8], [-56, -10, 4.4], [-56, -2, 3.8]] as const) {
    nagaraShrine(g, P, x, z, h, x < -54 ? Math.PI / 2 : Math.PI, sm);
  }
  buildMiniSpires(g, M.gold, M.velvet);
  for (const [x, z] of [[-52, 18], [-30, 34.5], [22, -24]] as const) {
    box(g, M.plaster, 2.4, 0.4, 2.4, x, 0, z, P);
    columns(g, M.plaster, [[x - 0.9, z - 0.9], [x + 0.9, z - 0.9], [x - 0.9, z + 0.9], [x + 0.9, z + 0.9]], 0.4, 2.0, 0.09, P);
    box(g, M.plaster, 2.5, 0.2, 2.5, x, 2.4, z);
    ribbedDome(g, M.plaster, x, 2.6, z, 1.0, 18);
  }
}

// ---------- Kotitirtha kund ----------

function buildKund(g: THREE.Group, M: Materials, P: Physics, flames: Flames, sunDir: THREE.Vector3) {
  const { cx, cz, half } = KUND;
  // stepped ghats: eight 0.3 m steps with 0.35 m treads down to the water
  const inset = 0.35, drop = 0.3, bottom = -3.6, NS = 8;
  const halves = Array.from({ length: NS + 1 }, (_, k) => half - inset * k);
  for (let k = 0; k < NS; k++) {
    const ho = halves[k], hi = halves[k + 1], top = -drop * (k + 1);
    const h = top - bottom, w = ho - hi;
    const parts = [
      box(g, M.kundStone, ho * 2, h, w, cx, bottom, cz - (ho - w / 2), undefined, 2),
      box(g, M.kundStone, ho * 2, h, w, cx, bottom, cz + (ho - w / 2), undefined, 2),
      box(g, M.kundStone, w, h, hi * 2, cx - (ho - w / 2), bottom, cz, undefined, 2),
      box(g, M.kundStone, w, h, hi * 2, cx + (ho - w / 2), bottom, cz, undefined, 2),
    ];
    P.floors.push(...parts);
    // riser faces go down from courtyard level: walls above this terrace
    if (k === 0) {
      const lip = 0.35;
      box(g, M.kundStone, half * 2 + 0.6, lip, 0.3, cx, 0, cz - half - 0.15);
      box(g, M.kundStone, half * 2 + 0.6, lip, 0.3, cx, 0, cz + half + 0.15);
      box(g, M.kundStone, 0.3, lip, half * 2, cx - half - 0.15, 0, cz);
      box(g, M.kundStone, 0.3, lip, half * 2, cx + half + 0.15, 0, cz);
    }
  }
  box(g, M.kundStone, halves[NS] * 2, 0.2, halves[NS] * 2, cx, bottom - 0.2, cz);
  const water = new Water(new THREE.PlaneGeometry(halves[NS - 1] * 2, halves[NS - 1] * 2), {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: sunDir.clone(),
    sunColor: 0xffd9a0, waterColor: 0x34442a, distortionScale: 0.9, fog: true, alpha: 0.95,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, -2.25, cz);
  g.add(water);
  P.solid(cx - halves[NS - 1], bottom, cz - halves[NS - 1], cx + halves[NS - 1], -2.0, cz + halves[NS - 1]);

  // trishul fountain rising from the water: rose-copper, with a fine spray
  const copper = new THREE.MeshStandardMaterial({ color: 0xb8705a, metalness: 0.8, roughness: 0.35 });
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  spray.position.set(cx, -2.25 + 1.7, cz);
  spray.rotation.x = Math.PI;
  g.add(spray);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 12), copper);
  pole.position.set(cx, -2.4 + 2.1, cz);
  g.add(pole);
  const prong = (x: number, h: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.09, h, 8), copper);
    m.position.set(cx + x, -2.4 + 4.2 + h / 2, cz);
    g.add(m);
  };
  prong(0, 1.1);
  const bar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24, Math.PI), copper);
  bar.rotation.z = Math.PI;
  bar.position.set(cx, -2.4 + 4.35, cz);
  g.add(bar);
  prong(-0.5, 0.8);
  prong(0.5, 0.8);
  const damaru = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), M.brass);
  damaru.position.set(cx, -2.4 + 3.4, cz);
  g.add(damaru);

  // chhatris along the north and west edges of the kund
  for (let i = 0; i < 6; i++) {
    const x = cx - half + 2 + i * ((half * 2 - 4) / 5), z = cz - half - 2.2;
    chhatri(g, M, P, x, z);
  }
  for (let i = 1; i < 5; i++) chhatri(g, M, P, cx - half - 2.2, cz - half + 2 + i * ((half * 2 - 4) / 5));

  // a balustrade round the rim, with potted plants on the south side
  balustrade(g, PINK, [cx - half, cz + half + 0.15], [cx + half, cz + half + 0.15], 0.35, 0.8, P);
  balustrade(g, PINK, [cx + half + 0.15, cz - half], [cx + half + 0.15, cz + half], 0.35, 0.8, P);
  const pot = new THREE.MeshStandardMaterial({ color: 0x9a4a2c, roughness: 0.9 });
  const bush = new THREE.MeshStandardMaterial({ color: 0x3d6a2a, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const x = cx - half + 1.5 + i * ((half * 2 - 3) / 7);
    const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.45, 10), pot);
    pm.position.set(x, 0.58, cz + half + 0.75);
    const bm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), bush);
    bm.position.set(x, 1.05, cz + half + 0.75);
    g.add(pm, bm);
  }

  // diyas along the kund's top edge
  for (let i = 0; i <= 40; i++) {
    const t = -half + (i / 40) * half * 2;
    flames.points.push(new THREE.Vector3(cx + t, 0.38, cz + half + 0.15), new THREE.Vector3(cx + half + 0.15, 0.38, cz + t));
  }
  return water;
}

/** Pink sandstone of the kund's chhatris and balustrades (cm29). */
const PINK = new THREE.MeshStandardMaterial({ color: 0xd9a48c, roughness: 0.8 });

function chhatri(g: THREE.Group, _M: Materials, P: Physics, x: number, z: number) {
  const r = 1.0;
  box(g, PINK, 2.6, 0.4, 2.6, x, 0, z, P);
  columns(g, PINK, [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]], 0.4, 2.2, 0.1, P);
  box(g, PINK, 2.7, 0.25, 2.7, x, 2.6, z);
  ribbedDome(g, PINK, x, 2.85, z, 1.0, 16);
}

// ---------- trees ----------

/** Neem trees around the precinct: [x, z, height in metres]. Meshes are loaded in world.ts. */
export const TREE_SPOTS: [number, number, number][] = [
  // trimmed to the trees that are seen (each scanned tree is ~0.3 M triangles)
  [24, 6, 11], [17, 16, 9.5], [-26, -2, 10.5], [26, 28, 10.5],
];

function buildTrees(_g: THREE.Group, _M: Materials, P: Physics) {
  for (const [x, z] of TREE_SPOTS) P.solid(x - 0.5, 0, z - 0.5, x + 0.5, 6, z + 0.5);
}

// ---------- enclosing two-storey arcades ----------

function buildEnclosure(g: THREE.Group, M: Materials, P: Physics, pending?: Promise<unknown>[]) {
  const { x0, x1, z0, z1 } = COURT;
  // the walls' own weathered lime plaster: rain streaks from the coping, grime at the foot
  const wallScan = scanMaterial('painted_plaster_wall', 2.5, { tint: 0xe6dac6, normalScale: 0.8 });
  pending?.push(wallScan.loaded);
  const wallMat = wallScan.material;
  weather(wallMat, { mottle: 0.22, grime: 0.3, streak: 0.32, levels: [0] });
  const coping = new THREE.MeshStandardMaterial({ color: 0x9c8f80, roughness: 0.85 });
  const nicheMat = new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 0.95 });
  const niches: THREE.Matrix4[] = [], caps: THREE.Matrix4[] = [];
  // roof clutter on the arcade blocks (seen from the elevated views): parapets, stair heads, tanks, AC units
  const roofBoxes: THREE.Matrix4[] = [], roofTanks: THREE.Matrix4[] = [];
  const archGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.6, 0); sh.lineTo(-0.6, 1.5); sh.quadraticCurveTo(-0.6, 2.2, 0, 2.3); sh.quadraticCurveTo(0.6, 2.2, 0.6, 1.5); sh.lineTo(0.6, 0); sh.lineTo(-0.6, 0);
    return new THREE.ShapeGeometry(sh, 6);
  })();
  const wing = (ax: number, az: number, bx: number, bz: number, inward: [number, number], gapFrom?: number, gapTo?: number, wallH = 8,
    /** an opening right through the back wall [x0, x1] (an along-x wing only): the north gate's way in */
    door?: [number, number]) => {
    const len = Math.hypot(bx - ax, bz - az);
    const dirX = (bx - ax) / len, dirZ = (bz - az) / len;
    const bays = Math.floor(len / 3.2);
    const pts: [number, number][] = [];
    for (let i = 0; i <= bays; i++) {
      const t = (i / bays) * len;
      pts.push([ax + dirX * t + inward[0] * 2.2, az + dirZ * t + inward[1] * 2.2]);
    }
    const back = new THREE.Mesh(worldUV(new THREE.BoxGeometry(Math.abs(bx - ax) + 4.4 || 4.4, wallH, Math.abs(bz - az) + 4.4 || 4.4), 3), wallMat);
    back.position.set((ax + bx) / 2 - inward[0] * 1.5, wallH / 2, (az + bz) / 2 - inward[1] * 1.5);
    back.castShadow = back.receiveShadow = true;
    const bxs = Math.abs(bx - ax) + 4.4, bzs = Math.abs(bz - az) + 4.4 || 4.4;
    const wx0 = back.position.x - bxs / 2, wx1 = back.position.x + bxs / 2, wz = back.position.z;
    if (door) {
      // two lengths of wall either side of the doorway
      for (const [a, b] of [[wx0, door[0]], [door[1], wx1]] as const) {
        const part = new THREE.Mesh(worldUV(new THREE.BoxGeometry(b - a, wallH, bzs), 3), wallMat);
        part.position.set((a + b) / 2, wallH / 2, wz);
        part.castShadow = part.receiveShadow = true;
        g.add(part);
        P.solid(a, 0, wz - bzs / 2, b, 8, wz + bzs / 2);
      }
    } else {
      g.add(back);
      P.solid(wx0, 0, wz - bzs / 2, wx1, 8, wz + bzs / 2);
    }
    {
      const lx = Math.abs(bx - ax) + 4.4 || 4.4, lz = Math.abs(bz - az) + 4.4 || 4.4, ty = wallH + 0.3;
      const cx = back.position.x, cz = back.position.z, alongX = lx > lz, L = Math.max(lx, lz), D = Math.min(lx, lz);
      const at = (u: number, v: number) => (alongX ? new THREE.Vector3(cx + u, 0, cz + v) : new THREE.Vector3(cx + v, 0, cz + u));
      const scl = (a: number, h: number, b: number) => (alongX ? new THREE.Vector3(a, h, b) : new THREE.Vector3(b, h, a));
      for (const sv of [-1, 1]) roofBoxes.push(new THREE.Matrix4().compose(at(0, sv * (D / 2 - 0.1)).setY(ty), new THREE.Quaternion(), scl(L, 0.85, 0.2)));
      for (let u = -L / 2 + 6; u < L / 2 - 6; u += 9 + rnd() * 10) {
        const kind = rnd();
        const v = (rnd() - 0.5) * (D - 2);
        if (kind < 0.25) roofBoxes.push(new THREE.Matrix4().compose(at(u, v).setY(ty), new THREE.Quaternion(), scl(2.6, 2.3, 2.4)));
        else if (kind < 0.7) for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) roofTanks.push(new THREE.Matrix4().compose(at(u + k * 1.3, v).setY(ty), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + rnd() * 0.3)));
        else roofBoxes.push(new THREE.Matrix4().compose(at(u, v).setY(ty), new THREE.Quaternion(), scl(0.9, 0.6, 0.4)));
      }
    }
    // stone coping and a string course
    for (const [yy, hh, grow] of [[wallH, 0.3, 0.3], [3.95, 0.18, 0.12]] as const) {
      const cp = new THREE.Mesh(new THREE.BoxGeometry((Math.abs(bx - ax) || 0) + 4.4 + grow, hh, (Math.abs(bz - az) || 0) + 4.4 + grow), coping);
      cp.position.set(back.position.x, yy + hh / 2, back.position.z);
      cp.receiveShadow = true;
      g.add(cp);
    }
    // a row of arched niches on the inner face above the arcade roof (blind gallery), every bay
    if (wallH > 6) {
      const ry = Math.atan2(inward[0], inward[1]);
      for (let i = 0; i < bays; i++) {
        const t = ((i + 0.5) / bays) * len;
        const px = ax + dirX * t + inward[0] * 0.73, pz = az + dirZ * t + inward[1] * 0.73;
        niches.push(new THREE.Matrix4().compose(new THREE.Vector3(px, 4.6, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
        caps.push(new THREE.Matrix4().compose(new THREE.Vector3(px + inward[0] * 0.08, 4.55, pz + inward[1] * 0.08), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1.6, 0.1, 0.25)));
      }
    }
    // arcade roof between the columns and the back wall
    const along = Math.abs(bx - ax) > Math.abs(bz - az);
    // (split round the gateway gap, so the arcade roof doesn't cut across the gate passage)
    const spans: [number, number][] = gapFrom === undefined ? [[0, len]] : [[0, gapFrom - 1.2], [gapTo! + 1.2, len]];
    for (const [t0, t1] of spans) {
      const sl = t1 - t0, mid = (t0 + t1) / 2;
      const slab = new THREE.Mesh(worldUV(new THREE.BoxGeometry(along ? sl : 2.4, 0.4, along ? 2.4 : sl), 3), M.plaster);
      slab.position.set(ax + dirX * mid + inward[0] * 1.3, 3.8, az + dirZ * mid + inward[1] * 1.3);
      slab.castShadow = slab.receiveShadow = true;
      g.add(slab);
    }
    const keep = pts.filter(([x, z]) => {
      const along = (x - ax) * dirX + (z - az) * dirZ;
      return gapFrom === undefined || along < gapFrom || along > gapTo!;
    });
    columns(g, M.plaster, keep, 0, 3.6, 0.2, P);
    // arches only between neighbouring kept columns
    for (let i = 0; i < keep.length - 1; i++) {
      if (Math.hypot(keep[i + 1][0] - keep[i][0], keep[i + 1][1] - keep[i][1]) < 3.5) archRow(g, M.plaster, [keep[i], keep[i + 1]], 0, 3.6, 0.24, 0.2);
    }
  };
  // the north side is low too, with a gate, so the red-sandstone colonnade of Mahakal Lok shows beyond it
  // (it is the way in from Mahakal Lok: the gate's arch runs right through the wall)
  wing(x0 + 2, z0 + 2, x1 - 2, z0 + 2, [0, 1], 52, 64, 4.6, [-5.9, 1.9]);
  gateway(g, -2, z0 + 3.8, { plaster: wallMat, red: new THREE.MeshStandardMaterial({ color: 0xa8402c, roughness: 0.8 }), dark: new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.95 }) }, true, 6.65);
  // the gate's piers and the passage's side walls are solid
  for (const sx of [-1, 1]) {
    P.solid(-2 + sx * 5.6 - 1.1, 0, z0 + 2.7, -2 + sx * 5.6 + 1.1, 10, z0 + 4.9);
    P.solid(-2 + sx * 3.9 - (sx < 0 ? 0.3 : 0), 0, z0 - 1.8, -2 + sx * 3.9 + (sx > 0 ? 0.3 : 0), 5.2, z0 + 4.9);
  }
  // the south side is a low arcade with the main gateway, so the town shows above it from the court
  wing(x0 + 2, z1 - 2, x1 - 2, z1 - 2, [0, -1], 50, 62, 4.6);
  gateway(g, -4, z1 - 3.8, { plaster: M.plaster, red: new THREE.MeshStandardMaterial({ color: 0xa8402c, roughness: 0.8 }), dark: new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.95 }) });
  wing(x0 + 2, z0 + 2, x0 + 2, z1 - 2, [1, 0]);
  wing(x1 - 2, z0 + 2, x1 - 2, z1 - 2, [-1, 0]);
  {
    const rb = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 3), wallMat, roofBoxes.length);
    roofBoxes.forEach((m, i) => rb.setMatrixAt(i, m));
    rb.castShadow = rb.receiveShadow = true;
    const rt = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.6, 1.1, 12).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.6 }), roofTanks.length);
    roofTanks.forEach((m, i) => rt.setMatrixAt(i, m));
    g.add(rb, rt);
  }
  const ni = new THREE.InstancedMesh(archGeo, nicheMat, niches.length);
  niches.forEach((m, i) => ni.setMatrixAt(i, m));
  g.add(ni);
  const ci = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), coping, caps.length);
  caps.forEach((m, i) => ci.setMatrixAt(i, m));
  g.add(ci);
  // corner towers: tall square piers with a balcony band and a ribbed dome
  for (const [x, z] of [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x0 + 0.2, z1 - 0.2], [x1 - 0.2, z1 - 0.2]] as const) {
    box(g, wallMat, 4.6, 11, 4.6, x, 0, z, P);
    box(g, coping, 5.2, 0.35, 5.2, x, 11, z);
    box(g, coping, 5.0, 0.25, 5.0, x, 7.5, z);
    for (const [dx, dz] of [[2.32, 0], [-2.32, 0], [0, 2.32], [0, -2.32]] as const) {
      const n = new THREE.Mesh(archGeo, nicheMat);
      n.position.set(x + dx, 8.0, z + dz);
      n.rotation.y = Math.atan2(dx, dz);
      g.add(n);
    }
    ribbedDome(g, wallMat, x, 11.35, z, 1.9, 20);
  }
  // signage boards on the arcade piers (bilingual temple notices)
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x7a1a14, roughness: 0.7 });
  for (const [x, z, ry] of [[-30, z1 - 4.25, Math.PI], [14, z1 - 4.25, Math.PI], [x1 - 4.25, -10, -Math.PI / 2], [x1 - 4.25, 18, -Math.PI / 2], [x0 + 4.25, 22, Math.PI / 2]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.08), boardMat);
    b.position.set(x, 2.6, z);
    b.rotation.y = ry;
    g.add(b);
  }
}

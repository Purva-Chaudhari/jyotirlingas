import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import type { GM } from './mats';
import type { Merger } from './merge';
import { boxAt, bulbGeo, cyl } from './geo';
import { archPanel } from './sculpt';
import { villageTrees } from './trees';
import { lathe } from './offerings';
import type { Offerings } from './offerings';

/**
 * The temple court and its setting.
 *  - Court ≈ 240 × 185 ft (73 × 56 m), paved with grey basalt flags, inside a high wall washed
 *    orange-red; the main (south) gateway faces the village lane, a second gate on the east axis.
 *  - Small red-stone shrines with pyramidal roofs in the court, neem trees.
 *  - Verul village outside: a lane of lime-washed houses and tin-roofed pooja/flower stalls.
 *  - The Ellora (Charanandri) hills: flat-topped Deccan-trap scarps to the east–north-east, where the
 *    caves are cut, about a kilometre away.
 * Frame as temple.ts: +z = east, +x = north.
 */

export const COURT = { x0: -28, x1: 28, z0: -28, z1: 45 };
export const SOUTH_GATE = { z: 17.0, half: 1.5 };
/** the serpentine barricade queue in the court (x from qa to qb, lanes of lw from z0) */
export const SERPENT = { xa: -26, xb: -18.5, z0: -11.2, lanes: 4, lw: 1.25 };
export const EAST_GATE = { x: 0, half: 1.6 };
/**
 * Shivalaya tirth (Shiv kund): the great stepped tank of Verul where Ghushma immersed her lingas.
 * In reality a few hundred metres from the temple; here compressed to ≈80 m west, across the lane,
 * reached by a path from the south gate. ≈44 × 44 m, 12 flights of steps down to a green pool,
 * eight small shrines with curved pyramidal roofs on the terraces (photos 24_–55_).
 */
export const KUND = { x: -80, z: -10, half: 22, depth: 6, levels: 20, pool: 5.5 };

/** the photoscanned neem (engine) only for the great neem by the temple and two more in the court */
export const TREES: [number, number, number][] = [[-23, 8, 14], [21, -21, 10.5], [22, 38, 9]];
/** the rest of the trees, as instanced leaf-card canopies (trees.ts) */
const COURT_TREES: [number, number, number][] = [[-21, -20, 9.5], [-22, 36, 8.5], [19, 28, 7.5], [-20, 28, 8], [-23, -4, 7.5], [23, 4, 8.5]];
/** footprints of the village houses (for keeping trees out of them) */
const HOUSES: [number, number, number, number][] = [];

const r = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export function buildPrecinct(root: THREE.Object3D, B: Merger, K: GM, P: Physics, O: Offerings, V: Merger, outer: THREE.Object3D, pending: Promise<unknown>[]) {
  const { x0, x1, z0, z1 } = COURT;
  // ---------- court paving ----------
  B.span(K.courtPaving, x0, -0.1, z0, x1, 0.0, z1);

  // ---------- compound wall (orange lime-wash), with pilasters and coping ----------
  const H = 4.4, T = 0.8;
  const wallSeg = (ax0: number, az0: number, ax1: number, az1: number) => {
    B.span(K.compoundWall, ax0, -0.1, az0, ax1, H, az1, true);
    // a flat dressed-stone coping (c3)
    B.span(K.redDark, ax0 - 0.1, H, az0 - 0.1, ax1 + 0.1, H + 0.16, az1 + 0.1);
    B.span(K.redDark, ax0 - 0.02, H + 0.16, az0 - 0.02, ax1 + 0.02, H + 0.24, az1 + 0.02);
  };
  const sg = SOUTH_GATE, eg = EAST_GATE;
  // north wall
  wallSeg(x1, z0 - T, x1 + T, z1 + T);
  // south wall with the main gate
  wallSeg(x0 - T, z0 - T, x0, sg.z - 3.6);
  wallSeg(x0 - T, sg.z + 3.6, x0, z1 + T);
  // west wall
  wallSeg(x0, z0 - T, x1, z0);
  // east wall with its gate
  wallSeg(x0, z1, eg.x - 3.8, z1 + T);
  wallSeg(eg.x + 3.8, z1, x1, z1 + T);
  // pilasters every ~6 m, both faces
  for (let z = z0 + 3; z < z1; z += 6) {
    if (Math.abs(z - sg.z) < 5) continue;
    for (const [x, d] of [[x0 - T, -1], [x0, 1], [x1, -1], [x1 + T, 1]] as const) {
      B.span(K.compoundWall, d > 0 ? x : x - 0.25, -0.1, z - 0.3, d > 0 ? x + 0.25 : x, H + 0.1, z + 0.3);
    }
  }
  for (let x = x0 + 4; x < x1; x += 6) {
    if (Math.abs(x - eg.x) < 5) continue;
    for (const [z, d] of [[z0 - T, -1], [z0, 1], [z1, -1], [z1 + T, 1]] as const) {
      B.span(K.compoundWall, x - 0.3, -0.1, d > 0 ? z : z - 0.25, x + 0.3, H + 0.1, d > 0 ? z + 0.25 : z);
    }
  }

  // ---------- gateways ----------
  gateway(root, B, K, 'south');
  gateway(root, B, K, 'east');

  // ---------- small shrines in the court ----------
  shrine(B, K, P, -14.5, 30.0, 0);
  shrine(B, K, P, 15.5, -15.0, Math.PI);
  shrine(B, K, P, -16.0, -12.5, Math.PI / 2);
  // a tulsi vrindavan by the east steps
  B.span(K.limewash, 6.2, 0, 30.8, 7.4, 0.9, 32.0, true);
  B.span(K.houseWash, 6.1, 0.9, 30.7, 7.5, 1.0, 32.1);
  O.heap(6.8, 1.0, 31.4, 0.3, 0.25, 40);

  // the steel-framed tin queue shed from the south gate towards the temple (photos c4, c5)
  {
    const za = SOUTH_GATE.z - 2.0, zb = SOUTH_GATE.z + 2.0, xa = x0 + 1.0, xb = -11.5;
    for (let x = xa; x <= xb + 0.01; x += 3.0) {
      for (const z of [za, zb]) { B.add(K.steel, cyl(0.06, 0.06, 3.1, 6, x, 0, z)); P.solid(x - 0.08, 0, z - 0.08, x + 0.08, 3, z + 0.08); }
    }
    const roof = new THREE.BoxGeometry(xb - xa + 0.6, 0.05, zb - za + 1.0).rotateX(0.06).translate((xa + xb) / 2, 3.15, (za + zb) / 2).toNonIndexed();
    roof.deleteAttribute('uv');
    B.add(K.tinRoof, roof);
    // queue railings along the sanctum side, with gaps to cross
    for (let x = xa; x < xb - 1; x += 6) {
      const xe = Math.min(xb, x + 4.2);
      for (const y of [0.55, 1.0]) B.add(K.steel, cyl(0.025, 0.025, xe - x, 5, 0, 0, 0).rotateZ(Math.PI / 2).translate((x + xe) / 2, y, za + 0.3));
      P.solid(x, 0, za + 0.25, xe, 1.05, za + 0.35);
    }
  }
  // the tall steel trishul and damru in the east forecourt (photo n_o4)
  {
    const tx = -2, tz = 33;
    B.span(K.redDark, tx - 1.2, 0, tz - 1.2, tx + 1.2, 0.4, tz + 1.2, true);
    B.span(K.redDark, tx - 0.8, 0.4, tz - 0.8, tx + 0.8, 0.8, tz + 0.8, true);
    B.add(K.trishul, cyl(0.09, 0.08, 4.6, 16, tx, 0.8, tz));
    for (const yb of [1.2, 2.6, 4.0, 5.2]) B.add(K.trishul, cyl(0.12, 0.12, 0.08, 16, tx, yb, tz));
    // the three blades: leaf-shaped, the middle one tallest, springing from a crescent
    const blade = (dx: number, hgt: number, lean: number) => {
      const s2 = new THREE.Shape();
      s2.moveTo(-0.07, 0); s2.quadraticCurveTo(-0.12, hgt * 0.45, 0, hgt); s2.quadraticCurveTo(0.12, hgt * 0.45, 0.07, 0); s2.lineTo(-0.07, 0);
      const g2 = new THREE.ExtrudeGeometry(s2, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
      g2.translate(0, 0, -0.025).rotateZ(lean).translate(tx + dx, 5.55, tz);
      const n = g2.toNonIndexed(); n.deleteAttribute('uv'); B.add(K.trishul, n);
    };
    B.add(K.trishul, new THREE.TorusGeometry(0.55, 0.06, 8, 32, Math.PI).rotateZ(Math.PI).toNonIndexed().translate(tx, 5.75, tz));
    blade(-0.55, 0.85, 0.12); blade(0.55, 0.85, -0.12); blade(0, 1.25, 0);
    // the damaru tied below the blades: two drum-heads, a brass waist, saffron and red ribbons
    const drum = lathe([[0, 0], [0.3, 0], [0.32, 0.03], [0.1, 0.26], [0.1, 0.3], [0.32, 0.53], [0.3, 0.56], [0, 0.56]], 20);
    B.place(K.gold, drum, tx, 4.25, tz + 0.18);
    B.place(K.ash, cyl(0.3, 0.3, 0.012, 20, 0, 0, 0), tx, 4.81, tz + 0.18);
    B.place(K.ash, cyl(0.3, 0.3, 0.012, 20, 0, 0, 0), tx, 4.24, tz + 0.18);
    for (const [dx, len, m] of [[-0.06, 1.3, K.saffron], [0.05, 1.0, K.kumkum], [0.12, 1.5, K.saffron]] as const) {
      const rb = new THREE.PlaneGeometry(0.07, len, 1, 6);
      const rp = rb.attributes.position;
      for (let i = 0; i < rp.count; i++) { const t = (len / 2 - rp.getY(i)) / len; rp.setZ(i, Math.sin(t * 5 + dx * 30) * 0.06 + t * 0.12); }
      rb.computeVertexNormals();
      const n = rb.toNonIndexed(); n.deleteAttribute('uv');
      B.place(m, n, tx + dx, 4.53 - len / 2, tz + 0.3, 0);
    }
  }
  // the lawn strip along the south side of the plinth (photo 14_)
  for (const [za, zb] of [[-8, -1.9], [1.9, 6.5]] as const) B.span(K.lawn, -12.2, 0, za, -8.7, 0.03, zb);

  // stone benches along the court walls
  for (const z of [-18, -6, 6, 30, 38]) {
    B.span(K.redDark, x1 - 1.6, 0, z - 1.5, x1 - 0.9, 0.45, z + 1.5, true);
  }

  // ---------- court furniture (photos c4, c5, 06_, n_o4) ----------
  // raised stone platforms (chabutra) round the court trees, sat on by pilgrims
  for (const [tx, tz] of [...TREES, ...COURT_TREES]) {
    if (tx < x0 || tx > x1 || tz < z0 || tz > z1) continue;
    B.add(K.redDark, cyl(1.55, 1.6, 0.42, 16, tx, -0.02, tz));
    B.add(K.red, cyl(1.62, 1.62, 0.06, 16, tx, 0.4, tz));
    B.add(K.dark, cyl(0.55, 0.55, 0.02, 12, tx, 0.46, tz));
    P.solid(tx - 1.2, 0, tz - 1.2, tx + 1.2, 0.46, tz + 1.2);
  }
  // steel shoe racks by the south gate, inside the wall, with rows of chappals
  {
    const rx = x0 + 0.35;
    for (const [za, zb] of [[sg.z + 4.2, sg.z + 7.4], [sg.z - 7.4, sg.z - 4.2]] as const) {
      for (let k = 0; k < 4; k++) B.span(K.steel, rx - 0.3, 0.12 + k * 0.38, za, rx + 0.3, 0.15 + k * 0.38, zb);
      for (let z = za; z <= zb + 0.01; z += (zb - za) / 4) B.span(K.steel, rx - 0.3, 0, z - 0.02, rx + 0.3, 1.32, z + 0.02);
      P.solid(rx - 0.3, 0, za, rx + 0.3, 1.32, zb);
      const cols = [K.dark, K.wood, K.sign, K.tarp, K.dark, K.wood];
      for (let k = 0; k < 4; k++) for (let z = za + 0.12; z < zb - 0.1; z += 0.19) {
        if (r() < 0.25) continue;
        B.add(cols[Math.floor(r() * cols.length)], boxAt(0.25, 0.04, 0.09, rx + (r() - 0.5) * 0.15, 0.15 + k * 0.38, z));
      }
    }
  }
  // flower and prasad stalls in the north-east corner of the court (marigold heaps, bel, coconuts)
  for (const [sx, sz] of [[x1 - 3.2, z1 - 4.5], [x1 - 3.2, z1 - 9.2]] as const) {
    B.span(K.wood, sx - 1.0, 0, sz - 1.6, sx + 1.0, 0.85, sz + 1.6, true);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) B.add(K.steel, cyl(0.035, 0.035, 2.5, 5, sx + a * 1.05, 0, sz + b * 1.65));
    const roof = new THREE.BoxGeometry(2.6, 0.04, 3.8).rotateZ(0.1).translate(sx, 2.55, sz).toNonIndexed();
    roof.deleteAttribute('uv');
    B.add(K.tarp, roof);
    for (let k = 0; k < 3; k++) O.heap(sx - 0.4 + k * 0.4, 0.86, sz - 0.9 + k * 0.9, 0.35, 0.22, 46);
    // strings of garlands hung from the front
    for (let k = 0; k < 6; k++) O.strand(new THREE.Vector3(sx - 1.05, 2.4, sz - 1.4 + k * 0.55), new THREE.Vector3(sx - 1.05, 1.2, sz - 1.4 + k * 0.55 + 0.01), 0.0, 1.0);
  }
  // the barricaded darshan queue: a serpentine of steel pipe railings on the west side of the court
  {
    const qa = x0 + 2.0, qb = -18.5, z0q = -11.2, lanes = 4, lw = 1.25;
    for (let k = 0; k <= lanes; k++) {
      const z = z0q + k * lw;
      const open = k === 0 || k === lanes ? 0 : 1.2;
      const xa = k % 2 ? qa + open : qa, xb = k % 2 ? qb : qb - open;
      for (const y of [0.45, 1.0]) B.add(K.steel, cyl(0.025, 0.025, xb - xa, 6, 0, 0, 0).rotateZ(Math.PI / 2).translate((xa + xb) / 2, y, z));
      for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.max(1, Math.round((xb - xa) / 2.4))) B.add(K.steel, cyl(0.03, 0.03, 1.05, 6, x, 0, z));
      P.solid(xa, 0, z - 0.05, xb, 1.05, z + 0.05);
    }
  }

  // ---------- ground outside, the village lane and houses ----------
  const gs = new THREE.Shape([new THREE.Vector2(-700, -700), new THREE.Vector2(700, -700), new THREE.Vector2(700, 700), new THREE.Vector2(-700, 700)]);
  const kh = KUND.half;
  // ShapeGeometry is in (x, -z) before rotateX(-π/2)
  gs.holes.push(new THREE.Path([
    new THREE.Vector2(KUND.x - kh, -(KUND.z - kh)), new THREE.Vector2(KUND.x - kh, -(KUND.z + kh)),
    new THREE.Vector2(KUND.x + kh, -(KUND.z + kh)), new THREE.Vector2(KUND.x + kh, -(KUND.z - kh)),
  ]));
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(gs).rotateX(-Math.PI / 2), K.earth);
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  root.add(ground);
  P.floors.push(ground);
  // the lane in front of the south gate (asphalt-grey), running east–west
  B.span(K.paving, x0 - 14, -0.11, z0 - 30, x0 - T, -0.06, z1 + 40);
  village(V, K, P);
  kund(root, V, K, P);
  hills(outer);
  fields(outer);
  villageTrees(outer, P, treeSpots(), pending, (x, z) => Math.hypot(x, z) < 160);
  P.floor(root, x0, x1, z0, z1, 0);
}

function gateway(root: THREE.Object3D, B: Merger, K: GM, side: 'south' | 'east') {
  // local: across = v (gate width), out = u (through the wall). Map to world.
  const cx = side === 'south' ? COURT.x0 - 0.4 : EAST_GATE.x;
  const cz = side === 'south' ? SOUTH_GATE.z : COURT.z1 + 0.4;
  const W = 4.2, D = 1.6, Hh = 7.2, open = side === 'south' ? SOUTH_GATE.half : EAST_GATE.half, archTop = 4.6;
  const span = (m: THREE.Material, v0: number, y0: number, u0: number, v1: number, y1: number, u1: number, solid = false) => {
    if (side === 'south') B.span(m, cx + u0, y0, cz + v0, cx + u1, y1, cz + v1, solid);
    else B.span(m, cx + v0, y0, cz + u0, cx + v1, y1, cz + u1, solid);
  };
  // piers
  for (const s of [-1, 1]) {
    const va = s > 0 ? open : -W, vb = s > 0 ? W : -open;
    span(K.compoundWall, va, -0.1, -D / 2, vb, Hh, D / 2, true);
    // engaged pilasters with cream bands
    span(K.limewash, s > 0 ? open : -open - 0.35, -0.1, -D / 2 - 0.08, s > 0 ? open + 0.35 : -open, archTop, D / 2 + 0.08);
  }
  // the arch: stepped lintels approximating the Maratha cusped arch
  for (let k = 0; k < 5; k++) {
    const w = open * (1 - (k / 5) ** 2 * 0.85);
    span(K.limewash, -open, archTop - 0.9 + k * 0.18, -D / 2, -w, archTop - 0.72 + k * 0.18, D / 2);
    span(K.limewash, w, archTop - 0.9 + k * 0.18, -D / 2, open, archTop - 0.72 + k * 0.18, D / 2);
  }
  span(K.limewash, -open, archTop, -D / 2, open, Hh, D / 2);
  // cream outline of the arch and cornice; parapet with merlons (kangura)
  span(K.houseWash, -W - 0.15, Hh - 0.6, -D / 2 - 0.15, W + 0.15, Hh - 0.4, D / 2 + 0.15);
  span(K.houseWash, -W, Hh, -D / 2, W, Hh + 0.12, D / 2);
  // a flat stone coping (no merlons), and on the lane side the gate-house porch on four pillars (photo c3)
  span(K.redDark, -W - 0.1, Hh + 0.12, -D / 2 - 0.1, W + 0.1, Hh + 0.3, D / 2 + 0.1);
  if (side === 'south') {
    for (const v of [-3.6, -1.9, 1.9, 3.6]) span(K.compoundWall, v - 0.22, -0.1, -D / 2 - 2.6, v + 0.22, 3.4, -D / 2 - 2.16);
    span(K.compoundWall, -W, 3.4, -D / 2 - 2.8, W, 3.75, -D / 2);
    span(K.redDark, -W - 0.1, 3.75, -D / 2 - 2.9, W + 0.1, 3.85, -D / 2);
    // the upper storey: a room over the porch with small square windows and a flat stone coping (c3)
    span(K.compoundWall, -W, 3.85, -D / 2 - 2.8, W, 6.6, -D / 2 - 0.2);
    for (const v of [-2.6, -0.9, 0.9, 2.6]) span(K.dark, v - 0.32, 4.6, -D / 2 - 2.84, v + 0.32, 5.4, -D / 2 - 2.76);
    for (const v of [-2.6, -0.9, 0.9, 2.6]) span(K.redDark, v - 0.42, 4.5, -D / 2 - 2.9, v + 0.42, 4.6, -D / 2 - 2.7);
    span(K.redDark, -W - 0.1, 6.6, -D / 2 - 2.95, W + 0.1, 6.78, -D / 2 - 0.1);
  }
  // a dark recess band over the arch: the nagarkhana windows
  for (const v of [-2.6, 2.6]) span(K.dark, v - 0.4, 5.3, D / 2 - 0.02, v + 0.4, 6.3, D / 2 + 0.02);
  // the signboard on the court side: श्री घृष्णेश्वर ज्योतिर्लिंग
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f1414'; g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = '#f2c14e'; g.lineWidth = 10; g.strokeRect(8, 8, 1008, 176);
  g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 84px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.fillText(side === 'south' ? '॥ श्री घृष्णेश्वर ॥' : '॥ ॐ नमः शिवाय ॥', 512, 72);
  g.font = '600 38px "Cormorant Garamond", serif';
  g.fillStyle = '#ffffff';
  g.fillText(side === 'south' ? 'SHRI GRISHNESHWAR · 12th JYOTIRLINGA · VERUL' : 'SHRI GHRISHNESHWAR MANDIR', 512, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.86), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  for (const dir of [-1, 1]) {
    const s2 = sign.clone();
    if (side === 'south') { s2.position.set(cx + dir * (D / 2 + 0.03), 5.0, cz); s2.rotation.y = dir * Math.PI / 2; }
    else { s2.position.set(cx, 5.0, cz + dir * (D / 2 + 0.03)); s2.rotation.y = dir > 0 ? 0 : Math.PI; }
    root.add(s2);
  }
}

/** a small red-stone shrine with a pyramidal (phamsana) roof and a dark doorway */
function shrine(B: Merger, K: GM, P: Physics, x: number, z: number, ry: number) {
  // the court shrines (photos 05_, c6): orange lime-washed cells under a smooth, gently curved
  // pyramidal roof with a pot finial, a lamp column (deepmal) in front
  const w = 2.0, h = 2.5;
  B.span(K.redDark, x - 1.3, 0, z - 1.3, x + 1.3, 0.45, z + 1.3, true);
  B.span(K.limewash, x - w / 2, 0.45, z - w / 2, x + w / 2, 0.45 + h, z + w / 2, true);
  B.span(K.limewash, x - w / 2 - 0.1, 0.45 + h, z - w / 2 - 0.1, x + w / 2 + 0.1, 0.45 + h + 0.18, z + w / 2 + 0.1);
  const dx = Math.sin(ry) * (w / 2 + 0.01), dz = Math.cos(ry) * (w / 2 + 0.01);
  B.add(K.dark, boxAt(Math.abs(Math.cos(ry)) > 0.5 ? 0.8 : 0.04, 1.5, Math.abs(Math.cos(ry)) > 0.5 ? 0.04 : 0.8, x + dx, 0.6, z + dz));
  const y = 0.45 + h + 0.18;
  // a curvilinear shikhara of moulded tiers (c6): each tier a band and a projecting lip, narrowing faster
  // towards the top, a ribbed amalaka and a pot (kalash) finial
  let yy = y, hw = w / 2 + 0.02;
  for (let k = 0; k < 7; k++) {
    const h = 0.3 - k * 0.012;
    B.add(K.limewash, boxAt(hw * 2, h * 0.7, hw * 2, x, yy, z));
    B.add(K.limewash, boxAt(hw * 2 + 0.1, h * 0.3, hw * 2 + 0.1, x, yy + h * 0.7, z));
    // the central offset (bhadra) projection on each face
    B.add(K.limewash, boxAt(hw * 0.8, h, hw * 2 + 0.16, x, yy, z));
    B.add(K.limewash, boxAt(hw * 2 + 0.16, h, hw * 0.8, x, yy, z));
    yy += h;
    hw *= 0.9 - k * 0.025;
  }
  B.place(K.limewash, lathe([[0.001, 0], [0.22, 0], [0.32, 0.08], [0.33, 0.13], [0.28, 0.2], [0.18, 0.24], [0.001, 0.24]], 18, 16, 0.12), x, yy, z);
  B.place(K.limewash, lathe([[0.001, 0], [0.12, 0], [0.18, 0.1], [0.12, 0.22], [0.06, 0.28], [0.08, 0.31], [0.001, 0.38]], 14), x, yy + 0.24, z);
  B.place(K.gold, bulbGeo(0.06, 0.22, 8), x, yy + 0.6, z);
  // deepmal (lamp column) before the door
  const lx = x + Math.sin(ry) * 2.3, lz = z + Math.cos(ry) * 2.3;
  B.add(K.redDark, boxAt(0.6, 0.3, 0.6, lx, 0, lz));
  B.add(K.limewash, cyl(0.16, 0.12, 2.0, 8, lx, 0.3, lz));
  for (let k = 0; k < 5; k++) B.add(K.limewash, cyl(0.2, 0.2, 0.06, 8, lx, 0.65 + k * 0.33, lz));
  P.solid(lx - 0.3, 0, lz - 0.3, lx + 0.3, 2.3, lz + 0.3);
}

function village(B: Merger, K: GM, P: Physics) {
  const { x0, x1, z0, z1 } = COURT;
  // a row of houses on the far side of the lane, and stalls against the court wall
  for (let z = z0 - 26; z < z1 + 36; z += 6.5 + r() * 3) {
    const w = 5 + r() * 3, d = 7 + r() * 5, h = 3.2 + r() * 4.5;
    if (z + w > KUND.z - KUND.half - 4 && z < KUND.z + KUND.half + 4) continue; // the open ground round the kund
    const xa = x0 - 15 - d;
    house(B, K, xa, z, d, w, h, 'east');
    if (r() < 0.5) B.span(K.tin, xa + d, 2.6, z, xa + d + 1.8, 2.7, z + w); // tin awning
  }
  // flower and pooja-samagri stalls along the court wall, either side of the gate
  for (let z = z0 + 2; z < z1 - 2; z += 4.2) {
    if (Math.abs(z - SOUTH_GATE.z) < 6) continue;
    const xa = x0 - 0.8 - 3.0;
    B.span(K.wood, xa, -0.1, z, xa + 2.6, 0.9, z + 3.6, true);
    for (const zz of [z + 0.1, z + 3.4]) B.add(K.steel, cyl(0.04, 0.04, 2.6, 5, xa + 0.1, 0, zz));
    const roof = new THREE.BoxGeometry(3.2, 0.05, 3.9).rotateZ(-0.12).translate(xa + 1.4, 2.7, z + 1.8).toNonIndexed();
    roof.deleteAttribute('uv');
    B.add(r() < 0.5 ? K.tin : K.tarp, roof);
  }
  // houses to the north and west beyond the court, so the wall is not on the edge of nowhere
  // rows of attached houses along village lanes on the north, west and east (photo c3, c7), with gaps
  const lot = (x: number, z: number, w: number, d: number, front: 'east' | 'west' | 'north') => {
    if (HOUSES.some(([a, b, c, e]) => x < c + 0.5 && x + w > a - 0.5 && z < e + 0.5 && z + d > b - 0.5)) return;
    house(B, K, x, z, w, d, 3 + r() * 5, front);
  };
  for (const xr of [x1 + 9, x1 + 24, x1 + 39]) {
    for (let z = z0 - 30; z < z1 + 40; z += 0) { const w = 6 + r() * 5; if (r() < 0.82) lot(xr, z, 8 + r() * 4, w, 'west'); z += w + (r() < 0.2 ? 4 : 0.2); }
  }
  for (const zr of [z0 - 16, z0 - 32]) {
    for (let x = x0 - 2; x < x1 + 6; x += 0) { const w = 6 + r() * 5; if (r() < 0.8) lot(x, zr - 9, w, 8 + r() * 3, 'east'); x += w + (r() < 0.2 ? 4 : 0.2); }
  }
  for (const zr of [z1 + 12, z1 + 28]) {
    for (let x = x0 - 14; x < x1 + 6; x += 0) { const w = 6 + r() * 5; if (r() < 0.8) lot(x, zr, w, 8 + r() * 3, 'north'); x += w + (r() < 0.2 ? 4 : 0.2); }
  }
  void P;
}

/**
 * A Verul village house: lime-washed or painted (cream, light blue, pink, ochre), one or two storeys
 * (the upper often a later RCC floor set back), window and door openings with frames on every face,
 * a parapet, and often a black plastic water tank on the roof.
 */
function house(B: Merger, K: GM, x: number, z: number, w: number, d: number, h: number, front: 'east' | 'west' | 'north') {
  const pal = [K.houseWash, K.houseWash, K.houseBlue, K.housePink, K.houseOchre, K.limewash];
  const m = pal[Math.floor(r() * pal.length)];
  const storeys = h > 5.5 ? 2 : 1, H1 = storeys === 2 ? 3.1 : h;
  HOUSES.push([x, z, x + w, z + d]);
  B.span(m, x, -0.12, z, x + w, H1, z + d, true);
  B.span(K.redDark, x - 0.08, H1, z - 0.08, x + w + 0.08, H1 + 0.12, z + d + 0.08);
  let top = H1 + 0.12;
  if (storeys === 2) {
    const sx = x + 0.3, sz = z + 0.3, sw = w - 0.6 - r() * 1.5, sd = d - 0.6 - r() * 1.5;
    B.span(r() < 0.5 ? K.houseWash : m, sx, top, sz, sx + sw, top + 2.9, sz + sd, true);
    windows(B, K, sx, sz, sw, sd, top + 0.9);
    // an RCC balcony slab with a steel railing on the street side
    if (front === 'east') {
      B.span(K.houseWash, sx + sw, top - 0.05, sz + 0.4, sx + sw + 1.0, top + 0.08, sz + sd - 0.4);
      for (const yy of [top + 0.5, top + 0.95]) B.span(K.steel, sx + sw + 0.96, yy, sz + 0.4, sx + sw + 1.0, yy + 0.04, sz + sd - 0.4);
    } else if (front === 'north') {
      B.span(K.houseWash, sx + 0.4, top - 0.05, sz - 1.0, sx + sw - 0.4, top + 0.08, sz);
      for (const yy of [top + 0.5, top + 0.95]) B.span(K.steel, sx + 0.4, yy, sz - 1.0, sx + sw - 0.4, yy + 0.04, sz - 0.96);
    }
    top += 2.9;
    B.span(K.houseWash, sx - 0.05, top, sz - 0.05, sx + sw + 0.05, top + 0.6, sz + sd + 0.05);
    if (r() < 0.5) B.add(K.tank, cyl(0.55, 0.55, 1.0, 12, sx + 1, top + 0.6, sz + 1));
  } else {
    B.span(K.houseWash, x - 0.02, top, z - 0.02, x + w + 0.02, top + 0.55, z + d + 0.02);
    if (r() < 0.4) B.add(K.tank, cyl(0.55, 0.55, 1.0, 12, x + 1, top, z + 1));
  }
  windows(B, K, x, z, w, d, 0.95);
  facade(B, K, x, z, w, d, H1, front);
}

/**
 * The street face of a house (photos c3, c7, c4): corner pilasters, a ground-floor shop with a rolling
 * shutter or a framed wooden door on a step, a painted signboard, a deep sunshade (chhajja) over the
 * ground floor, and window grilles. Works in a face frame: u along the face, o outward.
 */
function facade(B: Merger, K: GM, x: number, z: number, w: number, d: number, H1: number, front: 'east' | 'west' | 'north') {
  const L = front === 'north' ? w : d;
  const box = (m: THREE.Material, u0: number, u1: number, y0: number, y1: number, o0: number, o1: number) => {
    if (front === 'east') B.span(m, x + w + o0, y0, z + u0, x + w + o1, y1, z + u1);
    else if (front === 'west') B.span(m, x - o1, y0, z + u0, x - o0, y1, z + u1);
    else B.span(m, x + u0, y0, z - o1, x + u1, y1, z - o0);
  };
  // corner pilasters and a plinth band
  for (const u of [0, L - 0.28]) box(K.houseWash, u, u + 0.28, -0.1, H1, 0, 0.07);
  box(K.redDark, 0, L, -0.1, 0.35, 0, 0.05);
  const shop = r() < 0.6 && L > 4.5;
  if (shop) {
    // a shop: the opening with a grey rolling shutter half up, a counter, goods
    const u0 = 0.6, u1 = Math.min(L - 0.6, u0 + 2.6 + r() * 1.2);
    box(K.houseWash, u0 - 0.12, u1 + 0.12, 2.35, 2.5, 0, 0.1);
    box(K.dark, u0, u1, 0.35, 2.35, -0.02, 0.01);
    box(K.tin, u0, u1, 1.6 + r() * 0.6, 2.35, 0, 0.06);
    box(K.wood, u0 + 0.1, u1 - 0.1, 0, 0.9, 0.0, 0.55);
    for (let k = 0; k < 4; k++) box([K.paintYellow, K.sign, K.tarp, K.saffron][k % 4], u0 + 0.2 + k * 0.55, u0 + 0.6 + k * 0.55, 0.9, 1.0 + r() * 0.2, 0.1, 0.45);
  } else {
    // a framed wooden door on a step
    const u0 = L * 0.3;
    box(K.houseWash, u0 - 0.12, u0 + 1.12, 0, 2.3, 0, 0.06);
    box(K.wood, u0, u0 + 1.0, 0.15, 2.15, 0.02, 0.07);
    box(K.redDark, u0 - 0.2, u0 + 1.2, -0.1, 0.15, 0, 0.45);
  }
  // signboard above the ground floor, and the sunshade
  if (shop || r() < 0.3) {
    const sc = [K.sign, K.paintYellow, K.tarp, K.saffron][Math.floor(r() * 4)];
    box(sc, 0.4, Math.min(L - 0.4, 0.4 + 3.4), 2.55, 3.0, 0.1, 0.16);
    box(K.houseWash, 0.45, Math.min(L - 0.45, 3.75), 2.6, 2.95, 0.16, 0.17);
  }
  if (H1 > 3) box(K.houseWash, 0, L, H1 - 0.1, H1 + 0.02, 0, 0.75);
}

/** window openings (dark glass, cream frame, a sunshade slab) on all four faces of a block */
function windows(B: Merger, K: GM, x: number, z: number, w: number, d: number, y: number) {
  const ww = 0.9, wh = 1.1;
  for (const [len, along, fix, sign, alongX] of [[w, x, z, -1, true], [w, x, z + d, 1, true], [d, z, x, -1, false], [d, z, x + w, 1, false]] as const) {
    const n = Math.max(1, Math.floor(len / 3.2));
    for (let i = 0; i < n; i++) {
      if (r() < 0.25) continue;
      const c = along + ((i + 0.5) / n) * len;
      const o = fix + sign * 0.02;
      if (alongX) {
        B.span(K.houseWash, c - ww / 2 - 0.08, y - 0.08, o - 0.03, c + ww / 2 + 0.08, y + wh + 0.08, o + 0.03);
        B.span(K.glass, c - ww / 2, y, o - 0.04, c + ww / 2, y + wh, o + 0.04);
        for (let b = 1; b < 4; b++) B.span(K.steel, c - ww / 2 + b * ww / 4 - 0.012, y, o - 0.06, c - ww / 2 + b * ww / 4 + 0.012, y + wh, o + 0.06);
        B.span(K.houseWash, c - ww / 2 - 0.15, y + wh + 0.12, Math.min(o, o + sign * 0.45), c + ww / 2 + 0.15, y + wh + 0.2, Math.max(o, o + sign * 0.45));
      } else {
        B.span(K.houseWash, o - 0.03, y - 0.08, c - ww / 2 - 0.08, o + 0.03, y + wh + 0.08, c + ww / 2 + 0.08);
        B.span(K.glass, o - 0.04, y, c - ww / 2, o + 0.04, y + wh, c + ww / 2);
        for (let b = 1; b < 4; b++) B.span(K.steel, o - 0.06, y, c - ww / 2 + b * ww / 4 - 0.012, o + 0.06, y + wh, c - ww / 2 + b * ww / 4 + 0.012);
        B.span(K.houseWash, Math.min(o, o + sign * 0.45), y + wh + 0.12, c - ww / 2 - 0.15, Math.max(o, o + sign * 0.45), y + wh + 0.2, c + ww / 2 + 0.15);
      }
    }
  }
}

/** village tree spots: round the court walls, along the lane, round the kund, among the houses */
function treeSpots(): [number, number, number][] {
  const out: [number, number, number][] = [...COURT_TREES];
  const { x0, x1, z0, z1 } = COURT;
  const kh = KUND.half + 4.5;
  const bad = (x: number, z: number) =>
    (x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2) || (x > x0 - 16 && x < x0 - 0.5 && z > z0 - 32 && z < z1 + 42)
    || (Math.abs(x - KUND.x) < kh && Math.abs(z - KUND.z) < kh)
    || HOUSES.some(([a, b, c, d]) => x > a - 2 && x < c + 2 && z > b - 2 && z < d + 2)
    || out.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 6);
  const tryAdd = (x: number, z: number, h: number) => { if (!bad(x, z)) out.push([x, z, h]); };
  // a ring hugging the outside of the court walls (c0, c4, c5)
  for (let t = 0; t < 1; t += 0.035) {
    const per = 2 * ((x1 - x0) + (z1 - z0)), d = t * per;
    let x: number, z: number;
    if (d < x1 - x0) { x = x0 + d; z = z0 - 5; } else if (d < (x1 - x0) + (z1 - z0)) { x = x1 + 4.5; z = z0 + d - (x1 - x0); }
    else if (d < 2 * (x1 - x0) + (z1 - z0)) { x = x1 - (d - (x1 - x0) - (z1 - z0)); z = z1 + 5; } else { x = x0 - 17; z = z1 - (d - 2 * (x1 - x0) - (z1 - z0)); }
    tryAdd(x + (r() - 0.5) * 2, z + (r() - 0.5) * 2, 8 + r() * 5);
  }
  // round the kund (44_: big trees over the tank walls)
  for (let a = 0; a < Math.PI * 2; a += 0.33) tryAdd(KUND.x + Math.cos(a) * (kh + 3 + r() * 4), KUND.z + Math.sin(a) * (kh + 3 + r() * 4), 9 + r() * 5);
  // scattered through the village and the fields' edges
  for (let k = 0; k < 140 && out.length < 120; k++) {
    const a = r() * Math.PI * 2, rr = 45 + r() * 120;
    tryAdd(Math.cos(a) * rr, 8 + Math.sin(a) * rr, 7 + r() * 6);
  }
  return out;
}

/**
 * Fields round the village (aerial views of Verul): rectangles of crop rows — green jowar and cotton,
 * yellowing stubble, ploughed brown earth — divided by grassy bunds. One mesh, a row texture, vertex tint.
 */
function fields(root: THREE.Object3D) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a8070'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) { g.fillStyle = '#d8d8c8'; g.fillRect(0, y, 64, 5); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  const tints = [0x4f6a2a, 0x5d7a30, 0x6f7a36, 0x9a8a4a, 0x7a5e3e, 0x8a7048, 0x53702c];
  const cc = new THREE.Color();
  for (let gx = -12; gx <= 12; gx++) for (let gz = -12; gz <= 12; gz++) {
    const cx = gx * 34 + (r() - 0.5) * 16, cz = gz * 30 + (r() - 0.5) * 14;
    const dist = Math.hypot(cx + 10, cz - 8);
    if (dist < 120 || dist > 430 || r() < 0.4) continue;
    if (Math.abs(cx - KUND.x) < 40 && Math.abs(cz - KUND.z) < 40) continue;
    const w = 12 + r() * 30, d = 10 + r() * 22, a = (r() - 0.5) * 0.5, rows = r() < 0.5 ? 0 : Math.PI / 2;
    cc.set(tints[Math.floor(r() * tints.length)]);
    const ca = Math.cos(a), sa = Math.sin(a);
    const corner = (u: number, v: number) => [cx + u * ca - v * sa, cz + u * sa + v * ca];
    const q = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)];
    const uvq = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => {
      const ru = u * Math.cos(rows) - v * Math.sin(rows), rv = u * Math.sin(rows) + v * Math.cos(rows);
      return [ru / 6, rv / 1.4];
    });
    for (const k of [0, 2, 1, 0, 3, 2]) {
      pos.push(q[k][0], -0.09, q[k][1]); uv.push(uvq[k][0], uvq[k][1]); col.push(cc.r, cc.g, cc.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  root.add(m);
}

/**
 * The Ellora (Charanandri) scarp, ≈1 km east-north-east: a Deccan-trap escarpment ≈170 m high built of
 * horizontal basalt flows — four steep dark cliff bands (ledges) separated by gentler scrub-covered
 * benches — over rolling ground. The grid is laid out across the scarp line, 5 m apart through the scarp
 * band and coarse elsewhere, so the ledges stay crisp without a dense sheet everywhere.
 */
function hills(root: THREE.Object3D) {
  const ux = 0.36, uz = 0.93, ul = Math.hypot(ux, uz), U = [ux / ul, uz / ul], Vv = [U[1], -U[0]];
  const hash = (x: number, y: number) => { const s2 = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s2 - Math.floor(s2); };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
  };
  // d samples: coarse to 600, 5 m through 600–1250, coarse to 2600; also behind the site (negative)
  const ds: number[] = [];
  for (let d = -2600; d < 600; d += 50) ds.push(d);
  for (let d = 600; d < 1700; d += 6) ds.push(d);
  for (let d = 1700; d <= 2600; d += 50) ds.push(d);
  const ts: number[] = [];
  for (let t = -2600; t <= 2600; t += 16) ts.push(t);
  const nd = ds.length, nt = ts.length;
  const pos = new Float32Array(nd * nt * 3), col = new Float32Array(nd * nt * 3), wet = new Float32Array(nd * nt);
  const TIERS = 4, HT = 170;
  // eroded gullies cut back into the scarp face at irregular intervals
  const gullies: [number, number, number][] = [];
  for (let t = -2400; t < 2400; t += 120 + hash(t, 5) * 260) gullies.push([t, 35 + hash(t, 9) * 55, 25 + hash(t, 11) * 70]);
  const ss = THREE.MathUtils.smoothstep;
  for (let i = 0; i < nd; i++) for (let j = 0; j < nt; j++) {
    const d = ds[i], t = ts[j];
    const x = d * U[0] + t * Vv[0], z = d * U[1] + t * Vv[1];
    const dist = Math.hypot(x, z);
    let gully = 0;
    for (const [tc, w, depthG] of gullies) gully += Math.exp(-(((t - tc) / w) ** 2)) * depthG;
    // the scarp line wanders (spurs and re-entrants) and is notched by the gullies
    const edge = 820 + (noise(t * 0.004, 3.1) - 0.5) * 240 + (noise(t * 0.013, 7.7) - 0.5) * 70 + gully;
    const s = THREE.MathUtils.clamp((d - edge) / 420, 0, 1.2);
    // four lava flows, each with its own (varying) thickness, cliff position and steepness; where a cliff
    // softens it becomes a talus slope
    let lv = 0, hsum = 0;
    for (let k = 0; k < TIERS; k++) {
      const hk = 0.55 + 0.9 * noise(t * 0.0045 + k * 3.7, k * 1.9);
      const bk = (k + 0.7 + 0.5 * (noise(t * 0.006 + k * 13, 2.2) - 0.5)) / TIERS;
      const ck = 0.012 + 0.06 * Math.pow(noise(t * 0.011 + k * 7, 4.4), 2);
      lv += hk * ss(s, bk - ck, bk);
      // a concave talus apron at the cliff foot
      lv += hk * 0.18 * ss(s, bk - ck - 0.09, bk - ck) * (1 - ss(s, bk - ck, bk));
      hsum += hk;
    }
    lv /= hsum;
    let h = lv * HT * (0.9 + noise(t * 0.003, 1.3) * 0.2);
    // gentle benches, knolls on the plateau, small-scale roughness
    h += s * 14 + ss(s, 1.0, 1.2) * noise(t * 0.01, d * 0.01) * 18 + noise(x * 0.03, z * 0.03) * 3 * Math.min(1, s * 3);
    // rolling ground and far low hills
    h += ss(dist, 700, 2200) * noise(x * 0.0025 + 3, z * 0.0025) * 60;
    h *= ss(dist, 260, 520);
    const y = h - 0.3 - 40 * (1 - ss(dist, 560, 690));
    const o = (i * nt + j) * 3;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    wet[i * nt + j] = gully > 5 ? 1 : 0;
  }
  const idx: number[] = [];
  for (let i = 0; i < nd - 1; i++) for (let j = 0; j < nt - 1; j++) {
    const a = i * nt + j, b = a + 1, c2 = a + nt, d2 = c2 + 1;
    idx.push(a, b, c2, b, d2, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { for (let q = 0; q < idx.length; q += 3) { const tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; } g.setIndex(idx); g.computeVertexNormals(); }
  // colour by slope: dark basalt cliffs, grey-brown talus, dry grass benches with dark scrub patches,
  // greener scrub down the gullies
  const nrm = g.attributes.normal, c = new THREE.Color();
  const rockA = new THREE.Color(0x3a322c), rockB = new THREE.Color(0x4e443c), talus = new THREE.Color(0x77695a), dryG = new THREE.Color(0x8a7a52),
    grass = new THREE.Color(0x5e663c), scrub = new THREE.Color(0x343f22);
  for (let v = 0; v < nd * nt; v++) {
    const ny = nrm.getY(v), x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    c.copy(grass).lerp(dryG, noise(x * 0.012, z * 0.012) * 0.9);
    if (noise(x * 0.06, z * 0.06) > 0.62 || (wet[v] && noise(x * 0.04, z * 0.04) > 0.4)) c.lerp(scrub, 0.75);
    if (ny < 0.8) c.lerp(talus, ss(ny, 0.8, 0.62));
    if (ny < 0.58) c.copy(rockA).lerp(rockB, noise(x * 0.05, y * 0.25));
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  root.add(m);
}

/** a four-sided pyramidal roof with gently convex (curved) faces and a pot finial; base at origin */
export function curvedRoofGeo(half: number, h: number) {
  const R = half * Math.SQRT2;
  const prof: [number, number][] = [[0, 0], [R, 0]];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    prof.push([R * (1 - t) * (1 + 0.1 * Math.sin(t * Math.PI)), h * t]);
  }
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(Math.max(a, 0.001), b)), 4).rotateY(Math.PI / 4);
  const n = g.toNonIndexed(); n.deleteAttribute('uv'); n.computeVertexNormals();
  return n;
}

/**
 * One of the eight Shivalaya shrines (photo 44_): a pink-grey stone cell on a plinth, an open pillared
 * porch (two columns) towards the water, a small chhajja, then a stepped curvilinear shikhara of five
 * moulded tiers weathered dark with moss, a ribbed amalaka, kalash and a saffron flag.
 * Local frame: front = +z, base at y = 0.
 */
function kundShrine(B: Merger, K: GM, x: number, y: number, z: number, ry: number) {
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (m: THREE.Material, g: THREE.BufferGeometry) => { let l = parts.get(m); if (!l) parts.set(m, (l = [])); l.push(g); };
  const bx = (m: THREE.Material, w: number, h: number, d: number, cx: number, y0: number, cz: number) => put(m, boxAt(w, h, d, cx, y0, cz));
  // plinth with a moulded top
  bx(K.kundStone, 2.6, 0.3, 2.6, 0, 0, 0);
  bx(K.kundStone, 2.7, 0.08, 2.7, 0, 0.3, 0);
  // the cell (back 2/3) and its doorway
  bx(K.shrineStone, 2.1, 1.95, 1.45, 0, 0.38, -0.3);
  bx(K.dark, 0.62, 1.25, 0.04, 0, 0.42, 0.44);
  bx(K.shrineStone, 0.86, 0.1, 0.08, 0, 1.67, 0.46);
  for (const s of [-1, 1]) bx(K.shrineStone, 0.1, 1.3, 0.08, s * 0.36, 0.38, 0.46);
  // the porch: two square pillars with capitals, a lintel beam, a side wall stub each side
  for (const s of [-1, 1]) {
    bx(K.shrineStone, 0.24, 0.16, 0.24, s * 0.78, 0.38, 0.85);
    bx(K.shrineStone, 0.17, 1.38, 0.17, s * 0.78, 0.54, 0.85);
    put(K.shrineStone, cyl(0.12, 0.1, 0.12, 8, s * 0.78, 1.92, 0.85));
    bx(K.shrineStone, 0.3, 0.12, 0.3, s * 0.78, 2.04, 0.85);
    bx(K.shrineStone, 0.14, 1.78, 0.4, s * 0.98, 0.38, 0.62);
  }
  bx(K.shrineStone, 2.1, 0.17, 0.3, 0, 2.08, 0.85);
  bx(K.shrineStone, 2.1, 0.2, 0.15, 0, 2.08, 0.5);
  // the porch's floor and a small chhajja round the whole
  bx(K.kundStone, 2.1, 0.04, 0.65, 0, 0.38, 0.75);
  bx(K.kundRoof, 2.55, 0.1, 2.3, 0, 2.25, -0.05);
  bx(K.kundRoof, 2.35, 0.08, 2.1, 0, 2.35, -0.05);
  // shikhara: five shrinking moulded tiers (curvilinear: the steps narrow faster towards the top)
  let yy = 2.43, hw = 0.98;
  for (let k = 0; k < 5; k++) {
    const h = 0.34 - k * 0.025;
    bx(K.kundRoof, hw * 2, h * 0.72, hw * 2, 0, yy, -0.05);
    bx(K.kundMoss, hw * 2 + 0.12, h * 0.28, hw * 2 + 0.12, 0, yy + h * 0.72, -0.05);
    // a small chaitya-arch projection on the front face of each tier
    bx(K.kundRoof, hw * 0.7, h * 0.72, 0.12, 0, yy, -0.05 + hw + 0.04);
    yy += h;
    hw *= 0.8 - k * 0.03;
  }
  // neck, ribbed amalaka, kalash and the flag
  put(K.kundRoof, cyl(0.2, 0.16, 0.12, 10, 0, yy, -0.05));
  put(K.kundMoss, lathe([[0.001, 0], [0.24, 0], [0.33, 0.07], [0.34, 0.12], [0.3, 0.18], [0.2, 0.22], [0.001, 0.22]], 18, 16, 0.12).translate(0, yy + 0.12, -0.05));
  put(K.kundRoof, lathe([[0.001, 0], [0.08, 0], [0.12, 0.08], [0.08, 0.16], [0.04, 0.22], [0.05, 0.25], [0.001, 0.3]], 10).translate(0, yy + 0.34, -0.05));
  put(K.steel, cyl(0.015, 0.015, 1.3, 4, 0.12, yy + 0.3, -0.05));
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute([0.12, yy + 1.58, -0.05, 0.72, yy + 1.4, -0.05, 0.12, yy + 1.22, -0.05,
    0.12, yy + 1.58, -0.05, 0.12, yy + 1.22, -0.05, 0.72, yy + 1.4, -0.05], 3));
  fg.computeVertexNormals();
  put(K.saffron, fg);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  for (const [mat, list] of parts) for (const g of list) B.add(mat, g, m);
}

function kund(root: THREE.Object3D, B: Merger, K: GM, P: Physics) {
  const { x: cx, z: cz, half: H, depth, pool } = KUND;
  // ≈40 grey-brown basalt treads (0.15 m rise, 0.36 m run) broken by two landings (photos 24_–55_, 44_)
  const N = 40, LAND = [14, 28], rise = depth / N, run = (H - pool) / (N - 2 + LAND.length * 4);
  const steps: { top: number; ro: number; ri: number }[] = [];
  let ro = H;
  for (let k = 1; k <= N; k++) {
    const w = LAND.includes(k) ? run * 4 : run;
    steps.push({ top: -k * rise, ro, ri: ro - w });
    ro -= w;
  }
  for (const [k, { top, ro: o, ri }] of steps.entries()) {
    const m = LAND.includes(k + 1) ? K.kundStep : K.kundStone;
    // one ring of steps: four boxes from the pit floor up to this tread
    const bx = (x0: number, z0: number, x1: number, z1: number) => {
      B.span(m, cx + x0, -depth - 1, cz + z0, cx + x1, top, cz + z1);
      P.floor(root, cx + x0, cx + x1, cz + z0, cz + z1, top);
    };
    bx(ri, -o, o, o);
    bx(-o, -o, -ri, o);
    bx(-ri, -o, ri, -ri);
    bx(-ri, ri, ri, o);
  }
  // the green pool, its railing and a collider so one stops at the last step
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pool * 2, pool * 2).rotateX(-Math.PI / 2), K.kundWater);
  water.position.set(cx, -depth - 0.25, cz);
  root.add(water);
  B.span(K.kundStone, cx - pool, -depth - 1.2, cz - pool, cx + pool, -depth - 0.9, cz + pool);
  P.solid(cx - pool, -depth - 2, cz - pool, cx + pool, -depth + 0.6, cz + pool);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) B.add(K.steel, cyl(0.03, 0.03, 0.9, 5, cx + a * (pool - 0.1), -depth, cz + b * (pool - 0.1)));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, len = pool * 2;
    const g = new THREE.CylinderGeometry(0.02, 0.02, len, 4).rotateZ(Math.PI / 2).rotateY(a);
    g.translate(cx + Math.sin(a) * (pool - 0.1), -depth + 0.85, cz + Math.cos(a) * (pool - 0.1));
    const n = g.toNonIndexed(); n.deleteAttribute('uv');
    B.add(K.steel, n);
  }
  // the rim: a dark basalt kerb, then a 3 m arcaded boundary wall of lime-plastered stone on three sides
  // (photo 44_: the buff wall with arched bays above the tank), open to the lane on the east
  const T = 0.6, Hw = 3.0, out = H + 3.0;
  for (const [x0, z0, x1, z1] of [[-out - T, -out - T, out + T, -out], [-out - T, out, out + T, out + T], [-out - T, -out, -out, out],
    [out, -out, out + T, -2.5], [out, 2.5, out + T, out]] as const) {
    B.span(K.kundWall, cx + x0, -0.1, cz + z0, cx + x1, Hw, cz + z1, true);
    B.span(K.kundStone, cx + x0 - 0.06, Hw, cz + z0 - 0.06, cx + x1 + 0.06, Hw + 0.14, cz + z1 + 0.06);
  }
  // arcade on the inner faces: recessed bays under cusped arches every 3 m
  const arch = archPanel(2.2, 0.9, 0.12, 0.6);
  for (let t = -out + 1.5; t < out - 1; t += 3) {
    for (const [px, pz, ry, ox, oz] of [[t, -out, 0, 0, 1], [t, out, Math.PI, 0, -1], [-out, t, Math.PI / 2, 1, 0], [out, t, -Math.PI / 2, -1, 0]] as const) {
      if (px === out && Math.abs(t) < 4) continue;
      const x = cx + px, z = cz + pz;
      B.add(K.kundStone, boxAt(ox ? 0.04 : 2.2, 2.4, oz ? 0.04 : 2.2, x + ox * 0.01, -0.05, z + oz * 0.01));
      B.place(K.houseWash, arch, x + ox * 0.0, 1.5, z + oz * 0.0, ry);
      for (const s of [-1, 1]) {
        const qx = x + (oz ? s * 1.25 : ox * 0.1), qz = z + (ox ? s * 1.25 : oz * 0.1);
        B.add(K.houseWash, boxAt(oz ? 0.4 : 0.2, Hw, oz ? 0.2 : 0.4, qx, -0.1, qz));
      }
    }
  }
  // the gate on the east side
  for (const s of [-1, 1]) B.span(K.houseWash, cx + out - 0.1, -0.1, cz + s * 2.5 - 0.4, cx + out + T + 0.1, Hw + 0.9, cz + s * 2.5 + 0.4, true);
  B.span(K.houseWash, cx + out - 0.1, Hw + 0.5, cz - 2.9, cx + out + T + 0.1, Hw + 1.1, cz + 2.9);
  // a low kerb parapet round the tank's lip, open on the east
  const Tp = 0.45, Hp = 0.55;
  B.span(K.kundStone, cx - H - Tp, 0, cz - H - Tp, cx + H + Tp, Hp, cz - H, true);
  B.span(K.kundStone, cx - H - Tp, 0, cz + H, cx + H + Tp, Hp, cz + H + Tp, true);
  B.span(K.kundStone, cx - H - Tp, 0, cz - H, cx - H, Hp, cz + H, true);
  B.span(K.kundStone, cx + H, 0, cz - H, cx + H + Tp, Hp, cz - 2.5, true);
  B.span(K.kundStone, cx + H, 0, cz + 2.5, cx + H + Tp, Hp, cz + H, true);
  // paved surround
  const hi = H;
  for (const [x0, z0, x1, z1] of [[-out, -out, out, -hi], [-out, hi, out, out], [-out, -hi, -hi, hi], [hi, -hi, out, hi]] as const) {
    B.span(K.paving, cx + x0, -0.1, cz + z0, cx + x1, -0.04, cz + z1);
  }
  // eight shrines on the first landing: four at the corners, four at the middle of the sides, facing the water
  const land = steps[LAND[0] - 1], y = land.top, d = (land.ro + land.ri) / 2;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const x = cx + a * d, z = cz + b * d;
    B.span(K.kundStone, x - 1.3, -depth - 1, z - 1.3, x + 1.3, y, z + 1.3);
    P.solid(x - 1.35, -depth - 1, z - 1.35, x + 1.35, y + 3, z + 1.35);
    kundShrine(B, K, x, y, z, Math.atan2(-a, -b));
  }
  // the path from the lane to the kund's open side
  B.span(K.paving, cx + out + T, -0.1, cz - 2.2, COURT.x0 - 13, -0.05, cz + 2.2);
}

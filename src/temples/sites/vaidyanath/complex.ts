import * as THREE from 'three';
import type { Flames, Physics } from '../../engine/kit';
import type { VM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './offerings';
import { lathe, pennant, ribbon, sagCurve, tube } from './forms';
import { buildShrine, MAIN, MAIN_TIE, MAIN_TOWER, type ShrineSpec } from './temple';

/** radius factor of the main tower's rounded-square plan at polar angle a */
function superK(a: number) {
  const n = MAIN_TOWER.n, e = 2 / n;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return Math.hypot(Math.pow(c, e), Math.pow(s, e));
}

/**
 * The walled courtyard of Baba Dham: grey stone slabs, a high whitewashed enclosure lined inside
 * with the flat-roofed verandahs of the pandas, ~21 subsidiary shrines round the main temple, the
 * gathbandhan web of red threads from Baba's crown to Maa Parvati's, steel queue railings,
 * tarpaulin shades, flood-light masts and an LED screen.
 * (Layout approximated from satellite imagery + photographs; +x north, +z east.)
 */

export const COURT = { x0: -31, x1: 31, z0: -28, z1: 40, wallH: 5.4, wallT: 0.7 };
/** the Singh Dwar (east gate) opening */
export const GATE = { x0: -3.2, x1: 3.2 };
/** the north gate (exit) opening */
export const NGATE = { z0: 9, z1: 13 };

export const PARVATI: ShrineSpec = { name: 'Maa Parvati', x: 15, z: 20, ry: -Math.PI / 2, kind: 'rekha', half: 3.6, height: 14.2, porch: 3.4, mainCrown: true };

const SHRINES_RAW: ShrineSpec[] = [
  PARVATI,
  { name: 'Devi (crimson)', x: -15, z: 19, ry: Math.PI / 2, kind: 'pidha', half: 3.1, height: 13.2, porch: 3.0, crimson: true },
  { name: 'Annapurna', x: -22, z: 7, ry: Math.PI / 2, kind: 'dome', half: 2.5, height: 9, crimson: true },
  { name: 'Lakshmi Narayan', x: 18, z: -3, ry: -Math.PI / 2, kind: 'rekha', half: 3.0, height: 14.5 },
  { name: 'Kali', x: 20, z: -15, ry: -Math.PI / 2, kind: 'rekha', half: 2.6, height: 12.5 },
  { name: 'Ganesh', x: 11.2, z: 13.2, ry: -Math.PI / 2, kind: 'beehive', half: 1.5, height: 7 },
  { name: 'Brahma', x: -16, z: -3, ry: Math.PI / 2, kind: 'rekha', half: 2.5, height: 12 },
  { name: 'Sandhya', x: -17, z: -15, ry: Math.PI / 2, kind: 'pidha', half: 2.4, height: 10.5 },
  { name: 'Kaal Bhairav', x: -4, z: -17, ry: 0, kind: 'rekha', half: 2.3, height: 11 },
  { name: 'Hanuman', x: 7, z: -18, ry: 0, kind: 'pidha', half: 1.7, height: 7.2 },
  { name: 'Manasa', x: -24, z: 27, ry: Math.PI / 2, kind: 'rekha', half: 2.1, height: 10 },
  { name: 'Saraswati', x: 24.5, z: 6, ry: -Math.PI / 2, kind: 'rekha', half: 2.2, height: 11 },
  { name: 'Surya', x: 24, z: 31, ry: -Math.PI / 2, kind: 'beehive', half: 2.0, height: 9.5 },
  { name: 'Bagla', x: -25, z: -6, ry: Math.PI / 2, kind: 'beehive', half: 2.0, height: 9.5 },
  { name: 'Narmadeshwar', x: -11, z: -21.5, ry: 0, kind: 'beehive', half: 1.8, height: 8 },
  { name: 'Ram', x: 14, z: -21, ry: 0, kind: 'rekha', half: 2.2, height: 10.5 },
  { name: 'Ganga', x: -24, z: -21, ry: Math.PI / 2, kind: 'dome', half: 1.9, height: 7 },
  { name: 'Anand Bhairav', x: -10, z: 31, ry: -Math.PI / 2 + Math.PI, kind: 'beehive', half: 2.6, height: 12.5 },
  { name: 'Gauri Shankar', x: 24, z: -20, ry: -Math.PI / 2, kind: 'rekha', half: 2.2, height: 10.5 },
  { name: 'Tara', x: 14, z: 33, ry: Math.PI, kind: 'rekha', half: 2.4, height: 11.5 },
  { name: 'Neelkanth', x: -24.5, z: 15.5, ry: Math.PI / 2, kind: 'beehive', half: 1.6, height: 7.5 },
  { name: 'Jagat Janani', x: 24.8, z: 19, ry: -Math.PI / 2, kind: 'pidha', half: 2.0, height: 9 },
];
/**
 * Baba's tower must dominate (official frontal photo: ~1.4-1.6x any flanking shrine): cap every
 * subsidiary shrine at 0.65 of Baba's tower top (Parvati, above, at 0.8) and drop the rekha shrines
 * on the gate side, which stand nearest the visitor, a further 20%.
 */
const BABA_TOP = MAIN.towerY + MAIN.towerH;
export const SHRINES: ShrineSpec[] = SHRINES_RAW.map((s) => {
  if (s.mainCrown) return s;
  let h = Math.min(s.height, BABA_TOP * 0.65);
  if (s.kind === 'rekha' && s.z > 15) h *= 0.8;
  return { ...s, height: h };
});

export function buildComplex(root: THREE.Group, B: Merger, V: VM, P: Physics, flames: Flames, O: Offerings) {
  const { x0, x1, z0, z1, wallH, wallT } = COURT;

  // ---- courtyard paving
  B.span(V.paving, x0, -0.2, z0, x1, 0, z1);
  P.floor(root, x0, x1, z0, z1, 0);

  // ---- enclosure walls (with the east and north gates), a red band and coping on top
  const W = V.lime;
  const wall = (ax: number, az: number, bx: number, bz: number) => {
    B.span(W, ax, 0, az, bx, wallH, bz, true);
    B.span(W, ax - 0.08, wallH, az - 0.08, bx + 0.08, wallH + 0.2, bz + 0.08);
    B.span(V.redBand, ax - 0.09, wallH - 0.45, az - 0.09, bx + 0.09, wallH - 0.25, bz + 0.09);
  };
  wall(x0 - wallT, z0 - wallT, x1 + wallT, z0); // west
  wall(x0 - wallT, z1, GATE.x0, z1 + wallT); // east, south of the gate
  wall(GATE.x1, z1, x1 + wallT, z1 + wallT); // east, north of the gate
  wall(x0 - wallT, z0, x0, z1); // south
  wall(x1, z0, x1 + wallT, NGATE.z0); // north
  wall(x1, NGATE.z1, x1 + wallT, z1);

  // ---- Singh Dwar: a tall gateway with a cusped arch look (two piers, lintel, a crown of small spires)
  const gx0 = GATE.x0, gx1 = GATE.x1, gz = z1 + wallT / 2;
  for (const [a, b] of [[gx0 - 1.4, gx0], [gx1, gx1 + 1.4]] as const) {
    B.span(W, a, 0, gz - 1.0, b, 7.2, gz + 1.0, true);
    B.span(W, a - 0.1, 7.2, gz - 1.1, b + 0.1, 7.5, gz + 1.1);
    B.place(W, lathe([[0.5, 0], [0.45, 0.4], [0.25, 1.1], [0.08, 1.5], [0, 1.6]], 16), (a + b) / 2, 7.5, gz);
  }
  B.span(W, gx0, 5.6, gz - 1.0, gx1, 7.2, gz + 1.0);
  B.span(V.redBand, gx0 - 1.5, 6.6, gz + 1.0, gx1 + 1.5, 6.9, gz + 1.08);
  B.span(V.redBand, gx0 - 1.5, 6.6, gz - 1.08, gx1 + 1.5, 6.9, gz - 1.0);
  // arch under the lintel (segmental) on both faces
  for (const fz of [gz - 1.0, gz + 1.0]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, x = gx0 + t * (gx1 - gx0);
      pts.push(new THREE.Vector3(x, 4.7 + Math.sin(t * Math.PI) * 0.7, fz));
    }
    B.add(W, tube(pts, 0.14, 24, 6));
  }
  // garlands and a bell at the gate
  O.strand(new THREE.Vector3(gx0 + 0.1, 5.4, gz + 1.08), new THREE.Vector3(gx1 - 0.1, 5.4, gz + 1.08), 0.5);
  O.strand(new THREE.Vector3(gx0 + 0.1, 5.4, gz - 1.08), new THREE.Vector3(gx1 - 0.1, 5.4, gz - 1.08), 0.5);
  P.floor(root, gx0, gx1, z1 - 0.1, z1 + wallT + 1.2, 0);

  // north gate
  B.span(W, x1 - 0.2, 4.0, NGATE.z0, x1 + wallT + 0.2, wallH + 0.4, NGATE.z1);
  P.floor(root, x1 - 0.1, x1 + wallT + 0.5, NGATE.z0, NGATE.z1, 0);

  // ---- verandahs of the pandas inside the walls: flat roofs on square pillars, closed backs
  // the open fronts of the verandahs (line start/end, outward normal) — dressed with banners below
  const fronts: { a: THREE.Vector3; b: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const verandah = (ax: number, az: number, bx: number, bz: number, open: 'x+' | 'x-' | 'z+' | 'z-') => {
    const h = 3.5;
    if (open === 'z+') fronts.push({ a: new THREE.Vector3(ax, 0, bz), b: new THREE.Vector3(bx, 0, bz), n: new THREE.Vector3(0, 0, 1) });
    else if (open === 'z-') fronts.push({ a: new THREE.Vector3(ax, 0, az), b: new THREE.Vector3(bx, 0, az), n: new THREE.Vector3(0, 0, -1) });
    else if (open === 'x+') fronts.push({ a: new THREE.Vector3(bx, 0, az), b: new THREE.Vector3(bx, 0, bz), n: new THREE.Vector3(1, 0, 0) });
    else fronts.push({ a: new THREE.Vector3(ax, 0, az), b: new THREE.Vector3(ax, 0, bz), n: new THREE.Vector3(-1, 0, 0) });
    B.span(W, ax, 0, az, bx, 0.3, bz);
    B.span(W, ax - 0.1, h, az - 0.1, bx + 0.1, h + 0.3, bz + 0.1);
    // red fascia only along the open edge
    if (open === 'z+') B.span(V.redBand, ax - 0.12, h + 0.05, bz + 0.1, bx + 0.12, h + 0.3, bz + 0.13);
    else if (open === 'z-') B.span(V.redBand, ax - 0.12, h + 0.05, az - 0.13, bx + 0.12, h + 0.3, az - 0.1);
    else if (open === 'x+') B.span(V.redBand, bx + 0.1, h + 0.05, az - 0.12, bx + 0.13, h + 0.3, bz + 0.12);
    else B.span(V.redBand, ax - 0.13, h + 0.05, az - 0.12, ax - 0.1, h + 0.3, bz + 0.12);
    // pillars along the open side
    const alongX = open === 'z+' || open === 'z-';
    const a0 = alongX ? ax : az, a1 = alongX ? bx : bz;
    const fixed = open === 'x+' ? bx - 0.3 : open === 'x-' ? ax + 0.3 : open === 'z+' ? bz - 0.3 : az + 0.3;
    const n = Math.max(2, Math.round((a1 - a0) / 2.6));
    for (let i = 0; i <= n; i++) {
      const u = a0 + 0.3 + (i / n) * (a1 - a0 - 0.6);
      if (alongX) B.box(W, 0.4, h, 0.4, u, 0, fixed, true);
      else B.box(W, 0.4, h, 0.4, fixed, 0, u, true);
    }
    // corbels under the eave on the open side
    for (let u = a0 + 0.5; u < a1 - 0.3; u += 1.0) {
      if (alongX) B.box(W, 0.2, 0.3, 0.4, u, h - 0.3, fixed + (open === 'z+' ? 0.2 : -0.2));
      else B.box(W, 0.4, 0.3, 0.2, fixed + (open === 'x+' ? 0.2 : -0.2), h - 0.3, u);
    }
    // a dark back (rooms) and the plinth as a floor
    P.floor(root, ax, bx, az, bz, 0.3);
  };
  verandah(x0, z0, x1, z0 + 3.5, 'z+'); // along the west wall
  verandah(x0, z0 + 3.5, x0 + 3.5, z1 - 6, 'x+'); // along the south wall
  verandah(x1 - 3.5, z0 + 3.5, x1, NGATE.z0 - 0.5, 'x-'); // north wall, west part
  verandah(x1 - 3.5, NGATE.z1 + 0.5, x1, z1, 'x-');
  verandah(GATE.x1 + 3, z1 - 3.5, x1 - 3.5, z1, 'z-'); // east wall, north of the gate
  verandah(x0 + 3.5, z1 - 3.5, GATE.x0 - 3, z1, 'z-'); // east wall, south of the gate
  // rooms behind the verandahs read as dark doorways in the back walls
  for (let x = x0 + 2; x < x1 - 2; x += 3.2) B.span(V.dark, x, 0.3, z0 + 0.01, x + 1.0, 2.4, z0 + 0.03);

  // ---- dressing the verandahs: rows of red/pink/yellow cloth banners of the panda sabhas (lettering
  //      illegible), hoarding frames on the roofs, marigold torans along every eave, awnings
  const cells = 16;
  const bannerAt = (cx: number, cy: number, cz: number, w: number, h: number, n: THREE.Vector3, cell: number, mat: THREE.Material = V.bannerAtlas) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    const cu = cell % 4, cv = Math.floor(cell / 4) % 4;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cu + uv.getX(i)) / 4, (cv + uv.getY(i)) / 4);
    const ry = Math.atan2(n.x, n.z);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    B.add(mat, g, m, true);
  };
  let cellN = 0;
  for (const f of fronts) {
    const dir = f.b.clone().sub(f.a);
    const len = dir.length();
    dir.normalize();
    const off = f.n.clone().multiplyScalar(0.16);
    // banners hung edge to edge under the eave, of varying widths
    let u = 0.6;
    while (u < len - 1.2) {
      const w = 1.6 + ((cellN * 7) % 5) * 0.45;
      if (u + w > len - 0.6) break;
      const p = f.a.clone().addScaledVector(dir, u + w / 2).add(off);
      bannerAt(p.x, 2.95, p.z, w, 0.75 + ((cellN * 3) % 3) * 0.12, f.n, cellN++ % cells);
      u += w + 0.15 + ((cellN * 5) % 4) * 0.35;
    }
    // a second, lower row: long cloths hanging straight down between the pillars, and strings of
    // small flags across the front
    for (let v = 1.2; v < len - 1.2; v += 2.6 + ((cellN * 3) % 3) * 0.4) {
      const p = f.a.clone().addScaledVector(dir, v).add(f.n.clone().multiplyScalar(0.1));
      bannerAt(p.x, 2.05, p.z, 0.55, 1.5, f.n, cellN++ % cells);
    }
    for (let s2 = 0.3; s2 < len - 3; s2 += 3) {
      const a = f.a.clone().addScaledVector(dir, s2).addScaledVector(f.n, 0.6).setY(3.75);
      const b = f.a.clone().addScaledVector(dir, s2 + 3).addScaledVector(f.n, 0.6).setY(3.75);
      const pts = sagCurve(a, b, 0.35, 8);
      for (let k = 1; k < pts.length - 1; k++) {
        const q = pts[k];
        B.place(k % 2 ? V.saffron : V.banner, pennant(0.22, 0.3), q.x, q.y, q.z, Math.atan2(dir.x, dir.z) - Math.PI / 2);
      }
    }
    // hoardings standing on the verandah roofs
    for (let k = 0; k < Math.floor(len / 9); k++) {
      const p = f.a.clone().addScaledVector(dir, 4.5 + k * 9 + ((k * 13) % 3)).addScaledVector(f.n, -1.2);
      bannerAt(p.x, 4.75, p.z, 4.2, 2.1, f.n, [0, 1, 4, 5, 9, 15, 3, 10][(cellN++) % 8], V.boards);
      B.place(V.iron, new THREE.BoxGeometry(0.08, 1.2, 0.08), p.x - f.n.x * 0.05, 4.4, p.z - f.n.z * 0.05);
    }
    // marigold torans along the eave in short swags
    for (let s = 0.4; s < len - 2.4; s += 2.4) {
      const a = f.a.clone().addScaledVector(dir, s).add(f.n.clone().multiplyScalar(0.25)).setY(3.4);
      const b = f.a.clone().addScaledVector(dir, s + 2.4).add(f.n.clone().multiplyScalar(0.25)).setY(3.4);
      O.strand(a, b, 0.32, 1.1);
    }
  }
  // the main porch eave and the Singh Dwar get their torans too
  for (let x = MAIN.porch.x0; x < MAIN.porch.x1 - 0.1; x += 2.33) {
    O.strand(new THREE.Vector3(x, MAIN.porch.roof - 0.15, MAIN.porch.z1 + 0.66), new THREE.Vector3(x + 2.33, MAIN.porch.roof - 0.15, MAIN.porch.z1 + 0.66), 0.3, 1.1);
  }
  // panda sabha banners on the main porch parapet
  for (const [x, w, c] of [[-4.6, 3.6, 2], [0, 3.2, 7], [4.4, 3.4, 11]] as const) {
    bannerAt(x, MAIN.porch.roof + 0.6, MAIN.porch.z1 + 0.4, w, 0.8, new THREE.Vector3(0, 0, 1), c);
    void c;
  }
  // big sabha banners standing on the porch roof, as in the official frontal photograph
  for (const [x, w, c] of [[-5.2, 3.0, 4], [-1.6, 2.6, 6], [5.0, 3.2, 5]] as const) {
    bannerAt(x, MAIN.porch.roof + 1.75, MAIN.porch.z1 - 0.2, w, 1.5, new THREE.Vector3(0, 0, 1), c, V.boards);
    for (const s of [-0.45, 0.45]) B.place(V.iron, new THREE.BoxGeometry(0.06, 1.2, 0.06), x + s * w, MAIN.porch.roof + 0.9, MAIN.porch.z1 - 0.25);
  }
  // flower and puja stalls under small tarps: a table under red cloth heaped with flowers, a stool
  const stall = (x: number, z: number, tarp: THREE.Material) => {
    B.span(V.banner, x - 0.9, 0, z - 0.45, x + 0.9, 0.75, z + 0.45, true);
    B.span(V.wood, x - 0.95, 0.75, z - 0.5, x + 0.95, 0.8, z + 0.5);
    O.heap(x - 0.4, 0.8, z, 0.3, 0.14, 60);
    O.heap(x + 0.45, 0.8, z, 0.3, 0.14, 60);
    B.place(V.wicker, lathe([[0, 0], [0.18, 0], [0.24, 0.05], [0.27, 0.16], [0, 0.03]], 14), x, 0.8, z + 0.25);
    B.span(tarp, x - 1.3, 2.6, z - 1.0, x + 1.3, 2.64, z + 1.0);
    for (const [px, pz] of [[x - 1.25, z - 0.95], [x + 1.25, z - 0.95], [x - 1.25, z + 0.95], [x + 1.25, z + 0.95]]) B.place(V.bamboo, new THREE.CylinderGeometry(0.03, 0.035, 2.6, 5), px, 1.3, pz);
  };
  stall(-5.6, 26.6, V.tarpBlue);
  stall(-5.6, 31.0, V.saffron);
  stall(-23, -12.5, V.tarpTeal);
  stall(21.5, 10, V.banner);
  stall(-22, 34, V.tarpBlack);

  // the boards over the Singh Dwar (inside and out) and the north exit
  bannerAt(0, 6.35, gz + 1.13, 5.6, 1.3, new THREE.Vector3(0, 0, 1), 0, V.boards);
  bannerAt(0, 6.35, gz - 1.13, 5.6, 1.3, new THREE.Vector3(0, 0, -1), 1, V.boards);
  bannerAt(0, 7.75, gz + 0.9, 3.0, 0.8, new THREE.Vector3(0, 0, 1), 2, V.boards);
  bannerAt(x1 - 0.25, 4.6, (NGATE.z0 + NGATE.z1) / 2, 3.2, 0.9, new THREE.Vector3(-1, 0, 0), 8, V.boards);
  // Maa Parvati's porch board
  bannerAt(PARVATI.x - PARVATI.half - (PARVATI.porch ?? 0) - 0.3, 3.9, PARVATI.z, 4.0, 0.9, new THREE.Vector3(-1, 0, 0), 7, V.boards);

  // ---- shrines
  const ties: Record<string, THREE.Vector3> = {};
  for (const s of SHRINES) {
    const out = buildShrine(root, B, V, P, flames, O, s);
    ties[s.name ?? ''] = out.tie;
  }

  // ---- the gathbandhan: hundreds of red threads (and a few saffron/yellow cloths) from
  //      Baba's crown to Maa Parvati's, sagging in a web, with loose ends fluttering down
  const pv = ties['Maa Parvati'];
  const rnd = O.rnd;
  const strands: THREE.BufferGeometry[] = [], old: THREE.BufferGeometry[] = [], cloth: THREE.BufferGeometry[] = [], pink: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 175; i++) {
    const a1 = rnd() * Math.PI * 2, a2 = rnd() * Math.PI * 2;
    const A = new THREE.Vector3(Math.cos(a1) * MAIN_TIE.r * (0.6 + rnd() * 0.5), MAIN_TIE.y + (rnd() - 0.5) * 0.5, Math.sin(a1) * MAIN_TIE.r * (0.6 + rnd() * 0.5));
    const Bp = pv.clone().add(new THREE.Vector3(Math.cos(a2) * 0.45, (rnd() - 0.6) * 0.6, Math.sin(a2) * 0.45));
    const sag = 2.0 + Math.pow(rnd(), 1.2) * 5.5;
    const pts = sagCurve(A, Bp, sag, 36);
    // threads cling into bundles: pull the middle sideways a little
    const side = (rnd() - 0.5) * 5.0;
    pts.forEach((p, k) => { const t = k / 36; p.x += Math.sin(t * Math.PI) * side * 0.5; p.z -= Math.sin(t * Math.PI) * side * 0.35; });
    const w = 0.014 + rnd() * 0.032;
    (rnd() < 0.3 ? old : strands).push(ribbon(pts, w, rnd() * 0.4));
  }
  for (let i = 0; i < 4; i++) {
    const pts = sagCurve(new THREE.Vector3(0.2 * i, MAIN_TIE.y + 0.1, 0.3), pv.clone().add(new THREE.Vector3(0, 0.1 * i, 0)), 0.8 + i * 0.5, 30);
    cloth.push(ribbon(pts, 0.06, 0.35 + i * 0.3));
  }
  // the dense red "skirt" of short threads right round Baba's crown, thinning toward Parvati
  const toP = pv.clone().setY(0).normalize();
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2;
    const A = new THREE.Vector3(Math.cos(a) * MAIN_TIE.r * (0.7 + rnd() * 0.4), MAIN_TIE.y + (rnd() - 0.5) * 0.5, Math.sin(a) * MAIN_TIE.r * (0.7 + rnd() * 0.4));
    const len = 0.8 + rnd() * 2.6;
    const d = toP.clone().multiplyScalar(len * (0.4 + rnd() * 0.6)).add(new THREE.Vector3((rnd() - 0.5) * 1.6, 0, (rnd() - 0.5) * 1.6));
    const Bq = A.clone().add(d).add(new THREE.Vector3(0, -0.3 - rnd() * 1.4, 0));
    const pts = sagCurve(A, Bq, 0.2 + rnd() * 0.5, 8);
    const pick = rnd();
    (pick < 0.55 ? strands : pick < 0.85 ? old : pink).push(ribbon(pts, 0.008 + rnd() * 0.012, rnd()));
  }
  // loose threads hanging from the web and from both crowns (down the tower faces)
  for (let i = 0; i < 70; i++) {
    const t = 0.1 + rnd() * 0.8;
    const A = new THREE.Vector3(0, MAIN_TIE.y, 0).lerp(pv, t);
    A.y -= Math.sin(t * Math.PI) * (2 + rnd() * 2.5);
    const len = 0.6 + rnd() * 2.6;
    const pts = [A, A.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.4, -len * 0.5, (rnd() - 0.5) * 0.4)), A.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, -len, (rnd() - 0.5) * 0.8))];
    strands.push(ribbon(pts, 0.012 + rnd() * 0.015, 0.8));
  }
  // threads draped down the faces of Baba's tower from the crown (the climbers tie and drop them)
  for (let i = 0; i < 70; i++) {
    let a = rnd() * Math.PI * 2;
    const yEnd = MAIN.towerY + 2 + rnd() * 9;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) {
      const y = MAIN_TIE.y - 0.2 - (k / 24) * (MAIN_TIE.y - 0.2 - yEnd);
      const t = Math.min(1, Math.max(0, (y - MAIN.towerY) / MAIN_TOWER.height));
      const r = MAIN_TOWER.half * MAIN_TOWER.profile(t) * superK(a) + 0.2;
      a += (rnd() - 0.5) * 0.04;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    old.push(ribbon(pts, 0.01 + rnd() * 0.012, 0.3));
  }
  const addAll = (list: THREE.BufferGeometry[], mat: THREE.Material) => { for (const g of list) B.add(mat, g); };
  addAll(strands, V.thread);
  addAll(old, V.threadOld);
  addAll(cloth, V.saffron);
  addAll(pink, V.threadPink);

  // ---- queue: steel railings from the gate to the porch steps, a serpentine by the gate
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const posts = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      B.place(V.steel, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), ax + (bx - ax) * t, 0.55, az + (bz - az) * t);
    }
    for (const y of [0.45, 1.05]) B.add(V.steel, tube([new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz)], 0.026, 2, 6));
    P.solid(Math.min(ax, bx) - 0.06, 0, Math.min(az, bz) - 0.06, Math.max(ax, bx) + 0.06, 1.1, Math.max(az, bz) + 0.06);
  };
  const qz0 = MAIN.plinth.z1 + 0.9;
  rail(-1.3, qz0, -1.3, z1 - 1.2);
  rail(1.3, qz0, 1.3, 30);
  // the serpentine (switchbacks) to the north of the straight lane
  for (let k = 0; k < 4; k++) {
    const x = 3.6 + k * 2.3;
    rail(x, 25 + (k % 2 ? 0 : 2.2), x, 34.5 - (k % 2 ? 2.2 : 0));
  }
  rail(1.3, 30, 3.6, 30);
  // drinking-water point and a donation box by the queue
  B.span(V.steel, -2.8, 0, 26, -2.0, 1.0, 26.6, true);
  B.span(V.redBand, -2.7, 1.0, 26.05, -2.1, 1.25, 26.55);

  // ---- tarpaulin shades (teal, black, blue) on steel poles, as in the aerial view
  const shade = (mat: THREE.Material, ax: number, az: number, bx: number, bz: number, y: number, sag = 0.25) => {
    const seg = 12;
    const geo = new THREE.PlaneGeometry(bx - ax, bz - az, seg, seg).rotateX(-Math.PI / 2);
    const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const u = pp.getX(i) / (bx - ax) * 2, v = pp.getZ(i) / (bz - az) * 2;
      pp.setY(i, -sag * (1 - u * u) * (1 - v * v) + Math.sin(i * 1.7) * 0.02);
    }
    geo.computeVertexNormals();
    B.place(mat, geo, (ax + bx) / 2, y, (az + bz) / 2);
    for (const [px, pz] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) B.place(V.steel, new THREE.CylinderGeometry(0.045, 0.05, y, 6), px, y / 2, pz);
    for (const [px, pz] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) P.solid(px - 0.08, 0, pz - 0.08, px + 0.08, y, pz + 0.08);
  };
  shade(V.tarpTeal, -13, -11, -8.2, 9, 4.6);
  shade(V.tarpTeal, 8.6, -10, 14.2, 6, 4.6);
  shade(V.tarpBlack, 7.9, 2.5, 11.5, 9.4, 4.0, 0.4);
  shade(V.tarpTeal, -27, 31, -18, 37, 3.9);
  shade(V.tarpBlue, 18, -9, 23, -5, 3.6);
  shade(V.tarpBlack, -21.4, -24.3, -14, -20.5, 3.4, 0.35);
  shade(V.tarpTeal, 3, -24.3, 11, -20.8, 3.4);
  shade(V.tarpBlue, 22, 24, 27.3, 28, 3.4);
  shade(V.tarpBlack, -27.3, -2, -22.8, 3, 3.3, 0.35);
  shade(V.tarpTeal, 17, 33.8, 21.3, 36.3, 3.3);

  // ---- flood-light masts and loudspeakers
  const mast = (x: number, z: number, h: number) => {
    B.place(V.steel, new THREE.CylinderGeometry(0.08, 0.12, h, 8), x, h / 2, z);
    B.span(V.iron, x - 0.6, h, z - 0.1, x + 0.6, h + 0.08, z + 0.1);
    for (const dx of [-0.45, 0, 0.45]) B.span(V.iron, x + dx - 0.18, h + 0.08, z - 0.08, x + dx + 0.18, h + 0.36, z + 0.12);
    P.solid(x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15);
  };
  mast(-6, 14, 11);
  mast(8, -9, 12);
  mast(-12, -13, 10);
  mast(20, 12, 13);

  // a second LED screen on scaffolding facing the queue
  B.span(V.iron, 19.6, 0, 28.5, 19.75, 6.6, 28.65, true);
  B.span(V.iron, 19.6, 0, 32.3, 19.75, 6.6, 32.45, true);
  B.span(V.tarpBlue, 19.3, 3.6, 28.2, 19.6, 6.6, 32.8);
  B.span(V.screen, 19.25, 3.75, 28.4, 19.3, 6.45, 32.6);

  // ---- the big market umbrellas the pandas and flower-sellers sit under (yellow, red, rainbow)
  const umb = (x: number, z: number, mats: THREE.Material[], r = 1.25) => {
    // canopy rim at ~2.6 m (real market umbrellas: ~2.5–3 m across on ~2.6 m poles)
    const seg = 8, cy = 2.85, ch = 0.5;
    for (let i = 0; i < seg; i++) {
      const g = new THREE.ConeGeometry(r, ch, 4, 2, true, (i / seg) * Math.PI * 2, (Math.PI * 2) / seg);
      // a little sag between the spokes
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const a = Math.atan2(p.getX(k), p.getZ(k)) - (i / seg) * Math.PI * 2;
        const f = Math.sin(((a % (Math.PI * 2 / seg)) + Math.PI * 2 / seg) % (Math.PI * 2 / seg) * seg / 2);
        const rr = Math.hypot(p.getX(k), p.getZ(k)) / r;
        p.setY(k, p.getY(k) - f * rr * 0.06);
      }
      g.computeVertexNormals();
      B.place(mats[i % mats.length], g, x, cy, z);
    }
    // the shaded underside (dark fabric seen from below) and eight steel spokes
    B.place(V.umbUnder, new THREE.ConeGeometry(r * 0.95, ch, 16, 1, true), x, cy - 0.1, z);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      B.add(V.steel, tube([new THREE.Vector3(x, cy + ch / 2 - 0.05, z), new THREE.Vector3(x + Math.sin(a) * r * 0.97, cy - ch / 2 - 0.02, z + Math.cos(a) * r * 0.97)], 0.008, 2, 4));
      B.add(V.steel, tube([new THREE.Vector3(x, cy - 0.45, z), new THREE.Vector3(x + Math.sin(a) * r * 0.5, cy - 0.04, z + Math.cos(a) * r * 0.5)], 0.006, 2, 4));
    }
    B.place(V.steel, new THREE.CylinderGeometry(0.022, 0.022, cy + ch / 2, 6), x, (cy + ch / 2) / 2, z);
    P.solid(x - 0.35, 0, z - 0.35, x + 0.35, 2.2, z + 0.35);
  };
  const yellow = V.umbYellow, red = V.banner, white = V.umbWhite, blue = V.tarpBlue, green = V.umbGreen;
  umb(-9.5, 13.5, [yellow]);
  umb(-6.8, 22, [red, white]);
  umb(5.5, 22.5, [yellow]);
  umb(-11, 3, [red, yellow, green, blue]);
  umb(12, -7, [red, white]);
  umb(-20, 13, [yellow]);
  umb(19.5, 25.5, [red, yellow, green, blue]);
  umb(-4, 30, [yellow]);
  umb(-17, -9, [red, white]);
  umb(-26, 22, [yellow]);
  umb(-25.5, -15.5, [red, yellow, green, blue]);
  umb(26, 13, [yellow]);
  umb(25.5, -9, [red, white]);
  umb(-16, 35, [red, yellow, green, blue]);
  umb(-5.5, 35.5, [yellow]);
  umb(20, -24, [yellow]);
  umb(-6, -23.5, [red, white]);
  // red cloth banners of the panda sabha on the walls and verandahs (no lettering)
  for (const [x, y, z, ry, w] of [[-18, 4.2, z0 + 3.62, 0, 4.5], [6, 4.2, z0 + 3.62, 0, 5], [x1 - 3.62, 4.2, 22, -Math.PI / 2, 4],
    [-14, 4.2, z1 - 3.62, Math.PI, 4.5], [14, 4.2, z1 - 3.62, Math.PI, 5]] as const) {
    B.place(V.banner, new THREE.PlaneGeometry(w, 0.9), x, y, z, ry);
    B.place(V.umbYellow, new THREE.PlaneGeometry(w * 0.7, 0.12), x + Math.sin(ry) * 0.01, y + 0.15, z + Math.cos(ry) * 0.01, ry);
    B.place(V.umbYellow, new THREE.PlaneGeometry(w * 0.5, 0.1), x + Math.sin(ry) * 0.01, y - 0.15, z + Math.cos(ry) * 0.01, ry);
  }

  // ---- people's things in the courtyard: kanwar poles leaning by the verandahs,
  //      plastic jerricans of Gangajal, a heap of discarded flowers, puja baskets
  for (const [x, z, ry] of [[-28.2, 2, 0.15], [-28.2, 4.4, -0.1], [-28.2, 13, 0.2], [27.8, -3, 0.1], [27.8, -1, -0.2], [-5, 37.2, 1.4], [6, 37.2, 1.6]] as const) {
    kanwar(B, V, x, z, ry);
  }
  // bamboo ladders leaning on Baba's block (as in the photographs) for the men who climb to tie threads
  const bambooLadder = (x: number, z: number, h: number, lean: number, ry: number) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    for (const s of [-0.22, 0.22]) B.add(V.bamboo, new THREE.CylinderGeometry(0.035, 0.04, h, 6).translate(s, h / 2, 0), m);
    for (let y = 0.35; y < h - 0.1; y += 0.32) B.add(V.bamboo, new THREE.CylinderGeometry(0.018, 0.018, 0.48, 5).rotateZ(Math.PI / 2).translate(0, y, 0), m);
  };
  bambooLadder(MAIN.half + 1.0, -3.2, 5.2, -0.2, Math.PI / 2);
  bambooLadder(-MAIN.half - 1.0, 2.0, 5.2, -0.2, -Math.PI / 2);
  // flower-sellers' baskets and puja dalias by the queue and the porch steps
  const basket = lathe([[0, 0], [0.18, 0], [0.24, 0.05], [0.27, 0.16], [0.25, 0.17], [0.22, 0.06], [0, 0.03]], 18);
  for (const [x, z] of [[-3.0, 14.5], [-3.4, 15.2], [-2.6, 18], [-3.2, 21.5], [4.6, 14.2], [-7.2, 12.8], [7.2, 12.9]] as const) {
    B.place(V.wicker, basket, x, 0, z);
    O.heap(x, 0.12, z, 0.2, 0.08, 30);
  }
  O.heap(-6.5, 0, -8.8, 0.7, 0.35, 160);
  O.heap(11.5, 0, 12.5, 0.5, 0.25, 90);
  O.scatter(-3, 3, 12.5, 30, 0.004, 260, 0.25);
  O.scatter(-8, 8, -9, 9, 0.004, 200, 0.3);
  // flower debris, marigold petals and leaves trodden across the whole court, thicker by the
  // shrines' doors and the queue
  O.scatter(-29, 29, -24, 37, 0.004, 1400, 0.3);
  O.scatter(-3.5, 3.5, 11.5, 40, 0.004, 400, 0.2);
  for (const sh of SHRINES) {
    const fx = sh.x + Math.sin(sh.ry) * (sh.half + 1.2), fz = sh.z + Math.cos(sh.ry) * (sh.half + 1.2);
    O.scatter(fx - 1.2, fx + 1.2, fz - 1.2, fz + 1.2, 0.004, 60, 0.35);
    O.heap(fx + 0.8, 0, fz + 0.6, 0.3, 0.1, 25);
  }
  return { ties };
}

/**
 * A kanwar: the bamboo yoke carried from Sultanganj, two hanging baskets dressed in saffron
 * with bells and small pots of Gangajal, propped against a wall at (x, z).
 */
export function kanwar(B: Merger, V: VM, x: number, z: number, ry: number) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const add = (mat: THREE.Material, g: THREE.BufferGeometry, lx: number, ly: number, lz: number, rz = 0) => {
    const l = new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1));
    B.add(mat, g, m.clone().multiply(l));
  };
  // the pole leans: one end on the ground, one against the wall
  add(V.bamboo, new THREE.CylinderGeometry(0.03, 0.035, 2.2, 6), 0, 0.85, 0, 1.15);
  for (const s of [-1, 1]) {
    const px = s * 0.85, py = 0.85 + s * 0.37;
    add(V.saffron, new THREE.CylinderGeometry(0.22, 0.17, 0.32, 10, 1, true), px, py - 0.55, 0);
    add(V.clay, lathe([[0, 0], [0.08, 0], [0.12, 0.1], [0.07, 0.2], [0.05, 0.24], [0, 0.24]], 10), px, py - 0.62, 0);
    add(V.brassOut, new THREE.SphereGeometry(0.03, 6, 4), px + 0.18, py - 0.4, 0);
    for (const dz of [-0.15, 0.15]) add(V.saffron, new THREE.CylinderGeometry(0.006, 0.006, 0.45, 3), px, py - 0.2, dz);
  }
  // a saffron cloth and a marigold string on the yoke
  add(V.saffron, new THREE.BoxGeometry(0.5, 0.08, 0.01), 0, 0.85, 0.04, 1.15);
}

import * as THREE from 'three';
import { columnGeometry, garland, type Flames, type Physics } from '../../engine/kit';
import type { KM } from './mats';
import { Merger, cylUV } from './merge';
import { tent, twoSided } from './tent';
import { shivling, type Offerings } from './shivling';
import { nandi } from './nandi';
import { murti, type Deity } from './murti';
import { board } from './signs';
import { archWallGeo, archPlateGeo, nagaraSpire, SHRINE_CLUSTER, STONE_CLUSTER, kalashGeo, chhatriGeo, lathe, tieredRoofGeo, onionDome } from './spire';

/**
 * Mandir Parisar (2021): a white-marble court round the temple, enclosed by an ornate single-storey
 * colonnade of Chunar sandstone, entered by four gateways. The east gateway (toward the chowk and
 * the Ganga) carries three Nagara spires; the others are toran gates with gilded chhatris.
 * North of the temple: the Gyanvapi mandap with the well and the great Nandi.
 */

export const PARISAR = { x0: -34, x1: 32, z0: -26, z1: 30, depth: 6 };
/** the darshan queue lanes along the temple's long (east and west) faces: |z| of the middle and outer rails, far end x */
export const QLANES = { zMid: 7.7, zOut: 8.9, xFar: -13 };
const GATE_W = 5.0; // passage width
export const GATE_W_PUBLIC = GATE_W;

export function buildParisar(root: THREE.Group, K: KM, P: Physics, flames: Flames, O: Offerings) {
  const g = new THREE.Group();
  g.name = 'parisar';
  root.add(g);
  const B = new Merger(P, 'parisar');
  for (const m of [K.gilt, K.brass, K.steel, K.bronze, K.dark, K.door, K.canvas, K.marble, K.silver]) B.noShadow.add(m);
  const { x0, x1, z0, z1, depth } = PARISAR;

  // ---------- marble court ----------
  const court = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), K.marble);
  court.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const uv = court.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));
  court.receiveShadow = true;
  g.add(court);
  P.floors.push(court);

  // ---------- colonnade on four sides, with gaps for the gates ----------
  const colH = 4.6, colR = 0.24;
  const colGeo = cylUV(columnGeometry(colH, colR), colR * 1.1);
  const colPts: [number, number][] = [];
  /** one straight wing from a to b (along x or z), inward unit normal n, gate centred at `gate` (along-coordinate) */
  const wing = (axis: 'x' | 'z', fixed: number, from: number, to: number, n: number, gate: number | null, gh = 6.1) => {
    const bay = 3.3;
    const len = to - from;
    const bays = Math.round(len / bay);
    const b = len / bays;
    const front = fixed + n * depth; // column line
    const P3 = (along: number, across: number): [number, number] => (axis === 'x' ? [along, across] : [across, along]);
    const ry = axis === 'x' ? 0 : Math.PI / 2;
    const inGate = (a: number) => gate !== null && Math.abs(a - gate) < gh;
    // back wall (dressed ashlar), full height incl. parapet
    const wallC = fixed - n * 0.4;
    const segs: [number, number][] = gate === null ? [[from, to]] : [[from, gate - gh], [gate + gh, to]];
    for (const [a, bb] of segs) {
      if (bb - a < 0.1) continue;
      const [xa, za] = P3(a, wallC - 0.4), [xb, zb] = P3(bb, wallC + 0.4);
      B.span(K.ashlar, Math.min(xa, xb), 0, Math.min(za, zb), Math.max(xa, xb), 7.0, Math.max(za, zb), true);
      // roof slab over the walk, frieze, eave, parapet
      const lo = Math.min(fixed, front + n * 0.3), hi = Math.max(fixed, front + n * 0.3);
      const [rxa, rza] = P3(a, lo), [rxb, rzb] = P3(bb, hi);
      B.span(K.chunar, Math.min(rxa, rxb), colH, Math.min(rza, rzb), Math.max(rxa, rxb), colH + 1.05, Math.max(rza, rzb));
      const e0 = front + n * 0.95, [exa, eza] = P3(a, Math.min(fixed, e0)), [exb, ezb] = P3(bb, Math.max(fixed, e0));
      B.span(K.chunar, Math.min(exa, exb), colH + 1.05, Math.min(eza, ezb), Math.max(exa, exb), colH + 1.2, Math.max(eza, ezb));
      const p0 = front + n * 0.25, [pxa, pza] = P3(a, p0 - 0.15), [pxb, pzb] = P3(bb, p0 + 0.15);
      B.span(K.chunar, Math.min(pxa, pxb), colH + 1.2, Math.min(pza, pzb), Math.max(pxa, pxb), colH + 1.95, Math.max(pza, pzb));
      // outer face (toward the city / chowk): blind cusped arches, string course, coping
      const out = fixed - n * 0.8;
      for (let t = a + 1.65; t < bb - 1.0; t += 3.3) {
        const [ox, oz] = P3(t, out - n * 0.01);
        const ory = axis === 'x' ? (n > 0 ? Math.PI : 0) : (n > 0 ? -Math.PI / 2 : Math.PI / 2);
        blindArch(B, K.chunarWall, K.recess, ox, 1.2, oz, ory, 1.5, 2.0, 0.9, 2.3, 3.3, 0.4);
        const [qx, qz] = P3(t, out - n * 0.06);
        B.box(K.chunar, 2.1, 0.18, 0.12, qx, 1.05, qz, false, axis === 'x' ? 0 : Math.PI / 2);
      }
      { // the projecting arch frames are solid
        const [sxa, sza] = P3(a, out - n * 0.4), [sxb, szb] = P3(bb, out);
        P.solid(Math.min(sxa, sxb), 0, Math.min(sza, szb), Math.max(sxa, sxb), 4.5, Math.max(sza, szb));
      }
      for (const [y0, y1, pr] of [[5.4, 5.65, 0.25], [6.85, 7.15, 0.2]] as const) {
        const [oxa, oza] = P3(a, out - n * pr), [oxb, ozb] = P3(bb, out);
        B.span(K.chunar, Math.min(oxa, oxb), y0, Math.min(oza, ozb), Math.max(oxa, oxb), y1, Math.max(oza, ozb));
      }
      // carved band on the frieze (thin dark relief line + small niches)
      const f0 = front + n * 0.31, [fxa, fza] = P3(a, f0 - 0.02), [fxb, fzb] = P3(bb, f0 + 0.02);
      B.span(K.dark, Math.min(fxa, fxb), colH + 0.62, Math.min(fza, fzb), Math.max(fxa, fxb), colH + 0.68, Math.max(fza, fzb));
    }
    // columns + cusped arches, and blind niches on the back wall
    for (let i = 0; i <= bays; i++) {
      const a = from + i * b;
      if (!inGate(a)) colPts.push(P3(a, front));
      if (i < bays) {
        const m = a + b / 2;
        if (inGate(m) || inGate(a) || inGate(a + b)) continue;
        const [x, z] = P3(m, front);
        B.place(K.chunar, archWallGeo(b - 0.42, colH, 0.36, b - 0.62, colH * 0.5, colH * 0.36, 9), x, 0, z, ry);
        const [wx, wz] = P3(m, fixed + n * 0.01);
        const nry = axis === 'x' ? (n > 0 ? 0 : Math.PI) : (n > 0 ? Math.PI / 2 : -Math.PI / 2);
        B.place(K.recess, archPlateGeo(1.3, 1.5, 0.75, 5), wx, 0.6, wz, nry);
        // lantern hanging in each bay
        if (i % 3 === 1) {
          const [lx, lz] = P3(m, fixed + n * depth * 0.5);
          B.place(K.brass, LANTERN, lx, colH - 1.1, lz);
        }
      }
    }
    // pinnacles on the parapet
    for (let i = 0; i <= bays; i++) {
      const a = from + i * b;
      if (inGate(a)) continue;
      const [x, z] = P3(a, front + n * 0.25);
      B.place(K.chunar, PINNACLE, x, colH + 1.95, z);
    }
  };
  wing('x', z1, x0, x1, -1, 0, 7.0); // east (gate on the temple axis)
  wing('x', z0, x0, x1, 1, 0); // west
  wing('z', x1, z0, z1, -1, 2); // north
  wing('z', x0, z0, z1, 1, 2); // south
  for (const [x, z] of colPts) {
    B.place(K.chunarCol, colGeo, x, 0, z, 0, 1, true);
    P.solid(x - 0.3, 0, z - 0.3, x + 0.3, colH, z + 0.3);
  }
  // corner chhatris on the roof
  for (const [x, z] of [[x0 + 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z0 + 3], [x1 - 3, z1 - 3]]) {
    B.place(K.chunar, chhatriGeo(1.4, 2.0), x, colH + 1.2, z);
  }

  // ---------- gates ----------
  toranGate(B, K, P, 0, z1 - 3, 0, 1.1); // the "Ganga Dwar" of the Parisar, framing the gold shikhara
  // gilded crowns on the colonnade either side of it (as in the photographs)
  {
    const cr = tieredRoofGeo(1.6, 4, 0.45);
    for (const x of [-10.5, 10.5, -17, 17]) {
      B.span(K.chunar, x - 2.0, 7.0, z1 - 1.0, x + 2.0, 7.4, z1 + 0.2);
      B.place(K.chunarCarved, cr.geo, x, 7.4, z1 - 0.4, 0, [1, 1, 0.75]);
      B.place(K.gilt, kalashGeo(0.5), x, 7.4 + cr.top, z1 - 0.4);
    }
  }
  toranGate(B, K, P, 0, z0 + 3, 0);
  toranGate(B, K, P, x1 - 3, 2, Math.PI / 2);
  toranGate(B, K, P, x0 + 3, 2, Math.PI / 2);

  // ---------- the Gyanvapi mosque beyond the north wall: neutral background massing only ----------
  // (old lime-plaster walls stained with age, three shallow domes and a minaret, as seen in every
  //  north-facing photograph; ≈ 8 m back across the barricaded lane; outside the walkable precinct, no caption)
  {
    const W = new Merger(P, 'gyanvapi-mosque');
    const pl = K.plaster;
    W.noShadow.add(pl); W.noShadow.add(K.recess); W.noShadow.add(K.steel);
    const ex = 41; // east face
    W.span(pl, ex, 0, -20, 62, 7.6, 14, true);
    // plinth band, 0.3 m cornice and a crenellated parapet
    W.span(pl, ex - 0.15, 0, -20.15, 62, 0.7, 14.15);
    W.span(pl, ex - 0.3, 7.6, -20.3, 62, 7.9, 14.3);
    for (let z = -19.6; z <= 13.8; z += 1.2) W.box(pl, 0.35, 0.55, 0.45, ex + 0.1, 7.9, z);
    // arched recesses along the east face: deep reveals, shaded backs
    for (let z = -17.6; z <= 12; z += 3.2) blindArch(W, pl, K.recess, ex, 0.7, z, -Math.PI / 2, 1.6, 2.8, 1.0, 2.6, 4.4, 0.4);
    // the prayer hall rising behind, its own cornice, and three shallow domes on drums
    W.span(pl, ex + 4, 7.9, -17, 57, 12.5, 6);
    W.span(pl, ex + 3.7, 12.5, -17.3, 57.3, 12.8, 6.3);
    for (let z = -15.5; z <= 4.5; z += 3.3) blindArch(W, pl, K.recess, ex + 4, 8.6, z, -Math.PI / 2, 1.3, 1.6, 0.8, 2.0, 3.0, 0.3);
    for (const [z, r] of [[-12, 2.5], [-5.5, 3.2], [1, 2.5]] as const) {
      W.place(pl, lathe([[r * 1.06, 0], [r * 1.06, 0.8], [r * 1.12, 0.85], [r * 1.12, 1.0], [0, 1.0]], 24), 50, 12.8, z);
      W.place(pl, onionDome(r, 16, 24), 50, 13.8, z, 0, [1, 0.72, 1]);
      W.place(pl, kalashGeo(0.8), 50, 13.8 + r * 1.42 * 0.72, z);
    }
    // minaret at the east corner: tapering shaft, balconies, cupola
    const mx = 44, mz = 10.5;
    W.place(pl, lathe([[1.5, 0], [1.4, 9], [1.2, 9], [1.2, 9.5], [1.6, 9.6], [1.6, 9.9], [1.1, 10], [1.0, 17], [1.4, 17.1], [1.4, 17.4], [0.9, 17.5], [0.9, 20]], 12), mx, 0, mz);
    W.place(pl, chhatriGeo(1.0, 1.6), mx, 20, mz);
    // the steel barricade along the lane between the Parisar wall and the mosque
    const bx = 37.2;
    for (let z = -20; z <= 16; z += 0.16) W.box(K.steel, 0.03, 2.3, 0.03, bx, 0, z);
    for (const y of [0.15, 1.2, 2.25]) W.span(K.steel, bx - 0.04, y, -20, bx + 0.04, y + 0.06, 16);
    for (let z = -20; z <= 16; z += 2.4) W.box(K.steel, 0.09, 2.45, 0.09, bx, 0, z);
    W.flush(g);
  }

  // ---------- Gyanvapi mandap with the well and Nandi (north of the temple) ----------
  gyanvapi(B, K, P, g, flames, O);

  // ---------- restored stone shrines in the south of the court: Vishnu, Avimukteshwara (a lingam) and Parvati ----------
  for (const [x, z, deity, hi, en] of [
    [-25.5, -13, 'vishnu', 'श्री विष्णु', 'SHRI VISHNU'],
    [-25.5, 13, 'parvati', 'माँ पार्वती · गौरी', 'MAA PARVATI · GAURI'],
    [-25.5, 0, undefined, 'श्री अविमुक्तेश्वर महादेव', 'SHRI AVIMUKTESHWAR'],
  ] as const) {
    B.span(K.temple, x - 2.2, 0, z - 2.2, x + 2.2, 0.45, z + 2.2, true);
    P.floor(g, x - 2.2, x + 2.2, z - 2.2, z + 2.2, 0.45);
    cellShrine(B, K, O, P, flames, x, z, 0.45, 1.6, 3.0, 'x', K.shrineStone, 0.11, deity);
    const nb = board([[hi, 96], [en, 76]], 1.5, 0.42);
    nb.position.set(x + 1.6 + 0.07, 0.45 + 2.62, z);
    nb.rotation.y = Math.PI / 2;
    g.add(nb);
    B.span(K.shrineStone, x - 1.85, 3.45, z - 1.85, x + 1.85, 3.75, z + 1.85);
    const s = nagaraSpire(1.55, 5.4, SHRINE_CLUSTER, 4);
    B.place(K.spireStone, s.body, x, 3.75, z);
    B.place(K.spireStone, s.finials, x, 3.75, z);
    B.place(K.gilt, kalashGeo(0.5), x, 3.75 + s.topY, z);
  }

  // ---------- Kala Bhairava and Shani: small canopied shrines against the west colonnade's back wall ----------
  for (const [x, deity, hi, en] of [[-19.15, 'bhairava', 'श्री काल भैरव', 'SHRI KAAL BHAIRAV'], [20.45, 'shani', 'श्री शनिदेव', 'SHRI SHANIDEV']] as const) {
    const zb = z0 + 0.02, zf = zb + 1.15, w = 0.85, ph = 0.35;
    B.span(K.temple, x - w, 0, zb, x + w, ph, zf, true);
    P.floor(g, x - w, x + w, zb, zf, ph);
    for (const s of [-1, 1]) {
      B.box(K.templeCol, 0.18, 2.3, 0.18, x + s * (w - 0.12), ph, zf - 0.12, true);
      B.box(K.temple, 0.24, 0.12, 0.24, x + s * (w - 0.12), ph, zf - 0.12);
    }
    B.span(K.temple, x - w - 0.1, ph + 2.3, zb, x + w + 0.1, ph + 2.48, zf + 0.12);
    B.place(K.chunarCarved, tieredRoofGeo(0.95, 3, 0.3).geo, x, ph + 2.48, zb + 0.6, 0, [1, 1, 0.65]);
    murti(B, K, O, P, flames, deity, x, ph, zb + 0.55, 0);
    O.strand(new THREE.Vector3(x - w + 0.1, ph + 2.15, zf + 0.02), new THREE.Vector3(x + w - 0.1, ph + 2.15, zf + 0.02), 0.32);
    const nb = board([[hi, 100], [en, 76]], 1.4, 0.4);
    nb.position.set(x, ph + 2.39, zf + 0.13);
    g.add(nb);
  }

  // ---------- steel queue rails from the east gate to the temple steps ----------
  const rail = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n, z = za + ((zb - za) * i) / n;
      B.place(K.steel, POST, x, 0, z);
    }
    const ry = -Math.atan2(zb - za, xb - xa);
    for (const y of [0.55, 1.0]) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((xa + xb) / 2, y, (za + zb) / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
        new THREE.Vector3(1, 1, 1),
      );
      B.add(K.steel, new THREE.CylinderGeometry(0.025, 0.025, len, 6).rotateZ(Math.PI / 2), m);
    }
    P.solid(Math.min(xa, xb) - 0.06, 0, Math.min(za, zb) - 0.06, Math.max(xa, xb) + 0.06, 1.05, Math.max(za, zb) + 0.06);
  };
  // lanes with a 1.6 m crossing gap at z 12.4–14 so one can walk straight from the gate to the steps
  for (const x of [-1.6, 1.6]) { rail(x, 21.5, x, 14.0); rail(x, 12.4, x, 7.6); }
  // the darshan queue, as in the drone photographs: two railed lanes along each long face of the temple, at the
  // plinth's foot, the outer lane entered from the court near the door and walked away from it, the inner lane
  // walked back to the steps; white fabric canopies on poles over them. (Clear of the walkways round the court.)
  for (const s of [1, -1]) {
    const zi = s * QLANES.zMid, zo = s * QLANES.zOut;
    rail(QLANES.xFar + 1.0, zi, s > 0 ? -2.0 : -1.0, zi); // between the lanes, open at the far end for the U-turn
    rail(QLANES.xFar, zo, s > 0 ? -2.6 : -1.4, zo); // the outer rail, open near the door to enter
    rail(QLANES.xFar, zo, QLANES.xFar, s * 6.5); // closing the far end
    // the canopies: white cloth on steel poles, in 3 m bays
    const z0c = s * 6.3, z1c = s * (QLANES.zOut + 0.35);
    for (let x = QLANES.xFar + 0.3; x <= -2.4; x += 3.0) {
      for (const z of [z0c, z1c]) { B.box(K.steel, 0.06, 2.75, 0.06, x, 0, z); P.solid(x - 0.08, 0, z - 0.08, x + 0.08, 2.75, z + 0.08); }
    }
    const len = -2.4 - (QLANES.xFar + 0.3), cx = (QLANES.xFar + 0.3 - 2.4) / 2, cz = (z0c + z1c) / 2, wz = Math.abs(z1c - z0c) + 0.5;
    const cloth = new THREE.PlaneGeometry(len + 0.6, wz, 12, 4).rotateX(-Math.PI / 2);
    const cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) { const u = cp.getZ(i) / wz; cp.setY(i, 0.22 * (1 - 4 * u * u) - 0.05 * Math.cos((cp.getX(i) / 3.0) * Math.PI * 2)); }
    cloth.computeVertexNormals();
    B.place(K.canvas, twoSided(cloth), cx, 2.75, cz);
    for (const z of [cz - wz / 2, cz + wz / 2]) B.span(K.canvas, cx - len / 2 - 0.3, 2.45, z - 0.01, cx + len / 2 + 0.3, 2.72, z + 0.01); // valances
  }

  // a white canopy tent by the Gyanvapi mandap (as in the photographs), clear of the sight lines to the spire
  tent(B, K, P, 21.5, 0, 14.5, 0.85);

  // tall lamp posts at the court corners
  for (const [x, z] of [[x0 + 9, z1 - 9], [x1 - 9, z1 - 9], [x0 + 9, z0 + 9], [x1 - 9, z0 + 9]]) {
    B.place(K.bronze, LAMP_POST, x, 0, z);
    P.solid(x - 0.2, 0, z - 0.2, x + 0.2, 6, z + 0.2);
  }

  B.flush(g);
  return { group: g };
}

// ---------- shared small geometries ----------

const LANTERN = lathe([[0, 0], [0.12, 0.02], [0.16, 0.2], [0.12, 0.38], [0.05, 0.44], [0.015, 0.44], [0.015, 1.1], [0, 1.1]], 8);
const PINNACLE = lathe([[0, 0], [0.18, 0], [0.18, 0.1], [0.12, 0.14], [0.16, 0.3], [0.1, 0.45], [0.05, 0.62], [0, 0.7]], 10);
const POST = lathe([[0, 0], [0.09, 0], [0.09, 0.03], [0.03, 0.05], [0.03, 1.04], [0, 1.06]], 8);
const LAMP_POST = (() => {
  const g = lathe([[0, 0], [0.22, 0], [0.2, 0.5], [0.08, 0.6], [0.06, 6.2], [0.18, 6.3], [0.22, 6.6], [0.08, 6.75], [0, 6.8]], 10);
  return g;
})();

/** The chowk's river-end gateway: a tall central gate tower with a Nagara spire, flanked by two lower spired towers. */
export function eastGate(B: Merger, K: KM, P: Physics, cx: number, cz: number) {
  const d = 7.4; // depth through the colonnade
  const z0 = cz - d + 1.2, z1 = cz + 1.2;
  // central tower x ±4.6 with arched passage
  const H = 9.2;
  for (const s of [-1, 1]) {
    B.span(K.chunar, cx + s * GATE_W / 2, 0, z0, cx + s * 4.6, H, z1, true);
  }
  B.span(K.chunar, cx - GATE_W / 2, 7.2, z0, cx + GATE_W / 2, H, z1);
  for (const z of [z1 + 0.02, z0 - 0.02]) {
    B.place(K.chunar, archWallGeo(GATE_W, 7.2, 0.5, GATE_W - 0.3, 4.4, 2.6, 11), cx, 0, z);
  }
  // projecting frame + jali windows + cornice
  for (const z of [z1 + 0.3, z0 - 0.3]) {
    for (const s of [-1, 1]) {
      B.box(K.chunar, 0.6, H - 0.4, 0.6, cx + s * (GATE_W / 2 + 0.3), 0, z);
      B.box(K.recess, 0.9, 1.3, 0.05, cx + s * 3.6, 3.0, z + (z > cz - 3 ? 0.31 : -0.31));
      B.box(K.jali, 0.9, 1.3, 0.02, cx + s * 3.6, 3.0, z + (z > cz - 3 ? 0.34 : -0.34));
      B.box(K.recess, 0.9, 1.3, 0.05, cx + s * 3.6, 5.6, z + (z > cz - 3 ? 0.31 : -0.31));
    }
  }
  B.span(K.chunar, cx - 5.1, H, z0 - 0.5, cx + 5.1, H + 0.5, z1 + 0.5);
  B.span(K.chunar, cx - 4.4, H + 0.5, z0 - 0.1, cx + 4.4, H + 1.0, z1 + 0.1);
  const sp = nagaraSpire(3.5, 9.6, STONE_CLUSTER, 6);
  B.place(K.chunarCarved, sp.body, cx, H + 1.0, cz - d / 2 + 1.2);
  B.place(K.chunarCarved, sp.finials, cx, H + 1.0, cz - d / 2 + 1.2);
  B.place(K.gilt, kalashGeo(0.6), cx, H + 1.0 + sp.topY, cz - d / 2 + 1.2);
  // flanking towers
  for (const s of [-1, 1]) {
    const tx = cx + s * 8.2;
    B.span(K.chunar, tx - 3.6, 0, z0 + 0.4, tx + 3.6, 7.4, z1 - 0.4, true);
    for (const z of [z1 - 0.38, z0 + 0.38]) {
      blindArch(B, K.chunarWall, K.recess, tx, 0.8, z, z > cz - 3 ? 0 : Math.PI, 1.4, 2.4, 1.0, 2.4, 3.9, 0.4);
      B.box(K.recess, 1.2, 1.2, 0.05, tx, 4.9, z + (z > cz - 3 ? 0.01 : -0.01));
      B.box(K.jali, 1.2, 1.2, 0.02, tx, 4.9, z + (z > cz - 3 ? 0.05 : -0.05));
    }
    B.span(K.chunar, tx - 3.9, 7.4, z0, tx + 3.9, 7.8, z1);
    const ss = nagaraSpire(2.6, 6.6, SHRINE_CLUSTER, 5);
    B.place(K.chunarCarved, ss.body, tx, 7.8, cz - d / 2 + 1.2);
    B.place(K.chunarCarved, ss.finials, tx, 7.8, cz - d / 2 + 1.2);
    B.place(K.gilt, kalashGeo(0.55), tx, 7.8 + ss.topY, cz - d / 2 + 1.2);
  }
  // garland over the passage
  P.solid(cx - 12, 0, z0, cx - 4.6, 7.4, z1);
  P.solid(cx + 4.6, 0, z0, cx + 12, 7.4, z1);
}

/**
 * Toran gateway in the style of the Dham's "Ganga Dwar" (the Parisar's east gate): two pylons with jali
 * balconies flank a cusped arch under a flat lintel; a heavy projecting cornice carries gilded,
 * stepped crowns. Passage runs along z when ry = 0, along x when ry = π/2.
 */
export function toranGate(B: Merger, K: KM, P: Physics, cx: number, cz: number, ry: number, scale = 1) {
  const D = 7.2, gw = GATE_W * scale, tw = 3.6 * scale, H = 10.4 * scale;
  const along = (a: number, b: number) => (ry === 0 ? [cx + a, cz + b] : [cx + b, cz + a]) as [number, number];
  const box = (mat: THREE.Material, a0: number, a1: number, y0: number, y1: number, b0: number, b1: number, solid = false) => {
    const [xa, za] = along(a0, b0), [xb, zb] = along(a1, b1);
    B.span(mat, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb), solid);
  };
  const face = (b: number) => (ry === 0 ? (b > 0 ? 0 : Math.PI) : (b > 0 ? Math.PI / 2 : -Math.PI / 2));
  const crown = tieredRoofGeo(2.1 * scale, 5, 0.52 * scale);
  for (const s of [-1, 1]) {
    const a0 = s * gw / 2, a1 = s * (gw / 2 + tw), am = (a0 + a1) / 2;
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    box(K.chunarWall, lo, hi, 0, H, -D / 2, D / 2, true);
    box(K.chunar, lo - 0.15, hi + 0.15, 0, 0.9, -D / 2 - 0.15, D / 2 + 0.15);
    for (const b of [D / 2, -D / 2]) {
      const o = Math.sign(b);
      // horizontal mouldings
      for (const y of [2.6, 6.0, 8.3]) box(K.chunar, lo - 0.08, hi + 0.08, y * scale, y * scale + 0.2, b - (o < 0 ? 0.25 : 0), b + (o > 0 ? 0.25 : 0));
      // jali balcony: dark screen, sill, colonnettes, canopy
      const [jx, jz] = along(am, b + o * 0.02);
      B.box(K.recess, 1.3 * scale, 1.8 * scale, 0.05, jx, 3.4 * scale, jz, false, face(b));
      box(K.chunar, am - 0.95 * scale, am + 0.95 * scale, 3.0 * scale, 3.3 * scale, b - (o < 0 ? 0.6 : 0), b + (o > 0 ? 0.6 : 0));
      box(K.chunar, am - 1.05 * scale, am + 1.05 * scale, 5.3 * scale, 5.5 * scale, b - (o < 0 ? 0.75 : 0), b + (o > 0 ? 0.75 : 0));
      for (const u of [-0.8, 0.8]) {
        const [cx2, cz2] = along(am + u * scale, b + o * 0.45);
        B.box(K.chunar, 0.14, 2.0 * scale, 0.14, cx2, 3.3 * scale, cz2);
      }
      // jali screen in front of the dark opening, and a little chhajja canopy with kalashas
      const [qx, qz] = along(am, b + o * 0.05);
      B.box(K.jali, 1.3 * scale, 1.8 * scale, 0.02, qx, 3.4 * scale, qz, false, face(b));
      for (const u of [-0.7, 0, 0.7]) {
        const [kx2, kz2] = along(am + u * scale, b + o * 0.5);
        B.place(K.chunar, kalashGeo(0.3 * scale, 10), kx2, 5.5 * scale, kz2);
      }
      // vertical pilaster strips every 0.6 m and three cornice courses near the top
      for (let a = lo + 0.3; a <= hi - 0.25; a += 0.6) {
        if (Math.abs(a - am) < 1.15 * scale) continue;
        box(K.chunarWall, a - 0.07, a + 0.07, 0.9, H - 0.9, b - (o < 0 ? 0.08 : 0), b + (o > 0 ? 0.08 : 0));
      }
      for (const [y0, y1, pr] of [[H - 0.9, H - 0.75, 0.15], [H - 0.75, H - 0.5, 0.25], [H - 0.5, H - 0.3, 0.12]] as const) {
        box(K.chunar, lo - pr, hi + pr, y0, y1, b - (o < 0 ? pr : 0), b + (o > 0 ? pr : 0));
      }
      // upper niche
      const [nx, nz] = along(am, b + o * 0.01);
      blindArch(B, K.chunarWall, K.recess, nx, 6.5 * scale, nz, face(b), 1.0 * scale, 0.7 * scale, 0.55 * scale, 1.5 * scale, 1.6 * scale, 0.4);
      // pilaster beside the passage
      box(K.chunar, a0 + (s > 0 ? 0 : -0.55), a0 + (s > 0 ? 0.55 : 0), 0, H - 0.3, b - (o < 0 ? 0.35 : 0), b + (o > 0 ? 0.35 : 0));
    }
    // heavy cornice and gilded crown on the pylon
    box(K.chunar, lo - 0.5, hi + 0.5, H, H + 0.35, -D / 2 - 0.9, D / 2 + 0.9);
    box(K.chunar, lo - 0.2, hi + 0.2, H + 0.35, H + 0.75, -D / 2 - 0.3, D / 2 + 0.3);
    const [kx, kz] = along(am, 0);
    B.place(K.chunarCarved, crown.geo, kx, H + 0.75, kz, ry, [1, 1, 1.6]);
    B.place(K.gilt, kalashGeo(Math.min(0.6, 0.5 * scale)), kx, H + 0.75 + crown.top, kz);
  }
  // lintel over the passage, cusped arch on both faces, inscription band
  box(K.chunar, -gw / 2, gw / 2, 7.6 * scale, H, -D / 2, D / 2);
  for (const b of [D / 2 + 0.02, -D / 2 - 0.02]) {
    const [x, z] = along(0, b);
    B.place(K.chunar, archWallGeo(gw, 7.6 * scale, 0.5, gw - 0.4, 4.4 * scale, 2.7 * scale, 13), x, 0, z, ry);
    const [ix, iz] = along(0, b + Math.sign(b) * 0.26);
    B.box(K.gilt, gw - 1.2, 0.5 * scale, 0.04, ix, 8.4 * scale, iz, false, ry);
  }
  box(K.chunar, -gw / 2 - 0.3, gw / 2 + 0.3, H, H + 0.35, -D / 2 - 0.9, D / 2 + 0.9);
  const [mx, mz] = along(0, 0);
  B.place(K.chunarCarved, crown.geo, mx, H + 0.35, mz, ry, [0.8, 0.8, 1.4]);
  B.place(K.gilt, kalashGeo(Math.min(0.6, 0.5 * scale)), mx, H + 0.35 + crown.top * 0.8, mz);
  // the passage walls are carved too: pilasters and niches along both sides
  for (const s of [-1, 1]) {
    const a = s * gw / 2;
    for (let t = -D / 2 + 0.6; t <= D / 2 - 0.6; t += 1.2) {
      box(K.chunarWall, a - (s > 0 ? 0.08 : 0), a + (s < 0 ? 0.08 : 0), 0, 7.4 * scale, t - 0.1, t + 0.1);
    }
    box(K.chunar, a - (s > 0 ? 0.15 : 0), a + (s < 0 ? 0.15 : 0), 4.5 * scale, 4.7 * scale, -D / 2, D / 2);
    box(K.chunar, a - (s > 0 ? 0.12 : 0), a + (s < 0 ? 0.12 : 0), 0, 0.5, -D / 2, D / 2);
  }
  // carved doors folded back against the passage walls
  for (const s of [-1, 1]) box(K.door, s * gw / 2 - (s > 0 ? 0.12 : 0), s * gw / 2 + (s < 0 ? 0.12 : 0), 0, 4.4 * scale, D / 2 - 2.6, D / 2 - 0.2);
  void P;
}

/**
 * A recessed cusped bay on a wall face: a carved frame projecting `depth` from the wall (so the
 * opening has real reveals), its back a lit, shaded stone (not a black hole). (x, y, z) is the
 * point on the wall surface at the arch's foot; ry faces outward as for archPlateGeo.
 */
export function blindArch(B: Merger, frame: THREE.Material, back: THREE.Material, x: number, y: number, z: number, ry: number,
  ow: number, sy: number, rise: number, W: number, H: number, depth: number) {
  const nx = Math.sin(ry), nz = Math.cos(ry);
  B.place(frame, archWallGeo(W, H, depth, ow, sy, rise, 7), x + nx * depth / 2, y, z + nz * depth / 2, ry);
  B.place(back, archPlateGeo(ow, sy, rise, 7), x + nx * 0.01, y, z + nz * 0.01, ry);
}

/** Gyanvapi mandap: pillared pavilion with the well (behind silver grilles) and the great Nandi. */
function gyanvapi(B: Merger, K: KM, P: Physics, g: THREE.Group, flames: Flames, O: Offerings) {
  const x0 = 15.2, x1 = 24.2, z0 = -5.5, z1 = 5.5, h = 0.45, colH = 3.4;
  B.span(K.marble, x0, 0, z0, x1, h, z1);
  P.floor(g, x0, x1, z0, z1, h);
  const col = cylUV(columnGeometry(colH, 0.18), 0.2);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i === 1 || i === 2) && (j === 1 || j === 2)) continue;
      const x = x0 + 0.5 + (i * (x1 - x0 - 1)) / 3, z = z0 + 0.5 + (j * (z1 - z0 - 1)) / 3;
      B.place(K.templeCol, col, x, h, z, 0, 1, true);
      P.solid(x - 0.24, h, z - 0.24, x + 0.24, h + colH, z + 0.24);
    }
  }
  B.span(K.temple, x0 - 0.1, h + colH, z0 - 0.1, x1 + 0.1, h + colH + 0.45, z1 + 0.1);
  B.span(K.temple, x0 - 0.8, h + colH + 0.45, z0 - 0.8, x1 + 0.8, h + colH + 0.6, z1 + 0.8);
  B.span(K.temple, x0, h + colH + 0.6, z0, x1, h + colH + 1.1, z1);
  // the well, as in the travel films: no open curb but a white marble enclosure of carved walls pierced by jali
  // screens, lotus-bud finials on its corner posts; inside, the well's mouth covered over by the marble floor,
  // heaped with marigolds and strewn with rose petals, bel leaves and coins (the linga, tradition says, still in it)
  const wx = 21.8, wz = 0, ws = 1.4, wt = 0.14, wh = 1.95;
  B.span(K.marble, wx - ws, h, wz - ws, wx + ws, h + 0.06, wz + ws); // the covered floor
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    B.span(K.marble, x0, h, z0, x1, h + 0.72, z1); // carved dado
    B.span(K.marble, x0, h + 0.72, z0, x1, h + 0.8, z1); // sill
    B.span(K.jali, x0 + (x1 - x0 > 1 ? 0.1 : 0), h + 0.8, z0 + (z1 - z0 > 1 ? 0.1 : 0), x1 - (x1 - x0 > 1 ? 0.1 : 0), h + 1.62, z1 - (z1 - z0 > 1 ? 0.1 : 0));
    B.span(K.marble, x0, h + 1.62, z0, x1, h + wh, z1); // frieze
  };
  side(wx - ws, wz - ws, wx + ws, wz - ws + wt);
  side(wx - ws, wz + ws - wt, wx + ws, wz + ws);
  // the west side, toward Nandi, open in its middle: a doorway with a low silver rail to look in at the well
  const dw = 0.45;
  side(wx - ws, wz - ws + wt, wx - ws + wt, wz - dw);
  side(wx - ws, wz + dw, wx - ws + wt, wz + ws - wt);
  B.span(K.marble, wx - ws, h + 1.62, wz - dw, wx - ws + wt, h + wh, wz + dw); // lintel over the doorway
  B.span(K.silverBright, wx - ws - 0.02, h + 0.55, wz - dw, wx - ws + 0.02, h + 0.6, wz + dw);
  side(wx + ws - wt, wz - ws + wt, wx + ws, wz + ws - wt);
  // an open coping round the top
  for (const [a0, a1, b0, b1] of [[-ws - 0.06, ws + 0.06, -ws - 0.06, -ws + wt + 0.02], [-ws - 0.06, ws + 0.06, ws - wt - 0.02, ws + 0.06],
    [-ws - 0.06, -ws + wt + 0.02, -ws + wt, ws - wt], [ws - wt - 0.02, ws + 0.06, -ws + wt, ws - wt]]) {
    B.span(K.marble, wx + a0, h + wh, wz + b0, wx + a1, h + wh + 0.08, wz + b1);
  }
  const bud = lathe([[0, 0], [0.1, 0], [0.1, 0.05], [0.07, 0.08], [0.11, 0.16], [0.09, 0.24], [0.04, 0.3], [0.02, 0.34], [0, 0.36]], 16, 8, 0.12);
  for (const [x, z] of [[wx - ws, wz - ws], [wx + ws, wz - ws], [wx - ws, wz + ws], [wx + ws, wz + ws]]) {
    B.box(K.marble, 0.24, wh + 0.1, 0.24, x, h, z);
    B.place(K.marble, bud, x, h + wh + 0.1, z);
  }
  P.solid(wx - ws - 0.15, h, wz - ws - 0.15, wx + ws + 0.15, h + wh + 0.5, wz + ws + 0.15);
  // the offerings on the covered well: two heaps of marigold garlands, petals and bel everywhere, coins
  O.heap(wx - 0.5, h + 0.06, wz - 0.55, 0.32, 0.14, 26);
  O.heap(wx + 0.35, h + 0.06, wz + 0.45, 0.36, 0.12, 30);
  O.scatter(wx - ws + 0.2, wx + ws - 0.2, wz - ws + 0.2, wz + ws - 0.2, h + 0.065, 70, 0.3);
  const coin = new THREE.CylinderGeometry(0.012, 0.012, 0.003, 12);
  const coinM = new THREE.MeshStandardMaterial({ color: 0xc9b37a, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, r = 0.25 + ((i * 37) % 100) / 100;
    B.place(coinM, coin, wx + Math.cos(a) * r, h + 0.064, wz + Math.sin(a) * r * 0.9);
  }
  // Nandi, seated, polished dark stone, facing north (+x) as at Kashi
  nandi(g, K, O, 17.6, h, 0);
  P.solid(16.0, h, -0.85, 19.5, h + 2.2, 0.85);
  flames.points.push(new THREE.Vector3(19.4, h + 0.45, -0.55), new THREE.Vector3(19.4, h + 0.45, 0.55));
}


/**
 * A small shrine cell (half-size `half`, walls `wallH` high on a base at y0) with its doorway on the
 * +x or +z face, and a shivling inside facing the door. Pranala to the north (+x).
 */
export function cellShrine(B: Merger, K: KM, O: Offerings, P: Physics, flames: Flames, x: number, z: number, y0: number, half: number, wallH: number, door: 'x' | 'z', mat: THREE.Material = K.shrineStone, lingR = 0.11, deity?: Deity) {
  const t = 0.32, dw = Math.min(1.0, half * 0.75);
  const yt = y0 + wallH;
  const wall = (x0: number, z0: number, x1: number, z1: number, ya = y0, yb = yt, solid = true) => B.span(mat, x + x0, ya, z + z0, x + x1, yb, z + z1, solid);
  if (door === 'x') {
    wall(-half, -half, half, -half + t); wall(-half, half - t, half, half); wall(-half, -half, -half + t, half);
    wall(half - t, -half, half, -dw / 2); wall(half - t, dw / 2, half, half);
    wall(half - t, -dw / 2, half, dw / 2, y0 + 2.0, yt, false);
  } else {
    wall(-half, -half, -half + t, half); wall(half - t, -half, half, half); wall(-half, -half, half, -half + t);
    wall(-half, half - t, -dw / 2, half); wall(dw / 2, half - t, half, half);
    wall(-dw / 2, half - t, dw / 2, half, y0 + 2.0, yt, false);
  }
  B.span(mat, x - half, yt - 0.25, z - half, x + half, yt, z + half);
  // carved door frame
  const [fx, fz, ry] = door === 'x' ? [x + half + 0.03, z, Math.PI / 2] : [x, z + half + 0.03, 0];
  B.place(K.temple, archWallGeo(dw + 0.5, 2.25, 0.08, dw, 1.55, 0.45, 5), fx, y0, fz, ry);
  // the lingam (or the shrine's murti, against the back wall, facing the door), a lamp and a garland at the door
  const face = door === 'x' ? 0 : Math.PI / 2;
  if (deity) {
    murti(B, K, O, P, flames, deity, x - (door === 'x' ? half - 0.75 : 0), y0, z - (door === 'z' ? half - 0.75 : 0), door === 'x' ? Math.PI / 2 : 0);
  } else {
    shivling(B, K, O, x - (door === 'x' ? 0.15 : 0), y0, z - (door === 'z' ? 0.15 : 0), { r: lingR, pitha: 'round', face, adorn: 0.7 });
    P.solid(x - 0.55, y0, z - 0.55, x + 0.55, y0 + 0.8, z + 0.55);
  }
  const [lx, lz] = door === 'x' ? [x + half - 0.5, z + dw / 2 + 0.15] : [x + dw / 2 + 0.15, z + half - 0.5];
  flames.points.push(new THREE.Vector3(lx, y0 + 0.08, lz));
  const a = door === 'x' ? new THREE.Vector3(x + half + 0.1, y0 + 2.15, z - dw / 2 - 0.1) : new THREE.Vector3(x - dw / 2 - 0.1, y0 + 2.15, z + half + 0.1);
  const b = door === 'x' ? new THREE.Vector3(x + half + 0.1, y0 + 2.15, z + dw / 2 + 0.1) : new THREE.Vector3(x + dw / 2 + 0.1, y0 + 2.15, z + half + 0.1);
  O.strand(a, b, 0.28);
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Flag, type Physics } from '../../engine/kit';
import { nandiMesh } from './nandi';
import type { GM } from './mats';
import type { Merger } from './merge';
import { lathe, type Offerings } from './offerings';
import { niche3D, archPanel } from './sculpt';
import {
  rathaPlan, rect, offset, strip, cap, ring, prism, chhajjaGeo, along, pendantGeo, bulbGeo, boxAt, cyl, heavyPillarGeo, type P,
} from './geo';

/**
 * Shri Ghrishneshwar temple (Ahilyabai Holkar's rebuilding, 18th c.), red basalt, facing east.
 * Frame: metres, +z = east (the mandapa and the main door), +x = north, origin = centre of the
 * garbhagriha at courtyard level (y = 0).
 *
 * Proportions read from the photographs (people for scale) and the published plan facts:
 * garbhagriha 17 × 17 ft inside (5.2 m), lingam facing east; a sabha mandapa on 24 pillars;
 * a five-tiered shikhara; the whole temple about 240 × 185 ft with its court.
 *
 *  plinth (adhishthana)      0.0 – 1.5   three courses with pendant drops
 *  red jangha                1.5 – 7.0   carved courses, rosette roundels, a window niche per side
 *  chhajja                   7.0         sloped eave with lotus-bud pendants
 *  gajathara                 7.2 – 8.3   elephants in bays (dark stone)
 *  niche band                8.45 – 10.55 painted Dashavatara / Shiva-lila niches (pink + cream)
 *  cornice                   10.55 – 11.2
 *  shikhara                  11.2 – 21.4 lotus-bud row + eight rows of miniature shrines, creeper spine
 *  lotus collar + dome       21.6 – 24.3, gilt kalash to ≈ 25.5, flag above
 */

export const F_M = 1.5; // plinth top = mandapa / antarala floor
export const F_G = 0.45; // garbhagriha floor (below the mandapa: one goes down to the lingam)
export const G_IN = 2.6; // half inner size of the garbhagriha (5.2 m = 17 ft)
export const BODY = 5.4; // half outer size of the garbhagriha body (karna faces)
export const BHADRA = 0.6;
export const DOOR = { half: 0.55, top: 3.7, z0: G_IN, z1: BODY + BHADRA };
export const MANDAPA = { half: 6.0, z0: 8.0, z1: 20.0, zc: 14.0 };
export const NANDI = { x: 0, z: 14.4 };
/** stairs at the three porches (for floors / zones) */
export const PORCH = { east: 24.8, side: 10.8 };
/** the mandapa's clear height: the beam soffit (low and heavy, as photographed) */
export const BEAM = 4.6;
/** outer offsets of the garbhagriha plinth's three tiers; the top one is the pradakshina walk */
export const TIER = [2.6, 2.15, 1.7];

const GRID = [-6, -3.6, -1.2, 1.2, 3.6, 6];

export function buildTemple(root: THREE.Object3D, B: Merger, K: GM, P: Physics, O: Offerings, nandiGeo: THREE.BufferGeometry) {
  const body = rathaPlan(BODY, 1.9, 1.3, 0.32, BHADRA);
  /** the east bhadra is inside the antarala up to its roof: skip those wall faces there */
  const eastBhadra = (_i: number, m: THREE.Vector3) => m.z > BODY + 0.1 && Math.abs(m.x) < 2.3;

  // ---------------- plinth (adhishthana) ----------------
  const sanctPl = TIER.map((t) => offset(body, t));
  const mandPl = [rect(-7.4, 6.6, 7.4, 21.4), rect(-7.0, 7.0, 7.0, 21.0), rect(-6.6, 7.4, 6.6, 20.6)];
  for (let c = 0; c < 3; c++) {
    const y0 = c * 0.5, y1 = y0 + 0.5;
    // sides, and a ring-shaped tread (never a full cap: the sanctum lies inside, below the plinth top)
    B.add(K.plinth, strip(sanctPl[c], y0, sanctPl[c], y1, 1, 0));
    B.add(K.redDark, ring(body, sanctPl[c], y1));
    B.add(K.plinth, prism(mandPl[c], y0, y1));
    // colliders: the mandapa tiers are solid blocks (its floor sits on top at F_M); the sanctum tiers
    // are rings round the body, so the sunken garbhagriha inside stays open
    const [mx0, mz0, mx1, mz1] = bbox(mandPl[c]);
    P.solid(mx0, 0, mz0, mx1, y1, mz1);
    // follow the ratha: the karna hull, plus the projecting pratiratha and bhadra bands
    const o2 = BODY + BHADRA;
    for (const [e, w] of [[BODY + TIER[c], BODY + TIER[c]], [BODY + 0.32 + TIER[c], 3.5], [o2 + TIER[c], 2.2]] as const) {
      P.solid(BODY, 0, -w, e, y1, w);
      P.solid(-e, 0, -w, -BODY, y1, w);
      P.solid(-w, 0, -e, w, y1, -BODY);
      P.solid(-w, 0, o2, w, y1, Math.max(o2, e));
    }
  }
  // flights of steps up to the pradakshina walk on the north and south (pilgrims climb here, photo 06_)
  for (const s of [-1, 1]) {
    const N = 8, rise = F_M / N, run = 0.3, x0 = BODY + BHADRA + TIER[2];
    for (let i = 0; i < N; i++) {
      // the first tread is level with the walk, so the top of the flight meets the tier flush
      const top = F_M - rise * i, xa = x0 + i * run, xb = xa + run;
      B.span(K.redDark, s > 0 ? xa : -xb, 0, -1.4, s > 0 ? xb : -xa, top, 1.4);
      P.floor(root, s > 0 ? xa - 0.02 : -xb, s > 0 ? xb : -xa + 0.02, -1.4, 1.4, top);
    }
    // stone cheek walls either side of the flight
    for (const z of [-1.7, 1.4]) {
      for (let i = 0; i < N; i += 2) {
        const xa = x0 + i * run - 0.6, xb = xa + run * 2 + 0.6;
        B.span(K.plinth, s > 0 ? xa : -xb, 0, z, s > 0 ? xb : -xa, F_M - rise * i + 0.3, z + 0.3, true);
      }
    }
  }
  // porches: east and the two sides, with their flights of steps
  porch(root, B, K, P, 'east');
  porch(root, B, K, P, 'north');
  porch(root, B, K, P, 'south');

  // marigold torans across the three porch openings (photos 15_, n_g1)
  const toran = (a: THREE.Vector3, b: THREE.Vector3) => {
    O.strand(a, b, 0.32, 1.1);
    for (let t = 0.1; t < 0.95; t += 0.2) {
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.32;
      O.strand(p, p.clone().add(new THREE.Vector3(0, -0.45, 0)), 0.0, 1.0);
    }
  };
  const pz = MANDAPA.z1 + 0.4 + 1.8 - 0.3, px = MANDAPA.half + 0.4 + 1.8 - 0.3;
  toran(new THREE.Vector3(-1.85, BEAM - 0.1, pz + 0.3), new THREE.Vector3(1.85, BEAM - 0.1, pz + 0.3));
  for (const s of [-1, 1]) toran(new THREE.Vector3(s * (px + 0.3), BEAM - 0.1, MANDAPA.zc - 1.85), new THREE.Vector3(s * (px + 0.3), BEAM - 0.1, MANDAPA.zc + 1.85));

  // ---------------- garbhagriha body ----------------
  // base mouldings (khura, kumbha) proud of the wall, then the carved jangha
  B.add(K.wall, strip(offset(body, 0.24), F_M, offset(body, 0.24), 1.9, 1, 0, eastBhadra));
  B.add(K.wall, ring(body, offset(body, 0.24), 1.9, eastBhadra));
  B.add(K.wall, strip(offset(body, 0.13), 1.9, offset(body, 0.13), 2.3, 1, 0, eastBhadra));
  B.add(K.wall, ring(body, offset(body, 0.13), 2.3, eastBhadra));
  B.add(K.wall, strip(offset(body, 0.17), 2.36, offset(body, 0.17), 3.0, 1, 0, eastBhadra));
  B.add(K.wall, ring(body, offset(body, 0.17), 3.0, eastBhadra));
  // more projecting mouldings (photos 14_, 05_): lozenge course, kapota, chequer course, upper kapota
  const band = (d: number, y0: number, y1: number, mat: THREE.Material = K.wall) => {
    const o = offset(body, d);
    B.add(mat, strip(o, y0, o, y1, 1, 0, eastBhadra));
    B.add(mat, ring(body, o, y1, eastBhadra));
    B.add(K.redDark, strip(body, y0, o, y0, 0, -1, eastBhadra));
  };
  band(0.07, 3.06, 3.36);
  band(0.24, 3.36, 3.52, K.redDark);
  band(0.1, 5.56, 5.62, K.redDark);
  band(0.05, 5.62, 5.88);
  band(0.22, 6.55, 6.82, K.redDark);
  band(0.12, 4.0, 4.08, K.redDark);
  B.add(K.wall, strip(body, F_M, body, 6.5, 1, 0, eastBhadra));
  B.add(K.wall, strip(body, 6.5, body, 7.05, 1, 0));
  // a small window niche (jharokha) on each of the north, south and west bhadras
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, -1]] as const) {
    const d = BODY + BHADRA;
    const cx = nx * d, cz = nz * d, ry = nx ? Math.PI / 2 : 0;
    B.add(K.redDark, boxAt(1.5, 0.16, 0.5, cx, 4.0, cz, ry)); // sill
    B.add(K.redDark, boxAt(1.6, 0.3, 0.5, cx, 5.5, cz, ry)); // hood
    for (const s of [-1, 1]) B.add(K.red, boxAt(0.22, 1.36, 0.36, cx + (nz ? s * 0.62 : 0), 4.14, cz + (nx ? s * 0.62 : 0)));
    B.add(K.dark, boxAt(nz ? 0.9 : 0.06, 1.3, nx ? 0.9 : 0.06, cx + nx * 0.01, 4.16, cz + nz * 0.01));
  }
  // carved rosette roundels on the karna faces (as in the photographs)
  const ros = cyl(0.26, 0.26, 0.08, 16, 0, 0, 0).rotateX(Math.PI / 2);
  for (const [px, pz, ry] of [[BODY, -4.4, Math.PI / 2], [BODY, 4.4, Math.PI / 2], [-BODY, -4.4, -Math.PI / 2], [-BODY, 4.4, -Math.PI / 2], [-4.4, -BODY, Math.PI], [4.4, -BODY, Math.PI]] as const) {
    const g = ros.clone().rotateY(ry).translate(px + Math.sign(px) * 0.02 * (Math.abs(px) === BODY ? 1 : 0), 4.55, pz + Math.sign(pz) * 0.02 * (Math.abs(pz) === BODY ? 1 : 0));
    B.add(K.red, g);
  }

  // ---------------- chhajja and the upper bands ----------------
  B.add(K.redDark, chhajjaGeo(body, 7.15, 0.85, 0.42, 0.1));
  pendants(B, K.redDark, offset(body, 0.82), 7.15 - 0.42 - 0.1, 0.38);
  // festival garland swags hung from the eave (photo 14_)
  {
    const pts = along(offset(body, 0.86), 1.6, 0.2);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i].p, b = pts[i + 1].p;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 2.0) continue;
      if (a[1] > BODY && Math.abs(a[0]) < 3.2) continue; // not inside the antarala roof
      O.strand(new THREE.Vector3(a[0], 6.6, a[1]), new THREE.Vector3(b[0], 6.6, b[1]), 0.35, 0.9);
    }
  }
  B.add(K.redDark, prism(offset(body, -0.05), 7.05, 7.22));
  B.add(K.elephant, prism(offset(body, -0.15), 7.22, 8.3, false));
  B.add(K.redDark, prism(offset(body, -0.05), 8.3, 8.45));
  // the niche band in real relief (review P1-1): the pink ground is set back 0.15 m behind the pilasters,
  // each bay is headed by a cusped cream torana and holds a carved figure in high relief
  const nb = offset(body, -0.25), nbBack = offset(body, -0.4);
  K.niche.forEach((m, v) => B.add(m, strip(nbBack, 8.45, nbBack, 10.55, 1, 0, (i) => i % K.niche.length !== v)));
  B.add(K.cream, strip(nbBack, 10.55, offset(body, -0.12), 10.55, 0, -1)); // soffit over the recess
  const figs = niche3D(), arch = archPanel(0.8, 0.62, 0.05, 0.34);
  let fi = 0;
  for (let i = 0; i < nb.length; i++) {
    const a = nb[i], b = nb[(i + 1) % nb.length];
    const n = [b[1] - a[1], -(b[0] - a[0])];
    const len = Math.hypot(n[0], n[1]);
    if (len < 0.5) continue;
    const nx = n[0] / len, nz = n[1] / len, alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
    const u0 = alongX ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]), u1 = alongX ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
    const at = (u: number, o: number): [number, number] => (alongX ? [u, a[1] + nz * o] : [a[0] + nx * o, u]);
    const ry = Math.atan2(nx, nz);
    // bays spread evenly along each face (≈1 m), a pilaster at every bay boundary standing proud of the
    // recessed ground (0.21 m deep) with capital and base blocks
    const PW = 0.2, nBay = Math.max(1, Math.round((u1 - u0 - PW) / 1.0)), bw = (u1 - u0 - PW) / nBay;
    for (let k = 0; k <= nBay; k++) {
      const u = u0 + PW / 2 + k * bw;
      const [x, z] = at(u, -0.045);
      B.add(K.pink, boxAt(alongX ? PW : 0.21, 2.0, alongX ? 0.21 : PW, x, 8.5, z));
      const [x2, z2] = at(u, 0.0);
      B.add(K.cream, boxAt(alongX ? 0.28 : 0.25, 0.12, alongX ? 0.25 : 0.28, x2, 10.36, z2));
      B.add(K.cream, boxAt(alongX ? 0.28 : 0.25, 0.1, alongX ? 0.25 : 0.28, x2, 8.45, z2));
    }
    // each bay: a cusped torana, a lotus sill, and a carved figure
    for (let k = 0; k < nBay; k++) {
      const uc = u0 + PW / 2 + (k + 0.5) * bw, cw = bw - PW;
      const [x, z] = at(uc, -0.1);
      B.place(K.cream, arch, x, 9.93, z, ry, [cw / 0.8, 1, 1]);
      const [sx, sz] = at(uc, -0.15);
      B.add(K.cream, boxAt(alongX ? cw : 0.12, 0.08, alongX ? 0.12 : cw, sx + nx * 0.06, 8.55, sz + nz * 0.06));
      B.place(K.figure, figs[(fi++ * 7 + i) % figs.length], sx, 8.63, sz, ry, Math.min(1.18, cw * 1.6));
    }
  }
  B.add(K.cream, prism(offset(body, -0.12), 10.55, 10.7));
  B.add(K.cream, prism(offset(body, 0.04), 10.7, 10.98));
  B.add(K.cream, prism(offset(body, 0.14), 10.98, 11.2));
  // dentils under the cornice
  const dent = boxAt(0.1, 0.12, 0.12, 0, 0, 0);
  for (const { p, n } of along(offset(body, 0.0), 0.22)) {
    B.place(K.cream, dent, p[0] + n[0] * 0.03, 10.84, p[1] + n[1] * 0.03);
  }

  // ---------------- shikhara ----------------
  shikhara(root, B, K, nandiGeo);

  // ---------------- antarala (vestibule) ----------------
  const AZ0 = BODY + 0.25, AZ1 = MANDAPA.z0;
  for (const s of [-1, 1]) {
    B.span(K.wall, s > 0 ? 2.6 : -3.0, F_M, AZ0, s > 0 ? 3.0 : -2.6, 6.2, AZ1 + 0.2, false);
    P.solid(s > 0 ? 2.6 : -3.0, F_M, AZ0, s > 0 ? 3.0 : -2.6, 6.2, AZ1);
  }
  B.span(K.red, -3.2, 6.2, AZ0 - 0.2, 3.2, 6.55, AZ1 + 0.3);
  B.add(K.redDark, chhajjaGeo(rect(-3.2, AZ0, 3.2, AZ1 + 0.3), 6.5, 0.55, 0.3, 0.08));
  // the sanctum's east face inside the antarala: door wall with the doorway down to the lingam
  const dz = BODY + BHADRA;
  B.span(K.wall, -2.25, F_M, dz - 0.1, -DOOR.half - 0.25, 6.5, dz);
  B.span(K.wall, DOOR.half + 0.25, F_M, dz - 0.1, 2.25, 6.5, dz);
  B.span(K.wall, -DOOR.half - 0.25, DOOR.top + 0.35, dz - 0.1, DOOR.half + 0.25, 6.5, dz);
  doorFrame(B, K, dz);

  // ---------------- sabha mandapa ----------------
  mandapa(root, B, K, P);

  // ---------------- Nandi ----------------
  // a moulded basalt pedestal: plinth, recessed body, projecting lip
  B.span(K.nandiBase, NANDI.x - 0.62, F_M, NANDI.z - 1.22, NANDI.x + 0.62, F_M + 0.08, NANDI.z + 1.22);
  B.span(K.nandiBase, NANDI.x - 0.52, F_M + 0.08, NANDI.z - 1.12, NANDI.x + 0.52, F_M + 0.2, NANDI.z + 1.12);
  B.span(K.nandiBase, NANDI.x - 0.6, F_M + 0.2, NANDI.z - 1.2, NANDI.x + 0.6, F_M + 0.28, NANDI.z + 1.2);
  const nandi = new THREE.Mesh(nandiGeo, K.nandi);
  const NS = 0.78, ny = F_M + 0.28, nz = NANDI.z + 0.1;
  nandi.scale.setScalar(NS);
  nandi.position.set(NANDI.x, ny, nz);
  nandi.castShadow = nandi.receiveShadow = true;
  root.add(nandi);
  // the carved bell-and-chain harness round the neck, and a bell under the dewlap (brass-coloured)
  {
    const L = (x: number, y: number, z: number) => new THREE.Vector3(NANDI.x + x * NS, ny + y * NS, nz + z * NS);
    const collar = new THREE.TorusGeometry(0.235 * NS, 0.022 * NS, 6, 28).rotateX(Math.PI / 2).rotateX(-0.75);
    const c0 = L(0, 0.84, -0.74);
    B.add(K.gold, collar.toNonIndexed().translate(c0.x, c0.y, c0.z));
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.36, p = L(Math.sin(a) * 0.235, 0.84 - Math.cos(a) * 0.235 * 0.68 - 0.01, -0.74 - Math.cos(a) * 0.235 * 0.73);
      B.place(K.gold, new THREE.SphereGeometry(0.03 * NS, 8, 6), p.x, p.y, p.z);
    }
    const bell = lathe([[0, 0], [0.07, 0], [0.065, 0.02], [0.05, 0.07], [0.035, 0.11], [0.012, 0.13], [0, 0.135]], 14);
    const b0 = L(0, 0.47, -0.92);
    B.place(K.gold, bell, b0.x, b0.y, b0.z, 0, NS);
  }
  P.solid(NANDI.x - 0.6, F_M, NANDI.z - 1.2, NANDI.x + 0.6, F_M + 1.4, NANDI.z + 1.2);
  // a marigold garland round Nandi's neck and flowers at the hooves
  O.strand(new THREE.Vector3(-0.2, F_M + 0.28 + 0.78, NANDI.z - 0.55), new THREE.Vector3(0.2, F_M + 0.28 + 0.78, NANDI.z - 0.55), 0.22, 0.9);
  O.heap(NANDI.x, F_M + 0.29, NANDI.z - 1.0, 0.12, 0.05, 14);

  // ---------------- body colliders (walls round the garbhagriha, passage left open) ----------------
  const o = BODY + BHADRA, k = BODY + 0.24; // body + its base moulding
  P.solid(G_IN, 0, -k, k, 12, k);
  P.solid(-k, 0, -k, -G_IN, 12, k);
  P.solid(-G_IN, 0, -k, G_IN, 12, -G_IN);
  P.solid(-G_IN, 0, G_IN, -DOOR.half, 12, o);
  P.solid(DOOR.half, 0, G_IN, G_IN, 12, o);
  P.solid(-DOOR.half, DOOR.top, G_IN, DOOR.half, 12, o);
  for (const s of [-1, 1]) {
    P.solid(s > 0 ? k : -o - 0.24, 0, -2.3, s > 0 ? o + 0.24 : -k, 12, 2.3); // north / south bhadra
    P.solid(-2.3, 0, -o - 0.24, 2.3, 12, -k); // west bhadra
  }

  // walkable plinth-top round the garbhagriha (pradakshina) — leave the sanctum and passage open
  const W = BODY + TIER[2];
  for (const [e, w] of [[W, W], [BODY + 0.32 + TIER[2], 3.5], [BODY + BHADRA + TIER[2], 2.2]] as const) {
    P.floor(root, G_IN, e, -w, Math.min(w, 6.9), F_M);
    P.floor(root, -e, -G_IN, -w, Math.min(w, 6.9), F_M);
    P.floor(root, -w, w, -e, -G_IN, F_M);
  }
  P.floor(root, G_IN, W, W - 0.5, 6.9, F_M);
  P.floor(root, -W, -G_IN, W - 0.5, 6.9, F_M);
  P.floor(root, -G_IN, G_IN, dz, 7.5, F_M);

  // ---------------- crown: flag ----------------
  const flag = new Flag(root, K.steel, K.saffron, 0.0, 24.6, -0.55, 3.9);
  return { flag };
}

function bbox(p: P[]): [number, number, number, number] {
  const xs = p.map((q) => q[0]), zs = p.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/**
 * The deep stone entablature of the mandapa and porches (photos n_g1, 18_): three stepped fasciae,
 * a dentil course, a thick sloping chhajja ≈0.9 m out with pendant drops, and a low parapet over the
 * flat roof. `R` is the outline at the beam line; returns the roof-top height.
 */
function entablature(B: Merger, K: GM, R: P[], y: number) {
  const f: [number, number, number][] = [[0.05, 0, 0.35], [0.15, 0.35, 0.6], [0.25, 0.6, 0.8]];
  for (const [d, a, b] of f) {
    const o = offset(R, d);
    B.add(K.red, strip(o, y + a, o, y + b, 1, 0));
    B.add(K.redDark, strip(R, y + a, o, y + a, 0, -1)); // soffit of each fascia
  }
  const dent = boxAt(0.12, 0.14, 0.14, 0, 0, 0);
  for (const { p, n } of along(offset(R, 0.3), 0.26)) B.place(K.redDark, dent, p[0] - n[0] * 0.03, y + 0.8, p[1] - n[1] * 0.03);
  const top = y + 1.12;
  B.add(K.redDark, chhajjaGeo(offset(R, 0.3), top, 0.9, 0.42, 0.25));
  pendants(B, K.redDark, offset(R, 1.17), top - 0.42 - 0.25, 0.36);
  B.add(K.redDark, prism(offset(R, 0.22), top, top + 0.55));
  B.add(K.redDark, cap(offset(R, 0.22), top + 0.02));
  return top + 0.55;
}

/** hanging lotus-bud pendants under an eave edge */
function pendants(B: Merger, mat: THREE.Material, poly: P[], y: number, step: number) {
  const g = pendantGeo(0.22, 0.06);
  for (const { p } of along(poly, step, 0.1)) B.place(mat, g, p[0], y, p[1]);
}

/** The carved doorway of the garbhagriha (stone frame, brass bells), seen from the antarala. */
function doorFrame(B: Merger, K: GM, dz: number) {
  const h = DOOR.half;
  for (const s of [-1, 1]) {
    B.span(K.red, s * h - (s > 0 ? 0 : 0.28), F_M, dz - 0.05, s * h + (s > 0 ? 0.28 : 0), DOOR.top + 0.3, dz + 0.16);
    B.span(K.redDark, s * h - (s > 0 ? -0.05 : 0.33), F_M, dz + 0.16, s * h + (s > 0 ? 0.33 : -0.05), F_M + 0.4, dz + 0.24);
  }
  B.span(K.red, -h - 0.4, DOOR.top, dz - 0.05, h + 0.4, DOOR.top + 0.42, dz + 0.2);
  // threshold (udumbara)
  B.span(K.redDark, -h - 0.2, F_M, dz - 0.3, h + 0.2, F_M + 0.12, dz + 0.1);
  // two brass bells on chains from the lintel
  const bell = lathe([[0, 0], [0.1, 0], [0.095, 0.03], [0.07, 0.1], [0.05, 0.17], [0.02, 0.2], [0, 0.21]], 16);
  for (const s of [-1, 1]) {
    B.place(K.brass, bell, s * 0.75, DOOR.top - 0.85, dz + 0.45);
    B.add(K.brass, cyl(0.006, 0.006, 0.66, 4, s * 0.75, DOOR.top - 0.64, dz + 0.45));
  }
}

/** porch with its flight of steps; 'east' runs out along +z, 'north'/'south' along ±x */
function porch(root: THREE.Object3D, B: Merger, K: GM, P: Physics, side: 'east' | 'north' | 'south') {
  const N = 8, rise = F_M / N, run = 0.32;
  // local frame: u = outward distance from the mandapa edge line, v = across
  const u0 = side === 'east' ? MANDAPA.z1 + 0.4 : MANDAPA.half + 0.4;
  const vc = side === 'east' ? 0 : MANDAPA.zc;
  const toW = (u: number, v: number): [number, number] =>
    side === 'east' ? [v, u] : side === 'north' ? [u, vc + v] : [-u, vc + v];
  const span = (m: THREE.Material, ua: number, va: number, ub: number, vb: number, y0: number, y1: number, solid = false) => {
    const [xa, za] = toW(ua, va + (side === 'east' ? 0 : 0)), [xb, zb] = toW(ub, vb);
    B.span(m, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb), solid);
  };
  const floor = (ua: number, va: number, ub: number, vb: number, y: number) => {
    const [xa, za] = toW(ua, va), [xb, zb] = toW(ub, vb);
    P.floor(root, Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb), y);
  };
  const D = 1.8, HW = 2.2;
  span(K.plinth, u0 - 0.6, -HW, u0 + D, HW, 0, F_M, true);
  span(K.redDark, u0 - 0.6, -HW - 0.02, u0 + D + 0.02, HW + 0.02, F_M, F_M + 0.02);
  floor(u0 - 1.0, -HW, u0 + D, HW, F_M);
  for (let i = 0; i < N; i++) {
    const top = F_M - rise * i, ua = u0 + D + i * run; // first tread flush with the porch floor
    span(K.redDark, ua, -1.85, ua + run, 1.85, 0, top);
    floor(ua, -1.85, ua + run, 1.85, top);
  }
  // stepped side cheeks (stone balustrade blocks)
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i += 2) {
      const ua = u0 + D + i * run;
      span(K.red, ua, s > 0 ? 1.85 : -2.2, ua + run * 2, s > 0 ? 2.2 : -1.85, 0, F_M - rise * i + 0.35, true);
    }
  }
  // two squat porch pillars on a low parapet stub, and the same deep entablature as the hall
  const short = heavyPillarGeo(BEAM - F_M, 0.44);
  for (const s of [-1, 1]) {
    const [x, z] = toW(u0 + D - 0.3, s * (HW - 0.35));
    B.place(K.pillar, short, x, F_M, z);
    P.solid(x - 0.3, F_M, z - 0.3, x + 0.3, BEAM, z + 0.3);
  }
  span(K.ceiling, u0 - 0.6, -HW, u0 + D, HW, BEAM, BEAM + 0.35);
  const [ax, az] = toW(u0 - 0.4, -HW), [bx, bz] = toW(u0 + D, HW);
  entablature(B, K, rect(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)), BEAM);
}

/** the 24-pillared sabha mandapa */
function mandapa(root: THREE.Object3D, B: Merger, K: GM, P: Physics) {
  const { half: H, z0, z1, zc } = MANDAPA;
  // floor: polished grey-brown stone
  B.span(K.mandapaFloor, -H - 0.6, F_M - 0.05, z0 - 0.6, H + 0.6, F_M, z1 + 0.6);
  // kakshasana (seat-back parapet, ≈1.1 m, carved roundel panels) with openings east and at the porches
  const top = 2.6;
  const wall = (x0: number, z0_: number, x1: number, z1_: number) => {
    B.span(K.parapet, x0, F_M, z0_, x1, top, z1_, true);
    B.span(K.redDark, x0 - 0.1, top, z0_ - 0.1, x1 + 0.1, top + 0.12, z1_ + 0.1);
    B.span(K.redDark, x0 - 0.06, F_M, z0_ - 0.06, x1 + 0.06, F_M + 0.16, z1_ + 0.06);
  };
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? H - 0.25 : -H - 0.25, x1 = x0 + 0.5;
    wall(x0, z0, x1, zc - 1.2);
    wall(x0, zc + 1.2, x1, z1 + 0.25);
  }
  wall(-H - 0.25, z1 - 0.25, -1.2, z1 + 0.25);
  wall(1.2, z1 - 0.25, H + 0.25, z1 + 0.25);
  // west wall (against the sanctum), either side of the antarala
  for (const s of [-1, 1]) B.span(K.wall, s > 0 ? 3.0 : -H - 0.25, F_M, z0 - 0.25, s > 0 ? H + 0.25 : -3.0, BEAM, z0 + 0.25, true);

  // the 24 pillars: the 20 of the outer square (squat, on the parapet) + 4 tall round the central bay
  const pts: [number, number, number][] = [];
  for (const gx of GRID) for (const gz of GRID) {
    const outer = Math.abs(gx) === 6 || Math.abs(gz) === 6;
    const inner = Math.abs(gx) === 1.2 && Math.abs(gz) === 1.2;
    if (!outer && !inner) continue;
    const base = outer && gz !== -6 ? top + 0.12 : F_M;
    pts.push([gx, zc + gz, base]);
  }
  const tall = heavyPillarGeo(BEAM - F_M), short = heavyPillarGeo(BEAM - top - 0.12);
  for (const [x, z, base] of pts) {
    B.place(K.pillar, base === F_M ? tall : short, x, base, z);
    P.solid(x - 0.3, F_M, z - 0.3, x + 0.3, BEAM, z + 0.3);
  }
  // beams inside on every grid line (they stop at the outer line: no rafter ends)
  for (const g of GRID) {
    B.span(K.ceiling, g - 0.24, BEAM, z0, g + 0.24, BEAM + 0.4, z1);
    B.span(K.ceiling, -H, BEAM, zc + g - 0.24, H, BEAM + 0.4, zc + g + 0.24);
  }
  // the dark coffered ceiling, then the deep entablature and the flat roof behind its parapet
  B.span(K.ceiling, -H - 0.25, BEAM + 0.4, z0 - 0.25, H + 0.25, BEAM + 0.7, z1 + 0.25);
  entablature(B, K, rect(-H - 0.25, z0 - 0.25, H + 0.25, z1 + 0.25), BEAM);
  // central bay: a corbelled ceiling with a carved lotus
  B.span(K.ceiling, -1.0, BEAM + 0.25, zc - 1.0, 1.0, BEAM + 0.4, zc + 1.0);
  const lotus = lathe([[0, 0], [0.5, 0], [0.42, -0.08], [0.25, -0.16], [0.08, -0.2], [0, -0.2]], 24, 16, 0.12);
  B.place(K.redDark, lotus, 0, BEAM + 0.25, zc);
  // floor walkable (antarala up to the sanctum door, the hall, the ledge round the parapet)
  P.floor(root, -H - 0.6, H + 0.6, z0 - 0.6, z1 + 0.6, F_M);
}

/** the five-tiered shikhara, lotus collar, dome, kalash; the east frontispiece and turrets */
function shikhara(root: THREE.Object3D, B: Merger, K: GM, nandiGeo: THREE.BufferGeometry) {
  void root;
  // lotus-bud row on the cornice
  const bulb = bulbGeo(0.5, 1.25, 12); // lobed melon bulbs (amalaka-kumbhas)
  const s0 = 5.0;
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (let u = -s0; u <= s0 + 0.01; u += s0 / 6) {
      if (Math.abs(u) < 1.1) continue;
      if (f === 1 && Math.abs(u) < 2.4) continue; // east: the frontispiece
      const x = s0 * c - u * si, z = s0 * si + u * c;
      B.place(K.cream, bulb, x, 11.2, z);
    }
  }
  // core and five tiers of miniature shrines (kutas)
  const kuta = boxAt(0.62, 0.72, 0.5, 0, 0, 0);
  const kCap = boxAt(0.76, 0.09, 0.62, 0, 0.72, 0);
  const kRoof = cyl(0.36, 0.19, 0.17, 4, 0, 0.81, 0).rotateY(Math.PI / 4);
  const kBulb = bulbGeo(0.24, 0.44, 14, 14);
  // five storeys (bhumis) of two rows each would be ten; the photographs show eight rows of kutas
  const TIERS = 8, Y0 = 12.45, TH = 1.12;
  B.add(K.cream, prism(rect(-4.9, -4.9, 4.9, 4.9), 11.2, Y0));
  for (let k = 0; k < TIERS; k++) {
    const y = Y0 + k * TH, h = 4.95 - k * 0.4;
    const core = h - 0.34;
    // a dark shadow line under each storey of shrines
    B.add(K.dark, prism(rect(-core - 0.04, -core - 0.04, core + 0.04, core + 0.04), y - 0.02, y + 0.14, false));
    B.add(K.cream, prism(rect(-core, -core, core, core), y - 0.02, y + TH));
    B.add(K.cream, strip(rect(-core, -core, core, core), y + TH, rect(-core + 0.25, -core + 0.25, core - 0.25, core - 0.25), y + TH + 0.12, 1, 1));
    for (let f = 0; f < 4; f++) {
      const ry = -(f * Math.PI) / 2;
      const a = (f * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
      const n = Math.max(1, Math.floor((h - 1.2) / 0.7));
      for (let side = -1; side <= 1; side += 2) {
        for (let j = 0; j < n; j++) {
          const u = side * (1.2 + j * ((h - 1.55) / Math.max(1, n - 1)));
          const d = h - 0.25;
          const x = d * c - u * si, z = d * si + u * c;
          const rot = ry + Math.PI / 2;
          B.place(k < 2 ? K.kutaPink : K.kuta, kuta, x, y, z, rot);
          B.place(K.cream, kCap, x, y, z, rot);
          B.place(K.cream, kRoof, x, y, z, rot);
          B.place(k < 2 ? K.pink : K.cream, kBulb, x, y + 0.95, z);
        }
      }
    }
  }
  // corner kutas, turned 45°, so the tiers read as a continuous pyramid of shrines
  for (let k = 0; k < TIERS; k++) {
    const y = Y0 + k * TH, d = 4.95 - k * 0.4 - 0.3;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      B.place(k < 2 ? K.kutaPink : K.kuta, kuta, sx * d, y, sz * d, Math.PI / 4);
      B.place(K.cream, kCap, sx * d, y, sz * d, Math.PI / 4);
      B.place(K.cream, kRoof, sx * d, y, sz * d, Math.PI / 4);
      B.place(K.cream, kBulb, sx * d, y + 0.95, sz * d);
    }
  }
  // creeper spine (lata) on every face, from the cornice to the collar
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2;
    const g = spine(5.2, 11.2, 1.95, 21.55, 1.05, 0.6, 1.25);
    g.rotateY(-a);
    B.add(K.lata, g);
    if (f !== 1) archNiche(B, K, a);
  }
  // neck, lotus collar, the large RIBBED dome (≈0.35 of the shikhara's base, photo 12_), kalash
  const T = Y0 + TIERS * TH; // 21.41
  B.add(K.cream, prism(rect(-2.05, -2.05, 2.05, 2.05), T, T + 0.16));
  B.add(K.cream, cyl(1.95, 1.9, 0.22, 32, 0, T + 0.16, 0));
  const collar = lathe([[1.7, 0], [1.92, 0.06], [2.18, 0.22], [2.34, 0.42], [2.38, 0.5], [2.18, 0.5], [1.98, 0.46], [0, 0.46]], 64, 24, 0.14);
  B.place(K.pink, collar, 0, T + 0.34, 0);
  const DR = 1.95, DH = 2.6, D0 = T + 0.6;
  const domeProf: [number, number][] = [[DR * 0.96, 0]];
  for (let i = 1; i <= 18; i++) {
    const t = i / 18, a = t * Math.PI / 2;
    domeProf.push([Math.max(0.1, DR * Math.cos(a) * (1 + 0.1 * Math.sin(a * 2))), Math.sin(a) * DH]);
  }
  domeProf.push([0, DH + 0.02]);
  B.place(K.dome, lathe(domeProf, 80, 20, 0.04), 0, D0, 0);
  // four flame-like lotus-petal crests where the spines meet the dome
  const petal = new THREE.SphereGeometry(1, 10, 8).scale(0.16, 0.62, 0.07).translate(0, 0.55, 0).toNonIndexed();
  petal.deleteAttribute('uv');
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2;
    for (let p = -3; p <= 3; p++) {
      const g = petal.clone();
      g.rotateZ(p * 0.28).rotateX(-0.25);
      g.scale(1, 1 - Math.abs(p) * 0.08, 1);
      g.rotateY(-a + Math.PI / 2);
      g.translate(Math.cos(a) * (DR + 0.12), D0 - 0.25, Math.sin(a) * (DR + 0.12));
      B.add(K.pink, g);
    }
    B.place(K.cream, bulbGeo(0.2, 0.45, 12), Math.cos(a) * (DR + 0.2), D0 + 0.62, Math.sin(a) * (DR + 0.2));
  }
  const top = D0 + DH;
  B.place(K.pink, lathe([[0.55, 0], [0.46, 0.12], [0.32, 0.2], [0, 0.22]], 24, 16, 0.2), 0, top - 0.06, 0);
  B.place(K.gold, lathe([[0, 0], [0.22, 0], [0.24, 0.08], [0.16, 0.14], [0.3, 0.32], [0.32, 0.44], [0.2, 0.6], [0.1, 0.66], [0.15, 0.72], [0.12, 0.76], [0.06, 0.82], [0.1, 0.9], [0.05, 0.98], [0.02, 1.06], [0, 1.08]], 28), 0, top + 0.12, 0);
  // the steel frame over the dome (lightning conductor and lamp hooks seen in every photograph)
  const legs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p0 = new THREE.Vector3(Math.cos(a) * 1.25, D0 + 1.4, Math.sin(a) * 1.25), p1 = new THREE.Vector3(Math.cos(a) * 0.1, top + 1.9, Math.sin(a) * 0.1);
    const l = new THREE.CylinderGeometry(0.025, 0.025, p0.distanceTo(p1), 5);
    l.applyMatrix4(new THREE.Matrix4().lookAt(p0, p1, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    l.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    legs.push(l.toNonIndexed());
  }
  legs.push(cyl(0.02, 0.012, 0.8, 5, 0, top + 1.8, 0));
  for (const l of legs) l.deleteAttribute('uv');
  B.add(K.steel, mergeGeometries(legs, false)!);

  // east frontispiece (sukanasa) with its great arched niche, flanking turrets
  sukanasa(B, K, nandiGeo);
}

/**
 * A sloping slab running up a shikhara face (local frame: face along +x): bottom outer plane at x = d0
 * (height y0, half-width w0), top at x = d1 (y1, half-width w1), thickness t.
 */
function spine(d0: number, y0: number, d1: number, y1: number, w0: number, w1: number, t: number) {
  const A: P[] = [[d0, -w0], [d0, w0], [d0 - t, w0], [d0 - t, -w0]];
  const Bp: P[] = [[d1, -w1], [d1, w1], [d1 - t, w1], [d1 - t, -w1]];
  const g = mergeGeometries([strip(ccwq(A), y0, ccwq(Bp), y1, 1, 0.3), cap(ccwq(Bp), y1)], false)!;
  return g;
}
function ccwq(p: P[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
  return a < 0 ? p.slice().reverse() : p;
}

/** a small cusped arch niche at the foot of a face's spine (north, south, west) */
function archNiche(B: Merger, K: GM, a: number) {
  const ring = new THREE.TorusGeometry(0.62, 0.11, 8, 20, Math.PI).toNonIndexed();
  ring.deleteAttribute('uv');
  const d = 5.12;
  const m = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2);
  const g = mergeGeometries([
    ring.clone().translate(0, 12.15, 0),
    boxAt(0.2, 0.95, 0.24, -0.62, 11.2, 0),
    boxAt(0.2, 0.95, 0.24, 0.62, 11.2, 0),
  ], false)!;
  g.applyMatrix4(m).translate(Math.cos(a) * d, 0, Math.sin(a) * d);
  B.add(K.cream, g);
  const back = boxAt(1.1, 1.5, 0.05, 0, 11.2, 0).applyMatrix4(m).translate(Math.cos(a) * (d - 0.08), 0, Math.sin(a) * (d - 0.08));
  B.add(K.dark, back);
  B.place(K.cream, bulbGeo(0.3, 0.75, 12), Math.cos(a) * d, 12.85, Math.sin(a) * d);
}

function sukanasa(B: Merger, K: GM, nandiGeo: THREE.BufferGeometry) {
  const zf = 6.3, y0 = 11.0, y1 = 15.3, hw = 1.95;
  // body behind the frontispiece
  B.span(K.cream, -hw + 0.1, y0, 4.5, hw - 0.1, y1 - 0.9, zf - 0.3);
  // front: a slab with an arched opening (the niche)
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, y1 - y0); s.lineTo(-hw, y1 - y0); s.lineTo(-hw, 0);
  const hole = new THREE.Path();
  const r = 1.18, spring = 1.75;
  hole.moveTo(-r, 0.15); hole.lineTo(r, 0.15); hole.lineTo(r, spring);
  for (let i = 1; i < 24; i++) {
    const t = i / 24, aa = t * Math.PI;
    const cusp = (i % 4 === 2) ? 0.08 : 0;
    hole.lineTo(Math.cos(aa) * (r - cusp), spring + Math.sin(aa) * (r - cusp));
  }
  hole.lineTo(-r, spring); hole.lineTo(-r, 0.15);
  s.holes.push(hole);
  const front = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 8 }).toNonIndexed();
  front.deleteAttribute('uv');
  front.translate(0, y0, zf - 0.3);
  B.add(K.lata, front);
  // the arch's rolled moulding and the niche back
  const roll = new THREE.TorusGeometry(r + 0.12, 0.12, 8, 24, Math.PI).toNonIndexed();
  roll.deleteAttribute('uv');
  B.add(K.lata, roll.translate(0, y0 + spring, zf + 0.02));
  B.span(K.pink, -r, y0 + 0.1, zf - 0.75, r, y0 + spring + r, zf - 0.6);
  B.span(K.cream, -r, y0, zf - 0.75, r, y0 + 0.2, zf);
  // the sculpted group within (rendered as the white Nandi on which the divine family sits)
  const small = nandiMesh(K.cream, 40).geometry;
  small.scale(0.5, 0.5, 0.5).rotateY(Math.PI);
  B.place(K.cream, small, 0, y0 + 0.2, zf - 0.38);
  // crest: a band of petals and a crowning bulb
  B.span(K.cream, -hw - 0.1, y1, zf - 0.6, hw + 0.1, y1 + 0.18, zf + 0.1);
  B.place(K.cream, bulbGeo(0.5, 1.15, 16), 0, y1 + 0.18, zf - 0.25);
  for (const sx of [-1, 1]) B.place(K.cream, bulbGeo(0.24, 0.6, 12), sx * (hw - 0.25), y1 + 0.18, zf - 0.25);
  // turrets at the east corners of the shikhara base
  for (const sx of [-1, 1]) {
    const x = sx * 4.75, z = 4.75;
    B.span(K.cream, x - 0.48, 11.0, z - 0.48, x + 0.48, 14.1, z + 0.48);
    B.span(K.dark, x - 0.3, 11.6, z + 0.47, x + 0.3, 12.9, z + 0.5);
    B.span(K.cream, x - 0.6, 14.1, z - 0.6, x + 0.6, 14.3, z + 0.6);
    B.place(K.cream, bulbGeo(0.48, 1.05, 16), x, 14.3, z);
  }
}

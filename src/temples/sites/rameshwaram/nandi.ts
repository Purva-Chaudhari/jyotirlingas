import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * Nandi (copied from the Kedarnath site and rescaled; Rameswaram's is a 22 ft stucco bull, painted) —
 * forelegs folded with the hooves tucked forward, hind legs folded along the flank, a heavy
 * dewlap, the hump over the shoulders, the head raised and turned to the door, short horns
 * curving up and out, ears held level. Built as a signed-distance field (smooth union of
 * ellipsoids and tapered capsules) polygonised once with marching cubes.
 *
 * Local frame: metres, origin at the centre of the plinth top, the bull faces −z.
 */

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.sqrt(dot(a, a));

function ellipsoid(p: V, c: V, r: V) {
  const q: V = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  const k0 = len(q);
  const q2: V = [q[0] / r[0], q[1] / r[1], q[2] / r[2]];
  const k1 = len(q2);
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}

/** capsule from a (radius ra) to b (radius rb) */
function cone(p: V, a: V, b: V, ra: number, rb: number) {
  const pa = sub(p, a), ba = sub(b, a);
  const h = Math.max(0, Math.min(1, dot(pa, ba) / dot(ba, ba)));
  const d: V = [pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h];
  return len(d) - (ra + (rb - ra) * h);
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

let HEAD = 0;
let RAM = false;

/**
 * The Rameswaram Nandi: the same recumbent body with a bigger hump, the head held up on a thick
 * neck, a long face tapering to a closed muzzle, and upright horns.
 */
function bullRam(p: V): number {
  const x = Math.abs(p[0]);
  const q: V = [x, p[1], p[2]];
  let d = ellipsoid(p, [0, 0.47, 0.12], [0.42, 0.34, 0.72]);
  d = smin(d, ellipsoid(p, [0, 0.5, 0.62], [0.42, 0.36, 0.36]), 0.12);
  d = smin(d, ellipsoid(p, [0, 0.58, -0.42], [0.39, 0.42, 0.4]), 0.14);
  d = smin(d, ellipsoid(p, [0, 1.0, -0.36], [0.27, 0.3, 0.3]), 0.12); // the big hump
  d = smin(d, cone(p, [0, 0.76, -0.6], [0, 1.06, -0.9], 0.25, 0.19), 0.1); // thick neck
  d = smin(d, ellipsoid(p, [0, 0.52, -0.82], [0.1, 0.36, 0.24]), 0.07); // dewlap
  d = smin(d, ellipsoid(p, [0, 1.12, -0.98], [0.17, 0.13, 0.14]), 0.06); // poll and forehead
  d = smin(d, cone(p, [0, 1.1, -1.02], [0, 0.84, -1.36], 0.16, 0.1), 0.06); // the long tapering face
  d = smin(d, ellipsoid(p, [0, 0.8, -1.38], [0.115, 0.085, 0.075]), 0.04); // closed muzzle
  d = smin(d, ellipsoid(q, [0.1, 1.05, -1.1], [0.05, 0.035, 0.04]), 0.02); // eye ridges
  d = Math.min(d, ellipsoid(q, [0.24, 1.1, -0.98], [0.12, 0.035, 0.06])); // ears, level
  d = Math.min(d, cone(q, [0.11, 1.18, -0.98], [0.13, 1.5, -0.94], 0.05, 0.016)); // horns, upright
  d = smin(d, cone(q, [0.2, 0.2, -0.45], [0.22, 0.09, -0.72], 0.1, 0.075), 0.05);
  d = smin(d, cone(q, [0.22, 0.09, -0.72], [0.18, 0.06, -0.93], 0.075, 0.055), 0.03);
  d = smin(d, ellipsoid(q, [0.31, 0.42, 0.55], [0.15, 0.3, 0.32]), 0.1);
  d = smin(d, cone(q, [0.37, 0.14, 0.82], [0.39, 0.08, 0.3], 0.085, 0.06), 0.05);
  d = smin(d, cone(q, [0.39, 0.08, 0.3], [0.37, 0.06, 0.1], 0.06, 0.05), 0.03);
  d = Math.min(d, cone(p, [0.12, 0.62, 0.95], [0.43, 0.2, 0.75], 0.03, 0.025));
  d = Math.min(d, cone(p, [0.43, 0.2, 0.75], [0.45, 0.07, 0.35], 0.025, 0.04));
  return Math.max(d, 0.02 - p[1]);
}

function bull(p: V): number {
  const x = Math.abs(p[0]);
  const q: V = [x, p[1], p[2]]; // mirror for paired limbs
  let d = ellipsoid(p, [0, 0.47, 0.12], [0.4, 0.34, 0.72]); // barrel
  d = smin(d, ellipsoid(p, [0, 0.5, 0.62], [0.41, 0.36, 0.36]), 0.12); // rump
  d = smin(d, ellipsoid(p, [0, 0.56, -0.42], [0.37, 0.4, 0.38]), 0.14); // chest, shoulders
  d = smin(d, ellipsoid(p, [0, 0.96, -0.36], [0.22, 0.25, 0.27]), 0.1); // hump
  const L = HEAD; // Rameswaram's Nandi holds its head high and its horns upright
  d = smin(d, cone(p, [0, 0.74, -0.62], [0, 0.98 + L, -0.92], 0.21 + L * 0.2, 0.16 + L * 0.15), 0.08); // neck
  d = smin(d, ellipsoid(p, [0, 0.45 + L * 0.4, -0.8], [0.08, 0.32 + L * 0.3, 0.22]), 0.06); // dewlap
  d = smin(d, cone(p, [0, 1.1 + L, -0.98], [0, 0.95 + L, -1.28], 0.16 + L * 0.12, 0.11 + L * 0.08), 0.05); // head, forehead → muzzle
  d = smin(d, ellipsoid(p, [0, 0.93 + L, -1.3], [0.1 + L * 0.1, 0.085 + L * 0.06, 0.08 + L * 0.04]), 0.03); // muzzle
  d = smin(d, ellipsoid(q, [0.12, 1.16 + L, -1.02], [0.06, 0.05, 0.06]), 0.03); // brow / horn bosses
  d = Math.min(d, ellipsoid(q, [0.21 + L * 0.2, 1.08 + L, -1.0], [0.11, 0.03, 0.055])); // ears, level
  d = Math.min(d, cone(q, [0.12, 1.18 + L, -1.0], [0.2 - L * 0.2, 1.34 + L * 2.2, -0.95], 0.04 + L * 0.12, 0.016)); // horns
  // forelegs folded: forearm under the chest, hoof tucked forward
  d = smin(d, cone(q, [0.2, 0.2, -0.45], [0.22, 0.09, -0.72], 0.1, 0.075), 0.05);
  d = smin(d, cone(q, [0.22, 0.09, -0.72], [0.18, 0.06, -0.93], 0.075, 0.055), 0.03);
  // hind legs folded along the flank: thigh, hock, cannon forward
  d = smin(d, ellipsoid(q, [0.3, 0.42, 0.55], [0.15, 0.3, 0.32]), 0.1);
  d = smin(d, cone(q, [0.36, 0.14, 0.82], [0.38, 0.08, 0.3], 0.085, 0.06), 0.05);
  d = smin(d, cone(q, [0.38, 0.08, 0.3], [0.36, 0.06, 0.1], 0.06, 0.05), 0.03);
  // tail curled round the near haunch
  d = Math.min(d, cone(p, [0.12, 0.62, 0.95], [0.42, 0.2, 0.75], 0.03, 0.025));
  d = Math.min(d, cone(p, [0.42, 0.2, 0.75], [0.44, 0.07, 0.35], 0.025, 0.04));
  // seated on the plinth: flatten the underside
  return Math.max(d, 0.02 - p[1]);
}

export function nandiMesh(material: THREE.Material, scale = 1, res = 112, headLift = 0, ram = false) {
  HEAD = headLift;
  RAM = ram;
  const RES = res, SIZE = 2.9; // cube side in metres
  const mc = new MarchingCubes(RES, material, false, false, 200000);
  mc.isolation = 0;
  const half = SIZE / 2;
  const f = mc.field as Float32Array;
  for (let k = 0; k < RES; k++) {
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const p: V = [(i * SIZE) / RES - half, (j * SIZE) / RES - 0.08, (k * SIZE) / RES - half];
        f[i + j * RES + k * RES * RES] = -(RAM ? bullRam(p) : bull(p)) * 40;
      }
    }
  }
  mc.update();
  const n = mc.count;
  const src = mc.geometry;
  const pos = (src.attributes.position.array as Float32Array).slice(0, n * 3);
  const nor = (src.attributes.normal.array as Float32Array).slice(0, n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.scale(half, half, half);
  g.translate(0, half - 0.08, 0);
  g.scale(scale, scale, scale);
  g.computeBoundingSphere();
  mc.geometry.dispose();
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * Paint the Rameswaram Nandi: white lime body, pink muzzle and inner ears, dark horn tips and hooves.
 * Positions are in the unscaled bull frame (faces −z); `scale` is what nandiMesh was given.
 */
export function paintNandi(g: THREE.BufferGeometry, scale: number, L = 0) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / scale, y0 = p.getY(i) / scale, z = p.getZ(i) / scale;
    // head features are measured relative to the lifted head
    const y = z < -0.85 ? y0 - L : y0;
    col.set(0xf4f1ea);
    // the muzzle as painted at Rameswaram: a black band across the nose, a big pink-red mouth and
    // tongue below it, white round the nostrils
    if (z < -1.3 - L * 0.04 && y < 0.9 && Math.abs(x) < 0.07) col.set(0xd2606a);
    else if (z < -1.27 - L * 0.04 && y < 0.97) col.set(0x1c1a1a);
    else if (z < -1.18 - L * 0.04 && y < 1.0) col.set(0xe8e4dc);
    // the gold forehead ornament (a pendant shield between the horns, its chain down the face)
    if (Math.abs(x) < 0.09 && y > 1.02 && y < 1.2 && z < -0.98) col.set(0xe0b030);
    if (Math.abs(x) < 0.025 && y > 0.96 && y < 1.2 && z < -1.05) col.set(0xe0b030);
    if (y > 1.22 && Math.abs(x) > 0.08 && z > -1.1 && z < -0.86) col.set(0x3a3330); // horn tips
    if (y0 < 0.11 && (z < -0.85 || (z > 0.05 && z < 0.35))) col.set(0x5a514a); // hooves
    if (Math.abs(x) > 0.26 && y > 1.02 && y < 1.12 && z < -0.94 && z > -1.08) col.set(0xe6a3a0); // inner ears
    // painted neck bands (gold, green, red) round the neck and over the dewlap, as at Rameswaram
    if (z > -0.92 && z < -0.6 && y0 > 0.45 && y0 < 1.0 + L * 0.5) {
      const f = ((y0 - 0.45) * 6.5) % 1;
      if (f < 0.22) col.set(0xe0b030); else if (f > 0.4 && f < 0.5) col.set(0x2e9a50); else if (f > 0.7 && f < 0.78) col.set(0xc0281e);
    }
    // the painted eyes: a white almond, a black iris, a dark rim
    const ed = Math.hypot(Math.abs(x) - 0.135, y - 1.075, z + 1.1);
    if (ed < 0.075) col.set(ed < 0.03 ? 0x101010 : ed < 0.06 ? 0xf8f8f4 : 0x2a2420);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/**
 * Paint for the Rameswaram Nandi (c07/c08): white lime body; a pink-red muzzle band with dark nostrils;
 * painted eyes; a gold forehead plate with a red stone and a gold chain down the face; gold horn sheaths;
 * a deep collar of painted ornament — gold bands hung with rows of bells, separated by blue, green and
 * red bands — over the neck and dewlap; gold anklets; positions in the unscaled bull frame.
 */
export function paintNandiRam(g: THREE.BufferGeometry, scale: number) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  const GOLD = 0xe2b230, GOLD2 = 0xc8921c;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / scale, y = p.getY(i) / scale, z = p.getZ(i) / scale;
    col.set(0xf2efe8);
    // horns: gold sheaths banded darker
    if (y > 1.2 && z < -0.88 && z > -1.05 && Math.abs(x) > 0.06) col.set(Math.floor((y - 1.2) * 30) % 2 ? GOLD : GOLD2);
    // the collar: rows following the curve of the neck (s measures along it, from the jaw down the dewlap)
    if (z < -0.5 && z > -1.0 && y < 1.02 && y > 0.26) {
      const s = (1.02 - y) * 1.1 + (z + 0.5) * -0.35;
      const band = Math.floor(s / 0.09), f = (s / 0.09) % 1;
      const kind = band % 3;
      if (kind === 0) col.set(f < 0.55 ? GOLD : ((Math.atan2(x, -z - 0.6) * 18) % 1 < 0.5 ? GOLD2 : 0xf2efe8)); // gold band hung with bells
      else if (kind === 1) col.set([0x2f62b8, 0x2e9a50, 0xc0281e][Math.floor(band / 3) % 3]);
      else if (f < 0.3) col.set(GOLD2);
    }
    // gold anklets on the forelegs
    if (y > 0.09 && y < 0.15 && z < -0.6 && z > -0.95) col.set(GOLD);
    // the face
    if (z < -1.3 && y < 0.9) col.set(0xd25a5e); // pink-red muzzle band
    if (z < -1.42 && y > 0.78 && y < 0.84 && Math.abs(Math.abs(x) - 0.05) < 0.025) col.set(0x2a1e1e); // nostrils
    const ed = Math.hypot(Math.abs(x) - 0.125, y - 1.05, z + 1.12);
    if (ed < 0.05) col.set(ed < 0.02 ? 0x101010 : ed < 0.04 ? 0xf8f8f4 : 0x2a2420);
    if (Math.abs(x) < 0.1 && y > 1.06 && y < 1.2 && z < -0.98 && z > -1.12) col.set(Math.hypot(x, y - 1.13) < 0.03 ? 0xc0281e : GOLD); // forehead plate
    if (Math.abs(x) < 0.022 && y > 0.9 && y < 1.06 && z < -1.1) col.set(GOLD); // chain down the face
    if (Math.abs(x) > 0.16 && y > 1.06 && y < 1.15 && z < -0.9 && z > -1.06) col.set(Math.abs(x) > 0.28 ? 0xe6a3a0 : GOLD); // gold-painted ears, pink tips
    if (y < 0.08 && (z < -0.88 || (z > 0.05 && z < 0.3))) col.set(0x5a514a); // hooves
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/**
 * Surface points for the bells hanging from the Rameswaram Nandi's collar: rows round the front of
 * the neck and dewlap, found by marching outward from the neck axis to the sculpted surface.
 * Returns [x, y, z] in the unscaled bull frame.
 */
export function collarBells(): [number, number, number][] {
  const out: [number, number, number][] = [];
  const rows = [0.94, 0.8, 0.66, 0.53];
  rows.forEach((y, ri) => {
    const n = 15 + ri * 3;
    for (let i = 0; i < n; i++) {
      const a = -1.9 + (i / (n - 1)) * 3.8; // radians round the front (−z is forward)
      const dir: V = [Math.sin(a), 0, -Math.cos(a)];
      const o: V = [0, y, -0.62 - (0.94 - y) * 0.25];
      let t = 0;
      while (t < 0.8 && bullRam([o[0] + dir[0] * t, o[1], o[2] + dir[2] * t]) < 0) t += 0.005;
      if (t >= 0.8) continue;
      out.push([o[0] + dir[0] * (t + 0.012), o[1] - 0.03, o[2] + dir[2] * (t + 0.012)]);
    }
  });
  return out;
}

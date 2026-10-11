import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * Nandi, recumbent, facing the sanctum door: a humped zebu bull (copied from the Kedarnath site; used at Srisailam) —
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

function bull(p: V): number {
  const x = Math.abs(p[0]);
  const q: V = [x, p[1], p[2]]; // mirror for paired limbs
  let d = ellipsoid(p, [0, 0.47, 0.12], [0.4, 0.34, 0.72]); // barrel
  d = smin(d, ellipsoid(p, [0, 0.5, 0.62], [0.41, 0.36, 0.36]), 0.12); // rump
  d = smin(d, ellipsoid(p, [0, 0.56, -0.42], [0.37, 0.4, 0.38]), 0.14); // chest, shoulders
  d = smin(d, ellipsoid(p, [0, 0.96, -0.36], [0.22, 0.25, 0.27]), 0.1); // hump
  d = smin(d, cone(p, [0, 0.74, -0.62], [0, 0.98, -0.92], 0.21, 0.16), 0.08); // neck
  d = smin(d, ellipsoid(p, [0, 0.45, -0.8], [0.08, 0.32, 0.22]), 0.06); // dewlap
  d = smin(d, cone(p, [0, 1.1, -0.98], [0, 0.95, -1.28], 0.16, 0.11), 0.05); // head, forehead → muzzle
  d = smin(d, ellipsoid(p, [0, 0.93, -1.3], [0.1, 0.085, 0.08]), 0.03); // muzzle
  d = smin(d, ellipsoid(q, [0.12, 1.16, -1.02], [0.06, 0.05, 0.06]), 0.03); // brow / horn bosses
  d = Math.min(d, ellipsoid(q, [0.21, 1.08, -1.0], [0.11, 0.03, 0.055])); // ears, level
  d = Math.min(d, cone(q, [0.12, 1.18, -1.0], [0.2, 1.34, -0.93], 0.04, 0.016)); // horns
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

export function nandiGeo(RES = 112) {
  const material = new THREE.MeshBasicMaterial();
  const SIZE = 2.9; // cube side in metres
  const mc = new MarchingCubes(RES, material, false, false, 160000);
  mc.isolation = 0;
  const half = SIZE / 2;
  const f = mc.field as Float32Array;
  for (let k = 0; k < RES; k++) {
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const p: V = [(i * SIZE) / RES - half, (j * SIZE) / RES - 0.08, (k * SIZE) / RES - half];
        // marching cubes treats field > isolation as inside
        f[i + j * RES + k * RES * RES] = -bull(p) * 40;
      }
    }
  }
  mc.update();
  // bake into a plain mesh (smaller, static)
  const n = mc.count;
  const src = mc.geometry;
  const pos = (src.attributes.position.array as Float32Array).slice(0, n * 3);
  const nor = (src.attributes.normal.array as Float32Array).slice(0, n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // marching-cubes space is [-1, 1]³ → metres
  g.scale(half, half, half);
  g.translate(0, half - 0.08, 0);
  g.computeBoundingSphere();
  mc.geometry.dispose();
  material.dispose();
  return g;
}

import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * The rearing yali (leogryph) with its rider, carved in deep relief against the cloister piers of the
 * inner court (Vijayanagara style, as photographed 2024): a pedestal, folded haunches, an upright
 * body, raised forelegs, a maned head with a projecting snout and curled trunk-like upper lip, a
 * curling tail, and a small rider on its back with a raised arm — smooth sculpted massing (no faces),
 * built as a signed-distance field and polygonised once with marching cubes, like nandi.ts.
 * Local frame: metres, base at y = 0, rearing toward +z, the pier behind at −z.
 */
type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.sqrt(dot(a, a));

function ell(p: V, c: V, r: V) {
  const q: V = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  const k0 = len(q), q2: V = [q[0] / r[0], q[1] / r[1], q[2] / r[2]], k1 = len(q2);
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
function cap(p: V, a: V, b: V, ra: number, rb: number) {
  const pa = sub(p, a), ba = sub(b, a);
  const h = Math.max(0, Math.min(1, dot(pa, ba) / dot(ba, ba)));
  return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - (ra + (rb - ra) * h);
}
function rbox(p: V, c: V, b: V, r: number) {
  const q: V = [Math.abs(p[0] - c[0]) - b[0], Math.abs(p[1] - c[1]) - b[1], Math.abs(p[2] - c[2]) - b[2]];
  return len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r;
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

function yali(p: V): number {
  const q: V = [Math.abs(p[0]), p[1], p[2]];
  let d = rbox(p, [0, 0.16, 0.08], [0.24, 0.16, 0.3], 0.03); // pedestal
  d = smin(d, ell(p, [0, 0.55, 0.0], [0.22, 0.26, 0.24]), 0.08); // haunches
  d = smin(d, cap(p, [0, 0.6, 0.02], [0, 1.35, 0.12], 0.17, 0.14), 0.1); // body
  d = smin(d, ell(p, [0, 1.35, 0.14], [0.18, 0.22, 0.17]), 0.08); // chest
  d = smin(d, ell(p, [0, 1.62, 0.04], [0.2, 0.2, 0.15]), 0.06); // mane
  d = smin(d, ell(p, [0, 1.78, 0.18], [0.15, 0.17, 0.16]), 0.06); // head
  d = smin(d, cap(p, [0, 1.72, 0.3], [0, 1.66, 0.44], 0.075, 0.05), 0.04); // snout
  d = smin(d, cap(p, [0, 1.62, 0.45], [0, 1.48, 0.42], 0.035, 0.03), 0.03); // curled lip
  d = Math.min(d, cap(q, [0.08, 1.9, 0.12], [0.12, 2.06, 0.06], 0.03, 0.015)); // horns
  d = smin(d, cap(q, [0.12, 1.3, 0.2], [0.15, 1.12, 0.38], 0.06, 0.05), 0.04); // raised forelegs
  d = smin(d, cap(q, [0.15, 1.12, 0.38], [0.13, 1.32, 0.5], 0.05, 0.04), 0.03);
  d = smin(d, cap(q, [0.15, 0.5, 0.08], [0.14, 0.34, 0.26], 0.07, 0.055), 0.04); // hind legs
  d = Math.min(d, cap(p, [0, 0.62, -0.18], [0.04, 1.05, -0.26], 0.045, 0.035)); // tail
  d = Math.min(d, ell(p, [0.06, 1.12, -0.24], [0.06, 0.08, 0.05]));
  // the rider astride the back, an arm raised
  d = smin(d, cap(p, [0, 1.48, -0.06], [0, 1.82, -0.1], 0.085, 0.075), 0.05);
  d = smin(d, ell(p, [0, 1.96, -0.1], [0.06, 0.075, 0.06]), 0.03);
  d = smin(d, cap(p, [0.1, 1.76, -0.08], [0.17, 2.02, -0.02], 0.03, 0.025), 0.02);
  d = smin(d, cap(q, [0.1, 1.5, -0.04], [0.14, 1.3, 0.04], 0.04, 0.035), 0.03); // rider's legs
  return d;
}

export function yaliPierGeo(RES = 44) {
  const material = new THREE.MeshBasicMaterial();
  const SIZE = 2.3;
  const mc = new MarchingCubes(RES, material, false, false, 120000);
  mc.isolation = 0;
  const half = SIZE / 2, cz = 0.12;
  const f = mc.field as Float32Array;
  for (let k = 0; k < RES; k++) for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const p: V = [(i * SIZE) / RES - half, (j * SIZE) / RES - 0.04, (k * SIZE) / RES - half + cz];
    f[i + j * RES + k * RES * RES] = -yali(p) * 40;
  }
  mc.update();
  const n = mc.count;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute((mc.geometry.attributes.position.array as Float32Array).slice(0, n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute((mc.geometry.attributes.normal.array as Float32Array).slice(0, n * 3), 3));
  g.scale(half, half, half);
  g.translate(0, half - 0.04, cz);
  mc.geometry.dispose();
  material.dispose();
  return g;
}

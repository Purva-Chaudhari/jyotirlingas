import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * The 12-ft black chlorite-schist statue of Adi Shankaracharya (unveiled Nov 2021) in his
 * samadhi court: seated cross-legged, a shawl drawn over the head and down the back, the right
 * hand raised before the chest holding the danda, the left hand on the lap holding a book,
 * rudraksha strands at the neck. Modelled respectfully as a smooth sculpted mass — no facial
 * detail — from a signed-distance field polygonised once.
 *
 * Local frame: human scale (m), origin at the seat, facing +z. Scale ×3.4 on placement.
 */

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.sqrt(dot(a, a));

function ell(p: V, c: V, r: V) {
  const q: V = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  const k0 = len(q);
  const k1 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]]);
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
function cap(p: V, a: V, b: V, ra: number, rb: number) {
  const pa = sub(p, a), ba = sub(b, a);
  const h = Math.max(0, Math.min(1, dot(pa, ba) / dot(ba, ba)));
  return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - (ra + (rb - ra) * h);
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

function figure(p: V): number {
  // crossed legs and the dhoti over them: a broad flattened mass with knees at the sides
  let d = ell(p, [0, 0.1, 0.07], [0.5, 0.12, 0.28]);
  d = smin(d, ell(p, [-0.42, 0.12, 0.14], [0.13, 0.1, 0.13]), 0.06);
  d = smin(d, ell(p, [0.42, 0.12, 0.14], [0.13, 0.1, 0.13]), 0.06);
  d = smin(d, ell(p, [0, 0.19, -0.04], [0.21, 0.13, 0.16]), 0.08); // hips
  d = smin(d, ell(p, [0, 0.42, -0.04], [0.2, 0.25, 0.13]), 0.07); // torso
  d = smin(d, ell(p, [0, 0.52, -0.01], [0.23, 0.13, 0.13]), 0.05); // chest
  d = smin(d, cap(p, [-0.22, 0.6, -0.04], [0.22, 0.6, -0.04], 0.07, 0.07), 0.05); // shoulders
  d = smin(d, cap(p, [0, 0.62, -0.04], [0, 0.71, -0.03], 0.05, 0.048), 0.03); // neck
  d = smin(d, ell(p, [0, 0.8, -0.015], [0.085, 0.11, 0.1]), 0.03); // head
  d = smin(d, ell(p, [0, 0.79, 0.083], [0.014, 0.03, 0.015]), 0.015); // nose ridge
  // shawl: a hood over the head, falling over the shoulders and down the back
  d = smin(d, Math.max(ell(p, [0, 0.81, -0.045], [0.114, 0.138, 0.12]), p[2] - 0.0), 0.02);
  d = smin(d, cap(p, [0, 0.76, -0.1], [0, 0.32, -0.15], 0.1, 0.2), 0.06);
  for (const s of [-1, 1]) d = smin(d, cap(p, [s * 0.1, 0.72, -0.06], [s * 0.26, 0.5, -0.07], 0.045, 0.08), 0.05);
  // right arm (figure's right = −x): raised, hand before the chest
  d = smin(d, cap(p, [-0.26, 0.58, -0.04], [-0.3, 0.37, 0.03], 0.052, 0.045), 0.03);
  d = smin(d, cap(p, [-0.3, 0.37, 0.03], [-0.19, 0.54, 0.12], 0.045, 0.038), 0.02);
  d = smin(d, ell(p, [-0.17, 0.6, 0.115], [0.034, 0.062, 0.022]), 0.015);
  // left arm resting on the lap, hand holding the book
  d = smin(d, cap(p, [0.26, 0.58, -0.04], [0.31, 0.36, 0.02], 0.052, 0.045), 0.03);
  d = smin(d, cap(p, [0.31, 0.36, 0.02], [0.15, 0.25, 0.16], 0.045, 0.038), 0.02);
  d = smin(d, ell(p, [0.11, 0.24, 0.17], [0.05, 0.022, 0.045]), 0.015);
  // the end of the shawl falling over the left knee
  d = smin(d, cap(p, [0.2, 0.42, 0.08], [0.24, 0.16, 0.2], 0.05, 0.09), 0.05);
  return Math.max(d, -p[1] - 0.005);
}

export function shankaracharya(stone: THREE.Material, scale = 3.4) {
  const RES = 84, SIZE = 1.2, half = SIZE / 2, Y0 = -0.05;
  const mc = new MarchingCubes(RES, stone, false, false, 140000);
  mc.isolation = 0;
  const f = mc.field as Float32Array;
  for (let k = 0; k < RES; k++) {
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const p: V = [(i * SIZE) / RES - half, (j * SIZE) / RES + Y0, (k * SIZE) / RES - half];
        f[i + j * RES + k * RES * RES] = -figure(p) * 60;
      }
    }
  }
  mc.update();
  const n = mc.count;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute((mc.geometry.attributes.position.array as Float32Array).slice(0, n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute((mc.geometry.attributes.normal.array as Float32Array).slice(0, n * 3), 3));
  g.scale(half, half, half);
  g.translate(0, half + Y0, 0);
  mc.geometry.dispose();
  const group = new THREE.Group();
  const body = new THREE.Mesh(g, stone);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  // rudraksha strands at the neck
  for (const [r0, y, z] of [[0.075, 0.655, 0.0], [0.1, 0.62, 0.01], [0.125, 0.585, 0.02]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.008, 6, 40), stone);
    t.rotation.x = Math.PI / 2 - 0.45;
    t.position.set(0, y, z);
    t.scale.set(1.15, 1, 1);
    group.add(t);
  }
  // the book in the left hand
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.08), stone);
  book.position.set(0.11, 0.27, 0.17);
  group.add(book);
  // the danda, held in the raised right hand, with its small cloth pennant
  const a = new THREE.Vector3(0.16, 0.06, 0.24), b = new THREE.Vector3(-0.36, 1.02, 0.05);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, a.distanceTo(b), 8), stone);
  staff.position.copy(a).lerp(b, 0.5);
  staff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(staff);
  const pen = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 3), stone);
  pen.position.copy(b).add(new THREE.Vector3(-0.03, -0.05, 0));
  pen.rotation.z = Math.PI / 2;
  group.add(pen);
  group.scale.setScalar(scale);
  group.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  return group;
}

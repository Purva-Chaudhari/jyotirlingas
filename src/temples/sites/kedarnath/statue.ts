import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * The 12-ft black chlorite-schist statue of Adi Shankaracharya (unveiled Nov 2021) in his
 * samadhi court: seated cross-legged, a shawl drawn over the head and down the back, the right
 * hand raised before the chest holding the danda, the left hand on the lap holding a book,
 * rudraksha strands at the neck, the dhoti's pleats falling over the lotus; the face calm, eyes closed. A
 * signed-distance field polygonised once.
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

/** a smooth union that also subtracts: carve b out of a with a soft edge k */
function ssub(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 - (0.5 * (a + b)) / k));
  return a + (-b - a) * h + k * h * (1 - h);
}

function figure(p: V): number {
  const [x, y, z] = p;
  // ---- legs in padmasana under the dhoti: thighs out to the knees, the shins crossed in front, soles turned up ----
  let d = cap(p, [-0.11, 0.15, -0.02], [-0.42, 0.105, 0.17], 0.082, 0.064);
  d = smin(d, cap(p, [0.11, 0.15, -0.02], [0.42, 0.105, 0.17], 0.082, 0.064), 0.035);
  d = smin(d, cap(p, [-0.42, 0.105, 0.17], [0.17, 0.125, 0.22], 0.056, 0.042), 0.025); // right shin, under
  d = smin(d, cap(p, [0.42, 0.12, 0.16], [-0.15, 0.175, 0.17], 0.055, 0.042), 0.025); // left shin, over
  d = smin(d, ell(p, [0.19, 0.19, 0.15], [0.08, 0.035, 0.045]), 0.03); // soles
  d = smin(d, ell(p, [-0.17, 0.235, 0.12], [0.08, 0.035, 0.045]), 0.03);
  d = smin(d, ell(p, [0, 0.19, -0.03], [0.22, 0.12, 0.16]), 0.07); // pelvis
  // the dhoti's front pleats falling from the lap over the lotus, fanning out as they fall
  {
    const t = Math.max(0, Math.min(1, (0.16 - y) / 0.24));
    let pl = ell(p, [0, 0.0, 0.27 + t * 0.04], [0.085 + t * 0.06, 0.14, 0.026]);
    pl += 0.003 * Math.sin(x * 80 + y * 5);
    d = smin(d, pl, 0.03);
  }
  // ---- torso: waist, belly, ribcage, chest, shoulders ----
  d = smin(d, ell(p, [0, 0.33, -0.03], [0.17, 0.13, 0.11]), 0.06);
  d = smin(d, ell(p, [0, 0.35, 0.03], [0.125, 0.09, 0.055]), 0.04);
  d = smin(d, ell(p, [0, 0.49, -0.025], [0.195, 0.15, 0.115]), 0.05);
  for (const sx of [-1, 1]) {
    d = smin(d, ell(p, [sx * 0.075, 0.535, 0.045], [0.085, 0.045, 0.035]), 0.035); // pectorals, flat
    d = smin(d, ell(p, [sx * 0.205, 0.585, -0.03], [0.072, 0.07, 0.068]), 0.04); // deltoids
  }
  d = smin(d, cap(p, [-0.19, 0.625, -0.025], [0.19, 0.625, -0.025], 0.045, 0.045), 0.04);
  d = smin(d, cap(p, [0, 0.62, -0.03], [0, 0.71, -0.02], 0.05, 0.047), 0.03); // neck
  // ---- head and a calm face (eyes closed, looking down a little) ----
  d = smin(d, ell(p, [0, 0.805, -0.02], [0.078, 0.098, 0.092]), 0.02);
  d = smin(d, ell(p, [0, 0.742, 0.02], [0.062, 0.05, 0.066]), 0.03); // jaw
  d = smin(d, ell(p, [0, 0.722, 0.062], [0.026, 0.02, 0.02]), 0.012); // chin
  d = smin(d, cap(p, [-0.04, 0.812, 0.066], [0.04, 0.812, 0.066], 0.011, 0.011), 0.012); // brow
  d = smin(d, cap(p, [0, 0.806, 0.074], [0, 0.772, 0.092], 0.009, 0.013), 0.008); // nose
  d = smin(d, ell(p, [0, 0.767, 0.084], [0.018, 0.008, 0.01]), 0.006);
  d = smin(d, ell(p, [0, 0.746, 0.076], [0.023, 0.009, 0.011]), 0.006); // lips
  d = ssub(d, cap(p, [-0.019, 0.746, 0.087], [0.019, 0.746, 0.087], 0.0022, 0.0022), 0.003); // the parting of the lips
  for (const sx of [-1, 1]) {
    d = ssub(d, ell(p, [sx * 0.029, 0.794, 0.074], [0.017, 0.0055, 0.008]), 0.004); // closed eyelids
    d = smin(d, ell(p, [sx * 0.04, 0.765, 0.055], [0.022, 0.02, 0.015]), 0.015); // cheeks
  }
  // ---- the shawl: a hood framing the face, falling over the shoulders, down the back and the upper arms ----
  {
    let hood = ell(p, [0, 0.815, -0.03], [0.092, 0.112, 0.104]);
    hood = Math.max(hood, -ell(p, [0, 0.775, 0.11], [0.074, 0.112, 0.1])); // the face opening, forehead to chin
    hood = smin(hood, cap(p, [0, 0.76, -0.1], [0, 0.3, -0.155], 0.1, 0.19), 0.05);
    for (const sx of [-1, 1]) hood = smin(hood, cap(p, [sx * 0.095, 0.75, -0.02], [sx * 0.27, 0.46, 0.0], 0.03, 0.065), 0.05);
    d = smin(d, hood, 0.012);
  }
  // ---- right arm (figure's right = −x): the hand raised before the chest, gripping the danda ----
  d = smin(d, cap(p, [-0.23, 0.58, -0.03], [-0.275, 0.38, 0.0], 0.05, 0.043), 0.03);
  d = smin(d, cap(p, [-0.275, 0.38, 0.0], [-0.16, 0.52, 0.12], 0.04, 0.033), 0.02);
  d = smin(d, ell(p, [-0.15, 0.55, 0.13], [0.032, 0.046, 0.032]), 0.015);
  // ---- left arm down to the left knee, the hand resting on it with the book ----
  d = smin(d, cap(p, [0.23, 0.58, -0.03], [0.29, 0.37, 0.01], 0.05, 0.043), 0.03);
  d = smin(d, cap(p, [0.29, 0.37, 0.01], [0.34, 0.215, 0.15], 0.04, 0.034), 0.02);
  d = smin(d, ell(p, [0.345, 0.2, 0.19], [0.034, 0.024, 0.045]), 0.015);
  return Math.max(d, -y - 0.06);
}

export function shankaracharya(stone: THREE.Material, scale = 3.4) {
  const RES = 120, SIZE = 1.2, half = SIZE / 2, Y0 = -0.08;
  const mc = new MarchingCubes(RES, stone, false, false, 400000);
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
  // (three strands, each lying lower on the chest)
  for (const [r0, y, z] of [[0.072, 0.645, 0.012], [0.095, 0.61, 0.024], [0.118, 0.57, 0.034]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.0085, 8, 56), stone);
    t.rotation.x = Math.PI / 2 - 0.75;
    t.position.set(0, y, z);
    t.scale.set(1.15, 1, 1);
    group.add(t);
  }
  // the book in the left hand
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.08), stone);
  book.position.set(0.33, 0.235, 0.2);
  book.rotation.y = 0.5;
  group.add(book);
  // the danda, held in the raised right hand, with its small cloth pennant
  // (its foot on the lotus by the right knee, through the fist, the head above the right shoulder)
  const a = new THREE.Vector3(-0.05, -0.02, 0.33), hand = new THREE.Vector3(-0.15, 0.55, 0.13);
  const b = hand.clone().add(hand.clone().sub(a).multiplyScalar(0.85));
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, a.distanceTo(b), 8), stone);
  staff.position.copy(a).lerp(b, 0.5);
  staff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  group.add(staff);
  // the small cloth tied near its head, hanging in folds
  const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.09, 4, 1), stone);
  const pp = pen.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 90) * 0.006);
  pen.geometry.computeVertexNormals();
  (pen.material as THREE.Material).side = THREE.DoubleSide;
  pen.position.copy(b).add(new THREE.Vector3(-0.04, -0.07, 0));
  group.add(pen);
  group.scale.setScalar(scale);
  group.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  return group;
}

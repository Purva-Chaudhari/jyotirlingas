import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The pujaris seated round the jalahari (sanctum_wide): adult men sitting cross-legged on the floor,
 * at true scale (≈0.9 m from floor to crown, head ≈0.22 m), built from smooth lathes, capsules and
 * ellipsoids with welded normals — no facial features:
 *  - bare chest and arms (skin), a white or cream dhoti wrapped over the crossed legs and hips;
 *  - an uttariya (upper cloth) in saffron, orange, white or pink over the left shoulder, crossing the
 *    chest to the right hip and hanging down the back;
 *  - a shaved head with a choti (tuft) or short dark hair;
 *  - hands resting on the knees, leaning over an open book, or raising a brass aarti lamp;
 *  - varied deep-brown skin, pleated dhoti folds, a bhasma tilak on some, and a slightly different lean,
 *    twist and head turn for each.
 * Every figure is baked into ONE merged mesh with vertex colours (one draw call for all of them).
 */

export interface PriestSpot {
  x: number;
  y: number;
  z: number;
  /** facing (radians about y; 0 = +z) */
  ry: number;
  /** 'still' (hands on the knees), 'read' (leaning over an open book) or 'aarti' (right hand raising a brass lamp) */
  pose?: 'still' | 'read' | 'aarti';
  /** bhasma tripundra and a kumkum dot on the forehead */
  tilak?: boolean;
  /** upper-cloth colour */
  cloth?: number;
  /** dhoti colour (default white) */
  dhoti?: number;
  /** 'shaved' (with a choti) or 'hair' */
  head?: 'shaved' | 'hair';
  /** skin tone */
  skin?: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function clean(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const w = mergeVertices(g, 1e-4);
  w.computeVertexNormals();
  return w.toNonIndexed();
}
function capsule(r: number, a: THREE.Vector3, b: THREE.Vector3, r2 = r) {
  // a tapered capsule: a lathe from sphere-cap to sphere-cap, then aligned a → b
  const len = a.distanceTo(b);
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 5; i++) { const t = (i / 5) * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(t) * r, -Math.cos(t) * r)); }
  for (let i = 0; i <= 5; i++) { const t = (i / 5) * Math.PI / 2; prof.push(new THREE.Vector2(Math.cos(t) * r2, len + Math.sin(t) * r2)); }
  const g = new THREE.LatheGeometry(prof, 12);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return clean(g);
}
function ellipsoid(rx: number, ry: number, rz: number, c: THREE.Vector3) {
  return clean(new THREE.SphereGeometry(1, 16, 12).scale(rx, ry, rz).translate(c.x, c.y, c.z));
}
function lathe(p: [number, number][], sx = 1, sz = 1) {
  return clean(new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), 16).scale(sx, 1, sz));
}
function paint(g: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** One seated priest in local space (origin on the floor under the hips, facing +z). Returns its geometry
 *  and, for an aarti pose, the world position of the lamp's flame. */
function priest(p: PriestSpot, rnd: () => number): { geo: THREE.BufferGeometry; flame?: THREE.Vector3 } {
  const skin = p.skin ?? [0x6b4026, 0x5c3622, 0x7a482a, 0x4f2e1c, 0x86542f, 0x704428][Math.floor(rnd() * 6)];
  const dhoti = p.dhoti ?? 0xf3efe4;
  const fold = new THREE.Color(dhoti).multiplyScalar(0.86).getHex();
  const cloth = p.cloth ?? 0xe8701a;
  const lower: THREE.BufferGeometry[] = [], upper: THREE.BufferGeometry[] = [], head: THREE.BufferGeometry[] = [];
  const add = (into: THREE.BufferGeometry[], g: THREE.BufferGeometry, c: number) => into.push(paint(g, c));
  const pose = p.pose ?? 'still';
  // --- crossed legs in the dhoti: two thighs out to the knees, two shins crossing in front
  const kL = V(-0.3, 0.1, 0.2), kR = V(0.3, 0.1, 0.2);
  add(lower, capsule(0.085, V(-0.1, 0.13, -0.02), kL, 0.07), dhoti);
  add(lower, capsule(0.085, V(0.1, 0.13, -0.02), kR, 0.07), dhoti);
  add(lower, capsule(0.062, kL, V(0.14, 0.07, 0.3), 0.05), dhoti);
  add(lower, capsule(0.062, kR, V(-0.14, 0.09, 0.32), 0.05), dhoti);
  add(lower, ellipsoid(0.045, 0.03, 0.09, V(0.2, 0.05, 0.27)), skin);
  add(lower, ellipsoid(0.045, 0.03, 0.09, V(-0.2, 0.07, 0.3)), skin);
  add(lower, ellipsoid(0.19, 0.11, 0.15, V(0, 0.15, 0.0)), dhoti);
  add(lower, ellipsoid(0.16, 0.05, 0.14, V(0, 0.17, 0.13)), dhoti);
  // dhoti folds: the pleated front panel fanning from the waist over the lap, and creases on the thighs
  for (let k = -2; k <= 2; k++) add(lower, capsule(0.013, V(k * 0.025, 0.24, 0.12), V(k * 0.06, 0.1, 0.36), 0.016), fold);
  for (const sx of [-1, 1]) for (const d of [0.04, 0.1]) add(lower, capsule(0.01, V(sx * (0.09 + d), 0.2, 0.02), V(sx * (0.2 + d * 0.6), 0.17, 0.2)), fold);
  // --- torso: waist → chest → broad shoulders (bare skin), squashed front-to-back
  const shY = 0.64;
  add(upper, lathe([[0.001, 0.2], [0.15, 0.2], [0.14, 0.3], [0.145, 0.42], [0.16, 0.53], [0.17, 0.6], [0.13, shY + 0.02], [0.06, shY + 0.05], [0.001, shY + 0.05]], 1.15, 0.72), skin);
  for (const s of [-1, 1]) add(upper, ellipsoid(0.065, 0.06, 0.06, V(s * 0.19, shY - 0.02, 0)), skin);
  add(upper, lathe([[0.155, 0.2], [0.158, 0.24], [0.15, 0.27]], 1.15, 0.74), dhoti);
  // uttariya over the left shoulder, crossing to the right hip and down the back
  add(upper, capsule(0.045, V(-0.16, shY + 0.02, 0.02), V(0.15, 0.27, 0.1), 0.05).scale(1, 1, 0.9), cloth);
  add(upper, capsule(0.05, V(-0.16, shY + 0.02, -0.02), V(-0.1, 0.25, -0.12), 0.06), cloth);
  add(upper, ellipsoid(0.07, 0.05, 0.06, V(-0.17, shY + 0.01, 0)), cloth);
  add(upper, capsule(0.006, V(-0.12, shY + 0.03, 0.06), V(0.13, 0.33, 0.12)), 0xf2eee0);
  // --- arms: hands on the knees, an open book held forward (leaning to read), or the aarti lamp raised
  let lampAt: THREE.Vector3 | undefined;
  for (const s of [-1, 1]) {
    const sh = V(s * 0.2, shY - 0.03, 0.0);
    if (pose === 'aarti' && s > 0) {
      const el = V(0.3, 0.5, 0.18), h = V(0.24, 0.72, 0.34);
      add(upper, capsule(0.042, sh, el, 0.036), skin);
      add(upper, capsule(0.035, el, h, 0.03), skin);
      add(upper, ellipsoid(0.03, 0.045, 0.025, h), skin);
      // the brass aarti: a handle and a shallow plate with a wick
      add(upper, capsule(0.01, h.clone().add(V(0, 0.02, 0.02)), h.clone().add(V(0, 0.1, 0.05))), 0xc9a040);
      add(upper, clean(new THREE.CylinderGeometry(0.07, 0.05, 0.025, 16).translate(h.x, h.y + 0.12, h.z + 0.06)), 0xc9a040);
      lampAt = V(h.x, h.y + 0.16, h.z + 0.06);
      continue;
    }
    const el = V(s * 0.23, 0.38, 0.06);
    add(upper, capsule(0.042, sh, el, 0.036), skin);
    if (pose === 'read') {
      const w = V(s * 0.09, 0.4, 0.27);
      add(upper, capsule(0.035, el, w, 0.03), skin);
      add(upper, ellipsoid(0.03, 0.045, 0.022, V(s * 0.08, 0.42, 0.3)), skin);
    } else {
      const k = V(s * 0.27, 0.19, 0.22);
      add(upper, capsule(0.035, el, k, 0.03), skin);
      add(upper, ellipsoid(0.035, 0.022, 0.05, V(s * 0.27, 0.19, 0.25)), skin);
    }
  }
  if (pose === 'read') {
    const page = (s: number) => new THREE.BoxGeometry(0.1, 0.006, 0.15).translate(s * 0.05, 0, 0).rotateZ(s * 0.18).rotateX(0.5).translate(0, 0.44, 0.32);
    add(upper, clean(page(-1)), 0xf4f0e2);
    add(upper, clean(page(1)), 0xf4f0e2);
  }
  // --- neck and head (≈0.22 m tall), no features; bhasma tripundra and a kumkum dot on some foreheads
  add(upper, lathe([[0.05, shY], [0.046, shY + 0.06], [0.048, shY + 0.1], [0.001, shY + 0.11]]), skin);
  const hY = shY + 0.21;
  add(head, ellipsoid(0.078, 0.11, 0.092, V(0, hY, 0.005)), skin);
  for (const s of [-1, 1]) add(head, ellipsoid(0.014, 0.028, 0.02, V(s * 0.078, hY, 0)), skin);
  if (p.tilak) {
    for (let k = 0; k < 3; k++) add(head, capsule(0.0028, V(-0.032, hY + 0.052 + k * 0.009, 0.08 - k * 0.004), V(0.032, hY + 0.052 + k * 0.009, 0.08 - k * 0.004)), 0xe8e2d4);
    add(head, ellipsoid(0.008, 0.012, 0.004, V(0, hY + 0.018, 0.095)), 0xc0141c);
  }
  if ((p.head ?? 'shaved') === 'hair') {
    add(head, clean(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateX(-0.35).scale(0.083, 0.115, 0.097).translate(0, hY + 0.005, -0.002)), 0x1a1614);
  } else {
    add(head, ellipsoid(0.022, 0.03, 0.022, V(0, hY + 0.09, -0.06)), 0x1a1614);
    add(head, capsule(0.012, V(0, hY + 0.09, -0.07), V(0, hY + 0.0, -0.1), 0.008), 0x1a1614);
  }
  // asymmetry: the head turns and tilts a little about the neck, the upper body leans (more when
  // reading) and twists about the hips — no two figures share a pose
  const about = (pivot: THREE.Vector3, rx: number, ry: number, rz: number) => new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'))).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const hm = about(V(0, shY + 0.05, 0), (pose === 'read' ? 0.3 : 0.05) + (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.15);
  for (const g of head) { g.applyMatrix4(hm); upper.push(g); }
  const um = about(V(0, 0.2, 0), (pose === 'read' ? 0.2 : 0.03) + (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.08);
  for (const g of upper) g.applyMatrix4(um);
  lampAt?.applyMatrix4(um);
  const g = mergeGeometries([...lower, ...upper])!;
  const place = new THREE.Matrix4().compose(V(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.ry), V(1, 1, 1));
  g.applyMatrix4(place);
  return { geo: g, flame: lampAt?.applyMatrix4(place) };
}

/** Build all priests as one merged, vertex-coloured mesh under `parent`. */
export function buildPriests(parent: THREE.Object3D, spots: PriestSpot[], seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const built = spots.map((p) => priest(p, rnd));
  const geo = mergeGeometries(built.map((b) => b.geo))!;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'priests';
  parent.add(mesh);
  return { mesh, flames: built.flatMap((b) => (b.flame ? [b.flame] : [])) };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The painted fibre-reinforced statues of Shri Mahakal Lok, stylised: smooth, faceless heads (no eyes,
 * nose or mouth — a respectful, sculptural reading), proportions and attributes that make each figure
 * recognisable from a distance (Shiva's jata bun, crescent, serpent and trishul; the sages' white hair
 * and saffron robes; Parvati's crown and red sari). Every statue is merged geometry with vertex colours,
 * so a whole group is one draw.
 */

type Geo = THREE.BufferGeometry;
const colorize = (g: Geo, c: number | THREE.Color) => {
  const k = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = k.r; a[i + 1] = k.g; a[i + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
};
/** a tapered limb from a to b (radii ra, rb) */
function limb(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seg = 10) {
  const L = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, L, seg, 1);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q).translate(a.x, a.y, a.z);
  return g;
}
const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 10, 7).scale(sx, sy, sz).translate(x, y, z);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class StatueBatch {
  parts: Geo[] = [];
  gold: Geo[] = [];
  add(g: Geo, c: number | THREE.Color, m?: THREE.Matrix4) { const k = colorize(g, c); if (m) k.applyMatrix4(m); this.parts.push(k); }
  addGold(g: Geo, m?: THREE.Matrix4) { const k = colorize(g, 0xffffff); if (m) k.applyMatrix4(m); this.gold.push(k); }
  /** place a sub-batch (built at the origin facing +z) at x, y, z turned ry, scaled s */
  place(b: StatueBatch, x: number, y: number, z: number, ry: number, s: number) {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(s, s, s));
    for (const g of b.parts) this.parts.push(g.clone().applyMatrix4(m));
    for (const g of b.gold) this.gold.push(g.clone().applyMatrix4(m));
  }
  meshes(paint: THREE.Material, gold: THREE.Material) {
    const out: THREE.Mesh[] = [];
    if (this.parts.length) out.push(new THREE.Mesh(mergeGeometries(this.parts)!, paint));
    if (this.gold.length) out.push(new THREE.Mesh(mergeGeometries(this.gold)!, gold));
    for (const m of out) { m.castShadow = true; m.receiveShadow = true; m.geometry.computeBoundingSphere(); }
    return out;
  }
}

/** a faceless head with a jata bun (Shiva), crown (Parvati) or white hair (a sage); returns the top y */
function head(b: StatueBatch, x: number, y: number, z: number, r: number, skin: number, kind: 'shiva' | 'devi' | 'sage') {
  b.add(ball(r, x, y, z, 0.92, 1.08, 0.98), skin);
  b.add(limb(V(x, y - r * 1.7, z), V(x, y - r * 0.6, z), r * 0.42, r * 0.4), skin); // neck
  if (kind === 'shiva') {
    // matted hair piled into a tall bun, a crescent moon on it, hair falling behind the shoulders
    b.add(ball(r * 0.62, x, y + r * 1.25, z - r * 0.1, 0.9, 1.3, 0.9), 0x2a1c14);
    b.add(ball(r * 1.02, x, y + r * 0.12, z - r * 0.08, 1, 0.95, 1.0), 0x2a1c14);
    b.add(limb(V(x, y, z - r * 0.5), V(x, y - r * 2.6, z - r * 0.9), r * 0.8, r * 0.5), 0x2a1c14);
    b.addGold(new THREE.TorusGeometry(r * 0.32, r * 0.07, 6, 16, Math.PI * 1.2).rotateZ(-0.3).translate(x + r * 0.35, y + r * 1.55, z + r * 0.2));
    // the third-eye mark only as a red tilak line (no features)
    b.add(new THREE.BoxGeometry(r * 0.08, r * 0.3, r * 0.04).translate(x, y + r * 0.35, z + r * 0.96), 0xb01818);
  } else if (kind === 'devi') {
    b.add(ball(r * 1.03, x, y + r * 0.1, z - r * 0.05, 1, 0.95, 1), 0x1a1210);
    b.addGold(new THREE.CylinderGeometry(r * 0.55, r * 0.8, r * 0.9, 8).translate(x, y + r * 1.15, z));
    b.addGold(new THREE.ConeGeometry(r * 0.3, r * 0.6, 8).translate(x, y + r * 1.85, z));
  } else {
    b.add(ball(r * 0.6, x, y + r * 1.0, z - r * 0.1, 1, 0.9, 1), 0xf2efe8);
    b.add(ball(r * 1.02, x, y + r * 0.15, z - r * 0.1, 1, 0.95, 1), 0xf2efe8);
    // a long white beard (hair, not a face)
    b.add(new THREE.ConeGeometry(r * 0.6, r * 1.6, 10).rotateX(Math.PI).translate(x, y - r * 1.1, z + r * 0.55), 0xf2efe8);
  }
}

/** a seated figure in padmasana, at the origin facing +z, hip height ~0.55 s */
export function seated(kind: 'shiva' | 'sage', skin: number, cloth: number, s = 1, opts: { trishul?: boolean; serpent?: boolean } = {}) {
  const b = new StatueBatch();
  // crossed legs: two flattened tori / capsules, the lap
  b.add(ball(0.55 * s, 0, 0.22 * s, 0.1 * s, 1.25, 0.42, 0.85), cloth);
  for (const sx of [-1, 1]) {
    b.add(limb(V(sx * 0.45 * s, 0.18 * s, -0.05 * s), V(-sx * 0.25 * s, 0.16 * s, 0.38 * s), 0.17 * s, 0.13 * s), skin);
    b.add(ball(0.11 * s, -sx * 0.32 * s, 0.24 * s, 0.38 * s, 1.4, 0.7, 0.9), skin); // feet on the thighs
  }
  // torso and shoulders
  const top = 1.18 * s;
  b.add(limb(V(0, 0.3 * s, -0.05 * s), V(0, top, -0.05 * s), 0.34 * s, 0.4 * s, 14), kind === 'sage' ? cloth : skin);
  b.add(ball(0.42 * s, 0, top - 0.05 * s, -0.05 * s, 1.15, 0.6, 0.75), kind === 'sage' ? cloth : skin);
  if (kind === 'shiva') {
    // tiger-skin wrap at the waist, a rudraksha garland
    b.add(limb(V(0, 0.28 * s, -0.05 * s), V(0, 0.5 * s, -0.05 * s), 0.4 * s, 0.37 * s, 14), cloth);
    b.add(new THREE.TorusGeometry(0.26 * s, 0.025 * s, 6, 20).rotateX(Math.PI / 2 - 0.5).translate(0, top - 0.32 * s, 0.1 * s), 0x5a2a14);
  } else {
    b.add(new THREE.TorusGeometry(0.24 * s, 0.03 * s, 6, 20).rotateX(Math.PI / 2 - 0.5).translate(0, top - 0.3 * s, 0.1 * s), 0x6a3a1a);
  }
  // arms: hands resting on the knees in jnana mudra
  for (const sx of [-1, 1]) {
    const sh = V(sx * 0.42 * s, top - 0.08 * s, -0.05 * s), el = V(sx * 0.56 * s, 0.68 * s, 0.05 * s), wr = V(sx * 0.5 * s, 0.36 * s, 0.35 * s);
    b.add(limb(sh, el, 0.12 * s, 0.1 * s), skin);
    b.add(limb(el, wr, 0.1 * s, 0.075 * s), skin);
    b.add(ball(0.08 * s, wr.x, wr.y, wr.z + 0.04 * s), skin);
  }
  head(b, 0, top + 0.42 * s, 0, 0.22 * s, skin, kind);
  if (opts.serpent) {
    b.add(new THREE.TorusGeometry(0.3 * s, 0.045 * s, 8, 24).rotateX(Math.PI / 2 - 0.25).translate(0, top + 0.06 * s, 0), 0x2a5a3a);
    b.add(ball(0.07 * s, 0.24 * s, top + 0.28 * s, 0.18 * s, 1, 1.4, 1), 0x2a5a3a);
  }
  if (opts.trishul) {
    const x = 0.85 * s;
    b.addGold(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 2.6 * s, 6).translate(x, 1.3 * s, -0.2 * s));
    for (const dx of [-0.16, 0, 0.16]) b.addGold(new THREE.ConeGeometry(0.05 * s, 0.4 * s, 6).translate(x + dx * s, 2.75 * s - Math.abs(dx) * 0.6 * s, -0.2 * s));
    b.addGold(new THREE.TorusGeometry(0.16 * s, 0.03 * s, 6, 12, Math.PI).rotateZ(Math.PI).translate(x, 2.62 * s, -0.2 * s));
    b.add(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.14 * s, 10).rotateZ(Math.PI / 2).translate(x, 2.2 * s, -0.2 * s), 0x8a5a2a); // damaru
  }
  return b;
}

/** a standing figure, facing +z (feet at y 0, ~1.8 s tall); arms set by pose */
export function standing(kind: 'shiva' | 'devi', skin: number, cloth: number, s = 1, pose: 'blessing' | 'namaste' | 'tandava' = 'blessing') {
  const b = new StatueBatch();
  const hip = 0.95 * s, sh = 1.48 * s;
  if (kind === 'devi') {
    // a sari falling to the feet
    b.add(new THREE.CylinderGeometry(0.2 * s, 0.34 * s, hip + 0.02 * s, 14).translate(0, (hip + 0.02 * s) / 2, 0), cloth);
    b.add(new THREE.BoxGeometry(0.05 * s, hip * 0.9, 0.25 * s).translate(0.12 * s, hip * 0.45, 0.2 * s).rotateY(0.3), 0xd4a017);
  } else {
    const lift = pose === 'tandava' ? 0.35 * s : 0;
    b.add(limb(V(-0.11 * s, 0, 0), V(-0.1 * s, hip, 0), 0.08 * s, 0.12 * s), skin);
    b.add(limb(V(0.11 * s, lift, lift * 0.6), V(0.1 * s, hip, 0), 0.08 * s, 0.12 * s), skin);
    b.add(limb(V(0, hip - 0.25 * s, 0), V(0, hip + 0.08 * s, 0), 0.24 * s, 0.22 * s, 12), cloth); // tiger-skin wrap
  }
  b.add(limb(V(0, hip, 0), V(0, sh, 0), 0.2 * s, 0.25 * s, 14), kind === 'devi' ? cloth : skin);
  b.add(ball(0.26 * s, 0, sh - 0.02 * s, 0, 1.2, 0.55, 0.7), kind === 'devi' ? cloth : skin);
  const arms: [THREE.Vector3, THREE.Vector3][] = pose === 'namaste'
    ? [[V(-0.17 * s, sh - 0.35 * s, 0.22 * s), V(-0.03 * s, sh - 0.25 * s, 0.3 * s)], [V(0.17 * s, sh - 0.35 * s, 0.22 * s), V(0.03 * s, sh - 0.25 * s, 0.3 * s)]]
    : pose === 'tandava'
      ? [[V(-0.55 * s, sh + 0.25 * s, 0.05 * s), V(-0.75 * s, sh + 0.6 * s, 0.1 * s)], [V(0.5 * s, sh - 0.1 * s, 0.25 * s), V(0.75 * s, sh + 0.25 * s, 0.35 * s)]]
      : [[V(-0.3 * s, sh - 0.55 * s, 0.1 * s), V(-0.25 * s, sh - 0.85 * s, 0.25 * s)], [V(0.32 * s, sh - 0.3 * s, 0.2 * s), V(0.3 * s, sh - 0.02 * s, 0.32 * s)]];
  for (const [i, [el, wr]] of arms.entries()) {
    const sx = i ? 1 : -1, shp = V(sx * 0.27 * s, sh - 0.05 * s, 0);
    b.add(limb(shp, el, 0.07 * s, 0.06 * s), skin);
    b.add(limb(el, wr, 0.06 * s, 0.045 * s), skin);
    b.add(ball(0.055 * s, wr.x, wr.y, wr.z), skin);
  }
  head(b, 0, sh + 0.33 * s, 0, 0.14 * s, skin, kind === 'devi' ? 'devi' : 'shiva');
  if (kind === 'shiva') {
    b.add(new THREE.TorusGeometry(0.17 * s, 0.03 * s, 8, 20).rotateX(Math.PI / 2 - 0.3).translate(0, sh + 0.02 * s, 0), 0x2a5a3a); // serpent
    // trishul held upright beside
    const x = pose === 'tandava' ? -0.85 * s : 0.48 * s;
    b.addGold(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 2.5 * s, 6).translate(x, 1.25 * s, 0.1 * s));
    for (const dx of [-0.11, 0, 0.11]) b.addGold(new THREE.ConeGeometry(0.035 * s, 0.3 * s, 6).translate(x + dx * s, 2.6 * s - Math.abs(dx) * 0.6 * s, 0.1 * s));
  }
  return b;
}

/** Nandi, the bull, couchant, facing +z (length ~2.2 s) */
export function nandi(color: number, s = 1) {
  const b = new StatueBatch();
  b.add(ball(0.55 * s, 0, 0.55 * s, -0.15 * s, 0.95, 0.85, 1.6), color);
  b.add(ball(0.4 * s, 0, 0.95 * s, 0.25 * s, 0.9, 0.9, 1.0), color); // hump
  b.add(ball(0.24 * s, 0, 0.95 * s, 0.85 * s, 0.85, 1.1, 1.25), color); // head
  for (const sx of [-1, 1]) {
    b.add(new THREE.ConeGeometry(0.05 * s, 0.32 * s, 6).rotateZ(-sx * 0.5).translate(sx * 0.17 * s, 1.27 * s, 0.75 * s), color);
    b.add(ball(0.18 * s, sx * 0.38 * s, 0.22 * s, 0.35 * s, 0.7, 0.55, 1.4), color); // folded forelegs
  }
  b.add(new THREE.TorusGeometry(0.26 * s, 0.05 * s, 6, 16).rotateX(Math.PI / 2 - 0.6).translate(0, 0.86 * s, 0.6 * s), 0xb01818); // garland
  b.add(new THREE.BoxGeometry(1.4 * s, 0.25 * s, 2.4 * s).translate(0, 0.12 * s - 0.12 * s, 0), color);
  return b;
}

/** Shiva in meditation on a coiled serpent, its five hoods spread above him (Shri Mahakal Lok) */
export function shivaOnNaga(s = 1) {
  const b = new StatueBatch();
  const coil = 0x24282a;
  for (let k = 0; k < 4; k++) b.add(new THREE.TorusGeometry((1.15 - k * 0.08) * s, 0.32 * s, 10, 28).rotateX(Math.PI / 2).translate(0, (0.32 + k * 0.6) * s, 0), coil);
  b.addGold(new THREE.CylinderGeometry(1.1 * s, 1.1 * s, 0.25 * s, 28).translate(0, 2.55 * s, 0));
  b.place(seated('shiva', 0xe8eef2, 0xc89a5a, 1.25 * s, { serpent: true }), 0, 2.67 * s, 0, 0, 1);
  // the hood fan behind: five raised cobra heads on curved necks
  for (let k = 0; k < 5; k++) {
    const a = (k - 2) * 0.38;
    const base = V(Math.sin(a) * 0.4 * s, 2.7 * s, -0.7 * s), top = V(Math.sin(a) * 1.15 * s, 5.0 * s - Math.abs(k - 2) * 0.25 * s, -0.35 * s);
    b.add(limb(base, top, 0.22 * s, 0.2 * s), 0xe8e4dc);
    b.add(ball(0.38 * s, top.x, top.y + 0.1 * s, top.z, 1.0, 1.25, 0.4), 0xe8e4dc);
    b.add(ball(0.25 * s, top.x, top.y + 0.12 * s, top.z + 0.1 * s, 1.0, 1.1, 0.35), 0x9a7a5a);
  }
  return b;
}

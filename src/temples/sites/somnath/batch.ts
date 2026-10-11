import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';

/**
 * Collects world-space geometry per material and merges it into one mesh per material,
 * so the hundreds of carved courses, mouldings and slabs of the temple cost a handful of draw calls.
 */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(mat: THREE.Material, geo: THREE.BufferGeometry) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
    return g;
  }

  /** Box with its base at y (like kit.box), optionally turned about Y. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y + h / 2, z);
    return this.add(mat, g);
  }

  /** Box spanning two corners (x0..x1, y0..y1, z0..z1). */
  span(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    return this.box(mat, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2);
  }

  /** Vertical prism from a plan polygon given as [x, z] points (any winding), y0..y1. */
  prism(mat: THREE.Material, pts: [number, number][], y0: number, y1: number, holes: [number, number][][] = []) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    return this.add(mat, g);
  }

  /** Lathe from [radius, y] pairs, placed at (x, y, z). */
  lathe(mat: THREE.Material, prof: [number, number][], x: number, y: number, z: number, seg = 24, phase = 0) {
    const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), seg, phase);
    g.translate(x, y, z);
    return this.add(mat, g);
  }

  /** Merge everything into meshes under `parent`; returns them. */
  flush(parent: THREE.Object3D, shadows = true) {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      worldUV(merged);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = shadows;
      m.receiveShadow = true;
      parent.add(m);
      out.push(m);
    }
    this.parts.clear();
    return out;
  }
}

/** Collects instance transforms for one shared geometry; becomes a single InstancedMesh. */
export class Instances {
  mats: THREE.Matrix4[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material) {}
  at(x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, ry = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(sx, sy, sz),
    );
    this.mats.push(m);
    return m;
  }
  /**
   * Flush as a THREE.LOD centred at `center`: the full geometry within `dist` metres of the camera, `lo`
   * (a lighter stand-in with the same unit frame) beyond it.
   */
  flushLOD(parent: THREE.Object3D, lo: THREE.BufferGeometry, center: THREE.Vector3, dist: number, shadows = true) {
    const lod = new THREE.LOD();
    lod.position.copy(center);
    parent.add(lod);
    for (const [geo, d] of [[this.geo, 0], [lo, dist]] as const) {
      const inst = new THREE.InstancedMesh(geo, this.mat, this.mats.length);
      this.mats.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.position.copy(center).negate();
      inst.castShadow = shadows;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      lod.addLevel(inst, d);
    }
    return lod;
  }
  flush(parent: THREE.Object3D, shadows = true) {
    if (!this.mats.length) return null;
    const inst = new THREE.InstancedMesh(this.geo, this.mat, this.mats.length);
    this.mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    parent.add(inst);
    return inst;
  }
}

/**
 * Sloping stone eave (chhajja) round a w×d rectangle centred at (cx, cz), projecting `out` and
 * dropping `drop` (same form as kit.chhajja, but batched; use a double-sided material).
 */
export function eave(B: Batch, mat: THREE.Material, cx: number, cz: number, w: number, d: number, y: number, out: number, drop: number, thick = 0.14) {
  const hw = w / 2, hd = d / 2, ow = hw + out, od = hd + out;
  const top = [[-hw, y, -hd], [hw, y, -hd], [hw, y, hd], [-hw, y, hd]];
  const bot = [[-ow, y - drop, -od], [ow, y - drop, -od], [ow, y - drop, od], [-ow, y - drop, od]];
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], e: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(top[i], bot[i], bot[j], top[j]);
    const bi = [bot[i][0], bot[i][1] - thick, bot[i][2]], bj = [bot[j][0], bot[j][1] - thick, bot[j][2]];
    quad(bot[j], bot[i], bi, bj);
    const ti = [top[i][0], top[i][1] - thick * 2, top[i][2]], tj = [top[j][0], top[j][1] - thick * 2, top[j][2]];
    quad(bj, bi, ti, tj);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.translate(cx, 0, cz);
  g.computeVertexNormals();
  B.add(mat, g);
}

const mergeAll = (gs: THREE.BufferGeometry[]) =>
  mergeGeometries(gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  }), false)!;

/**
 * Solanki (Maru-Gurjara) pillar of unit height and unit shaft radius: square kumbhi base,
 * square-to-octagonal-to-round shaft with carved rings, ghata (pot) capital, cushion and cross brackets.
 * Scale per instance with (r, h, r).
 */
export function pillarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, y0: number, y1: number, d = w, x = 0, z = 0) => parts.push(new THREE.BoxGeometry(w, y1 - y0, d).translate(x, (y0 + y1) / 2, z));
  box(3.0, 0, 0.05);
  box(2.7, 0.05, 0.1);
  box(2.2, 0.1, 0.34);
  // carved panels on the four faces of the square base: a raised frame round a sunk field with a boss
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const panel = [
      new THREE.BoxGeometry(1.5, 0.03, 0.12).translate(0, 0.315, 1.1),
      new THREE.BoxGeometry(1.5, 0.03, 0.12).translate(0, 0.125, 1.1),
      new THREE.BoxGeometry(0.12, 0.19, 0.12).translate(-0.7, 0.22, 1.1),
      new THREE.BoxGeometry(0.12, 0.19, 0.12).translate(0.7, 0.22, 1.1),
      new THREE.SphereGeometry(0.28, 10, 6).scale(1, 0.25, 0.4).translate(0, 0.22, 1.1),
    ];
    for (const p of panel) parts.push(p.rotateY(a));
  }
  // octagonal section
  const oct = new THREE.LatheGeometry([[0, 0.34], [1.15, 0.34], [1.15, 0.36], [1.05, 0.38], [1.05, 0.58], [0, 0.58]].map(([r, y]) => new THREE.Vector2(r, y)), 8, Math.PI / 8);
  parts.push(oct);
  // round, ringed upper shaft, pot capital, cushion
  const prof: [number, number][] = [[0, 0.58], [1.25, 0.58], [1.25, 0.61], [0.98, 0.62], [0.98, 0.7], [1.12, 0.71], [1.12, 0.73], [0.95, 0.74],
    [0.95, 0.8], [1.2, 0.81], [1.38, 0.845], [1.3, 0.875], [1.05, 0.885], [1.45, 0.9], [1.45, 0.93], [0, 0.93]];
  parts.push(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 16));
  // chain-and-bell (ghanta-mala) pendants hanging from the ring at 0.73, and the leaves spilling from the pot (ghata-pallava)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const bell = new THREE.LatheGeometry([[0, 0.66], [0.1, 0.665], [0.13, 0.69], [0.06, 0.72], [0, 0.725]].map(([r, y]) => new THREE.Vector2(r, y)), 6);
    parts.push(bell.translate(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0));
    const leaf = new THREE.SphereGeometry(0.2, 6, 4).scale(0.9, 1.6, 0.35).rotateX(-0.5);
    leaf.translate(0, 0.835, 1.32).rotateY(a + Math.PI / 8);
    parts.push(leaf);
  }
  // cross brackets with rolled (volute) ends
  box(4.2, 0.93, 1.0, 1.3);
  box(1.3, 0.93, 1.0, 4.2);
  for (const [x, z, ry] of [[2.1, 0, 0], [-2.1, 0, Math.PI], [0, 2.1, -Math.PI / 2], [0, -2.1, Math.PI / 2]] as const) {
    const roll = new THREE.CylinderGeometry(0.2, 0.2, 1.3, 10).rotateX(Math.PI / 2).rotateY(ry);
    parts.push(roll.translate(x, 0.93, z));
  }
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}

/**
 * Carved frieze panel of unit width and height, facing +z, standing on y = 0: a sunk field framed by
 * pilasters and a cusped arch, with a purna-kalash (vase of plenty) in relief and leaf sprays at its sides.
 */
export function reliefPanelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.BoxGeometry(1, 1, 0.06).translate(0, 0.5, -0.06));
  for (const x of [-0.44, 0.44]) parts.push(new THREE.BoxGeometry(0.12, 0.98, 0.16).translate(x, 0.49, 0));
  parts.push(new THREE.BoxGeometry(1, 0.08, 0.18).translate(0, 0.04, 0));
  const arch = new THREE.TorusGeometry(0.36, 0.045, 6, 18, Math.PI).translate(0, 0.62, 0);
  parts.push(arch);
  for (let k = 1; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    parts.push(new THREE.SphereGeometry(0.05, 6, 4).translate(Math.cos(a) * 0.3, 0.62 + Math.sin(a) * 0.3, 0.01));
  }
  const vase = new THREE.LatheGeometry([[0, 0.1], [0.1, 0.1], [0.16, 0.2], [0.17, 0.3], [0.1, 0.4], [0.06, 0.44], [0.1, 0.48], [0.04, 0.5], [0, 0.5]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 10, 0, Math.PI);
  parts.push(vase.rotateY(-Math.PI / 2).scale(1, 1, 0.55));
  for (const s of [-1, 1]) {
    const spray = new THREE.SphereGeometry(0.1, 6, 4).scale(0.6, 1.4, 0.35).rotateZ(s * 0.6).translate(s * 0.16, 0.6, 0.0);
    parts.push(spray);
  }
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}

/**
 * Niche panel with a standing figure in soft relief (unit width 1, height 1.4, facing +z, base at y = 0):
 * a sunk field framed by pilasters and a cusped arch, the figure a draped silhouette with a halo,
 * deliberately without facial features.
 */
export function figureReliefGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.BoxGeometry(1, 1.4, 0.06).translate(0, 0.7, -0.08));
  for (const x of [-0.45, 0.45]) parts.push(new THREE.BoxGeometry(0.1, 1.38, 0.16).translate(x, 0.69, 0));
  parts.push(new THREE.BoxGeometry(1, 0.1, 0.2).translate(0, 0.05, 0));
  parts.push(new THREE.TorusGeometry(0.38, 0.04, 6, 18, Math.PI).translate(0, 1.0, 0));
  const blob = (rx: number, ry: number, rz: number, x: number, y: number, z = 0, rot = 0) =>
    parts.push(new THREE.SphereGeometry(1, 10, 7).scale(rx, ry, rz).rotateZ(rot).translate(x, y, z));
  // halo and head (smooth, no features), torso, hips, the falling drapery, arms and a raised hand
  parts.push(new THREE.TorusGeometry(0.11, 0.015, 5, 16).translate(0, 1.04, -0.02));
  blob(0.065, 0.08, 0.05, 0, 1.04, 0.02);
  blob(0.05, 0.07, 0.04, 0, 1.16, 0.01); // crown
  blob(0.11, 0.17, 0.06, 0, 0.82, 0.02);
  blob(0.13, 0.1, 0.06, 0.01, 0.62, 0.02);
  parts.push(new THREE.CylinderGeometry(0.11, 0.17, 0.48, 12, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.45).translate(0, 0.32, 0.0));
  blob(0.035, 0.15, 0.03, -0.15, 0.78, 0.03, -0.25);
  blob(0.035, 0.13, 0.03, 0.16, 0.88, 0.03, 0.6);
  blob(0.03, 0.04, 0.03, 0.22, 0.98, 0.04);
  for (const x of [-0.06, 0.06]) blob(0.04, 0.03, 0.04, x, 0.1, 0.05);
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}

/** Scale-aware planar UVs for unit instanced geometry, so the stone scan reads at the right size. */
export function withUV(geo: THREE.BufferGeometry, sx: number, sy: number, sz = sx) {
  geo.scale(sx, sy, sz);
  worldUV(geo);
  geo.scale(1 / sx, 1 / sy, 1 / sz);
  return geo;
}

/**
 * A deep-carved medallion of unit radius facing +z: stepped rings, a full-blown lotus of two petal
 * rows and a raised boss, as on the sinhakarna gables.
 */
export function medallionGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(1, 1, 0.16, 32).rotateX(Math.PI / 2).translate(0, 0, -0.08));
  parts.push(new THREE.TorusGeometry(0.96, 0.08, 6, 32));
  parts.push(new THREE.TorusGeometry(0.74, 0.05, 6, 32).translate(0, 0, 0.02));
  for (let row = 0; row < 2; row++) {
    const n = 12, r = row ? 0.38 : 0.56, len = row ? 0.26 : 0.3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + row * (Math.PI / n);
      const petal = new THREE.SphereGeometry(1, 8, 5).scale(len * 0.38, len, 0.09 + row * 0.04).rotateZ(a - Math.PI / 2);
      parts.push(petal.translate(Math.cos(a) * r, Math.sin(a) * r, 0.04 + row * 0.05));
    }
  }
  parts.push(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1, 0.8).translate(0, 0, 0.12));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    parts.push(new THREE.SphereGeometry(0.045, 5, 4).translate(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.04));
  }
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}

/** A ghanta (bell-shaped miniature roof finial) of unit height, used in hundreds on the samvarana roofs. */
export function ghantaGeometry(seg = 6): THREE.BufferGeometry {
  // (7 profile spans: there are ~7500 of these, so every span saved is ~90k triangles a pass)
  const prof: [number, number][] = [[0.5, 0], [0.5, 0.14], [0.44, 0.34], [0.3, 0.52], [0.2, 0.62], [0.3, 0.7], [0.13, 0.82], [0, 1]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI / seg);
}

/** Distant stand-in for the ghanta: four-sided, four spans (32 triangles instead of 84). */
export function ghantaLoGeometry(): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.5, 0], [0.42, 0.32], [0.2, 0.6], [0.26, 0.72], [0, 1]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 4, Math.PI / 4);
}

/** Distant stand-in for the Solanki pillar (same unit frame): square base, octagonal shaft, capital and cross brackets. */
export function pillarLoGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.BoxGeometry(2.7, 0.34, 2.7).translate(0, 0.17, 0));
  parts.push(new THREE.LatheGeometry([[1.15, 0.34], [1.05, 0.6], [1.0, 0.8], [1.35, 0.86], [1.45, 0.93]].map(([r, y]) => new THREE.Vector2(r, y)), 8, Math.PI / 8));
  parts.push(new THREE.BoxGeometry(4.2, 0.07, 1.3).translate(0, 0.965, 0), new THREE.BoxGeometry(1.3, 0.07, 4.2).translate(0, 0.965, 0));
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}

/** Flat-shaded unit tetrapod (breakwater block), about 1 m across. */
export function tetrapodGeometry(): THREE.BufferGeometry {
  const legs: THREE.BufferGeometry[] = [];
  const dirs = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.943, -0.333, 0), new THREE.Vector3(-0.471, -0.333, 0.816), new THREE.Vector3(-0.471, -0.333, -0.816)];
  for (const d of dirs) {
    const c = new THREE.CylinderGeometry(0.16, 0.26, 0.6, 7);
    c.translate(0, 0.3, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
    legs.push(c);
  }
  // weld the legs' vertices so the blocks shade smoothly, like cast concrete
  const g = mergeVertices(mergeAll(legs), 1e-3);
  g.computeVertexNormals();
  return g;
}

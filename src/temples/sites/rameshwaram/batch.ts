import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';

/**
 * World-space geometry collector: everything added under one material is merged into a single mesh
 * on flush(). Optional per-part vertex colour (for the painted gopurams and corridor pillars, whose
 * materials use vertexColors). UVs are projected in world metres after merging, unless keepUV.
 */
export class Batch {
  private parts = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; keepUV: boolean }>();
  /** transform applied to everything added while set */
  xf: THREE.Matrix4 | null = null;
  /** colour given to parts added without an explicit one (vertex-coloured materials only) */
  tint = new THREE.Color(1, 1, 1);

  add(mat: THREE.Material, geo: THREE.BufferGeometry, color?: THREE.ColorRepresentation | null, keepUV = false) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv') && k !== 'color') g.deleteAttribute(k);
    g.morphAttributes = {};
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (this.xf) g.applyMatrix4(this.xf);
    if ((mat as THREE.MeshStandardMaterial).vertexColors) {
      if (!g.attributes.color || color != null) {
        const c = color != null ? new THREE.Color(color) : this.tint;
        const n = g.attributes.position.count;
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
    } else if (g.attributes.color) g.deleteAttribute('color');
    if (keepUV && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    let e = this.parts.get(mat);
    if (!e) this.parts.set(mat, (e = { geos: [], keepUV }));
    e.geos.push(g);
    return g;
  }

  /** Box with its base at y, optionally turned about Y. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, color?: THREE.ColorRepresentation | null) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y + h / 2, z);
    return this.add(mat, g, color);
  }

  /** Box spanning two corners. */
  span(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color?: THREE.ColorRepresentation | null) {
    return this.box(mat, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, 0, color);
  }

  /** Lathe from [radius, y] pairs placed at (x, y, z). */
  lathe(mat: THREE.Material, prof: [number, number][], x: number, y: number, z: number, seg = 16, color?: THREE.ColorRepresentation | null, phase = 0) {
    const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(Math.max(r, 0.0001), yy)), seg, phase);
    g.translate(x, y, z);
    return this.add(mat, g, color);
  }

  /** Geometry placed at position with y-rotation and scale. */
  place(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, color?: THREE.ColorRepresentation | null) {
    const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sc);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    return this.add(mat, g, color);
  }

  get empty() { return this.parts.size === 0; }

  flush(parent: THREE.Object3D, shadows = true, name = 'batch') {
    const out: THREE.Mesh[] = [];
    for (const [mat, { geos, keepUV }] of this.parts) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      if (!keepUV) worldUV(merged);
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.name = name;
      m.castShadow = shadows;
      m.receiveShadow = true;
      parent.add(m);
      out.push(m);
    }
    this.parts.clear();
    return out;
  }
}

/** Collects instance transforms (and optional colours) for one geometry; becomes one InstancedMesh. */
export class Instances {
  mats: THREE.Matrix4[] = [];
  cols: THREE.Color[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material) {}
  at(x: number, y: number, z: number, s: number | [number, number, number] = 1, ry = 0, color?: THREE.ColorRepresentation) {
    const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sc);
    this.mats.push(m);
    if (color !== undefined) this.cols.push(new THREE.Color(color));
    return m;
  }
  flush(parent: THREE.Object3D, shadows = true) {
    if (!this.mats.length) return null;
    const inst = new THREE.InstancedMesh(this.geo, this.mat, this.mats.length);
    this.mats.forEach((m, i) => inst.setMatrixAt(i, m));
    if (this.cols.length === this.mats.length) this.cols.forEach((c, i) => inst.setColorAt(i, c));
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    parent.add(inst);
    return inst;
  }
}

/** Merge parts (any attributes) into one geometry with position, normal and optional colour. */
export function mergeParts(parts: { g: THREE.BufferGeometry; c?: THREE.ColorRepresentation }[], withColor = true) {
  const gs = parts.map(({ g, c }) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    if (withColor) {
      const col = new THREE.Color(c ?? 0xffffff);
      const a = new Float32Array(n.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; }
      n.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    return n;
  });
  return mergeGeometries(gs, false)!;
}

/** Seeded random. */
export function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Matrix: translate (x,y,z) then rotate about y. */
export function xfm(x: number, y: number, z: number, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
}

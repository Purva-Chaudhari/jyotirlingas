import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import type { Physics } from '../../engine/kit';

/**
 * Collects static geometry per material and merges it into one mesh per material,
 * so the whole Dham renders in a few dozen draw calls. UVs are projected in world
 * metres after placement, so stone textures run continuously across neighbouring parts.
 */
export class Merger {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  /** translation applied to everything added (and to colliders) while set */
  offset = new THREE.Vector3();
  constructor(public P: Physics, public name = 'merged') {}

  /** Add a geometry (cloned) under `mat`, optionally transformed. */
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4, keepUV = false) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (this.offset.lengthSq() > 0) g.translate(this.offset.x, this.offset.y, this.offset.z);
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) g.deleteAttribute(k);
    }
    g.morphAttributes = {};
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!keepUV || !g.attributes.uv) worldUV(g);
    let list = this.buckets.get(mat);
    if (!list) this.buckets.set(mat, (list = []));
    list.push(g);
  }

  /** Axis-aligned (or y-rotated) box standing on y. `solid` registers a collider (axis-aligned only). */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = false, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + h / 2, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(mat, g, m);
    if (solid) {
      x += this.offset.x; y += this.offset.y; z += this.offset.z;
      if (Math.abs(Math.sin(ry * 2)) > 0.01) {
        const r = Math.hypot(w, d) / 2;
        this.P.solid(x - r, y, z - r, x + r, y + h, z + r);
      } else {
        const sw = Math.abs(Math.cos(ry)) > 0.5 ? w : d, sd = Math.abs(Math.cos(ry)) > 0.5 ? d : w;
        this.P.solid(x - sw / 2, y, z - sd / 2, x + sw / 2, y + h, z + sd / 2);
      }
    }
  }

  /** Box given by min/max corners. */
  span(mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, solid = false) {
    this.box(mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, solid);
  }

  /** Geometry placed at position with y-rotation and uniform/non-uniform scale. */
  place(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, keepUV = false) {
    const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      sc,
    );
    this.add(mat, geo, m, keepUV);
  }

  /** materials whose merged mesh should not cast sun shadows (small metalwork, far ornaments) */
  noShadow = new Set<THREE.Material>();

  flush(parent: THREE.Object3D, shadows = true) {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.buckets) {
      const g = mergeGeometries(list, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = this.name;
      mesh.castShadow = shadows && !this.noShadow.has(mat);
      mesh.receiveShadow = true;
      parent.add(mesh);
      out.push(mesh);
      for (const l of list) l.dispose();
    }
    this.buckets.clear();
    return out;
  }
}

/** Cylindrical UVs in metres (u round the shaft, v up), for turned pillars: no stretched grain. */
export function cylUV(geo: THREE.BufferGeometry, rRef: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (n && Math.abs(n.getY(i)) > 0.8) { uv[i * 2] = x; uv[i * 2 + 1] = z; continue; }
    uv[i * 2] = (Math.atan2(z, x) + Math.PI) * rRef;
    uv[i * 2 + 1] = y;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

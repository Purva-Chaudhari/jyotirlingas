import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import type { Physics } from '../../engine/kit';

/**
 * Collects static geometry per material and merges it into one mesh per material, so the whole
 * Srisailam complex renders in a few dozen draw calls. UVs are projected in world metres after
 * placement, so textures run continuously across neighbouring parts.
 *
 * `frame` is a local → world transform (translation + rotation about y in quarter turns) applied
 * to everything added and to the colliders, so a gopuram can be built once in its own frame and
 * set into any of the four walls.
 */
export class Merger {
  private buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; noShadow: boolean }>();
  frame = new THREE.Matrix4();
  constructor(public P: Physics, public name = 'merged') {}

  setFrame(x: number, y: number, z: number, ry = 0) {
    this.frame.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  }
  resetFrame() { this.frame.identity(); }

  /** Add a geometry (cloned) under `mat`, optionally transformed (local), then by the frame. */
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4, keepUV = false) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    g.applyMatrix4(this.frame);
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) g.deleteAttribute(k);
    }
    g.morphAttributes = {};
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!keepUV || !g.attributes.uv) worldUV(g);
    let b = this.buckets.get(mat);
    if (!b) this.buckets.set(mat, (b = { geos: [], noShadow: false }));
    b.geos.push(g);
  }

  /** mark a material's merged mesh as not casting sun shadows (small interior details) */
  noShadow(mat: THREE.Material) {
    let b = this.buckets.get(mat);
    if (!b) this.buckets.set(mat, (b = { geos: [], noShadow: true }));
    b.noShadow = true;
  }

  /** collider in local frame coords (frame rotation must be a quarter turn) */
  solid(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const a = new THREE.Vector3(x0, y0, z0).applyMatrix4(this.frame), b = new THREE.Vector3(x1, y1, z1).applyMatrix4(this.frame);
    this.P.solid(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
  }

  /** walkable quad in local frame coords */
  floor(parent: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, y: number) {
    const a = new THREE.Vector3(x0, y, z0).applyMatrix4(this.frame), b = new THREE.Vector3(x1, y, z1).applyMatrix4(this.frame);
    this.P.floor(parent, Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), a.y);
  }

  /** Axis-aligned (or y-rotated) box standing on y. `solid` registers a collider. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = false, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + h / 2, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1),
    );
    this.add(mat, g, m);
    if (solid) {
      if (Math.abs(Math.sin(ry * 2)) > 0.01) {
        const r = Math.hypot(w, d) / 2;
        this.solid(x - r, y, z - r, x + r, y + h, z + r);
      } else {
        const sw = Math.abs(Math.cos(ry)) > 0.5 ? w : d, sd = Math.abs(Math.cos(ry)) > 0.5 ? d : w;
        this.solid(x - sw / 2, y, z - sd / 2, x + sw / 2, y + h, z + sd / 2);
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

  flush(parent: THREE.Object3D, shadows = true) {
    const out: THREE.Mesh[] = [];
    for (const [mat, { geos, noShadow }] of this.buckets) {
      if (!geos.length) continue;
      const g = mergeGeometries(geos, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = this.name;
      mesh.castShadow = shadows && !noShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      out.push(mesh);
      for (const l of geos) l.dispose();
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

/** LatheGeometry from [r, y] pairs, non-indexed with normals, no uv. */
export function lathe(prof: [number, number][], seg = 32, phi0 = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), seg, phi0, phiLen).toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

/** Seeded PRNG */
export function prng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Switch interior point lights on only when the camera is inside (sanctum, mandapa),
 * so the sunlit exterior is shaded without them. Driven by an always-drawn, invisible probe.
 */
export function lightZones(group: THREE.Object3D, inside: THREE.PointLight[], isInside: (p: THREE.Vector3) => boolean) {
  const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  probe.frustumCulled = false;
  let state: boolean | null = null;
  const set = (inn: boolean) => { for (const l of inside) l.visible = inn; };
  probe.onBeforeRender = (_r, _s, cam) => {
    const inn = isInside(cam.position);
    if (inn !== state) { state = inn; set(inn); }
  };
  group.add(probe);
  set(false);
}

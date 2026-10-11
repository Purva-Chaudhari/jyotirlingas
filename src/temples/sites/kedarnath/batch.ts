import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { worldUV } from '../../engine/materials';
import type { Physics } from '../../engine/kit';

/**
 * Collects many small stone pieces and merges them per material, so the whole
 * temple costs a handful of draw calls instead of hundreds.
 */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(private parent: THREE.Object3D, private P?: Physics) {}

  /** add a geometry already in world space; UVs are projected in metres */
  add(mat: THREE.Material, geo: THREE.BufferGeometry, uv = true) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (uv) worldUV(g);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
    return g;
  }

  /** bevelled box with bottom at y (like kit.box); optional collider */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = false, rotY = 0) {
    const bevel = Math.min(0.03, w / 4, h / 4, d / 4);
    const g = new RoundedBoxGeometry(w, h, d, 1, bevel);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y + h / 2, z));
    this.add(mat, g);
    if (solid && this.P) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      this.P.solid(x - hw, y, z - hd, x + hw, y + h, z + hd);
    }
  }

  /** plain (sharp) box, cheaper; for hidden or tiny pieces */
  slab(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y + h / 2, z));
    this.add(mat, g);
  }

  geo(mat: THREE.Material, g: THREE.BufferGeometry, m: THREE.Matrix4, uv = true) {
    g.applyMatrix4(m);
    this.add(mat, g, uv);
  }

  flush(cast = true, receive = true) {
    const meshes: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      this.parent.add(m);
      meshes.push(m);
    }
    this.parts.clear();
    return meshes;
  }
}

export const M4 = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s),
  );
  return m;
};

// ---------- deterministic noise (CPU) ----------

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

export function fbm(x: number, y: number, oct = 5) {
  let a = 0.5, f = 1, s = 0, t = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1);
    t += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / t;
}

/** ridged multifractal: sharp crests, as in glaciated granite */
export function ridged(x: number, y: number, oct = 6) {
  let a = 0.5, f = 1, s = 0, t = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(vnoise(x * f + i * 31.7, y * f + i * 5.3) * 2 - 1);
    n *= n;
    n *= w;
    w = Math.min(1, n * 1.6);
    s += a * n;
    t += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / t;
}

/** a welded icosphere (shared vertices → smooth normals after deformation) */
export function icoSphere(detail: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return mergeVertices(g);
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';

/**
 * Geometry batching for the Nageshwar site: world-space geometry is collected per material and merged
 * into one mesh per material, so the hundreds of mouldings, bays and tiers cost a handful of draw calls.
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const strip = (g: THREE.BufferGeometry, keepUV = false) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
};

export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  /** materials whose geometry carries its own UVs (decals, bands) — not re-projected on flush */
  private ownUV = new Set<THREE.Material>();

  add(mat: THREE.Material, geo: THREE.BufferGeometry) {
    const keep = this.ownUV.has(mat);
    const g = strip(geo, keep);
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
    return g;
  }

  /** geometry with hand-made UVs (kept as is) */
  addUV(mat: THREE.Material, geo: THREE.BufferGeometry) {
    this.ownUV.add(mat);
    return this.add(mat, geo);
  }

  /** place a local geometry (cloned) at x,y,z with rotation ry and scale */
  place(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1) {
    const g = geo.clone();
    const sc = typeof s === 'number' ? [s, s, s] : s;
    g.scale(sc[0], sc[1], sc[2]);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(mat, g);
  }

  /** Box with its base at y, optionally turned about Y. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y + h / 2, z);
    return this.add(mat, g);
  }

  /** Box spanning two corners. */
  span(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    return this.box(mat, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2);
  }

  /** Vertical prism from a plan polygon of [x, z] points, y0..y1. */
  prism(mat: THREE.Material, pts: [number, number][], y0: number, y1: number, holes: [number, number][][] = []) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    return this.add(mat, g);
  }

  /** Lathe from [radius, y] pairs placed at (x, y, z). */
  lathe(mat: THREE.Material, prof: [number, number][], x: number, y: number, z: number, seg = 24, phase = 0, len = Math.PI * 2) {
    const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(Math.max(r, 1e-4), yy)), seg, phase, len);
    g.translate(x, y, z);
    return this.add(mat, g);
  }

  flush(parent: THREE.Object3D, shadows = true) {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      if (!this.ownUV.has(mat)) worldUV(merged);
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

/** Instance transforms for one shared geometry; becomes a single InstancedMesh. */
export class Instances {
  mats: THREE.Matrix4[] = [];
  colors: THREE.Color[] = [];
  constructor(public geo: THREE.BufferGeometry, public mat: THREE.Material) {}
  at(x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(sx, sy, sz),
    );
    this.mats.push(m);
    return m;
  }
  matrix(m: THREE.Matrix4, c?: THREE.Color) {
    this.mats.push(m);
    if (c) this.colors.push(c);
  }
  flush(parent: THREE.Object3D, shadows = true) {
    if (!this.mats.length) return null;
    const inst = new THREE.InstancedMesh(this.geo, this.mat, this.mats.length);
    this.mats.forEach((m, i) => inst.setMatrixAt(i, m));
    if (this.colors.length === this.mats.length) this.colors.forEach((c, i) => inst.setColorAt(i, c));
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    parent.add(inst);
    return inst;
  }
}

/**
 * Sloping eave (chhajja) round a w×d rectangle centred at (cx, cz), projecting `out`, dropping `drop`
 * (both windings, so a single-sided material is fine).
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
    const ti = [top[i][0], top[i][1] - thick * 2.5, top[i][2]], tj = [top[j][0], top[j][1] - thick * 2.5, top[j][2]];
    quad(bj, bi, ti, tj);
  }
  const n = pos.length;
  for (let i = 0; i < n; i += 9) pos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 6], pos[i + 7], pos[i + 8], pos[i + 3], pos[i + 4], pos[i + 5]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.translate(cx, 0, cz);
  g.computeVertexNormals();
  B.add(mat, g);
}

/** Merge local part geometries (positions + normals only). */
export function mergeParts(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts.map((p) => strip(p)), false)!;
  return g;
}

/**
 * UVs for a horizontal band: u runs along the band (metres / period), v = 0..1 up its height.
 * Works for boxes whose long faces are axis aligned.
 */
export function bandUV(g: THREE.BufferGeometry, y0: number, h: number, period: number) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), nz = Math.abs(n.getZ(i));
    const along = nx > nz ? p.getZ(i) * Math.sign(n.getX(i)) : -p.getX(i) * Math.sign(n.getZ(i) || 1);
    uv[i * 2] = along / period;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The heaped flower bed of the jalahari (off10, off02, off01): close-up flower kit with baked crevice
 * shading in vertex colours (instance colour tints on top), so heads read as ruffled 3D masses:
 *  - marigold (genda): a dense ball of ruffled florets, ≈ 5 cm, deep orange to yellow;
 *  - mogra / jasmine: little clusters of white buds with green bases;
 *  - bel (bilva): a trifoliate leaf with a pale midrib, darker edges, cupped;
 *  - rose: a red head with deep folds.
 */

let sd = 1;
const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

function shade(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => [number, number, number]) {
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    w.fromBufferAttribute(n, i);
    const c = f(v, w);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** a ruffled ball: many small florets (high-frequency folds), crevices dark */
function marigoldGeo() {
  const g0 = new THREE.IcosahedronGeometry(1, 3);
  g0.deleteAttribute('uv');
  g0.deleteAttribute('normal');
  const g = mergeVertices(g0, 1e-4);
  const p = g.attributes.position;
  const fold = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    const a = Math.atan2(v.z, v.x), b = Math.asin(v.y);
    const f = Math.abs(Math.sin(a * 11 + b * 3) * Math.sin(b * 9 + a * 2)) ** 0.7 * 0.6 + Math.abs(Math.sin(a * 23 - b * 17)) * 0.4;
    fold[i] = f;
    const r = 0.86 + 0.22 * f;
    v.multiplyScalar(r);
    v.y = v.y * 0.72 + (v.y < 0 ? 0.15 * v.y : 0);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  const nf = new Float32Array(ng.attributes.position.count);
  // carry fold to non-indexed vertices via index
  const idx = g.index!;
  for (let i = 0; i < idx.count; i++) nf[i] = fold[idx.getX(i)];
  let k = 0;
  return shade(ng, (pp) => {
    const f = nf[k++];
    const ao = 0.38 + 0.62 * f;
    const under = pp.y < -0.2 ? 0.6 : 1;
    return [ao * under, ao * under * (0.9 + 0.1 * f), ao * under * 0.85];
  });
}

/** a cluster of 5 white buds with green bases */
function mograGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd(), d = i === 0 ? 0 : 0.011;
    const b = new THREE.SphereGeometry(0.0075, 8, 6).scale(1, 1.5, 1);
    b.rotateZ((rnd() - 0.5) * 1.2).rotateX((rnd() - 0.5) * 1.2);
    b.translate(Math.cos(a) * d, 0.009 + (i === 0 ? 0.006 : 0), Math.sin(a) * d);
    b.deleteAttribute('uv');
    parts.push(b.toNonIndexed());
  }
  const g = mergeGeometries(parts)!;
  return shade(g, (p) => {
    const t = Math.min(1, Math.max(0, (p.y - 0.002) / 0.012));
    return [0.55 + 0.45 * t, 0.62 + 0.38 * t, 0.45 + 0.53 * t];
  });
}

/** bel: three leaflets, middle longest, cupped and slightly twisted; pale midrib, darker rim */
function belGeo() {
  const leaflet = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(w * 1.1, l * 0.25, w * 0.8, l * 0.8, 0, l);
    s.bezierCurveTo(-w * 0.8, l * 0.8, -w * 1.1, l * 0.25, 0, 0);
    const g = new THREE.ShapeGeometry(s, 8);
    g.deleteAttribute('uv');
    return g;
  };
  const L = 0.06;
  const parts = [leaflet(L, L * 0.36), leaflet(L * 0.78, L * 0.3).rotateZ(1.15), leaflet(L * 0.78, L * 0.3).rotateZ(-1.15)];
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed()))!;
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    p.setY(i, (x * x + z * z) * 2.2 + Math.sin(Math.atan2(z, x) * 3) * 0.002 * r * 30);
  }
  g.computeVertexNormals();
  return shade(g, (pp) => {
    const a = Math.atan2(pp.z, pp.x), r = Math.hypot(pp.x, pp.z);
    // distance from the nearest leaflet's axis (angles −π/2 ± 1.15 and −π/2 after the rotateX)
    const axes = [-Math.PI / 2, -Math.PI / 2 + 1.15, -Math.PI / 2 - 1.15];
    let d = 9;
    for (const ax of axes) d = Math.min(d, Math.abs(Math.sin(a - ax)) * r);
    const rib = Math.max(0, 1 - d / 0.0025);
    const edge = Math.min(1, r / 0.06);
    const k = 0.75 + 0.25 * rib - 0.2 * edge;
    return [k * (1 + 0.35 * rib), k * (1 + 0.2 * rib), k * (1 + 0.1 * rib)];
  });
}

function roseGeo() {
  const g0 = new THREE.IcosahedronGeometry(1, 2);
  g0.deleteAttribute('uv');
  g0.deleteAttribute('normal');
  const g = mergeVertices(g0, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    const a = Math.atan2(v.z, v.x);
    const k = 1 + 0.14 * Math.sin(a * 5 + v.y * 7);
    p.setXYZ(i, v.x * k, v.y * 0.8 * k, v.z * k);
  }
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  return shade(ng, (pp) => {
    const a = Math.atan2(pp.z, pp.x);
    const f = 0.5 + 0.5 * Math.sin(a * 5 + pp.y * 7);
    const ao = 0.45 + 0.55 * f * (0.6 + 0.4 * Math.max(0, pp.y));
    return [ao, ao, ao];
  });
}

export type FlowerKind = 'marigold' | 'mogra' | 'bel' | 'rose';

export class FlowerBed {
  private items = new Map<FlowerKind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  constructor(seed = 5) { sd = seed; }

  add(kind: FlowerKind, x: number, y: number, z: number, s: number, color: number, tilt = 0.3, ry = rnd() * 6.283) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * tilt * 2, ry, (rnd() - 0.5) * tilt * 2));
    it.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    it.c.push(new THREE.Color(color).offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.06));
  }

  flush(parent: THREE.Object3D) {
    const geos: Record<FlowerKind, () => THREE.BufferGeometry> = {
      marigold: () => marigoldGeo().scale(0.026, 0.026, 0.026),
      mogra: mograGeo,
      bel: belGeo,
      rose: () => roseGeo().scale(0.024, 0.024, 0.024),
    };
    const out: THREE.InstancedMesh[] = [];
    for (const [kind, it] of this.items) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: kind === 'bel' ? 0.5 : 0.95, envMapIntensity: kind === 'bel' ? 0.8 : 0.25, side: kind === 'bel' ? THREE.DoubleSide : THREE.FrontSide,
      });
      const im = new THREE.InstancedMesh(geos[kind](), mat, it.m.length);
      it.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, it.c[i]); });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
      out.push(im);
    }
    return out;
  }
}

export const rand = () => rnd();

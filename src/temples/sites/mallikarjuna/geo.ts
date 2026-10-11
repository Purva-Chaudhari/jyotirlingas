import * as THREE from 'three';
import { lathe } from './merge';

/** Shared parametric pieces for Dravidian (and Kadamba-Nagara) architecture. Units metres. */

/** Box whose bottom is w0 × d0 and top is w1 × d1, standing on y = 0 (a frustum / kapota / tier). */
export function frustum(w0: number, d0: number, w1: number, d1: number, h: number) {
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setXYZ(i, p.getX(i) * (top ? w1 : w0), top ? h : 0, p.getZ(i) * (top ? d1 : d0));
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Plain box geometry standing on y = 0 */
export function blockGeo(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
}

/** Kalasha finial (pot, lid and spike) of height h, base at y = 0. */
export function kalashaGeo(h: number, seg = 16) {
  const p: [number, number][] = [[0, 0], [0.2, 0], [0.22, 0.05], [0.14, 0.1], [0.3, 0.24], [0.33, 0.34], [0.24, 0.46], [0.12, 0.52],
    [0.18, 0.56], [0.2, 0.6], [0.1, 0.64], [0.14, 0.7], [0.09, 0.78], [0.05, 0.86], [0.035, 0.95], [0, 1.0]];
  return lathe(p.map(([r, y]) => [r * h, y * h] as [number, number]), seg);
}

/** Hemispherical / bulbous dome of radius r, with `seg` facets (4 = square Dravida dome, 8 = octagonal) */
export function domeGeo(r: number, hScale = 1, seg = 8, bulb = 1.06, rotate = Math.PI / seg) {
  const prof: [number, number][] = [[0, 0], [r * 0.96, 0]];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 0.5;
    prof.push([r * Math.cos(a) * (1 + (bulb - 1) * Math.sin(a * 2)), r * hScale * Math.sin(a)]);
  }
  const g = lathe(prof, seg);
  g.rotateY(rotate);
  return g;
}

/** Wagon-vault (shala) roof: an ogee-pointed barrel of half-width rw, rise rh, running along x for length L. Base at y = 0. */
export function barrelGeo(L: number, rw: number, rh: number) {
  const s = new THREE.Shape();
  s.moveTo(-rw, 0);
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const t = i / N, a = Math.PI * (1 - t / 2);
    s.lineTo(Math.cos(a) * rw, Math.sin(a) * rh * (1 + 0.15 * t * t));
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / N, a = Math.PI * (t / 2);
    s.lineTo(Math.cos(a) * rw, Math.sin(a) * rh * (1 + 0.15 * t * t));
  }
  s.lineTo(-rw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

/** A horseshoe (kudu / gavaksha) arch frame lying in the XY plane, opening downwards, thickness t, depth d. */
export function kuduGeo(r: number, t: number, d: number) {
  const s = new THREE.Shape();
  const a0 = -0.25, a1 = Math.PI + 0.25;
  s.absarc(0, 0, r + t, a0, a1, false);
  s.absarc(0, 0, r, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -d / 2);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

/** A half-disc gable (nasi) in the XY plane: radius r, depth d */
export function nasiGeo(r: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false);
  s.lineTo(r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -d / 2);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

/** Curling horn (makara / kirtimukha horn) at a shala end: a quarter-to-half torus in the XY plane. */
export function hornGeo(R: number, tube: number) {
  const g = new THREE.TorusGeometry(R, tube, 6, 12, Math.PI * 1.1);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

/**
 * Sculpture massing for a niche or a gopuram tier: a standing figure on a pedestal — legs, hips,
 * torso, arms, head and a tall crown — with no features; height h, base at y = 0, facing +z.
 */
export function figureGeo(h: number, lo = false) {
  const sg = lo ? 4 : 7, ss = lo ? 5 : 8, sr = lo ? 3 : 6;
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); parts.push(n); };
  const limb = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number) => {
    const a = new THREE.Vector3(x0, y0, z0).multiplyScalar(h), b = new THREE.Vector3(x1, y1, z1).multiplyScalar(h);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r1 * h, r0 * h, len, sg);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q).translate(a.x, a.y, a.z);
    add(g);
  };
  add(new THREE.BoxGeometry(h * 0.44, h * 0.07, h * 0.24).translate(0, h * 0.035, 0));
  limb(-0.06, 0.07, 0, -0.07, 0.46, 0, 0.04, 0.055); // legs
  limb(0.06, 0.07, 0, 0.08, 0.46, 0.0, 0.04, 0.055);
  add(new THREE.SphereGeometry(h * 0.1, ss, sr).scale(1.15, 0.8, 0.75).translate(0, h * 0.47, 0)); // hips / waist cloth
  limb(0, 0.47, 0, 0, 0.7, 0, 0.075, 0.1); // torso, broadening to the shoulders
  add(new THREE.SphereGeometry(h * 0.09, ss, sr).scale(1.35, 0.6, 0.8).translate(0, h * 0.7, 0)); // shoulders
  limb(-0.12, 0.69, 0, -0.17, 0.5, 0.05, 0.032, 0.028); // arms
  limb(-0.17, 0.5, 0.05, -0.14, 0.36, 0.1, 0.028, 0.024);
  limb(0.12, 0.69, 0, 0.2, 0.78, 0.04, 0.032, 0.028);
  limb(0.2, 0.78, 0.04, 0.22, 0.94, 0.02, 0.028, 0.022);
  add(new THREE.SphereGeometry(h * 0.065, ss, sr).scale(1, 1.15, 1).translate(0, h * 0.8, 0)); // head
  add(new THREE.CylinderGeometry(h * 0.025, h * 0.06, h * 0.14, sg).translate(0, h * 0.92, 0)); // crown
  const g = mergeAll(parts.map((p) => { p.computeVertexNormals(); return p; }));
  return g;
}

/**
 * A rearing yali (leogryph) bracket figure as carved on Vijayanagara pillars, as unfeatured massing:
 * plinth, haunches, an upright body, raised forelegs, a maned head with a projecting snout, a curled
 * tail. Height h, base at y = 0, rearing toward +z.
 */
export function yaliGeo(h: number) {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); n.computeVertexNormals(); parts.push(n); };
  const limb = (a: number[], b: number[], r0: number, r1: number) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]).multiplyScalar(h), Bv = new THREE.Vector3(b[0], b[1], b[2]).multiplyScalar(h);
    const len = A.distanceTo(Bv);
    const g = new THREE.CylinderGeometry(r1 * h, r0 * h, len, 8).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
    add(g);
  };
  add(new THREE.BoxGeometry(h * 0.32, h * 0.08, h * 0.36).translate(0, h * 0.04, 0));
  add(new THREE.SphereGeometry(h * 0.11, 10, 8).scale(1.1, 1, 1.2).translate(0, h * 0.2, -h * 0.03)); // haunches
  limb([0, 0.18, -0.02], [0, 0.62, 0.06], 0.1, 0.085); // body
  add(new THREE.SphereGeometry(h * 0.11, 10, 8).scale(1.1, 1.1, 0.9).translate(0, h * 0.76, h * 0.08)); // maned head
  add(new THREE.BoxGeometry(h * 0.1, h * 0.08, h * 0.14).translate(0, h * 0.73, h * 0.2)); // snout
  for (const sx of [-1, 1]) {
    limb([sx * 0.06, 0.5, 0.08], [sx * 0.09, 0.42, 0.22], 0.035, 0.03); // raised forelegs
    limb([sx * 0.09, 0.42, 0.22], [sx * 0.08, 0.56, 0.3], 0.03, 0.025);
    limb([sx * 0.07, 0.15, 0.04], [sx * 0.08, 0.08, 0.1], 0.04, 0.035); // hind feet
    add(new THREE.ConeGeometry(h * 0.03, h * 0.1, 6).translate(sx * h * 0.06, h * 0.87, h * 0.04)); // horns / ears
  }
  limb([0, 0.25, -0.12], [0, 0.5, -0.16], 0.02, 0.025); // tail
  return mergeAll(parts);
}

export function mergeAll(parts: THREE.BufferGeometry[]) {
  // light-weight merge of non-indexed position/normal geometries
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Square-section lathe (4 facets rotated 45°) — for square domes, stupis, pedestals. */
export function squareLathe(prof: [number, number][]) {
  const g = lathe(prof.map(([r, y]) => [r * Math.SQRT2, y] as [number, number]), 4);
  g.rotateY(Math.PI / 4);
  g.computeVertexNormals();
  return g;
}

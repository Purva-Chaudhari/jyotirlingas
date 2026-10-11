import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import type { Batch, Instances } from './batch';

let seed = 11;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const reseed = (s: number) => { seed = s; };

const hidden = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });

/** Invisible walkable quad sloping along x (P.floor only slopes along z). */
export function rampX(parent: THREE.Object3D, P: Physics, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    x0, y0, z0, x1, y1, z0, x1, y1, z1, x0, y0, z1,
  ]), 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, hidden);
  parent.add(m);
  P.floors.push(m);
}

/**
 * A flight of solid steps rising along z from (z0, y0) to (z1, y1) (z1 may be < z0), with its walk ramp.
 * Steps are solid blocks down to `base` so the flight reads as masonry from the side.
 */
export function stairsZ(B: Batch, mat: THREE.Material, root: THREE.Object3D, P: Physics,
  x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, base = Math.min(y0, y1), riser = 0.18) {
  const n = Math.max(1, Math.round(Math.abs(y1 - y0) / riser));
  const dz = (z1 - z0) / n, dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const za = z0 + dz * i, zb = za + dz;
    const top = y0 + dy * (i + 1);
    B.span(mat, x0, x1, base, top, Math.min(za, zb), Math.max(za, zb));
  }
  P.floor(root, x0, x1, z0, z1, y0, y1);
}

/** Same, rising along x. */
export function stairsX(B: Batch, mat: THREE.Material, root: THREE.Object3D, P: Physics,
  x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, base = Math.min(y0, y1), riser = 0.18) {
  const n = Math.max(1, Math.round(Math.abs(y1 - y0) / riser));
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const xa = x0 + dx * i, xb = xa + dx;
    const top = y0 + dy * (i + 1);
    B.span(mat, Math.min(xa, xb), Math.max(xa, xb), base, top, z0, z1);
  }
  rampX(root, P, x0, x1, z0, z1, y0, y1);
}

/** Steel pipe railing between two points at height y (two rails + posts), batched. */
export function pipeRail(B: Batch, mat: THREE.Material, posts: Instances, ax: number, az: number, bx: number, bz: number, y: number, h = 1.0) {
  const len = Math.hypot(bx - ax, bz - az);
  const ang = Math.atan2(bz - az, bx - ax);
  for (const hh of [h, h * 0.5]) {
    const g = new THREE.CylinderGeometry(0.025, 0.025, len, 6).rotateZ(Math.PI / 2).rotateY(-ang);
    g.translate((ax + bx) / 2, y + hh, (az + bz) / 2);
    B.add(mat, g);
  }
  const n = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    posts.at(ax + (bx - ax) * t, y, az + (bz - az) * t, 1, h, 1);
  }
}

/** Phamsana roof: stacked, shrinking square tiers with a bell and finial. Unit base half-width 1. */
export function phamsanaGeometry(tiers = 5) {
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const s = 1 - i / (tiers + 0.6);
    const s2 = s * 0.9;
    const h = 0.32 * (1 - i * 0.06);
    parts.push(new THREE.CylinderGeometry(s2 * Math.SQRT2, s * Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4).translate(0, y + h / 2, 0));
    parts.push(new THREE.BoxGeometry(s2 * 2.02, 0.05, s2 * 2.02).translate(0, y + h + 0.025, 0));
    y += h + 0.05;
  }
  const prof: [number, number][] = [[0, 0], [0.32, 0], [0.36, 0.08], [0.3, 0.2], [0.12, 0.3], [0.2, 0.36], [0.18, 0.42], [0.06, 0.5], [0.02, 0.7], [0, 0.72]];
  parts.push(new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, y + yy)), 12));
  return parts;
}

/**
 * Small nagara shrine spire (rekha curve, banded) of base half-width hw, height h, at (x, y, z);
 * returns parts for batching.
 */
export function rekhaGeometry(hw: number, h: number, bands = 9, seg = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= bands; i++) {
    const t = i / bands;
    const w = hw * (1 - 0.62 * Math.pow(t, 1.8));
    const y = t * h * 0.86;
    prof.push(new THREE.Vector2(w * 1.04, y));
    if (i < bands) prof.push(new THREE.Vector2(w, y + 0.02 * h));
  }
  const top = h * 0.86, w1 = hw * 0.38;
  prof.push(new THREE.Vector2(w1 * 0.7, top + 0.01 * h), new THREE.Vector2(w1 * 1.05, top + 0.035 * h), new THREE.Vector2(w1 * 1.05, top + 0.06 * h),
    new THREE.Vector2(w1 * 0.5, top + 0.08 * h), new THREE.Vector2(w1 * 0.3, top + 0.11 * h), new THREE.Vector2(w1 * 0.08, h), new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(prof, seg, Math.PI / 4).scale(seg === 4 ? Math.SQRT2 : 1, 1, seg === 4 ? Math.SQRT2 : 1);
}

import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import type { Physics } from '../../engine/kit';
import { Batch, Instances, mergeParts, rng } from './batch';
import type { NM } from './mats';

/**
 * The colossal seated Shiva in front of the Nageshwar temple (~25 m overall, 1990s, painted concrete).
 *
 * Shiva sits in padmasana facing the temple, four-armed: the front right hand raised in abhaya, the front
 * left resting on the knee, the rear right holding the gilded trishul planted beside the knee, the rear
 * left raising the damaru. Jata piled high with the crescent moon, heavy kundalas, rudraksha malas on chest,
 * arms and jata, a serpent round the neck rearing its hood at the right shoulder, another on the right
 * forearm, and the tiger skin over the lap and across the chest. The face is left smooth and serene —
 * a respectful stylisation, no detailed features.
 *
 * Built as a signed-distance field (smooth union of ellipsoids and tapered capsules) in "seated units"
 * (≈ a 1.75 m person; 1 unit seat→jata top) and polygonised once with marching cubes, then scaled ×S.
 * Local frame: faces +z, right hand side is −x.
 */

// ---------- SDF primitives (scalar, allocation-free) ----------
function ell(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const qx = (px - cx) / rx, qy = (py - cy) / ry, qz = (pz - cz) / rz;
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const k1 = Math.sqrt((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
function cap(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, ra: number, rb: number) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

type J = [number, number, number];
// joints (seated units). Right side = −x.
export const POSE = {
  shR: [-0.2, 0.545, -0.005] as J, shL: [0.2, 0.545, -0.005] as J,
  // front right: abhaya
  elFR: [-0.315, 0.37, 0.09] as J, wrFR: [-0.33, 0.53, 0.2] as J, haFR: [-0.33, 0.6, 0.215] as J,
  // front left: on the knee
  elFL: [0.3, 0.34, 0.05] as J, wrFL: [0.32, 0.185, 0.2] as J, haFL: [0.33, 0.15, 0.26] as J,
  // rear right: holds the trishul
  shRR: [-0.17, 0.53, -0.07] as J, elRR: [-0.4, 0.56, -0.1] as J, haRR: [-0.45, 0.74, -0.07] as J,
  // rear left: raises the damaru
  shRL: [0.17, 0.53, -0.07] as J, elRL: [0.4, 0.55, -0.1] as J, haRL: [0.45, 0.73, -0.07] as J,
  // knees ~30% narrower than before: the knee span is now ≈1.7× the shoulder width, as on the statue
  kneeR: [-0.315, 0.07, 0.21] as J, kneeL: [0.315, 0.07, 0.21] as J,
  footR: [0.15, 0.16, 0.16] as J, footL: [-0.15, 0.125, 0.235] as J,
};

/** forearm: muscular near the elbow (a swelling a third of the way down), tapering to a wrist ≈0.6× the elbow */
function fore(x: number, y: number, z: number, a: J, b: J, k = 1): number {
  const m: J = [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3, a[2] + (b[2] - a[2]) * 0.3];
  return Math.min(cap(x, y, z, ...a, ...m, 0.047 * k, 0.049 * k), cap(x, y, z, ...m, ...b, 0.049 * k, 0.029 * k));
}

function body(x: number, y: number, z: number): number {
  const P = POSE;
  const ax = Math.abs(x);
  // torso
  let d = ell(x, y, z, 0, 0.13, -0.02, 0.21, 0.13, 0.16); // hips
  d = smin(d, ell(x, y, z, 0, 0.28, -0.005, 0.18, 0.15, 0.135), 0.05); // belly
  d = smin(d, ell(x, y, z, 0, 0.45, -0.01, 0.215, 0.16, 0.13), 0.05); // chest
  d = smin(d, ell(ax, y, z, 0.09, 0.47, 0.06, 0.1, 0.08, 0.065), 0.03); // pectorals
  d = smin(d, ell(ax, y, z, 0.2, 0.535, -0.01, 0.092, 0.082, 0.088), 0.04); // deltoids
  d = smin(d, ell(x, y, z, 0, 0.555, -0.03, 0.14, 0.05, 0.07), 0.04); // trapezius
  d = smin(d, cap(x, y, z, 0, 0.55, -0.005, 0, 0.665, 0.005, 0.062, 0.055), 0.03); // neck
  // head: cranium, jaw, nose ridge (no other features), ears
  d = smin(d, ell(x, y, z, 0, 0.755, 0.005, 0.088, 0.108, 0.1), 0.02);
  d = smin(d, ell(x, y, z, 0, 0.695, 0.035, 0.062, 0.048, 0.062), 0.03);
  d = smin(d, ell(x, y, z, 0, 0.742, 0.096, 0.012, 0.028, 0.016), 0.012);
  d = smin(d, ell(ax, y, z, 0.083, 0.748, 0.0, 0.014, 0.036, 0.022), 0.01);
  // jata: hair cap, piled bun, top knot, locks falling behind onto the shoulders
  d = smin(d, ell(x, y, z, 0, 0.79, -0.012, 0.09, 0.075, 0.1), 0.02);
  d = smin(d, ell(x, y, z, 0, 0.88, -0.015, 0.078, 0.07, 0.075), 0.035);
  d = smin(d, cap(x, y, z, 0, 0.9, -0.015, 0, 1.0, -0.02, 0.06, 0.03), 0.03);
  d = smin(d, ell(x, y, z, 0, 1.005, -0.02, 0.035, 0.03, 0.035), 0.02);
  d = smin(d, ell(x, y, z, 0, 0.66, -0.085, 0.115, 0.14, 0.04), 0.03);
  d = smin(d, ell(ax, y, z, 0.13, 0.6, -0.06, 0.055, 0.09, 0.045), 0.03);
  // legs in padmasana: thighs out to the knees, shins crossing to feet on the opposite thighs
  d = smin(d, cap(x, y, z, -0.1, 0.105, 0.0, P.kneeR[0], P.kneeR[1], P.kneeR[2], 0.1, 0.07), 0.03);
  d = smin(d, cap(x, y, z, 0.1, 0.105, 0.0, P.kneeL[0], P.kneeL[1], P.kneeL[2], 0.1, 0.07), 0.03);
  // shins: calf swelling just below the knee, tapering to the ankle, crossing in front onto the opposite thigh
  d = smin(d, cap(x, y, z, P.kneeR[0], P.kneeR[1], P.kneeR[2], P.footR[0] - 0.08, P.footR[1] - 0.01, P.footR[2] + 0.03, 0.068, 0.04), 0.012);
  d = smin(d, ell(x, y, z, P.kneeR[0] * 0.72, P.kneeR[1] + 0.03, P.kneeR[2] + 0.01, 0.09, 0.055, 0.06), 0.015);
  d = smin(d, cap(x, y, z, P.kneeL[0], P.kneeL[1], P.kneeL[2], P.footL[0] + 0.08, P.footL[1] - 0.01, P.footL[2] + 0.02, 0.068, 0.04), 0.012);
  d = smin(d, ell(x, y, z, P.kneeL[0] * 0.72, P.kneeL[1] + 0.025, P.kneeL[2] + 0.04, 0.09, 0.055, 0.06), 0.015);
  d = smin(d, ell(x, y, z, 0, 0.06, 0.08, 0.15, 0.05, 0.1), 0.035); // the lap between the knees
  // feet, soles up, resting on the thighs
  d = smin(d, ell(x, y, z, P.footR[0], P.footR[1], P.footR[2], 0.1, 0.034, 0.05), 0.008);
  d = smin(d, ell(x, y, z, P.footL[0], P.footL[1], P.footL[2], 0.1, 0.034, 0.05), 0.008);
  // heels pressed into the lap, toes turned up at the outer thigh
  d = smin(d, ell(x, y, z, P.footR[0] + 0.085, P.footR[1] + 0.012, P.footR[2], 0.03, 0.03, 0.04), 0.01);
  d = smin(d, ell(x, y, z, P.footL[0] - 0.085, P.footL[1] + 0.012, P.footL[2], 0.03, 0.03, 0.04), 0.01);
  // arms
  d = smin(d, cap(x, y, z, ...P.shR, ...P.elFR, 0.064, 0.045), 0.03);
  d = smin(d, ell(x, y, z, ...P.elFR, 0.05, 0.05, 0.05), 0.015);
  d = smin(d, fore(x, y, z, P.elFR, P.wrFR), 0.015);
  d = smin(d, ell(x, y, z, P.haFR[0], P.haFR[1], P.haFR[2], 0.05, 0.08, 0.022), 0.015); // raised palm, fingers up
  d = smin(d, cap(x, y, z, P.haFR[0] + 0.035, P.haFR[1] - 0.03, P.haFR[2], P.haFR[0] + 0.06, P.haFR[1] + 0.01, P.haFR[2] + 0.005, 0.012, 0.01), 0.01); // thumb
  d = smin(d, cap(x, y, z, ...P.shL, ...P.elFL, 0.064, 0.045), 0.03);
  d = smin(d, ell(x, y, z, ...P.elFL, 0.05, 0.05, 0.05), 0.015);
  d = smin(d, fore(x, y, z, P.elFL, P.wrFL), 0.015);
  d = smin(d, ell(x, y, z, P.haFL[0], P.haFL[1], P.haFL[2], 0.042, 0.025, 0.07), 0.02);
  d = smin(d, cap(x, y, z, ...P.shRR, ...P.elRR, 0.056, 0.042), 0.03);
  d = smin(d, ell(x, y, z, ...P.elRR, 0.046, 0.046, 0.046), 0.015);
  d = smin(d, fore(x, y, z, P.elRR, P.haRR, 0.9), 0.015);
  d = smin(d, ell(x, y, z, P.haRR[0], P.haRR[1], P.haRR[2], 0.04, 0.045, 0.038), 0.015);
  d = smin(d, cap(x, y, z, ...P.shRL, ...P.elRL, 0.056, 0.042), 0.03);
  d = smin(d, ell(x, y, z, ...P.elRL, 0.046, 0.046, 0.046), 0.015);
  d = smin(d, fore(x, y, z, P.elRL, P.haRL, 0.9), 0.015);
  d = smin(d, ell(x, y, z, P.haRL[0], P.haRL[1], P.haRL[2], 0.04, 0.045, 0.038), 0.015);
  // seated on the rock: flat underside
  return Math.max(d, 0.004 - y);
}

/** gradient of the SDF (for placing beads on the surface) */
function grad(x: number, y: number, z: number): THREE.Vector3 {
  const e = 0.002;
  return new THREE.Vector3(
    body(x + e, y, z) - body(x - e, y, z),
    body(x, y + e, z) - body(x, y - e, z),
    body(x, y, z + e) - body(x, y, z - e),
  ).normalize();
}
function toSurface(p: THREE.Vector3, off: number) {
  for (let i = 0; i < 6; i++) {
    const d = body(p.x, p.y, p.z);
    const g = grad(p.x, p.y, p.z);
    p.addScaledVector(g, -(d - off));
  }
  return p;
}

/** polygonise the SDF over a cube of side SIDE centred at (cx, cy, cz) */
function polygonise(material: THREE.Material, RES: number, SIDE: number, cx: number, cy: number, cz: number) {
  const mc = new MarchingCubes(RES, material, false, false, 900000);
  mc.isolation = 0;
  const f = mc.field as Float32Array;
  const half = SIDE / 2, vox = SIDE / RES;
  const B = 6;
  const blockR = vox * B * 0.9;
  for (let bk = 0; bk < RES; bk += B) for (let bj = 0; bj < RES; bj += B) for (let bi = 0; bi < RES; bi += B) {
    const mx = cx - half + (bi + B / 2) * vox, my = cy - half + (bj + B / 2) * vox, mz = cz - half + (bk + B / 2) * vox;
    const dc = body(mx, my, mz);
    const k1 = Math.min(RES, bk + B), j1 = Math.min(RES, bj + B), i1 = Math.min(RES, bi + B);
    if (Math.abs(dc) > blockR) {
      const v = -dc * 40;
      for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) f[i + j * RES + k * RES * RES] = v;
      continue;
    }
    for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) {
      f[i + j * RES + k * RES * RES] = -body(cx - half + i * vox, cy - half + j * vox, cz - half + k * vox) * 40;
    }
  }
  // MarchingCubes leaves a 1-cell border unpolygonised; the cube is sized with margin
  mc.update();
  const n = mc.count;
  const pos = (mc.geometry.attributes.position.array as Float32Array).slice(0, n * 3);
  const nor = (mc.geometry.attributes.normal.array as Float32Array).slice(0, n * 3);
  mc.geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // MC space [-1, 1]³ → units (the field index i maps to x = -half + i*vox, and MC maps i to -1 + 2i/RES)
  g.scale(half, half, half);
  g.translate(cx, cy, cz);
  // ambient occlusion baked per vertex from the distance field: march out along the surface normal and
  // see how soon other parts of the body close in. Deepens the creases between chest and arms, under the
  // pectorals, at the elbows, the folded legs and the jata — the sculpted form reads without a face.
  const sdf = (x: number, y: number, z: number) => {
    const gx = (x - (cx - half)) / vox, gy = (y - (cy - half)) / vox, gz = (z - (cz - half)) / vox;
    const i0 = Math.floor(gx), j0 = Math.floor(gy), k0 = Math.floor(gz);
    if (i0 < 0 || j0 < 0 || k0 < 0 || i0 >= RES - 1 || j0 >= RES - 1 || k0 >= RES - 1) return 1;
    const fx = gx - i0, fy = gy - j0, fz = gz - k0;
    const at = (i: number, j: number, k: number) => f[i + j * RES + k * RES * RES];
    const c00 = at(i0, j0, k0) * (1 - fx) + at(i0 + 1, j0, k0) * fx, c10 = at(i0, j0 + 1, k0) * (1 - fx) + at(i0 + 1, j0 + 1, k0) * fx;
    const c01 = at(i0, j0, k0 + 1) * (1 - fx) + at(i0 + 1, j0, k0 + 1) * fx, c11 = at(i0, j0 + 1, k0 + 1) * (1 - fx) + at(i0 + 1, j0 + 1, k0 + 1) * fx;
    return -((c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz) / 40;
  };
  const P = g.attributes.position, Nn = g.attributes.normal;
  const ao = new Float32Array(P.count);
  const h = 0.011, e = vox * 0.7;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let nx = sdf(x + e, y, z) - sdf(x - e, y, z), ny = sdf(x, y + e, z) - sdf(x, y - e, z), nz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) < 0.5) { nx = Nn.getX(i); ny = Nn.getY(i); nz = Nn.getZ(i); }
    let occ = 0, w = 1;
    for (let k = 1; k <= 5; k++) {
      const d = k * h;
      occ += (d - sdf(x + nx * d, y + ny * d, z + nz * d)) * w;
      w *= 0.62;
    }
    ao[i] = Math.max(0.3, Math.min(1, 1 - occ * 13));
  }
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  g.computeBoundingSphere();
  return g;
}

/** Tiger skin over the lap and across the chest, applied by object-space mask on the statue material. */
function tigerSkin(m: THREE.MeshStandardMaterial) {
  const P = POSE;
  const v3 = (a: J) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSL;\nattribute float aAO;\nvarying float vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSL = position;\nvAO = aAO;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSL;
        varying float vAO;
        float th(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float tn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float inE(vec3 p, vec3 c, vec3 r) { vec3 q = (p - c) / r; return 1.0 - smoothstep(0.85, 1.05, dot(q, q)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 p = vSL;
          // lap and thighs (not the feet, not the resting hand)
          // the skin is worn as a short garment: waist wrap and the flap over the lap; the legs are bare
          // (only behind the crossed shins: z < 0.13, so the shins and feet stay bare)
          float lap = (1.0 - smoothstep(0.16, 0.2, abs(p.x))) * (1.0 - smoothstep(0.3, 0.32, p.y)) * (1.0 - smoothstep(0.1, 0.13, p.z)) * step(0.1, p.y);
          lap = max(lap, (1.0 - smoothstep(0.26, 0.3, p.y)) * step(0.17, p.y) * step(abs(p.x), 0.23));
          lap *= 1.0 - inE(p, ${v3(P.footR)}, vec3(0.13, 0.07, 0.075));
          lap *= 1.0 - inE(p, ${v3(P.footL)}, vec3(0.13, 0.07, 0.075));
          lap *= 1.0 - inE(p, ${v3(P.haFL)}, vec3(0.06, 0.05, 0.09));
          // the skin across the chest: from the left shoulder down to the right hip (front and back)
          vec2 a = vec2(0.17, 0.57), b = vec2(-0.15, 0.2);
          vec2 q = vec2(p.x, p.y) - a, ab = b - a;
          float h = clamp(dot(q, ab) / dot(ab, ab), 0.0, 1.0);
          float dl = length(q - ab * h);
          float sash = (1.0 - smoothstep(0.13, 0.15, dl)) * step(abs(p.x), 0.24) * step(0.18, p.y) * step(p.y, 0.6);
          float tiger = max(lap, sash);
          // stripes: irregular dark brown bands on ochre
          float n = tn(p * 22.0) * 1.6 + tn(p * 55.0) * 0.5;
          float s = sin(p.x * 70.0 + p.y * 25.0 + n * 3.2);
          float stripe = smoothstep(0.55, 0.85, s) * smoothstep(0.25, 0.55, tn(p * 9.0 + 3.0) + 0.3);
          // terracotta paint, a little redder in the hollows of the noise
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.0, 0.9, 0.86), tn(p * 14.0));
          // jata and the locks behind: same paint, darker brown strands
          float hair = max(smoothstep(0.8, 0.83, p.y) * step(abs(p.x), 0.12), step(0.58, p.y) * step(p.z, -0.055) * step(abs(p.x), 0.17));
          float strand = 0.55 + 0.45 * sin(p.x * 260.0 + tn(p * 40.0) * 4.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.48, 0.4) * strand, hair * 0.85);
          // tiger skin: darker orange-brown fur with low-contrast stripes
          vec3 fur = mix(vec3(0.39, 0.13, 0.042), vec3(0.47, 0.18, 0.06), tn(p * 30.0));
          fur = mix(fur, vec3(0.1, 0.032, 0.014), stripe * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, fur, tiger);
          // tripundra: three white bands of ash across the forehead, a red dot at the centre
          float fore = step(0.07, p.z) * (1.0 - smoothstep(0.05, 0.058, abs(p.x)));
          float bands = 0.0;
          for (int i = 0; i < 3; i++) bands = max(bands, 1.0 - smoothstep(0.0028, 0.0042, abs(p.y - (0.772 + float(i) * 0.011))));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.86, 0.8), bands * fore);
          float dot = (1.0 - smoothstep(0.006, 0.0075, length(vec2(p.x, p.y - 0.783)))) * step(0.07, p.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.02, 0.02), dot);
          // painted concrete: faint grime in creases (lower) and rain streaks
          float streak = smoothstep(0.7, 0.95, tn(vec3(p.x * 40.0, p.y * 3.0, p.z * 40.0)));
          diffuseColor.rgb *= 1.0 - 0.07 * streak;
          // baked occlusion: deeper, slightly redder in the creases (as painted concrete weathers)
          diffuseColor.rgb *= mix(vec3(0.55, 0.42, 0.36), vec3(1.0), vAO);
        }`);
  };
  m.customProgramCacheKey = () => 'nag-statue';
  m.needsUpdate = true;
}

/** position (≈58 m N of the temple), scale, rock height/radius, the 2024–25 square deck (half-size, height) */
export const STATUE = { x: -12, z: -58, S: 19.0, ped: 5.0, pedR: 8.4, deck: 13, deckH: 1.2 };

export interface StatueOut { group: THREE.Group }

export function buildStatue(root: THREE.Object3D, K: NM, P: Physics): StatueOut {
  const group = new THREE.Group();
  group.name = 'shiva-statue';
  root.add(group);
  const { x: SX, z: SZ, S, ped, deckH } = STATUE;
  // the statue faces WEST (toward the gate and the road), parallel to the temple front: the local frame
  // faces +z, so the whole figure, its details and the rock are built in a pivot turned −90° about y
  const piv = new THREE.Group();
  piv.position.set(SX, 0, SZ);
  piv.rotation.y = -Math.PI / 2;
  group.add(piv);
  const base = deckH + ped;

  // ---------- the figure ----------
  tigerSkin(K.statue);
  const geo = polygonise(K.statue, 132, 1.24, 0, 0.5, 0.04);
  const fig = new THREE.Mesh(geo, K.statue);
  fig.scale.setScalar(S);
  fig.position.set(0, base, 0);
  fig.castShadow = fig.receiveShadow = true;
  piv.add(fig);

  // ---------- details in seated units (a sub-group scaled ×S) ----------
  const det = new THREE.Group();
  det.position.set(0, base, 0);
  det.scale.setScalar(S);
  piv.add(det);
  const B = new Batch();
  const beads = new Instances(rudrakshaGeo(), K.rudraksha);
  const bead = (p: THREE.Vector3, r: number) => beads.at(p.x, p.y, p.z, r);

  // rudraksha malas on the chest: three loops of increasing depth, beads pushed onto the body surface
  for (const [depth, r, wide] of [[0.12, 0.011, 0.1], [0.22, 0.012, 0.13], [0.33, 0.013, 0.15]] as const) {
    // a closed loop: behind the neck at the back, sagging down the chest in front
    const n = Math.round(70 + depth * 300);
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * Math.PI * 2;
      const front = Math.max(0, Math.cos(phi));
      const p = new THREE.Vector3(
        Math.sin(phi) * (0.085 + wide * Math.pow(front, 0.6) * 0.6),
        0.6 - depth * Math.pow(front, 1.4) - 0.01 * (1 - front),
        0.02 + Math.cos(phi) * 0.16,
      );
      toSurface(p, r * 1.05);
      bead(p, r);
    }
  }
  // the guru bead and a short tassel at the foot of the longest mala
  {
    const p = new THREE.Vector3(0, 0.6 - 0.33 - 0.02, 0.18);
    toSurface(p, 0.02);
    bead(p, 0.019);
    for (let k = 1; k <= 4; k++) { const q = p.clone().add(new THREE.Vector3(0, -k * 0.016, 0.004)); toSurface(q, 0.012); bead(q, 0.009); }
  }
  // armlets and wristlets: rings of beads round each limb
  const ringOn = (a: J, b: J, t: number, rad: number, br: number) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    const c = A.clone().lerp(Bv, t), ax = Bv.clone().sub(A).normalize();
    const u = new THREE.Vector3(0, 1, 0).cross(ax);
    if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
    u.normalize();
    const v = ax.clone().cross(u);
    const n = Math.round((Math.PI * 2 * rad) / (br * 2.1));
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      bead(c.clone().addScaledVector(u, Math.cos(th) * rad).addScaledVector(v, Math.sin(th) * rad), br);
    }
  };
  const Pp = POSE;
  ringOn(Pp.shR, Pp.elFR, 0.45, 0.058, 0.009);
  ringOn(Pp.shL, Pp.elFL, 0.45, 0.058, 0.009);
  ringOn(Pp.shRR, Pp.elRR, 0.5, 0.052, 0.009);
  ringOn(Pp.shRL, Pp.elRL, 0.5, 0.052, 0.009);
  ringOn(Pp.elFR, Pp.wrFR, 0.85, 0.042, 0.008);
  ringOn(Pp.elFL, Pp.wrFL, 0.85, 0.042, 0.008);
  ringOn(Pp.elRR, Pp.haRR, 0.75, 0.04, 0.008);
  ringOn(Pp.elRL, Pp.haRL, 0.75, 0.04, 0.008);
  // jata: two bead bands binding the bun
  for (const [y, rr] of [[0.84, 0.088]] as const) {
    const n = Math.round((Math.PI * 2 * rr) / 0.019);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(th) * rr, y, -0.015 + Math.sin(th) * rr * 1.05);
      toSurface(p, 0.007);
      bead(p, 0.009);
    }
  }
  // kundalas (heavy ear rings)
  for (const s of [-1, 1]) {
    const k = new THREE.TorusGeometry(0.03, 0.009, 8, 20).translate(s * 0.095, 0.69, 0.005);
    B.add(K.outdoorGold, k);
  }
  // crescent moon on the jata, front right
  const moon = new THREE.TorusGeometry(0.045, 0.011, 8, 24, Math.PI * 1.15).rotateZ(-0.35).translate(-0.045, 0.915, 0.06);
  B.add(K.ash, moon);

  // serpents: one round the neck rearing at the right shoulder, one coiled on the right forearm hanging down
  const snake = (pts: THREE.Vector3[], r0: number, r1: number, hood: boolean) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = Math.max(24, pts.length * 12), rad = 10;
    const g = new THREE.TubeGeometry(curve, segs, 1, rad, false);
    const p = g.attributes.position;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, c = curve.getPointAt(u);
      const r = r0 + (r1 - r0) * u * (hood ? 1 : 1) * (u < 0.05 ? u / 0.05 : 1);
      for (let j = 0; j <= rad; j++) {
        const k = i * (rad + 1) + j;
        const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c);
        p.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    B.add(K.serpent, g);
    if (hood) {
      const end = curve.getPointAt(1), tan = curve.getTangentAt(1);
      const h = new THREE.SphereGeometry(1, 16, 12).scale(0.042, 0.055, 0.014);
      const head = new THREE.SphereGeometry(1, 12, 8).scale(0.02, 0.014, 0.03).translate(0, 0.045, 0.016);
      const hg = mergeParts([h, head]);
      // stand the hood up, facing forward (+z) and slightly toward the face
      hg.rotateY(0.35);
      hg.translate(end.x + tan.x * 0.02, end.y + 0.03, end.z + tan.z * 0.02);
      B.add(K.serpent, hg);
    }
  };
  const neck: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * 0.5 + (i / 14) * Math.PI * 2.1;
    neck.push(new THREE.Vector3(Math.cos(a) * 0.088, 0.585 + Math.sin(a * 0.5) * 0.012 - i * 0.001, Math.sin(a) * 0.088 - 0.002));
  }
  // over the right shoulder and up
  neck.push(new THREE.Vector3(-0.13, 0.6, 0.02), new THREE.Vector3(-0.16, 0.65, 0.02), new THREE.Vector3(-0.165, 0.7, 0.03));
  snake(neck, 0.012, 0.016, true);
  const arm: THREE.Vector3[] = [];
  const e = new THREE.Vector3(...Pp.elFR), w = new THREE.Vector3(...Pp.wrFR);
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, c = e.clone().lerp(w, 0.2 + t * 0.6);
    const a = t * Math.PI * 3;
    arm.push(c.add(new THREE.Vector3(Math.cos(a) * 0.044, 0, Math.sin(a) * 0.044)));
  }
  arm.push(new THREE.Vector3(-0.38, 0.38, 0.2), new THREE.Vector3(-0.4, 0.28, 0.22), new THREE.Vector3(-0.39, 0.2, 0.25));
  snake(arm, 0.008, 0.008, false);

  // trishul (gilded), planted on the rock beside the right knee, held by the rear right hand
  const tx = Pp.haRR[0] - 0.005, tz = Pp.haRR[2] + 0.04;
  B.lathe(K.terracotta, [[0.012, 0], [0.012, 0.96], [0.018, 0.965], [0.018, 0.985], [0.012, 0.99], [0.001, 0.99]], tx, 0, tz, 10);
  B.lathe(K.terracotta, [[0.001, 0], [0.018, 0], [0.028, 0.03], [0.014, 0.12], [0.001, 0.16]], tx, 0.99, tz, 8);
  for (const s of [-1, 1]) {
    const prong = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tx, 0.98, tz), new THREE.Vector3(tx + s * 0.06, 0.99, tz), new THREE.Vector3(tx + s * 0.075, 1.04, tz), new THREE.Vector3(tx + s * 0.06, 1.1, tz),
    ]);
    B.add(K.terracotta, new THREE.TubeGeometry(prong, 12, 0.009, 6, false));
    B.add(K.terracotta, new THREE.ConeGeometry(0.014, 0.04, 6).translate(tx + s * 0.06, 1.115, tz));
  }
  B.add(K.terracotta, new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10).translate(tx, 0.975, tz));
  // a small saffron pennant tied below the prongs
  B.add(K.saffron, new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([tx, 0.95, tz, tx, 0.9, tz, tx - 0.05, 0.94, tz + 0.03], 3)).toNonIndexed());
  // a small damaru tied below the trident head as in many images is skipped; the hand's damaru:
  const dm = new THREE.LatheGeometry([[0.001, -0.06], [0.045, -0.06], [0.04, -0.03], [0.012, 0], [0.04, 0.03], [0.045, 0.06], [0.001, 0.06]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
  dm.rotateZ(Math.PI / 2 - 0.2).translate(Pp.haRL[0] + 0.01, Pp.haRL[1] + 0.06, Pp.haRL[2] + 0.02);
  B.add(K.wood, dm);
  B.add(K.statue, new THREE.CylinderGeometry(0.046, 0.046, 0.006, 16).rotateZ(Math.PI / 2 - 0.2).translate(Pp.haRL[0] + 0.01 + 0.058, Pp.haRL[1] + 0.06 + 0.012, Pp.haRL[2] + 0.02));

  B.flush(det);
  beads.flush(det);
  det.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });

  // ---------- the rock pedestal and the deck ----------
  buildPedestal(piv, K, P);
  return { group };
}

function buildPedestal(piv: THREE.Group, K: NM, P: Physics) {
  // built in the pivot's local frame (front = +z local = world −x); physics in world coordinates
  const { x: SX, z: SZ, ped, pedR, deck: D, deckH: DH } = STATUE;
  const r = rng(5);
  // irregular rock drum: radial noise, bulging, with ledges
  const segU = 96, segV = 22;
  const pos: number[] = [];
  const idx: number[] = [];
  const noise = new Float32Array(segU);
  for (let i = 0; i < segU; i++) noise[i] = r();
  const n1 = (u: number) => {
    const f = u * segU, i = Math.floor(f) % segU, t = f - Math.floor(f);
    return noise[i] * (1 - t) + noise[(i + 1) % segU] * t;
  };
  for (let j = 0; j <= segV; j++) {
    const v = j / segV, y = v * ped;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU, a = u * Math.PI * 2;
      // boulder-like lobes, the rock rounding over at the top onto the seat
      const lobes = 0.09 * Math.sin(a * 5 + v * 4) + 0.06 * Math.sin(a * 11 - v * 7) + 0.035 * Math.sin(a * 23 + v * 13) + 0.03 * Math.sin(v * 22);
      const prof = pedR * (1 - 0.16 * v) * (1 + lobes) + (n1(u) - 0.5) * 0.7 * (1 - v * 0.5);
      const roll = v > 0.85 ? (v - 0.85) / 0.15 : 0;
      const rr = prof * (1 - 0.14 * roll * roll);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr * 0.92);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + segU + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const capG = new THREE.CircleGeometry(pedR * 0.72, 48).rotateX(-Math.PI / 2).scale(1, 1, 0.92).translate(0, ped - 0.02, 0);
  const rock = new THREE.Mesh(mergeParts([g, capG]), K.pedestal);
  rock.position.set(0, DH, 0);
  rock.castShadow = rock.receiveShadow = true;
  piv.add(rock);

  const B = new Batch();
  // the rock rolls straight up under the figure (no carved lotus band: the real seat is a rough mound
  // with the tiger skin thrown over its front), and the skin's head hangs front and centre
  // the head and the skin's two forepaws (hanging either side, with heavy pads) are one mesh
  const hy = ped * 0.56;
  const headM = new THREE.Matrix4().compose(new THREE.Vector3(0, DH + hy, pedR * (1 - 0.16 * 0.56) * 0.92 * 0.97 + 0.1),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, 0)), new THREE.Vector3(1.3, 1.3, 1.3));
  const headG = tigerHeadGeo().applyMatrix4(headM);
  const parts = [headG];
  for (const sx of [-1, 1]) {
    parts.push(mergeParts([
      new THREE.CapsuleGeometry(0.32, 1.5, 4, 10).scale(1, 1, 0.55),
      new THREE.SphereGeometry(0.42, 12, 8).scale(1, 0.7, 0.6).translate(0, -1.0, 0.08),
    ]).rotateZ(sx * 0.18).rotateX(-0.12).translate(sx * 2.15, DH + ped * 0.27, pedR * (1 - 0.16 * 0.27) * 0.92 * 0.99));
  }
  const th = new THREE.Mesh(mergeParts(parts), tigerHeadMaterial(headM.clone().invert()));
  th.castShadow = th.receiveShadow = true;
  piv.add(th);

  // the square raised deck (2024–25): brown-red tiled top, cream edge band, a steel railing, a stair at the front
  B.span(K.lime, -D, D, 0, DH - 0.12, -D, D);
  B.span(K.cream, -D - 0.05, D + 0.05, DH - 0.12, DH, -D - 0.05, D + 0.05);
  B.add(K.deckTile, new THREE.PlaneGeometry(D * 2 - 0.2, D * 2 - 0.2).rotateX(-Math.PI / 2).translate(0, DH + 0.006, 0));
  const posts = new Instances(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), K.steel);
  const sw = 2.2; // stair half-width
  for (const [ax, az, bx, bz] of [[-D, -D, D, -D], [D, -D, D, D], [-D, -D, -D, D], [-D, D, -sw, D], [sw, D, D, D]]) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) posts.at(ax + (bx - ax) * i / n - Math.sign(ax + bx) * 0.15 * (az === bz ? 0 : 1), DH + 0.47, az + (bz - az) * i / n - Math.sign(az + bz) * 0.15 * (ax === bx ? 0 : 1));
    const g2 = new THREE.BoxGeometry(az === bz ? len : 0.05, 0.05, az === bz ? 0.05 : len);
    B.place(K.steel, g2, (ax + bx) / 2 - (az === bz ? 0 : Math.sign(ax) * 0.15), DH + 0.95, (az + bz) / 2 - (ax === bx ? 0 : Math.sign(az) * 0.15));
  }
  // front stair (local +z), 7 risers
  const n = 7, rise = DH / n, tread = 0.35;
  for (let i = 0; i < n; i++) B.span(i % 2 ? K.cream : K.lime, -sw, sw, 0, DH - rise * (i + 1) + rise, D + i * tread, D + (i + 1) * tread);
  posts.flush(piv);
  B.flush(piv);

  // physics (world): local (lx, lz) → world (SX − lz, SZ + lx) for the −90° pivot
  P.floor(piv.parent!, SX - D, SX + D, SZ - D, SZ + D, DH);
  for (let i = 0; i < n; i++) {
    const y = DH - rise * (i + 1);
    P.floor(piv.parent!, SX - D - (i + 1) * tread, SX - D - i * tread, SZ - sw, SZ + sw, y);
  }
  // railings (world): N, S and E sides; W side either side of the stair
  P.solid(SX - D - 0.1, DH, SZ - D - 0.1, SX + D + 0.1, DH + 1.0, SZ - D + 0.25);
  P.solid(SX - D - 0.1, DH, SZ + D - 0.25, SX + D + 0.1, DH + 1.0, SZ + D + 0.1);
  P.solid(SX + D - 0.25, DH, SZ - D, SX + D + 0.1, DH + 1.0, SZ + D);
  P.solid(SX - D - 0.1, DH, SZ - D, SX - D + 0.25, DH + 1.0, SZ - sw);
  P.solid(SX - D - 0.1, DH, SZ + sw, SX - D + 0.25, DH + 1.0, SZ + D);
  const rr = pedR * 0.98;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, c = Math.cos(a) * rr * 0.72, s = Math.sin(a) * rr * 0.72;
    P.solid(SX + c - rr * 0.42, 0, SZ + s - rr * 0.42, SX + c + rr * 0.42, ped + 14, SZ + s + rr * 0.42);
  }
  P.solid(SX - rr * 0.7, 0, SZ - rr * 0.7, SX + rr * 0.7, ped + 14, SZ + rr * 0.7);
}

/** a rudraksha bead: a round seed with deep longitudinal grooves (unit radius) */
function rudrakshaGeo() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 - 0.09 * Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 2.5)), 6) - 0.04 * Math.abs(Math.sin(y * 9));
    p.setXYZ(i, x * k, y * 0.92, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The tiger head of the skin draped over the front of the rock (≈3 m across, local +z forward): a broad
 * skull with brow ridges, a fur ruff flaring out at the cheeks, a projecting muzzle with two whisker pads
 * and a chin, a broad nose, and rounded ears. Stripes and the pale muzzle are painted by its material.
 */
function tigerHeadGeo() {
  const P: THREE.BufferGeometry[] = [];
  const el = (rx: number, ry: number, rz: number, x: number, y: number, z: number, ws = 24, hs = 16) => P.push(new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz).translate(x, y, z));
  el(1.05, 0.95, 0.55, 0, 0.1, 0); // skull
  el(0.82, 0.3, 0.4, 0, 0.55, 0.2); // brow
  for (const s of [-1, 1]) {
    // cheek ruff: a flattened fan of fur tufts flaring sideways and down
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.32;
      const c = new THREE.ConeGeometry(0.2, 0.75, 8).rotateZ(s * (Math.PI / 2 + a)).scale(1, 1, 0.45);
      c.translate(s * (0.95 + Math.cos(a) * 0.25), -0.15 + Math.sin(a) * 0.45, -0.05);
      P.push(c);
    }
    el(0.55, 0.6, 0.38, s * 0.72, -0.2, 0.05); // cheek
    el(0.32, 0.3, 0.3, s * 0.27, -0.45, 0.48); // whisker pad
    // ears: rounded, set high and wide, cupped forward
    P.push(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.32, 0.3, 0.12).rotateX(Math.PI / 2).rotateX(-0.25).rotateZ(s * -0.5).translate(s * 0.82, 0.88, -0.15));
  }
  el(0.42, 0.42, 0.38, 0, -0.18, 0.42); // muzzle bridge
  P.push(new THREE.CylinderGeometry(0.1, 0.24, 0.62, 10).rotateX(-0.42).translate(0, 0.05, 0.52)); // nose ridge
  el(0.2, 0.13, 0.15, 0, -0.26, 0.76); // nose pad
  el(0.3, 0.2, 0.28, 0, -0.75, 0.3); // chin
  return mergeParts(P);
}

/** `toHead` maps the mesh's coordinates back into the head's own frame, where the markings are laid out */
function tigerHeadMaterial(toHead: THREE.Matrix4) {
  const m = new THREE.MeshStandardMaterial({ color: 0x96522c, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uToHead = { value: toHead };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTP;\nuniform mat4 uToHead;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = (uToHead * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTP;\nfloat tH(vec2 p){return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.5);}')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 p = vTP;
          // stripes: on the forehead they run up in curved pairs, on the cheeks and ruff they sweep sideways
          float fh = sin(p.x * 13.0 + p.y * 2.0 * sign(p.x) + 0.6 * sin(p.y * 6.0));
          float ch = sin(p.y * 9.0 + abs(p.x) * 3.5 + 0.8 * sin(p.x * 5.0));
          float w = smoothstep(0.35, 0.75, abs(p.x));
          float s = mix(fh, ch, w);
          float stripe = smoothstep(0.72, 0.9, s) * step(-0.6, p.y);
          stripe *= 1.0 - smoothstep(0.1, 0.35, p.z - 0.25) * (1.0 - step(0.35, p.y)); // none on the muzzle
          // pale cream muzzle, chin and inner cheeks; dark nose pad; dark almond eye marks
          float pale = (1.0 - smoothstep(0.42, 0.5, length((p.xy - vec2(0.0, -0.45)) * vec2(0.9, 1.4)))) * step(0.15, p.z);
          vec3 col = mix(vec3(1.0), vec3(0.27, 0.15, 0.08), stripe * 0.85);
          col = mix(col, vec3(1.35, 1.22, 1.05), pale);
          float nose = 1.0 - smoothstep(0.12, 0.16, length((p.xy - vec2(0.0, -0.24)) * vec2(1.0, 1.5)));
          col = mix(col, vec3(0.32, 0.14, 0.1), nose * step(0.6, p.z));
          vec2 e = vec2(abs(p.x) - 0.38, p.y - 0.3);
          float eye = 1.0 - smoothstep(0.08, 0.1, length(e * vec2(0.7, 2.2)));
          col = mix(col, vec3(0.12, 0.08, 0.04), eye * step(0.2, p.z));
          diffuseColor.rgb *= col * (0.92 + 0.12 * tH(floor(p.xy * 40.0)));
        }`);
  };
  m.customProgramCacheKey = () => 'nag-tigerhead';
  return m;
}

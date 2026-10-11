import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * High-relief deity figures for the niche band of the garbhagriha (photo 14_, n_g4): the Dashavatara and
 * Shiva-lila panels are carved in the round almost free of the niche back, cream-white on the pink
 * ground. Six compositions, all with NO facial detail — the forms only:
 *   0 a standing four-armed deity with a tall kirita crown (Vishnu type), discus and conch raised
 *   1 a seated deity in lalitasana on a throne, one leg pendant
 *   2 a dancing figure (Nataraja / Krishna type): swayed hips, one leg raised across, arms spread
 *   3 a divine couple (Shiva–Parvati), standing side by side
 *   4 Ganesha: seated, pot belly, broad ears and a curled trunk
 *   5 a guardian with a mace
 * Each on a lotus pedestal, with a ring halo (prabhavali). Local frame: base at y = 0, facing +z,
 * back at z = 0 (flattened to ≈ 0.14 m deep relief), ≈ 1.0 m tall.
 */

const SEG = 10;

function clean(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const w = mergeVertices(g, 1e-4);
  w.computeVertexNormals();
  return w.toNonIndexed();
}
function lathe(p: [number, number][], sx = 1, sz = 1) {
  const g = new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0008), y)), SEG);
  g.scale(sx, 1, sz);
  return clean(g);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function cap(r: number, a: THREE.Vector3, b: THREE.Vector3) {
  const len = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CapsuleGeometry(r, len, 2, 7);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return clean(g);
}
function ell(rx: number, ry: number, rz: number, x: number, y: number, z: number) {
  return clean(new THREE.SphereGeometry(1, 10, 7).scale(rx, ry, rz).translate(x, y, z));
}
/** an arm: shoulder → elbow → hand, with a small hand */
function arm(s: THREE.Vector3, e: THREE.Vector3, h: THREE.Vector3, r = 0.022) {
  return [cap(r, s, e), cap(r * 0.85, e, h), ell(0.02, 0.028, 0.014, h.x, h.y, h.z)];
}
function pedestal(w = 0.2) {
  // a double lotus (padmapitha): petals as a ribbed lathe
  const g = new THREE.LatheGeometry([[0.001, 0], [w, 0], [w * 1.08, 0.035], [w * 0.85, 0.07], [w * 1.05, 0.1], [w * 0.95, 0.12], [0.001, 0.12]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.08 * Math.abs(Math.cos(a * 6));
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  return clean(g);
}
function halo(y: number, r = 0.15) {
  return clean(new THREE.TorusGeometry(r, 0.014, 5, 18, Math.PI * 1.25).rotateZ(-Math.PI * 0.125).translate(0, y, -0.06));
}
/** head with a crown: 'kirita' (tall), 'jata' (piled locks), 'bun' (Parvati) */
function head(y: number, crown: 'kirita' | 'jata' | 'bun', s = 1) {
  const out = [ell(0.05 * s, 0.065 * s, 0.055 * s, 0, y, 0), cap(0.026 * s, V(0, y - 0.1 * s, 0), V(0, y - 0.05 * s, 0))];
  if (crown === 'kirita') out.push(lathe([[0.001, 0], [0.05, 0], [0.045, 0.06], [0.03, 0.12], [0.012, 0.15], [0.001, 0.16]].map(([r, h]) => [r * s, h * s] as [number, number])).translate(0, y + 0.035 * s, 0));
  else if (crown === 'jata') out.push(ell(0.05 * s, 0.05 * s, 0.045 * s, 0, y + 0.075 * s, -0.005), ell(0.02 * s, 0.03 * s, 0.01 * s, 0.03 * s, y + 0.09 * s, 0.03 * s));
  else out.push(ell(0.035 * s, 0.03 * s, 0.03 * s, 0, y + 0.05 * s, -0.035 * s));
  return out;
}
/** a standing body in a dhoti: legs (lower garment), torso, sash; returns parts and the shoulder height */
function standing(x = 0, s = 1, sway = 0) {
  const P: THREE.BufferGeometry[] = [];
  P.push(lathe([[0.001, 0.12], [0.1, 0.12], [0.11, 0.2], [0.095, 0.4], [0.085, 0.5], [0.001, 0.5]], 1.1, 0.75).scale(s, s, s).translate(x, 0, 0));
  P.push(ell(0.03 * s, 0.02 * s, 0.05 * s, x - 0.045 * s, 0.13 * s, 0.03 * s), ell(0.03 * s, 0.02 * s, 0.05 * s, x + 0.045 * s, 0.13 * s, 0.03 * s));
  P.push(lathe([[0.001, 0.48], [0.085, 0.48], [0.07, 0.56], [0.09, 0.68], [0.11, 0.74], [0.07, 0.78], [0.001, 0.78]], 1.15, 0.7).scale(s, s, s).translate(x, 0, 0));
  // a hip sash knotted in a loop
  P.push(new THREE.TorusGeometry(0.1 * s, 0.012 * s, 5, 14).rotateX(Math.PI / 2).scale(1.05, 1, 0.7).translate(x, 0.5 * s, 0).toNonIndexed());
  for (const g of P) g.rotateZ(sway);
  return { P, sh: 0.75 * s };
}

function figure(kind: number): THREE.BufferGeometry {
  const P: THREE.BufferGeometry[] = [pedestal()];
  const top = 0.12;
  const up = (gs: THREE.BufferGeometry[]) => gs.map((g) => g.translate(0, top, 0));
  if (kind === 0) {
    const b = standing();
    P.push(...up(b.P), ...up(head(0.86, 'kirita')), halo(0.86 + top, 0.16));
    // lower arms: abhaya (right forearm raised) and resting on the mace-head (left)
    P.push(...up(arm(V(0.12, 0.74, 0), V(0.16, 0.6, 0.02), V(0.15, 0.7, 0.07))));
    P.push(...up(arm(V(-0.12, 0.74, 0), V(-0.16, 0.6, 0.02), V(-0.18, 0.48, 0.03))));
    P.push(cap(0.012, V(-0.19, 0.1 + top, 0.03), V(-0.19, 0.48 + top, 0.03)), ell(0.035, 0.04, 0.03, -0.19, 0.5 + top, 0.03));
    // upper arms raised, holding the discus and the conch
    P.push(...up(arm(V(0.11, 0.75, -0.01), V(0.2, 0.8, -0.01), V(0.22, 0.92, 0))));
    P.push(...up(arm(V(-0.11, 0.75, -0.01), V(-0.2, 0.8, -0.01), V(-0.22, 0.92, 0))));
    P.push(clean(new THREE.TorusGeometry(0.035, 0.01, 5, 12).translate(0.22, 0.98 + top, 0)));
    P.push(lathe([[0.001, 0], [0.025, 0.01], [0.03, 0.04], [0.012, 0.075], [0.001, 0.08]]).translate(-0.22, 0.94 + top, 0));
  } else if (kind === 1) {
    // throne, lap and pendant leg; torso and head; one hand in varada, one holding a lotus
    P.push(lathe([[0.001, 0], [0.19, 0], [0.19, 0.2], [0.001, 0.2]], 1.0, 0.6).translate(0, top, -0.02));
    P.push(ell(0.17, 0.06, 0.1, 0, top + 0.24, 0.04), cap(0.035, V(0.07, top + 0.22, 0.1), V(0.09, top + 0.04, 0.12)), ell(0.03, 0.02, 0.05, 0.09, top + 0.02, 0.15));
    P.push(lathe([[0.001, 0.26], [0.08, 0.26], [0.07, 0.33], [0.09, 0.45], [0.11, 0.51], [0.07, 0.55], [0.001, 0.55]], 1.15, 0.7).translate(0, top, 0));
    P.push(...up(head(0.63, 'kirita')), halo(0.63 + top, 0.15));
    P.push(...up(arm(V(0.12, 0.51, 0), V(0.15, 0.38, 0.04), V(0.12, 0.28, 0.1))));
    P.push(...up(arm(V(-0.12, 0.51, 0), V(-0.16, 0.4, 0.03), V(-0.14, 0.5, 0.08))));
    P.push(ell(0.035, 0.03, 0.035, -0.14, top + 0.56, 0.09));
  } else if (kind === 2) {
    const b = standing(0, 1, 0.12);
    P.push(...up(b.P.slice(0, 1)), ...up(b.P.slice(2)));
    // the raised leg crossing in front
    P.push(cap(0.04, V(0.03, top + 0.42, 0.04), V(-0.12, top + 0.3, 0.08)), cap(0.034, V(-0.12, top + 0.3, 0.08), V(-0.07, top + 0.12, 0.1)));
    const hx = -0.09;
    P.push(...up(head(0.86, 'jata')).map((g) => g.translate(hx, 0, 0)), halo(0.86 + top, 0.2).translate(hx * 0.5, 0, 0));
    P.push(...up(arm(V(hx + 0.11, 0.74, 0), V(hx + 0.25, 0.72, 0.02), V(hx + 0.33, 0.82, 0.02))));
    P.push(...up(arm(V(hx - 0.11, 0.74, 0), V(hx - 0.22, 0.66, 0.04), V(hx - 0.06, 0.6, 0.08))));
    P.push(...up(arm(V(hx + 0.1, 0.76, -0.02), V(hx + 0.18, 0.9, -0.02), V(hx + 0.16, 1.0, -0.02))));
    // the flying scarf
    P.push(cap(0.012, V(hx - 0.12, top + 0.7, 0.02), V(hx - 0.3, top + 0.5, 0.0)), cap(0.012, V(hx + 0.25, top + 0.6, 0.02), V(hx + 0.32, top + 0.35, 0)));
  } else if (kind === 3) {
    for (const [x, s, cr] of [[-0.1, 0.9, 'jata'], [0.11, 0.82, 'bun']] as const) {
      const b = standing(x, s);
      P.push(...up(b.P), ...up(head(0.86 * s, cr, s)).map((g) => g.translate(x, 0, 0)));
      P.push(...up(arm(V(x - 0.1 * s, 0.73 * s, 0), V(x - 0.14 * s, 0.58 * s, 0.02), V(x - 0.13 * s, 0.45 * s, 0.04))));
      P.push(...up(arm(V(x + 0.1 * s, 0.73 * s, 0), V(x + 0.14 * s, 0.6 * s, 0.03), V(x + 0.12 * s, 0.7 * s, 0.07))));
    }
    P.push(halo(0.78 + top, 0.24));
    // the trident behind Shiva
    P.push(cap(0.008, V(-0.27, top, -0.02), V(-0.27, top + 0.95, -0.02)), clean(new THREE.TorusGeometry(0.04, 0.007, 4, 10, Math.PI).rotateZ(Math.PI).translate(-0.27, top + 0.95, -0.02)));
  } else if (kind === 4) {
    // Ganesha seated: big belly, head with fan ears and trunk, four arms, a laddu bowl
    P.push(ell(0.18, 0.07, 0.11, 0, top + 0.07, 0.04));
    P.push(ell(0.14, 0.17, 0.11, 0, top + 0.26, 0.02));
    P.push(ell(0.085, 0.09, 0.08, 0, top + 0.5, 0.02));
    for (const s of [-1, 1]) P.push(ell(0.08, 0.075, 0.015, s * 0.1, top + 0.5, -0.02));
    const tr = new THREE.CatmullRomCurve3([V(0, top + 0.47, 0.08), V(0.01, top + 0.38, 0.12), V(-0.04, top + 0.3, 0.13), V(-0.07, top + 0.34, 0.12)]);
    P.push(clean(new THREE.TubeGeometry(tr, 10, 0.022, 7, false)));
    P.push(lathe([[0.001, 0], [0.05, 0], [0.04, 0.05], [0.025, 0.09], [0.001, 0.1]]).translate(0, top + 0.57, 0));
    P.push(...up(arm(V(0.14, 0.38, 0), V(0.2, 0.28, 0.04), V(0.14, 0.22, 0.12))));
    P.push(...up(arm(V(-0.14, 0.38, 0), V(-0.2, 0.28, 0.04), V(-0.12, 0.22, 0.12))));
    P.push(...up(arm(V(0.13, 0.42, -0.02), V(0.22, 0.48, -0.02), V(0.22, 0.6, -0.01))));
    P.push(...up(arm(V(-0.13, 0.42, -0.02), V(-0.22, 0.48, -0.02), V(-0.22, 0.6, -0.01))));
    P.push(ell(0.04, 0.025, 0.04, -0.12, top + 0.23, 0.14));
    P.push(halo(0.5 + top, 0.19));
  } else {
    const b = standing(0, 1, -0.05);
    P.push(...up(b.P), ...up(head(0.86, 'jata')), halo(0.86 + top, 0.15));
    P.push(...up(arm(V(0.12, 0.74, 0), V(0.2, 0.62, 0.03), V(0.2, 0.74, 0.07))));
    P.push(cap(0.014, V(0.2, top + 0.7, 0.07), V(0.24, top + 1.0, 0.04)), ell(0.05, 0.065, 0.045, 0.245, top + 1.02, 0.04));
    P.push(...up(arm(V(-0.12, 0.74, 0), V(-0.15, 0.58, 0.03), V(-0.1, 0.48, 0.07))));
  }
  const g = mergeGeometries(P.map((x) => { for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x.index ? x.toNonIndexed() : x; }), false)!;
  // flatten into high relief and push the back onto the niche ground
  g.scale(1, 1, 0.62);
  g.computeBoundingBox();
  g.translate(0, 0, -g.boundingBox!.min.z);
  g.computeVertexNormals();
  return g;
}

let cache: THREE.BufferGeometry[] | null = null;
/** the six compositions (geometry is shared; the merger clones on placement) */
export function niche3D() {
  return (cache ??= [0, 1, 2, 3, 4, 5].map(figure));
}

/**
 * The cusped arch (torana) heading each niche, as a cream spandrel panel with a five-lobed opening:
 * width w, height h, depth d; local frame x across, y up from the panel's bottom, facing +z, back z = 0.
 */
export function archPanel(w: number, h: number, d: number, rise: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h);
  s.lineTo(w / 2, h);
  s.lineTo(w / 2, 0);
  const N = 5;
  for (let k = 1; k <= N * 6; k++) {
    const t = k / (N * 6), x = w / 2 - t * w;
    // each lobe a small arc; the whole an ogee-tipped arch
    const lobe = Math.abs(Math.sin(t * N * Math.PI)) * 0.045;
    s.lineTo(x, Math.sin(t * Math.PI) * rise * (1 - 0.15 * Math.abs(Math.cos(t * Math.PI))) + lobe);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 2 });
  const n = g.toNonIndexed(); n.deleteAttribute('uv');
  return n;
}

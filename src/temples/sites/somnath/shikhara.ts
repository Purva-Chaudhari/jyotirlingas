import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import { Instances } from './batch';

/**
 * Somnath's shikhara: a Maru-Gurjara "shekhari" spire. A tall curvilinear central latina
 * (pancha-ratha in plan, banded by bhumis) clasped by tiers of smaller replica spires:
 * urushringas climbing each face and kuta-shringas clustered on the corners.
 * Every sub-spire is an instance of the same unit spire.
 */

/** Pancha-ratha plan for one side, as (along-side u in -1..1, outward offset). */
const SIDE: [number, number][] = [
  [-1, 0], [-0.76, 0], [-0.76, -0.1], [-0.68, -0.1], [-0.68, 0.0], [-0.42, 0.0], [-0.42, -0.08], [-0.34, -0.08], [-0.34, 0.05], [-0.22, 0.05], [-0.22, 0.1],
  [0.22, 0.1], [0.22, 0.05], [0.34, 0.05], [0.34, -0.08], [0.42, -0.08], [0.42, 0.0], [0.68, 0.0], [0.68, -0.1], [0.76, -0.1], [0.76, 0],
];

/** The same plan with only the central bhadra projection (for distant sub-spires). */
const SIDE_LO: [number, number][] = [[-1, 0], [-0.3, 0], [-0.3, 0.08], [0.3, 0.08], [0.3, 0]];

function plan(lite = false): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of lite ? SIDE_LO : SIDE) {
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/** half-width (relative) of the spire body at height t in 0..1: a steady Maru-Gurjara taper (0.67 at mid-height, 0.22 at the neck) */
export const spireWidth = (t: number) => 1 - 0.78 * Math.pow(t, 1.25);
/** fraction of the unit height taken by the body (the rest is neck, amalaka and finial) */
export const BODY = 0.85;

const strip = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
};

/**
 * Unit spire: base half-width 1, total height 1 (scale per instance by (halfW, H, halfW)).
 * Body rings with a projecting bhumi band every course; neck, ribbed amalaka, chandrika and
 * (optionally) a small stone kalash.
 */
export function spireGeometry(bhumis = 11, finial = true, lite = false): THREE.BufferGeometry {
  const P = plan(lite);
  const N = P.length;
  const rings: { y: number; s: number }[] = [];
  for (let k = 0; k < bhumis; k++) {
    const t0 = k / bhumis, t1 = (k + 1) / bhumis;
    const tb = t1 - (t1 - t0) * 0.09;
    rings.push({ y: t0 * BODY, s: spireWidth(t0) });
    rings.push({ y: tb * BODY, s: spireWidth(tb) });
    // bhumi band: a thin projecting course
    rings.push({ y: tb * BODY, s: spireWidth(tb) * 1.018 });
    rings.push({ y: t1 * BODY, s: spireWidth(t1) * 1.018 });
    rings.push({ y: t1 * BODY, s: spireWidth(t1) });
  }
  const pos: number[] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let i = 0; i < N; i++) {
      const p = P[i], q = P[(i + 1) % N];
      const a = [p.x * A.s, A.y, p.y * A.s], b = [q.x * A.s, A.y, q.y * A.s];
      const c = [q.x * B.s, B.y, q.y * B.s], d = [p.x * B.s, B.y, p.y * B.s];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  // make faces point outward whatever the plan's handedness (use a wall face, not a flat band face)
  const i0 = 0; // first ring pair is a wall course
  const A = new THREE.Vector3(pos[i0], pos[i0 + 1], pos[i0 + 2]), Bv = new THREE.Vector3(pos[i0 + 3], pos[i0 + 4], pos[i0 + 5]), C = new THREE.Vector3(pos[i0 + 6], pos[i0 + 7], pos[i0 + 8]);
  const n = Bv.clone().sub(A).cross(C.clone().sub(A));
  if (n.dot(A.clone().add(Bv).add(C).setY(0)) < 0) {
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.computeVertexNormals();

  // crown: shoulder slab, neck, ribbed amalaka, chandrika, finial
  const w1 = spireWidth(1);
  const prof: [number, number][] = [[0, BODY], [w1 * 1.02, BODY], [w1 * 0.95, BODY + 0.008], [w1 * 0.7, BODY + 0.012], [w1 * 0.66, BODY + 0.022]];
  const a0 = BODY + 0.022, aH = 0.06, aR = Math.max(w1 * 1.45, 0.32);
  for (let i = 0; i <= 8; i++) {
    const ang = -Math.PI / 2 + (i / 8) * Math.PI;
    prof.push([w1 * 0.62 + Math.cos(ang) * (aR - w1 * 0.62), a0 + aH / 2 + Math.sin(ang) * aH / 2]);
  }
  const top = a0 + aH;
  prof.push([w1 * 0.5, top + 0.004], [w1 * 0.78, top + 0.01], [w1 * 0.7, top + 0.016]);
  if (finial) prof.push([w1 * 0.2, top + 0.02], [w1 * 0.42, top + 0.04], [w1 * 0.36, top + 0.06], [w1 * 0.14, top + 0.075], [w1 * 0.06, 0.995], [0, 1]);
  else prof.push([0, top + 0.016]);
  const crown = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), lite ? 12 : 24);
  // ribs on the amalaka
  const cp = crown.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    if (y > a0 && y < top) {
      const x = cp.getX(i), z = cp.getZ(i);
      const rib = 1 + Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 12)), 4) * 0.07;
      cp.setX(i, x * rib);
      cp.setZ(i, z * rib);
    }
  }
  crown.computeVertexNormals();
  return mergeGeometries([strip(body), strip(crown)], false)!;
}

/** UVs in metres for a typical instance size, so the stone courses read at about the right scale on every sub-spire. */
function unitWithUV(geo: THREE.BufferGeometry, hw: number, H: number) {
  geo.scale(hw, H, hw);
  worldUV(geo);
  geo.scale(1 / hw, 1 / H, 1 / hw);
  return geo;
}

export interface ShikharaOut {
  /** height of the top of the main amalaka (where the kalash sits) */
  crownY: number;
  /** half width of the shoulder */
  topHalf: number;
}

/**
 * Builds the whole spire cluster at (0, y0, 0) with main base half-width `hw` and unit height `H`
 * (body + amalaka; the gold kalash is added by the caller).
 */
export function shikhara(parent: THREE.Object3D, stone: THREE.Material, y0: number, hw: number, H: number): ShikharaOut {
  const g = new THREE.Group();
  g.name = 'shikhara';
  parent.add(g);

  const mainGeo = spireGeometry(14, false).scale(hw, H, hw);
  worldUV(mainGeo);
  const main = new THREE.Mesh(mainGeo, stone);
  main.position.y = y0;
  main.castShadow = main.receiveShadow = true;
  g.add(main);

  const sub = new Instances(unitWithUV(spireGeometry(10, true), hw * 0.25, H * 0.4), stone);
  // place a sub-spire on face `side` (0:+x north, 1:+z east, 2:-x south, 3:-z west), u along the face, at radius d
  const onFace = (side: number, u: number, d: number, y: number, w: number, h: number) => {
    const a = side * (Math.PI / 2);
    const nx = Math.cos(a), nz = Math.sin(a);
    const tx = -Math.sin(a), tz = Math.cos(a);
    sub.at(nx * d + tx * u, y, nz * d + tz * u, w, h, w, -a);
  };
  for (let side = 0; side < 4; side++) {
    // urushringas: pointed half-spires stacked up the middle of each face in three descending tiers
    onFace(side, 0, hw * 0.5, y0, hw * 0.5, H * 0.6);
    onFace(side, 0, hw * 0.82, y0, hw * 0.36, H * 0.44);
    onFace(side, 0, hw * 1.02, y0, hw * 0.25, H * 0.3);
    for (const s of [-1, 1]) {
      // small spirelets either side of the stack, and three climbing tiers on each pratiratha
      onFace(side, s * hw * 0.33, hw * 1.0, y0, hw * 0.15, H * 0.22);
      onFace(side, s * hw * 0.6, hw * 0.95, y0, hw * 0.2, H * 0.3);
      onFace(side, s * hw * 0.5, hw * 0.76, y0 + H * 0.22, hw * 0.18, H * 0.26);
      onFace(side, s * hw * 0.4, hw * 0.58, y0 + H * 0.4, hw * 0.15, H * 0.22);
    }
  }
  // karna-shringas clustered on the four corners, four tiers climbing inward
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ry = Math.atan2(cx, cz);
    for (const [d, yy, w, h] of [[0.9, 0, 0.24, 0.32], [0.78, 0.2, 0.2, 0.27], [0.66, 0.38, 0.17, 0.23], [0.54, 0.54, 0.14, 0.18]]) {
      sub.at(cx * hw * d, y0 + H * yy, cz * hw * d, hw * w, H * h, hw * w, ry);
    }
  }
  // within ~50 m the sub-spires carry the full pancha-ratha plan; beyond, a lighter one (a quarter of the triangles)
  sub.flushLOD(g, unitWithUV(spireGeometry(7, true, true), hw * 0.25, H * 0.4), new THREE.Vector3(0, y0 + H * 0.3, 0), 50);

  // bhumi-amalakas: little discs on the main spire's corners at every course
  const disc = new Instances(new THREE.CylinderGeometry(1, 1, 1, 10), stone);
  const courses = 14;
  for (let k = 1; k < courses; k++) {
    const t = k / courses;
    const w = spireWidth(t) * hw;
    const y = y0 + t * BODY * H - ((BODY * H) / courses) * 0.08;
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) disc.at(cx * w * 0.95, y, cz * w * 0.95, w * 0.11, H * 0.011, w * 0.11);
  }
  disc.flush(g);

  return { crownY: y0 + H * (BODY + 0.022 + 0.06 + 0.016), topHalf: spireWidth(1) * hw };
}

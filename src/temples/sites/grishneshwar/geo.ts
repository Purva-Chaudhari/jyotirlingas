import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe } from './offerings';

/** Plan polygons live in the (x, z) plane; P = [x, z]. */
export type P = [number, number];

function area(poly: P[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

/** counter-clockwise in (x, z) (positive signed area) */
export function ccw(poly: P[]): P[] {
  return area(poly) < 0 ? poly.slice().reverse() : poly;
}

/**
 * A pancha-ratha square plan of half-size `h`: each side steps out to the pratiratha (`pr`)
 * and the central bhadra (`bh`). Segment widths: karna `k`, pratiratha `p`, bhadra fills the rest.
 */
export function rathaPlan(h: number, k: number, p: number, pr: number, bh: number): P[] {
  const b = h - k - p; // bhadra half-width
  const side: P[] = [[-h, 0], [-h + k, 0], [-h + k, pr], [-b, pr], [-b, bh], [b, bh], [b, pr], [h - k, pr], [h - k, 0], [h, 0]];
  const out: P[] = [];
  // sides: +x (north), +z (east), -x, -z ; side param u runs along the face, o = outward offset
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (let i = 0; i < side.length; i++) {
      if (i === side.length - 1) continue; // corner shared with next side
      const [u, o] = side[i];
      const x = h + o, z = u;
      out.push([x * c - z * si, x * si + z * c]);
    }
  }
  return ccw(out);
}

export function rect(x0: number, z0: number, x1: number, z1: number): P[] {
  return ccw([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
}

/** Offset an orthogonal (or any) polygon outward by d (negative = inward), vertex count preserved. */
export function offset(poly: P[], d: number): P[] {
  const n = poly.length;
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
    const n1 = norm([b[1] - a[1], -(b[0] - a[0])]), n2 = norm([c[1] - b[1], -(c[0] - b[0])]);
    // miter: (n1 + n2) / (1 + n1·n2)
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    const k = d / (1 + dot);
    out.push([b[0] + (n1[0] + n2[0]) * k, b[1] + (n1[1] + n2[1]) * k]);
  }
  return out;
}

function norm(v: P): P {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** outward unit normal of edge i (CCW polygon) */
export function edgeNormal(poly: P[], i: number): P {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  return norm([b[1] - a[1], -(b[0] - a[0])]);
}

/**
 * Quads between ring A (at yA) and ring B (at yB), same vertex count. Each triangle is wound so its
 * normal agrees with (edge-outward × o + up × u). `skip(i, mid)` can drop segments (e.g. door openings).
 */
export function strip(A: P[], yA: number, B: P[], yB: number, o: number, u: number,
  skip?: (i: number, mid: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const n = A.length;
  const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, ref: THREE.Vector3) => {
    const nn = q.clone().sub(p).cross(r.clone().sub(p));
    if (nn.dot(ref) < 0) pos.push(p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
    else pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = new THREE.Vector3(A[i][0], yA, A[i][1]), b = new THREE.Vector3(A[j][0], yA, A[j][1]);
    const c = new THREE.Vector3(B[j][0], yB, B[j][1]), d = new THREE.Vector3(B[i][0], yB, B[i][1]);
    const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
    if (skip?.(i, mid)) continue;
    const en = edgeNormal(A, i);
    const ref = new THREE.Vector3(en[0] * o, u, en[1] * o);
    tri(a, b, c, ref);
    tri(a, c, d, ref);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Flat polygon at height y facing up (or down). */
export function cap(poly: P[], y: number, down = false): THREE.BufferGeometry {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  if (down) {
    // same outline, reversed winding → faces down
    const p = n.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1), yy = p.getY(i + 1), z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, yy, z);
    }
    n.computeVertexNormals();
  }
  return n;
}

/** A horizontal ring between an inner and an outer outline (same vertex count), facing up. */
export function ring(inner: P[], outer: P[], y: number, skip?: (i: number, mid: THREE.Vector3) => boolean) {
  return strip(inner, y, outer, y, 0, 1, skip);
}

/** A closed prism (sides + top) of a plan between y0 and y1. */
export function prism(poly: P[], y0: number, y1: number, top = true, skip?: (i: number, mid: THREE.Vector3) => boolean) {
  const parts = [strip(poly, y0, poly, y1, 1, 0, skip)];
  if (top) parts.push(cap(poly, y1));
  return mergeGeometries(parts, false)!;
}

/**
 * Sloping chhajja (eave) round a plan: top slope from the wall (at y) out by `out` and down by `drop`,
 * a fascia of `thick`, and the soffit back to the wall.
 */
export function chhajjaGeo(poly: P[], y: number, out: number, drop: number, thick = 0.1) {
  const O = offset(poly, out);
  return mergeGeometries([
    strip(poly, y, O, y - drop, 1, 1),
    strip(O, y - drop, O, y - drop - thick, 1, 0),
    strip(O, y - drop - thick, poly, y - drop * 0.4 - thick, 1, -1),
  ], false)!;
}

/** Points every `step` metres along a closed polygon (for pendants, railings, bulbs). */
export function along(poly: P[], step: number, inset = 0): { p: P; n: P }[] {
  const out: { p: P; n: P }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor((len - 2 * inset) / step);
    if (n < 1) continue;
    const en = edgeNormal(poly, i);
    for (let k = 0; k < n; k++) {
      const t = (inset + (k + 0.5) * ((len - 2 * inset) / n)) / len;
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: en });
    }
  }
  return out;
}

/** A hanging lotus-bud pendant (lambana), tip down; origin at the top. */
export function pendantGeo(h = 0.24, r = 0.065) {
  const prof: [number, number][] = [[0, -h], [r * 0.35, -h * 0.9], [r * 0.9, -h * 0.62], [r, -h * 0.42], [r * 0.8, -h * 0.2], [r * 0.45, -h * 0.08], [r * 0.6, 0], [0, 0]];
  return lathe(prof, 8);
}

/** A fluted lotus-bud bulb (as on the shikhara's base row and kuta tops); base at origin. */
export function bulbGeo(r: number, h: number, ribs = 16, seg = 36) {
  const prof: [number, number][] = [
    [0, 0], [r * 0.55, 0], [r * 0.6, h * 0.06], [r * 0.4, h * 0.12], [r * 0.85, h * 0.26], [r, h * 0.42], [r * 0.92, h * 0.6],
    [r * 0.62, h * 0.76], [r * 0.28, h * 0.86], [r * 0.18, h * 0.9], [r * 0.24, h * 0.94], [r * 0.08, h], [0, h * 1.02],
  ];
  return lathe(prof, seg, ribs, ribs <= 12 ? 0.16 : 0.09);
}

/** Box geometry (non-indexed, no uv) with given size, centred at (x, y0 + h/2, z). */
export function boxAt(w: number, h: number, d: number, x: number, y0: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y0 + h / 2, z);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
}

export function cyl(r0: number, r1: number, h: number, seg: number, x: number, y0: number, z: number) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y0 + h / 2, z).toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

/**
 * Ahilyabai-period Maratha pillar of height h: square base, square shaft with carved bands, an
 * octagonal then round (ghata) section, a cushion, a square capital and cross-brackets (pota)
 * whose rounded ends carry the beams. Origin at the base centre.
 */
export function pillarGeo(h: number, w = 0.44) {
  const parts: THREE.BufferGeometry[] = [];
  const b = (ww: number, hh: number, y: number, dd = ww) => parts.push(boxAt(ww, hh, dd, 0, y, 0));
  b(w * 1.3, 0.14, 0);
  b(w * 1.18, 0.1, 0.14);
  const shaftH = h * 0.42;
  b(w, shaftH, 0.24);
  // octagonal band
  const oct = new THREE.CylinderGeometry(w * 0.56, w * 0.56, h * 0.14, 8).rotateY(Math.PI / 8).translate(0, 0.24 + shaftH + h * 0.07, 0).toNonIndexed();
  oct.deleteAttribute('uv');
  parts.push(oct);
  const y1 = 0.24 + shaftH + h * 0.14;
  // round ghata (pot) and neck
  const pot = lathe([[w * 0.5, 0], [w * 0.56, h * 0.03], [w * 0.6, h * 0.07], [w * 0.5, h * 0.11], [w * 0.36, h * 0.13], [w * 0.34, h * 0.17], [w * 0.46, h * 0.19], [0, h * 0.19]], 16);
  pot.translate(0, y1, 0);
  parts.push(pot);
  const y2 = y1 + h * 0.19;
  // square capital block and the cross brackets
  const capH = h - y2 - 0.12;
  b(w * 1.05, capH * 0.55, y2);
  const by = y2 + capH * 0.55;
  const bh = capH * 0.45;
  for (const ry of [0, Math.PI / 2]) {
    const arm = new THREE.BoxGeometry(w * 2.7, bh, w * 0.7).translate(0, by + bh / 2, 0);
    if (ry) arm.rotateY(ry);
    const a = arm.toNonIndexed(); a.deleteAttribute('uv'); parts.push(a);
    // rounded scroll ends under the arms
    for (const s of [-1, 1]) {
      const sc = new THREE.CylinderGeometry(bh * 0.55, bh * 0.55, w * 0.7, 10).rotateX(Math.PI / 2).translate(s * w * 1.25, by + bh * 0.4, 0);
      if (ry) sc.rotateY(ry);
      const s2 = sc.toNonIndexed(); s2.deleteAttribute('uv'); parts.push(s2);
    }
  }
  b(w * 1.25, 0.12, h - 0.12);
  return mergeGeometries(parts, false)!;
}

/**
 * The squat Maratha-period mandapa pillar of Grishneshwar (photos n_g1, 18_): a moulded base, a short
 * square shaft, octagonal and round (ghata) sections, then a BIG capital — a square bharani block and
 * four-way potika brackets with rolled scroll ends, ≈ 0.8 m of the height — under a thin abacus.
 */
export function heavyPillarGeo(h: number, w = 0.46) {
  const parts: THREE.BufferGeometry[] = [];
  const b = (ww: number, hh: number, y: number, dd = ww) => parts.push(boxAt(ww, hh, dd, 0, y, 0));
  b(w * 1.4, 0.12, 0);
  b(w * 1.25, 0.08, 0.12);
  const CAP = 0.8, L = Math.max(0.4, h - 0.2 - CAP);
  let y = 0.2;
  b(w, L * 0.42, y); y += L * 0.42;
  b(w * 1.08, 0.05, y - 0.05); // a bead band at the top of the square
  const oct = new THREE.CylinderGeometry(w * 0.56, w * 0.58, L * 0.2, 8).rotateY(Math.PI / 8).translate(0, y + L * 0.1, 0).toNonIndexed();
  oct.deleteAttribute('uv'); parts.push(oct); y += L * 0.2;
  const pot = lathe([[w * 0.48, 0], [w * 0.6, L * 0.06], [w * 0.64, L * 0.13], [w * 0.55, L * 0.22], [w * 0.38, L * 0.28], [w * 0.36, L * 0.32], [w * 0.5, L * 0.38], [0, L * 0.38]], 16, 16, 0.05);
  pot.translate(0, y, 0); parts.push(pot); y += L * 0.38;
  // capital: bharani cushion, square block, potika brackets
  parts.push(lathe([[w * 0.42, 0], [w * 0.62, 0.1], [w * 0.7, 0.16], [0, 0.16]], 16, 8, 0.1).translate(0, y, 0));
  y += 0.16;
  b(w * 1.3, 0.24, y); y += 0.24;
  const bh = 0.26;
  for (const ry of [0, Math.PI / 2]) {
    const arm = new THREE.BoxGeometry(w * 3.4, bh, w * 0.78).translate(0, y + bh / 2, 0);
    if (ry) arm.rotateY(ry);
    const a = arm.toNonIndexed(); a.deleteAttribute('uv'); parts.push(a);
    for (const s of [-1, 1]) {
      for (const [dx, r] of [[1.45, 0.62], [1.05, 0.5]] as const) {
        const sc = new THREE.CylinderGeometry(bh * r, bh * r, w * 0.8, 10).rotateX(Math.PI / 2).translate(s * w * dx, y + bh * 0.1, 0);
        if (ry) sc.rotateY(ry);
        const s2 = sc.toNonIndexed(); s2.deleteAttribute('uv'); parts.push(s2);
      }
    }
  }
  y += bh;
  b(w * 1.5, Math.max(0.06, h - y), y);
  return mergeGeometries(parts, false)!;
}

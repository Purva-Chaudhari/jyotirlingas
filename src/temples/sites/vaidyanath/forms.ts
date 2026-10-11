import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry for Baba Dham's towers. Every shrine here is a variation of one idea: a tower of
 * horizontal courses, each course a slightly battered face under a projecting moulding, so the
 * whitewash reads as a stack of shadow lines. Plans run from almost round (the Bengal-style
 * "beehive" rekhas) through rounded squares (Baba Baidyanath himself) to sharp squares (the
 * stepped pidha towers of Maa Parvati and the crimson Devi shrine).
 */

/** Point on a superellipse |x/s|^n + |z/s|^n = 1 at polar angle a. */
function sePoint(a: number, s: number, n: number): [number, number] {
  const c = Math.cos(a), si = Math.sin(a);
  const e = 2 / n;
  return [s * Math.sign(c) * Math.pow(Math.abs(c), e), s * Math.sign(si) * Math.pow(Math.abs(si), e)];
}

/**
 * Perimeter angles that sample a superellipse evenly by arc length (dense at rounded corners,
 * sparse along the flat faces), always hitting the four face centres and corners.
 */
function perimeterAngles(n: number, seg: number): number[] {
  const fine = 2048, pts: [number, number][] = [];
  for (let i = 0; i <= fine; i++) pts.push(sePoint((i / fine) * Math.PI * 2, 1, n));
  const len: number[] = [0];
  for (let i = 1; i <= fine; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[fine], out: number[] = [];
  let j = 0;
  for (let k = 0; k < seg; k++) {
    const target = (k / seg) * total;
    while (len[j + 1] < target) j++;
    const f = (target - len[j]) / (len[j + 1] - len[j] || 1);
    out.push(((j + f) / fine) * Math.PI * 2);
  }
  return out;
}

/** A ring of rings (y, scale) skinned into one smooth-shaded band (indexed per band → crisp edges between bands). */
function skin(angles: number[], n: number, rings: [number, number][], bulge = 0): THREE.BufferGeometry {
  const seg = angles.length;
  const pos: number[] = [];
  const idx: number[] = [];
  // each ring pair is its own strip: smooth around the tower, crisp at every moulding edge
  const W = seg;
  let base = 0;
  for (let r = 0; r < rings.length - 1; r++) {
    for (const [y, s] of [rings[r], rings[r + 1]]) {
      for (let k = 0; k < seg; k++) {
        const a = angles[k];
        let [x, z] = sePoint(a, s, n);
        if (bulge) {
          // faces swell slightly between the corners (as the plastered courses do)
          const f = 1 + bulge * Math.pow(Math.abs(Math.cos(2 * a)), 3);
          x *= f; z *= f;
        }
        pos.push(x, y, z);
      }
    }
    for (let k = 0; k < seg; k++) {
      const a = base + k, b = base + ((k + 1) % seg), c = a + W, d = b + W;
      idx.push(a, c, b, b, c, d);
    }
    base += 2 * W;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export interface TowerSpec {
  /** half-width of the plan at the bottom course */
  half: number;
  /** height of the course stack */
  height: number;
  courses: number;
  /** superellipse exponent: 2.4 near-round … 5 rounded square … 14 sharp square */
  n: number;
  /** plan scale at t∈[0,1] (1 at the base) */
  profile: (t: number) => number;
  /** projection of each course's moulding beyond the face below it */
  lip?: number;
  /** fraction of a course taken by its moulding */
  moulding?: number;
  /** each face battered inward over its course, as a fraction of the half-width */
  batter?: number;
  seg?: number;
  bulge?: number;
  /** every k-th course carries a deeper "chaitya" band (a double moulding) */
  bandEvery?: number;
}

/**
 * The course stack. Returns the merged geometry (y from 0 to height) and the half-width of the
 * flat top so a crown can sit on it.
 */
export function tower(sp: TowerSpec): { geo: THREE.BufferGeometry; topHalf: number } {
  const seg = sp.seg ?? 96;
  const angles = perimeterAngles(sp.n, seg);
  const lip = sp.lip ?? 0.12, mf = sp.moulding ?? 0.2, bat = sp.batter ?? 0.02;
  const parts: THREE.BufferGeometry[] = [];
  const ch = sp.height / sp.courses;
  for (let c = 0; c < sp.courses; c++) {
    const t0 = c / sp.courses, t1 = (c + 1) / sp.courses;
    const s0 = sp.half * sp.profile(t0), s1 = sp.half * sp.profile(t1);
    const y0 = c * ch, y1 = y0 + ch;
    const ym = y0 + ch * mf;
    const band = sp.bandEvery && c % sp.bandEvery === sp.bandEvery - 1;
    const l = lip * (band ? 1.6 : 1) * Math.max(0.5, s0 / sp.half);
    // moulding: a rounded drip under a flat top, then the face battered inward to the next course
    const rings: [number, number][] = [
      [y0, s0 - 0.02],
      [y0 + 0.01, s0 + l * 0.7],
      [y0 + (ym - y0) * 0.35, s0 + l],
      [ym - 0.01, s0 + l * 0.9],
      [ym, s0 + l * 0.15],
    ];
    if (band) rings.push([ym + ch * 0.12, s0 + l * 0.15], [ym + ch * 0.14, s0 + l * 0.55], [ym + ch * 0.24, s0 + l * 0.5], [ym + ch * 0.26, s0]);
    // the face runs smoothly down the tower's taper (a whitewashed plane, not a stepped ziggurat):
    // it ends just proud of the next course's base so only the thin moulding marks the course
    const sEnd = s1 + Math.min(0.012, bat * s0);
    rings.push([ym + (y1 - ym) * 0.5, THREE.MathUtils.lerp(s0 + l * 0.15, sEnd, 0.5) + bat * s0 * 0.25]);
    rings.push([y1, sEnd]);
    parts.push(skin(angles, sp.n, rings, sp.bulge ?? 0));
    // the ledge on top of the face where the next moulding steps back in (now only a hairline)
    const sNext = sp.half * sp.profile(t1);
    if (c < sp.courses - 1) parts.push(skin(angles, sp.n, [[y1, sEnd], [y1, sNext - 0.02]]));
  }
  // flat cap
  const sTop = sp.half * sp.profile(1);
  const cap = skin(angles, sp.n, [[sp.height, sTop], [sp.height + 0.001, 0.001]]);
  parts.push(cap);
  const g = mergeGeometries(parts, false)!;
  return { geo: g, topHalf: sTop };
}

/** Lathe from [radius, y] pairs (no UVs, smooth normals). */
export function lathe(prof: [number, number][], seg = 32): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), seg);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/** Ribbed cushion (amalaka-like collar) with `ribs` vertical lobes. */
export function ribbedCollar(r: number, h: number, ribs = 24, seg = 72): THREE.BufferGeometry {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    prof.push([r * 0.6 + Math.cos(a) * r * 0.4, h / 2 + Math.sin(a) * h / 2]);
  }
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.07 * Math.pow(Math.abs(Math.cos((a * ribs) / 2)), 2);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** Kalash (pot finial) of height h standing at y=0. */
export function kalashGeo(h: number, seg = 28): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [0.3, 0], [0.32, 0.05], [0.2, 0.1], [0.4, 0.28], [0.43, 0.4], [0.3, 0.56],
    [0.15, 0.62], [0.23, 0.68], [0.19, 0.72], [0.09, 0.76], [0.15, 0.84], [0.07, 0.93], [0.02, 1], [0, 1.02]];
  return lathe(prof.map(([r, y]) => [r * h, y * h]), seg);
}

/** Tube along points (smooth Catmull-Rom). */
export function tube(pts: THREE.Vector3[], r: number, seg = 24, radial = 6): THREE.BufferGeometry {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, radial, false);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/**
 * The Panchshool: Baidyanath's five-pronged trident (instead of Shiva's usual trishul) — a central
 * spike and two pairs of prongs curving up and out, on a crossbar with a small damaru knot.
 * Standing at y=0 in the XY plane, height h.
 */
export function panchshool(h: number): THREE.BufferGeometry {
  const r = h * 0.028;
  const parts: THREE.BufferGeometry[] = [];
  const tip = (x: number, y: number, ang: number) => {
    const c = new THREE.ConeGeometry(r * 2.1, h * 0.16, 6).translate(0, h * 0.08, 0);
    c.rotateZ(ang);
    c.translate(x, y, 0);
    c.deleteAttribute('uv');
    parts.push(c.toNonIndexed());
  };
  // central shaft
  parts.push(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.82, 0)], r * 1.2, 2, 6));
  tip(0, h * 0.8, 0);
  // two pairs of curved prongs
  for (const [w, top] of [[0.22, 0.7], [0.4, 0.58]] as const) {
    for (const sgn of [-1, 1]) {
      const pts = [
        new THREE.Vector3(0, h * 0.32, 0),
        new THREE.Vector3(sgn * w * h * 0.75, h * 0.36, 0),
        new THREE.Vector3(sgn * w * h, h * (top - 0.12), 0),
        new THREE.Vector3(sgn * w * h * 0.96, h * top, 0),
      ];
      parts.push(tube(pts, r, 16, 6));
      tip(sgn * w * h * 0.96, h * top - 0.01, -sgn * 0.08);
    }
  }
  // crossbar knot (damaru-like double cone)
  parts.push(lathe([[0, -h * 0.05], [h * 0.06, 0], [h * 0.02, h * 0.04], [h * 0.06, h * 0.08], [0, h * 0.13]], 12).translate(0, h * 0.22, 0) as THREE.BufferGeometry);
  return mergeGeometries(parts, false)!;
}

/** Plain three-pronged trishul for the Devi and other shrines. */
export function trishul(h: number): THREE.BufferGeometry {
  const r = h * 0.03;
  const parts: THREE.BufferGeometry[] = [tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.85, 0)], r, 2, 6)];
  for (const sgn of [-1, 1]) {
    parts.push(tube([new THREE.Vector3(0, h * 0.5, 0), new THREE.Vector3(sgn * h * 0.2, h * 0.56, 0), new THREE.Vector3(sgn * h * 0.24, h * 0.8, 0)], r * 0.9, 12, 6));
    const c = new THREE.ConeGeometry(r * 2, h * 0.12, 6).translate(sgn * h * 0.24, h * 0.86, 0);
    c.deleteAttribute('uv');
    parts.push(c.toNonIndexed());
  }
  const c = new THREE.ConeGeometry(r * 2.2, h * 0.16, 6).translate(0, h * 0.92, 0);
  c.deleteAttribute('uv');
  parts.push(c.toNonIndexed());
  return mergeGeometries(parts, false)!;
}

/** Two-tailed pennant in the XY plane, hoist at x=0. */
export function pennant(w: number, hgt: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(w, -hgt * 0.2); s.lineTo(w * 0.72, -hgt * 0.5); s.lineTo(w * 0.95, -hgt * 0.85); s.lineTo(0, -hgt); s.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/** Catenary-ish sag between a and b sampled at n+1 points. */
export function sagCurve(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    out.push(p);
  }
  return out;
}

/** A flat ribbon (width w) along a polyline, facing roughly `up`-perpendicular — used for threads. */
export function ribbon(pts: THREE.Vector3[], w: number, twist = 0): THREE.BufferGeometry {
  const pos: number[] = [];
  const side = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const L: THREE.Vector3[] = [], R: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    dir.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(dir, up);
    // a vertical run (hanging threads) has no horizontal side: pick one so the strip never degenerates
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const a = twist * i;
    const off = side.clone().multiplyScalar(Math.cos(a) * w / 2).add(up.clone().multiplyScalar(Math.sin(a) * w / 2));
    L.push(pts[i].clone().add(off));
    R.push(pts[i].clone().sub(off));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    pos.push(...L[i].toArray(), ...R[i].toArray(), ...L[i + 1].toArray(), ...R[i].toArray(), ...R[i + 1].toArray(), ...L[i + 1].toArray());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return safeNormals(g);
}

/** Replace any zero/NaN normals (degenerate triangles) — a NaN normal blows up bloom into black. */
export function safeNormals(g: THREE.BufferGeometry) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
    const l = Math.hypot(x, y, z);
    if (!(l > 1e-6)) n.setXYZ(i, 0, 1, 0);
  }
  return g;
}

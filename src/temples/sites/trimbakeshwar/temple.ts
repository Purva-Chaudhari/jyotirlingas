import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Flag, columnGeometry, type Flames, type Physics } from '../../engine/kit';
import type { TM } from './mats';
import { Merger } from './merge';
import {
  rathaPlanOffsets, roundedRect, loft, cutBox, lathe, crownGeo, kalashGeo, urushringaGeo, amalakaGeo, bracketGeo, knobGeo,
  archWallGeo, archFrameGeo, plate, type Ring,
} from './forms';

/**
 * Shri Trimbakeshwar Mandir (Peshwa Balaji Bajirao, 1755–1786), black basalt, facing east.
 * Origin = courtyard floor below the mandapa's west wall line; +z = east (towards the Mahadwar),
 * +x = north. Units: metres.
 *
 * Plan (ASI: "garbhagriha, a massive square hall with three porches"):
 *   garbhagriha  — centre (0, −9), a star of narrow rathas ±5.4 m, sanctum 4 × 4 m inside, its floor
 *                  sunk ~1 m below the hall so the Jyotirlinga sits in a hollow below ground level;
 *   mandapa      — square hall x ±6.5, z −3.7…10, on a moulded jagati 1.5 m high;
 *   three porches — east (entrance), north and south: cusped Maratha arches on three faces each;
 *   roofs        — the hall and porches carry stepped "curvilinear slab" roofs studded with rows of
 *                  knobs, each crowned by a lime-white amalaka and a gilded kalash; the garbhagriha
 *                  carries the tall nagara shikhara clad in chains of urushringas (apex ≈ 25 m).
 */

export const F = 1.5; // jagati top = mandapa floor
export const GARBHA = { cz: -9, half: 5.2, inner: 2.0, floor: 0.45, ceil: 5.2 };
export const HALL = { x0: -6.5, x1: 6.5, z0: -3.7, z1: 10 };
export const PORCH = { w: 3.6, d: 4.4 };
const WALL_TOP = 6.4, FR0 = 6.65, FR1 = 7.85, COPE = 8.05;

export interface TempleOut {
  flags: Flag[];
  spireTop: number;
  mirror: THREE.Object3D;
}

/** a sloping stone eave along one straight edge (a → b), projecting `out` toward the outward normal (nx, nz) */
function eave(B: Merger, mat: THREE.Material, ax: number, az: number, bx: number, bz: number, nx: number, nz: number, y: number, out: number, drop: number, t = 0.14) {
  const pos: number[] = [];
  const tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz), ux = tx / L, uz = tz / L;
  const e = out * 0.9; // extend past the ends so neighbouring eaves meet at the corners
  const A = [ax - ux * e, y, az - uz * e], Bv = [bx + ux * e, y, bz + uz * e];
  const C = [bx + ux * e + nx * out, y - drop, bz + uz * e + nz * out], D = [ax - ux * e + nx * out, y - drop, az - uz * e + nz * out];
  const dn = (p: number[], k: number) => [p[0], p[1] - k, p[2]];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad(A, D, C, Bv); // top
  quad(dn(A, t * 2.5), dn(Bv, t * 2.5), dn(C, t), dn(D, t)); // soffit
  quad(D, dn(D, t), dn(C, t), C); // fascia
  const g = new THREE.BufferGeometry();
  // emit both windings so the eave shows from above and below
  const n = pos.length;
  for (let i = 0; i < n; i += 9) pos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 6], pos[i + 7], pos[i + 8], pos[i + 3], pos[i + 4], pos[i + 5]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  B.add(mat, g);
}

/**
 * The mandapa roofs as photographed (r149, r087): a short drum, then a convex bell of many tight courses,
 * each course a ring of little carved shrine-knobs sitting on the slope — no flat terraces between them.
 */
function bellRoof(B: Merger, mat: THREE.Material, knobs: THREE.Matrix4[], cx: number, y0: number, cz: number,
  hx: number, hz: number, drumH: number, courses: number, courseH: number, topHalf: number, kr: number) {
  const ar = hx / hz;
  const plan = roundedRect(ar, 1, 0.3);
  const rings: Ring[] = [
    { y: 0, s: hz }, { y: drumH * 0.5, s: hz * 0.985 }, { y: drumH * 0.5 + 0.01, s: hz * 1.01 }, { y: drumH * 0.62, s: hz * 1.01 },
    { y: drumH * 0.62 + 0.01, s: hz * 0.96 }, { y: drumH, s: hz * 0.96 },
  ];
  const H = courses * courseH;
  const sOf = (t: number) => topHalf + (hz * 0.95 - topHalf) * Math.pow(Math.cos(Math.min(1, t) * Math.PI / 2), 0.62);
  for (let k = 0; k < courses; k++) {
    const t0 = k / courses, t1 = (k + 1) / courses, ya = drumH + t0 * H, yb = drumH + t1 * H;
    const s0 = sOf(t0), s1 = sOf(t1);
    // a slight lip at the foot of each course, then the slope up to the next
    rings.push({ y: ya + 0.002, s: s0 * 1.004 }, { y: ya + courseH * 0.25, s: s0 * 0.995 }, { y: yb, s: s1 });
    // knobs sit on the course, half sunk into the slope
    const k2 = kr * (0.65 + 0.35 * s0 / hz);
    const pts = plan.map((p) => p.clone().multiplyScalar(s0 * 0.97 - k2 * 0.15));
    const lens = pts.map((p, i) => p.distanceTo(pts[(i + 1) % pts.length]));
    const total = lens.reduce((a, b) => a + b, 0);
    const n = Math.max(6, Math.round(total / (k2 * 2.0)));
    let acc = 0, seg = 0;
    const off = (k % 2) * 0.5;
    for (let j = 0; j < n; j++) {
      const d = ((j + off) / n) * total;
      while (seg < lens.length - 1 && acc + lens[seg] < d) { acc += lens[seg]; seg++; }
      const f = (d - acc) / lens[seg];
      const p = pts[seg].clone().lerp(pts[(seg + 1) % pts.length], f);
      knobs.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + p.x, y0 + ya + 0.01, cz + p.y), new THREE.Quaternion(), new THREE.Vector3(k2, k2 * 1.35, k2)));
    }
  }
  rings.push({ y: drumH + H + 0.18, s: topHalf * 0.8 });
  B.place(mat, loft(plan, rings), cx, y0, cz);
  return y0 + drumH + H + 0.18;
}

/** Porch: three arched faces (front entrance arch to the floor, side arches over a parapet). */
function porch(B: Merger, K: TM, P: Physics, cx: number, cz: number, axis: 'x' | 'z', sgn: number) {
  // local frame: 'out' runs away from the hall, 'a' along the front
  const w = PORCH.w, d = PORCH.d;
  const H = WALL_TOP - F, depth = 0.62;
  const front = archWallGeo(w * 2, H, depth, 2.9, 0, 2.2, 1.45, 9);
  const side = archWallGeo(d, H, depth, 2.5, 0.95, 2.25, 1.3, 7);
  const frameF = archFrameGeo(2.9, 2.2, 1.45, 0.24, 0.14, 9);
  const frameS = archFrameGeo(2.5, 2.25, 1.3, 0.22, 0.14, 7);
  const ryFront = axis === 'z' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
  // world position from local (a along front, o outward from hall face)
  const W = (a: number, o: number): [number, number] => (axis === 'z' ? [cx + a, cz + sgn * o] : [cx + sgn * o, cz - a * sgn]);
  const [fx, fz] = W(0, d - depth / 2);
  B.place(K.wall, front, fx, F, fz, ryFront);
  const [ffx, ffz] = W(0, d + 0.02);
  B.place(K.basalt, frameF, ffx, F, ffz, ryFront);
  for (const s of [-1, 1]) {
    const [sx, sz] = W(s * (w - depth / 2), d / 2);
    const ry = ryFront + s * (sgn > 0 ? 1 : -1) * (axis === 'z' ? -Math.PI / 2 : -Math.PI / 2) * (axis === 'z' ? 1 : 1);
    B.place(K.wall, side, sx, F, sz, ryFront + (s > 0 ? -Math.PI / 2 : Math.PI / 2));
    const [tx, tz] = W(s * (w + 0.02), d / 2);
    B.place(K.basalt, frameS, tx, F, tz, ryFront + (s > 0 ? -Math.PI / 2 : Math.PI / 2));
    void ry;
  }
  // colliders: front piers and side walls (sills block, openings above sill are walkable only at the front)
  const box = (a0: number, a1: number, o0: number, o1: number, y1: number) => {
    const [x0, z0] = W(a0, o0), [x1, z1] = W(a1, o1);
    P.solid(Math.min(x0, x1), F, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1));
  };
  box(-w, -1.45, d - depth, d, WALL_TOP);
  box(1.45, w, d - depth, d, WALL_TOP);
  box(-w, -w + depth, 0, d, WALL_TOP);
  box(w - depth, w, 0, d, WALL_TOP);
  // ceiling slab and floor inlay
  const [c0x, c0z] = W(-w, 0), [c1x, c1z] = W(w, d);
  B.span(K.basalt, Math.min(c0x, c1x), WALL_TOP - 0.3, Math.min(c0z, c1z), Math.max(c0x, c1x), WALL_TOP, Math.max(c0z, c1z));
  return { W };
}

export function buildTemple(root: THREE.Group, K: TM, P: Physics, flames: Flames): TempleOut {
  const g = new THREE.Group();
  g.name = 'trimbakeshwar-mandir';
  root.add(g);
  const B = new Merger(P, 'temple');
  const Gd = new Merger(P, 'gold');
  const spindles: THREE.Matrix4[] = [], brackets: THREE.Matrix4[] = [], knobs: THREE.Matrix4[] = [];
  // niche reliefs keep their own 0..1 UVs (the Merger re-projects UVs in metres), so they batch separately
  const niches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const nichePlate = (mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry: number) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    const l = niches.get(mat) ?? [];
    l.push(geo);
    niches.set(mat, l);
  };
  const { x0, x1, z0, z1 } = HALL;
  const zc = (z0 + z1) / 2; // hall centre (3.15)
  const w = PORCH.w, d = PORCH.d;

  // ---------- jagati of the hall and porches: moulded courses ----------
  const courses: [number, number, number][] = [[0, 0.3, 0.42], [0.3, 0.56, 0.24], [0.56, 0.86, 0.32], [0.86, 1.1, 0.14], [1.1, 1.3, 0.26], [1.3, 1.5, 0.1]];
  const rects: [number, number, number, number][] = [
    [x0, x1, z0, z1], [-w, w, z1 - 0.5, z1 + d], [x1 - 0.5, x1 + d, zc - w, zc + w], [x0 - d, x0 + 0.5, zc - w, zc + w],
  ];
  for (const [a0, a1, b0, b1] of rects) {
    for (const [y0, y1, o] of courses) B.span(K.basalt, a0 - o, y0, b0 - o, a1 + o, y1, b1 + o);
    P.solid(a0, 0, b0, a1, F, b1);
    P.floor(g, a0, a1, b0, b1, F);
  }
  // little elephants carved on the jagati are suggested by the frieze material on the 3rd course
  for (const [a0, a1, b0, b1] of rects) B.span(K.friezeHall, a0 - 0.33, 0.6, b0 - 0.33, a1 + 0.33, 0.82, b1 + 0.33);

  // ---------- steps to the three porches ----------
  const steps = (cx: number, cz: number, axis: 'x' | 'z', sgn: number, width: number) => {
    const n = 9, tread = 0.34, rise = F / n;
    for (let i = 0; i < n; i++) {
      const o0 = i * tread, y1 = F - i * rise;
      if (axis === 'z') B.span(K.basalt, cx - width / 2, 0, sgn > 0 ? cz + o0 : cz - o0 - tread, cx + width / 2, y1, sgn > 0 ? cz + o0 + tread : cz - o0);
      else B.span(K.basalt, sgn > 0 ? cx + o0 : cx - o0 - tread, 0, cz - width / 2, sgn > 0 ? cx + o0 + tread : cx - o0, y1, cz + width / 2);
    }
    const L = n * tread;
    // side walls of the flight
    for (const s of [-1, 1]) {
      if (axis === 'z') {
        B.span(K.basalt, cx + s * (width / 2 + 0.2) - 0.2, 0, sgn > 0 ? cz : cz - L, cx + s * (width / 2 + 0.2) + 0.2, F + 0.35, sgn > 0 ? cz + L : cz, true);
      } else {
        B.span(K.basalt, sgn > 0 ? cx : cx - L, 0, cz + s * (width / 2 + 0.2) - 0.2, sgn > 0 ? cx + L : cx, F + 0.35, cz + s * (width / 2 + 0.2) + 0.2, true);
      }
    }
    // walkable ramp over the treads
    if (axis === 'z') P.floor(g, cx - width / 2, cx + width / 2, sgn > 0 ? cz + L : cz - L, cz, 0, F);
    else {
      const geo = new THREE.BufferGeometry();
      const xa = sgn > 0 ? cx + L : cx - L;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        xa, 0, cz - width / 2, cx, F, cz - width / 2, cx, F, cz + width / 2, xa, 0, cz + width / 2,
      ]), 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
      g.add(m);
      P.floors.push(m);
    }
  };
  steps(0, z1 + d, 'z', 1, 3.0);
  steps(x1 + d, zc, 'x', 1, 3.0);
  steps(x0 - d, zc, 'x', -1, 3.0);

  // ---------- the hall's walls (openings to the porches and the antarala) ----------
  const Hw = 0.9;
  const wallSeg = (a0: number, a1: number, b0: number, b1: number, y0 = F, y1 = WALL_TOP, solid = true) => B.span(K.wall, a0, y0, b0, a1, y1, b1, solid);
  const OW = 1.5, OH = F + 3.7; // half-width and top of the openings into the porches
  // east wall
  wallSeg(x0, -OW, z1 - Hw, z1); wallSeg(OW, x1, z1 - Hw, z1); wallSeg(-OW, OW, z1 - Hw, z1, OH, WALL_TOP, false);
  // north and south walls
  for (const s of [-1, 1]) {
    const xa = s > 0 ? x1 - Hw : x0, xb = s > 0 ? x1 : x0 + Hw;
    wallSeg(xa, xb, z0, zc - OW); wallSeg(xa, xb, zc + OW, z1); wallSeg(xa, xb, zc - OW, zc + OW, OH, WALL_TOP, false);
  }
  // west wall (thick: it meets the garbhagriha), with the antarala passage
  wallSeg(x0, -0.8, z0, z0 + 1.6); wallSeg(0.8, x1, z0, z0 + 1.6); wallSeg(-0.8, 0.8, z0, z0 + 1.6, F + 3.0, WALL_TOP, false);
  // the hall's ceiling: flat slab with a central domed recess, and the floor
  const iz0 = z0 + 1.6, iz1 = z1 - Hw, ix0 = x0 + Hw, ix1 = x1 - Hw;
  const ccz = (iz0 + iz1) / 2;
  for (const [a0, a1, b0, b1] of [[ix0, ix1, iz0, ccz - 3.4], [ix0, ix1, ccz + 3.4, iz1], [ix0, -3.4, ccz - 3.4, ccz + 3.4], [3.4, ix1, ccz - 3.4, ccz + 3.4]]) {
    B.span(K.basalt, a0, WALL_TOP - 0.35, b0, a1, WALL_TOP + 1.2, b1);
  }
  // inner dome (normals inward: mirrored lathe)
  const idome = lathe([[3.4 * Math.SQRT2, 0], [3.3, 0.25], [3.0, 1.0], [2.4, 1.7], [1.5, 2.2], [0.5, 2.45], [0, 2.5]], 32);
  idome.scale(1, 1, -1);
  idome.computeVertexNormals();
  B.place(K.basalt, idome, 0, WALL_TOP - 0.35, ccz);
  // four pillars carrying the dome
  const colGeo = columnGeometry(WALL_TOP - 0.35 - F, 0.2);
  for (const [px, pz] of [[-3.0, ccz - 3.0], [3.0, ccz - 3.0], [-3.0, ccz + 3.0], [3.0, ccz + 3.0]]) {
    B.place(K.basalt, colGeo, px, F, pz);
    P.solid(px - 0.3, F, pz - 0.3, px + 0.3, WALL_TOP, pz + 0.3);
  }
  // marble floor of the hall
  B.span(K.paving, ix0, F - 0.02, iz0, ix1, F + 0.005, iz1);

  // ---------- porches ----------
  porch(B, K, P, 0, z1, 'z', 1);
  porch(B, K, P, x1, zc, 'x', 1);
  porch(B, K, P, x0, zc, 'x', -1);

  // ---------- outer faces of the cross: eaves, friezes, copings ----------
  type Seg = [number, number, number, number, number, number]; // ax, az, bx, bz, nx, nz
  const segs: Seg[] = [
    // east porch
    [-w, z1 + d, w, z1 + d, 0, 1], [w, z1, w, z1 + d, 1, 0], [-w, z1, -w, z1 + d, -1, 0],
    // north porch
    [x1 + d, zc - w, x1 + d, zc + w, 1, 0], [x1, zc + w, x1 + d, zc + w, 0, 1], [x1, zc - w, x1 + d, zc - w, 0, -1],
    // south porch
    [x0 - d, zc - w, x0 - d, zc + w, -1, 0], [x0 - d, zc + w, x0, zc + w, 0, 1], [x0 - d, zc - w, x0, zc - w, 0, -1],
    // hall corners between the porches
    [w, z1, x1, z1, 0, 1], [-w, z1, x0, z1, 0, 1], [x1, zc + w, x1, z1, 1, 0], [x0, zc + w, x0, z1, -1, 0],
    [x1, z0, x1, zc - w, 1, 0], [x0, z0, x0, zc - w, -1, 0],
  ];
  for (const [ax, az, bx, bz, nx, nz] of segs) {
    eave(B, K.basalt, ax, az, bx, bz, nx, nz, WALL_TOP + 0.12, 0.62, 0.36);
    const ext = 0.04;
    const lx0 = Math.min(ax, bx) - (nx ? 0 : ext), lx1 = Math.max(ax, bx) + (nx ? 0 : ext);
    const lz0 = Math.min(az, bz) - (nz ? 0 : ext), lz1 = Math.max(az, bz) + (nz ? 0 : ext);
    const o = (a0: number, a1: number) => (nx ? [ax + nx * a0, ax + nx * a1].sort((p, q) => p - q) : [az + nz * a0, az + nz * a1].sort((p, q) => p - q));
    const band = (mat: THREE.Material, y0: number, y1: number, out0: number, out1: number) => {
      const [p0, p1] = o(out0, out1);
      if (nx) B.span(mat, p0, y0, lz0 - out1, p1, y1, lz1 + out1);
      else B.span(mat, lx0 - out1, y0, p0, lx1 + out1, y1, p1);
    };
    band(K.basalt, WALL_TOP - 0.05, FR0, -0.3, 0.12);
    // the carved upper zone between the arches and the eave: a cornice and a frieze of little niches
    band(K.basalt, F + 3.82, F + 4.0, -0.3, 0.24);
    band(K.basalt, F + 4.0, F + 4.08, -0.3, 0.14);
    band(K.friezeMid, F + 4.08, F + 4.72, -0.3, 0.06);
    // moulded base and a carved mid-course on the hall's solid corner faces (as photographed)
    if (Math.hypot(bx - ax, bz - az) < 4) {
      band(K.basalt, F, F + 0.22, -0.3, 0.1);
      band(K.basalt, F + 0.22, F + 0.4, -0.3, 0.05);
      band(K.friezeMid, F + 2.0, F + 2.6, -0.3, 0.06);
      band(K.basalt, F + 2.6, F + 2.72, -0.3, 0.1);
    }
    band(K.friezePorch, FR0, FR1, -0.3, 0.06);
    band(K.basalt, FR1, COPE, -0.3, 0.2);
    // a small dark jali window on the hall's corner faces
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4 && Math.abs(nx * (ax - 0)) + Math.abs(nz * (az - zc)) > 6) {
      const mx = (ax + bx) / 2 + nx * 0.02, mz = (az + bz) / 2 + nz * 0.02;
      B.box(K.dark, nx ? 0.06 : 0.62, 0.72, nx ? 0.62 : 0.06, mx, F + 2.6, mz);
      for (let k = -2; k <= 2; k++) {
        B.box(K.basalt, nx ? 0.08 : 0.035, 0.72, nx ? 0.035 : 0.08, mx + (nx ? 0 : k * 0.12), F + 2.6, mz + (nx ? k * 0.12 : 0));
        B.box(K.basalt, nx ? 0.08 : 0.62, 0.035, nx ? 0.62 : 0.08, mx, F + 2.6 + 0.36 + k * 0.13, mz);
      }
      B.box(K.basalt, nx ? 0.18 : 0.9, 0.12, nx ? 0.9 : 0.18, mx, F + 2.48, mz);
      B.box(K.basalt, nx ? 0.18 : 0.9, 0.16, nx ? 0.9 : 0.18, mx, F + 3.34, mz);
      // and a niche figure below it
      const nm = K.niche[(Math.abs(Math.round(ax + az)) % 4)];
      nichePlate(nm, plate(0.55, 1.1), mx + nx * 0.04, F + 0.6, mz + nz * 0.04, Math.atan2(nx, nz));
    }
  }

  // ---------- bell roofs of knob courses ----------
  const hallTop = bellRoof(B, K.basalt, knobs, 0, COPE, zc, 6.7, 6.9, 1.1, 14, 0.33, 1.25, 0.24);
  const eTop = bellRoof(B, K.basalt, knobs, 0, COPE, z1 + d / 2 + 0.2, w + 0.1, d / 2 + 0.3, 0.45, 7, 0.3, 0.5, 0.18);
  const nTop = bellRoof(B, K.basalt, knobs, x1 + d / 2 + 0.2, COPE, zc, d / 2 + 0.3, w + 0.1, 0.45, 7, 0.3, 0.5, 0.18);
  const sTop = bellRoof(B, K.basalt, knobs, x0 - d / 2 - 0.2, COPE, zc, d / 2 + 0.3, w + 0.1, 0.45, 7, 0.3, 0.5, 0.18);
  const flags: Flag[] = [];
  const crowned = (x: number, y: number, z: number, r: number, kh: number, pole: number) => {
    const c = crownGeo(r);
    B.place(K.lime, c.geo, x, y, z);
    Gd.place(K.gold, kalashGeo(kh), x, y + c.top, z);
    if (pole > 0) {
      const f = new Flag(g, K.steel, K.saffron, x + r * 0.55, y + c.top * 0.4, z, pole);
      f.mesh.scale.setScalar(0.45);
      flags.push(f);
    }
  };
  crowned(0, hallTop, zc, 1.2, 1.05, 3.2);
  crowned(0, eTop, z1 + d / 2 + 0.2, 0.55, 0.62, 0);
  crowned(x1 + d / 2 + 0.2, nTop, zc, 0.55, 0.62, 0);
  crowned(x0 - d / 2 - 0.2, sTop, zc, 0.55, 0.62, 0);

  // ---------- garbhagriha: mandovara and shikhara as one loft on the ratha star ----------
  const H0 = GARBHA.half;
  // seven rathas per face, projecting 0 / 0.15 / 0.25 / 0.35 m (karna → bhadra), deep slots between them
  const OFFS = [0, 0.15, 0.25, 0.35, 0.25, 0.15, 0].map((m) => m / H0);
  const plan = rathaPlanOffsets(OFFS, 0.06 / H0, 0.13);
  // mandovara profile in metres (y) and relative scale (s): jagati, base mouldings (khura, kumbha,
  // kalasha, kapotali), the jangha with two bands, the varandika and a heavy overhanging kapota
  const prof: [number, number][] = [
    [0, 1.1], [0.28, 1.1], [0.33, 1.07], [0.6, 1.07], [0.66, 1.095], [0.86, 1.095], [0.9, 1.05], [1.12, 1.05], [1.17, 1.075], [1.34, 1.075], [1.38, 1.03], [1.5, 1.03],
    [1.5, 1.0], [1.52, 1.055], [1.72, 1.055], [1.76, 1.0], [1.95, 1.0], [1.98, 1.05], [2.2, 1.05], [2.24, 0.985], [2.4, 0.985], [2.43, 1.035], [2.58, 1.035],
    [2.62, 0.98], [2.75, 0.98], [2.78, 1.045], [2.9, 1.045], [2.94, 1.0],
    [3.86, 1.0], [3.88, 1.03], [3.98, 1.03], [4.0, 0.995], [4.86, 0.995], [4.88, 1.03], [4.98, 1.03], [5.0, 1.0],
    [5.9, 1.0], [5.93, 1.035], [6.05, 1.035], [6.08, 0.985], [6.25, 0.985], [6.28, 1.04], [6.4, 1.04], [6.44, 1.0], [6.7, 1.0],
    [6.72, 1.05], [6.95, 1.105], [7.06, 1.105], [7.1, 1.02], [7.13, 0.985], [7.34, 0.985], [7.37, 1.045], [7.55, 1.045], [7.6, 0.98],
  ];
  const rings: Ring[] = prof.map(([y, s]) => ({ y, s: s * H0 }));
  // the shikhara: ~2.3× the wall, near-linear taper, rolling in only over the top fifth; top ≈ 0.24 of the base
  const SB = 7.6, SH = 17.5, sB = 0.97, sT = 0.24, bands = 14;
  const sAt = (t: number) => sB + (sT - sB) * (0.9 * t + (t > 0.8 ? 0.1 * ((t - 0.8) / 0.2) ** 2 : 0));
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands, s0 = sAt(t0) * H0, bh = SH / bands;
    const y0 = SB + t0 * SH;
    rings.push(
      // a bhumi course: a 0.15 m projecting band over a deep shadow groove
      { y: y0 + 0.001, s: s0 - 0.07 }, { y: y0 + bh * 0.04, s: s0 + 0.15 }, { y: y0 + bh * 0.13, s: s0 + 0.15 }, { y: y0 + bh * 0.16, s: s0 + 0.04 },
      { y: y0 + bh * 0.2, s: s0 - 0.05 },
      { y: y0 + bh * 0.6, s: sAt(t0 + (t1 - t0) * 0.6) * H0 },
    );
  }
  const top = SB + SH, sTp = sT * H0;
  rings.push({ y: top, s: sTp }, { y: top + 0.3, s: sTp * 0.82 }, { y: top + 0.5, s: sTp * 0.74 });
  let gl = loft(plan, rings, true);
  // cut the antarala doorway through the east face (local +z) below the hall roof
  gl = cutBox(gl, new THREE.Vector3(-1.3, F, H0 - 0.3), new THREE.Vector3(1.3, F + 3.4, H0 + 2));
  B.place(K.basalt, gl, 0, 0, GARBHA.cz);
  const crownY = top + 0.5;
  const gc = crownGeo(1.55);
  B.place(K.lime, gc.geo, 0, crownY, GARBHA.cz);
  const kTop = crownY + gc.top;
  Gd.place(K.gold, kalashGeo(1.45), 0, kTop, GARBHA.cz);
  // flag-staff with the trident and saffron dhwaja, beside the kalash
  const fx = 0.95, fz = GARBHA.cz + 0.6;
  B.box(K.steel, 0.07, 4.2, 0.07, fx, crownY + 0.3, fz);
  const tri = new THREE.Group();
  tri.position.set(fx, crownY + 4.5, fz);
  g.add(tri);
  for (const [x, h] of [[0, 0.7], [-0.22, 0.5], [0.22, 0.5]] as const) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.045, h, 6), K.gold);
    p.position.set(x, h / 2 + 0.12, 0);
    tri.add(p);
  }
  const tb = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16, Math.PI), K.gold);
  tb.rotation.z = Math.PI;
  tb.position.y = 0.2;
  tri.add(tb);
  for (const [dy, sc] of [[3.2, 0.62], [2.6, 0.5], [2.0, 0.42]] as const) {
    const f = new Flag(g, K.steel, K.saffron, fx, crownY + 0.3, fz, dy);
    f.mesh.scale.setScalar(sc);
    flags.push(f);
  }

  // ---------- the shikhara's skin (r012, r087, r088): a hierarchy, not a grid ----------
  //  - on each face a central latina spine, a continuous ribbed band with a chaitya-arch (gavaksha) mesh,
  //    rising the full height, with three great urushringas (1.0 / 0.8 / 0.6) clinging to its lower half;
  //  - on the pratirathas tiers of miniature spires of falling size (0.6 / 0.42 / 0.27 m radius), each
  //    row offset half a pitch from the one below, leaning in with the curve;
  //  - corner (karna) chains of the same tiers, a ribbed bhumi-amalaka on each corner at every course;
  //  - the upper fifth left to the bhumi courses and the spine alone, as photographed.
  const cols = OFFS.map((_, k) => -1 + (k + 0.5) * (2 / OFFS.length));
  const offAt = (u: number) => OFFS[Math.min(OFFS.length - 1, Math.max(0, Math.floor((u + 1) / (2 / OFFS.length))))];
  const slope = ((sB - sT) * 0.9 * H0) / SH;
  const tilt = Math.atan(slope) * 0.85;
  const sAtY = (y: number) => sAt(Math.min(1, Math.max(0, (y - SB) / SH))) * H0;
  const bhAmal: THREE.Matrix4[] = [];
  const hallHide = 13.6; // the east face below this is behind the hall's bell roof
  const UP = new THREE.Vector3(0, 1, 0);
  let js = 811;
  const jit = () => ((js = (js * 16807) % 2147483647) / 2147483647);
  const prism = (side: number, ya: number, yb: number, hwK: number, proj: number) => {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const gb = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const p = gb.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = p.getX(i), by = p.getY(i), bz = p.getZ(i);
      const Y = ya + (by + 0.5) * (yb - ya), S = sAtY(Y);
      const o = S * (1 + OFFS[3]) - 0.08 + (bz + 0.5) * (proj + 0.08), l = bx * 2 * hwK * S;
      p.setXYZ(i, o * ca - l * sa, Y, GARBHA.cz + o * sa + l * ca);
    }
    gb.deleteAttribute('normal');
    gb.computeVertexNormals();
    B.add(K.friezeMid, gb);
  };
  const spire = (side: number, u: number, y: number, r: number, h: number, sink = 0.3, spin = 0) => {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    // a little irregularity: the carvers' spires differ in size and sit a hand off the ideal grid
    const jr = 1 + (jit() - 0.5) * 0.16, jh = 1 + (jit() - 0.5) * 0.18;
    r *= jr; h *= jh;
    const sm = sAtY(y);
    const lx = sm * (1 + offAt(u)) - r * sink, lz = u * sm + (jit() - 0.5) * r * 0.25;
    const tAx = new THREE.Vector3(-sa, 0, ca);
    const q = new THREE.Quaternion().setFromAxisAngle(tAx, tilt).multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
    spindles.push(new THREE.Matrix4().compose(new THREE.Vector3(lx * ca - lz * sa, y, GARBHA.cz + lx * sa + lz * ca), q, new THREE.Vector3(r, h, r)));
  };
  const tiers = [{ t1: 0.28, r: 0.6 }, { t1: 0.5, r: 0.43 }, { t1: 0.68, r: 0.3 }];
  const SPW = 0.16; // spine half-width (fraction of the half-face)
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    // the latina spine, course by course (each course its own block, so the bhumi lines run through)
    for (let k = 0; k < bands; k++) {
      const ya = SB + (k / bands) * SH + 0.12 * (SH / bands), yb = SB + ((k + 1) / bands) * SH;
      if (side === 1 && yb < hallHide) continue;
      prism(side, ya, yb, SPW, 0.42 - k * 0.018);
      // a gavaksha on the spine's face in every course above the great urushringas
      if (k >= 5 && k < bands - 1) {
        const ym = ya + 0.05, S = sAtY(ym), o = S * (1 + OFFS[3]) + 0.42 - k * 0.018 + 0.02;
        const w = SPW * S * 1.3;
        B.place(K.basalt, archFrameGeo(w, (yb - ya) * 0.25, (yb - ya) * 0.45, w * 0.18, 0.08, 3), o * ca, ym, GARBHA.cz + o * sa, Math.atan2(ca, sa));
      }
    }
    // three great urushringas stacked against the spine's foot
    let yy = SB + 0.15;
    for (const sc of [1.0, 0.8, 0.6]) {
      const r = 0.78 * sc, h = r * 4.0;
      if (!(side === 1 && yy + h < hallHide)) spire(side, 0, yy, r, h, -0.35 / sc, side);
      yy += h * 0.86;
    }
    // the pratiratha tiers, both halves of the face: packed shoulder to shoulder, rows half a pitch apart
    let y = SB + 0.12, row = 0;
    for (const T of tiers) {
      while ((y - SB) / SH < T.t1) {
        const sm = sAtY(y), h = T.r * 4.3, pitch = (2 * T.r * 0.88) / sm;
        const u0 = SPW + (T.r * 0.85) / sm + (row % 2 ? pitch / 2 : 0), u1 = 0.9 - (T.r * 0.6) / sm;
        if (!(side === 1 && y + h < hallHide)) {
          for (let u = u0, n = 0; u <= u1; u += pitch, n++) {
            for (const sg of [-1, 1]) spire(side, sg * u, y, T.r * (0.93 + 0.14 * ((row + n) % 2)), h * (0.95 + 0.1 * ((n + row + 1) % 2)), 0.45, row * 0.7 + n);
          }
        }
        y += h * 0.5;
        row++;
      }
    }
    // the karna: a chain of the same tiers on the corner, and a bhumi-amalaka at every course
    let yc = SB + 0.1;
    for (const T of tiers) {
      while ((yc - SB) / SH < T.t1 + 0.05) {
        const rc = T.r * 0.95, h = rc * 4.3, sm = sAtY(yc);
        const lx = sm - rc * 0.15, lz = sm - rc * 0.15;
        const tAx = new THREE.Vector3(-(sa + ca), 0, ca - sa).normalize();
        spindles.push(new THREE.Matrix4().compose(new THREE.Vector3(lx * ca - lz * sa, yc, GARBHA.cz + lx * sa + lz * ca),
          new THREE.Quaternion().setFromAxisAngle(tAx, tilt), new THREE.Vector3(rc, h, rc)));
        yc += h * 0.5;
      }
    }
    for (let k = 1; k < bands; k++) {
      const yk = SB + (k / bands) * SH, sm = sAtY(yk), ra = 0.18 + 0.32 * (sm / H0);
      if ((yk - SB) / SH < 0.72) continue; // below, the karna chain fills the corner
      bhAmal.push(new THREE.Matrix4().compose(new THREE.Vector3((sm + 0.05) * (ca - sa), yk + 0.02, GARBHA.cz + (sm + 0.05) * (sa + ca)), new THREE.Quaternion(), new THREE.Vector3(ra, ra * 0.8, ra)));
    }
  }
  // pendant brackets under the kapota, one per ratha
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < OFFS.length; k++) {
      const u = cols[k];
      const lx = H0 * (1 + offAt(u)) + 0.14, lz = u * H0;
      const x = lx * ca - lz * sa, z = lx * sa + lz * ca;
      if (side === 1 && Math.abs(u) < 0.5) continue; // hidden behind the hall roof anyway
      brackets.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 6.3, GARBHA.cz + z), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.42, 0.16)));
    }
  }
  // figures in the bhadra niches (north, west, south faces of the garbhagriha)
  for (const [side, ry] of [[0, Math.PI / 2], [2, -Math.PI / 2], [3, Math.PI]] as const) {
    const a = (side * Math.PI) / 2;
    const r = H0 * (1 + OFFS[3]) + 0.015;
    for (const [u, y, sc, v] of [[0, 3.05, 1.0, side], [0, 4.98, 0.75, side + 1]] as const) {
      const lx = r, lz = u;
      const x = lx * Math.cos(a) - lz * Math.sin(a), z = lx * Math.sin(a) + lz * Math.cos(a);
      nichePlate(K.niche[v % 4], plate(0.8 * sc, 1.6 * sc), x, y, GARBHA.cz + z, ry);
    }
  }

  // a tier of carved figures on every other ratha of the jangha (between the two bands)
  for (const side of [0, 2, 3]) {
    const a = (side * Math.PI) / 2, ry = side === 0 ? Math.PI / 2 : side === 2 ? -Math.PI / 2 : Math.PI;
    for (let k = 0; k < OFFS.length; k++) {
      if (k === 3) continue;
      const u = cols[k], lx = H0 * (1 + OFFS[k]) + 0.012, lz = u * H0;
      const x = lx * Math.cos(a) - lz * Math.sin(a), z = lx * Math.sin(a) + lz * Math.cos(a);
      nichePlate(K.niche[(k + side) % 4], plate(0.46, 0.86), x, 3.0, GARBHA.cz + z, ry);
      nichePlate(K.niche[(k + side + 2) % 4], plate(0.42, 0.8), x, 5.04, GARBHA.cz + z, ry);
    }
  }

  // ---------- antarala: passage, steps down into the sanctum, silver door frame ----------
  const AZ0 = GARBHA.cz + GARBHA.inner, AZ1 = z0 + 1.6; // -7 → -2.1
  // the antarala walls: densely carved black basalt (off07) — relief panels between proud half-pilasters
  for (const s of [-1, 1]) B.span(K.carvedWall, s > 0 ? 0.8 : -1.3, GARBHA.floor, AZ0, s > 0 ? 1.3 : -0.8, F + 3.2, z0 + 0.2);
  const apil = lathe([[0.13, 0], [0.13, 0.1], [0.1, 0.14], [0.1, 0.45], [0.12, 0.5], [0.09, 0.54], [0.09, 1.7], [0.12, 1.75], [0.08, 1.8], [0.08, 2.9],
    [0.13, 3.0], [0.17, 3.12], [0.18, 3.25], [0, 3.25]], 12);
  for (const s of [-1, 1]) {
    for (let z = AZ0 + 0.15; z < z0 + 0.1; z += 0.8) B.place(K.basalt, apil, s * 0.8, GARBHA.floor, z, 0, [0.9, (F + 3.0 - GARBHA.floor) / 3.25, 0.9]);
  }
  B.span(K.basalt, -1.3, F + 3.0, AZ0, 1.3, F + 3.4, AZ1);
  const nSt = 6, stZ0 = -5.6, stZ1 = z0 + 0.1;
  for (let i = 0; i < nSt; i++) {
    const zz0 = stZ0 + (i * (stZ1 - stZ0)) / nSt;
    B.span(K.basalt, -0.8, 0, zz0, 0.8, GARBHA.floor + ((i + 1) * (F - GARBHA.floor)) / nSt, stZ1);
  }
  B.span(K.basalt, -0.8, 0, AZ0, 0.8, GARBHA.floor, stZ0);
  P.floor(g, -0.8, 0.8, stZ0, stZ1, GARBHA.floor, F);
  P.floor(g, -0.8, 0.8, AZ0 - 0.01, stZ0, GARBHA.floor);
  // the sanctum doorway: carved black-stone jambs in several receding bands and a carved lintel (off07),
  // with only a thin silver threshold
  for (const s of [-1, 1]) {
    for (const [o, wd, dep] of [[0.62, 0.1, 0.16], [0.72, 0.1, 0.12], [0.82, 0.1, 0.08]] as const) {
      B.span(K.carvedWall, s * (o + wd / 2) - wd / 2, GARBHA.floor, AZ0 - 0.02, s * (o + wd / 2) + wd / 2, GARBHA.floor + 2.5 + (o - 0.62), AZ0 + dep);
    }
    B.place(K.basalt, apil, s * 0.66, GARBHA.floor, AZ0 + 0.17, 0, [0.6, 2.4 / 3.25, 0.6]);
  }
  B.span(K.friezeMid, -0.92, GARBHA.floor + 2.5, AZ0 - 0.02, 0.92, GARBHA.floor + 2.95, AZ0 + 0.14);
  B.span(K.basalt, -1.0, GARBHA.floor + 2.95, AZ0 - 0.02, 1.0, GARBHA.floor + 3.08, AZ0 + 0.22);
  B.span(K.silver, -0.62, GARBHA.floor, AZ0 - 0.04, 0.62, GARBHA.floor + 0.05, AZ0 + 0.1);
  // the darshan mirror hung just inside the doorway at the lintel, tipped ~19° so the queue in the antarala
  // sees the jalahari from above (off07). A real planar reflection, rendered only while it is in view.
  const mirror = new Reflector(new THREE.PlaneGeometry(1.2, 0.8), { textureWidth: 512, textureHeight: 360, color: 0xb8bcbc, clipBias: 0.003 });
  mirror.position.set(0, GARBHA.floor + 2.32, AZ0 - 0.42);
  mirror.rotation.x = 1.245;
  g.add(mirror);
  // only pay for the reflection pass when the camera is inside the temple (hall, antarala, sanctum)
  const reflect = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = (r, sc, cam, ...rest) => {
    const p = cam.position;
    if (Math.abs(p.x) < 6.5 && p.z < z1 && p.z > GARBHA.cz - 2.2 && p.y < 9) reflect(r, sc, cam, ...rest);
  };
  const mframe = new THREE.Group();
  mframe.position.copy(mirror.position);
  mframe.rotation.copy(mirror.rotation);
  g.add(mframe);
  for (const [w2, h2, x, y] of [[1.32, 0.06, 0, 0.43], [1.32, 0.06, 0, -0.43], [0.06, 0.92, 0.63, 0], [0.06, 0.92, -0.63, 0]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.04), K.silver);
    b.position.set(x, y, -0.025);
    mframe.add(b);
  }
  for (const sx of [-0.55, 0.55]) {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), K.silver);
    ch.position.set(sx, GARBHA.floor + 2.75, AZ0 - 0.6);
    g.add(ch);
  }

  // garbhagriha mass colliders (sanctum and passage left open)
  const gz0 = GARBHA.cz - H0 * 1.12, gz1 = GARBHA.cz + H0 * 1.12, ia = GARBHA.inner;
  P.solid(-H0 * 1.12, 0, gz0, -ia, 30, gz1 - 0.1);
  P.solid(ia, 0, gz0, H0 * 1.12, 30, gz1 - 0.1);
  P.solid(-ia, 0, gz0, ia, 30, GARBHA.cz - ia);
  P.solid(-ia, 0, AZ0, -0.8, 30, z0);
  P.solid(0.8, 0, AZ0, ia, 30, z0);

  // ---------- chandelier and lamps in the hall ----------
  // crystal chandelier (as photographed, 2024): tiers of glass drops round a gilt stem, strings of
  // small lights radiating from it to the rim of the dome
  const cy = WALL_TOP - 1.6, apex = WALL_TOP - 0.35 + 2.45;
  Gd.box(K.brass, 0.03, apex - cy, 0.03, 0, cy, ccz);
  Gd.place(K.brass, lathe([[0, -0.1], [0.12, -0.05], [0.16, 0.05], [0.08, 0.2], [0.05, 0.6], [0.1, 0.7], [0, 0.75]], 16), 0, cy - 0.2, ccz);
  const drops: THREE.Vector3[] = [];
  for (const [r, y, n] of [[0.75, 0, 28], [0.58, 0.32, 22], [0.4, 0.6, 16], [0.24, 0.85, 10], [0.5, -0.25, 20], [0.28, -0.45, 12]] as const) {
    Gd.place(K.brass, lathe([[r - 0.02, 0], [r + 0.02, 0], [r + 0.02, 0.025], [r - 0.02, 0.025]], 32), 0, cy + y, ccz);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (let k = 0; k < 3; k++) drops.push(new THREE.Vector3(Math.cos(a) * r, cy + y - 0.05 - k * 0.07, ccz + Math.sin(a) * r));
    }
  }
  const lights: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const p0 = new THREE.Vector3(0, apex - 0.3, ccz), p1 = new THREE.Vector3(Math.cos(a) * 3.3, WALL_TOP - 0.4, ccz + Math.sin(a) * 3.3);
    for (let k = 1; k < 18; k++) {
      const t = k / 18, p = p0.clone().lerp(p1, t);
      p.y -= Math.sin(t * Math.PI) * 0.35;
      lights.push(p);
    }
  }
  const dropMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.03, 0).scale(1, 1.8, 1), K.crystal, drops.length + lights.length);
  [...drops, ...lights].forEach((p, i) => dropMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  g.add(dropMesh);
  const hl = new THREE.PointLight(0xffc488, 2.2, 13, 1.6);
  hl.position.set(0, WALL_TOP - 1.0, ccz);
  g.add(hl);
  flames.lights.push(hl);
  const stand = lathe([[0, 0], [0.18, 0], [0.14, 0.05], [0.035, 0.1], [0.035, 1.25], [0.07, 1.28], [0.16, 1.32], [0.14, 1.36], [0, 1.35]], 16);
  for (const [px, pz] of [[-1.4, z0 + 2.3], [1.4, z0 + 2.3]]) {
    Gd.place(K.brass, stand, px, F, pz);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(px + Math.cos(a) * 0.12, F + 1.41, pz + Math.sin(a) * 0.12));
    }
    P.solid(px - 0.2, F, pz - 0.2, px + 0.2, F + 1.4, pz + 0.2);
  }

  B.flush(g);
  Gd.flush(g);
  for (const [mat, list] of niches) {
    const m = new THREE.Mesh(mergeGeometries(list, false)!, mat);
    m.receiveShadow = true;
    g.add(m);
  }

  // instanced carving
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cast = true) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
    return im;
  };
  inst(urushringaGeo(), K.spindle, spindles);
  inst(amalakaGeo(1, 20, 16), K.basalt, bhAmal);
  inst(bracketGeo(), K.basalt, brackets, false);
  inst(knobGeo(), K.basalt, knobs);
  return { flags, spireTop: kTop + 1.45, mirror };
}

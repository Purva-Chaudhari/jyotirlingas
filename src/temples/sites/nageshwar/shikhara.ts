import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import { Batch, Instances, mergeParts } from './batch';
import type { NM } from './mats';

/**
 * Nageshwar's roofs, read from the photographs:
 *  - the main shikhara over the garbhagriha: a tall, bullet-shaped Nagara latina in maroon, pancha-ratha
 *    in plan, its central and side rathas carrying vertical rows of cream horseshoe gavakshas (the large
 *    ones on the bhadra with ॐ), a skirt of two rows of miniature spires round its foot, a cream ribbed
 *    amalaka, a gilded kalash and the saffron dhwaja;
 *  - two smaller shikharas of the same form beside the entrance porch (swastika on the front);
 *  - stepped pyramidal samvarana roofs over the mandapa, the porch and the antarala: a drum with an ॐ
 *    roundel on each face, then tier after tier edged in cream and fringed with little pointed ghantas.
 */

/** Pancha-ratha plan for one side: (along-side u in -1..1, outward offset). */
const SIDE: [number, number][] = [
  [-1, 0], [-0.8, 0], [-0.8, -0.1], [-0.72, -0.1], [-0.72, 0.0], [-0.44, 0.0], [-0.44, -0.08], [-0.36, -0.08], [-0.36, 0.07],
  [-0.26, 0.07], [-0.26, 0.15], [0.26, 0.15], [0.26, 0.07], [0.36, 0.07], [0.36, -0.08], [0.44, -0.08], [0.44, 0.0],
  [0.72, 0.0], [0.72, -0.1], [0.8, -0.1], [0.8, 0],
];

function plan(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of SIDE) {
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/** bullet profile: near-vertical below, rounding over into the shoulder (half-width relative to base) */
export const bullet = (t: number) => 1 - 0.1 * t - 0.52 * Math.pow(t, 2.3);

/**
 * Unit spire body: base half-width 1, height 1, `bhumis` courses each with a slightly projecting band.
 * Faces point outward. No crown (added separately).
 */
export function spireBody(bhumis: number, width = bullet): THREE.BufferGeometry {
  const P = plan();
  const N = P.length;
  const rings: { y: number; s: number }[] = [];
  for (let k = 0; k < bhumis; k++) {
    const t0 = k / bhumis, t1 = (k + 1) / bhumis;
    const tb = t1 - (t1 - t0) * 0.12;
    rings.push({ y: t0, s: width(t0) });
    rings.push({ y: tb, s: width(tb) });
    rings.push({ y: tb, s: width(tb) * 1.007 });
    rings.push({ y: t1, s: width(t1) * 1.007 });
    rings.push({ y: t1, s: width(t1) });
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
  // cap
  const top = rings[rings.length - 1];
  for (let i = 0; i < N; i++) {
    const p = P[i], q = P[(i + 1) % N];
    pos.push(0, top.y, 0, q.x * top.s, top.y, q.y * top.s, p.x * top.s, top.y, p.y * top.s);
  }
  // orient outward
  const A = new THREE.Vector3(pos[0], pos[1], pos[2]), Bv = new THREE.Vector3(pos[3], pos[4], pos[5]), C = new THREE.Vector3(pos[6], pos[7], pos[8]);
  const n = Bv.clone().sub(A).cross(C.clone().sub(A));
  if (n.dot(A.clone().add(Bv).add(C).setY(0)) < 0) {
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** ribbed amalaka of radius r, height h, standing on y=0 */
export function amalakaGeo(r: number, h: number, seg = 48) {
  const prof: THREE.Vector2[] = [new THREE.Vector2(r * 0.5, 0)];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    prof.push(new THREE.Vector2(r * 0.45 + Math.cos(a) * r * 0.55, h * 0.5 + Math.sin(a) * h * 0.5));
  }
  prof.push(new THREE.Vector2(r * 0.45, h), new THREE.Vector2(r * 0.001, h));
  const g = new THREE.LatheGeometry(prof, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rib = 1 + Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 12)), 3) * 0.08;
    p.setX(i, x * rib); p.setZ(i, z * rib);
  }
  g.computeVertexNormals();
  return g;
}

/** kalash (pot finial) of height h on y=0 */
export function kalashGeo(h: number, seg = 24) {
  const prof: [number, number][] = [[0.001, 0], [0.3, 0], [0.32, 0.05], [0.2, 0.1], [0.4, 0.28], [0.42, 0.4], [0.28, 0.55],
    [0.15, 0.6], [0.22, 0.66], [0.18, 0.7], [0.1, 0.74], [0.15, 0.82], [0.07, 0.92], [0.025, 0.99], [0.001, 1.01]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * h, y * h)), seg);
}

/** a little pointed ghanta finial (unit: width 1, height 1) */
export function ghantaGeo(seg = 6) {
  const prof: [number, number][] = [[0.5, 0], [0.48, 0.18], [0.36, 0.42], [0.22, 0.6], [0.26, 0.66], [0.14, 0.76], [0.05, 0.92], [0.001, 1]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI / seg);
}

/** horseshoe gavaksha (chaitya window) motif, unit height, facing +z, base at y=0; frame + inner field */
export function gavakshaGeo() {
  const outer = new THREE.Shape();
  const inner = new THREE.Path();
  const arc = (path: THREE.Path | THREE.Shape, w: number, h: number, start: boolean) => {
    const pts: [number, number][] = [];
    pts.push([-w, 0]);
    pts.push([-w, h * 0.42]);
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (1 - i / 16);
      const r = 1 + 0.18 * Math.sin(a); // horseshoe: bulging sides
      pts.push([Math.cos(a) * w * r, h * 0.42 + Math.sin(a) * h * 0.46]);
    }
    pts.push([0, h], [w * 0.0, h]);
    pts.push([w, h * 0.42], [w, 0]);
    pts.forEach(([x, y], i) => (i === 0 && start ? path.moveTo(x, y) : i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  };
  arc(outer, 0.42, 1, true);
  arc(inner, 0.28, 0.8, true);
  outer.holes.push(inner);
  const ring = new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: false, curveSegments: 4 });
  // a boss (bell / kalash) in the field
  const boss = new THREE.SphereGeometry(0.12, 10, 8).scale(1, 1.3, 0.5).translate(0, 0.42, 0.02);
  const base = new THREE.BoxGeometry(0.95, 0.08, 0.12).translate(0, 0.04, 0.04);
  return mergeParts([ring, boss, base]);
}

/**
 * Main shikhara. (cx, cz): centre; y0: foot of the spire body (above its skirt); hw: base half-width;
 * H: body height. Returns the y of the kalash top (flag pole foot).
 */
export function mainShikhara(B: Batch, K: NM, cx: number, cz: number, ySkirt: number, hw: number, H: number) {
  const out: { top: number; gav: Instances; mini: Instances } = { top: 0, gav: new Instances(gavakshaGeo(), K.cream), mini: new Instances(ghantaGeo(8), K.roof) };
  // skirt: a stepped square base with two rows of miniature spires and cream courses
  const sw = hw * 2 + 1.6;
  B.box(K.maroon, sw, 0.5, sw, cx, ySkirt, cz);
  B.box(K.cream, sw + 0.15, 0.12, sw + 0.15, cx, ySkirt + 0.5, cz);
  B.box(K.maroon, sw - 0.5, 0.9, sw - 0.5, cx, ySkirt + 0.62, cz);
  B.box(K.cream, sw - 0.35, 0.1, sw - 0.35, cx, ySkirt + 1.52, cz);
  B.box(K.maroon, sw - 1.0, 0.7, sw - 1.0, cx, ySkirt + 1.62, cz);
  B.box(K.cream, sw - 0.85, 0.1, sw - 0.85, cx, ySkirt + 2.32, cz);
  const rowOf = (half: number, y: number, s: number, h: number) => {
    const n = Math.max(2, Math.round((half * 2) / (s * 1.05)));
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2, nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx;
      for (let i = 0; i < n; i++) {
        const u = -half + ((i + 0.5) / n) * half * 2;
        out.mini.at(cx + nx * half + tx * u, y, cz + nz * half + tz * u, s, h, s);
      }
    }
  };
  rowOf(sw / 2 - 0.15, ySkirt + 0.62, 0.42, 0.85);
  rowOf(sw / 2 - 0.42, ySkirt + 1.62, 0.38, 0.75);

  const y0 = ySkirt + 2.42;
  const body = spireBody(16).scale(hw, H, hw);
  worldUV(body);
  body.translate(cx, y0, cz);
  B.add(K.maroon, body);
  // thin cream courses at every third bhumi (the spire's horizontal banding reads cream in sunlight)
  // cream fillets in the recesses between the rathas run the full height (the spire's vertical striping)
  for (let side = 0; side < 4; side++) for (const u of [-0.4, 0.4]) {
    const a = (side * Math.PI) / 2, nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * 0.97, w = bullet(t) * hw;
      pts.push(new THREE.Vector3(cx + nx * w * 0.93 + tx * u * w, y0 + t * H, cz + nz * w * 0.93 + tz * u * w));
    }
    B.add(K.cream, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 5, false));
  }
  // gavakshas: on the bhadra (big, 6 high) and on the pratirathas (small, 7 high), all four faces
  const place = (side: number, u: number, o: number, t: number, s: number) => {
    const a = (side * Math.PI) / 2;
    const nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx;
    const w = bullet(t) * hw;
    const d = w * (1 + o) + 0.02;
    const dt = 0.01;
    const slope = ((bullet(t + dt) - bullet(t)) * hw) / (dt * H); // dr/dy (negative)
    const tilt = Math.atan(-slope);
    const x = cx + nx * d + tx * u * w, z = cz + nz * d + tz * u * w;
    // gavaksha local +z faces outward: rotate so +z → (nx, nz)
    out.gav.at(x, y0 + t * H, z, s, s, s, Math.atan2(nx, nz), -tilt);
  };
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 6; k++) place(side, 0, 0.15, 0.06 + k * 0.145, 1.35 - k * 0.1);
    for (const u of [-0.58, 0.58]) for (let k = 0; k < 7; k++) place(side, u, 0.0, 0.05 + k * 0.125, 0.75 - k * 0.05);
  }
  // crown: neck, amalaka, chandrika, kalash
  const wt = bullet(1) * hw;
  const yN = y0 + H;
  B.lathe(K.maroon, [[wt * 0.98, 0], [wt * 0.7, 0.2], [wt * 0.62, 0.55]], cx, yN, cz, 32);
  const am = amalakaGeo(wt * 0.95, wt * 0.62).translate(cx, yN + 0.55, cz);
  B.add(K.cream, am);
  const yA = yN + 0.55 + wt * 0.62;
  B.lathe(K.cream, [[wt * 0.4, 0], [wt * 0.62, 0.12], [wt * 0.55, 0.22], [wt * 0.2, 0.3]], cx, yA, cz, 24);
  const kh = 1.7;
  B.add(K.outdoorGold, kalashGeo(kh).translate(cx, yA + 0.28, cz));
  out.top = yA + 0.28 + kh;
  return out;
}

/** small shikhara on a square base: base half-width hw, body height H; returns kalash top y */
export function smallShikhara(B: Batch, K: NM, decals: Instances, cx: number, cz: number, y: number, hw: number, H: number, face: number) {
  B.box(K.maroon, hw * 2 + 0.5, 0.9, hw * 2 + 0.5, cx, y, cz);
  B.box(K.cream, hw * 2 + 0.65, 0.1, hw * 2 + 0.65, cx, y + 0.9, cz);
  const body = spireBody(10).scale(hw, H, hw);
  worldUV(body);
  body.translate(cx, y + 1.0, cz);
  B.add(K.maroon, body);
  for (let k = 2; k < 10; k += 2) {
    const t = k / 10, w = bullet(t) * hw * 2 * 1.04;
    B.box(K.cream, w, 0.05, w, cx, y + 1.0 + t * H - 0.02, cz);
  }
  // swastika plaque on the face toward `face` (radians about y, 0 = +z)
  const t = 0.18, w = bullet(t) * hw * 1.1;
  decals.at(cx + Math.sin(face) * w, y + 1.0 + t * H + 0.2, cz + Math.cos(face) * w, 0.9, 0.9, 1, face);
  const wt = bullet(1) * hw, yN = y + 1.0 + H;
  B.add(K.cream, amalakaGeo(wt * 1.0, wt * 0.6).translate(cx, yN, cz));
  B.add(K.outdoorGold, kalashGeo(0.75).translate(cx, yN + wt * 0.6, cz));
  return yN + wt * 0.6 + 0.75;
}

/**
 * Stepped pyramidal roof with a drum: w×d base at y; drum height `drum`, pyramid height H.
 * Ghantas fringe every tier; ॐ roundels on the drum faces.
 */
export function pyramidRoof(B: Batch, K: NM, ghantas: Instances, oms: Instances, cx: number, cz: number, y: number, w: number, d: number, drum: number, H: number) {
  B.box(K.maroon, w, drum, d, cx, y, cz);
  B.box(K.cream, w + 0.12, 0.1, d + 0.12, cx, y + drum - 0.22, cz);
  B.box(K.cream, w + 0.2, 0.1, d + 0.2, cx, y + drum - 0.02, cz);
  if (drum > 0.9) {
    for (const [ox, oz, ry] of [[0, d / 2 + 0.03, 0], [0, -d / 2 - 0.03, Math.PI], [w / 2 + 0.03, 0, Math.PI / 2], [-w / 2 - 0.03, 0, -Math.PI / 2]] as const) {
      oms.at(cx + ox, y + drum * 0.45, cz + oz, Math.min(1.1, drum * 0.75), Math.min(1.1, drum * 0.75), 1, ry);
    }
  }
  const n = Math.max(4, Math.round(H / 0.6));
  const th = H / n;
  let yy = y + drum + 0.08;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const k = 1 - 0.86 * Math.pow(t, 0.92);
    const wi = w * k, di = d * k;
    B.box(K.roof, wi, th * 0.72, di, cx, yy, cz);
    B.box(K.cream, wi + 0.04, 0.05, di + 0.04, cx, yy + th * 0.72, cz);
    // ghanta fringe standing on this tier's top edge
    const kN = 1 - 0.86 * Math.pow((i + 1) / n, 0.92);
    const gs = Math.min(0.42, Math.max(0.2, (w * (k - kN)) / 2 + 0.1));
    for (const [len, axis] of [[wi, 0], [di, 1]] as const) {
      const cnt = Math.max(2, Math.floor(len / (gs * 1.08)));
      for (const sgn of [-1, 1]) {
        for (let j = 0; j < cnt; j++) {
          const u = -len / 2 + ((j + 0.5) / cnt) * len;
          const off = (axis === 0 ? di : wi) / 2 - gs * 0.45;
          if (axis === 0) ghantas.at(cx + u, yy + th * 0.72, cz + sgn * off, gs, gs * 1.4, gs);
          else ghantas.at(cx + sgn * off, yy + th * 0.72, cz + u, gs, gs * 1.4, gs);
        }
      }
    }
    yy += th;
  }
  const wt = w * 0.14;
  B.add(K.cream, amalakaGeo(Math.max(0.35, wt * 0.6), Math.max(0.3, wt * 0.45)).translate(cx, yy, cz));
  const kh = Math.max(0.6, w * 0.06);
  B.add(K.outdoorGold, kalashGeo(kh).translate(cx, yy + Math.max(0.3, wt * 0.45), cz));
  return yy;
}

export { mergeGeometries };

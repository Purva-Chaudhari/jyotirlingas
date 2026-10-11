import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { GM } from './mats';
import type { Merger } from './merge';
import { lathe, rnd, type Offerings } from './offerings';
import { boxAt, cyl } from './geo';
import { F_M, F_G, G_IN, DOOR, BODY, BHADRA } from './temple';

/**
 * The garbhagriha of Shri Ghrishneshwar and its Jyotirlinga, as seen in darshan:
 *  - a square cell 17 × 17 ft (5.2 m) whose floor lies about a metre BELOW the mandapa: one steps
 *    down through the thick east wall, so the lingam faces east, towards Nandi;
 *  - the linga is small and low (≈ 0.4 m across, ≈ 0.24 m proud): an irregular, rounded black boss
 *    worn smooth by touch, its east face smeared with orange sindoor and kumkum; devotees may touch it
 *    with bare hands;
 *  - it rises from a broad black-stone jalahari on a low dark plinth — a high rim and three concentric
 *    terraces stepping down to the linga, drawn out into a long spout to the north that curves a little
 *    east at its tip — garlanded with marigold and mogra, white chrysanthemums scattered on the stone,
 *    a band of marigold along the first terrace (photos n_o2, n_o8, n_g2);
 *  - a low brass kathada with knob-topped balusters and pierced filigree panels follows its outline;
 *  - a magenta silk drape and brass samai lamps against the west wall; soot-darkened stone above.
 * Local frame as temple.ts: lingam at the origin, +z = east (the door), +x = north (the spout).
 */

/** Jalahari outline (teardrop with the spout to +x), in metres, as (x, z) points, CCW. */
function jalahariOutline(R: number, spout: number, tipW: number, n = 72): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const a0 = Math.asin(Math.min(0.95, (tipW * 1.45) / R)); // where the spout's sides leave the round
  // round part from +a0 to 2π−a0 (going round through −x), then the straight spout sides
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI * 2 - 2 * a0);
    pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R));
  }
  const sx = Math.cos(a0) * R, sz = Math.sin(a0) * R;
  // spout: sides taper to the rounded tip
  const tipX = R + spout;
  pts.push(new THREE.Vector2(sx + (tipX - sx) * 0.5, -sz + (sz - tipW) * 0.6));
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(tipX + Math.cos(a) * tipW * 0.9, Math.sin(a) * tipW));
  }
  pts.push(new THREE.Vector2(sx + (tipX - sx) * 0.5, sz - (sz - tipW) * 0.6));
  // the spout curves a little towards the east along its length (≈10° at the tip)
  for (const p of pts) if (p.x > sx) { const t = (p.x - sx) / (tipX - sx); p.y += t * t * 0.12; }
  return pts;
}

/** distance from p to the polygon's boundary and whether p is inside */
function polyDist(poly: THREE.Vector2[], x: number, z: number) {
  let d = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((b.y > z) !== (a.y > z) && x < ((a.x - b.x) * (z - b.y)) / (a.y - b.y) + b.x) inside = !inside;
    const abx = b.x - a.x, abz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz)));
    d = Math.min(d, Math.hypot(x - (a.x + abx * t), z - (a.y + abz * t)));
  }
  return { d, inside };
}

function offsetOutline(poly: THREE.Vector2[], d: number) {
  const n = poly.length, out: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
    const e1 = new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize(), e2 = new THREE.Vector2(c.y - b.y, -(c.x - b.x)).normalize();
    const m = e1.clone().add(e2).normalize();
    const k = d / Math.max(0.35, m.dot(e1));
    out.push(b.clone().add(m.multiplyScalar(k)));
  }
  return out;
}

/** extrude an (x, z) outline (optionally with a hole) from y0 up by h */
function slab(outline: THREE.Vector2[], y0: number, h: number, hole?: THREE.Vector2[]) {
  // Shape is in (x, -z) so that rotateX(-π/2) maps it back to (x, z)
  const s = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.y)));
  if (hole) s.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, -p.y))));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2).translate(0, y0, 0);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
}

/** Linga dimensions (darshan photos n_o2, n_o8): a low oblong boss, long axis east–west. */
const LA = 0.155, LB = 0.225, LH = 0.21;

/**
 * The Jyotirlinga: a rounded oblong boss (≈0.45 m E–W × 0.3 m N–S × 0.25 m proud) with near-vertical
 * worn sides and a broad rounded back — a superquadric (boxy exponent in plan, softer in section) with a
 * little irregularity, as a stone worn smooth by centuries of hands. Base at y = 0.
 */
function lingaGeo() {
  const g = new THREE.SphereGeometry(1, 112, 40, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rho = Math.hypot(x, z), th = Math.atan2(z, x);
    const c = Math.cos(th), s = Math.sin(th);
    const R = Math.pow(rho, 0.55), Y = Math.pow(Math.max(0, y), 1.0);
    // plan: a rounded rectangle (superellipse, exponent 0.7 ≈ boxy with soft corners)
    let X = sp(c, 0.7) * R, Z = sp(s, 0.7) * R;
    const k = 1 + 0.035 * Math.sin(th * 2 + 0.6) + 0.025 * Math.sin(th * 3 + Y * 4) + 0.02 * Math.sin(th * 5 + 1.1);
    // the west (back) end a touch broader and higher than the east face
    const back = 1 - 0.06 * Math.max(-1, Math.min(1, Z));
    X *= k * back; Z *= k;
    p.setXYZ(i, X * LA, Y * LH * (1 + 0.04 * -Z) * (1 + 0.03 * Math.sin(X * 5 + 1)), Z * LB);
  }
  g.computeVertexNormals();
  return g;
}

/** a smooth noise in [-1, 1] for the paste mask */
const sn = (x: number, y: number, z: number) =>
  (Math.sin(x * 1.7 + y * 2.3 + 0.4) * Math.sin(z * 2.1 - x * 1.1 + 1.3) + Math.sin(y * 3.1 + z * 1.9 + 2.2) * 0.5) / 1.5;

/**
 * One broad, irregular sindoor patch on the east-and-top face of the linga (not stripes): a soft-edged
 * blot of orange paste, thinner (darker, the black showing through faintly) in a few broad worn patches
 * and at its margins. Unlit vertex colours with the lamplight baked in (see mats.ts).
 */
function sindoorShell(lg: THREE.BufferGeometry) {
  const src = lg.index ? lg.toNonIndexed() : lg;
  const p = src.attributes.position, n = src.attributes.normal;
  const d0 = new THREE.Vector3(0, 0.42, 0.91).normalize();
  const ref = new THREE.Vector3(1, 0, 0);
  const keep: number[] = [], nrm: number[] = [], mask: number[] = [];
  const u = new THREE.Vector3();
  const maskAt = (x: number, y: number, z: number) => {
    u.set(x / LA, y / LH, z / LB).normalize();
    const ang = Math.acos(Math.min(1, u.dot(d0)));
    const t = u.clone().sub(d0.clone().multiplyScalar(u.dot(d0)));
    const psi = Math.atan2(t.dot(new THREE.Vector3().crossVectors(d0, ref)), t.dot(ref));
    const rad = 0.5 * (1 + 0.16 * Math.sin(psi * 3 + 0.8) + 0.1 * Math.sin(psi * 5 + 2.0) + 0.05 * Math.sin(psi * 9 + 0.3));
    return 1 - ang / rad; // > 0 inside, 1 at the centre
  };
  for (let t = 0; t < p.count; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < 3; v++) { cx += p.getX(t + v) / 3; cy += p.getY(t + v) / 3; cz += p.getZ(t + v) / 3; }
    if (cy < 0.015 || maskAt(cx, cy, cz) <= 0) continue;
    for (let v = 0; v < 3; v++) {
      const x = p.getX(t + v), y = p.getY(t + v), z = p.getZ(t + v);
      const nx = n.getX(t + v), ny = n.getY(t + v), nz = n.getZ(t + v);
      keep.push(x + nx * 0.0025, y + ny * 0.0025, z + nz * 0.0025);
      nrm.push(nx, ny, nz);
      mask.push(maskAt(x, y, z));
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  const col = new Float32Array(keep.length), c = new THREE.Color(), thin = new THREE.Color(0x4a1c08);
  // baked lamplight: the samai flames to the north-east and the spot from the door, a low ambient
  const L1 = new THREE.Vector3(0.45, 0.8, 0.4).normalize(), L2 = new THREE.Vector3(0.05, 0.6, 0.8).normalize();
  for (let i = 0; i < keep.length; i += 3) {
    const x = keep[i], y = keep[i + 1], z = keep[i + 2];
    const nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
    const lit = 0.34 + 0.5 * Math.max(0, nx * L1.x + ny * L1.y + nz * L1.z) + 0.5 * Math.max(0, nx * L2.x + ny * L2.y + nz * L2.z);
    const m = mask[i / 3];
    // broad worn patches where the paste is thin, and a thin feathered margin
    const worn = Math.max(0, sn(x * 38, y * 38, z * 38) - 0.25) * 1.1 + Math.max(0, 0.22 - m) * 3.2;
    c.set(0xc8500a).lerp(new THREE.Color(0xa83204), 0.5 + 0.5 * sn(x * 90, y * 90, z * 90) * 0.6);
    c.lerp(thin, Math.min(0.75, worn)).multiplyScalar(lit);
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  shell.setAttribute('color', new THREE.BufferAttribute(col, 3));
  shell.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return shell;
}

export function buildSanctum(root: THREE.Object3D, B: Merger, K: GM, P: Physics, flames: Flames, O: Offerings): THREE.Light[] {
  const g = G_IN, F = F_G, CEIL = 4.2;
  // ---------- the cell: polished dark floor flags, ashlar walls with pilasters, a corbelled ceiling ----------
  B.span(K.gFloor, -g, 0, -g, g, F, g);
  const wz = -g; // west wall face
  const NX = 0.4, NY0 = F + 1.0, NY1 = F + 2.1, ND = 0.32; // the Parvati niche in the west wall
  // north and south wall faces
  B.span(K.gStone, g, F, -g, g + 0.1, CEIL, g);
  B.span(K.gStone, -g - 0.1, F, -g, -g, CEIL, g);
  // west wall, round the niche opening
  B.span(K.gStone, -g, F, wz - 0.1, -NX, CEIL, wz);
  B.span(K.gStone, NX, F, wz - 0.1, g, CEIL, wz);
  B.span(K.gStone, -NX, F, wz - 0.1, NX, NY0, wz);
  B.span(K.gStone, -NX, NY1, wz - 0.1, NX, CEIL, wz);
  // east wall, round the door
  B.span(K.gStone, -g, F, g, -DOOR.half, CEIL, g + 0.1);
  B.span(K.gStone, DOOR.half, F, g, g, CEIL, g + 0.1);
  B.span(K.gStone, -DOOR.half, DOOR.top, g, DOOR.half, CEIL, g + 0.1);
  // moulded skirting (two fasciae) and a cornice course under the corbelling
  for (const [x0, z0, x1, z1] of [[g - 0.12, -g, g, g], [-g, -g, -g + 0.12, g], [-g, -g, g, -g + 0.12]] as const) {
    B.span(K.gSoot, x0, F, z0, x1, F + 0.2, z1);
  }
  for (const [x0, z0, x1, z1] of [[g - 0.07, -g, g, g], [-g, -g, -g + 0.07, g], [-g, -g, g, -g + 0.07]] as const) {
    B.span(K.gStone, x0, F + 0.2, z0, x1, F + 0.3, z1);
  }
  for (const [x0, z0, x1, z1] of [[g - 0.14, -g, g, g], [-g, -g, -g + 0.14, g], [-g, -g, g, -g + 0.14], [-g, g - 0.14, -DOOR.half - 0.2, g], [DOOR.half + 0.2, g - 0.14, g, g]] as const) {
    B.span(K.gStone, x0, CEIL - 0.22, z0, x1, CEIL - 0.08, z1);
    B.span(K.gSoot, x0, CEIL - 0.08, z0, x1, CEIL, z1);
  }
  // pilasters, two on each wall (0.3 m wide, 8 cm proud): moulded base, shaft with a mid band,
  // a capital and a bracket (potika) carrying the cornice
  const pilaster = (x: number, z: number, nx: number, nz: number) => {
    // (nx, nz) = the wall's inward normal; u runs along the wall
    const along = nx !== 0;
    const put = (m: THREE.Material, w: number, d: number, y0: number, y1: number) => {
      const cx = x + nx * d / 2, cz = z + nz * d / 2;
      B.add(m, boxAt(along ? d : w, y1 - y0, along ? w : d, cx, y0, cz));
    };
    put(K.gStone, 0.42, 0.16, F, F + 0.32);
    put(K.gStone, 0.36, 0.12, F + 0.32, F + 0.42);
    put(K.gStone, 0.3, 0.08, F + 0.42, CEIL - 0.5);
    put(K.gStone, 0.34, 0.11, F + 1.55, F + 1.7);
    put(K.gStone, 0.34, 0.11, CEIL - 0.9, CEIL - 0.78);
    put(K.gStone, 0.38, 0.13, CEIL - 0.5, CEIL - 0.38);
    put(K.gSoot, 0.56, 0.2, CEIL - 0.38, CEIL - 0.22);
  };
  for (const u of [-1.3, 1.3]) { pilaster(g, u, -1, 0); pilaster(-g, u, 1, 0); }
  for (const u of [-1.45, 1.45]) { pilaster(u, wz, 0, 1); pilaster(u, g, 0, -1); }
  // corbelled ceiling: three square rings each stepping in 0.3 m and up 0.25 m, dentils on their lips,
  // a flat slab, and a hanging lotus boss
  for (let k = 0; k < 3; k++) {
    const y0 = CEIL + k * 0.25, h = g - 0.3 * (k + 1);
    for (const [x0, z0, x1, z1] of [[h, -g, g + 0.1, g], [-g - 0.1, -g, -h, g], [-h, -g - 0.1, h, -h], [-h, h, h, g + 0.1]] as const) {
      B.span(K.gSoot, x0, y0, z0, x1, y0 + 0.25, z1);
    }
    const dent = boxAt(0.07, 0.06, 0.07, 0, 0, 0);
    for (let t = -h + 0.12; t <= h - 0.12; t += 0.24) {
      const e = h + 0.06;
      for (const [x, z] of [[t, -e], [t, e], [-e, t], [e, t]] as const) B.place(K.gSoot, dent, x, y0 - 0.06, z);
    }
  }
  B.span(K.gSoot, -g - 0.1, CEIL + 0.75, -g - 0.1, g + 0.1, CEIL + 0.95, g + 0.1);
  B.place(K.gSoot, lathe([[0, 0], [0.5, 0], [0.46, -0.05], [0.5, -0.08], [0.36, -0.14], [0.4, -0.17], [0.22, -0.24], [0.1, -0.3], [0.04, -0.36], [0, -0.38]], 32, 16, 0.12), 0, CEIL + 0.75, 0);

  // ---------- the passage down from the antarala ----------
  const dz = BODY + BHADRA, N = 6, rise = (F_M - F) / N, run = (dz - 0.5 - g) / N;
  for (let i = 0; i < N; i++) {
    const top = F_M - rise * (i + 1), z1 = dz - i * run, z0 = z1 - run;
    B.span(K.redDark, -DOOR.half, 0, z0, DOOR.half, top, z1);
    P.floor(root, -DOOR.half, DOOR.half, z0, z1, top);
  }
  B.span(K.redDark, -DOOR.half, 0, g, DOOR.half, F, g + 0.5);
  P.floor(root, -DOOR.half, DOOR.half, g - 0.2, g + 0.5, F);
  for (const s of [-1, 1]) B.span(K.red, s > 0 ? DOOR.half : -DOOR.half - 0.1, F, g, s > 0 ? DOOR.half + 0.1 : -DOOR.half, DOOR.top, dz);
  B.span(K.soot, -DOOR.half, DOOR.top, g, DOOR.half, DOOR.top + 0.1, dz);
  // a brass-clad threshold step into the cell, and the silver-sheathed door frame (repoussé bands)
  B.span(K.brass, -DOOR.half, F, g - 0.02, DOOR.half, F + 0.03, g + 0.12);
  for (const s of [-1, 1]) {
    B.span(K.silver, s > 0 ? DOOR.half : -DOOR.half - 0.16, F, g - 0.05, s > 0 ? DOOR.half + 0.16 : -DOOR.half, DOOR.top + 0.16, g);
    for (let y = F + 0.3; y < DOOR.top; y += 0.42) B.span(K.brass, s > 0 ? DOOR.half + 0.02 : -DOOR.half - 0.14, y, g - 0.07, s > 0 ? DOOR.half + 0.14 : -DOOR.half - 0.02, y + 0.06, g - 0.04);
  }
  B.span(K.silver, -DOOR.half - 0.16, DOOR.top, g - 0.05, DOOR.half + 0.16, DOOR.top + 0.2, g);
  B.span(K.brass, -DOOR.half - 0.2, DOOR.top + 0.2, g - 0.08, DOOR.half + 0.2, DOOR.top + 0.26, g);
  // two brass bells hung at the doorway
  const bell = lathe([[0, 0], [0.075, 0], [0.07, 0.02], [0.05, 0.08], [0.04, 0.13], [0.02, 0.15], [0, 0.155]], 16);
  for (const s of [-1, 1]) {
    B.place(K.brass, bell, s * 0.38, DOOR.top - 0.55, g - 0.25);
    B.add(K.brass, cyl(0.004, 0.004, 0.42, 4, s * 0.38, DOOR.top - 0.4, g - 0.25));
  }

  // cell floor walkable (but not over the jalahari)
  P.floor(root, -g, g, -g, g, F);

  // ---------- the Jyotirlinga (photos n_o2, n_o8, n_g2 from the temple's own priests' sites) ----------
  // jalahari: a dark plinth, then the black-stone yoni with a high rim and three concentric terraces
  // stepping down towards the linga; a long spout curving a little to the east at its tip.
  const R = 0.7, SP = 0.7, outline = jalahariOutline(R, SP, 0.26);
  const off = (d: number) => offsetOutline(outline, d);
  const J0 = F + 0.15; // basin floor (top of the plinth)
  B.add(K.blackStone, slab(off(0.09), F, 0.15));
  B.add(K.blackStone, slab(outline, J0, 0.2, off(-0.1)));
  B.add(K.blackStone, slab(off(-0.1), J0, 0.13, off(-0.2)));
  B.add(K.blackStone, slab(off(-0.2), J0, 0.065, off(-0.29)));
  B.place(K.blackStone, cyl(0.07, 0.08, 0.06, 16, 0, 0, 0), R + SP + 0.18, J0 + 0.02, 0.05);
  /** height of the jalahari's surface at (x, z) */
  const surf = (x: number, z: number) => {
    const { inside, d } = polyDist(outline, x, z);
    if (!inside) return F;
    return d < 0.1 ? J0 + 0.2 : d < 0.2 ? J0 + 0.13 : d < 0.29 ? J0 + 0.065 : J0;
  };

  // the linga: black, oblong, worn smooth; one broad sindoor patch on its east face
  const lg = lingaGeo();
  const lingam = new THREE.Mesh(lg, K.lingam);
  lingam.position.set(0, J0, 0);
  lingam.castShadow = lingam.receiveShadow = true;
  root.add(lingam);
  const shell = sindoorShell(lg);
  shell.translate(0, J0, 0);
  root.add(new THREE.Mesh(shell, K.sindoor));

  // the figure-8 marigold garland (n_o2): one loop hugging the foot of the linga, crossing behind it, a
  // second loop draped west over the terraces; marigold rope with stretches of white chrysanthemum,
  // a pink rose where it crosses. A ruffled tube under instanced flower heads.
  {
    const pts: THREE.Vector3[] = [];
    const n = 120;
    const A = { cx: 0, cz: 0.0, ax: LA + 0.07, az: LB + 0.07 };
    const Bl = { cx: 0.04, cz: -0.5, ax: 0.17, az: 0.19 };
    for (let i = 0; i < n; i++) { // loop A: from the west point, round by the north, east, south
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(A.cx + Math.sin(a) * A.ax, 0, A.cz - Math.cos(a) * A.az));
    }
    for (let i = 0; i < n; i++) { // loop B, the other way round, from its east point
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(Bl.cx + Math.sin(a) * Bl.ax, 0, Bl.cz + Math.cos(a) * Bl.az));
    }
    // lie on the stone: the surface height under each point, then a running max + blur so the rope
    // drapes over the terrace edges instead of cutting through them
    const tr = 0.035;
    const h0 = pts.map((p) => surf(p.x, p.z) + tr * 0.85);
    const h1 = h0.map((_, i) => { let m = -1; for (let k = -4; k <= 4; k++) m = Math.max(m, h0[(i + k + h0.length) % h0.length]); return m; });
    const h2 = h1.map((_, i) => { let s2 = 0; for (let k = -3; k <= 3; k++) s2 += h1[(i + k + h1.length) % h1.length]; return s2 / 7; });
    pts.forEach((p, i) => { p.y = Math.max(h0[i], h2[i]); });
    // where loop B passes over loop A behind the linga, lift it
    for (let i = n - 6; i < n + 6; i++) pts[(i + 2 * n) % (2 * n)].y += 0.035 * Math.cos(((i - n) / 6) * Math.PI / 2);
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const TS = 360, RS = 12;
    const tube = new THREE.TubeGeometry(curve, TS, tr, RS, true);
    const tp = tube.attributes.position, tn = tube.attributes.normal;
    const cols = new Float32Array(tp.count * 3), c = new THREE.Color();
    for (let i = 0; i < tp.count; i++) {
      const ring = Math.floor(i / (RS + 1)), j = i % (RS + 1);
      const k = 1 + 0.22 * Math.sin(ring * 2.3 + j * 1.9) * Math.sin(ring * 0.9 + j * 2.7) + 0.1 * Math.sin(ring * 5.1);
      tp.setXYZ(i, tp.getX(i) + tn.getX(i) * tr * (k - 1), tp.getY(i) + tn.getY(i) * tr * (k - 1), tp.getZ(i) + tn.getZ(i) * tr * (k - 1));
      const t = ring / TS;
      const white = (t * 22) % 1 < 0.16;
      c.set(white ? 0xe8e4d8 : (Math.sin(ring * 1.7 + j) > 0.2 ? 0xe89400 : 0xd87800));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    tube.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tube.computeVertexNormals();
    const gm = new THREE.Mesh(tube, K.garland);
    gm.receiveShadow = true;
    root.add(gm);
    // flower heads on the rope
    const L = curve.getLength(), step = 0.028;
    for (let s2 = 0; s2 < L; s2 += step) {
      const t = s2 / L, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const white = (t * 22) % 1 < 0.16;
      for (const [o, up] of [[0, 1], [0.6, 0.55], [-0.6, 0.55]] as const) {
        const q = p.clone().addScaledVector(side, o * tr).add(new THREE.Vector3(0, up * tr * 0.8, 0));
        if (white) O.add('chrys', q.x, q.y, q.z, 0.75);
        else O.add('marigold', q.x, q.y, q.z, 1.05, rnd() < 0.55 ? 0xf09a00 : rnd() < 0.5 ? 0xf8b000 : 0xe07c00);
      }
    }
    for (const [x, z] of [[0.05, -0.31], [-0.02, -0.29], [0.2, 0.18]] as const) O.add('rose', x, surf(x, z) + 0.07, z, 1.3, rnd() < 0.5 ? 0xd0205a : 0xc0102a);
  }
  // ≈12 loose white chrysanthemum heads scattered on the black terraces
  for (let k = 0, tries = 0; k < 13 && tries < 400; tries++) {
    const x = -R + rnd() * (R * 2 + SP), z = (rnd() - 0.5) * R * 2;
    const { inside } = polyDist(outline, x, z);
    if (!inside || Math.hypot(x / (LA + 0.12), z / (LB + 0.12)) < 1.2 || Math.hypot((x - 0.04) / 0.26, (z + 0.5) / 0.28) < 1) continue;
    O.add('chrys', x, surf(x, z) + 0.008, z, 1.15);
    k++;
  }
  for (let k = 0; k < 24; k++) {
    const x = -R + rnd() * (R * 2 + SP), z = (rnd() - 0.5) * R * 2;
    if (!polyDist(outline, x, z).inside) continue;
    O.add('petal', x, surf(x, z) + 0.003, z, 0.8, 0xfaf6ec, rnd() * 6.3, 0.4);
  }
  // a few bel leaves at the linga's east foot
  for (let i = 0; i < 3; i++) O.add('bel', -0.06 + i * 0.06, J0 + 0.012, LB + 0.13, 1.1, undefined, 1.6 + i * 0.4, 0.4);
  // two husked coconuts either side of the linga, and a few rupee notes (as offered, n_o2)
  {
    const nut = new THREE.IcosahedronGeometry(1, 3);
    const np = nut.attributes.position;
    for (let i = 0; i < np.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(np, i);
      const a = Math.atan2(v.z, v.x);
      const fib = 1 + 0.05 * Math.sin(a * 23 + v.y * 6) + 0.03 * Math.sin(a * 57 - v.y * 14);
      v.multiplyScalar(fib);
      if (v.y > 0.6) { v.x *= 0.85; v.z *= 0.85; }
      np.setXYZ(i, v.x * 0.085, v.y * 0.075, v.z * 0.12);
    }
    nut.deleteAttribute('uv'); nut.deleteAttribute('normal');
    const ng = nut.toNonIndexed(); ng.computeVertexNormals();
    for (const [x, z, ry] of [[0.36, 0.05, 1.4], [-0.36, -0.02, 1.7]] as const) {
      B.place(K.coir, ng, x, J0 + 0.07, z, ry);
    }
    const note = (w: number, mat: THREE.Material, x: number, y: number, z: number, ry: number) => {
      const gg = new THREE.PlaneGeometry(w, w * 0.45).rotateX(-Math.PI / 2).rotateZ(0.08).toNonIndexed();
      gg.deleteAttribute('uv');
      B.place(mat, gg, x, y, z, ry);
    };
    note(0.13, K.note10, 0.33, J0 + 0.135, 0.3, 0.4);
    note(0.13, K.note20, -0.12, J0 + 0.07, 0.42, -0.3);
  }
  O.scatter(-1.8, 1.8, -1.8, 1.8, F + 0.002, 18, 0.45);
  P.solid(-R - 0.18, F, -R - 0.18, R + SP + 0.45, F + 1.0, R + 0.18);

  // ---------- the brass kathada: balusters with big knob finials, pierced filigree panels between rails ----------
  const rail = off(0.2);
  // turned brass balusters (n_o2): a moulded foot, a slim shaft with two collars, a small crisp ball finial
  const post = lathe([[0, 0], [0.026, 0], [0.026, 0.012], [0.018, 0.02], [0.012, 0.035], [0.012, 0.3], [0.02, 0.305], [0.02, 0.322], [0.012, 0.328],
    [0.012, 0.345], [0.017, 0.35], [0.017, 0.356], [0.009, 0.362],
    ...Array.from({ length: 9 }, (_, i): [number, number] => { const a = -Math.PI / 2 + (i + 1) / 9 * Math.PI; return [Math.max(0.0005, Math.cos(a) * 0.026), 0.388 + Math.sin(a) * 0.026]; })], 16);
  const railPts: THREE.Vector3[] = [];
  let acc = 0;
  for (let i = 0; i < rail.length; i++) {
    const a = rail[i], b = rail[(i + 1) % rail.length];
    const len = a.distanceTo(b);
    for (let t = 0; t < len; t += 0.02) {
      const p = a.clone().lerp(b, t / len);
      // leave an opening on the east side (towards the door) where devotees reach in to touch the linga
      const open = p.y > 0.3 && Math.abs(p.x) < 0.26;
      if (!open) {
        if (acc <= 0) { B.place(K.railBrass, post, p.x, F, p.y); acc = 0.3; }
        railPts.push(new THREE.Vector3(p.x, F, p.y));
      } else {
        railPts.push(new THREE.Vector3(NaN, 0, 0));
      }
      acc -= 0.02;
    }
  }
  const seg: THREE.BufferGeometry[] = [];
  const panelPos: number[] = [], panelUv: number[] = [];
  let u = 0;
  for (let i = 0; i < railPts.length; i++) {
    const a = railPts[i], b = railPts[(i + 1) % railPts.length];
    if (Number.isNaN(a.x) || Number.isNaN(b.x)) continue;
    for (const y of [0.33, 0.07]) {
      const c = new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b) + 0.004, 6);
      c.applyMatrix4(new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      c.translate((a.x + b.x) / 2, F + y, (a.z + b.z) / 2);
      const n = c.toNonIndexed(); n.deleteAttribute('uv');
      seg.push(n);
    }
    // filigree ribbon between the rails
    const du = a.distanceTo(b) / 0.32;
    const y0 = F + 0.08, y1 = F + 0.32;
    panelPos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y0, a.z, b.x, y1, b.z, a.x, y1, a.z);
    panelUv.push(u, 0, u + du, 0, u + du, 1, u, 0, u + du, 1, u, 1);
    u += du;
  }
  B.add(K.railBrass, mergeGeometries(seg, false)!);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(panelPos, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(panelUv, 2));
  pg.computeVertexNormals();
  const panels = new THREE.Mesh(pg, K.filigree);
  panels.castShadow = true;
  root.add(panels);

  // ---------- west wall: the niche of Parvati (a brass mukhavata mask on a draped form) ----------
  // the recess, its moulded stone surround and silver inner frame, a small pediment
  B.span(K.gSoot, -NX, NY0, wz - ND - 0.06, NX, NY1, wz - ND);
  B.span(K.gStone, -NX - 0.06, NY0 - 0.02, wz - ND, -NX, NY1, wz);
  B.span(K.gStone, NX, NY0 - 0.02, wz - ND, NX + 0.06, NY1, wz);
  B.span(K.gSoot, -NX, NY1, wz - ND, NX, NY1 + 0.06, wz);
  B.span(K.gStone, -NX - 0.05, NY0 - 0.06, wz - ND, NX + 0.05, NY0, wz + 0.12); // sill
  for (const s of [-1, 1]) {
    B.span(K.gStone, s > 0 ? NX : -NX - 0.18, NY0 - 0.06, wz, s > 0 ? NX + 0.18 : -NX, NY1 + 0.1, wz + 0.07);
    B.span(K.silver, s > 0 ? NX - 0.05 : -NX, NY0, wz - 0.01, s > 0 ? NX : -NX + 0.05, NY1, wz + 0.03);
  }
  B.span(K.silver, -NX, NY1 - 0.05, wz - 0.01, NX, NY1, wz + 0.03);
  B.span(K.gStone, -NX - 0.22, NY1 + 0.1, wz, NX + 0.22, NY1 + 0.22, wz + 0.12);
  B.span(K.gStone, -NX - 0.16, NY1 + 0.22, wz, NX + 0.16, NY1 + 0.3, wz + 0.08);
  B.span(K.gStone, -NX - 0.1, NY1 + 0.3, wz, NX + 0.1, NY1 + 0.42, wz + 0.05);
  B.span(K.gStone, -NX - 0.1, NY0 - 0.42, wz, NX + 0.1, NY0 - 0.06, wz + 0.06); // a corbel under the sill
  {
    // Parvati: a draped standing form (green silk, gold border) with a brass mask and crown
    const zc = wz - ND + 0.14, y0 = NY0;
    B.place(K.parvatiSaree, lathe([[0.001, 0], [0.17, 0], [0.16, 0.08], [0.12, 0.3], [0.105, 0.48], [0.12, 0.6], [0.09, 0.68], [0.045, 0.71], [0.001, 0.71]], 20), 0, y0, zc, 0, [1.15, 1, 0.7]);
    B.place(K.brass, lathe([[0.001, 0.0], [0.175, 0], [0.18, 0.02], [0.165, 0.035], [0.001, 0.035]], 20), 0, y0, zc, 0, [1.15, 1, 0.75]);
    // the mask: a smooth oval face (no features), the crown (mukut) with a lotus finial
    const face = new THREE.SphereGeometry(1, 20, 14, -Math.PI / 2, Math.PI).scale(0.075, 0.095, 0.045);
    B.place(K.brass, face, 0, y0 + 0.8, zc + 0.01);
    B.place(K.brass, lathe([[0.001, 0], [0.07, 0], [0.085, 0.04], [0.06, 0.1], [0.045, 0.14], [0.02, 0.17], [0.03, 0.19], [0.001, 0.21]], 16, 8, 0.12), 0, y0 + 0.86, zc);
    B.place(K.gold, new THREE.TorusGeometry(0.12, 0.012, 6, 24), 0, y0 + 0.8, zc - 0.02);
    // a nose-ring and necklace glints in gold; a small garland
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 14));
      O.add(i % 4 === 2 ? 'mogra' : 'marigold', Math.cos(a) * 0.12, y0 + 0.66 - Math.sin(a) * 0.14, zc + 0.08, 0.8, i % 2 ? 0xffa800 : 0xe87a00);
    }
  }
  // the magenta silk curtain on a brass rod, drawn back into two gathered bunches
  B.add(K.brass, cyl(0.012, 0.012, NX * 2 + 0.1, 6, 0, 0, 0).rotateZ(Math.PI / 2).translate(0, NY1 - 0.08, wz + 0.05));
  for (const s of [-1, 1]) {
    const dr = new THREE.PlaneGeometry(0.22, 1.02, 10, 6);
    const dp = dr.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), y = dp.getY(i), t = (0.51 - y) / 1.02; // t: 0 at the rod, 1 at the hem
      // pleats, gathered tighter at the tie-back (t ≈ 0.55) and flaring below
      const pinch = 1 - 0.55 * Math.exp(-((t - 0.55) ** 2) / 0.02);
      dp.setXYZ(i, x * pinch - s * t * 0.04, y, Math.sin(x * 60) * 0.018 * pinch + 0.02);
    }
    dr.computeVertexNormals();
    const d2 = dr.toNonIndexed(); d2.deleteAttribute('uv');
    B.place(K.silk, d2, s * (NX - 0.1), NY1 - 0.6, wz + 0.04);
    B.place(K.gold, new THREE.TorusGeometry(0.05, 0.008, 5, 12).rotateX(Math.PI / 2), s * (NX - 0.1 - s * 0.02), NY1 - 0.65, wz + 0.05);
  }
  // diyas on the sill
  const diya = lathe([[0, 0], [0.05, 0], [0.07, 0.025], [0.065, 0.035], [0, 0.03]], 12);
  for (const x of [-NX + 0.06, NX - 0.06]) {
    B.place(K.brass, diya, x, NY0, wz + 0.05);
    flames.points.push(new THREE.Vector3(x, NY0 + 0.045, wz + 0.05));
  }

  // ---------- brass samai either side of the spout (out of the walk round the cell) ----------
  const samai = lathe([[0, 0], [0.17, 0], [0.15, 0.04], [0.06, 0.08], [0.035, 0.12], [0.03, 0.9], [0.05, 0.94], [0.16, 1.0], [0.17, 1.03], [0.14, 1.04], [0.03, 1.06], [0.025, 1.2], [0.05, 1.24], [0, 1.27]], 18);
  const samaiAt: [number, number][] = [[R + SP - 0.02, 0.72], [R + SP - 0.02, -0.72]];
  for (const [x, z] of samaiAt) {
    B.place(K.brass, samai, x, F, z);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.13, F + 1.06, z + Math.sin(a) * 0.13));
    }
    P.solid(x - 0.17, F, z - 0.17, x + 0.17, F + 1.3, z + 0.17);
  }
  // a hanging brass lamp (lamandiva) on a chain over the north side of the jalahari
  {
    const hx = 0.95, hz = 0.0, hy = F + 2.35;
    B.add(K.iron, cyl(0.005, 0.005, CEIL + 0.75 - hy, 4, hx, hy, hz));
    B.place(K.brass, lathe([[0.001, 0], [0.04, 0.0], [0.12, 0.05], [0.14, 0.08], [0.12, 0.085], [0.04, 0.06], [0.001, 0.06]], 18), hx, hy - 0.08, hz);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(hx + Math.cos(a) * 0.12, hy + 0.0, hz + Math.sin(a) * 0.12));
    }
  }

  // ---------- light: dark room, the key light on the linga from the lamps ----------
  // flickering lamp glow (non-shadowing points), ≈30 % dimmer than before
  for (const [x, y, z, i] of [[R + SP, F + 1.3, 0.72, 1.6], [R + SP, F + 1.3, -0.72, 1.6], [0.95, F + 2.25, 0, 1.4], [0, NY0 + 0.3, wz + 0.4, 0.8]] as const) {
    const l = new THREE.PointLight(0xffc890, i, 5, 1.6);
    l.position.set(x, y, z);
    root.add(l);
    flames.lights.push(l);
  }
  // a faint glow high in the cell so the soot-black corbelling still reads
  const high = new THREE.PointLight(0xffd8b0, 2.4, 4.5, 1.1);
  high.position.set(0, CEIL - 0.3, 0);
  root.add(high);
  // a weak neutral fill from the doorway (daylight off the antarala steps)
  const fill = new THREE.PointLight(0xfff0e0, 1.6, 7, 1.5);
  fill.position.set(0, F + 2.6, G_IN - 0.3);
  root.add(fill);
  // the warm key: a spot on the linga (35°)
  const key = new THREE.SpotLight(0xffc488, 6.5, 6, THREE.MathUtils.degToRad(35) / 2 + 0.17, 0.7, 1.4);
  key.position.set(0.5, F + 2.7, 1.3);
  key.target.position.set(0, J0 + 0.15, 0);
  root.add(key, key.target);
  // bounce: lamplight off the stone, so the ashlar, pilasters and niche read at mid-dark (darshan photos)
  const bounce = new THREE.HemisphereLight(0xffcf9a, 0x7a5640, 1.9);
  bounce.position.set(0, F + 2, 0);
  root.add(bounce);
  const wallFill: THREE.PointLight[] = [];
  for (const [x, z] of [[-1.6, -1.6]] as const) {
    const l = new THREE.PointLight(0xffc890, 1.1, 4.2, 1.2);
    l.position.set(x, F + 2.9, z);
    root.add(l);
    wallFill.push(l);
  }
  const lights: THREE.Light[] = [high, fill, key, bounce, ...wallFill, ...flames.lights.slice(-4)];
  // a little milk/water sheen pooled in the spout
  B.place(K.wetFloor, cyl(0.07, 0.07, 0.004, 12, 0, 0, 0), R + SP - 0.05, J0 + 0.002, 0.09);
  // a brass abhishek pot and thali of bel by the door, where the priests sit
  B.place(K.brass, lathe([[0, 0], [0.22, 0], [0.24, 0.02], [0.22, 0.03], [0, 0.02]], 24), 1.3, F, 1.6);
  O.heap(1.3, F + 0.03, 1.6, 0.16, 0.07, 26);
  B.place(K.brass, lathe([[0, 0], [0.08, 0], [0.13, 0.08], [0.12, 0.16], [0.06, 0.2], [0.05, 0.24], [0.07, 0.26], [0, 0.26]], 18), 1.5, F, 1.9);
  return lights;
}

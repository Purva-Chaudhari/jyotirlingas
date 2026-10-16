import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { quality, thin } from './profile';

/**
 * Pilgrims: the shared crowd kit for every site.
 *
 *  buildCrowd(root, spots, opts) → { mesh, blobs, count, update(t) }
 *
 * Figures are procedural low-poly people at true scale, with the head ≈ 1/7.5 of the height. They are
 * swept and lofted, not capsules:
 *  - **Torso**: a superellipse loft with chest, waist and hip shaping and sloped shoulders.
 *  - **Limbs**: tapered sweeps through IK'd joints (deltoid, biceps, forearm, thigh, knee, calf, ankle).
 *  - **Hands and feet**: mitten hands with a thumb, and feet with heel, arch and toes.
 *  - **Head**: given a jaw, chin, brow, a nose bump and ears, as shape only (no painted features).
 * Clothing:
 *  - **Women**: a saree with front pleats, a gold or contrast border, a fitted blouse with bare midriff and
 *    the pallu across the chest, over the left shoulder and down the back (sometimes over the head);
 *    salwar-kameez with a dupatta; a half-saree (south).
 *  - **Men**: kurta-pyjama, shirt-trousers, a dhoti with a bare chest, angavastram and sacred thread,
 *    saffron kanwariya dress; veshti (south); padded jacket and cap, sadhu robe and blanket (mountain).
 *  - **Elders and children**: elders stoop and have grey hair; children are 1.1–1.3 m.
 *  - **Hair**: a bun, a braid, short, tonsured or sandal-pasted; mountain wear adds knitted caps and shawls.
 * Poses: standing, walking mid-stride, namaste, holding a puja thali, carrying a bag, arms raised, carrying a
 * kanwar, seated cross-legged (hands on knees or in namaste) and seated on a step.
 *
 * Rendering: one BatchedMesh draw for all figures (three LODs: ≈3–4k tris near, ≈1k mid, ≈300 far) plus
 * one merged draw of soft contact shadows. Each vertex carries a palette slot and baked AO (armpits,
 * under the chin, between the legs, near the ground). An 8-colour palette per instance lives in a float
 * texture. The shader adds a fabric sheen at grazing angles, faint weave noise and a tiny idle sway. Call
 * update(t) every frame. No colliders, no shadow casting.
 */

export type Kind = 'saree' | 'kurta' | 'kanwariya';
export type Outfit = 'plains' | 'mountain' | 'south';
export type Pose = 'stand' | 'walk' | 'namaste' | 'thali' | 'bag' | 'raised' | 'kanwar' | 'sit' | 'sitNamaste' | 'step';

export interface CrowdSpot {
  x: number;
  y: number;
  z: number;
  /** facing (radians about y; 0 = +z) */
  ry: number;
  sit?: boolean;
  /** force a type: 'saree' (a woman) | 'kurta' (a man) | 'kanwariya' */
  kind?: Kind;
  /** force a pose ('step' sits on a ledge whose top is at y, feet 0.42 m lower) */
  pose?: Pose;
  /** soaked clothes (bathers): darker, glossier */
  wet?: boolean;
  /** pose suggested by a queue (the figure's own type may still override it, e.g. a kanwar) */
  queue?: Pose;
}

export interface CrowdOpts {
  /** polylines (x,z) the player walks: no figure within clearRadius of them */
  clearPaths?: [number, number][][];
  clearRadius?: number;
  /** polylines walked close beside people who must stay (a queue alongside): kept clear only within nearRadius */
  nearPaths?: [number, number][][];
  nearRadius?: number;
  seed?: number;
  /** distance beyond which figures use the ≈300-tri kit (default 25 m) */
  lodDistance?: number;
  /** distance within which figures use the full ≈3.5k-tri kit (default 9 m, never above lodDistance) */
  nearDistance?: number;
  /** share of standing men who are kanwariyas (default 0.45) */
  kanwariyaShare?: number;
  /** regional dress (default 'plains') */
  outfit?: Outfit;
  /** share of standing figures who are children (default 0.08) and elders (default 0.1) */
  childShare?: number;
  elderShare?: number;
}

// ---------------------------------------------------------------- palettes (sRGB)

const SKIN = [0x8d5524, 0x9a6235, 0xa86f42, 0x7a4a2a, 0xb07a4f, 0x6b4226, 0xc08457, 0x93603a];
const HAIR = [0x0e0b0a, 0x15110f, 0x1c1714, 0x221a14];
const GREY = [0x8a8682, 0xa8a49e, 0xc8c4bc, 0xdcd8d0, 0x6e6a66];
const SAREE = [0xc8102e, 0xd2551a, 0xc2185b, 0xe0a020, 0x6a1b9a, 0x1f5fa8, 0x2e7d32, 0x9a1b1b, 0xe0607e, 0x00796b, 0xe8b820, 0x7a1838, 0x4f5cb0, 0xd86a50, 0xe8701a, 0xf0e6d0];
const BORDER = [0xd4a017, 0xc9a227, 0xb81d24, 0x1b5e20, 0xe8c45a, 0x2a1a5e, 0xd4a017];
const SALWAR = [0xf2b8c8, 0x7cc4bc, 0xf4e48a, 0x9aa4d8, 0xdcb8e0, 0xf8c0a8, 0xbcd8a0, 0x58b4e0, 0xc62828, 0xf4f0ea, 0x283593, 0xa8144e, 0xe86a1a, 0x2a7a6a];
const KURTA = [0xf3f0e8, 0xf6f3ec, 0xefe8d8, 0xe8701a, 0xe8b820, 0x9cc4e8, 0xb8a89c, 0x7a5a48, 0xb03030, 0xf0ece0, 0xd8c8a0];
const PYJAMA = [0xf3f0e8, 0xebe8e0, 0xd8d0c4, 0xf6f3ec];
const SHIRT = [0xf6f6f2, 0x9cc4e8, 0xb4bec8, 0xe0e0dc, 0x8a6e60, 0xc4cae8, 0xa8d4a8, 0x3a4a58, 0xf4ead8, 0xe0a0a0, 0x2a68b0, 0x6a3a5a];
const TROUSER = [0x34404a, 0x262e36, 0x4a3a30, 0x5a4a3c, 0x222224, 0x546470, 0x7a6a58, 0x2c3e66, 0x3a3a3e];
const DHOTI = [0xf6f2e6, 0xf2ecdc, 0xfaf6ea, 0xe8701a, 0xf8f0d8, 0xe0d4b8];
const SAFFRON = [0xe8560f, 0xf07a1a, 0xe24a0a, 0xf28a1c, 0xd8400c, 0xf06a12, 0xe8731a, 0xd65a12];
const GAMCHHA = [0xd8301a, 0xf0d040, 0xe8560f, 0xf4f0e8, 0xc81830];
// mountain (Kedarnath at 3,583 m): darker sarees, woollen shawls, padded jackets, knitted caps
const M_SAREE = [0x7a2234, 0x8e2420, 0x2a3a5e, 0x4e2e4e, 0x6a2a3a, 0x3a4e3a, 0xa04a1c, 0x5e463a, 0x6a1e22, 0x2e4466, 0xb8325a];
const SHAWL = [0x6a2430, 0x8a7a68, 0x4a4040, 0xc8bca8, 0x7a2a20, 0x5a4a3a, 0x9a3a2a, 0x3e4450, 0xb0a490, 0x5a3a48, 0x8a8a84];
const JACKET = [0x1c2430, 0x2a2a2e, 0x6a1e22, 0x24344e, 0x3a3f36, 0x8a2a24, 0x45484c, 0x1f3a5a, 0x5a4636, 0xa83a2a, 0x2e3a2e, 0x16181c, 0xc84a1a];
const CAP = [0x6a1e22, 0x2a2a2e, 0x8a6a4a, 0x24344e, 0xa8382a, 0x4a4a4a, 0xd8d0c0, 0x3a4a3a];
// south (Rameshwaram, Srisailam): silk sarees with gold borders, white veshtis, Ayyappa black
const SILK = [0x7a0a14, 0x1b5e20, 0xc49102, 0xad1457, 0x4a148c, 0xe65100, 0x0d47a1, 0xb71c1c, 0x006064, 0xf0a020, 0x8a1a4a, 0x2a6a2a];
const VESHTI = [0xf8f5ec, 0xf4f0e2, 0xfaf8f0, 0xf2ecd8, 0xf8f5ec];
const AYYAPPA = [0x161616, 0x1a1a22, 0x1e2440, 0xe8560f];
const BRASS = 0xc9a227, DARK = 0x2a2420, MARIGOLD = 0xf09a10, SANDAL = 0xe6c890;

// ---------------------------------------------------------------- figure spec

type Dress = 'saree' | 'halfSaree' | 'salwar' | 'kurta' | 'shirt' | 'dhoti' | 'kanwariya' | 'jacket' | 'sadhu' | 'veshtiShirt' | 'veshtiBare' | 'boy' | 'girl';
type Hair = 'bun' | 'braid' | 'short' | 'bald' | 'paste' | 'cap' | 'jata';
interface Spec {
  dress: Dress;
  female: boolean;
  age: 0 | 1 | 2; // adult, elder, child
  pose: Pose;
  hair: Hair;
  /** pallu / shawl over the head */
  hood: boolean;
  /** shawl over the shoulders (mountain) */
  shawl: boolean;
  /** shoes (mountain) */
  shoes: boolean;
}
const key = (s: Spec) => `${s.dress}|${s.female ? 'f' : 'm'}|${s.age}|${s.pose}|${s.hair}|${+s.hood}${+s.shawl}${+s.shoes}`;

// slots in the per-instance palette
const A = 0, B = 1, C = 2, SK = 3, HR = 4, PR = 5, DK = 6, D = 7;
const NSLOT = 8;

// ---------------------------------------------------------------- detail levels

interface Det { lr: number; tr: number; hl: number; hv: number; hrl: number; hrv: number; rings: number; fine: boolean; rib: number }
const DET: Det[] = [
  { lr: 10, tr: 22, hl: 20, hv: 14, hrl: 16, hrv: 10, rings: 1, fine: true, rib: 14 },
  { lr: 6, tr: 12, hl: 10, hv: 7, hrl: 10, hrv: 6, rings: 0.45, fine: false, rib: 6 },
  { lr: 4, tr: 6, hl: 6, hv: 4, hrl: 6, hrv: 4, rings: 0, fine: false, rib: 4 },
];

// ---------------------------------------------------------------- geometry builder

type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** bones for baked AO: a vertex is never occluded by its own bone */
const enum Bn { None = 0, Torso, Head, Neck, UArmL, FArmL, UArmR, FArmR, ThighL, ShinL, ThighR, ShinR, Hand, Foot, Prop }

class GB {
  pos: number[] = [];
  slot: number[] = [];
  bone: number[] = [];
  idx: number[] = [];
  get n() { return this.pos.length / 3; }
  vert(p: V, slot: number, bone: number) {
    this.pos.push(p.x, p.y, p.z);
    this.slot.push(slot);
    this.bone.push(bone);
    return this.n - 1;
  }
  /**
   * Connect a sequence of closed rings (equal vertex counts) into a strip. Winding is chosen so faces point
   * away from the ring centroids. A slot change between rings duplicates the ring for a crisp seam.
   */
  rings(rings: V[][], slots: number[], bone: number, capA = false, capB = false) {
    const m = rings[0].length;
    const ids: number[][] = [];
    for (let i = 0; i < rings.length; i++) {
      if (i > 0 && slots[i] !== slots[i - 1]) {
        ids.push(rings[i].map((p) => this.vert(p, slots[i - 1], bone)));
        ids.push([]); // break: no faces between the duplicate rings
      }
      ids.push(rings[i].map((p) => this.vert(p, slots[i], bone)));
    }
    // winding: a ring that runs counter-clockwise about the strip's direction gives outward faces
    const flip = newell(rings[0]).dot(centroid(rings[rings.length - 1]).sub(centroid(rings[0]))) < 0;
    for (let i = 0; i + 1 < ids.length; i++) {
      const p = ids[i], q = ids[i + 1];
      if (!p.length || !q.length) continue;
      for (let j = 0; j < m; j++) {
        const j1 = (j + 1) % m;
        if (flip) this.idx.push(p[j], q[j], p[j1], p[j1], q[j], q[j1]);
        else this.idx.push(p[j], p[j1], q[j], p[j1], q[j1], q[j]);
      }
    }
    const cap = (ring: number[], pts: V[], away: V, slot: number) => {
      const cc = centroid(pts);
      const ci = this.vert(cc, slot, bone);
      // orient: the cap normal should point away from the neighbouring ring
      const fl = newell(pts).dot(cc.clone().sub(away)) < 0;
      for (let j = 0; j < m; j++) {
        const j1 = (j + 1) % m;
        if (fl) this.idx.push(ring[j1], ring[j], ci); else this.idx.push(ring[j], ring[j1], ci);
      }
    };
    if (capA && rings.length > 1) cap(ids[0], rings[0], centroid(rings[1]), slots[0]);
    if (capB && rings.length > 1) {
      const L = rings.length - 1;
      cap(ids[ids.length - 1], rings[L], centroid(rings[L - 1]), slots[L]);
    }
  }
  /** apply fn to every vertex from index `from` */
  map(from: number, fn: (p: V) => void) {
    const p = new THREE.Vector3();
    for (let i = from; i < this.n; i++) {
      p.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      fn(p);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    }
  }
}
/** polygon normal (Newell's method): its sign says which way the ring runs */
function newell(pts: V[]) {
  const n = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n;
}
function centroid(pts: V[]) {
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  return c.multiplyScalar(1 / pts.length);
}

/** ellipse / superellipse ring in the plane spanned by unit vectors s (side) and u (up/front) */
function ellRing(c: V, s: V, u: V, rx: number, rz: number, n: number, e = 2, ang?: number[], mod?: (a: number) => number) {
  const out: V[] = [];
  const k = 2 / e;
  for (let j = 0; j < n; j++) {
    const a = ang ? ang[j] : (j / n) * Math.PI * 2;
    const sa = Math.sin(a), ca = Math.cos(a);
    const f = mod ? mod(a) : 1;
    const x = Math.sign(sa) * Math.pow(Math.abs(sa), k) * rx * f;
    const z = Math.sign(ca) * Math.pow(Math.abs(ca), k) * rz * f;
    out.push(c.clone().addScaledVector(s, x).addScaledVector(u, z));
  }
  return out;
}

/** frames along a polyline: tangent t, side s (from hint), and u = t × s… */
function frames(pts: V[], hint: V | V[]) {
  const out: { t: V; s: V; u: V }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
    const h = (Array.isArray(hint) ? hint[i] : hint).clone();
    let s = h.sub(t.clone().multiplyScalar(h.dot(t)));
    if (s.lengthSq() < 1e-6) s = Math.abs(t.y) < 0.9 ? v3(0, 1, 0).cross(t) : v3(1, 0, 0).cross(t);
    s.normalize();
    const u = t.clone().cross(s).normalize();
    out.push({ t, s, u });
  }
  return out;
}

/** a tube along pts; rx along the hint (side) axis, rz across it */
function tube(g: GB, pts: V[], rx: number[], rz: number[], n: number, slots: number | number[], bone: number, hint: V | V[] = v3(1, 0, 0), capA = true, capB = true) {
  const F = frames(pts, hint);
  const rings = pts.map((p, i) => ellRing(p, F[i].s, F[i].u, rx[i], rz[i], n));
  const sl = Array.isArray(slots) ? slots : pts.map(() => slots);
  g.rings(rings, sl, bone, capA, capB);
}

/** resample a polyline at fractions ts (0..1 by arc length) */
function along(pts: V[], ts: number[]) {
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const tot = L[L.length - 1];
  return ts.map((t) => {
    const d = t * tot;
    let i = 1;
    while (i < pts.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    return pts[i - 1].clone().lerp(pts[i], Math.min(1, Math.max(0, f)));
  });
}
/** sample a radius profile [t, r][] at t */
function prof(p: [number, number][], t: number) {
  if (t <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (t <= p[i][0]) return lerp(p[i - 1][1], p[i][1], (t - p[i - 1][0]) / (p[i][0] - p[i - 1][0]));
  return p[p.length - 1][1];
}
/** sample fractions for a detail level: every knot near, every other one mid, only the ends and joints far */
function samples(knots: number[], det: Det, must: number[]) {
  if (det.rings >= 1) return knots;
  const out = new Set<number>([knots[0], knots[knots.length - 1], ...must]);
  if (det.rings > 0) knots.forEach((k, i) => { if (i % 2 === 1) out.add(k); });
  return [...out].sort((a, b) => a - b);
}

/** curved thin band (a ribbon of cloth) along a smooth path; normals n say which side faces out */
function ribbon(g: GB, path: V[], width: number[], nrm: V[], det: Det, slotAt: (t: number) => number, thick = 0.006, curl = 0.25) {
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  const N = Math.max(3, det.rib);
  const across = det.fine ? 4 : det.rib > 4 ? 2 : 1;
  const rings: V[][] = [], slots: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t), tg = curve.getTangent(t);
    const f = t * (path.length - 1), i0 = Math.min(path.length - 2, Math.floor(f)), fr = f - i0;
    const w = lerp(width[i0], width[i0 + 1], fr) / 2;
    const out = nrm[i0].clone().lerp(nrm[i0 + 1], fr).normalize();
    const side = tg.clone().cross(out).normalize();
    const up = side.clone().cross(tg).normalize(); // ≈ out, orthogonal to the tangent
    const ring: V[] = [];
    // outer face across the band (curling back toward the body at the edges), then the inner face back
    for (let k = 0; k <= across; k++) {
      const u = -1 + (2 * k) / across;
      ring.push(p.clone().addScaledVector(side, u * w).addScaledVector(up, thick / 2 - curl * w * u * u));
    }
    for (let k = across; k >= 0; k--) {
      const u = -1 + (2 * k) / across;
      ring.push(p.clone().addScaledVector(side, u * w).addScaledVector(up, -thick / 2 - curl * w * u * u));
    }
    rings.push(ring);
    slots.push(slotAt(t));
  }
  g.rings(rings, slots, Bn.None, true, true);
}

/** a deformed lat-long ellipsoid; fn gets the unit direction and the point (edit the point in place) */
function blob(g: GB, c: V, r: V, nl: number, nv: number, slot: number, bone: number, fn?: (u: V, p: V) => void, rot?: THREE.Quaternion) {
  const rings: V[][] = [];
  for (let i = 1; i < nv; i++) {
    const th = (i / nv) * Math.PI;
    const ring: V[] = [];
    for (let j = 0; j < nl; j++) {
      const ph = (j / nl) * Math.PI * 2;
      const u = v3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      const p = v3(u.x * r.x, u.y * r.y, u.z * r.z);
      fn?.(u, p);
      if (rot) p.applyQuaternion(rot);
      ring.push(p.add(c));
    }
    rings.push(ring);
  }
  // poles as caps
  const top = v3(0, r.y, 0), bot = v3(0, -r.y, 0);
  fn?.(v3(0, 1, 0), top); fn?.(v3(0, -1, 0), bot);
  if (rot) { top.applyQuaternion(rot); bot.applyQuaternion(rot); }
  top.add(c); bot.add(c);
  const s0 = g.n;
  g.rings(rings, rings.map(() => slot), bone);
  // fans to the poles (the first and last ring are the first/last m verts written)
  const m = nl;
  const first = s0, last = g.n - m;
  const ti = g.vert(top, slot, bone), bi = g.vert(bot, slot, bone);
  // winding: compare with the outward direction
  const fl = newell(rings[0]).dot(top.clone().sub(centroid(rings[0]))) < 0;
  for (let j = 0; j < m; j++) {
    const j1 = (j + 1) % m;
    if (fl) { g.idx.push(first + j1, first + j, ti); g.idx.push(last + j, last + j1, bi); }
    else { g.idx.push(first + j, first + j1, ti); g.idx.push(last + j1, last + j, bi); }
  }
}

/** two-bone IK: joint between a and the target t, bending toward pole */
function ik(a: V, t: V, la: number, lb: number, pole: V): [V, V] {
  const d = t.clone().sub(a);
  let L = d.length();
  L = Math.min(Math.max(L, Math.abs(la - lb) + 1e-3), (la + lb) * 0.999);
  const dir = d.normalize();
  const end = a.clone().addScaledVector(dir, L);
  const x = (la * la - lb * lb + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, la * la - x * x));
  const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1);
  pp.normalize();
  return [a.clone().addScaledVector(dir, x).addScaledVector(pp, h), end];
}

// ---------------------------------------------------------------- the figure

/** torso levels in units of height: [y, half-width, half-depth, z-offset] from the crotch to the neck */
const TORSO_M: [number, number, number, number][] = [
  [0.485, 0.09, 0.062, 0], [0.545, 0.106, 0.07, 0], [0.585, 0.1, 0.064, 0.002], [0.62, 0.094, 0.06, 0.004],
  [0.697, 0.1, 0.068, 0.006], [0.75, 0.106, 0.073, 0.006], [0.795, 0.11, 0.07, 0.002], [0.83, 0.1, 0.058, -0.004],
  [0.852, 0.06, 0.045, -0.006], [0.866, 0.036, 0.034, -0.004],
];
const TORSO_F: [number, number, number, number][] = [
  [0.495, 0.1, 0.07, 0], [0.565, 0.12, 0.08, -0.004], [0.605, 0.104, 0.068, 0], [0.645, 0.084, 0.06, 0.004],
  [0.715, 0.088, 0.064, 0.006], [0.76, 0.095, 0.078, 0.014], [0.8, 0.097, 0.066, 0.006], [0.835, 0.092, 0.052, -0.002],
  [0.857, 0.056, 0.042, -0.006], [0.872, 0.033, 0.031, -0.004],
];

interface Skel {
  H: number;
  f: boolean;
  hip: [V, V]; knee: [V, V]; ankle: [V, V]; footDir: [V, V];
  sh: [V, V]; elbow: [V, V]; wrist: [V, V]; handDir: [V, V]; palm: [V, V];
  neck: V; headC: V; dy: number; seated: boolean; step: boolean;
}

/** build one figure's geometry */
function figure(sp: Spec, det: Det): THREE.BufferGeometry {
  const g = new GB();
  const child = sp.age === 2, elder = sp.age === 1;
  const H = child ? (sp.female ? 1.14 : 1.2) : sp.female ? 1.55 : 1.66;
  const T = sp.female ? TORSO_F : TORSO_M;
  const wk = (child ? 0.92 : 1) * (elder ? 0.96 : 1); // girth
  const pose = sp.pose;
  const seated = pose === 'sit' || pose === 'sitNamaste';
  const step = pose === 'step';
  const lu = 0.186 * H, lf = 0.146 * H, lt = 0.245 * H, ls = 0.24 * H;
  const stoop = elder ? 0.32 : seated ? 0.08 : 0;
  const pivot = 0.6 * H;

  // ---- legs and pelvis
  const hipW = (sp.female ? 0.06 : 0.055) * H;
  const hipY0 = 0.52 * H;
  let dy = 0;
  const hip: [V, V] = [v3(-hipW, hipY0, 0), v3(hipW, hipY0, 0)];
  const knee: [V, V] = [v3(0, 0, 0), v3(0, 0, 0)], ankle: [V, V] = [v3(0, 0, 0), v3(0, 0, 0)];
  const footDir: [V, V] = [v3(0, 0, 1), v3(0, 0, 1)];
  if (seated) {
    const py = 0.1 * H;
    dy = py - hipY0;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      hip[i].set(s * hipW, py, 0);
      knee[i].copy(hip[i]).addScaledVector(v3(s * 0.74, 0.05, 0.62).normalize(), lt);
      ankle[i].copy(knee[i]).addScaledVector(v3(-s * 0.93, -0.12, 0.2 + i * 0.12).normalize(), ls);
      footDir[i].set(-s * 0.5, -0.3, -0.6).normalize();
    }
  } else if (step) {
    const py = 0.06 * H;
    dy = py - hipY0;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      hip[i].set(s * hipW, py, 0);
      knee[i].copy(hip[i]).addScaledVector(v3(s * 0.12, 0.02, 1).normalize(), lt);
      ankle[i].copy(knee[i]).addScaledVector(v3(s * 0.05, -1, 0.12).normalize(), ls);
      footDir[i].set(s * 0.12, 0, 1).normalize();
    }
  } else {
    const walk = pose === 'walk';
    // a shorter step under an ankle-length skirt
    const stride = sp.dress === 'saree' || sp.dress === 'halfSaree' || sp.dress === 'girl' || sp.dress === 'sadhu' || sp.dress.startsWith('veshti') ? 0.55 : 1;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const fwd = walk ? (i ? 0.21 : -0.18) * stride : (i ? 0.02 : -0.02);
      const tgt = v3(s * (hipW + 0.006 * H), 0.045 * H, fwd * H);
      const [k, a] = ik(hip[i], tgt, lt, ls, v3(0, 0, 1));
      knee[i].copy(k); ankle[i].copy(a);
      footDir[i].set(s * 0.12, walk && !i ? -0.45 : walk ? 0.12 : 0, 1).normalize();
    }
  }
  // the upper body: bend forward about the waist (stoop), and sit down by dy
  const bend = (p: V) => {
    p.y += dy;
    if (stoop) {
      const piv = pivot + dy;
      const yy = p.y - piv;
      if (yy > 0) {
        const a = stoop * Math.min(1, yy / (H - pivot)) * (0.6 + 0.4 * Math.min(1, yy / (H - pivot)));
        const z = p.z, y2 = yy;
        p.z = z * Math.cos(a) + y2 * Math.sin(a);
        p.y = piv + y2 * Math.cos(a) - z * Math.sin(a);
      }
    }
  };
  const shW = (sp.female ? 0.098 : 0.108) * H * (child ? 0.92 : 1);
  const sh: [V, V] = [v3(-shW, 0.815 * H, -0.004 * H), v3(shW, 0.815 * H, -0.004 * H)];
  sh.forEach(bend);
  const neckB = v3(0, 0.85 * H, -0.006 * H); bend(neckB);
  const headR = (child ? 1.22 : 1) * H / 15;
  const headC = v3(0, H - headR * (child ? 1.05 : 1), 0.004 * H); bend(headC);
  if (child) headC.y = Math.max(headC.y, neckB.y + headR * 1.05);
  // elders hold the head up again a little
  if (stoop) headC.z -= stoop * 0.1 * H * 0.5;
  const chest = v3(0, 0.76 * H, 0.08 * H); bend(chest);
  const waist = v3(0, 0.6 * H, 0.06 * H); bend(waist);

  // ---- arms (targets per pose)
  const elbow: [V, V] = [v3(0, 0, 0), v3(0, 0, 0)], wrist: [V, V] = [v3(0, 0, 0), v3(0, 0, 0)];
  const handDir: [V, V] = [v3(0, -1, 0), v3(0, -1, 0)], palm: [V, V] = [v3(1, 0, 0), v3(-1, 0, 0)];
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    const S = sh[i];
    let tgt: V, pole = v3(s * 0.3, 0, -1);
    palm[i].set(-s, 0, 0.1).normalize();
    if (pose === 'namaste' || pose === 'sitNamaste') {
      tgt = chest.clone().add(v3(s * 0.012 * H, -0.04 * H, 0.06 * H));
      pole = v3(s, -0.8, -0.2);
      handDir[i].set(0, 1, 0.15).normalize();
      palm[i].set(-s, 0, 0);
    } else if (pose === 'thali') {
      tgt = v3(s * 0.075 * H, 0.6 * H + dy, 0.17 * H);
      pole = v3(s * 0.6, -1, -0.3);
      handDir[i].set(-s * 0.35, 0.05, 1).normalize();
      palm[i].set(0, 1, 0);
    } else if (pose === 'raised') {
      tgt = S.clone().add(v3(s * 0.14 * H, 0.3 * H, 0.06 * H));
      pole = v3(s, 0, -0.4);
      handDir[i].set(s * 0.25, 1, 0.1).normalize();
      palm[i].set(0, 0, 1);
    } else if (pose === 'kanwar' && i === 1) {
      tgt = S.clone().add(v3(-0.01 * H, 0.03 * H, 0.17 * H));
      pole = v3(0.6, -1, 0);
      handDir[i].set(-0.2, 1, 0.3).normalize();
      palm[i].set(-1, 0, 0);
    } else if (seated) {
      tgt = knee[i].clone().add(v3(-s * 0.02 * H, 0.04 * H, -0.04 * H));
      pole = v3(s * 0.5, 0, -1);
      handDir[i].set(s * 0.1, -0.5, 1).normalize();
      palm[i].set(0, -1, 0);
    } else if (step) {
      tgt = v3(s * 0.08 * H, hip[i].y + 0.05 * H, 0.18 * H);
      pole = v3(s * 0.3, -0.3, -1);
      handDir[i].set(0, -0.3, 1).normalize();
      palm[i].set(0, -1, 0);
    } else {
      const walk = pose === 'walk';
      const swing = walk ? (i ? -0.12 : 0.14) * H : 0.015 * H;
      const out = pose === 'bag' && i === 1 ? 0.07 * H : 0.04 * H;
      tgt = S.clone().add(v3(s * out, -(lu + lf) * 0.97, swing + 0.03 * H));
      handDir[i].copy(tgt.clone().sub(S)).normalize().add(v3(0, 0, 0.12)).normalize();
    }
    const [e, w] = ik(S, tgt, lu, lf, pole);
    elbow[i].copy(e); wrist[i].copy(w);
  }

  // ---- what is worn where
  const d = sp.dress;
  const skirtLong = d === 'saree' || d === 'halfSaree' || d === 'girl' || d === 'veshtiShirt' || d === 'veshtiBare' || d === 'sadhu';
  const longTop = d === 'kurta' || d === 'salwar'; // to the knee
  const topSlot = (y: number): number => {
    // slot of the torso surface at height y (in H units, before bending)
    switch (d) {
      case 'saree': case 'halfSaree': return y < 0.705 && !sp.shoes ? SK : y < 0.858 ? B : SK; // (a cardigan over the midriff in the hills)
      case 'girl': return y < 0.85 ? B : SK;
      case 'salwar': case 'kurta': case 'sadhu': return y < 0.86 ? A : SK;
      case 'shirt': case 'boy': case 'jacket': return y < 0.53 ? B : y < 0.86 ? A : SK;
      case 'veshtiShirt': return y < 0.62 ? A : y < 0.86 ? B : SK;
      case 'kanwariya': return y < 0.56 ? B : y < 0.85 ? A : SK;
      case 'dhoti': case 'veshtiBare': return y < 0.6 ? A : SK;
    }
  };
  const puff = d === 'jacket' ? 0.016 : d === 'sadhu' || d === 'kurta' || d === 'salwar' ? 0.006 : d === 'shirt' || d === 'boy' || d === 'kanwariya' || d === 'veshtiShirt' ? 0.004 : 0.002;

  // torso loft (crotch → neck)
  const tn = det.tr;
  const torsoLv = T.filter((_, i) => det.rings >= 1 || i % 2 === 0 || i === T.length - 1 || i === T.length - 2);
  const startY = skirtLong ? (d === 'saree' || d === 'halfSaree' || d === 'girl' ? 0.6 : 0.585) : 0;
  const lv = torsoLv.filter((l) => l[0] >= startY - 1e-6 || l === torsoLv[torsoLv.length - 1]);
  if (lv[0][0] > startY && startY > 0) lv.unshift([startY, lerp(T[1][1], T[2][1], 0.5), lerp(T[1][2], T[2][2], 0.5), 0]);
  const up0 = g.n;
  {
    const rings: V[][] = [], slots: number[] = [];
    for (const [y, w, dd, zo] of lv) {
      const sl = topSlot(y);
      const inf = sl === SK ? 0 : puff * H * (y > 0.83 ? 0.4 : 1);
      rings.push(ellRing(v3(0, y * H, zo * H), v3(1, 0, 0), v3(0, 0, 1), (w * wk) * H + inf, dd * wk * H + inf, tn, 2.4));
      slots.push(sl);
    }
    g.rings(rings, slots, Bn.Torso, true, false);
  }
  // neck and head
  const neckR = (sp.female ? 0.031 : 0.036) * H * (child ? 1.1 : 1);
  {
    const a = v3(0, 0.84 * H, -0.008 * H), b = v3(0, H - headR * 1.7, 0);
    tube(g, [a, a.clone().lerp(b, 0.5), b], [neckR * 1.05, neckR, neckR * 0.95], [neckR * 0.95, neckR * 0.95, neckR * 0.9], Math.max(5, det.lr), SK, Bn.Neck, v3(1, 0, 0), false, false);
  }
  g.map(up0, bend);
  const headStart = g.n;
  const hc = v3(0, 0, 0);
  const hx = headR * 0.7, hy = headR, hz = headR * 0.86;
  const headShape = (u: V, p: V) => {
    // jaw narrows toward the chin; the face is flatter than the skull; occiput fuller
    if (u.y < 0) p.x *= 1 - 0.3 * sstep(0, -1, u.y) * (0.6 + 0.4 * Math.max(0, u.z));
    if (u.z < 0 && u.y < -0.35) p.z *= 1 - 0.35 * sstep(-0.35, -1, u.y);
    if (u.z < 0 && u.y > -0.3) p.z *= 1.04;
    if (u.z > 0) p.z *= 1 - 0.07 * u.z * (1 - Math.abs(u.y));
    if (u.z > 0 && u.y < -0.55) p.z += 0.08 * hz * sstep(-0.55, -0.85, u.y) * u.z * (1 - Math.abs(u.x) * 1.5);
    if (u.z > 0.2) {
      const fz = Math.pow(Math.max(0, u.z), 4);
      p.z += 0.2 * hz * Math.exp(-((u.x / 0.17) ** 2) - (((u.y + 0.08) / 0.22) ** 2)) * fz; // nose
      p.z += 0.06 * hz * Math.exp(-(((u.y - 0.22) / 0.1) ** 2) - ((u.x / 0.5) ** 2)) * fz; // brow
      p.z -= 0.07 * hz * Math.exp(-(((Math.abs(u.x) - 0.34) / 0.14) ** 2) - (((u.y - 0.08) / 0.1) ** 2)) * fz; // sockets
    }
  };
  blob(g, hc, v3(hx, hy, hz), det.hl, det.hv, SK, Bn.Head, headShape);
  if (det.fine) for (const s of [-1, 1]) blob(g, v3(s * hx * 0.98, -0.04 * hy, -0.02 * hz), v3(0.13 * hx, 0.28 * hy, 0.2 * hz), 6, 4, SK, Bn.Head, undefined, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.35, 0)));
  // hair: a shell over the scalp; outside the hairline the shell sinks inside the head
  const hairShell = (cover: (u: V) => number, thick: number, slot: number, nl: number, nv: number, part = false) => {
    blob(g, hc, v3(hx, hy, hz), nl, nv, slot, Bn.Head, (u, p) => {
      headShape(u, p);
      const c = cover(u);
      let k = c > 0 ? 1 + (thick / headR) * Math.min(1, c * 4) : 0.9;
      if (part && u.y > 0.5 && Math.abs(u.x) < 0.08 && u.z > 0) k = 1 + thick / headR * 0.3;
      p.multiplyScalar(k);
    });
  };
  const line = (front: number, side: number, back: number) => (u: V) => {
    const th = u.z > 0 ? lerp(side, front, u.z) : lerp(side, back, -u.z);
    return u.y - th;
  };
  if (sp.hair === 'short') hairShell(line(0.5, 0.05, -0.55), 0.012 * H / 1.65, HR, det.hrl, det.hrv);
  else if (sp.hair === 'paste') hairShell(line(0.5, 0.1, -0.5), 0.004 * H / 1.65, HR, det.hrl, det.hrv);
  else if (sp.hair === 'cap') hairShell(line(0.42, 0.0, -0.3), 0.02 * H / 1.65, C, det.hrl, det.hrv);
  else if (sp.hair === 'bun' || sp.hair === 'braid' || sp.hair === 'jata') {
    if (!sp.hood) hairShell(line(0.48, -0.05, -0.62), 0.014 * H / 1.65, HR, det.hrl, det.hrv, true);
    if (sp.hair === 'bun' && !sp.hood) blob(g, v3(0, -0.2 * hy, -0.95 * hz), v3(0.5 * hx, 0.36 * hy, 0.36 * hz), Math.max(5, det.hrl >> 1), Math.max(3, det.hrv >> 1), HR, Bn.Head);
    if (sp.hair === 'jata') blob(g, v3(0, 0.95 * hy, -0.15 * hz), v3(0.5 * hx, 0.4 * hy, 0.5 * hz), Math.max(5, det.hrl >> 1), Math.max(3, det.hrv >> 1), HR, Bn.Head);
  }
  if (sp.hood) {
    // the pallu or shawl over the head: a thick shell that leaves the face open
    const slot = sp.shawl ? C : A;
    blob(g, hc, v3(hx, hy, hz), det.hrl, det.hrv, slot, Bn.Head, (u, p) => {
      headShape(u, p);
      const face = u.z > 0.15 && u.y < 0.62 && Math.abs(u.x) < 0.9;
      p.multiplyScalar(face ? 0.88 : 1 + 0.022 * H / 1.65 / headR + (u.y < -0.2 ? 0.1 * (-u.y) : 0));
      if (!face && u.y < -0.2) { p.x *= 1.1; p.z -= 0.15 * hz * (-u.y); }
    });
  }
  if (sp.dress === 'sadhu') blob(g, v3(0, -0.78 * hy, 0.62 * hz), v3(0.62 * hx, 0.42 * hy, 0.32 * hz), Math.max(5, det.hrl >> 1), Math.max(3, det.hrv >> 1), HR, Bn.Head);
  // place the head at its centre, tilted with the body less the elders' lift
  {
    const q = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), stoop * 0.35);
    g.map(headStart, (p) => { p.applyQuaternion(q).add(headC); });
  }
  if (sp.hair === 'braid' && !sp.hood) {
    const back = -(T[7][2] * H + 0.02 * H);
    const body = [v3(0, 0.8 * H, back - 0.004 * H), v3(0, 0.72 * H, back), v3(0, 0.62 * H, back + 0.004 * H), v3(0, 0.56 * H, back + 0.004 * H)];
    body.forEach(bend);
    const pts = [v3(0, headC.y - 0.5 * hy, headC.z - 0.8 * hz), ...body];
    const sm = new THREE.CatmullRomCurve3(pts).getPoints(Math.max(4, det.rib));
    const r = sm.map((_, i) => 0.012 * H * (1 - (i / sm.length) * 0.5) * (det.fine ? 1 + 0.18 * Math.abs(Math.sin(i * 1.7)) : 1));
    tube(g, sm, r, r.map((x) => x * 0.8), Math.max(4, det.lr >> 1), HR, Bn.None, v3(1, 0, 0));
  }

  // ---- drapes over the torso (pallu, dupatta, angavastram, gamchha, shawl)
  const drapeStart = g.n;
  const P = (x: number, y: number, z: number) => v3(x * H, y * H, z * H);
  const fwd = v3(0, 0, 1), upv = v3(0, 1, 0), bk = v3(0, 0, -1);
  const fe = sp.female;
  if ((d === 'saree' || d === 'halfSaree') && !seated && !sp.shawl) {
    const slot = d === 'halfSaree' ? C : A;
    const path = [P(0.07, 0.6, 0.074), P(0.035, 0.68, 0.083), P(-0.02, 0.75, 0.098), P(-0.065, 0.81, 0.07), P(-0.085, 0.86, 0.0), P(-0.078, 0.8, -0.07), P(-0.07, 0.66, -0.078), P(-0.062, 0.5, -0.088), P(-0.058, sp.hood ? 0.56 : 0.4, -0.092)];
    const wd = [0.06, 0.09, 0.1, 0.075, 0.045, 0.08, 0.11, 0.13, 0.14].map((x) => x * H);
    ribbon(g, path, wd, [fwd, fwd, fwd, fwd.clone().add(upv), upv, bk.clone().add(upv), bk, bk, bk], det, (t) => (t > 0.9 && d === 'saree' ? D : slot), 0.006 * H / 1.65, 0.2);
  } else if ((d === 'saree' || d === 'halfSaree') && seated && !sp.shawl) {
    const slot = d === 'halfSaree' ? C : A;
    const path = [P(0.07, 0.6, 0.074), P(-0.02, 0.75, 0.098), P(-0.085, 0.86, 0.0), P(-0.075, 0.74, -0.074), P(-0.07, 0.62, -0.08)];
    ribbon(g, path, [0.06, 0.1, 0.045, 0.1, 0.12].map((x) => x * H), [fwd, fwd, upv, bk, bk], det, (t) => (t > 0.85 && d === 'saree' ? D : slot), 0.006 * H / 1.65, 0.2);
  }
  if (d === 'salwar' && !sp.shawl) {
    // dupatta: a U across the chest with both ends down the back
    {
      const path = [P(-0.07, 0.5, -0.082), P(-0.075, 0.7, -0.074), P(-0.082, 0.86, -0.004), P(-0.04, 0.8, 0.088), P(0, 0.765, 0.104), P(0.04, 0.8, 0.088), P(0.082, 0.86, -0.004), P(0.075, 0.7, -0.074), P(0.07, 0.5, -0.082)];
      ribbon(g, path, [0.07, 0.07, 0.05, 0.06, 0.065, 0.06, 0.05, 0.07, 0.07].map((x) => x * H), [bk, bk, upv, fwd, fwd, fwd, upv, bk, bk], det, () => C, 0.005 * H / 1.65, 0.15);
    }
  }
  if (d === 'dhoti' || d === 'veshtiBare' || (d === 'kurta' && sp.shawl)) {
    // angavastram / towel over the left shoulder, both ends hanging
    const sx = d === 'veshtiBare' ? 1 : -1;
    const path = [P(sx * 0.07, 0.58, 0.078), P(sx * 0.08, 0.72, 0.082), P(sx * 0.09, 0.85, 0.01), P(sx * 0.08, 0.76, -0.07), P(sx * 0.072, 0.6, -0.074)];
    ribbon(g, path, [0.075, 0.07, 0.05, 0.07, 0.075].map((x) => x * H), [fwd, fwd, upv, bk, bk], det, (t) => (t < 0.06 || t > 0.94 ? D : C), 0.005 * H / 1.65, 0.12);
    if (det.fine && d === 'dhoti') {
      // the sacred thread from the left shoulder to the right hip
      const pts = [P(-0.07, 0.84, 0.045), P(-0.03, 0.76, 0.083), P(0.03, 0.68, 0.075), P(0.085, 0.6, 0.06), P(0.1, 0.6, -0.02), P(0.05, 0.7, -0.07), P(-0.06, 0.8, -0.06), P(-0.07, 0.84, 0.045)];
      tube(g, new THREE.CatmullRomCurve3(pts).getPoints(16), Array(17).fill(0.0022 * H), Array(17).fill(0.0022 * H), 3, D, Bn.None, v3(0, 1, 0), false, false);
    }
  }
  if (d === 'kanwariya' && !seated) {
    // gamchha round the neck, ends down the chest
    const path = [P(-0.055, 0.66, 0.083), P(-0.055, 0.8, 0.075), P(-0.04, 0.862, 0.02), P(0, 0.868, -0.035), P(0.04, 0.862, 0.02), P(0.055, 0.8, 0.075), P(0.058, 0.68, 0.083)];
    ribbon(g, path, [0.05, 0.05, 0.04, 0.04, 0.04, 0.05, 0.05].map((x) => x * H), [fwd, fwd, upv, upv, upv, fwd, fwd], det, () => C, 0.006 * H / 1.65, 0.1);
  }
  if (sp.shawl && (fe || d === 'sadhu')) {
    // a woollen shawl round the shoulders and upper arms, open at the front
    const lvl: [number, number, number][] = [[0.878, 0.05, 0.046], [0.85, 0.135, 0.084], [0.815, 0.168, 0.096], [0.74, 0.178, 0.104], [0.64, 0.176, 0.106], [0.58, 0.172, 0.104]];
    const n = Math.max(8, det.tr);
    const ang: number[] = [];
    for (let j = 0; j < n; j++) ang.push(0.35 + (j / (n - 1)) * (Math.PI * 2 - 0.7));
    const rings: V[][] = [];
    for (const [y, w, dd] of lvl) {
      const o = ellRing(v3(0, y * H, -0.005 * H), v3(1, 0, 0), v3(0, 0, 1), w * H * wk, dd * H * wk, n, 2.2, ang);
      const inn = ellRing(v3(0, y * H, -0.005 * H), v3(1, 0, 0), v3(0, 0, 1), w * H * wk - 0.012 * H, dd * H * wk - 0.012 * H, n, 2.2, ang).reverse();
      rings.push([...o, ...inn]);
    }
    g.rings(rings, rings.map(() => C), Bn.None, false, false);
  }
  g.map(drapeStart, bend);

  // ---- skirts and long tops below the waist (follow the legs when walking)
  const legZ = (i: number, y: number) => {
    const h = hip[i], k = knee[i], a = ankle[i];
    if (y >= k.y) return lerp(k.z, h.z, (y - k.y) / Math.max(1e-3, h.y - k.y));
    return lerp(a.z, k.z, (y - a.y) / Math.max(1e-3, k.y - a.y));
  };
  const lowStart = g.n;
  if (!seated && !step && (skirtLong || longTop)) {
    const sareeLike = d === 'saree' || d === 'halfSaree' || d === 'girl';
    const veshti = d === 'veshtiShirt' || d === 'veshtiBare';
    const top = sareeLike ? 0.6 : veshti ? 0.6 : 0.585;
    const hem = longTop ? 0.3 : 0.004;
    const prof2: [number, number, number][] = sareeLike
      ? [[top, 0.1, 0.07], [0.565, 0.122, 0.084], [0.48, 0.114, 0.08], [0.38, 0.1, 0.075], [0.26, 0.094, 0.074], [0.15, 0.093, 0.075], [0.06, 0.095, 0.078], [0.03, 0.096, 0.079], [hem, 0.097, 0.08]]
      : veshti
        ? [[top, 0.1, 0.066], [0.545, 0.112, 0.074], [0.45, 0.108, 0.076], [0.3, 0.1, 0.078], [0.15, 0.098, 0.08], [0.05, 0.098, 0.082], [hem + 0.02, 0.098, 0.082]]
        : d === 'sadhu'
          ? [[top, 0.112, 0.074], [0.5, 0.118, 0.08], [0.3, 0.118, 0.084], [0.12, 0.12, 0.088], [0.03, 0.122, 0.09]]
          : [[top, 0.114 + (fe ? 0.012 : 0), 0.074 + (fe ? 0.01 : 0)], [0.5, 0.124 + (fe ? 0.012 : 0), 0.082 + (fe ? 0.008 : 0)], [0.4, 0.13 + (fe ? 0.006 : 0), 0.086], [hem, 0.134 + (fe ? 0.006 : 0), 0.09]];
    const pr = det.rings >= 1 ? prof2 : prof2.filter((_, i) => i === 0 || i === prof2.length - 1 || i % 2 === 1);
    // front-dense angles so the pleats read
    const n = det.tr + (det.fine && d === 'saree' ? 14 : 0);
    const ang: number[] = [];
    if (det.fine && d === 'saree') {
      const nf = 18, F = 0.62;
      for (let j = 0; j < nf; j++) ang.push(-F + (2 * F * j) / nf);
      for (let j = 0; j < n - nf; j++) ang.push(F + ((Math.PI * 2 - 2 * F) * j) / (n - nf));
    }
    const rings: V[][] = [], slots: number[] = [];
    for (const [y, w, dd] of pr) {
      const yy = y * H;
      const z0 = legZ(0, yy), z1 = legZ(1, yy);
      const cz = yy < hip[0].y ? (z0 + z1) / 2 : 0;
      const spread = yy < hip[0].y ? Math.abs(z0 - z1) / 2 : 0;
      const pleat = sareeLike && det.rings > 0 && y < 0.5 ? (a: number) => {
        // front pleats (near) and soft folds all round
        const fr = d === 'saree' && det.fine && Math.abs(a) < 0.6 ? 1 : 0;
        return 1 + fr * (0.03 + 0.05 * (0.5 - y)) * Math.abs(Math.sin(a * 22)) + (0.5 - y) * 0.05 * Math.sin(a * 5 + 1.3) * (1 - fr);
      } : undefined;
      rings.push(ellRing(v3(0, yy, cz + (sareeLike ? 0.004 * H : 0)), v3(1, 0, 0), v3(0, 0, 1), w * H * wk, dd * H * wk + spread * 0.55, n, 2.2, ang.length ? ang : undefined, pleat));
      slots.push(d === 'saree' && y < 0.035 ? D : veshti && y < 0.06 ? D : d === 'girl' ? A : A);
    }
    g.rings(rings, slots, Bn.None, false, true);
  }
  if (seated && (skirtLong || longTop)) {
    // cloth over the crossed legs: a lap drape
    const slot = A;
    const c = v3(0, 0.085 * H, 0.1 * H);
    blob(g, c, v3(0.15 * H, 0.045 * H, 0.12 * H), Math.max(6, det.tr), Math.max(4, det.hv - 4), slot, Bn.None, (u, p) => { if (u.y < 0) p.y *= 0.5; });
  }
  if (step && (skirtLong || longTop)) {
    // cloth over the thighs and down to the ankles
    const c = v3(0, hip[0].y + 0.01 * H, 0.15 * H);
    blob(g, c, v3(0.13 * H, 0.06 * H, 0.2 * H), Math.max(6, det.tr), Math.max(4, det.hv - 4), A, Bn.None);
    const rings: V[][] = [];
    for (const [y, w] of [[hip[0].y, 0.12], [ankle[0].y + 0.06 * H, 0.115], [ankle[0].y - 0.01 * H, 0.118]] as const) {
      rings.push(ellRing(v3(0, y, knee[0].z - 0.01 * H), v3(1, 0, 0), v3(0, 0, 1), w * H, 0.055 * H, Math.max(6, det.tr >> 1), 2.4));
    }
    g.rings(rings, [A, A, A], Bn.None, false, true);
  }
  void lowStart;

  // ---- legs (cloth or skin by height), feet
  const legHidden = !seated && !step && skirtLong;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    const fr = (sp.female ? 1.06 : 1) * wk;
    if (!legHidden) {
      const top = hip[i].clone().add(v3(0, 0.03 * H, 0));
      const pts0 = [top, knee[i], ankle[i]];
      const L1 = top.distanceTo(knee[i]) / (top.distanceTo(knee[i]) + ls);
      const ts = samples([0, 0.12, 0.3, L1 * 0.9, L1, L1 + 0.08, L1 + 0.17, 0.85, 1], det, [L1]);
      const pts = along(pts0, ts);
      const R: [number, number][] = [[0, 0.054], [0.12, 0.052], [0.3, 0.045], [L1 * 0.95, 0.034], [L1, 0.032], [L1 + 0.08, 0.035], [L1 + 0.17, 0.033], [0.85, 0.024], [1, 0.02]];
      // what covers the leg
      const cover = (t: number): [number, number] => {
        switch (d) {
          case 'kurta': case 'salwar': return [B, t < 0.93 ? (d === 'salwar' ? 0.014 * (1 - 0.6 * t) : 0.012) : 0.005];
          case 'shirt': case 'jacket': return [B, 0.012];
          case 'boy': return t < L1 * 0.85 ? [B, 0.014] : [SK, 0];
          case 'kanwariya': return t < L1 * 1.08 ? [B, 0.016] : [SK, 0];
          case 'dhoti': return t < 0.86 ? [A, 0.017 + 0.005 * t] : [SK, 0];
          case 'saree': case 'halfSaree': case 'girl': case 'veshtiShirt': case 'veshtiBare': case 'sadhu': return [A, 0.016];
        }
      };
      const rx: number[] = [], rz: number[] = [], sl: number[] = [];
      for (const t of ts) {
        const [c, inf] = cover(t);
        const r = prof(R, t) * H * fr + inf * H;
        rx.push(r); rz.push(r * (t < L1 ? 1.04 : 1.0)); sl.push(c);
      }
      // split at the cloth/skin boundary so the cuff gets its own ring
      tube(g, pts, rx, rz, det.lr, sl, i ? Bn.ThighR : Bn.ThighL, v3(1, 0, 0), true, true);
    }
    // foot
    const a = ankle[i], fd = footDir[i];
    const side = v3(0, 1, 0).cross(fd).normalize().multiplyScalar(-1);
    const dn = fd.clone().cross(side).normalize(); // "up" of the foot
    if (dn.y < 0) dn.negate();
    const fl = 0.142 * H;
    const fp = [a.clone().addScaledVector(fd, -0.03 * H).addScaledVector(dn, -0.02 * H), a.clone().addScaledVector(fd, 0.02 * H).addScaledVector(dn, -0.018 * H), a.clone().addScaledVector(fd, 0.08 * H).addScaledVector(dn, -0.024 * H), a.clone().addScaledVector(fd, fl * 0.7).addScaledVector(dn, -0.03 * H)];
    const shoe = sp.shoes ? 1.25 : 1;
    const fx = [0.02, 0.026, 0.03, 0.026].map((x) => x * H * shoe), fz = [0.02, 0.024, 0.016, 0.009].map((x) => x * H * shoe);
    const fsl = sp.shoes ? DK : SK;
    const use = det.rings >= 1 ? [0, 1, 2, 3] : [0, 2, 3];
    tube(g, use.map((k) => fp[k]), use.map((k) => fx[k]), use.map((k) => fz[k]), Math.max(4, det.lr - 2), fsl, Bn.Foot, side, true, true);
    void s;
  }

  // ---- arms: shoulder → elbow → wrist, sleeve or skin by length; then hands
  const sleeve = (t: number): [number, number] => {
    // [slot, inflation (×H)] along the arm, t = 0 shoulder → 1 wrist
    const Lr = lu / (lu + lf);
    switch (d) {
      case 'saree': case 'halfSaree': return t < Lr * 0.42 ? [B, 0.006] : [SK, 0];
      case 'girl': return t < Lr * 0.5 ? [B, 0.008] : [SK, 0];
      case 'salwar': return t < Lr + 0.18 ? [A, 0.009] : [SK, 0];
      case 'kurta': case 'sadhu': return t < 0.97 ? [A, 0.012] : [SK, 0];
      case 'jacket': return t < 0.98 ? [A, 0.02] : [SK, 0];
      case 'shirt': case 'boy': case 'veshtiShirt': return t < Lr * 0.6 ? [d === 'veshtiShirt' ? B : A, 0.012] : [SK, 0];
      case 'kanwariya': return t < Lr * 0.45 ? [A, 0.01] : [SK, 0];
      case 'dhoti': case 'veshtiBare': return [SK, 0];
    }
  };
  const mountainSleeves = sp.shoes && fe; // cardigan under the shawl
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    const S = sh[i], E = elbow[i], W = wrist[i];
    const inner = S.clone().add(v3(-s * 0.012 * H, 0.014 * H, 0));
    const pts0 = [inner, E, W];
    const Lr = inner.distanceTo(E) / (inner.distanceTo(E) + lf);
    const ts = samples([0, 0.08, 0.2, 0.35, Lr * 0.92, Lr, Lr + 0.06, Lr + 0.18, 0.8, 0.92, 1], det, [Lr]);
    const pts = along(pts0, ts);
    const fem = sp.female ? 0.86 : 1;
    const R: [number, number][] = [[0, 0.024], [0.08, 0.031], [0.2, 0.029], [0.35, 0.026], [Lr * 0.92, 0.02], [Lr, 0.02], [Lr + 0.06, 0.022], [Lr + 0.18, 0.021], [0.8, 0.017], [0.92, 0.0145], [1, 0.0135]];
    const rx: number[] = [], rz: number[] = [], sl: number[] = [];
    for (const t of ts) {
      let [c, inf] = sleeve(t);
      if (mountainSleeves && t < 0.97) { c = B; inf = 0.012; }
      const r = prof(R, t) * H * fem * wk + inf * H;
      rx.push(r); rz.push(r * 1.08); sl.push(c);
    }
    // the elbow points back: the section's long axis follows the bend plane
    const hint = E.clone().sub(inner).cross(W.clone().sub(E));
    if (hint.lengthSq() < 1e-8) hint.set(1, 0, 0);
    tube(g, pts, rx, rz, det.lr, sl, i ? Bn.UArmR : Bn.UArmL, hint.normalize(), true, false);
    // hand: a mitten (palm and fingers in one tapered paddle, curled toward the palm) and a thumb
    const hd = handDir[i].clone().normalize();
    const pn = palm[i].clone().sub(hd.clone().multiplyScalar(palm[i].dot(hd))).normalize(); // palm normal
    const across = hd.clone().cross(pn).normalize();
    const hl = 0.108 * H * (child ? 0.9 : 1) * (fe ? 0.94 : 1);
    const curl = pose === 'namaste' || pose === 'sitNamaste' || pose === 'raised' ? 0.05 : 0.25;
    const hp = [W.clone().addScaledVector(hd, -0.004 * H), W.clone().addScaledVector(hd, hl * 0.42), W.clone().addScaledVector(hd, hl * 0.7).addScaledVector(pn, curl * 0.12 * hl), W.clone().addScaledVector(hd, hl * 0.92).addScaledVector(pn, curl * 0.4 * hl)];
    const hw = [0.017, 0.026, 0.024, 0.017].map((x) => x * H * (fe ? 0.92 : 1)), ht = [0.012, 0.0105, 0.009, 0.007].map((x) => x * H);
    const use = det.rings >= 1 ? [0, 1, 2, 3] : det.rings > 0 ? [0, 1, 3] : [0, 3];
    tube(g, use.map((k) => hp[k]), use.map((k) => hw[k]), use.map((k) => ht[k]), Math.max(4, det.lr - 2), SK, Bn.Hand, across, false, true);
    if (det.fine) {
      const tsd = across.clone().multiplyScalar(across.z * (pose === 'namaste' || pose === 'sitNamaste' ? -1 : 1) < 0 ? -1 : 1);
      const tb = W.clone().addScaledVector(hd, hl * 0.18).addScaledVector(tsd, 0.016 * H).addScaledVector(pn, 0.008 * H);
      const tt = tb.clone().addScaledVector(hd, hl * 0.32).addScaledVector(pn, 0.012 * H);
      tube(g, [tb, tt], [0.008 * H, 0.0055 * H], [0.008 * H, 0.0055 * H], 5, SK, Bn.Hand, pn, false, true);
      if (fe && sleeve(0.95)[0] === SK) {
        // a few bangles
        const bc = W.clone().addScaledVector(hd, -0.012 * H);
        const ring: V[] = [];
        const F = frames([bc.clone().addScaledVector(hd, -0.01), bc, bc.clone().addScaledVector(hd, 0.01)], across);
        for (let k = 0; k < 3; k++) ring.push(bc.clone().addScaledVector(hd, (k - 1) * 0.006 * H));
        tube(g, ring, [0.0175 * H, 0.0185 * H, 0.0175 * H], [0.0155 * H, 0.0165 * H, 0.0155 * H], 8, D, Bn.None, F[1].s, false, false);
      }
    }
  }

  // ---- props
  const propStart = g.n;
  if (pose === 'thali') {
    const c = v3(0, 0.6 * H + dy + 0.022 * H, 0.215 * H);
    const r = 0.1 * H, n = Math.max(6, det.tr);
    const rings = [ellRing(c.clone().add(v3(0, -0.006 * H, 0)), v3(1, 0, 0), v3(0, 0, 1), r * 0.7, r * 0.7, n), ellRing(c.clone().add(v3(0, 0.004 * H, 0)), v3(1, 0, 0), v3(0, 0, 1), r, r, n), ellRing(c.clone().add(v3(0, 0.008 * H, 0)), v3(1, 0, 0), v3(0, 0, 1), r * 0.96, r * 0.96, n)];
    g.rings(rings, [PR, PR, PR], Bn.Prop, true, true);
    blob(g, c.clone().add(v3(-0.02 * H, 0.02 * H, 0)), v3(0.055 * H, 0.024 * H, 0.05 * H), Math.max(5, det.hrl >> 1), Math.max(3, det.hrv >> 1), D, Bn.Prop);
    if (det.fine) blob(g, c.clone().add(v3(0.05 * H, 0.014 * H, 0.02 * H)), v3(0.014 * H, 0.008 * H, 0.014 * H), 6, 4, PR, Bn.Prop);
  }
  if (pose === 'bag') {
    const w = wrist[1], bc = w.clone().add(v3(0.008 * H, -0.11 * H, 0));
    const n = Math.max(4, det.tr >> 1);
    const rings: V[][] = [];
    for (const [y, sw, sd] of [[0.06, 0.07, 0.02], [0.0, 0.085, 0.032], [-0.1, 0.09, 0.035], [-0.13, 0.085, 0.03]] as const) {
      rings.push(ellRing(bc.clone().add(v3(0, y * H, 0)), v3(0, 0, 1), v3(1, 0, 0), sw * H, sd * H, n, 4));
    }
    g.rings(rings, [D, D, D, D], Bn.Prop, true, true);
  }
  if (pose === 'kanwar') {
    // the bamboo yoke on the right shoulder, front to back, with a pot slung from each end
    const top = sh[1].clone().add(v3(-0.01 * H, 0.04 * H, 0));
    const a = top.clone().add(v3(0, 0.04 * H, 0.36 * H)), b = top.clone().add(v3(0, -0.02 * H, -0.38 * H));
    tube(g, [a, top, b], [0.012 * H, 0.012 * H, 0.012 * H], [0.012 * H, 0.012 * H, 0.012 * H], Math.max(4, det.lr >> 1), D, Bn.Prop, v3(1, 0, 0));
    for (const e of [a, b]) {
      const pc = e.clone().add(v3(0, -0.24 * H, 0));
      blob(g, pc, v3(0.05 * H, 0.06 * H, 0.05 * H), Math.max(6, det.hrl >> 1), Math.max(4, det.hrv >> 1), PR, Bn.Prop, (u, p) => { if (u.y > 0.6) p.multiplyScalar(0.75); });
      if (det.rings > 0) tube(g, [e, pc.clone().add(v3(0, 0.07 * H, 0))], [0.003 * H, 0.003 * H], [0.003 * H, 0.003 * H], 3, DK, Bn.Prop, v3(1, 0, 0), false, false);
    }
  }
  if (elder && !seated && !step && pose !== 'namaste' && pose !== 'thali' && sp.dress !== 'sadhu' && !sp.female) {
    // a walking stick in the right hand
    const w = wrist[1];
    tube(g, [w.clone().add(v3(0, 0.02 * H, 0)), v3(w.x + 0.02 * H, 0, w.z + 0.03 * H)], [0.009 * H, 0.009 * H], [0.009 * H, 0.009 * H], 4, DK, Bn.Prop, v3(1, 0, 0));
  }
  void propStart;

  // ---- ground: drop the lowest point to y = 0 (standing), or keep the seat at 0
  let minY = Infinity;
  for (let i = 1; i < g.pos.length; i += 3) minY = Math.min(minY, g.pos[i]);
  const lift = step ? 0 : -minY;
  if (lift) g.map(0, (p) => { p.y += lift; });
  const off = v3(0, lift, 0);

  // ---- baked AO from capsule occluders
  const bp = (x: number, y: number, z: number) => { const q = v3(x, y, z); bend(q); return q; };
  const occ: { a: V; b: V; r: number; bone: number }[] = [
    { a: bp(0, 0.55 * H, 0), b: bp(0, 0.68 * H, 0.005 * H), r: 0.085 * H * wk, bone: Bn.Torso },
    { a: bp(0, 0.7 * H, 0.005 * H), b: bp(0, 0.79 * H, 0), r: 0.088 * H * wk, bone: Bn.Torso },
    { a: headC.clone(), b: headC.clone().add(v3(0, 0.001, 0)), r: headR * 0.9, bone: Bn.Head },
  ];
  for (let i = 0; i < 2; i++) {
    occ.push({ a: sh[i], b: elbow[i], r: 0.026 * H, bone: i ? Bn.UArmR : Bn.UArmL });
    occ.push({ a: elbow[i], b: wrist[i], r: 0.021 * H, bone: i ? Bn.UArmR : Bn.UArmL });
    occ.push({ a: hip[i], b: knee[i], r: 0.048 * H, bone: i ? Bn.ThighR : Bn.ThighL });
    occ.push({ a: knee[i], b: ankle[i], r: 0.032 * H, bone: i ? Bn.ThighR : Bn.ThighL });
  }
  for (const o of occ) { o.a = o.a.clone().add(off); o.b = o.b.clone().add(off); }
  const n = g.n;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setIndex(g.idx);
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const cd = new Float32Array(n * 3);
  // (plain numbers: this loop runs over every vertex of every kit)
  const O = occ.map((o) => [o.a.x, o.a.y, o.a.z, o.b.x - o.a.x, o.b.y - o.a.y, o.b.z - o.a.z, o.r, o.bone]);
  const top = H + lift;
  const na = nrm.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const px = g.pos[i * 3], py = g.pos[i * 3 + 1], pz = g.pos[i * 3 + 2];
    const nx = na[i * 3], ny = na[i * 3 + 1], nz = na[i * 3 + 2];
    let ao = 1;
    const bone = g.bone[i];
    for (const [ax, ay, az, bx, by, bz, r, ob] of O) {
      if (ob === bone || (bone === Bn.Neck && ob === Bn.Torso)) continue;
      const L2 = bx * bx + by * by + bz * bz;
      let t = L2 > 1e-9 ? ((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ax + bx * t - px, dy2 = ay + by * t - py, dz = az + bz * t - pz;
      const dl = Math.sqrt(dx * dx + dy2 * dy2 + dz * dz) || 1e-6;
      const cos = (nx * dx + ny * dy2 + nz * dz) / dl;
      if (cos <= 0) continue;
      const dist = dl > r ? dl : r;
      ao *= 1 - Math.min(0.75, (0.9 * r * r) / (dist * dist) * cos);
    }
    // ground and under-chin darkening
    ao *= lerp(0.6, 1, sstep(0, 0.22, py)) * (ny < -0.3 && py > 0.3 ? 0.85 : 1);
    cd[i * 3] = Math.max(0.3, ao);
    cd[i * 3 + 1] = g.slot[i];
    cd[i * 3 + 2] = Math.min(1, Math.max(0, py / top));
  }
  geo.setAttribute('cdata', new THREE.BufferAttribute(cd, 3));
  return geo;
}

// ---------------------------------------------------------------- choosing who stands where

type Rnd = () => number;
const pick = <T,>(r: Rnd, a: T[]) => a[Math.floor(r() * a.length) % a.length];

function chooseSpec(r: Rnd, p: CrowdSpot, outfit: Outfit, kanShare: number, childShare: number, elderShare: number): Spec {
  const kind: Kind = p.kind ?? (r() < 0.45 ? 'saree' : r() < kanShare ? 'kanwariya' : 'kurta');
  const female = kind === 'saree';
  const sitting = !!p.sit || p.pose === 'sit' || p.pose === 'sitNamaste';
  const age: 0 | 1 | 2 = !sitting && !p.pose && r() < childShare && kind !== 'kanwariya' ? 2 : r() < elderShare ? 1 : 0;
  let pose: Pose;
  if (p.pose) pose = p.pose;
  else if (sitting) pose = r() < 0.65 ? 'sit' : 'sitNamaste';
  else if (age === 2) pose = r() < 0.6 ? 'walk' : 'stand';
  else {
    const x = r();
    pose = p.queue ?? (x < 0.3 ? 'stand' : x < 0.55 ? 'walk' : x < 0.7 ? 'namaste' : x < 0.82 ? 'thali' : 'bag');
    if (age === 1 && (pose === 'bag' || pose === 'thali') && r() < 0.5) pose = 'stand';
    if (kind === 'kanwariya' && outfit === 'plains' && r() < 0.16) pose = 'kanwar';
  }
  const mtn = outfit === 'mountain', south = outfit === 'south';
  let dress: Dress, hair: Hair = female ? (r() < 0.55 ? 'bun' : 'braid') : 'short', hood = false, shawl = false;
  if (age === 2) {
    dress = female ? (south || r() < 0.4 ? 'girl' : 'salwar') : 'boy';
    if (female) hair = 'braid';
  } else if (kind === 'kanwariya') {
    if (mtn) { dress = 'sadhu'; shawl = true; hair = r() < 0.6 ? 'jata' : 'bald'; }
    else if (south) { dress = r() < 0.6 ? 'veshtiShirt' : 'veshtiBare'; }
    else if (sitting) dress = 'dhoti';
    else dress = 'kanwariya';
  } else if (female) {
    if (mtn) { dress = r() < 0.5 ? 'saree' : 'salwar'; shawl = true; hood = r() < 0.3; }
    else if (south) dress = r() < 0.78 || age === 1 ? 'saree' : 'halfSaree';
    else { dress = r() < 0.62 || age === 1 ? 'saree' : 'salwar'; hood = dress === 'saree' && (r() < 0.22 || (age === 1 && r() < 0.5)); }
  } else {
    if (mtn) { dress = r() < 0.85 ? 'jacket' : 'kurta'; hair = r() < 0.6 ? 'cap' : 'short'; shawl = dress === 'kurta'; }
    else if (south) { dress = r() < 0.55 ? 'veshtiShirt' : 'veshtiBare'; const h = r(); hair = h < 0.2 ? 'bald' : h < 0.3 ? 'paste' : 'short'; }
    else { const x = r(); dress = x < 0.4 ? 'kurta' : x < 0.75 ? 'shirt' : 'dhoti'; }
    if (age === 1 && hair === 'short' && r() < 0.3) hair = 'bald';
  }
  // the pallu goes over the shoulder, so namaste/thali/bag work with every dress; a kanwar only on a kanwariya
  if (pose === 'kanwar' && dress !== 'kanwariya') pose = 'stand';
  return { dress, female, age, pose, hair, hood, shawl, shoes: mtn };
}

/** the 8-colour palette of one figure */
function palette(r: Rnd, sp: Spec, outfit: Outfit, wet: boolean): [number, number][] {
  const south = outfit === 'south', mtn = outfit === 'mountain';
  const skin = pick(r, SKIN);
  const hair = sp.age === 1 ? pick(r, GREY) : sp.hair === 'paste' ? SANDAL : pick(r, HAIR);
  let a = 0xffffff, b = 0xffffff, c = 0xffffff, dd = pick(r, BORDER);
  let sheenA = 0.15, sheenB = 0.15;
  switch (sp.dress) {
    case 'saree':
      a = mtn ? pick(r, M_SAREE) : south ? pick(r, SILK) : pick(r, SAREE);
      b = r() < 0.45 ? a : mtn ? pick(r, JACKET) : pick(r, south ? SILK : SAREE);
      if (sp.age === 1 && r() < 0.3) { a = 0xf2eee4; dd = pick(r, [0xc8102e, 0x1f5fa8, 0x2e7d32]); }
      sheenA = south ? 0.55 : 0.3; sheenB = 0.25;
      break;
    case 'halfSaree': a = pick(r, SILK); b = pick(r, SILK); c = pick(r, SAREE); sheenA = 0.5; break;
    case 'girl': a = pick(r, south ? SILK : SALWAR); b = pick(r, SALWAR); sheenA = south ? 0.45 : 0.15; break;
    case 'salwar': a = pick(r, mtn ? M_SAREE : SALWAR); b = r() < 0.5 ? pick(r, PYJAMA) : pick(r, SALWAR); c = pick(r, SALWAR); break;
    case 'kurta': a = mtn ? pick(r, JACKET) : pick(r, KURTA); b = pick(r, PYJAMA); c = pick(r, mtn ? SHAWL : DHOTI); break;
    case 'shirt': a = pick(r, SHIRT); b = pick(r, TROUSER); break;
    case 'boy': a = pick(r, SHIRT); b = pick(r, TROUSER); break;
    case 'dhoti': a = pick(r, DHOTI); c = r() < 0.5 ? pick(r, SAFFRON) : pick(r, DHOTI); dd = r() < 0.5 ? 0xf6f2e6 : 0xd4a017; break;
    case 'kanwariya': a = r() < 0.85 ? pick(r, SAFFRON) : pick(r, [0xf6f2e6, 0xf0e8d8]); b = r() < 0.75 ? pick(r, SAFFRON) : pick(r, [0x222224, 0xf6f2e6, 0x34404a]); c = pick(r, GAMCHHA); dd = 0xc8a46a; break;
    case 'jacket': a = pick(r, JACKET); b = pick(r, TROUSER); c = pick(r, CAP); sheenA = 0.35; break;
    case 'sadhu': a = pick(r, SAFFRON); c = pick(r, SHAWL); break;
    case 'veshtiShirt': a = pick(r, VESHTI); b = pick(r, SHIRT); dd = pick(r, [0xd4a017, 0xb81d24, 0x1b5e20, 0x2a2a6a]); break;
    case 'veshtiBare': a = pick(r, VESHTI); c = r() < 0.5 ? 0xf6f2e6 : pick(r, SAFFRON); dd = pick(r, [0xd4a017, 0xb81d24, 0x1b5e20]); break;
  }
  if (sp.shawl) c = pick(r, SHAWL);
  if (sp.hair === 'cap') c = pick(r, CAP);
  if (south && sp.dress.startsWith('veshti') && r() < 0.18) { a = pick(r, AYYAPPA); b = a; } // Ayyappa devotees
  const col = (h: number, jit = 0.06) => { const x = new THREE.Color(h); x.offsetHSL((r() - 0.5) * 0.015, (r() - 0.5) * 0.08, (r() - 0.5) * jit); return x.getHex(); };
  const pal: [number, number][] = [
    [col(a), sheenA], [col(b), sheenB], [col(c), 0.15], [col(skin, 0.04), 0.12], [col(hair, 0.02), 0.35], [col(BRASS, 0.05), 0.7], [col(DARK, 0.03), 0.1], [col(sp.pose === 'thali' ? MARIGOLD : dd, 0.04), 0.4],
  ];
  if (wet) for (let i = 0; i < pal.length; i++) if (i !== SK && i !== HR) { const x = new THREE.Color(pal[i][0]).multiplyScalar(0.62); pal[i] = [x.getHex(), 0.6]; }
  return pal;
}

// ---------------------------------------------------------------- shared kit cache

const kitCache = new Map<string, THREE.BufferGeometry[]>();
function kit(sp: Spec) {
  const k = key(sp);
  let g = kitCache.get(k);
  if (!g) { g = DET.map((d) => figure(sp, d)); kitCache.set(k, g); }
  return g;
}

/** soft dark contact blob texture */
let blobTex: THREE.Texture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// ---------------------------------------------------------------- the crowd

export function buildCrowd(root: THREE.Object3D, spots: CrowdSpot[], opts: CrowdOpts = {}) {
  let s = opts.seed ?? 101;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const clearR = opts.clearRadius ?? 4;
  const paths = opts.clearPaths ?? [];
  const near = (p: CrowdSpot, list: [number, number][][], r: number) => list.some((pl) => pl.some((a, i) => i > 0 && segDist(p.x, p.z, pl[i - 1][0], pl[i - 1][1], a[0], a[1]) < r)
    || (pl.length === 1 && Math.hypot(p.x - pl[0][0], p.z - pl[0][1]) < r));
  const keep = spots.filter((p) => !near(p, paths, clearR) && !near(p, opts.nearPaths ?? [], opts.nearRadius ?? 1.2));
  // phones show an evenly spread share of the crowd (engine/profile.ts); the others are hidden instances, so
  // instance ids still match the spots (sites animate figures by spot index)
  const prof = quality();
  const shown = new Set(thin(keep.map((_, i) => i), prof.crowdShare));
  const outfit = opts.outfit ?? 'plains';
  const kanShare = opts.kanwariyaShare ?? 0.45;

  // who is who
  const specs = keep.map((p) => chooseSpec(rnd, p, outfit, kanShare, opts.childShare ?? 0.08, opts.elderShare ?? 0.1));
  const used = new Map<string, Spec>();
  for (const sp of specs) used.set(key(sp), sp);
  const geos = new Map<string, THREE.BufferGeometry[]>();
  let verts = 0, idx = 0;
  for (const [k, sp] of used) {
    const g = kit(sp);
    geos.set(k, g);
    for (const x of g) { verts += x.attributes.position.count; idx += x.index!.count; }
  }

  // per-instance palettes in a float texture: row = instance id, 8 texels = 8 slots (rgb + sheen)
  const rows = Math.max(1, keep.length);
  const palData = new Float32Array(NSLOT * rows * 4);
  const palTex = new THREE.DataTexture(palData, NSLOT, rows, THREE.RGBAFormat, THREE.FloatType);
  palTex.minFilter = palTex.magFilter = THREE.NearestFilter;
  palTex.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
  const time = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCrowdTime = time;
    sh.uniforms.uCrowdPal = { value: palTex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 cdata;
        uniform float uCrowdTime;
        uniform highp sampler2D uCrowdPal;
        varying vec3 vCrowdCol;
        varying float vCrowdSheen;
        varying vec3 vCrowdObj;
        varying float vCrowdCloth;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vCrowdObj = position * 9.0;
        vCrowdCol = vec3(1.0); vCrowdSheen = 0.0;
        vCrowdCloth = (cdata.y < 2.5 || cdata.y > 6.5) ? 1.0 : 0.0;
        #ifdef USE_BATCHING
          float cid = getIndirectIndex( gl_DrawID );
          vec4 pc = texelFetch( uCrowdPal, ivec2( int( cdata.y + 0.5 ), int( cid ) ), 0 );
          vCrowdCol = pc.rgb * cdata.x;
          vCrowdSheen = pc.a;
          float cph = batchingMatrix[3].x * 1.7 + batchingMatrix[3].z * 2.3;
          float hk = cdata.z * cdata.z;
          transformed.x += sin( uCrowdTime * 1.1 + cph ) * 0.012 * hk;
          transformed.z += cos( uCrowdTime * 0.8 + cph * 1.7 ) * 0.006 * hk;
          transformed.y += sin( uCrowdTime * 1.6 + cph * 0.7 ) * 0.002 * cdata.z;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCrowdCol;
        varying float vCrowdSheen;
        varying vec3 vCrowdObj;
        varying float vCrowdCloth;
        float crowdHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float crowdNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( crowdHash( i ), crowdHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( crowdHash( i + vec3( 0, 1, 0 ) ), crowdHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( crowdHash( i + vec3( 0, 0, 1 ) ), crowdHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( crowdHash( i + vec3( 0, 1, 1 ) ), crowdHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cn = crowdNoise( vCrowdObj ) * 0.6 + crowdNoise( vCrowdObj * 3.1 ) * 0.4;
        diffuseColor.rgb *= vCrowdCol * ( 1.0 + ( cn - 0.5 ) * mix( 0.05, 0.14, vCrowdCloth ) );`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.5, clamp( vCrowdSheen - 0.3, 0.0, 1.0 ) );`)
      .replace('#include <opaque_fragment>', `
        {
          float rim = pow( 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) ), 3.0 );
          outgoingLight += ( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse ) * vCrowdSheen * rim * 0.9;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'crowd-v2';

  const bm = new THREE.BatchedMesh(Math.max(1, keep.length), Math.max(1, verts), Math.max(1, idx), mat);
  const gid = new Map<string, number[]>();
  for (const [k, g] of geos) gid.set(k, g.map((x) => bm.addGeometry(x)));

  const lod: number[][] = [], lodPos: number[] = [];
  const blobs: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), c = new THREE.Color();
  keep.forEach((p, n) => {
    const sp = specs[n];
    const ids = gid.get(key(sp))!;
    const id = bm.addInstance(ids[2]);
    lod[id] = ids; lodPos[id * 2] = p.x; lodPos[id * 2 + 1] = p.z;
    const h = (sp.age === 2 ? 0.92 + rnd() * 0.16 : 0.93 + rnd() * 0.14) * (sp.age === 1 ? 0.97 : 1);
    sc.set(h * (0.95 + rnd() * 0.1), h, h * (0.96 + rnd() * 0.08));
    e.set((rnd() - 0.5) * 0.03, p.ry + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.03);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, sc);
    bm.setMatrixAt(id, m);
    const pal = palette(rnd, sp, outfit, !!p.wet);
    for (let k = 0; k < NSLOT; k++) {
      c.setHex(pal[k][0]);
      const o = (id * NSLOT + k) * 4;
      palData[o] = c.r; palData[o + 1] = c.g; palData[o + 2] = c.b; palData[o + 3] = pal[k][1];
    }
    // contact shadow (stretched along a stride, wider under a seated figure)
    const seated = sp.pose === 'sit' || sp.pose === 'sitNamaste';
    const rr = (seated ? 0.46 : 0.3) * h;
    const bg = new THREE.PlaneGeometry(rr * 2, rr * 2 * (sp.pose === 'walk' ? 1.5 : seated ? 1.0 : 1.15)).rotateX(-Math.PI / 2);
    if (seated) bg.translate(0, 0, 0.1);
    bg.rotateY(p.ry);
    bg.translate(p.x, p.y + 0.008 - (sp.pose === 'step' ? 0.42 * h : 0), p.z);
    if (!shown.has(n)) { bm.setVisibleAt(id, false); return; }
    if (!p.wet) blobs.push(bg);
  });
  palTex.needsUpdate = true;
  bm.castShadow = false;
  bm.receiveShadow = true;
  bm.perObjectFrustumCulled = true;
  bm.name = 'crowd';

  // LOD swap as the camera moves (a few hundred distance checks every ~20 frames or 2 m)
  const far2 = ((opts.lodDistance ?? 25) * prof.lodScale) ** 2;
  const near2 = (Math.min(opts.nearDistance ?? 9, opts.lodDistance ?? 25) * prof.lodScale) ** 2;
  const last = new THREE.Vector3(1e9, 0, 0);
  let frame = 0;
  const state = new Uint8Array(lod.length);
  const swap = (cam: THREE.Camera) => {
    last.copy(cam.position);
    for (let id = 0; id < lod.length; id++) {
      if (!lod[id]) continue;
      const dx = lodPos[id * 2] - cam.position.x, dz = lodPos[id * 2 + 1] - cam.position.z;
      const d2 = dx * dx + dz * dz;
      const lv = d2 < near2 ? 0 : d2 < far2 ? 1 : 2;
      if (state[id] !== lv + 1) { state[id] = lv + 1; bm.setGeometryIdAt(id, lod[id][lv]); }
    }
  };
  const baseBefore = bm.onBeforeRender.bind(bm);
  bm.onBeforeRender = (r, sc2, cam, geo, mt, gr) => {
    if (++frame % 20 === 0 || cam.position.distanceToSquared(last) > 4) swap(cam);
    baseBefore(r, sc2, cam, geo, mt, gr);
  };
  root.add(bm);
  let blobMesh: THREE.Mesh | null = null;
  if (blobs.length) {
    blobMesh = new THREE.Mesh(mergeGeometries(blobs)!, new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0xffffff }));
    blobMesh.renderOrder = 1;
    blobMesh.name = 'crowd-blobs';
    root.add(blobMesh);
  }
  return {
    mesh: bm,
    blobs: blobMesh,
    count: keep.length,
    update(t: number) { time.value = t; },
  };
}

/** Helpers to generate spots. */
export class CrowdSpots {
  list: CrowdSpot[] = [];
  private s: number;
  constructor(seed = 77) { this.s = seed; }
  rnd = () => ((this.s = (this.s * 16807) % 2147483647) / 2147483647);
  add(x: number, y: number, z: number, ry: number, sit = false, kind?: Kind) { this.list.push({ x, y, z, ry, sit, kind }); }
  /** n figures scattered in a rectangle facing roughly `face`, rejected where `bad` says so */
  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, face: number, sitShare = 0, bad?: (x: number, z: number) => boolean) {
    let tries = 0;
    while (n > 0 && tries++ < n * 40) {
      const x = x0 + this.rnd() * (x1 - x0), z = z0 + this.rnd() * (z1 - z0);
      if (bad?.(x, z)) continue;
      if (this.list.some((p) => Math.abs(p.x - x) < 0.5 && Math.abs(p.z - z) < 0.5 && Math.abs(p.y - y) < 0.5)) continue;
      this.add(x, y, z, face + (this.rnd() - 0.5) * 1.0, this.rnd() < sitShare);
      n--;
    }
  }
  /** a queue from a to b, one or two abreast, facing along it */
  queue(a: THREE.Vector3, b: THREE.Vector3, gap = 0.6, abreast = 1) {
    const len = a.distanceTo(b), n = Math.floor(len / gap);
    const ry = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      for (let k = 0; k < abreast; k++) {
        const side = (k - (abreast - 1) / 2) * 0.48 + (this.rnd() - 0.5) * 0.1;
        this.add(a.x + (b.x - a.x) * t + Math.cos(ry) * side, a.y, a.z + (b.z - a.z) * t - Math.sin(ry) * side, ry);
        // people in a queue mostly wait: standing, hands folded, holding offerings; a few shuffle forward
        const h = ((i * 7 + k * 13 + this.list.length * 3) % 20);
        this.list[this.list.length - 1].queue = h < 3 ? 'walk' : h < 6 ? 'namaste' : h < 9 ? 'thali' : h < 11 ? 'bag' : 'stand';
      }
    }
  }
}

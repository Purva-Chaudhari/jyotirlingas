import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry generators for Nagara (north-Indian) temple forms, all returned as
 * non-indexed geometries with base centred at the origin, ready for the Merger.
 */

type Ring = { y: number; s: number };

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Pancha-ratha plan: a square whose sides step out at the central (bhadra) and flanking (pratiratha) offsets. */
export function rathaPlan(bhadra = 0.13, prati = 0.06): THREE.Vector2[] {
  const side: [number, number][] = [
    [-1, 0], [-0.64, 0], [-0.64, prati], [-0.3, prati], [-0.3, bhadra], [0.3, bhadra], [0.3, prati], [0.64, prati], [0.64, 0],
  ];
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of side) {
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/** Sweep a closed plan polygon through scaled rings; optional flat top cap. */
export function loft(plan: THREE.Vector2[], rings: Ring[], capTop = true, smooth = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const N = plan.length;
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let i = 0; i < N; i++) {
      const p = plan[i], q = plan[(i + 1) % N];
      pos.push(
        p.x * A.s, A.y, p.y * A.s, q.x * B.s, B.y, q.y * B.s, q.x * A.s, A.y, q.y * A.s,
        p.x * A.s, A.y, p.y * A.s, p.x * B.s, B.y, p.y * B.s, q.x * B.s, B.y, q.y * B.s,
      );
    }
  }
  if (capTop) {
    const T = rings[rings.length - 1];
    for (let i = 0; i < N; i++) {
      const p = plan[i], q = plan[(i + 1) % N];
      pos.push(0, T.y, 0, p.x * T.s, T.y, p.y * T.s, q.x * T.s, T.y, q.y * T.s);
    }
  }
  fixWinding(pos);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (smooth) {
    // shared vertices → smooth normals (no faceted vertical streaks on rounded forms)
    const m = mergeVertices(g, 1e-4);
    m.computeVertexNormals();
    return m.toNonIndexed();
  }
  g.computeVertexNormals();
  return g;
}

/** Make the first side triangle face outward; flip everything if not (plan handedness). */
function fixWinding(pos: number[]) {
  const a = V3(pos[0], pos[1], pos[2]), b = V3(pos[3], pos[4], pos[5]), c = V3(pos[6], pos[7], pos[8]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  const out = a.clone().add(b).add(c).setY(0);
  if (n.dot(out) < 0) {
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
    }
  }
}

/** Lathe from (radius, y) pairs, optional vertical ribs. Non-indexed. */
export function lathe(prof: [number, number][], seg = 32, ribs = 0, ribDepth = 0.05): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
  if (ribs) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const k = 1 + Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * ribs * 0.5)), 2.5) * ribDepth;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  return ng;
}

export function amalakaGeo(r: number, seg = 32): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [r * 0.55, 0]];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    prof.push([r * 0.45 + Math.cos(a) * r * 0.55, r * 0.32 + Math.sin(a) * r * 0.32]);
  }
  prof.push([r * 0.4, r * 0.66], [0, r * 0.68]);
  return lathe(prof, seg, seg, 0.07);
}

export function kalashGeo(h: number, seg = 20): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [0.3, 0], [0.33, 0.06], [0.2, 0.12], [0.4, 0.3], [0.42, 0.42], [0.28, 0.58],
    [0.14, 0.64], [0.22, 0.7], [0.18, 0.74], [0.09, 0.78], [0.14, 0.86], [0.07, 0.94], [0.025, 1], [0, 1.02]];
  return lathe(prof.map(([r, y]) => [r * h, y * h] as [number, number]), seg);
}

/**
 * One miniature spire on the cluster. u: position along the face (-1..1); t: height fraction where it
 * stands; hw: half-width as a fraction of the main tower's base half-width. Height defaults to a
 * squat 1.6 × its width (as the urushringas at Kashi), each with amalaka and kalash.
 */
export interface SpireChild { u: number; t: number; hw: number; h?: number; corner?: boolean }

/** Build tiers of squat urushringas: `tiers` = [t, hw, us[]] per tier, plus corner kutas. */
function tiered(tiers: [number, number, number[]][], corners: [number, number][]): SpireChild[] {
  const out: SpireChild[] = [];
  for (const [t, hw, us] of tiers) for (const u of us) out.push({ u, t, hw });
  for (const [t, hw] of corners) out.push({ u: 1, t, hw, corner: true });
  return out;
}

/**
 * Kashi's gold shikhara: a beehive of five tiers of miniature spires cascading from the cornice
 * (5, 5, 3, 3, 1 per face), corner kutas climbing every arris, main tower banded by bhumi-amalakas.
 */
export const KASHI_CLUSTER: SpireChild[] = tiered([
  [0.0, 0.29, [0, -0.42, 0.42, -0.78, 0.78]],
  [0.15, 0.25, [0, -0.4, 0.4, -0.74, 0.74]],
  [0.3, 0.21, [0, -0.44, 0.44]],
  [0.45, 0.18, [0, -0.4, 0.4]],
  [0.59, 0.15, [0]],
], [[0, 0.2], [0.15, 0.17], [0.3, 0.15], [0.45, 0.12]]);

/** The southern stone spire: same family, a tier fewer, slightly sparser. */
export const STONE_CLUSTER: SpireChild[] = tiered([
  [0.0, 0.28, [0, -0.44, 0.44, -0.78, 0.78]],
  [0.17, 0.24, [0, -0.42, 0.42]],
  [0.34, 0.2, [0, -0.42, 0.42]],
  [0.51, 0.16, [0]],
], [[0, 0.19], [0.17, 0.16], [0.34, 0.13]]);

/** Distant riverfront shrines: one tier and corner kutas (cheap). */
export const RIVER_CLUSTER: SpireChild[] = tiered([[0.0, 0.32, [0]]], [[0, 0.2]]);

/** Shrine spire: two tiers and corner kutas. */
export const SHRINE_CLUSTER: SpireChild[] = tiered([
  [0.0, 0.3, [0, -0.6, 0.6]],
  [0.24, 0.23, [0]],
], [[0, 0.2], [0.22, 0.16]]);

/** Rekha (curvilinear) profile: half-width at height fraction t — straight-ish below, curving in above. */
let REKHA_EXP = 0.8;
const rekha = (hw: number, t: number) => hw * (0.1 + 0.9 * Math.pow(Math.cos(Math.min(1, t) * Math.PI / 2), REKHA_EXP));

/** Saptaratha plan with narrow recessed slots between the projections (deep vertical shadow lines). */
function saptaratha(depth = 1): THREE.Vector2[] {
  const half: [number, number][] = [
    [-1, 0], [-0.84, 0], [-0.84, -0.03], [-0.79, -0.03], [-0.79, 0.045], [-0.57, 0.045], [-0.57, 0.015], [-0.52, 0.015],
    [-0.52, 0.09], [-0.27, 0.09], [-0.27, 0.06], [-0.22, 0.06], [-0.22, 0.15], [-0.11, 0.15], [-0.11, 0.24],
  ];
  const side = [...half, ...half.slice().reverse().map(([u, o]) => [-u, o] as [number, number])].slice(0, -1);
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of side) {
      const x = 1 + o * depth, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/**
 * One curvilinear tower: vertical rathas, `bands` bhumi courses (each a thin double moulding
 * with an amalaka knob on every corner), neck, amalaka. Finial position returned.
 */
function tower(hw: number, H: number, bands: number, plan: THREE.Vector2[], knobs: boolean, amalakaSeg = 24, smooth = false, lip = 1.045) {
  const rings: Ring[] = [];
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands, s0 = rekha(hw, t0);
    const bh = Math.min(0.06, 0.35 / bands);
    rings.push(
      { y: t0 * H, s: s0 * 0.985 },
      { y: (t0 + bh * 0.25) * H, s: s0 * lip },
      { y: (t0 + bh * 0.6) * H, s: s0 * lip },
      { y: (t0 + bh * 0.75) * H, s: s0 * 0.99 },
      { y: (t0 + (t1 - t0) * 0.45) * H, s: rekha(hw, t0 + (t1 - t0) * 0.45) },
      { y: (t0 + (t1 - t0) * 0.8) * H, s: rekha(hw, t0 + (t1 - t0) * 0.8) },
    );
    if (knobs && k > 0) {
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = amalakaGeo(s0 * 0.2, 12);
        a.scale(1, 0.8, 1);
        a.translate(cx * s0 * 1.0, (t0 + bh * 0.6) * H, cz * s0 * 1.0);
        parts.push(a);
      }
    }
  }
  const top = rekha(hw, 1);
  rings.push({ y: H, s: top * 0.98 }, { y: H + top * 0.12, s: top * 0.72 }, { y: H + top * 0.2, s: top * 0.6 });
  parts.unshift(loft(plan, rings, true, smooth));
  const am = amalakaGeo(top * 1.3, amalakaSeg);
  am.translate(0, H + top * 0.2, 0);
  parts.push(am);
  return { parts, finialY: H + top * 0.2 + top * 1.3 * 0.68, top };
}

/**
 * A Nagara shikhara of base half-width `hw` and body height `H`, clad in stacked urushringas.
 * `body` holds the stone/gold mass; `finials` the small kalashas topping every miniature spire
 * (place them in gold/gilt); `topY` is where the main kalash sits.
 */
export function nagaraSpire(hw: number, H: number, cluster: SpireChild[], bands = 6) {
  const plan = saptaratha();
  const main = tower(hw, H, bands, plan, true, 40);
  const parts = [...main.parts];
  const fins: THREE.BufferGeometry[] = [];
  // miniature spires: a rounded, deeply ribbed plan reads as the bulbous clusters seen in the photographs
  const childPlan: THREE.Vector2[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rib = 0.9 + 0.09 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5) + 0.035 * Math.pow(Math.abs(Math.cos(a * 16)), 2);
    childPlan.push(new THREE.Vector2(Math.cos(a) * rib, Math.sin(a) * rib));
  }
  for (const c of cluster) {
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2;
      const s = rekha(hw, c.t);
      const chw = c.hw * hw * 1.15, ch = c.h !== undefined ? c.h * H : chw * 2 * 1.45;
      let lx: number, lz: number;
      // the cluster's outer envelope is convex (a beehive bulging in the lower middle):
      // each miniature spire is placed so its outer edge touches E(t), embedded behind it in the body
      const tt = Math.min(1, c.t);
      const E = hw * (1.1 + 0.26 * Math.sin(Math.PI * Math.min(1, tt / 0.7))) * Math.pow(Math.cos(tt * Math.PI / 2), 0.3);
      if (c.corner) {
        const d = Math.max(s * 0.55, (E * 0.84) - chw * 1.0);
        lx = d; lz = d;
      } else {
        const k = Math.abs(c.u) < 0.3 ? 1.0 : 0.95;
        lx = Math.max(s * 0.5, E * k - chw * 1.12); lz = c.u * s;
      }
      const x = lx * Math.cos(a) - lz * Math.sin(a), z = lx * Math.sin(a) + lz * Math.cos(a);
      REKHA_EXP = 0.55; // miniature spires are plump, bulbous: they merge into one rounded mass
      const tb = tower(chw, ch, 3, childPlan, false, 14, true, 1.05);
      REKHA_EXP = 0.8;
      for (const geo of tb.parts) { geo.translate(x, c.t * H, z); parts.push(geo); }
      const f = kalashGeo(tb.top * 1.25, 10);
      f.translate(x, c.t * H + tb.finialY, z);
      fins.push(f);
    }
  }
  return {
    body: mergeGeometries(parts.map(clean), false)!,
    finials: fins.length ? mergeGeometries(fins.map(clean), false)! : new THREE.BufferGeometry(),
    topY: main.finialY,
    topHalf: main.top,
  };
}

/** Strip to position + normal so differently built parts merge. */
function clean(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}

/** Onion dome on a short neck, with vertical ribs; base radius r, total height ≈ 1.45 r (excl. finial). */
export function onionDome(r: number, ribs = 24, seg = 48): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [r * 0.92, 0], [r * 0.95, r * 0.05]];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const rr = r * (1.0 + 0.13 * Math.sin(t * Math.PI)) * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 0.75);
    prof.push([Math.max(rr, r * 0.1), r * 0.05 + Math.sin(t * Math.PI * 0.5) * r * 1.15]);
  }
  prof.push([r * 0.07, r * 1.3], [r * 0.04, r * 1.42], [0, r * 1.45]);
  return lathe(prof, seg, ribs, ribs <= 16 ? 0.05 : 0.035);
}

/** Lotus-petal collar (a ring of drooping petals) for the base of a dome. */
export function petalRing(r: number, n = 24, h = 0.35): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const petal = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = petal.clone();
    g.scale((Math.PI * r) / n * 1.1, h, h * 0.45);
    g.rotateX(-0.25);
    g.translate(0, 0, r);
    g.rotateY(a);
    parts.push(g.toNonIndexed());
  }
  const m = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }), false)!;
  return m;
}

/** Phamsana roof: stacked tiers on a ratha plan, each a projecting slab with a knob at every corner, under a ribbed bell. */
export function tieredRoofGeo(half: number, tiers: number, tierH: number): { geo: THREE.BufferGeometry; top: number } {
  const parts: THREE.BufferGeometry[] = [];
  const plan = rathaPlan(0.12, 0.05);
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const sc = half * (1 - i / (tiers + 1.3));
    parts.push(loft(plan, [
      { y, s: sc * 0.86 }, { y: y + tierH * 0.12, s: sc * 1.0 }, { y: y + tierH * 0.42, s: sc * 0.98 },
      { y: y + tierH * 0.5, s: sc * 0.8 }, { y: y + tierH, s: sc * 0.78 },
    ], false));
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const k = kalashGeo(tierH * 0.75, 8);
      k.translate(cx * sc * 0.97, y + tierH * 0.42, cz * sc * 0.97);
      parts.push(k);
    }
    // a carved fringe of little lotus buds along every tier's eave
    const n = Math.max(3, Math.round((sc * 2) / Math.max(0.22, tierH * 0.7)));
    for (let side = 0; side < 4; side++) {
      for (let k = 1; k < n; k++) {
        const u = -sc + (k * 2 * sc) / n;
        const bud = new THREE.ConeGeometry(tierH * 0.14, tierH * 0.32, 6).translate(0, tierH * 0.16, 0).toNonIndexed();
        bud.deleteAttribute('uv');
        const [bx, bz] = side === 0 ? [sc * 1.0, u] : side === 1 ? [-sc * 1.0, u] : side === 2 ? [u, sc * 1.0] : [u, -sc * 1.0];
        bud.translate(bx, y + tierH * 0.42, bz);
        parts.push(bud);
      }
    }
    y += tierH;
  }
  const bell = lathe([[half * 0.42, 0], [half * 0.4, half * 0.12], [half * 0.3, half * 0.3], [half * 0.12, half * 0.4], [0, half * 0.42]], 24, 16, 0.08);
  bell.translate(0, y, 0);
  parts.push(bell);
  return { geo: mergeGeometries(parts.map(clean), false)!, top: y + half * 0.42 };
}

/** Small open pavilion: four posts, slab, eave and a dome. Base at y=0; footprint 2s × 2s. */
export function chhatriGeo(s: number, postH: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.BoxGeometry(s * 2.1, s * 0.25, s * 2.1).translate(0, s * 0.125, 0);
  parts.push(base);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = new THREE.CylinderGeometry(s * 0.09, s * 0.11, postH, 8).translate(x * s * 0.82, s * 0.25 + postH / 2, z * s * 0.82);
    parts.push(c);
  }
  const y = s * 0.25 + postH;
  parts.push(new THREE.BoxGeometry(s * 2.0, s * 0.16, s * 2.0).translate(0, y + s * 0.08, 0));
  parts.push(new THREE.CylinderGeometry(s * 1.12 * Math.SQRT2, s * 0.98 * Math.SQRT2, s * 0.18, 4).rotateY(Math.PI / 4).translate(0, y + s * 0.25, 0));
  const d = onionDome(s * 0.85, 16, 24);
  d.translate(0, y + s * 0.34, 0);
  const k = kalashGeo(s * 0.5);
  k.translate(0, y + s * 0.34 + s * 0.85 * 1.43, 0);
  const all = parts.map((p) => { const n = p.toNonIndexed(); n.deleteAttribute('uv'); return n; });
  all.push(d, k);
  return mergeGeometries(all, false)!;
}

/**
 * A wall panel (in the XY plane, base at y=0, centred on x, depth along z) of width W and height H
 * with a cusped (multifoil) arched opening of width ow springing at height sy with rise `rise`.
 */
export function archWallGeo(W: number, H: number, depth: number, ow: number, sy: number, rise: number, cusps = 7): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(-ow / 2, 0);
  s.lineTo(-ow / 2, sy);
  for (const p of cuspedArchShape(ow, rise, cusps)) s.lineTo(p.x, sy + p.y);
  s.lineTo(ow / 2, sy);
  s.lineTo(ow / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.lineTo(-W / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
}

/** A blind (recessed) cusped niche: the arch outline as a thin dark plate, for wall relief. */
export function archPlateGeo(ow: number, sy: number, rise: number, cusps = 5): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-ow / 2, 0);
  s.lineTo(-ow / 2, sy);
  for (const p of cuspedArchShape(ow, rise, cusps)) s.lineTo(p.x, sy + p.y);
  s.lineTo(ow / 2, sy);
  s.lineTo(ow / 2, 0);
  s.lineTo(-ow / 2, 0);
  const g = new THREE.ShapeGeometry(s, 2);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
}

/** Outline of a cusped arch from left springing to right springing (y ≥ 0). */
export function cuspedArchShape(span: number, rise: number, cusps = 7): THREE.Vector2[] {
  const w = span / 2;
  const pts: THREE.Vector2[] = [];
  const N = 56;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = Math.PI * (1 - t);
    const bx = Math.cos(a) * w;
    const by = Math.pow(Math.sin(a), 0.75) * rise;
    const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * cusps)), 0.55) * 0.07 * span;
    pts.push(new THREE.Vector2(bx * (1 - (cusp / w) * 0.35), Math.max(0, by - cusp)));
  }
  return pts;
}

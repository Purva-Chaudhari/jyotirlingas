import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry generators for the Bhimashankar temple (non-indexed, position + normal only unless noted).
 */

export type Ring = { y: number; s: number };

/** Strip to position + normal so differently built parts merge. */
export function clean(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}

/**
 * The garbhagriha's star of projections: every face is broken into `cols` narrow pilaster-like
 * rathas separated by recessed slots, stepping out towards the central bhadra — the reason the
 * walls and spire of Bhimashankar read as a forest of vertical columns. Unit half-size 1.
 */
export function rathaPlan(cols = 9, bhadra = 0.12, slot = 0.025): THREE.Vector2[] {
  const side: [number, number][] = [];
  const w = 2 / cols;
  for (let k = 0; k < cols; k++) {
    const u0 = -1 + k * w, u1 = u0 + w, uc = (u0 + u1) / 2;
    // offset rises in steps toward the centre
    const o = bhadra * Math.pow(1 - Math.abs(uc), 0.8) * (k === Math.floor(cols / 2) ? 1.15 : 1);
    const g = w * 0.14;
    if (k > 0) side.push([u0, o - slot]);
    side.push([u0 + (k > 0 ? g : 0), o - (k > 0 ? slot : 0)]);
    side.push([u0 + (k > 0 ? g : 0), o]);
    side.push([u1 - (k < cols - 1 ? g : 0), o]);
    if (k < cols - 1) side.push([u1 - g, o - slot]);
  }
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2, c = Math.cos(a), si = Math.sin(a);
    for (let i = 0; i < side.length; i++) {
      const [u, o] = side[i];
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

/** Square with rounded corners (for the stepped mandapa roofs); half sizes hx, hz, corner radius cr. */
export function roundedRect(hx: number, hz: number, cr: number, seg = 4): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const corners: [number, number, number][] = [[hx - cr, hz - cr, 0], [-hx + cr, hz - cr, Math.PI / 2], [-hx + cr, -hz + cr, Math.PI], [hx - cr, -hz + cr, Math.PI * 1.5]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * cr, cz + Math.sin(a) * cr));
    }
  }
  return pts;
}

/** Sweep a closed plan polygon through rings {y, s}: optional per-axis scale via sx/sz on the plan. */
export function loft(plan: THREE.Vector2[], rings: Ring[], capTop = true): THREE.BufferGeometry {
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
  // make sides face outward whatever the plan's handedness
  const a = new THREE.Vector3(pos[0], pos[1], pos[2]), b = new THREE.Vector3(pos[3], pos[4], pos[5]), c = new THREE.Vector3(pos[6], pos[7], pos[8]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (n.dot(a.clone().add(b).add(c).setY(0)) < 0) {
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Remove triangles whose centroid falls inside an axis-aligned box (to cut a doorway out of a loft). */
export function cutBox(g: THREE.BufferGeometry, min: THREE.Vector3, max: THREE.Vector3) {
  const p = g.attributes.position.array as Float32Array;
  const n = g.attributes.normal.array as Float32Array;
  const op: number[] = [], on: number[] = [];
  for (let i = 0; i < p.length; i += 9) {
    const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    if (cx > min.x && cx < max.x && cy > min.y && cy < max.y && cz > min.z && cz < max.z) continue;
    for (let k = 0; k < 9; k++) { op.push(p[i + k]); on.push(n[i + k]); }
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
  o.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
  return o;
}

/** Lathe from (radius, y) pairs, optional vertical ribs. Non-indexed; keeps UVs if `uv`. */
export function lathe(prof: [number, number][], seg = 32, ribs = 0, ribDepth = 0.05, uv = false): THREE.BufferGeometry {
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
  if (!uv) ng.deleteAttribute('uv');
  return ng;
}

/** Ribbed amalaka (lime-washed on this temple): a wide cushion with deep ribs. */
export function amalakaGeo(r: number, seg = 48, ribs = 32): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [r * 0.6, 0]];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    prof.push([r * 0.5 + Math.cos(a) * r * 0.5, r * 0.28 + Math.sin(a) * r * 0.28]);
  }
  prof.push([r * 0.45, r * 0.6], [0, r * 0.62]);
  return lathe(prof, seg, ribs, 0.08);
}

/** The white crown that caps the shikhara and the mandapa domes: neck, ribbed cushion, cup, bulb. */
export function crownGeo(r: number): { geo: THREE.BufferGeometry; top: number } {
  const neck = lathe([[r * 0.62, 0], [r * 0.55, r * 0.1], [r * 0.55, r * 0.18], [r * 0.7, r * 0.22], [r * 0.7, r * 0.26], [0, r * 0.26]], 40);
  const am = amalakaGeo(r, 56, 40);
  am.translate(0, r * 0.24, 0);
  const cup = lathe([[0, 0], [r * 0.5, 0], [r * 0.62, r * 0.08], [r * 0.6, r * 0.13], [r * 0.3, r * 0.16], [r * 0.24, r * 0.26], [r * 0.32, r * 0.4],
    [r * 0.28, r * 0.5], [r * 0.12, r * 0.56], [0, r * 0.57]], 32, 16, 0.06);
  cup.translate(0, r * 0.85, 0);
  return { geo: mergeGeometries([neck, am, cup].map(clean), false)!, top: r * 1.42 };
}

/** Gilded kalash: pot, lid and the tall pointed bud seen on all of Bhimashankar's finials. */
export function kalashGeo(h: number): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [0.16, 0], [0.18, 0.04], [0.12, 0.08], [0.24, 0.18], [0.25, 0.26], [0.16, 0.34], [0.09, 0.37],
    [0.13, 0.4], [0.1, 0.43], [0.16, 0.5], [0.19, 0.6], [0.17, 0.7], [0.11, 0.8], [0.05, 0.92], [0.012, 1], [0, 1.01]];
  return lathe(prof.map(([r, y]) => [r * h, y * h] as [number, number]), 24);
}

/**
 * An urushringa (miniature spire) — a tall bell-shaped spindle with base mouldings, a ribbed body
 * and a little amalaka; height 1, base radius 1. UVs kept for the carved skin.
 */
export function spindleGeo(seg = 14): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [1, 0], [1, 0.035], [0.9, 0.055], [0.97, 0.1], [0.9, 0.12]];
  // a fat bell: nearly straight below, rounding over into the shoulder
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    prof.push([0.9 * (1 - 0.6 * Math.pow(t, 1.8)), 0.12 + t * 0.68]);
  }
  prof.push([0.3, 0.83], [0.4, 0.86], [0.41, 0.89], [0.26, 0.92], [0.12, 0.97], [0, 1]);
  return lathe(prof, seg, 12, 0.07, true);
}

/**
 * Bhimashankar's urushringa (round 3, from news_tv9_2026 / news_ahmednagar_2026): an elongated ribbed bud,
 * about twice as tall as it is wide, on a moulded base; it swells a little low down, draws in along a
 * convex curve to a slim neck, a small ribbed amalaka ring and a pointed bud tip (unit radius and height;
 * place it with scale (r, 4r, r) for h:w = 2).
 */
export function urushringaGeo(seg = 16): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [1, 0], [1, 0.02], [0.9, 0.035], [0.96, 0.05], [0.92, 0.065]];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    // a thin fillet a third of the way up, otherwise a smooth convex bud
    const ring = 1 - 0.05 * Math.exp(-Math.pow((t - 0.3) / 0.03, 2));
    prof.push([0.92 * (1 + 0.07 * Math.sin(t * Math.PI * 0.8)) * (1 - 0.74 * Math.pow(t, 1.55)) * ring, 0.065 + t * 0.73]);
  }
  prof.push([0.2, 0.81], [0.3, 0.825], [0.31, 0.85], [0.2, 0.87], [0.15, 0.9], [0.09, 0.94], [0.035, 0.975], [0, 1]);
  return lathe(prof, seg, 16, 0.1, true);
}

/** A pendant bracket (under the cornice of the garbhagriha): a small inverted bud. */
export function bracketGeo(): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 1], [0.5, 1], [0.55, 0.85], [0.42, 0.6], [0.3, 0.3], [0.12, 0.08], [0, 0]];
  return lathe(prof, 10);
}

/** Round-topped knob for the stepped roofs (a little ghanta), base radius 1, height 1. */
export function knobGeo(): THREE.BufferGeometry {
  return lathe([[0, 0], [1, 0], [1.02, 0.18], [0.9, 0.45], [0.62, 0.75], [0.3, 0.93], [0.08, 1.02], [0, 1.08]], 10);
}

/** Outline of a cusped (Maratha) arch from left springing to right springing (y ≥ 0). */
export function cuspedArchShape(span: number, rise: number, cusps = 7): THREE.Vector2[] {
  const w = span / 2;
  const pts: THREE.Vector2[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI * (1 - t);
    const bx = Math.cos(a) * w;
    // slightly pointed: the crown rises to a soft point
    const by = Math.pow(Math.sin(a), 0.7) * rise * (1 + 0.12 * Math.pow(Math.sin(a), 8));
    const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * cusps)), 0.55) * 0.06 * span;
    pts.push(new THREE.Vector2(bx * (1 - (cusp / w) * 0.3), Math.max(0, by - cusp)));
  }
  return pts;
}

/**
 * Wall panel (XY plane, base at y = 0, centred on x, depth along z) of width W, height H, with a
 * cusped arched opening of width ow from height `sill` springing at `sy` with rise `rise`.
 */
export function archWallGeo(W: number, H: number, depth: number, ow: number, sill: number, sy: number, rise: number, cusps = 7): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-ow / 2, sill);
  hole.lineTo(-ow / 2, sy);
  for (const p of cuspedArchShape(ow, rise, cusps)) hole.lineTo(p.x, sy + p.y);
  hole.lineTo(ow / 2, sy);
  hole.lineTo(ow / 2, sill);
  hole.lineTo(-ow / 2, sill);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return clean(g);
}

/** A thin arch-shaped frame moulding (the raised border round an arch). */
export function archFrameGeo(ow: number, sy: number, rise: number, width: number, depth: number, cusps = 7): THREE.BufferGeometry {
  const outer = cuspedArchShape(ow + width * 2, rise + width, 0);
  const inner = cuspedArchShape(ow, rise, cusps);
  const s = new THREE.Shape();
  s.moveTo(-ow / 2 - width, 0);
  for (const p of outer) s.lineTo(p.x, sy + p.y);
  s.lineTo(ow / 2 + width, 0);
  s.lineTo(ow / 2, 0);
  for (let i = inner.length - 1; i >= 0; i--) s.lineTo(inner[i].x, sy + inner[i].y);
  s.lineTo(-ow / 2, 0);
  s.lineTo(-ow / 2 - width, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return clean(g);
}

/** A flat plate in the XY plane (for niche reliefs), w × h, base at y = 0, UVs 0..1. */
export function plate(w: number, h: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
}

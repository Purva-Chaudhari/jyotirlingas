import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import { glyphGeometry } from './glyph';

/**
 * Mahakaleshwar's Bhumija shikhara, modelled from 2024–25 photographs:
 * a gently convex, peach-painted spire whose faces are vertical strings of
 * miniature towers (kutas), each capped with a small gilded finial, a ribbed
 * central band (latā) on every face, heavier towers clustered at the base, and
 * the projecting arched niche with the red "ॐ" on the front face.
 */

/** Fraction of the base width left at the top platform (from photos: ~0.2). */
const TOP = 0.26;

/** A square plan with projections (rathas) along each side, as (along-side, outward) pairs. */
function starPlan(side: [number, number][]): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    const c = Math.cos(a), si = Math.sin(a);
    for (const [u, o] of side) {
      const x = 1 + o, z = u;
      pts.push(new THREE.Vector2(x * c - z * si, x * si + z * c));
    }
  }
  return pts;
}

const BODY_PLAN = starPlan([
  [-1, 0], [-0.82, 0], [-0.82, -0.07], [-0.55, -0.07], [-0.55, 0.0], [-0.2, 0.0], [-0.2, 0.06],
  [0.2, 0.06], [0.2, 0.0], [0.55, 0.0], [0.55, -0.07], [0.82, -0.07], [0.82, 0],
]);

/** Stack plan polygons scaled by r at height y into an outward-facing skin (closed at the top if r→0). */
function ringStack(plan: THREE.Vector2[], rings: [number, number][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const N = plan.length;
  for (let r = 0; r < rings.length - 1; r++) {
    const [ra, ya] = rings[r], [rb, yb] = rings[r + 1];
    for (let i = 0; i < N; i++) {
      const p = plan[i], q = plan[(i + 1) % N];
      const a = [p.x * ra, ya, p.y * ra], b = [q.x * ra, ya, q.y * ra];
      const c = [q.x * rb, yb, q.y * rb], d = [p.x * rb, yb, p.y * rb];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  // orient faces outward whatever the plan's handedness
  const A = new THREE.Vector3(pos[0], pos[1], pos[2]), B = new THREE.Vector3(pos[3], pos[4], pos[5]), C = new THREE.Vector3(pos[6], pos[7], pos[8]);
  const n = B.clone().sub(A).cross(C.clone().sub(A));
  if (n.dot(A.clone().add(B).add(C).setY(0)) < 0) {
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A miniature spire (urushringa), unit height and half-width 0.5, as on the 2025 close-ups
 * (shikhar_top_closeup_2025, cm12): a moulded foot, then five horizontal ribbed tiers (bhumi bands)
 * stepping inward along a curved outline, each ending in a notch, then a neck, a flattened ribbed
 * amalaka and a short neck (the gold kalash sits on top, see finial). `segs` sets the lathe resolution.
 */
function kutaGeometry(segs = 16, TIERS = 5): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [0.5, 0], [0.5, 0.035], [0.45, 0.055]];
  const y0 = 0.055, y1 = 0.75;
  for (let k = 0; k < TIERS; k++) {
    const ta = k / TIERS, tb = (k + 1) / TIERS;
    const r = (t: number) => 0.47 * (1 - 0.72 * Math.pow(t, 1.5));
    const ya = y0 + (y1 - y0) * ta, yb = y0 + (y1 - y0) * tb;
    if (TIERS < 4) prof.push([r(ta) * 1.03, ya + 0.01], [r(tb) * 1.02, yb - 0.02], [r(tb) * 0.88, yb - 0.006]); // low-detail tiers
    else prof.push([r(ta), ya + 0.005], [r(ta) * 1.04, ya + 0.02], [r((ta + tb) / 2) * 1.0, (ya + yb) / 2], [r(tb) * 1.02, yb - 0.025], [r(tb) * 0.88, yb - 0.008]);
  }
  // neck, amalaka (flattened ribbed cushion), neck
  if (TIERS < 4) prof.push([0.1, 0.76], [0.21, 0.79], [0.16, 0.83], [0.0, 0.85]);
  else prof.push([0.1, 0.76], [0.16, 0.77], [0.21, 0.79], [0.21, 0.81], [0.16, 0.83], [0.08, 0.84], [0.0, 0.85]);
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * 0.94, y)), segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    let k = 1;
    if (y > 0.05 && y < 0.75) k = 1 - 0.06 * Math.pow(Math.abs(Math.sin(a * 4)), 1.2); // square-ish plan with projecting faces
    else if (y > 0.775 && y < 0.83) k = 1 + 0.12 * Math.pow(Math.abs(Math.cos(a * 8)), 3); // amalaka ribs
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** The small gold kalash crowning every miniature spire: a pot with a lip and a point (~0.25 m). */
function finialGeometry(segs = 12): THREE.BufferGeometry {
  if (segs < 8) return new THREE.LatheGeometry([[0, 0], [0.26, 0.12], [0.22, 0.3], [0.12, 0.4], [0.0, 0.8]].map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const prof: [number, number][] = [[0, 0], [0.14, 0], [0.24, 0.06], [0.3, 0.16], [0.28, 0.27], [0.18, 0.34], [0.12, 0.37],
    [0.18, 0.41], [0.16, 0.45], [0.08, 0.5], [0.05, 0.66], [0.0, 0.8]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

/** A public-address horn: a flared grey cone on a small driver box. */
function hornGeometry(): THREE.BufferGeometry {
  const cone = new THREE.CylinderGeometry(0.28, 0.06, 0.55, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.42).toNonIndexed();
  const back = new THREE.CylinderGeometry(0.1, 0.12, 0.22, 10).rotateX(Math.PI / 2).translate(0, 0, 0.06).toNonIndexed();
  cone.deleteAttribute('uv');
  back.deleteAttribute('uv');
  const g = mergeGeometries([cone, back])!;
  g.computeVertexNormals();
  return g;
}

export interface ShikharaAccents {
  dark: THREE.Material;
  gold: THREE.Material;
  /** glossy red of the raised ॐ */
  om: THREE.Material;
  /** grey metal of the loudspeaker horns */
  horn: THREE.Material;
}

/**
 * Build the spire on top of y0 with half-width halfW at its base and the given height.
 * Returns the height of the top platform and its half-width.
 */
export function shikhara(
  parent: THREE.Object3D, mat: THREE.Material, y0: number, halfW: number, height: number, accents: ShikharaAccents,
  opts: { mini?: boolean } = {},
) {
  const mini = !!opts.mini;
  // gently convex outline: slow taper low down, faster near the top (photos 2024–25)
  // convex: the shoulders bulge in the lower half and the outline curves in towards the top
  const width = (t0: number, t = Math.max(0, t0)) => halfW * (1 - (1 - TOP) * Math.pow(t, 1.45) + 0.025 * Math.sin(Math.PI * Math.min(1, t * 1.6))
    - 0.07 * Math.sin(Math.PI * Math.max(0, (t - 0.62) / 0.38)));
  const yAt = (t: number) => y0 + height * t;

  // ---- body: horizontal mouldings on the stellate plan ----
  const courses = mini ? 8 : 22;
  const rings: [number, number][] = [];
  for (let k = 0; k <= courses; k++) {
    const t = k / courses;
    rings.push([width(t) * 0.94, yAt(t)], [width(t) * 0.88, yAt(t) + (height / courses) * 0.25]);
  }
  rings.pop();
  const body = new THREE.Mesh(worldUV(ringStack(BODY_PLAN, rings), 1.6), mat);
  body.castShadow = body.receiveShadow = true;
  parent.add(body);
  // top platform cap
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width(1) * 2.0, 0.08, width(1) * 2.0), mat);
  cap.position.y = yAt(1) - 0.04;
  parent.add(cap);

  // (side 1 faces +z = the front); point on face `side` at along-face u, height t, pushed out
  const facePoint = (side: number, u: number, t: number, push: number) => {
    const a = (side * Math.PI) / 2, s = width(t);
    const lx = s + push, lz = u * s;
    return new THREE.Vector3(lx * Math.cos(a) - lz * Math.sin(a), yAt(t), lx * Math.sin(a) + lz * Math.cos(a));
  };
  const faceTurn = (side: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(side * Math.PI) / 2);

  const spots: THREE.Matrix4[] = [];
  const tips: THREE.Matrix4[] = [];
  const holes: THREE.Matrix4[] = [];
  const holeLocal: THREE.Matrix4[] = [];
  // small square dark perforations (~0.12 m) on the outer face: two in the second tier, one in the fourth
  const holeAt: [number, number, number][] = [[0.25, 0.4, -0.14], [0.25, 0.4, 0.14], [0.53, 0.3, 0]];
  void holeLocal;
  const add = (p: THREE.Vector3, q: THREE.Quaternion, w: number, h: number, pigeonHoles = true) => {
    const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(w, h, w));
    spots.push(m);
    const f = w * 0.5;
    // the gold kalash on every urushringa (the gold dots are the strongest cue in every photograph)
    tips.push(new THREE.Matrix4().compose(p.clone().add(new THREE.Vector3(0, h * 0.85, 0)), q, new THREE.Vector3(f * 0.62, Math.min(f * 0.9, h * 0.32), f * 0.62)));
    if (!pigeonHoles || mini) return;
    const hs = Math.min(0.12, w * 0.12);
    for (const [y, xr, zz] of holeAt) {
      holes.push(m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(xr, y, zz), new THREE.Quaternion(), new THREE.Vector3(0.08, hs / h, hs / w))));
    }
  };

  // ---- tiers of miniature towers, in vertical strings, shrinking towards the top ----
  const R = mini ? 5 : 10, ratio = mini ? 0.84 : 0.91;
  const hs = Array.from({ length: R }, (_, k) => Math.pow(ratio, k));
  const sum = hs.reduce((a, b) => a + b, 0);
  const bands: { t0: number; t1: number }[] = [];
  let acc = 0;
  for (const h of hs) {
    const t0 = acc / sum;
    acc += h;
    bands.push({ t0, t1: acc / sum });
  }
  // a projecting moulding at the foot of every tier, so the tiers read as horizontal courses
  const ledges: [number, number][] = [];
  const lt = mini ? height * 0.012 : 0.14;
  bands.forEach(({ t0 }) => ledges.push([width(t0) * 0.99, yAt(t0)], [width(t0) * 0.99, yAt(t0) + lt]));
  for (let i = 0; i < ledges.length; i += 2) {
    const lg = new THREE.Mesh(worldUV(ringStack(BODY_PLAN, [[ledges[i][0] * 0.96, ledges[i][1] - 0.05], ledges[i], ledges[i + 1], [ledges[i][0] * 0.95, ledges[i + 1][1] + 0.03]]), 1), mat);
    lg.castShadow = lg.receiveShadow = true;
    parent.add(lg);
  }
  const latas: THREE.Matrix4[] = [];
  // deterministic jitter so the strings are clustered and slightly staggered, not a grid
  const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  bands.forEach(({ t0, t1 }, k) => {
    const s = width(t0);
    const rowH = (t1 - t0) * height;
    const w = s * 0.36;
    for (let side = 0; side < 4; side++) {
      const q = faceTurn(side);
      // one big bell-topped tower per half-face, overlapping the tier above, its position wandering
      // from tier to tier; between it and the spine, a smaller one set back in shadow
      for (const sg of [-1, 1]) {
        const h = hash(k * 31 + side * 7 + (sg > 0 ? 1 : 0));
        const ww = w * (0.9 + 0.2 * h);
        const u = sg * (0.5 + (k % 2 ? 0.06 : -0.04) + (h - 0.5) * 0.08);
        add(facePoint(side, u, t0 + (h - 0.5) * 0.008, ww * 0.18), q, ww, rowH * (1.35 + 0.15 * h));
        if (k < R - 1 && !mini) add(facePoint(side, sg * 0.2, t0 + (t1 - t0) * 0.12, -ww * 0.05), q, ww * 0.62, rowH * 1.05);
      }
      // corner string stands proud: big towers pushed out on the diagonal, so the outline is lumpy
      const a = (side * Math.PI) / 2 + Math.PI / 4;
      const hc = hash(k * 13 + side * 5 + 99);
      const cr = s * Math.SQRT2 * (1.0 + 0.04 * hc);
      const cq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      add(new THREE.Vector3(Math.cos(a) * cr, yAt(t0), Math.sin(a) * cr), cq, w * (0.95 + 0.1 * hc), rowH * 1.4);
      // central spine (latā) with a small tower in every tier, set back
      const p = facePoint(side, 0, t0, s * 0.01);
      latas.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(s * 0.17, rowH, s * 0.12)));
      const skip = side === 1 && (k === 2 || k === 3);
      if (!skip && !mini) add(facePoint(side, 0, t0 + (t1 - t0) * 0.2, s * 0.06), q, s * 0.16, rowH * 0.95);
    }
  });
  // heavier towers clustered round the base of each face
  const s0 = width(0), h0 = (bands[0].t1 - bands[0].t0) * height;
  for (let side = 0; side < 4; side++) {
    const q = faceTurn(side);
    for (const u of [-0.5, 0.5]) add(facePoint(side, u, 0, s0 * 0.14), q, s0 * 0.4, h0 * 1.6);
  }

  const kutas = new THREE.InstancedMesh(worldUV(kutaGeometry(mini ? 6 : 12, mini ? 3 : 5), 1), mat, spots.length);
  spots.forEach((m, i) => kutas.setMatrixAt(i, m));
  kutas.castShadow = kutas.receiveShadow = true;
  parent.add(kutas);

  const fin = new THREE.InstancedMesh(finialGeometry(mini ? 5 : 12), accents.gold, tips.length);
  tips.forEach((m, i) => fin.setMatrixAt(i, m));
  fin.castShadow = true;
  parent.add(fin);

  if (holes.length) {
    const hole = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), accents.dark, holes.length);
    holes.forEach((m, i) => hole.setMatrixAt(i, m));
    parent.add(hole);
  }

  // latā strips: a box with a projecting moulding at its foot
  const latGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const lat = new THREE.InstancedMesh(worldUV(latGeo, 1), mat, latas.length);
  latas.forEach((m, i) => lat.setMatrixAt(i, m));
  lat.castShadow = lat.receiveShadow = true;
  parent.add(lat);
  const ledgeGeo = new THREE.BoxGeometry(1.25, 0.09, 1.25).translate(0, 0.045, 0);
  const ledge = new THREE.InstancedMesh(worldUV(ledgeGeo, 1), mat, latas.length);
  latas.forEach((m, i) => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(p, q, sc);
    ledge.setMatrixAt(i, new THREE.Matrix4().compose(p, q, new THREE.Vector3(sc.x, 1, sc.z)));
  });
  parent.add(ledge);

  if (mini) return { topY: yAt(1), topHalf: width(1) };
  // ---- the front niche (~42% up): a projecting arched window with a hooded dome, holding a big raised red ॐ ----
  {
    const tN = bands[2].t0 + (bands[2].t1 - bands[2].t0) * 0.35;
    const s = width(tN);
    const wN = halfW * 0.34, hN = wN * 1.3, dN = 1.1;
    const niche = new THREE.Group();
    niche.position.copy(facePoint(1, 0, tN, s * 0.08));
    parent.add(niche);
    // side posts, sill and lintel framing a dark arched recess
    const frame = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, dN).translate(x, y + h / 2, 0), 1), mat);
      m.castShadow = true;
      niche.add(m);
    };
    frame(wN * 0.16, hN, -wN * 0.42, 0);
    frame(wN * 0.16, hN, wN * 0.42, 0);
    frame(wN, wN * 0.1, 0, 0);
    frame(wN, hN * 0.16, 0, hN * 0.84);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(wN * 0.7, hN * 0.76), accents.dark);
    back.position.set(0, wN * 0.1 + hN * 0.37, -dN * 0.3);
    niche.add(back);
    // cusped arch soffit under the lintel
    const arch = new THREE.Shape();
    const aw = wN * 0.34, ah = hN * 0.2;
    arch.moveTo(-aw, 0); arch.quadraticCurveTo(-aw, ah, 0, ah); arch.quadraticCurveTo(aw, ah, aw, 0);
    arch.lineTo(aw, ah * 1.2); arch.lineTo(-aw, ah * 1.2); arch.lineTo(-aw, 0);
    const soffit = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(arch, { depth: dN * 0.9, bevelEnabled: false }).translate(0, 0, -dN * 0.45), 1), mat);
    soffit.position.y = hN * 0.84 - ah * 1.2;
    niche.add(soffit);
    // the ॐ, raised and glossy, standing proud of the opening
    const om = new THREE.Mesh(glyphGeometry('ॐ', '700 {px}px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif', wN * 1.0, 0.16, 0.035), accents.om);
    om.position.set(0, wN * 0.1 + hN * 0.36, dN * 0.36);
    om.castShadow = true;
    niche.add(om);
    // hood: a ribbed half-dome roof with a gold tip
    const hoodY = hN;
    const slab = new THREE.Mesh(worldUV(new THREE.BoxGeometry(wN * 1.12, 0.12, dN * 1.08).translate(0, 0.06, 0), 1), mat);
    slab.position.y = hoodY;
    niche.add(slab);
    const dome = new THREE.Mesh(worldUV(new THREE.SphereGeometry(wN * 0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 1), mat);
    dome.scale.set(1, 0.65, dN / wN);
    dome.position.y = hoodY + 0.12;
    dome.castShadow = true;
    niche.add(dome);
    const tip = new THREE.Mesh(finialGeometry(), accents.gold);
    tip.scale.setScalar(wN * 0.3);
    tip.position.set(0, hoodY + 0.12 + wN * 0.31, 0);
    niche.add(tip);
  }

  // ---- loudspeaker horns: one high on the front spine, one on the west face ----
  const hornGeo = hornGeometry();
  for (const [side, u, t, tilt] of [[1, 0.06, 0.66, 0.25], [2, -0.1, 0.5, 0.2]] as const) {
    const h = new THREE.Mesh(hornGeo, accents.horn);
    h.position.copy(facePoint(side, u, t, width(t) * 0.12));
    // local +z of the horn → the face's outward normal, tipped down a little
    const a = (side * Math.PI) / 2;
    h.lookAt(h.position.clone().add(new THREE.Vector3(Math.cos(a), -tilt, Math.sin(a))));
    h.scale.setScalar(1.2);
    parent.add(h);
  }

  return { topY: yAt(1), topHalf: width(1) };
}

/**
 * The main spire's form at small scale for the courtyard's subsidiary shrines: shikhara() in its "mini"
 * mode (five tiers of urushringas, gold kalashes, no niche or horns) with unit half-width and height 2.6,
 * baked into one geometry per material so any number of shrines can share it as instances.
 */
export function bakeMiniShikhara(mat: THREE.Material, gold: THREE.Material, dark: THREE.Material) {
  const grp = new THREE.Group();
  shikhara(grp, mat, 0, 1, 2.6, { dark, gold, om: dark, horn: dark }, { mini: true });
  grp.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const im = new THREE.Matrix4();
  const push = (m: THREE.Material, g0: THREE.BufferGeometry, mx: THREE.Matrix4) => {
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(mx);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m)!.push(g);
  };
  grp.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat0 = m.material as THREE.Material;
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const inst = m as THREE.InstancedMesh;
      for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, im); push(mat0, inst.geometry, im.clone().premultiply(m.matrixWorld)); }
    } else push(mat0, m.geometry, m.matrixWorld);
  });
  return [...buckets].map(([m, gs]) => ({ mat: m, geo: mergeGeometries(gs)! }));
}

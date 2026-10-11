import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Flag, type Flames, type Physics } from '../../engine/kit';
import type { BM } from './mats';
import { Merger, cylUV } from './merge';
import { rathaPlan, loft, cutBox, lathe, kalashGeo, spindleGeo, urushringaGeo, bracketGeo, archFrameGeo, cuspedArchShape, plate, clean, type Ring } from './forms';
import { F, GARBHA, HALL, HALL_TOP } from './layout';

/**
 * Shri Bhimashankar Mandir, faces east. +z = east (the mandapa, the main door), +x = north. Metres.
 *
 * Garbhagriha + shikhara (18th c., the shikhara and old sabhamandapa raised by Nana Phadnavis): a star of
 * narrow rathas, 8.2 m across, on a low moulded plinth; plain dressed walls girdled ~3.4 m up by a band of
 * small carved figures; a deep kapota cornice at ~5–5.9 m; above it the nagara shikhara clad in tiers of
 * ribbed, bell-shaped urushringas with a tall central stack on every face, a small grilled vent on the east
 * face, a ribbed stone amalaka and a stacked stone kalasha, a steel staff with trident and saffron flags
 * (apex ≈ 18 m, as measured against pilgrims in the photographs). Shrine niches with sindoor-smeared images
 * on the north, west and south bhadras. The sanctum floor is ~0.9 m below the mandapa (five steps down).
 *
 * Sabhamandapa (rebuilt Jan–May 2026 in traditional dry stone masonry): 2,750 sq ft, 48 carved pillars —
 * a 7 × 7 grid at 2.4 m with the centre left open — cusped arches between all of them ("arched stone
 * corridors"), a central stone dome over the middle bay, a flat roof with a perforated parapet and lotus-bud
 * urns, as on the old hall. Main door east; side doors north and south in the bay next to the sanctum.
 */

export interface TempleOut {
  flags: Flag[];
  /** pillar centres (for colliders and zones) */
  pillars: [number, number][];
  /** interior point lights (for zone switching) */
  hallLights: THREE.PointLight[];
}

/** a cusped arch spandrel in the XY plane: intrados from (−span/2, 0) to (span/2, 0), top at y = h */
function spandrelGeo(span: number, h: number, rise: number, depth: number, cusps = 7) {
  const s = new THREE.Shape();
  const pts = cuspedArchShape(span, rise, cusps);
  s.moveTo(-span / 2, 0);
  for (const p of pts) s.lineTo(p.x, Math.min(p.y, h - 0.04));
  s.lineTo(span / 2, h);
  s.lineTo(-span / 2, h);
  s.lineTo(-span / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return clean(g);
}

/**
 * A pier of the stone mandapa: a heavy square shaft (0.62 m) on a moulded square base, a carved square block
 * at mid-height (the pot-and-foliage of Maratha halls in flat relief), a chamfered upper shaft, and a stepped
 * square capital with four-way brackets carrying the beams. Square in section throughout, as on the old hall.
 */
function pillarGeo(Hreal: number, H = 4.05) {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, y: number, ry = 0) => {
    const b = new THREE.BoxGeometry(w, h, d).translate(0, y + h / 2, 0);
    if (ry) b.rotateY(ry);
    parts.push(b.toNonIndexed());
  };
  box(0.86, 0.3, 0.86, 0);
  box(0.8, 0.12, 0.8, 0.3);
  box(0.72, 0.08, 0.72, 0.42);
  box(0.62, 1.2, 0.62, 0.5);
  box(0.7, 0.06, 0.7, 1.7);
  box(0.68, 0.62, 0.68, 1.76); // carved block
  box(0.7, 0.06, 0.7, 2.38);
  // chamfered upper shaft: a square and its 45° twin, slightly smaller → an octagon
  box(0.56, H - 0.86 - 2.44, 0.56, 2.44);
  box(0.5, H - 0.86 - 2.44, 0.5, 2.44, Math.PI / 4);
  box(0.66, 0.1, 0.66, H - 0.86);
  box(0.74, 0.14, 0.74, H - 0.76);
  box(0.84, 0.12, 0.84, H - 0.62);
  for (const rot of [0, Math.PI / 2]) {
    const b = new THREE.BoxGeometry(1.35, 0.3, 0.46).translate(0, H - 0.35, 0);
    b.rotateY(rot);
    parts.push(b.toNonIndexed());
  }
  box(0.6, 0.05, 0.6, H - 0.05);
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k);
  const geo = mergeGeometries(parts, false)!;
  geo.scale(1, Hreal / H, 1);
  return cylUV(geo, 0.25);
}

/** lotus medallion (for the spandrels and the dome soffit): a flattened ribbed disc facing +z */
function rosetteGeo(r: number) {
  const g = lathe([[0, 0], [r, 0], [r * 0.95, 0.03], [r * 0.7, 0.06], [r * 0.45, 0.07], [r * 0.25, 0.09], [0, 0.1]], 24, 16, 0.12);
  g.rotateX(Math.PI / 2);
  return g;
}

/** lotus-bud urn on the parapet */
function urnGeo() {
  return lathe([[0, 0], [0.16, 0], [0.16, 0.06], [0.1, 0.1], [0.08, 0.16], [0.16, 0.24], [0.2, 0.34], [0.17, 0.44], [0.08, 0.5], [0.05, 0.54], [0.07, 0.58], [0.03, 0.66], [0, 0.68]], 14, 12, 0.08);
}

export function buildTemple(root: THREE.Group, K: BM, P: Physics, flames: Flames): TempleOut {
  const g = new THREE.Group();
  g.name = 'bhimashankar-mandir';
  root.add(g);
  const B = new Merger(P, 'temple');
  const N = new Merger(P, 'mandapa');
  const Gd = new Merger(P, 'gold');
  const spindles: THREE.Matrix4[] = [], bigSpindles: THREE.Matrix4[] = [], brackets: THREE.Matrix4[] = [], pilasters: THREE.Matrix4[] = [];
  const niches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const nichePlate = (mat: THREE.Material, w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const geo = plate(w, h);
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    const l = niches.get(mat) ?? [];
    l.push(geo);
    niches.set(mat, l);
  };
  const cz = GARBHA.cz, H0 = GARBHA.half;
  const flags: Flag[] = [];

  // =====================================================================================
  // GARBHAGRIHA: plinth, mandovara, figure band, cornice, shikhara — one loft on the ratha star
  // =====================================================================================
  const plan = rathaPlan(9, 0.15, 0.05); // nine deep rathas a face: tall smooth slabs stepping out to the bhadra
  const offAt = (u: number) => 0.15 * Math.pow(1 - Math.abs(u), 0.8) * (Math.abs(u) < 0.05 ? 1.15 : 1);
  const prof: [number, number][] = [
    // khura, kumbha, kalasha, antarapatta, kapotika: deep moulded courses of the plinth
    [0, 1.15], [0.16, 1.15], [0.18, 1.1], [0.36, 1.1], [0.4, 1.135], [0.5, 1.135], [0.56, 1.08], [0.62, 1.08], [0.64, 1.045], [0.8, 1.045], [0.82, 1.09], [0.96, 1.09],
    [1.0, 1.035], [1.16, 1.035], [1.2, 1.0], [1.52, 1.0], [3.26, 1.0], [3.28, 1.05], [3.36, 1.05], [3.4, 1.0], [4.02, 1.0], [4.06, 1.055], [4.14, 1.055], [4.18, 1.0],
    [4.86, 1.0], [4.92, 1.03], [5.02, 1.03], [5.08, 1.06], [5.24, 1.11], [5.36, 1.15], [5.44, 1.15], [5.48, 1.06], [5.62, 1.06], [5.66, 1.08], [5.78, 1.08], [5.84, 1.02], [5.92, 1.0],
  ];
  // the wall is tall: plinth + wall + cornice ≈ 7.6 m to a 13 m spire (wall:spire ≈ 0.6, measured on photographs)
  const VS = 7.6 / 5.92;
  const rings: Ring[] = prof.map(([y, s]) => ({ y: y * VS, s: s * H0 }));
  const SB = 7.6, SH = 13.0, sB = 0.92, sT = 0.1, bands = 6;
  // round 3: a near-straight-sided cone, only gently convex, from the cornice corner to a slim neck under
  // the amalaka (news_tv9_2026: height above the cornice ≈ 1.6 × the base width); five tiers of tall buds
  const sAt = (t: number) => sB + (sT - sB) * (0.88 * t + 0.12 * t * t);
  const coreRings: Ring[] = [{ y: SB - 0.001, s: sB * H0 * 0.9 }];
  const bandList: [number, number, number][] = [];
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands, s0 = sAt(t0) * H0, bh = SH / bands;
    const y0 = SB + t0 * SH;
    // the recessed dark core behind the spirelets, with a projecting horizontal band at every storey
    coreRings.push({ y: y0 + 0.001, s: s0 * 0.9 }, { y: y0 + bh * 0.99, s: sAt(t1) * H0 * 0.9 });
    bandList.push([y0, bh, s0]);
  }
  const top = SB + SH, sTp = sT * H0;
  coreRings.push({ y: top, s: sTp }, { y: top + 0.25, s: sTp * 0.86 }, { y: top + 0.4, s: sTp * 0.78 });
  B.place(K.core, loft(plan, coreRings, true), 0, 0, cz);
  for (const [y0, bh, s0] of bandList) {
    B.place(K.stone, loft(plan, [{ y: y0 - 0.02, s: s0 * 0.94 }, { y: y0 + 0.02, s: s0 * 1.05 }, { y: y0 + 0.2, s: s0 * 1.05 }, { y: y0 + 0.28, s: s0 * 0.94 }], false), 0, 0, cz);
  }
  rings.push({ y: SB + 0.02, s: sB * H0 * 0.9 });
  let gl = loft(plan, rings, true);
  // the antarala doorway through the east face (local +z)
  gl = cutBox(gl, new THREE.Vector3(-0.8, F - 0.2, H0 - 0.5), new THREE.Vector3(0.8, F + 2.55, H0 + 2));
  B.place(K.basalt, gl, 0, 0, cz);
  // the figure band: a proud girdle with the carved panels (3.40–4.02 m)
  const bandRings: Ring[] = [{ y: 3.4 * VS, s: H0 * 1.004 }, { y: 4.02 * VS, s: H0 * 1.004 }];
  // pilasterettes framing every figure panel: real projecting stone (instanced)
  {
    const pts = plan.map((p) => new THREE.Vector2(p.x * H0, p.y * H0));
    const lens = pts.map((p, i) => p.distanceTo(pts[(i + 1) % pts.length]));
    const total = lens.reduce((a, b) => a + b, 0);
    const n = Math.round(total / 0.3);
    let acc = 0, seg = 0;
    for (let j = 0; j < n; j++) {
      const d = (j / n) * total;
      while (acc + lens[seg] < d) { acc += lens[seg]; seg++; }
      const a = pts[seg], b = pts[(seg + 1) % pts.length];
      const f = (d - acc) / lens[seg];
      const x = a.x + (b.x - a.x) * f, z = a.y + (b.y - a.y) * f;
      if (z > H0 - 0.5 && Math.abs(x) < 1.5) continue; // the antarala
      const ry = Math.atan2(b.x - a.x, b.y - a.y);
      for (const yb of [3.4 * VS]) pilasters.push(new THREE.Matrix4().compose(new THREE.Vector3(x, yb, cz + z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, VS, 1)));
    }
  }
  B.place(K.figureBand, cutBox(loft(plan, bandRings, false), new THREE.Vector3(-1.5, 4.2, H0 - 0.5), new THREE.Vector3(1.5, 5.3, H0 + 2)), 0, 0, cz);
  // round 3: only the one figure band — the rest of the mandovara is plain ashlar (b1_24, news_tv9_2026)
  // the lower frieze on the plinth (little lozenges and roundels), 0.62–0.78
  B.place(K.friezeG, loft(plan, [{ y: 0.66, s: H0 * 1.053 }, { y: 0.78, s: H0 * 1.053 }], false), 0, 0, cz);

  // crown: ribbed stone amalaka, stacked kalasha, gilded tip, steel staff with trident and flags
  const crownY = top + 0.4;
  B.place(K.stone, lathe([[0.5, -0.02], [0.42, 0.04], [0.42, 0.14], [0.6, 0.18], [0, 0.18]], 24), 0, crownY - 0.18, cz);
  const am = lathe([[0, 0], [0.9, 0], [1.08, 0.06], [1.16, 0.2], [1.1, 0.34], [0.92, 0.42], [0.7, 0.46], [0.55, 0.48], [0, 0.48]], 48, 32, 0.12);
  B.place(K.stone, am, 0, crownY, cz);
  const kal = lathe([[0, 0], [0.55, 0], [0.62, 0.08], [0.5, 0.16], [0.6, 0.26], [0.52, 0.36], [0.4, 0.42], [0.48, 0.5], [0.4, 0.6], [0.28, 0.66],
    [0.34, 0.74], [0.26, 0.84], [0.17, 0.9], [0.22, 0.98], [0.14, 1.08], [0.08, 1.16], [0.1, 1.22], [0.04, 1.34], [0, 1.38]], 32, 16, 0.05);
  B.place(K.stone, kal, 0, crownY + 0.44, cz);
  const tipY = crownY + 0.44 + 1.38;
  Gd.place(K.gold, kalashGeo(0.42), 0, tipY - 0.06, cz);
  const poleH = 5.2;
  B.box(K.steel, 0.07, poleH, 0.07, 0, tipY + 0.3, cz);
  const tri = new THREE.Group();
  tri.position.set(0, tipY + 0.3 + poleH, cz);
  g.add(tri);
  for (const [x, h] of [[0, 0.55], [-0.18, 0.4], [0.18, 0.4]] as const) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 6), K.steel);
    p.position.set(x, h / 2 + 0.1, 0);
    tri.add(p);
  }
  const tb = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 16, Math.PI), K.steel);
  tb.rotation.z = Math.PI;
  tb.position.y = 0.16;
  tri.add(tb);
  // the damaru tied below the trident
  const dam = new THREE.Mesh(lathe([[0.08, -0.08], [0.02, 0], [0.08, 0.08], [0, 0.08]], 12), K.brass);
  dam.position.set(0.06, -0.15, 0);
  tri.add(dam);
  for (const [dy, sc] of [[4.8, 0.7], [4.0, 0.58], [3.2, 0.5]] as const) {
    const f = new Flag(g, K.steel, K.saffron, 0.04, tipY + 0.3, cz, dy);
    f.mesh.scale.setScalar(sc);
    flags.push(f);
  }
  // a second, taller flagstaff lashed beside the spire (as in every photograph)
  {
    const f = new Flag(g, K.steel, K.saffron, 1.1, SB + SH * 0.62, cz + 0.4, 8.2);
    f.mesh.scale.setScalar(0.8);
    flags.push(f);
  }

  // urushringas (round 3): five tiers of tall pointed buds (h:w ≈ 2), each tier's pots spaced with clear
  // vertical gaps; a corner bud on every corner; a tall central stack stepping up each face
  for (let k = 0; k < bands - 1; k++) {
    const t0 = k / bands, smr = sAt(t0) * H0, y0 = SB + t0 * SH + 0.2;
    const bh = SH / bands;
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      const put = (list: THREE.Matrix4[], lx: number, lz: number, r: number, h: number, yy = y0) => {
        const x = lx * ca - lz * sa, z = lx * sa + lz * ca;
        list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, yy, cz + z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.4 + side), new THREE.Vector3(r, h, r)));
      };
      const h = bh * 0.9, r = h / 4;
      // pots either side of the central stack, with a gap of ~0.35 r between them
      const half = smr * 0.86, inner = smr * 0.26;
      const nC = Math.max(1, Math.floor((half - inner) / (r * 2.35)));
      const step = (half - inner) / nC;
      for (const sg of [-1, 1]) for (let c = 0; c < nC; c++) {
        const u = sg * (inner + (c + 0.5) * step);
        put(spindles, smr * (1 + offAt(u / smr)) * 0.9 + r * 0.55, u, r, h);
      }
      put(spindles, smr * 0.93 + r * 0.3, smr * 0.93 + r * 0.3, r, h);
      // the central stack: a bigger bud on every tier, half-sunk into the next
      const rc = Math.min(smr * 0.2, r * 1.5), hc = Math.min(bh * 1.25, rc * 4);
      put(bigSpindles, smr * (1 + offAt(0)) * 0.9 + rc * 0.45, 0, rc, hc, y0 - 0.15);
    }
  }
  // pendant brackets under the kapota, one per ratha
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 9; k++) {
      const u = -1 + (k + 0.5) * (2 / 9);
      const lx = H0 * (1 + offAt(u)) + 0.1, lz = u * H0;
      const x = lx * ca - lz * sa, z = lx * sa + lz * ca;
      brackets.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 4.86 * VS, cz + z), new THREE.Quaternion(), new THREE.Vector3(0.2, 0.5, 0.2)));
    }
  }
  // grilled vent at the foot of the east stack (seen above the mandapa parapet)
  {
    const vz = cz + sAt(0.13) * H0 * (1 + offAt(0)) + 0.16;
    B.box(K.dark, 0.7, 0.9, 0.08, 0, SB + 0.9, vz);
    for (let k = -3; k <= 3; k++) B.box(K.steel, 0.025, 0.9, 0.04, k * 0.09, SB + 0.9, vz + 0.05);
    B.box(K.stone, 0.9, 0.12, 0.2, 0, SB + 0.8, vz);
    B.box(K.stone, 0.9, 0.12, 0.2, 0, SB + 1.8, vz);
  }
  // shrine niches (devakoshtha) on the north, west and south bhadras: pilasters, cusped arch, a small spire
  for (const [side, ry] of [[0, Math.PI / 2], [2, -Math.PI / 2], [3, Math.PI]] as const) {
    const a = (side * Math.PI) / 2;
    const r = H0 * (1 + 0.15 * 1.15) + 0.02;
    const at = (o: number, l: number): [number, number] => [(r + o) * Math.cos(a) - l * Math.sin(a), (r + o) * Math.sin(a) + l * Math.cos(a)];
    const yb = 1.22 * VS;
    const [px, pz] = at(0.2, 0);
    // base shelf, pilasters, lintel
    const shelf = new THREE.BoxGeometry(1.15, 0.16, 0.42);
    B.place(K.stone, shelf, px, yb, cz + pz, ry);
    for (const s of [-1, 1]) {
      const [qx, qz] = at(0.22, s * 0.46);
      B.place(K.stone, new THREE.BoxGeometry(0.14, 1.3, 0.3), qx, yb + 0.16, cz + qz, ry);
    }
    B.place(K.stone, archFrameGeo(0.78, 0.75, 0.4, 0.07, 0.1, 7), px, yb + 0.16, cz + pz, ry);
    B.place(K.stone, new THREE.BoxGeometry(1.2, 0.14, 0.44), px, yb + 1.46, cz + pz, ry);
    // a miniature spire on top
    B.place(K.stone, spindleGeo(12), px, yb + 1.6, cz + pz, 0, [0.42, 0.95, 0.42]);
    // the back of the niche and the image (smeared with sindoor; Krishna south, Hanuman west, Mahishasuramardini north)
    const [ix, iz] = at(0.05, 0);
    B.place(K.dark, new THREE.BoxGeometry(0.76, 1.2, 0.02), ix, yb + 0.16, cz + iz, ry);
    const [jx, jz] = at(0.07, 0);
    nichePlate(K.sindoor, 0.5, 0.95, jx, yb + 0.2, cz + jz, ry);
    // a small brass lamp on the shelf
    const [lx, lz] = at(0.36, 0);
    flames.points.push(new THREE.Vector3(lx, yb + 0.2, cz + lz));
  }
  // garbhagriha colliders, the passage left open
  const ext = H0 * 1.13, ia = GARBHA.inner;
  P.solid(-ext, -1, cz - ext, -ia, 30, cz + ext - 0.25);
  P.solid(ia, -1, cz - ext, ext, 30, cz + ext - 0.25);
  P.solid(-ia, -1, cz - ext, ia, 30, cz - ia);
  P.solid(-ia, -1, cz + ia, -0.78, 30, HALL.z0);
  P.solid(0.78, -1, cz + ia, ia, 30, HALL.z0);
  P.solid(-ext, -1, cz + ext - 0.3, -ia, 30, HALL.z0 - 0.02);
  P.solid(ia, -1, cz + ext - 0.3, ext, 30, HALL.z0 - 0.02);

  // =====================================================================================
  // ANTARALA: passage, five steps down, door frames with Ganesha (left) and Kalabhairava (right)
  // =====================================================================================
  const Fl = GARBHA.floor;
  const AZ0 = cz + ia; // sanctum east face (−7.05)
  const AZ1 = HALL.z0; // hall west face (−3.9)
  for (const s of [-1, 1]) B.span(K.stone, s > 0 ? 0.78 : -1.2, Fl, AZ0, s > 0 ? 1.2 : -0.78, F + 2.6, AZ1);
  B.span(K.stone, -1.2, F + 2.5, AZ0, 1.2, F + 3.0, AZ1);
  const nSt = 5, stZ0 = AZ1 - 0.45 - nSt * 0.3, stZ1 = AZ1 - 0.45;
  for (let i = 0; i < nSt; i++) {
    const zz0 = stZ0 + i * 0.3;
    B.span(K.wetStone, -0.78, Fl - 0.4, zz0, 0.78, Fl + ((i + 1) * (F - Fl)) / nSt, zz0 + 0.3);
  }
  B.span(K.wetStone, -0.78, Fl - 0.4, stZ1, 0.78, F, AZ1 + 0.05);
  B.span(K.wetStone, -0.78, Fl - 0.4, AZ0 - 0.02, 0.78, Fl, stZ0);
  P.floor(g, -0.78, 0.78, stZ0 - 0.02, stZ1, Fl, F);
  P.floor(g, -0.78, 0.78, AZ0 - 0.05, stZ0, Fl);
  P.floor(g, -0.78, 0.78, stZ1, AZ1 + 0.3, F);
  // brass handrail down the middle of the steps
  Gd.box(K.brassIn, 0.04, 0.04, stZ1 - stZ0 + 0.3, 0, F + 0.4 - 0.45, (stZ0 + stZ1) / 2);
  // silver-sheathed sanctum doorway (repoussé), low, facing east
  for (const s of [-1, 1]) B.span(K.silverEmb, s * 0.62 - 0.12, Fl, AZ0 - 0.02, s * 0.62 + 0.12, Fl + 2.05, AZ0 + 0.12);
  B.span(K.silverEmb, -0.74, Fl + 2.05, AZ0 - 0.02, 0.74, Fl + 2.32, AZ0 + 0.12);
  B.span(K.silver, -0.74, Fl, AZ0 - 0.02, 0.74, Fl + 0.06, AZ0 + 0.14);
  // the carved stone door of the mandapa side, with the guardian images in niches
  for (const s of [-1, 1]) {
    B.span(K.stone, s * 0.78 - (s > 0 ? 0 : 0.26), F, AZ1 - 0.02, s * 0.78 + (s > 0 ? 0.26 : 0), F + 2.6, AZ1 + 0.18);
    nichePlate(K.sindoor, 0.42, 0.78, s * 1.42, F + 0.25, AZ1 + 0.04, 0);
    B.span(K.dark, s * 1.42 - 0.26, F + 0.2, AZ1 - 0.02, s * 1.42 + 0.26, F + 1.1, AZ1 + 0.02);
    B.place(K.stone, archFrameGeo(0.52, 0.55, 0.3, 0.06, 0.08, 5), s * 1.42, F + 0.2, AZ1 + 0.06);
  }
  B.span(K.stone, -1.04, F + 2.6, AZ1 - 0.02, 1.04, F + 2.95, AZ1 + 0.2);
  B.span(K.frieze, -1.04, F + 2.62, AZ1 + 0.2, 1.04, F + 2.93, AZ1 + 0.22);

  // =====================================================================================
  // SABHAMANDAPA (2026): 48 pillars, cusped arches, coffered ceiling, central dome, parapet
  // =====================================================================================
  const S = HALL.step, PZ0 = HALL.z0 + 0.3; // first pillar row z (−3.6)
  const zc = HALL.zc; // dome centre z (3.6)
  const pillars: [number, number][] = [];
  // 8 × 6 = 48 pillars; the central aisle (3 m) runs from the east door to the sanctum and holds the dome bay
  const XS = [-7.2, -5.3, -3.4, -1.5, 1.5, 3.4, 5.3, 7.2];
  const ZS = [PZ0, -0.9, 2.1, 5.1, 8.1, 10.8];
  for (const x of XS) for (const z of ZS) pillars.push([x, z]);
  void S;
  const PH = HALL_TOP - 0.35 - F; // pillar height to the beam soffit (3.65)
  const SPRING = 2.3; // arch springing above the floor
  const pg = pillarGeo(PH);
  for (const [px, pz] of pillars) {
    N.place(K.pillar, pg, px, F, pz, 0, 1, true);
    P.solid(px - 0.36, F, pz - 0.36, px + 0.36, HALL_TOP, pz + 0.36);
  }
  const beamY = F + PH; // 4.65
  // platform (jagati) with moulded edge
  const hx0 = HALL.x0 - 0.4, hx1 = HALL.x1 + 0.4, hz0 = HALL.z0, hz1 = HALL.z1 + 0.4;
  for (const [y0, y1, o] of [[0, 0.16, 0.12], [0.16, 0.3, 0.02], [0.3, 0.44, 0.08], [0.44, F - 0.04, 0], [F - 0.04, F, 0.05]] as const) {
    N.span(K.newStone, hx0 - o, y0 - (y0 === 0 ? 0.3 : 0), hz0, hx1 + o, y1, hz1 + o);
  }
  P.solid(hx0 - 0.1, -0.5, hz0, hx1 + 0.1, F, hz1 + 0.1);
  P.floor(g, hx0, hx1, hz0 - 0.2, hz1, F);
  N.span(K.hallFloor, HALL.x0, F - 0.01, HALL.z0, HALL.x1, F + 0.006, HALL.z1);
  // steps: east (two central bays), north and south (the bay next to the sanctum)
  const stepsZ = (x0: number, x1: number, zEdge: number) => {
    const n = 4, rise = F / n, tread = 0.32;
    for (let i = 0; i < n; i++) N.span(K.newStone, x0, -0.3, zEdge + i * tread, x1, F - (i + 1) * rise + rise, zEdge + (i + 1) * tread);
    P.floor(g, x0, x1, zEdge + n * tread, zEdge, 0, F);
    for (const s of [x0 - 0.3, x1]) N.span(K.newStone, s, -0.3, zEdge, s + 0.3, F + 0.25, zEdge + n * tread, true);
  };
  stepsZ(-1.5, 1.5, hz1 + 0.12);
  const stepsX = (z0: number, z1: number, xEdge: number, sgn: number) => {
    const n = 4, rise = F / n, tread = 0.32;
    for (let i = 0; i < n; i++) {
      const a = xEdge + sgn * i * tread, b = xEdge + sgn * (i + 1) * tread;
      N.span(K.newStone, Math.min(a, b), -0.3, z0, Math.max(a, b), F - i * rise, z1);
    }
    const xa = xEdge + sgn * n * tread;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xa, 0, z0, xEdge, F, z0, xEdge, F, z1, xa, 0, z1]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    g.add(m);
    P.floors.push(m);
    for (const zz of [z0 - 0.3, z1]) N.span(K.newStone, Math.min(xEdge, xa), -0.3, zz, Math.max(xEdge, xa), F + 0.25, zz + 0.3, true);
  };
  stepsX(-3.5, -1.3, hx1 + 0.12, 1);
  stepsX(-3.5, -1.3, hx0 - 0.12, -1);

  // beams on every grid line, arch spandrels between every pair of pillars
  const spanCache = new Map<string, THREE.BufferGeometry>();
  const spanOf = (L: number) => {
    const k = L.toFixed(2);
    if (!spanCache.has(k)) spanCache.set(k, spandrelGeo(L - 0.7, PH - SPRING, Math.min(1.1, (L - 0.7) * 0.5), 0.5, 5));
    return spanCache.get(k)!;
  };
  const NI = XS.length - 1, NJ = ZS.length - 1;
  const isEntrance = (i: number, j: number, dir: 'x' | 'z') => {
    if (dir === 'x' && (j === NJ || j === 0) && i === 3) return true; // east door / west: the antarala
    if (dir === 'z' && (i === 0 || i === NI + 0) && j === 0) return true; // north and south doors
    return false;
  };
  for (let i = 0; i <= NI; i++) {
    for (let j = 0; j <= NJ; j++) {
      const x = XS[i], z = ZS[j];
      if (i < NI) {
        const L = XS[i + 1] - x, cx = x + L / 2;
        N.place(K.newWall, spanOf(L), cx, F + SPRING, z, 0);
        N.box(K.newStone, L, 0.35, 0.46, cx, beamY, z);
        if ((j === 0 || j === NJ) && !isEntrance(i, j, 'x') && !(j === 0 && Math.abs(cx) < 4.6)) {
          N.box(K.newStone, L - 0.6, 0.62, 0.3, cx, F, z, true);
          N.box(K.newStone, L - 0.5, 0.1, 0.38, cx, F + 0.62, z);
        }
      }
      if (j < NJ) {
        const L = ZS[j + 1] - z, cz2 = z + L / 2;
        N.place(K.newWall, spanOf(L), x, F + SPRING, cz2, Math.PI / 2);
        N.box(K.newStone, 0.46, 0.35, L, x, beamY, cz2);
        if ((i === 0 || i === NI) && !isEntrance(i, j, 'z')) {
          N.box(K.newStone, 0.3, 0.62, L - 0.6, x, F, cz2, true);
          N.box(K.newStone, 0.38, 0.1, L - 0.5, x, F + 0.62, cz2);
        }
      }
    }
  }

  // roof slab (open over the dome bay), its soffit coffered
  const RY0 = HALL_TOP, RY1 = HALL_TOP + 0.5;
  const rx0 = HALL.x0 - 0.05, rx1 = HALL.x1 + 0.05, rz0 = HALL.z0, rz1 = HALL.z1 + 0.05;
  const DH = 1.5; // half-width of the dome bay
  const dx0 = -DH, dx1 = DH, dz0 = zc - DH, dz1 = zc + DH;
  void dx0; void dx1; void dz0; void dz1;
  // a flat stone roof over every bay (no dome: no photograph of the 2026 hall shows one; the old hall had none)
  N.span(K.newStone, rx0, RY0, rz0, rx1, RY1, rz1);
  // a carved lotus coffer in every bay (UVs 0..1 per bay)
  for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
    const Lx = XS[i + 1] - XS[i] - 0.46, Lz = ZS[j + 1] - ZS[j] - 0.46;
    const pg2 = new THREE.PlaneGeometry(Lx, Lz).rotateX(Math.PI / 2);
    N.place(K.coffer, pg2, (XS[i] + XS[i + 1]) / 2, RY0 - 0.005, (ZS[j] + ZS[j + 1]) / 2, 0, 1, true);
  }
  // outer entablature: frieze band and a projecting chhajja
  const band = (mat: THREE.Material, y0: number, y1: number, o: number) => {
    N.span(mat, rx0 - o, y0, rz0 - 0.001, rx1 + o, y1, rz0 + 0.0);
    N.span(mat, rx0 - o, y0, rz1, rx1 + o, y1, rz1 + o);
    N.span(mat, rx0 - o, y0, rz0, rx0, y1, rz1 + o);
    N.span(mat, rx1, y0, rz0, rx1 + o, y1, rz1 + o);
  };
  band(K.frieze, beamY - 0.02, RY0 + 0.35, 0.08);
  band(K.newStone, RY0 + 0.35, RY1, 0.24);
  // chhajja: sloping thin eave on the three free faces
  const eaveGeo = (len: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.7, -0.32); s.lineTo(0.7, -0.4); s.lineTo(0, -0.14); s.lineTo(0, 0);
    const e = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    e.translate(0, 0, -len / 2);
    return clean(e);
  };
  N.place(K.newStone, eaveGeo(rx1 - rx0 + 1.4), 0, RY0 + 0.3, rz1 + 0.24, -Math.PI / 2);
  N.place(K.newStone, eaveGeo(rz1 - rz0), rx1 + 0.24, RY0 + 0.3, (rz0 + rz1) / 2, 0);
  N.place(K.newStone, eaveGeo(rz1 - rz0), rx0 - 0.24, RY0 + 0.3, (rz0 + rz1) / 2, Math.PI);
  // a low, near-blank parapet with a plain coping (as on the old black-stone hall)
  const PY = RY1;
  const runPar = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(-(bz - az), bx - ax);
    N.place(K.newStone, new THREE.BoxGeometry(L + 0.3, 0.55, 0.3), (ax + bx) / 2, PY, (az + bz) / 2, ry);
    N.place(K.newStone, new THREE.BoxGeometry(L + 0.4, 0.1, 0.42), (ax + bx) / 2, PY + 0.55, (az + bz) / 2, ry);
  };
  const px0 = rx0 + 0.1, px1 = rx1 - 0.1, pz0 = rz0 + 0.1, pz1 = rz1 - 0.1;
  runPar(px0, pz1, px1, pz1);
  runPar(px1, pz0, px1, pz1);
  runPar(px0, pz0, px0, pz1);
  runPar(px0, pz0, -4.7, pz0);
  runPar(4.7, pz0, px1, pz0);
  for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) N.place(K.newStone, new THREE.BoxGeometry(0.5, 0.75, 0.5), x, PY, z);
  // lotus medallions in the outer spandrels and cusped arch frames on the facade
  const ros = rosetteGeo(0.22);
  const frameOf = (L: number) => archFrameGeo(L - 0.7, 0, Math.min(1.1, (L - 0.7) * 0.5), 0.12, 0.08, 5);
  const zE = ZS[NJ], zW = ZS[0];
  for (let i = 0; i < NI; i++) {
    const L = XS[i + 1] - XS[i], x = XS[i] + L / 2;
    if (i > 0) N.place(K.newStone, ros, XS[i], F + SPRING + 0.95, zE + 0.18);
    N.place(K.newStone, frameOf(L), x, F + SPRING, zE + 0.22);
    if (Math.abs(x) > 4.6) N.place(K.newStone, frameOf(L), x, F + SPRING, zW - 0.22, Math.PI);
  }
  for (let j = 0; j < NJ; j++) {
    const L = ZS[j + 1] - ZS[j], z = ZS[j] + L / 2;
    N.place(K.newStone, frameOf(L), HALL.x1 - 0.08, F + SPRING, z, Math.PI / 2);
    N.place(K.newStone, frameOf(L), HALL.x0 + 0.08, F + SPRING, z, -Math.PI / 2);
    if (j > 0) {
      N.place(K.newStone, ros, HALL.x1 - 0.12, F + SPRING + 0.95, ZS[j], Math.PI / 2);
      N.place(K.newStone, ros, HALL.x0 + 0.12, F + SPRING + 0.95, ZS[j], -Math.PI / 2);
    }
  }

  // a great brass bell hung from the dome over the Nandi, and the hall lamps
  const bellY = RY0;
  Gd.box(K.brassIn, 0.03, 1.0, 0.03, 0, bellY - 1.0, zc);
  const bell = lathe([[0, 0.5], [0.06, 0.5], [0.08, 0.46], [0.14, 0.4], [0.17, 0.25], [0.2, 0.08], [0.25, 0.0], [0.24, -0.02], [0.18, 0.04], [0, 0.04]], 24);
  Gd.place(K.brassIn, bell, 0, bellY - 1.0 - 0.5, zc);
  const hallLights: THREE.PointLight[] = [];
  for (const [x, z, it] of [[0, zc + 0.6, 2.8], [0, -1.8, 1.8]] as const) {
    const l = new THREE.PointLight(0xffc483, it, 11, 1.7);
    l.position.set(x, HALL_TOP - 0.9, z);
    g.add(l);
    hallLights.push(l);
  }
  // round 3: warm low lamps along the antarala (2700 K); the side bays now read through the lighter
  // stone tint (mats.ts NEW) without extra lights
  for (const [x, y, z, it, d, col] of [[0, F + 2.1, AZ1 - 0.7, 0.6, 6, 0xffb46b], [0, GARBHA.floor + 2.0, AZ0 + 0.9, 0.6, 6, 0xffb46b]] as const) {
    const l = new THREE.PointLight(col, it, d, 1.6);
    l.position.set(x, y, z);
    g.add(l);
    hallLights.push(l);
  }
  // brass samai lamps flanking the antarala door
  const stand = lathe([[0, 0], [0.17, 0], [0.13, 0.05], [0.035, 0.1], [0.035, 1.15], [0.08, 1.18], [0.16, 1.22], [0.14, 1.26], [0, 1.25]], 16);
  for (const px of [-1.75, 1.75]) {
    Gd.place(K.brassIn, stand, px, F, AZ1 + 0.9);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(px + Math.cos(a) * 0.12, F + 1.31, AZ1 + 0.9 + Math.sin(a) * 0.12));
    }
    P.solid(px - 0.2, F, AZ1 + 0.7, px + 0.2, F + 1.3, AZ1 + 1.1);
  }
  // queue railings (steel pipes) leading from the north door to the antarala
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    for (const yy of [0.5, 1.0]) N.place(K.steel, new THREE.CylinderGeometry(0.025, 0.025, L, 8).rotateZ(Math.PI / 2), (ax + bx) / 2, F + yy, (az + bz) / 2, ry);
    const n = Math.max(1, Math.round(L / 1.2));
    for (let k = 0; k <= n; k++) N.place(K.steel, new THREE.CylinderGeometry(0.03, 0.03, 1.02, 8), ax + ((bx - ax) * k) / n, F + 0.51, az + ((bz - az) * k) / n);
  };
  rail(6.6, -0.6, 1.6, -0.6);
  rail(-6.6, -0.6, -1.6, -0.6);

  B.flush(g);
  N.flush(g);
  Gd.flush(g);
  for (const [mat, list] of niches) {
    const m = new THREE.Mesh(mergeGeometries(list, false)!, mat);
    m.receiveShadow = true;
    g.add(m);
  }
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
  const sg = urushringaGeo(16);
  inst(sg, K.spindle, spindles);
  inst(sg, K.spindle, bigSpindles);
  inst(bracketGeo(), K.stone, brackets, false);
  inst(new THREE.BoxGeometry(0.07, 0.62, 0.07).translate(0, 0.31, 0.02), K.stone, pilasters, false);
  return { flags, pillars, hallLights };
}

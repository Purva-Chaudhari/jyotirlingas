import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { Physics, Flag, kalash, archPanelGeometry, type Flames } from '../../engine/kit';
import { offerings, type Offerings } from './flowers';
import { buildSanctum } from './sanctum';
import { nandiMesh } from './nandi';
import { Batch, M4 } from './batch';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KMats } from './mats';

/**
 * Shri Kedarnath temple, from post-2013 / 2022-23 photographs.
 * Origin = temple centre line at the front of the plinth zone; +z = south, the pilgrim's side.
 *
 *  plinth 0 → 1.0 · mandapa x ±6.5, z −4.6 → +7, walls to 6.8, cornice → 7.5, gable apex 10.7 (≈24° pitch)
 *  garbhagriha block x ±5, z −14.6 → −4.6 (centre z −9.6): moulded base → 2.6, wall → 6.2, frieze → 6.8
 *  shikhara 6.8 → 23.0 (half-width 4.4 → 2.85) · painted wooden crown 23.0 → 25.0 · gilt roof, kalash → ~28.2
 *  sanctum 4.8 m square inside 2.6 m thick walls; gold-plated (2022-23); natural pyramidal rock lingam.
 */

export const F = 1.0; // temple floor
/** back face of the mandapa = front face of the garbhagriha block */
export const MZ0 = -4.6;
/** half-width of the garbhagriha block (nearly as broad as the mandapa) */
export const GH = 6.0;
export const GZ = MZ0 - GH; // garbhagriha centre
const ML = 7 - MZ0, MC = (7 + MZ0) / 2; // mandapa length and centre
/** a box spanning z [z0 - grow, z1] where the original spanned the old mandapa (back face −7) */
const mz = (depth: number, centre: number) => {
  const back = centre - depth / 2 + (MZ0 + 7), front = centre + depth / 2;
  return { d: front - back, c: (front + back) / 2 };
};
const HALL = { x: 5, z0: MZ0 + 1.5, z1: 5.5, ceil: 6.8 };
const SANCT = { h: 3.0, z0: GZ - 3.0, z1: GZ + 3.0, ceil: F + 4.4 };
/** tower top (crown pavilion base) */
const TOWER_TOP = 23.0;
/** the red festive gate frame stands free in the square, between the steps and the Nandi */
const TZ = 10.9;

export interface TempleOut {
  flag: Flag;
  flames: Flames;
}

export function buildTemple(
  root: THREE.Group, M: Materials, K: KMats, P: Physics,
  env: { gold: THREE.Texture; lamp: THREE.Texture; neutral: THREE.Texture }, pending: Promise<unknown>[],
): TempleOut {
  const g = new THREE.Group();
  g.name = 'kedarnath-temple';
  root.add(g);
  const B = new Batch(g, P);
  const flames: Flames = { points: [], lights: [] };

  // local-frame helper: a box in a frame (x across, y up, z out of the wall)
  const lbox = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Matrix4) => {
    const geo = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
    B.geo(mat, geo, m);
  };
  const FRONT = M4(0, 0, 0);
  const EAST = M4(0, 0, 0, Math.PI / 2);
  const WEST = M4(0, 0, 0, -Math.PI / 2);

  // ================= plinth =================
  for (const [w, h, d, y, c, mat] of [[14.8, 0.36, 15.6, 0, -0.1, K.stoneDark], [14.1, 0.34, 14.9, 0.36, -0.05, K.stoneDark], [13.5, 0.3, 14.3, 0.7, 0, K.stone]] as const) {
    const b = mz(d, c);
    B.box(mat, w, h, b.d, 0, y, b.c);
  }
  P.solid(-7.4, 0, MZ0 - 0.9, 7.4, F, 7.6);
  // porch landing and front steps (x ±3, landing to z 8.4, five steps down to the square at z 10)
  B.box(K.stone, 6.4, F, 1.2, 0, 0, 7.75);
  for (let i = 0; i < 5; i++) {
    const h = F - i * 0.2;
    B.box(K.stoneDark, 6.0 - i * 0.0, h, 0.34, 0, 0, 8.4 + i * 0.32 + 0.17);
  }
  P.floor(g, -3.0, 3.0, 10.0, 8.4, 0, F);
  P.floor(g, -3.2, 3.2, 8.4, 6.9, F);
  // side cheek walls of the stair
  for (const s of [-1, 1]) {
    B.box(K.stoneDark, 0.45, 1.2, 2.0, s * 3.3, 0, 9.2, true);
  }

  // ================= mandapa walls =================
  const WT = HALL.ceil; // wall top
  // front wall (z 5.5 → 7) with the door x ±0.9, y F → F+3.0
  B.box(K.stone, 5.6, WT - F, 1.5, -3.7, F, 6.25, true);
  B.box(K.stone, 5.6, WT - F, 1.5, 3.7, F, 6.25, true);
  B.box(K.stone, 1.8, WT - F - 3.0, 1.5, 0, F + 3.0, 6.25);
  // back wall (z −7 → −5.5) with the sanctum passage x ±0.8, h 2.6
  B.box(K.stone, 4.2, WT - F, 1.5, -2.9, F, MZ0 + 0.75, true);
  B.box(K.stone, 4.2, WT - F, 1.5, 2.9, F, MZ0 + 0.75, true);
  B.box(K.stone, 1.6, WT - F - 2.6, 1.5, 0, F + 2.6, MZ0 + 0.75);
  // side walls
  for (const s of [-1, 1]) B.box(K.stone, 1.5, WT - F, ML, s * 5.75, F, MC, true);
  // corner pilasters
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (sz < 0) continue;
    B.box(K.carved, 1.4, WT - F, 0.3, sx * 5.8, F, 7.15);
    B.box(K.carved, 0.3, WT - F, 1.4, sx * 6.65, F, 6.3);
  }
  for (const sx of [-1, 1]) B.box(K.stone, 0.3, WT - F, 1.4, sx * 6.65, F, MZ0 + 0.7);
  // roll moulding (kumbha) around the walls at mid height
  const roll = (len: number, x: number, y: number, z: number, ry: number, mat: THREE.Material = K.stone, r = 0.3) => {
    const c = new THREE.CylinderGeometry(r, r, len, 14, 1).rotateZ(Math.PI / 2);
    B.geo(mat, c, M4(x, y, z, ry));
  };
  // each side wall in three bays: the central one 0.3 m proud, framing the side door and its porch
  const BAYW = 4.6;
  for (const s of [-1, 1]) {
    B.box(K.carved, 0.3, WT - F, BAYW, s * 6.65, F, 0, true);
    // fat half-round roll moulding at mid-height, continuous round the building
    roll(-BAYW / 2 - (MZ0 + 0.8), s * 6.58, F + 3.6, (-BAYW / 2 + MZ0 + 0.8) / 2, Math.PI / 2);
    roll(6.2 - BAYW / 2, s * 6.58, F + 3.6, (6.2 + BAYW / 2) / 2, Math.PI / 2);
    roll(BAYW, s * 6.88, F + 3.6, 0, Math.PI / 2, K.carved);
    roll(2.6, s * 4.9, F + 3.6, 7.38, 0);
    // side porch round the door: pilasters, a carved lintel and a little sloping hood
    for (const t of [-1, 1]) B.box(K.carved, 0.45, 2.95, 0.4, s * 7.0, F, t * 1.2, true);
    B.box(K.carved, 0.6, 0.45, 2.9, s * 7.02, F + 2.95, 0);
    B.box(K.stoneDark, 0.9, 0.12, 3.2, s * 7.1, F + 3.4, 0);
  }
  // rows of carved panels on the mandapa walls: pilasters, niches with soft faceless figure
  // relief, and a band of small cusped arches — four registers between plinth and cornice
  {
    const rows: [number, number][] = [[F + 0.75, 1.35], [F + 2.2, 1.25], [F + 4.05, 1.0], [F + 5.15, 0.75]];
    const bayW = 1.15;
    const wallRuns: { nx: number; nz: number; a: number; b: number; out: number }[] = [];
    for (const sx of [-1, 1]) {
      // flat side wall (face x = ±6.5) either side of the proud central bay, and the bay itself (±6.8)
      wallRuns.push({ nx: sx, nz: 0, a: MZ0 + 0.75, b: -BAYW / 2 - 0.05, out: 6.5 });
      wallRuns.push({ nx: sx, nz: 0, a: BAYW / 2 + 0.05, b: 6.45, out: 6.5 });
      wallRuns.push({ nx: sx, nz: 0, a: -BAYW / 2 + 0.05, b: -1.5, out: 6.8 });
      wallRuns.push({ nx: sx, nz: 0, a: 1.5, b: BAYW / 2 - 0.05, out: 6.8 });
      // front wall between the door bay and the corner pilaster
      wallRuns.push({ nx: 0, nz: 1, a: sx * 3.35, b: sx * 5.05, out: 7.0 });
    }
    for (const run of wallRuns) {
      const lo = Math.min(run.a, run.b), hi = Math.max(run.a, run.b), n = Math.max(1, Math.floor((hi - lo) / bayW));
      const step = (hi - lo) / n;
      const rot = run.nx !== 0 ? run.nx * Math.PI / 2 : 0;
      const at = (along: number, out: number, y: number) =>
        run.nx !== 0 ? M4(run.nx * out, y, along, rot) : M4(along, y, run.nz * out, rot);
      for (let r = 0; r < rows.length; r++) {
        const [y0r, h] = rows[r];
        // register band below each row
        for (let i = 0; i < n; i++) {
          const c = lo + (i + 0.5) * step;
          if (r === 3) {
            // top register: small cusped blind arches
            B.geo(K.carved, archPanelGeometry(step * 0.8, h * 0.8, 0.12, 5), at(c, run.out + 0.06, y0r));
            continue;
          }
          // pilaster at the left of every bay
          B.geo(K.carved, new THREE.BoxGeometry(0.16, h, 0.16), at(c - step / 2 + 0.08, run.out + 0.08, y0r + h / 2));
          // niche: recess, frame, cusped head
          const nw = step * 0.55, nh = h * 0.78;
          B.geo(K.recess, new THREE.BoxGeometry(nw, nh, 0.02), at(c, run.out + 0.01, y0r + 0.08 + nh / 2), false);
          B.geo(K.carved, archPanelGeometry(nw, nh * 0.35, 0.1, 5), at(c, run.out + 0.05, y0r + 0.08 + nh * 0.65));
          for (const s2 of [-1, 1]) B.geo(K.carved, new THREE.BoxGeometry(0.07, nh, 0.1), at(c + s2 * (nw / 2 + 0.035), run.out + 0.05, y0r + 0.08 + nh / 2));
          // soft relief figure (rows 0 and 1) or a lotus boss
          if (r < 2) {
            const fh = (nh * 0.72) / 1.25;
            B.geo(K.stone, standingFigure().scale(fh * 0.95, fh, fh * 0.32), at(c, run.out + 0.03, y0r + 0.1), false);
          } else {
            B.geo(K.carved, new THREE.SphereGeometry(0.16, 10, 6).scale(1, 1, 0.45), at(c, run.out + 0.05, y0r + 0.08 + nh * 0.45));
          }
        }
        B.geo(K.carved, new THREE.BoxGeometry(hi - lo, 0.09, 0.2), at((lo + hi) / 2, run.out + 0.09, y0r - 0.045));
      }
    }
  }
  // base moulding bands at foot of walls
  ring(B, K.stoneDark, F, 0.22, 6.65, MZ0 - 0.1, 7.1, HALL.x, HALL.z0, HALL.z1, [0.9, F + 3.0], [0.8, F + 2.6]);
  ring(B, K.stone, F + 0.5, 0.16, 6.6, MZ0 - 0.05, 7.05, HALL.x, HALL.z0, HALL.z1, [0.9, F + 3.0], [0.8, F + 2.6]);

  // ---------- cornice, frieze, eave ----------
  { const b = mz(14.6, 0.15); B.box(K.carved, 13.8, 0.5, b.d, 0, WT - 0.24, b.c); }
  // heavy rounded kapota cornice under the eave (sides and front)
  for (const s of [-1, 1]) {
    B.geo(K.stone, new THREE.CylinderGeometry(0.42, 0.42, ML + 0.9, 16).rotateX(Math.PI / 2), M4(s * 6.78, WT + 0.12, MC + 0.2));
  }
  B.geo(K.stone, new THREE.CylinderGeometry(0.42, 0.42, 14.0, 16).rotateZ(Math.PI / 2), M4(0, WT + 0.12, 7.42));
  { const b = mz(14.2, 0.1); B.box(K.stoneDark, 13.4, 0.3, b.d, 0, WT + 0.26, b.c); }
  // little blind-arch frieze (dark recesses) on the front and sides
  for (let i = 0; i < 22; i++) {
    const x = -6.3 + i * 0.6;
    B.slab(K.black, 0.28, 0.18, 0.04, x, WT + 0.3, 7.36);
  }
  for (const s of [-1, 1]) for (let i = 0; i < Math.floor((ML - 0.8) / 0.6); i++) B.slab(K.black, 0.04, 0.18, 0.28, s * 6.76, WT + 0.3, MZ0 + 0.4 + i * 0.6);
  { const b = mz(15.0, 0.2); B.box(K.stone, 14.2, 0.16, b.d, 0, WT + 0.56, b.c); }

  // ---------- front gable (tympanum) ----------
  const EAVE = WT + 0.72, RIDGE = EAVE + 3.9, EX = 7.3; // ≈28° pitch
  {
    const s = new THREE.Shape();
    s.moveTo(-6.75, 0); s.lineTo(6.75, 0); s.lineTo(0, RIDGE - EAVE - 0.18); s.lineTo(-6.75, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false });
    B.geo(K.stone, geo, M4(0, EAVE, 6.45));
    const back = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false });
    B.geo(K.stone, back, M4(0, EAVE, MZ0 - 0.2));
  }
  // carved semicircular arch (chaitya) on the gable, and the roundel above it
  {
    const zf = 7.27;
    const ring = new THREE.TorusGeometry(1.25, 0.17, 8, 28, Math.PI);
    B.geo(K.stoneDark, ring, M4(0, EAVE, zf));
    const ring2 = new THREE.TorusGeometry(0.95, 0.08, 6, 24, Math.PI);
    B.geo(K.stone, ring2, M4(0, EAVE, zf));
    const disc = new THREE.CircleGeometry(1.1, 24, 0, Math.PI);
    B.geo(K.stoneDark, disc, M4(0, EAVE, zf - 0.02));
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const k = new THREE.SphereGeometry(0.13, 8, 6);
      B.geo(K.stone, k, M4(Math.cos(a) * 1.45, EAVE + Math.sin(a) * 1.45, zf + 0.05));
    }
    const boss = new THREE.SphereGeometry(0.3, 12, 8).scale(1, 1.1, 0.5);
    B.geo(K.stone, boss, M4(0, EAVE + 0.55, zf));
    const roundel = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20).rotateX(Math.PI / 2);
    B.geo(K.stoneDark, roundel, M4(0, RIDGE - 1.25, 7.25));
    const face = new THREE.SphereGeometry(0.24, 12, 10).scale(0.85, 1.1, 0.5);
    B.geo(K.stone, face, M4(0, RIDGE - 1.25, 7.33));
  }

  // ---------- roof: tin sheet gable, blue fascia ----------
  {
    const slope = Math.atan2(RIDGE - EAVE, EX);
    const len = Math.hypot(EX, RIDGE - EAVE);
    const zl = 14.9 - (MZ0 + 7), zc = 0.25 + (MZ0 + 7) / 2;
    for (const s of [-1, 1]) {
      const geo = new THREE.BoxGeometry(len + 0.1, 0.1, zl);
      B.geo(K.roof, geo, M4(s * EX / 2, (RIDGE + EAVE) / 2 + 0.05, zc, 0, 0, -s * slope));
      // fascia along the front rake
      const fr = new THREE.BoxGeometry(len + 0.2, 0.28, 0.1);
      B.geo(K.blue, fr, M4(s * EX / 2, (RIDGE + EAVE) / 2 - 0.02, 7.72, 0, 0, -s * slope));
      // scalloped trim under the fascia
      for (let i = 0; i < 26; i++) {
        const t = (i + 0.5) / 26;
        const tri = new THREE.ConeGeometry(0.07, 0.14, 4).rotateX(Math.PI);
        B.geo(K.blue, tri, M4(s * EX * t, RIDGE - (RIDGE - EAVE) * t - 0.22, 7.72));
      }
      // eave board along the side
      B.box(K.blue, 0.1, 0.3, zl, s * (EX + 0.02), EAVE - 0.22, zc);
      for (let i = 0; i < Math.floor(zl / 0.21); i++) {
        const tri = new THREE.ConeGeometry(0.07, 0.14, 4).rotateX(Math.PI);
        B.geo(K.blue, tri, M4(s * (EX + 0.03), EAVE - 0.29, MZ0 - 0.1 + i * 0.21));
      }
    }
    B.box(K.roof, 0.3, 0.14, zl, 0, RIDGE + 0.06, zc);
    B.box(K.blue, 0.12, 0.12, 0.6, 0, RIDGE + 0.12, 7.5);
  }

  // ================= front door and niches =================
  doorway(B, K, lbox, FRONT, 7.36, 0.9, 3.0, true);
  for (const s of [-1, 1]) niche(B, K, lbox, FRONT, s * 2.25, 7.36, 0.42, 1.7, F + 0.25);
  // square relief panels above the niches
  for (const s of [-1, 1]) {
    lbox(K.stoneDark, 1.05, 1.0, 0.1, s * 2.25, F + 3.1, 7.36, FRONT);
    const r = new THREE.TorusGeometry(0.3, 0.06, 6, 20);
    B.geo(K.stone, r, M4(s * 2.25, F + 3.6, 7.48));
    B.geo(K.stone, new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1, 0.5), M4(s * 2.25, F + 3.6, 7.46));
  }
  // carved frieze band of small cusped arches over the door bay
  for (let i = 0; i < 9; i++) {
    const a = archPanelGeometry(0.62, 0.42, 0.06, 5);
    B.geo(K.stoneDark, a, M4(-2.9 + i * 0.725, F + 4.25, 7.4));
  }
  B.box(K.carved, 6.9, 0.18, 0.5, 0, F + 4.08, 7.3);
  B.box(K.carved, 6.9, 0.2, 0.55, 0, F + 4.68, 7.3);
  // central bay mass (z 7 → 7.35), cut for the door
  B.box(K.carved, 2.4, WT - F, 0.35, -2.1, F, 7.17);
  B.box(K.carved, 2.4, WT - F, 0.35, 2.1, F, 7.17);
  B.box(K.stone, 1.8, WT - F - 3.0, 0.35, 0, F + 3.0, 7.17);
  // sign board
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.6), K.sign);
    sign.position.set(0, WT + 0.14, 7.54);
    g.add(sign);
    B.box(K.yellow, 2.8, 0.7, 0.06, 0, WT - 0.21, 7.49);
  }

  // ================= two tall silver trishul-and-damaru standards flanking the door =================
  // (c11: big polished silver tridents, ~2.6 m above the landing, a damaru tied below the prongs)
  {
    const silv = new THREE.MeshStandardMaterial({ color: 0xe2e4e8, metalness: 1, roughness: 0.22 });
    for (const sx of [-1, 1]) {
      const x = sx * 1.4, z = 8.0, y0 = F;
      B.geo(K.stoneDark, new THREE.CylinderGeometry(0.2, 0.26, 0.32, 14), M4(x, y0 + 0.16, z), false);
      B.geo(silv, new THREE.CylinderGeometry(0.05, 0.065, 2.0, 12), M4(x, y0 + 1.3, z), false);
      for (const k of [0.45, 1.2, 1.9]) B.geo(silv, new THREE.TorusGeometry(0.07, 0.022, 6, 14).rotateX(Math.PI / 2), M4(x, y0 + k, z), false);
      // damaru: two drums tip to tip
      for (const sg of [-1, 1]) B.geo(silv, new THREE.ConeGeometry(0.2, 0.24, 18, 1, false).rotateX(sg > 0 ? Math.PI : 0), M4(x, y0 + 1.75 + sg * 0.12, z), false);
      // the three prongs: a broad central blade and two curving side blades, joined by a crescent
      B.geo(silv, new THREE.TorusGeometry(0.34, 0.05, 8, 20, Math.PI).rotateZ(Math.PI), M4(x, y0 + 2.45, z), false);
      B.geo(silv, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), M4(x, y0 + 2.3, z), false);
      B.geo(silv, new THREE.ConeGeometry(0.1, 0.62, 4).scale(1, 1, 0.35), M4(x, y0 + 2.75, z), false);
      for (const sg of [-1, 1]) B.geo(silv, new THREE.ConeGeometry(0.08, 0.45, 4).scale(1, 1, 0.35), M4(x + sg * 0.37, y0 + 2.62, z, 0, 0, -sg * 0.18), false);
      // red and saffron cloth tied round the shaft below the damaru
      B.geo(K.red, new THREE.CylinderGeometry(0.09, 0.13, 0.32, 10, 1, true), M4(x, y0 + 1.45, z), false);
      P.solid(x - 0.25, F, z - 0.25, x + 0.25, F + 3.0, z + 0.25);
    }
  }

  // ================= side doors (closed, gilded) =================
  for (const [m, s] of [[EAST, 1], [WEST, -1]] as const) {
    const mm = new THREE.Matrix4().makeTranslation(s * 6.8, 0, 0).multiply(m);
    doorway(B, K, lbox, mm, 0.02, 0.75, 2.5, false);
    for (const t of [-1, 1]) niche(B, K, lbox, mm, t * 1.7, 0.02, 0.32, 1.0, F + 1.2);
  }

  // ================= torana: carved wooden gate frame in front of the door =================
  {
    for (const s of [-1, 1]) {
      B.box(K.maroon, 0.42, 5.4, 0.42, s * 3.75, 0, TZ, true);
      for (let k = 0; k < 6; k++) B.box(K.goldLeaf, 0.48, 0.08, 0.48, s * 3.75, 0.6 + k * 0.8, TZ);
      B.box(K.maroon, 0.6, 0.35, 0.6, s * 3.75, 0, TZ);
    }
    B.box(K.maroon, 8.4, 0.4, 0.45, 0, 5.15, TZ);
    B.box(K.goldLeaf, 8.0, 0.08, 0.47, 0, 5.3, TZ);
    B.box(K.maroon, 8.0, 0.14, 0.3, 0, 4.9, TZ);
    for (let i = 0; i < 13; i++) B.box(K.maroon, 0.08, 0.2, 0.3, -3.3 + i * 0.55, 4.72, TZ);
  }

  // ================= garbhagriha block + shikhara =================
  shikhara(B, K, g);

  // ================= interior: mandapa hall =================
  const O = offerings(g);
  const Os = offerings(g, env.lamp);
  hall(B, K, M, g, P, flames, O);
  buildSanctum(B, K, M, g, P, flames, Os, { F, S: SANCT.h, z0: SANCT.z0, z1: SANCT.z1, ceil: SANCT.ceil, door: 0.8 }, env, pending);
  // the thick walls of the garbhagriha block (colliders)
  P.solid(-GH - 0.9, 0, GZ - GH - 0.9, -SANCT.h, 8, GZ + GH);
  P.solid(SANCT.h, 0, GZ - GH - 0.9, GH + 0.9, 8, GZ + GH);
  P.solid(-SANCT.h, 0, GZ - GH - 0.9, SANCT.h, 8, SANCT.z0);
  P.solid(-SANCT.h, 0, SANCT.z1, -0.8, 8, MZ0);
  P.solid(0.8, 0, SANCT.z1, SANCT.h, 8, MZ0);
  // garland swags on the torana and over the door
  for (let i = 0; i < 4; i++) {
    const xa = -3.5 + i * 1.75;
    O.garland(new THREE.Vector3(xa + 0.1, 4.75, TZ + 0.22), new THREE.Vector3(xa + 1.65, 4.75, TZ + 0.22), 0.45, 1.2);
  }
  O.garland(new THREE.Vector3(-1.3, F + 3.35, 7.5), new THREE.Vector3(1.3, F + 3.35, 7.5), 0.5, 1.1);
  for (const s of [-1, 1]) O.garland(new THREE.Vector3(s * 1.3, F + 3.35, 7.5), new THREE.Vector3(s * 1.32, F + 1.2, 7.52), 0.02, 1.1);
  O.flush();
  Os.flush();

  // crown: kalash, flag
  const crownG = new THREE.Group();
  crownG.position.set(0, 0, GZ);
  g.add(crownG);
  const ky = kalash(crownG, K.goldLeaf, TOWER_TOP + 3.2, 1.7) - 0.1;
  // trident at the top of the pole
  for (const x of [-0.16, 0, 0.16]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.04, x === 0 ? 0.45 : 0.32, 6), K.goldLeaf);
    p.position.set(x, ky + 2.2, 0);
    crownG.add(p);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.04), K.goldLeaf);
  bar.position.set(0, ky + 2.02, 0);
  crownG.add(bar);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.75, side: THREE.DoubleSide });
  const flag = new Flag(crownG, K.goldLeaf, flagMat, 0, ky, 0, 2.0);
  flag.mesh.scale.setScalar(0.6);

  B.flush();
  return { flag, flames };
}

type LBox = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Matrix4) => void;

/** painted doorway: nested coloured frames (blue · red · yellow · sky) with a cusped arch head */
function doorway(B: Batch, K: KMats, lbox: LBox, m: THREE.Matrix4, z: number, hw: number, h: number, open: boolean) {
  const bands = [K.sky, K.yellow, K.red, K.blue, K.orange, K.blue];
  let w = hw;
  for (let i = 0; i < bands.length; i++) {
    const b = 0.1, d = 0.05 + i * 0.012;
    lbox(bands[i], b, h + i * 0.1, d, -(w + b / 2), F, z, m);
    lbox(bands[i], b, h + i * 0.1, d, w + b / 2, F, z, m);
    lbox(bands[i], 2 * (w + b), b, d, 0, F + h + i * 0.1, z, m);
    w += b;
  }
  // cusped arch head inside the opening
  const arch = archPanelGeometry(hw * 2, 0.8, 0.12, 5);
  B.geo(K.sky, arch, new THREE.Matrix4().multiplyMatrices(m, M4(0, F + h - 0.8, z + 0.02)));
  const arch2 = archPanelGeometry(hw * 2 - 0.1, 0.7, 0.14, 5);
  B.geo(K.yellow, arch2, new THREE.Matrix4().multiplyMatrices(m, M4(0, F + h - 0.75, z + 0.03)));
  if (!open) {
    // closed doors: gilded leaves with panels
    lbox(K.goldLeaf, hw * 2, h - 0.5, 0.06, 0, F, z - 0.02, m);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lbox(K.goldLeaf, hw * 0.7, 0.55, 0.05, s * hw * 0.5, F + 0.25 + k * 0.7, z + 0.02, m);
  }
  // threshold
  lbox(K.stoneDark, hw * 2 + 0.6, 0.12, 0.6, 0, F, z - 0.2, m);
}

/** a small painted niche (devakoshtha): dark recess within coloured frames, cusped head */
function niche(B: Batch, K: KMats, lbox: LBox, m: THREE.Matrix4, x: number, z: number, hw: number, h: number, y0: number) {
  lbox(K.black, hw * 2, h, 0.04, x, y0, z, m);
  const bands = [K.yellow, K.red, K.blue];
  let w = hw;
  for (let i = 0; i < bands.length; i++) {
    const b = 0.08, d = 0.06 + i * 0.01;
    lbox(bands[i], b, h + i * 0.08, d, x - (w + b / 2), y0, z, m);
    lbox(bands[i], b, h + i * 0.08, d, x + (w + b / 2), y0, z, m);
    lbox(bands[i], 2 * (w + b), b, d, x, y0 + h + i * 0.08, z, m);
    w += b;
  }
  const arch = archPanelGeometry(hw * 2, 0.45, 0.08, 5);
  B.geo(K.sky, arch, new THREE.Matrix4().multiplyMatrices(m, M4(x, y0 + h - 0.45, z + 0.03)));
  lbox(K.stoneDark, hw * 2 + 0.3, 0.12, 0.25, x, y0 - 0.12, z + 0.05, m);
}

// ---------------------------------------------------------------------------------------------

function shikhara(B: Batch, K: KMats, g: THREE.Group) {
  const z0 = GZ;
  // moulded base (adhisthana): many stepped courses, as the photographs show
  const base: [number, number, number, THREE.Material][] = [
    [0.0, 0.36, GH + 0.75, K.stoneDark], [0.36, 0.3, GH + 0.6, K.stoneDark], [0.66, 0.34, GH + 0.45, K.stone],
    [1.0, 0.22, GH + 0.6, K.stone], [1.22, 0.42, GH + 0.3, K.stone], [1.64, 0.2, GH + 0.45, K.stone],
    [1.84, 0.3, GH + 0.25, K.stoneDark], [2.14, 0.18, GH + 0.4, K.stone], [2.32, 0.3, GH + 0.15, K.stone],
  ];
  // hollow courses around the sanctum (inner face ±2.4), front clipped at the mandapa's back wall
  const IN = SANCT.h;
  for (const [y, h, hw, mat] of base) {
    if (y + h <= F) B.box(mat, hw * 2, h, hw * 2 - (z0 + hw - MZ0), 0, y, z0 - (z0 + hw - MZ0) / 2);
    else ring(B, mat, y, h, hw, z0 - hw, MZ0, IN, SANCT.z0, SANCT.z1, [0.8, F + 2.6], null);
  }
  // wall (jangha) 2.62 → 6.2 with projecting central offsets (rathas) and corner offsets
  ring(B, K.stone, 2.62, 3.6, GH, z0 - GH, MZ0, IN, SANCT.z0, SANCT.z1, [0.8, F + 2.6], null);
  B.box(K.stone, SANCT.h * 2, 6.84 - SANCT.ceil, SANCT.h * 2, 0, SANCT.ceil, z0);
  for (const [x, z, w, d] of [[0, -GH, 4.1, 0.36], [GH, 0, 0.36, 4.1], [-GH, 0, 0.36, 4.1]]) {
    B.box(K.stone, w, 3.6, d, x, 2.62, z0 + z);
  }
  for (const sx of [-1, 1]) {
    B.box(K.stone, 1.8, 3.6, 0.2, sx * (GH - 0.9), 2.62, z0 - GH - 0.05);
    B.box(K.stone, 0.2, 3.6, 1.8, sx * (GH + 0.05), 2.62, z0 - GH + 0.9);
    B.box(K.stone, 0.2, 3.6, 1.8, sx * (GH + 0.05), 2.62, z0 + GH - 0.9);
  }
  // serrated plan: on the three free faces (W, N, E) every course steps out in five offsets —
  // corners, two intermediate bays, the central bay — and the bold mouldings (rolls, cushions,
  // recessed necks) of the base and wall run round all of them
  const faces: [number, number][] = [[1, 0], [-1, 0], [0, -1]]; // outward normals (x, z): E, W, N
  const serr = (mat: THREE.Material, y: number, h: number, hw: number, step: number, round: boolean) => {
    for (const [nx, nz] of faces) {
      for (const [w, off] of [[hw * 1.3, step], [hw * 0.66, step * 2]] as const) {
        const depth = off * 1.8 + 0.4, dist = hw - 0.4 + depth / 2;
        const bx = nx !== 0 ? depth : w, bz = nz !== 0 ? depth : w;
        if (round) {
          const rg = new RoundedBoxGeometry(bx, h, bz, 3, Math.min(h / 2 - 0.001, 0.2));
          B.geo(mat, rg, M4(nx * dist, y + h / 2, z0 + nz * dist));
        } else B.box(mat, bx, h, bz, nx * dist, y, z0 + nz * dist);
      }
    }
  };
  const mould: [number, number, number, number, boolean, THREE.Material][] = [
    // y, h, half-width of the core, step, rounded?, material
    [0.0, 0.36, GH + 0.50, 0.12, false, K.stoneDark], [0.36, 0.34, GH + 0.60, 0.14, true, K.stone],
    [0.7, 0.18, GH + 0.30, 0.08, false, K.stoneDark], [0.88, 0.42, GH + 0.55, 0.16, true, K.stone],
    [1.3, 0.2, GH + 0.25, 0.08, false, K.stoneDark], [1.5, 0.3, GH + 0.45, 0.14, true, K.carved],
    [1.8, 0.22, GH + 0.20, 0.1, false, K.stone], [2.02, 0.3, GH + 0.40, 0.14, true, K.stone],
    [2.32, 0.3, GH + 0.15, 0.12, false, K.carved],
    // jangha: kumbha roll at mid-height, recessed neck, and the heavy cornice under the frieze
    [3.9, 0.5, GH + 0.25, 0.14, true, K.stone], [4.4, 0.18, GH + 0.00, 0.08, false, K.stoneDark],
    [5.75, 0.45, GH + 0.30, 0.15, true, K.carved],
  ];
  for (const [y, h, hw, step, round, mat] of mould) serr(mat, y, h, hw, step, round);
  // pilasters in the wall bays
  for (const [nx, nz] of faces) {
    for (const t of [-0.75, -0.25, 0.25, 0.75]) {
      const along = t * GH * 0.92, dist = GH + 0.12;
      const x = nx !== 0 ? nx * dist : along, z = nz !== 0 ? nz * dist : along;
      B.box(K.carved, nx !== 0 ? 0.24 : 0.5, 3.1, nz !== 0 ? 0.24 : 0.5, x, 2.62, z0 + z);
    }
  }
  B.box(K.stoneDark, GH * 2 + 0.6, 0.3, GH * 2 + 0.6, 0, 6.2, z0);
  B.box(K.carved, GH * 2 + 0.4, 0.34, GH * 2 + 0.4, 0, 6.5, z0);
  for (let i = 0; i < 19; i++) {
    const t = -GH + 0.1 + i * 0.65;
    for (const [x, z, ry] of [[t, GH + 0.22, 0], [t, -GH - 0.22, 0], [GH + 0.22, t, Math.PI / 2], [-GH - 0.22, t, Math.PI / 2]] as const) {
      B.slab(K.black, 0.3, 0.16, 0.04, x, 6.27, z0 + z, ry);
    }
  }

  // ---------- tower: a smooth, slightly convex tapering sheet of big slabs, each face divided by deep
  // full-height recesses into a broad central ratha and two corner karnas; thin flush string-courses;
  // bhumi-amalaka knobs at the karna corners at four levels ----------
  const Y0 = 6.84, Y1 = TOWER_TOP, A = 5.4, Bt = 3.9;
  const half = (t: number) => A - (A - Bt) * Math.pow(t, 1.25);
  const NL = 24;
  /** a lofted prism between levels; ext(t) gives [x0, x1, z0, z1] at height fraction t */
  const prism = (mat: THREE.Material, ext: (t: number) => [number, number, number, number], t0 = 0, t1 = 1, n = NL) => {
    const pos: number[] = [];
    const lv = Array.from({ length: n + 1 }, (_, i) => {
      const tt = t0 + ((t1 - t0) * i) / n;
      return { y: Y0 + (Y1 - Y0) * tt, e: ext(tt) };
    });
    const q = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < n; i++) {
      const { y: ya, e: [ax0, ax1, az0, az1] } = lv[i];
      const { y: yb, e: [bx0, bx1, bz0, bz1] } = lv[i + 1];
      q([ax0, ya, az1], [ax1, ya, az1], [bx1, yb, bz1], [bx0, yb, bz1]); // +z face
      q([ax1, ya, az0], [ax0, ya, az0], [bx0, yb, bz0], [bx1, yb, bz0]); // −z
      q([ax1, ya, az1], [ax1, ya, az0], [bx1, yb, bz0], [bx1, yb, bz1]); // +x
      q([ax0, ya, az0], [ax0, ya, az1], [bx0, yb, bz1], [bx0, yb, bz0]); // −x
    }
    const { y: yt, e: [tx0, tx1, tz0, tz1] } = lv[n];
    q([tx0, yt, tz1], [tx1, yt, tz1], [tx1, yt, tz0], [tx0, yt, tz0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    B.geo(mat, geo, M4(0, 0, z0));
  };
  const REC = 0.55, CW = 0.36, KW = 0.62; // recess depth; central ratha half-width; karna inner edge (fractions of half)
  prism(K.stone, (t) => { const h = half(t) - REC; return [-h, h, -h, h]; });
  prism(K.stone, (t) => { const h = half(t); return [-h * CW, h * CW, -h, h]; });
  prism(K.stone, (t) => { const h = half(t); return [-h, h, -h * CW, h * CW]; });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    prism(K.stone, (t) => {
      const h = half(t), xa = sx * h * KW, xb = sx * h, za = sz * h * KW, zb = sz * h;
      return [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)];
    });
  }
  // thin flush string-courses (3 cm proud) on the rathas and karnas
  const NB = 20;
  for (let i = 1; i < NB; i++) {
    const tb = i / NB, dt = (i < 3 ? 0.32 : 0.16) / (Y1 - Y0), e = i < 3 ? 0.14 : 0.08;
    prism(K.stone, (t) => { const h = half(t) + e; return [-h * CW - e, h * CW + e, -h, h]; }, tb, tb + dt, 1);
    prism(K.stone, (t) => { const h = half(t) + e; return [-h, h, -h * CW - e, h * CW + e]; }, tb, tb + dt, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      prism(K.stone, (t) => {
        const h = half(t) + e, xa = sx * (half(t) * KW - e), xb = sx * h, za = sz * (half(t) * KW - e), zb = sz * h;
        return [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)];
      }, tb, tb + dt, 1);
    }
  }
  // (the faces are plain ashlar between the string courses, as photographed: no niches or
  // medallions on the tower; only the sukanasa niche on the south face below)
  // bhumi-amalaka knobs at the karna corners, four levels
  for (const tk of [0.22, 0.44, 0.66, 0.88]) {
    const h = half(tk), y = Y0 + (Y1 - Y0) * tk;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const k = new THREE.SphereGeometry(0.32, 14, 8).scale(1, 0.62, 1);
      B.geo(K.stone, k, M4(sx * (h + 0.05), y, z0 + sz * (h + 0.05)));
    }
  }
  // sukanasa niche on the south face, above the mandapa ridge
  {
    const hw = half(0.36), zf = z0 + hw + 0.25;
    B.box(K.stone, 1.9, 0.5, 1.4, 0, 11.50, zf + 0.3);
    B.box(K.stoneDark, 1.7, 2.0, 1.2, 0, 12.00, zf + 0.2);
    B.box(K.red, 1.5, 1.8, 0.06, 0, 12.10, zf + 0.82);
    B.box(K.blue, 1.25, 1.62, 0.07, 0, 12.16, zf + 0.84);
    B.box(K.black, 1.0, 1.4, 0.07, 0, 12.24, zf + 0.86);
    // gilt image-plaque (rounded top) on a pedestal — no figure modelled
    B.box(K.goldLeaf, 0.6, 0.18, 0.3, 0, 12.26, zf + 0.75);
    const pl = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
    B.geo(K.goldLeaf, pl, M4(0, 12.85, zf + 0.85));
    B.box(K.goldLeaf, 0.6, 0.42, 0.06, 0, 12.44, zf + 0.85);
    B.box(K.blue, 1.9, 0.16, 1.5, 0, 14.00, zf + 0.25);
    B.box(K.yellow, 1.6, 0.18, 1.3, 0, 14.16, zf + 0.2);
    const ka = new THREE.Group();
    ka.position.set(0, 0, zf + 0.2);
    g.add(ka);
    kalash(ka, K.goldLeaf, 14.34, 0.7);
  }

  // ---------- painted wooden crown pavilion ----------
  const cz = z0;
  B.box(K.stone, Bt * 2 - 0.2, 0.3, Bt * 2 - 0.2, 0, Y1, cz);
  B.box(K.blue, 9.0, 0.22, 9.0, 0, Y1 + 0.3, cz);
  B.box(K.yellow, 8.7, 0.06, 8.7, 0, Y1 + 0.52, cz);
  B.box(K.black, 7.0, 1.2, 7.0, 0, Y1 + 0.55, cz); // the shadowed inner chamber seen through the arches
  const PY = Y1 + 0.58, PH = 1.15, R = 4.1;
  const bays = 7;
  for (let i = 0; i <= bays; i++) {
    const t = -R + (i * 2 * R) / bays;
    for (const [x, z] of [[t, R], [t, -R], [R, t], [-R, t]]) {
      B.box(K.blue, 0.2, PH, 0.2, x, PY, cz + z);
      B.box(K.red, 0.3, 0.12, 0.3, x, PY, cz + z);
      B.box(K.yellow, 0.34, 0.16, 0.34, x, PY + PH - 0.16, cz + z);
    }
  }
  // cusped arches between the posts
  for (let i = 0; i < bays; i++) {
    const t = -R + ((i + 0.5) * 2 * R) / bays, span = (2 * R) / bays - 0.2;
    for (const [x, z, ry] of [[t, R, 0], [t, -R, 0], [R, t, Math.PI / 2], [-R, t, Math.PI / 2]] as const) {
      B.geo(i % 2 ? K.red : K.blue, archPanelGeometry(span, 0.62, 0.08, 5), M4(x, PY + PH - 0.62, cz + z, ry));
      B.geo(K.yellow, archPanelGeometry(span - 0.08, 0.54, 0.1, 5), M4(x, PY + PH - 0.57, cz + z, ry));
    }
  }
  // beam and the wide overhanging eave
  B.box(K.blue, 8.6, 0.2, 8.6, 0, PY + PH, cz);
  B.box(K.red, 8.7, 0.08, 8.7, 0, PY + PH + 0.2, cz);
  {
    const Y = PY + PH + 0.28;
    // flared eave slab then gilt pyramid
    const eave = new THREE.CylinderGeometry(4.4 * Math.SQRT2, 4.85 * Math.SQRT2, 0.22, 4, 1).rotateY(Math.PI / 4);
    B.geo(K.goldLeaf, eave, M4(0, Y + 0.11, cz));
    const roof = new THREE.CylinderGeometry(0.85 * Math.SQRT2, 4.4 * Math.SQRT2, 0.75, 4, 1).rotateY(Math.PI / 4);
    B.geo(K.goldLeaf, roof, M4(0, Y + 0.22 + 0.375, cz));
    const neck = new THREE.CylinderGeometry(0.5, 0.7, 0.25, 16);
    B.geo(K.goldLeaf, neck, M4(0, Y + 1.09, cz));
    // fringe of little bells/pendants under the eave
    for (let i = 0; i < 28; i++) {
      const t = -4.6 + (i + 0.5) * (9.2 / 28);
      for (const [x, z] of [[t, 4.65], [t, -4.65], [4.65, t], [-4.65, t]]) {
        B.geo(K.goldLeaf, new THREE.ConeGeometry(0.05, 0.16, 5), M4(x, Y - 0.06, cz + z));
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------

function hall(B: Batch, K: KMats, M: Materials, g: THREE.Group, P: Physics, flames: Flames, O: Offerings) {
  const { x: HX, z0, z1, ceil } = HALL;
  // floor slab + walking surface (hall and both passages)
  const HC = (z0 + z1) / 2;
  B.box(K.paving, HX * 2, 0.05, z1 - z0, 0, F - 0.04, HC);
  P.floor(g, -HX, HX, z0, z1, F);
  P.floor(g, -0.9, 0.9, z1, 7.4, F);
  // ceiling: coffered stone
  B.box(K.stoneIn, HX * 2, 0.3, z1 - z0, 0, ceil, HC);
  for (const x of [-2.5, 0, 2.5]) B.box(K.stoneIn, 0.35, 0.3, z1 - z0, x, ceil - 0.3, HC);
  for (const z of [-2.15, 0, 2.15]) B.box(K.stoneIn, HX * 2, 0.3, 0.35, 0, ceil - 0.3, HC + z);
  // interior lining (darker, lamp-lit stone)
  B.slab(K.stoneIn, 0.04, ceil - F, z1 - z0, -HX + 0.02, F, HC);
  B.slab(K.stoneIn, 0.04, ceil - F, z1 - z0, HX - 0.02, F, HC);
  for (const s of [-1, 1]) {
    B.slab(K.stoneIn, HX - 0.9, ceil - F, 0.04, s * (0.9 + (HX - 0.9) / 2), F, z1 - 0.02);
    B.slab(K.stoneIn, HX - 0.8, ceil - F, 0.04, s * (0.8 + (HX - 0.8) / 2), F, z0 + 0.02);
  }
  B.slab(K.stoneIn, 1.8, ceil - F - 3.0, 0.04, 0, F + 3.0, z1 - 0.02);
  B.slab(K.stoneIn, 1.6, ceil - F - 2.6, 0.04, 0, F + 2.6, z0 + 0.02);
  // door reveal linings
  for (const s of [-1, 1]) B.slab(K.stoneIn, 0.04, 3.0, 1.9, s * 0.9, F, 6.4);
  B.slab(K.stoneIn, 1.8, 0.04, 1.9, 0, F + 3.0, 6.4);

  // four square pillars with bracket capitals
  for (const [x, z] of [[-2.5, HC + 2.1], [2.5, HC + 2.1], [-2.5, HC - 2.1], [2.5, HC - 2.1]]) {
    B.box(K.stoneIn, 0.9, 0.35, 0.9, x, F, z);
    P.solid(x - 0.45, F, z - 0.45, x + 0.45, ceil, z + 0.45);
    B.box(K.stoneIn, 0.66, ceil - F - 1.0, 0.66, x, F + 0.35, z);
    for (let k = 0; k < 3; k++) B.box(K.stoneIn, 0.74, 0.1, 0.74, x, F + 1.2 + k * 1.1, z);
    B.box(K.stoneIn, 0.84, 0.3, 0.84, x, ceil - 0.65, z);
    B.box(K.stoneIn, 1.6, 0.25, 0.6, x, ceil - 0.35, z);
  }

  // niches along the side walls: recess, brass frame, ledge, lamp and garland
  for (const s of [-1, 1]) {
    for (const z of [HC - 2.9, HC, HC + 2.9]) {
      const x = s * (HX - 0.05);
      B.slab(K.black, 0.06, 1.7, 1.1, x, F + 0.9, z);
      // a dark stone image in the niche (Pandavas, Kunti, Draupadi… as a simple robed standing
      // form, no features), red cloth over the shoulders, a marigold garland
      B.geo(K.idol, standingFigure(), M4(x - s * 0.22, F + 0.9, z, -s * Math.PI / 2), false);
      B.geo(K.red, new THREE.CylinderGeometry(0.17, 0.2, 0.22, 12, 1, true, 0, Math.PI * 1.2), M4(x - s * 0.22, F + 1.62, z, -s * Math.PI / 2 - Math.PI * 0.6), false);
      O.garland(new THREE.Vector3(x - s * 0.36, F + 1.82, z - 0.14), new THREE.Vector3(x - s * 0.36, F + 1.82, z + 0.14), 0.32, 0.8);
      B.geo(M.brass, archPanelGeometry(1.0, 0.45, 0.05, 5), M4(x - s * 0.06, F + 2.1, z, Math.PI / 2));
      B.slab(M.brass, 0.08, 0.08, 1.3, x - s * 0.02, F + 2.6, z);
      B.slab(M.brass, 0.08, 1.8, 0.08, x - s * 0.02, F + 0.85, z - 0.62);
      B.slab(M.brass, 0.08, 1.8, 0.08, x - s * 0.02, F + 0.85, z + 0.62);
      B.box(K.stoneIn, 0.35, 0.1, 1.3, x - s * 0.15, F + 0.8, z);
      B.geo(M.brass, new THREE.CylinderGeometry(0.09, 0.05, 0.06, 12), M4(x - s * 0.18, F + 0.93, z));
      flames.points.push(new THREE.Vector3(x - s * 0.18, F + 1.02, z));
      O.garland(new THREE.Vector3(x - s * 0.1, F + 2.75, z - 0.65), new THREE.Vector3(x - s * 0.1, F + 2.75, z + 0.65), 0.4);
    }
  }

  // silver-clad doorway into the sanctum passage, garlanded
  for (const sx of [-1, 1]) B.slab(M.silver, 0.18, 2.75, 0.12, sx * 0.88, F, z0 + 0.06);
  B.slab(M.silver, 1.95, 0.2, 0.12, 0, F + 2.6, z0 + 0.06);
  O.garland(new THREE.Vector3(-0.95, F + 2.75, z0 + 0.18), new THREE.Vector3(0.95, F + 2.75, z0 + 0.18), 0.45, 1.15);
  O.garland(new THREE.Vector3(-0.95, F + 2.85, z0 + 0.22), new THREE.Vector3(0.95, F + 2.85, z0 + 0.22), 0.25, 1.0);
  // passage to the sanctum
  P.floor(g, -0.8, 0.8, SANCT.z1, z0, F);
  for (const s of [-1, 1]) B.slab(K.stoneIn, 0.04, 2.6, z0 - SANCT.z1, s * 0.8, F, (z0 + SANCT.z1) / 2);
  B.slab(K.stoneIn, 1.6, 0.04, z0 - SANCT.z1, 0, F + 2.6, (z0 + SANCT.z1) / 2);
  B.slab(K.paving, 1.6, 0.04, z0 - SANCT.z1, 0, F - 0.03, (z0 + SANCT.z1) / 2);
  P.solid(-1.3, F, SANCT.z1, -0.8, F + 3, z0);
  P.solid(0.8, F, SANCT.z1, 1.3, F + 3, z0);

  // hanging brass bells in the hall
  const bellGeo = new THREE.LatheGeometry(
    [[0, 0], [0.2, 0], [0.19, 0.05], [0.15, 0.15], [0.11, 0.32], [0.06, 0.38], [0.02, 0.42], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  for (const [x, z] of [[0, HC + 1.0], [0, z0 + 1.2], [0, 6.2]]) {
    B.geo(M.brass, bellGeo.clone(), M4(x, F + 2.55, z), false);
    B.slab(M.brass, 0.02, ceil - F - 2.97, 0.02, x, F + 2.97, z);
  }
  // the large bell under the torana, outside
  B.geo(M.brass, bellGeo.clone().scale(1.5, 1.5, 1.5), M4(0, 3.6, TZ), false);
  B.slab(M.brass, 0.03, 1.2, 0.03, 0, 4.2, TZ);

  // the small Nandi inside the hall, gazing through the passage at the rock
  const little = nandiMesh(K.nandi);
  little.scale.setScalar(0.42);
  const nz = z0 + 1.6;
  little.position.set(0, F + 0.42, nz);
  g.add(little);
  B.box(K.stoneIn, 0.8, 0.42, 1.25, 0, F, nz);
  P.solid(-0.45, F, nz - 0.65, 0.45, F + 1.0, nz + 0.65);
  O.garland(new THREE.Vector3(-0.13, F + 0.84, nz - 0.33), new THREE.Vector3(0.13, F + 0.84, nz - 0.33), 0.18, 0.7);
  const l = new THREE.PointLight(0xffa860, 7, 13, 1.5);
  l.position.set(0, ceil - 1.4, 0.5);
  g.add(l);
  flames.lights.push(l);
}

/**
 * A hollow rectangular course: outer half-width ox, outer z range [oz0, oz1]; inner room
 * x ±ix, z [iz0, iz1]. Optional openings [half-width, top y] through the front (+z) and back pieces.
 */
function ring(
  B: Batch, mat: THREE.Material, y: number, h: number, ox: number, oz0: number, oz1: number,
  ix: number, iz0: number, iz1: number, front: [number, number] | null, back: [number, number] | null,
) {
  const piece = (x0: number, x1: number, za: number, zb: number, y0: number, y1: number) => {
    if (x1 - x0 < 0.01 || zb - za < 0.01 || y1 - y0 < 0.01) return;
    B.box(mat, x1 - x0, y1 - y0, zb - za, (x0 + x1) / 2, y0, (za + zb) / 2);
  };
  piece(-ox, -ix, oz0, oz1, y, y + h);
  piece(ix, ox, oz0, oz1, y, y + h);
  const cut = (za: number, zb: number, gap: [number, number] | null) => {
    if (!gap || y >= gap[1]) return piece(-ix, ix, za, zb, y, y + h);
    piece(-ix, -gap[0], za, zb, y, y + h);
    piece(gap[0], ix, za, zb, y, y + h);
    if (y + h > gap[1]) piece(-gap[0], gap[0], za, zb, gap[1], y + h);
  };
  cut(iz1, oz1, front);
  cut(oz0, iz0, back);
}

/** a simple standing robed figure ~1.2 m (lathe body, head, crown), shared by the hall niches */
let figGeo: THREE.BufferGeometry | null = null;
function standingFigure() {
  if (!figGeo) {
    const prof: [number, number][] = [[0, 0], [0.2, 0], [0.21, 0.06], [0.17, 0.3], [0.15, 0.6], [0.17, 0.78], [0.19, 0.86], [0.12, 0.92], [0.06, 0.95], [0, 0.95]];
    const body = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 20).toNonIndexed();
    const head = new THREE.SphereGeometry(0.085, 14, 10).scale(1, 1.15, 1).translate(0, 1.04, 0).toNonIndexed();
    const crown = new THREE.CylinderGeometry(0.04, 0.085, 0.14, 12).translate(0, 1.17, 0).toNonIndexed();
    const arms = new THREE.CapsuleGeometry(0.045, 0.42, 4, 8).translate(0.17, 0.62, 0.03).toNonIndexed();
    const arms2 = arms.clone().translate(-0.34, 0, 0);
    figGeo = mergeGeometries([body, head, crown, arms, arms2])!;
    figGeo.deleteAttribute('uv');
  }
  return figGeo.clone();
}

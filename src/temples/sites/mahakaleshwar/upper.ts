import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { box, garland, signSprite, archPanelGeometry, type Physics, type Flames } from '../../engine/kit';
import type { MahakalMats } from './mats';
import { fadeNear, cameraProbe } from './optimize';

/**
 * The temple's upper levels. Mahakaleshwar is a temple of three shrines stacked on one axis:
 *  1. the Jyotirlinga, in the garbhagriha below the ground (sanctum.ts);
 *  2. Shri Omkareshwar Mahadev, in the sanctum directly above him, at the level of the hall;
 *  3. Shri Nagchandreshwar, on the top storey: Shiva and Parvati (with Ganesha) seated on a coiled,
 *     hooded serpent, an 11th-century image said to have come from Nepal; its doors open for 24 hours a
 *     year, on Nag Panchami.
 *
 * Here (world metres, origin = temple centre at court level, +z south toward the entrance):
 *  - OMK: the Omkareshwar sanctum hollowed out of the tower at the plinth level (y 0.9), over the
 *    garbhagriha, reached from the hall's east aisle through a doorway in the hall's inner core (CORE);
 *  - the way up: a steep, narrow, temporary-looking steel stair (Nag Panchami darshan was given by
 *    temporary stairs before the present foot-bridge) in two flights against the tower's west face,
 *    from the north end of the hall's west aisle to a landing and back to the hall's terrace (STAIR);
 *  - NAG: the Nagchandreshwar room, the third storey's front block hollowed and carried back into the
 *    tower, entered from the terrace through the middle door under the "श्री नागचंद्रेश्वर मंदिर" board.
 */

/** Omkareshwar sanctum: x ±X, z Z0..Z1 (north..south), floor Y, ceiling CEIL; the linga at (0, Y, LZ). */
export const OMK = { X: 2.45, Z0: -7.0, Z1: -1.2, Y: 0.9, CEIL: 4.4, LZ: -5.3 };
/** The way in: a passage north from the hall's inner core (x X0..X1) and its doorway east, z DZ0..DZ1. */
export const CORE = { X0: 1.35, X1: 2.45, DZ0: 2.1, DZ1: 3.3, EAST: 5.0, H: 3.2 };
/** Nagchandreshwar room: x ±X, z Z0..Z1, floor Y, ceiling CEIL; the front wall's outer face at FRONT. */
export const NAG = { X: 3.75, Z0: -2.6, Z1: 3.05, Y: 9.55, CEIL: 12.35, FRONT: 3.35, DOOR: 0.65, DOOR_TOP: 12.1 };
/**
 * The steel stair on the tower's west face: flight A (inner lane, x A0..A1) from the plinth at z FOOT up
 * north to the landing (z LAND0..LAND1, y MID), flight B (outer lane, x B0..B1) from the landing back
 * south up to the top landing at the terrace (z FOOT..TOP1, y NAG.Y).
 */
export const STAIR_UP = { A0: -6.42, A1: -5.2, B0: -7.38, B1: -6.46, SEP: -6.44, FOOT: 0.6, LAND0: -4.4, LAND1: -5.6, MID: 5.25, TOP1: 1.55, Y0: 0.9 };

export type Box6 = [x0: number, y0: number, z0: number, x1: number, y1: number, z1: number];

/** The holes cut into the tower and the hall's core for the Omkareshwar sanctum and its passage. */
export const OMK_HOLES: Box6[] = [
  [-OMK.X, OMK.Y, OMK.Z0, OMK.X, OMK.CEIL, OMK.Z1],
  [CORE.X0, OMK.Y, OMK.Z1 - 0.01, CORE.X1, OMK.Y + CORE.H, CORE.DZ1],
  [CORE.X0, OMK.Y, CORE.DZ0, CORE.EAST + 0.01, OMK.Y + CORE.H, CORE.DZ1],
];
/** The holes cut into the tower top and the third storey's front block for the Nagchandreshwar room. */
export const NAG_HOLES: Box6[] = [
  [-NAG.X, NAG.Y, NAG.Z0, NAG.X, NAG.CEIL, NAG.Z1],
  [-NAG.DOOR, NAG.Y, NAG.Z1 - 0.01, NAG.DOOR, NAG.DOOR_TOP, NAG.FRONT + 0.01],
  // the two side windows (x 2.4..3.6, sill 1.0 m above the floor) open, with iron grilles
  [-3.6, NAG.Y + 1.0, NAG.Z1 - 0.01, -2.4, NAG.Y + 2.5, NAG.FRONT + 0.01],
  [2.4, NAG.Y + 1.0, NAG.Z1 - 0.01, 3.6, NAG.Y + 2.5, NAG.FRONT + 0.01],
];

/**
 * Build the solid box b minus the holes, as a few boxes (greedy merge of the grid the hole faces cut).
 * Each piece is a kit box (world-scaled UVs, so the seams don't show) and, with P, a collider.
 */
export function carve(parent: THREE.Object3D, mat: THREE.Material, b: Box6, holes: Box6[], P?: Physics, tile = 3) {
  const clip = holes
    .map((h) => [Math.max(h[0], b[0]), Math.max(h[1], b[1]), Math.max(h[2], b[2]), Math.min(h[3], b[3]), Math.min(h[4], b[4]), Math.min(h[5], b[5])] as Box6)
    .filter((h) => h[0] < h[3] - 1e-4 && h[1] < h[4] - 1e-4 && h[2] < h[5] - 1e-4);
  if (!clip.length) {
    box(parent, mat, b[3] - b[0], b[4] - b[1], b[5] - b[2], (b[0] + b[3]) / 2, b[1], (b[2] + b[5]) / 2, P, tile);
    return;
  }
  const cuts = (i: number) => [...new Set([b[i], b[i + 3], ...clip.flatMap((h) => [h[i], h[i + 3]])])].sort((p, q) => p - q);
  const xs = cuts(0), ys = cuts(1), zs = cuts(2);
  const nx = xs.length - 1, ny = ys.length - 1, nz = zs.length - 1;
  const idx = (i: number, j: number, k: number) => (j * nz + k) * nx + i;
  const full = new Uint8Array(nx * ny * nz);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, cz = (zs[k] + zs[k + 1]) / 2;
    full[idx(i, j, k)] = clip.some((h) => cx > h[0] && cx < h[3] && cy > h[1] && cy < h[4] && cz > h[2] && cz < h[5]) ? 0 : 1;
  }
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    if (!full[idx(i, j, k)]) continue;
    // grow along x, then z, then y
    let i1 = i; while (i1 + 1 < nx && full[idx(i1 + 1, j, k)]) i1++;
    const rowOk = (jj: number, kk: number) => { for (let ii = i; ii <= i1; ii++) if (!full[idx(ii, jj, kk)]) return false; return true; };
    let k1 = k; while (k1 + 1 < nz && rowOk(j, k1 + 1)) k1++;
    const slabOk = (jj: number) => { for (let kk = k; kk <= k1; kk++) if (!rowOk(jj, kk)) return false; return true; };
    let j1 = j; while (j1 + 1 < ny && slabOk(j1 + 1)) j1++;
    for (let jj = j; jj <= j1; jj++) for (let kk = k; kk <= k1; kk++) for (let ii = i; ii <= i1; ii++) full[idx(ii, jj, kk)] = 0;
    const x0 = xs[i], x1 = xs[i1 + 1], y0 = ys[j], y1 = ys[j1 + 1], z0 = zs[k], z1 = zs[k1 + 1];
    box(parent, mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, P, tile);
  }
}

// ---------------------------------------------------------------- zones

const inBox = (p: THREE.Vector3, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 && p.z > z0 && p.z < z1;

/** Feet in the Omkareshwar sanctum or its passage from the hall's core. */
const inOmk = (p: THREE.Vector3, yTop: number) =>
  inBox(p, -OMK.X - 0.05, OMK.X + 0.05, OMK.Y - 0.4, yTop, OMK.Z0 - 0.05, OMK.Z1 + 0.05)
  || inBox(p, CORE.X0 - 0.05, CORE.X1 + 0.05, OMK.Y - 0.4, yTop, OMK.Z1, CORE.DZ1 + 0.05)
  || inBox(p, CORE.X0, CORE.EAST, OMK.Y - 0.4, yTop, CORE.DZ0 - 0.05, CORE.DZ1 + 0.05);
const inNag = (p: THREE.Vector3) => inBox(p, -NAG.X - 0.05, NAG.X + 0.05, NAG.Y - 0.5, NAG.CEIL, NAG.Z0 - 0.05, NAG.Z1 + 0.05);

/** Zone under the pilgrim's feet on the upper levels, or null. */
export function upperZone(p: THREE.Vector3): string | null {
  if (inOmk(p, OMK.CEIL)) return 'omkareshwar-shrine';
  if (inNag(p)) return 'nagchandreshwar';
  const S = STAIR_UP;
  if (p.y > 1.15 && inBox(p, S.B0 - 0.1, -5.15, 1.15, NAG.Y + 0.5, S.LAND1 - 0.1, S.TOP1 + 0.05)) return 'nag-stair';
  if (p.y > NAG.Y - 0.3 && p.y < NAG.Y + 2 && Math.abs(p.x) < 7 && p.z > 0.4 && p.z < 9) return 'temple-terrace';
  return null;
}

/** Camera inside the Omkareshwar sanctum or the Nagchandreshwar room (their own lamp, not the hall's). */
export function upperIndoor(p: THREE.Vector3): boolean {
  return inOmk(p, OMK.CEIL) || inNag(p);
}

/**
 * Camera in the Nagchandreshwar room: it opens only south, over the terrace, so the tower hides the
 * queue sheds and the kund behind it.
 */
export function upperNagRoom(p: THREE.Vector3): boolean {
  return inNag(p);
}

/** Camera deep in the Omkareshwar sanctum or its north passage: nothing outside the tower can be seen. */
export function upperShut(p: THREE.Vector3): boolean {
  return inBox(p, -OMK.X, OMK.X, OMK.Y, OMK.CEIL, OMK.Z0, OMK.Z1 + 0.05)
    || inBox(p, CORE.X0, CORE.X1, OMK.Y, OMK.Y + CORE.H, OMK.Z1, CORE.DZ0 - 0.3);
}

// ---------------------------------------------------------------- notice

/** The notice at the stair's foot, Hindi first, then English. */
export const NAG_NOTICE = {
  hi: 'श्री नागचंद्रेश्वर मंदिर वर्ष में केवल एक बार, श्रावण शुक्ल पंचमी (नागपंचमी) पर 24 घंटे के लिए खुलता है; शेष वर्ष ऊपर जाने का मार्ग बंद रहता है। इस वर्चुअल यात्रा में आप ऊपर जा सकते हैं।',
  en: 'Shri Nagchandreshwar temple opens only once a year, for 24 hours on Nag Panchami (Shravan Shukla Panchami); the rest of the year the way up stays closed. In this virtual yatra you may go up.',
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A framed notice board on brass posts (the same look as the VIP notice in darshan.ts): a saffron
 * "सूचना · Note" band, then the Hindi and the English text. `pos` is the stand's foot; it faces +z turned by `ry`.
 */
function noticeBoard(parent: THREE.Object3D, M: Materials, pos: THREE.Vector3, ry: number, w: number, text: { hi: string; en: string }) {
  const h = w * 0.78, W = 1024, H = Math.round(W * 0.78);
  const t = canvasTex(W, H, (g) => {
    g.fillStyle = '#f6efdc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b8420e'; g.fillRect(0, 0, W, 104);
    g.strokeStyle = '#8a1410'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = '#fff4dc'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 60px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
    g.fillText('सूचना · Note', W / 2, 56);
    const wrap = (s: string, font: string, y: number, lh: number, col: string) => {
      g.font = font; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      let line = '';
      for (const word of s.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (g.measureText(test).width > W - 90 && line) { g.fillText(line, 45, y); y += lh; line = word; } else line = test;
      }
      if (line) { g.fillText(line, 45, y); y += lh; }
      return y;
    };
    let y = wrap(text.hi, '600 42px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif', 172, 58, '#3a1208');
    g.fillStyle = '#c9923a'; g.fillRect(45, y - 28, W - 90, 3);
    y = wrap(text.en, '500 36px "Helvetica Neue", Arial, sans-serif', y + 26, 47, '#2a2420');
  });
  const grp = new THREE.Group();
  grp.position.copy(pos);
  grp.rotation.y = ry;
  parent.add(grp);
  const y0 = 1.62 - h / 2 + 0.08;
  const teak = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.6 });
  box(grp, teak, w + 0.12, h + 0.12, 0.06, 0, y0 - 0.06, -0.02);
  for (const s of [-1, 1]) box(grp, M.brass, 0.05, y0 + h, 0.05, s * (w / 2 - 0.05), 0, -0.07);
  box(grp, M.brass, w + 0.16, 0.05, 0.08, 0, y0 + h + 0.04, -0.02);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0xe6e6e6 }));
  face.position.set(0, y0 + h / 2, 0.015);
  grp.add(face);
  return grp;
}

// ---------------------------------------------------------------- small shapes

const SPHERE = new THREE.SphereGeometry(1, 18, 12);

/** An ellipsoid (radii sx, sy, sz) at (x, y, z), turned by the Euler angles r. */
function blob(parent: THREE.Object3D, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, r: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.rotation.set(...r);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A round rod of radius r from a to b. */
function rod(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** A tube along a smooth curve through the points. */
function tube(parent: THREE.Object3D, mat: THREE.Material, pts: [number, number, number][], r: number) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 24, r, 8, false), mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** A brass oil lamp-stand (deepastambha): a turned stem with three tiers of lamp rings; flames on the tiers. */
function lampStand(parent: THREE.Object3D, M: Materials, flames: Flames, x: number, y: number, z: number, h: number) {
  const prof: [number, number][] = [[0, 0], [0.16, 0], [0.16, 0.04], [0.06, 0.1], [0.04, 0.3], [0.05, 0.34], [0.035, 0.5], [0.04, 1], [0, 1]];
  const lathe = new THREE.LatheGeometry(prof.map(([r, t]) => new THREE.Vector2(r, t * h)), 14);
  const m = new THREE.Mesh(lathe, M.brass);
  m.position.set(x, y, z);
  parent.add(m);
  for (const [t, r, n] of [[0.55, 0.16, 5], [0.75, 0.12, 4], [0.95, 0.08, 3]] as const) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.035, 14), M.brass);
    ring.position.set(x, y + t * h, z);
    parent.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * r * 0.85, y + t * h + 0.05, z + Math.sin(a) * r * 0.85));
    }
  }
}

/** A hanging temple bell on a chain from the ceiling at y1. */
function bell(parent: THREE.Object3D, M: Materials, x: number, y1: number, z: number, drop: number) {
  const geo = new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.1, 0.03], [0.08, 0.09], [0.065, 0.19], [0.035, 0.22], [0, 0.23]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 14);
  const b = new THREE.Mesh(geo, M.brass);
  b.position.set(x, y1 - drop, z);
  parent.add(b);
  rod(parent, M.brass, new THREE.Vector3(x, y1 - drop + 0.22, z), new THREE.Vector3(x, y1, z), 0.007, 4);
}

/**
 * A hooded serpent's fan: n hoods on an arc of radius R about c (in the x-y plane, facing +z), each a
 * flattened ellipsoid with a small head bent forward, and a neck rod back to the arc's foot.
 */
function hoodFan(parent: THREE.Object3D, mat: THREE.Material, c: THREE.Vector3, R: number, n: number, size: number, spread = 1.35) {
  const foot = c.clone().add(new THREE.Vector3(0, -R * 0.85, -0.02));
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1);
    const p = c.clone().add(new THREE.Vector3(Math.sin(a) * R, Math.cos(a) * R, 0));
    blob(parent, mat, size * 0.62, size, size * 0.24, p.x, p.y, p.z, [0, 0, -a]);
    const head = p.clone().add(new THREE.Vector3(Math.sin(a) * size * 0.85, Math.cos(a) * size * 0.85, size * 0.28));
    blob(parent, mat, size * 0.3, size * 0.24, size * 0.42, head.x, head.y, head.z, [0.5, 0, -a]);
    rod(parent, mat, foot, p, size * 0.16, 6);
  }
}

// ---------------------------------------------------------------- build

export interface UpperBuild {
  /** shown while the doorway lamp has moved into one of the upper rooms */
  update?(): void;
}

/**
 * The upper levels' interiors and the stair (the tower and the third storey are carved in temple.ts
 * with OMK_HOLES / NAG_HOLES). `doorGlow`, the hall doorway's one warm light, is carried into the
 * Omkareshwar sanctum or the Nagchandreshwar room while the camera is in one of them, so the light count
 * (and every shader variant) stays the same as outdoors.
 */
export function buildUpper(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames, doorGlow: THREE.PointLight | null) {
  SERPENT.envMap = S.env;
  SERPENT.envMapIntensity = 0.6;
  buildOmkareshwar(g, M, S, P, flames);
  buildNagchandreshwar(g, M, S, P, flames);
  buildStair(g, M, S, P);
  if (doorGlow) {
    const home = doorGlow.position.clone(), homeDist = doorGlow.distance;
    const omk = new THREE.Vector3(0.4, OMK.CEIL - 0.7, OMK.LZ + 2.2), nag = new THREE.Vector3(0, NAG.CEIL - 0.45, -0.1);
    let at: 'home' | 'omk' | 'nag' = 'home';
    cameraProbe(g, (p) => {
      const now = inOmk(p, OMK.CEIL) ? 'omk' : inNag(p) ? 'nag' : 'home';
      if (now === at) return;
      at = now;
      if (now === 'omk') { doorGlow.position.copy(omk); doorGlow.distance = 8; }
      else if (now === 'nag') { doorGlow.position.copy(nag); doorGlow.distance = 9; }
      else { doorGlow.position.copy(home); doorGlow.distance = homeDist; }
    });
  }
}

/** Shri Omkareshwar Mahadev: a black linga in a silver jalahari under a silver serpent, above Mahakal. */
function buildOmkareshwar(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames) {
  const { X, Z0, Z1, Y, CEIL, LZ } = OMK;
  const marble = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.3 });
  marble.envMap = S.env; marble.envMapIntensity = 0.7;
  // floors: the sanctum and its passage from the core (P.floor), white marble underfoot
  P.floor(g, -X, X, Z0, Z1, Y);
  P.floor(g, CORE.X0, CORE.X1, Z1, CORE.DZ1, Y);
  P.floor(g, CORE.X0, CORE.EAST, CORE.DZ0, CORE.DZ1, Y);
  box(g, marble, X * 2, 0.03, Z1 - Z0, 0, Y, (Z0 + Z1) / 2);
  box(g, marble, CORE.X1 - CORE.X0, 0.03, CORE.DZ1 - Z1, (CORE.X0 + CORE.X1) / 2, Y, (Z1 + CORE.DZ1) / 2);
  box(g, marble, CORE.EAST - CORE.X1, 0.03, CORE.DZ1 - CORE.DZ0, (CORE.EAST + CORE.X1) / 2, Y, (CORE.DZ0 + CORE.DZ1) / 2);
  // a lime-plastered ceiling and dado of silver repoussé round the sanctum
  box(g, M.plaster, X * 2, 0.05, Z1 - Z0, 0, CEIL - 0.05, (Z0 + Z1) / 2);
  box(g, S.repousse, X * 2 - 0.1, 2.9, 0.04, 0, Y, Z0 + 0.03);
  for (const sx of [-1, 1]) box(g, S.repousse, 0.04, 1.2, LZ + 1.6 - Z0, sx * (X - 0.03), Y, (Z0 + LZ + 1.6) / 2);
  box(g, M.gold, X * 2 - 0.1, 0.06, 0.06, 0, Y + 2.9, Z0 + 0.06);

  // the doorway from the hall's east aisle: a carved stone frame, brass bells, the name over it
  {
    const x = CORE.EAST + 0.02, zc = (CORE.DZ0 + CORE.DZ1) / 2, w = CORE.DZ1 - CORE.DZ0;
    box(g, S.pillar, 0.16, 0.24, w + 0.5, x, Y + CORE.H, zc);
    for (const s of [-1, 1]) box(g, S.pillar, 0.16, CORE.H, 0.22, x, Y, zc + s * (w / 2 + 0.11));
    garland(g, M.marigold, new THREE.Vector3(x + 0.1, Y + CORE.H - 0.05, CORE.DZ0 - 0.1), new THREE.Vector3(x + 0.1, Y + CORE.H - 0.05, CORE.DZ1 + 0.1), 0.3, 0.045);
    bell(g, M, x - 0.4, Y + CORE.H, zc, 0.55);
    fadeNear(signSprite(g, 'श्री ओंकारेश्वर महादेव', 'Shri Omkareshwar Mahadev', new THREE.Vector3(x + 0.6, Y + CORE.H + 0.75, zc), 1.5), 7, 3);
  }

  // the linga's platform, a step up, with a low silver rail round it (open toward the pilgrim)
  const lg = new THREE.Group();
  lg.position.set(0, Y, LZ);
  g.add(lg);
  box(lg, marble, 2.6, 0.18, 2.4, 0, 0, 0);
  // jalahari: a round silver yoni-pitha with its spout to the north, on a moulded base
  {
    const base = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.62, 0], [0.62, 0.08], [0.52, 0.12], [0.5, 0.26], [0.6, 0.3], [0.6, 0.36], [0, 0.36]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 32), M.silver);
    base.position.y = 0.18;
    lg.add(base);
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.66, -Math.PI / 2 + 0.32, Math.PI * 1.5 - 0.32, false);
    s.lineTo(-0.14, -1.12);
    s.quadraticCurveTo(0, -1.2, 0.14, -1.12);
    s.closePath();
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 24 }), M.silver);
    plate.rotation.x = Math.PI / 2; // shape y → world -z: the spout points north (into the wall's niche)
    plate.position.y = 0.18 + 0.36 + 0.08;
    lg.add(plate);
    // the black stone linga, a bilva leaf crown and a ring of flowers
    const linga = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.2, 0.3], [0.18, 0.38], [0.12, 0.45], [0, 0.48]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 28), S.lingam);
    linga.position.y = 0.62;
    lg.add(linga);
    // tripundra: three white bands of ash across the front
    const ash = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.202, 0.008, 4, 20, Math.PI * 0.7), ash);
      band.rotation.set(Math.PI / 2, 0, Math.PI * 0.15);
      band.position.y = 0.62 + 0.2 + i * 0.045;
      lg.add(band);
    }
    const bel = new THREE.MeshStandardMaterial({ color: 0x3e6a22, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      blob(lg, bel, 0.07, 0.015, 0.035, Math.cos(a) * 0.08, 1.1, Math.sin(a) * 0.08, [0, -a, 0.35]);
    }
    const ring = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 1), M.marigold, 22);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      ring.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.4, 0.66, Math.sin(a) * 0.4));
    }
    lg.add(ring);
    // the silver serpent over the linga: a neck from the jalahari's back, five hoods spread above
    tube(lg, SERPENT, [[0, 0.62, -0.42], [0, 0.95, -0.46], [0, 1.2, -0.36], [0, 1.3, -0.25]], 0.06);
    hoodFan(lg, SERPENT, new THREE.Vector3(0, 1.34, -0.2), 0.17, 5, 0.15, 1.1);
    // the brass abhishek pot (jaladhari) hung over the linga on three chains
    const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.04, 0.02], [0.17, 0.12], [0.2, 0.26], [0.13, 0.38], [0.12, 0.42], [0.15, 0.44]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 18), M.brass);
    pot.position.y = 2.05;
    lg.add(pot);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      rod(lg, M.brass, new THREE.Vector3(Math.cos(a) * 0.15, 2.48, Math.sin(a) * 0.15), new THREE.Vector3(0, CEIL - Y, 0), 0.006, 4);
    }
  }
  // a silver arch over the niche behind, hung with marigold strings and a white garland
  {
    const arch = new THREE.Mesh(archPanelGeometry(2.6, 2.5, 0.08, 7), M.silver);
    arch.position.set(0, Y + 0.2, Z0 + 0.12);
    g.add(arch);
    for (const s of [-1, 1]) box(g, M.silver, 0.18, 2.7, 0.12, s * 1.38, Y, Z0 + 0.12);
    garland(g, M.marigold, new THREE.Vector3(-1.3, Y + 2.65, Z0 + 0.25), new THREE.Vector3(1.3, Y + 2.65, Z0 + 0.25), 0.45, 0.05);
    garland(g, JASMINE, new THREE.Vector3(-1.1, Y + 2.45, Z0 + 0.3), new THREE.Vector3(1.1, Y + 2.45, Z0 + 0.3), 0.55, 0.035);
  }
  // brass lamp stands either side, a small brass Nandi facing the linga, bells from the ceiling
  lampStand(g, M, flames, -1.45, Y, LZ + 0.9, 1.25);
  lampStand(g, M, flames, 1.45, Y, LZ + 0.9, 1.25);
  {
    const nz = Z1 - 1.0;
    blob(g, M.brass, 0.16, 0.12, 0.3, 0, Y + 0.17, nz);
    blob(g, M.brass, 0.09, 0.1, 0.12, 0, Y + 0.33, nz - 0.3, [0.3, 0, 0]);
    box(g, marble, 0.5, 0.06, 0.8, 0, Y, nz);
  }
  for (const [x, z] of [[-1.0, LZ + 2.2], [1.0, LZ + 2.2], [CORE.X0 + 0.5, Z1 + 0.6]] as const) bell(g, M, x, CEIL, z, 0.75);
  // a low brass rail in front of the platform, open in the middle
  for (const s of [-1, 1]) {
    rod(g, M.brass, new THREE.Vector3(s * 0.45, Y + 0.7, LZ + 1.45), new THREE.Vector3(s * 1.6, Y + 0.7, LZ + 1.45), 0.025);
    for (const x of [0.45, 1.6]) rod(g, M.brass, new THREE.Vector3(s * x, Y, LZ + 1.45), new THREE.Vector3(s * x, Y + 0.72, LZ + 1.45), 0.03);
  }
  P.solid(-1.3, Y, LZ - 1.2, 1.3, Y + 1.2, LZ + 1.2);
  // the pilgrims' diyas on a ledge by the door
  for (let i = 0; i < 5; i++) flames.points.push(new THREE.Vector3(-1.9 + i * 0.12, Y + 0.95, Z1 - 0.25));
  box(g, marble, 0.8, 0.9, 0.25, -1.65, Y, Z1 - 0.2);
}

const JASMINE = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
/** polished silver of the serpents' coils and hoods (brighter than the embossed kit silver) */
const SERPENT = new THREE.MeshStandardMaterial({ color: 0xa9abb1, metalness: 0.8, roughness: 0.42 });
const ROSE = new THREE.MeshStandardMaterial({ color: 0x9a0f1e, roughness: 0.75 });
const ROSE_PINK = new THREE.MeshStandardMaterial({ color: 0xc63a5a, roughness: 0.75 });

/**
 * Shri Nagchandreshwar: the iconic image on an altar at the back of the room. Stylised and faceless:
 * Shiva and Parvati seated side by side on the coils of a serpent whose ten hoods fan out behind them, Ganesha
 * at Shiva's side, Nandi and Parvati's lion at their feet; dark stone, the serpent silver-clad as it is
 * dressed today, rose and jasmine garlands.
 */
function buildNagchandreshwar(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames) {
  const { X, Z0, Z1, Y, CEIL } = NAG;
  P.floor(g, -X, X, Z0, Z1, Y);
  P.floor(g, -NAG.DOOR, NAG.DOOR, Z1, NAG.FRONT + 0.02, Y);
  const marble = new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 0.35 });
  marble.envMap = S.env; marble.envMapIntensity = 0.6;
  box(g, marble, X * 2, 0.03, Z1 - Z0, 0, Y, (Z0 + Z1) / 2);
  box(g, marble, NAG.DOOR * 2, 0.03, NAG.FRONT - Z1, 0, Y, (Z1 + NAG.FRONT) / 2);
  box(g, M.plaster, X * 2, 0.05, Z1 - Z0, 0, CEIL - 0.05, (Z0 + Z1) / 2);
  // the window grilles
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.6, roughness: 0.5 });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) box(g, iron, 0.025, 1.5, 0.025, s * (2.45 + k * 0.183), Y + 1.0, NAG.FRONT - 0.15);
    box(g, iron, 1.2, 0.03, 0.03, s * 3.0, Y + 1.75, NAG.FRONT - 0.15);
  }

  // the altar: a moulded stone platform across the back; the image's niche framed in silver
  const AZ = Z0 + 0.65; // the image's centre line
  const AH = 0.4; // the altar's top
  box(g, S.stone, 3.4, AH, 1.3, 0, Y, Z0 + 0.65);
  box(g, S.frieze, 3.5, 0.12, 1.36, 0, Y + AH - 0.12, Z0 + 0.66);
  box(g, S.repousse, X * 2 - 0.1, CEIL - Y - 0.1, 0.04, 0, Y, Z0 + 0.03);
  {
    const arch = new THREE.Mesh(archPanelGeometry(2.7, 2.1, 0.08, 7), M.silver);
    arch.position.set(0, Y + AH, Z0 + 0.1);
    g.add(arch);
    for (const s of [-1, 1]) box(g, M.silver, 0.2, 2.1, 0.14, s * 1.45, Y + AH, Z0 + 0.12);
  }
  const stone = new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.5, metalness: 0.08 });
  stone.envMap = S.env; stone.envMapIntensity = 0.5;
  const sindoor = new THREE.MeshStandardMaterial({ color: 0xb4521c, roughness: 0.55 });
  const idol = new THREE.Group();
  idol.position.set(0, Y + AH, AZ);
  idol.scale.setScalar(1.1);
  g.add(idol);
  // the serpent's coils, the seat (silver-clad), with its body rising behind into the fan of hoods
  for (const [r, y, t] of [[0.62, 0.07, 0.08], [0.56, 0.2, 0.075], [0.5, 0.32, 0.07]] as const) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 36), SERPENT);
    c.rotation.x = Math.PI / 2;
    c.scale.y = 0.55;
    c.position.y = y;
    idol.add(c);
  }
  blob(idol, stone, 0.6, 0.12, 0.3, 0, 0.28, 0); // the seat's top
  tube(idol, SERPENT, [[0.5, 0.32, -0.15], [0.35, 0.55, -0.35], [0, 0.85, -0.42], [0, 1.1, -0.42]], 0.075);
  // ten hoods (most accounts; a few say seven), a wide canopy over Shiva, Parvati and Ganesha
  hoodFan(idol, SERPENT, new THREE.Vector3(0, 1.1, -0.42), 0.58, 10, 0.19, 1.35);
  // Shiva (left of the image's centre as you face it), seated cross-legged: a jata knot, a serpent at the neck
  const seated = (x: number, k: number, crown: boolean) => {
    blob(idol, stone, 0.22 * k, 0.08 * k, 0.16 * k, x, 0.42, 0.08); // folded legs
    blob(idol, stone, 0.13 * k, 0.21 * k, 0.09 * k, x, 0.42 + 0.24 * k, 0.02); // torso
    blob(idol, stone, 0.08 * k, 0.095 * k, 0.08 * k, x, 0.42 + 0.53 * k, 0.03); // head, no features
    for (const s of [-1, 1]) {
      const sh = new THREE.Vector3(x + s * 0.13 * k, 0.42 + 0.38 * k, 0.03);
      rod(idol, stone, sh, new THREE.Vector3(x + s * 0.17 * k, 0.42 + 0.14 * k, 0.11), 0.035 * k, 6);
    }
    if (crown) {
      const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * k, 0.07 * k, 0.15 * k, 12), M.gold);
      mk.position.set(x, 0.42 + 0.68 * k, 0.03);
      idol.add(mk);
    } else {
      blob(idol, stone, 0.06 * k, 0.09 * k, 0.06 * k, x, 0.42 + 0.68 * k, 0.0); // jata
      const snake = new THREE.Mesh(new THREE.TorusGeometry(0.075 * k, 0.014, 6, 18), SERPENT);
      snake.rotation.x = Math.PI / 2 - 0.3;
      snake.position.set(x, 0.42 + 0.42 * k, 0.04);
      idol.add(snake);
    }
  };
  seated(-0.24, 1.2, false);
  seated(0.26, 1.08, true);
  // Parvati's red chunri over her shoulders
  blob(idol, new THREE.MeshStandardMaterial({ color: 0x9a1a14, roughness: 0.8 }), 0.15, 0.05, 0.11, 0.26, 0.42 + 0.39, 0.05, [0, 0, 0.25]);
  // Ganesha at Shiva's side, smeared with sindoor: round belly, large head and a trunk
  {
    const x = -0.68, y = 0.36;
    blob(idol, sindoor, 0.13, 0.06, 0.1, x, y + 0.04, 0.12);
    blob(idol, sindoor, 0.11, 0.12, 0.09, x, y + 0.17, 0.08);
    blob(idol, sindoor, 0.085, 0.08, 0.08, x, y + 0.34, 0.07);
    for (const s of [-1, 1]) blob(idol, sindoor, 0.06, 0.055, 0.015, x + s * 0.08, y + 0.35, 0.04, [0, s * 0.4, 0]);
    tube(idol, sindoor, [[x, y + 0.31, 0.14], [x + 0.02, y + 0.22, 0.17], [x + 0.06, y + 0.15, 0.16]], 0.02);
  }
  // Nandi and the lion at the image's feet, before the coils
  blob(idol, stone, 0.15, 0.08, 0.08, -0.55, 0.0, 0.42);
  blob(idol, stone, 0.06, 0.07, 0.06, -0.42, 0.1, 0.47);
  blob(idol, stone, 0.14, 0.07, 0.07, 0.56, 0.0, 0.42);
  blob(idol, stone, 0.08, 0.08, 0.07, 0.44, 0.1, 0.47); // the mane
  box(g, S.stone, 1.6, 0.06, 0.4, 0, Y + AH - 0.06, AZ + 0.62);
  // garlands: jasmine and red roses over the couple, marigolds across the niche, heaps of roses at the sides
  garland(idol, JASMINE, new THREE.Vector3(-0.42, 1.0, 0.13), new THREE.Vector3(-0.06, 1.0, 0.13), 0.3, 0.022);
  garland(idol, ROSE, new THREE.Vector3(0.1, 0.95, 0.12), new THREE.Vector3(0.42, 0.95, 0.12), 0.28, 0.026);
  garland(idol, M.marigold, new THREE.Vector3(-0.85, 0.85, 0.22), new THREE.Vector3(0.85, 0.85, 0.22), 0.42, 0.03);
  garland(g, ROSE, new THREE.Vector3(-1.4, Y + AH + 2.1, Z0 + 0.25), new THREE.Vector3(1.4, Y + AH + 2.1, Z0 + 0.25), 0.1, 0.045);
  for (const s of [-1, 1]) garland(g, JASMINE, new THREE.Vector3(s * 1.45, Y + AH + 2.05, Z0 + 0.28), new THREE.Vector3(s * 1.4, Y + AH + 0.3, Z0 + 0.3), 0.08, 0.035);
  {
    const heap = (mat: THREE.Material, n: number, x: number, seed: number) => {
      const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 1), mat, n);
      let s = seed;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(rnd()) * 0.32, a = rnd() * Math.PI * 2;
        const y = 0.05 + (0.32 - r) * 0.6 * rnd();
        inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + Math.cos(a) * r, Y + AH + y, AZ + 0.2 + Math.sin(a) * r * 0.6));
      }
      g.add(inst);
    };
    heap(ROSE, 60, -1.15, 7); heap(ROSE_PINK, 40, -1.1, 11); heap(ROSE, 60, 1.15, 13); heap(JASMINE, 40, 1.1, 17);
  }
  // lamps either side of the altar, bells, and the steel barricade the Nag Panchami queue files past
  lampStand(g, M, flames, -2.1, Y, Z0 + 0.9, 1.35);
  lampStand(g, M, flames, 2.1, Y, Z0 + 0.9, 1.35);
  for (const x of [-1.6, 1.6]) bell(g, M, x, CEIL, 0.4, 0.8);
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
    const zb = Z0 + 2.0;
    for (const y of [0.5, 1.0]) rod(g, steel, new THREE.Vector3(-2.6, Y + y, zb), new THREE.Vector3(2.6, Y + y, zb), 0.025);
    for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) rod(g, steel, new THREE.Vector3(x, Y, zb), new THREE.Vector3(x, Y + 1.05, zb), 0.03);
    P.solid(-2.65, Y, zb - 0.05, 2.65, Y + 1.1, zb + 0.05);
  }
  fadeNear(signSprite(g, 'श्री नागचंद्रेश्वर', 'Shri Nagchandreshwar', new THREE.Vector3(0, CEIL - 0.4, Z0 + 2.3), 1.3), 4, 2);
  void flames;
}

/**
 * The way up: two steep steel flights with pipe hand-rails on both sides against the tower's west face,
 * a mid landing, and a top landing on to the hall's terrace; the notice and a sign at the foot.
 */
function buildStair(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics) {
  const U = STAIR_UP;
  const steel = new THREE.MeshStandardMaterial({ color: 0x5f6468, metalness: 0.65, roughness: 0.45 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x7c8084, metalness: 0.7, roughness: 0.4 });
  const rail = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
  const yTop = NAG.Y;
  /** one flight: treads from (zA, yA) to (zB, yB) between x0..x1, stringers, rails on both sides */
  const flight = (x0: number, x1: number, zA: number, yA: number, zB: number, yB: number, railX: number[]) => {
    P.floor(g, x0, x1, zA, zB, yA, yB);
    const n = Math.round((yB - yA) / 0.205), dz = (zB - zA) / n, dy = (yB - yA) / n;
    const tx0 = x0 + 0.04, tx1 = x1 - 0.04;
    const tread = new THREE.InstancedMesh(new THREE.BoxGeometry(tx1 - tx0, 0.035, Math.abs(dz) + 0.04), plate, n);
    for (let i = 0; i < n; i++) {
      tread.setMatrixAt(i, new THREE.Matrix4().makeTranslation((tx0 + tx1) / 2, yA + (i + 1) * dy - 0.02, zA + (i + 0.5) * dz));
    }
    tread.castShadow = tread.receiveShadow = true;
    g.add(tread);
    // stringers: channel sections under each edge
    for (const x of [x0 + 0.03, x1 - 0.03]) {
      const a = new THREE.Vector3(x, yA - 0.1, zA), b = new THREE.Vector3(x, yB - 0.1, zB);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, len), steel);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.lookAt(b.x, b.y, b.z);
      m.castShadow = true;
      g.add(m);
    }
    for (const x of railX) {
      const a = new THREE.Vector3(x, yA, zA), b = new THREE.Vector3(x, yB, zB);
      rod(g, rail, a.clone().setY(yA + 0.95), b.clone().setY(yB + 0.95), 0.024);
      rod(g, rail, a.clone().setY(yA + 0.5), b.clone().setY(yB + 0.5), 0.016);
      const k = Math.ceil(a.distanceTo(b) / 1.3);
      for (let i = 0; i <= k; i++) {
        const p = a.clone().lerp(b, i / k);
        rod(g, rail, p, p.clone().setY(p.y + 0.97), 0.022, 6);
      }
    }
  };
  flight(U.A0, U.A1, U.FOOT, U.Y0, U.LAND0, U.MID, [U.SEP + 0.03, U.A1 - 0.02]);
  flight(U.B0, U.B1, U.LAND0, U.MID, U.FOOT, yTop, [U.B0 + 0.03, U.SEP - 0.03]);
  // mid landing, on four posts to the plinth, railed on its north and west sides
  P.floor(g, U.B0, U.A1, U.LAND0 + 0.02, U.LAND1, U.MID);
  box(g, plate, U.A1 - U.B0, 0.08, U.LAND0 - U.LAND1, (U.B0 + U.A1) / 2, U.MID - 0.08, (U.LAND0 + U.LAND1) / 2);
  for (const [x, z] of [[U.B0 + 0.06, U.LAND1 + 0.06], [U.A1 - 0.06, U.LAND1 + 0.06], [U.B0 + 0.06, U.LAND0 - 0.06], [(U.B0 + U.B1) / 2, U.FOOT - 2.2]] as const) {
    const top = z < U.LAND0 ? U.MID - 0.08 : U.MID + (yTop - U.MID) * ((z - U.LAND0) / (U.FOOT - U.LAND0)) - 0.25;
    box(g, steel, 0.1, top - U.Y0, 0.1, x, U.Y0, z);
  }
  for (const [a, b] of [[[U.B0 + 0.02, U.LAND1 + 0.02], [U.A1, U.LAND1 + 0.02]], [[U.B0 + 0.02, U.LAND1 + 0.02], [U.B0 + 0.02, U.LAND0]]] as const) {
    const A = new THREE.Vector3(a[0], U.MID, a[1]), B = new THREE.Vector3(b[0], U.MID, b[1]);
    rod(g, rail, A.clone().setY(U.MID + 0.95), B.clone().setY(U.MID + 0.95), 0.024);
    rod(g, rail, A.clone().setY(U.MID + 0.5), B.clone().setY(U.MID + 0.5), 0.016);
    rod(g, rail, A, A.clone().setY(U.MID + 0.97), 0.022, 6);
  }
  // top landing at the terrace's level, on two tall posts
  P.floor(g, U.B0, -5.25, U.FOOT - 0.02, U.TOP1, yTop);
  box(g, plate, -5.25 - U.B0, 0.08, U.TOP1 - U.FOOT, (U.B0 - 5.25) / 2, yTop - 0.08, (U.FOOT + U.TOP1) / 2);
  for (const z of [U.FOOT + 0.05, U.TOP1 - 0.05]) box(g, steel, 0.1, yTop - 0.08 - U.Y0, 0.1, U.B0 + 0.06, U.Y0, z);
  {
    const A = new THREE.Vector3(U.B0 + 0.02, yTop, U.FOOT), B = new THREE.Vector3(U.B0 + 0.02, yTop, U.TOP1), C = new THREE.Vector3(-6.75, yTop, U.TOP1);
    const D = new THREE.Vector3(U.SEP, yTop, U.FOOT), E = new THREE.Vector3(-5.2, yTop, U.FOOT);
    for (const [p, q] of [[A, B], [B, C], [D, E]]) {
      rod(g, rail, p.clone().setY(yTop + 0.95), q.clone().setY(yTop + 0.95), 0.024);
      rod(g, rail, p.clone().setY(yTop + 0.5), q.clone().setY(yTop + 0.5), 0.016);
      rod(g, rail, p, p.clone().setY(yTop + 0.97), 0.022, 6);
    }
  }
  // colliders: the rail between the flights, the outer rails, the landings' open edges, and the space
  // under flight B closed off at the foot (a steel mesh panel)
  P.solid(U.SEP - 0.03, U.Y0, U.LAND0, U.SEP + 0.03, yTop + 1.2, U.FOOT);
  P.solid(U.B0 - 0.1, U.Y0, U.LAND1 - 0.1, U.B0, yTop + 1.2, U.TOP1 + 0.05);
  P.solid(U.B0 - 0.1, U.MID, U.LAND1 - 0.1, U.A1 + 0.05, U.MID + 1.1, U.LAND1);
  P.solid(U.B0 - 0.1, yTop, U.TOP1, -6.7, yTop + 1.1, U.TOP1 + 0.1);
  P.solid(U.SEP - 0.03, yTop, U.FOOT - 0.12, -5.15, yTop + 1.1, U.FOOT - 0.02);
  P.solid(U.B0 - 0.05, U.Y0, U.FOOT - 0.05, U.B1 + 0.02, U.Y0 + 2.4, U.FOOT + 0.05);
  {
    const mesh = new THREE.MeshStandardMaterial({ color: 0x55595d, metalness: 0.6, roughness: 0.5, transparent: false });
    for (let k = 0; k < 8; k++) box(g, mesh, 0.02, 2.0, 0.02, U.B0 + 0.06 + k * ((U.B1 - U.B0 - 0.1) / 7), U.Y0, U.FOOT);
    for (const y of [0.05, 1.0, 2.0]) box(g, mesh, U.B1 - U.B0, 0.04, 0.04, (U.B0 + U.B1) / 2, U.Y0 + y, U.FOOT);
  }
  // the terrace's open edges (its jali parapets are visual only)
  P.solid(-6.85, yTop, U.TOP1 + 0.05, -6.62, yTop + 1.1, 8.85);
  P.solid(6.62, yTop, 0.85, 6.85, yTop + 1.1, 8.85);
  P.solid(-6.85, yTop, 8.62, 6.85, yTop + 1.1, 8.85);
  P.floor(g, -6.65, 6.65, 0.85, 8.65, yTop);

  // the notice on the core's west face, turned toward the pilgrim coming up the aisle, and a sign
  noticeBoard(g, M, new THREE.Vector3(-5.25, U.Y0, 2.3), -Math.PI / 2 + 0.45, 0.85, NAG_NOTICE);
  fadeNear(signSprite(g, 'श्री नागचंद्रेश्वर ↑', 'Nagchandreshwar · up the stair', new THREE.Vector3(-5.75, U.Y0 + 3.3, 1.3), 1.6), 6, 2.5);
  void S;
}

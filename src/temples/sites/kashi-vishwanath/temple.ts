import * as THREE from 'three';
import { Flag, type Flames, type Physics, columnGeometry } from '../../engine/kit';
import type { KM } from './mats';
import { Merger, cylUV } from './merge';
import {
  nagaraSpire, KASHI_CLUSTER, STONE_CLUSTER, SHRINE_CLUSTER, onionDome, petalRing, kalashGeo, archWallGeo, archPlateGeo, lathe,
} from './spire';
import { buildSanctum } from './sanctum';
import { aoMass } from './ao';
import { shivling, type Offerings } from './shivling';

/**
 * Shri Kashi Vishwanath Mandir (Ahilyabai Holkar, 1780), modelled from photographs.
 * Origin = garbhagriha centre at Parisar floor level. +z = east (toward the chowk and the Ganga),
 * +x = north (toward the Gyanvapi mandap).
 *
 * As in the photographs the temple reads as three crowns on one compact plinth, north → south:
 *   the gilded Nagara shikhara over the garbhagriha (x = 0, apex ≈ 23 m), clad in stacked urushringas;
 *   the gilded onion dome over the sabha-mandapa (x ≈ −6.4);
 *   a carved buff-stone shikhara over the southern shrine (x ≈ −12.7).
 * Each crown rises from its own moulded wall-block (mandovara, 0.6–6.6 m); a low arcaded verandah
 * (to 4.1 m) runs along the east and west faces in front of them.
 */

export const TEMPLE = { x0: -16.6, x1: 3.3, z0: -3.3, z1: 3.3, floor: 0.6 };
export const GARBHA = { half: 2.0, wall: 1.3, ceil: 4.1 };
const F = 0.6;
const BODY_H = 4.6; // mandovara height above the platform: low, so the spires start at ≈ ¼–⅓ of the height
const VER = { depth: 1.8, h: 3.0 };

type Side = 'e' | 'w' | 'n' | 's';

/** A miniature spirelet (a tiny shikhara) crowning the small wall niches. */
const SPIRELET = (() => {
  const g = lathe([[0, 0], [0.13, 0], [0.13, 0.04], [0.12, 0.12], [0.09, 0.22], [0.05, 0.3], [0.06, 0.32], [0.03, 0.34], [0, 0.38]], 8, 8, 0.12);
  g.scale(1, 1, 0.6);
  return g;
})();

/** Little stepped pyramid (udgama) crowning a wall niche; base 0.7 × 0.25, faces +z. */
const NICHE_CROWN = (() => {
  const g = new THREE.CylinderGeometry(0.04, 0.36, 0.5, 4, 3).rotateY(Math.PI / 4).scale(1, 1, 0.45).translate(0, 0.25, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 1 + 0.12 * Math.sin(y * 38);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
})();

/** Box on one face of a square block centred at (cx, cz): `a` along the face, `c` outward from the centre. */
function faceBox(B: Merger, mat: THREE.Material, cx: number, cz: number, side: Side, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, solid = false) {
  const [x0, x1, z0, z1] =
    side === 'e' ? [cx + a0, cx + a1, cz + c0, cz + c1]
      : side === 'w' ? [cx + a0, cx + a1, cz - c1, cz - c0]
        : side === 'n' ? [cx + c0, cx + c1, cz + a0, cz + a1]
          : [cx - c1, cx - c0, cz + a0, cz + a1];
  B.span(mat, Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), solid);
}
const faceRy = (side: Side) => (side === 'e' ? 0 : side === 'w' ? Math.PI : side === 'n' ? Math.PI / 2 : -Math.PI / 2);
const facePt = (cx: number, cz: number, side: Side, a: number, c: number): [number, number] =>
  side === 'e' ? [cx + a, cz + c] : side === 'w' ? [cx - a, cz - c] : side === 'n' ? [cx + c, cz - a] : [cx - c, cz + a];

/**
 * A moulded wall-block (mandovara) of half-size `half`, walls `wall` thick, with door openings on
 * the given sides: khura–kumbha–kalasha–kapota base mouldings, a jangha with ratha pilasters and
 * niches, and a varandika cornice.
 */
function mandovara(B: Merger, K: KM, mat: THREE.Material, plain: THREE.Material, cx: number, cz: number, half: number, wall: number, doors: Side[], doorW = 1.3, doorH = 2.5) {
  const H = BODY_H, y = F;
  const base: [number, number, number][] = [[0, 0.28, 0.2], [0.28, 0.7, 0.12], [0.7, 0.9, 0.22], [0.9, 1.12, 0.3]];
  const top: [number, number, number][] = [[H - 1.45, H - 1.15, 0.15], [H - 1.15, H - 0.88, 0.42], [H - 0.88, H - 0.6, 0.12], [H - 0.6, H, 0.06]];
  for (const side of ['e', 'w', 'n', 's'] as Side[]) {
    const door = doors.includes(side);
    const segs = (y1: number): [number, number][] => (door && y + y1 <= y + doorH + 0.01 ? [[-half, -doorW / 2], [doorW / 2, half]] : [[-half, half]]);
    // wall slab
    for (const [a0, a1] of segs(0)) faceBox(B, plain, cx, cz, side, a0, a1, y, y + doorH, half - wall, half, true);
    faceBox(B, plain, cx, cz, side, -half, half, y + doorH, y + H, half - wall, half, true);
    // base and cornice mouldings (each wraps past the corners by its projection)
    for (const [b0, b1, out] of [...base, ...top]) {
      for (const [a0, a1] of segs(b1)) {
        const e0 = a0 === -half ? -half - out : a0, e1 = a1 === half ? half + out : a1;
        faceBox(B, b0 < 1.2 ? mat : plain, cx, cz, side, e0, e1, y + b0, y + b1, half - 0.05, half + out);
      }
    }
    // ratha pilasters on the jangha and niches between
    const j0 = y + 1.12, j1 = y + H - 1.45;
    for (const s of [-1, 1]) {
      faceBox(B, mat, cx, cz, side, s * (half - 0.62), s * half, j0, j1, half, half + 0.07);
      const u = s * (half - 1.25);
      faceBox(B, mat, cx, cz, side, u - 0.3, u + 0.3, j0, j1, half, half + 0.13);
      const [nx, nz] = facePt(cx, cz, side, u, half + 0.135);
      B.place(K.dark, archPlateGeo(0.42, 0.85, 0.32, 5), nx, j0 + 0.55, nz, faceRy(side));
      faceBox(B, mat, cx, cz, side, u - 0.34, u + 0.34, j0 + 1.75, j0 + 1.9, half, half + 0.24);
    }
    // ---- carved relief in real geometry ----
    // kumbha course: a row of upright lotus petals (ribs) round the base
    for (let a = -half - 0.08; a <= half + 0.08; a += 0.17) {
      if (door && Math.abs(a) < doorW / 2 + 0.06) continue;
      faceBox(B, mat, cx, cz, side, a - 0.045, a + 0.045, y + 0.33, y + 0.66, half + 0.12, half + 0.17);
    }
    // dentil course under the cornice
    for (let a = -half - 0.1; a <= half + 0.1; a += 0.24) {
      faceBox(B, plain, cx, cz, side, a - 0.06, a + 0.06, y + H - 1.62, y + H - 1.45, half, half + 0.12);
    }
    // a carved string band across the jangha
    for (const [a0, a1] of (door ? [[-half, -doorW / 2 - 0.02], [doorW / 2 + 0.02, half]] : [[-half, half]]) as [number, number][]) {
      faceBox(B, mat, cx, cz, side, a0, a1, y + 1.12, y + 1.3, half, half + 0.1);
    }
    // niche aedicules on the flanking projections: colonnettes, lintel and a little pyramidal crown
    for (const s of [-1, 1]) {
      const u = s * (half - 1.25);
      for (const v of [-0.27, 0.27]) faceBox(B, plain, cx, cz, side, u + v - 0.04, u + v + 0.04, j0 + 0.5, j0 + 1.45, half + 0.13, half + 0.2);
      faceBox(B, plain, cx, cz, side, u - 0.33, u + 0.33, j0 + 1.45, j0 + 1.55, half + 0.13, half + 0.24);
      const [px, pz] = facePt(cx, cz, side, u, half + 0.18);
      B.place(plain, NICHE_CROWN, px, j0 + 1.55, pz, faceRy(side));
      faceBox(B, plain, cx, cz, side, u - 0.3, u + 0.3, j0 + 0.42, j0 + 0.5, half + 0.13, half + 0.22);
    }
    // dense carved courses: bead frieze and a row of miniature niches with spirelets under the cornice,
    // slender pilasters on the corner projections
    for (const [a0, a1] of (door ? [[-half, -doorW / 2 - 0.25], [doorW / 2 + 0.25, half]] : [[-half, half]]) as [number, number][]) {
      for (let a = a0 + 0.06; a < a1 - 0.04; a += 0.11) faceBox(B, mat, cx, cz, side, a - 0.035, a + 0.035, j1 - 0.22, j1 - 0.15, half + 0.05, half + 0.1);
      faceBox(B, plain, cx, cz, side, a0, a1, j1 - 0.27, j1 - 0.22, half, half + 0.12);
    }
    for (const s of [-1, 1]) {
      for (const u of [s * (half - 0.2), s * (half - 0.45)]) faceBox(B, plain, cx, cz, side, u - 0.045, u + 0.045, j0 + 0.2, j1 - 0.3, half + 0.07, half + 0.12);
      for (const u of [s * 1.45]) {
        if (Math.abs(u) > half - 0.6) continue;
        const [px, pz] = facePt(cx, cz, side, u, half + 0.13);
        B.place(K.dark, archPlateGeo(0.26, 0.32, 0.18, 5), px, j1 - 0.95, pz, faceRy(side));
        B.place(plain, SPIRELET, px, j1 - 0.48, pz, faceRy(side));
      }
    }
    // central bhadra projection (a frame round the door, or a blind niche)
    faceBox(B, mat, cx, cz, side, -1.15, -doorW / 2 - 0.02, j0, j1, half, half + 0.18);
    faceBox(B, mat, cx, cz, side, doorW / 2 + 0.02, 1.15, j0, j1, half, half + 0.18);
    if (!door) {
      faceBox(B, mat, cx, cz, side, -doorW / 2, doorW / 2, j0, j1, half, half + 0.12);
      const [nx, nz] = facePt(cx, cz, side, 0, half + 0.125);
      B.place(K.dark, archPlateGeo(0.8, 1.2, 0.5, 7), nx, j0 + 0.3, nz, faceRy(side));
      const [cx2, cz2] = facePt(cx, cz, side, 0, half + 0.22);
      B.place(plain, NICHE_CROWN, cx2, j0 + 2.05, cz2, faceRy(side), 1.5);
    } else {
      faceBox(B, mat, cx, cz, side, -doorW / 2, doorW / 2, y + doorH, j1, half, half + 0.18);
    }
  }
}

export function buildTemple(root: THREE.Group, K: KM, P: Physics, flames: Flames, O: Offerings) {
  const g = new THREE.Group();
  g.name = 'kashi-vishwanath-mandir';
  root.add(g);
  const B = new Merger(P, 'temple');
  const Gd = new Merger(P, 'gold');
  const { x0, x1, z0, z1 } = TEMPLE;
  const gx = 0, hx = -6.65, sx = -13.3, half = 3.3;

  // ---------- jagati: marble platform with steps, an opening for the sunk basin ----------
  const jx0 = x0 - VER.depth - 0.4, jx1 = x1 + VER.depth + 0.4, jz0 = z0 - VER.depth - 0.4, jz1 = z1 + VER.depth + 0.4;
  const frame = (mat: THREE.Material, a0: number, a1: number, b0: number, b1: number, y1: number, w: number) => {
    B.span(mat, a0, 0, b0, a1, y1, b0 + w); B.span(mat, a0, 0, b1 - w, a1, y1, b1);
    B.span(mat, a0, 0, b0 + w, a0 + w, y1, b1 - w); B.span(mat, a1 - w, 0, b0 + w, a1, y1, b1 - w);
  };
  frame(K.marble, jx0 - 0.76, jx1 + 0.76, jz0 - 0.76, jz1 + 0.76, 0.2, 0.4);
  frame(K.marble, jx0 - 0.38, jx1 + 0.38, jz0 - 0.38, jz1 + 0.38, 0.4, 0.4);
  const bh = { x: 0.97, z: 0.87 };
  B.span(K.marble, jx0, 0, jz0, -bh.x, F, jz1);
  B.span(K.marble, bh.x, 0, jz0, jx1, F, jz1);
  B.span(K.marble, -bh.x, 0, jz0, bh.x, F, -bh.z);
  B.span(K.marble, -bh.x, 0, bh.z, bh.x, F, jz1);
  P.floor(g, jx0, jx1, jz0, jz1, F);
  P.floor(g, jx0, jx1, jz1 + 0.76, jz1, 0, F);
  P.floor(g, jx0, jx1, jz0 - 0.76, jz0, 0, F);

  // ---------- the three wall-blocks ----------
  mandovara(B, K, K.temple, K.templePlain, gx, 0, half, 1.3, ['e', 'w', 'n', 's']);
  mandovara(B, K, K.temple, K.templePlain, sx, 0, half, 0.9, ['e'], 1.1, 2.2);
  // garbhagriha door frames: silver, with garlands
  const D = 0.65;
  for (const side of ['e', 'w', 'n', 's'] as Side[]) {
    const [fx, fz] = facePt(gx, 0, side, 0, half + 0.19);
    const fr = new THREE.Group();
    fr.position.set(fx, F, fz);
    fr.rotation.y = faceRy(side);
    g.add(fr);
    for (const [w, h, px, py] of [[0.2, 2.62, -D - 0.1, 0], [0.2, 2.62, D + 0.1, 0], [1.7, 0.24, 0, 2.5]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1).translate(px, py + h / 2, 0), K.silverEmb);
      fr.add(m);
    }
    O.strand(new THREE.Vector3(-0.85, 2.8, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), faceRy(side)).add(fr.position),
      new THREE.Vector3(0.85, 2.8, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), faceRy(side)).add(fr.position), 0.38, 1.1);
  }

  // saffron cloth valances with a red border over the doorways
  {
    const val = new THREE.PlaneGeometry(1.9, 0.45, 16, 1);
    const vp = val.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i), y = vp.getY(i);
      if (y < 0) vp.setY(i, y + 0.12 * Math.abs(Math.sin((x / 1.9) * Math.PI * 4)));
      vp.setZ(i, 0.03 * Math.cos(x * 6));
    }
    val.computeVertexNormals();
    const border = new THREE.PlaneGeometry(1.9, 0.07);
    for (const side of ['e', 'w', 'n'] as Side[]) {
      const [vx, vz] = facePt(gx, 0, side, 0, half + 0.27);
      B.place(K.saffron, val, vx, F + 2.82, vz, faceRy(side));
      B.place(K.redCloth, border, vx, F + 3.02, vz + (side === 'e' ? 0.01 : side === 'w' ? -0.01 : 0), faceRy(side));
    }
    for (const s of [1, -1]) {
      B.place(K.saffron, val, hx, F + 2.45, s * 3.04, s > 0 ? 0 : Math.PI, [0.9, 1, 1]);
    }
  }

  // ---------- sabha-mandapa between them, under the dome ----------
  const mx0 = sx + half, mx1 = gx - half, mz = 3.0, MH = 4.0;
  for (const s of [1, -1]) {
    // long walls with a doorway each side (east, west)
    B.span(K.temple, mx0, F, s > 0 ? mz - 0.5 : -mz, hx - 0.8, F + MH, s > 0 ? mz : -mz + 0.5, true);
    B.span(K.temple, hx + 0.8, F, s > 0 ? mz - 0.5 : -mz, mx1, F + MH, s > 0 ? mz : -mz + 0.5, true);
    // inside: carved dado, a frieze under the ceiling and blind niches
    const zi = s > 0 ? mz - 0.5 : -mz + 0.5, zo = s > 0 ? zi - 0.1 : zi + 0.1;
    for (const [xa, xb] of [[mx0, hx - 0.8], [hx + 0.8, mx1]]) {
      B.span(K.templePlain, xa, F, Math.min(zi, zo), xb, F + 0.75, Math.max(zi, zo));
      B.span(K.templePlain, xa, F + MH - 0.75, Math.min(zi, zo), xb, F + MH - 0.6, Math.max(zi, zo));
      for (let x = xa + 0.7; x < xb - 0.4; x += 1.3) B.place(K.dark, archPlateGeo(0.6, 0.9, 0.4, 5), x, F + 1.2, zo + (s > 0 ? -0.005 : 0.005), s > 0 ? Math.PI : 0);
    }
    B.span(K.templePlain, hx - 0.8, F + 2.6, s > 0 ? mz - 0.5 : -mz, hx + 0.8, F + MH, s > 0 ? mz : -mz + 0.5);
    // carved base course and blind niches on the hall walls
    B.span(K.temple, mx0, F, s > 0 ? mz : -mz - 0.15, hx - 0.8, F + 0.9, s > 0 ? mz + 0.15 : -mz);
    B.span(K.temple, hx + 0.8, F, s > 0 ? mz : -mz - 0.15, mx1, F + 0.9, s > 0 ? mz + 0.15 : -mz);
  }
  B.span(K.templePlain, mx0, F + MH, -mz - 0.3, mx1, F + MH + 0.35, mz + 0.3);
  // the band between the towers (above the verandah eave): rosette course, dentils, parapet pinnacles
  {
    const ros = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).rotateX(Math.PI / 2);
    const pin = lathe([[0, 0], [0.09, 0], [0.09, 0.05], [0.06, 0.08], [0.08, 0.16], [0.04, 0.26], [0, 0.32]], 8);
    for (const s of [1, -1]) {
      const zf = s * (mz + 0.02);
      for (let x = mx0 + 0.25; x < mx1 - 0.15; x += 0.34) {
        B.place(K.temple, ros, x, F + MH - 0.62, zf + s * 0.02);
        B.box(K.templePlain, 0.12, 0.12, 0.1, x + 0.17, F + MH - 0.22, zf + s * 0.04);
      }
      B.span(K.temple, mx0, F + MH - 0.42, Math.min(zf, zf + s * 0.1), mx1, F + MH - 0.34, Math.max(zf, zf + s * 0.1));
      for (let x = mx0 + 0.4; x < mx1; x += 0.8) B.place(K.templePlain, pin, x, F + MH + 0.55, s * (mz + 0.35));
    }
  }
  B.span(K.temple, mx0 - 0.2, F + MH + 0.35, -mz - 0.5, mx1 + 0.2, F + MH + 0.55, mz + 0.5);
  B.span(K.templePlain, mx0, F + MH - 0.25, -mz, mx1, F + MH, mz); // ceiling

  // ---------- verandah arcade along the east and west faces ----------
  const colH = VER.h - 0.4, colGeo = cylUV(columnGeometry(colH, 0.17), 0.19);
  const bays = 8, bay = (x1 + 0.2 - (x0 - 0.2)) / bays;
  for (const s of [1, -1]) {
    const zc = s * (z1 + VER.depth);
    for (let i = 0; i <= bays; i++) {
      const x = x0 - 0.2 + i * bay;
      B.place(K.templeCol, colGeo, x, F, zc, 0, 1, true);
      P.solid(x - 0.22, F, zc - 0.22, x + 0.22, F + colH, zc + 0.22);
      if (i < bays) B.place(K.temple, archWallGeo(bay - 0.3, colH, 0.26, bay - 0.46, colH * 0.45, colH * 0.4, 9), x + bay / 2, F, zc);
    }
    // beam, roof, eave
    B.span(K.templePlain, x0 - 0.45, F + colH, Math.min(zc, s * z1) - 0.25, x1 + 0.45, F + colH + 0.4, Math.max(zc, s * z1) + 0.25);
    // deep eave (chhajja): a sloping slab projecting 1.2 m, throwing the arcade into strong shadow
    const ez0 = s > 0 ? z1 : -z1 - VER.depth - 1.2, ez1 = s > 0 ? z1 + VER.depth + 1.2 : -z1;
    B.span(K.temple, x0 - 1.0, F + colH + 0.4, ez0, x1 + 1.0, F + colH + 0.62, ez1);
    const lipZ = s * (z1 + VER.depth + 1.2);
    B.span(K.templePlain, x0 - 1.0, F + colH + 0.25, Math.min(lipZ, lipZ - s * 0.12), x1 + 1.0, F + colH + 0.4, Math.max(lipZ, lipZ - s * 0.12));
    // brackets under the eave at every column
    for (let i = 0; i <= bays; i++) {
      const x = x0 - 0.2 + i * bay;
      B.span(K.temple, x - 0.09, F + colH - 0.1, Math.min(zc, zc + s * 0.9), x + 0.09, F + colH + 0.4, Math.max(zc, zc + s * 0.9));
    }
    for (let i = 0; i < bays; i++) {
      const xa = x0 - 0.2 + i * bay;
      O.strand(new THREE.Vector3(xa + 0.25, F + colH - 0.08, zc + s * 0.18), new THREE.Vector3(xa + bay - 0.25, F + colH - 0.08, zc + s * 0.18), 0.4, 1);
      // marigold toran: strings hanging from the beam across each bay
      for (let t = 0.4; t < bay - 0.3; t += 0.42) {
        const len = 0.35 + 0.3 * Math.abs(Math.sin(t * 2.3 + i));
        O.strand(new THREE.Vector3(xa + t, F + colH + 0.02, zc + s * 0.24), new THREE.Vector3(xa + t, F + colH + 0.02 - len, zc + s * 0.24), 0, 0.9);
      }
    }
  }
  // short ends (north + south) of the verandah ring
  for (const s of [1, -1]) {
    const xe = s > 0 ? x1 + 0.2 : x0 - 0.2;
    B.span(K.templePlain, Math.min(xe, s * 99) - 0.2, F + colH, -z1 - VER.depth, Math.min(xe, s * 99) + 0.2, F + colH + 0.4, z1 + VER.depth);
  }

  // ---------- garbhagriha ----------
  buildSanctum(g, K, P, flames, O, F, GARBHA.half, D, GARBHA.ceil);
  // solid ceiling mass above the sanctum up to the spire base
  B.span(K.templePlain, -half + 1.3, GARBHA.ceil + 0.08, -half + 1.3, half - 1.3, F + BODY_H, half - 1.3);

  // ---------- mandapa interior: four carved pillars under the dome, a ribbed lotus ceiling ----------
  const mcol = cylUV(columnGeometry(MH - 0.25, 0.2), 0.22);
  for (const [px, pz] of [[hx - 1.7, -1.5], [hx + 1.7, -1.5], [hx - 1.7, 1.5], [hx + 1.7, 1.5]]) {
    B.place(K.templeCol, mcol, px, F, pz, 0, 1, true);
    P.solid(px - 0.28, F, pz - 0.28, px + 0.28, F + MH, pz + 0.28);
  }
  const ceilLotus = lathe([[0, 0], [2.2, 0], [2.1, -0.08], [1.7, -0.22], [1.2, -0.34], [0.7, -0.42], [0.3, -0.5], [0, -0.52]], 48, 24, 0.07);
  B.place(K.templePlain, ceilLotus, hx, F + MH - 0.25, 0);
  B.place(K.gilt, kalashGeo(0.3, 10), hx, F + MH - 0.77 - 0.3, 0, 0, [1, -1, 1]);

  // ---------- mandapa interior: bells, lamps, a shrine lingam ----------
  const bell = lathe([[0, 0.3], [0.06, 0.3], [0.1, 0.22], [0.12, 0.05], [0.16, 0], [0, 0.02]], 20);
  for (const x of [hx - 1.8, hx, hx + 1.8]) {
    B.place(K.brass, bell, x, F + MH - 1.6, 0);
    B.box(K.brass, 0.012, 1.25, 0.012, x, F + MH - 1.3, 0);
  }
  const stand = lathe([[0, 0], [0.16, 0], [0.12, 0.05], [0.03, 0.1], [0.03, 0.85], [0.14, 0.92], [0.12, 0.96], [0, 0.95]], 16);
  for (const [x, z] of [[mx0 + 0.6, -2.0], [mx1 - 0.6, -2.0], [mx0 + 0.6, 2.0]]) {
    B.place(K.brass, stand, x, F, z);
    flames.points.push(new THREE.Vector3(x, F + 1.0, z));
  }
  const ml = new THREE.PointLight(0xffb060, 1.8, 7, 1.6);
  ml.position.set(hx, F + 3.0, 0);
  g.add(ml);
  flames.lights.push(ml);

  // ---------- south shrine (under the stone spire): a lingam in a small cell, door open to the east ----------
  B.span(K.marble, sx - 2.4, F, -2.4, sx + 2.4, F + 0.02, 2.4);
  B.span(K.templePlain, sx - 2.4, GARBHA.ceil - 0.6, -2.4, sx + 2.4, F + BODY_H, 2.4);
  for (const [xa, xb, za, zb] of [[sx - 2.4, sx + 2.4, -2.4, -2.3], [sx - 2.4, sx - 2.3, -2.4, 2.4], [sx + 2.3, sx + 2.4, -2.4, 2.4]]) {
    B.span(K.temple, xa, F, za, xb, F + 0.8, zb);
  }
  B.place(K.temple, archWallGeo(1.7, 2.6, 0.12, 1.1, 1.6, 0.5, 7), sx, F, half + 0.36);
  shivling(B, K, O, sx, F, 0, { r: 0.13, pitha: 'round', pithaMat: K.goldPlain, face: Math.PI / 2, adorn: 0.8 });
  P.solid(sx - 0.7, F, -0.6, sx + 0.9, F + 0.8, 0.6);
  flames.points.push(new THREE.Vector3(sx - 0.9, F + 0.4, 1.2), new THREE.Vector3(sx + 0.9, F + 0.4, 1.2));
  B.place(K.brass, stand, sx - 0.9, F - 0.55, 1.2, 0, [1, 1, 1]);
  const sl = new THREE.PointLight(0xffa850, 1.2, 4, 1.8);
  sl.position.set(sx, F + 1.8, 1.0);
  g.add(sl);
  flames.lights.push(sl);

  // ---------- gold shikhara over the garbhagriha ----------
  const SY = F + BODY_H;
  // base/height ≈ 0.57 as in the photographs: the lowest tier of urushringas sits right on the cornice edge
  const gs = nagaraSpire(3.4, 13.4, KASHI_CLUSTER, 10);
  // the spire's gold carries baked cavity occlusion: dark recesses between the urushringas and under
  // every tier, so the carving reads through the gilding instead of one uniform bright mass
  {
    const goldAO = K.gold.clone();
    goldAO.vertexColors = true;
    const m = new THREE.Mesh(aoMass([gs.body, gs.finials], gx, SY - 0.05, 0, 0.55, 0.7), goldAO);
    m.name = 'gold';
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  const gTop = SY - 0.05 + gs.topY;
  Gd.place(K.gold, kalashGeo(1.8), gx, gTop, 0);
  const flagG = new Flag(g, K.gold, K.saffron, gx + 0.15, gTop + 1.5, 0, 3.4);
  flagG.mesh.scale.setScalar(0.75);
  const tri = new THREE.Group();
  tri.position.set(gx + 0.15, gTop + 4.9, 0);
  g.add(tri);
  for (const [x, h] of [[0, 0.55], [-0.18, 0.38], [0.18, 0.38]] as const) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 6), K.gold);
    p.position.set(x, h / 2 + 0.1, 0);
    tri.add(p);
  }
  const tb = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16, Math.PI), K.gold);
  tb.rotation.z = Math.PI;
  tb.position.y = 0.16;
  tri.add(tb);

  // ---------- gold dome over the mandapa ----------
  const DY = F + MH + 0.55;
  const drum = lathe([[0, 0], [3.15, 0], [3.15, 1.0], [3.25, 1.05], [3.25, 1.2], [3.05, 1.25], [0, 1.25]], 16);
  B.place(K.temple, drum, hx, DY, 0, Math.PI / 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    B.place(K.dark, archPlateGeo(0.45, 0.25, 0.3, 5), hx + Math.cos(a) * 3.16, DY + 0.2, Math.sin(a) * 3.16, Math.PI / 2 - a);
  }
  Gd.place(K.gold, lathe([[2.95, 0], [3.28, 0], [3.28, 0.28], [2.95, 0.3]], 32), hx, DY + 1.2, 0);
  Gd.place(K.gold, petalRing(3.1, 32, 0.65), hx, DY + 1.48, 0);
  Gd.place(K.gold, onionDome(3.2, 16), hx, DY + 1.5, 0);
  const dTop = DY + 1.5 + 3.2 * 1.42;
  const fin = nagaraSpire(0.5, 2.0, [], 3);
  Gd.place(K.gold, lathe([[0, 0], [0.7, 0], [0.55, 0.15], [0.35, 0.22], [0, 0.24]], 24, 16, 0.1), hx, dTop - 0.15, 0);
  Gd.place(K.gold, fin.body, hx, dTop + 0.05, 0);
  Gd.place(K.gold, kalashGeo(0.6), hx, dTop + 0.05 + fin.topY, 0);

  // ---------- carved stone shikhara over the south shrine ----------
  const ss = nagaraSpire(3.25, 14.2, STONE_CLUSTER, 10);
  B.place(K.spireStone, ss.body, sx, SY - 0.05, 0);
  B.place(K.spireStone, ss.finials, sx, SY - 0.05, 0);
  Gd.place(K.gold, kalashGeo(1.0), sx, SY - 0.05 + ss.topY, 0);

  // ---------- small stone shrine to the north, with its own lingam ----------
  const nx = 10.6, nz = -2.0, nh = 2.1;
  B.span(K.temple, nx - 2.6, 0, nz - 2.6, nx + 2.6, 0.5, nz + 2.6, true);
  P.floor(g, nx - 2.6, nx + 2.6, nz - 2.6, nz + 2.6, 0.5);
  for (const [a0, a1, b0, b1] of [[-nh, nh, -nh, -nh + 0.4], [-nh, -nh + 0.4, -nh, nh], [nh - 0.4, nh, -nh, nh], [-nh, -0.55, nh - 0.4, nh], [0.55, nh, nh - 0.4, nh]]) {
    B.span(K.shrineStone, nx + a0, 0.5, nz + b0, nx + a1, 4.0, nz + b1, true);
  }
  B.span(K.shrineStone, nx - 0.55, 2.5, nz + nh - 0.4, nx + 0.55, 4.0, nz + nh);
  B.span(K.shrineStone, nx - nh, 3.7, nz - nh, nx + nh, 4.0, nz + nh);
  B.span(K.shrineStone, nx - 2.35, 4.0, nz - 2.35, nx + 2.35, 4.35, nz + 2.35);
  const ns = nagaraSpire(2.05, 6.2, SHRINE_CLUSTER, 5);
  B.place(K.spireStone, ns.body, nx, 4.35, nz);
  B.place(K.spireStone, ns.finials, nx, 4.35, nz);
  Gd.place(K.gold, kalashGeo(0.6), nx, 4.35 + ns.topY, nz);
  shivling(B, K, O, nx, 0.5, nz - 0.3, { r: 0.1, pitha: 'square', face: Math.PI / 2, adorn: 0.7 });
  flames.points.push(new THREE.Vector3(nx - 0.6, 0.62, nz + 0.6));
  O.strand(new THREE.Vector3(nx - 0.6, 2.4, nz + nh + 0.05), new THREE.Vector3(nx + 0.6, 2.4, nz + nh + 0.05), 0.3);

  // diyas along the jagati edge
  for (let i = 0; i <= 44; i++) {
    const x = jx0 + 0.3 + (i / 44) * (jx1 - jx0 - 0.6);
    flames.points.push(new THREE.Vector3(x, F + 0.05, jz1 - 0.2));
  }

  B.flush(g);
  Gd.flush(g);
  return { group: g, flag: flagG, spireTop: gTop };
}

import * as THREE from 'three';
import { Flag, type Flames, type Physics } from '../../engine/kit';
import type { TM } from './mats';
import { Merger } from './merge';
import { archWallGeo, archFrameGeo, lathe, kalashGeo, crownGeo, knobGeo, plate, clean } from './forms';
import { nandiMesh } from './nandi';
import type { Offerings } from './offerings';
import { buildTown } from './town';

/**
 * The walled precinct (ASI: a stone-paved courtyard 80.77 × 66.45 m inside a rampart with four
 * entrances, a separate carved stone Nandi pavilion and a dipmala), and the street outside the
 * east gate:
 *  - Mahadwar (east gate): two-storey basalt gatehouse with a cusped arch, the "आद्य ज्योतिर्लिंग
 *    श्री त्र्यंबकेश्वर मंदिर" board and a tiled roof; the north gate a smaller gatehouse;
 *  - the Nandi mandapa on the axis in front of the east porch, Nandi facing the sanctum;
 *  - the big painted trishul with its damaru beside the east steps (2020s), a basalt dipmala;
 *  - Amrut Kund (Amritavarshini), a stepped tank in the south-west of the precinct;
 *  - the covered darshan queue on the north side; neem and mango trees; Trimbak's houses outside.
 */

export const COURT = { x0: -33.2, x1: 33.2, z0: -30, z1: 50.8 };
export const NANDI = { z: 24.5, half: 2.5 };
export const KUND = { x0: -30.5, x1: -19.5, z0: -27, z1: -16 };
const WALL_H = 5.0, WALL_T = 1.2;

export const PRECINCT_TREES: [number, number, number][] = [
  [-24, 34, 9], [-27, 8, 8], [26, -20, 10], [24, 41, 8],
];

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8572a';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#f6e7c8';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 1004, 236);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 64px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.fillText('आद्य ज्योतिर्लिंग', 512, 74);
  g.font = '800 92px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.fillText('श्री त्र्यंबकेश्वर मंदिर', 512, 172);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

/** a gatehouse spanning the wall; `n` = outward normal axis; returns nothing (merged) */
function gatehouse(B: Merger, K: TM, P: Physics, cx: number, cz: number, along: 'x' | 'z', W: number, Dp: number, H: number, ow: number, oh: number) {
  // local: u along the wall, v across (outward +)
  const S = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, mat: THREE.Material, solid = false) => {
    if (along === 'x') B.span(mat, cx + u0, y0, cz + v0, cx + u1, y1, cz + v1, solid);
    else B.span(mat, cx + v0, y0, cz + u0, cx + v1, y1, cz + u1, solid);
  };
  const ry = along === 'x' ? 0 : Math.PI / 2;
  // two massive piers and the upper storey
  S(-W / 2, -ow / 2, -Dp / 2, Dp / 2, 0, H * 0.62, K.rampart, true);
  S(ow / 2, W / 2, -Dp / 2, Dp / 2, 0, H * 0.62, K.rampart, true);
  // arched faces on both sides
  for (const s of [-1, 1]) {
    const geo = archWallGeo(W, H * 0.62, 0.5, ow, 0, oh - ow * 0.45, ow * 0.45, 9);
    const [px, pz] = along === 'x' ? [cx, cz + s * (Dp / 2 + 0.25)] : [cx + s * (Dp / 2 + 0.25), cz];
    B.place(K.basalt, geo, px, 0, pz, ry);
    const fr = archFrameGeo(ow, oh - ow * 0.45, ow * 0.45, 0.3, 0.14, 9);
    const [qx, qz] = along === 'x' ? [cx, cz + s * (Dp / 2 + 0.52)] : [cx + s * (Dp / 2 + 0.52), cz];
    B.place(K.basalt, fr, qx, 0, qz, ry);
    // carved panel with roundels over the arch
    S(-ow / 2 - 0.6, ow / 2 + 0.6, s > 0 ? Dp / 2 + 0.5 : -Dp / 2 - 0.62, s > 0 ? Dp / 2 + 0.62 : -Dp / 2 - 0.5, oh + 0.2, H * 0.6, K.friezeGate);
  }
  S(-ow / 2, ow / 2, -Dp / 2, Dp / 2, oh, H * 0.62, K.rampart); // vault mass
  // upper storey (nagarkhana, c014/c079): plain ashlar with a row of small arched windows, a dark carved
  // timber jharokha band on brackets between the storeys, and a low corrugated-tin gable roof
  const y1 = H * 0.62;
  S(-W / 2 - 0.2, W / 2 + 0.2, -Dp / 2 - 0.35, Dp / 2 + 0.35, y1, y1 + 0.3, K.basalt);
  for (const s of [-1, 1]) {
    const [px, pz] = along === 'x' ? [cx, cz + s * (Dp / 2 - 0.25)] : [cx + s * (Dp / 2 - 0.25), cz];
    B.place(K.rampart, archWallGeo(W, H - y1 - 0.3, 0.5, 0.01, 0, 0.01, 0.01, 0), px, y1 + 0.3, pz, ry);
    const nWin = Math.max(2, Math.floor(W / 2.6));
    for (let k = 0; k < nWin; k++) {
      const u = -W / 2 + (k + 0.5) * (W / nWin);
      if (Math.abs(u) < 2.2) continue; // the sign hangs over the middle
      const g2 = archWallGeo(1.3, 1.5, 0.16, 0.7, 0, 0.75, 0.38, 5);
      const [ax, az] = along === 'x' ? [cx + u, cz + s * (Dp / 2 + 0.03)] : [cx + s * (Dp / 2 + 0.03), cz + u];
      B.place(K.basalt, g2, ax, y1 + 1.2, az, ry);
      const [dx, dz] = along === 'x' ? [cx + u, cz + s * (Dp / 2 - 0.0)] : [cx + s * (Dp / 2 - 0.0), cz + u];
      B.box(K.dark, along === 'x' ? 0.7 : 0.1, 1.13, along === 'x' ? 0.1 : 0.7, dx, y1 + 1.2, dz);
    }
    // timber jharokha band with a carved fascia, a row of brackets under it
    const v0 = s > 0 ? Dp / 2 : -Dp / 2 - 0.55, v1 = s > 0 ? Dp / 2 + 0.55 : -Dp / 2;
    S(-W / 2 + 0.3, W / 2 - 0.3, v0, v1, y1 + 0.3, y1 + 0.42, K.wood);
    S(-W / 2 + 0.3, W / 2 - 0.3, s > 0 ? Dp / 2 + 0.45 : -Dp / 2 - 0.55, s > 0 ? Dp / 2 + 0.55 : -Dp / 2 - 0.45, y1 + 0.42, y1 + 1.05, K.wood);
    for (let u = -W / 2 + 0.6; u < W / 2 - 0.4; u += 0.32) {
      const [bx, bz] = along === 'x' ? [cx + u, cz + s * (Dp / 2 + 0.47)] : [cx + s * (Dp / 2 + 0.47), cz + u];
      B.box(K.dark, along === 'x' ? 0.14 : 0.05, 0.5, along === 'x' ? 0.05 : 0.14, bx, y1 + 0.5, bz);
    }
    for (let u = -W / 2 + 0.6; u < W / 2 - 0.4; u += 0.9) {
      const [bx, bz] = along === 'x' ? [cx + u, cz + s * (Dp / 2 + 0.25)] : [cx + s * (Dp / 2 + 0.25), cz + u];
      B.box(K.wood, along === 'x' ? 0.1 : 0.5, 0.35, along === 'x' ? 0.5 : 0.1, bx, y1 - 0.05, bz);
    }
  }
  for (const u of [-W / 2, W / 2 - 0.45]) S(u, u + 0.45, -Dp / 2, Dp / 2, y1 + 0.3, H, K.rampart);
  S(-W / 2 - 0.1, W / 2 + 0.1, -Dp / 2 - 0.1, Dp / 2 + 0.1, H - 0.2, H, K.basalt);
  // low gable of corrugated tin over timber purlins, ridge along the wall
  {
    const L = W / 2 + 0.9, hd = Dp / 2 + 1.1, rise = 1.3;
    const pos: number[] = [];
    const P3 = (u: number, y: number, v: number) => (along === 'x' ? [cx + u, y, cz + v] : [cx + v, y, cz + u]);
    for (const sv of [-1, 1]) {
      const a = P3(-L, H, sv * hd), b = P3(L, H, sv * hd), c = P3(L, H + rise, 0), d = P3(-L, H + rise, 0);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);
    }
    // gable ends (stone)
    const gpos: number[] = [];
    for (const su of [-1, 1]) {
      const a = P3(su * (W / 2), H, -Dp / 2), b = P3(su * (W / 2), H, Dp / 2), c = P3(su * (W / 2), H + rise * (Dp / 2) / hd, 0);
      gpos.push(...a, ...b, ...c, ...a, ...c, ...b);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.computeVertexNormals();
    B.add(K.tin, rg);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    gg.computeVertexNormals();
    B.add(K.rampart, gg);
  }
  // flat ceiling at the arch spring and a dark recess for the doors
  S(-ow / 2, ow / 2, -Dp / 2, Dp / 2, oh - 0.05, oh + 0.2, K.basalt);
}

export function buildPrecinct(root: THREE.Group, K: TM, P: Physics, flames: Flames, O: Offerings) {
  const g = new THREE.Group();
  g.name = 'precinct';
  root.add(g);
  const B = new Merger(P, 'precinct');
  const { x0, x1, z0, z1 } = COURT;
  const flags: Flag[] = [];

  // ---------- courtyard paving ----------
  const pave = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), K.paving);
  // UVs in metres
  const uv = pave.geometry.attributes.uv as THREE.BufferAttribute;
  const pp = pave.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i), pp.getZ(i));
  pave.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  pave.receiveShadow = true;
  g.add(pave);
  P.floors.push(pave);

  // ---------- rampart wall with its coping ----------
  const NG = { z: 8, w: 4.0 }; // north gate
  const EG = { w: 4.4 };
  const wall = (a0: number, a1: number, b0: number, b1: number) => {
    B.span(K.rampart, a0, 0, b0, a1, WALL_H, b1, true);
    B.span(K.basalt, a0 - 0.1, WALL_H, b0 - 0.1, a1 + 0.1, WALL_H + 0.25, b1 + 0.1);
    B.span(K.basalt, a0 - 0.08, 0, b0 - 0.08, a1 + 0.08, 0.5, b1 + 0.08);
  };
  wall(x0 - WALL_T, x1 + WALL_T, z0 - WALL_T, z0); // west
  wall(x0 - WALL_T, x0, z0, z1); // south
  wall(x1, x1 + WALL_T, z0, NG.z - 5); // north, either side of the gate
  wall(x1, x1 + WALL_T, NG.z + 5, z1);
  wall(x0 - WALL_T, -7.5, z1, z1 + WALL_T); // east, either side of the Mahadwar
  wall(7.5, x1 + WALL_T, z1, z1 + WALL_T);
  // crenellated parapet (kanguras) on the wall top
  const kang = lathe([[0, 0], [0.3, 0], [0.3, 0.35], [0.18, 0.55], [0, 0.62]], 4);
  const kpts: [number, number][] = [];
  for (let z = z0; z <= z1; z += 1.6) { kpts.push([x0 - WALL_T / 2, z]); if (z < NG.z - 5 || z > NG.z + 5) kpts.push([x1 + WALL_T / 2, z]); }
  for (let x = x0; x <= x1; x += 1.6) { kpts.push([x, z0 - WALL_T / 2]); if (Math.abs(x) > 7.6) kpts.push([x, z1 + WALL_T / 2]); }
  for (const [x, z] of kpts) B.place(K.basalt, kang, x, WALL_H + 0.25, z, Math.PI / 4);

  // ---------- Mahadwar (east) and the north gate ----------
  const MH = 11;
  gatehouse(B, K, P, 0, z1 + WALL_T / 2, 'x', 24, 8, MH, EG.w, 5.6);
  gatehouse(B, K, P, x1 + WALL_T / 2, NG.z, 'z', 10, 6, 9, 3.4, 4.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), signTexture());
  sign.position.set(0, MH * 0.62 + 2.1, z1 + WALL_T / 2 + 4.0 + 0.04);
  g.add(sign);
  const sign2 = sign.clone();
  sign2.rotation.y = Math.PI;
  sign2.position.z = z1 + WALL_T / 2 - 4.0 - 0.04;
  g.add(sign2);
  // the small painted gopuram shrine on the south side of the Mahadwar's front (c014, c098)
  {
    const sx = -8.6, sz = z1 + WALL_T / 2 + 4.0 + 1.6;
    const pink = new THREE.MeshStandardMaterial({ color: 0xe48aa0, roughness: 0.6 });
    const cols = [0x3cb7c8, 0xf0c63c, 0xd8452c, 0x6cc070, 0xf09a3c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    B.span(K.basalt, sx - 1.5, 0, sz - 1.5, sx + 1.5, 0.5, sz + 1.5, true);
    B.span(pink, sx - 1.2, 0.5, sz - 1.2, sx + 1.2, 3.2, sz + 1.2);
    B.span(K.dark, sx - 0.5, 0.5, sz + 1.19, sx + 0.5, 2.3, sz + 1.25);
    B.span(new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6 }), sx - 1.35, 3.2, sz - 1.35, sx + 1.35, 3.45, sz + 1.35);
    let y = 3.45;
    for (let k = 0; k < 5; k++) {
      const hw = 1.15 - k * 0.2, hh = 0.55;
      B.span(cols[k], sx - hw, y, sz - hw * 0.8, sx + hw, y + hh * 0.75, sz + hw * 0.8);
      B.span(pink, sx - hw - 0.06, y + hh * 0.75, sz - hw * 0.8 - 0.06, sx + hw + 0.06, y + hh, sz + hw * 0.8 + 0.06);
      // little painted figures/pilasters round the tier
      for (let u = -hw + 0.15; u <= hw - 0.1; u += 0.3) B.box(cols[(k + 2) % 5], 0.12, hh * 0.6, 0.06, sx + u, y + 0.04, sz + hw * 0.8 + 0.02);
      y += hh;
    }
    B.place(new THREE.MeshStandardMaterial({ color: 0xe8b84a, roughness: 0.4, metalness: 0.5 }), lathe([[0, 0], [0.5, 0], [0.42, 0.25], [0.2, 0.45], [0.06, 0.7], [0, 0.75]], 16), sx, y, sz, 0, [1, 1, 0.75]);
  }
  // passage floors
  P.floor(g, -EG.w / 2, EG.w / 2, z1 - 4.5, z1 + 5, 0);
  P.floor(g, x1 - 3.5, x1 + 4.5, NG.z - 1.7, NG.z + 1.7, 0);
  // the north gate's outer doors stand closed
  B.span(K.wood, x1 + 3.4, 0, NG.z - 1.75, x1 + 3.6, 4.4, NG.z + 1.75, true);

  // ---------- Nandi mandapa (photographed 2005–2024: a tall closed pavilion, latticed doors, deep eave) ----------
  {
    const cz = NANDI.z, hw = NANDI.half, F2 = 1.0, WT = F2 + 4.7;
    for (const [y0, y1, o] of [[0, 0.3, 0.42], [0.3, 0.55, 0.26], [0.55, 0.8, 0.34], [0.8, F2, 0.18]] as const) B.span(K.basalt, -hw - o, y0, cz - hw - o, hw + o, y1, cz + hw + o);
    P.solid(-hw - 0.42, 0, cz - hw - 0.42, hw + 0.42, F2, cz + hw + 0.42);
    // walls: a doorway on the west (towards the sanctum), blind cusped arches with lattice on the other faces
    const t = 0.45, dw = 0.9, dh = F2 + 2.8;
    B.span(K.wall, -hw, F2, cz + hw - t, hw, WT, cz + hw, true); // east
    B.span(K.wall, -hw, F2, cz - hw, -hw + t, WT, cz + hw, true); // south
    B.span(K.wall, hw - t, F2, cz - hw, hw, WT, cz + hw, true); // north
    B.span(K.wall, -hw, F2, cz - hw, -dw, WT, cz - hw + t, true); // west, beside the door
    B.span(K.wall, dw, F2, cz - hw, hw, WT, cz - hw + t, true);
    B.span(K.wall, -dw, dh, cz - hw, dw, WT, cz - hw + t);
    for (const [nx, nz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
      const fx = nx * (hw + 0.04), fz = cz + nz * (hw + 0.04);
      B.place(K.basalt, archFrameGeo(2.3, 2.3, 1.15, 0.24, 0.1, 9), fx, F2 + 0.15, fz, ry);
      // corner pilasters
      for (const s of [-1, 1]) {
        const px = nx ? fx : s * (hw - 0.18), pz = nz ? fz : cz + s * (hw - 0.18);
        B.box(K.basalt, nx ? 0.12 : 0.36, WT - F2, nx ? 0.36 : 0.12, px, F2, pz);
      }
      if (nz === -1) continue; // the doorway
      // lattice: a dark recess with a stone grid, in two leaves
      B.box(K.dark, nx ? 0.05 : 2.0, 2.4, nx ? 2.0 : 0.05, fx - nx * 0.02, F2 + 0.15, fz - nz * 0.02);
      for (let k = -4; k <= 4; k++) {
        B.box(K.basalt, nx ? 0.07 : 0.04, 2.4, nx ? 0.04 : 0.07, fx + (nx ? 0 : k * 0.23), F2 + 0.15, fz + (nx ? k * 0.23 : 0));
      }
      for (let k = 0; k <= 10; k++) B.box(K.basalt, nx ? 0.07 : 2.0, 0.04, nx ? 2.0 : 0.07, fx, F2 + 0.15 + k * 0.235, fz);
      B.box(K.basalt, nx ? 0.1 : 2.1, 0.16, nx ? 2.1 : 0.1, fx, F2 + 1.3, fz);
    }
    // the doorway's frame
    for (const s of [-1, 1]) B.box(K.basalt, 0.16, dh - F2, 0.12, s * (dw + 0.08), F2, cz - hw - 0.06);
    B.box(K.basalt, dw * 2 + 0.32, 0.18, 0.12, 0, dh, cz - hw - 0.06);
    // eave, frieze, coping
    const B2 = B;
    for (const [ax, az, bx, bz, nx, nz] of [[-hw, cz + hw, hw, cz + hw, 0, 1], [-hw, cz - hw, hw, cz - hw, 0, -1], [hw, cz - hw, hw, cz + hw, 1, 0], [-hw, cz - hw, -hw, cz + hw, -1, 0]] as const) {
      const pos: number[] = [];
      const e = 0.75, out = 0.85, drop = 0.4, y = WT + 0.1;
      const tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz), ux = tx / L, uz = tz / L;
      const A = [ax - ux * e, y, az - uz * e], Bv = [bx + ux * e, y, bz + uz * e];
      const C = [bx + ux * e + nx * out, y - drop, bz + uz * e + nz * out], D = [ax - ux * e + nx * out, y - drop, az - uz * e + nz * out];
      pos.push(...A, ...D, ...C, ...A, ...C, ...Bv, ...A, ...C, ...D, ...A, ...Bv, ...C);
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      eg.computeVertexNormals();
      B2.add(K.basalt, eg);
    }
    B.span(K.basalt, -hw - 0.12, WT - 0.1, cz - hw - 0.12, hw + 0.12, WT + 0.15, cz + hw + 0.12);
    B.span(K.friezePorch, -hw - 0.04, WT + 0.15, cz - hw - 0.04, hw + 0.04, WT + 1.0, cz + hw + 0.04);
    B.span(K.basalt, -hw - 0.18, WT + 1.0, cz - hw - 0.18, hw + 0.18, WT + 1.2, cz + hw + 0.18);
    // phamsana: receding tiers, each a slab with a course of knobs, under a lime crown
    let y = WT + 1.2;
    const knobs: THREE.Matrix4[] = [];
    for (let i = 0; i < 7; i++) {
      const sz = hw * (1.0 - i * 0.12);
      B.span(K.basalt, -sz, y, cz - sz, sz, y + 0.2, cz + sz);
      B.span(K.basalt, -sz * 0.93, y + 0.2, cz - sz * 0.93, sz * 0.93, y + 0.38, cz + sz * 0.93);
      const n = Math.max(3, Math.round(sz * 3));
      for (let k = 0; k < n; k++) {
        const u = -sz * 0.88 + (k / (n - 1)) * sz * 1.76;
        for (const [px, pz] of [[u, sz * 0.97], [u, -sz * 0.97], [sz * 0.97, u], [-sz * 0.97, u]]) {
          knobs.push(new THREE.Matrix4().compose(new THREE.Vector3(px, y + 0.2, cz + pz), new THREE.Quaternion(), new THREE.Vector3(0.13, 0.19, 0.13)));
        }
      }
      y += 0.38;
    }
    const c = crownGeo(0.7);
    B.place(K.lime, c.geo, 0, y, cz);
    B.place(K.gold, kalashGeo(0.7), 0, y + c.top, cz);
    const ki = new THREE.InstancedMesh(knobGeo(), K.basalt, knobs.length);
    knobs.forEach((m, i) => ki.setMatrixAt(i, m));
    ki.castShadow = ki.receiveShadow = true;
    g.add(ki);
    B.span(K.basalt, -hw + t, WT - 0.3, cz - hw + t, hw - t, WT, cz + hw - t);
    // Nandi on a pedestal, facing the sanctum (west, −z), seen through the open door
    B.span(K.basalt, -0.75, F2, cz - 1.3, 0.75, F2 + 0.3, cz + 1.2);
    const nandi = nandiMesh(K.nandi);
    nandi.position.set(0, F2 + 0.3, cz + 0.05);
    nandi.scale.setScalar(0.88);
    g.add(nandi);
    O.strand(new THREE.Vector3(-0.28, F2 + 1.22, cz - 0.55), new THREE.Vector3(0.28, F2 + 1.22, cz - 0.55), 0.2, 1.1);
    O.scatter(-0.6, 0.6, cz - 1.3, cz - 1.0, F2 + 0.3, 12, 0.3);
    flames.points.push(new THREE.Vector3(0.45, F2 + 0.37, cz - 1.2));
    const nl = new THREE.PointLight(0xffb060, 1.6, 5, 1.6);
    nl.position.set(0, F2 + 2.2, cz - 0.8);
    g.add(nl);
    flames.lights.push(nl);
  }

  // ---------- the painted trishul (c113, c084): white-painted blades rimmed in gold — a leaf-shaped centre
  // spear and two side prongs that sweep out and curl up like crescents — over a blue medallion, painted
  // balls, a gold-and-red damaru and a white pole banded red and patterned blue ----------
  {
    const tx = -5.6, tz = 20.5, poleH = 6.6;
    B.span(K.basalt, tx - 0.6, 0, tz - 0.6, tx + 0.6, 0.6, tz + 0.6, true);
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, metalness: 0.1 });
    const gilt = new THREE.MeshStandardMaterial({ color: 0xe0a83a, roughness: 0.3, metalness: 0.85 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.4 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a5aa8, roughness: 0.35 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1f8a5a, roughness: 0.35 });
    const tri = new THREE.Group();
    tri.position.set(tx, 0.6, tz);
    tri.rotation.y = Math.PI / 2; // the blades face east, to the gate
    g.add(tri);
    const TM2 = new Merger(P, 'trishul');
    const put = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { TM2.place(mat, geo, 0, y, 0); };
    // pole: white with red bands
    put(new THREE.CylinderGeometry(0.11, 0.13, poleH, 20), white, poleH / 2);
    for (let k = 0; k < 5; k++) put(new THREE.CylinderGeometry(0.135, 0.135, 0.18, 20), k % 2 ? blue : red, 0.5 + k * 1.25);
    let y = poleH;
    put(new THREE.CylinderGeometry(0.06, 0.14, 0.5, 16), gilt, y + 0.25); // flared socket
    y += 0.5;
    // damaru: two drums tied at the waist
    const dam = lathe([[0, -0.24], [0.26, -0.24], [0.25, -0.2], [0.06, 0], [0.25, 0.2], [0.26, 0.24], [0, 0.24]], 24);
    dam.rotateZ(Math.PI / 2);
    put(dam, gilt, y + 0.2);
    put(new THREE.TorusGeometry(0.25, 0.025, 8, 24).rotateY(Math.PI / 2).translate(0.2, 0, 0), red, y + 0.2);
    put(new THREE.TorusGeometry(0.25, 0.025, 8, 24).rotateY(Math.PI / 2).translate(-0.2, 0, 0), red, y + 0.2);
    y += 0.45;
    put(new THREE.SphereGeometry(0.2, 20, 14), red, y + 0.18);
    put(new THREE.TorusGeometry(0.2, 0.02, 6, 24).rotateX(Math.PI / 2), gilt, y + 0.18);
    y += 0.38;
    put(new THREE.SphereGeometry(0.16, 20, 14).scale(1, 0.8, 1), green, y + 0.12);
    y += 0.26;
    // the medallion
    put(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 32).rotateX(Math.PI / 2), blue, y + 0.28);
    put(new THREE.TorusGeometry(0.3, 0.035, 8, 32), gilt, y + 0.28);
    const hub = y + 0.28;
    // blades: extruded shapes with a gold rim behind
    const blade = (sh: THREE.Shape, x: number, yy: number, sx = 1) => {
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 16 });
      geo.translate(0, 0, -0.035);
      TM2.add(white, geo, new THREE.Matrix4().compose(new THREE.Vector3(x, yy, 0), new THREE.Quaternion(), new THREE.Vector3(sx, 1, 1)));
      TM2.add(gilt, geo, new THREE.Matrix4().compose(new THREE.Vector3(x, yy, 0), new THREE.Quaternion(), new THREE.Vector3(sx * 1.06, 1.04, 0.6)));
    };
    const spear = new THREE.Shape();
    spear.moveTo(-0.12, 0); spear.quadraticCurveTo(-0.24, 0.5, -0.16, 0.85); spear.lineTo(0, 1.3); spear.lineTo(0.16, 0.85);
    spear.quadraticCurveTo(0.24, 0.5, 0.12, 0); spear.lineTo(-0.12, 0);
    blade(spear, 0, hub + 0.22);
    // side prong: sweeps out from the hub and curls up into a crescent tip
    const prong = new THREE.Shape();
    prong.moveTo(0, 0.05);
    prong.quadraticCurveTo(0.55, -0.25, 0.85, 0.25);
    prong.quadraticCurveTo(1.0, 0.6, 0.78, 0.95);
    prong.quadraticCurveTo(0.84, 0.55, 0.62, 0.3);
    prong.quadraticCurveTo(0.42, 0.1, 0.05, 0.22);
    prong.lineTo(0, 0.05);
    blade(prong, 0.18, hub - 0.1, 1);
    blade(prong, -0.18, hub - 0.1, -1);
    // little gold rings hanging from the prongs
    for (const sx of [-1, 1]) put(new THREE.TorusGeometry(0.07, 0.015, 6, 16).translate(sx * 0.62, 0, 0), gilt, hub - 0.38);
    TM2.flush(tri);
  }

  // ---------- dipmala (ASI): a basalt lamp pillar on a moulded square plinth, its shaft studded with lamp
  // brackets in a rising spiral, a lotus capital and a finial ----------
  {
    const dx = 22, dz = -22;
    for (const [y0, y1, hw] of [[0, 0.35, 1.25], [0.35, 0.6, 1.1], [0.6, 0.85, 0.95], [0.85, 1.05, 0.85]] as const) B.span(K.basalt, dx - hw, y0, dz - hw, dx + hw, y1, dz + hw);
    const prof: [number, number][] = [[0, 1.05], [0.62, 1.05], [0.62, 1.2], [0.52, 1.35], [0.56, 1.5], [0.46, 1.6], [0.44, 7.0], [0.55, 7.1], [0.6, 7.3], [0.5, 7.45],
      [0.62, 7.6], [0.4, 7.75], [0.22, 7.9], [0.28, 8.05], [0.12, 8.3], [0, 8.4]];
    B.place(K.basalt, lathe(prof, 20, 20, 0.04), dx, 0, dz);
    const arms: THREE.Matrix4[] = [];
    const cup = lathe([[0, 0], [0.06, 0], [0.09, 0.05], [0.1, 0.08], [0.04, 0.08], [0, 0.06]], 8);
    const cups: THREE.Matrix4[] = [];
    for (let i = 0; i < 64; i++) {
      const a = i * 0.785 + Math.floor(i / 8) * 0.39, y = 1.8 + (i / 64) * 5.0;
      const r = 0.46 - (y - 1.6) * 0.004;
      arms.push(new THREE.Matrix4().compose(new THREE.Vector3(dx + Math.cos(a) * r, y, dz + Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(1, 1, 1)));
      cups.push(new THREE.Matrix4().makeTranslation(dx + Math.cos(a) * (r + 0.3), y + 0.04, dz + Math.sin(a) * (r + 0.3)));
    }
    const am = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.08, 0.12).translate(0.17, 0.04, 0), K.basalt, arms.length);
    arms.forEach((m, i) => am.setMatrixAt(i, m));
    am.castShadow = true;
    g.add(am);
    const cm = new THREE.InstancedMesh(cup, K.basalt, cups.length);
    cups.forEach((m, i) => cm.setMatrixAt(i, m));
    g.add(cm);
    P.solid(dx - 1.25, 0, dz - 1.25, dx + 1.25, 8, dz + 1.25);
  }

  // ---------- Amrut Kund: stepped tank in the south-west ----------
  {
    const { x0: a0, x1: a1, z0: b0, z1: b1 } = KUND;
    const depth = 3.2, n = 8, st = 0.4;
    for (let i = 0; i < n; i++) {
      const o = i * st, y = -i * (depth / n);
      // each course: a ring of four slabs stepping down and in
      for (const [p0, p1, q0, q1] of [[a0 + o, a1 - o, b0 + o, b0 + o + st], [a0 + o, a1 - o, b1 - o - st, b1 - o], [a0 + o, a0 + o + st, b0 + o, b1 - o], [a1 - o - st, a1 - o, b0 + o, b1 - o]]) {
        B.span(K.basalt, p0, y - depth / n - 0.4, q0, p1, y - depth / n, q1);
      }
    }
    const wy = -depth + 0.9;
    const wm = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88 });
    const wo = Math.ceil(-wy / (depth / n)) * st - 0.05;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(a1 - a0 - 2 * wo, b1 - b0 - 2 * wo).rotateX(-Math.PI / 2), wm);
    water.position.set((a0 + a1) / 2, wy, (b0 + b1) / 2);
    g.add(water);
    // low parapet with an opening on the east for the steps
    for (const [p0, p1, q0, q1] of [[a0 - 0.4, a1 + 0.4, b0 - 0.4, b0], [a0 - 0.4, a0, b0, b1 + 0.4], [a1, a1 + 0.4, b0, b1 + 0.4], [a0, (a0 + a1) / 2 - 1, b1, b1 + 0.4], [(a0 + a1) / 2 + 1, a1, b1, b1 + 0.4]]) {
      B.span(K.basalt, p0, 0, q0, p1, 0.85, q1, true);
    }
    // the paving plane must not cover the tank: punch it with a dark rim instead (tank floor below)
    pave.geometry = new THREE.ShapeGeometry((() => {
      const s = new THREE.Shape();
      s.moveTo(x0, -z0); s.lineTo(x1, -z0); s.lineTo(x1, -z1); s.lineTo(x0, -z1); s.lineTo(x0, -z0);
      const h = new THREE.Path();
      h.moveTo(a0, -b0); h.lineTo(a0, -b1); h.lineTo(a1, -b1); h.lineTo(a1, -b0); h.lineTo(a0, -b0);
      s.holes.push(h);
      return s;
    })()).rotateX(-Math.PI / 2);
    const u2 = pave.geometry.attributes.uv as THREE.BufferAttribute, p2 = pave.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < u2.count; i++) u2.setXY(i, p2.getX(i), p2.getZ(i));
    pave.position.set(0, 0, 0);
    // stepped walk-down ramp on the east side (z = b1) into the tank, walkable
    for (let i = 0; i < 5; i++) {
      B.span(K.basalt, (a0 + a1) / 2 - 1, -i * 0.3 - 0.3, b1 - 0.5 - i * 0.45, (a0 + a1) / 2 + 1, -i * 0.3, b1 - i * 0.45);
    }
    P.floor(g, (a0 + a1) / 2 - 1, (a0 + a1) / 2 + 1, b1, b1 - 2.5, 0, -1.5);
    P.solid(a0, -5, b0, a1, 0, b1 - 2.5);
    P.solid(a0, -5, b1 - 2.5, (a0 + a1) / 2 - 1, 0, b1);
    P.solid((a0 + a1) / 2 + 1, -5, b1 - 2.5, a1, 0, b1);
  }

  // ---------- darshan queue: a long steel shed along the north side ----------
  {
    const qx0 = 15.5, qx1 = 19.5, qz0 = 0, qz1 = 32;
    for (let z = qz0; z <= qz1; z += 4) {
      for (const x of [qx0, qx1]) B.box(K.steel, 0.1, x === qx0 ? 3.0 : 3.4, 0.1, x, 0, z);
    }
    const roof = new THREE.BufferGeometry();
    const yA = 3.0, yB = 3.4;
    roof.setAttribute('position', new THREE.Float32BufferAttribute([
      qx0 - 0.4, yA, qz0, qx1 + 0.4, yB, qz0, qx1 + 0.4, yB, qz1, qx0 - 0.4, yA, qz0, qx1 + 0.4, yB, qz1, qx0 - 0.4, yA, qz1,
    ], 3));
    roof.computeVertexNormals();
    B.add(K.sheet, roof);
    // the covered link to the north porch steps
    B.box(K.steel, 0.1, 3.4, 0.1, 13.4, 0, 1.6);
    B.box(K.steel, 0.1, 3.4, 0.1, 13.4, 0, 5.4);
    const link = new THREE.BufferGeometry();
    link.setAttribute('position', new THREE.Float32BufferAttribute([
      13.0, 3.5, 1.2, qx0, 3.5, 1.2, qx0, 3.5, 5.8, 13.0, 3.5, 1.2, qx0, 3.5, 5.8, 13.0, 3.5, 5.8,
    ], 3));
    link.computeVertexNormals();
    B.add(K.sheet, link);
    // railings: two runs inside the shed, people queue between them
    for (const x of [qx0 + 0.1, qx1 - 0.1, (qx0 + qx1) / 2]) {
      B.box(K.steel, 0.05, 0.05, qz1 - qz0, x, 1.0, (qz0 + qz1) / 2);
      B.box(K.steel, 0.05, 0.05, qz1 - qz0, x, 0.5, (qz0 + qz1) / 2);
      for (let z = qz0; z <= qz1; z += 2) B.box(K.steel, 0.05, 1.05, 0.05, x, 0, z);
    }
    P.solid(qx0 - 0.05, 0, qz0, qx0 + 0.15, 1.1, qz1);
    P.solid(qx1 - 0.15, 0, qz0, qx1 + 0.05, 1.1, qz1);
  }

  // ---------- small shrines with lingas and benches in the courtyard (lamp niches in the wall) ----------
  for (let z = z0 + 6; z < z1 - 6; z += 8) {
    if (z > -32 && z < -13) continue;
    flames.points.push(new THREE.Vector3(x0 + 0.1, 1.2, z));
    B.box(K.dark, 0.08, 0.5, 0.4, x0 + 0.02, 0.95, z);
  }
  void plate;

  // ---------- outside: the street to the east, lined with houses ----------
  const street = new THREE.Mesh(new THREE.PlaneGeometry(18, 150).rotateX(-Math.PI / 2), K.paving);
  const su = street.geometry.attributes.uv as THREE.BufferAttribute, sp = street.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < su.count; i++) su.setXY(i, sp.getX(i) * 0.7, sp.getZ(i) * 0.7);
  street.position.set(0, -0.02, z1 + 75);
  street.receiveShadow = true;
  g.add(street);
  P.floors.push(street);
  P.solid(-10, 0, z1 + 149, 10, 4, z1 + 150);

  const town = buildTown(root, K, P, O, z1);
  B.flush(g);
  return { flags, town };
}

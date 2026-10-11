import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { Batch, rng } from './batch';
import type { RM } from './mats';
import { gopuram, palette, vimana, Emit } from './gopuram';
import { ARM, OUTER, RING, RAJA, TANK } from './layout';
import { nandiMesh } from './nandi';

/**
 * The outer (third) prakara: the high granite enclosure wall with red-and-white kavi stripes along
 * its foot, the four gopurams — the nine-tiered Rajagopuram (east), the five-tiered west gopuram and
 * the 2016 north and south gopurams — the stone entrance portico on East Car Street with its parapet
 * sculpture (Shiva and Parvati on Nandi between kirtimukha arches, Nandis at the corners),
 * the paved courts, the Sethu Madhava tank and the old stone shrines of the west court.
 */

// colours of the gopurams as they stand today: all the superstructures are painted lemon-yellow over
// whitewashed granite bases (2019–24 photographs, the temple's official 2023 aerial). Figures stay in
// the yellow family, with a few cream, gilt and coloured accents (Shiva-blue, rose, leaf green).
// (r3: the figures picked out more strongly — Shiva-blue, vermilion, leaf green, saffron — after c09)
const YELLOW_FIGS = [0xf2d23a, 0xe8b820, 0xf5d84a, 0xe8a830, 0x3f74c8, 0xd2402e, 0x4f9a3c, 0xe8801c, 0x3f74c8, 0xd2402e, 0xf8eebc];
export const RAJA_PAL = palette(0xeec832, YELLOW_FIGS, 0.6);
const WEST_PAL = palette(0xf2d850, YELLOW_FIGS, 0.72);
const NEW_PAL = palette(0xf2da56, YELLOW_FIGS, 0.72);

export function buildPrecinct(root: THREE.Group, R: RM, P: Physics) {
  const g = new THREE.Group();
  g.name = 'precinct';
  root.add(g);
  const B = new Batch();
  const PX = new Batch(); // shadow proxies for the gopurams' stucco towers

  // ---------- ground: the paved courts inside the walls ----------
  const court = new THREE.Mesh(new THREE.PlaneGeometry(OUTER.z1 - OUTER.z0, OUTER.x1 - OUTER.x0).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), R.court);
  court.geometry.translate((OUTER.x0 + OUTER.x1) / 2, 0.01, (OUTER.z0 + OUTER.z1) / 2);
  worldUVxz(court.geometry);
  court.receiveShadow = true;
  g.add(court);

  // ---------- outer wall ----------
  const { x0, x1, z0, z1, h, t } = OUTER;
  const W = ARM.wall;
  const wall = (ax0: number, ax1: number, az0: number, az1: number) => {
    B.span(R.granite, ax0, ax1, 0, h, az0, az1);
    // coping
    B.span(R.granite, ax0 - 0.15, ax1 + 0.15, h, h + 0.35, az0 - 0.15, az1 + 0.15);
    P.solid(Math.min(ax0, ax1), 0, Math.min(az0, az1), Math.max(ax0, ax1), h + 0.4, Math.max(az0, az1));
  };
  const gw = (wd: number) => wd / 2 + 0.2;
  // north wall (x = x1) with the north gopuram at z = 0, south wall likewise, west wall with the west gopuram at x = 0
  wall(x1 - t, x1, z0, -gw(20));
  wall(x1 - t, x1, gw(20), z1);
  wall(x0, x0 + t, z0, -gw(20));
  wall(x0, x0 + t, gw(20), z1);
  wall(x0, -gw(22), z0, z0 + t);
  wall(gw(22), x1, z0, z0 + t);
  // east: the corridor's outer wall closes the middle; the outer wall covers the corners
  wall(RING.xN + W, x1, z1 - 2, z1);
  wall(x0, RING.xS - W, z1 - 2, z1);
  // kavi stripes along the foot of the outer faces (the street sides)
  const stripes = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, top = 1.5) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 0.6);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const px = ax + (bx - ax) * u + nx * 0.03, pz = az + (bz - az) * u + nz * 0.03;
      const along = Math.abs(bx - ax) > Math.abs(bz - az);
      B.box(R.paintOut, along ? len / n : 0.04, top, along ? 0.04 : len / n, px, 0, pz, 0, i % 2 ? 0xf3eee4 : 0xa8231a);
    }
  };
  stripes(x1 + 0.0, z0, x1 + 0.0, -gw(20), 1, 0); stripes(x1, gw(20), x1, z1, 1, 0);
  stripes(x0, z0, x0, -gw(20), -1, 0); stripes(x0, gw(20), x0, z1, -1, 0);
  stripes(x0, z0, -gw(22), z0, 0, -1); stripes(gw(22), z0, x1, z0, 0, -1);
  stripes(RING.xN + W, z1, x1, z1, 0, 1); stripes(x0, z1, RING.xS - W, z1, 0, 1);

  // ---------- gopurams ----------
  const raja = gopuram(B, R, { x: RAJA.x, z: RAJA.z, ry: 0, w: RAJA.w, d: RAJA.d, h: RAJA.h, tiers: RAJA.tiers, stoneH: 11, passW: RAJA.passW, passH: RAJA.passH, kalashas: 9, pal: RAJA_PAL, seed: 11, proxy: PX }, P);
  gopuram(B, R, { x: 0, z: z0 + 6.5, ry: Math.PI, w: 22, d: 13, h: 23.8, tiers: 5, stoneH: 7.6, passW: 3.6, passH: 5.8, kalashas: 5, topW: 0.62, topD: 0.5, pal: WEST_PAL, seed: 21, proxy: PX }, P);
  gopuram(B, R, { x: x1 - 6, z: 0, ry: Math.PI / 2, w: 20, d: 12, h: 27.7, tiers: 5, stoneH: 8, passW: 3.6, passH: 5.8, kalashas: 5, topW: 0.58, topD: 0.5, pal: NEW_PAL, seed: 31, proxy: PX }, P);
  gopuram(B, R, { x: x0 + 6, z: 0, ry: -Math.PI / 2, w: 20, d: 12, h: 27.7, tiers: 5, stoneH: 8, passW: 3.6, passH: 5.8, kalashas: 5, topW: 0.58, topD: 0.5, pal: NEW_PAL, seed: 41, proxy: PX }, P);
  void raja;
  // the smaller east gopuram on the second-prakara wall, on the axis of Parvathavardhini Amman's shrine
  gopuram(B, R, { x: -33, z: 88, ry: 0, w: 16, d: 10, h: 23, tiers: 5, stoneH: 7, passW: 3.0, passH: 4.6, kalashas: 5, topW: 0.6, topD: 0.5, pal: WEST_PAL, seed: 51, proxy: PX }, P);
  // the pink neon "சிவ சிவ" (Siva Siva) sign on the Rajagopuram's east face, five tiers from the top
  {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const x = c.getContext('2d')!;
    x.fillStyle = '#2a0610';
    x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#ff6fa8';
    x.lineWidth = 6;
    x.strokeRect(8, 8, 496, 144);
    x.fillStyle = '#ff5f9a';
    x.textAlign = 'center';
    x.font = 'bold 104px "Noto Sans Tamil", "Tamil Sangam MN", sans-serif';
    x.fillText('சிவ சிவ', 256, 118);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.12), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5 }));
    const th = (RAJA.h - 11 - 1.7 - RAJA.d * 0.46 * 0.6 - RAJA.h * 0.076) / RAJA.tiers;
    const k0 = 5 / RAJA.tiers, di = RAJA.d * 0.93 + (RAJA.d * 0.46 - RAJA.d * 0.93) * k0;
    neon.position.set(0, 11 + 5 * th + th * 0.32, RAJA.z + di / 2 + 0.66);
    g.add(neon);
  }

  // ---------- the east entrance portico on East Car Street ----------
  entrancePortico(B, R, P, g);

  // ---------- Sethu Madhava theertham: a stepped tank in the west court ----------
  const tk = TANK;
  const steps = 7, sd = tk.depth / steps;
  for (let i = 0; i < steps; i++) {
    const inset = i * 1.15;
    const yTop = -i * sd;
    // each step a ring of four slabs
    const ax0 = tk.x0 + inset, ax1 = tk.x1 - inset, az0 = tk.z0 + inset, az1 = tk.z1 - inset;
    for (const [a, b, c, d] of [[ax0, ax1, az0, az0 + 1.15], [ax0, ax1, az1 - 1.15, az1], [ax0, ax0 + 1.15, az0 + 1.15, az1 - 1.15], [ax1 - 1.15, ax1, az0 + 1.15, az1 - 1.15]]) {
      B.span(R.granite, a, b, yTop - sd, yTop, c, d);
    }
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(tk.x1 - tk.x0 - 6, tk.z1 - tk.z0 - 6).rotateX(-Math.PI / 2), R.wellWater);
  water.position.set((tk.x0 + tk.x1) / 2, -tk.depth + 0.9, (tk.z0 + tk.z1) / 2);
  g.add(water);
  // hide the court paving over the tank: a dark floor patch below it, and a parapet with a railing
  const cx = (tk.x0 + tk.x1) / 2, cz = (tk.z0 + tk.z1) / 2;
  for (const [a, b, c, d] of [[tk.x0 - 0.5, tk.x1 + 0.5, tk.z0 - 0.5, tk.z0], [tk.x0 - 0.5, tk.x1 + 0.5, tk.z1, tk.z1 + 0.5], [tk.x0 - 0.5, tk.x0, tk.z0, tk.z1], [tk.x1, tk.x1 + 0.5, tk.z0, tk.z1]]) {
    B.span(R.granite, a, b, 0, 0.6, c, d);
    for (let s = 0; ; s++) {
      const along = b - a > d - c;
      const L = along ? b - a : d - c;
      const u = s * 2.0;
      if (u > L) break;
      const px = along ? a + u : (a + b) / 2, pz = along ? (c + d) / 2 : c + u;
      B.box(R.paintOut, 0.12, 0.9, 0.12, px, 0.6, pz, 0, s % 2 ? 0xa8231a : 0xf3eee4);
    }
    B.span(R.steel, a, b, 1.45, 1.5, c, d);
    P.solid(Math.min(a, b), 0, Math.min(c, d), Math.max(a, b), 1.6, Math.max(c, d));
  }
  void cx; void cz;

  // ---------- the old stone shrines of the west court (10th–11th c. vimanas) ----------
  const stonePal = palette(0x9a948c, [0x9a948c], 0.85);
  for (const [sx, sz, half] of [[22, -60, 2.2], [32, -52, 1.8], [14, -44, 2.0]] as [number, number, number][]) {
    vimana(B, R, { x: sx, z: sz, ry: 0, half, wallH: 3.0, talas: 1, dome: 'square', pal: stonePal, kalashMat: R.copper, seed: sx });
    P.solid(sx - half - 0.4, 0, sz - half - 0.4, sx + half + 0.4, 6, sz + half + 0.4);
  }

  const meshes = B.flush(g, true, 'precinct');
  // the detailed stucco and copper do not cast: the coarse proxies (hidden inside them) do
  for (const m of meshes) if (m.material === R.stucco || m.material === R.copper) m.castShadow = false;
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const m of PX.flush(g, true, 'gopuram-shadow')) { m.material = shadowOnly; m.receiveShadow = false; }
  return { group: g };
}

/** Planar xz UVs in metres for big ground quads. */
export function worldUVxz(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * The granite entrance mandapa in front of the east corridor: a tall central bay with carved
 * pillars, lower wings with cloth valances; on the parapet, Shiva and Parvati on Nandi between two
 * kirtimukha arches, and Nandis and ganas along the parapet (stone-grey stucco).
 */
function entrancePortico(B: Batch, R: RM, P: Physics, g: THREE.Group) {
  const zA = RING.zE + ARM.wall, zB = zA + 11; // from the corridor wall out to the street
  const G = R.carved;
  // floor
  B.span(R.floor, -24, 24, 0, 0.15, zA, zB);
  // central bay: four rows of tall pillars, a raised flat roof
  const pillar = (x: number, z: number, hgt: number) => {
    B.box(G, 1.1, 0.5, 1.1, x, 0.15, z);
    B.box(G, 0.8, hgt - 1.4, 0.8, x, 0.65, z);
    for (const yy of [1.5, hgt * 0.55]) B.box(G, 0.92, 0.5, 0.92, x, yy, z);
    B.box(G, 1.0, 0.3, 1.0, x, hgt - 0.75, z);
    B.box(G, 0.7, 0.4, 1.9, x, hgt - 0.45, z);
    P.solid(x - 0.5, 0, z - 0.5, x + 0.5, hgt, z + 0.5);
  };
  const cH = 8.2, wH = 5.6;
  for (const x of [-3.3, 3.3]) for (const z of [zA + 1.2, zA + 4.4, zA + 7.6, zB - 0.8]) pillar(x, z, cH);
  // a yali pillar pair at the front of the central bay
  B.span(G, -4.2, 4.2, cH, cH + 0.8, zA, zB);
  B.span(G, -4.6, 4.6, cH + 0.8, cH + 1.05, zA - 0.2, zB + 0.4);
  // wings with lower roofs
  for (const sx of [-1, 1]) {
    for (let x = 6.5; x <= 22; x += 3.4) for (const z of [zA + 1.5, zA + 5.5, zB - 0.8]) pillar(sx * x, z, wH);
    B.span(G, sx * 4.2, sx * 24, wH, wH + 0.6, zA, zB);
    B.span(G, sx * 4.2, sx * 24.3, wH + 0.6, wH + 0.85, zA - 0.2, zB + 0.35);
    // the valance of yellow and orange cloth hung under the wing eaves, as at festival time
    for (let x = 4.6; x < 24; x += 0.9) {
      B.box(R.paintOut, 0.85, 0.55, 0.04, sx * (x + 0.45), wH - 0.5, zB + 0.45, 0, Math.floor(x / 0.9) % 2 ? 0xf2b418 : 0xe8701a);
    }
  }
  // rear wall of the portico wings (the corridor wall is behind the centre)
  // ---- parapet sculpture group (stone-grey stucco) ----
  const E = new Emit(B);
  // painted stucco: a white Nandi, the riders in Shiva-blue and rose, gilt arches
  const grey = palette(0xece6d6, [0xe8c860, 0x8cb4e0, 0xe8a0a8], 0.85);
  const S = R.stucco;
  const top = cH + 1.05, zc = zB - 1.4;
  // the central group is big — the Nandi with its riders is as tall as the parapet below it
  E.box(S, 7.4, 0.5, 2.4, 0, top, zc, grey.trim);
  E.box(S, 6.8, 0.5, 2.0, 0, top + 0.5, zc, grey.base);
  E.push(new THREE.Matrix4().makeTranslation(0, top + 1.0, zc).multiply(new THREE.Matrix4().makeScale(1.75, 1.75, 1.75)).multiply(new THREE.Matrix4().makeTranslation(0, -top, -zc)));
  // two kirtimukha arches flanking the centre
  for (const sx of [-1, 1]) {
    E.push(new THREE.Matrix4().makeTranslation(sx * 2.6, top, zc));
    E.box(S, 1.6, 0.4, 1.0, 0, 0, 0, grey.trim);
    E.geo(S, new THREE.TorusGeometry(0.8, 0.13, 5, 14, Math.PI).translate(0, 0.45, 0), grey.base);
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; E.geo(S, new THREE.SphereGeometry(0.12, 6, 4).translate(Math.cos(a) * 0.98, 0.45 + Math.sin(a) * 0.98, 0), grey.base); }
    E.lathe(S, [[0, 0], [0.32, 0.1], [0.38, 0.4], [0.22, 0.7], [0, 0.78]], 0, 1.35, 0, 8, grey.base);
    E.lathe(S, [[0.35, 0], [0.4, 0.3], [0.28, 0.75], [0.18, 0.9], [0.12, 1.1], [0, 1.2]], 0, 0.4, 0, 8, grey.figs[1]);
    E.pop();
  }
  // Rishabharudha: Nandi with the divine couple seated on him (massing), on a moulded pedestal
  E.box(S, 2.6, 0.5, 1.4, 0, top, zc, grey.trim);
  const bull = nandiMesh(S, 0.9, 72, 0.15);
  bull.geometry.rotateY(Math.PI);
  const bm = bull.geometry.clone();
  E.geo(S, bm.translate(0, top + 0.5, zc), grey.base);
  // the two riders seated on its back (massing, no features), with tall crowns
  E.lathe(S, [[0.42, 0], [0.46, 0.3], [0.3, 0.68], [0.17, 0.76], [0.11, 0.98], [0, 1.08]], -0.22, top + 1.45, zc + 0.2, 8, grey.figs[1]);
  E.lathe(S, [[0.36, 0], [0.39, 0.27], [0.25, 0.6], [0.15, 0.68], [0.1, 0.88], [0, 0.98]], 0.3, top + 1.4, zc + 0.15, 8, grey.figs[2]);
  E.pop();
  // corner Nandis and ganas along the parapet
  for (const sx of [-1, 1]) {
    for (const x of [7, 13, 19, 23]) {
      E.push(new THREE.Matrix4().makeTranslation(sx * x, wH + 0.85, zB - 0.3));
      if (x === 23 || x === 13) {
        const n = nandiMesh(S, 0.42).geometry.clone().rotateY(Math.PI);
        E.geo(S, n, grey.base);
      } else {
        E.lathe(S, [[0.42, 0], [0.46, 0.3], [0.38, 0.62], [0.2, 0.78], [0.24, 0.96], [0.0, 1.12]], 0, 0, 0, 8, grey.base);
      }
      E.pop();
    }
  }
  // walls closing the wings' sides
  for (const sx of [-1, 1]) {
    B.span(G, sx * 24, sx * 24.6, 0, wH + 0.6, zA, zB);
    P.solid(Math.min(sx * 24, sx * 24.6), 0, zA, Math.max(sx * 24, sx * 24.6), wH, zB);
  }
  P.floor(g, -24, 24, zA - 0.5, zB + 0.2, 0.15);
  void rng;
}

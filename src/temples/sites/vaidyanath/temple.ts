import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { VM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './offerings';
import { kalashGeo, lathe, panchshool, pennant, ribbedCollar, tower, trishul, tube, type TowerSpec } from './forms';
import { SANCTUM } from './sanctum';

/**
 * Baba Baidyanath's temple (east-facing; +z = east, +x = north, origin = centre of the garbhagriha).
 *
 * A plain, massive stone temple under thick whitewash: a square garbhagriha block with moulded
 * base walls (a band of lotus petals, a band of rosettes, corbels under a heavy cornice) carrying
 * a 72 ft (22 m) tower of horizontal courses whose rounded-square plan swells like a closed lotus
 * bud. On the summit: a neck and ribbed collar, three gold kalashas in ascending order (gift of
 * Raja Puran Singh of Gidhaur), and the Panchshool — five prongs, not three. In front, the
 * flat-roofed pillared porch (the front portion attributed to Puran Mal, 1596), with an LED screen
 * on its roof and an iron ladder up the tower for the men who tie the gathbandhan.
 */

export const MAIN = {
  F: SANCTUM.F,
  /** garbhagriha block half-width */
  half: 5.7,
  wallTop: 4.75,
  /** tower base and height */
  towerY: 5.2,
  towerH: 12.6,
  towerHalf: 4.85,
  porch: { x0: -7.0, x1: 7.0, z0: 5.7, z1: 11.0, roof: 3.55 },
  /** plinth extent */
  plinth: { x0: -7.5, x1: 7.5, z0: -6.2, z1: 11.4 },
};

/** The main tower's plan profile (scale vs height fraction): a closed lotus bud. */
/** measured on the official frontal photo: 0.84 @ t=0.5, 0.57 @ 0.75, 0.32 @ 0.9, then the flat summit terrace (~0.28) */
const mainProfile = (t: number) => Math.max(0.28, 1 - 0.2 * t - 0.62 * Math.pow(t, 2.6));

export const MAIN_TOWER: TowerSpec = {
  half: MAIN.towerHalf, height: MAIN.towerH, courses: 16, n: 9, profile: mainProfile,
  lip: 0.06, moulding: 0.08, batter: 0.012, seg: 128, bulge: 0.01, bandEvery: 6,
};

/** Where the gathbandhan threads tie on round the main crown: centre + radius. */
export const MAIN_TIE = { y: MAIN.towerY + MAIN.towerH + 0.45, r: 0.8 };

const Y = new THREE.Vector3(0, 1, 0);

/** Row of eight-petalled rosettes and a row of lotus petals for the base walls. */
function rosetteGeo(d: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const p = new THREE.SphereGeometry(d * 0.22, 8, 6).scale(0.55, 1, 0.35).translate(0, d * 0.24, 0);
    p.rotateZ((i / 8) * Math.PI * 2);
    p.deleteAttribute('uv');
    parts.push(p.toNonIndexed());
  }
  const c = new THREE.SphereGeometry(d * 0.1, 10, 8).scale(1, 1, 0.6);
  c.deleteAttribute('uv');
  parts.push(c.toNonIndexed());
  return mergeGeometries(parts)!;
}
function petalGeo(w: number, h: number) {
  const g = new THREE.SphereGeometry(w / 2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / (w / 2), 0.5).rotateX(Math.PI);
  g.translate(0, h, 0);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/**
 * Decorate the four (or chosen) faces of a square block centred at (cx, cz) with half-width h:
 * mouldings, a petal band and a rosette band, corbels under the cornice.
 * `faces` lists outward normals to decorate.
 */
function baseWalls(B: Merger, V: VM, mat: THREE.Material, cx: number, cz: number, h: number, y0: number, top: number, faces: ('n' | 's' | 'e' | 'w')[], rich = true) {
  const k = (top - y0) / 4.55; // scale the band heights to the wall height
  const band = (ya: number, yb: number, out: number) => {
    for (const f of faces) {
      const len = 2 * (h + out);
      const w = f === 'n' || f === 's' ? 0 : len, d = f === 'n' || f === 's' ? len : 0;
      const off = h + out / 2;
      const [x, z] = f === 'n' ? [cx + off, cz] : f === 's' ? [cx - off, cz] : f === 'e' ? [cx, cz + off] : [cx, cz - off];
      B.box(mat, w || out, (yb - ya), d || out, x, ya, z);
    }
  };
  band(y0, y0 + 0.22 * k, 0.12);
  band(y0 + 0.22 * k, y0 + 0.3 * k, 0.06);
  band(y0 + 0.62 * k, y0 + 0.7 * k, 0.07);
  band(y0 + 1.42 * k, y0 + 1.5 * k, 0.08);
  band(y0 + 1.62 * k, y0 + 1.68 * k, 0.05);
  band(y0 + 2.45 * k, y0 + 2.55 * k, 0.08);
  band(y0 + 2.9 * k, y0 + 2.96 * k, 0.05);
  band(y0 + 3.6 * k, y0 + 3.72 * k, 0.09);
  if (!rich) return;
  const pet = petalGeo(0.24 * k, 0.4 * k), ros = rosetteGeo(0.66 * k);
  for (const f of faces) {
    const along = (u: number, out: number): [number, number, number] =>
      f === 'n' ? [cx + h + out, cz + u, Math.PI / 2] : f === 's' ? [cx - h - out, cz - u, -Math.PI / 2]
        : f === 'e' ? [cx + u, cz + h + out, 0] : [cx - u, cz - h - out, Math.PI];
    // lotus petals hanging below the moulding at 1.42
    const np = Math.floor((2 * h - 0.3) / (0.27 * k));
    for (let i = 0; i < np; i++) {
      const u = -h + 0.15 + (i + 0.5) * ((2 * h - 0.3) / np);
      const [x, z, ry] = along(u, 0.0);
      B.place(mat, pet, x, y0 + 1.08 * k, z, ry);
    }
    // rosettes in a band between 1.7 and 2.45
    const nr = Math.floor((2 * h - 0.4) / (0.78 * k));
    for (let i = 0; i < nr; i++) {
      const u = -h + 0.2 + (i + 0.5) * ((2 * h - 0.4) / nr);
      const [x, z, ry] = along(u, 0.0);
      B.place(mat, ros, x, y0 + 2.07 * k, z, ry);
    }
    // corbels under the cornice
    const nc = Math.floor((2 * h) / 1.05);
    for (let i = 0; i < nc; i++) {
      const u = -h + (i + 0.5) * ((2 * h) / nc);
      const [x, z, ry] = along(u, 0.14);
      B.box(mat, 0.22, 0.42 * k, 0.28, x, top - 0.42 * k, z, false, ry);
      B.box(mat, 0.3, 0.1, 0.36, x, top - 0.1, z, false, ry);
    }
  }
}

/** Heavy cornice slab (with a sloped drip) around a square block. Optional hole for a vault. */
function cornice(B: Merger, mat: THREE.Material, cx: number, cz: number, h: number, y: number, out: number, thick: number, hole = 0) {
  const H = h + out;
  if (hole > 0) {
    B.span(mat, cx - H, y, cz - H, cx + H, y + thick, cz - hole);
    B.span(mat, cx - H, y, cz + hole, cx + H, y + thick, cz + H);
    B.span(mat, cx - H, y, cz - hole, cx - hole, y + thick, cz + hole);
    B.span(mat, cx + hole, y, cz - hole, cx + H, y + thick, cz + hole);
  } else B.span(mat, cx - H, y, cz - H, cx + H, y + thick, cz + H);
  const D = H + 0.06, r = hole > 0 ? Math.min(hole, h - 0.2) : 0;
  if (r > 0) {
    // the drip is a ring too: a full slab here sealed the corbelled vault from inside
    B.span(mat, cx - D, y - 0.08, cz - D, cx + D, y, cz - r);
    B.span(mat, cx - D, y - 0.08, cz + r, cx + D, y, cz + D);
    B.span(mat, cx - D, y - 0.08, cz - r, cx - r, y, cz + r);
    B.span(mat, cx + r, y - 0.08, cz - r, cx + D, y, cz + r);
  } else B.span(mat, cx - D, y - 0.08, cz - D, cx + D, y, cz + D);
}

export interface Crown {
  kind: 'main' | 'kalash' | 'dome';
  /** collar radius */
  r: number;
  /** finial: trishul, panchshool, or none */
  finial?: 'trishul' | 'panchshool' | 'none';
  flags?: number;
  goldKalash?: boolean;
  /** extra iron lamp bracket + loudspeakers (main temple / Parvati) */
  fittings?: boolean;
}

/** Crown on a tower top at (x, y, z), returns the height of the highest point. */
export function crown(B: Merger, V: VM, x: number, y: number, z: number, c: Crown, mat: THREE.Material = V.shikhara, ry = 0) {
  const r = c.r;
  // the crown metal is polished steel/silver (2025 summit photos), not gold
  const gold = V.crownSteel;
  let yy = y;
  if (c.kind === 'main') {
    // as seen on the summit terrace (Mahashivratri 2025): a white drum ~1.2 m across, girdled by a ring
    // of ten big white cushion lobes dabbed with sindoor, a white neck, then the steel stack of three
    // kalashas in ascending order (Raja Puran Singh of Gidhaur) and the Panchshool on its rod
    const dr = 0.62;
    B.place(mat, lathe([[dr + 0.08, 0], [dr + 0.08, 0.1], [dr, 0.14], [dr, 0.62], [dr * 0.8, 0.7], [0, 0.7]], 40), x, yy, z);
    const lobe = new THREE.SphereGeometry(0.17, 14, 10).scale(1, 0.85, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31;
      const lx = x + Math.cos(a) * (dr + 0.06), lz = z + Math.sin(a) * (dr + 0.06);
      B.place(mat, lobe, lx, yy + 0.5, lz);
      B.place(V.kumkum, new THREE.SphereGeometry(0.045, 8, 6).scale(1, 0.6, 1), x + Math.cos(a) * (dr + 0.2), yy + 0.55, z + Math.sin(a) * (dr + 0.2));
    }
    yy += 0.7;
    B.place(mat, lathe([[0.42, 0], [0.38, 0.1], [0.34, 0.42], [0.46, 0.5], [0, 0.5]], 32), x, yy, z);
    yy += 0.5;
    B.place(gold, lathe([[0.42, 0], [0.46, 0.06], [0.32, 0.16], [0, 0.16]], 32), x, yy, z);
    yy += 0.14;
    for (const h of [0.7, 0.56, 0.44]) {
      B.place(gold, kalashGeo(h), x, yy, z);
      yy += h * 0.94;
    }
  } else {
    // neck and ribbed collar (the amalaka-like cushion), a drum, a lotus seat
    B.place(mat, lathe([[r * 0.95, 0], [r * 0.95, r * 0.08], [r * 0.78, r * 0.12], [r * 0.74, r * 0.36], [r * 0.82, r * 0.4], [0, r * 0.4]], 40), x, yy, z);
    yy += r * 0.4;
    B.place(mat, ribbedCollar(r * 1.08, r * 0.5, 28, 64), x, yy, z);
    yy += r * 0.5;
    B.place(mat, lathe([[r * 0.55, 0], [r * 0.5, r * 0.08], [r * 0.45, r * 0.3], [r * 0.6, r * 0.36], [0, r * 0.36]], 32), x, yy, z);
    yy += r * 0.36;
    const h = r * 0.95;
    B.place(gold, kalashGeo(h), x, yy, z);
    yy += h * 0.94;
  }
  // rod and finial
  const rodH = c.kind === 'main' ? 0.6 : r * 0.55;
  B.add(gold, tube([new THREE.Vector3(x, yy, z), new THREE.Vector3(x, yy + rodH, z)], 0.028, 2, 6));
  yy += rodH;
  let top = yy;
  if (c.finial !== 'none') {
    const fh = c.kind === 'main' ? 1.2 : Math.max(0.55, r * 1.0);
    const g = (c.finial ?? 'panchshool') === 'panchshool' ? panchshool(fh) : trishul(fh);
    B.place(gold, g, x, yy, z, ry);
    top = yy + fh;
  }
  // saffron and red pennants on the rod
  // stacked red and saffron pennants on the rod (devotees add a new one with every offering), plus
  // a couple of tall flags on bamboo staves lashed to the crown
  const nf = c.flags ?? 1;
  const big = c.kind === 'main' ? 1 : 0.75;
  for (let i = 0; i < nf; i++) {
    const fy = yy - 0.05 - i * 0.26 * big;
    const fl = pennant((0.75 + ((i * 37) % 5) * 0.08) * big, (0.45 + ((i * 13) % 3) * 0.06) * big);
    B.place(i % 2 ? V.banner : V.saffron, fl, x, fy, z, ry + 0.6 + i * 1.9);
  }
  for (let k = 0; k < 2; k++) {
    const a = ry + 0.8 + k * 2.6, rr = Math.max(0.35, r * 0.7);
    const bx = x + Math.cos(a) * rr, bz = z + Math.sin(a) * rr;
    const sh = (c.kind === 'main' ? 2.6 : 1.8) + k * 0.4;
    B.place(V.bamboo, new THREE.CylinderGeometry(0.02, 0.025, sh, 5), bx, y + sh / 2, bz);
    B.place(k ? V.banner : V.saffron, pennant(0.9 * big, 0.55 * big), bx, y + sh - 0.02, bz, a + 1.2);
    B.place(k ? V.saffron : V.banner, pennant(0.7 * big, 0.42 * big), bx, y + sh - 0.5, bz, a + 0.7);
  }
  if (c.fittings) {
    // the iron shepherd's-crook lamp arm and two loudspeakers on the neck
    const base = new THREE.Vector3(x + 0.95, y + 0.1, z + 0.3);
    B.add(V.iron, tube([base, base.clone().add(new THREE.Vector3(0.1, 1.6, 0)), base.clone().add(new THREE.Vector3(0.25, 2.45, 0.1)),
      base.clone().add(new THREE.Vector3(0.7, 2.6, 0.2)), base.clone().add(new THREE.Vector3(0.9, 2.35, 0.25))], 0.035, 20, 6));
    B.place(V.iron, lathe([[0, 0], [0.16, 0.0], [0.08, 0.14], [0, 0.16]], 12), base.x + 0.9, base.y + 2.18, base.z + 0.25);
    const horn = lathe([[0.06, 0], [0.08, 0.02], [0.2, 0.35], [0.22, 0.36], [0, 0.36]], 14).rotateX(Math.PI / 2);
    B.place(V.steel, horn, x - 1.0, y + 0.4, z + 0.6, -0.9);
    B.place(V.steel, horn, x + 1.0, y + 0.4, z + 0.6, 0.9);
  }
  return top;
}

/** Iron ladder pinned up the front (+z) face of the main tower, following its swell. */
function ladder(B: Merger, V: VM, x0: number, yBase: number, sp: TowerSpec, yTo: number) {
  const rails: THREE.Vector3[][] = [[], []];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const y = yBase + 0.3 + (i / n) * (yTo - yBase - 0.3);
    const t = Math.min(1, Math.max(0, (y - MAIN.towerY) / sp.height));
    const zf = sp.half * sp.profile(t) + (sp.lip ?? 0.12) + 0.12;
    rails[0].push(new THREE.Vector3(x0 - 0.2, y, zf));
    rails[1].push(new THREE.Vector3(x0 + 0.2, y, zf));
  }
  for (const r of rails) B.add(V.iron, tube(r, 0.022, 60, 5));
  const rung = new THREE.CylinderGeometry(0.014, 0.014, 0.4, 5).rotateZ(Math.PI / 2);
  for (let i = 0; i <= n; i += 1) {
    const p = rails[0][i];
    B.place(V.iron, rung, x0, p.y, p.z);
  }
}

export interface MainOut {
  /** the porch interior + door passage points to zone-switch lights */
  doorGlow: THREE.PointLight;
}

export function buildMainTemple(root: THREE.Group, B: Merger, V: VM, P: Physics, flames: Flames, O: Offerings): MainOut {
  const { F, half, wallTop, towerY, towerH, porch, plinth } = MAIN;
  const { core, doorW, doorH } = SANCTUM;

  // ---- plinth with steps along the porch front
  B.span(V.lime, plinth.x0, 0, plinth.z0, plinth.x1, F, plinth.z1);
  B.span(V.lime, plinth.x0 - 0.06, F - 0.08, plinth.z0 - 0.06, plinth.x1 + 0.06, F, plinth.z1 + 0.06);
  P.floor(root, plinth.x0, plinth.x1, plinth.z0, plinth.z1, F);
  for (let i = 0; i < 2; i++) {
    const zz = plinth.z1 + 0.32 * (2 - i);
    B.span(V.porchFloor, -6.4, 0, zz - 0.32, 6.4, F * (i + 1) / 3, zz);
    P.floor(root, -6.4, 6.4, zz - 0.32, zz, F * (i + 1) / 3);
  }
  // the courtyard is lower than the plinth everywhere else: block it except via the steps
  P.solid(plinth.x0, 0, plinth.z0, plinth.x1, F - 0.05, plinth.z1 - 0.02);

  // ---- garbhagriha block (the walls round the sanctum, with the door passage on the east)
  const W = V.lime;
  B.span(W, -half, F, -half, half, wallTop, -core, true);
  B.span(W, -half, F, -core, -core, wallTop, core, true);
  B.span(W, core, F, -core, half, wallTop, core, true);
  B.span(W, -half, F, core, -doorW, wallTop, half, true);
  B.span(W, doorW, F, core, half, wallTop, half, true);
  B.span(W, -doorW, F + doorH, core, doorW, wallTop, half);
  // the passage: lined with smoke-dark stone, a raised threshold, a silver-clad door frame
  B.span(V.sanctumWall, -doorW - 0.01, F, core, -doorW, F + doorH, half);
  B.span(V.sanctumWall, doorW, F, core, doorW + 0.01, F + doorH, half);
  B.span(V.sanctumFloor, -doorW, F - 0.1, core - 0.05, doorW, F + 0.02, half);
  P.floor(root, -doorW, doorW, core - 0.05, half + 0.05, F);
  B.span(V.silver, -doorW - 0.16, F, half - 0.02, -doorW, F + doorH + 0.16, half + 0.06);
  B.span(V.silver, doorW, F, half - 0.02, doorW + 0.16, F + doorH + 0.16, half + 0.06);
  B.span(V.silver, -doorW - 0.16, F + doorH, half - 0.02, doorW + 0.16, F + doorH + 0.18, half + 0.06);
  B.span(V.brass, -doorW, F, half - 0.06, doorW, F + 0.12, half + 0.04); // threshold plate
  // open leaves of the door (silver over wood), folded back inside the porch
  for (const s of [-1, 1]) {
    B.box(V.silver, 0.06, doorH - 0.05, 0.62, s * (doorW + 0.22), F, half + 0.38);
  }

  // decorated exterior faces (north, south, west; the east hides behind the porch)
  baseWalls(B, V, W, 0, 0, half, F, wallTop - 0.05, ['n', 's', 'w']);
  cornice(B, W, 0, 0, half, wallTop, 0.42, 0.33, 2.3);
  // a short square plinth for the tower
  B.span(W, -MAIN.towerHalf - 0.15, wallTop + 0.33, -MAIN.towerHalf - 0.15, -2.3, towerY, MAIN.towerHalf + 0.15);
  B.span(W, 2.3, wallTop + 0.33, -MAIN.towerHalf - 0.15, MAIN.towerHalf + 0.15, towerY, MAIN.towerHalf + 0.15);
  B.span(W, -2.3, wallTop + 0.33, -MAIN.towerHalf - 0.15, 2.3, towerY, -2.3);
  B.span(W, -2.3, wallTop + 0.33, 2.3, 2.3, towerY, MAIN.towerHalf + 0.15);

  // ---- the tower
  const tw = tower(MAIN_TOWER);
  B.place(V.mainShikhara, tw.geo, 0, towerY, 0);
  const topY = towerY + towerH;
  crown(B, V, 0, topY, 0, { kind: 'main', r: 1.05, finial: 'panchshool', flags: 5, fittings: true }, V.lime, 0);
  ladder(B, V, 0.0, porch.roof + 0.3, MAIN_TOWER, topY - 0.3);

  // ---- porch
  const p = porch;
  B.span(V.porchFloor, p.x0, F - 0.02, p.z0, p.x1, F + 0.005, p.z1);
  // roof slab, parapet with the red band, eave along the front
  B.span(W, p.x0 - 0.2, p.roof, p.z0 - 0.2, p.x1 + 0.2, p.roof + 0.3, p.z1 + 0.35);
  B.span(W, p.x0 - 0.2, p.roof + 0.3, p.z1 + 0.15, p.x1 + 0.2, p.roof + 0.85, p.z1 + 0.35);
  B.span(W, p.x0 - 0.2, p.roof + 0.3, p.z0 - 0.2, p.x0, p.roof + 0.85, p.z1 + 0.35);
  B.span(W, p.x1, p.roof + 0.3, p.z0 - 0.2, p.x1 + 0.2, p.roof + 0.85, p.z1 + 0.35);
  B.span(V.redBand, p.x0 - 0.22, p.roof + 0.85, p.z1 + 0.13, p.x1 + 0.22, p.roof + 0.92, p.z1 + 0.37);
  B.span(V.redBand, p.x0 - 0.22, p.roof - 0.02, p.z1 + 0.33, p.x1 + 0.22, p.roof + 0.3, p.z1 + 0.37);
  // eave drip and the row of corbel blocks under it
  B.span(W, p.x0 - 0.3, p.roof - 0.12, p.z1 + 0.35, p.x1 + 0.3, p.roof, p.z1 + 0.62);
  for (let x = p.x0 + 0.5; x <= p.x1 - 0.4; x += 1.05) {
    B.box(W, 0.26, 0.36, 0.5, x, p.roof - 0.48, p.z1 + 0.2);
  }
  // front beam and pillars (square shafts with simple capitals and bases)
  B.span(W, p.x0, p.roof - 0.42, p.z1 - 0.55, p.x1, p.roof, p.z1);
  const pillarsX = [-6.6, -4.0, -1.35, 1.35, 4.0, 6.6];
  for (const x of pillarsX) {
    B.box(W, 0.62, 0.35, 0.62, x, F, p.z1 - 0.28, true);
    B.box(W, 0.48, p.roof - 0.42 - F - 0.7, 0.48, x, F + 0.35, p.z1 - 0.28, true);
    B.box(W, 0.6, 0.35, 0.6, x, p.roof - 0.77, p.z1 - 0.28);
  }
  // side walls with a doorway each
  for (const sx of [p.x0, p.x1]) {
    const x0 = sx < 0 ? sx : sx - 0.45, x1 = sx < 0 ? sx + 0.45 : sx;
    B.span(W, x0, F, p.z0, x1, p.roof, p.z0 + 1.6, true);
    B.span(W, x0, F, p.z0 + 2.8, x1, p.roof, p.z1, true);
    B.span(W, x0, F + 2.4, p.z0 + 1.6, x1, p.roof, p.z0 + 2.8);
  }
  // inner faces of the porch go grey with lamp smoke; a dark ceiling; the temple's east face
  // inside the porch is old, hand-worn and grimy
  B.span(V.sanctumWall, p.x0 + 0.45, F, half, -doorW - 0.16, p.roof, half + 0.03);
  B.span(V.sanctumWall, doorW + 0.16, F, half, p.x1 - 0.45, p.roof, half + 0.03);
  B.span(V.sanctumWall, -doorW - 0.16, F + doorH + 0.18, half, doorW + 0.16, p.roof, half + 0.03);
  B.span(V.sanctumWall, p.x0 + 0.45, p.roof - 0.04, p.z0, p.x1 - 0.45, p.roof, p.z1 - 0.55);

  // ---- arghya: the steel funnel that carries water to the lingam on crowded days
  const ax = 2.2, az = p.z0 + 1.2;
  B.place(V.steel, lathe([[0.04, 0], [0.04, 0.85], [0.35, 1.15], [0.38, 1.2], [0.36, 1.21], [0.04, 0.9], [0, 0.9]], 24), ax, F, az);
  B.add(V.steel, tube([new THREE.Vector3(ax, F + 0.82, az), new THREE.Vector3(ax - 0.4, F + 0.8, az - 0.6),
    new THREE.Vector3(doorW + 0.35, F + 0.75, half + 0.1), new THREE.Vector3(doorW + 0.3, F + 0.7, half - 0.4)], 0.035, 16, 8));
  P.solid(ax - 0.4, F, az - 0.4, ax + 0.4, F + 1.2, az + 0.4);

  // ---- bells over the door and a garland across it
  const bellGeo = lathe([[0, 0.2], [0.03, 0.2], [0.05, 0.17], [0.06, 0.11], [0.085, 0.03], [0.1, 0], [0.09, -0.006], [0.07, 0.025], [0.035, 0.14], [0, 0.15]], 20);
  const beamY = p.roof - 0.42;
  for (const [bx, len] of [[-1.0, 0.9], [-0.55, 1.15], [0.55, 1.05], [1.0, 0.8], [1.6, 1.2], [-1.8, 1.0]] as const) {
    const bz = half + 1.0;
    B.add(V.iron, tube([new THREE.Vector3(bx, beamY, bz), new THREE.Vector3(bx, beamY - len, bz)], 0.006, 2, 4));
    B.place(V.brass, bellGeo, bx, beamY - len - 0.2, bz, 0, 1 + (len - 1) * 0.3);
  }
  O.strand(new THREE.Vector3(-doorW - 0.15, F + doorH + 0.15, half + 0.08), new THREE.Vector3(doorW + 0.15, F + doorH + 0.15, half + 0.08), 0.28);
  for (const s of [-1, 1]) O.strand(new THREE.Vector3(s * (doorW + 0.15), F + doorH + 0.15, half + 0.08), new THREE.Vector3(s * (doorW + 0.15), F + 1.1, half + 0.1), 0.02);
  // petals and bel trodden into the porch floor near the door
  O.scatter(-1.6, 1.6, half + 0.1, half + 2.4, F + 0.006, 90, 0.3);

  // ---- the LED screen on the porch roof (aarti is relayed to the courtyard)
  B.span(V.iron, -6.3, p.roof + 0.3, 8.8, -6.2, p.roof + 1.2, 8.9);
  B.span(V.iron, -2.8, p.roof + 0.3, 8.8, -2.7, p.roof + 1.2, 8.9);
  B.span(V.tarpBlue, -6.6, p.roof + 0.9, 8.75, -2.4, p.roof + 3.4, 9.05);
  B.span(V.screen, -6.45, p.roof + 1.05, 9.05, -2.55, p.roof + 3.25, 9.08);

  // a dim glow in the door passage for the view from the courtyard
  const doorGlow = new THREE.PointLight(0xffa860, 1.3, 6, 1.8);
  doorGlow.position.set(0, F + 1.6, half + 0.9);
  root.add(doorGlow);
  flames.points.push(new THREE.Vector3(-1.1, F + 1.05, half + 0.25), new THREE.Vector3(1.1, F + 1.05, half + 0.25));
  B.place(V.brass, lathe([[0.1, 0], [0.1, 0.03], [0.05, 0.06], [0.03, 0.9], [0.09, 0.95], [0.1, 1.0], [0, 1.0]], 16), -1.1, F, half + 0.25);
  B.place(V.brass, lathe([[0.1, 0], [0.1, 0.03], [0.05, 0.06], [0.03, 0.9], [0.09, 0.95], [0.1, 1.0], [0, 1.0]], 16), 1.1, F, half + 0.25);
  return { doorGlow };
}

// ------------------------------------------------------------------ shrines

export type ShrineKind = 'rekha' | 'pidha' | 'beehive' | 'dome';

export interface ShrineSpec {
  name?: string;
  x: number;
  z: number;
  /** rotation about y; the shrine's door faces local +z */
  ry: number;
  kind: ShrineKind;
  /** block half-width */
  half: number;
  /** overall height to the top of the tower body */
  height: number;
  crimson?: boolean;
  porch?: number;
  finial?: 'trishul' | 'panchshool' | 'none';
  /** crown like Baba's (Maa Parvati: the other end of the gathbandhan) */
  mainCrown?: boolean;
}

/**
 * A subsidiary shrine: a square block (moulded, a dark doorway with a lamp on its sill),
 * a tower of the chosen kind, and a crown. Returns the crown tie-point for threads/flags.
 */
export function buildShrine(root: THREE.Group, B: Merger, V: VM, P: Physics, flames: Flames, O: Offerings, s: ShrineSpec) {
  const g = new THREE.Group();
  const wallMat = s.crimson ? V.crimson : V.lime;
  const towerMat = s.crimson ? V.crimson : V.shikhara;
  const h = s.half;
  const wallH = s.kind === 'dome' ? h * 1.25 : Math.min(4.4, Math.max(2.2, h * 1.05));
  const plinth = 0.35;
  // do the work in a local frame then transform
  const saveOff = B.offset.clone();
  const local = new THREE.Matrix4().compose(new THREE.Vector3(s.x, 0, s.z), new THREE.Quaternion().setFromAxisAngle(Y, s.ry), new THREE.Vector3(1, 1, 1));
  const L = new LocalMerger(B, local);
  L.span(wallMat, -h - 0.3, 0, -h - 0.3, h + 0.3, plinth, h + 0.3 + (s.porch ?? 0));
  L.span(wallMat, -h, plinth, -h, h, plinth + wallH, h);
  // doorway: dark recess with a frame, a lamp on the sill
  const dw = Math.min(0.55, h * 0.3), dh = Math.min(2.0, wallH * 0.72);
  L.span(V.dark, -dw, plinth, h - 0.02, dw, plinth + dh, h + 0.005);
  L.span(wallMat, -dw - 0.14, plinth, h, -dw, plinth + dh + 0.14, h + 0.08);
  L.span(wallMat, dw, plinth, h, dw + 0.14, plinth + dh + 0.14, h + 0.08);
  L.span(wallMat, -dw - 0.14, plinth + dh, h, dw + 0.14, plinth + dh + 0.16, h + 0.08);
  const lampP = new THREE.Vector3(0, plinth + 0.08, h + 0.2).applyMatrix4(local);
  flames.points.push(lampP);
  // mouldings
  const k = wallH / 4.55;
  for (const [ya, yb, out] of [[0, 0.18, 0.1], [0.62, 0.7, 0.06], [1.42, 1.5, 0.07], [2.45, 2.55, 0.07], [3.6, 3.7, 0.08]] as const) {
    L.span(wallMat, -h - out, plinth + ya * k, -h - out, h + out, plinth + yb * k, h + out);
  }
  // cornice
  const top = plinth + wallH;
  L.span(wallMat, -h - 0.3, top, -h - 0.3, h + 0.3, top + 0.22, h + 0.3);
  L.span(wallMat, -h - 0.36, top - 0.07, -h - 0.36, h + 0.36, top, h + 0.36);
  if (s.crimson) L.span(V.lime, -h - 0.31, top + 0.22, -h - 0.31, h + 0.31, top + 0.27, h + 0.31);
  // a flat porch in front (pillars + roof), as on the bigger shrines
  if (s.porch) {
    const pz0 = h, pz1 = h + s.porch, pr = Math.min(3.4, wallH * 0.85) + plinth;
    L.span(wallMat, -h - 0.15, pr, pz0 - 0.1, h + 0.15, pr + 0.25, pz1 + 0.25);
    L.span(V.redBand, -h - 0.17, pr + 0.25, pz1 + 0.05, h + 0.17, pr + 0.4, pz1 + 0.27);
    const n = Math.max(2, Math.round((2 * h) / 1.6) + 1);
    for (let i = 0; i < n; i++) {
      const x = -h + 0.25 + (i / (n - 1)) * (2 * h - 0.5);
      L.span(wallMat, x - 0.18, plinth, pz1 - 0.4, x + 0.18, pr, pz1 - 0.04);
    }
    for (let x = -h + 0.3; x < h; x += 0.9) L.span(wallMat, x - 0.1, pr - 0.3, pz1 - 0.05, x + 0.1, pr, pz1 + 0.2);
  }
  // collider: the block (+ porch footprint is open: pillars only)
  const corners = [[-h - 0.3, -h - 0.3], [h + 0.3, h + 0.3]].map(([a, b]) => new THREE.Vector3(a, 0, b).applyMatrix4(local));
  P.solid(Math.min(corners[0].x, corners[1].x), 0, Math.min(corners[0].z, corners[1].z), Math.max(corners[0].x, corners[1].x), top + 2, Math.max(corners[0].z, corners[1].z));

  // tower
  const bodyH = Math.max(1.5, s.height - top - 0.22);
  let topHalf: number;
  let tie: THREE.Vector3;
  if (s.kind === 'dome') {
    const r = h * 1.0;
    const prof: [number, number][] = [[r, 0]];
    for (let i = 1; i <= 14; i++) {
      const a = (i / 14) * Math.PI / 2;
      prof.push([r * Math.cos(a) * (1 + 0.08 * Math.sin(a * 2)), r * 0.95 * Math.sin(a) + r * 0.25 * Math.pow(Math.sin(a), 6)]);
    }
    prof.push([0, r * 1.22]);
    const dome = lathe(prof, 48);
    L.place(towerMat, dome, 0, top + 0.22, 0);
    // ribs
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 10; j++) {
        const t = (j / 10) * Math.PI / 2;
        const rr = r * Math.cos(t) * (1 + 0.08 * Math.sin(t * 2)) + 0.03;
        pts.push(new THREE.Vector3(Math.cos(a) * rr, top + 0.22 + r * 0.95 * Math.sin(t) + r * 0.25 * Math.pow(Math.sin(t), 6) + 0.01, Math.sin(a) * rr));
      }
      L.add(towerMat, tube(pts, 0.05, 20, 5));
    }
    topHalf = 0.25;
    const ty = top + 0.22 + r * 1.2;
    L.place(towerMat, lathe([[0.3, 0], [0.22, 0.2], [0.3, 0.32], [0, 0.34]], 20), 0, ty - 0.05, 0);
    L.place(V.crownSteel, kalashGeo(0.55), 0, ty + 0.27, 0);
    L.place(V.crownSteel, panchshool(0.75), 0, ty + 0.8, 0);
    tie = new THREE.Vector3(0, ty, 0).applyMatrix4(local);
  } else {
    const spec: TowerSpec = s.kind === 'pidha'
      ? { half: h * 0.92, height: bodyH, courses: Math.max(6, Math.round(bodyH / 0.85)), n: 16, profile: (t) => 1 - 0.74 * t,
        lip: 0.06, moulding: 0.08, batter: 0.03, seg: 64 }
      : s.kind === 'beehive'
        ? { half: h * 0.95, height: bodyH, courses: Math.max(8, Math.round(bodyH / 0.55)), n: 2.7, profile: (t) => Math.pow(Math.max(0, 1 - Math.pow(t, 2.6) * 0.86), 0.9),
          lip: 0.05, moulding: 0.08, batter: 0.01, seg: 64 }
        : { half: h * 0.9, height: bodyH, courses: Math.max(8, Math.round(bodyH / 0.8)), n: 4.6, profile: (t) => 1 - 0.8 * Math.pow(t, 2.0),
          lip: 0.06, moulding: 0.08, batter: 0.015, seg: 72, bulge: 0.02 };
    const tw = tower(spec);
    topHalf = tw.topHalf;
    L.place(towerMat, tw.geo, 0, top + 0.22, 0);
    const ty = top + 0.22 + bodyH;
    tie = new THREE.Vector3(0, ty + topHalf * 0.35, 0).applyMatrix4(local);
    const cr = Math.max(0.35, topHalf * 1.05);
    // crowns are built in world space at the tower axis
    const cw = new THREE.Vector3(0, ty, 0).applyMatrix4(local);
    crown(B, V, cw.x, cw.y, cw.z, { kind: s.mainCrown ? 'main' : 'kalash', r: cr, finial: s.finial ?? 'panchshool', flags: 4, goldKalash: false }, s.mainCrown ? V.lime : towerMat, s.ry);
  }
  B.offset.copy(saveOff);
  // marigold garland across the door and a few flowers on the sill
  const a = new THREE.Vector3(-dw - 0.1, plinth + dh + 0.1, h + 0.1).applyMatrix4(local);
  const b = new THREE.Vector3(dw + 0.1, plinth + dh + 0.1, h + 0.1).applyMatrix4(local);
  O.strand(a, b, 0.22);
  void g; void root;
  return { tie, top: tie.y, local, topHalf };
}

/** Merger proxy that applies a local→world matrix to everything placed through it. */
class LocalMerger {
  constructor(private B: Merger, private M: THREE.Matrix4) {}
  span(mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.B.add(mat, g, this.M);
  }
  place(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number) {
    this.B.add(mat, geo, this.M.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
  }
  add(mat: THREE.Material, geo: THREE.BufferGeometry) {
    this.B.add(mat, geo, this.M);
  }
}

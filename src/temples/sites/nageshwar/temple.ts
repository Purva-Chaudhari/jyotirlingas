import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { Flag } from '../../engine/kit';
import { Batch, Instances, eave, bandUV, mergeParts } from './batch';
import { textPanel, type NM } from './mats';
import { mainShikhara, smallShikhara, pyramidRoof, ghantaGeo } from './shikhara';
import { nandiMesh } from './nandi';

/**
 * The present Nageshwar temple (built 1996, Gulshan Kumar family trust): a single-storey RCC hall in the
 * Nagara idiom, painted maroon with cream-yellow fluted columns and cusped arches.
 *
 * Axes: +x = east, −z = north. The entrance porch faces west (−x); the garbhagriha with the tall
 * shikhara lies at the east end; the plaza with the colossal Shiva is to the north.
 *
 *   x −24..−18  entrance porch (pyramid roof)            plinth top y = PL
 *   x −18..+10  mandapa hall, 9 bays of 3.11 m a side    big pyramid roof over x −12..+3
 *   x  +0.7..+10 side porches north and south (open arcades)
 *   x  +8.6..+10.7 stair down (7 steps) through the antarala into the garbhagriha
 *   x  +10..+19.6 garbhagriha block (1.5 m walls), floor y = SF, under the main shikhara
 */
export const PL = 0.9;
export const WT = PL + 6.0;
export const RT = WT + 1.55;
export const HALL = { x0: -18, x1: 10, z: 11 };
export const PORCH = { x0: -24, x1: -18, z: 4.5 };
export const SIDE = { x0: 0.67, x1: 10, z0: 11, z1: 14 };
// garbhagriha block (outer) and its octagonal chamber, 16 × 16 ft (4.9 m) per the architect, chamfered corners
export const GARBHA = { x0: 10, x1: 19.6, z: 4.8, ix0: 12.35, ix1: 17.25, iz: 2.45, cx: 14.8 };
export const SF = -0.3;
export const STAIR = { top: 8.6, bot: 10.7, hw: 1.1 };

const BAY = (HALL.x1 - HALL.x0) / 9;

/** Fluted cream column, base at y=0: square base, torus, fluted tapering shaft, echinus, square abacus. */
function columnGeo(h: number, r: number) {
  const prof: [number, number][] = [[r * 1.45, 0.34], [r * 1.5, 0.4], [r * 1.38, 0.47], [r * 1.18, 0.5], [r * 1.1, 0.56]];
  const shaft0 = 0.56, shaft1 = h - 0.68;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push([r * (1.06 - 0.12 * t), shaft0 + (shaft1 - shaft0) * t]);
  }
  prof.push([r * 1.06, shaft1 + 0.02], [r * 1.06, shaft1 + 0.08], [r * 0.95, shaft1 + 0.1], [r * 1.0, shaft1 + 0.2],
    [r * 1.35, shaft1 + 0.36], [r * 1.5, shaft1 + 0.44], [0.001, shaft1 + 0.44]);
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 48);
  // flutes: 16 shallow channels on the shaft only
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > shaft0 + 0.05 && y < shaft1 - 0.02) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 - 0.06 * Math.pow(Math.abs(Math.cos(a * 8)), 0.6);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  const base = new THREE.BoxGeometry(r * 3.2, 0.34, r * 3.2).translate(0, 0.17, 0);
  const abacus = new THREE.BoxGeometry(r * 3.5, h - shaft1 - 0.44, r * 3.5).translate(0, (h + shaft1 + 0.44) / 2, 0);
  return mergeParts([g, base, abacus]);
}

/** Points of a cusped (multifoil) arch intrados from (-hs,0) over to (hs,0). */
function cuspedCurve(hs: number, rise: number, cusps: number, depth: number, N = 64): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI * (1 - t);
    const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * cusps)), 0.55) * depth;
    const r = 1 - cusp / Math.max(hs, rise);
    pts.push([Math.cos(a) * hs * r, Math.max(0, Math.pow(Math.sin(a), 0.85) * rise * r)]);
  }
  return pts;
}

/** Cream arch outline band (cusped inner edge, smooth outer edge with a little ogee tip), facing ±z, base y=0. */
function archRingGeo(span: number, rise: number, band: number, depth: number) {
  const hs = span / 2;
  const s = new THREE.Shape();
  const outer: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = Math.PI * (1 - t);
    const tip = Math.exp(-Math.pow((t - 0.5) / 0.05, 2)) * band * 0.9;
    outer.push([Math.cos(a) * (hs + band), Math.pow(Math.sin(a), 0.85) * (rise + band) + tip]);
  }
  s.moveTo(outer[0][0], 0);
  for (const [x, y] of outer) s.lineTo(x, y);
  s.lineTo(hs + band, 0);
  const inner = cuspedCurve(hs, rise, 7, span * 0.05).reverse();
  for (const [x, y] of inner) s.lineTo(x, y);
  s.lineTo(-hs - band, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Spandrel panel spanning `span` from y=0 to h with the cusped opening cut out (open arcades). */
function archPanelGeo(span: number, h: number, rise: number, depth: number) {
  const hs = span / 2;
  const s = new THREE.Shape();
  s.moveTo(-hs, 0);
  for (const [x, y] of cuspedCurve(hs, rise, 7, span * 0.05)) s.lineTo(x, y);
  s.lineTo(hs, 0);
  s.lineTo(hs, h);
  s.lineTo(-hs, h);
  s.lineTo(-hs, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** semicircular lunette (for the jali windows), radius r, facing +z, base y=0 */
function lunetteGeo(r: number) {
  const g = new THREE.CircleGeometry(r, 24, 0, Math.PI);
  return g;
}

export interface TempleOut {
  group: THREE.Group;
  flag: Flag;
  lights: THREE.PointLight[];
  flames: THREE.Vector3[];
  shikharaTop: number;
}

export function buildTemple(root: THREE.Object3D, K: NM, P: Physics): TempleOut {
  const group = new THREE.Group();
  group.name = 'nageshwar-temple';
  root.add(group);
  const B = new Batch();
  const col = new Instances(columnGeo(4.25, 0.25), K.cream);
  const ghantas = new Instances(ghantaGeo(6), K.roof);
  const oms = new Instances(new THREE.PlaneGeometry(1, 1), K.om);
  const swas = new Instances(new THREE.PlaneGeometry(1, 1), K.swastika);
  const lights: THREE.PointLight[] = [];
  const flames: THREE.Vector3[] = [];
  const COLH = 4.25;
  const ring = archRingGeo(BAY - 0.75, 1.15, 0.16, 0.14);

  // ---------- plinth ----------
  const plinth = (x0: number, x1: number, z0: number, z1: number) => {
    B.span(K.maroon, x0, x1, 0, PL - 0.14, z0, z1);
    B.span(K.cream, x0 - 0.06, x1 + 0.06, PL - 0.14, PL, z0 - 0.06, z1 + 0.06);
    B.span(K.cream, x0 - 0.04, x1 + 0.04, 0, 0.12, z0 - 0.04, z1 + 0.04);
  };
  // the hall plinth, leaving the stairwell open
  plinth(HALL.x0 - 0.6, STAIR.top, -HALL.z - 0.6, HALL.z + 0.6);
  plinth(STAIR.top, HALL.x1, -HALL.z - 0.6, -STAIR.hw - 0.25);
  plinth(STAIR.top, HALL.x1, STAIR.hw + 0.25, HALL.z + 0.6);
  plinth(PORCH.x0 - 0.4, HALL.x0, -PORCH.z - 0.6, PORCH.z + 0.6);
  plinth(SIDE.x0 - 0.6, SIDE.x1 + 0.5, -SIDE.z1 - 0.5, -HALL.z);
  plinth(SIDE.x0 - 0.6, SIDE.x1 + 0.5, HALL.z, SIDE.z1 + 0.5);
  // the garbhagriha block: its plinth is a skirt round the outside of its (sunken) walls
  for (const s of [-1, 1]) plinth(GARBHA.x0, GARBHA.x1 + 0.6, s > 0 ? GARBHA.z : -GARBHA.z - 0.6, s > 0 ? GARBHA.z + 0.6 : -GARBHA.z);
  plinth(GARBHA.x1, GARBHA.x1 + 0.6, -GARBHA.z, GARBHA.z);

  // walkable plinth tops (the stairwell is left open)
  P.floor(group, HALL.x0 - 0.6, STAIR.top, -HALL.z - 0.6, HALL.z + 0.6, PL);
  P.floor(group, STAIR.top, HALL.x1, -HALL.z - 0.6, -STAIR.hw, PL);
  P.floor(group, STAIR.top, HALL.x1, STAIR.hw, HALL.z + 0.6, PL);
  P.floor(group, PORCH.x0 - 0.4, HALL.x0, -PORCH.z - 0.6, PORCH.z + 0.6, PL);
  P.floor(group, SIDE.x0 - 0.6, SIDE.x1 + 0.5, -SIDE.z1 - 0.5, -HALL.z, PL);
  P.floor(group, SIDE.x0 - 0.6, SIDE.x1 + 0.5, HALL.z, SIDE.z1 + 0.5, PL);

  // steps: west porch (full width), and to both side porches
  const steps = (n: number, x0: number, x1: number, z0: number, z1: number, dir: 'x-' | 'z-' | 'z+') => {
    const rise = PL / (n + 1);
    for (let i = 0; i < n; i++) {
      const y = rise * (i + 1);
      const tread = 0.4;
      if (dir === 'x-') {
        const xa = x0 - (n - i) * tread, xb = xa + tread;
        B.span(i % 2 ? K.cream : K.hallMarble, xa, x0, y - rise, y, z0, z1);
        P.floor(group, xa, xb, z0, z1, y);
      } else {
        const s = dir === 'z+' ? 1 : -1;
        const za = z0 + s * (n - i) * tread, zb = za - s * tread;
        B.span(i % 2 ? K.cream : K.hallMarble, x0, x1, y - rise, y, Math.min(z0, za), Math.max(z0, za));
        P.floor(group, x0, x1, Math.min(za, zb), Math.max(za, zb), y);
      }
    }
  };
  steps(4, PORCH.x0 - 0.4, 0, -PORCH.z - 0.6, PORCH.z + 0.6, 'x-');
  steps(4, SIDE.x0 + 1.0, SIDE.x1 - 1.0, -SIDE.z1 - 0.5, 0, 'z-');
  steps(4, SIDE.x0 + 1.0, SIDE.x1 - 1.0, SIDE.z1 + 0.5, 0, 'z+');
  // marble floors (interior and porches)
  const F = PL + 0.008;
  B.span(K.hallMarble, HALL.x0 + 0.5, STAIR.top, PL - 0.02, F, -HALL.z + 0.5, HALL.z - 0.5);
  B.span(K.hallMarble, STAIR.top, HALL.x1, PL - 0.02, F, -HALL.z + 0.5, -STAIR.hw);
  B.span(K.hallMarble, STAIR.top, HALL.x1, PL - 0.02, F, STAIR.hw, HALL.z - 0.5);
  B.span(K.hallMarble, PORCH.x0 - 0.3, HALL.x0, PL - 0.02, F, -PORCH.z - 0.5, PORCH.z + 0.5);
  for (const s of [-1, 1]) B.span(K.hallMarble, SIDE.x0 - 0.4, SIDE.x1 + 0.3, PL - 0.02, F, s > 0 ? HALL.z - 0.5 : -SIDE.z1 - 0.3, s > 0 ? SIDE.z1 + 0.3 : -HALL.z + 0.5);

  // ---------- facade walls ----------
  const T = 0.5;
  /** wall along x at outer face z = zf, outward sign s (±1), bays from x0 with given count, door bays */
  const wallX = (zf: number, s: number, x0: number, n: number, doors: Set<number>, open: Set<number>) => {
    const zc = zf - s * T / 2;
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * BAY;
      // engaged column pilaster
      col.at(x, PL, zf - s * 0.05, 1, 1, 1);
    }
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * BAY, xb = xa + BAY, xm = (xa + xb) / 2;
      if (open.has(i)) continue;
      if (doors.has(i)) {
        const dw = 2.3, dh = 3.6;
        B.span(K.maroon, xa, xm - dw / 2, PL, WT, zc - T / 2, zc + T / 2);
        B.span(K.maroon, xm + dw / 2, xb, PL, WT, zc - T / 2, zc + T / 2);
        B.span(K.maroon, xm - dw / 2, xm + dw / 2, PL + dh, WT, zc - T / 2, zc + T / 2);
        P.solid(xa, PL, zc - T / 2, xm - dw / 2, WT, zc + T / 2);
        P.solid(xm + dw / 2, PL, zc - T / 2, xb, WT, zc + T / 2);
        // cream door frame, both faces
        for (const f of [1, -1]) {
          const zz = zc + f * (T / 2 + 0.04);
          B.span(K.cream, xm - dw / 2 - 0.2, xm - dw / 2, PL, PL + dh + 0.2, zz - 0.05, zz + 0.05);
          B.span(K.cream, xm + dw / 2, xm + dw / 2 + 0.2, PL, PL + dh + 0.2, zz - 0.05, zz + 0.05);
          B.span(K.cream, xm - dw / 2 - 0.3, xm + dw / 2 + 0.3, PL + dh, PL + dh + 0.25, zz - 0.07, zz + 0.07);
        }
        // reveal (jambs) in the wall thickness
        B.span(K.cream, xm - dw / 2, xm + dw / 2, PL + dh - 0.02, PL + dh, zc - T / 2, zc + T / 2);
      } else {
        B.span(K.maroon, xa, xb, PL, WT, zc - T / 2, zc + T / 2);
        P.solid(xa, PL, zc - T / 2, xb, WT, zc + T / 2);
        windowAt(xm, zf, s, 0);
        windowAt(xm, zf - s * T, -s, 0);
      }
      // blind arch ring and lunette jali above the window, outer face
      B.place(K.cream, ring, xm, PL + COLH - 0.05, zf + s * 0.05, 0);
      if (!doors.has(i)) lunette(xm, zf, s);
    }
  };
  /** the same along z, outer face x = xf */
  const wallZ = (xf: number, s: number, z0: number, n: number, bay: number, doors: Set<number>) => {
    const xc = xf - s * T / 2;
    const ringZ = archRingGeo(bay - 0.75, 1.15, 0.16, 0.14);
    for (let i = 0; i <= n; i++) col.at(xf - s * 0.05, PL, z0 + i * bay, 1, 1, 1);
    for (let i = 0; i < n; i++) {
      const za = z0 + i * bay, zb = za + bay, zm = (za + zb) / 2;
      if (doors.has(i)) {
        const dw = 2.4, dh = 3.8;
        B.span(K.maroon, xc - T / 2, xc + T / 2, PL, WT, za, zm - dw / 2);
        B.span(K.maroon, xc - T / 2, xc + T / 2, PL, WT, zm + dw / 2, zb);
        B.span(K.maroon, xc - T / 2, xc + T / 2, PL + dh, WT, zm - dw / 2, zm + dw / 2);
        P.solid(xc - T / 2, PL, za, xc + T / 2, WT, zm - dw / 2);
        P.solid(xc - T / 2, PL, zm + dw / 2, xc + T / 2, WT, zb);
        for (const f of [1, -1]) {
          const xx = xc + f * (T / 2 + 0.04);
          B.span(K.cream, xx - 0.05, xx + 0.05, PL, PL + dh + 0.2, zm - dw / 2 - 0.2, zm - dw / 2);
          B.span(K.cream, xx - 0.05, xx + 0.05, PL, PL + dh + 0.2, zm + dw / 2, zm + dw / 2 + 0.2);
          B.span(K.cream, xx - 0.07, xx + 0.07, PL + dh, PL + dh + 0.25, zm - dw / 2 - 0.3, zm + dw / 2 + 0.3);
        }
      } else {
        B.span(K.maroon, xc - T / 2, xc + T / 2, PL, WT, za, zb);
        P.solid(xc - T / 2, PL, za, xc + T / 2, WT, zb);
        windowAtZ(zm, xf, s);
        windowAtZ(zm, xf - s * T, -s);
        lunetteZ(zm, xf, s);
      }
      B.place(K.cream, ringZ, xf + s * 0.05, PL + COLH - 0.05, zm, Math.PI / 2);
    }
  };
  // window: cream frame, sill and hood, wooden shutters with a small grille
  const shutterGeo = new THREE.BoxGeometry(1.2, 1.65, 0.06);
  const windowAt = (xm: number, zf: number, s: number, _r: number) => {
    const y0 = PL + 1.0, y1 = PL + 2.65;
    const z = zf + s * 0.02;
    B.span(K.cream, xm - 0.78, xm + 0.78, y0 - 0.12, y0, Math.min(z, z + s * 0.16), Math.max(z, z + s * 0.16));
    B.span(K.cream, xm - 0.85, xm + 0.85, y1, y1 + 0.16, Math.min(z, z + s * 0.2), Math.max(z, z + s * 0.2));
    B.span(K.cream, xm - 0.8, xm + 0.8, y1 + 0.16, y1 + 0.28, Math.min(z, z + s * 0.12), Math.max(z, z + s * 0.12));
    for (const sx of [-1, 1]) B.span(K.cream, xm + sx * 0.7 - 0.08, xm + sx * 0.7 + 0.08, y0, y1, Math.min(z, z + s * 0.1), Math.max(z, z + s * 0.1));
    B.place(K.wood, shutterGeo, xm, (y0 + y1) / 2, z + s * 0.02, 0);
    B.place(K.glassDark, new THREE.BoxGeometry(0.5, 0.6, 0.02), xm, (y0 + y1) / 2 + 0.2, z + s * 0.055, 0);
  };
  const windowAtZ = (zm: number, xf: number, s: number) => {
    const y0 = PL + 1.0, y1 = PL + 2.65;
    const x = xf + s * 0.02;
    B.span(K.cream, Math.min(x, x + s * 0.16), Math.max(x, x + s * 0.16), y0 - 0.12, y0, zm - 0.78, zm + 0.78);
    B.span(K.cream, Math.min(x, x + s * 0.2), Math.max(x, x + s * 0.2), y1, y1 + 0.16, zm - 0.85, zm + 0.85);
    for (const sz of [-1, 1]) B.span(K.cream, Math.min(x, x + s * 0.1), Math.max(x, x + s * 0.1), y0, y1, zm + sz * 0.7 - 0.08, zm + sz * 0.7 + 0.08);
    B.place(K.wood, shutterGeo, x + s * 0.02, (y0 + y1) / 2, zm, Math.PI / 2);
  };
  const lunGeo = lunetteGeo(0.62);
  const lunRing = new THREE.TorusGeometry(0.68, 0.07, 6, 24, Math.PI);
  const jali: THREE.BufferGeometry[] = [];
  const lunette = (xm: number, zf: number, s: number) => {
    const y = PL + 3.35;
    const g = lunGeo.clone();
    if (s < 0) g.rotateY(Math.PI);
    g.translate(xm, y, zf + s * 0.03);
    jali.push(g);
    B.place(K.cream, lunRing, xm, y, zf + s * 0.05, 0);
    B.span(K.cream, xm - 0.82, xm + 0.82, y - 0.08, y, Math.min(zf, zf + s * 0.14), Math.max(zf, zf + s * 0.14));
    // dark recess behind the grille
    B.place(K.dark, new THREE.CircleGeometry(0.6, 16, 0, Math.PI).rotateY(s < 0 ? Math.PI : 0), xm, y, zf + s * 0.005, 0);
  };
  const lunetteZ = (zm: number, xf: number, s: number) => {
    const y = PL + 3.35;
    const g = lunGeo.clone().rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(xf + s * 0.03, y, zm);
    jali.push(g);
    B.place(K.cream, lunRing, xf + s * 0.05, y, zm, Math.PI / 2);
    B.place(K.dark, new THREE.CircleGeometry(0.6, 16, 0, Math.PI).rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2), xf + s * 0.005, y, zm, 0);
  };

  // north and south walls of the hall: bays 0..8; door in bay 7 opens on the side porch
  wallX(-HALL.z, -1, HALL.x0, 9, new Set([7]), new Set());
  wallX(HALL.z, 1, HALL.x0, 9, new Set([7]), new Set());
  // west wall: 7 bays across 22 m, main door in the centre bay (opening on the porch)
  wallZ(HALL.x0, -1, -HALL.z, 7, (HALL.z * 2) / 7, new Set([3]));
  // east wall of the hall up to the garbhagriha block (two short returns)
  B.span(K.maroon, HALL.x1 - T, HALL.x1, PL, WT, -HALL.z, -GARBHA.z);
  B.span(K.maroon, HALL.x1 - T, HALL.x1, PL, WT, GARBHA.z, HALL.z);
  P.solid(HALL.x1 - T, PL, -HALL.z, HALL.x1, WT, -GARBHA.z);
  P.solid(HALL.x1 - T, PL, GARBHA.z, HALL.x1, WT, HALL.z);

  // ---------- open porches ----------
  const arcade = (pts: [number, number][], y: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const span = Math.hypot(x1 - x0, z1 - z0);
      const ang = -Math.atan2(z1 - z0, x1 - x0);
      const panel = archPanelGeo(span - 0.5, WT - y - COLH, 1.1, 0.42);
      // panel spans from the capital to the eave
      B.place(K.maroon, panel.translate(0, 0, 0), (x0 + x1) / 2, y + COLH, (z0 + z1) / 2, ang);
      const rg = archRingGeo(span - 0.75, 1.15, 0.16, 0.5);
      B.place(K.creamTwo, rg, (x0 + x1) / 2, y + COLH - 0.02, (z0 + z1) / 2, ang);
      B.place(K.maroon, new THREE.BoxGeometry(span, 0.25, 0.44), (x0 + x1) / 2, WT - 0.25, (z0 + z1) / 2, ang);
    }
    for (const [x, z] of pts) {
      col.at(x, PL, z, 1, 1, 1);
      P.solid(x - 0.38, PL, z - 0.38, x + 0.38, WT, z + 0.38);
    }
  };
  // west entrance porch: 4 columns across the front, 2 down each side
  arcade([[PORCH.x0, -PORCH.z], [PORCH.x0, -PORCH.z / 3], [PORCH.x0, PORCH.z / 3], [PORCH.x0, PORCH.z]], PL);
  arcade([[PORCH.x0, -PORCH.z], [PORCH.x0 + 3, -PORCH.z], [HALL.x0, -PORCH.z]], PL);
  arcade([[PORCH.x0, PORCH.z], [PORCH.x0 + 3, PORCH.z], [HALL.x0, PORCH.z]], PL);
  // side porches (north and south), three open bays each with return bays to the wall
  for (const s of [-1, 1]) {
    const zf = s * SIDE.z1;
    arcade([0, 1, 2, 3].map((i) => [SIDE.x0 + i * BAY, zf] as [number, number]), PL);
    arcade([[SIDE.x0, zf], [SIDE.x0, s * HALL.z]], PL);
    arcade([[SIDE.x1, zf], [SIDE.x1, s * HALL.z]], PL);
  }
  // porch ceilings / roof slabs
  B.span(K.cream, PORCH.x0 - 0.3, HALL.x0, WT - 0.3, WT, -PORCH.z - 0.3, PORCH.z + 0.3);
  B.span(K.cream, SIDE.x0 - 0.3, SIDE.x1 + 0.3, WT - 0.3, WT, -SIDE.z1 - 0.3, -HALL.z);
  B.span(K.cream, SIDE.x0 - 0.3, SIDE.x1 + 0.3, WT - 0.3, WT, HALL.z, SIDE.z1 + 0.3);

  // ---------- cornice stack: moulding, chhajja, meander frieze, eave, parapet, coping ----------
  const meander: THREE.BufferGeometry[] = [];
  const parapet: THREE.BufferGeometry[] = [];
  const cornice = (cx: number, cz: number, w: number, d: number) => {
    B.box(K.cream, w + 0.24, 0.16, d + 0.24, cx, WT, cz);
    eave(B, K.roof, cx, cz, w + 0.24, d + 0.24, WT + 0.16, 0.85, 0.42, 0.1);
    const m = new THREE.BoxGeometry(w + 0.1, 0.5, d + 0.1).translate(cx, WT + 0.16 + 0.25, cz);
    meander.push(bandUV(m, WT + 0.16, 0.5, 0.75));
    B.box(K.cream, w + 0.3, 0.1, d + 0.3, cx, WT + 0.66, cz);
    eave(B, K.roof, cx, cz, w + 0.3, d + 0.3, WT + 0.76, 0.35, 0.2, 0.06);
    const pp = new THREE.BoxGeometry(w, 0.7, d).translate(cx, WT + 0.76 + 0.35, cz);
    parapet.push(bandUV(pp, WT + 0.76, 0.7, 0.7));
    B.box(K.cream, w + 0.14, 0.09, d + 0.14, cx, WT + 1.46, cz);
    // flat roof slab (hidden) so the interior is closed above
    B.box(K.maroon, w - 0.1, 0.3, d - 0.1, cx, RT - 0.4, cz);
  };
  cornice((HALL.x0 + HALL.x1) / 2, 0, HALL.x1 - HALL.x0, HALL.z * 2);
  cornice((PORCH.x0 + HALL.x0) / 2, 0, HALL.x0 - PORCH.x0 + 0.01, PORCH.z * 2);
  cornice((SIDE.x0 + SIDE.x1) / 2, -(SIDE.z0 + SIDE.z1) / 2, SIDE.x1 - SIDE.x0, SIDE.z1 - SIDE.z0 + 0.02);
  cornice((SIDE.x0 + SIDE.x1) / 2, (SIDE.z0 + SIDE.z1) / 2, SIDE.x1 - SIDE.x0, SIDE.z1 - SIDE.z0 + 0.02);
  // hall ceiling (interior): cream slab with a recessed maroon-bordered coffer grid
  B.span(K.cream, HALL.x0 + 0.5, HALL.x1 - 0.5, PL + 5.55, WT, -HALL.z + 0.5, HALL.z - 0.5);
  for (let i = 0; i < 6; i++) {
    const x = HALL.x0 + 2.5 + i * 4.3;
    B.span(K.maroon, x - 0.12, x + 0.12, PL + 5.3, PL + 5.55, -HALL.z + 0.5, HALL.z - 0.5);
  }
  for (const z of [-6.2, -2, 2, 6.2]) B.span(K.maroon, HALL.x0 + 0.5, HALL.x1 - 0.5, PL + 5.3, PL + 5.55, z - 0.12, z + 0.12);
  // central lotus medallion under the big pyramid
  B.lathe(K.cream, [[0.001, 0], [1.6, 0], [1.4, -0.12], [0.9, -0.2], [0.4, -0.32], [0.001, -0.36]], -4.5, PL + 5.3, 0, 32);
  // interior: inner wall dado band (maroon over cream plaster) — inner faces of the walls
  B.span(K.cream, HALL.x0 + 0.5, HALL.x1 - 0.5, PL, PL + 5.3, -HALL.z + 0.5, -HALL.z + 0.52);
  B.span(K.cream, HALL.x0 + 0.5, HALL.x1 - 0.5, PL, PL + 5.3, HALL.z - 0.52, HALL.z - 0.5);

  // hall columns inside: two rows
  for (const z of [-5.2, 5.2]) for (const x of [-13.5, -9.0, -4.5, 0, 4.5]) {
    col.at(x, PL, z, 1, 5.3 / COLH, 1);
    P.solid(x - 0.38, PL, z - 0.38, x + 0.38, PL + 5.3, z + 0.38);
  }

  // ---------- garbhagriha block (outer) ----------
  const G = GARBHA;
  // walls: 1.5 m thick masonry; doorway on the west (from the stair)
  B.span(K.maroon, G.x0, G.x1, PL, WT + 0.2, -G.z, -G.iz);
  B.span(K.maroon, G.x0, G.x1, PL, WT + 0.2, G.iz, G.z);
  B.span(K.maroon, G.ix1, G.x1, PL, WT + 0.2, -G.iz, G.iz);
  B.span(K.maroon, G.x0, G.ix0, PL, WT + 0.2, -G.iz, -STAIR.hw);
  B.span(K.maroon, G.x0, G.ix0, PL, WT + 0.2, STAIR.hw, G.iz);
  B.span(K.maroon, G.x0, G.ix0, PL + 2.2, WT + 0.2, -STAIR.hw, STAIR.hw);
  // below the plinth (the sanctum sits below the hall floor): walls down to SF
  B.span(K.maroon, G.x0, G.x1, SF - 0.3, PL, -G.z, -G.iz);
  B.span(K.maroon, G.x0, G.x1, SF - 0.3, PL, G.iz, G.z);
  B.span(K.maroon, G.ix1, G.x1, SF - 0.3, PL, -G.iz, G.iz);
  B.span(K.maroon, G.x0, G.ix0, SF - 0.3, PL, -G.iz, -STAIR.hw);
  B.span(K.maroon, G.x0, G.ix0, SF - 0.3, PL, STAIR.hw, G.iz);
  P.solid(G.x0, SF, -G.z, G.x1, WT, -G.iz);
  P.solid(G.x0, SF, G.iz, G.x1, WT, G.z);
  P.solid(G.ix1, SF, -G.iz, G.x1, WT, G.iz);
  P.solid(G.x0, SF, -G.iz, G.ix0, WT, -STAIR.hw);
  P.solid(G.x0, SF, STAIR.hw, G.ix0, WT, G.iz);
  // exterior wall articulation of the garbhagriha: cream-framed niches (devakoshthas) on N, S, E
  for (const [nx, nz] of [[0, -1], [0, 1], [1, 0]] as const) {
    const cx = nx ? G.x1 : G.cx, cz = nz ? nz * G.z : 0;
    const ry = nx ? Math.PI / 2 : nz > 0 ? 0 : Math.PI;
    const ox = nx * 0.06, oz = nz * 0.06;
    B.place(K.creamTwo, archRingGeo(1.6, 0.9, 0.18, 0.16), cx + ox, PL + 2.6, cz + oz, ry);
    B.place(K.dark, new THREE.BoxGeometry(1.5, 2.4, 0.04), cx + nx * 0.02, PL + 1.2 + 1.2, cz + nz * 0.02, ry);
    for (const u of [-0.95, 0.95]) {
      const px = cx + (nz ? u : 0) + nx * 0.12, pz = cz + (nx ? u : 0) + nz * 0.12;
      B.box(K.cream, 0.24, 3.5, 0.24, px, PL, pz);
    }
    B.box(K.cream, nx ? 0.4 : 2.3, 0.16, nx ? 2.3 : 0.4, cx + nx * 0.1, PL + 0.6, cz + nz * 0.1);
    // pilasters at the corners of the garbhagriha block
  }
  for (const [x, z] of [[G.x1, -G.z], [G.x1, G.z], [G.x0 + 0.4, -G.z], [G.x0 + 0.4, G.z]]) col.at(x, PL, z, 1.2, 1.4, 1.2);
  // garbhagriha cornice
  B.box(K.cream, G.x1 - G.x0 + 0.3, 0.18, G.z * 2 + 0.3, G.cx, WT, 0);
  eave(B, K.roof, G.cx, 0, G.x1 - G.x0 + 0.3, G.z * 2 + 0.3, WT + 0.18, 0.8, 0.4, 0.1);
  const gm = new THREE.BoxGeometry(G.x1 - G.x0 + 0.1, 0.5, G.z * 2 + 0.1).translate(G.cx, WT + 0.18 + 0.25, 0);
  meander.push(bandUV(gm, WT + 0.18, 0.5, 0.75));
  B.box(K.cream, G.x1 - G.x0 + 0.3, 0.1, G.z * 2 + 0.3, G.cx, WT + 0.68, 0);

  // ---------- roofs ----------
  // big samvarana over the mandapa
  pyramidRoof(B, K, ghantas, oms, -4.5, 0, RT - 0.1, 15.5, 15.5, 2.0, 8.4);
  // entrance porch roof
  pyramidRoof(B, K, ghantas, oms, (PORCH.x0 + HALL.x0) / 2 - 0.3, 0, RT - 0.1, 6.2, 8.6, 1.5, 4.6);
  // antarala roof in front of the main spire
  pyramidRoof(B, K, ghantas, oms, 6.6, 0, RT - 0.1, 5.2, 6.6, 1.2, 3.6);
  // side porch roofs: low pyramids
  for (const s of [-1, 1]) pyramidRoof(B, K, ghantas, oms, (SIDE.x0 + SIDE.x1) / 2, s * (SIDE.z0 + SIDE.z1) / 2, RT - 0.1, 8.0, 2.6, 0.5, 1.6);
  // the two small shikharas flanking the porch roof (swastika toward the front, west)
  for (const s of [-1, 1]) smallShikhara(B, K, swas, -14.6, s * 7.4, RT - 0.1, 1.65, 6.4, -Math.PI / 2);
  // corner pavilions on the hall's east corners: small pyramids
  for (const s of [-1, 1]) pyramidRoof(B, K, ghantas, oms, 6.6, s * 8.2, RT - 0.1, 4.6, 4.6, 1.1, 3.0);
  // main shikhara over the garbhagriha
  // 110 ft (33.5 m) overall to the kalash top, per the architect
  const ms = mainShikhara(B, K, G.cx, 0, WT + 0.78, 3.6, 20.0);
  ms.gav.flush(group);
  ms.mini.flush(group);

  // dhwaja
  const flag = new Flag(group, K.steel, K.flag, G.cx, ms.top - 0.1, 0, 3.4);

  // ---------- flush ----------
  B.flush(group);
  col.flush(group);
  ghantas.flush(group);
  oms.flush(group, false);
  swas.flush(group, false);
  const meanderMesh = new THREE.Mesh(mergeUV(meander), K.meander);
  const parapetMesh = new THREE.Mesh(mergeUV(parapet), K.parapet);
  for (const m of [meanderMesh, parapetMesh]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  const jaliMesh = new THREE.Mesh(mergeUVPlanar(jali), K.jali);
  jaliMesh.receiveShadow = true;
  group.add(jaliMesh);

  // Nandi on a low marble plinth in the hall, gazing down the stair toward the linga
  const nandi = nandiMesh(K.darkStone);
  nandi.scale.setScalar(0.55);
  nandi.rotation.y = -Math.PI / 2;
  nandi.position.set(5.4, PL + 0.32, 0);
  group.add(nandi);
  const NB = new Batch();
  NB.span(K.marbleIn, 4.6, 6.2, PL, PL + 0.3, -0.5, 0.5);
  NB.span(K.zari, 4.58, 6.22, PL + 0.26, PL + 0.3, -0.52, 0.52);
  // big brass bells hung from the ceiling at the head of the stair and at the west door
  const bellG = new THREE.LatheGeometry([[0.001, 0.32], [0.07, 0.31], [0.11, 0.2], [0.16, 0.04], [0.18, 0], [0.001, 0.03]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  for (const [bx, bz] of [[8.0, -1.0], [8.0, 1.0], [-16.8, 0]] as const) {
    NB.place(K.brass, bellG, bx, PL + 3.6, bz);
    NB.span(K.brass, bx - 0.006, bx + 0.006, PL + 3.9, PL + 5.55, bz - 0.006, bz + 0.006);
  }
  NB.flush(group);
  P.solid(4.6, PL, -0.55, 6.2, PL + 1.2, 0.55);

  // hall: warm lamps (zone-switched in index.ts) and hanging brass bells over the door
  // ---------- hall furnishing: painted ceiling panels, chandeliers, signboards and pictures ----------
  const HB = new Batch();
  const cy = PL + 5.3;
  // each coffer between the maroon beams gets a cream panel with a gilt border and a painted lotus medallion
  const xs = [-17.5, ...Array.from({ length: 6 }, (_, i) => HALL.x0 + 2.5 + i * 4.3), 9.5];
  const zs = [-10.5, -6.2, -2, 2, 6.2, 10.5];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i] + 0.25, x1 = xs[i + 1] - 0.25, z0 = zs[j] + 0.25, z1 = zs[j + 1] - 0.25;
    if (x1 - x0 < 0.8) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (Math.abs(cx + 4.5) < 2 && Math.abs(cz) < 2) continue; // the central lotus
    HB.span(K.zari, x0, x1, cy + 0.2, cy + 0.215, z0, z1);
    HB.span(K.ceilPanel, x0 + 0.08, x1 - 0.08, cy + 0.205, cy + 0.225, z0 + 0.08, z1 - 0.08);
    HB.lathe(K.zari, [[0.001, 0], [0.42, 0], [0.32, -0.04], [0.12, -0.07], [0.001, -0.08]], cx, cy + 0.2, cz, 16);
  }
  // brass-and-glass chandeliers hung on chains along the nave
  const chand = new Instances(chandelierGeo(), K.brass);
  const glow = new Instances(new THREE.SphereGeometry(0.07, 10, 8), K.bulb);
  for (const x of [-14, -9, -4.5, 0, 4.0]) for (const z of x === -4.5 ? [-3.4, 3.4, 0] : [0]) {
    chand.at(x, PL + 3.9, z);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; glow.at(x + Math.cos(a) * 0.55, PL + 4.08, z + Math.sin(a) * 0.55); }
    HB.span(K.brass, x - 0.01, x + 0.01, PL + 4.5, cy + 0.2, z - 0.01, z + 0.01);
  }
  chand.flush(group, false);
  glow.flush(group, false);
  // signboards (as at the sanctum door) and framed pictures on the inner walls
  const signs = [
    ['मंदिर में धोती', 'पहनकर प्रवेश कीजिए'], ['फोटो मूवी', 'लेना मना है'], ['अखंड ज्योत में', 'घी दान दीजिए'], ['मंदिर के नियमों', 'का पालन करें'],
  ];
  signs.forEach(([l1, l2], i) => {
    const mat = textPanel([
      { text: l1, font: 'bold 64px "Noto Sans Devanagari", Martel, serif', color: '#b0121a', y: 110 },
      { text: l2, font: 'bold 64px "Noto Sans Devanagari", Martel, serif', color: '#b0121a', y: 200 },
    ], 512, 300, '#fbf4e2');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), mat);
    const z = i % 2 ? HALL.z - 0.55 : -HALL.z + 0.55;
    m.position.set(-12 + i * 5.5, PL + 2.3, z);
    m.rotation.y = i % 2 ? Math.PI : 0;
    group.add(m);
    HB.span(K.zari, m.position.x - 0.66, m.position.x + 0.66, PL + 1.9, PL + 2.7, z - Math.sign(z) * 0.0 - 0.015, z + 0.015);
  });
  const pic = pictureMaterial();
  for (let i = 0; i < 6; i++) {
    const z = i % 2 ? HALL.z - 0.55 : -HALL.z + 0.55;
    const x = -14.5 + i * 4.6 + 2.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), pic[i % pic.length]);
    m.position.set(x, PL + 3.6, z - Math.sign(z) * 0.02);
    m.rotation.y = z > 0 ? Math.PI : 0;
    group.add(m);
    HB.span(K.zari, x - 0.58, x + 0.58, PL + 2.88, PL + 4.32, z - 0.02, z + 0.02);
  }
  HB.flush(group, false);

  // red runners down the hall to the stair head
  const run = new Batch();
  run.add(K.red, new THREE.PlaneGeometry(22.0, 1.3).rotateX(-Math.PI / 2).translate(-6.6, PL + 0.014, 0));
  for (const z of [-3.4, 3.4]) run.add(K.red, new THREE.PlaneGeometry(24.0, 0.9).rotateX(-Math.PI / 2).translate(-5.4, PL + 0.014, z));
  run.flush(group, false);
  // the hall is day-lit through its big windows and doors: bright, neutral-warm fills
  for (const [x, z] of [[-12, 0], [-3, 0], [5, 0]] as const) {
    const l = new THREE.PointLight(0xfff0dc, 34, 18, 1.4);
    l.position.set(x, PL + 4.6, z);
    group.add(l);
    lights.push(l);
  }
  return { group, flag, lights, flames, shikharaTop: ms.top };
}

function mergeUV(list: THREE.BufferGeometry[]) {
  const parts = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    return n;
  });
  // all have position/normal/uv
  return mergeKeep(parts);
}

function mergeUVPlanar(list: THREE.BufferGeometry[]) {
  // lunette grilles: UVs from the circle geometry are 0..1 — scale so the hole pattern is ~0.16 m
  const parts = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    const uv = n.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.24 / 0.16 * 0.16, uv.getY(i) * 1.24 / 0.16 * 0.16);
    return n;
  });
  return mergeKeep(parts);
}

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function mergeKeep(parts: THREE.BufferGeometry[]) {
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
  return mergeGeometries(parts, false)!;
}

/** a brass chandelier: a central stem, two rings of arms with cups (the bulbs are a separate emissive mesh) */
function chandelierGeo() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8).translate(0, 0.35, 0));
  parts.push(new THREE.SphereGeometry(0.12, 12, 8).scale(1, 1.4, 1).translate(0, 0.0, 0));
  parts.push(new THREE.TorusGeometry(0.55, 0.018, 6, 32).rotateX(Math.PI / 2).translate(0, 0.12, 0));
  parts.push(new THREE.TorusGeometry(0.3, 0.015, 6, 24).rotateX(Math.PI / 2).translate(0, 0.4, 0));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push(new THREE.CylinderGeometry(0.045, 0.02, 0.08, 8).translate(Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.55));
    parts.push(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4).rotateZ(Math.PI / 2).rotateY(-a).translate(Math.cos(a) * 0.28, 0.12, Math.sin(a) * 0.28));
    // hanging crystal drops
    parts.push(new THREE.OctahedronGeometry(0.03).scale(1, 2, 1).translate(Math.cos(a + 0.4) * 0.45, -0.02, Math.sin(a + 0.4) * 0.45));
  }
  return mergeParts(parts);
}

/** framed devotional pictures without figures: a temple silhouette at dusk, ॐ on saffron, a lotus, a trishul */
function pictureMaterial() {
  const mk = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 332;
    const g = c.getContext('2d')!;
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 });
  };
  return [
    mk((g) => {
      const gr = g.createLinearGradient(0, 0, 0, 332); gr.addColorStop(0, '#f6a43a'); gr.addColorStop(1, '#8a2a14'); g.fillStyle = gr; g.fillRect(0, 0, 256, 332);
      g.fillStyle = '#3a0f08'; g.beginPath(); g.moveTo(128, 60); g.quadraticCurveTo(170, 120, 165, 230); g.lineTo(91, 230); g.quadraticCurveTo(86, 120, 128, 60); g.fill();
      g.fillRect(40, 200, 176, 60); g.fillRect(20, 255, 216, 77);
    }),
    mk((g) => { g.fillStyle = '#f26a10'; g.fillRect(0, 0, 256, 332); g.fillStyle = '#fff3c8'; g.font = 'bold 200px "Noto Sans Devanagari", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ॐ', 128, 180); }),
    mk((g) => {
      g.fillStyle = '#123c5a'; g.fillRect(0, 0, 256, 332);
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f08cb4' : '#e8508a'; g.beginPath(); g.ellipse(128 + Math.cos(k * 0.785) * 40, 180 + Math.sin(k * 0.785) * 40, 24, 50, k * 0.785 + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f7d04a'; g.beginPath(); g.arc(128, 180, 22, 0, Math.PI * 2); g.fill();
    }),
    mk((g) => {
      g.fillStyle = '#5a1a12'; g.fillRect(0, 0, 256, 332); g.strokeStyle = '#f2c44a'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(128, 60); g.lineTo(128, 300); g.moveTo(80, 70); g.quadraticCurveTo(80, 150, 128, 150); g.quadraticCurveTo(176, 150, 176, 70); g.stroke();
    }),
  ];
}

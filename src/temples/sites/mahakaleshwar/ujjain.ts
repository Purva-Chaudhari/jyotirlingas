import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scanMaterial, waterNormals } from '../../engine/materials';
import type { Physics } from '../../engine/kit';
import { loadOsm, projector, pointInRing, type XZ, type OsmData } from './osm';
import { buildTown, streetLife, clipRing } from './town';
import { buildMahakalLok, lokMats, lakesideGardens, CORRIDOR, LAKE_LINK, PROMENADE, PLAZA, KAMAL_KUND } from './mahakallok';
import { buildHarsiddhi, HARSIDDHI } from './landmarks';
import { canopyTrees } from './surroundings';
import { mergeStatic, cameraProbe } from './optimize';
import type { CrowdSpots } from './crowd';

/**
 * Real Ujjain round Mahakaleshwar: the town from OpenStreetMap (public/data/osm/mahakaleshwar.json,
 * © OpenStreetMap contributors, ODbL), Rudra Sagar and the Shipra from their OSM outlines, Shri Mahakal
 * Lok along its real line, and the Harsiddhi temple with its deepstambhas.
 *
 * Alignment: the data's metres east/north of (23.1828 N, 75.7682 E) are moved so that OSM's outline of
 * the temple (way 1162958993, building=temple) is centred on the model's temple at the origin; with that,
 * OSM's Kotitirtha pond falls within 2.5 m of the model's kund (-34, -14) and the precinct outline (way
 * 373720479) spans z -46 … 37 against the model's courtyard z -44 … 40. Model +x = east, +z = south.
 */
export const ALIGN = { E0: 4.5, N0: 31 };
export const project = projector(ALIGN.E0, ALIGN.N0);

/** the walkable lines outside the precinct: crowd and street clutter keep off them */
export const WALKS: XZ[][] = [CORRIDOR, LAKE_LINK, PROMENADE, [[-2, -64], [-2, -44]], [[90, -51], [94, -44], [98, -19], [98, 28], [100, 75]]];

function segDist(px: number, pz: number, a: XZ, b: XZ) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
export const nearWalk = (x: number, z: number, r: number) => WALKS.some((w) => w.some((p, i) => i > 0 && segDist(x, z, w[i - 1], p) < r));

const rectRing = (x0: number, x1: number, z0: number, z1: number): XZ[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** a polygon round a polyline, `r` either side (for keep-out areas along a walk) */
function buffer(line: XZ[], r: number): XZ[] {
  const left: XZ[] = [], right: XZ[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    left.push([line[i][0] - dz * r, line[i][1] + dx * r]);
    right.push([line[i][0] + dz * r, line[i][1] - dx * r]);
  }
  // extend the ends a little
  return [...left, ...right.reverse()];
}

export interface Ujjain { update(t: number): void }

export function buildUjjain(root: THREE.Group, near: THREE.Group, P: Physics, pending: Promise<unknown>[] | undefined,
  court: { x0: number; x1: number; z0: number; z1: number }, cs: CrowdSpots): Ujjain {
  // ---------------- Mahakal Lok (built now: its line is known) and Harsiddhi
  const L = lokMats(pending);
  const lok = buildMahakalLok(root, near, P, L);
  const harsiddhi = new THREE.Group();
  harsiddhi.name = 'harsiddhi';
  root.add(harsiddhi);
  buildHarsiddhi(harsiddhi, P);
  mergeStatic(lok.far, new Set(P.floors));

  // walkable: the road along the north of the precinct (the way from Mahakal Lok's lakefront to the
  // north gate) and the paved lane down the precinct's east side
  for (let i = 1; i < PROMENADE.length; i++) {
    const [ax, az] = PROMENADE[i - 1], [bx, bz] = PROMENADE[i];
    if (Math.abs(bx - ax) > Math.abs(bz - az)) P.floor(near, Math.min(ax, bx) - 1, Math.max(ax, bx) + 1, Math.min(az, bz) - 4.6, Math.max(az, bz) + 4.6, 0.02);
  }
  P.floor(near, 84, 96, -57, -44, 0.02);
  P.floor(near, 92, 104, -46, 78, 0.02);
  P.floor(near, -146, -128, -64, 2, 0.02);

  // pilgrims: along the corridor and its statues, at Kamal Kund, and walking the road to the north gate
  for (const c of lok.crowd) {
    cs.add(c.x, 0, c.z, c.ry);
    const l = cs.list[cs.list.length - 1];
    l.queue = cs.rnd() < 0.55 ? 'walk' : cs.rnd() < 0.5 ? 'namaste' : 'stand';
  }
  for (let i = 0; i < 70; i++) {
    const x = -130 + cs.rnd() * 215, z = -62.5 + cs.rnd() * 8;
    if (Math.abs(x + 2) < 3.5 || (x > -14 && x < 10 && z > -60)) continue;
    cs.add(x, 0, z, cs.rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    cs.list[cs.list.length - 1].queue = cs.rnd() < 0.6 ? 'walk' : cs.rnd() < 0.5 ? 'bag' : 'thali';
  }
  for (let i = 0; i < 28; i++) {
    const z = -40 + cs.rnd() * 112, x = 98 + (cs.rnd() < 0.5 ? -1 : 1) * (1.4 + cs.rnd() * 2.2);
    cs.add(x, 0, z, cs.rnd() < 0.5 ? 0 : Math.PI);
    cs.list[cs.list.length - 1].queue = cs.rnd() < 0.6 ? 'walk' : 'stand';
  }

  // ---------------- far parts drawn only from within ~650 m (fog hides them beyond)
  const harC = new THREE.Vector3(HARSIDDHI.x, 0, HARSIDDHI.z);
  const farLine = CORRIDOR.filter((_, i) => i >= 4).concat([[KAMAL_KUND.x, KAMAL_KUND.z], [222, 774]]);
  let water: THREE.MeshStandardMaterial | null = null;
  cameraProbe(root, (p) => {
    // the corridor's southern two thirds, Kamal Kund and the gates: drawn within 300 m (hidden from the north gate)
    lok.far.visible = p.y > -1 && farLine.some((q, i) => i > 0 && segDist(p.x, p.z, farLine[i - 1], q) < 300);
    harsiddhi.visible = p.distanceTo(harC) < 760 && p.y > -1;
  });

  // ---------------- the town, the lake and the streets, from the OSM data
  const asphalt = scanMaterial('asphalt_02', 4, { tint: 0x8a8580, normalScale: 0.6 });
  const paver = scanMaterial('pavement_01', 2.2, { tint: 0xc4b4a4, normalScale: 0.5 });
  const ground = scanMaterial('dirty_concrete', 5, { tint: 0xb4ada0, normalScale: 0.5, roughness: 0.95 });
  pending?.push(asphalt.loaded, paver.loaded, ground.loaded);
  const town = new THREE.Group();
  town.name = 'ujjain-town';
  root.add(town);
  const done = loadOsm('mahakaleshwar').then((data) => {
    if (!data) { fallbackGround(town, ground.material, court); return; }
    buildFromOsm(data, town, P, court, { asphalt: asphalt.material, paver: paver.material, ground: ground.material }, (m) => { water = m; });
  });
  pending?.push(done);
  return {
    update(t: number) {
      const w = water as THREE.MeshStandardMaterial | null;
      if (w?.normalMap) w.normalMap.offset.set(t * 0.004, t * 0.0025);
    },
  };
}

function fallbackGround(g: THREE.Group, mat: THREE.Material, court: { x0: number; x1: number; z0: number; z1: number }) {
  const land = new THREE.Shape([new THREE.Vector2(-900, -900), new THREE.Vector2(900, -900), new THREE.Vector2(900, 900), new THREE.Vector2(-900, 900)]);
  land.holes.push(new THREE.Path([new THREE.Vector2(court.x0, -court.z0), new THREE.Vector2(court.x0, -court.z1), new THREE.Vector2(court.x1, -court.z1), new THREE.Vector2(court.x1, -court.z0)]));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(land).rotateX(-Math.PI / 2), mat);
  m.position.y = -0.05;
  m.receiveShadow = true;
  g.add(m);
}

function buildFromOsm(data: OsmData, g: THREE.Group, P: Physics, court: { x0: number; x1: number; z0: number; z1: number },
  mats: { asphalt: THREE.Material; paver: THREE.Material; ground: THREE.Material }, setWater: (m: THREE.MeshStandardMaterial) => void) {
  const lokArea = data.areas.filter((a) => /Mahakal Lok/i.test(a.name ?? '')).map((a) => a.p.map(project));
  const courtRing = rectRing(court.x0, court.x1, court.z0, court.z1);
  const keepOut: XZ[][] = [
    rectRing(court.x0 - 2.5, court.x1 + 2.5, court.z0 - 1.6, court.z1 + 2.5),
    rectRing(-18, 15, -64, -44), // the forecourt of the north gate (and its carved wall)
    ...lokArea,
    buffer(CORRIDOR, CORRIDOR_HALF), buffer(LAKE_LINK, 9), PLAZA,
    rectRing(-190, -128, -53, 62), // the lakefront gardens between the path and Rudra Sagar
    rectRing(HARSIDDHI.x - 30, HARSIDDHI.x + 40, HARSIDDHI.z - 20, HARSIDDHI.z + 52), // its compound and the chowk before it
    rectRing(-128, -65, -44, 6), // Mahakal Lok's plaza by the precinct's west side
    // the island in Rudra Sagar (a garden and small shrines, reached by a causeway)
    Array.from({ length: 24 }, (_, i) => [ISLAND.x + Math.cos(i / 24 * Math.PI * 2) * ISLAND.r, ISLAND.z + Math.sin(i / 24 * Math.PI * 2) * ISLAND.r] as XZ),
  ];
  const town = buildTown(data, {
    project, half: 900, keepOut, groundHoles: [courtRing], maxR: 760,
    paverNear: [{ x: 0, z: 0, r: 175 }],
    detail: { x: 0, z: 0, r: 200 },
    skipBuilding: (ring) => ring.some(([x, z]) => x > court.x0 && x < court.x1 && z > court.z0 && z < court.z1),
    materials: mats, seed: 2024,
  });
  g.add(town.group);

  // Rudra Sagar, Kamal Kund and the Shipra: green, still water a metre below the banks, stone embankments
  {
    const wn = waterNormals();
    wn.repeat.set(1 / 9, 1 / 9);
    const wm = new THREE.MeshStandardMaterial({ color: 0x3e5a34, roughness: 0.14, metalness: 0.05, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35) });
    setWater(wm);
    const bank = scanMaterial('stone_wall_04', 2, { tint: 0xb4a690, normalScale: 0.8 });
    const shapes: THREE.BufferGeometry[] = [], walls: number[] = [], wallN: number[] = [], wallUV: number[] = [];
    for (const w of town.waters) {
      if (pointInRing(w[0][0], w[0][1], courtRing) && w.every(([x, z]) => pointInRing(x, z, courtRing))) continue; // the kund is modelled
      const sh = new THREE.Shape(w.map(([x, z]) => new THREE.Vector2(x, -z)));
      shapes.push(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2));
      // embankment: from the bank (y 0) down past the water, facing the water
      for (let i = 0; i < w.length; i++) {
        const a = w[i], b = w[(i + 1) % w.length];
        if (Math.abs(a[0]) > 898 || Math.abs(a[1]) > 898) continue;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.01) continue;
        let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
        // face into the water (the ring may wind either way)
        const mx = (a[0] + b[0]) / 2 + nx * 0.5, mz = (a[1] + b[1]) / 2 + nz * 0.5;
        if (!pointInRing(mx, mz, w)) { nx = -nx; nz = -nz; }
        const v = [[a[0], 0.02, a[1]], [b[0], 0.02, b[1]], [b[0], -1.6, b[1]], [a[0], 0.02, a[1]], [b[0], -1.6, b[1]], [a[0], -1.6, a[1]]];
        const e1 = [b[0] - a[0], -0, b[1] - a[1]], e2 = [0, -1.62, 0];
        const fx = e1[1] * e2[2] - e1[2] * e2[1], fz = e1[0] * e2[1] - e1[1] * e2[0];
        const ord = fx * nx + fz * nz > 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
        for (const k of ord) { walls.push(...v[k]); wallN.push(nx, 0, nz); }
        const u0 = 0, u1 = L;
        const uvs = [[u0, 1.6], [u1, 1.6], [u1, 0], [u0, 1.6], [u1, 0], [u0, 0]];
        for (const k of ord) wallUV.push(...uvs[k]);
      }
    }
    if (shapes.length) {
      const geos = shapes.map((s0) => {
        const p = s0.attributes.position, uv = new Float32Array(p.count * 2), n = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); n[i * 3 + 1] = 1; }
        s0.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        s0.setAttribute('normal', new THREE.BufferAttribute(n, 3));
        return s0.toNonIndexed();
      });
      const merged = mergeGeometries(geos)!;
      const water = new THREE.Mesh(merged, wm);
      water.position.y = -0.85;
      water.receiveShadow = true;
      g.add(water);
    }
    if (walls.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
      wg.setAttribute('normal', new THREE.Float32BufferAttribute(wallN, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(wallUV, 2));
      const m = new THREE.Mesh(wg, bank.material);
      m.receiveShadow = true;
      g.add(m);
    }
  }

  // parked bikes and e-rickshaws, poles and wires; trees in the courtyards and by the water
  streetLife(town.group, town.kerbs, 99, (x, z) => nearWalk(x, z, 2.4) || (x > court.x0 - 3 && x < court.x1 + 3 && z > court.z0 - 2 && z < court.z1 + 3));
  const inWater = (x: number, z: number) => town.waters.some((w) => pointInRing(x, z, w));
  const garden = lakesideGardens(g, inWater);
  const island: [number, number, number][] = [[-262, 22, 11], [-276, 34, 9], [-250, 48, 12], [-268, 54, 10], [-244, 30, 9], [-258, 64, 8]];
  canopyTrees(g, null, [...town.treeSpots.filter(([x, z]) => !nearWalk(x, z, 7)), ...island, ...garden.slice(0, 12)], undefined, false);
  // houses beside the walkable streets are solid
  for (const h of town.houses) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of h.ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!nearWalk(cx, cz, 26)) continue;
    // shrink the box a little: a diagonal house's box would reach into the street
    const sx = (x1 - x0) * 0.08, sz = (z1 - z0) * 0.08;
    if (nearWalk(cx, cz, 2)) continue;
    P.solid(x0 + sx, 0, z0 + sz, x1 - sx, h.h, z1 - sz);
  }
  // (Rudra Sagar's clipped outlines are in town.waters; the Shipra is clipped to the town square)
  void clipRing; void KAMAL_KUND;
  console.info(`[mahakaleshwar] OSM town: ${town.stats.real} mapped + ${town.stats.synth} filled-in houses, ${town.stats.tris} tris, ${town.shops.length} shops`);
}

const CORRIDOR_HALF = 24;
const ISLAND = { x: -262, z: 40, r: 36 };

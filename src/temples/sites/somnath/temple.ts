import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from '../../engine/materials';
import { worldUV } from '../../engine/materials';
import { Physics, archPanelGeometry, Flag, garland, type Flames } from '../../engine/kit';
import { Batch, Instances, pillarGeometry, ghantaGeometry, ghantaLoGeometry, pillarLoGeometry, eave, reliefPanelGeometry, figureReliefGeometry, withUV } from './batch';
import { shikhara } from './shikhara';
import { omFriezeMaterial } from './gold';

/**
 * Shri Somnath temple (rebuilt 1951, Kailash Mahameru Prasad, Maru-Gurjara / Chalukya style),
 * modelled from photographs and the OpenStreetMap footprint.
 *
 * Origin = centre of the garbhagriha at ground level. +z = east (the entrance, facing the
 * Digvijay Dwar), +x = north, the Arabian Sea lies to the south (-x) and south-west.
 *
 * Plan from west to east (~67 m): prasada with the shikhara (z -11..11), sabha mandapa
 * (11.5..33.5), nritya mandapa (33.5..47.5), mukha mandapa / entrance porch (47.5..53.5),
 * then the jagati steps. Levels: courtyard 0 · jagati 1.2 · floors 1.8 · ground colonnade
 * to 7.4 · gallery band to 8.8 · upper colonnade 9.8-12.4 · parapet to 14 · samvarana roofs
 * above (sabha apex ~26 m) · mandovara of the prasada to 17 · shikhara 17-45 · gold kalash
 * to ~48 m · flagstaff with trishul to ~57 m.
 */

export const JAGATI = 1.2;
export const FLOOR = 1.8;
export const SANCTUM = 4.2; // half size of the garbhagriha
export const JAG = { x: 17, z0: -13.5, z1: 56.5 };
const DOOR_W = 1.3; // half width of the sanctum passage
const DOOR_TOP = 6.4;
const PR = 10.2; // prasada half size at the corners
const SANCTUM_CEIL = 7.8;
// mandapa levels: ground colonnade top, gallery band top, balcony rail top, upper colonnade top, lintel top, parapet top (roof base)
const L1 = 7.4, L2 = 8.8, L3 = 9.8, L4 = 12.4, L5 = 13.0, L6 = 14.0;

const linspace = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));

/** Walkable quad with arbitrary corners (for stairs sloping along x). */
function floorQuad(parent: THREE.Object3D, P: Physics, c: [number, number, number][]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(c.flat()), 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  parent.add(m);
  P.floors.push(m);
}

export interface TempleMats {
  stone: THREE.MeshStandardMaterial;
  stoneTwo: THREE.MeshStandardMaterial;
  shade: THREE.MeshStandardMaterial;
  goldWall: THREE.MeshStandardMaterial;
  /** smooth burnished gold for the sanctum's pilasters, cornices and frames */
  goldTrim: THREE.MeshStandardMaterial;
  /** bright warm gold-room environment for the sanctum's metals */
  goldEnv: THREE.Texture;
  jali: THREE.MeshStandardMaterial;
  flagCloth: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  /** warm lamp-lit reflection environment for everything inside the sanctum */
  env: THREE.Texture;
  /** the halls' ceilings: the carved stone with a warm bounce from the white marble floors below */
  ceiling: THREE.MeshStandardMaterial;
  /** white marble of the floors, railing and thresholds */
  marble: THREE.MeshStandardMaterial;
}

// ---------- prasada plan ----------

/** One side of the prasada's pancha-ratha plan in metres: (along-side u, outward offset). */
const PR_SIDE: [number, number][] = [
  [-PR, 0], [-7.4, 0], [-7.4, -0.35], [-6.9, -0.35], [-6.9, 0.35], [-3.6, 0.35], [-3.6, 0.05], [-3.1, 0.05], [-3.1, 1.0],
  [3.1, 1.0], [3.1, 0.05], [3.6, 0.05], [3.6, 0.35], [6.9, 0.35], [6.9, -0.35], [7.4, -0.35], [7.4, 0], [PR, 0],
];
/** sides in turn: east (+z), north (+x), west (-z), south (-x); n = outward normal, t = direction of travel */
const SIDES = [
  { n: [0, 1], t: [1, 0] }, { n: [1, 0], t: [0, -1] }, { n: [0, -1], t: [-1, 0] }, { n: [-1, 0], t: [0, 1] },
] as const;
const sidePoint = (s: number, u: number, o: number, scale = 1): [number, number] => {
  const { n, t } = SIDES[s];
  const d = (PR + o) * scale, uu = u * scale;
  return [n[0] * d + t[0] * uu, n[1] * d + t[1] * uu];
};

/** Outline of the plan scaled; with `door` the east side is opened by a passage leading into the sanctum (a C-shaped polygon). */
function prasadaOutline(scale: number, door: boolean): [number, number][] {
  const pts: [number, number][] = [];
  const east = PR_SIDE.map(([u, o]) => sidePoint(0, u, o, scale));
  if (!door) {
    for (let s = 0; s < 4; s++) PR_SIDE.forEach(([u, o], i) => { if (s === 0 || i > 0) pts.push(sidePoint(s, u, o, scale)); });
    pts.pop(); // closing duplicate of the first point
    return pts;
  }
  const ez = (PR + 1.0) * scale;
  pts.push([DOOR_W, ez]);
  east.forEach((p) => { if (p[0] > DOOR_W + 0.01) pts.push(p); });
  for (let s = 1; s < 4; s++) PR_SIDE.forEach(([u, o], i) => { if (i > 0) pts.push(sidePoint(s, u, o, scale)); });
  pts.pop();
  east.forEach((p) => { if (p[0] < -DOOR_W - 0.01) pts.push(p); });
  pts.push([-DOOR_W, ez], [-DOOR_W, SANCTUM], [-SANCTUM, SANCTUM], [-SANCTUM, -SANCTUM],
    [SANCTUM, -SANCTUM], [SANCTUM, SANCTUM], [DOOR_W, SANCTUM]);
  return pts;
}

const sanctumHole = (): [number, number][] => [[-SANCTUM, -SANCTUM], [SANCTUM, -SANCTUM], [SANCTUM, SANCTUM], [-SANCTUM, SANCTUM]];

// ---------- samvarana roof ----------

/** Bell-shaped roof of stepped tiers studded with hundreds of ghantas, with gables (sinhakarna) on each face. */
function samvarana(B: Batch, gh: Instances, mat: THREE.Material, cx: number, cz: number, y0: number, half: number, H: number, gables = true) {
  const T = Math.max(5, Math.round(H / 0.5));
  const th = H / (T + 1.2);
  // steep pyramid-dome (~50 degrees), its flanks barely bellied, of many dense courses
  const shape = (t: number) => Math.pow(1 - t, 0.88) * (1 + 0.2 * t);
  let y = y0;
  for (let k = 0; k < T; k++) {
    const w = half * shape(k / T);
    B.box(mat, 2 * w, th * 0.6, 2 * w, cx, y, cz);
    B.box(mat, 2 * w + 0.14, th * 0.1, 2 * w + 0.14, cx, y + th * 0.6, cz);
    // ghantas round the tier's edge, tight as the scales of a pine cone
    const s = th * 1.15;
    const r = w - s * 0.22;
    const n = Math.max(1, Math.round((2 * r) / (s * 0.78)));
    for (let i = 0; i <= n; i++) {
      const u = -r + (2 * r * i) / n;
      gh.at(cx + u, y + th * 0.66, cz + r, s);
      gh.at(cx + u, y + th * 0.66, cz - r, s);
      if (rnd() < 0.1) pigeonSpots.push([cx + u, y + th * 0.66 + s * 0.95, cz + r * (rnd() < 0.5 ? 1 : -1), rnd() * 6]);
      if (i > 0 && i < n) {
        gh.at(cx + r, y + th * 0.66, cz + u, s);
        gh.at(cx - r, y + th * 0.66, cz + u, s);
      }
    }
    y += th;
  }
  // crowning bell, amalaka and stone kalash
  const top = half * shape((T - 0.5) / T);
  const bell = Math.min(Math.max(top * 2.6, th * 2.6), half * 0.3);
  gh.at(cx, y - th * 0.3, cz, bell);
  const fy = y - th * 0.3 + bell * 0.96;
  const k = half * 0.055;
  B.lathe(mat, [[0, 0], [k * 1.6, 0], [k * 1.7, k * 0.4], [k * 1.1, k * 0.7], [k * 0.6, k * 0.8], [k * 1.0, k * 1.4], [k * 0.9, k * 2.0], [k * 0.4, k * 2.4], [k * 0.15, k * 3.2], [0, k * 3.4]], cx, fy, cz, 14);

  if (!gables) return;
  // a triangular sinhakarna gable with a round medallion on each face of the lower tiers
  const gw = half * 0.62, gh2 = H * 0.5;
  const tri = new THREE.Shape();
  const steps = 5;
  tri.moveTo(-gw, 0);
  for (let i = 0; i < steps; i++) {
    const a = 1 - i / steps, b = 1 - (i + 1) / steps;
    tri.lineTo(-gw * a, gh2 * (i + 0.85) / steps);
    tri.lineTo(-gw * b, gh2 * (i + 0.85) / steps);
  }
  tri.lineTo(0, gh2);
  for (let i = steps - 1; i >= 0; i--) {
    const a = 1 - i / steps, b = 1 - (i + 1) / steps;
    tri.lineTo(gw * b, gh2 * (i + 0.85) / steps);
    tri.lineTo(gw * a, gh2 * (i + 0.85) / steps);
  }
  tri.lineTo(gw, 0);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const nx = Math.sin(a), nz = Math.cos(a);
    const d = half * 0.93;
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.7, bevelEnabled: false });
    g.translate(0, 0, -0.35);
    g.rotateY(a);
    g.translate(cx + nx * d, y0, cz + nz * d);
    B.add(mat, g);
    // the udgama gable's central panel: a large framed figure in soft relief
    const fp = figureReliefGeometry();
    const fs = gw * 0.62;
    fp.scale(fs, fs, fs * 1.6).rotateY(a).translate(cx + nx * (d + 0.4), y0 + gh2 * 0.14, cz + nz * (d + 0.4));
    B.add(mat, fp);
    // a row of little shrine panels along the gable's foot
    const nP = Math.max(2, Math.floor((gw * 1.6) / 0.9));
    for (let i = 0; i < nP; i++) {
      const u = -gw * 0.8 + (gw * 1.6 * (i + 0.5)) / nP;
      const pg = reliefPanelGeometry().scale(0.75, 0.9, 1).rotateY(a);
      pg.translate(cx + nx * (d + 0.36) + Math.cos(a) * u, y0 + 0.05, cz + nz * (d + 0.36) - Math.sin(a) * u);
      B.add(mat, pg);
    }
  }
}

// ---------- the temple ----------

export function buildTemple(root: THREE.Group, M: Materials, T: TempleMats, P: Physics) {
  const g = new THREE.Group();
  g.name = 'somnath-temple';
  root.add(g);
  const flames: Flames = { points: [], lights: [] };
  const B = new Batch();
  const S = T.stone;
  const pillars = new Instances(withUV(pillarGeometry(), 0.32, 6), S);
  const gh = new Instances(withUV(ghantaGeometry(), 0.6, 0.6), S);
  const panels = new Instances(withUV(reliefPanelGeometry(), 1.05, 1.1), S);
  const pillar = (x: number, z: number, y: number, h: number, r: number, solid = true) => {
    pillars.at(x, y, z, r, h, r);
    if (solid) P.solid(x - r * 1.4, y, z - r * 1.4, x + r * 1.4, y + h, z + r * 1.4);
  };
  const torana = (a: [number, number], b: [number, number], y: number, h: number, r: number) => {
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]) - r * 2.6;
    if (span < 0.8) return;
    const geo = archPanelGeometry(span, h, 0.32, 7);
    geo.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
    geo.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
    B.add(S, geo);
  };

  // ---------- jagati (raised platform) and stairs ----------
  B.span(S, -JAG.x, JAG.x, 0, JAGATI, JAG.z0, JAG.z1);
  B.span(S, -JAG.x - 0.25, JAG.x + 0.25, 0, 0.3, JAG.z0 - 0.25, JAG.z1 + 0.25);
  B.span(S, -JAG.x - 0.12, JAG.x + 0.12, JAGATI - 0.18, JAGATI, JAG.z0 - 0.12, JAG.z1 + 0.12);
  P.floor(g, -JAG.x, JAG.x, JAG.z0, JAG.z1, JAGATI);
  // a low parapet round the jagati's edge (open at the three stairs), so the platform is a safe walkway
  const PH = 0.7;
  const parapet = (x0: number, x1: number, z0: number, z1: number) => {
    B.span(S, x0, x1, JAGATI, JAGATI + PH, z0, z1);
    B.span(S, x0 - 0.05, x1 + 0.05, JAGATI + PH, JAGATI + PH + 0.1, z0 - 0.05, z1 + 0.05);
    P.solid(x0, JAGATI, z0, x1, JAGATI + 1.2, z1);
  };
  for (const s of [-1, 1]) {
    const xa = s * JAG.x, xb = s * (JAG.x - 0.32);
    parapet(Math.min(xa, xb), Math.max(xa, xb), JAG.z0, 19);
    parapet(Math.min(xa, xb), Math.max(xa, xb), 26, JAG.z1);
    parapet(s > 0 ? 5.5 : -JAG.x, s > 0 ? JAG.x : -5.5, JAG.z1 - 0.32, JAG.z1);
  }
  parapet(-JAG.x, JAG.x, JAG.z0, JAG.z0 + 0.32);
  // east stairs
  for (let i = 0; i < 6; i++) B.span(S, -5.5, 5.5, 0, JAGATI - i * 0.2, JAG.z1, JAG.z1 + 0.6 * (i + 1));
  P.floor(g, -5.5, 5.5, JAG.z1 + 3.6, JAG.z1, 0, JAGATI);
  // north and south stairs (at the sabha mandapa's side porches)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x0 = s * JAG.x, x1 = s * (JAG.x + 0.6 * (i + 1));
      B.span(S, Math.min(x0, x1), Math.max(x0, x1), 0, JAGATI - i * 0.2, 19, 26);
    }
    floorQuad(g, P, [[s * JAG.x, JAGATI, 19], [s * (JAG.x + 3.6), 0, 19], [s * (JAG.x + 3.6), 0, 26], [s * JAG.x, JAGATI, 26]]);
  }

  // ---------- prasada: moulded plinth, two-storey mandovara, varandika ----------
  const bands: [number, number, number][] = [
    [JAGATI, 1.55, 1.075], [1.55, 2.05, 1.055], [2.05, 2.3, 1.085], [2.3, 2.65, 1.035], [2.65, 3.0, 1.06],
    [3.0, DOOR_TOP, 1.0], [DOOR_TOP, 7.6, 1.0], [7.6, 8.0, 1.04], [8.0, 8.35, 1.105], [8.35, 8.7, 1.06], [8.7, 9.3, 1.02],
    [9.3, 14.4, 0.985], [14.4, 14.8, 1.04], [14.8, 15.25, 1.11], [15.25, 15.6, 1.05], [15.6, 17.0, 1.0],
  ];
  for (const [y0, y1, sc] of bands) {
    if (y0 < DOOR_TOP) B.prism(S, prasadaOutline(sc, true), y0, y1);
    else if (y0 < SANCTUM_CEIL + 0.2) B.prism(S, prasadaOutline(sc, false), y0, y1, [sanctumHole()]);
    else B.prism(S, prasadaOutline(sc, false), y0, y1);
  }
  // colliders: four walls round the sanctum, the east one split by the passage
  const E = PR + 1.0;
  P.solid(-E, 0, -E, E, 17, -SANCTUM);
  P.solid(SANCTUM, 0, -SANCTUM, E, 17, E);
  P.solid(-E, 0, -SANCTUM, -SANCTUM, 17, E);
  P.solid(-SANCTUM, 0, SANCTUM, -DOOR_W, 17, E);
  P.solid(DOOR_W, 0, SANCTUM, SANCTUM, 17, E);

  // niches (devakoshthas) on every ratha of both storeys, kept empty and dark; balconies on the bhadras
  const niche = (s: number, u: number, o: number, y0: number, h: number, w: number) => {
    const { n } = SIDES[s];
    const [px, pz] = sidePoint(s, u, o);
    const ry = Math.atan2(n[0], n[1]);
    const at = (along: number, out: number): [number, number] => {
      const t = SIDES[s].t;
      return [px + t[0] * along + n[0] * out, pz + t[1] * along + n[1] * out];
    };
    let [x, z] = at(0, 0.03);
    B.box(T.shade, w, h, 0.1, x, y0, z, ry);
    // a deity in soft relief stands in every niche (draped form, no facial features)
    const fig = figureReliefGeometry();
    const fs = Math.min(w * 0.95, h / 1.45);
    fig.scale(fs, fs, fs).rotateY(ry);
    [x, z] = at(0, 0.1);
    fig.translate(x, y0 + 0.05, z);
    B.add(S, fig);
    for (const sgn of [-1, 1]) {
      [x, z] = at(sgn * (w / 2 + 0.16), 0.14);
      B.box(S, 0.32, h, 0.3, x, y0, z, ry);
    }
    [x, z] = at(0, 0.18);
    B.box(S, w + 0.8, 0.22, 0.42, x, y0 - 0.22, z, ry);
    B.box(S, w + 0.8, 0.3, 0.42, x, y0 + h, z, ry);
    const ped = new THREE.ConeGeometry((w + 0.7) * 0.72, 1.0, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.45).rotateY(ry);
    [x, z] = at(0, 0.0);
    ped.translate(x, y0 + h + 0.3 + 0.5, z);
    B.add(S, ped);
  };
  for (let s = 0; s < 4; s++) {
    for (const u of [-5.25, 5.25]) {
      niche(s, u, 0.35, 3.6, 2.5, 1.3);
      niche(s, u, 0.35, 10.2, 2.2, 1.1);
    }
    for (const u of [-8.8, 8.8]) {
      niche(s, u, 0, 3.8, 2.2, 1.0);
      niche(s, u, 0, 10.4, 1.9, 0.9);
    }
    if (s === 0) continue; // east bhadra holds the sanctum door
    niche(s, 0, 1.0, 3.5, 3.0, 2.0);
    // jharokha balcony on the upper bhadra
    const { n, t } = SIDES[s];
    const ry = Math.atan2(n[0], n[1]);
    const c = (along: number, out: number): [number, number] => [n[0] * (PR + 1 + out) + t[0] * along, n[1] * (PR + 1 + out) + t[1] * along];
    let [x, z] = c(0, 0.85);
    B.box(S, 4.6, 0.4, 1.9, x, 9.3, z, ry);
    [x, z] = c(0, 1.7);
    B.box(S, 4.6, 1.0, 0.24, x, 9.7, z, ry);
    B.box(S, 4.8, 0.14, 0.4, x, 10.7, z, ry);
    [x, z] = c(0, 0.03);
    B.box(T.shade, 3.6, 2.7, 0.1, x, 9.7, z, ry);
    for (const along of [-2.1, -0.75, 0.75, 2.1]) {
      [x, z] = c(along, 1.6);
      pillar(x, z, 9.7, 2.9, 0.12, false);
    }
    [x, z] = c(0, 0.9);
    B.box(S, 5.0, 0.35, 2.3, x, 12.6, z, ry);
    eave(B, T.stoneTwo, x, z, s % 2 ? 2.3 : 5.0, s % 2 ? 5.0 : 2.3, 12.95, 0.5, 0.35);
    samvarana(B, gh, S, x, z, 12.95, 1.9, 2.6, false);
  }

  // ---------- shikhara, kalash, flagstaff ----------
  const spire = shikhara(g, S, 17.0, 9.2, 29.5);
  const kTop = goldKalash(g, M.gold, spire.crownY - 0.15, 3.4);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 11.5, 10), M.brass);
  pole.position.set(0, spire.crownY - 1 + 5.75, -1.0);
  g.add(pole);
  const poleTop = spire.crownY - 1 + 11.5;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.12), M.brass);
  bar.position.set(0, poleTop - 1.0, -1.0);
  g.add(bar);
  for (const dz of [-0.85, -0.45, 0.45, 0.85]) {
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), M.brass);
    bell.position.set(dz, poleTop - 1.15, -1.0);
    g.add(bell);
  }
  trishul(g, M.gold, 0, poleTop, -1.0, 1.3);
  const flag = new Flag(g, M.brass, T.flagCloth, 0, poleTop - 4.2, -1.0, 3.2);
  flag.mesh.scale.setScalar(2.1);
  void kTop;

  // ---------- mandapas ----------
  interface Hall {
    cz: number; hz: number; hx: number; storeys: 1 | 2;
    /** which perimeter sides get columns, and ranges along them left open */
    sides: { side: 'n' | 's' | 'e' | 'w'; open?: [number, number][] }[];
    roof: { half: number; H: number };
    dome: number;
  }
  const hall = (h: Hall) => {
    const z0 = h.cz - h.hz, z1 = h.cz + h.hz;
    B.span(S, -h.hx - 0.45, h.hx + 0.45, JAGATI, FLOOR, z0, z1);
    B.span(T.marble, -h.hx + 0.2, h.hx - 0.2, FLOOR - 0.02, FLOOR + 0.01, z0 + 0.2, z1 - 0.2);
    P.floor(g, -h.hx - 0.45, h.hx + 0.45, z0, z1, FLOOR);
    const top1 = L1;
    const r1 = h.storeys === 2 ? 0.36 : 0.32;
    for (const sd of h.sides) {
      const len = sd.side === 'n' || sd.side === 's' ? 2 * h.hz : 2 * h.hx;
      const n = Math.max(2, Math.round(len / 2.75) + 1);
      // every pillar along this side: the regular spacing outside the openings plus a pillar at each opening's edge
      const vs: number[] = linspace(-len / 2, len / 2, n).filter((v) => !sd.open?.some(([a, b]) => v > a - 0.6 && v < b + 0.6));
      for (const [a, b] of sd.open ?? []) for (const v of [a, b]) if (Math.abs(v) < len / 2 - 0.01) vs.push(v);
      vs.sort((a, b) => a - b);
      const at = (v: number): [number, number] => sd.side === 'n' ? [h.hx, h.cz + v] : sd.side === 's' ? [-h.hx, h.cz + v] : sd.side === 'e' ? [v, z1] : [v, z0];
      const pts: [number, number][] = [];
      vs.forEach((v, i) => {
        pts.push(at(v));
        // a bay that falls inside an opening stays open (NaN breaks the run)
        const w = vs[i + 1];
        if (w !== undefined && sd.open?.some(([a, b]) => (v + w) / 2 > a && (v + w) / 2 < b)) pts.push([NaN, NaN]);
      });
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (Number.isNaN(p[0])) continue;
        pillar(p[0], p[1], FLOOR, top1 - FLOOR, r1);
        if (h.storeys === 2) pillar(p[0], p[1], L3, L4 - L3, 0.2, false);
        const q = pts[i + 1];
        if (q && !Number.isNaN(q[0])) {
          torana(p, q, FLOOR, top1 - FLOOR - 0.1, r1);
          const out = sd.side === 'n' ? [1, 0] : sd.side === 's' ? [-1, 0] : sd.side === 'e' ? [0, 1] : [0, -1];
          if (h.storeys === 2) {
            // screen wall set back behind the torana: a stone dado and a pierced jali above it
            const inX = -out[0] * 0.6, inZ = -out[1] * 0.6;
            const ax = p[0] + inX, az = p[1] + inZ, bx = q[0] + inX, bz = q[1] + inZ;
            const thin = 0.14;
            const [x0, x1] = [Math.min(ax, bx) - (out[0] ? thin : 0), Math.max(ax, bx) + (out[0] ? thin : 0)];
            const [zA, zB] = [Math.min(az, bz) - (out[1] ? thin : 0), Math.max(az, bz) + (out[1] ? thin : 0)];
            B.span(S, x0, x1, FLOOR, FLOOR + 0.95, zA, zB);
            B.span(T.jali, x0, x1, FLOOR + 0.95, FLOOR + 4.3, zA, zB);
            B.span(S, x0, x1, FLOOR + 4.3, top1, zA, zB);
            P.solid(x0, FLOOR, zA, x1, top1, zB);
          }
          if (h.storeys === 2) {
            // kakshasana: the leaning balcony back-rest between the upper pillars
            const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
            const L = Math.hypot(q[0] - p[0], q[1] - p[1]) - 0.3;
            const ry = -Math.atan2(q[1] - p[1], q[0] - p[0]);
            const geo = new THREE.BoxGeometry(L, L3 - L2 + 0.05, 0.22).translate(0, (L3 - L2) / 2, 0);
            const lean = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-out[1], 0, out[0]), -0.22);
            geo.rotateY(ry);
            geo.applyMatrix4(lean);
            geo.translate(mx + out[0] * 0.15, L2, mz + out[1] * 0.15);
            B.add(S, geo);
            B.box(T.shade, L + 0.3, L4 - L3 + 0.1, 0.05, mx - out[0] * 0.25, L3 - 0.05, mz - out[1] * 0.25, ry);
            // seen from inside the hall the gallery's back is carved stone, not a dark band
            B.box(S, L + 0.3, L4 - L3 + 0.1, 0.05, mx - out[0] * 0.33, L3 - 0.05, mz - out[1] * 0.33, ry);
          }
        }
      }
    }
    // the sabha mandapa is wider than the prasada it abuts: close its west corners up to the parapet
    if (h.storeys === 2 && !h.sides.some((sd) => sd.side === 'w')) {
      for (const sg of [-1, 1]) B.span(S, sg * (PR + 0.9), sg * (h.hx + 0.5), FLOOR, L6, z0 - 0.4, z0 + 0.1);
      B.span(S, -h.hx - 0.5, h.hx + 0.5, L2, L6, z0 - 0.4, z0 + 0.1);
    }
    // over the side-porch openings the upper gallery is still closed: balcony rail and dark back panel
    if (h.storeys === 2) for (const sd of h.sides) {
      if (sd.side !== 'n' && sd.side !== 's') continue;
      const sx = sd.side === 'n' ? 1 : -1;
      for (const [a, b] of sd.open ?? []) {
        const za = h.cz + a, zb = h.cz + b, L = zb - za;
        B.box(T.shade, 0.05, L4 - L3 + 0.1, L + 0.3, sx * (h.hx - 0.25), L3 - 0.05, (za + zb) / 2);
        B.box(S, 0.05, L4 - L3 + 0.1, L + 0.3, sx * (h.hx - 0.33), L3 - 0.05, (za + zb) / 2);
        B.box(S, 0.22, L3 - L2 + 0.05, L - 0.3, sx * (h.hx + 0.15), L2, (za + zb) / 2);
        B.span(S, Math.min(sx * (h.hx - 3), sx * (h.hx + 0.5)), Math.max(sx * (h.hx - 3), sx * (h.hx + 0.5)), L1, L2, za, zb);
      }
    }
    // beam and gallery band: a ring, so the centre of the hall rises double height to the dome
    const R = h.dome;
    const circle = (rad: number): [number, number][] => Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return [Math.cos(a) * rad, h.cz + Math.sin(a) * rad] as [number, number];
    });
    const rect = (e: number, z1e = e): [number, number][] => [[-h.hx - e, z0], [h.hx + e, z0], [h.hx + e, z1 + z1e], [-h.hx - e, z1 + z1e]];
    if (h.storeys === 2) {
      B.prism(T.ceiling, rect(0.5), L1, L2, [circle(R + 0.6)]);
      // the band between the storeys carries a continuous frieze of carved panels
      for (const sd of h.sides) {
        const along = sd.side === 'n' || sd.side === 's';
        const len = along ? 2 * h.hz : 2 * h.hx;
        const cnt = Math.floor(len / 1.25);
        for (let i = 0; i < cnt; i++) {
          const v = -len / 2 + (len * (i + 0.5)) / cnt;
          if (sd.side === 'e' && sd.open?.some(([o0, o1]) => v > o0 - 0.7 && v < o1 + 0.7)) continue; // joins the next hall
          const [x, z, ry] = sd.side === 'n' ? [h.hx + 0.52, h.cz + v, Math.PI / 2] : sd.side === 's' ? [-h.hx - 0.52, h.cz + v, -Math.PI / 2]
            : sd.side === 'e' ? [v, z1 + 0.52, 0] : [v, z0 - 0.52, Math.PI];
          panels.at(x, L1 + 0.18, z, 1.05, 1.1, 1, ry);
        }
      }
      eave(B, T.stoneTwo, 0, h.cz, 2 * h.hx + 1.0, 2 * h.hz + 1.0, L2, 1.15, 0.55);
      B.prism(T.ceiling, rect(0.3), L4, L5, [circle(R + 0.6)]);
      eave(B, T.stoneTwo, 0, h.cz, 2 * h.hx + 0.6, 2 * h.hz + 0.6, L5 + 0.2, 1.0, 0.5);
      B.prism(S, rect(-0.1, -0.1), L5, L6, [circle(R + 0.6)]);
      // carved frieze band of little kutas on the parapet
      for (let x = -h.hx + 0.6; x <= h.hx - 0.5; x += 1.25) {
        gh.at(x, L6, z1 - 0.3, 0.9);
        gh.at(x, L6, z0 + 0.3, 0.9);
      }
      for (let z = z0 + 0.6; z <= z1 - 0.5; z += 1.25) {
        gh.at(h.hx - 0.3, L6, z, 0.9);
        gh.at(-h.hx + 0.3, L6, z, 0.9);
      }
      // pigeons crowd the two eave ledges of every hall, as in the photographs
      for (const [o, y] of [[0.6, L5 + 0.13], [0.85, L2 - 0.09]] as const) {
        const ex = h.hx + o, ez0 = z0 - o, ez1 = z1 + o;
        for (let v = -ex; v <= ex; v += 0.32) for (const zz of [ez0, ez1]) if (rnd() < 0.45) pigeonSpots.push([v, y, zz, zz > h.cz ? -Math.PI / 2 + (rnd() - 0.5) : Math.PI / 2 + (rnd() - 0.5)]);
        for (let v = ez0; v <= ez1; v += 0.32) for (const xx of [-ex, ex]) if (rnd() < 0.45) pigeonSpots.push([xx, y, v, xx > 0 ? (rnd() - 0.5) : Math.PI + (rnd() - 0.5)]);
      }
      samvarana(B, gh, S, 0, h.cz, L6, h.roof.half, h.roof.H);
      // interior: inner octagon of tall pillars carries a stepped ceiling with a lotus pendant
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        pillar(Math.cos(a) * R, h.cz + Math.sin(a) * R, FLOOR, L4 - 0.2 - FLOOR, 0.36);
      }
      B.prism(T.ceiling, rect(-0.2, -0.2), L4 - 0.2, L4, [circle(R + 0.6)]);
      domeCeiling(B, T.ceiling, 0, h.cz, L4 - 0.2, R + 0.6);
    } else {
      B.span(S, -h.hx - 0.5, h.hx + 0.5, L1, L1 + 0.8, z0, z1 + 0.5);
      eave(B, T.stoneTwo, 0, h.cz, 2 * h.hx + 1.0, 2 * h.hz + 1.0, L1 + 0.8, 0.9, 0.5);
      B.span(S, -h.hx + 0.2, h.hx - 0.2, L1 + 0.8, L1 + 1.6, z0 + 0.2, z1 - 0.2);
      samvarana(B, gh, S, 0, h.cz, L1 + 1.6, h.roof.half, h.roof.H);
      B.span(T.stoneTwo, -h.hx + 0.3, h.hx - 0.3, L1 - 0.3, L1, z0 + 0.1, z1 - 0.1);
    }
  };

  // sabha mandapa
  hall({
    cz: 22.5, hz: 11, hx: 11, storeys: 2,
    sides: [{ side: 'n', open: [[-4, 4]] }, { side: 's', open: [[-4, 4]] }, { side: 'e', open: [[-8.5, 8.5]] }],
    roof: { half: 12.0, H: 12.5 }, dome: 6.2,
  });
  // nritya mandapa
  hall({
    cz: 40.5, hz: 7, hx: 8.5, storeys: 2,
    sides: [{ side: 'n' }, { side: 's' }, { side: 'e', open: [[-4.5, 4.5]] }],
    // its samvarana rises to ~90 % of the sabha mandapa's apex: two similar great pyramids, as in the aerials
    roof: { half: 9.6, H: 10.4 }, dome: 4.6,
  });
  // mukha mandapa (entrance porch)
  hall({
    cz: 50.5, hz: 3, hx: 4.5, storeys: 1,
    sides: [{ side: 'n' }, { side: 's' }, { side: 'e', open: [[-1.7, 1.7]] }],
    roof: { half: 4.8, H: 6.6 }, dome: 0,
  });
  // side porches of the sabha mandapa (north and south)
  for (const s of [-1, 1]) {
    const x0 = s * 11, x1 = s * 14.6;
    B.span(S, Math.min(x0, x1), Math.max(x0, x1), JAGATI, FLOOR, 18.5, 26.5);
    P.floor(g, Math.min(x0, x1), Math.max(x0, x1), 18.5, 26.5, FLOOR);
    for (let i = 0; i < 3; i++) B.span(S, Math.min(x1, x1 + s * 0.4 * (i + 1)), Math.max(x1, x1 + s * 0.4 * (i + 1)), JAGATI, FLOOR - i * 0.2, 19.2, 25.8);
    const cols: [number, number][] = [[s * 14.2, 18.9], [s * 14.2, 21.3], [s * 14.2, 23.7], [s * 14.2, 26.1]];
    cols.forEach(([x, z]) => pillar(x, z, FLOOR, L1 - FLOOR, 0.32));
    for (let i = 0; i < 3; i++) torana(cols[i], cols[i + 1], FLOOR, L1 - FLOOR - 0.1, 0.32);
    B.span(S, Math.min(x0, s * 14.8), Math.max(x0, s * 14.8), L1, L1 + 0.8, 18.3, 26.7);
    eave(B, T.stoneTwo, s * 13.0, 22.5, 3.8, 8.4, L1 + 0.8, 0.8, 0.45);
    samvarana(B, gh, S, s * 12.9, 22.5, L1 + 0.8, 3.9, 5.2);
  }
  // steps from the porch floor down to the jagati at the entrance
  for (let i = 0; i < 3; i++) B.span(S, -3.5, 3.5, JAGATI, FLOOR - i * 0.2, 53.5, 53.5 + 0.4 * (i + 1));

  // the garbhagriha's front wall is gold-plated round the silver doorway, with gold pilasters and brackets
  const dz = PR + 1.0;
  const GW = 4.8, GT = DOOR_TOP + 2.8;
  B.span(T.goldWall, -GW, -DOOR_W - 0.45, FLOOR, GT, dz + 0.05, dz + 0.16);
  B.span(T.goldWall, DOOR_W + 0.45, GW, FLOOR, GT, dz + 0.05, dz + 0.16);
  B.span(T.goldWall, -DOOR_W - 0.45, DOOR_W + 0.45, DOOR_TOP + 0.75, GT, dz + 0.05, dz + 0.16);
  for (const x of [-GW + 0.2, -DOOR_W - 1.1, DOOR_W + 1.1, GW - 0.2]) {
    B.span(T.goldWall, x - 0.22, x + 0.22, FLOOR, GT - 0.3, dz + 0.1, dz + 0.42);
    B.lathe(T.goldWall, [[0, 0], [0.3, 0], [0.34, 0.12], [0.22, 0.3], [0, 0.32]], x, GT - 0.6, dz + 0.42, 12);
  }
  B.span(T.goldWall, -GW - 0.1, GW + 0.1, GT - 0.3, GT, dz + 0.1, dz + 0.5);
  // white marble darshan railing in front, its panels carved with lotus medallions; the way in stays open
  for (const sgn of [-1, 1]) {
    const xa = sgn * 1.7, xb = sgn * 5.2;
    const [x0, x1] = [Math.min(xa, xb), Math.max(xa, xb)];
    B.span(T.marble, x0, x1, FLOOR, FLOOR + 0.9, 13.0, 13.35);
    B.span(T.marble, x0 - 0.05, x1 + 0.05, FLOOR + 0.9, FLOOR + 1.0, 12.95, 13.4);
    for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.9) {
      B.add(T.marble, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20).rotateX(Math.PI / 2).translate(x, FLOOR + 0.45, 13.38));
      B.add(T.marble, new THREE.TorusGeometry(0.2, 0.025, 6, 18).translate(x, FLOOR + 0.45, 13.42));
    }
    P.solid(x0, FLOOR, 12.95, x1, FLOOR + 1.0, 13.4);
  }
  // sanctum doorway in silver, seen from the sabha mandapa
  B.span(M.silver, -DOOR_W - 0.45, -DOOR_W, FLOOR, DOOR_TOP + 0.4, dz - 0.05, dz + 0.12);
  B.span(M.silver, DOOR_W, DOOR_W + 0.45, FLOOR, DOOR_TOP + 0.4, dz - 0.05, dz + 0.12);
  B.span(M.silver, -DOOR_W - 0.45, DOOR_W + 0.45, DOOR_TOP, DOOR_TOP + 0.55, dz - 0.05, dz + 0.12);
  B.span(M.brass, -DOOR_W - 0.7, DOOR_W + 0.7, DOOR_TOP + 0.55, DOOR_TOP + 0.75, dz - 0.1, dz + 0.2);
  garland(g, M.marigold, new THREE.Vector3(-DOOR_W - 0.3, DOOR_TOP + 0.2, dz + 0.2), new THREE.Vector3(DOOR_W + 0.3, DOOR_TOP + 0.2, dz + 0.2), 0.5, 0.05);
  for (const s of [-1, 1]) {
    garland(g, M.marigold, new THREE.Vector3(s * (DOOR_W + 0.25), DOOR_TOP + 0.2, dz + 0.2), new THREE.Vector3(s * (DOOR_W + 0.25), FLOOR + 1.6, dz + 0.2), 0.05, 0.05);
  }

  buildSanctum(g, B, M, T, P, flames);

  // ---------- lamps: diyas along the jagati edge and up the steps, hanging lamps in the halls ----------
  for (const z of linspace(JAG.z0 + 0.4, JAG.z1 - 0.4, 60)) {
    if (z > 18.6 && z < 26.4) continue;
    flames.points.push(new THREE.Vector3(JAG.x - 0.16, JAGATI + PH + 0.16, z), new THREE.Vector3(-JAG.x + 0.16, JAGATI + PH + 0.16, z));
  }
  for (const x of linspace(-JAG.x + 0.4, JAG.x - 0.4, 30)) {
    flames.points.push(new THREE.Vector3(x, JAGATI + PH + 0.16, JAG.z0 + 0.16));
    if (Math.abs(x) > 5.8) flames.points.push(new THREE.Vector3(x, JAGATI + PH + 0.16, JAG.z1 - 0.16));
  }
  for (let i = 0; i < 6; i++) for (const x of [-5.2, 5.2]) flames.points.push(new THREE.Vector3(x, JAGATI - i * 0.2 + 0.06, JAG.z1 + 0.6 * i + 0.3));
  for (const [x, z] of [[0, 22.5], [0, 40.5]] as const) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.2, 4), M.brass);
    chain.position.set(x, 10.9, z);
    g.add(chain);
    B.lathe(M.brass, [[0, 0], [0.35, 0.05], [0.42, 0.12], [0.1, 0.2], [0, 0.22]], x, 9.1, z, 16);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.36, 9.28, z + Math.sin(a) * 0.36));
    }
    // set below the gallery band so it lights the aisle ceilings' undersides and, through the open well, the dome
    const l = new THREE.PointLight(0xffe2c0, 9, 18, 1.4);
    l.position.set(x, 5.6, z);
    g.add(l);
    flames.lights.push(l);
  }

  // a flock pecking at the grain pilgrims scatter on the paving either side of the east steps
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 26; k++) pigeonSpots.push([sx * (7.5 + rnd() * 6), 0.09, JAG.z1 + 1.5 + rnd() * 5, rnd() * 6]);
  }
  // beyond ~50 m (the spawn, the gate, the promenade) the ~7500 roof ghantas and the hall pillars swap to light stand-ins
  const roofs = new THREE.Vector3(0, 14, 22);
  pillars.flushLOD(g, withUV(pillarLoGeometry(), 0.32, 6), roofs, 50);
  flushPigeons(g);
  gh.flushLOD(g, withUV(ghantaLoGeometry(), 0.6, 0.6), roofs, 50);
  panels.flush(g);
  B.flush(g);
  return { group: g, flag, flames };
}

// ---------- pieces ----------

function goldKalash(parent: THREE.Object3D, gold: THREE.Material, y: number, h: number) {
  // gilded lotus plate (padma) the kalash sits on, then the banded pot, neck rings, mango-leaf crown and bud
  const prof: [number, number][] = [[0, 0], [0.62, 0], [0.66, 0.025], [0.5, 0.05], [0.4, 0.07], [0.46, 0.1], [0.32, 0.13],
    [0.5, 0.22], [0.56, 0.3], [0.58, 0.34], [0.55, 0.36], [0.57, 0.38], [0.5, 0.46], [0.3, 0.54], [0.2, 0.57],
    [0.27, 0.59], [0.27, 0.62], [0.17, 0.64], [0.24, 0.66], [0.24, 0.69], [0.13, 0.71], [0.3, 0.75], [0.24, 0.79],
    [0.13, 0.81], [0.17, 0.86], [0.11, 0.92], [0.05, 0.98], [0.02, 1.01], [0, 1.02]];
  const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r * h, y + yy * h)), 40);
  // petals of the lotus plate
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = (p.getY(i) - y) / h;
    if (yy < 0.08) {
      const x = p.getX(i), z = p.getZ(i);
      const k = 1 + 0.07 * Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 8)), 0.5);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, gold);
  m.castShadow = true;
  parent.add(m);
  return y + h;
}

function trishul(parent: THREE.Object3D, gold: THREE.Material, x: number, y: number, z: number, s: number) {
  const add = (geo: THREE.BufferGeometry, px: number, py: number, rz = 0) => {
    const m = new THREE.Mesh(geo, gold);
    m.position.set(x + px, y + py, z);
    m.rotation.z = rz;
    parent.add(m);
  };
  add(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.5 * s, 8), 0, 0.25 * s);
  add(new THREE.ConeGeometry(0.09 * s, 0.55 * s, 8), 0, 0.75 * s);
  const arc = new THREE.TorusGeometry(0.28 * s, 0.04 * s, 6, 16, Math.PI).rotateX(Math.PI);
  add(arc, 0, 0.62 * s);
  add(new THREE.ConeGeometry(0.07 * s, 0.4 * s, 8), -0.28 * s, 0.82 * s);
  add(new THREE.ConeGeometry(0.07 * s, 0.4 * s, 8), 0.28 * s, 0.82 * s);
}

/** Stepped concentric ceiling (as in Solanki mandapas) with a hanging lotus pendant, seen from below. */
function domeCeiling(B: Batch, mat: THREE.Material, x: number, z: number, y: number, R: number) {
  const prof: [number, number][] = [];
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const r0 = R * (1 - i / rings), r1 = R * (1 - (i + 1) / rings);
    const y0 = y + i * 0.27;
    prof.push([r0, y0], [r0, y0 + 0.2], [r0 - 0.12, y0 + 0.23], [r1, y0 + 0.27]);
  }
  prof.push([0, y + rings * 0.27 + 0.02]);
  const top = y + rings * 0.27;
  const g = new THREE.LatheGeometry(prof.reverse().map(([r, yy]) => new THREE.Vector2(r, yy)), 32);
  g.translate(x, 0, z);
  B.add(mat, g);
  B.lathe(mat, [[0, 0], [0.9, -0.12], [0.7, -0.45], [1.0, -0.8], [0.5, -1.2], [0.18, -1.5], [0, -1.6]].map(([r, d]) => [r, top + d] as [number, number]).reverse(), x, 0, z, 16);
}

// ---------- garbhagriha and the Jyotirlinga ----------

function buildSanctum(g: THREE.Group, B: Batch, M: Materials, T: TempleMats, P: Physics, flames: Flames) {
  const S = SANCTUM, F = FLOOR, C = SANCTUM_CEIL;
  // floor slab and passage floor
  B.span(T.marble, -S, S, JAGATI, F, -S, S);
  B.span(T.marble, -DOOR_W, DOOR_W, JAGATI, F, S, PR + 1.6);
  P.floor(g, -S, S, -S, S, F);
  P.floor(g, -DOOR_W, DOOR_W, S, PR + 1.6, F);
  // gold-plated walls and ceiling
  const t = 0.12;
  const NW = 1.1, NT = F + 4.35; // the blind arched frame on the back wall, behind Maa Parvati's shrine
  const GT = T.goldTrim;
  B.span(T.goldWall, -S, S, F, C, -S, -S + t);
  B.span(T.goldWall, S - t, S, F, C, -S, S);
  B.span(T.goldWall, -S, -S + t, F, C, -S, S);
  B.span(T.goldWall, -S, -DOOR_W, F, C, S - t, S);
  B.span(T.goldWall, DOOR_W, S, F, C, S - t, S);
  B.span(T.goldWall, -DOOR_W, DOOR_W, DOOR_TOP, C, S - t, S);
  B.span(T.goldWall, -S, S, C - 0.01, C + 0.2, -S, S);
  // gold pilasters with pot capitals and a cusped torana arch on the back wall
  for (const sg of [-1, 1]) {
    const x = sg * (NW + 0.16);
    B.span(GT, x - 0.16, x + 0.16, F, NT - 0.62, -S + t - 0.02, -S + t + 0.2);
    B.lathe(GT, [[0, 0], [0.2, 0], [0.24, 0.1], [0.16, 0.24], [0.22, 0.3], [0, 0.32]], x, NT - 0.7, -S + t + 0.1, 12);
  }
  B.add(GT, new THREE.TorusGeometry(NW + 0.05, 0.07, 8, 32, Math.PI).scale(1, 0.56, 1).translate(0, NT - 0.62, -S + t + 0.12));
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    B.add(GT, new THREE.SphereGeometry(0.075, 8, 6).translate(Math.cos(a) * (NW - 0.1), NT - 0.62 + Math.sin(a) * (NW - 0.1) * 0.56, -S + t + 0.1));
  }
  B.span(GT, -NW - 0.35, NW + 0.35, NT, NT + 0.14, -S + t - 0.02, -S + t + 0.22);
  // the ॐ नमः शिवाय frieze above, as in every darshan photograph
  const om = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.4), omFriezeMaterial(T.goldEnv));
  om.position.set(0, NT + 0.45, -S + t + 0.012);
  g.add(om);
  B.span(GT, -1.6, 1.6, NT + 0.2, NT + 0.25, -S + t - 0.02, -S + t + 0.08);
  B.span(GT, -1.6, 1.6, NT + 0.65, NT + 0.7, -S + t - 0.02, -S + t + 0.08);

  // passage lined in gold
  B.span(T.goldWall, -DOOR_W, -DOOR_W + 0.08, F, DOOR_TOP, S, PR + 1.0);
  B.span(T.goldWall, DOOR_W - 0.08, DOOR_W, F, DOOR_TOP, S, PR + 1.0);
  // burnished gold pilasters at the corners and mid-walls, and a cornice ring
  for (const [x, z] of [[-S + 0.25, -S + 0.25], [S - 0.25, -S + 0.25], [-S + 0.25, S - 0.25], [S - 0.25, S - 0.25], [-S + 0.25, 0], [S - 0.25, 0]] as const) {
    B.span(GT, x - 0.22, x + 0.22, F, C, z - 0.22, z + 0.22);
    B.span(GT, x - 0.28, x + 0.28, F, F + 0.25, z - 0.28, z + 0.28);
    B.span(GT, x - 0.3, x + 0.3, C - 0.75, C - 0.6, z - 0.3, z + 0.3);
  }
  for (const [x0, x1, z0, z1] of [[-S, S, -S, -S + 0.3], [-S, S, S - 0.3, S], [-S, -S + 0.3, -S, S], [S - 0.3, S, -S, S]] as const) {
    B.span(GT, x0, x1, C - 0.45, C - 0.2, z0, z1);
  }
  // gilt dado band and a moulded string course round the walls
  for (const y of [F + 0.9, F + 4.4]) for (const [x0, x1, z0, z1] of [[-S + t, -S + t + 0.06, -S, S], [S - t - 0.06, S - t, -S, S]] as const) B.span(GT, x0, x1, y, y + 0.08, z0, z1);

  // gold-plated doors of the sanctum, swung open against the passage walls
  for (const s of [-1, 1]) {
    B.span(T.goldWall, s * (DOOR_W - 0.16), s * (DOOR_W - 0.08), F, F + 4.2, S + 0.05, S + 1.3);
    for (const y of [F + 0.8, F + 2.1, F + 3.4]) B.span(GT, s * (DOOR_W - 0.2), s * (DOOR_W - 0.15), y, y + 0.08, S + 0.1, S + 1.25);
  }

  // brass deepstambhas flanking the linga, kept well clear of the pradakshina round the walls
  const brass = T.goldTrim;
  const standProf: [number, number][] = [[0, 0], [0.3, 0], [0.3, 0.05], [0.11, 0.12], [0.06, 0.4], [0.1, 0.45], [0.05, 0.5], [0.05, 1.45], [0.24, 1.5], [0.26, 1.56], [0, 1.56]];
  for (const [x, z] of [[-2.6, -1.0], [2.6, -1.0], [-2.2, 2.2], [2.2, 2.2]] as const) {
    B.lathe(brass, standProf, x, F, z, 20);
    P.solid(x - 0.3, F, z - 0.3, x + 0.3, F + 1.6, z + 0.3);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.17, F + 1.62, z + Math.sin(a) * 0.17));
    }
  }
  // bells
  for (const [x, z] of [[-1.8, 3.4], [1.8, 3.4], [0, 3.6]] as const) {
    B.lathe(brass, [[0, 0], [0.17, 0], [0.16, 0.04], [0.13, 0.12], [0.1, 0.26], [0.05, 0.31], [0.02, 0.35], [0, 0.35]], x, C - 1.4, z, 20);
    const ch = new THREE.CylinderGeometry(0.01, 0.01, 1.05, 4);
    ch.translate(x, C - 0.52, z);
    B.add(brass, ch);
  }
  // lamp light for darshan, kept soft (≤ 2.5, reaching ≤ 4 m) so nothing blooms: a lamp either side,
  // and a narrow spot from over the door picking out the linga and Maa Parvati above it
  for (const [x, z] of [[-2.6, 0.2], [2.6, 0.2]] as const) {
    const l = new THREE.PointLight(0xffd6a6, 2.5, 4, 1.4);
    l.position.set(x, F + 2.6, z);
    g.add(l);
    flames.lights.push(l);
  }
  const spot = new THREE.SpotLight(0xffe6c4, 14, 11, 0.24, 0.6, 1.6);
  spot.position.set(0, F + 3.4, 3.7);
  spot.target.position.set(0, F + 3.2, -1.6);
  g.add(spot, spot.target);
  buildJyotirlinga(g, M, T, P, flames, F, C);
}

/**
 * Shri Somnath Jyotirlinga in its daily shringar, as at darshan (o16): the black linga in a broad gold
 * lotus yoni-pitha, its front dressed in a dark-blue painted covering with a silver naga-hood emblem,
 * eyes and tilak, a jewelled band with pearl drops, a gold five-hooded naga over its crown, and a great
 * mound of marigold, white and red-rose garlands arching round it and cascading over the jalahari's rim.
 * Over it a gold chhatra canopy on four gold pillars, hung with green-and-marigold torans; directly behind,
 * Maa Parvati in white marble on a gold throne under a gold arch.
 * All of this is one LOD: within ~30 m the full dressing, beyond it a few simple shapes.
 */
function buildJyotirlinga(g: THREE.Group, M: Materials, T: TempleMats, P: Physics, flames: Flames, F: number, C: number) {
  const inside = <X extends THREE.MeshStandardMaterial>(m: X, k = 1.6) => { m.envMap = T.env; m.envMapIntensity = k; return m; };
  const dress = new THREE.Group();
  dress.name = 'shringar';
  const B = new Batch();
  // burnished gold mirroring the warm gold room
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b038, metalness: 1, roughness: 0.24, emissive: 0x0c0600, envMap: T.goldEnv, envMapIntensity: 1.6 });
  const nagaGold = new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 1, roughness: 0.22, emissive: 0x100800, envMap: T.goldEnv, envMapIntensity: 1.7 });
  // ---- yoni-pitha: two scalloped lotus tiers, a raised rim round the basin, the pranala spout to the north (+x)
  const lotus = (R: number, petals: number, depth: number) => {
    const sh = new THREE.Shape();
    const N = petals * 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = R * (0.93 + 0.07 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.6));
      const p = new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
      if (i === 0) sh.moveTo(p.x, p.y); else sh.lineTo(p.x, p.y);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  B.add(gold, lotus(1.5, 16, 0.2).translate(0, F + 0.03, 0));
  B.add(gold, lotus(1.22, 16, 0.18).translate(0, F + 0.26, 0));
  B.lathe(gold, [[0.98, 0], [1.04, 0.02], [1.04, 0.1], [0.98, 0.12], [0.94, 0.08], [0.5, 0.04], [0, 0.04]], 0, F + 0.47, 0, 48);
  const spout = new THREE.CylinderGeometry(0.16, 0.26, 1.1, 16, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI).rotateY(-Math.PI / 2);
  B.add(gold, spout.translate(1.65, F + 0.42, 0));
  B.span(gold, 1.1, 2.2, F + 0.03, F + 0.34, -0.28, 0.28);
  P.solid(-1.5, F, -1.5, 2.25, F + 1.6, 1.5);
  const milk = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.95, 48).rotateX(-Math.PI / 2),
    inside(new THREE.MeshPhysicalMaterial({ color: 0xf4efe4, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 })));
  milk.position.y = F + 0.53;
  dress.add(milk);

  // ---- the linga: black stone, cylindrical with a domed head
  const lp: [number, number][] = [[0, 0], [0.4, 0], [0.405, 0.1], [0.4, 0.66]];
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    lp.push([Math.cos(a) * 0.4, 0.66 + Math.sin(a) * 0.42]);
  }
  const lingaY = F + 0.5;
  const linga = new THREE.Mesh(new THREE.LatheGeometry(lp.map(([r, y]) => new THREE.Vector2(r, y)), 64), M.lingam);
  linga.position.set(0, lingaY, 0);
  linga.castShadow = true;
  dress.add(linga);
  const top = lingaY + 1.08;

  // ---- the shringar covering over the front: painted dark blue, a silver naga-hood emblem with a red rim,
  // silver eyes, tilak and crescent, a gold border; a lathe shell just proud of the stone
  // (profile resampled evenly in height, so the painted design maps without stretching onto the dome)
  const coverProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = 0.04 + (i / 24) * 1.04;
    const r = y < 0.66 ? 0.4 : 0.4 * Math.sqrt(Math.max(0, 1 - ((y - 0.66) / 0.42) ** 2));
    coverProf.push(new THREE.Vector2(r * 1.035 + 0.004, y));
  }
  const cover = new THREE.LatheGeometry(coverProf, 48, -1.95, 3.9);
  const coverMesh = new THREE.Mesh(cover, new THREE.MeshStandardMaterial({ map: shringarTexture(), roughness: 0.38, metalness: 0.15, envMap: T.goldEnv, envMapIntensity: 0.6, side: THREE.DoubleSide }));
  coverMesh.position.set(0, lingaY, 0);
  dress.add(coverMesh);
  // the jewelled band round the waist, pearl strings hanging from it on the front
  const BAND = lingaY + 0.44;
  B.add(gold, new THREE.TorusGeometry(0.432, 0.016, 8, 48).rotateX(Math.PI / 2).translate(0, BAND, 0));
  B.add(gold, new THREE.TorusGeometry(0.432, 0.012, 8, 48).rotateX(Math.PI / 2).translate(0, BAND - 0.05, 0));
  const fl = new Flowers();
  // the jewelled band: set stones between the two gold rims, and a fine fringe of silver-white beads
  // hanging in festoons over the lower half of the covering
  for (let k = 0; k < 40; k++) {
    const a = -1.75 + (k / 39) * 3.5;
    const x = Math.sin(a), z = Math.cos(a);
    fl.bead(x * 0.44, BAND - 0.025, z * 0.44, 0.012, k % 4 === 0 ? 0xd8203a : k % 4 === 2 ? 0x2a8a4a : 0xf4f2ec);
    const n = 5 + Math.round(3 * Math.abs(Math.sin(k * 0.8)));
    for (let j = 0; j < n; j++) {
      const rr = 0.425 + 0.006 * j;
      fl.bead(x * rr, BAND - 0.07 - j * 0.026, z * rr, 0.0075, j === n - 1 && k % 2 ? 0xd8203a : j % 3 === 2 ? 0xd8dce4 : 0xf8f6f0);
    }
  }
  // a festoon of pearls across the front, between the strings
  for (let k = 0; k <= 30; k++) {
    const t = k / 30, a = -1.1 + t * 2.2;
    fl.bead(Math.sin(a) * 0.438, BAND - 0.14 - Math.sin(t * Math.PI) * 0.07, Math.cos(a) * 0.438, 0.009, 0xf8f6f0);
  }

  // ---- the gold naga: body coiled round the foot and rising up the back, five hoods fanned over the crown
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = 0.6 + t * Math.PI * 2.5;
    path.push(new THREE.Vector3(Math.cos(a) * (0.5 + 0.04 * (1 - t)), lingaY + 0.03 + t * 0.2, Math.sin(a) * (0.5 + 0.04 * (1 - t))));
  }
  for (const [x, y, z] of [[0.1, 0.45, -0.47], [0.03, 0.72, -0.46], [0, 0.94, -0.42], [0, 1.1, -0.34], [0, 1.22, -0.24]] as const) path.push(new THREE.Vector3(x, lingaY + y, z));
  const curve = new THREE.CatmullRomCurve3(path);
  const segs = 120, rad = 8;
  const tube = new THREE.TubeGeometry(curve, segs, 1, rad);
  const tp = tube.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const r = u < 0.15 ? 0.012 + (u / 0.15) * 0.05 : u < 0.85 ? 0.062 : 0.062 + (u - 0.85) * 0.25;
    const c = curve.getPointAt(u);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      tp.setXYZ(k, c.x + (tp.getX(k) - c.x) * r, c.y + (tp.getY(k) - c.y) * r, c.z + (tp.getZ(k) - c.z) * r);
    }
  }
  tube.computeVertexNormals();
  B.add(nagaGold, tube);
  {
    const hc = new THREE.Vector3(0, top + 0.2, -0.14);
    const parts: [THREE.BufferGeometry, THREE.Material][] = [];
    const inner = M.brass;
    parts.push([new THREE.SphereGeometry(0.31, 24, 14).scale(1.0, 0.78, 0.14).translate(0, 0.04, -0.05), inner]);
    for (let k = -2; k <= 2; k++) {
      const th = k * 0.46;
      const lx = Math.sin(th) * 0.21, ly = Math.cos(th) * 0.15 - 0.03, lz = 0.03 - Math.abs(k) * 0.025;
      parts.push([new THREE.SphereGeometry(0.14, 20, 14).scale(0.74, 1.18, 0.4).rotateZ(-th).translate(lx, ly, lz), nagaGold]);
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.SphereGeometry(0.024, 8, 6).scale(2.0, 0.42, 0.6).rotateZ(-th);
        rib.translate(lx - Math.sin(th) * (r - 1.5) * 0.055, ly + Math.cos(th) * (r - 1.5) * 0.055 - 0.01, lz + 0.052);
        parts.push([rib, inner]);
      }
      const hd = new THREE.SphereGeometry(0.05, 12, 8).scale(0.9, 0.72, 1.6).rotateZ(-th);
      hd.translate(Math.sin(th) * 0.35, Math.cos(th) * 0.3 - 0.03, lz + 0.05);
      parts.push([hd, nagaGold]);
    }
    for (const [p, m] of parts) {
      p.rotateX(0.18);
      p.translate(hc.x, hc.y, hc.z);
      B.add(m, p);
    }
  }

  // ---- the gold chhatra canopy on four slender gold pillars, its rim fringed with bells
  const cy = F + 3.55, CR = 1.85;
  for (const [x, z] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]] as const) {
    B.lathe(gold, [[0, 0], [0.14, 0], [0.14, 0.08], [0.1, 0.12], [0.06, 0.3], [0.08, 0.34], [0.05, 0.4], [0.05, 3.1], [0.09, 3.17], [0.06, 3.25],
      [0.07, 3.4], [0.13, 3.47], [0.14, 3.55], [0, 3.55]], x, F, z, 12);
  }
  const ch = new THREE.LatheGeometry([[0, 0.62], [0.2, 0.58], [0.55, 0.42], [0.85, 0.18], [0.97, 0.02], [0.98, -0.06], [0.9, -0.04], [0.72, 0.12], [0.25, 0.4], [0, 0.44]]
    .map(([r, y]) => new THREE.Vector2(r * CR, y * 1.15)), 48);
  const cp = ch.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i);
    const k = 1 + 0.04 * Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 8)), 3);
    cp.setX(i, x * k); cp.setZ(i, z * k);
  }
  ch.computeVertexNormals();
  B.add(gold, ch.translate(0, cy, 0));
  B.lathe(gold, [[0, 0], [0.16, 0], [0.2, 0.12], [0.1, 0.26], [0.14, 0.38], [0.05, 0.56], [0, 0.6]], 0, cy + 0.7, 0, 16);
  B.add(gold, new THREE.CylinderGeometry(0.03, 0.03, C - cy - 1.2, 8).translate(0, cy + 1.2 + (C - cy - 1.2) / 2, 0));
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    B.add(gold, new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4).translate(Math.cos(a) * CR, cy - 0.15, Math.sin(a) * CR));
    B.lathe(gold, [[0, 0], [0.035, 0], [0.03, 0.04], [0.015, 0.07], [0, 0.075]], Math.cos(a) * CR, cy - 0.3, Math.sin(a) * CR, 6);
  }

  // ---- flowers: one instanced mesh, every bloom its own colour
  const MARI = [0xffc400, 0xffcc10, 0xffb800, 0xffd020, 0xffbe00];
  const ORNG = [0xff8a00, 0xff9a10, 0xff7c00];
  const WHITE = [0xfffaf0, 0xf6f1e6, 0xfdfbf4];
  const ROSE = [0xb0102a, 0xc0122a, 0x9e0c26, 0xb3122e];
  // a toran: a marigold rope with a mango leaf hanging from it every ~12 cm
  const toran = (pts: THREE.Vector3[], rad: number, yaw: number, cols: number[] = MARI) => {
    strand(pts, rad, cols);
    const cv = new THREE.CatmullRomCurve3(pts);
    const n = Math.floor(cv.getLength() / 0.12);
    for (let i = 1; i < n; i++) {
      const p = cv.getPointAt(i / n);
      fl.leaf(p.x, p.y - rad * 0.7, p.z, yaw + (rnd() - 0.5) * 0.5, 0.13 + rnd() * 0.04);
    }
  };
  const pick = (arr: number[]) => arr[Math.floor(rnd() * arr.length)];
  const strand = (pts: THREE.Vector3[], rad: number, cols: number[] | ((u: number) => number[])) => {
    const cv = new THREE.CatmullRomCurve3(pts);
    const L = cv.getLength();
    let u = 0;
    while (u <= 1) {
      const p = cv.getPointAt(Math.min(1, u));
      // tightly strung: each bloom pressed against the next, barely any wander off the thread
      const j = rad * 0.18;
      const r = rad * (0.92 + rnd() * 0.16);
      fl.add(p.x + (rnd() - 0.5) * j, p.y + (rnd() - 0.5) * j, p.z + (rnd() - 0.5) * j, r, pick(typeof cols === 'function' ? cols(u) : cols));
      u += (rad * (1.3 + rnd() * 0.2)) / L;
    }
  };
  // nested garland arches framing the painted face: up from the pitha either side, over the crown,
  // each a little wider and further back; yellow marigold, white, red rose, white, marigold...
  const archCols = [MARI, WHITE, ROSE, MARI, WHITE, MARI, ROSE];
  for (let k = 0; k < 7; k++) {
    const R = 0.47 + k * 0.075, zb = -0.04 - k * 0.05, h = top + 0.02 + k * 0.05;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = Math.PI * t;
      const x = -Math.cos(a) * R, y = lingaY + 0.04 + Math.sin(a) * (h - lingaY - 0.04);
      pts.push(new THREE.Vector3(x, y, zb + Math.sin(a) * 0.02 - (1 - Math.sin(a)) * 0.06));
    }
    strand(pts, 0.05, archCols[k]);
    // the same arch on the back, so the mound reads from the sides
    strand(pts.map((p) => new THREE.Vector3(p.x, p.y, -p.z - 0.25 - k * 0.04)), 0.05, archCols[(k + 2) % 7]);
  }
  // a garland across the top of the face, under the hood
  strand([new THREE.Vector3(-0.38, top - 0.2, 0.18), new THREE.Vector3(0, top + 0.02, 0.26), new THREE.Vector3(0.38, top - 0.2, 0.18)], 0.04, MARI);
  // the heaped skirt of blooms on the jalahari, rising toward the linga, and spilling over the rim
  for (let ring = 0; ring < 6; ring++) {
    const r = 0.5 + ring * 0.1, n = Math.round((Math.PI * 2 * r) / 0.085);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.13;
      const y = lingaY + 0.05 + (5 - ring) * 0.035 + rnd() * 0.03;
      fl.add(Math.cos(a) * r, y, Math.sin(a) * r, 0.055, ring % 3 === 1 ? pick(WHITE) : ring % 3 === 2 ? pick(ROSE) : pick(MARI));
    }
  }
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    if (c > 0.85 && Math.abs(s) < 0.4) continue; // the spout
    strand([new THREE.Vector3(c * 0.98, F + 0.6, s * 0.98), new THREE.Vector3(c * 1.16, F + 0.5, s * 1.16), new THREE.Vector3(c * 1.24, F + 0.3, s * 1.24)], 0.045, k % 3 ? MARI : WHITE);
  }
  // green-and-marigold torans hanging from the canopy, framing the linga, and a swag across its front
  for (const a of [0.55, 0.9, 2.24, 2.59, 3.6, 4.0, 5.4, 5.8]) {
    const c = Math.cos(a), s = Math.sin(a);
    const pts = [new THREE.Vector3(c * CR * 0.98, cy - 0.1, s * CR * 0.98), new THREE.Vector3(c * 1.72, F + 1.6, s * 1.72), new THREE.Vector3(c * 1.62, F + 0.3, s * 1.62)];
    strand(pts, 0.045, (u) => (Math.floor(u * 14) % 2 ? MARI : ORNG));
    const cv = new THREE.CatmullRomCurve3(pts);
    for (let i = 1; i < 9; i++) {
      const p = cv.getPointAt(i / 9);
      for (const sg of [-1, 1]) fl.leaf(p.x, p.y, p.z, Math.atan2(c, s) + sg * 1.2, 0.12);
    }
  }
  for (const z of [1.45]) { // (only across the front: a back swag would hang in front of Maa Parvati)
    toran([new THREE.Vector3(-1.45, cy - 0.12, z), new THREE.Vector3(0, cy - 0.45, z + Math.sign(z) * 0.15), new THREE.Vector3(1.45, cy - 0.12, z)], 0.045, z > 0 ? 0 : Math.PI);
    toran([new THREE.Vector3(-1.45, cy - 0.12, z), new THREE.Vector3(-0.72, cy - 0.32, z + Math.sign(z) * 0.08), new THREE.Vector3(0, cy - 0.12, z)], 0.04, z > 0 ? 0 : Math.PI, ORNG);
    toran([new THREE.Vector3(0, cy - 0.12, z), new THREE.Vector3(0.72, cy - 0.32, z + Math.sign(z) * 0.08), new THREE.Vector3(1.45, cy - 0.12, z)], 0.04, z > 0 ? 0 : Math.PI, ORNG);
  }
  for (let k = 0; k < 140; k++) {
    const a = rnd() * Math.PI * 2, r = 1.25 + rnd() * 0.3;
    fl.petal(Math.cos(a) * r, F + 0.27, Math.sin(a) * r, pick([0xc0122a, 0xd81b37, 0xff8c00, 0xfffaf0, 0xffb000]));
  }
  inside(T.leaf, 0.5);
  // bel (bilva) leaves on the crown
  const leaf = new THREE.SphereGeometry(0.07, 8, 5).scale(0.5, 0.12, 1.0).translate(0, 0, 0.07);
  const leaves = new THREE.InstancedMesh(leaf, T.leaf, 21);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = i === 0 ? 0 : 0.2;
    for (let j = 0; j < 3; j++) {
      leaves.setMatrixAt(i * 3 + j, new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * r, top - 0.02 - r * 0.25, Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, a + (j - 1) * 0.9, 0)), new THREE.Vector3(1, 1, 1)));
    }
  }
  dress.add(leaves);

  // ---- in front of the pitha: a red cloth with a gold border, four brass lotas and two thalis on it
  const red = new THREE.MeshStandardMaterial({ color: 0xd8161c, roughness: 0.8, emissive: 0x2a0204 });
  B.span(red, -1.05, 1.05, F, F + 0.02, 1.72, 2.78);
  for (const [x0, x1, z0, z1] of [[-1.05, 1.05, 1.72, 1.8], [-1.05, 1.05, 2.7, 2.78], [-1.05, -0.97, 1.72, 2.78], [0.97, 1.05, 1.72, 2.78]] as const) B.span(gold, x0, x1, F + 0.005, F + 0.025, z0, z1);
  for (const [x, z] of [[-0.72, 2.05], [-0.28, 2.42], [0.28, 2.42], [0.72, 2.05]] as const) {
    B.lathe(gold, [[0, 0], [0.06, 0], [0.09, 0.04], [0.095, 0.09], [0.06, 0.14], [0.04, 0.17], [0.055, 0.19], [0.03, 0.23], [0, 0.24]], x, F + 0.02, z, 14);
  }
  for (const x of [-0.25, 0.25]) B.lathe(gold, [[0, 0], [0.12, 0], [0.17, 0.02], [0.2, 0.04], [0.19, 0.045], [0, 0.03]], x, F + 0.02, 1.98, 20);
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (0.25 + 0.5 * (k / 4));
    flames.points.push(new THREE.Vector3(Math.cos(a) * 1.36, F + 0.42, Math.sin(a) * 1.36));
  }

  // ---- Maa Parvati right behind the linga: a gold throne under a gold arch with a gold back panel
  const PZ = -1.6, PB = F + 2.0;
  B.span(T.goldWall, -0.6, 0.6, F, PB, PZ - 0.42, PZ + 0.35);
  B.span(T.goldTrim, -0.66, 0.66, PB - 0.07, PB, PZ - 0.46, PZ + 0.4);
  B.span(T.goldWall, -0.66, 0.66, PB, PB + 1.05, PZ - 0.5, PZ - 0.44);
  for (const sg of [-1, 1]) {
    B.lathe(T.goldTrim, [[0, 0], [0.07, 0], [0.07, 0.08], [0.045, 0.16], [0.045, 0.98], [0.075, 1.02], [0.08, 1.06], [0, 1.06]], sg * 0.64, PB, PZ - 0.4, 12);
  }
  B.add(T.goldTrim, new THREE.TorusGeometry(0.64, 0.045, 8, 32, Math.PI).scale(1, 0.6, 1).translate(0, PB + 1.05, PZ - 0.4));
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    B.add(T.goldTrim, new THREE.SphereGeometry(0.04, 8, 6).translate(Math.cos(a) * 0.58, PB + 1.05 + Math.sin(a) * 0.58 * 0.6, PZ - 0.38));
  }
  P.solid(-0.7, F, PZ - 0.5, 0.7, F + 3.4, PZ + 0.4);
  parvati(dress, B, M, T, 0, PB, PZ);
  // marigold garlands framing her arch
  for (const sg of [-1, 1]) strand([new THREE.Vector3(sg * 0.66, PB + 1.35, PZ - 0.3), new THREE.Vector3(sg * 0.72, PB + 0.6, PZ - 0.25), new THREE.Vector3(sg * 0.66, PB - 0.05, PZ - 0.2)], 0.035, MARI);

  fl.flush(dress, T.env);
  B.flush(dress);

  // far proxy: the pitha, the dark linga in its yellow mound and the canopy, as a handful of shapes
  const far = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffb020, roughness: 0.9 });
  const pr = (mat: THREE.Material, prof: [number, number][], y: number) => { const m = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), 16), mat); m.position.y = y; far.add(m); };
  pr(gold, [[0, 0], [1.5, 0], [1.5, 0.5], [0, 0.5]], F);
  pr(yellow, [[0, 0], [0.95, 0], [0.7, 0.4], [0.5, 1.0], [0.2, 1.25], [0, 1.28]], lingaY);
  pr(gold, [[0, 0.62], [0.55 * CR, 0.42], [0.98 * CR, 0], [0, 0]], cy);
  const lod = new THREE.LOD();
  lod.addLevel(dress, 0);
  lod.addLevel(far, 32);
  g.add(lod);
}

/**
 * The painted face of the shringar covering (v = 0 at the foot, 1 at the crown): a deep indigo field, a pointed
 * silver shield / naga-hood emblem with a red inner line on the upper half, small silver eyes and tilak within
 * it, a crescent above; the lower half is left plain under the jewelled fringe.
 */
function shringarTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, '#0b0e2e'); bg.addColorStop(0.5, '#1c2470'); bg.addColorStop(1, '#0b0e2e');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  // a faint silver dot lattice on the indigo
  x.fillStyle = 'rgba(200,205,230,0.35)';
  for (let yy = 12; yy < H; yy += 22) for (let xx = (yy / 22) % 2 ? 11 : 0; xx < W; xx += 22) { x.beginPath(); x.arc(xx, yy, 1.6, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#d8b04a';
  x.fillRect(0, 0, 12, H); x.fillRect(W - 12, 0, 12, H);
  const cx = W / 2;
  // the shield: rounded shoulders, sides sweeping in to a point (row 300 = a little above the jewelled band)
  const shield = (s: number) => {
    const t = 40 + (1 - s) * 30, b = 300 - (1 - s) * 20, w = 150 * s;
    x.beginPath();
    x.moveTo(cx, t + 26 * s);
    x.bezierCurveTo(cx - w * 0.3, t - 6, cx - w, t - 4, cx - w, t + 70 * s);
    x.bezierCurveTo(cx - w, t + 150 * s, cx - w * 0.45, b - 50 * s, cx, b);
    x.bezierCurveTo(cx + w * 0.45, b - 50 * s, cx + w, t + 150 * s, cx + w, t + 70 * s);
    x.bezierCurveTo(cx + w, t - 4, cx + w * 0.3, t - 6, cx, t + 26 * s);
    x.closePath();
  };
  x.lineWidth = 14; x.strokeStyle = '#eceef4'; shield(1); x.stroke();
  x.lineWidth = 6; x.strokeStyle = '#c8142a'; shield(0.86); x.stroke();
  x.lineWidth = 3; x.strokeStyle = '#d8dce6'; shield(0.76); x.stroke();
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 46; i++) { const t = i / 46; x.beginPath(); x.arc(cx + Math.sin(t * Math.PI * 2) * 168, 165 - Math.cos(t * Math.PI * 2) * 140, 3.2, 0, Math.PI * 2); x.fill(); }
  // small silver eyes with dark pupils, the tilak (three silver lines and a red bindu) above them
  for (const sg of [-1, 1]) {
    x.fillStyle = '#e8eaf0';
    x.beginPath(); x.ellipse(cx + sg * 40, 178, 20, 7, sg * -0.15, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0a0a14';
    x.beginPath(); x.arc(cx + sg * 38, 178, 4.5, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = '#eceef4'; x.lineWidth = 4;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 52, 118 + i * 10); x.quadraticCurveTo(cx, 112 + i * 10, cx + 52, 118 + i * 10); x.stroke(); }
  x.fillStyle = '#d8203a'; x.beginPath(); x.ellipse(cx, 150, 5, 9, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#eceef4'; x.beginPath(); x.arc(cx, 78, 16, 0.15 * Math.PI, 0.85 * Math.PI); x.arc(cx, 70, 15, 0.8 * Math.PI, 0.2 * Math.PI, true); x.fill();
  // a small silver ornament at the shield's point
  x.fillStyle = '#eceef4';
  for (let i = -2; i <= 2; i++) { x.beginPath(); x.arc(cx + i * 10, 236 + Math.abs(i) * -4, 4, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#d8203a'; x.beginPath(); x.arc(cx, 254, 7, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Maa Parvati in the sanctum's back niche, seen above the linga at darshan: a white marble figure ~1.1 m tall
 * standing on a gold lotus before a gold prabhavali, in a red-orange vastra with the chunri over the back of
 * her head, a gold mukut, a necklace and a marigold garland; one hand raised in blessing, one holding a lotus.
 * The face is left smooth (no features are modelled).
 */
function parvati(g: THREE.Object3D, B0: Batch, M: Materials, T: TempleMats, x: number, y: number, z: number) {
  // modelled at 1.1 m to the brow and set up at 1.35x, so she reads clearly above the linga as in the photographs
  const K = 1.35;
  const B = { add: (m: THREE.Material, geo: THREE.BufferGeometry) => B0.add(m, geo.translate(-x, -y, -z).scale(K, K, K).translate(x, y, z)) };
  const marble = new THREE.MeshStandardMaterial({ color: 0xfff4e4, roughness: 0.3, emissive: 0xffeedc, emissiveIntensity: 0.85, envMap: T.goldEnv, envMapIntensity: 0.3 });
  const vastra = new THREE.MeshStandardMaterial({ color: 0xe8461a, roughness: 0.7, emissive: 0x2a0802, envMap: T.goldEnv, envMapIntensity: 0.4 });
  const chunri = vastra;
  const GT = T.goldTrim;
  const L = (mat: THREE.Material, prof: [number, number][], seg = 24, sx = 1, sz = 1) => {
    const geo = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), seg).scale(sx, 1, sz).translate(x, y, z);
    B.add(mat, geo);
  };
  const blob = (mat: THREE.Material, rx: number, ry: number, rz: number, px: number, py: number, pz: number, rot = 0) =>
    B.add(mat, new THREE.SphereGeometry(1, 16, 12).scale(rx, ry, rz).rotateZ(rot).translate(x + px, y + py, z + pz));
  // gold lotus pedestal
  L(GT, [[0, 0], [0.3, 0], [0.32, 0.04], [0.24, 0.07], [0.2, 0.1], [0, 0.1]]);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    B.add(GT, new THREE.SphereGeometry(0.075, 8, 5).scale(1, 0.45, 0.55).rotateY(-a).translate(x + Math.cos(a) * 0.25, y + 0.07, z + Math.sin(a) * 0.25));
  }
  // prabhavali: a gold aureole arching behind her, with a beaded rim
  const ring = new THREE.TorusGeometry(0.46, 0.035, 8, 40, Math.PI * 1.25).rotateZ(-Math.PI * 0.125).translate(x, y + 0.7, z - 0.2);
  B.add(GT, ring);
  for (let k = 0; k <= 14; k++) {
    const a = -Math.PI * 0.125 + (k / 14) * Math.PI * 1.25;
    B.add(GT, new THREE.SphereGeometry(0.03, 8, 6).translate(x + Math.cos(a) * 0.52, y + 0.7 + Math.sin(a) * 0.52, z - 0.2));
  }
  // vastra: the pleated skirt to the feet, a gold border at the hem, the bodice
  L(vastra, [[0, 0.1], [0.2, 0.1], [0.19, 0.2], [0.165, 0.45], [0.14, 0.62], [0, 0.62]], 28, 1.05, 0.85);
  L(GT, [[0.205, 0.1], [0.205, 0.145], [0.198, 0.145]], 28, 1.05, 0.85);
  L(vastra, [[0, 0.6], [0.135, 0.6], [0.125, 0.7], [0.135, 0.78], [0.15, 0.84], [0.1, 0.875], [0.04, 0.89], [0, 0.89]], 24, 1.12, 0.75);
  // pallu across the breast to the left shoulder
  B.add(vastra, new THREE.CapsuleGeometry(0.045, 0.3, 2, 10).scale(1, 1, 0.5).rotateZ(-0.55).translate(x - 0.02, y + 0.72, z + 0.09));
  // neck and smooth head
  L(marble, [[0.035, 0.86], [0.033, 0.9], [0, 0.91]], 16);
  blob(marble, 0.066, 0.082, 0.07, 0, 0.965, 0.0);
  // chunri over the back of the head and falling behind the shoulders
  B.add(chunri, new THREE.SphereGeometry(0.098, 18, 12, Math.PI, Math.PI, 0, Math.PI * 0.7).scale(1, 1.15, 1.05).translate(x, y + 0.975, z - 0.005));
  B.add(chunri, new THREE.CylinderGeometry(0.11, 0.2, 0.42, 18, 1, true, Math.PI * 0.55, Math.PI * 0.9).translate(x, y + 0.72, z - 0.02));
  // gold mukut: a tall crown with a fan of points
  L(GT, [[0, 1.02], [0.066, 1.02], [0.07, 1.05], [0.055, 1.1], [0.06, 1.13], [0.035, 1.18], [0.012, 1.24], [0, 1.25]], 18);
  for (let k = -2; k <= 2; k++) {
    B.add(GT, new THREE.ConeGeometry(0.018, 0.08, 6).rotateZ(-k * 0.35).translate(x + Math.sin(k * 0.35) * 0.06, y + 1.1 + Math.cos(k * 0.35) * 0.03, z + 0.05));
  }
  // necklace
  B.add(GT, new THREE.TorusGeometry(0.075, 0.012, 6, 20, Math.PI).rotateX(Math.PI * 0.6).rotateZ(Math.PI).translate(x, y + 0.84, z + 0.06));
  // arms: right forearm raised, palm out in blessing; left holding a pink lotus at the waist
  B.add(vastra, new THREE.CapsuleGeometry(0.032, 0.14, 2, 8).rotateZ(0.5).translate(x + 0.15, y + 0.74, z + 0.02));
  B.add(marble, new THREE.CapsuleGeometry(0.026, 0.13, 2, 8).rotateX(-0.25).translate(x + 0.18, y + 0.73, z + 0.08));
  blob(marble, 0.034, 0.05, 0.016, 0.185, 0.83, 0.12);
  B.add(vastra, new THREE.CapsuleGeometry(0.032, 0.14, 2, 8).rotateZ(-0.35).translate(x - 0.15, y + 0.72, z + 0.02));
  B.add(marble, new THREE.CapsuleGeometry(0.026, 0.13, 2, 8).rotateX(Math.PI / 2 - 0.3).translate(x - 0.16, y + 0.62, z + 0.08));
  blob(GT, 0.045, 0.035, 0.045, -0.16, 0.6, 0.17);
  // marigold garland over the shoulders
  garland(g, M.marigold, new THREE.Vector3(x - 0.13 * K, y + 0.86 * K, z + 0.06 * K), new THREE.Vector3(x + 0.13 * K, y + 0.86 * K, z + 0.06 * K), 0.28 * K, 0.03);
}

/** pigeons perched on the roof courses, as in nearly every photograph of Somnath */
const pigeonSpots: [number, number, number, number][] = [];
function flushPigeons(g: THREE.Group) {
  const body = new THREE.SphereGeometry(0.09, 7, 5).scale(1.6, 1, 1);
  const head = new THREE.SphereGeometry(0.05, 6, 4).translate(0.12, 0.07, 0);
  const geo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; }))!;
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), pigeonSpots.length);
  // blue-grey rock doves, a few darker or pale ones
  const cols = [0x6e737e, 0x7c818c, 0x5c606a, 0x8a8e98, 0x4a4d55, 0xd8d6d0];
  const c = new THREE.Color();
  pigeonSpots.forEach(([x, y, z, r], i) => {
    inst.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(1.1, 1.1, 1.1)));
    inst.setColorAt(i, c.set(cols[Math.floor(rnd() * (rnd() < 0.08 ? 6 : 5))]));
  });
  g.add(inst);
}

let seed = 17;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

type Bloom = 'marigold' | 'rose' | 'jasmine' | 'bead' | 'leaf' | 'petal';

/**
 * Garland flowers as strung in the temple, each kind with its own head: ruffled marigolds (genda) with many
 * shallow petal lobes, red roses as cupped spirals of folded petals, white jasmine buds, smooth beads for
 * jewellery, pointed mango leaves for torans, and loose petals. One instanced mesh per kind, every instance
 * its own colour; no shadow casting (they are small and many).
 */
class Flowers {
  private items: Record<Bloom, [THREE.Matrix4, number][]> = { marigold: [], rose: [], jasmine: [], bead: [], leaf: [], petal: [] };
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private push(kind: Bloom, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, e?: THREE.Euler) {
    this.q.setFromEuler(e ?? this.e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
    this.items[kind].push([new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz)), color]);
  }
  /** a bloom on a garland: the kind follows its colour (white = jasmine, deep red = rose, else marigold) */
  add(x: number, y: number, z: number, r: number, color: number) {
    const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    const s = r * (0.9 + rnd() * 0.2);
    if (hsl.l > 0.8) this.push('jasmine', x, y, z, s * 0.6, s * 0.95, s * 0.6, color);
    else if (hsl.h > 0.9 || hsl.h < 0.02) this.push('rose', x, y, z, s * 1.05, s * 1.05, s * 1.05, color);
    else this.push('marigold', x, y, z, s * 1.12, s * 1.12, s * 1.12, color);
  }
  bead(x: number, y: number, z: number, r: number, color: number) { this.push('bead', x, y, z, r, r, r, color); }
  /** a mango leaf hanging from a toran, its point down, facing `yaw` */
  leaf(x: number, y: number, z: number, yaw: number, size = 0.14) {
    this.push('leaf', x, y, z, size, size, size, rnd() < 0.5 ? 0x2f6a24 : 0x3b7a2c, new THREE.Euler((rnd() - 0.5) * 0.4, yaw, (rnd() - 0.5) * 0.4));
  }
  leafAt(x: number, y: number, z: number) { this.leaf(x, y, z, rnd() * 6.28, 0.08); }
  petal(x: number, y: number, z: number, color: number) {
    const s = 0.025 + rnd() * 0.015;
    this.push('petal', x, y, z, s, s * 0.15, s * 0.8, color, new THREE.Euler(rnd() * 0.4, rnd() * 6, rnd() * 0.4));
  }
  count() { return Object.values(this.items).reduce((n, l) => n + l.length, 0); }
  flush(g: THREE.Object3D, env: THREE.Texture) {
    const geos: Record<Bloom, THREE.BufferGeometry> = {
      marigold: marigoldHead(), rose: roseHead(), jasmine: new THREE.SphereGeometry(1, 7, 5).translate(0, 0.15, 0),
      bead: new THREE.SphereGeometry(1, 8, 6), leaf: mangoLeaf(), petal: new THREE.SphereGeometry(1, 6, 3),
    };
    const col = new THREE.Color();
    for (const kind of Object.keys(this.items) as Bloom[]) {
      const list = this.items[kind];
      if (!list.length) continue;
      const mat = kind === 'bead'
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.3, envMap: env, envMapIntensity: 1.2 })
        // flowers: no dark lamp-lit env (it browned them), matte; they take the sanctum's shadowing (no sun through
        // the roof washing them pastel) and glow faintly in their own colour, like blooms in lamplight (o16)
        : flowerMaterial(kind === 'leaf');
      const inst = new THREE.InstancedMesh(geos[kind], mat, list.length);
      // blooms sit in the lamplight's mid-tones: kept below the tone-mapper's shoulder so their colour stays saturated
      const lum = kind === 'bead' || kind === 'leaf' ? 1 : 0.75;
      list.forEach(([m, c], i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, col.set(c).multiplyScalar(lum)); });
      inst.castShadow = false;
      inst.receiveShadow = true;
      g.add(inst);
    }
  }
}

/** Matte bloom material whose emissive is a fraction of each instance's own colour, so colours stay saturated. */
function flowerMaterial(leaf: boolean) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: leaf ? 0.55 : 0.85, side: leaf ? THREE.DoubleSide : THREE.FrontSide });
  const k = leaf ? 0.08 : 0.16;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)};`)
      // pre-saturate: the AgX tone-mapper washes saturated yellows toward khaki, so push them out before it
      .replace('#include <opaque_fragment>', `{
        float l = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        outgoingLight = max(mix(vec3(l), outgoingLight, ${leaf ? '1.2' : '2.1'}), 0.0);
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'somnath-bloom-' + k;
  return m;
}

/** Genda (marigold) head of unit radius: a dense pom of ruffled petal lobes, a little flattened. */
function marigoldHead() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.17 * Math.sin(x * 9.1) * Math.sin(y * 8.3 + 1.1) * Math.sin(z * 9.7 + 0.4) + 0.06 * Math.sin(x * 23 + z * 19);
    p.setXYZ(i, x * k, y * k * 0.82, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Rose head of unit radius: a cup of petals folded in a spiral round a tight bud, open face up (+y). */
function roseHead() {
  const g = new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const phi = Math.atan2(z, x), th = Math.acos(Math.max(-1, Math.min(1, y)));
    // five overlapping petals whose edges spiral inward, each with a rolled lip
    const fold = 1 + 0.16 * Math.sin(phi * 5 + th * 7) + 0.07 * Math.cos(phi * 10 - th * 4);
    p.setXYZ(i, x * fold, (y - 0.35) * 0.9, z * fold);
  }
  g.rotateX(Math.PI); // the cup opens upward
  g.computeVertexNormals();
  return g;
}

/** Mango leaf of unit length, pointing down (-y) from its stalk at the origin, gently curved. */
function mangoLeaf() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(0.16, -0.2, 0.17, -0.6, 0, -1);
  sh.bezierCurveTo(-0.17, -0.6, -0.16, -0.2, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) / 0.17, 2) * -0.04 + p.getY(i) * p.getY(i) * 0.12);
  g.computeVertexNormals();
  return g;
}

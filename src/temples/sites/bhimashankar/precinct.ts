import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Flag, type Flames, type Physics } from '../../engine/kit';
import type { BM } from './mats';
import { Merger } from './merge';
import { lathe, kalashGeo, archFrameGeo, cuspedArchShape, spindleGeo, clean, plate, rathaPlan, loft, type Ring } from './forms';
import type { Offerings } from './offerings';
import { COURT, RIM, STAIR, MOKSHA, KUSHA, DEEPMAL, DEEPSTAMBH, SHANI, BELL, KAMALAJA, GATE, F, HALL } from './layout';
import { nandiMesh } from './nandi';

/**
 * The sunken precinct round the temple, from the 2011–2024 photographs:
 *  - a courtyard of terracotta-red square tiles in the hollow, walled on three sides by rough basalt
 *    retaining walls (village above to the north, the hill to the east, the slope behind to the west) and
 *    open to the gully of the Bhima on the south;
 *  - the long stairway arriving at the north-west corner; steel-roofed queue sheds along the north wall;
 *  - Mokshakund, a deep stone-walled stepped tank behind (west of) the temple, and the small kund of
 *    Kusharanya tirtha south of the sanctum where the Bhima is said to rise;
 *  - the black deepmal studded with curled lamp brackets at the front corner of the mandapa, a plain
 *    stepped deepstambh beside the main door, a tall saffron flag mast;
 *  - Chimaji Appa's great bell (a Portuguese church bell from Vasai, inscribed 1729, offered after the
 *    1739 victory) hung between two black stone pillars carved with Om, in front of the Shani shrine;
 *  - the gate and steps up to the east lane, and the little whitewashed shrine of Kamalaja Devi there.
 */

export interface PrecinctOut { flags: Flag[]; update(t: number): void }

function textTexture(lines: string[], w = 256, h = 512, bg = '#1c1b1a', fg = '#e9e3d6', size = 34) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.font = `700 ${i === 0 ? size * 2.2 : size}px Martel, "Noto Sans Devanagari", serif`;
    g.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a curled lamp bracket of the deepmal: out from the wall, up, and rolled into a little cup */
function lampArmGeo() {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.16, 0.02, 0), new THREE.Vector3(0.27, 0.1, 0), new THREE.Vector3(0.3, 0.22, 0), new THREE.Vector3(0.26, 0.3, 0)];
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.045, 6, false);
  const cup = new THREE.CylinderGeometry(0.06, 0.04, 0.05, 8).translate(0.26, 0.33, 0);
  return mergeGeometries([clean(tube), clean(cup)], false)!;
}

/** Western bell profile (Portuguese church bell): crown with canons, shoulder, waist, flared sound-bow */
function bellGeo(h: number) {
  const r = h * 0.52;
  const prof: [number, number][] = [[0, h * 1.0], [r * 0.5, h * 1.0], [r * 0.56, h * 0.96], [r * 0.6, h * 0.86], [r * 0.6, h * 0.62], [r * 0.66, h * 0.4],
    [r * 0.8, h * 0.2], [r * 0.97, h * 0.07], [r * 1.0, h * 0.02], [r * 0.98, 0], [r * 0.88, 0.0], [r * 0.86, h * 0.06], [r * 0.7, h * 0.22], [r * 0.56, h * 0.45], [r * 0.5, h * 0.9], [0, h * 0.92]];
  const body = lathe(prof, 40);
  // raised bands (the inscription rings)
  const bands = [h * 0.86, h * 0.8, h * 0.18, h * 0.12].map((y) => {
    const rr = y > h * 0.5 ? r * 0.605 : r * (0.8 + (0.2 - y / h) * 0.9);
    return clean(new THREE.TorusGeometry(rr, h * 0.012, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0));
  });
  // canons (crown loops)
  const canons = [0, 1, 2].map((k) => clean(new THREE.TorusGeometry(h * 0.08, h * 0.022, 6, 12, Math.PI).rotateY((k * Math.PI) / 3).translate(0, h * 1.0, 0)));
  return mergeGeometries([body, ...bands, ...canons], false)!;
}

export function buildPrecinct(root: THREE.Group, K: BM, P: Physics, flames: Flames, O: Offerings): PrecinctOut {
  const g = new THREE.Group();
  g.name = 'precinct';
  root.add(g);
  const B = new Merger(P, 'precinct');
  const Gd = new Merger(P, 'precinct-gold');
  const flags: Flag[] = [];
  const { x0, x1, z0, z1 } = COURT;
  const omPanelMat = new THREE.MeshStandardMaterial({ map: textTexture(['ॐ'], 128, 192, '#1e1c1b', '#c9c2b4', 40), roughness: 0.7, color: 0x9a9a9a });
  const omPanels: THREE.BufferGeometry[] = [];
  const nichePanel = (px: number, py: number, pz: number, ry: number) => {
    omPanels.push(plate(0.36, 0.54).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1))));
  };

  // ---------- courtyard paving and walkable floor ----------
  // the paving (and its walkable floor) is cut round the sunken sanctum and the two kunds
  type R4 = [number, number, number, number];
  let rects: R4[] = [[x0, x1, z0, z1]];
  const holes: R4[] = [
    [-4.75, 4.75, -13.5, HALL.z0],
    [MOKSHA.x0 - 0.4, MOKSHA.x1 + 0.4, MOKSHA.z0 - 0.4, MOKSHA.z1 + 0.4],
    [KUSHA.x - KUSHA.r - 0.3, KUSHA.x + KUSHA.r + 0.3, KUSHA.z - KUSHA.r - 0.3, KUSHA.z + KUSHA.r + 0.3],
  ];
  for (const [h0, h1, k0, k1] of holes) {
    const next: R4[] = [];
    for (const [a0, a1, b0, b1] of rects) {
      if (h1 <= a0 || h0 >= a1 || k1 <= b0 || k0 >= b1) { next.push([a0, a1, b0, b1]); continue; }
      if (h0 > a0) next.push([a0, h0, b0, b1]);
      if (h1 < a1) next.push([h1, a1, b0, b1]);
      const c0 = Math.max(a0, h0), c1 = Math.min(a1, h1);
      if (k0 > b0) next.push([c0, c1, b0, k0]);
      if (k1 < b1) next.push([c0, c1, k1, b1]);
    }
    rects = next;
  }
  for (const [a0, a1, b0, b1] of rects) {
    B.span(K.paving, a0, -0.25, b0, a1, 0, b1);
    P.floor(g, a0, a1, b0, b1, 0);
  }
  // round 3: darker terracotta bands laid in the paving (news_ahmednagar_2026): lines running out from the
  // temple along both axes, framing big panels
  for (const [a0, a1, b0, b1] of rects) {
    for (let k = -6; k <= 6; k++) {
      const x = k * 3.75;
      if (x - 0.15 > a0 && x + 0.15 < a1) B.span(K.pavingBand, x - 0.15, -0.02, b0, x + 0.15, 0.004, b1);
      const z = -8.75 + k * 3.75;
      if (z - 0.15 > b0 && z + 0.15 < b1) B.span(K.pavingBand, a0, -0.02, z - 0.15, a1, 0.004, z + 0.15);
    }
  }
  // a drainage channel along the south edge; a stone apron round the garbhagriha (its walls reach below)
  B.span(K.stone, x0 + 0.4, -0.02, z0 + 0.4, x0 + 0.7, 0.01, z1 - 0.4);
  for (const [a0, a1, b0, b1] of [[-5.3, 5.3, -14.1, -13.4], [-5.3, -4.6, -13.4, -3.9], [4.6, 5.3, -13.4, -3.9]]) B.span(K.stone, a0, -0.3, b0, a1, 0.05, b1);

  // ---------- retaining walls with parapets ----------
  const T = 0.8;
  const wallRun = (ax0: number, ax1: number, az0: number, az1: number, top: number) => {
    B.span(K.rampart, ax0, -0.3, az0, ax1, top, az1, true);
  };
  // north, behind the queue shed (stair corridor left open at the west end)
  wallRun(x1, x1 + T, STAIR.z1, z1 + T, RIM.n);
  // west, behind Mokshakund
  wallRun(x0 - T, x1 + T, z0 - T, z0, RIM.w);
  // east, either side of the gate
  wallRun(x0 - T, -GATE.w / 2 - 0.7, z1, z1 + T, RIM.e);
  wallRun(GATE.w / 2 + 0.7, x1 + T, z1, z1 + T, RIM.e);
  // south: a low parapet over the gully
  wallRun(x0 - 0.5, x0, z0, z1, 0.95);
  B.span(K.stone, x0 - 0.58, 0.95, z0, x0 + 0.06, 1.07, z1);
  P.solid(x0 - 3, -2, z0 - 3, x0, 3, z1 + 3);
  // copings and railings on top of the high walls
  const coping = (ax0: number, ax1: number, az0: number, az1: number, y: number) => B.span(K.stone, ax0 - 0.05, y, az0 - 0.05, ax1 + 0.05, y + 0.12, az1 + 0.05);
  coping(x1, x1 + T, STAIR.z1, z1 + T, RIM.n);
  coping(x0 - T, x1 + T, z0 - T, z0, RIM.w);
  coping(x0 - T, -GATE.w / 2 - 0.7, z1, z1 + T, RIM.e);
  coping(GATE.w / 2 + 0.7, x1 + T, z1, z1 + T, RIM.e);
  // steel railings along the wall tops (the village edge)
  const railRun = (ax: number, az: number, bx: number, bz: number, y: number, mat: THREE.Material = K.paintSteel) => {
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    for (const yy of [0.5, 1.0]) B.place(mat, new THREE.CylinderGeometry(0.025, 0.025, L, 6).rotateZ(Math.PI / 2), (ax + bx) / 2, y + yy, (az + bz) / 2, ry);
    const n = Math.max(1, Math.round(L / 1.5));
    for (let k = 0; k <= n; k++) B.place(mat, new THREE.CylinderGeometry(0.025, 0.025, 1.02, 6), ax + ((bx - ax) * k) / n, y + 0.51, az + ((bz - az) * k) / n);
  };
  railRun(x1 + 0.4, STAIR.z1 + 0.2, x1 + 0.4, z1, RIM.n + 0.12);
  railRun(x0, z0 - 0.4, x1, z0 - 0.4, RIM.w + 0.12);
  railRun(x0, z1 + 0.4, -GATE.w / 2 - 0.7, z1 + 0.4, RIM.e + 0.12);
  railRun(GATE.w / 2 + 0.7, z1 + 0.4, x1, z1 + 0.4, RIM.e + 0.12);

  // ---------- east gate and the steps up to the lane ----------
  {
    const gw = GATE.w, gz = z1 + T / 2, H = 5.2;
    for (const s of [-1, 1]) {
      B.span(K.stone, s * (gw / 2) - (s > 0 ? 0 : 0.75), -0.1, gz - 0.55, s * (gw / 2) + (s > 0 ? 0.75 : 0), H, gz + 0.55, true);
      B.span(K.stone, s * (gw / 2) - (s > 0 ? 0.05 : 0.8), H, gz - 0.6, s * (gw / 2) + (s > 0 ? 0.8 : 0.05), H + 0.2, gz + 0.6);
      B.place(K.stone, new THREE.BoxGeometry(0.7, 0.5, 0.7), s * (gw / 2 + 0.38), H + 0.2, gz);
      B.place(K.stone, lathe([[0, 0], [0.28, 0], [0.32, 0.1], [0.22, 0.3], [0.1, 0.42], [0.12, 0.5], [0, 0.62]], 12, 8, 0.06), s * (gw / 2 + 0.38), H + 0.7, gz);
    }
    // cusped arch spandrel spanning the opening
    const sh = new THREE.Shape();
    sh.moveTo(-gw / 2, 0);
    for (const p of cuspedArchShape(gw, 1.5, 9)) sh.lineTo(p.x, Math.min(p.y, 1.75));
    sh.lineTo(gw / 2, 1.85); sh.lineTo(-gw / 2, 1.85); sh.lineTo(-gw / 2, 0);
    const ag = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false });
    ag.translate(0, 0, -0.55);
    B.place(K.stone, clean(ag), 0, H - 1.85, gz);
    B.place(K.stone, archFrameGeo(gw, H - 1.85, 1.5, 0.16, 0.08, 9), 0, 0, gz - 0.6);
    B.place(K.stone, archFrameGeo(gw, H - 1.85, 1.5, 0.16, 0.08, 9), 0, 0, gz + 0.6, Math.PI);
    B.span(K.stone, -gw / 2 - 0.05, H - 0.05, gz - 0.5, gw / 2 + 0.05, H + 0.2, gz + 0.5);
    B.span(K.stone, -gw / 2 - 0.8, H + 0.2, gz - 0.6, gw / 2 + 0.8, H + 0.35, gz + 0.6);
    B.span(K.frieze, -gw / 2 - 0.75, H - 0.55, gz - 0.62, gw / 2 + 0.75, H - 0.05, gz - 0.55);
    B.span(K.frieze, -gw / 2 - 0.75, H - 0.55, gz + 0.55, gw / 2 + 0.75, H - 0.05, gz + 0.62);
    // a little parapet of cusped openings and lotus-bud urns on top, as on the mandapa
    for (let k = -2; k <= 2; k++) {
      B.span(K.stone, k * 0.95 - 0.08, H + 0.35, gz - 0.12, k * 0.95 + 0.08, H + 0.85, gz + 0.12);
      if (k < 2) B.place(K.stone, archFrameGeo(0.7, 0, 0.3, 0.06, 0.2, 5), k * 0.95 + 0.475, H + 0.35, gz);
    }
    B.span(K.stone, -gw / 2 - 0.3, H + 0.85, gz - 0.16, gw / 2 + 0.3, H + 0.97, gz + 0.16);
    B.place(K.stone, lathe([[0, 0], [0.22, 0], [0.26, 0.1], [0.2, 0.26], [0.1, 0.36], [0.12, 0.42], [0, 0.55]], 12, 8, 0.06), 0, H + 0.97, gz);
    // a bell over the gate
    Gd.place(K.brass, bellGeo(0.32), 0, H - 1.85 + 1.4 - 0.45, gz);
    // steps: 16 risers up to the lane
    const n = 16, rise = RIM.e / n, tread = 0.32, sz = z1 + T;
    for (let i = 0; i < n; i++) B.span(K.steps, -gw / 2, -0.3, sz + i * tread, gw / 2, (i + 1) * rise, sz + (i + 1) * tread);
    B.span(K.steps, -gw / 2, -0.3, z1 - 0.05, gw / 2, 0.02, sz);
    for (const s of [-1, 1]) B.span(K.rampart, s > 0 ? gw / 2 : -gw / 2 - 0.5, -0.3, sz, s > 0 ? gw / 2 + 0.5 : -gw / 2, RIM.e + 0.9, sz + n * tread, true);
    P.floor(g, -gw / 2, gw / 2, z1 - 0.1, sz, 0);
    P.floor(g, -gw / 2, gw / 2, sz, sz + n * tread, 0, RIM.e);
    // the east lane at the top: laterite and stone, shops facing it
    const lz0 = sz + n * tread, lz1 = lz0 + 3.6;
    B.span(K.laterite, x0 - 6, RIM.e - 0.3, lz0, x1 + 2, RIM.e, lz1);
    P.floor(g, x0 - 6, x1 + 2, lz0, lz1, RIM.e);
    P.solid(x0 - 7, 0, lz0 - 1, x0 - 6, 8, lz1 + 1);
    P.solid(x1 + 2, 0, lz0 - 1, x1 + 3, 8, lz1 + 1);
    P.solid(x0 - 7, 0, lz1, x1 + 3, 8, lz1 + 0.5);
  }

  // ---------- Mokshakund: deep stepped tank, walled ----------
  {
    const M = MOKSHA;
    const tiers = 4, td = 0.7;
    for (let k = 0; k < tiers; k++) {
      const yk = -(k + 1) * td, ik = 0.45 * (k + 1), ip = 0.45 * k;
      const rect = (a0: number, a1: number, b0: number, b1: number) => B.span(K.rampart, a0, -M.depth - 0.3, b0, a1, yk + td - td, b1);
      // the ring between inset ip and ik at level yk (top surface)
      rect(M.x0 + ip, M.x1 - ip, M.z0 + ip, M.z0 + ik);
      rect(M.x0 + ip, M.x1 - ip, M.z1 - ik, M.z1 - ip);
      rect(M.x0 + ip, M.x0 + ik, M.z0 + ik, M.z1 - ik);
      rect(M.x1 - ik, M.x1 - ip, M.z0 + ik, M.z1 - ik);
    }
    B.span(K.rampart, M.x0 + 1.8, -M.depth - 0.3, M.z0 + 1.8, M.x1 - 1.8, -M.depth, M.z1 - 1.8);
    // the coping and a low wall round the tank
    for (const [a0, a1, b0, b1] of [[M.x0 - 0.4, M.x1 + 0.4, M.z0 - 0.4, M.z0], [M.x0 - 0.4, M.x1 + 0.4, M.z1, M.z1 + 0.4], [M.x0 - 0.4, M.x0, M.z0, M.z1], [M.x1, M.x1 + 0.4, M.z0, M.z1]]) {
      B.span(K.stone, a0, -0.1, b0, a1, 0.62, b1);
    }
    P.solid(M.x0 - 0.4, -4, M.z0 - 0.4, M.x1 + 0.4, 0.62, M.z1 + 0.4);
    // steps down on the east side, gated
    B.span(K.dark, -0.1 + M.x0 + 3.2, 0, M.z1 - 0.01, M.x0 + 4.8, 0.62, M.z1 + 0.41);
    // water, green with the monsoon, lying on the third tier
    const water = new THREE.Mesh(new THREE.PlaneGeometry(M.x1 - M.x0 - 1.8, M.z1 - M.z0 - 1.8).rotateX(-Math.PI / 2), K.water);
    water.position.set((M.x0 + M.x1) / 2, -1.6, (M.z0 + M.z1) / 2);
    // a stone lining just inside the coping, down to the first tread
    for (const [a0, a1, b0, b1] of [[M.x0, M.x1, M.z0, M.z0 + 0.06], [M.x0, M.x1, M.z1 - 0.06, M.z1], [M.x0, M.x0 + 0.06, M.z0, M.z1], [M.x1 - 0.06, M.x1, M.z0, M.z1]]) {
      B.span(K.rampart, a0, -0.8, b0, a1, 0.02, b1);
    }
    water.receiveShadow = true;
    g.add(water);
    // a small shrine niche in the tank's north wall with a lamp
    B.place(K.stone, archFrameGeo(0.6, 0.5, 0.35, 0.08, 0.08, 5), M.x1 - 0.02, -1.5, (M.z0 + M.z1) / 2, -Math.PI / 2);
  }

  // ---------- Kusharanya tirtha: the small kund where the Bhima rises ----------
  {
    const k = KUSHA, r = k.r;
    for (const [a0, a1, b0, b1] of [[k.x - r - 0.3, k.x + r + 0.3, k.z - r - 0.3, k.z - r], [k.x - r - 0.3, k.x + r + 0.3, k.z + r, k.z + r + 0.3], [k.x - r - 0.3, k.x - r, k.z - r, k.z + r], [k.x + r, k.x + r + 0.3, k.z - r, k.z + r]]) {
      B.span(K.stone, a0, -1.3, b0, a1, 0.45, b1);
    }
    B.span(K.wetStone, k.x - r, -1.3, k.z - r, k.x + r, -0.9, k.z + r);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), K.water);
    water.position.set(k.x, -0.55, k.z);
    g.add(water);
    P.solid(k.x - r - 0.3, -2, k.z - r - 0.3, k.x + r + 0.3, 0.45, k.z + r + 0.3);
    // a gomukh spout on the south side, a little linga and a lamp on the coping
    B.place(K.stone, lathe([[0, 0], [0.09, 0], [0.11, 0.05], [0.08, 0.16], [0, 0.2]], 10).rotateZ(Math.PI / 2), k.x - r - 0.05, 0.1, k.z);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.62, 6, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xdfe8e8, transparent: true, opacity: 0.5, roughness: 0.05, depthWrite: false }));
    stream.position.set(k.x - r + 0.18, -0.24, k.z);
    g.add(stream);
    B.place(K.lingam, lathe([[0, 0], [0.18, 0], [0.18, 0.06], [0.07, 0.07], [0.07, 0.17], [0.05, 0.22], [0, 0.24]], 16), k.x + r + 0.15, 0.45, k.z + r + 0.15);
    O.add('marigold', k.x + r + 0.05, 0.5, k.z + r + 0.2);
    O.add('bel', k.x + r + 0.15, 0.68, k.z + r + 0.15, 1.0);
    flames.points.push(new THREE.Vector3(k.x + r + 0.15, 0.53, k.z - r - 0.15));
  }

  // ---------- the deepmal: a stout black cone on an octagonal stepped pedestal, studded with bud brackets ----------
  {
    const { x, z } = DEEPMAL;
    const H = 6.0, R0 = 1.1, R1 = 0.42;
    // pedestal: three octagonal steps
    for (const [r, y0, y1] of [[1.75, 0, 0.3], [1.55, 0.3, 0.6], [1.35, 0.6, 0.85]] as const) {
      B.place(K.stone, lathe([[0, y0], [r, y0], [r, y1], [0, y1]], 8), x, 0, z, Math.PI / 8);
    }
    // the cone, slightly concave, with thin course lines
    const prof: [number, number][] = [[0, 0.85], [R0 + 0.06, 0.85], [R0 + 0.06, 1.0]];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([R0 + (R1 - R0) * Math.pow(t, 0.85), 1.0 + t * (H - 1.4)]); }
    prof.push([R1 + 0.08, H - 0.35], [R1 + 0.08, H - 0.25], [0.3, H - 0.1], [0.22, H + 0.15], [0.1, H + 0.4], [0, H + 0.5]);
    B.place(K.stone, lathe(prof, 8), x, 0, z, Math.PI / 8);
    // chunky bud-shaped lamp brackets in 8 staggered rows
    const bud = (() => {
      const arm = new THREE.CylinderGeometry(0.07, 0.09, 0.26, 7).rotateZ(Math.PI / 2).translate(0.13, 0, 0);
      const b = lathe([[0, -0.06], [0.11, -0.03], [0.14, 0.06], [0.1, 0.16], [0.04, 0.22], [0, 0.24]], 8).translate(0.3, -0.02, 0);
      return mergeGeometries([clean(arm), clean(b)], false)!;
    })();
    for (let row = 0; row < 8; row++) {
      const t = (row + 0.4) / 8.4, y = 1.0 + t * (H - 1.4), rr = R0 + (R1 - R0) * Math.pow(t, 0.85);
      const n = Math.max(6, Math.round(10 * (rr / R0)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (row % 2) * (Math.PI / n);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rr * 0.95, y, z + Math.sin(a) * rr * 0.95),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(1.2, 1.2, 1.2));
        B.add(K.stone, bud, m);
      }
    }
    P.solid(x - 1.75, 0, z - 1.75, x + 1.75, H, z + 1.75);
    for (let k = 0; k < 10; k += 2) {
      const a = (k / 10) * Math.PI * 2, rr = R0 * 0.95 + 0.36;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * rr, 1.0 + (0.4 / 8.4) * (H - 1.4) + 0.24, z + Math.sin(a) * rr));
    }
  }

  // ---------- deepstambh: a square tapering black obelisk with Om panels and a pointed cap ----------
  {
    const { x, z } = DEEPSTAMBH;
    B.span(K.stone, x - 0.7, 0, z - 0.7, x + 0.7, 0.35, z + 0.7, true);
    B.span(K.stone, x - 0.55, 0.35, z - 0.55, x + 0.55, 0.55, z + 0.55);
    const ob = new THREE.CylinderGeometry(0.35 / Math.SQRT2, 0.75 / Math.SQRT2, 3.6, 4, 1).rotateY(Math.PI / 4);
    B.place(K.core, ob, x, 0.55 + 1.8, z);
    B.place(K.core, new THREE.ConeGeometry(0.3, 0.6, 4).rotateY(Math.PI / 4), x, 4.15 + 0.3, z);
    B.span(K.stone, x - 0.3, 4.1, z - 0.3, x + 0.3, 4.16, z + 0.3);
    // a carved Om panel on each face, a thin sindoor smear
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, d = 0.37;
      nichePanel(x + Math.sin(a) * d, 1.0, z + Math.cos(a) * d, a);
    }
    P.solid(x - 0.7, 0, z - 0.7, x + 0.7, 4.5, z + 0.7);
    flames.points.push(new THREE.Vector3(x, 4.9, z));
  }

  // ---------- Chimaji Appa's bell between two black stone pillars, before the Shani shrine ----------
  {
    const { x, z } = BELL;
    const span = 1.35, pH = 2.7, pw = 0.46;
    const omTex = textTexture(['ॐ', 'श्रीमंत', 'चिमाजी अप्पा', 'इ.स. १७२९'], 256, 640, '#191817', '#d9d2c4', 30);
    const omMat = new THREE.MeshStandardMaterial({ map: omTex, roughness: 0.6, color: 0xbbbbbb });
    for (const s of [-1, 1]) {
      const pz = z + s * (span / 2 + pw / 2);
      B.span(K.dark, x - pw / 2, 0, pz - pw / 2, x + pw / 2, pH, pz + pw / 2, true);
      for (const yy of [0.3, 1.3, 2.3]) B.span(K.stone, x - pw / 2 - 0.03, yy, pz - pw / 2 - 0.03, x + pw / 2 + 0.03, yy + 0.06, pz + pw / 2 + 0.03);
      B.place(K.dark, lathe([[0, 0], [0.3, 0], [0.3, 0.08], [0.2, 0.14], [0.12, 0.3], [0, 0.36]], 4), x, pH, pz, Math.PI / 4);
      // the inscribed face toward the courtyard (north-east)
      const pl = new THREE.Mesh(plate(pw - 0.06, 1.7), omMat);
      pl.position.set(x + pw / 2 + 0.005, 0.5, pz);
      pl.rotation.y = Math.PI / 2;
      g.add(pl);
    }
    // the iron cross-beam and hanger
    B.span(K.iron, x - 0.09, pH - 0.35, z - span / 2 - pw, x + 0.09, pH - 0.18, z + span / 2 + pw);
    B.span(K.iron, x - 0.03, pH - 0.6, z - 0.03, x + 0.03, pH - 0.35, z + 0.03);
    const bell = bellGeo(0.82);
    B.place(K.bellMetal, bell, x, pH - 0.6 - 0.82, z);
    // the clapper and a rope tied with an orange cloth
    B.place(K.iron, new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), x, pH - 1.5, z);
    B.place(K.iron, new THREE.SphereGeometry(0.06, 10, 8), x, pH - 1.5, z);
    P.solid(x - 0.45, 0, z - 0.45, x + 0.45, 1.8, z + 0.45);
  }

  // ---------- Shani shrine: a small black-stone kiosk; the oiled black image of Shani ----------
  {
    const { x, z } = SHANI;
    const w = 2.0, H = 2.5;
    B.span(K.stone, x - w / 2, 0, z - w / 2, x + w / 2, 0.35, z + w / 2, true);
    B.span(K.stone, x - w / 2, 0.35, z - w / 2, x - w / 2 + 0.3, H, z + w / 2, true); // back wall (south)
    for (const s of [-1, 1]) B.span(K.stone, x - w / 2, 0.35, s > 0 ? z + w / 2 - 0.3 : z - w / 2, x + w / 2, H, s > 0 ? z + w / 2 : z - w / 2 + 0.3, true);
    B.span(K.stone, x + w / 2 - 0.3, 1.55, z - w / 2, x + w / 2, H, z + w / 2);
    B.span(K.dark, x - w / 2 + 0.3, 0.35, z - w / 2 + 0.3, x - w / 2 + 0.32, H, z + w / 2 - 0.3);
    B.place(K.stone, archFrameGeo(w - 0.6, 1.2, 0.5, 0.12, 0.1, 7), x + w / 2 + 0.02, 0.35, z, Math.PI / 2);
    B.span(K.stone, x - w / 2 - 0.15, H, z - w / 2 - 0.15, x + w / 2 + 0.15, H + 0.2, z + w / 2 + 0.15);
    B.place(K.stone, spindleGeo(12), x, H + 0.2, z, 0, [0.95, 1.8, 0.95]);
    Gd.place(K.gold, kalashGeo(0.3), x, H + 0.2 + 1.8, z);
    // the image: an upright oiled black stone with a black and orange cloth
    B.place(K.lingam, lathe([[0, 0], [0.2, 0], [0.18, 0.5], [0.15, 0.7], [0.08, 0.8], [0, 0.82]], 16, 0, 0, false), x - 0.3, 0.35, z);
    B.place(K.tarpOrange, lathe([[0.215, 0.25], [0.2, 0.45], [0.19, 0.47], [0.205, 0.26]], 16), x - 0.3, 0.35, z);
    flames.points.push(new THREE.Vector3(x + 0.35, 0.5, z + 0.35));
  }

  // ---------- tall flag mast ----------
  {
    const f = new Flag(g, K.steel, K.saffron, 10.9, 0, -1.5, 13);
    f.mesh.scale.setScalar(1.1);
    flags.push(f);
    // a stepped plinth: a low walkable step and a small socket block (round 3: no invisible 0.5 m wall)
    B.span(K.stone, 10.4, 0, -2.0, 11.4, 0.12, -1.0);
    B.span(K.stone, 10.65, 0.12, -1.75, 11.15, 0.55, -1.25, true);
  }

  // ---------- steel-roofed queue shed along the north wall ----------
  {
    const qx0 = 9.6, qx1 = x1, qz0 = -14, qz1 = 21;
    const yIn = 4.1, yOut = 5.4;
    const cols: number[] = [];
    for (let z = qz0; z <= qz1 + 0.01; z += 3.5) cols.push(z);
    for (const z of cols) {
      B.span(K.paintSteel, qx0 - 0.08, 0, z - 0.08, qx0 + 0.08, yIn, z + 0.08, true);
      // rafter from the column to the wall
      const L = Math.hypot(qx1 + 0.5 - qx0, yOut - yIn);
      const ang = Math.atan2(yOut - yIn, qx1 + 0.5 - qx0);
      const rf = new THREE.BoxGeometry(L, 0.18, 0.1);
      const m = new THREE.Matrix4().compose(new THREE.Vector3((qx0 + qx1 + 0.5) / 2, (yIn + yOut) / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(1, 1, 1));
      B.add(K.paintSteel, rf, m);
    }
    B.span(K.paintSteel, qx0 - 0.1, yIn - 0.2, qz0, qx0 + 0.1, yIn, qz1);
    // the corrugated sheet
    const roof = new THREE.PlaneGeometry(qz1 - qz0 + 0.6, Math.hypot(qx1 + 1 - qx0 + 0.4, yOut - yIn));
    const rm = new THREE.Mesh(roof, K.tin);
    rm.rotation.order = 'YXZ';
    rm.rotation.y = -Math.PI / 2;
    rm.rotation.x = -Math.PI / 2 + Math.atan2(yOut - yIn, qx1 + 1 - qx0);
    rm.position.set((qx0 - 0.4 + qx1 + 1) / 2, (yIn + yOut) / 2 + 0.12, (qz0 + qz1) / 2);
    rm.castShadow = true; rm.receiveShadow = true;
    g.add(rm);
    // queue railings in the shed (zig-zag lanes) and the queue stair coming down the wall from the village
    for (let k = 0; k < 3; k++) railRun(qx0 + 1.2 + k * 1.6, qz0 + (k % 2 ? 2 : 0), qx0 + 1.2 + k * 1.6, qz1 - (k % 2 ? 0 : 2), 0);
    const n = 26, rise = RIM.n / n, tread = 0.3;
    for (let i = 0; i < n; i++) B.span(K.steps, qx1 - 1.5, 0, qz1 - (i + 1) * tread, qx1, RIM.n - i * rise, qz1 - i * tread);
    railRun(qx1 - 1.5, qz1, qx1 - 1.5, qz1 - n * tread, 0.3);
    P.solid(qx1 - 1.6, 0, qz1 - n * tread, qx1, RIM.n, qz1);
  }

  // ---------- Nandi in the mandapa, under the dome, facing the sanctum ----------
  {
    B.span(K.newStone, -0.42, F, HALL.zc - 1.0, 0.42, F + 0.42, HALL.zc + 1.0, true);
    B.span(K.stone, -0.45, F + 0.42, HALL.zc - 1.04, 0.45, F + 0.5, HALL.zc + 1.04);
    const nd = nandiMesh(K.nandi);
    nd.scale.setScalar(0.6);
    nd.position.set(0, F + 0.5, HALL.zc + 0.1);
    g.add(nd);
    // garland and a saffron cloth on the Nandi, flowers on the plinth
    O.strand(new THREE.Vector3(-0.2, F + 0.5 + 0.62, HALL.zc - 0.5), new THREE.Vector3(0.2, F + 0.5 + 0.62, HALL.zc - 0.5), 0.2, 0.9);
    O.heap(0, F + 0.5, HALL.zc - 1.05, 0.12, 0.05, 14);
    // the brass tortoise (kasav) in the floor between the Nandi and the sanctum
    const tort = lathe([[0, 0], [0.3, 0], [0.28, 0.05], [0.2, 0.1], [0, 0.12]], 20);
    tort.scale(1, 1, 0.8);
    Gd.place(K.brassIn, tort, 0, F, HALL.z0 + 1.7);
  }

  // ---------- Kamalaja Devi: a small whitewashed shrine with an ochre base on the east lane ----------
  {
    const { x, z, y } = KAMALAJA;
    const w = 3.2;
    const zz = z + 3.5;
    B.span(K.redOchre, x - w / 2 - 0.3, y - 0.2, zz - w / 2 - 0.3, x + w / 2 + 0.3, y + 0.5, zz + w / 2 + 0.3, true);
    B.span(K.lime, x - w / 2, y + 0.5, zz - w / 2 + 0.6, x + w / 2, y + 3.0, zz + w / 2, true);
    // porch facing west (toward the lane and the temple)
    for (const s of [-1, 1]) B.span(K.lime, x + s * (w / 2 - 0.25) - 0.15, y + 0.5, zz - w / 2 - 0.4, x + s * (w / 2 - 0.25) + 0.15, y + 2.6, zz - w / 2 - 0.1, true);
    B.span(K.lime, x - w / 2 - 0.1, y + 2.6, zz - w / 2 - 0.6, x + w / 2 + 0.1, y + 2.85, zz - w / 2 + 0.6);
    B.place(K.redOchre, archFrameGeo(1.2, 1.3, 0.6, 0.12, 0.08, 7), x, y + 0.5, zz - w / 2 + 0.55, Math.PI);
    B.span(K.dark, x - 0.6, y + 0.5, zz - w / 2 + 0.55, x + 0.6, y + 2.2, zz - w / 2 + 0.6);
    // white nagara spire with ribbed bands, a kalash and a flag
    // a curvilinear spire on a ratha star, banded every storey (rings), lime-washed white
    const plan = rathaPlan(7, 0.1, 0.025);
    const rings: Ring[] = [{ y: 0, s: w * 0.5 }, { y: 0.25, s: w * 0.52 }, { y: 0.35, s: w * 0.48 }];
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = (i + 1) / 6, s0 = w * 0.47 * (1 - 0.7 * Math.pow(t0, 1.5)), s1 = w * 0.47 * (1 - 0.7 * Math.pow(t1, 1.5));
      const y0 = 0.35 + t0 * 3.9;
      rings.push({ y: y0 + 0.02, s: s0 * 1.04 }, { y: y0 + 0.12, s: s0 * 1.04 }, { y: y0 + 0.16, s: s0 * 0.98 }, { y: 0.35 + t1 * 3.9, s: s1 });
    }
    B.place(K.lime, loft(plan, rings, true), x, y + 3.0, zz + 0.3);
    B.place(K.lime, lathe([[0, 0], [0.55, 0], [0.62, 0.1], [0.58, 0.22], [0.4, 0.28], [0, 0.29]], 28, 24, 0.09), x, y + 7.25, zz + 0.3);
    B.place(K.lime, lathe([[0, 0], [0.22, 0], [0.26, 0.12], [0.16, 0.24], [0, 0.26]], 16), x, y + 7.54, zz + 0.3);
    Gd.place(K.gold, kalashGeo(0.5), x, y + 7.8, zz + 0.3);
    const f = new Flag(g, K.steel, K.saffron, x + 0.3, y + 7.6, zz + 0.3, 2.6);
    f.mesh.scale.setScalar(0.5);
    flags.push(f);
    flames.points.push(new THREE.Vector3(x, y + 0.65, zz - w / 2 + 0.3));
  }

  // ---------- vendors at the foot of the stair: flower baskets on cloths, a blue tarp ----------
  for (const [px, pz] of [[13.2, -17.5], [13.2, -14.2], [11.8, -21.6]]) {
    B.span(K.tarpOrange, px - 0.7, 0, pz - 0.5, px + 0.7, 0.02, pz + 0.5);
    for (const [ox, oz] of [[-0.35, -0.2], [0.3, 0.15], [0.35, -0.25]]) {
      B.place(K.wood, lathe([[0, 0], [0.18, 0], [0.24, 0.1], [0.25, 0.12], [0, 0.12]], 12), px + ox, 0.02, pz + oz);
      O.heap(px + ox, 0.14, pz + oz, 0.2, 0.08, 22);
    }
  }
  {
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2, 6, 4), K.tarpBlue);
    const p = tarp.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.3) * 0.08 + Math.cos(p.getY(i) * 2) * 0.05);
    tarp.geometry.computeVertexNormals();
    tarp.rotation.x = -Math.PI / 2 + 0.18;
    tarp.position.set(13.8, 2.6, -15.8);
    tarp.castShadow = true;
    g.add(tarp);
    for (const [ox, oz] of [[-1.6, -2], [1.4, -2], [-1.6, 2], [1.4, 2]] as const) B.span(K.wood, 13.8 + ox - 0.04, 0, -15.8 + oz * 0.8 - 0.04, 13.8 + ox + 0.04, 2.5 + ox * 0.06, -15.8 + oz * 0.8 + 0.04);
  }

  if (omPanels.length) g.add(new THREE.Mesh(mergeGeometries(omPanels, false)!, omPanelMat));
  B.flush(g);
  Gd.flush(g);
  return { flags, update() { /* static */ } };
}

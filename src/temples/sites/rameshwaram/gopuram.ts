import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { Batch, rng } from './batch';
import type { RM } from './mats';

/**
 * Dravidian gateway towers (gopurams) and shrine towers (vimanas), built from the Tamil vocabulary:
 *  - granite base: upapitha and adhishthana mouldings, pilastered walls with niches, the passage,
 *    a deep kapota cornice;
 *  - brick-and-stucco tiers (talas), each a pilastered wall band with a central projection (bhadra)
 *    pierced by a window, a kapota, and a hara: a parapet of miniature shrines — square domed kutas
 *    at the corners, barrel-roofed shalas at the centre, panjaras between — with stucco figures
 *    standing in the bays (relief massing only, no features);
 *  - the crown: a barrel-vaulted shala with latticed sides, horned gable ends, a great arched
 *    kirtimukha frame on each long face, and the row of copper kalashas on the ridge.
 * Everything is emitted into Batches (one mesh per material) — a gopuram costs ~4 draw calls.
 */

/** Matrix-stack emitter on top of a Batch. */
export class Emit {
  private stack: THREE.Matrix4[] = [];
  m = new THREE.Matrix4();
  constructor(public B: Batch) {}
  push(t: THREE.Matrix4) { this.stack.push(this.m.clone()); this.m.multiply(t); }
  pop() { this.m.copy(this.stack.pop()!); }
  geo(mat: THREE.Material, g: THREE.BufferGeometry, c?: THREE.ColorRepresentation | null) {
    this.B.xf = this.m;
    this.B.add(mat, g, c);
    this.B.xf = null;
  }
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, c?: THREE.ColorRepresentation | null) {
    this.geo(mat, new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
  }
  lathe(mat: THREE.Material, prof: [number, number][], x: number, y: number, z: number, seg: number, c?: THREE.ColorRepresentation | null) {
    this.geo(mat, new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(Math.max(r, 1e-4), yy)), seg).translate(x, y, z), c);
  }
}

const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const RY = (a: number) => new THREE.Matrix4().makeRotationY(a);

// ---------- colours ----------

export interface Palette {
  base: THREE.Color; // main stucco
  deep: THREE.Color; // recesses
  trim: THREE.Color; // cornices, mouldings
  figs: THREE.Color[]; // figure tints
}
export function palette(base: number, figs: number[], deepK = 0.62, trimK = 1.04): Palette {
  const b = new THREE.Color(base);
  return {
    base: b,
    deep: b.clone().multiplyScalar(deepK),
    trim: b.clone().multiplyScalar(trimK),
    figs: figs.map((f) => new THREE.Color(f)),
  };
}

// ---------- unit elements (local frame: base at y = 0, centred on x, z = 0 is the ledge centre) ----------

/** Square kuta: base, pilastered cell with a recessed niche, eave, octagonal dome, finial. Height ≈ 1.75 s. */
function kuta(E: Emit, mat: THREE.Material, s: number, pal: Palette, R: () => number) {
  E.box(mat, s, s * 0.22, s, 0, 0, 0, pal.trim);
  E.box(mat, s * 0.82, s * 0.55, s * 0.82, 0, s * 0.22, 0, pal.base);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) E.box(mat, s * 0.14, s * 0.55, s * 0.14, sx * s * 0.38, s * 0.22, sz * s * 0.38, pal.trim);
  E.box(mat, s * 0.36, s * 0.38, s * 0.05, 0, s * 0.27, s * 0.4, pal.deep);
  E.box(mat, s * 1.06, s * 0.1, s * 1.06, 0, s * 0.77, 0, pal.trim);
  E.box(mat, s * 0.62, s * 0.16, s * 0.62, 0, s * 0.87, 0, pal.base);
  const dome: [number, number][] = [[s * 0.44, 0], [s * 0.5, s * 0.12], [s * 0.47, s * 0.3], [s * 0.34, s * 0.46], [s * 0.12, s * 0.56], [0.0, s * 0.58]];
  E.lathe(mat, dome, 0, s * 1.03, 0, 6, R() < 0.65 ? pal.base : pal.figs[Math.floor(R() * pal.figs.length)]);
  E.lathe(mat, [[s * 0.08, 0], [s * 0.03, s * 0.16], [0, s * 0.2]], 0, s * 1.6, 0, 4, pal.trim);
}

/** Shala: oblong cell, eave, barrel roof with arched gable ends and three finials. len along x. */
function shala(E: Emit, mat: THREE.Material, len: number, s: number, pal: Palette) {
  E.box(mat, len, s * 0.22, s, 0, 0, 0, pal.trim);
  E.box(mat, len * 0.9, s * 0.55, s * 0.82, 0, s * 0.22, 0, pal.base);
  const n = Math.max(2, Math.round(len / (s * 0.45)));
  for (let i = 0; i <= n; i++) E.box(mat, s * 0.12, s * 0.55, s * 0.12, -len * 0.42 + (len * 0.84 * i) / n, s * 0.22, s * 0.38, pal.trim);
  E.box(mat, len * 0.3, s * 0.38, s * 0.05, 0, s * 0.27, s * 0.41, pal.deep);
  E.box(mat, len * 1.04, s * 0.1, s * 1.06, 0, s * 0.77, 0, pal.trim);
  // barrel vault along x
  const vault = new THREE.CylinderGeometry(s * 0.4, s * 0.4, len * 0.88, 7, 1, false, 0, Math.PI);
  vault.rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1.25, 1).translate(0, s * 0.87, 0);
  E.geo(mat, vault, pal.base);
  // gable arches (kirtimukha frames) at the two ends and the front
  for (const sx of [-1, 1]) {
    const arch = new THREE.TorusGeometry(s * 0.42, s * 0.06, 3, 7, Math.PI).rotateY(Math.PI / 2).translate(sx * len * 0.45, s * 0.87, 0);
    E.geo(mat, arch, pal.trim);
  }
  const front = new THREE.TorusGeometry(s * 0.3, s * 0.07, 3, 7, Math.PI).translate(0, s * 0.92, s * 0.42);
  E.geo(mat, front, pal.trim);
  for (let i = -1; i <= 1; i++) E.lathe(mat, [[s * 0.08, 0], [s * 0.03, s * 0.16], [0, s * 0.2]], i * len * 0.3, s * 1.36, 0, 4, pal.trim);
}

const GARMENTS = [0xd85a50, 0xf0c040, 0x58a060, 0x4a78c0, 0xe08a30, 0xc05a90, 0xf4f0e4].map((c) => new THREE.Color(c));
const CROWN = new THREE.Color(0xe8c050);

/** Standing stucco figure, relief in front of a wall (facing +z). Height h. Arms: 2 or 4. No features. */
function figure(E: Emit, mat: THREE.Material, h: number, col: THREE.Color, R: () => number, z = 0) {
  const w = h * 0.26;
  E.box(mat, w * 1.3, h * 0.06, h * 0.16, 0, 0, z, col);
  // legs and the lower garment (veshti / sari), painted in its own colour
  const gar = GARMENTS[Math.floor(R() * GARMENTS.length)].clone().lerp(col, 0.35);
  E.lathe(mat, [[w * 0.55, 0], [w * 0.62, h * 0.12], [w * 0.4, h * 0.45], [w * 0.36, h * 0.5]], 0, h * 0.06, z + h * 0.02, 5, gar);
  // torso
  E.lathe(mat, [[w * 0.36, 0], [w * 0.5, h * 0.2], [w * 0.28, h * 0.26]], 0, h * 0.54, z + h * 0.03, 5, col);
  // head and tall crown (kirita-makuta)
  E.geo(mat, new THREE.SphereGeometry(h * 0.07, 5, 4).translate(0, h * 0.86, z + h * 0.04), col);
  E.lathe(mat, [[h * 0.075, 0], [h * 0.05, h * 0.1], [0, h * 0.15]], 0, h * 0.88, z + h * 0.035, 5, CROWN);
  // arms
  const arms = R() < 0.55 ? 2 : 4;
  for (const sx of [-1, 1]) {
    const a = new THREE.CylinderGeometry(h * 0.035, h * 0.03, h * 0.3, 4, 1, true).rotateZ(sx * 0.25).translate(sx * w * 0.62, h * 0.62, z + h * 0.05);
    E.geo(mat, a, col);
    if (arms === 4) {
      const b = new THREE.CylinderGeometry(h * 0.03, h * 0.025, h * 0.24, 4, 1, true).rotateZ(-sx * 0.9).translate(sx * w * 0.75, h * 0.8, z + h * 0.02);
      E.geo(mat, b, col);
    }
  }
}

// ---------- the gopuram ----------

export interface GopuramOpts {
  x: number; z: number;
  /** rotation about y: 0 = front faces +z */
  ry: number;
  /** stone base width (across the passage) and depth (along it) */
  w: number; d: number;
  /** height to the kalasha tips */
  h: number;
  tiers: number;
  stoneH: number;
  passW: number; passH: number;
  kalashas: number;
  /** top tier width/depth as fractions of the base */
  topW?: number; topD?: number;
  pal: Palette;
  seed?: number;
  /** if given, coarse boxes for the sun's shadow go here (the detailed stucco then need not cast) */
  proxy?: Batch;
}

export function gopuram(B: Batch, R: RM, o: GopuramOpts, P?: Physics) {
  const E = new Emit(B);
  const Rn = rng(o.seed ?? 7);
  const S = R.stucco, G = R.granite;
  const pal = o.pal;
  E.push(T(o.x, 0, o.z).multiply(RY(o.ry)));
  const { w, d, stoneH: sh, passW, passH } = o;

  // ---- granite base ----
  const hw = w / 2, hd = d / 2, pw = passW / 2;
  // upapitha + adhishthana mouldings (two blocks either side of the passage)
  const mould: [number, number, number][] = [[0, 0.45, 0.7], [0.45, 0.75, 0.45], [0.75, 1.15, 0.55], [1.15, 1.35, 0.3], [1.35, 1.75, 0.45], [1.75, 1.95, 0.25]];
  for (const [y0, y1, out] of mould) {
    for (const sx of [-1, 1]) {
      const x0 = pw, x1 = hw + out;
      E.box(G, x1 - x0, y1 - y0, d + out * 2, sx * (x0 + x1) / 2, y0, 0);
    }
  }
  const wallTop = sh - 1.7;
  // walls with projections: corner (karna) and central (bhadra) on the long faces
  for (const sx of [-1, 1]) {
    E.box(G, hw - pw, wallTop - 1.95, d, sx * (hw + pw) / 2, 1.95, 0);
    // corner projection
    E.box(G, w * 0.14, wallTop - 1.95, d + 0.5, sx * (hw - w * 0.07), 1.95, 0);
    // pilasters on front/back faces and the sides
    const np = Math.round((hw - pw) / 1.25);
    for (let i = 0; i < np; i++) {
      const px = sx * (pw + 0.7 + i * ((hw - pw - 1.1) / Math.max(1, np - 1)));
      for (const sz of [-1, 1]) {
        E.box(G, 0.34, wallTop - 2.4, 0.16, px, 2.15, sz * (hd + 0.33));
        E.box(G, 0.6, 0.22, 0.24, px, wallTop - 0.5, sz * (hd + 0.33)); // bracket (potika)
        E.box(G, 0.5, 0.18, 0.22, px, 1.95, sz * (hd + 0.33));
      }
    }
    // niches (koshtas) between the door and the corner projections, with a figure in each
    for (const sz of [-1, 1]) {
      const nx = sx * (pw + (hw - pw) * 0.42);
      E.push(T(nx, 0, sz * (hd + 0.02)).multiply(RY(sz > 0 ? 0 : Math.PI)));
      E.box(G, 1.5, 3.2, 0.12, 0, 2.6, 0.03, 0x4a4643);
      E.box(G, 1.9, 0.3, 0.5, 0, 5.8, 0.1);
      figure(E, G, 2.6, new THREE.Color(0x8d8780), Rn, 0.1);
      E.pop();
    }
    // side walls
    const ns = Math.max(2, Math.round(d / 1.4));
    for (let i = 0; i <= ns; i++) {
      const pz = -hd + 0.4 + (i * (d - 0.8)) / ns;
      E.box(G, 0.16, wallTop - 2.4, 0.34, sx * (hw + 0.08), 2.15, pz);
    }
    // a mid cornice dividing the base into two storeys
    E.box(G, hw - pw + 0.3, 0.32, d + 0.6, sx * (hw + pw) / 2, wallTop * 0.56, 0);
  }
  // lintel over the passage, door frame with layered jambs, the open wooden door leaves
  E.box(G, passW, wallTop - passH, d, 0, passH, 0);
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const t = 0.22 + k * 0.18;
      for (const sx of [-1, 1]) E.box(G, 0.22, passH + t, 0.14, sx * (pw + t), 0.3, sz * (hd + 0.05 + k * 0.05));
      E.box(G, passW + 2 * t + 0.22, 0.22, 0.14, 0, passH + t, sz * (hd + 0.05 + k * 0.05));
    }
  }
  for (const sx of [-1, 1]) {
    E.box(R.wood, 0.14, passH - 0.4, passW * 0.5, sx * (pw - 0.1), 0.2, hd - passW * 0.25 - 0.4);
    for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) {
      E.geo(R.brass, new THREE.SphereGeometry(0.06, 6, 4).translate(sx * (pw - 0.18), 0.8 + k * ((passH - 1.6) / 5), hd - 0.6 - j * (passW * 0.5 - 0.4) / 2));
    }
  }
  // passage ceiling in stone, slightly lower than the lintel face
  // main kapota of the base
  E.box(G, w + 0.9, 0.5, d + 0.9, 0, wallTop, 0);
  const kap = new THREE.CylinderGeometry(0.7, 0.7, 1, 4, 1, false).rotateY(Math.PI / 4);
  void kap;
  E.box(G, w + 1.3, 0.35, d + 1.3, 0, wallTop + 0.5, 0);
  E.box(G, w + 0.6, 0.85, d + 0.6, 0, wallTop + 0.85, 0);
  if (P) {
    // colliders: the two halves of the base, leaving the passage
    const m = E.m;
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(sx * pw, 0, -hd).applyMatrix4(m), b = new THREE.Vector3(sx * (hw + 0.7), 0, hd).applyMatrix4(m);
      P.solid(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), sh, Math.max(a.z, b.z));
    }
  }

  // ---- brick-and-stucco tiers ----
  const topW = w * (o.topW ?? 0.55), topD = d * (o.topD ?? 0.46);
  const crownBase = 1.7, vaultH = topD * 0.6, kalH = Math.max(1.6, o.h * 0.076);
  const tiersTotal = o.h - sh - crownBase - vaultH - kalH;
  const th = tiersTotal / o.tiers;
  let y = sh;
  const w0 = w * 0.94, d0 = d * 0.93;
  for (let t = 0; t < o.tiers; t++) {
    const k0 = t / o.tiers;
    const wi = w0 + (topW - w0) * k0, di = d0 + (topD - d0) * k0;
    const wn = w0 + (topW - w0) * ((t + 1) / o.tiers), dn = d0 + (topD - d0) * ((t + 1) / o.tiers);
    tier(E, S, pal, Rn, wi, di, wn, dn, y, th, t, o.tiers);
    if (o.proxy) {
      o.proxy.xf = E.m;
      o.proxy.box(S, wi - 1.7, th, di - 1.7, 0, y, 0);
      o.proxy.xf = null;
    }
    y += th;
  }

  if (o.proxy) {
    o.proxy.xf = E.m;
    o.proxy.box(S, topW - 0.6, crownBase + vaultH * 0.8, topD - 0.6, 0, y, 0);
    o.proxy.xf = null;
  }
  // ---- crown: shala-shikhara ----
  E.box(S, topW + 0.3, 0.35, topD + 0.3, 0, y, 0, pal.trim);
  E.box(S, topW, crownBase - 0.35, topD, 0, y + 0.35, 0, pal.base);
  // seated figures along the band below the vault
  const nf = Math.max(4, Math.round(topW / 1.25));
  for (const sz of [-1, 1]) for (let i = 0; i < nf; i++) {
    const fx = -topW / 2 + 0.6 + (i * (topW - 1.2)) / (nf - 1);
    if (Math.abs(fx) < topW * 0.12) continue;
    E.push(T(fx, y + 0.35, sz * topD / 2).multiply(RY(sz > 0 ? 0 : Math.PI)));
    figure(E, S, crownBase - 0.45, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn, 0.05);
    E.pop();
  }
  y += crownBase;
  // the barrel vault (latticed), along x
  const vShape = new THREE.Shape();
  const vr = topD / 2;
  vShape.moveTo(-vr, 0);
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    vShape.lineTo(Math.cos(a) * vr, Math.sin(a) * vaultH * (1 + 0.12 * Math.sin(a)));
  }
  vShape.lineTo(-vr, 0);
  const vg = new THREE.ExtrudeGeometry(vShape, { depth: topW, bevelEnabled: false, curveSegments: 2 });
  vg.translate(0, 0, -topW / 2).rotateY(Math.PI / 2).translate(0, y, 0);
  E.geo(S, vg, pal.base);
  // lattice ribs across the vault
  const nr = Math.round(topW / 0.7);
  for (let i = 1; i < nr; i++) {
    const rx = -topW / 2 + (i * topW) / nr;
    const rib = new THREE.TorusGeometry(vr * 1.01, 0.05, 3, 12, Math.PI).scale(1, vaultH / vr, 1).rotateY(Math.PI / 2).translate(rx, y, 0);
    E.geo(S, rib, pal.trim);
  }
  // ridge
  E.box(S, topW + 0.2, 0.28, 0.5, 0, y + vaultH * 1.04, 0, pal.trim);
  // gable ends with horns (curling makara/yali ends rising above the ridge)
  for (const sx of [-1, 1]) {
    const gable = new THREE.TorusGeometry(vr * 1.05, 0.22, 5, 16, Math.PI).scale(1, vaultH / vr, 1).rotateY(Math.PI / 2).translate(sx * topW / 2, y, 0);
    E.geo(S, gable, pal.trim);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * topW / 2, y + vaultH * 0.6, 0),
      new THREE.Vector3(sx * (topW / 2 + 0.55), y + vaultH * 1.2, 0),
      new THREE.Vector3(sx * (topW / 2 + 0.35), y + vaultH * 1.85, 0),
      new THREE.Vector3(sx * (topW / 2 - 0.5), y + vaultH * 2.05, 0),
      new THREE.Vector3(sx * (topW / 2 - 0.85), y + vaultH * 1.65, 0),
    ]);
    const horn = new THREE.TubeGeometry(curve, 16, Math.max(0.42, vaultH * 0.13), 7, false);
    // taper the tube toward the curl
    const p = horn.attributes.position;
    const c0 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 8) / 16;
      curve.getPointAt(Math.min(1, seg), c0);
      const k = 1 - seg * 0.55;
      p.setXYZ(i, c0.x + (p.getX(i) - c0.x) * k, c0.y + (p.getY(i) - c0.y) * k, c0.z + (p.getZ(i) - c0.z) * k);
    }
    horn.computeVertexNormals();
    E.geo(S, horn, pal.trim);
  }
  // the great kirtimukha arch on each long face, with a window below and a crest above the ridge
  for (const sz of [-1, 1]) {
    E.push(T(0, y, sz * vr * 0.98).multiply(RY(sz > 0 ? 0 : Math.PI)));
    const ar = vaultH * 0.95;
    E.geo(S, new THREE.TorusGeometry(ar, 0.24, 5, 18, Math.PI).translate(0, 0.2, 0.25), pal.trim);
    E.geo(S, new THREE.TorusGeometry(ar * 0.72, 0.12, 4, 16, Math.PI).translate(0, 0.2, 0.3), pal.figs[0]);
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      E.geo(S, new THREE.SphereGeometry(0.22, 6, 4).translate(Math.cos(a) * (ar + 0.3), 0.2 + Math.sin(a) * (ar + 0.3), 0.25), pal.trim);
    }
    E.box(S, ar * 0.9, ar * 0.9, 0.3, 0, 0.0, 0.05, pal.base);
    E.box(S, 0.7, 1.0, 0.1, 0, 0.1, 0.22, pal.deep);
    // crest boss (the kirtimukha mask, as a stylised lobed crown)
    E.lathe(S, [[0.0, 0], [0.75, 0.05], [0.85, 0.5], [0.55, 1.0], [0.2, 1.35], [0, 1.4]], 0, ar + 0.2, 0.15, 10, pal.trim);
    E.pop();
  }
  // kalashas on the ridge
  const kp: [number, number][] = [[0.46, 0], [0.5, 0.06], [0.3, 0.12], [0.56, 0.3], [0.58, 0.42], [0.32, 0.55], [0.4, 0.62], [0.42, 0.7], [0.22, 0.78], [0.28, 0.84], [0.12, 0.93], [0.03, 1], [0, 1.03]];
  const kn = o.kalashas;
  const span = topW * 0.78;
  for (let i = 0; i < kn; i++) {
    const kx = kn === 1 ? 0 : -span / 2 + (i * span) / (kn - 1);
    E.lathe(R.copper, kp.map(([r, yy]) => [r * kalH * 0.36, yy * kalH] as [number, number]), kx, y + vaultH * 1.04, 0, 14);
  }
  E.pop();
  return { top: y + vaultH + kalH };
}

interface Strip { x0: number; x1: number; off: number; kind: 'karna' | 'recess' | 'panjara' | 'shala' | 'bhadra' }

/**
 * Divide a face of length L into the projecting and recessed vertical strips of a Dravida elevation:
 * karna (corner) · recess · panjara · recess · shala · recess · bhadra (centre) · … mirrored.
 * The strips shrink with each tier, so the ribs converge up the tower.
 */
function strips(L: number, long: boolean): Strip[] {
  const spec: [Strip['kind'], number, number][] = long
    ? [['karna', 0.115, 0], ['recess', 0.045, -0.5], ['panjara', 0.085, -0.18], ['recess', 0.04, -0.5], ['shala', 0.1, 0.02], ['recess', 0.04, -0.45], ['bhadra', 0.15, 0.45]]
    : [['karna', 0.2, 0], ['recess', 0.07, -0.45], ['panjara', 0.1, -0.12], ['recess', 0.05, -0.45], ['bhadra', 0.16, 0.25]];
  const sum = spec.reduce((a, [, w]) => a + w, 0) - spec[spec.length - 1][1] / 2;
  const k = L / 2 / sum;
  const out: Strip[] = [];
  let x = -L / 2;
  const half = spec.map(([kind, w, off]) => ({ kind, w: w * k, off }));
  const full = [...half, ...half.slice(0, -1).reverse()];
  full.forEach((s, i) => {
    const w = i === half.length - 1 ? s.w : s.w;
    out.push({ x0: x, x1: x + w, off: s.off, kind: s.kind });
    x += w;
  });
  return out;
}

/** One tier: articulated wall band with niches and figures; kapota; a contiguous hara of miniature shrines. */
function tier(E: Emit, S: THREE.Material, pal: Palette, Rn: () => number, wi: number, di: number, wn: number, dn: number,
  y: number, th: number, t: number, n: number) {
  const wallH = th * 0.47, kapH = th * 0.12;
  const core = 0.7; // the core wall sits this far behind the nominal face
  E.box(S, wi - core * 2, wallH + kapH, di - core * 2, 0, y, 0, pal.deep);
  const faces: [number, number, number, boolean][] = [[wi, di / 2, 0, true], [wi, di / 2, Math.PI, true], [di, wi / 2, Math.PI / 2, false], [di, wi / 2, -Math.PI / 2, false]];
  const s = th * 0.5 / 1.75;
  for (const [L, off, rot, long] of faces) {
    E.push(RY(rot).multiply(T(0, y, off)));
    const st = strips(L, long);
    for (const p of st) {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      const front = p.off;
      const depth = front + core;
      const col = p.kind === 'recess' ? pal.base.clone().multiplyScalar(0.9) : pal.base;
      E.box(S, w, wallH, depth, cx, 0, front - depth / 2, col);
      if (p.kind === 'recess') {
        // a slender pot-pilaster (kumbha-panjara) in the recess
        E.box(S, 0.12, wallH * 0.8, 0.12, cx, 0.1, front + 0.06, pal.trim);
        E.lathe(S, [[0.0, 0], [0.2, 0.12], [0, 0.26]], cx, wallH * 0.12, front + 0.12, 4, pal.trim);
        continue;
      }
      // pilasters at the strip edges, with brackets
      for (const ex of [p.x0 + 0.1, p.x1 - 0.1]) {
        E.box(S, 0.16, wallH * 0.92, 0.14, ex, 0.04, front + 0.07, pal.trim);
        E.box(S, 0.36, 0.12, 0.26, ex, wallH * 0.88, front + 0.1, pal.trim);
      }
      if (p.kind === 'bhadra' && long) {
        // window in a stucco frame, a figure either side
        const ww = Math.min(1.1, w * 0.3);
        E.box(S, ww, wallH * 0.62, 0.08, cx, wallH * 0.14, front + 0.02, 0x15110e);
        E.box(S, ww + 0.4, 0.2, 0.22, cx, wallH * 0.76, front + 0.1, pal.trim);
        E.box(S, ww + 0.3, 0.14, 0.2, cx, wallH * 0.1, front + 0.1, pal.trim);
        for (const sx of [-1, 1]) {
          E.push(T(cx + sx * (ww / 2 + w * 0.2), 0.05, front));
          figure(E, S, wallH * 0.92, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn, 0.02);
          E.pop();
        }
      } else {
        // a niche with a figure
        E.box(S, Math.min(w * 0.55, 1.0), wallH * 0.7, 0.06, cx, wallH * 0.12, front + 0.0, pal.deep);
        E.push(T(cx, 0.06, front));
        figure(E, S, wallH * 0.9, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn, 0.02);
        E.pop();
        if (w > 1.25) {
          for (const sx of [-1, 1]) {
            E.push(T(cx + sx * w * 0.32, 0.06, front));
            figure(E, S, wallH * 0.8, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn, 0.02);
            E.pop();
          }
        }
      }
    }
    // kapota following the projections: a drooping cornice per strip
    for (const p of st) {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      const f = p.off + 0.35;
      E.box(S, w + 0.02, kapH * 0.3, f + core, cx, wallH, f - (f + core) / 2, pal.trim);
      const k = new THREE.BoxGeometry(w + 0.02, kapH * 0.55, 0.5);
      const kp = k.attributes.position;
      for (let i = 0; i < kp.count; i++) if (kp.getZ(i) > 0 && kp.getY(i) > 0) kp.setY(i, kp.getY(i) - kapH * 0.25);
      k.computeVertexNormals();
      E.geo(S, k.translate(cx, wallH + kapH * 0.3 + kapH * 0.275, f - 0.15), pal.trim);
      E.box(S, w, kapH * 0.15, f + core - 0.2, cx, wallH + kapH * 0.85, f - 0.1 - (f + core - 0.2) / 2, pal.base);
      // kudus: little horseshoe arches with a crest set into the cornice's face, every ~0.9 m
      const nk = Math.max(1, Math.floor(w / 0.9));
      for (let i = 0; i < nk; i++) {
        const kx = p.x0 + (i + 0.5) * (w / nk), kr = Math.min(0.24, kapH * 0.32);
        E.geo(S, new THREE.TorusGeometry(kr, kr * 0.22, 3, 8, Math.PI * 1.3).rotateZ(-Math.PI * 0.15).translate(kx, wallH + kapH * 0.25, f + 0.13), pal.trim);
        E.geo(S, new THREE.SphereGeometry(kr * 0.3, 5, 4).translate(kx, wallH + kapH * 0.25 + kr * 1.25, f + 0.13), pal.trim);
      }
    }
    // hara: one miniature shrine per strip, sitting on the cornice
    const hy = wallH + kapH;
    for (const p of st) {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      const zf = p.off + 0.3 - s * 0.55;
      E.push(T(cx, hy, zf));
      if (p.kind === 'karna') kuta(E, S, Math.min(w * 0.95, s * 1.15), pal, Rn);
      else if (p.kind === 'recess') {
        if (w > 0.5) figure(E, S, s * 1.4, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn, 0.1);
      } else if (p.kind === 'panjara') kuta(E, S, Math.min(w * 0.9, s), pal, Rn);
      else shala(E, S, w * 0.92, p.kind === 'bhadra' ? s * 1.15 : s, pal);
      E.pop();
    }
    E.pop();
  }
  void wn; void dn; void t; void n;
}

// ---------- vimana (shrine tower) ----------

export interface VimanaOpts {
  x: number; z: number; ry: number;
  /** base half-size (square) */
  half: number;
  /** height of the granite walls (garbhagriha) */
  wallH: number;
  talas: number;
  /** dome form: 'square' (nagara), 'octagon' (dravida), 'round' (vesara) */
  dome: 'square' | 'octagon' | 'round';
  pal: Palette;
  kalashMat: THREE.Material;
  seed?: number;
  /** a real chamber inside, with a door on the front (+z) face */
  hollow?: { inner: number; doorW: number; doorH: number; innerMat?: THREE.Material };
}

/** A Dravida vimana over a garbhagriha: granite walls with pilasters and koshtas, stucco talas, griva and dome. */
export function vimana(B: Batch, R: RM, o: VimanaOpts) {
  const E = new Emit(B);
  const Rn = rng(o.seed ?? 3);
  const S = R.stucco, G = R.granite;
  const pal = o.pal;
  E.push(T(o.x, 0, o.z).multiply(RY(o.ry)));
  const h = o.half;
  // adhishthana
  E.box(G, h * 2 + 0.7, 0.4, h * 2 + 0.7, 0, 0, 0);
  E.box(G, h * 2 + 0.45, 0.35, h * 2 + 0.45, 0, 0.4, 0);
  E.box(G, h * 2 + 0.6, 0.3, h * 2 + 0.6, 0, 0.75, 0);
  E.box(G, h * 2 + 0.3, 0.3, h * 2 + 0.3, 0, 1.05, 0);
  // walls with pilasters and three koshtas (the front is the shrine's door)
  const H = o.wallH - 1.35;
  if (o.hollow) {
    const { inner: n, doorW, doorH } = o.hollow, t = h - n;
    const Gi = o.hollow.innerMat ?? G;
    // (the chamber walls are lamp-blackened inside; outside they stand under the mandapam roofs)
    E.box(Gi, h * 2, H, t, 0, 1.35, -h + t / 2);
    for (const sx of [-1, 1]) E.box(Gi, t, H, n * 2, sx * (h - t / 2), 1.35, 0);
    for (const sx of [-1, 1]) E.box(Gi, h - doorW / 2, H, t, sx * (doorW / 2 + (h - doorW / 2) / 2), 1.35, h - t / 2);
    E.box(Gi, doorW, H - doorH, t, 0, 1.35 + doorH, h - t / 2);
    // dark lamp-blackened inner faces and the corbelled ceiling of the chamber
    E.box(Gi, n * 2, 0.05, n * 2, 0, o.wallH - 0.6, 0);
    E.box(Gi, n * 2, 0.04, 0.04, 0, 1.35, -n + 0.02);
    // door frame: three receding jambs in polished stone
    for (let k = 0; k < 3; k++) {
      const d = 0.12 + k * 0.12;
      for (const sx of [-1, 1]) E.box(Gi, 0.12, doorH + d, 0.1, sx * (doorW / 2 + d), 1.35, h + 0.02 + k * 0.04);
      E.box(Gi, doorW + 2 * d + 0.12, 0.12, 0.1, 0, 1.35 + doorH + d, h + 0.02 + k * 0.04);
    }
  } else {
    E.box(G, h * 2, H, h * 2, 0, 1.35, 0);
  }
  for (let f = 0; f < 4; f++) {
    E.push(RY((f * Math.PI) / 2).multiply(T(0, 0, h)));
    const np = Math.max(2, Math.round(h / 0.7));
    for (let i = 0; i <= np; i++) {
      const px = -h + 0.25 + (i * (2 * h - 0.5)) / np;
      if (f === 0 && o.hollow && Math.abs(px) < o.hollow.doorW / 2 + 0.6) continue;
      E.box(G, 0.22, o.wallH - 1.6, 0.14, px, 1.4, 0.06);
    }
    if (f !== 0) {
      E.box(G, 0.9, 1.9, 0.2, 0, 1.6, 0.1, 0x3c3936);
      E.box(G, 1.3, 0.22, 0.38, 0, 3.55, 0.12);
      E.push(T(0, 1.65, 0.12));
      figure(E, G, 1.6, new THREE.Color(0x8d8780), Rn, 0.05);
      E.pop();
    }
    E.pop();
  }
  // cornice
  let y = o.wallH;
  E.box(G, h * 2 + 0.7, 0.3, h * 2 + 0.7, 0, y, 0);
  E.box(G, h * 2 + 0.4, 0.3, h * 2 + 0.4, 0, y + 0.3, 0);
  y += 0.6;
  // stucco talas
  let wi = h * 2;
  const th = Math.max(1.4, h * 0.55);
  for (let t = 0; t < o.talas; t++) {
    const wn = wi * 0.78;
    // parapet hara on this level: kutas at corners, shalas mid-face
    for (let f = 0; f < 4; f++) {
      E.push(RY((f * Math.PI) / 2).multiply(T(0, y, wi / 2 - 0.35)));
      const s = Math.min(0.75, th * 0.42);
      for (const sx of [-1, 1]) { E.push(T(sx * (wi / 2 - s * 0.55), 0, 0)); kuta(E, S, s, pal, Rn); E.pop(); }
      shala(E, S, Math.min(wi * 0.3, 2.2), s * 1.05, pal);
      E.pop();
    }
    E.box(S, wn, th, wn, 0, y, 0, pal.base);
    for (let f = 0; f < 4; f++) {
      E.push(RY((f * Math.PI) / 2).multiply(T(0, y, wn / 2)));
      E.box(S, wn * 0.3, th * 0.8, 0.2, 0, 0.1, 0.05, pal.trim);
      E.box(S, 0.5, th * 0.5, 0.06, 0, 0.25, 0.16, pal.deep);
      for (const sx of [-1, 1]) { E.push(T(sx * wn * 0.32, 0.05, 0.05)); figure(E, S, th * 0.75, pal.figs[Math.floor(Rn() * pal.figs.length)], Rn); E.pop(); }
      E.pop();
    }
    E.box(S, wn + 0.45, 0.22, wn + 0.45, 0, y + th, 0, pal.trim);
    y += th + 0.22;
    wi = wn;
  }
  // griva (neck) with four seated figures (Dakshinamurthy etc. in the real vimanas: massing only)
  const gr = wi * 0.36;
  E.box(S, wi * 0.85, 0.3, wi * 0.85, 0, y, 0, pal.trim);
  y += 0.3;
  const gseg = o.dome === 'square' ? 4 : o.dome === 'octagon' ? 8 : 16;
  E.lathe(S, [[gr, 0], [gr, th * 0.6], [gr * 1.05, th * 0.65]], 0, y, 0, gseg, pal.base);
  for (let f = 0; f < 4; f++) {
    E.push(RY((f * Math.PI) / 2 + (gseg === 4 ? Math.PI / 4 : 0)).multiply(T(0, y, gr)));
    E.box(S, gr * 0.7, th * 0.55, 0.3, 0, 0, 0.1, pal.base);
    E.box(S, gr * 0.4, th * 0.38, 0.08, 0, 0.06, 0.25, pal.deep);
    E.pop();
  }
  y += th * 0.65;
  // the dome (shikhara)
  const dr = gr * 1.55;
  const prof: [number, number][] = [[dr * 0.92, 0], [dr, dr * 0.18], [dr * 0.98, dr * 0.38], [dr * 0.85, dr * 0.62], [dr * 0.6, dr * 0.85], [dr * 0.3, dr * 1.0], [dr * 0.12, dr * 1.04], [0, dr * 1.05]];
  E.lathe(S, prof, 0, y, 0, gseg, pal.base);
  // nasika (horseshoe dormers) on the four faces of the dome
  for (let f = 0; f < 4; f++) {
    E.push(RY((f * Math.PI) / 2 + (gseg === 4 ? Math.PI / 4 : 0)).multiply(T(0, y + dr * 0.25, dr * 0.9)));
    E.geo(S, new THREE.TorusGeometry(dr * 0.32, 0.1, 4, 12, Math.PI), pal.trim);
    E.geo(S, new THREE.SphereGeometry(0.16, 6, 4).translate(0, dr * 0.42, 0), pal.trim);
    E.pop();
  }
  y += dr * 1.02;
  E.lathe(o.kalashMat, [[0.14, 0], [0.32, 0.12], [0.36, 0.3], [0.18, 0.5], [0.22, 0.6], [0.1, 0.78], [0.05, 0.98], [0, 1.02]].map(([r, yy]) => [r * dr * 0.45, yy * dr * 0.7] as [number, number]), 0, y, 0, 16);
  E.pop();
  return { top: y + dr * 0.7 };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from '../../engine/materials';
import { worldUV } from '../../engine/materials';
import { box, archPanelGeometry, type Physics } from '../../engine/kit';
import { carvedPillars } from './pillars';
import { lokGate, lokMats, PROMENADE, LAKE_LINK, CORRIDOR, KAMAL_KUND } from './mahakallok';
import { StatueBatch } from './statues';
import { Marigolds } from './marigold';
import type { MahakalMats } from './mats';
import { CrowdSpots, type CrowdSpot } from './crowd';
import { SANCTUM } from './temple';
import { GM, NH, VIP_DARSHAN, FRONT } from './mode';

/**
 * The general (free) darshan route at Shri Mahakaleshwar, as the temple runs it today.
 *
 * Sources: Free Press Journal (general devotees enter from Shri Mahakal Lok or the Mansarovar facility
 * centre, go through Mahakal Tunnel-1 to the Ganesh Mandapam for darshan and leave by the Palki Hall
 * and the Ambulance Gate); ETV Bharat (Sawan 2025, Mahashivratri 2025, new year 2026: Nandi Dwar →
 * Mansarovar → facility centre-1 → tunnel → Kartikeya / Ganesh Mandapam); univarta (the garbhagriha
 * has been closed to general devotees since 2020; the Nandi hall is for VIPs). In this virtual yatra the way on
 * into the sanctum is open to everyone: the platform's gate, the Nandi hall, and the east stair.
 *
 * In our model (+z = south, the way the Jyotirlinga faces) Mahakal Lok and the Mansarovar facility lie
 * beyond the north gate, so:
 *
 *  1. QUEUE: barricaded zig-zag lanes under steel sheds in the north court (Q), entered from the gate.
 *  2. TUNNEL: Mahakal Tunnel-1, a covered tiled ramp west of the temple (T) going down to y = -3, then
 *     south under the court, turning east into the back of the Ganesh Mandapam.
 *  3. GANESH MANDAPAM: a pillared hall under the front hall (GM). Pilgrims walk down the west aisle
 *     and along the front row behind the barricade, looking north through the Nandi hall and the
 *     silver doorway to the lingam; packed standing tiers rise behind them. LED screens show the lingam.
 *  4. EXIT: up the east aisle into the Palki Hall (PH), then a sunken ramp (EX) up into the front court.
 */

/** Queue lanes: barricade lines at z = LINES (north to south) between x = X0 and X1; openings 2 m wide alternate ends. */
export const Q = { X0: -11, X1: 7, LINES: [-35.8, -31.4, -27.0, -22.6], OPEN: 2 };
/** Mahakal Tunnel-1: x X0..X1; the covered ramp z ZTOP (y 0) → ZBOT (y FLOOR); flat to ZUP0, up to the back aisle level by ZUP1; the turn east is z ZUP1..ZEND. */
export const T = { X0: -10.1, X1: -7.9, ZTOP: -21.6, ZBOT: -8, FLOOR: -3.0, ZUP0: 8.6, ZUP1: 10.6, ZEND: 12.6 };
/** standing tiers of the Ganesh Mandapam (x ±TX), front to back, and the back-aisle level */
const TX = 5;
const LANE_A = { Z0: 1.6, Z1: 3.8 };
const TIERS = [{ z0: 3.8, z1: 6.0, y: -2.85 }, { z0: 6.0, z1: 8.2, y: -2.7 }, { z0: 8.2, z1: 10.4, y: -2.55 }];
const BACK = -2.55;
/** the raised darshan platform at the head of the front row, between the Nandi hall's jambs */
export const PLAT = { X: 3.3, Z0: 0.4, Z1: 1.6, Y: GM.FLOOR + 0.45 };
/** Palki Hall and the sunken exit ramp up to the front court */
export const PH = { X0: -1, X1: 7, Z0: GM.Z1, Z1: 17, Y: BACK };
export const EX = { X0: 2.2, X1: 4.8, Z0: 17, Z1: 27 };

/** The walking line of the general route (x, z), used to keep the crowd clear of the pilgrim. */
export const ROUTE: [number, number][] = [
  [-2, -61], [-2, -44], [-2, -39.0], [1.0, -38.4], [6, -38.0], [6, -33.6], [-10, -33.6], [-10, -29.2], [6, -29.2], [6, -24.8], [-10, -24.8],
  [-9.6, -22.4], [-9, -21], [-9, 11.6], [-6, 11.6], [-6, 2.5], [-2.6, 2.5], [-2.6, 1.0], [2.6, 1.0], [2.6, 2.5], [6, 2.5],
  [6, 13.8], [3.5, 16], [3.5, 30],
];
/** the approach from Shri Mahakal Lok outside the north gate: x A.X0..A.X1, z A.Z0 (far end) .. A.Z1 (the wall) */
export const APPROACH = { X0: -14, X1: 10, Z0: -68, Z1: -44 };
/** where the pilgrim appears (feet) and looks: outside the north (Mahakal Lok) gate, facing it */
export const SPAWN = { feet: [-2, 0, -61] as [number, number, number], look: [-2, 3.2, -40] as [number, number, number] };
/** the darshan spot at the Ganesh Mandapam barricade, on the axis of the sanctum doorway */
export const DARSHAN_SPOT = { feet: [0, GM.FLOOR + 0.45, 1.0] as [number, number, number], look: [0, SANCTUM.FLOOR + 0.95, SANCTUM.Z] as [number, number, number] };

/** Courtyard paving holes [x0, x1, z0, z1] the route needs (the paving is cut before it is built). */
export function pavingHoles(): [number, number, number, number][] {
  const ramp: [number, number, number, number] = [T.X0 - 0.3, T.X1 + 0.3, T.ZTOP, T.ZBOT];
  if (VIP_DARSHAN) return [[-1.1, 1.1, -0.68, 5.2], ramp];
  return [[-GM.X, GM.X, -0.68, GM.PLINTH], ramp, [EX.X0 - 0.3, EX.X1 + 0.3, EX.Z0, EX.Z1]];
}

/** Named zone of the general route under the pilgrim's feet, or null. */
export function routeZone(p: THREE.Vector3): string | null {
  const { x, y, z } = p;
  if (y > -0.5 && x > APPROACH.X0 && x < APPROACH.X1 && z > APPROACH.Z0 && z < -41.3) return 'approach';
  if (y > -0.5) {
    // outside the precinct: the road to the north gate, the Rudra Sagar lakefront, Shri Mahakal Lok
    const near = (line: [number, number][], r: number) => line.some((b, i) => {
      if (!i) return false;
      const a = line[i - 1], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r;
    });
    if (z < -48 && near(PROMENADE, 7)) return 'approach';
    if (near(LAKE_LINK, 6)) return 'lakefront';
    if (Math.hypot(x - KAMAL_KUND.x, z - KAMAL_KUND.z) < 70 || z > 640) return near(CORRIDOR, 9) && z < 600 ? 'lok-corridor' : z > 560 ? 'kamal-kund' : null;
    if (near(CORRIDOR, 9)) return 'lok-corridor';
  }
  if (y > -0.5 && x > Q.X0 - 0.6 && x < Q.X1 + 0.6 && z >= -41.3 && z < T.ZTOP + 0.6) return 'queue';
  if (x > T.X0 - 0.4 && x < -7 && z > T.ZTOP + 0.6 && z < T.ZEND + 0.3 && y < 0.2) return 'tunnel';
  if (VIP_DARSHAN) return null;
  if (y < -1.5 && Math.abs(x) < GM.X && z > PLAT.Z0 - 0.1 && z < GM.Z1) return 'ganesh-mandapam';
  // the Nandi hall: past the open gate, before the sanctum door (the threshold story is told here)
  if (y < -1.5 && Math.abs(x) < NH + 0.1 && z > SANCTUM.Z + 3.3 && z <= PLAT.Z0 - 0.1) return 'nandi';
  if (y < -1.5 && x > PH.X0 && x < PH.X1 && z > PH.Z0 && z < PH.Z1) return 'palki';
  if (x > EX.X0 - 0.2 && x < EX.X1 + 0.2 && z > EX.Z0 && z < EX.Z1 && y < -0.05) return 'palki';
  return null;
}

/**
 * Camera (eye) underground in the tunnel, the mandapam or the Nandi hall: nothing on the surface can be
 * seen from there, so the exterior can stop drawing.
 */
export function deepUnderground(p: THREE.Vector3): boolean {
  if (VIP_DARSHAN || p.y > -0.6) return false;
  if (Math.abs(p.x) < GM.X + 0.2 && p.z > SANCTUM.Z - 3.5 && p.z < GM.Z1) return true;
  return p.x > T.X0 - 0.4 && p.x < -6.8 && p.z > -6 && p.z < T.ZEND + 0.3;
}

// ---------------------------------------------------------------- textures

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

let seed = 9137;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** glazed wall tiles, 0.3 m square (1.2 m per texture repeat) */
const tileTex = () => canvasTex(512, 512, (g) => {
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 236 - rnd() * 10;
    g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
    g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    const gr = g.createLinearGradient(i * 128, j * 128, i * 128 + 128, j * 128 + 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)');
    g.fillStyle = gr; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
  }
}, [1 / 1.2, 1 / 1.2]);

/** white marble floor slabs, 0.6 m, with soft grey veins (1.2 m per repeat) */
const marbleTex = (tint = 0xf2efe8) => canvasTex(512, 512, (g) => {
  const c = new THREE.Color(tint);
  g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = `rgba(120,118,112,${0.05 + rnd() * 0.12})`; g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    let x = rnd() * 512, y = rnd() * 512; g.moveTo(x, y);
    for (let i = 0; i < 8; i++) { x += (rnd() - 0.3) * 70; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(150,140,128,0.5)'; g.lineWidth = 2;
  for (const p of [0, 256, 512]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
}, [1 / 1.2, 1 / 1.2]);

/** polished granite floor slabs, 0.6 m (1.2 m per repeat) */
const graniteTex = (base: [number, number, number], speck: number) => canvasTex(512, 512, (g) => {
  g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 9000; k++) {
    const s = rnd() < 0.5 ? -speck : speck * 0.8;
    const c = base.map((v) => Math.max(0, Math.min(255, v + s * (0.4 + rnd()))));
    g.fillStyle = `rgba(${c.join(',')},0.8)`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  g.strokeStyle = 'rgba(30,24,20,0.55)'; g.lineWidth = 2;
  for (const p of [0, 256, 512]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
}, [1 / 1.2, 1 / 1.2]);

/** a carved red-sandstone relief panel: ॐ, trishul, damaru and a coiled nag in a border (Mahakal Lok's walls) */
const reliefTex = () => canvasTex(1024, 550, (g) => {
  g.fillStyle = '#9a4a34'; g.fillRect(0, 0, 1024, 550);
  for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '60,24,16' : '200,140,110'},0.15)`; g.fillRect(rnd() * 1024, rnd() * 550, 2, 2); }
  g.strokeStyle = '#d8a070'; g.lineWidth = 14; g.strokeRect(20, 20, 984, 510);
  g.strokeStyle = '#6a2a1a'; g.lineWidth = 6; g.strokeRect(44, 44, 936, 462);
  g.fillStyle = '#e8b46a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 230px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.fillText('ॐ', 512, 290);
  g.strokeStyle = '#e8b46a'; g.lineCap = 'round'; g.lineWidth = 16;
  // trishul (left) and damaru (right)
  g.beginPath(); g.moveTo(200, 470); g.lineTo(200, 130);
  g.moveTo(140, 150); g.quadraticCurveTo(150, 250, 200, 250); g.quadraticCurveTo(250, 250, 260, 150); g.stroke();
  g.beginPath(); g.moveTo(780, 170); g.lineTo(880, 170); g.lineTo(800, 300); g.lineTo(860, 300); g.lineTo(780, 430); g.lineTo(880, 430); g.stroke();
}, undefined);
const reliefMat = new THREE.MeshStandardMaterial({ map: reliefTex(), roughness: 0.8 });

/** corrugated roof sheet, ribs every 0.2 m */
const sheetTex = () => canvasTex(256, 64, (g) => {
  const gr = g.createLinearGradient(0, 0, 256, 0);
  for (let k = 0; k <= 5; k++) { gr.addColorStop(k / 5, '#dcdcd6'); if (k < 5) gr.addColorStop(k / 5 + 0.1, '#a9aaa6'); }
  g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
}, [1, 1]);

/** a running frieze band: ॐ नमः शिवाय on saffron between maroon rules */
const friezeTex = () => canvasTex(1024, 96, (g) => {
  g.fillStyle = '#b84a12'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#6a1410'; g.fillRect(0, 0, 1024, 12); g.fillRect(0, 84, 1024, 12);
  g.fillStyle = '#ffe2a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 46px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.fillText('ॐ नमः शिवाय', 256, 50); g.fillText('जय श्री महाकाल', 768, 50);
}, [1 / 4, 1]);

/**
 * All the route's sign boards share one canvas atlas and one material, so each group's boards merge
 * into a single draw. Boards are packed on shelves, 768 px wide.
 */
const ATLAS = (() => {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 2048;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { c, g: c.getContext('2d')!, tex, x: 0, y: 0, row: 0, mat: new THREE.MeshBasicMaterial({ map: tex, color: 0xdedede }) };
})();

/** A flat bilingual sign board (backlit panel): Devanagari line, English line. */
function signBoard(parent: THREE.Object3D, hi: string, en: string, w: number, h: number, pos: THREE.Vector3, ry = 0, style: 'red' | 'green' | 'blue' | 'cream' = 'red', twoSided = false) {
  const pal = { red: ['#8a1410', '#ffe6b0', '#ffffff'], green: ['#0d5a36', '#ffffff', '#e8f4ea'], blue: ['#123a7a', '#ffffff', '#e4ecf8'], cream: ['#f4ead2', '#8a1410', '#3a2a1a'] }[style];
  const W = 768, H = Math.round((W * h) / w);
  const A = ATLAS;
  if (A.x + W > A.c.width) { A.x = 0; A.y += A.row + 4; A.row = 0; }
  const ox = A.x, oy = A.y;
  A.x += W + 4; A.row = Math.max(A.row, H);
  const g = A.g;
  g.save();
  g.translate(ox, oy);
  g.beginPath(); g.rect(0, 0, W, H); g.clip();
  g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
  const lw = Math.max(5, H * 0.04);
  g.strokeStyle = style === 'cream' ? '#8a1410' : '#f2c040'; g.lineWidth = lw; g.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = pal[1];
  g.font = `700 ${Math.round(H * (en ? 0.36 : 0.5))}px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif`;
  g.fillText(hi, W / 2, en ? H * 0.36 : H * 0.54, W * 0.92);
  if (en) {
    g.fillStyle = pal[2];
    g.font = `600 ${Math.round(H * 0.24)}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(en, W / 2, H * 0.74, W * 0.92);
  }
  g.restore();
  A.tex.needsUpdate = true;
  // map the plane's UVs to this board's cell (canvas y runs down, UV v runs up; flipY is on)
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (ox + uv.getX(i) * W) / A.c.width, 1 - (oy + (1 - uv.getY(i)) * H) / A.c.height);
  }
  const m = new THREE.Mesh(geo, A.mat);
  m.position.copy(pos);
  m.rotation.y = ry;
  parent.add(m);
  if (twoSided) {
    const b = new THREE.Mesh(geo, A.mat);
    b.position.copy(pos);
    b.rotation.y = ry + Math.PI;
    parent.add(b);
  }
  return m;
}

/** The notice on the VIP rule, Hindi first, then English (read in ~10 s). */
export const NOTICE = {
  hi: 'वास्तविक मंदिर में 2020 से गर्भगृह प्रवेश केवल वीआईपी, पुजारियों और आमंत्रित अतिथियों के लिए है; सामान्य श्रद्धालु गणेश मंडपम से दर्शन करते हैं। इस वर्चुअल यात्रा में आप भीतर जा सकते हैं।',
  en: 'In the real temple, since 2020 the garbhagriha is open only to VIPs, priests and invited guests; all other pilgrims take darshan from the Ganesh Mandapam. In this virtual yatra, you may go inside.',
};

/**
 * A framed notice board on a stand (brass posts, dark teak frame), its face at eye height: a saffron
 * "सूचना · Note" band, then the Hindi and the English text, wrapped. Its own canvas (too long for the atlas).
 * `pos` is the foot of the stand on the floor; the face looks along +z rotated by `ry`; `w` its width.
 */
function noticeBoard(parent: THREE.Object3D, M: Materials, pos: THREE.Vector3, ry: number, w: number) {
  const h = w * 0.78, W = 1024, H = Math.round(W * 0.78);
  const t = canvasTex(W, H, (g) => {
    g.fillStyle = '#f6efdc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b8420e'; g.fillRect(0, 0, W, 104);
    g.strokeStyle = '#8a1410'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = '#fff4dc'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 60px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
    g.fillText('सूचना · Note', W / 2, 56);
    const wrap = (text: string, font: string, y: number, lh: number, col: string) => {
      g.font = font; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      let line = '';
      for (const word of text.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (g.measureText(test).width > W - 90 && line) { g.fillText(line, 45, y); y += lh; line = word; } else line = test;
      }
      if (line) { g.fillText(line, 45, y); y += lh; }
      return y;
    };
    let y = wrap(NOTICE.hi, '600 44px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif', 178, 62, '#3a1208');
    g.fillStyle = '#c9923a'; g.fillRect(45, y - 30, W - 90, 3);
    y = wrap(NOTICE.en, '500 38px "Helvetica Neue", Arial, sans-serif', y + 28, 50, '#2a2420');
  });
  const grp = new THREE.Group();
  grp.position.copy(pos);
  grp.rotation.y = ry;
  parent.add(grp);
  const y0 = 1.62 - h / 2 + 0.08; // the face's middle a little below eye height
  const teak = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.6 });
  box(grp, teak, w + 0.12, h + 0.12, 0.06, 0, y0 - 0.06, -0.02);
  for (const s of [-1, 1]) box(grp, M.brass, 0.05, y0 + h, 0.05, s * (w / 2 - 0.05), 0, -0.07);
  box(grp, M.brass, w + 0.16, 0.05, 0.08, 0, y0 + h + 0.04, -0.02);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0xe6e6e6 }));
  face.position.set(0, y0 + h / 2, 0.015);
  grp.add(face);
  return grp;
}

// ---------------------------------------------------------------- builders

/** a straight run of steel queue barricade from a to b at floor y: posts every ~1.5 m, two rails; collider unless `open` */
function barricade(rails: THREE.Matrix4[], posts: THREE.Matrix4[], P: Physics | null, a: [number, number], b: [number, number], y: number) {
  const A = new THREE.Vector3(a[0], y, a[1]), B = new THREE.Vector3(b[0], y, b[1]);
  const len = A.distanceTo(B);
  if (len < 0.05) return;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  for (const h of [0.5, 1.05]) rails.push(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5).setY(y + h), q, new THREE.Vector3(1, len, 1)));
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) posts.push(new THREE.Matrix4().makeTranslation(A.x + (B.x - A.x) * i / n, y + 0.54, A.z + (B.z - A.z) * i / n));
  P?.solid(Math.min(a[0], b[0]) - 0.06, y, Math.min(a[1], b[1]) - 0.06, Math.max(a[0], b[0]) + 0.06, y + 1.1, Math.max(a[1], b[1]) + 0.06);
}

/** A sloped slab (top surface from (z0, y0) to (z1, y1)), x0..x1, thickness th. */
function slope(parent: THREE.Object3D, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, th = 0.2) {
  const len = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0);
  const geo = new THREE.BoxGeometry(x1 - x0, th, len);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -a;
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2 - (th / 2) * Math.cos(a), (z0 + z1) / 2 + (th / 2) * Math.sin(a));
  m.updateMatrix();
  m.geometry.applyMatrix4(m.matrix);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
  worldUV(m.geometry);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A wall in the y-z plane at x = x0..x0+th whose top follows `top` (polyline of [z, y]) and bottom is at yb. */
function profileWall(parent: THREE.Object3D, mat: THREE.Material, x0: number, th: number, yb: number, top: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(top[0][0], yb);
  s.lineTo(top[top.length - 1][0], yb);
  for (let i = top.length - 1; i >= 0; i--) s.lineTo(top[i][0], top[i][1]);
  const geo = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(x0 + th, 0, 0);
  const m = new THREE.Mesh(worldUV(geo), mat);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A seated Nandi in dark oiled stone with brass bells and a marigold garland, facing north (−z), on a low plinth. */
function nandi(parent: THREE.Object3D, M: Materials, x: number, y: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  g.rotation.y = Math.PI; // local +z (the head) → world −z, toward the lingam
  parent.add(g);
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.3, metalness: 0.08 });
  const parts: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, s: [number, number, number], p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    parts.push(gg);
  };
  const sph = new THREE.SphereGeometry(1, 32, 20);
  const cap = new THREE.CapsuleGeometry(1, 1, 10, 24);
  // body lying with the legs folded under: a long rounded barrel on a flattened base
  add(cap, [0.3, 0.42, 0.33], [0, 0.4, -0.02], [Math.PI / 2, 0, 0]);
  add(sph, [0.37, 0.13, 0.66], [0, 0.15, -0.04]);
  // the hump over the shoulders, the neck and dewlap, the head bowed a little toward the lingam
  add(sph, [0.18, 0.17, 0.22], [0, 0.66, 0.24]);
  add(sph, [0.19, 0.23, 0.21], [0, 0.52, 0.47], [0.35, 0, 0]);
  add(sph, [0.07, 0.17, 0.14], [0, 0.32, 0.56]);
  add(cap, [0.13, 0.14, 0.13], [0, 0.62, 0.71], [1.05, 0, 0]);
  add(sph, [0.1, 0.085, 0.1], [0, 0.5, 0.86]);
  for (const sd of [-1, 1]) {
    add(cap, [0.075, 0.2, 0.075], [sd * 0.2, 0.1, 0.42], [Math.PI / 2, 0, 0]); // folded forelegs
    add(sph, [0.09, 0.06, 0.08], [sd * 0.21, 0.06, 0.66]); // hooves
    add(sph, [0.13, 0.19, 0.3], [sd * 0.19, 0.3, -0.42]); // haunches
    add(cap, [0.07, 0.17, 0.07], [sd * 0.3, 0.09, -0.2], [Math.PI / 2, 0, 0]); // folded hind legs
    add(sph, [0.07, 0.035, 0.05], [sd * 0.16, 0.7, 0.66], [0, 0, sd * 0.5]); // ears
    add(new THREE.ConeGeometry(0.03, 0.17, 12), [1, 1, 1], [sd * 0.085, 0.82, 0.64], [-0.3, 0, -sd * 0.45]); // horns
  }
  const body = new THREE.Mesh(mergeGeometries(parts)!, stone);
  body.castShadow = true;
  g.add(body);
  // tail curled along the plinth
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.45, -0.72), new THREE.Vector3(0.12, 0.25, -0.76), new THREE.Vector3(0.3, 0.1, -0.6), new THREE.Vector3(0.36, 0.08, -0.3),
  ]), 20, 0.025, 8), stone);
  g.add(tail);
  // plinth: dark stone with a brass band
  box(g, stone, 1.0, 0.1, 1.85, 0, -0.1, -0.02);
  box(g, M.brass, 1.02, 0.03, 1.87, 0, -0.03, -0.02);
  g.position.y += 0.1 * scale;
  // a brass bell collar, a saddle cloth over the back, a marigold garland round the neck
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), M.brass);
  collar.position.set(0, 0.47, 0.5); collar.rotation.x = Math.PI / 2 - 0.55;
  g.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.brass);
  bell.position.set(0, 0.29, 0.62);
  g.add(bell);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.5, 24, 1, true, -1.1, 2.2), new THREE.MeshStandardMaterial({ color: 0x9a1418, roughness: 0.8, side: THREE.DoubleSide }));
  cloth.rotation.x = -Math.PI / 2; // the arc's middle (local +z) turns up over the back
  cloth.position.set(0, 0.4, -0.1);
  g.add(cloth);
  const gar = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 8, 28), M.marigold);
  gar.position.set(0, 0.4, 0.5); gar.rotation.x = Math.PI / 2 - 0.7;
  g.add(gar);
  return g;
}

/**
 * The mandapam's Ganesh: a large seated, sindoor-coated idol (as Ujjain's Bada Ganesh) on a lotus seat in
 * a silver shrine with a cusped arch, on the west wall facing the aisle (+x). Four arms (axe, goad,
 * blessing, modak), the trunk curling to his left, a tall gold mukut, his mushak, diyas and garlands.
 * Returns the diya flame positions.
 */
function ganeshShrine(parent: THREE.Object3D, M: Materials, silver: THREE.Material, MG: Marigolds, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2; // local +z → world +x
  parent.add(g);
  const sindoor = new THREE.MeshStandardMaterial({ color: 0xd8461a, roughness: 0.45, metalness: 0.05 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x5a0d14, roughness: 0.95 });
  // shrine: a red velvet back, a silver frame and cusped arch, a marble-and-brass plinth
  const W = 1.9, H = 2.9;
  box(g, velvet, W, H, 0.06, 0, 0.1, 0.02);
  for (const s of [-1, 1]) box(g, silver, 0.16, H, 0.34, s * (W / 2 + 0.08), 0.1, 0.17);
  box(g, silver, W + 0.48, 0.2, 0.36, 0, H + 0.1, 0.18);
  const arch = new THREE.Mesh(archPanelGeometry(W, 0.55, 0.12, 7), silver);
  arch.position.set(0, H - 0.45, 0.3);
  g.add(arch);
  box(g, M.marble, W + 0.3, 0.55, 0.42, 0, 0, 0.21);
  box(g, M.brass, W + 0.32, 0.04, 0.44, 0, 0.5, 0.21);
  // the idol, ~1.4 m, built of smooth merged forms
  const parts: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, sc: [number, number, number], p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...sc));
    const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    parts.push(gg);
  };
  const sph = new THREE.SphereGeometry(1, 28, 18), cap = new THREE.CapsuleGeometry(1, 1, 8, 16);
  const b0 = 0.62; // seat top
  add(sph, [0.42, 0.16, 0.3], [0, b0 + 0.12, 0.28]); // crossed legs
  add(sph, [0.3, 0.32, 0.27], [0, b0 + 0.45, 0.3]); // belly
  add(sph, [0.27, 0.25, 0.2], [0, b0 + 0.7, 0.24]); // chest
  add(sph, [0.2, 0.2, 0.19], [0, b0 + 0.98, 0.26]); // head
  add(sph, [0.12, 0.1, 0.12], [0, b0 + 1.04, 0.38]); // brow
  for (const sd of [-1, 1]) {
    add(sph, [0.22, 0.24, 0.035], [sd * 0.22, b0 + 0.98, 0.2], [0, sd * 0.35, 0]); // ears
    add(cap, [0.055, 0.12, 0.055], [sd * 0.3, b0 + 0.62, 0.36], [0.5, 0, sd * 0.15]); // lower arms
    add(cap, [0.05, 0.12, 0.05], [sd * 0.34, b0 + 0.88, 0.2], [0, 0, sd * -0.6]); // upper arms, raised
    add(sph, [0.06, 0.05, 0.08], [sd * 0.38, b0 + 0.1, 0.5]); // feet
  }
  add(cap, [0.05, 0.03, 0.05], [0.14, b0 + 0.84, 0.42], [1.2, 0, 0.3]); // tusk stub
  const body = new THREE.Mesh(mergeGeometries(parts)!, sindoor);
  body.castShadow = true;
  g.add(body);
  // the trunk, curling down and to his left over the belly
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, b0 + 0.95, 0.42), new THREE.Vector3(0, b0 + 0.78, 0.5), new THREE.Vector3(-0.05, b0 + 0.58, 0.55),
    new THREE.Vector3(-0.17, b0 + 0.48, 0.55), new THREE.Vector3(-0.24, b0 + 0.56, 0.5),
  ]), 24, 0.055, 12), sindoor);
  g.add(trunk);
  // silver eyes, a tall gold mukut, axe and goad in the upper hands, a modak, a red-and-gold dhoti band
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), silver);
    eye.position.set(sd * 0.08, b0 + 1.03, 0.43);
    g.add(eye);
  }
  const crown = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.16, 0.08], [0.13, 0.1], [0.12, 0.2], [0.09, 0.22], [0.08, 0.32], [0.04, 0.36], [0.02, 0.44], [0, 0.46]]
    .map(([r, yy]) => new THREE.Vector2(r, yy)), 20), M.gold);
  crown.position.set(0, b0 + 1.13, 0.24);
  g.add(crown);
  const axe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), M.gold);
  axe.position.set(-0.45, b0 + 1.08, 0.22);
  g.add(axe);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12, 1, false, 0, Math.PI), M.gold);
  blade.rotation.x = Math.PI / 2; blade.position.set(-0.45, b0 + 1.22, 0.22);
  g.add(blade);
  const goad = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 16, Math.PI * 1.4), M.gold);
  goad.position.set(0.45, b0 + 1.18, 0.22);
  g.add(goad);
  const modak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf0d8a0, roughness: 0.7 }));
  modak.position.set(-0.33, b0 + 0.58, 0.52);
  g.add(modak);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xb8101c, roughness: 0.6 }));
  band.rotation.x = Math.PI / 2; band.position.set(0, b0 + 0.3, 0.3); band.scale.set(1, 0.9, 1);
  g.add(band);
  // lotus seat
  const lotus = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0xe86a9a, roughness: 0.6 }));
  lotus.position.set(0, b0 - 0.035, 0.3);
  g.add(lotus);
  // the mushak at his feet, a plate of modaks, two brass diyas
  const rat = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: 0x5a4a40, roughness: 0.6 }));
  rat.scale.set(0.8, 0.7, 1.4); rat.position.set(0.3, 0.6, 0.62);
  g.add(rat);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.02, 20), M.brass);
  plate.position.set(-0.4, 0.57, 0.48);
  g.add(plate);
  const flames: THREE.Vector3[] = [];
  for (const sd of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.03, 0.1], [0.08, 0.13], [0.07, 0.15], [0, 0.14]].map(([r, yy]) => new THREE.Vector2(r, yy)), 12), M.brass);
    lamp.position.set(sd * 0.75, 0.56, 0.38);
    g.add(lamp);
  }
  g.updateMatrixWorld(true);
  for (const sd of [-1, 1]) flames.push(new THREE.Vector3(sd * 0.75, 0.74, 0.38).applyMatrix4(g.matrixWorld));
  // garlands: a big marigold mala round the neck and a toran along the arch
  const wp = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyMatrix4(g.matrixWorld);
  MG.strand(wp(-0.26, b0 + 0.85, 0.4), wp(0.26, b0 + 0.85, 0.4), 0.28, 'ooyy', 0.032, new THREE.Vector3(0, -1, 0));
  MG.strand(wp(-W / 2, H - 0.1, 0.36), wp(W / 2, H - 0.1, 0.36), 0.25, 'oooyyw', 0.032);
  for (const sd of [-1, 1]) MG.strand(wp(sd * W / 2, H - 0.1, 0.36), wp(sd * W / 2, H - 1.0, 0.36), 0, 'oyo', 0.03);
  return flames;
}

/** A silver palki (palanquin) of Shri Mahakal on its stand: domed canopy on four posts, carrying poles. */
function palki(parent: THREE.Object3D, M: Materials, x: number, y: number, z: number, env: THREE.Texture) {
  const g = new THREE.Group();
  // bright chased silver under the hall's white tube lights (the shared silver mirrors warm lamplight)
  M = { ...M, silver: Object.assign(new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 0.9, roughness: 0.3 }), { envMap: env, envMapIntensity: 1.2 }) };
  g.position.set(x, y, z);
  parent.add(g);
  const velvet = new THREE.MeshStandardMaterial({ color: 0x8a1018, roughness: 0.9 });
  box(g, velvet, 2.2, 0.45, 1.3, 0, 0, 0);
  box(g, M.silver, 1.3, 0.12, 1.0, 0, 0.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.silver, 0.06, 1.0, 0.06, sx * 0.58, 0.57, sz * 0.43);
  box(g, M.silver, 1.36, 0.1, 1.06, 0, 1.57, 0);
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.silver);
  d.scale.set(1, 0.7, 0.8);
  d.position.set(0, 1.67, 0);
  g.add(d);
  const k = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 12), M.gold);
  k.position.set(0, 2.2, 0);
  g.add(k);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 10), M.silver);
  pole.rotation.z = Math.PI / 2;
  pole.position.set(0, 0.62, 0);
  g.add(pole);
  // the silver mukhota (mask) of Mahakal inside, a marigold garland round the canopy
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), M.silver);
  mask.scale.set(1, 1.2, 0.6);
  mask.position.set(0, 0.95, 0);
  g.add(mask);
  const gar = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 32), M.marigold);
  gar.rotation.x = Math.PI / 2; gar.position.set(0, 1.55, 0); gar.scale.set(1, 0.8, 1);
  g.add(gar);
  return g;
}

// ---------------------------------------------------------------- the route

export interface DarshanBuild {
  /** queue lanes and sheds in the north court (exterior: may be hidden underground) */
  surface: THREE.Group;
  /** tunnel, Nandi, mandapam, Palki Hall (drawn underground and near the portals) */
  under: THREE.Group;
  /** the tunnel's covered ramp and portal, the exit ramp and its arch (always drawn) */
  portals: THREE.Group;
  /** interior point lights (switched by lightZones with the rest of the interior) */
  lights: THREE.PointLight[];
  /** crowd spots: queue, mandapam tiers, guards */
  spots: CrowdSpot[];
  /** diya flame points */
  flames: THREE.Vector3[];
  /** LED screens' material (map set later from the live capture of the sanctum) */
  ledMat: THREE.MeshBasicMaterial | null;
  /** the pilgrims standing in the queue lanes (they shuffle forward), with the lane direction as ry */
  queueSpots: Set<CrowdSpot>;
  /** the temple sevaks at the darshan platform (they turn to wave the line on) */
  sevaks: CrowdSpot[];
}

export function buildDarshan(root: THREE.Group, M: Materials, S: MahakalMats, P: Physics, env: THREE.Texture): DarshanBuild {
  const surface = new THREE.Group(); surface.name = 'darshan-queue';
  const under = new THREE.Group(); under.name = 'darshan-route';
  const portals = new THREE.Group(); portals.name = 'darshan-portals';
  root.add(surface, under, portals);
  const lights: THREE.PointLight[] = [];
  const flames: THREE.Vector3[] = [];
  const cs = new CrowdSpots(613);
  const queueSpots = new Set<CrowdSpot>();
  const guards: CrowdSpot[] = [];
  const withEnv = <T extends THREE.MeshStandardMaterial>(m: T, k = 0.5) => { m.envMap = env; m.envMapIntensity = k; return m; };

  // ---------- materials ----------
  const steel = new THREE.MeshStandardMaterial({ color: 0xc6cacd, metalness: 0.85, roughness: 0.3 });
  const steelBlue = new THREE.MeshStandardMaterial({ color: 0x55718a, metalness: 0.6, roughness: 0.45 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sheetTex(), metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide });
  sheet.map!.repeat.set(Q.X1 - Q.X0 + 1.4, 1); // five ribs per metre of the sheet's width
  const tiles = withEnv(new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.28, color: 0xe2dccf }), 0.28);
  const friezeT = friezeTex();
  // the band is 0.24 m tall at FLOOR + 1.45 (world-metre UVs): fit the canvas to it
  friezeT.repeat.set(1 / 4, 1 / 0.24);
  friezeT.offset.set(0, -(T.FLOOR + 1.45) / 0.24);
  const frieze = withEnv(new THREE.MeshStandardMaterial({ map: friezeT, roughness: 0.3 }), 0.3);
  // world-metre UVs run backwards on the west wall's band (it faces +x): mirror its texture back
  const friezeE = frieze.clone();
  friezeE.map = friezeT.clone();
  friezeE.map.repeat.x = -1 / 4;
  const granite = withEnv(new THREE.MeshStandardMaterial({ map: graniteTex([92, 84, 80], 26), roughness: 0.4 }), 0.45);
  const graniteRed = withEnv(new THREE.MeshStandardMaterial({ map: graniteTex([118, 60, 48], 22), roughness: 0.22 }), 0.55);
  const kota = new THREE.MeshStandardMaterial({ map: graniteTex([130, 128, 118], 18), roughness: 0.6 });
  const cream = withEnv(new THREE.MeshStandardMaterial({ color: 0xece2cf, roughness: 0.75 }), 0.45);
  const ceiling = withEnv(new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.8 }), 0.4);
  const sandstone = S.spire; // Mahakal Lok's carved red-pink sandstone
  const dado = withEnv(new THREE.MeshStandardMaterial({ color: 0x8e3e2a, roughness: 0.45 }), 0.5);
  const tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 1.6 });
  const tubeGeo = new THREE.BoxGeometry(0.08, 0.04, 1.2);
  const tubes: THREE.Matrix4[] = [];
  const tubeAt = (x: number, y: number, z: number, alongX = false) => tubes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongX ? Math.PI / 2 : 0), new THREE.Vector3(1, 1, 1)));
  const rails: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [];
  const railsU: THREE.Matrix4[] = [], postsU: THREE.Matrix4[] = [];
  const railsP: THREE.Matrix4[] = [], postsP: THREE.Matrix4[] = [];

  // =================================================================== 0. the approach from Mahakal Lok
  // the forecourt between the road along the north of the precinct (Mahakal Lok's lakefront path joins it
  // to the west) and the north gate: red-sandstone paving, a carved Mahakal Lok gateway over the opening in
  // the wall, carved relief panels on the wall either side, lamp posts, pilgrims walking in
  {
    const { X0, X1, Z1 } = APPROACH;
    const RZ = -53; // the road's south kerb (OSM: the road runs at z ≈ -58 here)
    const flags = new THREE.MeshStandardMaterial({ map: graniteTex([168, 104, 86], 16), roughness: 0.75 });
    const runner = new THREE.MeshStandardMaterial({ map: graniteTex([214, 196, 170], 12), roughness: 0.7 });
    box(surface, flags, X1 - X0, 0.06, Z1 - RZ - 1.8, (X0 + X1) / 2, -0.05, (RZ + Z1 - 1.8) / 2);
    box(surface, runner, 3.2, 0.07, Z1 - RZ, -2, -0.05, (RZ + Z1) / 2);
    P.floor(surface, X0, X1, APPROACH.Z0, Z1, 0.01);
    const pz = Z1 - 1.75; // the wall's outer face
    const L = lokMats();
    const statues = new StatueBatch();
    const gate = lokGate(L, 7.6, 9.4, 'om', statues);
    gate.group.position.set(-2, 0, pz - gate.depth / 2 - 0.05);
    gate.group.rotation.y = Math.PI;
    surface.add(gate.group);
    for (const sx of [-1, 1]) {
      const x = -2 + sx * (7.6 / 2 + gate.pier / 2);
      P.solid(x - gate.pier * 0.65, 0, pz - gate.depth - 0.4, x + gate.pier * 0.65, 10, pz);
    }
    // the wall either side of the gate, clad in carved sandstone panels (ॐ, trishul, damaru, nag) under a coping
    for (const [x0, x1] of [[X0 - 3, -2 - gate.half], [-2 + gate.half, X1 + 4]] as const) {
      box(surface, L.sandstone, x1 - x0, 5.2, 0.5, (x0 + x1) / 2, 0, pz - 0.25);
      box(surface, L.sandstone, x1 - x0 + 0.3, 0.3, 0.8, (x0 + x1) / 2, 5.2, pz - 0.3);
      for (let x = x0 + 1.6; x < x1 - 1.4; x += 3.0) {
        const pnl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), reliefMat);
        pnl.position.set(x, 2.6, pz - 0.52);
        pnl.rotation.y = Math.PI;
        surface.add(pnl);
      }
    }
    for (const m of statues.meshes(L.paint, L.gold)) surface.add(m);
    // lamp posts down the forecourt
    for (const x of [-6.6, 2.6]) for (const z of [RZ + 1.5, RZ + 5]) {
      box(surface, L.iron, 0.14, 3.8, 0.14, x, 0, z);
      box(surface, L.lamp, 0.34, 0.45, 0.34, x, 3.8, z);
    }
    signBoard(surface, 'श्री महाकालेश्वर मंदिर · उत्तर द्वार', 'Shri Mahakaleshwar Mandir · North Gate · darshan queue', 5.6, 0.95, new THREE.Vector3(-2, 8.7, pz - gate.depth - 0.12), Math.PI, 'red');
    signBoard(surface, '← श्री महाकाल लोक · रुद्र सागर', 'Shri Mahakal Lok · Rudra Sagar lakefront', 3.4, 0.7, new THREE.Vector3(-11.5, 2.3, RZ + 1.2), Math.PI, 'green', true);
    box(surface, steel, 0.06, 2.0, 0.06, -13.1, 0, RZ + 1.2);
    box(surface, steel, 0.06, 2.0, 0.06, -9.9, 0, RZ + 1.2);
    // pilgrims walking in towards the gate
    for (let k = 0; k < 20; k++) {
      const x = -2 + (rnd() < 0.5 ? -1 : 1) * (2.0 + rnd() * 6), z = RZ - 6 + rnd() * (Z1 - RZ + 2);
      cs.add(x, 0, z, (rnd() - 0.5) * 0.4);
      cs.list[cs.list.length - 1].queue = rnd() < 0.7 ? 'walk' : rnd() < 0.5 ? 'bag' : 'thali';
    }
  }

  // =================================================================== 1. the queue (north court)
  {
    const { X0, X1, LINES, OPEN } = Q;
    LINES.forEach((z, i) => {
      // line 0 and 2 open at the east end, 1 and 3 at the west end
      if (i % 2 === 0) barricade(rails, posts, P, [X0, z], [X1 - OPEN, z], 0);
      else barricade(rails, posts, P, [X0 + OPEN, z], [X1, z], 0);
    });
    barricade(rails, posts, P, [X0, LINES[0]], [X0, LINES[3]], 0);
    barricade(rails, posts, P, [X1, LINES[0]], [X1, LINES[3]], 0);
    // the approach from the Mahakal Lok gate along the north arcade to the lane entrance, and the funnel
    // from the last lane's opening into the tunnel
    barricade(rails, posts, P, [-3, LINES[0] - 1.4], [X1 - OPEN, LINES[0] - 1.4], 0);
    barricade(rails, posts, P, [X1 - OPEN, LINES[0] - 1.4], [X1 - OPEN, LINES[0]], 0);
    barricade(rails, posts, P, [X1, LINES[0]], [X1, LINES[0] - 3.2], 0);
    barricade(rails, posts, P, [X0, LINES[3]], [X0, T.ZTOP], 0);
    barricade(rails, posts, P, [T.X1 + 0.3, LINES[3]], [T.X1 + 0.3, T.ZTOP], 0);

    // steel sheds: one pitched bay per lane (ridge over the lane's middle), posts outside the lanes
    // and on the barricade lines, corrugated sheets, blue trusses
    const H = 3.7, RISE = 0.6, xa = X0 - 0.7, xb = X1 + 0.7, Wd = xb - xa;
    const postGeo = new THREE.CylinderGeometry(0.07, 0.08, H, 8).translate(0, H / 2, 0);
    const pm: THREE.Matrix4[] = [];
    for (const z of LINES) {
      for (const x of [xa, -2, xb]) {
        if (x === -2 && (z === LINES[0] || z === LINES[3])) continue;
        pm.push(new THREE.Matrix4().makeTranslation(x, 0, z));
        P.solid(x - 0.1, 0, z - 0.1, x + 0.1, H, z + 0.1);
      }
    }
    const pi = new THREE.InstancedMesh(postGeo, steelBlue, pm.length);
    pm.forEach((m, i) => pi.setMatrixAt(i, m));
    pi.castShadow = true;
    surface.add(pi);
    for (let k = 0; k < LINES.length - 1; k++) {
      const z0 = LINES[k], z1 = LINES[k + 1], zc = (z0 + z1) / 2, half = (z1 - z0) / 2 + 0.25;
      const ang = Math.atan2(RISE, half - 0.25);
      for (const s of [-1, 1]) {
        const len = Math.hypot(half, RISE) + 0.05;
        const r = new THREE.Mesh(new THREE.PlaneGeometry(Wd, len), sheet);
        r.rotation.x = -Math.PI / 2 + s * ang;
        r.position.set((xa + xb) / 2, H + RISE / 2 + 0.05, zc + (s * half) / 2);
        r.castShadow = r.receiveShadow = true;
        surface.add(r);
      }
      // ridge, eave beams and a light truss every post
      box(surface, steelBlue, Wd, 0.12, 0.12, (xa + xb) / 2, H + RISE, zc);
      for (const z of [z0, z1]) box(surface, steelBlue, Wd, 0.16, 0.12, (xa + xb) / 2, H - 0.12, z);
      for (const x of [xa, -2, xb]) {
        for (const s of [-1, 1]) {
          const a = new THREE.Vector3(x, H, zc + s * (half - 0.25)), b = new THREE.Vector3(x, H + RISE, zc);
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, a.distanceTo(b), 6), steelBlue);
          m.position.copy(a).lerp(b, 0.5);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          surface.add(m);
        }
        box(surface, steelBlue, 0.06, 0.06, (half - 0.25) * 2, x, H, zc);
      }
      // ceiling fans' worth of LED battens under the ridge, and a hanging board per lane
      for (let x = X0 + 1.5; x < X1 - 1; x += 4.2) tubeAt(x, H + RISE - 0.15, zc, true);
    }
    signBoard(surface, 'जय श्री महाकाल', '', 3.2, 0.7, new THREE.Vector3(-2, H - 0.3, LINES[1] - 0.02), Math.PI, 'red', true);
    signBoard(surface, 'दर्शन मार्ग →', 'Darshan route', 2.6, 0.8, new THREE.Vector3(-2, H - 0.35, LINES[2] + 0.02), 0, 'blue', true);
    // the entrance arch from the Mahakal Lok side
    {
      const ax0 = X1 - OPEN - 0.2, ax1 = X1 + 0.2, az = LINES[0] - 0.5;
      for (const x of [ax0, ax1]) { box(surface, sandstone, 0.35, 3.3, 0.35, x, 0, az, P); }
      box(surface, sandstone, ax1 - ax0 + 0.6, 0.5, 0.45, (ax0 + ax1) / 2, 3.3, az);
      signBoard(surface, 'सामान्य दर्शन कतार', 'General darshan queue', 2.6, 0.62, new THREE.Vector3((ax0 + ax1) / 2, 3.0, az - 0.24), Math.PI, 'red');
      signBoard(surface, 'सामान्य दर्शन कतार', 'General darshan queue', 2.6, 0.62, new THREE.Vector3((ax0 + ax1) / 2, 3.0, az + 0.24), 0, 'red');
      signBoard(surface, '← श्री महाकाल लोक · मानसरोवर', 'from Shri Mahakal Lok · Mansarovar facility centre', 3.4, 0.7, new THREE.Vector3(-1.5, 2.3, LINES[0] - 1.45), Math.PI, 'green', true);
      const b = new THREE.Group();
      for (const x of [-2.9, -0.1]) box(b, steel, 0.06, 2.0, 0.06, x, 0, LINES[0] - 1.45);
      surface.add(b);
    }
    // the queue itself: two files along the rails of every lane, facing along it, clear of the walking line
    const files: [number, number][] = [];
    for (let k = 0; k < LINES.length - 1; k++) {
      const zc = (LINES[k] + LINES[k + 1]) / 2;
      for (const s of [-1, 1]) files.push([zc + s * 1.86, k % 2 ? Math.PI / 2 : -Math.PI / 2]);
    }
    for (const [z, ry] of files) {
      for (let x = X0 + 0.45; x < X1 - 0.4; x += 0.58 + rnd() * 0.12) {
        cs.add(x, 0, z + (rnd() - 0.5) * 0.08, ry + (rnd() - 0.5) * 0.4);
        const h = Math.floor(rnd() * 20);
        cs.list[cs.list.length - 1].queue = h < 3 ? 'walk' : h < 7 ? 'namaste' : h < 10 ? 'thali' : h < 12 ? 'bag' : 'stand';
        queueSpots.add(cs.list[cs.list.length - 1]);
      }
    }
  }

  // =================================================================== 2. Mahakal Tunnel-1
  {
    const { X0, X1, ZTOP, ZBOT, FLOOR, ZUP0, ZUP1, ZEND } = T;
    const xc = (X0 + X1) / 2, W = X1 - X0, CEIL = GM.CEIL_LO, HEAD = 2.95;
    // walkable floors
    P.floor(portals, X0, X1, ZTOP - 0.6, ZTOP, 0);
    P.floor(portals, X0, X1, ZTOP, ZBOT, 0, FLOOR);
    P.floor(under, X0, X1, ZBOT, ZUP0, FLOOR);
    P.floor(under, X0, X1, ZUP0, ZUP1, FLOOR, BACK);
    P.floor(under, X0, -GM.X + 0.1, ZUP1, ZEND, BACK);
    // visible floors: anti-slip kota stone on the ramps, granite on the level
    slope(portals, kota, X0, X1, ZTOP, ZBOT, 0, FLOOR);
    box(under, granite, W, 0.2, ZUP0 - ZBOT, xc, FLOOR - 0.2, (ZBOT + ZUP0) / 2);
    slope(under, kota, X0, X1, ZUP0, ZUP1, FLOOR, BACK);
    box(under, granite, -GM.X - X0 + 0.1, 0.2, ZEND - ZUP1, (X0 - GM.X) / 2, BACK - 0.2, (ZUP1 + ZEND) / 2);
    // the covered ramp: tiled side walls whose tops follow the sloping roof, the roof itself, a portal
    for (const [wx, th] of [[X0 - 0.3, 0.3], [X1, 0.3]] as const) {
      profileWall(portals, tiles, wx, th, FLOOR - 0.3, [[ZTOP, HEAD], [ZBOT, CEIL]]);
      P.solid(wx, FLOOR - 0.3, ZTOP, wx + th, HEAD, ZBOT);
    }
    {
      const roofLen = Math.hypot(ZBOT - ZTOP, HEAD - CEIL);
      const a = Math.atan2(HEAD - CEIL, ZBOT - ZTOP);
      const r = new THREE.Mesh(worldUV(new THREE.BoxGeometry(W + 0.9, 0.22, roofLen + 0.3)), sandstone);
      r.rotation.x = a;
      r.position.set(xc, (HEAD + CEIL) / 2 + 0.11, (ZTOP + ZBOT) / 2);
      r.castShadow = r.receiveShadow = true;
      portals.add(r);
      const rc = new THREE.Mesh(worldUV(new THREE.BoxGeometry(W, 0.04, roofLen)), ceiling);
      rc.rotation.x = a;
      rc.position.set(xc, (HEAD + CEIL) / 2 - 0.02, (ZTOP + ZBOT) / 2);
      portals.add(rc);
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4, z = ZTOP + (ZBOT - ZTOP) * t;
        tubeAt(xc, HEAD + (CEIL - HEAD) * t - 0.06, z);
      }
      // portal: red sandstone frame with a cusped head and the tunnel's name
      box(portals, sandstone, 0.5, HEAD + 0.6, 0.5, X0 - 0.4, 0, ZTOP - 0.1, P);
      box(portals, sandstone, 0.5, HEAD + 0.6, 0.5, X1 + 0.4, 0, ZTOP - 0.1, P);
      box(portals, sandstone, W + 1.4, 0.75, 0.55, xc, HEAD - 0.1, ZTOP - 0.1);
      signBoard(portals, 'महाकाल टनल - 1', 'Mahakal Tunnel - 1 · दर्शन मार्ग', W + 0.9, 0.62, new THREE.Vector3(xc, HEAD + 0.27, ZTOP - 0.39), Math.PI, 'red');
    }
    // the underground tunnel: tiled walls, a saffron frieze, steel hand-rails, a white ceiling with tube lights
    const wall = (x: number, z0: number, z1: number) => {
      box(under, tiles, 0.3, CEIL - FLOOR + 0.3, z1 - z0, x, FLOOR - 0.3, (z0 + z1) / 2, P);
      box(under, x < xc ? friezeE : frieze, 0.04, 0.24, z1 - z0, x + (x < xc ? 0.17 : -0.17), FLOOR + 1.45, (z0 + z1) / 2);
      box(under, dado, 0.03, 0.14, z1 - z0, x + (x < xc ? 0.165 : -0.165), FLOOR - 0.02, (z0 + z1) / 2);
    };
    wall(X0 - 0.15, ZBOT, ZEND + 0.3);
    wall(X1 + 0.15, ZBOT, ZUP1);
    box(under, tiles, -GM.X - X1, CEIL - FLOOR + 0.3, 0.3, (X1 - GM.X) / 2, FLOOR - 0.3, ZUP1 - 0.15, P);
    box(under, tiles, -GM.X - X0 + 0.3, CEIL - FLOOR + 0.3, 0.3, (X0 - GM.X) / 2 - 0.15, FLOOR - 0.3, ZEND + 0.15, P);
    box(under, ceiling, W + 0.6, 0.12, ZEND - ZBOT + 0.3, xc, CEIL, (ZBOT + ZEND) / 2);
    box(under, ceiling, -GM.X - X1 + 0.3, 0.12, ZEND - ZUP1, (X1 - GM.X) / 2, CEIL, (ZUP1 + ZEND) / 2);
    for (let z = ZBOT + 1.2; z < ZEND; z += 2.6) tubeAt(xc, CEIL - 0.04, z);
    for (const x of [X0 + 0.06, X1 - 0.06]) {
      const a = new THREE.Vector3(x, 0.9, ZTOP + 0.4), b = new THREE.Vector3(x, FLOOR + 0.9, ZBOT);
      const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 8), steel);
      rr.position.copy(a).lerp(b, 0.5);
      rr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      under.add(rr);
      const flat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ZUP0 - ZBOT, 8), steel);
      flat.rotation.x = Math.PI / 2; flat.position.set(x, FLOOR + 0.9, (ZBOT + ZUP0) / 2);
      under.add(flat);
    }
    // signs along the way
    signBoard(under, 'दर्शन मार्ग →', 'Darshan route', 1.6, 0.5, new THREE.Vector3(X0 + 0.02, FLOOR + 2.2, -2), Math.PI / 2, 'blue');
    signBoard(under, 'गणेश मंडपम →', 'to Ganesh Mandapam', 1.6, 0.5, new THREE.Vector3(X1 - 0.02, FLOOR + 2.2, 5), -Math.PI / 2, 'blue');
    signBoard(under, 'जय श्री महाकाल', '', 1.8, 0.42, new THREE.Vector3(xc, CEIL - 0.32, ZUP0 - 1.0), Math.PI, 'red', true);
    signBoard(under, 'कृपया कतार में चलें', 'Please keep moving in the queue', 1.8, 0.5, new THREE.Vector3(X1 - 0.02, FLOOR + 2.2, -9.5 + 4), -Math.PI / 2, 'green');
    signBoard(under, 'गणेश मंडपम', 'Ganesh Mandapam', 1.7, 0.5, new THREE.Vector3(X0 + 0.02, BACK + 2.05, (ZUP1 + ZEND) / 2), Math.PI / 2, 'red');
    const l = new THREE.PointLight(0xfff4e6, 2.4, 18, 1.3);
    l.position.set(xc, CEIL - 0.6, 0);
    root.add(l); // (not in a group that is ever hidden: the light count must not change)
    lights.push(l);
  }

  if (VIP_DARSHAN) {
    // VIP darshan goes in by the front doorway: the general tunnel is shut at its foot
    const gate = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.8, roughness: 0.4 });
    for (let k = 0; k <= 10; k++) box(under, gate, 0.04, 2.6, 0.04, T.X0 + 0.1 + k * 0.2, T.FLOOR, T.ZBOT + 1);
    P.solid(T.X0, T.FLOOR, T.ZBOT + 0.9, T.X1, T.FLOOR + 2.7, T.ZBOT + 1.1);
    finish();
    return { surface, under, portals, lights, spots: [...cs.list, ...guards], flames, ledMat: null, queueSpots, sevaks: [] };
  }

  // =================================================================== 3. Nandi hall + Ganesh Mandapam
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sevaks: CrowdSpot[] = [];
  {
    const { X, Z0, Z1, PLINTH, FLOOR, CEIL_HI, CEIL_LO } = GM;
    const marble = withEnv(new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.18 }), 0.55);
    const pillarMat = withEnv(new THREE.MeshStandardMaterial({ map: marbleTex(0xeee6d6), roughness: 0.35 }), 0.45);
    const silver = withEnv(new THREE.MeshStandardMaterial({ color: 0xdfe2e7, metalness: 0.85, roughness: 0.3 }), 1.0);
    const MG = new Marigolds();
    // the Nandi in the Nandi hall, brought forward and kept low so it sits below the line to the lingam
    nandi(under, M, 0, FLOOR, -0.85, 0.9);
    // floors: white marble; the front row (and the strip before the barricade), tiers, aisles (red granite runners), back
    box(under, marble, X * 2, 0.2, LANE_A.Z1 - Z0 + 0.1, 0, FLOOR - 0.2, (Z0 + LANE_A.Z1) / 2);
    P.floor(under, -X, X, Z0, LANE_A.Z1, FLOOR);
    // the darshan platform: one step up from the front row, between the Nandi hall's jambs, so the line
    // stands closer and above the Nandi with the garbhagriha doorway filling the middle of the view
    box(under, marble, PLAT.X * 2, PLAT.Y - FLOOR, PLAT.Z1 - PLAT.Z0, 0, FLOOR, (PLAT.Z0 + PLAT.Z1) / 2);
    // (its back half-step either side of the front stair, which comes down onto the platform's back edge)
    const SX = FRONT.W + FRONT.WALL, HW = PLAT.X - SX, HC = (PLAT.X + SX) / 2;
    box(under, M.brass, PLAT.X * 2, 0.02, 0.05, 0, PLAT.Y - 0.01, PLAT.Z1 - 0.02);
    for (const s of [-1, 1]) {
      box(under, marble, HW, (PLAT.Y - FLOOR) / 2, 0.32, s * HC, FLOOR, PLAT.Z1 + 0.16);
      box(under, M.brass, HW, 0.02, 0.05, s * HC, (PLAT.Y + FLOOR) / 2 - 0.01, PLAT.Z1 + 0.3);
      P.floor(under, s < 0 ? -PLAT.X : SX, s < 0 ? -SX : PLAT.X, PLAT.Z1, PLAT.Z1 + 0.32, (PLAT.Y + FLOOR) / 2);
    }
    P.floor(under, -PLAT.X, PLAT.X, PLAT.Z0, PLAT.Z1, PLAT.Y);
    for (const t of TIERS) {
      box(under, marble, TX * 2, t.y - FLOOR + 0.1, t.z1 - t.z0, 0, FLOOR - 0.1, (t.z0 + t.z1) / 2);
      box(under, M.brass, TX * 2, 0.02, 0.05, 0, t.y - 0.01, t.z0 + 0.02);
      P.floor(under, -TX, TX, t.z0, t.z1, t.y);
    }
    const tz1 = TIERS[TIERS.length - 1].z1;
    box(under, marble, TX * 2, BACK - FLOOR + 0.1, Z1 - tz1, 0, FLOOR - 0.1, (tz1 + Z1) / 2);
    P.floor(under, -TX, TX, tz1, Z1, BACK);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -X : TX, x1 = s < 0 ? -TX : X;
      slope(under, graniteRed, x0, x1, LANE_A.Z1, tz1, FLOOR, BACK);
      box(under, graniteRed, X - TX, 0.2, Z1 - tz1, (x0 + x1) / 2, BACK - 0.2, (tz1 + Z1) / 2);
      P.floor(under, x0, x1, LANE_A.Z1, tz1, FLOOR, BACK);
      P.floor(under, x0, x1, tz1, Z1 + (s > 0 ? 0.4 : 0), BACK);
    }
    // walls: red-stone dado under a saffron frieze, cream above; the north wall opens on the Nandi hall
    const yTop = (z: number) => (z < PLINTH ? CEIL_HI : CEIL_LO);
    for (const s of [-1, 1]) {
      const x = s * (X + 0.15);
      const segs: [number, number][] = s < 0 ? [[Z0, T.ZUP1], [T.ZEND, Z1 + 0.3]] : [[Z0, Z1 + 0.3]];
      for (const [z0, z1] of segs) {
        for (const [za, zb] of [[z0, Math.min(z1, PLINTH)], [Math.max(z0, PLINTH), z1]]) {
          if (zb - za < 0.01) continue;
          box(under, cream, 0.3, yTop((za + zb) / 2) - FLOOR + 0.2, zb - za, x, FLOOR - 0.2, (za + zb) / 2, P);
          box(under, dado, 0.04, 1.2, zb - za, x - s * 0.17, FLOOR, (za + zb) / 2);
          box(under, s < 0 ? friezeE : frieze, 0.04, 0.24, zb - za, x - s * 0.17, T.FLOOR + 1.45, (za + zb) / 2);
        }
      }
    }
    for (const s of [-1, 1]) {
      box(under, cream, X - NH, CEIL_HI - FLOOR + 0.2, 0.3, s * (X + NH) / 2, FLOOR - 0.2, Z0 - 0.15, P);
      box(under, dado, X - NH, 1.2, 0.04, s * (X + NH) / 2, FLOOR, Z0 + 0.02);
    }
    box(under, cream, NH * 2, CEIL_HI + 0.1, 0.3, 0, -0.1, Z0 - 0.15);
    // the front stair coming down through the hall (temple.ts frontStair): the end wall under its head, where
    // the standing tiers stop, and the hall's red dado and saffron frieze carried round its parapets
    {
      const { W, WALL, HEAD, FOOT, BOT } = FRONT, SC = W + WALL;
      const slope = (FRONT.TOP - BOT) / (HEAD - FOOT);
      box(under, cream, SC * 2, CEIL_HI - FLOOR, 0.2, 0, FLOOR, HEAD + 0.1);
      box(under, dado, SC * 2, 1.2, 0.04, 0, FLOOR, HEAD + 0.22);
      box(under, frieze, SC * 2, 0.24, 0.04, 0, T.FLOOR + 1.45, HEAD + 0.22);
      const zf = FOOT + (T.FLOOR + 1.75 - (BOT + 1.0)) / slope; // where the parapet's top clears the frieze
      for (const s of [-1, 1]) {
        box(under, dado, 0.04, 1.2, HEAD + 0.2 - FOOT, s * (SC + 0.02), FLOOR, (FOOT + HEAD + 0.2) / 2);
        box(under, s < 0 ? frieze : friezeE, 0.04, 0.24, HEAD + 0.2 - zf, s * (SC + 0.02), T.FLOOR + 1.45, (zf + HEAD + 0.2) / 2);
      }
    }
    // the Nandi hall's doorway clad in silver: jambs, a lintel band, a pair of brass bells
    for (const s of [-1, 1]) {
      box(under, silver, 0.18, -0.1 - FLOOR, 0.42, s * (NH - 0.09), FLOOR, Z0 + 0.03);
      box(under, silver, 0.26, 0.12, 0.48, s * (NH - 0.09), FLOOR + 0.6, Z0 + 0.03);
    }
    box(under, silver, NH * 2 + 0.2, 0.3, 0.46, 0, -0.42, Z0 + 0.03);
    box(under, M.gold, NH * 2 + 0.2, 0.04, 0.48, 0, -0.44, Z0 + 0.03);
    // south wall, open at the east aisle into the Palki Hall
    box(under, cream, X + TX, CEIL_LO - BACK + 0.2, 0.3, (TX - X) / 2, BACK - 0.2, Z1 + 0.15, P);
    // ceilings: high under the plinth, a deep beam where the courtyard begins, lower beyond
    // (open over the front stair, x ±FRONT.W, z FOOT..HEAD)
    {
      const { W, FOOT, HEAD } = FRONT, z0 = Z0 - 0.3, w = X + 0.3 - W;
      for (const s of [-1, 1]) box(under, ceiling, w, 0.15, PLINTH - z0, s * (W + w / 2), CEIL_HI - 0.15, (z0 + PLINTH) / 2);
      box(under, ceiling, W * 2, 0.15, FOOT - z0, 0, CEIL_HI - 0.15, (z0 + FOOT) / 2);
      box(under, ceiling, W * 2, 0.15, PLINTH - HEAD, 0, CEIL_HI - 0.15, (HEAD + PLINTH) / 2);
    }
    box(under, ceiling, X * 2 + 0.6, 0.15, Z1 - PLINTH + 0.3, 0, CEIL_LO - 0.15, (PLINTH + Z1) / 2 + 0.15);
    box(under, cream, X * 2 + 0.6, CEIL_HI - CEIL_LO + 0.15, 0.4, 0, CEIL_LO - 0.15, PLINTH);
    // coffers: cross beams over the pillar lines, a gilt band on each
    for (const z of [LANE_A.Z1, TIERS[0].z1, TIERS[1].z1]) {
      // (the beams over the front stair stop at its parapets)
      const cut = z <= FRONT.HEAD + 0.2 ? FRONT.W + FRONT.WALL : 0;
      for (const [x0, x1] of cut ? [[-X, -cut], [cut, X]] : [[-X, X]]) {
        box(under, cream, x1 - x0, 0.3, 0.35, (x0 + x1) / 2, CEIL_HI - 0.45, z);
        box(under, M.gold, x1 - x0, 0.04, 0.37, (x0 + x1) / 2, CEIL_HI - 0.46, z);
      }
    }
    for (const x of [-TX, TX]) box(under, cream, 0.35, 0.3, PLINTH - Z0, x, CEIL_HI - 0.45, (Z0 + PLINTH) / 2);
    for (let z = Z0 + 0.8; z < Z1 - 0.3; z += 1.4) {
      const y = (z < PLINTH ? CEIL_HI : CEIL_LO) - 0.19;
      for (const x of [-6, -2.5, 2.5, 6]) tubeAt(x, y, z, true);
    }
    // carved marble pillars (the temple's own Maratha profile) on the barricade junctions
    const pts: [number, number][] = [];
    for (const z of [LANE_A.Z1, TIERS[0].z1, TIERS[1].z1]) for (const x of [-TX, TX]) pts.push([x, z]);
    carvedPillars(under, pillarMat, pts, FLOOR, CEIL_HI - 0.45 - FLOOR, 0.18, P);
    // barricades: the platform's front rail and sides, the strip before the Nandi hall, the front row's back
    // rail, the tier rails, the aisles
    // the platform's front rail, its middle gate standing open (the virtual yatra goes on into the sanctum)
    barricade(railsU, postsU, P, [-PLAT.X, PLAT.Z0], [-1.35, PLAT.Z0], PLAT.Y);
    barricade(railsU, postsU, P, [1.35, PLAT.Z0], [PLAT.X, PLAT.Z0], PLAT.Y);
    for (const s of [-1, 1]) {
      barricade(railsU, postsU, P, [s * (PLAT.X + 0.05), PLAT.Z0], [s * (PLAT.X + 0.05), PLAT.Z1], PLAT.Y);
      barricade(railsU, postsU, P, [s * (PLAT.X + 0.05), LANE_A.Z0], [s * X, LANE_A.Z0], FLOOR);
    }
    // (the rails across the hall stop at the front stair's parapets)
    const SC = FRONT.W + FRONT.WALL;
    const across = (z: number, y: number) => {
      if (z > FRONT.HEAD + 0.2) { barricade(railsU, postsU, P, [-TX, z], [TX, z], y); return; }
      barricade(railsU, postsU, P, [-TX, z], [-SC, z], y);
      barricade(railsU, postsU, P, [SC, z], [TX, z], y);
    };
    across(LANE_A.Z1, FLOOR);
    for (const t of TIERS) if (t.z1 < tz1 + 0.01) across(t.z1, t.y);
    for (const x of [-TX, TX]) {
      barricade(railsU, postsU, P, [x, LANE_A.Z1], [x, tz1], (FLOOR + BACK) / 2);
      barricade(railsU, postsU, P, [x, tz1], [x, Z1], BACK);
    }
    // the silver-faced gate, swung open and parked against the rail; a notice beside it tells the real rule
    box(under, silver, 1.4, 0.85, 0.05, -2.07, PLAT.Y + 0.12, PLAT.Z0 + 0.08);
    for (const x of [-1.37, -2.77]) box(under, silver, 0.06, 1.0, 0.06, x, PLAT.Y, PLAT.Z0 + 0.08);
    noticeBoard(under, M, new THREE.Vector3(2.05, PLAT.Y, PLAT.Z0 + 0.1), 0, 1.3);
    P.solid(1.35, PLAT.Y, PLAT.Z0, 2.75, PLAT.Y + 2.0, PLAT.Z0 + 0.18);
    // the Nandi is solid, and a sevak stands beside the open way in
    P.solid(-0.45, FLOOR, -1.75, 0.45, FLOOR + 1.1, 0.05);
    {
      const sv: CrowdSpot = { x: 1.45, y: FLOOR, z: -0.45, ry: -Math.PI / 2, kind: 'kurta', pose: 'stand' };
      guards.push(sv);
      sevaks.push(sv);
      P.solid(1.2, FLOOR, -0.7, 1.7, FLOOR + 1.8, -0.2);
    }
    // the board over the Nandi hall and the LED screens either side in red-and-gold frames, showing the lingam live
    signBoard(under, 'श्री महाकालेश्वर ज्योतिर्लिंग', 'Shri Mahakaleshwar Jyotirlinga', 3.8, 0.75, new THREE.Vector3(0, FLOOR + 3.08, Z0 + 0.02), 0, 'cream');
    const ledGeo = new THREE.PlaneGeometry(2.4, 2.4 * 9 / 16);
    const red = new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const x = s * 5.35, y = FLOOR + 2.55;
      box(under, red, 2.84, 1.82, 0.12, x, y - 0.91, Z0 + 0.03);
      for (const [w, h, dx, dy] of [[2.66, 0.05, 0, 0.72], [2.66, 0.05, 0, -0.77], [0.05, 1.5, 1.31, -0.75], [0.05, 1.5, -1.31, -0.75]] as const) {
        box(under, M.gold, w, h, 0.03, x + dx, y + dy, Z0 + 0.1);
      }
      box(under, M.gold, 0.5, 0.18, 0.05, x, y + 0.88, Z0 + 0.06);
      const scr = new THREE.Mesh(ledGeo, ledMat);
      scr.position.set(x, y, Z0 + 0.1);
      under.add(scr);
    }
    signBoard(under, 'गणेश मंडपम', 'Ganesh Mandapam', 3.0, 0.62, new THREE.Vector3(0, CEIL_LO - 0.62, Z1 - 0.02), Math.PI, 'red');
    signBoard(under, 'निर्गम →', 'Exit · Palki Hall', 1.6, 0.48, new THREE.Vector3(X - 0.02, FLOOR + 2.3, 2.6), -Math.PI / 2, 'green');
    signBoard(under, 'कृपया आगे बढ़ें', 'Please move ahead', 1.6, 0.48, new THREE.Vector3(-X + 0.02, FLOOR + 2.3, 2.6), Math.PI / 2, 'blue');
    // marigold torans: over the Nandi hall's doorway with hanging strands, and swags along the beams
    MG.strand(new THREE.Vector3(-NH + 0.1, -0.5, Z0 + 0.3), new THREE.Vector3(NH - 0.1, -0.5, Z0 + 0.3), 0.35, 'oooyyy', 0.036);
    for (let k = 0; k <= 8; k++) {
      const x = -NH + 0.2 + k * ((NH * 2 - 0.4) / 8);
      MG.strand(new THREE.Vector3(x, -0.5, Z0 + 0.3), new THREE.Vector3(x, -0.85 - (k % 2) * 0.2, Z0 + 0.3), 0, k % 2 ? 'oy' : 'yo', 0.03);
    }
    for (const z of [LANE_A.Z1, TIERS[0].z1, TIERS[1].z1]) {
      for (let k = 0; k < 6; k++) {
        if (z < FRONT.HEAD - 0.5 && (k === 2 || k === 3)) continue; // (over the front stair)
        const xa = -X + k * (X * 2 / 6) + 0.2, xb = xa + X * 2 / 6 - 0.4;
        MG.strand(new THREE.Vector3(xa, 0.28, z + 0.2), new THREE.Vector3(xb, 0.28, z + 0.2), 0.3, k % 2 ? 'oooyy' : 'yyooo', 0.034);
      }
    }
    // brass bells hung on chains along the front row's beam and either side of the Nandi hall's doorway
    const bellAt: [number, number, number, number][] = [];
    for (let x = -6; x <= 6.01; x += 2) if (Math.abs(x) > FRONT.W + 0.5) bellAt.push([x, CEIL_HI - 0.45, LANE_A.Z1 + 0.25, 0.75]);
    for (const s of [-1, 1]) bellAt.push([s * 2.7, -0.42, Z0 + 0.35, 0.45]);
    const bellGeo = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.15, 0.03], [0.12, 0.12], [0.09, 0.26], [0.05, 0.3], [0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    const bells = new THREE.InstancedMesh(bellGeo, M.brass, bellAt.length);
    const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, -0.5, 0), M.brass, bellAt.length);
    bellAt.forEach(([x, y, z, len], i) => {
      chains.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, len, 1)));
      bells.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y - len - 0.32, z));
    });
    under.add(bells, chains);
    // the mandapam's Ganesh: a large sindoor-coated idol in a silver shrine on the west wall by the aisle
    const gn = ganeshShrine(under, M, silver, MG, -X, FLOOR, 7.0);
    P.solid(-X, FLOOR, 7.0 - 1.25, -6.35, 0.5, 7.0 + 1.25);
    flames.push(...gn);
    MG.build(under);
    // lights: cool white over the front row and over the tiers
    for (const [z, y, i] of [[3.4, CEIL_HI - 0.7, 4], [9.0, CEIL_LO - 0.5, 4.5]] as const) {
      const l = new THREE.PointLight(0xf4f6ff, i, 15, 1.2);
      l.position.set(0, y, z);
      root.add(l);
      lights.push(l);
    }

    // the standing tiers and the back, packed, facing the lingam
    for (const t of TIERS) {
      for (const z of [t.z0 + 0.7, t.z0 + 1.55]) {
        for (let x = -TX + 0.5; x < TX - 0.4; x += 0.52 + rnd() * 0.1) {
          if (z < FRONT.HEAD + 0.3 && Math.abs(x) < FRONT.W + FRONT.WALL + 0.35) continue; // (the front stair)
          cs.add(x, t.y, z + (rnd() - 0.5) * 0.15, Math.PI + (rnd() - 0.5) * 0.35 + x * 0.03);
          const h = Math.floor(rnd() * 10);
          cs.list[cs.list.length - 1].queue = h < 5 ? 'namaste' : h < 7 ? 'stand' : h < 8 ? 'raised' : 'thali';
        }
      }
    }
    for (const z of [tz1 + 0.7, tz1 + 1.6]) {
      for (let x = -TX + 0.5; x < TX - 0.4; x += 0.55 + rnd() * 0.1) {
        cs.add(x, BACK, z + (rnd() - 0.5) * 0.15, Math.PI + (rnd() - 0.5) * 0.4);
        cs.list[cs.list.length - 1].queue = rnd() < 0.5 ? 'namaste' : 'stand';
      }
    }
    // temple sevaks on the strip either side of the platform, behind its rails, turning to wave the line on
    for (const s of [-1, 1]) {
      const sv: CrowdSpot = { x: s * 3.95, y: FLOOR, z: 1.15, ry: -s * Math.PI / 2, kind: 'kurta', pose: 'stand' };
      guards.push(sv);
      sevaks.push(sv);
    }
  }

  // =================================================================== 4. Palki Hall and the exit ramp
  {
    const { X0, X1, Z0, Z1, Y } = PH;
    const CEIL = GM.CEIL_LO;
    box(under, granite, X1 - X0, 0.2, Z1 - Z0, (X0 + X1) / 2, Y - 0.2, (Z0 + Z1) / 2);
    P.floor(under, X0, X1, Z0, Z1, Y);
    box(under, cream, 0.3, CEIL - Y + 0.2, Z1 - Z0, X0 - 0.15, Y - 0.2, (Z0 + Z1) / 2, P);
    box(under, cream, 0.3, CEIL - Y + 0.2, Z1 - Z0 + 0.3, X1 + 0.15, Y - 0.2, (Z0 + Z1) / 2, P);
    box(under, cream, EX.X0 - X0 + 0.3, CEIL - Y + 0.2, 0.3, (X0 + EX.X0) / 2 - 0.15, Y - 0.2, Z1 + 0.15, P);
    box(under, cream, X1 - EX.X1 + 0.3, CEIL - Y + 0.2, 0.3, (EX.X1 + X1) / 2 + 0.15, Y - 0.2, Z1 + 0.15, P);
    box(under, ceiling, X1 - X0 + 0.6, 0.15, Z1 - Z0 + 0.3, (X0 + X1) / 2, CEIL - 0.15, (Z0 + Z1) / 2);
    for (let x = X0 + 1; x < X1; x += 2.2) tubeAt(x, CEIL - 0.19, (Z0 + Z1) / 2, true);
    // the silver palki of Shri Mahakal behind a rail, as shown to pilgrims on their way out
    palki(under, M, 0.9, Y, 15.2, env);
    box(under, new THREE.MeshStandardMaterial({ color: 0x5a1a12, roughness: 0.9 }), 3.0, 0.08, 2.0, 0.9, Y, 15.2);
    barricade(railsU, postsU, P, [X0, 13.9], [2.5, 13.9], Y);
    barricade(railsU, postsU, P, [2.5, 13.9], [2.5, Z1], Y);
    signBoard(under, 'पालकी हॉल', 'Palki Hall', 2.0, 0.55, new THREE.Vector3(0.9, CEIL - 0.55, 13.05), 0, 'red');
    signBoard(under, 'निर्गम ↑', 'Exit to the courtyard', 1.8, 0.5, new THREE.Vector3((EX.X0 + EX.X1) / 2, CEIL - 0.5, Z1 - 0.02), Math.PI, 'green');
    // the sunken exit ramp, open to the sky: stone retaining walls, steel railings at the top
    P.floor(portals, EX.X0, EX.X1, EX.Z0, EX.Z1, Y, 0);
    P.floor(portals, EX.X0, EX.X1, EX.Z1, EX.Z1 + 0.6, 0);
    slope(portals, kota, EX.X0, EX.X1, EX.Z0, EX.Z1, Y, 0);
    for (const [x, th] of [[EX.X0 - 0.3, 0.3], [EX.X1, 0.3]] as const) {
      box(portals, M.kundStone, th, -Y + 0.15, EX.Z1 - EX.Z0 - 0.3, x + th / 2, Y - 0.15, (EX.Z0 + 0.3 + EX.Z1) / 2);
      P.solid(x, Y - 0.2, EX.Z0, x + th, 1.1, EX.Z1);
      barricade(railsP, postsP, null, [x + th / 2, EX.Z0], [x + th / 2, EX.Z1], 0);
    }
    box(portals, M.kundStone, EX.X1 - EX.X0 + 0.6, 0.15, 0.3, (EX.X0 + EX.X1) / 2, -0.15, EX.Z0 + 0.15);
    barricade(railsP, postsP, P, [EX.X0 - 0.15, EX.Z0 + 0.1], [EX.X1 + 0.15, EX.Z0 + 0.1], 0);
    // the exit arch over the ramp's mouth
    const az = EX.Z1 + 0.4;
    for (const x of [EX.X0 - 0.45, EX.X1 + 0.45]) box(portals, sandstone, 0.3, 3.3, 0.3, x, 0, az, P);
    box(portals, sandstone, EX.X1 - EX.X0 + 1.4, 0.45, 0.4, (EX.X0 + EX.X1) / 2, 3.3, az);
    signBoard(portals, 'निर्गम द्वार', 'Exit', 2.6, 0.6, new THREE.Vector3((EX.X0 + EX.X1) / 2, 3.0, az + 0.21), 0, 'green');
    signBoard(portals, 'निर्गम द्वार', 'Exit · Palki Hall', 2.6, 0.6, new THREE.Vector3((EX.X0 + EX.X1) / 2, 3.0, az - 0.24), Math.PI, 'green');
  }

  // guards at the shut ways into the sanctum: the front doorway and the east stair
  guards.push({ x: 1.45, y: 0.9, z: 6.75, ry: 0, kind: 'kurta', pose: 'stand' });
  guards.push({ x: 12.95, y: 0, z: 11.9, ry: -Math.PI / 2, kind: 'kurta', pose: 'stand' });
  P.solid(1.2, 0.9, 6.5, 1.7, 2.6, 7.0);
  P.solid(12.7, 0, 11.65, 13.2, 1.8, 12.15);
  // the same notice at the front doors (the stair behind them is the VIP way; in this yatra you go in below)
  noticeBoard(portals, M, new THREE.Vector3(-2.15, 0.9, 6.75), 0, 1.15);
  P.solid(-2.8, 0.9, 6.55, -1.5, 2.9, 6.95);

  finish();
  return { surface, under, portals, lights, spots: [...cs.list, ...guards], flames, ledMat, queueSpots, sevaks };

  function finish() {
    const railGeo = new THREE.CylinderGeometry(0.026, 0.026, 1, 6);
    const postGeo = new THREE.CylinderGeometry(0.028, 0.032, 1.08, 6);
    for (const [grp, rr, pp] of [[surface, rails, posts], [under, railsU, postsU], [portals, railsP, postsP]] as const) {
      if (!rr.length) continue;
      const ri = new THREE.InstancedMesh(railGeo, steel, rr.length);
      rr.forEach((m, i) => ri.setMatrixAt(i, m));
      const pi = new THREE.InstancedMesh(postGeo, steel, pp.length);
      pp.forEach((m, i) => pi.setMatrixAt(i, m));
      ri.castShadow = pi.castShadow = grp !== under;
      grp.add(ri, pi);
    }
    // all the tube lights in one draw
    const tg = mergeGeometries(tubes.map((m) => tubeGeo.clone().applyMatrix4(m)));
    if (tg) under.add(new THREE.Mesh(tg, tube));
  }
}

/**
 * An invisible lid just under the courtyard that casts the sun's shadow over everything below ground,
 * so the tunnel, the mandapam and the sanctum stay dark when the exterior (which otherwise shades
 * them) is switched off underground. Drawn with no colour or depth: it only exists in the shadow map.
 */
export function sunLid(root: THREE.Group) {
  const geos = ([
    [-10.6, 9.8, -9.7, 13.2], [9.8, 12.6, -2.9, 3.0], [-1.3, 7.4, 13.1, 17.1],
  ] as const).map(([x0, x1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, 0.05, z1 - z0).translate((x0 + x1) / 2, -0.3, (z0 + z1) / 2));
  const lid = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  lid.castShadow = true;
  lid.receiveShadow = false;
  lid.name = 'sun-lid';
  root.add(lid);
  return lid;
}

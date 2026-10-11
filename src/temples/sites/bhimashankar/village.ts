import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import { Flag } from '../../engine/kit';
import type { BM } from './mats';
import { Merger } from './merge';
import { lathe } from './forms';
import { STAIR, FLIGHT_RUN, FLIGHT_LEN, STAIR_TOP_X, STAIR_TOP_Y, PLAZA, COURT, RIM, stairY } from './layout';
import { terrainH } from './terrain';
import type { Offerings } from './offerings';

/**
 * The approach: from the road-head and bus stand in Bhimashankar village, under the steel arch
 * "श्रीक्षेत्र जय भीमाशंकर", a broad stone stairway (~180 steps, ~30 m of descent) runs down the slope
 * to the temple hollow — lined both sides with little shops selling prasad, flowers, bel, rudraksha and
 * puja things under tin awnings, the middle stretch roofed over by a steel queue shed, a steel rail down the
 * centre. Above and behind the shops, the village's two- and three-storey houses in pale blue, cream and
 * yellow plaster with Mangalore-tile and tin roofs (photographs 2011–2023).
 */

/** vertex-coloured boxes (shop goods, shutters, signs' frames) merged into one mesh */
class Paint {
  private list: THREE.BufferGeometry[] = [];
  box(w: number, h: number, d: number, x: number, y: number, z: number, col: number | THREE.Color, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    const c = col instanceof THREE.Color ? col : new THREE.Color(col);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.list.push(g);
  }
  flush(parent: THREE.Object3D, mat: THREE.Material) {
    if (!this.list.length) return;
    const m = new THREE.Mesh(mergeGeometries(this.list, false)!, mat);
    m.castShadow = false;
    m.receiveShadow = true;
    parent.add(m);
  }
}

const SIGNS = [
  'श्री भीमाशंकर प्रसाद भांडार', 'पूजा साहित्य', 'हार · फुले · बेल', 'रुद्राक्ष माळा', 'जय भोले प्रसाद', 'ओम नमः शिवाय स्टोअर्स',
  'महादेव फोटो फ्रेम', 'चहा · नाश्ता', 'शिवशक्ती पेढे', 'भीमा प्रसाद केंद्र', 'हर हर महादेव', 'गणेश पूजा भांडार',
  'नागफणी हॉटेल', 'साई जनरल स्टोअर्स', 'कमलजा देवी प्रसाद', 'ज्योतिर्लिंग फुले',
];
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d')!;
  const bgs = ['#c8261a', '#f2b80c', '#1d5fa8', '#e86a10', '#7a1a5a', '#1e7a3e', '#f4efe2', '#b8141e'];
  SIGNS.forEach((s, i) => {
    const y = i * 64;
    const bg = bgs[i % bgs.length];
    g.fillStyle = bg;
    g.fillRect(0, y, 1024, 64);
    g.fillStyle = bg === '#f2b80c' || bg === '#f4efe2' ? '#8a1410' : '#fff6e0';
    g.font = '800 42px Martel, "Noto Sans Devanagari", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, 512, y + 34);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(0, y + 2, 1024, 3);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** text for the steel arch over the head of the stairs (cut-out letters on a transparent ground) */
function archText() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 2048, 256);
  // heavy cast letters with a thick outline, on a rail with little scrolls and an Om roundel at each end
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineJoin = 'round';
  g.font = '900 176px Martel, "Noto Sans Devanagari", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.strokeText('श्रीक्षेत्र जय भीमाशंकर', 1024, 132);
  g.fillText('श्रीक्षेत्र जय भीमाशंकर', 1024, 132);
  g.fillRect(30, 226, 1988, 22);
  g.fillRect(30, 6, 1988, 10);
  g.lineWidth = 7;
  for (let x = 60; x < 2000; x += 64) { g.beginPath(); g.arc(x, 214, 12, Math.PI, 0); g.stroke(); }
  for (const x of [60, 1988]) { g.beginPath(); g.arc(x, 120, 48, 0, Math.PI * 2); g.stroke(); g.font = '900 64px Martel, serif'; g.fillText('ॐ', x, 124); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildVillage(root: THREE.Group, K: BM, P: Physics, flames: Flames, O: Offerings) {
  const g = new THREE.Group();
  g.name = 'village';
  root.add(g);
  const B = new Merger(P, 'stair');
  const Pt = new Paint();
  const flags: Flag[] = [];
  const zA = STAIR.z0, zB = STAIR.z1, zm = (zA + zB) / 2;
  const fr = STAIR.steps * STAIR.rise;
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- the stairway ----------
  for (let k = 0; k < STAIR.flights; k++) {
    const xk = STAIR.x0 + k * FLIGHT_LEN, yk = k * fr;
    for (let i = 0; i < STAIR.steps; i++) {
      const top = yk + (i + 1) * STAIR.rise;
      B.span(K.steps, xk + i * STAIR.tread, top - 0.5, zA, xk + (i + 1) * STAIR.tread + 0.02, top, zB);
    }
    // landing
    B.span(K.steps, xk + FLIGHT_RUN, yk + fr - 0.6, zA, xk + FLIGHT_LEN + 0.02, yk + fr, zB);
    // walkable: flight ramp at the nosings, flat landing
    const geo = new THREE.BufferGeometry();
    const xa = xk, xb = xk + FLIGHT_RUN, ya = yk + STAIR.rise * 0.6, yb = yk + fr;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xa, ya, zA, xb, yb, zA, xb, yb, zB, xa, ya, zB]), 3));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    g.add(m);
    P.floors.push(m);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xb, yb, zA, xk + FLIGHT_LEN + 0.05, yb, zA, xk + FLIGHT_LEN + 0.05, yb, zB, xb, yb, zB]), 3));
    lg.setIndex([0, 2, 1, 0, 3, 2]);
    lg.computeVertexNormals();
    const lm = new THREE.Mesh(lg, m.material);
    g.add(lm);
    P.floors.push(lm);
    // side kerbs / plinths of the shops and their colliders
    for (const [za, zb] of [[zA - 0.35, zA], [zB, zB + 0.35]]) {
      B.span(K.stone, xk, yk - 0.6, za, xk + FLIGHT_LEN + 0.02, yk + fr + 0.35, zb);
    }
    P.solid(xk - 0.1, yk - 1.5, zA - 6, xk + FLIGHT_LEN + 0.1, yk + fr + 3, zA);
    P.solid(xk - 0.1, yk - 1.5, zB, xk + FLIGHT_LEN + 0.1, yk + fr + 3, zB + 6);
    // the centre rail: steel pipe on posts
    const L = Math.hypot(FLIGHT_RUN, fr), ang = Math.atan2(fr, FLIGHT_RUN);
    const railM = new THREE.Matrix4().compose(new THREE.Vector3(xk + FLIGHT_RUN / 2, yk + fr / 2 + 0.95, zm), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(1, 1, 1));
    B.add(K.steel, new THREE.CylinderGeometry(0.03, 0.03, L, 8).rotateZ(Math.PI / 2), railM);
    B.add(K.steel, new THREE.CylinderGeometry(0.03, 0.03, STAIR.landing, 8).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(xk + FLIGHT_RUN + STAIR.landing / 2, yk + fr + 0.95, zm));
    for (const t of [0, 0.5, 1]) B.place(K.steel, new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), xk + FLIGHT_RUN * t, yk + fr * t + 0.475 + (t === 0 ? STAIR.rise : 0), zm);
  }
  // the bottom flight's foot is the courtyard; the top lands on the plaza
  P.floor(g, PLAZA.x0 - 0.05, PLAZA.x1, PLAZA.z0, PLAZA.z1, STAIR_TOP_Y);
  B.span(K.laterite, PLAZA.x0, STAIR_TOP_Y - 0.4, PLAZA.z0, PLAZA.x1, STAIR_TOP_Y, PLAZA.z1);
  B.span(K.steps, PLAZA.x0, STAIR_TOP_Y - 0.4, zA - 2, PLAZA.x1, STAIR_TOP_Y + 0.01, zB + 2); // round 3: paved right through the road-head (no laterite seam at spawn)
  P.solid(PLAZA.x0, 0, PLAZA.z0 - 1, PLAZA.x1, 40, PLAZA.z0);
  P.solid(PLAZA.x0, 0, PLAZA.z1, PLAZA.x1, 40, PLAZA.z1 + 1);
  P.solid(PLAZA.x1, 0, PLAZA.z0, PLAZA.x1 + 1, 40, PLAZA.z1);

  // ---------- the steel queue shed over the middle of the stairway ----------
  const shedX0 = STAIR.x0 + FLIGHT_LEN * 2, shedX1 = STAIR.x0 + FLIGHT_LEN * 9;
  for (let x = shedX0; x <= shedX1 + 0.01; x += FLIGHT_LEN / 2) {
    const y = stairY(x);
    for (const z of [zA - 0.2, zB + 0.2]) B.span(K.paintSteel, x - 0.07, y - 0.2, z - 0.07, x + 0.07, y + 4.2, z + 0.07);
    B.place(K.paintSteel, new THREE.BoxGeometry(0.1, 0.16, zB - zA + 1.2), x, y + 4.1, zm);
  }
  for (let k = 2; k < 9; k++) {
    const xk = STAIR.x0 + k * FLIGHT_LEN, yk = k * fr;
    const L = Math.hypot(FLIGHT_LEN, fr), ang = Math.atan2(fr, FLIGHT_LEN);
    for (const s of [-1, 1]) {
      const pl = new THREE.PlaneGeometry(L + 0.2, (zB - zA) / 2 + 0.9);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(xk + FLIGHT_LEN / 2, yk + fr / 2 + 4.25 + 0.18, zm + s * ((zB - zA) / 4 + 0.45)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 - s * 0.16, 0, ang, 'ZYX')), new THREE.Vector3(1, 1, 1));
      B.add(K.tin, pl, m);
    }
  }

  // ---------- shops both sides, stepping with the stairs, and houses above them ----------
  const SHOP_W = 3.18;
  const goodsCols = [0xd8202a, 0xf0a800, 0xffffff, 0x2a62c8, 0xe86010, 0x21a050, 0xb81880, 0xf4d070, 0x8a4a20, 0xff8ac0];
  const atlas = signAtlas();
  const signMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.08 });
  const signs: THREE.BufferGeometry[] = [];
  const sign = (w: number, h: number, x: number, y: number, z: number, ry: number, idx: number) => {
    const pg = new THREE.PlaneGeometry(w, h);
    const uv = pg.attributes.uv;
    const v0 = 1 - (idx + 1) / 16, v1 = 1 - idx / 16;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? v1 - 0.002 : v0 + 0.002);
    pg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    signs.push(pg);
  };
  // round 3: shop props in place of flat-colour cubes (Temple_entry_gate.jpg): cane baskets heaped with flowers,
  // steel prasad trays of pedhe and laddu, framed god-pictures, hanging clusters of rudraksha and bead strings
  const basketG = lathe([[0, 0], [0.12, 0], [0.17, 0.08], [0.2, 0.13], [0.21, 0.14], [0.19, 0.145], [0, 0.1]], 12);
  const trayG = lathe([[0, 0], [0.16, 0], [0.19, 0.025], [0.2, 0.03], [0.18, 0.032], [0, 0.012]], 16);
  const basket = (x: number, y: number, z: number, sc = 1, flowers = true) => {
    B.place(K.wood, basketG, x, y, z, 0, sc);
    if (flowers) O.heap(x, y + 0.11 * sc, z, 0.15 * sc, 0.07 * sc, 6);
  };
  const tray = (x: number, y: number, z: number) => {
    B.place(K.steel, trayG, x, y, z);
    const sweet = rnd() < 0.5 ? 0xe8a83a : 0xf0e2c0;
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4, r = k === 0 ? 0 : 0.08;
      O.add('mogra', x + Math.cos(a) * r, y + 0.04 + (k === 0 ? 0.03 : 0), z + Math.sin(a) * r, 1.3, sweet);
    }
  };
  const picture = (x: number, y: number, z: number, ry: number, w = 0.3, h = 0.38) => {
    Pt.box(w, h, 0.025, x, y, z, 0xc89a30, ry);
    const off = new THREE.Vector3(0, 0, 0.008).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    const pc = [0x2a4a9a, 0xc8401a, 0x1e7a6a, 0xd87a20, 0x6a2a8a][Math.floor(rnd() * 5)];
    Pt.box(w - 0.06, h - 0.06, 0.02, x + off.x, y + 0.03, z + off.z, pc, ry);
    Pt.box((w - 0.06) * 0.4, (h - 0.06) * 0.45, 0.022, x + off.x * 1.3, y + 0.03 + (h - 0.06) * 0.25, z + off.z * 1.3, 0xe8c890, ry);
  };
  const strings = (x: number, yTop: number, z: number) => {
    const cols = [0x4a2414, 0x5a2e16, 0x7a3a1a, 0xd8b040, 0xe8e0d0, 0xc02a20];
    for (let k = 0; k < 6; k++) {
      const L = 0.35 + rnd() * 0.35;
      Pt.box(0.014, L, 0.014, x + (k - 2.5) * 0.035, yTop - L, z + (rnd() - 0.5) * 0.04, cols[k < 3 ? k : Math.floor(rnd() * cols.length)]);
    }
  };
  const house = (x0: number, x1: number, zNear: number, zFar: number, y: number, storeys: number, side: number, shop: boolean) => {
    // side = +1: the house lies at +z of the street face zNear; −1: at −z
    const za = Math.min(zNear, zFar), zb = Math.max(zNear, zFar);
    const pm = K.plaster[Math.floor(rnd() * K.plaster.length)];
    const H = storeys * 3.0;
    const xm = (x0 + x1) / 2, w = x1 - x0;
    if (shop) {
      // back wall and party walls of the open shop, a raised floor, the counter, shelves of goods
      B.span(pm, x0, y - 0.5, side > 0 ? zb - 0.25 : za, x1, y + H, side > 0 ? zb : za + 0.25);
      B.span(pm, x0, y - 0.5, za, x0 + 0.18, y + 3.0, zb);
      B.span(K.stone, x0 + 0.18, y - 0.5, za, x1, y + 0.05, zb);
      const cz = zNear + side * 0.45;
      B.span(K.wood, x0 + 0.3, y, cz - 0.3, x1 - 0.3, y + 0.85, cz + 0.3);
      for (let s = 0; s < 3; s++) {
        const sz = side > 0 ? zb - 0.6 : za + 0.6;
        B.span(K.wood, x0 + 0.3, y + 0.9 + s * 0.6, sz - 0.3, x1 - 0.3, y + 0.94 + s * 0.6, sz + 0.3);
        for (let k = 0; k < 5; k++) {
          const gx = x0 + 0.5 + k * ((w - 1.0) / 4) + rnd() * 0.08;
          const ys = y + 0.94 + s * 0.6, kind = rnd();
          if (s === 2 || kind < 0.35) picture(gx, ys, sz + side * 0.12, side > 0 ? Math.PI : 0, 0.3, 0.4);
          else if (kind < 0.6) { basket(gx, ys, sz, 0.8, false); basket(gx, ys + 0.1, sz, 0.8, false); }
          else Pt.box(0.2, 0.12 + rnd() * 0.12, 0.2, gx, ys, sz, [0xf2e2b0, 0xd8b040, 0xe8d8c8, 0xc0302a][Math.floor(rnd() * 4)]);
        }
      }
      // on the counter: plates of prasad, baskets of flowers and bel
      for (let k = 0; k < 4; k++) {
        const bx = x0 + 0.6 + k * ((w - 1.2) / 3);
        const kind = rnd();
        if (kind < 0.5) basket(bx, y + 0.85, cz);
        else tray(bx, y + 0.85, cz);
      }
      // hanging garlands and rudraksha strings from the shop front
      for (let k = 0; k < 2; k++) {
        const hx = x0 + 0.5 + k * (w - 1);
        O.strand(new THREE.Vector3(hx - 0.25, y + 2.55, zNear + side * 0.05), new THREE.Vector3(hx + 0.25, y + 2.55, zNear + side * 0.05), 0.35, 0.8);
      }
      // things hung along the shop front: framed pictures, toy and bangle strings, bags of prasad
      for (let k = 0; k < 6; k++) {
        const hx = x0 + 0.45 + k * ((w - 0.9) / 5);
        const kind = rnd();
        if (kind < 0.35) {
          Pt.box(0.32, 0.4, 0.03, hx, y + 1.95, zNear + side * 0.12, 0xd8b040);
          Pt.box(0.26, 0.33, 0.035, hx, y + 1.985, zNear + side * 0.115, goodsCols[Math.floor(rnd() * goodsCols.length)]);
        } else if (kind < 0.7) {
          strings(hx, y + 2.4, zNear + side * 0.12);
        } else {
          Pt.box(0.22, 0.3, 0.1, hx, y + 2.0, zNear + side * 0.14, kind < 0.85 ? 0xf2d8a0 : 0xe02a20);
        }
      }
      Pt.box(w - 0.3, 0.04, 0.04, xm, y + 2.42, zNear + side * 0.12, 0x6a6a6a);
      // rolled shutter box and the sign above the front
      Pt.box(w - 0.2, 0.32, 0.3, xm, y + 2.68, zNear + side * 0.15, 0x6a6e70);
      sign(w - 0.3, 0.48, xm, y + 3.25, zNear - side * 0.04, side > 0 ? Math.PI : 0, Math.floor(rnd() * SIGNS.length));
      // tin awning sloping out over the stair edge
      const aw = new THREE.PlaneGeometry(w + 0.05, 1.5);
      const am = new THREE.Matrix4().compose(new THREE.Vector3(xm, y + 3.75 - 0.25, zNear - side * 0.6),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + side * 0.32, 0, 0)), new THREE.Vector3(1, 1, 1));
      B.add(rnd() < 0.6 ? K.tinBlue : K.tin, aw, am);
      // upper storeys: front wall with windows and a balcony
      B.span(pm, x0, y + 3.0, side > 0 ? zNear : zNear - 0.2, x1, y + H, side > 0 ? zNear + 0.2 : zNear);
      B.span(pm, x0, y + 3.0, za, x0 + 0.2, y + H, zb);
      B.span(pm, x1 - 0.2, y + 3.0, za, x1, y + H, zb);
    } else {
      B.span(pm, x0, y - 3.5, za, x1, y + H, zb);
    }
    // windows on the street face of each upper storey
    for (let s = shop ? 1 : 0; s < storeys; s++) {
      const n = Math.max(1, Math.floor(w / 2.2));
      for (let k = 0; k < n; k++) {
        const wx = x0 + (k + 0.5) * (w / n);
        Pt.box(0.9, 1.1, 0.06, wx, y + s * 3 + 0.9, zNear - side * 0.03, 0x1a1c1e);
        Pt.box(1.06, 0.08, 0.1, wx, y + s * 3 + 2.02, zNear - side * 0.05, 0xe8e2d6);
        for (let b = -1; b <= 1; b++) Pt.box(0.03, 1.1, 0.04, wx + b * 0.28, y + s * 3 + 0.9, zNear - side * 0.07, 0x3a5a6a);
      }
      if (s >= 1 && rnd() < 0.5) {
        Pt.box(w - 0.4, 0.12, 0.9, xm, y + s * 3, zNear - side * 0.45, 0xd8d2c6);
        Pt.box(w - 0.4, 0.9, 0.04, xm, y + s * 3 + 0.12, zNear - side * 0.88, 0x4a6a5a);
      }
    }
    // the roof: Mangalore tiles (hipped) or a flat slab with a water tank
    const top = y + H;
    if (rnd() < 0.88) {
      const d = zb - za;
      const ridge = Math.min(w, d) * 0.32;
      const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, ridge, 4, 1);
      roof.rotateY(Math.PI / 4);
      roof.scale(w / Math.hypot(w, d) * 1.414 * 1.08, 1, d / Math.hypot(w, d) * 1.414 * 1.08);
      B.place(K.roofTile, roof, xm, top + ridge / 2, (za + zb) / 2);
    } else {
      B.span(K.stone, x0 - 0.1, top, za - 0.1, x1 + 0.1, top + 0.15, zb + 0.1);
      B.span(pm, x0, top + 0.15, za, x1, top + 0.9, za + 0.15);
      if (rnd() < 0.6) Pt.box(1.1, 1.2, 1.1, x0 + 1.2, top + 0.15, (za + zb) / 2, 0x1a1a1a);
    }
    P.solid(x0, y - 2, za, x1, y + H + 1, zb);
  };

  // shops along the stair (skipping the lowest flights, which run in a walled cutting)
  for (let x = STAIR.x0 + FLIGHT_LEN * 2; x + SHOP_W <= STAIR_TOP_X - 0.5; x += SHOP_W) {
    const y = stairY(x + SHOP_W / 2) + 0.35;
    // west side (−z): street face at zA − 0.35
    house(x, x + SHOP_W - 0.04, zA - 0.35, zA - 0.35 - 4.6, y, 2 + (rnd() < 0.3 ? 1 : 0), -1, true);
    house(x, x + SHOP_W - 0.04, zB + 0.35, zB + 0.35 + 4.6, y, 2 + (rnd() < 0.3 ? 1 : 0), 1, true);
  }
  // the walled cutting of the lowest flights
  for (const [za, zb] of [[zA - 0.8, zA - 0.35], [zB + 0.35, zB + 0.8]]) {
    B.span(K.rampart, COURT.x1, -0.3, za, STAIR.x0 + FLIGHT_LEN * 2 + 0.1, RIM.n + 0.8, zb);
  }
  // houses on the rim above the north wall of the courtyard, and on the slopes behind the shops
  for (let z = -14; z < 19; z += 6.5 + rnd() * 2) {
    const w = 5.5 + rnd() * 1.5;
    house(COURT.x1 + 1.5, COURT.x1 + 1.5 + 6.5, z + w, z, RIM.n, 2 + Math.floor(rnd() * 2), -1, false);
  }
  for (let i = 0; i < 46; i++) {
    const sideE = rnd() < 0.55;
    const x = STAIR.x0 + 18 + rnd() * (STAIR_TOP_X - STAIR.x0 - 16);
    const z = sideE ? zB + 7 + rnd() * 26 : zA - 7 - rnd() * 18;
    const w = 5 + rnd() * 4, d = 6 + rnd() * 3;
    const y = terrainH(x + w / 2, z + d / 2);
    house(x, x + w, z, sideE ? z + d : z - d, y, 1 + Math.floor(rnd() * 3), sideE ? 1 : -1, false);
  }
  // around the plaza: hotels and shops facing the road-head
  for (let x = PLAZA.x0 + 2; x < PLAZA.x1 - 4; x += 6.2) {
    house(x, x + 6, PLAZA.z0 + 0.1, PLAZA.z0 - 6, STAIR_TOP_Y, 2 + Math.floor(rnd() * 2), -1, true);
    house(x, x + 6, PLAZA.z1 - 0.1, PLAZA.z1 + 6, STAIR_TOP_Y, 2 + Math.floor(rnd() * 2), 1, true);
  }

  // ---------- the steel arch over the head of the stairs ----------
  {
    const ax = STAIR_TOP_X + 1.2;
    const span = zB - zA + 2.4, H = 5.4, rise = 1.2;
    for (const z of [zA - 1.2, zB + 1.2]) {
      B.span(K.steel, ax - 0.09, STAIR_TOP_Y, z - 0.09, ax + 0.09, STAIR_TOP_Y + H, z + 0.09);
      P.solid(ax - 0.15, STAIR_TOP_Y, z - 0.15, ax + 0.15, STAIR_TOP_Y + H, z + 0.15);
    }
    const N = 40, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = zA - 1.2 + span * t;
      const y = STAIR_TOP_Y + H - 0.3 + Math.sin(t * Math.PI) * rise;
      pos.push(ax, y - 0.95, z, ax, y + 0.05, z);
      uv.push(1 - t, 0, 1 - t, 1);
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ag.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    ag.setIndex(idx);
    ag.computeVertexNormals();
    const amat = new THREE.MeshStandardMaterial({ map: archText(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x8a8278, metalness: 0.75, roughness: 0.45 });
    const arch = new THREE.Mesh(ag, amat);
    // cast letters have thickness: a second plate 6 cm behind
    const arch2 = new THREE.Mesh(ag, amat);
    arch2.position.x = 0.06;
    arch2.castShadow = true;
    g.add(arch2);
    arch.castShadow = true;
    g.add(arch);
    // the steel tube of the arch above the letters
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return new THREE.Vector3(ax, STAIR_TOP_Y + H - 0.25 + Math.sin(t * Math.PI) * rise + 0.12, zA - 1.2 + span * t);
    }));
    B.add(K.steel, new THREE.TubeGeometry(curve, 30, 0.06, 6, false));
    const f1 = new Flag(g, K.steel, K.saffron, ax, STAIR_TOP_Y + H + rise - 0.2, zm - 1, 2.0);
    f1.mesh.scale.setScalar(0.55);
    flags.push(f1);
    const f2 = new Flag(g, K.steel, K.saffron, ax, STAIR_TOP_Y + H + 0.3, zA - 1.2, 2.4);
    f2.mesh.scale.setScalar(0.5);
    flags.push(f2);
    // saffron flags all along the top of the arch, tied to its tube
    for (const t of [0.12, 0.3, 0.7, 0.88]) {
      const z = zA - 1.2 + span * t, y = STAIR_TOP_Y + H - 0.13 + Math.sin(t * Math.PI) * rise;
      const f = new Flag(g, K.steel, K.saffron, ax, y, z, 1.5 + (t * 7 % 1) * 0.6);
      f.mesh.scale.setScalar(0.45);
      flags.push(f);
    }
    const f3 = new Flag(g, K.steel, K.saffron, ax, STAIR_TOP_Y + H + 0.3, zB + 1.2, 2.2);
    f3.mesh.scale.setScalar(0.5);
    flags.push(f3);
  }

  // ---------- the market at the road-head: tarp-roofed stalls on both sides of the way to the arch ----------
  {
    const tarps = [K.tarpBlue, K.tarpOrange, K.tarpBlue, K.tarpBlue];
    const tarpMat = (i: number) => tarps[i % tarps.length];
    for (let x = STAIR_TOP_X + 3.2; x < STAIR_TOP_X + 24; x += 2.9) {
      for (const sd of [-1, 1]) {
        const zf = zm + sd * 3.6, zb2 = zm + sd * 6.2; // front edge (toward the path) and back
        const y = STAIR_TOP_Y, i = Math.round(x * 3 + sd);
        // four bamboo poles, front taller so the tarp slopes back
        for (const [px, pz, h] of [[x - 1.3, zf, 2.6], [x + 1.3, zf, 2.6], [x - 1.3, zb2, 2.1], [x + 1.3, zb2, 2.1]] as const) {
          B.span(K.wood, px - 0.04, y, pz - 0.04, px + 0.04, y + h, pz + 0.04);
        }
        const tg = new THREE.PlaneGeometry(2.9, Math.hypot(zb2 - zf, 0.5) + 0.5, 8, 5);
        const p = tg.attributes.position;
        // the tarp sags between its poles (deepest mid-span), with a few wrinkles
        for (let k = 0; k < p.count; k++) {
          const u = p.getX(k) / 1.45, v = p.getY(k) / 1.6;
          p.setZ(k, -0.22 * (1 - u * u) * (1 - 0.5 * v * v) + Math.sin(p.getX(k) * 4.1 + i) * 0.025);
        }
        tg.computeVertexNormals();
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 2.2, (zf + zb2) / 2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 - sd * 0.19, 0, 0)), new THREE.Vector3(1, 1, 1));
        B.add(tarpMat(i), tg, m);
        // a counter of planks with goods, baskets of flowers, hanging strings of rudraksha and garlands
        const cz2 = zf + sd * 0.55;
        B.span(K.wood, x - 1.2, y, cz2 - 0.35, x + 1.2, y + 0.8, cz2 + 0.35, true);
        basket(x - 0.8, y + 0.8, cz2);
        tray(x - 0.25, y + 0.8, cz2 - sd * 0.1);
        basket(x + 0.3, y + 0.8, cz2, 0.9);
        basket(x + 0.85, y + 0.8, cz2 + sd * 0.05, 0.8, false); basket(x + 0.85, y + 0.9, cz2 + sd * 0.05, 0.8, false); basket(x + 0.85, y + 1.0, cz2 + sd * 0.05, 0.8);
        for (let k = 0; k < 3; k++) picture(x - 0.8 + k * 0.75, y + 0.8, cz2 + sd * 0.3, sd > 0 ? Math.PI : 0, 0.28, 0.36);
        O.strand(new THREE.Vector3(x - 1.2, y + 2.3, zf), new THREE.Vector3(x + 1.2, y + 2.3, zf), 0.3, 0.8);
        for (let k = 0; k < 4; k++) strings(x - 0.9 + k * 0.6, y + 2.25, zf + sd * 0.05);
        P.solid(x - 1.35, y, Math.min(zf, zb2) - 0.05, x + 1.35, y + 2.6, Math.max(zf, zb2) + 0.05);
      }
    }
  }

  // an MSRTC "lal pari" bus waiting at the stand (red body, cream band, dark windows)
  {
    const bx = PLAZA.x0 + 9, bz = PLAZA.z0 + 7, by = STAIR_TOP_Y;
    Pt.box(10.8, 0.5, 2.5, bx, by + 0.45, bz, 0x2a2a2a);
    Pt.box(11, 1.1, 2.55, bx, by + 0.85, bz, 0xb8141e);
    Pt.box(11, 0.18, 2.57, bx, by + 1.95, bz, 0xe8dcc0);
    Pt.box(10.6, 0.85, 2.52, bx, by + 2.12, bz, 0x1a2228);
    for (let k = -4; k <= 4; k++) Pt.box(0.08, 0.86, 2.56, bx + k * 1.15, by + 2.12, bz, 0xb8141e);
    Pt.box(11, 0.3, 2.55, bx, by + 2.97, bz, 0xb8141e);
    Pt.box(10.6, 0.12, 2.3, bx, by + 3.27, bz, 0xd8d0c0);
    Pt.box(0.06, 1.0, 2.2, bx - 5.52, by + 2.0, bz, 0x223038);
    Pt.box(0.06, 0.28, 1.4, bx - 5.53, by + 2.66, bz, 0xffb020);
    for (const wx of [-3.6, 3.4]) for (const wz of [-1.18, 1.18]) {
      const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14).rotateX(Math.PI / 2);
      B.add(K.iron, wg, new THREE.Matrix4().makeTranslation(bx + wx, by + 0.5, bz + wz));
    }
    P.solid(bx - 5.6, by, bz - 1.3, bx + 5.6, by + 3.4, bz + 1.3);
  }
  // a big old mango tree shading the plaza (trunk + crown in the forest style is added by the forest pass);
  // here its stone platform (par)
  B.span(K.stone, PLAZA.x0 + 16, STAIR_TOP_Y, -42, PLAZA.x0 + 20, STAIR_TOP_Y + 0.5, -38, true);

  B.flush(g);
  Pt.flush(g, K.paint);
  const sm = new THREE.Mesh(mergeGeometries(signs, false)!, signMat);
  g.add(sm);
  return { flags };
}

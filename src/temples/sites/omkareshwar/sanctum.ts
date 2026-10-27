import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics, Flames } from '../../engine/kit';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import { GARBHA, LINGA, F1 } from './layout';
import { stoneGeometry, roseGeometry, heightToNormal } from './linga';

/**
 * The garbhagriha of Shri Omkareshwar, as the darshan videos show it (tour videos 2023-2025: 3jCMV-1YFjQ,
 * oWdeNHYmkIo, ab7LDybhgrA):
 *  - a small low chamber clad in polished grey speckled granite, a band of old carved red-brown reliefs round
 *    the walls at about chest height, a flat steel false ceiling with LED tubes, a silver chhatra hung above;
 *  - the Jyotirlinga is swayambhu: a small natural dark rock (~0.3 m across, ~0.18 m high) with no pitha,
 *    sitting front-left in a rectangular pit sunk into the floor, hemmed by two tiers of stepped granite
 *    ledges on the left, back and right; a brass spout from the back ledge pours a steady stream on it;
 *  - devotees stand on the near side and lean over a silver parapet embossed with rosettes, with a glass screen
 *    in a steel frame above it; they pour water through a chute in the screen;
 *  - across the pit: a silver panel lettered "श्री ॐकारेश्वर ज्योतिर्लिंग मंदिर", a shelf with lamps, and below
 *    it Parvati in a silver-framed niche; brass lidded boxes and coconuts on the ledges; pujaris sit on the right.
 * Axes as the rest of the site: the devotee faces +x (east) from the door, so left = -z, right = +z.
 */

let seedO = 5;
const rnd = () => ((seedO = (seedO * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- offerings (instanced)

function ruffled(r: number, detail: number, amp: number, flatten: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), b = Math.atan2(v.y, Math.hypot(v.x, v.z));
    v.multiplyScalar(1 + amp * Math.sin(a * 9 + seed) * Math.sin(b * 7 + seed * 0.7));
    v.y *= flatten;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Bel (bilva) leaf: three leaflets, the middle one longest, flat in XZ, slightly cupped. */
function belGeo(len: number) {
  const leaflet = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w, l * 0.45, 0, l);
    s.quadraticCurveTo(-w, l * 0.45, 0, 0);
    const g = new THREE.ShapeGeometry(s, 6);
    g.deleteAttribute('uv');
    return g;
  };
  const g = mergeGeometries([leaflet(len, len * 0.42), leaflet(len * 0.78, len * 0.36).rotateZ(1.05), leaflet(len * 0.78, len * 0.36).rotateZ(-1.05)], false)!;
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.2);
  g.computeVertexNormals();
  return g;
}

type Kind = 'marigold' | 'rose' | 'bel' | 'petal' | 'mogra' | 'datura';
const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00, 0xff7b00];
const PETAL = [0xff8a00, 0xffb300, 0xd81b3b, 0xffffff, 0xff6f00, 0xe0406a];

export class Offerings {
  private items = new Map<Kind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  add(kind: Kind, x: number, y: number, z: number, scale = 1, color?: number, ry = rnd() * Math.PI * 2, tilt = 0) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * (rnd() - 0.5), ry, tilt * (rnd() - 0.5)));
    const s = scale * (0.85 + rnd() * 0.3);
    it.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    const pick = color ?? (kind === 'marigold' ? MARIGOLD[Math.floor(rnd() * MARIGOLD.length)]
      : kind === 'rose' ? (rnd() < 0.8 ? 0xb3121f : 0xe0406a)
        : kind === 'bel' ? (rnd() < 0.6 ? 0x4f7d24 : rnd() < 0.5 ? 0x6c9030 : 0x3d6a1c)
          : kind === 'petal' ? PETAL[Math.floor(rnd() * PETAL.length)]
            : 0xfbf8ee);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }
  ring(cx: number, y: number, cz: number, rx: number, rz: number, scale = 1) {
    const n = Math.max(8, Math.round((Math.PI * (rx + rz)) / (0.05 * scale)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
      if (i % 4 === 3) this.add('mogra', x, y, z, scale * 0.8);
      else this.add('marigold', x, y, z, scale);
    }
  }
  strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, scale = 1) {
    const n = Math.max(4, Math.round((a.distanceTo(b) + sag) / (0.05 * scale)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (i % 5 === 4) this.add('mogra', p.x, p.y, p.z, scale * 0.8);
      else this.add('marigold', p.x, p.y, p.z, scale * 0.9);
    }
  }
  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, belShare = 0.25, keep?: (x: number, z: number) => boolean) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (keep && !keep(x, z)) continue;
      if (rnd() < belShare) this.add('bel', x, y + 0.004, z, 0.9, undefined, rnd() * 6.3, 0.3);
      else this.add('petal', x, y + 0.002, z, 1, undefined, rnd() * 6.3, 0.4);
    }
  }
  flush(parent: THREE.Object3D) {
    const geos: Record<Kind, THREE.BufferGeometry> = {
      marigold: ruffled(0.03, 1, 0.26, 0.7, 1),
      rose: ruffled(0.028, 1, 0.12, 0.8, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 6).rotateX(-Math.PI / 2),
      mogra: ruffled(0.022, 1, 0.22, 0.85, 7),
      // white datura trumpet
      datura: new THREE.ConeGeometry(0.03, 0.09, 8, 1, true).rotateZ(Math.PI / 2),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.75 }),
      bel: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.6, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
      datura: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x161614 }),
    };
    for (const [kind, it] of this.items) {
      const im = new THREE.InstancedMesh(geos[kind], mats[kind], it.m.length);
      it.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, it.c[i]); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
  }
}

// ---------------------------------------------------------------- textures

/** a canvas texture, sRGB, repeating */
function canvasTex(c: HTMLCanvasElement, wrap = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Polished salt-and-pepper grey granite slabs, 1.2 × 0.6 m (one texture repeat = one slab). */
function graniteTexture() {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let sd = 3;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#a7a8a2';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 9000; k++) {
    const v = r();
    g.fillStyle = v < 0.45 ? `rgba(30,30,32,${0.35 + r() * 0.4})` : v < 0.8 ? `rgba(235,235,230,${0.3 + r() * 0.4})` : `rgba(120,112,108,${0.4})`;
    const s = 1 + r() * 2.6;
    g.fillRect(r() * W, r() * H, s, s * (0.6 + r() * 0.8));
  }
  // the joint round the slab
  g.strokeStyle = 'rgba(60,60,60,0.8)'; g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
  return canvasTex(c);
}

/** The silver panel over the Parvati niche: raised Devanagari, a beaded border, soot in the recesses. */
function inscriptionTexture() {
  const W = 1024, H = 384, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#8e8d86'); grd.addColorStop(0.5, '#a8a79f'); grd.addColorStop(1, '#7a7972');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d6d5cc';
  for (let x = 14; x < W; x += 22) { g.beginPath(); g.arc(x, 14, 6, 0, 7); g.arc(x, H - 14, 6, 0, 7); g.fill(); }
  for (let y = 36; y < H - 20; y += 22) { g.beginPath(); g.arc(14, y, 6, 0, 7); g.arc(W - 14, y, 6, 0, 7); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const line = (t: string, y: number, px: number) => {
    g.font = `bold ${px}px "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif`;
    g.fillStyle = 'rgba(40,40,38,0.85)'; g.fillText(t, W / 2 + 4, y + 4); // soot in the shadow of the letters
    g.fillStyle = '#e4e3da'; g.fillText(t, W / 2, y);
  };
  line('श्री ॐकारेश्वर ज्योतिर्लिंग', H * 0.38, 118);
  line('मंदिर', H * 0.74, 104);
  return canvasTex(c, false);
}

/**
 * One leaf of the sanctum door: wood clad in embossed silver - a scrolling border, two stacked panels with a
 * standing figure each (the lower one under a cusped arch). Returns colour + normal maps.
 */
function doorLeafMaps() {
  const W = 256, H = 960, c = document.createElement('canvas'), h = document.createElement('canvas');
  c.width = h.width = W; c.height = h.height = H;
  const g = c.getContext('2d')!, k = h.getContext('2d')!;
  g.fillStyle = '#b8b8b4'; g.fillRect(0, 0, W, H);
  k.fillStyle = '#404040'; k.fillRect(0, 0, W, H);
  const both = (f: (x: CanvasRenderingContext2D, hi: boolean) => void) => { f(g, false); f(k, true); };
  // scrolling border: a running vine of loops
  both((x, hi) => {
    x.strokeStyle = hi ? '#d0d0d0' : '#9a9a96'; x.lineWidth = 6;
    for (const [x0, y0, x1, y1] of [[14, 14, 14, H - 14], [W - 14, 14, W - 14, H - 14]]) {
      for (let y = y0; y < y1; y += 28) { x.beginPath(); x.arc(x0, y + 14, 10, 0, Math.PI * 2); x.stroke(); }
      void x1;
    }
    for (let xx = 14; xx < W - 14; xx += 28) for (const y of [14, H - 14, H / 2]) { x.beginPath(); x.arc(xx + 14, y, 10, 0, Math.PI * 2); x.stroke(); }
  });
  // two panels with a figure in low relief
  for (const [y0, y1, arch] of [[44, H / 2 - 30, false], [H / 2 + 30, H - 44, true]] as const) {
    both((x, hi) => {
      x.fillStyle = hi ? '#202020' : '#6a6a66'; x.fillRect(40, y0, W - 80, y1 - y0); // recessed field (tarnished)
      x.strokeStyle = hi ? '#c8c8c8' : '#c6c6c0'; x.lineWidth = 8; x.strokeRect(40, y0, W - 80, y1 - y0);
      const cx = W / 2, top = y0 + (arch ? 90 : 50);
      if (arch) { x.lineWidth = 7; x.beginPath(); for (let i = 0; i < 5; i++) x.arc(60 + i * 34, y0 + 70, 18, Math.PI, 0); x.stroke(); }
      x.fillStyle = hi ? '#e0e0e0' : '#cfcfc9';
      x.beginPath(); x.ellipse(cx, top + 26, 22, 26, 0, 0, Math.PI * 2); x.fill(); // head
      x.beginPath(); x.moveTo(cx - 40, top + 60); x.lineTo(cx + 40, top + 60); x.lineTo(cx + 30, y1 - 30); x.lineTo(cx - 30, y1 - 30); x.fill(); // body
      x.fillRect(cx - 62, top + 66, 20, 120); x.fillRect(cx + 42, top + 66, 20, 120); // arms
    });
  }
  const map = canvasTex(c, false);
  const normal = heightToNormal(h, 3, false);
  return { map, normal };
}

/** A vertical plane facing `dir` whose UVs are in metres (so tiled maps keep their real size). */
function wallPlane(w: number, h: number, dir: 'px' | 'nx' | 'pz' | 'nz') {
  const p = new THREE.PlaneGeometry(w, h);
  const uv = p.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  if (dir === 'px') p.rotateY(Math.PI / 2);
  else if (dir === 'nx') p.rotateY(-Math.PI / 2);
  else if (dir === 'nz') p.rotateY(Math.PI);
  return p;
}

export function buildSanctum(root: THREE.Group, K: OM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'garbhagriha';
  root.add(g);
  const B = new Batch();
  const O = new Offerings();
  const { x0, x1, z0, z1, floor: fy, ceil, doorZ, doorHW } = GARBHA;
  const T = 0.6;
  const wallTop = F1;
  const L = LINGA;

  // materials of the chamber
  const gt = graniteTexture();
  gt.repeat.set(1 / 1.2, 1 / 0.6);
  const granite = new THREE.MeshPhysicalMaterial({ map: gt, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.12, envMap: K.neutralEnv, envMapIntensity: 0.45 });
  const graniteWet = new THREE.MeshPhysicalMaterial({ map: gt, color: 0x8a8c88, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMap: K.neutralEnv, envMapIntensity: 0.6 });
  const falseCeil = new THREE.MeshStandardMaterial({ color: 0x9a9c9c, metalness: 0.6, roughness: 0.45, envMap: K.neutralEnv, envMapIntensity: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, envMap: K.neutralEnv, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const coconut = new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.95 });
  const stream = new THREE.MeshPhysicalMaterial({ color: 0xe8f0f2, roughness: 0.05, transparent: true, opacity: 0.55, envMap: K.neutralEnv, envMapIntensity: 1.5, depthWrite: false });

  // ---------- chamber walls, ceiling, floor ----------
  // west wall with the door
  B.span(K.darkStone, x0 - T, x0, 0, wallTop, z0 - T, doorZ - doorHW);
  B.span(K.darkStone, x0 - T, x0, 0, wallTop, doorZ + doorHW, z1 + T);
  B.span(K.darkStone, x0 - T, x0, 2.1, wallTop, doorZ - doorHW, doorZ + doorHW);
  P.solid(x0 - T, 0, z0 - T, x0, 4, doorZ - doorHW);
  P.solid(x0 - T, 0, doorZ + doorHW, x0, 4, z1 + T);
  B.span(K.darkStone, x1, x1 + T, fy, wallTop, z0 - T, z1 + T);
  B.span(K.darkStone, x0, x1, fy, wallTop, z0 - T, z0);
  B.span(K.darkStone, x0, x1, fy, wallTop, z1, z1 + T);
  P.solid(x1, fy, z0 - T, x1 + T, 4, z1 + T);
  P.solid(x0, fy, z0 - T, x1, 4, z0);
  P.solid(x0, fy, z1, x1, 4, z1 + T);
  // the steel false ceiling, and the stone above it
  B.span(falseCeil, x0, x1, ceil, ceil + 0.06, z0, z1);
  B.span(K.darkStone, x0 - T, x1 + T, ceil + 0.06, wallTop, z0 - T, z1 + T);
  // granite cladding on the four inner faces (slab-sized texture: metre UVs)
  const H = ceil - fy;
  const clad = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => { geo.translate(x, y, z); B.add(granite, geo); };
  clad(wallPlane(z1 - z0, H, 'nx'), x1 - 0.004, fy + H / 2, (z0 + z1) / 2);
  clad(wallPlane(x1 - x0, H, 'pz'), (x0 + x1) / 2, fy + H / 2, z0 + 0.004);
  clad(wallPlane(x1 - x0, H, 'nz'), (x0 + x1) / 2, fy + H / 2, z1 - 0.004);
  {
    const a = doorZ - doorHW - z0, b = z1 - (doorZ + doorHW);
    clad(wallPlane(a, H, 'px'), x0 + 0.004, fy + H / 2, z0 + a / 2);
    clad(wallPlane(b, H, 'px'), x0 + 0.004, fy + H / 2, z1 - b / 2);
    clad(wallPlane(2 * doorHW, ceil - 2.1, 'px'), x0 + 0.004, (2.1 + ceil) / 2, doorZ);
  }
  // floor: two steps down from the threshold, then the chamber floor of the same granite
  B.span(K.ledge, x0 - T, x0, -0.5, 0.0, doorZ - doorHW, doorZ + doorHW);
  B.span(granite, x0, x0 + 0.38, -0.5, -0.22, doorZ - doorHW - 0.2, doorZ + doorHW + 0.2);
  B.prism(granite, [[x0, z0], [11.45, z0], [11.45, z1], [x0, z1]], -0.7, fy); // (the pit side is built up from its ledges below)
  P.floor(g, x0 - T - 0.05, x0, doorZ - doorHW, doorZ + doorHW, 0.0);
  P.floor(g, x0, x0 + 0.38, doorZ - doorHW - 0.2, doorZ + doorHW + 0.2, -0.22);

  // ---------- the band of old carved red-brown reliefs round the walls, on a granite shelf ----------
  {
    const y0 = fy + 1.0, y1 = fy + 1.45, d = 0.06;
    const band = (geo: THREE.BufferGeometry, x: number, z: number) => { geo.translate(x, (y0 + y1) / 2, z); B.add(K.frieze, geo); };
    band(wallPlane(x1 - x0, y1 - y0, 'pz'), (x0 + x1) / 2, z0 + d);
    band(wallPlane(x1 - x0, y1 - y0, 'nz'), (x0 + x1) / 2, z1 - d);
    B.span(granite, x0, x1, y0 - 0.06, y0, z0, z0 + 0.16);
    B.span(granite, x0, x1, y0 - 0.06, y0, z1 - 0.16, z1);
    // a few marigolds tucked on the shelf
    for (let i = 0; i < 26; i++) {
      const xx = x0 + 0.3 + rnd() * (x1 - x0 - 0.6), side = rnd() < 0.5;
      O.add(rnd() < 0.75 ? 'marigold' : 'rose', xx, y0 + 0.02, side ? z0 + 0.09 : z1 - 0.09, 0.9);
    }
  }

  // ---------- the pit (jaladhari kund) and its stepped ledges ----------
  // the near (west) side is the silver parapet; ledges in two tiers on the left (north), back (east) and right (south)
  const PX0 = 11.68, PX1 = 12.78, PZ0 = -7.45, PZ1 = -6.05; // pit floor: 1.1 m front-to-back × 1.4 m across
  const pitY = fy - 0.04;
  const T1 = fy + 0.17, T2 = fy + 0.36, LW = 0.22; // tier tops and tread width
  const FX = 11.45; // the devotees' side: the parapet's front face (a rail at ~0.9 m: the stone shows over it)
  B.span(K.blackStone, PX0, PX1, -0.7, pitY, PZ0, PZ1);
  // tier 1 (just round the pit)
  B.span(graniteWet, PX0, PX1 + LW, -0.7, T1, PZ0 - LW, PZ0);
  B.span(graniteWet, PX1, PX1 + LW, -0.7, T1, PZ0, PZ1);
  B.span(graniteWet, PX0, PX1 + LW, -0.7, T1, PZ1, PZ1 + LW);
  // tier 2: the back ledge, the broad left platform (coconuts, a brass box), the right platform where pujaris sit
  B.span(granite, PX1 + LW, x1, -0.7, T2, PZ0 - LW, PZ1 + LW);
  B.span(granite, FX, x1, -0.7, T2, z0, PZ0 - LW);
  B.span(granite, FX, x1, -0.7, T2, PZ1 + LW, z1);
  // the near corners of tier 1 meet the parapet
  B.span(graniteWet, FX, PX0, -0.7, T1, PZ0 - LW, PZ0);
  B.span(graniteWet, FX, PX0, -0.7, T1, PZ1, PZ1 + LW);
  // silver edge strips on the upper tier's inner edges
  B.span(K.silver, PX1 + LW - 0.02, PX1 + LW + 0.02, T2, T2 + 0.012, PZ0 - LW, PZ1 + LW);
  B.span(K.silver, FX, PX1 + LW, T2, T2 + 0.012, PZ0 - LW - 0.02, PZ0 - LW + 0.02);
  B.span(K.silver, FX, PX1 + LW, T2, T2 + 0.012, PZ1 + LW - 0.02, PZ1 + LW + 0.02);
  // standing water in the pit, a wet sheen
  {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(PX1 - PX0, PZ1 - PZ0).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({
      color: 0x1c1e1e, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.55, envMap: K.neutralEnv, envMapIntensity: 0.7, depthWrite: false,
    }));
    w.position.set((PX0 + PX1) / 2, pitY + 0.012, (PZ0 + PZ1) / 2);
    g.add(w);
  }

  // ---------- the Jyotirlinga in its shringar (photograph of the decorated linga) ----------
  // The natural stone (still there beneath) is dressed in sandal paste with the Lord's face, a red tripundra and a
  // red ॐ, crowned with roses, ringed with purple and white flowers inside a beaded silver ring; a silver naga rises
  // behind it and spreads its hood over it, a marigold-and-rose garland arches behind, two small silver trishuls
  // stand either side, and the pit is a bed of white flowers patterned with magenta rose petals.
  const SH = 0.18;
  // the pit heaped with flowers: the dressed linga sits up on them, above the rail's sight line (photograph)
  const bed = T1 - 0.01; // (level with the first ledge)
  B.span(new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.9 }), PX0, PX1, pitY, bed - 0.005, PZ0, PZ1);
  const stone = new THREE.Mesh(stoneGeometry({ rx: 0.15, rz: 0.13, h: SH, taper: 0.3, base: 0x1e1e1e, light: 0x4a504c, smears: 0, seed: 2.3 }), K.rockLingam);
  stone.position.set(L.x, pitY, L.z);
  stone.rotation.y = 0.4;
  g.add(stone);
  const DH = 0.32; // the dressed mound's height
  const topY = bed + DH;
  {
    // the sandal-paste dome with the face towards the devotees (-x)
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x2 = c.getContext('2d')!;
    const grd = x2.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#d9bf5a'); grd.addColorStop(1, '#b89a3a');
    x2.fillStyle = grd; x2.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 400; i++) { x2.fillStyle = `rgba(${120 + rnd() * 60},${110 + rnd() * 50},40,0.25)`; x2.fillRect(rnd() * 256, rnd() * 128, 2 + rnd() * 5, 1 + rnd() * 3); }
    // face centred at u = 0.5 (the sphere's -x side after the turn below): eyes, tripundra, the third-eye mark
    x2.fillStyle = '#f4efe2';
    for (const ex of [112, 144]) { x2.beginPath(); x2.ellipse(ex, 58, 9, 5, 0, 0, Math.PI * 2); x2.fill(); }
    x2.fillStyle = '#1a1410';
    for (const ex of [112, 144]) { x2.beginPath(); x2.arc(ex, 58, 3, 0, Math.PI * 2); x2.fill(); }
    x2.fillStyle = '#e8e0d0';
    for (const y of [32, 38, 44]) x2.fillRect(102, y, 52, 3);
    x2.fillStyle = '#c8202a';
    x2.fillRect(125, 28, 6, 20);
    x2.beginPath(); x2.ellipse(128, 74, 10, 4, 0, 0, Math.PI * 2); x2.fill(); // the mouth
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    dome.scale.set(0.16, DH, 0.15);
    dome.rotation.y = Math.PI / 2; // u = 0.5 to -x
    dome.position.set(L.x, bed, L.z);
    g.add(dome);
    // a red ॐ of flowers on its brow, facing the rail
    const oc = document.createElement('canvas');
    oc.width = oc.height = 128;
    const o2 = oc.getContext('2d')!;
    o2.fillStyle = '#b8101e'; o2.font = 'bold 104px "Noto Sans Devanagari", sans-serif'; o2.textAlign = 'center'; o2.textBaseline = 'middle';
    o2.fillText('ॐ', 64, 70);
    const otex = new THREE.CanvasTexture(oc);
    otex.colorSpace = THREE.SRGBColorSpace;
    const om = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: otex, transparent: true, alphaTest: 0.3, roughness: 0.6, side: THREE.DoubleSide }));
    om.rotation.y = -Math.PI / 2;
    om.rotation.z = 0.25;
    om.position.set(L.x - 0.1, topY - 0.08, L.z);
    g.add(om);
  }
  {
    // roses crowning it
    const rg = roseGeometry();
    for (const [dx, dz, sc, col] of [[0, 0, 1.5, 0xb8101e], [0.04, 0.05, 1.1, 0xc8102e], [0.03, -0.05, 1.1, 0xa80c1a], [-0.04, 0.02, 0.9, 0xd81e3b]] as const) {
      const rose = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, side: THREE.DoubleSide }));
      rose.position.set(L.x + dx, topY - 0.01, L.z + dz);
      rose.rotation.set(dz * 6, rnd() * 6, -dx * 6);
      rose.scale.setScalar(sc);
      g.add(rose);
    }
  }
  // purple and white flower rings round the dome's foot, then the beaded silver ring
  for (const [rr, kind, col] of [[0.175, 'petal', 0x7a3a9a], [0.2, 'mogra', undefined], [0.215, 'petal', 0x8e4aa8]] as const) {
    const n = Math.round((Math.PI * 2 * rr) / 0.022);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      O.add(kind, L.x + Math.cos(a) * rr, bed + 0.02 + (kind === 'mogra' ? 0.01 : 0), L.z + Math.sin(a) * rr * 0.92, kind === 'mogra' ? 0.8 : 1.2, col, rnd() * 6.3, 0.3);
    }
  }
  // the lower mound wrapped in rings of purple flowers, a white band between (photograph)
  for (const [h, rr, col] of [[0.03, 0.16, 0x7a3a9a], [0.07, 0.155, 0x8e4aa8], [0.1, 0.15, 0xf4f0e6], [0.13, 0.142, 0x7a3a9a]] as const) {
    const n = Math.round((Math.PI * 2 * rr) / 0.02);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      O.add(col === 0xf4f0e6 ? 'mogra' : 'petal', L.x + Math.cos(a) * rr, bed + h, L.z + Math.sin(a) * rr * 0.94, 1.1, col === 0xf4f0e6 ? undefined : col, rnd() * 6.3, 0.5);
    }
  }
  B.add(K.silverRep, new THREE.TorusGeometry(0.255, 0.022, 10, 48).rotateX(Math.PI / 2).scale(1, 1, 0.92).translate(L.x, bed + 0.025, L.z));
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    B.add(K.silverRep, new THREE.SphereGeometry(0.011, 6, 4).translate(L.x + Math.cos(a) * 0.255, bed + 0.05, L.z + Math.sin(a) * 0.255 * 0.92));
  }
  {
    // the silver naga: its body rising from behind the linga, the hood spread over it, facing the devotees
    const by = pitY, bx = L.x + 0.28;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, by, L.z), new THREE.Vector3(bx + 0.01, by + 0.3, L.z), new THREE.Vector3(bx - 0.01, by + 0.6, L.z),
      new THREE.Vector3(bx - 0.05, by + 0.76, L.z), new THREE.Vector3(bx - 0.11, by + 0.82, L.z),
    ]);
    const body = new THREE.TubeGeometry(curve, 40, 0.024, 10);
    // banded belly scales: rings along the body
    const bands: THREE.BufferGeometry[] = [];
    for (let i = 1; i < 18; i++) {
      const t = i / 18, p2 = curve.getPointAt(t), tan = curve.getTangentAt(t);
      bands.push(new THREE.TorusGeometry(0.025, 0.004, 4, 12).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)).translate(p2.x, p2.y, p2.z));
    }
    B.add(K.naga, body);
    for (const b of bands) B.add(K.naga, b);
    // the hood: a broad, slightly cupped spoon leaning forward over the dome
    const hood = new THREE.SphereGeometry(1, 24, 16);
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      hp.setXYZ(i, x * 0.035 - Math.abs(z) * 0.03, y * 0.15 + (y < 0 ? y * 0.04 : 0), z * (0.15 - Math.max(0, -y) * 0.06));
    }
    hood.computeVertexNormals();
    hood.rotateZ(-0.35).translate(bx - 0.14, by + 0.79, L.z);
    B.add(K.naga, hood);
    // the head at the hood's top, eyes of red stone
    B.add(K.naga, new THREE.SphereGeometry(1, 12, 8).scale(0.05, 0.03, 0.04).translate(bx - 0.18, by + 0.93, L.z));
    for (const dz of [-0.018, 0.018]) B.add(K.kumkum, new THREE.SphereGeometry(0.007, 6, 4).translate(bx - 0.225, by + 0.94, L.z + dz));
    // a rose and leaves at the hood's crown (photograph)
    O.add('rose', bx - 0.16, by + 0.97, L.z, 1.2);
    for (const dz of [-0.06, 0.06]) O.add('bel', bx - 0.13, by + 0.95, L.z + dz, 1.1, undefined, rnd() * 6.3, 0.8);
  }
  {
    // the garland arch behind: bands of yellow and orange marigold, red roses at its crown, green leaves on its shoulders
    const ax = PX1 - 0.04, R = 0.62, cy = pitY + 0.12;
    const n = 70;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = Math.PI * t; // from the right foot (z = L.z + R) over the top to the left
      const z = L.z + Math.cos(a) * R * 0.95, y = cy + Math.sin(a) * R * 1.05;
      const top = Math.abs(t - 0.5) < 0.14;
      for (const dx of [0, 0.035]) {
        if (top) O.add('rose', ax + dx, y, z, 1.0);
        else O.add('marigold', ax + dx, y, z, 1.25, Math.floor(t * 9) % 2 ? 0xf2a400 : 0xf06a00);
      }
    }
    for (const t of [0.28, 0.72]) {
      const a = Math.PI * t, z = L.z + Math.cos(a) * R * 0.95, y = cy + Math.sin(a) * R * 1.05;
      for (let k = 0; k < 6; k++) O.add('bel', ax - 0.03, y + (rnd() - 0.5) * 0.1, z + (rnd() - 0.5) * 0.1, 1.5, undefined, rnd() * 6.3, 1.2);
    }
  }
  {
    // two small silver trishuls either side of the linga, a red flower and a leaf at each foot
    for (const s of [-1, 1]) {
      const tx = L.x - 0.02, tz = L.z + s * 0.36, ty = bed;
      B.span(K.silverRep, tx - 0.006, tx + 0.006, ty, ty + 0.26, tz - 0.006, tz + 0.006);
      B.span(K.silverRep, tx - 0.006, tx + 0.006, ty + 0.2, ty + 0.212, tz - 0.05, tz + 0.05);
      for (const dz of [-0.05, 0, 0.05]) B.add(K.silverRep, new THREE.ConeGeometry(0.012, dz === 0 ? 0.08 : 0.06, 4).translate(tx, ty + (dz === 0 ? 0.3 : 0.24), tz + dz));
      O.add('rose', tx - 0.03, ty + 0.03, tz, 1.1);
      O.add('bel', tx - 0.06, ty + 0.02, tz + s * 0.03, 1.3, undefined, rnd() * 6.3, 0.3);
    }
  }
  // the pit a bed of white flowers, patterned with magenta rose petals, edged in marigold (photograph)
  for (let i = 0; i < 1300; i++) {
    const x = PX0 + 0.02 + rnd() * (PX1 - PX0 - 0.04), z = PZ0 + 0.02 + rnd() * (PZ1 - PZ0 - 0.04);
    if (Math.hypot(x - L.x, (z - L.z) / 0.92) < 0.27) continue;
    const swirl = Math.sin((x - L.x) * 9 + Math.atan2(z - L.z, x - L.x) * 2) > 0.45;
    if (swirl) O.add('petal', x, bed + 0.012, z, 1.3, rnd() < 0.8 ? 0xd0186a : 0xe8408a, rnd() * 6.3, 0.4);
    else O.add('mogra', x, bed + 0.012, z, 0.85, undefined, rnd() * 6.3, 0.3);
  }
  for (const [xa, za, xb, zb] of [[PX0, PZ0, PX1, PZ0], [PX0, PZ1, PX1, PZ1], [PX1, PZ0, PX1, PZ1]] as const) {
    const n = Math.round(Math.hypot(xb - xa, zb - za) / 0.035);
    for (let i = 0; i <= n; i++) O.add('marigold', xa + ((xb - xa) * i) / n, bed + 0.03, za + ((zb - za) * i) / n, 1.1);
  }
  // a betel leaf laid before the linga, towards the rail
  O.add('bel', L.x - 0.33, bed + 0.02, L.z + 0.05, 2.2, 0x3f8a2a, 0.3, 0.1);
  O.scatter(PX0, PX1 + LW, PZ0 - LW, PZ0, T1, 18, 0.4);
  O.scatter(PX0, PX1 + LW, PZ1, PZ1 + LW, T1, 18, 0.4);
  O.scatter(PX1 + LW, x1 - 0.1, PZ0 - LW, PZ1 + LW, T2, 30, 0.4);
  O.scatter(FX + 0.3, x1 - 0.1, z0 + 0.1, PZ0 - LW, T2, 40, 0.4);
  O.scatter(FX + 0.3, x1 - 0.1, PZ1 + LW, z1 - 0.1, T2, 30, 0.4);

  // ---------- the spout: a brass pipe from the back ledge, turned down over the stone ----------
  {
    const sy = T2 + 0.12, sx = L.x + 0.03, sz = L.z + 0.07; // (a little aside of the naga's body)
    B.add(K.brass, new THREE.CylinderGeometry(0.015, 0.015, x1 - sx, 12).rotateZ(Math.PI / 2).translate((x1 + sx) / 2, sy, sz));
    B.add(K.brass, new THREE.TorusGeometry(0.04, 0.015, 8, 12, Math.PI / 2).rotateY(Math.PI / 2).rotateX(Math.PI).translate(sx, sy - 0.04, sz).rotateY(0));
    B.lathe(K.brass, [[0, 0], [0.026, 0], [0.022, 0.03], [0.016, 0.05], [0, 0.05]], sx - 0.04, sy - 0.1, sz, 12);
    // the steady stream onto the rock
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, sy - 0.1 - topY, 8).translate(0, (sy - 0.1 + topY) / 2, 0), stream);
    st.position.set(sx - 0.04, 0, sz);
    g.add(st);
    // a second, stainless pipe along the back ledge
    B.add(K.steel, new THREE.CylinderGeometry(0.014, 0.014, PZ1 - PZ0 + 2 * LW, 10).rotateX(Math.PI / 2).translate(x1 - 0.12, T2 + 0.05, (PZ0 + PZ1) / 2));
  }

  // ---------- the devotees' side: silver parapet, glass screen in a steel frame, the pouring chute ----------
  {
    const ZA = z0 + 0.25, ZB = PZ1 + LW; // the screen runs from the left wall to the right edge of the pit
    B.span(granite, FX, PX0, fy, fy + 0.68, z0, z1);
    // the embossed silver rail box (rosettes and scrolls)
    B.span(K.silverEmb, FX - 0.03, PX0 + 0.02, fy + 0.68, fy + 0.88, z0, z1);
    B.span(K.silverRep, FX - 0.05, PX0 + 0.04, fy + 0.88, fy + 0.91, z0, z1);
    // glass, with a gap at the chute
    const gx = (FX + PX0) / 2, gy0 = fy + 0.91, gy1 = fy + 1.55, chZ = PZ1 - 0.05; // (the chute is off to the right of the stone)
    for (const [za, zb] of [[ZA, chZ - 0.12], [chZ + 0.12, ZB]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(zb - za, gy1 - gy0).rotateY(Math.PI / 2), glass);
      pl.position.set(gx, (gy0 + gy1) / 2, (za + zb) / 2);
      pl.renderOrder = 3;
      g.add(pl);
    }
    // steel frame: posts, a top bar at ~1.6 m, a bottom channel
    for (let z = ZA; z <= ZB + 0.01; z += (ZB - ZA) / 5) B.span(K.steel, gx - 0.02, gx + 0.02, gy0, gy1, z - 0.02, z + 0.02);
    B.add(K.steel, new THREE.CylinderGeometry(0.022, 0.022, ZB - ZA, 12).rotateX(Math.PI / 2).translate(gx, gy1 + 0.02, (ZA + ZB) / 2));
    B.span(K.steel, gx - 0.03, gx + 0.03, gy0, gy0 + 0.03, ZA, ZB);
    // the chute: a steel funnel at the gap, a pipe down into the pit
    B.lathe(K.steel, [[0.02, 0], [0.025, 0], [0.09, 0.12], [0.1, 0.13], [0.08, 0.13], [0.018, 0.02]], gx, fy + 0.93, chZ, 16);
    B.add(K.steel, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8).rotateZ(-0.9).translate(gx + 0.2, fy + 0.73, chZ));
    // brass coin boxes with slots on the devotees' side
    for (const z of [z0 + 0.6, PZ1 + 0.5]) {
      B.span(K.brass, FX - 0.24, FX - 0.02, fy + 0.6, fy + 0.95, z - 0.15, z + 0.15);
      B.span(K.dark, FX - 0.245, FX - 0.23, fy + 0.85, fy + 0.87, z - 0.08, z + 0.08);
    }
    // the right platform has the silver rail but no glass (the pujaris' side)
    P.solid(FX - 0.05, fy, z0, x1, fy + 1.7, z1);
    P.floor(g, x0 + 0.38, FX, z0, z1, fy);
  }

  // ---------- the back wall: silver inscription, a lamp shelf, Parvati in her silver-framed niche ----------
  {
    const cz = (PZ0 + PZ1) / 2, bx = x1 - 0.006;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({
      map: inscriptionTexture(), metalness: 0.55, roughness: 0.38, envMap: K.neutralEnv, envMapIntensity: 0.9,
    }));
    panel.position.set(bx - 0.03, fy + 1.36, cz);
    g.add(panel);
    B.span(K.silver, bx - 0.03, bx, fy + 1.11, fy + 1.61, cz - 0.63, cz + 0.63);
    // the shelf with a brass diya plate, a brass bowl, a steel lota
    B.span(granite, x1 - 0.22, x1, fy + 1.0, fy + 1.06, cz - 0.8, cz + 0.8);
    B.lathe(K.brass, [[0, 0], [0.13, 0], [0.15, 0.02], [0.13, 0.025], [0, 0.01]], x1 - 0.12, fy + 1.06, cz - 0.4, 20);
    for (const a of [0, 2.1, 4.2]) flames.points.push(new THREE.Vector3(x1 - 0.12 + Math.cos(a) * 0.08, fy + 1.11, cz - 0.4 + Math.sin(a) * 0.08));
    B.lathe(K.brass, [[0, 0], [0.06, 0], [0.14, 0.06], [0.15, 0.07], [0.13, 0.07], [0, 0.015]], x1 - 0.13, fy + 1.06, cz + 0.35, 20);
    B.lathe(K.steel, [[0, 0], [0.05, 0], [0.065, 0.06], [0.04, 0.12], [0.045, 0.15], [0, 0.15]], x1 - 0.1, fy + 1.06, cz - 0.7, 14);
    // the niche: dark recess in a silver frame embossed with swastikas
    const ny0 = fy + 0.5, ny1 = fy + 0.95;
    B.span(K.dark, bx - 0.01, bx, ny0, ny1, cz - 0.3, cz + 0.3);
    B.span(K.silverEmb, bx - 0.08, bx, ny0 - 0.07, ny0, cz - 0.37, cz + 0.37);
    B.span(K.silverEmb, bx - 0.08, bx, ny1, ny1 + 0.07, cz - 0.37, cz + 0.37);
    for (const s of [-1, 1]) B.span(K.silverEmb, bx - 0.08, bx, ny0, ny1, cz + s * 0.3 - (s > 0 ? 0 : 0.07), cz + s * 0.3 + (s > 0 ? 0.07 : 0));
    // Parvati: dressed in red and orange, a sindoor face, a small silver crown, marigold and white garlands
    const mx = bx - 0.16, my = ny0;
    B.lathe(K.redCloth, [[0, 0], [0.13, 0], [0.12, 0.08], [0.09, 0.2], [0.06, 0.27], [0, 0.29]], mx, my, cz, 18);
    B.add(K.kumkum, new THREE.SphereGeometry(0.055, 14, 10).scale(0.8, 1, 0.9).translate(mx - 0.01, my + 0.32, cz));
    B.lathe(K.silver, [[0, 0], [0.05, 0], [0.04, 0.04], [0.015, 0.07], [0, 0.08]], mx, my + 0.36, cz, 12);
    O.strand(new THREE.Vector3(mx - 0.08, my + 0.27, cz - 0.09), new THREE.Vector3(mx - 0.08, my + 0.27, cz + 0.09), 0.13, 0.8);
    O.strand(new THREE.Vector3(mx - 0.1, my + 0.25, cz - 0.11), new THREE.Vector3(mx - 0.1, my + 0.25, cz + 0.11), 0.17, 0.75);
  }

  // ---------- brass lidded boxes, coconuts ----------
  const brassBox = (x: number, y: number, z: number) => {
    B.span(K.brass, x - 0.17, x + 0.17, y, y + 0.22, z - 0.12, z + 0.12);
    B.span(K.brass, x - 0.18, x + 0.18, y + 0.22, y + 0.26, z - 0.13, z + 0.13);
    B.add(K.brass, new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI).translate(x, y + 0.26, z));
    for (const s of [-1, 1]) B.add(K.brass, new THREE.TorusGeometry(0.03, 0.006, 6, 12).rotateY(Math.PI / 2).translate(x + s * 0.175, y + 0.15, z));
    B.span(K.dark, x - 0.02, x + 0.02, y + 0.16, y + 0.23, z + 0.12, z + 0.13);
  };
  brassBox(x1 - 0.35, T2, PZ0 - LW - 0.35);
  brassBox(x1 - 0.35, T2, z1 - 0.4);
  {
    const cg = new THREE.SphereGeometry(0.075, 12, 9).scale(1, 0.85, 1.25);
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(cg, coconut);
      c.position.set(x1 - 0.75 + (i % 3) * 0.17 + rnd() * 0.04, T2 + 0.06 + (i > 5 ? 0.11 : 0), PZ0 - LW - 0.35 + Math.floor(i / 3) * 0.17 - 0.17);
      c.rotation.set(rnd(), rnd() * 6, rnd());
      g.add(c);
    }
  }

  // ---------- the silver chhatra over the pit, and the silver chains on their steel bar ----------
  {
    const cx = (PX0 + PX1) / 2, cz = (PZ0 + PZ1) / 2, cy = ceil - 0.55;
    B.lathe(K.silver, [[0, 0.34], [0.18, 0.31], [0.36, 0.2], [0.5, 0.03], [0.52, 0], [0.5, -0.01], [0, 0.3]], cx, cy, cz, 32);
    B.add(K.silver, new THREE.CylinderGeometry(0.012, 0.012, ceil - (cy + 0.34), 8).translate(cx, (ceil + cy + 0.34) / 2, cz));
    // a fringe of little hanging bells / tassels
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      B.add(K.silver, new THREE.CylinderGeometry(0.006, 0.012, 0.09, 6).translate(cx + Math.cos(a) * 0.5, cy - 0.05, cz + Math.sin(a) * 0.5));
    }
    const barX = FX - 0.35, barY = fy + 2.15;
    B.add(K.steel, new THREE.CylinderGeometry(0.02, 0.02, z1 - z0, 10).rotateX(Math.PI / 2).translate(barX, barY, (z0 + z1) / 2));
    for (let z = z0 + 0.2; z < z1 - 0.6; z += 0.9) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(barX, barY - Math.sin(t * Math.PI) * 0.32, z + t * 0.9)); }
      B.add(K.silver, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 5));
    }
  }

  // ---------- the door from the hall: an oxblood-painted carved frame, an iron grille, open silver leaves ----------
  {
    const dz0 = doorZ - doorHW, dz1 = doorZ + doorHW, dx = x0 - T - 0.04;
    for (const [za, zb] of [[dz0 - 0.32, dz0], [dz1, dz1 + 0.32]]) B.span(K.sindoorStone, dx - 0.06, dx + 0.1, 0, 2.5, za, zb);
    B.span(K.sindoorStone, dx - 0.1, dx + 0.1, 2.5, 2.82, dz0 - 0.42, dz1 + 0.42);
    B.span(K.sindoorStone, dx - 0.2, dx + 0.1, 2.82, 2.92, dz0 - 0.5, dz1 + 0.5);
    B.span(K.oldStone, dx - 0.16, dx - 0.06, 2.55, 2.78, doorZ - 0.12, doorZ + 0.12); // the Ganesha block on the lintel
    // the grille transom over the opening, and the silver strip with the Omkara shloka under it
    B.span(K.dark, dx - 0.02, dx + 0.02, 2.1, 2.36, dz0, dz1);
    for (let z = dz0 + 0.05; z < dz1; z += 0.07) B.span(K.cable, dx - 0.05, dx - 0.02, 2.1, 2.36, z - 0.008, z + 0.008);
    B.span(K.silverEmb, dx - 0.05, dx + 0.02, 2.36, 2.48, dz0, dz1);
    // the leaves: wood clad in embossed silver, opened back against the jambs inside the wall
    const { map, normal } = doorLeafMaps();
    const leafMat = new THREE.MeshStandardMaterial({ map, normalMap: normal, normalScale: new THREE.Vector2(1.5, 1.5), metalness: 0.85, roughness: 0.32, envMap: K.neutralEnv, envMapIntensity: 1.1 });
    const leafBack = new THREE.MeshStandardMaterial({ color: 0x7d232c, roughness: 0.6 });
    for (const [z, face] of [[dz0 + 0.035, 1], [dz1 - 0.035, -1]] as const) {
      B.span(leafBack, x0 - T + 0.02, x0 - T + 0.57, 0.02, 2.07, face > 0 ? z - 0.03 : z + 0.005, face > 0 ? z - 0.005 : z + 0.03); // the leaf's red-painted body
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.05), leafMat);
      leaf.rotation.y = face > 0 ? 0 : Math.PI;
      leaf.position.set(x0 - T + 0.3, 1.045, z);
      g.add(leaf);
      B.span(K.brass, x0 - T + 0.48, x0 - T + 0.54, 0.95, 1.0, z - 0.02, z + 0.02); // the tower bolt
    }
    // a toran of marigold across the door, and the row of brass bells before it
    O.strand(new THREE.Vector3(dx - 0.08, 2.3, dz0 - 0.15), new THREE.Vector3(dx - 0.08, 2.3, dz1 + 0.15), 0.18, 1);
    const bell = (bx: number, by: number, bz: number, s: number) => {
      const geo = new THREE.LatheGeometry([[0, 0], [0.1, 0.01], [0.11, 0.07], [0.075, 0.17], [0.03, 0.22], [0, 0.23]].map(([a, b]) => new THREE.Vector2(a * s, b * s)), 14);
      geo.translate(bx, by, bz);
      B.add(K.brass, geo);
      B.span(K.brass, bx - 0.006, bx + 0.006, by + 0.23 * s, 3.1, bz - 0.006, bz + 0.006);
    };
    bell(dx - 0.7, 1.95, dz0 - 0.1, 1.2);
    bell(dx - 0.7, 2.0, doorZ, 1.6);
    bell(dx - 0.7, 1.95, dz1 + 0.1, 1.2);
  }

  // ---------- the diya stand: a brass deepstambh in the sanctum's south corner, where devotees light a lamp ----------
  // (the darshan story is told here; at the rail and everywhere else in the sanctum the aarti plays)
  {
    const dx = 10.95, dz = z1 - 0.32;
    B.lathe(K.brass, [[0, 0], [0.2, 0], [0.2, 0.04], [0.12, 0.08], [0.05, 0.14], [0.035, 0.3], [0.03, 1.05], [0.05, 1.1], [0, 1.12]], dx, fy, dz, 18);
    for (const [h, r, n] of [[0.42, 0.2, 9], [0.72, 0.15, 7], [1.0, 0.1, 5]] as const) {
      B.lathe(K.brass, [[0, 0], [r + 0.03, 0], [r + 0.035, 0.02], [r + 0.02, 0.03], [0, 0.02]], dx, fy + h, dz, 24);
      for (let i = 0; i < n; i++) {
        const a2 = (i / n) * Math.PI * 2, px = dx + Math.cos(a2) * r, pz = dz + Math.sin(a2) * r;
        B.lathe(K.brass, [[0, 0], [0.018, 0], [0.026, 0.013], [0.028, 0.022], [0, 0.014]], px, fy + h + 0.02, pz, 8);
        flames.points.push(new THREE.Vector3(px, fy + h + 0.06, pz));
      }
    }
    flames.points.push(new THREE.Vector3(dx, fy + 1.17, dz));
    // small clay diyas set down on a brass tray at its foot
    B.lathe(K.brass, [[0, 0], [0.24, 0], [0.26, 0.02], [0, 0.015]], dx - 0.3, fy, dz, 20);
    for (let i = 0; i < 6; i++) {
      const a2 = (i / 6) * Math.PI * 2, px = dx - 0.3 + Math.cos(a2) * 0.15, pz = dz + Math.sin(a2) * 0.15;
      B.lathe(new THREE.MeshStandardMaterial({ color: 0x9a4a28, roughness: 0.9 }), [[0, 0], [0.025, 0], [0.038, 0.02], [0.04, 0.03], [0, 0.02]], px, fy + 0.02, pz, 10);
      flames.points.push(new THREE.Vector3(px, fy + 0.08, pz));
    }
    const warm = new THREE.PointLight(0xffc27a, 0.5, 2.2, 1.8);
    warm.position.set(dx, fy + 1.0, dz - 0.2);
    g.add(warm);
    flames.lights.push(warm);
    P.solid(dx - 0.22, fy, dz - 0.22, dx + 0.22, fy + 1.2, dz + 0.22);
    P.solid(dx - 0.56, fy, dz - 0.26, dx - 0.04, fy + 0.1, dz + 0.26);
  }

  // ---------- light: cool LED tubes on the ceiling, the warm diyas ----------
  for (const z of [z0 + 1.2, z1 - 1.2]) B.span(K.tube, x0 + 0.8, x0 + 2.0, ceil - 0.04, ceil, z - 0.03, z + 0.03);
  const led = new THREE.PointLight(0xeef2ff, 0.9, 6, 1.6);
  led.position.set((x0 + x1) / 2 - 0.4, ceil - 0.2, (z0 + z1) / 2);
  g.add(led);
  const diya = new THREE.PointLight(0xffd8a0, 0.35, 2.5, 1.8);
  diya.position.set(x1 - 0.3, fy + 1.25, (PZ0 + PZ1) / 2 - 0.4);
  g.add(diya);
  flames.lights.push(diya);

  O.scatter(x0 + 0.5, FX - 0.2, z0 + 0.3, z1 - 0.3, fy, 16, 0.3);
  O.flush(g);
  B.flush(g, false);
  for (const c of g.children) c.castShadow = false;
  stone.castShadow = true;
  return g;
}

import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { lathe, prng, type Merger } from './merge';
import type { SM } from './mats';
import { SHRINE } from './layout';
import { kalashaGeo, mergeAll, kuduGeo, frustum } from './geo';
import type { Offerings } from './offerings';

/**
 * The garbhagriha of Shri Mallikarjuna and the Jyotirlinga.
 *
 * Sources: the Devasthanam's own darshan image (srisailadevasthanam.org, "sd-jyotirlingas" and the
 * Udayasthamana-seva alankaram) and pilgrims' accounts (no photography is allowed inside).
 *  - The Jyotirlinga is swayambhu: a LOW, BROAD, SMOOTH black dome rising only a little out of its
 *    pitha (≈2.2 : 1 width : height), so in sparsha darshan pilgrims kneel, touch it and lay their
 *    forehead on it. Three broad white bands of vibhuti cross its east face with a red kumkum dot.
 *  - Behind it stands a brass/antique-gold naga of FIVE SEPARATE UPRIGHT HOODS side by side, ribbed,
 *    each with its head; the row is ≈2.5× the stone's height and a little wider than it.
 *  - A thick arch of red-pink rose garland with white jasmine strands frames the naga; jasmine rings
 *    the foot. For alankaram a gold canopy on four turned pillars with a kirtimukha crest stands over it.
 *  - The chamber is small, dark, lamp-lit, soot-blackened; the doorway is clad in embossed gold.
 */
export const LINGAM = { h: 0.155, r: 0.25 };

/**
 * The swayambhu stone as darshan shows it: a low, broad, steep-sided dome (≈2.2 : 1 visible), almost
 * hidden under vibhuti: broad white-grey bands of ash with thin dark lines of the stone between, a
 * black rim at the foot, white flowers on the crown and a big kumkum dot centre-front (east, +x).
 * Its own mesh (one draw) with a painted band texture; base at y = 0.
 */
function swayambhuMesh(env: THREE.Texture) {
  const prof: THREE.Vector2[] = [];
  const N = 22, n = 2.7;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI / 2;
    const c = Math.cos(t), sn = Math.sin(t);
    prof.push(new THREE.Vector2(Math.max(0.0005, LINGAM.r * Math.pow(c, 2 / n) * (1 + 0.04 * (1 - sn))), LINGAM.h * Math.pow(sn, 2 / n)));
  }
  const g = new THREE.LatheGeometry(prof, 72);
  const p = g.attributes.position;
  const rnd = prng(23);
  const bumps: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) bumps.push([rnd() * Math.PI * 2, rnd(), 0.01 + rnd() * 0.012]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), v = y / LINGAM.h;
    let k = 1;
    for (const [ba, bv, amp] of bumps) k += amp * Math.exp(-((Math.atan2(Math.sin(a - ba), Math.cos(a - ba))) ** 2) / 0.4 - ((v - bv) ** 2) / 0.08);
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  // the vibhuti band texture: u runs round from +z (u = 0) through +x (u = 0.25); v runs up the profile
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x2 = c.getContext('2d')!;
  const rr = prng(5);
  x2.fillStyle = '#efede8'; x2.fillRect(0, 0, 1024, 256);
  // ash texture: mottled grey-white
  for (let i = 0; i < 2600; i++) {
    const l = 200 + Math.floor(rr() * 55);
    x2.fillStyle = `rgba(${l},${l - 3},${l - 8},0.35)`;
    x2.fillRect(rr() * 1024, rr() * 256, 2 + rr() * 9, 1 + rr() * 3);
  }
  // thin dark lines of the stone between the ash bands (v measured from the top of the canvas = crown)
  const line = (v: number, w: number, a: number) => {
    for (let u = 0; u < 1024; u += 4) {
      const vv = v + Math.sin(u * 0.013 + v * 9) * 3 + (rr() - 0.5) * 1.5;
      x2.fillStyle = `rgba(52,48,44,${a * (0.6 + rr() * 0.4)})`;
      x2.fillRect(u, vv, 5, w * (0.7 + rr() * 0.6));
    }
  };
  for (const [v, w] of [[96, 9], [128, 7], [158, 10], [188, 8]] as const) line(v, w, 0.92);
  // the black rim at the foot
  const gr = x2.createLinearGradient(0, 205, 0, 256);
  gr.addColorStop(0, 'rgba(38,34,30,0)'); gr.addColorStop(0.35, 'rgba(38,34,30,0.95)'); gr.addColorStop(1, 'rgba(26,23,20,1)');
  x2.fillStyle = gr; x2.fillRect(0, 205, 1024, 51);
  // kumkum dot centre-front with a dark ring, on the second band
  const du = 0.25 * 1024, dv = 140;
  x2.fillStyle = '#2a1a14'; x2.beginPath(); x2.ellipse(du, dv, 26, 30, 0, 0, Math.PI * 2); x2.fill();
  x2.fillStyle = '#c4101c'; x2.beginPath(); x2.ellipse(du, dv, 20, 24, 0, 0, Math.PI * 2); x2.fill();
  x2.fillStyle = 'rgba(255,120,110,0.5)'; x2.beginPath(); x2.ellipse(du - 5, dv - 7, 6, 6, 0, 0, Math.PI * 2); x2.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.flipY = true; // canvas top = v 1 = the crown
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, envMap: env, envMapIntensity: 0.5 });
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/** the pranala: a tapering spout with a channel, pointing north (−z), dipping a little */
function spoutGeo() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.08, 0); sh.lineTo(0.08, 0); sh.lineTo(0.045, 0.26); sh.quadraticCurveTo(0, 0.3, -0.045, 0.26); sh.lineTo(-0.08, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.045, 0);
  g.rotateX(-0.12);
  return g;
}

/** the five hoods: z offset, height above the yoni, sideways fan (rad); shared with the flower placement */
const HOODS = [-2, -1, 0, 1, 2].map((k) => ({ z: k * 0.09, H: 0.56 - Math.abs(k) * 0.025, fan: k * 0.12 }));
const NAGA_ROOT_X = -0.3, NAGA_LEAN = -0.16;

/** top-front point of hood k in the naga's frame (for the yellow flowers) */
function hoodTop(k: number) {
  const h = HOODS[k];
  return new THREE.Vector3(0.01, h.H + 0.01, 0)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), NAGA_LEAN)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), h.fan)
    .add(new THREE.Vector3(NAGA_ROOT_X, 0, h.z));
}

/**
 * The naga: FIVE tall cobra hoods standing upright side by side, ribbed brass, each a flattened
 * teardrop shell (≈0.12 m wide × 0.3 m hood on a ribbed neck), fanned ~10° apart, leaning a little
 * forward over the stone, rising from a common coil band. Local frame: the stone at the origin, the
 * hoods behind it (−x) facing +x; y = 0 at the yoni top.
 */
function nagaGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); n.computeVertexNormals(); parts.push(n); };
  // the coil band behind and under the hoods
  for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.17 - i * 0.02, 0.034, 10, 32).rotateX(Math.PI / 2).scale(0.8, 1, 1.45).translate(NAGA_ROOT_X - 0.02, 0.03 + i * 0.05, 0));
  const rib = (y: number) => Math.pow(0.5 + 0.5 * Math.cos((y * Math.PI * 2) / 0.0105), 1.5);
  HOODS.forEach((h) => {
    const sub: THREE.BufferGeometry[] = [];
    const hood0 = 0.15, hl = h.H - hood0;
    // ribbed neck, its belly scales facing forward
    const neck = new THREE.CylinderGeometry(0.024, 0.03, hood0 + 0.04, 14, 20).translate(0, (hood0 + 0.04) / 2, 0);
    const np = neck.attributes.position;
    for (let i = 0; i < np.count; i++) {
      const x = np.getX(i), y = np.getY(i), z = np.getZ(i);
      const front = Math.max(0, x / 0.03);
      const k = 1 + 0.1 * front * rib(y);
      np.setXYZ(i, x * k * 0.9, y, z * k);
    }
    sub.push(neck.toNonIndexed());
    // the hood: a cupped teardrop shell facing +x
    const hood = new THREE.SphereGeometry(1, 24, 140);
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const sx = hp.getX(i), sy = hp.getY(i), sz = hp.getZ(i);
      const v = (sy + 1) / 2;
      const w = v < 0.72 ? 0.03 + 0.044 * Math.pow(v / 0.72, 0.9) : 0.074 * Math.pow(Math.max(0, 1 - ((v - 0.72) / 0.28) ** 2), 0.45) + 0.003;
      const y = hood0 + v * hl;
      let x = sx * 0.012 + 0.012 * sz * sz;
      if (sx > 0) x += 0.0032 * rib(y) * (1 - 0.6 * sz * sz);
      hp.setXYZ(i, x, y, sz * w);
    }
    sub.push(hood.toNonIndexed());
    // spectacle mark, and the bowed head at the top front
    sub.push(new THREE.SphereGeometry(0.03, 14, 10).scale(1.3, 0.55, 0.9).rotateZ(-0.35).translate(0.03, h.H - 0.01, 0).toNonIndexed());
    for (const g of sub) { g.deleteAttribute('uv'); g.computeVertexNormals(); }
    const g = mergeAll(sub);
    g.rotateZ(NAGA_LEAN);
    g.rotateX(h.fan);
    g.translate(NAGA_ROOT_X, 0, h.z);
    parts.push(g);
  });
  return mergeAll(parts);
}

/** Brass standing lamp (kuthu vilakku / samai): base, shaft, oil bowl with wicks, finial; height h. */
function standLampGeo(h: number) {
  return lathe([
    [0, 0], [0.13, 0], [0.14, 0.03], [0.09, 0.06], [0.04, 0.1], [0.03, 0.2], [0.04, 0.24], [0.025, 0.28],
    [0.022, h * 0.75], [0.04, h * 0.77], [0.025, h * 0.79], [0.11, h * 0.8], [0.13, h * 0.83], [0.04, h * 0.84],
    [0.02, h * 0.9], [0.035, h * 0.95], [0.01, h], [0, h],
  ] as [number, number][], 18);
}

/**
 * A pillar of the alankaram canopy, as in the Devasthanam's photograph: a tall square base with a
 * panel, then a turned shaft of distinct beads and reels (≈0.08 m) with a bulb, and a square capital
 * with a bracket. Returns square and turned parts separately; height h.
 */
function canopyPillarGeo(h: number) {
  const sq: THREE.BufferGeometry[] = [];
  const box = (w: number, hh: number, y: number) => sq.push(new THREE.BoxGeometry(w, hh, w).translate(0, y + hh / 2, 0).toNonIndexed());
  box(0.15, 0.05, 0); box(0.125, 0.5, 0.05); box(0.15, 0.04, 0.55); // base, panelled block, cap moulding
  box(0.1, 0.03, 0.59);
  const top = h - 0.22;
  box(0.1, 0.03, top); box(0.15, 0.11, top + 0.03); box(0.19, 0.04, top + 0.14); box(0.2, 0.04, top + 0.18); // capital, abacus
  const p: [number, number][] = [[0, 0.62], [0.04, 0.62], [0.05, 0.65], [0.035, 0.68]];
  // bulb
  p.push([0.06, 0.74], [0.062, 0.8], [0.04, 0.86], [0.03, 0.88]);
  // beads and reels up the shaft
  const n = Math.max(3, Math.floor((top - 0.92) / 0.08));
  for (let k = 0; k < n; k++) {
    const y = 0.9 + k * ((top - 0.92) / n);
    const d = (top - 0.92) / n;
    p.push([0.028, y], [0.044, y + d * 0.2], [0.048, y + d * 0.5], [0.044, y + d * 0.8], [0.026, y + d]);
  }
  p.push([0.03, top - 0.01], [0.05, top], [0, top]);
  const turned = lathe(p, 16);
  for (const g of sq) g.deleteAttribute('uv');
  return { square: mergeAll(sq.map((g) => { g.computeVertexNormals(); return g; })), turned };
}

export function buildSanctum(B: Merger, K: SM, P: Physics, root: THREE.Group, flames: Flames, O: Offerings, env: THREE.Texture) {
  const { inner: I, plinth: F, doorW, doorH } = SHRINE;
  const lights: THREE.PointLight[] = [];
  const ceil = F + 3.7;
  const W = K.sanctumStone;
  // floor (polished black stone) and the soot-blackened granite walls and ceiling: no cladding
  B.span(K.blackStone, -I, F - 0.05, -I, I, F + 0.008, I);
  P.floor(root, -I, I, -I, I, F);
  B.span(W, -I, F, -I, I, ceil, -I + 0.02);
  B.span(W, -I, F, I - 0.02, I, ceil, I);
  B.span(W, -I, F, -I, -I + 0.02, ceil, I);
  B.span(W, I - 0.02, F, -I, I, ceil, -doorW / 2);
  B.span(W, I - 0.02, F, doorW / 2, I, ceil, I);
  B.span(W, I - 0.02, F + doorH, -doorW / 2, I, ceil, doorW / 2);
  B.span(W, -I, ceil - 0.02, -I, I, ceil, I);
  // a plain base moulding and a corbelled cornice where the corbelled ceiling begins
  for (const [y0, y1, o] of [[F, F + 0.22, 0.06], [F + 0.22, F + 0.3, 0.03], [F + 2.95, F + 3.08, 0.05], [F + 3.08, F + 3.2, 0.1]] as const) {
    B.span(W, -I, y0, -I, I, y1, -I + o);
    B.span(W, -I, y0, I - o, I, y1, I);
    B.span(W, -I, y0, -I + o, -I + o, y1, I - o);
    B.span(W, I - o, y0, -I + o, I, y1, -doorW / 2 - 0.12);
    B.span(W, I - o, y0, doorW / 2 + 0.12, I, y1, I - o);
  }
  // stepped ceiling: two corbelled squares and a plain lotus boss (boxes, so no stretched texture)
  B.span(W, -I + 0.1, ceil - 0.16, -I + 0.1, I - 0.1, ceil - 0.02, -I + 0.4);
  B.span(W, -I + 0.1, ceil - 0.16, I - 0.4, I - 0.1, ceil - 0.02, I - 0.1);
  B.span(W, -I + 0.1, ceil - 0.16, -I + 0.4, -I + 0.4, ceil - 0.02, I - 0.4);
  B.span(W, I - 0.4, ceil - 0.16, -I + 0.4, I - 0.1, ceil - 0.02, I - 0.4);
  B.span(W, -0.55, ceil - 0.1, -0.55, 0.55, ceil - 0.02, 0.55);
  B.place(W, new THREE.CylinderGeometry(0.22, 0.14, 0.12, 12), 0, ceil - 0.16, 0);
  // the gold-clad doorway (inside face and the passage through the thick wall)
  const G = K.goldSan;
  for (const e of [-1, 1]) B.span(G, I - 0.1, F, e > 0 ? doorW / 2 : -doorW / 2 - 0.3, I - 0.02, F + doorH + 0.3, e > 0 ? doorW / 2 + 0.3 : -doorW / 2);
  B.span(G, I - 0.1, F + doorH, -doorW / 2 - 0.3, I - 0.02, F + doorH + 0.3, doorW / 2 + 0.3);
  B.span(G, I, F, -doorW / 2 - 0.02, SHRINE.half, F + doorH, -doorW / 2);
  B.span(G, I, F, doorW / 2, SHRINE.half, F + doorH, doorW / 2 + 0.02);
  B.span(G, I, F + doorH - 0.02, -doorW / 2, SHRINE.half, F + doorH, doorW / 2);

  // ---- the pedestal, the brass-sheathed yoni, the stone
  const ped = 0.18, pw = 0.6;
  B.span(W, -pw, F, -pw, pw, F + ped * 0.55, pw);
  B.span(W, -pw + 0.06, F + ped * 0.55, -pw + 0.06, pw - 0.06, F + ped - 0.02, pw - 0.06);
  B.span(K.blackStone, -pw + 0.06, F + ped - 0.02, -pw + 0.06, pw - 0.06, F + ped, pw - 0.06);
  P.solid(-pw - 0.02, F, -pw - 0.02, pw + 0.02, F + 0.62, pw + 0.02);
  const yR = 0.44;
  const yoni = lathe([[0, 0], [yR, 0], [yR + 0.02, 0.03], [yR - 0.02, 0.06], [yR + 0.03, 0.1], [yR + 0.03, 0.12], [yR - 0.04, 0.13], [0, 0.13]], 48);
  B.place(K.nagaBrass, yoni, 0, F + ped, 0);
  B.place(K.nagaBrass, spoutGeo(), 0, F + ped + 0.06, -yR + 0.02);
  B.span(K.dark, -0.06, F + 0.001, -I + 0.05, 0.06, F + 0.006, -pw);
  const ly = F + ped + 0.13; // the yoni top, the foot of the stone
  // kumkum and turmeric heaped over the yoni round the stone (the red-brown bed of the darshan photo)
  B.place(K.roseCore, lathe([[0, -0.01], [yR - 0.025, -0.01], [yR - 0.05, 0.01], [LINGAM.r + 0.04, 0.025], [0, 0.025]], 40), 0, ly, 0);
  O.scatter(-yR + 0.12, yR - 0.12, -yR + 0.12, yR - 0.12, ly + 0.02, 40, 0.15);
  const stone = swayambhuMesh(env);
  stone.position.set(0, ly + 0.012, 0);
  root.add(stone);
  // white flowers heaped on the crown of the stone, a bel leaf
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.08;
    O.add('mogra', 0.03 + Math.cos(a) * r, ly + 0.012 + LINGAM.h - 0.004 + (0.08 - r) * 0.25, Math.sin(a) * r, 0.75, i % 7 === 0 ? 0xf6efd6 : undefined);
  }
  O.add('bel', -0.06, ly + LINGAM.h + 0.02, -0.04, 1.0, undefined, 0.4, 0.4);
  // the five-hooded naga behind
  B.place(K.nagaGold, nagaGeo(), 0, ly, 0);
  HOODS.forEach((_, k) => {
    const v = hoodTop(k);
    for (let j = 0; j < 2; j++) O.add('marigold', v.x - 0.005 * j, ly + v.y + 0.012, v.z + (j - 0.5) * 0.03, 0.62, 0xffd21a);
  });
  // jasmine strings wound round the foot of the stone, and round the yoni rim
  const spiral: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2.1 - Math.PI * 0.3, r = LINGAM.r + 0.03 + (i / 64) * 0.035; spiral.push(new THREE.Vector3(Math.cos(a) * r, ly + 0.03 + Math.sin(i * 0.7) * 0.005, Math.sin(a) * r)); }
  O.jasmineString(spiral, 0.018);
  const rim: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; rim.push(new THREE.Vector3(Math.cos(a) * (yR - 0.01), ly + 0.01, Math.sin(a) * (yR - 0.01))); }
  O.jasmineString(rim, 0.022, true);
  // a broad band of jasmine along the front edge of the pedestal (the white foreground of the photo)
  for (const dz of [0, 0.05]) O.jasmineString([new THREE.Vector3(pw - 0.1 - dz, F + ped + 0.02, -0.5), new THREE.Vector3(pw - 0.07 - dz, F + ped + 0.02, 0), new THREE.Vector3(pw - 0.1 - dz, F + ped + 0.02, 0.5)], 0.024);
  O.scatter(-pw + 0.05, pw - 0.05, -pw + 0.05, pw - 0.05, F + ped + 0.002, 22, 0.3);
  // the garland arch framing the naga: a thick rope of deep rose-red roses, jasmine strands on both edges
  const ax = -0.2, ab = ly - 0.02, aw = 0.47, rise = 0.74;
  const arch = (off: number, dx = 0) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, a = Math.PI * t;
      const zz = -Math.cos(a) * (aw + off), yy = Math.pow(Math.sin(a), 0.55) * (rise + off * 0.9);
      pts.push(new THREE.Vector3(ax + dx, ab + yy, zz));
    }
    return pts;
  };
  O.roseRope(arch(0), 0.062);
  O.jasmineString(arch(0.085, 0.01), 0.026);
  O.jasmineString(arch(0.118, 0.0), 0.022);
  for (let i = 0; i < 30; i++) O.add('ash', -0.5 + Math.random() * 1.0, F + ped + 0.003, (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.05), 0.7);

  // ---- the alankaram canopy (as photographed by the Devasthanam): four gold pillars with square bases,
  //      bead-and-reel turned shafts and square capitals; entablature, kirtimukha crest, a repoussé
  //      prabhavali of the Srisaila hills behind the naga. Set back so it frames the darshan line.
  const ch = 1.85, cw = 0.53, cx0 = -0.6, cx1 = 0.12;
  const cp = canopyPillarGeo(ch);
  for (const px of [cx0, cx1]) for (const sz of [-1, 1]) { B.place(K.goldSan, cp.square, px, F + ped, sz * cw); B.place(K.goldSanPlain, cp.turned, px, F + ped, sz * cw); }
  const et = F + ped + ch;
  B.span(K.goldSan, cx0 - 0.1, et, -cw - 0.1, cx1 + 0.1, et + 0.14, cw + 0.1);
  B.span(K.goldSanPlain, cx0 - 0.15, et + 0.14, -cw - 0.15, cx1 + 0.15, et + 0.2, cw + 0.15);
  B.place(K.goldSanPlain, frustum(cx1 - cx0 + 0.3, 2 * cw + 0.3, cx1 - cx0 + 0.1, 2 * cw + 0.1, 0.08), (cx0 + cx1) / 2, et + 0.2, 0);
  // the kirtimukha crest: an arched plaque with a face boss
  B.place(K.goldSan, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), cx1 + 0.12, et + 0.28, 0, Math.PI / 2);
  B.place(K.goldSanPlain, kuduGeo(0.2, 0.04, 0.05), cx1 + 0.14, et + 0.28, 0, Math.PI / 2);
  B.place(K.goldSanPlain, new THREE.SphereGeometry(0.06, 12, 8).scale(0.6, 1, 1.1), cx1 + 0.15, et + 0.36, 0);
  // the prabhavali: a repoussé panel with an arched top between the rear pillars
  B.span(K.goldSan, cx0 - 0.02, F + ped + 0.1, -cw + 0.06, cx0 + 0.02, F + ped + 1.15, cw - 0.06);
  B.place(K.goldSan, new THREE.CylinderGeometry(cw - 0.06, cw - 0.06, 0.04, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), cx0, F + ped + 1.15, 0, Math.PI / 2);
  B.place(K.goldSanPlain, kuduGeo(cw - 0.06, 0.035, 0.06), cx0 + 0.02, F + ped + 1.15, 0, Math.PI / 2);
  // garland swags on the canopy: rose and jasmine
  const swag = (z0: number, z1: number, x: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(x, et - 0.02 - Math.sin(t * Math.PI) * 0.28, z0 + (z1 - z0) * t)); }
    return pts;
  };
  O.roseRope(swag(-cw, cw, cx1 + 0.1), 0.03);
  for (const sz of [-1, 1]) O.roseRope([new THREE.Vector3(cx1 + 0.1, et - 0.02, sz * (cw + 0.04)), new THREE.Vector3(cx1 + 0.12, et - 0.25, sz * (cw + 0.07)), new THREE.Vector3(cx1 + 0.11, et - 0.5, sz * (cw + 0.06))], 0.032);

  // ---- lamps: brass standing lamps in the rear corners, a hanging lamp, the akhanda deepa in a west niche
  const lamp = standLampGeo(1.05);
  for (const z of [-1.42, 1.42]) {
    B.place(K.brass, lamp, -1.42, F, z);
    for (let k = 0; k < 5; k++) flames.points.push(new THREE.Vector3(-1.42 + Math.cos(k * 1.2566) * 0.11, F + 1.05 * 0.84 + 0.02, z + Math.sin(k * 1.2566) * 0.11));
    P.solid(-1.5, F, z - 0.08, -1.34, F + 1.1, z + 0.08);
  }
  B.span(K.brass, 0.995, F + 2.4, -0.005, 1.005, ceil, 0.005);
  B.place(K.brass, lathe([[0, 0], [0.12, 0.01], [0.15, 0.05], [0.04, 0.08], [0.015, 0.3]], 14), 1.0, F + 2.15, 0);
  for (let k = 0; k < 5; k++) flames.points.push(new THREE.Vector3(1.0 + Math.cos(k * 1.2566) * 0.12, F + 2.21, Math.sin(k * 1.2566) * 0.12));
  B.span(K.dark, -I + 0.02, F + 1.0, -0.35, -I + 0.2, F + 1.55, 0.35);
  B.place(K.brass, lathe([[0, 0], [0.08, 0.01], [0.1, 0.05], [0.06, 0.07], [0.02, 0.07], [0.015, 0.16], [0.07, 0.17], [0.0, 0.2]], 14), -I + 0.12, F + 1.0, 0);
  flames.points.push(new THREE.Vector3(-I + 0.12 + 0.07, F + 1.2, 0));
  // brass kalasha and an aarti plate in the front corners by the door
  B.place(K.brass, kalashaGeo(0.32, 14), 1.4, F, 1.35);
  B.place(K.brass, new THREE.CylinderGeometry(0.17, 0.15, 0.02, 20), 1.35, F + 0.01, -1.3);
  O.heap(1.35, F + 0.02, -1.3, 0.1, 0.04, 8);

  const warm = new THREE.PointLight(0xffc684, 7.0, 5.5, 1.5);
  warm.position.set(0.9, F + 1.35, 0);
  root.add(warm); lights.push(warm);
  const back = new THREE.PointLight(0xffc27c, 4.5, 4.0, 1.4);
  back.position.set(-0.6, F + 1.6, 0.9);
  root.add(back); lights.push(back);
  const fill = new THREE.PointLight(0xffc890, 2.4, 5.0, 1.4); // lamp glow off the silver walls and ceiling
  fill.position.set(0.2, F + 3.0, 0);
  root.add(fill); lights.push(fill);
  flames.lights.push(warm);
  return { lights, lingamTop: ly + LINGAM.h };
}

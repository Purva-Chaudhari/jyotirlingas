import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Materials } from '../../engine/materials';

/**
 * Baba Dham's palette:
 *  - thick lime whitewash over the stone of every temple (renewed often, greyed by monsoon soot,
 *    darkened where hands, water and threads touch it),
 *  - the one crimson-painted Devi shrine and the orange-red parapet bands,
 *  - inside the garbhagriha: whitewashed stone blocks gone grey with smoke and water, a dark
 *    stone floor scored in a grid, the black basalt jalahari with its silver rim,
 *  - grey stone slabs of the courtyard, steel queue railings, teal tarpaulin shades.
 * Scans are Poly Haven (CC0); textures are cached per id + tile size.
 */

const texCache = new Map<string, Promise<THREE.Texture[]>>();

function loadScan(id: string, size: number, aniso: number) {
  const key = `${id}@${size}`;
  let p = texCache.get(key);
  if (!p) {
    const loader = new THREE.TextureLoader();
    const rep = 1 / size;
    const one = (suffix: string, srgb: boolean) =>
      loader.loadAsync(`assets/tex/${id}_${suffix}.webp`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rep, rep);
        t.anisotropy = aniso;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    p = Promise.all([one('diff', true), one('nor', false), one('arm', false)]);
    texCache.set(key, p);
  }
  return p;
}

function scan(
  pending: Promise<unknown>[], aniso: number, id: string, size: number, tint: number,
  o: { normalScale?: number; rough?: number; aoI?: number } = {},
) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.88 });
  pending.push(loadScan(id, size, aniso).then(([map, nor, arm]) => {
    m.map = map;
    m.normalMap = nor;
    m.normalScale.setScalar(o.normalScale ?? 1);
    m.aoMap = arm;
    m.aoMapIntensity = o.aoI ?? 0.8;
    m.roughnessMap = arm;
    m.roughness = o.rough ?? 1;
    m.metalness = 0;
    m.color.set(tint);
    m.needsUpdate = true;
  }));
  return m;
}

/** Shared GLSL: world position + world normal varyings and a cheap value noise. */
function weather(m: THREE.MeshStandardMaterial, body: string) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVW;\nvarying vec3 vVN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vVW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vVN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vVW;
        varying vec3 vVN;
        float vh1(float n) { return fract(sin(n) * 43758.5453); }
        float vn1(float x) { float i = floor(x), f = fract(x); return mix(vh1(i), vh1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = vh1(dot(i, vec2(1.0, 57.0))), b = vh1(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
          float c = vh1(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = vh1(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${body}`);
  };
  m.customProgramCacheKey = () => body;
  m.needsUpdate = true;
}

/** Whitewash: grey splash and hand grime at the foot, faint soot blotches, monsoon streaks. */
const LIME_GLSL = `
  float hz = abs(vVN.x) > abs(vVN.z) ? vVW.z : vVW.x;
  float foot = (1.0 - smoothstep(0.0, 1.6, vVW.y)) * step(-0.2, vVW.y) * step(abs(vVN.y), 0.6);
  float blot = smoothstep(0.45, 0.85, vn2(vec2(hz * 0.6, vVW.y * 0.45)));
  float streak = smoothstep(0.62, 0.95, vn1(hz * 3.1)) * (0.5 + 0.5 * vn1(vVW.y * 0.4 + hz)) * step(abs(vVN.y), 0.6);
  diffuseColor.rgb *= 1.0 - foot * 0.3 - blot * 0.07 - streak * 0.1;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.93, 0.92, 0.88), foot);`;

/**
 * Shikhara whitewash: as above plus the vertical block joints that grid every face (world-aligned,
 * ~1.1 m) and the dark wet streak down the front of the main tower where the gathbandhan climbers
 * and rain run (only on the material that asks for it).
 */
function shikharaGLSL(frontStreak: boolean) {
  return `${LIME_GLSL}
  float side = step(abs(vVN.y), 0.75);
  float jq = abs(fract(hz / 1.12) - 0.5);
  float joint = smoothstep(0.468, 0.488, jq) * side;
  // the vertical rib/panel seams of the whitewashed faces (~1 m), finer than the block joints
  float sq = abs(fract(hz / 0.96 + 0.5) - 0.5);
  float seam = (1.0 - smoothstep(0.006, 0.02, sq)) * side * step(5.0, vVW.y);
  diffuseColor.rgb *= 1.0 - joint * 0.22 - seam * 0.14;
  // soot and shade under every course moulding, dust settled on every ledge
  float under = smoothstep(-0.15, -0.6, vVN.y);
  float ledge = smoothstep(0.6, 0.95, vVN.y) * step(4.0, vVW.y);
  diffuseColor.rgb *= 1.0 - under * 0.22 - ledge * 0.1;
  // fine plaster ribs every ~0.6 m (a shadowed groove with a lit lip above it)
  float rb = fract(vVW.y / 0.6);
  float rib = (smoothstep(0.0, 0.04, rb) - smoothstep(0.04, 0.1, rb)) * side;
  float lip = (smoothstep(0.1, 0.13, rb) - smoothstep(0.13, 0.2, rb)) * side;
  diffuseColor.rgb *= 1.0 - rib * 0.16 + lip * 0.05;
  // grey rain/soot streaks running down from each course ledge
  float course = fract(vVW.y / 0.6);
  float st = smoothstep(0.55, 0.9, vn1(hz * 6.3 + floor(vVW.y / 0.6) * 3.1)) * (1.0 - course) * side;
  float longSt = smoothstep(0.7, 0.95, vn1(hz * 2.1)) * smoothstep(6.0, 12.0, vVW.y) * side;
  diffuseColor.rgb *= 1.0 - st * 0.13 - longSt * 0.08;
  // each tower's whitewash is a slightly different batch (warmer, greyer, bluer)
  vec2 cellT = floor(vVW.xz / 9.0);
  float tv = vh1(dot(cellT, vec2(12.9898, 78.233)));
  diffuseColor.rgb *= mix(vec3(1.0, 0.985, 0.955), vec3(0.965, 0.975, 0.99), tv) * (0.965 + 0.035 * vh1(tv * 91.7));
  ${frontStreak ? `
  float fs = exp(-pow(vVW.x / (0.35 + 0.25 * vn1(vVW.y * 0.7)), 2.0)) * step(0.0, vVW.z) * smoothstep(6.0, 9.0, vVW.y);
  fs *= 0.65 + 0.35 * vn1(vVW.y * 2.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.24, 0.19, 0.15), fs * 0.75);` : ''}`;
}

/**
 * Courtyard slabs: dark grime where the walls, plinths and verandahs meet the floor, foot-polished
 * darker lanes, and irregular wet patches (water carried and spilled all day) — glossy in the
 * roughness pass below (pavWet is shared with it).
 */
const PAVING_GLSL = `
  float wallD = min(min(31.0 - abs(vVW.x), vVW.z + 28.0), 40.0 - vVW.z);
  float grimeW = 1.0 - smoothstep(0.0, 1.6, wallD);
  float blotP = smoothstep(0.35, 0.8, vn2(vVW.xz * 0.35));
  float pavWet = smoothstep(0.62, 0.72, vn2(vVW.xz * 0.22 + 7.3)) * (0.7 + 0.3 * vn2(vVW.xz * 2.0));
  float worn = smoothstep(0.5, 0.0, abs(vVW.x)) * step(10.0, vVW.z) * 0.6;
  diffuseColor.rgb *= 1.0 - grimeW * 0.35 - blotP * 0.12 - pavWet * 0.32 - worn * 0.08;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.9, 0.86), blotP);`;

/** Garbhagriha walls: centuries of lamp smoke darkening upward, wet splash at the foot. */
const SANCTUM_GLSL = `
  float smoke = smoothstep(1.2, 4.5, vVW.y) * (0.55 + 0.45 * vn2(vVW.xz * 0.8 + vVW.y * 0.3));
  float wet = (1.0 - smoothstep(0.45, 1.0, vVW.y));
  float drip = smoothstep(0.55, 0.9, vn1((vVW.x + vVW.z) * 4.0)) * (1.0 - smoothstep(1.0, 3.5, vVW.y));
  float lum = dot(diffuseColor.rgb, vec3(0.33));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.05, 1.0, 0.92), 0.5) * 1.18;
  diffuseColor.rgb *= 1.0 - smoke * 0.1 - wet * 0.16 - drip * 0.08;`;

/** A facade sheet for the town houses: storeys 3 m, bays 3.2 m, barred windows, sills, chhajja shadow. */
function facadeTexture() {
  const W = 512, H = 480; // 6.4 m × 6 m (two bays, two storeys)
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const px = W / 6.4;
  g.fillStyle = '#ece8e0';
  g.fillRect(0, 0, W, H);
  // plaster noise and grime
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * 0.06;
    g.fillStyle = `rgba(${60 + Math.random() * 40},${50 + Math.random() * 30},${40},${a})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 14, 2 + Math.random() * 30);
  }
  for (let s = 0; s < 2; s++) {
    const y0 = H - (s + 1) * 3 * px; // storey top in canvas coords (v up → canvas down)
    // slab edge / chhajja band with its shadow
    g.fillStyle = 'rgba(70,64,58,0.55)';
    g.fillRect(0, y0 + 0.05 * px, W, 0.12 * px);
    g.fillStyle = 'rgba(60,55,50,0.25)';
    g.fillRect(0, y0 + 0.17 * px, W, 0.35 * px);
    for (let b = 0; b < 2; b++) {
      const x0 = b * 3.2 * px + 0.9 * px, wy = y0 + 0.85 * px, ww = 1.35 * px, wh = 1.4 * px;
      g.fillStyle = '#2a2622';
      g.fillRect(x0, wy, ww, wh);
      // glass reflection
      const grd = g.createLinearGradient(x0, wy, x0 + ww, wy + wh);
      grd.addColorStop(0, 'rgba(120,135,150,0.35)'); grd.addColorStop(1, 'rgba(30,30,35,0.1)');
      g.fillStyle = grd;
      g.fillRect(x0 + 3, wy + 3, ww - 6, wh - 6);
      // window bars
      g.strokeStyle = 'rgba(70,90,80,0.95)';
      g.lineWidth = 2;
      for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(x0 + (k * ww) / 7, wy); g.lineTo(x0 + (k * ww) / 7, wy + wh); g.stroke(); }
      g.beginPath(); g.moveTo(x0, wy + wh / 2); g.lineTo(x0 + ww, wy + wh / 2); g.stroke();
      // sill and drip stain
      g.fillStyle = 'rgba(80,72,64,0.6)';
      g.fillRect(x0 - 6, wy + wh, ww + 12, 5);
      g.fillStyle = 'rgba(70,62,52,0.12)';
      g.fillRect(x0 + 6, wy + wh + 5, ww - 12, 0.9 * px);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 6.4, 1 / 6);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Panda-sabha cloth banners: a 4×4 atlas of red, crimson, pink, yellow and saffron cloths with
 * lines of illegible Devanagari-like strokes (a headline bar with hanging marks), borders and
 * ornamental discs — reads as lettered banners from a distance, says nothing.
 */
function bannerAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d')!;
  const bgs = ['#c8102e', '#e0457b', '#b5122d', '#f2c418', '#ff7a12', '#d81b60', '#a0131f', '#f06292'];
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let cell = 0; cell < 16; cell++) {
    const x0 = (cell % 4) * 256, y0 = (3 - Math.floor(cell / 4)) * 128; // v grows upward
    const bg = bgs[cell % bgs.length];
    const light = bg === '#f2c418' || bg === '#ff7a12';
    g.fillStyle = bg;
    g.fillRect(x0, y0, 256, 128);
    g.strokeStyle = light ? '#b5122d' : '#ffd23f';
    g.lineWidth = 4;
    g.strokeRect(x0 + 5, y0 + 5, 246, 118);
    const ink = light ? '#7a0c14' : (r() < 0.5 ? '#ffffff' : '#ffe14d');
    const lines = r() < 0.5 ? 2 : 3;
    const hasDisc = r() < 0.5;
    const tx0 = x0 + (hasDisc ? 60 : 16), tx1 = x0 + 240;
    if (hasDisc) {
      g.fillStyle = light ? '#b5122d' : '#ffd23f';
      g.beginPath(); g.arc(x0 + 34, y0 + 64, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = bg;
      g.beginPath(); g.arc(x0 + 34, y0 + 64, 12, 0, Math.PI * 2); g.fill();
    }
    for (let l = 0; l < lines; l++) {
      const ly = y0 + 22 + l * (96 / lines) + (lines === 2 ? 10 : 0);
      const sz = lines === 2 ? 30 : 22;
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = sz * 0.12;
      let x = tx0;
      while (x < tx1 - 20) {
        const ww = sz * (1.2 + r() * 2.2);
        if (x + ww > tx1) break;
        g.fillRect(x, ly, ww, sz * 0.12); // the shirorekha headline
        for (let k = 0; k < ww / (sz * 0.5); k++) {
          const sx = x + k * sz * 0.5 + r() * 4;
          g.beginPath();
          g.moveTo(sx, ly);
          if (r() < 0.5) { g.lineTo(sx, ly + sz * (0.6 + r() * 0.3)); }
          else { g.arc(sx + sz * 0.15, ly + sz * 0.45, sz * 0.18, -Math.PI / 2, Math.PI * (0.5 + r())); }
          g.stroke();
        }
        x += ww + sz * 0.35;
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * The main boards, lettered in Hindi as at Baba Dham: a 4×4 atlas of red/yellow/saffron boards with
 * a border and one or two lines of real text (devotional and directional), drawn with the
 * system's Devanagari font.
 */
export const BOARD_TEXT: [string, string?][] = [
  ['श्री बैद्यनाथ धाम'], ['जय बाबा बैद्यनाथ'], ['प्रवेश द्वार'], ['बोल बम', 'हर हर महादेव'],
  ['श्री श्री १००८ रावणेश्वर', 'बाबा बैद्यनाथ धाम'], ['पण्डा धर्मरक्षिणी सभा'], ['शीघ्र दर्शनम् कूपन'], ['जय माँ पार्वती'],
  ['निकास द्वार'], ['हर हर महादेव'], ['बाबा धाम', 'देवघर'], ['जूता-चप्पल यहाँ रखें'],
  ['पेड़ा भंडार'], ['पूजा सामग्री'], ['जलार्पण'], ['ॐ नमः शिवाय'],
];
function boardAtlas() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const g = c.getContext('2d')!;
  const styles = [['#c8102e', '#ffd23f', '#ffffff'], ['#f2c418', '#b5122d', '#7a0c14'], ['#ff7a12', '#ffffff', '#ffffff'], ['#a0131f', '#ffd23f', '#ffe14d']];
  BOARD_TEXT.forEach((lines, cell) => {
    const x0 = (cell % 4) * 512, y0 = (3 - Math.floor(cell / 4)) * 256;
    const [bg, border, ink] = styles[cell % styles.length];
    g.fillStyle = bg; g.fillRect(x0, y0, 512, 256);
    g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(x0 + 10, y0 + 10, 492, 236);
    g.lineWidth = 2; g.strokeRect(x0 + 22, y0 + 22, 468, 212);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fonts = '"Martel", "Kohinoor Devanagari", "Devanagari Sangam MN", "ITF Devanagari", "Noto Sans Devanagari", serif';
    const two = lines.length > 1 && lines[1];
    const fit = (t: string, size: number) => { g.font = `700 ${size}px ${fonts}`; let s2 = size; while (g.measureText(t).width > 440 && s2 > 20) { s2 -= 4; g.font = `700 ${s2}px ${fonts}`; } };
    if (two) {
      fit(lines[0], 70); g.fillText(lines[0], x0 + 256, y0 + 92);
      fit(lines[1]!, 62); g.fillText(lines[1]!, x0 + 256, y0 + 172);
    } else { fit(lines[0], 96); g.fillText(lines[0], x0 + 256, y0 + 134); }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Big roadside hoardings: bold colour fields and abstract shapes — no readable text or brands. */
function hoardingTexture(seed: number) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  const pal = [['#c8102e', '#ffffff', '#ffd23f'], ['#202020', '#e8e8e8', '#9a9a9a'], ['#d84315', '#fff3e0', '#5d4037'], ['#1565c0', '#ffffff', '#ffca28']][seed % 4];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = pal[1];
  g.beginPath(); g.ellipse(120 + seed * 30, 128, 70, 52, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = pal[0];
  g.beginPath(); g.ellipse(132 + seed * 30, 128, 50, 34, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = pal[1];
  for (let i = 0; i < 3; i++) g.fillRect(230, 70 + i * 40, 230 - i * 50, 22);
  g.fillStyle = pal[2];
  g.fillRect(0, 222, 512, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function vaidyanathMats(M: Materials, renderer: THREE.WebGLRenderer, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const S = (id: string, size: number, tint: number, o?: Parameters<typeof scan>[5]) => scan(pending, aniso, id, size, tint, o);

  const lime = S('white_stucco', 2.2, 0xfbfaf6, { normalScale: 1.4 });
  weather(lime, LIME_GLSL);
  const shikhara = S('white_stucco', 2.2, 0xffffff, { normalScale: 1.4 });
  weather(shikhara, shikharaGLSL(false));
  const mainShikhara = S('white_stucco', 2.2, 0xffffff, { normalScale: 1.4 });
  weather(mainShikhara, shikharaGLSL(true));
  // the crimson Devi shrine (gloss enamel over lime)
  const crimson = S('white_stucco', 2.2, 0xc4234f, { normalScale: 1.4, rough: 0.8 });
  weather(crimson, LIME_GLSL);
  const redBand = S('white_stucco', 2.2, 0xc8402a, { normalScale: 1.2 });
  const sanctumWall = S('white_sandstone_bricks', 6.5, 0xfff4e4, { normalScale: 0.4 });
  weather(sanctumWall, SANCTUM_GLSL);
  const nicheBack = S('white_sandstone_bricks', 6.5, 0x77726a, { normalScale: 0.5 });
  const sanctumFloor = S('large_grey_tiles', 1.6, 0x8c8c90, { normalScale: 1.0, rough: 0.38 });
  const paving = S('large_grey_tiles', 3.2, 0xbdb8ae, { normalScale: 1.0 });
  weather(paving, PAVING_GLSL);
  {
    // the wet patches are glossier as well as darker
    const prev = paving.onBeforeCompile;
    paving.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, pavWet);`);
    };
  }
  const porchFloor = S('granite_tile_04', 2.0, 0x8c8780, { rough: 0.8 });
  const road = S('concrete_wall_006', 4, 0x8f877c);
  const roof = S('concrete_wall_006', 3, 0xa8a196);
  const townPlaster = S('plastered_wall_02', 3, 0xe6dccb);

  const facadeMap = facadeTexture();
  const facade = (tint: number) => {
    const m = new THREE.MeshStandardMaterial({ map: facadeMap, color: tint, roughness: 0.9 });
    weather(m, LIME_GLSL);
    return m;
  };

  // black basalt of the jalahari and the lingam: wet, lamp-lit (never transmission)
  const basalt = new THREE.MeshPhysicalMaterial({ color: 0x1b1a19, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
  basalt.envMap = interiorEnv; basalt.envMapIntensity = 1.4;
  const lingam = new THREE.MeshPhysicalMaterial({ color: 0x121111, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 });
  lingam.envMap = interiorEnv; lingam.envMapIntensity = 1.8;
  const waterFilm = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.03, metalness: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
  waterFilm.envMap = interiorEnv; waterFilm.envMapIntensity = 2.2;
  // the wet sheen of water and milk spread over the floor round the jalahari
  const puddle = new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: 0.28, metalness: 0.0, transparent: true, opacity: 0.38, depthWrite: false });
  puddle.envMap = interiorEnv; puddle.envMapIntensity = 0.7;
  const milk = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.25, transparent: true, opacity: 0.85, depthWrite: false });
  const milkRun = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.2, transparent: true, opacity: 0.3, depthWrite: false });
  milk.envMap = interiorEnv; milkRun.envMap = interiorEnv;
  // silver gets its own neutral grey room to mirror, so the warm lamplight can't turn it copper
  const pm = new THREE.PMREMGenerator(renderer);
  const neutralEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  const silver = new THREE.MeshStandardMaterial({ color: 0xdfe1e6, metalness: 1, roughness: 0.28, emissive: 0x101113, emissiveIntensity: 0.4 });
  silver.envMap = neutralEnv; silver.envMapIntensity = 0.55;
  // the floor too: the shared lamp-lit env has a brown 'ground' that turned the grey slabs brown
  sanctumFloor.envMap = neutralEnv;
  sanctumFloor.envMapIntensity = 0.45;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc99a3e, metalness: 1, roughness: 0.28 });
  brass.envMap = interiorEnv; brass.envMapIntensity = 1.6;
  const brassOut = new THREE.MeshStandardMaterial({ color: 0xc99a3e, metalness: 1, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf0b545, metalness: 1, roughness: 0.18, emissive: 0x3a2200, emissiveIntensity: 0.35 });
  const crownSteel = new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 1, roughness: 0.25 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a28, metalness: 0.7, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9adb2, metalness: 0.9, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 1 });
  const tarpTeal = new THREE.MeshStandardMaterial({ color: 0x2a8a80, roughness: 0.75, side: THREE.DoubleSide });
  const tarpBlack = new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.7, side: THREE.DoubleSide });
  const tarpBlue = new THREE.MeshStandardMaterial({ color: 0x1f5fb0, roughness: 0.7, side: THREE.DoubleSide });
  const thread = new THREE.MeshStandardMaterial({ color: 0x8e1118, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x200000, emissiveIntensity: 0.3 });
  const threadPink = new THREE.MeshStandardMaterial({ color: 0xd8476e, roughness: 0.8, side: THREE.DoubleSide });
  const threadOld = new THREE.MeshStandardMaterial({ color: 0x6e1a14, roughness: 0.9, side: THREE.DoubleSide });
  const saffron = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7, side: THREE.DoubleSide });
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xb08d55, roughness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.85 });
  const wicker = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.95 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.25, metalness: 0.3 });
  const tank = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const pera = new THREE.MeshStandardMaterial({ color: 0xa8784a, roughness: 0.85 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xa65a35, roughness: 0.9 });
  const banner = new THREE.MeshStandardMaterial({ color: 0xc81e24, roughness: 0.8, side: THREE.DoubleSide });
  const umbYellow = new THREE.MeshStandardMaterial({ color: 0xf2d21b, roughness: 0.7, side: THREE.DoubleSide });
  const umbWhite = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.7, side: THREE.DoubleSide });
  const umbUnder = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.95, side: THREE.BackSide });
  const umbGreen = new THREE.MeshStandardMaterial({ color: 0x2f9a46, roughness: 0.7, side: THREE.DoubleSide });
  const hoardings = [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: hoardingTexture(i), roughness: 0.7 }));
  // Deoghar's pastel distempers: white, pink, mint, sky, butter yellow, peach
  const facades = [facade(0xf6f2ea), facade(0xf3c6cf), facade(0xc9e6d2), facade(0xc8dcf0), facade(0xf5e19a), facade(0xf6cfa8)];
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  // lane shops: a tube-lit back wall (~25-30% grey) and the tube light itself
  const shopBack = new THREE.MeshStandardMaterial({ color: 0x8a857d, roughness: 0.92, emissive: 0x2a2a28 });
  const tube = new THREE.MeshBasicMaterial({ color: 0xf2f7ff });
  const boards = new THREE.MeshStandardMaterial({ map: boardAtlas(), roughness: 0.8, side: THREE.DoubleSide });
  const bannerAtlasMat = new THREE.MeshStandardMaterial({ map: bannerAtlas(), roughness: 0.85, side: THREE.DoubleSide });

  return {
    lime, shikhara, mainShikhara, crimson, redBand, sanctumWall, nicheBack, sanctumFloor, paving, porchFloor, road, roof, townPlaster,
    facades, basalt, lingam, waterFilm, puddle, milk, milkRun, silver, brass, brassOut, gold, crownSteel, iron, steel, dark, tarpTeal, tarpBlack, tarpBlue,
    thread, threadOld, threadPink, saffron, bamboo, wood, wicker, screen, tank, pera, clay, banner, umbYellow, umbWhite, umbGreen, umbUnder, hoardings, glow, shopBack, tube, bannerAtlas: bannerAtlasMat, boards,
    marigold: M.marigold, kumkum: M.kumkum, ash: M.ash,
  };
}

export type VM = ReturnType<typeof vaidyanathMats>;

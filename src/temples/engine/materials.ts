import * as THREE from 'three';

/** Procedural surface textures (no external image files), with matching normal maps. */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Tileable value noise, octaves summed; returns size*size values in 0..1. */
function noiseField(size: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(size * size);
  const r = rng(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const grid = new Float32Array(cells * cells).map(() => r());
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = Math.floor(gy), fy = gy - y0, y1 = (y0 + 1) % cells;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = Math.floor(gx), fx = gx - x0, x1 = (x0 + 1) % cells;
        const sx = fx * fx * (3 - 2 * fx);
        const a = grid[(y0 % cells) * cells + (x0 % cells)], b = grid[(y0 % cells) * cells + x1];
        const c = grid[y1 * cells + (x0 % cells)], d = grid[y1 * cells + x1];
        out[y * size + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

interface Painted {
  color: HTMLCanvasElement;
  height: Float32Array;
  size: number;
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function normalFromHeight(h: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function paint(size: number, fn: (x: number, y: number, i: number) => [number, number, number, number]): Painted {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const [r, gg, b, h] = fn(x, y, i);
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
      height[i] = h;
    }
  }
  g.putImageData(img, 0, 0);
  return { color: c, height, size };
}

function material(p: Painted, repeat: [number, number], normalStrength: number, params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({
    map: toTexture(p.color, true, repeat),
    normalMap: toTexture(normalFromHeight(p.height, p.size, normalStrength), false, repeat),
    ...params,
  });
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Stone blocks laid in courses: `rows` courses per tile, joints darker and recessed. */
function stone(seed: number, base: [number, number, number], vary: number, rows: number, streaks: number) {
  const size = 512;
  const n = noiseField(size, seed, 6, 4);
  const fine = noiseField(size, seed + 7, 3, 32);
  const streak = noiseField(size, seed + 13, 4, 2);
  const blockH = size / rows;
  return paint(size, (x, y, i) => {
    const row = Math.floor(y / blockH);
    const blockW = blockH * (row % 2 ? 2.2 : 1.7);
    const off = (row * 0.37 * size) % blockW;
    const jx = (x + off) % blockW, jy = y % blockH;
    const joint = Math.min(jx, blockW - jx, jy, blockH - jy) < 2.2 ? 1 : 0;
    const blockTone = (Math.sin(row * 12.9898 + Math.floor((x + off) / blockW) * 78.233) * 43758.5453) % 1;
    const s = streaks * Math.max(0, streak[(y % 64) * size + x] - 0.45) * (y / size);
    const t = n[i] * 0.7 + fine[i] * 0.3 + Math.abs(blockTone) * 0.25;
    const k = (1 + (t - 0.5) * vary) * (joint ? 0.62 : 1) * (1 - s * 1.4);
    return [base[0] * k, base[1] * k, base[2] * k, joint ? 0 : 0.6 + fine[i] * 0.4];
  });
}

export function buildMaterials() {
  // peach sandstone of the shikhara (freshly painted/limewashed)
  const sand = stone(1, [232, 170, 128], 0.3, 8, 0.4);
  // dark weathered stone of the lower storeys
  const basalt = stone(2, [96, 86, 78], 0.45, 6, 1.2);
  // cream plaster of side shrines and chhatris
  const plaster = stone(3, [218, 208, 192], 0.12, 4, 0.3);

  // courtyard: red sandstone tiles with cream square inlays, as in the real complex
  const paving = paint(512, (x, y, i) => {
    void i;
    const cell = 128, gx = x % cell, gy = y % cell;
    const joint = gx < 2 || gy < 2 ? 1 : 0;
    const cx = Math.abs(gx - 64), cy = Math.abs(gy - 64);
    const inlay = Math.max(cx, cy) < 30 && Math.max(cx, cy) > 18 ? 1 : 0;
    const tone = 0.9 + ((Math.sin(Math.floor(x / cell) * 91.7 + Math.floor(y / cell) * 47.3) * 9999) % 1) * 0.1;
    const base = inlay ? [228, 208, 170] : [148, 58, 44];
    const k = joint ? 0.55 : tone;
    return [base[0] * k, base[1] * k, base[2] * k, joint ? 0 : 1];
  });
  const payFine = noiseField(512, 9, 4, 16);
  for (let i = 0; i < paving.height.length; i++) paving.height[i] = paving.height[i] * 0.8 + payFine[i] * 0.2;

  const marbleN = noiseField(512, 11, 6, 3);
  const marble = paint(512, (x, y, i) => {
    const v = Math.abs(Math.sin((x * 0.02 + y * 0.013) + marbleN[i] * 9));
    const vein = Math.pow(1 - v, 18);
    const k = 1 - vein * 0.35;
    return [238 * k, 234 * k, 228 * k, 0.5];
  });

  // silver repoussé: embossed lotus rosettes
  const silver = paint(256, (x, y) => {
    const u = (x % 64) - 32, v = (y % 64) - 32;
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    const petal = Math.max(0, Math.cos(a * 8)) * Math.max(0, 1 - Math.abs(r - 16) / 10);
    const ring = Math.max(0, 1 - Math.abs(r - 27) / 2);
    const h = petal * 0.8 + ring * 0.6 + (r < 5 ? 1 : 0);
    return [215, 216, 222, h];
  });

  return {
    sandstone: material(sand, [1, 1], 2.2, { roughness: 0.82, color: 0xffffff }),
    kundStone: material(sand, [1, 1], 2.2, { roughness: 0.82, color: 0xffffff }),
    basalt: material(basalt, [1, 1], 2.6, { roughness: 0.9 }),
    plaster: material(plaster, [1, 1], 1.2, { roughness: 0.88 }),
    paving: material(paving, [1, 1], 1.5, { roughness: 0.62 }),
    marble: material(marble, [1, 1], 0.6, { roughness: 0.18 }),
    silver: material(silver, [1 / 0.45, 1 / 0.45], 5, { metalness: 1, roughness: 0.34, color: 0xc9cad0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9923a, metalness: 1, roughness: 0.3 }),
    oldSilver: new THREE.MeshStandardMaterial({ color: 0x9c9ea6, metalness: 1, roughness: 0.52 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2b441, metalness: 1, roughness: 0.2, emissive: 0x3a2200, emissiveIntensity: 0.4 }),
    lingam: new THREE.MeshPhysicalMaterial({ color: 0x151414, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    saffron: new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7, side: THREE.DoubleSide }),
    // deep saturated orange: AgX tone mapping desaturates bright warm colours toward cream
    marigold: new THREE.MeshStandardMaterial({ color: 0xe8600a, roughness: 0.75, emissive: 0x2a0800, emissiveIntensity: 0.25 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 1 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x1f4a44, roughness: 0.06, metalness: 0.1, clearcoat: 1 }),
    ash: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 1 }),
    kumkum: new THREE.MeshStandardMaterial({ color: 0xb3122e, roughness: 0.8 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x5a0d14, roughness: 0.95 }),
  };
}

export type Materials = ReturnType<typeof buildMaterials>;

/** Tileable normal map for rippling water. */
export function waterNormals(): THREE.Texture {
  const size = 256;
  const h = noiseField(size, 21, 5, 8);
  const t = new THREE.CanvasTexture(normalFromHeight(h, size, 6));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Planar-projected UVs in metres, so every material tiles at its real physical size
 * (textures set their own repeat = 1 / tile size in metres).
 */
export function worldUV(geo: THREE.BufferGeometry, _legacyTile?: number): THREE.BufferGeometry {
  const metresPerTile = 1;
  geo.computeBoundingBox();
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / metresPerTile;
    uv[i * 2 + 1] = v / metresPerTile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export { mix };

// ---------- scanned materials (Poly Haven, CC0) ----------

interface Scan {
  id: string;
  /** physical size of one texture tile, metres */
  size: number;
  tint?: number;
  normalScale?: number;
}

const SCANS: Record<'sandstone' | 'kundStone' | 'basalt' | 'paving' | 'marble' | 'plaster' | 'bark', Scan> = {
  sandstone: { id: 'sandstone_blocks_08', size: 2.2, tint: 0xff9a52, normalScale: 1.2 }, // saffron-painted, as today
  kundStone: { id: 'sandstone_blocks_08', size: 2.2, tint: 0xf0d6b8, normalScale: 1.0 },
  basalt: { id: 'large_sandstone_blocks_01', size: 2.6, tint: 0x8a8078, normalScale: 1.4 },
  paving: { id: 'red_sandstone_pavement', size: 2.4, tint: 0xd8674c, normalScale: 0.9 },
  marble: { id: 'marble_01', size: 2.0 },
  plaster: { id: 'painted_plaster_wall', size: 2.5, tint: 0xf1e6d6 },
  bark: { id: 'bark_brown_02', size: 1.5 },
};

/**
 * Swap the procedural stand-ins for scanned PBR maps (diffuse, OpenGL normal,
 * packed AO/roughness/metalness). Resolves once every texture has loaded.
 */
export async function applyScans(M: Materials, renderer: THREE.WebGLRenderer, base = 'assets/tex/') {
  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const load = (url: string, srgb: boolean, rep: number) =>
    loader.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  await Promise.all(Object.entries(SCANS).map(async ([key, scan]) => {
    const rep = 1 / scan.size;
    const [map, normalMap, arm] = await Promise.all([
      load(`${base}${scan.id}_diff.webp`, true, rep),
      load(`${base}${scan.id}_nor.webp`, false, rep),
      load(`${base}${scan.id}_arm.webp`, false, rep),
    ]);
    const m = M[key as keyof typeof SCANS] as THREE.MeshStandardMaterial;
    m.map = map;
    m.normalMap = normalMap;
    m.normalScale.setScalar(scan.normalScale ?? 1);
    m.aoMap = arm;
    m.aoMapIntensity = 0.9;
    m.roughnessMap = arm;
    m.metalnessMap = arm;
    m.roughness = 1;
    m.metalness = 1; // scaled by the (black) metal channel of the arm map
    m.color.set(scan.tint ?? 0xffffff);
    m.needsUpdate = true;
  }));
  addGrime(M.basalt);
  addStreaks(M.sandstone);
  addGrime(M.plaster);
  addInlay(M.paving);
}

/** Darken the bottom of walls where rain splash and hands weather the stone. */
function addGrime(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float grime = 1.0 - 0.28 * (1.0 - smoothstep(0.0, 1.4, vWorldY)) * step(-0.5, vWorldY);
        diffuseColor.rgb *= grime;`);
  };
  m.needsUpdate = true;
}

/** Rain streaks and soot running down the spire: thin vertical bands of darker stone. */
function addStreaks(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorld;
        float h1(float n) { return fract(sin(n) * 43758.5453); }
        float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float a = atan(vWorld.z, vWorld.x) * 40.0 + (vWorld.x + vWorld.z) * 3.0;
        float streak = smoothstep(0.55, 0.95, n1(a)) * (0.6 + 0.4 * n1(vWorld.y * 0.35 + a));
        float soot = smoothstep(18.0, 30.0, vWorld.y) * 0.18;
        diffuseColor.rgb *= 1.0 - streak * 0.32 - soot;`);
  };
  m.needsUpdate = true;
}

/** The courtyard's cream stone inlays: a square ring in every 1.2 m tile. */
function addInlay(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMetres;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMetres = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMetres;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 cell = abs(fract(vMetres / 1.6) - 0.5) * 1.6;
        float d = max(cell.x, cell.y);
        float ring = smoothstep(0.33, 0.32, d) * smoothstep(0.22, 0.23, d);
        float joint = smoothstep(0.785, 0.8, d);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.68, 0.52) * (0.45 + lum * 0.9), ring * 0.9);
        diffuseColor.rgb *= 1.0 - joint * 0.45;`);
  };
  m.needsUpdate = true;
}

/**
 * A scanned PBR material for one site's own use. Download the maps first, e.g.
 *   curl "https://api.polyhaven.com/files/<id>" → Diffuse/nor_gl/arm 2k jpg URLs
 * saved as public/assets/tex/<id>_diff.webp, <id>_nor.webp, <id>_arm.webp.
 * Returns the material at once (procedural fallback colour) plus a promise that
 * resolves when the textures are in — push that promise to ctx.pending.
 */
export function scanMaterial(
  id: string, sizeMetres: number,
  opts: { tint?: THREE.ColorRepresentation; normalScale?: number; roughness?: number } = {},
): { material: THREE.MeshStandardMaterial; loaded: Promise<void> } {
  const material = new THREE.MeshStandardMaterial({ color: opts.tint ?? 0xbbbbbb, roughness: opts.roughness ?? 0.85 });
  const loader = new THREE.TextureLoader();
  const rep = 1 / sizeMetres;
  const load = (suffix: string, srgb: boolean) =>
    loader.loadAsync(`assets/tex/${id}_${suffix}.webp`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  const loaded = Promise.all([load('diff', true), load('nor', false), load('arm', false)]).then(([map, nor, arm]) => {
    material.map = map;
    material.normalMap = nor;
    material.normalScale.setScalar(opts.normalScale ?? 1);
    material.aoMap = arm;
    material.roughnessMap = arm;
    material.metalnessMap = arm;
    material.roughness = 1;
    material.metalness = 1;
    material.color.set(opts.tint ?? 0xffffff);
    material.needsUpdate = true;
  });
  return { material, loaded };
}

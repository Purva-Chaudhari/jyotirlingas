import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import {
  wallRelief, plinthRelief, elephantRelief, nicheRelief, jaliRelief, lataRelief, parapetRelief, pillarRelief, type Relief,
} from './carve';

/**
 * Grishneshwar's palette, from the photographs:
 *  - the red-brown (rust to purple-brown) basalt of Ahilyabai Holkar's temple — plinth, walls, mandapa;
 *  - a dark grey-brown elephant course, then the salmon-pink painted band of deity niches with cream frames;
 *  - the cream / buff lime-stuccoed shikhara with its miniature shrines, creeper spine and fluted dome;
 *  - grey basalt flags in the courtyard; the orange lime-washed compound wall;
 *  - a dark, wet lingam in a black-stone jalahari inside a brass railing.
 * Scans: Poly Haven (CC0) concrete_wall_006 (stone grain), clay_plaster, large_floor_tiles_02.
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

/**
 * Sindoor paste: unlit, with the lamplight baked into its vertex colours (sanctum.ts). Lit through the
 * PBR path, the matte orange picked up a neutral sheen and the AgX curve turned it salmon-pink; baked,
 * it stays the deep orange of the darshan photographs.
 */
function sindoorMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
}

/** granular stone normal map (pitted, grainy basalt), tiled at ≈0.25 m via world-metre UVs */
let granularTex: THREE.CanvasTexture | null = null;
function granular() {
  if (granularTex) return granularTex;
  const N = 256, h = new Float32Array(N * N);
  let sd = 5;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < h.length; i++) h[i] = r() * 0.5;
  for (let k = 0; k < 900; k++) { // pits and grains
    const cx = r() * N, cy = r() * N, rad = 1 + r() * 3.5, dep = (r() - 0.6) * 1.6;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y) / rad;
      if (d < 1) h[((Math.floor(cy + y) % N + N) % N) * N + ((Math.floor(cx + x) % N + N) % N)] += dep * (1 - d * d);
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!, img = g.createImageData(N, N);
  const at = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.5, dy = (at(x, y + 1) - at(x, y - 1)) * 1.5, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  granularTex = new THREE.CanvasTexture(c);
  granularTex.wrapS = granularTex.wrapT = THREE.RepeatWrapping;
  granularTex.repeat.set(4, 4);
  return granularTex;
}

/**
 * Ashlar coursing for the garbhagriha: a height map of dressed blocks (1.1 × 0.54 m, courses offset
 * by half a block) with chamfered arrises and 2 cm sunk joints, as a normal map plus an albedo map that
 * darkens the joints and varies each block's tone. One tile = 2.2 × 1.08 m (world-metre UVs).
 */
let blockTex: { normal: THREE.CanvasTexture; color: THREE.CanvasTexture } | null = null;
function blocks() {
  if (blockTex) return blockTex;
  const W = 512, H = 256, h = new Float32Array(W * H), tone = new Float32Array(W * H);
  let sd = 11;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const bw = 256, bh = 128, j = 4, ch = 7;
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col < 3; col++) {
      const x0 = col * bw + (row ? bw / 2 : 0), y0 = row * bh, t = 0.86 + r() * 0.26;
      for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
        const xx = ((x % W) + W) % W, i = y * W + xx;
        const e = Math.min(x - x0, x0 + bw - 1 - x, y - y0, y0 + bh - 1 - y);
        h[i] = e < j ? 0 : e < j + ch ? (e - j) / ch : 1;
        tone[i] = e < j ? 0.55 : t;
      }
    }
  }
  for (let i = 0; i < h.length; i++) { const n = r(); h[i] += (n - 0.5) * 0.08; tone[i] *= 0.94 + n * 0.1; }
  const mk = (fn: (x: number, y: number, i: number) => [number, number, number]) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!, img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, [a, b, cc] = fn(x, y, i);
      img.data[i * 4] = a; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = cc; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 2.2, 1 / 1.08);
    return t;
  };
  const at = (x: number, y: number) => h[(((y % H) + H) % H) * W + (((x % W) + W) % W)];
  const normal = mk((x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
  const color = mk((_x, _y, i) => { const v = Math.min(255, tone[i] * 200); return [v, v, v]; });
  color.colorSpace = THREE.SRGBColorSpace;
  blockTex = { normal, color };
  return blockTex;
}

/**
 * The court's basalt flagstones: irregular courses of rectangular flags (0.4–1.2 m) with per-flag tone,
 * joints, chipped arrises; tile = 4 × 4 m. Albedo + normal from the same layout.
 */
let flagTex: { normal: THREE.CanvasTexture; color: THREE.CanvasTexture } | null = null;
function flags() {
  if (flagTex) return flagTex;
  const N = 512, h = new Float32Array(N * N), tone = new Float32Array(N * N).fill(0.5);
  let sd = 29;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const px = N / 4; // pixels per metre
  for (let y = 0; y < N;) {
    const rh = Math.round((0.45 + r() * 0.35) * px);
    const yh = Math.min(rh, N - y);
    for (let x = Math.floor(r() * px); x < N + px;) {
      const w = Math.round((0.5 + r() * 0.7) * px), t = 0.9 + r() * 0.16 + (r() < 0.08 ? -0.1 : 0);
      for (let yy = y; yy < y + yh; yy++) for (let xx = x; xx < x + w; xx++) {
        const i = yy * N + (xx % N), e = Math.min(xx - x, x + w - 1 - xx, yy - y, y + yh - 1 - yy);
        h[i] = e < 2 ? 0 : e < 5 ? (e - 2) / 3 : 1;
        tone[i] = e < 2 ? 0.72 : t;
      }
      x += w;
    }
    y += yh;
  }
  for (let i = 0; i < h.length; i++) { const n = r(); h[i] += (n - 0.5) * 0.1; tone[i] *= 0.92 + n * 0.14; }
  const mk = (fn: (x: number, y: number, i: number) => [number, number, number]) => {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d')!, img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, [a, b, cc] = fn(x, y, i);
      img.data[i * 4] = a; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = cc; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 4, 1 / 4);
    t.anisotropy = 8;
    return t;
  };
  const at = (x: number, y: number) => h[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const normal = mk((x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.6, dy = (at(x, y + 1) - at(x, y - 1)) * 1.6, l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
  const color = mk((_x, _y, i) => { const v = Math.min(255, tone[i] * 215); return [v, v, v * 0.98]; });
  color.colorSpace = THREE.SRGBColorSpace;
  flagTex = { normal, color };
  return flagTex;
}

/** court paving: flagstones, plus large-scale wear — darker trodden lanes, oil-lamp and water stains */
function courtPavingMaterial() {
  const f = flags();
  const m = new THREE.MeshStandardMaterial({ color: 0x9a958e, roughness: 0.82, map: f.color, normalMap: f.normal });
  m.normalScale.setScalar(0.7);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPW;
        float ph(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(ph(i), ph(i + vec2(1, 0)), f.x), mix(ph(i + vec2(0, 1)), ph(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 q = vPW.xz;
        float blot = pn(q * 0.13) * 0.6 + pn(q * 0.5) * 0.3 + pn(q * 2.1) * 0.1;
        diffuseColor.rgb *= 0.82 + 0.3 * blot;
        // trodden, polished lanes: east gate to the steps, and the south gate to the queue shed
        float lane = max(1.0 - smoothstep(1.5, 4.0, abs(q.x)) * step(22.0, q.y), (1.0 - smoothstep(1.5, 3.5, abs(q.y - 17.0))) * step(q.x, -11.0));
        diffuseColor.rgb *= 1.0 - 0.12 * lane;
        // dark damp/oil stains here and there
        diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.72, 0.85, pn(q * 0.35 + 9.0));`);
  };
  m.customProgramCacheKey = () => 'grish-court-paving';
  return m;
}

/** village ground: large-scale patches of dry earth, grass and trodden dirt (world-space noise) */
function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvEW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vEW;
        float eh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float en(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(eh(i), eh(i + vec2(1, 0)), f.x), mix(eh(i + vec2(0, 1)), eh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 q = vEW.xz;
        float n = en(q * 0.02) * 0.55 + en(q * 0.09) * 0.3 + en(q * 0.6) * 0.15;
        float fields = step(0.5, en(floor(q / 38.0) + 3.0));
        vec3 grass = vec3(0.16, 0.2, 0.09), dirt = vec3(0.3, 0.24, 0.16), dry = vec3(0.36, 0.33, 0.22);
        vec3 c = mix(dirt, grass, smoothstep(0.35, 0.65, n));
        c = mix(c, dry, fields * 0.45 * smoothstep(0.3, 0.7, en(q * 0.05 + 7.0)));
        diffuseColor.rgb *= c * (0.85 + 0.3 * en(q * 2.3));`);
  };
  m.customProgramCacheKey = () => 'grish-ground';
  return m;
}

/** pierced brass filigree: scrolls and quatrefoils cut from sheet, as on the Grishneshwar kathada */
function filigreeMaterial(env: THREE.Texture) {
  const W = 128, H = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.lineWidth = 5;
  for (const cx of [W * 0.25, W * 0.75]) {
    g.beginPath(); g.ellipse(cx, H / 2, 22, 30, 0, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      g.beginPath(); g.arc(cx + Math.cos(a) * 11, H / 2 + Math.sin(a) * 14, 8, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath(); g.arc(cx, H / 2, 4, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.moveTo(W / 2, 6); g.bezierCurveTo(W / 2 + 14, H / 3, W / 2 - 14, H * 0.66, W / 2, H - 6); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    color: 0xd9a548, metalness: 1, roughness: 0.3, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide,
    envMap: env, envMapIntensity: 3.0, emissive: 0x5a3a00, emissiveIntensity: 0.45,
  });
}

export function grishMaterials(M: Materials, renderer: THREE.WebGLRenderer, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  /**
   * A scanned stone (or plaster): the scan's normal + roughness, and its diffuse used only as GRAIN
   * (normalised to mean ≈ 1 in the shader), so that `tint` is the real albedo of the stone.
   */
  const scan = (id: string, size: number, tint: number, o: { normalScale?: number; rough?: number; grime?: number; key?: string } = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 });
    pending.push(loadScan(id, size, aniso).then(([map, nor, arm]) => {
      m.userData.grain = map;
      m.normalMap = nor;
      m.normalScale.setScalar(o.normalScale ?? 1);
      m.aoMap = arm;
      m.aoMapIntensity = 0.7;
      m.roughnessMap = arm;
      m.roughness = o.rough ?? 1;
      m.metalness = 0;
      m.needsUpdate = true;
    }));
    weatherGrain(m, o.grime ?? 0, o.key ?? id, 1 / size);
    return m;
  };

  /**
   * Carved stone: the scan's diffuse for grain × the relief's shading, the relief's normal + AO.
   * The relief tiles at (tw × th) metres and starts at world height y0 (so courses sit at their real heights).
   */
  const carved = (relief: Relief, tw: number, th: number, y0: number, tint: number,
    o: { normalScale?: number; grime?: number; painted?: boolean; rough?: number; key: string; scanId?: string; scanSize?: number }) => {
    const pin = (t: THREE.Texture) => {
      const c = t.clone();
      c.repeat.set(1 / tw, 1 / th);
      c.offset.set(0, -y0 / th);
      c.needsUpdate = true;
      return c;
    };
    const m = new THREE.MeshStandardMaterial({
      color: tint, roughness: o.rough ?? 0.9,
      normalMap: pin(relief.normal), aoMap: pin(relief.ao), aoMapIntensity: 1,
      normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    });
    // the relief's shading is the map; the scan's grain is multiplied in by the shader (own tiling)
    m.map = pin(relief.color);
    if (!o.painted) {
      pending.push(loadScan(o.scanId ?? 'concrete_wall_006', o.scanSize ?? 2.4, aniso).then(([grain]) => {
        m.userData.grain = grain;
        m.needsUpdate = true;
      }));
    }
    weatherGrain(m, o.grime ?? 0.2, o.key, 1 / (o.scanSize ?? 2.4));
    return m;
  };

  /** weathering + scan grain multiplied in (grain texture is attached when loaded) */
  function weatherGrain(m: THREE.MeshStandardMaterial, amount: number, key: string, rep: number) {
    const grainUniform = { value: null as THREE.Texture | null };
    const repUniform = { value: rep }, amtUniform = { value: amount };
    m.onBeforeCompile = (sh) => {
      grainUniform.value = (m.userData.grain as THREE.Texture | undefined) ?? null;
      sh.uniforms.grainMap = grainUniform;
      sh.uniforms.grainRep = repUniform;
      sh.uniforms.grainAmt = amtUniform;
      sh.defines = sh.defines ?? {};
      if (grainUniform.value) sh.defines.USE_GRAIN = '';
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying vec2 vGUv;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvGUv = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vGW;
          varying vec2 vGUv;
          uniform sampler2D grainMap;
          uniform float grainRep;
          uniform float grainAmt;
          float gh(float n) { return fract(sin(n) * 43758.5453); }
          float gn(float x) { float i = floor(x), f = fract(x); return mix(gh(i), gh(i + 1.0), f * f * (3.0 - 2.0 * f)); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_GRAIN
            vec3 gTex = texture2D(grainMap, vGUv * grainRep).rgb;
            diffuseColor.rgb *= gTex / max(0.25, dot(gTex, vec3(0.3333)) ) * 0.9;
          #endif
          float gStreak = smoothstep(0.62, 0.95, gn((vGW.x + vGW.z) * 2.1)) * (0.5 + 0.5 * gn(vGW.y * 0.37 + vGW.x));
          float gFoot = (1.0 - smoothstep(0.0, 1.0, vGW.y)) * step(-0.3, vGW.y) * 0.5;
          diffuseColor.rgb *= 1.0 - grainAmt * (gStreak * 0.55 + gFoot);
          vec2 gCell = floor(vec2((vGW.x + vGW.z * 0.91) / 1.1, vGW.y / 0.54));
          float gr = gh(gCell.x * 17.31 + gCell.y * 131.7), gg = gh(gCell.x * 3.17 + gCell.y * 71.3);
          diffuseColor.rgb *= mix(vec3(1.03, 0.97, 0.96), vec3(0.95, 0.97, 1.0), gr) * (0.93 + 0.1 * gg);
          float gp = gn((vGW.x - vGW.z) * 0.11) * gn(vGW.y * 0.17 + vGW.x * 0.05);
          diffuseColor.rgb *= 1.0 - 0.12 * gp;
          // dark rain streaks running down from under the eaves and cornices
          float gStr = smoothstep(0.45, 0.9, gn((vGW.x + vGW.z) * 5.3)) * smoothstep(0.3, 0.9, gn((vGW.x - vGW.z) * 1.7));
          float gU1 = step(1.5, vGW.y) * step(vGW.y, 6.9) * smoothstep(3.6, 6.9, vGW.y);
          float gU2 = step(11.0, vGW.y) * smoothstep(11.0, 19.0, vGW.y);
          diffuseColor.rgb *= 1.0 - grainAmt * 1.6 * gStr * (gU1 + gU2 * 0.8);`);
    };
    void key;
    m.customProgramCacheKey = () => `grish-stone-${m.userData.grain ? 1 : 0}`;
  }

  /** dressed ashlar (sanctum walls, ceiling, floor): block normal + per-block tone, scan grain on top */
  const ashlar = (tint: number, rough: number, rep: [number, number] | null, env: number, key: string) => {
    const b = blocks();
    const pin = (t: THREE.Texture) => { if (!rep) return t; const c = t.clone(); c.repeat.set(1 / rep[0], 1 / rep[1]); c.needsUpdate = true; return c; };
    const m = new THREE.MeshStandardMaterial({ color: tint, roughness: rough, map: pin(b.color), normalMap: pin(b.normal), envMap: interiorEnv, envMapIntensity: env });
    m.normalScale.setScalar(1.4);
    pending.push(loadScan('concrete_wall_006', 2.4, aniso).then(([grain]) => { m.userData.grain = grain; m.needsUpdate = true; }));
    weatherGrain(m, 0.0, key, 1 / 2.4);
    return m;
  };

  /** sky light reaching a surface under a roof is much weaker: scale its image-based lighting */
  const dim = (m: THREE.MeshStandardMaterial, k: number) => { m.envMapIntensity = k; return m; };

  const WR = wallRelief(), PR = plinthRelief(), ER = elephantRelief(), JR = jaliRelief(), LR = lataRelief();
  const KR = parapetRelief(), PiR = pillarRelief();
  const NR = [nicheRelief(0, false)];

  const RED = 0xa8705c, RED_DK = 0x86584a, CREAM = 0xeee2cc; // rose-red basalt in daylight (photos 14_, n_g1)

  const lingam = new THREE.MeshPhysicalMaterial({
    // worn-smooth black stone, wet with abhishek water (review P0-1: albedo 0x1d1c1e, roughness 0.35)
    color: 0x1d1c1e, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, envMap: interiorEnv, envMapIntensity: 1.0,
    normalMap: granular(), normalScale: new THREE.Vector2(0.25, 0.25),
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd9a548, metalness: 1, roughness: 0.28, envMap: interiorEnv, envMapIntensity: 2.4, emissive: 0x3a2400, emissiveIntensity: 0.25,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: 0xe8e8ec, metalness: 1, roughness: 0.22, envMap: interiorEnv, envMapIntensity: 2.6, emissive: 0x403c38, emissiveIntensity: 0.3,
  });

  return {
    /** red jangha of the garbhagriha, carved courses pinned to y 1.5 → 7.0 */
    wall: carved(WR, 2.0, 5.5, 1.5, RED, { key: 'wall', grime: 0.22, normalScale: 1.2 }),
    /** stepped plinth courses (y 0 → 1.5) */
    plinth: carved(PR, 1.2, 1.5, 0, RED_DK, { key: 'plinth', grime: 0.3, normalScale: 1.2 }),
    /** gajathara (y 7.2 → 8.4) */
    elephant: carved(ER, 1.2, 1.2, 7.2, 0xa08074, { key: 'eleph', grime: 0.3, normalScale: 1.3 }),
    /** painted niche band (y 8.4 → 10.6), three figure variants */
    niche: NR.map((r, i) => carved(r, 1.0, 2.2, 8.4, 0xd0bab0, { key: `niche${i}`, painted: true, grime: 0.12, normalScale: 1.3 })),
    /** cream carved kutas of the shikhara */
    kuta: carved(JR, 0.8, 0.8, 0, CREAM, { key: 'kuta', grime: 0.35, normalScale: 1.1 }),
    /** the lower two storeys of kutas: pinker, as in the photographs */
    kutaPink: carved(JR, 0.8, 0.8, 0, 0xe8c4b4, { key: 'kutaP', grime: 0.3, normalScale: 1.1 }),
    /** creeper spine */
    lata: carved(LR, 1.2, 1.2, 0, 0xe8d6bf, { key: 'lata', grime: 0.35, normalScale: 1.3 }),
    /** mandapa seat-back wall (y 1.5 → 2.4) */
    parapet: carved(KR, 0.6, 0.9, 1.5, RED, { key: 'parapet', grime: 0.25, normalScale: 1.2 }),
    /** pillar shafts */
    pillar: carved(PiR, 0.8, 0.8, 0, RED, { key: 'pillar', grime: 0.2, normalScale: 1.0 }),
    /** plain dressed red basalt (beams, slabs, steps, roofs) */
    red: scan('concrete_wall_006', 2.4, 0xa06a58, { grime: 0.25, key: 'red', normalScale: 0.8 }),
    /** darker purple-brown basalt (steps, plinth tops, roofs) */
    redDark: scan('concrete_wall_006', 2.4, 0x7c5244, { grime: 0.3, key: 'redDk', normalScale: 0.8 }),
    /** cream stucco of the shikhara (cornices, core, bulbs) */
    cream: scan('concrete_wall_006', 2.4, 0xd8ccb6, { grime: 0.35, key: 'cream', normalScale: 0.6 }),
    /** smooth cream-grey dome */
    dome: scan('concrete_wall_006', 2.4, 0xc9c0b2, { grime: 0.25, key: 'dome', normalScale: 0.4 }),
    /** the pink-mauve lotus-petal collar under the dome, pink highlights */
    pink: scan('concrete_wall_006', 2.4, 0xc9a090, { grime: 0.15, key: 'pink', normalScale: 0.5 }),
    /** orange sindoor paste with kumkum on the linga's face */
    sindoor: sindoorMaterial(),
    /** soot-darkened stone of the garbhagriha's walls */
    sanctumWall: scan('concrete_wall_006', 2.4, 0x4a3631, { normalScale: 0.8, grime: 0.3, key: 'gwall' }),
    /** the garbhagriha's dark dressed stone: ashlar courses, soot-darkened (P0-2) */
    gStone: ashlar(0x4a3631, 0.8, null, 0.5, 'gstone'),
    /** its corbelled ceiling, blacker with lamp soot */
    gSoot: ashlar(0x2c211d, 0.9, [2.2, 2.2], 0.35, 'gsoot'),
    /** the polished dark floor flags (0.6 m) */
    gFloor: (() => { const m = ashlar(0x3a302c, 0.45, [1.2, 1.2], 0.9, 'gfloor'); m.normalScale.setScalar(0.6); return m; })(),
    /** a marigold rope (vertex-coloured: orange, yellow and white chrysanthemum stretches) */
    garland: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, normalMap: granular(), normalScale: new THREE.Vector2(2.5, 2.5) }),
    /** the kathada's brass: yellower and crisper than the lamp brass, little self-glow */
    railBrass: new THREE.MeshStandardMaterial({ color: 0xe6c070, metalness: 1, roughness: 0.22, envMap: interiorEnv, envMapIntensity: 2.0, emissive: 0x2a2000, emissiveIntensity: 0.2 }),
    /** dark iron (lamp chains) */
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2624, metalness: 0.8, roughness: 0.6 }),
    /** Parvati's green silk in the niche */
    parvatiSaree: new THREE.MeshStandardMaterial({ color: 0x1f6a3a, roughness: 0.5, envMap: interiorEnv, envMapIntensity: 0.8 }),
    /** the cream-white carved figures of the niche band (on the pink 0xc99a8a ground) */
    figure: scan('concrete_wall_006', 2.4, 0xd9c3b5, { grime: 0.2, key: 'figure', normalScale: 0.5 }),
    /** pierced brass filigree panels of the kathada (alpha-tested) */
    filigree: filigreeMaterial(interiorEnv),
    /** the mandapa floor: polished grey-brown stone */
    mandapaFloor: dim(scan('concrete_wall_006', 2.4, 0x6b5f58, { normalScale: 0.4, rough: 0.5, key: 'mfloor' }), 0.6),
    /** mandapa ceilings and beams: dark, sooty, out of the sun */
    ceiling: dim(scan('concrete_wall_006', 2.4, 0x3a2822, { normalScale: 0.6, key: 'ceil' }), 0.25),
    /** the dark weathered basalt of the Shivalaya kund */
    kundStone: scan('concrete_wall_006', 2.4, 0x5a544e, { normalScale: 0.9, grime: 0.45, key: 'kund' }),
    /** alternate treads of the kund: the grey-brown basalt a shade lighter (worn) */
    kundStep: scan('concrete_wall_006', 2.4, 0x6a6058, { normalScale: 0.9, grime: 0.4, key: 'kundStep', rough: 0.55 }),
    /** the Shivalaya shrines' pink-grey stone */
    shrineStone: scan('concrete_wall_006', 2.4, 0x8a7a72, { normalScale: 0.9, grime: 0.45, key: 'shrineSt' }),
    /** their weathered roofs, dark and mossy */
    kundRoof: scan('concrete_wall_006', 2.4, 0x4e4f44, { normalScale: 1.0, grime: 0.5, key: 'kroof' }),
    kundMoss: scan('concrete_wall_006', 2.4, 0x4c5a3a, { normalScale: 1.0, grime: 0.4, key: 'kmoss' }),
    /** the buff lime-plastered boundary wall of the kund */
    kundWall: scan('clay_plaster', 2.0, 0xc9b99c, { normalScale: 0.6, grime: 0.45, key: 'kwall' }),
    /** the kund's red-washed shrines */
    shrineRed: scan('clay_plaster', 2.0, 0x8f5a4a, { normalScale: 0.6, grime: 0.4, key: 'shrineRed' }),
    kundWater: new THREE.MeshStandardMaterial({ color: 0x24361a, roughness: 0.06, metalness: 0.0 }),
    paintYellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.7 }),
    /** grey basalt flagstones of the courtyard */
    paving: scan('large_floor_tiles_02', 3.0, 0x9a8f84, { normalScale: 0.6, rough: 0.9 }),
    courtPaving: courtPavingMaterial(),
    /** the compound wall: orange lime-wash gone patchy, streaked and dirty at the foot (c3) */
    compoundWall: scan('clay_plaster', 1.6, 0xc4623a, { normalScale: 0.9, grime: 0.7, key: 'cwall' }),
    /** the polished steel trishul (n_o4): bright, silvery */
    trishul: new THREE.MeshStandardMaterial({ color: 0xd6dade, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 }),
    /** orange lime-washed compound wall */
    limewash: scan('clay_plaster', 2.0, 0xc8643a, { normalScale: 0.6, grime: 0.25, key: 'lime' }),
    houseBlue: scan('clay_plaster', 2.0, 0x9fb6c2, { normalScale: 0.5, grime: 0.3, key: 'hblue' }),
    housePink: scan('clay_plaster', 2.0, 0xd2a29a, { normalScale: 0.5, grime: 0.3, key: 'hpink' }),
    houseOchre: scan('clay_plaster', 2.0, 0xd0a868, { normalScale: 0.5, grime: 0.3, key: 'hochre' }),
    tank: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.25, metalness: 0.2 }),
    tinRoof: new THREE.MeshStandardMaterial({ color: 0x80878c, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }),
    steelBright: new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.25 }),
    lawn: new THREE.MeshStandardMaterial({ color: 0x4f7a32, roughness: 0.95 }),
    /** village houses: pale lime-wash */
    houseWash: scan('clay_plaster', 2.0, 0xd8d0c2, { normalScale: 0.5, grime: 0.3, key: 'house' }),
    /** sanctum and Nandi black stone */
    blackStone: new THREE.MeshPhysicalMaterial({
      color: 0x262d3c, roughness: 0.82, clearcoat: 0.15, clearcoatRoughness: 0.5, envMap: interiorEnv, envMapIntensity: 0.9,
      normalMap: granular(), normalScale: new THREE.Vector2(1.3, 1.3),
    }),
    /** coconut husk fibre */
    coir: new THREE.MeshStandardMaterial({ color: 0x4a3818, envMapIntensity: 0.15, roughness: 1, normalMap: granular(), normalScale: new THREE.Vector2(2, 2) }),
    note10: new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.8, side: THREE.DoubleSide }),
    note20: new THREE.MeshStandardMaterial({ color: 0x8a8440, roughness: 0.8, side: THREE.DoubleSide }),
    note100: new THREE.MeshStandardMaterial({ color: 0x6e6888, roughness: 0.8, side: THREE.DoubleSide }),
    /** polished black Nandi */
    nandi: new THREE.MeshStandardMaterial({ color: 0x24201e, roughness: 0.55, envMapIntensity: 0.3 }),
    /** Nandi's moulded basalt pedestal */
    nandiBase: dim(scan('concrete_wall_006', 2.4, 0x2c2624, { normalScale: 0.6, rough: 0.6, key: 'nbase' }), 0.4),
    /** wet sanctum floor */
    wetFloor: new THREE.MeshPhysicalMaterial({ color: 0x3e3634, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.45, envMap: interiorEnv, envMapIntensity: 1.2 }),
    lingam,
    brass,
    silver,
    /** gilt kalash under the open sky */
    gold: new THREE.MeshStandardMaterial({ color: 0xf0b44a, metalness: 1, roughness: 0.22, emissive: 0x3a2200, emissiveIntensity: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.4 }),
    saffron: M.saffron,
    ash: new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.95 }),
    kumkum: new THREE.MeshStandardMaterial({ color: 0xc0122a, roughness: 0.7 }),
    /** the magenta silk drape seen behind the lingam in darshan photographs */
    silk: new THREE.MeshStandardMaterial({ color: 0xb0186a, roughness: 0.55, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c130f, roughness: 1 }),
    soot: new THREE.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.7 }),
    tin: new THREE.MeshStandardMaterial({ color: 0x9da3a8, metalness: 0.6, roughness: 0.45 }),
    tarp: new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.9, side: THREE.DoubleSide }),
    sign: new THREE.MeshStandardMaterial({ color: 0xb01e1e, roughness: 0.7 }),
    hill: new THREE.MeshStandardMaterial({ color: 0x5f6b45, roughness: 1, flatShading: false }),
    earth: groundMaterial(),
    grass: new THREE.MeshStandardMaterial({ color: 0x6f7c48, roughness: 1 }),
  };
}

export type GM = ReturnType<typeof grishMaterials>;

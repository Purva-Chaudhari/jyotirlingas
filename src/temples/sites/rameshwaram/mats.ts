import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { scanMaterial } from '../../engine/materials';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Materials for Rameswaram.
 *  - grey granite (outer walls, gopuram bases, inner shrines) and granite flagstone floors
 *  - cream lime-stucco of the gopurams and vimanas (vertex-coloured, weather-streaked)
 *  - enamel-painted corridor pillars (vertex colours) and the blue medallion ceilings (canvas)
 *  - beach sand, street pavers, town plaster, temple gold / silver / brass under lamplight
 */
export function rameshMats(M: Materials, pending: Promise<unknown>[], interiorEnv: THREE.Texture, renderer?: THREE.WebGLRenderer) {
  const scan = (id: string, size: number, tint: number, normalScale = 1) => {
    const s = scanMaterial(id, size, { tint, normalScale });
    pending.push(s.loaded);
    return s.material;
  };
  // big grey granite ashlar of the walls and gopuram bases
  const granite = scan('large_grey_tiles', 3.4, 0xd2cfc8, 0.8);
  weather(granite, 'granite', 0.3, 0.7);
  // dressed, carved granite (pillars, mouldings): no joints
  const carved = scan('concrete_wall_006', 2.4, 0xc4c0b8, 0.9);
  weather(carved, 'carved', 0.25, 0.9);
  // the oil-darkened, polished black granite of the sanctum and mandapams
  const gd = scanMaterial('concrete_wall_006', 2.4, { tint: 0x605b55, normalScale: 0.8 });
  pending.push(gd.loaded.then(() => { gd.material.roughness = 0.45; }));
  const graniteDark = gd.material;
  graniteDark.envMapIntensity = 0.75;
  // granite flagstones: big slabs, lighter outdoors, worn darker and smoother inside
  const floor = scan('large_grey_tiles', 4.2, 0xc9c5bd, 0.7);
  // worn smooth by bare feet and wet from the theertham baths: a lighter, glossier grey
  const fi = scanMaterial('large_grey_tiles', 4.2, { tint: 0xaaa69f, normalScale: 0.6 });
  pending.push(fi.loaded.then(() => { fi.material.roughness = 0.5; }));
  const floorIn = fi.material;
  // the corridor walkway: big worn granite slabs, polished by feet down the middle
  const wk = scanMaterial('large_grey_tiles', 8.5, { tint: 0x66625d, normalScale: 0.5 });
  pending.push(wk.loaded.then(() => { wk.material.roughness = 0.28; wk.material.color.set(0x66625d); }));
  const walkway = wk.material;
  walkway.color.set(0x66625d);
  floorIn.envMapIntensity = 0.5;
  // the corridor platforms (jagati): weathered grey granite, 0x6e675e at the foot rising to 0x9a928a, with
  // black water stains splashed up from the wet walkway and dark streaks down the mouldings
  const jagati = scan('concrete_wall_006', 2.0, 0xd8d0c4, 1.1);
  jagatiWeather(jagati);
  const court = scan('pavement_01', 3.0, 0xd9d1c4, 0.8);
  const sand = scan('aerial_beach_01', 9, 0xf3e4c8, 0.9);
  wetSand(sand);
  // the island's sandy lanes and yards beyond the paved streets
  const dust = scan('aerial_beach_01', 6, 0xc9bda6, 0.7);
  // wet monsoon pavers: darker, with a sheen
  const pv = scanMaterial('brick_pavement_03', 2.4, { tint: 0x8c867f, normalScale: 0.9 });
  pending.push(pv.loaded.then(() => { pv.material.roughness = 0.75; }));
  wetSheen(pv.material);
  const pavers = pv.material;
  const townWall = scan('beige_wall_002', 3.0, 0xffffff, 0.6);
  townWall.vertexColors = true;
  // lime stucco of the gopurams: white scan × vertex colour, with rain streaks and grime
  const stucco = scan('painted_plaster_wall', 2.5, 0xffffff, 1.4);
  stucco.vertexColors = true;
  weather(stucco, 'stucco', 0.1, 1.0);
  // enamel paint of the corridor pillars, beams and plinths: a little sheen, darker indoors
  // (the corridor is dim: the sky reaches it only through the far openings; the tubes do the rest)
  const paint = selfLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, envMapIntensity: 1.0 }), 0.025, 'paint');
  const paintOut = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  // the painted ceilings are lit from below by the tube lights and the floor's bounce: give them that glow
  const ceilTex = ceilingTexture(), sideTex = sideCeilingTexture();
  const ceiling = new THREE.MeshStandardMaterial({ map: ceilTex, emissiveMap: ceilTex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.62, envMapIntensity: 0.4 });
  const sideCeiling = new THREE.MeshStandardMaterial({ map: sideTex, emissiveMap: sideTex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.66, envMapIntensity: 0.35 });
  const tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 16, roughness: 0.4 });
  // the corridor's own dark environment: a dim grey hall with a line of white tubes overhead, so the
  // painted stone does not take the open sky's light (the real corridor is dim, lit in pools)
  const corrEnv = renderer ? corridorEnv(renderer) : interiorEnv;
  // (dim: the tube lights themselves are added analytically per material in corridor.ts `tubeLit`)
  for (const m of [paint, ceiling, sideCeiling, walkway, jagati]) { m.envMap = corrEnv; m.envMapIntensity = 0.32; }
  walkway.envMapIntensity = 0.9; // the polished slabs still mirror the line of tubes
  jagati.envMapIntensity = 1.6;
  // a ghat of dark weathered granite, wet and slick where the sea reaches it
  const gs = scanMaterial('concrete_wall_006', 2.4, { tint: 0x5a5753, normalScale: 0.9 });
  pending.push(gs.loaded.then(() => { gs.material.roughness = 0.42; }));
  const ghatStone = gs.material;
  const gw = scanMaterial('concrete_wall_006', 2.4, { tint: 0x3a3936, normalScale: 0.8 });
  pending.push(gw.loaded.then(() => { gw.material.roughness = 0.18; }));
  const ghatWet = gw.material;
  const shade = new THREE.MeshStandardMaterial({ color: 0x0e0b09, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.75 });
  // the gopuram kalashas: dark weathered bronze/copper (they read almost black-brown against the sky)
  const copper = new THREE.MeshStandardMaterial({ color: 0x5a3d2a, metalness: 0.6, roughness: 0.5 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x5b5752, roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.92 });
  // the temple's roof slabs are painted red oxide (official 2023 aerial)
  const roofRed = new THREE.MeshStandardMaterial({ color: 0xbe3c2d, roughness: 0.85 });
  // the red-oxide floors round the theertham wells, always wet
  // (r3) a textured red-oxide floor worn to grey along the traffic lines, with standing puddles
  const wr = scanMaterial('concrete_wall_006', 1.6, { tint: 0xffffff, normalScale: 0.7 });
  pending.push(wr.loaded);
  const wetRed = wr.material;
  wellFloor(wetRed);
  // whitewashed granite kerbs of the wells, grimy at the foot
  const kerb = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.85 });
  weather(kerb, 'kerb', 0.3, 1.4);
  const steel = new THREE.MeshStandardMaterial({ color: 0xb7bbbf, metalness: 0.85, roughness: 0.35 });
  const redPaint = new THREE.MeshStandardMaterial({ color: 0xb2271b, roughness: 0.6 });
  const whitePaint = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 });
  const maroon = new THREE.MeshStandardMaterial({ color: 0x6e1e22, roughness: 0.55 });
  const grill = grillMaterial();
  // saffron silk of the alankaram: a sheen on the folds
  const cloth = new THREE.MeshPhysicalMaterial({ color: 0xe0701a, roughness: 0.5, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffb35a), side: THREE.DoubleSide });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4d7a2c, roughness: 0.85, side: THREE.DoubleSide });
  const bark = new THREE.MeshStandardMaterial({ color: 0x7b6650, roughness: 1 });
  const wellWater = new THREE.MeshStandardMaterial({ color: 0x18302a, roughness: 0.06, metalness: 0.2 });
  const hull = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const signs = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7 });
  const boards = new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.75, envMapIntensity: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3a, emissiveIntensity: 2.2 });

  const env = (m: THREE.MeshStandardMaterial, k = 1.8) => { m.envMap = interiorEnv; m.envMapIntensity = k; return m; };
  // lamplit gold: yellower than the warm environment would make it, and a little emissive glow
  // (the warm lamp environment turns metals coppery; keep its reflections faint and let the gold's own
  // yellow show, as it does in photographs of the alankaram)
  const gold = env(M.gold.clone(), 0.7);
  gold.color.set(0xffd84a);
  gold.roughness = 0.3;
  gold.emissive.set(0x8a6a10);
  gold.emissiveIntensity = 0.7;
  const goldOut = M.gold.clone();
  // silver keeps the neutral scene environment (the warm lamp PMREM turns it copper)
  const roomEnv = neutralEnv(renderer);
  // plain polished silver (the engine's silver carries a rosette repoussé map that tiled like bathroom
  // tiles over the avudaiyar); its mouldings and one repoussé border are modelled in sanctum.ts
  const silver = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.24 });
  silver.envMap = roomEnv;
  silver.envMapIntensity = 0.9;
  silver.emissive = new THREE.Color(0x1c1c20);
  // brass: pale yellow metal under a neutral studio environment (as at Nageshwar) — the warm lamp
  // environment and a deep base colour had turned every lamp and bowl copper-orange
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.35 });
  brass.envMap = roomEnv ?? interiorEnv;
  brass.envMapIntensity = 1.0;
  const lingamStone = env(new THREE.MeshPhysicalMaterial({ color: 0x1a1918, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), 1.4);

  return {
    granite, carved, graniteDark, floor, floorIn, walkway, jagati, ghatStone, ghatWet, court, sand, dust, pavers, townWall, stucco, paint, paintOut, ceiling, sideCeiling,
    tube, shade, wood, copper, asphalt, concrete, roofRed, wetRed, kerb, steel, redPaint, whitePaint, maroon, grill, cloth, leaf, bark, wellWater,
    hull, signs, boards, glow, gold, goldOut, silver, brass, lingamStone,
    ash: M.ash, kumkum: M.kumkum, marigold: M.marigold, saffron: M.saffron,
  };
}

export type RM = ReturnType<typeof rameshMats>;

/**
 * Sea-air weathering: dark rain streaks running down from every cornice, a grimy foot, mottling.
 * `amt` scales the effect; `scale` the streak frequency.
 */
function weather(m: THREE.MeshStandardMaterial, key: string, amt: number, scale: number) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWW;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWW;
        varying vec3 vWN;
        float wh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float wn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float side = 1.0 - abs(vWN.y);
          float a = (vWW.x + vWW.z) * ${(3.1 * scale).toFixed(2)};
          float streak = smoothstep(0.58, 0.95, wn(vec3(a, vWW.y * 0.12, 0.0))) * (0.5 + 0.5 * wn(vec3(a * 0.5, vWW.y * 0.7, 3.0)));
          float mottle = wn(vWW * 0.6) * 0.6 + wn(vWW * 2.3) * 0.4;
          float foot = 1.0 - smoothstep(0.0, 1.6, vWW.y);
          float k = 1.0 - ${amt.toFixed(2)} * (streak * side * 1.3 + (mottle - 0.5) * 0.7 + foot * 0.9);
          diffuseColor.rgb *= clamp(k, 0.45, 1.15);
        }`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-' + key;
}

/** The corridor platforms: darker and water-stained toward the walkway floor, streaked down the faces. */
function jagatiWeather(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vJW;\nvarying vec3 vJN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvJW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvJN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vJW;
        varying vec3 vJN;
        float jh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float jn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(jh(i), jh(i + vec3(1,0,0)), f.x), mix(jh(i + vec3(0,1,0)), jh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(jh(i + vec3(0,0,1)), jh(i + vec3(1,0,1)), f.x), mix(jh(i + vec3(0,1,1)), jh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float side = 1.0 - abs(vJN.y);
          float rise = smoothstep(0.0, 1.45, vJW.y);
          // 0x6e675e at the foot → 0x9a928a at the coping
          diffuseColor.rgb *= mix(0.72, 1.0, rise);
          float a = (vJW.x + vJW.z) * 4.3;
          float streak = smoothstep(0.55, 0.9, jn(vec3(a, vJW.y * 0.8, 1.0))) * side;
          float stain = smoothstep(0.45, 0.75, jn(vec3((vJW.x + vJW.z) * 1.7, vJW.y * 2.2, 5.0))) * (1.0 - smoothstep(0.1, 0.75, vJW.y)) * side;
          diffuseColor.rgb *= 1.0 - 0.35 * streak - 0.55 * stain;
          diffuseColor.rgb *= 0.85 + 0.3 * jn(vJW * 1.3);
        }`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-jagati';
}

/**
 * The theertham courts' floor: red oxide (0x9a3b2c) painted over concrete, worn through to grey along the
 * pilgrims' lines (the walk between the well rows, x ≈ −33, and round every kerb), wet everywhere and
 * pooled in the low spots (roughness 0.2 → 0.06 in the puddles).
 */
function wellFloor(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWF;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWF = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWF;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
        float puddle;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 p = vWF.xz;
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 oxide = vec3(0.32, 0.045, 0.026) * (0.7 + lum * 0.9);
          vec3 grey = vec3(0.36, 0.35, 0.33) * (0.6 + lum * 0.8);
          // traffic: the walk between the two rows of wells, the paths along the courts, noise
          float lane = 1.0 - smoothstep(1.2, 3.2, abs(p.x + 33.0));
          float walk = 1.0 - smoothstep(0.8, 2.6, abs(p.y - 92.0));
          float n = fn(p * 0.7) * 0.55 + fn(p * 2.9) * 0.3 + fn(p * 11.0) * 0.15;
          float wear = smoothstep(0.45, 0.85, n * 0.7 + max(lane, walk) * 0.55);
          diffuseColor.rgb = mix(oxide, grey, wear);
          puddle = smoothstep(0.6, 0.66, fn(p * 0.45 + 3.1) * 0.65 + fn(p * 1.7) * 0.35);
          diffuseColor.rgb *= mix(0.78, 0.5, puddle);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.2, 0.05, puddle);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal), puddle));`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = 0.0;`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-wellfloor';
}

/** Lamp-and-bounce glow for interior paint: a little of the surface's own colour added as emission. */
function selfLit(m: THREE.MeshStandardMaterial, k: number, key: string) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(3)};`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-selflit-' + key;
  return m;
}

/** Rain-wet paving: an irregular noise mask of standing water — near-mirror roughness, darker — over the pavers. */
function wetSheen(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWet;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWet = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWet;
        float qh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float qn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(qh(i), qh(i + vec2(1, 0)), f.x), mix(qh(i + vec2(0, 1)), qh(i + vec2(1, 1)), f.x), f.y); }
        float wetMask() {
          vec2 p = vWet.xz;
          // (r3) fewer, smaller puddles: only the deepest hollows hold water
          float n = qn(p * 0.55) * 0.6 + qn(p * 1.9) * 0.28 + qn(p * 6.1) * 0.12;
          return smoothstep(0.67, 0.7, n);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wetK = wetMask();
        diffuseColor.rgb *= mix(0.82, 0.16, wetK);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor * 0.8, 0.02, wetK);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal), wetK));`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-wetpavers';
}

/** Beach sand darkens and turns glossy where the sea wets it. */
function wetSand(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSandY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSandY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wet = smoothstep(-0.6, -1.15, vSandY);
        diffuseColor.rgb *= 1.0 - wet * 0.42;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.25, smoothstep(-0.6, -1.15, vSandY));`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-sand';
}

/** Welded wire mesh round the Nandi (alpha-tested). */
function grillMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 64, 64);
  x.strokeStyle = '#8f9295';
  x.lineWidth = 5;
  x.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.12, 1 / 0.12);
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 });
}

// ---------- the painted ceiling of the third corridor ----------

const MED = [
  // [ring colours outer→inner], petal colours
  { rings: ['#c8211a', '#f5c518', '#178a3c', '#ffffff', '#c8211a', '#1c3f94'], petals: ['#f08a12', '#ffffff'], ground: '#2d7fc0' },
  { rings: ['#178a3c', '#ffffff', '#c8211a', '#f5c518', '#1c3f94', '#c8211a'], petals: ['#e83c6a', '#f5c518'], ground: '#2f86c4' },
  { rings: ['#f5c518', '#c8211a', '#ffffff', '#178a3c', '#f08a12', '#1c3f94'], petals: ['#ffffff', '#178a3c'], ground: '#2a78b8' },
  { rings: ['#c8211a', '#ffffff', '#f08a12', '#1c3f94', '#f5c518', '#178a3c'], petals: ['#f5c518', '#c8211a'], ground: '#3189c6' },
];

function medallion(x: CanvasRenderingContext2D, cx: number, cy: number, R: number, k: number) {
  const p = MED[k % MED.length];
  // dotted halo
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    x.beginPath(); x.arc(cx + Math.cos(a) * R * 1.07, cy + Math.sin(a) * R * 1.07, R * 0.018, 0, 7); x.fill();
  }
  let r = R;
  const ringW = R / 9;
  for (let i = 0; i < p.rings.length; i++) {
    x.fillStyle = p.rings[i];
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    // petal band every other ring
    if (i % 2 === 1) {
      const n = 16 + i * 4;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + i;
        x.fillStyle = p.petals[j % 2];
        x.beginPath();
        x.ellipse(cx + Math.cos(a) * (r - ringW * 0.55), cy + Math.sin(a) * (r - ringW * 0.55), ringW * 0.5, ringW * 0.22, a, 0, 7);
        x.fill();
      }
    }
    r -= ringW * (i === 0 ? 1.4 : 1.25);
  }
  // central lotus
  const n = 12;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2;
    x.fillStyle = j % 2 ? p.petals[0] : '#ffffff';
    x.beginPath();
    x.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.5, r * 0.2, a, 0, 7);
    x.fill();
  }
  x.fillStyle = '#f5c518';
  x.beginPath(); x.arc(cx, cy, r * 0.28, 0, 7); x.fill();
  x.fillStyle = '#c8211a';
  x.beginPath(); x.arc(cx, cy, r * 0.12, 0, 7); x.fill();
}

/** 1024 px across the walkway (5.2 m) × 2048 px along it (four 3 m bays). */
function ceilingTexture() {
  const W = 1024, H = 2048;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  for (let b = 0; b < 4; b++) {
    const y0 = (b * H) / 4, bh = H / 4;
    const p = MED[b];
    const gr = x.createRadialGradient(W / 2, y0 + bh / 2, 20, W / 2, y0 + bh / 2, W * 0.7);
    gr.addColorStop(0, p.ground);
    gr.addColorStop(1, '#1d5f9e');
    x.fillStyle = gr;
    x.fillRect(0, y0, W, bh);
    // corner flowers
    for (const [fx, fy] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) {
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        x.fillStyle = j % 2 ? '#f5c518' : '#ffffff';
        x.beginPath(); x.ellipse(W * fx + Math.cos(a) * 18, y0 + bh * fy + Math.sin(a) * 18, 16, 7, a, 0, 7); x.fill();
      }
      x.fillStyle = '#c8211a';
      x.beginPath(); x.arc(W * fx, y0 + bh * fy, 8, 0, 7); x.fill();
    }
    medallion(x, W / 2, y0 + bh / 2, bh * 0.47, b);
    // transverse band between bays (the cross beam)
    x.fillStyle = '#b7231a';
    x.fillRect(0, y0, W, 14);
    x.fillStyle = '#f5c518';
    x.fillRect(0, y0 + 14, W, 6);
  }
  // long borders: red, yellow, green with a running scroll
  const border = (x0: number, dir: number) => {
    const cols = ['#a51d15', '#f2c21a', '#17803a', '#ffffff', '#a51d15'];
    let xx = x0;
    for (const [i, col] of cols.entries()) {
      const w = [34, 10, 26, 6, 18][i];
      x.fillStyle = col;
      x.fillRect(dir > 0 ? xx : xx - w, 0, w, H);
      xx += dir * w;
    }
    x.fillStyle = '#f2c21a';
    for (let y = 8; y < H; y += 40) { x.beginPath(); x.arc(dir > 0 ? x0 + 17 : x0 - 17, y, 7, 0, 7); x.fill(); }
  };
  border(0, 1);
  border(W, -1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Ceiling panels over the platforms: smaller medallions on a green-blue ground. */
function sideCeilingTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  for (let b = 0; b < 4; b++) {
    const y0 = (b * H) / 4, bh = H / 4;
    x.fillStyle = b % 2 ? '#2a6f9f' : '#3a7f6a';
    x.fillRect(0, y0, W, bh);
    medallion(x, W / 2, y0 + bh / 2, bh * 0.33, b + 1);
    x.fillStyle = '#9e1f17';
    x.fillRect(0, y0, W, 10);
  }
  x.fillStyle = '#a51d15';
  x.fillRect(0, 0, 20, H);
  x.fillRect(W - 20, 0, 20, H);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- shop signboards and theertham name boards ----------

export const SIGN_ROWS = 8, SIGN_COLS = 2;
const SHOPS: [string, string, string, string][] = [
  ['ஸ்ரீ ராமநாதர் ஸ்டோர்ஸ்', 'SRI RAMANATHAR STORES', '#c8211a', '#fff6d0'],
  ['சங்கு மாலை', 'CONCH · PEARLS · SHELLS', '#1c4f9c', '#ffffff'],
  ['ஹோட்டல் அக்னி', 'HOTEL AGNI · MEALS READY', '#f5c518', '#7a1208'],
  ['பூஜை பொருட்கள்', 'POOJA ITEMS · VIBHUTI', '#e8701a', '#ffffff'],
  ['ஸ்ரீ லக்ஷ்மி பேன்சி', 'SRI LAKSHMI FANCY', '#178a3c', '#ffffff'],
  ['ராமேஸ்வரம் லாட்ஜ்', 'RAMESWARAM LODGE · A/C ROOMS', '#ffffff', '#b31b12'],
  ['தீர்த்த கலசம்', 'THEERTHA KALASAM · CANS', '#6a2a8c', '#ffe9a8'],
  ['கடல் உணவகம்', 'SEA VIEW RESTAURANT', '#0f6f78', '#ffffff'],
  ['ஸ்ரீ ஹனுமான் டெக்ஸ்', 'SRI HANUMAN TEX · SAREES', '#b3122e', '#ffd84a'],
  ['அன்னபூரணி மெஸ்', 'ANNAPOORANI MESS · TIFFIN', '#f2a516', '#3a1300'],
  ['சேது புக் ஸ்டால்', 'SETHU BOOK STALL', '#2b2b6e', '#ffffff'],
  ['ஸ்ரீ ராம் டிராவல்ஸ்', 'SRI RAM TRAVELS · DHANUSHKODI', '#d02b6a', '#ffffff'],
  ['முத்து பேலஸ்', 'MUTHU PALACE · PEARLS', '#e0e0e0', '#1c3f94'],
  ['அபிஷேக பொருட்கள்', 'ABHISHEKAM ITEMS', '#8a1c10', '#ffd84a'],
  ['ஸ்ரீ முருகன் கூல் பார்', 'SRI MURUGAN COOL BAR', '#1aa0d8', '#ffffff'],
  ['காசி விஸ்வநாதர் ஸ்டோர்ஸ்', 'KASI VISWANATHAR STORES', '#f5c518', '#13306e'],
];

/** 2 × 8 atlas of 1024×256 shop signs; UV rows/cols via SIGN_ROWS/SIGN_COLS. */
function signTexture() {
  const W = 1024 * SIGN_COLS, H = 256 * SIGN_ROWS;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  SHOPS.forEach(([ta, en, bg, fg], i) => {
    const cx = (i % SIGN_COLS) * 1024, cy = Math.floor(i / SIGN_COLS) * 256;
    x.fillStyle = bg;
    x.fillRect(cx, cy, 1024, 256);
    x.strokeStyle = fg;
    x.lineWidth = 8;
    x.strokeRect(cx + 10, cy + 10, 1004, 236);
    x.fillStyle = fg;
    x.textAlign = 'center';
    x.font = 'bold 92px "Noto Sans Tamil", "Tamil Sangam MN", sans-serif';
    x.fillText(ta, cx + 512, cy + 118, 960);
    x.font = 'bold 62px Arial, sans-serif';
    x.fillText(en, cx + 512, cy + 210, 960);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const THEERTHAMS = [
  'மகாலட்சுமி|MAHALAKSHMI', 'சாவித்ரி|SAVITHRI', 'காயத்ரி|GAYATHRI', 'சரஸ்வதி|SARASWATHI', 'சேது மாதவ|SETHU MADHAVA',
  'கந்தமாதன|GANDHAMADHANA', 'கவாட்ச|KAVATCHA', 'கவய|GAVAYA', 'நள|NALA', 'நீல|NEELA', 'சங்கு|SANKU', 'சக்கர|CHAKRA',
  'பிரம்மஹத்தி விமோசன|BRAHMAHATHI VIMOCHANA', 'சூரிய|SURIYA', 'சந்திர|CHANDRA', 'கங்கா|GANGA', 'யமுனா|YAMUNA', 'கயா|GAYA',
  'சிவ|SIVA', 'சாத்யாமிர்த|SADHYAMIRTHA', 'சர்வ|SARVA', 'கோடி|KODI',
];

/** 4 × 6 atlas of numbered theertham name boards (blue enamel, white letters, as the temple's own). */
function boardTexture() {
  const cw = 512, ch = 256, cols = 4, rows = 6;
  const c = document.createElement('canvas');
  c.width = cw * cols; c.height = ch * rows;
  const x = c.getContext('2d')!;
  THEERTHAMS.forEach((s, i) => {
    const [ta, en] = s.split('|');
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    x.fillStyle = '#163f8c';
    x.fillRect(cx, cy, cw, ch);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 6;
    x.strokeRect(cx + 8, cy + 8, cw - 16, ch - 16);
    x.fillStyle = '#ffd84a';
    x.textAlign = 'center';
    x.font = 'bold 44px Arial, sans-serif';
    x.fillText(String(i + 1), cx + cw / 2, cy + 58);
    x.fillStyle = '#ffffff';
    x.font = 'bold 50px "Noto Sans Tamil", "Tamil Sangam MN", sans-serif';
    x.fillText(ta + ' தீர்த்தம்', cx + cw / 2, cy + 130, cw - 30);
    x.font = 'bold 34px Arial, sans-serif';
    x.fillText(en + ' THEERTHAM', cx + cw / 2, cy + 200, cw - 30);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** UV-mapped quad (w × h, facing +z, base at y=0) showing cell (col,row) of a cols×rows atlas. */
export function atlasQuad(w: number, h: number, col: number, row: number, cols: number, rows: number) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (col + uv.getX(i)) / cols, 1 - (row + 1 - uv.getY(i)) / rows);
  }
  return g;
}

/** Dim grey room with a bright strip of tube lights down its centre: the corridor's reflection/ambient environment. */
function corridorEnv(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x0b0c0d);
  const add = (c: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c }));
    m.position.set(x, y, z);
    room.add(m);
  };
  add(0xffffff, 0.3, 0.1, 12, 0, 3, 0); // the tube line overhead
  add(0x2a2620, 8, 0.1, 8, 0, -2, 0); // the floor
  add(0x3a3428, 0.1, 3, 12, 3.5, 0, 0); // pillar rows either side, faintly lit
  add(0x3a3428, 0.1, 3, 12, -3.5, 0, 0);
  add(0x6a7a8a, 2, 2, 0.1, 0, 0, 6); // the far openings
  add(0x6a7a8a, 2, 2, 0.1, 0, 0, -6);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return env;
}

/** A neutral grey studio environment (three's RoomEnvironment), for metals that should keep their own colour. */
function neutralEnv(renderer?: THREE.WebGLRenderer) {
  if (!renderer) return null;
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return t;
}

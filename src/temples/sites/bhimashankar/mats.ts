import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { frieze, courses, spindle, niche, silver as silverRelief, figures, coffer, pillarSkin, ashlar, silverPanel, type Relief } from './relief';
import { GARBHA } from './layout';

/** a tint in linear working space; values above 1 lift a dark scan to the measured albedo */
const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

/**
 * Bhimashankar's palette, from the photographs (2011–2024):
 *  - grey-brown Deccan basalt of the 18th-c. temple: dressed ashlar on the garbhagriha walls, darker and
 *    streaked on the shikhara (monsoon rain, lichen), greenish-black near wet ground;
 *  - the new (2026) mandapa in the same black stone, freshly dressed: a touch cleaner and cooler;
 *  - terracotta-red square tiles in the sunken courtyard, rough basalt retaining walls with moss;
 *  - red laterite soil and leaf litter in the forest; painted plaster and Mangalore tiles in the village;
 *  - silver, gold-toned brass and wet black stone in the sanctum.
 * Scans: Poly Haven (CC0) concrete_wall_006, large_grey_tiles, mossy_stone_wall, terracotta_floor_tiles,
 * red_laterite_soil_stones, painted_plaster_wall, clay_roof_tiles, rusty_corrugated_iron, granite_tile_04.
 */

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture[]>>();

function loadScan(id: string) {
  let p = cache.get(id);
  if (!p) {
    const one = (s: string, srgb: boolean) => loader.loadAsync(`assets/tex/${id}_${s}.webp`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    p = Promise.all([one('diff', true), one('nor', false), one('arm', false)]);
    cache.set(id, p);
  }
  return p;
}

export const rep = (t: THREE.Texture, u: number, v: number, offU = 0, offV = 0) => {
  const c = t.clone();
  c.repeat.set(1 / u, 1 / v);
  c.offset.set(offU, offV);
  c.needsUpdate = true;
  return c;
};

/**
 * Weathering in world space: darker with height (rain and lichen on the spire), monsoon algae (green-black)
 * low on the walls, vertical rain streaks under every cornice and block-to-block tone.
 */
function weather(m: THREE.MeshStandardMaterial, _key: string, amount = 1, moss = 1, lime = 0) {
  // amounts are uniforms so every weathered material shares one shader program per feature set
  const wU = { value: new THREE.Vector3(amount, moss, lime) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWeather = wU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          mat4 mm = modelMatrix;
          #ifdef USE_INSTANCING
            mm = modelMatrix * instanceMatrix;
          #endif
          vTW = (mm * vec4(transformed, 1.0)).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTW; uniform vec3 uWeather;
        float th1(float n) { return fract(sin(n) * 43758.5453); }
        float tn1(float x) { float i = floor(x), f = fract(x); return mix(th1(i), th1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        float th2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th2(i), th2(i + vec2(1, 0)), f.x), mix(th2(i + vec2(0, 1)), th2(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float A = uWeather.x;
          float hgt = smoothstep(5.0, 17.0, vTW.y);
          float along = vTW.x * 0.83 + vTW.z;
          float streak = smoothstep(0.55, 0.95, tn1(along * 3.1)) * (0.5 + 0.5 * tn1(vTW.y * 0.5 + along));
          float wpatch = tn2(vec2(along * 0.35, vTW.y * 0.3));
          vec3 c = diffuseColor.rgb;
          c *= 1.0 - A * (0.16 * hgt + 0.2 * streak + 0.1 * wpatch);
          // monsoon algae: a green-black tide line up to ~1 m, patchy
          float wet = (1.0 - smoothstep(0.1, 0.6 + uWeather.y * 0.5, vTW.y - 0.0)) * step(-3.5, vTW.y) * (0.5 + 0.5 * tn2(vec2(along * 0.8, vTW.y * 2.0)));
          c = mix(c, c * vec3(0.55, 0.62, 0.5), wet * uWeather.y * 0.75);
          float lime = smoothstep(0.9, 0.99, tn1(along * 1.3 + 11.0)) * (1.0 - hgt) * tn1(vTW.y * 1.7);
          c = mix(c, c * 1.3 + 0.02, lime * 0.4 * A);
          // white lime-water runs streaking down the spire (rain washing the lime-plastered joints)
          float runs = smoothstep(0.78, 0.97, tn1(along * 4.7 + 3.0)) * (0.55 + 0.45 * tn1(vTW.y * 0.6 + along * 2.0));
          c = mix(c, vec3(0.62, 0.61, 0.58), runs * uWeather.z * 0.55);
          diffuseColor.rgb = c;
        }`);
  };
  m.customProgramCacheKey = () => 'bhima-weather';
}

/**
 * Lamp soot in the garbhagriha: the stone blackens upward from about shoulder height, in patches, with an
 * oily sheen (lower roughness) where the smoke has settled thickest.
 */
function soot(m: THREE.MeshStandardMaterial, floorY: number) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFloorY = { value: floorY };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTS;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vTS = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTS; uniform float uFloorY;
        float sh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(sh2(i), sh2(i + vec2(1, 0)), f.x), mix(sh2(i + vec2(0, 1)), sh2(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float hS = vTS.y - uFloorY;
        float along = vTS.x + vTS.z;
        float n = sn2(vec2(along * 1.7, hS * 1.3)) * 0.6 + sn2(vec2(along * 5.0, hS * 4.0)) * 0.4;
        float sootK = smoothstep(1.0, 4.4, hS + (n - 0.5) * 1.2);
        diffuseColor.rgb *= mix(1.25, 0.42, sootK) * (0.85 + 0.3 * n);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.55, smoothstep(0.5, 0.9, sootK * n + 0.2)), 0.25, 1.0);`);
  };
  m.customProgramCacheKey = () => 'bhima-soot';
}

function scan(pending: Promise<unknown>[], id: string, size: number, tint: number | THREE.Color,
  o: { normalScale?: number; rough?: number; weather?: number; moss?: number; key?: string; side?: THREE.Side; lime?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: o.rough ?? 0.9, side: o.side ?? THREE.FrontSide });
  pending.push(loadScan(id).then(([d, n, a]) => {
    m.map = rep(d, size, size);
    m.normalMap = rep(n, size, size);
    m.normalScale.setScalar(o.normalScale ?? 1);
    const arm = rep(a, size, size);
    m.aoMap = arm;
    m.roughnessMap = arm;
    m.roughness = o.rough ?? 1;
    m.metalness = 0;
    m.needsUpdate = true;
  }));
  if (o.weather) weather(m, o.key ?? id, o.weather, o.moss ?? 1, o.lime ?? 0);
  return m;
}

/** scanned colour + a relief (normal, AO) tiled at `tile` metres; `y0` aligns the tile's bottom edge in world metres */
function carved(pending: Promise<unknown>[], id: string, size: number, tint: number | THREE.Color, R: Relief, tile: [number, number], y0: number, key: string,
  o: { normalScale?: number; weather?: number; offU?: number; lime?: number } = {}) {
  const off = -y0 / tile[1];
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.92,
    normalMap: rep(R.normal, tile[0], tile[1], o.offU ?? 0, off), aoMap: rep(R.ao, tile[0], tile[1], o.offU ?? 0, off), aoMapIntensity: 1,
    normalScale: new THREE.Vector2(o.normalScale ?? 1.4, o.normalScale ?? 1.4),
  });
  pending.push(loadScan(id).then(([d]) => { m.map = rep(d, size, size); m.needsUpdate = true; }));
  weather(m, key, o.weather ?? 1, 1, o.lime ?? 0);
  return m;
}

export function bhimaMaterials(M: Materials, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const FR = frieze(), CO = courses(), AS = ashlar(), SP = spindle(), SV = silverRelief(), FG = figures(), CF = coffer(), PS = pillarSkin();
  // the concrete scan is dark brown (sRGB ≈ 92/81/69): these linear gains lift it to the measured stone
  // (round 3: garbhagriha wall ≈ #8a857d pale weathered grey, spire ≈ #6e675e grey-brown, crevices ≈ #3c3833)
  const BASALT = lin(1.4, 1.62, 1.95);
  const MOULD = lin(1.2, 1.38, 1.65);
  const NEW = lin(1.05, 1.2, 1.45); // the freshly dressed 2026 mandapa stone (dark basalt, cleaner)

  const spindleMat = new THREE.MeshStandardMaterial({
    color: lin(0.42, 0.37, 0.31), roughness: 0.9, normalMap: rep(SP.normal, 1 / 6, 1 / 4), aoMap: rep(SP.ao, 1 / 6, 1 / 4),
    normalScale: new THREE.Vector2(2.2, 2.2), aoMapIntensity: 1.0, map: rep(SP.color, 1 / 6, 1 / 4),
  });
  weather(spindleMat, 'spindle', 1.0, 1, 0.8);

  const nicheMats = [0, 1, 2, 3].map((v) => {
    const R = niche(v);
    const m = new THREE.MeshStandardMaterial({
      color: 0x8c8882, roughness: 0.9, normalMap: R.normal, aoMap: R.ao, aoMapIntensity: 1.2, map: R.color, normalScale: new THREE.Vector2(3, 3),
    });
    weather(m, 'niche', 0.6);
    return m;
  });
  // the shrine images in the bhadra niches are smeared with sindoor (orange-red), as photographed
  const sindoor = (() => {
    const R = niche(1);
    return new THREE.MeshStandardMaterial({
      color: 0xe0582a, roughness: 0.7, normalMap: R.normal, aoMap: R.ao, aoMapIntensity: 1.3, map: R.color, normalScale: new THREE.Vector2(3, 3),
    });
  })();

  const silverEmb = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0.85, roughness: 0.38, map: rep(SV.color, 0.8, 0.8), normalMap: rep(SV.normal, 0.8, 0.8),
    normalScale: new THREE.Vector2(1.2, 1.2), envMap: interiorEnv, envMapIntensity: 1.05, emissive: 0x8a8c90, emissiveIntensity: 0.18,
    emissiveMap: rep(SV.color, 0.8, 0.8),
  });
  const silver = new THREE.MeshStandardMaterial({ color: 0xf0f3f8, metalness: 0.85, roughness: 0.34, envMap: interiorEnv, envMapIntensity: 1.1, emissive: 0x6a6c70, emissiveIntensity: 0.18 });
  // the dado: one repoussé panel per half-wall, aligned to the room (u runs along x on the west wall, z on the sides)
  const SPN = silverPanel();
  const dado = (u0: number) => {
    const tw = GARBHA.inner, th = 0.9, ku = u0 / tw, kv = GARBHA.floor / th;
    return new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.85, roughness: 0.4, map: rep(SPN.color, tw, th, Math.round(ku) - ku, Math.round(kv) - kv),
      normalMap: rep(SPN.normal, tw, th, Math.round(ku) - ku, Math.round(kv) - kv), normalScale: new THREE.Vector2(1.4, 1.4),
      envMap: interiorEnv, envMapIntensity: 1.0, emissive: 0x8a8c90, emissiveIntensity: 0.16, emissiveMap: rep(SPN.color, tw, th, Math.round(ku) - ku, Math.round(kv) - kv),
    });
  };
  // black basalt blocks (the ashlar relief at a smaller course, 0.35 m) under lamp soot
  const sootStone = new THREE.MeshStandardMaterial({
    color: lin(0.4, 0.46, 0.56), roughness: 0.85, normalMap: rep(AS.normal, 1.6, 1.4, 0, 0.3 / 1.4), aoMap: rep(AS.ao, 1.6, 1.4, 0, 0.3 / 1.4),
    normalScale: new THREE.Vector2(0.9, 0.9),
  });
  pending.push(loadScan('concrete_wall_006').then(([d]) => { sootStone.map = rep(d, 2.0, 2.0); sootStone.needsUpdate = true; }));
  soot(sootStone, GARBHA.floor);
  const goldIn = new THREE.MeshStandardMaterial({ color: 0xffc845, metalness: 0.9, roughness: 0.22, envMap: interiorEnv, envMapIntensity: 1.6, emissive: 0x6a4806, emissiveIntensity: 0.35 });
  const brassIn = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.95, roughness: 0.36, envMap: interiorEnv, envMapIntensity: 1.5, emissive: 0x3a2404, emissiveIntensity: 0.3 });

  // plaster house fronts in the colours of the village (pale blue, cream, yellow, pink, white, green)
  const plasterTints = [0x98aebb, 0xd2c8b0, 0xd4bc78, 0xc8a8a0];
  const plaster = plasterTints.map((t, i) => scan(pending, 'painted_plaster_wall', 2.5, t, { normalScale: 0.9, weather: 1.1, moss: 1.9, key: `plaster${i}` }));

  return {
    /** dressed basalt ashlar of the 18th-century garbhagriha */
    basalt: carved(pending, 'concrete_wall_006', 3.0, BASALT, AS, [2.4, 2.2], 0, 'basalt', { normalScale: 0.7, lime: 0.7, weather: 1.0 }),
    /** the dark, recessed core of the shikhara between the spirelets (deep shadow, rain-blackened) */
    core: scan(pending, 'concrete_wall_006', 3.0, lin(0.6, 0.68, 0.82), { normalScale: 0.8, weather: 0.8, key: 'core' }),
    /** plain dressed stone (mouldings, cornices, plinth) */
    stone: scan(pending, 'concrete_wall_006', 3.0, MOULD, { normalScale: 0.8, weather: 1, key: 'stone', lime: 0.4 }),
    sootStone,
    silverDadoX: dado(-GARBHA.inner),
    silverDadoZ: dado(GARBHA.cz - GARBHA.inner),
    /** the 2026 mandapa: same stone, cleaner */
    newStone: scan(pending, 'concrete_wall_006', 3.0, NEW, { normalScale: 0.7, weather: 0.45, key: 'newstone' }),
    newWall: carved(pending, 'concrete_wall_006', 3.0, NEW, CO, [2.4, 2.4], 0.6, 'newwall', { normalScale: 0.45, weather: 0.4 }),
    /** band of carved figures girdling the garbhagriha (3.4–4.0 m) */
    figureBand: carved(pending, 'concrete_wall_006', 3.0, BASALT, FG, [1.2, 0.796], 4.365, 'figband', { normalScale: 2.8 }),
    /** cornice frieze (mandapa entablature) and the garbhagriha kapota */
    frieze: carved(pending, 'concrete_wall_006', 3.0, NEW, FR, [1.0, 1.0], 4.95, 'frieze', { normalScale: 1.2, weather: 0.5 }),
    friezeG: carved(pending, 'concrete_wall_006', 3.0, BASALT, FR, [0.7, 0.7], 0.25, 'friezeg', { normalScale: 1.2 }),
    /** coffered ceiling of the mandapa: one lotus per 2.4 m bay, aligned with the pillar grid */
    coffer: (() => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x8e8e8c, roughness: 0.95, normalMap: rep(CF.normal, 1, 1), aoMap: rep(CF.ao, 1, 1),
        map: rep(CF.color, 1, 1), normalScale: new THREE.Vector2(1.6, 1.6), aoMapIntensity: 1.2,
      });
      return m;
    })(),
    /** carved pillar skin (cylindrical UVs in metres) */
    pillar: carved(pending, 'concrete_wall_006', 2.0, NEW, PS, [0.6, 1.1], 0.6, 'pillar', { normalScale: 1.5, weather: 0.35 }),
    spindle: spindleMat,
    niche: nicheMats,
    sindoor,
    /** the sunken courtyard: terracotta-red square tiles */
    paving: scan(pending, 'large_grey_tiles', 1.8, lin(1.1, 0.5, 0.36), { normalScale: 0.9, rough: 1, weather: 0.5, moss: 1.6, key: 'paving' }),
    /** the darker bands laid into the court paving, radiating from the temple */
    pavingBand: scan(pending, 'large_grey_tiles', 1.2, lin(0.5, 0.22, 0.15), { normalScale: 0.9, rough: 1, weather: 0.5, moss: 1.6, key: 'pavingband' }),
    /** polished dark stone floor of the mandapa */
    hallFloor: (() => {
      const m = scan(pending, 'large_grey_tiles', 2.4, 0x6e6c6a, { normalScale: 0.4, rough: 0.55 });
      m.envMapIntensity = 0.6;
      return m;
    })(),
    /** grey stone steps of the stairway */
    steps: scan(pending, 'granite_tile_04', 1.6, 0xb8b4ae, { normalScale: 0.6, weather: 0.6, moss: 1.5, key: 'steps' }),
    /** rough basalt retaining walls, mossy in the monsoon */
    rampart: scan(pending, 'mossy_stone_wall', 2.4, 0xb6b0a6, { normalScale: 1.1, weather: 0.6, moss: 1.2, key: 'rampart' }),
    /** red laterite earth (paths, kund rims, house plots) */
    laterite: scan(pending, 'red_laterite_soil_stones', 3.0, 0xd0a090, { normalScale: 1.0 }),
    plaster,
    roofTile: scan(pending, 'clay_roof_tiles', 2.0, 0xc89080, { normalScale: 1.0, side: THREE.DoubleSide }),
    tin: scan(pending, 'rusty_corrugated_iron', 1.6, 0x9aa4a8, { normalScale: 1.2, side: THREE.DoubleSide }),
    tinBlue: scan(pending, 'rusty_corrugated_iron', 1.6, 0x7a9cc0, { normalScale: 1.2, side: THREE.DoubleSide, key: 'tinblue' }),
    lime: new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: 0.75 }),
    redOchre: new THREE.MeshStandardMaterial({ color: 0xb04a2a, roughness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf0b240, metalness: 1, roughness: 0.22, emissive: 0x3a2200, emissiveIntensity: 0.35 }),
    goldIn,
    brassIn,
    silver,
    silverEmb,
    brass: M.brass,
    /** wet black stone of the Jyotirlinga */
    lingam: new THREE.MeshPhysicalMaterial({
      color: 0x1c1a18, roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.35, envMap: interiorEnv, envMapIntensity: 0.9,
    }),
    wetStone: new THREE.MeshPhysicalMaterial({ color: 0x2c2a28, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: interiorEnv, envMapIntensity: 1.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 }),
    saffron: M.saffron,
    marigold: M.marigold,
    kumkum: M.kumkum,
    velvet: M.velvet,
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.85, roughness: 0.38 }),
    paintSteel: new THREE.MeshStandardMaterial({ color: 0x4a5a52, metalness: 0.5, roughness: 0.55 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.9, roughness: 0.5 }),
    bellMetal: new THREE.MeshStandardMaterial({ color: 0x4a5048, metalness: 0.6, roughness: 0.75 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 }),
    nandi: new THREE.MeshPhysicalMaterial({ color: 0x232120, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, vertexColors: true }),
    tarpBlue: new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.75, side: THREE.DoubleSide }),
    tarpOrange: new THREE.MeshStandardMaterial({ color: 0xd8642a, roughness: 0.75, side: THREE.DoubleSide }),
    water: new THREE.MeshStandardMaterial({ color: 0x23402a, roughness: 0.12, metalness: 0.15, envMapIntensity: 0.45 }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.1, metalness: 0.6 }),
  };
}

export type BM = ReturnType<typeof bhimaMaterials>;

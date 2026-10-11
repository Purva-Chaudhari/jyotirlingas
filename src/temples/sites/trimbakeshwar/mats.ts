import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { frieze, courses, spindle, niche, silver as silverRelief, wallPanel, marbleFloor, type Relief } from './relief';

/**
 * Trimbakeshwar's palette, from the photographs:
 *  - black-grey Deccan basalt of the 1755–86 temple: dressed ashlar on the walls, deeply carved friezes,
 *    blackened by rain and lichen high on the shikhara, paler and dustier near the ground;
 *  - grey basalt flagstones of the courtyard with pale lime joints;
 *  - lime-washed white crowns (amalaka) under gilded kalashas;
 *  - silver and gold in the sanctum.
 * Scans: Poly Haven (CC0) granite_tile_04, stone_wall_04, dark_rock_02.
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

const rep = (t: THREE.Texture, u: number, v: number, offV = 0) => {
  const c = t.clone();
  c.repeat.set(1 / u, 1 / v);
  c.offset.set(0, offV);
  c.needsUpdate = true;
  return c;
};

/**
 * Basalt weathering in world space: darker and blacker with height (rain, lichen on the spire),
 * pale dust near the ground, vertical rain streaks under every cornice and block-to-block tone.
 */
function weather(m: THREE.MeshStandardMaterial, key: string, amount = 1) {
  m.onBeforeCompile = (sh) => {
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
        varying vec3 vTW;
        float th1(float n) { return fract(sin(n) * 43758.5453); }
        float tn1(float x) { float i = floor(x), f = fract(x); return mix(th1(i), th1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        float th2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th2(i), th2(i + vec2(1, 0)), f.x), mix(th2(i + vec2(0, 1)), th2(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float A = ${amount.toFixed(2)};
          float hgt = smoothstep(4.0, 22.0, vTW.y);
          float along = vTW.x * 0.83 + vTW.z;
          float streak = smoothstep(0.55, 0.95, tn1(along * 3.1)) * (0.5 + 0.5 * tn1(vTW.y * 0.5 + along));
          float wpatch = tn2(vec2(along * 0.35, vTW.y * 0.3));
          float dust = (1.0 - smoothstep(0.0, 2.2, vTW.y)) * step(-0.2, vTW.y);
          vec3 c = diffuseColor.rgb;
          c *= 1.0 - A * (0.16 * hgt + 0.2 * streak + 0.12 * wpatch);
          c = mix(c, c * vec3(1.18, 1.16, 1.12) + 0.025, A * dust * 0.6);
          // occasional pale lime runs below joints
          float lime = smoothstep(0.9, 0.99, tn1(along * 1.3 + 11.0)) * (1.0 - hgt) * tn1(vTW.y * 1.7);
          c = mix(c, c * 1.35 + 0.02, lime * 0.5 * A);
          diffuseColor.rgb = c;
        }`);
  };
  m.customProgramCacheKey = () => `trimbak-weather-${key}`;
}

function scan(pending: Promise<unknown>[], id: string, size: number, tint: number, o: { normalScale?: number; rough?: number; weather?: number; key?: string } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: o.rough ?? 0.9 });
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
  if (o.weather) weather(m, o.key ?? id, o.weather);
  return m;
}

/** scanned colour + a relief (normal, AO) tiled at `tile` metres; `y0` aligns the tile's bottom edge in world metres */
function carved(pending: Promise<unknown>[], id: string, size: number, tint: number, R: Relief, tile: [number, number], y0: number, key: string, o: { normalScale?: number; weather?: number } = {}) {
  const off = -y0 / tile[1];
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.92,
    normalMap: rep(R.normal, tile[0], tile[1], off), aoMap: rep(R.ao, tile[0], tile[1], off), aoMapIntensity: 1,
    normalScale: new THREE.Vector2(o.normalScale ?? 1.4, o.normalScale ?? 1.4),
  });
  pending.push(loadScan(id).then(([d]) => { m.map = rep(d, size, size); m.needsUpdate = true; }));
  weather(m, key, o.weather ?? 1);
  return m;
}

/** normal map of corrugated sheet: ridges every 7.6 cm along u (world metres) */
function corrugated() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const g = c.getContext('2d')!;
  const img = g.createImageData(64, 4);
  for (let x = 0; x < 64; x++) {
    const d = Math.cos((x / 64) * Math.PI * 2) * 0.8;
    const l = Math.hypot(d, 1);
    for (let y = 0; y < 4; y++) {
      const i = (y * 64 + x) * 4;
      img.data[i] = (-d / l * 0.5 + 0.5) * 255; img.data[i + 1] = 128; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.076, 1);
  return t;
}

export function trimbakMaterials(M: Materials, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const FR = frieze(), CO = courses(), SP = spindle(), SV = silverRelief(), WP = wallPanel();
  const BASALT = 0xa2a8b0; // cool grey over the brownish concrete scan → weathered basalt

  // spindle skin uses the lathe's own UVs (u around, v up): 1 × 3 storeys per spindle
  const spindleMat = new THREE.MeshStandardMaterial({
    color: 0x7c7976, roughness: 0.9, normalMap: rep(SP.normal, 1 / 6, 1 / 3), aoMap: rep(SP.ao, 1 / 6, 1 / 3),
    normalScale: new THREE.Vector2(1.8, 1.8), aoMapIntensity: 1.3, map: rep(SP.color, 1 / 6, 1 / 3),
  });
  weather(spindleMat, 'spindle', 0.8);

  const nicheMats = [0, 1, 2, 3].map((v) => {
    const R = niche(v);
    const m = new THREE.MeshStandardMaterial({
      color: 0x84827e, roughness: 0.9, normalMap: R.normal, aoMap: R.ao, aoMapIntensity: 1.2, map: R.color, normalScale: new THREE.Vector2(3, 3),
    });
    weather(m, 'niche', 0.7);
    return m;
  });

  const silverEmb = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0.9, roughness: 0.22, map: rep(SV.color, 0.3, 0.3), normalMap: rep(SV.normal, 0.3, 0.3),
    normalScale: new THREE.Vector2(1.5, 1.5), envMap: interiorEnv, envMapIntensity: 1.8, emissive: 0x8a8c90, emissiveIntensity: 0.3,
    emissiveMap: rep(SV.color, 0.3, 0.3),
  });
  const silver = new THREE.MeshStandardMaterial({ color: 0xf0f3f8, metalness: 0.85, roughness: 0.22, envMap: interiorEnv, envMapIntensity: 1.8, emissive: 0x6a6c70, emissiveIntensity: 0.3 });
  const goldIn = new THREE.MeshStandardMaterial({ color: 0xffc845, metalness: 0.9, roughness: 0.2, envMap: interiorEnv, envMapIntensity: 3.6, emissive: 0x6a4806, emissiveIntensity: 0.35 });

  return {
    /** dressed basalt ashlar (walls, plinth mouldings) */
    basalt: carved(pending, 'concrete_wall_006', 3.0, BASALT, CO, [2.4, 2.4], 0, 'basalt', { normalScale: 0.55 }),
    /** dressed basalt with carved fillets (flat hall walls) */
    wall: carved(pending, 'concrete_wall_006', 3.0, BASALT, CO, [2.4, 2.4], 0, 'wall', { normalScale: 1.1 }),
    /** cornice friezes: porch band (y 5.95–7.15) and hall band (y 7.0–8.2) and the shikhara's base band */
    friezePorch: carved(pending, 'concrete_wall_006', 3.0, BASALT, FR, [1.2, 1.2], 6.65, 'fr1'),
    friezeHall: carved(pending, 'concrete_wall_006', 3.0, BASALT, FR, [1.2, 1.2], 0.6, 'fr2'),
    friezeMid: carved(pending, 'concrete_wall_006', 3.0, BASALT, FR, [0.6, 0.6], 3.5, 'fr4', { normalScale: 1.2 }),
    friezeGate: carved(pending, 'concrete_wall_006', 3.0, 0xe4e2de, FR, [1.2, 1.2], 5.0, 'fr3'),
    spindle: spindleMat,
    /** deep-carved basalt of the antarala and sanctum walls (tiles from y = 0.45, the sanctum floor) */
    carvedWall: carved(pending, 'concrete_wall_006', 3.0, 0x9da3aa, WP, [0.8, 1.6], 0.45, 'carvedwall', { normalScale: 2.2, weather: 0.4 }),
    /** the garbhagriha's own walls (off02, off04): plain dressed black basalt in courses, smoke-darkened */
    sanctumWall: carved(pending, 'concrete_wall_006', 3.0, 0x77757a, CO, [1.6, 1.6], 0.45, 'sanctumwall', { normalScale: 0.9, weather: 0 }),
    /** white marble floor of the garbhagriha */
    sanctumMarble: new THREE.MeshStandardMaterial({ map: marbleFloor(), color: 0xffffff, roughness: 0.25, envMap: interiorEnv, envMapIntensity: 0.35, emissive: 0x3c3b39, emissiveIntensity: 1 }),
    /** water smears on the marble */
    wetFilm: new THREE.MeshStandardMaterial({ color: 0x6a655e, roughness: 0.03, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMap: interiorEnv, envMapIntensity: 1.6 }),
    /** the gold of the mukhavata and mukut */
    mukutGold: new THREE.MeshStandardMaterial({ color: 0xe3b64f, metalness: 0.85, roughness: 0.3, envMap: interiorEnv, envMapIntensity: 2.4, emissive: 0x6a4a10, emissiveIntensity: 0.7 }),
    /** Parvati's blue saree in the west niche */
    saree: new THREE.MeshStandardMaterial({ color: 0x2c4f9e, roughness: 0.7, side: THREE.DoubleSide }),
    niche: nicheMats,
    /** the courtyard: basalt flagstones */
    paving: scan(pending, 'large_grey_tiles', 2.6, 0xa29a90, { normalScale: 0.7, rough: 1 }),
    /** the enclosure wall and gatehouse rubble/ashlar */
    rampart: scan(pending, 'stone_wall_04', 2.6, 0xb0aaa2, { normalScale: 1.0, weather: 0.8, key: 'rampart' }),
    /** lime-washed white of the crowns (amalaka, dome finials) */
    lime: new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.75 }),
    /** gilded kalash */
    gold: new THREE.MeshStandardMaterial({ color: 0xf0b240, metalness: 1, roughness: 0.22, emissive: 0x3a2200, emissiveIntensity: 0.35 }),
    goldIn,
    silver,
    silverEmb,
    brass: M.brass,
    marble: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.35, envMap: interiorEnv, envMapIntensity: 0.8 }),
    /** wet black stone of the pit and the three lingas */
    lingam: new THREE.MeshPhysicalMaterial({
      color: 0x141312, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, envMap: interiorEnv, envMapIntensity: 1.8,
    }),
    wetStone: new THREE.MeshPhysicalMaterial({ color: 0x46423e, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: interiorEnv, envMapIntensity: 1.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 }),
    saffron: M.saffron,
    marigold: M.marigold,
    kumkum: M.kumkum,
    velvet: M.velvet,
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8e92, metalness: 0.8, roughness: 0.45 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0x6a7068, metalness: 0.3, roughness: 0.7, side: THREE.DoubleSide }),
    tile: new THREE.MeshStandardMaterial({ color: 0x8a4a32, roughness: 0.85 }),
    /** corrugated galvanised tin of the gatehouse and town roofs */
    tin: new THREE.MeshStandardMaterial({ color: 0x9a9e9c, metalness: 0.55, roughness: 0.45, normalMap: corrugated(), normalScale: new THREE.Vector2(1.2, 1.2), side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 }),
    nandi: new THREE.MeshPhysicalMaterial({ color: 0x1c1a19, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, vertexColors: true }),
    house: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.06, metalness: 1, envMap: interiorEnv, envMapIntensity: 3.0, emissive: 0x3a3226, emissiveIntensity: 0.6 }),
    crystal: new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.15, metalness: 0.3, emissive: 0xffe2b0, emissiveIntensity: 0.9 }),
  };
}

export type TM = ReturnType<typeof trimbakMaterials>;

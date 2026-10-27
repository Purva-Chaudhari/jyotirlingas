import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { jaala, wallBands, silverBand, type Relief } from './carve';
import { clothTexture } from './boats';

/**
 * Omkareshwar's palette, from photographs of the temple as it stands (2021-2026):
 *  - the old temple's shikhara, stripped of its whitewash: pinkish-brown layered sandstone,
 *  - the grey-buff carved stone of the sixty-pillar sabha mandapa (soot- and oil-darkened inside),
 *  - the new multi-storey galleries on the cliff: salmon-pink (Bansi-Paharpur-like) sandstone frames,
 *  - the dark layered rock of the Mandhata cliffs and Narmada ledges, the ghats' worn sandstone,
 *  - silver in the garbhagriha.
 * Scans are Poly Haven (CC0); maps are cached per id + tile size.
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

interface ScanOpts { normalScale?: number; rough?: number; grime?: number; side?: THREE.Side; vertexColors?: boolean }

function scan(pending: Promise<unknown>[], aniso: number, id: string, size: number, tint: number, o: ScanOpts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, side: o.side ?? THREE.FrontSide, vertexColors: o.vertexColors ?? false });
  pending.push(loadScan(id, size, aniso).then(([map, nor, arm]) => {
    m.map = map;
    m.normalMap = nor;
    m.normalScale.setScalar(o.normalScale ?? 1);
    m.aoMap = arm;
    m.aoMapIntensity = 0.8;
    m.roughnessMap = arm;
    m.roughness = o.rough ?? 1;
    m.metalness = 0;
    m.color.set(tint);
    m.needsUpdate = true;
  }));
  if (o.grime) addGrime(m, o.grime);
  return m;
}

/** A scan's diffuse with a carved relief (normal + AO) on top, tiled at `reliefSize` metres. */
function carvedScan(
  pending: Promise<unknown>[], aniso: number, id: string, size: number, tint: number, relief: Relief,
  reliefSize: [number, number], o: ScanOpts = {},
) {
  const normal = relief.normal.clone(), ao = relief.ao.clone();
  for (const t of [normal, ao]) { t.repeat.set(1 / reliefSize[0], 1 / reliefSize[1]); t.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: o.rough ?? 0.88, normalMap: normal, aoMap: ao, aoMapIntensity: 1,
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1), side: o.side ?? THREE.FrontSide,
  });
  pending.push(loadScan(id, size, aniso).then(([map]) => { m.map = map; m.needsUpdate = true; }));
  if (o.grime) addGrime(m, o.grime);
  return m;
}

/** Darken stone near each floor (splash, hands), vertical weather streaks, block-to-block tone variation. */
function addGrime(m: THREE.MeshStandardMaterial, amount: number) {
  // the amount is a uniform, so every grimed material shares one program (was one program per amount)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGrime = { value: amount };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvOW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOW;
        uniform float uGrime;
        float oh(float n) { return fract(sin(n) * 43758.5453); }
        float on(float x) { float i = floor(x), f = fract(x); return mix(oh(i), oh(i + 1.0), f * f * (3.0 - 2.0 * f)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float oStreak = smoothstep(0.55, 0.95, on((vOW.x + vOW.z) * 2.1)) * (0.5 + 0.5 * on(vOW.y * 0.37 + vOW.x));
        float oFoot = (1.0 - smoothstep(0.0, 1.0, fract(vOW.y / 4.0) * 4.0)) * 0.5;
        diffuseColor.rgb *= 1.0 - uGrime * (oStreak * 0.6 + oFoot);
        vec2 oCell = floor(vec2((vOW.x + vOW.z * 0.93) / 1.25, vOW.y / 0.55));
        float okr = oh(oCell.x * 17.31 + oCell.y * 131.7), okg = oh(oCell.x * 3.17 + oCell.y * 71.3);
        diffuseColor.rgb *= mix(vec3(1.0, 0.97, 0.95), vec3(0.96, 0.98, 1.0), okr) * (0.92 + 0.11 * okg);
        float okp = on((vOW.x - vOW.z) * 0.11) * on(vOW.y * 0.17 + vOW.x * 0.05);
        diffuseColor.rgb *= 1.0 - 0.12 * okp;`);
  };
  m.customProgramCacheKey = () => 'ogrime';
}

/**
 * Hillside: vertex colours carry the hue (monsoon green, scrub, dirt, bedded grey rock); the rock scan only
 * adds grain, as a neutral luminance detail, so green ground stays green rather than brown.
 */
function terrainMat(pending: Promise<unknown>[], aniso: number) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });
  pending.push(loadScan('aerial_rocks_02', 9, aniso).then(([map, nor]) => {
    m.map = map;
    m.normalMap = nor;
    m.normalScale.setScalar(1.3);
    m.needsUpdate = true;
  }));
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 tTex = texture2D( map, vMapUv ).rgb;
        float tLum = dot( tTex, vec3( 0.2126, 0.7152, 0.0722 ) );
        diffuseColor.rgb *= clamp( tLum / 0.105, 0.35, 1.9 );
      #endif`);
  };
  m.customProgramCacheKey = () => 'omk-terrain';
  return m;
}

function tiled(t: THREE.Texture, u: number, v: number) {
  const c = t.clone();
  c.repeat.set(1 / u, 1 / v);
  c.needsUpdate = true;
  return c;
}

/** Interior surfaces see little of the sky: scale the sky's image light down on them. */
const dimSky = <T extends THREE.MeshStandardMaterial>(m: T, k: number) => { m.envMapIntensity = k; return m; };

export function omkarMaterials(M: Materials, renderer: THREE.WebGLRenderer, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const S = (id: string, size: number, tint: number, o?: ScanOpts) => scan(pending, aniso, id, size, tint, o);
  const J = jaala(), WB = wallBands(), SB = silverBand();
  // the scan's sandstone is a warm brown; the stripped shikhara is a paler pinkish buff: lift it past 1 (linear)
  const lift = (m: THREE.MeshStandardMaterial, id = 'sandstone_blocks_08', size = 2.2, rgb: [number, number, number] = [1.32, 1.12, 1.38]) => {
    const set = () => m.color.setRGB(...rgb);
    set();
    pending.push(loadScan(id, size, aniso).then(set)); // after scan() resets its tint
    return m;
  };
  // a neutral, LED-lit room for the polished silver naga (as mahakaleshwar does for its silver)
  const pm = new THREE.PMREMGenerator(renderer);
  const neutralEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();

  const silver = new THREE.MeshStandardMaterial({
    color: 0xe4e6ea, metalness: 0.9, roughness: 0.32, envMap: interiorEnv, envMapIntensity: 1.2, emissive: 0x4c5056, emissiveIntensity: 0.7,
  });
  const silverEmb = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.25, metalness: 0.88, map: tiled(SB.color, 0.4, 0.2), normalMap: tiled(SB.normal, 0.4, 0.2),
    normalScale: new THREE.Vector2(1.4, 1.4), envMap: interiorEnv, envMapIntensity: 1.5,
    emissiveMap: tiled(SB.color, 0.4, 0.2), emissive: 0x666a70, emissiveIntensity: 0.45,
  });
  // the Jyotirlinga: a dark natural stone, wet, smoothed by centuries of abhisheka - not polished, not machined
  const rockLingam = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.45, envMap: neutralEnv, envMapIntensity: 0.35,
  });
  const lingam = new THREE.MeshPhysicalMaterial({ color: 0x161412, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMap: interiorEnv, envMapIntensity: 1.4 });
  // a thin film of abhisheka water over silver and stone (transparent, but tiny and only in the sanctum)
  const film = new THREE.MeshPhysicalMaterial({
    color: 0xb89a98, roughness: 0.04, transparent: true, opacity: 0.38, envMap: interiorEnv, envMapIntensity: 2.4, clearcoat: 1, depthWrite: false,
  });

  return {
    /** stripped shikhara: pinkish-brown sandstone courses */
    shikhara: lift(carvedScan(pending, aniso, 'sandstone_blocks_08', 2.2, 0xf0c4b8, J, [0.62, 0.62], { normalScale: 1.1, grime: 0.12 })),
    shikharaPlain: lift(S('sandstone_blocks_08', 2.2, 0xe8bcae, { normalScale: 1.0, grime: 0.12 })),
    /** carved grey-buff stone of the old temple (pillars, walls) */
    oldStone: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xa49c90, WB, [1.6, 1.6], { normalScale: 1.1, grime: 0.45 }),
    /** the band of old carved red-brown reliefs round the garbhagriha walls (darshan videos) */
    frieze: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0x8a5644, WB, [0.5, 0.45], { normalScale: 1.4, grime: 0.2 }),
    /** the sanctum door's carved frame, coated in oxblood sindoor-and-oil paint */
    sindoorStone: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0x8a3e30, WB, [0.5, 0.5], { normalScale: 1.2, rough: 0.55 }),
    oldStonePink: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xf4c0a0, WB, [1.6, 1.6], { normalScale: 1.1, grime: 0.18 }),
    oldStoneSoot: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0x7e7a74, WB, [1.6, 1.6], { normalScale: 1.1, grime: 0.5 }),
    /** Mamleshwar's grey-buff Paramara sandstone, and its neighbour's redder stone (south-bank videos) */
    mamStone: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xa8a28c, WB, [1.2, 1.2], { normalScale: 1.1, grime: 0.4 }),
    mamRed: carvedScan(pending, aniso, 'sandstone_blocks_08', 2.2, 0xb48470, WB, [1.2, 1.2], { normalScale: 1.1, grime: 0.35 }),
    shrineOrange: S('sandstone_blocks_08', 2.2, 0xd07040, { normalScale: 1.0, grime: 0.25 }),
    walkRoof: new THREE.MeshStandardMaterial({ color: 0x7a8a98, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide }),
    mamRail: new THREE.MeshStandardMaterial({ color: 0xe9b9b9, roughness: 0.6 }),
    shadeNet: new THREE.MeshStandardMaterial({ color: 0x2bb5b0, roughness: 0.9, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    oldPlain: S('beige_wall_002', 2.4, 0xbcaf9f, { normalScale: 0.9, grime: 0.32 }),
    /** the old fortress wall of the temple terrace: big weathered ashlar, buff-pink, water-stained (2023 river photo) */
    fort: S('large_sandstone_blocks_01', 3.2, 0xd2b8a0, { normalScale: 1.2, grime: 0.55 }),
    /** soot-dark interior stone near the sanctum */
    darkStone: dimSky(S('large_sandstone_blocks_01', 2.6, 0x6a625a, { normalScale: 1.1, grime: 0.3 }), 0.35),
    /** the new galleries: salmon-pink sandstone */
    pink: S('beige_wall_002', 2.4, 0xf2b8b4, { normalScale: 0.7, grime: 0.08 }),
    pinkDark: S('beige_wall_002', 2.4, 0xd8a09e, { normalScale: 0.8, grime: 0.1 }),
    pinkCarved: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xf2b8b4, J, [1.1, 1.1], { normalScale: 1.0, grime: 0.08 }),
    /** worn ghat sandstone */
    ghat: S('large_sandstone_blocks_01', 2.6, 0xc9ad96, { normalScale: 1.0, grime: 0.22 }),
    ghatWet: S('large_sandstone_blocks_01', 2.6, 0x5c5446, { normalScale: 0.9, rough: 0.5 }),
    /** dark layered cliff rock of Mandhata */
    rock: lift(S('dark_rock_02', 3.5, 0xffffff, { normalScale: 1.4 }), 'dark_rock_02', 3.5, [2.3, 2.15, 2.0]),
    terrain: terrainMat(pending, aniso),
    /** old grey stone floor of the mandapa, worn smooth */
    hallFloor: S('large_floor_tiles_02', 2.4, 0xb8b0a4, { normalScale: 0.5, rough: 0.7 }),
    /** wet marble floor of the sanctum */
    sanctumFloor: dimSky(S('large_sandstone_blocks_01', 1.8, 0x5a5650, { normalScale: 0.8, rough: 0.8 }), 0.3),
    /** the dark stone ledges round the linga */
    ledge: dimSky(S('large_sandstone_blocks_01', 1.6, 0x4e4a46, { normalScale: 0.9, rough: 0.6, grime: 0.2 }), 0.3),
    /** marble */
    marble: S('marble_01', 2.0, 0xece6dc, { normalScale: 0.4, rough: 0.5 }),
    /** concrete of the downstream bridge and the dam */
    concrete: S('beige_wall_002', 3.0, 0xc8c2b8, { normalScale: 0.5 }),
    /** painted plaster of the palace and town */
    plaster: S('painted_plaster_wall', 2.5, 0xf2e6d0, { normalScale: 0.8, grime: 0.2 }),
    /** dark patinated bronze of the Ekatma Dham statue */
    bronze: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, metalness: 0.75, roughness: 0.42 }),
    roofs: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
    silver,
    silverEmb,
    neutralEnv,
    /** the naga: silver over brass, worn bright, scaled */
    naga: new THREE.MeshStandardMaterial({ color: 0xd2d4d6, metalness: 0.7, roughness: 0.3, envMap: interiorEnv, envMapIntensity: 1.3,
      normalMap: tiled(J.normal, 0.06, 0.06), normalScale: new THREE.Vector2(0.8, 0.8), emissive: 0x5a5a56, emissiveIntensity: 0.6 }),
    clothWhite: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.9, envMapIntensity: 0.35 }),
    // bright yellow silk (photo: lemon-gold). AgX tone mapping bleaches bright yellows and pushes mid ones to
    // mustard, so the albedo is a slightly greener, less bright yellow than the 0xf5c400 it should read as
    clothYellow: new THREE.MeshPhysicalMaterial({ color: 0xe6c800, roughness: 0.45, sheen: 0.25, sheenColor: new THREE.Color(0xffb830), sheenRoughness: 0.45, envMapIntensity: 0.1, emissive: 0x2a2000, side: THREE.DoubleSide }),
    silverDS: Object.assign(silver.clone(), { side: THREE.DoubleSide }),
    /** repoussé silver sheet with lotus rosettes (shared material; the world gives it the lamp-lit environment) */
    silverRep: Object.assign(M.silver.clone(), { color: new THREE.Color(0xb8c2d4), envMapIntensity: 1.0 }),
    brass: M.brass,
    gold: M.gold,
    rockLingam,
    lingam,
    film,
    /** steel railings and pipes */
    steel: new THREE.MeshStandardMaterial({ color: 0xb4b8bc, metalness: 0.9, roughness: 0.35 }),
    /** red painted steel of the Jhoola pul (cable caps, kerbs) */
    bridgeRed: new THREE.MeshStandardMaterial({ color: 0xa8323a, metalness: 0.4, roughness: 0.55 }),
    /** the Jhoola pul's cream / peach concrete pylons, its red steel frames and red corrugated roof (drone and tour videos) */
    bridgeTower: new THREE.MeshStandardMaterial({ color: 0xe8c09a, roughness: 0.85 }),
    /** the new downstream bridge: white concrete, yellow-and-black railings */
    whiteConcrete: new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.85 }),
    railYellow: new THREE.MeshStandardMaterial({ color: 0xe8a81c, roughness: 0.6 }),
    railBlack: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }),
    bridgeTruss: new THREE.MeshStandardMaterial({ color: 0xa8323a, metalness: 0.35, roughness: 0.55 }),
    bridgeRoof: new THREE.MeshStandardMaterial({ color: 0xc8402e, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide }),
    cable: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.45 }),
    deck: S('large_floor_tiles_02', 2.4, 0xb8b0a4, { normalScale: 0.5 }),
    /** corrugated sheet roofs over queues */
    sheet: new THREE.MeshStandardMaterial({ color: 0xd9dcdd, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide }),
    /** the weathered grey sheet roofs over the temple forecourt (river photographs) */
    courtSheet: new THREE.MeshStandardMaterial({ color: 0x9da3a6, metalness: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
    /** yellow-painted collapsible steel gates in the hall (photographs) */
    gateYellow: new THREE.MeshStandardMaterial({ color: 0xd9a21c, metalness: 0.3, roughness: 0.55 }),
    /** blue LED strip light (the upper shrine's arch) */
    ledBlue: new THREE.MeshStandardMaterial({ color: 0x2a5cff, emissive: 0x3a6cff, emissiveIntensity: 2.2 }),
    /** yellow / saffron tarps of the ghat stalls and boats (instanced colour) */
    tarp: new THREE.MeshStandardMaterial({ color: 0xffffff, map: clothTexture(), roughness: 0.85, side: THREE.DoubleSide }),
    boatWood: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    /** weathered wood of stalls and poles */
    wood: S('bark_brown_02', 1.2, 0xa88466, { normalScale: 0.5 }),
    leafy: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.25, metalness: 0.4 }),
    marigold: M.marigold,
    saffron: M.saffron,
    kumkum: M.kumkum,
    ash: new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 1 }),
    whiteStone: new THREE.MeshPhysicalMaterial({ color: 0xe9e4da, roughness: 0.35, clearcoat: 0.6, envMap: interiorEnv, envMapIntensity: 1.0 }),
    blackStone: new THREE.MeshPhysicalMaterial({ color: 0x23201d, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
    redCloth: new THREE.MeshStandardMaterial({ color: 0xa8141c, roughness: 0.9, side: THREE.DoubleSide }),
    velvet: M.velvet,
    door: new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.7 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 2.2 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.6 }),
  };
}

export type OM = ReturnType<typeof omkarMaterials>;

import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { prakara, goldBands, lattice, stucco, pillar, doorGold, painted, type Relief } from './carve';

/**
 * Srisailam's palette:
 *  - rust-ochre quartzite of the prakara walls (unmortared dressed blocks, carved panels outside),
 *  - the same stone, browner, in the gopuram bases,
 *  - lime-stucco gopuram towers: cream-yellow (north, south, west) and white (east),
 *  - dark grey-brown granite of the Mallikarjuna sanctum walls and the mandapas,
 *  - the gold-plated vimana (stepped tiers, lattice dome) and the gilded kalashas,
 *  - polished red-brown granite floors inside, blue-grey slabs in the courtyards,
 *  - gold and silver repoussé at the sanctum doors, painted stucco parapets (red, green, blue).
 * Scans are Poly Haven (CC0); textures shared by id + tile size.
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

/** Darken stone near the ground (splash, hands), soft vertical rain streaks, block-to-block tone. */
function addGrime(m: THREE.MeshStandardMaterial, amount: number, key: string, moss = 0) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSW;
        float sh1(float n) { return fract(sin(n) * 43758.5453); }
        float sn1(float x) { float i = floor(x), f = fract(x); return mix(sh1(i), sh1(i + 1.0), f * f * (3.0 - 2.0 * f)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float sStreak = smoothstep(0.62, 0.95, sn1((vSW.x + vSW.z) * 2.1)) * (0.5 + 0.5 * sn1(vSW.y * 0.4 + vSW.x));
        float sFoot = (1.0 - smoothstep(0.0, 1.0, vSW.y)) * step(-0.3, vSW.y) * 0.7;
        diffuseColor.rgb *= 1.0 - ${amount.toFixed(3)} * (sStreak * 0.55 + sFoot);
        float sp = sn1((vSW.x - vSW.z) * 0.11) * sn1(vSW.y * 0.17 + vSW.x * 0.05);
        diffuseColor.rgb *= 1.0 - 0.12 * sp;
        // dark water stains under the coping and green-black moss at the foot
        float sTop = smoothstep(0.55, 0.9, sn1(vSW.x * 0.7 + vSW.z * 0.7)) * smoothstep(5.0, 8.0, vSW.y) * 0.35;
        float sMoss = (1.0 - smoothstep(0.0, 1.3 + 0.8 * sn1((vSW.x + vSW.z) * 0.9), vSW.y)) * step(-0.3, vSW.y) * ${moss.toFixed(3)};
        diffuseColor.rgb *= 1.0 - sTop * ${moss > 0 ? '1.0' : '0.0'};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.15, 0.08) * (0.7 + 0.6 * sn1(vSW.x * 3.1 - vSW.z * 2.3)), sMoss);`);
  };
  m.customProgramCacheKey = () => `sgrime-${key}-${moss}`;
}

export function srisailamMaterials(M: Materials, renderer: THREE.WebGLRenderer, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tiled = (t: THREE.Texture, u: number, v: number, offV = 0) => {
    const c = t.clone();
    c.repeat.set(1 / u, 1 / v);
    c.offset.set(0, offV);
    c.needsUpdate = true;
    return c;
  };
  const scan = (id: string, size: number, tint: number, o: { normalScale?: number; rough?: number; grime?: number; key?: string } = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 });
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
    if (o.grime) addGrime(m, o.grime, o.key ?? id + tint, o.key === 'prk' ? 0.6 : 0);
    return m;
  };
  /** a scan's diffuse with a carved relief (normal + AO) on top */
  const carved = (id: string, size: number, tint: number, r: Relief, rs: [number, number], o: { normalScale?: number; grime?: number; rough?: number; key?: string } = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color: tint, roughness: o.rough ?? 0.88, normalMap: tiled(r.normal, rs[0], rs[1]), aoMap: tiled(r.ao, rs[0], rs[1]), aoMapIntensity: 1,
      normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    });
    pending.push(loadScan(id, size, aniso).then(([map]) => { m.map = map; m.needsUpdate = true; }));
    if (o.grime) addGrime(m, o.grime, o.key ?? id + tint);
    return m;
  };

  const PR = prakara(5), GB = goldBands(), LT = lattice(), ST = stucco(), PL = pillar(), DG = doorGold();
  const paint = painted();

  // the carved outer wall: its own colour map (rust ochre / weathered grey blocks), 8 m × 4 m tile
  const prakaraCarved = new THREE.MeshStandardMaterial({
    map: tiled(PR.color, 8, 4), normalMap: tiled(PR.normal, 8, 4), aoMap: tiled(PR.ao, 8, 4), aoMapIntensity: 0.7,
    roughness: 0.9, normalScale: new THREE.Vector2(1.6, 1.6),
  });
  addGrime(prakaraCarved, 0.3, 'prakara', 0.75);

  const gold = new THREE.MeshStandardMaterial({
    color: 0xe9a62c, metalness: 1, roughness: 0.55, normalMap: tiled(GB.normal, 1, 0.75), aoMap: tiled(GB.ao, 1, 0.75),
    normalScale: new THREE.Vector2(1.2, 1.2), aoMapIntensity: 0.7, emissive: 0x5a3800, emissiveIntensity: 0.05, envMapIntensity: 1.0,
  });
  const goldLattice = new THREE.MeshStandardMaterial({
    color: 0xe9a62c, metalness: 1, roughness: 0.52, normalMap: tiled(LT.normal, 0.5, 0.5), aoMap: tiled(LT.ao, 0.5, 0.5),
    normalScale: new THREE.Vector2(1.3, 1.3), emissive: 0x5a3800, emissiveIntensity: 0.05, envMapIntensity: 1.0,
  });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xf0b844, metalness: 1, roughness: 0.24, emissive: 0x4a2c00, emissiveIntensity: 0.3 });
  const goldIn = new THREE.MeshStandardMaterial({
    color: 0xffe6a0, metalness: 0.85, roughness: 0.28, normalMap: tiled(DG.normal, 0.6, 1.2), aoMap: tiled(DG.ao, 0.6, 1.2),
    normalScale: new THREE.Vector2(1.5, 1.5), envMap: interiorEnv, envMapIntensity: 3.5, emissive: 0x6a4808, emissiveIntensity: 0.3,
  });
  const goldPlain = new THREE.MeshStandardMaterial({ color: 0xffeab0, metalness: 0.9, roughness: 0.22, envMap: interiorEnv, envMapIntensity: 2.2, emissive: 0x6a5010, emissiveIntensity: 0.35 });
  const silver = new THREE.MeshStandardMaterial({
    color: 0xeceef2, metalness: 0.85, roughness: 0.25, normalMap: tiled(DG.normal, 0.6, 1.2), normalScale: new THREE.Vector2(1.2, 1.2),
    envMap: interiorEnv, envMapIntensity: 3.0, emissive: 0x4a4844, emissiveIntensity: 0.3,
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd09a3c, metalness: 1, roughness: 0.3, envMap: interiorEnv, envMapIntensity: 2.2 });
  /** sanctum gold (door frame, alankaram canopy, prabhavali): satin, lamp-lit, no glare */
  const goldSan = new THREE.MeshStandardMaterial({
    color: 0xf2cc78, metalness: 0.9, roughness: 0.45, normalMap: tiled(DG.normal, 0.3, 0.6), normalScale: new THREE.Vector2(1.3, 1.3),
    aoMap: tiled(DG.ao, 0.6, 1.2), aoMapIntensity: 0.8, envMap: interiorEnv, envMapIntensity: 1.0,
  });
  /** the inner court's paving: brick-red / ochre stone flags (as photographed, 2024), darker joints */
  const courtFlags = scan('red_sandstone_pavement', 2.6, 0xffffff, { normalScale: 0.9, rough: 0.9 });
  pending.push(loadScan('red_sandstone_pavement', 2.6, aniso).then(() => { courtFlags.color.setRGB(1.37, 1.0, 0.78); }));
  /** muted stucco paints of the cloister parapet niches (teal, red, green, ochre) and the figures in them */
  const mute = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const np0 = mute(0x4f8a84), np1 = mute(0x9a4e40);
  const nichePaint = [np0, np1, np0, np1];
  const fp0 = mute(0x5a7090), fp1 = mute(0xc8a468);
  const figPaint = [fp0, fp1, fp1, fp0];
  const goldSanPlain = new THREE.MeshStandardMaterial({ color: 0xf2cc78, metalness: 0.9, roughness: 0.45, envMap: interiorEnv, envMapIntensity: 1.0 });
  /** the garbhagriha walls: dark granite blackened by centuries of lamp soot, darkest high up */
  const sanctumStone = scan('beige_wall_002', 2.4, 0x3a332c, { normalScale: 0.8, rough: 0.85 });
  sanctumStone.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float soot = smoothstep(1.6, 4.4, vSW.y) * 0.6 + 0.25 * (1.0 - smoothstep(0.0, 0.6, length(vSW.xz - vec2(-1.42, sign(vSW.z) * 1.42)))) * step(1.6, vSW.y);
        diffuseColor.rgb *= 1.0 - soot;`);
  };
  sanctumStone.customProgramCacheKey = () => 'srisailam-sanctum-soot';
  const paintedAt = (y0: number, h: number) => {
    const t = paint.clone();
    t.repeat.set(1 / 2, 1 / h);
    t.offset.set(0, -y0 / h);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  };

  return {
    prakaraCarved,
    /** inner faces, wall tops, merlons: dressed quartzite blocks */
    prakara: scan('red_sandstone_pavement', 2.8, 0xa89282, { normalScale: 1.3, grime: 0.35, key: 'prk' }),
    /** gopuram stone bases (granite / quartzite, browner) */
    gopStone: scan('stone_tile_wall', 2.4, 0x8e8072, { normalScale: 1.2, grime: 0.28, key: 'gst' }),
    gopStoneCarved: carved('beige_wall_002', 2.4, 0x8a7c6e, PL, [0.6, 0.6], { normalScale: 1.6, grime: 0.25, key: 'gstc' }),
    /** lime-stucco towers */
    stuccoCream: carved('white_stucco', 2.0, 0xf0dea0, ST, [1, 1], { normalScale: 1.0, grime: 0.06, key: 'stc' }),
    /** dark grey-black worn granite flags of the inner court */
    darkFlags: scan('large_grey_tiles', 1.8, 0x3a3734, { normalScale: 0.9, rough: 0.7 }),
    stuccoCream2: carved('white_stucco', 2.0, 0xf2cc84, ST, [1, 1], { normalScale: 1.1, grime: 0.12, key: 'stc2' }),
    stuccoWhite2: carved('white_stucco', 2.0, 0xe6e0d0, ST, [1, 1], { normalScale: 1.1, grime: 0.12, key: 'stw2' }),
    stuccoWhite: carved('white_stucco', 2.0, 0xf4f1e8, ST, [1, 1], { normalScale: 1.0, grime: 0.08, key: 'stw' }),
    /** sculpture massing in the gopuram niches (slightly warmer than the walls) */
    figCream: scan('white_stucco', 2.0, 0xf0c87c, { normalScale: 0.6 }),
    figWhite: scan('white_stucco', 2.0, 0xeeeae0, { normalScale: 0.6 }),
    /** dark grey-brown granite of the sanctum and mandapas */
    granite: scan('stone_tile_wall', 2.6, 0x8a6a50, { normalScale: 1.0, grime: 0.22, key: 'gr' }),
    graniteCarved: carved('beige_wall_002', 2.4, 0xc49c74, PL, [0.6, 0.6], { normalScale: 1.8, grime: 0.15, key: 'grc' }),
    /** the carved yali piers: grey-brown granite with chisel detail */
    yaliStone: carved('beige_wall_002', 2.4, 0x8c7c6a, PL, [0.32, 0.32], { normalScale: 2.0, grime: 0.2, key: 'yal' }),
    /** turned pillar shafts and plain pillar blocks: warm buff stone */
    pillarStone: scan('beige_wall_002', 2.4, 0xcaa47c, { normalScale: 0.9, grime: 0.18, key: 'pst' }),
    /** grey-brown stone floors of the open mandapas */
    stoneFloor: scan('granite_tile_04', 2.0, 0x9a8c7e, { normalScale: 0.5, rough: 0.7 }),
    graniteDark: scan('beige_wall_002', 2.4, 0x5a4636, { normalScale: 0.8 }),
    /** polished red-brown granite floors of the mandapa and sanctum */
    polished: scan('granite_tile_04', 1.8, 0xc0806a, { normalScale: 0.3, rough: 0.35 }),
    /** blue-grey stone slabs of the courtyards */
    paving: scan('large_grey_tiles', 2.4, 0xa29a90, { normalScale: 0.6 }),
    road: scan('asphalt_02', 4, 0x9a9690, { normalScale: 0.5 }),
    ground: scan('dry_ground_01', 3.5, 0xc8aa88, { normalScale: 0.7 }),
    gold,
    goldLattice,
    gilt,
    goldIn,
    goldPlain,
    goldSan,
    goldSanPlain,
    courtFlags,
    nichePaint,
    figPaint,
    sanctumStone,
    /** cores of the flower ropes (hidden under the heads) */
    roseCore: new THREE.MeshStandardMaterial({ color: 0x5a0c18, roughness: 0.9 }),
    /** kumkum and turmeric heaped on the yoni round the stone */
    /** the dhwaja-stambha: gilt copper, satin rather than mirror */
    dhwaja: new THREE.MeshStandardMaterial({ color: 0xd8a048, metalness: 0.9, roughness: 0.58 }),
    silver,
    brass,
    paintedMandapa: paintedAt(5.6, 1.0),
    paintedCloister: paintedAt(4.5, 0.9),
    paintedNandi: paintedAt(5.1, 0.9),
    paintedBhram: paintedAt(7.2, 0.9),
    paintedArch: paintedAt(6.2, 1.2),
    lingam: new THREE.MeshPhysicalMaterial({
      color: 0x161412, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMap: interiorEnv, envMapIntensity: 1.4,
      normalMap: tiled(ST.normal, 0.25, 0.25), normalScale: new THREE.Vector2(0.5, 0.5),
    }),
    blackStone: new THREE.MeshPhysicalMaterial({ color: 0x24211e, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: interiorEnv, envMapIntensity: 1.2 }),
    nandi: scan('beige_wall_002', 2.0, 0xa08a74, { normalScale: 1.4, rough: 1 }),
    ash: new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 1, emissive: 0x2a2826, emissiveIntensity: 1 }),
    kumkum: M.kumkum,
    marigold: M.marigold,
    saffron: M.saffron,
    dark: new THREE.MeshStandardMaterial({ color: 0x1c140e, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 }),
    /** the brass / antique-gold naga of the Jyotirlinga */
    nagaGold: new THREE.MeshStandardMaterial({ color: 0xe0b464, metalness: 0.9, roughness: 0.38, envMap: interiorEnv, envMapIntensity: 1.3, emissive: 0x3a2604, emissiveIntensity: 0.25 }),
    nagaBrass: new THREE.MeshStandardMaterial({ color: 0xc09048, metalness: 0.9, roughness: 0.38, envMap: interiorEnv, envMapIntensity: 2.0, normalMap: tiled(DG.normal, 0.15, 0.15), normalScale: new THREE.Vector2(0.8, 0.8) }),
    lawn: (() => {
      const m = new THREE.MeshStandardMaterial({ color: 0x4f6a30, roughness: 0.95 });
      pending.push(new THREE.TextureLoader().loadAsync('assets/tex/rocky_terrain_02_diff.webp').then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 3, 1 / 3); t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.color.set(0x6a8a48); m.needsUpdate = true;
      }));
      return m;
    })(),
    hedge: new THREE.MeshStandardMaterial({ color: 0x24401a, roughness: 0.95 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x3e342a, metalness: 0.7, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.35 }),
    yellowRail: new THREE.MeshStandardMaterial({ color: 0xe8c21a, metalness: 0.3, roughness: 0.5 }),
    blueRoof: new THREE.MeshStandardMaterial({ color: 0x4f86c8, metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }),
    greenRoof: new THREE.MeshStandardMaterial({ color: 0x7f9a5a, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }),
    canopy: new THREE.MeshStandardMaterial({ color: 0xece2c6, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }),
    redRoof: new THREE.MeshStandardMaterial({ color: 0xb3533a, roughness: 0.8, side: THREE.DoubleSide }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x2c4a3a, roughness: 0.08, metalness: 0.1, clearcoat: 1 }),
    /** town houses: vertex-coloured whitewash, pastel paint, concrete */
    town: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.9, side: THREE.DoubleSide }),
    whiteCloth: new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.9, side: THREE.DoubleSide }),
    paintTeal: new THREE.MeshStandardMaterial({ color: 0x1f8a86, roughness: 0.65 }),
    paintGreen: new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.7 }),
    paintBlue: new THREE.MeshStandardMaterial({ color: 0x2f62b0, roughness: 0.7 }),
    paintRed: new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.7 }),
    paintYellow: new THREE.MeshStandardMaterial({ color: 0xe8b830, roughness: 0.7 }),
    /** the blue gate signboard: "ఓం నమః శివాయ" in white Telugu letters, yellow border */
    signTelugu: (() => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 160;
      const g = c.getContext('2d')!;
      g.fillStyle = '#1b4a9c'; g.fillRect(0, 0, 1024, 160);
      g.strokeStyle = '#f2c230'; g.lineWidth = 10; g.strokeRect(8, 8, 1008, 144);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 66px "Telugu Sangam MN", "Noto Sans Telugu", "Kohinoor Telugu", sans-serif';
      g.fillText('ఓం నమః శివాయ · శివాయ నమః ఓం', 512, 84);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0x0a1428, emissiveIntensity: 0.4 });
    })(),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  };
}

export type SM = ReturnType<typeof srisailamMaterials>;

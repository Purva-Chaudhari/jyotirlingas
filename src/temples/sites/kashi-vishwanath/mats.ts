import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { jaala, wallBands, sanctumGold, silverBand, type Relief } from './carve';

/**
 * Kashi's own palette:
 *  - pinkish-cream Chunar sandstone of the 2021 Dham (smooth carved + dressed ashlar),
 *  - older cream / buff carved stone of Ahilyabai's 1780 temple and the shrine spires,
 *  - white marble of the Mandir Parisar floor, Kota-like stone of the chowk,
 *  - beaten gold of the shikhara and dome (Ranjit Singh's gift, 1835) and the sanctum walls (2022).
 * Scans are Poly Haven (CC0); textures are shared between materials of the same id + tile size.
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
  opts: { normalScale?: number; rough?: number; grime?: number } = {},
) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 });
  pending.push(loadScan(id, size, aniso).then(([map, nor, arm]) => {
    m.map = map;
    m.normalMap = nor;
    m.normalScale.setScalar(opts.normalScale ?? 1);
    m.aoMap = arm;
    m.aoMapIntensity = 0.8;
    m.roughnessMap = arm;
    m.roughness = opts.rough ?? 1;
    m.metalness = 0;
    m.color.set(tint);
    m.needsUpdate = true;
  }));
  if (opts.grime) addGrime(m, opts.grime);
  return m;
}

/** A scan's diffuse with a carved relief (normal + AO) on top, tiled at `reliefSize` metres. */
function carvedScan(
  pending: Promise<unknown>[], aniso: number, id: string, size: number, tint: number, relief: Relief,
  reliefSize: [number, number], o: { normalScale?: number; grime?: number; rough?: number; ao?: number } = {},
) {
  const normal = relief.normal.clone(), ao = relief.ao.clone();
  for (const t of [normal, ao]) { t.repeat.set(1 / reliefSize[0], 1 / reliefSize[1]); t.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({
    color: tint, roughness: o.rough ?? 0.88, normalMap: normal, aoMap: ao, aoMapIntensity: o.ao ?? 1,
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
  });
  pending.push(loadScan(id, size, aniso).then(([map]) => { m.map = map; m.needsUpdate = true; }));
  if (o.grime) addGrime(m, o.grime);
  return m;
}

/** Darken stone near the ground (splash, hands) and add soft vertical weather streaks. */
function addGrime(m: THREE.MeshStandardMaterial, amount: number) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vKW;
        float kh(float n) { return fract(sin(n) * 43758.5453); }
        float kn(float x) { float i = floor(x), f = fract(x); return mix(kh(i), kh(i + 1.0), f * f * (3.0 - 2.0 * f)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float kStreak = smoothstep(0.6, 0.95, kn((vKW.x + vKW.z) * 2.3)) * (0.5 + 0.5 * kn(vKW.y * 0.4 + vKW.x));
        float kFoot = (1.0 - smoothstep(0.0, 1.2, vKW.y)) * step(-0.3, vKW.y) * 0.6;
        diffuseColor.rgb *= 1.0 - ${amount.toFixed(3)} * (kStreak * 0.5 + kFoot);
        // block-to-block colour variation of quarried sandstone (pinker / creamier / greyer slabs)
        vec2 kCell = floor(vec2((vKW.x + vKW.z * 0.93) / 1.35, vKW.y / 0.62));
        float kr = kh(kCell.x * 17.31 + kCell.y * 131.7);
        float kg = kh(kCell.x * 3.17 + kCell.y * 71.3);
        diffuseColor.rgb *= mix(vec3(1.0, 0.975, 0.96), vec3(0.97, 0.985, 1.0), kr) * (0.93 + 0.1 * kg);
        // large soft patches of weathering
        float kp = kn((vKW.x - vKW.z) * 0.13) * kn(vKW.y * 0.2 + vKW.x * 0.05);
        diffuseColor.rgb *= 1.0 - 0.1 * kp;`);
  };
  m.customProgramCacheKey = () => `kgrime2${amount}`;
}

/** Hammered-gold normal map: soft dimples, so the gilding breaks the sky into glints. */
function hammeredNormal() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const img = g.createImageData(s, s);
  const h = new Float32Array(s * s);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 420; k++) {
    const cx = rnd() * s, cy = rnd() * s, r = 6 + rnd() * 12;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const px = ((Math.floor(cx + x) % s) + s) % s, py = ((Math.floor(cy + y) % s) + s) % s;
      h[py * s + px] -= (1 - d * d) * 0.5;
    }
  }
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const at = (xx: number, yy: number) => h[((yy + s) % s) * s + ((xx + s) % s)];
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.5, dy = (at(x, y + 1) - at(x, y - 1)) * 2.5;
    const l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.4, 1.4);
  return t;
}

/** A bright neutral room (white marble, a daylit doorway, a little lamplight) for polished silver and milk. */
function neutralRoomEnv(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x8c8780);
  const glow = (c: number, x: number, y: number, z: number, r: number) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c }));
    s.position.set(x, y, z);
    room.add(s);
  };
  glow(0xf4f2ee, 0, -3, 0, 2.6); // white marble floor
  glow(0xffffff, 0, 1.0, 4, 1.8); // doorways
  glow(0xf8f6f2, 4, 1.0, 0, 1.5);
  glow(0xf8f6f2, -4, 1.0, 0, 1.5);
  glow(0xffd9a0, 2.5, 0.5, -2.5, 0.6); // lamps
  glow(0xd8b070, 0, 4, 0, 1.6); // gold ceiling
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return env;
}

/** A small warm lamp-lit room as an environment for metals inside the sanctum. */
function lampRoomEnv(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x1a0f08);
  const glow = (c: number, x: number, y: number, z: number, r: number) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c }));
    s.position.set(x, y, z);
    room.add(s);
  };
  glow(0xffc070, -2.5, 0.5, -2, 0.9);
  glow(0xffc070, 2.5, 0.5, -2, 0.9);
  glow(0xfff0d8, 0, 1.5, 4, 2.2); // the open doorway
  glow(0xfff0d8, 4, 1.5, 0, 1.6);
  glow(0xd8b080, 0, 4, 0, 2.0); // gold ceiling
  glow(0x8a5a30, 0, -3, 0, 3);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return env;
}

export function kashiMaterials(M: Materials, renderer: THREE.WebGLRenderer, pending: Promise<unknown>[], interiorEnv: THREE.Texture) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const S = (id: string, size: number, tint: number, o?: { normalScale?: number; rough?: number; grime?: number }) =>
    scan(pending, aniso, id, size, tint, o);
  const J = jaala(), WB = wallBands(), SG = sanctumGold(), SB = silverBand();
  const tiled = (t: THREE.Texture, u: number, v: number, offV = 0) => {
    const c = t.clone();
    c.repeat.set(1 / u, 1 / v);
    c.offset.set(0, offV);
    c.needsUpdate = true;
    return c;
  };
  void hammeredNormal;
  void lampRoomEnv;
  const nEnv = neutralRoomEnv(renderer);

  // beaten gold over carved stone: the gavaksha mesh shows through the gilding
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf6c95c, metalness: 1, roughness: 0.5, envMapIntensity: 0.8,
    normalMap: tiled(J.normal, 1.1, 1.1), aoMap: tiled(J.ao, 1.1, 1.1),
    normalScale: new THREE.Vector2(0.9, 0.9), emissive: 0x302a00, emissiveIntensity: 0.12, aoMapIntensity: 0.6,
  });
  J.color.colorSpace = THREE.SRGBColorSpace;
  // the embossed gold sheets inside the garbhagriha (repeat: 1.3 m panel columns, 3.6 m tall from the floor at y = 0.6)
  const goldIn = new THREE.MeshStandardMaterial({
    color: 0xf2dc9a, metalness: 0.8, roughness: 0.32,
    map: tiled(SG.color, 1.3, 3.6, -0.6 / 3.6), normalMap: tiled(SG.normal, 1.3, 3.6, -0.6 / 3.6), aoMap: tiled(SG.ao, 1.3, 3.6, -0.6 / 3.6),
    emissiveMap: tiled(SG.color, 1.3, 3.6, -0.6 / 3.6), emissive: 0xe0cfa8, emissiveIntensity: 0.2,
    normalScale: new THREE.Vector2(1.6, 1.6), envMap: nEnv, envMapIntensity: 2.0,
  });
  // plain beaten gold inside (frames, pitha, pilasters): a pale, less saturated yellow gold, as in the
  // sanctum photographs, mirroring the white marble and the doorways rather than the lamps
  const goldPlain = new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.85, roughness: 0.35, envMap: nEnv, envMapIntensity: 1.7, emissive: 0x4a3a18, emissiveIntensity: 0.3 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xeceef2, metalness: 0.85, roughness: 0.2, envMap: interiorEnv, envMapIntensity: 4.0, emissive: 0x5a5650, emissiveIntensity: 0.35 });
  const silverEmb = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.24, map: tiled(SB.color, 0.4, 0.2), normalMap: tiled(SB.normal, 0.4, 0.2),
    normalScale: new THREE.Vector2(1.4, 1.4), envMap: interiorEnv, envMapIntensity: 4.0, metalness: 0.85,
    emissiveMap: tiled(SB.color, 0.4, 0.2), emissive: 0x8a8680, emissiveIntensity: 0.4,
  });
  // wet black stone of the lingams: clear-coated, a little uneven
  const lingam = new THREE.MeshPhysicalMaterial({
    color: 0x060607, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, envMap: interiorEnv, envMapIntensity: 0.6,
    normalMap: tiled(J.normal, 0.9, 0.9), normalScale: new THREE.Vector2(0.06, 0.06),
  });
  // milky water pooled in the basin
  const water = new THREE.MeshPhysicalMaterial({
    color: 0xf4f0e6, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.72, envMap: interiorEnv, envMapIntensity: 2.0,
    clearcoat: 1, depthWrite: false,
  });
  const stream = new THREE.MeshPhysicalMaterial({
    color: 0xf6f3ec, roughness: 0.05, transparent: true, opacity: 0.6, envMap: nEnv, depthWrite: false,
    emissive: 0xf6f3ec, emissiveIntensity: 0.35,
  });
  // polished silver of the basin walls and rim (the real one mirrors the white marble round it):
  // a neutral environment, so it reads silver rather than copper under the lamps
  const basinSilver = new THREE.MeshStandardMaterial({
    color: 0xd8d8dc, metalness: 0.9, roughness: 0.25, envMap: nEnv, envMapIntensity: 1.2,
    normalMap: tiled(SB.normal, 0.4, 0.2), normalScale: new THREE.Vector2(1.1, 1.1),
    emissive: 0x9a9aa0, emissiveIntensity: 0.32,
  });
  // the same silver without relief (rope mouldings, knobs, kalash, chains)
  const silverBright = new THREE.MeshStandardMaterial({
    color: 0xe2e2e6, metalness: 0.9, roughness: 0.2, envMap: nEnv, envMapIntensity: 1.3, emissive: 0x8a8a90, emissiveIntensity: 0.3,
  });
  // milk and water flooding the basin floor: glossy, milky white
  const milkFilm = new THREE.MeshPhysicalMaterial({
    color: 0xf4f0e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.85, envMap: nEnv, envMapIntensity: 1.0,
    clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, emissive: 0xf4f0e6, emissiveIntensity: 0.3,
  });
  // white marble ring of the pitha, wet with milk
  const whiteMarble = new THREE.MeshPhysicalMaterial({
    color: 0xf3f0ea, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1, envMap: nEnv, envMapIntensity: 0.8,
    emissive: 0xf3f0ea, emissiveIntensity: 0.18,
  });
  // the gold repoussé ceiling: the wall sheets' panels tiled square, matte enough not to hotspot
  const goldCeil = new THREE.MeshStandardMaterial({
    color: 0xeed69a, metalness: 0.8, roughness: 0.45,
    map: tiled(SG.color, 1.3, 1.3), normalMap: tiled(SG.normal, 1.3, 1.3), aoMap: tiled(SG.ao, 1.3, 1.3),
    emissiveMap: tiled(SG.color, 1.3, 1.3), emissive: 0xe0cfa8, emissiveIntensity: 0.14,
    normalScale: new THREE.Vector2(1.4, 1.4), envMap: nEnv, envMapIntensity: 1.6,
  });
  // repoussé silver underside of the chhatra (scallops + rope tiled small)
  const chhatraSilver = new THREE.MeshStandardMaterial({
    color: 0xe6e6ea, metalness: 0.88, roughness: 0.28, envMap: nEnv, envMapIntensity: 1.2,
    map: tiled(SB.color, 0.16, 0.08), normalMap: tiled(SB.normal, 0.16, 0.08), normalScale: new THREE.Vector2(1.3, 1.3),
    emissive: 0x8a8a90, emissiveIntensity: 0.3,
  });

  return {
    /** carved pinkish-cream Chunar sandstone of the Dham (jointless) */
    chunar: S('beige_wall_002', 2.4, 0xffe2d6, { normalScale: 0.7, grime: 0.12 }),
    /** dressed Chunar ashlar for big walls: pink-buff, as the Dham's retaining walls */
    ashlar: S('stone_tile_wall', 3.2, 0xffd2b8, { normalScale: 0.6, grime: 0.12 }),
    /** older cream-buff stone of the 1780 temple's lower storey */
    temple: carvedScan(pending, aniso, 'marble_01', 1.6, 0xf7e9d3, WB, [1.6, 1.6], { normalScale: 1.0, grime: 0.08, ao: 0.6 }),
    /** plain dressed stone of the same temple (beams, slabs) */
    templePlain: S('marble_01', 1.6, 0xf3e4cc, { normalScale: 0.5, grime: 0.08, rough: 0.85 }),
    /** buff-tan carved stone of the non-gilded shrine spires */
    spireStone: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xfff0de, J, [1.1, 1.1], { normalScale: 0.9, grime: 0.08, ao: 0.25 }),
    /** the same buff stone, uncarved (bases, plinths) */
    shrineStone: S('beige_wall_002', 2.4, 0xd8c3ad, { normalScale: 1.0, grime: 0.28 }),
    /** Chunar walls with carved bands (lotus petals, rosettes) for the Dham gateways */
    chunarWall: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xffe2d6, WB, [1.6, 1.6], { normalScale: 0.9, grime: 0.12 }),
    /** pierced stone jali screen (alpha-tested lattice) */
    jali: jaliMaterial(),
    /** carved Chunar for the Dham's spires */
    chunarCarved: carvedScan(pending, aniso, 'beige_wall_002', 2.4, 0xffe2d6, J, [1.1, 1.1], { normalScale: 1.2, grime: 0.12 }),
    /** fine-grained dressed stone for turned pillars (no directional grain) */
    templeCol: S('marble_01', 1.6, 0xefe0cc, { normalScale: 0.5, rough: 0.85, grime: 0.15 }),
    chunarCol: S('marble_01', 1.6, 0xf7d9c8, { normalScale: 0.5, rough: 0.85, grime: 0.1 }),
    /** white marble paving of the Mandir Parisar */
    marble: S('marble_01', 2.4, 0xfffdf9, { normalScale: 0.3, rough: 0.5 }),
    /** chowk paving (Kota / granite slabs) */
    kota: S('large_floor_tiles_02', 3.2, 0xffd2b4, { normalScale: 0.5, rough: 0.9 }),
    /** ghat steps: weathered sandstone */
    ghat: S('large_sandstone_blocks_01', 2.6, 0xd2c2ae, { normalScale: 1.1, grime: 0.25 }),
    /** sunlit step treads, worn smooth */
    ghatTread: S('large_sandstone_blocks_01', 1.4, 0xf2eadf, { normalScale: 0.8, grime: 0.1 }),
    /** step risers in shade, darker and stained */
    ghatRiser: S('large_sandstone_blocks_01', 1.4, 0xb4a796, { normalScale: 1.2, grime: 0.18 }),
    /** the wet bottom steps, green-black with river silt */
    ghatWet: S('large_sandstone_blocks_01', 1.4, 0x5c5848, { normalScale: 1.0, rough: 0.35 }),
    /** damp steps above the water line: darker, a little glossy */
    ghatDamp: S('large_sandstone_blocks_01', 1.4, 0x9a8f7e, { normalScale: 1.0, rough: 0.6 }),
    /** the shadow line under each step's nosing and the occluded foot of each riser */
    stepShadow: new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 1 }),
    stepFoot: new THREE.MeshStandardMaterial({ color: 0x7a6c5c, roughness: 1 }),
    gold,
    goldIn,
    goldCeil,
    basinSilver,
    silverBright,
    milkFilm,
    whiteMarble,
    chhatraSilver,
    /** the shaded but lit back of a recessed niche or arcade bay (warm stone, never black) */
    recess: new THREE.MeshStandardMaterial({ color: 0x9a7864, roughness: 1 }),
    /** old lime-plaster of the Gyanvapi mosque, aged and stained (value ≈ 0.75) */
    plaster: S('plastered_wall_02', 3.0, 0xc9c3b6, { normalScale: 0.6, grime: 0.4 }),
    silver,
    silverEmb,
    goldPlain,
    water,
    stream,
    brass: M.brass,
    lingam,
    /** polished black stone of shrine pithas */
    blackStone: new THREE.MeshPhysicalMaterial({ color: 0x23201d, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
    marigold: M.marigold,
    saffron: M.saffron,
    kumkum: M.kumkum,
    ash: new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 1 }),
    velvet: M.velvet,
    leaf: M.leaf,
    /** deep shadow inside niches, jalis and doorways */
    dark: new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1 }),
    /** painted-gold crowns on the Dham gateways */
    gilt: new THREE.MeshStandardMaterial({
      color: 0xe2ab45, metalness: 0.8, roughness: 0.5, map: tiled(J.color, 0.8, 0.8), normalMap: tiled(J.normal, 0.8, 0.8),
      aoMap: tiled(J.ao, 0.8, 0.8), normalScale: new THREE.Vector2(1.2, 1.2),
    }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.35 }),
    /** dark bronze-painted lamp posts */
    bronze: new THREE.MeshStandardMaterial({ color: 0x4a3d30, metalness: 0.7, roughness: 0.5 }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.7 }),
    nandi: new THREE.MeshPhysicalMaterial({ color: 0x242120, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.6 }),
    redCloth: new THREE.MeshStandardMaterial({ color: 0x9a1c1c, roughness: 0.95 }),
    bilva: new THREE.MeshStandardMaterial({ color: 0x3f6b22, roughness: 0.6, side: THREE.DoubleSide }),
    milk: new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.3 }),
    city: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true }),
    sand: new THREE.MeshStandardMaterial({ color: 0xd2c6b0, roughness: 1 }),
    /** white limewash */
    lime: new THREE.MeshStandardMaterial({ color: 0xeeebe4, roughness: 0.92 }),
    straw: new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1, side: THREE.DoubleSide }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0x8a7148, roughness: 0.9 }),
    /** tent canvas: single-sided; the tent builds its own inner faces (the AO pre-pass ignores DoubleSide) */
    canvas: new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.2, metalness: 0.3 }),
  };
}

export type KM = ReturnType<typeof kashiMaterials>;

/** Pierced stone screen: interlocking eight-point stars on a square grid, alpha-tested. */
function jaliMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    const cx = x + 16, cy = y + 16;
    g.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = k % 2 ? 6 : 12;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.5, 1 / 0.5);
  return new THREE.MeshStandardMaterial({ color: 0xf2d4c2, alphaMap: t, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.9 });
}

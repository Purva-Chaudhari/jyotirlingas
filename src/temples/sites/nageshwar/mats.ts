import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { scanMaterial, type Materials } from '../../engine/materials';

/**
 * Materials of the Nageshwar site.
 *
 * The 1990s temple is RCC rendered in a smooth plaster, painted a deep maroon-red with cream-yellow
 * columns, arch outlines, mouldings and a cream Greek-key frieze; the roofs and spires are a slightly
 * pinker red. The seated Shiva is painted off-white with a tiger skin in ochre and brown stripes,
 * on a salmon-pink rock with orange flame streaks. Outside: dusty concrete plaza, arid Saurashtra ground.
 */

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
};

const tex = (c: HTMLCanvasElement, srgb = true, wrap = true) => {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const NOISE = /* glsl */ `
  float nh1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float nn3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(nh1(i), nh1(i + vec3(1,0,0)), f.x), mix(nh1(i + vec3(0,1,0)), nh1(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(nh1(i + vec3(0,0,1)), nh1(i + vec3(1,0,1)), f.x), mix(nh1(i + vec3(0,1,1)), nh1(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { return nn3(p) * 0.5 + nn3(p * 2.03) * 0.25 + nn3(p * 4.1) * 0.125 + nn3(p * 8.3) * 0.0625; }`;

/** Inject world-space-position based colour code into a standard material's map stage. */
function worldShade(m: THREE.MeshStandardMaterial, key: string, glsl: string, extraUniforms: Record<string, THREE.IUniform> = {}) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, extraUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNW;\nvarying vec3 vNL;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNL = transformed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vNW;\nvarying vec3 vNL;\n${Object.keys(extraUniforms).map((k) => `uniform float ${k};`).join('\n')}\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n{\n${glsl}\n}`);
  };
  m.customProgramCacheKey = () => 'nag-' + key;
  m.needsUpdate = true;
}

/** Paint weathering for the temple's painted render: faint stains, sun-bleaching, grime at the foot. */
const paint = (gain: number) => /* glsl */ `
  vec3 wp = vNW;
  diffuseColor.rgb *= ${gain.toFixed(2)};
  float n1 = fbm3(wp * 0.45), n2 = nn3(wp * 3.1 + 5.0);
  diffuseColor.rgb *= 0.9 + 0.16 * n1 + 0.05 * n2;
  float grime = 1.0 - 0.2 * (1.0 - smoothstep(0.0, 1.3, wp.y)) * step(-0.4, wp.y);
  float streak = smoothstep(0.66, 0.95, nn3(vec3(wp.x * 2.7 + wp.z * 2.1, wp.y * 0.16, wp.z * 2.7 - wp.x * 1.3)));
  diffuseColor.rgb *= grime * (1.0 - 0.1 * streak);`;

export function nageshwarMats(M: Materials, pending: Promise<unknown>[], interiorEnv: THREE.Texture, renderer: THREE.WebGLRenderer) {
  // a neutral (white-lit) room for the silver, so it reads as silver and not bronze under the warm lamps
  const pm = new THREE.PMREMGenerator(renderer);
  const roomEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  const scan = (id: string, size: number, tint: number, normalScale = 1) => {
    const s = scanMaterial(id, size, { tint, normalScale });
    pending.push(s.loaded);
    return s.material;
  };

  // painted render on the temple: the plaster scan, tinted
  // 2024–26 repaint: deep crimson / brick red (was salmon-pink until ~2018)
  const maroon = scan('painted_plaster_wall', 2.5, 0xa3261f, 0.3);
  worldShade(maroon, 'maroon', paint(1.7));
  const roof = scan('painted_plaster_wall', 2.0, 0xb3342a, 0.4);
  worldShade(roof, 'roof', paint(1.6));
  roof.side = THREE.DoubleSide;
  const cream = scan('painted_plaster_wall', 2.0, 0xf3d68e, 0.3);
  worldShade(cream, 'cream', paint(1.55));
  const creamTwo = cream.clone();
  creamTwo.side = THREE.DoubleSide;
  worldShade(creamTwo, 'cream2', paint(1.55));
  pending.push(Promise.all(pending.slice()).then(() => copyMaps(cream, creamTwo)));
  // limewashed compound walls and gates: whiter, chalkier
  const lime = scan('painted_plaster_wall', 2.5, 0xe9dcb8, 0.6);
  // the statue deck: brown-red glazed tiles
  const deckTile = scan('large_floor_tiles_02', 1.4, 0x8e3a28, 0.6);
  const saffron = new THREE.MeshStandardMaterial({ color: 0xf06a14, roughness: 0.8, side: THREE.DoubleSide });
  // the 2025 west gate: cream-yellow
  const gateYellow = scan('painted_plaster_wall', 2.5, 0xe8cf94, 0.5);
  worldShade(lime, 'lime', paint(1.5));

  const plaza = scan('dirty_concrete', 3.2, 0xe4ded2, 0.5);
  worldShade(plaza, 'plaza', `
    vec3 wp = vNW;
    // large-format (1.2 × 0.6 m) pale stone slabs in running bond, crisp darker joints, slab-to-slab tone
    vec2 c = wp.xz / vec2(1.2, 0.6);
    c.x += 0.5 * mod(floor(c.y), 2.0);
    vec2 f = abs(fract(c) - 0.5);
    float edge = min((0.5 - f.x) * 1.2, (0.5 - f.y) * 0.6); // metres to the nearest joint
    float joint = 1.0 - smoothstep(0.004, 0.014, edge);
    float tone = nh1(vec3(floor(c), 1.0));
    diffuseColor.rgb *= (0.92 + 0.1 * tone) * (1.0 - 0.3 * joint) * (0.92 + 0.12 * fbm3(wp * 0.2));`);
  const ground = scan('dry_ground_01', 4.5, 0xd9c09a, 1.0);
  worldShade(ground, 'ground', `
    vec3 wp = vNW;
    float n = fbm3(wp * 0.035), m = fbm3(wp * 0.21 + 3.0);
    // a patchwork of fields (green crop, olive grass, buff fallow) divided by darker bunds,
    // as in the 2025 drone views; the scan's soil shows through in the fallow plots
    vec2 fc = wp.xz / vec2(95.0, 70.0) + vec2(0.37, 0.11);
    // field edges wander (both axes warped), so the plots are not ruled rectangles
    fc += vec2(fbm3(vec3(wp.xz * 0.012, 1.0)), fbm3(vec3(wp.xz * 0.012, 7.0))) * 0.22 - 0.11;
    vec2 cid = floor(fc);
    float pick = nh1(vec3(cid, 3.0));
    vec3 crop = pick < 0.7 ? vec3(0.26, 0.72, 0.12) : pick < 0.9 ? vec3(0.42, 0.7, 0.2) : vec3(0.8, 0.85, 0.55);
    // patchy growth inside each plot: thinner, yellower crop in drifts, lusher in the wet hollows
    float patchy = fbm3(vec3(wp.xz * 0.045, pick * 9.0));
    crop = mix(crop * vec3(1.25, 1.05, 0.7), crop * vec3(0.8, 0.95, 0.85), patchy);
    // furrows / crop rows: each plot ploughed in its own direction, fading out with distance (no aliasing)
    float fa = pick * 6.2831;
    float row = sin(dot(wp.xz, vec2(cos(fa), sin(fa))) * 6.2831 / 1.1);
    float fd = 1.0 - smoothstep(25.0, 90.0, length(wp - cameraPosition));
    vec2 ff = abs(fract(fc) - 0.5);
    float bund = smoothstep(0.465, 0.497, max(ff.x, ff.y));
    float near = smoothstep(40.0, 80.0, length(wp.xz - vec2(-6.0, -38.0)));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * crop * 1.6 * (0.85 + 0.3 * n) * (1.0 + 0.09 * row * fd), near);
    diffuseColor.rgb *= 1.0 - bund * 0.22 * near;
    diffuseColor.rgb *= 0.86 + 0.24 * m;`);
  const road = scan('asphalt_02', 4, 0x9a958e, 0.8);
  const earth = scan('dry_ground_01', 3.0, 0xb59a78, 1.1);

  // the seated Shiva: off-white painted concrete, tiger skin by an object-space mask (see statue.ts)
  // the statue as repainted (≈2020 on): terracotta/peach all over
  const statue = new THREE.MeshStandardMaterial({ color: 0xe09a6c, roughness: 0.72 });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc8794e, roughness: 0.7 });
  const pedestal = new THREE.MeshStandardMaterial({ color: 0xd99068, roughness: 0.85 });
  worldShade(pedestal, 'pedestal', `
    vec3 wp = vNL;
    // peach-terracotta rock (painted like the figure), with darker crevices; at the front (+z local)
    // a tiger skin is draped over it, darker orange-brown with low-contrast stripes
    float a = atan(wp.x, wp.z);
    float flow = fbm3(vec3(a * 4.0, wp.y * 0.35, 0.0)) * 3.0;
    float crack = smoothstep(0.9, 0.99, sin(a * 18.0 + flow * 3.0 + wp.y * 0.5));
    diffuseColor.rgb *= 1.0 - crack * 0.35;
    float drape = (1.0 - smoothstep(0.75, 0.95, abs(a))) * smoothstep(0.8, 1.4, wp.y);
    float st = smoothstep(0.5, 0.85, sin(a * 40.0 + wp.y * 2.2 + flow * 2.5));
    vec3 fur = mix(vec3(0.39, 0.13, 0.042), vec3(0.1, 0.032, 0.014), st * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, fur, drape);
    diffuseColor.rgb *= 0.92 + 0.12 * fbm3(vNW * 0.8);`);

  const tiger = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0xa8643a, roughness: 0.8 });
  const serpent = new THREE.MeshStandardMaterial({ color: 0x3e322b, roughness: 0.5, metalness: 0.05 });
  const rudraksha = new THREE.MeshStandardMaterial({ color: 0x5a3220, roughness: 0.55 });

  // sanctum metals: lamp-lit reflections
  const silver = M.silver.clone();
  silver.envMap = roomEnv;
  silver.envMapIntensity = 0.9;
  silver.roughness = 0.3;
  silver.color.set(0xe4e6ec);
  const silverPlain = new THREE.MeshStandardMaterial({ color: 0xe8eaf0, metalness: 1, roughness: 0.24, envMap: roomEnv, envMapIntensity: 1.0 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xcf9a42, metalness: 1, roughness: 0.3, envMap: interiorEnv, envMapIntensity: 1.8 });
  const gold = M.gold;
  const outdoorGold = new THREE.MeshStandardMaterial({ color: 0xe8b24a, metalness: 1, roughness: 0.28 });

  // abhisheka-wet polished stone (no clearcoat pass: a plain standard material with a low roughness)
  const lingam = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: chakraTexture(), roughness: 0.5, metalness: 0,
    envMap: interiorEnv, envMapIntensity: 0.6,
  });
  // the sanctum's marble, lit by the dim lamp-lit environment (not the sky): floor pale, walls a mid warm grey
  const marbleIn = new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.3, envMap: interiorEnv, envMapIntensity: 0.7 });
  // white marble behind the garland strands (it shows in the gaps), dimmed by the lamp-lit environment
  const marbleWall = new THREE.MeshStandardMaterial({ color: 0xe0dad0, roughness: 0.4, envMap: interiorEnv, envMapIntensity: 0.6 });
  worldShade(marbleIn, 'marbleIn', `
    vec3 wp = vNW;
    float v = abs(sin(wp.x * 2.3 + wp.z * 1.7 + fbm3(wp * 1.3) * 6.0));
    diffuseColor.rgb *= 1.0 - pow(1.0 - v, 14.0) * 0.25;
    vec2 f = abs(fract(wp.xz / 0.6) - 0.5);
    diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.485, 0.5, max(f.x, f.y)) * step(0.7, abs(vNormal.y));`);
  // the hall and porch floors: white marble in daylight (sky reflections, not lamp-lit)
  const hm = scanMaterial('marble_01', 1.8, { tint: 0xfaf0e2, normalScale: 0.4 });
  const hallMarble = hm.material;
  // polished: the arm map's roughness scaled well down, for soft reflections of the doors and lamps
  pending.push(hm.loaded.then(() => { hallMarble.roughness = 0.32; hallMarble.needsUpdate = true; }));
  const ceilPanel = new THREE.MeshStandardMaterial({ color: 0xf8ecd0, roughness: 0.8, emissive: 0x3a3020 });
  const bulb = new THREE.MeshBasicMaterial({ color: 0xfff1cc });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.4, envMap: interiorEnv, envMapIntensity: 1.2 });

  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3820, roughness: 0.7 });
  // polished stainless railings at the stair head, and the gilt fluted pillars flanking the sanctum door
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 0.18, envMap: roomEnv, envMapIntensity: 1.0 });
  const giltPillar = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.3, envMap: roomEnv, envMapIntensity: 1.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e8c88, metalness: 0.3, roughness: 0.6 });
  const shedRoof = new THREE.MeshStandardMaterial({ color: 0xa8302a, roughness: 0.6, metalness: 0.2 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2c8b80, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8231c, roughness: 0.75, side: THREE.DoubleSide });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xb0121c, roughness: 0.85, side: THREE.DoubleSide });
  const zari = new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.8, roughness: 0.35, envMap: interiorEnv, envMapIntensity: 1.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 });
  const ash = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 1 });
  const kumkum = new THREE.MeshStandardMaterial({ color: 0xb3122e, roughness: 0.8 });
  const sandal = new THREE.MeshStandardMaterial({ color: 0xe0b26a, roughness: 0.9 });

  const water = new THREE.MeshStandardMaterial({ color: 0x16271c, roughness: 0.22, metalness: 0.0, envMapIntensity: 0.45 });
  const sea = new THREE.MeshStandardMaterial({ color: 0x5f7f86, roughness: 0.25 });
  const saltpan = new THREE.MeshStandardMaterial({ color: 0x7f9a8a, roughness: 0.3 });

  const scrub = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: false });
  const lawn = scan('dry_ground_01', 2.5, 0x7a9a48, 0.6);
  const grassTuft = new THREE.MeshStandardMaterial({ color: 0x4f7a26, roughness: 0.9 });
  // rain water: a mirror-like film reflecting the sky
  const puddle = new THREE.MeshStandardMaterial({ color: 0x8a96a0, roughness: 0.03, metalness: 0.85, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.95 });
  const tarpBlue = new THREE.MeshStandardMaterial({ color: 0x2a64b8, roughness: 0.7 });
  const mgYellow = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.9 });
  const mgOrange = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.9 });
  const roseBed = new THREE.MeshStandardMaterial({ color: 0xc0105a, roughness: 0.9, emissive: 0x30000f });
  const belGreen = new THREE.MeshStandardMaterial({ color: 0x3f6a22, roughness: 0.7 });
  const scrubLeaf = new THREE.MeshStandardMaterial({ color: 0x5f6b38, roughness: 0.9 });

  return {
    roomEnv,
    maroon, roof, cream, creamTwo, lime, gateYellow, deckTile, saffron, plaza, ground, road, earth,
    statue, terracotta, pedestal, tiger, ochre, serpent, rudraksha,
    silver, silverPlain, brass, gold, outdoorGold, chrome, giltPillar, lingam, marbleIn, marbleWall, hallMarble, ceilPanel, bulb, darkStone,
    wood, steel, shedRoof, teal, red, cloth, zari, dark, ash, kumkum, sandal,
    water, sea, saltpan, scrub, scrubLeaf, lawn, belGreen, tarpBlue, grassTuft, puddle, bark, mgYellow, mgOrange, roseBed,
    meander: bandMaterial(meanderCanvas()),
    parapet: bandMaterial(parapetCanvas()),
    jali: jaliMaterial(),
    om: decal(omCanvas()),
    swastika: decal(swastikaCanvas()),
    flag: flagMaterial(),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.2, metalness: 0.3 }),
    marble: M.marble,
  };
}
export type NM = ReturnType<typeof nageshwarMats>;

function copyMaps(src: THREE.MeshStandardMaterial, dst: THREE.MeshStandardMaterial) {
  dst.map = src.map; dst.normalMap = src.normalMap; dst.normalScale.copy(src.normalScale);
  dst.aoMap = src.aoMap; dst.roughnessMap = src.roughnessMap; dst.metalnessMap = src.metalnessMap;
  dst.roughness = src.roughness; dst.metalness = src.metalness; dst.color.copy(src.color);
  dst.needsUpdate = true;
}

function bandMaterial(c: HTMLCanvasElement) {
  const t = tex(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  worldShade(m, 'band' + c.width, `diffuseColor.rgb *= 0.92 + 0.14 * fbm3(vNW * 0.45);`);
  return m;
}

/** Cream frieze with a raised Greek-key (meander) in a slightly deeper cream, edged by thin lines. */
function meanderCanvas() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#efd9a0';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#b98a5a';
  g.fillRect(0, 6, 256, 5);
  g.fillRect(0, 117, 256, 5);
  g.strokeStyle = '#a8764a';
  g.lineWidth = 9;
  g.lineCap = 'square';
  // one meander unit per 128 px
  for (const ox of [0, 128]) {
    g.beginPath();
    g.moveTo(ox + 4, 100); g.lineTo(ox + 4, 26); g.lineTo(ox + 96, 26); g.lineTo(ox + 96, 84);
    g.lineTo(ox + 40, 84); g.lineTo(ox + 40, 52); g.lineTo(ox + 68, 52);
    g.moveTo(ox + 4, 100); g.lineTo(ox + 124, 100); g.lineTo(ox + 124, 26);
    g.stroke();
  }
  return c;
}

/** Maroon parapet with a running row of cream-outlined niches holding little kalash shapes. */
function parapetCanvas() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#8e3d37';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#efd9a0';
  g.fillRect(0, 0, 256, 8);
  g.fillRect(0, 120, 256, 8);
  for (const ox of [0, 128]) {
    const x = ox + 64;
    g.strokeStyle = '#efd9a0';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x - 38, 108); g.lineTo(x - 38, 52); g.quadraticCurveTo(x - 38, 20, x, 18); g.quadraticCurveTo(x + 38, 20, x + 38, 52); g.lineTo(x + 38, 108);
    g.stroke();
    g.fillStyle = '#e6c98c';
    g.beginPath(); g.ellipse(x, 80, 15, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 6, 52, 12, 14);
    g.beginPath(); g.ellipse(x, 50, 12, 5, 0, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Pierced semicircular window grille: rings of small round holes (alpha-tested). */
function jaliMaterial() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f1dca2';
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) {
    g.beginPath(); g.arc(x + 8 + ((y / 16) % 2) * 8, y + 8, 5.2, 0, Math.PI * 2); g.fill();
  }
  const t = tex(c);
  t.repeat.set(1 / 0.16, 1 / 0.16);
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
}

function decal(c: HTMLCanvasElement) {
  const t = tex(c, true, false);
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
}

/** cream roundel with a maroon ॐ (the pyramid drums and spire niches carry it) */
function omCanvas() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#efd9a0';
  g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#a8764a'; g.lineWidth = 8;
  g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#8a2f2a';
  g.font = 'bold 150px "Noto Sans Devanagari", Martel, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ॐ', 128, 140);
  return c;
}

function swastikaCanvas() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#efd9a0';
  g.fillRect(16, 16, 224, 224);
  g.strokeStyle = '#8a2f2a';
  g.lineWidth = 22;
  g.lineCap = 'square';
  g.beginPath();
  g.moveTo(128, 50); g.lineTo(128, 206);
  g.moveTo(50, 128); g.lineTo(206, 128);
  g.moveTo(128, 50); g.lineTo(196, 50);
  g.moveTo(206, 128); g.lineTo(206, 196);
  g.moveTo(128, 206); g.lineTo(60, 206);
  g.moveTo(50, 128); g.lineTo(50, 60);
  g.stroke();
  g.fillStyle = '#8a2f2a';
  for (const [x, y] of [[88, 88], [168, 88], [88, 168], [168, 168]]) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); }
  return c;
}

/** The Dwarka shila: dark brown-grey polished stone with small pale chakra (wheel) marks. */
function chakraTexture() {
  const [c, g] = canvas(512, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#5a4a3a');
  grd.addColorStop(1, '#43372c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  // mottling
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = 2 + Math.random() * 9;
    g.fillStyle = `rgba(${90 + Math.random() * 40},${70 + Math.random() * 30},${50 + Math.random() * 20},0.08)`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // chakra marks: small concentric whorls with radiating spokes
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = r() * 512, y = 30 + r() * 200, rad = 7 + r() * 9;
    g.strokeStyle = 'rgba(226,204,160,0.8)';
    g.lineWidth = 1.6;
    for (const k of [1, 0.62, 0.3]) { g.beginPath(); g.arc(x, y, rad * k, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 1;
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      g.beginPath(); g.moveTo(x + Math.cos(t) * rad * 0.3, y + Math.sin(t) * rad * 0.3); g.lineTo(x + Math.cos(t) * rad, y + Math.sin(t) * rad); g.stroke();
    }
  }
  const t = tex(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function flagMaterial() {
  // the multicolour striped dhwaja flown on the spire in the 2024–26 photos, with ॐ
  const [c, x] = canvas(512, 280);
  const bands = ['#f26a10', '#f7c52a', '#d8202a', '#1f5fa8', '#f7c52a', '#f26a10'];
  bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * 280) / bands.length, 512, 280 / bands.length + 1); });
  x.fillStyle = '#ffffff';
  x.beginPath(); x.arc(150, 140, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#c0300c';
  x.font = 'bold 100px "Noto Sans Devanagari", Martel, serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ॐ', 150, 146);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / 2.6, 1 / 1.4);
  t.offset.set(0, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
}

/** A canvas text panel (gate inscriptions, signboards). */
export function textPanel(lines: { text: string; font: string; color: string; y: number }[], w: number, h: number, bg: string | null) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const l of lines) { g.fillStyle = l.color; g.font = l.font; g.fillText(l.text, w / 2, l.y); }
  const t = tex(c, true, false);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: !bg, alphaTest: bg ? 0 : 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
}

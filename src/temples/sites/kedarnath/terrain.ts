import * as THREE from 'three';
import { fbm, ridged, vnoise } from './batch';
import { diffuse } from './mats';

/**
 * The Kedarnath valley: a glacial U-trough running north–south, the Mandakini side walls
 * rising ~1,300–1,600 m, the Chorabari moraine behind the temple and, 6–8 km north,
 * the snow wall of Kedarnath (6,940 m), Kedar Dome (6,831 m) and Bharte Khunta.
 *
 * Heights are relative to the temple floor (≈3,583 m). The terrain is a polar mesh centred
 * on the temple: fine at the pilgrim's feet, coarse kilometres away. Beyond 1.5 km it is
 * compressed radially about the temple (angular size preserved) so that peaks 7 km away fit
 * inside the camera's far plane; lighting uses the uncompressed normals.
 */

const RC = 1500; // compression starts
const RMAX = 2600; // compressed radius limit
const D = RMAX - RC; // keeps dr'/dr continuous at RC
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** named summits (relative heights above the temple's 3,583 m) */
export const PEAKS = [
  { name: 'Kedarnath', x: 240, z: -6640, h: 3357, k: 0.78, sx: 1, sz: 1.25, dome: false }, // 6,940 m
  { name: 'Kedar Dome', x: 1300, z: -8350, h: 3248, k: 0.6, sx: 1, sz: 1, dome: true }, // 6,831 m
  { name: 'Bharte Khunta', x: -3060, z: -12100, h: 2995, k: 0.85, sx: 1, sz: 1, dome: false }, // 6,578 m
  { name: 'Kedarnath east shoulder', x: 2900, z: -7300, h: 2900, k: 0.8, sx: 1.3, sz: 1, dome: false },
  { name: 'west ridge', x: -1700, z: -7600, h: 2700, k: 0.75, sx: 1.4, sz: 1, dome: false },
];

/** the Adi Shankaracharya Samadhi court behind the temple (rebuilt 2021) */
export const SAMADHI = { x: 16, z: -60, r: 12 };

/** the two glacier streams that frame Kedarpuri and meet below it */
export const RIVERS: { name: string; pts: [number, number][]; w: number; depth: number }[] = [
  { name: 'Mandakini', w: 16, depth: 5, pts: [[330, -2700], [300, -1800], [270, -900], [235, -300], [205, 100], [175, 380], [90, 560], [10, 820], [-50, 1100], [-110, 1600], [-150, 2200]] },
  { name: 'Saraswati', w: 11, depth: 4, pts: [[-420, -1700], [-300, -1000], [-215, -450], [-185, -50], [-160, 250], [-90, 470], [40, 610], [90, 560]] },
];

function segDist(x: number, z: number, a: [number, number], b: [number, number]) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
}

/** depth of the river beds at (x, z) */
function riverCut(x: number, z: number) {
  let cut = 0;
  for (const rv of RIVERS) {
    let d = Infinity;
    for (let i = 0; i < rv.pts.length - 1; i++) d = Math.min(d, segDist(x, z, rv.pts[i], rv.pts[i + 1]));
    if (d > rv.w * 4) continue;
    // a gravel bed with steep cut banks
    cut = Math.max(cut, rv.depth * (1 - sm(rv.w * 0.5, rv.w * 1.6, d)) + 1.5 * (1 - sm(rv.w, rv.w * 3.5, d)));
  }
  return cut;
}

/** radial compression about the temple (shared by every far-reaching mesh) */
export function compress(x: number, y: number, z: number): [number, number, number] {
  const r = Math.hypot(x, z);
  if (r < RC) return [x, y, z];
  const k = (RC + D * (1 - Math.exp(-(r - RC) / D))) / r;
  return [x * k, y * k, z * k];
}

/** level of the designed ground (plaza, approach path) the natural terrain must sit under */
export function pathY(z: number) {
  if (z <= 50) return 0;
  if (z <= 53.6) return -((z - 50) / 3.6) * 1.44;
  return -1.44 - (z - 53.6) * 0.045;
}

function designedMask(x: number, z: number) {
  // distance outside the plaza rectangle / path corridor
  const dxP = Math.max(0, Math.abs(x) - 36), dzP = Math.max(0, -38 - z, z - 52);
  const dPlaza = Math.hypot(dxP, dzP);
  const dxR = Math.max(0, Math.abs(x) - (z > 200 ? 9 : 22)), dzR = Math.max(0, 50 - z, z - 330);
  const dPath = Math.hypot(dxR, dzR);
  const dSam = Math.max(0, Math.hypot(x - SAMADHI.x, z - SAMADHI.z) - SAMADHI.r - 3);
  const dGap = Math.hypot(Math.max(0, Math.abs(x - SAMADHI.x) - 4), Math.max(0, -38 - z, z + 46));
  return Math.min(dPlaza, dPath, dSam, dGap);
}

/** natural ground height (real metres) */
export function naturalH(x: number, z: number) {
  // valley floor along the axis
  const d = -z;
  const floorZ = z >= 0 ? -(0.035 * z + 0.00005 * z * z) + 2400 * sm(3500, 7500, z) : 0.02 * d + 0.000032 * d * d;
  const x0 = z > 0 ? -0.06 * z : 0.04 * z;
  // half-width of the trough: ~380 m at the temple, a broad glacier basin north, gorge south
  const W = z < 0 ? 380 + 520 * sm(-800, -3200, z) : 380 - 230 * sm(300, 2500, z);
  const u = Math.abs(x - x0);
  const s = Math.max(0, u - W);
  const side = x - x0 > 0 ? 1 : -1;
  const Hs = side > 0 ? 1450 : 1300; // the eastern wall (right, seen from the square) is the higher
  let wall = Hs * (1 - Math.exp(-s / 1050)) + 0.1 * s;
  // ridges, spurs and gullies on the walls
  const rn = ridged(x / 1500 + 3.1, z / 1300 - 1.7);
  wall += (Math.pow(rn, 1.6) - 0.3) * 820 * sm(0, 700, s);
  wall += (fbm(x / 320, z / 320, 3) - 0.5) * 100 * sm(0, 250, s);
  // gullies and rock ribs running down the walls (oriented across the valley axis)
  const gully = ridged(x / 520 + 11.0, z / 170 - 4.0, 4);
  wall += (gully - 0.4) * 45 * sm(30, 350, s) * (0.6 + 0.4 * sm(200, 900, s));
  wall += (fbm(x / 90, z / 90, 2) - 0.5) * 14 * sm(0, 120, s);
  // near the town the walls are scored by sharp vertical rock ribs and gullies running straight
  // down the slope (high frequency along the valley, low across it), with brown turf between
  const near = 1 - sm(1500, 2600, Math.hypot(x, z));
  const ribs = ridged(x / 420 + 2.7, z / 48 - 6.1, 4);
  const ribs2 = ridged(x / 180 - 4.2, z / 19 + 1.9, 3);
  const ribAmp = sm(20, 260, s) * near;
  wall += (Math.pow(ribs, 1.5) - 0.35) * 18 * ribAmp + (ribs2 - 0.45) * 3 * ribAmp;
  // scree fans spilling out of the gully mouths at the foot of the walls
  const fanMouth = 1 - sm(0.25, 0.6, ribs);
  wall += 26 * sm(0, 50, s) * (1 - sm(50, 230, s)) * (0.4 + fanMouth * 0.8) * near
    + 18 * sm(0, 60, s) * (1 - sm(60, 260, s)) * fbm(x / 70, z / 70, 3);
  let h = floorZ + wall;
  // hummocky floor: moraine mounds, boulders
  h += (fbm(x / 90, z / 90, 4) - 0.5) * 9 * sm(40, 160, -z + Math.abs(x) * 0.3);
  // the debris fan rising behind the shrine towards the Chorabari moraine
  h += (fbm(x / 45 + 9, z / 45, 4) - 0.35) * 14 * sm(-45, -140, z) * (1 - sm(-900, -1500, z));
  h += Math.max(0, -z - 45) * 0.06 * (1 - sm(-600, -1200, z)) * (1 + 0.5 * Math.sin(x / 140));
  // the Chorabari lateral moraine ridges north-west / north-east of the temple
  h += 40 * Math.exp(-(((x + 300 + z * 0.08) / 70) ** 2)) * sm(-80, -400, z) * (1 - sm(-2600, -3400, z));
  h += 30 * Math.exp(-(((x - 330 - z * 0.05) / 60) ** 2)) * sm(-150, -500, z) * (1 - sm(-2400, -3200, z));

  // ---- the snow wall at the head of the valley, with its named summits ----
  // positions from survey coordinates relative to the temple (x east, z south, metres)
  const zr = -6900 + 450 * Math.sin(x / 1900 + 0.6);
  const front = Math.max(0, z - zr);
  const f2 = Math.min(front, 5500);
  let massif = 2350 - 1.15 * f2 + 0.000095 * f2 * f2 - 0.6 * Math.max(0, zr - z);
  for (const pk of PEAKS) {
    const dx = (x - pk.x) / pk.sx, dz = (z - pk.z) / pk.sz;
    const dist = Math.hypot(dx, dz);
    // pyramids fall away at a constant angle; the dome is rounded on top
    const hp = pk.dome ? pk.h - (dist * dist) / 3000 - Math.max(0, dist - 900) * 0.35 : pk.h - pk.k * dist;
    const kk = 300;
    massif = Math.max(massif, hp) + Math.max(0, kk - Math.abs(massif - hp)) ** 2 / (4 * kk) * 0.5;
  }
  const lift = sm(0, 1600, massif);
  // low-passed (wavelengths ≥ 150 m): broad snowfields and big buttresses, not crumpled foil
  const ar = ridged(x / 1300 - 7.3, z / 950 + 2.2, 3);
  massif += (ar - 0.5) * 380 * lift;
  const rib = ridged(x / 380 + 3.3, z / 600 - 8.1, 2);
  massif += (rib - 0.45) * 90 * lift;
  massif += (fbm(x / 700, z / 700, 2) - 0.5) * 150;
  // smooth max of trough and massif
  const k = 220;
  return Math.max(h, massif) + Math.max(0, k - Math.abs(h - massif)) ** 2 / (4 * k);
}

export function terrainH(x: number, z: number) {
  // the sunken Samadhi court: keep the ground below its floor
  const n = naturalH(x, z);
  const dm = designedMask(x, z);
  const target = (z > 50 ? pathY(Math.min(z, 330)) : 0) - 0.4;
  const t = sm(0, 60, dm);
  // just outside the designed area the ground falls/rises gently to nature
  return target + (Math.max(n, target - 6) - target) * t - riverCut(x, z) * sm(10, 30, dm);
}

export function buildTerrain(root: THREE.Group, pending: Promise<unknown>[]) {
  const NA = 800, NR = 250, R0 = 28, R1 = 14000;
  const ratio = Math.pow(R1 / R0, 1 / (NR - 1));
  const count = NA * NR;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const wts = new Float32Array(count * 4);
  const info = new Float32Array(count * 2);
  const real = new Float32Array(count * 3);
  for (let j = 0; j < NR; j++) {
    const r = R0 * Math.pow(ratio, j);
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, v = j * NA + i;
      real[v * 3] = x; real[v * 3 + 1] = terrainH(x, z); real[v * 3 + 2] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NR - 1; j++) {
    for (let i = 0; i < NA; i++) {
      const a = j * NA + i, b = j * NA + ((i + 1) % NA), c = (j + 1) * NA + i, d = (j + 1) * NA + ((i + 1) % NA);
      idx.push(a, b, c, b, d, c);
    }
  }
  // true (uncompressed) normals
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute('position', new THREE.BufferAttribute(real, 3));
  tmp.setIndex(idx);
  tmp.computeVertexNormals();
  nor.set(tmp.attributes.normal.array as Float32Array);
  for (let j = 0; j < NR; j++) {
    const r = R0 * Math.pow(ratio, j);
    const rc = r < RC ? r : RC + D * (1 - Math.exp(-(r - RC) / D));
    const k = rc / r;
    for (let i = 0; i < NA; i++) {
      const v = j * NA + i;
      const x = real[v * 3], h = real[v * 3 + 1], z = real[v * 3 + 2];
      pos[v * 3] = x * k; pos[v * 3 + 1] = h * k; pos[v * 3 + 2] = z * k;
      // ---- surface classes: grass · debris · rock · snow ----
      const slope = 1 - nor[v * 3 + 1];
      const n1 = fbm(x / 160, z / 160, 3), n2 = vnoise(x / 37, z / 37);
      const snowLine = 1350 - 260 * (n1 - 0.5) * 2;
      let snow = sm(snowLine - 40, snowLine + 40, h) * (1 - sm(0.35, 0.39, slope + (n1 - 0.5) * 0.1));
      // the (debris-mantled) Chorabari glacier in the upper basin: grey ice with snow patches
      const glacier = sm(-2600, -3400, z) * sm(200, 400, h) * (1 - sm(0.25, 0.4, slope)) * (1 - sm(1000, 1200, h));
      snow = Math.max(snow, glacier * sm(0.5, 0.75, n1) * 0.8);
      // rock bands and buttresses breaking through the snow face
      const band = fbm(x / 420 + 5.0, h / 160 + z / 900, 4);
      snow *= 1 - sm(0.58, 0.63, band) * sm(900, 1400, h) * 0.95;
      snow = Math.max(snow, sm(2500, 3100, h) * 0.45 * (1 - sm(0.5, 0.7, slope)));
      const bare = Math.max(sm(0.26, 0.4, slope + (n1 - 0.5) * 0.25), sm(800, 1150, h + (n1 - 0.5) * 300),
        sm(0.7, 0.82, fbm(x / 120 - 3.0, z / 120 + 7.0, 3)) * sm(80, 250, h));
      // on the near walls (≤1.5 km) turf holds everywhere but the steepest rib crests
      const nearW = (1 - sm(1500, 2400, Math.hypot(x, z))) * (1 - sm(650, 950, h));
      const bareN = bare * (1 - nearW) + sm(0.48, 0.62, slope + (n2 - 0.5) * 0.12) * nearW;
      const rock = (1 - snow) * bareN;
      const rest = 1 - snow - rock;
      // grey debris: the moraine and outwash north of the temple, scree cones, and the town ground
      const floorish = (1 - sm(0.12, 0.25, slope)) * (1 - sm(120, 300, h));
      const debris = Math.min(1, glacier + sm(-30, -160, z) * floorish * (0.75 + n1 * 0.6) * (1 - sm(-3200, -3800, z))
        + sm(0.14, 0.3, slope) * (1 - sm(150, 420, h)) * sm(0.45, 0.75, n2) * sm(-50, -300, z)
        + (1 - sm(4, 40, designedMask(x, z))) * 0.45);
      // the grey moraine band and the debris-covered Chorabari glacier tongue in front of the massif
      const band2 = sm(-1100, -1700, z) * (1 - sm(-4200, -5200, z)) * (1 - sm(0.3, 0.45, slope)) * (1 - sm(600, 900, h));
      const debris2 = Math.max(debris, band2 * (0.8 + n2 * 0.2));
      const mor = rest * debris2 * (1 - nearW * 0.85 * sm(15, 60, h));
      wts[v * 4] = rest - mor; wts[v * 4 + 1] = mor; wts[v * 4 + 2] = rock; wts[v * 4 + 3] = snow;
      info[v * 2] = Math.hypot(x, h - 2, z);
      info[v * 2 + 1] = n1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aW', new THREE.BufferAttribute(wts, 4));
  geo.setAttribute('aI', new THREE.BufferAttribute(info, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.fog = false;
  mat.envMapIntensity = 0.55;
  const uniforms = {
    tGrass: { value: null as THREE.Texture | null },
    tDebris: { value: null as THREE.Texture | null },
    tRock: { value: null as THREE.Texture | null },
    tSnow: { value: null as THREE.Texture | null },
    hazeCol: { value: new THREE.Color(0.55, 0.7, 0.95) },
  };
  pending.push(Promise.all([
    diffuse('assets/tex/rocky_terrain_02_diff.webp'), diffuse('assets/tex/gray_rocks_diff.webp'),
    diffuse('assets/tex/aerial_rocks_02_diff.webp'), diffuse('assets/tex/snow_02_diff.webp'),
  ]).then(([a, b, c, d]) => {
    uniforms.tGrass.value = a; uniforms.tDebris.value = b; uniforms.tRock.value = c; uniforms.tSnow.value = d;
  }));
  const f1 = (v: number) => v.toFixed(1);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aW; attribute vec2 aI;
        varying vec4 vWt; varying vec2 vInfo; varying vec3 vWp; varying vec3 vWN;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWt = aW; vInfo = aI; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGrass, tDebris, tRock, tSnow; uniform vec3 hazeCol;
        varying vec4 vWt; varying vec2 vInfo; varying vec3 vWp; varying vec3 vWN;
        float th(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
        // (q in cells, px = one screen pixel in cells: noise finer than a couple of pixels can't be shown, only
        // flicker as the camera moves, so it fades to its mean)
        float tnA(vec2 q, float px) { return mix(tn(q), 0.5, smoothstep(0.25, 0.6, px)); }
        float kh(vec2 q, float fw) { return tnA(q / 131.0, fw / 131.0) * 25.0 + tnA(q / 37.0 + 3.1, fw / 37.0) * 8.0
          + tnA(q / 11.0 - 1.7, fw / 11.0) * 2.5 + tnA(q / 3.3, fw / 3.3) * 0.5; }
        vec3 tri(sampler2D t, vec2 p, float s) {
          return texture2D(t, p / s).rgb * 0.65 + texture2D(t, p / (s * 7.3) + 0.37).rgb * 0.35;
        }`)
      .replace('#include <map_fragment>', `
        if (length(vWp.xz - vec2(${f1(SAMADHI.x)}, ${f1(SAMADHI.z)})) < ${f1(SAMADHI.r - 0.02)}) discard; // the sunken Samadhi court
        vec2 kp; float kfw;
        {
          // texture in true (uncompressed) metres so distant faces are not smeared
          float rc = length(vWp.xz);
          float rr = rc < ${f1(RC)} ? rc : ${f1(RC)} - ${f1(D)} * log(max(1e-6, 1.0 - (rc - ${f1(RC)}) / ${f1(D)}));
          vec2 p = vWp.xz * (rr / max(rc, 1.0));
          kp = p;
          // one screen pixel, in metres of ground
          float fw = max(length(dFdx(p)), length(dFdy(p)));
          kfw = fw;
          float far = smoothstep(150.0, 900.0, vInfo.x);
          // mottling at several scales: lichen, wet patches, sun-burnt turf
          float m1 = tnA(p / 23.0, fw / 23.0), m2 = tnA(p / 71.0 + 4.0, fw / 71.0), m3 = tnA(p / 260.0 - 2.0, fw / 260.0);
          float mott = 0.72 + 0.28 * m1 + 0.3 * (m2 - 0.5) + 0.35 * (m3 - 0.5);
          vec3 grass = tri(tGrass, p, 9.0) * 0.72;
          // late-season turf: mostly russet and straw-brown, green only in damp hollows
          float gl = dot(grass, vec3(0.33));
          // alpine meadow: olive-green turf with russet and straw patches
          // olive-green alpine turf (≈ sRGB 95,105,65 on average), russet only in dry patches
          vec3 olive = vec3(0.085, 0.15, 0.05) * (0.7 + gl * 1.1); // summer alpine meadow, fresh green
          vec3 russet = vec3(gl) * vec3(1.3, 1.0, 0.6);
          grass = mix(olive, russet, smoothstep(0.42, 0.62, m2 * 0.55 + vInfo.y * 0.45) * 0.3);
          grass = mix(grass, vec3(gl) * vec3(0.95, 0.95, 0.9), smoothstep(0.6, 0.85, m1) * 0.4); // grey scree among the turf
          // scattered rocks and stones poking through the meadow
          float spk = smoothstep(0.74, 0.8, tnA(p / 5.0, fw / 5.0) * 0.6 + tnA(p / 1.7 + 7.0, fw / 1.7) * 0.4);
          grass = mix(grass, vec3(0.17, 0.17, 0.165) * (0.7 + m1 * 0.6), spk * 0.85 * (1.0 - far));
          vec3 deb = tri(tDebris, p, 6.0);
          deb = mix(deb, vec3(dot(deb, vec3(0.33))), 0.6) * vec3(0.6, 0.62, 0.64);
          vec3 rock = tri(tRock, p, 30.0);
          float lr = dot(rock, vec3(0.33));
          rock = mix(rock, vec3(lr) * vec3(0.98, 0.9, 0.82), 0.85) * 0.4;
          vec3 snow = mix(vec3(1.0, 1.0, 1.02), tri(tSnow, p, 14.0) * 1.1, 0.25);
          // far away the scans average out: lean on flat albedos
          grass = mix(grass, mix(vec3(0.075, 0.13, 0.045), vec3(0.12, 0.13, 0.06), smoothstep(0.35, 0.6, m3 * 0.5 + vInfo.y * 0.5)) * (0.8 + vInfo.y * 0.4), far * 0.35);
          deb = mix(deb, vec3(0.16, 0.15, 0.14), far * 0.3);
          rock = mix(rock, vec3(0.1, 0.088, 0.075) * (0.7 + vInfo.y * 0.6), far * 0.3);
          grass *= mott; deb *= mix(1.0, mott, 0.7); rock *= mix(1.0, mott, 0.8);
          vec4 w = vWt / max(0.001, dot(vWt, vec4(1.0)));
          // snow can't hold on steep faces: dark rock buttresses and ribs stripe the snow wall
          float steep = 1.0 - normalize(vWN).y;
          float ribs = tnA(vec2(p.x / 55.0, p.y / 140.0) + 11.0, fw / 55.0) * 0.6 + tnA(p / 23.0, fw / 23.0) * 0.4;
          // couloirs and rock streaks running down the fall line: long in the slope direction, narrow across it
          vec2 fall = normalize(vWN.xz + vec2(1e-4));
          vec2 acr = vec2(-fall.y, fall.x);
          float cou = tnA(vec2(dot(p, acr) / 45.0, dot(p, fall) / 400.0) + 3.0, fw / 45.0);
          float cut = smoothstep(0.24, 0.3, steep + (ribs - 0.5) * 0.3) * w.w;
          cut = max(cut, smoothstep(0.62, 0.68, cou) * smoothstep(0.1, 0.2, steep) * w.w);
          vec3 darkRock = vec3(0.042, 0.042, 0.047) * (0.8 + ribs * 0.5); // ≈ #3a3a3e
          diffuseColor.rgb = grass * w.x + deb * w.y + rock * w.z + mix(snow, darkRock, cut) * w.w;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // procedural relief finer than the mesh: boulders, crevasses, crags
          vec4 w = vWt / max(0.001, dot(vWt, vec4(1.0)));
          float amt = w.x * 0.3 + w.y * 0.6 + w.z * 1.4 + w.w * 0.15 * (1.0 - smoothstep(600.0, 2500.0, vInfo.x));
          float e = 1.5;
          float dx = (kh(kp + vec2(e, 0.0), kfw) - kh(kp - vec2(e, 0.0), kfw)) / (2.0 * e);
          float dz = (kh(kp + vec2(0.0, e), kfw) - kh(kp - vec2(0.0, e), kfw)) / (2.0 * e);
          vec3 gW = vec3(-dx, 0.0, -dz) * amt;
          normal = normalize(normal + (viewMatrix * vec4(gW, 0.0)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          float haze = 1.0 - exp(-max(0.0, vInfo.x - 500.0) / 40000.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, clamp(haze, 0.0, 0.3));
        }`);
  };
  mat.customProgramCacheKey = () => 'kedar-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}

/** boulders strewn over the moraine and the meadows round the town (one instanced draw) */
export function scatterBoulders(root: THREE.Group, mat: THREE.Material, geo: THREE.BufferGeometry) {
  const N = 2600;
  const inst = new THREE.InstancedMesh(geo, mat, N);
  let seed = 1234567;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  for (let tries = 0; tries < 6000 && n < N; tries++) {
    const north = r() < 0.65;
    const a = north ? Math.PI * (1.15 + r() * 0.7) : r() * Math.PI * 2;
    const rad = r() < 0.6 ? 30 + r() * 90 : 40 + Math.pow(r(), 1.6) * 520;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (designedMask(x, z) < 6) continue;
    if (z > 40 && Math.abs(x) < 70) continue; // the town
    const size = 0.35 + Math.pow(r(), 3) * 3.2;
    const y = terrainH(x, z) - size * 0.3;
    e.set(r() * 3, r() * 6.3, r() * 3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(size * (0.8 + r() * 0.5), size * (0.5 + r() * 0.4), size * (0.8 + r() * 0.5)));
    inst.setMatrixAt(n++, m);
  }
  // stones in the stream beds, breaking the water
  for (const rv of RIVERS) {
    for (let i = 0; i < rv.pts.length - 1 && n < N; i++) {
      const [ax, az] = rv.pts[i], [bx, bz] = rv.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L && n < N; d += 4 + r() * 6) {
        const t = d / L, x0 = ax + (bx - ax) * t, z0 = az + (bz - az) * t;
        if (Math.hypot(x0, z0) > 1200) continue;
        const nx = -(bz - az) / L, nz = (bx - ax) / L, off = (r() - 0.5) * rv.w * 1.4;
        const x = x0 + nx * off, z = z0 + nz * off;
        const size = 0.3 + Math.pow(r(), 2) * 1.6;
        e.set(r() * 3, r() * 6.3, r() * 3);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, terrainH(x, z) + 0.2, z), q, new THREE.Vector3(size, size * 0.6, size * (0.8 + r() * 0.4)));
        inst.setMatrixAt(n++, m);
      }
    }
  }
  inst.count = n;
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.computeBoundingSphere();
  root.add(inst);
}

/** milky glacial water running in the carved beds */
export function buildRivers(root: THREE.Group, normals: THREE.Texture) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: foamMap(), roughness: 0.4, envMapIntensity: 0.5, metalness: 0.0, normalMap: normals, side: THREE.DoubleSide });
  mat.normalScale.setScalar(0.7);
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  normals.repeat.set(0.25, 0.08);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const rv of RIVERS) {
    // densify the polyline
    const pts: [number, number][] = [];
    for (let i = 0; i < rv.pts.length - 1; i++) {
      const [ax, az] = rv.pts[i], [bx, bz] = rv.pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    pts.push(rv.pts[rv.pts.length - 1]);
    const base = pos.length / 3;
    let along = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      let tx = nx - px, tz = nz - pz;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const half = rv.w * 0.42 * (0.75 + 0.5 * vnoise(x / 40, z / 40));
      const y = terrainH(x, z) + 0.15;
      if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      for (const s of [-1, 1]) {
        const [cx, cy, cz] = compress(x - tz * half * s, y, z + tx * half * s);
        pos.push(cx, cy, cz);
        uv.push(s * half, along);
      }
      if (i > 0) {
        const a = base + (i - 1) * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  root.add(mesh);
  return { mesh, update: (t: number) => { normals.offset.set(t * 0.02, -t * 0.35); mat.map!.offset.set(0, -t * 0.6); } };
}

/** glacial water: milky grey-turquoise with white riffles streaming down the current */
function foamMap() {
  const W = 64, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#43585a'; g.fillRect(0, 0, W, H);
  let seed = 9;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, len = 6 + r() * 30, w = 1 + r() * 2.5;
    g.fillStyle = `rgba(215,222,222,${0.15 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, w, len, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 8, 1 / 24);
  return t;
}

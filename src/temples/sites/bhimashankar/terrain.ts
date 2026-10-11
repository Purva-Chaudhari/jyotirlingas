import * as THREE from 'three';
import { FINE, FINE_B64, COARSE, COARSE_B64 } from './dem';
import { COURT, RIM, STAIR, STAIR_TOP_X, STAIR_TOP_Y, PLAZA, MOKSHA, stairY } from './layout';

/**
 * The ground round Bhimashankar from real SRTM elevations: the temple in the head of the Bhima gully at
 * ~915 m, the village on the slopes to the north, forested hills east (to ~1010 m) and west, and — barely
 * 1.5 km to the west — the crest of the Western Ghats, where the escarpment falls ~800 m in basalt cliffs
 * to the Konkan. The SRTM cells smooth the Deccan-trap scarps, so steep ground is re-terraced into the
 * stepped lava-flow benches and near-vertical cliffs seen from Nagphani.
 *
 * Near the temple the ground is designed: the sunken courtyard, its retaining-wall rims, the stairway cut
 * and the village terraces, eased into the natural ground over ~60 m. Beyond RC the terrain is compressed
 * radially about the temple (angular size preserved) so the far hills fit inside the camera's far plane.
 */

/** monsoon haze colour shared by the scene fog and the terrain's own aerial perspective */
export const FOG_COLOR = 0xb4c0c2;
export const FOG = { near: 35, far: 1500 };

const RC = 1400;
const D = 2600;
const DEM_E0 = -11.0; // model (x north, z east) → DEM (east e, north n) about the OSM reference point
const DEM_N0 = 7.1;

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function decode(b64: string, n: number) {
  const bin = atob(b64);
  const dv = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = dv.getInt16(i * 2, true) / 10;
  return g;
}
let gf: Float32Array | null = null, gc: Float32Array | null = null;

function sampleGrid(G: Float32Array, spec: { n: number; step: number; r: number }, e: number, nn: number) {
  const n = spec.n;
  const fi = (e + spec.r) / spec.step, fj = (nn + spec.r) / spec.step;
  const i = Math.floor(fi), j = Math.floor(fj);
  const at = (a: number, b: number) => G[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))];
  const cub = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const tx = fi - i, ty = fj - j;
  const row = (b: number) => cub(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), tx);
  return cub(row(j - 1), row(j), row(j + 1), row(j + 2), ty);
}

/** SRTM height (m, relative to the courtyard) at model (x north, z east): the 30 m grid near, 150 m far */
export function srtm(x: number, z: number) {
  if (!gf) { gf = decode(FINE_B64, FINE.n); gc = decode(COARSE_B64, COARSE.n); }
  const e = z + DEM_E0, n = x + DEM_N0;
  const c = sampleGrid(gc!, COARSE, e, n);
  const lim = FINE.r - FINE.step * 2;
  const d = Math.max(Math.abs(e), Math.abs(n));
  if (d > lim) return c;
  const f = sampleGrid(gf!, FINE, e, n);
  return f + (c - f) * sm(lim - 200, lim, d);
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function fbm(x: number, y: number, oct = 4) {
  let a = 0.5, f = 1, s = 0, t = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); t += a; a *= 0.5; f *= 2.03; }
  return s / t;
}

let lastCliff = 0;
/** natural ground with Deccan-trap terracing on the scarps */
export function naturalH(x: number, z: number) {
  let h = srtm(x, z);
  lastCliff = 0;
  const r = Math.hypot(x, z);
  // the escarpment: SRTM rounds the cliff edges; re-terrace steep ground into lava-flow benches
  const e = 40;
  const sl = Math.hypot(srtm(x + e, z) - srtm(x - e, z), srtm(x, z + e) - srtm(x, z - e)) / (2 * e);
  const steep = sm(0.32, 0.7, sl) * sm(250, 600, r);
  if (steep > 0) {
    const band = 46;
    const ph = (h + 14 * (fbm(x / 500, z / 500, 3) - 0.5) * 2) / band;
    const f = Math.floor(ph), fr = ph - f;
    const stepped = (f + sm(0.62, 0.94, fr)) * band;
    h += (stepped - h) * 0.85 * steep;
    lastCliff = sm(0.55, 0.7, fr) * (1 - sm(0.94, 1.0, fr)) * steep;
  }
  // gullies and texture finer than the DEM
  h += (fbm(x / 110, z / 110, 4) - 0.5) * 9 * sm(30, 200, r) + (fbm(x / 30, z / 30, 3) - 0.5) * 2.2 * sm(40, 120, r);
  return h;
}

type Zone = [number, number, number, number, (x: number, z: number) => number];
/** designed ground: courtyard, wall rims, stair cutting, village terraces, the plaza at the road-head */
const ZONES: Zone[] = [
  // the stepped tank's pit, then the courtyard reaching into the thickness of its retaining walls (so the
  // terrain's step up to the rims happens inside the masonry, never in front of it)
  [MOKSHA.x0 - 0.3, MOKSHA.x1 + 0.3, MOKSHA.z0 - 0.3, MOKSHA.z1 + 0.3, () => -4],
  [COURT.x0 - 0.1, COURT.x1 + 0.7, COURT.z0 - 0.7, COURT.z1 + 0.7, () => -0.08],
  [STAIR.x0, STAIR_TOP_X, STAIR.z0 - 1.6, STAIR.z1 + 1.6, (x) => stairY(x) - 0.3],
  [COURT.x1, COURT.x1 + 6, STAIR.z1, COURT.z1 + 8, () => RIM.n],
  [COURT.x0, COURT.x1, COURT.z0 - 7, COURT.z0, () => RIM.w],
  [COURT.x0 - 6, COURT.x1, COURT.z1, COURT.z1 + 9, () => RIM.e],
  [COURT.x0 - 7, COURT.x0, COURT.z0, COURT.z1, () => RIM.s],
  [COURT.x1 + 6, STAIR_TOP_X, STAIR.z1, 12, (x) => Math.max(RIM.n, stairY(x - 3) + 0.1)],
  [STAIR.x0, STAIR_TOP_X, -44, STAIR.z0, (x) => Math.max(RIM.w, stairY(x - 3) + 0.1)],
  [PLAZA.x0 - 2, PLAZA.x1, PLAZA.z0, PLAZA.z1, () => STAIR_TOP_Y],
];

function rectDist(x: number, z: number, z0: Zone) {
  const dx = Math.max(z0[0] - x, 0, x - z0[1]), dz = Math.max(z0[2] - z, 0, z - z0[3]);
  return Math.hypot(dx, dz);
}

/** distance outside the designed area and the design height nearest there */
export function design(x: number, z: number): [number, number] {
  let best = 1e9, h = 0;
  for (const zn of ZONES) {
    const d = rectDist(x, z, zn);
    if (d < best - 1e-6) { best = d; h = zn[4](Math.min(zn[1], Math.max(zn[0], x)), Math.min(zn[3], Math.max(zn[2], z))); }
    if (best === 0) break;
  }
  return [best, h];
}

export function terrainH(x: number, z: number) {
  const [d, hd] = design(x, z);
  const n = naturalH(x, z);
  const t = sm(0, 70, d);
  lastCliff *= t;
  // the slopes above the walls never dip below the rim they retain
  const base = hd + (n - hd) * t;
  return d < 30 && hd > 1 ? Math.max(base, hd - d * 0.05) : base;
}

export function compress(x: number, y: number, z: number): [number, number, number] {
  const r = Math.hypot(x, z);
  if (r < RC) return [x, y, z];
  const k = (RC + D * (1 - Math.exp(-(r - RC) / D))) / r;
  return [x * k, y * k, z * k];
}

const diffLoader = new THREE.TextureLoader();
const diff = (url: string) => diffLoader.loadAsync(url).then((t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
});

export function buildTerrain(root: THREE.Group, pending: Promise<unknown>[]) {
  const NA = 600, NR = 250, R0 = 20, R1 = 11000;
  const ratio = Math.pow(R1 / R0, 1 / (NR - 1));
  const count = NA * NR;
  const real = new Float32Array(count * 3);
  const cliffs = new Float32Array(count);
  for (let j = 0; j < NR; j++) {
    const r = R0 * Math.pow(ratio, j);
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, v = j * NA + i;
      real[v * 3] = x; real[v * 3 + 1] = terrainH(x, z); real[v * 3 + 2] = z; cliffs[v] = lastCliff;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NR - 1; j++) {
    for (let i = 0; i < NA; i++) {
      const a = j * NA + i, b = j * NA + ((i + 1) % NA), c = (j + 1) * NA + i, d = (j + 1) * NA + ((i + 1) % NA);
      idx.push(a, b, c, b, d, c);
    }
  }
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute('position', new THREE.BufferAttribute(real, 3));
  tmp.setIndex(idx);
  tmp.computeVertexNormals();
  const nor = tmp.attributes.normal.array as Float32Array;
  const pos = new Float32Array(count * 3);
  const info = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const x = real[v * 3], h = real[v * 3 + 1], z = real[v * 3 + 2];
    const [cx, cy, cz] = compress(x, h, z);
    pos[v * 3] = cx; pos[v * 3 + 1] = cy; pos[v * 3 + 2] = cz;
    info[v * 4] = Math.hypot(x, h - 2, z);
    info[v * 4 + 1] = h;
    const [dd] = design(x, z);
    info[v * 4 + 2] = Math.min(1, dd / 40); // 0 in the village / precinct
    info[v * 4 + 3] = cliffs[v];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor.slice(), 3));
  geo.setAttribute('aI', new THREE.BufferAttribute(info, 4));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.fog = false;
  mat.envMapIntensity = 0.3;
  const uniforms = {
    tLeaf: { value: null as THREE.Texture | null },
    tRock: { value: null as THREE.Texture | null },
    tSoil: { value: null as THREE.Texture | null },
    tGrass: { value: null as THREE.Texture | null },
    hazeCol: { value: new THREE.Color(FOG_COLOR) },
  };
  pending.push(Promise.all([
    diff('assets/tex/forest_leaves_02_diff.webp'), diff('assets/tex/dark_rock_02_diff.webp'),
    diff('assets/tex/red_laterite_soil_stones_diff.webp'), diff('assets/tex/rocky_terrain_02_diff.webp'),
  ]).then(([a, b, c, d]) => { uniforms.tLeaf.value = a; uniforms.tRock.value = b; uniforms.tSoil.value = c; uniforms.tGrass.value = d; }));
  const f1 = (v: number) => v.toFixed(1);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aI;\nvarying vec4 vInfo; varying vec3 vWp; varying vec3 vWn;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vInfo = aI; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tLeaf, tRock, tSoil, tGrass; uniform vec3 hazeCol;
        varying vec4 vInfo; varying vec3 vWp; varying vec3 vWn;
        float th(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
        vec3 tri(sampler2D t, vec2 p, float s) { return texture2D(t, p / s).rgb * 0.6 + texture2D(t, p / (s * 6.7) + 0.31).rgb * 0.4; }`)
      .replace('#include <map_fragment>', `
        {
          float rc = length(vWp.xz);
          float rr = rc < ${f1(RC)} ? rc : ${f1(RC)} - ${f1(D)} * log(max(1e-6, 1.0 - (rc - ${f1(RC)}) / ${f1(D)}));
          vec2 p = vWp.xz * (rr / max(rc, 1.0));
          float far = smoothstep(150.0, 1800.0, vInfo.x);
          float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
          float h = vInfo.y;
          float m1 = tn(p / 23.0), m2 = tn(p / 81.0 + 4.0), m3 = tn(p / 300.0 - 2.0), m4 = tn(p / 7.0 + 9.0);
          // evergreen canopy seen from above: lumpy crowns, dark gaps, a few red-brown new-leaf crowns
          float crowns = smoothstep(0.25, 0.75, tn(p / 6.0) * 0.6 + tn(p / 2.3 + 3.0) * 0.4);
          vec3 leaf = tri(tLeaf, p, 4.0);
          float ll = dot(leaf, vec3(0.33));
          vec3 canopy = mix(vec3(0.025, 0.065, 0.014), vec3(0.09, 0.17, 0.035), crowns) * (0.75 + ll * 0.7); // round 3: brighter monsoon canopy
          canopy = mix(canopy, vec3(0.09, 0.05, 0.025) * (0.8 + ll), smoothstep(0.82, 0.95, m4 * 0.5 + m1 * 0.5) * 0.6);
          // monsoon grass on the plateau tops and meadows (the 'pathar'), straw where it thins
          vec3 gr = tri(tGrass, p, 6.0);
          vec3 grass = mix(vec3(0.05, 0.085, 0.02), vec3(0.09, 0.11, 0.03), m2) * (0.7 + dot(gr, vec3(0.33)) * 0.8);
          float meadow = smoothstep(0.6, 0.8, m3 * 0.7 + m2 * 0.3) * smoothstep(25.0, 60.0, h) * (1.0 - smoothstep(0.25, 0.4, slope));
          vec3 veg = mix(canopy, grass, meadow);
          // under the trees, near the pilgrim: wet leaf litter, red earth showing through, moss
          float nearG = (1.0 - smoothstep(70.0, 280.0, vInfo.x)) * (1.0 - smoothstep(25.0, 70.0, cameraPosition.y - vWp.y));
          // round 3: under the forest a dark leaf litter, mostly green with moss, ferns and seedlings (no laterite)
          vec3 litter = tri(tLeaf, p, 2.2) * vec3(0.2, 0.2, 0.12);
          litter = mix(litter, vec3(0.045, 0.1, 0.025) * (0.8 + 0.5 * tn(p / 1.7)), 0.35 + 0.5 * smoothstep(0.2, 0.6, tn(p / 4.0)));
          veg = mix(veg, litter, nearG * (1.0 - meadow * 0.7));
          // the Konkan floor far below: fields and scrub between forest patches
          float konkan = 1.0 - smoothstep(-600.0, -450.0, h);
          veg = mix(veg, mix(grass * 0.9, canopy, smoothstep(0.45, 0.65, m2)), konkan * 0.8);
          vec3 rock = tri(tRock, p, 14.0);
          rock = mix(rock, vec3(dot(rock, vec3(0.33))), 0.6) * vec3(0.24, 0.24, 0.22);
          rock *= 0.7 + 0.45 * tn(vec2(p.x * 0.3 + p.y * 0.3, h * 0.05));
          rock = mix(rock, vec3(0.04, 0.06, 0.03), smoothstep(0.55, 0.8, tn(vec2(p.x * 0.6 - p.y * 0.4, h * 0.3))) * 0.6); // wet green streaks
          vec3 soil = tri(tSoil, p, 4.0) * vec3(0.46, 0.33, 0.27);
          float cliff = max(smoothstep(0.55, 0.75, slope + (m1 - 0.5) * 0.15), smoothstep(0.3, 0.6, vInfo.w + (m1 - 0.5) * 0.3));
          float village = 1.0 - smoothstep(0.0, 0.2, vInfo.z);
          vec3 c = mix(veg, rock, cliff);
          c = mix(c, mix(soil * vec3(0.8, 0.85, 0.75), mix(soil, vec3(0.05, 0.09, 0.03), 0.6), m1), village * 0.55);
          c = mix(c, mix(vec3(0.022, 0.04, 0.012), vec3(0.045, 0.045, 0.04), cliff), far * 0.45);
          diffuseColor.rgb = c;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= 0.1;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          // monsoon haze: thick in the Konkan below the escarpment, lifting on the plateau
          float d = vInfo.x;
          float haze = 1.0 - exp(-d / 2600.0);
          float low = 1.0 - smoothstep(-500.0, -100.0, vInfo.y);
          // match the scene's linear fog near the pilgrim so the forest and the ground fade together
          float lin = clamp((d - ${f1(FOG.near)}) / ${f1(FOG.far - FOG.near)}, 0.0, 1.0);
          haze = clamp(max(haze * (1.0 + low * 0.6), lin * 0.9), 0.0, 0.9);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, haze);
        }`);
  };
  mat.customProgramCacheKey = () => 'bhima-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'terrain';
  root.add(mesh);
  return { mesh, haze: uniforms.hazeCol };
}

export { RC, D, sm };
export const STAIR_TOP = { x: STAIR_TOP_X, y: STAIR_TOP_Y };

import * as THREE from 'three';
import { DEM, DEM_B64 } from './dem';
import { prng } from './merge';

/**
 * The ground round Srisailam from real SRTM elevations: the temple town on its plateau (~431 m SRTM)
 * in the Nallamala hills, the Krishna's gorge cut ~170 m down to the Srisailam reservoir (water at
 * ~257 m in the SRTM epoch) — to the west (3 km) and, via the Patalaganga ravine, to the north-east —
 * with forested plateaus and bare quartzite scarps. Beyond RC the terrain is compressed radially
 * (angular size kept from the temple) so the far hills fit inside the camera's far plane.
 *
 * Axes: +x = east, +z = south.
 */
const RC = 1500;
const D = 2600;
export const WATER_Y = 257 - 431;
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let grid: Float32Array | null = null;
function dem() {
  if (!grid) {
    const bin = atob(DEM_B64);
    const n = DEM.n * DEM.n;
    const dv = new DataView(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
    grid = new Float32Array(n);
    for (let i = 0; i < n; i++) grid[i] = dv.getInt16(i * 2, true) / 10;
  }
  return grid;
}

/** bicubic sample of the SRTM grid at (east x, south z), metres relative to the courtyard */
export function srtm(x: number, z: number) {
  const G = dem(), n = DEM.n;
  const fi = (x + DEM.r) / DEM.step, fj = (-z + DEM.r) / DEM.step;
  const i = Math.floor(fi), j = Math.floor(fj);
  const at = (a: number, b: number) => G[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))];
  const cub = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const tx = fi - i, ty = fj - j;
  const row = (b: number) => cub(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), tx);
  return cub(row(j - 1), row(j), row(j + 1), row(j + 2), ty);
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

/** designed ground: the walled complex, its forecourt and the temple street to Nandi circle */
export const DESIGN = { x0: -124, x1: 262, z0: -140, z1: 112, streetZ: 13 };
export function designDist(x: number, z: number) {
  const dx = Math.max(0, DESIGN.x0 - x, x - Math.min(DESIGN.x1, 130));
  const dz = Math.max(0, DESIGN.z0 - z, z - DESIGN.z1);
  const dC = Math.hypot(dx, dz);
  const dS = Math.hypot(Math.max(0, 130 - x, x - DESIGN.x1), Math.max(0, Math.abs(z) - 40));
  return Math.min(dC, dS);
}
/** designed level: 0 in the court and on the street, 2.4 m to the west (the Bhramaramba terrace side) */
export function designH(x: number) {
  return 2.4 * sm(-95, -104, x);
}

let lastCliff = 0;
export function naturalH(x: number, z: number) {
  let h = srtm(x, z);
  lastCliff = 0;
  const r = Math.hypot(x, z);
  // the gorge walls: SRTM rounds the quartzite scarps; steepen the drops a little and terrace them
  const below = sm(-15, -60, h);
  if (below > 0) {
    const band = 34;
    const ph = (h + 9 * (fbm(x / 500, z / 500, 3) - 0.5) * 2) / band;
    const f = Math.floor(ph), fr = ph - f;
    const stepped = (f + sm(0.62, 0.95, fr)) * band;
    h += (stepped - h) * 0.6 * below;
    lastCliff = sm(0.55, 0.7, fr) * (1 - sm(0.93, 1.0, fr)) * below;
  }
  h += (fbm(x / 140, z / 140, 4) - 0.5) * 8 * sm(150, 600, r) + (fbm(x / 40, z / 40, 3) - 0.5) * 2.4 * sm(80, 300, r);
  return h;
}

export function terrainH(x: number, z: number) {
  // keep the ground under the Mallika Gundam below its floor
  if (Math.abs(x + 40) < 4.6 && Math.abs(z - 44) < 4.6) return -2.6;
  const d = designDist(x, z);
  const n = naturalH(x, z);
  const t = sm(0, 80, d);
  lastCliff *= t;
  // well below the paving inside the walls (no z-fighting from high above), just below it outside
  const inWalls = x > -94.5 && x < 66.5 && z > -113.5 && z < 86.5;
  const base = inWalls ? -0.4 : designH(x) - 0.1;
  return base + (n - base) * t;
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
  const NA = 448, NR = 220, R0 = 8, R1 = 9000;
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
  // make sure the normals face up whatever the winding
  let ny = 0;
  for (let i = 1; i < nor.length; i += 3 * 97) ny += nor[i];
  if (ny < 0) for (let i = 0; i < nor.length; i++) nor[i] = -nor[i];
  const pos = new Float32Array(count * 3);
  const info = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const x = real[v * 3], h = real[v * 3 + 1], z = real[v * 3 + 2];
    const [cx, cy, cz] = compress(x, h, z);
    pos[v * 3] = cx; pos[v * 3 + 1] = cy; pos[v * 3 + 2] = cz;
    info[v * 4] = Math.hypot(x, h - 2, z);
    info[v * 4 + 1] = h;
    info[v * 4 + 2] = fbm(x / 180, z / 180, 3);
    // the paved town ground round the walls (designed area, outside the prakara): flagged negative
    const inW = x > -95 && x < 67 && z > -114 && z < 87;
    const dd = designDist(x, z);
    info[v * 4 + 3] = !inW && dd < 6 ? -(1 - dd / 6) : cliffs[v];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor.slice(), 3));
  geo.setAttribute('aI', new THREE.BufferAttribute(info, 4));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.fog = false;
  mat.envMapIntensity = 0.35;
  const uniforms = {
    tGrass: { value: null as THREE.Texture | null },
    tRock: { value: null as THREE.Texture | null },
    tSoil: { value: null as THREE.Texture | null },
    hazeCol: { value: new THREE.Color(0.68, 0.75, 0.84) },
  };
  pending.push(Promise.all([diff('assets/tex/rocky_terrain_02_diff.webp'), diff('assets/tex/dark_rock_02_diff.webp'), diff('assets/tex/red_laterite_soil_stones_diff.webp')])
    .then(([a, b, c]) => { uniforms.tGrass.value = a; uniforms.tRock.value = b; uniforms.tSoil.value = c; }));
  const f1 = (v: number) => v.toFixed(1);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aI;\nvarying vec4 vInfo; varying vec3 vWp; varying vec3 vWn;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vInfo = aI; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGrass, tRock, tSoil; uniform vec3 hazeCol;
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
          float far = smoothstep(250.0, 1800.0, vInfo.x);
          float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
          float h = vInfo.y;
          float m1 = tn(p / 31.0), m2 = tn(p / 97.0 + 4.0), m3 = tn(p / 340.0 - 2.0);
          // Nallamala dry-deciduous forest after the rains: olive-green canopy, straw grass, red laterite
          vec3 grass = tri(tGrass, p, 7.0);
          float gl = dot(grass, vec3(0.33));
          vec3 green = mix(vec3(0.035, 0.05, 0.016), vec3(0.075, 0.08, 0.03), m2) * (0.75 + gl * 0.6);
          vec3 straw = vec3(0.14, 0.115, 0.06) * (0.75 + gl * 0.6);
          vec3 veg = mix(green, straw, smoothstep(0.55, 0.85, vInfo.z * 0.6 + m3 * 0.4));
          veg = mix(veg, vec3(0.02, 0.032, 0.012), smoothstep(0.55, 0.78, m1 * 0.6 + m2 * 0.4) * 0.75);
          vec3 rock = tri(tRock, p, 16.0);
          rock = mix(rock, vec3(dot(rock, vec3(0.33))), 0.4) * vec3(0.36, 0.3, 0.27);
          rock *= 0.75 + 0.35 * tn(vec2(p.x * 0.05 + p.y * 0.05, h * 0.4));
          vec3 soil = mix(tri(tSoil, p, 5.0) * vec3(0.44, 0.33, 0.25), grass * vec3(0.36, 0.36, 0.26), 0.45);
          float cliff = max(smoothstep(0.45, 0.66, slope + (m1 - 0.5) * 0.15), smoothstep(0.25, 0.6, max(vInfo.w, 0.0) + (m1 - 0.5) * 0.3));
          float bare = smoothstep(0.72, 0.9, m2 * 0.7 + m1 * 0.3) * (1.0 - cliff);
          float town = 1.0 - smoothstep(380.0, 900.0, vInfo.x + (m2 - 0.5) * 200.0);
          vec3 c = mix(veg, rock, cliff);
          c = mix(c, soil, max(bare * 0.45, town * 0.3));
          // the reservoir's draw-down band: bare pale rock just above the water
          c = mix(c, vec3(0.2, 0.18, 0.16), (1.0 - smoothstep(${f1(WATER_Y + 4)}, ${f1(WATER_Y + 16)}, h)) * 0.8);
          c = mix(c, mix(vec3(0.035, 0.05, 0.02), vec3(0.06, 0.055, 0.05), cliff), far * 0.5);
          // paved streets and squares round the temple: grey stone slabs with joints and stains
          float paved = clamp(-vInfo.w * 1.6, 0.0, 1.0);
          if (paved > 0.0) {
            vec2 cell = fract(p / vec2(2.4, 1.2)), id = floor(p / vec2(2.4, 1.2));
            float joint = 1.0 - smoothstep(0.0, 0.03, min(min(cell.x, 1.0 - cell.x) * 2.0, min(cell.y, 1.0 - cell.y)));
            vec3 slab = vec3(0.30, 0.29, 0.27) * (0.85 + 0.3 * th(id)) * (0.8 + 0.3 * dot(tri(tRock, p, 6.0), vec3(0.33)));
            slab *= 1.0 - 0.45 * joint;
            slab *= 1.0 - 0.25 * smoothstep(0.6, 0.85, tn(p / 7.0));
            c = mix(c, slab, paved);
          }
          diffuseColor.rgb = c;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= 0.12;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          float haze = 1.0 - exp(-vInfo.x / 22000.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, clamp(haze, 0.0, 0.5));
        }`);
  };
  mat.customProgramCacheKey = () => 'srisailam-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);

  // the reservoir (Krishna) filling the gorges: a disc compressed exactly like the terrain
  const wm = new THREE.MeshStandardMaterial({ color: 0x2a4a50, roughness: 0.1, metalness: 0.3, envMapIntensity: 1.0 });
  wm.fog = false;
  const WA = 256, WR = 90;
  const wpos = new Float32Array(WA * WR * 3);
  for (let j = 0; j < WR; j++) {
    const r = 200 * Math.pow(9000 / 200, j / (WR - 1));
    for (let i = 0; i < WA; i++) {
      const a = (i / WA) * Math.PI * 2;
      const [cx, cy, cz] = compress(Math.cos(a) * r, WATER_Y, Math.sin(a) * r);
      wpos.set([cx, cy, cz], (j * WA + i) * 3);
    }
  }
  const widx: number[] = [];
  for (let j = 0; j < WR - 1; j++) for (let i = 0; i < WA; i++) {
    const a = j * WA + i, b = j * WA + ((i + 1) % WA), c = (j + 1) * WA + i, d = (j + 1) * WA + ((i + 1) % WA);
    widx.push(a, b, c, b, d, c);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  wg.setIndex(widx);
  wg.computeVertexNormals();
  { const wn = wg.attributes.normal; for (let i = 0; i < wn.count; i++) wn.setXYZ(i, -wn.getX(i), -wn.getY(i), -wn.getZ(i)); if (wn.getY(0) < 0) for (let i = 0; i < wn.count; i++) wn.setXYZ(i, -wn.getX(i), -wn.getY(i), -wn.getZ(i)); }
  const water = new THREE.Mesh(wg, wm);
  water.frustumCulled = false;
  water.receiveShadow = false;
  root.add(water);
  return mesh;
}

/** canopy blob (+ optional trunk), vertex-coloured, for the instanced forest */
function treeGeo(detail: number, trunk: boolean) {
  const canopy = new THREE.IcosahedronGeometry(1, detail);
  const p = canopy.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4);
    p.setXYZ(i, x * k, y * 0.75 * k + 1.6, z * k);
  }
  canopy.computeVertexNormals();
  const parts = [canopy.toNonIndexed()];
  if (trunk) parts.push(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 5).translate(0, 0.7, 0).toNonIndexed());
  const cols = [new THREE.Color(1, 1, 1), new THREE.Color(0.35, 0.27, 0.2)];
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  parts.forEach((g, k) => {
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
    for (let i = 0; i < g.attributes.position.count; i++) col.push(cols[k].r, cols[k].g, cols[k].b);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/**
 * Nallamala forest and the town's trees: two instanced draws of vertex-coloured canopy blobs —
 * rounder ones with trunks within ~800 m, 20-facet ones beyond — dense on the plateau and slopes,
 * none on the scarps or in the water.
 */
export function scatterTrees(root: THREE.Group, avoid: (x: number, z: number) => boolean, nearSpots: [number, number, number, number, number][] = []) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });
  const N = 8000;
  const near = new THREE.InstancedMesh(treeGeo(1, true), mat, N), far = new THREE.InstancedMesh(treeGeo(0, false), mat, N);
  let nn = 0, nf = 0;
  const r = prng(98765);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let tries = 0; tries < 90000 && nn + nf < N; tries++) {
    const ang = r() * Math.PI * 2, rad = 50 + Math.pow(r(), 1.6) * 4200;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    const inWalls = x > -100 && x < 72 && z > -120 && z < 92;
    const onStreet = x > 60 && x < 262 && Math.abs(z) < 52;
    const westApproach = x < -95 && x > -125 && z > -30 && z < -2;
    if (inWalls || onStreet || westApproach || designDist(x, z) < 18 || avoid(x, z)) continue;
    const h = terrainH(x, z);
    if (h < WATER_Y + 3) continue;
    const e = 6;
    const sl = Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    if (sl > 0.8) continue;
    // the town (within ~700 m) has scattered trees; the forest beyond is dense
    const town = rad < 650 ? 0.9 : 1;
    const dens = town * (0.45 + 0.55 * fbm(x / 160, z / 160, 3)) * (1 - Math.min(1, sl * 0.9));
    if (r() > dens) continue;
    const size = (rad < 900 ? 3.4 : 2.6) + r() * 3.6;
    const [cx, cy, cz] = compress(x, h - 0.3, z);
    const k = Math.hypot(cx, cz) / Math.max(1, Math.hypot(x, z));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(size * k, size * k * (0.8 + r() * 0.4), size * k));
    if (rad < 350) {
      // near trees are drawn as leaf-card trees (trees.ts); collect them
      if (nearSpots.length < 1100) nearSpots.push([cx, cy, cz, size * k * 2.0, 0.9]);
      nn++;
      continue;
    }
    far.setMatrixAt(nf, m);
    c.setHSL(0.24 + r() * 0.06, 0.38 + r() * 0.18, 0.025 + r() * 0.025); // deep Nallamala green
    far.setColorAt(nf++, c);
  }
  void near;
  far.count = nf;
  for (const im of [far]) {
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    root.add(im);
  }
}

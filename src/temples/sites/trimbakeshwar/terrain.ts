import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEM, DEM_B64 } from './dem';

/**
 * The ground round Trimbak from real SRTM elevations: the town on its shelf at ~719 m, the hill spur
 * 1–1.5 km west, Brahmagiri's massif rising south-west to ~1,130 m (SRTM) with the Godavari's source on
 * its flank, Anjaneri to the south-east. The SRTM grid smooths the Deccan-trap scarps, so heights above
 * the town are re-terraced into benches and near-vertical basalt cliffs (the lava flows), as photographed.
 *
 * Axes: +x = north, +z = east. Beyond RC the terrain is compressed radially about the temple
 * (angular size preserved from the courtyard) so that the far hills fit within the camera's far plane.
 */

const RC = 1300;
const D = 2200; // compressed radius limit RC + D
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

/** bicubic-smooth sample of the SRTM grid at (north x, east z), metres relative to the courtyard */
export function srtm(x: number, z: number) {
  const G = dem(), n = DEM.n;
  const fi = (z + DEM.r) / DEM.step, fj = (x + DEM.r) / DEM.step;
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

/** designed (flat) ground: the walled compound and the street to the east */
export const DESIGN = { x0: -42, x1: 42, z0: -40, z1: 200, sx0: -9, sx1: 9 };
export function designDist(x: number, z: number) {
  const dC = Math.hypot(Math.max(0, Math.abs(x) - 42), Math.max(0, -40 - z, z - 60));
  const dS = Math.hypot(Math.max(0, Math.abs(x) - 10), Math.max(0, 60 - z, z - 200));
  return Math.min(dC, dS);
}

let lastCliff = 0;
/** natural ground (metres above the courtyard) with Deccan-trap terracing on the hills */
export function naturalH(x: number, z: number) {
  let h = srtm(x, z);
  lastCliff = 0;
  // SRTM's cells round off the scarps (its Brahmagiri peaks ~1,130 m vs the real ~1,295 m) and a 62° lens shrinks
  // them: hills beyond the town are exaggerated ×1.8 vertically above 150 m, bringing the scarp to ~15–16° as photographed
  h *= 1 + 0.8 * sm(400, 1200, Math.hypot(x, z)) * sm(60, 150, h);
  const hill = sm(40, 140, h);
  if (hill > 0) {
    const band = 104; // fewer, taller lava flows: grassy slopes broken by a few sheer scarps
    const ph = (h + 18 * (fbm(x / 600, z / 600, 3) - 0.5) * 2) / band;
    const f = Math.floor(ph), fr = ph - f;
    const stepped = (f + sm(0.84, 0.93, fr)) * band;
    h += (stepped - h) * 0.92 * hill;
    // the riser of each lava flow is a bare basalt scarp
    lastCliff = sm(0.8, 0.85, fr) * (1 - sm(0.94, 0.99, fr)) * hill * sm(70, 140, h);
  }
  // gullies and texture finer than the DEM
  h += (fbm(x / 120, z / 120, 4) - 0.5) * 10 * sm(10, 80, h) + (fbm(x / 35, z / 35, 3) - 0.5) * 3 * sm(5, 40, h);
  return h;
}

export function terrainH(x: number, z: number) {
  // keep the ground under the Amrut Kund (x −30.5…−19.5, z −27…−16) below the tank floor
  if (x > -31.5 && x < -18.5 && z > -28 && z < -15) return -4.2;
  const d = designDist(x, z);
  const n = naturalH(x, z);
  const t = sm(0, 90, d);
  lastCliff *= t;
  // the town shelf round the compound eases gently to the natural ground
  return -0.35 + (n + 0.35) * t;
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
  const NA = 720, NR = 300, R0 = 24, R1 = 12000;
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
    info[v * 4 + 2] = fbm(x / 180, z / 180, 3);
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
    tGrass: { value: null as THREE.Texture | null },
    tRock: { value: null as THREE.Texture | null },
    tSoil: { value: null as THREE.Texture | null },
    hazeCol: { value: new THREE.Color(0.66, 0.74, 0.84) },
  };
  pending.push(Promise.all([diff('assets/tex/rocky_terrain_02_diff.webp'), diff('assets/tex/dark_rock_02_diff.webp'), diff('assets/tex/gray_rocks_diff.webp')])
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
          float far = smoothstep(200.0, 1500.0, vInfo.x);
          float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
          float h = vInfo.y;
          float m1 = tn(p / 31.0), m2 = tn(p / 97.0 + 4.0), m3 = tn(p / 340.0 - 2.0);
          // late-monsoon grass: green on the slopes, yellowing on the plateau, olive scrub patches
          vec3 grass = tri(tGrass, p, 7.0);
          float gl = dot(grass, vec3(0.33));
          vec3 green = mix(vec3(0.03, 0.055, 0.012), vec3(0.07, 0.08, 0.025), m2) * (0.75 + gl * 0.6);
          vec3 straw = vec3(0.13, 0.11, 0.055) * (0.75 + gl * 0.6);
          green = mix(green, vec3(dot(green, vec3(0.3, 0.59, 0.11))) * vec3(1.1, 1.0, 0.78), 0.55);
          vec3 veg = mix(green, straw, smoothstep(0.45, 0.8, vInfo.z * 0.6 + m3 * 0.4 + smoothstep(150.0, 380.0, h) * 0.45));
          veg = mix(veg, vec3(0.018, 0.03, 0.01), smoothstep(0.6, 0.8, m1 * 0.6 + m2 * 0.4) * 0.7); // scrub
          vec3 rock = tri(tRock, p, 18.0);
          rock = mix(rock, vec3(dot(rock, vec3(0.33))), 0.5) * vec3(0.3, 0.29, 0.28);
          // vertical banding on the scarps (columnar joints, rain streaks)
          rock *= 0.75 + 0.35 * tn(vec2(p.x * 0.35 + p.y * 0.35, h * 0.02));
          vec3 soil = tri(tSoil, p, 5.0) * vec3(0.36, 0.3, 0.24);
          float cliff = max(smoothstep(0.42, 0.62, slope + (m1 - 0.5) * 0.15), smoothstep(0.25, 0.6, vInfo.w + (m1 - 0.5) * 0.3));
          float bare = smoothstep(0.75, 0.9, m2 * 0.7 + m1 * 0.3) * (1.0 - cliff) * smoothstep(5.0, 30.0, h);
          float town = 1.0 - smoothstep(4.0, 25.0, h + slope * 40.0);
          vec3 c = mix(veg, rock, cliff);
          // the bare lava-flow risers: dark basalt (#3b3a36) with vertical rain streaks and columnar joints
          float riser = smoothstep(0.2, 0.55, vInfo.w + (m1 - 0.5) * 0.25);
          float vst = 0.65 + 0.35 * tn(vec2((p.x + p.y) * 0.5, h * 0.015)) * tn(vec2((p.x - p.y) * 0.13, 1.0));
          c = mix(c, vec3(0.045, 0.043, 0.039) * vst * 1.4, riser);
          c = mix(c, soil, max(bare * 0.6, town * 0.55));
          // beyond the town: a patchwork of small fields (paddy green, ploughed brown, stubble) on the flat
          {
            float rr0 = length(p);
            vec2 fq = vec2(p.x * 0.8 + p.y * 0.6, -p.x * 0.6 + p.y * 0.8);
            vec2 cell = floor(fq / vec2(46.0, 30.0));
            float fh = th(cell);
            vec3 fcol = fh < 0.35 ? vec3(0.05, 0.075, 0.02) : fh < 0.65 ? vec3(0.12, 0.085, 0.05) : fh < 0.85 ? vec3(0.15, 0.13, 0.07) : vec3(0.07, 0.08, 0.03);
            vec2 fe = abs(fract(fq / vec2(46.0, 30.0)) - 0.5);
            fcol *= 0.85 + 0.3 * tn(p / 5.0);
            fcol = mix(vec3(0.05, 0.06, 0.025), fcol, step(max(fe.x, fe.y), 0.47)); // bunds
            float fields = smoothstep(380.0, 470.0, rr0) * (1.0 - smoothstep(2200.0, 2600.0, rr0)) * (1.0 - smoothstep(10.0, 40.0, h)) * (1.0 - smoothstep(0.08, 0.2, slope));
            c = mix(c, fcol, fields * 0.85);
          }
          // far away the scans average out: lean on flat albedos
          c = mix(c, mix(vec3(0.03, 0.045, 0.015), vec3(0.05, 0.047, 0.044), cliff), far * 0.5);
          diffuseColor.rgb = c;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // rough grass and rock: the sky's grazing reflection (Fresnel on a 0.95-rough surface) washes the hills out
        reflectedLight.indirectSpecular *= 0.12;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          float haze = 1.0 - exp(-vInfo.x / 38000.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, clamp(haze, 0.0, 0.55));
        }`);
  };
  mat.customProgramCacheKey = () => 'trimbak-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}

/** a canvas card of small mango / jamun-like leaves, dark varied greens on transparent */
function leafCard() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  let sd = 4321;
  const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const greens = ['#24361a', '#2d4220', '#38502a', '#425c2c', '#4c6630', '#33461f', '#58703a'];
  for (let i = 0; i < 170; i++) {
    const d = Math.sqrt(rr()) * 56, a = rr() * Math.PI * 2;
    g.save();
    g.translate(64 + Math.cos(a) * d, 64 + Math.sin(a) * d);
    g.rotate(a + Math.PI / 2 + (rr() - 0.5) * 1.4);
    g.fillStyle = greens[Math.floor(rr() * greens.length)];
    const L = 5 + rr() * 5;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-L * 0.45, -L * 0.5, 0, -L * 1.6);
    g.quadraticCurveTo(L * 0.45, -L * 0.5, 0, 0);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Trees and scrub on the lower slopes and round the town: one instanced draw of a unit tree — a short
 * trunk and a lobed crown of ~34 alpha-tested leaf-cluster cards whose normals radiate from the crown,
 * so it shades as soft foliage (no faceted blobs).
 */
export function scatterTrees(root: THREE.Group, extra: [number, number, number][] = []) {
  let sd = 2468;
  const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const parts: THREE.BufferGeometry[] = [];
  const lobes = Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + rr(), d = i === 0 ? 0 : 0.35 + rr() * 0.25;
    return { c: new THREE.Vector3(Math.cos(a) * d, 1.7 + (rr() - 0.3) * 0.4, Math.sin(a) * d), r: 0.6 + rr() * 0.25 };
  });
  for (let i = 0; i < 34; i++) {
    const lb = lobes[i % lobes.length];
    const dir = new THREE.Vector3(rr() * 2 - 1, rr() * 1.6 - 0.5, rr() * 2 - 1).normalize();
    const pos = lb.c.clone().addScaledVector(dir, lb.r * (0.55 + 0.45 * rr()));
    const size = 1.0 + rr() * 0.55;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rr() * 6.28);
    card.lookAt(dir.clone().add(new THREE.Vector3((rr() - 0.5), (rr() - 0.5), (rr() - 0.5))));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - 1.75) / 0.8, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    parts.push(card.toNonIndexed());
  }
  const trunk = new THREE.CylinderGeometry(0.07, 0.13, 1.5, 6, 1, true).translate(0, 0.75, 0).toNonIndexed();
  // the trunk samples a dark-brown corner of the leaf card (u, v ≈ 0.02): no extra texture or draw
  const tuv = trunk.attributes.uv;
  for (let k = 0; k < tuv.count; k++) tuv.setXY(k, 0.01, 0.01);
  const geo = mergeGeometries([...parts, trunk])!;
  const tex = leafCard();
  {
    // paint the corner the trunk samples
    const cv = tex.image as HTMLCanvasElement, g2 = cv.getContext('2d')!;
    g2.fillStyle = '#3a2c20';
    g2.fillRect(0, 118, 10, 10);
    tex.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  const N = 2800 + extra.length;

  const inst = new THREE.InstancedMesh(geo, mat, N);
  let seed = 98765;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let n = 0;
  // the town's lane and yard trees first
  for (const [x, z, sz] of extra) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3);
    m.compose(new THREE.Vector3(x, terrainH(x, z) - 0.3, z), q, new THREE.Vector3(sz * 0.9, sz * (0.85 + r() * 0.3), sz * 0.9));
    inst.setMatrixAt(n, m);
    c.setHSL(0.22 + r() * 0.06, 0.3 + r() * 0.2, 0.6 + r() * 0.25);
    inst.setColorAt(n, c);
    n++;
  }
  for (let tries = 0; tries < 60000 && n < N; tries++) {
    const a = r() * Math.PI * 2, rad = 70 + Math.pow(r(), 1.3) * 3800;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (designDist(x, z) < 20) continue;
    if (Math.hypot(x, z * 0.85) < 330 && r() < 0.8) continue;
    const h = terrainH(x, z);
    const e = 6;
    const sl = Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    if (sl > 0.75) continue;
    // trees cluster in the gullies and on the lower slopes, thin out on the plateau
    const dens = (1 - Math.min(1, Math.max(0, (h - 260) / 120))) * (0.35 + 0.65 * fbm(x / 160, z / 160, 3));
    if (r() > dens) continue;
    const size = 2.2 + r() * 3.5;
    const [cx, cy, cz] = compress(x, h - 0.3, z);
    const k = Math.hypot(cx, cz) / Math.max(1, Math.hypot(x, z));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(size * k, size * k * (0.8 + r() * 0.4), size * k));
    inst.setMatrixAt(n, m);
    c.setHSL(0.2 + r() * 0.08, 0.2 + r() * 0.2, 0.55 + r() * 0.3);
    inst.setColorAt(n, c);
    n++;
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  root.add(inst);
  return inst;
}

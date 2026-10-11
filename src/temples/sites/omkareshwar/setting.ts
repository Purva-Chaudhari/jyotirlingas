import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics, Flames } from '../../engine/kit';
import { waterNormals } from '../../engine/materials';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import { WATER_Y, JHOOLA, MAMLESHWAR, LANE, GHAT } from './layout';
import { rekhaGeometry, phamsanaGeometry, rnd, reseed } from './util';
import { boatGeometries, canopyGeometry, polesGeometry } from './boats';
import { leafTrees } from './nature';

/**
 * Mandhata island and the Narmada: the island's hill crowded with pastel houses and the old palace,
 * dark layered rock along the water, the south (Omkareshwar town / Mamleshwar) bank opposite,
 * the Jhoola pul suspension bridge upstream (east) with its orange towers, the concrete road bridge
 * downstream (west), the dam's long wall far upstream, and boats with yellow canopies at the ghats.
 */

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.25 + vnoise(x * 4.3, z * 4.3) * 0.125;

/** island's bank line (water's edge), z as a function of x */
export const bankN = (x: number) => 38 + 7 * Math.sin(x / 70 + 0.6) * smooth(60, 140, Math.abs(x)) + (x < -90 ? (-90 - x) * 0.05 : 0);
/** the south bank's water line */
export const bankS = (x: number) => 196 + 9 * Math.sin(x / 95 + 1.2) + (x > 300 ? (x - 300) * 0.1 : 0);

/** Ground height (m). Hidden under the built-up core where floors and galleries stand. */
export function heightAt(x: number, z: number): number {
  const zn = bankN(x), zs = bankS(x);
  let h: number;
  if (z < zn + 4) {
    const d = zn - z; // inland distance
    // dark rock ledges and cliff rising from the water, then the hill of Mandhata
    // where the cliff face stands back from the water (behind the ghat and the lane near the temple)
    const cs = 6 + 16 * smooth(-90, -50, x) * (1 - smooth(130, 170, x));
    const strata = (vnoise(x / 9, 3.3) - 0.5) * 1.6;
    // the cliff climbs in horizontal beds (the gorge's bedded rock): quantise its rise into ~0.9 m terraces
    let rise = 12.8 * smooth(cs, cs + 7, d);
    rise = Math.floor(rise / 0.9) * 0.9 + smooth(0.55, 1.0, (rise / 0.9) % 1) * 0.9;
    const cliff = -22 + 7 * smooth(-3, 1.5, d) + (2.2 + strata) * smooth(3, 9, d) + rise;
    const hill = Math.max(0, d - 26) * 0.46 * (0.75 + 0.35 * Math.sin(x / 160 + 0.4)) - Math.max(0, d - 200) * 0.3;
    const ridges = (fbm(x / 40, z / 40) - 0.5) * 8 * smooth(10, 50, d);
    h = cliff + hill + ridges;
    // hilltop plateau ~ +78
    h = Math.min(h, 82 + (fbm(x / 60, z / 60) - 0.5) * 10);
  } else if (z > zs - 4) {
    const d = z - zs;
    h = -22 + 16 * smooth(-4, 10, d) + Math.max(0, d - 10) * 0.08 + Math.min(30, Math.max(0, d - 180) * 0.1) + (fbm(x / 50, z / 50) - 0.5) * 5 * smooth(10, 40, d);
  } else {
    h = -22;
  }
  // the island ends ~1 km north at the Kaveri channel (the Narmada's northern arm); the mainland beyond
  if (z < -780) {
    const north = -980 + 40 * Math.sin(x / 210);
    if (z > north) h = Math.min(h, -22 + 104 * smooth(north, north + 200, z) + 6 * smooth(north, north + 12, z));
    else if (z > north - 95) h = -22;
    else h = -22 + 14 * smooth(north - 95, north - 120, z) + 30 * smooth(north - 150, north - 600, z) + (fbm(x / 60, z / 60) - 0.5) * 8;
  }
  // bare rock shelves of the gorge just above the water: by the Jhoola pul on both banks and on the
  // promontory west of the ghat (c01, c03, c05, c32)
  {
    const zn = bankN(x), zs = bankS(x);
    const near = (x > 62 && x < 210) || (x > -120 && x < -80);
    if (near) {
      const off = Math.min(z - zn, zs - z); // distance out into the river from the nearest bank
      if (off > -4 && off < 26) {
        const mask = smooth(0.42, 0.6, fbm(x / 26 + 3.1, z / 26)) * (1 - smooth(14, 26, off));
        const bench = WATER_Y + 0.6 + Math.floor(fbm(x / 13, z / 13) * 4) * 0.9;
        if (mask > 0.01) h = Math.max(h, THREE.MathUtils.lerp(-22, bench, Math.min(1, mask * 2.2)));
      }
    }
  }
  // flatten the temple's cliff-top terrace and hide the ground under the built core
  const inCore = x > -46 && x < 40;
  if (inCore && z > -22 && z <= 3) h = THREE.MathUtils.lerp(h, -0.06, smooth(-46, -40, x) * (1 - smooth(34, 40, x)) * smooth(-22, -16, z));
  if (inCore && z > 3 && z < 26) h = Math.min(h, -13);
  // under the temple block itself (the sanctum floor is sunk below the hall's)
  if (x > -14.5 && x < 15 && z > -18 && z < 3) h = Math.min(h, -1.2);
  // under the lane and the ghat
  if (x > 30 && x < 125 && z > 16.5 && z < 26) h = Math.min(h, -12.6);
  if (x > GHAT.x0 - 2 && x < GHAT.x1 + 2 && z > 23 && z < 41) h = Math.min(h, -17.6);
  // palace terrace
  const px = x - PALACE.x, pz = z - PALACE.z;
  if (Math.abs(px) < 36 && Math.abs(pz) < 12) h = PALACE.y - 0.3;
  return h;
}

export const PALACE = { x: -82, z: -46, y: 14, w: 58, d: 14, h: 15 };
/** Ekatma Dham on the summit (~1.1 km WNW of the temple) */
export const EKATMA = { x: -1100, z: -120 };

/** Rock, scrub and grass by slope and height, as vertex colours under the rock scan. */
function groundColor(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const n = fbm(x / 22, z / 22);
  const rock = new THREE.Color(0x6a645c).lerp(new THREE.Color(0x4e4944), n);
  const grass = new THREE.Color(0x3c5a24).lerp(new THREE.Color(0x52682a), n).lerp(new THREE.Color(0x2c4a1c), smooth(0.5, 0.8, fbm(x / 9, z / 9)));
  const dirt = new THREE.Color(0x8a7458);
  let k = smooth(0.45, 0.9, slope) * 0.9 + (h < WATER_Y + 4 ? 0.8 : 0);
  k = Math.min(1, k);
  out.copy(grass).lerp(dirt, 0.6 * smooth(0.68, 0.9, fbm(x / 35 + 7, z / 35))).lerp(rock, k);
  // everything within ~6 m of the water is the gorge's bare grey bedded rock
  if (h < WATER_Y + 6) out.lerp(new THREE.Color(0x5f5a55).multiplyScalar(0.85 + 0.3 * n), smooth(WATER_Y + 6, WATER_Y + 3, h));
  // layered strata on steep rock: alternating darker and paler beds
  if (k > 0.5) out.multiplyScalar(0.82 + 0.22 * Math.sin(h * 2.3 + Math.sin(x * 0.05) * 1.5) ** 2);
  // the wet dark band at the waterline
  if (h < WATER_Y + 1.2) out.multiplyScalar(0.62);
}

function terrainMesh(size: number, seg: number, cx: number, cz: number, mat: THREE.Material, drop: (x: number, z: number) => number) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  g.translate(cx, 0, cz);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const e = size / seg;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = heightAt(x, z) - drop(x, z);
    p.setY(i, h);
    const sx = heightAt(x + e, z) - heightAt(x - e, z), sz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.hypot(sx, sz) / (2 * e);
    groundColor(x, z, h, slope, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // UVs in metres for the rock scan: planar from above on gentle ground, from the front on cliffs
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const sx = heightAt(x + e, z) - heightAt(x - e, z), sz = heightAt(x, z + e) - heightAt(x, z - e);
    const k = smooth(0.5, 1.2, Math.hypot(sx, sz) / (2 * e));
    uv.setXY(i, x, z * (1 - k) + (-y * 1.4 + z * 0.15) * k);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/**
 * Town houses: one instanced box whose facade is drawn in the shader in each house's own metres
 * (approach of trimbakeshwar/town.ts): storey slab lines, bays of grilled windows with frames and
 * chajja shadows, balconies, shop shutters at street level, rain streaks; flat grey RCC roofs.
 */
function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLN; varying vec3 vScl; varying float vSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 im = mat4(1.0);
          #ifdef USE_INSTANCING
            im = instanceMatrix;
          #endif
          vScl = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
          vLoc = position * vScl;
          vLN = normal;
          vSeed = fract(sin(dot(im[3].xz, vec2(12.99, 78.23))) * 43758.5);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLoc; varying vec3 vLN; varying vec3 vScl; varying float vSeed;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 base = diffuseColor.rgb;
          if (abs(vLN.y) > 0.5) {
            diffuseColor.rgb = vec3(0.44, 0.43, 0.41) * (0.75 + 0.35 * fn(vLoc.xz * 0.7));
          } else {
            bool alongX = abs(vLN.z) > 0.5;
            float u = alongX ? vLoc.x : vLoc.z;
            float halfW = alongX ? vScl.x * 0.5 : vScl.z * 0.5;
            float y = vLoc.y - 1.5; // the box is sunk 1.5 m into the slope
            float storey = floor(y / 3.0), fy = mod(y, 3.0);
            float nb = max(1.0, floor(2.0 * halfW / 2.6));
            float bw = 2.0 * halfW / nb;
            float fu = mod(u + halfW, bw) - bw * 0.5;
            float top = vScl.y - 1.5;
            vec3 c = base;
            float streak = fn(vec2(u * 1.7, y * 0.12 + vSeed * 9.0));
            c *= 0.8 + 0.24 * streak;
            float slab = step(2.8, fy) + step(top - 0.15, y);
            c = mix(c, c * 1.1 + 0.03, slab * 0.8);
            if (y < 0.0) {
              c *= 0.7; // plinth / retaining wall on the slope
            } else if (storey < 0.5 && vSeed > 0.45) {
              if (abs(fu) < bw * 0.4 && fy < 2.4) {
                float rib = 0.5 + 0.5 * sin(fy * 70.0);
                c = mix(vec3(0.33, 0.34, 0.35), vec3(0.47), rib) * (vSeed > 0.75 ? 0.5 : 1.0);
              }
            } else if (y < top - 0.8) {
              float wx = abs(fu), wyc = fy - 1.45;
              bool balcony = vSeed > 0.6 && storey > 0.5 && mod(floor((u + halfW) / bw), 2.0) < 1.0;
              if (balcony && fy < 1.05 && wx < bw * 0.45) c = mix(c, vec3(0.62, 0.62, 0.6), 0.6) * (0.6 + 0.4 * step(0.5, fract(fu * 6.0)));
              else if (wx < 0.6 && abs(wyc) < 0.6) {
                bool frame = wx > 0.53 || abs(wyc) > 0.53;
                float grill = step(0.92, fract((fu + 0.6) / 0.15)) + step(0.9, fract((wyc + 0.6) / 0.3));
                c = frame ? vec3(0.8, 0.78, 0.74) : mix(vec3(0.06, 0.07, 0.08), vec3(0.3), min(1.0, grill) * 0.6);
              }
              if (wx < 0.8 && fy > 2.1 && fy < 2.22) c *= 0.45;
              if (wx < 0.5 && wyc < -0.6) c *= 1.0 - 0.18 * smoothstep(0.0, -1.2, wyc + 0.6) * streak;
            }
            diffuseColor.rgb = c;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'omk-facade';
  return m;
}

/**
 * Ekatma Dham: the 108 ft (33 m) bronze Adi Shankaracharya - the "Statue of Oneness", 2023 - on a 54 ft pedestal
 * on a red-stone lotus base atop Mandhata hill, facing south over the Narmada. ~1.1 km WNW of the temple
 * (approx. 22.246 N, 76.140 E - position estimated). Built as a respectful silhouette: a young ascetic
 * walking, robe falling to the feet, a danda (staff) in the left hand; no facial detail at all.
 */
function ekatmaDham(B: Batch, K: OM, x: number, z: number) {
  const y = heightAt(x, z);
  const red = K.pinkDark, bronze = K.bronze;
  // a 60 x 60 m paved plaza on the hilltop, a kerb, and the Shankar museum's low pink-sandstone blocks
  B.span(K.ghat, x - 30, x + 30, y - 4, y + 1.5, z - 30, z + 30);
  B.span(K.pink, x - 30.4, x + 30.4, y + 1.5, y + 2.1, z - 30.4, z - 29.6);
  B.span(K.pink, x - 30.4, x + 30.4, y + 1.5, y + 2.1, z + 29.6, z + 30.4);
  B.span(K.pink, x - 30.4, x - 29.6, y + 1.5, y + 2.1, z - 30, z + 30);
  B.span(K.pink, x + 29.6, x + 30.4, y + 1.5, y + 2.1, z - 30, z + 30);
  for (const [bx, bz, bw, bd, bh] of [[-48, -18, 26, 14, 7], [-46, 14, 20, 12, 6], [44, -10, 18, 22, 6.5]] as const) {
    const by = Math.min(heightAt(x + bx, z + bz), y + 1.5);
    B.span(K.pink, x + bx - bw / 2, x + bx + bw / 2, by - 3, y + 1.5 + bh, z + bz - bd / 2, z + bz + bd / 2);
    B.span(red, x + bx - bw / 2 - 0.5, x + bx + bw / 2 + 0.5, y + 1.5 + bh, y + 2.3 + bh, z + bz - bd / 2 - 0.5, z + bz + bd / 2 + 0.5);
    // a row of small chhatri domes on the roofline
    for (let k = -1; k <= 1; k++) B.lathe(red, [[0, 0], [1.4, 0], [1.4, 0.4], [1.2, 1.2], [0.6, 1.8], [0.1, 2.2], [0, 2.3]], x + bx + k * bw * 0.32, y + 2.3 + bh, z + bz, 12);
    // a deep colonnade along the plaza face
    for (let k = 0; k < Math.floor(bw / 2.4); k++) B.span(K.dark, x + bx - bw / 2 + 0.8 + k * 2.4, x + bx - bw / 2 + 2.2 + k * 2.4, y + 1.5, y + 4.3, z + bz + (bz < 0 ? bd / 2 : -bd / 2) - 0.05, z + bz + (bz < 0 ? bd / 2 : -bd / 2) + 0.05);
  }
  B.lathe(red, [[0, 0], [9, 0], [9, 2], [8, 2.4], [8, 9.5], [8.8, 10], [8.8, 10.8], [0, 10.8]], x, y + 1.5, z, 8, Math.PI / 8); // pedestal
  // the lotus base (petals as a ring of flattened lobes)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(1, 10, 8).scale(1.4, 2.4, 0.7).rotateY(-a).translate(x + Math.cos(a) * 5.4, y + 14.2, z + Math.sin(a) * 5.4);
    B.add(red, petal);
  }
  B.lathe(red, [[0, 0], [6.3, 0], [6.6, 2.5], [5.6, 4.6], [0, 4.6]], x, y + 12.3, z, 24);
  // The statue: the boy-ascetic Shankara, 33 m, walking forward (south), robe to the ankles, a shawl over
  // the left shoulder, the danda in the left hand, the right hand raised in blessing; no facial detail.
  const fy = y + 16.9;
  const hd = 33 / 7; // head height of a youth ~7 heads tall
  // feet and the hem of the robe, a little stride
  B.add(bronze, new THREE.CapsuleGeometry(0.55, 1.8, 4, 10).rotateX(Math.PI / 2).translate(x - 1.0, fy + 0.55, z + 1.2));
  B.add(bronze, new THREE.CapsuleGeometry(0.55, 1.8, 4, 10).rotateX(Math.PI / 2).translate(x + 1.0, fy + 0.55, z - 0.4));
  // robe: a gently flared, slightly asymmetric lathe from the ankles to the chest, folds as ribs
  {
    const prof: [number, number][] = [[0, 1.0], [2.7, 1.0], [2.6, 3], [2.35, 7], [2.15, 11], [2.05, 14], [2.2, 17], [2.55, 20.5], [2.6, 22.5], [2.2, 24.2], [0, 24.4]];
    const robe = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), 40);
    const p = robe.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), yy = p.getY(i);
      const k = 1 + 0.05 * Math.sin(a * 9) * Math.max(0, 1 - yy / 15) + 0.06 * Math.max(0, Math.cos(a - 1.57)) * Math.max(0, 1 - yy / 10);
      p.setX(i, p.getX(i) * k * 1.05); p.setZ(i, p.getZ(i) * k * 0.8);
    }
    robe.computeVertexNormals();
    robe.translate(x, fy, z);
    B.add(bronze, robe);
  }
  // the shawl: a broad diagonal sash from the right hip over the left shoulder, falling down the back
  B.add(bronze, new THREE.CapsuleGeometry(0.75, 9.5, 4, 12).scale(1, 1, 0.55).rotateZ(-0.62).translate(x - 0.2, fy + 19.6, z + 1.25));
  B.add(bronze, new THREE.CapsuleGeometry(0.8, 9.0, 4, 12).scale(1, 1, 0.5).rotateX(0.1).translate(x - 1.9, fy + 18.2, z - 1.05));
  // shoulders, arms (the left holding the danda, the right raised in blessing), hands
  B.add(bronze, new THREE.SphereGeometry(2.7, 18, 12).scale(1.12, 0.62, 0.7).translate(x, fy + 23.3, z));
  B.add(bronze, new THREE.CapsuleGeometry(0.62, 4.6, 4, 10).rotateZ(0.08).translate(x - 3.0, fy + 20.4, z + 0.2)); // left upper arm
  B.add(bronze, new THREE.CapsuleGeometry(0.55, 4.0, 4, 10).rotateX(-1.2).translate(x - 3.2, fy + 17.4, z + 2.0)); // left forearm forward
  B.add(bronze, new THREE.SphereGeometry(0.75, 10, 8).translate(x - 3.25, fy + 16.6, z + 4.0)); // left fist
  B.add(bronze, new THREE.CapsuleGeometry(0.62, 4.4, 4, 10).rotateZ(-0.12).translate(x + 3.0, fy + 20.5, z + 0.2)); // right upper arm
  B.add(bronze, new THREE.CapsuleGeometry(0.55, 3.6, 4, 10).rotateX(-0.25).translate(x + 3.3, fy + 19.6, z + 1.3)); // right forearm raised
  B.add(bronze, new THREE.BoxGeometry(1.1, 1.8, 0.4).translate(x + 3.35, fy + 21.9, z + 2.0)); // open palm
  // neck, head (smooth, no features), hair falling to the shoulders and gathered at the crown
  B.lathe(bronze, [[0, 0], [0.95, 0], [0.9, 1.3], [0, 1.3]], x, fy + 24.0, z, 14);
  B.add(bronze, new THREE.SphereGeometry(hd / 2.2, 20, 16).scale(0.86, 1.08, 0.98).translate(x, fy + 27.1, z + 0.15));
  B.add(bronze, new THREE.SphereGeometry(hd / 2.1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(0.95, 1.1, 1.05).rotateX(-0.35).translate(x, fy + 27.3, z - 0.15));
  B.add(bronze, new THREE.CapsuleGeometry(1.0, 2.2, 4, 10).scale(1.4, 1, 0.6).translate(x, fy + 25.2, z - 1.3));
  B.add(bronze, new THREE.SphereGeometry(0.8, 10, 8).translate(x, fy + 29.8, z - 0.5));
  // the danda, held upright in the left hand, taller than the figure
  B.add(bronze, new THREE.CylinderGeometry(0.2, 0.24, 36, 8).translate(x - 3.25, fy + 15.0, z + 4.0));
}

const HOUSE_COLORS = [0xeeeae2, 0xe8e2d6, 0xe6d8c0, 0xe8c4c6, 0xeee8dc, 0xdcb8b0, 0xe8d6a8, 0xf0ece6, 0xd8c8b4, 0xc8d2dc, 0xe4b4be, 0xd8d2c8, 0xe0ccb8, 0xf2eee8];

export function buildSetting(root: THREE.Group, K: OM, P: Physics, flames: Flames, sunDir: THREE.Vector3) {
  reseed(29);
  const g = new THREE.Group();
  g.name = 'setting';
  root.add(g);
  const B = new Batch();

  // ---------- ground: a fine mesh near the temple, a coarse one out to the horizon ----------
  const near = terrainMesh(700, 220, 0, 60, K.terrain, () => 0);
  g.add(near);
  const inNear = (x: number, z: number) => Math.abs(x) < 345 && Math.abs(z - 60) < 345;
  // sink the coarse mesh well under the fine one (its 31 m cells would otherwise cut through the temple)
  const far = terrainMesh(5000, 160, 0, 60, K.terrain, (x, z) => (inNear(x, z) ? 3 + 60 * (1 - smooth(290, 340, Math.max(Math.abs(x), Math.abs(z - 60)))) : 0));
  g.add(far);

  // ---------- the Narmada ----------
  const water = new Water(new THREE.PlaneGeometry(6000, 6000), {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: sunDir.clone(),
    sunColor: 0xfff0d8, waterColor: 0x46523e, distortionScale: 1.7, fog: true, alpha: 1,
  });
  // the Narmada's teal-green: tint what the water mirrors, not only its body colour (photos 2021-2025)
  water.material.fragmentShader = water.material.fragmentShader.replace(
    'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );',
    'vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) ) * vec3( 0.66, 0.74, 0.66 );')
    // slightly turbid river: cap the mirror at ~0.55 so the water's own grey-green body shows through
    .replace('float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );', 'float reflectance = min( 0.3, rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 ) );');
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, 100);
  water.material.uniforms.size.value = 2.2;
  g.add(water);

  // ---------- houses on the island hill and the south bank ----------
  const houses = new Instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), facadeMaterial());
  const houseCols: THREE.Color[] = [];
  const tanks = new Instances(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.6 }));
  const occupied: [number, number, number][] = [];
  const free = (x: number, z: number, r: number) => occupied.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > (or + r) * 0.8);
  // trims: roof parapets (four thin walls) and balconies (a slab and a parapet per upper storey) on the face
  // looking at the river, so the houses read as RCC homes with balconies rather than plain boxes
  const trims = new Instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  const trimCols: THREE.Color[] = [];
  const q = new THREE.Quaternion(), off = new THREE.Vector3();
  const trim = (x: number, y: number, z: number, ry: number, lx: number, lz: number, sx: number, sy: number, sz: number, col: THREE.Color) => {
    off.set(lx, 0, lz).applyQuaternion(q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry));
    trims.at(x + off.x, y, z + off.z, sx, sy, sz, ry);
    trimCols.push(col);
  };
  const addHouse = (x: number, z: number, w: number, d: number, hh: number, ry: number, face = 1) => {
    // sit on the lowest corner so nothing floats on the slope
    let base = Infinity;
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) base = Math.min(base, heightAt(x + dx, z + dz));
    if (base < WATER_Y + 1.5) return;
    houses.at(x, base - 1.5, z, w, hh + 1.5, d, ry);
    const col = new THREE.Color(HOUSE_COLORS[Math.floor(rnd() * HOUSE_COLORS.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
    houseCols.push(col);
    const top = base + hh, light = col.clone().offsetHSL(0, -0.05, 0.04), white = new THREE.Color(0xeeece6);
    // roof parapet
    const pc = rnd() < 0.6 ? light : white;
    trim(x, top, z, ry, 0, d / 2 - 0.06, w, 0.95, 0.14, pc);
    trim(x, top, z, ry, 0, -d / 2 + 0.06, w, 0.95, 0.14, pc);
    trim(x, top, z, ry, w / 2 - 0.06, 0, 0.14, 0.95, d, pc);
    trim(x, top, z, ry, -w / 2 + 0.06, 0, 0.14, 0.95, d, pc);
    // balconies on the river face
    if (rnd() < 0.6) {
      const storeys = Math.floor(hh / 3);
      const bw = w * (0.45 + rnd() * 0.4), bx = (rnd() - 0.5) * (w - bw) * 0.8;
      for (let k = 1; k < storeys; k++) {
        const y = base + k * 3;
        trim(x, y - 0.15, z, ry, bx, face * (d / 2 + 0.5), bw, 0.16, 1.0, light);
        trim(x, y, z, ry, bx, face * (d / 2 + 0.96), bw, 0.95, 0.09, rnd() < 0.5 ? white : light);
      }
      // a chhajja over the top window row
      trim(x, top - 0.55, z, ry, 0, face * (d / 2 + 0.3), w + 0.2, 0.1, 0.6, light);
    }
    if (rnd() < 0.45) tanks.at(x + (rnd() - 0.5) * w * 0.5, base + hh, z + (rnd() - 0.5) * d * 0.5);
    occupied.push([x, z, Math.max(w, d) / 2]);
  };
  occupied.push([PALACE.x, PALACE.z, 32], [0, -2, 40], [MAMLESHWAR.x, MAMLESHWAR.z, 18], [JHOOLA.x, 200, 8], [JHOOLA.x, 211, 9], [JHOOLA.x, 20, 6]);
  // island: denser near the river, thinning up the hill
  for (let i = 0; i < 2600 && houseCols.length < 400; i++) {
    const x = -320 + rnd() * 560;
    const z = 30 - Math.pow(rnd(), 1.6) * 260;
    if (z > bankN(x) - 6) continue;
    if (x > 30 && x < 130 && z > 13) continue;
    const hgt = heightAt(x, z);
    if (hgt > 70 || hgt < -14) continue;
    const rr = Math.hypot(x, z);
    const dens = (rr < 150 ? 0.95 : 0.95 * Math.max(0.08, 1 - (rr - 150) / 170)) * (hgt > 50 ? 0 : hgt > 35 ? 0.25 : 1);
    if (rnd() > dens) continue;
    // the steep face above the temple is forest with houses only on its benches (c32): keep ~40 % there
    const slope = Math.hypot(heightAt(x + 3, z) - heightAt(x - 3, z), heightAt(x, z + 3) - heightAt(x, z - 3)) / 6;
    if (slope > 0.45 && rnd() > 0.4) continue;
    const w = 5 + rnd() * 6, d = 5 + rnd() * 5;
    if (!free(x, z, Math.max(w, d) / 2)) continue;
    addHouse(x, z, w, d, (2 + Math.floor(rnd() * 3)) * 3.0 + 0.6, (rnd() - 0.5) * 0.3, 1);
  }
  // the south bank (Omkareshwar town)
  for (let i = 0; i < 2600 && houseCols.length < 900; i++) {
    const x = -420 + rnd() * 800;
    const z = bankS(x) + 12 + Math.pow(rnd(), 1.4) * 220;
    if (Math.abs(x) > 260 && rnd() < 0.6) continue;
    const w = 6 + rnd() * 7, d = 6 + rnd() * 6;
    if (!free(x, z, Math.max(w, d) / 2)) continue;
    addHouse(x, z, w, d, (1 + Math.floor(rnd() * 3)) * 3.0 + 0.6, (rnd() - 0.5) * 0.25, -1);
  }
  const houseMesh = houses.flush(g, false)!;
  houseCols.forEach((c, i) => houseMesh.setColorAt(i, c));
  houseMesh.instanceColor!.needsUpdate = true;
  const tankMesh = tanks.flush(g, false);
  if (tankMesh) tankMesh.name = 'tanks';
  const trimMesh = trims.flush(g, false)!;
  trimCols.forEach((c, i) => trimMesh.setColorAt(i, c));
  trimMesh.instanceColor!.needsUpdate = true;

  // ---------- trees: the hill is green forest in the monsoon (c32, c01) - leaf-card crowns, instanced ----------
  const treeSpots: [number, number, number, number][] = [];
  const treeOcc = new Set<string>();
  for (let i = 0; i < 60000 && treeSpots.length < 6500; i++) {
    const x = -900 + rnd() * 1460, z = -360 + rnd() * 800;
    const zn = bankN(x), zs = bankS(x);
    if (z > zn - 4 && z < zs + 6) continue;
    if (x > -50 && x < 45 && z > -24 && z < 30) continue;
    if (x > 28 && x < 128 && z > 10 && z < 28) continue;
    if (x > 60 && x < 200 && z > bankN(x) - 30 && z < bankN(x) + 10) continue;
    // never on the ghats or the bare rock by the water
    if (x > -95 && x < 80 && z > 10 && z < 50) continue;
    const hgt = heightAt(x, z);
    if (hgt < WATER_Y + 4) continue;
    // clumps: denser where a low-frequency noise says so, and densest on the island hill above the town
    const island = z < zn;
    const clump = fbm(x / 45 + 11, z / 45);
    const want = island ? (hgt > 20 ? 1.0 : 0.6) * smooth(0.25, 0.5, clump) + 0.15 : 0.4 * smooth(0.38, 0.6, clump);
    if (rnd() > want) continue;
    const cell = `${Math.floor(x / 3.2)},${Math.floor(z / 3.2)}`;
    if (treeOcc.has(cell) || !free(x, z, 2.2)) continue;
    treeOcc.add(cell);
    treeSpots.push([x, hgt, z, 8 + rnd() * 8]);
  }
  // a ring of trees round the Ekatma Dham plaza on the summit
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 46 + rnd() * 10;
    const x = EKATMA.x + Math.cos(a) * r, z = EKATMA.z + Math.sin(a) * r;
    treeSpots.push([x, heightAt(x, z), z, 7 + rnd() * 5]);
  }
  leafTrees(g, treeSpots, 140, (cam) => cam.position.y < WATER_Y);

  // ---------- the old palace of the Mandhata rajas on the hill (cream, rows of arched windows) ----------
  {
    const { x, z, y, w, d, h } = PALACE;
    B.span(K.plaster, x - w / 2 - 2, x + w / 2 + 2, y - 12, y + 0.6, z - d / 2 - 2, z + d / 2 + 2);
    B.span(K.plaster, x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2);
    // stepped-back top storey and corner towers
    B.span(K.plaster, x - w / 2 + 6, x + w / 2 - 6, y + h, y + h + 3.4, z - d / 2 + 2, z + d / 2 - 1);
    for (const sx of [-1, 1]) {
      B.span(K.plaster, x + sx * (w / 2) - 3.2, x + sx * (w / 2) + 3.2, y, y + h + 4, z + d / 2 - 6.4, z + d / 2 + 0.6);
      B.lathe(K.plaster, [[0, 0], [2.2, 0], [2.2, 0.3], [2.4, 0.5], [2.0, 1.4], [1.2, 2.3], [0.3, 2.8], [0.08, 3.5], [0, 3.6]], x + sx * (w / 2), y + h + 4, z + d / 2 - 2.9, 16);
    }
    // rows of tall arched windows (dark) and a cornice per storey
    for (let k = 0; k < 3; k++) {
      const yy = y + 1.2 + k * 4.6;
      for (let xx = x - w / 2 + 5; xx <= x + w / 2 - 5; xx += 3.1) {
        B.span(K.dark, xx - 0.65, xx + 0.65, yy, yy + 2.5, z + d / 2 - 0.05, z + d / 2 + 0.06);
        B.lathe(K.dark, [[0, 0], [0.65, 0], [0.5, 0.45], [0, 0.65]], xx, yy + 2.5, z + d / 2 + 0.02, 8);
      }
      B.span(K.plaster, x - w / 2 - 0.3, x + w / 2 + 0.3, yy + 3.6, yy + 3.85, z - d / 2 - 0.3, z + d / 2 + 0.35);
    }
  }

  // ---------- Mamleshwar (Amaleshwar) on the south bank ----------
  {
    const { x, z } = MAMLESHWAR;
    const y = heightAt(x, z);
    const stone = K.oldStone;
    B.span(K.plaster, x - 16, x + 16, y - 6, y + 1.4, z - 14, z + 14);
    B.span(stone, x - 5.5, x + 5.5, y + 1.4, y + 2.4, z - 9, z + 9);
    B.span(stone, x - 4.2, x + 4.2, y + 2.4, y + 7.2, z - 7.5, z + 1.5);
    const sp = rekhaGeometry(4.0, 14, 11);
    sp.translate(x, y + 7.2, z - 3);
    B.add(K.shikhara, sp);
    // mandapa in front (facing north, to the river) with a phamsana roof
    B.span(stone, x - 4.6, x + 4.6, y + 2.4, y + 6.0, z - 15, z - 7.5);
    for (const p of phamsanaGeometry(5)) { p.scale(5, 3, 4.4); p.translate(x, y + 6.0, z - 11.2); B.add(stone, p); }
    // two smaller shrines
    for (const sx of [-1, 1]) {
      B.span(stone, x + sx * 10 - 2, x + sx * 10 + 2, y + 1.4, y + 4.4, z - 2, z + 2);
      const s2 = rekhaGeometry(1.8, 6, 8);
      s2.translate(x + sx * 10, y + 4.4, z);
      B.add(K.shikhara, s2);
    }
    // ghat steps below it to the water
    for (let i = 0; i < 26; i++) {
      const zz = bankS(x) - 3 + i * 0.6;
      B.span(K.ghat, x - 26 - i * 0.1, x + 26 + i * 0.1, -18, -15.6 + i * 0.36, zz, zz + 0.6);
    }
  }

  // ---------- Ekatma Dham on the summit ----------
  ekatmaDham(B, K, EKATMA.x, EKATMA.z);

  // ---------- Jhoola pul ----------
  buildJhoola(B, K, g, P);
  // ---------- the concrete road bridge downstream, and the dam far upstream ----------
  {
    const bx = -300, y = -1.5;
    const z0 = bankN(bx) - 14, z1 = bankS(bx) + 12;
    B.span(K.concrete, bx - 4.2, bx + 4.2, y - 1.4, y, z0, z1);
    B.span(K.concrete, bx - 4.3, bx - 3.9, y, y + 1.1, z0, z1);
    B.span(K.concrete, bx + 3.9, bx + 4.3, y, y + 1.1, z0, z1);
    for (let zz = z0 + 18; zz < z1 - 8; zz += 24) B.span(K.concrete, bx - 3, bx + 3, -24, y - 1.4, zz - 1.2, zz + 1.2);
  }
  {
    const dx = 640, y0 = -24, y1 = 10;
    B.span(K.concrete, dx - 6, dx + 6, y0, y1 - 4, -60, 340);
    for (let zz = -50; zz < 330; zz += 14) B.span(K.concrete, dx - 7, dx + 7, y0, y1, zz - 1.5, zz + 1.5);
    B.span(K.concrete, dx - 5, dx + 5, y1, y1 + 1.2, -60, 340);
  }

  // ---------- boats with yellow canopies moored along the ghats, a few out on the river ----------
  buildBoats(g, K);

  // (far and broad: these batches cast no shadows - their bounds would put them in every cascade)
  B.flush(g, false);

  // The river's mirror: reflect only the outside world, and not at all when the pilgrim is indoors.
  const mirror = water.onBeforeRender.bind(water);
  const mirrorSkip: THREE.Object3D[] = [];
  water.onBeforeRender = (renderer, scene, camera, ...rest) => {
    const c = camera.position;
    const indoors = c.y > -1 && c.x > -13.6 && c.x < 14.2 && c.z > -17.2 && c.z < 2.4;
    if (indoors) return;
    // the AO pass re-renders the scene with a normal override: the mirror is already up to date
    if ((scene as THREE.Scene).overrideMaterial) return;
    if (!mirrorSkip.length) root.traverse((o) => { if (['crowd', 'crowd-blobs', 'trees', 'boatpoles', 'tanks'].includes(o.name)) mirrorSkip.push(o); });
    const hidden = [...root.children.filter((o) => o.visible && o.name === 'garbhagriha'), ...mirrorSkip.filter((o) => o.visible)];
    hidden.forEach((o) => (o.visible = false));
    mirror(renderer, scene, camera, ...rest);
    hidden.forEach((o) => (o.visible = true));
  };
  void flames;
  return { group: g, water };
}

function buildJhoola(B: Batch, K: OM, g: THREE.Group, P: Physics) {
  const { x, z0, z1, y, hw, towers } = JHOOLA;
  // deck: steel stringers and a plank/plate deck with mesh-panel side railings
  B.span(K.deck, x - hw, x + hw, y - 0.25, y, z0, z1);
  B.span(K.bridgeRed, x - hw - 0.1, x - hw + 0.08, y - 0.7, y + 0.05, z0, z1);
  B.span(K.bridgeRed, x + hw - 0.08, x + hw + 0.1, y - 0.7, y + 0.05, z0, z1);
  B.span(K.steel, x - hw - 0.05, x - hw + 0.03, y + 1.05, y + 1.12, z0, z1);
  B.span(K.steel, x + hw - 0.03, x + hw + 0.05, y + 1.05, y + 1.12, z0, z1);
  // steel mesh side panels (c03, c05): an alpha-tested wire grid
  {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x2 = c.getContext('2d')!;
    x2.strokeStyle = '#fff';
    x2.lineWidth = 5;
    x2.beginPath();
    for (let i = -64; i <= 128; i += 16) { x2.moveTo(i, 0); x2.lineTo(i + 64, 64); x2.moveTo(i + 64, 0); x2.lineTo(i, 64); }
    x2.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const len = z1 - z0;
    t.repeat.set(len / 0.18, 1.0 / 0.18);
    const mesh = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.6, roughness: 0.5, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95).rotateY(Math.PI / 2), mesh);
      pl.position.set(x + sx * hw, y + 0.55, (z0 + z1) / 2);
      g.add(pl);
    }
  }
  const post = new Instances(new THREE.BoxGeometry(0.06, 1.1, 0.06).translate(0, 0.55, 0), K.steel);
  const hanger = new Instances(new THREE.CylinderGeometry(0.018, 0.018, 1, 4).translate(0, 0.5, 0), K.cable);
  for (let zz = z0; zz <= z1; zz += 1.5) {
    post.at(x - hw, y, zz);
    post.at(x + hw, y, zz);
  }
  // towers: two portal frames with a top beam, orange-red, standing on piers
  const TH = 19;
  const towerTopY = y + TH;
  for (const tz of towers) {
    const baseY = Math.min(heightAt(x, tz), WATER_Y) - 2;
    for (const s of [-1, 1]) {
      B.span(K.bridgeRed, x + s * (hw + 0.8) - 0.4, x + s * (hw + 0.8) + 0.4, y - 0.8, towerTopY, tz - 0.5, tz + 0.5);
      B.span(K.concrete, x + s * (hw + 0.8) - 1.0, x + s * (hw + 0.8) + 1.0, baseY, y - 0.8, tz - 1.1, tz + 1.1);
    }
    for (const yy of [towerTopY - 0.8, y + 4.2]) B.span(K.bridgeRed, x - hw - 1.2, x + hw + 1.2, yy, yy + 0.7, tz - 0.4, tz + 0.4);
  }
  // main cables: catenary-like parabola between tower tops, back-stays to the anchorages on each bank
  const cableY = (z: number) => {
    const [ta, tb] = towers;
    if (z <= ta) return towerTopY - (ta - z) * ((towerTopY - (y + 0.4)) / (ta - z0 + 4));
    if (z >= tb) return towerTopY - (z - tb) * ((towerTopY - (y + 0.4)) / (z1 - tb + 4));
    const t = (z - ta) / (tb - ta);
    return y + 1.6 + (towerTopY - y - 1.6) * (2 * t - 1) ** 2;
  };
  for (const s of [-1, 1]) {
    const cx = x + s * (hw + 0.8);
    const pts: THREE.Vector3[] = [];
    for (let zz = z0 - 4; zz <= z1 + 4; zz += 2) pts.push(new THREE.Vector3(cx, cableY(zz), zz));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.09, 6);
    B.add(K.cable, tube);
    for (let zz = towers[0] + 3; zz < towers[1] - 2; zz += 3) {
      const top = cableY(zz);
      hanger.at(x + s * hw, y + 0.05, zz, 1, top - y - 0.05, 1);
    }
  }
  post.flush(g, false);
  hanger.flush(g, false);
  // walking on the deck; rails; a stop at the far end (the town is not modelled for walking)
  P.floor(g, x - hw, x + hw, z0, z1, y);
  P.solid(x - hw - 0.3, y, LANE.z1 + 1.3, x - hw + 0.05, y + 1.2, z1);
  P.solid(x + hw - 0.05, y, LANE.z1 + 1.3, x + hw + 0.3, y + 1.2, z1);
  P.solid(x - hw, y, z1 - 6, x + hw, y + 2, z1 - 5.6);
  P.solid(x + hw, y, LANE.z0 - 2, x + hw + 2, y + 2, LANE.z1 + 1.4);
}

function buildBoats(g: THREE.Group, K: OM) {
  const geo = boatGeometries();
  // the boat model's bow is +x; turn it so the bow points along -z (nose-in to the ghat at ry = 0)
  for (const q of [geo.paint, geo.wood]) q.rotateY(Math.PI / 2);
  const can = canopyGeometry(1.95, 4.4, 0.12, 0.16).rotateY(0).translate(0, 2.0, 0.3);
  const frame = polesGeometry(0.82, 1.95, 0.55, 2.0, 0.022).translate(0, 0, 0.3);
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: geo.plankMap, roughness: 0.75, side: THREE.DoubleSide });
  const hulls = new Instances(geo.paint, paintMat);
  const woods = new Instances(geo.wood, K.boatWood);
  const canopy = new Instances(can, K.tarp);
  const poles = new Instances(frame, K.steel);
  const hullCols: THREE.Color[] = [], woodCols: THREE.Color[] = [], canCols: THREE.Color[] = [];
  // faded paint and cloth (c17, c32): ~30 % less saturated than poster colours
  const fade = (hex: number, l = 0) => { const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); return c.setHSL(hsl.h, hsl.s * 0.68, hsl.l + l); };
  const HULL = [0xe9e6dc, 0x3f74a8, 0x3d8a5c, 0xe9e6dc, 0x4a8cbc, 0xd9c45a, 0xb8462e, 0x2f8a8a];
  const CAN = [0xf2cc2a, 0xf0c010, 0xe8b820, 0x34a46a, 0x2fb0a0, 0xf2f0e6, 0xf2cc2a, 0x3a9c58];
  const boat = (x: number, z: number, ry: number, canopyOn = true) => {
    const sc = 0.9 + rnd() * 0.22;
    hulls.at(x, WATER_Y - 0.18, z, sc, sc, sc, ry);
    woods.at(x, WATER_Y - 0.18, z, sc, sc, sc, ry);
    hullCols.push(fade(HULL[Math.floor(rnd() * HULL.length)], (rnd() - 0.5) * 0.06));
    woodCols.push(new THREE.Color(0x7a5a3e).offsetHSL(0, 0, (rnd() - 0.5) * 0.08));
    if (!canopyOn) return;
    canopy.at(x, WATER_Y - 0.18, z, sc, sc, sc, ry);
    poles.at(x, WATER_Y - 0.18, z, sc, sc, sc, ry);
    canCols.push(fade(CAN[Math.floor(rnd() * CAN.length)]));
  };
  // moored nose-in along the temple ghat
  for (let x = -66; x < 64; x += 2.3 + rnd() * 1.2) {
    if (rnd() < 0.25) continue;
    boat(x, GHAT.stepsTo + 4.2 + rnd() * 0.8, (rnd() - 0.5) * 0.2, rnd() < 0.85);
  }
  // a second, looser row
  for (let x = -50; x < 50; x += 5 + rnd() * 4) boat(x, GHAT.stepsTo + 13 + rnd() * 3, Math.PI / 2 + (rnd() - 0.5) * 0.5);
  // at the Mamleshwar bank
  for (let x = -110; x < 40; x += 3 + rnd() * 2) boat(x, bankS(x) - 8 - rnd() * 2, Math.PI + (rnd() - 0.5) * 0.3, rnd() < 0.8);
  // out on the river
  for (const [x, z, r] of [[-30, 95, 0.4], [40, 120, -1.2], [-90, 140, 1.4], [85, 80, 0.9], [10, 160, -0.3]] as const) boat(x, z, r);
  const set = (m: THREE.InstancedMesh | null, cols: THREE.Color[]) => { if (!m) return; cols.forEach((c, i) => m.setColorAt(i, c)); m.instanceColor!.needsUpdate = true; m.name = 'boats'; };
  set(hulls.flush(g, false), hullCols);
  set(woods.flush(g, false), woodCols);
  set(canopy.flush(g, false), canCols);
  const pm = poles.flush(g, false);
  if (pm) pm.name = 'boatpoles';
}

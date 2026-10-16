import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { worldUV, waterNormals } from '../../engine/materials';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Physics, archPanelGeometry, garland, type Flames } from '../../engine/kit';
import { Batch, Instances, tetrapodGeometry, eave, figureReliefGeometry } from './batch';

/**
 * The Somnath precinct, laid out from the OpenStreetMap survey (x = north, z = east, metres
 * from the garbhagriha): the sea wall bending round the south-west, the seaside road and its
 * tetrapod revetment, the Arabian Sea, the paved promenade with lawns, the crenellated inner
 * court, the Digvijay Dwar ~110 m east on the temple's axis with the Sardar Patel statue
 * on its line ~40 m out before it, the Baan Stambh on the sea wall, and the town of Prabhas Patan beyond.
 */

/** inner edge of the sea wall, from the north-west round to the south-east */
export const SEA_WALL: [number, number][] = [[140, -250], [48, -102], [-58, -11], [-64, 42], [-83, 114], [-100, 190], [-160, 320]];
export const BAAN = { x: -60.4, z: 7.5 };
/** the gate stands on the temple's axis: from the air the covered walkway runs dead straight from its door to the temple's steps */
export const DWAR = { x: 0, z0: 105, z1: 119, hw: 8.5, door: 1.7 };
/**
 * the statue stands on the gate's line ~40 m out from it, facing the temple (OpenStreetMap: 4.3 m north, 40 m east of
 * the Dwar); photographed from the plaza's south-east it stands near and to the right, the gate and temple to the left
 */
export const STATUE = { x: DWAR.x - 0.2, z: 153 };
/** the covered queue outside the gate: one straight lane w wide, from (ax, az) at the foot of the Dwar's steps out to (bx, bz) */
/** the red-rimmed square basin in the plaza's south-east, before the statue */
export const BASIN = { x: DWAR.x - 18, z: 166 };
/** the covered walkway inside the gate: half-width hw, on the axis, a centre rail between the queue (south) and the way out */
export const WALK = { hw: 1.6 };
export const QLANE = { ax: DWAR.x - 1.0, az: DWAR.z1 + 3.0, bx: DWAR.x - 22, bz: 158, w: 1.2 };
/**
 * The light-and-sound show's amphitheatre north of the temple: tiers on arcs round (cx, cz), rising away from
 * the temple and facing it across the Old Parvati temple's ruined plinth (radius r0 + k * step for tier k,
 * between angles a0..a1 measured from +x).
 */
export const AMPHI = { cx: -2, cz: -11, r0: 40, step: 1.15, rise: 0.42, tiers: 13, a0: -0.55, a1: 0.55 };
/** the Old Parvati temple's plinth (x0, x1, z0, z1) */
export const PARVATI = { x0: 25, x1: 33, z0: -23, z1: -11 };
const SEA_Y = -4.4;
const ROAD_Y = -2.8;
const PARAPET = 0.45;

export interface PrecinctMats {
  stone: THREE.MeshStandardMaterial;
  stoneTwo: THREE.MeshStandardMaterial;
  shade: THREE.MeshStandardMaterial;
  paving: THREE.MeshStandardMaterial;
  /** the Dwar's honey-yellow sandstone */
  dwar: THREE.MeshStandardMaterial;
  jali: THREE.MeshStandardMaterial;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** outward (seaward) unit normals per vertex of the sea wall (averaged at the joints) */
function seaNormals(): [number, number][] {
  const segN = SEA_WALL.slice(0, -1).map((p, i) => {
    const q = SEA_WALL[i + 1];
    const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz);
    let n: [number, number] = [-dz / l, dx / l];
    if (n[0] * -p[0] + n[1] * -p[1] > 0) n = [-n[0], -n[1]]; // away from the temple = towards the sea
    return n;
  });
  return SEA_WALL.map((_, i) => {
    const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)];
    const x = a[0] + b[0], z = a[1] + b[1], l = Math.hypot(x, z);
    const c = (a[0] * b[0] + a[1] * b[1] + 1) / 2; // miter scale
    return [x / l / Math.sqrt(Math.max(c, 0.3)), z / l / Math.sqrt(Math.max(c, 0.3))];
  });
}

/** distance from (x, z) to the sea wall line */
export function distToSeaWall(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < SEA_WALL.length - 1; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** flat horizontal polygon at height y from [x, z] points */
function flat(pts: [number, number][], y: number) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  g.computeVertexNormals();
  return worldUV(g);
}

/** a strip between two polylines (a: inner, b: outer) with its own heights */
function strip(a: [number, number][], b: [number, number][], ya: number, yb: number) {
  const pos: number[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const p = [a[i][0], ya, a[i][1]], q = [a[i + 1][0], ya, a[i + 1][1]];
    const r = [b[i + 1][0], yb, b[i + 1][1]], s = [b[i][0], yb, b[i][1]];
    pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // make it face up
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
  }
  return worldUV(g);
}

/** The promenade's pink-and-cream pavers: big diagonal diamonds of pink bands over the cream paving. */
export function addDiamonds(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMetres;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMetres = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMetres;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = vec3(0.93, 0.84, 0.71) * (0.42 + lum * 1.25);
        vec2 q = vec2(vMetres.x + vMetres.y, vMetres.x - vMetres.y) * 0.70710678;
        vec2 f = abs(fract(q / 6.0) - 0.5) * 6.0;
        float band = max(smoothstep(2.7, 2.73, f.x), smoothstep(2.7, 2.73, f.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.97, 0.68, 0.64), band * 0.85);`);
  };
  m.needsUpdate = true;
}

const seaTime = { value: 0 };
/** roll the surf in (call per frame) */
export function animateSea(t: number) {
  seaTime.value = t;
}

/** a strip between two polylines with uv = (metres along, 0..1 across from a to b) */
function stripUV(a: [number, number][], b: [number, number][], ya: number, yb: number) {
  const pos: number[] = [], uv: number[] = [];
  let along = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const seg = Math.hypot(a[i + 1][0] - a[i][0], a[i + 1][1] - a[i][1]);
    const p = [a[i][0], ya, a[i][1]], q = [a[i + 1][0], ya, a[i + 1][1]];
    const r = [b[i + 1][0], yb, b[i + 1][1]], s = [b[i][0], yb, b[i][1]];
    pos.push(...p, ...q, ...r, ...p, ...r, ...s);
    uv.push(along, 0, along + seg, 0, along + seg, 1, along, 0, along + seg, 1, along, 1);
    along += seg;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) {
    const idx: number[] = [];
    for (let i = 0; i < pos.length / 3; i += 3) idx.push(i, i + 2, i + 1);
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Foam: lines of surf rolling shoreward and a ragged wash where they break against the tetrapods. */
function foamMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, roughness: 0.55, side: THREE.DoubleSide });
  const tex = foamTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.foamTime = seaTime;
    sh.uniforms.foamNoise = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFoam;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFoam = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFoam;\nuniform float foamTime;\nuniform sampler2D foamNoise;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        float across = vFoam.y;
        float n = texture2D(foamNoise, vec2(vFoam.x * 0.045, across * 0.7 + foamTime * 0.02)).r;
        float n2 = texture2D(foamNoise, vec2(vFoam.x * 0.11 + 0.3, across * 1.9 - foamTime * 0.035)).r;
        // three rollers moving in towards the wall, thinning as they travel
        float ph = across * 5.0 + foamTime * 0.16 + n * 0.6;
        float lines = pow(abs(sin(ph * 3.14159)), 6.0) * smoothstep(1.0, 0.2, across);
        // the wash at the toe of the revetment
        float wash = smoothstep(0.38, 0.0, across) * (0.65 + 0.35 * sin(foamTime * 0.9 + vFoam.x * 0.08));
        diffuseColor.a *= clamp((lines * 0.85 + wash) * (0.55 + n2 * 1.6) * (0.6 + n), 0.0, 0.95);`);
  };
  return m;
}

/** Concrete tetrapods: per-block tint (instance colour), stains, and a dark wet band with algae near the water. */
function tetraMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x716c66, roughness: 0.95 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = worldPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTW;
        float th(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float tn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float stain = tn(vTW * 2.3) * 0.6 + tn(vTW * 7.0) * 0.4;
        diffuseColor.rgb *= 0.78 + 0.32 * stain;
        float wet = smoothstep(${(SEA_Y + 1.1).toFixed(2)}, ${(SEA_Y + 0.1).toFixed(2)}, vTW.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.24, 0.17) * (0.7 + 0.5 * stain), wet * 0.85);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.35, smoothstep(${(SEA_Y + 0.9).toFixed(2)}, ${(SEA_Y + 0.1).toFixed(2)}, vTW.y));`);
  };
  return m;
}

function foamTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, rad = 2 + r() * 9;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.5})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.08, 0.3);
  return t;
}

export function buildPrecinct(root: THREE.Group, M: Materials, T: PrecinctMats, P: Physics, flames: Flames, sunDir: THREE.Vector3) {
  const g = new THREE.Group();
  g.name = 'somnath-precinct';
  root.add(g);
  const B = new Batch();
  const S = T.stone;
  // the shore (sea wall, road, revetment) and the sea sit directly under root: they are all the sea's mirror needs to show
  const shore = new THREE.Group();
  shore.name = 'somnath-shore';
  root.add(shore);
  const SB = new Batch();

  const concrete = new THREE.MeshStandardMaterial({ color: 0x9d978d, roughness: 0.95 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x57534f, roughness: 0.92 });
  const wallPaint = new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.9 });
  const lawn = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  patchyLawn(lawn);
  const brick = new THREE.MeshStandardMaterial({ color: 0xa24a30, roughness: 0.9 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: 0xefebe2, roughness: 0.85 });
  const hedgeMat = leafyMaterial(0x3d6a2a);
  const wallWhite = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.9 });
  weatherPlaster(wallWhite);
  const pinkStone = new THREE.MeshStandardMaterial({ color: 0xdca48a, roughness: 0.85 });
  weatherPlaster(pinkStone);
  const shrubs = new Instances(lumpy(new THREE.SphereGeometry(1, 9, 6)), leafyMaterial());
  const steel = new THREE.MeshStandardMaterial({ color: 0xa5a9ad, metalness: 0.85, roughness: 0.35 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x23211f, metalness: 0.75, roughness: 0.32 });
  const globeMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xfff0d6, emissiveIntensity: 0.25, roughness: 0.25 });
  const palmBark = new THREE.MeshStandardMaterial({ color: 0x564536, roughness: 1 });

  // ---------- land (paved promenade) bounded by the sea wall ----------
  const land: [number, number][] = [...SEA_WALL, [-200, 800], [800, 800], [800, -400], [300, -400]];
  const ground = new THREE.Mesh(flat(land, 0), T.paving);
  ground.receiveShadow = true;
  g.add(ground);
  P.floors.push(ground);

  // ---------- sea wall, seaside road, tetrapod revetment ----------
  const N = seaNormals();
  const off = (d: number) => SEA_WALL.map(([x, z], i) => [x + N[i][0] * d, z + N[i][1] * d] as [number, number]);
  const wallOut = off(0.9), roadOut = off(9), rubbleOut = off(19);
  const road = new THREE.Mesh(strip(wallOut, roadOut, ROAD_Y, ROAD_Y), asphalt);
  road.receiveShadow = true;
  shore.add(road);
  const kerb = strip(off(8.6), roadOut, ROAD_Y + 0.25, ROAD_Y + 0.25);
  SB.add(concrete, kerb);
  const rubble = new THREE.Mesh(strip(roadOut, rubbleOut, ROAD_Y + 0.2, SEA_Y - 2.5), concrete);
  rubble.receiveShadow = true;
  shore.add(rubble);
  for (let i = 0; i < SEA_WALL.length - 1; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const n = N[i], n2 = N[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const ry = -Math.atan2(dz, dx);
    const cx = (ax + bx) / 2 + (n[0] + n2[0]) * 0.22, cz = (az + bz) / 2 + (n[1] + n2[1]) * 0.22;
    // the sea wall is the same golden sandstone ashlar as the temple
    SB.box(S, len + 0.9, PARAPET - ROAD_Y, 0.9, cx, ROAD_Y, cz, ry);
    SB.box(pinkStone, len + 1.0, 0.16, 1.15, cx, PARAPET, cz, ry);
    // a plinth band at road level
    SB.box(concrete, len + 1.0, 0.6, 1.1, cx + n[0] * 0.15, ROAD_Y, cz + n[1] * 0.15, ry);
    // colliders: little boxes along the wall
    const steps = Math.ceil(len / 0.8);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const px = ax + dx * t + n[0] * 0.45, pz = az + dz * t + n[1] * 0.45;
      P.solid(px - 0.45, ROAD_Y, pz - 0.45, px + 0.45, 1.4, pz + 0.45);
    }
    // railing on the parapet: stone posts with two rails, so the sea shows through
    const posts = Math.floor(len / 2.4);
    for (let k = 0; k <= posts; k++) {
      const t = k / posts;
      SB.box(pinkStone, 0.26, 0.62, 0.26, ax + dx * t + n[0] * 0.45, PARAPET + 0.16, az + dz * t + n[1] * 0.45);
      SB.lathe(pinkStone, [[0, 0], [0.16, 0], [0.1, 0.12], [0, 0.18]], ax + dx * t + n[0] * 0.45, PARAPET + 0.78, az + dz * t + n[1] * 0.45, 8);
    }
    for (const ry2 of [0.42, 0.7]) SB.box(pinkStone, len + 0.4, 0.08, 0.12, cx - (n[0] + n2[0]) * 0.0, PARAPET + 0.16 + ry2 - 0.04, cz, ry);
  }
  // tetrapods heaped on the revetment
  const tetra = new Instances(tetrapodGeometry(), concrete);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 1; i < SEA_WALL.length - 2; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < len; s += 2.1) {
      const t = s / len;
      const n = [lerp(N[i][0], N[i + 1][0], t), lerp(N[i][1], N[i + 1][1], t)];
      for (const row of [10.6, 13.2, 15.8]) {
        const d = row + (rnd() - 0.5) * 1.2;
        const k = (d - 9) / 9;
        const y = lerp(ROAD_Y + 0.6, SEA_Y - 1.6, k) + rnd() * 0.4;
        const m = tetra.at(lerp(ax, bx, t) + n[0] * d, y, lerp(az, bz, t) + n[1] * d, 1.7 + rnd() * 1.2);
        m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)));
      }
    }
  }
  const tetraMesh = tetra.flush(shore)!;
  // each block weathered differently: grey to sandy, and dark wet algae below the tide line
  const tcol = new THREE.Color();
  for (let i = 0; i < tetraMesh.count; i++) {
    const v = 0.62 + rnd() * 0.34;
    tetraMesh.setColorAt(i, tcol.setRGB(v * (1 + rnd() * 0.06), v, v * (0.93 + rnd() * 0.05)));
  }
  tetraMesh.material = tetraMaterial();

  // surf: lines of broken white water rolling in and breaking on the revetment
  const foam = new THREE.Mesh(stripUV(off(11.4), off(24), SEA_Y + 0.07, SEA_Y + 0.03), foamMaterial());
  foam.renderOrder = 2;
  shore.add(foam);
  SB.flush(shore);

  // ---------- the Arabian Sea ----------
  // a 200x200 grid warped so its cells are ~1-3 m near the shore and grow to kilometres at the horizon
  const seaGeo = new THREE.PlaneGeometry(2, 2, 200, 200);
  const sp = seaGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const w = (u: number) => Math.sign(u) * 6000 * Math.pow(Math.abs(u), 3);
    sp.setXY(i, w(sp.getX(i)), w(sp.getY(i)));
  }
  const water = new Water(seaGeo, {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: sunDir.clone(),
    sunColor: 0xfff1d6, waterColor: 0x1b4652, distortionScale: 2.6, fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(-75, SEA_Y, 45);
  water.material.uniforms.size.value = 2.2;
  // a gentle Arabian Sea swell, fading out with distance from the viewer
  water.material.vertexShader = water.material.vertexShader.replace(
    'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
    `vec3 pos = position;
     vec4 wp0 = modelMatrix * vec4( position, 1.0 );
     float fade = smoothstep( 420.0, 120.0, distance( wp0.xz, cameraPosition.xz ) );
     pos.z += fade * ( 0.2 * sin( dot( wp0.xz, vec2( 0.105, 0.06 ) ) - time * 2.2 )
                     + 0.1 * sin( dot( wp0.xz, vec2( -0.05, 0.16 ) ) - time * 3.1 )
                     + 0.05 * sin( dot( wp0.xz, vec2( 0.31, 0.22 ) ) - time * 4.3 ) );
     mirrorCoord = modelMatrix * vec4( pos, 1.0 );`).replace(
    'vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
    'vec4 mvPosition =  modelViewMatrix * vec4( pos, 1.0 );');
  root.add(water);

  // ---------- boundary walls ----------
  const northX = 55;
  B.span(wallPaint, northX, northX + 0.7, 0, 3.6, -112, 114);
  P.solid(northX - 0.1, 0, -112, northX + 0.8, 4, 114);
  // (south of the gate, its big dark iron service gate between two square pillars, as photographed from the plaza)
  const G0 = DWAR.x - DWAR.hw - 15, G1 = DWAR.x - DWAR.hw - 9;
  for (const [x0, x1] of [[-83, G0], [G1, DWAR.x - DWAR.hw], [DWAR.x + DWAR.hw, northX]]) {
    B.span(S, x0, x1, 0, 2.2, 113.6, 114.3);
    P.solid(x0, 0, 113.5, x1, 3, 114.4);
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 1.0) B.box(S, 0.5, 0.45, 0.7, x, 2.2, 113.95);
  }
  {
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.5, roughness: 0.6 });
    for (const x of [G0, G1]) {
      B.span(S, x - 0.45, x + 0.45, 0, 3.6, 113.5, 114.4);
      B.span(S, x - 0.55, x + 0.55, 3.6, 3.8, 113.4, 114.5);
      B.lathe(S, [[0, 0], [0.3, 0], [0.22, 0.25], [0.08, 0.5], [0, 0.55]], x, 3.8, 113.95, 10);
    }
    const a = G0 + 0.45, b = G1 - 0.45;
    B.span(iron, a, b, 0, 3.0, 113.9, 114.0);
    for (const y of [0.25, 1.5, 2.8]) B.span(iron, a, b, y, y + 0.1, 113.85, 114.05);
    for (let x = a + 0.15; x < b; x += 0.15) B.span(iron, x - 0.015, x + 0.015, 0, 3.15, 113.84, 114.06);
    P.solid(G0, 0, 113.5, G1, 3.6, 114.4);
  }

  // ---------- inner court: low crenellated (kangura) wall round the temple ----------
  const kangura = (x0: number, z0: number, x1: number, z1: number) => {
    B.span(S, x0, x1, 0, 1.15, z0, z1);
    P.solid(Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), 1.6, Math.max(z0, z1));
    const len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let s = 0.35; s < len - 0.2; s += 0.85) {
      const x = along ? Math.min(x0, x1) + s : (x0 + x1) / 2, z = along ? (z0 + z1) / 2 : Math.min(z0, z1) + s;
      // stepped kangura merlon
      B.box(S, along ? 0.5 : 0.36, 0.18, along ? 0.36 : 0.5, x, 1.15, z);
      B.box(S, along ? 0.32 : 0.28, 0.16, along ? 0.28 : 0.32, x, 1.33, z);
      B.box(S, along ? 0.16 : 0.2, 0.14, along ? 0.2 : 0.16, x, 1.49, z);
    }
  };
  // see-through stone railing (low posts, two rails) for the court's sides, open to the lawns
  const railing = (x: number, z0: number, z1: number) => {
    const n = Math.floor((z1 - z0) / 2.2);
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      B.box(S, 0.24, 0.95, 0.24, x, 0, z);
      B.lathe(S, [[0, 0], [0.15, 0], [0.09, 0.1], [0, 0.16]], x, 0.95, z, 8);
    }
    for (const y of [0.4, 0.78]) B.box(S, 0.1, 0.08, z1 - z0, x, y, (z0 + z1) / 2);
    P.solid(x - 0.15, 0, z0, x + 0.15, 1.2, z1);
  };
  const K = { x: 23, z0: -22, z1: 64 };
  for (const s of [-1, 1]) {
    railing(s * K.x, K.z0, 17.5);
    railing(s * K.x, 27.5, K.z1);
    kangura(s * 8.5, K.z1 - 0.25, s * K.x, K.z1 + 0.25);
    // gate pylons
    for (const [x, z] of [[s * 8.5, K.z1], [s * K.x, K.z1]] as const) {
      B.span(S, x - 0.55, x + 0.55, 0, 2.6, z - 0.55, z + 0.55);
      B.lathe(S, [[0, 0], [0.75, 0], [0.75, 0.25], [0.3, 0.45], [0.35, 0.8], [0.12, 1.05], [0, 1.1]], x, 2.6, z, 4, Math.PI / 4);
    }
  }
  // the court gate over the walkway: a pillared torana with a flat lintel, as in the photographs
  for (const x of [-4.6, 4.6]) B.span(S, x - 0.45, x + 0.45, 0, 4.6, K.z1 - 0.45, K.z1 + 0.45);
  B.span(S, -5.8, 5.8, 4.6, 5.4, K.z1 - 0.7, K.z1 + 0.7);
  eave(B, T.stoneTwo, 0, K.z1, 11.6, 1.4, 5.6, 0.5, 0.3);
  B.span(S, -4.0, 4.0, 5.4, 6.3, K.z1 - 0.3, K.z1 + 0.3);
  for (const x of [-4.6, 4.6]) P.solid(x - 0.5, 0, K.z1 - 0.5, x + 0.5, 5, K.z1 + 0.5);

  // ---------- lawns, hedges ----------
  // the formal gardens of the photographs: dark-green lawns, each ringed by a continuous clipped hedge (open
  // at the middle of each side for the white paths), a hedged flower bed at the centre, and a dense mass of
  // broadleaf trees on the north lawns
  const lawnBeds: [number, number, number, number][] = [
    [27, 50, 34, 70], [27, 50, 78, 104],
    [-52, -27, 16, 50], [-60, -27, 60, 100], [30, 46, -84, -73],
  ];
  const hedge = (x0: number, x1: number, z0: number, z1: number, h = 0.6) => B.span(hedgeMat, x0, x1, 0, h, z0, z1);
  // either side of the covered walkway from the gate to the temple: open green lawns in brick kerbs, a pale paved
  // strip along the walkway and a cross path halfway (as seen from the air)
  for (const sg of [-1, 1]) for (const [z0, z1] of [[68, 83.2], [86, 103]] as const) {
    const [x0, x1] = sg > 0 ? [3.4, 13.2] : [-13.2, -3.4];
    B.span(lawn, x0, x1, 0, 0.05, z0, z1);
    for (const [a, b, c, d] of [[x0 - 0.2, x1 + 0.2, z0 - 0.2, z0], [x0 - 0.2, x1 + 0.2, z1, z1 + 0.2], [x0 - 0.2, x0, z0, z1], [x1, x1 + 0.2, z0, z1]]) B.span(brick, a, b, 0, 0.1, c, d);
  }
  for (const [x0, x1, z0, z1] of lawnBeds) {
    B.span(lawn, x0, x1, 0, 0.05, z0, z1);
    for (const [a, b, c, d] of [[x0 - 0.25, x1 + 0.25, z0 - 0.25, z0], [x0 - 0.25, x1 + 0.25, z1, z1 + 0.25], [x0 - 0.25, x0, z0, z1], [x1, x1 + 0.25, z0, z1]]) B.span(brick, a, b, 0, 0.1, c, d);
    for (const [a, b, c, d] of [[x0 - 0.4, x1 + 0.4, z0 - 0.4, z0 - 0.25], [x0 - 0.4, x1 + 0.4, z1 + 0.25, z1 + 0.4], [x0 - 0.4, x0 - 0.25, z0, z1], [x1 + 0.25, x1 + 0.4, z0, z1]]) B.span(kerbWhite, a, b, 0, 0.14, c, d);
    // the perimeter hedge, with a 2.4 m opening at the middle of every side
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, gap = 1.2;
    for (const zz of [z0 + 0.35, z1 - 0.35]) { hedge(x0 + 0.05, mx - gap, zz - 0.3, zz + 0.3); hedge(mx + gap, x1 - 0.05, zz - 0.3, zz + 0.3); }
    for (const xx of [x0 + 0.35, x1 - 0.35]) { hedge(xx - 0.3, xx + 0.3, z0 + 0.65, mz - gap); hedge(xx - 0.3, xx + 0.3, mz + gap, z1 - 0.65); }
    // white gravel paths crossing the lawn from the openings to the central bed
    const bw = Math.min(6, (x1 - x0) * 0.25), bd = Math.min(8, (z1 - z0) * 0.22);
    B.span(kerbWhite, mx - 0.6, mx + 0.6, 0.05, 0.07, z0 + 0.65, mz - bd - 0.3);
    B.span(kerbWhite, mx - 0.6, mx + 0.6, 0.05, 0.07, mz + bd + 0.3, z1 - 0.65);
    B.span(kerbWhite, x0 + 0.65, mx - bw - 0.3, 0.05, 0.07, mz - 0.6, mz + 0.6);
    B.span(kerbWhite, mx + bw + 0.3, x1 - 0.65, 0.05, 0.07, mz - 0.6, mz + 0.6);
    // the central flower bed: low hedge border round massed flowering shrubs
    for (const [a, b, c, d] of [[mx - bw, mx + bw, mz - bd, mz - bd + 0.4], [mx - bw, mx + bw, mz + bd - 0.4, mz + bd], [mx - bw, mx - bw + 0.4, mz - bd, mz + bd], [mx + bw - 0.4, mx + bw, mz - bd, mz + bd]]) hedge(a, b, c, d, 0.45);
    for (let x = mx - bw + 1.0; x < mx + bw - 0.7; x += 1.5) for (let z = mz - bd + 1.0; z < mz + bd - 0.7; z += 1.5) shrubs.at(x + (rnd() - 0.5) * 0.3, 0.15, z + (rnd() - 0.5) * 0.3, 0.8, 0.45, 0.8, rnd() * 6);
    // a few clipped shrubs dotted along the inside of the hedges
    for (let x = x0 + 3; x < x1 - 2; x += 6) for (const z of [z0 + 1.6, z1 - 1.6]) if (rnd() < 0.5) shrubs.at(x, 0.2, z, 0.6, 0.45, 0.6, rnd() * 6);
  }
  // broadleaf trees (neem, banyan) massed on the north lawns
  for (const [x, z, h] of [[43, 44, 8], [34, 62, 9.5], [45, 89, 8.5], [33, 99, 7.5], [-47, 46, 8]] as const) {
    broadleaf(B, palmBark, hedgeMat, x, z, h, x * 1.3 + z);
    P.solid(x - 0.45, 0, z - 0.45, x + 0.45, 4, z + 0.45);
  }
  const shrubMesh = shrubs.flush(g, false)!;
  const scol = new THREE.Color();
  for (let i = 0; i < shrubMesh.count; i++) {
    const r = rnd();
    shrubMesh.setColorAt(i, r < 0.14 ? scol.set(0xb8243c) : r < 0.24 ? scol.set(0xe0a020) : r < 0.3 ? scol.set(0xd85a8a) : scol.setHSL(0.27 + rnd() * 0.05, 0.5, 0.07 + rnd() * 0.05));
  }

  // ---------- the light-and-sound amphitheatre north of the temple ----------
  // As in the photographs: a broad fan of raked tiers in ochre concrete, each tier's seat painted in long red
  // stretches with white panels between, a railing along the top and a high back wall; in front of it, rows of
  // low benches on the ground, the same red and white; and between them and the temple the Old Parvati
  // temple's ruined plinth.
  {
    const A = AMPHI;
    const ochre = new THREE.MeshStandardMaterial({ color: 0xd9a64a, roughness: 0.92 });
    weatherPlaster(ochre);
    const seatRed = new THREE.MeshStandardMaterial({ color: 0xa8392c, roughness: 0.8 });
    const seatWhite = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.8 });
    // (solid: a wall; 'tread': a step to climb, its top walkable; false: neither)
    const tread = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const arc = (r0: number, r1: number, y0: number, y1: number, mat: THREE.Material, a0 = A.a0, a1 = A.a1, solid: boolean | 'tread' = true) => {
      const n = Math.max(2, Math.ceil(((a1 - a0) * r1) / 3.2));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5) / n) * (a1 - a0), w = ((a1 - a0) / n) * r1 + 0.05;
        const rm = (r0 + r1) / 2;
        const x = A.cx + Math.cos(a) * rm, z = A.cz + Math.sin(a) * rm;
        B.box(mat, r1 - r0, y1 - y0, w, x, y0, z, -a);
        if (solid === 'tread') {
          const top = new THREE.Mesh(new THREE.PlaneGeometry(r1 - r0, w).rotateX(-Math.PI / 2).rotateY(-a).translate(x, y1, z), tread);
          g.add(top);
          P.floors.push(top);
        } else if (solid) P.solid(x - (r1 - r0) / 2 - 0.4, y0, z - w / 2, x + (r1 - r0) / 2 + 0.4, y1 + 0.3, z + w / 2);
      }
    };
    // the painted seat: red stretches with a white panel every few metres
    const seats = (r: number, y: number, depth: number) => {
      const n = Math.ceil(((A.a1 - A.a0) * r) / 1.6);
      for (let i = 0; i < n; i++) {
        const a0 = A.a0 + (i / n) * (A.a1 - A.a0), a1 = A.a0 + ((i + 1) / n) * (A.a1 - A.a0);
        arc(r, r + depth, y, y + 0.05, i % 3 === 1 ? seatWhite : seatRed, a0, a1, false);
      }
    };
    for (let k = 0; k < A.tiers; k++) {
      const r = A.r0 + A.step * k, y = A.rise * (k + 1);
      arc(r, r + A.step, 0, y, ochre, A.a0, A.a1, 'tread');
      seats(r + 0.12, y, 0.5);
    }
    // the walk along the top, its railing and the back wall
    const rt = A.r0 + A.step * A.tiers, yt = A.rise * A.tiers;
    arc(rt, rt + 2.2, 0, yt, ochre, A.a0, A.a1, 'tread');
    arc(rt + 2.2, rt + 2.6, 0, yt + 3.2, ochre);
    for (let i = 0; i <= 24; i++) {
      const a = A.a0 + (i / 24) * (A.a1 - A.a0);
      B.box(steel, 0.05, 1.0, 0.05, A.cx + Math.cos(a) * (rt + 0.1), yt, A.cz + Math.sin(a) * (rt + 0.1));
    }
    for (const y of [0.55, 1.0]) arc(rt + 0.07, rt + 0.13, yt + y - 0.03, yt + y + 0.03, steel, A.a0, A.a1, false);
    // the end walls of the fan
    for (const a of [A.a0, A.a1]) {
      const rm = (A.r0 + rt + 2.6) / 2, len = rt + 2.6 - A.r0;
      B.box(ochre, len, yt + 0.9, 0.5, A.cx + Math.cos(a) * rm, 0, A.cz + Math.sin(a) * rm, -a);
      // (walled along its length, so nobody walks off the end of a raised tier)
      for (let t = 0; t < len; t += 0.8) {
        const r = A.r0 + t + 0.4, x = A.cx + Math.cos(a) * r, z = A.cz + Math.sin(a) * r;
        P.solid(x - 0.45, 0, z - 0.45, x + 0.45, yt + 2, z + 0.45);
      }
    }
    // rows of low benches on the ground in front (the side by the Parvati plinth left open)
    for (let k = 0; k < 4; k++) {
      const r = 31 + k * 2.1;
      arc(r, r + 0.55, 0, 0.42, ochre, -0.08, A.a1);
      const n = Math.ceil(((A.a1 + 0.08) * r) / 1.6);
      for (let i = 0; i < n; i++) {
        const a0 = -0.08 + (i / n) * (A.a1 + 0.08), a1 = -0.08 + ((i + 1) / n) * (A.a1 + 0.08);
        arc(r - 0.02, r + 0.57, 0.42, 0.47, i % 2 ? seatWhite : seatRed, a0, a1, false);
      }
    }
  }

  // ---------- the Old Parvati temple's plinth (pārvatī mandir avaśeṣa) ----------
  // only the stepped base survives: carved friezes in courses, steps up one side, a bench in its shade
  {
    const { x0, x1, z0, z1 } = PARVATI;
    const course = (i: number, y0: number, y1: number, inset: number) => B.span(S, x0 + inset, x1 - inset, y0, y1, z0 + inset, z1 - inset);
    course(0, 0, 0.35, -0.3);
    course(1, 0.35, 0.8, 0);
    course(2, 0.8, 1.05, 0.2);
    course(3, 1.05, 1.6, 0.1);
    course(4, 1.6, 1.85, 0.25);
    course(5, 1.85, 2.3, 0.15);
    // offsets (rathas) along the long sides and the carved frieze bands
    for (const zf of [z0, z1]) {
      const sgn = zf === z0 ? -1 : 1;
      for (let x = x0 + 1.2; x < x1 - 0.8; x += 1.6) {
        B.span(S, x - 0.45, x + 0.45, 0.8, 2.15, zf - sgn * 0.1, zf + sgn * 0.12);
        B.add(S, figureReliefGeometry().scale(0.42, 0.42, 0.5).rotateY(sgn > 0 ? 0 : Math.PI).translate(x, 1.1, zf + sgn * 0.16));
      }
    }
    // steps up the east side
    for (let k = 0; k < 6; k++) B.span(S, x0 + 2, x1 - 2, 0, 0.38 * (k + 1), z1 + 2.4 - k * 0.4, z1 + 2.8 - k * 0.4);
    // the bench at its foot
    B.span(steel, x0 + 1.2, x0 + 2.8, 0.42, 0.47, z0 - 1.2, z0 - 0.8);
    for (const x of [x0 + 1.3, x0 + 2.7]) B.span(steel, x - 0.04, x + 0.04, 0, 0.42, z0 - 1.15, z0 - 0.85);
    P.solid(x0 - 0.3, 0, z0 - 0.3, x1 + 0.3, 2.4, z1 + 0.3);
    // its signboard: red, lettered in white
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x2 = c.getContext('2d')!;
    x2.fillStyle = '#8e1f1a'; x2.fillRect(0, 0, 256, 128);
    x2.fillStyle = '#fff'; x2.textAlign = 'center';
    x2.font = '700 30px Martel, serif'; x2.fillText('पार्वती मंदिर अवशेष', 128, 52);
    x2.font = '700 24px sans-serif'; x2.fillText('OLD PARVATI TEMPLE', 128, 98);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    sign.position.set(x0 - 0.33, 1.95, (z0 + z1) / 2 + 2);
    sign.rotation.y = -Math.PI / 2;
    g.add(sign);
  }

  // ---------- a small shrine by the approach (a Ganesha devkulika with its own little shikhara) ----------
  {
    const x = 19, z = 86;
    B.span(S, x - 1.9, x + 1.9, 0, 0.6, z - 1.9, z + 1.9);
    B.span(S, x - 1.3, x + 1.3, 0.6, 3.0, z - 1.3, z + 1.3);
    B.span(T.shade, x - 1.32, x - 1.29, 0.8, 2.4, z - 0.45, z + 0.45);
    eave(B, T.stoneTwo, x, z, 2.6, 2.6, 3.0, 0.4, 0.25);
    B.lathe(S, [[1.15, 0], [1.05, 0.6], [0.92, 1.4], [0.72, 2.2], [0.45, 2.9], [0.2, 3.3], [0.3, 3.4], [0.3, 3.55], [0.12, 3.62], [0.15, 3.85], [0, 4.1]], x, 3.0, z, 4, Math.PI / 4);
    for (const k of [0, 1, 2, 3]) {
      const a = (k * Math.PI) / 2;
      B.lathe(S, [[0.5, 0], [0.42, 0.6], [0.25, 1.1], [0, 1.4]], x + Math.cos(a) * 0.95, 3.0, z + Math.sin(a) * 0.95, 4, Math.PI / 4);
    }
    P.solid(x - 1.9, 0, z - 1.9, x + 1.9, 7, z + 1.9);
  }

  // ---------- Digvijay Dwar ----------
  const dwarReady = buildDwar(g, B, T.dwar, T, M, P);

  let patelReady: Promise<void> = Promise.resolve();
  // ---------- Sardar Patel statue: a dark bronze figure on a tall granite pedestal ringed with elephants ----------
  {
    const { x, z } = STATUE;
    const granite = new THREE.MeshStandardMaterial({ color: 0x9a7d70, roughness: 0.5 });
    weatherPlaster(granite);
    // a broad low platform of two steps, its edge painted yellow, and the four yellow-and-red pillars round it
    const kerb = new THREE.MeshStandardMaterial({ color: 0xe0b23c, roughness: 0.8 });
    B.span(granite, x - 4.5, x + 4.5, 0, 0.17, z - 4.5, z + 4.5);
    B.span(kerb, x - 4.53, x + 4.53, 0, 0.1, z - 4.53, z + 4.53);
    B.span(granite, x - 3.8, x + 3.8, 0.17, 0.34, z - 3.8, z + 3.8);
    B.span(granite, x - 2.3, x + 2.3, 0.34, 0.9, z - 2.3, z + 2.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      chowkPillar(B, x + sx * 5.4, z + sz * 5.4);
      P.solid(x + sx * 5.4 - 0.35, 0, z + sz * 5.4 - 0.35, x + sx * 5.4 + 0.35, 4.3, z + sz * 5.4 + 0.35);
    }
    B.span(granite, x - 1.5, x + 1.5, 0.9, 3.4, z - 1.5, z + 1.5);
    B.span(granite, x - 1.7, x + 1.7, 3.4, 3.5, z - 1.7, z + 1.7);
    B.span(granite, x - 1.9, x + 1.9, 3.95, 4.55, z - 1.9, z + 1.9);
    B.span(T.shade, x - 0.85, x + 0.85, 1.0, 1.55, z + 1.5, z + 1.53);
    // the band of bronze elephants between the shaft and the capping block
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const ex = x + Math.cos(a) * 1.45, ez = z + Math.sin(a) * 1.45;
      B.add(bronze, new THREE.SphereGeometry(0.28, 10, 8).scale(1.2, 0.85, 0.75).rotateY(-a + Math.PI / 2).translate(ex, 3.75, ez));
      B.add(bronze, new THREE.SphereGeometry(0.17, 8, 6).translate(ex + Math.cos(a) * 0.3, 3.82, ez + Math.sin(a) * 0.3));
      B.add(bronze, new THREE.CylinderGeometry(0.035, 0.06, 0.38, 6).translate(ex + Math.cos(a) * 0.4, 3.62, ez + Math.sin(a) * 0.4));
    }
    P.solid(x - 2.4, 0, z - 2.4, x + 2.4, 9, z + 2.4);
    // the statue itself, reconstructed (TripoSR) from a front photograph of it supplied by the site owner, with a
    // head sculpted for it and the closed collar of his kurta (the photograph's face is too small to rebuild); the
    // photo's light and shade kept per vertex: the bronze is shaded by it and the marigold garland keeps its colours.
    // Unit height, its front along +x. The simple stand-in only if the file can't be loaded
    patelReady = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/models/sardar_patel.glb').then((gl) => {
      // (his face is to the temple, away from the sun: the sky it mirrors is what models his features in that shade)
      const cast = new THREE.MeshStandardMaterial({ color: 0x2c2620, metalness: 0.55, roughness: 0.42, vertexColors: true, envMapIntensity: 1.9 });
      cast.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
          vec3 pc = vColor.rgb;
          float hi = max(max(pc.r, pc.g), pc.b), lo = min(min(pc.r, pc.g), pc.b);
          float sat = (hi - lo) / (hi + 0.001);
          // the garland: saturated and warm (orange, yellow, red); everything else is bronze
          float flower = smoothstep(0.34, 0.5, sat) * step(pc.b + 0.06, pc.r);
          float l = dot(pc, vec3(0.299, 0.587, 0.114));
          vec3 bronze = diffuseColor.rgb * (0.35 + 2.4 * pow(clamp(l, 0.001, 1.0), 1.1));
          diffuseColor.rgb = mix(bronze, pc * 1.15, flower);`);
      };
      cast.customProgramCacheKey = () => 'patel-cast';
      gl.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = cast;
        // (a degenerate triangle gives a NaN normal, and one NaN pixel turns the whole post-processed frame black)
        const nr = mesh.geometry.attributes.normal;
        if (nr) for (let i = 0; i < nr.count; i++) if (!Number.isFinite(nr.getX(i) + nr.getY(i) + nr.getZ(i))) nr.setXYZ(i, 0, 1, 0);
        mesh.castShadow = mesh.receiveShadow = true;
      });
      gl.scene.scale.setScalar(3.6);
      gl.scene.rotation.y = Math.PI / 2; // the model faces +x: turned to face the temple (west, -z), his back to the market road
      gl.scene.position.set(x, 4.55, z);
      gl.scene.name = 'sardar-patel';
      g.add(gl.scene);
    }).catch(() => {
      const SB2 = new Batch();
      patelStatue(SB2, bronze, M, g, x, 4.55, z);
      SB2.flush(g);
    });
  }

  // ---------- Baan Stambh on the sea wall ----------
  baanStambh(g, B, S, M, P);

  // ---------- lamp posts, queue rails, benches ----------
  const lampPosts: [number, number][] = [];
  for (let z = 70; z <= 104; z += 8.5) lampPosts.push([-7.5, z], [7.5, z]);
  // (none where the statue's pillars, the mural wall or the basin stand)
  for (let z = 122; z <= 170; z += 12) for (const x of [DWAR.x - 11, DWAR.x + 11]) if (Math.hypot(x - STATUE.x, z - STATUE.z) > 8 && !(x > DWAR.x && z > 138 && z < 168) && Math.hypot(x - BASIN.x, z - BASIN.z) > 3.5) lampPosts.push([x, z]);
  for (let z = 184; z <= 400; z += 16) lampPosts.push([-9, z], [13, z]);
  for (let i = 0; i < SEA_WALL.length - 1; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 8; s < len - 4; s += 18) {
      const t = s / len;
      const x = lerp(ax, bx, t) - N[i][0] * 3.2, z = lerp(az, bz, t) - N[i][1] * 3.2;
      if (x < 60 && x > -110 && z > -130 && z < 200 && Math.hypot(x - BAAN.x, z - BAAN.z) > 6) lampPosts.push([x, z]);
    }
  }
  for (const [x, z] of lampPosts) {
    lampPost(B, S, globeMat, x, z);
    P.solid(x - 0.3, 0, z - 0.3, x + 0.3, 4, z + 0.3);
  }
  // inside the gate: a single covered walkway on the axis, straight from the Dwar to the court's gate before the
  // temple's steps (as seen from the air): a pale curved roof on steel posts over steel rails, the queue in its
  // southern half and the way out (and the walk) in its northern half
  const railPost = new Instances(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6).translate(0, 0.5, 0), steel);
  const shed = new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide });
  {
    const wz0 = 66.5, wz1 = 100.6, HW = WALK.hw;
    for (const x of [-HW, 0, HW]) {
      for (let z = wz0; z <= wz1 + 0.01; z += 2.5) railPost.at(x, 0, z);
      for (const y of [0.55, 0.98]) B.add(steel, new THREE.CylinderGeometry(0.03, 0.03, wz1 - wz0, 6).rotateX(Math.PI / 2).translate(x, y, (wz0 + wz1) / 2));
      P.solid(x - 0.06, 0, wz0, x + 0.06, 1.0, wz1);
    }
    const canopy = new THREE.MeshStandardMaterial({ color: 0xe8ecee, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
    B.add(canopy, new THREE.CylinderGeometry(HW + 0.5, HW + 0.5, wz1 - wz0, 20, 1, true, -Math.PI / 2, Math.PI).scale(1, 1, 0.28).rotateX(-Math.PI / 2).translate(0, 2.75, (wz0 + wz1) / 2));
    for (let z = wz0; z <= wz1 + 0.01; z += 3.2) for (const x of [-HW - 0.45, HW + 0.45]) B.span(steel, x - 0.04, x + 0.04, 0, 2.78, z - 0.04, z + 0.04);
  }
  // outside the gate: the covered queue, a single straight line between steel rails under a long grey sheet-metal
  // roof on steel posts, slanting across the plaza from its south-east to the foot of the Dwar's steps (entered at
  // the far end), where the line climbs in through the southern half of the door
  {
    const { ax, az, bx, bz, w } = QLANE;
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len, px = uz, pz = -ux; // along, and across
    const at = (t: number, o: number): [number, number] => [ax + ux * t + px * o, az + uz * t + pz * o];
    const mid = at(len / 2, 0);
    for (const o of [-w / 2, w / 2]) {
      for (let t = 0; t <= len + 0.01; t += 2.5) { const [x, z] = at(t, o); railPost.at(x, 0, z); }
      for (const y of [0.55, 0.98]) {
        const [x, z] = at(len / 2, o);
        B.add(steel, new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateX(Math.PI / 2).rotateY(ry).translate(x, y, z));
      }
      // (the colliders follow the slanting rail in short boxes)
      for (let t = 0; t < len; t += 0.8) {
        const [x0, z0] = at(t, o), [x1, z1] = at(Math.min(len, t + 0.8), o);
        P.solid(Math.min(x0, x1) - 0.06, 0, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, 1.0, Math.max(z0, z1) + 0.06);
      }
    }
    B.add(shed, new THREE.BoxGeometry(w + 1.1, 0.04, len + 0.4).rotateZ(-0.07).rotateY(ry).translate(mid[0], 2.85, mid[1]));
    for (let t = 0; t <= len + 0.01; t += 3) for (const o of [-(w / 2 + 0.4), w / 2 + 0.4]) {
      const [x, z] = at(t, o);
      B.add(steel, new THREE.BoxGeometry(0.08, 2.8 + (o < 0 ? 0.04 : -0.04), 0.08).translate(x, 1.4, z));
      if (o < 0) { const [x2, z2] = at(t, -o); B.add(steel, new THREE.CylinderGeometry(0.025, 0.025, w + 0.8, 6).rotateZ(Math.PI / 2).rotateY(ry).translate((x + x2) / 2, 2.8, (z + z2) / 2)); }
    }
  }
  // the plaza's south side by the queue: the compound wall carried on from the gate, crenellated like it
  {
    const wx = DWAR.x - 26, wz0 = 114.3, wz1 = 182;
    B.span(S, wx - 0.35, wx + 0.35, 0, 2.2, wz0, wz1);
    P.solid(wx - 0.4, 0, wz0, wx + 0.4, 3, wz1);
    for (let z = wz0 + 0.4; z < wz1 - 0.3; z += 1.0) B.box(S, 0.7, 0.45, 0.5, wx, 2.2, z);
  }
  // the plaza's north side: a grey precast concrete fence with scalloped panels, and before it, behind the statue,
  // a low wall of painted murals in yellow frames; the town's houses rise beyond
  {
    const fx = DWAR.x + 12.2, fz0 = 125.3, fz1 = 172;
    const precast = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.9 });
    weatherPlaster(precast);
    for (let z = fz0; z < fz1 - 0.1; z += 2.0) {
      B.span(precast, fx - 0.06, fx + 0.06, 0, 1.75, z, Math.min(fz1, z + 2.0));
      B.add(precast, new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.32, 1).translate(fx, 1.75, z + 1.0));
      B.span(precast, fx - 0.12, fx + 0.12, 0, 2.05, z - 0.08, z + 0.08);
    }
    P.solid(fx - 0.2, 0, fz0, fx + 0.2, 2.5, fz1);
    const mx = fx - 0.9, mz0 = 141, mz1 = 166, frame = new THREE.MeshStandardMaterial({ color: 0xe0b23c, roughness: 0.75 });
    B.span(frame, mx - 0.25, mx + 0.25, 0, 2.9, mz0, mz1);
    P.solid(mx - 0.3, 0, mz0, mx + 0.3, 3, mz1);
    const tex = muralTexture();
    const n = 7, pw = (mz1 - mz0) / n;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.35, 1.7), new THREE.MeshStandardMaterial({ map: tex[k % tex.length], roughness: 0.8 }));
      m.position.set(mx - 0.26, 1.75, mz0 + pw * (k + 0.5));
      m.rotation.y = -Math.PI / 2;
      g.add(m);
    }
  }
  // the thin white flagstaff in the plaza, the red-rimmed square basin before the statue, and the big LED screen
  // beside the gate
  {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
    const px = DWAR.x + 6, pz = 130;
    B.lathe(white, [[0, 0], [0.5, 0], [0.5, 0.12], [0.09, 0.14], [0.06, 11], [0.08, 11.1], [0, 11.15]], px, 0, pz, 10);
    P.solid(px - 0.3, 0, pz - 0.3, px + 0.3, 5, pz + 0.3);
    const red = new THREE.MeshStandardMaterial({ color: 0xa83a24, roughness: 0.7 });
    const bx = BASIN.x, bz = BASIN.z, hw = 1.6, hd = 2.4;
    B.span(red, bx - hw, bx + hw, 0, 0.45, bz - hd, bz - hd + 0.3);
    B.span(red, bx - hw, bx + hw, 0, 0.45, bz + hd - 0.3, bz + hd);
    B.span(red, bx - hw, bx - hw + 0.3, 0, 0.45, bz - hd, bz + hd);
    B.span(red, bx + hw - 0.3, bx + hw, 0, 0.45, bz - hd, bz + hd);
    B.span(new THREE.MeshStandardMaterial({ color: 0x8fb8b4, roughness: 0.15, metalness: 0.1 }), bx - hw + 0.3, bx + hw - 0.3, 0, 0.3, bz - hd + 0.3, bz + hd - 0.3);
    P.solid(bx - hw, 0, bz - hd, bx + hw, 0.6, bz + hd);
    const sx = DWAR.x + 10.2, sz = 121.2;
    for (const o of [-2.2, 2.2]) B.span(steel, sx + o - 0.1, sx + o + 0.1, 0, 2.4, sz - 0.1, sz + 0.1);
    B.span(T.shade, sx - 2.7, sx + 2.7, 2.2, 5.3, sz - 0.18, sz + 0.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 2.9), new THREE.MeshBasicMaterial({ map: screenTexture() }));
    scr.position.set(sx, 3.75, sz + 0.03);
    g.add(scr);
    P.solid(sx - 2.7, 0, sz - 0.2, sx + 2.7, 5.3, sz + 0.2);
  }
  railPost.flush(g);
  for (const [x, z] of [[-11, 70], [-11, 84], [11, 76], [11, 92], [-12, 98], [-40, 105], [-62, 125], [-35, 2], [-48, 20]] as const) {
    B.span(S, x - 0.9, x + 0.9, 0.3, 0.55, z - 0.3, z + 0.3);
    B.span(S, x - 0.8, x - 0.55, 0, 0.3, z - 0.25, z + 0.25);
    B.span(S, x + 0.55, x + 0.8, 0, 0.3, z - 0.25, z + 0.25);
  }

  // ---------- high-mast floodlights over the gardens, and the light show's projectors ----------
  for (const [x, z] of [[30, 62], [-34, -30], [-44, 66], [36, 110], [-20, 108], [12, -62]] as const) {
    B.lathe(steel, [[0, 0], [0.32, 0], [0.32, 0.5], [0.22, 0.6], [0.11, 17.5], [0, 17.6]], x, 0, z, 10);
    B.lathe(steel, [[0, 0], [0.9, 0], [0.9, 0.12], [0, 0.12]], x, 17.4, z, 16);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      B.box(globeMat, 0.34, 0.24, 0.12, x + Math.cos(a) * 0.82, 17.15, z + Math.sin(a) * 0.82, -a + Math.PI / 2);
    }
    P.solid(x - 0.35, 0, z - 0.35, x + 0.35, 6, z + 0.35);
  }
  // two big projector lamps on yokes, flanking the path from the south porch to the Baan Stambh
  {
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.75, roughness: 0.35 });
    for (const z of [10, 36]) {
      const x = -42;
      B.span(concrete, x - 0.7, x + 0.7, 0, 0.5, z - 0.7, z + 0.7);
      B.lathe(gold, [[0, 0], [0.12, 0], [0.1, 1.4], [0, 1.4]], x, 0.5, z, 10);
      for (const s2 of [-1, 1]) B.box(gold, 0.08, 0.9, 0.08, x, 1.6, z + s2 * 0.55);
      B.box(gold, 0.08, 0.08, 1.18, x, 1.6, z);
      // the drum, tipped up towards the temple
      const drum = new THREE.CylinderGeometry(0.42, 0.5, 1.0, 20, 1, true).rotateZ(Math.PI / 2 + 0.35).translate(x, 2.2, z);
      B.add(gold, drum);
      B.add(globeMat, new THREE.CircleGeometry(0.42, 20).rotateY(Math.PI / 2).rotateZ(0.35).translate(x + 0.47, 2.37, z));
      P.solid(x - 0.75, 0, z - 0.75, x + 0.75, 2.8, z + 0.75);
    }
  }

  // ---------- the Samudra Darshan pergola along the sea wall, and "जय सोमनाथ" on its face ----------
  seaPergola(g, B, SB, S, P, N);

  // ---------- palms along the walkway and the promenade ----------
  const palms: [number, number, number][] = [
    [-12.5, 66, 7.5], [12.5, 74, 8], [-15.5, 80, 7], [13.5, 100, 8.5], [-26, 58, 9], [26, 30, 7.5], [-24, -14, 8],
    [-40, 8, 7], [-46, 40, 8.5], [-70, 120, 7.5], [-34, 104, 8], [20, 120, 7], [-16, 125, 8], [30, 108, 9],
    [33, 46, 9], [44, 62, 10], [36, 90, 9.5], [-38, 28, 9], [-46, 82, 10], [-36, 94, 8.5],
    [34, -70, 10], [42, -84, 9], [20, -40, 8.5], [-10, -45, 9], [-12, 140, 9], [18.5, 150, 9.5], [-17, 150, 8], [16, 168, 8.5],
  ];
  for (const [x, z, h] of palms) {
    palm(B, palmBark, x, z, h, x * 0.37 + z);
    P.solid(x - 0.3, 0, z - 0.3, x + 0.3, 3, z + 0.3);
  }

  flushFronds(g);

  // ---------- the town of Prabhas Patan beyond the walls ----------
  town(g);

  // ---------- diyas along the walkway kerbs ----------
  for (let z = 66; z <= 104; z += 1.6) flames.points.push(new THREE.Vector3(-5.2, 0.08, z), new THREE.Vector3(5.2, 0.08, z));
  for (let x = -22; x <= 22; x += 1.1) if (Math.abs(x) > 6) flames.points.push(new THREE.Vector3(x, 1.75, K.z1 + 0.05));

  B.flush(g);
  // The sea's mirror pass renders only the sky and the shore. From anywhere a pilgrim can stand,
  // the temple, town and trees lie behind the viewer when looking out to sea, so they never appear
  // in the reflection - and skipping them halves the frame cost.
  const mirror = water.onBeforeRender.bind(water);
  water.onBeforeRender = (...args) => {
    const hidden = root.children.filter((c) => c !== shore && c !== water && c.visible);
    hidden.forEach((o) => (o.visible = false));
    mirror(...args);
    hidden.forEach((o) => (o.visible = true));
  };
  return { group: g, water, shore, ready: Promise.all([dwarReady, patelReady]).then(() => undefined) };
}

// ---------- Digvijay Dwar ----------

function buildDwar(g: THREE.Group, B: Batch, S: THREE.Material, T0: PrecinctMats, M: Materials, P: Physics): Promise<void> {
  // Shri Digvijay Dwar, from the photographs: a near-square two-storey gatehouse in pale butter-yellow paint,
  // its walls banded with layered mouldings; on each face a doorway between two fat round columns under a
  // serpent torana, jharokha balconies at the corners and the centre of both storeys, deity reliefs in the
  // wall; deep chhajja eaves; and on the roof two big stepped pyramids, one behind the other along the
  // passage, with smaller ones over the corners (about 21 m to the finials).
  const { x: cx, z0, z1, hw, door } = DWAR;
  const zc = (z0 + z1) / 2, d = z1 - z0;
  // painted limewash (no stone grain), faintly monsoon-stained; its eaves take the same paint
  weatherPlaster(S as THREE.MeshStandardMaterial);
  // (the paint material is double-sided, so it also serves for the eaves)
  const T = { ...T0, stoneTwo: S };
  const xl = cx - hw, xr = cx + hw, dl = cx - door, dr = cx + door;
  // ground storey, its cornice and the name band, the upper storey, the top eave, the roof terrace
  const G1 = 7.2, C1 = G1 + 0.9, NB = C1 + 0.7, U1 = NB + 4.4, R0 = U1 + 0.8;
  // the gatehouse itself is modelled in Blender (scratchpad dwar.py → assets/models/digvijay_dwar.glb); this simpler
  // build of it, D, is used only if that file can't be loaded
  const D = new Batch();
  // ground storey: two masses either side of the passage, on a moulded plinth
  for (const [a, b] of [[xl, dl - 0.6], [dr + 0.6, xr]]) {
    D.span(S, a - 0.35, b, 0, 0.5, z0 - 0.35, z1 + 0.35);
    D.span(S, a - 0.2, b, 0.5, 0.75, z0 - 0.2, z1 + 0.2);
    D.span(S, a, b, 0.75, G1, z0, z1);
    P.solid(a - 0.35, 0, z0 - 0.35, b, 20, z1 + 0.35);
  }
  // the passage's dark ceiling and the wall over it
  D.span(T.shade, dl - 0.6, dr + 0.6, 5.5, 5.6, z0 + 0.3, z1 - 0.3);
  D.span(S, dl - 0.6, dr + 0.6, 5.6, G1, z0, z1);
  // the ground-storey cornice: two stepped courses and a deep chhajja
  D.span(S, xl - 0.25, xr + 0.25, G1, G1 + 0.35, z0 - 0.25, z1 + 0.25);
  D.span(S, xl - 0.45, xr + 0.45, G1 + 0.35, G1 + 0.55, z0 - 0.45, z1 + 0.45);
  eave(D, T.stoneTwo, cx, zc, 2 * hw + 1.0, d + 1.0, G1 + 0.55, 0.8, 0.35);
  // the name band and the upper storey
  D.span(S, xl - 0.1, xr + 0.1, C1, NB, z0 - 0.1, z1 + 0.1);
  D.span(S, xl + 0.1, xr - 0.1, NB, U1, z0 + 0.1, z1 - 0.1);
  // the top cornice and its deep eave, the roof terrace's parapet
  D.span(S, xl - 0.15, xr + 0.15, U1, U1 + 0.35, z0 - 0.15, z1 + 0.15);
  eave(D, T.stoneTwo, cx, zc, 2 * hw + 1.2, d + 1.2, U1 + 0.35, 0.9, 0.4);
  D.span(S, xl + 0.2, xr - 0.2, R0 - 0.1, R0 + 0.5, z0 + 0.2, z1 - 0.2);
  // layered mouldings banding the plain walls, on all four faces
  const band = (y: number, h: number, out: number) => D.span(S, xl - out, xr + out, y, y + h, z0 - out, z1 + out);
  for (const y of [1.15, 4.6, 6.7]) { band(y, 0.14, 0.08); band(y + 0.18, 0.08, 0.04); }
  for (const y of [NB + 0.15, U1 - 0.5]) { band(y, 0.14, 0.18); band(y + 0.18, 0.08, 0.13); }
  // corner pilasters
  for (const x of [xl + 0.35, xr - 0.35]) for (const z of [z0 + 0.35, z1 - 0.35]) {
    D.span(S, x - 0.5, x + 0.5, 0.75, G1, z - 0.5, z + 0.5);
    D.span(S, x - 0.42, x + 0.42, NB, U1, z - 0.42, z + 0.42);
  }

  // both faces alike: the outer (+z, to the market) and the inner (-z, to the temple)
  for (const [z, s] of [[z0, -1], [z1, 1]] as const) {
    const fz = z + s * 0.8;
    // the two fat round columns with cushion capitals, on square bases
    for (const x of [dl - 0.35, dr + 0.35]) {
      D.box(S, 1.15, 0.75, 1.15, x, 0, fz);
      D.lathe(S, [[0, 0], [0.5, 0], [0.5, 0.35], [0.42, 0.45], [0.4, 0.8], [0.44, 0.9], [0.38, 1.0], [0.36, 3.7], [0.42, 3.85], [0.56, 4.05],
        [0.6, 4.25], [0.5, 4.45], [0.42, 4.55], [0.55, 4.65], [0.55, 4.85], [0, 4.85]], x, 0.75, fz, 18);
      P.solid(x - 0.6, 0, fz - 0.6, x + 0.6, 6, fz + 0.6);
    }
    // the entablature over the columns and the serpent torana under it (cusped arches, one behind another)
    D.span(S, dl - 1.3, dr + 1.3, 5.6, 6.35, fz - 0.5, fz + 0.5);
    D.span(S, dl - 1.45, dr + 1.45, 6.35, 6.5, fz - 0.6, fz + 0.6);
    for (let k = 0; k < 2; k++) {
      const arch = archPanelGeometry(door * 2 + 0.2 + k * 0.4, 4.85 + k * 0.2, 0.26, 9 + k * 2);
      arch.translate(cx, 0.75, fz - s * k * 0.3);
      D.add(S, arch);
    }
    // the coiled serpents (naga) of the torana: two loops each side over the capitals
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const coil = new THREE.TorusGeometry(0.32 - k * 0.08, 0.09, 6, 14, Math.PI * 1.6).rotateZ(sx * 0.6 + k);
        coil.translate(cx + sx * (door - 0.15 - k * 0.55), 5.3 - k * 0.05, fz + s * 0.15);
        D.add(S, coil);
      }
    }
    // the ground storey: jharokha windows either side, deity reliefs in niches between
    for (const x of [cx - 5.7, cx + 5.7]) jharokha(D, S, T.shade, x, 2.4, z, 0, s, 2.6, 3.1, T.jali);
    for (const x of [cx - 3.4, cx + 3.4, xl + 1.2, xr - 1.2]) {
      D.box(T.shade, 1.0, 2.2, 0.05, x, 1.6, z + s * 0.02);
      const fig = figureReliefGeometry().scale(1.0, 1.1, 1.0);
      if (s < 0) fig.rotateY(Math.PI);
      fig.translate(x, 1.7, z + s * 0.1);
      D.add(S, fig);
      D.box(S, 1.3, 0.2, 0.4, x, 3.85, z + s * 0.2);
    }
    // the upper storey: a broad jharokha at the centre over the door, narrower ones at the corners
    jharokha(D, S, T.shade, cx, NB + 1.0, z, 0, s, 4.2, 3.0, T.jali);
    for (const x of [xl + 1.7, xr - 1.7]) jharokha(D, S, T.shade, x, NB + 1.2, z, 0, s, 2.4, 2.8, T.jali);
  }
  // the two side faces: a jharokha at the centre of the upper storey, windows and reliefs below
  for (const [x, s] of [[xl, -1], [xr, 1]] as const) {
    jharokha(D, S, T.shade, x, NB + 1.0, zc, s, 0, 3.4, 3.0, T.jali);
    for (const zz of [z0 + 3.0, z1 - 3.0]) jharokha(D, S, T.shade, x, 2.4, zz, s, 0, 2.4, 3.0, T.jali);
    for (const zz of [zc - 1.3, zc + 1.3]) {
      D.box(T.shade, 0.05, 2.2, 1.0, x + s * 0.02, 1.6, zz);
      const fig = figureReliefGeometry().scale(1.0, 1.1, 1.0).rotateY(s * Math.PI / 2);
      fig.translate(x + s * 0.1, 1.7, zz);
      D.add(S, fig);
    }
  }
  // the roof: two big stepped pyramids on square drums along the passage, smaller ones over the corners
  for (const z of [zc - 3.5, zc + 3.5]) {
    D.span(S, cx - 3.6, cx + 3.6, R0, R0 + 1.6, z - 3.4, z + 3.4);
    D.span(S, cx - 3.9, cx + 3.9, R0 + 1.6, R0 + 1.85, z - 3.7, z + 3.7);
    phamsana(D, S, cx, R0 + 1.85, z, 3.6, 7.2, 16);
  }
  for (const x of [xl + 1.8, xr - 1.8]) for (const z of [z0 + 1.8, z1 - 1.8]) {
    D.span(S, x - 1.5, x + 1.5, R0, R0 + 1.0, z - 1.5, z + 1.5);
    D.span(S, x - 1.7, x + 1.7, R0 + 1.0, R0 + 1.18, z - 1.7, z + 1.7);
    phamsana(D, S, x, R0 + 1.18, z, 1.7, 3.4, 8);
  }
  // inscription in red on the name band, on both faces: श्री दिग्विजय द्वार
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 200;
  const x2 = c.getContext('2d')!;
  x2.fillStyle = '#b0201a';
  x2.textAlign = 'center';
  x2.font = '800 186px Martel, "Noto Sans Devanagari", serif';
  x2.fillText('श्री दिग्विजय द्वार', 1024, 170);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const signMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 });
  // the trust's white welcome banner hung between the columns, lettered in red
  const bc = document.createElement('canvas');
  bc.width = 1024; bc.height = 256;
  const bx = bc.getContext('2d')!;
  bx.fillStyle = '#f7f5ef'; bx.fillRect(0, 0, 1024, 256);
  bx.strokeStyle = '#c0281e'; bx.lineWidth = 8; bx.strokeRect(10, 10, 1004, 236);
  bx.fillStyle = '#c0281e'; bx.textAlign = 'center';
  bx.font = '800 96px Martel, "Noto Sans Devanagari", serif';
  bx.fillText('श्री सोमनाथ ट्रस्ट', 512, 108);
  bx.font = '600 62px Martel, "Noto Sans Devanagari", serif';
  bx.fillText('आपका हार्दिक स्वागत करता है', 512, 205);
  const btex = new THREE.CanvasTexture(bc);
  btex.colorSpace = THREE.SRGBColorSpace;
  btex.anisotropy = 8;
  const bannerMat = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.7, side: THREE.DoubleSide });
  // the red notice boards on the columns' pedestals' faces
  const rc = document.createElement('canvas');
  rc.width = 64; rc.height = 256;
  const rx = rc.getContext('2d')!;
  rx.fillStyle = '#b8241c'; rx.fillRect(0, 0, 64, 256);
  rx.fillStyle = '#f4e9d8';
  for (let y = 26; y < 240; y += 16) rx.fillRect(10, y, 30 + ((y * 7) % 14), 5);
  const rtex = new THREE.CanvasTexture(rc);
  rtex.colorSpace = THREE.SRGBColorSpace;
  const redMat = new THREE.MeshStandardMaterial({ map: rtex, roughness: 0.7 });
  // (as in the model: the passage floor PLAT up, five steps each side; the porch pillars 0.8 m out from each face)
  const PLAT = 1.0;
  for (const [z, ry, s] of [[z1, 0, 1], [z0, Math.PI, -1]] as const) {
    // the name on the projecting base of the upper central balcony
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 0.6), signMat);
    sign.position.set(cx, 8.43, z + s * 0.77);
    sign.rotation.y = ry;
    g.add(sign);
    // the welcome banner, hung just inside the porch under the serpents and lamps
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.82), bannerMat);
    banner.position.set(cx, PLAT + 3.55, z + s * 0.55);
    banner.rotation.y = ry;
    g.add(banner);
    // the red notice boards on the pillars' square shafts
    for (const x of [dl - 0.35, dr + 0.35]) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.5), redMat);
      board.position.set(x, PLAT + 1.8, z + s * 1.175);
      board.rotation.y = ry;
      g.add(board);
    }
    // walkable: the steps up to the doorway and its raised floor; the handrails can't be walked through
    const zs = z + s * 1.2, ze = z + s * 2.8;
    P.floor(g, dl - 0.9, dr + 0.9, Math.min(zs, ze), Math.max(zs, ze), s > 0 ? PLAT : 0, s > 0 ? 0 : PLAT);
    for (const x of [cx - (door - 0.45), cx + (door - 0.45)]) P.solid(x - 0.05, 0, Math.min(z + s * 1.0, z + s * 3.15), x + 0.05, PLAT + 1.0, Math.max(z + s * 1.0, z + s * 3.15));
  }
  P.floor(g, dl - 0.6, dr + 0.6, z0 - 1.2, z1 + 1.2, PLAT);

  // outside, beside the gate: the round white security kiosk at its southern corner (as photographed from the
  // plaza), the "सुरक्षा विभाग" office against the wall to the north, and a black iron railing in front of that
  {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.85 });
    weatherPlaster(white);
    const kx = xl + 3.0, kz = z1 + 3.3;
    B.lathe(white, [[0, 0], [1.7, 0], [1.7, 2.6], [1.78, 2.65], [1.78, 2.8], [0, 2.8]], kx, 0, kz, 28);
    for (let k = 0; k < 5; k++) {
      const a = 1.2 + k * 0.55; // (windows round its plaza and southern sides)
      B.add(T.shade, new THREE.PlaneGeometry(0.34, 0.5).rotateY(a + Math.PI / 2).translate(kx + Math.cos(a) * 1.71, 1.55, kz + Math.sin(a) * 1.71));
    }
    P.solid(kx - 1.75, 0, kz - 1.75, kx + 1.75, 3, kz + 1.75);
    // the security office: a low cream block with a deep blue-framed signboard and a window band
    const ox0 = xr + 0.4, ox1 = xr + 9.5, oz0 = 114.3, oz1 = 118.3;
    B.span(S, ox0, ox1, 0, 3.2, oz0, oz1);
    B.span(S, ox0 - 0.15, ox1 + 0.15, 3.2, 3.45, oz0, oz1 + 0.2);
    B.span(T.shade, ox0 + 1.5, ox1 - 0.6, 0.9, 2.0, oz1, oz1 + 0.04);
    P.solid(ox0, 0, oz0, ox1, 3.5, oz1);
    const sc = document.createElement('canvas');
    sc.width = 512; sc.height = 128;
    const sx = sc.getContext('2d')!;
    sx.fillStyle = '#2a5aa8'; sx.fillRect(0, 0, 512, 128);
    sx.fillStyle = '#f7f1e0'; sx.fillRect(10, 10, 492, 108);
    sx.fillStyle = '#b8241c'; sx.textAlign = 'center';
    sx.font = '700 26px Martel, "Noto Sans Devanagari", serif';
    sx.fillText('श्री सोमनाथ ट्रस्ट', 256, 44);
    sx.font = '800 54px Martel, "Noto Sans Devanagari", serif';
    sx.fillText('सुरक्षा विभाग', 256, 104);
    const stex = new THREE.CanvasTexture(sc);
    stex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: stex, roughness: 0.7 }));
    board.position.set(ox0 + 3.6, 2.55, oz1 + 0.05);
    g.add(board);
    // black iron railing: square bars between posts, with spear tops
    const iron = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, metalness: 0.6, roughness: 0.5 });
    const rz = z1 + 6.0, rx0 = xr + 0.2, rx1 = ox1;
    for (let x = rx0; x <= rx1 + 0.01; x += 0.14) B.box(iron, 0.025, 1.15, 0.025, x, 0, rz);
    for (let x = rx0; x <= rx1 + 0.01; x += 2.4) B.box(iron, 0.07, 1.3, 0.07, x, 0, rz);
    for (const y of [0.12, 1.02]) B.box(iron, rx1 - rx0, 0.04, 0.04, (rx0 + rx1) / 2, y, rz);
    P.solid(rx0, 0, rz - 0.06, rx1, 1.3, rz + 0.06);
  }

  // the Blender model, painted with the gate's limewash (its shade comes from the scene's own shadows and AO: shadows
  // baked per vertex went black on the big wall faces, whose corner vertices sit inside the cornices)
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/models/digvijay_dwar.glb').then((gl) => {
    const paint = S;
    gl.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name;
      mesh.material = name === 'dark' ? T.shade : paint;
      mesh.castShadow = mesh.receiveShadow = true;
    });
    gl.scene.position.set(cx, 0, zc);
    gl.scene.name = 'digvijay-dwar';
    g.add(gl.scene);
  }).catch((e) => {
    console.warn('Digvijay Dwar model not loaded, using the simple build', e);
    D.flush(g);
  });
}

/**
 * Projecting jharokha balcony on a wall: stepped corbels, a balustraded platform, slender pillars, a dark
 * opening behind and a small pyramidal cap. (nx, nz) is the outward normal of the wall at (x, z).
 */
function jharokha(B: Batch, S: THREE.Material, dark: THREE.Material, x: number, y: number, z: number, nx: number, nz: number, w: number, h: number, jali?: THREE.Material) {
  // a deep projecting balcony: a moulded frame round a recessed window, a jali screen in its lower half,
  // stepped corbels, a balustraded platform with side screens, four slender pillars, a sloping chhajja and a cap
  const ry = Math.atan2(nx, nz);
  const at = (out: number, along = 0): [number, number] => [x + nx * out + Math.cos(ry) * along, z + nz * out - Math.sin(ry) * along];
  const D = 1.5;
  let [px, pz] = at(0.02);
  B.box(dark, w - 0.5, h - 0.5, 0.05, px, y + 0.45, pz, ry);
  // window frame proud of the wall
  [px, pz] = at(0.12);
  B.box(S, w - 0.2, 0.18, 0.24, px, y + h - 0.25, pz, ry);
  for (const al of [-(w - 0.35) / 2, (w - 0.35) / 2]) { [px, pz] = at(0.12, al); B.box(S, 0.15, h - 0.6, 0.24, px, y + 0.35, pz, ry); }
  if (jali) { [px, pz] = at(0.2); B.box(jali, w - 0.6, (h - 0.6) * 0.5, 0.05, px, y + 0.4, pz, ry); }
  // corbels
  for (let k = 0; k < 4; k++) {
    [px, pz] = at(0.3 + k * 0.28);
    B.box(S, w - 0.2 - k * 0.32, 0.18, 0.6, px, y - 0.72 + k * 0.18, pz, ry);
  }
  for (const al of [-w / 2 + 0.25, 0, w / 2 - 0.25]) {
    [px, pz] = at(0.75, al);
    B.add(S, new THREE.ConeGeometry(0.14, 0.3, 6).rotateX(Math.PI).translate(px, y - 0.85, pz));
  }
  [px, pz] = at(D / 2);
  B.box(S, w + 0.3, 0.24, D, px, y, pz, ry);
  // balustrade: front rail and side screens
  [px, pz] = at(D - 0.07);
  B.box(S, w + 0.2, 0.12, 0.16, px, y + 0.85, pz, ry);
  B.box(jali ?? S, w, 0.6, 0.06, px, y + 0.24, pz, ry);
  for (const sg of [-1, 1]) {
    [px, pz] = at(D / 2, sg * (w / 2 + 0.05));
    B.box(jali ?? S, 0.06, 0.6, D - 0.2, px, y + 0.24, pz, ry);
  }
  for (const al of [-w / 2 + 0.12, -w / 6, w / 6, w / 2 - 0.12]) {
    [px, pz] = at(D - 0.12, al);
    B.lathe(S, [[0, 0], [0.11, 0], [0.08, 0.12], [0.06, 0.3], [0.08, 0.34], [0.06, 0.38], [0.06, h - 0.65], [0.12, h - 0.5], [0, h - 0.42]], px, y + 0.24, pz, 8);
  }
  [px, pz] = at(D / 2 + 0.05);
  B.box(S, w + 0.5, 0.2, D + 0.3, px, y + h - 0.18, pz, ry);
  phamsana(B, S, px, y + h + 0.02, pz, (w + 0.3) / 2, Math.min(1.6, w * 0.5), 5);
}

/**
 * Open pillared chhatri projecting from a wall facing ±z (s): corbelled platform with a low balustrade,
 * four slender pillars carrying a deep eave and a ribbed cap, open on three sides, a dark doorway behind.
 */
function chhatri(B: Batch, S: THREE.Material, dark: THREE.Material, x: number, y: number, z: number, s: number, w: number, h: number) {
  const D = 1.7;
  B.box(dark, w * 0.55, h * 0.72, 0.05, x, y + 0.3, z + s * 0.02);
  for (let k = 0; k < 4; k++) B.box(S, w - 0.3 - k * 0.4, 0.18, 0.5, x, y - 0.72 + k * 0.18, z + s * (0.25 + k * 0.3));
  B.box(S, w + 0.3, 0.24, D, x, y, z + s * D / 2);
  B.box(S, w + 0.1, 0.1, 0.14, x, y + 0.62, z + s * (D - 0.08));
  for (let k = 0; k < 7; k++) B.box(S, 0.07, 0.38, 0.07, x - w / 2 + 0.2 + (k * (w - 0.4)) / 6, y + 0.24, z + s * (D - 0.08));
  for (const [ax, az] of [[-w / 2 + 0.15, D - 0.15], [w / 2 - 0.15, D - 0.15], [-w / 2 + 0.15, 0.35], [w / 2 - 0.15, 0.35]]) {
    B.lathe(S, [[0, 0], [0.14, 0], [0.1, 0.14], [0.075, 0.32], [0.1, 0.38], [0.075, 0.44], [0.075, h - 0.6], [0.14, h - 0.48], [0.16, h - 0.4], [0, h - 0.38]], x + ax, y + 0.24, z + s * az, 10);
  }
  B.box(S, w + 0.5, 0.22, D + 0.3, x, y + h - 0.16, z + s * (D / 2 + 0.05));
  B.box(S, w + 0.9, 0.08, D + 0.7, x, y + h + 0.06, z + s * (D / 2 + 0.05));
  phamsana(B, S, x, y + h + 0.14, z + s * (D / 2 + 0.05), (w + 0.3) / 2, Math.min(1.8, w * 0.55), 6);
}

/** Stepped pyramidal roof of horizontal slabs, crowned by a bell and kalash. */
function phamsana(B: Batch, S: THREE.Material, x: number, y: number, z: number, half: number, H: number, tiers: number) {
  const th = (H * 0.8) / tiers;
  for (let k = 0; k < tiers; k++) {
    const w = half * (1 - k / (tiers + 0.6));
    B.box(S, 2 * w, th * 0.7, 2 * w, x, y + k * th, z);
    B.box(S, 2 * w + 0.22, th * 0.3, 2 * w + 0.22, x, y + k * th + th * 0.7, z);
    // little ghanta knobs at the corners and mid-sides of each course (the ribbing seen in the photos)
    if (half > 2 && k % 2 === 0) {
      for (const [ox, oz] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        B.lathe(S, [[0, 0], [0.16, 0], [0.13, 0.14], [0.05, 0.24], [0, 0.26]], x + ox * w, y + (k + 1) * th, z + oz * w, 6);
      }
    }
  }
  const top = y + tiers * th;
  const r = half * 0.3;
  B.lathe(S, [[0, 0], [r, 0], [r * 1.05, r * 0.2], [r * 0.8, r * 0.6], [r * 0.45, r * 0.9], [r * 0.6, r * 1.0], [r * 0.6, r * 1.12], [r * 0.25, r * 1.2],
    [r * 0.38, r * 1.45], [r * 0.2, r * 1.75], [r * 0.06, r * 2.05], [0, r * 2.1]], x, top, z, 16);
}

// ---------- statue ----------

/** A standing statue of Sardar Vallabhbhai Patel in dhoti and shawl, in dark bronze, facing east. */
function patelStatue(B: Batch, bronze: THREE.Material, M: Materials, g: THREE.Group, x: number, y: number, z: number) {
  const s = 1.45;
  const L = (prof: [number, number][], seg = 18) => B.lathe(bronze, prof.map(([r, h]) => [r * s, h * s] as [number, number]), x, y, z, seg);
  // feet and the dhoti falling to the ankles
  for (const dx of [-0.13, 0.13]) {
    const foot = new THREE.BoxGeometry(0.13 * s, 0.09 * s, 0.3 * s).translate(x + dx * s, y + 0.045 * s, z + 0.06 * s);
    B.add(bronze, foot);
  }
  L([[0, 0.06], [0.36, 0.08], [0.34, 0.5], [0.3, 0.95], [0.28, 1.0], [0, 1.0]]);
  // kurta and the shawl wrapped round the shoulders
  L([[0, 0.95], [0.3, 0.95], [0.32, 1.25], [0.36, 1.6], [0.42, 1.85], [0.44, 2.0], [0.38, 2.1], [0.16, 2.18], [0, 2.2]]);
  const shawl = new THREE.CylinderGeometry(0.47 * s, 0.4 * s, 0.85 * s, 18, 1, true).translate(x, y + 1.7 * s, z);
  B.add(bronze, shawl);
  const drape = new THREE.BoxGeometry(0.18 * s, 0.9 * s, 0.12 * s).rotateZ(0.35).translate(x + 0.22 * s, y + 1.55 * s, z + 0.38 * s);
  B.add(bronze, drape);
  // folded hands in front
  const hands = new THREE.SphereGeometry(0.11 * s, 10, 8).scale(1.4, 0.8, 0.9).translate(x, y + 1.42 * s, z + 0.43 * s);
  B.add(bronze, hands);
  // neck and head
  L([[0, 2.15], [0.08, 2.17], [0.08, 2.27], [0, 2.3]], 12);
  const head = new THREE.SphereGeometry(0.135 * s, 16, 12).scale(0.92, 1.12, 1).translate(x, y + 2.43 * s, z + 0.01);
  B.add(bronze, head);
  // a marigold garland
  const beads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 0), M.marigold, 40);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const dy = Math.max(0, Math.cos(a)) * 0.32;
    beads.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + Math.sin(a) * 0.36 * s, y + (2.08 - dy) * s, z + Math.cos(a) * 0.3 * s + 0.08));
  }
  g.add(beads);
}

// ---------- Baan Stambh ----------

/** The arrow pillar on the sea wall: a carved column topped by a globe pierced by an arrow pointing south, across the open sea to the South Pole. */
function baanStambh(g: THREE.Group, B: Batch, S: THREE.Material, M: Materials, P: Physics) {
  // The arrow pillar stands on the sea wall itself: a square carved stambha in three stepped blocks with
  // figure panels, a lotus cushion, a weathered stone globe pierced by a barbed metal arrow pointing south
  // over the open sea, and a fan-shaped finial.
  const { x, z } = BAAN;
  const sq = (w: number, y0: number, y1: number) => B.span(S, x - w / 2, x + w / 2, y0, y1, z - w / 2, z + w / 2);
  sq(1.7, 0, 0.5);
  sq(1.45, 0.5, 0.65);
  sq(1.15, 0.65, 2.0);      // lower block (inscribed)
  sq(1.35, 2.0, 2.18); sq(1.25, 2.18, 2.3);
  sq(1.0, 2.3, 3.3);        // middle block with figure panels
  sq(1.2, 3.3, 3.45); sq(1.05, 3.45, 3.55);
  sq(0.8, 3.55, 4.3);       // upper block
  sq(0.95, 4.3, 4.42);
  // figure panels on the middle block and smaller ones on the upper block, all four faces
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const f1 = figureReliefGeometry().scale(0.62, 0.62, 0.8).rotateY(a).translate(x + Math.sin(a) * 0.5, 2.38, z + Math.cos(a) * 0.5);
    B.add(S, f1);
    const f2 = figureReliefGeometry().scale(0.45, 0.45, 0.7).rotateY(a).translate(x + Math.sin(a) * 0.4, 3.6, z + Math.cos(a) * 0.4);
    B.add(S, f2);
  }
  // lotus cushion
  B.lathe(S, [[0, 0], [0.5, 0], [0.62, 0.08], [0.66, 0.16], [0.55, 0.22], [0.4, 0.26], [0, 0.26]], x, 4.42, z, 16);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    B.add(S, new THREE.SphereGeometry(0.13, 8, 5).scale(0.8, 0.9, 0.45).rotateY(-a).translate(x + Math.cos(a) * 0.56, 4.58, z + Math.sin(a) * 0.56));
  }
  // the globe
  // painted sky-blue, as it is today
  const globeStone = new THREE.MeshStandardMaterial({ color: 0x2f74c0, roughness: 0.45 });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 20), globeStone);
  globe.position.set(x, 5.25, z);
  globe.castShadow = true;
  g.add(globe);
  // the arrow: a metal shaft through the globe, a barbed head out over the sea (south, -x), fletching behind
  const metal = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.9, roughness: 0.3 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), metal);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(x, 5.25, z);
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), metal);
  head.rotation.z = Math.PI / 2;
  head.position.set(x - 1.36, 5.25, z);
  g.add(head);
  for (const s of [-1, 1]) {
    const barb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), metal);
    barb.position.set(x - 1.12, 5.25 + s * 0.11, z);
    barb.rotation.z = -s * 0.7;
    g.add(barb);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2), metal);
    fin.position.set(x + 1.05, 5.25 + s * 0.08, z);
    fin.rotation.x = s * 0.6;
    g.add(fin);
  }
  // fan-shaped finial on top of the globe
  const fan = new THREE.Shape();
  fan.moveTo(0, 0);
  fan.lineTo(-0.38, 0.32); fan.quadraticCurveTo(0, 0.62, 0.38, 0.32); fan.lineTo(0, 0);
  const fg = new THREE.ExtrudeGeometry(fan, { depth: 0.08, bevelEnabled: false });
  fg.translate(0, 0, -0.04).rotateY(Math.PI / 2).translate(x, 5.82, z);
  B.add(S, fg);
  // inscribed plaque on the lower block, facing the promenade (north)
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x2 = c.getContext('2d')!;
  x2.fillStyle = '#d9c39a';
  x2.fillRect(0, 0, 512, 256);
  x2.fillStyle = '#5a3f22';
  x2.textAlign = 'center';
  x2.font = '800 54px Martel, serif';
  x2.fillText('बाण स्तंभ', 256, 78);
  x2.font = '600 26px Martel, serif';
  x2.fillText('आसमुद्रान्त दक्षिण ध्रुव', 256, 140);
  x2.fillText('पर्यन्त अबाधित ज्योतिर्मार्ग', 256, 180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  plaque.position.set(x + 0.58, 1.3, z);
  plaque.rotation.y = Math.PI / 2;
  g.add(plaque);
  P.solid(x - 0.9, 0, z - 0.9, x + 0.9, 6, z + 0.9);
}

// ---------- Samudra Darshan pergola ----------

/**
 * The red pergola of the sea walk (opened 2021) on top of the sea wall, both sides of the Baan Stambh: square
 * red posts in pairs, deep beams and a slatted roof; and the wall's outer face lettered "जय सोमनाथ" in
 * saffron, white and green, as seen from the beach.
 */
function seaPergola(g: THREE.Group, B: Batch, SB: Batch, S: THREE.Material, P: Physics, N: [number, number][]) {
  const red = new THREE.MeshStandardMaterial({ color: 0x9c3426, roughness: 0.75 });
  const H = 3.3, IN0 = 1.0, IN1 = 4.6;
  for (let i = 1; i < SEA_WALL.length - 2; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const nx = -N[i][0], nz = -N[i][1]; // inland
    const ry = -Math.atan2(dz, dx);
    // runs of pergola, broken round the Baan Stambh and kept to the temple's reach of the wall
    let run: number[] = [];
    const flush = () => {
      if (run.length < 2) { run = []; return; }
      const s0 = run[0], s1 = run[run.length - 1];
      for (const d of [IN0, IN1]) {
        const t0 = s0 / len, t1 = s1 / len;
        const cx = ax + dx * (t0 + t1) / 2 + nx * d, cz = az + dz * (t0 + t1) / 2 + nz * d;
        B.box(red, s1 - s0 + 0.5, 0.45, 0.32, cx, H - 0.45, cz, ry);
      }
      run = [];
    };
    for (let s = 3; s < len - 3; s += 3.6) {
      const t = s / len, x = ax + dx * t, z = az + dz * t;
      if (z < -20 || z > 125 || Math.hypot(x - BAAN.x, z - BAAN.z) < 8) { flush(); continue; }
      run.push(s);
      for (const d of [IN0, IN1]) {
        const px = x + nx * d, pz = z + nz * d;
        B.box(red, 0.34, H - 0.45, 0.34, px, 0, pz, ry);
        P.solid(px - 0.2, 0, pz - 0.2, px + 0.2, H, pz + 0.2);
      }
      // cross beam and the slats of the roof
      B.box(red, 0.24, 0.3, IN1 - IN0 + 0.6, x + nx * (IN0 + IN1) / 2, H - 0.3, z + nz * (IN0 + IN1) / 2, ry);
      for (let k = -1; k <= 1; k++) {
        const t2 = (s + k * 1.2) / len;
        B.box(red, 0.1, 0.16, IN1 - IN0 + 0.9, ax + dx * t2 + nx * (IN0 + IN1) / 2, H, az + dz * t2 + nz * (IN0 + IN1) / 2, ry);
      }
    }
    flush();
  }

  // the lettering on the wall's outer face
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x2 = c.getContext('2d')!;
  // the words fill the board whatever the font's width
  let px = 190;
  x2.font = `800 ${px}px Martel, "Noto Sans Devanagari", serif`;
  px = Math.floor(px * Math.min(1, 960 / x2.measureText('जय सोमनाथ').width));
  x2.font = `800 ${px}px Martel, "Noto Sans Devanagari", serif`;
  x2.textAlign = 'center';
  x2.textBaseline = 'middle';
  const gr = x2.createLinearGradient(0, 30, 0, 226);
  gr.addColorStop(0, '#e8731c'); gr.addColorStop(0.36, '#e8731c');
  gr.addColorStop(0.37, '#f6f3ea'); gr.addColorStop(0.63, '#f6f3ea');
  gr.addColorStop(0.64, '#2c8a3a'); gr.addColorStop(1, '#2c8a3a');
  x2.lineWidth = 10; x2.strokeStyle = '#7a1e12';
  x2.strokeText('जय सोमनाथ', 512, 136);
  x2.fillStyle = gr;
  x2.fillText('जय सोमनाथ', 512, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.7 });
  const geo = new THREE.PlaneGeometry(8, 2);
  for (const [i, t] of [[2, 0.75], [3, 0.3], [3, 0.7]] as const) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    // the segment's own seaward normal (N holds the mitred corner normals), so the board lies flat on the face
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    let n: [number, number] = [-dz / l, dx / l];
    if (n[0] * N[i][0] + n[1] * N[i][1] < 0) n = [-n[0], -n[1]];
    // the wall's outer face: its centre line is pushed out by 0.22 x the two corner normals, plus half its 0.9 m
    const face = 0.22 * (N[i][0] * n[0] + N[i][1] * n[1] + N[i + 1][0] * n[0] + N[i + 1][1] * n[1]) + 0.45 + 0.04;
    const x = ax + dx * t + n[0] * face, z = az + dz * t + n[1] * face;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, ROAD_Y + 1.75, z);
    m.rotation.y = Math.atan2(n[0], n[1]);
    g.add(m);
  }
  void SB; void S;
}

// ---------- lamp post ----------

function lampPost(B: Batch, S: THREE.Material, globe: THREE.Material, x: number, z: number) {
  B.lathe(S, [[0, 0], [0.22, 0], [0.22, 0.4], [0.16, 0.5], [0.13, 0.8], [0.09, 1.0], [0.075, 2.8], [0.11, 2.9], [0.07, 3.05], [0.065, 3.75], [0.1, 3.82], [0, 3.86]], x, 0, z, 10);
  for (const s of [-1, 1]) {
    const arm = new THREE.TorusGeometry(0.26, 0.025, 6, 12, Math.PI).translate(s * 0.26, 0, 0);
    arm.translate(x, 3.5, z);
    B.add(S, arm);
    const ball = new THREE.SphereGeometry(0.165, 12, 10).translate(x + s * 0.52, 3.68, z);
    B.add(globe, ball);
  }
  B.add(globe, new THREE.SphereGeometry(0.175, 12, 10).translate(x, 4.02, z));
}

/**
 * One of the four pillars round the Patel statue, as photographed: a red square plinth, a turned butter-yellow
 * shaft (a vase at the foot, lotus bulbs and rings, a slender fluted middle), a red square block for capital
 * under a yellow cap, and a small finial. ~4.2 m.
 */
const pillarYellow = new THREE.MeshStandardMaterial({ color: 0xe6b44a, roughness: 0.6 });
const pillarRed = new THREE.MeshStandardMaterial({ color: 0xa4321f, roughness: 0.65 });
function chowkPillar(B: Batch, x: number, z: number) {
  B.span(pillarRed, x - 0.3, x + 0.3, 0, 0.72, z - 0.3, z + 0.3);
  B.span(pillarYellow, x - 0.33, x + 0.33, 0.72, 0.8, z - 0.33, z + 0.33);
  B.lathe(pillarYellow, [[0, 0], [0.2, 0], [0.2, 0.06], [0.14, 0.1], [0.2, 0.22], [0.22, 0.34], [0.17, 0.48], [0.11, 0.56], [0.15, 0.6], [0.15, 0.66],
    [0.12, 0.7], [0.18, 0.82], [0.19, 0.92], [0.14, 1.02], [0.12, 1.06], [0.12, 1.12], [0.1, 1.16], [0.095, 2.2], [0.13, 2.24], [0.13, 2.3],
    [0.1, 2.34], [0.16, 2.46], [0.17, 2.56], [0.12, 2.66], [0.15, 2.72], [0.21, 2.82], [0.23, 2.9], [0, 2.9]], x, 0.8, z, 20);
  // flutes down the slender middle
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    B.add(pillarYellow, new THREE.CylinderGeometry(0.014, 0.014, 1.0, 4).translate(x + Math.cos(a) * 0.098, 0.8 + 1.68, z + Math.sin(a) * 0.098));
  }
  B.span(pillarRed, x - 0.26, x + 0.26, 3.7, 4.0, z - 0.26, z + 0.26);
  B.span(pillarYellow, x - 0.3, x + 0.3, 4.0, 4.07, z - 0.3, z + 0.3);
  B.lathe(pillarYellow, [[0, 0], [0.08, 0], [0.09, 0.06], [0.05, 0.12], [0.02, 0.2], [0, 0.22]], x, 4.07, z, 12);
}

// ---------- palm ----------

/**
 * Coconut palm: a slender ringed trunk that leans and curves back towards the vertical, a crown of ~22
 * drooping pinnate fronds of dark leaflets (the oldest hanging dry and brown) and a cluster of nuts.
 */
function palm(B: Batch, bark: THREE.Material, x: number, z: number, h: number, seed: number) {
  let s = Math.abs(Math.floor(seed * 9301)) % 233280 || 1;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const la = rnd() * Math.PI * 2, lk = 0.08 + rnd() * 0.1;
  // the trunk bows out and recovers: offset grows like sin, so the crown sits back over a curved stem
  const at = (t: number) => new THREE.Vector3(Math.cos(la) * lk * h * Math.sin(t * 2.2) * 0.9, t * h, Math.sin(la) * lk * h * Math.sin(t * 2.2) * 0.9);
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const p0 = at(t0), p1 = at(t1);
    const c = new THREE.CylinderGeometry(0.15 - t1 * 0.04, 0.2 - t0 * 0.05, p0.distanceTo(p1) + 0.02, 8);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()));
    c.translate(x + (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, z + (p0.z + p1.z) / 2);
    B.add(bark, c);
    // a ring scar every segment
    const ring = new THREE.TorusGeometry(0.17 - t1 * 0.04, 0.018, 4, 10).rotateX(Math.PI / 2).translate(x + p1.x, p1.y - 0.02, z + p1.z);
    B.add(bark, ring);
  }
  const tp = at(1);
  const top = new THREE.Vector3(x + tp.x, h, z + tp.z);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    B.add(bark, new THREE.SphereGeometry(0.13, 7, 5).translate(top.x + Math.cos(a) * 0.22, top.y - 0.25 - (k % 2) * 0.12, top.z + Math.sin(a) * 0.22));
  }
  const fronds = 22;
  for (let f = 0; f < fronds; f++) {
    const dead = f >= fronds - 3;
    const a = (f / fronds) * Math.PI * 2 * 2.618 + rnd() * 0.3;
    const len = dead ? 2.4 : 3.2 + rnd() * 1.4;
    const rise = dead ? -1.0 : f % 4 === 0 ? 0.9 : f % 4 === 1 ? 0.45 : 0.15;
    const n = 16;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // rib: a short rise, then arching over and hanging well down at the tip
      const yy = dead ? -t * 2.6 : Math.sin(t * Math.PI * 0.5) * (0.25 + rise * 0.6) - t * t * (2.3 + (1 - rise) * 0.9) + 0.12;
      pts.push(new THREE.Vector3(Math.cos(a) * t * len, yy, Math.sin(a) * t * len));
    }
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    // a textured leaflet card folded into a V along the rib: rib (u = 0.5) and two edges (u = 0, 1) per node,
    // the edges hanging below the rib so the leaflets droop
    const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    const tint = dead ? [0.95, 0.62, 0.32] : [1, 1, 1];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = pts[i];
      const w = (dead ? 0.45 : 0.85) * Math.sin(t * Math.PI * 0.92 + 0.12) + 0.05;
      for (const sg of [-1, 0, 1]) {
        const v = p.clone().addScaledVector(side, sg * w * 0.78);
        if (sg) v.y -= w * (dead ? 0.9 : 0.62);
        pos.push(v.x + top.x, v.y + top.y, v.z + top.z);
        uv.push((sg + 1) / 2, t);
        col.push(...tint);
      }
      if (i < n) {
        const b0 = i * 3, b1 = b0 + 3;
        idx.push(b0, b1, b0 + 1, b0 + 1, b1, b1 + 1, b0 + 1, b1 + 1, b0 + 2, b0 + 2, b1 + 1, b1 + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    frondParts.push(geo);
  }
}

/** every palm's frond cards, merged into one alpha-tested mesh by flushFronds() */
const frondParts: THREE.BufferGeometry[] = [];

/** Pinnate frond texture: a pale midrib down the centre and ~60 narrow leaflets each side, angled to the tip. */
function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 512);
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let y = 6; y < 506; y += 8) {
    for (const sg of [-1, 1]) {
      const l = 52 + r() * 10;
      const gr = 70 + r() * 50;
      g.strokeStyle = `rgb(${Math.round(gr * 0.55)},${Math.round(gr + 20)},${Math.round(gr * 0.35)})`;
      g.lineWidth = 4 + r() * 1.5;
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + sg * l * 0.5, y + 6, 64 + sg * l, y + 20 + r() * 6);
      g.stroke();
    }
  }
  g.strokeStyle = '#a8a060';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 512); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function flushFronds(parent: THREE.Object3D) {
  if (!frondParts.length) return;
  const tex = frondTexture();
  const geo = mergeGeometries(frondParts, false)!;
  frondParts.length = 0;
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, color: 0x9fb07a, roughness: 0.8 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  m.name = 'palm-fronds';
  parent.add(m);
}

/** A broadleaf shade tree (neem / banyan): a short forked trunk under a broad, lumpy, many-lobed crown. */
function broadleaf(B: Batch, bark: THREE.Material, leaf: THREE.Material, x: number, z: number, h: number, seed: number) {
  let s = Math.abs(Math.floor(seed * 7919)) % 233280 || 1;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const th = h * 0.42;
  B.add(bark, new THREE.CylinderGeometry(0.28, 0.42, th, 9).translate(x, th / 2, z));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rnd();
    const br = new THREE.CylinderGeometry(0.12, 0.22, h * 0.32, 7).translate(0, h * 0.16, 0).rotateZ(0.55).rotateY(a);
    B.add(bark, br.translate(x, th - 0.2, z));
  }
  const R = h * 0.48;
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, r = k === 0 ? 0 : R * (0.35 + rnd() * 0.45);
    const sz = R * (k === 0 ? 0.75 : 0.42 + rnd() * 0.22);
    const blob = lumpy(new THREE.SphereGeometry(1, 12, 9)).scale(sz, sz * 0.72, sz);
    blob.translate(x + Math.cos(a) * r, th + R * 0.55 + (rnd() - 0.3) * R * 0.35, z + Math.sin(a) * r);
    B.add(leaf, blob);
  }
}

/** Lawn grass with broad patches of lighter and darker green and a faint mottle, so the beds don't read as flat cards. */
function patchyLawn(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = worldPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGW;
        float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float pa = gn(vGW.xz * 0.11) * 0.6 + gn(vGW.xz * 0.37) * 0.3 + gn(vGW.xz * 1.9) * 0.1;
        diffuseColor.rgb *= mix(vec3(0.78, 0.82, 0.8), vec3(1.12, 1.08, 0.95), pa);`);
  };
  m.customProgramCacheKey = () => 'somnath-lawn';
  m.needsUpdate = true;
}

/** Monsoon-stained lime plaster: blotches, dark streaks running down from the parapet, grime at the foot. */
function weatherPlaster(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPW = worldPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPW;
        float ph(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float pn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(ph(i), ph(i + vec3(1,0,0)), f.x), mix(ph(i + vec3(0,1,0)), ph(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(ph(i + vec3(0,0,1)), ph(i + vec3(1,0,1)), f.x), mix(ph(i + vec3(0,1,1)), ph(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float blot = pn(vPW * 0.45) * 0.6 + pn(vPW * 2.1) * 0.4;
        float streak = smoothstep(0.55, 0.9, pn(vec3(vPW.x * 2.7 + vPW.z * 2.7, vPW.y * 0.15, vPW.z * 1.3)));
        diffuseColor.rgb *= (0.8 + 0.28 * blot) * (1.0 - 0.22 * streak) * (1.0 - 0.25 * (1.0 - smoothstep(0.0, 1.2, vPW.y)));`);
  };
  m.customProgramCacheKey = () => 'somnath-plaster';
  m.needsUpdate = true;
}

/** foliage: a speckle of light and dark leaves with a bumpy normal, so shrubs read as leaves not plastic */
function leafyMaterial(color = 0xffffff) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = worldPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLW;
        float lh(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float lf = lh(vLW * 14.0) * 0.6 + lh(vLW * 31.0) * 0.4;
        diffuseColor.rgb *= 0.45 + 0.9 * lf;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h = (lh(vLW * 14.0) + lh(vLW * 31.0)) * 0.012;
          vec2 dh = vec2(dFdx(h), dFdy(h));
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
        }`);
  };
  return m;
}

/** signboards: rows of painted lettering-like strokes (no readable words) on a coloured board */
/** painted mural panels for the wall behind the statue: bright figure scenes in broad strokes (none legible) */
function muralTexture() {
  const out: THREE.CanvasTexture[] = [];
  let s = 31;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pal = ['#2f6fb0', '#e0a43a', '#c8402c', '#3c8a5a', '#f2e6c8', '#7a4a9a', '#e86a3a', '#1f3f6a', '#f0c8a0'];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, pal[Math.floor(r() * pal.length)]); sky.addColorStop(1, pal[Math.floor(r() * pal.length)]);
    g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.beginPath(); g.ellipse(r() * 256, 40 + r() * 80, 12 + r() * 40, 10 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill();
    }
    // two or three figures
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 80 + r() * 20;
      g.fillStyle = '#e8b890'; g.beginPath(); g.arc(x, 44, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = pal[Math.floor(r() * pal.length)]; g.beginPath(); g.moveTo(x - 16, 120); g.lineTo(x - 8, 56); g.lineTo(x + 8, 56); g.lineTo(x + 18, 120); g.fill();
    }
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 122);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    out.push(t);
  }
  return out;
}

/** the LED screen beside the gate, showing the live darshan: a gold sanctum and a dark linga, softly blurred */
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 144;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 144);
  bg.addColorStop(0, '#6a4a1a'); bg.addColorStop(1, '#d8a440');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 144);
  g.fillStyle = '#f0c860'; g.fillRect(60, 20, 136, 110);
  g.fillStyle = '#ff9a20'; g.beginPath(); g.ellipse(128, 110, 60, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a1a2a'; g.beginPath(); g.ellipse(128, 86, 26, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; for (let y = 0; y < 144; y += 3) g.fillRect(0, y, 256, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(30,20,15,0.85)';
  g.lineWidth = 5;
  let s = 9;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.beginPath(); g.moveTo(14, 20); g.lineTo(242, 20); g.stroke(); // headline bar
  for (let x = 18; x < 236; x += 15 + r() * 8) {
    g.beginPath();
    g.moveTo(x, 20);
    g.bezierCurveTo(x + r() * 10, 30 + r() * 10, x - 4 + r() * 8, 42, x + 6, 48);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.0)';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** knobbly foliage blob */
function lumpy(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.82 + 0.3 * Math.abs(Math.sin(x * 9.1 + y * 5.3) * Math.cos(z * 7.7 - x * 3.1));
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** mown grass: fine noise with faint mowing stripes, tiled every 4 m */
function grassTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  let s = 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const stripe = (Math.floor(x / 64) % 2 ? 1.04 : 0.97) * (0.92 + 0.16 * Math.sin(x * 0.05 + y * 0.09) * Math.cos(y * 0.031 - x * 0.02));
    const k = (0.75 + r() * 0.4) * stripe;
    const i = (y * S + x) * 4;
    img.data[i] = 90 * k; img.data[i + 1] = 128 * k; img.data[i + 2] = 64 * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.25, 0.25);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- town ----------

function town(g: THREE.Group) {
  // Prabhas Patan: two- to four-storey lime-washed and pastel concrete houses with parapets, balconies with
  // sunshades, stair-heads and black water tanks on the roofs, and a shop-lined boulevard on the temple's axis.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x2 = c.getContext('2d')!;
  x2.fillStyle = '#f4efe6';
  x2.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) {
    const x = i * 64 + 14;
    x2.fillStyle = '#d8d0c2'; x2.fillRect(x - 4, 22, 44, 6); // sunshade
    x2.fillStyle = '#3f3b38'; x2.fillRect(x, 30, 36, 42); // window
    x2.fillStyle = '#7d8d96'; for (let k = 1; k < 6; k++) x2.fillRect(x + k * 6, 30, 1.5, 42); // grille
    x2.fillStyle = '#5f6a6e'; x2.fillRect(x + 17, 30, 2, 42);
  }
  x2.fillStyle = '#e2dace'; x2.fillRect(0, 120, 128, 8); // floor band
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(3, 3);
  const wall = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  weatherPlaster(wall);
  const roof = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.95 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xe6d6bc, roughness: 0.95 });
  weatherPlaster(plain);
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  type Spot = { x: number; z: number; w: number; d: number; h: number; face: number };
  const spots: Spot[] = [];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const boulevard = (x: number, z: number) => z > 118 && z < 420 && Math.abs(x - 2) < 19;
  const tryAdd = (x: number, z: number, face = rnd() < 0.5 ? 1 : 3) => {
    if (rnd() < 0.18) return;
    const floors = [1, 1, 2, 2, 2, 3, 3, 4, 5][Math.floor(rnd() * 9)];
    const w = 5 + rnd() * 10, d = 6 + rnd() * 10, h = 3.1 * floors + rnd() * 0.6;
    const px = x + (rnd() - 0.5) * 5, pz = z + (rnd() - 0.5) * 5;
    if (boulevard(px - w / 2, pz) || boulevard(px + w / 2, pz)) return;
    spots.push({ x: px, z: pz, w, d, h, face });
  };
  // (a street runs outside the precinct's north wall: the town starts beyond it)
  for (let x = 76; x < 380; x += 17) for (let z = -230; z < 440; z += 17) tryAdd(x, z);
  for (let x = -74; x < 56; x += 20) for (let z = 192; z < 440; z += 20) if (x > -60 - (z - 182) * 0.2) tryAdd(x, z);
  // shop rows facing the boulevard, both sides
  // the market outside the Dwar: shops lining both sides of the statue plaza
  for (let z = 124; z < 182; z += 10) for (const side of [-1, 1]) {
    const w = 8 + rnd() * 3;
    // (by the gate the plaza is walled: the queue and the compound wall on the south, the fence and murals on the north)
    if (side < 0 && z < 180) continue;
    if (side > 0 && z < 170) continue;
    spots.push({ x: DWAR.x + side * (19 + w / 2), z: z + 5, w, d: 9.4, h: 3.1 * (1 + Math.floor(rnd() * 2)) + 0.4, face: side < 0 ? 0 : 2 });
  }
  // low shop rows facing the boulevard, stepping back the further they are from the gate
  for (let z = 190; z < 420; ) {
    const d = 6 + rnd() * 5;
    for (const side of [-1, 1]) {
      const h = (z < 290 ? 3.4 : 3.1 * (1 + Math.floor(rnd() * 2))) + rnd() * 0.8;
      const w = 9 + rnd() * 3;
      spots.push({ x: DWAR.x + side * (19 + w / 2), z: z + d / 2, w, d: d - 0.4, h, face: side < 0 ? 0 : 2 });
    }
    z += d;
  }
  // limewash white, raw grey concrete, and the pinks, blues, yellows and greens of Saurashtra's towns
  const tints = [0xf4f1ea, 0xb9b3a8, 0xe9a59c, 0x9cbfe2, 0xf0cf6a, 0xb6d6a2, 0xf6f2ea, 0xe7c48e, 0xd99a7c, 0xc4b2da, 0xa8a49c, 0xf2b8c6, 0x8fc6c0, 0xeee3c8];
  const body = new THREE.InstancedMesh(unit, [wall, wall, roof, roof, wall, wall], spots.length);
  const parapet = new THREE.InstancedMesh(unit, plain, spots.length);
  const stair = new THREE.InstancedMesh(unit, plain, spots.length);
  const tanks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 8).translate(0, 0.6, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), spots.length);
  const balc: THREE.Matrix4[] = [], awn: [THREE.Matrix4, number][] = [], shop: THREE.Matrix4[] = [], sign: [THREE.Matrix4, number][] = [];
  const signs = [0xb8322a, 0x1f5f9e, 0xe2b03a, 0x2e7d4a, 0xf2efe6, 0x7a2b6e];
  const col = new THREE.Color();
  const q = new THREE.Quaternion();
  const awnings = [0xa8463a, 0x4a6d8c, 0xc99a48, 0x5a7f55, 0xb86a3e, 0xd8c8a8];
  spots.forEach(({ x, z, w, d, h, face }, i) => {
    // street-facing rows stay square to the street; the rest of the town is a little askew
    const yaw = face === 0 || face === 2 ? 0 : (rnd() - 0.5) * 0.1;
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    body.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), qy, new THREE.Vector3(w, h, d)));
    body.setColorAt(i, col.set(tints[Math.floor(rnd() * tints.length)]));
    parapet.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w + 0.2, 0.75, d + 0.2)));
    parapet.setColorAt(i, col.set(tints[Math.floor(rnd() * tints.length)]).multiplyScalar(0.92));
    stair.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x - w * 0.25, h, z + d * 0.2), q, h > 7 ? new THREE.Vector3(2.6, 2.5, 2.8) : new THREE.Vector3(0.01, 0.01, 0.01)));
    // water tanks on about half the roofs: black plastic, a few white or blue
    tanks.setMatrixAt(i, rnd() < 0.5 ? new THREE.Matrix4().makeTranslation(x + w * 0.25, h, z - d * 0.2) : new THREE.Matrix4().makeScale(0, 0, 0));
    const tr = rnd();
    tanks.setColorAt(i, col.set(tr < 0.7 ? 0x262626 : tr < 0.85 ? 0xe8e8e4 : 0x3a6fb0));
    // balconies on the street face, one per upper storey
    const fx = face === 0 ? 1 : face === 2 ? -1 : 0, fz = face === 1 ? 1 : face === 3 ? -1 : 0;
    const half = fx ? w / 2 : d / 2;
    for (let y = 3.2; y < h - 1; y += 3.2) {
      if (rnd() < 0.35) continue;
      const bw = 2.5 + rnd() * 3;
      const off = (rnd() - 0.5) * ((fx ? d : w) - bw - 1);
      const cx = x + fx * (half + 0.6) + (fz ? off : 0), cz = z + fz * (half + 0.6) + (fx ? off : 0);
      balc.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, y, cz), q, new THREE.Vector3(fx ? 1.2 : bw, 1.0, fz ? 1.2 : bw)));
    }
    // shopfront awnings along the boulevard, with a dark open shop and a painted signboard above it
    if (face === 0 || face === 2) {
      const fxs = face === 0 ? 1 : -1;
      shop.push(new THREE.Matrix4().compose(new THREE.Vector3(x + fxs * (w / 2 + 0.02), 0, z), q, new THREE.Vector3(0.06, 2.2, d - 2.2)));
      sign.push([new THREE.Matrix4().compose(new THREE.Vector3(x + fxs * (w / 2 + 0.06), 2.95, z), q, new THREE.Vector3(0.08, 0.75, d - 1.6)),
        signs[Math.floor(rnd() * signs.length)]]);
      const cx = x + fx * (w / 2 + 0.9);
      awn.push([new THREE.Matrix4().compose(new THREE.Vector3(cx, 2.7, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fx * 0.25),
        new THREE.Vector3(1.9, 0.08, d - 0.6)), awnings[Math.floor(rnd() * awnings.length)]]);
    }
  });
  const balcony = new THREE.InstancedMesh(unit, plain, balc.length);
  balc.forEach((m, i) => balcony.setMatrixAt(i, m));
  const awning = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), awn.length);
  awn.forEach(([m, c2], i) => { awning.setMatrixAt(i, m); awning.setColorAt(i, col.set(c2)); });
  const shops = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }), shop.length);
  shop.forEach((m, i) => shops.setMatrixAt(i, m));
  const boards = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }), sign.length);
  sign.forEach(([m, c2], i) => { boards.setMatrixAt(i, m); boards.setColorAt(i, col.set(c2)); });
  // trees in the gaps between houses
  const treeSpots: [number, number, number][] = [];
  for (let i = 0; i < 300; i++) {
    const x = 70 + rnd() * 300, z = -220 + rnd() * 640;
    if (!spots.some((p) => Math.abs(p.x - x) < p.w / 2 + 2 && Math.abs(p.z - z) < p.d / 2 + 2)) treeSpots.push([x, z, 5 + rnd() * 5]);
  }
  const canopy = new THREE.InstancedMesh(lumpy(new THREE.SphereGeometry(1, 10, 8)), leafyMaterial(0x4a7a32), treeSpots.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 }), treeSpots.length);
  treeSpots.forEach(([x, z, h], i) => {
    trunk.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h * 0.5, 1)));
    canopy.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.62, z), q, new THREE.Vector3(h * 0.38, h * 0.3, h * 0.38)));
  });
  // beyond the modelled streets the town goes on: a ring of low-rise blocks and tree clumps fading into the haze
  const far: [number, number, number, number, number][] = [];
  for (let i = 0; i < 2600; i++) {
    const x = -160 + rnd() * 960, z = -400 + rnd() * 1200;
    const inner = x < 390 && z < 450 && x > -100;
    const seaSide = z < -0.86 * (x - 48) - 102 + 60; // south-west of the shoreline: the sea
    if (inner || seaSide) continue;
    far.push([x, z, 6 + rnd() * 14, 6 + rnd() * 14, 3 + rnd() * 12]);
  }
  const farBody = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), far.length);
  far.forEach(([x, z, w, d, h], i) => {
    farBody.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.3), new THREE.Vector3(w, h, d)));
    farBody.setColorAt(i, col.set(tints[Math.floor(rnd() * tints.length)]).multiplyScalar(0.92));
  });
  const farTrees: [number, number, number][] = [];
  for (let i = 0; i < 700; i++) {
    const x = -160 + rnd() * 960, z = -400 + rnd() * 1200;
    if ((x < 390 && z < 450 && x > -100) || z < -0.86 * (x - 48) - 102 + 60) continue;
    farTrees.push([x, z, 7 + rnd() * 7]);
  }
  const farCanopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafyMaterial(0x46703a), farTrees.length);
  farTrees.forEach(([x, z, h], i) => farCanopy.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.55, z), q, new THREE.Vector3(h * 0.6, h * 0.45, h * 0.6))));
  for (const m of [farBody, farCanopy]) { m.receiveShadow = true; g.add(m); }
  for (const m of [body, parapet, stair, tanks, balcony, awning, shops, boards, canopy, trunk]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
}

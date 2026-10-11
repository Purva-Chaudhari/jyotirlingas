import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { columnGeometry, Physics, type Flames } from '../../engine/kit';
import { waterNormals } from '../../engine/materials';
import type { KM } from './mats';
import { Merger, cylUV } from './merge';
import { tent } from './tent';
import { ghatSteps, ghatBoats, farBank, riverfrontTown, GHAT } from './riverfront';
import { PARISAR, eastGate, toranGate, GATE_W_PUBLIC, cellShrine, blindArch } from './parisar';
import { Offerings } from './shivling';
import { archWallGeo, archPlateGeo, chhatriGeo, nagaraSpire, SHRINE_CLUSTER, RIVER_CLUSTER, kalashGeo, onionDome, lathe, tieredRoofGeo } from './spire';

/**
 * Kashi Vishwanath Dham (2021) east of the Parisar: the Mandir Chowk between two-storey Chunar
 * buildings, the Ganga-view terraces, the stair down to the Ganga Dwar and Lalita Ghat, the river,
 * and the old city packed round it all.
 *
 * Levels: chowk y = 0 (z 30–100) · upper terraces y = 0 to z 118 · middle terraces y = −5 (z 118–136) ·
 * Ganga Dwar plaza y = −10 (z 136–152) · ghat steps to the water at y = −15.3 (z ≈ 166).
 */

export const CHOWK = { x0: -40, x1: 40, z0: PARISAR.z1, z1: 100 };
export const DESCENT = { x0: -5.5, x1: 5.5, z0: 100, z1: 140, y1: -10 };
export const PLAZA = { z0: 136, z1: 152, y: -10 };
export const WATER_Y = -15.3;
const T2 = { z0: 118, z1: 136, y: -5 };

/** Trees of the chowk, standing in round stone planters (world.ts loads the meshes). */
// (in the north-west of the court, > 28 m from the spawn so it draws as the light LOD from there)
export const DHAM_TREES: [number, number, number][] = [
  [21, -17, 9.5],
];

function rectShape(x0: number, x1: number, z0: number, z1: number, holes: [number, number, number, number][] = []) {
  // shapes live in XY, then rotateX(-90°) maps y → −z
  const s = new THREE.Shape();
  s.moveTo(x0, -z1); s.lineTo(x1, -z1); s.lineTo(x1, -z0); s.lineTo(x0, -z0); s.lineTo(x0, -z1);
  for (const [a0, a1, b0, b1] of holes) {
    const h = new THREE.Path();
    h.moveTo(a0, -b1); h.lineTo(a0, -b0); h.lineTo(a1, -b0); h.lineTo(a1, -b1); h.lineTo(a0, -b1);
    s.holes.push(h);
  }
  return s;
}

/** a polygon outline [x, z][] (any winding) with rectangular holes, as rectShape */
function polyShape(pts: [number, number][], holes: [number, number, number, number][] = []) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of rectShape(0, 0, 0, 0, holes).holes) s.holes.push(h);
  return s;
}

function ground(g: THREE.Group, P: Physics, mat: THREE.Material, y: number, shape: THREE.Shape) {
  const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv as THREE.BufferAttribute, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.receiveShadow = true;
  g.add(m);
  P.floors.push(m);
  return m;
}

export function buildDham(root: THREE.Group, K: KM, P: Physics, flames: Flames, sunDir: THREE.Vector3, O: Offerings) {
  const g = new THREE.Group();
  g.name = 'dham';
  root.add(g);
  const B = new Merger(P, 'dham');
  const { x0: px0, x1: px1, z0: pz0, z1: pz1 } = PARISAR;

  // ---------- ground at the three levels ----------
  // (the stair's cut is notched out of each level's outline: a hole that runs past an outline's edge is not cut
  //  by the triangulation, which left the upper terraces and the plaza paved over the stair)
  const { x0: cx0, x1: cx1 } = DESCENT;
  ground(g, P, K.kota, 0, polyShape([[-420, -420], [420, -420], [420, T2.z0], [cx1, T2.z0], [cx1, DESCENT.z0], [cx0, DESCENT.z0], [cx0, T2.z0], [-420, T2.z0]], [
    [px0, px1, pz0, pz1],
  ]));
  ground(g, P, K.kota, T2.y, rectShape(-420, cx0, T2.z0, T2.z1));
  ground(g, P, K.kota, T2.y, rectShape(cx1, 420, T2.z0, T2.z1));
  ground(g, P, K.kota, PLAZA.y, polyShape([[-420, T2.z1], [cx0, T2.z1], [cx0, DESCENT.z1], [cx1, DESCENT.z1], [cx1, T2.z1], [420, T2.z1], [420, PLAZA.z1], [-420, PLAZA.z1]]));

  // ---------- the stair down the axis: chowk (y 0) → plaza (y −10) ----------
  const { x0: dx0, x1: dx1, z0: dz0, z1: dz1, y1: dy1 } = DESCENT;
  const flights: [number, number, number, number][] = [ // z0, z1, y0, y1
    [dz0, 112, 0, -3.0], [112, 116, -3.0, -3.0], [116, 130, -3.0, -6.6], [130, 133, -6.6, -6.6], [133, dz1, -6.6, dy1],
  ];
  for (const [za, zb, ya, yb] of flights) {
    P.floor(g, dx0, dx1, za, zb, ya, yb);
    if (ya === yb) {
      B.span(K.kota, dx0, dy1 - 0.2, za, dx1, ya, zb);
    } else {
      const n = Math.round((ya - yb) / 0.16);
      const tread = (zb - za) / n;
      for (let i = 0; i < n; i++) {
        const y = ya - (i + 1) * ((ya - yb) / n);
        B.span(K.kota, dx0, dy1 - 0.2, za + i * tread, dx1, y + (ya - yb) / n, za + (i + 1) * tread + 0.02);
      }
    }
  }
  // side walls of the cut, stepping down with the terraces; parapets on top
  for (const s of [-1, 1]) {
    const xw = s > 0 ? dx1 : dx0;
    const xa = s > 0 ? xw : xw - 0.6, xb = s > 0 ? xw + 0.6 : xw;
    B.span(K.ashlar, xa, -10, dz0, xb, 0, T2.z0, true);
    B.span(K.ashlar, xa, -10, T2.z0, xb, T2.y, T2.z1, true);
    // parapets on the terrace side
    B.span(K.chunar, xa, 0, dz0, xb, 1.0, T2.z0, true);
    B.span(K.chunar, xa, T2.y, T2.z0, xb, T2.y + 1.0, T2.z1, true);
    B.span(K.chunar, xa - 0.08, 1.0, dz0, xb + 0.08, 1.12, T2.z0);
    B.span(K.chunar, xa - 0.08, T2.y + 1.0, T2.z0, xb + 0.08, T2.y + 1.12, T2.z1);
  }
  // retaining walls at the terrace drops, with parapets
  for (const [z, ytop, ybot] of [[T2.z0, 0, T2.y], [T2.z1, T2.y, PLAZA.y]] as const) {
    for (const [xa, xb] of [[-420, dx0 - 0.6], [dx1 + 0.6, 420]]) {
      B.span(K.ashlar, xa, ybot, z - 0.6, xb, ytop, z, true);
      B.span(K.chunar, xa, ytop, z - 0.6, xb, ytop + 1.0, z, true);
      B.span(K.chunar, xa, ytop + 1.0, z - 0.7, xb, ytop + 1.12, z + 0.1);
      // blind arcade on the retaining wall's river face
      // deep carved bays near the stair, flat lit niches further out along the bank
      for (let x = xa + 2; x < xb - 2; x += 4) {
        if (Math.abs(x + 1) < 48) blindArch(B, K.chunarWall, K.recess, x + 1, ybot + 0.4, z, 0, 2.2, 1.8, 1.1, 3.4, 3.9, 0.4);
        else B.place(K.recess, archPlateGeo(2.2, 1.8, 1.1, 7), x + 1, ybot + 0.4, z + 0.01);
      }
    }
  }

  // ---------- chowk side buildings (north and south) ----------
  arcadeBlock(B, K, 'z', CHOWK.x1, CHOWK.z0 + 4, CHOWK.z1, -1, 12, 11.5);
  arcadeBlock(B, K, 'z', CHOWK.x0, CHOWK.z0 + 4, CHOWK.z1, 1, 12, 11.5);
  // Ganga-view galleries framing the stair (3 storeys), terraces open between them and the stair
  arcadeBlock(B, K, 'x', CHOWK.z1, 15, CHOWK.x1, -1, 16, 14.5, true);
  arcadeBlock(B, K, 'x', CHOWK.z1, CHOWK.x0, -15, -1, 16, 14.5, true);
  // the chowk's eastern gateway into the terraces
  eastGate(B, K, P, 0, CHOWK.z1 - 1.2);

  // small white shikhara shrines on the upper terraces (as in the photographs)
  for (const x of [-10.5, 10.5]) {
    B.span(K.marble, x - 1.6, 0, 108 - 1.6, x + 1.6, 0.5, 108 + 1.6, true);
    P.floor(g, x - 1.6, x + 1.6, 108 - 1.6, 108 + 1.6, 0.5);
    cellShrine(B, K, O, P, flames, x, 108, 0.5, 1.2, 2.3, 'z', K.marble, 0.09);
    const s = nagaraSpire(1.15, 3.8, SHRINE_CLUSTER, 4);
    B.place(K.marble, s.body, x, 2.8, 108);
    B.place(K.marble, s.finials, x, 2.8, 108);
    B.place(K.gilt, kalashGeo(0.4), x, 2.8 + s.topY, 108);
  }
  // terrace parapet along the river edge of the upper and middle terraces: rows of white finials
  const finial = lathe([[0, 0], [0.12, 0], [0.12, 0.08], [0.08, 0.12], [0.1, 0.25], [0.05, 0.4], [0, 0.5]], 8);
  for (const [z, y] of [[T2.z0 - 0.3, 1.12], [T2.z1 - 0.3, T2.y + 1.12]] as const) {
    for (let x = -120; x <= 120; x += 1.6) {
      if (Math.abs(x) < dx1 + 1) continue;
      B.place(K.marble, finial, x, y, z);
    }
  }

  // everything on the river front lives in its own group, culled unless the camera is near the river
  const river = new THREE.Group();
  river.name = 'river';
  g.add(river);
  const BR = new Merger(P, 'riverfront-near');

  // ---------- Ganga Dwar: the river gateway atop the ghat steps ----------
  gangaDwar(BR, K, P, 0, 146);

  // ---------- ghat steps from the plaza down into the Ganga, along the whole (curving) bank ----------
  // the ghat's own flowers and petals live with the river front (not drawn from the temple court)
  const OR = new Offerings(29);
  ghatSteps(BR, K, P, g, flames, OR);
  OR.flush(river);
  // plaza edge diyas and a few chhatris on the ghat
  for (let x = -40; x <= 40; x += 2) flames.points.push(new THREE.Vector3(x, PLAZA.y + 0.05, PLAZA.z1 - 0.3));
  for (const x of [-34, 34, -70, 70, -110, 110]) BR.place(K.chunar, chhatriGeo(1.6, 2.4), x, PLAZA.y, 144);

  // ---------- the Ganga ----------
  const water = new Water(new THREE.PlaneGeometry(1600, 900), {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: sunDir.clone(),
    sunColor: 0xb8a888, waterColor: 0x4f5236, distortionScale: 1.6, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, 160 + 450);
  (water.material as THREE.ShaderMaterial).uniforms.size.value = 2.5;
  // the Ganga is silty and olive-brown: damp the mirror so the river's own colour carries
  {
    const wm = water.material as THREE.ShaderMaterial;
    // and calmer, more mirror-like with distance (ripples flatten, the reflection takes over)
    wm.fragmentShader = wm.fragmentShader
      .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
        `float kvFar = smoothstep( 30.0, 320.0, length( eye - worldPosition.xyz ) );
         vec3 surfaceNormal = normalize( noise.xzy * vec3( mix( 1.5, 0.3, kvFar ), 1.0, mix( 1.5, 0.3, kvFar ) ) );`)
      .replace('reflectionSample + specularLight, reflectance );',
        'reflectionSample * mix( 0.5, 0.92, kvFar ) + specularLight * 0.4 + vec3( 0.06, 0.055, 0.035 ) * ( 1.0 - kvFar ), min( 1.0, reflectance * mix( 0.75, 1.5, kvFar ) ) );');
    wm.needsUpdate = true;
  }
  river.add(water);
  // the sandy far bank of the Ganga with its tree line, and the boats moored all along the ghats
  farBank(river);
  ghatBoats(river);

  // ---------- city: riverfront mansions and the old city around the Dham ----------
  buildCity(g, river, K, BR);

  // ---------- white pagoda tents and a queue shed in the chowk (as in the photographs) ----------
  for (const [x, z, s] of [[-26, 40, 1.2], [27, 42, 1.0], [-27, 90, 1.0]] as const) tent(B, K, P, x, 0, z, s);

  // ---------- chowk furniture: tree planters, lamp posts, benches ----------
  const planter = lathe([[0, 0], [2.3, 0], [2.3, 0.55], [2.0, 0.6], [0, 0.6]], 32);
  for (const [x, z] of DHAM_TREES) {
    if (z < PARISAR.z1 && x > PARISAR.x0 && x < PARISAR.x1) continue; // trees inside the court stand free
    B.place(K.chunar, planter, x, 0, z);
    P.solid(x - 1.8, 0, z - 1.8, x + 1.8, 0.6, z + 1.8);
  }
  const lampPost = lathe([[0, 0], [0.22, 0], [0.2, 0.5], [0.08, 0.6], [0.06, 7.2], [0.18, 7.3], [0.22, 7.6], [0.08, 7.75], [0, 7.8]], 10);
  for (const z of [44, 62, 80, 96]) {
    for (const x of [-12, 12]) {
      B.place(K.bronze, lampPost, x, 0, z);
      P.solid(x - 0.2, 0, z - 0.2, x + 0.2, 7, z + 0.2);
    }
  }
  for (const [x, z] of [[-16, 56], [16, 56], [-16, 72], [16, 72]]) {
    B.span(K.chunar, x - 1.6, 0, z - 0.35, x + 1.6, 0.45, z + 0.35, true);
  }

  // no sun shadows from the Dham and river blocks: they never fall on the temple court
  B.flush(g, false);
  BR.flush(river, false);
  return { group: g, water, river };
}

/**
 * Two- or three-storey Chunar building facing a court: arcaded ground floor (cusped arches),
 * upper storeys with arched windows and jharokhas, cornices, parapet and chhatris.
 * `axis` = direction the facade runs; `fixed` = facade line; n = outward normal of the facade (into the court).
 */
function arcadeBlock(B: Merger, K: KM, axis: 'x' | 'z', fixed: number, from: number, to: number, n: number, depth: number, H: number, threeStorey = false) {
  const P3 = (along: number, across: number): [number, number] => (axis === 'x' ? [along, across] : [across, along]);
  const span = (mat: THREE.Material, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, solid = false) => {
    const [xa, za] = P3(a0, c0), [xb, zb] = P3(a1, c1);
    B.span(mat, Math.min(xa, xb), y0, Math.min(za, zb), Math.max(xa, xb), y1, Math.max(za, zb), solid);
  };
  const ry = axis === 'x' ? (n > 0 ? 0 : Math.PI) : (n > 0 ? Math.PI / 2 : -Math.PI / 2);
  const back = fixed - n * depth;
  const g1 = 5.2; // ground-floor arcade height
  // core block behind the arcade (verandah 3 m deep)
  span(K.ashlar, from, to, 0, H, back, fixed - n * 3.0, true);
  // arcade
  const bays = Math.max(2, Math.round((to - from) / 3.6));
  const b = (to - from) / bays;
  const col = cylUV(columnGeometry(g1, 0.24), 0.26);
  for (let i = 0; i <= bays; i++) {
    const [x, z] = P3(from + i * b, fixed - n * 0.2);
    B.place(K.chunarCol, col, x, 0, z, 0, 1, true);
    B.P.solid(x - 0.3, 0, z - 0.3, x + 0.3, g1, z + 0.3);
  }
  for (let i = 0; i < bays; i++) {
    const [x, z] = P3(from + (i + 0.5) * b, fixed - n * 0.2);
    B.place(K.chunar, archWallGeo(b - 0.44, g1, 0.36, b - 0.64, g1 * 0.5, g1 * 0.36, 9), x, 0, z, ry);
    const [dx, dz] = P3(from + (i + 0.5) * b, fixed - n * 3.0 + n * 0.01);
    if (i % 2 === 0) B.place(K.glass, archPlateGeo(1.6, 1.8, 0.8, 5), dx, 0, dz, ry);
    else B.place(K.door, archPlateGeo(1.4, 1.9, 0.7, 5), dx, 0, dz, ry);
  }
  // floor slab over the verandah, string course
  span(K.chunar, from, to, g1, g1 + 0.6, fixed - n * 3.0, fixed + n * 0.15);
  span(K.chunar, from - 0.2, to + 0.2, g1 + 0.6, g1 + 0.75, fixed - n * 3.0, fixed + n * 0.5);
  // upper storeys: wall flush with the arcade line
  const top = H - 1.2;
  span(K.ashlar, from, to, g1 + 0.75, top, fixed - n * 3.0, fixed);
  const storeyH = threeStorey ? (top - g1 - 0.75) / 2 : top - g1 - 0.75;
  for (let s = 0; s < (threeStorey ? 2 : 1); s++) {
    const y0 = g1 + 0.75 + s * storeyH;
    for (let i = 0; i < bays; i++) {
      const a = from + (i + 0.5) * b;
      const [x, z] = P3(a, fixed + n * 0.01);
      if ((i + s) % 3 === 1) {
        // jharokha: projecting balcony with a small dome
        const [jx, jz] = P3(a, fixed + n * 0.55);
        B.box(K.chunar, 1.9, 0.3, 1.1, jx, y0 + 0.5, jz, false, ry);
        for (const u of [-0.75, 0.75]) {
          const [cx, cz] = P3(a + u, fixed + n * 0.95);
          B.box(K.chunar, 0.14, 1.6, 0.14, cx, y0 + 0.8, cz);
        }
        B.box(K.recess, 1.4, 1.5, 0.05, x, y0 + 0.8, z, false, ry);
        B.box(K.chunar, 2.1, 0.22, 1.3, jx, y0 + 2.4, jz, false, ry);
        B.place(K.chunar, JHAROKHA_DOME, jx, y0 + 2.62, jz);
      } else {
        blindArch(B, K.chunarWall, K.recess, x, y0 + 0.7, z, ry, 1.2, 1.3, 0.7, 1.8, 2.4, 0.4);
      }
    }
    if (s === 1 || !threeStorey) continue;
    span(K.chunar, from - 0.1, to + 0.1, y0 + storeyH - 0.2, y0 + storeyH, fixed - n * 3.0, fixed + n * 0.3);
  }
  // cornice, parapet, chhatris
  span(K.chunar, from - 0.4, to + 0.4, top, top + 0.35, back, fixed + n * 0.7);
  span(K.chunar, from - 0.2, to + 0.2, top + 0.35, H, fixed - n * 0.1, fixed + n * 0.3);
  span(K.chunar, from, to, top, top + 0.35, back, fixed - n * 3.0);
  const nCh = Math.max(2, Math.round((to - from) / 14));
  for (let i = 0; i <= nCh; i++) {
    const [x, z] = P3(from + 1.5 + (i * (to - from - 3)) / nCh, fixed - n * 1.6);
    B.place(K.chunar, chhatriGeo(1.15, 1.8), x, H, z);
  }
  // a band of pinnacles on the parapet
  const pin = lathe([[0, 0], [0.16, 0], [0.16, 0.1], [0.1, 0.14], [0.14, 0.28], [0.08, 0.42], [0, 0.6]], 8);
  for (let a = from + 0.6; a < to; a += 1.8) {
    const [x, z] = P3(a, fixed + n * 0.1);
    B.place(K.chunar, pin, x, H, z);
  }
}

const JHAROKHA_DOME = onionDome(0.75, 12, 16);

/** The riverside gateway at Lalita Ghat, atop the ghat steps, in the Dham's toran style, with side wings. */
function gangaDwar(B: Merger, K: KM, P: Physics, cx: number, cz: number) {
  const y = PLAZA.y, sc = 1.3, D = 7.2;
  B.offset.set(0, y, 0);
  toranGate(B, K, P, cx, cz, 0, sc);
  const inner = GATE_W_PUBLIC * sc / 2 + 3.6 * sc;
  const crown = tieredRoofGeo(1.5, 4, 0.45);
  for (const s of [-1, 1]) {
    const a0 = cx + s * inner, a1 = cx + s * (inner + 7.5);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), am = (lo + hi) / 2;
    // Chunar wings with carved bands, deep pilasters, jali jharokhas and recessed niches
    B.span(K.chunarWall, lo, 0, cz - D / 2 + 0.6, hi, 9.4, cz + D / 2 - 0.6, true);
    for (const z of [cz + D / 2 - 0.6, cz - D / 2 + 0.6]) {
      const o = z > cz ? 1 : -1, ry = o > 0 ? 0 : Math.PI;
      for (const u of [-2, 2]) {
        // jharokha: recessed lit back, jali screen, sill on brackets, canopy, colonnettes
        B.box(K.recess, 1.2, 1.8, 0.05, am + u, 3.2, z + o * 0.02, false, ry);
        B.box(K.jali, 1.2, 1.8, 0.02, am + u, 3.2, z + o * 0.3, false, ry);
        B.box(K.chunar, 1.8, 0.25, 0.7, am + u, 2.95, z + o * 0.3, false, ry);
        for (const v of [-0.6, 0.6]) B.box(K.chunar, 0.16, 0.4, 0.5, am + u + v, 2.55, z + o * 0.25, false, ry);
        for (const v of [-0.72, 0.72]) B.box(K.chunar, 0.13, 1.85, 0.13, am + u + v, 3.2, z + o * 0.55);
        B.box(K.chunar, 1.9, 0.2, 0.8, am + u, 5.1, z + o * 0.35, false, ry);
        blindArch(B, K.chunarWall, K.recess, am + u, 6.3, z, ry, 0.9, 0.6, 0.5, 1.4, 1.4, 0.4);
      }
      // deep pilasters between the bays and at the corners
      for (const u of [-3.55, 0, 3.55]) B.box(K.chunarWall, 0.45, 8.6, 0.3, am + u, 0.8, z + o * 0.15, false, ry);
      for (const yy of [1.0, 2.7, 5.9, 8.0]) B.span(K.chunar, lo, yy, Math.min(z, z + o * 0.32), hi, yy + 0.18, Math.max(z, z + o * 0.32));
    }
    B.span(K.chunar, lo - 0.2, 9.4, cz - D / 2 - 0.2, hi + 0.2, 9.75, cz + D / 2 + 0.2);
    for (const u of [-2.6, 2.6]) {
      // carved stone crowns (phamsana) with small gilt kalashes, as on the real gate
      B.place(K.chunarCarved, crown.geo, am + u, 9.75, cz, 0, [1, 1, 1.5]);
      B.place(K.gilt, kalashGeo(0.5), am + u, 9.75 + crown.top, cz);
    }
  }
  B.offset.set(0, 0, 0);
}

/** Dense old Varanasi: tall riverfront mansions on the bank and flat-roofed houses round the Dham. */
function buildCity(g: THREE.Group, river: THREE.Group, K: KM, BR: Merger) {
  let parts: THREE.BufferGeometry[] = [];
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // lime-wash and painted-concrete colours of old Varanasi: creams, ochres, salmon, pastel blue/green/pink
  const tints = [0xe8c9a0, 0xf0dcc0, 0xd99a72, 0xe9b98a, 0xf2e9d8, 0xc9a07a, 0xe0a890, 0xf3d79a, 0xd6c3a5, 0xb88a6a,
    0xd8c8b0, 0xcbb69a, 0xe2d4bc, 0xbfa58a, 0xb4c3c4, 0xc8d0b8, 0xe3bcb4, 0xf0e2a0];
  const col = new THREE.Color();
  let variant = 0; // facade atlas tile of the current house
  const box = (x: number, z: number, w: number, d: number, y0: number, h: number, color: THREE.Color, shade = true) => {
    const b = new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z).toNonIndexed();
    b.deleteAttribute('uv');
    const n = b.attributes.position.count, c = new Float32Array(n * 3), pos = b.attributes.position;
    for (let i = 0; i < n; i++) {
      const k = shade ? 0.78 + 0.22 * Math.min(1, (pos.getY(i) - y0) / 4) : 1;
      c[i * 3] = color.r * k; c[i * 3 + 1] = color.g * k; c[i * 3 + 2] = color.b * k;
    }
    b.setAttribute('color', new THREE.BufferAttribute(c, 3));
    b.setAttribute('vv', new THREE.BufferAttribute(new Float32Array(n).fill(variant), 1));
    parts.push(b);
  };
  const stone = new THREE.Color(0xb59a7c), cream = new THREE.Color(0xf2e6d2);
  const cyl = (x: number, z: number, r: number, h: number, y0: number, color: THREE.Color) => {
    const b = new THREE.CylinderGeometry(r, r, h, 8).translate(x, y0 + h / 2, z).toNonIndexed();
    b.deleteAttribute('uv');
    const n = b.attributes.position.count, cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cc[i * 3] = color.r; cc[i * 3 + 1] = color.g; cc[i * 3 + 2] = color.b; }
    b.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    b.setAttribute('vv', new THREE.BufferAttribute(new Float32Array(n), 1));
    parts.push(b);
  };
  /** A house: body in a lime-wash colour; riverfront ones get a tall stone basement, cornices, balconies. */
  const house = (x: number, z: number, w: number, d: number, y0: number, h: number, river = false) => {
    col.set(tints[Math.floor(rnd() * tints.length)]).multiplyScalar(0.8 + rnd() * 0.25);
    const c = col.clone();
    variant = Math.floor(rnd() * 4);
    if (!river) {
      // a setback top storey on some taller houses, so the skyline steps
      const setback = h >= 12.8 && rnd() < 0.45;
      const hb = setback ? h - 3.2 : h;
      box(x, z, w, d, y0, hb, c);
      // stone chhajja ledge over the ground floor on most houses
      if (rnd() < 0.35) box(x, z, w + 0.5, d + 0.5, y0 + 3.0, 0.14, cream.clone().multiplyScalar(0.85), false);
      let top = y0 + hb, tw = w, td = d, tx0 = x, tz0 = z;
      if (setback) {
        tw = w * (0.5 + rnd() * 0.2); td = d * (0.5 + rnd() * 0.2);
        tx0 = x + (rnd() - 0.5) * (w - tw); tz0 = z + (rnd() - 0.5) * (d - td);
        box(x, z, w + 0.1, d + 0.1, top, 0.8, c.clone().multiplyScalar(0.92), false);
        box(tx0, tz0, tw, td, top, 3.2, c.clone().multiplyScalar(0.97));
        top += 3.2;
      }
      // roof clutter: parapet, an occasional water tank (black, white or blue), stair hut, awnings, washing
      box(tx0, tz0, tw + 0.1, td + 0.1, top, 0.8, c.clone().multiplyScalar(0.92), false);
      box(tx0, tz0, tw - 0.5, td - 0.5, top, 0.82, c.clone().multiplyScalar(0.8), false);
      if (rnd() < 0.3) {
        const tx = tx0 + (rnd() - 0.5) * (tw - 2), tz = tz0 + (rnd() - 0.5) * (td - 2);
        box(tx, tz, 1.3, 1.3, top + 0.8, 0.5, new THREE.Color(0x6a655e), false);
        cyl(tx, tz, 0.6, 1.3, top + 1.3, new THREE.Color([0x2a2a2c, 0xd8d6d0, 0x3d6a92][Math.floor(rnd() * 3)]));
      }
      if (rnd() < 0.4) box(tx0 - tw / 4, tz0 - td / 4, 2.2, 2.6, top, 2.4, c.clone().multiplyScalar(0.95));
      if (rnd() < 0.25) box(x, z + d / 2 + 0.6, w * 0.6, 1.2, y0 + 2.6, 0.08, new THREE.Color(rnd() < 0.5 ? 0xd9661e : 0x2d6fa8), false);
      if (rnd() < 0.2) box(tx0, tz0 + td / 4, tw * 0.7, 0.04, top + 1.2, 0.7, new THREE.Color([0xc0392b, 0xf1c40f, 0xecf0f1, 0x2e86c1][Math.floor(rnd() * 4)]), false);
      return;
    }
    const bh = 3 + rnd() * 3; // massive sandstone basement rising from the ghat
    box(x, z, w + 0.3, d + 0.3, y0, bh, stone.clone().multiplyScalar(0.85 + rnd() * 0.2));
    box(x, z, w, d, y0 + bh, h - bh, c);
    // floor cornices and a top parapet
    for (let yy = y0 + bh + 3.2; yy < y0 + h - 1; yy += 3.2) box(x, z + d / 2 + 0.15, w + 0.2, 0.3, yy, 0.18, cream, false);
    box(x, z, w + 0.35, d + 0.35, y0 + h - 0.1, 0.25, cream, false);
    box(x, z, w, d, y0 + h + 0.15, 0.9, c.clone().multiplyScalar(0.95));
    // projecting jharokha balconies on the river face
    for (let k = 0; k < Math.floor(w / 4); k++) {
      if (rnd() < 0.45) continue;
      const bx = x - w / 2 + 2 + k * 4, by = y0 + bh + 3.2 * (1 + Math.floor(rnd() * Math.max(1, (h - bh) / 3.2 - 1)));
      if (by > y0 + h - 2) continue;
      box(bx, z + d / 2 + 0.45, 1.8, 0.9, by, 0.18, cream, false);
      box(bx, z + d / 2 + 0.45, 2.0, 1.0, by + 1.9, 0.14, cream, false);
      for (const u of [-0.8, 0.8]) box(bx + u, z + d / 2 + 0.85, 0.12, 0.12, by + 0.18, 1.7, cream, false);
    }
    // a rooftop pavilion now and then
    if (rnd() < 0.35) {
      const px = x + (rnd() - 0.5) * w * 0.5;
      for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(px + u * 1.1, z + d / 2 - 1.6 + v * 1.1, 0.18, 0.18, y0 + h + 1.05, 2.0, cream, false);
      box(px, z + d / 2 - 1.6, 2.8, 2.8, y0 + h + 3.05, 0.3, cream, false);
    }
  };
  // riverfront mansions (ghats) north and south of the Dham, stepping up from the plaza level
  for (const s of [-1, 1]) {
    for (let x = 48; x < GHAT.XS - 6; ) {
      const w = 7 + rnd() * 12;
      const h = 10 + rnd() * 14;
      const cx = s * (x + w / 2);
      if ([[-75, 30], [88, 34]].some(([px, pw]) => Math.abs(cx - px) < pw / 2 + w / 2)) { x += w; continue; }
      house(cx, 136 + rnd() * 3, w, 12 + rnd() * 2, PLAZA.y, h, true);
      if (rnd() < 0.5) house(s * (x + w / 2), 125, w * 0.9, 14, PLAZA.y, h + 6 + rnd() * 8, true);
      x += w + rnd() * 1.5;
    }
  }
  const mat = cityMaterial();

  const mesh = (target: THREE.Group, name: string) => {
    const m = new THREE.Mesh(mergeAll(parts), mat);
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = true;
    target.add(m);
    parts = [];
  };
  mesh(river, 'riverfront-mansions');
  riverfrontTown(river, BR, K, mat, mergeAll);
  // the old city round the Dham (outside the chowk and Parisar), heights from 2 to 6 storeys
  const treeSpots: [number, number, number][] = [];
  for (let x = -260; x < 260; x += 9) {
    for (let z = -260; z < 118; z += 9) {
      const inside = (x > -62 && x < 62 && z > -40 && z < 118);
      if (inside) continue;
      // an open courtyard or a temple garden now and then, with a tree in it
      if (rnd() < 0.07) {
        if (treeSpots.length < 45) treeSpots.push([x + rnd() * 3, z + rnd() * 3, 8 + rnd() * 5]);
        continue;
      }
      const w = 5.5 + rnd() * 5, d = 5.5 + rnd() * 5;
      house(x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, w, d, 0, 3.2 * (2 + Math.floor(Math.pow(rnd(), 0.85) * 5)));
    }
  }
  mesh(g, 'old-city');
  cityTrees(g, treeSpots);
  riverTemples(river);
}

/**
 * Temples along the ghats, as in every riverfront photograph: small Nagara shrines in white,
 * saffron-red and buff on the ghat platforms, the tiered Nepali temple at Lalita Ghat (south of the
 * Dham) and the leaning Ratneshwar Mahadev at the water's edge toward Manikarnika (north).
 */
function riverTemples(g: THREE.Group) {
  const mats = [0xf0ebe2, 0xb8442e, 0xd9a25a, 0xcdb197, 0xe8d9c4].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const gilt = new THREE.MeshStandardMaterial({ color: 0xe2ab45, metalness: 0.8, roughness: 0.45 });
  const R = new Merger(new Physics(), 'riverfront');
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => R.place(mat, geo, x, y, z);
  const spires = [nagaraSpire(1.6, 6.0, RIVER_CLUSTER, 4), nagaraSpire(2.2, 8.5, RIVER_CLUSTER, 5), nagaraSpire(1.2, 4.5, [], 3)];
  let k = 0;
  for (const x of [-58, -84, -112, 52, 70, 118]) {
    const sp = spires[k % 3], mat = mats[k % mats.length], hw = [1.6, 2.2, 1.2][k % 3];
    const bh = hw * 1.9, z = 149.5 - (k % 2) * 2;
    add(new THREE.BoxGeometry(hw * 2.2, bh, hw * 2.2).translate(0, bh / 2, 0), mat, x, PLAZA.y, z);
    add(new THREE.BoxGeometry(hw * 2.5, 0.3, hw * 2.5).translate(0, 0.15, 0), mat, x, PLAZA.y + bh, z);
    add(sp.body, mat, x, PLAZA.y + bh + 0.3, z);
    add(kalashGeo(hw * 0.5), gilt, x, PLAZA.y + bh + 0.3 + sp.topY, z);
    k++;
  }
  // palatial ghat buildings (as at Lalita, Manikarnika, Darbhanga): a tall sandstone plinth rising
  // from the steps, an arcaded storey, corner towers with chhatris
  const sand = mats[3], cream = new THREE.MeshStandardMaterial({ color: 0xd9bf9c, roughness: 0.9 });
  const arch = archPlateGeo(1.6, 2.0, 0.8, 7);
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 1 });
  for (const [px, w, h] of [[-75, 30, 22], [88, 34, 24]] as const) {
    const z0 = 140, d = 10, base = 9;
    add(new THREE.BoxGeometry(w, base, d).translate(0, base / 2, 0), sand, px, PLAZA.y, z0);
    add(new THREE.BoxGeometry(w - 2, h - base, d - 1).translate(0, (h - base) / 2, 0), cream, px, PLAZA.y + base, z0 - 0.5);
    for (let a = -w / 2 + 2; a <= w / 2 - 2; a += 2.6) {
      add(arch, dark, px + a, PLAZA.y + base + 0.4, z0 + d / 2 - 0.99);
      add(arch, dark, px + a, PLAZA.y + base + 5.4, z0 + d / 2 - 0.99);
    }
    add(new THREE.BoxGeometry(w + 0.6, 0.4, d + 0.6).translate(0, 0.2, 0), sand, px, PLAZA.y + base, z0);
    add(new THREE.BoxGeometry(w, 0.5, d).translate(0, 0.25, 0), sand, px, PLAZA.y + h, z0 - 0.5);
    for (const s of [-1, 1]) {
      const tx = px + s * (w / 2 - 1.5);
      add(new THREE.CylinderGeometry(2.0, 2.2, h + 4, 8).translate(0, (h + 4) / 2, 0), sand, tx, PLAZA.y, z0 + d / 2 - 1.5);
      add(chhatriGeo(1.7, 2.4), cream, tx, PLAZA.y + h + 4, z0 + d / 2 - 1.5);
    }
    add(chhatriGeo(2.2, 2.8), cream, px, PLAZA.y + h + 0.5, z0 + 1);
  }

  // Nepali (Kathwala) temple at Lalita Ghat: brick plinth, two pagoda roofs, gilt finial
  const nx = -34, nz = 146, ny = PLAZA.y;
  const brick = new THREE.MeshStandardMaterial({ color: 0x9a4a32, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3e2a1c, roughness: 0.8 });
  const tile = new THREE.MeshStandardMaterial({ color: 0x6e3a26, roughness: 0.85 });
  add(new THREE.BoxGeometry(9, 1.2, 9).translate(0, 0.6, 0), brick, nx, ny, nz);
  add(new THREE.BoxGeometry(5, 3.4, 5).translate(0, 1.7, 0), wood, nx, ny + 1.2, nz);
  add(new THREE.CylinderGeometry(1.2, 4.9, 1.6, 4).rotateY(Math.PI / 4).translate(0, 0.8, 0), tile, nx, ny + 4.6, nz);
  add(new THREE.BoxGeometry(3.0, 2.0, 3.0).translate(0, 1.0, 0), wood, nx, ny + 6.0, nz);
  add(new THREE.CylinderGeometry(0.3, 3.3, 1.8, 4).rotateY(Math.PI / 4).translate(0, 0.9, 0), tile, nx, ny + 8.0, nz);
  add(kalashGeo(1.3), gilt, nx, ny + 9.7, nz);
  // Ratneshwar Mahadev: a stone Nagara temple leaning toward the river, its base in the water
  const rs = nagaraSpire(2.4, 9.0, RIVER_CLUSTER, 5);
  const rt = new THREE.Group();
  rt.position.set(96, WATER_Y - 1.0, 167);
  rt.rotation.x = 0.16;
  g.add(rt);
  const stone = mats[3];
  const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.5, 5.2).translate(0, 2.75, 0), stone);
  const top = new THREE.Mesh(rs.body, stone);
  top.position.y = 5.5;
  for (const m of [body, top]) { m.castShadow = true; rt.add(m); }
  R.flush(g, false);
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  // all parts share position/normal/color
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    col.set(p.attributes.color.array as Float32Array, o * 3);
    o += p.attributes.position.count;
  }
  // facade UVs in metres (3 m storeys); roofs map to a blank corner of the texture
  const vv = new Float32Array(total);
  o = 0;
  for (const p of parts) {
    const a = p.attributes.vv;
    if (a) vv.set(a.array as Float32Array, o);
    o += p.attributes.position.count;
  }
  const uv = new Float32Array(total * 2);
  for (let i = 0; i < total; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const nx = Math.abs(nor[i * 3]), ny = Math.abs(nor[i * 3 + 1]);
    if (ny > 0.5) { uv[i * 2] = 0.02 + vv[i] * 1000; uv[i * 2 + 1] = 0.02; continue; }
    uv[i * 2] = (nx > 0.5 ? z : x) / 3.2 + vv[i] * 1000;
    uv[i * 2 + 1] = (y + 10) / 3.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

let CITY_MAT: THREE.MeshStandardMaterial | null = null;
/** The old city's vertex-coloured facade-atlas material (shared by the city and the riverfront town). */
function cityMaterial() {
  if (CITY_MAT) return CITY_MAT;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: facadeTexture() });
  // four facade designs in one atlas: uv.x carries 1000 × the house's tile, the shader wraps each
  // tile on its own (with explicit gradients, so no mip seams at the tile edges)
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      float kvT = floor((vMapUv.x + 500.0) / 1000.0);
      vec2 kvL = vec2(vMapUv.x - kvT * 1000.0, vMapUv.y);
      vec2 kvA = vec2((fract(kvL.x) + kvT) * 0.25, fract(kvL.y));
      vec4 sampledDiffuseColor = textureGrad(map, kvA, dFdx(kvL) * vec2(0.25, 1.0), dFdy(kvL) * vec2(0.25, 1.0));
      diffuseColor *= sampledDiffuseColor;`);
  };
  mat.customProgramCacheKey = () => 'kv-city-atlas';
  CITY_MAT = mat;
  return mat;
}

/**
 * Facade atlas: four 3.2 m bays of old Varanasi house fronts side by side (arched window with dark
 * shutters; green-shuttered pair; a balcony door with a railing; a barred window with a stone frame),
 * with ledges and weather stains. Each tile keeps a blank bottom-left corner for roofs.
 */
function facadeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 128);
  const stain = (x: number, w: number, y0: number, y1: number, a: number) => {
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, `rgba(90,80,70,${a})`);
    grd.addColorStop(1, 'rgba(90,80,70,0)');
    g.fillStyle = grd;
    g.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
  };
  for (let t = 0; t < 4; t++) {
    const o = t * 128;
    g.fillStyle = '#8a8178';
    g.fillRect(o, 26, 128, 5); // ledge / chhajja line
    if (t === 0) {
      g.fillStyle = '#3a2f28'; g.fillRect(o + 44, 46, 40, 52);
      g.beginPath(); g.arc(o + 64, 46, 20, Math.PI, 0, false); g.fill();
      g.fillStyle = '#5b4a3c'; g.fillRect(o + 46, 48, 17, 48);
      stain(o + 48, 32, 44, 0, 0.25);
    } else if (t === 1) {
      for (const x of [22, 74]) {
        g.fillStyle = '#e8e2d4'; g.fillRect(o + x - 3, 44, 38, 50);
        g.fillStyle = '#2f5a3e'; g.fillRect(o + x, 47, 15, 44); g.fillRect(o + x + 17, 47, 15, 44);
        g.fillStyle = '#244432'; for (let y = 50; y < 90; y += 5) { g.fillRect(o + x, y, 15, 1); g.fillRect(o + x + 17, y, 15, 1); }
      }
      stain(o + 10, 108, 100, 128, 0.18);
    } else if (t === 2) {
      g.fillStyle = '#4a3226'; g.fillRect(o + 46, 36, 36, 70);
      g.fillStyle = '#6b4a34'; g.fillRect(o + 49, 39, 14, 64); g.fillRect(o + 65, 39, 14, 64);
      g.fillStyle = '#2b2b2b'; g.fillRect(o + 34, 78, 60, 3); for (let x = 36; x < 94; x += 6) g.fillRect(o + x, 81, 2, 24);
      g.fillStyle = '#9a9086'; g.fillRect(o + 32, 104, 64, 6);
      stain(o + 30, 10, 110, 128, 0.3);
    } else {
      g.fillStyle = '#d9cdb8'; g.fillRect(o + 38, 40, 52, 62);
      g.fillStyle = '#2e2620'; g.fillRect(o + 44, 46, 40, 50);
      g.fillStyle = '#7d7d78'; for (let x = 50; x < 84; x += 7) g.fillRect(o + x, 46, 2, 50);
      g.fillStyle = '#6a6058'; g.fillRect(o + 112, 0, 4, 128); // drain pipe
      stain(o + 104, 20, 0, 60, 0.22);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(o, 118, 10, 10); // roof corner stays blank
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

/** A canvas of a neem/peepal leaf cluster for the city's trees: small leaves, dark varied greens. */
function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const greens = ['#22381a', '#2b4420', '#334f25', '#3d5a2e', '#47652f', '#2a3f1d', '#516e36'];
  for (let i = 0; i < 520; i++) {
    const rr = Math.sqrt(rnd()) * 112, a = rnd() * Math.PI * 2, sz = 4.5 + rnd() * 4;
    g.save();
    g.translate(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr);
    g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 1.6);
    g.fillStyle = greens[Math.floor(rnd() * greens.length)];
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-sz * 0.8, -sz * 0.3, -sz * 0.6, -sz * 1.3, 0, -sz * 1.9);
    g.bezierCurveTo(sz * 0.6, -sz * 1.3, sz * 0.8, -sz * 0.3, 0, 0);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Trees in the old city's courtyards: one shared leaf-card crown (≈360 alpha-tested cards, normals pointing out of the crown) and a tapering trunk, instanced. spots = [x, z, height].
 */
function cityTrees(g: THREE.Group, spots: [number, number, number][]) {
  if (!spots.length) return;
  let s = 31;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tg = new THREE.CylinderGeometry(0.025, 0.05, 0.62, 8).translate(0, 0.31, 0);
  const lobes = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + rnd(), rr = i === 0 ? 0 : 0.14 + rnd() * 0.12;
    return { c: new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.4) * 0.12, Math.sin(a) * rr), r: 0.2 + rnd() * 0.1 };
  });
  const cards: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 360; i++) {
    const lb = lobes[Math.floor(rnd() * lobes.length)];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = lb.r * (0.65 + 0.35 * Math.pow(rnd(), 0.6));
    const pos = new THREE.Vector3(lb.c.x + dir.x * rr, lb.c.y + dir.y * rr * 0.75 + 0.62, lb.c.z + dir.z * rr);
    const size = 0.13 + rnd() * 0.06;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - 0.62) / 0.7, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    cards.push(card);
  }
  const crownGeo = mergeGeometries(cards)!;
  const trunks = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x4e4136, roughness: 0.95 }), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), spots.length);
  spots.forEach(([x, z, h], i) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28),
      new THREE.Vector3(h * (0.9 + rnd() * 0.25), h, h * (0.9 + rnd() * 0.25)));
    trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m);
  });
  for (const im of [trunks, crowns]) { im.castShadow = false; im.receiveShadow = true; im.name = 'city-trees'; }
  g.add(trunks, crowns);
}

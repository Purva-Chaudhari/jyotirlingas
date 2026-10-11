import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { waterNormals } from '../../engine/materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, Instances, mergeParts, rng } from './batch';
import { textPanel, type NM } from './mats';
import { PL } from './temple';
import { leafTrees } from './trees';

/**
 * The Nageshwar grounds and surroundings (from the satellite view and pilgrims' photographs):
 *  - a walled rectangular compound, ~72 × 126 m: the colossal Shiva and the pigeon tower in the open
 *    northern plaza, the temple in the southern half, a steel queue shed with an orange roof between;
 *  - limewashed crenellated compound walls; the big three-arched gate from the parking on the west, and
 *    the inscribed arch "द्वादश ज्योतिर्लिंग श्री नागेश्वर महादेव" beside the temple;
 *  - outside the west wall a row of prasad / souvenir stalls with tarpaulin awnings, a dusty parking
 *    ground with cars and buses, the road toward Dwarka (17 km) and Gopi Talav, a lane along the north;
 *  - the Nageshwar pond along the whole east side, ringed by dense babul (Prosopis) where herons nest;
 *  - flat arid Saurashtra scrub with field hedges, and to the south the salt pans and creek toward the sea.
 */
export const COMPOUND = { x0: -42, x1: 30, z0: -100, z1: 26 };
export const GATE = { x: -42, z0: -46, z1: -36 };
export const ARCH = { x: -42, z0: -6, z1: 0 };
/** the Nageshwar pond, wrapping the east side and reaching round to the north of the statue enclosure */
export const POND = { cx: 64, cz: -58, rx: 32, rz: 86 };
/** a second sheet of water / wetland to the north-west, beyond the north lane (o02 left, o03 behind) */
export const POND2 = { cx: -40, cz: -172, rx: 48, rz: 24 };
/** the kabutar-khana beside the statue */
export const CHANNEL = { z: -107, hw: 3.5 };

/** ground height: flat round the compound, the pond basin, gentle swells farther out, salt pans south */
export function groundH(x: number, z: number) {
  // the compound stands about 1 m above the parking, the road and the fields
  const C = COMPOUND;
  const out = Math.max(C.x0 - x, x - C.x1, C.z0 - z, z - C.z1);
  let h = -THREE.MathUtils.smoothstep(out, -0.5, 1.5);
  // the water channel wrapping the north side of the compound toward the pond
  if (x > -100 && x < POND.cx) h -= 1.6 * (1 - THREE.MathUtils.smoothstep(Math.abs(z - CHANNEL.z), CHANNEL.hw - 1, CHANNEL.hw + 3));
  for (const W of [POND, POND2]) {
    const pd = Math.hypot((x - W.cx) / W.rx, (z - W.cz) / W.rz);
    if (pd < 1.35) h -= 2.0 * (1 - THREE.MathUtils.smoothstep(pd, 0.75, 1.35));
  }
  const far = THREE.MathUtils.smoothstep(Math.hypot(x, z), 220, 600);
  h += far * (Math.sin(x * 0.006 + 1.3) * Math.cos(z * 0.005) * 2.2 + Math.sin(x * 0.017 + z * 0.011) * 0.8);
  // salt pans and creek to the south
  h -= 0.8 * THREE.MathUtils.smoothstep(z, 210, 320);
  return h;
}

function warp(u: number) { return 300 * u + 2200 * u * u * u; }

export interface PrecinctOut { group: THREE.Group; water: THREE.Mesh; update(t: number): void }

export function buildPrecinct(root: THREE.Object3D, K: NM, P: Physics): PrecinctOut {
  const group = new THREE.Group();
  group.name = 'nageshwar-precinct';
  root.add(group);
  const B = new Batch();
  const r = rng(77);

  // ---------- terrain ----------
  const N = 240;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = warp(i / N * 2 - 1), z = warp(j / N * 2 - 1);
    const k = (j * (N + 1) + i) * 3;
    // sink the ground under the stair and garbhagriha (they lie below grade inside the temple block)
    const sunk = x > 7.6 && x < 19.4 && Math.abs(z) < 4.5;
    pos[k] = x; pos[k + 1] = sunk ? -1.8 : groundH(x, z) - 0.02; pos[k + 2] = z;
  }
  const idx: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setIndex(idx);
  tg.computeVertexNormals();
  const uv = new Float32Array((N + 1) * (N + 1) * 2);
  for (let i = 0; i < (N + 1) * (N + 1); i++) { uv[i * 2] = pos[i * 3]; uv[i * 2 + 1] = pos[i * 3 + 2]; }
  tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const terrain = new THREE.Mesh(tg, K.ground);
  terrain.receiveShadow = true;
  group.add(terrain);
  // walkable ground (flat proxy, with a hole over the sunken stair and garbhagriha) — the pond is fenced off below
  const CC = COMPOUND;
  P.floor(group, -400, 400, -400, 400, -1);
  P.floor(group, CC.x0, CC.x1, CC.z0, -3.4, 0);
  P.floor(group, CC.x0, CC.x1, 3.4, CC.z1, 0);
  P.floor(group, CC.x0, 8.5, -3.4, 3.4, 0);
  P.floor(group, 18.2, CC.x1, -3.4, 3.4, 0);
  // everything outside the compound wall sits 1 m lower
  const outer = new THREE.Group();
  outer.position.y = -1;
  group.add(outer);
  const OB = new Batch();

  // ---------- the ponds ----------
  const wn = waterNormals();
  wn.repeat.set(1 / 6, 1 / 6);
  const pondMat = K.water;
  pondMat.normalMap = wn;
  pondMat.normalScale.set(0.35, 0.35);
  const pondMesh = (W: { cx: number; cz: number; rx: number; rz: number }, seed: number) => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const wob = 1 + 0.06 * Math.sin(a * 3 + seed) + 0.04 * Math.sin(a * 7 + seed * 2);
      const px = W.cx + Math.cos(a) * W.rx * 1.02 * wob, pz = W.cz + Math.sin(a) * W.rz * 1.02 * wob;
      if (i === 0) shape.moveTo(px, -pz); else shape.lineTo(px, -pz);
    }
    const wg = new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2);
    const wuv = wg.attributes.position;
    const wuva = new Float32Array(wuv.count * 2);
    for (let i = 0; i < wuv.count; i++) { wuva[i * 2] = wuv.getX(i); wuva[i * 2 + 1] = wuv.getZ(i); }
    wg.setAttribute('uv', new THREE.BufferAttribute(wuva, 2));
    const m = new THREE.Mesh(wg, pondMat);
    m.position.y = -2.0;
    m.receiveShadow = true;
    group.add(m);
    // fence it off (the banks are steep and overgrown)
    for (let k = 0; k < 12; k++) {
      const z0 = W.cz - W.rz * 1.1 + k * (W.rz * 2.2 / 12), z1 = z0 + W.rz * 2.2 / 12;
      const zc = (z0 + z1) / 2;
      const w = W.rx * 1.06 * Math.sqrt(Math.max(0, 1 - ((zc - W.cz) / (W.rz * 1.1)) ** 2));
      P.solid(Math.max(W.cx - w, COMPOUND.x1 + 0.5), -4, z0, W.cx + w, 3, z1);
    }
    return m;
  };
  const water = pondMesh(POND, 1);
  pondMesh(POND2, 4);

  // ---------- the water channel along the north (o02: water just north of the statue enclosure) ----------
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(POND.cx + 100, CHANNEL.hw * 2 + 2).rotateX(-Math.PI / 2), pondMat);
  ch.position.set((POND.cx - 100) / 2, -2.0, CHANNEL.z);
  group.add(ch);
  P.solid(-100, -4, CHANNEL.z - CHANNEL.hw - 0.5, POND.cx, 2, CHANNEL.z + CHANNEL.hw + 0.5);

  // ---------- distant salt pans and creek toward the sea ----------
  const pans = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1300).rotateX(-Math.PI / 2), K.saltpan);
  pans.position.set(0, -1.62, 960);
  group.add(pans);
  // pan bunds: long low dykes dividing the pans
  for (let i = 0; i < 9; i++) {
    const zz = 330 + i * 70;
    B.box(K.earth, 1400, 0.5, 2.5, -100 + (r() - 0.5) * 80, -1.75, zz);
  }
  for (let i = 0; i < 12; i++) B.box(K.earth, 2.5, 0.5, 600, -500 + i * 95, -1.75, 600);

  // ---------- roads ----------
  const road = (pts: [number, number][], w: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const segs = Math.ceil(len / 40);
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const ax = x0 + (x1 - x0) * t0, az = z0 + (z1 - z0) * t0, bx = x0 + (x1 - x0) * t1, bz = z0 + (z1 - z0) * t1;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        const g = new THREE.PlaneGeometry(w, len / segs + 0.4).rotateX(-Math.PI / 2).rotateY(ang);
        g.translate(cx, groundH(cx, cz) + 0.03, cz);
        B.add(K.road, g);
        // shoulders: dusty margins
        const sg = new THREE.PlaneGeometry(w + 3.4, len / segs + 0.4).rotateX(-Math.PI / 2).rotateY(ang);
        sg.translate(cx, groundH(cx, cz) + 0.015, cz);
        B.add(K.earth, sg);
      }
    }
  };
  road([[-460, 360], [-170, 70], [-108, -60], [-96, -122], [-70, -420]], 7.5); // Dwarka – Gopi Talav road
  road([[-96, -124], [-20, -126], [30, -150], [110, -162], [460, -195]], 5.5); // lane along the north, round the pond
  road([[-140, 30], [-96, -2], [-58, -12]], 6); // approach to the parking

  // ---------- parking ground ----------
  const lot = new THREE.PlaneGeometry(46, 92).rotateX(-Math.PI / 2).translate(-74, 0.012, -32);
  OB.add(K.earth, lot);
  // cars: painted body (instance colour, matte enough not to flare in the sun) and a dark glass cabin
  const carGeo = carGeometry();
  const cars = new Instances(carGeo.body, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.15 }));
  const cabins = new Instances(carGeo.cabin, K.glassDark);
  const tyres = new Instances(carGeo.tyres, K.dark);
  const carCols = [0xf2f2f0, 0xf2f2f0, 0xd9d9d6, 0x9ea3a8, 0x2a2c30, 0xa31c1c, 0x2d4f8a, 0xf2f2f0, 0x8c8e90];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
    if (r() < 0.68) continue;
    const x = -90 + row * 10, z = -70 + i * 5.2 + (r() - 0.5) * 0.8;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (row % 2 ? Math.PI : 0) + (r() - 0.5) * 0.15), new THREE.Vector3(1, 1, 1));
    cars.matrix(m, new THREE.Color(carCols[Math.floor(r() * carCols.length)]));
    cabins.matrix(m.clone());
    tyres.matrix(m.clone());
  }
  cars.flush(outer);
  cabins.flush(outer);
  tyres.flush(outer, false);
  const wheels = new Instances(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12).rotateZ(Math.PI / 2), K.dark);
  // buses (state transport and private coaches)
  const busCols = [0xd7d9dc, 0xc2312a, 0xe8e2d0];
  for (let i = 0; i < 2; i++) {
    const x = -62 - i * 4.2, z = 4 - i * 1.5;
    const bc = new THREE.MeshStandardMaterial({ color: busCols[i % 3], roughness: 0.45, metalness: 0.3 });
    const bus = new THREE.Group();
    const bb = new Batch();
    bb.box(bc, 2.5, 2.6, 11, 0, 0.45, 0);
    bb.box(K.glassDark, 2.52, 0.9, 10.2, 0, 1.75, 0.1);
    bb.box(K.glassDark, 2.3, 1.2, 0.05, 0, 1.4, 5.51);
    bb.box(K.red, 2.53, 0.18, 11.02, 0, 1.2, 0);
    bb.flush(bus);
    for (const wz of [-3.6, 3.4]) for (const wx of [-1.15, 1.15]) wheels.at(x + wx, 0.5, z + wz, 1.5, 1.5, 1.5);
    bus.position.set(x, 0, z);
    bus.rotation.y = 0.12;
    outer.add(bus);
    P.solid(x - 1.4, 0, z - 5.6, x + 1.4, 3, z + 5.6);
  }
  wheels.flush(outer, false);

  // ---------- compound walls (cream-painted, with a red coping band, as in the 2025 drone views) ----------
  const C = COMPOUND;
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.place(K.lime, new THREE.BoxGeometry(len, 2.5, 0.45), cx, 1.25, cz, -ang);
    // red band under a cream cap, and a thin red line at dado height
    B.place(K.roof, new THREE.BoxGeometry(len, 0.15, 0.5), cx, 2.42, cz, -ang);
    B.place(K.cream, new THREE.BoxGeometry(len, 0.1, 0.62), cx, 2.55, cz, -ang);
    B.place(K.roof, new THREE.BoxGeometry(len, 0.08, 0.49), cx, 0.95, cz, -ang);
    B.place(K.lime, new THREE.BoxGeometry(len + 0.1, 1.3, 0.6), cx, -0.35, cz, -ang);
    // pilasters every ~6 m
    const np = Math.floor(len / 6);
    for (let i = 0; i <= np; i++) {
      const t = i / np;
      B.place(K.lime, new THREE.BoxGeometry(0.7, 2.9, 0.75), x0 + (x1 - x0) * t, 1.45, z0 + (z1 - z0) * t, -ang);
      B.place(K.roof, new THREE.BoxGeometry(0.8, 0.18, 0.85), x0 + (x1 - x0) * t, 2.95, z0 + (z1 - z0) * t, -ang);
    }
    P.solid(Math.min(x0, x1) - 0.3, 0, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, 3.4, Math.max(z0, z1) + 0.3);
  };
  wall(C.x0, C.z0, C.x1, C.z0);
  wall(C.x1, C.z0, C.x1, C.z1);
  wall(C.x0, C.z1, C.x1, C.z1);
  wall(C.x0, C.z0, C.x0, GATE.z0 - 1.6);
  wall(C.x0, GATE.z1 + 1.6, C.x0, ARCH.z0 - 1.0);
  wall(C.x0, ARCH.z1 + 1.0, C.x0, C.z1);

  // ---------- main gate (three arches) ----------
  mainGate(group, B, K, P, GATE.x, (GATE.z0 + GATE.z1) / 2);
  // ---------- inscribed temple arch ----------
  templeArch(group, B, K, P, ARCH.x, (ARCH.z0 + ARCH.z1) / 2);

  // ---------- plaza paving and garden strips ----------
  // (leaving a hole over the sunken stair and garbhagriha)
  const paveRect = (x0: number, x1: number, z0: number, z1: number) =>
    B.add(K.plaza, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.025, (z0 + z1) / 2));
  paveRect(C.x0 + 0.25, C.x1 - 0.25, C.z0 + 0.25, -3.4);
  paveRect(C.x0 + 0.25, C.x1 - 0.25, 3.4, C.z1 - 0.25);
  paveRect(C.x0 + 0.25, 8.5, -3.4, 3.4);
  paveRect(18.2, C.x1 - 0.25, -3.4, 3.4);
  // forecourt outside the gates
  OB.add(K.plaza, new THREE.PlaneGeometry(10, 60).rotateX(-Math.PI / 2).translate(-47, 0.02, -24));
  const lawn = K.lawn;
  for (const [x0, x1, z0, z1] of [[-38, -26, 18, 23], [-38, -26, -23, -18], [14, 27, -40, -24], [-38, -30, -96, -70], [19, 27, -96, -80]]) {
    B.span(K.cream, x0 - 0.15, x1 + 0.15, 0, 0.32, z0 - 0.15, z1 + 0.15);
    B.add(lawn, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.33, (z0 + z1) / 2));
    P.solid(x0 - 0.15, 0, z0 - 0.15, x1 + 0.15, 0.9, z1 + 0.15);
  }
  // grass tufts along the lawn kerbs and the foot of the compound wall
  const tuft = new Instances(tuftGeo(), K.grassTuft);
  const edge = (x0: number, z0: number, x1: number, z1: number, gap: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / gap);
    for (let i = 0; i < n; i++) {
      const t = (i + r()) / n;
      tuft.at(x0 + (x1 - x0) * t + (r() - 0.5) * 0.15, 0.02, z0 + (z1 - z0) * t + (r() - 0.5) * 0.15, 0.7 + r() * 0.7, 0.6 + r() * 0.8, 0.7 + r() * 0.7, r() * 6.3);
    }
  };
  for (const [x0, x1, z0, z1] of [[-38, -26, 18, 23], [-38, -26, -23, -18], [14, 27, -40, -24], [-38, -30, -96, -70], [19, 27, -96, -80]]) {
    const o = 0.3;
    edge(x0 - o, z0 - o, x1 + o, z0 - o, 0.35); edge(x0 - o, z1 + o, x1 + o, z1 + o, 0.35);
    edge(x0 - o, z0 - o, x0 - o, z1 + o, 0.35); edge(x1 + o, z0 - o, x1 + o, z1 + o, 0.35);
  }
  const C2 = COMPOUND;
  edge(C2.x0 + 0.5, C2.z0 + 0.5, C2.x1 - 0.5, C2.z0 + 0.5, 0.6);
  edge(C2.x1 - 0.5, C2.z0 + 0.5, C2.x1 - 0.5, C2.z1 - 0.5, 0.6);
  edge(C2.x0 + 0.5, C2.z1 - 0.5, C2.x1 - 0.5, C2.z1 - 0.5, 0.6);
  edge(C2.x0 + 0.5, C2.z0 + 0.5, C2.x0 + 0.5, GATE.z0 - 2, 0.6);
  edge(C2.x0 + 0.5, GATE.z1 + 2, C2.x0 + 0.5, ARCH.z0 - 1.5, 0.6);
  tuft.flush(group, false);
  // monsoon puddles: a few on the plaza, many in the unpaved parking and along the outer forecourt
  const pudShape = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = 1 + 0.28 * Math.sin(a * 3 + 1) + 0.16 * Math.sin(a * 5 + 2) + 0.08 * Math.sin(a * 9);
    if (i === 0) pudShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else pudShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const pud = new Instances(new THREE.ShapeGeometry(pudShape, 4).rotateX(-Math.PI / 2), K.puddle);
  for (const [x, z, a, b] of [[-20, -32, 1.6, 0.9], [8, -45, 1.1, 0.7], [-33, -82, 2.0, 1.1], [15, -70, 0.9, 0.6], [-28, 10, 1.3, 0.8]]) pud.at(x, 0.032, z, a, 1, b, r() * 3);
  for (let i = 0; i < 26; i++) pud.at(-95 + r() * 44, -0.975, -76 + r() * 88, 0.8 + r() * 2.6, 1, 0.5 + r() * 1.4, r() * 3);
  pud.flush(group, false);
  // worn dirt paths from the parking and the road out into the fields
  for (const [ax, az, bx, bz] of [[-96, -60, -180, -40], [-120, 20, -200, 110], [-70, -100, -60, -112], [-52, 26, -40, 70]]) {
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(2.6, len).rotateX(-Math.PI / 2).rotateY(ang).translate((ax + bx) / 2, groundH((ax + bx) / 2, (az + bz) / 2) + 0.025, (az + bz) / 2);
    B.add(K.earth, g);
  }

  // planters round tree trunks (benches on their rims)
  for (const [x, z] of TREE_IN) {
    B.span(K.cream, x - 1.4, x + 1.4, 0, 0.5, z - 1.4, z + 1.4);
    B.span(K.earth, x - 1.25, x + 1.25, 0.5, 0.52, z - 1.25, z + 1.25);
    P.solid(x - 1.4, 0, z - 1.4, x + 1.4, 0.9, z + 1.4);
  }

  // shade trees on the plaza (leaf-card neem and desi badam), each in a round planter whose rim is a bench
  const SHADE: [number, number][] = [[-30, -34], [8, -52], [8, -33], [-14, 21]];
  // (the four planter trees of TREE_IN are drawn here too, instead of as photoscan LODs: one instanced draw)
  leafTrees(group, [
    ...SHADE.map(([x, z], i) => [x, 0.45, z, 7.5 + (i % 3) * 1.2, 1.1] as [number, number, number, number, number]),
    ...TREE_IN.map(([x, z], i) => [x, 0.5, z, 8 + (i % 2) * 1.5, 1.0] as [number, number, number, number, number]),
  ], K.bark);
  for (const [x, z] of SHADE) {
    B.lathe(K.cream, [[1.7, 0], [1.72, 0.4], [1.62, 0.42], [1.6, 0.45], [0.001, 0.45]], x, 0, z, 32);
    B.lathe(K.dark, [[1.82, 0.42], [1.82, 0.48], [1.45, 0.48], [1.45, 0.44]], x, 0, z, 32); // granite bench top
    B.add(K.earth, new THREE.CircleGeometry(1.42, 24).rotateX(-Math.PI / 2).translate(x, 0.47, z));
    P.solid(x - 1.6, 0, z - 1.6, x + 1.6, 0.6, z + 1.6);
  }
  // inlaid dark-granite medallions in the paving either side of the porch approach (seen in the drone view)
  // (the bench granite and the wall's red, so they add no draw calls; laid a few mm proud of the paving)
  const granite = K.dark, redInlay = K.roof;
  for (const z of [-12.5, 12.5]) {
    B.place(granite, new THREE.RingGeometry(1.25, 1.75, 48).rotateX(-Math.PI / 2), -31, 0.045, z);
    B.place(redInlay, new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), -31, 0.045, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.place(granite, new THREE.CircleGeometry(0.26, 12).scale(1, 2.0, 1).rotateZ(-a + Math.PI / 2).rotateX(-Math.PI / 2), -31 + Math.cos(a) * 0.98, 0.045, z + Math.sin(a) * 0.98);
    }
  }

  // ---------- queue shed (steel frame, orange roof) and the teal canopy at the north door ----------
  shed(B, K, P, -14, 6, -27, -19.5, 4.2, 5.0, K.shedRoof);
  canopy(B, K, 1.5, 9.5, -19.2, -14.8, 3.3, K.teal);
  canopy(B, K, 1.5, 9.5, 14.8, 19.2, 3.3, K.teal);
  // queue railings (steel pipes) leading to the west porch
  for (const z of [-3.2, 3.2]) {
    for (let x = -36; x <= -26; x += 1.25) B.lathe(K.steel, [[0.025, 0], [0.025, 1.0]], x, 0, z, 6);
    for (const y of [0.55, 1.0]) B.span(K.steel, -36, -26, y - 0.02, y + 0.02, z - 0.02, z + 0.02);
    P.solid(-36, 0, z - 0.1, -26, 1.1, z + 0.1);
  }
  // footwear stand and a prasad counter by the porch
  B.span(K.steel, -34, -29, 0, 1.6, -9.5, -8.6);
  for (let i = 0; i < 4; i++) B.span(K.wood, -34, -29, 0.3 + i * 0.4, 0.34 + i * 0.4, -9.5, -8.6);
  P.solid(-34, 0, -9.5, -29, 1.6, -8.6);

  // ---------- saffron bunting strung across the forecourt of the temple ----------
  const flagG = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  flagG.computeVertexNormals();
  const bunt = new Instances(flagG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
  const bcol = [0xf26a12, 0xf5a21b, 0xe8401a, 0xf7c52a];
  const string = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 0.4), ang = Math.atan2(bz - az, bx - ax);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang + (r() - 0.5) * 0.4), new THREE.Vector3(1, 1, 1));
      bunt.matrix(m, new THREE.Color(bcol[i % bcol.length]));
    }
  };
  for (const [ax, az, bx, bz] of [[-30, -14, -22, -5], [-30, 13, -22, 5], [-30, -40, -14, -24], [4, -40, -2, -27], [18, -10, 10, -15], [-30, -14, -30, 13]]) string(ax, 5.2, az, bx, 5.4, bz, 0.9);
  bunt.flush(group, false);

  // ---------- the small red shrine behind (east of) the statue deck, on the pond side ----------
  const sx = 10, sz = -60;
  B.span(K.maroon, sx - 2, sx + 2, 0, 0.5, sz - 2, sz + 2);
  B.span(K.maroon, sx - 1.6, sx + 1.6, 0.5, 3.4, sz - 1.6, sz + 1.6);
  B.span(K.cream, sx - 1.8, sx + 1.8, 3.4, 3.6, sz - 1.8, sz + 1.8);
  B.lathe(K.roof, [[1.6, 0], [1.2, 1.0], [0.6, 2.0], [0.2, 2.6], [0.001, 2.7]], sx, 3.6, sz, 4, Math.PI / 4);
  B.span(K.dark, sx - 0.6, sx + 0.6, 0.5, 2.4, sz + 1.6, sz + 1.62);
  B.span(K.cream, sx - 0.8, sx + 0.8, 2.4, 2.6, sz + 1.6, sz + 1.66);
  P.solid(sx - 2, 0, sz - 2, sx + 2, 6, sz + 2);

  // ---------- the white two-storey dharamshala / trust blocks east of the temple (o02 right) ----------
  const block = (x0: number, x1: number, z0: number, z1: number, storeys: number) => {
    const h = storeys * 3.3;
    B.span(K.lime, x0, x1, 0, h, z0, z1);
    B.span(K.cream, x0 - 0.15, x1 + 0.15, h, h + 0.35, z0 - 0.15, z1 + 0.15);
    // blue tarpaulin patches on the flat roof, a water tank
    B.span(K.tarpBlue, x0 + 0.8, x0 + (x1 - x0) * 0.5, h + 0.36, h + 0.4, z0 + 0.8, z1 - 0.8);
    B.lathe(K.dark, [[0.6, 0], [0.6, 1.1], [0.001, 1.15]], x1 - 1.4, h + 0.35, z0 + 1.4, 12);
    for (let st = 0; st < storeys; st++) for (let z = z0 + 1.2; z < z1 - 0.8; z += 2.4) {
      B.span(K.glassDark, x0 - 0.03, x0, st * 3.3 + 1.0, st * 3.3 + 2.3, z, z + 1.1);
      B.span(K.cream, x0 - 0.1, x0, st * 3.3 + 0.9, st * 3.3 + 1.0, z - 0.1, z + 1.2);
    }
    for (let st = 1; st < storeys; st++) B.span(K.cream, x0 - 0.6, x0, st * 3.3 - 0.15, st * 3.3, z0, z1);
    P.solid(x0, 0, z0, x1, h, z1);
  };
  block(20.5, 29.4, 8.5, 25, 2);
  block(21, 29.4, -22, -12, 1);

  // ---------- lamp posts ----------
  const lamp = new Instances(lampGeo(), K.steel);
  for (const [x, z] of [[-30, -78], [-30, -40], [4, -78], [4, -40], [-30, -14], [18, -10], [18, 20], [-30, 13], [-20, -95], [24, -60]]) {
    lamp.at(x, 0, z);
    P.solid(x - 0.15, 0, z - 0.15, x + 0.15, 6, z + 0.15);
  }
  lamp.flush(group);

  // ---------- stalls outside the west wall ----------
  const tarp = [0x2a64b8, 0x2c8b80, 0x1f5fa8, 0x3a9a5a, 0x2f6db5, 0x2a8a70].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, side: THREE.DoubleSide }));
  const goods = [0xd84a1a, 0xf0c040, 0xb31c4a, 0x4a9a40, 0xe8e0d0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  for (let i = 0; i < 22; i++) {
    const z = -98 + i * 3.6;
    if (z > GATE.z0 - 4 && z < GATE.z1 + 4) continue;
    if (z > ARCH.z0 - 3 && z < ARCH.z1 + 3) continue;
    const x0 = C.x0 - 5.2, x1 = C.x0 - 0.6;
    OB.span(i % 3 ? K.lime : K.cream, x0, x1, 0, 3.0, z - 1.7, z + 1.7);
    OB.span(K.dark, x0 - 0.02, x0, 0.1, 2.4, z - 1.3, z + 1.3);
    OB.span(K.steel, x0 - 0.05, x0 + 0.02, 2.35, 2.45, z - 1.4, z + 1.4);
    // counter with goods (prasad boxes, rudraksha, photos, bangles)
    OB.span(K.wood, x0 - 0.9, x0, 0, 0.9, z - 1.4, z + 1.4);
    for (let k = 0; k < 5; k++) OB.span(goods[(i + k) % goods.length], x0 - 0.85 + k * 0.17, x0 - 0.7 + k * 0.17, 0.9, 0.9 + 0.1 + r() * 0.25, z - 1.2 + r() * 0.4, z - 0.2 + r() * 1.2);
    // sloping tarpaulin awning on poles
    const aw = new THREE.PlaneGeometry(2.6, 3.4).rotateX(-Math.PI / 2).rotateZ(-0.28).translate(x0 - 1.25, 2.85, z);
    OB.add(tarp[i % tarp.length], aw);
    for (const dz of [-1.6, 1.6]) OB.lathe(K.steel, [[0.03, 0], [0.03, 2.5]], x0 - 2.45, 0, z + dz, 6);
    // signboard
    OB.span(tarp[(i + 2) % tarp.length], x0 - 0.06, x0, 2.5, 3.0, z - 1.6, z + 1.6);
    P.solid(x0 - 0.9, 0, z - 1.7, x1, 3.0, z + 1.7);
  }

  // ---------- scrub and babul round the pond and along the field hedges ----------
  // babul (Prosopis / Acacia): flat, layered umbrella crowns of dark olive leaf cards on forked dark trunks
  const bg = babulGeo();
  const leafMat = babulLeafMaterial();
  const babul = new Instances(bg, leafMat);
  const babulFar = new Instances(bg, leafMat);
  const trunk = new Instances(babulTrunkGeo(), K.bark);
  const plant = (x: number, z: number, s: number) => {
    const y = groundH(x, z);
    const w = s * (0.75 + r() * 0.35), yaw = r() * 6.3;
    (Math.hypot(x + 6, z + 38) < 170 ? babul : babulFar).at(x, y + s * 0.66, z, w, s * (0.55 + r() * 0.2), w * (0.85 + r() * 0.3), yaw);
    trunk.at(x, y, z, s * 0.75, s * 0.7, s * 0.75, yaw);
  };
  // dense ring round the pond (east half thickest)
  for (let i = 0; i < 480; i++) {
    const a = i < 230 ? r() * Math.PI * 2 : (r() - 0.5) * Math.PI * 1.1;
    const k = 1.02 + r() * 0.3;
    const x = POND.cx + Math.cos(a) * POND.rx * k, z = POND.cz + Math.sin(a) * POND.rz * k;
    if (x < C.x1 + 3) continue;
    plant(x, z, 3.5 + r() * 3);
  }
  // hedgerows along field boundaries and the roads
  const hedge = (x0: number, z0: number, x1: number, z1: number, gap: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / gap);
    for (let i = 0; i < n; i++) {
      if (r() < 0.25) continue;
      const t = i / n;
      plant(x0 + (x1 - x0) * t + (r() - 0.5) * 3, z0 + (z1 - z0) * t + (r() - 0.5) * 3, 2.5 + r() * 2.5);
    }
  };
  hedge(-420, -60, -120, -60, 7);
  hedge(-150, -300, -150, -130, 7);
  hedge(110, -330, 110, -140, 7);
  hedge(120, -135, 420, -135, 7);
  hedge(-300, 120, -60, 120, 8);
  hedge(-60, 40, -60, 200, 8);
  hedge(110, 60, 420, 60, 8);
  hedge(60, 100, 60, 260, 8);
  // trees lining the canal and the roads (babul and neem-like crowns)
  hedge(-98, CHANNEL.z - CHANNEL.hw - 3, POND.cx - POND.rx, CHANNEL.z - CHANNEL.hw - 3, 9);
  hedge(-98, CHANNEL.z + CHANNEL.hw + 2.5, COMPOUND.x0 - 2, CHANNEL.z + CHANNEL.hw + 2.5, 9);
  for (const [a0, b0, a1, b1] of [[-460, 360, -170, 70], [-170, 70, -108, -60], [-108, -60, -96, -122], [-96, -122, -70, -420], [-96, -124, -20, -126], [-20, -126, 30, -150], [30, -150, 110, -162]]) {
    const len = Math.hypot(a1 - a0, b1 - b0), nx = -(b1 - b0) / len, nz = (a1 - a0) / len;
    for (const side of [-1, 1]) hedge(a0 + nx * 7 * side, b0 + nz * 7 * side, a1 + nx * 7 * side, b1 + nz * 7 * side, 13);
  }
  // scattered bushes on the open ground
  for (let i = 0; i < 380; i++) {
    const x = (r() - 0.5) * 900, z = -380 + r() * 620;
    if (x > C.x0 - 70 && x < C.x1 + 75 && z > C.z0 - 30 && z < C.z1 + 30) continue;
    plant(x, z, 1.2 + r() * 2.4);
  }
  babul.flush(group, true);
  babulFar.flush(group, false);
  OB.flush(outer);
  trunk.flush(group, true);

  // ---------- a few village houses and the temple trust buildings beyond ----------
  const house = (x: number, z: number, w: number, d: number, h: number, mat: THREE.Material) => {
    B.span(mat, x - w / 2, x + w / 2, groundH(x, z) - 0.2, groundH(x, z) + h, z - d / 2, z + d / 2);
    B.span(K.cream, x - w / 2 - 0.1, x + w / 2 + 0.1, groundH(x, z) + h, groundH(x, z) + h + 0.25, z - d / 2 - 0.1, z + d / 2 + 0.1);
  };
  for (let i = 0; i < 26; i++) {
    const x = -160 + r() * 130, z = 50 + r() * 140;
    house(x, z, 6 + r() * 6, 6 + r() * 5, 3 + r() * 3.5, r() < 0.5 ? K.lime : K.cream);
  }
  house(-10, -137, 18, 9, 6.5, K.lime); // trust office across the north lane
  house(-60, -136, 10, 8, 3.5, K.lime);
  // power line along the Dwarka road
  const pole = new Instances(new THREE.CylinderGeometry(0.1, 0.14, 9, 6).translate(0, 4.5, 0), K.steel);
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const x = -300 + t * 205 + 8, z = 210 - t * 330;
    pole.at(x, groundH(x, z), z);
  }
  pole.flush(group, false);

  B.flush(group);
  return {
    group, water,
    update(t: number) {
      wn.offset.set(t * 0.004, t * 0.0025);
    },
  };
}

/** rounded merlon with a small arched slit (as on the compound wall in the photographs) */
function merlonGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.38, 0); s.lineTo(0.38, 0); s.lineTo(0.38, 0.5); s.quadraticCurveTo(0.38, 0.82, 0, 0.86); s.quadraticCurveTo(-0.38, 0.82, -0.38, 0.5); s.lineTo(-0.38, 0);
  const h = new THREE.Path();
  h.moveTo(-0.07, 0.15); h.lineTo(0.07, 0.15); h.lineTo(0.07, 0.48); h.quadraticCurveTo(0, 0.58, -0.07, 0.48); h.lineTo(-0.07, 0.15);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -0.2);
  return g;
}

/** cars: a body (tinted per instance), a dark glass cabin and four tyres, as separate instanced parts */
function carGeometry() {
  const body = mergeParts([
    new THREE.BoxGeometry(1.72, 0.55, 4.1).translate(0, 0.6, 0),
    new THREE.BoxGeometry(1.6, 0.12, 2.2).translate(0, 0.93, -0.15),
  ]);
  const cabin = mergeParts([new THREE.CylinderGeometry(0.6, 0.8, 0.5, 4, 1).rotateY(Math.PI / 4).scale(1.32, 1, 2.2).translate(0, 1.24, -0.15)]);
  const tyres = mergeParts([-1.3, 1.3].flatMap((z) => [-0.78, 0.78].map((x) => new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateZ(Math.PI / 2).translate(x, 0.32, z))));
  return { body, cabin, tyres };
}

function lampGeo() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(0.06, 0.1, 5.5, 8).translate(0, 2.75, 0));
  parts.push(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 8).translate(0, 0.2, 0));
  parts.push(new THREE.BoxGeometry(1.4, 0.06, 0.06).translate(0, 5.3, 0));
  for (const s of [-1, 1]) parts.push(new THREE.SphereGeometry(0.2, 10, 8).translate(s * 0.68, 5.15, 0));
  return mergeParts(parts);
}

/** a babul / prosopis crown: a few flattened lumpy blobs merged into a wide umbrella */
/** a babul crown, unit radius ≈ 1: three flat, wavy-edged canopy layers and a few tilted cards (leaf texture, alpha-tested) */
function babulGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(9);
  const layer = (rad: number, y: number, ox: number, oz: number) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2, rr = rad * (0.8 + 0.2 * Math.sin(a * 5 + r() * 2) + 0.1 * r());
      if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const g = new THREE.ShapeGeometry(sh, 2).rotateX(-Math.PI / 2);
    // dome the layer slightly
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, -0.12 * (p.getX(k) ** 2 + p.getZ(k) ** 2) / (rad * rad));
    g.translate(ox, y, oz);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) * 1.2, p.getZ(k) * 1.2);
    parts.push(g);
  };
  layer(1.0, 0.22, 0, 0);
  layer(0.75, 0.08, 0.35, -0.2);
  layer(0.7, 0.0, -0.4, 0.25);
  layer(0.5, 0.32, -0.1, 0.1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = new THREE.PlaneGeometry(0.9, 0.38).rotateX(-0.9).rotateY(a).translate(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62);
    parts.push(c);
  }
  const g = mergeGeometries(parts.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x.index ? x.toNonIndexed() : x; }))!;
  // normals pointing up-ish for soft canopy shading
  const n = g.attributes.normal;
  for (let k = 0; k < n.count; k++) n.setXYZ(k, n.getX(k) * 0.3, 1, n.getZ(k) * 0.3);
  return g;
}

/** a babul trunk: a leaning main stem forking into three branches up to the crown (unit height) */
function babulTrunkGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) => {
    const len = a.distanceTo(b);
    const c = new THREE.CylinderGeometry(r1, r0, len, 6).translate(0, len / 2, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    parts.push(c.translate(a.x, a.y, a.z));
  };
  const fork = new THREE.Vector3(0.05, 0.5, 0.02);
  limb(new THREE.Vector3(0, 0, 0), fork, 0.06, 0.045);
  for (const [x, z] of [[0.45, 0.1], [-0.35, 0.3], [-0.05, -0.45]]) limb(fork, new THREE.Vector3(x, 0.95, z), 0.035, 0.015);
  return mergeParts(parts);
}

/** leaf cards: many small dark-olive leaflets on a transparent ground */
function babulLeafMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = rng(13);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI;
    const k = r();
    g.fillStyle = k < 0.4 ? '#2e3a16' : k < 0.75 ? '#3c4a1e' : k < 0.93 ? '#4c5a26' : '#5e6a30';
    g.beginPath(); g.ellipse(x, y, 4 + r() * 3, 1.6 + r(), a, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
}

function mainGate(parent: THREE.Object3D, B: Batch, K: NM, P: Physics, x: number, zc: number) {
  // three openings: a tall central arch (4.4 m) and two lower side arches; stepped crown with a little pavilion
  const G = K.gateYellow;
  const pier = (z: number, w: number, h: number) => {
    B.span(G, x - 1.2, x + 1.2, -1.0, h, z - w / 2, z + w / 2);
    B.span(K.cream, x - 1.3, x + 1.3, h, h + 0.25, z - w / 2 - 0.1, z + w / 2 + 0.1);
    P.solid(x - 1.2, 0, z - w / 2, x + 1.2, h, z + w / 2);
  };
  pier(zc - 3.0, 1.6, 8.0);
  pier(zc + 3.0, 1.6, 8.0);
  pier(zc - 6.9, 1.2, 5.6);
  pier(zc + 6.9, 1.2, 5.6);
  const archFill = (z0: number, z1: number, spring: number, top: number) => {
    const span = z1 - z0, hs = span / 2, zc2 = (z0 + z1) / 2;
    const s = new THREE.Shape();
    s.moveTo(-hs, 0);
    // cusped (multifoil) arch head, as on the 2025 gate
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, a = Math.PI * (1 - t);
      const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * 7)), 0.55) * hs * 0.1;
      const k = 1 - cusp / hs;
      s.lineTo(Math.cos(a) * hs * k, Math.max(0, Math.sin(a) * hs * 0.95 * k));
    }
    s.lineTo(hs, 0); s.lineTo(hs, top - spring); s.lineTo(-hs, top - spring); s.lineTo(-hs, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -1.1).rotateY(Math.PI / 2).translate(x, spring, zc2);
    B.add(G, g);
    // cream archivolt
    const t = new THREE.TorusGeometry(hs + 0.08, 0.1, 6, 24, Math.PI).scale(1, 0.95, 1).rotateY(Math.PI / 2);
    for (const dx of [-1.15, 1.15]) B.place(K.cream, t, x + dx, spring, zc2);
  };
  archFill(zc - 2.2, zc + 2.2, 5.0, 8.0);
  archFill(zc - 6.3, zc - 3.8, 3.4, 5.6);
  archFill(zc + 3.8, zc + 6.3, 3.4, 5.6);
  // stepped crown and a small arched pavilion on top
  B.span(G, x - 1.1, x + 1.1, 8.25, 9.4, zc - 3.6, zc + 3.6);
  B.span(K.cream, x - 1.2, x + 1.2, 9.4, 9.6, zc - 3.7, zc + 3.7);
  B.span(G, x - 0.9, x + 0.9, 9.6, 10.4, zc - 2.0, zc + 2.0);
  for (const dz of [-1.6, 1.6]) B.span(G, x - 0.35, x + 0.35, 10.4, 12.0, zc + dz - 0.35, zc + dz + 0.35);
  B.span(K.cream, x - 0.9, x + 0.9, 12.0, 12.25, zc - 2.0, zc + 2.0);
  B.lathe(G, [[1.2, 0], [1.25, 0.2], [1.0, 0.9], [0.4, 1.4], [0.06, 1.7], [0.001, 1.75]], x, 12.25, zc, 4, Math.PI / 4);
  for (const dz of [-6.9, 6.9, -3, 3]) B.lathe(G, [[0.5, 0], [0.45, 0.4], [0.15, 0.9], [0.001, 1.0]], x, dz === -3 || dz === 3 ? 8.25 : 5.85, zc + dz, 4, Math.PI / 4);
  // the compound is ~1 m above the parking: a broad flight of six steps up to the gate
  gateSteps(parent, B, K, P, x - 1.25, zc - 7.5, zc + 7.5, 6);
}

/** steps from the outside ground (y = −1) up to the compound (y = 0), descending westward from x0 */
function gateSteps(parent: THREE.Object3D, B: Batch, K: NM, P: Physics, x0: number, z0: number, z1: number, n: number) {
  const rise = 1 / n, tread = 0.36;
  for (let i = 0; i < n; i++) {
    const top = -rise * i;
    B.span(i % 2 ? K.cream : K.gateYellow, x0 - (i + 1) * tread, x0 - i * tread, -1.05, top, z0, z1);
    P.floor(parent, x0 - (i + 1) * tread, x0 - i * tread, z0, z1, top);
  }
  // the threshold under the gate, from the top step to the compound's paving (else a 1 m trench to climb out of)
  if (x0 < COMPOUND.x0) {
    B.span(K.gateYellow, x0, COMPOUND.x0 + 0.25, -1.05, -0.004, z0, z1); // (tucked under the paving's edge)
    P.floor(parent, x0, COMPOUND.x0, z0, z1, 0);
  }
}

function templeArch(group: THREE.Group, B: Batch, K: NM, P: Physics, x: number, zc: number) {
  // piers with painted trishuls, a round arch with the inscribed ogee pediment above
  const hw = 3.6;
  gateSteps(group, B, K, P, x - 0.95, zc - hw, zc + hw, 6);
  for (const s of [-1, 1]) {
    B.span(K.lime, x - 0.9, x + 0.9, -1.0, 5.2, zc + s * hw - (s > 0 ? 0 : 1.4), zc + s * hw + (s > 0 ? 1.4 : 0));
    P.solid(x - 0.9, 0, zc + s * hw - (s > 0 ? 0 : 1.4), x + 0.9, 5.2, zc + s * hw + (s > 0 ? 1.4 : 0));
  }
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  for (let i = 0; i <= 24; i++) { const a = Math.PI * (1 - i / 24); s.lineTo(Math.cos(a) * hw, Math.sin(a) * 1.6); }
  s.lineTo(hw, 0); s.lineTo(hw + 1.4, 0); s.lineTo(hw + 1.4, 0.7);
  // ogee pediment
  s.quadraticCurveTo(hw * 0.4, 1.0, 0.35, 2.8); s.lineTo(0, 3.1); s.lineTo(-0.35, 2.8); s.quadraticCurveTo(-hw * 0.4, 1.0, -hw - 1.4, 0.7);
  s.lineTo(-hw - 1.4, 0); s.lineTo(-hw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -0.8).rotateY(Math.PI / 2).translate(x, 4.6, zc);
  B.add(K.lime, g);
  const rim = new THREE.TorusGeometry(1, 0.1, 6, 28, Math.PI).scale(hw, 1.6, 1).rotateY(Math.PI / 2);
  for (const dx of [-0.82, 0.82]) B.place(K.cream, rim, x + dx, 4.6, zc);
  // inscription and painted trishuls on the outer (west) face
  const ins = textPanel([
    { text: 'ॐ', font: 'bold 70px "Noto Sans Devanagari", Martel, serif', color: '#c0391b', y: 50 },
    { text: 'द्वादश ज्योतिर्लिंग', font: 'bold 78px "Noto Sans Devanagari", Martel, serif', color: '#8a1f1a', y: 140 },
    { text: 'श्री नागेश्वर महादेव', font: 'bold 96px "Noto Sans Devanagari", Martel, serif', color: '#8a1f1a', y: 245 },
  ], 1024, 300, null);
  for (const [dx, ry] of [[-0.83, -Math.PI / 2], [0.83, Math.PI / 2]] as const) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.65), ins);
    plate.position.set(x + dx, 6.55, zc);
    plate.rotation.y = ry;
    group.add(plate);
  }
  const tri = textPanel([{ text: '🔱', font: '180px serif', color: '#e0601a', y: 128 }], 256, 256, null);
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), tri);
    m.position.set(x - 0.92, 2.6, zc + sz * (hw + 0.7));
    m.rotation.y = -Math.PI / 2;
    group.add(m);
  }
}

function shed(B: Batch, K: NM, P: Physics, x0: number, x1: number, z0: number, z1: number, eaveH: number, ridgeH: number, roofMat: THREE.Material) {
  const zc = (z0 + z1) / 2, hd = (z1 - z0) / 2;
  for (let x = x0; x <= x1 + 0.01; x += 4) for (const z of [z0, z1]) {
    B.box(K.steel, 0.2, eaveH, 0.2, x, 0, z);
    P.solid(x - 0.15, 0, z - 0.15, x + 0.15, eaveH, z + 0.15);
  }
  for (let x = x0; x <= x1 + 0.01; x += 4) {
    // trusses
    for (const s of [-1, 1]) {
      const len = Math.hypot(hd, ridgeH - eaveH), ang = Math.atan2(ridgeH - eaveH, hd);
      B.place(K.steel, new THREE.BoxGeometry(0.12, 0.25, len).rotateX(s * ang * -1 * -1), x, (eaveH + ridgeH) / 2 - 0.15, zc + (s * hd) / 2);
    }
    B.box(K.steel, 0.1, 0.12, z1 - z0, x, eaveH - 0.1, zc);
  }
  const len = Math.hypot(hd + 0.6, ridgeH - eaveH + 0.15), ang = Math.atan2(ridgeH - eaveH, hd);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(x1 - x0 + 1.2, 0.06, len).rotateX(s * ang);
    g.translate((x0 + x1) / 2, (eaveH + ridgeH) / 2 - 0.05, zc + s * (hd + 0.6) / 2);
    B.add(roofMat, g);
  }
}

function canopy(B: Batch, K: NM, x0: number, x1: number, z0: number, z1: number, h: number, mat: THREE.Material) {
  for (const x of [x0, (x0 + x1) / 2, x1]) for (const z of [z0, z1]) B.lathe(K.steel, [[0.04, 0], [0.04, h + 0.1]], x, PL * 0 + 0, z, 6);
  // a thin slab, not a double-sided plane: back faces are culled in the AO normal pass (the temple ghosted through)
  const g = new THREE.BoxGeometry(x1 - x0 + 0.4, 0.06, z1 - z0 + 0.4).rotateX(0.08).translate((x0 + x1) / 2, h, (z0 + z1) / 2);
  B.add(mat, g);
}

/** trees inside the compound (shared neem model) — exported for the SiteDef */
// few shared trees (each LOD0 is ~300k triangles); the rest of the greenery is the instanced babul
export const TREE_IN: [number, number][] = [[-34, -90], [24, -92], [-36, 12], [24, -50]];
export const TREES: [number, number, number][] = [];

/** a tuft of grass blades (unit ≈ 25 cm tall) */
function tuftGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(41);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, lean = 0.2 + r() * 0.35;
    parts.push(new THREE.ConeGeometry(0.012, 0.18 + r() * 0.1, 3).translate(0, 0.12, 0).rotateZ(lean).rotateY(a).translate(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03));
  }
  return mergeParts(parts);
}

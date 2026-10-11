import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { KM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './shivling';
import { chhatriGeo, kalashGeo, lathe, nagaraSpire, archPlateGeo, onionDome } from './spire';

/**
 * The Varanasi riverfront either side of the Ganga Dwar: the crescent of ghats (stone steps from the
 * Dham's plaza at y = −10 down into the Ganga at y = −15.3), palaces and havelis on tall stone plinths
 * above them, temples, chhatris, straw umbrellas, moored wooden boats, and the pale sand bank with its
 * tree line on the far side.
 *
 * The bank is straight across the Dham (|x| < XS) and bends toward the river beyond, so from the
 * Ganga Dwar steps the ghats to the north (Manikarnika, +x) and south (Dashashwamedh, −x) curve
 * round into view, as along the real crescent.
 *
 * Values are in world metres; z = PLAZA.z1 (152) is the top step, the Ganga is at y = −15.3.
 */
export const GHAT = { XS: 136, Z0: 152, Y0: -10, WATER: -15.3, C: 0.0007, XMAX: 700 };

export interface Step { o0: number; o1: number; y: number; landing: boolean }

/** 30 steps (riser ≈ 0.22 m) in three flights with two broad landings; o is measured from the top step. */
export const STEPS: Step[] = (() => {
  const out: Step[] = [];
  const n = 30, riser = (GHAT.Y0 - (GHAT.WATER - 1.2)) / n;
  let o = 0, y = GHAT.Y0;
  for (let i = 0; i < n; i++) {
    const landing = i === 9 || i === 19;
    const tread = landing ? 2.6 : 0.52;
    y -= riser;
    out.push({ o0: o, o1: o + tread, y, landing });
    o += tread;
  }
  return out;
})();
export const STEPS_END = STEPS[STEPS.length - 1].o1;
/** offset of the water's edge from the top step */
export const WATER_O = STEPS.find((s) => s.y < GHAT.WATER)!.o0;

/** Tread height at offset o from the top step (the plaza level above it). */
export function ghatY(o: number) {
  if (o < 0) return GHAT.Y0;
  for (const s of STEPS) if (o < s.o1) return s.y;
  return STEPS[STEPS.length - 1].y;
}

/** The bank's top line at x: the point, the outward (riverward) normal, the tangent and the box rotation. */
export function bank(x: number) {
  const d = Math.max(0, Math.abs(x) - GHAT.XS);
  const z = GHAT.Z0 + GHAT.C * d * d;
  const dzdx = 2 * GHAT.C * d * Math.sign(x);
  const th = Math.atan(dzdx);
  return { x, z, tx: Math.cos(th), tz: Math.sin(th), nx: -Math.sin(th), nz: Math.cos(th), ry: -th };
}
/** World point at x along the bank, `u` metres along the tangent and `o` metres riverward of the top step. */
export function bankAt(x: number, o: number, u = 0): [number, number] {
  const b = bank(x);
  return [b.x + b.tx * u + b.nx * o, b.z + b.tz * u + b.nz * o];
}

let seed = 913;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ------------------------------------------------------------------------------------------------ steps

/**
 * The ghat steps. Near the Dham each step is a riser block and a tread slab whose nosing overhangs the
 * riser face, with a dark shadow line under the nose and an occluded strip at the riser's foot, so
 * the flight reads as crisp lines, not a ramp. The lower steps darken (damp, then wet with silt).
 * Beyond |x| = XS the same flights follow the curved bank in 10 m segments.
 */
export function ghatSteps(B: Merger, K: KM, P: Physics, g: THREE.Group, flames: Flames, O: Offerings) {
  const { XS, Z0, WATER } = GHAT;
  const mats = (y: number) => (y < WATER + 0.45 ? [K.ghatWet, K.ghatWet] : y < WATER + 1.7 ? [K.ghatDamp, K.ghatDamp] : [K.ghatRiser, K.ghatTread]);
  // ---- straight flights across the Dham
  for (const s of STEPS) {
    const [riserM, treadM] = mats(s.y);
    const z0 = Z0 + s.o0, z1 = Z0 + s.o1;
    B.span(riserM, -XS, s.y - 0.7, z0, XS, s.y - 0.06, z1 + 0.02);
    B.span(treadM, -XS, s.y - 0.06, z0 - 0.02, XS, s.y, z1 + 0.06); // nosing overhangs 4 cm
    if (s.y > WATER - 0.2) {
      B.span(K.stepShadow, -XS, s.y - 0.1, z1 + 0.02, XS, s.y - 0.06, z1 + 0.03); // shadow under the nose
      B.span(K.stepFoot, -XS, s.y, z0 - 0.03, XS, s.y + 0.035, z0 - 0.02); // occluded foot of the riser above
    }
  }
  // walkable floors: three flights (ramps) and two landings
  let fz = 0, fy = GHAT.Y0, yPrev = GHAT.Y0;
  for (const s of STEPS) {
    if (s.landing) {
      P.floor(g, -XS, XS, Z0 + fz, Z0 + s.o0, fy, yPrev);
      P.floor(g, -XS, XS, Z0 + s.o0, Z0 + s.o1, s.y);
      fz = s.o1; fy = s.y;
    }
    yPrev = s.y;
  }
  P.floor(g, -XS, XS, Z0 + fz, Z0 + STEPS_END, fy, yPrev);
  // the river wall one can't walk past, and the ends of the straight flights
  P.solid(-XS, WATER - 2, Z0 + STEPS_END - 3.2, XS, WATER + 3, Z0 + STEPS_END - 2.9);
  for (const s of [-1, 1]) P.solid(s > 0 ? XS - 0.4 : -XS, WATER - 2, Z0 - 1, s > 0 ? XS : -XS + 0.4, GHAT.Y0 + 3, Z0 + STEPS_END);

  // ---- the curved flights beyond
  for (const sgn of [-1, 1]) {
    for (let x = XS; x < GHAT.XMAX; x += 10) {
      const xm = sgn * (x + 5), b = bank(xm);
      const L = 10 * Math.hypot(1, b.tz / b.tx) + 0.5;
      for (const s of STEPS) {
        const [riserM, treadM] = mats(s.y);
        const om = (s.o0 + s.o1) / 2, d = s.o1 - s.o0;
        const [cx, cz] = bankAt(xm, om);
        B.box(riserM, L, 0.64, d + 0.02, cx, s.y - 0.7, cz, false, b.ry);
        B.box(treadM, L, 0.06, d + 0.04, cx, s.y - 0.06, cz, false, b.ry);
      }
    }
  }

  // ---- straw umbrellas over takhts and stone chabutras on the landings, all along the bank
  const umbrella = lathe([[0, 0.7], [0.3, 0.6], [1.0, 0.28], [1.7, 0.02], [1.75, -0.06], [1.68, -0.04], [0, 0.42]], 20, 20, 0.05);
  const spokes = new THREE.CylinderGeometry(0.02, 0.02, 1.7, 4).rotateZ(Math.PI / 2).translate(0.85, 0, 0);
  const lands = STEPS.filter((s) => s.landing);
  let k = 0;
  for (const s of lands) {
    for (let ax = -440; ax <= 440; ax += 7.5) {
      if (Math.abs(ax) < 14) continue;
      k++;
      const x = ax + ((k * 13) % 7) * 0.45;
      const o = (s.o0 + s.o1) / 2 + ((k * 7) % 5) * 0.08 - 0.15;
      const b = bank(x), [cx, cz] = bankAt(x, o);
      const straight = Math.abs(x) < XS - 2;
      if (k % 3 === 0) {
        B.box(K.ghat, 2.8, 0.55, 2.0, cx, s.y, cz, straight, b.ry);
      } else {
        B.box(K.door, 2.0, 0.08, 1.2, cx, s.y + 0.38, cz, false, b.ry);
        for (const [u, v] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) {
          B.box(K.door, 0.08, 0.38, 0.08, cx + b.tx * u + b.nx * v, s.y, cz + b.tz * u + b.nz * v, false, b.ry);
        }
        if (straight) P.solid(cx - 1.0, s.y, cz - 0.6, cx + 1.0, s.y + 0.46, cz + 0.6);
      }
      if (k % 4 !== 1) {
        const top = s.y + (k % 3 === 0 ? 0.55 : 0.46) + 2.4;
        B.box(K.bamboo, 0.06, top - s.y - 0.3, 0.06, cx, s.y + 0.3, cz);
        B.place(K.straw, umbrella, cx, top - 0.1, cz, k * 0.7);
        if (Math.abs(x) < 200) for (let i = 0; i < 8; i++) B.place(K.bamboo, spokes, cx, top + 0.12, cz, (i / 8) * Math.PI * 2 + k);
        if (straight) P.solid(cx - 0.12, s.y, cz - 0.12, cx + 0.12, top, cz + 0.12);
      }
      // a garland and a few flowers on the takht or chabutra, near the Dham
      if (Math.abs(x) < 70 && k % 2 === 0) {
        const yTop = s.y + (k % 3 === 0 ? 0.56 : 0.47);
        O.heap(cx + 0.4, yTop, cz, 0.12, 0.05, 8);
      }
    }
  }

  // ---- offerings on the steps near the Ganga Dwar: petals, marigold heaps, lotas, diyas at the water
  for (let i = 0; i < 220; i++) {
    const x = (rnd() - 0.5) * 80, o = rnd() * (WATER_O - 0.3);
    if (Math.abs(x) < 1.0) continue;
    O.add(rnd() < 0.2 ? 'bel' : 'petal', x, ghatY(o) + 0.003, Z0 + o, 1, undefined, rnd() * 6.3, 0.3);
  }
  const lota = lathe([[0, 0], [0.08, 0], [0.12, 0.06], [0.12, 0.12], [0.06, 0.2], [0.05, 0.24], [0.08, 0.27], [0, 0.27]], 16);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 40), o = WATER_O - 0.5 - rnd() * 4;
    B.place(K.brass, lota, x, ghatY(o), Z0 + o, rnd() * 6);
    if (i % 2) O.heap(x + 0.3, ghatY(o) + 0.002, Z0 + o, 0.1, 0.04, 6);
  }
  // little leaf-boat diyas floating off the steps, and lamps along the lowest dry step
  for (let i = 0; i < 40; i++) {
    const x = (rnd() - 0.5) * 60, z = Z0 + WATER_O + 0.6 + rnd() * 7;
    flames.points.push(new THREE.Vector3(x, WATER + 0.06, z));
    O.add('marigold', x + 0.06, WATER + 0.02, z, 0.9);
    O.add('bel', x - 0.05, WATER + 0.01, z + 0.03, 1.2, undefined, rnd() * 6.3, 0.2);
  }
  const dry = STEPS.filter((s) => s.y > WATER + 0.3).pop()!;
  for (let x = -38; x <= 38; x += 1.6) if (Math.abs(x) > 1.2) flames.points.push(new THREE.Vector3(x, dry.y + 0.04, Z0 + dry.o1 - 0.2));
}

// ------------------------------------------------------------------------------------------------ buildings

type Frame = { px: number; pz: number; tx: number; tz: number; nx: number; nz: number; ry: number };
const frameAt = (x: number, o: number): Frame => {
  const b = bank(x), [px, pz] = bankAt(x, o);
  return { px, pz, tx: b.tx, tz: b.tz, nx: b.nx, nz: b.nz, ry: b.ry };
};
const fp = (f: Frame, u: number, o: number): [number, number] => [f.px + f.tx * u + f.nx * o, f.pz + f.tz * u + f.nz * o];

/**
 * Palaces, havelis and temples on the bank beyond the Dham, both directions. Stone plinths and towers
 * go through the riverfront Merger (scanned sandstone); the painted upper storeys are vertex-coloured
 * boxes in the old city's facade-atlas material (one draw call).
 */
export function riverfrontTown(river: THREE.Group, B: Merger, K: KM, cityMat: THREE.Material, mergeAll: (p: THREE.BufferGeometry[]) => THREE.BufferGeometry) {
  const parts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  /** a vertex-coloured box in a building frame: u along the bank, o riverward (centre), y0 base, h height */
  const cbox = (f: Frame, u: number, o: number, w: number, d: number, y0: number, h: number, c: number | THREE.Color, variant: number, shade = true) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.deleteAttribute('uv');
    g.translate(0, h / 2, 0).rotateY(f.ry);
    const [x, z] = fp(f, u, o);
    g.translate(x, y0, z);
    const n = g.attributes.position.count, cc = new Float32Array(n * 3), pos = g.attributes.position;
    col.set(c);
    for (let i = 0; i < n; i++) {
      const k = shade ? 0.8 + 0.2 * Math.min(1, (pos.getY(i) - y0) / 5) : 1;
      cc[i * 3] = col.r * k; cc[i * 3 + 1] = col.g * k; cc[i * 3 + 2] = col.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    g.setAttribute('vv', new THREE.BufferAttribute(new Float32Array(n).fill(variant), 1));
    parts.push(g);
  };
  const stoneBox = (f: Frame, u: number, o: number, w: number, d: number, y0: number, h: number, mat: THREE.Material = K.ghat) => {
    const [x, z] = fp(f, u, o);
    B.box(mat, w, h, d, x, y0, z, false, f.ry);
  };
  const paints = [0xf0e2c8, 0xe9cfa0, 0xe2b48a, 0xd99a72, 0xf2e9d8, 0xe7c3b4, 0xd6c3a5, 0xc9a07a, 0xf3d79a, 0xb7c6c4, 0xe7b2b8];
  const cream = 0xf2e6d2;
  const tower = lathe([[1.9, 0], [1.75, 0.9], [1.7, 1.0], [1.7, 1.05], [1.75, 1.08], [1.6, 1.1], [0, 1.1]], 8);
  // (plain rekha towers without the urushringa clusters: at ≥ 140 m the clusters don't read and cost ~20k tris each)
  const temples = [nagaraSpire(1.6, 6.0, [], 4), nagaraSpire(2.2, 8.5, [], 5)];
  const tMats = [K.lime, new THREE.MeshStandardMaterial({ color: 0xc0512e, roughness: 0.9 }), K.spireStone, new THREE.MeshStandardMaterial({ color: 0xe8d9c4, roughness: 0.9 })];
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.95 });
  const soot = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 });
  const Y = GHAT.Y0;

  for (const sgn of [-1, 1]) {
    for (let a = GHAT.XS + 1; a < GHAT.XMAX; ) {
      const w = 14 + rnd() * 24;
      const x = sgn * (a + w / 2);
      const f = frameAt(x, 0);
      const type = rnd();
      const ax = Math.abs(x);
      // the cremation ground at Manikarnika (north): sooty platforms and stacks of wood instead of a palace front
      if (sgn > 0 && ax > 300 && ax < 360) {
        stoneBox(f, 0, -5, w, 10, Y, 1.6, soot);
        for (let i = 0; i < 6; i++) stoneBox(f, -w / 2 + 2 + i * (w - 4) / 5, 2 + (i % 2) * 2.5, 2.2, 1.6, ghatY(3), 1.2 + rnd() * 0.8, wood);
        cbox(f, 0, -16, w, 12, Y, 18 + rnd() * 6, 0xb8a890, 3);
        stoneBox(f, 0, -9, w * 0.4, 4, Y + 1.6, 9, K.ghat);
        a += w + 2;
        continue;
      }
      const plinthH = type < 0.45 ? 7 + rnd() * 5 : 3 + rnd() * 3;
      const d = 14 + rnd() * 6;
      // tall stone plinth (the ghat's retaining wall), with string courses and blind arches
      stoneBox(f, 0, -d / 2 - 0.3, w, d, Y, plinthH);
      for (const yy of [plinthH * 0.45, plinthH - 0.35]) stoneBox(f, 0, -0.15, w + 0.3, 0.5, Y + yy, 0.3, K.chunar);
      if (plinthH > 6 && ax < 420) {
        for (let u = -w / 2 + 2; u < w / 2 - 1.5; u += 3.2) {
          const [nx, nz] = fp(f, u, -0.28);
          B.place(K.recess, archPlateGeo(1.4, 1.8, 0.7, 5), nx, Y + plinthH * 0.45 + 0.5, nz, f.ry);
        }
      }
      if (type < 0.45) {
        // a palace: octagonal corner towers with chhatris, painted upper storeys with jharokhas
        for (const s of [-1, 1]) {
          const [tx, tz] = fp(f, s * (w / 2 - 1.4), -1.4);
          const th = plinthH + 8 + rnd() * 6;
          B.place(K.ghat, tower, tx, Y, tz, 0, [1, th / 1.1, 1]);
          B.place(K.chunar, chhatriGeo(1.5, 2.2), tx, Y + th, tz);
        }
        const h = 7 + rnd() * 10, c = paints[Math.floor(rnd() * paints.length)];
        cbox(f, 0, -d / 2 - 1, w - 5, d - 2, Y + plinthH, h, c, Math.floor(rnd() * 4));
        cbox(f, 0, -d / 2 - 1, w - 4.6, d - 1.6, Y + plinthH + h, 0.9, cream, 0, false);
        for (let u = -w / 2 + 4; u < w / 2 - 4; u += 4.5) {
          if (rnd() < 0.4) continue;
          cbox(f, u, 0.0, 2.0, 1.0, Y + plinthH + 2.6, 0.2, cream, 0, false);
          cbox(f, u, 0.0, 2.2, 1.1, Y + plinthH + 4.6, 0.16, cream, 0, false);
          B.place(K.chunar, JHAROKHA, ...fpY(f, u, 0.2, Y + plinthH + 4.76), f.ry);
        }
        if (rnd() < 0.6) B.place(K.chunar, chhatriGeo(2.0, 2.6), ...fpY(f, 0, -d / 2, Y + plinthH + h + 0.9), f.ry);
      } else if (type < 0.62) {
        // a ghat temple: a shikhara on a high platform, painted house behind
        const sp = temples[Math.floor(rnd() * 2)], m = tMats[Math.floor(rnd() * tMats.length)], hw = sp === temples[0] ? 1.6 : 2.2;
        const [tx, tz] = fp(f, (rnd() - 0.5) * (w - 8), -3.5);
        B.box(m, hw * 2.3, hw * 1.9, hw * 2.3, tx, Y + plinthH, tz, false, f.ry);
        B.place(m, sp.body, tx, Y + plinthH + hw * 1.9, tz, f.ry);
        B.place(K.gilt, kalashGeo(hw * 0.45), tx, Y + plinthH + hw * 1.9 + sp.topY, tz);
        cbox(f, 0, -d / 2 - 6, w, d - 6, Y + plinthH, 9 + rnd() * 9, paints[Math.floor(rnd() * paints.length)], Math.floor(rnd() * 4));
      } else {
        // havelis: tall narrow painted houses shoulder to shoulder
        let u = -w / 2;
        while (u < w / 2 - 3) {
          const hw = Math.min(w / 2 - u, 5 + rnd() * 6);
          const h = 12 + rnd() * 16;
          cbox(f, u + hw / 2, -d / 2 - 0.5, hw - 0.2, d - 1, Y + plinthH, h, paints[Math.floor(rnd() * paints.length)], Math.floor(rnd() * 4));
          cbox(f, u + hw / 2, -d / 2 - 0.5, hw, d - 0.8, Y + plinthH + h, 0.7, cream, 0, false);
          for (let yy = Y + plinthH + 3.2; yy < Y + plinthH + h - 2; yy += 3.2) cbox(f, u + hw / 2, 0.15, hw, 0.3, yy, 0.16, cream, 0, false);
          if (rnd() < 0.3) cbox(f, u + hw / 2, -d / 2, 1.3, 1.3, Y + plinthH + h + 0.7, 1.2, [0x2a2a2c, 0xd8d6d0, 0x3d6a92][Math.floor(rnd() * 3)], 0, false);
          u += hw;
        }
      }
      // the second row rising behind: the old city climbing away from the river
      for (let u = -w / 2; u < w / 2 - 2; u += 6 + rnd() * 4) {
        cbox(f, u + 3, -d - 6 - rnd() * 10, 6 + rnd() * 3, 9, Y, 16 + rnd() * 22, paints[Math.floor(rnd() * paints.length)], Math.floor(rnd() * 4));
      }
      // a dark lane (gali) climbing up between neighbours
      a += w + (rnd() < 0.4 ? 2.5 : 0.3);
    }
    // Dashashwamedh (south): the aarti chowkis, wooden platforms with lamp poles at the water
    if (sgn < 0) {
      for (let i = 0; i < 7; i++) {
        const x = -520 - i * 4.5, f = frameAt(x, WATER_O - 1.5);
        stoneBox(f, 0, 0, 3.2, 3.2, ghatY(WATER_O - 1.5), 0.6, K.door);
        stoneBox(f, 0, 0, 0.14, 0.14, ghatY(WATER_O - 1.5) + 0.6, 3.2, K.brass);
        B.place(K.brass, kalashGeo(0.35), ...fpY(f, 0, 0, ghatY(WATER_O - 1.5) + 3.8), 0);
      }
    }
  }
  const m = new THREE.Mesh(mergeAll(parts), cityMat);
  m.name = 'riverfront-town';
  m.castShadow = false;
  m.receiveShadow = true;
  river.add(m);
}
const fpY = (f: Frame, u: number, o: number, y: number): [number, number, number] => { const [x, z] = fp(f, u, o); return [x, y, z]; };
const JHAROKHA = onionDome(0.8, 12, 16);

// ------------------------------------------------------------------------------------------------ boats

/**
 * Wooden ghat boats, instanced: long narrow hulls (≈ 9.6 m) with raised pointed bow and stern, a painted
 * band along the gunwale (blue, green, red, white, yellow), thwarts, and on some a cloth canopy on four
 * posts. Moored side by side with their bows on the bottom steps along the bank, a few out on the river.
 */
export function ghatBoats(g: THREE.Group) {
  const L = 9.6, hl = L / 2;
  const shape = (geo: THREE.BufferGeometry, outer: number) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = Math.min(1, Math.abs(z) / hl);
      const narrow = Math.max(0.04, 1 - Math.pow(t, 2.4));
      const bottom = y < 0 ? 0.55 + 0.45 * (1 - t) : 1;
      p.setX(i, x * narrow * (y < 0 ? 0.72 : 1) * outer);
      p.setY(i, y * bottom + Math.pow(t, 3) * 0.75);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // an open hull: the top face is pressed down into a dish (the bilge), dark inside, with gunwales left standing
  const hullBox = new THREE.BoxGeometry(1.8, 0.72, L, 4, 2, 14);
  {
    const p = hullBox.attributes.position, nn = hullBox.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      if (nn.getY(i) > 0.9 && Math.abs(p.getX(i)) < 0.75 && Math.abs(p.getZ(i)) < hl * 0.92) p.setY(i, p.getY(i) - 0.42);
    }
  }
  const hull = shape(hullBox, 1);
  {
    // vertex shade: the inside of the hull is in its own shadow
    const p = hull.attributes.position, cc = new Float32Array(p.count * 3);
    hull.computeBoundingBox();
    for (let i = 0; i < p.count; i++) {
      const inside = hull.attributes.normal.getY(i) > 0.5 && p.getY(i) < 0.2 ? 0.42 : 1;
      cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = inside;
    }
    hull.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  }
  const band = shape(new THREE.BoxGeometry(1.8, 0.16, L * 0.995, 1, 1, 14).translate(0, 0.25, 0), 1.025);
  const thwarts = mergeGeometries([-2.6, -0.9, 0.9, 2.6].map((z) => new THREE.BoxGeometry(1.62, 0.05, 0.24).translate(0, 0.2, z)))!;
  const canopy = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[-0.7, -1.4], [0.7, -1.4], [-0.7, 1.4], [0.7, 1.4]]) parts.push(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5).translate(x, 1.05, z));
    const roof = new THREE.CylinderGeometry(0.85, 0.85, 3.2, 8, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.45, 1).translate(0, 1.8, 0);
    parts.push(roof.toNonIndexed());
    return mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }))!;
  })();
  const spots: { x: number; z: number; ry: number }[] = [];
  // moored along the bank in clusters of 3–7, bows on the steps
  for (let ax = -440; ax <= 440; ) {
    if (Math.abs(ax) < 9) { ax = 9; continue; }
    const n = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const x = ax + i * 2.1;
      const b = bank(x), [px, pz] = bankAt(x, WATER_O + hl - 1.2 + rnd() * 0.8);
      spots.push({ x: px, z: pz, ry: b.ry + (rnd() - 0.5) * 0.12 });
    }
    ax += n * 2.1 + 10 + rnd() * 30;
  }
  // a few out on the river, rowing along it
  for (let i = 0; i < 12; i++) spots.push({ x: -300 + rnd() * 600, z: 205 + rnd() * 160, ry: Math.PI / 2 + (rnd() - 0.5) * 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.85, vertexColors: true });
  const thwartWood = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.85 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  const n = spots.length;
  const hm = new THREE.InstancedMesh(hull, wood, n);
  const bm = new THREE.InstancedMesh(band, paint, n);
  const tm = new THREE.InstancedMesh(thwarts, thwartWood, n);
  const withCanopy = spots.filter(() => rnd() < 0.35);
  const cm = new THREE.InstancedMesh(canopy, cloth, Math.max(1, withCanopy.length));
  const bandCols = [0x2f6fa8, 0x2e8b57, 0xc0392b, 0xf2efe6, 0xe1b12c, 0x1f4e79, 0x8e44ad];
  const clothCols = [0xf2efe6, 0xe8721c, 0xc0392b, 0xf1c40f, 0x2f6fa8];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const y = GHAT.WATER - 0.12;
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.ry);
    m.compose(new THREE.Vector3(s.x, y, s.z), q, one);
    hm.setMatrixAt(i, m); bm.setMatrixAt(i, m); tm.setMatrixAt(i, m);
    c.set(0x6a4a30).multiplyScalar(0.75 + rnd() * 0.45);
    hm.setColorAt(i, c);
    bm.setColorAt(i, c.set(bandCols[Math.floor(rnd() * bandCols.length)]));
  });
  withCanopy.forEach((s, i) => {
    q.setFromAxisAngle(up, s.ry);
    cm.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, y, s.z), q, one));
    cm.setColorAt(i, c.set(clothCols[Math.floor(rnd() * clothCols.length)]));
  });
  cm.count = withCanopy.length;
  for (const im of [hm, bm, tm, cm]) { im.castShadow = false; im.receiveShadow = true; im.name = 'boats'; }
  g.add(hm, bm, tm, cm);
}

// ------------------------------------------------------------------------------------------------ far bank

/** Canvas silhouette of a broad tree (round crown on a short trunk), for the far bank's tree line. */
function treeCard() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  // a clump of two or three broad, flat-topped crowns on short trunks, ragged at the edge
  for (const [cx, w] of [[70, 60], [150, 74], [205, 46]] as const) {
    g.fillRect(cx - 3, 84, 6, 44);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      g.beginPath();
      g.arc(cx + Math.cos(a) * r * w, 66 + Math.sin(a) * r * 26 - (1 - r) * 10, 4 + rnd() * 9, 0, Math.PI * 2);
      g.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

/**
 * The far (east) bank: a flat pale sand bank a few hundred metres across the Ganga with a line of
 * trees along it. Pre-hazed colours and no scene fog, so it reads as a pale band at any distance.
 */
export function farBank(g: THREE.Group) {
  const Z = 640;
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xd8d0bf, fog: false });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(4000, 900).rotateX(-Math.PI / 2), sandMat);
  sand.position.set(0, GHAT.WATER + 1.6, Z + 450);
  g.add(sand);
  // the bank's gentle lip and a wet dark band at the waterline
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(4000, 12).rotateX(-Math.PI / 2 + 0.14), new THREE.MeshLambertMaterial({ color: 0xb0a896, fog: false }));
  lip.position.set(0, GHAT.WATER + 0.8, Z - 6);
  g.add(lip);
  // tree line: crossed alpha cards, instanced
  const card = mergeGeometries([0, Math.PI / 2].map((a) => new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0).rotateY(a)))!;
  const tm = new THREE.MeshBasicMaterial({ map: treeCard(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x7d8a74, fog: false });
  const N = 420;
  const im = new THREE.InstancedMesh(card, tm, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  // clumps and gaps, not a picket line: positions bunch along x, rows stagger in depth
  let x = -1900;
  for (let i = 0; i < N; i++) {
    x += rnd() < 0.12 ? 25 + rnd() * 50 : 3 + rnd() * 9;
    const z = Z + 60 + rnd() * 90, h = 8 + rnd() * 9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.8);
    m.compose(new THREE.Vector3(x, GHAT.WATER + 1.4, z), q, new THREE.Vector3(h * (1.0 + rnd() * 0.5), h, h * (1.0 + rnd() * 0.5)));
    im.setMatrixAt(i, m);
    im.setColorAt(i, c.setScalar(0.85 + rnd() * 0.25));
  }
  im.name = 'far-bank-trees';
  g.add(im);
}

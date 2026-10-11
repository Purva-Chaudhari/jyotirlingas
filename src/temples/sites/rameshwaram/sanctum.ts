import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { Batch } from './batch';
import type { RM } from './mats';
import { vimana, palette } from './gopuram';
import { Offerings, lingamGeo } from './offerings';
import { Garlands } from './garland';
import { PRAK1, GARBHA, MANDAPA, VISHWA, AMMAN } from './layout';
import { nearOnly } from './optimize';

/**
 * The first prakara: the Ramanatha garbhagriha under its two-tala vimana, the ardha and maha
 * mandapams (polished black pillars, brass lamps), the Kasi Viswanathar shrine to the north
 * (Vishwalingam) and, in its own enclosure to the south, the shrine of Parvathavardhini Amman.
 *
 * The two Jyotirlingas, as worshipped today:
 *  - Ramalingam (Ramanathaswamy), the lingam Sita shaped of sand: small (about 2 ft), set in a
 *    square Tamil avudaiyar with its spout to the north. In alankaram it wears a gold kavacham with
 *    a ribbed domed crown, under a five-hooded golden naga; heavy garlands of jasmine banded with
 *    red roses, green tulsi and marigold; a silver kanthi necklace; saffron silk round the pitha;
 *    tall brass kuthuvilakkus either side and three brass deepams before it.
 *  - Vishwalingam (Kasi Viswanathar), brought by Hanuman from Kailash and worshipped first: a
 *    black stone bana lingam on a silver-clad avudaiyar, vibhuti tripundra with a kumkum dot,
 *    a silver five-hooded naga, bel leaves, marigold and jasmine.
 */

const box = (B: Batch, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => B.box(m, w, h, d, x, y, z);

/** Square stepped Tamil avudaiyar (yoni-pitha), spout to +x. Returns its top height (relative). */
function avudaiyar(B: Batch, cover: THREE.Material, base: THREE.Material, w: number, x: number, y: number, z: number) {
  const L: [number, number, THREE.Material][] = [[1.12, 0.14, base], [1.0, 0.14, cover], [0.9, 0.08, cover], [0.8, 0.26, cover], [0.9, 0.07, cover], [0.98, 0.13, cover]];
  let yy = y;
  for (const [i, [k, h, m]] of L.entries()) {
    const hh = h * (w / 1.5);
    box(B, m, w * k, hh, w * k, x, yy, z);
    if (m === cover && i >= 2) {
      // moulded bands: a projecting roll at the foot of each upper tier
      box(B, cover, w * k + 0.024, 0.018, w * k + 0.024, x, yy, z);
    }
    if (i === L.length - 1) {
      // one repoussé border strip round the top tier: a row of embossed lotus bosses between two fillets
      const side = w * k, n = Math.round(side / 0.07);
      for (const f of [0.22, 0.78]) box(B, cover, side + 0.012, 0.008, side + 0.012, x, yy + hh * f, z);
      for (let e = 0; e < 4; e++) for (let j = 0; j < n; j++) {
        const u = -side / 2 + (j + 0.5) * (side / n);
        const g = new THREE.SphereGeometry(0.017, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.55).translate(u, yy + hh * 0.5, side / 2).rotateY((e * Math.PI) / 2);
        B.add(cover, g.translate(x, 0, z));
      }
    }
    yy += hh;
  }
  // the shallow basin rim
  B.lathe(cover, [[w * 0.3, 0], [w * 0.36, 0.0], [w * 0.36, 0.035]], x, yy, z, 24);
  // spout (gomukhi) to the north, with a rounded lip
  const sp = w * 0.42;
  box(B, cover, sp, w * 0.07, w * 0.2, x + w * 0.49 + sp / 2, yy - w * 0.1, z);
  B.add(cover, new THREE.CylinderGeometry(w * 0.1, w * 0.1, w * 0.07, 14).translate(x + w * 0.49 + sp, yy - w * 0.1 + w * 0.035, z));
  return yy;
}

/** A five-hooded naga rising behind a lingam: coils behind, necks fanning up, hoods leaning forward. */
function naga(B: Batch, m: THREE.Material, x: number, y0: number, z: number, top: number, s = 1) {
  const back = z - 0.24 * s;
  B.add(m, new THREE.CylinderGeometry(0.07 * s, 0.09 * s, top - y0, 10).translate(x, (y0 + top) / 2, back));
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.42;
    const hx = x + Math.sin(a) * 0.3 * s, hy = top + 0.1 * s + Math.cos(a) * 0.14 * s;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, top - 0.15 * s, back), new THREE.Vector3(x + Math.sin(a) * 0.18 * s, top, back - 0.02), new THREE.Vector3(hx, hy, back + 0.03 * s));
    B.add(m, new THREE.TubeGeometry(curve, 6, 0.04 * s, 6, false));
    // the spread hood, tilted forward over the crown, with a ridge
    const hood = new THREE.SphereGeometry(1, 12, 8).scale(0.1 * s, 0.14 * s, 0.035 * s).rotateX(0.55).rotateZ(-a * 0.7);
    B.add(m, hood.translate(hx, hy + 0.04 * s, back + 0.08 * s));
    B.add(m, new THREE.SphereGeometry(0.035 * s, 8, 6).scale(1, 0.8, 1.3).translate(hx + Math.sin(a) * 0.02 * s, hy + 0.13 * s, back + 0.16 * s));
  }
}

/** Brass kuthuvilakku: tall standing lamp with five wicks and a finial. Returns flame positions. */
function kuthuvilakku(B: Batch, R: RM, x: number, y: number, z: number, h = 1.45) {
  B.lathe(R.brass, [[0.0, 0], [0.24, 0], [0.26, 0.04], [0.16, 0.1], [0.06, 0.16], [0.05, h * 0.5], [0.08, h * 0.52], [0.04, h * 0.56], [0.04, h * 0.8],
    [0.2, h * 0.84], [0.24, h * 0.88], [0.2, h * 0.9], [0.05, h * 0.9], [0.05, h * 0.96], [0.08, h], [0.03, h * 1.08], [0, h * 1.12]], x, y, z, 16);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    pts.push(new THREE.Vector3(x + Math.cos(a) * 0.21, y + h * 0.9 + 0.04, z + Math.sin(a) * 0.21));
  }
  return pts;
}

/** the garlands of the shrines being built (flushed by buildSanctum) */
let GL: Garlands;

/**
 * A garland along a curve (see garland.ts): fine jasmine banded with red roses, tulsi or marigold.
 * `thick` and `s` set its girth: the Ramalingam's great garlands are about 10 cm thick.
 */
function garlandAlong(_O: Offerings, curve: THREE.Curve<THREE.Vector3>, kind: 'jasmineRose' | 'tulsi' | 'marigold', thick = 1, s = 1) {
  GL.add(curve, kind, Math.min(0.05, Math.max(0.02, 0.0115 * thick * s)));
}

/** The Ramalingam in alankaram. Returns flame positions and the lingam crown height. */
function ramalingam(B: Batch, R: RM, O: Offerings, x: number, y: number, z: number) {
  const top = avudaiyar(B, R.silver, R.graniteDark, 1.55, x, y, z);
  // saffron silk wrapped round the waist (kantha) of the avudaiyar, pleated, its fall hanging in front
  const pleated = (w: number, h: number, depth: number, n: number) => {
    const p = new THREE.PlaneGeometry(w, h, n, 2);
    const a = p.attributes.position;
    for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(a.getX(i) * (Math.PI * n / w)) * depth * (0.6 + 0.4 * (0.5 - a.getY(i) / h)));
    p.computeVertexNormals();
    return p;
  };
  const silkH = 0.3, ky = y + 0.37 + silkH / 2, kr = 0.66;
  // eight deep folds a side, a 3 cm gold zari border at top and hem
  for (let f = 0; f < 4; f++) {
    const rot = (g: THREE.BufferGeometry) => g.rotateY((f * Math.PI) / 2).translate(x, 0, z);
    B.add(R.cloth, rot(pleated(kr * 2, silkH, 0.03, 8).translate(0, ky, kr)));
    for (const by of [ky + silkH / 2 - 0.03, ky - silkH / 2]) B.add(R.gold, rot(new THREE.BoxGeometry(kr * 2 + 0.06, 0.03, 0.02).translate(0, by + 0.015, kr + 0.03)));
  }
  // the fall of the cloth in front, pleated, its hem and edges bordered in zari
  const fx = x - 0.2, fz = z + kr + 0.07, fh = 0.62;
  B.add(R.cloth, pleated(0.46, fh, 0.035, 5).translate(fx, y + 0.31, fz));
  B.add(R.gold, new THREE.BoxGeometry(0.48, 0.03, 0.03).translate(fx, y + 0.31 - fh / 2 + 0.015, fz));
  for (const sx of [-1, 1]) B.add(R.gold, new THREE.BoxGeometry(0.03, fh, 0.03).translate(fx + sx * 0.235, y + 0.31, fz));
  // the gold kavacham over the sand lingam: sheath, repoussé bands, front plate, ribbed domed crown
  const r = 0.25, kh = 0.42;
  B.lathe(R.gold, [[r * 1.08, 0], [r * 1.08, 0.05], [r, 0.07], [r * 0.9, kh], [r * 1.06, kh + 0.03], [r * 1.06, kh + 0.06]], x, top, z, 32);
  for (const yy of [0.09, 0.44]) B.add(R.gold, new THREE.TorusGeometry(r * (yy < 0.2 ? 0.985 : 0.91), 0.012, 6, 32).rotateX(Math.PI / 2).translate(x, top + yy, z));
  // the face plate of the alankaram (stylised, in low relief, the same gold): tripundra of three white
  // bands with the red dot, brows, almond eyes, the nose ridge and the curled moustache
  const rr = (t: number) => r * (1 - 0.1 * (t - 0.07) / (kh - 0.07));
  const onFace = (g: THREE.BufferGeometry, a: number, t: number, out = 0) => g.rotateY(a).translate(x + Math.sin(a) * (rr(t) + out), top + t, z + Math.cos(a) * (rr(t) + out));
  for (const t of [0.345, 0.37, 0.395]) {
    B.add(R.ash, new THREE.LatheGeometry([new THREE.Vector2(rr(t) + 0.004, -0.007), new THREE.Vector2(rr(t) + 0.004, 0.007)], 20, -0.85, 1.7).translate(x, top + t, z));
  }
  B.add(R.kumkum, onFace(new THREE.SphereGeometry(0.014, 10, 6).scale(1, 1.3, 0.5), 0, 0.37, 0.006));
  for (const sd of [-1, 1]) {
    // wide open almond eyes, dark pupils
    const a = sd * 0.3;
    B.add(R.gold, onFace(new THREE.SphereGeometry(1, 16, 8).scale(0.05, 0.022, 0.011), a, 0.262, 0.002));
    B.add(R.shade, onFace(new THREE.SphereGeometry(0.011, 10, 6).scale(1, 1, 0.45), a, 0.262, 0.01));
    // a straight raised brow line
    B.add(R.gold, onFace(new THREE.CylinderGeometry(0.005, 0.005, 0.085, 5).rotateZ(Math.PI / 2), a, 0.296, 0.003));
  }
  B.add(R.gold, onFace(new THREE.CylinderGeometry(0.012, 0.022, 0.075, 8).scale(1, 1, 0.7), 0, 0.212, 0.008));
  // the moustache: a thick straight bar under the nose whose ends turn up in curls
  for (const sd of [-1, 1]) {
    const pt = (u: number, t: number, o = 0) => { const a = sd * u; return new THREE.Vector3(x + Math.sin(a) * (rr(t) + o), top + t, z + Math.cos(a) * (rr(t) + o)); };
    const mc = new THREE.CatmullRomCurve3([pt(0.0, 0.168, 0.012), pt(0.16, 0.166, 0.012), pt(0.3, 0.168, 0.011), pt(0.4, 0.18, 0.01), pt(0.42, 0.198, 0.01), pt(0.37, 0.204, 0.01)]);
    B.add(R.gold, new THREE.TubeGeometry(mc, 14, 0.011, 6, false));
  }
  // the kireedam: a broad, tiered, ribbed gold crown (as in the alankaram photographs)
  const crown = new THREE.LatheGeometry([[r * 1.2, 0], [r * 1.38, 0.05], [r * 1.36, 0.12], [r * 1.28, 0.14], [r * 1.3, 0.24], [r * 1.18, 0.27],
    [r * 1.16, 0.36], [r * 1.0, 0.44], [r * 0.78, 0.52], [r * 0.5, 0.58], [r * 0.2, 0.61], [0.0, 0.62]]
    .map(([a, b]) => new THREE.Vector2(a, b)), 48);
  const cp = crown.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const a = Math.atan2(cp.getZ(i), cp.getX(i)), k = 1 + 0.06 * Math.pow(Math.abs(Math.cos(a * 8)), 2);
    cp.setX(i, cp.getX(i) * k); cp.setZ(i, cp.getZ(i) * k);
  }
  crown.computeVertexNormals();
  const cy = top + kh + 0.06;
  B.add(R.gold, crown.translate(x, cy, z));
  B.lathe(R.gold, [[0.05, 0], [0.07, 0.05], [0.03, 0.12], [0, 0.16]], x, cy + 0.6, z, 12);
  for (const [yy, rr] of [[0.135, 1.33], [0.26, 1.25]]) B.add(R.gold, new THREE.TorusGeometry(r * rr, 0.014, 6, 36).rotateX(Math.PI / 2).translate(x, cy + yy, z));
  // gem band on the crown (rubies) and the silver kanthi necklace on the sheath
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    B.add(R.kumkum, new THREE.SphereGeometry(0.018, 6, 4).translate(x + Math.cos(a) * r * 1.39, cy + 0.085, z + Math.sin(a) * r * 1.39));
  }
  // (hung in a U across the front of the sheath, under the moustache)
  for (let i = 0; i < 13; i++) {
    const a = -1.0 + (i / 12) * 2.0, t = 0.2 - Math.sin((i / 12) * Math.PI) * 0.11;
    B.add(R.silver, onFace(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 10).rotateX(Math.PI / 2), a, t, 0.008));
  }
  // the five-hooded golden naga
  naga(B, R.gold, x, top, z, cy + 0.75, 1.1);
  // garlands: the great jasmine garlands banded with roses fall from the hoods to the floor on both
  // sides; inside them swags of tulsi and marigold over the front of the avudaiyar
  const yTop = cy + 0.78;
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + s * 0.3, yTop, z - 0.1),
      new THREE.Vector3(x + s * 0.78, yTop - 0.35, z + 0.12),
      new THREE.Vector3(x + s * 0.98, top + 0.12, z + 0.42),
      new THREE.Vector3(x + s * 0.95, y + 0.45, z + 0.78),
      new THREE.Vector3(x + s * 0.9, y + 0.06, z + 0.9),
    ]);
    garlandAlong(O, c, 'jasmineRose', 4, 1.55);
  }
  for (const [wide, kind, thick, sag] of [[0.62, 'tulsi', 3, 0.2], [0.46, 'marigold', 2, 0.08]] as const) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - wide * 0.45, yTop - 0.12, z - 0.05),
      new THREE.Vector3(x - wide * 0.95, top + 0.3, z + 0.2),
      new THREE.Vector3(x - wide * 0.7, top - sag, z + 0.62),
      new THREE.Vector3(x, top - sag - 0.08, z + 0.72),
      new THREE.Vector3(x + wide * 0.7, top - sag, z + 0.62),
      new THREE.Vector3(x + wide * 0.95, top + 0.3, z + 0.2),
      new THREE.Vector3(x + wide * 0.45, yTop - 0.12, z - 0.05),
    ]);
    garlandAlong(O, c, kind, thick, 1.3);
  }
  // bel leaves, rose and jasmine heaped on the avudaiyar, vibhuti dusting
  O.scatter(x - 0.7, x + 0.7, z - 0.1, z + 0.7, top, 60, 0.4);
  O.heap(x + 0.5, top, z + 0.45, 0.16, 0.08, 25);
  O.heap(x - 0.5, top, z + 0.45, 0.16, 0.08, 25);
  // lamps: two kuthuvilakkus and three deepams on a low brass stand in front
  const flames: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) flames.push(...kuthuvilakku(B, R, x + sx * 1.25, y, z + 0.85, 1.5));
  box(B, R.brass, 1.3, 0.05, 0.3, x, y + 0.42, z + 1.25);
  for (const sx of [-0.45, 0, 0.45]) {
    box(B, R.brass, 0.05, 0.42, 0.05, x + sx, y, z + 1.25);
    B.lathe(R.brass, [[0.0, 0], [0.09, 0.0], [0.12, 0.05], [0.13, 0.08], [0.0, 0.08]], x + sx, y + 0.47, z + 1.25, 14);
    flames.push(new THREE.Vector3(x + sx + 0.06, y + 0.58, z + 1.25));
  }
  return { flames, crown: cy + 0.45 };
}

/** The Vishwalingam: black bana lingam, silver avudaiyar and naga, tripundra, flowers, lamps. */
function vishwalingam(B: Batch, R: RM, O: Offerings, x: number, y: number, z: number) {
  const top = avudaiyar(B, R.silver, R.graniteDark, 1.05, x, y, z);
  const r = 0.17, h = 0.5;
  B.add(R.lingamStone, lingamGeo(r, h, 0.03, 40).translate(x, top - 0.01, z));
  // tripundra: three bands of vibhuti on the face (east), a kumkum dot
  for (let i = 0; i < 3; i++) {
    const g = new THREE.LatheGeometry([new THREE.Vector2(r * 1.035, -0.012), new THREE.Vector2(r * 1.035, 0.012)], 24, -0.95, 1.9);
    B.add(R.ash, g.translate(x, top + h * (0.42 + i * 0.11), z));
  }
  B.add(R.kumkum, new THREE.SphereGeometry(0.022, 8, 6).scale(0.6, 1, 0.6).translate(x, top + h * 0.53, z + r * 1.04));
  naga(B, R.silver, x, top, z, top + h + 0.06, 0.9);
  O.ring(x, top + 0.03, z, r * 1.3, 1.1);
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.2, top + h + 0.2, z - 0.1), new THREE.Vector3(x - 0.42, top + 0.2, z + 0.15),
    new THREE.Vector3(x, top - 0.05, z + 0.45), new THREE.Vector3(x + 0.42, top + 0.2, z + 0.15), new THREE.Vector3(x + 0.2, top + h + 0.2, z - 0.1),
  ]);
  garlandAlong(O, c, 'jasmineRose', 2, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    O.add('bel', x + Math.cos(a) * r * 0.35, top + h + 0.004, z + Math.sin(a) * r * 0.35, 1.4, undefined, a, 0.6);
  }
  O.scatter(x - 0.45, x + 0.45, z - 0.1, z + 0.45, top, 30, 0.45);
  const flames: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) flames.push(...kuthuvilakku(B, R, x + sx * 0.85, y, z + 0.6, 1.2));
  return { flames };
}

export function buildSanctum(root: THREE.Group, R: RM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'sanctum';
  root.add(g);
  const B = new Batch();
  const O = new Offerings(19);
  GL = new Garlands();
  const G = R.granite, D = R.graniteDark;
  const { x0, x1, z0, z1, h } = PRAK1;
  const lights: THREE.PointLight[] = [];
  const lamp = (x: number, y: number, z: number, i: number, d: number, flicker = true) => {
    const l = new THREE.PointLight(0xffa04a, i, d, 2);
    l.position.set(x, y, z);
    g.add(l);
    lights.push(l);
    if (flicker) flames.lights.push(l);
    return l;
  };

  // ---------- first prakara walls, door, roof ----------
  const t = 1.2;
  const wall = (a: number, b: number, c: number, d: number) => { B.span(G, a, b, 0, h, c, d); P.solid(Math.min(a, b), 0, Math.min(c, d), Math.max(a, b), h, Math.max(c, d)); };
  wall(x0, x1, z0, z0 + t);
  wall(x0, x0 + t, z0, z1);
  wall(x1 - t, x1, z0, z1);
  wall(x0, -1.9, z1 - t, z1);
  wall(1.9, x1, z1 - t, z1);
  B.span(G, -1.9, 1.9, 4.4, h, z1 - t, z1);
  // the door frame, studded wooden leaves standing open
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) B.span(D, sx * (1.9 + k * 0.14), sx * (2.02 + k * 0.14), 0, 4.4 + k * 0.14, z1 + k * 0.05, z1 + 0.1 + k * 0.05);
    B.span(R.wood, sx * 1.85, sx * 1.7, 0.05, 4.3, z1 - t - 1.6, z1 - t);
  }
  // roof with openings for the two vimanas
  const vh = GARBHA.half, vx0 = VISHWA.x - VISHWA.half, vx1 = VISHWA.x + VISHWA.half, vz0 = VISHWA.z - VISHWA.half, vz1 = VISHWA.z + VISHWA.half;
  const roof = (a: number, b: number, c: number, d: number) => {
    B.span(R.roofRed, a, b, h, h + 0.6, c, d);
    B.span(D, a, b, h - 0.05, h, c, d);
  };
  roof(x0, x1, vh, z1);
  roof(x0, x1, z0, -vh);
  roof(x0, -vh, -vh, vh);
  roof(vh, vx0, -vh, vh);
  roof(vx1, x1, -vh, vh);
  roof(vx0, vx1, -vh, vz0);
  roof(vx0, vx1, vz1, vh);
  // floors: the prakara at 0.45, the mandapams at 0.9, the garbhagriha at 1.35
  const f1 = 0.45, f2 = 0.9, f3 = GARBHA.floor;
  B.span(R.floorIn, x0 + t, x1 - t, 0, f1, z0 + t, z1 - t);
  P.floor(g, x0 + t, x1 - t, z0 + t, z1 + 0.6, f1);
  // a step up at the door from the court
  B.span(R.floorIn, -1.9, 1.9, 0, f1, z1 - t, z1 + 0.6);

  // ---------- maha mandapam: black polished pillars, brass lamps; ardha mandapam ----------
  const { z0: mz0, z1: mz1, hw, ardhaZ, ardhaHW } = MANDAPA;
  B.span(R.floorIn, -hw, hw, f1, f2, ardhaZ, mz1);
  B.span(R.floorIn, -ardhaHW, ardhaHW, f1, f2, mz0, ardhaZ);
  P.floor(g, -hw, hw, ardhaZ, mz1, f2);
  P.floor(g, -ardhaHW, ardhaHW, mz0 - 0.2, ardhaZ, f2);
  for (const sx of [-1, 1]) for (const px of [2.7, 6.0]) for (let z = 14; z <= 31; z += 4.2) {
    const x = sx * px;
    B.box(D, 0.95, 0.35, 0.95, x, f2, z);
    B.lathe(D, [[0.36, 0], [0.36, 1.2], [0.42, 1.3], [0.36, 1.4], [0.33, 3.3], [0.42, 3.45], [0.5, 3.6], [0.36, 3.75]], x, f2 + 0.35, z, 8);
    B.box(D, 0.85, 0.3, 0.85, x, f2 + 4.1, z);
    B.box(D, 0.6, 0.3, 1.8, x, f2 + 4.4, z);
    for (const by of [0.55, 1.35, 3.35]) B.add(R.brass, new THREE.TorusGeometry(by > 3 ? 0.35 : 0.39, 0.035, 6, 14).rotateX(Math.PI / 2).translate(x, f2 + by, z));
    B.lathe(R.brass, [[0.47, 0], [0.47, 0.3], [0.44, 0.33]], x, f2 + 0.02, z, 4);
    P.solid(x - 0.48, 0, z - 0.48, x + 0.48, h, z + 0.48);
  }
  // hanging brass lamps down the mandapam
  for (let z = 15; z <= 32; z += 4.2) {
    B.add(R.brass, new THREE.CylinderGeometry(0.008, 0.008, h - 3.0, 3).translate(0, 3.0 + (h - 3.0) / 2, z));
    B.lathe(R.brass, [[0, 0], [0.18, 0.02], [0.22, 0.08], [0.0, 0.08]], 0, 2.9, z, 14);
    flames.points.push(new THREE.Vector3(0.12, 3.05, z), new THREE.Vector3(-0.12, 3.05, z));
  }
  // the darshan queue: a steel-pipe lane down the middle of the mandapam
  for (const sx of [-1, 1]) {
    const qx = sx * 1.3;
    for (let z = 13.5; z <= 27.5; z += 2) B.add(R.steel, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6).translate(qx, f2 + 0.5, z));
    for (const yy of [0.5, 0.98]) B.add(R.steel, new THREE.CylinderGeometry(0.025, 0.025, 14, 6).rotateX(Math.PI / 2).translate(qx, f2 + yy, 20.5));
    P.solid(qx - 0.06, 0, 13.4, qx + 0.06, 2, 27.6);
  }
  // tall brass standing lamps along the aisle, burning
  for (const sx of [-1, 1]) for (const z of [15.6, 21.8, 28.6]) {
    flames.points.push(...kuthuvilakku(B, R, sx * 2.05, f2, z, 1.75));
  }
  lamp(0, f2 + 3.2, 16, 5, 13);
  lamp(0, f2 + 3.2, 28, 5, 13);
  // ardha mandapam walls with the inner doorway
  for (const sx of [-1, 1]) {
    B.span(D, sx * ardhaHW, sx * (ardhaHW + 0.6), f2, h, mz0, ardhaZ);
    P.solid(Math.min(sx * ardhaHW, sx * (ardhaHW + 0.6)), 0, mz0, Math.max(sx * ardhaHW, sx * (ardhaHW + 0.6)), h, ardhaZ);
    B.span(D, sx * 1.15, sx * (ardhaHW + 0.6), f2, h, ardhaZ - 0.6, ardhaZ);
    P.solid(Math.min(sx * 1.15, sx * (ardhaHW + 0.6)), 0, ardhaZ - 0.6, Math.max(sx * 1.15, sx * (ardhaHW + 0.6)), h, ardhaZ);
    // brass-clad door frame
    B.span(R.brass, sx * 1.15, sx * 1.3, f2, f2 + 3.2, ardhaZ - 0.02, ardhaZ + 0.06);
  }
  B.span(D, -1.15, 1.15, f2 + 3.2, h, ardhaZ - 0.6, ardhaZ);
  B.span(R.brass, -1.3, 1.3, f2 + 3.2, f2 + 3.35, ardhaZ - 0.02, ardhaZ + 0.06);
  // the gold-clad door frame with a tiruvachi arch of oil lamps over it
  for (const sx of [-1, 1]) B.span(R.gold, sx * 1.3, sx * 1.62, f2, f2 + 3.5, ardhaZ + 0.02, ardhaZ + 0.14);
  B.span(R.gold, -1.62, 1.62, f2 + 3.35, f2 + 3.62, ardhaZ + 0.02, ardhaZ + 0.14);
  B.add(R.gold, new THREE.TorusGeometry(1.45, 0.06, 6, 28, Math.PI).translate(0, f2 + 3.62, ardhaZ + 0.1));
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    const p = new THREE.Vector3(Math.cos(a) * 1.45, f2 + 3.62 + Math.sin(a) * 1.45, ardhaZ + 0.18);
    B.lathe(R.brass, [[0, 0], [0.05, 0.0], [0.06, 0.03], [0, 0.03]], p.x, p.y - 0.02, p.z, 8);
    flames.points.push(new THREE.Vector3(p.x, p.y + 0.04, p.z));
  }
  for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) {
    const y = f2 + 0.4 + k * 0.62;
    B.lathe(R.brass, [[0, 0], [0.05, 0.0], [0.06, 0.03], [0, 0.03]], sx * 1.46, y, ardhaZ + 0.2, 8);
    flames.points.push(new THREE.Vector3(sx * 1.46, y + 0.06, ardhaZ + 0.2));
  }
  lamp(0, f2 + 3.0, ardhaZ + 1.2, 4, 7);

  // ---------- the Ramanatha garbhagriha and vimana ----------
  // the shrine vimanas are painted yellow-gold like the gopurams (2023 aerial)
  const vimPal = palette(0xf0d24a, [0xf0d24a, 0xf2dc5a, 0xe8c840, 0xf8eebc], 0.74);
  const gh = vimana(B, R, { x: 0, z: 0, ry: 0, half: vh, wallH: h + 0.2, talas: 2, dome: 'octagon', pal: vimPal, kalashMat: R.goldOut, seed: 5, hollow: { inner: GARBHA.inner, doorW: 1.5, doorH: 2.7, innerMat: D } });
  void gh;
  // colliders for the vimana walls (leaving the door passage)
  P.solid(-vh, 0, -vh, vh, h, -GARBHA.inner);
  for (const sx of [-1, 1]) {
    P.solid(Math.min(sx * GARBHA.inner, sx * vh), 0, -vh, Math.max(sx * GARBHA.inner, sx * vh), h, vh);
    P.solid(Math.min(sx * 0.75, sx * vh), 0, GARBHA.inner, Math.max(sx * 0.75, sx * vh), h, vh);
  }
  // the door passage floor (devotees may step to the brass rail at the inner threshold)
  P.floor(g, -0.75, 0.75, GARBHA.rail - 0.1, vh + 0.05, f3);
  P.floor(g, -GARBHA.inner, GARBHA.inner, -GARBHA.inner, GARBHA.inner, f3);
  B.span(R.floorIn, -0.75, 0.75, f2, f3, GARBHA.inner, vh);
  // the brass railing
  for (const sx of [-0.7, -0.35, 0, 0.35, 0.7]) B.box(R.brass, 0.05, 0.85, 0.05, sx, f3, GARBHA.rail - 0.05);
  B.span(R.brass, -0.72, 0.72, f3 + 0.85, f3 + 0.92, GARBHA.rail - 0.09, GARBHA.rail - 0.01);
  P.solid(-0.75, 0, GARBHA.rail - 0.4, 0.75, 3, GARBHA.rail - 0.08);
  const rl = ramalingam(B, R, O, 0, f3, 0);
  flames.points.push(...rl.flames);
  lamp(0, f3 + 1.9, 1.2, 4.5, 4.5);
  lamp(0, f3 + 2.4, -0.6, 2.2, 3.5, false);
  lamp(0, f2 + 2.6, 7.5, 3.0, 8);

  // ---------- Kasi Viswanathar (Vishwalingam) shrine to the north ----------
  vimana(B, R, { x: VISHWA.x, z: VISHWA.z, ry: 0, half: VISHWA.half, wallH: h + 0.2, talas: 1, dome: 'octagon', pal: vimPal, kalashMat: R.goldOut, seed: 6, hollow: { inner: VISHWA.inner, doorW: 1.1, doorH: 2.2, innerMat: D } });
  const vx = VISHWA.x, vz = VISHWA.z, vhh = VISHWA.half, vin = VISHWA.inner;
  P.solid(vx - vhh, 0, vz - vhh, vx + vhh, h, vz - vin);
  for (const sx of [-1, 1]) {
    P.solid(Math.min(vx + sx * vin, vx + sx * vhh), 0, vz - vhh, Math.max(vx + sx * vin, vx + sx * vhh), h, vz + vhh);
    P.solid(Math.min(vx + sx * 0.55, vx + sx * vhh), 0, vz + vin, Math.max(vx + sx * 0.55, vx + sx * vhh), h, vz + vhh);
  }
  // its ardha mandapam, open-fronted, at the mandapam level
  B.span(R.floorIn, vx - 2.2, vx + 2.2, f1, f2, vz + vhh, vz + vhh + 3.6);
  P.floor(g, vx - 2.2, vx + 2.2, vz + vhh - 0.1, vz + vhh + 3.6, f2);
  P.floor(g, vx - 0.55, vx + 0.55, vz + vin + 0.35, vz + vhh, f3);
  P.floor(g, vx - vin, vx + vin, vz - vin, vz + vin, f3);
  B.span(R.floorIn, vx - 0.55, vx + 0.55, f2, f3, vz + vin, vz + vhh);
  for (const sx of [-0.5, 0, 0.5]) B.box(R.brass, 0.04, 0.8, 0.04, vx + sx, f3, vz + vin + 0.3);
  B.span(R.brass, vx - 0.52, vx + 0.52, f3 + 0.8, f3 + 0.86, vz + vin + 0.27, vz + vin + 0.33);
  P.solid(vx - 0.55, 0, vz + vin + 0.1, vx + 0.55, 3, vz + vin + 0.33);
  for (const sx of [-1, 1]) {
    B.box(D, 0.6, h - f2, 0.6, vx + sx * 1.9, f2, vz + vhh + 3.2);
    P.solid(vx + sx * 1.9 - 0.3, 0, vz + vhh + 2.9, vx + sx * 1.9 + 0.3, h, vz + vhh + 3.5);
  }
  const vl = vishwalingam(B, R, O, vx, f3, vz);
  flames.points.push(...vl.flames);
  lamp(vx, f3 + 1.7, vz + 0.9, 2.6, 3.5);

  // ---------- Parvathavardhini Amman, in her own enclosure to the south ----------
  const A = AMMAN, aw = 5.6;
  const aWall = (a: number, b: number, c: number, d: number) => { B.span(G, a, b, 0, aw, c, d); P.solid(Math.min(a, b), 0, Math.min(c, d), Math.max(a, b), aw, Math.max(c, d)); };
  const adx = -33;
  aWall(A.x0, A.x1, A.z0, A.z0 + 1);
  aWall(A.x0, A.x0 + 1, A.z0, A.z1);
  aWall(A.x1 - 1, A.x1, A.z0, A.z1);
  aWall(A.x0, adx - 1.7, A.z1 - 1, A.z1);
  aWall(adx + 1.7, A.x1, A.z1 - 1, A.z1);
  B.span(G, adx - 1.7, adx + 1.7, 4.0, aw, A.z1 - 1, A.z1);
  const ah = A.half;
  const aroof = (a: number, b: number, c: number, d: number) => { B.span(R.roofRed, a, b, aw, aw + 0.6, c, d); B.span(D, a, b, aw - 0.05, aw, c, d); };
  aroof(A.x0, A.x1, A.z + ah, A.z1);
  aroof(A.x0, A.x1, A.z0, A.z - ah);
  aroof(A.x0, A.x - ah, A.z - ah, A.z + ah);
  aroof(A.x + ah, A.x1, A.z - ah, A.z + ah);
  B.span(R.floorIn, A.x0 + 1, A.x1 - 1, 0, f1, A.z0 + 1, A.z1 - 1);
  P.floor(g, A.x0 + 1, A.x1 - 1, A.z0 + 1, A.z1 + 0.3, f1);
  const ammanPal = palette(0xf2d650, [0xf2d650, 0xf2dc5a, 0xe8c840, 0xf8eebc, 0xe8a0a0], 0.74);
  vimana(B, R, { x: A.x, z: A.z, ry: 0, half: ah, wallH: aw + 0.2, talas: 2, dome: 'square', pal: ammanPal, kalashMat: R.goldOut, seed: 8, hollow: { inner: A.inner, doorW: 1.3, doorH: 2.5, innerMat: D } });
  P.solid(A.x - ah, 0, A.z - ah, A.x + ah, aw, A.z - A.inner);
  for (const sx of [-1, 1]) {
    P.solid(Math.min(A.x + sx * A.inner, A.x + sx * ah), 0, A.z - ah, Math.max(A.x + sx * A.inner, A.x + sx * ah), aw, A.z + ah);
    P.solid(Math.min(A.x + sx * 0.65, A.x + sx * ah), 0, A.z + A.inner, Math.max(A.x + sx * 0.65, A.x + sx * ah), aw, A.z + ah);
  }
  // her mandapam: two rows of pillars, the floor raised to 0.9
  B.span(R.floorIn, A.x - 5, A.x + 5, f1, f2, A.z + ah, A.z1 - 3);
  P.floor(g, A.x - 5, A.x + 5, A.z + ah - 0.2, A.z1 - 3, f2);
  for (const sx of [-1, 1]) for (let z = A.z + ah + 2.5; z < A.z1 - 3; z += 4.2) {
    const x = A.x + sx * 4.2;
    B.box(D, 0.85, 0.3, 0.85, x, f2, z);
    B.lathe(D, [[0.33, 0], [0.33, 1.1], [0.4, 1.2], [0.33, 1.3], [0.3, 3.0], [0.4, 3.15], [0.33, 3.3]], x, f2 + 0.3, z, 8);
    B.box(D, 0.75, 0.3, 0.75, x, f2 + 3.6, z);
    B.box(D, 0.55, 0.3, 1.6, x, f2 + 3.9, z);
    P.solid(x - 0.45, 0, z - 0.45, x + 0.45, aw, z + 0.45);
  }
  // inside her garbhagriha: a silver pedestal, the image draped in red silk with a gold crown and prabhavali,
  // garlands; seen through the doorway in lamplight (no features are modelled)
  const ax = A.x, az = A.z, ay = f3;
  B.span(R.silver, ax - 0.45, ax + 0.45, ay, ay + 0.3, az - 0.45, az + 0.45);
  // a red silk sari falling to the pedestal, the gold kavacham above it (shoulders and arms as one form)
  B.lathe(R.redPaint, [[0.3, 0], [0.33, 0.1], [0.25, 0.42], [0.2, 0.48], [0.0, 0.48]], ax, ay + 0.3, az, 20);
  B.lathe(R.gold, [[0.19, 0], [0.17, 0.08], [0.15, 0.18], [0.2, 0.26], [0.22, 0.3], [0.1, 0.36], [0.06, 0.4], [0.0, 0.4]], ax, ay + 0.76, az, 20);
  for (const sx of [-1, 1]) B.add(R.gold, new THREE.CylinderGeometry(0.035, 0.03, 0.3, 8).rotateZ(sx * 0.35).translate(ax + sx * 0.2, ay + 0.92, az + 0.04));
  B.lathe(R.gold, [[0.1, 0], [0.11, 0.08], [0.08, 0.16], [0.03, 0.24], [0, 0.27]], ax, ay + 1.0, az, 16);
  B.add(R.gold, new THREE.SphereGeometry(0.085, 12, 8).translate(ax, ay + 0.98, az));
  B.add(R.gold, new THREE.TorusGeometry(0.62, 0.05, 6, 24, Math.PI).translate(ax, ay + 0.75, az - 0.25));
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    B.add(R.gold, new THREE.ConeGeometry(0.04, 0.14, 6).rotateZ(a - Math.PI / 2).translate(ax + Math.cos(a) * 0.7, ay + 0.75 + Math.sin(a) * 0.7, az - 0.25));
  }
  const ag = new THREE.CatmullRomCurve3([
    new THREE.Vector3(ax - 0.14, ay + 1.0, az + 0.05), new THREE.Vector3(ax - 0.32, ay + 0.6, az + 0.18),
    new THREE.Vector3(ax, ay + 0.4, az + 0.36), new THREE.Vector3(ax + 0.32, ay + 0.6, az + 0.18), new THREE.Vector3(ax + 0.14, ay + 1.0, az + 0.05),
  ]);
  garlandAlong(O, ag, 'jasmineRose', 2, 1);
  for (const sx of [-1, 1]) flames.points.push(...kuthuvilakku(B, R, ax + sx * 0.95, ay, az + 0.7, 1.2));
  P.floor(g, ax - 0.65, ax + 0.65, az + A.inner + 0.3, az + ah, f3);
  B.span(R.floorIn, ax - 0.65, ax + 0.65, f2, f3, az + A.inner, az + ah);
  for (const sx of [-0.6, 0, 0.6]) B.box(R.brass, 0.04, 0.8, 0.04, ax + sx, f3, az + A.inner + 0.25);
  B.span(R.brass, ax - 0.62, ax + 0.62, f3 + 0.8, f3 + 0.86, az + A.inner + 0.22, az + A.inner + 0.28);
  P.solid(ax - 0.65, 0, az + A.inner + 0.05, ax + 0.65, 3, az + A.inner + 0.28);
  lamp(ax, ay + 1.6, az + 0.9, 2.6, 3.5);
  lamp(ax, 3.6, (A.z + ah + A.z1) / 2, 4.5, 16, false);
  lamp(0, 4.6, 22, 5.5, 18, false);

  B.flush(g, true, 'sanctum');
  O.flush(g);
  // the garlands (and their thousands of buds) are drawn only once you are in the first prakara
  const gl = new THREE.Group();
  g.add(gl);
  GL.flush(gl);
  nearOnly(g, gl, (p) => (p.x > PRAK1.x0 - 2 && p.x < PRAK1.x1 + 2 && p.z > PRAK1.z0 - 2 && p.z < PRAK1.z1 + 2) ||
    (p.x > AMMAN.x0 && p.x < AMMAN.x1 && p.z > AMMAN.z0 && p.z < AMMAN.z1));
  return { group: g, lights, ramaCrown: rl.crown };
}

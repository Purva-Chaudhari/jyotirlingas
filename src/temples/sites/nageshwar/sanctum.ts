import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { Batch, Instances, mergeParts } from './batch';
import { textPanel, type NM } from './mats';
import { Offerings, Strands, ropeGeo, toran, marigoldMaterial } from './offerings';
import { GARBHA, PL, SF, STAIR } from './temple';
import { kalashGeo } from './shikhara';

/**
 * The descent and the garbhagriha.
 *
 * At Nageshwar the sanctum was left at its old level when the temple was rebuilt: pilgrims go down a
 * short flight from the hall (here 7 steps, 1.2 m) through the antarala doorway into a small square
 * chamber. In its centre, in a silver jalahari, is the Jyotirlinga of Dwarka shila — a low, rounded,
 * three-lobed form (likened to a three-faced rudraksha) of dark polished stone with small pale chakra
 * marks — beneath a silver Nag whose body coils round the base and whose five hoods spread over the
 * linga. Behind it, in a silver-framed niche on the east wall, is Parvati as Nageshwari (draped in a red
 * chunri and garlands — rendered without features). Brass deepstambhs and an akhand diya light the room.
 */

const G = GARBHA;
/** the linga stands a little west of centre: the back of the room is taken by the step with Parvati's shrine */
const LX = G.cx - 0.45, LZ = 0.15;

/** tri-lobed lingam (tri-mukhi rudraksha form): radius r, visible height h, base y=0 */
export function lingamGeo(r: number, h: number) {
  const prof: [number, number][] = [];
  const dome = h * 0.62, shaft = h - dome;
  prof.push([r * 1.03, 0]);
  for (let i = 1; i <= 4; i++) prof.push([r * (1.03 - 0.02 * i / 4), (shaft * i) / 4]);
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * Math.PI / 2;
    prof.push([r * Math.cos(a) * (1 - 0.04 * Math.sin(a)), shaft + Math.sin(a) * dome]);
  }
  prof[prof.length - 1][0] = 0.0005;
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    // three lobes with soft grooves between, fading out toward the crown
    const fade = 1 - Math.pow(Math.min(1, y / h), 3) * 0.7;
    const k = 1 + fade * (0.08 * Math.cos(a * 3) - 0.03 * Math.pow(Math.abs(Math.sin(a * 1.5)), 8) + 0.012 * Math.sin(a * 7 + y * 30));
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The yoni (jalahari) as at Nageshwar: a large flat outline laid nearly flush with the floor, a round basin
 * with a spout running out to −z (north). Returns the slab (stone) and its raised silver rim, in local
 * coordinates with the basin centre at the origin, top at y = h.
 */
function yoniGeo(R: number, spout: number, h: number) {
  const outline = (r: number, sp: number) => {
    const s = new THREE.Shape();
    const N = 48;
    // circle from the spout's left shoulder round the back to its right shoulder, then out along the spout
    const a0 = -Math.PI / 2 + 0.55, a1 = -Math.PI / 2 - 0.55 + Math.PI * 2;
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * (i / N);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    // the spout (shape y = world −z after rotation), tapering to a rounded tip
    const sx = Math.sin(0.55) * r;
    s.quadraticCurveTo(-sx * 0.75, -r - sp * 0.5, -r * 0.16, -r - sp);
    s.quadraticCurveTo(0, -r - sp - r * 0.12, r * 0.16, -r - sp);
    s.quadraticCurveTo(sx * 0.75, -r - sp * 0.5, Math.cos(a0) * r, Math.sin(a0) * r);
    return s;
  };
  const outer = outline(R, spout);
  const inner = outline(R - 0.07, spout - 0.05);
  const slab = new THREE.ExtrudeGeometry(outer, { depth: h, bevelEnabled: false, curveSegments: 24 });
  slab.rotateX(-Math.PI / 2).rotateY(Math.PI);
  // the silver rim: outer minus inner, standing 2 cm proud of the slab
  const ring = outer.clone();
  ring.holes.push(new THREE.Path(inner.getPoints(48)));
  const rim = new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 24 });
  rim.rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, h, 0);
  // shape (x, y) → world (−x, +y as z): the spout (shape −y) points north (−z)
  return { slab, rim, inner: (r: number) => outline(r, spout * (r / R)) };
}

/** the silver Nag: body tube (coil + rising neck) and five hoods spread over the linga */
function nagGeo(yTop: number, coilR = 0.24) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = Math.PI * 0.75 + t * Math.PI * 2.6;
    pts.push(new THREE.Vector3(Math.cos(a) * coilR * (1 - 0.06 * t), 0.035 + t * 0.06, Math.sin(a) * coilR * (1 - 0.06 * t)));
  }
  const last = pts[pts.length - 1];
  // the neck rises behind (+x), arches up and over toward the front
  const rise = [
    new THREE.Vector3(0.27, 0.16, last.z * 0.4),
    new THREE.Vector3(0.29, yTop * 0.6, 0),
    new THREE.Vector3(0.24, yTop * 0.95, 0),
    new THREE.Vector3(0.13, yTop + 0.16, 0),
    new THREE.Vector3(0.06, yTop + 0.22, 0),
  ];
  const curve = new THREE.CatmullRomCurve3([...pts, ...rise]);
  const tubeR = (u: number) => 0.016 + 0.015 * Math.min(1, u * 1.4) * (1 - Math.max(0, u - 0.9) * 2);
  const tube = new THREE.TubeGeometry(curve, 160, 1, 10, false);
  // taper the tube: scale each ring about its centre
  const p = tube.attributes.position;
  const segs = 161, radial = 11;
  for (let i = 0; i < segs; i++) {
    const u = i / (segs - 1);
    const c = curve.getPointAt(u);
    const r = i === 0 ? 0.004 : tubeR(u);
    for (let j = 0; j < radial; j++) {
      const k = i * radial + j;
      const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  tube.computeVertexNormals();
  // scales: emboss rings along the body
  const hoods: THREE.BufferGeometry[] = [tube];
  const hc = new THREE.Vector3(0.03, yTop + 0.29, 0);
  for (const [k, ang] of [[0, 0], [1, 0.48], [-1, -0.48], [2, 0.95], [-2, -0.95]] as const) {
    const big = k === 0 ? 1 : Math.abs(k) === 1 ? 0.92 : 0.82;
    const hood = new THREE.SphereGeometry(1, 20, 14);
    // teardrop: wider in the upper half
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);
      const w = 1 + 0.25 * y;
      hp.setZ(i, hp.getZ(i) * w);
    }
    hood.scale(0.028, 0.17 * big, 0.11 * big);
    // hollow look: a slight dish facing forward (−x)
    for (let i = 0; i < hp.count; i++) hp.setX(i, hp.getX(i) + (hp.getZ(i) ** 2) * 1.6);
    const head = new THREE.SphereGeometry(1, 14, 10).scale(0.055, 0.032, 0.04).translate(-0.035, 0.125 * big, 0);
    const piece = mergeParts([hood, head]);
    piece.translate(0, 0.07, 0);
    // spread as a fan ~0.35 m across: each hood fanned out sideways, tilted a little outward
    piece.rotateX(ang * 0.45);
    piece.translate(hc.x + Math.abs(k) * 0.025, hc.y - Math.abs(k) * Math.abs(k) * 0.02, hc.z + k * 0.075);
    hoods.push(piece);
  }
  // spectacle marks and ribs on the central hood are left to the repoussé normal of the silver
  return mergeParts(hoods);
}

/** brass deepstambh: tiered lamp stand with diya cups; pushes flame positions */
function deepstambh(B: Batch, K: NM, flames: THREE.Vector3[], x: number, y: number, z: number, h: number, tiers: number) {
  B.lathe(K.brass, [[0.2, 0], [0.22, 0.04], [0.12, 0.08], [0.05, 0.14], [0.035, h], [0.001, h + 0.03]], x, y, z, 18);
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / (tiers + 0.5), yy = y + 0.2 + t * (h - 0.25);
    const r = 0.26 * (1 - t * 0.55);
    B.lathe(K.brass, [[0.03, 0], [r, 0.02], [r * 1.05, 0.045], [r, 0.05], [0.03, 0.04]], x, yy, z, 24);
    const n = Math.max(4, Math.round(r * 30));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      flames.push(new THREE.Vector3(x + Math.cos(a) * r * 0.85, yy + 0.09, z + Math.sin(a) * r * 0.85));
    }
  }
  flames.push(new THREE.Vector3(x, y + h + 0.1, z));
}

export interface SanctumOut {
  group: THREE.Group;
  lights: THREE.PointLight[];
  flames: THREE.Vector3[];
}

export function buildSanctum(root: THREE.Object3D, K: NM, P: Physics, env: THREE.Texture): SanctumOut {
  const group = new THREE.Group();
  group.name = 'nageshwar-garbhagriha';
  root.add(group);
  const B = new Batch();
  const O = new Offerings(17);
  // marigold ropes lit by the dark lamp-lit room (not the bright sky), so the colours stay deep
  // the curtain ropes take a neutral white environment (not the warm lamp one) so the yellows stay lemon
  const rope = marigoldMaterial(0xffffff, K.roomEnv);
  // a faint lemon (not orange) glow keeps the strands saturated rather than khaki under the lamps
  rope.emissive.set(0xffc800); rope.emissiveIntensity = 0.07;
  rope.envMapIntensity = 0.55;
  // the stair-head strands are lit by the bright hall: no glow, so they stay deep
  const ropeHall = marigoldMaterial(0xffffff, env);
  ropeHall.emissiveIntensity = 0;
  const ST = new Strands(1.0, 0.032, ropeHall);
  const STL = new Strands(3.2, 0.033, rope);
  const PUFF = new Strands(0.16, 0.07, ropeHall); void PUFF;
  const ropeY = marigoldMaterial(0xffc000, env), ropeO = marigoldMaterial(0xff5200, env);
  ropeY.emissive.set(0xffc400); ropeY.emissiveIntensity = 0.38; ropeY.roughness = 1; ropeO.roughness = 1; ropeO.emissive.set(0xff5a00); ropeO.emissiveIntensity = 0.08;
  const PUFFY = new Strands(0.14, 0.06, ropeY);
  for (const m of [ropeY, ropeO]) { m.envMap = K.roomEnv; m.envMapIntensity = 0.3; }
  // deep base colours: AgX tone mapping pales bright warm colours toward cream
  const YEL = [0xffc800, 0xffd200, 0xffbf00], ORA = [0xff7a00, 0xff6e00, 0xf06800];
  const pick = (a: number[], i: number) => a[i % a.length];
  const flames: THREE.Vector3[] = [];
  const lights: THREE.PointLight[] = [];

  // ---------- the stair: 7 risers from the hall floor down to the sanctum floor ----------
  const n = 7, rise = (PL - SF) / n, tread = (STAIR.bot - STAIR.top) / n;
  for (let i = 0; i < n; i++) {
    const x0 = STAIR.top + i * tread;
    const yTop = PL - rise * (i + 1);
    B.span(K.marbleIn, x0, x0 + tread + 0.02, SF - 0.3, yTop, -STAIR.hw, STAIR.hw);
    B.span(K.chrome, x0 - 0.005, x0 + 0.03, yTop - 0.02, yTop + 0.004, -STAIR.hw, STAIR.hw);
    P.floor(group, x0, x0 + tread, -STAIR.hw, STAIR.hw, yTop);
  }
  // stairwell walls (below the hall floor) and polished steel railings with ball finials above it, hung with garlands
  for (const s of [-1, 1]) {
    B.span(K.marbleIn, STAIR.top - 0.02, G.x0, SF - 0.3, PL - 0.02, s * STAIR.hw, s * (STAIR.hw + 0.25));
    P.solid(STAIR.top - 0.3, SF - 0.3, s > 0 ? STAIR.hw : -STAIR.hw - 0.3, G.x0, PL + 1.0, s > 0 ? STAIR.hw + 0.3 : -STAIR.hw);
    const z = s * (STAIR.hw + 0.12);
    B.lathe(K.chrome, [[0.03, 0], [0.03, 0.04]], 0, 0, 0, 6); // (keeps the material slot ordered)
    const rail = new THREE.CylinderGeometry(0.025, 0.025, G.x0 - STAIR.top + 0.6, 10).rotateZ(Math.PI / 2);
    for (const y of [PL + 0.5, PL + 1.0]) B.place(K.chrome, rail, (STAIR.top - 0.6 + G.x0) / 2, y, z);
    for (const x of [STAIR.top - 0.6, STAIR.top + 0.1, (STAIR.top + G.x0) / 2 + 0.1, G.x0 - 0.05]) {
      B.lathe(K.chrome, [[0.035, 0], [0.03, 0.04], [0.025, 1.0], [0.001, 1.0]], x, PL, z, 12);
      B.place(K.chrome, new THREE.SphereGeometry(0.06, 14, 10), x, PL + 1.06, z);
    }
    O.strand(new THREE.Vector3(STAIR.top - 0.6, PL + 1.0, z + s * 0.04), new THREE.Vector3(G.x0 - 0.05, PL + 1.0, z + s * 0.04), 0.25, 1.1);
    // dense marigold strands hung from the top rail, orange with green leaf strings between
    let k = 0;
    for (let x = STAIR.top - 0.55; x < G.x0 - 0.05; x += 0.09, k++) ST.add(x, PL + 1.02, z + s * 0.045, 0.92 + (k % 3) * 0.04, k % 2 ? 0x1f4a14 : pick(ORA, k), (Math.random() - 0.5) * 0.06);
    // handrail down the stair along the side walls
    const a = new THREE.Vector3(STAIR.top, PL + 0.9, s * (STAIR.hw - 0.06)), b = new THREE.Vector3(STAIR.bot, SF + 0.9, s * (STAIR.hw - 0.06));
    const len = a.distanceTo(b);
    B.place(K.chrome, new THREE.CylinderGeometry(0.022, 0.022, len, 8).rotateZ(Math.atan2(b.x - a.x, a.y - b.y)), (a.x + b.x) / 2, (a.y + b.y) / 2, a.z);
  }

  // ---------- the doorway as seen from the hall: marble face, silver frame and inscribed silver panel,
  // flanked by two massive gilt fluted pillars on white marble drums with gilt lotus bases ----------
  const HX = G.x0 - 0.02;
  B.span(K.marbleIn, HX - 0.03, HX, PL, PL + 5.4, -3.2, -STAIR.hw - 0.42);
  B.span(K.marbleIn, HX - 0.03, HX, PL, PL + 5.4, STAIR.hw + 0.42, 3.2);
  B.span(K.marbleIn, HX - 0.03, HX, PL + 4.1, PL + 5.4, -STAIR.hw - 0.42, STAIR.hw + 0.42);
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? STAIR.hw : -STAIR.hw - 0.42, z1 = s > 0 ? STAIR.hw + 0.42 : -STAIR.hw;
    B.span(K.silverPlain, HX - 0.1, HX, SF, PL + 2.55, z0, z1);
    // a raised beaded border round the plain sheet
    for (const zz of [z0 + 0.03, z1 - 0.03]) B.span(K.silverPlain, HX - 0.13, HX - 0.1, SF, PL + 2.5, zz - 0.015, zz + 0.015);
    for (const yy of [PL + 0.05, PL + 1.2, PL + 2.47]) B.span(K.silverPlain, HX - 0.13, HX - 0.1, yy - 0.015, yy + 0.015, z0 + 0.03, z1 - 0.03);
  }
  B.span(K.silverPlain, HX - 0.12, HX, PL + 2.2, PL + 2.6, -STAIR.hw - 0.42, STAIR.hw + 0.42);
  const ins = textPanel([
    { text: 'द्वादश ज्योतिर्लिंग', font: 'bold 60px "Noto Sans Devanagari", Martel, serif', color: '#5d5d62', y: 70 },
    { text: 'दारुका वन', font: 'bold 92px "Noto Sans Devanagari", Martel, serif', color: '#4a4a50', y: 175 },
    { text: 'श्री नागेश्वर महादेव', font: 'bold 84px "Noto Sans Devanagari", Martel, serif', color: '#4a4a50', y: 290 },
  ], 1024, 360, '#c9cbd0');
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.0), ins);
  panel.position.set(HX - 0.13, PL + 4.35, 0);
  panel.rotation.y = -Math.PI / 2;
  group.add(panel);
  B.span(K.silver, HX - 0.12, HX - 0.02, PL + 3.82, PL + 4.92, -1.55, 1.55);
  const pillar = new THREE.LatheGeometry(([[0.001, 0], [0.5, 0], [0.5, 0.9], [0.46, 0.92]] as [number, number][]).map(([a, b]) => new THREE.Vector2(a, b)), 32);
  const lotus: [number, number][] = [[0.001, 0.92], [0.47, 0.92], [0.52, 1.04], [0.47, 1.18], [0.4, 1.3], [0.36, 1.34], [0.001, 1.34]];
  const shaftProf: [number, number][] = [[0.36, 1.34]];
  for (let i = 1; i <= 12; i++) shaftProf.push([0.36 - 0.02 * i / 12, 1.34 + (4.6 - 1.34) * i / 12]);
  shaftProf.push([0.4, 4.75], [0.42, 5.4], [0.001, 5.4]);
  const shaft = new THREE.LatheGeometry(shaftProf.map(([a, b]) => new THREE.Vector2(a, b)), 64);
  const sp = shaft.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i);
    if (y > 1.4 && y < 4.55) { const x = sp.getX(i), z = sp.getZ(i), k = 1 - 0.08 * Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 8)), 0.7); sp.setX(i, x * k); sp.setZ(i, z * k); }
  }
  shaft.computeVertexNormals();
  for (const s of [-1, 1]) {
    const pz = s * 2.05, px = G.x0 - 0.5;
    B.place(K.marbleIn, pillar, px, PL, pz);
    B.lathe(K.giltPillar, lotus, px, PL, pz, 32);
    B.place(K.giltPillar, shaft, px, PL, pz);
    P.solid(px - 0.5, PL, pz - 0.5, px + 0.5, PL + 5.4, pz + 0.5);
    // garland curtains either side of the door
    for (let k = 0; k < 9; k++) {
      const z = s * (STAIR.hw + 0.46 + k * 0.075);
      STL.add(HX - 0.16, PL + 4.05, z, 3.4 + (k % 2) * 0.15, k % 3 === 2 ? 0xf4efe0 : pick(YEL, k));
    }
    // green and orange garlands hung round the gilt pillar
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      STL.add(px + Math.cos(a) * 0.43, PL + 5.0, pz + Math.sin(a) * 0.43, 3.4, k % 2 ? 0x2c5a1c : pick(ORA, k));
    }
  }

  toran(group, new THREE.Vector3(HX - 0.17, PL + 2.62, -STAIR.hw - 0.45), new THREE.Vector3(HX - 0.17, PL + 2.62, STAIR.hw + 0.45), 0.2);
  for (let k = 0; k < 30; k++) ST.add(HX - 0.18, PL + 2.6, -STAIR.hw - 0.4 + k * ((STAIR.hw * 2 + 0.8) / 29), 0.25 + 0.15 * Math.abs(Math.sin(k * 0.6)), k % 2 ? pick(YEL, k) : 0x2c5a1c);

  // a silver arched tympanum over the door (repoussé), and the flower arch hanging at the top of the opening
  B.place(K.silver, new THREE.CircleGeometry(1.25, 32, 0, Math.PI).rotateY(-Math.PI / 2), HX - 0.13, PL + 2.6, 0);
  B.place(K.silverPlain, new THREE.TorusGeometry(1.25, 0.05, 8, 32, Math.PI).rotateY(-Math.PI / 2), HX - 0.15, PL + 2.6, 0);
  // a dense arch of red roses, green leaves and white flowers over the doorway (o01)
  for (let i = 0; i < 520; i++) {
    const t = Math.random(), a = Math.PI * (0.06 + t * 0.88);
    const rr = 1.45 + (Math.random() - 0.5) * 0.28;
    const z = Math.cos(a) * (rr - 0.32) * 0.95, y = PL + 1.86 + Math.sin(a) * 0.36 + (Math.random() - 0.5) * 0.12;
    const x = HX - 0.2 - Math.random() * 0.16;
    const k = Math.random();
    if (k < 0.42) O.add('rose', x, y, z, 2.0, Math.random() < 0.8 ? 0x8a0a1a : 0xc0122a, Math.random() * 6.3, 2.5);
    else if (k < 0.8) O.add('bel', x, y, z, 2.6, Math.random() < 0.6 ? 0x1f4a14 : 0x2e6a1c, Math.random() * 6.3, 3.0);
    else O.add('mogra', x, y, z, 1.8);
  }
  // red-lettered signboards on the inner faces of the gilt pillars
  const board = (l1: string, l2: string) => textPanel([
    { text: l1, font: 'bold 60px "Noto Sans Devanagari", Martel, serif', color: '#b0121a', y: 120 },
    { text: l2, font: 'bold 60px "Noto Sans Devanagari", Martel, serif', color: '#b0121a', y: 210 },
  ], 400, 520, '#fbf4e2');
  for (const [s, l1, l2] of [[-1, 'मंदिर में धोती पहनकर', 'प्रवेश कीजिए'], [1, 'फोटो मूवी', 'लेना मना है']] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.65), board(l1, l2));
    m.position.set(G.x0 - 0.5 - 0.44, PL + 2.35, s * 1.92);
    m.rotation.y = -Math.PI / 2;
    group.add(m);
    B.span(K.maroon, G.x0 - 0.96, G.x0 - 0.945, PL + 1.98, PL + 2.72, s * 1.92 - 0.29, s * 1.92 + 0.29);
  }
  // the front railing across the stair head (a gap in the middle for the queue), hung with marigold puffs
  const FX = STAIR.top - 0.62;
  for (const s of [-1, 1]) {
    const z0 = s * 0.75, z1 = s * (STAIR.hw + 0.12);
    const zl = Math.min(z0, z1), zh = Math.max(z0, z1);
    B.place(K.chrome, new THREE.CylinderGeometry(0.025, 0.025, zh - zl, 10).rotateX(Math.PI / 2), FX, PL + 1.0, (zl + zh) / 2);
    B.place(K.chrome, new THREE.CylinderGeometry(0.022, 0.022, zh - zl, 10).rotateX(Math.PI / 2), FX, PL + 0.5, (zl + zh) / 2);
    B.lathe(K.chrome, [[0.035, 0], [0.03, 0.04], [0.025, 1.0], [0.001, 1.0]], FX, PL, z0, 12);
    B.place(K.chrome, new THREE.SphereGeometry(0.065, 14, 10), FX, PL + 1.07, z0);
    // round marigold puffs: little clusters of big heads hanging from the top rail
    // yellow puffs along the front top rail: a little cluster of marigold heads at each tie
    for (let z = zl + 0.07; z < zh; z += 0.11) PUFFY.add(FX - 0.06, PL + 1.0, z, 0.13 + 0.03 * Math.random(), 0xffb400);
    P.solid(FX - 0.08, PL, zl, FX + 0.08, PL + 1.1, zh);
  }

  // passage floor through the doorway and the sanctum floor
  P.floor(group, STAIR.bot, G.ix1, -G.iz, G.iz, SF);
  B.span(K.marbleIn, STAIR.bot, G.ix0 + 0.1, SF - 0.3, SF, -STAIR.hw, STAIR.hw);
  B.span(K.marbleIn, G.ix0, G.ix1, SF - 0.3, SF, -G.iz, G.iz);
  B.span(K.silverPlain, G.ix0 - 0.04, G.ix0 + 0.06, SF, PL + 2.2, -STAIR.hw - 0.3, -STAIR.hw);
  B.span(K.silverPlain, G.ix0 - 0.04, G.ix0 + 0.06, SF, PL + 2.2, STAIR.hw, STAIR.hw + 0.3);
  B.span(K.silverPlain, G.x0, G.ix0, PL + 2.18, PL + 2.2, -STAIR.hw, STAIR.hw);
  // (inset 1.5 cm in front of the temple block's own faces at z = ±STAIR.hw, which z-fought into a red checker)
  for (const s of [-1, 1]) B.span(K.marbleIn, G.x0 - 0.02, G.ix0, SF - 0.3, PL + 2.2, s * (STAIR.hw - 0.015), s * STAIR.hw);

  // ---------- the octagonal chamber: white marble walls, chamfered corners, a flat cream ceiling ----------
  const top = 3.7;
  const wall = (x0: number, x1: number, z0: number, z1: number, m: THREE.Material = K.marbleWall) => B.span(m, x0, x1, SF, top, z0, z1);
  // behind the marigold curtains the walls are hidden: a deep, matte marigold-brown so the gaps between
  // strands read as more flowers in shadow, not as bare wall
  const behind = new THREE.MeshStandardMaterial({ color: 0x8a5a08, roughness: 1 });
  wall(G.ix0, G.ix1, -G.iz, -G.iz + 0.03, behind);
  wall(G.ix0, G.ix1, G.iz - 0.03, G.iz, behind);
  wall(G.ix1 - 0.03, G.ix1, -G.iz, G.iz, behind);
  wall(G.ix0, G.ix0 + 0.03, -G.iz, -STAIR.hw - 0.3);
  wall(G.ix0, G.ix0 + 0.03, STAIR.hw + 0.3, G.iz);
  const C = 0.72; // chamfer leg
  for (const [cx, cz] of [[G.ix0, -G.iz], [G.ix0, G.iz], [G.ix1, -G.iz], [G.ix1, G.iz]]) {
    const sx = cx === G.ix0 ? 1 : -1, sz = cz < 0 ? 1 : -1;
    B.prism(behind, [[cx, cz], [cx + sx * C, cz], [cx, cz + sz * C]], SF, top);
    P.solid(Math.min(cx, cx + sx * C * 0.55), SF, Math.min(cz, cz + sz * C * 0.55), Math.max(cx, cx + sx * C * 0.55), top, Math.max(cz, cz + sz * C * 0.55));
  }
  // a smooth, evenly painted cream ceiling (the scanned plaster read blotchy from below)
  const ceil = new THREE.MeshStandardMaterial({ color: 0xece0c4, roughness: 0.75, envMap: env, envMapIntensity: 0.4 });
  B.span(ceil, G.ix0, G.ix1, top, top + 0.2, -G.iz, G.iz);
  // the gilt lotus medallion over the linga: a disc held 1.5 cm below the ceiling, two rings of raised petals
  // and a domed boss (real geometry, so nothing is coplanar with the ceiling)
  const zariOff = K.zari.clone();
  zariOff.polygonOffset = true; zariOff.polygonOffsetFactor = -2; zariOff.polygonOffsetUnits = -2;
  B.place(zariOff, new THREE.CircleGeometry(0.62, 48).rotateX(Math.PI / 2), LX, top - 0.015, LZ);
  B.place(K.zari, new THREE.TorusGeometry(0.62, 0.02, 6, 48).rotateX(Math.PI / 2), LX, top - 0.02, LZ);
  const petal = (len: number, w: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.bezierCurveTo(w, len * 0.25, w * 0.8, len * 0.75, 0, len); sh.bezierCurveTo(-w * 0.8, len * 0.75, -w, len * 0.25, 0, 0);
    const g = new THREE.ShapeGeometry(sh, 6);
    const p = g.attributes.position;
    // cupped across, curling down toward the tip
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (x * x) / w * 0.5 + (y / len) ** 2 * 0.04); }
    g.computeVertexNormals();
    return g;
  };
  for (const [n, r0, len, w, y] of [[16, 0.2, 0.36, 0.075, 0.03], [8, 0.08, 0.24, 0.07, 0.045]] as const) {
    for (let i = 0; i < n; i++) {
      const a = ((i + (n === 8 ? 0.5 : 0)) / n) * Math.PI * 2;
      // petal in the XY plane pointing +y, facing +z: lay it flat facing down, pointing outward at angle a
      const g = petal(len, w).translate(0, r0, 0).rotateX(Math.PI / 2).rotateY(-a + Math.PI / 2);
      B.place(K.zari, g, LX, top - y, LZ);
    }
  }
  B.lathe(K.zari, [[0.001, 0], [0.11, 0], [0.1, -0.05], [0.06, -0.09], [0.02, -0.11], [0.001, -0.115]], LX, top - 0.04, LZ, 24);
  // silver bells at the doorway
  const bell = new THREE.LatheGeometry([[0.001, 0.2], [0.04, 0.19], [0.07, 0.12], [0.1, 0.02], [0.11, 0], [0.001, 0.02]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  for (const z of [-0.8, 0.8]) {
    B.place(K.brass, bell, G.ix0 + 0.35, SF + 2.3, z);
    B.span(K.brass, G.ix0 + 0.345, G.ix0 + 0.355, SF + 2.5, top, z - 0.005, z + 0.005);
  }

  // ---------- the rear step with Parvati's silver chhatri, and a coiled silver serpent ----------
  const stepX = G.ix1 - 0.95, stepH = 0.35;
  B.span(K.marbleIn, stepX, G.ix1, SF, SF + stepH, -G.iz + 0.3, G.iz - 0.3);
  B.span(K.marbleIn, stepX - 0.03, stepX + 0.02, SF + stepH - 0.04, SF + stepH + 0.01, -G.iz + 0.3, G.iz - 0.3);
  P.floor(group, stepX, G.ix1, -G.iz + 0.3, G.iz - 0.3, SF + stepH);
  const nx = stepX + 0.5, ny = SF + stepH;
  // the chhatri: plinth, two columns and a back panel, cusped arch front, a ribbed silver dome and kalash
  B.span(K.silver, nx - 0.4, nx + 0.4, ny, ny + 0.16, -0.58, 0.58);
  for (const s of [-1, 1]) B.lathe(K.silverPlain, [[0.06, 0], [0.05, 0.1], [0.045, 0.95], [0.07, 1.0], [0.001, 1.0]], nx - 0.28, ny + 0.16, s * 0.45, 14);
  B.span(K.silver, nx + 0.28, nx + 0.36, ny + 0.16, ny + 1.2, -0.52, 0.52);
  B.span(K.dark, nx + 0.26, nx + 0.28, ny + 0.16, ny + 1.12, -0.4, 0.4);
  B.place(K.silver, new THREE.TorusGeometry(0.42, 0.05, 8, 28, Math.PI).rotateY(Math.PI / 2), nx - 0.3, ny + 0.75, 0);
  B.span(K.silver, nx - 0.36, nx + 0.36, ny + 1.16, ny + 1.26, -0.55, 0.55);
  B.lathe(K.silver, [[0.001, 0], [0.5, 0], [0.5, 0.06], [0.44, 0.2], [0.32, 0.36], [0.16, 0.44], [0.001, 0.46]], nx, ny + 1.26, 0, 32);
  B.add(K.silverPlain, kalashGeo(0.2).translate(nx, ny + 1.72, 0));
  // Parvati as Nageshwari: a dark stone murti in a draped figure with silver mukut and a marigold garland (no face)
  const mx = nx + 0.02, my = ny + 0.16;
  B.lathe(K.darkStone, [[0.001, 0], [0.22, 0], [0.2, 0.14], [0.15, 0.32], [0.12, 0.4], [0.14, 0.48], [0.16, 0.56], [0.12, 0.62], [0.06, 0.65], [0.05, 0.68], [0.07, 0.72], [0.075, 0.78], [0.06, 0.83], [0.001, 0.85]], mx, my, 0, 32);
  // silver mukut: a band with a ring of pointed crests and a central finial; silver necklace bands
  B.lathe(K.silverPlain, [[0.07, 0], [0.078, 0.03], [0.07, 0.06], [0.001, 0.06]], mx, my + 0.8, 0, 24);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    B.place(K.silverPlain, new THREE.ConeGeometry(0.018, 0.07, 6), mx + Math.cos(a) * 0.065, my + 0.89, Math.sin(a) * 0.065);
  }
  B.lathe(K.silverPlain, [[0.03, 0], [0.02, 0.06], [0.001, 0.11]], mx, my + 0.86, 0, 12);
  for (const y of [0.6, 0.55]) B.lathe(K.silverPlain, [[0.13, 0], [0.135, 0.012], [0.128, 0.02]], mx, my + y, 0, 24);
  // the big yellow marigold garland, a long U from the shoulders to below the waist
  const pg: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20, a = Math.PI * (0.05 + t * 0.9); pg.push(new THREE.Vector3(mx - 0.13 - Math.sin(a) * 0.03, my + 0.64 - Math.sin(a) * 0.36, Math.cos(a) * 0.15)); }
  B.add(ropeY, ropeGeo(pg, 0.032, false, 0.055));
  for (const s of [-1, 1]) {
    // little silver lamp stands either side of the chhatri
    B.lathe(K.silverPlain, [[0.08, 0], [0.02, 0.05], [0.018, 0.5], [0.07, 0.54], [0.075, 0.57], [0.001, 0.56]], nx - 0.1, ny, s * 0.85, 14);
    flames.push(new THREE.Vector3(nx - 0.1, ny + 0.64, s * 0.85));
  }
  // the coiled silver serpent on the rear step, south side, its hood raised
  const coil: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = t * Math.PI * 2 * 3.2, r = 0.2 - t * 0.09;
    coil.push(new THREE.Vector3(nx + Math.cos(a) * r, ny + 0.04 + t * 0.18, 1.45 + Math.sin(a) * r));
  }
  coil.push(new THREE.Vector3(nx - 0.02, ny + 0.36, 1.45), new THREE.Vector3(nx - 0.06, ny + 0.5, 1.43));
  B.add(K.silverPlain, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.035, 10, false));
  B.place(K.silverPlain, new THREE.SphereGeometry(1, 16, 12).scale(0.03, 0.12, 0.09), nx - 0.08, ny + 0.58, 1.43);
  B.place(K.silverPlain, new THREE.SphereGeometry(1, 12, 8).scale(0.06, 0.03, 0.04), nx - 0.12, ny + 0.66, 1.43);
  P.solid(stepX + 0.1, SF, -0.7, G.ix1, SF + 2.0, 0.7);
  P.solid(nx - 0.3, SF, 1.15, nx + 0.3, SF + 1.0, 1.75);

  // full-height marigold curtains wall to wall: the back wall, the chamfered corners and the side walls
  let ck = 0;
  const curtain = (x: number, z: number, len: number) => {
    const col = (ck % 6 === 3) ? pick(ORA, ck) : pick(YEL, ck);
    STL.add(x, top - 0.05, z, len * (0.97 + Math.random() * 0.03), col, (Math.random() - 0.5) * 0.025);
    ck++;
  };
  const backLen = top - 0.05 - (SF + stepH) - 0.02, fullLen = top - 0.12 - SF;
  for (let z = -G.iz + 0.72; z <= G.iz - 0.72; z += 0.085) curtain(G.ix1 - 0.06, z, backLen);
  for (const sz of [-1, 1]) {
    // across the chamfer (diagonal) at the back corners, then along the side wall to the front corner
    for (let t = 0; t <= 1.001; t += 0.125) curtain(G.ix1 - 0.06 - t * 0.66, sz * (G.iz - 0.72 + t * 0.66), t < 0.5 ? backLen : fullLen);
    for (let x = G.ix1 - 0.76; x > G.ix0 + 0.8; x -= 0.085) curtain(x, sz * (G.iz - 0.06), fullLen);
    for (let t = 0; t <= 1.001; t += 0.125) curtain(G.ix0 + 0.06 + (1 - t) * 0.66, sz * (G.iz - 0.06 - (1 - t) * 0.66), fullLen);
  }
  // green leaf strings over the curtain heads, and a toran of mango leaves all round the top
  
  toran(group, new THREE.Vector3(G.ix1 - 0.14, top - 0.04, -G.iz + 0.6), new THREE.Vector3(G.ix1 - 0.14, top - 0.04, G.iz - 0.6), 0.18, env);
  for (const sz of [-1, 1]) toran(group, new THREE.Vector3(G.ix0 + 0.8, top - 0.04, sz * (G.iz - 0.14)), new THREE.Vector3(G.ix1 - 0.75, top - 0.04, sz * (G.iz - 0.14)), 0.18, env);
  // ... and round the other five sides: the four chamfers and the front wall either side of the door
  for (const sz of [-1, 1]) {
    for (const [cx, sx] of [[G.ix0, 1], [G.ix1, -1]] as const) {
      const a = new THREE.Vector3(cx + sx * (C + 0.08), top - 0.04, sz * (G.iz - 0.14)), b = new THREE.Vector3(cx + sx * 0.14, top - 0.04, sz * (G.iz - C - 0.08));
      toran(group, sx > 0 ? b : a, sx > 0 ? a : b, 0.18, env);
    }
    toran(group, new THREE.Vector3(G.ix0 + 0.14, top - 0.04, sz * (STAIR.hw + 0.3)), new THREE.Vector3(G.ix0 + 0.14, top - 0.04, sz * (G.iz - 0.8)), 0.18, env);
  }

  // ---------- the Jyotirlinga in its floor-flush yoni ----------
  const yh = 0.07, YR = 0.72, SP = 0.75;
  const Y = yoniGeo(YR, SP, yh);
  B.place(K.marbleIn, Y.slab, LX, SF, LZ);
  B.place(K.silverPlain, Y.rim, LX, SF, LZ);
  // a low white marble kerb round the bed of rose petals that surrounds the yoni
  const kx0 = LX - 1.0, kx1 = LX + 1.0, kz0 = LZ - YR - SP - 0.25, kz1 = LZ + 1.0;
  for (const [a0, a1, b0, b1] of [[kx0, kx1, kz0, kz0 + 0.08], [kx0, kx1, kz1 - 0.08, kz1], [kx0, kx0 + 0.08, kz0, kz1], [kx1 - 0.08, kx1, kz0, kz1]]) B.span(K.marbleIn, a0, a1, SF, SF + 0.1, b0, b1);
  P.solid(kx0, SF, kz0, kx1, SF + 0.9, kz1);
  // a magenta base under the rose petals so the bed reads solid
  B.add(K.roseBed, new THREE.PlaneGeometry(kx1 - kx0 - 0.16, kz1 - kz0 - 0.16).rotateX(-Math.PI / 2).translate((kx0 + kx1) / 2, SF + 0.01, (kz0 + kz1) / 2));
  // magenta rose petals filling the bed outside the yoni
  const inYoni = (x: number, z: number) => {
    const dx = x - LX, dz = z - LZ;
    if (Math.hypot(dx, dz) < YR + 0.02) return true;
    return dz < 0 && dz > -YR - SP && Math.abs(dx) < 0.32 * (1 + (dz + YR) / (YR + SP) * 0.0) * (1 - (-dz - YR) / SP * 0.6);
  };
  for (let i = 0; i < 4200; i++) {
    const x = kx0 + 0.1 + Math.random() * (kx1 - kx0 - 0.2), z = kz0 + 0.1 + Math.random() * (kz1 - kz0 - 0.2);
    if (inYoni(x, z)) continue;
    O.add('petal', x, SF + 0.012 + Math.random() * 0.025, z, 1.5, Math.random() < 0.8 ? 0xc8105a : 0xe0186e, Math.random() * 6.3, 0.5);
  }
  // inside the rim: a band of yellow and orange marigold along the outline, then a bed of bel leaves
  // a broad bright-yellow outer band (two ropes), a narrower orange band, then a yellow one round the bel heap
  for (const [r, mat, rad] of [[YR - 0.07, ropeY, 0.042], [YR - 0.145, ropeY, 0.042], [YR - 0.212, ropeO, 0.033], [YR - 0.27, ropeY, 0.033]] as const) {
    const pts = Y.inner(r).getPoints(140).map((p) => new THREE.Vector3(LX - p.x, SF + yh + 0.03, LZ + p.y));
    pts.pop();
    B.add(mat, ropeGeo(pts, rad, true, 0.06).scale(1, 0.75, 1).translate(0, (SF + yh + 0.03) * 0.25, 0));
  }
  // a green ground under the bel bed, then the leaves
  const bed = Y.inner(YR - 0.31);
  B.place(K.belGreen, new THREE.ShapeGeometry(bed, 16).rotateX(-Math.PI / 2).rotateY(Math.PI), LX, SF + yh + 0.004, LZ);
  for (let i = 0; i < 1600; i++) {
    const x = LX + (Math.random() - 0.5) * 2 * (YR - 0.2), z = LZ - YR - SP + Math.random() * (YR * 2 + SP);
    const dx = x - LX, dz = z - LZ;
    const inside = Math.hypot(dx, dz) < YR - 0.3 || (dz < -0.2 && dz > -YR - SP + 0.3 && Math.abs(dx) < 0.14);
    if (!inside) continue;
    O.add('bel', x, SF + yh + 0.008 + Math.random() * 0.03, z, 1.4, undefined, Math.random() * 6.3, 0.6);
  }
  // the linga, covered by its silver Nag: coils round the base and five hoods spread over it
  const lr = 0.16, lh = 0.25;
  const linga = new THREE.Mesh(lingamGeo(lr, lh), K.lingam);
  linga.position.set(LX, SF + yh - 0.005, LZ);
  linga.rotation.y = 0.4;
  linga.castShadow = linga.receiveShadow = true;
  group.add(linga);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.LatheGeometry([new THREE.Vector2(lr * 1.045, 0), new THREE.Vector2(lr * 1.03, 0.011)], 24, Math.PI * 1.5 - 0.9 - Math.PI, 1.8);
    B.place(K.ash, g, LX, SF + yh + 0.07 + i * 0.028, LZ);
  }
  B.place(K.kumkum, new THREE.SphereGeometry(0.013, 8, 6).scale(0.5, 1, 1), LX - lr * 1.04, SF + yh + 0.098, LZ);
  const nag = nagGeo(lh, 0.21);
  nag.scale(0.85, 0.85, 0.85);
  B.place(K.silverPlain, nag, LX, SF + yh, LZ);
  // a U of yellow marigold over the hood, and a rose and bel on the crown
  const U: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = Math.PI * (0.08 + t * 0.84);
    U.push(new THREE.Vector3(LX - 0.1, SF + yh + lh + 0.5 - Math.sin(a) * 0.4, LZ + Math.cos(a) * 0.24));
  }
  B.add(ropeY, ropeGeo(U, 0.05, false, 0.07));
  // and a thick ring of marigold round the linga's foot
  const foot: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; foot.push(new THREE.Vector3(LX + Math.cos(a) * lr * 1.35, SF + yh + 0.04, LZ + Math.sin(a) * lr * 1.35)); }
  B.add(ropeY, ropeGeo(foot, 0.045, true, 0.06));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    O.add('bel', LX + Math.cos(a) * lr * 0.35, SF + yh + lh - 0.005, LZ + Math.sin(a) * lr * 0.35, 1.2, undefined, a, 0.6);
  }
  O.add('rose', LX - 0.02, SF + yh + lh + 0.012, LZ + 0.01, 1.2);
  // floor diyas at the kerb corners
  for (const [dx, dz] of [[-1.1, -1.5], [-1.1, 1.1]] as const) {
    B.lathe(K.brass, [[0.001, 0], [0.05, 0.0], [0.06, 0.03], [0.04, 0.045], [0.001, 0.035]], LX + dx, SF, LZ + dz, 14);
    flames.push(new THREE.Vector3(LX + dx, SF + 0.07, LZ + dz));
  }

  // ---------- lights ----------
  const lA = new THREE.PointLight(0xfff4ea, 5.0, 6, 1.5);
  lA.position.set(LX - 0.9, SF + 2.6, 0.4);
  const lB = new THREE.PointLight(0xffc080, 2.6, 4.5, 1.6);
  lB.position.set(G.ix1 - 1.4, SF + 2.2, -1.2);
  const lC = new THREE.PointLight(0xffd8b0, 3.0, 7, 1.6);
  lC.position.set((STAIR.top + STAIR.bot) / 2 - 0.8, PL + 2.6, 0);
  // a cool-white key on the curtains of the back wall
  const lD = new THREE.PointLight(0xf4f6ff, 3.2, 4.2, 1.6);
  lD.position.set(G.ix1 - 1.3, SF + 3.1, 0);
  for (const l of [lA, lB, lC, lD]) { group.add(l); lights.push(l); }

  B.flush(group);
  O.flush(group, env);
  ST.flush(group);
  STL.flush(group);
  PUFFY.flush(group);
  void Instances;
  return { group, lights, flames };
}

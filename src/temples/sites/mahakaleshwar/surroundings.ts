import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';
import { scanMaterial } from '../../engine/materials';
import { bakeMiniShikhara } from './shikhara';

/**
 * What surrounds the Mahakaleshwar precinct, after the trust's aerial photographs (aerial_1-3,
 * bg_1/bg_2) and Commons views of Mahakal Lok (cm32-39):
 *  - the precinct wall is lined with 2-4 storey buildings (shops, dharamshalas, the queue and
 *    administration block): cream, white and pink plaster with windows, balconies and saffron flags
 *  - beyond, the low dense town of Ujjain out to the horizon
 *  - to the north, Rudra Sagar lake edged by the red-sandstone colonnades of Mahakal Lok
 *  - the great peepal tree right of the temple
 *  - cream-white Nagara shrines (curvilinear spires with amalaka, kalash and flag) and ribbed
 *    Maratha lotus domes in the courtyard
 * Everything repeated is instanced. The town itself is now built from OpenStreetMap data (town.ts,
 * ujjain.ts) and Rudra Sagar and Mahakal Lok from their real outlines (mahakallok.ts).
 */

let seed = 1234;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** A canvas of a peepal leaf cluster: many small heart-shaped leaves with drip tips, dark to light greens. */
function leafClusterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  const leaf = (x: number, y: number, s: number, a: number, col: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = col;
    g.beginPath();
    // heart-shaped peepal leaf with a long drip tip, stalk at the origin
    g.moveTo(0, 0);
    g.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.75, -s * 1.15, 0, -s * 1.9);
    g.bezierCurveTo(s * 0.75, -s * 1.15, s * 0.9, -s * 0.2, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,40,10,0.35)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.7); g.stroke();
    g.restore();
  };
  // many small leaves (≈5-9 px of a 256 px card, i.e. ≤0.15 m on the trees' 1.2-2 m cards), dark varied greens
  const greens = ['#22381a', '#2b4420', '#334f25', '#3d5a2e', '#47652f', '#2a3f1d', '#516e36', '#3a5328'];
  for (let i = 0; i < 520; i++) {
    const rr = Math.sqrt(rnd()) * 112, a = rnd() * Math.PI * 2;
    leaf(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 4.5 + rnd() * 4, a + Math.PI / 2 + (rnd() - 0.5) * 1.6,
      greens[Math.floor(rnd() * greens.length)]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * A large peepal (aerial_1, temple_front_2025: the great tree right of the temple): a flared, buttressed
 * trunk in the bark scan, tapering organic limbs, and a dense rounded crown ~14 m across built from
 * ~700 alpha-tested leaf-cluster cards. Each card's normals point away from the crown centre so the
 * foliage shades softly as one mass, with a dark inner volume so it never looks see-through.
 */
export function peepal(g: THREE.Group, P: Physics, x: number, z: number, h: number, pending?: Promise<unknown>[]) {
  const bark = scanMaterial('bark_brown_02', 1.2, { tint: 0x9a8e82, normalScale: 1.5 });
  pending?.push(bark.loaded);
  // trunk: a lathe with buttress flare, wobble and taper
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, y = t * 6.5;
    prof.push(new THREE.Vector2(0.55 + 0.75 * Math.pow(1 - Math.min(1, t * 3), 2.2) - 0.18 * t, y));
  }
  const tg = new THREE.LatheGeometry(prof, 20);
  {
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i);
      const k = 1 + 0.22 * Math.pow(Math.abs(Math.sin(a * 3 + 0.4)), 3) * Math.max(0, 1 - y / 1.6) + 0.06 * Math.sin(a * 5 + y * 1.7);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    tg.computeVertexNormals();
  }
  const parts: THREE.BufferGeometry[] = [tg.toNonIndexed()];
  // limbs: tapered tubes curving up and out, each forking once
  const limb = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number) => {
    const mid = from.clone().add(dir.clone().multiplyScalar(len * 0.5)).add(new THREE.Vector3(0, len * 0.18, 0));
    const end = from.clone().add(dir.clone().multiplyScalar(len)).add(new THREE.Vector3(0, len * 0.45, 0));
    const curve = new THREE.CatmullRomCurve3([from, mid, end]);
    const tube = new THREE.TubeGeometry(curve, 10, 1, 7, false);
    const p = tube.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 8) / 10, c = curve.getPoint(Math.min(1, seg));
      const rr = r0 * (1 - 0.65 * seg);
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * rr, c.y + (p.getY(i) - c.y) * rr, c.z + (p.getZ(i) - c.z) * rr);
    }
    tube.computeVertexNormals();
    parts.push(tube.toNonIndexed());
    if (depth > 0) {
      for (const turn of [-0.6, 0.55]) {
        const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn).normalize();
        limb(end, d2, len * 0.6, r0 * 0.4, depth - 1);
      }
    }
  };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    limb(new THREE.Vector3(0, 5.2 + (i % 2) * 0.6, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 4.2, 0.32, 1);
  }
  const trunkGeo = mergeGeometries(parts.map((q) => { q.deleteAttribute('uv'); return q; }))!;
  // bark UVs: around × up, in metres
  {
    const p = trunkGeo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.6; uv[i * 2 + 1] = p.getY(i); }
    trunkGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const trunk = new THREE.Mesh(trunkGeo, bark.material);
  trunk.position.set(x, 0.6, z);
  trunk.castShadow = trunk.receiveShadow = true;
  g.add(trunk);
  // red and yellow kalava thread wound round the trunk by devotees
  {
    const thread = new THREE.MeshStandardMaterial({ color: 0xb01a14, roughness: 0.8 });
    const yellowT = new THREE.MeshStandardMaterial({ color: 0xd8a018, roughness: 0.8 });
    const p = tg.attributes.position;
    let rMax = 0;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - 0.9) < 0.3) rMax = Math.max(rMax, Math.hypot(p.getX(i), p.getZ(i)));
    for (let k = 0; k < 7; k++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(rMax * (1.0 - k * 0.006) + 0.01, 0.012, 5, 40), k % 3 === 2 ? yellowT : thread);
      t.rotation.x = Math.PI / 2 + (k - 3) * 0.02;
      t.position.set(x, 0.6 + 0.75 + k * 0.05, z);
      g.add(t);
    }
  }

  // crown: a dark inner volume plus leaf-cluster cards on and near a squashed sphere
  const R = 9.5, cy = h * 0.64, cx0 = x, cz0 = z;
  // the crown is a cluster of uneven lobes (irregular silhouette), each a dark core under leaf cards
  const lobes = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.5, rr = i === 0 ? 0 : R * (0.35 + rnd() * 0.3);
    return { c: new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.3) * R * 0.3 + (i === 0 ? R * 0.15 : 0), Math.sin(a) * rr), r: R * (0.42 + rnd() * 0.2) };
  });
  const coreGeo = mergeGeometries(lobes.map(({ c, r }) => new THREE.SphereGeometry(1, 14, 10).scale(r * 0.8, r * 0.55, r * 0.8).translate(c.x, c.y, c.z).toNonIndexed()))!;
  const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x1a2c12, roughness: 1 }));
  core.position.set(cx0, cy, cz0);
  g.add(core);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const N = 3800, cards: THREE.BufferGeometry[] = [];
  const centre = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < N; i++) {
    // a point in the shell of one lobe (denser near the surface, flattened underneath)
    const lb = lobes[Math.floor(rnd() * lobes.length)];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = lb.r * (0.7 + 0.3 * Math.pow(rnd(), 0.6));
    const pos = new THREE.Vector3(lb.c.x + dir.x * rr, lb.c.y + dir.y * rr * 0.68, lb.c.z + dir.z * rr);
    const size = 1.2 + rnd() * 0.7;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    // soft foliage shading: normals radiate from the crown centre
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), p.getY(k) / 0.62, p.getZ(k)).sub(centre).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    cards.push(card);
  }
  const crownGeo = mergeGeometries(cards)!;
  const crown = new THREE.Mesh(crownGeo, leafMat);
  crown.position.set(cx0, cy, cz0);
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(crown);
  P.solid(x - 1.1, 0, z - 1.1, x + 1.1, 6, z + 1.1);
}

/**
 * A grove of smaller dense broadleaf trees (the canopy along the north and east of the courtyard in
 * aerial_1-3): one trunk geometry and one leaf-card crown geometry, each shared by every tree through
 * an InstancedMesh, with per-tree scale and rotation. spots = [x, z, height].
 */
export function canopyTrees(g: THREE.Group, P: Physics | null, spots: [number, number, number][], pending?: Promise<unknown>[], shadows = true) {
  const bark = scanMaterial('bark_brown_02', 1.0, { tint: 0x8e8378, normalScale: 1.3 });
  pending?.push(bark.loaded);
  // unit tree: 1 m tall reference, crown radius 0.42, crown centre at 0.62
  const tprof: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; tprof.push(new THREE.Vector2(0.035 + 0.04 * Math.pow(1 - Math.min(1, t * 4), 2) - 0.015 * t, t * 0.62)); }
  const tg = new THREE.LatheGeometry(tprof, 10);
  { const p = tg.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.1; uv[i * 2 + 1] = p.getY(i) * 6; }
    tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  const cards: THREE.BufferGeometry[] = [];
  // an irregular crown of 5 lobes, small cards (leaves ≤0.15 m at 10 m tree height)
  const lobes = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + rnd(), rr = i === 0 ? 0 : 0.14 + rnd() * 0.12;
    return { c: new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.4) * 0.12, Math.sin(a) * rr), r: 0.2 + rnd() * 0.1 };
  });
  for (let i = 0; i < 800; i++) {
    const lb = lobes[Math.floor(rnd() * lobes.length)];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = lb.r * (0.65 + 0.35 * Math.pow(rnd(), 0.6));
    const pos = new THREE.Vector3(lb.c.x + dir.x * rr, lb.c.y + dir.y * rr * 0.75 + 0.62, lb.c.z + dir.z * rr);
    const size = 0.09 + rnd() * 0.05;
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
  const leafMat = new THREE.MeshStandardMaterial({ map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const coreGeo = mergeGeometries(lobes.map(({ c, r }) => new THREE.SphereGeometry(1, 10, 7).scale(r * 0.75, r * 0.55, r * 0.75).translate(c.x, c.y + 0.62, c.z).toNonIndexed()))!;
  const trunks = new THREE.InstancedMesh(tg, bark.material, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, spots.length);
  const cores = new THREE.InstancedMesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x1a2c12, roughness: 1 }), spots.length);
  spots.forEach(([x, z, h], i) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28),
      new THREE.Vector3(h * (0.9 + rnd() * 0.25), h, h * (0.9 + rnd() * 0.25)));
    trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m); cores.setMatrixAt(i, m);
    P?.solid(x - 0.4, 0, z - 0.4, x + 0.4, 4, z + 0.4);
  });
  for (const im of [trunks, crowns]) { im.castShadow = shadows; im.receiveShadow = true; }
  g.add(trunks, crowns, cores);
}

/** Spire placements collected by nagaraShrine(); buildMiniSpires() turns them into a few instanced draws. */
const MINI_SPIRES: THREE.Matrix4[] = [];

/** Cream lime-plaster of the subsidiary shrines (temple_front_2025 left, cm24). */
export const SHRINE_CREAM = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.85 });

/**
 * A small cream Nagara shrine (temple_front_2025 left, cm24): a plinth, a square sanctum with its doorway,
 * a moulded cornice, then the main spire's own form at ~1/4 scale — tiers of urushringas with gold
 * kalashes (instanced, see buildMiniSpires) — a ribbed amalaka disc, the kalash and a saffron flag.
 */
export function nagaraShrine(g: THREE.Group, P: Physics, x: number, z: number, h: number, ry: number, mats: { white: THREE.Material; gold: THREE.Material; flag: THREE.Material; dark: THREE.Material }, baseY = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, baseY, z);
  grp.rotation.y = ry;
  g.add(grp);
  const cream = SHRINE_CREAM;
  const base = h * 0.3, half = h * 0.17;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
  add(new THREE.BoxGeometry(half * 2.6, 0.35, half * 2.6).translate(0, 0.175, 0), cream);
  add(new THREE.BoxGeometry(half * 2, base, half * 2).translate(0, base / 2, 0), cream, 0.35);
  add(new THREE.BoxGeometry(half * 0.8, base * 0.7, 0.05).translate(0, base * 0.35, half + 0.02), mats.dark, 0.35);
  add(new THREE.BoxGeometry(half * 2.25, 0.1, half * 2.25).translate(0, 0.05, 0), cream, 0.35 + base - 0.05);
  add(new THREE.BoxGeometry(half * 2.12, 0.08, half * 2.12).translate(0, 0.04, 0), cream, 0.35 + base - 0.13);
  const top = 0.35 + base + 0.05;
  const H = h - top - h * 0.12;
  grp.updateMatrixWorld(true);
  MINI_SPIRES.push(new THREE.Matrix4().compose(new THREE.Vector3(0, top, 0), new THREE.Quaternion(), new THREE.Vector3(half * 0.95, H / 2.6, half * 0.95)).premultiply(grp.matrixWorld));
  // ribbed amalaka disc on the spire's top platform (≈0.26 of the base half-width)
  const ar = half * 0.95 * 0.3;
  const am = new THREE.LatheGeometry([[0, 0], [0.62, 0], [0.9, 0.12], [1.0, 0.28], [0.9, 0.44], [0.62, 0.55], [0, 0.55]].map(([r, y]) => new THREE.Vector2(r * ar, y * ar)), 24);
  { const p = am.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.1 * Math.pow(Math.abs(Math.cos(a * 8)), 3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } am.computeVertexNormals(); }
  add(am, cream, top + H);
  const kh = Math.max(0.35, h * 0.08);
  add(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.2, 0.12], [0.12, 0.25], [0.05, 0.4], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r * kh * 2, y * kh * 2)), 10), mats.gold, top + H + ar * 0.55);
  const pole = add(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), mats.gold, top + H + 0.7);
  pole.position.x = ar * 0.8;
  const fg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.7, -0.2, 0, 0, -0.45, 0], 3));
  fg.computeVertexNormals();
  const fl = add(fg, mats.flag, top + H + 1.38);
  fl.position.x = ar * 0.8;
  if (baseY === 0) P.solid(x - half * 1.3, 0, z - half * 1.3, x + half * 1.3, 3, z + half * 1.3);
}

/** Instance the shared mini-spire over every shrine placed so far (one draw call per material). */
export function buildMiniSpires(g: THREE.Group, gold: THREE.Material, dark: THREE.Material) {
  for (const { mat, geo } of bakeMiniShikhara(SHRINE_CREAM, gold, dark)) {
    const im = new THREE.InstancedMesh(geo, mat, MINI_SPIRES.length);
    MINI_SPIRES.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = false; // small, and cheap to leave out of the sun's shadow pass
    im.receiveShadow = true;
    g.add(im);
  }
  MINI_SPIRES.length = 0;
}

/** A ribbed Maratha lotus dome (16-24 ribs and a ring of petals at the base) to replace smooth domes. */
export function ribbedDome(g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, r: number, ribs = 20) {
  const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0)];
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 0.5;
    prof.push(new THREE.Vector2(Math.max(r * 0.08, r * 1.05 * Math.cos(a) * (1 - 0.12 * Math.sin(a * 2))), r * 0.08 + Math.sin(a) * r * 1.15));
  }
  prof.push(new THREE.Vector2(r * 0.16, r * 1.3), new THREE.Vector2(r * 0.05, r * 1.6), new THREE.Vector2(0, r * 1.65));
  const geo = new THREE.LatheGeometry(prof, ribs * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i);
    if (yy < r * 0.05 || yy > r * 1.2) continue;
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.045 * Math.pow(Math.abs(Math.cos(a * ribs * 0.5)), 0.5);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  // lotus petals round the drum
  const petal = new THREE.SphereGeometry(r * 0.16, 8, 6);
  petal.scale(1, 0.55, 0.6);
  const inst = new THREE.InstancedMesh(petal, mat, ribs);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    inst.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r * 1.02, y + r * 0.06, z + Math.sin(a) * r * 1.02),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(1, 1, 1)));
  }
  g.add(inst);
  return m;
}

/** The main gateway in the south precinct wall: two tall piers with chhatris, a lintel with the
 *  temple's name, and a dark arched opening (the real entry from the Mahakal Lok side). */
export function gateway(g: THREE.Group, x: number, z: number, mats: { plaster: THREE.Material; red: THREE.Material; dark: THREE.Material }, facingSouth = false,
  /** open right through the wall behind (a real way in): the passage runs `open` metres back, with no lit end wall */
  open = 0) {
  const W = 9, H = 10;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(2.2, H, 2.2), mats.plaster, x + sx * (W / 2 + 1.1), H / 2, z);
    add(new THREE.BoxGeometry(2.6, 0.3, 2.6), mats.red, x + sx * (W / 2 + 1.1), H + 0.15, z);
    ribbedDome(g, mats.plaster, x + sx * (W / 2 + 1.1), H + 0.3, z, 1.1, 16);
  }
  add(new THREE.BoxGeometry(W + 4.4, 2.2, 2.0), mats.plaster, x, H - 1.6, z);
  add(new THREE.BoxGeometry(W * 0.7, 1.0, 0.1), mats.red, x, H - 1.6, z + (facingSouth ? 1.02 : -1.02));
  // the lintel's roof: a row of kangura merlons along both edges and a raised centre panel with a kalash
  {
    const L = W + 4.4, n = Math.floor(L / 0.8);
    const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.6, 0.22).translate(0, 0.3, 0), mats.plaster, n * 2);
    for (let i = 0; i < n; i++) for (const sz of [-1, 1]) {
      mer.setMatrixAt(i * 2 + (sz > 0 ? 1 : 0), new THREE.Matrix4().makeTranslation(x - L / 2 + 0.4 + i * (L - 0.8) / (n - 1), H - 0.5, z + sz * 0.88));
    }
    mer.castShadow = true;
    g.add(mer);
    add(new THREE.BoxGeometry(3.2, 1.1, 1.2), mats.plaster, x, H + 0.05, z);
    add(new THREE.BoxGeometry(2.6, 0.7, 0.06), mats.red, x, H + 0.05, z + (facingSouth ? 0.62 : -0.62));
    ribbedDome(g, mats.plaster, x, H + 0.6, z, 0.5, 12);
  }
  const arch = new THREE.Shape();
  arch.moveTo(-W / 2 + 0.6, 0); arch.lineTo(-W / 2 + 0.6, 5.2); arch.quadraticCurveTo(0, 8.2, W / 2 - 0.6, 5.2); arch.lineTo(W / 2 - 0.6, 0); arch.lineTo(-W / 2 + 0.6, 0);
  // the arch is a real recessed passage: a moulded frame round the opening, side walls and a vault
  // running ~4 m back into the wall, and a warm lamp-lit far end
  const sgn = facingSouth ? 1 : -1; // direction from the gate towards the courtyard
  const zf = z + sgn * 1.05, D = open || 2.0, aw = W / 2 - 0.6;
  const frame = new THREE.Shape();
  frame.moveTo(-W / 2 - 0.2, 0); frame.lineTo(W / 2 + 0.2, 0); frame.lineTo(W / 2 + 0.2, 8.8); frame.lineTo(-W / 2 - 0.2, 8.8); frame.lineTo(-W / 2 - 0.2, 0);
  frame.holes.push(new THREE.Path(arch.getPoints(24).reverse()));
  const fr = add(new THREE.ExtrudeGeometry(frame, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 12 }), mats.plaster, x, 0, zf);
  fr.rotation.y = facingSouth ? 0 : Math.PI;
  const zc = zf - sgn * D / 2;
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3, 5.2, D), mats.plaster, x + sx * (aw + 0.15), 2.6, zc);
  // vault: a parabolic barrel from the springing (5.2 m) to the crown (~7.6 m)
  const vault = new THREE.CylinderGeometry(1, 1, D, 24, 1, true, -Math.PI / 2, Math.PI);
  vault.rotateX(-Math.PI / 2); // axis along z, the half-shell above the springing
  const vm = add(vault, new THREE.MeshStandardMaterial({ color: 0xcfc2ae, roughness: 0.9, side: THREE.DoubleSide }), x, 5.2, zc);
  vm.scale.set(aw, 2.6, 1);
  // floor of the passage and the lit far end (a lamp-lit inner courtyard wall with a small doorway)
  add(new THREE.BoxGeometry(aw * 2, 0.05, D), mats.red, x, 0.02, zc);
  const glow = new THREE.MeshStandardMaterial({ color: 0xf2d4a0, emissive: 0xffb050, emissiveIntensity: 0.6, roughness: 0.9 });
  if (!open) {
    const back = add(new THREE.PlaneGeometry(aw * 2, 7.6), glow, x, 3.8, zf - sgn * D);
    back.rotation.y = facingSouth ? 0 : Math.PI;
    const door = add(new THREE.PlaneGeometry(2.0, 3.2), mats.dark, x, 1.6, zf - sgn * (D - 0.02));
    door.rotation.y = facingSouth ? 0 : Math.PI;
  }
  for (const sx of [-1, 1]) {
    const lamp = add(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd090, emissive: 0xffa040, emissiveIntensity: 2 }), x + sx * (aw - 0.15), 3.4, zf - sgn * 1.2);
    lamp.castShadow = false;
  }
}

/**
 * Courtyard clutter seen in the trust's photographs: lines of steel queue barricades and coloured
 * cloth shade canopies on poles over the walkways. lines = [x0, z0, x1, z1]; canopies = [x0, z0, x1, z1, colourIndex].
 */
export function courtyardClutter(g: THREE.Group, P: Physics, lines: [number, number, number, number][], canopies: [number, number, number, number, number][]) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xb6babe, metalness: 0.8, roughness: 0.35 });
  const rails: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [x0, z0, x1, z1] of lines) {
    const a = new THREE.Vector3(x0, 0, z0), b = new THREE.Vector3(x1, 0, z1), len = a.distanceTo(b);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    for (const y of [0.45, 1.0]) rails.push(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5).setY(y), q, new THREE.Vector3(1, len, 1)));
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) posts.push(new THREE.Matrix4().makeTranslation(x0 + (x1 - x0) * i / n, 0.5, z0 + (z1 - z0) * i / n));
    P.solid(Math.min(x0, x1) - 0.05, 0, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, 1.05, Math.max(z0, z1) + 0.05);
  }
  const ri = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), steel, rails.length);
  rails.forEach((m, i) => ri.setMatrixAt(i, m));
  const pi = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 6), steel, posts.length);
  posts.forEach((m, i) => pi.setMatrixAt(i, m));
  g.add(ri, pi);
  // shade cloths: striped fabric sagging between four poles
  const COL = [['#c8202a', '#f2c230'], ['#1f5aa8', '#f2f2ee'], ['#e86a20', '#f2c230'], ['#2a7a4a', '#f2f2ee']];
  for (const [x0, z0, x1, z1, ci] of canopies) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const cx = c.getContext('2d')!;
    for (let k = 0; k < 8; k++) { cx.fillStyle = COL[ci % COL.length][k % 2]; cx.fillRect(k * 8, 0, 8, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.abs(x1 - x0) / 3, 1);
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const geo = new THREE.PlaneGeometry(w, d, 12, 12).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w * 2, v = p.getZ(i) / d * 2; p.setY(i, -0.35 * (1 - u * u) * (1 - v * v)); }
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.85 }));
    cloth.position.set((x0 + x1) / 2, 4.8, (z0 + z1) / 2);
    cloth.castShadow = true;
    g.add(cloth);
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.8, 6).translate(0, 2.4, 0), steel);
      pole.position.set(px, 0, pz);
      g.add(pole);
      P.solid(px - 0.08, 0, pz - 0.08, px + 0.08, 4.8, pz + 0.08);
    }
  }
}

/**
 * White pagoda tents (temple_front_2025, lower right): a square fabric pavilion on four poles with a
 * steep, slightly concave pyramid roof, a scalloped valance and a finial.
 */
export function pagodaTent(g: THREE.Group, P: Physics, x: number, z: number, half = 1.8) {
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.85, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.6, roughness: 0.4 });
  const H = 2.5, R = half * 1.15, peak = 2.6;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(R * Math.pow(1 - t, 1.6) + 0.02, t * peak)); }
  const roof = new THREE.Mesh(new THREE.LatheGeometry(prof, 4).rotateY(Math.PI / 4), cloth);
  roof.position.set(x, H, z);
  roof.castShadow = true;
  g.add(roof);
  const val = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.99, R * 0.99, 0.35, 4, 1, true).rotateY(Math.PI / 4), cloth);
  val.position.set(x, H - 0.17, z);
  g.add(val);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 6), steel);
  fin.position.set(x, H + peak + 0.3, z);
  g.add(fin);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H, 6).translate(0, H / 2, 0), steel);
    p.position.set(x + dx * half * 0.8, 0, z + dz * half * 0.8);
    g.add(p);
    P.solid(x + dx * half * 0.8 - 0.07, 0, z + dz * half * 0.8 - 0.07, x + dx * half * 0.8 + 0.07, H, z + dz * half * 0.8 + 0.07);
  }
}

/**
 * A round white conical tent (temple_front_2025, right foreground): a tall, slightly concave fabric cone
 * on six poles with a scalloped valance and a small finial.
 */
export function coneTent(g: THREE.Group, P: Physics, x: number, z: number, R = 2.6) {
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.85, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.6, roughness: 0.4 });
  const H = 2.4, peak = 3.4;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(R * Math.pow(1 - t, 1.35) + 0.02, t * peak)); }
  const roof = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), cloth);
  roof.position.set(x, H, z);
  roof.castShadow = true;
  g.add(roof);
  // scalloped valance: a short skirt whose lower edge dips between the seams
  const vg = new THREE.CylinderGeometry(R, R, 0.42, 48, 1, true);
  { const p = vg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) - 0.1 * Math.abs(Math.sin(a * 6))); } vg.computeVertexNormals(); }
  const val = new THREE.Mesh(vg, cloth);
  val.position.set(x, H - 0.2, z);
  g.add(val);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), steel);
  fin.position.set(x, H + peak + 0.25, z);
  g.add(fin);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, px = x + Math.cos(a) * R * 0.92, pz = z + Math.sin(a) * R * 0.92;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H, 6).translate(0, H / 2, 0), steel);
    pole.position.set(px, 0, pz);
    g.add(pole);
    P.solid(px - 0.07, 0, pz - 0.07, px + 0.07, H, pz + 0.07);
  }
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H + peak, 6).translate(0, (H + peak) / 2, 0), steel);
  centre.position.set(x, 0, z);
  g.add(centre);
  P.solid(x - 0.08, 0, z - 0.08, x + 0.08, H, z + 0.08);
}

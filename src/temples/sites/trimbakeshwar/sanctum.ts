import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import { waterNormals } from '../../engine/materials';
import type { TM } from './mats';
import { Merger } from './merge';
import { lathe, kalashGeo, archFrameGeo, clean } from './forms';
import type { Offerings } from './offerings';
import { FlowerBed, rand } from './flowers';
import { GARBHA } from './temple';

/**
 * The garbhagriha and the Trimbakeshwar Jyotirlinga.
 *
 * Unlike every other Jyotirlinga there is no standing lingam here. In the floor of the sanctum (itself
 * sunk below the mandapa) is a small bowl-shaped hollow in a black-stone yoni-pitha; in it rise three
 * thumb-sized swayambhu lingas set like the corners of a triangle — Brahma, Vishnu and Mahesh (Shiva) —
 * kept wet by water that seeps up continuously (the Godavari), which has slowly worn them. The hollow is
 * framed in repoussé silver; a silver mask of the Trimurti is placed over it for worship and, on Mondays
 * and festivals, the Pandava-era jewelled gold crown (mukut). A mirror set above lets the queue see the
 * lingas. Here the hollow is shown uncovered at abhisheka, with the crown displayed on its silver stand
 * behind it (crowns and mask shown as ornament only; no faces are modelled).
 *
 * Scale: hollow ≈ 0.5 m across, ≈ 0.16 m deep; lingas ≈ 5 cm across, 6–7 cm tall; seen from 1.62 m eyes.
 */

export interface SanctumOut { update(t: number): void; field: THREE.Object3D }

function thumbLinga(r: number, h: number, seed: number) {
  const prof: [number, number][] = [[r * 1.15, 0], [r * 1.05, h * 0.15], [r, h * 0.45]];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI / 2;
    prof.push([r * Math.cos(a), h * 0.45 + Math.sin(a) * (h * 0.55)]);
  }
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0004), y)), 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    // worn by water: irregular, a little lopsided
    const k = 1 + 0.12 * Math.sin(a * 2 + seed) * (y / h) + 0.06 * Math.sin(a * 3 + seed * 2.1);
    p.setXYZ(i, x * k + (y / h) * r * 0.25 * Math.cos(seed), y, z * k + (y / h) * r * 0.2 * Math.sin(seed));
  }
  g.computeVertexNormals();
  return g;
}

export function buildSanctum(root: THREE.Group, K: TM, P: Physics, flames: Flames, O: Offerings): SanctumOut {
  const g = new THREE.Group();
  g.name = 'garbhagriha';
  root.add(g);
  const S = new Merger(P, 'sanctum');
  const Gd = new Merger(P, 'sanctum-gold');
  const cz = GARBHA.cz, Fl = GARBHA.floor, h = GARBHA.inner, C = GARBHA.ceil;

  // ---------- the room (off02, off04, off07): bare black basalt walls carved in deep relief, half-pilasters
  // at the corners and mid-walls, a niche in the west wall, white marble floor, a flat ceiling ----------
  const t = 0.3;
  S.span(K.sanctumWall, -h - t, Fl, cz - h - t, h + t, C, cz - h); // west
  S.span(K.sanctumWall, -h - t, Fl, cz - h, -h, C, cz + h); // south
  S.span(K.sanctumWall, h, Fl, cz - h, h + t, C, cz + h); // north
  S.span(K.sanctumWall, -h - t, Fl, cz + h, -0.62, C, cz + h + t); // east, beside the door
  S.span(K.sanctumWall, 0.62, Fl, cz + h, h + t, C, cz + h + t);
  S.span(K.basalt, -0.62, Fl + 2.5, cz + h, 0.62, C, cz + h + t);
  S.span(K.basalt, -h - t, C, cz - h - t, h + t, C + 0.3, cz + h + t);
  // half-pilasters standing proud of the walls (banded shafts, bracket capitals)
  const pil = lathe([[0.16, 0], [0.16, 0.12], [0.12, 0.16], [0.12, 0.5], [0.15, 0.54], [0.11, 0.58], [0.11, 1.9], [0.14, 1.95], [0.1, 2.0], [0.1, 3.4],
    [0.16, 3.5], [0.2, 3.62], [0.22, 3.75], [0, 3.75]], 12);
  const pilH = C - Fl;
  for (const [x, z] of [[-h, cz - h], [h, cz - h], [-h, cz + h], [h, cz + h], [-h, cz - 0.9], [-h, cz + 0.9], [h, cz - 0.9], [h, cz + 0.9], [-1.0, cz - h], [1.0, cz - h]]) {
    S.place(K.basalt, pil, x, Fl, z, 0, [1, pilH / 3.75, 1]);
  }
  // a moulded cornice round the room
  for (const [a0, a1, b0, b1] of [[-h, h, cz - h, cz - h + 0.14], [-h, -h + 0.14, cz - h, cz + h], [h - 0.14, h, cz - h, cz + h]]) {
    S.span(K.basalt, a0, C - 0.32, b0, a1, C - 0.2, b1);
    S.span(K.friezeHall, a0, C - 0.2, b0, a1, C, b1);
  }
  // west niche (0.9 × 1.2 m at 1.0 m): Parvati, draped in a blue saree and garlanded, on a stepped seat
  const nz = cz - h - 0.02;
  S.span(K.dark, -0.45, Fl + 1.0, nz - 0.32, 0.45, Fl + 2.2, nz + 0.02);
  S.span(K.basalt, -0.58, Fl + 0.88, nz - 0.02, 0.58, Fl + 1.0, nz + 0.12); // sill
  for (const s2 of [-1, 1]) S.span(K.basalt, s2 * 0.52 - 0.07, Fl + 1.0, nz - 0.02, s2 * 0.52 + 0.07, Fl + 2.2, nz + 0.1);
  S.place(K.basalt, archFrameGeo(0.9, 0.85, 0.32, 0.12, 0.1, 7), 0, Fl + 1.0, nz + 0.04, 0);
  S.span(K.basalt, -0.3, Fl + 1.0, nz - 0.3, 0.3, Fl + 1.14, nz - 0.04);
  const fig = lathe([[0, 0], [0.17, 0], [0.18, 0.08], [0.15, 0.3], [0.12, 0.45], [0.13, 0.52], [0.1, 0.58], [0.06, 0.62], [0.065, 0.7], [0.05, 0.76], [0, 0.78]], 20);
  S.place(K.saree, fig, 0, Fl + 1.14, nz - 0.17, 0, [1, 1, 0.7]);
  S.place(K.mukutGold, lathe([[0, 0], [0.05, 0], [0.045, 0.05], [0.025, 0.1], [0, 0.12]], 12), 0, Fl + 1.14 + 0.76, nz - 0.17);
  O.strand(new THREE.Vector3(-0.13, Fl + 1.72, nz - 0.08), new THREE.Vector3(0.13, Fl + 1.72, nz - 0.08), 0.32, 0.8);
  O.strand(new THREE.Vector3(-0.4, Fl + 2.12, nz + 0.06), new THREE.Vector3(0.4, Fl + 2.12, nz + 0.06), 0.18, 1.0);
  // a shelf beside it with a silver kalash and a small lamp
  S.span(K.basalt, 0.75, Fl + 1.15, nz - 0.25, 1.35, Fl + 1.22, nz + 0.02);
  Gd.place(K.silver, kalashGeo(0.24), 1.1, Fl + 1.22, nz - 0.12);
  flames.points.push(new THREE.Vector3(0.88, Fl + 1.3, nz - 0.1));
  // white marble floor (0.6 m slabs), open only where the hollow sinks
  const kI = 0.34;
  for (const [a0, a1, b0, b1] of [[-h, h, -h, -kI], [-h, h, kI, h], [-h, -kI, -kI, kI], [kI, h, -kI, kI]]) {
    S.span(K.sanctumMarble, a0, Fl - 0.05, cz + b0, a1, Fl, cz + b1);
  }
  // water-dark smears where the abhisheka water runs and the priests sit
  const smear = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  for (const [x, z, sx, sz] of [[1.4, cz, 0.26, 0.34], [0.15, cz + 0.98, 0.55, 0.16], [-0.92, cz + 0.25, 0.18, 0.5], [0.55, cz - 0.86, 0.32, 0.13]] as const) {
    const m = new THREE.Mesh(smear, K.wetFilm);
    m.position.set(x, Fl + 0.002, z);
    m.scale.set(sx, 1, sz);
    m.renderOrder = 1;
    g.add(m);
  }
  // the doorway's inner face clad in repoussé silver (jambs, lintel, threshold), as at the darshan door
  {
    const zi = cz + h;
    for (const sx of [-1, 1]) S.span(K.silverEmb, sx * 0.62 - (sx > 0 ? 0 : 0.16), Fl, zi - 0.05, sx * 0.62 + (sx > 0 ? 0.16 : 0), Fl + 2.5, zi);
    S.span(K.silverEmb, -0.78, Fl + 2.5, zi - 0.05, 0.78, Fl + 2.72, zi);
    S.place(K.silver, archFrameGeo(1.24, 2.05, 0.4, 0.06, 0.04, 7), 0, Fl, zi - 0.06, Math.PI);
    S.span(K.silver, -0.62, Fl, zi - 0.1, 0.62, Fl + 0.04, zi);
  }
  // inverted lotus in the ceiling
  const lot = lathe([[0, 0], [0.9, 0], [0.85, -0.05], [0.6, -0.12], [0.3, -0.18], [0, -0.2]], 32, 16, 0.08);
  S.place(K.basalt, lot, 0, C, cz);
  P.floor(g, -h, h, cz - h, cz + h, Fl);

  // ---------- the jalahari (off02, off10): ONE continuous silver-sheathed yoni — a round basin ≈ 1.5 m across
  // flaring in smooth concave curves into a broad tapering pranala to the north, its kerb ≈ 0.12 m high with a
  // repoussé top band and a rope moulding; inside, a bed heaped with marigold, mogra and bel leaves round the
  // small silver-framed hollow of the three lingas ----------
  const y0 = Fl;
  // the pradakshina ring (r ≈ 1.75) must pass the pranala's tip, so the yoni sits 8 cm south of the axis
  const JX = -0.08;
  const RO = 0.75, kH = 0.12, TIP = 1.32;
  /** the yoni outline in the shape plane (x = north along the pranala, y = −world z) */
  const yoni = (R: number, tip: number, wt: number, th0: number, k1: number) => {
    const pts: THREE.Vector2[] = [];
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const a = th0 + (i / N) * (Math.PI * 2 - 2 * th0);
      pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R));
    }
    const p0 = new THREE.Vector2(Math.cos(th0) * R, -Math.sin(th0) * R);
    const t0 = new THREE.Vector2(Math.sin(th0), Math.cos(th0));
    const cr = Math.min(0.045, wt * 0.45);
    const flare = new THREE.CubicBezierCurve(p0, p0.clone().addScaledVector(t0, k1), new THREE.Vector2(tip - (tip - p0.x) * 0.45, -wt), new THREE.Vector2(tip - cr, -wt));
    pts.push(...flare.getPoints(18).slice(1));
    // rounded corners at the tip
    for (let i = 1; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(tip - cr + Math.cos(a) * cr, -wt + cr + Math.sin(a) * cr)); }
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(tip - cr + Math.cos(a) * cr, wt - cr + Math.sin(a) * cr)); }
    const back = flare.getPoints(18).reverse().slice(1, -1).map((v) => new THREE.Vector2(v.x, -v.y));
    pts.push(...back);
    return pts;
  };
  const outerPts = yoni(RO, TIP, 0.2, 0.86, 0.22);
  const innerPts = yoni(RO - 0.13, TIP - 0.1, 0.075, 0.62, 0.2);
  const kerb = new THREE.Shape(outerPts);
  kerb.holes.push(new THREE.Path(innerPts));
  const kerbG = new THREE.ExtrudeGeometry(kerb, { depth: kH, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
  kerbG.rotateX(-Math.PI / 2);
  S.place(K.silverEmb, clean(kerbG), JX, y0, cz);
  // a rope moulding running round the whole outer top edge (basin and pranala alike)
  const ropePath = new THREE.CatmullRomCurve3(outerPts.filter((_, i) => i % 2 === 0).map((v) => new THREE.Vector3(v.x * 0.985, 0, -v.y * 0.985)), true);
  S.place(K.silver, clean(new THREE.TubeGeometry(ropePath, 220, 0.017, 6, true)), JX, y0 + kH + 0.012, cz);
  const ropeIn = new THREE.CatmullRomCurve3(innerPts.filter((_, i) => i % 2 === 0).map((v) => new THREE.Vector3(v.x * 1.01, 0, -v.y * 1.01)), true);
  S.place(K.silver, clean(new THREE.TubeGeometry(ropeIn, 200, 0.011, 5, true)), JX, y0 + kH + 0.008, cz);
  // the bed inside the kerb: a low mound under the flowers, open over the hollow
  const R = 0.2, D = 0.12;
  const bedS = new THREE.Shape(innerPts.map((v) => v.clone().multiplyScalar(1.01)));
  const hole = new THREE.Path();
  hole.absarc(0, 0, R + 0.05, 0, Math.PI * 2, true);
  bedS.holes.push(hole);
  const bedG = new THREE.ShapeGeometry(bedS, 6).rotateX(-Math.PI / 2);
  {
    // dome it a little: highest half-way between the hollow and the kerb, running down the pranala
    const p = bedG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const ring = Math.max(0, Math.sin(Math.min(1, Math.max(0, (r - R - 0.05) / (RO - 0.13 - R - 0.05))) * Math.PI));
      p.setY(i, 0.05 + 0.035 * ring * (x > RO - 0.2 ? Math.max(0.2, 1 - (x - RO + 0.2) / 0.5) : 1));
    }
    bedG.computeVertexNormals();
  }
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x18280c, roughness: 0.9 });
  S.place(bedMat, bedG, JX, y0, cz);
  // the hollow: a smooth basin of wet black stone, its lip framed by a silver ring
  const lip = lathe([[R + 0.06, 0.05], [R + 0.03, 0.045], [R + 0.01, 0.025], [R, 0]], 40);
  S.place(K.wetStone, lip, JX, y0, cz);
  S.place(K.silverEmb, clean(new THREE.TorusGeometry(R + 0.055, 0.016, 8, 56).rotateX(Math.PI / 2)), JX, y0 + 0.055, cz);
  const bowl = lathe([[R, 0], [R - 0.02, -D * 0.45], [R - 0.07, -D * 0.82], [R - 0.14, -D], [0, -D]], 40);
  bowl.scale(1, 1, -1);
  bowl.computeVertexNormals();
  S.place(K.wetStone, bowl, JX, y0, cz);
  // the three lingas, worn thumbs of black stone, corners of a triangle (Brahma, Vishnu, Mahesh)
  const lingas: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    const p = new THREE.Vector3(JX + Math.cos(a) * 0.068, y0 - D, cz + Math.sin(a) * 0.068);
    lingas.push(p);
    S.place(K.lingam, thumbLinga(0.032 + i * 0.002, 0.078 + (i === 1 ? 0.008 : 0), i * 2.3 + 0.7), p.x, p.y, p.z);
  }
  // water: always welling up; surface just below the lingas' crowns, shimmering
  const wn = waterNormals();
  wn.repeat.set(3, 3);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1c2622, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.72, envMap: K.lingam.envMap, envMapIntensity: 2.2,
    normalMap: wn, normalScale: new THREE.Vector2(0.18, 0.18), depthWrite: false,
  });
  const wy = y0 - D + 0.05;
  const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.045, 40).rotateX(-Math.PI / 2), waterMat);
  water.position.set(JX, wy, cz);
  water.renderOrder = 2;
  g.add(water);
  // the outflow: a wet film running out of the pranala's lip and down onto the marble (water leaves the north)
  const film = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07).rotateX(-Math.PI / 2), waterMat);
  film.position.set(JX + TIP - 0.07, y0 + kH + 0.016, cz);
  g.add(film);
  // seep: rings spreading from the foot of the Mahesh linga
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff2dc, transparent: true, opacity: 0.25, depthWrite: false });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.024, 32).rotateX(-Math.PI / 2), ringMat.clone());
    r.position.set(lingas[0].x, wy + 0.001, lingas[0].z);
    r.renderOrder = 3;
    g.add(r);
    rings.push(r);
  }
  // the abhisheka patra: a small copper pot (≈ 0.22 m) with a drip spout, hung on three fine chains from a
  // ring on a single chain from the ceiling; it ends 1.4 m above the floor and lets fall one drop at a time
  const jy = y0 + 1.4;
  const copper = new THREE.MeshStandardMaterial({ color: 0xc8714a, metalness: 0.9, roughness: 0.3, envMap: K.lingam.envMap, envMapIntensity: 1.6, emissive: 0x3a1a0a, emissiveIntensity: 0.4 });
  S.place(copper, lathe([[0.012, -0.035], [0.02, -0.02], [0.07, 0.02], [0.105, 0.08], [0.1, 0.13], [0.07, 0.17], [0.055, 0.18], [0.07, 0.2], [0.065, 0.205], [0.05, 0.19], [0, 0.19]], 24), JX, jy, cz);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const top = new THREE.Vector3(JX, jy + 0.55, cz), bot = new THREE.Vector3(JX + Math.cos(a) * 0.068, jy + 0.2, cz + Math.sin(a) * 0.068);
    const ch = new THREE.CylinderGeometry(0.0035, 0.0035, top.distanceTo(bot), 4).translate(0, top.distanceTo(bot) / 2, 0);
    ch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize()));
    S.place(K.silver, ch, bot.x, bot.y, bot.z);
  }
  S.place(K.silver, clean(new THREE.TorusGeometry(0.03, 0.006, 6, 16)), JX, jy + 0.57, cz);
  S.box(K.silver, 0.007, C - jy - 0.6, 0.007, JX, jy + 0.6, cz);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xeef4f4, roughness: 0.05, transparent: true, opacity: 0.6, envMap: K.lingam.envMap, depthWrite: false });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6).scale(1, 1.6, 1), dropMat);
  drop.position.set(JX, jy - 0.04, cz);
  drop.renderOrder = 3;
  g.add(drop);
  // collider: the basin (an octagon of boxes) and the pranala
  P.solid(JX - RO, Fl, cz - RO * 0.42, JX + RO, Fl + 0.6, cz + RO * 0.42);
  P.solid(JX - RO * 0.42, Fl, cz - RO, JX + RO * 0.42, Fl + 0.6, cz + RO);
  P.solid(JX - RO * 0.72, Fl, cz - RO * 0.72, JX + RO * 0.72, Fl + 0.6, cz + RO * 0.72);
  P.solid(JX + RO * 0.7, Fl, cz - 0.3, JX + TIP - 0.25, Fl + 0.6, cz + 0.3);
  P.solid(JX + TIP - 0.25, Fl, cz - 0.2, JX + TIP, Fl + 0.6, cz + 0.2);

  // ---------- the flower field (off10, off02): ≈ 1,000 instanced heads — a band of marigold against the
  // kerb, a band of white mogra and jasmine, then bel leaves heaped towards the hollow and filling the
  // pranala, leaving a clear ring round the hollow; a few roses and garlands over the top ----------
  const inside = (x: number, z: number, m: number) => {
    // inside the inner outline by margin m (point-in-polygon on the shape plane, then distance to edges)
    const px = x, py = -z;
    let inn = false;
    for (let i = 0, j = innerPts.length - 1; i < innerPts.length; j = i++) {
      const a = innerPts[i], b = innerPts[j];
      if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inn = !inn;
    }
    if (!inn) return false;
    for (let i = 0, j = innerPts.length - 1; i < innerPts.length; j = i++) {
      const a = innerPts[i], b = innerPts[j], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(px - a.x - dx * t, py - a.y - dy * t) < m) return false;
    }
    return true;
  };
  const bedY = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    const ring = Math.max(0, Math.sin(Math.min(1, Math.max(0, (r - R - 0.05) / (RO - 0.13 - R - 0.05))) * Math.PI));
    return y0 + 0.05 + 0.035 * ring * (x > RO - 0.2 ? Math.max(0.2, 1 - (x - RO + 0.2) / 0.5) : 1);
  };
  // the field is its own instanced set (flowers.ts), drawn only when the camera is near (see below).
  // Layered jittered grids: a band of marigold heaped two deep against the kerb (to the rim's height),
  // a band of mogra clusters, then bel leaves piled 2-3 deep towards the hollow and filling the pranala,
  // a few roses among them; a clear ring round the silver lip of the hollow.
  const FB = new FlowerBed(29);
  const field = new THREE.Group();
  field.name = 'jalahari-flowers';
  g.add(field);
  const MGC = [0xff4800, 0xf04000, 0xff5800, 0xe03800, 0xff6a00, 0xff9000, 0xf05000];
  const BELC = [0x4f8a2a, 0x3f7a22, 0x5a9432, 0x36691c, 0x689c3a];
  const fr = rand;
  const grid = (step: number, cb: (x: number, z: number) => void) => {
    for (let gx = -RO; gx < TIP; gx += step) for (let gz = -RO; gz < RO; gz += step) cb(gx + fr() * step, gz + fr() * step);
  };
  // marigold: two layers, the upper one offset, heaped highest at the middle of the band
  for (const layer of [0, 1]) {
    grid(layer ? 0.044 : 0.04, (x, z) => {
      const r = Math.hypot(x, z);
      if (r < R + 0.1 || !inside(x, z, 0.018) || inside(x, z, 0.125)) return;
      if (x > RO - 0.12 && Math.abs(z) < 0.2) return;
      const y = bedY(x, z) + 0.035 + layer * 0.028 + fr() * 0.014;
      FB.add('marigold', JX + x, y, cz + z, 0.85 + fr() * 0.35, MGC[Math.floor(fr() * MGC.length)], 0.5);
    });
  }
  // mogra band
  for (const layer of [0, 1]) {
    grid(0.032, (x, z) => {
      const r = Math.hypot(x, z);
      if (r < R + 0.1 || !inside(x, z, 0.12) || inside(x, z, 0.205)) return;
      if (x > RO - 0.12 && Math.abs(z) < 0.2) return;
      FB.add('mogra', JX + x, bedY(x, z) + 0.018 + layer * 0.018 + fr() * 0.008, cz + z, 1.1 + fr() * 0.4, 0xffffff, 0.6);
    });
  }
  // bel leaves: three layers, tilted, over the inner field and the pranala
  for (const layer of [0, 1, 2]) {
    grid(0.05, (x, z) => {
      const r = Math.hypot(x, z);
      const spout = x > RO - 0.12 && Math.abs(z) < 0.2;
      if (r < R + 0.085 || !inside(x, z, 0.012)) return;
      if (!spout && !inside(x, z, 0.19)) return;
      FB.add('bel', JX + x, bedY(x, z) + 0.004 + layer * 0.012 + fr() * 0.006, cz + z, 0.95 + fr() * 0.35, BELC[Math.floor(fr() * BELC.length)], 0.55);
      if (layer === 2 && fr() < 0.07) FB.add('rose', JX + x, bedY(x, z) + 0.045, cz + z, 0.8 + fr() * 0.3, fr() < 0.7 ? 0xb3101c : 0xd8305a, 0.4);
      if (layer === 2 && spout && fr() < 0.25) FB.add('marigold', JX + x, bedY(x, z) + 0.04, cz + z, 0.8, MGC[1], 0.4);
    });
  }
  // bel leaves and flowers on the lingas and floating in the hollow
  lingas.forEach((p, i) => {
    O.add('bel', p.x + 0.01, wy + 0.012, p.z - 0.01, 0.75, undefined, i * 2.1, 0.5);
  });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.1 + (i % 3) * 0.022;
    O.add(i % 3 === 0 ? 'bel' : 'petal', JX + Math.cos(a) * r, wy + 0.003, cz + Math.sin(a) * r, 0.8, undefined, a, 0.2);
  }
  // a marigold-and-mogra garland laid on the kerb's back, and loose offerings on the floor
  O.scatter(-1.6, 1.6, cz - 1.7, cz + 1.7, Fl, 26, 0.5);

  // ---------- the silver prabhavali (off02): a repoussé silver arch ≈ 1.2 m tall and ≈ 0.95 m wide standing
  // right on the back (west) edge of the jalahari, with a white flower crest; a low silver step joins it to
  // the kerb so the two read as one ----------
  const pz = cz - RO + 0.02;
  {
    const pw = 0.95, ph = 1.22, spring = 0.72;
    const archPts = (w: number, sp: number, top: number, y0b: number) => {
      const a = new THREE.Shape();
      a.moveTo(-w / 2, y0b);
      a.lineTo(w / 2, y0b);
      a.lineTo(w / 2, sp);
      // an ogee crown with a pointed top
      a.bezierCurveTo(w / 2, sp + 0.28 * (w / pw), 0.18 * (w / pw), top - 0.18 * (w / pw), 0, top);
      a.bezierCurveTo(-0.18 * (w / pw), top - 0.18 * (w / pw), -w / 2, sp + 0.28 * (w / pw), -w / 2, sp);
      a.lineTo(-w / 2, y0b);
      return a;
    };
    // a broad repoussé frame (≈ 0.2 m band) round an open arch, as in off02: one sees through it
    const outer = archPts(pw, spring, ph, 0);
    const innerA = archPts(pw - 0.4, spring - 0.02, ph - 0.24, 0.16);
    outer.holes.push(new THREE.Path(innerA.getPoints(24).reverse()));
    const plateG = new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 16 });
    plateG.translate(0, 0, -0.025);
    const prabSilver = K.silverEmb.clone();
    prabSilver.envMapIntensity = 2.8;
    prabSilver.emissiveIntensity = 0.55;
    S.place(prabSilver, clean(plateG), JX, y0 + 0.1, pz - 0.06);
    // polished rope beads along both edges and a lotus-bud finial
    for (const [sh, rr] of [[archPts(pw + 0.02, spring, ph + 0.01, 0), 0.02], [archPts(pw - 0.42, spring - 0.02, ph - 0.25, 0.16), 0.016]] as const) {
      const pts = sh.getPoints(30).map((v) => new THREE.Vector3(v.x, v.y, 0));
      pts.pop();
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false), 120, rr, 6, false);
      S.place(K.silver, clean(tube), JX, y0 + 0.1, pz - 0.035);
    }
    S.place(K.silver, lathe([[0, 0], [0.07, 0], [0.055, 0.05], [0.08, 0.09], [0.03, 0.16], [0, 0.18]], 16), JX, y0 + 0.1 + ph - 0.02, pz - 0.06);
    const pl = new THREE.PointLight(0xfff0d8, 1.2, 2.4, 1.6);
    pl.position.set(JX, Fl + 1.3, pz + 0.9);
    g.add(pl);
    // the step: a silver plinth running under the arch and over the kerb's back
    S.span(K.silverEmb, JX - 0.55, y0, pz - 0.2, JX + 0.55, y0 + 0.1, pz + 0.06);
    O.heap(JX, y0 + 0.1 + ph - 0.05, pz - 0.04, 0.09, 0.07, 14);
    O.strand(new THREE.Vector3(JX - 0.46, y0 + 0.86, pz + 0.01), new THREE.Vector3(JX + 0.46, y0 + 0.86, pz + 0.01), 0.5, 0.7);
    P.solid(JX - 0.55, Fl, pz - 0.2, JX + 0.55, Fl + 1.3, pz + 0.06);
  }

  // ---------- the puja things round it (off02): a silver chowki with a lamp and a kalash, a brass thali
  // with a lota and a conch, a copper panchapatra ----------
  {
    const cx = JX + 0.78, cz2 = pz - 0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box(K.silver, 0.03, 0.3, 0.03, cx + sx * 0.18, Fl, cz2 + sz * 0.12);
    S.span(K.silverEmb, cx - 0.21, Fl + 0.3, cz2 - 0.15, cx + 0.21, Fl + 0.35, cz2 + 0.15);
    Gd.place(K.silver, kalashGeo(0.2), cx + 0.08, Fl + 0.35, cz2);
    Gd.place(K.brass, lathe([[0, 0], [0.04, 0], [0.03, 0.02], [0.012, 0.04], [0.012, 0.1], [0.05, 0.12], [0.06, 0.135], [0, 0.13]], 14), cx - 0.1, Fl + 0.35, cz2);
    flames.points.push(new THREE.Vector3(cx - 0.1 + 0.045, Fl + 0.5, cz2));
    // the thali on the floor at the south-west
    const tx = JX - 1.0, tz = cz - 0.35;
    Gd.place(K.brass, lathe([[0, 0], [0.2, 0], [0.22, 0.02], [0.215, 0.025], [0, 0.012]], 32), tx, Fl, tz);
    Gd.place(K.brass, lathe([[0, 0], [0.04, 0], [0.065, 0.05], [0.06, 0.09], [0.035, 0.12], [0.04, 0.14], [0, 0.135]], 18), tx + 0.08, Fl + 0.012, tz);
    Gd.place(copper, lathe([[0, 0], [0.035, 0], [0.04, 0.06], [0.036, 0.07], [0, 0.065]], 16), tx - 0.08, Fl + 0.012, tz + 0.06);
    O.heap(tx - 0.06, Fl + 0.02, tz - 0.08, 0.06, 0.03, 8);
    // a low silver chowki before the jalahari with the day's flower heap (off02, off10)
    const fx = JX - 0.1, fz = cz + RO + 0.22;
    S.span(K.silverEmb, fx - 0.3, Fl, fz - 0.12, fx + 0.3, Fl + 0.06, fz + 0.12);
    O.heap(fx, Fl + 0.07, fz, 0.2, 0.06, 40);
  }

  // ---------- the mukhavata and mukut (Mondays and festivals): a gold three-faced mask seated on the
  // hollow under a tall gem-set conical crown (off01, off03, off09). Shown with ?mukut=1 or the M key.
  // Simplified and respectful: smooth gold faces with only a red tilak and the third-eye mark. ----------
  const mk = new THREE.Group();
  mk.position.set(JX, Fl + 0.02, cz);
  g.add(mk);
  const MG = new Merger(P, 'mukut');
  // seat: a silver cushion ring over the hollow
  MG.place(K.silver, lathe([[0, 0], [0.3, 0], [0.32, 0.04], [0.28, 0.08], [0, 0.08]], 32), 0, 0, 0);
  // three faces round a core, front (east) and the two sides
  const face = new THREE.SphereGeometry(0.15, 24, 16, Math.PI * 0.08, Math.PI * 0.84, 0.2, 2.3);
  face.scale(0.95, 1.3, 0.8);
  const nose = new THREE.SphereGeometry(0.025, 10, 8).scale(0.7, 1.6, 0.9);
  for (const [ry, dist] of [[0, 0.135], [Math.PI / 2.2, 0.12], [-Math.PI / 2.2, 0.12]] as const) {
    const fx = Math.sin(ry) * dist, fz = Math.cos(ry) * dist;
    MG.place(K.mukutGold, face, fx, 0.28, fz, ry);
    MG.place(K.mukutGold, nose, fx + Math.sin(ry) * 0.105, 0.27, fz + Math.cos(ry) * 0.105, ry);
    MG.place(K.kumkum, new THREE.BoxGeometry(0.012, 0.05, 0.006), fx + Math.sin(ry) * 0.11, 0.36, fz + Math.cos(ry) * 0.11, ry);
  }
  MG.place(K.mukutGold, lathe([[0, 0], [0.17, 0], [0.16, 0.1], [0.12, 0.16], [0.12, 0.4], [0.18, 0.44], [0, 0.44]], 32), 0, 0.08, 0);
  // the conical mukut: tiers of gold bands set with gems, a lotus bud on top
  // (off03) a tall gem-set crown: nearly cylindrical tiers rising to a rounded dome and a lotus bud
  const crown = lathe([[0, 0], [0.21, 0], [0.22, 0.03], [0.2, 0.06], [0.205, 0.12], [0.19, 0.15], [0.19, 0.24], [0.18, 0.27], [0.18, 0.36],
    [0.17, 0.39], [0.165, 0.46], [0.14, 0.52], [0.1, 0.57], [0.05, 0.6], [0.06, 0.63], [0.025, 0.68], [0, 0.7]], 40, 28, 0.04);
  MG.place(K.mukutGold, crown, 0, 0.5, 0);
  const gems: { pos: THREE.Vector3; col: number }[] = [];
  const cols3 = [0xc0102a, 0x0e8a4a, 0xf2f6ff];
  for (const [r, yy, n] of [[0.215, 0.59, 30], [0.2, 0.67, 28], [0.195, 0.75, 28], [0.185, 0.83, 26], [0.172, 0.92, 24], [0.13, 1.01, 16], [0.07, 1.08, 10]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      gems.push({ pos: new THREE.Vector3(Math.cos(a) * r, yy, Math.sin(a) * r), col: cols3[(i + Math.round(yy * 10)) % 3] });
    }
  }
  MG.flush(mk, false);
  const gemGeo = new THREE.OctahedronGeometry(0.011, 0);
  const gemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, envMap: K.lingam.envMap, envMapIntensity: 3, emissive: 0x222222 });
  const gi = new THREE.InstancedMesh(gemGeo, gemMat, gems.length);
  gems.forEach((gm, i) => {
    gi.setMatrixAt(i, new THREE.Matrix4().makeTranslation(gm.pos.x, gm.pos.y, gm.pos.z));
    gi.setColorAt(i, new THREE.Color(gm.col));
  });
  mk.add(gi);
  const showMukut = (on: boolean) => { mk.visible = on; };
  showMukut(/[?&]mukut=1/.test(location.search));
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') showMukut(!mk.visible); });

  // ---------- lamps (off02, off10): two tall turned brass samai (≈ 1.4 m) right at the front corners of the
  // kerb, a third behind at the south-west of the prabhavali ----------
  // polished brass: yellow, metallic, the warm lamp light kept in it by a little emission
  const lampBrass = new THREE.MeshStandardMaterial({ color: 0xd4a64a, metalness: 1, roughness: 0.3, envMap: K.lingam.envMap, envMapIntensity: 1.8, emissive: 0x4a3208, emissiveIntensity: 0.55 });
  // a turned brass samai (off10, off02): a wide stepped foot, three knops between crisp discs up a slender
  // stem, a broad lamp dish with five spouted wicks, and a little peacock crowning it. Built of separate
  // turned pieces so every disc edge stays sharp.
  const samai = (() => {
    const parts: THREE.BufferGeometry[] = [];
    const disc = (r: number, h: number, y: number) => parts.push(clean(new THREE.CylinderGeometry(r, r, h, 32).translate(0, y + h / 2, 0)));
    const turn = (prof: [number, number][]) => parts.push(lathe(prof, 32));
    disc(0.2, 0.022, 0);
    disc(0.175, 0.014, 0.022);
    turn([[0.17, 0.036], [0.15, 0.055], [0.1, 0.08], [0.06, 0.1], [0.045, 0.12], [0, 0.12]]);
    const knop = (y: number, h: number, r: number) => {
      disc(r * 0.85, 0.012, y);
      turn([[0.03, y + 0.012], [r * 0.85, y + 0.012 + h * 0.25], [r, y + 0.012 + h * 0.5], [r * 0.8, y + 0.012 + h * 0.8], [0.03, y + 0.012 + h], [0, y + 0.012 + h]]);
      disc(r * 0.8, 0.012, y + 0.012 + h);
      return y + 0.024 + h;
    };
    let y = knop(0.12, 0.09, 0.07);
    parts.push(clean(new THREE.CylinderGeometry(0.026, 0.03, 0.26, 20).translate(0, y + 0.13, 0)));
    y = knop(y + 0.26, 0.1, 0.075);
    parts.push(clean(new THREE.CylinderGeometry(0.022, 0.026, 0.24, 20).translate(0, y + 0.12, 0)));
    y = knop(y + 0.24, 0.07, 0.06);
    parts.push(clean(new THREE.CylinderGeometry(0.02, 0.022, 0.1, 20).translate(0, y + 0.05, 0)));
    y += 0.1;
    disc(0.05, 0.012, y);
    y += 0.012;
    // the lamp dish
    turn([[0.03, y], [0.09, y + 0.02], [0.17, y + 0.045], [0.205, y + 0.065], [0.21, y + 0.072], [0.19, y + 0.07], [0.04, y + 0.05], [0, y + 0.05]]);
    const dishY = y;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const sp = new THREE.ConeGeometry(0.018, 0.06, 10).rotateZ(-Math.PI / 2 - 0.25).translate(0.225, dishY + 0.07, 0).rotateY(-a);
      parts.push(clean(sp));
    }
    // the crown: a short stem and a peacock with its tail fanned
    parts.push(clean(new THREE.CylinderGeometry(0.01, 0.014, 0.08, 10).translate(0, dishY + 0.09, 0)));
    const pc = new THREE.Shape();
    pc.moveTo(-0.05, 0); pc.quadraticCurveTo(-0.06, 0.03, -0.03, 0.045); pc.quadraticCurveTo(-0.01, 0.05, 0.005, 0.07);
    pc.lineTo(0.012, 0.11); pc.quadraticCurveTo(0.02, 0.125, 0.032, 0.115); pc.lineTo(0.022, 0.1); pc.lineTo(0.025, 0.06);
    pc.quadraticCurveTo(0.04, 0.03, 0.03, 0.0); pc.lineTo(-0.05, 0);
    const tail = new THREE.Shape();
    tail.moveTo(-0.04, 0.01); tail.quadraticCurveTo(-0.13, 0.05, -0.12, 0.14); tail.quadraticCurveTo(-0.07, 0.12, -0.02, 0.04); tail.lineTo(-0.04, 0.01);
    for (const sh of [pc, tail]) parts.push(clean(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 6 }).translate(0, dishY + 0.13, -0.007)));
    return { geo: mergeGeometries(parts)!, dishY };
  })();
  for (const [x, z, col] of [[JX + 0.8, cz + RO + 0.17, true], [JX - 0.8, cz + RO + 0.17, true], [JX - 0.62, pz - 0.25, false]] as const) {
    Gd.place(lampBrass, samai.geo, x, Fl, z, x > JX ? 0.4 : -0.4);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const ry = x > JX ? 0.4 : -0.4;
      flames.points.push(new THREE.Vector3(x + Math.cos(a - ry) * 0.25, Fl + samai.dishY + 0.1, z + Math.sin(a - ry) * 0.25));
    }
    if (col) P.solid(x - 0.14, Fl, z - 0.14, x + 0.14, Fl + 1.4, z + 0.14);
  }

  // a soft white light high above the hollow, as in the darshan photographs
  // (the sanctum is lit by white tube lights as well as lamps: the marble reads white in every photograph)
  const topL = new THREE.PointLight(0xf2f4ff, 5.0, 7, 1.3);
  topL.position.set(0.2, C - 0.35, cz + 0.3);
  g.add(topL);
  for (const [x, z, inten] of [[0.9, cz + 0.6, 1.5], [-0.9, cz - 0.7, 1.2]] as const) {
    const l = new THREE.PointLight(0xffd2a0, inten * 0.45, 4, 1.8);
    l.position.set(x, Fl + 1.6, z);
    g.add(l);
    flames.lights.push(l);
  }

  S.flush(g, false);
  Gd.flush(g, false);
  FB.flush(field);
  // the field's thousand heads are drawn only when the camera is within 14 m of the sanctum (hall, antarala,
  // sanctum): from the courtyard they are behind walls anyway
  const fc = new THREE.Vector3(JX, Fl, cz);
  for (const o of field.children) {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh) continue;
    const full = im.count;
    im.onBeforeRender = (_r, _s, cam) => { im.count = cam.position.distanceToSquared(fc) < 196 ? full : 0; };
  }

  return {
    field,
    update(time: number) {
      wn.offset.set(time * 0.03, time * 0.021);
      rings.forEach((r, i) => {
        const ph = (time * 0.5 + i / 3) % 1;
        const s = 1 + ph * 3.2;
        r.scale.set(s, 1, s);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - ph);
      });
      // one drop every 1.6 s from the patra's spout to the hollow
      const dp = (time / 1.6) % 1, fall = Math.min(1, dp * 2.2);
      drop.position.y = jy - 0.04 - (jy - 0.04 - wy) * fall * fall;
      drop.visible = dp < 0.45;
    },
  };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { BM } from './mats';
import { Merger } from './merge';
import { lathe, kalashGeo, archFrameGeo, clean } from './forms';
import type { Offerings } from './offerings';
import { GARBHA } from './layout';

/**
 * The garbhagriha and the Bhimashankar Jyotirlinga.
 *
 * The sanctum is a small dark stone room below the mandapa (five steps down). In the middle of its floor
 * lies a large silver jalahari — a tear-drop basin with a tall repoussé rim edged in gilt, its spout to the
 * north ending in a silver drain grille (photograph on the temple trust's site, shreebhimashankar.com).
 * Inside, sunk below the rim, is the black-stone pitha; its own inner outline is traced every day with a
 * thick band of marigold, and the space between is packed with white mogra and tuberose.
 *
 * The swayambhu lingam itself is low and broad, barely rising above the pitha, and is famously divided: a
 * vertical cleft runs through it, so that it reads as two lobes — Shiva and Shakti (Ardhanarishvara)
 * (trust: "a vertical hole … two parts"). It is usually hidden under a silver cover; the bare stone (nija
 * rupa) is seen only at the early-morning puja, which is what is shown here, wet from abhisheka, heaped at
 * its foot with bel leaves, roses and tuberose. A brass railing with inscribed plates surrounds the basin;
 * an image of Parvati stands in a silver frame on the west wall facing it. No faces are modelled.
 *
 * Scale (vs 1.62 m eyes): basin 2.0 m long × 1.16 m wide, rim 0.3 m high; lingam ≈ 0.36 × 0.3 m, 0.15 m high.
 */

export interface SanctumOut { update(t: number): void; lights: THREE.PointLight[] }

/** tear-drop outline in (u along the spout, v across): circle radius r at the origin, spout to u = L of half-width w */
function teardrop(r: number, L: number, w: number, n = 64): THREE.Vector2[] {
  const th = Math.acos(Math.min(0.95, (r - w) / Math.max(L, r + 0.01)) ) * 0.92;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = th + (i / n) * (Math.PI * 2 - 2 * th);
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  // the spout: straight-ish sides with a gentle waist, squared end
  const a0 = pts[pts.length - 1], a1 = pts[0];
  const m = 8;
  for (let i = 1; i <= m; i++) {
    const t = i / m;
    pts.push(new THREE.Vector2(a0.x + (L - a0.x) * t, a0.y + (-w - a0.y) * Math.pow(t, 0.7)));
  }
  for (let i = 0; i < m; i++) {
    const t = 1 - i / m;
    pts.push(new THREE.Vector2(a1.x + (L - a1.x) * t, a1.y + (w - a1.y) * Math.pow(t, 0.7)));
  }
  return pts;
}

/** the swayambhu lingam: a low, broad, uneven dome split by a deep vertical cleft (plane x = 0 locally) */
function lingamGeo() {
  const prof: [number, number][] = [[0, -0.02], [0.17, -0.02], [0.175, 0.01], [0.172, 0.04]];
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2);
    prof.push([0.172 * Math.cos(a), 0.04 + Math.sin(a) * 0.115]);
  }
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0005), y)), 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    // natural stone: a little oval and lumpy, higher on one side
    const k = 1 + 0.07 * Math.sin(a * 3 + 0.7) + 0.04 * Math.sin(a * 5 + 2.1);
    x *= 1.08 * k; z *= 0.92 * k;
    y *= 1 + 0.12 * Math.sin(a + 0.4);
    // the cleft: a groove ~3 cm wide, deepest at the crown, dying out toward the foot
    const g0 = Math.exp(-Math.pow(x / 0.022, 2));
    const depth = Math.max(0, y - 0.01) * 0.78;
    y -= g0 * depth;
    // the two lobes part slightly
    x += Math.sign(x) * 0.012 * Math.min(1, Math.max(0, y / 0.1)) * (1 - g0);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** text plate for the brass railing ("ॐ नमः शिवाय" / "हर हर महादेव"), gold on dark brass */
function plaqueTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a3a10';
  g.fillRect(0, 0, 512, 64);
  g.strokeStyle = '#e8b850'; g.lineWidth = 4; g.strokeRect(4, 4, 504, 56);
  g.fillStyle = '#f2c460';
  g.font = '700 38px Martel, "Noto Sans Devanagari", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ॐ नमः शिवाय  ·  हर हर महादेव', 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildSanctum(root: THREE.Group, K: BM, P: Physics, flames: Flames, O: Offerings): SanctumOut {
  const g = new THREE.Group();
  g.name = 'garbhagriha';
  root.add(g);
  const S = new Merger(P, 'sanctum');
  const Gd = new Merger(P, 'sanctum-gold');
  const cz = GARBHA.cz, Fl = GARBHA.floor, h = GARBHA.inner, C = GARBHA.ceil;

  // ---------- the room: dark basalt, a silver dado on three walls, polished black floor, lotus ceiling ----------
  const t = 0.3;
  // round 3: black basalt blackened by lamp soot above the dado (oily where it is thickest)
  const SW = K.sootStone;
  S.span(SW, -h - t, Fl - 0.3, cz - h - t, h + t, C, cz - h); // west
  S.span(SW, -h - t, Fl - 0.3, cz - h, -h, C, cz + h); // south
  S.span(SW, h, Fl - 0.3, cz - h, h + t, C, cz + h); // north
  S.span(SW, -h - t, Fl - 0.3, cz + h, -0.62, C, cz + h + t); // east, beside the door
  S.span(SW, 0.62, Fl - 0.3, cz + h, h + t, C, cz + h + t);
  S.span(SW, -0.62, Fl + 2.3, cz + h, 0.62, C, cz + h + t);
  // a small corbelled ceiling: three stepped courses of 0.25 m closing in to a lotus slab
  const CB = 0.25, CY0 = C - 3 * CB;
  for (let i = 0; i < 3; i++) {
    const d = 0.22 * (i + 1), y0 = CY0 + i * CB;
    S.span(SW, -h, y0, cz - h, h, y0 + CB, cz - h + d);
    S.span(SW, -h, y0, cz + h - d, h, y0 + CB, cz + h);
    S.span(SW, -h, y0, cz - h + d, -h + d, y0 + CB, cz + h - d);
    S.span(SW, h - d, y0, cz - h + d, h, y0 + CB, cz + h - d);
  }
  S.span(SW, -h - t, C, cz - h - t, h + t, C + 0.3, cz + h + t);
  // the silver dado: one repoussé panel per half-wall with rope borders (not a tile grid)
  S.span(K.silverDadoX, -h, Fl, cz - h, h, Fl + 0.9, cz - h + 0.03);
  for (const [a0, a1] of [[-h, -h + 0.03], [h - 0.03, h]]) S.span(K.silverDadoZ, a0, Fl, cz - h, a1, Fl + 0.9, cz + h);
  S.span(K.silver, -h, Fl + 0.9, cz - h, h, Fl + 0.94, cz - h + 0.05);
  for (const sx of [-1, 1]) S.span(K.silver, sx > 0 ? h - 0.05 : -h, Fl + 0.9, cz - h, sx > 0 ? h : -h + 0.05, Fl + 0.94, cz + h);
  // the floor: black stone, damp but worn matt by feet (no mirror highlights)
  const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x24221f, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45, envMap: K.lingam.envMap, envMapIntensity: 0.6 });
  S.span(floorMat, -h, Fl - 0.06, cz - h, h, Fl, cz + h);
  const lot = lathe([[0, 0], [1.0, 0], [0.95, -0.05], [0.66, -0.13], [0.33, -0.2], [0, -0.22]], 32, 16, 0.08);
  S.place(SW, lot, 0, C, cz, 0, h - 0.66);
  P.floor(g, -h, h, cz - h, cz + h, Fl);

  // ---------- the silver jalahari ----------
  // basin centred at (bx, cz); the spout runs north (+x)
  const bx = -0.32, rimH = 0.24, R = 0.71, L = 1.56, W = 0.25;
  const outer = teardrop(R, L, W);
  const inner = teardrop(0.465, 1.43, 0.13);
  const toShape = (pts: THREE.Vector2[]) => new THREE.Shape(pts);
  const rimShape = toShape(outer);
  rimShape.holes.push(new THREE.Path(inner.slice().reverse()));
  // shape (u, v) → world (bx + u, y, cz − v) after rotateX(−π/2); extrude upward
  const rimG = new THREE.ExtrudeGeometry(rimShape, { depth: rimH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, curveSegments: 4 });
  rimG.rotateX(-Math.PI / 2);
  S.place(K.silverEmb, clean(rimG), bx, Fl, cz);
  // gilt edges along the top of the rim, inner and outer
  const edge = (pts: THREE.Vector2[], y: number, r: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(bx + p.x, y, cz - p.y)), true);
    return new THREE.TubeGeometry(curve, 160, r, 6, true);
  };
  Gd.add(K.goldIn, edge(outer, Fl + rimH + 0.02, 0.016));
  Gd.add(K.goldIn, edge(inner, Fl + rimH + 0.02, 0.014));
  Gd.add(K.goldIn, edge(teardrop(R + 0.012, L + 0.012, W + 0.012), Fl + 0.05, 0.012));
  // repoussé bands round the outer wall of the rim, and a broad bright gold band on the inner half of its top
  for (const yy of [0.08, 0.16]) Gd.add(K.silver, edge(teardrop(R + 0.008, L + 0.008, W + 0.008), Fl + yy, 0.014));
  // two stepped mouldings at the foot of the basin
  for (const [dr, hh] of [[0.06, 0.1], [0.11, 0.045]] as const) {
    const st = toShape(teardrop(R + dr, L + dr, W + dr));
    st.holes.push(new THREE.Path(teardrop(R - 0.02, L - 0.02, W - 0.02).slice().reverse()));
    const sg = new THREE.ExtrudeGeometry(st, { depth: hh, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
    S.place(K.silverEmb, clean(sg), bx, Fl, cz);
  }
  {
    const band = toShape(teardrop(0.56, 1.5, 0.17));
    band.holes.push(new THREE.Path(inner.slice().reverse()));
    const bg = new THREE.ShapeGeometry(band, 6).rotateX(-Math.PI / 2);
    const goldBand = new THREE.MeshStandardMaterial({ color: 0xffcf5a, metalness: 0.9, roughness: 0.25, envMap: K.lingam.envMap, envMapIntensity: 3.2, emissive: 0x8a5a10, emissiveIntensity: 0.55 });
    S.place(goldBand, clean(bg), bx, Fl + rimH + 0.024, cz);
  }
  // the black-stone pitha, sunk ~12 cm below the rim
  const bed = Fl + rimH - 0.12;
  const bedG = new THREE.ShapeGeometry(toShape(inner), 8);
  bedG.rotateX(-Math.PI / 2);
  S.place(K.wetStone, clean(bedG), bx, bed, cz);
  // inner yoni outline: a low black ridge, garlanded with marigold
  const yo = teardrop(0.36, 1.08, 0.1, 48);
  const yi = teardrop(0.31, 1.0, 0.06, 48);
  const ridge = toShape(yo);
  ridge.holes.push(new THREE.Path(yi.slice().reverse()));
  const ridgeG = new THREE.ExtrudeGeometry(ridge, { depth: 0.045, bevelEnabled: false, curveSegments: 4 });
  ridgeG.rotateX(-Math.PI / 2);
  S.place(K.lingam, clean(ridgeG), bx, bed, cz);
  // marigold band on the ridge, mogra between ridge and rim, white flowers filling the spout channel
  const along = (pts: THREE.Vector2[], step: number, fn: (x: number, z: number) => void) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.round(a.distanceTo(b) / step));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n);
        fn(bx + p.x, cz - p.y);
      }
    }
  };
  // the thick marigold rope traced on the yoni outline (two strands)
  along(teardrop(0.335, 1.04, 0.08, 72), 0.026, (x, z) => O.add('marigold', x, bed + 0.06, z, 0.85, 0xf0a010));
  along(teardrop(0.355, 1.07, 0.1, 72), 0.028, (x, z) => O.add('marigold', x, bed + 0.055, z, 0.75, 0xe8900a));
  // a dense white border of mogra and jasmine between the yoni and the silver rim
  for (const [r0, L0, w0] of [[0.39, 1.12, 0.12], [0.42, 1.18, 0.11], [0.45, 1.25, 0.08]] as const) {
    along(teardrop(r0, L0, w0, 72), 0.022, (x, z) => O.add('mogra', x, bed + 0.025, z, 0.75, 0xfbfaf2));
  }
  along(teardrop(0.43, 1.2, 0.1, 72), 0.02, (x, z) => O.add('jasmine', x, bed + 0.04, z, 1, undefined, Math.random() * 6, 1.4));
  // the spout inside the yoni: a white field of mogra with a few red roses
  // round 3: a heaped, irregular mound of mogra filling the whole channel, ~8–10 cm proud, a few yellow/orange
  let sd = 3;
  const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    const u = 0.3 + rr() * 0.76, wv = 0.105 * (1 - (u - 0.3) * 0.45);
    const v = (rr() * 2 - 1) * wv;
    const crown = 1 - Math.pow(Math.abs(v) / wv, 2);
    const y = bed + 0.02 + crown * (0.05 + rr() * 0.035);
    const k = rr();
    O.add(k < 0.05 ? 'marigold' : 'mogra', bx + u, y, cz - v, 0.6 + rr() * 0.55, k < 0.03 ? 0xffc21a : k < 0.05 ? 0xff8a10 : undefined);
  }
  // the drain grille at the end of the spout
  const gx = bx + L - 0.05;
  S.span(K.silver, gx - 0.12, bed, cz - 0.1, gx + 0.04, bed + 0.03, cz + 0.1);
  for (let k = -4; k <= 4; k++) S.span(K.silver, gx - 0.12, bed + 0.03, cz + k * 0.022 - 0.004, gx + 0.04, bed + 0.05, cz + k * 0.022 + 0.004);

  // ---------- the Jyotirlinga ----------
  const lg = new THREE.Mesh(lingamGeo(), K.lingam);
  lg.position.set(bx, bed + 0.005, cz);
  lg.scale.setScalar(0.7); // round 3: only a small dark crown shows above the leaves
  lg.rotation.y = Math.PI / 2; // the cleft runs east–west: seen from the door as a notch between two lobes
  lg.castShadow = false;
  lg.receiveShadow = true;
  g.add(lg);
  // bel leaves laid on each lobe, a rose in the cleft, tuberose radiating, petals on the pitha

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.21 + (i % 3) * 0.015;
    O.add(i % 4 === 0 ? 'rose' : 'bel', bx + Math.cos(a) * r, bed + 0.03, cz + Math.sin(a) * r, 0.9, undefined, a + Math.PI / 2, 0.6);
  }
  // the round of the yoni packed with green bel and bright flowers, radiating from the stone
  const belGreens = [0x3f7a1e, 0x4f8c24, 0x5f9a2a, 0x2f6618, 0x6aa232, 0x46802a];
  for (let ring = 0; ring < 4; ring++) {
    const r = 0.19 + ring * 0.03, n = Math.round(22 + ring * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.37;
      O.add('bel', bx + Math.cos(a) * r, bed + 0.035 + (3 - ring) * 0.008, cz + Math.sin(a) * r, 1.7, belGreens[(i + ring) % belGreens.length], -a + Math.PI / 2, 0.7);
    }
  }
  // a dense carpet of bel leaves (flat cards), petals strewn on it and a few red roses
  for (let i = 0; i < 90; i++) {
    const a = i * 2.39996, r = 0.12 + Math.sqrt(((i * 37) % 100) / 100) * 0.19;
    O.add('bel', bx + Math.cos(a) * r, bed + 0.05 + (0.3 - r) * 0.12, cz + Math.sin(a) * r, 1.3, belGreens[i % belGreens.length], a * 1.7, 0.5);
  }
  const petalCols = [0xd8142a, 0xffc21a, 0xff7a00, 0xc0102a, 0xfaf6ea];
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996 + 0.5, r = 0.1 + ((i * 53) % 100) / 100 * 0.2;
    O.add('petal', bx + Math.cos(a) * r, bed + 0.072, cz + Math.sin(a) * r, 0.8, petalCols[i % petalCols.length], a, 0.4);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.3, r = 0.14 + (i % 3) * 0.05;
    O.add('rose', bx + Math.cos(a) * r, bed + 0.07, cz + Math.sin(a) * r, 0.85, 0xb3121f);
  }
  // bel leaves leaned against the foot of the stone all round (the lobes and the cleft stay bare)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1;
    O.add('bel', bx + Math.cos(a) * 0.165, bed + 0.055, cz + Math.sin(a) * 0.165, 1.05, undefined, a + Math.PI / 2, 1.1);
    if (i % 3 === 0) O.add('rose', bx + Math.cos(a + 0.15) * 0.2, bed + 0.045, cz + Math.sin(a + 0.15) * 0.2, 0.9);
  }
  // tuberose stalks laid radially (rajnigandha), white buds along a thin green stem
  const stems: THREE.Matrix4[] = [];
  // round 3: 16 white tuberose stalks (~28 cm) radiating like spokes from the stone over the leaves
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2 + Math.sin(i * 2.7) * 0.08;
    const L = 0.25 + ((i * 7) % 5) * 0.012;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(bx + Math.cos(a) * 0.1, bed + 0.075, cz + Math.sin(a) * 0.1),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -Math.PI / 2 + 0.06)), new THREE.Vector3(1, L / 0.28, 1));
    stems.push(m);
    for (let k = 0; k < 4; k++) {
      const rr = 0.15 + k * 0.045;
      O.add('jasmine', bx + Math.cos(a) * rr, bed + 0.075 - (rr - 0.1) * 0.06 + 0.008, cz + Math.sin(a) * rr, 1.2, undefined, -a, 0.2);
    }
  }
  const stemIm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.005, 0.28, 5).translate(0, 0.14, 0),
    new THREE.MeshStandardMaterial({ color: 0xeeeadc, roughness: 0.6 }), stems.length);
  stems.forEach((m, i) => stemIm.setMatrixAt(i, m));
  g.add(stemIm);
  // water: the film left by the abhisheka on the pitha, and the drip from the silver vessel
  const wn = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.02, metalness: 0.5, transparent: true, opacity: 0.35, envMap: K.lingam.envMap, envMapIntensity: 2, depthWrite: false });
  const film = new THREE.Mesh(new THREE.ShapeGeometry(toShape(yi), 6).rotateX(-Math.PI / 2), wn);
  film.position.set(bx, bed + 0.006, cz);
  film.renderOrder = 2;
  g.add(film);
  const jy = Fl + 1.55;
  S.place(K.silver, lathe([[0, -0.03], [0.03, -0.01], [0.08, 0.035], [0.1, 0.1], [0.075, 0.16], [0.035, 0.18], [0.05, 0.2], [0, 0.2]], 24), bx, jy, cz);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x8a6a32, metalness: 0.6, roughness: 0.7 });
  for (const s of [-1, 1]) S.place(chainMat, new THREE.CylinderGeometry(0.003, 0.003, C - jy - 0.2, 4).translate(0, (C - jy - 0.2) / 2, 0), bx + s * 0.05, jy + 0.2, cz);
  const dripMat = new THREE.MeshStandardMaterial({ color: 0xeef4f4, roughness: 0.05, transparent: true, opacity: 0.4, envMap: K.lingam.envMap, depthWrite: false });
  const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.004, jy - 0.03 - (bed + 0.14), 6, 1, true), dripMat);
  drip.position.set(bx, (jy - 0.03 + bed + 0.14) / 2, cz);
  drip.renderOrder = 3;
  g.add(drip);

  // ---------- the brass railing with inscribed plates ----------
  const rx0 = bx - R - 0.15, rx1 = bx + L + 0.0, rz0 = cz - R - 0.15, rz1 = cz + R + 0.15;
  const plaque = new THREE.MeshStandardMaterial({ map: plaqueTexture(), metalness: 0.6, roughness: 0.4, envMap: K.lingam.envMap, envMapIntensity: 1.4, emissive: 0x2a1a04 });
  // round 3: heavy round brass tubes (Ø 5–6 cm), three rails, posts with ball tops
  const postG = lathe([[0, 0], [0.05, 0], [0.05, 0.03], [0.032, 0.05], [0.032, 0.74], [0.042, 0.76], [0.026, 0.78], [0.04, 0.8], [0.05, 0.83], [0.04, 0.86], [0, 0.875]], 12);
  const rails: [number, number, number, number][] = [[rx0, rz0, rx1, rz0], [rx1, rz0, rx1, rz1], [rx0, rz0, rx0, rz1], [rx0, rz1, bx - 0.28, rz1], [bx + 0.28, rz1, rx1, rz1]];
  const plates: THREE.BufferGeometry[] = [];
  for (const [ax, az, ex, ez] of rails) {
    const Lr = Math.hypot(ex - ax, ez - az), ry = Math.atan2(-(ez - az), ex - ax);
    const n = Math.max(1, Math.round(Lr / 0.42));
    for (let k = 0; k <= n; k++) Gd.place(K.brassIn, postG, ax + ((ex - ax) * k) / n, Fl, az + ((ez - az) * k) / n);
    for (const yy of [0.18, 0.58, 0.75]) Gd.place(K.brassIn, new THREE.CylinderGeometry(0.028, 0.028, Lr, 12).rotateZ(Math.PI / 2), (ax + ex) / 2, Fl + yy, (az + ez) / 2, ry);
    const pg = new THREE.PlaneGeometry(Lr - 0.06, 0.1);
    for (const sgn of [1, -1]) {
      const pm = pg.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((ax + ex) / 2, Fl + 0.66, (az + ez) / 2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry + (sgn < 0 ? Math.PI : 0), 0)), new THREE.Vector3(1, 1, 1)));
      // push the plate off the rail centre toward its face
      const off = new THREE.Vector3(0, 0, 0.03).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry + (sgn < 0 ? Math.PI : 0));
      pm.translate(off.x, off.y, off.z);
      plates.push(pm);
    }
  }
  const pm = new THREE.Mesh(mergeGeometries(plates, false)!, plaque);
  g.add(pm);
  P.solid(rx0 - 0.05, Fl, rz0 - 0.05, rx1 + 0.05, Fl + 0.8, rz1 + 0.05);

  // ---------- Parvati in a silver frame on the west wall, facing the lingam ----------
  const wz = cz - h + 0.05;
  S.place(K.silverEmb, archFrameGeo(0.9, 0.95, 0.5, 0.14, 0.06, 9), 0, Fl + 0.55, wz + 0.03);
  S.span(K.silverEmb, -0.5, Fl, wz, 0.5, Fl + 0.55, wz + 0.35);
  S.span(K.silver, -0.52, Fl + 0.55, wz, 0.52, Fl + 0.59, wz + 0.38);
  // the image: draped in a green sari with a gold border, silver crown and halo — a silhouette only
  // seated: a wide pleated sari over the folded legs, a narrower torso, shoulders, a small head (≈1/6) under a crown
  {
    const sari = new THREE.MeshStandardMaterial({ color: 0x9a1020, roughness: 0.55 });
    const folds = lathe([[0, 0], [0.26, 0], [0.27, 0.04], [0.24, 0.14], [0.2, 0.2], [0.15, 0.24], [0, 0.25]], 28, 18, 0.05);
    folds.scale(1, 1, 0.7);
    S.place(sari, folds, 0, Fl + 0.59, wz + 0.2);
    const torso = lathe([[0, 0], [0.12, 0], [0.1, 0.12], [0.085, 0.24], [0.12, 0.3], [0.1, 0.34], [0.04, 0.36], [0, 0.36]], 20, 10, 0.04);
    torso.scale(1, 1, 0.7);
    S.place(sari, torso, 0, Fl + 0.83, wz + 0.18);
    S.place(new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.5 }), lathe([[0, 0], [0.045, 0.01], [0.055, 0.06], [0.045, 0.11], [0, 0.12]], 16), 0, Fl + 1.19, wz + 0.18);
    // gold borders of the sari and a pallu over the shoulder
    for (const [r, y] of [[0.265, 0.035], [0.2, 0.2], [0.12, 0.24]] as const) Gd.add(K.goldIn, new THREE.TorusGeometry(r, 0.008, 4, 32).rotateX(Math.PI / 2).scale(1, 1, 0.7).translate(0, Fl + 0.59 + y, wz + 0.2));
    // silver mukut, and a silver prabhavali behind (embossed plate with a cusped top)
    Gd.place(K.silver, lathe([[0, 0], [0.06, 0], [0.065, 0.05], [0.045, 0.1], [0.02, 0.15], [0, 0.16]], 16, 10, 0.15), 0, Fl + 1.3, wz + 0.18);
    S.place(K.silverEmb, new THREE.CylinderGeometry(0.34, 0.34, 0.02, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0.62, 0), 0, Fl + 0.59, wz + 0.04);
    S.span(K.silverEmb, -0.34, Fl + 0.59, wz + 0.03, 0.34, Fl + 1.21, wz + 0.05);
  }
  O.strand(new THREE.Vector3(-0.15, Fl + 1.22, wz + 0.29), new THREE.Vector3(0.15, Fl + 1.22, wz + 0.29), 0.25, 0.8);

  // ---------- lamps: brass samai stands, a nanda-deep, a silver kalash ----------
  const samai = lathe([[0, 0], [0.16, 0], [0.13, 0.04], [0.03, 0.09], [0.03, 0.55], [0.06, 0.58], [0.05, 0.62], [0.025, 0.66], [0.025, 0.9],
    [0.12, 0.93], [0.14, 0.97], [0.11, 0.98], [0.02, 1.0], [0.02, 1.12], [0.04, 1.16], [0, 1.2]], 20);
  for (const [x, z] of [[1.86, cz + 1.86], [-1.86, cz + 1.86]]) { // tucked into the east corners: the circuit stays open
    Gd.place(K.brassIn, samai, x, Fl, z);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.12, Fl + 1.0, z + Math.sin(a) * 0.12));
    }
    P.solid(x - 0.15, Fl, z - 0.15, x + 0.15, Fl + 1.2, z + 0.15);
  }
  Gd.place(K.silver, kalashGeo(0.4), 0.8, Fl, cz - h + 0.25);
  const deep = lathe([[0, 0], [0.09, 0], [0.11, 0.04], [0.03, 0.06], [0.03, 0.18], [0.12, 0.2], [0.13, 0.24], [0, 0.23]], 16);
  Gd.place(K.brassIn, deep, -0.8, Fl, cz - h + 0.25);
  flames.points.push(new THREE.Vector3(-0.7, Fl + 0.27, cz - h + 0.25));
  // offerings on the floor by the door, a plate of bel and flowers
  O.heap(1.3, Fl + 0.02, cz + 1.65, 0.12, 0.06, 20);
  O.scatter(-1.9, 1.9, cz + 1.05, cz + 1.95, Fl, 36, 0.4);
  // a soft white light high above the basin, warm lamp light low
  const lights: THREE.PointLight[] = [];
  const topL = new THREE.PointLight(0xf4f2ff, 2.6, 6, 1.4);
  topL.position.set(0.2, C - 0.5, cz + 0.4);
  g.add(topL);
  lights.push(topL);
  for (const [x, z, inten] of [[0.9, cz + 0.7, 1.8]] as const) {
    const l = new THREE.PointLight(0xffa850, inten, 5, 1.8);
    l.position.set(x, Fl + 1.5, z);
    g.add(l);
    flames.lights.push(l);
    lights.push(l);
  }

  S.flush(g, false);
  Gd.flush(g, false);

  return {
    lights,
    update(time: number) {
      // the thin stream from the silver vessel shimmers
      (drip.material as THREE.MeshStandardMaterial).opacity = 0.32 + 0.1 * Math.sin(time * 13);
    },
  };
}

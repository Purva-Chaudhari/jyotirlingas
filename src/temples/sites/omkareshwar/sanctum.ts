import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics, Flames } from '../../engine/kit';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import { GARBHA, LINGA, HALL, F1 } from './layout';
import { stoneGeometry, crownBeads, bead, roseGeometry, cobraGeometry, cobraHoodMaterial, brassMaterial, slateWall } from './linga';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

/**
 * The garbhagriha of Shri Omkareshwar.
 *
 * What is known of the Jyotirlinga (temple trust, Wikipedia, pilgrims' accounts - photography inside is not allowed):
 *  - it is swayambhu: a small, roundish, natural black stone, not a carved cylinder;
 *  - it sits LOW, at floor level in a sunken silver basin (jalaadhari), and is always partly in water -
 *    the chamber stands over the Narmada and water is ever around the lingam;
 *  - it is NOT under the shikhara and not on the axis of the main door: the old sanctum opens off the side;
 *  - a white stone nearby is worshipped as Parvati;
 *  - silver work all round: the basin, a five-hooded silver naga rising behind, a silver frame (prabhaval)
 *    with "ॐ", a hanging kalash dripping water (jaladhari), a silver chhatra, lamps and bells.
 * Modelled here at true scale: the stone is ~0.42 × 0.34 m and rises only ~0.17 m out of the water,
 * so a standing pilgrim (eye 1.62 m) looks steeply down onto it.
 */

let seedO = 5;
const rnd = () => ((seedO = (seedO * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- offerings (instanced)

function ruffled(r: number, detail: number, amp: number, flatten: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), b = Math.atan2(v.y, Math.hypot(v.x, v.z));
    v.multiplyScalar(1 + amp * Math.sin(a * 9 + seed) * Math.sin(b * 7 + seed * 0.7));
    v.y *= flatten;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Bel (bilva) leaf: three leaflets, the middle one longest, flat in XZ, slightly cupped. */
function belGeo(len: number) {
  const leaflet = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w, l * 0.45, 0, l);
    s.quadraticCurveTo(-w, l * 0.45, 0, 0);
    const g = new THREE.ShapeGeometry(s, 6);
    g.deleteAttribute('uv');
    return g;
  };
  const g = mergeGeometries([leaflet(len, len * 0.42), leaflet(len * 0.78, len * 0.36).rotateZ(1.05), leaflet(len * 0.78, len * 0.36).rotateZ(-1.05)], false)!;
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.2);
  g.computeVertexNormals();
  return g;
}

type Kind = 'marigold' | 'rose' | 'bel' | 'petal' | 'mogra' | 'datura';
const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00, 0xff7b00];
const PETAL = [0xff8a00, 0xffb300, 0xd81b3b, 0xffffff, 0xff6f00, 0xe0406a];

export class Offerings {
  private items = new Map<Kind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  add(kind: Kind, x: number, y: number, z: number, scale = 1, color?: number, ry = rnd() * Math.PI * 2, tilt = 0) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * (rnd() - 0.5), ry, tilt * (rnd() - 0.5)));
    const s = scale * (0.85 + rnd() * 0.3);
    it.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    const pick = color ?? (kind === 'marigold' ? MARIGOLD[Math.floor(rnd() * MARIGOLD.length)]
      : kind === 'rose' ? (rnd() < 0.8 ? 0xb3121f : 0xe0406a)
        : kind === 'bel' ? (rnd() < 0.6 ? 0x4f7d24 : rnd() < 0.5 ? 0x6c9030 : 0x3d6a1c)
          : kind === 'petal' ? PETAL[Math.floor(rnd() * PETAL.length)]
            : 0xfbf8ee);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }
  ring(cx: number, y: number, cz: number, rx: number, rz: number, scale = 1) {
    const n = Math.max(8, Math.round((Math.PI * (rx + rz)) / (0.05 * scale)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
      if (i % 4 === 3) this.add('mogra', x, y, z, scale * 0.8);
      else this.add('marigold', x, y, z, scale);
    }
  }
  strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, scale = 1) {
    const n = Math.max(4, Math.round((a.distanceTo(b) + sag) / (0.05 * scale)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (i % 5 === 4) this.add('mogra', p.x, p.y, p.z, scale * 0.8);
      else this.add('marigold', p.x, p.y, p.z, scale * 0.9);
    }
  }
  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, belShare = 0.25, keep?: (x: number, z: number) => boolean) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (keep && !keep(x, z)) continue;
      if (rnd() < belShare) this.add('bel', x, y + 0.004, z, 0.9, undefined, rnd() * 6.3, 0.3);
      else this.add('petal', x, y + 0.002, z, 1, undefined, rnd() * 6.3, 0.4);
    }
  }
  flush(parent: THREE.Object3D) {
    const geos: Record<Kind, THREE.BufferGeometry> = {
      marigold: ruffled(0.03, 1, 0.26, 0.7, 1),
      rose: ruffled(0.028, 1, 0.12, 0.8, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 6).rotateX(-Math.PI / 2),
      mogra: ruffled(0.022, 1, 0.22, 0.85, 7),
      // white datura trumpet
      datura: new THREE.ConeGeometry(0.03, 0.09, 8, 1, true).rotateZ(Math.PI / 2),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.75 }),
      bel: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.6, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
      datura: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x161614 }),
    };
    for (const [kind, it] of this.items) {
      const im = new THREE.InstancedMesh(geos[kind], mats[kind], it.m.length);
      it.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, it.c[i]); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
  }
}

// ---------------------------------------------------------------- the Jyotirlinga stone

/**
 * The pit's floor as in the abhishek photograph: black wet stone under uneven concentric rings of red and pink
 * kumkum / gulal powder washed out by the water, with grain and speckle. Square, 1:1 over the pit.
 */
function kumkumTexture() {
  // a decal over the floor (alpha fades out radially): the wet stone darkened round the trough, washed with
  // broad, uneven rings of red kumkum and pink gulal carried outwards by the abhishek water
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  let sd = 9;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const cx = N / 2;
  g.fillStyle = '#211e1c';
  g.fillRect(0, 0, N, N);
  for (let k = 0; k < 400; k++) {
    const x = r() * N, y = r() * N, rr = 8 + r() * 30;
    g.fillStyle = `rgba(${30 + r() * 20},${28 + r() * 18},${26 + r() * 16},${0.2 + r() * 0.2})`;
    g.beginPath(); g.ellipse(x, y, rr, rr * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
  }
  // kumkum and gulal: faint, irregular washed-out stains and streaks round the basin, no rings
  for (let k = 0; k < 90; k++) {
    const ang = r() * Math.PI * 2, rad = (0.34 + r() * 0.14) * N;
    const x = cx + Math.cos(ang) * rad, y = cx + Math.sin(ang) * rad;
    const pink = r() < 0.35;
    g.fillStyle = pink ? `rgba(${170 + r() * 40},${70 + r() * 30},${90 + r() * 30},${0.05 + r() * 0.08})` : `rgba(${120 + r() * 40},${18 + r() * 16},${20 + r() * 14},${0.07 + r() * 0.12})`;
    g.beginPath(); g.ellipse(x, y, 6 + r() * 26, 3 + r() * 10, ang + Math.PI / 2 + (r() - 0.5) * 1.2, 0, Math.PI * 2); g.fill();
  }
  // a few runs where the abhishek water carried it outward
  for (let k = 0; k < 14; k++) {
    const ang = r() * Math.PI * 2, r0 = 0.34 * N, r1 = (0.42 + r() * 0.08) * N;
    g.strokeStyle = `rgba(${130 + r() * 40},${20 + r() * 20},${24 + r() * 20},${0.06 + r() * 0.08})`;
    g.lineWidth = 3 + r() * 6;
    g.beginPath(); g.moveTo(cx + Math.cos(ang) * r0, cx + Math.sin(ang) * r0);
    g.quadraticCurveTo(cx + Math.cos(ang + 0.15) * (r0 + r1) / 2, cx + Math.sin(ang + 0.15) * (r0 + r1) / 2, cx + Math.cos(ang + 0.05) * r1, cx + Math.sin(ang + 0.05) * r1);
    g.stroke();
  }
  // radial alpha: opaque out to ~0.8 of the radius, gone at the edge
  const img = g.getImageData(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - cx, y - cx) / cx + (r() - 0.5) * 0.04;
    img.data[(y * N + x) * 4 + 3] = Math.round(200 * Math.max(0, Math.min(1, (1 - d) / 0.3)));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A twisted cloth rope ring (two strands wound round a circle of radius R). */
function twistedRing(R: number, r: number, turns = 22) {
  const parts: THREE.BufferGeometry[] = [];
  for (const ph of [0, Math.PI]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2, w = a * turns + ph;
      const rr = R + Math.cos(w) * r * 0.55;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(w) * r * 0.55, Math.sin(a) * rr));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, r * 0.62, 6, true);
    tube.deleteAttribute('uv');
    parts.push(tube.toNonIndexed());
  }
  return mergeGeometries(parts, false)!;
}

export function buildSanctum(root: THREE.Group, K: OM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'garbhagriha';
  root.add(g);
  const B = new Batch();
  const O = new Offerings();
  const { x0, x1, z0, z1, floor: fy, ceil, doorZ, doorHW } = GARBHA;
  const T = 0.6;
  const wallTop = F1;

  // ---------- chamber walls, ceiling, floor ----------
  // west wall with the door
  B.span(K.darkStone, x0 - T, x0, 0, wallTop, z0 - T, doorZ - doorHW);
  B.span(K.darkStone, x0 - T, x0, 0, wallTop, doorZ + doorHW, z1 + T);
  B.span(K.darkStone, x0 - T, x0, 2.1, wallTop, doorZ - doorHW, doorZ + doorHW);
  P.solid(x0 - T, 0, z0 - T, x0, 4, doorZ - doorHW);
  P.solid(x0 - T, 0, doorZ + doorHW, x0, 4, z1 + T);
  // the other three walls (east wall is clad in silver behind the lingam)
  B.span(K.darkStone, x1, x1 + T, fy, wallTop, z0 - T, z1 + T);
  B.span(K.darkStone, x0, x1, fy, wallTop, z0 - T, z0);
  B.span(K.darkStone, x0, x1, fy, wallTop, z1, z1 + T);
  P.solid(x1, fy, z0 - T, x1 + T, 4, z1 + T);
  P.solid(x0, fy, z0 - T, x1, 4, z0);
  P.solid(x0, fy, z1, x1, 4, z1 + T);
  // low ceiling, blackened by lamp smoke
  B.span(K.dark, x0, x1, ceil, ceil + 0.3, z0, z1);
  B.span(K.darkStone, x0 - T, x1 + T, ceil + 0.3, wallTop, z0 - T, z1 + T);
  // floor: two steps down from the threshold, then the sunken chamber floor of dark, wet stone
  B.span(K.silverEmb, x0 - T, x0, -0.5, 0.08, doorZ - doorHW, doorZ + doorHW);
  B.span(K.ledge, x0, x0 + 0.38, -0.5, -0.22, doorZ - doorHW - 0.2, doorZ + doorHW + 0.2);
  const L = LINGA;
  const P0 = 1.0; // radius of the kumkum-washed floor round the trough
  B.prism(K.sanctumFloor, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], -0.7, fy);
  P.floor(g, x0 - T - 0.05, x0, doorZ - doorHW, doorZ + doorHW, 0.08);
  P.floor(g, x0, x0 + 0.38, doorZ - doorHW - 0.2, doorZ + doorHW + 0.2, -0.22);
  P.floor(g, x0 + 0.38, x1, z0, z1, fy);

  // ---------- stepped dark-stone ledges hemming the stone in (darshan photograph) ----------
  // Back (east): two steps right behind the trough, their faces sheathed in silver repoussé.
  // North and south: knee-high ledges along the side walls, so only a short aisle leads from the door to the
  // stone; nobody walks round behind it (there is no pradakshina in this chamber).
  const LH = 0.35;
  const BX = L.x + 0.56; // back ledge front face
  const NZ = L.z - 1.05, SZ = L.z + 1.15; // side ledges' inner faces
  const SX = x0 + 1.0; // side ledges start this far in from the door wall
  B.span(K.ledge, BX, x1, fy, fy + LH, NZ, SZ);
  B.span(K.ledge, BX + 0.32, x1, fy + LH, fy + 2 * LH, z0, z1);
  B.span(K.ledge, SX, x1, fy, fy + LH, z0, NZ);
  B.span(K.ledge, SX, x1, fy, fy + LH, SZ, z1);
  // worn nosings
  B.span(K.ledge, BX - 0.03, BX + 0.03, fy + LH - 0.04, fy + LH + 0.015, NZ, SZ);
  B.span(K.ledge, SX, x1, fy + LH - 0.04, fy + LH + 0.015, NZ - 0.03, NZ + 0.03);
  B.span(K.ledge, SX, x1, fy + LH - 0.04, fy + LH + 0.015, SZ - 0.03, SZ + 0.03);
  // silver repoussé bands on the risers (0.3 m high) facing the stone and the door
  B.span(K.silverEmb, BX - 0.012, BX, fy + 0.02, fy + LH - 0.04, NZ, SZ);
  B.span(K.silverEmb, BX + 0.32 - 0.012, BX + 0.32, fy + LH + 0.02, fy + 2 * LH - 0.04, z0, z1);
  B.span(K.silverEmb, SX, x1 - 0.02, fy + 0.02, fy + LH - 0.04, NZ, NZ + 0.012);
  B.span(K.silverEmb, SX, x1 - 0.02, fy + 0.02, fy + LH - 0.04, SZ - 0.012, SZ);
  B.span(K.silverEmb, SX - 0.012, SX, fy + 0.02, fy + LH - 0.04, z0, NZ);
  B.span(K.silverEmb, SX - 0.012, SX, fy + 0.02, fy + LH - 0.04, SZ, z1);
  // the ledges are solid to the pilgrim (their visible faces are the barrier)
  P.solid(BX, fy, z0, x1, fy + 1.4, z1);
  P.solid(SX, fy, z0, x1, fy + 1.4, NZ);
  P.solid(SX, fy, SZ, x1, fy + 1.4, z1);
  // ---------- silver door frame of the chamber (seen from the hall) ----------
  const dz0 = doorZ - doorHW, dz1 = doorZ + doorHW, dx = x0 - T - 0.04;
  B.span(K.silverRep, dx, dx + 0.08, 0, 2.3, dz0 - 0.22, dz0);
  B.span(K.silverRep, dx, dx + 0.08, 0, 2.3, dz1, dz1 + 0.22);
  B.span(K.silverEmb, dx, dx + 0.08, 2.1, 2.42, dz0 - 0.22, dz1 + 0.22);
  B.span(K.silver, dx - 0.04, dx + 0.08, 2.42, 2.52, dz0 - 0.3, dz1 + 0.3);
  // a toran of marigold across the door
  O.strand(new THREE.Vector3(dx - 0.06, 2.3, dz0 - 0.15), new THREE.Vector3(dx - 0.06, 2.3, dz1 + 0.15), 0.18, 1);
  // door bell
  {
    const bell = new THREE.LatheGeometry([[0, 0], [0.1, 0.01], [0.11, 0.07], [0.075, 0.17], [0.03, 0.22], [0, 0.23]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
    bell.translate(dx - 0.5, 1.95, dz1 - 0.1);
    B.add(K.brass, bell);
    B.span(K.brass, dx - 0.51, dx - 0.49, 2.18, HALL.h - 0.3, dz1 - 0.11, dz1 - 0.09);
  }

  // ---------- walls: silver-sheathed sides, an engraved slate back wall behind the stone ----------
  B.span(K.silverRep, SX, x1 - 0.05, fy + LH, fy + 1.75, z0, z0 + 0.04);
  B.span(K.silverRep, SX, x1 - 0.05, fy + LH, fy + 1.75, z1 - 0.04, z1);
  B.span(K.silverEmb, SX, x1, fy + 1.75, fy + 1.87, z0, z0 + 0.09);
  B.span(K.silverEmb, SX, x1, fy + 1.75, fy + 1.87, z1 - 0.09, z1);
  {
    const W = z1 - z0, H = ceil - (fy + 2 * LH);
    const sl = slateWall(W, H, (L.z - z0) / W);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({
      map: sl.map, normalMap: sl.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.55, envMap: K.neutralEnv, envMapIntensity: 0.25,
    }));
    wall.position.set(x1 - 0.005, fy + 2 * LH + H / 2, (z0 + z1) / 2);
    wall.receiveShadow = true;
    g.add(wall);
  }

  // ---------- the Jyotirlinga in its round trough ----------
  // the slab round it, washed with rings of kumkum and gulal (abhishek photograph)
  {
    const pg = new THREE.PlaneGeometry(P0 * 2, P0 * 2).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({
      map: kumkumTexture(), roughness: 0.75, metalness: 0, envMapIntensity: 0.3, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.position.set(L.x, fy + 0.002, L.z);
    m.renderOrder = 2;
    m.receiveShadow = true;
    g.add(m);
  }
  // the trough (jalaadhari): a low round rim of black stone with a channel round the stone's foot, worn wet
  {
    const prof: [number, number][] = [[0.2, -0.05], [0.3, -0.07], [0.4, -0.065], [0.45, -0.02], [0.47, 0.04], [0.5, 0.06], [0.54, 0.05], [0.58, 0.02], [0.6, -0.01]];
    const tr = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64);
    const trm = new THREE.Mesh(tr, K.blackStone);
    trm.position.set(L.x, fy, L.z);
    trm.receiveShadow = true;
    g.add(trm);
    // a brass ring on the inner lip of the rim (darshan photograph)
    const br = new THREE.Mesh(new THREE.TorusGeometry(0.452, 0.011, 8, 96).rotateX(Math.PI / 2), K.brass);
    br.position.set(L.x, fy + 0.012, L.z);
    g.add(br);
    // abhishek water standing in the channel
    const wat = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.44, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({
      color: 0x2a2622, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap: K.neutralEnv, envMapIntensity: 0.35,
    }));
    wat.position.set(L.x, fy - 0.035, L.z);
    g.add(wat);
  }
  const waterY = fy - 0.035;
  // the stone: dark grey-black, a rough cone, chandan smeared on its sides
  const SH = 0.3;
  const stone = new THREE.Mesh(stoneGeometry({ rx: 0.23, rz: 0.21, h: SH, taper: 0.45, base: 0x2e2c2a, light: 0x4a4744, smears: 4, seed: 2.3 }), K.rockLingam);
  stone.position.set(L.x, fy - 0.03, L.z);
  stone.rotation.y = 0.4;
  stone.castShadow = true;
  stone.receiveShadow = true;
  g.add(stone);
  const topY = fy - 0.03 + SH;
  // cloth at its foot: white cloth bunched under and round the stone (with a twisted white roll), and bright
  // yellow silk laid over the basin's outer rim, falling loose in folds to the floor
  {
    const pleat = (a: number, k: number) => Math.sin(a * 17 + Math.sin(a * 3) * 2) * 0.6 + Math.sin(a * 29 + 1.7) * 0.3 + Math.sin(a * 7 + 0.4) * 0.5;
    // white under-cloth: a bunched skirt from the stone's foot into the channel
    const wg = new THREE.LatheGeometry([[0.2, 0.095], [0.26, 0.088], [0.31, 0.062], [0.35, 0.03], [0.385, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 180);
    { const p = wg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
        const f = (Math.sin(a * 9 + Math.sin(a * 2) * 1.5) * 0.6 + Math.sin(a * 5 + 1.1) * 0.4) * 0.008 * (0.4 + (r - 0.19) / 0.14);
        p.setXYZ(i, (x / r) * (r + f * 0.6), y + f, (z / r) * (r + f * 0.6));
      }
      wg.computeVertexNormals(); }
    const wc = new THREE.Mesh(wg, Object.assign(K.clothWhite.clone(), { side: THREE.DoubleSide }));
    wc.position.set(L.x, fy - 0.03, L.z);
    wc.scale.set(1.0, 1, 0.92);
    g.add(wc);
    const w = new THREE.Mesh(twistedRing(0.235, 0.022), K.clothWhite);
    w.position.set(L.x, fy + 0.0, L.z);
    w.scale.set(1, 0.85, 0.92);
    g.add(w);
    // yellow silk: from the rim's top (r 0.5) over its outer edge and down onto the floor
    const prof: [number, number][] = [[0.495, 0.064], [0.525, 0.068], [0.555, 0.058], [0.585, 0.035], [0.61, 0.008], [0.635, -0.008], [0.67, -0.013], [0.71, -0.014]];
    const yg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 260);
    { const p = yg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
        const fall = THREE.MathUtils.clamp((r - 0.52) / 0.15, 0, 1); // folds deepen as the silk falls
        const gather = 0.6 + 0.4 * Math.sin(a * 2 + 1.1); // looser in places
        const f = pleat(a, 1) * (0.012 + 0.024 * fall) * gather;
        const hem = r > 0.68 ? 0.015 * Math.sin(a * 11 + 0.6) : 0; // the loose hem wanders
        p.setXYZ(i, (x / r) * (r + f * 0.4 + hem), y + f * 0.55 * (1 - fall * 0.4), (z / r) * (r + f * 0.4 + hem));
      }
      yg.computeVertexNormals(); }
    const roll = new THREE.TorusGeometry(0.5, 0.018, 8, 200).rotateX(Math.PI / 2);
    { const p = roll.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + 0.075 + 0.004 * pleat(a, 1)); }
      roll.computeVertexNormals(); }
    for (const geo of [yg, roll]) {
      const m = new THREE.Mesh(geo, K.clothYellow);
      m.position.set(L.x, fy, L.z);
      g.add(m);
    }
  }
  // the crown: a mound of white garlands wound round the top of the stone, one red rose on it
  {
    const cx = L.x - 0.005, cz = L.z + 0.005;
    const beads = crownBeads(cx, topY - 0.07, cz, 0.13, 0.25);
    const im = new THREE.InstancedMesh(bead(0.011, 1, 0.22, 0.85, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, emissive: 0x141410 }), beads.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    beads.forEach((b, i) => {
      q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6));
      im.setMatrixAt(i, mtx.compose(b.p, q, new THREE.Vector3(b.s, b.s, b.s)));
      im.setColorAt(i, new THREE.Color(b.c));
    });
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor!.needsUpdate = true;
    g.add(im);
    // a few green leaves tucked under the garlands
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      O.add('bel', cx + Math.cos(a) * 0.14, topY - 0.07, cz + Math.sin(a) * 0.14, 1.0, undefined, a, 0.9);
    }
    // a cluster of red and pink roses on the crown (darshan / abhishek photographs)
    const rg = roseGeometry();
    for (const [dx, dz, sc, col, tilt] of [[0, 0, 2.5, 0xc8102e, 0], [0.05, 0.04, 1.1, 0xb00c24, 0.6], [-0.045, -0.04, 1.0, 0xd8285a, 0.6]] as const) {
      const rose = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, side: THREE.DoubleSide }));
      rose.position.set(cx + dx, topY - 0.07 + 0.235 - (dx || dz ? 0.04 : 0), cz + dz);
      rose.rotation.set(dz * 12 * tilt, rnd() * 6, -dx * 12 * tilt);
      rose.scale.setScalar(sc);
      g.add(rose);
    }
  }
  // a few petals afloat in the channel, a few fallen near the door
  O.scatter(L.x - 0.5, L.x + 0.5, L.z - 0.5, L.z + 0.5, waterY + 0.002, 22, 0.25, (x, z) => {
    const d = Math.hypot(x - L.x, z - L.z);
    return d > 0.29 && d < 0.43;
  });
  O.scatter(x0 + 0.5, SX + 0.6, NZ + 0.2, SZ - 0.2, fy, 14, 0.3);
  // the pilgrim stops at the trough's rim
  P.solid(L.x - 0.5, fy, L.z - 0.55, BX, fy + 0.6, L.z + 0.55);

  // ---------- the brass cobra rising behind the stone ----------
  {
    const n = cobraGeometry(TessellateModifier);
    for (const geo of [n.body, n.hood, n.head]) geo.translate(L.x, fy - 0.03, L.z);
    const bodyMat = brassMaterial(K.neutralEnv, false), hoodMat = cobraHoodMaterial(K.neutralEnv);
    bodyMat.color.set(0xb08d4a);
    g.add(new THREE.Mesh(n.body, bodyMat), new THREE.Mesh(n.hood, hoodMat), new THREE.Mesh(n.head, bodyMat));
    // a small garland round its body
    O.ring(L.x + 0.11, fy + 0.2, L.z + 0.375, 0.075, 0.075, 0.6);
  }

  // ---------- the back ledge: a brass railing pipe and a raised tray of flowers (darshan photograph, right) ----------
  {
    const ry = fy + LH + 0.28, rx = BX + 0.09;
    B.add(K.brass, new THREE.CylinderGeometry(0.022, 0.022, SZ - NZ, 12).rotateX(Math.PI / 2).translate(rx, ry, (NZ + SZ) / 2));
    for (let z = NZ + 0.1; z <= SZ - 0.05; z += 0.55) {
      B.add(K.brass, new THREE.CylinderGeometry(0.016, 0.02, 0.28, 10).translate(rx, fy + LH + 0.14, z));
      B.add(K.brass, new THREE.SphereGeometry(0.03, 10, 8).translate(rx, ry, z));
    }
    // the tray: a silver plate on a short stand on the upper step, heaped with marigold, rose and white flowers
    const tx = BX + 0.5, tz = L.z + 0.95, ty = fy + 2 * LH;
    B.lathe(K.silver, [[0, 0], [0.06, 0], [0.04, 0.12], [0.05, 0.13], [0.25, 0.14], [0.27, 0.165], [0.25, 0.17], [0, 0.155]], tx, ty, tz, 28);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.21, h = 0.06 * (1 - rr / 0.23);
      const k = rnd();
      O.add(k < 0.45 ? 'marigold' : k < 0.75 ? 'mogra' : 'rose', tx + Math.cos(a) * rr, ty + 0.18 + h * rnd(), tz + Math.sin(a) * rr, 0.9);
    }
  }

  // ---------- Parvati: an off-white stone on the north ledge, wrapped in a red chunari ----------
  {
    const px = BX - 0.25, pz = NZ - 0.35, py = fy + LH;
    const ws = new THREE.Mesh(stoneGeometry({ rx: 0.1, rz: 0.09, h: 0.24, taper: 0.35, base: 0xe2dccd, light: 0xf2eee4, smears: 0, seed: 7.1, detail: 20 }),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, clearcoat: 0.1, envMap: K.neutralEnv, envMapIntensity: 0.4 }));
    ws.position.set(px, py, pz);
    g.add(ws);
    // the chunari: a cap of red cloth over the stone's back with a wavy hem and a gold border
    const cloth = new THREE.SphereGeometry(0.135, 28, 12, Math.PI * 0.15, Math.PI * 1.35, 0, Math.PI * 0.62);
    const cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i), a = Math.atan2(z, x);
      cp.setY(i, cp.getY(i) * 1.6 + 0.012 * Math.sin(a * 11));
    }
    cloth.computeVertexNormals();
    cloth.translate(px + 0.01, py + 0.06, pz);
    B.add(K.redCloth, cloth);
    const hem = new THREE.TorusGeometry(0.11, 0.006, 6, 40, Math.PI * 1.35).rotateX(Math.PI / 2).rotateY(-Math.PI * 0.15).translate(px + 0.01, py + 0.025, pz);
    B.add(K.gold, hem);
    B.add(K.kumkum, new THREE.SphereGeometry(0.012, 8, 6).translate(px - 0.095, py + 0.15, pz));
    O.ring(px, py + 0.02, pz, 0.15, 0.13, 0.7);
  }

  // ---------- lamps: two brass deepstambhas on the back step, a ghee diya by the trough; warm, low light ----------
  const stand: [number, number][] = [[0, 0], [0.12, 0], [0.12, 0.03], [0.05, 0.06], [0.03, 0.2], [0.05, 0.25], [0.025, 0.3], [0.025, 0.75], [0.06, 0.78], [0.11, 0.81], [0.11, 0.85], [0.0, 0.85]];
  for (const s of [-1, 1]) {
    const lx = BX + 0.55, lz = L.z + s * 1.3;
    B.lathe(K.brass, stand, lx, fy + 2 * LH, lz, 16);
    flames.points.push(new THREE.Vector3(lx + 0.07, fy + 2 * LH + 0.88, lz), new THREE.Vector3(lx - 0.07, fy + 2 * LH + 0.88, lz), new THREE.Vector3(lx, fy + 2 * LH + 0.88, lz + 0.07));
  }
  B.lathe(K.brass, [[0, 0], [0.05, 0], [0.06, 0.025], [0.035, 0.035], [0, 0.03]], L.x - 0.72, fy, L.z + 0.5, 12);
  flames.points.push(new THREE.Vector3(L.x - 0.72, fy + 0.06, L.z + 0.5));
  // the silver aarti plate on the south ledge
  B.lathe(K.silver, [[0, 0], [0.2, 0], [0.22, 0.02], [0.2, 0.025], [0, 0.01]], SX + 0.5, fy + LH, SZ + 0.5, 24);
  for (const a of [0, 1.6, 3.2, 4.8]) flames.points.push(new THREE.Vector3(SX + 0.5 + Math.cos(a) * 0.12, fy + LH + 0.05, SZ + 0.5 + Math.sin(a) * 0.12));
  const lamp1 = new THREE.PointLight(0xfff2e0, 0.55, 4, 1.8);
  lamp1.position.set(L.x - 0.9, fy + 1.4, L.z + 0.5);
  g.add(lamp1);
  flames.lights.push(lamp1);
  const lamp2 = new THREE.PointLight(0xffe8cc, 0.4, 3.5, 1.8);
  lamp2.position.set(BX + 0.4, fy + 1.5, L.z - 0.6);
  g.add(lamp2);
  flames.lights.push(lamp2);
  // a red cloth hung on the south side (darshan photograph, right)
  B.add(K.redCloth, new THREE.PlaneGeometry(0.9, 1.3).translate(x1 - 0.6, fy + LH + 0.75, z1 - 0.06));
  void Instances;
  void ceil;
  void HALL;
  O.flush(g);
  B.flush(g, false);
  for (const c of g.children) c.castShadow = false;
  stone.castShadow = true;
  return g;
}

import * as THREE from 'three';
import { leafTrees } from './trees';
import { Water } from 'three/examples/jsm/objects/Water.js';
import type { Physics, Flames } from '../../engine/kit';
import { waterNormals } from '../../engine/materials';
import { Batch, Instances, mergeParts, rng } from './batch';
import { pilgrims, cows, vehicles, type CrowdSpot } from './crowd';
import { atlasQuad, SIGN_COLS, SIGN_ROWS, type RM } from './mats';
import { worldUVxz } from './precinct';
import { facadeMaterial, unitBox } from './facade';
import { BUILDINGS } from './town_data';
import { COAST } from './coast_data';
import { OUTER, STREET, EAST_CAR, BEACH, SEA_Y, RING, ARM } from './layout';

/**
 * Rameswaram town east of the temple and Agni Theertham:
 *  - the street from the east entrance to the sea: two- and three-storey shophouses in faded
 *    pastels, open shopfronts with rolling shutters, tarpaulin awnings, Tamil/English signboards,
 *    stalls of conch shells, beads and theertham cans; concrete electric poles and sagging wires;
 *  - East Car Street crossing it, and the rest of the town from real OpenStreetMap footprints;
 *  - the Agni Theertham ghat: a pavilion, concrete steps running down into the shallow Gulf of
 *    Mannar with pipe railings, sand either side, coconut palms, moored fishing boats; the sea.
 */

/** the stronger paints of the shophouses on the temple streets: turmeric, rose, mint, sky, lime, peach */
const STREET_PAINT = [0xf2c94c, 0xe8789a, 0x5ec8a8, 0x6fb2e8, 0xb8d860, 0xf29a5c, 0xf4efe4, 0xc890e0, 0xf0d040, 0x3fb8b0, 0xe86fa0, 0x8ec7f0];
/** pull a paint toward weathered grey */
const desat = (c: THREE.Color, k: number) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; return c.lerp(new THREE.Color(l, l, l).multiplyScalar(0.92), k); };
const PASTEL = [0xe9d8b8, 0xf0c9a8, 0xd9e6d2, 0xcfe0ea, 0xf2e6a0, 0xe8c4c4, 0xf4f0e6, 0xd8d0e8, 0xbfe0d8, 0xf0d890, 0xe0b090, 0xc8d8f0];

export function buildTown(root: THREE.Group, R: RM, P: Physics, flames: Flames, sunDir: THREE.Vector3) {
  const g = new THREE.Group();
  g.name = 'town';
  root.add(g);
  const shore = new THREE.Group();
  shore.name = 'shore';
  root.add(shore);
  const B = new Batch(), SB = new Batch();
  const rnd = rng(77);

  // ---------- the island: land inside the real coastline, a sand beach all along it ----------
  const coast = COAST.map(([x, z]) => new THREE.Vector2(x, z));
  // normals pointing inland (the temple is on the land side)
  const nrm = coast.map((p, i) => {
    const a = coast[Math.max(0, i - 1)], b = coast[Math.min(coast.length - 1, i + 1)];
    const n = new THREE.Vector2(-(b.y - a.y), b.x - a.x).normalize();
    return n;
  });
  const probeI = coast.reduce((bi, p, i) => (p.length() < coast[bi].length() ? i : bi), 0);
  if (nrm[probeI].dot(coast[probeI].clone().negate()) < 0) nrm.forEach((n) => n.negate());
  const offs = (d: number) => coast.map((p, i) => p.clone().addScaledVector(nrm[i], d));
  const landEdge = offs(26);
  const landPoly = [new THREE.Vector2(-900, -1700), ...landEdge, new THREE.Vector2(1700, 1300), new THREE.Vector2(1700, -1700)];
  const onLand = (x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = landPoly.length - 1; i < landPoly.length; j = i++) {
      const a = landPoly[i], b = landPoly[j];
      if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const groundGeo = new THREE.ShapeGeometry(new THREE.Shape(landPoly.map((p) => new THREE.Vector2(p.x, -p.y)))).rotateX(-Math.PI / 2).translate(0, -0.02, 0);
  groundGeo.computeVertexNormals();
  if (groundGeo.attributes.normal.getY(0) < 0) {
    const idx = groundGeo.index!;
    for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(worldUVxz(groundGeo), R.dust);
  ground.receiveShadow = true;
  g.add(ground);
  P.floors.push(ground);
  // the beach: rows inland → seaward with their heights
  const rows: [number, number][] = [[26, 0.0], [16, -0.18], [8, -0.5], [2, -1.05], [-4, -1.5], [-14, -2.0], [-30, -2.8]];
  const bpos: number[] = [];
  const bidx: number[] = [];
  const nr = rows.length;
  coast.forEach((p, i) => rows.forEach(([d, y], r) => {
    const q = p.clone().addScaledVector(nrm[i], d);
    const wob = Math.sin(q.x * 0.13) * 0.04 + Math.sin(q.y * 0.07 + q.x * 0.02) * 0.05;
    // under the ghat the sand drops away so the bathing steps run straight into the water
    const underGhat = Math.abs(q.x) < 15.5 && q.y > BEACH.z0 + 3 && q.y < BEACH.z0 + 26;
    bpos.push(q.x, underGhat ? Math.min(y, -3.2) : y + (r > 0 && r < nr - 1 ? wob : 0), q.y);
    if (i > 0 && r > 0) {
      const a = (i - 1) * nr + r - 1, b = i * nr + r - 1, c = i * nr + r, e = (i - 1) * nr + r;
      bidx.push(a, b, c, a, c, e);
    }
  }));
  const sandGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3));
  sandGeo.setIndex(bidx);
  sandGeo.computeVertexNormals();
  if (sandGeo.attributes.normal.getY(0) < 0) { sandGeo.setIndex(bidx.map((_, k) => bidx[k - (k % 3) + [0, 2, 1][k % 3]])); sandGeo.computeVertexNormals(); }
  const sand = new THREE.Mesh(worldUVxz(sandGeo), R.sand);
  sand.receiveShadow = true;
  shore.add(sand);
  P.floors.push(sand);
  const street = new THREE.Mesh(worldUVxz(new THREE.PlaneGeometry(STREET.hw * 2, STREET.z1 - OUTER.z1 + 2).rotateX(-Math.PI / 2).translate(0, 0.01, (OUTER.z1 + STREET.z1) / 2)), R.pavers);
  street.receiveShadow = true;
  g.add(street);
  const car = new THREE.Mesh(worldUVxz(new THREE.PlaneGeometry(240, EAST_CAR.hw * 2).rotateX(-Math.PI / 2).translate(5, 0.012, EAST_CAR.z)), R.pavers);
  car.receiveShadow = true;
  g.add(car);
  // the car streets round the temple walls (paved bands)
  const carBands: [number, number, number, number][] = [[OUTER.x1 + 2, OUTER.x1 + 14, -170, 180], [OUTER.x0 - 14, OUTER.x0 - 2, -170, 180], [-112, 116, OUTER.z0 - 14, OUTER.z0 - 2], [-7, 7, -520, OUTER.z0 - 14]];
  for (const [x0, x1, z0, z1] of carBands) {
    const m = new THREE.Mesh(worldUVxz(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.011, (z0 + z1) / 2)), R.pavers);
    m.receiveShadow = true;
    g.add(m);
  }

  // ---------- shophouses along the street to the sea ----------
  const signGeoAt = (i: number, w: number, h: number) => atlasQuad(w, h, i % SIGN_COLS, Math.floor(i / SIGN_COLS) % SIGN_ROWS, SIGN_COLS, SIGN_ROWS);
  let signIdx = 0;
  // conch shells: a spiral-ish lathe, lying on its side
  const conch = new THREE.LatheGeometry([[0, 0], [0.04, 0.01], [0.07, 0.05], [0.075, 0.09], [0.05, 0.13], [0.02, 0.17], [0, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 7).rotateZ(Math.PI / 2);
  const goods = new Instances(conch, new THREE.MeshStandardMaterial({ roughness: 0.45 }));
  // instanced houses with shader facades; black plastic water tanks on the roofs
  const shelf = new Instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  const SHELF = [0x5a2a1a, 0x2a3a5a, 0x6a5a2a, 0x3a5a3a, 0x7a3a5a, 0x8a7a5a, 0x4a4a4a];
  const acs = new Instances(mergeParts([{ g: new THREE.BoxGeometry(0.85, 0.55, 0.28).translate(0, 0.275, -0.14), c: 0xeeeeea }, { g: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14).rotateX(Math.PI / 2).translate(0.15, 0.275, 0.005), c: 0x555555 }]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const clothes = new Instances(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }));
  const CLOTH = [0xc8211a, 0xf2f0ea, 0x2a64b0, 0xf2c230, 0x2e8b57, 0xe86fa0, 0x8a1c2a, 0x6a2a8c];
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.6 });
  let bannerIdx = 0;
  const upperM: THREE.Matrix4[] = [], upperC: THREE.Color[] = [], houseM: THREE.Matrix4[] = [], houseC: THREE.Color[] = [];
  const tanks = new Instances(new THREE.CylinderGeometry(0.55, 0.6, 1.15, 10).translate(0, 0.58, 0), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.55 }));
  // kerbs and the covered drain along both sides of the street
  for (const side of [-1, 1]) {
    B.add(R.concrete, new THREE.BoxGeometry(0.25, 0.18, STREET.z1 - OUTER.z1 - 12).translate(side * (STREET.hw - 0.12), 0.09, (OUTER.z1 + 12 + STREET.z1) / 2));
    B.add(R.paintOut, new THREE.BoxGeometry(0.02, 0.16, STREET.z1 - OUTER.z1 - 12).translate(side * (STREET.hw - 0.255), 0.09, (OUTER.z1 + 12 + STREET.z1) / 2), 0xe9e4d8);
  }
  for (const side of [-1, 1]) {
    let z = OUTER.z1 + 14;
    while (z < STREET.z1 - 14) {
      const front = 5 + Math.floor(rnd() * 5);
      if (Math.abs(z + front / 2 - EAST_CAR.z) < EAST_CAR.hw + front / 2 + 0.5) { z = EAST_CAR.z + EAST_CAR.hw + 0.5; continue; }
      const floors = 1 + Math.floor(rnd() * 4.6), fh = 3.2;
      const depth = 10 + rnd() * 6;
      const col = desat(new THREE.Color(STREET_PAINT[Math.floor(rnd() * STREET_PAINT.length)]), 0.3);
      const x0 = side * STREET.hw, x1 = side * (STREET.hw + depth);
      const zc = z + front / 2, xc = (x0 + x1) / 2;
      const H = floors * fh + (rnd() < 0.3 ? 1.2 : 0);
      // body: the upper floors (facade shader) over a shop recess at street level
      upperM.push(new THREE.Matrix4().compose(new THREE.Vector3(xc, 3.0, zc), new THREE.Quaternion(), new THREE.Vector3(depth, H - 3.0, front - 0.05)));
      upperC.push(col);
      B.box(R.townWall, depth - 2.2, 3.0, front - 0.05, xc + side * 1.1, 0, zc, 0, col.clone().multiplyScalar(0.92));
      // the open shop: dark interior, side piers, a half-raised rolling shutter
      B.box(R.shade, 0.1, 2.7, front - 0.8, x0 + side * 2.15, 0, zc);
      for (const sz of [-1, 1]) B.box(R.townWall, 2.2, 3.0, 0.35, x0 + side * 1.1, 0, zc + sz * (front / 2 - 0.2), 0, col);
      // a rolling steel shutter, partly raised, with its housing; shelves of goods in the dark shop
      B.box(R.steel, 0.14, 0.32, front - 0.7, x0 + side * 0.35, 2.68, zc);
      const shutDown = rnd() < 0.3 ? 0.4 + rnd() * 1.2 : 0.15 + rnd() * 0.25;
      B.box(R.steel, 0.05, shutDown, front - 0.8, x0 + side * 0.4, 2.68 - shutDown, zc);
      for (let k = 0; k <= Math.floor(shutDown / 0.08); k++) B.box(R.shade, 0.06, 0.012, front - 0.8, x0 + side * 0.43, 2.68 - k * 0.08, zc);
      for (let sh = 0; sh < 3; sh++) for (let k = 0; k < Math.floor(front * 1.6); k++) {
        if (rnd() < 0.25) continue;
        shelf.at(x0 + side * (2.0 - rnd() * 0.15), 0.4 + sh * 0.7, z + 0.5 + k * ((front - 1) / Math.floor(front * 1.6)), [0.6 + rnd() * 0.6, 0.35 + rnd() * 0.25, 0.4], 0, SHELF[Math.floor(rnd() * SHELF.length)]);
      }
      // the street face of the upper floors: a projecting sunshade and a recessed frame over each window
      {
        const halfW = (front - 0.05) / 2, nbw = Math.max(1, Math.floor((2 * halfW) / 2.5)), bw = (2 * halfW) / nbw;
        for (let st = 0; ; st++) {
          const wy = 3.0 + st * 3.2 + 1.5;
          if (wy > H - 0.9 - 0.62) break;
          for (let i = 0; i < nbw; i++) {
            const wz = zc - halfW + (i + 0.5) * bw;
            B.add(R.concrete, new THREE.BoxGeometry(0.6, 0.07, 1.55).translate(x0 - side * 0.3, wy + 0.8, wz));
            for (const dz of [-0.64, 0.64]) B.box(R.paintOut, 0.12, 1.3, 0.1, x0 - side * 0.04, wy - 0.65, wz + dz, 0, 0xe8e4dc);
            B.box(R.paintOut, 0.14, 0.1, 1.38, x0 - side * 0.05, wy - 0.72, wz, 0, 0xe8e4dc);
          }
        }
      }
      // the stall in front: a table of conch shells and cowries, stacks of theertham cans and packets,
      // strings of beads and rudraksha hanging from the awning frame
      B.box(R.wood, 1.0, 0.8, front - 1.4, x0 + side * 0.9, 0, zc);
      for (let k = 0; k < 26; k++) {
        const gx = x0 + side * (0.5 + rnd() * 0.8), gz = zc + (rnd() - 0.5) * (front - 1.8);
        goods.at(gx, 0.84, gz, [0.9 + rnd() * 0.5, 0.55, 1.3 + rnd() * 0.4], rnd() * 6, rnd() < 0.7 ? 0xf4ecdc : 0xe8cfa8);
      }
      for (let k = 0; k < 3; k++) {
        const cz = z + 0.5 + rnd() * 0.6, cx2 = x0 + side * (0.25 + k * 0.32);
        for (let j = 0; j < 3; j++) B.lathe(R.whitePaint, [[0, 0], [0.12, 0], [0.12, 0.3], [0.05, 0.36], [0.05, 0.4], [0, 0.4]], cx2, j * 0.41, cz, 8);
      }
      const nb = Math.floor(front / 0.35);
      for (let k = 0; k < nb; k++) {
        if (rnd() < 0.35) continue;
        const len = 0.6 + rnd() * 0.9;
        B.add(R.paintOut, new THREE.CylinderGeometry(0.025, 0.025, len, 4).translate(x0 - side * 0.05, 3.0 - len / 2, z + 0.3 + k * 0.35),
          [0xc8211a, 0xf2c230, 0x5a2a12, 0xffffff, 0x2a64b0, 0x2e8b57][Math.floor(rnd() * 6)]);
      }
      // awning: a tarpaulin sloping from the wall out over the pavement
      const tarp = [0x1f5fbf, 0xd23a2a, 0x2e8b57, 0xe0a020, 0x1f5fbf][Math.floor(rnd() * 5)];
      const ax = x0 - side * 0.02, bx = x0 - side * 2.1, za = z + 0.15, zb = z + front - 0.15;
      // the tarpaulin sags between its poles and droops at the front edge
      const awG = new THREE.PlaneGeometry(1, 1, 1, 10);
      const ap = awG.attributes.position;
      for (let i = 0; i < ap.count; i++) {
        const u = ap.getX(i) + 0.5, v = ap.getY(i) + 0.5; // u across (wall→front), v along the street
        const sag = Math.sin(v * Math.PI) * 0.22 * u + u * u * 0.08;
        ap.setXYZ(i, ax + (bx - ax) * u, 3.35 - 0.55 * u - sag, za + (zb - za) * v);
      }
      awG.computeVertexNormals();
      B.add(R.paintOut, awG.clone().index ? awG.toNonIndexed() : awG, tarp);
      const back = awG.clone();
      back.translate(0, -0.01, 0);
      { const ix = back.index!; for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); } }
      back.computeVertexNormals();
      B.add(R.paintOut, back, tarp);
      for (const zz of [za, zb]) B.add(R.steel, new THREE.CylinderGeometry(0.025, 0.025, 2.8, 4).translate(bx, 1.4, zz));
      // signboard over the awning
      const sg = signGeoAt(signIdx++, Math.min(front - 0.6, 5.2), 1.0).rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x0 - side * 0.03, 3.45, zc);
      B.add(R.signs, sg, null, true);
      // balconies with steel railings, chajjas, and flex banners on the upper floors
      for (let f = 1; f < floors; f++) {
        if (rnd() < 0.55) {
          B.box(R.concrete, 1.1, 0.15, front - 0.6, x0 - side * 0.55, f * fh - 0.1, zc);
          B.box(R.steel, 0.05, 0.9, front - 0.6, x0 - side * 1.08, f * fh + 0.05, zc);
          for (let k = 0; k <= Math.floor(front / 0.5); k++) B.box(R.steel, 0.03, 0.9, 0.03, x0 - side * 1.08, f * fh + 0.05, z + 0.3 + k * 0.5 * ((front - 0.6) / front));
        } else B.box(R.concrete, 0.6, 0.1, front - 0.4, x0 - side * 0.3, f * fh + 2.3, zc);
        if (rnd() < 0.35) {
          const bg = signGeoAt(signIdx++, Math.min(front - 1, 4.4), 1.2).rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x0 - side * 0.04, f * fh + 0.9, zc);
          B.add(R.signs, bg, null, true);
        }
      }
      // split AC units, and clothes drying on the balcony rails
      for (let f = 1; f < floors; f++) {
        if (rnd() < 0.55) acs.at(x0 - side * 0.2, f * fh + 0.3 + rnd() * 1.6, z + 0.8 + rnd() * (front - 1.6), [1, 1, 1], side > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (rnd() < 0.45) for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) {
          clothes.at(x0 - side * 1.06, f * fh + 0.95, z + 0.5 + rnd() * (front - 1), [0.5 + rnd() * 0.5, 0.6 + rnd() * 0.5, 1], side > 0 ? -Math.PI / 2 : Math.PI / 2, CLOTH[Math.floor(rnd() * CLOTH.length)]);
        }
      }
      if (floors >= 3 && rnd() < 0.5) {
        const bn = bannerQuad(bannerIdx++).rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x0 - side * 0.06, fh + 0.4, zc);
        B.add(bannerMat, bn, null, true);
      }
      // parapet and the black water tanks on the roofs
      // varying parapets: plain, a pierced balustrade, or a stepped name panel
      const pk = rnd();
      if (pk < 0.4) B.box(R.townWall, 0.2, 0.9, front, x0 + side * 0.1, H, zc, 0, col);
      else if (pk < 0.75) {
        B.box(R.townWall, 0.22, 0.12, front, x0 + side * 0.1, H + 0.85, zc, 0, col);
        for (let k = 0.2; k < front - 0.1; k += 0.3) B.box(R.townWall, 0.12, 0.85, 0.08, x0 + side * 0.1, H, z + k, 0, col);
      } else {
        B.box(R.townWall, 0.2, 0.9, front, x0 + side * 0.1, H, zc, 0, col);
        B.box(R.townWall, 0.22, 0.8, front * 0.5, x0 + side * 0.1, H + 0.9, zc, 0, col.clone().multiplyScalar(1.05));
      }
      if (rnd() < 0.65) tanks.at(xc + side * 2, H, zc + (rnd() - 0.5) * 2, [1, 1, 1]);
      P.solid(Math.min(x0, x1), 0, z, Math.max(x0, x1), H, z + front);
      z += front;
    }
  }
  // blue-tarp shell and bead stalls lining the last stretch of the street: curtains of bead and
  // rudraksha strings, conch and cowrie heaps on low tables
  const beads = new Instances(new THREE.CylinderGeometry(0.022, 0.022, 1, 4).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.5 }));
  const BEAD = [0xc8211a, 0xf2c230, 0x5a2a12, 0xffffff, 0x2a64b0, 0x2e8b57, 0xe86fa0, 0x111111, 0xf08a1c];
  const bags = new Instances(new THREE.BoxGeometry(0.32, 0.36, 0.1).translate(0, -0.18, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }));
  const toys = new Instances(new THREE.SphereGeometry(0.11, 10, 8).translate(0, -0.11, 0), new THREE.MeshStandardMaterial({ roughness: 0.4 }));
  const SHELLC = [0xf4eee0, 0xebe0c8, 0xe2d2b0, 0xf8f4ea, 0xd8c8a8];
  const TOY = [0xe53935, 0x1e88e5, 0xffd54f, 0x43a047, 0xff6f00, 0x8e24aa, 0xf06292];
  for (const side of [-1, 1]) for (let z = OUTER.z1 + 18; z < STREET.z1 - 4; z += 5.2) {
    if (Math.abs(z - EAST_CAR.z) < EAST_CAR.hw + 3.5) continue;
    if (rnd() < 0.1) continue;
    const x = side * (STREET.hw - 1.15);
    const tarp = rnd() < 0.75 ? 0x1f5fbf : 0x2a8ad0;
    for (const dz of [-2.2, 2.2]) for (const dx of [-0.9, 0.9]) {
      const ph = 2.6 + (dx * side > 0 ? 0.4 : 0);
      B.add(R.steel, new THREE.CylinderGeometry(0.03, 0.03, ph, 5).translate(x + dx, ph / 2, z + dz));
    }
    const tq = new THREE.PlaneGeometry(2.3, 4.8).rotateX(-Math.PI / 2).rotateZ(side * 0.17).translate(x, 2.82, z);
    B.add(R.paintOut, tq, tarp);
    B.add(R.paintOut, new THREE.PlaneGeometry(2.3, 4.8).rotateX(Math.PI / 2).rotateZ(side * 0.17).translate(x, 2.81, z), tarp);
    B.add(R.steel, new THREE.CylinderGeometry(0.025, 0.025, 4.4, 5).rotateX(Math.PI / 2).translate(x - side * 0.9, 2.55, z));
    // strings hang in bunches of mixed length: shell garlands (white, beige), beads, rudraksha, with
    // gaps; some bunches end in a knot of shells or a small bag
    for (let zz = z - 2.1; zz < z + 2.1;) {
      const n = 2 + Math.floor(rnd() * 6), shell = rnd() < 0.55;
      const base = shell ? SHELLC[Math.floor(rnd() * SHELLC.length)] : BEAD[Math.floor(rnd() * BEAD.length)];
      const L0 = 0.35 + rnd() * 1.4;
      for (let k = 0; k < n; k++) {
        const len = L0 * (0.75 + rnd() * 0.5);
        beads.at(x - side * (0.9 + (rnd() - 0.5) * 0.1), 2.55, zz + k * 0.05, [shell ? 1.7 : 1, len, shell ? 1.7 : 1], 0, rnd() < 0.8 ? base : BEAD[Math.floor(rnd() * BEAD.length)]);
      }
      if (rnd() < 0.45) toys.at(x - side * 0.9, 2.55 - L0 - 0.02, zz + n * 0.025, [0.8, 0.9, 0.8], 0, shell ? 0xf2ead8 : base);
      zz += n * 0.05 + 0.08 + rnd() * 0.25;
    }
    // bags, toys and shell curtains hung densely from the side bars under the tarp
    for (let k = 0; k < 16; k++) bags.at(x + (rnd() - 0.5) * 1.4, 2.5 - rnd() * 0.15, z + (rnd() < 0.5 ? -2.15 : 2.15) * (0.5 + rnd() * 0.5), [1, 1, 1], rnd() * 6, TOY[Math.floor(rnd() * TOY.length)]);
    for (let k = 0; k < 10; k++) toys.at(x - side * (0.75 + rnd() * 0.1), 2.35 - rnd() * 0.5, z - 2 + rnd() * 4, 0.8 + rnd() * 0.5, 0, TOY[Math.floor(rnd() * TOY.length)]);
    B.box(R.wood, 1.2, 0.75, 4.0, x, 0, z);
    for (let k = 0; k < 30; k++) goods.at(x + (rnd() - 0.5) * 1.0, 0.8, z + (rnd() - 0.5) * 3.7, [1 + rnd() * 0.6, 0.6, 1.3 + rnd() * 0.5], rnd() * 6, rnd() < 0.75 ? 0xf6eee0 : 0xe2c8a0);
    P.solid(x - 0.65, 0, z - 2.1, x + 0.65, 0.8, z + 2.1);
  }
  beads.flush(g, false);
  bags.flush(g, false);
  toys.flush(g, false);
  goods.flush(g, false);

  // ---------- the rest of the town (OpenStreetMap footprints) ----------
  for (const [cx, cz, L, Wd, ang] of BUILDINGS) {
    // leave the street of shophouses, the portico and the beach to the hand-built town
    const ext = (Math.abs(Math.cos(ang)) * L + Math.abs(Math.sin(ang)) * Wd) / 2, ezt = (Math.abs(Math.sin(ang)) * L + Math.abs(Math.cos(ang)) * Wd) / 2;
    if (Math.abs(cx) - ext < STREET.hw + 18 && cz + ezt > OUTER.z1 - 1 && cz - ezt < BEACH.z0 + 6) continue;
    if (Math.abs(cz - EAST_CAR.z) - ezt < EAST_CAR.hw && Math.abs(cx) < 130) continue;
    if (!onLand(cx, cz)) continue;
    // keep the four car streets (Ratha Veedhis) round the outer wall clear
    if (carBands.some(([a0, a1, b0, b1]) => cx + ext > a0 && cx - ext < a1 && cz + ezt > b0 && cz - ezt < b1)) continue;
    // Middle Car Street runs west from the west gopuram on the temple's axis
    if (Math.abs(cx) - ext < 8 && cz - ezt < OUTER.z0 - 4) continue;
    const near = Math.hypot(cx, cz - 150) < 260;
    const floors = 1 + Math.floor(rnd() * (near ? 4 : 2.6));
    const H = floors * 3.2 + 0.9;
    const col = new THREE.Color(rnd() < 0.85 ? STREET_PAINT[Math.floor(rnd() * STREET_PAINT.length)] : PASTEL[Math.floor(rnd() * PASTEL.length)]).multiplyScalar(0.82 + rnd() * 0.14);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang);
    houseM.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, cz), q, new THREE.Vector3(L, H, Wd)));
    houseC.push(desat(col, 0.3));
    if (rnd() < 0.6) {
      const t = new THREE.Vector3((rnd() - 0.5) * L * 0.5, 0, (rnd() - 0.5) * Wd * 0.5).applyQuaternion(q);
      tanks.at(cx + t.x, H, cz + t.z, [1, 1, 1]);
    }
    // (collider = the footprint's own bounds: a square of the long side had pushed 3 m into West Car Street)
    if (L * Wd > 30) P.solid(cx - ext, 0, cz - ezt, cx + ext, H, cz + ezt);
  }

  const mkInst = (list: THREE.Matrix4[], cols: THREE.Color[], mat: THREE.Material, shadow: boolean) => {
    const im = new THREE.InstancedMesh(unitBox(), mat, list.length);
    list.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  };
  mkInst(upperM, upperC, facadeMaterial(true), true);
  mkInst(houseM, houseC, facadeMaterial(false), true);
  tanks.flush(g, false);
  acs.flush(g, false);
  shelf.flush(g, false);
  clothes.flush(g, false);
  // neem, mango and portia trees in the yards and lanes (og_aerial): leaf-card canopies, thickest
  // toward the coast; three instanced draws for all of them
  {
    const spots: [number, number, number, number, number][] = [];
    const ok = (x: number, z: number) => onLand(x, z) && !(x > OUTER.x0 - 16 && x < OUTER.x1 + 16 && z > OUTER.z0 - 16 && z < OUTER.z1 + 12) &&
      !(Math.abs(x) < STREET.hw + 22 && z > OUTER.z1 - 4) && !carBands.some(([a0, a1, b0, b1]) => x > a0 - 2 && x < a1 + 2 && z > b0 && z < b1);
    for (let i = 0; i < 1000 && spots.length < 450; i++) {
      // half of them in a band behind the beach and the shore
      const x = (rnd() - 0.5) * 1000, z = i % 2 ? 200 + rnd() * 140 : -560 + rnd() * 880;
      if (!ok(x, z)) continue;
      const h = 7 + rnd() * 6;
      spots.push([x, 0, z, h, 0.9 + rnd() * 0.5]);
    }
    leafTrees(g, spots, R.bark, 7331);
  }
  // coconut palms in the yards between the houses
  for (let i = 0; i < 130; i++) {
    // (a third of them close behind the shore, where the aerial shows them thickest)
    const x = (rnd() - 0.5) * 900, z = i % 3 === 0 ? 240 + rnd() * 90 : -500 + rnd() * 820;
    if (!onLand(x, z) || (x > OUTER.x0 - 20 && x < OUTER.x1 + 20 && z > OUTER.z0 - 20 && z < OUTER.z1 + 12)) continue;
    if (Math.abs(x) < STREET.hw + 22 && z > OUTER.z1 - 4) continue;
    palm(B, R, x, z, 9 + rnd() * 6, x * 0.37 + z);
  }

  // ---------- electric poles and wires along the street ----------
  const wires: number[] = [];
  for (const side of [-1, 1]) {
    let prev: THREE.Vector3 | null = null;
    for (let z = OUTER.z1 + 18; z < STREET.z1; z += 26) {
      const x = side * (STREET.hw - 0.6);
      B.add(R.concrete, new THREE.BoxGeometry(0.22, 9, 0.22).translate(x, 4.5, z));
      B.add(R.concrete, new THREE.BoxGeometry(1.6, 0.12, 0.12).translate(x - side * 0.5, 8.3, z));
      B.lathe(R.steel, [[0, 0], [0.22, 0.05], [0.18, 0.12], [0, 0.14]], x - side * 1.0, 7.6, z, 8);
      flames.points.push(); // street lamps are electric: no flame
      const top = new THREE.Vector3(x - side * 0.5, 8.2, z);
      if (prev) for (const dx of [-0.6, 0, 0.6]) {
        const a = prev.clone().add(new THREE.Vector3(dx, 0, 0)), b = top.clone().add(new THREE.Vector3(dx, 0, 0));
        const n = 8;
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1);
          p0.y -= Math.sin(t0 * Math.PI) * 0.7; p1.y -= Math.sin(t1 * Math.PI) * 0.7;
          wires.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
      }
      prev = top;
    }
  }
  // cables strung across the street every few metres: power, phone and cable-TV lines, sagging
  for (let z = OUTER.z1 + 20; z < STREET.z1 - 2; z += 9 + rnd() * 6) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const yA = 6.6 + rnd() * 1.6, yB = 6.6 + rnd() * 1.6, sag = 0.4 + rnd() * 0.6, dz = (rnd() - 0.5) * 1.5;
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1.0001; t += 0.125) {
        pts.push(new THREE.Vector3(-STREET.hw + t * STREET.hw * 2, yA + (yB - yA) * t - Math.sin(t * Math.PI) * sag, z + dz * t));
      }
      B.add(R.shade, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.014, 3, false));
    }
  }
  const wg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
  const bunt = new Instances(new THREE.ConeGeometry(0.16, 0.34, 3).rotateX(Math.PI), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }));
  for (let z = OUTER.z1 + 8; z < OUTER.z1 + 90; z += 13) {
    for (let k = 1; k < 26; k++) {
      const t = k / 26;
      bunt.at(-STREET.hw + 0.5 + t * (STREET.hw * 2 - 1), 6.4 - Math.sin(t * Math.PI) * 0.8, z, 1, 0, [0xd8261c, 0xf0c020, 0x2a6fd0, 0x2e9a50, 0xffffff][k % 5]);
    }
  }
  bunt.flush(g, false);

  // ---------- pole-mounted transformers ----------
  for (const [tx, tz] of [[-(STREET.hw - 0.6), OUTER.z1 + 44], [STREET.hw - 0.6, 230]] as [number, number][]) {
    for (const dz of [-1.1, 1.1]) B.add(R.concrete, new THREE.BoxGeometry(0.22, 9, 0.22).translate(tx, 4.5, tz + dz));
    B.add(R.steel, new THREE.BoxGeometry(0.9, 0.08, 2.6).translate(tx, 4.2, tz));
    B.add(R.paintOut, new THREE.BoxGeometry(0.75, 1.1, 0.9).translate(tx, 4.8, tz), 0x6e7478);
    for (let k = 0; k < 6; k++) B.add(R.paintOut, new THREE.BoxGeometry(0.85, 0.8, 0.03).translate(tx, 4.85, tz - 0.38 + k * 0.15), 0x5a6064);
    for (const dz of [-0.25, 0, 0.25]) B.add(R.whitePaint, new THREE.CylinderGeometry(0.05, 0.07, 0.35, 8).translate(tx, 5.5, tz + dz));
  }

  // ---------- pilgrims on the street and at the ghat (kept ≥ 4 m from the spawn and the walk line x = 0) ----------
  const spots: CrowdSpot[] = [];
  for (let i = 0; i < 170; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (4.0 + rnd() * 0.4), z = OUTER.z1 + 16 + rnd() * (STREET.z1 - OUTER.z1 - 30);
    spots.push({ x, y: 0, z, ry: rnd() < 0.5 ? 0 : Math.PI + (rnd() - 0.5) * 0.8, female: rnd() < 0.55 });
  }
  for (let i = 0; i < 26; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (4.5 + rnd() * 10), z = BEACH.z0 + 2.4 + rnd() * 9.5;
    spots.push({ x, y: -0.04 - Math.max(0, Math.min(10, Math.floor((z - BEACH.z0 - 2) / 1.2))) * 0.24, z, ry: rnd() * 6.28, female: rnd() < 0.5 });
  }
  for (let i = 0; i < 44; i++) {
    const x = (rnd() - 0.5) * 60, z = BEACH.z0 + 16 + rnd() * 22;
    if (Math.abs(x) < 4) continue;
    spots.push({ x, y: SEA_Y - 0.55 - rnd() * 0.25, z, ry: rnd() * 6.28, female: rnd() < 0.5, wading: true });
  }
  for (const rx of [-10, -4, 4, 10]) for (let k = 0; k < 4; k++) {
    const x = rx + (rnd() < 0.5 ? -0.6 : 0.6) * (0.6 + rnd() * 0.6);
    if (Math.abs(x) < 4) continue;
    spots.push({ x, y: SEA_Y - 0.4, z: BEACH.z0 + 12.2 + rnd() * 5, ry: Math.PI + (rnd() - 0.5) * 1.2, female: true, wading: true, raised: true });
  }
  pilgrims(g, spots);
  cows(g, [[-(STREET.hw - 1.6), 0, 205, 0.4], [STREET.hw - 1.8, 0, 262, -2.6]]);
  // autos waiting on East Car Street; scooters parked by the portico and at the junction
  vehicles(g,
    [[-9, EAST_CAR.z - 2, Math.PI / 2], [10.5, EAST_CAR.z + 2.5, -Math.PI / 2], [-15, EAST_CAR.z + 1.5, Math.PI / 2 + 0.1]],
    [...Array.from({ length: 6 }, (_, i) => [(i % 2 ? 1 : -1) * (4.6 + rnd() * 0.8), OUTER.z1 + 7 + i * 1.1, (i % 2 ? 1.6 : -1.6) + (rnd() - 0.5) * 0.3] as [number, number, number]),
      ...Array.from({ length: 6 }, (_, i) => [(i % 2 ? 1 : -1) * (12 + i * 1.6), EAST_CAR.z + (i % 2 ? 4.2 : -4.2), (rnd() - 0.5) * 0.4] as [number, number, number])]);

  // ---------- Agni Theertham: the pavilion, the ghat steps, the beach ----------
  const zB = BEACH.z0;
  // promenade at the end of the street
  B.add(R.pavers, new THREE.BoxGeometry(60, 0.3, 5.8).translate(0, -0.13, zB - 3.2));
  P.floor(shore, -30, 30, zB - 6, zB + 2.05, 0.02);
  // the pavilion beside the ghat (west of the street axis): orange-red pillars, a flat roof with a painted fascia
  const pvx = -22;
  // a pink-and-white pavilion with round pillars, a deep cornice and small domed kiosks on its corners
  const PINKP = 0xe9a2ae, WHITE = 0xf6f2ea;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.lathe(R.paintOut, [[0.36, 0], [0.36, 0.25], [0.27, 0.32], [0.24, 3.9], [0.32, 4.05], [0.34, 4.2], [0, 4.2]], pvx + sx * 4.2, 0, zB - 2 + sz * 2.4, 16, PINKP);
    P.solid(pvx + sx * 4.2 - 0.3, 0, zB - 2 + sz * 2.4 - 0.3, pvx + sx * 4.2 + 0.3, 4.6, zB - 2 + sz * 2.4 + 0.3);
  }
  B.box(R.paintOut, 10, 0.45, 6.2, pvx, 4.2, zB - 2, WHITE);
  B.box(R.paintOut, 10.6, 0.16, 6.8, pvx, 4.65, zB - 2, PINKP);
  B.box(R.paintOut, 10.2, 0.5, 6.4, pvx, 4.81, zB - 2, WHITE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const kx = pvx + sx * 4.4, kz = zB - 2 + sz * 2.6;
    for (const dx of [-0.45, 0.45]) for (const dz of [-0.45, 0.45]) B.box(R.paintOut, 0.14, 1.1, 0.14, kx + dx, 5.31, kz + dz, 0, PINKP);
    B.box(R.paintOut, 1.2, 0.12, 1.2, kx, 6.41, kz, 0, WHITE);
    B.lathe(R.paintOut, [[0.55, 0], [0.55, 0.12], [0.5, 0.35], [0.3, 0.6], [0.08, 0.75], [0.03, 0.95], [0, 1.0]], kx, 6.53, kz, 16, WHITE);
  }
  B.lathe(R.goldOut, [[0.3, 0], [0.34, 0.2], [0.18, 0.45], [0.06, 0.7], [0, 0.78]], pvx, 5.31, zB - 2, 12);
  // ghat: dark weathered granite steps running down into the sea between low side walls
  const stepN = 11, stepD = 1.2, rise = 0.24;
  const stepTop = (z: number) => -0.04 - Math.max(0, Math.min(stepN - 1, Math.floor((z - zB - 2) / stepD))) * rise;
  for (let i = 0; i < stepN; i++) {
    const y = -0.28 - i * rise;
    SB.add(i >= 3 ? R.ghatWet : R.ghatStone, new THREE.BoxGeometry(30, 0.5, stepD).translate(0, y - 0.25 + rise, zB + 2 + i * stepD + stepD / 2));
    SB.add(R.graniteDark, new THREE.BoxGeometry(30, 0.08, 0.1).translate(0, y + rise - 0.04, zB + 2 + i * stepD + 0.05));
    P.floor(shore, -15, 15, zB + 2 + i * stepD, zB + 2 + (i + 1) * stepD, y + rise);
  }
  // the landing at the head of the steps, also dark granite
  SB.add(R.ghatStone, new THREE.BoxGeometry(32, 0.3, 2.4).translate(0, -0.13, zB + 0.9));
  const ghatEnd = zB + 2 + stepN * stepD;
  P.floor(shore, -15, 15, ghatEnd, ghatEnd + 6, -0.28 - stepN * rise + rise - 0.05, -0.28 - stepN * rise - 0.2);
  for (const sx of [-1, 1]) {
    SB.add(R.ghatStone, new THREE.BoxGeometry(1.2, 1.6, stepN * stepD + 4).translate(sx * 15.6, -1.0, zB + (stepN * stepD + 4) / 2));
    P.solid(sx * 15.6 - 0.6, -3.5, zB, sx * 15.6 + 0.6, 1, zB + stepN * stepD + 4);
  }
  // maroon posts with two continuous steel pipe rails, down the steps and on out into the water
  for (const x of [-10, -4, 4, 10]) {
    const tops: THREE.Vector3[] = [];
    for (let z = zB + 1.2; z <= zB + 24; z += 2.2) {
      const base = z < ghatEnd ? stepTop(z) : -3.0;
      const top = Math.max(stepTop(Math.min(z, ghatEnd - 0.1)) + 1.05, SEA_Y + 0.8);
      SB.add(R.maroon, new THREE.BoxGeometry(0.22, top - base, 0.22).translate(x, (top + base) / 2, z));
      SB.add(R.maroon, new THREE.BoxGeometry(0.28, 0.08, 0.28).translate(x, top + 0.04, z));
      tops.push(new THREE.Vector3(x, top - 0.02, z));
    }
    for (const dy of [0, -0.5]) {
      const pts = tops.map((p) => p.clone().add(new THREE.Vector3(0, dy, 0)));
      SB.add(R.steel, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.03, 6, false));
    }
  }
  // ---------- coconut palms along the shore and among the houses ----------
  const palms: [number, number, number][] = [];
  coast.forEach((p, i) => {
    if (i === 0 || p.length() > 700) return;
    for (let k = 0; k < 2; k++) {
      const t = rnd();
      const q = coast[i - 1].clone().lerp(p, t).addScaledVector(nrm[i], 12 + rnd() * 22);
      palms.push([q.x, q.y, 8 + rnd() * 5]);
    }
  });
  for (let i = 0; i < 18; i++) palms.push([(rnd() - 0.5) * 520, 130 + rnd() * 190, 8 + rnd() * 6]);
  // a line of coconut palms along the beach either side of the ghat
  for (let i = 0; i < 18; i++) palms.push([(i % 2 ? 1 : -1) * (31 + rnd() * 50), zB - 9 + rnd() * 8, 9 + rnd() * 5]);
  for (const [x, z, h] of palms) {
    if (Math.abs(x) < STREET.hw + 24 && z < zB + 12 && z > OUTER.z1 - 4) continue;
    if (Math.abs(x) < 20 && z < zB + 30 && z > zB - 12) continue; // keep the bathing ghat clear
    if (x > OUTER.x0 - 8 && x < OUTER.x1 + 8 && z > OUTER.z0 - 8 && z < OUTER.z1 + 2) continue;
    palm(B, R, x, z, h, x * 0.37 + z);
  }

  // ---------- fishing boats: hundreds anchored off the shore, thickest to the north-east ----------
  const NB = 200;
  const boats = new THREE.InstancedMesh(boatGeometry(), R.hull, NB);
  const boatBase: THREE.Matrix4[] = [];
  for (let i = 0; i < NB; i++) {
    const cl = rnd() < 0.7;
    const x = cl ? 60 + rnd() * 420 : (rnd() - 0.5) * 520, z = BEACH.water + (cl ? 70 : 90) + rnd() * (cl ? 420 : 520);
    const s = i < 3 ? 1.6 : 0.75 + rnd() * 0.4;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, SEA_Y - 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI), new THREE.Vector3(s, s, s));
    boatBase.push(m);
    boats.setMatrixAt(i, m);
    boats.setColorAt(i, new THREE.Color([0xffffff, 0xd8e6f0, 0xf0e0c0, 0xe8f0e0][i % 4]));
  }
  boats.castShadow = false;
  shore.add(boats);

  // ---------- the sea: the Gulf of Mannar, calm and shallow, turquoise near the shore ----------
  // a grid whose cells are a few metres near Agni Theertham and kilometres at the horizon
  const seaGeo = new THREE.PlaneGeometry(2, 2, 150, 150);
  const sp2 = seaGeo.attributes.position;
  const warp = (u: number) => Math.sign(u) * 9000 * Math.pow(Math.abs(u), 3) + u * 60;
  for (let i = 0; i < sp2.count; i++) sp2.setXY(i, warp(sp2.getX(i)), -(BEACH.water + 40 + warp(sp2.getY(i))));
  // negating y mirrored the plane: restore the winding so the sea faces up again
  {
    const idx = seaGeo.index!;
    for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); }
    seaGeo.computeVertexNormals();
  }
  // shallows: a distance-to-shore map (2 km square round the temple) tints the first ~40 m turquoise
  const SN = 256, SPAN = 2000;
  const shoalData = new Uint8Array(SN * SN * 4);
  const segD = (px: number, pz: number) => {
    let best = 1e9;
    for (let i = 1; i < coast.length; i++) {
      const a = coast[i - 1], b = coast[i];
      const abx = b.x - a.x, abz = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.y) * abz) / (abx * abx + abz * abz)));
      best = Math.min(best, Math.hypot(px - a.x - abx * t, pz - a.y - abz * t));
    }
    return best;
  };
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
    const x = -SPAN / 2 + ((i + 0.5) / SN) * SPAN, z = -SPAN / 2 + ((j + 0.5) / SN) * SPAN;
    const d = segD(x, z);
    shoalData[(j * SN + i) * 4] = Math.round(255 * Math.max(0, Math.min(1, 1 - d / 45)));
    shoalData[(j * SN + i) * 4 + 3] = 255;
  }
  const shoalMap = new THREE.DataTexture(shoalData, SN, SN);
  shoalMap.magFilter = shoalMap.minFilter = THREE.LinearFilter;
  shoalMap.needsUpdate = true;
  const water = new Water(seaGeo, {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: sunDir.clone(),
    sunColor: 0xfff4e0, waterColor: 0x187a6c, distortionScale: 3.6, fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, SEA_Y, 0);
  water.material.uniforms.size.value = 3.2;
  // a gentle swell, fading with distance
  water.material.vertexShader = water.material.vertexShader.replace(
    'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
    `vec3 pos = position;
     vec4 wp0 = modelMatrix * vec4( position, 1.0 );
     float fade = smoothstep( 360.0, 80.0, distance( wp0.xz, cameraPosition.xz ) );
     pos.z += fade * ( 0.07 * sin( dot( wp0.xz, vec2( 0.05, 0.13 ) ) - time * 1.6 )
                     + 0.04 * sin( dot( wp0.xz, vec2( -0.11, 0.07 ) ) - time * 2.3 ) );
     mirrorCoord = modelMatrix * vec4( pos, 1.0 );`).replace(
    'vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
    'vec4 mvPosition =  modelViewMatrix * vec4( pos, 1.0 );');
  // the shallows: blend toward a sandy turquoise over the first ~25 m (the water is barely knee deep)
  water.material.uniforms.shoalMap = { value: shoalMap };
  water.material.fragmentShader = water.material.fragmentShader.replace(
    'uniform sampler2D mirrorSampler;', 'uniform sampler2D mirrorSampler;\nuniform sampler2D shoalMap;').replace(
    'gl_FragColor = vec4( outgoingLight, alpha );',
    `float shoal = texture2D( shoalMap, ( worldPosition.xz + ${(SPAN / 2).toFixed(1)} ) / ${SPAN.toFixed(1)} ).r;
     outgoingLight = mix( outgoingLight, vec3( 0.2, 0.6, 0.5 ) * ( 0.45 + 0.6 * max( sunDirection.y, 0.0 ) ), shoal * 0.78 );
     gl_FragColor = vec4( outgoingLight, alpha );`);
  root.add(water);
  // the mirror pass only needs the sky, the shore and the boats
  const mirror = water.onBeforeRender.bind(water);
  water.onBeforeRender = (...args) => {
    const hidden = root.children.filter((c) => c !== shore && c !== water && c.visible);
    hidden.forEach((o) => (o.visible = false));
    mirror(...args);
    hidden.forEach((o) => (o.visible = true));
  };

  // ---------- the Rameswaram TV tower (1995, 323 m, concrete), a kilometre north-west ----------
  {
    const tx = 596, tz = -838;
    B.lathe(R.concrete, [[0, 0], [13, 0], [12, 4], [9.5, 30], [7.2, 90], [5.6, 160], [4.8, 205], [0, 205]], tx, 0, tz, 20);
    B.lathe(R.concrete, [[4.8, 0], [10, 2], [10.5, 4], [10.5, 13], [8, 15], [4.4, 16], [4.2, 46], [3.0, 50], [0, 50]], tx, 205, tz, 20);
    for (let k = 0; k < 6; k++) {
      B.add(R.paintOut, new THREE.CylinderGeometry(1.2 - k * 0.12, 1.3 - k * 0.12, 11, 8).translate(tx, 255 + 5.5 + k * 11, tz), k % 2 ? 0xf2efe8 : 0xc8211a);
    }
  }

  B.flush(g, true, 'town');
  SB.flush(shore, true, 'shore');
  void RING; void ARM;
  return {
    group: g, water,
    update(t: number) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < Math.min(48, boatBase.length); i++) {
        e.set(Math.sin(t * 0.9 + i) * 0.04, 0, Math.sin(t * 0.7 + i * 2) * 0.05);
        q.setFromEuler(e);
        m.copy(boatBase[i]).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
        m.elements[13] += Math.sin(t * 1.1 + i) * 0.05;
        boats.setMatrixAt(i, m);
      }
      boats.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Wooden fishing boat (vallam), ~8 m: pointed hull, painted bands, a small wheelhouse. */
function boatGeometry() {
  const parts: { g: THREE.BufferGeometry; c?: THREE.ColorRepresentation }[] = [];
  const hull = new THREE.BoxGeometry(1, 1, 1, 10, 2, 2);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const end = Math.abs(x) * 2; // 0 middle .. 1 ends
    const w = (1 - Math.pow(end, 2.2)) * (y > 0 ? 1 : 0.55);
    p.setXYZ(i, x * 8, y * 1.1 + (y > 0 ? Math.pow(end, 2) * 0.5 : 0), z * 2.2 * Math.max(w, 0.04));
  }
  hull.computeVertexNormals();
  parts.push({ g: hull.translate(0, 0.25, 0), c: 0x2f6fb0 });
  parts.push({ g: new THREE.BoxGeometry(6.8, 0.18, 1.9).translate(0, 0.72, 0), c: 0xb8231a });
  parts.push({ g: new THREE.BoxGeometry(1.6, 1.2, 1.3).translate(-1.6, 1.4, 0), c: 0xf2efe8 });
  parts.push({ g: new THREE.BoxGeometry(1.8, 0.1, 1.5).translate(-1.6, 2.05, 0), c: 0xd8541a });
  parts.push({ g: new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5).translate(1.6, 2.2, 0), c: 0x6b4a2a });
  return mergeParts(parts);
}

/** Coconut palm (after the Somnath site's): a leaning ringed trunk, coconuts, drooping pinnate fronds. */
function palm(B: Batch, R: RM, x: number, z: number, h: number, seed: number) {
  let s = Math.abs(Math.floor(seed * 9301)) % 233280 || 1;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const lean = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.22);
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const p0 = new THREE.Vector3(lean.x * t0 * t0 * h, t0 * h, lean.z * t0 * t0 * h);
    const p1 = new THREE.Vector3(lean.x * t1 * t1 * h, t1 * h, lean.z * t1 * t1 * h);
    const c = new THREE.CylinderGeometry(0.16 - t1 * 0.04, 0.2 - t0 * 0.04, p0.distanceTo(p1) + 0.02, 7);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()));
    c.translate(x + (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, z + (p0.z + p1.z) / 2);
    B.add(R.bark, c);
  }
  const top = new THREE.Vector3(x + lean.x * h, h, z + lean.z * h);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    B.add(R.bark, new THREE.SphereGeometry(0.13, 7, 5).translate(top.x + Math.cos(a) * 0.22, top.y - 0.25 - (k % 2) * 0.12, top.z + Math.sin(a) * 0.22));
  }
  const fronds = 14;
  for (let f = 0; f < fronds; f++) {
    const dead = f >= fronds - 2;
    const a = (f / fronds) * Math.PI * 2 + rnd() * 0.4;
    const len = dead ? 2.6 : 3.4 + rnd() * 1.1;
    const lift = dead ? -1.2 : f % 3 === 0 ? 0.5 : 0;
    const pos: number[] = [];
    const n = 12;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const yy = dead ? -t * 2.2 : Math.sin(t * Math.PI * 0.6) * (0.8 + lift) - t * t * 2.1 + 0.2;
      pts.push(new THREE.Vector3(Math.cos(a) * t * len, yy, Math.sin(a) * t * len));
    }
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    for (let i = 1; i < n; i++) {
      const p = pts[i], dir = pts[i + 1].clone().sub(p).normalize();
      const ll = (dead ? 0.4 : 0.85) * Math.sin((i / n) * Math.PI * 0.95 + 0.15);
      for (const sg of [-1, 1]) {
        const tip = p.clone().addScaledVector(side, sg * ll).addScaledVector(dir, ll * 0.45);
        tip.y -= ll * 0.55;
        const base2 = p.clone().addScaledVector(dir, 0.12);
        const mid = p.clone().addScaledVector(side, sg * ll * 0.5).addScaledVector(dir, ll * 0.3);
        mid.y -= ll * 0.2 - 0.04;
        for (const v of [p, mid, tip, p, tip, base2]) pos.push(v.x + top.x, v.y + top.y, v.z + top.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    B.add(dead ? R.bark : R.leaf, geo);
  }
}

const BANNERS: [string, string, string, string][] = [
  ['ஸ்ரீ ராமநாத', 'SRI RAMANATHA\nLODGE', '#c8211a', '#ffe14a'],
  ['முத்து', 'PEARLS\n& SHELLS', '#f2c418', '#7a1208'],
  ['அன்னதானம்', 'ANNADANAM\nHALL', '#1c4f9c', '#ffffff'],
  ['தீர்த்த', 'THEERTHA\nYATRA', '#178a3c', '#ffffff'],
  ['ஹோட்டல்', 'HOTEL\nSETHU', '#e8701a', '#ffffff'],
  ['சங்கு', 'CONCH\nSHOP', '#6a2a8c', '#ffe9a8'],
  ['மெஸ்', 'VEG\nMESS', '#b3122e', '#ffd84a'],
  ['டிராவல்ஸ்', 'TRAVELS\nDHANUSHKODI', '#0f6f78', '#ffffff'],
];

/** 8 vertical vinyl banners (256×1024 each, side by side) */
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const x = c.getContext('2d')!;
  BANNERS.forEach(([ta, en, bg, fg], i) => {
    const cx = i * 256;
    x.fillStyle = bg; x.fillRect(cx, 0, 256, 1024);
    x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(cx + 10, 10, 236, 1004);
    x.fillStyle = fg; x.textAlign = 'center';
    x.save(); x.translate(cx + 128, 512); x.rotate(-Math.PI / 2);
    x.font = 'bold 120px "Noto Sans Tamil", "Tamil Sangam MN", sans-serif';
    x.fillText(ta, 0, -10, 960);
    x.font = 'bold 66px Arial, sans-serif';
    const lines = en.split('\n');
    lines.forEach((l, k) => x.fillText(l, 0, 70 + k * 64, 960));
    x.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A 1.1 × 4.4 m vertical banner quad showing banner `i` (base at y = 0, facing +z). */
function bannerQuad(i: number) {
  const g = new THREE.PlaneGeometry(1.1, 4.4).translate(0, 2.2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const k = i % BANNERS.length;
  for (let j = 0; j < uv.count; j++) uv.setX(j, (k + uv.getX(j)) / BANNERS.length);
  return g;
}

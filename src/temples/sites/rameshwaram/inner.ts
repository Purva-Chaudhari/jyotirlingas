import * as THREE from 'three';
import type { Physics, Flames } from '../../engine/kit';
import { Batch, Instances, mergeParts } from './batch';
import { atlasQuad, THEERTHAMS, type RM } from './mats';
import { worldUV } from '../../engine/materials';
import { nandiMesh, paintNandiRam, collarBells } from './nandi';
import { PRAK2, PRAK1, RAJA, NANDI, DHWAJA, BALI, WELLS, AMMAN, RING, ARM } from './layout';

/**
 * The second prakara: its east and west walls (the third corridor's arms close north and south),
 * the high Nandi mandapam behind the Rajagopuram with the great painted stucco Nandi in its wire
 * cage, the gold-clad dhwajastambham and the balipitham under a skylight, the open court of the
 * theertham wells (each with its parapet, pulley frame, bucket and numbered name board), the
 * pillared halls of the second corridor, and the first four theerthams in the court by the gopuram.
 */

/** Granite hall pillar (second corridor): square blocks, octagonal sections, a cross bracket. 1 m ≈ local. */
function hallPillar(h: number) {
  const p: { g: THREE.BufferGeometry }[] = [];
  const b = (w: number, hh: number, d: number, y: number) => p.push({ g: new THREE.BoxGeometry(w, hh, d).translate(0, y + hh / 2, 0) });
  b(0.95, 0.35, 0.95, 0);
  b(0.72, 1.0, 0.72, 0.35);
  p.push({ g: new THREE.CylinderGeometry(0.38, 0.38, h * 0.18, 8).translate(0, 1.35 + h * 0.09, 0) });
  b(0.72, 0.8, 0.72, 1.35 + h * 0.18);
  p.push({ g: new THREE.CylinderGeometry(0.38, 0.38, h - 3.3 - h * 0.18, 8).translate(0, 2.15 + h * 0.18 + (h - 3.3 - h * 0.18) / 2, 0) });
  b(0.8, 0.5, 0.8, h - 1.15);
  b(0.62, 0.35, 1.9, h - 0.65);
  b(1.9, 0.3, 0.62, h - 0.3);
  const g = mergeParts(p, false);
  worldUV(g);
  return g;
}

/**
 * A theertham well, as at Kodi / Ganga theertham today (c02): a low whitewashed granite kerb (≈0.7 m),
 * grimy at the foot, under a small two-post roof carrying the pulley; a brass pot and a steel bucket.
 */
function well(B: Batch, R: RM, x: number, z: number, square: boolean) {
  const kh = 0.72;
  if (square) {
    for (const [a, b, c, d] of [[-1.2, 1.2, -1.2, -0.95], [-1.2, 1.2, 0.95, 1.2], [-1.2, -0.95, -0.95, 0.95], [0.95, 1.2, -0.95, 0.95]]) B.span(R.kerb, x + a, x + b, 0, kh, z + c, z + d);
    B.span(R.kerb, x - 1.3, x + 1.3, kh, kh + 0.1, z - 1.3, z - 1.05);
    B.span(R.kerb, x - 1.3, x + 1.3, kh, kh + 0.1, z + 1.05, z + 1.3);
  } else {
    // the kerb: a plinth, the drum and a projecting coping
    B.lathe(R.kerb, [[0.86, -0.3], [0.86, kh - 0.06], [0.9, kh], [1.14, kh], [1.16, kh - 0.08], [1.1, kh - 0.18], [1.1, 0.16], [1.18, 0.12], [1.18, 0]], x, 0, z, 24);
  }
  // a brass pot on its rope beside the bucket
  B.lathe(R.brass, [[0, 0], [0.14, 0.03], [0.17, 0.12], [0.1, 0.24], [0.07, 0.28], [0.1, 0.32], [0, 0.32]], x - 0.6, kh, z - 0.55, 12);
  B.add(R.whitePaint, new THREE.CylinderGeometry(0.01, 0.01, 1.6, 4).translate(x - 0.6, kh + 0.3 + 0.8, z - 0.55));
  // dark water deep in the shaft
  B.add(R.wellWater, new THREE.CircleGeometry(0.86, 16).rotateX(-Math.PI / 2).translate(x, -0.25, z));
  B.add(R.shade, new THREE.CylinderGeometry(0.86, 0.86, 0.5, 16, 1, true).translate(x, 0.0, z));
  // two granite posts, a beam with the steel pulley, and a small roof over them
  for (const sx of [-1, 1]) B.box(R.granite, 0.22, 2.4, 0.22, x + sx * 1.0, 0.0, z);
  B.box(R.wood, 2.3, 0.16, 0.16, x, 2.4, z);
  B.add(R.steel, new THREE.TorusGeometry(0.16, 0.035, 6, 14).translate(x, 2.25, z));
  B.add(R.whitePaint, new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4).translate(x + 0.16, 1.55, z));
  B.lathe(R.steel, [[0.0, 0], [0.13, 0], [0.16, 0.24], [0.17, 0.27]], x + 0.65, kh, z + 0.6, 12);
  for (const sz of [-1, 1]) {
    const slab = new THREE.BoxGeometry(2.7, 0.08, 1.15).rotateX(sz * 0.32).translate(x, 2.78, z + sz * 0.52);
    B.add(R.roofRed, slab);
  }
  B.box(R.concrete, 2.7, 0.12, 0.16, x, 2.9, z);
}

export function buildInner(root: THREE.Group, R: RM, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'inner';
  root.add(g);
  const B = new Batch();
  const G = R.granite;
  const pillars = new Instances(hallPillar(6.4), R.carved);
  const tallPillars = new Instances(hallPillar(9.0), R.carved);
  const wallH = PRAK2.h;

  // ---------- second prakara walls (east: either side of the Rajagopuram; west: either side of the Sethu corridor) ----------
  const ew = (a: number, b: number) => {
    B.span(G, a, b, 0, wallH, PRAK2.z1 - 1, PRAK2.z1 + 1);
    B.span(G, a - 0.1, b + 0.1, wallH, wallH + 0.4, PRAK2.z1 - 1.15, PRAK2.z1 + 1.15);
    P.solid(Math.min(a, b), 0, PRAK2.z1 - 1, Math.max(a, b), wallH, PRAK2.z1 + 1);
  };
  const half = RAJA.w / 2;
  const ammanDoor = -33;
  // (the Amman gopuram, built in precinct.ts, fills the wall from x −41 to −25)
  ew(PRAK2.x0, ammanDoor - 8);
  ew(ammanDoor + 8, -half);
  ew(half, PRAK2.x1);
  // lintel over the side door
  const ww = (a: number, b: number) => {
    B.span(G, a, b, 0, wallH, PRAK2.z0, PRAK2.z0 + 1.5);
    P.solid(Math.min(a, b), 0, PRAK2.z0, Math.max(a, b), wallH, PRAK2.z0 + 1.5);
  };
  ww(PRAK2.x0, -ARM.wall);
  ww(ARM.wall, PRAK2.x1);

  // ---------- the court between the east corridor and the prakara wall: theerthams 1–4 ----------
  const boardMat = R.boards;
  const board = (i: number, x: number, z: number, ry: number) => {
    // small enamel boards (0.6 × 0.4 m) on a short post
    const q = atlasQuad(0.6, 0.4, i % 4, Math.floor(i / 4), 4, 6);
    q.rotateY(ry).translate(x, 1.1, z);
    B.add(boardMat, q, null, true);
    B.box(R.steel, 0.04, 1.15, 0.04, x - Math.sin(ry) * 0.03, 0, z - Math.cos(ry) * 0.03);
  };
  const wells: [number, number, number, boolean][] = [];
  // Mahalakshmi, Savithri, Gayathri, Saraswathi — in the court south of the Rajagopuram
  [[-48.5, 96.8], [-44, 96.8], [-22, 96.8], [-18, 96.8]].forEach(([x, z], i) => wells.push([x, z, i, i === 0]));
  // the wells court: Sanku, Chakra, Suriya, Chandra, Ganga, Yamuna, Gaya, Siva, Sadhyamirtha, Sarva
  const courtIdx = [10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
  courtIdx.forEach((n, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    wells.push([col ? -24 : -42, 50 + row * 7.5, n, n === 15 || n === 18]);
  });
  for (const [x, z, n, sq] of wells) {
    well(B, R, x, z, sq);
    P.solid(x - 1.25, 0, z - 1.25, x + 1.25, 2.4, z + 1.25);
    // the board faces the path between the two rows (or the court's walk)
    const ry = z > 90 ? Math.PI : x < -33 ? Math.PI / 2 : -Math.PI / 2;
    board(n, x + (z > 90 ? 0 : x < -33 ? 1.45 : -1.45), z + (z > 90 ? -1.45 : 0), ry);
  }
  // wet granite paving of the wells court
  B.span(R.wetRed, WELLS.x0, WELLS.x1, 0.0, 0.03, 35, WELLS.z1);
  B.span(R.wetRed, PRAK2.x0, -RAJA.w / 2, 0.0, 0.03, PRAK2.z1 + 1, RING.zE - ARM.wall);
  // the court's colonnaded edges (a pillared verandah round three sides)
  for (let z = 37; z < WELLS.z1; z += 4.5) {
    pillars.at(WELLS.x0 + 2.2, 0, z);
    P.solid(WELLS.x0 + 1.7, 0, z - 0.45, WELLS.x0 + 2.7, 6.4, z + 0.45);
  }
  B.span(G, WELLS.x0, WELLS.x0 + 4.4, 6.4, 7.0, 35, WELLS.z1);

  // ---------- Nandi mandapam: a tall pillared hall on the axis behind the Rajagopuram ----------
  const nz0 = PRAK1.z1 + 1, nz1 = PRAK2.z1 - 1, nx = 14, roofY = 10.2;
  for (const sx of [-1, 1]) for (const px of [6, 11.2]) {
    for (let z = nz0 + 2; z < nz1 - 1; z += 4.4) {
      if (z > DHWAJA.z - 5 && z < DHWAJA.z + 5 && px < 8) continue;
      tallPillars.at(sx * px, 0, z);
      P.solid(sx * px - 0.48, 0, z - 0.48, sx * px + 0.48, roofY, z + 0.48);
    }
  }
  // roof with a skylight over the dhwajastambham; painted ceiling panels under it
  const sky0 = DHWAJA.z - 4.5, sky1 = DHWAJA.z + 4.5;
  for (const [a, b] of [[nz0, sky0], [sky1, nz1]]) {
    B.span(R.roofRed, -nx, nx, roofY + 0.3, roofY + 0.9, a, b);
    const cp = new THREE.PlaneGeometry(nx * 2, b - a).rotateX(Math.PI / 2);
    const uv = cp.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (nx * 2) / 5.6, uv.getY(i) * (b - a) / 12);
    B.add(R.sideCeiling, cp.translate(0, roofY + 0.28, (a + b) / 2), null, true);
  }
  for (const sx of [-1, 1]) B.span(R.roofRed, sx * 3, sx * nx, roofY + 0.3, roofY + 0.9, sky0, sky1);
  for (const sx of [-1, 1]) {
    B.span(R.paintOut, sx * (nx - 0.2), sx * (nx + 0.2), roofY - 0.5, roofY + 0.3, nz0, nz1, 0xb7231a);
    B.span(R.paintOut, sx * (nx - 0.2), sx * (nx + 0.2), roofY - 0.8, roofY - 0.5, nz0, nz1, 0xf2c230);
  }
  // beams along the pillar rows
  for (const sx of [-1, 1]) for (const px of [6, 11.2]) B.span(G, sx * px - 0.45, sx * px + 0.45, roofY - 0.5, roofY + 0.3, nz0, nz1);

  // the Nandi on its plinth, inside a wire-mesh cage
  const pl = NANDI.plinth, nzc = NANDI.z;
  B.span(G, -3.2, 3.2, 0, 0.3, nzc - 4.9, nzc + 4.7);
  B.span(G, -3.0, 3.0, 0.3, pl - 0.2, nzc - 4.7, nzc + 4.5);
  B.span(G, -3.1, 3.1, pl - 0.2, pl, nzc - 4.8, nzc + 4.6);
  P.solid(-3.2, 0, nzc - 4.9, 3.2, 5.5, nzc + 4.7);
  // 22 ft long and 17 ft high: the bull is scaled up, head held high, horns upright
  const sc = 3.45, lift = 0;
  const bull = nandiMesh(R.stucco, sc, 88, 0, true);
  paintNandiRam(bull.geometry, sc);
  // the stucco bull is broad: widen the body, and the head and chest most of all
  {
    const pa = bull.geometry.attributes.position, na = bull.geometry.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      const f = nandiWiden(pa.getZ(i) / sc);
      pa.setX(i, pa.getX(i) * f);
      const nx = na.getX(i) / f, ny = na.getY(i), nz = na.getZ(i), l = Math.hypot(nx, ny, nz);
      na.setXYZ(i, nx / l, ny / l, nz / l);
    }
    bull.geometry.computeBoundingSphere();
  }
  bull.position.set(0, pl, nzc + 0.3);
  bull.castShadow = false;
  g.add(bull);
  nandiOrnaments(B, R, sc, pl, nzc + 0.3, lift);
  // the bells of the painted collar, in relief: gilt bells hanging on the gold bands
  {
    const bellGeo = new THREE.LatheGeometry([[0, 0], [0.03, -0.004], [0.042, -0.035], [0.05, -0.075], [0.02, -0.085], [0, -0.09]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    const pts = collarBells();
    const im = new THREE.InstancedMesh(bellGeo, R.goldOut, pts.length);
    pts.forEach(([x, y, z], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(
      new THREE.Vector3(x * sc * nandiWiden(z), pl + y * sc, nzc + 0.3 + z * sc), new THREE.Quaternion(), new THREE.Vector3(sc / 2.4, sc / 2.4, sc / 2.4))));
    im.castShadow = false;
    im.computeBoundingSphere();
    g.add(im);
  }
  // the painted royal devotee standing beside the Nandi, hands joined (a Sethupathi donor image):
  // a tall green crown, gold ornaments, blue veshti — massing only, no features
  {
    const fx = 2.75, fz = nzc - 3.9, y0 = pl;
    const add = (g: THREE.BufferGeometry, c: number) => B.add(R.paintOut, g.translate(fx, y0, fz), c);
    const lathe = (pr: [number, number][], seg = 14) => new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    add(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 14).translate(0, 0.06, 0), 0xe8e4dc);
    add(lathe([[0.2, 0.12], [0.24, 0.3], [0.22, 0.6], [0.2, 0.95], [0.19, 1.0], [0, 1.0]]), 0x3a52a8); // veshti
    add(lathe([[0.2, 0.95], [0.21, 1.0], [0.2, 1.06], [0, 1.06]]), 0xe0b030); // belt
    add(lathe([[0.19, 1.04], [0.21, 1.22], [0.22, 1.36], [0.12, 1.44], [0, 1.45]]), 0xe8a890); // torso
    add(lathe([[0.2, 1.3], [0.22, 1.36], [0.14, 1.42], [0, 1.42]]), 0xe0b030); // necklace
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).translate(0, 1.46, 0), 0xe8a890);
    add(new THREE.SphereGeometry(0.105, 12, 10).scale(1, 1.15, 1).translate(0, 1.6, 0), 0xe8a890);
    add(lathe([[0.1, 1.68], [0.095, 1.74], [0.06, 1.9], [0.02, 1.98], [0, 2.0]], 10), 0x3aa04a); // the green crown
    add(lathe([[0.106, 1.66], [0.106, 1.7], [0, 1.7]]), 0xe0b030);
    for (const sx of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.05, 0.045, 0.3, 8).rotateZ(sx * 0.2).translate(sx * 0.24, 1.25, 0.02), 0xe8a890);
      add(new THREE.CylinderGeometry(0.045, 0.04, 0.26, 8).rotateX(-1.1).rotateZ(-sx * 0.5).translate(sx * 0.13, 1.22, -0.1), 0xe8a890);
      add(new THREE.TorusGeometry(0.055, 0.015, 5, 10).rotateX(Math.PI / 2).translate(sx * 0.25, 1.33, 0.02), 0xe0b030);
    }
    add(new THREE.SphereGeometry(0.06, 8, 6).scale(0.7, 1.3, 0.6).translate(0, 1.3, -0.2), 0xe8a890); // joined hands
  }
  // the Nandhiswarar shrine: a tall room, pale-blue inside, closed by a welded mesh screen on the
  // side facing the sanctum (west), its name board above
  const rw = 3.9, rz0 = nzc - 5.0, rz1 = nzc + 4.6, rh = 6.0;
  for (const sx of [-1, 1]) {
    B.span(R.carved, sx * rw, sx * (rw + 0.5), 0, rh, rz0, rz1 + 0.5);
    B.span(R.paintOut, sx * (rw - 0.02), sx * rw, 0.9, rh, rz0, rz1, 0xd6e2ea);
    P.solid(Math.min(sx * rw, sx * (rw + 0.5)), 0, rz0, Math.max(sx * rw, sx * (rw + 0.5)), rh, rz1 + 0.5);
  }
  B.span(R.carved, -rw - 0.5, rw + 0.5, 0, rh, rz1, rz1 + 0.5);
  B.span(R.paintOut, -rw, rw, 0.9, rh, rz1 - 0.02, rz1, 0xd6e2ea);
  P.solid(-rw - 0.5, 0, rz1, rw + 0.5, rh, rz1 + 0.5);
  B.span(R.concrete, -rw - 0.6, rw + 0.6, rh, rh + 0.5, rz0 - 0.4, rz1 + 0.6);
  B.span(R.paintOut, -rw, rw, rh - 0.02, rh, rz0, rz1, 0xe4ecf0);
  // the screen: a dark stone base, mesh on a steel frame with a centre post and a padlocked door
  B.span(R.graniteDark, -rw, rw, 0, 0.9, rz0 - 0.25, rz0);
  const sq = new THREE.PlaneGeometry(rw * 2, rh - 1.6).translate(0, 0.9 + (rh - 1.6) / 2, rz0 - 0.12);
  const suv = sq.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) * rw * 2, suv.getY(i) * (rh - 1.6));
  B.add(R.grill, sq, null, true);
  for (const x of [-rw + 0.04, -0.03, rw - 0.04]) B.box(R.steel, 0.08, rh - 1.6, 0.08, x, 0.9, rz0 - 0.12);
  for (const y of [0.9, 4.2, rh - 0.7]) B.span(R.steel, -rw, rw, y - 0.04, y + 0.04, rz0 - 0.16, rz0 - 0.08);
  P.solid(-rw, 0, rz0 - 0.3, rw, rh, rz0);
  const nb = nameBoard();
  B.add(nb.mat, nb.geo.translate(0, rh - 0.66, rz0 - 0.2), null, true);
  void R.grill;

  // ---------- dhwajastambham (gold-clad) and balipitham ----------
  dhwaja(B, R, 0, DHWAJA.z, 16.5);
  P.solid(-1.3, 0, DHWAJA.z - 1.3, 1.3, 18, DHWAJA.z + 1.3);
  B.lathe(G, [[0, 0], [1.0, 0], [1.0, 0.25], [0.82, 0.3], [0.78, 0.55], [0.95, 0.75], [1.05, 0.95], [0.6, 1.05], [0.0, 1.08]], 0, 0, BALI.z, 24);
  B.lathe(R.goldOut, [[0, 1.05], [0.55, 1.05], [0.42, 1.22], [0.18, 1.35], [0.06, 1.55], [0, 1.6]], 0, 0, BALI.z, 20);
  P.solid(-1.05, 0, BALI.z - 1.05, 1.05, 1.5, BALI.z + 1.05);
  // brass lamps on stands beside the Nandi
  for (const sx of [-1, 1]) {
    B.lathe(R.brass, [[0.22, 0], [0.25, 0.04], [0.06, 0.1], [0.05, 1.3], [0.12, 1.36], [0.2, 1.4], [0.21, 1.44], [0, 1.44]], sx * 3.4, 0, nzc - 4.0, 12);
    flames.points.push(new THREE.Vector3(sx * 3.4 + 0.16, 1.5, nzc - 4.0), new THREE.Vector3(sx * 3.4 - 0.16, 1.5, nzc - 4.0));
  }

  // ---------- the second-corridor halls (north side and west) ----------
  const hall = (x0: number, x1: number, z0: number, z1: number, h: number, skip: (x: number, z: number) => boolean) => {
    for (let x = x0 + 2.2; x < x1 - 1; x += 4.6) for (let z = z0 + 2.2; z < z1 - 1; z += 4.6) {
      if (skip(x, z)) continue;
      pillars.at(x, 0, z);
      P.solid(x - 0.48, 0, z - 0.48, x + 0.48, h, z + 0.48);
    }
    B.span(R.roofRed, x0, x1, h, h + 0.6, z0, z1);
    const cp = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2);
    const uv = cp.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 5.6, uv.getY(i) * (z1 - z0) / 12);
    B.add(R.sideCeiling, cp.translate((x0 + x1) / 2, h - 0.02, (z0 + z1) / 2), null, true);
  };
  hall(nx, PRAK2.x1, PRAK1.z0 - 2, PRAK2.z1 - 1, 6.4, () => false);
  hall(PRAK1.x0, nx, PRAK2.z0 + 1.5, PRAK1.z0, 6.4, (x) => Math.abs(x) < ARM.wall);
  hall(PRAK1.x1, nx, PRAK1.z0, PRAK1.z1 + 1, 6.4, () => true);
  // the Sethu Madhava shrine at the end of the Chokkattan corridor (facing west)
  B.span(G, -3.2, 3.2, 0, 0.6, PRAK2.z0 + 4, PRAK2.z0 + 10.5);
  B.span(G, -2.8, 2.8, 0.6, 5.2, PRAK2.z0 + 5.5, PRAK2.z0 + 10.5);
  B.span(R.shade, -0.7, 0.7, 0.6, 2.8, PRAK2.z0 + 5.45, PRAK2.z0 + 5.6);
  B.span(G, -3.2, 3.2, 5.2, 5.6, PRAK2.z0 + 5.2, PRAK2.z0 + 10.8);
  P.solid(-3.2, 0, PRAK2.z0 + 4, 3.2, 5.6, PRAK2.z0 + 10.8);
  void AMMAN; void RING;

  B.flush(g, true, 'inner');
  pillars.flush(g, false);
  tallPillars.flush(g, false);
  return { group: g, bull };
}

/** Width factor of the Rameswaram Nandi along its body (unscaled z; the head is at −z). */
function nandiWiden(z: number) {
  // the stucco bull's head and muzzle are broad (≈1.4× a natural bull's)
  return 1.12 * (1 + 0.42 * Math.max(0, Math.min(1, (-z - 0.88) / 0.18)));
}

/** Gold ornaments of the Nandi: bell necklace, forehead plate, horn caps, a red saddle cloth with gold border. */
function nandiOrnaments(B: Batch, R: RM, sc: number, y0: number, z0: number, lift = 0) {
  // positions in the unscaled bull frame; the head and neck are raised by `lift`
  const P = (x: number, y: number, z: number) => {
    const k = Math.max(0, Math.min(1, (-z - 0.6) / 0.35));
    return new THREE.Vector3(x * sc * nandiWiden(z), y0 + (y + lift * k) * sc, z0 + z * sc);
  };
  // one big bell hangs at the chest; the rest of the ornament is painted on the stucco
  const c = P(0, 0.4, -0.92);
  B.lathe(R.goldOut, [[0, 0], [0.06 * sc, 0.01], [0.075 * sc, 0.06 * sc], [0.05 * sc, 0.12 * sc], [0.02 * sc, 0.14 * sc], [0, 0.15 * sc]].map(([r, yy]) => [r, -yy] as [number, number]), c.x, c.y, c.z, 14);
  // saddle cloth over the back: red with a gold border
  const s0 = P(0, 0.93, 0.05);
  const cloth = new THREE.CylinderGeometry(0.43 * sc, 0.43 * sc, 0.55 * sc, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84).rotateX(Math.PI / 2).rotateY(Math.PI / 2);
  B.add(R.redPaint, cloth.rotateY(Math.PI / 2).translate(s0.x, s0.y - 0.35 * sc, s0.z));
}

/** Gold-clad flagstaff on a moulded granite base, with the three-armed crown and bells. */
function dhwaja(B: Batch, R: RM, x: number, z: number, h: number) {
  const G = R.granite, A = R.goldOut;
  B.span(G, x - 1.3, x + 1.3, 0, 0.3, z - 1.3, z + 1.3);
  B.span(G, x - 1.05, x + 1.05, 0.3, 1.1, z - 1.05, z + 1.05);
  B.span(G, x - 1.2, x + 1.2, 1.1, 1.35, z - 1.2, z + 1.2);
  // the lotus base and the brass-clad lower box
  B.lathe(A, [[0.85, 0], [0.9, 0.12], [0.6, 0.45], [0.4, 0.6], [0.36, 0.7]], x, 1.35, z, 16);
  B.span(A, x - 0.42, x + 0.42, 2.0, 3.4, z - 0.42, z + 0.42);
  // the staff with rings
  B.add(A, new THREE.CylinderGeometry(0.2, 0.3, h - 4, 16).translate(x, 3.4 + (h - 4) / 2, z));
  for (let y = 4; y < h - 0.8; y += 0.9) B.add(A, new THREE.TorusGeometry(0.27 - (y / h) * 0.08, 0.035, 6, 16).rotateX(Math.PI / 2).translate(x, y, z));
  // crown: three stacked square trays with bells, a projecting arm, the finial
  let y = h - 0.6;
  for (let k = 0; k < 3; k++) {
    const w = 0.9 - k * 0.2;
    B.span(A, x - w / 2, x + w / 2, y, y + 0.1, z - w / 2, z + w / 2);
    for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(A, new THREE.SphereGeometry(0.05, 6, 4).translate(x + bx * w / 2, y - 0.06, z + bz * w / 2));
    y += 0.42;
  }
  B.span(A, x - 0.06, x + 0.06, h - 0.2, h - 0.08, z - 1.0, z + 0.2);
  B.lathe(A, [[0.1, 0], [0.14, 0.12], [0.06, 0.3], [0, 0.42]], x, y, z, 10);
}

/** The shrine's blue enamel name board (Tamil, English, Hindi), as at the temple. */
function nameBoard() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 300;
  const x = c.getContext('2d')!;
  x.fillStyle = '#163f8c';
  x.fillRect(0, 0, 1024, 300);
  x.strokeStyle = '#ffffff';
  x.lineWidth = 8;
  x.strokeRect(10, 10, 1004, 280);
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.font = 'bold 74px "Noto Sans Tamil", "Tamil Sangam MN", sans-serif';
  x.fillText('அருள்மிகு நந்தீஸ்வரர் சன்னதி', 512, 96, 980);
  x.font = 'bold 64px Arial, sans-serif';
  x.fillText('ARULMIGU NANDHISWARAR SHRINE', 512, 182, 980);
  x.font = 'bold 62px "Noto Sans Devanagari", sans-serif';
  x.fillText('श्री नन्दीश्वर मंदिर', 512, 262, 980);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(2.6, 0.76).rotateY(Math.PI);
  return { geo, mat: new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }) };
}

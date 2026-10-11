import * as THREE from 'three';
import type { Merger } from './merge';
import { prng } from './merge';
import type { SM } from './mats';
import { terrainH, compress } from './terrain';
import { TERRACE, WALL } from './layout';
import { buildCrowd, type CrowdSpot } from '../../engine/crowd';

/**
 * Life round the temple:
 *  - coconut and areca palms along the streets, the forecourt and in the court corners (one instanced
 *    draw for trunks, one for fronds);
 *  - ~200 pilgrims from the shared crowd kit in South Indian dress (silk saris, veshtis, tonsured heads; one batched draw), in
 *    the east forecourt and street, the queue lanes and the courts — never on the walking line;
 *  - the west-gate queue complex (2025 photo): steel railing lanes zig-zagging under blue canopies.
 */
function palmGeos() {
  // trunk: a slender, slightly curved, tapering column, 1 m tall unit (scaled per instance)
  const trunk = new THREE.CylinderGeometry(0.11, 0.16, 1, 6, 8, true).translate(0, 0.5, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.08 * y * y); }
  trunk.computeVertexNormals();
  // crown: drooping fronds radiating from the top, plus a cluster of nuts
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + (k % 2) * 0.2;
    const f = new THREE.PlaneGeometry(0.28, 1, 1, 6);
    const fp = f.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const t = fp.getY(i) + 0.5; // 0 at the base → 1 at the tip
      const w = Math.sin(t * Math.PI) * (fp.getX(i) > 0 ? 1 : -1) * 0.14;
      fp.setXYZ(i, w, 0.12 * t - 0.42 * t * t, t * 0.95);
    }
    f.rotateY(a).translate(0.08, 1, 0);
    parts.push(f.toNonIndexed());
  }
  const pos: number[] = [];
  for (const g of parts) pos.push(...(g.attributes.position.array as Float32Array));
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  crown.computeVertexNormals();
  return { trunk, crown };
}

export function buildLife(B: Merger, K: SM, out: THREE.Object3D, root: THREE.Object3D, avoid: (x: number, z: number) => boolean = () => false, treeSpots: [number, number, number, number, number][] = []) {
  const rnd = prng(2027);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();

  // ---- palms
  const spots: [number, number][] = [];
  for (let x = 96; x < 214; x += 9 + rnd() * 6) for (const s of [-1, 1]) if (rnd() < 0.55) spots.push([x, s * (26 + rnd() * 10)]);
  for (const [x, z] of [[78, -40], [86, 40], [100, -44], [-60, -100], [-82, -96], [-56, 58], [60, 30], [-86, -40], [30, -100]]) spots.push([x, z]);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 150 + rnd() * 450;
    spots.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const { trunk, crown } = palmGeos();
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95 }), spots.length);
  const crowns = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }), spots.length);
  spots.forEach(([x, z], i) => {
    const inWalls = x > WALL.x0 && x < WALL.x1 && z > WALL.z0 && z < WALL.z1;
    const h = 9 + rnd() * 7, y = inWalls ? 0 : terrainH(x, z) - 0.2;
    const [cx, cy, cz] = compress(x, y, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m);
    const lean = new THREE.Vector3(0.08 * h, h, 0).applyQuaternion(q);
    m.compose(new THREE.Vector3(cx + lean.x, cy + h - 0.9, cz + lean.z), q, new THREE.Vector3(3.2, 2.6, 3.2));
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, c.setHSL(0.25 + rnd() * 0.05, 0.45, 0.22 + rnd() * 0.08));
  });
  for (const im of [trunks, crowns]) { im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; out.add(im); }

  // ---- broadleaf town trees (neem, rain trees, banyan): collected here, drawn as leaf-card trees (trees.ts);
  //      dense round the town and the outer roads, a pair flanking every gopuram outside the walls
  {
    const spots2: [number, number][] = [];
    for (const [gx, gz, nx, nz] of [[85, 0, 1, 0], [6, -132, 0, -1], [-34, 105, 0, 1], [-112, -16, -1, 0]]) {
      for (const s of [-1, 1]) spots2.push([gx + nx * 14 + nz * s * 26, gz + nz * 14 + nx * s * 26]);
    }
    for (let tries = 0; tries < 9000 && spots2.length < 520; tries++) {
      const a = rnd() * 6.28, r = 120 + Math.pow(rnd(), 0.8) * 600;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (avoid(x, z) || (x > 60 && x < 262 && Math.abs(z) < 52)) continue;
      spots2.push([x, z]);
    }
    spots2.forEach(([x, z], i) => {
      const [cx, cy, cz] = compress(x, terrainH(x, z) - 0.2, z);
      treeSpots.push([cx, cy, cz, i < 8 ? 15 + rnd() * 3 : 8 + rnd() * 7, 1.0 + rnd() * 0.3]);
    });
  }

  // ---- pilgrims: the shared crowd kit (engine/crowd.ts) in its 'south' dress, one batched draw plus contact shadows
  const N = 210;
  const people: CrowdSpot[] = [];
  let count = 0;
  const place = (x: number, z: number, y = 0, seated = false, face?: number) => {
    if (count >= N + 40) return;
    const woman = rnd() < 0.55;
    rnd(); // (was the figure's scale; kept so every later placement stays where it was)
    const ry = face !== undefined ? face + (rnd() - 0.5) * 0.8 : rnd() * 6.28;
    rnd(); // (was the cloth colour)
    people.push({ x, y, z, ry, sit: seated, kind: woman ? 'saree' : 'kurta' });
    count++;
  };
  // kept ≥4 m from the spawn and the walking line (street centre, forecourt axis, court axis)
  for (let i = 0; i < 70; i++) place(110 + rnd() * 105, (rnd() < 0.5 ? -1 : 1) * (4.5 + rnd() * 4.8)); // the temple street
  for (let i = 0; i < 30; i++) place(76 + rnd() * 30, (rnd() < 0.5 ? -1 : 1) * (7.5 + rnd() * 28)); // the forecourt
  for (let i = 0; i < 22; i++) place(48 + rnd() * 13, 14.7 + (rnd() - 0.5) * 1.6); // the queue lane by the east gate
  for (let i = 0; i < 40 && count < 170; i++) {
    const x = -40 + rnd() * 30, z = (rnd() < 0.5 ? -1 : 1) * (30 + rnd() * 26);
    if (Math.hypot(x + 40, z - 44) < 6 || (x > -35 && x < -3 && z > 37 && z < 73)) continue;
    place(x, z); // the outer court
  }
  for (let i = 0; i < 18; i++) place(-88 + rnd() * 26, (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 15), TERRACE.h); // the Bhramaramba terrace
  for (let i = 0; i < 26; i++) place(-122 + rnd() * 18, -40 + rnd() * 9, TERRACE.h); // the west-gate queue
  for (let i = 0; i < 20; i++) place(-8 + rnd() * 50, (rnd() < 0.5 ? -1 : 1) * (11.5 + rnd() * 5.5)); // the inner court
  // pilgrims resting in the cloister shade: sitting along the back walls, a few standing, facing the court
  for (let i = 0; i < 34; i++) {
    const side = rnd();
    if (side < 0.42) { const x = -15 + rnd() * 58; if (x > 9 && x < 15) continue; place(x, -20.6 + rnd() * 0.6, 0.45, rnd() < 0.75, 0); }
    else if (side < 0.84) { const x = -15 + rnd() * 58; if (x > 9 && x < 15) continue; place(x, 20.0 + rnd() * 0.6, 0.45, rnd() < 0.75, Math.PI); }
    else { const z = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 11); place(-20.6 + rnd() * 0.6, z, 0.45, rnd() < 0.75, Math.PI / 2); }
  }
  buildCrowd(root, people, { outfit: 'south', seed: 2027, clearRadius: 0, kanwariyaShare: 0 });

  // ---- the west-gate queue complex: railed lanes under blue canopies
  const T = TERRACE.h;
  const x0 = -124, x1 = -101, z0 = -42, z1 = -29;
  B.span(K.paving, x0, T - 0.3, z0, x1, T, z1);
  for (let k = 0; k <= 5; k++) {
    const z = z0 + 0.6 + k * ((z1 - z0 - 1.2) / 5);
    for (const y of [T + 0.95, T + 0.5]) B.span(K.steel, x0 + (k % 2 ? 1.5 : 0.3), y, z - 0.03, x1 - (k % 2 ? 0.3 : 1.5), y + 0.05, z + 0.03);
    for (let x = x0 + 0.3; x <= x1 - 0.3; x += 2.2) B.span(K.steel, x - 0.03, T, z - 0.03, x + 0.03, T + 1.0, z + 0.03);
  }
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) for (const z of [z0, z1]) B.span(K.steel, x - 0.1, T, z - 0.1, x + 0.1, T + 3.8, z + 0.1);
  B.span(K.blueRoof, x0 - 0.5, T + 3.8, z0 - 0.5, x1 + 0.5, T + 3.9, z1 + 0.5);
  B.span(K.blueRoof, x0 - 0.5, T + 3.3, z1 + 0.5, x1 + 0.5, T + 3.9, z1 + 0.56); // a valance
}

import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { buildCrowd, CrowdSpots } from './crowd';
import { SEA_WALL, BAAN, DWAR, STATUE } from './precinct';
import { JAG, JAGATI } from './temple';

/**
 * Pilgrims at Somnath, as in every photograph: a single-file queue along the outer rail of each covered lane,
 * families strolling and sitting on the jagati and in the court, a line along the sea railing and knots round
 * the Baan Stambh, shoppers in the market outside the Digvijay Dwar, and a few groups sitting on the lawns.
 * Sarees and kurtas (no kanwariyas here), no faces, one batched draw, no colliders; nobody within 4 m of the
 * spawn or the walk to the sanctum.
 */
export function pilgrims(parent: THREE.Object3D, P: Physics) {
  const C = new CrowdSpots(53);
  const solidAt = (x: number, z: number, y = 0) => P.solids.some((b) => x > b.min.x - 0.35 && x < b.max.x + 0.35 && z > b.min.z - 0.35 && z < b.max.z + 0.35 && y + 0.3 > b.min.y && y < b.max.y);

  // the queue: single file along the outer rail of both lanes, from the gate to the court, facing the temple
  for (const x of [-4.05, 4.05]) {
    for (let z = 98.5; z > 66; z -= 0.62 + C.rnd() * 0.12) {
      if (C.rnd() < 0.12) continue; // gaps where the line has moved on
      C.add(x + (C.rnd() - 0.5) * 0.08, 0, z, Math.PI);
    }
  }
  // the jagati: walking round the temple and resting against the parapet, on both flanks and at the east front
  const onJag = (x: number, z: number) => solidAt(x, z, JAGATI);
  C.scatter(12.6, 16.2, -11, 17.5, JAGATI, 18, Math.PI, 0.2, onJag);
  C.scatter(-16.2, -12.6, -11, 17.5, JAGATI, 18, 0, 0.2, onJag);
  C.scatter(12.6, 16.2, 27.5, 54, JAGATI, 16, Math.PI, 0.15, onJag);
  C.scatter(-16.2, -12.6, 27.5, 54, JAGATI, 16, 0, 0.15, onJag);
  C.scatter(5.2, 16, 54.2, 56.2, JAGATI, 10, 0, 0.3, onJag);
  C.scatter(-16, -5.2, 54.2, 56.2, JAGATI, 10, 0, 0.3, onJag);
  // the court between the jagati and the railing
  C.scatter(18.3, 22.4, -20, 62, 0, 26, -Math.PI / 2, 0.1, (x, z) => solidAt(x, z));
  C.scatter(-22.4, -18.3, -20, 62, 0, 26, Math.PI / 2, 0.1, (x, z) => solidAt(x, z));

  // the sea promenade: a line along the railing looking out to sea, and strollers a few metres in
  for (let i = 1; i < SEA_WALL.length - 2; i++) {
    const [ax, az] = SEA_WALL[i], [bx, bz] = SEA_WALL[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const nx = dz / len, nz = -dx / len; // inland
    const toSea = Math.atan2(-nx, -nz);
    for (let s = 2; s < len - 2; s += 1.1 + C.rnd() * 2.4) {
      const t = s / len;
      const x0 = ax + dx * t, z0 = az + dz * t;
      if (z0 < -60 || z0 > 175) continue;
      if (Math.hypot(x0 - BAAN.x, z0 - BAAN.z) < 6) continue;
      const busy = C.rnd();
      if (busy < 0.55) {
        const d = 1.3 + C.rnd() * 0.3;
        if (!solidAt(x0 + nx * d, z0 + nz * d)) C.add(x0 + nx * d, 0, z0 + nz * d, toSea + (C.rnd() - 0.5) * 0.6);
      }
      if (busy > 0.45) {
        const d = 3.5 + C.rnd() * 6;
        const along = Math.atan2(dx, dz) + (C.rnd() < 0.5 ? 0 : Math.PI);
        if (!solidAt(x0 + nx * d, z0 + nz * d)) C.add(x0 + nx * d, 0, z0 + nz * d, along);
      }
    }
  }
  // knots round the Baan Stambh, reading the plaque and looking along the arrow
  for (let k = 0; k < 14; k++) {
    const a = -1.25 + (k / 13) * 2.5, r = 2.6 + C.rnd() * 2.6;
    const x = BAAN.x + Math.cos(a) * r, z = BAAN.z + Math.sin(a) * r * 1.3;
    if (!solidAt(x, z)) C.add(x, 0, z, Math.atan2(BAAN.x - x, BAAN.z - z));
  }

  // the market outside the gate: shoppers along both shopfronts and round the statue plaza
  C.scatter(DWAR.x + 12.5, DWAR.x + 18, 122, 182, 0, 40, Math.PI / 2, 0, (x, z) => solidAt(x, z));
  C.scatter(DWAR.x - 18, DWAR.x - 12.5, 122, 182, 0, 40, -Math.PI / 2, 0, (x, z) => solidAt(x, z));
  C.scatter(STATUE.x - 9, STATUE.x + 9, STATUE.z - 8, STATUE.z + 8, 0, 18, Math.PI, 0, (x, z) => solidAt(x, z) || Math.hypot(x - STATUE.x, z - STATUE.z) < 4);

  // families sitting on the lawns
  for (const [x0, x1, z0, z1] of [[29, 48, -36, 8], [29, 48, 37, 66], [-50, -30, 19, 46], [-56, -31, 64, 86]] as const) {
    for (let g = 0; g < 4; g++) {
      const cx = x0 + C.rnd() * (x1 - x0), cz = z0 + C.rnd() * (z1 - z0);
      const n = 2 + Math.floor(C.rnd() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        C.add(cx + Math.cos(a) * 0.7, 0.05, cz + Math.sin(a) * 0.7, Math.atan2(-Math.cos(a), -Math.sin(a)), C.rnd() < 0.8);
      }
    }
  }

  return buildCrowd(parent, C.list, {
    seed: 211,
    kanwariyaShare: 0,
    clearRadius: 4,
    clearPaths: [
      // spawn on the approach road, through the Digvijay Dwar, the queue lane's open centre, up the jagati and in
      [[2, 136], [2, 112], [1, 102], [0, 102], [0, 85], [0, 60], [0, JAG.z1], [0, 30], [0, 3.6]],
      [[-26, 94], [-12, 90]],
    ],
  });
}

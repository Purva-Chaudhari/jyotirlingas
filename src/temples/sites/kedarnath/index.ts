import type { SiteDef } from '../types';
import { makeMats, sanctumEnv } from './mats';
import { buildTemple, F, GZ } from './temple';
import { buildPrecinct } from './precinct';
import { buildTerrain, buildRivers } from './terrain';
import { waterNormals } from '../../engine/materials';
import { buildCrowd, CrowdSpots } from './crowd';
import * as THREE from 'three';
import { kedarNav } from './nav';

/**
 * Shri Kedarnath Jyotirlinga, Rudraprayag, Uttarakhand — 30.7352 N, 79.0669 E, ~3,583 m.
 * The temple faces south down the Mandakini valley; the snow wall of the Kedarnath massif
 * stands behind it to the north. +z = south (the approach), +x = east.
 */
const site: SiteDef = {
  id: 'kedarnath',
  name: { en: 'Kedarnath', hi: 'केदारनाथ' },
  lon: 79.0669,
  lat: 30.7352,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['गढ़वाल हिमालय', 'Garhwal Himalaya', 'Uttarakhand'],
    3: ['केदारनाथ', 'Kedarnath', 'beside the Mandakini · 3,583 m'],
  },
  zones: {
    courtyard: ['केदारनाथ धाम', 'Kedarnath Dham', 'the temple square · 3,583 m'],
    path: ['केदारपुरी', 'Kedarpuri', 'the approach from the Mandakini'],
    mandapa: ['सभा मंडप', 'Sabha Mandapa', 'the assembly hall'],
    garbhagriha: ['श्री केदारनाथ', 'Jyotirlinga', 'Sadashiva · the self-born rock'],
    samadhi: ['आदि शंकराचार्य समाधि', 'Adi Shankaracharya Samadhi', 'the statue court, 2021'],
    bhimshila: ['भीम शिला', 'Bhim Shila', 'the boulder that shielded the shrine, 2013'],
  },
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
  // the sun stands south-east of the shrine in the late morning: it lights the facade
  sunAzimuth: Math.atan2(0.45, 0.9),
  // high-altitude air: a thin, cold haze instead of the plains' warm dust; crisp near-white sun
  fog: { color: 0xc4d0dc, near: 600, far: 9000 },
  sunColor: 0xfff3e4,
  sunIntensity: 3.4,
  build({ root, M, P, flames, pending, renderer, interiorEnv }) {
    const { mats: K, pending: loads } = makeMats();
    pending.push(...loads);
    const env = sanctumEnv(renderer, K, interiorEnv);

    const t = buildTemple(root, M, K, P, env, pending);
    flames.points.push(...t.flames.points);
    flames.lights.push(...t.flames.lights);
    buildPrecinct(root, M, K, P, flames);
    const terrain = buildTerrain(root, pending);
    const precinct = root.getObjectByName('kedarnath-precinct');
    const rivers = buildRivers(root, waterNormals());

    // ---- pilgrims: the darshan queue up the east side of the square, people standing and
    // sitting about the plaza, a few round the dhuni at Bhim Shila. Kept ≥4 m off the spawn and the
    // walk to the door.
    const C = new CrowdSpots(311);
    // the queue lane (x 9 → 10.4) up the east side, two abreast, then west along z ≈ 13.1 to the steps
    C.queue(new THREE.Vector3(9.7, 0, 43), new THREE.Vector3(9.7, 0, 14.2), 0.62, 2);
    C.queue(new THREE.Vector3(9.4, 0, 13.1), new THREE.Vector3(4.8, 0, 13.1), 0.6, 2);
    const blocked = (x: number, z: number) =>
      (Math.abs(x) < 8.6 && z > -19 && z < 11.6) || // the temple, its steps and the facade railing
      (Math.abs(x) < 1.6 && z > 11 && z < 15.5) || // Nandi
      (x > 8.2 && x < 11.2 && z > 11.5 && z < 45) || (x > 3.8 && x < 11.2 && z > 11.6 && z < 14.4) || // queue lane
      (x > -29 && x < -19 && z > 13.5 && z < 20.5) || // shamiana
      Math.abs(x) > 27 || // stalls and tarps along the edges
      (z > 45) || (x > -5 && x < 7 && z > -31 && z < -20.5); // the steps' head; Bhim Shila and the dhuni
    const toTemple = (x: number, z: number) => Math.atan2(-x, 2 - z);
    const scatter = (x0: number, x1: number, z0: number, z1: number, n: number, sit: number) => {
      for (let tries = 0; n > 0 && tries < n * 60; tries++) {
        const x = x0 + C.rnd() * (x1 - x0), z = z0 + C.rnd() * (z1 - z0);
        if (blocked(x, z) || Math.hypot(x, z - 36) < 10 || C.list.some((p) => Math.hypot(p.x - x, p.z - z) < 0.75)) continue;
        // small groups: a second person close by, facing the same way
        const ry = toTemple(x, z) + (C.rnd() - 0.5) * 1.2;
        C.add(x, 0, z, ry, C.rnd() < sit);
        n--;
      }
    };
    scatter(-26, -4, 12, 44, 46, 0.15);
    scatter(12, 26, 12, 44, 26, 0.15);
    scatter(-26, -9, -18, 11, 30, 0.2);
    scatter(9, 26, -18, 11, 24, 0.2);
    scatter(-14, 14, -34, -19, 18, 0.35);
    // resting under the shamiana
    for (let i = 0; i < 10; i++) C.add(-27.5 + (i % 5) * 1.8, 0.02, 15 + Math.floor(i / 5) * 2.2 + C.rnd() * 0.4, Math.PI / 2 + (C.rnd() - 0.5), true);
    const crowd = buildCrowd(root.getObjectByName('kedarnath-precinct') ?? root, C.list, {
      clearPaths: [[[0, 62], [0, 36], [2.5, 20], [2.5, 10], [0, 8]], [[0, 36]]],
      clearRadius: 4, seed: 919, lodDistance: 22, kanwariyaShare: 0.12,
    });

    return {
      ...kedarNav(), // Places (engine/travel.ts): the walking graph
      // on the approach street below the square's steps, where the trek from Gaurikund arrives: the pilgrim climbs
      // into the square with the temple ahead (pathY(62) = -1.818)
      spawn: { feet: [0, -1.818, 62], look: [0, 9, -6] },
      update(time) {
        t.flag.update(time);
        rivers.update(time);
        crowd.update(time);
      },
      onZoneChange(zone) {
        // inside the garbhagriha the valley and the town cannot be seen: skip drawing them
        const out = zone !== 'garbhagriha';
        terrain.visible = out;
        rivers.mesh.visible = out;
        if (precinct) precinct.visible = out;
      },
      zoneAt({ x, y, z }) {
        if (y > F - 0.3 && Math.abs(x) < 3.1 && z < GZ + 3.0 && z > GZ - 3.1) return 'garbhagriha';
        if (y > F - 0.3 && Math.abs(x) < 5.2 && z < 7.4 && z > GZ + 3.0) return 'mandapa';
        if (Math.hypot(x - 16, z + 60) < 13) return 'samadhi';
        if (z < -20 && Math.abs(x) < 12) return 'bhimshila';
        if (z > 52) return 'path';
        return null;
      },
    };
  },
};

export default site;

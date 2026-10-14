import type { SiteDef } from '../types';
import { makeMats, sanctumEnv } from './mats';
import { buildTemple, F, GZ } from './temple';
import { buildPrecinct } from './precinct';
import { buildTerrain, buildRivers, pathY } from './terrain';
import { waterNormals } from '../../engine/materials';
import { buildCrowd, CrowdSpots } from './crowd';
import * as THREE from 'three';
import { kedarNav } from './nav';
import { QUEUE_WALK, VIP_DARSHAN } from './mode';
import { cameraProbe } from '../mahakaleshwar/optimize';

/** distance from (px, pz) to the segment a-b */
function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

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
  // clear summer light, as in the photographs: greener slopes, bluer sky, brighter stone (AgX alone read grey)
  grade: { saturation: 1.3, exposure: 1.12 },
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

    // ---- pilgrims: the darshan queue packed into the fenced pens on the west of the square and on to the door; the
    // square full of people standing, sitting and milling, thickest before the door; a few round the dhuni at Bhim
    // Shila. Kept clear of the walk from the spawn to the door.
    const C = new CrowdSpots(311);
    // two lines up the west edge from the balustrade gap, the three switchbacks along the front, in at the chunri
    // railing's west gap and round inside it to the foot of the steps. Single file on one side of each lane: the
    // general darshan walk (mode.ts) goes up the other side, beside them. In queue order, entrance → door.
    const Q = (ax: number, az: number, bx: number, bz: number) => C.queue(new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, bz), 0.6, 1);
    Q(-32.5, 49.6, -32.5, 17.9);
    Q(-30.5, 49.6, -30.5, 17.9);
    Q(-28.0, 17.0, -9.8, 17.0);
    Q(-9.8, 15.35, -33.2, 15.35);
    Q(-33.2, 13.72, -8.6, 13.72);
    Q(-7.6, 13.75, -6.4, 13.75);
    Q(-5.95, 12.2, -5.95, 10.5);
    Q(-4.4, 10.25, -2.2, 10.25);
    const queueCount = C.list.length;
    const blocked = (x: number, z: number) =>
      (Math.abs(x) < 8.6 && z > -19 && z < 11.6) || // the temple and its steps
      (Math.abs(x) < 7.3 && z > -19 && z < 16.1) || // inside the chunri railing (Nandi; the queue's last turn)
      (x > -34.5 && x < -8 && z > 12.2 && z < 17.8) || (x < -28 && z > 12 && z < 51) || // the queue pens
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
    scatter(12, 30, 12, 44, 34, 0.15);
    // the middle of the square, and the press of people before the door
    scatter(-4, 12, 20, 44, 34, 0.1);
    scatter(-14, 4, 16.2, 21, 34, 0.05);
    scatter(7.4, 14, 8, 21, 18, 0.05);
    scatter(-14, -7.4, 8, 16, 14, 0.05);
    // the approach street and the last of the trek: pilgrims climbing to the square and coming back down, groups
    // stopped at the stalls; on the slope, so each stands at the street's own height
    {
      let placed = 0;
      for (let tries = 0; placed < 110 && tries < 4000; tries++) {
        const z = 55 + C.rnd() * 190, hw = z < 200 ? 5.6 : 2.0;
        const x = (C.rnd() * 2 - 1) * hw;
        if (Math.abs(x) < 0.9 || Math.hypot(x, z - 62) < 3.5 || C.list.some((p) => Math.abs(p.x - x) < 0.7 && Math.abs(p.z - z) < 0.7)) continue;
        const shop = z < 200 && Math.abs(x) > 4.6 && C.rnd() < 0.6;
        const ry = shop ? (x > 0 ? Math.PI / 2 : -Math.PI / 2) : (C.rnd() < 0.62 ? Math.PI : 0) + (C.rnd() - 0.5) * 0.5;
        C.add(x, pathY(z), z, ry, false);
        placed++;
      }
    }
    scatter(-26, -9, -18, 11, 30, 0.2);
    scatter(9, 26, -18, 11, 24, 0.2);
    scatter(-14, 14, -34, -19, 18, 0.35);
    // the walks (the figures aren't solid: this only keeps them off your path): ≥1.8 m clear, except the waiting
    // line, which stands right beside the queue walk and the paths that cross it
    const walks: [number, number][][] = [[[0, 62], [0, 36], [1.5, 30], [2.2, 16.8], [8.4, 17], [8.4, 13.4], [4.6, 13.4], [2.6, 11.6], [0, 10.2], [0, 8]],
      [[1.5, 30], [-7.6, 19.5], [-7.6, 10.4], [-10.5, 4], [-10.5, -20]], [[1.5, 30], [-20, 24]], [[8.4, 17], [12.2, 11.4], [10.5, -20]], QUEUE_WALK];
    const near = (x: number, z: number, r: number) => walks.some((w) => w.some((b, i) => i > 0 && segDist(x, z, w[i - 1], b) < r));
    const spots = C.list.filter((c, i) => !near(c.x, c.z, i < queueCount ? 0.5 : 1.8));
    const queueSpots = new Set(C.list.slice(0, queueCount));
    const crowd = buildCrowd(root.getObjectByName('kedarnath-precinct') ?? root, spots, { seed: 919, lodDistance: 22, kanwariyaShare: 0.12 });
    // the line creeps forward: each pilgrim steps ~0.3 m ahead and eases back over a 7 s cycle, the step running
    // back down the line like a real queue's ripple (only while you are by the pens; every third frame)
    const movers: { id: number; base: THREE.Matrix4; fx: number; fz: number; ph: number }[] = [];
    spots.forEach((c, id) => {
      if (!queueSpots.has(c)) return;
      const base = new THREE.Matrix4();
      crowd.mesh.getMatrixAt(id, base);
      movers.push({ id, base, fx: Math.sin(c.ry), fz: Math.cos(c.ry), ph: -movers.length * 0.6 / 3.5 });
    });
    const tmpM = new THREE.Matrix4();
    let animFrame = 0, viewCam: THREE.Camera | null = null;
    cameraProbe(root, (_p, cam) => { viewCam = cam; });
    const creep = (time: number) => {
      const cam = viewCam?.position;
      if (!cam || cam.x > 2 || cam.z < 6 || cam.z > 56 || ++animFrame % 3) return;
      for (const m of movers) {
        const f = (((time / 7 + m.ph) % 1) + 1) % 1;
        const k = f < 0.18 ? THREE.MathUtils.smoothstep(f, 0, 0.18) : 1 - THREE.MathUtils.smoothstep(f, 0.3, 1);
        tmpM.copy(m.base);
        tmpM.elements[12] += m.fx * 0.3 * k;
        tmpM.elements[14] += m.fz * 0.3 * k;
        crowd.mesh.setMatrixAt(m.id, tmpM);
      }
    };

    return {
      ...kedarNav(), // Places (engine/travel.ts): the walking graph
      // on the approach street below the square's steps, where the trek from Gaurikund arrives: the pilgrim climbs
      // into the square with the temple ahead (pathY(62) = -1.818)
      spawn: { feet: [0, -1.818, 62], look: [0, 9, -6] },
      update(time) {
        t.flag.update(time);
        rivers.update(time);
        crowd.update(time);
        creep(time);
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

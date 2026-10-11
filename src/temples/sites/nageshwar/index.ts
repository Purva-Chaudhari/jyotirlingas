import * as THREE from 'three';
import type { SiteDef } from '../types';
import { signSprite } from '../../engine/kit';
import { nageshwarMats } from './mats';
import { buildTemple, GARBHA, HALL, PL, PORCH, SF, STAIR } from './temple';
import { buildSanctum } from './sanctum';
import { buildStatue, STATUE } from './statue';
import { buildPrecinct, COMPOUND, GATE, TREES } from './precinct';
import { mergeStatic, lightZones } from './optimize';
import { buildCrowd, CrowdSpots } from './crowd';
import { nageshwarNav } from './nav';

/**
 * Shri Nageshwar Jyotirlinga, Daarukavana, on the road from Dwarka to Bet Dwarka (Devbhumi Dwarka
 * district, Gujarat). The present temple was built in 1996 (repainted crimson 2024–26); the colossal seated
 * Shiva (~25 m) stands in its own forecourt north of it, facing west like the temple; the sanctum lies
 * below the hall, reached by steps. The compound is drawn axis-aligned (it is turned ~15–20° clockwise
 * from north in reality) and stands ~1 m above the parking and the fields.
 * Axes: +x = east, −z = north; origin = temple centre at ground level.
 */
const site: SiteDef = {
  id: 'nageshwar',
  name: { en: 'Nageshwar', hi: 'नागेश्वर' },
  lon: 69.0869,
  lat: 22.3359,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['सौराष्ट्र', 'Saurashtra', 'Gujarat'],
    3: ['द्वारका', 'Dwarka', 'on the Saurashtra coast'],
  },
  zones: {
    dwar: ['प्रवेश द्वार', 'Entrance Gate', 'Daarukavana · 17 km from Dwarka'],
    statue: ['शिव प्रतिमा', 'The Seated Shiva', '25 m · facing west, toward Dwarka road'],
    prangan: ['मंदिर प्रांगण', 'Temple Precinct', 'Daarukavana · Nageshwar'],
    temple: ['नागेश्वर मंदिर', 'Nageshwar Mandir', 'Jyotirlinga of the Lord of Serpents'],
    descent: ['गर्भगृह की ओर', 'Toward the Garbhagriha', 'the sanctum lies below the hall'],
    garbhagriha: ['श्री नागेश्वर', 'Nageshwar Jyotirlinga', 'Dwarka shila under the silver Nag · also revered at Aundha Nagnath'],
    talav: ['नागेश्वर तालाब', 'Nageshwar Pond', 'herons and egrets nest in the babul'],
  },
  trees: TREES,
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
  // dry coastal haze: pale, slightly blue-grey; distant salt pans fade into it
  fog: { color: 0xcfdbe4, near: 450, far: 2800 },
  sunColor: 0xfff0dc,
  sunIntensity: 3.4,
  far: 3200,
  // afternoon sun from the south-west: lights the statue's face, the temple's west front and south side
  sunAzimuth: Math.atan2(-0.8, 0.6),
  build({ root, M, P, flames, pending, interiorEnv, renderer }) {
    const K = nageshwarMats(M, pending, interiorEnv, renderer);
    const t = buildTemple(root, K, P);
    const s = buildSanctum(root, K, P, interiorEnv);
    const st = buildStatue(root, K, P);
    const pr = buildPrecinct(root, K, P);
    flames.points.push(...t.flames, ...s.flames);

    // pilgrims (instanced): the queue lane, the forecourt, the statue deck, the gate and stalls, porch and hall
    const C = COMPOUND, E = Math.PI / 2;
    const plaza = (x: number, z: number) =>
      x > C.x0 + 1.5 && x < C.x1 - 1.5 && z > C.z0 + 1.5 && z < C.z1 - 1.5 &&
      !(x > -27 && x < 21 && Math.abs(z) < 17) &&
      !(Math.abs(x - STATUE.x) < 13.8 && Math.abs(z - STATUE.z) < 13.8) &&
      !(x > 20 && z > 8 && z < 25.5) && !(x > 20.5 && z > -22.5 && z < -11.5) &&
      !(x > -14.5 && x < 6.5 && z > -27.5 && z < -19) && !(x > -38.5 && x < -25.5 && z > -23.5 && z < -17.5) &&
      !(x > -38.5 && x < -25.5 && z > 17.5 && z < 23.5) && !(x > 13.5 && x < 27.5 && z > -40.5 && z < -23.5);
    // keep everyone ≥ 4 m from the spawn and the pilgrim's walk route, so they are seen at mid range
    const route: [number, number][] = [[-55, -41], [-40, -41], [-30, -58], [-23, -58], [-40, -28], [-40, 0], [-22, 0], [8.2, 0]];
    const deckLoop: [number, number][] = [[-23, -58], [-20.5, -66], [-12, -69], [-3.5, -66], [-1, -58], [-3.5, -50], [-12, -47], [-20.5, -50], [-23, -58]];
    const CS = new CrowdSpots(31);
    CS.scatter(C.x0, C.x1, C.z0, C.z1, 0, 120, E, 0.08, (x, z) => !plaza(x, z));
    CS.scatter(-53.5, -48.2, -98, 18, -1, 50, -E, 0, (x, z) => z > GATE.z0 - 8 && z < GATE.z1 + 8 && x > -50);
    CS.scatter(-17, 3.5, -9.6, 9.6, PL, 22, E, 0, (x, z) => Math.abs(Math.abs(z) - 5.2) < 0.7 || Math.abs(z) < 4.0);
    // seated devotees along the hall sides, facing the sanctum
    CS.scatter(-16, 3, -10.2, -7.6, PL, 10, E, 1, () => false);
    CS.scatter(-16, 3, 7.6, 10.2, PL, 10, E, 1, () => false);
    CS.scatter(1.5, 9.5, -19.5, -16.4, 0, 12, Math.PI, 0);
    CS.scatter(1.5, 9.5, 16.4, 19.5, 0, 12, 0, 0);
    const crowd = buildCrowd(pr.group, CS.list, { clearPaths: [route, deckLoop], clearRadius: 4, seed: 9, kanwariyaShare: 0.06, lodDistance: 25 });
    flames.lights.push(...s.lights.slice(0, 2));

    // performance: bake static meshes per material, trim small shadow casters, zone the point lights
    const keep = new Set<THREE.Object3D>([...P.floors, t.flag.mesh, pr.water]);
    st.group.children.forEach((c) => keep.add(c));
    mergeStatic(t.group, keep);
    mergeStatic(s.group, keep);
    mergeStatic(pr.group, keep);
    // the far sanctum doorway glows warm with its garlands and lamps, seen down the hall
    const doorGlow = new THREE.PointLight(0xffa040, 5, 8, 1.6);
    doorGlow.position.set(GARBHA.x0 + 0.5, PL + 1.9, 0);
    t.group.add(doorGlow);
    t.lights.push(doorGlow);
    // hall lamps only while in the hall or porch; the sanctum lamps only down the stair and inside
    lightZones(t.group, t.lights, [], (p) => {
      const hall = p.x > HALL.x0 - 0.2 && p.x < HALL.x1 && Math.abs(p.z) < HALL.z && p.y > PL + 0.5 && p.y < PL + 5.4;
      const porch = p.x > PORCH.x0 - 1 && p.x < HALL.x0 && Math.abs(p.z) < PORCH.z + 1 && p.y < PL + 5;
      return hall || porch;
    });
    lightZones(s.group, s.lights, [], (p) => p.x > STAIR.top - 2.5 && p.x < GARBHA.ix1 && Math.abs(p.z) < GARBHA.iz + 1 && p.y < PL + 2.6);
    // the sanctum (stair, garbhagriha and its ~50 garland/lamp meshes) can only be seen from inside the temple:
    // a camera-driven probe hides it everywhere else, also before the first zone change (and in posed views)
    const sProbe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    sProbe.frustumCulled = false;
    sProbe.onBeforeRender = (_r, _s, cam) => {
      const p = cam.position;
      s.group.visible = p.x > PORCH.x0 - 1 && p.x < GARBHA.x1 && Math.abs(p.z) < HALL.z + 1 && p.y < PL + 6;
    };
    t.group.add(sProbe);
    signSprite(root, 'गर्भगृह ↓', 'Garbhagriha · Darshan', new THREE.Vector3(STAIR.top - 0.6, PL + 3.4, 0), 2.6);

    return {
      ...nageshwarNav(), // Places (engine/travel.ts): the walking graph and the places list
      spawn: { feet: [-55, -1, -41], look: [-12, 15, -58] },
      onZoneChange(zone) {
        // down the stair and in the garbhagriha nothing outside can be seen: skip drawing it
        const out = zone !== 'garbhagriha';
        pr.group.visible = out;
        st.group.visible = out;
        // the sanctum (and its garlands) cannot be seen from outside the temple
        s.group.visible = zone === 'temple' || zone === 'descent' || zone === 'garbhagriha';
        root.traverse((o) => { if ((o as THREE.LOD).isLOD) o.visible = out; });
      },
      update(time) {
        t.flag.update(time);
        pr.update(time);
        crowd.update(time);
      },
      zoneAt({ x, y, z }) {
        if (y < SF + 0.6 && x > GARBHA.ix0 - 0.2 && x < GARBHA.ix1 && Math.abs(z) < GARBHA.iz) return 'garbhagriha';
        if (x > STAIR.top - 0.4 && x < GARBHA.ix0 && Math.abs(z) < STAIR.hw + 0.3 && y < PL + 0.3) return 'descent';
        if (y > PL - 0.2 && x > PORCH.x0 - 2 && x < GARBHA.x1 && Math.abs(z) < 15) return 'temple';
        if (Math.hypot(x - STATUE.x, z - STATUE.z) < 24) return 'statue';
        if (x < COMPOUND.x0 + 6 && x > COMPOUND.x0 - 16 && z > GATE.z0 - 8 && z < GATE.z1 + 8) return 'dwar';
        if (x > COMPOUND.x1) return 'talav';
        if (x > COMPOUND.x0 && x < COMPOUND.x1 && z > COMPOUND.z0 && z < COMPOUND.z1) return 'prangan';
        return null;
      },
    };
  },
};

export default site;

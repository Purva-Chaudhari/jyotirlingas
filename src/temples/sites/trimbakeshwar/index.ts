import * as THREE from 'three';
import type { SiteDef } from '../types';
import { trimbakMaterials } from './mats';
import { Offerings } from './offerings';
import { buildTemple, GARBHA, HALL, PORCH, F } from './temple';
import { buildSanctum } from './sanctum';
import { buildPrecinct, COURT, NANDI, KUND, PRECINCT_TREES } from './precinct';
import { buildTerrain, scatterTrees } from './terrain';
import { buildCrowd, CrowdSpots } from './crowd';
import { trimbakNav } from './nav';

/**
 * Shri Trimbakeshwar Jyotirlinga, Trimbak, Nashik district, Maharashtra — 19.9322 N, 73.5307 E, ~719 m,
 * at the foot of Brahmagiri where the Godavari rises. The black-basalt temple of Peshwa Balaji Bajirao
 * (Nanasaheb), 1755–1786, faces east. +z = east (Mahadwar, the town), +x = north; Brahmagiri lies
 * to the south-west and west, behind the shikhara as one enters.
 */
const site: SiteDef = {
  id: 'trimbakeshwar',
  name: { en: 'Trimbakeshwar', hi: 'त्र्यंबकेश्वर' },
  lon: 73.5307,
  lat: 19.9322,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['सह्याद्रि', 'Sahyadri', 'Nashik, Maharashtra'],
    3: ['त्र्यंबक', 'Trimbak', 'at the source of the Godavari'],
  },
  zones: {
    courtyard: ['त्र्यंबकेश्वर मंदिर', 'Trimbakeshwar Mandir', 'black basalt · Peshwa Balaji Bajirao · 1755–1786'],
    mahadwar: ['महाद्वार', 'Mahadwar', 'the east gate of the precinct'],
    nandi: ['नंदी मंडप', 'Nandi Mandapa', 'Nandi faces the sanctum'],
    mandapa: ['सभा मंडप', 'Sabha Mandapa', 'the hall of three porches'],
    antarala: ['अंतराळ', 'Antarala', 'down the steps to the sanctum · the darshan mirror'],
    garbhagriha: ['श्री त्र्यंबकेश्वर', 'Trimbakeshwar Jyotirlinga', 'Brahma · Vishnu · Mahesh — three lingas in one hollow'],
    kund: ['अमृत कुंड', 'Amrut Kund', 'the temple tank'],
    street: ['त्र्यंबक', 'Trimbak', 'below Brahmagiri, where the Godavari rises'],
  },
  trees: PRECINCT_TREES,
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: a bright post-monsoon sky
  // mid-morning: the sun in the south-east lights the east front and the Brahmagiri scarps behind
  sunAzimuth: Math.atan2(-0.45, 0.9),
  fog: { color: 0xb9c4cc, near: 600, far: 9000 },
  sunColor: 0xfff0dc,
  sunIntensity: 3.3,
  far: 6000,
  build({ root, M, P, flames, pending, interiorEnv }) {
    const K = trimbakMaterials(M, pending, interiorEnv);
    // sky fill: the basalt in shade reads dark grey (≈ rgb 55–60), never a black void (r088)
    const fill = new THREE.HemisphereLight(0xcdd8e6, 0x8a8074, 0.5);
    root.add(fill);
    const O = new Offerings(17);
    const t = buildTemple(root, K, P, flames);
    const s = buildSanctum(root, K, P, flames, O);
    const pr = buildPrecinct(root, K, P, flames, O);
    const terrain = buildTerrain(root, pending);
    const hillTrees = scatterTrees(root, pr.town.userData.trees ?? []);
    O.flush(root);
    for (const [x, z] of PRECINCT_TREES) P.solid(x - 0.4, 0, z - 0.4, x + 0.4, 5, z + 0.4);
    const flags = [...t.flags, ...pr.flags];

    // ---------- pilgrims (c083, r087, r088): families on the courtyard, the darshan queue in the north shed,
    // the street outside the Mahadwar. One batched draw with a far LOD; none within 4 m of the walk ----------
    const C = new CrowdSpots(53);
    const bad = (x: number, z: number) =>
      (Math.abs(x) < 12 && z > -16 && z < 18.5) // the temple and its steps
      || (Math.abs(x) < 3.8 && Math.abs(z - NANDI.z) < 3.8)
      || (x > KUND.x0 - 1.5 && x < KUND.x1 + 1.5 && z > KUND.z0 - 1.5 && z < KUND.z1 + 1.5)
      || (x > 15 && x < 20 && z > -1 && z < 33) // the queue shed (filled below)
      || Math.hypot(x - 22, z + 22) < 2.2 || Math.hypot(x + 5.6, z - 20.5) < 1.4
      || PRECINCT_TREES.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 1.2);
    C.scatter(COURT.x0 + 2, -12, -14, COURT.z1 - 3, 0, 34, Math.PI / 2, 0.08, bad); // south court, facing the temple
    C.scatter(20.5, COURT.x1 - 2, -26, COURT.z1 - 3, 0, 26, -Math.PI / 2, 0.06, bad); // north court
    C.scatter(-12, 15, 19, COURT.z1 - 3, 0, 30, Math.PI, 0.05, bad); // east court, facing west to the porch
    C.scatter(-15, 15, COURT.z0 + 2, -17, 0, 14, 0, 0.1, bad); // behind the sanctum
    C.queue(new THREE.Vector3(16.5, 0, 31), new THREE.Vector3(16.5, 0, 1.5), 0.62);
    C.queue(new THREE.Vector3(18.5, 0, 1.5), new THREE.Vector3(18.5, 0, 31), 0.62);
    C.scatter(-6.5, 6.5, COURT.z1 + 8, COURT.z1 + 70, -0.02, 36, Math.PI, 0); // the street
    const walkPath: [number, number][] = [[0, 72], [0, 50], [-17, 36], [-5, 30], [-4.5, 20], [0, 18.5], [0, 10], [0, -2], [0, -6.6]];
    const crowd = buildCrowd(root, C.list, { clearPaths: [walkPath], clearRadius: 4, seed: 19, lodDistance: 22, kanwariyaShare: 0 });
    const ih = GARBHA.inner;
    // the sanctum's ~30 meshes are drawn only when the camera is inside the temple or on its axis, where the
    // inner doorway lines up: a zero-vertex probe (never culled, never drawn) reports the camera position
    // each frame, and update() toggles the group (one frame late, invisible behind the walls).
    const camPos = new THREE.Vector3(1e9, 0, 0);
    const probe = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    probe.frustumCulled = false;
    probe.onBeforeRender = (_r, _s, cam) => { camPos.copy(cam.position); };
    root.add(probe);
    const sanctumGroup = root.getObjectByName('garbhagriha');
    return {
      ...trimbakNav(), // Places (engine/travel.ts): the walking graph and the places list
      // in the town street outside the Mahadwar (east gate), facing it: the pilgrim walks in through the gate
      spawn: { feet: [0, 0, 72], look: [0, 9, 0] },
      onZoneChange(zone: string) {
        // inside the sunken sanctum and its passage nothing outside can be seen: skip the hills and the town,
        const inside = zone === 'garbhagriha' || zone === 'antarala';
        terrain.visible = !inside;
        hillTrees.visible = !inside;
        crowd.mesh.visible = !inside;
        if (crowd.blobs) crowd.blobs.visible = !inside;
        pr.town.visible = !inside;
      },
      update(time: number) {
        for (const f of flags) f.update(time);
        s.update(time);
        if (sanctumGroup) {
          const { x, y, z } = camPos;
          sanctumGroup.visible = (Math.abs(x) < 12 && z < 19 && z > -16 && y < 10) || (Math.abs(x) < 3.5 && z < 45 && z > -16);
          // down in the sanctum and the lower antarala nothing outside can be seen
          const deep = Math.abs(x) < 2.3 && z < -4 && z > -11.3 && y < 2.4;
          terrain.visible = hillTrees.visible = pr.town.visible = crowd.mesh.visible = !deep;
          if (crowd.blobs) crowd.blobs.visible = !deep;
        }
        crowd.update(time);
      },
      zoneAt({ x, y, z }: THREE.Vector3) {
        if (Math.abs(x) < ih + 0.1 && z > GARBHA.cz - ih - 0.1 && z < GARBHA.cz + ih + 0.1 && y < F - 0.3) return 'garbhagriha';
        if (Math.abs(x) < 1.0 && z >= GARBHA.cz + ih - 0.1 && z < HALL.z0 + 0.2 && y < F + 0.5) return 'antarala';
        if (y > F - 0.5 && x > HALL.x0 - PORCH.d - 0.2 && x < HALL.x1 + PORCH.d + 0.2 && z > HALL.z0 - 2 && z < HALL.z1 + PORCH.d + 0.2) return 'mandapa';
        if (z > COURT.z1 - 4 && z < COURT.z1 + 6 && Math.abs(x) < 4) return 'mahadwar';
        if (z > COURT.z1 + 6) return 'street';
        if (Math.abs(x) < 6 && Math.abs(z - NANDI.z) < 6) return 'nandi';
        if (x > KUND.x0 - 3 && x < KUND.x1 + 3 && z > KUND.z0 - 3 && z < KUND.z1 + 4) return 'kund';
        return null;
      },
    };
  },
};

export default site;

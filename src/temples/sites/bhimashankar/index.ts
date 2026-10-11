import * as THREE from 'three';
import type { SiteDef } from '../types';
import { bhimaMaterials } from './mats';
import { Offerings } from './offerings';
import { buildTemple } from './temple';
import { buildSanctum } from './sanctum';
import { buildPrecinct } from './precinct';
import { buildVillage } from './village';
import { buildTerrain, FOG_COLOR, FOG } from './terrain';
import { buildForest, buildMist, buildCardTrees } from './forest';
import { mergeStatic, lightZones } from './optimize';
import {
  COURT, STAIR, STAIR_TOP_X, STAIR_TOP_Y, PLAZA, GARBHA, HALL, F, MOKSHA, KUSHA, BELL, SHANI, KAMALAJA, DEEPMAL, GATE, RIM,
} from './layout';
import { bhimashankarNav } from './nav';

/**
 * Shri Bhimashankar Jyotirlinga, Bhimashankar, Khed taluka, Pune district, Maharashtra — 19.0719 N,
 * 73.5357 E, ~915 m (SRTM) in the hollow at the head of the Bhima, on the crest of the Sahyadri in the
 * Bhimashankar Wildlife Sanctuary. The 18th-century black-stone temple faces east; its sabhamandapa was
 * rebuilt in stone in 2026. +z = east, +x = north; the village and the stairway lie to the north.
 */
const site: SiteDef = {
  id: 'bhimashankar',
  name: { en: 'Bhimashankar', hi: 'भीमाशंकर' },
  lon: 73.5357,
  lat: 19.0719,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['सह्याद्रि', 'Sahyadri', 'Pune district, Maharashtra'],
    3: ['भीमाशंकर', 'Bhimashankar', 'at the source of the Bhima'],
  },
  zones: {
    courtyard: ['भीमाशंकर मंदिर', 'Bhimashankar Mandir', 'black stone · shikhara of Nana Phadnavis · 18th century'],
    village: ['भीमाशंकर', 'Bhimashankar', 'a village on the crest of the Sahyadri, deep in the forest'],
    stairs: ['पायरी मार्ग', 'The Stairway', 'down through the shops to the temple in the hollow'],
    mandapa: ['सभामंडप', 'Sabha Mandapa', 'forty-eight carved stone pillars · rebuilt in stone, 2026'],
    garbhagriha: ['श्री भीमाशंकर', 'Bhimashankar Jyotirlinga', 'the swayambhu linga · Shiva and Shakti in one cleft stone'],
    bell: ['चिमाजी अप्पांची घंटा', "Chimaji Appa's Bell", 'brought from Vasai after the victory of 1739 · cast 1729'],
    mokshakund: ['मोक्षकुंड', 'Mokshakund', 'the sacred tank behind the temple'],
    kusharanya: ['कुशारण्य तीर्थ', 'Kusharanya Tirtha', 'where the Bhima rises'],
    deepmal: ['दीपमाळ', 'Deepmal', 'the tower of lamps'],
    kamalaja: ['कमलजा देवी', 'Kamalaja Devi', 'Parvati, who stood with Shiva against Tripurasura'],
  },
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: a monsoon-break sky, sun high (48°) so it stays out of the main views
  // early afternoon in a monsoon break: the sun high in the west-south-west, behind the pilgrim on the stairs
  // and in the courtyard looking at the shikhara, so none of the main views is backlit
  sunAzimuth: Math.atan2(-0.35, -0.94),
  fog: { color: FOG_COLOR, near: FOG.near, far: FOG.far },
  sunColor: 0xfff0dc,
  sunIntensity: 2.6,
  far: 5200,
  build({ root, M, P, flames, pending, interiorEnv }) {
    const K = bhimaMaterials(M, pending, interiorEnv);
    const O = new Offerings(23);
    const t = buildTemple(root, K, P, flames);
    const s = buildSanctum(root, K, P, flames, O);
    const pr = buildPrecinct(root, K, P, flames, O);
    const OV = new Offerings(29, true);
    const v = buildVillage(root, K, P, flames, OV);
    buildTerrain(root, pending);
    buildForest(root);
    buildCardTrees(root, pending);
    const mist = buildMist(root);
    const og = new THREE.Group();
    og.name = 'offerings';
    root.add(og);
    O.flush(og);
    OV.flush(og);

    // performance: bake static meshes per material, trim small shadow casters, zone the interior lights
    const keep = new Set<THREE.Object3D>([...P.floors, ...[...t.flags, ...pr.flags, ...v.flags].map((f) => f.mesh)]);
    for (const grp of root.children) {
      if (grp instanceof THREE.Group && grp.name !== 'offerings') mergeStatic(grp, keep);
    }
    const interior = [...t.hallLights, ...s.lights];
    const inHall = (p: THREE.Vector3) => p.y < F + 6 && p.x > HALL.x0 - 0.5 && p.x < HALL.x1 + 0.5 && p.z > GARBHA.cz - GARBHA.half && p.z < HALL.z1 + 0.6;
    lightZones(root, interior, [], inHall);
    // inside the closed sanctum nothing outside can be seen: stop drawing the forest, village and terrain
    {
      const outside = root.children.filter((o) => ['forest', 'card-trees', 'village', 'terrain'].includes(o.name));
      const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      probe.frustumCulled = false;
      let hidden = false;
      probe.onBeforeRender = (_r, _s, cam) => {
        const p = cam.position;
        const inSanctum = Math.abs(p.x) < GARBHA.inner && p.z > GARBHA.cz - GARBHA.inner && p.z < HALL.z0 - 1.6 && p.y < F + 2.2;
        if (inSanctum !== hidden) { hidden = inSanctum; for (const o of outside) o.visible = !hidden; }
      };
      root.add(probe);
    }

    const flags = [...t.flags, ...pr.flags, ...v.flags];
    const ia = GARBHA.inner;
    const zm = (STAIR.z0 + STAIR.z1) / 2;
    return {
      ...bhimashankarNav(),
      spawn: { feet: [STAIR_TOP_X + 18, STAIR_TOP_Y, zm - 0.6], look: [STAIR_TOP_X - 4, STAIR_TOP_Y + 3.2, zm - 0.6] },
      update(time: number) {
        for (const f of flags) f.update(time);
        s.update(time);
        mist.update(time);
      },
      zoneAt({ x, y, z }: THREE.Vector3) {
        if (Math.abs(x) < ia + 0.2 && z > GARBHA.cz - ia - 0.2 && z < HALL.z0 - 0.15 && y < F + 0.3) return 'garbhagriha';
        if (y > F - 0.2 && y < F + 3 && x > HALL.x0 - 0.2 && x < HALL.x1 + 0.2 && z > HALL.z0 - 0.2 && z < HALL.z1 + 0.2) return 'mandapa';
        if (x >= PLAZA.x0 - 1) return 'village';
        if (x > COURT.x1 && z > STAIR.z0 - 1 && z < STAIR.z1 + 1) return 'stairs';
        if (Math.hypot(x - BELL.x, z - BELL.z) < 3 || Math.hypot(x - SHANI.x, z - SHANI.z) < 2.5) return 'bell';
        if (x > MOKSHA.x0 - 2 && x < MOKSHA.x1 + 2 && z > MOKSHA.z0 - 2 && z < MOKSHA.z1 + 2) return 'mokshakund';
        if (Math.hypot(x - KUSHA.x, z - KUSHA.z) < 3) return 'kusharanya';
        if (Math.hypot(x - DEEPMAL.x, z - DEEPMAL.z) < 3) return 'deepmal';
        if (z > GATE.z + 4 && y > RIM.e - 0.5 && Math.hypot(x - KAMALAJA.x, z - KAMALAJA.z) < 9) return 'kamalaja';
        return null;
      },
    };
  },
};

export default site;

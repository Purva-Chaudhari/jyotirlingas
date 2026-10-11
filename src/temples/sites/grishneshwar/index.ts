import * as THREE from 'three';
import type { SiteDef } from '../types';
import { grishMaterials } from './mats';
import { Merger } from './merge';
import { Offerings } from './offerings';
import { nandiMesh } from './nandi';
import { buildTemple, F_M, G_IN, DOOR, MANDAPA, NANDI, BODY, BHADRA } from './temple';
import { buildSanctum } from './sanctum';
import { buildPrecinct, COURT, TREES, KUND, SOUTH_GATE, SERPENT } from './precinct';
import { buildCrowd, CrowdSpots } from './crowd';
import { grishneshwarNav } from './nav';

/**
 * Shri Ghrishneshwar (Grishneshwar) Jyotirlinga, Verul, beside the Ellora caves — the twelfth
 * Jyotirlinga. The present temple of red basalt was rebuilt in the 18th century under Ahilyabai
 * Holkar: a walled court, a sabha mandapa on 24 pillars with Nandi, a five-tiered shikhara carved with
 * Dashavatara and Shiva-lila niches, and an east-facing lingam in a garbhagriha below the mandapa floor.
 * Frame: +z = east, +x = north, origin = centre of the garbhagriha at court level. Units: metres.
 */
const site: SiteDef = {
  id: 'grishneshwar',
  name: { en: 'Grishneshwar', hi: 'घृष्णेश्वर' },
  // 20°01′29.9″N 75°10′11.7″E (Wikipedia / Survey coordinates of the temple)
  lon: 75.16992,
  lat: 20.02497,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['मराठवाड़ा', 'Marathwada', 'Maharashtra'],
    3: ['वेरूळ', 'Verul', 'beside the Ellora caves'],
  },
  zones: {
    prangan: ['मंदिर प्रांगण', 'Mandir Prangan', 'the court of Shri Ghrishneshwar · red basalt, 18th century'],
    sabhamandapa: ['सभामंडप', 'Sabha Mandapa', 'twenty-four carved pillars · Ahilyabai Holkar'],
    nandi: ['नंदी', 'Nandi', 'gazing at the Jyotirlinga'],
    pradakshina: ['प्रदक्षिणा', 'Pradakshina', 'elephants, and the Dashavatara in the niches above'],
    garbhagriha: ['श्री घृष्णेश्वर ज्योतिर्लिंग', 'Shri Ghrishneshwar Jyotirlinga', 'the twelfth Jyotirlinga · facing east'],
    verul: ['वेरूळ गाव', 'Verul village', 'the Ellora hills beyond'],
    shivalaya: ['शिवालय तीर्थ', 'Shivalaya Tirth', 'the sacred tank where Ghushma immersed her lingas'],
  },
  trees: TREES,
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: a soft partly-cloudy Deccan sky
  fog: { color: 0xc4c8c8, near: 700, far: 5200 },
  sunColor: 0xffe2bc,
  sunIntensity: 3.3,
  far: 6000,
  sunAzimuth: -1.25, // late-morning sun from the south-south-east, lighting the south face and the main approach
  build({ root, M, P, flames, renderer, pending, interiorEnv }) {
    const K = grishMaterials(M, renderer, pending, interiorEnv);
    const B = new Merger(P, 'grishneshwar');
    const O = new Offerings(17);
    const nandiGeo = nandiMesh(K.nandi).geometry;
    // village + Shivalaya kund: merged separately, no shadow casting, hidden from inside the sanctum
    const V = new Merger(P, 'grishneshwar-village');
    const outer = new THREE.Group();
    root.add(outer);
    const t = buildTemple(root, B, K, P, O, nandiGeo);
    const cellLights = buildSanctum(root, B, K, P, flames, O);
    // the cell's lamp lights shade only while you are in the garbhagriha (zone toggle): outside, the
    // sunlit court shades without seven extra lights
    {
      const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      probe.frustumCulled = false;
      let on: boolean | null = null;
      probe.onBeforeRender = (_r, _s, cam) => {
        const p = cam.position;
        const inn = Math.abs(p.x) < G_IN + 0.3 && p.z > -G_IN - 0.3 && p.z < BODY + BHADRA + 1.0 && p.y < F_M + 2.2;
        if (inn !== on) { on = inn; for (const l of cellLights) l.visible = inn; }
      };
      root.add(probe);
    }
    buildPrecinct(root, B, K, P, O, V, outer, pending);
    // pilgrims: the darshan queue in the tin shed from the south gate, families in the court and on the
    // mandapa floor, the village lane and the kund rim (one BatchedMesh, no colliders, none near your path)
    const C = new CrowdSpots(53);
    const solidAt = (x: number, z: number, y = 0.5) => P.solids.some((bx) => x > bx.min.x - 0.35 && x < bx.max.x + 0.35 && z > bx.min.z - 0.35 && z < bx.max.z + 0.35 && y + 0.3 > bx.min.y && y < bx.max.y);
    const sg = SOUTH_GATE.z;
    C.queue(new THREE.Vector3(COURT.x0 + 1.2, 0, sg - 1.1), new THREE.Vector3(-12.5, 0, sg - 1.1), 0.62, 2);
    for (let k = 0; k < SERPENT.lanes; k++) {
      const z = SERPENT.z0 + (k + 0.5) * SERPENT.lw;
      C.queue(new THREE.Vector3(k % 2 ? SERPENT.xb - 0.4 : SERPENT.xa + 0.4, 0, z), new THREE.Vector3(k % 2 ? SERPENT.xa + 1.4 : SERPENT.xb - 1.4, 0, z), 0.62);
    }
    C.scatter(-27, 27, -27, 44, 0, 90, Math.PI * 0.5, 0.15, (x, z) => solidAt(x, z) || (Math.abs(x) < 13.5 && z > -10 && z < 27) || (x < -11 && z > sg - 2.5 && z < sg + 2.5) || (x < SERPENT.xb + 1 && z > SERPENT.z0 - 1 && z < SERPENT.z0 + SERPENT.lanes * SERPENT.lw + 1));
    C.scatter(-5.3, -3.6, 11.5, 18.5, F_M, 9, Math.PI / 2, 0.8, (x, z) => solidAt(x, z, F_M));
    C.scatter(COURT.x0 - 14, COURT.x0 - 4, COURT.z0 - 25, COURT.z1 + 35, 0, 40, 0, 0.1, (x, z) => solidAt(x, z));
    C.scatter(KUND.x - KUND.half - 2.5, KUND.x + KUND.half + 2.5, KUND.z - KUND.half - 2.5, KUND.z + KUND.half + 2.5, 0, 14, 0, 0.4,
      (x, z) => solidAt(x, z) || (Math.abs(x - KUND.x) < KUND.half + 0.6 && Math.abs(z - KUND.z) < KUND.half + 0.6));
    const crowd = buildCrowd(outer, C.list, {
      clearRadius: 4,
      kanwariyaShare: 0,
      lodDistance: 22,
      clearPaths: [[[-41, 17], [-28, 17], [-21.5, 25], [0, 30], [2, 28], [2, 24], [2, 19], [0, 10.5], [0, 6], [0, 2.3]]],
    });
    B.flush(root);
    V.flush(outer, false);
    O.flush(root, interiorEnv);
    for (const [x, z] of TREES) P.solid(x - 0.4, 0, z - 0.4, x + 0.4, 6, z + 0.4);
    const o = BODY + BHADRA;
    return {
      ...grishneshwarNav(),
      // in the village lane outside the main (south) gate, facing it: the pilgrim walks in through the gate
      spawn: { feet: [-41, 0, 17], look: [0, 8, 13] },
      onZoneChange(zone) {
        outer.visible = zone !== 'garbhagriha';
      },
      update(time) {
        t.flag.update(time);
        crowd.update(time);
      },
      zoneAt({ x, y, z }) {
        // the cell, and the stepped passage down to it through the east wall
        if (Math.abs(x) < G_IN + 0.2 && z > -G_IN && z < o && (y < F_M - 0.05 || Math.abs(x) < DOOR.half + 0.2)) return 'garbhagriha';
        if (y > F_M - 0.3 && Math.abs(x - NANDI.x) < 1.6 && Math.abs(z - NANDI.z) < 1.9) return 'nandi';
        if (y > F_M - 0.3 && Math.abs(x) < MANDAPA.half + 0.7 && z > o && z < MANDAPA.z1 + 2.5) return 'sabhamandapa';
        if (y > F_M - 0.3 && Math.abs(x) < o + 2 && z > -o - 2 && z <= o + 2) return 'pradakshina';
        if (x > COURT.x0 && x < COURT.x1 && z > COURT.z0 && z < COURT.z1) return 'prangan';
        if (Math.abs(x - KUND.x) < KUND.half + 4 && Math.abs(z - KUND.z) < KUND.half + 4) return 'shivalaya';
        return 'verul';
      },
    };
  },
};

export default site;

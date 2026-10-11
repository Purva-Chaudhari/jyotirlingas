import * as THREE from 'three';
import type { SiteDef } from '../types';
import { omkarMaterials } from './mats';
import { buildComplex } from './complex';
import { buildTemple } from './temple';
import { buildSanctum } from './sanctum';
import { buildSetting, bankS } from './setting';
import { FRAME, GARBHA, HALL, JHOOLA, LANE, F1, WATER_Y, GHAT, MAMLESHWAR } from './layout';
import { buildCrowd, CrowdSpots } from './crowd';
import { omkareshwarNav } from './nav';

/**
 * Shri Omkareshwar Jyotirlinga, Mandhata island in the Narmada (Khandwa district, Madhya Pradesh), as it stands today:
 * the old temple on the island's southern cliff (sixty-pillar mandapa, five storeys, the stripped pinkish-sandstone
 * shikhara), the new pink galleries that climb the cliff from the Koti Tirth ghat, the Jhoola pul upstream,
 * Mamleshwar across the water - and the Jyotirlinga itself, a small natural stone set low in water, off to the
 * side of the hall and not beneath the spire.
 * Axes: +z = south (the river), +x = east (upstream). Origin = the mandapa floor centre.
 */
const site: SiteDef = {
  id: 'omkareshwar',
  name: { en: 'Omkareshwar', hi: 'ओंकारेश्वर' },
  // the temple on Mandhata's south shore (Wikipedia: 22°14′44″N 76°09′03″E)
  lon: 76.151,
  lat: 22.2456,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['निमाड़ · मध्य प्रदेश', 'Nimar · Madhya Pradesh', 'the Narmada valley between the Vindhyas and the Satpuras'],
    3: ['मांधाता', 'Mandhata', 'an island in the Narmada, shaped like ॐ'],
  },
  zones: {
    jhoola: ['झूला पुल', 'Jhoola Pul', 'the suspension bridge over the Narmada'],
    ghat: ['कोटितीर्थ घाट', 'Koti Tirth Ghat', 'Maa Narmada at the temple’s feet'],
    darshan: ['दर्शन मार्ग', 'Darshan Marg', 'the galleries climbing the cliff of Mandhata'],
    temple: ['श्री ओंकारेश्वर मंदिर', 'Shri Omkareshwar Mandir', 'sixty pillars · five storeys · the shikhara above'],
    garbhagriha: ['श्री ओंकारेश्वर ज्योतिर्लिंग', 'Omkareshwar Jyotirlinga', 'swayambhu · ever in the waters of the Narmada'],
    upper: ['श्री महाकालेश्वर', 'Mahakaleshwar · upper storey', 'above: Siddhnath, Gupteshwar, Dhwajeshwar'],
  },
  // (no shared neem models: at ~300k triangles each they cost more than the whole temple; the hill's own
  // instanced trees stand in for them)
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: a clear, lightly clouded day
  fog: { color: 0xc4ccd0, near: 260, far: 2800 },
  // morning sun from the south-east, raking across the river face of the galleries and the spire
  sunAzimuth: Math.atan2(0.75, 1),
  far: 4000,
  build({ root, M, P, flames, sunDir, renderer, pending, interiorEnv }) {
    const K = omkarMaterials(M, renderer, pending, interiorEnv);
    const { group: setting, water } = buildSetting(root, K, P, flames, sunDir);
    const complex = buildComplex(root, K, P, flames);
    const t = buildTemple(root, K, P, flames);
    const sanctum = buildSanctum(root, K, P, flames);
    // Shadow casters: only the masses. Trim, metalwork, cloth, lamps and single boxes (floors, plinths) cast
    // nothing - each caster costs a draw per shadow cascade.
    {
      const small = new Set<THREE.Material>([K.brass, K.gold, K.marigold, K.saffron, K.kumkum, K.silver, K.silverEmb, K.silverRep, K.silverDS,
        K.steel, K.dark, K.lamp, K.tube, K.cable, K.glass, K.redCloth, K.velvet, K.door, K.whiteStone, K.blackStone, K.lingam, K.rockLingam,
        K.ash, K.clothWhite, K.clothYellow, K.naga, K.marble, K.hallFloor, K.deck]);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.castShadow) return;
        const g = m.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
        if (small.has(m.material as THREE.Material) || tris <= 12) m.castShadow = false;
      });
    }
    // Camera-driven culling (holds for walking and for fixed viewpoints alike): the garbhagriha is only drawn
    // from the temple and its forecourt; inside it the river, the town and the galleries are not drawn, and
    // the sky's image light is dimmed so the lamps lead.
    const probe = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    probe.frustumCulled = false;
    probe.renderOrder = -1000;
    let last = '';
    probe.onBeforeRender = (_r, _s, cam) => {
      if ((cam as THREE.OrthographicCamera).isOrthographicCamera) return; // shadow passes
      const p = cam.position;
      if (p.y < WATER_Y) return; // the river's mirror camera
      const inside = p.x > GARBHA.x0 - 0.7 && p.x < GARBHA.x1 && p.z > GARBHA.z0 && p.z < GARBHA.z1 && p.y < 2.2;
      const inHall = !inside && p.y > -0.8 && p.y < 9 && p.x > HALL.x0 - 6 && p.x < GARBHA.x1 + 2 && p.z > HALL.z0 - 4 && p.z < HALL.z1 + 14;
      const key = inside ? 'in' : inHall ? 'hall' : 'out';
      if (key === last) return;
      last = key;
      sanctum.visible = key !== 'out';
      setting.visible = complex.visible = key !== 'in';
      const scene = root.parent as THREE.Scene | null;
      if (scene) scene.environmentIntensity = key === 'in' ? 0.28 : key === 'hall' ? 0.6 : 1.0;
    };
    root.add(probe);
    // pilgrims on the Koti Tirth ghat, its river steps, the west galleries and the Mamleshwar bank; none
    // within 4 m of the walk from the Jhoola pul along the lane, down to the forecourt and into the temple
    const C = new CrowdSpots(53);
    const ghatBad = (x: number, z: number) => Math.abs(x) < 4.5 || (Math.abs(x + 7.2) < 2.2 && Math.abs(z - 26.6) < 2.2) || (Math.abs(x - 7) < 2 && Math.abs(z - 26.6) < 2);
    C.scatter(GHAT.x0 + 2, GHAT.x1 - 4, FRAME.front + 4.2, GHAT.z1 - 0.3, GHAT.y, 150, Math.PI, 0.15, ghatBad);
    // on the steps down to the water, many sitting, facing the river
    const nSteps = Math.round((GHAT.y - (WATER_Y - 0.6)) / 0.24), tread = (GHAT.stepsTo - GHAT.z1) / nSteps;
    for (let i = 0; i < 70; i++) {
      const k = Math.floor(C.rnd() * (nSteps - 6)) + 1, x = GHAT.x0 + 4 + C.rnd() * (GHAT.x1 - GHAT.x0 - 8);
      if (Math.abs(x) < 3) continue;
      C.add(x, GHAT.y - (k + 1) * 0.24, GHAT.z1 + (k + 0.5) * tread, (C.rnd() - 0.5) * 0.8, C.rnd() < 0.55);
    }
    // queues on the west galleries (the walk to the temple uses the east ones)
    C.queue(new THREE.Vector3(-37, -4, FRAME.front - 3.0), new THREE.Vector3(-6, -4, FRAME.front - 3.0), 0.62, 2);
    C.queue(new THREE.Vector3(-37, 0, FRAME.front - 3.0), new THREE.Vector3(-6, 0, FRAME.front - 3.0), 0.7, 1);
    // the far bank by Mamleshwar
    for (let i = 0; i < 50; i++) {
      const x = MAMLESHWAR.x - 24 + C.rnd() * 48, k = 3 + Math.floor(C.rnd() * 18);
      C.add(x, -15.6 + (k + 1) * 0.36, bankS(x) - 3 + (k + 0.5) * 0.6, Math.PI + (C.rnd() - 0.5) * 0.8, C.rnd() < 0.3);
    }
    const crowd = buildCrowd(complex, C.list, {
      clearPaths: [[[JHOOLA.x, 75], [JHOOLA.x, 20], [62, 20], [34, 20.5], [6, 21.5], [6, 11], [0, 9.5], [0, 3.5], [0, -5.7], [GARBHA.x0, GARBHA.doorZ]]],
      clearRadius: 4, kanwariyaShare: 0, lodDistance: 30,
    });
    return {
      ...omkareshwarNav(),
      spawn: { feet: [JHOOLA.x - 0.3, JHOOLA.y, 73.5], look: [-6, 6, 8] },
      update(time) {
        t.flag.update(time);
        crowd.update(time);
        water.material.uniforms.time.value = time * 0.4;
      },
      setSun(dir: THREE.Vector3) {
        water.material.uniforms.sunDirection.value.copy(dir);
      },
      zoneAt({ x, y, z }) {
        if (x > GARBHA.x0 - 0.7 && x < GARBHA.x1 && z > GARBHA.z0 && z < GARBHA.z1 && y < 0.2) return 'garbhagriha';
        if (y > F1 - 0.6 && x > HALL.x0 - 1 && x < HALL.x1 + 1 && z > HALL.z0 && z < HALL.z1 + 1) return 'upper';
        if (y > -0.6 && x > HALL.x0 && x < GARBHA.x0 && z > HALL.z0 && z < HALL.z1 + 1.5) return 'temple';
        if (Math.abs(x - JHOOLA.x) < 3 && z > LANE.z1 + 1) return 'jhoola';
        if (y < -9) return 'ghat';
        if (x > FRAME.xs[0] - 1 && x < LANE.x1 + 1.5 && z > -1 && z < FRAME.front + 1) return 'darshan';
        return null;
      },
    };
  },
};

export default site;

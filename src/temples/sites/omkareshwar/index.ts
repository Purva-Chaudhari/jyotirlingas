import * as THREE from 'three';
import type { SiteDef } from '../types';
import { omkarMaterials } from './mats';
import { buildComplex } from './complex';
import { buildWestWing, COURT_QUEUE } from './westwing';
import { buildNarmadaAarti, AARTI } from './narmada';
import { buildTemple } from './temple';
import { buildSanctum } from './sanctum';
import { buildSetting, bankS } from './setting';
import { FRAME, GARBHA, HALL, JHOOLA, LANE, F1, WATER_Y, GHAT, MAMLESHWAR, WEST, westPt, COURT_X0 } from './layout';
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
    buildWestWing(complex, K, P);
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
      const z = GHAT.z1 + (k + 0.5) * tread;
      if (Math.abs(x) < 3 || (x > AARTI.x0 - 0.6 && x < AARTI.x1 + 0.6 && z < AARTI.z1 + 0.6)) continue;
      C.add(x, GHAT.y - (k + 1) * 0.24, GHAT.z1 + (k + 0.5) * tread, (C.rnd() - 0.5) * 0.8, C.rnd() < 0.55);
    }
    const narmadaAarti = buildNarmadaAarti(complex, K, P, flames, C);
    // pilgrims on the lane along the cliff: coming from the bridge on the river side, going back along the
    // cliff side, a few stopped to talk or sitting on the kerb under the walkway roof (the stair cut kept clear)
    for (let x = LANE.x0 + 2; x < LANE.x1 - 3; x += 0.8 + C.rnd() * 1.6) {
      const river = C.rnd() < 0.5;
      const z = river ? 22.2 + C.rnd() * 0.5 : 17.8 + C.rnd() * 0.6;
      if (river && x > 48.5 && x < 63.5) continue;
      const r = C.rnd();
      if (r < 0.1) { C.add(x, LANE.y, z, river ? Math.PI : 0, true); continue; } // sitting at the edge
      C.add(x, LANE.y, z, r < 0.2 ? (river ? 0 : Math.PI) + (C.rnd() - 0.5) : river ? -Math.PI / 2 : Math.PI / 2, false);
      if (r >= 0.2) C.list[C.list.length - 1].pose = C.rnd() < 0.72 ? 'walk' : C.rnd() < 0.5 ? 'bag' : 'thali';
    }
    // pilgrims on the Jhoola pul: two files, to the island on the west side and back on the east, the odd
    // family stopped at the railing to look down at the Narmada
    for (let z = JHOOLA.z0 + 5; z < JHOOLA.z1 - 4; z += 1.3 + C.rnd() * 2.6) {
      const side = C.rnd() < 0.5 ? -1 : 1;
      if (C.rnd() < 0.12) {
        C.add(JHOOLA.x + side * 1.0, JHOOLA.y, z, side * Math.PI / 2 + (C.rnd() - 0.5) * 0.6, false);
        continue;
      }
      C.add(JHOOLA.x + side * (0.72 + C.rnd() * 0.18), JHOOLA.y, z, side < 0 ? Math.PI : 0, false);
      C.list[C.list.length - 1].pose = C.rnd() < 0.7 ? 'walk' : C.rnd() < 0.5 ? 'bag' : 'thali';
    }
    // the darshan queue in the -4 gallery's railed lanes, either side of the walk (drone and darshan videos),
    // and the serpentine queue under the sheet roofs of the west forecourt
    C.queue(new THREE.Vector3(33, -4, FRAME.front - 1.4), new THREE.Vector3(4.5, -4, FRAME.front - 1.4), 0.62, 2);
    C.queue(new THREE.Vector3(13, -4, FRAME.front - 8.6), new THREE.Vector3(33, -4, FRAME.front - 8.6), 0.62, 2);
    for (const [z, xa] of COURT_QUEUE) C.queue(new THREE.Vector3(xa + 0.6, 0, z), new THREE.Vector3(-6.2, 0, z), 0.6, 1);
    // queues along the west wing's balconies (the walk to the temple uses the east galleries)
    for (const [y, step, rows] of [[-3, 0.62, 2], [0, 0.7, 1], [6, 0.7, 1]] as const) {
      const [ax, az] = westPt(WEST.len - 1.5, WEST.depth - 1.2), [bx, bz] = westPt(1.5, WEST.depth - 1.2);
      C.queue(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz), step, rows);
    }
    // the far bank by Mamleshwar
    for (let i = 0; i < 50; i++) {
      const x = MAMLESHWAR.x - 24 + C.rnd() * 48, k = 3 + Math.floor(C.rnd() * 18);
      C.add(x, -15.6 + (k + 1) * 0.36, bankS(x) - 3 + (k + 0.5) * 0.6, Math.PI + (C.rnd() - 0.5) * 0.8, C.rnd() < 0.3);
    }
    // inside the temple: the darshan queue single file down the hall's stainless tunnel, hands folded or a
    // thali of offerings, then a few waiting by Nandi's railing; devotees sitting in the far bays of the hall
    C.queue(new THREE.Vector3(0.62, 0, 1.4), new THREE.Vector3(0.62, 0, -4.5), 0.6, 1);
    for (const [x, z, ry] of [[2.75, -4.75, Math.PI / 2], [5.0, -4.75, Math.PI / 2]] as const) {
      C.add(x, 0, z, ry, false);
      C.list[C.list.length - 1].pose = 'namaste';
    }
    for (let i = 0, tries = 0; i < 26 && tries < 400; tries++) {
      const west = C.rnd() < 0.55;
      const x = west ? -10.4 + C.rnd() * 3.4 : 2.2 + C.rnd() * 4.6, z = -15.6 + C.rnd() * (west ? 6.4 : 5.2);
      if (C.list.some((p) => Math.abs(p.x - x) < 0.7 && Math.abs(p.z - z) < 0.7)) continue;
      // (clear of the 60 pillars: 1.05 m across, on the 2.4 x 2.6 m grid)
      if ([-11, -8.6, -6.2, -3.8, -1.4, 1.4, 3.8, 6.2].some((px) => Math.abs(px - x) < 0.75) && [-9.6, -12.2, -14.8].some((pz) => Math.abs(pz - z) < 0.75)) continue;
      C.add(x, 0, z, Math.PI / 2 * (west ? 1 : -1) + (C.rnd() - 0.5) * 0.8, true);
      C.list[C.list.length - 1].pose = C.rnd() < 0.5 ? 'sitNamaste' : 'sit';
      i++;
    }
    // in the sanctum (its own crowd: the rest is hidden while you are inside): two devotees at the silver rail
    // beside your place, hands folded, and a pujari sitting on the right-hand ledge by the Jyotirlinga
    const CS = new CrowdSpots(71);
    for (const z of [-8.15, -8.8]) { CS.add(10.85, GARBHA.floor, z, Math.PI / 2, false); CS.list[CS.list.length - 1].pose = 'namaste'; }
    CS.add(12.55, GARBHA.floor + 0.36, -5.3, Math.PI, true, 'pujari');
    const crowdIn = buildCrowd(sanctum, CS.list, { kanwariyaShare: 0, lodDistance: 30 });
    const crowd = buildCrowd(complex, C.list, {
      clearPaths: [[[6, 11], [0, 9.5], [0, 7]]],
      clearRadius: 4,
      // along the -4 gallery the walk runs in its own railed lane, with the queue standing in the lanes beside it
      // and on the Jhoola pul pilgrims walk both ways along its sides, the middle of the deck left to you
      // (and along the lane under the covered walkway, people walk both ways at its sides)
      // (and in the hall the darshan queue stands single file in the stainless tunnel, beside your line)
      nearPaths: [[[36, 20.5], [11.5, 19.7], [3.2, 11.2], [6, 11]], [[JHOOLA.x, JHOOLA.z1], [JHOOLA.x, 23], [JHOOLA.x, 20], [62, 20], [36, 20.5]],
        [[0, 7], [0, 3.5], [0, -5.6], [GARBHA.x0, GARBHA.doorZ]]],
      nearRadius: 0.6, kanwariyaShare: 0, lodDistance: 30,
    });
    return {
      ...omkareshwarNav(),
      spawn: { feet: [JHOOLA.x - 0.3, JHOOLA.y, 73.5], look: [-6, 6, 8] },
      update(time) {
        t.flag.update(time);
        narmadaAarti.update(time);
        crowd.update(time);
        crowdIn.update(time);
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
        if (x > COURT_X0 && x < LANE.x1 + 1.5 && z > -1 && z < FRAME.front + 1) return 'darshan';
        return null;
      },
    };
  },
};

export default site;

import * as THREE from 'three';
import type { SiteDef } from '../types';
import { kashiMaterials } from './mats';
import { Offerings } from './shivling';
import { buildTemple, GARBHA, TEMPLE } from './temple';
import { buildParisar, PARISAR } from './parisar';
import { buildDham, CHOWK, DHAM_TREES, PLAZA } from './dham';
import { buildCrowd, CrowdSpots } from './crowd';
import { GHAT, WATER_O, ghatY, bankAt, bank } from './riverfront';
import { kashiNav } from './nav';
import { buildAhilya } from './ahilya';
import { buildGangaAarti } from './aarti';
import { buildVip } from './vip';

/**
 * Shri Kashi Vishwanath, Varanasi: Ahilyabai Holkar's temple (1780) with Ranjit Singh's gilded
 * shikhara and dome (1835), inside the Kashi Vishwanath Dham (2021) that opens it to the Ganga.
 * +z = east (chowk, Ganga), +x = north (Gyanvapi). Units: metres.
 */
const site: SiteDef = {
  id: 'kashi-vishwanath',
  name: { en: 'Kashi Vishwanath', hi: 'काशी विश्वनाथ' },
  lon: 83.0107,
  lat: 25.3109,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['उत्तर प्रदेश', 'Uttar Pradesh', 'the Gangetic plain'],
    3: ['वाराणसी · काशी', 'Varanasi · Kashi', 'on the banks of the Ganga'],
  },
  zones: {
    parisar: ['मंदिर परिसर', 'Mandir Parisar', 'the marble court of Baba Vishwanath'],
    temple: ['श्री काशी विश्वनाथ मंदिर', 'Shri Kashi Vishwanath Mandir', 'Ahilyabai Holkar · 1780 · gold of Ranjit Singh, 1835'],
    garbhagriha: ['श्री विश्वेश्वर', 'Vishweshwara Jyotirlinga', 'the gold-clad garbhagriha'],
    gyanvapi: ['ज्ञानवापी', 'Gyanvapi', 'the well of wisdom · Nandi'],
    chowk: ['मंदिर चौक', 'Mandir Chowk', 'Shri Kashi Vishwanath Dham'],
    ganga: ['गंगा द्वार', 'Ganga Dwar', 'Lalita Ghat · Maa Ganga'],
  },
  trees: DHAM_TREES,
  // hazy Gangetic morning: cool grey-blue distance haze over the river
  // (the old city fades into it from ≈ 100 m, so it reads as a hazy mass, not a field of cubes)
  fog: { color: 0xc9cdcf, near: 90, far: 760 },
  hdri: 'assets/hdri/kloofendal_38d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: a hazy morning sky over the Ganga
  // morning sun from the south-east, over the Ganga: it lights the temple's east face and the gold
  // from the spawn and the chowk, and stays out of the frame looking south-west across the court
  sunAzimuth: -0.85,
  sunElevationMin: 50,
  build({ root, M, P, flames, sunDir, renderer, pending, interiorEnv }) {
    const K = kashiMaterials(M, renderer, pending, interiorEnv);
    // a warm floor in the stone spire's shade, so it stays pale buff rather than chocolate
    K.spireStone.emissive.set(0x30271c);
    const O = new Offerings(11);
    const t = buildTemple(root, K, P, flames, O);
    const parisar = buildParisar(root, K, P, flames, O).group;
    const { water, group: dham, river } = buildDham(root, K, P, flames, sunDir, O);
    buildVip(parisar, dham, river, K, P); // Gate No. 4 (Sugam Darshan) and its lane, security at the gates, the escalators
    pending.push(buildAhilya(dham, K, P)); // Ahilyabai Holkar's statue on the terrace beyond the chowk

    // ---- pilgrims (one BatchedMesh + one blob mesh; no colliders, no shadows), as on any morning
    const C = new CrowdSpots(41);
    buildGangaAarti(river, K, P, flames, O, C); // the aarti priests on the ghat's lower landing, and those watching
    O.flush(root);
    const solidAt = (x: number, z: number, y = 0.2) => P.solids.some((b) => x > b.min.x - 0.35 && x < b.max.x + 0.35 && z > b.min.z - 0.35 && z < b.max.z + 0.35 && y + 0.3 > b.min.y && y < b.max.y);
    const onJagati = (x: number, z: number) => x > TEMPLE.x0 - 3.4 && x < TEMPLE.x1 + 3.4 && Math.abs(z) < TEMPLE.z1 + 3.4;
    const busy = (x: number, z: number) => solidAt(x, z) || onJagati(x, z);
    // the darshan queue in its lanes along the temple's east and west faces: out along the outer lane, back along
    // the inner one to the steps (two abreast)
    for (const s of [1, -1]) {
      C.queue(new THREE.Vector3(s > 0 ? -2.9 : -1.7, 0, s * 8.3), new THREE.Vector3(-12.4, 0, s * 8.3), 0.62, 2);
      C.queue(new THREE.Vector3(-12.4, 0, s * 7.0), new THREE.Vector3(s > 0 ? -2.6 : -1.4, 0, s * 7.0), 0.62, 2);
    }
    // the west gate's line (the Dhundhiraj route) in its lane across the west court to the jagati's west steps
    C.queue(new THREE.Vector3(0, 0, -11.8), new THREE.Vector3(0, 0, -8.4), 0.7, 1);
    C.queue(new THREE.Vector3(0, 0, -18.6), new THREE.Vector3(0, 0, -14.6), 0.7, 1);
    // the Sugam Darshan line from Gate No. 4: along the lane by the Gyanvapi, and inside round the mandap
    C.queue(new THREE.Vector3(35.2, 0, 15.5), new THREE.Vector3(35.2, 0, 6.5), 0.7, 1);
    C.queue(new THREE.Vector3(24.8, 0, 5.2), new THREE.Vector3(24.8, 0, 6.6), 0.7, 1);
    C.queue(new THREE.Vector3(23.6, 0, 7.0), new THREE.Vector3(17.4, 0, 7.0), 0.7, 1);
    C.queue(new THREE.Vector3(13.2, 0, 7.0), new THREE.Vector3(6.6, 0, 7.0), 0.7, 1);
    // the lines at the garbhagriha's four doors, as the trust runs them: each entry route has its own door
    {
      const J = TEMPLE.floor;
      const line = (pts: [number, number, number][]) => {
        for (let i = 0; i < pts.length; i++) {
          const [x, y, z] = pts[i], [nx, , nz] = pts[Math.min(i + 1, pts.length - 1)];
          const ry = i < pts.length - 1 ? Math.atan2(nx - x, nz - z) : Math.atan2(-x, -z); // the head of the line faces the linga
          C.add(x, y, z, ry);
          const h = (i * 7 + C.list.length) % 10;
          C.list[C.list.length - 1].queue = h < 4 ? 'namaste' : h < 7 ? 'thali' : 'stand';
        }
      };
      // east door (the Ganga Dwar route): on from the court's southern lane, up the steps, under the verandah
      line([[-2.4, 0, 6.6], [-2.75, J, 5.9], [-2.85, J, 5.1], [-2.3, J, 4.4], [-1.6, J, 3.9], [-0.9, J, 3.5]]);
      // north door (from the Gyanvapi side): single file in its railed lane along the jagati's north strip
      line([[4.4, J, 4.6], [4.4, J, 4.0], [4.4, J, 3.4], [4.4, J, 2.8], [4.4, J, 2.2], [4.4, J, 1.6], [4.35, J, 1.0], [4.05, J, 0.45], [3.6, J, 0.15]]);
      // south door: through the Sabha Mandap
      line([[-6.0, J, 0.25], [-5.4, J, 0.2], [-4.8, J, 0.15], [-4.2, J, 0.1], [-3.6, J, 0.05]]);
      // west door: the Sugam Darshan line, on up the west steps
      line([[-0.4, J, -5.4], [-0.4, J, -4.8], [-0.4, J, -4.2], [-0.4, J, -3.6]]);
      // in the garbhagriha: two priests sitting on the carpets by the basin, devotees bowing over its rim
      for (const z of [-0.5, 0.7]) C.add(-1.5, J, z, Math.PI / 2, true, 'kanwariya');
      for (const [x, z, pose] of [[-0.85, 1.4, 'namaste'], [-0.85, -1.4, 'thali'], [-1.25, 1.55, 'stand']] as const) {
        C.add(x, J, z, Math.atan2(-x, -z));
        C.list[C.list.length - 1].pose = pose;
      }
    }
    // round the jagati: pilgrims circling the temple, standing before the walls, sitting at the edge
    // (clear of the queue lanes along the east and west faces)
    const lanes = (x: number, z: number) => busy(x, z) || (x > -13.4 && x < -0.6 && Math.abs(z) > 6.1 && Math.abs(z) < 9.4);
    C.scatter(TEMPLE.x0 - 7, TEMPLE.x1 + 1, -12.5, -6.6, 0, 46, Math.PI / 2, 0.15, lanes);
    C.scatter(TEMPLE.x0 - 7, -6, 6.6, 12.5, 0, 30, -Math.PI / 2, 0.15, lanes);
    C.scatter(TEMPLE.x0 - 8, TEMPLE.x0 - 3.6, -6, 6, 0, 18, Math.PI / 2, 0.2, busy);
    // the court at large (north toward Gyanvapi, south among the shrines)
    C.scatter(PARISAR.x0 + 7, PARISAR.x1 - 7, PARISAR.z0 + 7, PARISAR.z1 - 7, 0, 90, Math.PI, 0.1, busy);
    // the Mandir Chowk: groups along both sides of the axis, under the tents, by the galleries
    C.scatter(CHOWK.x0 + 13, CHOWK.x1 - 13, CHOWK.z0 + 5, CHOWK.z1 - 6, 0, 110, Math.PI, 0.12, (x, z) => solidAt(x, z));
    // the Ganga Dwar plaza and the top of the ghat steps
    C.scatter(-36, 36, PLAZA.z0 + 2, PLAZA.z1 - 0.8, PLAZA.y, 50, 0, 0.2, (x, z) => solidAt(x, z, PLAZA.y));
    // on the ghat steps: bathers and pilgrims standing and sitting on the treads, facing the Ganga,
    // thickest near the Dham and thinning along the curving bank
    for (let i = 0, tries = 0; i < 170 && tries < 4000; tries++) {
      const far = i >= 120, near = i < 75;
      const x = far ? (C.rnd() < 0.5 ? -1 : 1) * (GHAT.XS + 4 + C.rnd() * 160)
        : (C.rnd() - 0.5) * 2 * (near ? 32 : GHAT.XS - 6);
      const o = 0.3 + C.rnd() * (WATER_O - 0.2);
      const y = ghatY(o);
      const [px, pz] = bankAt(x, o);
      if (!far && solidAt(px, pz, y)) continue;
      if (C.list.some((p) => Math.abs(p.x - px) < 0.6 && Math.abs(p.z - pz) < 0.6)) continue;
      C.add(px, y, pz, (C.rnd() - 0.5) * 0.8 + bank(x).ry, C.rnd() < 0.45);
      i++;
    }
    const crowd = buildCrowd(root, C.list, {
      clearRadius: 4,
      kanwariyaShare: 0.12,
      lodDistance: 14,
      clearPaths: [
        [[5, 21], [4.5, 10]], // the court toward the east door (the last steps are kept clear only close by: nearPaths)
        [[0, 42], [0, 30], [0, 21], [5, 21]], // the spawn in the chowk, through the Parisar's east gate
        [[0, 169], [0, 150], [0, 100], [0, 30]], // the axis from the water up the ghat, through the Ganga Dwar and the chowk
        [[14, 16]], [[-12, -20]], // the usual NE / SW viewpoints across the court
      ],
      // the last steps to the east door and the linga, walked beside the door queues and past the people inside
      nearPaths: [[[4.5, 10], [4, 7], [0, 7], [0, 0]]],
      nearRadius: 0.8,
    });
    // Camera-driven culling (also holds for fixed viewpoints): the river front and its mirror only
    // render near the river; inside the garbhagriha the Dham, the city and the trees are not drawn.
    const known = new Set<THREE.Object3D>(root.children);
    const probe = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    probe.frustumCulled = false;
    // the gold shikhara and dome (≈ 1/3 M tris per pass) can't be seen from inside the garbhagriha
    const hideInSanctum: THREE.Object3D[] = [];
    t.group.traverse((o) => { if (o.name === 'gold') hideInSanctum.push(o); });
    probe.renderOrder = -1000;
    let lastSanctum: boolean | null = null, lastRiver: boolean | null = null, lastNear: boolean | null = null, lastBelow: boolean | null = null;
    const sanctumSmall: THREE.Object3D[] = [];
    const fwd = new THREE.Vector3();
    t.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name === 'garbhagriha' && m.material !== K.goldIn && m.material !== K.goldPlain && m.material !== K.goldCeil) sanctumSmall.push(m);
    });
    probe.onBeforeRender = (_r, _s, cam) => {
      if ((cam as THREE.OrthographicCamera).isOrthographicCamera) return; // shadow passes
      const p = cam.position;
      const inSanctum = Math.abs(p.x) < 2.1 && Math.abs(p.z) < 2.1 && p.y > 0.6 && p.y < 4.3;
      // (the river front shows from the chowk's eastern gateway, and down the axis from the court and the chowk
      // whenever one faces east: otherwise the Ganga Dwar and the river pop in at the gateway)
      cam.getWorldDirection(fwd);
      const nearRiver = !inSanctum && (p.z > 85 || p.y > 18 || (p.z > 0 && Math.abs(p.x) < 45 && fwd.z > 0.15)); // (or seen from high above)
      if (inSanctum !== lastSanctum) {
        lastSanctum = inSanctum;
        dham.visible = !inSanctum;
        for (const m of hideInSanctum) m.visible = !inSanctum;
        for (const c of root.children) if (!known.has(c)) c.visible = !inSanctum; // trees (added by the world)
      }
      // the garbhagriha's small fittings (basin, pitha, chhatra, lamps, prasad) only within 14 m
      const nearSanctum = p.x * p.x + p.z * p.z < 196 && p.y < 8;
      if (nearSanctum !== lastNear) { lastNear = nearSanctum; for (const m of sanctumSmall) m.visible = nearSanctum; }
      if (nearRiver !== lastRiver) { lastRiver = nearRiver; river.visible = nearRiver; }
      // down on the plaza, the ghats or the river the temple court is hidden behind the Dham's galleries
      const belowDham = p.z > 120 && p.y < -3;
      if (belowDham !== lastBelow) { lastBelow = belowDham; t.group.visible = parisar.visible = !belowDham; }
    };
    root.add(probe);
    known.add(probe);
    river.visible = false;
    // the Ganga's mirror pass: the temple court lies behind the Dham's galleries and the Ganga Dwar as
    // seen in the river, so it (and the old city behind) is left out of the reflection render
    {
      const mirrorHide: THREE.Object3D[] = [t.group, parisar];
      dham.traverse((o) => { if (o.name === 'old-city' || o.name === 'city-trees') mirrorHide.push(o); });
      const orig = water.onBeforeRender.bind(water);
      water.onBeforeRender = (...args: Parameters<typeof orig>) => {
        const vis = mirrorHide.map((o) => o.visible);
        for (const o of mirrorHide) o.visible = false;
        orig(...args);
        mirrorHide.forEach((o, i) => { o.visible = vis[i]; });
      };
    }
    for (const [x, z] of DHAM_TREES) {
      if (z < PARISAR.z1) P.solid(x - 0.45, 0, z - 0.45, x + 0.45, 6, z + 0.45);
    }
    const { half } = GARBHA;
    return {
      ...kashiNav(), // Places (engine/travel.ts): the walking graph
      // in the Mandir Chowk outside the Parisar's east gate, the gold shikhara framed in it: the pilgrim walks in
      // through the gate (the Dham's river entrance, the Ganga Dwar, is behind, down the chowk)
      spawn: { feet: [0, 0, 42], look: [0, 10, 0] },
      update(time) {
        t.flag.update(time);
        crowd.update(time);
        water.material.uniforms.time.value = time * 0.5;
      },
      setSun(dir: THREE.Vector3) {
        water.material.uniforms.sunDirection.value.copy(dir);
      },
      zoneAt({ x, y, z }) {
        if (y > 0.3 && Math.abs(x) < half && Math.abs(z) < half) return 'garbhagriha';
        if (y > 0.3 && x > TEMPLE.x0 - 2.6 && x < TEMPLE.x1 + 2.6 && Math.abs(z) < TEMPLE.z1 + 2.5) return 'temple';
        if (x > 15 && x < 24.5 && Math.abs(z) < 5.6) return 'gyanvapi';
        if (x > PARISAR.x0 && x < PARISAR.x1 && z > PARISAR.z0 && z < PARISAR.z1) return 'parisar';
        if (z >= PARISAR.z1 && z < CHOWK.z1 && x > CHOWK.x0 && x < CHOWK.x1) return 'chowk';
        if (z >= CHOWK.z1 && y < -0.5) return 'ganga';
        return null;
      },
    };
  },
};

export default site;

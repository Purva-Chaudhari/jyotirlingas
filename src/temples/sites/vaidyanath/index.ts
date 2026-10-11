import * as THREE from 'three';
import type { SiteDef } from '../types';
import { vaidyanathMats } from './mats';
import { Merger } from './merge';
import { Offerings } from './offerings';
import { buildSanctum, SANCTUM } from './sanctum';
import { buildMainTemple, MAIN } from './temple';
import { buildComplex, COURT, PARVATI } from './complex';
import { buildTown, LANE, NEAR_TREES } from './town';
import { lightZones } from './optimize';
import { buildCrowd, CrowdSpots } from './crowd';
import { vaidyaNav } from './nav';

/**
 * Baba Baidyanath Dham, Deoghar (Jharkhand) — the Vaidyanath Jyotirlinga ("Ravaneshwar"), one of
 * the twelve (Parli Vaijnath in Maharashtra is also revered as Vaidyanath; this is Deoghar).
 * The east-facing main temple in a walled courtyard of ~22 temples, tied to Maa Parvati's by the
 * red threads of the gathbandhan; Deoghar's lanes press against the walls.
 * +z = east (Singh Dwar and the approach lane), +x = north. Units: metres.
 */
const site: SiteDef = {
  id: 'vaidyanath',
  name: { en: 'Vaidyanath', hi: 'वैद्यनाथ' },
  lon: 86.7000,
  lat: 24.4925,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['संथाल परगना', 'Santhal Pargana', 'Jharkhand'],
    3: ['देवघर', 'Deoghar', 'Baba Baidyanath Dham'],
  },
  zones: {
    lane: ['बाबा धाम की गली', 'The Lane to Baba Dham', 'pera, kanwar and Gangajal from Sultanganj'],
    prangan: ['मंदिर प्रांगण', 'Mandir Prangan', 'twenty-two temples within the walls'],
    temple: ['बाबा बैद्यनाथ मंदिर', 'Baba Baidyanath Mandir', 'Panchshool on the shikhara · 72 ft'],
    garbhagriha: ['श्री वैद्यनाथ ज्योतिर्लिंग', 'Shri Vaidyanath Jyotirlinga', 'Ravaneshwar · also revered at Parli Vaijnath'],
    parvati: ['माँ पार्वती मंदिर', 'Maa Parvati Mandir', 'bound to Baba by the gathbandhan'],
  },
  trees: NEAR_TREES,
  // monsoon (Shravani Mela) haze over the Santhal Pargana plain
  fog: { color: 0xc4c3bf, near: 120, far: 420 },
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: cloudy sky, as in the photographs
  sunColor: 0xffe6c8,
  sunIntensity: 2.8,
  sunAzimuth: -0.6, // morning sun from the south-east, lighting the east front
  build({ root, M, P, flames, renderer, pending, interiorEnv, setBloom }) {
    const V = vaidyanathMats(M, renderer, pending, interiorEnv);
    const O = new Offerings(17);
    const B = new Merger(P, 'baba-dham');
    const Bin = new Merger(P, 'garbhagriha');
    const Btown = new Merger(P, 'deoghar');

    const sanctum = buildSanctum(root, Bin, V, P, flames, O);
    const main = buildMainTemple(root, B, V, P, flames, O);
    buildComplex(root, B, V, P, flames, O);
    buildTown(root, Btown, V, P, flames, O);

    // ---- pilgrims (one BatchedMesh + one merged blob mesh; no colliders, no shadows)
    const C = new CrowdSpots(77);
    const solidAt = (x: number, z: number, y = 0.5) => P.solids.some((bx) => x > bx.min.x - 0.35 && x < bx.max.x + 0.35 && z > bx.min.z - 0.35 && z < bx.max.z + 0.35 && y + 0.3 > bx.min.y && y < bx.max.y);
    // the approach lane behind the spawn, all heading for the Singh Dwar
    C.scatter(-3.0, 3.0, 56.5, 80, 0, 46, Math.PI, 0, (x, z) => solidAt(x, z));
    // the queue: the straight lane fills where it is clear of your path, the serpentine double file
    C.queue(new THREE.Vector3(-0.8, 0, 39.5), new THREE.Vector3(-0.8, 0, 12.6), 0.6);
    C.queue(new THREE.Vector3(0.8, 0, 29.6), new THREE.Vector3(0.8, 0, 12.6), 0.6);
    for (let k = 0; k < 3; k++) {
      const x = 3.6 + k * 2.3 + 1.15;
      C.queue(new THREE.Vector3(x, 0, k % 2 ? 25.4 : 34.2), new THREE.Vector3(x, 0, k % 2 ? 34.2 : 25.4), 0.6, 2);
    }
    // the porch corners, pressing toward the door; sitting on the ends of the steps
    C.scatter(-6.5, -1.2, 6.3, 10.5, MAIN.F, 20, Math.PI, 0.25, (x, z) => solidAt(x, z, MAIN.F));
    C.scatter(1.2, 6.5, 6.3, 10.5, MAIN.F, 20, Math.PI, 0.25, (x, z) => solidAt(x, z, MAIN.F));
    for (const x of [-6.0, -5.3, 5.3, 6.0]) C.add(x, 0.3, 11.65, Math.PI * (C.rnd() - 0.5) * 0.4, true);
    // round Maa Parvati: knots on both flanks of her porch
    C.scatter(8.5, 18, 24.4, 27.5, 0, 24, Math.PI, 0.15, (x, z) => solidAt(x, z));
    C.scatter(8.5, 18, 11.8, 15.6, 0, 20, 0, 0.15, (x, z) => solidAt(x, z));
    // the court at large, kept off shrines and rails
    C.scatter(-27, 27, -24, 36, 0, 340, Math.PI * 0.5, 0.12, (x, z) => solidAt(x, z));
    // sitting along the verandah plinths
    C.scatter(-27, 27, -24.3, -23.4, 0.3, 16, 0, 0.9, (x, z) => solidAt(x, z, 0.3));
    C.scatter(-27.4, -26.6, -20, 30, 0.3, 14, Math.PI / 2, 0.9, (x, z) => solidAt(x, z, 0.3));
    C.scatter(26.6, 27.4, -20, 30, 0.3, 14, -Math.PI / 2, 0.9, (x, z) => solidAt(x, z, 0.3));
    // nobody within 4 m of where you spawn or walk (spawn, the queue lane, porch, sanctum, the circuit
    // round Baba's temple and the way to Maa Parvati)
    const crowd = buildCrowd(root, C.list, {
      clearRadius: 4,
      clearPaths: [
        [[0, 52], [0, 41], [0, 20], [0, 12.4], [0, 8], [0, 5], [0, 2], [0, -1.3]],
        [[1.6, 1.0], [1.6, -1.3], [-1.4, -1.3], [-1.4, 1.0], [0, 1.6]],
        [[0, 8], [-3, 8], [-6.6, 7.9], [-8.3, 7.9], [-8.3, -6.75], [9.6, -6.75], [9.6, 10.3], [8.4, 10.9], [8.4, 12.6], [5, 12.6], [5, 15], [7.2, 19.5], [9.6, 20]],
      ],
    });

    B.flush(root, true);
    Bin.flush(root, false);
    Btown.flush(root, true);
    O.flush(root);

    // interior lamp-light only while inside the passage / sanctum; the door glow only from outside
    const { half, core, doorW, F } = SANCTUM;
    lightZones(root, sanctum.lights, [main.doorGlow], (p) =>
      (Math.abs(p.x) < core && Math.abs(p.z) < core && p.y > F) || (Math.abs(p.x) < doorW + 0.2 && p.z >= half - 0.5 && p.z < MAIN.half + 0.3 && p.y > F));

    // and from outside, the sanctum interior only shows through its door: draw it only while the
    // camera is on the plinth or on the axis in front of the door (saves ~30 draws in the court/lane)
    {
      const sanctumMeshes: THREE.Object3D[] = [];
      root.traverse((o) => { if (o.name === 'garbhagriha') sanctumMeshes.push(o); });
      const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      probe.frustumCulled = false;
      let shown: boolean | null = null;
      probe.onBeforeRender = (_r, _s, cam) => {
        const p = cam.position, pl = MAIN.plinth;
        const on = p.x > pl.x0 - 1 && p.x < pl.x1 + 1 && p.z > pl.z0 - 1 && p.z < 26 && (p.z < pl.z1 + 1 || Math.abs(p.x) < 6);
        if (on !== shown) { shown = on; for (const m of sanctumMeshes) m.visible = on; }
      };
      root.add(probe);
    }

    // from inside the stone sanctum the town can't be seen: drop it from every pass while there
    const townMeshes: THREE.Object3D[] = [];
    root.traverse((o) => { if (o.name === 'deoghar' || o.name === 'deoghar-far') townMeshes.push(o); });
    return {
      ...vaidyaNav(), // Places (engine/travel.ts): the walking graph
      update(t: number) { crowd.update(t); },
      onZoneChange(zone) {
        const show = zone !== 'garbhagriha';
        for (const m of townMeshes) m.visible = show;
        // the wet floor's lamp glints must stay glints, not floating orbs
        setBloom(show ? null : 0.18);
      },
      spawn: { feet: [0, 0, 52], look: [0, 11, 0] },
      zoneAt({ x, y, z }) {
        if (y > F - 0.1 && Math.abs(x) < half + 0.05 && Math.abs(z) < half + 0.05) return 'garbhagriha';
        const pl = MAIN.plinth;
        if (y > F - 0.1 && x > pl.x0 && x < pl.x1 && z > pl.z0 && z < pl.z1) return 'temple';
        if (z > COURT.z1 + 0.6 && z < LANE.z1) return 'lane';
        if (Math.abs(x - PARVATI.x) < 8.5 && Math.abs(z - PARVATI.z) < 5.5) return 'parvati';
        if (x > COURT.x0 && x < COURT.x1 && z > COURT.z0 && z < COURT.z1) return 'prangan';
        return null;
      },
    };
  },
};

export default site;

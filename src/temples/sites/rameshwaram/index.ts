import * as THREE from 'three';
import type { SiteDef } from '../types';
import { rameshMats } from './mats';
import { buildCorridors } from './corridor';
import { buildPrecinct } from './precinct';
import { buildInner } from './inner';
import { buildSanctum } from './sanctum';
import { buildTown } from './town';
import { lightZones, followSun } from './optimize';
import { ARM, RING, PRAK1, PRAK2, RAJA, GARBHA, VISHWA, AMMAN, WELLS, STREET, BEACH, OUTER, NANDI, EAST_CAR } from './layout';
import { rameshwaramNav } from './nav';

/**
 * Shri Ramanathaswamy Temple, Rameswaram island (Tamil Nadu): the southernmost Jyotirlinga, where
 * Rama worshipped Shiva as the Ramalingam that Sita shaped from sand, beside the Vishwalingam that
 * Hanuman brought from Kailash. Dravidian, 12th–18th c.: the nine-tiered Rajagopuram, the high
 * granite enclosure, the world's longest temple corridors (third prakara, 1,212 pillars), the
 * 22 theertham wells, Agni Theertham on the sea at the east gate.
 * +z = east (the street, Agni Theertham, the Gulf of Mannar), +x = north. Metres; origin = the
 * Ramalingam's garbhagriha.
 */

const inArm = (x: number, z: number) => {
  const { xN, xS, zW, zE } = RING, W = ARM.wall;
  if (Math.abs(x - xN) < W && z > zW - W && z < zE + W) return true;
  if (Math.abs(x - xS) < W && z > zW - W && z < zE + W) return true;
  if ((Math.abs(z - zE) < W || Math.abs(z - zW) < W) && x > xS && x < xN) return true;
  if (Math.abs(x) < W && z > OUTER.z0 + 13 && z < PRAK2.z0) return true; // Chokkattan / Sethu corridor
  if (Math.abs(z) < W && (x > xN || x < xS) && x < OUTER.x1 - 12 && x > OUTER.x0 + 12) return true;
  return false;
};

const site: SiteDef = {
  id: 'rameshwaram',
  name: { en: 'Ramanathaswamy', hi: 'रामनाथस्वामी' },
  lon: 79.3174,
  lat: 9.2881,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['तमिलनाडु', 'Tamil Nadu', 'the southern coast'],
    3: ['रामेश्वरम्', 'Rameswaram', 'an island in the Gulf of Mannar'],
  },
  zones: {
    agni: ['अग्नि तीर्थम्', 'Agni Theertham', 'அக்னி தீர்த்தம் · the sea at the temple’s door'],
    veedhi: ['सन्निधि वीथि', 'Sannidhi Street', 'சன்னதி தெரு · from the sea to the Rajagopuram'],
    gopuram: ['राजगोपुरम्', 'Rajagopuram', 'கிழக்கு ராஜகோபுரம் · the nine-tiered east gate'],
    corridor: ['तृतीय प्राकारम्', 'The Third Corridor', 'சொக்கட்டான் மண்டபம் · 1,212 pillars, the longest in India'],
    theertham: ['तीर्थ कूप', 'The Theertham Wells', 'இருபத்திரண்டு தீர்த்தங்கள் · twenty-two holy wells'],
    nandi: ['नन्दी मण्डपम्', 'Nandi Mandapam', 'நந்தி மண்டபம் · the great Nandi and the golden flagstaff'],
    sannidhi: ['रामनाथ सन्निधि', 'Ramanatha Sannidhi', 'the maha mandapam before the sanctum'],
    garbhagriha: ['श्री रामनाथस्वामी', 'Ramalingam · Jyotirlinga', 'shaped of sand by Sita, worshipped by Rama'],
    vishwanatha: ['श्री काशी विश्वनाथ', 'Vishwalingam', 'brought by Hanuman from Kailash · worshipped first'],
    amman: ['श्री पर्वतवर्धिनी', 'Parvathavardhini Amman', 'பர்வதவர்த்தினி அம்மன் சன்னதி'],
    rathaveedhi: ['रथ वीथि', 'Ratha Veedhi', 'தேரோடும் வீதி · the car streets round the temple'],
  },
  // a few neem trees in the open courts of the third prakara
  trees: [[82, -62, 9], [80, 58, 8], [-86, -64, 9], [-84, 64, 8], [42, -116, 10], [-48, -120, 9]],
  hdri: 'assets/hdri/overcast_soil_puresky_2k.hdr', // Poly Haven, CC0: a grey monsoon sky
  // humid coastal haze, pale and slightly blue
  fog: { color: 0xb9c0c4, near: 200, far: 1500 },
  sunColor: 0xfff0dc,
  sunIntensity: 2.4,
  // morning sun from the east-south-east, over the sea: it lights the Rajagopuram's face and the street
  sunAzimuth: Math.atan2(-0.4, 1),
  far: 4000,
  build({ root, M, P, flames, sunDir, pending, interiorEnv, renderer }) {
    const R = rameshMats(M, pending, interiorEnv, renderer);
    buildPrecinct(root, R, P);
    const corr = buildCorridors(root, R, P);
    // four tube-light pools follow the pilgrim down the corridor: the nearest tubes become real lights
    // (a constant light count: outside the corridor they simply go dark, so no shaders recompile)
    const pool = [0, 1, 2, 3].map(() => {
      const l = new THREE.PointLight(0xf4f6ff, 0, 16, 2);
      root.add(l);
      return l;
    });
    const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    probe.frustumCulled = false;
    const near: { d: number; i: number }[] = corr.tubes.map((_, i) => ({ d: 0, i }));
    probe.onBeforeRender = (_r, _s, cam) => {
      const p = cam.position;
      if (!inArm(p.x, p.z)) { for (const l of pool) l.intensity = 0; return; }
      for (const n of near) { const t = corr.tubes[n.i]; n.d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2; }
      near.sort((a, b) => a.d - b.d);
      pool.forEach((l, k) => { l.position.copy(corr.tubes[near[k].i]).add(new THREE.Vector3(0, -0.5, 0)); l.intensity = 6; });
    };
    root.add(probe);
    buildInner(root, R, P, flames);
    const s = buildSanctum(root, R, P, flames);
    const town = buildTown(root, R, P, flames, sunDir);
    // interior lamps only while the camera is in the shrines
    lightZones(s.group, s.lights, (p) =>
      (p.x > PRAK1.x0 && p.x < PRAK1.x1 && p.z > PRAK1.z0 && p.z < PRAK1.z1) ||
      (p.x > AMMAN.x0 && p.x < AMMAN.x1 && p.z > AMMAN.z0 && p.z < AMMAN.z1));
    // the sun's shadow follows the pilgrim
    const sun = root.parent?.children.find((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight | undefined;
    const dir = sunDir.clone().normalize();
    if (sun) followSun(s.group, sun, () => dir);
    return {
      ...rameshwaramNav(), // Places (engine/travel.ts): the walking graph
      spawn: { feet: [0, 0, BEACH.z0 + 0.6], look: [0, 18, RAJA.z] },
      update(t) {
        town.water.material.uniforms.time.value = t * 0.5;
        town.update(t);
      },
      setSun(d: THREE.Vector3) {
        dir.copy(d).normalize();
        town.water.material.uniforms.sunDirection.value.copy(d);
      },
      zoneAt({ x, y, z }) {
        if (Math.abs(x) < GARBHA.inner + 0.3 && z < GARBHA.half && z > -GARBHA.inner && y > 0.6) return 'garbhagriha';
        if (Math.hypot(x - VISHWA.x, z - VISHWA.z) < VISHWA.half + 3.4 && y > 0.6) return 'vishwanatha';
        if (x > AMMAN.x0 && x < AMMAN.x1 && z > AMMAN.z0 && z < AMMAN.z1) return 'amman';
        if (x > PRAK1.x0 && x < PRAK1.x1 && z > PRAK1.z0 && z < PRAK1.z1) return 'sannidhi';
        if (x > WELLS.x0 && x < WELLS.x1 && z > 35 && z < WELLS.z1) return 'theertham';
        if (x > PRAK2.x0 && x < -RAJA.w / 2 && z > PRAK2.z1 + 1 && z < RING.zE - ARM.wall) return 'theertham';
        if (Math.abs(x) < 14 && z > PRAK1.z1 && z < PRAK2.z1 + 1 && z < NANDI.z + 32) return 'nandi';
        if (Math.abs(x) < RAJA.w / 2 && z > RAJA.z - RAJA.d / 2 - 1 && z < RAJA.z + RAJA.d / 2) return 'gopuram';
        if (inArm(x, z)) return 'corridor';
        if (Math.abs(x) < 26 && z >= OUTER.z1 - 2 && z < OUTER.z1 + 12) return 'gopuram';
        if (z > BEACH.z0 - 6) return 'agni';
        // the four Ratha Veedhis (car streets) round the outer wall
        if ((x > OUTER.x1 && x < OUTER.x1 + 16) || (x < OUTER.x0 && x > OUTER.x0 - 16) || (z < OUTER.z0 && z > OUTER.z0 - 16)) return 'rathaveedhi';
        if (Math.abs(z - EAST_CAR.z) < EAST_CAR.hw + 2 && Math.abs(x) < 130) return 'rathaveedhi';
        if (Math.abs(x) < STREET.hw + 4 && z > OUTER.z1 && z < BEACH.z0) return 'veedhi';
        return null;
      },
    };
  },
};

export default site;

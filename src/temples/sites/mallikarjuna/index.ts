import * as THREE from 'three';
import type { SiteDef } from '../types';
import { srisailamMaterials } from './mats';
import { Merger, lightZones } from './merge';
import { Offerings } from './offerings';
import { nandiGeo } from './nandi';
import { buildPrakara } from './prakara';
import { buildTemple } from './temple';
import { buildSanctum } from './sanctum';
import { buildBhramaramba, BHRAM } from './bhramaramba';
import { buildCourt, TREES, GUNDAM } from './court';
import { buildSetting } from './setting';
import { buildFurnish, MORE_TREES } from './furnish';
import { buildDecals } from './decals';
import { buildLife } from './life';
import { leafTrees } from './trees';
import { buildTerrain, scatterTrees } from './terrain';
import { SHRINE, NANDI_M, INNER, TERRACE, WALL, GOPURAMS, SPAWN } from './layout';
import { mallikarjunaNav } from './nav';

/**
 * Shri Bhramaramba Mallikarjuna Swamy Varla Devasthanam, Srisailam, Nandyal district, Andhra Pradesh —
 * 16.0741 N, 78.868 E, ~450 m, on the Nallamala plateau above the Krishna. Second of the twelve
 * Jyotirlingas and one of the Shakti Peethas. Units metres; origin = the Jyotirlinga at court level;
 * +x = east (the main gopuram and the town street), −z = north. See layout.ts for the plan.
 */
const site: SiteDef = {
  id: 'mallikarjuna',
  name: { en: 'Mallikarjuna', hi: 'मल्लिकार्जुन' },
  lon: 78.8682,
  lat: 16.0741,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['नल्लमला', 'Nallamala hills', 'Andhra Pradesh'],
    3: ['श्रीशैलम्', 'Srisailam', 'above the Krishna'],
  },
  zones: {
    courtyard: ['श्रीशैलम्', 'Srisailam', 'the temple street · Nallamala hills, above the Krishna'],
    gopuram: ['राजगोपुरम्', 'Rajagopuram', 'the east gate of the prakara'],
    shivaji: ['शिवाजी गोपुरम्', 'Shivaji Gopuram', 'the north gate · Chhatrapati Shivaji, 1677'],
    gopuramS: ['दक्षिण गोपुरम्', 'South Gopuram', 'Vijayanagara gate'],
    gopuramW: ['पश्चिम गोपुरम्', 'West Gopuram', 'behind the Devi’s shrine'],
    prakara: ['प्राकार', 'Prakara', 'carved walls — elephants, horsemen, hunters, Shiva’s lilas'],
    court: ['श्री मल्लिकार्जुन स्वामी मंदिर', 'Mallikarjuna Swamy Mandir', 'Jyotirlinga · Shakti Peetha'],
    nandi: ['नंदी मंडप', 'Nandi Mandapa', 'Nandi faces the sanctum'],
    mandapa: ['मुख मंडप', 'Mukha Mandapa', 'Vijayanagara pillars · Harihara II, 1405'],
    garbhagriha: ['श्री मल्लिकार्जुन', 'Mallikarjuna Jyotirlinga', 'swayambhu · sparsha darshan'],
    bhramaramba: ['श्री भ्रमराम्बा देवी', 'Bhramaramba Devi', 'Shakti Peetha · on the western terrace'],
    gundam: ['मल्लिका गुंडम', 'Mallika Gundam', 'the sacred tank'],
  },
  trees: [...TREES, ...MORE_TREES],
  hdri: 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', // Poly Haven, CC0: bright post-monsoon sky
  // mid-morning sun from the south-east: rakes the east gopuram and the gold vimana
  sunAzimuth: Math.atan2(0.5, 0.87),
  sunElevationMin: 40,
  fog: { color: 0xbac6ce, near: 700, far: 9000 },
  sunColor: 0xfff0dc,
  sunIntensity: 3.3,
  far: 7000,
  build({ root, M, P, flames, renderer, pending, interiorEnv, setBloom }) {
    const K = srisailamMaterials(M, renderer, pending, interiorEnv);
    const B = new Merger(P, 'srisailam');
    const O = new Offerings(17);
    O.B = B; O.K = K;
    const nandi = nandiGeo(84);
    // three render groups: the Mallikarjuna shrine itself (always drawn), the rest of the complex and the
    // world outside (both hidden while inside the sealed garbhagriha, where nothing of them can be seen)
    const BT = new Merger(P, 'srisailam-shrine');
    const complex = new THREE.Group();
    root.add(complex);
    const pk = buildPrakara(B, K);
    O.B = BT;
    const t = buildTemple(BT, K, P, root, flames, O, nandi);
    // the darshan flowers (thousands of jasmine buds and roses) in their own instanced set, drawn only from
    // inside the mandapa / antarala / garbhagriha, where they can be seen
    const OS = new Offerings(29);
    OS.B = BT; OS.K = K;
    const s = buildSanctum(BT, K, P, root, flames, OS, interiorEnv);
    O.B = B;
    const b = buildBhramaramba(B, K, P, root, flames, O);
    buildCourt(B, K, P, root, flames, O, BT);
    buildFurnish(B, K, P, root, O);
    buildDecals(root);
    // the world outside the walls (town, street, terrain, forest): hidden while inside the sealed garbhagriha
    const outside = new THREE.Group();
    root.add(outside);
    const BX = new Merger(P, 'srisailam-outside');
    const st = buildSetting(BX, K, P, root, O, outside);
    const treeSpots: [number, number, number, number, number][] = [];
    buildLife(BX, K, outside, root, st.avoid, treeSpots);
    buildTerrain(outside, pending);
    scatterTrees(outside, st.avoid, treeSpots);
    leafTrees(outside, treeSpots, pending);
    // small, interior or ground-hugging materials don't cast sun shadows (one shadow-pass draw each saved)
    for (const m of [K.signTelugu, K.yaliStone, K.blueRoof, K.steel, K.goldIn, K.goldPlain, K.silver, K.brass, K.polished, K.stoneFloor, K.blackStone, K.lingam, K.nagaGold, K.nagaBrass,
      K.ash, K.kumkum, K.dark, K.goldSan, K.goldSanPlain, K.sanctumStone, K.courtFlags, ...K.nichePaint, ...K.figPaint, K.roseCore, K.paintGreen, K.paintBlue, K.paintRed, K.paintYellow, K.lampGlow, K.graniteDark, K.paving, K.lawn, K.road,
      K.yellowRail, K.cloth, K.whiteCloth, K.wood, K.hedge, K.water, K.paintedArch, K.paintedCloister, K.paintedNandi, K.paintedMandapa, K.paintedBhram]) {
      B.noShadow(m); BT.noShadow(m); BX.noShadow(m);
    }
    O.flush(root);
    const darshan = new THREE.Group();
    root.add(darshan);
    OS.flush(darshan);
    const detailGroups = pk.details.map(({ m, x, z }) => {
      const g = new THREE.Group();
      complex.add(g);
      m.flush(g, false);
      return { g, x, z };
    });
    B.flush(complex);
    BT.flush(root);
    BX.flush(outside, false); // the street and town lie outside the ±70 m sun-shadow frustum anyway
    for (const [x, z] of [...TREES, ...MORE_TREES]) P.solid(x - 0.45, 0, z - 0.45, x + 0.45, 6, z + 0.45);
    const { inner: I, mandX1, mandZ } = SHRINE;
    lightZones(root, [...t.lights, ...s.lights, ...b.lights], (p) =>
      (p.y > 1.2 && p.x > -I - 0.2 && p.x < mandX1 + 0.5 && Math.abs(p.z) < mandZ + 0.5) ||
      (p.y > 3.0 && p.x > BHRAM.x - BHRAM.half - 0.2 && p.x < BHRAM.mx1 + 0.6 && Math.abs(p.z) < BHRAM.mz + 0.5));
    // also follow the camera itself (poses / fly-through cameras don't change the zone)
    const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    probe.frustumCulled = false;
    let bloomIn = false;
    probe.onBeforeRender = (_r, _s, cam) => {
      const p = cam.position;
      const inSanctum = Math.abs(p.x) < I && Math.abs(p.z) < I && p.y > 1.2 && p.y < 4.6;
      outside.visible = complex.visible = !inSanctum;
      // the lamp-lit garbhagriha: soft bloom only, so the gold and the flames don't flare
      darshan.visible = p.x > -I - 0.5 && p.x < mandX1 + 2.5 && Math.abs(p.z) < mandZ && p.y > 0.6 && p.y < 7;
      if (inSanctum !== bloomIn) { bloomIn = inSanctum; setBloom(inSanctum ? 0.14 : null); }
      for (const d of detailGroups) d.g.visible = Math.hypot(p.x - d.x, p.z - d.z) < 125;
    };
    root.add(probe);
    const inGate = (x: number, z: number, g: typeof GOPURAMS.east) => {
      const along = Math.abs(Math.cos(g.ry)) > 0.5; // gate passage runs along z when ry ≈ 0 / π
      return along ? Math.abs(x - g.x) < 2.4 && Math.abs(z - g.z) < g.D / 2 + 1 : Math.abs(z - g.z) < 2.4 && Math.abs(x - g.x) < g.D / 2 + 1;
    };
    return {
      ...mallikarjunaNav(), // Places (engine/travel.ts): the walking graph
      spawn: { feet: [SPAWN.x, 0, SPAWN.z], look: [WALL.x1, 15, 0] },
      onZoneChange(zone: string) {
        outside.visible = complex.visible = zone !== 'garbhagriha';
      },
      zoneAt({ x, y, z }) {
        if (y > 0.5 && y < 2 && Math.abs(x) < I + 0.05 && Math.abs(z) < I + 0.05) return 'garbhagriha';
        if (y > 0.5 && y < 2 && x > I && x < mandX1 + 0.3 && Math.abs(z) < mandZ) return 'mandapa';
        if (inGate(x, z, GOPURAMS.east)) return 'gopuram';
        if (inGate(x, z, GOPURAMS.north)) return 'shivaji';
        if (inGate(x, z, GOPURAMS.south)) return 'gopuramS';
        if (inGate(x, z, GOPURAMS.west)) return 'gopuramW';
        if (y > 1.5 && x < TERRACE.x1 + 0.5 && x > WALL.x0 && Math.abs(z) < TERRACE.z1) return 'bhramaramba';
        if (x > NANDI_M.x0 - 1.5 && x < NANDI_M.x1 + 1.5 && Math.abs(z) < NANDI_M.z + 1.5) return 'nandi';
        if (x > INNER.x0 && x < INNER.x1 && z > INNER.z0 && z < INNER.z1) return 'court';
        if (Math.hypot(x - GUNDAM.x, z - GUNDAM.z) < 7) return 'gundam';
        if (x > WALL.x0 && x < WALL.x1 && z > WALL.z0 && z < WALL.z1) return 'prakara';
        return null;
      },
    };
  },
};

export default site;

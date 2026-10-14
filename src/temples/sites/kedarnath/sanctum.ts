import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { worldUV } from '../../engine/materials';
import type { Physics, Flames } from '../../engine/kit';
import { Batch, M4, rng, fbm, ridged } from './batch';
import type { KMats } from './mats';
import { applyScan } from './mats';
import type { Offerings } from './flowers';
import { goldWallMaps, goldCeilingMaps, omPanelMaps } from './goldwork';
import { buildPriests } from '../mahakaleshwar/priests';

/**
 * The garbhagriha of Kedarnath (6 × 6 m inside).
 *
 * The Jyotirlinga is a natural rock: a low, broad, lumpy hump — the bull's back of the legend —
 * about 1.8 × 1.3 m on plan and only ~0.7 m high, blunt-crested and knobbly, glossy black with
 * ghee, smeared with sandal paste and ash, a few flowers and bel leaves laid along the crest.
 * It sits in a low jaleri (kerb) that was gold-plated with the walls and ceiling in Oct 2022,
 * with small copper hip-roofed boxes on its corners. Four massive rough black stone pillars stand
 * at the room's corners; a large silver chhatra with a fringe of teardrop pendants and a kalash
 * pendant hangs over the rock; a copper pot drips water onto it. Clear floor all round for the
 * pradakshina.
 */

export interface SanctumSpec { F: number; S: number; z0: number; z1: number; ceil: number; door: number; }

export function buildSanctum(
  B: Batch, K: KMats, M: Materials, g: THREE.Group, P: Physics, flames: Flames, O: Offerings,
  spec: SanctumSpec, env: { gold: THREE.Texture; lamp: THREE.Texture; neutral: THREE.Texture }, pending: Promise<unknown>[],
) {
  const { F, S, z0, z1, ceil, door } = spec;
  const zc = (z0 + z1) / 2;
  const r = rng(23);
  P.floor(g, -S, S, z0, z1, F);
  B.box(K.paving, S * 2, 0.05, z1 - z0, 0, F - 0.04, zc);

  // ---------------- gold cladding, nearly down to the floor ----------------
  const DADO = 0.14, y0 = F + DADO, H = ceil - y0;
  const wall = goldWallMaps(H, y0);
  const goldWall = new THREE.MeshStandardMaterial({
    color: 0xe6dcc8, map: wall.map, normalMap: wall.nor, metalness: 1, roughness: 0.36, envMap: env.gold, envMapIntensity: 0.72,
  });
  goldWall.normalScale.setScalar(0.65);
  // lamp soot: the plates darken over their upper metre towards the ceiling, and a little at the foot
  goldWall.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSootY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSootY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSootY;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float soot = smoothstep(${(ceil - 1.0).toFixed(2)}, ${(ceil - 0.1).toFixed(2)}, vSootY);
        diffuseColor.rgb *= 1.0 - soot * 0.62;
        roughnessFactor = mix(roughnessFactor, 0.7, soot);`);
  };
  goldWall.customProgramCacheKey = () => 'kedar-gold-soot';
  const ceilMaps = goldCeilingMaps();
  const goldCeil = new THREE.MeshStandardMaterial({
    // sooty, dull gold overhead: the darkest plated surface, not the brightest
    color: 0x8a6a30, map: ceilMaps.map, normalMap: ceilMaps.nor, metalness: 1, roughness: 0.6, envMap: env.gold, envMapIntensity: 0.45,
  });
  goldCeil.normalScale.setScalar(0.6);
  const t = 0.05;
  B.slab(goldWall, t, H, z1 - z0, -S + t / 2, y0, zc);
  B.slab(goldWall, t, H, z1 - z0, S - t / 2, y0, zc);
  B.slab(goldWall, S * 2, H, t, 0, y0, z0 + t / 2);
  for (const s of [-1, 1]) B.slab(goldWall, S - door, H, t, s * (door + (S - door) / 2), y0, z1 - t / 2);
  B.slab(goldWall, door * 2, ceil - F - 2.6, t, 0, F + 2.6, z1 - t / 2);
  B.slab(goldCeil, S * 2, t, z1 - z0, 0, ceil - t, zc);
  for (const s of [-1, 1]) {
    B.slab(K.stoneIn, t, DADO, z1 - z0, s * (S - t / 2), F, zc);
    B.slab(K.stoneIn, S - door, DADO, t, s * (door + (S - door) / 2), F, z1 - t / 2);
  }
  B.slab(K.stoneIn, S * 2, DADO, t, 0, F, z0 + t / 2);
  for (const [w, d, x, z] of [[S * 2, 0.16, 0, z0 + 0.1], [0.16, z1 - z0, -S + 0.1, zc], [0.16, z1 - z0, S - 0.1, zc]] as const) {
    B.box(goldCeil, w, 0.12, d, x, ceil - 0.2, z);
    B.box(goldCeil, w, 0.06, d, x, ceil - 0.32, z);
  }
  // the ॐ panel on the back wall and the gilt ledge below it with lamps
  {
    const om = omPanelMaps();
    const omMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, map: om.map, normalMap: om.nor, metalness: 1, roughness: 0.3, envMap: env.gold, envMapIntensity: 0.8 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), omMat);
    pl.position.set(0, F + 2.75, z0 + 0.06);
    g.add(pl);
    B.box(K.goldPlate, 1.6, 0.08, 0.32, 0, F + 1.65, z0 + 0.16);
    for (const x of [-0.55, 0.55]) B.box(K.goldPlate, 0.1, 0.24, 0.26, x, F + 1.41, z0 + 0.13);
    for (const x of [-0.45, 0, 0.45]) {
      B.geo(M.brass, new THREE.CylinderGeometry(0.06, 0.035, 0.045, 12), M4(x, F + 1.75, z0 + 0.2), false);
      flames.points.push(new THREE.Vector3(x, F + 1.82, z0 + 0.2));
    }
  }

  // ---------------- four massive black stone pillars in the corners ----------------
  const black = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.7, envMap: env.lamp, envMapIntensity: 0.7 });
  pending.push(applyScan(black, 'aerial_rocks_02', 1.2, 0x55524d, 1.4).then(() => { black.roughness = 0.75; }));
  const PW = 0.9, pc = S - PW / 2;
  for (const [x, z] of [[-pc, z0 + PW / 2], [pc, z0 + PW / 2], [-pc, z1 - PW / 2], [pc, z1 - PW / 2]]) {
    B.box(black, PW + 0.08, 0.95, PW + 0.08, x, F, z); // plinth block
    let y = F + 0.95, k = 0;
    while (y < ceil - 0.5) {
      const h = Math.min(ceil - 0.5 - y, 0.55 + ((k * 37) % 5) * 0.08);
      const w = PW - 0.02 * ((k * 13) % 3);
      B.box(black, w, h - 0.015, w, x + (((k * 7) % 3) - 1) * 0.012, y, z);
      y += h; k++;
    }
    B.box(black, PW + 0.14, 0.3, PW + 0.14, x, ceil - 0.5, z);
    B.box(black, PW + 0.3, 0.2, PW + 0.3, x, ceil - 0.2, z);
    P.solid(x - PW / 2 - 0.04, F, z - PW / 2 - 0.04, x + PW / 2 + 0.04, ceil, z + PW / 2 + 0.04);
  }

  // ---------------- the jaleri: a raised kerb frame of embossed silver round a sunken basin ----------------
  // (sl10: the kerb is silver-grey white metal ≈0.25 m high and ≈0.2 m wide; the rock rises out of
  // a basin of wet floor strewn with flowers, milk and water; copper hip-roofed boxes stand on the
  // kerb's corners)
  const RZ = zc - 0.1; // rock centre
  // kerb outer half-extents (≈3.5 × 3.0 m): wide enough for a rock some 12 ft along, with a pilgrim's step of floor
  // left before the door and clear of the corner pillars
  const KX = 1.75, KZ = 1.5;
  const KW = 0.2, KTOP = F + 0.25;
  // bright silver-grey white metal: neutral studio reflections only, so the warm lamps don't gild it
  const silverK = new THREE.MeshStandardMaterial({
    color: 0xc8c8c8, metalness: 0.9, roughness: 0.3, envMap: env.neutral, envMapIntensity: 0.42,
    normalMap: K.goldPlate.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
  });
  {
    for (const [w, d, x, z] of [[KX * 2, KW, 0, RZ - KZ + KW / 2], [KX * 2, KW, 0, RZ + KZ - KW / 2], [KW, KZ * 2 - KW * 2, -KX + KW / 2, RZ], [KW, KZ * 2 - KW * 2, KX - KW / 2, RZ]] as const) {
      B.box(silverK, w, KTOP - F, d, x, F, z);
      // a beaded moulding along the top edge
      B.box(silverK, w + 0.03, 0.03, d + 0.03, x, KTOP - 0.03, z);
    }
    // the basin floor: dark wet stone, glossy with water, milk and ghee
    const wet = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.2, metalness: 0.0, envMap: env.lamp, envMapIntensity: 0.8 });
    B.box(wet, KX * 2 - KW * 2 + 0.02, 0.05, KZ * 2 - KW * 2 + 0.02, 0, F, RZ);
    // pranala spout to the north
    B.box(silverK, 0.2, 0.08, 0.45, 0.5, F + 0.06, RZ - KZ - 0.2);
    // copper offering boxes with hip roofs, standing on the kerb corners
    const cop = new THREE.MeshStandardMaterial({ color: 0xb8653a, metalness: 0.65, roughness: 0.5, envMap: env.lamp, envMapIntensity: 0.9 });
    for (const [x, z] of [[-KX + KW / 2, RZ + KZ - KW / 2], [KX - KW / 2, RZ + KZ - KW / 2], [KX - KW / 2, RZ - KZ + KW / 2], [-KX + KW / 2, RZ - KZ + KW / 2]]) {
      B.geo(cop, new THREE.BoxGeometry(0.3, 0.3, 0.26), M4(x, KTOP + 0.15, z), false);
      B.geo(cop, new THREE.CylinderGeometry(0.02, 0.24, 0.13, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.88), M4(x, KTOP + 0.365, z), false);
    }
    P.solid(-KX, F, RZ - KZ, KX, F + 1.1, RZ + KZ);
  }

  // ---------------- the rock ----------------
  // a broad, lopsided, three-faced hump, as photographed with pilgrims seated round it: crest ≈1.2 m above the basin,
  // ≈2.7 × 2.1 m on plan (some 12 ft along), rising to a blunt ridge high towards the north-west end and running out
  // long and lower to the south-east
  const HT = 0.95, base = F + 0.06, ROT = -0.18;
  const ca = Math.cos(ROT), sa = Math.sin(ROT);
  const bumps = Array.from({ length: 6 }, (_, i) => {
    const a = i * 2.3 + 0.7, rr = 0.15 + r() * 0.45;
    return { x: Math.cos(a) * rr * 0.85, z: Math.sin(a) * rr * 0.6, a: 0.06 + r() * 0.05, w: 0.18 + r() * 0.12 };
  });
  /** outline radius scale for direction a (lumpy superellipse, ~1.35 × 1.05 m half-axes) */
  const outlineR = (a: number) => 1 + (fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 - 2, 3) - 0.5) * 0.28;
  const rockH = (x: number, z: number) => {
    const lx = x * ca - z * sa, lz = x * sa + z * ca;
    const u = lx / 1.35, v = lz / 1.05;
    const rr = Math.hypot(u, v) / outlineR(Math.atan2(v, u));
    if (rr >= 1) return -0.02;
    // steep faces up to a blunt ridge (more pyramid than dome); the ridge a little behind and to the west
    let h = HT * Math.pow(1 - Math.pow(rr, 1.9), 0.62);
    h *= 1 + 0.32 * Math.tanh((-u * 0.75 - v * 0.35) * 1.6) + 0.1 * Math.sin(u * 2.3 + v * 1.7);
    for (const b of bumps) {
      const d2 = ((lx - b.x) ** 2 + (lz - b.z) ** 2) / (b.w * b.w);
      h += b.a * Math.exp(-d2) * (1 - rr * 0.5);
    }
    h += (fbm(lx * 2.5 + 4.1, lz * 2.5 - 1.3, 4) - 0.5) * 0.08 * (1 - rr * 0.4);
    h -= ridged(lx * 6.0 + 1.0, lz * 6.0 - 2.0, 3) * 0.018;
    h += (fbm(lx * 16, lz * 16, 2) - 0.5) * 0.01;
    return h * Math.min(1, (1 - rr) * 9);
  };
  const NA = 140, NR = 40;
  const pos: number[] = [], col: number[] = [], idx: number[] = [], gloss: number[] = [];
  const base0 = new THREE.Color(0x23211f), paleC = new THREE.Color(0xd8cfb4), ashC = new THREE.Color(0x8e8b86);
  const sindoor = new THREE.Color(0xb3200f), orangeC = new THREE.Color(0xe0701a);
  // five pale streaks running down the flanks from the crest (angle, width, start height, strength)
  const streaks = [0.3, 1.1, 2.0, 2.6, 3.4, 4.3, 5.2].map((a, i) => ({
    a, w: 0.035 + (i % 3) * 0.015, lo: 0.25 + (i % 3) * 0.15, k: 0.7 + (i % 2) * 0.3,
    ox: Math.cos(a * 3.1) * 0.25, oz: Math.sin(a * 2.3) * 0.15,
  }));
  for (let j = 0; j <= NR; j++) {
    const tt = j === NR ? 1.04 : Math.pow(j / (NR - 1), 0.8);
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2;
      const R = outlineR(a) * Math.min(tt, 1.04) * 0.999;
      const lx = Math.cos(a) * R * 1.35, lz = Math.sin(a) * R * 1.05;
      const x = lx * ca + lz * sa, z = -lx * sa + lz * ca;
      const h = tt >= 1 ? -0.02 : rockH(x, z);
      pos.push(x, h, z);
      const top = Math.max(0, h) / HT;
      const speck = fbm(x * 30 + 7, z * 30, 2);
      // near-black grey body (sl10): albedo ≈ #23211f, with a faint grain
      const c = base0.clone().multiplyScalar(0.8 + speck * 0.45);
      // pale ghee / sandal / ash streaks running down the flanks from the crest (#d8cfb4)
      let st = 0;
      for (const sk of streaks) {
        // each run meanders as it falls, thins and fades towards its lower end
        const ang = Math.atan2(z - sk.oz, x - sk.ox) + (fbm(top * 3 + sk.a, sk.a, 2) - 0.5) * 0.9;
        const da = Math.abs(Math.atan2(Math.sin(ang - sk.a), Math.cos(ang - sk.a)));
        const w = sk.w * (0.5 + 0.7 * top);
        st = Math.max(st, (1 - THREE.MathUtils.smoothstep(da, w * 0.4, w)) * THREE.MathUtils.smoothstep(top, sk.lo, sk.lo + 0.25) * sk.k);
      }
      c.lerp(paleC, st * 0.55);
      // smears of sandal paste and ash near the crest
      const smear = THREE.MathUtils.smoothstep(fbm(x * 3.4 + 11, z * 3.4, 3), 0.6, 0.7) * THREE.MathUtils.smoothstep(top, 0.6, 0.85);
      c.lerp(paleC, smear * 0.6);
      const ash = THREE.MathUtils.smoothstep(fbm(x * 2.2 - 3, z * 9 + 9, 3), 0.62, 0.7) * THREE.MathUtils.smoothstep(top, 0.15, 0.4);
      c.lerp(ashC, ash * 0.4);
      // vermilion (sindoor) dots and orange powder spots
      const kum = THREE.MathUtils.smoothstep(fbm(x * 14 + 2, z * 14 - 5, 2), 0.8, 0.82) * THREE.MathUtils.smoothstep(top, 0.3, 0.6);
      c.lerp(sindoor, kum * 0.9);
      const orng = THREE.MathUtils.smoothstep(fbm(x * 11 - 9, z * 11 + 3, 2), 0.78, 0.81) * (1 - THREE.MathUtils.smoothstep(top, 0.35, 0.6));
      c.lerp(orangeC, orng * 0.8);
      // gloss: wet and ghee-polished on the top third only, matte on the lower flanks
      gloss.push(THREE.MathUtils.smoothstep(top, 0.55, 0.8) * (1 - st * 0.6));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < NR; j++) {
    for (let i = 0; i < NA; i++) {
      const a = j * NA + i, b2 = j * NA + ((i + 1) % NA), c2 = (j + 1) * NA + i, d2 = (j + 1) * NA + ((i + 1) % NA);
      idx.push(a, b2, c2, b2, d2, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aGloss', new THREE.Float32BufferAttribute(gloss, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  worldUV(geo);
  const rockMat = K.lingam;
  rockMat.vertexColors = true;
  rockMat.envMapIntensity = 0.7;
  // glossy (roughness 0.35, clear-coated) only where aGloss is high: the crest third
  rockMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGloss; varying float vGloss;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = aGloss;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGloss;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.72, 0.35, vGloss);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= vGloss;');
  };
  rockMat.customProgramCacheKey = () => 'kedar-linga-gloss';
  const rock = new THREE.Mesh(geo, rockMat);
  rock.position.set(0, base, RZ);
  rock.castShadow = rock.receiveShadow = true;
  g.add(rock);

  const surf = (x: number, z: number) => {
    const h = rockH(x, z), e = 0.02;
    const nx = (rockH(x - e, z) - rockH(x + e, z)) / (2 * e), nz = (rockH(x, z - e) - rockH(x, z + e)) / (2 * e);
    return { p: new THREE.Vector3(x, base + h + 0.01, RZ + z), n: new THREE.Vector3(nx, 1, nz).normalize(), h };
  };
  // offerings only along the crest: a handful of marigolds, bel leaves, white blossoms, petals
  let placed = 0;
  for (let i = 0; i < 1200 && placed < 40; i++) {
    const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.1;
    const s = surf(x, z);
    if (s.h < HT * 0.72) continue;
    const k = r();
    if (k < 0.25) O.marigold(s.p, 0.95, s.n);
    else if (k < 0.65) O.bel(s.p, s.n);
    else if (k < 0.85) O.blossom(s.p, s.n);
    else O.petal(s.p, s.n);
    placed++;
  }
  // a short garland laid over the crest
  for (let i = 0; i <= 14; i++) {
    const x = -0.35 + (i / 14) * 0.6, z = 0.05 + Math.sin(i * 0.5) * 0.04;
    const s = surf(x, z);
    if (s.h > HT * 0.4) O.marigold(s.p.add(new THREE.Vector3(0, 0.015, 0)), 1.05, s.n);
  }
  // flowers strewn over the wet basin floor round the rock (orange marigolds, white blossoms,
  // bel leaves, rose petals), and a few on the kerb top
  for (let i = 0, n = 0; i < 900 && n < 110; i++) {
    const x = (r() - 0.5) * (KX - KW) * 2, z = (r() - 0.5) * (KZ - KW) * 2;
    if (rockH(x, z) > 0.0) continue;
    const pp = new THREE.Vector3(x, F + 0.055, RZ + z);
    const k = r();
    if (k < 0.4) O.marigold(pp, 0.9); else if (k < 0.6) O.blossom(pp); else if (k < 0.8) O.petal(pp); else O.bel(pp);
    n++;
  }
  for (let i = 0; i < 14; i++) {
    const pp = new THREE.Vector3((r() - 0.5) * 2.2, KTOP + 0.005, RZ + KZ - KW / 2 + (r() - 0.5) * 0.12);
    if (r() < 0.5) O.marigold(pp, 0.9); else O.petal(pp);
  }

  // the chhatra's kalash pendant serves as the jaladhari: a thin stream drips from it onto the crest
  const crest = surf(-0.15, 0.05);
  {
    const cx = crest.p.x * 0.4, y = F + 2.95 - 0.28 - 0.37; // (the chhatra hangs at F + 2.95)
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0xdfe8f0, roughness: 0.05, transparent: true, opacity: 0.5, envMap: env.neutral }));
    const top = new THREE.Vector3(cx, y, RZ), bot = crest.p.clone();
    water.scale.y = top.distanceTo(bot);
    water.position.copy(top).lerp(bot, 0.5);
    water.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
    g.add(water);
  }

  // silver chhatra (sl0, sl1, sl10): a big embossed dome umbrella hung low over the rock on chains,
  // two tiers of fat teardrop bells round its rim, a ribbed finial, and a kalash pendant below
  {
    const silver = new THREE.MeshStandardMaterial({ color: 0xdcdee2, metalness: 1, roughness: 0.3, envMap: env.neutral, envMapIntensity: 0.42,
      normalMap: K.goldPlate.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
    const RC = 0.95, cy = F + 2.95, cx = crest.p.x * 0.4;
    const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0.62)];
    for (let i = 0; i <= 22; i++) {
      const tt = i / 22;
      // bell-shaped dome: steep crown, flaring skirt
      prof.push(new THREE.Vector2(RC * Math.sin(tt * Math.PI * 0.5) ** 0.9, 0.62 * (1 - tt) ** 1.4));
    }
    prof.push(new THREE.Vector2(RC, -0.1), new THREE.Vector2(RC + 0.03, -0.12), new THREE.Vector2(RC - 0.02, -0.12));
    const um = new THREE.LatheGeometry(prof, 48);
    // embossed ribs running down the dome
    const up = um.attributes.position;
    for (let k = 0; k < up.count; k++) {
      const x = up.getX(k), z = up.getZ(k), y = up.getY(k), a = Math.atan2(z, x);
      const f = 1 + 0.025 * Math.cos(a * 16) * Math.min(1, y / 0.15);
      up.setXYZ(k, x * f, y, z * f);
    }
    um.computeVertexNormals();
    B.geo(silver, um, M4(cx, cy, RZ), false);
    // finial: stacked discs and a knob
    for (const [r0, h0] of [[0.12, 0.62], [0.08, 0.68], [0.1, 0.73]]) B.geo(silver, new THREE.CylinderGeometry(r0, r0, 0.05, 16), M4(cx, cy + h0, RZ), false);
    B.geo(silver, new THREE.SphereGeometry(0.07, 12, 8), M4(cx, cy + 0.82, RZ), false);
    // chains to the ceiling
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      B.slab(silver, 0.012, ceil - cy - 0.3, 0.012, cx + Math.cos(a) * 0.35, cy + 0.3, RZ + Math.sin(a) * 0.35);
    }
    B.slab(silver, 0.02, ceil - cy - 0.85, 0.02, cx, cy + 0.85, RZ);
    // two tiers of teardrop bells round the rim
    const drop = new THREE.LatheGeometry(
      [[0, 0], [0.03, 0.012], [0.05, 0.06], [0.045, 0.12], [0.02, 0.17], [0.006, 0.19], [0, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
    drop.rotateX(Math.PI);
    for (const [n, rr, y, sc] of [[30, RC - 0.01, cy - 0.12, 1.0], [30, RC - 0.12, cy - 0.02, 0.8]] as const) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (sc < 1 ? Math.PI / n : 0);
        B.geo(silver, drop.clone().scale(sc, sc, sc), M4(cx + Math.cos(a) * rr, y, RZ + Math.sin(a) * rr), false);
      }
    }
    // central kalash pendant on a short rod
    const kal = new THREE.LatheGeometry(
      [[0, 0], [0.04, 0.01], [0.12, 0.07], [0.15, 0.16], [0.11, 0.26], [0.05, 0.3], [0.08, 0.34], [0.03, 0.36], [0, 0.37]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
    kal.rotateX(Math.PI);
    B.geo(silver, kal, M4(cx, cy - 0.28, RZ), false);
    B.slab(silver, 0.015, 0.3, 0.015, cx, cy - 0.3, RZ);
  }

  // ---------------- lamps: two brass stands against the side walls, ghee diyas, akhand jyoti ----------------
  const stand = new THREE.LatheGeometry(
    [[0, 0], [0.2, 0], [0.18, 0.06], [0.07, 0.12], [0.05, 0.35], [0.09, 0.4], [0.05, 0.45], [0.05, 0.95], [0.18, 1.0], [0.2, 1.05], [0, 1.05]]
      .map(([a, b]) => new THREE.Vector2(a, b)), 16);
  for (const x of [-(S - 0.32), S - 0.32]) {
    const z = zc + 0.2;
    B.geo(M.brass, stand.clone(), M4(x, F, z), false);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.13, F + 1.11, z + Math.sin(a) * 0.13));
    }
    P.solid(x - 0.22, F, z - 0.22, x + 0.22, F + 1.1, z + 0.22);
  }
  // ghee diyas on a brass tray on the floor in front of the kerb
  {
    const tz = RZ + KZ + 0.32;
    B.geo(M.brass, new THREE.CylinderGeometry(0.32, 0.3, 0.03, 28).scale(1, 1, 0.55), M4(0, F + 0.0175, tz), false);
    B.geo(M.brass, new THREE.TorusGeometry(0.31, 0.01, 6, 32).rotateX(Math.PI / 2).scale(1, 1, 0.55), M4(0, F + 0.035, tz), false);
    for (const x of [-0.2, -0.07, 0.07, 0.2]) {
      B.geo(M.brass, new THREE.CylinderGeometry(0.045, 0.028, 0.035, 12), M4(x, F + 0.052, tz + (Math.abs(x) < 0.2 ? 0.05 : -0.03)), false);
      flames.points.push(new THREE.Vector3(x, F + 0.1, tz + (Math.abs(x) < 0.2 ? 0.05 : -0.03)));
    }
  }
  {
    const x = 1.25, z = z0 + 0.4;
    B.geo(M.brass, new THREE.CylinderGeometry(0.06, 0.12, 0.7, 12), M4(x, F + 0.35, z), false);
    B.geo(M.brass, new THREE.CylinderGeometry(0.24, 0.16, 0.12, 20), M4(x, F + 0.76, z), false);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      B.slab(M.brass, 0.015, 0.36, 0.015, x + Math.cos(a) * 0.12, F + 0.82, z + Math.sin(a) * 0.12);
    }
    B.geo(M.brass, new THREE.ConeGeometry(0.17, 0.14, 4, 1).rotateY(Math.PI / 4), M4(x, F + 1.25, z), false);
    flames.points.push(new THREE.Vector3(x, F + 0.92, z));
    P.solid(x - 0.25, F, z - 0.25, x + 0.25, F + 1.2, z + 0.25);
  }

  // ---------------- the pujaris (the Rawal's assistants) seated round the rock, as photographed with pilgrims at it:
  // two on the far (north) side behind the kerb facing the door, one reading and one raising the aarti lamp; two
  // along the west side facing it. The east side and the front stay clear for darshan.
  {
    const SAF = 0xf07a12, ORG = 0xff8a10, WHT = 0xf3eee2, RED = 0xb8241a;
    const pr = buildPriests(g, [
      { x: -0.8, y: F, z: RZ - KZ - 0.55, ry: 0.1, cloth: SAF, head: 'shaved', tilak: true, pose: 'aarti' },
      { x: 0.75, y: F, z: RZ - KZ - 0.55, ry: -0.15, cloth: WHT, pose: 'read', head: 'hair', tilak: true },
      { x: -KX - 0.55, y: F, z: RZ - 0.85, ry: Math.PI / 2 - 0.15, cloth: RED, dhoti: 0xece4d0, head: 'hair', tilak: true },
      { x: -KX - 0.55, y: F, z: RZ + 1.15, ry: Math.PI / 2 + 0.1, cloth: ORG, head: 'shaved', pose: 'read' },
    ], 29);
    flames.points.push(...pr.flames);
    P.solid(-1.4, F, RZ - KZ - 1.0, 1.3, F + 0.95, RZ - KZ - 0.1);
    P.solid(-KX - 1.0, F, RZ - 1.3, -KX - 0.1, F + 0.95, RZ + 1.6);
  }

  const l = new THREE.PointLight(0xffd9a0, 3.6, 8, 1.4);
  l.position.set(0.4, F + 2.3, RZ + 1.2);
  g.add(l);
  flames.lights.push(l);
}

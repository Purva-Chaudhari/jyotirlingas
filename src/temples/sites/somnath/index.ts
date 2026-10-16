import * as THREE from 'three';
import type { SiteDef } from '../types';
import { scanMaterial } from '../../engine/materials';
import { buildTemple, JAG, SANCTUM, SANCTUM_Z } from './temple';
import { weatherStone, copyScan } from './stone';
import { goldRepousse, goldRoomEnv } from './gold';
import { pilgrims } from './people';
import { somnathNav } from './nav';
import { buildPrecinct, animateSea, addDiamonds, distToSeaWall, BAAN, DWAR } from './precinct';

/**
 * Shri Somnath Jyotirlinga, Prabhas Patan (Veraval, Gujarat): the temple rebuilt from 1951 in the
 * Maru-Gurjara (Solanki) style, on the shore of the Arabian Sea.
 * Axes: +z = east (the approach through the Digvijay Dwar), +x = north, sea to the south and west.
 */
const site: SiteDef = {
  id: 'somnath',
  name: { en: 'Somnath', hi: 'सोमनाथ' },
  lon: 70.4012,
  lat: 20.888,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['सौराष्ट्र', 'Saurashtra', 'Gujarat · on the Arabian Sea'],
    3: ['प्रभास पाटन', 'Prabhas Patan', 'where the Hiran, Kapila and Saraswati meet the sea'],
  },
  zones: {
    dwar: ['श्री दिग्विजय द्वार', 'Digvijay Dwar', 'Sardar Patel keeps watch at the gate'],
    temple: ['सोमनाथ मंदिर', 'Somnath Mandir', 'the first of the twelve Jyotirlingas'],
    garbhagriha: ['श्री सोमनाथ', 'Jyotirlinga', 'Prabhas Kshetra · the eternal shrine'],
    baan: ['बाण स्तंभ', 'Baan Stambh', 'an unbroken path of light over the sea to the South Pole'],
    sea: ['अरब सागर', 'Arabian Sea', 'the waves at the temple’s feet'],
  },
  hdri: 'assets/hdri/syferfontein_18d_clear_puresky.hdr',
  // coastal haze matching the sky's pale horizon, so the sea fades into it
  fog: { color: 0xbcc6cc, near: 180, far: 1400 },
  // mid-morning sun from the south-south-east, high enough not to glare down the eastern approach
  sunAzimuth: Math.atan2(-0.9, 0.45),
  sunElevationMin: 38,
  // a clear, bright seaside morning: a little more colour in the sea, the lawns and the saffron flags
  grade: { saturation: 1.16, exposure: 1.06 },
  build({ root, M, P, flames, sunDir, pending, interiorEnv, renderer }) {
    // the 1951 temple's honey-gold sandstone (yellow-gold in the sun, not orange): a smooth fine-jointed ashlar scan, tinted
    const stone = scanMaterial('sandstone_blocks_08', 2.4, { tint: 0xf6c27a, normalScale: 0.9 });
    // carved variants for the temple itself (relief + weathering); the precinct's stone is only weathered
    const carved = stone.material.clone();
    const carvedTwo = stone.material.clone();
    carvedTwo.side = THREE.DoubleSide;
    // the sandstone keeps a faint warm glow even in shade (bounce light off the paving and walls)
    for (const m of [stone.material, carved, carvedTwo]) m.emissive.set(0x1a1204);
    weatherStone(stone.material, 0);
    weatherStone(carved, 0.02, 1.1);
    weatherStone(carvedTwo, 0.02, 1.1);
    // the mandapa ceilings and dome: double-sided, lit from below by the bright marble floors
    const ceiling = stone.material.clone();
    ceiling.side = THREE.DoubleSide;
    weatherStone(ceiling, 0.02, 1.1);
    // the Digvijay Dwar is limewashed and painted a pale butter-yellow (no stone grain shows through), lighter
    // than the temple's honey-gold stone, as in the photographs
    const dwarStone = new THREE.MeshStandardMaterial({ color: 0xfad165, roughness: 0.8, side: THREE.DoubleSide });
    pending.push(stone.loaded.then(() => {
      // the scan's own albedo is a mid tan: lift it so the temple reads honey-gold in the midday sun, as in the
      // travel films (a peach tint went orange, a buff one went pale grey-cream)
      // (apricot-buff, as it shows in the sun in the photographs)
      stone.material.color.set(0xf6c27a).multiplyScalar(1.28);
      copyScan(stone.material, carved);
      copyScan(stone.material, carvedTwo);
      copyScan(stone.material, ceiling);
      ceiling.emissive.set(0x5a3e16);
    }));
    const pave = scanMaterial('rectangular_paving', 2.6, { tint: 0xf0dcc4, normalScale: 0.7 });
    pending.push(pave.loaded.then(() => addDiamonds(pave.material)));

    const shade = new THREE.MeshStandardMaterial({ color: 0x5c4532, roughness: 1 });
    // the 2020s gold plating of the garbhagriha: high-key yellow gold in deep repoussé panels, mirroring a
    // warm gold room (not the dark lamp-lit default, which turned it copper-brown)
    const goldEnv = goldRoomEnv(renderer);
    const rep = goldRepousse();
    const goldWall = new THREE.MeshStandardMaterial({
      // the colour map carries the gold (0xffd468 at mid relief): tinting it again turned it copper
      color: 0xffffff, map: rep.map, normalMap: rep.normal, normalScale: new THREE.Vector2(2.0, 2.0),
      metalness: 1, roughness: 0.3, emissive: 0x0c0600, envMap: goldEnv, envMapIntensity: 1.5,
    });
    // smooth burnished gold for pilasters, cornices, frames and doors
    const goldTrim = new THREE.MeshStandardMaterial({ color: 0xe8b038, metalness: 1, roughness: 0.25, emissive: 0x0c0600, envMap: goldEnv, envMapIntensity: 1.6 });
    const flagCloth = flagMaterial();
    const copper = new THREE.MeshStandardMaterial({ color: 0xb8733a, metalness: 1, roughness: 0.35 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.8 });
    const jali = jaliMaterial();

    // the halls and sanctum are floored in ivory marble (polished, faintly veined by the weathering noise; not a
    // cold white: in the films it reads warm cream against the honey-gold stone)
    const marble = new THREE.MeshStandardMaterial({ color: 0xe8d4ac, roughness: 0.32, emissive: 0x1a140a });
    weatherStone(marble, 0);
    const t = buildTemple(root, M, { stone: carved, stoneTwo: carvedTwo, shade, goldWall, goldTrim, goldEnv, ceiling, jali, flagCloth, copper, leaf, env: interiorEnv, marble }, P);
    pending.push(t.ready);
    flames.points.push(...t.flames.points);
    flames.lights.push(...t.flames.lights);
    const { water, group: precinct, shore, ready: precinctReady } = buildPrecinct(root, M, { stone: stone.material, stoneTwo: carvedTwo, shade, paving: pave.material, dwar: dwarStone, jali }, P, flames, sunDir);
    pending.push(precinctReady);
    // pilgrims in the queue, on the jagati, the promenade, round the Baan Stambh and in the market (one batched draw)
    const crowd = pilgrims(precinct, P);

    return {
      // Places (engine/travel.ts): the walking graph and the places list
      ...somnathNav(),
      // on the market road outside the Digvijay Dwar, facing it: Sardar Patel's statue stands before the gate, and
      // the pilgrim walks past him and in through it, as every visitor does
      // (south of the gate's line, as the plaza is photographed: the queue on the left, Patel on the right and the
      // shikhara showing beside the Dwar)
      spawn: { feet: [DWAR.x - 20, 0, 176], look: [DWAR.x - 6, 8, 105] },
      update(time) {
        t.flag.update(time);
        t.fittings.update(time);
        crowd.update(time);
        water.material.uniforms.time.value = time * 0.5;
        animateSea(time);
      },
      // inside the garbhagriha nothing outside can be seen: skip drawing the precinct, the sea and the shikhara
      onZoneChange(zone: string) {
        const out = zone !== 'garbhagriha';
        precinct.visible = shore.visible = water.visible = out;
        const spire = t.group.getObjectByName('shikhara');
        if (spire) spire.visible = out;
      },
      setSun(dir: THREE.Vector3) {
        water.material.uniforms.sunDirection.value.copy(dir);
      },
      zoneAt({ x, y, z }) {
        if (y > 1.5 && Math.abs(x) < SANCTUM && Math.abs(z - SANCTUM_Z) < SANCTUM) return 'garbhagriha';
        if (y > 0.9 && Math.abs(x) < JAG.x + 4 && z > JAG.z0 && z < JAG.z1 + 4) return 'temple';
        if (Math.hypot(x - BAAN.x, z - BAAN.z) < 9) return 'baan';
        if (distToSeaWall(x, z) < 12) return 'sea';
        if (Math.abs(x - DWAR.x) < DWAR.hw + 4 && z > DWAR.z0 - 6 && z < 165) return 'dwar';
        return null;
      },
    };
  },
};

/** The dhwaja: saffron-red cloth with a darker trishul and damaru printed on it (UVs are the flag shape's own metres). */
function flagMaterial() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 280;
  const x = c.getContext('2d')!;
  const gr = x.createLinearGradient(0, 0, 512, 0);
  // bright saffron, as it shows against the sky in the photographs
  gr.addColorStop(0, '#e8501a');
  gr.addColorStop(1, '#f2601f');
  x.fillStyle = gr;
  x.fillRect(0, 0, 512, 280);
  x.strokeStyle = '#8f1b06';
  x.fillStyle = '#8f1b06';
  x.lineWidth = 9;
  const cx = 150, cy = 140;
  x.beginPath(); x.moveTo(cx, cy + 95); x.lineTo(cx, cy - 75); x.stroke();
  x.beginPath(); x.moveTo(cx - 45, cy - 60); x.quadraticCurveTo(cx - 45, cy - 5, cx, cy - 5); x.quadraticCurveTo(cx + 45, cy - 5, cx + 45, cy - 60); x.stroke();
  for (const dx of [-45, 0, 45]) { x.beginPath(); x.moveTo(cx + dx - 12, cy - 58 - (dx ? 0 : 20)); x.lineTo(cx + dx, cy - 90 - (dx ? 0 : 20)); x.lineTo(cx + dx + 12, cy - 58 - (dx ? 0 : 20)); x.fill(); }
  x.beginPath(); x.moveTo(cx - 22, cy + 20); x.lineTo(cx + 22, cy + 50); x.lineTo(cx + 22, cy + 20); x.lineTo(cx - 22, cy + 50); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / 2.6, 1 / 1.4);
  t.offset.set(0, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
}

/** Pierced stone screen: a lattice of eight-pointed stars, cut out with alpha-test. */
function jaliMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9c98f';
  x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'destination-out';
  const star = (cx: number, cy: number, r: number) => {
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.fill();
  };
  star(64, 64, 40);
  for (const [cx, cy] of [[0, 0], [128, 0], [0, 128], [128, 128]]) star(cx, cy, 22);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.55, 1 / 0.55);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: 0xf6dcae });
}

export default site;

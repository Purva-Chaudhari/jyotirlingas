import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import type { Batch } from './batch';

/** how far the great halls' walls stand back behind their outer pillars (the open verandah) */
export const VERANDAH = 1.25;

/**
 * What a pilgrim sees at the sanctum's door and in the halls before it, from the darshan photographs (PIB / PMO
 * 2015–2025 on Wikimedia Commons): the white marble threshold with its lion-mask spouts, the red-draped dais and
 * the white marble cash-donation boxes lettered in red Gujarati, the abhisheka counter with its gold funnels, the
 * tall chrysanthemum columns on the jambs; Nandi before the sanctum; and on the dark ceilings over the aisles the
 * teal-painted panels, ceiling fans and LED spots.
 */
export interface DarshanSite {
  floor: number;
  /** z of the sanctum's front wall (the hall side of the doorway) */
  front: number;
  doorW: number;
  doorTop: number;
  /** the underside of the aisle ceilings */
  ceil: number;
  /** halls: centre z, half sizes, and the radius of the open central well (no aisle ceiling inside it) */
  halls: { cz: number; hx: number; hz: number; well: number }[];
}

export function buildDarshan(g: THREE.Group, B: Batch, marble: THREE.Material, gold: THREE.Material, P: Physics, s: DarshanSite) {
  const F = s.floor, Z = s.front + 0.16;
  const shadow = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.85 });

  // ---- the udumbara: white marble, ~0.6 m high, a half-round lotus drum on the axis, a lion mask (kirtimukha, the
  // abhisheka water's spout) either side of it and a lotus roundel at each end; before it a lower red-draped dais.
  // The way in stays walkable over both (ramps), though in life only the priests cross it
  const TW = 2.3, TZ = Z + 0.45, TH = 0.72, DH = 0.22, DZ = TZ + 0.7;
  B.span(marble, -TW, TW, F, F + TH, Z, TZ);
  B.span(marble, -TW - 0.03, TW + 0.03, F + TH, F + TH + 0.04, Z, TZ + 0.04);
  P.solid(-TW, F, Z, -s.doorW, F + TH + 0.04, TZ);
  P.solid(s.doorW, F, Z, TW, F + TH + 0.04, TZ);
  B.add(marble, new THREE.CylinderGeometry(0.3, 0.3, TH - DH, 24, 1, false, -Math.PI / 2, Math.PI).translate(0, F + DH + (TH - DH) / 2, TZ));
  // a band of carved rosettes round the drum's face
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) / 7) * Math.PI;
    B.add(marble, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateX(Math.PI / 2).rotateY(a).translate(Math.sin(a) * 0.31, F + DH + 0.25, TZ + Math.cos(a) * 0.31));
    B.add(shadow, new THREE.SphereGeometry(0.018, 6, 4).translate(Math.sin(a) * 0.33, F + DH + 0.25, TZ + Math.cos(a) * 0.33));
  }
  B.add(marble, new THREE.TorusGeometry(0.3, 0.02, 6, 24, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI).translate(0, F + TH - 0.02, TZ));
  for (const sg of [-1, 1]) {
    kirtimukha(B, marble, shadow, sg * 0.9, F + DH + 0.25, TZ - 0.04, 1.35, 0.6);
    B.add(marble, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 20).rotateX(Math.PI / 2).translate(sg * 1.75, F + DH + 0.24, TZ + 0.02));
    B.add(marble, new THREE.TorusGeometry(0.07, 0.014, 6, 16).translate(sg * 1.75, F + DH + 0.24, TZ + 0.045));
  }
  // the dais: red cloth falling to the floor, a gold band below its edge
  B.span(red, -TW - 0.3, TW + 0.3, F, F + DH, TZ, DZ);
  B.span(gold, -TW - 0.3, TW + 0.3, F + DH - 0.07, F + DH - 0.04, DZ, DZ + 0.012);
  P.floor(g, -s.doorW, s.doorW, Z - 0.9, Z, F, F + TH);
  P.floor(g, -s.doorW, s.doorW, Z, TZ, F + TH, F + DH);
  P.floor(g, -s.doorW, s.doorW, TZ, DZ, F + DH);
  P.floor(g, -s.doorW, s.doorW, DZ, DZ + 0.35, F + DH, F);
  // brass lotas and silver thalis on the dais, either side of the way in
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9923a, metalness: 1, roughness: 0.3 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xe2e2e6, metalness: 0.75, roughness: 0.38, envMapIntensity: 0.35 });
  for (const sg of [-1, 1]) {
    for (const dx of [1.55, 1.85]) B.lathe(brass, [[0, 0], [0.06, 0], [0.09, 0.07], [0.07, 0.13], [0.04, 0.16], [0.05, 0.19], [0, 0.19]], sg * dx, F + DH, TZ + 0.25, 14);
    B.lathe(silver, [[0, 0], [0.2, 0], [0.22, 0.03], [0, 0.03]], sg * 2.15, F + DH, TZ + 0.42, 20);
  }
  // the white marble cash-donation boxes before the dais: low and long, the red lettering on a sloped band
  const label = new THREE.MeshStandardMaterial({ map: textTexture('રોકડ ભેટ દાનપેટી', '#b0161c', '#efe6d6'), roughness: 0.4 });
  for (const sg of [-1, 1]) {
    const [x0, x1] = [Math.min(sg * 1.45, sg * 2.6), Math.max(sg * 1.45, sg * 2.6)];
    B.span(marble, x0, x1, F, F + 0.3, DZ, DZ + 0.4);
    B.span(marble, x0, x1, F + 0.3, F + 0.42, DZ + 0.12, DZ + 0.4);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.17), label);
    band.position.set((x0 + x1) / 2, F + 0.36, DZ + 0.065);
    band.rotation.x = -0.45;
    g.add(band);
    B.add(marble, new THREE.PlaneGeometry(x1 - x0, 0.17).rotateX(-0.45).translate((x0 + x1) / 2, F + 0.36, DZ + 0.06));
    B.span(shadow, (x0 + x1) / 2 - 0.25, (x0 + x1) / 2 + 0.25, F + 0.421, F + 0.425, DZ + 0.22, DZ + 0.26);
    P.solid(x0, F, DZ, x1, F + 0.45, DZ + 0.4);
  }

  // ---- the abhisheka counter: a long waist-high white marble counter beside the dais, perpendicular to the door,
  // its domed gold funnel covers each with a little silver cup; water poured in runs by pipe to the linga
  {
    const x0 = 2.85, x1 = 3.8, z0 = Z + 0.08, z1 = 13.4;
    B.span(marble, x0, x1, F, F + 0.92, z0, z1);
    B.span(marble, x0 - 0.06, x1 + 0.06, F + 0.92, F + 1.0, z0 - 0.06, z1 + 0.06);
    const bright = new THREE.MeshStandardMaterial({ color: 0xf2c55a, metalness: 1, roughness: 0.22, emissive: 0x3a2604 });
    for (const z of [z0 + 0.4, (z0 + z1) / 2, z1 - 0.4]) {
      B.lathe(bright, [[0, 0], [0.22, 0], [0.21, 0.04], [0.15, 0.1], [0.06, 0.13], [0.04, 0.16], [0, 0.17]], (x0 + x1) / 2, F + 1.0, z, 24);
      B.lathe(silver, [[0, 0], [0.04, 0], [0.06, 0.06], [0, 0.06]], (x0 + x1) / 2, F + 1.17, z, 12);
    }
    P.solid(x0 - 0.06, F, z0 - 0.06, x1 + 0.06, F + 1.1, z1 + 0.06);
  }

  // ---- thick shaggy columns of purple chrysanthemums, banded white and yellow, hung on the gold pilasters
  {
    const sphere = new THREE.IcosahedronGeometry(1, 1);
    const mats: THREE.Matrix4[] = [], cols: THREE.Color[] = [];
    const purple = [0x6a3c9e, 0x7b4bb0, 0x5d3290].map((c) => new THREE.Color(c)), white = new THREE.Color(0xf2efe6), yellow = new THREE.Color(0xf2b400);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const sg of [-1, 1]) {
      let k = 0;
      for (let y = F + 0.68; y < F + 3.5; y += 0.06, k++) {
        const band = k % 16;
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2 + r() * 0.5;
          const rr = 0.12 + r() * 0.08, sz = 0.04 + r() * 0.05;
          const c = band < 2 ? white : band === 8 ? yellow : purple[Math.floor(r() * 3)];
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(sg * (s.doorW + 1.1) + Math.cos(a) * rr, y + (r() - 0.5) * 0.04, s.front + 0.62 + Math.sin(a) * rr * 0.8), new THREE.Quaternion(), new THREE.Vector3(sz, sz, sz)));
          cols.push(c);
        }
      }
    }
    const inst = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ roughness: 0.85 }), mats.length);
    mats.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, cols[i]); });
    inst.castShadow = true;
    g.add(inst);
  }

  // ---- a red rug with a gold-and-cream border on the aisle before the darshan railing
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.9 }));
    rug.position.set(0, F + 0.02, Z + 3.85);
    rug.receiveShadow = true;
    g.add(rug);
  }

  // ---- the aisle ceilings before the sanctum: dark charcoal and plain, conduit runs, LED spots and white fans; on the
  // hall's side walls by the front, a teal-painted panel with gold ornament over a side doorway
  const C = s.ceil;
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.9 });
  const h0 = s.halls[0], hz0 = h0.cz - h0.hz;
  B.add(charcoal, new THREE.PlaneGeometry(2 * h0.hx - 0.2, h0.cz - h0.well - hz0).rotateX(Math.PI / 2).translate(0, C - 0.006, (hz0 + h0.cz - h0.well) / 2));
  B.add(charcoal, new THREE.PlaneGeometry(2 * h0.hx - 0.2, hz0 + 2 * h0.hz - (h0.cz + h0.well)).rotateX(Math.PI / 2).translate(0, C - 0.006, (h0.cz + h0.well + hz0 + 2 * h0.hz) / 2));
  for (const sg of [-1, 1]) B.add(charcoal, new THREE.PlaneGeometry(h0.hx - h0.well - 0.1, 2 * h0.well).rotateX(Math.PI / 2).translate(sg * (h0.well + (h0.hx - h0.well) / 2), C - 0.006, h0.cz));
  const teal = new THREE.MeshStandardMaterial({ map: tealPanelTexture(), roughness: 0.55, metalness: 0.15 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 0.7 });
  for (const sg of [-1, 1]) {
    const x = sg * (h0.hx - VERANDAH - 0.35), z = hz0 + 2.0;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2).rotateY(-sg * Math.PI / 2), teal);
    p.position.set(x, s.floor + 3.9, z);
    g.add(p);
    B.add(gold, new THREE.BoxGeometry(0.06, 2.42, 3.02).translate(x + sg * 0.03, s.floor + 3.9, z));
    // the side doorway below: a dark recess in a moulded stone frame
    const door = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 });
    B.add(door, new THREE.BoxGeometry(0.4, 2.6, 1.6).translate(x + sg * 0.12, s.floor + 1.3, z));
    for (const dzz of [-0.88, 0.88]) B.add(frame, new THREE.BoxGeometry(0.16, 2.75, 0.16).translate(x - sg * 0.06, s.floor + 1.375, z + dzz));
    B.add(frame, new THREE.BoxGeometry(0.18, 0.2, 1.92).translate(x - sg * 0.06, s.floor + 2.75, z));
  }
  const inAisle = (x: number, z: number) => s.halls.some((h) => Math.abs(x) < h.hx - 0.8 && Math.abs(z - h.cz) < h.hz - 0.8 && Math.hypot(x, z - h.cz) > h.well + 0.6);
  const spots: [number, number][] = [];
  for (const h of s.halls) for (let x = -h.hx + 1.5; x <= h.hx - 1.4; x += 2.6) for (let z = h.cz - h.hz + 1.4; z <= h.cz + h.hz - 1.3; z += 2.6) if (inAisle(x, z)) spots.push([x, z]);
  const led = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 14).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6e8 }), spots.length);
  const rim = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.4 }), spots.length);
  const mm = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { led.setMatrixAt(i, mm.makeTranslation(x, C - 0.032, z)); rim.setMatrixAt(i, mm.makeTranslation(x, C - 0.015, z)); });
  g.add(led, rim);
  const conduit = new THREE.MeshStandardMaterial({ color: 0x8a8a88, roughness: 0.6 });
  for (const z of new Set(spots.filter(([, z]) => z < h0.cz - h0.well + 2).map(([, z]) => z))) B.span(conduit, -h0.hx + 1.0, h0.hx - 1.0, C - 0.04, C - 0.01, z - 0.015, z + 0.015);

  // ceiling fans: white motor, brown blades, turning slowly
  const fans: THREE.Object3D[] = [];
  const fanWhite = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.45 });
  const fanBlade = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.45 });
  const fanAt: [number, number][] = [];
  for (const h of s.halls) for (const [fx, fz] of h.cz < 30 ? [[3.9, -8.7], [9, -7], [9, 7], [3.9, 8.7]] : [[6.5, -4.5], [6.5, 4.5]]) for (const sg of [-1, 1]) fanAt.push([sg * fx, h.cz + fz]);
  for (const [x, z] of fanAt) {
    if (!inAisle(x, z)) continue;
    B.add(fanWhite, new THREE.CylinderGeometry(0.018, 0.018, 0.75, 6).translate(x, C - 0.375, z));
    B.add(fanWhite, new THREE.CylinderGeometry(0.07, 0.05, 0.06, 12).translate(x, C - 0.03, z));
    const rotor = new THREE.Group();
    rotor.position.set(x, C - 0.82, z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.13, 18), fanWhite);
    rotor.add(hub);
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.11).translate(0.42, -0.02, 0), fanBlade);
      blade.rotation.y = (k / 3) * Math.PI * 2;
      blade.rotation.x = 0.08;
      rotor.add(blade);
    }
    rotor.rotation.y = Math.random() * 6;
    g.add(rotor);
    fans.push(rotor);
  }

  return {
    update(time: number) {
      for (let i = 0; i < fans.length; i++) fans[i].rotation.y = time * 2.6 + i * 1.7;
    },
  };
}

/**
 * Nandi, couchant on a white marble plinth on the hall's axis, gazing west at the linga through the open door.
 * Polished dark stone, a red cloth over his back, a brass bell on his collar and a marigold garland.
 */
export function buildNandi(B: Batch, marble: THREE.Material, P: Physics, x: number, y: number, z: number) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x2f2b28, roughness: 0.28, metalness: 0.1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8141c, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a53a, metalness: 1, roughness: 0.3 });
  const marigold = new THREE.MeshStandardMaterial({ color: 0xe8600a, roughness: 0.75 });
  B.span(marble, x - 0.55, x + 0.55, y, y + 0.42, z - 1.0, z + 0.95);
  B.span(marble, x - 0.6, x + 0.6, y + 0.42, y + 0.48, z - 1.05, z + 1.0);
  P.solid(x - 0.6, y, z - 1.05, x + 0.6, y + 1.6, z + 1.0);
  const Y = y + 0.48, k = 1.25;
  // he faces -z (the sanctum); every part an ellipsoid (scaled sphere), a capsule or a cone, at k x these sizes
  const put = (m: THREE.Material, geo: THREE.BufferGeometry, px: number, py: number, pz: number) => B.add(m, geo.scale(k, k, k).translate(x + px * k, Y + py * k, z + pz * k));
  const ell = (m: THREE.Material, rx: number, ry: number, rz: number, px: number, py: number, pz: number, rotX = 0) =>
    put(m, new THREE.SphereGeometry(1, 20, 14).scale(rx, ry, rz).rotateX(rotX), px, py, pz);
  ell(stone, 0.27, 0.25, 0.6, 0, 0.27, 0.08);            // the body, long and low
  ell(stone, 0.26, 0.24, 0.26, 0, 0.27, 0.46);           // the haunches
  ell(stone, 0.25, 0.27, 0.27, 0, 0.3, -0.3);            // the chest and shoulders
  ell(stone, 0.13, 0.16, 0.17, 0, 0.52, -0.3);           // the hump
  ell(stone, 0.12, 0.2, 0.15, 0, 0.42, -0.58, 0.4);      // the neck, the dewlap hanging under it
  ell(stone, 0.06, 0.13, 0.1, 0, 0.26, -0.6, 0.2);       // the dewlap
  ell(stone, 0.105, 0.12, 0.2, 0, 0.56, -0.76, -0.55);   // the head, long, held up and looking ahead
  ell(stone, 0.085, 0.08, 0.085, 0, 0.42, -0.9);         // the muzzle
  for (const sg of [-1, 1]) {
    put(stone, new THREE.ConeGeometry(0.03, 0.2, 8).rotateZ(-sg * 0.55).rotateX(0.2), sg * 0.1, 0.72, -0.66);   // horns, up and out
    ell(stone, 0.08, 0.03, 0.045, sg * 0.15, 0.6, -0.64);                                                    // ears
    ell(stone, 0.02, 0.02, 0.02, sg * 0.075, 0.57, -0.86);                                                   // eyes
    // forelegs folded under the chest, the knees forward; hind legs tucked along the flanks
    put(stone, new THREE.CapsuleGeometry(0.055, 0.3, 4, 8).rotateX(Math.PI / 2), sg * 0.14, 0.06, -0.52);
    ell(stone, 0.07, 0.07, 0.07, sg * 0.14, 0.08, -0.7);
    put(stone, new THREE.CapsuleGeometry(0.06, 0.38, 4, 8).rotateX(Math.PI / 2), sg * 0.25, 0.07, 0.34);
    // the red cloth's edges, hanging down each flank with a gold border
    put(red, new THREE.BoxGeometry(0.018, 0.22, 0.5), sg * 0.275, 0.33, 0.06);
    put(gold, new THREE.BoxGeometry(0.02, 0.025, 0.5), sg * 0.277, 0.22, 0.06);
  }
  put(red, new THREE.BoxGeometry(0.5, 0.02, 0.5), 0, 0.52, 0.06);    // the cloth over his back
  put(stone, new THREE.CapsuleGeometry(0.02, 0.4, 4, 6).rotateZ(0.2).rotateX(1.3), -0.24, 0.12, 0.62); // the tail
  // the collar with its bell, and the marigold garland
  put(gold, new THREE.TorusGeometry(0.14, 0.016, 6, 20).rotateX(1.1), 0, 0.42, -0.56);
  put(gold, new THREE.SphereGeometry(0.045, 10, 8), 0, 0.24, -0.66);
  put(marigold, new THREE.TorusGeometry(0.17, 0.03, 6, 22).rotateX(1.25), 0, 0.36, -0.5);
}

/** A lion mask (kirtimukha) facing +z, about 0.35 m tall at s = 1: mane, brows, bulging eyes, snout and an open mouth. */
function kirtimukha(B: Batch, mat: THREE.Material, dark: THREE.Material, x: number, y: number, z: number, s: number, depth = 1) {
  const at = (geo: THREE.BufferGeometry, px: number, py: number, pz: number) => geo.scale(s, s, s * depth).translate(x + px * s, y + py * s, z + pz * s * depth);
  B.add(mat, at(new THREE.TorusGeometry(0.15, 0.045, 8, 20), 0, 0, 0.02));
  B.add(mat, at(new THREE.SphereGeometry(1, 16, 12).scale(0.14, 0.13, 0.07), 0, 0, 0.03));
  for (const sg of [-1, 1]) {
    B.add(mat, at(new THREE.SphereGeometry(1, 10, 8).scale(0.055, 0.03, 0.035), sg * 0.055, 0.07, 0.085));
    B.add(mat, at(new THREE.SphereGeometry(0.03, 10, 8), sg * 0.052, 0.035, 0.09));
    B.add(dark, at(new THREE.SphereGeometry(0.012, 8, 6), sg * 0.052, 0.035, 0.118));
    B.add(mat, at(new THREE.ConeGeometry(0.03, 0.08, 8).rotateZ(-sg * 0.6), sg * 0.13, 0.15, 0.03)); // horns
  }
  B.add(mat, at(new THREE.SphereGeometry(1, 12, 10).scale(0.05, 0.04, 0.045), 0, -0.01, 0.1));
  B.add(dark, at(new THREE.SphereGeometry(1, 12, 10).scale(0.065, 0.032, 0.03), 0, -0.075, 0.08));
  B.add(mat, at(new THREE.SphereGeometry(1, 12, 8).scale(0.075, 0.018, 0.03), 0, -0.05, 0.095));
  for (const sg of [-1, 1]) {
    B.add(mat, at(new THREE.ConeGeometry(0.012, 0.045, 6).rotateX(Math.PI), sg * 0.035, -0.07, 0.1)); // fangs
    for (let k = 0; k < 5; k++) { // the mane's scrolls round the face
      const a = -0.9 + k * 0.45;
      B.add(mat, at(new THREE.TorusGeometry(0.03, 0.01, 5, 10), sg * Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.03));
    }
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function textTexture(text: string, ink: string, ground: string) {
  const [c, x] = canvas(512, 76);
  x.fillStyle = ground; x.fillRect(0, 0, 512, 76);
  x.fillStyle = ink;
  let size = 64;
  do { x.font = `700 ${size}px "Noto Sans Gujarati", "Shruti", sans-serif`; size -= 2; } while (x.measureText(text).width > 500 && size > 20);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rugTexture() {
  const [c, x] = canvas(256, 336);
  x.fillStyle = '#8e1018'; x.fillRect(0, 0, 256, 336);
  x.strokeStyle = '#d9a53a'; x.lineWidth = 10; x.strokeRect(12, 12, 232, 312);
  x.strokeStyle = '#efe2c4'; x.lineWidth = 3; x.strokeRect(26, 26, 204, 284);
  x.fillStyle = '#d9a53a';
  for (let yy = 60; yy < 300; yy += 54) for (let xx = 64; xx < 220; xx += 64) {
    x.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; x.lineTo(xx + Math.cos(a) * (k % 2 ? 7 : 16), yy + Math.sin(a) * (k % 2 ? 7 : 16)); }
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tealPanelTexture() {
  const [c, x] = canvas(512, 440);
  x.fillStyle = '#1d7c84'; x.fillRect(0, 0, 512, 440);
  x.strokeStyle = '#e0b048'; x.lineWidth = 14; x.strokeRect(18, 18, 476, 404);
  x.lineWidth = 4; x.strokeRect(44, 44, 424, 352);
  // a gold lotus in the centre, eight petals in two rings, and a scroll in each corner
  x.fillStyle = '#e8bb52';
  for (const [r, n, w] of [[150, 8, 0.32], [100, 8, 0.36]] as const) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (r === 100 ? Math.PI / 8 : 0);
      x.beginPath();
      x.moveTo(256, 220);
      x.quadraticCurveTo(256 + Math.cos(a - w) * r, 220 + Math.sin(a - w) * r, 256 + Math.cos(a) * r, 220 + Math.sin(a) * r);
      x.quadraticCurveTo(256 + Math.cos(a + w) * r, 220 + Math.sin(a + w) * r, 256, 220);
      x.fill();
    }
  }
  x.fillStyle = '#1d7c84'; x.beginPath(); x.arc(256, 220, 34, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#e8bb52'; x.beginPath(); x.arc(256, 220, 24, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#e0b048'; x.lineWidth = 6;
  for (const [cx, cy, sx, sy] of [[70, 70, 1, 1], [442, 70, -1, 1], [70, 370, 1, -1], [442, 370, -1, -1]] as const) {
    x.beginPath();
    for (let k = 0; k <= 40; k++) { const a = k * 0.25, r = 4 + k * 1.1; x.lineTo(cx + sx * (Math.cos(a) * r + 20), cy + sy * (Math.sin(a) * r + 20)); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

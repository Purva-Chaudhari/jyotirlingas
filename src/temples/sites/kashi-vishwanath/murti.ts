import * as THREE from 'three';
import type { Flames, Physics } from '../../engine/kit';
import type { KM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './shivling';
import { lathe } from './spire';

/**
 * The murtis of the shrines round Vishwanath (Wikipedia lists small temples for Kala Bhairava, Kartikeya,
 * Avimukteshwara, Vishnu, Ganesha, Shani, Shiva and Parvati in the complex): carved and dressed images, not lingas,
 * as a pilgrim sees them through a shrine door: on a stepped pedestal before a brass halo, clothed, crowned and
 * garlanded, each with its own attributes and mount.
 *  - Vishnu: dark stone, four-armed (discus, conch, mace, lotus), yellow pitambar, a tall gold kirita;
 *  - Parvati (Gauri): dressed in a red saree with a veil, gold crown and nose ring;
 *  - Ganesha: seated, daubed orange with sindoor, a modak in hand, his mouse before him;
 *  - Kartikeya: standing with his spear, his peacock beside him;
 *  - Kala Bhairava: the silver face with wide eyes and moustache, sindoor and dark cloth, trident, his dog;
 *  - Shani: a black stone image glossy with mustard oil, silver eyes, black cloth, a crow, oil lamps.
 */
export type Deity = 'vishnu' | 'parvati' | 'ganesha' | 'kartikeya' | 'bhairava' | 'shani';

const mat = (color: number, rough = 0.6, metal = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, ...extra });
const M = {
  sindoor: mat(0xd9531e, 0.45, 0, { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
  oiled: mat(0x0b0a09, 0.25, 0, { clearcoat: 1, clearcoatRoughness: 0.08 }),
  darkStone: mat(0x1c1a18, 0.35, 0, { clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  gold: mat(0xd8ad4c, 0.3, 1),
  silver: mat(0xdcdde0, 0.25, 1),
  brass: mat(0xb8893a, 0.35, 1),
  red: mat(0xa8151d, 0.85, 0, { sheen: 0.6, sheenColor: new THREE.Color(0xff6060) }),
  yellow: mat(0xe2a91c, 0.85, 0, { sheen: 0.5, sheenColor: new THREE.Color(0xfff0a0) }),
  green: mat(0x1d6b3a, 0.85, 0, { sheen: 0.5, sheenColor: new THREE.Color(0x80ffb0) }),
  black: mat(0x15151a, 0.9),
  white: mat(0xf2ede2, 0.4),
  marble: mat(0xf1ece3, 0.35, 0, { clearcoat: 0.4 }),
  pink: mat(0xe07a9a, 0.7),
  peacock: mat(0x1b4f9c, 0.4, 0.2, { sheen: 1, sheenColor: new THREE.Color(0x40ffd0) }),
  tail: mat(0x2b7a5a, 0.5, 0.2, { sheen: 1, sheenColor: new THREE.Color(0x60a0ff), side: THREE.DoubleSide }),
  grey: mat(0x8a8178, 0.8),
  eye: mat(0xffffff, 0.3),
  iris: mat(0x0a0a0a, 0.3),
};

/** Builds one dressed murti; local +z faces the devotee. Returns the pedestal's top height above y. */
export function murti(B: Merger, K: KM, O: Offerings, P: Physics, flames: Flames, deity: Deity, x: number, y: number, z: number, ry: number) {
  const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  const at = (m: THREE.Material, g: THREE.BufferGeometry, lx: number, ly: number, lz: number, rx = 0, ryl = 0, rz = 0, s: number | [number, number, number] = 1) => {
    const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    const local = new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ryl, rz, 'YXZ')), sc);
    B.add(m, g, base.clone().multiply(local));
  };
  const w = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyMatrix4(base);
  const sphere = (r: number) => new THREE.SphereGeometry(r, 28, 18);
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const rod = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 12);

  // ---------- stepped pedestal and the brass halo behind ----------
  at(K.marble, new THREE.BoxGeometry(0.78, 0.16, 0.56), 0, 0.08, 0);
  at(K.marble, new THREE.BoxGeometry(0.66, 0.14, 0.46), 0, 0.23, 0);
  const top = 0.3;
  const wp = w(0, 0, 0);
  P.solid(wp.x - 0.45, y, wp.z - 0.45, wp.x + 0.45, y + 1.4, wp.z + 0.45);
  const halo = (hy: number, r: number) => {
    at(M.brass, new THREE.TorusGeometry(r, 0.022, 10, 48, Math.PI * 1.2), 0, hy, -0.14, 0, 0, -Math.PI * 0.1);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.1 + (i / 8) * Math.PI * 1.2;
      at(M.brass, new THREE.ConeGeometry(0.028, 0.08, 8), Math.cos(a) * (r + 0.05), hy + Math.sin(a) * (r + 0.05), -0.14, 0, 0, a - Math.PI / 2);
    }
  };
  const garland = (ly: number, half: number, sag: number, lz = 0.11) => O.strand(w(-half, ly, lz), w(half, ly, lz), sag, 0.9);

  // ---------- a standing figure: robe, torso, head, crown, arms (front +z) ----------
  const stand = (body: THREE.Material, cloth: THREE.Material, crown: 'kirita' | 'mukut' | 'none', H = 0.82) => {
    const k = H / 0.82;
    at(cloth, lathe([[0.15, 0], [0.16, 0.06], [0.14, 0.3], [0.12, 0.42], [0, 0.43]].map(([r, h]) => [r * k, h * k] as [number, number]), 32), 0, top, 0);
    at(body, lathe([[0.115, 0], [0.13, 0.08], [0.145, 0.18], [0.12, 0.25], [0.05, 0.28], [0, 0.29]].map(([r, h]) => [r * k, h * k] as [number, number]), 32), 0, top + 0.42 * k, 0);
    at(body, rod(0.035 * k, 0.05 * k), 0, top + 0.72 * k, 0);
    const hy = top + 0.8 * k;
    at(body, sphere(0.075 * k), 0, hy, 0, 0, 0, 0, [1, 1.12, 0.95]);
    if (crown === 'kirita') at(M.gold, lathe([[0.07, 0], [0.075, 0.02], [0.06, 0.1], [0.045, 0.17], [0.02, 0.21], [0, 0.23]].map(([r, h]) => [r * k, h * k] as [number, number]), 20, 10, 0.08), 0, hy + 0.05 * k, 0);
    if (crown === 'mukut') at(M.gold, lathe([[0.075, 0], [0.08, 0.03], [0.065, 0.07], [0.03, 0.1], [0, 0.11]].map(([r, h]) => [r * k, h * k] as [number, number]), 20, 12, 0.1), 0, hy + 0.04 * k, 0);
    // a tilak and the eyes, painted
    at(K.kumkum, new THREE.BoxGeometry(0.012 * k, 0.035 * k, 0.01), 0, hy + 0.035 * k, 0.07 * k);
    for (const s of [-1, 1]) {
      at(M.eye, sphere(0.014 * k), s * 0.026 * k, hy + 0.008 * k, 0.062 * k, 0, 0, 0, [1.3, 0.8, 0.5]);
      at(M.iris, sphere(0.007 * k), s * 0.026 * k, hy + 0.008 * k, 0.069 * k);
    }
    return { hy, k, shoulder: top + 0.66 * k };
  };
  /** an arm from the shoulder (side s), raised by `lift` (0 = down, 1 = forearm up), holding at its hand */
  const arm = (m: THREE.Material, s: number, sh: number, k: number, lift: number, out = 0.35): THREE.Vector3 => {
    const len = 0.26 * k, sx = s * 0.15 * k;
    const ang = s * (out + lift * 0.5);
    at(m, cap(0.026 * k, len), sx, sh - len / 2 * Math.cos(out), 0.02, -lift * 1.2, 0, ang * 0.6);
    return new THREE.Vector3(sx + s * Math.sin(out) * len * 0.6, sh - len * (1 - lift * 1.4) * 0.75, 0.02 + lift * 0.16 * k);
  };

  switch (deity) {
    case 'vishnu': {
      halo(top + 0.78, 0.36);
      const { hy, k, shoulder } = stand(M.darkStone, M.yellow, 'kirita', 0.9);
      // four arms: the upper pair raised with the discus and the conch, the lower with the mace and the lotus
      for (const s of [-1, 1]) {
        const up = arm(M.darkStone, s, shoulder, k, 1, 0.9);
        if (s > 0) at(M.gold, new THREE.TorusGeometry(0.06, 0.016, 8, 24), up.x, up.y + 0.06, up.z);
        else at(M.white, sphere(0.045), up.x, up.y + 0.05, up.z, 0, 0, 0.6, [0.7, 1.4, 0.7]);
        const lo = arm(M.darkStone, s, shoulder - 0.02, k, 0.25, 0.35);
        if (s > 0) { at(M.gold, rod(0.014, 0.42), lo.x + 0.03, top + 0.25, lo.z + 0.03); at(M.gold, sphere(0.045), lo.x + 0.03, top + 0.47, lo.z + 0.03); }
        else at(M.pink, lathe([[0, 0], [0.04, 0.02], [0.05, 0.05], [0.03, 0.07], [0, 0.06]], 12, 8, 0.25), lo.x, lo.y, lo.z + 0.02);
      }
      // the Kaustubha on the chest, a gold necklace and a long garland of tulsi and marigold
      at(M.gold, sphere(0.022), 0, top + 0.6 * k, 0.13 * k);
      garland(top + 0.66 * k, 0.12, 0.32);
      void hy;
      break;
    }
    case 'parvati': {
      halo(top + 0.74, 0.32);
      const { hy, k, shoulder } = stand(M.marble, M.red, 'mukut', 0.8);
      // the saree's pallu as a veil over the head and shoulders, with a gold border
      at(M.red, lathe([[0, 0.2], [0.07, 0.18], [0.11, 0.1], [0.16, -0.08], [0.18, -0.2], [0.17, -0.21], [0.1, -0.02], [0, 0.1]], 32), 0, hy + 0.02, -0.01, -0.08);
      at(M.gold, new THREE.TorusGeometry(0.17, 0.008, 6, 40), 0, hy - 0.18, 0.0, Math.PI / 2 - 0.08);
      for (const s of [-1, 1]) {
        const h = arm(M.marble, s, shoulder, k, s > 0 ? 0.9 : 0.3, 0.3);
        if (s > 0) at(M.gold, new THREE.TorusGeometry(0.02, 0.004, 6, 16), h.x, h.y + 0.02, h.z, Math.PI / 2); // a raised hand, blessing
      }
      at(M.gold, new THREE.TorusGeometry(0.012, 0.0025, 6, 16), 0.03 * k, hy - 0.025, 0.07 * k, 0, Math.PI / 2); // the nath
      at(M.green, lathe([[0.17, 0], [0.18, 0.02], [0.17, 0.05], [0, 0.05]], 32), 0, top, 0); // a green border at the hem
      garland(top + 0.62 * k, 0.11, 0.28);
      break;
    }
    case 'ganesha': {
      halo(top + 0.7, 0.36);
      // seated: a cushion, the crossed legs, the great belly, the elephant head with fanned ears and the trunk
      at(M.red, lathe([[0.28, 0], [0.29, 0.04], [0.27, 0.08], [0, 0.08]], 32), 0, top, 0);
      at(M.sindoor, sphere(0.14), 0, top + 0.13, 0.06, 0, 0, 0, [1.7, 0.6, 1.0]);
      at(M.sindoor, sphere(0.17), 0, top + 0.3, 0.03, 0, 0, 0, [1, 1, 0.9]);
      at(M.sindoor, sphere(0.12), 0, top + 0.46, -0.02);
      const hy = top + 0.6;
      at(M.sindoor, sphere(0.11), 0, hy, 0.0, 0, 0, 0, [1, 0.95, 0.95]);
      for (const s of [-1, 1]) at(M.sindoor, sphere(0.1), s * 0.13, hy + 0.01, -0.03, 0, s * 0.4, 0, [1, 1.1, 0.18]);
      const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, hy - 0.02, 0.09), new THREE.Vector3(0, hy - 0.12, 0.14), new THREE.Vector3(0.03, hy - 0.22, 0.15), new THREE.Vector3(0.09, hy - 0.26, 0.13), new THREE.Vector3(0.11, hy - 0.2, 0.12)]);
      at(M.sindoor, new THREE.TubeGeometry(trunk, 24, 0.028, 10, false), 0, 0, 0);
      at(M.white, new THREE.ConeGeometry(0.012, 0.07, 8), -0.05, hy - 0.05, 0.09, Math.PI * 0.55); // the one tusk
      for (const s of [-1, 1]) {
        at(M.eye, sphere(0.012), s * 0.04, hy + 0.03, 0.09);
        at(M.iris, sphere(0.006), s * 0.04, hy + 0.03, 0.1);
      }
      at(M.gold, lathe([[0.075, 0], [0.08, 0.03], [0.06, 0.08], [0.03, 0.12], [0, 0.14]], 20, 12, 0.1), 0, hy + 0.07, -0.01);
      // four arms: noose and goad raised, a bowl of modaks, the hand of blessing
      for (const s of [-1, 1]) {
        at(M.sindoor, cap(0.035, 0.16), s * 0.22, top + 0.5, 0.0, 0, 0, s * 0.9);
        at(M.sindoor, cap(0.035, 0.16), s * 0.2, top + 0.3, 0.12, -1.1, 0, s * 0.3);
      }
      at(M.gold, rod(0.008, 0.18), 0.3, top + 0.62, 0, 0, 0, 0.3);
      at(M.brass, lathe([[0, 0], [0.06, 0], [0.07, 0.03], [0, 0.03]], 20), -0.2, top + 0.24, 0.2);
      for (let i = 0; i < 5; i++) at(M.white, new THREE.ConeGeometry(0.016, 0.03, 8), -0.2 + Math.cos(i * 1.3) * 0.03, top + 0.28 + (i > 3 ? 0.02 : 0), 0.2 + Math.sin(i * 1.3) * 0.03);
      // the mouse, Mushak, before him on the pedestal
      at(M.grey, sphere(0.05), 0.16, top + 0.04, 0.2, 0, 0, 0, [0.8, 0.7, 1.4]);
      at(M.grey, sphere(0.03), 0.16, top + 0.06, 0.27);
      for (const s of [-1, 1]) at(M.pink, sphere(0.014), 0.16 + s * 0.018, top + 0.09, 0.26, 0, 0, 0, [1, 1, 0.3]);
      at(M.yellow, lathe([[0.3, 0], [0.3, 0.02], [0, 0.02]], 32), 0, top + 0.02, 0); // a yellow cloth under him
      O.strand(w(-0.2, top + 0.42, 0.18), w(0.2, top + 0.42, 0.18), 0.22, 0.9);
      break;
    }
    case 'kartikeya': {
      halo(top + 0.74, 0.32);
      const { k, shoulder } = stand(M.sindoor, M.red, 'mukut', 0.78);
      // the spear (shakti / vel) in his right hand, a leaf-shaped blade at the top
      const h = arm(M.sindoor, 1, shoulder, k, 0.7, 0.4);
      at(M.gold, rod(0.01, 1.05), h.x + 0.02, top + 0.55, h.z);
      at(M.gold, new THREE.SphereGeometry(0.04, 16, 10), h.x + 0.02, top + 1.12, h.z, 0, 0, 0, [0.6, 1.8, 0.2]);
      arm(M.sindoor, -1, shoulder, k, 0.9, 0.3); // the left hand raised, blessing
      garland(top + 0.62 * k, 0.11, 0.26);
      // his peacock, Paravani, beside him: body, neck, head with its crest, and the fanned tail behind
      const px = -0.24, pz = 0.06, py = top;
      at(M.peacock, sphere(0.07), px, py + 0.12, pz, 0, 0, 0, [0.8, 0.9, 1.4]);
      at(M.peacock, cap(0.02, 0.12), px, py + 0.24, pz + 0.07, 0.35);
      at(M.peacock, sphere(0.03), px, py + 0.32, pz + 0.1);
      for (let i = 0; i < 3; i++) at(M.peacock, rod(0.003, 0.05), px + (i - 1) * 0.01, py + 0.36, pz + 0.09);
      for (const s of [-1, 1]) at(M.gold, rod(0.006, 0.08), px + s * 0.025, py + 0.04, pz);
      for (let i = 0; i < 11; i++) {
        const a = -0.9 + (i / 10) * 1.8;
        at(M.tail, new THREE.PlaneGeometry(0.06, 0.38), px + Math.sin(a) * 0.14, py + 0.12 + Math.cos(a) * 0.17, pz - 0.1, 0, 0, -a);
        at(M.peacock, sphere(0.016), px + Math.sin(a) * 0.3, py + 0.12 + Math.cos(a) * 0.34, pz - 0.095, 0, 0, 0, [1, 1, 0.3]);
      }
      break;
    }
    case 'bhairava': {
      halo(top + 0.76, 0.34);
      // the image is clothed and garlanded to the chin: only the silver face shows, with wide eyes and a moustache
      at(M.black, lathe([[0.2, 0], [0.21, 0.05], [0.18, 0.35], [0.16, 0.55], [0.1, 0.62], [0, 0.63]], 32), 0, top, 0);
      const hy = top + 0.74;
      at(M.silver, sphere(0.11), 0, hy, 0, 0, 0, 0, [1, 1.12, 0.9]);
      for (const s of [-1, 1]) {
        at(M.eye, sphere(0.026), s * 0.042, hy + 0.022, 0.088, 0, 0, 0, [1.25, 1, 0.45]);
        at(M.iris, sphere(0.013), s * 0.042, hy + 0.022, 0.098);
        at(M.black, cap(0.01, 0.07), s * 0.04, hy - 0.04, 0.09, 0, 0, s * 1.15); // the moustache
      }
      at(K.kumkum, new THREE.BoxGeometry(0.06, 0.018, 0.01), 0, hy + 0.07, 0.093); // a band of sindoor on the brow
      // an orange cloth tied round the head, and a small silver crown above it
      at(M.sindoor, new THREE.TorusGeometry(0.1, 0.022, 10, 32), 0, hy + 0.075, -0.005, Math.PI / 2 + 0.15);
      at(M.silver, lathe([[0.075, 0], [0.08, 0.025], [0.06, 0.06], [0.03, 0.09], [0, 0.1]], 20, 12, 0.12), 0, hy + 0.09, -0.01);
      // the trident behind his right shoulder, a black cloth over him, red at the hem
      at(M.silver, rod(0.009, 1.1), 0.22, top + 0.55, -0.06);
      for (const u of [-0.05, 0, 0.05]) at(M.silver, new THREE.ConeGeometry(0.012, u === 0 ? 0.12 : 0.09, 8), 0.22 + u, top + 1.13 + (u === 0 ? 0.02 : 0), -0.06);
      at(M.silver, new THREE.TorusGeometry(0.05, 0.007, 6, 16, Math.PI), 0.22, top + 1.08, -0.06, 0, 0, Math.PI);
      at(M.red, lathe([[0.215, 0], [0.22, 0.08], [0, 0.08]], 32), 0, top, 0);
      garland(top + 0.62, 0.13, 0.3);
      O.strand(w(-0.15, top + 0.5, 0.17), w(0.15, top + 0.5, 0.17), 0.22, 0.9);
      // his dog, at his feet
      const dx = 0.27, dz = 0.12;
      at(M.black, cap(0.04, 0.12), dx, top + 0.1, dz, Math.PI / 2);
      at(M.black, sphere(0.035), dx, top + 0.18, dz + 0.11);
      at(M.black, cap(0.012, 0.04), dx, top + 0.16, dz + 0.15, Math.PI / 2);
      for (const [u, v] of [[-0.025, -0.06], [0.025, -0.06], [-0.025, 0.06], [0.025, 0.06]]) at(M.black, rod(0.01, 0.09), dx + u, top + 0.045, dz + v);
      break;
    }
    case 'shani': {
      // a black stone image, glossy with the mustard oil poured over it every Saturday: silver eyes, black cloth
      halo(top + 0.66, 0.3);
      at(M.oiled, lathe([[0.17, 0], [0.18, 0.05], [0.16, 0.4], [0.12, 0.6], [0.06, 0.7], [0, 0.72]], 32), 0, top, 0);
      const hy = top + 0.6;
      for (const s of [-1, 1]) {
        at(M.silver, sphere(0.022), s * 0.045, hy, 0.11, 0, 0, 0, [1.3, 0.8, 0.4]);
        at(M.iris, sphere(0.01), s * 0.045, hy, 0.118);
      }
      at(K.kumkum, new THREE.BoxGeometry(0.012, 0.04, 0.01), 0, hy + 0.05, 0.12);
      at(M.silver, lathe([[0.09, 0], [0.095, 0.03], [0.07, 0.07], [0, 0.09]], 20, 10, 0.1), 0, top + 0.68, 0);
      at(M.black, lathe([[0.185, 0.25], [0.19, 0.27], [0.18, 0.42], [0.15, 0.44], [0, 0.44]], 32), 0, top, 0); // the black cloth
      at(M.oiled, lathe([[0.24, 0], [0.25, 0.015], [0, 0.015]], 32), 0, top, 0); // a pool of oil round the base
      // his crow, and iron lamps of mustard oil on the pedestal's step
      const cx = 0.25, cz = 0.1;
      at(M.black, sphere(0.04), cx, top + 0.07, cz, 0, 0, 0, [0.8, 0.8, 1.5]);
      at(M.black, sphere(0.025), cx, top + 0.13, cz + 0.05);
      at(M.black, new THREE.ConeGeometry(0.008, 0.04, 6), cx, top + 0.13, cz + 0.085, Math.PI / 2);
      garland(top + 0.5, 0.12, 0.25);
      break;
    }
  }
  // lamps and flowers on the pedestal's lower step, in front
  for (const s of [-1, 1]) {
    const l = w(s * 0.28, 0.17, 0.22);
    flames.points.push(new THREE.Vector3(l.x, l.y + 0.03, l.z));
    at(M.brass, lathe([[0, 0], [0.03, 0], [0.035, 0.015], [0, 0.012]], 12), s * 0.28, 0.16, 0.22);
  }
  const f = w(0, 0.31, 0.16);
  O.heap(f.x, f.y, f.z, 0.08, 0.04, 6);
  return top;
}

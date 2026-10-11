import * as THREE from 'three';
import type { KM } from './mats';
import type { Offerings } from './shivling';

/**
 * The great Nandi of the Gyanvapi mandap: a seated bull of polished dark stone (≈ 2.3 m long),
 * sculpted from deformed smooth forms (no seams) — humped back, deep dewlap, folded legs, curved
 * horns — with a carved harness: a beaded collar with a row of bells, a forehead band, a saddle
 * cloth with a gold border, and a marigold garland. Faces +x (north). No face detail is drawn.
 */

function deformed(seg: number, fn: (v: THREE.Vector3) => void) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

const bump = (x: number, c: number, w: number) => Math.exp(-((x - c) ** 2) / w);

export function nandi(g: THREE.Group, K: KM, O: Offerings, x: number, y: number, z: number, scale = 1.15) {
  const n = new THREE.Group();
  n.position.set(x, y, z);
  n.scale.setScalar(scale);
  g.add(n);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    n.add(m);
    return m;
  };

  // moulded plinth
  add(new THREE.BoxGeometry(2.7, 0.18, 1.5), K.temple, 0, 0.09, 0);
  add(new THREE.BoxGeometry(2.55, 0.12, 1.38), K.templePlain, 0, 0.24, 0);
  add(new THREE.BoxGeometry(2.62, 0.08, 1.44), K.temple, 0, 0.34, 0);

  // body: one smooth mass with the hump over the shoulders, broad haunch, flat belly resting on the plinth
  const body = deformed(48, (v) => {
    v.x *= 1.1; v.y *= 0.5; v.z *= 0.5;
    v.y += 0.24 * bump(v.x, 0.45, 0.05) * Math.max(0, v.y / 0.5);
    v.z *= 1 + 0.16 * bump(v.x, -0.7, 0.1) + 0.08 * bump(v.x, 0.5, 0.08);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.25;
  });
  add(body, K.nandi, -0.05, 0.72, 0);
  // folded forelegs (knees forward) and hind legs tucked along the sides
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.12, 0.42, 6, 12), K.nandi, 0.72, 0.5, s * 0.3, 0, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.1, 12, 8), K.nandi, 0.98, 0.48, s * 0.3);
    add(new THREE.CapsuleGeometry(0.15, 0.62, 6, 12), K.nandi, -0.55, 0.5, s * 0.46, 0, 0, Math.PI / 2 - 0.12);
    add(new THREE.SphereGeometry(0.17, 14, 10), K.nandi, -0.72, 0.68, s * 0.47);
  }
  // neck with deep dewlap, then the head held up, muzzle forward
  const neck = deformed(32, (v) => {
    v.x *= 0.3; v.y *= 0.36; v.z *= 0.27;
    if (v.y < 0) v.y *= 1 + 0.9 * bump(v.z, 0, 0.02); // dewlap hangs in the middle
  });
  add(neck, K.nandi, 0.8, 1.02, 0, 0, 0, -0.35);
  const head = deformed(32, (v) => {
    v.x *= 0.34; v.y *= 0.2; v.z *= 0.18;
    const t = Math.max(0, v.x / 0.34);
    v.y *= 1 - 0.25 * t; v.z *= 1 - 0.3 * t; // tapering to the muzzle
  });
  add(head, K.nandi, 1.12, 1.24, 0, 0, 0, -0.42);
  add(new THREE.SphereGeometry(0.11, 16, 12).scale(0.9, 0.8, 1.1), K.nandi, 1.33, 1.08, 0);
  // ears and curved horns
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.1, 12, 8).scale(1, 0.4, 0.7), K.nandi, 1.02, 1.33, s * 0.2, s * 0.4, 0, 0);
    const horn = new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI * 0.55);
    add(horn, K.nandi, 0.98, 1.42, s * 0.1, 0, s * 0.9, Math.PI * 0.35);
  }
  // tail curled along the haunch
  add(new THREE.TorusGeometry(0.3, 0.035, 6, 20, Math.PI * 0.9), K.nandi, -0.95, 0.6, 0.45, Math.PI / 2, 0, 0.6);

  // carved harness: beaded collar with bells, forehead band, saddle cloth with gold border
  add(new THREE.TorusGeometry(0.3, 0.035, 8, 32), K.brass, 0.78, 1.05, 0, 0, Math.PI / 2, -0.35);
  for (let i = 0; i < 9; i++) {
    const a = -1.0 + (i / 8) * 2.0;
    const bx = 0.86 + Math.sin(0.35) * 0.0, by = 1.05 - Math.cos(a) * 0.3, bz = Math.sin(a) * 0.3;
    add(new THREE.SphereGeometry(0.045, 10, 8), K.brass, bx, by - 0.03, bz);
  }
  add(new THREE.SphereGeometry(0.09, 14, 10).scale(1, 1.2, 1), K.brass, 0.92, 0.72, 0);
  add(new THREE.TorusGeometry(0.17, 0.018, 6, 24, Math.PI), K.brass, 1.1, 1.3, 0, 0, Math.PI / 2, -0.42);
  const saddle = new THREE.CylinderGeometry(0.62, 0.62, 0.9, 24, 1, true, -Math.PI / 2 - 1.1, 2.2).rotateZ(Math.PI / 2);
  add(saddle, K.redCloth, -0.15, 0.72, 0).scale.set(1, 1.02, 1);
  const border = new THREE.CylinderGeometry(0.63, 0.63, 0.06, 24, 1, true, -Math.PI / 2 - 1.1, 2.2).rotateZ(Math.PI / 2);
  for (const dx of [-0.45, 0.45]) add(border, K.gilt, -0.15 + dx, 0.72, 0);

  // marigold garland over the neck
  O.strand(new THREE.Vector3(x + 0.72 * scale, y + 1.32 * scale, z - 0.3 * scale), new THREE.Vector3(x + 0.72 * scale, y + 1.32 * scale, z + 0.3 * scale), 0.45 * scale, 1.2);
}

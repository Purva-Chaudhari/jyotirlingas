import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';
import { scanMaterial } from '../../engine/materials';

/**
 * Verul's village trees — neem and peepal round the temple walls, the lane and the kund (photos c0, c4,
 * 44_) — as leaf-card canopies (after the Mahakaleshwar grove): one tapered trunk with limbs and one
 * crown of ~900 alpha-tested leaf-cluster cards in irregular lobes, each shared by every tree through an
 * InstancedMesh (3 draws for the whole grove), per-tree scale, squash and rotation.
 */

let seed = 4242;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** a card of small pinnate neem leaflets mixed with rounder peepal-like leaves, dark dusty greens */
function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const greens = ['#2a3d1c', '#33481f', '#3d5526', '#47602c', '#2f421d', '#55703a', '#3a4f24', '#6a7a3e'];
  for (let i = 0; i < 300; i++) {
    const rr = Math.sqrt(rnd()) * 108, a = rnd() * Math.PI * 2;
    const x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr, s = 4 + rnd() * 4, ang = a + Math.PI / 2 + (rnd() - 0.5) * 1.8;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = greens[Math.floor(rnd() * greens.length)];
    if (rnd() < 0.6) {
      // a neem frond: a stalk with paired narrow leaflets
      g.strokeStyle = 'rgba(40,50,20,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 3.2); g.stroke();
      for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) {
        g.beginPath(); g.ellipse(sd * s * 0.45, -s * (0.5 + k * 0.6), s * 0.5, s * 0.17, sd * 0.6, 0, Math.PI * 2); g.fill();
      }
    } else {
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.75, -s * 1.15, 0, -s * 1.9);
      g.bezierCurveTo(s * 0.75, -s * 1.15, s * 0.9, -s * 0.2, 0, 0);
      g.fill();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function villageTrees(g: THREE.Object3D, P: Physics, spots: [number, number, number][], pending?: Promise<unknown>[], solidIf?: (x: number, z: number) => boolean) {
  const bark = scanMaterial('bark_brown_02', 1.0, { tint: 0x8e8378, normalScale: 1.3 });
  pending?.push(bark.loaded);
  // unit tree (1 m tall): trunk to 0.45, crown centre ≈ 0.66, radius ≈ 0.36
  const parts: THREE.BufferGeometry[] = [];
  const tprof: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; tprof.push(new THREE.Vector2(0.03 + 0.03 * Math.pow(1 - Math.min(1, t * 4), 2) - 0.012 * t, t * 0.55)); }
  parts.push(new THREE.LatheGeometry(tprof, 9));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4, l = 0.22;
    const limb = new THREE.CylinderGeometry(0.006, 0.014, l, 6).translate(0, l / 2, 0)
      .rotateZ(-0.75).rotateY(a).translate(0, 0.42 + k * 0.03, 0);
    parts.push(limb);
  }
  const tg = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }))!;
  { const p = tg.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.1; uv[i * 2 + 1] = p.getY(i) * 6; }
    tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  const lobes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rnd(), rr = i === 0 ? 0 : 0.15 + rnd() * 0.12;
    return { c: new THREE.Vector3(Math.cos(a) * rr, (rnd() - 0.4) * 0.12, Math.sin(a) * rr), r: 0.17 + rnd() * 0.09 };
  });
  const cards: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 900; i++) {
    const lb = lobes[Math.floor(rnd() * lobes.length)];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = lb.r * (0.6 + 0.4 * Math.pow(rnd(), 0.6));
    const pos = new THREE.Vector3(lb.c.x + dir.x * rr, lb.c.y + dir.y * rr * 0.7 + 0.66, lb.c.z + dir.z * rr);
    const size = 0.1 + rnd() * 0.06;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - 0.66) / 0.7, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    cards.push(card);
  }
  const crownGeo = mergeGeometries(cards)!;
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  const coreGeo = mergeGeometries(lobes.map(({ c, r }) => new THREE.SphereGeometry(1, 9, 6).scale(r * 0.72, r * 0.5, r * 0.72).translate(c.x, c.y + 0.66, c.z).toNonIndexed()))!;
  const trunks = new THREE.InstancedMesh(tg, bark.material, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, spots.length);
  const cores = new THREE.InstancedMesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x1c2a12, roughness: 1 }), spots.length);
  const tint = new THREE.Color();
  spots.forEach(([x, z, h], i) => {
    const w = h * (0.9 + rnd() * 0.35);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, -0.1, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28),
      new THREE.Vector3(w, h, h * (0.9 + rnd() * 0.35)));
    trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m); cores.setMatrixAt(i, m);
    crowns.setColorAt(i, tint.setHSL(0.2 + rnd() * 0.08, 0.2 + rnd() * 0.15, 0.68 + rnd() * 0.2));
    if (!solidIf || solidIf(x, z)) P.solid(x - 0.35, 0, z - 0.35, x + 0.35, 4, z + 0.35);
  });
  for (const im of [trunks, crowns]) { im.castShadow = true; im.receiveShadow = true; }
  for (const im of [trunks, crowns, cores]) im.computeBoundingSphere();
  g.add(trunks, crowns, cores);
}

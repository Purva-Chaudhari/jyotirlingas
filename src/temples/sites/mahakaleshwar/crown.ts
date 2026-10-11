import * as THREE from 'three';
import type { Materials } from '../../engine/materials';
import { worldUV } from '../../engine/materials';
import type { MahakalMats } from './mats';

/**
 * The gilded crown of Mahakaleshwar's spire, from close-ups taken in 2024–25:
 * a square stone platform; a broad gilded bell (ghanta) embossed with lotus petals;
 * a ribbed cushion; a ribbed, pointed kalash; a horseshoe-shaped sunburst halo of
 * thin gold rays framing the kalash; the main flagpole to the left with a saffron
 * triangular dhwaja at the top and a small metal pennant halfway; and a slender
 * rod beside it ending in a tiny trident.
 */

/** Triangular saffron pennant that ripples in the wind. */
export class Pennant {
  mesh: THREE.Mesh;
  private base: Float32Array;
  constructor(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, len: number, hgt: number) {
    // a subdivided plane squeezed into a triangle: hoisted at the pole (x = 0), point out along +x
    const pg = new THREE.PlaneGeometry(len, hgt, 16, 8);
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + len / 2) / len, v = (p.getY(i) + hgt / 2) / hgt; // 0..1
      const halfSpan = (1 - u) * 0.5 + u * 0.03;
      p.setXYZ(i, u * len, -0.5 * hgt + (v - 0.5) * 2 * halfSpan * hgt, 0);
    }
    pg.computeVertexNormals();
    this.mesh = new THREE.Mesh(pg, mat);
    this.mesh.position.set(x, y, z);
    this.mesh.castShadow = true;
    parent.add(this.mesh);
    this.base = (pg.attributes.position.array as Float32Array).slice();
  }
  update(t: number) {
    const pa = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const bx = this.base[i * 3], by = this.base[i * 3 + 1];
      pa.setZ(i, Math.sin(bx * 2.4 - t * 6 + by * 0.6) * 0.16 * bx);
      pa.setY(i, by - bx * 0.05 * (1 + Math.sin(t * 1.3)));
    }
    pa.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

/** Lathe with embossed vertical petals: radius bulges `amp` on `n` lobes where `mask(y)` > 0. */
function petalLathe(prof: [number, number][], segs: number, n: number, amp: number, mask: (y: number) => number) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + amp * mask(y) * Math.pow(Math.abs(Math.cos(a * n * 0.5)), 2.5);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function crown(parent: THREE.Object3D, M: Materials, S: MahakalMats, y: number, topHalf: number) {
  const g = new THREE.Group();
  g.position.y = y;
  parent.add(g);
  const gold = M.gold;
  const W = topHalf * 2;
  const D = W * 0.98; // the lotus skirt's diameter relative to the platform (2025 close-up)

  // stone platform with a moulded edge and a thin gilt band
  const slab = new THREE.Mesh(worldUV(new THREE.BoxGeometry(W * 0.98, 0.22, W * 0.98).translate(0, 0.11, 0), 1), S.spire);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  const lip = new THREE.Mesh(worldUV(new THREE.BoxGeometry(W * 1.02, 0.1, W * 1.02).translate(0, 0.27, 0), 1), S.spire);
  lip.castShadow = true;
  g.add(lip);
  const band = new THREE.Mesh(new THREE.BoxGeometry(W * 1.025, 0.035, W * 1.025), gold);
  band.position.y = 0.3;
  g.add(band);
  let yy = 0.32;

  // stacked gilded tiers (2025 close-up): a flared lotus skirt, two fluted cushion rings
  // separated by necks, and a fluted onion kalash with a petal collar and knob
  const R = D / 2;
  const fluted = (rad: number, h: number, flutes: number) => {
    const prof: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      prof.push([rad * 0.45 + Math.cos(a) * rad * 0.55, h / 2 + Math.sin(a) * h / 2]);
    }
    prof.push([0, h]);
    return petalLathe(prof, 72, flutes, 0.07, () => 1);
  };
  const put = (geo: THREE.BufferGeometry, h: number) => {
    const m = new THREE.Mesh(geo, gold);
    m.position.y = yy;
    m.castShadow = true;
    g.add(m);
    yy += h;
  };
  // lotus skirt: petals turned down over the platform
  const skirt: [number, number][] = [[0, 0], [R * 1.02, 0], [R * 1.0, R * 0.08]];
  for (let i = 1; i <= 8; i++) {
    const a = i / 8;
    skirt.push([R * (1.0 - 0.32 * Math.pow(a, 0.8)), R * (0.08 + 0.3 * a)]);
  }
  skirt.push([0, R * 0.38]);
  put(petalLathe(skirt, 96, 16, 0.12, (h) => (h > R * 0.06 ? 1 : 0)), R * 0.36);
  put(new THREE.CylinderGeometry(R * 0.5, R * 0.6, R * 0.08, 32).translate(0, R * 0.04, 0), R * 0.07);
  put(fluted(R * 0.74, R * 0.3, 24), R * 0.28);
  put(new THREE.CylinderGeometry(R * 0.36, R * 0.42, R * 0.08, 32).translate(0, R * 0.04, 0), R * 0.07);
  put(fluted(R * 0.56, R * 0.24, 20), R * 0.22);
  put(new THREE.CylinderGeometry(R * 0.2, R * 0.26, R * 0.06, 24).translate(0, R * 0.03, 0), R * 0.05);

  // fluted onion kalash with a point
  const kR = R * 0.5;
  const kProf: [number, number][] = [[0, 0], [kR * 0.55, 0], [kR * 0.85, kR * 0.22], [kR, kR * 0.6], [kR * 0.94, kR * 0.95],
    [kR * 0.66, kR * 1.25], [kR * 0.32, kR * 1.42], [kR * 0.22, kR * 1.5], [kR * 0.26, kR * 1.58], [kR * 0.12, kR * 1.7],
    [kR * 0.06, kR * 2.0], [0, kR * 2.25]];
  const kal = new THREE.Mesh(petalLathe(kProf, 48, 12, 0.07, (h) => (h < kR * 1.3 ? 1 : 0)), gold);
  kal.position.y = yy;
  kal.castShadow = true;
  g.add(kal);
  const kCentre = yy + kR * 0.65;
  const crownTop = yy + kR * 2.25;

  // sunburst halo: horseshoe arc (open at the bottom) with thin rays, facing the front
  const halo = new THREE.Group();
  halo.position.set(R * 0.08, kCentre, -R * 0.12);
  g.add(halo);
  const ringR = D * 0.4, arc = Math.PI * 1.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, D * 0.022, 8, 64, arc), gold);
  ring.rotation.z = -Math.PI / 2 + (Math.PI * 2 - arc) / 2; // gap centred at the bottom
  halo.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(ringR * 0.9, D * 0.01, 6, 64, arc), gold);
  inner.rotation.z = ring.rotation.z;
  halo.add(inner);
  const nRays = 60;
  const rayGeo = new THREE.CylinderGeometry(0.008, 0.016, 1, 5).translate(0, 0.5, 0);
  const rays = new THREE.InstancedMesh(rayGeo, gold, nRays);
  const knobGeo = new THREE.SphereGeometry(1, 8, 6);
  const knobs: THREE.Matrix4[] = [];
  for (let i = 0; i < nRays; i++) {
    const a = ring.rotation.z + (i / (nRays - 1)) * arc;
    const long = i % 2 === 0;
    const len = D * (long ? 0.24 : 0.14);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rays.setMatrixAt(i, new THREE.Matrix4().compose(dir.clone().multiplyScalar(ringR), q, new THREE.Vector3(1, len, 1)));
    if (i % 4 === 0) knobs.push(new THREE.Matrix4().compose(dir.clone().multiplyScalar(ringR + len), q, new THREE.Vector3(0.025, 0.025, 0.025)));
  }
  halo.add(rays);
  const knob = new THREE.InstancedMesh(knobGeo, gold, knobs.length);
  knobs.forEach((m, i) => knob.setMatrixAt(i, m));
  halo.add(knob);
  // the arc's two feet curl in onto the bell neck
  for (const sg of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.018, D * 0.018, ringR * 0.6, 6), gold);
    const a = ring.rotation.z + (sg < 0 ? 0 : arc);
    foot.position.set(Math.cos(a) * ringR * 0.75, Math.sin(a) * ringR - ringR * 0.25, 0);
    foot.rotation.z = sg * 0.5;
    halo.add(foot);
  }

  // main flagpole (left of the halo): small metal pennant midway, saffron dhwaja at the top
  const poleX = -D * 0.52, poleZ = 0.05;
  const poleBase = R * 0.7, poleTop = D * 4.6;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, poleTop - poleBase, 8), M.oldSilver);
  pole.position.set(poleX, (poleTop + poleBase) / 2, poleZ);
  g.add(pole);
  for (const h of [poleBase + 0.15, crownTop * 0.8]) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), M.brass);
    clamp.position.set(poleX, h, poleZ);
    g.add(clamp);
  }
  const knobTop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold);
  knobTop.position.set(poleX, poleTop + 0.05, poleZ);
  g.add(knobTop);
  const flag = new Pennant(g, S.flag, poleX + 0.04, poleTop - 0.08, poleZ, D * 1.3, D * 0.95);
  const tinShape = new THREE.Shape();
  tinShape.moveTo(0, 0); tinShape.lineTo(D * 0.42, -D * 0.12); tinShape.lineTo(0, -D * 0.3); tinShape.lineTo(0, 0);
  const tinMat = new THREE.MeshStandardMaterial({ color: 0x8c7650, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide });
  const tin = new THREE.Mesh(new THREE.ShapeGeometry(tinShape), tinMat);
  tin.position.set(poleX + 0.04, crownTop + D * 0.45, poleZ);
  tin.rotation.y = -0.5;
  g.add(tin);

  // slender rod with a small trident, further left and behind
  const rodX = -D * 0.95, rodZ = -0.25, rodTop = D * 2.2;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, rodTop - 0.3, 6), M.oldSilver);
  rod.position.set(rodX, 0.3 + (rodTop - 0.3) / 2, rodZ);
  g.add(rod);
  const tri = new THREE.Group();
  tri.position.set(rodX, rodTop, rodZ);
  g.add(tri);
  const prong = (x: number, h: number, tilt: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.022, h, 6), M.oldSilver);
    m.position.set(x, h / 2, 0);
    m.rotation.z = tilt;
    tri.add(m);
  };
  prong(0, 0.34, 0);
  prong(-0.08, 0.22, 0.25);
  prong(0.08, 0.22, -0.25);
  const bar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI), M.oldSilver);
  bar.rotation.z = Math.PI;
  bar.position.y = 0.06;
  tri.add(bar);

  return { flag, top: y + poleTop };
}

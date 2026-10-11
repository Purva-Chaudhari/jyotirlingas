import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './batch';

/**
 * Plaza shade trees (neem / desi badam, as round the Nageshwar forecourt) built from leaf cards, after the
 * leaf-card approach of the Mallikarjuna and Mahakaleshwar sites (copied, not imported):
 *  - a flared trunk forking into five curving limbs;
 *  - a crown of ~170 alpha-tested leaf-cluster cards on lobes round the limb ends, card normals radiating
 *    from the crown centre so the foliage shades as a soft mass.
 * Instanced: one draw for the trunks and one per crown variant. Unit tree is 1 m tall, scaled per spot.
 */
let rnd = rng(5151);

function leafTexture(kind: 'neem' | 'broad') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const greens = kind === 'neem'
    ? ['#2a4a1c', '#335a22', '#3d6828', '#47752e', '#55853a', '#22401a']
    : ['#2a4c1c', '#355e24', '#41702c', '#4e8034', '#5c8e3c', '#24421a'];
  const leaf = (x: number, y: number, s: number, a: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath();
    if (kind === 'neem') g.ellipse(0, -s * 0.5, s * 0.17, s * 0.55, 0, 0, Math.PI * 2);
    else { g.moveTo(0, 0); g.bezierCurveTo(-s * 0.7, -s * 0.2, -s * 0.6, -s, 0, -s * 1.3); g.bezierCurveTo(s * 0.6, -s, s * 0.7, -s * 0.2, 0, 0); }
    g.fill(); g.restore();
  };
  if (kind === 'neem') {
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2, r0 = rnd() * 40, x0 = 128 + Math.cos(a) * r0, y0 = 128 + Math.sin(a) * r0;
      const len = 70 + rnd() * 40, col = greens[Math.floor(rnd() * greens.length)];
      for (let t = 0; t < 1; t += 0.1) {
        const x = x0 + Math.cos(a) * len * t, y = y0 + Math.sin(a) * len * t, s = 18 * (1 - t * 0.4);
        leaf(x, y, s, a + Math.PI / 2 + 0.9, col); leaf(x, y, s, a + Math.PI / 2 - 0.9 + Math.PI, col);
      }
    }
  } else {
    for (let i = 0; i < 85; i++) {
      const rr = Math.sqrt(rnd()) * 105, a = rnd() * Math.PI * 2;
      leaf(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 14 + rnd() * 9, a + Math.PI / 2 + (rnd() - 0.5) * 1.2, greens[Math.floor(rnd() * greens.length)]);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function trunkGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(0.03 + 0.035 * Math.pow(1 - Math.min(1, t * 4), 2) - 0.01 * t, t * 0.4)); }
  parts.push(new THREE.LatheGeometry(prof, 8).toNonIndexed());
  const ends: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const from = new THREE.Vector3(0, 0.36, 0), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const end = from.clone().add(dir.clone().multiplyScalar(0.22 + 0.06 * (i % 2))).add(new THREE.Vector3(0, 0.22 + 0.04 * (i % 3), 0));
    const mid = from.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.03, 0));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, mid, end]), 3, 0.015 - (i % 2) * 0.002, 5, false).toNonIndexed());
    ends.push(end);
  }
  const geo = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }))!;
  geo.computeVertexNormals();
  return { geo, ends };
}

function crownGeo(ends: THREE.Vector3[], cards: number) {
  const out: THREE.BufferGeometry[] = [];
  const centre = new THREE.Vector3(0, 0.66, 0);
  const lobes = [centre.clone().add(new THREE.Vector3(0, 0.06, 0)), ...ends.map((e) => e.clone().add(new THREE.Vector3(0, 0.06, 0)))];
  for (let i = 0; i < cards; i++) {
    const lobe = lobes[i % lobes.length], R = i % lobes.length === 0 ? 0.26 : 0.2;
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = R * (0.5 + 0.5 * Math.pow(rnd(), 0.6));
    const pos = lobe.clone().add(new THREE.Vector3(dir.x * rr, dir.y * rr * 0.65, dir.z * rr));
    const size = 0.17 + rnd() * 0.09;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - centre.y) / 0.7, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    out.push(card);
  }
  return mergeGeometries(out)!;
}

/** spots: [x, y, z, height, crown spread (xz scale)] */
export function leafTrees(parent: THREE.Object3D, spots: [number, number, number, number, number][], bark: THREE.Material) {
  rnd = rng(5151);
  const { geo: tg, ends } = trunkGeo();
  const variants = [
    { geo: crownGeo(ends, 170), mat: new THREE.MeshStandardMaterial({ map: leafTexture('neem'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }) },
  ]; // (one crown variant: a draw call per variant, and per shadow cascade)
  const trunks = new THREE.InstancedMesh(tg, bark, spots.length);
  const crowns = variants.map((v) => new THREE.InstancedMesh(v.geo, v.mat, spots.length));
  const counts = variants.map(() => 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach(([x, y, z, h, s], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * s * (0.9 + rnd() * 0.3), h, h * s * (0.9 + rnd() * 0.3)));
    trunks.setMatrixAt(i, m);
    const v = i % variants.length;
    crowns[v].setMatrixAt(counts[v], m);
    crowns[v].setColorAt(counts[v]++, c.setHSL(0.24 + rnd() * 0.04, 0.2 + rnd() * 0.15, 0.66 + rnd() * 0.22));
  });
  crowns.forEach((cm, k) => { cm.count = counts[k]; if (cm.instanceColor) cm.instanceColor.needsUpdate = true; });
  for (const im of [trunks, ...crowns]) { im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); }
  crowns.forEach((cm) => { cm.castShadow = true; });
}

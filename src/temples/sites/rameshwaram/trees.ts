import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './batch';

/**
 * (Copied from the Mallikarjuna site, after Mahakaleshwar's leaf cards.) The neem, mango and portia
 * trees in the yards and lanes of Rameswaram town, built from leaf cards:
 *  - a bark-scanned trunk that flares at the foot and forks into four tapered, curving limbs;
 *  - a crown of ~150 alpha-tested leaf-cluster cards on a few lobes round the limb ends, card normals
 *    radiating from the crown centre so the foliage shades as a soft mass;
 *  - two leaf textures (neem: fine pinnate leaflets; broad: rounded leaves) as two crown variants.
 * Everything is instanced: trunks and two crown variants — three draws for all trees.
 * Unit tree: 1 m tall reference, scaled per instance to its height.
 */
let rnd = rng(4141);

function leafTexture(kind: 'neem' | 'broad') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  const greens = kind === 'neem'
    ? ['#24401a', '#2d4d1f', '#365a24', '#406a2a', '#4a7530', '#1f3916']
    : ['#22401a', '#2c4f1e', '#36602a', '#41702f', '#4f7f34', '#1d3616'];
  const leaf = (x: number, y: number, s: number, a: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath();
    if (kind === 'neem') { g.ellipse(0, -s * 0.5, s * 0.17, s * 0.55, 0, 0, Math.PI * 2); } // narrow serrated leaflet
    else { g.moveTo(0, 0); g.bezierCurveTo(-s * 0.7, -s * 0.2, -s * 0.6, -s, 0, -s * 1.3); g.bezierCurveTo(s * 0.6, -s, s * 0.7, -s * 0.2, 0, 0); }
    g.fill(); g.restore();
  };
  if (kind === 'neem') {
    // pinnate sprays: a midrib with paired leaflets, many sprays radiating
    for (let k = 0; k < 16; k++) {
      const a = rnd() * Math.PI * 2, r0 = rnd() * 40, x0 = 128 + Math.cos(a) * r0, y0 = 128 + Math.sin(a) * r0;
      const len = 70 + rnd() * 40, col = greens[Math.floor(rnd() * greens.length)];
      for (let t = 0; t < 1; t += 0.1) {
        const x = x0 + Math.cos(a) * len * t, y = y0 + Math.sin(a) * len * t, s = 18 * (1 - t * 0.4);
        leaf(x, y, s, a + Math.PI / 2 + 0.9, col); leaf(x, y, s, a + Math.PI / 2 - 0.9 + Math.PI, col);
      }
    }
  } else {
    for (let i = 0; i < 80; i++) {
      const rr = Math.sqrt(rnd()) * 105, a = rnd() * Math.PI * 2;
      leaf(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 14 + rnd() * 9, a + Math.PI / 2 + (rnd() - 0.5) * 1.2, greens[Math.floor(rnd() * greens.length)]);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** trunk + four forked limbs, 1 m reference height; returns the limb-end points for the crown lobes */
function trunkGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; prof.push(new THREE.Vector2(0.032 + 0.035 * Math.pow(1 - Math.min(1, t * 4), 2) - 0.012 * t, t * 0.42)); }
  parts.push(new THREE.LatheGeometry(prof, 6).toNonIndexed());
  const ends: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const from = new THREE.Vector3(0, 0.38, 0), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const end = from.clone().add(dir.clone().multiplyScalar(0.2 + 0.05 * (i % 2))).add(new THREE.Vector3(0, 0.24, 0));
    const mid = from.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.02, 0));
    const curve = new THREE.CatmullRomCurve3([from, mid, end]);
    const tube = new THREE.TubeGeometry(curve, 2, 0.016 - (i % 2) * 0.002, 4, false);
    parts.push(tube.toNonIndexed());
    ends.push(end);
  }
  const geo = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }))!;
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.08; uv[i * 2 + 1] = p.getY(i) * 5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return { geo, ends };
}

function crownGeo(ends: THREE.Vector3[], cards: number) {
  const out: THREE.BufferGeometry[] = [];
  const centre = new THREE.Vector3(0, 0.66, 0);
  const lobes = [centre.clone().add(new THREE.Vector3(0, 0.08, 0)), ...ends.map((e) => e.clone().add(new THREE.Vector3(0, 0.05, 0)))];
  for (let i = 0; i < cards; i++) {
    const lobe = lobes[i % lobes.length], R = i % lobes.length === 0 ? 0.24 : 0.19;
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = R * (0.5 + 0.5 * Math.pow(rnd(), 0.6));
    const pos = lobe.clone().add(new THREE.Vector3(dir.x * rr, dir.y * rr * 0.7, dir.z * rr));
    const size = 0.17 + rnd() * 0.09;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - centre.y) / 0.7, p.getZ(k)).sub(new THREE.Vector3(0, 0, 0)).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    out.push(card);
  }
  return mergeGeometries(out)!;
}

/** spots: [x, y, z, height, scaleXZ] in world (already compressed) coordinates */
export function leafTrees(parent: THREE.Object3D, spots: [number, number, number, number, number][], barkMat: THREE.Material, seed = 4141) {
  rnd = rng(seed);
  const { geo: tg, ends } = trunkGeo();
  const variants = [
    { geo: crownGeo(ends, 110), mat: new THREE.MeshStandardMaterial({ map: leafTexture('neem'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }) },
    { geo: crownGeo(ends, 110), mat: new THREE.MeshStandardMaterial({ map: leafTexture('broad'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }) },
  ];
  const trunks = new THREE.InstancedMesh(tg, barkMat, spots.length);
  const crowns = variants.map((v) => new THREE.InstancedMesh(v.geo, v.mat, spots.length));
  const counts = [0, 0];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach(([x, y, z, h, s], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(h * s * (0.9 + rnd() * 0.3), h, h * s * (0.9 + rnd() * 0.3)));
    trunks.setMatrixAt(i, m);
    const v = rnd() < 0.55 ? 0 : 1;
    crowns[v].setMatrixAt(counts[v], m);
    crowns[v].setColorAt(counts[v]++, c.setHSL(0.24 + rnd() * 0.04, 0.2 + rnd() * 0.15, 0.62 + rnd() * 0.25));
  });
  crowns.forEach((cm, k) => { cm.count = counts[k]; if (cm.instanceColor) cm.instanceColor.needsUpdate = true; });
  for (const im of [trunks, ...crowns]) { im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Broadleaf trees of the Mandhata hill (teak, neem, mango, babul scrub - lush in the monsoon, c32 / c01):
 * one BatchedMesh of leaf-card trees with a near and a far level of detail (approach of
 * mahakaleshwar/surroundings.ts canopyTrees, crowd LOD of vaidyanath/crowd.ts). Each crown is alpha-tested cards of
 * small-leaf clusters on a lumpy, flattened shell, with normals radiating from the crown centre so the
 * foliage shades as one soft mass, and a dark inner volume so it never reads see-through.
 * Unit tree: 1 m tall to the crown top; crown centre at 0.62, radius ~0.42.
 */

let sd = 41;
const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

function leafClusterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  // twigs
  g.strokeStyle = 'rgba(60,48,30,0.9)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); g.stroke();
  }
  // small lanceolate leaves (neem / mango-like), dark to light greens
  const greens = ['#2f4f1c', '#3a5e22', '#466d28', '#52792e', '#5e8636', '#2a4418', '#6a9040', '#4a6a24'];
  for (let i = 0; i < 150; i++) {
    const rr = Math.sqrt(rnd()) * 108, a = rnd() * Math.PI * 2;
    const x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr, s = 9 + rnd() * 9;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 1.4);
    g.fillStyle = greens[Math.floor(rnd() * greens.length)];
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-s * 0.42, -s * 0.9, 0, -s * 2.0);
    g.quadraticCurveTo(s * 0.42, -s * 0.9, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,35,10,0.35)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.8); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// solid swatches in the leaf texture's corners: the crown's dark core and the trunk sample these, so
// a whole tree is one geometry and one material
const CORE_UV = [6 / 256, 1 - 6 / 256], BARK_UV = [1 - 6 / 256, 1 - 6 / 256];

function leafTexture() {
  const t = leafClusterTexture();
  const g = (t.image as HTMLCanvasElement).getContext('2d')!;
  g.fillStyle = '#1f3416'; g.fillRect(0, 0, 14, 14);
  g.fillStyle = '#4a3c2e'; g.fillRect(242, 0, 14, 14);
  t.needsUpdate = true;
  return t;
}

function withUV(geo: THREE.BufferGeometry, uv: number[]) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { a[i * 2] = uv[0]; a[i * 2 + 1] = uv[1]; }
  geo.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  return geo;
}

/** one tree: `cards` leaf cards + dark core (+ trunk when near). Non-indexed, position/normal/uv. */
function treeGeometry(cards: number, cardSize: number, coreSeg: [number, number], trunk: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const C = 0.62, R = 0.42;
  const lobes = [[0, 0, 0, 1], [0.18, -0.05, 0.1, 0.7], [-0.15, -0.06, -0.12, 0.72]];
  for (let i = 0; i < cards; i++) {
    const [lx, ly, lz, lr] = lobes[i % 3];
    const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    if (dir.y < -0.6) dir.y *= 0.5;
    const rr = R * lr * (0.62 + 0.38 * Math.pow(rnd(), 0.5));
    const pos = new THREE.Vector3(lx + dir.x * rr, C + ly + dir.y * rr * 0.7, lz + dir.z * rr);
    const size = cardSize * (0.8 + rnd() * 0.4);
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(rnd() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    // keep clear of the solid swatches in the texture's corners
    { const uv = card.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.07 + uv.getX(k) * 0.86, 0.07 + uv.getY(k) * 0.86); }
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k), (p.getY(k) - C) / 0.7, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y * 0.8 + 0.2, v.z);
    }
    parts.push(card.toNonIndexed());
  }
  parts.push(withUV(new THREE.SphereGeometry(1, coreSeg[0], coreSeg[1]).scale(0.3, 0.2, 0.3).translate(0, C - 0.02, 0).toNonIndexed(), CORE_UV));
  if (trunk) {
    const tprof: THREE.Vector2[] = [];
    for (let i = 0; i <= 3; i++) { const t = i / 3; tprof.push(new THREE.Vector2(0.032 + 0.03 * Math.pow(1 - Math.min(1, t * 3), 2) - 0.012 * t, t * 0.6)); }
    parts.push(withUV(new THREE.LatheGeometry(tprof, 5).toNonIndexed(), BARK_UV));
  }
  for (const q of parts) for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') q.deleteAttribute(k);
  return mergeGeometries(parts)!;
}

/**
 * spots: [x, y(ground), z, height]. One BatchedMesh (a single draw, culled per tree) with two levels of detail:
 * near trees have 44 leaf cards, a core and a trunk; beyond `lod` m, 14 larger cards and a core.
 * `skip(cam)` lets the caller ignore helper cameras (e.g. a mirror) for the LOD swap.
 */
export function leafTrees(g: THREE.Object3D, spots: [number, number, number, number][], lod = 140, skip?: (cam: THREE.Camera) => boolean, name = 'trees') {
  const near = treeGeometry(44, 0.3, [7, 4], true), far = treeGeometry(14, 0.46, [5, 3], false);
  const mat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  const n = spots.length;
  const bm = new THREE.BatchedMesh(n, near.attributes.position.count + far.attributes.position.count, 0, mat);
  const gNear = bm.addGeometry(near), gFar = bm.addGeometry(far);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const pos: number[] = [];
  spots.forEach(([x, y, z, h]) => {
    const id = bm.addInstance(gFar);
    const w = h * (0.85 + rnd() * 0.45);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    bm.setMatrixAt(id, m.compose(new THREE.Vector3(x, y - 0.2, z), q, new THREE.Vector3(w, h, w)));
    c.setHSL(0.24 + (rnd() - 0.5) * 0.06, 0.25 + rnd() * 0.25, 0.42 + rnd() * 0.2);
    bm.setColorAt(id, c.multiplyScalar(1.6));
    pos.push(x, z);
  });
  bm.castShadow = false;
  bm.receiveShadow = true;
  bm.name = name;
  const state = new Uint8Array(n);
  const last = new THREE.Vector3(1e9, 0, 0);
  const lod2 = lod * lod;
  const base = bm.onBeforeRender.bind(bm);
  bm.onBeforeRender = (r, sc, cam, geo, mt, gr) => {
    if (!skip?.(cam) && cam.position.distanceToSquared(last) > 9) {
      last.copy(cam.position);
      for (let i = 0; i < n; i++) {
        const dx = pos[i * 2] - cam.position.x, dz = pos[i * 2 + 1] - cam.position.z;
        const s = dx * dx + dz * dz < lod2 ? 2 : 1;
        if (state[i] !== s) { state[i] = s; bm.setGeometryIdAt(i, s === 2 ? gNear : gFar); }
      }
    }
    base(r, sc, cam, geo, mt, gr);
  };
  g.add(bm);
  return bm;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';

/**
 * Baked cavity occlusion for a turned / lofted mass around a vertical axis (a shikhara and its
 * urushringas): each vertex is darkened by how far it sits inside the mass's outer envelope at its
 * height and bearing, so the recesses between the miniature spires, the grooves between the ribs
 * and the undersides of the tiers go dark while the outer bulges stay bright.
 * Writes a `color` attribute (use with a material that has vertexColors: true).
 */
export function bakeCavityAO(geo: THREE.BufferGeometry, cx: number, cz: number, depth: number, strength = 0.65) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  geo.computeBoundingBox();
  const y0 = geo.boundingBox!.min.y, y1 = geo.boundingBox!.max.y;
  const A = 128, H = 220;
  const env = new Float32Array(A * H);
  const bin = (x: number, y: number, z: number) => {
    const a = Math.floor(((Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI * 2)) * A) % A;
    const h = Math.min(H - 1, Math.max(0, Math.floor(((y - y0) / (y1 - y0 + 1e-6)) * H)));
    return [a, h];
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [a, h] = bin(x, y, z);
    const r = Math.hypot(x - cx, z - cz);
    if (r > env[h * A + a]) env[h * A + a] = r;
  }
  // dilate: the envelope spans across a recess (± 3 bearing bins, ± 3 height bins)
  const dil = new Float32Array(A * H);
  for (let h = 0; h < H; h++) {
    for (let a = 0; a < A; a++) {
      let m = 0;
      for (let dh = -3; dh <= 3; dh++) {
        const hh = h + dh;
        if (hh < 0 || hh >= H) continue;
        for (let da = -3; da <= 3; da++) m = Math.max(m, env[hh * A + ((a + da + A) % A)]);
      }
      dil[h * A + a] = m;
    }
  }
  const col = new Float32Array(p.count * 3);
  const radial = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [a, h] = bin(x, y, z);
    const r = Math.hypot(x - cx, z - cz);
    const inset = Math.min(1, Math.max(0, (dil[h * A + a] - r) / depth));
    let ao = 1 - strength * Math.pow(inset, 0.8);
    // faces turned in toward the axis (the sides of a recess) and tier undersides see less sky
    radial.set(x - cx, 0, z - cz).normalize();
    const facing = radial.x * n.getX(i) + radial.z * n.getZ(i);
    if (facing < 0) ao *= 1 + 0.35 * facing;
    if (n.getY(i) < -0.2) ao *= 1 + 0.4 * n.getY(i);
    // a little grime toward the base, brightest toward the crown
    ao *= 0.88 + 0.12 * Math.min(1, (y - y0) / ((y1 - y0) * 0.5));
    ao = Math.max(0.22, ao);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Merge parts (position/normal only), translate, give world UVs and bake cavity AO round (x, z). */
export function aoMass(parts: THREE.BufferGeometry[], x: number, y: number, z: number, depth: number, strength?: number) {
  const g = mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p.clone();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  }), false)!;
  g.translate(x, y, z);
  worldUV(g);
  return bakeCavityAO(g, x, z, depth, strength);
}

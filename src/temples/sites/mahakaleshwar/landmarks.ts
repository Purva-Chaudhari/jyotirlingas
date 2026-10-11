import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';

/**
 * Shri Harsiddhi Mata temple (Shaktipeeth), north-west of Rudra Sagar, ~390 m west of Mahakaleshwar:
 * a recognisable silhouette, simply built. Placed from Esri World Imagery (the red-orange temple at
 * model (-376, -148), long axis east-west, entered from the east) and Commons photos (Harsiddhi Temple,
 * Ujjain 01/02; Harsiddhi Temple, Deepstambha): a red-orange painted hall with a pillared porch and a
 * cream cornice, the main Nagara shikhara over the sanctum and a smaller one, saffron flags — and in
 * the court before it the two famous deepstambhas, dark tapering towers ringed with lamp brackets.
 */
export const HARSIDDHI = { x: -376, z: -148 };

export function buildHarsiddhi(g: THREE.Group, P: Physics) {
  const red = new THREE.MeshStandardMaterial({ color: 0xd0583a, roughness: 0.75 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xeee2cc, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.8 });
  const flag = new THREE.MeshStandardMaterial({ color: 0xd02010, roughness: 0.8, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.8, roughness: 0.35 });
  const { x, z } = HARSIDDHI;
  const reds: THREE.BufferGeometry[] = [], creams: THREE.BufferGeometry[] = [], darks: THREE.BufferGeometry[] = [], golds: THREE.BufferGeometry[] = [];
  const B = (arr: THREE.BufferGeometry[], w: number, h: number, d: number, px: number, py: number, pz: number) =>
    arr.push(new THREE.BoxGeometry(w, h, d).translate(px, py + h / 2, pz).toNonIndexed());
  // plinth and hall (x is east-west along the long axis; the entrance is at the east end)
  B(creams, 26, 1.2, 12, x, 0, z);
  B(reds, 18, 5.5, 8, x - 2, 1.2, z);
  B(creams, 19, 0.4, 9, x - 2, 6.7, z);
  // the porch: a row of pillars under a deep eave, facing east
  for (let k = 0; k < 5; k++) B(reds, 0.6, 4.6, 0.6, x + 8.6, 1.2, z - 3.6 + k * 1.8);
  B(reds, 3.2, 0.6, 9.4, x + 8, 5.8, z);
  B(creams, 3.6, 0.25, 9.8, x + 8, 6.4, z);
  // shikharas: a tall Nagara spire over the sanctum (west), a smaller one over the hall
  const spire = (h: number, r: number) => {
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(r * (1 - 0.82 * Math.pow(t, 1.5)), t * h)); }
    prof.push(new THREE.Vector2(0, h));
    const geo = new THREE.LatheGeometry(prof, 8).rotateY(Math.PI / 8);
    // vertical ribs (urushringas read as flutes from afar)
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.08 * Math.cos(a * 8); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals();
    return geo;
  };
  reds.push(spire(13, 3.6).translate(x - 7, 6.9, z).toNonIndexed());
  reds.push(spire(7.5, 2.4).translate(x + 1, 6.9, z).toNonIndexed());
  for (const [px, top] of [[x - 7, 6.9 + 13], [x + 1, 6.9 + 7.5]] as const) {
    creams.push(new THREE.CylinderGeometry(0.9, 0.9, 0.35, 16).translate(px, top + 0.1, z).toNonIndexed());
    golds.push(new THREE.SphereGeometry(0.35, 10, 8).scale(1, 1.4, 1).translate(px, top + 0.65, z).toNonIndexed());
    darks.push(new THREE.CylinderGeometry(0.04, 0.04, 3, 5).translate(px + 0.4, top + 1.6, z).toNonIndexed());
  }
  // the two deepstambhas in the court before the porch: dark, tapering, ~15 m, ringed with lamp brackets
  for (const dz of [-5, 5]) {
    const sx = x + 22, sz = z + dz;
    B(creams, 3.2, 1.0, 3.2, sx, 0, sz);
    B(darks, 2.4, 0.8, 2.4, sx, 1.0, sz);
    darks.push(new THREE.CylinderGeometry(0.42, 1.0, 13.5, 12).translate(sx, 1.8 + 6.75, sz).toNonIndexed());
    for (let k = 0; k < 17; k++) {
      const y = 2.4 + k * 0.76, r = 1.0 - (k / 17) * 0.58 + 0.38;
      darks.push(new THREE.CylinderGeometry(r, r * 0.92, 0.12, 14).translate(sx, y, sz).toNonIndexed());
    }
    darks.push(new THREE.ConeGeometry(0.6, 1.2, 10).translate(sx, 15.9, sz).toNonIndexed());
    golds.push(new THREE.SphereGeometry(0.22, 8, 6).translate(sx, 16.7, sz).toNonIndexed());
    P.solid(sx - 1.6, 0, sz - 1.6, sx + 1.6, 16, sz + 1.6);
  }
  // the chowk before the compound: stone paving down to the road
  const stones: THREE.BufferGeometry[] = [];
  B(stones, 62, 0.06, 34, x + 6, 0, z + 34);
  // compound wall with a gate on the east
  for (const [w, d, px, pz] of [[60, 0.6, x + 4, z - 16], [60, 0.6, x + 4, z + 16], [0.6, 32, x - 26, z]] as const) B(creams, w, 2.4, d, px, 0, pz);
  for (const pz of [z - 10, z + 10]) B(creams, 0.6, 2.4, 12, x + 34, 0, pz);
  B(reds, 1.4, 6, 1.4, x + 34, 0, z - 3.6); B(reds, 1.4, 6, 1.4, x + 34, 0, z + 3.6); B(reds, 1.6, 1.2, 8.6, x + 34, 6, z);
  const out: THREE.Mesh[] = [];
  for (const [arr, mat] of [[reds, red], [creams, cream], [darks, dark], [golds, gold], [stones, new THREE.MeshStandardMaterial({ color: 0x8e8478, roughness: 0.9 })]] as const) {
    const m = new THREE.Mesh(mergeGeometries(arr.map((a) => { a.deleteAttribute('uv'); return a; }))!, mat);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    out.push(m);
  }
  // saffron-red flags on the spires
  const fg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.6, -0.5, 0, 0, -1.0, 0], 3));
  fg.computeVertexNormals();
  for (const [px, top] of [[x - 7, 6.9 + 13], [x + 1, 6.9 + 7.5]] as const) {
    const f = new THREE.Mesh(fg, flag);
    f.position.set(px + 0.4, top + 3.0, z);
    g.add(f);
  }
  return out;
}

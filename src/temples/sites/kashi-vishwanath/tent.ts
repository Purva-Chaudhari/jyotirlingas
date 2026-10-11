import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';
import type { KM } from './mats';
import type { Merger } from './merge';
import { kalashGeo } from './spire';

/** A white "pagoda" canopy tent: four poles, a pyramid roof with a scalloped valance and a finial. */
export function tent(B: Merger, K: KM, P: Physics, x: number, y: number, z: number, s = 1) {
  const w = 3.2 * s, h = 2.6 * s;
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.box(K.steel, 0.06, h, 0.06, x + u * w, y, z + v * w);
    P.solid(x + u * w - 0.1, y, z + v * w - 0.1, x + u * w + 0.1, y + h, z + v * w + 0.1);
  }
  const roof = new THREE.CylinderGeometry(0.05, w * Math.SQRT2 * 1.04, 2.4 * s, 4, 4, true).rotateY(Math.PI / 4);
  const p = roof.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i);
    const sag = 1 - 0.07 * Math.sin(((yy + 1.2 * s) / (2.4 * s)) * Math.PI);
    p.setX(i, p.getX(i) * sag); p.setZ(i, p.getZ(i) * sag);
  }
  roof.computeVertexNormals();
  B.place(K.canvas, twoSided(roof), x, y + h + 1.2 * s, z);
  // valance with scallops
  const val = new THREE.BoxGeometry(w * 2.08, 0.32 * s, 0.02);
  for (const [dx, dz, ry] of [[0, w * 1.04, 0], [0, -w * 1.04, 0], [w * 1.04, 0, Math.PI / 2], [-w * 1.04, 0, Math.PI / 2]] as const) {
    B.place(K.canvas, val, x + dx, y + h - 0.16 * s, z + dz, ry);
    for (let i = -4; i <= 4; i++) {
      const sc = new THREE.CircleGeometry(0.2 * s, 8, Math.PI, Math.PI);
      const a = i * (w * 2 / 9);
      const [px, pz] = ry === 0 ? [x + a, z + dz] : [x + dx, z + a];
      B.place(K.canvas, twoSided(sc), px, y + h - 0.32 * s, pz, ry);
    }
  }
  B.place(K.steel, kalashGeo(0.35 * s), x, y + h + 2.4 * s - 0.05, z);
}

/**
 * Explicit back faces (flipped winding, negated normals) for thin open sheets. A DoubleSide material
 * is drawn double-sided in the colour pass but the AO pre-pass renders with its own override
 * material, so from under a DoubleSide canopy the AO saw straight through it (the "ghost veil").
 */
function twoSided(geo: THREE.BufferGeometry) {
  const a = geo.index ? geo.toNonIndexed() : geo.clone();
  a.deleteAttribute('uv');
  a.computeVertexNormals();
  const b = a.clone();
  const p = b.attributes.position, n = b.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    for (const attr of [p, n]) {
      const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
      attr.setXYZ(i + 2, x, y, z);
    }
  }
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return mergeGeometries([a, b], false)!;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldUV } from '../../engine/materials';
import type { Physics } from '../../engine/kit';

/**
 * Mahakaleshwar's carved Maratha pillar (photos 2024–25): square moulded pedestal,
 * a square lower shaft, an octagonal middle with bead bands, a round fluted upper
 * section, a pot-and-foliage (ghata-pallava) capital, a square abacus and a
 * four-way bracket capital carrying the lintels.
 */
export function carvedPillarGeometry(h: number, r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const boxAt = (w: number, hh: number, d: number, y: number) => parts.push(new THREE.BoxGeometry(w, hh, d).translate(0, y + hh / 2, 0).toNonIndexed());
  // pedestal: three stepped mouldings
  boxAt(r * 3.0, 0.05 * h, r * 3.0, 0);
  boxAt(r * 2.7, 0.04 * h, r * 2.7, 0.05 * h);
  boxAt(r * 2.4, 0.06 * h, r * 2.4, 0.09 * h);
  // square lower shaft with a projecting band
  boxAt(r * 2.0, 0.2 * h, r * 2.0, 0.15 * h);
  boxAt(r * 2.2, 0.025 * h, r * 2.2, 0.33 * h);
  // octagonal / round upper shaft with bead rings, vase capital
  const p: [number, number][] = [[0, 0.355], [r * 1.0, 0.355], [r * 1.0, 0.37], [r * 0.92, 0.38]];
  for (let k = 0; k < 4; k++) {
    const y = 0.42 + k * 0.075;
    p.push([r * 0.9, y - 0.02], [r * 1.04, y], [r * 1.04, y + 0.012], [r * 0.88, y + 0.025]);
  }
  p.push([r * 0.86, 0.73], [r * 1.0, 0.75], [r * 1.18, 0.79], [r * 1.12, 0.82], [r * 0.8, 0.84], [r * 0.9, 0.86], [r * 1.25, 0.87], [r * 1.25, 0.885], [0, 0.885]);
  const lathe = new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b * h)), 16).toNonIndexed();
  {
    // sixteen shallow flutes on the round upper shaft
    const q = lathe.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const y = q.getY(i) / h;
      if (y < 0.39 || y > 0.72) continue;
      const ang = Math.atan2(q.getZ(i), q.getX(i));
      const k = 1 - 0.06 * Math.pow(Math.abs(Math.sin(ang * 8)), 1.5);
      q.setX(i, q.getX(i) * k);
      q.setZ(i, q.getZ(i) * k);
    }
  }
  parts.push(lathe);
  // ghata-pallava: four leaf tips hanging from the vase capital
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leaf = new THREE.ConeGeometry(r * 0.22, 0.07 * h, 4).rotateX(Math.PI).translate(Math.cos(a) * r * 1.1, 0.77 * h, Math.sin(a) * r * 1.1).toNonIndexed();
    parts.push(leaf);
  }
  // carved panels on the square lower shaft: a sunk rectangle on each face
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const pnl = new THREE.BoxGeometry(r * 1.2, 0.12 * h, 0.02).translate(0, 0.25 * h, r * 1.01).rotateY(a).toNonIndexed();
    parts.push(pnl);
  }
  // abacus and the four-way bracket capital
  boxAt(r * 2.4, 0.03 * h, r * 2.4, 0.885 * h);
  const br = (w: number, d: number, y: number, hh: number) => parts.push(new THREE.BoxGeometry(w, hh, d).translate(0, y + hh / 2, 0).toNonIndexed());
  br(r * 3.4, r * 1.3, 0.915 * h, 0.035 * h);
  br(r * 1.3, r * 3.4, 0.915 * h, 0.035 * h);
  br(r * 4.6, r * 1.2, 0.95 * h, 0.05 * h);
  br(r * 1.2, r * 4.6, 0.95 * h, 0.05 * h);
  const geo = mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }))!;
  geo.computeVertexNormals();
  return worldUV(geo, 1);
}

export function carvedPillars(
  parent: THREE.Object3D, mat: THREE.Material, pts: [number, number][], y: number, h: number, r: number, phys?: Physics,
) {
  const inst = new THREE.InstancedMesh(carvedPillarGeometry(h, r), mat, pts.length);
  pts.forEach(([x, z], i) => {
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z));
    phys?.solid(x - r * 1.2, y, z - r * 1.2, x + r * 1.2, y + h, z + r * 1.2);
  });
  inst.castShadow = inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}

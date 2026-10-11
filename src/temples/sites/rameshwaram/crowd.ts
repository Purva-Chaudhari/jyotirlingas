import * as THREE from 'three';
import { mergeParts, rng } from './batch';
import { nandiMesh } from './nandi';
import { buildCrowd } from '../../engine/crowd';

/**
 * Street and ghat life, all instanced (a handful of draw calls):
 *  - pilgrims from the shared crowd kit (engine/crowd.ts) in its 'south' dress: silk sarees with gold
 *    borders and half-sarees, white veshtis with a shirt or a bare chest and towel, tonsured and
 *    sandal-pasted heads, a few Ayyappa devotees in black. They stand, walk, or wade waist-deep at
 *    Agni Theertham in soaked, darker cloth, some with arms raised to the sea. No faces;
 *  - recumbent street cows; yellow-and-black autorickshaws; parked scooters.
 */

export interface CrowdSpot { x: number; y: number; z: number; ry: number; female: boolean; wading?: boolean; raised?: boolean }

/** All pilgrims as one batched draw (plus one for contact shadows), via the shared crowd kit. */
export function pilgrims(parent: THREE.Object3D, spots: CrowdSpot[], seed = 5) {
  return buildCrowd(parent, spots.map((s, i) => ({
    x: s.x, y: s.y, z: s.z, ry: s.ry,
    kind: s.female ? 'saree' as const : 'kurta' as const,
    pose: s.raised ? 'raised' as const : s.wading ? (i % 3 === 0 ? 'namaste' as const : 'stand' as const) : undefined,
    wet: s.wading,
  })), { seed, outfit: 'south', clearRadius: 0, kanwariyaShare: 0, childShare: 0.06 });
}

/** Recumbent street cows (white and grey zebu), from the Nandi signed-distance body. */
export function cows(parent: THREE.Object3D, at: [number, number, number, number][]) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.9 });
  const proto = nandiMesh(mat, 0.62, 44);
  for (const [x, y, z, ry] of at) {
    const c = new THREE.Mesh(proto.geometry, mat);
    c.position.set(x, y, z);
    c.rotation.y = ry;
    c.castShadow = false;
    c.receiveShadow = true;
    parent.add(c);
  }
}

/** Autorickshaw (TN yellow with a black canopy), ~2.6 m long, facing +z. */
function autoGeo() {
  const Y = 0xf2c418, K = 0x1a1a1a, G = 0x2a2a2a;
  return mergeParts([
    { g: new THREE.BoxGeometry(1.3, 0.55, 2.0).translate(0, 0.5, -0.2), c: Y },
    { g: new THREE.BoxGeometry(1.28, 0.08, 2.05).translate(0, 0.25, -0.2), c: K },
    { g: new THREE.BoxGeometry(0.8, 0.7, 0.55).translate(0, 0.55, 1.0), c: Y },
    { g: new THREE.CylinderGeometry(0.7, 0.7, 2.0, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.75, 1).translate(0, 1.1, -0.15), c: K },
    { g: new THREE.BoxGeometry(1.3, 0.04, 0.05).translate(0, 1.45, 0.85), c: Y },
    { g: new THREE.BoxGeometry(0.06, 0.9, 0.06).translate(0.6, 1.05, 0.82), c: K },
    { g: new THREE.BoxGeometry(0.06, 0.9, 0.06).translate(-0.6, 1.05, 0.82), c: K },
    { g: new THREE.BoxGeometry(1.0, 0.5, 0.04).translate(0, 1.15, 0.84), c: 0x8aa0a8 },
    { g: new THREE.CylinderGeometry(0.22, 0.22, 0.14, 12).rotateZ(Math.PI / 2).translate(0, 0.22, 1.05), c: G },
    { g: new THREE.CylinderGeometry(0.22, 0.22, 0.14, 12).rotateZ(Math.PI / 2).translate(0.58, 0.22, -0.8), c: G },
    { g: new THREE.CylinderGeometry(0.22, 0.22, 0.14, 12).rotateZ(Math.PI / 2).translate(-0.58, 0.22, -0.8), c: G },
  ]);
}

/** Scooter, ~1.8 m, facing +z. */
function scooterGeo() {
  return mergeParts([
    { g: new THREE.BoxGeometry(0.34, 0.45, 1.2).translate(0, 0.45, -0.1), c: 0xffffff },
    { g: new THREE.BoxGeometry(0.3, 0.12, 0.7).translate(0, 0.74, -0.25), c: 0x1a1a1a },
    { g: new THREE.BoxGeometry(0.36, 0.6, 0.12).translate(0, 0.7, 0.55), c: 0xffffff },
    { g: new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5).rotateZ(Math.PI / 2).translate(0, 1.05, 0.55), c: 0x222222 },
    { g: new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12).rotateZ(Math.PI / 2).translate(0, 0.2, 0.7), c: 0x222222 },
    { g: new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12).rotateZ(Math.PI / 2).translate(0, 0.2, -0.65), c: 0x222222 },
  ]);
}

export function vehicles(parent: THREE.Object3D, autos: [number, number, number][], scooters: [number, number, number][], seed = 9) {
  const r = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  const a = new THREE.InstancedMesh(autoGeo(), mat, autos.length);
  autos.forEach(([x, z, ry], i) => a.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1))));
  const s = new THREE.InstancedMesh(scooterGeo(), mat.clone(), scooters.length);
  const SC = [0xc8211a, 0x1f5fbf, 0xf2f2f2, 0x222222, 0x8a8a8a, 0x2e8b57];
  scooters.forEach(([x, z, ry], i) => {
    s.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    s.setColorAt(i, new THREE.Color(SC[Math.floor(r() * SC.length)]));
  });
  for (const im of [a, s]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Performance helpers for the Nageshwar site.
 *
 * mergeStatic(): bakes every static, opaque, non-instanced mesh under `group` into one mesh per
 * (material, shadow flags) — hundreds of draw calls become a few dozen. Walkable floor quads,
 * animated meshes and anything in `keep` are left alone. Also trims shadow casting: nothing below
 * the plinth top (the sun never reaches it) and no small details cast sun shadows.
 */
export function mergeStatic(group: THREE.Group, keep: Set<THREE.Object3D>) {
  group.updateMatrixWorld(true);
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>();
  const victims: THREE.Mesh[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || keep.has(m)) return;
    // shadow policy for everything, merged or not
    box.setFromObject(m);
    box.getSize(size);
    const underground = box.max.y < 0.85;
    const small = size.length() < 0.7;
    if (underground || (small && !(m as THREE.InstancedMesh).isInstancedMesh)) m.castShadow = false;
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      // instanced flowers, beads, bosses: too small to cast a visible sun shadow
      m.geometry.computeBoundingSphere();
      if (m.geometry.boundingSphere!.radius < 0.12 || underground) m.castShadow = false;
      return;
    }
    const mat = m.material as THREE.Material;
    if (Array.isArray(m.material) || !m.visible || mat.transparent || !mat.visible) return;
    if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial)) return;
    if (mat.vertexColors || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    let ancestorKept = false;
    for (let p = m.parent; p; p = p.parent) if (keep.has(p)) ancestorKept = true;
    if (ancestorKept) return;
    const g0 = m.geometry;
    if (!g0.attributes.position || !g0.attributes.normal || g0.morphAttributes.position) return;
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    const key = `${mat.uuid}|${m.castShadow}|${m.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { mat, cast: m.castShadow, recv: m.receiveShadow, geos: [] });
    buckets.get(key)!.geos.push(g);
    victims.push(m);
  });
  for (const v of victims) v.parent?.remove(v);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  for (const { mat, cast, recv, geos } of buckets.values()) {
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    merged.applyMatrix4(inv);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = recv;
    group.add(mesh);
  }
  return { merged: victims.length, buckets: buckets.size };
}

/**
 * Switch the interior point lights on only when the camera is in the passage, antechamber,
 * corridor or sanctum, and the doorway glow only when outside — so the sunlit exterior shades
 * with one point light instead of eight. Driven by an always-drawn, invisible probe mesh.
 */
export function lightZones(group: THREE.Group, inside: THREE.PointLight[], outside: THREE.PointLight[], isInside: (p: THREE.Vector3) => boolean) {
  const probe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  probe.frustumCulled = false;
  const set = (inn: boolean) => {
    for (const l of inside) l.visible = inn;
    for (const l of outside) l.visible = !inn;
  };
  let state: boolean | null = null;
  probe.onBeforeRender = (_r, _s, cam) => {
    const inn = isInside(cam.position);
    if (inn !== state) { state = inn; set(inn); }
  };
  group.add(probe);
  set(false);
}

import * as THREE from 'three';

/** An always-drawn, invisible mesh whose onBeforeRender gives us the camera each frame. */
function probe(group: THREE.Object3D, fn: (cam: THREE.Camera) => void) {
  const m = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  m.frustumCulled = false;
  m.onBeforeRender = (_r, _s, cam) => fn(cam);
  group.add(m);
  return m;
}

/**
 * (After the Mahakaleshwar site.) Interior lamp lights are switched on only when the camera is inside
 * the sanctum complex, so the sunlit courts, corridors and town shade without them.
 */
export function lightZones(group: THREE.Group, inside: THREE.PointLight[], isInside: (p: THREE.Vector3) => boolean) {
  let state: boolean | null = null;
  const set = (inn: boolean) => { for (const l of inside) l.visible = inn; };
  probe(group, (cam) => {
    const inn = isInside(cam.position);
    if (inn !== state) { state = inn; set(inn); }
  });
  set(false);
}

/**
 * The engine's sun shadow covers ±70 m round the origin; this site runs 480 m from the west gopuram
 * to the sea. Re-centre the sun (keeping its direction) on a point just ahead of the camera every
 * frame, snapped to whole shadow-map texels in light space so the shadows do not shimmer.
 */
export function followSun(group: THREE.Group, sun: THREE.DirectionalLight, getDir: () => THREE.Vector3) {
  const fwd = new THREE.Vector3(), c = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3();
  probe(group, (cam) => {
    if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera !== true) return;
    const dir = getDir();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-6) fwd.normalize();
    c.copy(cam.position).addScaledVector(fwd, 28);
    c.y = Math.min(c.y, 12);
    // light-space basis and texel snapping
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    r.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    u.crossVectors(r, dir).normalize();
    const a = Math.round(c.dot(r) / texel) * texel, b = Math.round(c.dot(u) / texel) * texel, d = c.dot(dir);
    c.copy(r).multiplyScalar(a).addScaledVector(u, b).addScaledVector(dir, d);
    sun.target.position.copy(c);
    sun.target.updateMatrixWorld();
    sun.position.copy(c).addScaledVector(dir, 120);
    sun.updateMatrixWorld();
  });
}

/** Show `obj` only while the camera satisfies `inside` (for detail that is never seen from afar). */
export function nearOnly(group: THREE.Group, obj: THREE.Object3D, inside: (p: THREE.Vector3) => boolean) {
  obj.visible = false;
  probe(group, (cam) => { obj.visible = inside(cam.position); });
}

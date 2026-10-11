import * as THREE from 'three';
import { prng } from './merge';
import { INNER, SHRINE, NANDI_M } from './layout';

/**
 * Floor decals of the inner court (as photographed, 2024): chalk rangoli (muggulu) drawn on the dark
 * granite flags — dotted lotus and star patterns in white with coloured fills — and darker wet/oiled
 * patches where abhisheka water and lamp oil are carried. Two instanced draws.
 */
/**
 * A hand-drawn muggulu (kolam) as drawn each morning at a doorway: a slightly irregular dot grid with
 * looping chalk-white lines round the dots, a few kumkum-red petals, worn and scuffed by feet.
 */
function rangoliTexture(seed: number) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = prng(seed);
  g.clearRect(0, 0, S, S);
  const N = 5 + Math.floor(r() * 3), step = (S * 0.78) / (N - 1), o = S * 0.11;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    // a diamond of dots (the usual muggulu grid)
    if (Math.abs(i - (N - 1) / 2) + Math.abs(j - (N - 1) / 2) > (N - 1) / 2 + 0.6) continue;
    pts.push([o + i * step + (r() - 0.5) * 6, o + j * step + (r() - 0.5) * 6]);
  }
  g.lineCap = 'round';
  // kumkum-red petals between some dots
  g.fillStyle = 'rgba(176,30,36,0.85)';
  for (const [x, y] of pts) if (r() < 0.35) {
    const a = r() * Math.PI * 2;
    g.beginPath(); g.ellipse(x + Math.cos(a) * step * 0.5, y + Math.sin(a) * step * 0.5, step * 0.22, step * 0.1, a, 0, Math.PI * 2); g.fill();
  }
  // chalk loops round the dots, wobbly
  g.strokeStyle = 'rgba(246,242,232,0.92)';
  for (const [x, y] of pts) {
    g.lineWidth = 4 + r() * 2;
    g.beginPath();
    const rr = step * (0.36 + r() * 0.06);
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2, w = rr * (1 + 0.25 * Math.cos(a * 4 + r()) + (r() - 0.5) * 0.06);
      const px = x + Math.cos(a) * w, py = y + Math.sin(a) * w;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(250,248,240,0.95)';
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); }
  // scuffs: erase bits where feet have passed
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.6})`; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 30, 5 + r() * 12, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wetTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function buildDecals(root: THREE.Object3D) {
  const rnd = prng(808);
  const { x0, x1, z0, z1, depth } = INNER;
  const ok = (x: number, z: number, r: number) => {
    if (x - r < x0 + depth + 0.5 || x + r > x1 - 1 || z - r < z0 + depth + 0.8 || z + r > z1 - depth - 0.8) return false;
    if (x + r > -SHRINE.half - 0.8 && x - r < SHRINE.mandX1 + 1.6 && Math.abs(z) - r < SHRINE.mandZ + 0.8) return false;
    if (x + r > NANDI_M.x0 - 1.5 && x - r < NANDI_M.x1 + 1.5 && Math.abs(z) - r < NANDI_M.z + 1.0) return false;
    if (x + r > 22 && x - r < 28 && Math.abs(z) - r < 1.5) return false;
    return true;
  };
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // muggulu only at the doorways: mandapa east steps, its north exit, the cloister gates, the Nandi mandapa
  const doors: [number, number][] = [[24.0, 1.5], [13.8, -9.6], [12.0, -17.4], [12.0, 17.4], [-17.4, 0.0], [42.2, 0.6]];
  const rangoli = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: rangoliTexture(31), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), doors.length);
  const wet = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x0c0b0a, alphaMap: wetTexture(), transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.12, polygonOffset: true, polygonOffsetFactor: -1 }), 24);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  let nr = 0, nw = 0;
  for (const [x, z] of doors) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const d = 0.75 + rnd() * 0.15;
    m.compose(new THREE.Vector3(x, 0.012, z), q, new THREE.Vector3(d, 1, d));
    rangoli.setMatrixAt(nr++, m);
  }
  for (let tries = 0; tries < 600 && nw < 24; tries++) {
    const x = x0 + depth + rnd() * (x1 - x0 - depth), z = z0 + depth + rnd() * (z1 - z0 - 2 * depth);
    {
      const r = 0.8 + rnd() * 1.6;
      if (!ok(x, z, r * 0.5)) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      m.compose(new THREE.Vector3(x, 0.01, z), q, new THREE.Vector3(2 * r, 1, 2 * r * (0.5 + rnd() * 0.6)));
      wet.setMatrixAt(nw++, m);
    }
  }
  // wet trails at the sanctum and mandapa thresholds, where water is carried
  for (const [x, z, sx, sz] of [[23.0, 0, 2.6, 2.2], [24.0, -2.0, 1.8, 1.4], [13.8, -8.6, 2.4, 1.6]]) {
    if (nw >= 24) break;
    m.compose(new THREE.Vector3(x, 0.01, z), q.identity(), new THREE.Vector3(sx, 1, sz));
    wet.setMatrixAt(nw++, m);
  }
  rangoli.count = nr; wet.count = nw;
  for (const im of [rangoli, wet]) { im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; im.castShadow = false; root.add(im); }
}

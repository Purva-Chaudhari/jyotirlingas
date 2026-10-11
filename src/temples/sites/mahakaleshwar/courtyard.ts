import * as THREE from 'three';
import type { Physics } from '../../engine/kit';

/**
 * Courtyard dressing seen from the pilgrim's first view, after the trust's aerial photographs (2025):
 * pale grey-cream stone paving in large slabs, the great peepal tree on a painted round platform
 * to the right of the temple, and the steel queue canopy with its barricade railings on the left.
 */

/** 2.4 m × 2.4 m patch of pale stone slabs (4 × 4 of 0.6 m), each a slightly different tone. */
function pavingCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = 4, cell = 512 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 150 + Math.round((rnd() - 0.5) * 26);
      g.fillStyle = `rgb(${v + 12},${v},${v - 14})`;
      g.fillRect(i * cell, j * cell, cell, cell);
      for (let k = 0; k < 140; k++) {
        const d = Math.round((rnd() - 0.5) * 30);
        g.fillStyle = `rgba(${v + d},${v + d - 3},${v + d - 9},0.35)`;
        g.fillRect(i * cell + rnd() * cell, j * cell + rnd() * cell, 2 + rnd() * 5, 2 + rnd() * 5);
      }
      // a few dark scuffs where the crowds walk
      if (rnd() < 0.4) {
        const gr = g.createRadialGradient(i * cell + cell / 2, j * cell + cell / 2, 0, i * cell + cell / 2, j * cell + cell / 2, cell * 0.6);
        gr.addColorStop(0, 'rgba(90,80,70,0.12)');
        gr.addColorStop(1, 'rgba(90,80,70,0)');
        g.fillStyle = gr;
        g.fillRect(i * cell, j * cell, cell, cell);
      }
    }
  }
  // inlay (2025 aerial): a cream border band round each 2.4 m bay with a charcoal diamond inside it
  g.strokeStyle = 'rgba(122,42,36,0.9)';
  g.lineWidth = 16;
  g.strokeRect(10, 10, 492, 492);
  g.strokeStyle = 'rgba(70,66,62,0.85)';
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(256, 40); g.lineTo(472, 256); g.lineTo(256, 472); g.lineTo(40, 256); g.closePath(); g.stroke();
  g.fillStyle = 'rgba(232,222,200,0.7)';
  g.beginPath(); g.moveTo(256, 200); g.lineTo(312, 256); g.lineTo(256, 312); g.lineTo(200, 256); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(95,88,80,0.85)';
  g.lineWidth = 3;
  for (let k = 0; k <= n; k++) {
    g.beginPath(); g.moveTo(k * cell, 0); g.lineTo(k * cell, 512); g.stroke();
    g.beginPath(); g.moveTo(0, k * cell); g.lineTo(512, k * cell); g.stroke();
  }
  return c;
}

export function courtyardPaving(): THREE.MeshStandardMaterial {
  const t = new THREE.CanvasTexture(pavingCanvas());
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2.4, 1 / 2.4);
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78 });
}

/** The great peepal's chabutra: a low square platform (4.5 m, 0.6 m high) of grey stone with a white-limed edge. */
export function treePlatform(g: THREE.Group, P: Physics, x: number, z: number) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.9 });
  const lime = new THREE.MeshStandardMaterial({ color: 0xeeebe2, roughness: 0.85 });
  const S = 4.5, H = 0.6;
  const base = new THREE.Mesh(new THREE.BoxGeometry(S, H - 0.08, S), stone);
  base.position.set(x, (H - 0.08) / 2, z);
  base.castShadow = base.receiveShadow = true;
  g.add(base);
  // coping slab, limed on its edges, and a limed band at the foot
  const cap = new THREE.Mesh(new THREE.BoxGeometry(S + 0.12, 0.08, S + 0.12), lime);
  cap.position.set(x, H - 0.04, z);
  cap.receiveShadow = true;
  g.add(cap);
  const top = new THREE.Mesh(new THREE.BoxGeometry(S - 0.3, 0.012, S - 0.3), stone);
  top.position.set(x, H + 0.006, z);
  top.receiveShadow = true;
  g.add(top);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(S + 0.04, 0.1, S + 0.04), lime);
  foot.position.set(x, 0.05, z);
  g.add(foot);
  P.solid(x - S / 2, 0, z - S / 2, x + S / 2, H, z + S / 2);
  P.floor(g, x - S / 2, x + S / 2, z - S / 2, z + S / 2, H);
}

/**
 * Steel queue canopy: a run of portal frames with a shallow pitched sheet roof, and two lines of
 * barricade railings beneath it. Runs along z from z0 to z1 at x = cx (width w).
 */
export function queueCanopy(g: THREE.Group, P: Physics, cx: number, z0: number, z1: number, w: number) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x5f7f98, metalness: 0.6, roughness: 0.45 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  const rail = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
  const H = 3.4, n = Math.round((z1 - z0) / 3) + 1;
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, H, 8).translate(0, H / 2, 0);
  const posts = new THREE.InstancedMesh(postGeo, steel, n * 2);
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / (n - 1);
    for (const s of [-1, 1]) {
      posts.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), new THREE.Matrix4().makeTranslation(cx + (s * w) / 2, 0, z));
      P.solid(cx + (s * w) / 2 - 0.08, 0, z - 0.08, cx + (s * w) / 2 + 0.08, H, z + 0.08);
    }
  }
  posts.castShadow = true;
  g.add(posts);
  // roof: two shallow slopes and a ridge beam
  const len = z1 - z0 + 0.6;
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w / 2 + 0.3, len), sheet);
    r.rotation.x = -Math.PI / 2;
    r.rotation.y = s * 0.12;
    r.position.set(cx + (s * (w / 2 + 0.3)) / 2, H + 0.12, (z0 + z1) / 2);
    r.castShadow = r.receiveShadow = true;
    g.add(r);
  }
  for (const xo of [-w / 2, 0, w / 2]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, len), steel);
    beam.position.set(cx + xo, H + (xo === 0 ? 0.2 : 0.02), (z0 + z1) / 2);
    g.add(beam);
  }
  // barricade railings forming the queue lane
  for (const xo of [-w * 0.18, w * 0.18]) {
    for (const yy of [0.5, 1.0]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, z1 - z0, 6), rail);
      b.rotation.x = Math.PI / 2;
      b.position.set(cx + xo, yy, (z0 + z1) / 2);
      g.add(b);
    }
    const nn = Math.round((z1 - z0) / 1.5) + 1;
    const st = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6).translate(0, 0.5, 0), rail, nn);
    for (let i = 0; i < nn; i++) st.setMatrixAt(i, new THREE.Matrix4().makeTranslation(cx + xo, 0, z0 + ((z1 - z0) * i) / (nn - 1)));
    g.add(st);
    P.solid(cx + xo - 0.05, 0, z0, cx + xo + 0.05, 1.05, z1);
  }
}

import * as THREE from 'three';

/**
 * Marigold garlands as they are strung in the temple: tightly packed, ruffled genda flowers
 * (≈5 cm across) on a thread, solid orange or yellow strands, some with white jasmine between.
 * Strands are collected and drawn as one InstancedMesh per colour (call build() once at the end).
 */

/** A ruffled flower head: a slightly flattened sphere with many shallow lobes (unit radius). */
function flowerGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.16 * Math.sin(x * 9.1) * Math.sin(y * 8.3 + 1.1) * Math.sin(z * 9.7 + 0.4);
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  g.computeVertexNormals();
  return g;
}

const COLOURS = { o: 0xe8620c, y: 0xf0a200, w: 0xf2efe4, r: 0xb0122c } as const;
type Hue = keyof typeof COLOURS;

export class Marigolds {
  private mats: Record<Hue, THREE.Matrix4[]> = { o: [], y: [], w: [], r: [] };
  private seed = 17;
  private rnd = () => ((this.seed = (this.seed * 16807) % 2147483647) / 2147483647);

  /**
   * A strand from a to b sagging by `sag` along `bulge` (default straight down), `r` = flower radius.
   * `pattern` repeats along the strand, e.g. 'o', 'y', 'oooyyy', 'oow'.
   */
  strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, pattern = 'o', r = 0.026, bulge = new THREE.Vector3(0, -1, 0)) {
    const len = a.distanceTo(b) + sag * 1.3;
    const n = Math.max(2, Math.round(len / (r * 1.45)));
    const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      p.copy(a).lerp(b, t).addScaledVector(bulge, sag * 4 * t * (1 - t));
      e.set(this.rnd() * 6.28, this.rnd() * 6.28, this.rnd() * 6.28);
      q.setFromEuler(e);
      const hue = pattern[i % pattern.length] as Hue;
      const s = r * (0.85 + this.rnd() * 0.3) * (hue === 'w' ? 0.6 : 1);
      this.mats[hue].push(new THREE.Matrix4().compose(p.clone(), q, new THREE.Vector3(s, s, s)));
    }
  }

  build(parent: THREE.Object3D) {
    const geo = flowerGeometry();
    for (const hue of Object.keys(this.mats) as Hue[]) {
      const list = this.mats[hue];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLOURS[hue], roughness: 0.9 }), list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = false;
      im.receiveShadow = true;
      parent.add(im);
    }
  }
}

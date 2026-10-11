import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Instanced offerings (marigold, jasmine, rose, bel, petals, rice): adapted from the Kashi Vishwanath site. */

let seedG = 1;
const rnd = () => ((seedG = (seedG * 16807) % 2147483647) / 2147483647);

function ruffled(r: number, detail: number, amp: number, flatten: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), b = Math.atan2(v.y, Math.hypot(v.x, v.z));
    const k = 1 + amp * Math.sin(a * 9 + seed) * Math.sin(b * 7 + seed * 0.7);
    v.multiplyScalar(k);
    v.y *= flatten;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  // weld the icosahedron's split vertices so petals shade smoothly
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

/** Bel (bilva) leaf: three leaflets, the middle one longest; lies flat in XZ, stalk at the origin. */
function belGeo(len: number) {
  const leaflet = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w, l * 0.45, 0, l);
    s.quadraticCurveTo(-w, l * 0.45, 0, 0);
    return new THREE.ShapeGeometry(s, 6);
  };
  const mid = leaflet(len, len * 0.42);
  const l = leaflet(len * 0.78, len * 0.36).rotateZ(1.05);
  const r = leaflet(len * 0.78, len * 0.36).rotateZ(-1.05);
  const g = mergeGeometries([mid, l, r].map((x) => { x.deleteAttribute('uv'); return x; }), false)!;
  g.rotateX(-Math.PI / 2);
  // a slight cup so leaves catch light
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.2);
  g.computeVertexNormals();
  return g;
}

type Kind = 'marigold' | 'marigoldLo' | 'jasmine' | 'rose' | 'bel' | 'petal' | 'rice' | 'mogra';

const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00, 0xff7b00];
const PETAL = [0xff8a00, 0xffb300, 0xd81b3b, 0xffffff, 0xff6f00];

export class Offerings {
  private items = new Map<Kind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  constructor(seed = 7) { seedG = seed; }

  add(kind: Kind, x: number, y: number, z: number, scale = 1, color?: number, ry = rnd() * Math.PI * 2, tilt = 0) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * (rnd() - 0.5), ry, tilt * (rnd() - 0.5)));
    const s = scale * (0.85 + rnd() * 0.3);
    it.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    const pick = color ?? (kind === 'marigold' || kind === 'marigoldLo' ? MARIGOLD[Math.floor(rnd() * MARIGOLD.length)]
      : kind === 'rose' ? (rnd() < 0.8 ? 0xb3121f : 0xe0406a)
        : kind === 'bel' ? (rnd() < 0.7 ? 0x4f7d24 : 0x6c9030)
          : kind === 'petal' ? PETAL[Math.floor(rnd() * PETAL.length)]
            : kind === 'rice' ? 0xf4efe2 : kind === 'mogra' ? 0xfbf8ee : 0xfffdf4);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }

  /** A garland ring of alternating marigold and jasmine round (cx, cz) at height y. */
  ring(cx: number, y: number, cz: number, r: number, scale = 1) {
    const n = Math.max(8, Math.round((Math.PI * 2 * r) / (0.055 * scale)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (i % 4 === 3) this.add('mogra', x, y, z, scale * 0.8);
      else this.add('marigold', x, y, z, scale);
    }
  }

  /** A garland hanging between a and b (marigold with jasmine every few beads). */
  strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, scale = 1) {
    const len = a.distanceTo(b) + sag;
    const n = Math.max(4, Math.round(len / (0.05 * scale)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (i % 5 === 4) this.add('mogra', p.x, p.y, p.z, scale * 0.8);
      else this.add('marigoldLo', p.x, p.y, p.z, scale * 0.9);
    }
  }

  /** A loose heap of flowers and leaves (cone of radius r and height h). */
  heap(cx: number, y: number, cz: number, r: number, h: number, n: number) {
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
      const rr = u * r, yy = y + (1 - u) * h * (0.6 + rnd() * 0.4);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const k = rnd();
      if (k < 0.55) this.add('marigold', x, yy, z);
      else if (k < 0.7) this.add('rose', x, yy, z);
      else if (k < 0.85) this.add('bel', x, yy, z, 1, undefined, rnd() * 6.3, 1.2);
      else for (let j = 0; j < 3; j++) this.add('jasmine', x + (rnd() - 0.5) * 0.03, yy, z + (rnd() - 0.5) * 0.03, 1, undefined, rnd() * 6.3, 1.5);
    }
  }

  /** Scatter petals / leaves flat on a surface. */
  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, belShare = 0.25) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (rnd() < belShare) this.add('bel', x, y + 0.004, z, 0.9, undefined, rnd() * 6.3, 0.3);
      else this.add('petal', x, y + 0.002, z, 1, undefined, rnd() * 6.3, 0.4);
    }
  }

  /** The Kashi shringar: a tall cone of stacked marigold and jasmine bands over a lingam. */
  shringar(cx: number, y: number, cz: number, r0: number, h: number) {
    const bands = 7;
    for (let b = 0; b < bands; b++) {
      const t = b / bands, r = r0 * (1 - t * 0.78), yy = y + t * h;
      const n = Math.max(6, Math.round((Math.PI * 2 * r) / 0.05));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + b * 0.3;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (b % 2) this.add('mogra', x, yy, z, 1.0);
        else this.add('marigold', x, yy, z, 1.15, b % 4 === 0 ? 0xffc21a : 0xff9a00);
      }
    }
    this.add('rose', cx, y + h + 0.02, cz, 1.4);
  }

  flush(parent: THREE.Object3D) {
    const geos: Record<Kind, THREE.BufferGeometry> = {
      marigold: ruffled(0.03, 2, 0.22, 0.7, 1),
      marigoldLo: ruffled(0.03, 1, 0.22, 0.7, 1),
      jasmine: new THREE.SphereGeometry(0.009, 8, 6).scale(1, 1, 2.2),
      rose: ruffled(0.028, 2, 0.14, 0.8, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 10).rotateX(-Math.PI / 2),
      rice: new THREE.SphereGeometry(0.004, 4, 3).scale(1, 0.6, 1.8),
      mogra: ruffled(0.022, 1, 0.2, 0.85, 7),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.85 }),
      marigoldLo: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      jasmine: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222018 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.75 }),
      bel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }),
      rice: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
    };
    for (const [kind, it] of this.items) {
      const im = new THREE.InstancedMesh(geos[kind], mats[kind], it.m.length);
      it.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, it.c[i]); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
  }
}


import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Flowers and leaves offered at Grishneshwar, all instanced (one draw call per kind) with
 * per-instance colour, size and tilt variation: ruffled marigold heads (orange and the pale
 * lemon-yellow ones heaped in the jalahari), white mogra/tagar, red roses and loose petals,
 * trifoliate bel leaves. Adapted from the Kashi Vishwanath site.
 */

let seedG = 1;
export const rnd = () => ((seedG = (seedG * 16807) % 2147483647) / 2147483647);

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
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

/** white chrysanthemum (shevanti): a low dome of many narrow incurved petals, ≈7 cm across */
function chrysGeo() {
  const g = new THREE.SphereGeometry(0.035, 40, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), e = Math.acos(Math.min(1, v.y / 0.035));
    const k = 1 + 0.07 * Math.abs(Math.sin(a * 14 + e * 9)) + 0.04 * Math.sin(a * 31);
    p.setXYZ(i, v.x * k, v.y * 0.55 * k, v.z * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Bel (bilva) leaf: three leaflets, the middle one longest; flat in XZ, stalk at the origin. */
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
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.2);
  g.computeVertexNormals();
  return g;
}

export type Kind = 'marigold' | 'marigoldLo' | 'mogra' | 'rose' | 'bel' | 'petal' | 'chrys';

const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00, 0xff7b00];
/** the pale lemon-yellow marigolds (and chrysanthemum) laid in the jalahari */
export const LEMON = [0xf2e21a, 0xe8dc10, 0xf6e83a, 0xeed400, 0xf4de1c]; // greener than they look: the lamplight warms them
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
      : kind === 'rose' ? (rnd() < 0.8 ? 0xb3121f : 0xd0284a)
        : kind === 'bel' ? (rnd() < 0.7 ? 0x4f7d24 : 0x6c9030)
          : kind === 'petal' ? PETAL[Math.floor(rnd() * PETAL.length)] : kind === 'chrys' ? (rnd() < 0.8 ? 0xfaf8f0 : 0xf4ecd0) : 0xfbf8ee);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }

  /** A garland hanging between a and b (marigold with mogra every few heads). */
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
      else this.add('mogra', x, yy, z, 0.8);
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

  flush(parent: THREE.Object3D, env?: THREE.Texture) {
    const geos: Record<Kind, THREE.BufferGeometry> = {
      marigold: ruffled(0.03, 2, 0.22, 0.7, 1),
      marigoldLo: ruffled(0.03, 1, 0.22, 0.7, 1),
      rose: ruffled(0.028, 2, 0.14, 0.8, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 10).rotateX(-Math.PI / 2),
      mogra: ruffled(0.022, 1, 0.2, 0.85, 7),
      // white chrysanthemum (shevanti) head: a broad, flat, densely ruffled disc ≈7 cm across
      chrys: chrysGeo(),
    };
    const mats: Record<Kind, THREE.MeshStandardMaterial> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.85 }),
      marigoldLo: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.7 }),
      bel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
      chrys: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.75 }),
    };
    if (env) for (const m of Object.values(mats)) { m.envMap = env; m.envMapIntensity = 0.5; }
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

/** Lathe from (radius, y) pairs, optional vertical ribs (flutes). Non-indexed, no uv. */
export function lathe(prof: [number, number][], seg = 32, ribs = 0, ribDepth = 0.05): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
  if (ribs) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const k = 1 + Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * ribs * 0.5)), 2.5) * ribDepth;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  return ng;
}

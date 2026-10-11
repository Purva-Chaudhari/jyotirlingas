import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KM } from './mats';
import type { Merger } from './merge';
import { lathe } from './spire';

/**
 * Shiva lingams and their offerings.
 *  - Lingam: smooth black stone, domed top, a touch irregular (worn by centuries of abhisheka).
 *  - Yoni-pitha: round or square stepped base with the pranala (spout) pointing north (+x), as is the rule.
 *  - Offerings: marigold heads (yellow → deep orange), jasmine buds, red roses, trifoliate bel leaves,
 *    loose petals, garland rings — all instanced, with per-instance colour and size variation.
 *  - Tripundra: three horizontal bands of ash with a red dot on shrine lingams.
 */

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

const MARIGOLD = [0xf2a100, 0xee8a00, 0xe86a00, 0xf5b800, 0xe97600, 0xf09000];
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
      marigold: ruffled(0.025, 2, 0.3, 0.72, 1),
      marigoldLo: ruffled(0.025, 1, 0.28, 0.72, 1),
      jasmine: new THREE.SphereGeometry(0.009, 8, 6).scale(1, 1, 2.2),
      rose: ruffled(0.028, 2, 0.14, 0.8, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 10).rotateX(-Math.PI / 2),
      rice: new THREE.SphereGeometry(0.004, 4, 3).scale(1, 0.6, 1.8),
      mogra: ruffled(0.022, 1, 0.2, 0.85, 7),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
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

/** Lingam: radius r, visible height h; a little asymmetric so it never looks machined. */
export function lingamGeo(r: number, h: number, wobble = 0.04, seg = 40) {
  const prof: [number, number][] = [[r * 1.02, 0]];
  const dome = r * 0.95;
  const shaft = Math.max(0.01, h - dome);
  for (let i = 1; i <= 4; i++) prof.push([r * (1.02 - 0.03 * i / 4), (shaft * i) / 4]);
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * Math.PI / 2;
    prof.push([r * 0.99 * Math.cos(a), shaft + Math.sin(a) * dome]);
  }
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0005), y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    // worn asymmetry plus fine vertical striations of the stone (seen in the trust's close-ups)
    const k = 1 + wobble * (Math.sin(a * 2 + 0.7) * 0.6 + Math.sin(a * 3 + y * 9) * 0.4) + 0.006 * Math.cos(a * 22 + Math.sin(a * 5) * 2);
    p.setXYZ(i, x * k, y * (1 + wobble * 0.3 * Math.cos(a)), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Round yoni-pitha with stepped mouldings and a pranala to +x. Top surface at returned y. */
function roundPitha(R: number) {
  const prof: [number, number][] = [
    [0, 0], [R, 0], [R, R * 0.12], [R * 0.9, R * 0.16], [R * 0.82, R * 0.26], [R * 0.9, R * 0.32], [R * 0.96, R * 0.38],
    [R * 0.96, R * 0.46], [R * 0.86, R * 0.48], [R * 0.8, R * 0.42], [0, R * 0.42],
  ];
  const g = lathe(prof, 40);
  const spout = new THREE.BoxGeometry(R * 0.9, R * 0.1, R * 0.34).translate(R * 1.25, R * 0.4, 0).toNonIndexed();
  spout.deleteAttribute('uv');
  const tip = new THREE.CylinderGeometry(R * 0.17, R * 0.17, R * 0.1, 12).translate(R * 1.7, R * 0.4, 0).toNonIndexed();
  tip.deleteAttribute('uv');
  return { geo: mergeGeometries([g, spout, tip], false)!, top: R * 0.42, rim: R * 0.48 };
}

/** Square stepped pitha (the common shrine form). */
function squarePitha(R: number) {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, y: number) => {
    const b = new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0).toNonIndexed();
    b.deleteAttribute('uv');
    parts.push(b);
  };
  box(R * 2.2, R * 0.16, 0);
  box(R * 1.9, R * 0.12, R * 0.16);
  box(R * 1.7, R * 0.14, R * 0.28);
  box(R * 1.95, R * 0.1, R * 0.42);
  const basin = lathe([[R * 0.7, 0], [R * 0.82, 0], [R * 0.82, R * 0.08], [R * 0.7, R * 0.08]], 32);
  basin.translate(0, R * 0.52, 0);
  parts.push(basin);
  const spout = new THREE.BoxGeometry(R * 0.85, R * 0.1, R * 0.3).translate(R * 1.35, R * 0.47, 0).toNonIndexed();
  spout.deleteAttribute('uv');
  parts.push(spout);
  return { geo: mergeGeometries(parts, false)!, top: R * 0.52, rim: R * 0.6 };
}

/** Partial lathe band (for ash stripes) wrapping the front of a lingam. */
function band(r: number, y: number, w: number, phi0: number, phiLen: number) {
  const g = new THREE.LatheGeometry([new THREE.Vector2(r, y - w / 2), new THREE.Vector2(r, y + w / 2)], 24, phi0, phiLen);
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

export interface ShivlingOpts {
  /** lingam radius (m) */
  r?: number;
  pitha?: 'round' | 'square';
  pithaMat?: THREE.Material;
  /** direction the lingam's ash marks face (radians about y; 0 = +x) */
  face?: number;
  tripundra?: boolean;
  /** 0 bare … 1 heavily adorned */
  adorn?: number;
}

/**
 * A complete shrine shivling at (x, y, z): pitha, lingam, tripundra, bel leaves, a garland ring,
 * flowers on the pitha. Pranala points north (+x).
 */
export function shivling(B: Merger, K: KM, O: Offerings, x: number, y: number, z: number, o: ShivlingOpts = {}) {
  const r = o.r ?? 0.12, R = r * 2.6;
  const pitha = (o.pitha ?? 'round') === 'round' ? roundPitha(R) : squarePitha(R);
  B.place(o.pithaMat ?? K.blackStone, pitha.geo, x, y, z);
  const h = r * 2.3;
  B.place(K.lingam, lingamGeo(r, h, 0.03, 28), x, y + pitha.top - 0.01, z);
  const ly = y + pitha.top;
  if (o.tripundra ?? true) {
    const f = o.face ?? Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      // LatheGeometry phi runs from +z toward +x; centre the arc on the facing direction
      const phiC = Math.PI / 2 - f;
      B.add(K.ash, band(r * 1.035, ly + h * (0.45 + i * 0.11), h * 0.045, phiC - 1.0, 2.0));
    }
    const dot = new THREE.SphereGeometry(r * 0.12, 8, 6);
    B.place(K.kumkum, dot, x + Math.cos(f) * r * 1.0, ly + h * 0.56, z + Math.sin(f) * r * 1.0, 0, [0.5, 1, 1]);
  }
  const adorn = o.adorn ?? 0.6;
  // bel leaves on the crown, a garland ring at the base, flowers on the pitha
  const nb = 2 + Math.round(adorn * 3);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rnd();
    O.add('bel', x + Math.cos(a) * r * 0.35, ly + h + 0.003, z + Math.sin(a) * r * 0.35, 1.1 * r / 0.12, undefined, a, 0.6);
  }
  if (adorn > 0.3) O.ring(x, ly + 0.03, z, r * 1.25, r / 0.12);
  O.scatter(x - R * 0.75, x + R * 0.75, z - R * 0.75, z + R * 0.75, y + pitha.rim, Math.round(10 + adorn * 22), 0.35);
  for (let i = 0; i < Math.round(adorn * 6); i++) {
    const a = rnd() * Math.PI * 2;
    O.add(rnd() < 0.7 ? 'marigold' : 'rose', x + Math.cos(a) * R * 0.62, y + pitha.rim + 0.02, z + Math.sin(a) * R * 0.62, r / 0.12);
  }
  return { top: ly + h, pithaR: R };
}

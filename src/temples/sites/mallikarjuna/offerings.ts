import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe, prng, type Merger } from './merge';
import type { SM } from './mats';

/**
 * Flowers and offerings, all instanced (one draw per kind): jasmine (mallika — the flower in
 * Mallikarjuna's name) buds and strings, marigold heads, red roses and oleander, trifoliate bel
 * leaves, loose petals, plus small shrine lingams on their pithas for the cloister and court.
 * Pranala (spout) of every pitha points north (−z), as is the rule.
 */

let rnd = prng(1);

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

/** Bel (bilva) leaf: three leaflets; lies flat in XZ, stalk at the origin. */
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

type Kind = 'marigold' | 'jasmine' | 'rose' | 'bel' | 'petal' | 'mogra' | 'ash';

const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00];
const PETAL = [0xff8a00, 0xffb300, 0xd81b3b, 0xffffff, 0xff6f00, 0xfafafa];

/** Lingam: radius r, height h, slightly irregular. */
export function lingamGeo(r: number, h: number, wobble = 0.04, seg = 28) {
  const prof: [number, number][] = [[r * 1.02, 0]];
  const dome = r * 0.95, shaft = Math.max(0.01, h - dome);
  for (let i = 1; i <= 4; i++) prof.push([r * (1.02 - 0.03 * i / 4), (shaft * i) / 4]);
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push([r * 0.99 * Math.cos(a), shaft + Math.sin(a) * dome]); }
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0005), y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + wobble * (Math.sin(a * 2 + 0.7) * 0.6 + Math.sin(a * 3 + y * 9) * 0.4);
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** small round yoni-pitha with spout to −z; returns geometry and top height */
function pithaGeo(R: number) {
  const g = lathe([[0, 0], [R, 0], [R, R * 0.14], [R * 0.86, R * 0.2], [R * 0.82, R * 0.3], [R * 0.95, R * 0.38], [R * 0.95, R * 0.46], [R * 0.8, R * 0.48], [0, R * 0.44]], 24);
  const spout = new THREE.BoxGeometry(R * 0.34, R * 0.1, R * 0.9).translate(0, R * 0.42, -R * 1.25).toNonIndexed();
  spout.deleteAttribute('uv');
  return { geo: mergeGeometries([g, spout], false)!, top: R * 0.44 };
}

export class Offerings {
  private items = new Map<Kind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  B?: Merger;
  K?: SM;
  private lg = lingamGeo(1, 2.3, 0.03, 20);
  private pg = pithaGeo(1);
  constructor(seed = 7) { rnd = prng(seed); }

  add(kind: Kind, x: number, y: number, z: number, scale = 1, color?: number, ry = rnd() * Math.PI * 2, tilt = 0) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * (rnd() - 0.5), ry, tilt * (rnd() - 0.5)));
    const s = scale * (0.85 + rnd() * 0.3);
    it.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    const pick = color ?? (kind === 'marigold' ? MARIGOLD[Math.floor(rnd() * MARIGOLD.length)]
      : kind === 'rose' ? (rnd() < 0.7 ? 0xb3121f : 0xe0406a)
        : kind === 'bel' ? (rnd() < 0.7 ? 0x4f7d24 : 0x6c9030)
          : kind === 'petal' ? PETAL[Math.floor(rnd() * PETAL.length)]
            : kind === 'ash' ? 0xe8e4da : 0xfffdf4);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }

  /** one instance whose long axis (+z of the geometry) points along `dir` */
  addAligned(kind: Kind, p: THREE.Vector3, dir: THREE.Vector3, scale = 1, color?: number) {
    let it = this.items.get(kind);
    if (!it) this.items.set(kind, (it = { m: [], c: [] }));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd() * 6.28));
    const s = scale * (0.85 + rnd() * 0.3);
    it.m.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)));
    const col = new THREE.Color(color ?? 0xfffdf4);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
    it.c.push(col);
  }

  /**
   * A string of jasmine (mallika) buds: a white cord along `pts` thickly set with buds bristling
   * outward, the way the strings are wound round the Jyotirlinga and edge the rose garland.
   */
  jasmineString(pts: THREE.Vector3[], r = 0.016, closed = false, density = 1) {
    const curve = new THREE.CatmullRomCurve3(pts, closed);
    const L = curve.getLength();
    const segs = Math.max(8, Math.round(L / 0.02));
    this.B!.add(this.K!.ash, new THREE.TubeGeometry(curve, segs, r * 0.7, 6, closed));
    const n = Math.round((L / 0.008) * density * (r / 0.018));
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + rnd() * 0.5) / n;
      const p = curve.getPointAt(Math.min(1, t)), tg = curve.getTangentAt(Math.min(1, t));
      const side = new THREE.Vector3().crossVectors(tg, up);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const nrm = new THREE.Vector3().crossVectors(side, tg).normalize();
      for (let k = 0; k < 4; k++) {
        const a = rnd() * Math.PI * 2;
        const d = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(nrm, Math.sin(a)).addScaledVector(tg, (rnd() - 0.5) * 0.8).normalize();
        this.addAligned('jasmine', p.clone().addScaledVector(d, r * (0.55 + rnd() * 0.35)), d, 1, rnd() < 0.2 ? 0xeee8cc : 0xfffdf6);
      }
    }
  }

  /** A thick rope of rose heads (deep rose-red) along `pts`, radius r, on a dark red core. */
  roseRope(pts: THREE.Vector3[], r = 0.06, closed = false) {
    const curve = new THREE.CatmullRomCurve3(pts, closed);
    const L = curve.getLength();
    this.B!.add(this.K!.roseCore, new THREE.TubeGeometry(curve, Math.max(8, Math.round(L / 0.03)), r * 0.85, 8, closed));
    const rings = Math.round(L / 0.024), per = Math.max(6, Math.round((Math.PI * 2 * r) / 0.028));
    const up = new THREE.Vector3(0, 1, 0);
    const reds = [0xc8143c, 0xb8102e, 0xa00a26, 0xc8143c, 0xd41e44, 0x8e0822];
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const side = new THREE.Vector3().crossVectors(tg, up);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const nrm = new THREE.Vector3().crossVectors(side, tg).normalize();
      for (let k = 0; k < per; k++) {
        const a = ((k + (i % 2) * 0.5) / per) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
        const d = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(nrm, Math.sin(a));
        const q = p.clone().addScaledVector(d, r * (0.85 + rnd() * 0.15));
        this.add('rose', q.x, q.y, q.z, 0.85 + rnd() * 0.3, reds[Math.floor(rnd() * reds.length)], rnd() * 6.3, 1.2);
      }
    }
  }

  /** a garland ring of jasmine with marigold beads round (cx, cz) at y */
  ring(cx: number, y: number, cz: number, r: number, scale = 1) {
    const n = Math.max(8, Math.round((Math.PI * 2 * r) / (0.045 * scale)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (i % 5 === 2) this.add('marigold', x, y, z, scale * 0.9);
      else this.add('mogra', x, y, z, scale * 0.85);
    }
  }

  /** a garland hanging between a and b */
  strand(a: THREE.Vector3, b: THREE.Vector3, sag: number, scale = 1, jasmine = true) {
    const len = a.distanceTo(b) + sag;
    const n = Math.max(4, Math.round(len / (0.045 * scale)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (jasmine ? i % 6 === 3 : i % 5 !== 4) this.add('marigold', p.x, p.y, p.z, scale * 0.9);
      else this.add('mogra', p.x, p.y, p.z, scale * 0.85);
    }
  }

  /** garland draped round a neck: a vertical-ish loop in the plane across `axis` */
  garlandOn(x: number, y: number, z: number, r: number, axis: 'x' | 'z') {
    const n = Math.round((Math.PI * 2 * r) / 0.05);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const u = Math.cos(a) * r, v = Math.sin(a) * r * 1.15 - (Math.sin(a) < 0 ? r * 0.3 * -Math.sin(a) : 0);
      const px = axis === 'x' ? x + (Math.sin(a) < 0 ? -Math.sin(a) * r * 0.25 : 0) : x + u;
      const pz = axis === 'x' ? z + u : z + (Math.sin(a) < 0 ? -Math.sin(a) * r * 0.25 : 0);
      this.add(i % 4 === 0 ? 'mogra' : 'marigold', px, y + v, pz, r > 0.4 ? 1.6 : 1.0, i % 8 === 4 ? 0xd81b3b : undefined);
    }
  }

  /** a floral arch over a doorway, in the y-z plane at x, centred on z = cz */
  arch(x: number, y: number, cz: number, halfW: number, rise: number) {
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = Math.PI * t;
      const z = cz - Math.cos(a) * halfW, yy = y + Math.sin(a) * rise;
      for (let k = 0; k < 3; k++) {
        const kind: Kind = k === 1 ? 'mogra' : (i % 3 === 0 ? 'rose' : 'marigold');
        this.add(kind, x + (k - 1) * 0.05, yy + (rnd() - 0.5) * 0.04, z + (rnd() - 0.5) * 0.04, 1.3);
      }
    }
    // hanging tassels
    for (const s of [-1, 1]) this.strand(new THREE.Vector3(x, y, cz + s * halfW), new THREE.Vector3(x, y - 0.9, cz + s * halfW), 0.02, 1.1);
  }

  /**
   * A thick garland arch standing in the y-z plane at x (as round the Mallikarjuna naga): a core of
   * red and pink roses several flowers thick, jasmine strands on the outside, from the base up and over.
   */
  garlandArch(x: number, y: number, cz: number, halfW: number, rise: number) {
    const n = 240;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = Math.PI * t;
      // a tall arch: straight-ish legs, round top; many small (3–4 cm) rose heads, several deep
      const z = cz - Math.cos(a) * halfW, yy = y + Math.pow(Math.sin(a), 0.6) * rise;
      for (let k = 0; k < 13; k++) {
        const off = (k - 6) * 0.0125;
        const rad = 1 + off * 2;
        const pz = cz + (z - cz) * rad, py = y + (yy - y) * (1 + off * 0.8);
        this.add('rose', x + (rnd() - 0.5) * 0.08, py, pz, 0.58, rnd() < 0.45 ? 0xc8102e : rnd() < 0.6 ? 0xee3a6a : 0xf47aa0);
      }
      for (const off of [0.09, 0.105, 0.12, 0.135]) {
        const pz = cz + (z - cz) * (1 + off * 2), py = y + (yy - y) * (1 + off);
        this.add('mogra', x + (rnd() - 0.5) * 0.04, py, pz, 0.48);
      }
    }
  }

  /** a loose heap of flowers and leaves */
  heap(cx: number, y: number, cz: number, r: number, h: number, n: number) {
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
      const rr = u * r, yy = y + (1 - u) * h * (0.6 + rnd() * 0.4);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const k = rnd();
      if (k < 0.4) this.add('marigold', x, yy, z);
      else if (k < 0.55) this.add('rose', x, yy, z);
      else if (k < 0.75) this.add('bel', x, yy, z, 1, undefined, rnd() * 6.3, 1.2);
      else for (let j = 0; j < 3; j++) this.add('jasmine', x + (rnd() - 0.5) * 0.03, yy, z + (rnd() - 0.5) * 0.03, 1, undefined, rnd() * 6.3, 1.5);
    }
  }

  /** scatter petals / leaves flat on a surface */
  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, belShare = 0.25) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (rnd() < belShare) this.add('bel', x, y + 0.004, z, 0.9, undefined, rnd() * 6.3, 0.3);
      else this.add('petal', x, y + 0.002, z, 1, undefined, rnd() * 6.3, 0.4);
    }
  }

  /** a small shrine lingam (radius r) on its pitha at (x, y, z), ash marks facing `face` (radians, 0 = +x) */
  shrine(x: number, y: number, z: number, r: number, face: number) {
    const B = this.B!, K = this.K!;
    const R = r * 2.6;
    B.place(K.blackStone, this.pg.geo, x, y, z, 0, R);
    B.place(K.lingam, this.lg, x, y + this.pg.top * R - 0.01, z, 0, r);
    const ly = y + this.pg.top * R, h = r * 2.3;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.LatheGeometry([new THREE.Vector2(r * 1.04, -h * 0.02), new THREE.Vector2(r * 1.04, h * 0.02)], 12, Math.PI / 2 - face - 0.9, 1.8);
      B.place(K.ash, g, x, ly + h * (0.45 + i * 0.11), z);
    }
    for (let i = 0; i < 3; i++) {
      const a = rnd() * Math.PI * 2;
      this.add('bel', x + Math.cos(a) * r * 0.3, ly + h + 0.003, z + Math.sin(a) * r * 0.3, r / 0.1, undefined, a, 0.6);
    }
    this.ring(x, ly + 0.025, z, r * 1.25, r / 0.1);
    this.scatter(x - R * 0.7, x + R * 0.7, z - R * 0.7, z + R * 0.7, y + R * 0.48, 12, 0.35);
  }

  flush(parent: THREE.Object3D) {
    const geos: Record<Kind, THREE.BufferGeometry> = {
      marigold: ruffled(0.03, 1, 0.22, 0.7, 1),
      jasmine: new THREE.SphereGeometry(0.0045, 5, 3).scale(1, 1, 2.3).translate(0, 0, 0.005),
      rose: ruffled(0.022, 1, 0.16, 0.75, 4),
      bel: belGeo(0.065),
      petal: new THREE.CircleGeometry(0.017, 8).rotateX(-Math.PI / 2),
      mogra: ruffled(0.02, 0, 0.2, 0.85, 7),
      ash: new THREE.SphereGeometry(0.01, 6, 4),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      jasmine: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222018 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      bel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
      ash: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
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

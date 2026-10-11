import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './batch';

/**
 * Instanced offerings: ruffled marigold heads, red roses, white mogra/jasmine, trifoliate bel leaves,
 * loose petals and rice. One draw call per kind, per-instance colour and size.
 */

let rnd = rng(31);

function ruffled(r: number, detail: number, amp: number, flatten: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), b = Math.atan2(v.y, Math.hypot(v.x, v.z));
    v.multiplyScalar(1 + amp * Math.sin(a * 9 + seed) * Math.sin(b * 7 + seed * 0.7));
    v.y *= flatten;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

function belGeo(len: number) {
  const leaflet = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w, l * 0.45, 0, l);
    s.quadraticCurveTo(-w, l * 0.45, 0, 0);
    return new THREE.ShapeGeometry(s, 6);
  };
  const g = mergeGeometries([leaflet(len, len * 0.42), leaflet(len * 0.78, len * 0.36).rotateZ(1.05), leaflet(len * 0.78, len * 0.36).rotateZ(-1.05)]
    .map((x) => { x.deleteAttribute('uv'); return x; }), false)!;
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) ** 2 + p.getZ(i) ** 2) * 1.2);
  g.computeVertexNormals();
  return g;
}

type Kind = 'marigold' | 'marigoldLo' | 'rose' | 'bel' | 'petal' | 'mogra' | 'rice';
const MARIGOLD = [0xffa800, 0xff8c00, 0xff6a00, 0xf25500, 0xffbf00, 0xff7b00];
const PETAL = [0xff8a00, 0xffb300, 0xd81b3b, 0xffffff, 0xff6f00];

export class Offerings {
  private items = new Map<Kind, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  constructor(seed = 7) { rnd = rng(seed); }

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
            : kind === 'rice' ? 0xf4efe2 : 0xfbf8ee);
    const col = new THREE.Color(pick);
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    it.c.push(col);
  }

  ring(cx: number, y: number, cz: number, r: number, scale = 1) {
    const n = Math.max(8, Math.round((Math.PI * 2 * r) / (0.055 * scale)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (i % 4 === 3) this.add('mogra', x, y, z, scale * 0.8);
      else this.add('marigold', x, y, z, scale);
    }
  }

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

  /** a hanging loop of garland (U shape) below two points */
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

  scatter(x0: number, x1: number, z0: number, z1: number, y: number, n: number, belShare = 0.25, inside?: (x: number, z: number) => boolean) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (inside && !inside(x, z)) continue;
      const k = rnd();
      if (k < belShare) this.add('bel', x, y + 0.004, z, 0.9, undefined, rnd() * 6.3, 0.3);
      else if (k < belShare + 0.1) this.add('rice', x, y + 0.002, z, 1, undefined, rnd() * 6.3, 0.3);
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
      rice: new THREE.SphereGeometry(0.004, 4, 3).scale(1, 0.6, 1.8),
    };
    const mats: Record<Kind, THREE.Material> = {
      marigold: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      marigoldLo: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      rose: new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.75 }),
      bel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }),
      petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }),
      mogra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a14 }),
      rice: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    };
    if (env) for (const m of Object.values(mats)) { const sm = m as THREE.MeshStandardMaterial; sm.envMap = env; sm.envMapIntensity = 1.0; }
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

/**
 * A garland rope: a tube along `pts` whose radius swells and pinches like strung marigold heads, so a
 * curtain or a band reads as one continuous ribbon of flowers rather than separate beads.
 */
export function ropeGeo(pts: THREE.Vector3[], r: number, closed = false, pitch = 0.05) {
  const curve = new THREE.CatmullRomCurve3(pts, closed);
  const len = curve.getLength();
  const segs = Math.max(8, Math.round(len / (pitch / 3.5)));
  const radial = 6;
  const g = new THREE.TubeGeometry(curve, segs, r, radial, closed);
  const p = g.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const s = u * len / pitch;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c);
      const th = (j / radial) * Math.PI * 2;
      // one round head per pitch (centred on whole s, where the floret texture puts its heads), pinched
      // between heads; a little ruffle round each head but no spiral (that read as fusilli)
      const fr = s - Math.round(s);
      const bump = 0.66 + 0.4 * Math.sqrt(Math.max(0, 1 - 4 * fr * fr)) + 0.06 * Math.sin(th * 4 + Math.round(s) * 2.3);
      v.multiplyScalar(bump).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  // uv: u along the rope in units of one flower head, v round it
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / pitch);
  g.computeVertexNormals();
  return g;
}

/** Vertical hanging marigold strands as instances of one rope geometry (length L), tinted per strand. */
export class Strands {
  private inst: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  private geo: THREE.BufferGeometry;
  constructor(private L = 1.6, r = 0.028, private mat: THREE.Material = marigoldMaterial()) {
    this.geo = ropeGeo([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L, 0)], r);
  }
  /** hang from (x, yTop, z) down `len` metres */
  add(x: number, yTop: number, z: number, len: number, color: number, sway = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, yTop, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(sway, 0, sway * 0.5)), new THREE.Vector3(1, len / this.L, 1));
    const c = new THREE.Color(color);
    c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    this.inst.push({ m, c });
  }
  flush(parent: THREE.Object3D) {
    if (!this.inst.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.inst.length);
    this.inst.forEach(({ m, c }, i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.castShadow = false;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    parent.add(im);
  }
}

/**
 * A leaf toran: dark-green pointed mango-leaf cards (leaf = length, 15–20 cm) hanging in two staggered
 * rows from a to b, each with a slight fold along its midrib and tipped outward so it reads from below.
 */
export function toran(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, leaf = 0.18, env?: THREE.Texture) {
  const s = new THREE.Shape();
  const w = leaf * 0.24;
  s.moveTo(0, 0); s.bezierCurveTo(w * 1.3, -leaf * 0.2, w, -leaf * 0.7, 0, -leaf); s.bezierCurveTo(-w, -leaf * 0.7, -w * 1.3, -leaf * 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.6); // fold along the midrib
  g.computeVertexNormals();
  const len = a.distanceTo(b), step = leaf * 0.36;
  const n = Math.max(2, Math.round(len / step));
  const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide, envMap: env ?? null, envMapIntensity: 0.6 }), (n + 1) * 2);
  const dir = b.clone().sub(a).normalize();
  const ry = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  let k = 0;
  for (let row = 0; row < 2; row++) for (let i = 0; i <= n; i++) {
    const t = Math.min(1, (i + row * 0.5) / n);
    const pt = a.clone().lerp(b, t);
    pt.y -= row * leaf * 0.35;
    const m = new THREE.Matrix4().compose(pt, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35 - 0.1 * Math.sin(i * 2.1), ry, 0.12 * Math.sin(i * 1.3), 'YXZ')),
      new THREE.Vector3(1, 0.88 + 0.24 * ((i * 7) % 3) / 2, 1));
    im.setMatrixAt(k, m);
    im.setColorAt(k++, new THREE.Color(i % 2 ? 0x1a3f12 : 0x24521a));
  }
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}

let flowerTex: { map: THREE.Texture; normal: THREE.Texture } | null = null;
/**
 * Marigold heads packed on a rope: a tiling height field of overlapping round, ruffled heads (one per
 * u-unit, four round the rope), turned into a grey shade map (the instance colour tints it) and a normal map.
 */
export function flowerMaps() {
  if (flowerTex) return flowerTex;
  const W = 128, H = 256;
  const h = new Float32Array(W * H);
  const heads: [number, number, number][] = [];
  for (let k = 0; k < 4; k++) heads.push([W * 0.5, (k + 0.5) * H / 4, 30], [0, (k + 1) * H / 4 % H, 26], [W, (k + 1) * H / 4 % H, 26]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (const [cx, cy, r] of heads) for (const dy of [-H, 0, H]) {
      const dx = x - cx, dd = y - cy - dy, d = Math.hypot(dx, dd);
      if (d > r) continue;
      const a = Math.atan2(dd, dx);
      // dome with ruffled petal ridges (concentric + radial)
      const t = d / r;
      v = Math.max(v, Math.sqrt(1 - t * t) * (0.82 + 0.1 * Math.sin(t * 22) + 0.08 * Math.sin(a * 14 + t * 6)));
    }
    h[y * W + x] = v;
  }
  const cm = document.createElement('canvas'); cm.width = W; cm.height = H;
  const cn = document.createElement('canvas'); cn.width = W; cn.height = H;
  const gm = cm.getContext('2d')!, gn = cn.getContext('2d')!;
  const im = gm.createImageData(W, H), inn = gn.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = h[i];
    const shade = 185 + v * 70;
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = shade; im.data[i * 4 + 3] = 255;
    const hx = h[y * W + ((x + 1) % W)] - h[y * W + ((x + W - 1) % W)], hy = h[((y + 1) % H) * W + x] - h[((y + H - 1) % H) * W + x];
    const n = new THREE.Vector3(-hx * 3, -hy * 3, 1).normalize();
    inn.data[i * 4] = (n.x * 0.5 + 0.5) * 255; inn.data[i * 4 + 1] = (n.y * 0.5 + 0.5) * 255; inn.data[i * 4 + 2] = (n.z * 0.5 + 0.5) * 255; inn.data[i * 4 + 3] = 255;
  }
  gm.putImageData(im, 0, 0); gn.putImageData(inn, 0, 0);
  const map = new THREE.CanvasTexture(cm), normal = new THREE.CanvasTexture(cn);
  map.colorSpace = THREE.SRGBColorSpace;
  // u runs along the rope in heads; the tile holds two staggered head columns → half a tile per head
  for (const t of [map, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 2, 1); t.anisotropy = 8; }
  flowerTex = { map, normal };
  return flowerTex;
}

/** the marigold-rope material: shade + normal maps of packed flower heads; tinted by colour or instance colour */
export function marigoldMaterial(color = 0xffffff, env?: THREE.Texture) {
  const { map, normal } = flowerMaps();
  // a touch of warm emission keeps the marigolds saturated in the dim sanctum (they read as glowing in photos)
  return new THREE.MeshStandardMaterial({ color, map, normalMap: normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.9, envMap: env ?? null, envMapIntensity: 1.0, emissive: 0xffa800, emissiveIntensity: 0.16 });
}

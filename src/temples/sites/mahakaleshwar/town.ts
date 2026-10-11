import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { OsmData, XZ, EN } from './osm';
import { ringArea, pointInRing } from './osm';

/**
 * A town built from OpenStreetMap data (scripts/fetch-osm.mjs), for any site. Written to be copied to
 * other sites as-is; everything site-specific comes in through TownOpts.
 *
 *  - Streets: every OSM highway as a ribbon of its estimated width — asphalt, or stone pavers near the
 *    temple and on pedestrian streets — over a dusty ground with the real water cut out.
 *  - Buildings: the real OSM footprints, extruded (levels × 3.1 m, or 2–4 storeys where OSM has no
 *    height). Where OSM has no footprints (most of an Indian old town), the street frontage is filled
 *    with narrow attached plots along the real streets, then the cores of the blocks, packed on an
 *    occupancy grid so nothing overlaps a street, water, another house or a kept-out area.
 *  - Facades are drawn in the shader in each wall's own metres (storeys, window bays — arched with
 *    painted shutters on the old houses — grilles, slab lines, rain streaks, grime and damp), plaster
 *    in muted Malwa colours; ground floors that face a street get rolling shutters (shops).
 *  - Geometry: chhajjas over the windows, balconies with railings, parapets, roof stair-heads and water
 *    tanks on some roofs. Everything is merged or instanced: about a dozen draw calls in all.
 *
 * Coordinates: world x = east, z = south (see osm.ts projector()).
 */

export interface TownOpts {
  project: (p: EN) => XZ;
  /** half size of the square the town covers (m) */
  half: number;
  /** nothing at all is built in these (the precinct, a corridor, a landmark's compound) */
  keepOut: XZ[][];
  /** no synthesised houses in these (real OSM footprints still appear) */
  noSynth?: XZ[][];
  /** holes in the ground (the site draws its own floor there) */
  groundHoles?: XZ[][];
  /** streets within r of one of these points are stone-paved (pedestrian zone round the temple) */
  paverNear: { x: number; z: number; r: number }[];
  /** street-level detail (shop awnings, sign boards, stalls, wires, parked vehicles) within r of this point */
  detail: { x: number; z: number; r: number };
  /** no synthesised houses beyond this distance from the origin */
  maxR: number;
  /** extra road ribbons (model coords) the site wants drawn, e.g. a widened street before a gate */
  extraRoads?: { p: XZ[]; w: number; paver?: boolean }[];
  /** skip an OSM road (e.g. the footways the site draws itself) */
  skipRoad?: (hw: string, p: XZ[]) => boolean;
  /** skip an OSM building (e.g. the temple the site models itself) */
  skipBuilding?: (ring: XZ[], kind?: string) => boolean;
  seed?: number;
  materials: {
    asphalt: THREE.Material; paver: THREE.Material; ground: THREE.Material;
  };
  /** Hindi shop names for the sign boards */
  shopNames?: string[];
}

export interface ShopSlot { x: number; z: number; /** outward normal (into the street) */ nx: number; nz: number; len: number; dist: number }
export interface Town {
  group: THREE.Group;
  /** the water outlines (clipped to the town square), for the site to draw */
  waters: XZ[][];
  shops: ShopSlot[];
  /** points along the streets near the temple, with the street's direction and half width (for street life) */
  kerbs: { x: number; z: number; dx: number; dz: number; hw: number }[];
  treeSpots: [number, number, number][];
  /** the town's houses (model coords), to make the ones beside walkable streets solid */
  houses: { ring: XZ[]; h: number }[];
  stats: { real: number; synth: number; tris: number };
}

/** clip a ring to the square |x|, |z| <= L (Sutherland-Hodgman); null if nothing is left */
export function clipRing(p: XZ[], L: number): XZ[] | null {
  const edges: [(q: XZ) => boolean, (a: XZ, b: XZ) => number][] = [
    [(q) => q[0] >= -L, (a, b) => (-L - a[0]) / (b[0] - a[0])], [(q) => q[0] <= L, (a, b) => (L - a[0]) / (b[0] - a[0])],
    [(q) => q[1] >= -L, (a, b) => (-L - a[1]) / (b[1] - a[1])], [(q) => q[1] <= L, (a, b) => (L - a[1]) / (b[1] - a[1])]];
  for (const [inside, t] of edges) {
    const out: XZ[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length], b = p[i], ia = inside(a), ib = inside(b);
      const cut = (): XZ => { const k = t(a, b); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
      if (ib) { if (!ia) out.push(cut()); out.push(b); } else if (ia) out.push(cut());
    }
    p = out;
    if (p.length < 3) return null;
  }
  return p;
}

// ------------------------------------------------------------------ random

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ------------------------------------------------------------------ occupancy grid

const FREE = 0, WATER = 1, KEEP = 2, ROAD = 3, HOUSE = 4, NOSYN = 5;

class Grid {
  n: number; a: Uint8Array; ang: Float32Array;
  constructor(public half: number, public cell: number) {
    this.n = Math.ceil((2 * half) / cell);
    this.a = new Uint8Array(this.n * this.n);
    this.ang = new Float32Array(this.n * this.n).fill(NaN);
  }
  i(x: number, z: number) {
    const ix = Math.floor((x + this.half) / this.cell), iz = Math.floor((z + this.half) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return -1;
    return iz * this.n + ix;
  }
  get(x: number, z: number) { const k = this.i(x, z); return k < 0 ? KEEP : this.a[k]; }
  /** scanline fill of a ring (cells whose centre is inside) */
  fillRing(p: XZ[], v: number, only?: number) {
    let z0 = Infinity, z1 = -Infinity;
    for (const [, z] of p) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const c = this.cell, h = this.half;
    for (let iz = Math.max(0, Math.floor((z0 + h) / c)); iz <= Math.min(this.n - 1, Math.floor((z1 + h) / c)); iz++) {
      const zc = -h + (iz + 0.5) * c;
      const xs: number[] = [];
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, zi] = p[i], [xj, zj] = p[j];
        if ((zi > zc) !== (zj > zc)) xs.push(xi + ((zc - zi) * (xj - xi)) / (zj - zi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let ix = Math.max(0, Math.ceil((xs[k] + h) / c - 0.5)); ix <= Math.min(this.n - 1, Math.floor((xs[k + 1] + h) / c - 0.5)); ix++) {
          const q = iz * this.n + ix;
          if (only === undefined || this.a[q] === only) this.a[q] = v;
        }
      }
    }
  }
  /** cells within r of segment a-b; also records the street direction near streets */
  fillSeg(ax: number, az: number, bx: number, bz: number, r: number, v: number, angR = 0) {
    const R = Math.max(r, angR), c = this.cell, h = this.half;
    const x0 = Math.min(ax, bx) - R, x1 = Math.max(ax, bx) + R, z0 = Math.min(az, bz) - R, z1 = Math.max(az, bz) + R;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, ang = Math.atan2(dz, dx);
    for (let iz = Math.max(0, Math.floor((z0 + h) / c)); iz <= Math.min(this.n - 1, Math.floor((z1 + h) / c)); iz++) {
      const zc = -h + (iz + 0.5) * c;
      for (let ix = Math.max(0, Math.floor((x0 + h) / c)); ix <= Math.min(this.n - 1, Math.floor((x1 + h) / c)); ix++) {
        const xc = -h + (ix + 0.5) * c;
        const t = Math.max(0, Math.min(1, ((xc - ax) * dx + (zc - az) * dz) / L2));
        const d = Math.hypot(xc - ax - dx * t, zc - az - dz * t);
        const q = iz * this.n + ix;
        if (d <= r && this.a[q] !== WATER && this.a[q] !== KEEP) this.a[q] = v;
        if (d <= angR && Number.isNaN(this.ang[q])) this.ang[q] = ang;
      }
    }
  }
  /** is an oriented rectangle (centre, unit axis u along w, depth d) entirely free? */
  rectFree(cx: number, cz: number, ux: number, uz: number, w: number, d: number, also = -1) {
    const s = this.cell * 0.7;
    for (let a = -w / 2 + 0.3; a <= w / 2 - 0.3 + 1e-6; a += s) {
      for (let b = -d / 2 + 0.3; b <= d / 2 - 0.3 + 1e-6; b += s) {
        const v = this.get(cx + ux * a - uz * b, cz + uz * a + ux * b);
        if (v !== FREE && v !== also) return false;
      }
    }
    return true;
  }
}

const rect = (cx: number, cz: number, ux: number, uz: number, w: number, d: number): XZ[] => {
  // counter-clockwise in x-z (positive ringArea)
  const ax = ux * w / 2, az = uz * w / 2, bx = -uz * d / 2, bz = ux * d / 2;
  const r: XZ[] = [[cx - ax - bx, cz - az - bz], [cx + ax - bx, cz + az - bz], [cx + ax + bx, cz + az + bz], [cx - ax + bx, cz - az + bz]];
  return ringArea(r) < 0 ? r.reverse() : r;
};

// ------------------------------------------------------------------ facade shader

/** Muted plaster of old Ujjain: cream, ochre, dusty pink, pale green, white, pale blue, buff. */
export const PLASTER = [0xeee6d4, 0xe8dcc0, 0xe2c99a, 0xd9b27a, 0xe6c4b4, 0xdcaaa0, 0xc9d6b8, 0xb8ccb0, 0xf2efe8, 0xe9e4da,
  0xc4d2d8, 0xa9c0cc, 0xe0d0b0, 0xd8c8b8, 0xf0dcc0, 0xcfc0a8];

function facadeMaterial(key: string) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWall; attribute vec2 aMisc; varying vec4 vWall; varying vec2 vMisc; varying vec3 vP; varying vec3 vN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall; vMisc = aMisc; vP = position; vN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vWall; varying vec2 vMisc; varying vec3 vP; varying vec3 vN;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 base = diffuseColor.rgb;
          float sd = vWall.w;
          if (vN.y > 0.5) {
            // flat RCC roofs: grey concrete, damp blotches, tar patches, the odd lime-washed terrace
            float n = fn(vP.xz * 0.6) * 0.6 + fn(vP.xz * 2.3) * 0.4;
            vec3 r = mix(vec3(0.4, 0.38, 0.35), vec3(0.6, 0.58, 0.54), step(0.86, sd));
            r *= mix(vec3(1.0), vec3(1.08, 0.98, 0.9), step(0.5, fract(sd * 13.0)));
            r *= 0.72 + 0.4 * n;
            r = mix(r, vec3(0.2, 0.19, 0.18), 0.5 * smoothstep(0.72, 0.9, fn(vP.xz * 0.35 + sd * 20.0)));
            diffuseColor.rgb = r;
          } else {
            float u = vWall.x, L = vWall.y, H = vWall.z, y = vP.y;
            bool shop = vMisc.x > 0.5;
            bool old = vMisc.y > 0.5;
            float SH = 3.1;
            float storey = floor(y / SH), fy = y - storey * SH;
            float nb = max(1.0, floor(L / (old ? 2.4 : 2.9)));
            float bw = L / nb;
            float bay = floor(u / bw);
            float fu = u - (bay + 0.5) * bw;
            vec3 c = base;
            // weathering: vertical rain streaks from the slabs, blotchy damp, soot near the top, grime at the foot
            float streak = fn(vec2(u * 1.9, y * 0.1 + sd * 9.0));
            c *= 0.8 + 0.26 * streak;
            float blot = fn(vec2(u * 0.3 + sd * 13.0, y * 0.35));
            c *= 0.86 + 0.18 * blot;
            float damp = smoothstep(0.62, 0.9, fn(vec2(u * 0.5 + sd * 7.0, y * 0.22)));
            c = mix(c, c * vec3(0.72, 0.74, 0.7), damp * 0.6);
            c = mix(c, vec3(0.3, 0.28, 0.25), 0.25 * smoothstep(0.55, 0.95, fn(vec2(u * 0.9, y * 0.05 + sd * 3.0))) * smoothstep(H - 3.0, H, y));
            c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.0, y));
            // a painted dado band on some old houses
            if (old && y < 0.9 && sd > 0.5) c = mix(c, c * vec3(0.78, 0.66, 0.6), 0.6);
            // floor slabs and the parapet coping
            float slab = step(SH - 0.18, fy) * step(y, H - 0.2);
            c = mix(c, c * 1.1 + 0.04, slab * 0.8);
            if (y > H) c = mix(c, c * 0.92, 0.5) * (y > H + 0.75 ? 1.12 : 1.0);
            if (storey < 0.5 && shop) {
              // shop fronts: rolling shutters, half of them up showing a dim interior with goods
              if (abs(fu) < bw * 0.44 && fy < 2.55) {
                float open = step(0.45, fh(vec2(bay, sd * 31.0)));
                float rib = 0.5 + 0.5 * sin(fy * 72.0);
                vec3 shut = mix(vec3(0.34, 0.35, 0.36), vec3(0.5, 0.51, 0.52), rib);
                shut *= fh(vec2(bay + 3.0, sd)) > 0.8 ? vec3(0.55, 0.75, 1.0) : vec3(1.0);
                vec3 inside = vec3(0.09, 0.07, 0.06);
                // shelves of coloured goods inside an open shop
                float shelf = step(0.5, fract(fy * 2.2)) * step(0.4, fy) * step(fy, 2.1);
                vec3 goods = vec3(fh(vec2(floor(fu * 4.0), floor(fy * 2.2) + bay)), fh(vec2(floor(fu * 4.0) + 7.0, bay)), fh(vec2(bay, floor(fy * 2.2) + 3.0)));
                inside = mix(inside, goods * 0.35, shelf * 0.8);
                c = mix(shut, inside, open * step(0.25, fy));
              }
              // sign band over the shutters
              if (fy > 2.55 && fy < 2.95) c = mix(c, c * 0.85, 0.5);
            } else if (y < H - 0.6) {
              float wx = abs(fu), wy = fy - 1.35;
              float ww = old ? 0.5 : 0.62, wh = 0.68;
              // arched heads on the old houses' windows
              float archTop = old ? wh + ww * 0.55 * sqrt(max(0.0, 1.0 - (wx / ww) * (wx / ww))) - ww * 0.15 : wh;
              if (wx < ww && wy > -wh && wy < archTop) {
                bool frame = wx > ww - 0.07 || wy < -wh + 0.07 || wy > archTop - 0.07;
                float grill = step(0.9, fract((fu + ww) / 0.14)) + step(0.88, fract((wy + wh) / 0.3));
                float hb = fh(vec2(bay, storey + sd * 7.0));
                vec3 shutter = hb < 0.33 ? vec3(0.18, 0.38, 0.32) : hb < 0.6 ? vec3(0.17, 0.32, 0.52) : vec3(0.42, 0.24, 0.12);
                vec3 glass = mix(vec3(0.07, 0.08, 0.09), vec3(0.55, 0.52, 0.46), step(0.7, fh(vec2(bay * 1.7, storey))));
                vec3 pane = old ? (fh(vec2(bay + 9.0, storey)) > 0.4 ? shutter * (0.7 + 0.3 * step(0.5, fract(wy * 3.0))) : glass) : glass;
                c = frame ? vec3(0.88, 0.86, 0.82) : mix(pane, vec3(0.3), min(1.0, grill) * (old ? 0.25 : 0.55));
              }
              // a stain under every sill, a shadow line under the chhajja
              if (wx < ww * 0.8 && wy < -wh) c *= 1.0 - 0.2 * smoothstep(0.0, -1.3, wy + wh) * streak;
              if (fy > 2.32 && fy < 2.5 && wx < ww + 0.3) c *= 0.55;
            }
            diffuseColor.rgb = c;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'osm-facade-' + key;
  return m;
}

// ------------------------------------------------------------------ building geometry

interface House { ring: XZ[]; h: number; color: THREE.Color; seed: number; parapet: boolean; old: boolean; synth: boolean }

class HouseGeo {
  pos: number[] = []; nrm: number[] = []; col: number[] = []; wall: number[] = []; misc: number[] = []; idx: number[] = [];
  private v(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, w: [number, number, number, number], m: [number, number]) {
    this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.col.push(c.r, c.g, c.b); this.wall.push(...w); this.misc.push(...m);
    return this.pos.length / 3 - 1;
  }
  /** a vertical quad from a to b (outward normal given), y0..y1; u runs from u0 */
  quad(a: XZ, b: XZ, y0: number, y1: number, n: XZ, c: THREE.Color, u0: number, L: number, H: number, seed: number, shop: number, old: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m: [number, number] = [shop, old];
    const i0 = this.v(a[0], y0, a[1], n[0], 0, n[1], c, [u0, L, H, seed], m);
    const i1 = this.v(a[0], y1, a[1], n[0], 0, n[1], c, [u0, L, H, seed], m);
    const i2 = this.v(b[0], y0, b[1], n[0], 0, n[1], c, [u0 + len, L, H, seed], m);
    const i3 = this.v(b[0], y1, b[1], n[0], 0, n[1], c, [u0 + len, L, H, seed], m);
    // (a, a', b) faces along n when n = (dz, -dx) of a counter-clockwise ring
    this.idx.push(i0, i1, i2, i2, i1, i3);
  }
  roof(ring: XZ[], y: number, c: THREE.Color, seed: number) {
    const pts = ring.map(([x, z]) => new THREE.Vector2(x, z));
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    const base = this.pos.length / 3;
    for (const [x, z] of ring) this.v(x, y, z, 0, 1, 0, c, [0, 1, y, seed], [0, 0]);
    for (const [a, b, d] of tris) {
      // upward-facing: (b - a) x (d - a) must have +y, i.e. (dz_ab * dx_ad - dx_ab * dz_ad) > 0
      const [ax, az] = ring[a], [bx, bz] = ring[b], [cx, cz] = ring[d];
      const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (up > 0) this.idx.push(base + a, base + b, base + d); else this.idx.push(base + a, base + d, base + b);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aWall', new THREE.Float32BufferAttribute(this.wall, 4));
    g.setAttribute('aMisc', new THREE.Float32BufferAttribute(this.misc, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** inset a counter-clockwise ring by d (miter, clamped) */
function inset(ring: XZ[], d: number): XZ[] {
  const n = ring.length, out: XZ[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n], c = ring[i], q = ring[(i + 1) % n];
    const e1x = c[0] - p[0], e1z = c[1] - p[1], l1 = Math.hypot(e1x, e1z) || 1;
    const e2x = q[0] - c[0], e2z = q[1] - c[1], l2 = Math.hypot(e2x, e2z) || 1;
    // inward normals of a CCW ring: (-dz, dx)
    const n1x = -e1z / l1, n1z = e1x / l1, n2x = -e2z / l2, n2z = e2x / l2;
    let mx = n1x + n2x, mz = n1z + n2z;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = Math.min(3, 1 / Math.max(0.35, mx * n1x + mz * n1z));
    out.push([c[0] + mx * d * k, c[1] + mz * d * k]);
  }
  return out;
}

// ------------------------------------------------------------------ street furniture geometry

/** a parked motorcycle / scooter, ~1.9 m long along +x; body vertex colour white (tinted per instance), the rest dark */
function twoWheelerGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const col = (g: THREE.BufferGeometry, c: number) => {
    const k = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = k.r; a[i + 1] = k.g; a[i + 2] = k.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return parts.push(g.index ? g.toNonIndexed() : g);
  };
  const rod = (ax: number, ay: number, bx: number, by: number, r: number, c: number) => {
    const L = Math.hypot(bx - ax, by - ay);
    col(new THREE.CylinderGeometry(r, r, L, 5).rotateZ(-Math.atan2(bx - ax, by - ay)).translate((ax + bx) / 2, (ay + by) / 2, 0), c);
  };
  for (const x of [-0.66, 0.64]) {
    col(new THREE.TorusGeometry(0.25, 0.065, 4, 9).translate(x, 0.31, 0), 0x141414);
    col(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 5, 1, true).rotateX(Math.PI / 2).translate(x, 0.31, 0), 0x8a8a8a);
  }
  col(new THREE.BoxGeometry(0.46, 0.28, 0.2).translate(0.02, 0.45, 0), 0x3a3a3a); // engine
  col(new THREE.SphereGeometry(1, 6, 3).scale(0.3, 0.14, 0.17).translate(0.22, 0.76, 0), 0xffffff); // tank
  col(new THREE.BoxGeometry(0.5, 0.17, 0.2).translate(-0.36, 0.67, 0), 0xffffff); // side panel
  col(new THREE.BoxGeometry(0.62, 0.09, 0.25).translate(-0.24, 0.82, 0), 0x161412); // seat
  col(new THREE.TorusGeometry(0.29, 0.03, 3, 5, Math.PI * 0.6).rotateZ(Math.PI * 0.25).translate(0.64, 0.31, 0), 0xffffff); // mudguard
  rod(0.64, 0.31, 0.5, 0.98, 0.028, 0x9a9a9a); // fork
  rod(-0.66, 0.31, -0.1, 0.5, 0.03, 0x5a5a5a); // swing arm
  col(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 5).rotateX(Math.PI / 2).translate(0.47, 1.02, 0), 0x202020); // handlebar
  col(new THREE.SphereGeometry(0.075, 5, 3).translate(0.6, 0.92, 0), 0xf4f0d8); // headlamp
  col(new THREE.BoxGeometry(0.34, 0.05, 0.08).translate(-0.6, 0.43, 0.12), 0x6a6a6a); // silencer
  return mergeGeometries(parts)!;
}

/** an e-rickshaw, ~2.7 m long along +x: open passenger box under a canopy, three wheels */
function eRickshawGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const col = (g: THREE.BufferGeometry, c: number) => {
    const k = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = k.r; a[i + 1] = k.g; a[i + 2] = k.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  for (const z of [-0.5, 0.5]) col(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 9).rotateX(Math.PI / 2).translate(-0.8, 0.24, z), 0x151515);
  col(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 9).rotateX(Math.PI / 2).translate(1.05, 0.24, 0), 0x151515);
  col(new THREE.BoxGeometry(2.2, 0.3, 1.05).translate(0, 0.5, 0), 0xffffff);
  col(new THREE.BoxGeometry(1.2, 0.45, 0.95).translate(-0.45, 0.85, 0), 0x2a2622);
  for (const [x, z] of [[1.0, -0.45], [1.0, 0.45], [-1.05, -0.5], [-1.05, 0.5], [0.15, -0.5], [0.15, 0.5]]) col(new THREE.BoxGeometry(0.05, 1.3, 0.05).translate(x, 1.3, z), 0x303030);
  col(new THREE.BoxGeometry(2.45, 0.08, 1.2).translate(0, 1.97, 0), 0xffffff);
  col(new THREE.BoxGeometry(0.06, 0.6, 1.0).translate(1.08, 1.45, 0), 0x6a7a80);
  return mergeGeometries(parts)!;
}

/** a flower / prasad / puja-goods stall in front of a shop: low table with heaps, hanging marigold strings */
function stallGeo(r: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  const col = (g: THREE.BufferGeometry, c: number) => {
    const k = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = k.r; a[i + 1] = k.g; a[i + 2] = k.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  // table 2.2 x 0.9, 0.75 high (front edge at +z)
  col(new THREE.BoxGeometry(2.2, 0.08, 0.9).translate(0, 0.75, 0), 0x7a5a3a);
  for (const [x, z] of [[-1.0, -0.38], [1.0, -0.38], [-1.0, 0.38], [1.0, 0.38]]) col(new THREE.BoxGeometry(0.06, 0.75, 0.06).translate(x, 0.375, z), 0x4a3a2a);
  // heaps of marigold, rose petals, white jasmine; baskets of coconuts; stacked prasad boxes
  const heap = [0xf08a10, 0xe8a018, 0xb81820, 0xf4f0e0, 0xe86818, 0xd02860];
  for (let k = 0; k < 6; k++) {
    const x = -0.85 + k * 0.34, c = heap[Math.floor(r() * heap.length)];
    col(new THREE.SphereGeometry(0.17, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(x, 0.79, 0.1 + (k % 2) * 0.16), c);
  }
  col(new THREE.BoxGeometry(0.5, 0.3, 0.3).translate(0.75, 0.94, -0.25), 0xe8c030);
  col(new THREE.BoxGeometry(0.5, 0.18, 0.3).translate(0.75, 1.18, -0.25), 0xd84a20);
  for (let k = 0; k < 3; k++) col(new THREE.SphereGeometry(0.08, 5, 3).translate(-0.7 + k * 0.17, 0.87, -0.25), 0x6a4a2a);
  // marigold strings hanging from the awning line (≈2.6 m) down to 1.2 m
  for (let k = 0; k < 7; k++) col(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 4, 1, true).translate(-0.9 + k * 0.3, 1.95, 0.45), k % 3 === 2 ? 0xc81818 : 0xf09010);
  return mergeGeometries(parts)!;
}

/** a canvas atlas of Hindi shop boards: 4 columns x 8 rows, 512 x 128 px each */
function signAtlas(names: string[], r: () => number) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const g = c.getContext('2d')!;
  const BG = [['#c8141a', '#ffe680'], ['#f2c21a', '#8a1010'], ['#1a4aa0', '#ffffff'], ['#f4f0e6', '#b01818'], ['#1e7a3c', '#fff6c0'],
    ['#e8681a', '#ffffff'], ['#6a1a7a', '#ffe0a0'], ['#ffffff', '#1a3a8a'], ['#8a1a10', '#ffd040']];
  for (let k = 0; k < 32; k++) {
    const x = (k % 4) * 512, y = Math.floor(k / 4) * 128;
    const [bg, fg] = BG[Math.floor(r() * BG.length)];
    g.fillStyle = bg; g.fillRect(x, y, 512, 128);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + 112, 512, 16);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, 496, 100);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 54px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
    g.fillText(names[k % names.length], x + 256, y + 52, 470);
    g.font = '600 18px "Helvetica Neue", Arial, sans-serif';
    g.fillText(['UJJAIN', 'MAHAKAL MARG', 'JAI SHRI MAHAKAL', 'SINCE 1972', 'PH. 0734-25', ''][Math.floor(r() * 6)], x + 256, y + 94);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const DEFAULT_SHOPS = [
  'श्री महाकाल प्रसाद भंडार', 'जय महाकाल फूल माला', 'पूजन सामग्री', 'महाकाल भोग प्रसाद', 'रुद्राक्ष माला केंद्र', 'उज्जैन मिष्ठान्न भंडार',
  'शिव शक्ति होटल', 'श्री गणेश जनरल स्टोर', 'हरसिद्धि भोजनालय', 'महाकाल लस्सी कॉर्नर', 'अवंतिका धर्मशाला', 'क्षिप्रा गेस्ट हाउस',
  'बाबा महाकाल फोटो स्टूडियो', 'चाय नाश्ता', 'पान भंडार', 'मोबाइल रिचार्ज', 'भस्म आरती बुकिंग', 'शुद्ध शाकाहारी भोजनालय',
  'जय श्री महाकाल वस्त्रालय', 'दूध डेयरी', 'मेडिकल स्टोर', 'जूता घर · चप्पल स्टैंड', 'श्रृंगार स्टोर', 'पोहा जलेबी',
  'नमकीन भंडार', 'शिवम् बर्तन भंडार', 'प्रसाद एवं फूल', 'कुमकुम चंदन', 'महाकाल होटल', 'साईं कृपा ट्रेडर्स', 'लड्डू प्रसाद', 'अगरबत्ती भंडार',
];

// ------------------------------------------------------------------ the town

export function buildTown(data: OsmData, o: TownOpts): Town {
  const r = rng(o.seed ?? 7);
  const P = o.project;
  const group = new THREE.Group();
  group.name = 'osm-town';
  const grid = new Grid(o.half, 2);
  const inKeep = (x: number, z: number) => o.keepOut.some((k) => pointInRing(x, z, k));

  // ---- 1. water and kept-out areas on the grid
  const waters = data.water.map((w) => clipRing(w.p.map(P), o.half - 1)).filter((w): w is XZ[] => !!w);
  for (const w of waters) grid.fillRing(w, WATER);
  for (const k of o.keepOut) grid.fillRing(k, KEEP);
  for (const k of o.noSynth ?? []) grid.fillRing(k, NOSYN, FREE);

  // ---- 2. streets
  const roads = data.roads.map((rd) => ({ ...rd, q: rd.p.map(P) }))
    .filter((rd) => !rd.tunnel && !(o.skipRoad?.(rd.hw, rd.q)));
  const isWalk = (hw: string) => /^(footway|path|steps|track|cycleway|corridor|bridleway)$/.test(hw);
  for (const rd of roads) {
    const hw = isWalk(rd.hw) ? 0.8 : rd.w / 2 + 0.6; // + a strip of kerb / parking
    for (let i = 1; i < rd.q.length; i++) grid.fillSeg(rd.q[i - 1][0], rd.q[i - 1][1], rd.q[i][0], rd.q[i][1], hw, ROAD, isWalk(rd.hw) ? 0 : 26);
  }
  for (const ex of o.extraRoads ?? []) for (let i = 1; i < ex.p.length; i++) grid.fillSeg(ex.p[i - 1][0], ex.p[i - 1][1], ex.p[i][0], ex.p[i][1], ex.w / 2 + 0.4, ROAD, 26);

  // ---- 3. houses: real footprints first
  const houses: House[] = [];
  const dist0 = (x: number, z: number) => Math.hypot(x, z);
  const storeys = (d: number) => {
    // 2-4 storeys, taller (hotels, dharamshalas) near the temple, lower at the edge of the old town
    const mean = d < 250 ? 3.1 : d < 500 ? 2.6 : 2.2;
    return Math.max(1, Math.min(5, Math.round(mean + (r() + r() - 1) * 1.6)));
  };
  const colour = (old: boolean) => new THREE.Color(PLASTER[Math.floor(r() * PLASTER.length)]).offsetHSL((r() - 0.5) * 0.02, old ? 0.02 : -0.02, (r() - 0.5) * 0.06);
  let realN = 0;
  for (const b of data.buildings) {
    let ring = b.p.map(P);
    if (ring.length < 3) continue;
    if (ringArea(ring) < 0) ring = ring.reverse();
    let cx = 0, cz = 0;
    for (const [x, z] of ring) { cx += x; cz += z; }
    cx /= ring.length; cz /= ring.length;
    if (Math.abs(cx) > o.half - 5 || Math.abs(cz) > o.half - 5) continue;
    if (inKeep(cx, cz) || ring.some(([x, z]) => grid.get(x, z) === WATER || grid.get(x, z) === KEEP)) continue;
    if (o.skipBuilding?.(ring, b.kind)) continue;
    const area = Math.abs(ringArea(ring));
    if (area < 6) continue;
    const lv = b.lv ?? (b.h ? Math.max(1, Math.round(b.h / 3.1)) : storeys(dist0(cx, cz)));
    const h = b.h ?? lv * 3.1 + (r() - 0.5) * 0.4;
    grid.fillRing(ring, HOUSE);
    const old = r() < 0.55;
    houses.push({ ring, h, color: colour(old), seed: r(), parapet: r() < 0.8, old, synth: false });
    realN++;
  }

  // ---- 4. synthesised frontage along the real streets
  let synthN = 0;
  const addLot = (cx: number, cz: number, ux: number, uz: number, w: number, d: number) => {
    const ring = rect(cx, cz, ux, uz, w, d);
    grid.fillRing(ring, HOUSE);
    const old = r() < 0.6;
    houses.push({ ring, h: storeys(dist0(cx, cz)) * 3.1 + (r() - 0.5) * 0.5, color: colour(old), seed: r(), parapet: r() < 0.75, old, synth: true });
    synthN++;
  };
  for (const rd of roads) {
    if (isWalk(rd.hw) || rd.w < 2.5) continue;
    const half = rd.w / 2 + 0.6;
    for (let i = 1; i < rd.q.length; i++) {
      const [ax, az] = rd.q[i - 1], [bx, bz] = rd.q[i];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 5) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const s of [-1, 1]) {
        let t = 1 + r() * 2;
        while (t < L - 3) {
          const w = Math.min(L - t, 3.8 + r() * 6.5);
          const mx = ax + ux * (t + w / 2), mz = az + uz * (t + w / 2);
          if (dist0(mx, mz) > o.maxR) { t += w; continue; }
          let placed = false;
          for (const d of [9 + r() * 7, 7, 5]) {
            const set = half + 0.15 + (r() < 0.12 ? 1.2 : 0);
            // normal to the street: (-uz, ux) * s
            const cx = mx - uz * s * (set + d / 2), cz = mz + ux * s * (set + d / 2);
            if (grid.rectFree(cx, cz, ux, uz, w, d)) { addLot(cx, cz, ux, uz, w, d); placed = true; break; }
          }
          t += w + (placed ? (r() < 0.07 ? 1.5 + r() * 2.5 : 0.05) : 1);
        }
      }
    }
  }
  // ---- 5. the cores of the blocks: houses facing the nearest street, on a jittered lattice
  for (let pass = 0; pass < 2; pass++) {
    const step = pass === 0 ? 11 : 7;
    for (let z = -o.half + 8; z < o.half - 8; z += step) {
      for (let x = -o.half + 8; x < o.half - 8; x += step) {
        const px = x + (r() - 0.5) * step * 0.6, pz = z + (r() - 0.5) * step * 0.6;
        if (dist0(px, pz) > (pass ? Math.min(o.maxR, 460) : o.maxR) || grid.get(px, pz) !== FREE) continue;
        if (r() < 0.06) continue; // the odd open plot or courtyard
        const k = grid.i(px, pz);
        const ang = Number.isNaN(grid.ang[k]) ? 0 : grid.ang[k];
        const ux = Math.cos(ang), uz = Math.sin(ang);
        for (const [w, d] of [[7 + r() * 6, 8 + r() * 5], [5 + r() * 3, 6 + r() * 2]]) {
          if (grid.rectFree(px, pz, ux, uz, w, d)) { addLot(px, pz, ux, uz, w, d); break; }
        }
      }
    }
  }

  // ---- 6. facades: two merged meshes (near ones cast sun shadows, the rest don't); extras instanced
  const hgNear = new HouseGeo(), hgFar = new HouseGeo();
  const shops: ShopSlot[] = [];
  const chh: THREE.Matrix4[] = [], chhC: THREE.Color[] = [], rail: THREE.Matrix4[] = [], tanks: THREE.Matrix4[] = [], tankC: THREE.Color[] = [];
  const heads: THREE.Matrix4[] = [], headC: THREE.Color[] = [];
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(), T = new THREE.Vector3();
  const D = o.detail;
  const TANK = [0x1c1c1e, 0x1c1c1e, 0x202022, 0xe8e6e0, 0x3a6aa0, 0x2a2c2e];
  for (const h of houses) {
    const ring = h.ring, n = ring.length;
    let cx = 0, cz = 0;
    for (const [x, z] of ring) { cx += x; cz += z; }
    cx /= n; cz /= n;
    const d0 = Math.hypot(cx - D.x, cz - D.z), near = d0 < D.r, mid = dist0(cx, cz) < 300;
    // far houses: plain extrusions (no parapet faces) and no shadow casting
    const lod = dist0(cx, cz) > 360;
    const hg = dist0(cx, cz) < 170 ? hgNear : hgFar;
    const pH = h.parapet && !lod ? 0.9 : 0;
    let u = 0;
    const perim = ring.reduce((s, p, i) => s + Math.hypot(ring[(i + 1) % n][0] - p[0], ring[(i + 1) % n][1] - p[1]), 0);
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
      // street-facing: a street cell just outside the wall's middle
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const street = [1.6, 3.2, 4.8].some((k) => grid.get(mx + nx * k, mz + nz * k) === ROAD);
      const shop = street && L > 2.4 && (near || r() < 0.55) ? 1 : 0;
      hg.quad(a, b, 0, h.h + pH, [nx, nz], h.color, 0, L, h.h, h.seed, shop, h.old ? 1 : 0);
      u += L;
      if (!street || !mid || L < 2.2) continue;
      const ry = Math.atan2(nx, nz); // local +z points out of the wall
      q.setFromAxisAngle(Y, ry);
      const st = Math.floor(h.h / 3.1 + 0.05);
      // a chhajja over each upper storey's windows; a balcony on some
      for (let k = shop ? 1 : 0; k < st; k++) {
        const y = k * 3.1 + 2.45;
        chh.push(new THREE.Matrix4().compose(T.set(mx + nx * 0.3, y, mz + nz * 0.3), q, S.set(L * 0.94, 0.08, 0.6)));
        chhC.push(h.color.clone().multiplyScalar(0.95));
        if (k >= 1 && r() < (h.old ? 0.32 : 0.22)) {
          const bl = Math.min(L * 0.7, 2.5 + r() * 2.5), off = (r() - 0.5) * (L - bl);
          const bx = mx + (b[0] - a[0]) / L * off, bz = mz + (b[1] - a[1]) / L * off;
          chh.push(new THREE.Matrix4().compose(T.set(bx + nx * 0.5, k * 3.1 - 0.02, bz + nz * 0.5), q, S.set(bl, 0.14, 1.0)));
          chhC.push(h.color.clone().multiplyScalar(0.9));
          rail.push(new THREE.Matrix4().compose(T.set(bx + nx * 0.98, k * 3.1 + 0.55, bz + nz * 0.98), q, S.set(bl, 0.95, 0.04)));
        }
      }
      if (shop && near) shops.push({ x: mx, z: mz, nx, nz, len: L, dist: d0 });
    }
    void u; void perim;
    const top = pH ? inset(ring, 0.22) : ring;
    if (pH) {
      // the parapet's inner faces
      for (let i = 0; i < n; i++) {
        const a = top[i], b = top[(i + 1) % n];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.05) continue;
        const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
        hg.quad(b, a, h.h, h.h + pH, [nx, nz], h.color, 0, L, h.h, h.seed, 0, 0);
      }
      // coping ring on top: a quad strip between the outer and inner rings
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n], ai = top[i], bi = top[(i + 1) % n];
        const base = hg.pos.length / 3, c = h.color, y = h.h + pH;
        for (const p of [a, b, bi, ai]) { hg.pos.push(p[0], y, p[1]); hg.nrm.push(0, 1, 0); hg.col.push(c.r, c.g, c.b); hg.wall.push(0, 1, y, h.seed); hg.misc.push(0, 0); }
        hg.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
    hg.roof(top, h.h, h.color, h.seed);
    // roof clutter: black / white Sintex tanks on some roofs, a stair head on others
    // blue tarpaulins stretched over part of a roof: the colour of Ujjain from the air
    if (dist0(cx, cz) < 650 && r() < 0.16 && Math.abs(ringArea(ring)) > 30) {
      heads.push(new THREE.Matrix4().compose(T.set(cx + (r() - 0.5) * 2, h.h + 0.2 + r() * 0.8, cz + (r() - 0.5) * 2), q.setFromAxisAngle(Y, r() * 3), S.set(3 + r() * 3, 0.06, 3 + r() * 2.5)));
      headC.push(new THREE.Color([0x2f6fb8, 0x3a7ac4, 0x4a86c0, 0x2a5a9a, 0x8a9aa8][Math.floor(r() * 5)]));
    }
    if (dist0(cx, cz) < 330) {
      const k = r();
      const area = Math.abs(ringArea(ring));
      if (k < 0.34 && area > 25) {
        for (let m = 0; m < 1 + Math.floor(r() * 2); m++) {
          tanks.push(new THREE.Matrix4().compose(T.set(cx + (r() - 0.5) * 2, h.h, cz + (r() - 0.5) * 2), q.identity(), S.setScalar(0.75 + r() * 0.4)));
          tankC.push(new THREE.Color(TANK[Math.floor(r() * TANK.length)]));
        }
      } else if (k < 0.58 && area > 40) {
        heads.push(new THREE.Matrix4().compose(T.set(cx + (r() - 0.5) * 2, h.h, cz + (r() - 0.5) * 2), q.setFromAxisAngle(Y, r() * 3), S.set(2.6, 2.4, 2.8)));
        headC.push(h.color.clone().multiplyScalar(0.92));
      }
    }
  }
  const facade = facadeMaterial('house');
  for (const [hg, cast] of [[hgNear, true], [hgFar, false]] as const) {
    if (!hg.idx.length) continue;
    const houseMesh = new THREE.Mesh(hg.build(), facade);
    houseMesh.castShadow = cast;
    houseMesh.receiveShadow = true;
    group.add(houseMesh);
  }

  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cols?: THREE.Color[], shadow = false) => {
    if (!ms.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, ms.length);
    ms.forEach((m, i) => { im.setMatrixAt(i, m); if (cols) im.setColorAt(i, cols[i]); });
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  const plaster = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  inst(new THREE.BoxGeometry(1, 1, 1), plaster, chh, chhC, true);
  inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), plaster, heads, headC);
  const railTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2a2826';
    for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 3, 64);
    g.fillRect(0, 0, 64, 6); g.fillRect(0, 58, 64, 6);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: railTex, roughness: 0.7, metalness: 0.2 }), rail);
  inst(new THREE.CylinderGeometry(0.55, 0.6, 1.15, 7, 1).translate(0, 0.575, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), tanks, tankC);

  // ---- 7. street surfaces and the ground
  const streetGeo = { asph: [] as THREE.BufferGeometry[], pav: [] as THREE.BufferGeometry[] };
  const kerbs: Town['kerbs'] = [];
  const isPaver = (x: number, z: number) => o.paverNear.some((p) => Math.hypot(x - p.x, z - p.z) < p.r);
  const ribbon = (pts: XZ[], w: number, y: number) => {
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let k = 1;
      if (i > 0 && i < pts.length - 1) {
        const ax = p[0] - a[0], az = p[1] - a[1], al = Math.hypot(ax, az) || 1;
        k = Math.min(2.2, 1 / Math.max(0.45, (ax / al) * dx + (az / al) * dz));
      }
      const nx = -dz * w / 2 * k, nz = dx * w / 2 * k;
      pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
      if (i) { const j = i * 2; idx.push(j - 2, j - 1, j, j, j - 1, j + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    // world-space UVs (metres), normals up; make the winding face up
    const uv: number[] = [], nrm: number[] = [];
    for (let i = 0; i < pos.length; i += 3) { uv.push(pos[i], pos[i + 2]); nrm.push(0, 1, 0); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const ia = g.index!.array as unknown as number[];
    for (let t = 0; t < ia.length; t += 3) {
      const [i0, i1, i2] = [ia[t], ia[t + 1], ia[t + 2]];
      const ax = pos[i1 * 3] - pos[i0 * 3], az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2], bx = pos[i2 * 3] - pos[i0 * 3], bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
      if (az * bx - ax * bz < 0) { const tmp = ia[t + 1]; ia[t + 1] = ia[t + 2]; ia[t + 2] = tmp; }
    }
    return g.toNonIndexed();
  };
  const RANK: Record<string, number> = { trunk: 9, primary: 8, secondary: 7, tertiary: 6, unclassified: 5, residential: 4, living_street: 4, pedestrian: 5, service: 2 };
  for (const rd of roads) {
    if (isWalk(rd.hw)) continue;
    // split each street into runs that are paved alike
    let run: XZ[] = [], paver = false;
    const flush = () => {
      if (run.length > 1) (paver ? streetGeo.pav : streetGeo.asph).push(ribbon(run, rd.w, 0.012 + (RANK[rd.hw] ?? 3) * 0.003));
      run = [];
    };
    for (let i = 0; i < rd.q.length; i++) {
      const p = rd.q[i], pv = rd.hw === 'pedestrian' || isPaver(p[0], p[1]);
      if (i && pv !== paver) { const last = run[run.length - 1]; flush(); run.push(last); }
      paver = pv;
      run.push(p);
    }
    flush();
    // kerb points for street life: every ~6 m along the streets near the temple
    for (let i = 1; i < rd.q.length; i++) {
      const [ax, az] = rd.q[i - 1], [bx, bz] = rd.q[i];
      const L = Math.hypot(bx - ax, bz - az);
      for (let t = 3; t < L; t += 6) {
        const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L;
        if (Math.hypot(x - D.x, z - D.z) < D.r) kerbs.push({ x, z, dx: (bx - ax) / L, dz: (bz - az) / L, hw: rd.w / 2 });
      }
    }
  }
  for (const ex of o.extraRoads ?? []) (ex.paver ? streetGeo.pav : streetGeo.asph).push(ribbon(ex.p, ex.w, 0.04));
  const merge = (gs: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (!gs.length) return;
    const m = new THREE.Mesh(mergeGeometries(gs)!, mat);
    m.receiveShadow = true;
    group.add(m);
  };
  merge(streetGeo.asph, o.materials.asphalt);
  merge(streetGeo.pav, o.materials.paver);
  {
    const H = o.half;
    const sh = new THREE.Shape([new THREE.Vector2(-H, -H), new THREE.Vector2(H, -H), new THREE.Vector2(H, H), new THREE.Vector2(-H, H)]);
    // (ShapeGeometry's y becomes -z after rotateX(-90°): build the shape in (x, -z))
    const hole = (ring: XZ[]) => new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    // (water inside a ground hole — a tank in the precinct — is the site's own business)
    for (const w of waters) if (!(o.groundHoles ?? []).some((k) => w.every(([x, z]) => pointInRing(x, z, k)))) sh.holes.push(hole(w));
    for (const gh of o.groundHoles ?? []) sh.holes.push(hole(gh));
    const gg = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
    const uv = gg.attributes.uv, p = gg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
    const ground = new THREE.Mesh(gg, o.materials.ground);
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    group.add(ground);
  }

  // ---- 8. street level near the temple: awnings, sign boards, stalls
  {
    const names = o.shopNames ?? DEFAULT_SHOPS;
    const atlas = signAtlas(names, r);
    const boardPos: number[] = [], boardUV: number[] = [], boardN: number[] = [];
    const awn: THREE.Matrix4[] = [], awnC: THREE.Color[] = [], stalls: THREE.Matrix4[] = [];
    const AW = [0x2a5aa0, 0xd06a20, 0x2a7a4a, 0xb02a2a, 0xd8b030, 0x6a6a6a, 0xe8e0d0, 0x8a2a6a, 0x1a8a8a];
    for (const s of shops) {
      const ry = Math.atan2(s.nx, s.nz);
      q.setFromAxisAngle(Y, ry);
      const tx = s.nz, tz = -s.nx; // along the wall
      const w = Math.min(s.len * 0.9, 7);
      // a sloping cloth / tin awning over the shop
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.32);
      awn.push(new THREE.Matrix4().compose(T.set(s.x + s.nx * 0.85, 2.72, s.z + s.nz * 0.85), q.clone().multiply(tilt), S.set(w, 0.04, 1.7)));
      awnC.push(new THREE.Color(AW[Math.floor(r() * AW.length)]));
      // the board above it, flat on the wall
      const k = Math.floor(r() * 32), u0 = (k % 4) / 4, v0 = 1 - (Math.floor(k / 4) + 1) / 8;
      const bw = Math.min(w, 4.2), bh = 0.68, y0 = 2.98, off = 0.06;
      const cx = s.x + s.nx * off, cz = s.z + s.nz * off;
      const c0: XZ = [cx - tx * bw / 2, cz - tz * bw / 2], c1: XZ = [cx + tx * bw / 2, cz + tz * bw / 2];
      // seen from outside, the board's left is c1 (the wall runs a->b with the outside on the right)
      const quadP = [c1[0], y0, c1[1], c0[0], y0, c0[1], c0[0], y0 + bh, c0[1], c1[0], y0, c1[1], c0[0], y0 + bh, c0[1], c1[0], y0 + bh, c1[1]];
      const quadUV = [u0, v0, u0 + 0.25, v0, u0 + 0.25, v0 + 0.125, u0, v0, u0 + 0.25, v0 + 0.125, u0, v0 + 0.125];
      // fix the winding so the board faces the street
      const e1x = quadP[3] - quadP[0], e1z = quadP[5] - quadP[2], e2y = quadP[7] - quadP[1];
      const fz = e1x * e2y, fx = -e1z * e2y; // (e1 x e2) for e2 straight up
      if (fx * s.nx + fz * s.nz < 0) {
        // mirror: swap c0/c1
        quadP.splice(0, 18, c0[0], y0, c0[1], c1[0], y0, c1[1], c1[0], y0 + bh, c1[1], c0[0], y0, c0[1], c1[0], y0 + bh, c1[1], c0[0], y0 + bh, c0[1]);
      }
      boardPos.push(...quadP); boardUV.push(...quadUV);
      for (let i = 0; i < 6; i++) boardN.push(s.nx, 0, s.nz);
      if (r() < 0.42 && s.dist < D.r * 0.8) {
        stalls.push(new THREE.Matrix4().compose(T.set(s.x + s.nx * 0.95 + tx * (r() - 0.5) * Math.max(0, w - 2.4), 0, s.z + s.nz * 0.95 + tz * (r() - 0.5) * Math.max(0, w - 2.4)), q, S.setScalar(1)));
      }
    }
    if (boardPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(boardPos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(boardUV, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(boardN, 3));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.08 }));
      m.receiveShadow = true;
      group.add(m);
    }
    const aw = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), awn, awnC, true);
    if (aw) aw.castShadow = true;
    inst(stallGeo(r), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), stalls, undefined, false);
  }

  // ---- 9. trees in the block cores and at the water's edge
  const treeSpots: [number, number, number][] = [];
  for (const [e, n] of data.trees) { const [x, z] = P([e, n]); if (grid.get(x, z) === FREE) treeSpots.push([x, z, 8 + r() * 5]); }
  for (let k = 0; k < 4000 && treeSpots.length < 16; k++) {
    const x = (r() - 0.5) * 2 * Math.min(o.maxR, o.half - 20), z = (r() - 0.5) * 2 * Math.min(o.maxR, o.half - 20);
    if (grid.get(x, z) !== FREE || dist0(x, z) < 70) continue;
    // a free cell surrounded by houses (a courtyard) or beside water
    let houseN = 0, water = 0;
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) { const v = grid.get(x + dx, z + dz); if (v === HOUSE) houseN++; if (v === WATER) water++; }
    if (houseN >= 2 || water >= 1) { treeSpots.push([x, z, 8 + r() * 6]); grid.fillSeg(x, z, x, z, 3, HOUSE); }
  }

  let tris = 0;
  group.traverse((m) => {
    const g = (m as THREE.Mesh).geometry;
    if (!g) return;
    const c = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += c * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
  });
  return { group, waters, shops, kerbs, treeSpots, houses: houses.map((h) => ({ ring: h.ring, h: h.h })), stats: { real: realN, synth: synthN, tris } };
}

// ------------------------------------------------------------------ parked vehicles and overhead wires

/**
 * Street life along the kerbs near the temple: parked motorcycles and e-rickshaws (instanced), electric
 * poles with sagging overhead wires (one LineSegments). Kerb points closer than `clear` to a walk path
 * get nothing.
 */
export function streetLife(group: THREE.Group, kerbs: Town['kerbs'], seed: number, keepClear: (x: number, z: number) => boolean) {
  const r = rng(seed);
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(1, 1, 1), T = new THREE.Vector3();
  const bikes: THREE.Matrix4[] = [], bikeC: THREE.Color[] = [], ricks: THREE.Matrix4[] = [], rickC: THREE.Color[] = [];
  const poles: THREE.Matrix4[] = [], wire: number[] = [];
  const BIKE = [0x101010, 0xb01818, 0x1a3a8a, 0xe8e8e8, 0x6a6a70, 0x101010, 0x2a2a2a, 0x8a1010];
  const RICK = [0x2a8a4a, 0x1a6ab0, 0xe8e4d8, 0xe0b020, 0x2a8a4a];
  const poleTops: [number, number, number][] = [];
  let lastPole: [number, number] | null = null;
  for (const k of kerbs) {
    const side = r() < 0.5 ? 1 : -1;
    const ox = -k.dz * side, oz = k.dx * side;
    const ex = k.x + ox * (k.hw - 0.6), ez = k.z + oz * (k.hw - 0.6);
    if (keepClear(ex, ez)) continue;
    const ang = Math.atan2(-k.dz, k.dx);
    const roll = r();
    if (k.hw >= 2.2 && roll < 0.4) {
      // a row of 1-3 motorcycles parked nose-in to the kerb
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        q.setFromAxisAngle(Y, ang + Math.PI / 2 * side + (r() - 0.5) * 0.3);
        bikes.push(new THREE.Matrix4().compose(T.set(ex + k.dx * (i - n / 2) * 0.85 - ox * 0.2, 0, ez + k.dz * (i - n / 2) * 0.85 - oz * 0.2), q, S));
        bikeC.push(new THREE.Color(BIKE[Math.floor(r() * BIKE.length)]));
      }
    } else if (k.hw >= 3 && roll < 0.58) {
      q.setFromAxisAngle(Y, ang + (r() < 0.5 ? 0 : Math.PI));
      ricks.push(new THREE.Matrix4().compose(T.set(ex - ox * 0.4, 0, ez - oz * 0.4), q, S));
      rickC.push(new THREE.Color(RICK[Math.floor(r() * RICK.length)]));
    }
    // an electric pole every ~25 m on one side, wired to the last
    if (!lastPole || Math.hypot(k.x - lastPole[0], k.z - lastPole[1]) > 24) {
      const px = k.x + ox * (k.hw + 0.3), pz = k.z + oz * (k.hw + 0.3);
      if (!keepClear(px, pz)) {
        poles.push(new THREE.Matrix4().makeTranslation(px, 0, pz));
        if (lastPole && Math.hypot(px - lastPole[0], pz - lastPole[1]) < 40) {
          const [lx, lz] = lastPole;
          for (const [dy, off] of [[7.6, 0.4], [7.6, -0.4], [7.0, 0], [6.2, 0.2]]) {
            const a = new THREE.Vector3(lx - k.dz * off, dy, lz + k.dx * off), b = new THREE.Vector3(px - k.dz * off, dy, pz + k.dx * off);
            const L = a.distanceTo(b), sag = 0.25 + L * 0.018;
            let prev = a;
            for (let s = 1; s <= 8; s++) {
              const t = s / 8, p = a.clone().lerp(b, t);
              p.y -= sag * 4 * t * (1 - t);
              wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
              prev = p;
            }
          }
          // a service cable dropping to a house
          if (r() < 0.5) wire.push(px, 7.0, pz, px - ox * (k.hw + 2.5), 5.5, pz - oz * (k.hw + 2.5));
        }
        lastPole = [px, pz];
        poleTops.push([px, 8, pz]);
      }
    }
  }
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cs?: THREE.Color[]) => {
    if (!ms.length) return;
    const im = new THREE.InstancedMesh(geo, mat, ms.length);
    ms.forEach((m, i) => { im.setMatrixAt(i, m); if (cs) im.setColorAt(i, cs[i]); });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  };
  add(twoWheelerGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }), bikes, bikeC);
  add(eRickshawGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }), ricks, rickC);
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.13, 8, 6).translate(0, 4, 0),
    new THREE.BoxGeometry(1.3, 0.08, 0.08).translate(0, 7.6, 0),
    new THREE.BoxGeometry(0.9, 0.08, 0.08).translate(0, 7.0, 0),
  ].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }))!;
  add(poleGeo, new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.8 }), poles);
  if (wire.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1816 })));
  }
  return { bikes: bikes.length, rickshaws: ricks.length, poles: poles.length };
}

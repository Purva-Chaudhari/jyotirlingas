import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Narmada passenger boats (c17, c32, c05): long wooden hulls with a curving sheer that rises to a pointed,
 * raked bow and a lower transom stern, planked sides painted in faded bands, thwart-benches inside, and a
 * cloth canopy on four thin poles - a sagging roof with a scalloped valance all round.
 * One boat is built at true size (L 7.6 m, beam 1.8 m) and instanced:
 *  - paint: the outer hull (instance colour = the boat's paint), planks and a contrasting band in the map;
 *  - wood: the gunwale cap, the inner skin, the floor boards and benches (instance colour = wood tone);
 *  - canopy: roof + valance (instance colour = cloth), and the poles merged in as a grey-brown frame.
 */

export const BOAT = { L: 7.6, W: 1.8 };

/** half-beam and sheer height at t ∈ [0 stern, 1 bow] */
function section(t: number) {
  const L = BOAT.L, W = BOAT.W;
  // full beam amidships, a fine entry at the bow, a broad transom at the stern
  const hb = (W / 2) * (t < 0.5 ? 0.62 + 0.38 * Math.sin((t / 0.5) * Math.PI / 2) : Math.cos(((t - 0.5) / 0.5) * Math.PI / 2) ** 0.8);
  const sheer = 0.62 + 0.08 * (1 - t) + 0.55 * Math.pow(Math.max(0, t - 0.6) / 0.4, 2.2);
  const keel = 0.0 + 0.12 * Math.pow(Math.max(0, t - 0.75) / 0.25, 2);
  return { x: (t - 0.5) * L, hb, sheer, keel };
}

function planks() {
  // u = along the hull, v = keel (0) to gunwale (1): planks with dark seams, a paler band near the top,
  // a dark boot-top near the waterline, weathering and scuffs
  const W = 512, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, W, H);
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 300; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? 255 : 120},${r() < 0.5 ? 250 : 110},${r() < 0.5 ? 240 : 100},${0.05 + r() * 0.1})`;
    g.fillRect(r() * W, r() * H, 10 + r() * 60, 1 + r() * 3);
  }
  for (let y = 0; y < H; y += 16) { g.fillStyle = 'rgba(30,25,20,0.55)'; g.fillRect(0, y, W, 2); }
  // a contrasting stripe (white, read through the paint colour as a paler band) and a dark boot-top
  g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.1, W, H * 0.09);
  g.fillStyle = 'rgba(40,36,30,0.9)'; g.fillRect(0, H * 0.82, W, H * 0.18);
  // a painted name panel near the bow
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(W * 0.72, H * 0.24, W * 0.12, H * 0.22);
  g.fillStyle = 'rgba(180,20,20,0.8)';
  for (let i = 0; i < 6; i++) g.fillRect(W * 0.73 + i * 9, H * 0.28, 6, H * 0.14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function skin(inset: number, flip: boolean) {
  const NU = 40, NV = 8;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const side of [-1, 1]) {
    const o = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const t = i / NU, sct = section(t);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        // round-bilged section: from the keel line out and up to the sheer
        const a = v * Math.PI / 2;
        const hb = Math.max(0.001, sct.hb - inset);
        const y = sct.keel + (sct.sheer - sct.keel) * (1 - Math.cos(a) * 0.95) - (j === 0 ? 0 : 0);
        const z = side * hb * Math.pow(Math.sin(a), 0.6);
        pos.push(sct.x, y + (inset ? 0.04 : 0), z);
        uv.push(t, 1 - v);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = o + i * (NV + 1) + j, b = a + NV + 1;
      const f = (side > 0) !== flip;
      if (f) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function boatGeometries() {
  const hull = skin(0, false);
  // transom: a flat board closing the stern
  const s0 = section(0);
  const tr = new THREE.PlaneGeometry(s0.hb * 2, s0.sheer - s0.keel).rotateY(-Math.PI / 2).translate(s0.x - 0.002, (s0.sheer + s0.keel) / 2, 0);
  const paint = mergeGeometries([hull, tr])!;
  // wood: inner skin, gunwale cap rails, floor boards, three benches, a stem post at the bow
  const parts: THREE.BufferGeometry[] = [skin(0.05, true)];
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) { const sc = section(i / 30); pts.push(new THREE.Vector3(sc.x, sc.sheer + 0.02, side * Math.max(0.01, sc.hb - 0.02))); }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 5));
  }
  parts.push(new THREE.BoxGeometry(BOAT.L * 0.8, 0.04, BOAT.W * 0.62).translate(-0.3, 0.22, 0));
  for (const x of [-2.2, -0.6, 1.0]) parts.push(new THREE.BoxGeometry(0.28, 0.05, BOAT.W * 0.86).translate(x, 0.5, 0));
  const bow = section(1);
  parts.push(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6).rotateZ(-0.5).translate(bow.x - 0.05, bow.sheer, 0));
  const wood = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }))!;
  wood.computeVertexNormals();
  return { paint, wood, plankMap: planks() };
}

/**
 * A cloth roof w × d (centred, at y = 0) that sags between its four corner poles, with a scalloped valance
 * strip `val` m deep all round, slightly flared. Unit size for instancing: w = d = 1 in x/z, val in metres
 * stays proportional; build at the size you need instead when the valance depth matters.
 */
export function canopyGeometry(w: number, d: number, sag: number, val: number, wrinkle = 1) {
  const NX = 12, NZ = 16;
  const roof = new THREE.PlaneGeometry(w, d, NX, NZ).rotateX(-Math.PI / 2);
  const p = roof.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2);
    // sag between the poles, a ridge along the middle, small wrinkles towards the edges
    const y = -sag * (1 - x * x) * (1 - z * z) * 0.6 - sag * 0.4 * (1 - z * z) * Math.abs(x) + 0.06 * (1 - Math.abs(x))
      + wrinkle * 0.012 * Math.sin(z * 9 + x * 3) * Math.abs(x);
    p.setY(i, y);
  }
  roof.computeVertexNormals();
  { const uv = roof.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); }
  const parts: THREE.BufferGeometry[] = [roof.toNonIndexed()];
  // valance: a strip along each edge with a scalloped hem
  const strip = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(8, Math.round(Math.hypot(bx - ax, bz - az) / 0.12));
    const pos: number[] = [], uvs: number[] = [];
    const nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const P = (t: number, down: number) => {
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const flare = down * 0.15;
        return [x - (nx / nl) * flare * 0.0 + (x / (w / 2)) * flare * 0.1, -down, z + (z / (d / 2)) * flare * 0.1];
      };
      const scal = (t: number) => val * (0.82 + 0.18 * Math.cos(t * n * Math.PI)); // a pinked / scalloped hem
      const a = P(t0, 0), b = P(t1, 0), c = P(t1, scal(t1)), e = P(t0, scal(t0));
      pos.push(...a, ...b, ...c, ...a, ...c, ...e);
      const L = Math.hypot(bx - ax, bz - az);
      uvs.push(t0 * L, 0, t1 * L, 0, t1 * L, -0.2, t0 * L, 0, t1 * L, -0.2, t0 * L, -0.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  };
  const hw = w / 2, hd = d / 2, yEdge = 0;
  for (const g of [strip(-hw, -hd, hw, -hd), strip(hw, -hd, hw, hd), strip(hw, hd, -hw, hd), strip(-hw, hd, -hw, -hd)]) {
    g.translate(0, yEdge, 0);
    parts.push(g);
  }
  const out = mergeGeometries(parts.map((q) => { for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') q.deleteAttribute(k); return q; }))!;
  return out;
}

/**
 * Faded tarpaulin / cloth: a fine weave, sun-bleached streaks, darker stains and stitched seams every ~0.9 m
 * (greyscale, tinted per instance). UV in metres.
 */
export function clothTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e4e4e4';
  g.fillRect(0, 0, N, N);
  let s = 17;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.03})`; g.fillRect(0, y, N, 1); }
  for (let x = 0; x < N; x += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.03})`; g.fillRect(x, 0, 1, N); }
  for (let k = 0; k < 40; k++) {
    g.fillStyle = r() < 0.6 ? `rgba(255,255,255,${0.06 + r() * 0.1})` : `rgba(60,50,40,${0.05 + r() * 0.08})`;
    g.beginPath(); g.ellipse(r() * N, r() * N, 10 + r() * 50, 4 + r() * 16, r() * 3, 0, Math.PI * 2); g.fill();
  }
  // seams (the texture tiles every 1.8 m: two panels)
  g.fillStyle = 'rgba(40,35,30,0.35)';
  g.fillRect(0, 0, N, 3); g.fillRect(0, N / 2, N, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.8, 1 / 1.8);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** four thin poles from the gunwale (y0) to the canopy (y1) at (±px, ±pz), as one geometry */
export function polesGeometry(px: number, pz: number, y0: number, y1: number, r = 0.025) {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.CylinderGeometry(r, r, y1 - y0, 5).translate(sx * px, (y0 + y1) / 2, sz * pz));
  return mergeGeometries(parts.map((q) => { q.deleteAttribute('uv'); return q.toNonIndexed(); }))!;
}

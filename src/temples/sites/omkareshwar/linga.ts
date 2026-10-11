import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The Jyotirlinga, its brass naga and the engraved slate behind it, after the temple trust's darshan and
 * abhishek photographs (omkareshwar.org "Tiles_darshan", "Tiles_abhishek"):
 *  - the stone: a rough, conical, dark grey-black natural rock (~0.45 m across, ~0.32 m high), matte to
 *    satin where wet, with broad yellow chandan smears and a dab of kumkum;
 *  - its crown: a mound of stacked white mogra / jasmine garlands with one red rose on top;
 *  - the naga: a slender brass cobra rising from behind the stone to ~1 m, its broad cupped hood
 *    arching forward over the stone, ribbed beneath and scaled on the back;
 *  - the back wall: dark slate with an engraved ॐ and lotuses.
 */

let sd = 3;
const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

function n3(x: number, y: number, z: number) {
  return Math.sin(x * 3.1 + 1.3) * Math.sin(y * 2.7 + 0.4) * Math.sin(z * 3.3 + 2.1) * 0.5
    + Math.sin(x * 7.3 + z * 2.1) * Math.sin(y * 6.1 + 1.7) * 0.25
    + Math.sin(x * 13.7 + y * 4.3 + z * 11.1) * 0.08;
}

export interface StoneOpts {
  /** half-widths and height (m) */
  rx: number; rz: number; h: number;
  /** narrowing towards the top (0 = dome, 0.5 = cone-ish) */
  taper: number;
  base: number; light: number;
  /** yellow chandan smears */
  smears: number;
  seed: number;
  /** icosahedron subdivision (20·(d+1)² triangles) */
  detail?: number;
}

/** A rough natural stone, origin at its foot, with vertex colours (mottling + chandan smears + kumkum). */
export function stoneGeometry(o: StoneOpts) {
  const g = new THREE.IcosahedronGeometry(1, o.detail ?? 40);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-5);
  const p = m.attributes.position;
  const v = new THREE.Vector3();
  const s = o.seed;
  const raw: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d1 = n3(v.x * 1.3 + s, v.y * 1.3, v.z * 1.3), d2 = n3(v.x * 2.9, v.y * 2.9 + s, v.z * 2.9);
    const d3 = n3(v.x * 6.1 + s, v.y * 6.1, v.z * 6.1), d4 = n3(v.x * 13 + s, v.y * 13, v.z * 13);
    const k = 1 + 0.2 * d1 + 0.11 * d2 + 0.05 * d3 + 0.02 * d4;
    v.multiplyScalar(k);
    // a rough cone: the upper half narrows
    const t = Math.max(0, (v.y + 0.2) / 1.2);
    const w = 1 - o.taper * t * t;
    v.set(v.x * o.rx * w, (v.y * 0.5 + 0.5) * o.h, v.z * o.rz * w);
    if (v.y < 0.03) v.y = 0.03 * Math.pow(Math.max(0, v.y) / 0.03, 2) - 0.03; // flat foot sunk in the trough
    p.setXYZ(i, v.x, v.y, v.z);
    raw.push(v.clone());
  }
  // smear centres on the sides, above the cloth ring, below the flower crown
  const smears: { c: THREE.Vector3; a: number; sx: number; sy: number }[] = [];
  for (let k = 0; k < o.smears; k++) {
    const a = (k / o.smears) * Math.PI * 2 + rnd() * 0.9 - 0.4 + Math.PI; // the first faces the door (-x)
    const y = o.h * (0.42 + rnd() * 0.2);
    // snap the centre to the stone's real surface in that direction and at that height
    let best = raw[0], bd = Infinity;
    for (const q of raw) {
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(q.z, q.x) - a), Math.cos(Math.atan2(q.z, q.x) - a)));
      const dd = da * 0.2 + Math.abs(q.y - y);
      if (dd < bd) { bd = dd; best = q; }
    }
    smears.push({ c: best.clone(), a, sx: 0.07 + rnd() * 0.035, sy: 0.035 + rnd() * 0.02 });
  }
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(), base = new THREE.Color(o.base), light = new THREE.Color(o.light);
  const chandan = new THREE.Color(0xf8d23c), chandan2 = new THREE.Color(0xf0c02a), kumkum = new THREE.Color(0xa8101c);
  for (let i = 0; i < p.count; i++) {
    const q = raw[i];
    const t = n3(q.x * 40 + s, q.y * 40, q.z * 40) * 0.5 + 0.5, t2 = n3(q.x * 90, q.y * 90 + s, q.z * 90) * 0.5 + 0.5;
    c.copy(base).lerp(light, Math.max(0, t - 0.45) * 1.2).multiplyScalar(0.8 + 0.35 * t2);
    for (const sm of smears) {
      // distance in the smear's own frame: wide along the surface, short vertically; noise-ragged edge
      const dx = Math.hypot(q.x - sm.c.x, q.z - sm.c.z), dy = q.y - sm.c.y;
      const r = Math.hypot(dx / sm.sx, dy / sm.sy) + 0.45 * n3(q.x * 60 + sm.a, q.y * 60, q.z * 60) + 0.25 * n3(q.x * 150, q.y * 150, q.z * 150 + sm.a);
      // a paste smear is thick in streaks, thin at the edge where the stone shows through
      const cover = (1 - THREE.MathUtils.smoothstep(r, 0.65, 1.0)) * (0.8 + 0.2 * Math.sin(dy * 300 + dx * 40));
      if (cover > 0) c.lerp(chandan2.clone().lerp(chandan, t2), Math.min(1, cover));
    }
    // one dab of kumkum on the front smear
    const f = smears[0];
    if (f && Math.hypot(q.x - f.c.x, q.y - f.c.y - 0.01, q.z - f.c.z) < 0.011) c.copy(kumkum);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeVertexNormals();
  return m;
}

/** A small ruffled bead / flower head (no uv), radius r. */
export function bead(r: number, detail: number, amp: number, flatten: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), b = Math.atan2(v.y, Math.hypot(v.x, v.z));
    v.multiplyScalar(1 + amp * Math.sin(a * 7 + seed) * Math.sin(b * 5 + seed * 0.7));
    v.y *= flatten;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * A rose, ~7 cm across: 20 cupped petals in a spiral, the inner ones closed round the bud, the outer ones
 * opening out. Origin at its base.
 */
export function roseGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const NU = 6, NV = 5;
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const a = i * 2.39996;
    const ring = 0.004 + 0.02 * t; // distance of the petal's foot from the centre
    const len = 0.018 + 0.016 * t, wid = 0.012 + 0.012 * t;
    const tilt = 0.15 + 1.05 * t * t; // outward lean
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tan = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const pos: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NV; j++) for (let k = 0; k <= NU; k++) {
      const u = (k / NU) * 2 - 1, v = j / NV;
      const w = wid * Math.sin(Math.PI * (0.15 + 0.75 * v)) * u;
      const lean = tilt * (0.6 + 0.6 * v); // the petal curls back towards its edge
      const p = out.clone().multiplyScalar(ring + Math.sin(lean) * v * len - 0.35 * wid * u * u)
        .addScaledVector(tan, w).add(new THREE.Vector3(0, Math.cos(lean) * v * len + 0.004, 0));
      pos.push(p.x, p.y, p.z);
    }
    for (let j = 0; j < NV; j++) for (let k = 0; k < NU; k++) {
      const q = j * (NU + 1) + k;
      idx.push(q, q + NU + 1, q + 1, q + 1, q + NU + 1, q + NU + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    parts.push(geo.toNonIndexed());
  }
  const out = mergeGeoms(parts);
  out.computeVertexNormals();
  return out;
}

function mergeGeoms(list: THREE.BufferGeometry[]) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array as Float32Array, o); o += g.attributes.position.count * 3; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return out;
}

/**
 * Flower crown: garlands wound in a helix round a cone (white mogra beads, a few cream and pale-green
 * buds, one strand of yellow), ~0.18 m high. Returns bead positions + colours for an InstancedMesh.
 */
export function crownBeads(cx: number, y0: number, cz: number, R: number, H: number) {
  const out: { p: THREE.Vector3; c: number; s: number }[] = [];
  const turns = Math.round(H * 52), n = Math.round(H * 3000);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    const y = y0 + t * H;
    const r = R * Math.pow(1 - t, 0.8) + 0.012;
    // each garland is a rope 2-3 beads thick: jitter round the helix
    const j = (k: number) => (rnd() - 0.5) * k;
    for (const off of [0, 1]) {
      if (off && rnd() < 0.4) continue;
      const rr = r + off * 0.012 + j(0.008);
      const strand = Math.floor(t * turns) % 4;
      const pick = rnd();
      const c = strand === 2 && pick < 0.7 ? 0xf0d878 : pick < 0.78 ? 0xf2efe6 : pick < 0.9 ? 0xe6e0c4 : 0xc8d4a0;
      out.push({ p: new THREE.Vector3(cx + Math.cos(a) * rr + j(0.006), y + off * 0.006 + j(0.006), cz + Math.sin(a) * rr + j(0.006)), c, s: 0.85 + rnd() * 0.35 });
    }
  }
  return out;
}

/** Brass scales (dorsal) or belly ribs (ventral) for the naga, as a greyscale height canvas. */
function scaleCanvas(ribs: boolean) {
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, N, N);
  if (ribs) {
    for (let y = 0; y < N; y += 16) {
      const gr = g.createLinearGradient(0, y, 0, y + 16);
      gr.addColorStop(0, '#fafafa'); gr.addColorStop(0.75, '#b0b0b0'); gr.addColorStop(1, '#404040');
      g.fillStyle = gr;
      g.fillRect(0, y, N, 16);
    }
  } else {
    for (let r = 0; r < 9; r++) for (let k = -1; k < 9; k++) {
      const x = k * 16 + (r % 2) * 8, y = r * 16;
      const gr = g.createRadialGradient(x + 8, y + 2, 1, x + 8, y + 4, 11);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#c8c8c8'); gr.addColorStop(1, '#505050');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x + 8, y + 4, 8.5, 10, 0, 0, Math.PI); g.fill();
    }
  }
  return c;
}

/** normal map from a greyscale height canvas */
export function heightToNormal(c: HTMLCanvasElement, strength: number, wrap = true) {
  const W = c.width, H = c.height;
  const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  const h = (x: number, y: number) => d[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  const o = document.createElement('canvas');
  o.width = W; o.height = H;
  const og = o.getContext('2d')!, img = og.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(o);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function brassMaterial(env: THREE.Texture, ribs: boolean) {
  const nrm = heightToNormal(scaleCanvas(ribs), ribs ? 3 : 4);
  return new THREE.MeshStandardMaterial({
    color: 0xa07e44, metalness: 0.9, roughness: 0.38, normalMap: nrm, normalScale: new THREE.Vector2(ribs ? 0.8 : 0.22, ribs ? 0.8 : 0.22),
    envMap: env, envMapIntensity: 0.75, emissive: 0x1e150a, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  });
}

/**
 * The brass naga, origin at the stone's foot, facing -x (the door). A slender body (≈7 cm thick) coiled
 * in the trough behind the stone rises at the back right to ≈0.95 m, then the broad (≈0.36 m) cupped hood
 * leans forward so its crown stands over the stone's top. UVs in metres-ish (u round, v along) for the scales.
 */
export function nagaGeometry() {
  const pts: THREE.Vector3[] = [];
  // a partial coil in the trough channel, behind the stone
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI * 0.35 + (i / 8) * Math.PI * 0.75;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.37, -0.02 + i * 0.002, Math.sin(a) * 0.37));
  }
  pts.push(
    new THREE.Vector3(0.31, 0.12, 0.25), new THREE.Vector3(0.32, 0.32, 0.22), new THREE.Vector3(0.3, 0.52, 0.17),
    new THREE.Vector3(0.28, 0.66, 0.1), new THREE.Vector3(0.25, 0.75, 0.04), new THREE.Vector3(0.22, 0.8, 0.01),
  );
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const TS = 120, RS = 14;
  const body = new THREE.TubeGeometry(curve, TS, 1, RS);
  const bp = body.attributes.position;
  const len = curve.getLength();
  for (let i = 0; i < bp.count; i++) {
    const t = Math.floor(i / (RS + 1)) / TS;
    const c = curve.getPointAt(t);
    const k = 0.024 + 0.01 * Math.min(1, t * 1.6) + 0.014 * Math.max(0, (t - 0.88) / 0.12);
    bp.setXYZ(i, c.x + (bp.getX(i) - c.x) * k, c.y + (bp.getY(i) - c.y) * k, c.z + (bp.getZ(i) - c.z) * k);
  }
  const buv = body.attributes.uv;
  for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getY(i) * 3, buv.getX(i) * len / 0.035);
  body.computeVertexNormals();

  // the hood: from the neck N it runs up and forward along d; its face (ventral side) looks along f
  const N = new THREE.Vector3(0.21, 0.78, 0.0);
  const lean = 0.78; // rad from vertical, forward
  const d = new THREE.Vector3(-Math.sin(lean), Math.cos(lean), 0);
  const f = new THREE.Vector3(-Math.cos(lean), -Math.sin(lean), 0); // the hood's face: forward and down
  const side = new THREE.Vector3(0, 0, 1);
  const HL = 0.4, NU = 28, NV = 30;
  const surf = (offset: number) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = (i / NU) * 2 - 1, v = j / NV;
      // spade outline: narrow neck, widest ~60 % up, rounded crown
      const e = (v - 0.5) / 0.5, w = 0.03 + 0.155 * Math.pow(Math.max(0, 1 - e * e), 0.6);
      const x = u * w;
      // deeply cupped: the edges curl towards the face (a C in section); the hood bows back along its length
      const cup = 0.42 * (x * x) / Math.max(w, 0.05);
      const bow = -0.05 * Math.sin(Math.PI * v) + 0.06 * Math.pow(Math.max(0, v - 0.7) / 0.3, 2); // the crown curls forward
      const p = N.clone().addScaledVector(d, v * HL).addScaledVector(side, x).addScaledVector(f, cup + bow + offset);
      pos.push(p.x, p.y, p.z);
      uv.push(u * 1.6, v * 4);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1;
      if (offset > 0) idx.push(a, b, c, b, e, c); else idx.push(a, c, b, b, c, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const hoodFace = surf(0.008); // ribbed, towards the stone and the door
  const hoodBack = surf(-0.004); // scaled
  // the head at the crown, bowed forward over the stone
  const top = N.clone().addScaledVector(d, HL * 0.97).addScaledVector(f, 0.03);
  const head = new THREE.SphereGeometry(0.04, 18, 12).scale(1.0, 0.55, 0.8);
  head.rotateZ(-lean - 0.5);
  head.translate(top.x - 0.03, top.y - 0.005, top.z);
  const huv = head.attributes.uv;
  for (let i = 0; i < huv.count; i++) huv.setXY(i, huv.getX(i) * 4, huv.getY(i) * 2);
  head.computeVertexNormals();
  return { body, hoodFace, hoodBack, head };
}

/** Dark slate back wall with an engraved ॐ over the stone and a lotus each side. W×H metres. */
export function slateWall(W: number, H: number, omU: number) {
  const PX = 320; // px per metre
  const cw = Math.round(W * PX), ch = Math.round(H * PX);
  const hc = document.createElement('canvas');
  hc.width = cw; hc.height = ch;
  const h = hc.getContext('2d')!;
  h.fillStyle = '#c8c8c8';
  h.fillRect(0, 0, cw, ch);
  const cc = document.createElement('canvas');
  cc.width = cw; cc.height = ch;
  const c = cc.getContext('2d')!;
  // slate: blue-grey, blotchy, with oil and soot streaks running down
  c.fillStyle = '#3a3d40';
  c.fillRect(0, 0, cw, ch);
  for (let k = 0; k < 500; k++) {
    const x = rnd() * cw, y = rnd() * ch, r = 10 + rnd() * 60;
    c.fillStyle = `rgba(${50 + rnd() * 30},${54 + rnd() * 30},${58 + rnd() * 30},${0.12 + rnd() * 0.18})`;
    c.beginPath(); c.ellipse(x, y, r, r * (0.4 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); c.fill();
  }
  for (let k = 0; k < 60; k++) {
    const x = rnd() * cw;
    const gr = c.createLinearGradient(0, ch * 0.3, 0, ch);
    gr.addColorStop(0, 'rgba(15,15,15,0)'); gr.addColorStop(1, `rgba(15,15,15,${0.2 + rnd() * 0.25})`);
    c.fillStyle = gr;
    c.fillRect(x, ch * 0.3, 3 + rnd() * 14, ch);
  }
  // panel joints
  h.strokeStyle = '#707070'; h.lineWidth = 3;
  c.strokeStyle = 'rgba(10,10,10,0.6)'; c.lineWidth = 3;
  for (let x = 0.6 * PX; x < cw; x += 1.2 * PX) { for (const g of [h, c]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); } }
  // engraving: the groove is low in the height map and pale (chalk / wear) in colour
  const engrave = (draw: (g: CanvasRenderingContext2D) => void) => {
    h.save(); h.strokeStyle = '#303030'; h.fillStyle = '#303030'; draw(h); h.restore();
    c.save(); c.strokeStyle = 'rgba(150,154,156,0.85)'; c.fillStyle = 'rgba(150,154,156,0.85)'; draw(c); c.restore();
  };
  // ॐ above the stone
  engrave((g) => {
    g.font = `${Math.round(0.62 * PX)}px "Kohinoor Devanagari", "Noto Sans Devanagari", serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5;
    g.strokeText('ॐ', omU * cw, ch * 0.36);
  });
  // lotus: a ring of pointed petals over a bowl of leaves, with a stem line
  const lotus = (x0: number, y0: number, s: number) => engrave((g) => {
    g.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.36;
      g.save(); g.translate(x0, y0); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-s * 0.22, -s * 0.35, -s * 0.12, -s * 0.75, 0, -s * (i === 0 ? 1.0 : 0.85));
      g.bezierCurveTo(s * 0.12, -s * 0.75, s * 0.22, -s * 0.35, 0, 0); g.stroke();
      g.restore();
    }
    g.beginPath(); g.ellipse(x0, y0 + s * 0.05, s * 0.75, s * 0.18, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.moveTo(x0 - s * 0.9, y0 + s * 0.3); g.quadraticCurveTo(x0, y0 + s * 0.5, x0 + s * 0.9, y0 + s * 0.3); g.stroke();
  });
  lotus((omU - 0.27) * cw, ch * 0.5, 0.42 * PX);
  lotus((omU + 0.27) * cw, ch * 0.5, 0.42 * PX);
  // a border line
  engrave((g) => { g.lineWidth = 4; g.strokeRect(8, 8, cw - 16, ch - 16); });
  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const normal = heightToNormal(hc, 2.5, false);
  normal.anisotropy = 8;
  return { map, normal };
}

/**
 * Embossed hood face: rows of scale rings, the spectacle mark, a border groove following the outline.
 * Returns a colour map (recesses dark) and the height canvas (for the normal map). UV: the hood's own
 * x ∈ [-0.18, 0.18] → u, y ∈ [0, 0.46] → v.
 */
function hoodCanvases() {
  const W = 360, H = 460; // 1 px per mm
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const col = mk(), hgt = mk();
  const cg = col.getContext('2d')!, hg = hgt.getContext('2d')!;
  cg.fillStyle = '#e2e2e2'; cg.fillRect(0, 0, W, H);
  hg.fillStyle = '#c0c0c0'; hg.fillRect(0, 0, W, H);
  const both = (f: (g: CanvasRenderingContext2D, dark: string) => void) => { f(cg, 'rgba(70,60,45,0.9)'); f(hg, '#404040'); };
  // canvas y grows down; hood v = 0 (neck) is at the bottom
  const Y = (v: number) => H - v * H;
  // scale rings: overlapping arcs in staggered rows
  both((g, dark) => {
    g.strokeStyle = dark; g.lineWidth = 3;
    for (let r = 0; r < 22; r++) for (let k = -1; k < 15; k++) {
      const x = k * 26 + (r % 2) * 13, y = Y(0.04) - r * 20;
      g.beginPath(); g.arc(x + 13, y, 13, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    }
  });
  // the eye-spots: two subtle raised rings (embossed in the height map, only faintly shaded in colour)
  hg.strokeStyle = '#f0f0f0'; hg.lineWidth = 10;
  cg.strokeStyle = 'rgba(90,70,40,0.22)'; cg.lineWidth = 3;
  for (const s of [-1, 1]) {
    for (const g of [hg, cg]) { g.beginPath(); g.ellipse(W / 2 + s * 58, Y(0.62), 40, 48, s * 0.12, 0, Math.PI * 2); g.stroke(); }
  }
  // a faint polish inside the rings
  cg.fillStyle = 'rgba(255,248,230,0.18)';
  for (const s of [-1, 1]) { cg.beginPath(); cg.ellipse(W / 2 + s * 58, Y(0.62), 30, 38, 0, 0, Math.PI * 2); cg.fill(); }
  // a groove along the outline (inset ~12 mm)
  both((g, dark) => {
    g.strokeStyle = dark; g.lineWidth = 6;
    g.save(); g.translate(W / 2, H); g.scale(1000 * 0.93, -1000 * 0.93); g.translate(0, 0.012); g.lineWidth = 6 / 930;
    hoodPath(g); g.stroke(); g.restore();
  });
  return { col, hgt };
}

/** spade outline of the hood in metres: neck at y = 0, crown at y = 0.46, half-width 0.175 */
function hoodPath(g: { moveTo(x: number, y: number): void; bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void; beginPath?(): void; closePath?(): void }) {
  g.beginPath?.();
  g.moveTo(0.045, 0);
  g.bezierCurveTo(0.1, 0.05, 0.185, 0.13, 0.178, 0.25);
  g.bezierCurveTo(0.172, 0.36, 0.1, 0.45, 0, 0.462);
  g.bezierCurveTo(-0.1, 0.45, -0.172, 0.36, -0.178, 0.25);
  g.bezierCurveTo(-0.185, 0.13, -0.1, 0.05, -0.045, 0);
  g.closePath?.();
}

/**
 * The brass cobra of the darshan photograph, origin at the stone's foot, the door at -x, the naga at the
 * stone's back right (+x, +z). A thick (≈9 cm) body coils in the trough and rises in an S; a tall flat
 * spade hood (0.46 × 0.36 m, slightly cupped, bevelled edge) leans forward over the stone's crown with its
 * broad face turned to the side - from the door it is seen edge-on to three-quarter, in profile - and the
 * head bows forward from the top of the hood with a curving chin.
 */
export function cobraGeometry(TessellateModifier: new (e: number, i: number) => { modify(g: THREE.BufferGeometry): THREE.BufferGeometry }) {
  const Nk = new THREE.Vector3(0.07, 0.47, 0.33); // where the body flows into the hood (at the stone's right, a little behind)
  // the hood runs from the neck up and forward to a crown above the stone's top
  const HX = 0.98, HY = 1.19; // hood scale: 0.35 m wide, 0.55 m long (a tall leaf / blade)
  const D = new THREE.Vector3(0, 1, -0.55).normalize(); // rising almost straight, leaning a little in over the stone
  // its broad inner face looks towards the door and the stone's left: three-quarter from the darshan door
  // the broad face looks across the stone (-z), turned ~28° towards the door: from the door the cobra is
  // seen nearly in profile, the hood a tall narrow blade with its eye-spots foreshortened
  const Nf = new THREE.Vector3(-Math.sin(0.49), 0, -Math.cos(0.49));
  Nf.addScaledVector(D, -Nf.dot(D)).normalize();
  const Wd = new THREE.Vector3().crossVectors(D, Nf);
  const rot = new THREE.Matrix4();
  // body: coil in the channel behind the stone, then an S up to the neck
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 7; i++) {
    const a = -Math.PI * 0.3 + (i / 7) * Math.PI * 0.68;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.37, 0.0, Math.sin(a) * 0.37));
  }
  const hoodBase = Nk.clone().addScaledVector(D, 0.07);
  pts.push(new THREE.Vector3(0.13, 0.1, 0.36), new THREE.Vector3(0.12, 0.22, 0.375), new THREE.Vector3(0.09, 0.34, 0.36),
    Nk.clone(), hoodBase);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const TS = 110, RS = 16;
  const body = new THREE.TubeGeometry(curve, TS, 1, RS);
  const bp = body.attributes.position, len = curve.getLength();
  for (let i = 0; i < bp.count; i++) {
    const t = Math.floor(i / (RS + 1)) / TS, c = curve.getPointAt(t);
    const k = 0.012 + 0.044 * Math.min(1, t * 5) - 0.012 * Math.max(0, (t - 0.9) / 0.1); // a tapering tail, then an even ≈11 cm body into the hood
    bp.setXYZ(i, c.x + (bp.getX(i) - c.x) * k, c.y + (bp.getY(i) - c.y) * k, c.z + (bp.getZ(i) - c.z) * k);
  }
  const buv = body.attributes.uv;
  for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getY(i) * 3, buv.getX(i) * len / 0.04);
  body.computeVertexNormals();

  // hood: extruded spade with a bevelled edge, tessellated so it can be cupped
  const sh = new THREE.Shape();
  hoodPath(sh as unknown as Parameters<typeof hoodPath>[0]);
  let hood: THREE.BufferGeometry = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.007, bevelSegments: 2, curveSegments: 20 });
  hood.translate(0, 0, -0.005);
  hood.scale(HX, HY, 1);
  hood.deleteAttribute('normal');
  hood.deleteAttribute('uv');
  hood = new TessellateModifier(0.025, 8).modify(hood.index ? hood.toNonIndexed() : hood);
  const hp = hood.attributes.position, huv = new Float32Array(hp.count * 2);
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i);
    const yn = y / (0.462 * HY);
    huv[i * 2] = (x / HX + 0.18) / 0.36; huv[i * 2 + 1] = yn;
    // cupped across (the edges come forward to the face side), bowed back along its length, the crown
    // arching forward over the stone
    const z = hp.getZ(i) + 0.75 * x * x - 0.02 * Math.sin(Math.PI * yn) + 0.2 * Math.max(0, yn - 0.5) ** 2 / 0.25;
    hp.setZ(i, z);
  }
  hood.setAttribute('uv', new THREE.BufferAttribute(huv, 2));
  // into place: local x → Wd, y → D, z → Nf, then turned about the neck towards the door
  const basis = new THREE.Matrix4().makeBasis(Wd, D, Nf).premultiply(rot).setPosition(Nk);
  hood.applyMatrix4(basis);
  hood.computeVertexNormals();
  // head: an elongated wedge at the crown on the face side, bowed forward and down, with a curved chin
  const head = new THREE.SphereGeometry(1, 20, 14);
  { const p = head.attributes.position;
    for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); const taper = zz > 0 ? 1 - 0.45 * zz : 1; p.setXYZ(i, p.getX(i) * 0.036 * taper, p.getY(i) * 0.026 * taper - 0.006 * zz * zz, zz * 0.072); } }
  head.rotateX(1.05); // the snout points down at the flower crown
  head.scale(1.05, 1.05, 1.05);
  head.translate(0, 0.415 * HY, 0.19);
  head.applyMatrix4(new THREE.Matrix4().makeBasis(Wd, D, Nf).premultiply(rot).setPosition(Nk));
  head.computeVertexNormals();
  return { body, hood, head };
}

export function cobraHoodMaterial(env: THREE.Texture) {
  const { col, hgt } = hoodCanvases();
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const normal = heightToNormal(hgt, 2.2, false);
  return new THREE.MeshStandardMaterial({
    color: 0xb08d4a, map, normalMap: normal, normalScale: new THREE.Vector2(1.0, 1.0), metalness: 0.88, roughness: 0.33,
    envMap: env, envMapIntensity: 0.85, emissive: 0x1a120a, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  });
}

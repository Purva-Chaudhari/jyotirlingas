import * as THREE from 'three';

/**
 * Procedural relief maps for Grishneshwar's carved basalt, drawn as height fields on canvases and
 * turned into normal + AO (+ an optional painted colour map). Every map is drawn so that the canvas
 * BOTTOM is the band's lowest world height: with world-metre UVs (v = y) a texture repeat of
 * 1/H and offset −y0/H pins each course to its real height on the building.
 *
 *  - wall      : the red jangha of the garbhagriha (khura, kumbha, dentil and chequer courses, ashlar
 *                with carved rosette roundels, recessed panels, kapota) — 2.0 × 5.5 m
 *  - plinth    : the stepped adhishthana courses with their rows of pendant lotus-bud drops — 1.2 × 1.5 m
 *  - elephants : the gajathara: elephants in pilastered bays under the niche band — 1.2 × 1.2 m
 *  - niches    : the painted band of deity niches (Dashavatara and Shiva lila) — cusped arches,
 *                pilasters, soft standing figures with NO facial detail — 1.0 × 2.2 m
 *  - jali      : lattice screens on the miniature shrines (kutas) of the shikhara — 0.8 × 0.8 m
 *  - lata      : the scrolling creeper of the central spine on every face of the shikhara — 1.2 × 1.2 m
 *  - parapet   : the kakshasana (seat-back wall) of the sabha mandapa: ogee medallions with rosettes — 0.6 × 0.9 m
 *  - pillar    : banded mouldings and bead/garland chains for the 24 mandapa pillars — 0.8 × 0.8 m
 */

export interface Relief { normal: THREE.CanvasTexture; ao: THREE.CanvasTexture; color: THREE.CanvasTexture }

function canvas(w: number, h: number, fill = '#808080') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = fill;
  g.fillRect(0, 0, w, h);
  return { c, g };
}

/** Separable box blur (wrapping). */
function blur(h: Float32Array, w: number, hh: number, r: number) {
  if (r < 1) return;
  const tmp = new Float32Array(h.length);
  for (let y = 0; y < hh; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += h[y * w + ((x + w) % w)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += h[y * w + ((x + r + 1) % w)] - h[y * w + ((x - r + w) % w)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[((y + hh) % hh) * w + x];
    for (let y = 0; y < hh; y++) {
      h[y * w + x] = acc / (2 * r + 1);
      acc += tmp[((y + r + 1) % hh) * w + x] - tmp[((y - r + hh) % hh) * w + x];
    }
  }
}

function readHeight(g: CanvasRenderingContext2D, w: number, hh: number) {
  const d = g.getImageData(0, 0, w, hh).data;
  const h = new Float32Array(w * hh);
  for (let i = 0; i < w * hh; i++) h[i] = d[i * 4] / 255;
  return h;
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Height canvas → normal / AO / colour textures. `paint` (optional) is a colour canvas of the same
 * size that is shaded by the relief; otherwise colour = grey shaded by height (to multiply a scan).
 */
function build(g: CanvasRenderingContext2D, w: number, hh: number, o: {
  blur?: number; strength?: number; ao?: number; grain?: number; paint?: HTMLCanvasElement; seed?: number;
}): Relief {
  const h = readHeight(g, w, hh);
  blur(h, w, hh, o.blur ?? 2);
  let s = o.seed ?? 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grain = o.grain ?? 0.02;
  for (let i = 0; i < h.length; i++) h[i] += (rnd() - 0.5) * grain;
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  const strength = o.strength ?? 6, aoDepth = o.ao ?? 0.5;
  const mk = (fn: (i: number, x: number, y: number, out: Uint8ClampedArray, k: number) => void) => {
    const { c, g: cg } = canvas(w, hh);
    const img = cg.createImageData(w, hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      fn(i, x, y, img.data, i * 4);
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    return c;
  };
  // local cavity: how far below its neighbourhood a texel sits (deep cuts get darker)
  const avg = h.slice();
  blur(avg, w, hh, 6);
  const normal = mk((_, x, y, d, k) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255;
  });
  const ao = mk((i, _x, _y, d, k) => {
    const cav = Math.max(0, avg[i] - h[i]) * 3.5;
    const v = Math.max(0, Math.min(1, 1 - aoDepth + aoDepth * Math.min(1, h[i] * 1.25) - cav * aoDepth)) * 255;
    d[k] = d[k + 1] = d[k + 2] = v;
  });
  let paintData: Uint8ClampedArray | null = null;
  if (o.paint) paintData = o.paint.getContext('2d')!.getImageData(0, 0, w, hh).data;
  const color = mk((i, _x, _y, d, k) => {
    const cav = Math.max(0, avg[i] - h[i]) * 2.5;
    const shade = paintData ? Math.max(0.55, Math.min(1.02, 0.84 + 0.18 * h[i] - cav * 0.6)) : Math.max(0.35, Math.min(1.08, 0.72 + 0.36 * h[i] - cav));
    if (paintData) {
      d[k] = paintData[k] * shade; d[k + 1] = paintData[k + 1] * shade; d[k + 2] = paintData[k + 2] * shade;
    } else {
      d[k] = d[k + 1] = d[k + 2] = 235 * shade;
    }
  });
  const ct = tex(color);
  ct.colorSpace = THREE.SRGBColorSpace;
  return { normal: tex(normal), ao: tex(ao), color: ct };
}

const grey = (v: number) => `rgb(${v | 0},${v | 0},${v | 0})`;

/** horizontal band of height v from world-height y0 to y1 (canvas measured from the top) */
function bandFn(g: CanvasRenderingContext2D, W: number, top: number, ppm: number) {
  return (y0: number, y1: number, v: number) => {
    g.fillStyle = grey(v);
    g.fillRect(0, (top - y1) * ppm, W, (y1 - y0) * ppm);
  };
}

/** a rosette: ring, petals, boss */
function rosette(g: CanvasRenderingContext2D, x: number, y: number, r: number, petals = 8) {
  g.fillStyle = grey(70);
  g.beginPath(); g.arc(x, y, r * 1.08, 0, Math.PI * 2); g.fill();
  g.strokeStyle = grey(225);
  g.lineWidth = r * 0.16;
  g.beginPath(); g.arc(x, y, r * 0.92, 0, Math.PI * 2); g.stroke();
  g.fillStyle = grey(205);
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.33, r * 0.15, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = grey(240);
  g.beginPath(); g.arc(x, y, r * 0.2, 0, Math.PI * 2); g.fill();
}

/** Garbhagriha wall, world y 1.5 → 7.0 (5.5 m), 2.0 m wide. */
export function wallRelief(): Relief {
  const ppm = 128, W = 256, H = 704, TOP = 7.0;
  const { g } = canvas(W, H, grey(150));
  const band = bandFn(g, W, TOP, ppm);
  const Y = (y: number) => (TOP - y) * ppm;
  // khura (base) chamfer and kumbha (pot moulding), shaded as convex profiles
  for (let y = 1.5; y < 1.9; y += 0.01) band(y, y + 0.01, 120 + (y - 1.5) * 220);
  band(1.9, 1.95, 60);
  // course of pendant drops
  band(1.95, 2.3, 140);
  g.fillStyle = grey(220);
  for (let x = 8; x < W; x += 32) {
    g.beginPath(); g.moveTo(x, Y(2.3)); g.quadraticCurveTo(x + 16, Y(2.3), x + 8, Y(2.04)); g.quadraticCurveTo(x, Y(2.3), x, Y(2.3)); g.fill();
    g.beginPath(); g.arc(x + 8, Y(2.2), 7, 0, Math.PI * 2); g.fill();
  }
  band(2.3, 2.36, 60);
  for (let y = 2.36; y < 3.0; y += 0.01) band(y, y + 0.01, 120 + Math.sin(((y - 2.36) / 0.64) * Math.PI) * 120);
  band(3.0, 3.06, 60);
  // lozenge course
  band(3.06, 3.36, 130);
  g.fillStyle = grey(215);
  for (let x = 0; x <= W; x += 32) {
    g.beginPath(); g.moveTo(x, Y(3.33)); g.lineTo(x + 12, Y(3.21)); g.lineTo(x, Y(3.09)); g.lineTo(x - 12, Y(3.21)); g.fill();
  }
  band(3.36, 3.42, 230);
  // ashlar field with joints and a carved rosette roundel
  band(3.42, 5.56, 165);
  g.fillStyle = grey(85);
  for (let y = 3.42, k = 0; y < 5.56; y += 0.54, k++) {
    g.fillRect(0, Y(y) - 1, W, 2);
    for (let x = (k % 2) * 64; x < W; x += 128) g.fillRect(x, Y(Math.min(5.56, y + 0.54)), 2, 0.54 * ppm);
  }
  rosette(g, 128, Y(4.55), 20, 8);
  // chequer course
  band(5.56, 5.62, 60);
  for (let x = 0; x < W; x += 16) {
    g.fillStyle = grey((x / 16) % 2 ? 210 : 95);
    g.fillRect(x, Y(5.82), 16, 0.1 * ppm);
    g.fillStyle = grey((x / 16) % 2 ? 95 : 210);
    g.fillRect(x, Y(5.72), 16, 0.1 * ppm);
  }
  band(5.82, 5.88, 230);
  // recessed panels with a diamond lattice
  band(5.88, 6.55, 120);
  for (let x = 6; x < W; x += 128) {
    g.fillStyle = grey(215); g.fillRect(x, Y(6.5), 116, 0.57 * ppm);
    g.fillStyle = grey(95); g.fillRect(x + 8, Y(6.44), 100, 0.45 * ppm);
    g.strokeStyle = grey(200); g.lineWidth = 3;
    for (let k = -60; k < 120; k += 14) {
      g.beginPath(); g.moveTo(x + 8 + k, Y(5.99)); g.lineTo(x + 8 + k + 57, Y(6.44)); g.stroke();
      g.beginPath(); g.moveTo(x + 8 + k + 57, Y(5.99)); g.lineTo(x + 8 + k, Y(6.44)); g.stroke();
    }
  }
  // kapota with dentils
  band(6.55, 6.62, 60);
  band(6.62, 6.82, 120);
  g.fillStyle = grey(225);
  for (let x = 2; x < W; x += 16) g.fillRect(x, Y(6.8), 10, 0.16 * ppm);
  band(6.82, 7.0, 210);
  return build(g, W, H, { blur: 2, strength: 5, ao: 0.55 });
}

/** Plinth courses, world y 0 → 1.5, 1.2 m wide: three steps, each with a row of pendant drops. */
export function plinthRelief(): Relief {
  const ppm = 128, W = 154, H = 192, TOP = 1.5;
  const { g } = canvas(W, H, grey(150));
  const band = bandFn(g, W, TOP, ppm);
  const Y = (y: number) => (TOP - y) * ppm;
  for (let c = 0; c < 3; c++) {
    const y0 = c * 0.5;
    band(y0, y0 + 0.06, 90);
    band(y0 + 0.06, y0 + 0.32, 150);
    band(y0 + 0.32, y0 + 0.36, 70);
    band(y0 + 0.36, y0 + 0.5, 200);
    // a lotus-petal course (padma) under the top fillet, and a dentil row at the foot
    g.fillStyle = grey(225);
    for (let x = 0; x <= W; x += W / 8) {
      const top = Y(y0 + 0.36), tip = Y(y0 + 0.2);
      g.beginPath();
      g.moveTo(x - 9, top); g.quadraticCurveTo(x - 10, (top + tip) / 2, x, tip); g.quadraticCurveTo(x + 10, (top + tip) / 2, x + 9, top);
      g.fill();
    }
    g.fillStyle = grey(205);
    for (let x = 2; x < W; x += 13) g.fillRect(x, Y(y0 + 0.055), 8, 0.05 * ppm);
  }
  return build(g, W, H, { blur: 2, strength: 5, ao: 0.5 });
}

/** Gajathara — elephants in pilastered bays, world y 7.2 → 8.4, 1.2 m wide. */
export function elephantRelief(): Relief {
  const W = 154, H = 154;
  const { g } = canvas(W, H, grey(70));
  // top + bottom fillets, pilasters
  g.fillStyle = grey(215); g.fillRect(0, 0, W, 14); g.fillRect(0, H - 18, W, 18);
  g.fillStyle = grey(150); g.fillRect(0, 14, W, 5); g.fillRect(0, H - 22, W, 4);
  g.fillStyle = grey(200); g.fillRect(0, 14, 12, H - 32); g.fillRect(W - 12, 14, 12, H - 32);
  // the elephant, walking right, trunk lowered
  g.fillStyle = grey(225);
  g.beginPath(); g.ellipse(70, 78, 34, 25, 0, 0, Math.PI * 2); g.fill(); // body
  g.beginPath(); g.ellipse(104, 66, 17, 19, 0.2, 0, Math.PI * 2); g.fill(); // head
  g.fillStyle = grey(245);
  g.beginPath(); g.ellipse(96, 70, 10, 15, 0.1, 0, Math.PI * 2); g.fill(); // ear
  g.strokeStyle = grey(225); g.lineCap = 'round';
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(116, 72); g.quadraticCurveTo(126, 100, 118, 126); g.stroke(); // trunk
  g.lineWidth = 12;
  for (const x of [46, 62, 84, 98]) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 128); g.stroke(); } // legs
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(37, 72); g.quadraticCurveTo(30, 90, 33, 104); g.stroke(); // tail
  // caparison (a saddle cloth band)
  g.fillStyle = grey(250);
  g.fillRect(56, 54, 28, 32);
  g.fillStyle = grey(190);
  g.fillRect(58, 84, 24, 4);
  return build(g, W, H, { blur: 2, strength: 6, ao: 0.6 });
}

/**
 * Painted niche band (Dashavatara and Shiva lila figures in cusped niches), world y 8.4 → 10.6, 1.0 m wide.
 * Figures are soft, featureless standing forms — they read as sculpture at height without any faces.
 */
export function nicheRelief(variant = 0, figure = true): Relief {
  const W = 128, H = 282;
  const { g } = canvas(W, H, grey(70));
  const paint = canvas(W, H, '#c99a8a');
  const p = paint.g;
  const both = (fn: (c: CanvasRenderingContext2D, v: number, col: string) => void, v: number, col: string) => { fn(g, v, col); fn(p, v, col); };
  const rect = (x: number, y: number, w: number, h: number) => (c: CanvasRenderingContext2D, v: number, col: string) => {
    c.fillStyle = c === g ? grey(v) : col; c.fillRect(x, y, w, h);
  };
  const cream = '#d8c2a8', cream2 = '#ccb196', pink = '#c08878';
  // lotus-petal cornice at the top
  both(rect(0, 0, W, 22), 200, cream);
  for (let x = 0; x < W; x += 16) both((c, v, col) => { c.fillStyle = c === g ? grey(v) : col; c.beginPath(); c.ellipse(x + 8, 16, 6, 9, 0, 0, Math.PI * 2); c.fill(); }, 240, cream2);
  both(rect(0, 22, W, 6), 120, '#b8655a');
  if (figure) {
  // pilasters with a tiny capital
  for (const x of [0, W - 14]) {
    both(rect(x, 28, 14, H - 64), 205, cream);
    both(rect(x + 3, 40, 8, H - 90), 230, cream2);
  }
  // cusped arch over the niche
  both((c, v, col) => {
    c.fillStyle = c === g ? grey(v) : col;
    c.beginPath();
    c.moveTo(14, 82); c.lineTo(14, 30); c.lineTo(W - 14, 30); c.lineTo(W - 14, 82);
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, x = W - 14 - t * (W - 28);
      const y = 82 - Math.sin(t * Math.PI) * 34 + (k % 2 ? 6 : 0);
      c.lineTo(x, y);
    }
    c.closePath(); c.fill();
  }, 210, cream);
  }
  // niche back (pink, recessed)
  if (figure) both(rect(18, 84, W - 36, H - 128), 60, pink);
  else both(rect(0, 28, W, H - 68), 60, '#c99a8a');
  if (figure) {
  // the figure: a soft standing form on a lotus pedestal, haloed; no facial features
  const fx = W / 2 + (variant % 2 ? 2 : -2);
  both((c, v, col) => {
    c.fillStyle = c === g ? grey(v) : col;
    c.beginPath(); c.ellipse(fx, 106, 16, 16, 0, 0, Math.PI * 2); c.fill(); // halo / prabhavali
  }, 120, '#c9a090');
  const kind = variant % 6;
  both((c, v, col) => {
    c.fillStyle = c === g ? grey(v) : col;
    c.strokeStyle = c.fillStyle; c.lineCap = 'round';
    if (kind === 3) {
      // a seated figure (lalitasana): head, torso, folded legs on a throne
      c.beginPath(); c.ellipse(fx, 128, 8.5, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillRect(fx - 5, 112, 10, 8);
      c.beginPath(); c.ellipse(fx, 164, 14, 25, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(fx, 196, 27, 11, 0, 0, Math.PI * 2); c.fill();
      c.lineWidth = 6; c.beginPath(); c.moveTo(fx + 10, 200); c.lineTo(fx + 16, 222); c.stroke();
      c.fillRect(fx - 30, 206, 60, 14);
    } else if (kind === 4) {
      // a pair (Shiva–Parvati type composition): two smaller standing forms
      for (const dx of [-14, 14]) {
        c.beginPath(); c.ellipse(fx + dx, 118, 7, 8.5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(fx + dx, 152, 11, 24, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(fx + dx - 10, 166); c.lineTo(fx + dx - 8, 222); c.lineTo(fx + dx + 8, 222); c.lineTo(fx + dx + 10, 166); c.fill();
      }
      c.lineWidth = 4; c.beginPath(); c.moveTo(fx - 4, 140); c.lineTo(fx + 4, 140); c.stroke();
    } else if (kind === 5) {
      // a dancing figure: torso swayed, one leg raised
      c.beginPath(); c.ellipse(fx + 4, 110, 8.5, 10, 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(fx, 146, 14, 28, 0.18, 0, Math.PI * 2); c.fill();
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(fx - 4, 168); c.lineTo(fx - 8, 222); c.stroke();
      c.beginPath(); c.moveTo(fx + 4, 168); c.quadraticCurveTo(fx + 26, 178, fx + 18, 196); c.stroke();
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(fx - 12, 130); c.quadraticCurveTo(fx - 32, 120, fx - 26, 100); c.stroke();
      c.beginPath(); c.moveTo(fx + 12, 132); c.lineTo(fx + 30, 144); c.stroke();
    } else {
      c.beginPath(); c.ellipse(fx, 108, 8.5, 10, 0, 0, Math.PI * 2); c.fill(); // head with crown
      c.fillRect(fx - 5, 92, 10, 8);
      c.beginPath(); c.ellipse(fx, 146, 15, 30, 0, 0, Math.PI * 2); c.fill(); // torso
      c.beginPath(); c.moveTo(fx - 14, 160); c.lineTo(fx - 11, 222); c.lineTo(fx + 11, 222); c.lineTo(fx + 14, 160); c.fill(); // lower garment
      c.lineWidth = 6;
      c.beginPath(); c.moveTo(fx - 13, 128); c.lineTo(fx - 22, kind === 0 ? 112 : 150); c.stroke();
      c.beginPath(); c.moveTo(fx + 13, 128); c.lineTo(fx + 22, kind === 1 ? 110 : 152); c.stroke();
      if (kind === 2) { c.lineWidth = 3; c.beginPath(); c.moveTo(fx + 24, 100); c.lineTo(fx + 24, 200); c.stroke(); } // a staff / mace
    }
  }, 225, '#d9c3b5');
  }
  // lotus pedestal and the band of chequer below
  if (figure) both(rect(28, 222, W - 56, 10), 190, cream2);
  both(rect(0, H - 40, W, 10), 215, cream);
  for (let x = 0; x < W; x += 12) both(rect(x, H - 30, 6, 14), 230, (x / 12) % 2 ? cream : '#b8655a');
  both(rect(0, H - 16, W, 16), 200, '#9a5a4c');
  return build(g, W, H, { blur: 1, strength: 6, ao: 0.5, paint: paint.c, grain: 0.015 });
}

/** Lattice screen for the kuta faces, 0.8 m tile. */
export function jaliRelief(): Relief {
  const W = 128, H = 128;
  const { g } = canvas(W, H, grey(200));
  g.fillStyle = grey(235);
  g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10); g.fillRect(0, 0, 10, H); g.fillRect(W - 10, 0, 10, H);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = 18 + x * 30.7, cy = 18 + y * 30.7;
    g.fillStyle = grey(40);
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = grey(190);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      g.beginPath(); g.ellipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 5, 2.4, a, 0, Math.PI * 2); g.fill();
    }
  }
  return build(g, W, H, { blur: 1, strength: 5, ao: 0.6 });
}

/** The central creeper spine (lata): interlaced roundels and leafy scrolls, 1.2 m tile. */
export function lataRelief(): Relief {
  const W = 128, H = 128;
  const { g } = canvas(W, H, grey(80));
  g.strokeStyle = grey(220); g.lineWidth = 7;
  g.beginPath();
  for (let y = 0; y <= H; y += 2) { const x = W / 2 + Math.sin((y / H) * Math.PI * 4) * 28; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.beginPath();
  for (let y = 0; y <= H; y += 2) { const x = W / 2 - Math.sin((y / H) * Math.PI * 4) * 28; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  for (let k = 0; k < 4; k++) {
    const y = (k + 0.5) * (H / 4);
    g.fillStyle = grey(235);
    g.beginPath(); g.arc(W / 2, y, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = grey(200);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(W / 2 + s * 42, y, 12, 6, s * 0.6, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = grey(225);
  g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
  for (let y = 4; y < H; y += 10) { g.beginPath(); g.arc(14, y, 3.5, 0, Math.PI * 2); g.arc(W - 14, y, 3.5, 0, Math.PI * 2); g.fill(); }
  return build(g, W, H, { blur: 1, strength: 6, ao: 0.6 });
}

/** Mandapa seat-back wall (kakshasana): ogee medallions with rosettes in frames, 0.6 × 0.9 m. */
export function parapetRelief(): Relief {
  const W = 96, H = 144;
  const { g } = canvas(W, H, grey(110));
  g.fillStyle = grey(210);
  g.fillRect(0, 0, W, 12); g.fillRect(0, H - 14, W, 14);
  g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H);
  g.fillStyle = grey(70);
  g.fillRect(10, 16, W - 20, H - 34);
  // the ogee medallion
  g.fillStyle = grey(215);
  g.beginPath();
  g.moveTo(W / 2, 22);
  g.bezierCurveTo(W / 2 + 36, 50, W / 2 + 36, 92, W / 2, 122);
  g.bezierCurveTo(W / 2 - 36, 92, W / 2 - 36, 50, W / 2, 22);
  g.fill();
  rosette(g, W / 2, 72, 17, 8);
  return build(g, W, H, { blur: 1, strength: 6, ao: 0.6 });
}

/** Pillar shaft carving: bead chains and hanging garland loops between banded mouldings, 0.8 m tile. */
export function pillarRelief(): Relief {
  const W = 128, H = 128;
  const { g } = canvas(W, H, grey(150));
  g.fillStyle = grey(220); g.fillRect(0, 0, W, 14); g.fillRect(0, 64, W, 10);
  g.fillStyle = grey(80); g.fillRect(0, 14, W, 3); g.fillRect(0, 74, W, 3);
  g.strokeStyle = grey(225); g.lineWidth = 4;
  for (let x = 0; x < W; x += 32) {
    g.beginPath(); g.arc(x + 16, 20, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = grey(235);
    g.beginPath(); g.arc(x + 16, 46, 4, 0, Math.PI * 2); g.fill();
  }
  for (let x = 4; x < W; x += 9) { g.beginPath(); g.arc(x, 100, 3.2, 0, Math.PI * 2); g.fill(); }
  return build(g, W, H, { blur: 1, strength: 5, ao: 0.5 });
}

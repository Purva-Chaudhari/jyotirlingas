import * as THREE from 'three';

/**
 * Procedural carving for Trimbakeshwar's basalt, drawn as height fields on canvases and turned into
 * normal + AO + tint maps (white = proud, black = cut back). Patterns follow the 2006–2024 photographs
 * on Wikimedia Commons:
 *  - 'frieze'  : the cornice friezes of the mandapa and porches — lotus roundels under little cusped
 *                arches, a scroll course above and a band of diamonds and chequers below;
 *  - 'courses' : dressed ashlar of the walls with thin carved fillets;
 *  - 'spindle' : the skin of the urushringas (miniature spires) that cover the shikhara — vertical ribs,
 *                lattice bands and a fringe of hanging petals at every storey;
 *  - 'niche'   : a deity in a cusped niche — a standing figure in silhouette relief (no facial features);
 *  - 'silver'  : repoussé silver for the sanctum (lotus roundels and rope borders).
 */

export interface Relief { normal: THREE.CanvasTexture; ao: THREE.CanvasTexture; color: THREE.CanvasTexture }

function canvas(w: number, h: number, bg = '#000') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  return { c, g };
}

function blur(h: Float32Array, w: number, hh: number, r: number, wrap = true) {
  const tmp = new Float32Array(h.length);
  const ix = (x: number, n: number) => (wrap ? (x + n) % n : Math.min(n - 1, Math.max(0, x)));
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += h[y * w + ix(x + k, w)];
      tmp[y * w + x] = a / (2 * r + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < hh; y++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += tmp[ix(y + k, hh) * w + x];
      h[y * w + x] = a / (2 * r + 1);
    }
  }
}

function readHeight(g: CanvasRenderingContext2D, w: number, hh: number) {
  const d = g.getImageData(0, 0, w, hh).data;
  const h = new Float32Array(w * hh);
  for (let i = 0; i < w * hh; i++) h[i] = d[i * 4] / 255;
  return h;
}

function toTextures(h: Float32Array, w: number, hh: number, strength: number, tint: [number, number, number], aoDepth: number, wrap = true): Relief {
  const mk = (fn: (i: number, x: number, y: number) => [number, number, number]) => {
    const { c, g } = canvas(w, hh);
    const img = g.createImageData(w, hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, [r, gg, b] = fn(i, x, y);
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    return t;
  };
  const at = (x: number, y: number) => h[(wrap ? (y + hh) % hh : Math.min(hh - 1, Math.max(0, y))) * w + (wrap ? (x + w) % w : Math.min(w - 1, Math.max(0, x)))];
  const normal = mk((_, x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
  // AO: recesses darker, with a broad blurred term so deep cuts read from afar
  const broad = h.slice();
  blur(broad, w, hh, 6, wrap);
  const ao = mk((i) => {
    const v = (1 - aoDepth + aoDepth * Math.min(1, (h[i] * 0.6 + broad[i] * 0.4) * 1.25)) * 255;
    return [v, v, v];
  });
  const color = mk((i) => {
    const k = 0.7 + 0.3 * Math.min(1, h[i] * 1.2);
    return [tint[0] * k, tint[1] * k, tint[2] * k];
  });
  color.colorSpace = THREE.SRGBColorSpace;
  return { normal, ao, color };
}

const grey = (v: number) => `rgb(${v},${v},${v})`;

function lotus(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, petals: number, rings = 2) {
  for (let ring = 0; ring < rings; ring++) {
    const rr = r * (1 - ring * 0.38), n = petals - ring * 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.3;
      const gr = g.createRadialGradient(cx + Math.cos(a) * rr * 0.62, cy + Math.sin(a) * rr * 0.62, 0, cx + Math.cos(a) * rr * 0.62, cy + Math.sin(a) * rr * 0.62, rr * 0.4);
      gr.addColorStop(0, grey(250 - ring * 20));
      gr.addColorStop(1, grey(150 - ring * 10));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * rr * 0.6, cy + Math.sin(a) * rr * 0.6, rr * 0.38, rr * 0.15, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = grey(235);
  g.beginPath(); g.arc(cx, cy, r * 0.18, 0, Math.PI * 2); g.fill();
  g.strokeStyle = grey(210);
  g.lineWidth = Math.max(2, r * 0.07);
  g.beginPath(); g.arc(cx, cy, r * 1.02, 0, Math.PI * 2); g.stroke();
}

function cuspedArch(g: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number, cusps = 5) {
  g.beginPath();
  g.moveTo(cx - w / 2, base);
  g.lineTo(cx - w / 2, base - h * 0.55);
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI * (1 - t);
    const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * cusps)), 0.6) * w * 0.05;
    g.lineTo(cx + Math.cos(a) * (w / 2 - cusp * 0.4), base - h * 0.55 - Math.sin(a) * (h * 0.45) + cusp);
  }
  g.lineTo(cx + w / 2, base);
  g.closePath();
}

/** Cornice frieze, one tile = 1.2 m wide × 1.2 m tall (512 × 512 px). */
export function frieze(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H, grey(120));
  // top: running scroll (vine with curled leaves)
  g.fillStyle = grey(200);
  g.fillRect(0, 6, W, 10);
  g.strokeStyle = grey(235);
  g.lineWidth = 9;
  g.beginPath();
  for (let x = 0; x <= W; x += 2) {
    const y = 52 + Math.sin((x / W) * Math.PI * 8) * 18;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const x = (k + 0.25) * (W / 8), up = k % 2 ? 1 : -1;
    g.fillStyle = grey(225);
    g.beginPath(); g.ellipse(x + 14, 52 + up * 20, 16, 8, up * 0.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x - 6, 52 - up * 8, 6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = grey(70);
  g.fillRect(0, 90, W, 6);
  g.fillStyle = grey(215);
  g.fillRect(0, 96, W, 12);
  // main course: lotus roundels inside cusped arches, small buds between
  for (let k = 0; k < 4; k++) {
    const cx = (k + 0.5) * (W / 4);
    g.fillStyle = grey(60);
    cuspedArch(g, cx, 330, 112, 210, 5);
    g.fill();
    g.strokeStyle = grey(225);
    g.lineWidth = 9;
    cuspedArch(g, cx, 330, 120, 218, 5);
    g.stroke();
    lotus(g, cx, 245, 44, 14, 2);
    // flame-like bud between arches
    const bx = (k + 1) * (W / 4);
    g.fillStyle = grey(220);
    g.beginPath(); g.moveTo(bx - 12, 200); g.quadraticCurveTo(bx, 140, bx + 12, 200); g.closePath(); g.fill();
    g.beginPath(); g.arc(bx, 214, 10, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = grey(70);
  g.fillRect(0, 334, W, 6);
  g.fillStyle = grey(210);
  g.fillRect(0, 340, W, 12);
  // lower course: diamonds alternating with chequer squares
  for (let k = 0; k < 8; k++) {
    const cx = (k + 0.5) * (W / 8);
    if (k % 2 === 0) {
      g.fillStyle = grey(230);
      g.beginPath(); g.moveTo(cx, 362); g.lineTo(cx + 26, 400); g.lineTo(cx, 438); g.lineTo(cx - 26, 400); g.closePath(); g.fill();
      g.fillStyle = grey(110);
      g.beginPath(); g.arc(cx, 400, 9, 0, Math.PI * 2); g.fill();
    } else {
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        g.fillStyle = (a + b) % 2 ? grey(40) : grey(215);
        g.fillRect(cx - 24 + a * 24, 376 + b * 24, 24, 24);
      }
    }
  }
  g.fillStyle = grey(70);
  g.fillRect(0, 446, W, 6);
  // dentils at the bottom edge
  for (let x = 0; x < W; x += 21) {
    g.fillStyle = grey(225);
    g.fillRect(x + 3, 456, 14, 40);
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 6, [205, 200, 192], 0.65);
}

/**
 * Dressed basalt courses as on the photographed walls: 0.3 m courses of blocks with sunk joints, every
 * third course a projecting fillet with a carved bead-and-reel or small lozenges. Tile 2.4 m (512 px).
 */
export function courses(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H, grey(60));
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 8, ch = H / n; // 0.3 m courses
  g.fillStyle = grey(120);
  g.fillRect(0, 0, W, H);
  for (let r = 0; r < n; r++) {
    const y0 = r * ch;
    if (r % 3 === 1) {
      // carved fillet course: a proud band with lozenges / bead-and-reel
      g.fillStyle = grey(200);
      g.fillRect(0, y0 + 3, W, ch - 6);
      for (let x = 0; x < W; x += 16) {
        g.fillStyle = r % 2 ? grey(245) : grey(110);
        if (r % 2) { g.beginPath(); g.moveTo(x + 8, y0 + 12); g.lineTo(x + 14, y0 + ch / 2); g.lineTo(x + 8, y0 + ch - 12); g.lineTo(x + 2, y0 + ch / 2); g.closePath(); g.fill(); }
        else { g.beginPath(); g.ellipse(x + 8, y0 + ch / 2, 5, 12, 0, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = grey(240); g.fillRect(0, y0 + 3, W, 4); g.fillRect(0, y0 + ch - 7, W, 4);
      continue;
    }
    let x = -rnd() * 120;
    while (x < W) {
      const bw = 90 + rnd() * 150;
      const t = 160 + rnd() * 40;
      // bevelled block face: bright centre, falling to the joint
      const gr = g.createLinearGradient(0, y0, 0, y0 + ch);
      gr.addColorStop(0, grey(t - 25)); gr.addColorStop(0.1, grey(t)); gr.addColorStop(0.9, grey(t)); gr.addColorStop(1, grey(t - 30));
      g.fillStyle = gr;
      g.fillRect(x + 1.5, y0 + 2, bw - 3, ch - 4);
      x += bw;
    }
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 1);
  for (let i = 0; i < h.length; i++) h[i] += (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.025;
  return toTextures(h, W, H, 6, [205, 203, 200], 0.6);
}

/** Skin of an urushringa (lathe UV: u around, v up). One tile = one storey band of the spindle. */
export function spindle(): Relief {
  const W = 256, H = 256;
  const { g } = canvas(W, H, grey(110));
  // vertical ribs
  for (let k = 0; k < 8; k++) {
    const x = (k + 0.5) * (W / 8);
    const gr = g.createLinearGradient(x - 14, 0, x + 14, 0);
    gr.addColorStop(0, grey(110)); gr.addColorStop(0.5, grey(230)); gr.addColorStop(1, grey(110));
    g.fillStyle = gr;
    g.fillRect(x - 14, 60, 28, 140);
  }
  // lattice band (little lozenges)
  for (let k = 0; k < 16; k++) {
    const x = (k + 0.5) * (W / 16);
    g.fillStyle = grey(225);
    g.beginPath(); g.moveTo(x, 18); g.lineTo(x + 7, 32); g.lineTo(x, 46); g.lineTo(x - 7, 32); g.closePath(); g.fill();
  }
  g.fillStyle = grey(60); g.fillRect(0, 50, W, 5);
  g.fillStyle = grey(230); g.fillRect(0, 4, W, 8);
  // hanging petal fringe at the bottom of each storey
  for (let k = 0; k < 16; k++) {
    const x = (k + 0.5) * (W / 16);
    const gr = g.createRadialGradient(x, 214, 1, x, 222, 14);
    gr.addColorStop(0, grey(245)); gr.addColorStop(1, grey(120));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, 224, 7, 20, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = grey(50); g.fillRect(0, 246, W, 10);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 5, [200, 196, 190], 0.6);
}

/** The standing figure of a niche (silhouette relief, no facial features), drawn in a 256 × 512 frame. */
function figure(g: CanvasRenderingContext2D, variant: number, W = 256) {
  // figure (silhouette relief): a standing deity in a gentle tribhanga, four-armed, crowned, haloed.
  const cx = W / 2 + (variant % 2 ? 3 : -3);
  const sway = variant % 3 === 0 ? 5 : variant % 3 === 1 ? -5 : 0;
  const fill = (v: number) => { g.fillStyle = grey(v); };
  // halo
  g.strokeStyle = grey(190); g.lineWidth = 6;
  g.beginPath(); g.arc(cx, 128, 40, 0, Math.PI * 2); g.stroke();
  // lotus pedestal
  fill(205);
  g.beginPath(); g.ellipse(cx, 458, 52, 13, 0, 0, Math.PI * 2); g.fill();
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.ellipse(cx + k * 14, 446, 7, 10, 0, 0, Math.PI * 2); g.fill(); }
  // legs and the long dhoti, falling in folds to the ankles
  fill(225);
  g.beginPath();
  g.moveTo(cx - 30, 250); g.quadraticCurveTo(cx - 34 + sway * 0.3, 340, cx - 22 + sway, 436);
  g.lineTo(cx - 6 + sway, 436); g.lineTo(cx + sway * 0.5, 330); g.lineTo(cx + 6 + sway, 436);
  g.lineTo(cx + 22 + sway, 436); g.quadraticCurveTo(cx + 34 + sway * 0.3, 340, cx + 30, 250); g.closePath(); g.fill();
  // waist sash ends
  fill(245);
  g.beginPath(); g.moveTo(cx - 28, 252); g.quadraticCurveTo(cx - 44, 300, cx - 36, 352); g.lineTo(cx - 30, 352); g.quadraticCurveTo(cx - 34, 300, cx - 20, 256); g.closePath(); g.fill();
  // torso: broad shoulders, narrow waist
  fill(235);
  g.beginPath();
  g.moveTo(cx - 28, 252); g.quadraticCurveTo(cx - 24, 214, cx - 40, 178); g.quadraticCurveTo(cx, 166, cx + 40, 178);
  g.quadraticCurveTo(cx + 24, 214, cx + 28, 252); g.closePath(); g.fill();
  // neck, head (smooth, no features), tall crown
  fill(240);
  g.fillRect(cx - 7, 152, 14, 18);
  g.beginPath(); g.ellipse(cx, 136, 16, 20, 0, 0, Math.PI * 2); g.fill();
  fill(250);
  g.beginPath(); g.moveTo(cx - 16, 126); g.lineTo(cx - 12, 92); g.quadraticCurveTo(cx, 72, cx + 12, 92); g.lineTo(cx + 16, 126); g.closePath(); g.fill();
  // four arms: upper pair raised holding attributes, lower pair in blessing / resting on the thigh
  g.strokeStyle = grey(235); g.lineCap = 'round'; g.lineWidth = 11;
  const arm = (x0: number, y0: number, xm: number, ym: number, x1: number, y1: number) => {
    g.beginPath(); g.moveTo(cx + x0, y0); g.quadraticCurveTo(cx + xm, ym, cx + x1, y1); g.stroke();
  };
  arm(-34, 182, -50, 168, -56, 130); arm(34, 182, 50, 168, 56, 130);
  arm(-34, 196, -50, 232, -40, 262); arm(34, 196, 52, 220, 44, 206);
  // attributes: trident and drum above, a pot in the lower hand, the lower right raised in abhaya
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx - 58, 134); g.lineTo(cx - 58, 64); g.stroke();
  g.beginPath(); g.moveTo(cx - 68, 80); g.quadraticCurveTo(cx - 66, 66, cx - 58, 62); g.quadraticCurveTo(cx - 50, 66, cx - 48, 80); g.stroke();
  fill(245);
  g.beginPath(); g.moveTo(cx + 50, 118); g.lineTo(cx + 66, 118); g.lineTo(cx + 54, 128); g.lineTo(cx + 66, 138); g.lineTo(cx + 50, 138); g.lineTo(cx + 62, 128); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(cx - 40, 270, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 46, 198, 7, 10, 0, 0, Math.PI * 2); g.fill();
  // necklace and girdle, as fine raised lines
  g.strokeStyle = grey(255); g.lineWidth = 3;
  g.beginPath(); g.arc(cx, 176, 18, 0.25, Math.PI - 0.25); g.stroke();
  g.beginPath(); g.moveTo(cx - 28, 250); g.quadraticCurveTo(cx, 262, cx + 28, 250); g.stroke();
  // attendants at the feet
  for (const sgn of [-1, 1]) {
    fill(210);
    g.beginPath(); g.ellipse(cx + sgn * 64, 412, 10, 30, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + sgn * 64, 374, 8, 0, Math.PI * 2); g.fill();
  }
}

/**
 * A deity in a cusped niche between pilasters, carved in relief. The figure is a silhouette:
 * crowned head (no features), shoulders, four arms with attributes, a long garment, a lotus pedestal.
 * `variant` changes the pose a little. Not tiled: 256 × 512 px → 0.7 m × 1.4 m.
 */
export function niche(variant: number): Relief {
  const W = 256, H = 512;
  const { g } = canvas(W, H, grey(150));
  // frame with pilasters and cusped arch
  g.fillStyle = grey(215);
  g.fillRect(10, 40, 30, 440);
  g.fillRect(W - 40, 40, 30, 440);
  g.fillRect(6, 470, W - 12, 36);
  g.fillStyle = grey(55);
  cuspedArch(g, W / 2, 470, 168, 420, 7);
  g.fill();
  g.strokeStyle = grey(220);
  g.lineWidth = 8;
  cuspedArch(g, W / 2, 470, 182, 432, 7);
  g.stroke();
  // finial over the arch
  g.fillStyle = grey(220);
  g.beginPath(); g.moveTo(W / 2 - 18, 40); g.quadraticCurveTo(W / 2, -4, W / 2 + 18, 40); g.closePath(); g.fill();
  figure(g, variant, W);
  const h = readHeight(g, W, H);
  blur(h, W, H, 3, false);
  // stronger contrast: the figure must read from the courtyard
  for (let i = 0; i < h.length; i++) h[i] = Math.min(1, Math.max(0, (h[i] - 0.25) * 1.4));
  return toTextures(h, W, H, 9, [190, 186, 180], 0.85, false);
}

/** Repoussé silver: lotus roundels in a lattice, rope border (tile 0.3 m). */
export function silver(): Relief {
  const W = 256, H = 256;
  const { g } = canvas(W, H, grey(120));
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) lotus(g, 64 + a * 128, 64 + b * 128, 44, 12, 2);
  g.strokeStyle = grey(220);
  g.lineWidth = 6;
  for (let k = 0; k <= 2; k++) {
    g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, H); g.stroke();
    g.beginPath(); g.moveTo(0, k * 128); g.lineTo(W, k * 128); g.stroke();
  }
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
    g.fillStyle = grey(230);
    g.beginPath(); g.arc(k * 128 + 128, j * 128 + 128, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(k * 128, j * 128, 9, 0, Math.PI * 2); g.fill();
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 6, [236, 238, 242], 0.45);
}

/**
 * Deep-carved basalt wall of the antarala and sanctum (off07): half-pilasters with banded shafts at both
 * edges, a cusped niche with a small figure, a band of lotus roundels and a kirtimukha-like fringe of
 * pendants. Tile 0.8 m × 1.6 m (256 × 512 px).
 */
export function wallPanel(): Relief {
  const W = 256, H = 512;
  const { g } = canvas(W, H, grey(70));
  // pilasters at both edges: banded shafts with pot-and-foliage capitals
  for (const x of [0, W]) {
    const gr = g.createLinearGradient(x - 40, 0, x + 40, 0);
    gr.addColorStop(0, grey(150)); gr.addColorStop(0.5, grey(240)); gr.addColorStop(1, grey(150));
    g.fillStyle = gr;
    g.fillRect(x - 36, 0, 72, H);
    for (let y = 30; y < H; y += 64) {
      g.fillStyle = grey(255); g.fillRect(x - 40, y, 80, 10);
      g.fillStyle = grey(120); g.fillRect(x - 34, y + 10, 68, 4);
      g.fillStyle = grey(225);
      g.beginPath(); g.ellipse(x, y + 34, 26, 14, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // band of lotus roundels near the top
  g.fillStyle = grey(200); g.fillRect(36, 8, W - 72, 52);
  for (let k = 0; k < 3; k++) lotus(g, 72 + k * 56, 34, 20, 10, 2);
  // fringe of pendants under it
  for (let x = 44; x < W - 40; x += 14) {
    g.fillStyle = grey(235);
    g.beginPath(); g.ellipse(x, 72, 5, 12, 0, 0, Math.PI * 2); g.fill();
  }
  // the niche and its figure
  g.fillStyle = grey(35);
  cuspedArch(g, W / 2, 470, 140, 370, 7);
  g.fill();
  g.strokeStyle = grey(230); g.lineWidth = 8;
  cuspedArch(g, W / 2, 470, 152, 382, 7);
  g.stroke();
  g.save();
  g.translate(W / 2, 470);
  g.scale(0.62, 0.62);
  g.translate(-W / 2, -470);
  figure(g, 1, W);
  g.restore();
  // base course
  g.fillStyle = grey(215); g.fillRect(36, 474, W - 72, 14);
  g.fillStyle = grey(110); g.fillRect(36, 488, W - 72, 6);
  for (let x = 44; x < W - 40; x += 18) { g.fillStyle = grey(230); g.fillRect(x, 496, 10, 14); }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  for (let i = 0; i < h.length; i++) h[i] += (Math.sin(i * 7.31) * 43758.5453 % 1) * 0.03;
  return toTextures(h, W, H, 9, [175, 172, 168], 0.85);
}

/** White sanctum marble: 0.6 m slabs with fine grey veins and dark joints. Tile 2.4 m (512 px). */
export function marbleFloor(): THREE.CanvasTexture {
  // white Makrana-like slabs (off02, off10): 0.6 m squares, each a slightly different warm white with soft,
  // low-contrast grey clouding and a few long blurred veins; fine pale joints — no dark crack lines
  const S = 1024;
  const { c, g } = canvas(S, S, '#dedbd4');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cell = S / 4;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const t = 220 + rnd() * 14;
    g.fillStyle = `rgb(${t},${t - 2},${t - 6})`;
    g.fillRect(a * cell, b * cell, cell, cell);
    g.save();
    g.beginPath();
    g.rect(a * cell, b * cell, cell, cell);
    g.clip();
    // clouding
    g.filter = 'blur(14px)';
    for (let k = 0; k < 7; k++) {
      const v = 175 + rnd() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.10)`;
      g.beginPath();
      g.ellipse(a * cell + rnd() * cell, b * cell + rnd() * cell, 20 + rnd() * 70, 10 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // veins: long smooth curves, blurred, low contrast, running diagonally through the slab
    const ang = rnd() * Math.PI;
    for (let v = 0; v < 3; v++) {
      g.filter = `blur(${1 + rnd() * 2.2}px)`;
      g.strokeStyle = `rgba(128,128,134,${0.12 + rnd() * 0.12})`;
      g.lineWidth = 1 + rnd() * 2.5;
      const cx = a * cell + rnd() * cell, cy = b * cell + rnd() * cell, L = cell * 0.9;
      const dx = Math.cos(ang + (rnd() - 0.5) * 0.6) * L, dy = Math.sin(ang + (rnd() - 0.5) * 0.6) * L;
      g.beginPath();
      g.moveTo(cx - dx, cy - dy);
      g.bezierCurveTo(cx - dx * 0.3 + (rnd() - 0.5) * 60, cy - dy * 0.3 + (rnd() - 0.5) * 60, cx + dx * 0.3 + (rnd() - 0.5) * 60, cy + dy * 0.3 + (rnd() - 0.5) * 60, cx + dx, cy + dy);
      g.stroke();
    }
    g.restore();
    g.filter = 'none';
  }
  // joints: thin, pale grout with a faint shadow line
  g.fillStyle = 'rgba(165,160,152,0.55)';
  for (let k = 0; k <= 4; k++) { g.fillRect(k * cell - 1, 0, 2, S); g.fillRect(0, k * cell - 1, S, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(1 / 2.4, 1 / 2.4);
  return t;
}

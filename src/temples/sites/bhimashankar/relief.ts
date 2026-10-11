import * as THREE from 'three';

/**
 * Procedural carving for Bhimashankar's basalt, drawn as height fields on canvases and turned into
 * normal + AO + tint maps (white = proud, black = cut back). Patterns follow the 2011–2024 photographs
 * of Bhimashankar on Wikimedia Commons (uday kumar / panoramio, 2011; 2019–2023 uploads) and the temple trust:
 *  - 'frieze'  : the cornice friezes of the mandapa and porches — lotus roundels under little cusped
 *                arches, a scroll course above and a band of diamonds and chequers below;
 *  - 'courses' : dressed ashlar of the walls with thin carved fillets;
 *  - 'spindle' : the skin of the urushringas (miniature spires) that cover the shikhara — vertical ribs,
 *                lattice bands and a fringe of hanging petals at every storey;
 *  - 'niche'   : a deity in a cusped niche — a standing figure in silhouette relief (no facial features);
 *  - 'silver'  : repoussé silver for the sanctum (lotus roundels and rope borders);
 *  - 'figures' : the band of small carved figures that girdles the garbhagriha's walls about 3.5 m up —
 *                standing deities and attendants in shallow panels between pilasterettes (no faces);
 *  - 'coffer'  : the mandapa ceiling — a full lotus in a square frame for every 2.4 m bay;
 *  - 'pillar'  : the carved skin of the new mandapa's pillars — bands of lotus petals, chains and lozenges.
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

/** Figure band on the mandovara: one tile = 1.2 m × 0.6 m (512 × 256 px), two figure panels. */
export function figures(): Relief {
  const W = 512, H = 256;
  const { g } = canvas(W, H, grey(90));
  // top and bottom fillets
  g.fillStyle = grey(215); g.fillRect(0, 0, W, 16); g.fillRect(0, H - 18, W, 18);
  g.fillStyle = grey(60); g.fillRect(0, 16, W, 4); g.fillRect(0, H - 22, W, 4);
  for (let k = 0; k < 4; k++) {
    const x0 = k * 128;
    // pilasterette
    g.fillStyle = grey(200); g.fillRect(x0, 20, 14, H - 42);
    g.fillStyle = grey(240); g.fillRect(x0 + 3, 24, 8, H - 50);
    const cx = x0 + 71, v = k % 4;
    // little cusped canopy
    g.strokeStyle = grey(210); g.lineWidth = 5;
    cuspedArch(g, cx, 70, 92, 54, 5); g.stroke();
    // figure: crowned head (no features), torso, hips in tribhanga, arms, long garment
    const sway = v === 1 ? 6 : v === 3 ? -6 : 0;
    g.fillStyle = grey(245);
    g.beginPath(); g.ellipse(cx, 66, 10, 12, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx - 9, 60); g.lineTo(cx - 6, 42); g.quadraticCurveTo(cx, 34, cx + 6, 42); g.lineTo(cx + 9, 60); g.closePath(); g.fill();
    g.fillStyle = grey(232);
    g.beginPath(); g.moveTo(cx - 22, 88); g.quadraticCurveTo(cx, 80, cx + 22, 88); g.quadraticCurveTo(cx + 14, 120, cx + 16 + sway, 140);
    g.lineTo(cx - 16 + sway, 140); g.quadraticCurveTo(cx - 14, 120, cx - 22, 88); g.closePath(); g.fill();
    g.fillStyle = grey(222);
    g.beginPath(); g.moveTo(cx - 18 + sway, 138); g.quadraticCurveTo(cx - 22 + sway, 190, cx - 14 + sway * 1.4, 226);
    g.lineTo(cx + 14 + sway * 1.4, 226); g.quadraticCurveTo(cx + 22 + sway, 190, cx + 18 + sway, 138); g.closePath(); g.fill();
    g.strokeStyle = grey(236); g.lineCap = 'round'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx - 20, 92); g.quadraticCurveTo(cx - 34, 112, cx - 26 + (v % 2) * 10, v % 2 ? 76 : 136); g.stroke();
    g.beginPath(); g.moveTo(cx + 20, 92); g.quadraticCurveTo(cx + 34, 112, cx + 28, v === 2 ? 74 : 132); g.stroke();
    // attribute held high (staff / lotus / bow)
    g.lineWidth = 3; g.strokeStyle = grey(250);
    if (v === 0) { g.beginPath(); g.moveTo(cx + 30, 140); g.lineTo(cx + 30, 40); g.stroke(); }
    if (v === 2) { g.beginPath(); g.arc(cx + 30, 64, 9, 0, Math.PI * 2); g.stroke(); }
    // small attendant at the side
    g.fillStyle = grey(200);
    g.beginPath(); g.ellipse(cx - 40, 196, 6, 22, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx - 40, 168, 6, 0, Math.PI * 2); g.fill();
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 7, [196, 192, 186], 0.8);
}

/** Ceiling coffer: a full-blown lotus in a stepped square frame; tile = one 2.4 m bay (512 px). */
export function coffer(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H, grey(70));
  for (let k = 0; k < 4; k++) {
    const m = 14 + k * 26;
    g.strokeStyle = grey(150 + k * 25); g.lineWidth = 14;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  }
  // corner rosettes
  for (const [x, y] of [[64, 64], [448, 64], [64, 448], [448, 448]]) lotus(g, x, y, 22, 10, 1);
  // diagonal leaves
  g.fillStyle = grey(190);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.beginPath(); g.ellipse(256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150, 34, 12, a, 0, Math.PI * 2); g.fill();
  }
  lotus(g, 256, 256, 120, 16, 3);
  g.fillStyle = grey(250); g.beginPath(); g.arc(256, 256, 26, 0, Math.PI * 2); g.fill();
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 6, [200, 196, 190], 0.75);
}

/** Pillar skin (cylindrical UV: u round the shaft in metres, v up): one tile 1 m × 1 m. */
export function pillarSkin(): Relief {
  const W = 256, H = 256;
  const { g } = canvas(W, H, grey(150));
  // lotus-petal band
  for (let k = 0; k < 8; k++) {
    const x = (k + 0.5) * 32;
    const gr = g.createRadialGradient(x, 40, 2, x, 40, 18);
    gr.addColorStop(0, grey(250)); gr.addColorStop(1, grey(120));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, 40, 13, 22, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = grey(70); g.fillRect(0, 68, W, 5);
  g.fillStyle = grey(225); g.fillRect(0, 74, W, 10);
  // hanging chain-and-bell (ghanta-mala) motif
  for (let k = 0; k < 8; k++) {
    const x = (k + 0.5) * 32;
    g.strokeStyle = grey(225); g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, 84); g.lineTo(x, 130); g.stroke();
    g.fillStyle = grey(235); g.beginPath(); g.moveTo(x - 9, 150); g.quadraticCurveTo(x, 118, x + 9, 150); g.closePath(); g.fill();
  }
  g.fillStyle = grey(70); g.fillRect(0, 168, W, 5);
  for (let k = 0; k < 16; k++) {
    const x = (k + 0.5) * 16;
    g.fillStyle = grey(k % 2 ? 230 : 110);
    g.beginPath(); g.moveTo(x, 182); g.lineTo(x + 7, 200); g.lineTo(x, 218); g.lineTo(x - 7, 200); g.closePath(); g.fill();
  }
  g.fillStyle = grey(210); g.fillRect(0, 232, W, 12);
  const h = readHeight(g, W, H);
  blur(h, W, H, 1);
  return toTextures(h, W, H, 6, [200, 196, 190], 0.6);
}

/**
 * Plain dressed ashlar of the mandovara (round 3): big slabs in 0.55 m courses, 0.7–1.5 m long, tight
 * lime-pointed joints and a faint pitch to each face — no carved motif (one tile = 2.4 m × 2.2 m).
 */
export function ashlar(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H, grey(70));
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 4, ch = H / n;
  for (let r = 0; r < n; r++) {
    const y0 = r * ch;
    let x = -rnd() * 160;
    while (x < W) {
      const bw = 150 + rnd() * 170;
      const t = 175 + rnd() * 50;
      const gr = g.createLinearGradient(0, y0, 0, y0 + ch);
      gr.addColorStop(0, grey(t - 20)); gr.addColorStop(0.06, grey(t)); gr.addColorStop(0.94, grey(t - 6)); gr.addColorStop(1, grey(t - 28));
      g.fillStyle = gr;
      const draw = (xx: number) => g.fillRect(xx + 1.5, y0 + 1.5, bw - 3, ch - 3);
      draw(x);
      if (x + bw > W) draw(x - W);
      x += bw;
    }
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 1);
  for (let i = 0; i < h.length; i++) h[i] += (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.03;
  return toTextures(h, W, H, 4, [205, 203, 200], 0.5);
}

/**
 * Repoussé silver sheathing of the sanctum dado (round 3): one non-repeating panel per wall half
 * (2.05 m × 0.9 m, 1024 × 448 px) — a beaded rope border, a big central lotus medallion in a cusped frame,
 * scrolling creepers with leaves and buds either side, half-lotuses in the corners, a petal fringe below.
 */
export function silverPanel(): Relief {
  const W = 1024, H = 448;
  const { g } = canvas(W, H, grey(110));
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // rope/bead border and an inner flat frame
  g.fillStyle = grey(200); g.fillRect(0, 0, W, 34); g.fillRect(0, H - 34, W, 34); g.fillRect(0, 0, 34, H); g.fillRect(W - 34, 0, 34, H);
  g.fillStyle = grey(80); g.fillRect(34, 34, W - 68, 6); g.fillRect(34, H - 40, W - 68, 6); g.fillRect(34, 34, 6, H - 68); g.fillRect(W - 40, 34, 6, H - 68);
  const bead = (x: number, y: number, r: number) => {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    gr.addColorStop(0, grey(255)); gr.addColorStop(1, grey(150));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  for (let x = 12; x < W; x += 22) { bead(x, 17, 8); bead(x, H - 17, 8); }
  for (let y = 40; y < H - 30; y += 22) { bead(17, y, 8); bead(W - 17, y, 8); }
  // central medallion in a cusped frame
  g.strokeStyle = grey(225); g.lineWidth = 12;
  cuspedArch(g, W / 2, H - 70, 330, 330, 7); g.stroke();
  lotus(g, W / 2, H / 2 + 10, 120, 16, 3);
  // scrolling creepers either side, mirrored but with jittered leaves
  for (const side of [-1, 1]) {
    g.strokeStyle = grey(215); g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, x = W / 2 + side * (190 + t * 290), y = H / 2 + Math.sin(t * Math.PI * 3) * 95;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    for (let k = 0; k < 9; k++) {
      const t = (k + 0.5) / 9, x = W / 2 + side * (190 + t * 290), y = H / 2 + Math.sin(t * Math.PI * 3) * 95;
      const up = Math.cos(t * Math.PI * 3) > 0 ? -1 : 1;
      // a curling tendril ending in a rosette
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + side * 30, y + up * 40, x + side * (10 + rnd() * 16), y + up * 70); g.stroke();
      lotus(g, x + side * (10 + rnd() * 10), y + up * 76, 18 + rnd() * 6, 8, 1);
      // leaves on the stem
      for (const s2 of [-1, 1]) {
        const gr = g.createRadialGradient(x, y, 2, x, y, 30);
        gr.addColorStop(0, grey(245)); gr.addColorStop(1, grey(150));
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x + side * 18, y + s2 * 22, 26, 10, side * s2 * 0.9 + rnd() * 0.3, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // half-lotus corners
  for (const [x, y] of [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]]) lotus(g, x, y, 34, 10, 2);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2, false);
  return toTextures(h, W, H, 7, [236, 238, 242], 0.5);
}

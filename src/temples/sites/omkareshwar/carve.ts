import * as THREE from 'three';

/**
 * Procedural relief maps (height → normal + AO/colour), drawn on canvases:
 *  - 'jaala'  : the gavaksha mesh (interlaced horseshoe arches) and vertical flutes that cover Nagara spires,
 *  - 'wall'   : carved temple wall bands (lotus-petal courses, rosettes, niche frames),
 *  - 'sanctum': the embossed gold sheets of the garbhagriha (2022): framed panels with lotus roundels,
 *               creeper borders and an "ॐ नमः शिवाय" inscription band,
 *  - 'silver' : repoussé silver bands (scallops and rope) for the Jyotirlinga's basin.
 * No figures or faces are drawn.
 */

export interface Relief { normal: THREE.CanvasTexture; ao: THREE.CanvasTexture; color: THREE.CanvasTexture }

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  return { c, g };
}

/** Separable box blur of a height field (softens canvas strokes into rounded relief). */
function blur(h: Float32Array, w: number, hh: number, r: number) {
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

function toTextures(h: Float32Array, w: number, hh: number, strength: number, tint: [number, number, number], aoDepth: number): Relief {
  const mk = (fn: (i: number, x: number, y: number) => [number, number, number]) => {
    const { c, g } = canvas(w, hh);
    const img = g.createImageData(w, hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, [r, gg, b] = fn(i, x, y);
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  const normal = mk((_, x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
  const ao = mk((i) => {
    const v = (1 - aoDepth + aoDepth * Math.min(1, h[i] * 1.15)) * 255;
    return [v, v, v];
  });
  const color = mk((i) => {
    const k = 0.62 + 0.38 * Math.min(1, h[i] * 1.2);
    return [tint[0] * k, tint[1] * k, tint[2] * k];
  });
  color.colorSpace = THREE.SRGBColorSpace;
  return { normal, ao, color };
}

function readHeight(g: CanvasRenderingContext2D, w: number, hh: number) {
  const d = g.getImageData(0, 0, w, hh).data;
  const h = new Float32Array(w * hh);
  for (let i = 0; i < w * hh; i++) h[i] = d[i * 4] / 255;
  return h;
}

/** Gavaksha mesh: rows of horseshoe arches, each row offset by half, framed by vertical flutes. Tile ≈ 1.2 m. */
export function jaala(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const rows = 4, cols = 3, cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = c * cw + (r % 2 ? cw / 2 : 0), cy = r * rh + rh * 0.62;
      // horseshoe arch: outer + inner ring, dropping legs
      for (const [rad, lw] of [[cw * 0.42, 10], [cw * 0.26, 7]] as const) {
        g.lineWidth = lw;
        g.beginPath();
        g.arc(cx, cy, rad, Math.PI * 0.92, Math.PI * 2.08);
        g.stroke();
      }
      // finial knob at the arch top and a lotus boss in the eye
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(cx, cy - cw * 0.48, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#9a9a9a';
      g.beginPath(); g.arc(cx, cy - cw * 0.05, cw * 0.1, 0, Math.PI * 2); g.fill();
    }
    // horizontal fillet between rows
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, r * rh + rh * 0.66, W, 6);
  }
  // vertical flutes dividing columns
  g.fillStyle = '#ffffff';
  for (let c = 0; c <= cols; c++) g.fillRect(c * cw - 4, 0, 8, H);
  const h = readHeight(g, W, H);
  blur(h, W, H, 3);
  // fine stone grain / hammered dimples
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // fine chisel / hammer grain: breaks broad sun highlights on the gilding into a soft sparkle
  for (let i = 0; i < h.length; i++) h[i] += (rnd() - 0.5) * 0.12;
  blur(h, W, H, 1);
  return toTextures(h, W, H, 6, [240, 225, 205], 0.55);
}

/** Temple wall courses: lotus-petal band, rosette band and plain ashlar. Tile 1.6 m wide × 1.6 m high. */
export function wallBands(): Relief {
  const W = 512, H = 512;
  const { g } = canvas(W, H);
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, W, H);
  // petal course
  g.fillStyle = '#fff';
  for (let x = 0; x < W + 32; x += 32) {
    g.beginPath(); g.ellipse(x, 70, 13, 34, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#e0e0e0';
  g.fillRect(0, 112, W, 14);
  g.fillRect(0, 20, W, 12);
  // rosette course
  for (let x = 32; x < W; x += 64) {
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x, 200, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#555';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath(); g.arc(x + Math.cos(a) * 14, 200 + Math.sin(a) * 14, 5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x, 200, 7, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 238, W, 10);
  // plain ashlar with joints
  g.fillStyle = '#3a3a3a';
  for (let y = 300; y < H; y += 70) g.fillRect(0, y, W, 3);
  for (let y = 300, k = 0; y < H; y += 70, k++) for (let x = (k % 2) * 90; x < W; x += 180) g.fillRect(x, y, 3, 70);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 5, [235, 222, 205], 0.45);
}

/** Embossed gold sheet of the sanctum: one 1.3 m × 3.6 m panel column, inscription band at the top. */
export function sanctumGold(): Relief {
  const W = 256, H = 704;
  const { g } = canvas(W, H);
  g.fillStyle = '#6a6a6a';
  g.fillRect(0, 0, W, H);
  // inscription band
  g.fillStyle = '#d0d0d0';
  g.fillRect(6, 18, W - 12, 64);
  g.fillStyle = '#4a4a4a';
  g.fillRect(14, 26, W - 28, 48);
  g.fillStyle = '#ffffff';
  g.font = 'bold 34px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('ॐ नमः शिवाय', W / 2, 52);
  // framed main panel with a creeper border
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.strokeRect(16, 104, W - 32, 440);
  g.lineWidth = 4;
  g.strokeRect(34, 122, W - 68, 404);
  g.lineWidth = 5;
  g.beginPath();
  for (let y = 130; y < 520; y += 2) {
    const x = 25 + Math.sin(y * 0.09) * 6;
    if (y === 130) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.beginPath();
  for (let y = 130; y < 520; y += 2) {
    const x = W - 25 + Math.sin(y * 0.09 + 1.5) * 6;
    if (y === 130) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  // lotus roundel with petals in the panel centre, smaller rosettes above and below
  const lotus = (cx: number, cy: number, r: number, n: number) => {
    g.fillStyle = '#ffffff';
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.42, r * 0.17, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#bdbdbd';
    g.beginPath(); g.arc(cx, cy, r * 0.28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, r * 1.05, 0, Math.PI * 2); g.stroke();
  };
  lotus(W / 2, 324, 78, 16);
  lotus(W / 2, 176, 34, 10);
  lotus(W / 2, 472, 34, 10);
  // lower dado: bead-and-reel band and square coffers
  g.fillStyle = '#ffffff';
  for (let x = 12; x < W; x += 18) { g.beginPath(); g.arc(x, 566, 6, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.strokeRect(22, 586, W - 44, 100);
  lotus(W / 2, 636, 28, 8);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < h.length; i++) h[i] += (rnd() - 0.5) * 0.02;
  return toTextures(h, W, H, 7, [255, 196, 80], 0.5);
}

/** Repoussé silver band: scallops over a rope moulding (tile 0.4 m). */
export function silverBand(): Relief {
  const W = 256, H = 128;
  const { g } = canvas(W, H);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  for (let x = 0; x <= W; x += 32) { g.beginPath(); g.arc(x + 16, 40, 15, 0, Math.PI); g.fill(); }
  g.strokeStyle = '#fff';
  g.lineWidth = 6;
  for (let x = -20; x < W + 20; x += 14) { g.beginPath(); g.moveTo(x, 84); g.lineTo(x + 12, 104); g.stroke(); }
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 10, W, 6);
  g.fillRect(0, 112, W, 6);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  return toTextures(h, W, H, 5, [235, 236, 240], 0.4);
}

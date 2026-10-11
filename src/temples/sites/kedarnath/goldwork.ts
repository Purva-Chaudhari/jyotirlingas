import * as THREE from 'three';

/**
 * The garbhagriha's gold cladding (550 embossed plates, Oct 2022): a quilted diamond lattice
 * with tiny four-petalled bosses over most of the wall, framed repoussé panels with cusped
 * heads at intervals, scrolling border strips, a band of lotus petals under the cornice and a
 * plinth band of rosettes. Drawn as a height field on a canvas, turned into colour + normal maps.
 */

const PX = 220; // pixels per metre

function heightToMaps(hc: HTMLCanvasElement, strength: number, base: [number, number, number]) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d')!.getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = src[i * 4] / 255;
  const at = (x: number, y: number) => H[Math.min(h - 1, Math.max(0, y)) * w + ((x + w) % w)];
  const nc = document.createElement('canvas');
  nc.width = w; nc.height = h;
  const cc = document.createElement('canvas');
  cc.width = w; cc.height = h;
  const ni = nc.getContext('2d')!.createImageData(w, h);
  const ci = cc.getContext('2d')!.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      ni.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      ni.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      ni.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      ni.data[i + 3] = 255;
      // recesses darker (tarnish, soot from the lamps), raised parts burnished
      const hv = H[y * w + x];
      const cav = Math.max(0, (at(x - 2, y) + at(x + 2, y) + at(x, y - 2) + at(x, y + 2)) / 4 - hv);
      const k = 0.62 + hv * 0.45 - cav * 1.6 + (Math.sin(x * 0.37 + y * 0.21) * 0.5 + 0.5) * 0.03;
      ci.data[i] = Math.min(255, base[0] * k); ci.data[i + 1] = Math.min(255, base[1] * k); ci.data[i + 2] = Math.min(255, base[2] * k);
      ci.data[i + 3] = 255;
    }
  }
  nc.getContext('2d')!.putImageData(ni, 0, 0);
  cc.getContext('2d')!.putImageData(ci, 0, 0);
  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  const nor = new THREE.CanvasTexture(nc);
  for (const t of [map, nor]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; }
  return { map, nor };
}

function lattice(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, cell: number) {
  g.save();
  g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.fillStyle = '#5a5a5a';
  g.fillRect(x0, y0, w, h);
  // quilted diamonds: raised cushions separated by fine grooves
  for (let y = y0 - cell; y < y0 + h + cell; y += cell / 2) {
    const row = Math.round((y - y0) / (cell / 2));
    for (let x = x0 - cell + (row % 2 ? cell / 2 : 0); x < x0 + w + cell; x += cell) {
      const gr = g.createRadialGradient(x, y, 0, x, y, cell * 0.5);
      gr.addColorStop(0, '#c8c8c8'); gr.addColorStop(0.7, '#9a9a9a'); gr.addColorStop(1, '#6a6a6a');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y - cell / 2 + 2); g.lineTo(x + cell / 2 - 2, y); g.lineTo(x, y + cell / 2 - 2); g.lineTo(x - cell / 2 + 2, y);
      g.closePath(); g.fill();
      // four-petalled boss
      g.fillStyle = '#f2f2f2';
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * cell * 0.09, y + Math.sin(a) * cell * 0.09, cell * 0.08, cell * 0.04, a, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath(); g.arc(x, y, cell * 0.04, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    }
  }
  g.restore();
}

function rosetteBand(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = '#707070'; g.fillRect(x0, y0, w, h);
  g.fillStyle = '#b8b8b8'; g.fillRect(x0, y0, w, h * 0.12); g.fillRect(x0, y0 + h * 0.88, w, h * 0.12);
  const step = h * 1.1;
  for (let x = x0 + step / 2; x < x0 + w; x += step) {
    const cy = y0 + h / 2, r = h * 0.32;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillStyle = '#d8d8d8';
      g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.2, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, cy, r * 0.25, 0, Math.PI * 2); g.fill();
  }
}

function lotusBand(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = '#606060'; g.fillRect(x0, y0, w, h);
  const pw = h * 0.55;
  for (let x = x0; x < x0 + w + pw; x += pw) {
    const gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(1, '#8a8a8a');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - pw * 0.48, y0 + h * 0.85);
    g.quadraticCurveTo(x - pw * 0.5, y0 + h * 0.15, x, y0 + h * 0.05);
    g.quadraticCurveTo(x + pw * 0.5, y0 + h * 0.15, x + pw * 0.48, y0 + h * 0.85);
    g.closePath(); g.fill();
  }
  // bead string beneath
  for (let x = x0 + h * 0.06; x < x0 + w; x += h * 0.12) {
    g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(x, y0 + h * 0.94, h * 0.045, 0, Math.PI * 2); g.fill();
  }
}

function scrollStrip(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = '#505050'; g.fillRect(x0, y0, w, h);
  g.strokeStyle = '#d0d0d0'; g.lineWidth = w * 0.09;
  g.strokeRect(x0 + w * 0.06, y0 + w * 0.06, w * 0.88, h - w * 0.12);
  g.lineWidth = w * 0.07;
  g.beginPath();
  for (let y = y0; y < y0 + h; y += 2) {
    const x = x0 + w / 2 + Math.sin((y - y0) / (w * 0.55)) * w * 0.22;
    if (y === y0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  for (let y = y0 + w * 0.4; y < y0 + h; y += w * 0.55 * Math.PI) {
    for (const s of [-1, 1]) {
      g.fillStyle = '#e0e0e0';
      g.beginPath(); g.ellipse(x0 + w / 2 + s * w * 0.22, y + s * w * 0.4, w * 0.16, w * 0.07, s * 0.8, 0, Math.PI * 2); g.fill();
    }
  }
}

/** a framed panel with a cusped arch head and a lotus medallion */
function panel(g: CanvasRenderingContext2D, cx: number, y0: number, w: number, h: number, om: boolean) {
  const x0 = cx - w / 2;
  g.fillStyle = '#d4d4d4'; g.fillRect(x0 - 8, y0 - 8, w + 16, h + 16);
  g.fillStyle = '#505050'; g.fillRect(x0, y0, w, h);
  // cusped arch
  g.fillStyle = '#7a7a7a';
  g.beginPath();
  g.moveTo(x0 + 6, y0 + h);
  g.lineTo(x0 + 6, y0 + w * 0.5);
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    g.arc(cx + Math.cos(a) * (w / 2 - 14), y0 + w * 0.5 + Math.sin(a) * (w / 2 - 14) * 0.9, w * 0.07, a - 0.6, a + 0.6);
  }
  g.lineTo(x0 + w - 6, y0 + h);
  g.closePath(); g.fill();
  // medallion
  const my = y0 + h * 0.55, r = w * 0.32;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    g.fillStyle = '#e6e6e6';
    g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.62, my + Math.sin(a) * r * 0.62, r * 0.36, r * 0.13, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(cx, my, r * 0.42, 0, Math.PI * 2); g.fill();
  if (om) {
    g.fillStyle = '#ffffff';
    g.font = `700 ${Math.round(r * 0.72)}px "Noto Sans Devanagari", Martel, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ॐ', cx, my + r * 0.04);
  } else {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, my, r * 0.18, 0, Math.PI * 2); g.fill();
  }
  // foliage in the spandrels and the base
  for (let i = 0; i < 6; i++) {
    g.fillStyle = '#bdbdbd';
    g.beginPath(); g.ellipse(x0 + w * (0.15 + i * 0.14), y0 + h * 0.9, w * 0.06, w * 0.03, i, 0, Math.PI * 2); g.fill();
  }
}

/**
 * Wall maps covering one 2.4 m wide repeat and the full plated height (`height` metres).
 * UVs are world metres (u along the wall, v = world y); returns textures already offset so
 * that v = y0 (the top of the stone dado) is the bottom of the canvas.
 */
export function goldWallMaps(height: number, y0: number) {
  const W = Math.round(2.4 * PX), Hh = Math.round(height * PX);
  const hc = document.createElement('canvas');
  hc.width = W; hc.height = Hh;
  const g = hc.getContext('2d')!;
  const Y = (m: number) => Hh - m * PX; // canvas y for metres above the dado
  g.fillStyle = '#606060'; g.fillRect(0, 0, W, Hh);
  lattice(g, 0, Y(height - 0.42), W, (height - 0.42 - 0.26) * PX, 0.095 * PX);
  g.fillStyle = '#cfcfcf'; g.fillRect(0, Y(height - 0.24), W, 0.03 * PX);
  rosetteBand(g, 0, Y(0.26), W, 0.26 * PX);
  lotusBand(g, 0, Y(height - 0.08), W, 0.3 * PX);
  // inscription band: ॐ नमः शिवाय, as on the plates' upper register
  g.fillStyle = '#4a4a4a'; g.fillRect(0, Y(height - 0.42), W, 0.16 * PX);
  g.fillStyle = '#e8e8e8';
  g.font = `700 ${Math.round(0.1 * PX)}px "Noto Sans Devanagari", Martel, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 2; k++) g.fillText(k ? 'हर हर महादेव' : 'ॐ नमः शिवाय', (k + 0.5) * 1.2 * PX, Y(height - 0.42) + 0.08 * PX);
  g.fillStyle = '#cfcfcf'; g.fillRect(0, Y(height - 0.08), W, 0.08 * PX); g.fillRect(0, Y(height - 0.42), W, 0.04 * PX);
  panel(g, 0.6 * PX, Y(2.35), 0.66 * PX, 1.35 * PX, false);
  scrollStrip(g, 1.72 * PX, Y(2.9), 0.16 * PX, 2.5 * PX);
  scrollStrip(g, 2.28 * PX, Y(2.9), 0.16 * PX, 2.5 * PX);
  // panel seams: the 550 plates are about 0.6 m wide
  g.fillStyle = 'rgba(40,40,40,0.9)';
  for (let x = 0; x < W; x += 0.6 * PX) g.fillRect(x, 0, 2, Hh);
  g.filter = 'blur(1px)';
  g.drawImage(hc, 0, 0);
  g.filter = 'none';
  const { map, nor } = heightToMaps(hc, 4.5, [255, 208, 112]);
  for (const t of [map, nor]) {
    t.repeat.set(1 / 2.4, 1 / height);
    t.offset.set(0, -y0 / height);
  }
  return { map, nor };
}

/** back-wall centrepiece: a large framed ॐ panel (its own small texture) */
export function omPanelMaps() {
  const W = Math.round(0.9 * PX), H = Math.round(1.3 * PX);
  const hc = document.createElement('canvas');
  hc.width = W; hc.height = H;
  const g = hc.getContext('2d')!;
  g.fillStyle = '#606060'; g.fillRect(0, 0, W, H);
  panel(g, W / 2, 12, W - 30, H - 24, true);
  g.filter = 'blur(1px)'; g.drawImage(hc, 0, 0); g.filter = 'none';
  const { map, nor } = heightToMaps(hc, 4.5, [255, 210, 116]);
  for (const t of [map, nor]) t.wrapT = t.wrapS = THREE.ClampToEdgeWrapping;
  return { map, nor };
}

/** ceiling: lattice only, tileable 0.6 m */
export function goldCeilingMaps() {
  const W = Math.round(0.6 * PX);
  const hc = document.createElement('canvas');
  hc.width = hc.height = W;
  const g = hc.getContext('2d')!;
  lattice(g, 0, 0, W, W, W / 6);
  g.filter = 'blur(1px)'; g.drawImage(hc, 0, 0); g.filter = 'none';
  const { map, nor } = heightToMaps(hc, 4.5, [255, 208, 112]);
  for (const t of [map, nor]) { t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.6, 1 / 0.6); }
  return { map, nor };
}

import * as THREE from 'three';
import { prng } from './merge';

/**
 * Procedural relief maps (height → normal + AO + colour), drawn on canvases.
 *  - prakara : the famous carved panels of the Srisailam outer wall (14th–16th c.): courses of
 *              rust-ochre quartzite blocks, most dressed as framed panels with processions of
 *              elephants and horses, mounted riders, hunters, hamsas, deer, lions, rosettes and
 *              lingam shrines — small-scale relief massing only (no faces are drawn).
 *  - goldBands: repoussé bands of the gilded vimana tiers (beads, lotus petals, scrolls).
 *  - lattice : the diamond trellis of the gold dome cap.
 *  - stucco  : fine stucco ornament of the gopuram tiers.
 *  - pillar  : carved panels of the Vijayanagara mandapa pillars.
 *  - doorGold: embossed gold panels of the sanctum doorways (lotus roundels, creeper borders).
 *  - painted : the painted stucco parapet bands (red, green creeper, blue, cream) of the mandapas.
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

function tex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mk(w: number, hh: number, fn: (i: number, x: number, y: number) => [number, number, number]) {
  const { c, g } = canvas(w, hh);
  const img = g.createImageData(w, hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, [r, gg, b] = fn(i, x, y);
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function normalTex(h: Float32Array, w: number, hh: number, strength: number) {
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  return tex(mk(w, hh, (_, x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  }), false);
}

/** cavity AO: darker where the surface is below its neighbourhood */
function aoTex(h: Float32Array, w: number, hh: number, depth: number, r = 6) {
  const lo = h.slice();
  blur(lo, w, hh, r);
  const ao = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) ao[i] = Math.max(0.25, Math.min(1, 1 - depth * Math.max(0, lo[i] - h[i]) * 4 - depth * 0.35 * (1 - h[i])));
  return { ao, t: tex(mk(w, hh, (i) => { const v = ao[i] * 255; return [v, v, v]; }), false) };
}

function readHeight(g: CanvasRenderingContext2D, w: number, hh: number) {
  const d = g.getImageData(0, 0, w, hh).data;
  const h = new Float32Array(w * hh);
  for (let i = 0; i < w * hh; i++) h[i] = d[i * 4] / 255;
  return h;
}

const grey = (v: number) => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };

// ---------------------------------------------------------------- figures for the wall panels

type G = CanvasRenderingContext2D;
/** all figures stand on baseline y, face +x (dir = 1) or −x (dir = −1), scale s = figure height in px */
function elephant(g: G, x: number, y: number, s: number, dir: number, rider: boolean) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.beginPath(); g.ellipse(0, -s * 0.52, s * 0.5, s * 0.3, 0, 0, Math.PI * 2); g.fill(); // body
  for (const lx of [-0.36, -0.16, 0.18, 0.36]) g.fillRect(lx * s - s * 0.07, -s * 0.4, s * 0.14, s * 0.4); // legs
  g.beginPath(); g.ellipse(s * 0.5, -s * 0.62, s * 0.2, s * 0.22, 0, 0, Math.PI * 2); g.fill(); // head
  g.beginPath(); g.ellipse(s * 0.36, -s * 0.6, s * 0.12, s * 0.18, 0.2, 0, Math.PI * 2); g.fill(); // ear
  g.lineWidth = s * 0.1; g.lineCap = 'round';
  g.beginPath(); g.moveTo(s * 0.64, -s * 0.6); g.quadraticCurveTo(s * 0.78, -s * 0.3, s * 0.7, -s * 0.06); g.stroke(); // trunk
  g.lineWidth = s * 0.04;
  g.beginPath(); g.moveTo(s * 0.6, -s * 0.48); g.lineTo(s * 0.78, -s * 0.44); g.stroke(); // tusk
  if (rider) {
    g.beginPath(); g.ellipse(s * 0.05, -s * 0.9, s * 0.11, s * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(s * 0.06, -s * 1.1, s * 0.07, 0, Math.PI * 2); g.fill();
    g.fillRect(-s * 0.3, -s * 0.86, s * 0.6, s * 0.06); // howdah cloth
  }
  g.restore();
}

function horse(g: G, x: number, y: number, s: number, dir: number, rider: boolean, gallop: boolean) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.beginPath(); g.ellipse(0, -s * 0.5, s * 0.38, s * 0.17, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.07; g.lineCap = 'round';
  const legs = gallop ? [[-0.3, -0.45, -0.52, -0.2], [-0.2, -0.45, -0.3, -0.05], [0.25, -0.45, 0.5, -0.3], [0.3, -0.45, 0.42, -0.12]]
    : [[-0.3, -0.45, -0.3, 0], [-0.18, -0.45, -0.2, 0], [0.22, -0.45, 0.24, 0], [0.32, -0.45, 0.34, 0]];
  for (const [a, b, c, d] of legs) { g.beginPath(); g.moveTo(a * s, b * s); g.lineTo(c * s, d * s); g.stroke(); }
  g.lineWidth = s * 0.13;
  g.beginPath(); g.moveTo(s * 0.28, -s * 0.55); g.lineTo(s * 0.44, -s * 0.85); g.stroke(); // neck
  g.beginPath(); g.ellipse(s * 0.52, -s * 0.84, s * 0.13, s * 0.06, 0.6, 0, Math.PI * 2); g.fill(); // head
  g.lineWidth = s * 0.05;
  g.beginPath(); g.moveTo(-s * 0.36, -s * 0.55); g.quadraticCurveTo(-s * 0.55, -s * 0.5, -s * 0.5, -s * 0.25); g.stroke(); // tail
  if (rider) {
    g.beginPath(); g.ellipse(-s * 0.02, -s * 0.78, s * 0.09, s * 0.16, -0.15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, -s * 0.98, s * 0.065, 0, Math.PI * 2); g.fill();
    g.lineWidth = s * 0.04;
    g.beginPath(); g.moveTo(s * 0.05, -s * 0.84); g.lineTo(s * 0.4, -s * 1.08); g.stroke(); // raised spear
  }
  g.restore();
}

function person(g: G, x: number, y: number, s: number, pose: number) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.ellipse(0, -s * 0.62, s * 0.11, s * 0.2, 0, 0, Math.PI * 2); g.fill(); // torso
  g.beginPath(); g.arc(0, -s * 0.9, s * 0.08, 0, Math.PI * 2); g.fill(); // head
  g.lineWidth = s * 0.07; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-s * 0.04, -s * 0.45); g.lineTo(-s * 0.12 - pose * 0.08 * s, 0); g.stroke();
  g.beginPath(); g.moveTo(s * 0.04, -s * 0.45); g.lineTo(s * 0.12 + pose * 0.1 * s, 0); g.stroke();
  g.lineWidth = s * 0.05;
  if (pose > 0.5) { // dancer / archer: arms raised
    g.beginPath(); g.moveTo(-s * 0.08, -s * 0.74); g.lineTo(-s * 0.26, -s * 0.95); g.stroke();
    g.beginPath(); g.moveTo(s * 0.08, -s * 0.74); g.lineTo(s * 0.28, -s * 0.62); g.stroke();
  } else { // folded hands
    g.beginPath(); g.moveTo(-s * 0.08, -s * 0.72); g.lineTo(0, -s * 0.66); g.lineTo(s * 0.08, -s * 0.72); g.stroke();
  }
  g.restore();
}

function lingamShrine(g: G, x: number, y: number, s: number) {
  g.save(); g.translate(x, y);
  g.fillRect(-s * 0.32, -s * 0.12, s * 0.64, s * 0.12); // pedestal
  g.beginPath(); g.moveTo(-s * 0.26, -s * 0.12); g.lineTo(s * 0.32, -s * 0.12); g.lineTo(s * 0.26, -s * 0.24); g.lineTo(-s * 0.2, -s * 0.24); g.fill(); // yoni
  g.fillRect(s * 0.26, -s * 0.22, s * 0.16, s * 0.05); // spout
  g.beginPath(); g.roundRect(-s * 0.1, -s * 0.56, s * 0.2, s * 0.34, [s * 0.1, s * 0.1, 0, 0]); g.fill(); // lingam
  g.lineWidth = s * 0.06; // pavilion frame
  g.beginPath(); g.moveTo(-s * 0.45, 0); g.lineTo(-s * 0.45, -s * 0.75); g.quadraticCurveTo(0, -s * 1.05, s * 0.45, -s * 0.75); g.lineTo(s * 0.45, 0); g.stroke();
  g.restore();
}

function rosette(g: G, x: number, y: number, r: number) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.2, a, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.arc(x, y, r * 0.24, 0, Math.PI * 2); g.fill();
}

function hamsa(g: G, x: number, y: number, s: number, dir: number) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.beginPath(); g.ellipse(0, -s * 0.25, s * 0.3, s * 0.16, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.08; g.lineCap = 'round';
  g.beginPath(); g.moveTo(s * 0.2, -s * 0.3); g.quadraticCurveTo(s * 0.4, -s * 0.45, s * 0.3, -s * 0.62); g.stroke();
  g.beginPath(); g.ellipse(s * 0.36, -s * 0.64, s * 0.08, s * 0.05, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-s * 0.3, -s * 0.28); g.quadraticCurveTo(-s * 0.5, -s * 0.5, -s * 0.36, -s * 0.6); g.stroke(); // tail plume
  g.restore();
}

function deer(g: G, x: number, y: number, s: number, dir: number) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.beginPath(); g.ellipse(0, -s * 0.45, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.05; g.lineCap = 'round';
  for (const lx of [-0.22, -0.12, 0.16, 0.24]) { g.beginPath(); g.moveTo(lx * s, -s * 0.4); g.lineTo(lx * s + s * 0.02, 0); g.stroke(); }
  g.lineWidth = s * 0.08;
  g.beginPath(); g.moveTo(s * 0.22, -s * 0.5); g.lineTo(s * 0.32, -s * 0.72); g.stroke();
  g.beginPath(); g.ellipse(s * 0.38, -s * 0.74, s * 0.09, s * 0.045, 0.3, 0, Math.PI * 2); g.fill();
  g.lineWidth = s * 0.025;
  g.beginPath(); g.moveTo(s * 0.32, -s * 0.78); g.lineTo(s * 0.26, -s * 0.98); g.lineTo(s * 0.18, -s * 1.02); g.stroke();
  g.restore();
}

function lion(g: G, x: number, y: number, s: number, dir: number) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.beginPath(); g.ellipse(-s * 0.05, -s * 0.42, s * 0.36, s * 0.16, -0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(s * 0.32, -s * 0.62, s * 0.18, 0, Math.PI * 2); g.fill(); // mane
  g.lineWidth = s * 0.08; g.lineCap = 'round';
  for (const [a, b] of [[-0.3, -0.36], [-0.18, -0.2], [0.22, 0.32], [0.3, 0.42]]) { g.beginPath(); g.moveTo(a * s, -s * 0.35); g.lineTo(b * s, 0); g.stroke(); }
  g.lineWidth = s * 0.04;
  g.beginPath(); g.moveTo(-s * 0.4, -s * 0.45); g.quadraticCurveTo(-s * 0.6, -s * 0.8, -s * 0.45, -s * 0.85); g.stroke();
  g.restore();
}

/** Outer-wall reliefs: 8 m × 4 m tile, six courses of 0.667 m. */
export function prakara(seed = 5): Relief {
  const PX = 256; // px per metre
  const W = 8 * PX, H = 4 * PX;
  const { g } = canvas(W, H);
  const rnd = prng(seed);
  const rows = 5, rh = H / rows;
  const blocks: { x0: number; x1: number; y0: number; y1: number; tone: number; grey: number }[] = [];
  g.fillStyle = grey(0.62);
  g.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh, y1 = y0 + rh;
    const rowCarved = r % 2 === 0 || rnd() < 0.3; // about half the courses carry panels, the rest plain ashlar
    let x = Math.floor(rnd() * 0.8 * PX);
    const xStart = x;
    while (x < xStart + W) {
      const len = Math.round((1.3 + rnd() * 1.9) * PX);
      const x1 = Math.min(x + len, xStart + W);
      blocks.push({ x0: x, x1, y0, y1, tone: rnd(), grey: rnd() });
      // the block (drawn twice across the seam so the tile wraps)
      for (const off of [0, -W]) {
        const bx0 = x + off, bx1 = x1 + off;
        if (bx1 < 0 || bx0 > W) continue;
        g.save();
        g.beginPath(); g.rect(bx0, y0, bx1 - bx0, rh); g.clip();
        const carved = rowCarved && rnd() < 0.85;
        if (carved) {
          const m = PX * 0.07;
          g.fillStyle = grey(0.62);
          g.fillRect(bx0, y0, bx1 - bx0, rh);
          g.fillStyle = grey(0.3); // sunk field
          g.fillRect(bx0 + m, y0 + m, bx1 - bx0 - 2 * m, rh - 2 * m);
          g.strokeStyle = grey(0.5);
          g.lineWidth = 5;
          g.strokeRect(bx0 + m * 0.5, y0 + m * 0.5, bx1 - bx0 - m, rh - m);
          // figures standing on the field's baseline
          const base = y1 - m - 2, fh = rh - 2 * m - 10;
          g.fillStyle = grey(0.66 + rnd() * 0.12);
          g.strokeStyle = g.fillStyle;
          const span = bx1 - bx0 - 2 * m;
          const kind = rnd();
          const dir = rnd() < 0.5 ? 1 : -1;
          if (kind < 0.24) { // elephant procession
            const n = Math.max(1, Math.floor(span / (fh * 1.25)));
            for (let k = 0; k < n; k++) elephant(g, bx0 + m + (k + 0.5) * span / n, base, fh * 0.92, dir, rnd() < 0.5);
          } else if (kind < 0.46) { // cavalry
            const n = Math.max(1, Math.floor(span / (fh * 1.15)));
            for (let k = 0; k < n; k++) horse(g, bx0 + m + (k + 0.5) * span / n, base, fh * 0.9, dir, rnd() < 0.8, rnd() < 0.5);
          } else if (kind < 0.6) { // worship at a lingam shrine
            const cx = bx0 + m + span * (0.3 + rnd() * 0.4);
            lingamShrine(g, cx, base, fh * 0.95);
            for (let k = 1; k <= 3; k++) { if (cx - k * fh * 0.4 > bx0 + m + fh * 0.2) person(g, cx - k * fh * 0.42, base, fh * 0.85, 0); }
            for (let k = 1; k <= 2; k++) { if (cx + k * fh * 0.45 < bx1 - m - fh * 0.2) person(g, cx + k * fh * 0.45, base, fh * 0.85, 0); }
          } else if (kind < 0.7) { // dancers and musicians
            const n = Math.max(2, Math.floor(span / (fh * 0.45)));
            for (let k = 0; k < n; k++) person(g, bx0 + m + (k + 0.5) * span / n, base, fh * 0.88, rnd());
          } else if (kind < 0.8) { // hunters, deer, lions
            const n = Math.max(1, Math.floor(span / (fh * 1.0)));
            for (let k = 0; k < n; k++) {
              const cx = bx0 + m + (k + 0.5) * span / n;
              const t = rnd();
              if (t < 0.4) deer(g, cx, base, fh * 0.8, dir); else if (t < 0.7) lion(g, cx, base, fh * 0.8, dir); else person(g, cx, base, fh * 0.85, 1);
            }
          } else if (kind < 0.9) { // hamsa frieze
            const n = Math.max(2, Math.floor(span / (fh * 0.7)));
            for (let k = 0; k < n; k++) hamsa(g, bx0 + m + (k + 0.5) * span / n, base, fh * 0.7, dir);
          } else { // lotus rosettes
            const n = Math.max(1, Math.floor(span / (fh * 1.1)));
            for (let k = 0; k < n; k++) rosette(g, bx0 + m + (k + 0.5) * span / n, y0 + rh / 2, fh * 0.42);
          }
        } else {
          g.fillStyle = grey(0.6 + rnd() * 0.06);
          g.fillRect(bx0, y0, bx1 - bx0, rh);
        }
        g.restore();
        // joints
        g.fillStyle = grey(0.38);
        g.fillRect(bx0 - 2, y0, 4, rh);
      }
      x = x1;
    }
    g.fillStyle = grey(0.38);
    g.fillRect(0, y0 - 2, W, 4);
  }
  const h = readHeight(g, W, H);
  blur(h, W, H, 3);
  blur(h, W, H, 2);
  // weathering: pitting, grain and broad erosion of the quartzite
  const n2 = prng(seed + 3);
  const coarse = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) coarse[i] = n2();
  blur(coarse, W, H, 10);
  for (let i = 0; i < h.length; i++) h[i] += (n2() - 0.5) * 0.11 + (coarse[i] - 0.5) * 0.6;
  blur(h, W, H, 1);
  const { ao, t: aoT } = aoTex(h, W, H, 1.1, 8);
  // colour: rust-ochre quartzite, some blocks greyer / weathered, darker in the carved recesses
  const blockAt = new Int32Array(W * H).fill(-1);
  blocks.forEach((b, k) => {
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) blockAt[y * W + (x % W)] = k;
  });
  const n3 = prng(seed + 9);
  const color = tex(mk(W, H, (i) => {
    const b = blocks[blockAt[i]] ?? blocks[0];
    const ochre: [number, number, number] = [150, 116, 92], greyB: [number, number, number] = [112, 104, 96];
    const t = b.grey < 0.35 ? 0.75 : b.grey < 0.6 ? 0.35 : 0.08;
    const x = i % W, yy = Math.floor(i / W);
    // black lichen and rain streaks running down from the course joints
    const streak = Math.max(0, Math.sin(x * 0.037 + Math.sin(x * 0.011) * 3) * Math.sin(x * 0.0093 + 1.3)) * (0.5 + 0.5 * Math.sin(yy * 0.02 + x * 0.003));
    const k = (0.8 + b.tone * 0.24) * (0.45 + 0.55 * ao[i]) * (0.92 + n3() * 0.12) * (1 - 0.35 * streak * streak);
    return [(ochre[0] + (greyB[0] - ochre[0]) * t) * k, (ochre[1] + (greyB[1] - ochre[1]) * t) * k, (ochre[2] + (greyB[2] - ochre[2]) * t) * k];
  }), true);
  return { normal: normalTex(h, W, H, 13), ao: aoT, color };
}

/** Repoussé bands of the gilded vimana: beads, downward lotus petals, scroll and a fillet; tile 1 m × 0.75 m. */
export function goldBands(): Relief {
  const W = 256, H = 192;
  const { g } = canvas(W, H);
  g.fillStyle = grey(0.5); g.fillRect(0, 0, W, H);
  g.fillStyle = grey(0.9);
  g.fillRect(0, 6, W, 10); // top fillet
  for (let x = 6; x < W; x += 13) { g.beginPath(); g.arc(x, 28, 5, 0, Math.PI * 2); g.fill(); } // beads
  for (let x = 0; x < W + 20; x += 21) { // petals
    g.beginPath(); g.ellipse(x, 62, 9, 20, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = grey(0.35); g.fillRect(0, 88, W, 6);
  g.strokeStyle = grey(0.95); g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); // scroll
  for (let x = 0; x <= W; x += 2) { const y = 120 + Math.sin((x / W) * Math.PI * 8) * 12; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  for (let k = 0; k < 8; k++) { const x = (k + 0.25) * W / 8; g.beginPath(); g.arc(x, 120 + 12 * (k % 2 ? 1 : -1) * 0.2, 7, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = grey(0.85); g.fillRect(0, 150, W, 12);
  g.fillStyle = grey(0.3); g.fillRect(0, 168, W, 24);
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  const { t } = aoTex(h, W, H, 0.6, 4);
  return { normal: normalTex(h, W, H, 6), ao: t, color: t };
}

/** Diamond trellis of the gold dome cap; tile 0.5 m. */
export function lattice(): Relief {
  const W = 128, H = 128;
  const { g } = canvas(W, H);
  g.fillStyle = grey(0.35); g.fillRect(0, 0, W, H);
  g.strokeStyle = grey(0.95); g.lineWidth = 7;
  for (let k = -2; k <= 2; k++) {
    g.beginPath(); g.moveTo(k * W / 2, 0); g.lineTo(k * W / 2 + W, H); g.stroke();
    g.beginPath(); g.moveTo(k * W / 2 + W, 0); g.lineTo(k * W / 2, H); g.stroke();
  }
  g.fillStyle = grey(0.8);
  for (const [x, y] of [[W / 2, H / 4], [0, H * 0.75], [W, H * 0.75], [W / 2, H * 1.25], [W / 2, -H * 0.75 + H]]) { g.beginPath(); g.arc(x, y - (H / 4), 9, 0, Math.PI * 2); g.fill(); }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  const { t } = aoTex(h, W, H, 0.6, 4);
  return { normal: normalTex(h, W, H, 6), ao: t, color: t };
}

/** Fine stucco ornament of the gopuram tiers: pilaster flutes, bead strings, small medallions; tile 1 m. */
export function stucco(): Relief {
  const W = 256, H = 256;
  const { g } = canvas(W, H);
  g.fillStyle = grey(0.5); g.fillRect(0, 0, W, H);
  g.fillStyle = grey(0.75);
  for (let x = 0; x < W; x += 64) { g.fillRect(x + 4, 0, 10, H); g.fillRect(x + 20, 0, 4, H); }
  g.fillStyle = grey(0.85);
  for (let y = 30; y < H; y += 64) for (let x = 40; x < W; x += 64) { g.beginPath(); g.arc(x + 4, y, 9, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = grey(0.3);
  for (let y = 0; y < H; y += 64) g.fillRect(0, y + 58, W, 4);
  const h = readHeight(g, W, H);
  blur(h, W, H, 3);
  const n = prng(31);
  for (let i = 0; i < h.length; i++) h[i] += (n() - 0.5) * 0.06;
  blur(h, W, H, 1);
  const { t } = aoTex(h, W, H, 0.5, 6);
  return { normal: normalTex(h, W, H, 4), ao: t, color: t };
}

/** Carved pillar faces: a framed lotus medallion over a band of petals; tile 0.6 m. */
export function pillar(): Relief {
  const W = 192, H = 192;
  const { g } = canvas(W, H);
  g.fillStyle = grey(0.55); g.fillRect(0, 0, W, H);
  g.strokeStyle = grey(0.85); g.lineWidth = 8;
  g.strokeRect(14, 14, W - 28, H - 70);
  g.fillStyle = grey(0.3); g.fillRect(24, 24, W - 48, H - 90);
  g.fillStyle = grey(0.9);
  rosette(g, W / 2, 24 + (H - 90) / 2, 40);
  for (let x = 8; x < W; x += 22) { g.beginPath(); g.ellipse(x, H - 28, 9, 18, 0, 0, Math.PI * 2); g.fill(); }
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  const { t } = aoTex(h, W, H, 0.8, 5);
  return { normal: normalTex(h, W, H, 6), ao: t, color: t };
}

/** Embossed gold door panels: framed lotus roundels with creeper borders; tile 0.6 m × 1.2 m. */
export function doorGold(): Relief {
  const W = 128, H = 256;
  const { g } = canvas(W, H);
  g.fillStyle = grey(0.45); g.fillRect(0, 0, W, H);
  g.strokeStyle = grey(0.95); g.lineWidth = 6;
  g.strokeRect(8, 8, W - 16, H / 2 - 16);
  g.strokeRect(8, H / 2 + 8, W - 16, H / 2 - 16);
  g.fillStyle = grey(0.95);
  rosette(g, W / 2, H / 4, 34);
  rosette(g, W / 2, (3 * H) / 4, 34);
  g.lineWidth = 3;
  g.beginPath();
  for (let y = 12; y < H; y += 2) { const x = 4 + Math.sin(y * 0.12) * 2.5; if (y === 12) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  const h = readHeight(g, W, H);
  blur(h, W, H, 2);
  const { t } = aoTex(h, W, H, 0.6, 4);
  return { normal: normalTex(h, W, H, 6), ao: t, color: t };
}

/** Painted stucco parapet: bands of temple red, a green creeper on cream, blue and ochre; 2 m × 1 m, y from 0 (bottom) to 1. */
export function painted(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe4c8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c23a2a'; g.fillRect(0, H - 40, W, 40); // bottom red band
  g.fillStyle = '#e2b13a'; g.fillRect(0, H - 52, W, 12);
  g.fillStyle = '#2f6fa8'; g.fillRect(0, 0, W, 26); // blue coping
  g.fillStyle = '#e2b13a'; g.fillRect(0, 26, W, 8);
  // green creeper with leaves on the cream field
  g.strokeStyle = '#2f7d3a'; g.lineWidth = 7;
  g.beginPath();
  for (let x = 0; x <= W; x += 2) { const y = 120 + Math.sin((x / W) * Math.PI * 8) * 36; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#3c9a46';
  for (let k = 0; k < 16; k++) {
    const x = (k + 0.5) * W / 16, y = 120 + Math.sin(((k + 0.5) / 16) * Math.PI * 8) * 36;
    g.beginPath(); g.ellipse(x, y + (k % 2 ? 26 : -26), 14, 7, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#c23a2a';
  for (let k = 0; k < 8; k++) { g.beginPath(); g.arc((k + 0.25) * W / 8, 120 + (k % 2 ? 30 : -30), 9, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

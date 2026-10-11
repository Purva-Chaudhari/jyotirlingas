import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from '../../engine/materials';
import { box, archPanelGeometry, type Physics, type Flames } from '../../engine/kit';
import type { MahakalMats } from './mats';
import { buildPriests } from './priests';
import { Marigolds } from './marigold';

/**
 * The garbhagriha of Shri Mahakaleshwar, after the temple trust's photographs (2024–25):
 *
 *  - walls sheathed in silver: a lower field of embossed quatrefoil rosettes on a diagonal
 *    grid, a scrolling floral band, then a row of cusped-arch panels each holding one
 *    emblem (swastika, conch, lotus, trishul, kalash, damaru, ॐ), and a niche of Devi above
 *    the lingam on the north wall
 *  - a white marble floor in large slabs; a dark ceiling ringed with square lights
 *  - the jalahari: a broad, many-sided silver basin (~2.9 m across, ~0.5 m high) whose wall is
 *    pierced silver panels between turned posts, a flat rim studded with round bosses, inner
 *    concentric rings, and the spout (nirgam) to the north
 *  - the Jyotirlinga, dakshinamukhi (facing south, +z): ~0.68 m across and ~1.05 m tall above the
 *    basin, near-black wet stone with sindoor smears, pitted, with a curved bhasma tripundra, a chandan
 *    and kumkum tilak, and a crown of bel leaves, roses and marigolds
 *  - the silver jaldhari kalash hung on a chain above, dripping a thin stream
 *  - a tall silver trishul (north-east corner) and two massive fluted silver deepstambhas either side
 *    of the south doorway (the silver Nag is a festival shringar, so it is not shown daily)
 *
 * Sizes are real-world metres against the 1.62 m eye height of the pilgrim.
 */

// ---------- procedural textures ----------

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

/**
 * 1 m square of the lower wall (sanctum_wide): a raised lattice of interlocking quatrefoils — every
 * cell a four-lobed outline in chased silver, a small boss at its centre and a four-point star where
 * the cells meet (height map, light = raised).
 */
function latticeCanvas() {
  return canvas(512, 512, (g) => {
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, 512, 512);
    const n = 6, step = 512 / n;
    g.lineCap = 'round';
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const cx = i * step + step / 2, cy = j * step + step / 2;
        // four-lobed outline: four arcs on the cell's half-diagonals
        const lobe = step * 0.2, off = step * 0.2;
        for (const [w, col] of [[9, '#5a5a5a'], [5, '#eeeeee']] as const) {
          g.strokeStyle = col;
          g.lineWidth = w;
          g.beginPath();
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2;
            const px = cx + Math.cos(a) * off, py = cy + Math.sin(a) * off;
            g.moveTo(px + Math.cos(a - Math.PI / 2) * lobe, py + Math.sin(a - Math.PI / 2) * lobe);
            g.arc(px, py, lobe, a - Math.PI / 2, a + Math.PI / 2);
          }
          g.stroke();
        }
        // centre boss with a soft highlight
        const gr = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, step * 0.08);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, '#9a9a9a');
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, step * 0.075, 0, Math.PI * 2); g.fill();
        // four-point star where four cells meet
        const sx = i * step, sy = j * step, r = step * 0.13;
        g.fillStyle = '#d6d6d6';
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, rr = k % 2 ? r * 0.35 : r;
          if (k === 0) g.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); else g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
    }
  });
}

/** 2.4 m square silver ceiling panel engraved with lines of Sanskrit verse (height map, light = raised). */
function ceilingTextCanvas() {
  return canvas(1024, 1024, (g) => {
    g.fillStyle = '#a8a8a8';
    g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 14;
    g.strokeRect(20, 20, 984, 984);
    g.lineWidth = 5;
    g.strokeRect(48, 48, 928, 928);
    const lines = [
      'ॐ नमः शिवाय महाकालाय नमः', 'नमस्ते अस्तु भगवन् विश्वेश्वराय', 'महादेवाय त्र्यम्बकाय त्रिपुरान्तकाय',
      'त्रिकाग्निकालाय कालाग्निरुद्राय', 'नीलकण्ठाय मृत्युञ्जयाय सर्वेश्वराय', 'सदाशिवाय श्रीमन्महादेवाय नमः',
      'उज्जयिन्यां महाकालम् ओंकारम् अमलेश्वरम्',
    ];
    g.fillStyle = '#f2f2f2';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 64px "Kohinoor Devanagari", "Noto Sans Devanagari", serif';
    lines.forEach((t, i) => g.fillText(t, 512, 150 + i * 118, 880));
  });
}

/** The jalahari's inner basin seen from above (u, v across the oval): chased silver bands of petals and
 *  rosettes round the linga. `colour` adds the day's sindoor smears, rice and flower debris. */
function basinCanvas(colour: boolean) {
  return canvas(1024, 1024, (g) => {
    g.fillStyle = colour ? '#a9abb0' : '#7a7a7a';
    g.fillRect(0, 0, 1024, 1024);
    const C = 512;
    // concentric bands (normalised radius 0..1 = the rim): grooves, then a petal row inside each band
    const bands = [0.98, 0.84, 0.68, 0.52, 0.38];
    bands.forEach((r, bi) => {
      g.strokeStyle = colour ? '#8e9095' : '#3a3a3a';
      g.lineWidth = colour ? 6 : 10;
      g.beginPath(); g.arc(C, C, r * 500, 0, Math.PI * 2); g.stroke();
      const r2 = bands[bi + 1];
      if (!r2) return;
      const mid = ((r + r2) / 2) * 500, w = ((r - r2) / 2) * 500 * 0.8;
      const n = Math.round((mid * Math.PI * 2) / (w * 1.25));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        g.save();
        g.translate(C + Math.cos(a) * mid, C + Math.sin(a) * mid);
        g.rotate(a);
        const gr = g.createRadialGradient(-w * 0.2, -w * 0.2, 0, 0, 0, w);
        gr.addColorStop(0, colour ? '#dfe1e6' : '#f0f0f0');
        gr.addColorStop(1, colour ? '#a9abb0' : '#888888');
        g.fillStyle = gr;
        g.beginPath();
        if (bi % 2) g.ellipse(0, 0, w * 0.95, w * 0.42, 0, 0, Math.PI * 2);
        else { g.arc(0, 0, w * 0.6, 0, Math.PI * 2); }
        g.fill();
        g.restore();
      }
    });
    if (!colour) return;
    let seed = 21;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // sindoor smears and streaks running toward the spout (north = v up the canvas, i.e. y small)
    for (let k = 0; k < 70; k++) {
      const a = rnd() * Math.PI * 2, rr = (0.3 + rnd() * 0.65) * 500;
      const x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr;
      g.fillStyle = `rgba(216,84,30,${0.25 + rnd() * 0.45})`;
      g.beginPath(); g.ellipse(x, y, 6 + rnd() * 26, 3 + rnd() * 9, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    // wet darker sheen in the channel round the linga and toward the spout
    const wet = g.createRadialGradient(C, C, 150, C, C, 300);
    wet.addColorStop(0, 'rgba(60,62,66,0.35)');
    wet.addColorStop(1, 'rgba(60,62,66,0)');
    g.fillStyle = wet;
    g.fillRect(0, 0, 1024, 1024);
    // rice grains and petals
    for (let k = 0; k < 400; k++) {
      const a = rnd() * Math.PI * 2, rr = (0.3 + rnd() * 0.68) * 500;
      g.fillStyle = rnd() < 0.6 ? 'rgba(245,240,225,0.9)' : rnd() < 0.5 ? 'rgba(230,150,20,0.9)' : 'rgba(170,20,50,0.9)';
      g.fillRect(C + Math.cos(a) * rr, C + Math.sin(a) * rr, 3 + rnd() * 4, 2 + rnd() * 3);
    }
  });
}

/** 5.6 m × 1.3 m strip: scroll band below, six cusped-arch emblem panels, scroll band above. */
function panelStripCanvas() {
  const W = 2048, H = 476;
  return canvas(W, H, (g) => {
    g.fillStyle = '#a2a2a2';
    g.fillRect(0, 0, W, H);
    const band = (y: number, h: number) => {
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, y, W, h);
      g.strokeStyle = '#e6e6e6';
      g.lineWidth = 5;
      g.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const yy = y + h / 2 + Math.sin((x / W) * Math.PI * 2 * 18) * h * 0.28;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
      for (let k = 0; k < 36; k++) {
        const x = ((k + 0.25) / 36) * W, yy = y + h / 2 + (k % 2 ? -1 : 1) * h * 0.22;
        g.fillStyle = '#f0f0f0';
        g.beginPath(); g.arc(x, yy, h * 0.16, 0, Math.PI * 2); g.fill();
      }
    };
    band(0, 60);
    band(H - 60, 60);
    const n = 6, pw = W / n, top = 70, bot = H - 70;
    const emblems = ['swastika', 'shankh', 'lotus', 'trishul', 'kalash', 'om'];
    for (let i = 0; i < n; i++) {
      const x0 = i * pw + 14, x1 = (i + 1) * pw - 14, cx = (x0 + x1) / 2;
      // raised frame with a cusped (shouldered) arch head
      const arch = (inset: number) => {
        g.beginPath();
        g.moveTo(x0 + inset, bot - inset);
        g.lineTo(x0 + inset, top + 80);
        g.quadraticCurveTo(x0 + inset, top + inset + 30, cx - 60, top + inset + 26);
        g.quadraticCurveTo(cx - 20, top + inset + 22, cx, top + inset);
        g.quadraticCurveTo(cx + 20, top + inset + 22, cx + 60, top + inset + 26);
        g.quadraticCurveTo(x1 - inset, top + inset + 30, x1 - inset, top + 80);
        g.lineTo(x1 - inset, bot - inset);
        g.closePath();
      };
      g.fillStyle = '#d8d8d8'; arch(0); g.fill();
      g.fillStyle = '#9a9a9a'; arch(16); g.fill();
      const cy = (top + bot) / 2 + 20, r = 85;
      g.strokeStyle = '#f4f4f4';
      g.fillStyle = '#e2e2e2';
      g.lineWidth = 18;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const e = emblems[i];
      g.beginPath();
      if (e === 'swastika') {
        g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
        g.moveTo(cx + r, cy); g.lineTo(cx + r, cy + r * 0.7); g.moveTo(cx - r, cy); g.lineTo(cx - r, cy - r * 0.7);
        g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.7, cy - r); g.moveTo(cx, cy + r); g.lineTo(cx - r * 0.7, cy + r);
        g.stroke();
      } else if (e === 'shankh') {
        g.ellipse(cx, cy, r * 0.5, r, -0.6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#8a8a8a'; g.lineWidth = 8;
        g.beginPath(); g.arc(cx - 10, cy - 10, r * 0.35, 0, Math.PI * 1.6); g.stroke();
      } else if (e === 'lotus') {
        for (let k = -3; k <= 3; k++) {
          g.beginPath();
          g.ellipse(cx + k * 22, cy + 20 - Math.abs(k) * 6, 26, r * (1 - Math.abs(k) * 0.12), k * 0.28, 0, Math.PI * 2);
          g.fill();
        }
      } else if (e === 'trishul') {
        g.moveTo(cx, cy + r * 1.1); g.lineTo(cx, cy - r);
        g.moveTo(cx - r * 0.6, cy - r * 0.7); g.quadraticCurveTo(cx - r * 0.6, cy - r * 0.05, cx, cy - r * 0.05);
        g.quadraticCurveTo(cx + r * 0.6, cy - r * 0.05, cx + r * 0.6, cy - r * 0.7);
        g.stroke();
      } else if (e === 'kalash') {
        g.ellipse(cx, cy + 25, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(cx - r * 0.3, cy - r * 0.45, r * 0.6, r * 0.25);
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx + k * 22, cy - r * 0.75, 12, r * 0.35, k * 0.35, 0, Math.PI * 2); g.fill(); }
      } else {
        g.font = '700 190px "Kohinoor Devanagari", "Noto Sans Devanagari", serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('ॐ', cx, cy + 10);
      }
    }
  });
}

/** 1.2 m marble slab: white with soft grey veins and a fine grout line. */
function marbleCanvas() {
  return canvas(512, 512, (g) => {
    g.fillStyle = '#f1efeb';
    g.fillRect(0, 0, 512, 512);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let v = 0; v < 9; v++) {
      g.strokeStyle = `rgba(120,118,115,${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath();
      let x = rnd() * 512, y = 0;
      g.moveTo(x, y);
      while (y < 512) { x += (rnd() - 0.45) * 40; y += 12 + rnd() * 20; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 2500; k++) {
      g.fillStyle = `rgba(150,145,140,${rnd() * 0.05})`;
      g.fillRect(rnd() * 512, rnd() * 512, 2, 2);
    }
    g.strokeStyle = 'rgba(150,140,130,0.6)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 512, 512);
  });
}

/** Lingam surface colour (u around, v up): dark maroon-brown stone, mottled, kumkum-reddened crown. */
function lingamCanvas() {
  return canvas(512, 512, (g) => {
    g.fillStyle = '#3a2119'; // dark reddish-brown
    g.fillRect(0, 0, 512, 512);
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 900; k++) {
      const x = rnd() * 512, y = rnd() * 512, r = 2 + rnd() * 16;
      const dark = rnd() < 0.55;
      g.fillStyle = dark ? `rgba(10,6,5,${0.25 + rnd() * 0.35})` : `rgba(70,34,24,${0.04 + rnd() * 0.1})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // reddened crown from kumkum and sindoor (top ~25% of the texture)
    const gr = g.createLinearGradient(0, 0, 0, 140);
    gr.addColorStop(0, 'rgba(150,28,22,0.55)');
    gr.addColorStop(1, 'rgba(150,28,22,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 140);
    // sindoor smears dragged down from the crown on the front
    for (const ox of [0, 512]) {
      for (let k = 0; k < 7; k++) {
        const x = ox + (rnd() - 0.5) * 120, w = 10 + rnd() * 18;
        const sg = g.createLinearGradient(0, 60, 0, 170 + rnd() * 60);
        sg.addColorStop(0, `rgba(175,30,24,${0.4 + rnd() * 0.3})`);
        sg.addColorStop(1, 'rgba(175,30,24,0)');
        g.fillStyle = sg;
        g.fillRect(x - w / 2, 60, w, 180);
      }
    }
    // pale bhasma/milk residue streaks running down
    for (let k = 0; k < 40; k++) {
      const x = rnd() * 512, len = 40 + rnd() * 200;
      g.strokeStyle = `rgba(200,190,175,${0.03 + rnd() * 0.06})`;
      g.lineWidth = 2 + rnd() * 6;
      g.beginPath(); g.moveTo(x, 40 + rnd() * 80); g.lineTo(x + (rnd() - 0.5) * 8, 120 + len); g.stroke();
    }
    // the south face sits at u = 0 (and 1): draw there and again one width to the right so it wraps.
    // chandan (yellow-orange sandal paste) tripundra: three thick, uneven finger strokes,
    // and rows of short daubs across the face as in the trust's photographs
    const stroke = (x0: number, x1: number, y: number, w: number, sag: number) => {
      for (let pass = 0; pass < 3; pass++) {
        g.strokeStyle = pass === 0 ? 'rgba(205,95,20,0.75)' : `rgba(236,${175 + Math.round(rnd() * 25)},45,${0.6 + rnd() * 0.3})`;
        g.lineWidth = w * (pass === 0 ? 1.15 : 0.8 + rnd() * 0.2);
        g.lineCap = 'round';
        g.beginPath();
        const n = 12;
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = x0 + (x1 - x0) * t, yy = y + Math.sin(t * Math.PI) * sag + (rnd() - 0.5) * 2.5;
          if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
      }
    };
    void stroke; // markings are raised geometry now (see buildSanctum)
  });
}

/** Pierced silver panel of the jalahari rail (sanctum_wide): a sun-rosette — a face boss ringed by
 *  pointed rays inside a beaded ring — with scrolling leaves in the corners (white = metal). */
function jalahariJaliCanvas() {
  return canvas(256, 256, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 244, 244);
    // the sun: boss, ring, sixteen pointed rays
    g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7;
    g.beginPath(); g.arc(128, 128, 44, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r0 = 44, r1 = k % 2 ? 84 : 100;
      g.beginPath();
      g.moveTo(128 + Math.cos(a - 0.12) * r0, 128 + Math.sin(a - 0.12) * r0);
      g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
      g.lineTo(128 + Math.cos(a + 0.12) * r0, 128 + Math.sin(a + 0.12) * r0);
      g.fill();
    }
    g.lineWidth = 5;
    g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
    // corner leaf scrolls tying the ring to the frame
    for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) {
      g.lineWidth = 7;
      g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x, y); g.lineTo(128 + (x - 128) * 0.6, 128 + (y - 128) * 0.6); g.stroke();
    }
  });
}

function tex(c: HTMLCanvasElement, srgb: boolean, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A vertical wall plane `len` × `h` with UVs in metres / tile, facing `ry`. */
function wallPlane(g: THREE.Group, mat: THREE.Material, len: number, h: number, x: number, y: number, z: number, ry: number, tileU: number, tileV: number) {
  const geo = new THREE.PlaneGeometry(len, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / tileU, (uv.getY(i) * h) / tileV);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

export function buildSanctum(
  g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames, FLOOR: number, CEIL: number, env: THREE.Texture,
) {
  const H = CEIL - FLOOR, R = 3.2;
  // the sanctum is lit by cool white LED panels as well as ghee lamps, so silver stays silver:
  // part-metallic so the white room light reads on it as well as the lamp-lit reflections
  const withEnv = <T extends THREE.MeshStandardMaterial>(m: T, k = 1.6) => { m.envMap = env; m.envMapIntensity = k; return m; };

  // ---------- materials (own, lamp-lit reflections) ----------
  const latT = latticeCanvas();
  const lattice = withEnv(new THREE.MeshStandardMaterial({
    color: 0xd9dde2, metalness: 0.85, roughness: 0.34, map: tex(latT, true), bumpMap: tex(latT, false), bumpScale: 3,
  }), 0.8);
  const stripC = panelStripCanvas();
  const strip = withEnv(new THREE.MeshStandardMaterial({
    color: 0xdde1e6, metalness: 0.85, roughness: 0.3, map: tex(stripC, true), bumpMap: tex(stripC, false), bumpScale: 3,
  }), 0.8);
  const silver = withEnv(new THREE.MeshStandardMaterial({ color: 0xdfe2e7, metalness: 0.85, roughness: 0.34 }), 0.75);
  const silverMatte = withEnv(new THREE.MeshStandardMaterial({ color: 0xd2d6db, metalness: 0.85, roughness: 0.4 }), 0.7);
  const silverDull = withEnv(new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.85, roughness: 0.4 }), 1.0);
  const jaliT = tex(jalahariJaliCanvas(), false);
  const jali = withEnv(new THREE.MeshStandardMaterial({
    color: 0xd9dde2, metalness: 0.85, roughness: 0.32, alphaMap: jaliT, alphaTest: 0.5, side: THREE.DoubleSide,
  }), 1.6);
  const marble = withEnv(new THREE.MeshPhysicalMaterial({
    map: tex(marbleCanvas(), true), roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25, color: 0xe6e3dc,
  }), 0.9);
  const lingamC = lingamCanvas();
  const lingamT = tex(lingamC, true), lingamB = tex(lingamC, false);
  // near-black wet stone with a soft sheen (not a mirror: lamps must not bloom on it)
  const lingamMat = withEnv(new THREE.MeshPhysicalMaterial({
    map: lingamT, bumpMap: lingamB, bumpScale: 5, color: 0xffffff, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.25,
  }), 0.8);
  // the jalahari's chased silver basin: petal and rosette bands, sindoor smears, wet
  const basinMat = withEnv(new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0.9, roughness: 0.3, map: tex(basinCanvas(true), true), bumpMap: tex(basinCanvas(false), false), bumpScale: 4,
  }), 0.9);
  // silver of the rail and coping: 0xc9ccd2, polished but not white
  const railSilver = withEnv(new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.9, roughness: 0.3 }), 0.9);
  const ceilBlack = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.6 });
  const ash = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 1 });
  const chandan = new THREE.MeshStandardMaterial({ color: 0xe8b84a, roughness: 0.8 });
  const kumkum = new THREE.MeshStandardMaterial({ color: 0xc0141c, roughness: 0.7 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x275a1c, roughness: 0.55, side: THREE.DoubleSide });
  const rose = new THREE.MeshStandardMaterial({ color: 0x9a0c34, roughness: 0.75 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe9a800, roughness: 0.9 });
  const water = new THREE.MeshPhysicalMaterial({ color: 0xeef4f6, roughness: 0.02, transparent: true, opacity: 0.45, transmission: 0, clearcoat: 1, envMap: env, envMapIntensity: 1.5 });
  const shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

  // ---------- floor, ceiling ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.8), marble);
  floor.geometry.attributes.uv.array.forEach((_, i, a) => { (a as Float32Array)[i] *= 6.8 / 1.2; });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR + 0.001;
  floor.receiveShadow = true;
  g.add(floor);
  box(g, M.marble, 6.8, 0.12, 6.8, 0, FLOOR - 0.12, 0);
  P.floor(g, -R, R, -R, R, FLOOR);
  // dark ceiling: a recessed centre and a ring of square lights
  // black stepped coffer frame (sanctum_wide): an outer band carrying the LED squares, a second band
  // stepping up, and the raised silver panel of engraved verses in the middle
  box(g, ceilBlack, 6.8, 0.2, 6.8, 0, CEIL, 0);
  box(g, ceilBlack, 6.8, 0.25, 0.9, 0, CEIL - 0.25, -R + 0.45);
  box(g, ceilBlack, 6.8, 0.25, 0.9, 0, CEIL - 0.25, R - 0.45);
  box(g, ceilBlack, 0.9, 0.25, 5.0, -R + 0.45, CEIL - 0.25, 0);
  box(g, ceilBlack, 0.9, 0.25, 5.0, R - 0.45, CEIL - 0.25, 0);
  box(g, ceilBlack, 5.0, 0.12, 0.6, 0, CEIL - 0.12, -1.9);
  box(g, ceilBlack, 5.0, 0.12, 0.6, 0, CEIL - 0.12, 1.9);
  box(g, ceilBlack, 0.6, 0.12, 3.2, -1.9, CEIL - 0.12, 0);
  box(g, ceilBlack, 0.6, 0.12, 3.2, 1.9, CEIL - 0.12, 0);
  {
    const tc = ceilingTextCanvas();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), withEnv(new THREE.MeshStandardMaterial({
      color: 0xc4c7cc, metalness: 0.85, roughness: 0.38, map: tex(tc, true), bumpMap: tex(tc, false), bumpScale: 2.5,
    }), 0.7));
    panel.geometry.rotateX(Math.PI / 2).rotateY(Math.PI); // faces down, lines read from the doorway
    { const uv = panel.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    panel.position.y = CEIL - 0.005;
    g.add(panel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.2 });
  const lights: THREE.Matrix4[] = [];
  for (let i = 0; i < 6; i++) {
    const t = -2.5 + i;
    lights.push(new THREE.Matrix4().makeTranslation(t, CEIL - 0.27, -R + 0.45), new THREE.Matrix4().makeTranslation(t, CEIL - 0.27, R - 0.45));
    if (i > 0 && i < 5) lights.push(new THREE.Matrix4().makeTranslation(-R + 0.45, CEIL - 0.27, t), new THREE.Matrix4().makeTranslation(R - 0.45, CEIL - 0.27, t));
  }
  const lp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.03, 0.3), lightMat, lights.length);
  lights.forEach((m, i) => lp.setMatrixAt(i, m));
  g.add(lp);

  // ---------- walls: structure (colliders) + silver sheathing in three registers ----------
  // north and west walls solid; the east wall now solid too (the way in is from the south);
  // the south wall has a wide open doorway so pilgrims in the antechamber face the lingam
  const DW = 1.3, DH = 2.7; // half-width and height of the south doorway
  box(g, silverDull, 6.8, H, 0.25, 0, FLOOR, -R - 0.12, P, 1);
  box(g, silverDull, 0.25, H, 6.8, -R - 0.12, FLOOR, 0, P, 1);
  box(g, silverDull, 0.25, H, 6.8, R + 0.12, FLOOR, 0, P, 1);
  box(g, silverDull, 3.4 - DW, H, 0.25, -(3.4 + DW) / 2, FLOOR, R + 0.12, P, 1);
  box(g, silverDull, 3.4 - DW, H, 0.25, (3.4 + DW) / 2, FLOOR, R + 0.12, P, 1);
  box(g, silverDull, DW * 2, H - DH, 0.25, 0, FLOOR + DH, R + 0.12, P, 1);
  const LAT_H = 1.5, STRIP_H = 1.3;
  const sheathe = (len: number, cx: number, cz: number, ry: number, from = 0, to = H) => {
    const lo = Math.max(from, 0), hi = Math.min(to, LAT_H);
    if (hi > lo) wallPlane(g, lattice, len, hi - lo, cx, FLOOR + lo, cz, ry, 1, 1);
    const s0 = Math.max(from, LAT_H), s1 = Math.min(to, LAT_H + STRIP_H);
    if (s1 > s0) wallPlane(g, strip, len, s1 - s0, cx, FLOOR + s0, cz, ry, 5.6, STRIP_H);
    const u0 = Math.max(from, LAT_H + STRIP_H);
    if (to > u0) wallPlane(g, lattice, len, to - u0, cx, FLOOR + u0, cz, ry, 1, 1);
  };
  const IN = R - 0.02;
  sheathe(6.4, 0, -IN, 0);                 // north (behind the lingam)
  sheathe(3.2 - DW, -(3.2 + DW) / 2, IN, Math.PI);   // south, either side of the doorway
  sheathe(3.2 - DW, (3.2 + DW) / 2, IN, Math.PI);
  sheathe(DW * 2, 0, IN, Math.PI, DH, H);
  sheathe(6.4, -IN, 0, Math.PI / 2);       // west
  sheathe(6.4, IN, 0, -Math.PI / 2);       // east
  // silver door frame of the south doorway, garlanded, with a pair of bells
  box(g, silver, 0.18, DH + 0.05, 0.36, -DW - 0.02, FLOOR, R + 0.1);
  box(g, silver, 0.18, DH + 0.05, 0.36, DW + 0.02, FLOOR, R + 0.1);
  box(g, silver, DW * 2 + 0.36, 0.2, 0.36, 0, FLOOR + DH, R + 0.1);
  const MG = new Marigolds();
  MG.strand(new THREE.Vector3(-DW, FLOOR + DH - 0.05, R + 0.3), new THREE.Vector3(DW, FLOOR + DH - 0.05, R + 0.3), 0.42, 'ooooooyyyyyy', 0.03);
  for (const sx of [-1, 1]) MG.strand(new THREE.Vector3(sx * DW, FLOOR + DH - 0.05, R + 0.3), new THREE.Vector3(sx * DW, FLOOR + DH - 0.9, R + 0.3), 0.02, 'oyw', 0.028, new THREE.Vector3(0, 0, 1));

  // the shrine of Devi on the north wall, above the linga (sanctum_wide, upper middle): a niche set in
  // a deep silver surround with a cusped arch, lit from within, holding the garlanded image of the
  // goddess on a silver pedestal — draped in red-orange, crowned, buried in marigold and jasmine
  {
    const z0 = -R + 0.02, y = FLOOR + 1.55, W = 0.74, Hn = 1.02, D = 0.3;
    // the surround: posts, sill and lintel projecting D from the wall, so the opening reads as recessed
    box(g, silver, 0.13, Hn + 0.12, D, -(W / 2 + 0.065), y - 0.06, z0 + D / 2);
    box(g, silver, 0.13, Hn + 0.12, D, W / 2 + 0.065, y - 0.06, z0 + D / 2);
    box(g, silver, W + 0.36, 0.1, D + 0.06, 0, y - 0.1, z0 + D / 2 + 0.03);
    box(g, silver, W + 0.36, 0.14, D + 0.04, 0, y + Hn, z0 + D / 2 + 0.02);
    const arch = new THREE.Mesh(archPanelGeometry(W, 0.24, D - 0.02, 5), silver);
    arch.position.set(0, y + Hn - 0.24, z0 + D / 2);
    g.add(arch);
    // the lit inside: chased silver back and sides, warm with lamplight
    const inner = withEnv(new THREE.MeshStandardMaterial({
      color: 0xe8d8c0, metalness: 0.8, roughness: 0.35, bumpMap: tex(latT, false, 2, 3), bumpScale: 2, emissive: 0x1a0c02,
    }), 1.0);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hn), inner);
    back.position.set(0, y + Hn / 2, z0 + 0.01);
    g.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(D, Hn), inner);
      side.rotation.y = -sx * Math.PI / 2;
      side.position.set(sx * W / 2, y + Hn / 2, z0 + D / 2);
      g.add(side);
    }
    const lamp = new THREE.PointLight(0xffc080, 0.55, 1.3, 2);
    lamp.position.set(0, y + 0.85, z0 + 0.24);
    g.add(lamp);
    flames.lights.push(lamp);
    flames.points.push(new THREE.Vector3(0.24, y + 0.03, z0 + 0.22), new THREE.Vector3(-0.24, y + 0.03, z0 + 0.22));
    // the image: pedestal, a figure in red-orange with a gold border, dark stone face and hands, a tall
    // gold mukut, and a red chunari veil behind the head — no facial detail
    const ix = 0, iz = z0 + 0.14;
    const vastra = new THREE.MeshStandardMaterial({ color: 0xd8401a, roughness: 0.7 });
    const chunari = new THREE.MeshStandardMaterial({ color: 0xb8101c, roughness: 0.7, side: THREE.DoubleSide });
    const gold = withEnv(new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.9, roughness: 0.3 }), 1.0);
    const stoneD = new THREE.MeshStandardMaterial({ color: 0x2a201c, roughness: 0.4 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.1, 24), silver);
    ped.position.set(ix, y + 0.05, iz);
    g.add(ped);
    const fy = y + 0.1;
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.145, 0.08], [0.12, 0.3], [0.1, 0.4], [0.12, 0.47], [0.11, 0.52], [0.05, 0.56], [0, 0.56]]
      .map(([r, yy]) => new THREE.Vector2(r, yy)), 24), vastra);
    body.scale.z = 0.72;
    body.position.set(ix, fy, iz);
    g.add(body);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.147, 0.01, 6, 24), gold);
    hem.rotation.x = Math.PI / 2; hem.scale.y = 0.72; hem.position.set(ix, fy + 0.02, iz);
    g.add(hem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), stoneD);
    head.scale.set(0.9, 1.1, 0.85);
    head.position.set(ix, fy + 0.63, iz + 0.01);
    g.add(head);
    const mukut = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.058, 0], [0.062, 0.03], [0.05, 0.08], [0.035, 0.13], [0.012, 0.17], [0, 0.18]]
      .map(([r, yy]) => new THREE.Vector2(r, yy)), 16), gold);
    mukut.position.set(ix, fy + 0.67, iz);
    g.add(mukut);
    const veil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.62), chunari);
    veil.rotation.y = Math.PI;
    veil.scale.set(1.15, 1.6, 0.7);
    veil.position.set(ix, fy + 0.55, iz - 0.03);
    g.add(veil);
    for (const sx of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), stoneD);
      hand.position.set(ix + sx * 0.08, fy + 0.36, iz + 0.1);
      g.add(hand);
    }
    // garlands: layered V-strands from shoulder to shoulder down to the knees, and one across the arch
    const fwd = new THREE.Vector3(0, -1, 0.35).normalize();
    [[0.16, 'o'], [0.24, 'w'], [0.31, 'y'], [0.38, 'oow'], [0.45, 'o']].forEach(([sag, pat], i) => {
      MG.strand(new THREE.Vector3(ix - 0.1 - i * 0.008, fy + 0.52, iz + 0.05), new THREE.Vector3(ix + 0.1 + i * 0.008, fy + 0.52, iz + 0.05),
        sag as number, pat as string, 0.019, fwd);
    });
    MG.strand(new THREE.Vector3(-W / 2 + 0.03, y + Hn - 0.08, z0 + D - 0.02), new THREE.Vector3(W / 2 - 0.03, y + Hn - 0.08, z0 + D - 0.02), 0.14, 'oooyyy', 0.022);
    for (const sx of [-1, 1]) MG.strand(new THREE.Vector3(sx * (W / 2 - 0.03), y + Hn - 0.08, z0 + D - 0.02), new THREE.Vector3(sx * (W / 2 - 0.03), y + 0.25, z0 + D - 0.02), 0.01, 'oy', 0.02, new THREE.Vector3(0, 0, 1));
  }

  // the wall clock on the north wall, right of Devi's niche (sanctum_wide)
  {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.4 }));
    face.rotation.x = Math.PI / 2;
    face.position.set(1.35, FLOOR + 2.45, -R + 0.03);
    g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 32), new THREE.MeshStandardMaterial({ color: 0x8a1e1e, roughness: 0.5 }));
    rim.position.set(1.35, FLOOR + 2.45, -R + 0.05);
    g.add(rim);
    for (const [len, ang] of [[0.14, 0.6], [0.18, 2.4]] as const) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.006), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      hand.geometry.translate(0, len / 2, 0);
      hand.rotation.z = -ang;
      hand.position.set(1.35, FLOOR + 2.45, -R + 0.06);
      g.add(hand);
    }
  }

  // ---------- the jalahari ----------
  // a rounded-oblong basin (~3.4 m east-west × 2.6 m north-south, sanctum_wide): its wall a ~0.45 m rail of
  // pierced sun-rosette panels between square turned silver posts (~0.12 m, every ~0.3 m) with small
  // knobs; a flat silver coping band; inside, a chased silver basin wet with water and sindoor
  // a rounded rectangle in plan (sanctum_wide): nearly straight runs of rail with rounded corners
  const AX = 1.3, AZ = 1.1, WALL_H = 0.46, NP = 26;
  const outline = (t: number, inset = 0, k = 6) => {
    const a = t * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
    return new THREE.Vector2((AX - inset) * Math.sign(c) * Math.pow(Math.abs(c), 2 / k), (AZ - inset) * Math.sign(s2) * Math.pow(Math.abs(s2), 2 / k));
  };
  const ring = (inset: number, n = 128) => Array.from({ length: n }, (_, i) => outline(i / n, inset));
  // parameter values spaced evenly by arc length along the rail (the superellipse crowds its corners)
  const arcT = (() => {
    const N = 1440, L = [0];
    let prev = outline(0, 0.02);
    for (let i = 1; i <= N; i++) { const p = outline(i / N, 0.02); L.push(L[i - 1] + p.distanceTo(prev)); prev = p; }
    return (f: number) => { const target = f * L[N]; let i = 0; while (i < N && L[i + 1] < target) i++; return (i + (target - L[i]) / Math.max(1e-6, L[i + 1] - L[i])) / N; };
  })();
  // contact shadow on the marble, and the orange sindoor/water stain that spreads round the plinth
  const cs = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(ring(-0.3, 64))), shade);
  cs.rotation.x = -Math.PI / 2;
  cs.position.y = FLOOR + 0.004;
  g.add(cs);
  {
    const st = new THREE.Shape(ring(-0.16, 64));
    st.holes.push(new THREE.Path(ring(-0.05, 64).reverse()));
    const stain = new THREE.Mesh(new THREE.ShapeGeometry(st), new THREE.MeshStandardMaterial({ color: 0xd8541e, roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false }));
    stain.rotation.x = -Math.PI / 2;
    stain.position.y = FLOOR + 0.006;
    g.add(stain);
  }
  // the marble round the jalahari after the day's pujas (sanctum_wide): orange sindoor smeared and
  // trodden, damp patches from the abhishek, rice, marigold and rose petals — densest at the rail
  {
    const W = 6.2, D = 5.4, PX = 200;
    const c = canvas(W * PX / 2, D * PX / 2, (g2) => {
      let sd = 314;
      const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const S2 = PX / 2, cx = (W * S2) / 2, cy = (D * S2) / 2;
      const atRail = () => { // a point just outside the rail, biased to the front and sides
        const t = rnd() * Math.PI * 2, o = outline(t / (Math.PI * 2), -(0.03 + Math.pow(rnd(), 2.5) * 0.7));
        return [cx + o.x * S2, cy - o.y * S2] as const;
      };
      for (let k = 0; k < 40; k++) { // damp patches
        const [x, y] = atRail();
        const gr = g2.createRadialGradient(x, y, 0, x, y, 30 + rnd() * 60);
        gr.addColorStop(0, 'rgba(120,110,100,0.18)'); gr.addColorStop(1, 'rgba(120,110,100,0)');
        g2.fillStyle = gr; g2.fillRect(x - 100, y - 100, 200, 200);
      }
      for (let k = 0; k < 420; k++) { // sindoor smears and footprints of it
        const [x, y] = atRail();
        g2.fillStyle = `rgba(${205 + rnd() * 25},${60 + rnd() * 25},${18 + rnd() * 12},${0.4 + rnd() * 0.5})`;
        g2.beginPath(); g2.ellipse(x, y, 2 + rnd() * 9, 1.5 + rnd() * 4, rnd() * 3, 0, Math.PI * 2); g2.fill();
      }
      for (let k = 0; k < 900; k++) { // rice, marigold petals, rose petals, bel leaves
        const [x, y] = atRail(), r = rnd();
        g2.fillStyle = r < 0.45 ? 'rgba(246,242,230,0.95)' : r < 0.75 ? 'rgba(236,150,18,0.95)' : r < 0.92 ? 'rgba(170,16,44,0.95)' : 'rgba(40,90,30,0.95)';
        g2.save(); g2.translate(x, y); g2.rotate(rnd() * 3);
        g2.beginPath(); g2.ellipse(0, 0, r < 0.45 ? 1 : 1.8 + rnd() * 1.6, r < 0.45 ? 0.7 : 1.1 + rnd() * 1, 0, 0, Math.PI * 2); g2.fill();
        g2.restore();
      }
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({
      map: t, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = FLOOR + 0.008;
    decal.receiveShadow = true;
    g.add(decal);
  }
  const flat = (shape: THREE.Shape, y: number, mat: THREE.Material, depth = 0) => {
    const geo = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 })
      : new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // plinth step
  flat(new THREE.Shape(ring(-0.08, 64)), FLOOR, railSilver, 0.07);
  // dark inner skin behind the pierced panels
  const back = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, WALL_H, 64, 1, true), S.recess);
  back.scale.set(AX - 0.1, 1, AZ - 0.1);
  back.position.y = FLOOR + WALL_H / 2;
  g.add(back);
  // square turned posts (a 4-sided lathe: base block, waisted shaft with rings, capital) and small knob tops
  const PH = WALL_H - 0.05;
  const colProf = [[0, 0], [0.075, 0], [0.075, 0.06], [0.06, 0.075], [0.05, 0.1], [0.06, 0.13], [0.045, 0.16], [0.042, 0.25],
    [0.058, 0.27], [0.058, 0.29], [0.044, 0.31], [0.05, 0.36], [0.07, 0.38], [0.075, PH], [0, PH]];
  const colGeo = new THREE.LatheGeometry(colProf.map(([r, y]) => new THREE.Vector2(r, y)), 4).rotateY(Math.PI / 4);
  colGeo.computeVertexNormals();
  const knobGeo = new THREE.LatheGeometry([[0, 0], [0.02, 0], [0.02, 0.012], [0.03, 0.022], [0.034, 0.035], [0.03, 0.048], [0.018, 0.057], [0, 0.06]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 10);
  const frames: THREE.Matrix4[] = [];
  const cols = new THREE.InstancedMesh(colGeo, railSilver, NP);
  const knobs = new THREE.InstancedMesh(knobGeo, railSilver, NP);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < NP; i++) {
    const ti = arcT(i / NP), tj = arcT((i + 1) / NP);
    const a = outline(ti, 0.02);
    const tn = outline(ti + 0.001, 0.02).sub(outline(ti - 0.001, 0.02));
    const q = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(tn.y, tn.x));
    cols.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(a.x, FLOOR + 0.07, -a.y), q, new THREE.Vector3(1, 1, 1)));
    knobs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(a.x, FLOOR + 0.07 + PH + 0.05, -a.y));
    const p0 = outline(ti, 0.03), p1 = outline(tj, 0.03);
    const len = p0.distanceTo(p1) - 0.13, ph = PH - 0.12;
    // a cast panel with real depth: the pierced face and a second pierced layer 4 cm behind it
    const grp = new THREE.Group();
    grp.position.set((p0.x + p1.x) / 2, FLOOR + 0.07 + 0.06 + ph / 2, -(p0.y + p1.y) / 2);
    grp.rotation.y = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    g.add(grp);
    for (const [dz, du] of [[0.02, 0], [-0.02, 0.5]] as const) {
      const pg = new THREE.PlaneGeometry(len, ph);
      const uv = pg.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) + du, uv.getY(k) + du * 0.2); // one framed sun-rosette per bay
      const m = new THREE.Mesh(pg, jali);
      m.position.z = dz;
      grp.add(m);
    }
    frames.push(new THREE.Matrix4().compose(new THREE.Vector3(grp.position.x, grp.position.y, grp.position.z),
      new THREE.Quaternion().setFromAxisAngle(up, grp.rotation.y), new THREE.Vector3(len + 0.02, ph + 0.05, 1)));
  }
  g.add(cols, knobs);
  // panel frames (top and bottom rails), instanced per panel
  {
    const t = 0.03;
    const fr = mergeGeometries([
      new THREE.BoxGeometry(1, t, 0.06).translate(0, 0.5 - t / 2, 0), new THREE.BoxGeometry(1, t, 0.06).translate(0, -0.5 + t / 2, 0),
    ].map((b) => b.toNonIndexed()))!;
    const fi = new THREE.InstancedMesh(fr, railSilver, frames.length);
    frames.forEach((m, i) => fi.setMatrixAt(i, m));
    g.add(fi);
  }
  // flat silver coping band (~0.12 m) on top of the posts, a thin bead under its outer edge
  const TOPY = FLOOR + 0.07 + PH;
  const rimShape = new THREE.Shape(ring(-0.06, 96));
  rimShape.holes.push(new THREE.Path(ring(0.07, 96).reverse()));
  flat(rimShape, TOPY - 0.035, railSilver, 0.035);
  {
    const pts = ring(-0.065, 128).map((p) => new THREE.Vector3(p.x, TOPY - 0.04, -p.y));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 256, 0.012, 5, true), railSilver));
  }
  // the chased basin, sloping gently from the coping down to the channel round the linga
  const BASIN = TOPY - 0.07;
  {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(ring(0.06, 128)), 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      // normalised elliptical radius → planar UVs centred on the linga
      uv.setXY(i, 0.5 + x / (2 * AX), 0.5 + y / (2 * AZ));
    }
    const bm = new THREE.Mesh(geo, basinMat);
    bm.rotation.x = -Math.PI / 2;
    bm.position.y = BASIN;
    bm.receiveShadow = true;
    g.add(bm);
    // inner wall between the coping and the basin floor
    const iw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, TOPY - BASIN, 64, 1, true), railSilver);
    iw.material.side = THREE.DoubleSide;
    iw.scale.set(AX - 0.07, 1, AZ - 0.07);
    iw.position.y = (TOPY + BASIN) / 2;
    g.add(iw);
  }
  // spout (nirmali) out through the north side
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 16, 1, true, 0, Math.PI), railSilver);
  spout.rotation.set(Math.PI / 2 - 0.12, 0, Math.PI);
  spout.position.set(0, BASIN - 0.04, -AZ - 0.18);
  g.add(spout);
  P.solid(-AX - 0.05, FLOOR, -AZ - 0.05, AX + 0.05, FLOOR + 1.6, AZ + 0.05);
  // the nirmali is not crossed: the strip behind the spout to the north wall is closed
  P.solid(-0.3, FLOOR, -R, 0.3, FLOOR + 1.0, -AZ);

  const lingaFirst = g.children.length; // the linga, its dressing and the jaldhari sit ~0.15 m toward the back
  // ---------- the Jyotirlinga ----------
  // the tall egg of the Mahakal linga (trust photographs): ~0.72 m across, ~1.05 m above the
  // basin (height : width ≈ 1.45), widest about 40 % up, tapering to a rounded top — no shoulder
  const LH = 1.0, LR = 0.37;
  const lingProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    // radius rises from 0.86·LR at the foot to LR at t = 0.4, then an elliptic taper to the crown
    let r: number;
    // full, nearly straight body with broad shoulders (widest ~55 % up), then a rounded dome
    if (t <= 0.55) r = LR * (0.9 + 0.1 * Math.sin((t / 0.55) * Math.PI * 0.5));
    else { const u = (t - 0.55) / 0.45; r = LR * Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.5); }
    lingProf.push(new THREE.Vector2(Math.max(0.0001, r), t * LH));
  }
  const rTop = LR * 0.6;
  const lg = new THREE.LatheGeometry(lingProf, 72);
  {
    // pitted, slightly irregular stone
    const p = lg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = Math.sin(a * 7 + y * 9) * 0.5 + Math.sin(a * 17 - y * 23) * 0.3 + Math.sin(a * 31 + y * 41) * 0.2;
      const k = 1 + 0.014 * n + 0.025 * Math.sin(a * 2 + 0.6) * Math.sin(y * 3.1 + 1) + 0.015 * Math.sin(a * 3 - y * 5);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    lg.computeVertexNormals();
  }
  const lingam = new THREE.Mesh(lg, lingamMat);
  lingam.position.y = BASIN + 0.06;
  lingam.castShadow = true;
  g.add(lingam);
  // silver collar where the stone meets the basin
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(LR * 0.86 + 0.06, LR * 0.86 + 0.1, 0.08, 48), silver);
  collar.position.y = BASIN + 0.04;
  g.add(collar);
  const L0 = BASIN + 0.06; // foot of the stone
  // raised bhasma / sandal paste on the south face: a curved tripundra with a kumkum bindu at its
  // centre — real relief standing off the stone, not paint
  {
    const radiusAt = (y: number) => {
      for (let i = 1; i < lingProf.length; i++) {
        const a = lingProf[i - 1], b = lingProf[i];
        if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
      }
      return 0;
    };
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const on = (th: number, y: number, lift: number) => {
      const r = radiusAt(y) * 1.03 + lift;
      return new THREE.Vector3(Math.sin(th) * r, L0 + y, Math.cos(th) * r);
    };
    // broad chandan / haldi paste laid with the fingers (sanctum_wide): a tripundra of three wide bands
    // whose ends rise round the front, and rows of short broad daubs wrapping the face and sides —
    // each a thin raised ribbon on the stone, yellow and orange
    const parts: THREE.BufferGeometry[] = [];
    const YEL = new THREE.Color(0xeab32e), ORA = new THREE.Color(0xe0781c);
    const ribbon = (th0: number, th1: number, yc: number, h: number, rise: number, col: THREE.Color) => {
      const nU = Math.max(4, Math.round((th1 - th0) / 0.06)), nV = 3;
      const pos: number[] = [], cols: number[] = [], idx: number[] = [];
      for (let i = 0; i <= nU; i++) {
        const u = i / nU, th = th0 + (th1 - th0) * u, mid = (th0 + th1) / 2;
        const ends = Math.sin(Math.PI * u); // thinner and lower relief at the ends of the smear
        for (let j = 0; j <= nV; j++) {
          const v = j / nV - 0.5;
          const y = yc + rise * ((th - mid) / Math.max(0.01, (th1 - th0) / 2)) ** 2 + v * h * (0.55 + 0.45 * ends) + (rnd() - 0.5) * 0.003;
          const lift = 0.002 + 0.006 * ends * Math.cos(v * Math.PI);
          const q = on(th, y, lift);
          pos.push(q.x, q.y, q.z);
          const c = col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
          cols.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < nU; i++) for (let j = 0; j < nV; j++) {
        const a0 = i * (nV + 1) + j, b0 = a0 + nV + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      gg.setIndex(idx);
      parts.push(gg.toNonIndexed());
    };
    // Mahakal's daily shringar (sanctum_wide): short yellow-ochre daubs of paste in loose, uneven rows
    // over the face and sides — mostly ochre, a few brighter haldi-yellow, the odd orange one
    const OCH = new THREE.Color(0xd49a30);
    let y = 0.1 + rnd() * 0.03;
    while (y < 0.86) {
      let th = -1.95 + rnd() * 0.3;
      while (th < 1.9) {
        const len = 0.16 + rnd() * 0.34;
        if (rnd() < 0.38) { th += len * 0.8; continue; }
        const r = rnd(), col = r < 0.72 ? OCH : r < 0.92 ? YEL : ORA;
        ribbon(th, Math.min(1.95, th + len), y + (rnd() - 0.5) * 0.03, 0.026 + rnd() * 0.022, (rnd() - 0.3) * 0.02, col);
        th += len + 0.14 + rnd() * 0.3;
      }
      y += 0.085 + rnd() * 0.04;
    }
    const merged = mergeGeometries(parts)!;
    merged.computeVertexNormals();
    const paste = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }); // chandan and haldi
    const chandanMesh = new THREE.Mesh(merged, paste);
    chandanMesh.castShadow = true;
    g.add(chandanMesh);
    const bindu = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), kumkum);
    bindu.scale.set(1, 1.2, 0.5);
    bindu.position.copy(on(0, 0.68, 0.012));
    g.add(bindu);
  }

  // crown: a ring of yellow marigolds, a heap of roses, bel leaves drooping outward
  {
    const top = L0 + LH;
    const mg = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.042, 1), yellow, 30);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const r = rTop * 0.92;
      mg.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, top - 0.1 + Math.sin(a * 3) * 0.008, Math.sin(a) * r),
        new THREE.Quaternion(), new THREE.Vector3(1, 0.8 + (i % 3) * 0.1, 1)));
    }
    g.add(mg);
    // the red-flower crown (sanctum_wide, sanctum_lingam): a heap of open roses in deep red and pink
    // covering the dome of the linga, a few slipping down the front
    {
      const bloom = new THREE.LatheGeometry([[0, 0], [0.018, 0.004], [0.032, 0.016], [0.04, 0.03], [0.036, 0.038], [0.022, 0.03], [0.012, 0.036], [0, 0.03]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 15);
      { const p = bloom.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.16 * Math.sin(a * 5) * Math.min(1, p.getY(i) / 0.02); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } bloom.computeVertexNormals(); }
      const surfY = (r: number) => { // height of the linga's surface at radius r on its upper dome
        for (let i = lingProf.length - 1; i > 0; i--) if (lingProf[i].x >= r) return L0 + lingProf[i].y;
        return L0;
      };
      let sd = 77;
      const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const pink = new THREE.MeshStandardMaterial({ color: 0xd23a6a, roughness: 0.7 });
      const red: THREE.Matrix4[] = [], pk: THREE.Matrix4[] = [];
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 64; i++) {
        const front = i >= 54;
        const a = front ? (rnd() - 0.5) * 0.9 + Math.PI / 2 : i * 2.39996, r = front ? rTop * (1.0 + rnd() * 0.2) : Math.sqrt(i / 54) * rTop * 1.02;
        const x = Math.cos(a) * r, z = Math.sin(a) * r, y = surfY(r) - 0.005 + (front ? -0.02 : 0);
        const n = new THREE.Vector3(x / LR, 0.9, z / LR).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(up, n);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.9 + rnd() * 0.5));
        (rnd() < 0.65 ? red : pk).push(m);
      }
      const ri = new THREE.InstancedMesh(bloom, rose, red.length), pi = new THREE.InstancedMesh(bloom, pink, pk.length);
      red.forEach((m, i) => ri.setMatrixAt(i, m));
      pk.forEach((m, i) => pi.setMatrixAt(i, m));
      g.add(ri, pi);
    }
    // bel leaf: three leaflets on one stalk
    const leaflet = new THREE.Shape();
    leaflet.moveTo(0, 0);
    leaflet.quadraticCurveTo(0.028, 0.035, 0, 0.09);
    leaflet.quadraticCurveTo(-0.028, 0.035, 0, 0);
    const lgeo = new THREE.ShapeGeometry(leaflet, 6);
    const tri = mergeGeometries([0, 0.7, -0.7].map((a) => lgeo.clone().rotateZ(a)))!;
    const NB = 34;
    const bel = new THREE.InstancedMesh(tri, leaf, NB + 12);
    for (let i = 0; i < NB; i++) {
      // an outer drooping ring, then an inner heap standing up over the roses
      const inner = i >= 20;
      const a = (i / (inner ? 14 : 20)) * Math.PI * 2 + (i % 2) * 0.15;
      const r = inner ? 0.06 + (i % 3) * 0.04 : rTop * 0.92;
      const tilt = inner ? -0.4 - (i % 3) * 0.2 : -1.05 - (i % 3) * 0.15;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, -a + Math.PI / 2, 0, 'YXZ'));
      const y = inner ? top + 0.02 + (i % 4) * 0.015 : top - 0.13;
      bel.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1.6, 1.6, 1.6)));
    }
    // a few offered in the basin
    for (let i = 0; i < 12; i++) {
      const a = i * 1.9 + 0.4, r = 0.58 + (i % 4) * 0.1;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, a));
      bel.setMatrixAt(NB + i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, BASIN + 0.03, Math.sin(a) * r), q, new THREE.Vector3(1.2, 1.2, 1.2)));
    }
    g.add(bel);
    // loose flowers in the basin
    const lf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 1), yellow, 14);
    const lr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 1), rose, 10);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.7 + 1, r = 0.58 + (i % 5) * 0.08;
      lf.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, BASIN + 0.035, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, 0.6, 1)));
    }
    for (let i = 0; i < 10; i++) {
      const a = i * 3.3 + 0.2, r = 0.58 + (i % 4) * 0.1;
      lr.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, BASIN + 0.03, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, 0.5, 1)));
    }
    g.add(lf, lr);
  }

  // ---------- jaldhari: engraved silver kalash on a chain, dripping onto the lingam ----------
  {
    const potY = L0 + LH + 0.85, PS = 0.75; // a smaller kalash, hung higher on a heavy chain
    const potProf: [number, number][] = [[0.015, 0], [0.06, 0.01], [0.16, 0.06], [0.24, 0.17], [0.26, 0.3], [0.23, 0.42], [0.14, 0.5], [0.11, 0.53], [0.15, 0.57], [0.15, 0.6], [0, 0.6]];
    const potGeo = new THREE.LatheGeometry(potProf.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const pot = new THREE.Mesh(potGeo, withEnv(new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.8, roughness: 0.55 }), 0.5));
    pot.position.set(0, potY, 0);
    pot.scale.setScalar(PS);
    g.add(pot);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15 * PS, 0.012, 8, 32), silver);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(0, potY + 0.6 * PS, 0);
    g.add(lip);
    // chain of links up to the ceiling
    const chainTop = CEIL - 0.2, chainBot = potY + 0.6 * PS;
    const nLinks = Math.round((chainTop - chainBot) / 0.1);
    const link = new THREE.InstancedMesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12), new THREE.MeshStandardMaterial({ color: 0x55575c, metalness: 0.8, roughness: 0.45 }), nLinks);
    for (let i = 0; i < nLinks; i++) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i % 2) * Math.PI / 2, Math.PI / 2));
      link.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(0, chainBot + 0.05 + i * 0.1, 0), q, new THREE.Vector3(1, 1.4, 1)));
    }
    g.add(link);
    // the thin stream from the pot's tip to the crown
    const streamTop = potY, streamBot = L0 + LH + 0.02;
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, streamTop - streamBot, 6), water);
    stream.position.set(0, (streamTop + streamBot) / 2, 0);
    g.add(stream);
  }

  for (let i = lingaFirst; i < g.children.length; i++) g.children[i].position.z -= 0.15;

  // ---------- tall silver trishul in the north-east corner, wrapped in marigold and jasmine ----------
  // (sanctum_wide, right): ~2.4 m tall, broad flat blades ~0.9 m across — a straight leaf-shaped centre
  // blade and two crescent side blades sweeping out and up — a damaru tied below the head
  {
    const tx = 2.8, tz = -2.75, top = 1.85;
    const tg = new THREE.Group();
    tg.position.set(tx, FLOOR, tz);
    tg.rotation.y = -Math.PI / 4; // the flat of the blades faces the room
    g.add(tg);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, top, 10), railSilver);
    shaft.position.y = top / 2;
    tg.add(shaft);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 16), railSilver);
    foot.position.y = 0.06;
    tg.add(foot);
    const ex = { depth: 0.024, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 12 };
    const centre = new THREE.Shape();
    centre.moveTo(-0.075, 0);
    centre.quadraticCurveTo(-0.11, 0.38, 0, 0.6);
    centre.quadraticCurveTo(0.11, 0.38, 0.075, 0);
    centre.lineTo(-0.075, 0);
    const side = (sg: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(sg * 0.06, 0);
      sh.quadraticCurveTo(sg * 0.47, -0.02, sg * 0.45, 0.48);
      sh.quadraticCurveTo(sg * 0.3, 0.12, sg * 0.1, 0.1);
      sh.lineTo(sg * 0.06, 0);
      return sh;
    };
    const head = mergeGeometries([centre, side(-1), side(1)].map((sh) => new THREE.ExtrudeGeometry(sh, ex).translate(0, 0, -0.012).toNonIndexed()))!;
    head.computeVertexNormals();
    const hm = new THREE.Mesh(head, railSilver);
    hm.position.y = top;
    hm.castShadow = true;
    tg.add(hm);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.07), railSilver);
    bar.position.y = top;
    tg.add(bar);
    const damaru = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.1, 16).translate(0, 0.05, 0), silverDull);
    const damaru2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.1, 16).translate(0, -0.05, 0), silverDull);
    for (const d of [damaru, damaru2]) { d.position.set(0.1, top - 0.25, 0); tg.add(d); }
    // marigold and jasmine strands wound down the shaft
    tg.updateMatrixWorld(true);
    const at = (x: number, y: number) => new THREE.Vector3(x, y, 0.04).applyMatrix4(tg.matrix);
    const jasmine = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.9 });
    // marigold strands hanging down the pole from the head, and loops from the cross-bar (sanctum_wide)
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(tg.quaternion);
    MG.strand(at(-0.05, top + 0.02), at(-0.04, 0.55), 0.04, 'o', 0.03, out);
    MG.strand(at(0.05, top + 0.02), at(0.05, 0.75), 0.05, 'y', 0.03, out);
    MG.strand(at(0.0, top - 0.02), at(0.0, 0.95), 0.06, 'oow', 0.028, out);
    MG.strand(at(-0.13, top), at(0.13, top), 0.22, 'oooyyy', 0.028);
    void jasmine;
    P.solid(tx - 0.2, FLOOR, tz - 0.2, tx + 0.2, FLOOR + 3, tz + 0.2);
  }

  // ---------- two massive repoussé-silver deepstambhas with ghee flames, in the south corners ----------
  // (sanctum_wide, both front corners): a broad lotus-petal foot (~0.9 m), a thick fluted shaft
  // (~0.55 m) chased all over, a bell capital, a square leaf-edged tray (~0.8 m) and a lamp bowl on top
  {
    const pillarMat = withEnv(new THREE.MeshStandardMaterial({
      color: 0xdfe2e7, metalness: 0.85, roughness: 0.3, bumpMap: tex(latT, false, 5, 4), bumpScale: 3,
    }), 0.8);
    const prof: [number, number][] = [[0, 0], [0.46, 0], [0.46, 0.05], [0.42, 0.09], [0.44, 0.14], [0.4, 0.2], [0.33, 0.26], [0.36, 0.3],
      [0.3, 0.36], [0.28, 0.42], [0.31, 0.45], [0.275, 0.48], [0.275, 0.98], [0.31, 1.01], [0.28, 1.04], [0.3, 1.08], [0.36, 1.14],
      [0.4, 1.2], [0.37, 1.24], [0, 1.24]];
    const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      let k = 1;
      if (y > 0.48 && y < 0.98) k = 1 + 0.07 * Math.pow(Math.abs(Math.cos(a * 8)), 0.6); // flutes
      else if (y < 0.3) k = 1 + 0.06 * Math.pow(Math.abs(Math.cos(a * 6)), 2); // lotus petals of the foot
      else if (y > 1.08) k = 1 + 0.05 * Math.pow(Math.abs(Math.cos(a * 8)), 2); // leaves of the capital
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    // square tray with a leaf-scalloped edge, and the lamp bowl on a short stem
    const tray = mergeGeometries([
      new THREE.BoxGeometry(0.8, 0.07, 0.8).translate(0, 1.275, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.86, 0.035, 0.86).translate(0, 1.255, 0).toNonIndexed(),
    ])!;
    const bowl = new THREE.LatheGeometry([[0, 1.31], [0.07, 1.31], [0.06, 1.36], [0.09, 1.38], [0.26, 1.41], [0.33, 1.46], [0.34, 1.48], [0.31, 1.47], [0.24, 1.43], [0, 1.42]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const LZ = 2.62, LX = 2.72;
    for (const x of [-LX, LX]) {
      for (const [gg, mm] of [[geo, pillarMat], [tray, pillarMat], [bowl, silver]] as const) {
        const m = new THREE.Mesh(gg, mm);
        m.position.set(x, FLOOR, LZ);
        m.castShadow = true;
        g.add(m);
      }
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), shade);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(x, FLOOR + 0.004, LZ);
      g.add(sh);
      const ghee = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24), new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.4, emissive: 0x301800 }));
      ghee.rotation.x = -Math.PI / 2;
      ghee.position.set(x, FLOOR + 1.445, LZ);
      g.add(ghee);
      // collider: the shaft only (≈0.28 m), so the corridor to the rail's side stays ≥0.6 m wide
      P.solid(x - 0.28, FLOOR, LZ - 0.28, x + 0.28, FLOOR + 1.5, LZ + 0.28);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.29, FLOOR + 1.5, LZ + Math.sin(a) * 0.29));
      }
      // a gentle lamp light well above the bowl, short range, so it never hot-spots the silver
      const l = new THREE.PointLight(0xffa040, 1.5, 3, 1.6);
      l.position.set(x, FLOOR + 1.85, LZ);
      g.add(l);
      flames.lights.push(l);
    }
  }
  // pujaris seated cross-legged behind the rail and along its west side, chanting (sanctum_wide), with
  // low red wooden chowkis carrying brass puja vessels; clear of the walk round the rail's sides
  {
    const SAF = 0xf07a12, ORG = 0xff8a10, WHT = 0xf3eee2, PNK = 0xe8287a;
    const pr = buildPriests(g, [
      { x: -1.5, y: FLOOR, z: -1.95, ry: 0.25, cloth: SAF, head: 'shaved', tilak: true, pose: 'aarti' },
      { x: -0.8, y: FLOOR, z: -2.05, ry: 0.05, cloth: WHT, pose: 'read', head: 'hair' },
      { x: 0.8, y: FLOOR, z: -2.05, ry: -0.1, cloth: PNK, head: 'hair', tilak: true },
      { x: 1.5, y: FLOOR, z: -1.95, ry: -0.25, cloth: ORG, pose: 'read', head: 'shaved', tilak: true },
      { x: -1.15, y: FLOOR, z: -2.8, ry: 0.1, cloth: 0xf05a12, dhoti: 0xece4d0, head: 'hair', tilak: true },
      { x: 1.15, y: FLOOR, z: -2.8, ry: -0.15, cloth: 0xe02a7a, head: 'shaved', pose: 'read' },
    ]);
    flames.points.push(...pr.flames);
    P.solid(-1.8, FLOOR, -3.2, -0.45, FLOOR + 0.9, -1.6);
    P.solid(0.45, FLOOR, -3.2, 1.8, FLOOR + 0.9, -1.6);
    // chowkis: red-painted low tables on turned legs, a brass thali, lota, diya and a bell on each
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.6 });
    const brass = withEnv(new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 0.9, roughness: 0.3 }), 0.9);
    for (const [cx, cz, ry] of [[-2.55, -2.8, 0], [0, -2.85, 0]] as const) {
      const t = new THREE.Group();
      t.position.set(cx, FLOOR, cz);
      t.rotation.y = ry;
      g.add(t);
      box(t, wood, 0.62, 0.05, 0.42, 0, 0.28, 0);
      box(t, wood, 0.58, 0.07, 0.38, 0, 0.21, 0);
      for (const [lx, lz] of [[-0.27, -0.17], [0.27, -0.17], [-0.27, 0.17], [0.27, 0.17]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.28, 8), wood);
        leg.position.set(lx, 0.14, lz);
        t.add(leg);
      }
      const thali = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.02, 24), brass);
      thali.position.set(-0.1, 0.34, 0);
      const lota = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.07, 0.05], [0.065, 0.1], [0.035, 0.13], [0.045, 0.16], [0, 0.16]].map(([r, y]) => new THREE.Vector2(r, y)), 16), brass);
      lota.position.set(0.17, 0.33, -0.05);
      const diya = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.025, 0.06], [0.06, 0.08], [0.055, 0.095], [0, 0.085]].map(([r, y]) => new THREE.Vector2(r, y)), 12), brass);
      diya.position.set(0.17, 0.33, 0.12);
      const bell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.14], [0.012, 0.13], [0.012, 0.09], [0.04, 0.07], [0.05, 0.0], [0, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 12), brass);
      bell.position.set(-0.22, 0.33, 0.12);
      t.add(thali, lota, diya, bell);
      // sindoor, rice and flowers in the thali
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8541e, roughness: 0.9 }));
      heap.scale.y = 0.5;
      heap.position.set(-0.13, 0.35, 0.02);
      t.add(heap);
      t.updateMatrixWorld(true);
      flames.points.push(new THREE.Vector3(0.17, 0.43, 0.12).applyMatrix4(t.matrix));
      P.solid(cx - 0.33, FLOOR, cz - 0.23, cx + 0.33, FLOOR + 0.4, cz + 0.23);
    }
  }
  // the white LED ceiling panels
  const fill = new THREE.PointLight(0xf4f7ff, 3.2, 11, 1.3);
  fill.position.set(0, CEIL - 0.45, 2.2);
  g.add(fill);
  flames.lights.push(fill);
  MG.build(g);
}

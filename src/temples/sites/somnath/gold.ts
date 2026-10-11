import * as THREE from 'three';

/**
 * The garbhagriha's gold plating (2020s): high-key yellow gold beaten into deep repoussé panels - a beaded
 * frame round each panel, a vine of spiralling scrolls and leaves climbing its centre, a lotus at the head
 * and the foot - plus a bright warm "gold room" environment for the metals to mirror, and the
 * "ॐ नमः शिवाय" frieze.
 */

/** metres per repoussé panel tile */
export const GOLD_TILE = 1.2;

let cache: { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } | null = null;

/** Height field of one panel, drawn in grey (white = proud), then turned into colour and normal maps. */
export function goldRepousse() {
  if (cache) return cache;
  const S = 512;
  const h = document.createElement('canvas');
  h.width = h.height = S;
  const g = h.getContext('2d')!;
  g.fillStyle = '#5a5a5a';
  g.fillRect(0, 0, S, S);
  const grey = (v: number) => `rgb(${v},${v},${v})`;
  // beaded frame round the panel
  g.strokeStyle = grey(210);
  g.lineWidth = 16;
  g.strokeRect(14, 14, S - 28, S - 28);
  g.strokeStyle = grey(40);
  g.lineWidth = 5;
  g.strokeRect(28, 28, S - 56, S - 56);
  for (let i = 0; i < 24; i++) {
    const t = 30 + (i * (S - 60)) / 23;
    for (const [x, y] of [[t, 6], [t, S - 6], [6, t], [S - 6, t]]) {
      const gr = g.createRadialGradient(x - 1, y - 1, 0, x, y, 6);
      gr.addColorStop(0, grey(255)); gr.addColorStop(1, grey(120));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill();
    }
  }
  // a climbing vine: a wavy central stem with a spiral scroll and a leaf at every turn
  const cx = S / 2;
  g.strokeStyle = grey(225);
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  for (let y = 70; y <= S - 70; y += 4) {
    const x = cx + Math.sin((y / (S - 140)) * Math.PI * 3) * 26;
    if (y === 70) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const scroll = (x: number, y: number, dir: number, r: number) => {
    g.lineWidth = 7;
    g.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.12) {
      const rr = r * (1 - a / (Math.PI * 3.6));
      const px = x + dir * Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
    // a fleshy leaf curling off the scroll
    const gr = g.createRadialGradient(x + dir * r * 1.2, y - r * 0.9, 2, x + dir * r * 1.2, y - r * 0.9, r * 0.9);
    gr.addColorStop(0, grey(250)); gr.addColorStop(1, grey(110));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x + dir * r * 1.25, y - r * 0.95, r * 0.75, r * 0.32, dir * -0.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = grey(60);
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  };
  for (let k = 0; k < 6; k++) {
    const y = 100 + k * 62;
    const dir = k % 2 ? 1 : -1;
    const sx = cx + Math.sin(((y - 70) / (S - 140)) * Math.PI * 3) * 26;
    g.strokeStyle = grey(215);
    scroll(sx + dir * 70, y, dir, 40);
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(sx, y); g.quadraticCurveTo(sx + dir * 40, y - 30, sx + dir * 70, y - 40); g.stroke();
  }
  // lotus at the head and the foot
  for (const [y, up] of [[64, 1], [S - 64, -1]] as const) {
    for (let p = -3; p <= 3; p++) {
      const gr = g.createRadialGradient(cx + p * 16, y, 2, cx + p * 16, y, 26);
      gr.addColorStop(0, grey(250)); gr.addColorStop(1, grey(120));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(cx + p * 17, y - up * Math.abs(p) * -3, 10, 24, p * 0.22 * up, 0, Math.PI * 2);
      g.fill();
    }
  }
  // dotted ground (the punched matting of the background)
  g.fillStyle = grey(78);
  const pre = g.getImageData(0, 0, S, S).data;
  for (let y = 40; y < S - 40; y += 9) for (let x = 40 + ((y / 9) % 2) * 4.5; x < S - 40; x += 9) {
    const d = pre[((y | 0) * S + (x | 0)) * 4];
    if (d < 100) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  }
  // soften the hammered relief
  const soft = document.createElement('canvas');
  soft.width = soft.height = S;
  const sg = soft.getContext('2d')!;
  sg.filter = 'blur(2.5px)';
  sg.drawImage(h, 0, 0);
  const H = sg.getImageData(0, 0, S, S).data;
  const at = (x: number, y: number) => H[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;

  // colour: bright yellow gold, the hollows darker and warmer, the raised work palest
  const col = document.createElement('canvas');
  col.width = col.height = S;
  const cg = col.getContext('2d')!;
  const ci = cg.createImageData(S, S);
  const nrm = document.createElement('canvas');
  nrm.width = nrm.height = S;
  const ng = nrm.getContext('2d')!;
  const ni = ng.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = at(x, y);
    const i = (y * S + x) * 4;
    // deep gold (0xd4a020) at mid relief, dark amber in the hollows, bright on the raised work
    const k = 0.5 + 0.75 * v * v + 0.1 * v;
    ci.data[i] = Math.min(255, 240 * k);
    ci.data[i + 1] = Math.min(255, 180 * k);
    ci.data[i + 2] = Math.min(255, 50 * k * k);
    ci.data[i + 3] = 255;
    const dx = (at(x + 1, y) - at(x - 1, y)) * 5.0, dy = (at(x, y + 1) - at(x, y - 1)) * 5.0;
    const l = Math.hypot(dx, dy, 1);
    ni.data[i] = 128 + (-dx / l) * 127;
    ni.data[i + 1] = 128 + (dy / l) * 127;
    ni.data[i + 2] = 128 + (1 / l) * 127;
    ni.data[i + 3] = 255;
  }
  cg.putImageData(ci, 0, 0);
  ng.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.CanvasTexture(nrm);
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / GOLD_TILE, 1 / GOLD_TILE);
    t.anisotropy = 8;
  }
  cache = { map, normal };
  return cache;
}

/** A warm, bright room for the sanctum's metals to mirror: gold walls all round, lamp glow, a pale marble floor. */
export function goldRoomEnv(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  // a bright warm room: gold walls lit by many lamps, so polished metal shows highlights and dark recesses
  room.background = new THREE.Color(0x4a3210);
  const glow = (c: number, x: number, y: number, z: number, r: number) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: c }));
    s.position.set(x, y, z);
    room.add(s);
  };
  glow(0xffe0a0, -3, 0.5, -2, 1.0);
  glow(0xffe0a0, 3, 0.5, -2, 1.0);
  glow(0xfff0c8, 0, 3, 3, 1.6);
  glow(0xc89a48, 0, 0, -5, 3.5);
  glow(0xd8cfc0, 0, -5, 0, 4.5);
  // the lamp flames and the open door: small, very bright sources for crisp specular sparkle
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    glow(0xffffff, Math.cos(a) * 3.5, 0.3 + (k % 3) * 0.8, Math.sin(a) * 3.5, 0.28);
  }
  glow(0xfff6e0, 0, 1.2, 4.5, 1.1);
  glow(0x3a2810, 0, 4.5, 0, 3.0);
  // bright gold walls and lamp-lit panels at varied distances, so curved metal shows bands of light and shade
  for (const [cx, cy, cz, r, c] of [[-5, 1, 0, 1.8, 0xf0c060], [5, 1.5, 1, 1.6, 0xf4c868], [0, 0.5, -5, 2.0, 0xe8b850], [-3, 3, 3, 1.0, 0xfff0c8],
    [3.5, -1, -3, 1.2, 0xd8a040], [0, 5, 0, 1.4, 0xfff4d8]] as const) glow(c, cx, cy, cz, r);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return env;
}

/** "ॐ नमः शिवाय" beaten into a gold band: pale raised letters on a darker punched ground. */
export function omFriezeMaterial(env: THREE.Texture) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#f6cf6a'); gr.addColorStop(0.5, '#d9a73e'); gr.addColorStop(1, '#f2c862');
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 128);
  g.strokeStyle = '#fff0b8';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 1012, 116);
  g.textAlign = 'center';
  g.font = '800 92px Martel, "Noto Sans Devanagari", serif';
  // a dark offset first, then the bright letter on top, reading as raised relief
  g.fillStyle = '#7a4f12';
  g.fillText('ॐ नमः शिवाय', 515, 98);
  g.fillStyle = '#fff1bf';
  g.fillText('ॐ नमः शिवाय', 511, 94);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.35, envMap: env, envMapIntensity: 1.2, emissive: 0x100a02 });
}

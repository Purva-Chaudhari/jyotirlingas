import * as THREE from 'three';

export interface BoardStyle {
  bg: string;
  fg: string;
  border: string;
}
/** maroon with gold lettering, as on the Dham's own signs */
export const MAROON: BoardStyle = { bg: '#6b1414', fg: '#f4d27a', border: '#d8b25a' };
/** the temple trust's orange boards (ticket counter, help desk): white and dark red lettering */
export const TRUST: BoardStyle = { bg: '#e8571c', fg: '#ffffff', border: '#ffffff' };

/** A painted sign board (canvas), Hindi over English. Each line: [text, px] or [text, px, colour]. */
export function board(lines: ([string, number] | [string, number, string])[], w: number, h: number, style: BoardStyle = MAROON) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round((1024 * h) / w);
  const g = c.getContext('2d')!;
  g.fillStyle = style.bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = style.border; g.lineWidth = 10; g.strokeRect(12, 12, c.width - 24, c.height - 24);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = c.height / (lines.length + 1);
  lines.forEach(([t, px, col], i) => {
    g.fillStyle = col ?? style.fg;
    g.font = `bold ${px}px "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif`;
    g.fillText(t, c.width / 2, step * (i + 1));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
}

/** Painted lettering straight on a wall (transparent canvas): e.g. "द्वार ४ / GATE 4". */
export function lettering(lines: [string, number][], w: number, h: number, color = '#3a2a1c') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round((512 * h) / w);
  const g = c.getContext('2d')!;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = c.height / (lines.length + 1);
  lines.forEach(([t, px], i) => {
    g.font = `bold ${px}px "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif`;
    g.fillText(t, c.width / 2, step * (i + 1));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false }));
}

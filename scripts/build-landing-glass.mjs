// Builds the hub's glass-India mask from the India-view outline (public/data/landing/india.json, Natural Earth)
// into public/landing/india-glass.webp — lon 60–100° E, lat 0–40° N, equirectangular (as the journey's globe):
//   R: India (antialiased), G: a narrow blur of it (the bevel), B: a wide blur (the glow around the glass)
//
//   node scripts/build-landing-glass.mjs
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const LON0 = 60, LON1 = 100, LAT0 = 0, LAT1 = 40, N = 2048;
const india = JSON.parse(readFileSync('public/data/landing/india.json', 'utf8'));
const path = (ring) => {
  let d = '';
  for (let i = 0; i < ring.length; i += 2) d += `${i ? 'L' : 'M'}${(((ring[i] - LON0) / (LON1 - LON0)) * N).toFixed(1)} ${(((LAT1 - ring[i + 1]) / (LAT1 - LAT0)) * N).toFixed(1)}`;
  return d + 'Z';
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}"><rect width="${N}" height="${N}" fill="#000"/><path d="${india.outline.map(path).join('')}" fill="#fff"/></svg>`;
const ch = (img) => img.extractChannel(0).raw().toBuffer();
const mask = await ch(sharp(Buffer.from(svg)));
const raw = { raw: { width: N, height: N, channels: 1 } };
const bevel = await ch(sharp(mask, raw).blur(5));
const glow = await ch(sharp(mask, raw).blur(22));
const out = Buffer.alloc(N * N * 3);
for (let i = 0; i < N * N; i++) (out[i * 3] = mask[i]), (out[i * 3 + 1] = bevel[i]), (out[i * 3 + 2] = glow[i]);
const info = await sharp(out, { raw: { width: N, height: N, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile('public/landing/india-glass.webp');
console.log('india-glass.webp', (info.size / 1024).toFixed(0), 'KB');

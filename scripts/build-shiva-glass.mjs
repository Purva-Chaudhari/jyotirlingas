// Builds the hub's glass Shiva maps from a cut-out figure:
//   in:  assets/landing/shiva-src.png — the seated figure, background removed (RGBA). It covers the CUT
//        rectangle of the composition below (reference-image pixels); a higher-resolution source with the same
//        framing can simply replace it.
//   out: public/landing/shiva-glass.webp — RGB (no alpha: browsers may drop colour under transparency),
//        the composition's FRAME (figure + crescent moon + trishul):
//          R  height: inside the figure a soft dome + multi-scale luminance relief (any ornaments drawn
//             around it in ORNAMENTS_SVG become rounded domes; their coverage is read from R where B is empty)
//          G  fine detail (a high-pass of the luminance: eyes, malas, serpent scales) — drawn as etched light
//          B  the figure's coverage (clipped to India in the shader)
// The shader (src/landing/glass.ts) turns these into glass: normals from R, refraction of the cosmos behind,
// fresnel rim, a moving specular, the detail as soft highlights.
//
//   node scripts/build-shiva-glass.mjs
import sharp from 'sharp';

/** the composition, in the reference's pixel space: FRAME = everything, CUT = what shiva-src.png covers */
const FRAME = { x0: 60, y0: 235, x1: 372, y1: 712 };
const CUT = { x0: 104, y0: 286, x1: 362, y1: 710 };
const OUT_W = 1024;
const k = OUT_W / (FRAME.x1 - FRAME.x0);
const OUT_H = Math.round((FRAME.y1 - FRAME.y0) * k);
const px = (x) => (x - FRAME.x0) * k, py = (y) => (y - FRAME.y0) * k;

const one = (img) => img.extractChannel(0).raw().toBuffer();
const raw1 = { raw: { width: OUT_W, height: OUT_H, channels: 1 } };
const blur = (buf, s) => one(sharp(buf, raw1).blur(s));

// the figure, placed in the frame
const cw = Math.round((CUT.x1 - CUT.x0) * k), ch = Math.round((CUT.y1 - CUT.y0) * k);
const fig = await sharp('assets/landing/shiva-src.png').resize(cw, ch, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
const lum = Buffer.alloc(OUT_W * OUT_H), alpha = Buffer.alloc(OUT_W * OUT_H);
const ox = Math.round(px(CUT.x0)), oy = Math.round(py(CUT.y0));
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    const X = x + ox, Y = y + oy;
    if (X < 0 || Y < 0 || X >= OUT_W || Y >= OUT_H) continue;
    const i = (y * cw + x) * 4, o = Y * OUT_W + X;
    lum[o] = Math.round(0.3 * fig[i] + 0.55 * fig[i + 1] + 0.15 * fig[i + 2]);
    alpha[o] = fig[i + 3];
  }

// drop thin structures from the silhouette (the trishul's shaft held along his left arm, stray strands):
// a morphological opening — erode, then grow back — keeps the body and removes anything narrower than ~12 px
{
  const er = await blur(alpha, 6);
  const eroded = Buffer.alloc(OUT_W * OUT_H);
  for (let i = 0; i < eroded.length; i++) eroded[i] = er[i] > 235 ? 255 : 0;
  const gr = await blur(eroded, 6);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(alpha[i], gr[i] > 20 ? 255 : gr[i] * 12);
}

// ornaments drawn around the figure (none at present: the moon in his jata is part of the figure)
const svg = /* ORNAMENTS_SVG */ `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="${FRAME.x0} ${FRAME.y0} ${FRAME.x1 - FRAME.x0} ${FRAME.y1 - FRAME.y0}">
  <rect x="${FRAME.x0}" y="${FRAME.y0}" width="999" height="999" fill="#000"/>
</svg>`;
const orn = await one(sharp(Buffer.from(svg)));

// height: domes from the silhouettes + the figure's luminance at three scales (smooth, keeps the face)
const [domeF1, domeF2, domeO, l1, l2] = await Promise.all([blur(alpha, 26), blur(alpha, 7), blur(orn, 3.5), blur(lum, 5), blur(lum, 1.6)]);
const l0 = await blur(lum, 0.8);
// the silhouette, eased in over its outer few px: the figure rises gently out of the glass (no cliff, no seam)
const edge = await blur(alpha, 16);
const out = Buffer.alloc(OUT_W * OUT_H * 3);
for (let i = 0; i < OUT_W * OUT_H; i++) {
  const e = Math.min(1, Math.max(0, (edge[i] / 255 - 0.5) / 0.5));
  const a = alpha[i] / 255;
  // (only the height eases in at the silhouette; the fine detail keeps its full strength)
  const ae = a * e * e * (3 - 2 * e);
  const hf = (0.45 * domeF1[i] + 0.25 * domeF2[i]) / 255 + a * (0.18 * l1[i] + 0.12 * l2[i]) / 255;
  const ho = 0.85 * (domeO[i] / 255);
  out[i * 3] = Math.round(Math.min(1, Math.max(hf * ae, ho)) * 255);
  out[i * 3 + 1] = Math.round(Math.min(255, Math.max(0, 128 + (l0[i] - l1[i]) * 2.2 * a)));
  out[i * 3 + 2] = alpha[i];
}
const info = await sharp(out, { raw: { width: OUT_W, height: OUT_H, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile('public/landing/shiva-glass.webp');
console.log('shiva-glass.webp', OUT_W, '×', OUT_H, (info.size / 1024).toFixed(0), 'KB');

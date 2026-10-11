import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';
import { Batch, Instances, mergeParts } from './batch';
import type { RM } from './mats';
import { ARM, OUTER, RING, PRAK2 } from './layout';

/**
 * The third prakara corridor (Chokkattan Mandapam, built by Muthuramalinga Sethupathi, 1763–95):
 * a sunken flagstone walkway between two raised platforms (~5 ft), each carrying a front row of
 * massive square pillars and a back row against the wall. Pillars: moulded pedestal, three carved
 * blocks with lotus medallions separated by octagonal collars, a pot capital, a corbel bracket with
 * a painted yali head leaning over the walkway, and painted beams; the walkway ceiling steps up
 * over corbel courses to a flat ceiling painted with a row of great medallions (one per bay).
 * Today everything is enamel-painted: cream pillars, red/green/gold brackets, cerulean ceiling.
 *
 * Each arm is built in a local frame (u along the arm, v across, v = 0 on the walkway centreline)
 * and transformed into place. Pillars are instanced (≈1000 of them in a handful of draw calls).
 */

const CREAM = 0xf2e4bc, CREAM2 = 0xe2d0a2, RED = 0xb8241c, MAROON = 0x7a1a14, GREEN = 0x1f8a46, YELLOW = 0xf2c230,
  BLUE = 0x2a64b0, PINK = 0xe48a9a, GOLD = 0xe2b443, WHITE = 0xf8f4ea, ORANGE = 0xe8701a,
  MINT = 0x8fd3b0, TEAL = 0x5fb59a;

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const lathe = (prof: [number, number][], seg: number, y = 0) => new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(Math.max(r, 1e-4), yy)), seg, Math.PI / seg).translate(0, y, 0);

/** Pillar height from platform top to the top of the bracket. */
export const PH = ARM.pillarTop + 0.55 - ARM.platY;

/**
 * Corridor pillar (as painted today), local frame: platform top at y = 0, the walkway is +z.
 * After c06 (the third corridor, 2019): a moulded base; a square block (1.05 m) whose faces are sunk
 * 15 cm into a red-outlined panel carrying a relief figure; an octagonal neck (0.7 m across); a second
 * carved block; a second neck and a pot capital; then the heavy cross-shaped pushpa-potika bracket
 * capital, projecting 0.5 m each way and painted blue, green and red, a drooping lotus bud under every
 * arm; the abacus; and (front row) the long bracket with the crouching golden yali over the walkway.
 *
 * The relief panels carry UVs into the relief atlas (`reliefTextures`); every other part has uv −1,
 * which the pillar material reads as plain paint.
 */
type Part = { g: THREE.BufferGeometry; c?: THREE.ColorRepresentation; uv?: boolean };

/** Merge parts keeping a uv channel: relief panels keep theirs, everything else gets (−1, −1). */
function mergeRelief(parts: Part[]) {
  const gs = parts.map(({ g, c, uv }) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && !(uv && k === 'uv')) n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    const cnt = n.attributes.position.count;
    if (!uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2).fill(-1), 2));
    const col = new THREE.Color(c ?? 0xffffff);
    const a = new Float32Array(cnt * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; }
    n.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return n;
  });
  return mergeGeometries(gs, false)!;
}

/** atlas rows: lower-block figures in v ∈ [0, RV), upper-block reliefs in [RV, 1] */
const RV = 0.625;

export function pillarGeometry(front: boolean) {
  const P: Part[] = [];
  const W = 1.05;
  const push = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation, uv = false) => P.push({ g, c, uv });
  const faces = front ? [0, Math.PI / 2, -Math.PI / 2] : [0];
  const all = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  // moulded base (adhishthana): plinth, a fat roll, a recessed neck, a cyma
  push(box(W + 0.36, 0.12, W + 0.36, 0, 0, 0), 0x8a7a5e);
  push(box(W + 0.3, 0.18, W + 0.3, 0, 0.12, 0), CREAM2);
  // the fat roll (kumuda): a chamfered band all round
  push(box(W + 0.26, 0.16, W + 0.26, 0, 0.3, 0), CREAM);
  push(box(W + 0.2, 0.22, W + 0.2, 0, 0.27, 0), CREAM2);
    push(box(W + 0.06, 0.06, W + 0.06, 0, 0.48, 0), MAROON);
  push(box(W + 0.16, 0.06, W + 0.16, 0, 0.54, 0), CREAM2);
  let y = 0.6;

  /** a carved block: corner posts, top and bottom bands, a core sunk 15 cm, relief panels on `faces` */
  const block = (h: number, v0: number, v1: number) => {
    const post = 0.2, band = 0.12, core = W - 0.3;
    push(box(W, band, W, 0, y, 0), CREAM);
    push(box(W, band, W, 0, y + h - band, 0), CREAM);
    push(box(core, h - 2 * band, core, 0, y + band, 0), CREAM2);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) push(box(post, h - 2 * band, post, cx * (W - post) / 2, y + band, cz * (W - post) / 2), CREAM);
    const pw = W - 2 * post, ph = h - 2 * band;
    for (const a of all) {
      const pr = (g: THREE.BufferGeometry) => g.rotateY(a);
      if (faces.includes(a)) {
        // the sunk panel: relief quad, a red outline round it, a lotus-petal sill under it
        const q = new THREE.PlaneGeometry(pw, ph);
        const uv = q.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
        push(pr(q.translate(0, y + band + ph / 2, core / 2 + 0.002)), 0xffffff, true);
        for (const sx of [-1, 1]) push(pr(box(0.022, ph, 0.02, sx * (pw / 2 + 0.011), y + band, W / 2 - 0.005)), MAROON);
        push(pr(box(pw + 0.044, 0.022, 0.02, 0, y + h - band - 0.022, W / 2 - 0.005)), MAROON);
        push(pr(box(pw + 0.044, 0.022, 0.02, 0, y + band, W / 2 - 0.005)), MAROON);
      } else {
        push(pr(box(pw, ph, 0.15, 0, y + band, W / 2 - 0.075)), CREAM);
      }
    }
    y += h;
  };
  /** octagonal neck between two blocks, with collars */
  const neck = (r: number, h: number) => {
    push(box(W * 0.92, 0.08, W * 0.92, 0, y, 0), CREAM2);
    push(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.06, 8, 1, false, Math.PI / 8).translate(0, y + 0.11, 0), RED);
    push(new THREE.CylinderGeometry(r, r, h, 8, 1, false, Math.PI / 8).translate(0, y + 0.08 + h / 2, 0), CREAM);
    push(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.05, 8, 1, false, Math.PI / 8).translate(0, y + 0.08 + h / 2, 0), GREEN);
    push(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.06, 8, 1, false, Math.PI / 8).translate(0, y + 0.08 + h - 0.11, 0), RED);
    push(box(W * 0.92, 0.08, W * 0.92, 0, y + 0.08 + h, 0), CREAM2);
    y += h + 0.16;
  };
  block(1.3, 0, RV);
  neck(0.35, 0.4);
  block(0.8, RV, 1);
  // second, shorter neck and the pot (kumbha) capital with gold lotus petals
  neck(0.32, 0.26);
  push(lathe([[0.36, 0], [0.5, 0.08], [0.56, 0.16], [0.52, 0.24], [0.44, 0.28]], 8, y), CREAM);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    push(new THREE.SphereGeometry(0.1, 4, 3).scale(0.9, 1.5, 0.45).rotateY(-a).translate(Math.sin(a) * 0.5, y + 0.12, Math.cos(a) * 0.5), GOLD);
  }
  y += 0.28;
  // phalaka (the plate) and a thin painted fascia
  push(box(W + 0.08, 0.08, W + 0.08, 0, y, 0), RED);
  push(box(W + 0.14, 0.06, W + 0.14, 0, y + 0.08, 0), YELLOW);
  y += 0.14;
  // the pushpa-potika: a cross of corbels projecting 0.5 m past the block on every side, each with a
  // rolled (curled) underside and a drooping lotus bud under its tip
  const cH = 0.36, reach = W / 2 + 0.5, aw = 0.4;
  push(box(W * 0.8, cH, W * 0.8, 0, y, 0), BLUE);
  for (const a of [0, Math.PI / 2]) {
    const pr = (g: THREE.BufferGeometry) => g.rotateY(a);
    push(pr(box(aw, cH * 0.62, reach * 2, 0, y + cH * 0.38, 0)), BLUE);
    push(pr(box(aw + 0.04, 0.05, reach * 2 + 0.04, 0, y + cH - 0.05, 0)), RED);
    push(pr(box(aw + 0.02, 0.05, reach * 2 + 0.02, 0, y + cH * 0.38 - 0.02, 0)), GREEN);
  }
  for (const a of all) {
    const pr = (g: THREE.BufferGeometry) => g.rotateY(a);
    // the curl under the projecting arm, and the bud
    push(pr(new THREE.CylinderGeometry(cH * 0.38, cH * 0.38, aw, 8).rotateZ(Math.PI / 2).translate(0, y + cH * 0.38, reach - cH * 0.38)), GREEN);
    push(pr(lathe([[0.0, 0], [0.08, 0.04], [0.11, 0.12], [0.07, 0.22], [0, 0.25]], 6).rotateX(Math.PI).translate(0, y + cH * 0.05, reach - 0.12)), RED);
    push(pr(lathe([[0, 0], [0.045, 0.03], [0.03, 0.08], [0, 0.1]], 5).rotateX(Math.PI).translate(0, y + cH * 0.05 - 0.24, reach - 0.12)), WHITE);
  }
  y += cH;
  // abacus, up to the bracket seat (4.88)
  const ab = Math.max(0.16, 4.88 - y - 0.11);
  push(box(W + 0.42, 0.06, W + 0.42, 0, y, 0), PINK);
  push(box(W + 0.36, ab, W + 0.36, 0, y + 0.06, 0), MINT);
  push(box(W + 0.42, 0.05, W + 0.42, 0, y + 0.06 + ab, 0), RED);
  y += ab + 0.11;
  // bracket: a mint/teal corbel running out toward the walkway, a red-and-white lotus bud pendant
  const bl = front ? 2.1 : 1.4;
  push(box(W * 0.9, 0.34, bl, 0, y, front ? 0.35 : 0), TEAL);
  push(box(W * 0.94, 0.05, bl + 0.04, 0, y + 0.28, front ? 0.35 : 0), RED);
  for (const sx of [-1, 1]) push(new THREE.CylinderGeometry(0.13, 0.13, bl * 0.8, 8).rotateX(Math.PI / 2).translate(sx * W * 0.47, y + 0.12, front ? 0.35 : 0), MINT);
  const bz = front ? 0.35 + bl / 2 - 0.15 : bl / 2 - 0.15;
  push(lathe([[0.0, 0], [0.11, 0.06], [0.14, 0.16], [0.08, 0.28], [0, 0.3]], 8).rotateX(Math.PI).translate(0, y + 0.02, bz), RED);
  push(lathe([[0.0, 0], [0.06, 0.04], [0.04, 0.1], [0, 0.12]], 6).rotateX(Math.PI).translate(0, y - 0.24, bz), WHITE);
  y += 0.34;
  const yaliFrom = P.length;
  if (front) {
    // the crouching yali, facing the walkway: haunches over the pillar, chest and head out over the bracket
    const G2 = 0xd6a632;
    push(new THREE.SphereGeometry(0.36, 10, 7).scale(0.85, 0.85, 1.55).translate(0, y + 0.3, 0.0), GOLD);
    push(new THREE.SphereGeometry(0.3, 9, 7).scale(0.9, 1.05, 0.9).translate(0, y + 0.42, 0.55), GOLD);
    push(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 6).translate(0.18, y + 0.2, 0.78), G2);
    push(new THREE.CylinderGeometry(0.08, 0.07, 0.4, 6).rotateX(-0.9).translate(-0.18, y + 0.42, 0.86), G2);
    const hz = 0.92, hy = y + 0.82;
    push(new THREE.TorusGeometry(0.3, 0.09, 6, 14).translate(0, hy, hz - 0.08), G2);
    push(new THREE.SphereGeometry(0.27, 10, 8).scale(1, 1.05, 0.95).translate(0, hy, hz), GOLD);
    push(new THREE.SphereGeometry(0.15, 8, 6).scale(1.2, 0.9, 1.2).translate(0, hy - 0.06, hz + 0.24), GOLD);
    push(box(0.3, 0.07, 0.18, 0, hy - 0.2, hz + 0.24), WHITE);
    push(box(0.26, 0.05, 0.16, 0, hy - 0.27, hz + 0.2), RED);
    for (const sx of [-1, 1]) {
      push(new THREE.SphereGeometry(0.065, 7, 5).translate(sx * 0.12, hy + 0.09, hz + 0.21), WHITE);
      push(new THREE.SphereGeometry(0.032, 5, 4).translate(sx * 0.12, hy + 0.09, hz + 0.27), 0x1f4f9a);
      push(new THREE.TorusGeometry(0.07, 0.025, 4, 8, Math.PI * 1.5).rotateY(Math.PI / 2).translate(sx * 0.2, hy + 0.3, hz - 0.05), GOLD);
    }
    push(box(0.22, 0.26, 0.12, 0, hy - 0.52, hz + 0.12), BLUE);
    push(new THREE.TorusGeometry(0.14, 0.04, 4, 10, Math.PI * 1.5).rotateY(Math.PI / 2).translate(0, y + 0.55, -0.55), G2);
  } else {
    push(box(W * 0.9, 0.5, W * 0.9, 0, y, 0), CREAM2);
  }
  for (const p of P.slice(yaliFrom)) if (front) p.g.translate(0, -y, -0.3).scale(1.3, 1.3, 1.3).translate(0, y, 0.3);
  const g = mergeRelief(P);
  g.computeBoundingSphere();
  return g;
}

/** Distant stand-in for the corridor pillar: the same masses and paint in a few hundred triangles. */
export function pillarLow(front: boolean) {
  const P: { g: THREE.BufferGeometry; c?: THREE.ColorRepresentation }[] = [];
  const W = 1.05;
  const add = (g: THREE.BufferGeometry, c: number) => P.push({ g, c });
  add(box(W + 0.3, 0.6, W + 0.3, 0, 0, 0), CREAM2);
  add(box(W, 1.3, W, 0, 0.6, 0), CREAM);
  add(box(W - 0.4, 1.06, 0.04, 0, 0.72, W / 2 - 0.01), 0x9a8460);
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.56, 8).translate(0, 2.18, 0), CREAM2);
  add(box(W, 0.8, W, 0, 2.46, 0), CREAM);
  add(box(W - 0.4, 0.56, 0.04, 0, 2.58, W / 2 - 0.01), 0x9a8460);
  add(new THREE.CylinderGeometry(0.34, 0.5, 0.7, 8).translate(0, 3.61, 0), CREAM2);
  add(box(W + 0.12, 0.14, W + 0.12, 0, 3.96, 0), RED);
  add(box(W * 0.8, 0.36, W * 0.8, 0, 4.1, 0), BLUE);
  add(box(0.4, 0.22, W + 1.0, 0, 4.24, 0), BLUE);
  add(box(W + 1.0, 0.22, 0.4, 0, 4.24, 0), BLUE);
  add(box(W + 0.4, 0.27, W + 0.4, 0, 4.46, 0), MINT);
  const bl = front ? 2.1 : 1.4;
  add(box(W * 0.9, 0.34, bl, 0, 4.88, front ? 0.35 : 0), TEAL);
  if (front) {
    add(box(0.62, 0.62, 1.2, 0, 5.21, 0.2), GOLD);
    add(box(0.6, 0.6, 0.5, 0, 5.75, 0.92), GOLD);
    add(box(0.22, 0.26, 0.12, 0, 5.51, 1.04), BLUE);
  } else add(box(W * 0.9, 0.5, W * 0.9, 0, 5.22, 0), CREAM2);
  const g = mergeParts(P);
  g.computeBoundingSphere();
  return g;
}

/**
 * Relief atlas for the pillar panels: 4 columns (chosen per pillar) × 2 rows (lower block: standing
 * and seated figures in niches; upper block: lotus, hamsa pair, fish pair, kirtimukha).
 * Returns the colour map (all cream enamel, the sunk ground a shade darker, small maroon tablets)
 * and the height map (white = raised).
 */
export function reliefTextures() {
  const CW = 256, H = 640, LH = 400; // lower cells 256×400, upper 256×240
  const mk = () => { const c = document.createElement('canvas'); c.width = CW * 4; c.height = H; return c; };
  const hc = mk(), cc = mk();
  const h = hc.getContext('2d')!, c = cc.getContext('2d')!;
  h.fillStyle = '#ffffff'; h.fillRect(0, 0, CW * 4, H);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, CW * 4, H);
  // everything is cream enamel, as in c06: the carving reads by its shadows; only small inset tablets
  // are picked out in maroon
  const both = (fn: (x: CanvasRenderingContext2D, hgt: boolean) => void) => { fn(h, true); fn(c, false); };
  const RAISED = '#f1e4c0', GROUND = '#d6c399', MAR = '#7a2a20';
  const lv = (x: CanvasRenderingContext2D, hgt: boolean, l: number, col = RAISED) => { x.fillStyle = hgt ? `rgb(${l},${l},${l})` : col; x.strokeStyle = x.fillStyle; };
  /** arch-topped sunk sub-panel with a raised rim */
  const archPanel = (x: CanvasRenderingContext2D, hgt: boolean, x0: number, y0: number, w: number, hh: number) => {
    lv(x, hgt, 170);
    x.lineWidth = 9;
    x.beginPath(); x.moveTo(x0, y0 + hh); x.lineTo(x0, y0 + w / 2); x.arc(x0 + w / 2, y0 + w / 2, w / 2, Math.PI, 0); x.lineTo(x0 + w, y0 + hh); x.closePath(); x.stroke();
  };
  const figure = (x: CanvasRenderingContext2D, hgt: boolean, cx: number, top: number, s: number, pose: number) => {
    lv(x, hgt, 215);
    x.lineCap = 'round';
    // crown, head, torso
    x.beginPath(); x.moveTo(cx - 13 * s, top + 34 * s); x.lineTo(cx - 8 * s, top); x.lineTo(cx + 8 * s, top); x.lineTo(cx + 13 * s, top + 34 * s); x.fill();
    x.beginPath(); x.ellipse(cx, top + 48 * s, 15 * s, 18 * s, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(cx - 24 * s, top + 70 * s); x.quadraticCurveTo(cx, top + 62 * s, cx + 24 * s, top + 70 * s); x.lineTo(cx + 15 * s, top + 132 * s); x.lineTo(cx - 15 * s, top + 132 * s); x.fill();
    x.lineWidth = 9 * s;
    if (pose === 0) {
      // hands joined at the chest (anjali): a devotee, as the Sethupathi donor figures
      for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(cx + sd * 22 * s, top + 76 * s); x.lineTo(cx + sd * 18 * s, top + 104 * s); x.lineTo(cx, top + 88 * s); x.stroke(); }
    } else {
      // four-armed deity: upper hands raised holding emblems, lower in blessing
      for (const sd of [-1, 1]) {
        x.beginPath(); x.moveTo(cx + sd * 22 * s, top + 74 * s); x.lineTo(cx + sd * 40 * s, top + 50 * s); x.stroke();
        x.beginPath(); x.arc(cx + sd * 42 * s, top + 42 * s, 7 * s, 0, 7); x.fill();
        x.beginPath(); x.moveTo(cx + sd * 22 * s, top + 80 * s); x.lineTo(cx + sd * 34 * s, top + 118 * s); x.stroke();
      }
    }
    // draped lower garment flaring to the ankles, feet on a small lotus pedestal
    x.beginPath(); x.moveTo(cx - 20 * s, top + 128 * s); x.lineTo(cx + 20 * s, top + 128 * s); x.lineTo(cx + 26 * s, top + 196 * s); x.lineTo(cx - 26 * s, top + 196 * s); x.fill();
    x.beginPath(); x.ellipse(cx, top + 204 * s, 34 * s, 9 * s, 0, 0, 7); x.fill();
    // incised detail: necklace, girdle, garment pleats
    lv(x, hgt, 150, '#c9b27e');
    x.lineWidth = 3 * s;
    x.beginPath(); x.arc(cx, top + 70 * s, 16 * s, 0.3, Math.PI - 0.3); x.stroke();
    x.beginPath(); x.moveTo(cx - 18 * s, top + 130 * s); x.lineTo(cx + 18 * s, top + 130 * s); x.stroke();
    for (const d of [-10, 0, 10]) { x.beginPath(); x.moveTo(cx + d * s, top + 136 * s); x.lineTo(cx + d * 1.25 * s, top + 192 * s); x.stroke(); }
  };
  const lotus = (x: CanvasRenderingContext2D, hgt: boolean, cx: number, cy: number, r: number, n: number) => {
    lv(x, hgt, 210);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.beginPath(); x.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, r * 0.17, a, 0, 7); x.fill();
    }
    lv(x, hgt, 235);
    x.beginPath(); x.arc(cx, cy, r * 0.28, 0, 7); x.fill();
    lv(x, hgt, 160, '#c9b27e');
    x.lineWidth = 3;
    x.beginPath(); x.arc(cx, cy, r * 1.02, 0, 7); x.stroke();
  };
  for (let k = 0; k < 4; k++) {
    for (const upper of [false, true]) {
      const x0 = k * CW, y0 = upper ? 0 : H - LH, w = CW, hh = upper ? H - LH : LH;
      both((x, hgt) => { x.fillStyle = hgt ? '#3a3a3a' : GROUND; x.fillRect(x0 + 6, y0 + 6, w - 12, hh - 12); });
      both((x, hgt) => { x.strokeStyle = hgt ? '#a0a0a0' : RAISED; x.lineWidth = 8; x.strokeRect(x0 + 16, y0 + 16, w - 32, hh - 32); });
      const cx = x0 + w / 2;
      if (!upper) {
        both((x, hgt) => {
          if (k === 0) {
            // two tall arch-topped sub-panels with a maroon tablet between their heads (c06)
            archPanel(x, hgt, x0 + 34, y0 + 40, 80, hh - 80);
            archPanel(x, hgt, x0 + w - 114, y0 + 40, 80, hh - 80);
            lv(x, hgt, 120, MAR); x.fillRect(cx - 9, y0 + 50, 18, 70);
          } else if (k === 1 || k === 3) {
            archPanel(x, hgt, x0 + 36, y0 + 36, w - 72, hh - 70);
            figure(x, hgt, cx, y0 + 96, 1.1, k === 1 ? 1 : 0);
          } else {
            // a lotus medallion over a tall sunk panel with a maroon tablet
            lotus(x, hgt, cx, y0 + 100, 64, 12);
            archPanel(x, hgt, x0 + 70, y0 + 186, w - 140, hh - 220);
            lv(x, hgt, 120, MAR); x.fillRect(cx - 14, y0 + 240, 28, 90);
          }
        });
      } else {
        const cy = y0 + hh / 2;
        both((x, hgt) => {
          if (k === 0) lotus(x, hgt, cx, cy, 82, 12);
          else if (k === 1) {
            // square rosette: four-petal flower in a diamond
            lv(x, hgt, 200);
            x.beginPath(); x.moveTo(cx, cy - 84); x.lineTo(cx + 84, cy); x.lineTo(cx, cy + 84); x.lineTo(cx - 84, cy); x.closePath(); x.lineWidth = 10; x.stroke();
            lotus(x, hgt, cx, cy, 52, 8);
          } else if (k === 2) {
            // the twin fish (the Sethupathis' and the Pandyas' emblem), tails crossed
            lv(x, hgt, 215);
            for (const s of [-1, 1]) {
              x.beginPath(); x.ellipse(cx + s * 30, cy - 10, 18, 56, s * 0.22, 0, 7); x.fill();
              x.beginPath(); x.moveTo(cx + s * 22, cy + 40); x.lineTo(cx - s * 6, cy + 82); x.lineTo(cx + s * 34, cy + 80); x.fill();
            }
          } else {
            // a creeper scroll
            lv(x, hgt, 205);
            x.lineWidth = 10; x.lineCap = 'round';
            x.beginPath(); x.moveTo(x0 + 34, cy);
            for (let i = 0; i < 4; i++) x.quadraticCurveTo(x0 + 34 + i * 48 + 24, cy + (i % 2 ? 46 : -46), x0 + 34 + (i + 1) * 48, cy);
            x.stroke();
            for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(x0 + 58 + i * 48, cy + (i % 2 ? 26 : -26), 13, 0, 7); x.fill(); }
          }
        });
      }
    }
  }
  // soften the height map so the bump has slopes rather than steps
  const soft = mk(), s = soft.getContext('2d')!;
  s.filter = 'blur(3px)';
  s.drawImage(hc, 0, 0);
  const tex = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(cc, true), bump: tex(soft, false) };
}

interface Opening { u: number; w: number; side: -1 | 1 }

interface ArmOpts {
  L: number;
  xf: THREE.Matrix4;
  open: Opening[];
  /** draw the outer granite skin on these sides (exterior faces) */
  skin: (-1 | 1)[];
  /** omit the side wall entirely on this side (e.g. replaced by the outer wall) */
  noWall?: (-1 | 1)[];
  name: string;
}

/** Build one corridor arm into the batches. Returns nothing; pillars go into the given instance sets. */
function arm(B: Batch, R: RM, P: Physics, front: Instances, back: Instances, tubes: Instances, o: ArmOpts) {
  B.xf = o.xf;
  {
    const org = new THREE.Vector3().setFromMatrixPosition(o.xf), dir = new THREE.Vector3(1, 0, 0).transformDirection(o.xf);
    const axisZ = Math.abs(dir.z) > 0.5;
    let n = 0;
    for (let u = ARM.pitch; u < o.L - 1; u += ARM.pitch * 2) n++;
    TUBE_ARMS.push({ axisZ, c: axisZ ? org.x : org.z, u0: axisZ ? org.z : org.x, L: o.L, n });
  }
  const { L } = o;
  const A = ARM;
  const inOpen = (u: number, side: number, pad = 0) => o.open.some((p) => p.side === side && Math.abs(u - p.u) < p.w / 2 + pad);
  // walkway floor (flagstones) and crossing floors where openings cut the platforms
  B.add(R.walkway, new THREE.BoxGeometry(L, 0.2, A.wall * 2).translate(L / 2, -0.075, 0));
  // platforms per side, split at openings
  for (const side of [-1, 1] as const) {
    const cuts = o.open.filter((p) => p.side === side).map((p) => [p.u - p.w / 2, p.u + p.w / 2]).sort((a, b) => a[0] - b[0]);
    let u0 = 0;
    const segs: [number, number][] = [];
    for (const [a, b] of cuts) { if (a > u0) segs.push([u0, a]); u0 = Math.max(u0, b); }
    if (u0 < L) segs.push([u0, L]);
    for (const [a, b] of segs) {
      const len = b - a, cu = (a + b) / 2;
      const vIn = A.walk, vOut = A.plat, vc = side * (vIn + vOut) / 2, vw = vOut - vIn;
      // platform (jagati): unpainted, weathered grey granite with stepped mouldings, dark and water-stained at
      // the foot (mats.ts `jagati`), lighter toward the coping
      const GR = 0x7a7166, GR2 = 0x5e574f;
      B.add(R.jagati, new THREE.BoxGeometry(len, A.platY - 0.12, vw).translate(cu, (A.platY - 0.12) / 2, vc), GR);
      B.add(R.jagati, new THREE.BoxGeometry(len, 0.26, 0.2).translate(cu, 0.13, side * (vIn + 0.02)), GR2);
      B.add(R.jagati, new THREE.BoxGeometry(len, 0.16, 0.12).translate(cu, 0.62, side * (vIn - 0.0)), GR2);
      B.add(R.jagati, new THREE.BoxGeometry(len, 0.1, 0.1).translate(cu, A.platY - 0.4, side * (vIn - 0.01)), GR2);
      B.add(R.jagati, new THREE.BoxGeometry(len, 0.14, vw + 0.16).translate(cu, A.platY - 0.12 + 0.07, side * (vIn + vOut - 0.16) / 2), 0xd8d2c4);
      // the dark carved band along the platform's edge: a deep groove under the coping, a beaded roll
      B.add(R.paint, new THREE.BoxGeometry(len, 0.2, 0.06).translate(cu, A.platY - 0.34, side * (vIn - 0.05)), 0x2e2a26);
      B.add(R.jagati, new THREE.CylinderGeometry(0.07, 0.07, len, 8).rotateZ(Math.PI / 2).translate(cu, A.platY - 0.5, side * (vIn - 0.03)), 0x4a443c);
      B.add(R.paint, new THREE.BoxGeometry(len, 0.08, 0.04).translate(cu, 0.95, side * (vIn - 0.02)), 0x2e2a26);
      // collider for the platform (the walkway is sunk 1.5 m)
      solidLocal(P, o.xf, a, 0, side * vIn, b, A.platY, side * vOut);
      // pillars
      for (let u = a + A.pitch / 2; u < b - 0.3; u += A.pitch) {
        front.mats.push(o.xf.clone().multiply(new THREE.Matrix4().makeTranslation(u, A.platY, side * A.row1).multiply(new THREE.Matrix4().makeRotationY(side > 0 ? Math.PI : 0))));
        back.mats.push(o.xf.clone().multiply(new THREE.Matrix4().makeTranslation(u, A.platY, side * A.row2).multiply(new THREE.Matrix4().makeRotationY(side > 0 ? Math.PI : 0))));
      }
    }
    // side wall (inner paint skin + granite core), split at openings; with a painted dado
    if (!o.noWall?.includes(side)) {
      const wsegs: [number, number][] = [];
      let w0 = 0;
      for (const [a, b] of cuts) { if (a > w0) wsegs.push([w0, a]); w0 = Math.max(w0, b); }
      if (w0 < L) wsegs.push([w0, L]);
      for (const [a, b] of wsegs) {
        const len = b - a, cu = (a + b) / 2;
        B.add(R.granite, new THREE.BoxGeometry(len, A.roof + 0.6, A.wall - A.plat - 0.1).translate(cu, (A.roof + 0.6) / 2, side * (A.plat + 0.1 + (A.wall - A.plat - 0.1) / 2)));
        B.add(R.paint, new THREE.BoxGeometry(len, A.sideCeil - A.platY, 0.1).translate(cu, A.platY + (A.sideCeil - A.platY) / 2, side * (A.plat + 0.05)), WHITE);
        B.add(R.paint, new THREE.BoxGeometry(len, 1.0, 0.04).translate(cu, A.platY + 0.5, side * (A.plat - 0.0)), 0xb84a2a);
        solidLocal(P, o.xf, a, 0, side * A.plat, b, A.roof, side * A.wall);
      }
    }
    // beams over each pillar row, painted in bands
    for (const v of [A.row1, A.row2]) {
      const by = A.pillarTop + 0.55;
      B.add(R.paint, new THREE.BoxGeometry(L, 0.18, 1.0).translate(L / 2, by + 0.09, side * v), RED);
      B.add(R.paint, new THREE.BoxGeometry(L, 0.42, 0.9).translate(L / 2, by + 0.39, side * v), v === A.row1 ? CREAM : CREAM2);
      B.add(R.paint, new THREE.BoxGeometry(L, 0.1, 0.94).translate(L / 2, by + 0.65, side * v), GREEN);
      B.add(R.paint, new THREE.BoxGeometry(L, 0.08, 0.96).translate(L / 2, by + 0.75, side * v), YELLOW);
    }
    // corbel courses stepping up from the front beams to the walkway ceiling
    const cy = A.beamTop;
    B.add(R.paint, new THREE.BoxGeometry(L, 0.5, 0.9).translate(L / 2, cy + 0.25, side * (A.row1 - 0.55)), BLUE);
    B.add(R.paint, new THREE.BoxGeometry(L, 0.08, 0.95).translate(L / 2, cy + 0.04, side * (A.row1 - 0.55)), YELLOW);
    B.add(R.paint, new THREE.BoxGeometry(L, 0.5, 0.6).translate(L / 2, cy + 0.75, side * (A.walk + 0.05)), RED);
    B.add(R.paint, new THREE.BoxGeometry(L, 0.06, 0.66).translate(L / 2, cy + 0.53, side * (A.walk + 0.05)), WHITE);
    // side-bay ceilings (painted panels) over the platform
    const sc = new THREE.PlaneGeometry(L, A.plat - A.row1 + 0.5).rotateX(Math.PI / 2);
    const uv = sc.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), (uv.getX(i) * L) / 12);
    sc.translate(L / 2, A.sideCeil + 0.15, side * (A.row1 + A.plat) / 2);
    B.add(R.sideCeiling, sc, null, true);
  }
  // the walkway ceiling: one long painted panel, 4 bays per texture repeat
  const cg = new THREE.PlaneGeometry(L, (A.walk + 0.05) * 2).rotateX(Math.PI / 2);
  const uv = cg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), (uv.getX(i) * L) / 12);
  cg.translate(L / 2, A.ceil - 0.02, 0);
  B.add(R.ceiling, cg, null, true);
  // roof slab and the parapet on top
  B.add(R.roofRed, new THREE.BoxGeometry(L, A.roof - A.ceil, A.wall * 2).translate(L / 2, (A.roof + A.ceil) / 2, 0));
  for (const side of [-1, 1]) {
    const vw = A.wall - A.walk - 0.6;
    B.add(R.roofRed, new THREE.BoxGeometry(L, A.roof - A.sideCeil - 0.15, vw).translate(L / 2, (A.roof + A.sideCeil + 0.15) / 2, side * (A.wall - vw / 2)));
  }
  for (const side of [-1, 1]) B.add(R.granite, new THREE.BoxGeometry(L, 0.7, 0.45).translate(L / 2, A.roof + 0.35, side * (A.wall - 0.22)));
  // tube lights down the walkway (every other bay), as in the temple today
  for (let u = A.pitch; u < L - 1; u += A.pitch * 2) {
    tubes.mats.push(o.xf.clone().multiply(new THREE.Matrix4().makeTranslation(u, A.ceil - 0.06, 0)));
  }
  B.xf = null;
}

/** Axis-aligned collider from local arm-space corners. */
function solidLocal(P: Physics, xf: THREE.Matrix4, u0: number, y0: number, v0: number, u1: number, y1: number, v1: number) {
  const a = new THREE.Vector3(u0, y0, v0).applyMatrix4(xf), b = new THREE.Vector3(u1, y1, v1).applyMatrix4(xf);
  P.solid(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
}

/** local u → world: arm running along +z from (x, z0) (v>0 = −x) */
const alongZ = (x: number, z0: number) => new THREE.Matrix4().makeTranslation(x, 0, z0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
/** arm running along +x from (x0, z) (v>0 = +z) */
const alongX = (x0: number, z: number) => new THREE.Matrix4().makeTranslation(x0, 0, z);

export const SPUR = { westZ0: -131, northX1: 89, southX0: -87 };

export function buildCorridors(root: THREE.Group, R: RM, P: Physics) {
  const g = new THREE.Group();
  g.name = 'corridor';
  root.add(g);
  const B = new Batch();
  const tubeGeo = new THREE.BoxGeometry(1.25, 0.07, 0.1);
  const tubes = new Instances(tubeGeo, R.tube);
  const frontGeo = pillarGeometry(true), backGeo = pillarGeometry(false);
  const pillarMat = pillarMaterial(R);
  const sets: { f: Instances; b: Instances }[] = [];
  const mk = () => { const s = { f: new Instances(frontGeo, R.paint), b: new Instances(backGeo, R.paint) }; sets.push(s); return s; };
  const { xN, xS, zW, zE } = RING;
  const W = ARM.wall;
  const z0 = zW - W, z1 = zE + W;
  const openW = ARM.walk * 2 + 0.2;
  // north arm: runs along +z at x = xN; v>0 is −x (inner, the second prakara side)
  let s = mk();
  arm(B, R, P, s.f, s.b, tubes, {
    L: z1 - z0, xf: alongZ(xN, z0), name: 'north',
    open: [
      { u: 0 - z0, w: openW, side: -1 }, // to the north gopuram
      { u: zW - z0, w: openW, side: 1 }, { u: zE - z0, w: openW, side: 1 }, // corners
    ],
    skin: [-1, 1],
  });
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, {
    L: z1 - z0, xf: alongZ(xS, z0), name: 'south',
    open: [
      { u: 0 - z0, w: openW, side: 1 }, // to the south gopuram (v>0 = −x = outward here)
      { u: zW - z0, w: openW, side: -1 }, { u: zE - z0, w: openW, side: -1 },
    ],
    skin: [-1, 1],
  });
  // east and west arms run along +x between the north and south arms' inner walls; v>0 is +z
  const x0 = xS + W, x1 = xN - W;
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, {
    L: x1 - x0, xf: alongX(x0, zE), name: 'east',
    // the east entrance; the Rajagopuram; the door to the court of the first four theerthams
    open: [{ u: 0 - x0, w: 6.2, side: 1 }, { u: 0 - x0, w: 4.6, side: -1 }, { u: -33 - x0, w: 3.4, side: -1 }],
    skin: [-1, 1],
  });
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, {
    L: x1 - x0, xf: alongX(x0, zW), name: 'west',
    open: [{ u: 0 - x0, w: openW, side: -1 }, { u: 0 - x0, w: openW, side: 1 }], // the Chokkattan crossing
    skin: [-1, 1],
  });
  // the Chokkattan corridor: west gopuram → west arm, and on to the second prakara (Sethu Madhava)
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, { L: zW - W - SPUR.westZ0, xf: alongZ(0, SPUR.westZ0), name: 'chokkattan', open: [], skin: [-1, 1] });
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, { L: PRAK2.z0 - (zW + W), xf: alongZ(0, zW + W), name: 'sethu', open: [], skin: [-1, 1] });
  // short corridors to the north and south gopurams
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, { L: SPUR.northX1 - (xN + W), xf: alongX(xN + W, 0), name: 'north-spur', open: [], skin: [-1, 1] });
  s = mk();
  arm(B, R, P, s.f, s.b, tubes, { L: (xS - W) - SPUR.southX0, xf: alongX(SPUR.southX0, 0), name: 'south-spur', open: [], skin: [-1, 1] });

  // the chessboard floor of the Chokkattan crossing
  const ck = 1.3;
  for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) {
    B.add((i + j) % 2 ? R.paint : R.paint, new THREE.BoxGeometry(ck, 0.02, ck).translate(i * ck + ck / 2, 0.01, zW + j * ck + ck / 2), (i + j) % 2 ? 0x2e2b28 : 0xd8d2c6);
  }
  B.flush(g, true, 'corridor');
  // pillars: bucket into ~24 m cells, each a LOD of (full instanced pillars | box-modelled stand-ins)
  const loF = pillarLow(true), loB = pillarLow(false);
  const cells = new Map<string, { f: THREE.Matrix4[]; b: THREE.Matrix4[] }>();
  const p = new THREE.Vector3();
  for (const st of sets) {
    for (const [list, key] of [[st.f.mats, 'f'], [st.b.mats, 'b']] as const) {
      for (const m of list) {
        p.setFromMatrixPosition(m);
        const k = `${Math.floor(p.x / 24)},${Math.floor(p.z / 24)}`;
        let c = cells.get(k);
        if (!c) cells.set(k, (c = { f: [], b: [] }));
        c[key].push(m);
      }
    }
  }
  const inst = (geo: THREE.BufferGeometry, ms: THREE.Matrix4[], inv: THREE.Matrix4) => {
    const im = new THREE.InstancedMesh(geo, geo === frontGeo || geo === backGeo ? pillarMat : R.paint, ms.length);
    ms.forEach((m, i) => im.setMatrixAt(i, inv.clone().multiply(m)));
    im.castShadow = false;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    return im;
  };
  for (const { f, b } of cells.values()) {
    const c = new THREE.Vector3();
    for (const m of [...f, ...b]) c.add(p.setFromMatrixPosition(m));
    c.divideScalar(f.length + b.length);
    const inv = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
    const hi = new THREE.Group(), lo = new THREE.Group();
    if (f.length) { hi.add(inst(frontGeo, f, inv)); lo.add(inst(loF, f, inv)); }
    if (b.length) { hi.add(inst(backGeo, b, inv)); lo.add(inst(loB, b, inv)); }
    const lod = new THREE.LOD();
    lod.position.copy(c);
    lod.addLevel(hi, 0);
    lod.addLevel(lo, 42);
    g.add(lod);
  }
  tubes.flush(g, false);
  // every tube lights the stone round it (analytic, see tubeLit): pillars, beams, platforms, walkway
  // (the platforms' faces and the floor also take the light bounced off the polished walkway: a gain)
  for (const [m, k, gain] of [[R.paint, 'paint', 1], [pillarMat, 'pillar', 1], [R.jagati, 'jagati', 3.2], [R.walkway, 'walkway', 1.6]] as const) tubeLit(m, k, gain);
  // each tube throws a pool of light on the painted ceiling round it (additive halo)
  const halo = new Instances(new THREE.PlaneGeometry(2.6, 2.6).rotateX(Math.PI / 2), haloMaterial());
  const tubePos = tubes.mats.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
  for (const t of tubePos) halo.at(t.x, t.y + 0.035, t.z);
  const hm = halo.flush(g, false)!;
  hm.receiveShadow = false;
  hm.renderOrder = 3;
  void OUTER;
  return { group: g, tubes: tubePos };
}

export { CREAM, CREAM2, RED, MAROON, GREEN, YELLOW, BLUE, PINK, GOLD, WHITE, ORANGE };

/** Soft radial glow for the ceiling round each tube light. */
function haloMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,235,0.9)');
  gr.addColorStop(0.25, 'rgba(255,245,225,0.35)');
  gr.addColorStop(1, 'rgba(255,240,220,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: 0x4a4640 });
}

/** Corridor arms in world terms, for the tube-light shader: axis, centreline, start, length, tube count. */
const TUBE_ARMS: { axisZ: boolean; c: number; u0: number; L: number; n: number }[] = [];

/**
 * The corridor is lit only by its tube lights (one every second bay down the walkway centre), so the
 * stone falls to a third of its brightness between them. Rather than hundreds of real point lights,
 * every corridor material adds the diffuse light of the three nearest tubes analytically: each arm is a
 * line of tubes at (centreline, ceiling − 0.06, u0 + pitch · (1 + 2k)).
 */
function tubeLit(m: THREE.Material, key: string, gain = 1) {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  const f = (v: number) => v.toFixed(3);
  const arms = TUBE_ARMS.map((a) => `vec4(${a.axisZ ? '1.0' : '0.0'}, ${f(a.c)}, ${f(a.u0)}, ${f(a.n - 1)})`).join(', ');
  const N = TUBE_ARMS.length;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTubeW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 tw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            tw = instanceMatrix * tw;
          #endif
          vTubeW = (modelMatrix * tw).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTubeW;
        const vec4 TUBE_ARM[${N}] = vec4[${N}](${arms});
        vec3 tubeLight(vec3 wp, vec3 wn) {
          float acc = 0.0;
          const float PIT = ${f(ARM.pitch)};
          for (int i = 0; i < ${N}; i++) {
            vec4 a = TUBE_ARM[i];
            bool z = a.x > 0.5;
            float along = (z ? wp.z : wp.x) - a.z;
            float perp = (z ? wp.x : wp.z) - a.y;
            if (abs(perp) > ${f(ARM.wall)} || wp.y > ${f(ARM.roof)}) continue;
            float k0 = floor((along - PIT) / (2.0 * PIT) + 0.5);
            if (k0 < -1.0 || k0 > a.w + 1.0) continue;
            for (int j = -1; j <= 1; j++) {
              float k = k0 + float(j);
              if (k < 0.0 || k > a.w) continue;
              float tu = a.z + PIT * (1.0 + 2.0 * k);
              vec3 tp = z ? vec3(a.y, ${f(ARM.ceil - 0.06)}, tu) : vec3(tu, ${f(ARM.ceil - 0.06)}, a.y);
              vec3 L = tp - wp;
              float d2 = dot(L, L);
              acc += max(dot(wn, L * inversesqrt(d2)), 0.0) / (1.0 + d2 * 0.09);
            }
          }
          return vec3(0.93, 0.96, 1.0) * acc;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * tubeLight(vTubeW, inverseTransformDirection(normal, viewMatrix)) * ${f(TUBE_I * gain)};`);
  };
  m.customProgramCacheKey = () => prevKey + '-tube-' + key;
  m.needsUpdate = true;
}
/** strength of the analytic tube lights */
const TUBE_I = 2.0;

/** The carved pillars: enamel paint (vertex colour) × relief atlas on the sunk panels, with bump. */
function pillarMaterial(R: RM) {
  const { map, bump } = reliefTextures();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, map, bumpMap: bump, bumpScale: 3.0 });
  m.envMap = R.paint.envMap;
  m.envMapIntensity = R.paint.envMapIntensity;
  m.onBeforeCompile = (sh) => {
    // grime: oil-lamp soot and hands darken the enamel toward the foot and under the capitals, and no two
    // pillars were repainted the same year
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPL;\nvarying float vPI;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPL = position;
        #ifdef USE_INSTANCING
          vPI = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vPI = 0.5;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPL;
        varying float vPI;
        float ph(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float pn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(ph(i), ph(i + vec3(1,0,0)), f.x), mix(ph(i + vec3(0,1,0)), ph(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(ph(i + vec3(0,0,1)), ph(i + vec3(1,0,1)), f.x), mix(ph(i + vec3(0,1,1)), ph(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float foot = 1.0 - smoothstep(0.0, 1.2, vPL.y);
          float mott = pn(vPL * 5.0 + vPI * 17.0) * 0.6 + pn(vPL * 19.0) * 0.4;
          diffuseColor.rgb *= (0.86 + 0.14 * vPI) * (1.0 - 0.22 * foot) * (0.9 + 0.16 * mott);
        }`);
    // pick one of the four relief columns per pillar from its position; non-panel parts (uv < 0) stay plain
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        if (uv.x >= 0.0) {
          float col = mod(floor(instanceMatrix[3].x * 0.41 + instanceMatrix[3].z * 0.41 + 0.5), 4.0);
          vMapUv.x = (uv.x + col) * 0.25;
          vBumpMapUv.x = vMapUv.x;
        }
      #endif`);
  };
  m.customProgramCacheKey = () => 'rameshwaram-pillar';
  return m;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scanMaterial } from '../../engine/materials';
import { archPanelGeometry, type Physics } from '../../engine/kit';
import type { XZ } from './osm';
import { StatueBatch, seated, standing, nandi, shivaOnNaga } from './statues';

/**
 * Shri Mahakal Lok (2022), along its real alignment (OpenStreetMap: the Mahakal Lok outline and its
 * footway; Esri World Imagery for the circles and pools). In this model (+x east, +z south, the temple
 * at the origin) Rudra Sagar lies west and south-west of the temple, and Mahakal Lok runs for ~900 m
 * along the lake's east shore: from the temple's south-west corner (-112, 62) south-east to the entrance
 * plaza at (180, 700), where the Nandi Dwar and Pinaki Dwar open on the street from Hari Phatak and the
 * Kamal Kund lotus pond holds the seated Shiva. A lakefront path links the corridor's north end with the
 * road along the north of the precinct, where the general darshan queue is entered by the north gate.
 *
 * Sources: OSM ways 1162957245 (Mahakal Lok), the corridor footway, artwork nodes "Shiva" and
 * "Saptarshi"; Wanderlog / Google plus code 5QGC+G57 for the Nandi Dwar; Outlook Traveller, MP Tourism
 * and Drishti IAS (108 sandstone stambhas with Shiva's mudras and trishul tops, a 25 ft x 500 m mural
 * wall of Shiva Purana stories, 93 statues, Kamal Kund, Saptarishi Mandal); Wikimedia Commons photos
 * (Mahakal Corridor, Ujjain, MP; Mahakal Lok ujjain 1-2; Corridor of Ujjain).
 */

/** the corridor's walkway, north (temple end) to south (entrance plaza): the OSM footway */
export const CORRIDOR: XZ[] = [[-112, 62], [-85, 123], [-65, 164], [-28, 204], [20, 254], [75, 316], [129, 400], [155, 481], [217, 605], [236, 640]];
/** the lakefront path from the road north of the precinct down to the corridor's north end */
export const LAKE_LINK: XZ[] = [[-134, -58], [-139, -50], [-138, 1], [-133, 21], [-125, 34], [-112, 62]];
/** the road along the north of the precinct, from the lakefront to the north gate and on to the east lane */
export const PROMENADE: XZ[] = [[-136, -60], [-108, -58], [-77, -57], [-26, -58], [61, -59], [82, -55], [90, -51]];
export const KAMAL_KUND = { x: 182, z: 700, r: 26 };
export const SAPTARISHI = { x: 162, z: 643 };
export const NANDI_DWAR = { x: 222, z: 774, ry: 0.15 };
export const PINAKI_DWAR = { x: 164, z: 786, ry: 0.05 };
/** the entrance plaza round Kamal Kund */
export const PLAZA: XZ[] = [[118, 600], [236, 600], [252, 660], [252, 800], [120, 800], [110, 700]];
export const CORRIDOR_W = 12;

/** cumulative lengths along a polyline */
function lengths(p: XZ[]) {
  const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return s;
}
/** point, unit direction and left normal at distance d along a polyline */
export function along(p: XZ[], d: number) {
  const s = lengths(p);
  let i = 1;
  while (i < p.length - 1 && s[i] < d) i++;
  const L = s[i] - s[i - 1] || 1, t = Math.max(0, Math.min(1, (d - s[i - 1]) / L));
  const dx = (p[i][0] - p[i - 1][0]) / L, dz = (p[i][1] - p[i - 1][1]) / L;
  return { x: p[i - 1][0] + dx * L * t, z: p[i - 1][1] + dz * L * t, dx, dz, total: s[s.length - 1] };
}

/** a flat ribbon along a polyline (world-metre UVs, facing up) */
export function ribbonGeo(pts: XZ[], w: number, y: number) {
  const pos: number[] = [];
  const at = (i: number) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let k = 1;
    if (i > 0 && i < pts.length - 1) {
      const ax = pts[i][0] - a[0], az = pts[i][1] - a[1], al = Math.hypot(ax, az) || 1;
      k = Math.min(2, 1 / Math.max(0.5, (ax / al) * dx + (az / al) * dz));
    }
    return [pts[i][0] - dz * (w / 2) * k, pts[i][1] + dx * (w / 2) * k, pts[i][0] + dz * (w / 2) * k, pts[i][1] - dx * (w / 2) * k];
  };
  for (let i = 1; i < pts.length; i++) {
    const [ax, az, bx, bz] = at(i - 1), [cx, cz, dx, dz] = at(i);
    // two triangles, wound to face up
    for (const tri of [[ax, az, cx, cz, bx, bz], [bx, bz, cx, cz, dx, dz]]) {
      const [x0, z0, x1, z1, x2, z2] = tri;
      const up = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0) > 0;
      const v = up ? [x0, z0, x1, z1, x2, z2] : [x0, z0, x2, z2, x1, z1];
      for (let k = 0; k < 6; k += 2) pos.push(v[k], y, v[k + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv: number[] = [], n: number[] = [];
  for (let i = 0; i < pos.length; i += 3) { uv.push(pos[i], pos[i + 2]); n.push(0, 1, 0); }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}

/** a flat polygon at height y (world-metre UVs) */
function polyGeo(ring: XZ[], y: number, holes: XZ[][] = []) {
  const sh = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(sh, 24).rotateX(-Math.PI / 2).translate(0, y, 0);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return g;
}
const circle = (x: number, z: number, r: number, n = 48): XZ[] => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, z + Math.sin((i / n) * Math.PI * 2) * r] as XZ);

// ------------------------------------------------------------------ materials

let seed = 5521;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * The mural wall's carving as a height field: a plinth band, then panels of Shiva Purana scenes in
 * shallow relief (stylised figures — Shiva with the trishul, Parvati, Nandi, the sages, the chariot of
 * Tripurasur's slaying, Kailash, the Ganga descending — no faces), framed by bead borders, under a
 * cornice of lotus petals. 16 m of wall per tile, 7.6 m tall.
 */
function muralHeight() {
  const W = 2048, H = 972; // 128 px per metre
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#707070'; g.fillRect(0, 0, W, H);
  const m = (v: number) => v * 128;
  // plinth (0-1.0 m from the bottom) with two mouldings, cornice band at the top
  const yb = (yy: number) => H - m(yy);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, yb(1.0), W, m(0.16)); g.fillRect(0, yb(0.4), W, m(0.12));
  g.fillStyle = '#a8a8a8'; g.fillRect(0, yb(7.6), W, m(0.5));
  for (let x = 0; x < W; x += 48) { g.fillStyle = '#c0c0c0'; g.beginPath(); g.ellipse(x + 24, yb(7.25), 18, 26, 0, 0, Math.PI * 2); g.fill(); }
  // four panels of 4 m, each a scene
  for (let p = 0; p < 4; p++) {
    const x0 = p * m(4) + m(0.2), x1 = (p + 1) * m(4) - m(0.2), y0 = yb(6.9), y1 = yb(1.25);
    g.fillStyle = '#9c9c9c'; g.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
    g.fillStyle = '#5c5c5c'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // bead border
    g.fillStyle = '#b4b4b4';
    for (let x = x0; x < x1; x += 22) { g.beginPath(); g.arc(x, y0 + 6, 6, 0, 7); g.arc(x, y1 - 6, 6, 0, 7); g.fill(); }
    g.save();
    g.shadowColor = '#000'; g.shadowBlur = 0;
    const fig = (cx: number, base: number, hgt: number, wide = 1, raised = false) => {
      // a stylised standing figure: body, head disc, jata bun or crown, one arm raised holding a trishul
      const sc = hgt / 3;
      g.fillStyle = '#d6d6d6';
      g.beginPath(); g.ellipse(cx, base - sc * 2.6, sc * 0.32, sc * 0.36, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx, base - sc * 3.05, sc * 0.18, sc * 0.26, 0, 0, 7); g.fill();
      g.beginPath();
      g.moveTo(cx - sc * 0.55 * wide, base - sc * 2.15); g.lineTo(cx + sc * 0.55 * wide, base - sc * 2.15);
      g.lineTo(cx + sc * 0.42 * wide, base - sc * 1.0); g.lineTo(cx + sc * 0.6 * wide, base); g.lineTo(cx - sc * 0.6 * wide, base);
      g.lineTo(cx - sc * 0.42 * wide, base - sc * 1.0); g.closePath(); g.fill();
      g.lineWidth = sc * 0.18; g.strokeStyle = '#cfcfcf'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + sc * 0.5, base - sc * 2.0); g.lineTo(cx + sc * (raised ? 0.9 : 0.75), base - sc * (raised ? 2.9 : 1.4)); g.stroke();
      g.beginPath(); g.moveTo(cx - sc * 0.5, base - sc * 2.0); g.lineTo(cx - sc * 0.8, base - sc * 1.3); g.stroke();
      if (raised) {
        g.lineWidth = sc * 0.08;
        g.beginPath(); g.moveTo(cx + sc * 0.95, base); g.lineTo(cx + sc * 0.95, base - sc * 3.6); g.stroke();
        g.beginPath(); g.moveTo(cx + sc * 0.7, base - sc * 3.7); g.quadraticCurveTo(cx + sc * 0.75, base - sc * 3.3, cx + sc * 0.95, base - sc * 3.3);
        g.quadraticCurveTo(cx + sc * 1.15, base - sc * 3.3, cx + sc * 1.2, base - sc * 3.7); g.stroke();
      }
    };
    const ground = y1 - 20;
    const kind = (p + Math.floor(rnd() * 4)) % 4;
    if (kind === 0) {
      // Kailash: Shiva seated before the mountain, Nandi, two attendants
      g.fillStyle = '#8c8c8c'; g.beginPath(); g.moveTo(x0 + 40, ground); g.lineTo(x0 + m(1.6), y0 + 60); g.lineTo(x0 + m(2.4), y0 + 140); g.lineTo(x1 - 40, ground); g.fill();
      g.fillStyle = '#d0d0d0';
      g.beginPath(); g.ellipse(x0 + m(2), ground - 70, 120, 60, 0, 0, 7); g.fill();
      fig(x0 + m(2), ground - 90, 300, 1.1, true);
      g.beginPath(); g.ellipse(x0 + m(0.7), ground - 50, 110, 50, 0, 0, 7); g.fill(); // Nandi
      g.beginPath(); g.ellipse(x0 + m(0.95), ground - 105, 40, 38, 0, 0, 7); g.fill();
      fig(x0 + m(3.3), ground, 330);
    } else if (kind === 1) {
      // Shiva-Parvati's wedding: two figures under an arch, garlands, a row of sages
      g.strokeStyle = '#c4c4c4'; g.lineWidth = 26;
      g.beginPath(); g.arc(x0 + m(2), ground - m(2.6), m(1.4), Math.PI, 0); g.stroke();
      fig(x0 + m(1.6), ground, 470, 1.1, true);
      fig(x0 + m(2.4), ground, 430, 1.25);
      for (let k = 0; k < 3; k++) fig(x0 + m(0.35) + k * 70, ground, 230, 0.9);
      for (let k = 0; k < 2; k++) fig(x1 - m(0.35) - k * 80, ground, 250, 0.9);
    } else if (kind === 2) {
      // Tripurasur's slaying: Shiva drawing the bow on a chariot, horses, three cities above
      g.fillStyle = '#cfcfcf';
      g.beginPath(); g.arc(x0 + m(1.4), ground - 90, 90, 0, 7); g.fill();
      g.fillRect(x0 + m(0.9), ground - 230, m(1.4), 90);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x0 + m(2.6) + k * 70, ground - 120, 80, 45, -0.3, 0, 7); g.fill(); g.fillRect(x0 + m(2.5) + k * 70, ground - 120, 18, 120); }
      fig(x0 + m(1.6), ground - 220, 330, 1.0, true);
      g.strokeStyle = '#d8d8d8'; g.lineWidth = 16;
      g.beginPath(); g.arc(x0 + m(1.05), ground - m(3.3), 150, -1.2, 1.2); g.stroke();
      for (let k = 0; k < 3; k++) { g.fillStyle = '#bcbcbc'; g.fillRect(x0 + m(1.2) + k * m(0.9), y0 + 40, 90, 70); g.beginPath(); g.moveTo(x0 + m(1.2) + k * m(0.9), y0 + 40); g.lineTo(x0 + m(1.2) + k * m(0.9) + 45, y0 + 5); g.lineTo(x0 + m(1.2) + k * m(0.9) + 90, y0 + 40); g.fill(); }
    } else {
      // the Ganga descending into Shiva's hair, Bhagiratha with folded hands, waves
      fig(x0 + m(2.2), ground, 480, 1.1);
      g.strokeStyle = '#cdcdcd'; g.lineWidth = 14;
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x0 + m(2.2) + (k - 3) * 30, y0 + 20); g.bezierCurveTo(x0 + m(2.2) + (k - 3) * 60, y0 + 150, x0 + m(2.2) + (k - 3) * 10, y0 + 250, x0 + m(2.2), ground - 430); g.stroke(); }
      fig(x0 + m(0.8), ground, 300, 0.9);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x0 + m(2.8) + k * 50, ground - 10); g.quadraticCurveTo(x0 + m(2.8) + k * 50 + 25, ground - 50, x0 + m(2.8) + k * 50 + 50, ground - 10); g.stroke(); }
    }
    g.restore();
  }
  return c;
}

/** normal map + albedo from a height canvas */
function reliefMaps(hc: HTMLCanvasElement, tint: [number, number, number], strength = 3) {
  const W = hc.width, H = hc.height;
  // soften the height so carved edges read as rounded
  const blur = document.createElement('canvas'); blur.width = W; blur.height = H;
  const bg = blur.getContext('2d')!;
  bg.filter = 'blur(3px)'; bg.drawImage(hc, 0, 0);
  const hd = bg.getImageData(0, 0, W, H).data;
  const nc = document.createElement('canvas'); nc.width = W; nc.height = H;
  const ac = document.createElement('canvas'); ac.width = W; ac.height = H;
  const nd = nc.getContext('2d')!.createImageData(W, H), ad = ac.getContext('2d')!.createImageData(W, H);
  const h = (x: number, y: number) => hd[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    nd.data[i] = (-dx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
    // raised carving catches the light, the sunk ground and the edges of figures go dark (baked occlusion)
    const v = h(x, y), edge = Math.min(1, Math.hypot(dx, dy) * 0.25), grain = 0.94 + Math.random() * 0.08;
    const k = (0.42 + 0.85 * v) * (1 - 0.35 * edge) * grain;
    ad.data[i] = Math.min(255, tint[0] * k); ad.data[i + 1] = Math.min(255, tint[1] * k); ad.data[i + 2] = Math.min(255, tint[2] * k); ad.data[i + 3] = 255;
  }
  nc.getContext('2d')!.putImageData(nd, 0, 0);
  ac.getContext('2d')!.putImageData(ad, 0, 0);
  const nt = new THREE.CanvasTexture(nc), at = new THREE.CanvasTexture(ac);
  at.colorSpace = THREE.SRGBColorSpace;
  for (const t of [nt, at]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { normal: nt, map: at };
}

export interface LokMats {
  sandstone: THREE.MeshStandardMaterial; paving: THREE.MeshStandardMaterial; cream: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial; lamp: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial;
  mural: THREE.MeshStandardMaterial;
}
let cached: LokMats | null = null;
/** Mahakal Lok's materials (made once; the first caller's `pending` waits for the stone scans) */
export function lokMats(pending?: Promise<unknown>[]): LokMats {
  if (cached) return cached;
  cached = makeLokMats(pending);
  return cached;
}
function makeLokMats(pending?: Promise<unknown>[]): LokMats {
  // the pink-red Rajasthan sandstone of Mahakal Lok (cm32-39, the 2022 photos): warm, pinkish in sun
  const sand = scanMaterial('sandstone_blocks_08', 1.6, { tint: 0xe6a689, normalScale: 0.7 });
  const pav = scanMaterial('red_sandstone_pavement', 2.4, { tint: 0xd6a690, normalScale: 0.5 });
  pending?.push(sand.loaded, pav.loaded);
  const relief = reliefMaps(muralHeight(), [204, 128, 100], 6);
  const mural = new THREE.MeshStandardMaterial({ map: relief.map, normalMap: relief.normal, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.85 });
  return {
    sandstone: sand.material,
    paving: pav.material,
    cream: new THREE.MeshStandardMaterial({ color: 0xead9c0, roughness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.85, roughness: 0.32 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 1.6, roughness: 0.4 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.5, metalness: 0.6 }),
    mural,
  };
}

// ------------------------------------------------------------------ stambha (pillar) and lamps

/**
 * One of the 108 stambhas (Corridor of Ujjain, Mahakal Lok ujjain 2): a square pink-sandstone pillar
 * ~6.6 m tall on a moulded base, carved bands and a sunk panel where Shiva's mudra is carved, a lotus
 * capital and the trishul on top; a scrolled bracket carries a lantern.
 */
function stambhaGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, y: number) => parts.push(new THREE.BoxGeometry(w, h, d).translate(0, y + h / 2, 0).toNonIndexed());
  box(1.2, 0.25, 1.2, 0); box(1.05, 0.3, 1.05, 0.25); box(0.92, 0.2, 0.92, 0.55);
  box(0.7, 4.4, 0.7, 0.75);
  for (const y of [1.0, 2.2, 3.6, 4.9]) box(0.8, 0.14, 0.8, y);
  // sunk mudra panels on all four faces (a raised hand-shape boss inside)
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    parts.push(new THREE.BoxGeometry(0.42, 1.1, 0.06).translate(0, 2.9, 0.36).rotateY(a).toNonIndexed());
    parts.push(new THREE.SphereGeometry(0.13, 8, 6).scale(1, 1.5, 0.5).translate(0, 2.95, 0.41).rotateY(a).toNonIndexed());
  }
  box(0.95, 0.18, 0.95, 5.15);
  const lotus = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.55, 0.12], [0.6, 0.3], [0.5, 0.42], [0.3, 0.5], [0, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  parts.push(lotus.translate(0, 5.33, 0).toNonIndexed());
  box(0.7, 0.12, 0.7, 5.85);
  // the lantern bracket (scrolled arm) towards the walk (+z)
  parts.push(new THREE.TorusGeometry(0.35, 0.05, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(0, 4.4, 0.7).toNonIndexed());
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }))!;
  g.computeVertexNormals();
  // world-ish UVs (box projection in local metres)
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    uv[i * 2] = ay > ax && ay > az ? pos.getX(i) : ax > az ? pos.getZ(i) : pos.getX(i);
    uv[i * 2 + 1] = ay > ax && ay > az ? pos.getZ(i) : pos.getY(i);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function trishulGeo() {
  const parts = [
    new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6).translate(0, 0.65, 0),
    new THREE.TorusGeometry(0.22, 0.035, 6, 14, Math.PI).rotateZ(Math.PI).translate(0, 1.15, 0),
    new THREE.ConeGeometry(0.06, 0.42, 6).translate(0, 1.5, 0),
    new THREE.ConeGeometry(0.05, 0.3, 6).translate(-0.22, 1.28, 0),
    new THREE.ConeGeometry(0.05, 0.3, 6).translate(0.22, 1.28, 0),
    new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10).rotateZ(Math.PI / 2).translate(0, 0.6, 0),
  ].map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; });
  return mergeGeometries(parts)!;
}
/** an ornate black lamp post with three lanterns (Mahakal Lok's lakefront) */
function lampPostGeo() {
  const parts = [
    new THREE.CylinderGeometry(0.22, 0.28, 0.5, 8).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.07, 0.1, 4.0, 8).translate(0, 2.4, 0),
    new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.3, 0),
    new THREE.BoxGeometry(1.3, 0.06, 0.06).translate(0, 4.1, 0),
  ].map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; });
  return mergeGeometries(parts)!;
}

// ------------------------------------------------------------------ gates

/**
 * A Mahakal Lok gateway in carved pink sandstone (after the Nandi and Pinaki Dwar): two massive piers
 * with stepped bases, carved bands and a mini-shikhara with a gold kalash each, a cusped arch between
 * them under a broad lintel with a jali parapet, and a crowning pavilion. `emblem` adds a couchant Nandi
 * on the crown (Nandi Dwar) or a great bow (Pinaki, Shiva's bow). Built facing +z at the origin.
 */
export function lokGate(L: LokMats, span: number, height: number, emblem: 'nandi' | 'bow' | 'om', statues: StatueBatch) {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  /** a carved panel showing part of the mural tile (u0..u1, v0..v1 of the 16 m x 7.6 m carving) */
  const carving = (w: number, h: number, x: number, y: number, z: number, u0: number, u1: number, v0: number, v1: number) => {
    const pg = new THREE.PlaneGeometry(w, h);
    const uv = pg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    const m = add(pg, L.mural, x, y, z);
    m.castShadow = false;
    return m;
  };
  const pw = Math.max(2.4, span * 0.3), half = span / 2 + pw / 2, D = pw * 1.15;
  const lintelY = height - 1.6, spring = height * 0.5;
  for (const sx of [-1, 1]) {
    const x = sx * half;
    // stepped base mouldings
    add(new THREE.BoxGeometry(pw * 1.35, 0.45, D * 1.35), L.sandstone, x, 0.22, 0);
    add(new THREE.BoxGeometry(pw * 1.22, 0.35, D * 1.22), L.sandstone, x, 0.62, 0);
    add(new THREE.BoxGeometry(pw * 1.1, 0.3, D * 1.1), L.sandstone, x, 0.95, 0);
    // the shaft, with a projecting central rib (bhadra) on its front and back
    add(new THREE.BoxGeometry(pw, height - 1.1, D), L.sandstone, x, 1.1 + (height - 1.1) / 2, 0);
    add(new THREE.BoxGeometry(pw * 0.55, height - 1.6, D + 0.24), L.sandstone, x, 1.1 + (height - 1.6) / 2, 0);
    // carved bands
    for (const fy of [0.18, 0.36, 0.62, 0.8]) add(new THREE.BoxGeometry(pw * 1.08, 0.2, D * 1.08), L.sandstone, x, height * fy, 0);
    // deity niches front and back: a carved figure under a little cusped hood
    for (const fz of [1, -1]) {
      carving(pw * 0.42, height * 0.2, x, height * 0.48, fz * (D / 2 + 0.125), 0.1, 0.17, 0.2, 0.8).rotation.y = fz > 0 ? 0 : Math.PI;
      const hood = add(archPanelGeometry(pw * 0.5, 0.45, 0.16, 5), L.sandstone, x, height * 0.59, fz * (D / 2 + 0.14));
      hood.castShadow = false;
    }
    // a jharokha balcony and a chhatri crowning each pier
    add(new THREE.BoxGeometry(pw * 1.3, 0.3, D * 1.3), L.sandstone, x, height + 0.15, 0);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.16, 1.3, 0.16), L.sandstone, x + px * pw * 0.48, height + 0.95, pz * D * 0.42);
    add(new THREE.BoxGeometry(pw * 1.25, 0.18, D * 1.2), L.sandstone, x, height + 1.68, 0);
    add(new THREE.SphereGeometry(pw * 0.48, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1), L.sandstone, x, height + 1.77, 0);
    add(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.5, 1), L.gold, x, height + 1.77 + pw * 0.58, 0);
  }
  // the cusped arch and the lintel over it, carved friezes on both faces
  add(archPanelGeometry(span, lintelY - spring, D * 0.8, 9), L.sandstone, 0, spring, 0);
  const lw = span + pw * 2;
  add(new THREE.BoxGeometry(lw, 1.6, D * 0.9), L.sandstone, 0, lintelY + 0.8, 0);
  for (const fz of [1, -1]) {
    carving(span * 0.95, 1.15, 0, lintelY + 0.8, fz * (D * 0.45 + 0.01), 0.27, 0.62, 0.52, 0.84).rotation.y = fz > 0 ? 0 : Math.PI;
    add(new THREE.BoxGeometry(lw + 0.2, 0.16, 0.18), L.sandstone, 0, lintelY + 0.08, fz * D * 0.47);
  }
  // kangura merlons along the top
  const n = Math.floor(lw / 0.75);
  const mer = new THREE.InstancedMesh(new THREE.ConeGeometry(0.26, 0.6, 4).rotateY(Math.PI / 4).translate(0, 0.3, 0), L.sandstone, n);
  for (let k = 0; k < n; k++) mer.setMatrixAt(k, new THREE.Matrix4().makeTranslation(-lw / 2 + 0.38 + k * 0.75, height, D * 0.32));
  mer.castShadow = true;
  g.add(mer);
  // the crowning pavilion over the arch: a pillared kiosk under a ribbed dome with a gold kalash
  const pv = span * 0.5;
  add(new THREE.BoxGeometry(pv + 0.8, 0.35, D * 0.85), L.sandstone, 0, height + 0.17, 0);
  for (const px of [-1, 1]) for (const pz of [-1, 1]) add(new THREE.BoxGeometry(0.22, 1.6, 0.22), L.sandstone, px * pv / 2, height + 1.15, pz * D * 0.32);
  add(new THREE.BoxGeometry(pv + 1.0, 0.25, D * 0.95), L.sandstone, 0, height + 2.07, 0);
  add(new THREE.SphereGeometry(pv * 0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1), L.sandstone, 0, height + 2.2, 0);
  add(new THREE.SphereGeometry(0.26, 10, 8).scale(1, 1.5, 1), L.gold, 0, height + 2.2 + pv * 0.72, 0);
  if (emblem === 'nandi') statues.place(nandi(0xe8e2d8, 0.9), 0, height + 0.35, 0, 0, 1);
  if (emblem === 'bow') {
    add(new THREE.TorusGeometry(pv * 0.9, 0.1, 8, 30, Math.PI * 0.86).rotateZ(Math.PI * 0.07), L.gold, 0, height + 0.5, D * 0.45);
    add(new THREE.BoxGeometry(pv * 1.75, 0.025, 0.025), L.gold, 0, height + 0.62, D * 0.45);
  }
  if (emblem === 'om') {
    const disc = add(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 24).rotateX(Math.PI / 2), L.gold, 0, height + 1.15, D * 0.34);
    disc.castShadow = false;
  }
  return { group: g, half: half + pw / 2, depth: D, pier: pw };
}

// ------------------------------------------------------------------ the corridor

export interface LokBuild {
  near: THREE.Group; far: THREE.Group;
  /** walk lines (for keeping crowd and clutter off them) */
  paths: XZ[][];
  /** spots for pilgrims along the corridor */
  crowd: { x: number; z: number; ry: number }[];
}

export function buildMahakalLok(root: THREE.Group, near: THREE.Group, P: Physics, L: LokMats): LokBuild {
  const far = new THREE.Group();
  far.name = 'mahakal-lok-far';
  root.add(far);
  const crowd: LokBuild['crowd'] = [];
  const addTo = (grp: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; grp.add(m); return m;
  };
  const S = along(CORRIDOR, 0).total;
  const nearPart = (d: number) => d < 260;

  // ---- walkways: the corridor (12 m), the lakefront link (7 m), and the entrance plaza; they are the floors
  {
    const split = 260;
    const nearPts: XZ[] = [], farPts: XZ[] = [];
    const sAll = lengths(CORRIDOR);
    CORRIDOR.forEach((p, i) => { if (sAll[i] <= split) nearPts.push(p); if (sAll[i] >= split) farPts.push(p); });
    const mid = along(CORRIDOR, split);
    nearPts.push([mid.x, mid.z]); farPts.unshift([mid.x, mid.z]);
    const walk = [
      [near, ribbonGeo(nearPts, CORRIDOR_W, 0.06)], [far, ribbonGeo(farPts, CORRIDOR_W, 0.06)],
      [near, ribbonGeo(LAKE_LINK, 7, 0.06)],
      // the plaza between the lakefront path and the precinct's west side (the Mansarovar side)
      [near, polyGeo([[-131, -44], [-65, -44], [-65, 6], [-131, 6]], 0.055)],
      [far, polyGeo(PLAZA, 0.05, [circle(KAMAL_KUND.x, KAMAL_KUND.z, KAMAL_KUND.r + 0.8)])],
    ] as const;
    for (const [grp, geo] of walk) {
      const m = addTo(grp, geo, L.paving, false);
      P.floors.push(m);
    }
    // cream stone borders along both edges of the corridor
    for (const sgn of [-1, 1]) {
      const edge: XZ[] = [];
      for (let d = 0; d <= S; d += 6) { const a = along(CORRIDOR, Math.min(d, S)); edge.push([a.x - a.dz * sgn * (CORRIDOR_W / 2 - 0.4), a.z + a.dx * sgn * (CORRIDOR_W / 2 - 0.4)]); }
      addTo(far, ribbonGeo(edge, 0.8, 0.075), L.cream, false);
    }
  }

  // ---- the mural wall (east / land side), 7.6 m (25 ft) high, from 120 m to 610 m along the corridor
  {
    const pos: number[] = [], uv: number[] = [], nrm: number[] = [];
    const H = 7.6, off = CORRIDOR_W / 2 + 3.2, T = 0.9;
    const d0 = 120, d1 = Math.min(S - 30, 610);
    let prev: { x: number; z: number; nx: number; nz: number; u: number } | null = null;
    for (let d = d0; d <= d1 + 0.01; d += 4) {
      const a = along(CORRIDOR, d);
      // (dz, -dx) points away from the lake (east / north-east): the land side
      const nx = a.dz, nz = -a.dx;
      const side = 1;
      const x = a.x + nx * off * side, z = a.z + nz * off * side;
      const cur = { x, z, nx: -nx * side, nz: -nz * side, u: d / 16 };
      if (prev) {
        // the face towards the walk
        const quad = (ax: number, az: number, bx: number, bz: number, ua: number, ub: number, fx: number, fz: number, y0 = 0, y1 = H, v0 = 0, v1 = 1) => {
          const v = [[ax, y0, az, ua, v0], [bx, y0, bz, ub, v0], [bx, y1, bz, ub, v1], [ax, y0, az, ua, v0], [bx, y1, bz, ub, v1], [ax, y1, az, ua, v1]];
          // wind to face (fx, fz)
          const e1x = bx - ax, e1z = bz - az;
          const face = (-e1z) * fx + (e1x) * fz; // (e1 x up) . f: the natural winding's facing
          const order = face > 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
          for (const k of order) { pos.push(v[k][0], v[k][1], v[k][2]); uv.push(v[k][3], v[k][4]); nrm.push(fx, 0, fz); }
        };
        quad(prev.x, prev.z, cur.x, cur.z, prev.u, cur.u, cur.nx, cur.nz);
        // back face and top (plain stone, far less detail)
        const bxp = prev.x - prev.nx * T, bzp = prev.z - prev.nz * T, bxc = cur.x - cur.nx * T, bzc = cur.z - cur.nz * T;
        quad(bxp, bzp, bxc, bzc, prev.u, cur.u, -cur.nx, -cur.nz, 0, H, 0, 0.12);
        // top coping
        const tv = [[prev.x, H, prev.z], [cur.x, H, cur.z], [bxc, H, bzc], [prev.x, H, prev.z], [bxc, H, bzc], [bxp, H, bzp]];
        const up = ((tv[1][2] - tv[0][2]) * (tv[2][0] - tv[0][0]) - (tv[1][0] - tv[0][0]) * (tv[2][2] - tv[0][2])) > 0;
        const ord = up ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
        for (const k of ord) { pos.push(...tv[k]); uv.push(0.02, 0.99); nrm.push(0, 1, 0); }
      }
      prev = cur;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    addTo(far, g, L.mural);
  }

  // ---- 108 stambhas in a row along the land side, with lanterns; lamp posts and a railing on the lake side
  {
    const st: THREE.Matrix4[] = [], tri: THREE.Matrix4[] = [], lan: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [], postLamps: THREE.Matrix4[] = [];
    const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), T = new THREE.Vector3();
    const n = 108, d1 = Math.min(S - 30, 610), gap = 3.4, d0 = d1 - (n - 1) * gap;
    for (let k = 0; k < n; k++) {
      const a = along(CORRIDOR, d0 + k * gap);
      const nx = a.dz, nz = -a.dx; // the land side, where the stambhas stand before the mural wall
      const x = a.x + nx * (CORRIDOR_W / 2 + 0.9), z = a.z + nz * (CORRIDOR_W / 2 + 0.9);
      q.setFromAxisAngle(Y, Math.atan2(-nx, -nz)); // local +z towards the walk
      st.push(new THREE.Matrix4().compose(T.set(x, 0, z), q, one));
      tri.push(new THREE.Matrix4().compose(T.set(x, 5.97, z), q, one));
      lan.push(new THREE.Matrix4().compose(T.set(x - nx * 1.05, 3.95, z - nz * 1.05), q, one));
      P.solid(x - 0.55, 0, z - 0.55, x + 0.55, 6, z + 0.55);
    }
    for (let d = 4; d < S - 10; d += 14) {
      const a = along(CORRIDOR, d);
      const nx = -a.dz, nz = a.dx; // the lake side
      const x = a.x + nx * (CORRIDOR_W / 2 - 0.2), z = a.z + nz * (CORRIDOR_W / 2 - 0.2);
      q.setFromAxisAngle(Y, Math.atan2(a.dx, a.dz));
      posts.push(new THREE.Matrix4().compose(T.set(x, 0, z), q, one));
      for (const s of [-0.62, 0.62]) postLamps.push(new THREE.Matrix4().compose(T.set(x + a.dx * 0 + nx * 0 + (a.dz) * 0, 3.85, z), q, one).multiply(new THREE.Matrix4().makeTranslation(s, 0, 0)));
      postLamps.push(new THREE.Matrix4().compose(T.set(x, 4.55, z), q, one));
      P.solid(x - 0.25, 0, z - 0.25, x + 0.25, 4, z + 0.25);
    }
    // lakefront link: lamp posts along its west (lake) edge
    const linkL = along(LAKE_LINK, 0).total;
    for (let d = 6; d < linkL; d += 14) {
      const a = along(LAKE_LINK, d);
      const nx = -a.dz, nz = a.dx; // the lake side
      const x = a.x + nx * 3.2, z = a.z + nz * 3.2;
      q.setFromAxisAngle(Y, Math.atan2(a.dx, a.dz));
      posts.push(new THREE.Matrix4().compose(T.set(x, 0, z), q, one));
      for (const s of [-0.62, 0.62]) postLamps.push(new THREE.Matrix4().compose(T.set(x, 3.85, z), q, one).multiply(new THREE.Matrix4().makeTranslation(s, 0, 0)));
      postLamps.push(new THREE.Matrix4().compose(T.set(x, 4.55, z), q, one));
    }
    const inst = (grp: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], shadow: boolean) => {
      const im = new THREE.InstancedMesh(geo, mat, ms.length);
      ms.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = shadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      grp.add(im);
      return im;
    };
    inst(far, stambhaGeo(), L.sandstone, st, true);
    inst(far, trishulGeo(), L.gold, tri, false);
    const lantern = mergeGeometries([new THREE.CylinderGeometry(0.16, 0.12, 0.42, 6).translate(0, -0.21, 0), new THREE.ConeGeometry(0.2, 0.18, 6).translate(0, 0.08, 0)].map((p) => { p.deleteAttribute('uv'); return p.toNonIndexed(); }))!;
    inst(far, lantern, L.lamp, [...lan, ...postLamps], false);
    inst(far, lampPostGeo(), L.iron, posts, true);
    // a stone balustrade along the lake side: rails as merged boxes
    const rails: THREE.BufferGeometry[] = [];
    for (let d = 0; d < S - 6; d += 6) {
      const a = along(CORRIDOR, d), b = along(CORRIDOR, Math.min(S, d + 6));
      const off = CORRIDOR_W / 2 + 0.2;
      const ax = a.x - a.dz * off, az = a.z + a.dx * off, bx = b.x - b.dz * off, bz = b.z + b.dx * off;
      const L2 = Math.hypot(bx - ax, bz - az);
      const rail = new THREE.BoxGeometry(L2, 0.18, 0.3).translate(0, 0.95, 0).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, 0, (az + bz) / 2);
      const base = new THREE.BoxGeometry(L2, 0.3, 0.36).translate(0, 0.15, 0).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, 0, (az + bz) / 2);
      const post = new THREE.BoxGeometry(0.3, 1.05, 0.3).translate(ax, 0.52, az);
      rails.push(rail.toNonIndexed(), base.toNonIndexed(), post.toNonIndexed());
    }
    addTo(far, mergeGeometries(rails)!, L.cream);
  }

  // ---- statues along the corridor's lake side, each on a plinth; Kamal Kund; Saptarishi
  const nearStat = new StatueBatch(), farStat = new StatueBatch();
  const plinths: THREE.BufferGeometry[] = [], plinthsNear: THREE.BufferGeometry[] = [];
  const bay = (d: number, build: () => StatueBatch, scale: number, w: number) => {
    const a = along(CORRIDOR, d);
    const nx = -a.dz, nz = a.dx; // the lake side
    const x = a.x + nx * (CORRIDOR_W / 2 + 3.6), z = a.z + nz * (CORRIDOR_W / 2 + 3.6);
    const ry = Math.atan2(-nx, -nz); // face the walk
    (nearPart(d) ? nearStat : farStat).place(build(), x, 1.2, z, ry, scale);
    const pl = new THREE.CylinderGeometry(w, w * 1.1, 1.2, 8).translate(x, 0.6, z);
    (nearPart(d) ? plinthsNear : plinths).push(pl.toNonIndexed());
    P.solid(x - w, 0, z - w, x + w, 3, z + w);
    for (let k = 0; k < 4; k++) crowd.push({ x: a.x + nx * (CORRIDOR_W / 2 - 1.2) + a.dx * (k - 1.5) * 1.2, z: a.z + nz * (CORRIDOR_W / 2 - 1.2) + a.dz * (k - 1.5) * 1.2, ry: Math.atan2(nx, nz) });
  };
  bay(70, () => shivaOnNaga(1), 1.15, 2.2);
  bay(150, () => { const b = new StatueBatch(); b.place(standing('shiva', 0x8fb4d0, 0x8a5a2a, 2.3), -0.7, 0, 0, 0.15, 1); b.place(standing('devi', 0xd9a07a, 0xc0182a, 2.1, 'namaste'), 0.7, 0, 0, -0.15, 1); return b; }, 1, 2.6);
  bay(230, () => nandi(0xeee8dc, 2.4), 1, 3.0);
  bay(330, () => standing('shiva', 0xffffff, 0xffffff, 2.8, 'tandava'), 1, 2.0);
  bay(420, () => seated('shiva', 0x8fb4d0, 0x8a5a2a, 2.4, { trishul: true, serpent: true }), 1, 2.4);
  bay(520, () => { const b = new StatueBatch(); b.place(standing('shiva', 0xece4d8, 0x9a6a3a, 2.5), 0, 0, 0, 0, 1); return b; }, 1, 2.0);

  // Kamal Kund: a round lotus pond with stone rim and great pink lotuses round a rock, on which Shiva sits
  {
    const { x, z, r } = KAMAL_KUND;
    const rim = new THREE.TorusGeometry(r + 0.4, 0.45, 8, 72).rotateX(Math.PI / 2).translate(x, 0.25, z);
    addTo(far, rim, L.cream);
    const wall = new THREE.CylinderGeometry(r + 0.2, r + 0.2, 1.2, 72, 1, true).translate(x, -0.55, z);
    addTo(far, wall, new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.9, side: THREE.BackSide }), false);
    const rock = new THREE.CylinderGeometry(5.5, 7, 2.4, 10, 2).translate(x, 0.0, z);
    { const p = rock.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.12 * Math.sin(p.getX(i) * 1.7 + p.getZ(i) * 2.3); p.setX(i, x + (p.getX(i) - x) * k); p.setZ(i, z + (p.getZ(i) - z) * k); } rock.computeVertexNormals(); }
    addTo(far, rock, new THREE.MeshStandardMaterial({ color: 0x7a6a5e, roughness: 0.9 }));
    // the seated Shiva, ~8 m: cream and gold, crescent, serpent and trishul (cm: "Mahakal Corridor, Ujjain, MP")
    farStat.place(seated('shiva', 0xeadcc0, 0xc8963a, 4.3, { trishul: true, serpent: true }), x, 1.2, z, Math.PI, 1);
    // lotuses: open flowers of pink petals with gold seed pods, and round pads
    const lot = new StatueBatch();
    for (let k = 0; k < 10; k++) {
      const petal = new THREE.SphereGeometry(0.5, 8, 6).scale(0.5, 0.18, 1).translate(0, 0, 0.55);
      lot.add(petal.clone().rotateX(-0.5).rotateY((k / 10) * Math.PI * 2), 0xf0a0b8);
      lot.add(petal.clone().scale(0.7, 1, 0.7).rotateX(-0.9).rotateY((k / 10) * Math.PI * 2 + 0.3).translate(0, 0.12, 0), 0xf8d0dc);
    }
    lot.addGold(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 10).translate(0, 0.25, 0));
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2 + rnd() * 0.2, rr = 10 + rnd() * (r - 13);
      farStat.place(lot, x + Math.cos(a) * rr, -0.45, z + Math.sin(a) * rr, rnd() * 6, 1.6 + rnd() * 1.4);
      farStat.add(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 16).translate(x + Math.cos(a + 0.12) * (rr + 1.2), -0.55, z + Math.sin(a + 0.12) * (rr + 1.2)), 0x2e6a2a);
    }
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2, rr = r + 4;
      crowd.push({ x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    }
  }
  // Saptarishi Mandal: the seven sages seated round a low drum, facing out
  {
    const { x, z } = SAPTARISHI;
    plinths.push(new THREE.CylinderGeometry(5.2, 5.6, 0.9, 28).translate(x, 0.45, z).toNonIndexed());
    plinths.push(new THREE.CylinderGeometry(1.6, 1.8, 2.2, 16).translate(x, 1.1, z).toNonIndexed());
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      farStat.place(seated('sage', 0xb07850, 0xe07a18, 1.5), x + Math.cos(a) * 3.4, 0.9, z + Math.sin(a) * 3.4, Math.atan2(Math.cos(a), Math.sin(a)), 1);
    }
    P.solid(x - 5.4, 0, z - 5.4, x + 5.4, 3, z + 5.4);
  }

  // ---- the Nandi Dwar and the Pinaki Dwar (entrance gates on the street at the plaza's south)
  for (const [gt, emblem] of [[NANDI_DWAR, 'nandi'], [PINAKI_DWAR, 'bow']] as const) {
    const gate = lokGate(L, 9, 13, emblem, farStat);
    gate.group.position.set(gt.x, 0, gt.z);
    gate.group.rotation.y = gt.ry;
    far.add(gate.group);
    gate.group.updateMatrixWorld(true);
    for (const sx of [-1, 1]) {
      const p = new THREE.Vector3(sx * (9 / 2 + gate.pier / 2), 0, 0).applyMatrix4(gate.group.matrixWorld);
      P.solid(p.x - gate.pier * 0.7, 0, p.z - gate.depth * 0.7, p.x + gate.pier * 0.7, 14, p.z + gate.depth * 0.7);
    }
    if (emblem === 'nandi') {
      // two great couchant Nandis flank the Nandi Dwar
      for (const sx of [-1, 1]) {
        const p = new THREE.Vector3(sx * 11.5, 0, 4).applyMatrix4(gate.group.matrixWorld);
        farStat.place(nandi(0xe8e0d0, 2.6), p.x, 1.0, p.z, gt.ry, 1);
        plinths.push(new THREE.BoxGeometry(4, 1.0, 7).rotateY(gt.ry).translate(p.x, 0.5, p.z).toNonIndexed());
      }
    }
  }
  if (plinths.length) addTo(far, mergeGeometries(plinths.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }))!, L.sandstone);
  if (plinthsNear.length) addTo(near, mergeGeometries(plinthsNear.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }))!, L.sandstone);
  for (const m of nearStat.meshes(L.paint, L.gold)) near.add(m);
  for (const m of farStat.meshes(L.paint, L.gold)) far.add(m);

  // pilgrims walking the corridor, both directions, clear of its centre line
  for (let d = 10; d < S; d += 9) {
    const a = along(CORRIDOR, d);
    const off = (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 2.8);
    crowd.push({ x: a.x + a.dz * off, z: a.z - a.dx * off, ry: Math.atan2(a.dx, a.dz) + (rnd() < 0.45 ? Math.PI : 0) });
  }
  return { near, far, paths: [CORRIDOR, LAKE_LINK, PROMENADE], crowd };
}

/**
 * The gardens between the corridor and the lake: lawn tiles on the lake side wherever there is land
 * (not water, not the walk), with trees. Built once the lake outline is known.
 */
export function lakesideGardens(g: THREE.Group, isWater: (x: number, z: number) => boolean) {
  const pos: number[] = [];
  const trees: [number, number, number][] = [];
  for (const [line, half] of [[CORRIDOR, CORRIDOR_W / 2], [LAKE_LINK, 3.5]] as const) {
  const S = along(line, 0).total;
  for (let d = 0; d < S - 2; d += 4) {
    const a = along(line, d), b = along(line, Math.min(S, d + 4.2));
    for (let off = half + 0.6; off < half + 46; off += 4) {
      // the lake side: (-dz, dx)
      const pa = [a.x - a.dz * off, a.z + a.dx * off], pb = [b.x - b.dz * off, b.z + b.dx * off];
      const pc = [b.x - b.dz * (off + 4.2), b.z + b.dx * (off + 4.2)], pd = [a.x - a.dz * (off + 4.2), a.z + a.dx * (off + 4.2)];
      const cx = (pa[0] + pc[0]) / 2, cz = (pa[1] + pc[1]) / 2;
      if (isWater(cx, cz) || isWater(pc[0], pc[1]) || isWater(pd[0], pd[1])) break;
      for (const [p, q, r] of [[pa, pc, pb], [pa, pd, pc]]) {
        const up = (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]) > 0;
        for (const v of up ? [p, q, r] : [p, r, q]) pos.push(v[0], 0.035, v[1]);
      }
      if (off > half + 8 && rnd() < 0.05) trees.push([cx, cz, 7 + rnd() * 5]);
    }
  }
  }
  if (pos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const n: number[] = [], uv: number[] = [];
    for (let i = 0; i < pos.length; i += 3) { n.push(0, 1, 0); uv.push(pos[i] / 3, pos[i + 2] / 3); }
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const grass = canvasTex(128, 128, (c) => {
      c.fillStyle = '#5b7a34'; c.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 1400; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(40,70,20,0.5)' : 'rgba(130,150,70,0.45)'; c.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 2 + rnd() * 3); }
    });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
    m.receiveShadow = true;
    g.add(m);
  }
  return trees;
}

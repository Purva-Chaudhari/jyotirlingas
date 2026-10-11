import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../../engine/kit';
import type { TM } from './mats';
import type { Offerings } from './offerings';
import { terrainH } from './terrain';

/**
 * Trimbak town (c056 aerial, c058 street, c098): a dense, contiguous town of 1–4 storey plastered RCC
 * houses packed round the temple within ~350 m — painted in faded pastels, with rows of windows, small
 * chajjas, rolling shutters at street level, flat roofs with black water tanks or low corrugated-tin
 * gables — thinning out into fields beyond. The main street runs east from the Mahadwar between shops
 * with awnings, signboards and flower/puja stalls.
 *
 * All houses are one instanced box mesh whose facade (windows, slab lines, shutters, stains) is drawn in
 * the shader in each house's own metres, so nothing reads as a blank placeholder box.
 */

let seed = 4242;
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLN; varying vec3 vScl; varying float vSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 im = mat4(1.0);
          #ifdef USE_INSTANCING
            im = instanceMatrix;
          #endif
          vScl = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
          vLoc = position * vScl;
          vLN = normal;
          vSeed = fract(sin(dot(im[3].xz, vec2(12.99, 78.23))) * 43758.5);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLoc; varying vec3 vLN; varying vec3 vScl; varying float vSeed;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 base = diffuseColor.rgb;
          if (abs(vLN.y) > 0.5) {
            // flat RCC roof: grey concrete with damp patches
            float n = fn(vLoc.xz * 0.7);
            diffuseColor.rgb = vec3(0.42, 0.41, 0.39) * (0.75 + 0.35 * n);
          } else {
            bool alongX = abs(vLN.z) > 0.5;
            float u = alongX ? vLoc.x : vLoc.z;
            float halfW = alongX ? vScl.x * 0.5 : vScl.z * 0.5;
            float y = vLoc.y;
            float storey = floor(y / 3.0), fy = mod(y, 3.0);
            float bayW = 2.6;
            float nb = max(1.0, floor(2.0 * halfW / bayW));
            float bw = 2.0 * halfW / nb;
            float fu = mod(u + halfW, bw) - bw * 0.5;
            float top = vScl.y;
            vec3 c = base;
            // weathering: rain streaks and grime at the foot
            float streak = fn(vec2(u * 1.7, y * 0.12 + vSeed * 9.0));
            c *= 0.82 + 0.22 * streak;
            c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 1.2, y));
            // slab line at each floor and the parapet coping
            float slab = step(2.82, fy) + step(top - 0.12, y);
            c = mix(c, c * 1.12 + 0.03, slab * 0.8);
            if (storey < 0.5 && vSeed > 0.35) {
              // rolling shutter / shop opening at street level
              if (abs(fu) < bw * 0.42 && fy < 2.4) {
                float rib = 0.5 + 0.5 * sin(fy * 70.0);
                c = mix(vec3(0.33, 0.34, 0.35), vec3(0.45, 0.46, 0.47), rib) * (vSeed > 0.7 ? 0.45 : 1.0);
              }
            } else if (y < top - 0.9) {
              // window with a light frame, a dark pane with a grille, a chajja shadow above
              float wx = abs(fu), wyc = fy - 1.45;
              if (wx < 0.62 && abs(wyc) < 0.62) {
                bool frame = wx > 0.55 || abs(wyc) > 0.55;
                float grill = step(0.92, fract((fu + 0.62) / 0.15)) + step(0.9, fract((wyc + 0.62) / 0.3));
                c = frame ? vec3(0.78, 0.76, 0.72) : mix(vec3(0.07, 0.08, 0.09), vec3(0.3), min(1.0, grill) * 0.6);
              }
              if (wx < 0.8 && fy > 2.1 && fy < 2.22) c *= 0.45; // chajja shadow line
              // stain running down from the window sill
              if (wx < 0.5 && wyc < -0.62) c *= 1.0 - 0.18 * smoothstep(0.0, -1.2, wyc + 0.62) * streak;
            }
            diffuseColor.rgb = c;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'trimbak-facade';
  return m;
}

/** low gable roof of corrugated sheet, unit footprint (−0.5…0.5), ridge along x, height 1 */
function gableGeo() {
  const p: number[] = [];
  const A = [-0.55, 0, -0.58], B = [0.55, 0, -0.58], C = [0.55, 1, 0], D = [-0.55, 1, 0];
  const E = [-0.55, 0, 0.58], F = [0.55, 0, 0.58];
  p.push(...A, ...C, ...B, ...A, ...D, ...C, ...E, ...F, ...C, ...E, ...C, ...D, ...A, ...E, ...D, ...B, ...C, ...F);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

/** a shop canopy: unit length along z, 1 m deep along +x from the wall line, sloping down and out with a
 * cloth sag between the bamboo poles and a scalloped valance */
function awningGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 3, 12);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 0.5, z = p.getZ(i);
    const sag = 0.16 * Math.sin(Math.PI * (z + 0.5) * 3) ** 2 * x;
    p.setXYZ(i, -x, -0.75 * x - sag, z);
  }
  const val = new THREE.PlaneGeometry(1, 0.2, 1, 24).rotateY(Math.PI / 2);
  const v = val.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const z = v.getZ(i), y = v.getY(i);
    const sc = y < 0 ? 0.06 * Math.abs(Math.sin(z * Math.PI * 12)) : 0;
    v.setXYZ(i, -1, -0.75 - 0.1 + y + sc - 0.16 * Math.sin(Math.PI * (z + 0.5) * 3) ** 2, z);
  }
  const m = mergeGeometries([g.toNonIndexed(), val.toNonIndexed()].map((q) => { q.deleteAttribute('uv'); return q; }))!;
  m.computeVertexNormals();
  return m;
}

/** a hipped roof, unit footprint, ridge along x, height 1, eaves overhanging */
function hipGeo() {
  const A = [-0.56, 0, -0.56], B = [0.56, 0, -0.56], C = [0.56, 0, 0.56], D = [-0.56, 0, 0.56], E = [-0.22, 1, 0], F = [0.22, 1, 0];
  const p: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => p.push(...a, ...b, ...c);
  tri(D, C, F); tri(D, F, E); tri(B, A, E); tri(B, E, F); tri(A, D, E); tri(C, B, F);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  // uv in metres-ish of the unit (courses run along x)
  const uv: number[] = [];
  for (let i = 0; i < p.length; i += 3) uv.push(p[i] * 8, (p[i + 1] + Math.abs(p[i + 2])) * 8);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Mangalore-tile courses as a normal map */
function tileNormal() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  const img = g.createImageData(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = Math.cos((x / 32) * Math.PI * 2) * 0.6, dy = (y % 16) < 3 ? 0.9 : 0;
    const l = Math.hypot(dx, dy, 1), i = (y * 32 + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** all shop signboards in one atlas (one row per name): a single draw for every sign on the street */
function signAtlasMaterial(texts: string[]) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96 * texts.length;
  const g = c.getContext('2d')!;
  const bgs = ['#c8202a', '#1f5aa8', '#e8a020', '#2a7a4a', '#d8572a', '#6a2a8a'];
  texts.forEach((t, i) => {
    g.fillStyle = bgs[i % 6]; g.fillRect(0, i * 96, 512, 96);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.strokeRect(6, i * 96 + 6, 500, 84);
    g.fillStyle = i % 6 === 2 ? '#3a1a08' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 54px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
    g.fillText(t, 256, i * 96 + 50);
  });
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 });
}


export function buildTown(root: THREE.Group, K: TM, P: Physics, O: Offerings, zGate: number) {
  const g = new THREE.Group();
  g.name = 'town';
  root.add(g);
  seed = 4242;
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const houses: THREE.Matrix4[] = [], hcol: THREE.Color[] = [];
  const tins: THREE.Matrix4[] = [], tcol: THREE.Color[] = [];
  const tanks: THREE.Matrix4[] = [];
  const awn: THREE.Matrix4[] = [], acol: THREE.Color[] = [];
  const boards: THREE.Matrix4[] = [], bcol: THREE.Color[] = [];
  const palette = [0xd9cdb4, 0xe8d24a, 0xc9b896, 0xe0a0a8, 0x8fb0d8, 0xe0c784, 0xcf9e88, 0xf0ece4, 0x9cc28a, 0xe6e0d4, 0xe8a050, 0x7ab0c0, 0xd6a0a8, 0xbfd0b0, 0xf2f0ea, 0xc8d870];
  const tinCols = [0x8e9496, 0x7d8486, 0x8a5a3e, 0x7a4a32, 0x5a7a9a, 0x9a9e9c, 0x6e6a62, 0x9a6a48, 0x3a6a9a];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);

  const tiles: THREE.Matrix4[] = [], tlcol: THREE.Color[] = [];
  const tileCols = [0xa04a2a, 0x8a3e24, 0xb05a34, 0x7a3a26, 0x9a5236];
  const trees: [number, number, number][] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rq: THREE.Quaternion, c: THREE.Color | number) => {
    boards.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rq, new THREE.Vector3(sx, sy, sz)));
    bcol.push(c instanceof THREE.Color ? c : new THREE.Color(c));
  };
  /**
   * One house: the facade-shaded box, its roof (tin gable, red-tile hip, or a flat terrace with a parapet,
   * water tanks and a stair cabin), and — near the centre — chajja sunshades over each storey's windows
   * and balconies with solid parapets on the side facing its lane (local +z).
   */
  const add = (x: number, z: number, w: number, d: number, h: number, ry: number, roof: 'flat' | 'tin' | 'tile', detail = 0) => {
    const y = terrainH(x, z) - 0.4;
    q.setFromAxisAngle(up, ry);
    const rq = q.clone();
    const L = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyQuaternion(rq).add(new THREE.Vector3(x, 0, z));
    houses.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rq, new THREE.Vector3(w, h + 0.4, d)));
    const hc = new THREE.Color(palette[Math.floor(r() * palette.length)]).offsetHSL(0, -0.05, (r() - 0.5) * 0.08);
    hcol.push(hc);
    const top = y + h + 0.4;
    if (roof === 'tin') {
      tins.push(new THREE.Matrix4().compose(new THREE.Vector3(x, top, z), rq, new THREE.Vector3(w, 0.6 + r() * 0.6, d)));
      tcol.push(new THREE.Color(tinCols[Math.floor(r() * tinCols.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.1));
    } else if (roof === 'tile') {
      tiles.push(new THREE.Matrix4().compose(new THREE.Vector3(x, top, z), rq, new THREE.Vector3(w, 1.1 + r() * 0.6, d)));
      tlcol.push(new THREE.Color(tileCols[Math.floor(r() * tileCols.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08));
    } else {
      if (detail > 0) {
        const pc = hc.clone().offsetHSL(0, 0, 0.06);
        for (const [lx, lz, sx, sz] of [[0, d / 2 - 0.08, w, 0.16], [0, -d / 2 + 0.08, w, 0.16], [w / 2 - 0.08, 0, 0.16, d], [-w / 2 + 0.08, 0, 0.16, d]]) {
          const p0 = L(lx, lz);
          box(p0.x, top, p0.z, sx, 0.9, sz, rq, pc);
        }
        if (r() < 0.55) {
          const p0 = L((r() - 0.5) * w * 0.4, -d * 0.2);
          houses.push(new THREE.Matrix4().compose(new THREE.Vector3(p0.x, top - 0.1, p0.z), rq, new THREE.Vector3(2.6, 2.7, 2.8)));
          hcol.push(hc.clone());
        }
      }
      const n = r() < 0.8 ? 1 + Math.floor(r() * 2) : 0;
      for (let k = 0; k < n; k++) {
        const p0 = L((r() - 0.5) * w * 0.6, (r() - 0.5) * d * 0.5);
        tanks.push(new THREE.Matrix4().compose(new THREE.Vector3(p0.x, top, p0.z), rq, new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + r() * 0.4)));
      }
    }
    if (detail > 1) {
      const storeys = Math.round(h / 3);
      const cc = hc.clone().offsetHSL(0, -0.1, 0.1);
      for (let k = 0; k < storeys; k++) {
        const yy = y + 0.4 + k * 3 + 2.35;
        const p0 = L(0, d / 2 + 0.28);
        box(p0.x, yy, p0.z, w * 0.94, 0.07, 0.56, rq, cc);
        if (k >= 1 && r() < 0.45) {
          // a balcony: slab, solid parapet with a painted band, side walls
          const bw = Math.min(w * 0.55, 3.6), bx = (r() - 0.5) * (w - bw) * 0.8;
          const by = y + 0.4 + k * 3;
          const ps = L(bx, d / 2 + 0.5);
          box(ps.x, by - 0.14, ps.z, bw, 0.14, 1.0, rq, 0xc8c4bc);
          const pf = L(bx, d / 2 + 0.97);
          box(pf.x, by, pf.z, bw, 0.95, 0.07, rq, k % 2 ? cc : new THREE.Color(0x6a7a8a));
          for (const sgn of [-1, 1]) {
            const pq = L(bx + sgn * (bw / 2 - 0.035), d / 2 + 0.5);
            box(pq.x, by, pq.z, 0.07, 0.95, 1.0, rq, cc);
          }
        }
      }
    }
  };
  // ---------- the main street: shops below, houses above, both sides ----------
  const shopSigns = ['पूजा साहित्य', 'प्रसाद भांडार', 'फुले व हार', 'रुद्राक्ष', 'भोजनालय', 'पेढे', 'शिवप्रसाद', 'त्र्यंबक दर्शन'];
  const signAtlas = signAtlasMaterial(shopSigns);
  const signList: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    let z = zGate + 10.5;
    while (z < zGate + 145) {
      const w = 4.5 + r() * 3.5, d = 9 + r() * 4, h = 6 + Math.floor(r() * 3) * 3;
      // the shophouse faces the street (local +z → −s·x)
      add(s * (9.5 + d / 2), z + w / 2, w, d, h, s > 0 ? -Math.PI / 2 : Math.PI / 2, r() < 0.45 ? 'tin' : 'flat', 2);
      // the rolling-shutter box over the shop opening, and the shutter half-raised
      box(s * 9.38, 2.55, z + w / 2, 0.24, 0.3, w * 0.86, new THREE.Quaternion(), 0x6a6e70);
      P.solid(s > 0 ? 9.5 : -9.5 - d, 0, z, s > 0 ? 9.5 + d : -9.5, h, z + w);
      // a sagging cloth / tin canopy over the shopfront, and a painted signboard with its name above it
      awn.push(new THREE.Matrix4().compose(new THREE.Vector3(s * 9.5, 3.2, z + w / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s > 0 ? 0 : Math.PI), new THREE.Vector3(1.8, 1, w * 0.97)));
      acol.push(new THREE.Color([0x2a5aa0, 0xd06a20, 0x2a7a4a, 0xb02a2a, 0xd8b030, 0x8a8e90, 0xe8e0d0, 0x2a8ac0][Math.floor(r() * 8)]));
      {
        const k = Math.floor(r() * shopSigns.length);
        const sg = new THREE.PlaneGeometry(w * 0.85, w * 0.85 * 96 / 512);
        const uv = sg.attributes.uv;
        for (let t = 0; t < uv.count; t++) uv.setY(t, 1 - (k + 1) / shopSigns.length + uv.getY(t) / shopSigns.length);
        signList.push(sg.rotateY(-s * Math.PI / 2).translate(s * 9.44, 3.55, z + w / 2));
      }
      // goods: a counter at the shopfront stacked with coloured packets, boxes of prasad and puja things
      boards.push(new THREE.Matrix4().compose(new THREE.Vector3(s * 9.1, 0, z + w / 2), new THREE.Quaternion(), new THREE.Vector3(0.6, 0.85, w * 0.7)));
      bcol.push(new THREE.Color(0x7a5a3a));
      for (let k = 0; k < 9; k++) {
        const gw = 0.15 + r() * 0.2, gh = 0.08 + r() * 0.22;
        boards.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (9.1 + (r() - 0.5) * 0.3), 0.85, z + w / 2 + (r() - 0.5) * w * 0.62), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 0.4), new THREE.Vector3(gw, gh, gw)));
        bcol.push(new THREE.Color([0xd8202a, 0xf0b020, 0xf2f0ea, 0x2a6ab0, 0xe86a1a, 0x8a2a8a, 0x2a8a4a][Math.floor(r() * 7)]));
      }
      // garlands hung along the canopy's edge
      if (r() < 0.3 && z < zGate + 70) O.strand(new THREE.Vector3(s * 7.8, 2.3, z + 0.4), new THREE.Vector3(s * 7.8, 2.3, z + w - 0.4), 0.18, 1.6);
      // a flower / puja stall in front of every other shop: a low table heaped with marigolds and roses
      if (r() < 0.5 && z < zGate + 90) {
        const tx = s * 8.1, tz = z + w / 2;
        boards.push(new THREE.Matrix4().compose(new THREE.Vector3(tx, 0, tz), new THREE.Quaternion(), new THREE.Vector3(1.0, 0.75, Math.min(2.4, w * 0.7))));
        bcol.push(new THREE.Color(0x6a4a30));
        O.heap(tx, 0.76, tz - 0.4, 0.32, 0.18, 26);
        O.heap(tx, 0.76, tz + 0.45, 0.28, 0.14, 18);
        P.solid(tx - 0.5, 0, tz - Math.min(1.2, w * 0.35), tx + 0.5, 0.75, tz + Math.min(1.2, w * 0.35));
      }
      z += w + 0.25;
    }
  }

  // ---------- the town (c056, c098): irregular blocks of contiguous row houses between 5–7 m lanes,
  // packed within ~360 m of the temple; open plots and lane trees; farmsteads among fields beyond ----------
  const ok = (x: number, z: number) => {
    if (Math.abs(x) < 46 && z > -44 && z < 62) return false; // the precinct
    if (Math.abs(x) < 24 && z > 56 && z < zGate + 160) return false; // the main street's frontage
    if (terrainH(x, z) > 22) return false;
    const e = 5;
    return Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e) < 0.16;
  };
  const BX = 40, BZ = 30;
  for (let bx0 = -400; bx0 < 400; bx0 += BX + 6) {
    for (let bz0 = -400; bz0 < 440; bz0 += BZ + 6) {
      const jx = (r() - 0.5) * 6, jz = (r() - 0.5) * 5;
      const cx = bx0 + BX / 2 + jx, cz2 = bz0 + BZ / 2 + jz;
      const rad = Math.hypot(cx, cz2 * 0.85);
      const dens = rad < 220 ? 0.95 : rad < 360 ? 0.95 - 0.75 * (rad - 220) / 140 : 0;
      if (r() > dens) continue;
      const bry = (r() - 0.5) * 0.12;
      const bq = new THREE.Quaternion().setFromAxisAngle(up, bry);
      const W = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyQuaternion(bq).add(new THREE.Vector3(cx, 0, cz2));
      if (r() < 0.12) {
        // an open plot: a yard with a few trees
        for (let k = 0; k < 3 + Math.floor(r() * 4); k++) {
          const p0 = W((r() - 0.5) * BX * 0.8, (r() - 0.5) * BZ * 0.8);
          if (ok(p0.x, p0.z)) trees.push([p0.x, p0.z, 4 + r() * 3]);
        }
        continue;
      }
      const detail = rad < 230 ? 2 : 1;
      const tall = rad < 200 ? 1 : 0;
      for (const side of [-1, 1]) {
        let u = -BX / 2;
        while (u < BX / 2 - 3) {
          const w = Math.min(BX / 2 - u, 5 + r() * 5);
          const d = BZ / 2 - 0.5 - r() * 2.5;
          const lx = u + w / 2, lz = side * (BZ / 2 - d / 2);
          u += w;
          const p0 = W(lx, lz);
          if (!ok(p0.x, p0.z)) continue;
          if (r() < 0.07) { trees.push([p0.x, p0.z, 4 + r() * 3]); continue; }
          const storeys = tall ? 2 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
          const k = r();
          const roof = k < (rad < 160 ? 0.4 : 0.3) ? 'tin' : k < 0.5 ? 'tile' : 'flat';
          // the house faces its lane: local +z points outward from the block's spine
          add(p0.x, p0.z, w - 0.1, d, storeys * 3, bry + (side > 0 ? 0 : Math.PI), roof, detail);
        }
      }
      // lane trees along the block's long edges
      for (let k = 0; k < 2; k++) if (r() < 0.35) {
        const p0 = W((r() - 0.5) * BX, (r() < 0.5 ? -1 : 1) * (BZ / 2 + 3));
        if (ok(p0.x, p0.z)) trees.push([p0.x, p0.z, 3.5 + r() * 2.5]);
      }
    }
  }
  // farmsteads among the fields beyond
  for (let gx = -560; gx <= 560; gx += 23) {
    for (let gz = -560; gz <= 620; gz += 27) {
      const x = gx + (r() - 0.5) * 8, z = gz + (r() - 0.5) * 8;
      if (Math.hypot(x, z * 0.85) < 380 || r() > 0.12 || !ok(x, z)) continue;
      add(x, z, 6 + r() * 3, 5 + r() * 3, 3, (r() - 0.5) * 1.6, r() < 0.6 ? 'tin' : 'tile');
      if (r() < 0.6) trees.push([x + 8, z + (r() - 0.5) * 6, 5 + r() * 3]);
    }
  }
  g.userData.trees = trees;

  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cols?: THREE.Color[], shadow = false) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => { im.setMatrixAt(i, m); if (cols) im.setColorAt(i, cols[i]); });
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  };
  if (signList.length) g.add(new THREE.Mesh(mergeGeometries(signList, false)!, signAtlas));
  make(unit, facadeMaterial(), houses, hcol, false);
  const tinMat = K.tin.clone();
  tinMat.color.set(0xffffff);
  make(gableGeo(), tinMat, tins, tcol);
  make(hipGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, normalMap: tileNormal(), normalScale: new THREE.Vector2(0.8, 0.8) }), tiles, tlcol);
  const tank = new THREE.CylinderGeometry(0.55, 0.6, 1.1, 12).translate(0, 0.55, 0);
  make(tank, new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6 }), tanks);
  make(awningGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), awn, acol);
  make(unit, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), boards, bcol);
  return g;
}

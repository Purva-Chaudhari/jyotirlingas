import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { scanMaterial } from '../../engine/materials';

/**
 * Mahakaleshwar's own materials (the shared ones are left untouched):
 *  - spire: the peach/salmon paint of the shikhara as it looks in 2024–25
 *  - stone: the buff-brown carved sandstone of the lower storeys (lighter and warmer
 *    than the generic dark "basalt" scan; photos show tan stone in sun, grey-brown in shade)
 *  - jali: pierced stone lattice of the balcony and terrace parapets
 *  - frieze: bands of carved rosettes and lozenges on lintels and parapet bases
 *  - lamp: the warm lanterns hung on the front pillars
 */
export interface MahakalMats {
  spire: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  pillar: THREE.MeshStandardMaterial;
  /** the same stone in deep shade: the inner walls seen through the galleries */
  stoneDark: THREE.MeshStandardMaterial;
  /** grey-black dressed basalt of the tower over the garbhagriha (cm12) */
  basalt: THREE.MeshStandardMaterial;
  /** double-sided stone for the sloping eaves */
  eave: THREE.MeshStandardMaterial;
  jali: THREE.MeshStandardMaterial;
  frieze: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
  flag: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  /** glossy red of the raised ॐ on the spire */
  om: THREE.MeshStandardMaterial;
  /** grey loudspeaker horns */
  horn: THREE.MeshStandardMaterial;
  /** silver repoussé wall panels of the garbhagriha */
  repousse: THREE.MeshStandardMaterial;
  /** pierced silver railing round the jalahari */
  silverJali: THREE.MeshStandardMaterial;
  /** dark, oil-polished stone of the Jyotirlinga */
  lingam: THREE.MeshPhysicalMaterial;
  /** marigold strands for festive curtains */
  marigoldDeep: THREE.MeshStandardMaterial;
  /** warm lamp-lit reflection environment for the sanctum */
  env: THREE.Texture;
}

function canvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}

/** Pierced hexagon-and-star lattice (white = stone, black = hole). */
function jaliCanvas() {
  return canvas(256, (g, s) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#000';
    const r = s / 4;
    for (let row = -1; row <= 4; row++) {
      for (let col = -1; col <= 4; col++) {
        const cx = col * (s / 4) + (row % 2 ? s / 8 : 0), cy = row * (s / 4) * 0.866 * 1.155;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const rr = r * 0.36;
          if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      }
    }
  });
}

/** Carved band: rosettes in squares between lozenges, as a height map. */
function friezeCanvas() {
  return canvas(256, (g, s) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    const cell = s / 2;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
        g.strokeStyle = '#fff';
        g.lineWidth = 6;
        g.strokeRect(cx - cell * 0.42, cy - cell * 0.42, cell * 0.84, cell * 0.84);
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          const gr = g.createRadialGradient(cx + Math.cos(a) * cell * 0.18, cy + Math.sin(a) * cell * 0.18, 0, cx + Math.cos(a) * cell * 0.18, cy + Math.sin(a) * cell * 0.18, cell * 0.13);
          gr.addColorStop(0, '#fff');
          gr.addColorStop(1, 'rgba(128,128,128,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(cx + Math.cos(a) * cell * 0.18, cy + Math.sin(a) * cell * 0.18, cell * 0.13, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#303030';
        g.beginPath();
        g.arc(cx, cy, cell * 0.07, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Saffron dhwaja with a gold border and a gold trishul, as flown on the spire. */
function flagCanvas() {
  return canvas(256, (g, s) => {
    g.fillStyle = '#e8400a';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#f2c24a';
    g.lineWidth = 10;
    g.strokeRect(5, 5, s - 10, s - 10);
    // trishul near the hoist (u = 0 is the pole side, v = 0.5 the centre line)
    g.strokeStyle = '#f7d36a';
    g.lineWidth = 9;
    g.lineCap = 'round';
    const cx = s * 0.22, cy = s * 0.5;
    g.beginPath();
    g.moveTo(cx, cy + 46); g.lineTo(cx, cy - 46);
    g.moveTo(cx - 26, cy - 34); g.quadraticCurveTo(cx - 26, cy - 4, cx, cy - 4); g.quadraticCurveTo(cx + 26, cy - 4, cx + 26, cy - 34);
    g.stroke();
  });
}

/** Silver repoussé: framed square panels with embossed emblems (height map). */
function repousseCanvas() {
  return canvas(512, (g, s) => {
    g.fillStyle = '#6a6a6a';
    g.fillRect(0, 0, s, s);
    const n = 2, cell = s / n;
    const emblems = ['swastika', 'kalash', 'lotus', 'shankh'];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = i * cell, y = j * cell;
        // raised frame with a bead border
        g.fillStyle = '#d0d0d0';
        g.fillRect(x + 6, y + 6, cell - 12, cell - 12);
        g.fillStyle = '#7a7a7a';
        g.fillRect(x + 22, y + 22, cell - 44, cell - 44);
        g.fillStyle = '#e8e8e8';
        for (let k = 0; k < 16; k++) {
          for (const [bx, by] of [[x + 14 + k * (cell - 28) / 15, y + 14], [x + 14 + k * (cell - 28) / 15, y + cell - 14],
            [x + 14, y + 14 + k * (cell - 28) / 15], [x + cell - 14, y + 14 + k * (cell - 28) / 15]]) {
            g.beginPath(); g.arc(bx, by, 3.5, 0, Math.PI * 2); g.fill();
          }
        }
        const cx = x + cell / 2, cy = y + cell / 2, r = cell * 0.26;
        const e = emblems[(i + j * n) % emblems.length];
        g.strokeStyle = '#f4f4f4';
        g.fillStyle = '#e0e0e0';
        g.lineWidth = 12;
        g.lineCap = 'round';
        g.beginPath();
        if (e === 'swastika') {
          g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
          g.moveTo(cx + r, cy); g.lineTo(cx + r, cy + r * 0.7); g.moveTo(cx - r, cy); g.lineTo(cx - r, cy - r * 0.7);
          g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.7, cy - r); g.moveTo(cx, cy + r); g.lineTo(cx - r * 0.7, cy + r);
          g.stroke();
        } else if (e === 'kalash') {
          g.ellipse(cx, cy + r * 0.25, r * 0.7, r * 0.6, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(cx - r * 0.3, cy - r * 0.55, r * 0.6, r * 0.3);
          for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx + k * r * 0.22, cy - r * 0.8, r * 0.1, r * 0.3, k * 0.3, 0, Math.PI * 2); g.fill(); }
        } else if (e === 'lotus') {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.45, r * 0.18, a, 0, Math.PI * 2); g.fill();
          }
          g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(cx, cy, r * 0.22, 0, Math.PI * 2); g.fill();
        } else {
          g.ellipse(cx, cy, r * 0.45, r * 0.85, 0.5, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#9a9a9a'; g.lineWidth = 6;
          g.beginPath(); g.arc(cx, cy, r * 0.35, 0, Math.PI * 1.5); g.stroke();
        }
      }
    }
  });
}

/** Pierced silver lattice: quatrefoils in a grid (white = metal). */
function silverJaliCanvas() {
  return canvas(128, (g, s) => {
    // mostly open: a bold lattice of rings and diagonal bars (white = metal)
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#fff';
    g.lineWidth = 9;
    g.strokeRect(0, 0, s, s);
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.09, 0, Math.PI * 2); g.fill();
  });
}

/**
 * Weathering for the temple's own stone: large-scale colour mottling (patchy stone and repaint),
 * darker grime in the bottom metre above each walking level, and faint vertical rain streaks.
 * `levels` are the world heights of floors whose feet get grimy.
 */
export function weather(m: THREE.MeshStandardMaterial, opts: { mottle: number; grime: number; streak: number; levels: number[]; desat?: number }) {
  const lv = opts.levels.map((v) => v.toFixed(2)).join(', ');
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        float wh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float wn(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * vec3(0.98, 0.98, 1.0), ${(opts.desat ?? 0).toFixed(3)});
        {
          float mott = wn(vWPos * 0.35) * 0.6 + wn(vWPos * 1.3) * 0.4;
          diffuseColor.rgb *= 1.0 + (mott - 0.5) * ${opts.mottle.toFixed(3)};
          float lv[${opts.levels.length}] = float[](${lv});
          float g = 0.0;
          for (int i = 0; i < ${opts.levels.length}; i++) {
            float d = vWPos.y - lv[i];
            g = max(g, step(-0.05, d) * (1.0 - smoothstep(0.0, 1.1, d)));
          }
          diffuseColor.rgb *= 1.0 - g * ${opts.grime.toFixed(3)} * (0.7 + 0.6 * wn(vWPos * 2.0));
          // broad, soft rain stains (a fine vertical frequency read as timber planks on the stone)
          float st = smoothstep(0.6, 0.95, wn(vec3(vWPos.x * 1.1 + vWPos.z * 1.1, vWPos.y * 0.18, 0.0))) * (0.6 + 0.4 * wn(vWPos * 3.0));
          diffuseColor.rgb *= 1.0 - st * ${opts.streak.toFixed(3)};
        }`);
  };
  // distinct programs per parameter set (the default key, the hook's source text, is the same for all)
  m.customProgramCacheKey = () => `mk-weather-${JSON.stringify(opts)}`;
  m.needsUpdate = true;
}

export function mahakalMats(pending: Promise<unknown>[], interiorEnv: THREE.Texture, renderer?: THREE.WebGLRenderer): MahakalMats {
  // the garbhagriha is lit by white LED panels: its silver should mirror a neutral white room,
  // not the warm lamp-lit environment (falls back to that if no renderer is given)
  let neutralEnv = interiorEnv;
  if (renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    neutralEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  const spire = scanMaterial('sandstone_blocks_08', 2.2, { tint: 0xffb47a, normalScale: 0.9 });
  const stone = scanMaterial('large_sandstone_blocks_01', 2.6, { tint: 0x8d8c89, normalScale: 0.6 });
  const pillar = scanMaterial('large_sandstone_blocks_01', 1.6, { tint: 0x83827f, normalScale: 0.75 });
  const eave = scanMaterial('large_sandstone_blocks_01', 2.6, { tint: 0x7a7977, normalScale: 0.6 });
  const stoneDark = scanMaterial('large_sandstone_blocks_01', 2.6, { tint: 0x4e433b, normalScale: 1.1 });
  pending.push(stoneDark.loaded);
  // dressed block courses of the sandstone scan, desaturated to grey-black basalt in the shader
  const basalt = scanMaterial('large_sandstone_blocks_01', 2.2, { tint: 0x55585e, normalScale: 1.0 });
  pending.push(basalt.loaded);
  eave.material.side = THREE.DoubleSide;
  // light peach of the painted spire (sunlit ≈ rgb 217,165,120 in the 2025 photos): a tint above 1 brightens the scan
  pending.push(spire.loaded.then(() => spire.material.color.setRGB(1.24, 0.72, 0.46, THREE.SRGBColorSpace)), stone.loaded, pillar.loaded, eave.loaded);
  // walking/standing levels: courtyard, plinth top, gallery floor, terrace
  const levels = [0, 0.9, 5.35, 9.55];
  weather(stone.material, { mottle: 0.42, grime: 0.32, streak: 0.14, levels, desat: 0.5 });
  weather(pillar.material, { mottle: 0.4, grime: 0.35, streak: 0.1, levels, desat: 0.5 });
  weather(eave.material, { mottle: 0.25, grime: 0.0, streak: 0.16, levels, desat: 0.5 });
  weather(stoneDark.material, { mottle: 0.3, grime: 0.2, streak: 0.08, levels, desat: 0.45 });
  weather(basalt.material, { mottle: 0.35, grime: 0.25, streak: 0.22, levels, desat: 0.92 });
  weather(spire.material, { mottle: 0.14, grime: 0.18, streak: 0.16, levels: [9.55] });

  const jaliTex = new THREE.CanvasTexture(jaliCanvas());
  jaliTex.wrapS = jaliTex.wrapT = THREE.RepeatWrapping;
  const jali = new THREE.MeshStandardMaterial({
    color: 0x8a7764, roughness: 0.9, alphaMap: jaliTex, alphaTest: 0.5, side: THREE.DoubleSide,
  });

  const fz = new THREE.CanvasTexture(friezeCanvas());
  fz.wrapS = fz.wrapT = THREE.RepeatWrapping;
  const frieze = new THREE.MeshStandardMaterial({ color: 0x8a7764, roughness: 0.9, bumpMap: fz, bumpScale: 1 });
  weather(frieze, { mottle: 0.25, grime: 0.2, streak: 0.1, levels });

  // share the stone scan's colour map with the lattice and the carved bands once it is in
  pending.push(stone.loaded.then(() => {
    for (const m of [jali, frieze]) {
      m.map = stone.material.map;
      m.color.set(0x9c8c7e);
      m.needsUpdate = true;
    }
  }));

  const flagTex = new THREE.CanvasTexture(flagCanvas());
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const rp = new THREE.CanvasTexture(repousseCanvas());
  rp.wrapS = rp.wrapT = THREE.RepeatWrapping;
  rp.repeat.set(1 / 1.1, 1 / 1.1);
  const repousse = new THREE.MeshStandardMaterial({ color: 0x7e8086, metalness: 1, roughness: 0.4, bumpMap: rp, bumpScale: 3, envMapIntensity: 0.45 });
  const sj = new THREE.CanvasTexture(silverJaliCanvas());
  sj.wrapS = sj.wrapT = THREE.RepeatWrapping;
  const silverJali = new THREE.MeshStandardMaterial({ color: 0xa4a6ac, metalness: 1, roughness: 0.35, alphaMap: sj, alphaTest: 0.5, side: THREE.DoubleSide });

  return {
    env: neutralEnv,
    spire: spire.material,
    stone: stone.material,
    pillar: pillar.material,
    stoneDark: stoneDark.material,
    basalt: basalt.material,
    eave: eave.material,
    jali,
    frieze,
    recess: new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.95 }),
    flag: new THREE.MeshStandardMaterial({ map: flagTex, color: 0xffffff, emissive: 0x200400, emissiveIntensity: 0.3, roughness: 0.75, side: THREE.DoubleSide }),
    om: new THREE.MeshStandardMaterial({ color: 0x7a0000, roughness: 0.5, envMapIntensity: 0.1 }),
    horn: new THREE.MeshStandardMaterial({ color: 0xc9cbcf, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }),
    repousse,
    silverJali,
    lingam: new THREE.MeshPhysicalMaterial({ color: 0x3a2018, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    marigoldDeep: new THREE.MeshStandardMaterial({ color: 0xd94e00, roughness: 0.9 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x6a4a22, metalness: 0.3, roughness: 0.6, emissive: 0xff7a10, emissiveIntensity: 0.35 }),
  };
}

/** UVs for a vertical panel of length `len` and height `h` so a texture repeats every `tile` metres. */
export function panelUV(geo: THREE.PlaneGeometry, len: number, h: number, tile: number) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / tile, (uv.getY(i) * h) / tile);
  return geo;
}

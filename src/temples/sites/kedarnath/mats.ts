import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Kedarnath's own materials: grey Himalayan stone, painted wood, tin roof sheet, gold plating. */

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();
function tex(url: string, srgb: boolean) {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    cache.set(url, p);
  }
  return p;
}

/** apply a Poly Haven scan (diff / nor_gl / arm) to `m` at `size` metres per tile */
export function applyScan(m: THREE.MeshStandardMaterial, id: string, size: number, tint: THREE.ColorRepresentation, normalScale = 1) {
  const rep = 1 / size;
  const one = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(rep, rep);
    c.needsUpdate = true;
    return c;
  };
  return Promise.all([
    tex(`assets/tex/${id}_diff.webp`, true), tex(`assets/tex/${id}_nor.webp`, false), tex(`assets/tex/${id}_arm.webp`, false),
  ]).then(([d, n, a]) => {
    m.map = one(d);
    m.normalMap = one(n);
    m.normalScale.setScalar(normalScale);
    const arm = one(a);
    m.aoMap = arm;
    m.roughnessMap = arm;
    m.roughness = 1;
    m.metalness = 0;
    m.color.set(tint);
    m.needsUpdate = true;
  });
}

export function diffuse(url: string) {
  return tex(url, true);
}

/**
 * Weathering on the temple stone: darker damp base, black lichen/rain streaks that run
 * down from cornices, and a varied tone from block to block (every slab is a different
 * piece of the mountain).
 */
function weather(m: THREE.MeshStandardMaterial, amount: number, triplanar = 0) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          mat4 mm = modelMatrix;
          #ifdef USE_INSTANCING
            mm = modelMatrix * instanceMatrix;
          #endif
          vW = (mm * vec4(transformed, 1.0)).xyz;
          vWN = normalize(mat3(mm) * objectNormal);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW;
        varying vec3 vWN;
        float kh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(kh(i), kh(i+vec2(1,0)), f.x), mix(kh(i+vec2(0,1)), kh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `${triplanar > 0 ? `
        #ifdef USE_MAP
        {
          // triplanar: no seams on free-form rocks
          vec3 bw = pow(abs(vWN), vec3(4.0)) + 1e-4; bw /= dot(bw, vec3(1.0));
          float rp = ${(1 / Math.max(triplanar, 0.01)).toFixed(4)};
          vec4 tc = texture2D(map, vW.zy * rp) * bw.x + texture2D(map, vW.xz * rp) * bw.y + texture2D(map, vW.xy * rp) * bw.z;
          diffuseColor *= tc;
        }
        #endif` : '#include <map_fragment>'}
        {
          float hz = vW.x + vW.z * 0.93;
          float streak = smoothstep(0.55, 0.9, kn(vec2(hz * 3.1, vW.y * 0.25))) * (0.55 + 0.45 * kn(vec2(hz * 0.7, vW.y * 1.3)));
          float block = kn(floor(vec2(hz * 1.15, vW.y * 2.0)) * 1.7);
          float damp = 1.0 - smoothstep(0.0, 1.8, vW.y);
          #ifdef USE_MAP
            vec3 soft = texture2D(map, vMapUv, 5.0).rgb * diffuse;
            diffuseColor.rgb = mix(diffuseColor.rgb, soft, ${(amount > 0.7 ? 0.45 : 0.2).toFixed(2)});
          #endif
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum), 0.3);
          // strong large-scale light/dark vertical streaking (rain-washed and lichen-dark runs)
          float run = kn(vec2(hz * 0.9, vW.y * 0.06) + 5.0);
          float runD = smoothstep(0.55, 0.85, run), runL = smoothstep(0.45, 0.15, run);
          diffuseColor.rgb *= 1.0 - runD * ${(amount * 0.38).toFixed(2)};
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.8, 0.74), runL * ${(amount * 0.22).toFixed(2)});
          // brownish patina in broad patches, more contrast between slabs
          float pat = smoothstep(0.35, 0.75, kn(vec2(hz * 0.6, vW.y * 0.45) + 2.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.8, 0.64), pat * ${(amount * 0.45).toFixed(2)});
          // lichen (black and orange-grey) on exposed upper faces, colour drift from block to block
          float lich = smoothstep(0.62, 0.8, kn(vW.xz * 1.7 + vW.y * 0.9)) * smoothstep(0.3, 0.9, vWN.y + 0.3);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.76, 0.72), lich * ${(amount * 0.6).toFixed(2)});
          diffuseColor.rgb *= vec3(1.0 + (kn(vW.xy * 0.37 + vW.z) - 0.5) * 0.06, 1.0, 1.0 - (kn(vW.zy * 0.41) - 0.5) * 0.06);
          diffuseColor.rgb *= (0.9 + block * 0.2) * (1.0 - ${amount.toFixed(2)} * (streak * 0.5 + damp * 0.25));
          // large-scale drift (breaks the tile repeat), warm ochre slabs, white lime splashes
          float big = kn(vec2(hz * 0.23, vW.y * 0.31) + 7.0);
          diffuseColor.rgb *= 0.9 + big * 0.2;
          float ochre = smoothstep(0.62, 0.8, kn(floor(vec2(hz * 1.15, vW.y * 2.0)) * 0.93 + 3.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.02, 0.78), ochre * ${(amount * 0.7).toFixed(2)});
          float lime = smoothstep(0.9, 0.97, kn(vW.xy * 1.3 + vW.z * 0.9)) * (1.0 - smoothstep(0.0, 3.0, vW.y - 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.82), lime * ${(amount * 0.2).toFixed(2)});
          // dark rain streaks hanging under ledges: stronger just below each course line
          float under = 1.0 - smoothstep(0.0, 0.9, fract(vW.y / 1.15));
          diffuseColor.rgb *= 1.0 - under * streak * ${(amount * 0.25).toFixed(2)};
        }`);
  };
  m.customProgramCacheKey = () => 'kedar-weather-' + amount + '-' + triplanar;
}

export function makeMats() {
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.85 });
  const stoneIn = new THREE.MeshStandardMaterial({ color: 0x8f877c, roughness: 0.85 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.9 });
  const paving = new THREE.MeshStandardMaterial({ color: 0xa8a6a0, roughness: 0.8 });
  weather(stone, 1.0);
  weather(stoneDark, 1.2);
  weather(stoneIn, 0.5);
  stoneIn.envMapIntensity = 0.12;

  const paint = (c: number, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  // carved stone: the same granite, with a relief of scrolls, rosettes and small arches
  const carved = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.85 });
  weather(carved, 1.0);
  const mats = {
    stone, stoneIn, stoneDark, paving, carved,
    blue: paint(0x1d5fc4, 0.45),
    sky: paint(0x3aa6e0, 0.45),
    red: paint(0xb41e24, 0.5),
    yellow: paint(0xf0b624, 0.45),
    orange: paint(0xf07a1a, 0.5),
    green: paint(0x1f8a52, 0.5),
    maroon: paint(0x6a1e18, 0.7),
    wood: paint(0x5a3a22, 0.8),
    black: paint(0x18161a, 0.6),
    roof: new THREE.MeshStandardMaterial({ color: 0xd8b440, roughness: 0.5, metalness: 0.25 }),
    goldLeaf: new THREE.MeshStandardMaterial({ color: 0xf0b44a, roughness: 0.28, metalness: 1 }),
    goldPlate: new THREE.MeshStandardMaterial({ color: 0xf2c060, roughness: 0.32, metalness: 1 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x4c3a2a, roughness: 0.42, metalness: 0.65 }),
    nandi: new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.45, metalness: 0.6 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.95 }),
    bhim: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true }),
    idol: new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.4, metalness: 0.1 }),
    rockDark: new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.9 }),
    boulder: new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.9 }),
    lingam: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, clearcoat: 1.0, clearcoatRoughness: 0.22, vertexColors: true }),
    marigoldIn: new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7, emissive: 0x501000, emissiveIntensity: 0.5 }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.15, metalness: 0.3 }),
    sign: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    ash: new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 1 }),
  };
  mats.roof.normalMap = corrugation();
  mats.goldPlate.normalMap = repousse();
  // oxidised bronze: lighter greenish-brown wear on up-facing and exposed parts
  mats.nandi.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNW; varying vec3 vPW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNW = normalize(mat3(modelMatrix) * objectNormal); vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNW; varying vec3 vPW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wear = smoothstep(0.35, 0.9, vNW.y) * (0.6 + 0.4 * sin(vPW.x * 23.0 + vPW.z * 17.0 + vPW.y * 9.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.33, 0.24), wear * 0.55);`);
  };
  mats.nandi.customProgramCacheKey = () => 'kedar-nandi-bronze';
  mats.goldPlate.normalScale.setScalar(1.2);
  mats.sign.map = signTexture();

  const pending = [
    applyScan(carved, 'large_grey_tiles', 2.3, new THREE.Color(1.42, 1.33, 1.16), 1.0).then(() => {
      carved.normalMap = carvingNormal();
      carved.normalScale.setScalar(1.4);
      carved.needsUpdate = true;
    }),
    applyScan(stone, 'large_grey_tiles', 2.3, new THREE.Color(1.42, 1.33, 1.16), 0.75),
    applyScan(stoneIn, 'large_grey_tiles', 2.3, 0x9a9286, 1.3),
    applyScan(stoneDark, 'large_grey_tiles', 1.6, new THREE.Color(0.85, 0.8, 0.72), 1.5),
    applyScan(paving, 'large_grey_tiles', 3.6, 0xc9c6bf, 1.0),
    applyScan(mats.boulder, 'aerial_rocks_02', 2.2, 0x9a958e, 0.7),
    applyScan(mats.bhim, 'aerial_rocks_02', 2.6, 0x8a867f, 0.6),
    applyScan(mats.lingam, 'aerial_rocks_02', 0.7, 0xffffff, 1.6).then(() => {
      mats.lingam.map = null; // colour comes from the vertex paint (rock, sandal, ash, kumkum)
      mats.lingam.roughness = 0.38; // ghee-smeared and polished by hands
      mats.lingam.needsUpdate = true;
    }),
  ];
  weather(mats.boulder, 0.4, 2.2);
  weather(mats.bhim, 0.5, 2.6);
  return { mats, pending };
}

export type KMats = ReturnType<typeof makeMats>['mats'];

/** corrugated tin-sheet normal map: ridges every ~7.5 cm (UVs are in metres) */
function corrugation() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 64; x++) {
    const s = Math.cos((x / 64) * Math.PI * 2 * 4);
    g.fillStyle = `rgb(${Math.round(128 + s * 90)},128,${Math.round(230)})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.3, 1);
  return t;
}

/** embossed gold sheets of the sanctum walls: framed panels with a lotus boss */
function repousse() {
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x % 128) - 64, v = (y % 128) - 64;
      const edge = Math.max(Math.abs(u), Math.abs(v));
      const frame = edge > 58 ? 0 : edge > 52 ? 1 : 0.4;
      const r = Math.hypot(u, v), a = Math.atan2(v, u);
      const petal = Math.max(0, Math.cos(a * 8)) * Math.max(0, 1 - Math.abs(r - 26) / 14);
      const ring = Math.max(0, 1 - Math.abs(r - 42) / 3);
      h[y * S + x] = frame + petal * 0.8 + ring * 0.5 + (r < 8 ? 0.9 : 0);
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3, dy = (at(x, y + 1) - at(x, y - 1)) * 3;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.7, 1 / 0.7);
  return t;
}

/** the red board over the door: जय श्री केदार */
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c4161c';
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = '#f6c344';
  g.lineWidth = 6;
  g.strokeRect(5, 5, 502, 102);
  g.fillStyle = '#ffe9a8';
  g.font = '800 70px Martel, "Noto Sans Devanagari", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('जय श्री केदार', 256, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Reflections inside the sanctum. The gold-clad room mostly mirrors itself, so its plates get a
 * bright warm gold environment; the rock, copper and black stone take the engine's lamp-lit one.
 */
export function sanctumEnv(renderer: THREE.WebGLRenderer, K: KMats, lamp: THREE.Texture) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x4a3410);
  const glow = (c: number, x: number, y: number, z: number, r: number) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: c }));
    s.position.set(x, y, z);
    room.add(s);
  };
  glow(0xfff0c8, -2, 0, -2, 0.7); glow(0xfff0c8, 2, 0, -2, 0.7); glow(0xfff0c8, -2, 0, 2, 0.7); glow(0xfff0c8, 2, 0, 2, 0.7);
  glow(0xf8e0a0, 0, 4, 0, 2.5);
  glow(0xe8c880, 0, 0, 5, 3);
  glow(0x8a6a40, 0, -4, 0, 3);
  const pm = new THREE.PMREMGenerator(renderer);
  const gold = pm.fromScene(room, 0.04).texture;
  // a neutral grey-white studio environment for the silver: no warm tint in its reflections
  const neutral = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  K.goldPlate.envMap = gold;
  K.goldPlate.envMapIntensity = 0.75;
  K.lingam.envMap = lamp;
  K.lingam.envMapIntensity = 1.4;
  return { gold, lamp, neutral };
}

/** relief carving (0.6 m repeat): vine scroll band, rosette band, blind cusped arcade */
function carvingNormal() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#404040'; g.fillRect(0, 0, S, S);
  // rosette band (top third)
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, S, 8); g.fillRect(0, 80, S, 8);
  for (let x = 32; x < S + 64; x += 64) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillStyle = '#d0d0d0';
      g.beginPath(); g.ellipse(x + Math.cos(a) * 14, 44 + Math.sin(a) * 14, 13, 6, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, 44, 7, 0, Math.PI * 2); g.fill();
  }
  // vine scroll (middle third)
  g.strokeStyle = '#c8c8c8'; g.lineWidth = 7;
  g.beginPath();
  for (let x = 0; x <= S; x += 2) { const y = 128 + Math.sin((x / S) * Math.PI * 4) * 18; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.25) * 64, y = 128 + 18 * (i % 2 ? 1 : -1);
    g.beginPath(); g.arc(x + 10, y, 13, 0, Math.PI * 1.6); g.stroke();
    g.fillStyle = '#e0e0e0'; g.beginPath(); g.ellipse(x + 10, y, 7, 4, 0.6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 164, S, 8);
  // blind arcade of small cusped arches (bottom third)
  for (let x = 0; x < S; x += 43) {
    g.fillStyle = '#b4b4b4'; g.fillRect(x, 176, 43, 80);
    g.fillStyle = '#303030';
    g.beginPath(); g.moveTo(x + 8, 252); g.lineTo(x + 8, 205);
    g.quadraticCurveTo(x + 21.5, 178, x + 35, 205); g.lineTo(x + 35, 252); g.closePath(); g.fill();
  }
  g.filter = 'blur(1.5px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const src = g.getImageData(0, 0, S, S).data;
  const H = (x: number, y: number) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  const out = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 3.5, dy = (H(x, y + 1) - H(x, y - 1)) * 3.5;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.6);
  t.anisotropy = 8;
  return t;
}

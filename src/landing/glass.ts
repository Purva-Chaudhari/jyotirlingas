/**
 * The hub: a thin plate of clear glass in the shape of India (the India-view outline — all of J&K and
 * Ladakh, A&N, Lakshadweep) floating in the cosmos, refracting it; on it, Shiva in dhyana as a glass
 * sculpture (height map: public/landing/shiva-glass.webp, from scripts/build-shiva-glass.mjs).
 *
 * The slab starts lying exactly on the journey's globe (same lon/lat → sphere mapping), then lifts out of
 * it, flattens and turns to us; Shiva rises out of the glass from the head down. Colourless: white light only.
 */
import * as THREE from 'three';
/** India's outline (India point of view) — public/data/landing/india.json, built by scripts/build-landing-map.mjs */
export interface MapData {
  /** rings of lon, lat pairs: the mainland and the islands */
  outline: number[][];
}

const D2R = Math.PI / 180;
/** the mask texture's extent (scripts/build-landing-glass.mjs) */
const TEX = { lon0: 60, lon1: 100, lat0: 0, lat1: 40 };
/** the slab's grid (India plus a margin for the glow) */
const BOX = { lon0: 66, lon1: 99.5, lat0: 4.5, lat1: 38.5 };
/** the centre India turns around and lifts from */
export const CENTRE = { lon: 80.5, lat: 22 };
/**
 * Where the glass Shiva sits on India: the corners of his frame in lon/lat.
 * Tweak these to move or scale him (public/landing/shiva-glass.webp is built by scripts/build-shiva-glass.mjs).
 */
export const SHIVA = { lon0: 68.6, lon1: 88.2, lat0: 7.0, lat1: 35.0 };

/** three's SphereGeometry convention, as in cosmos.ts */
export function lonLatDir(lon: number, lat: number, out = new THREE.Vector3()) {
  const phi = (lon + 180) * D2R, th = (90 - lat) * D2R;
  return out.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}

const VS = /* glsl */ `
uniform vec3 uT, uE, uN;
uniform float uR, uFlat, uLift, uThick;
attribute vec3 aGeo;   // lon, lat, 1 = top / 0 = bottom
attribute vec2 aSide;  // walls: outward direction (east, north)
varying vec2 vUv; varying vec2 vFlat; varying vec2 vLL; varying vec3 vNrm; varying vec3 vPos; varying float vTop; varying float vWall;
vec3 dirOf(float lon, float lat){ float phi = radians(lon + 180.0), th = radians(90.0 - lat); return vec3(-cos(phi) * sin(th), cos(th), sin(phi) * sin(th)); }
void main(){
  vUv = vec2((aGeo.x - ${TEX.lon0.toFixed(1)}) / ${(TEX.lon1 - TEX.lon0).toFixed(1)}, (aGeo.y - ${TEX.lat0.toFixed(1)}) / ${(TEX.lat1 - TEX.lat0).toFixed(1)});
  vLL = aGeo.xy;
  float h = mix(-uThick, 0.0, aGeo.z);
  vec3 u = dirOf(aGeo.x, aGeo.y);
  vFlat = vec2(dot(u, uE), dot(u, uN));
  vec3 sphere = u * (uR + h);
  vec3 flat_ = uT * (uR + h) + uE * vFlat.x * uR + uN * vFlat.y * uR;
  vec3 p = mix(sphere, flat_, uFlat) + uT * uLift;
  vec3 up = normalize(mix(u, uT, uFlat));
  vWall = length(aSide) > 0.0 ? 1.0 : 0.0;
  vNrm = vWall > 0.5 ? normalize(uE * aSide.x + uN * aSide.y) : up;
  vTop = aGeo.z;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FS = /* glsl */ `
uniform sampler2D uMask, uShiva, uBg;
uniform vec2 uScreen, uShivaTexel, uMaskTexel;
uniform vec4 uShivaBox; // lon0, lat0, lon1, lat1
uniform vec3 uT, uE, uN, uKey, uCamL;
uniform float uR, uThick, uOpacity, uTime, uGlow, uDraw, uFigOn;
varying vec2 vUv; varying vec2 vFlat; varying vec2 vLL; varying vec3 vNrm; varying vec3 vPos; varying float vTop; varying float vWall;
const vec3 WHITE = vec3(0.92, 0.96, 1.0);
// thick glass seen edge-on: a faint cool green-cyan
const vec3 EDGE = vec3(0.78, 0.97, 0.93);
vec3 refractBg(vec2 suv, vec2 off){
  // a little dispersion: red, green and blue bend by slightly different amounts
  return vec3(texture2D(uBg, suv + off).r, texture2D(uBg, suv + off * 1.035).g, texture2D(uBg, suv + off * 1.07).b);
}
void main(){
  vec4 m = texture2D(uMask, vUv);
  float india = smoothstep(0.3, 0.7, m.r);
  vec3 V = normalize(uCamL - vPos);
  vec3 up = normalize(vNrm);
  vec2 suv = gl_FragCoord.xy / uScreen;
  if (vWall > 0.5) {
    // the slab's side, as cut glass: see-through (the cosmos behind, shifted and faintly green), with a crisp
    // bright line along its top and bottom arrises that glints where it faces the light
    float F = pow(1.0 - abs(dot(up, V)), 2.0);
    vec3 see = refractBg(suv, (uE.xy * up.x + uN.xy * up.y) * 0.0 + vec2(0.006, -0.009)) * mix(vec3(1.0), EDGE, 0.6) * 0.92;
    float lit = 0.35 + 0.65 * pow(max(dot(up, normalize(uKey)), 0.0), 0.8);
    float topL = smoothstep(0.78, 0.97, vTop), botL = 1.0 - smoothstep(0.03, 0.2, vTop);
    vec3 col = see * (0.85 + 0.15 * F) + EDGE * (topL * 0.85 * lit + botL * 0.35 * lit + F * 0.06) * uGlow;
    gl_FragColor = vec4(col * uOpacity, uOpacity);
    return;
  }
  // the plate: flat, with a bevel at the border (from the mask's soft edge)
  float gx = texture2D(uMask, vUv + vec2(uMaskTexel.x, 0.0)).g - texture2D(uMask, vUv - vec2(uMaskTexel.x, 0.0)).g;
  float gy = texture2D(uMask, vUv + vec2(0.0, uMaskTexel.y)).g - texture2D(uMask, vUv - vec2(0.0, uMaskTexel.y)).g;
  vec3 nP = normalize(vec3(-gx * 7.0, -gy * 7.0, 1.0));
  // Shiva (and any ornaments): a glass sculpture, from the height map
  vec2 vt = vec2(dot(V, uE), dot(V, uN)) / max(dot(V, uT), 0.25);
  vec2 luv = (vLL - uShivaBox.xy) / (uShivaBox.zw - uShivaBox.xy) - vt * 0.004;
  float inBox = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
  vec4 sh = texture2D(uShiva, luv) * inBox;
  float order = (1.0 - luv.y);
  float rev = smoothstep(order - 0.15, order, uDraw * 1.15) * uFigOn;
  float fa = sh.b * smoothstep(0.25, 0.8, m.r) * rev;
  // (stray pieces of the old cutout outside the figure — the removed moon / trishul — are not drawn)
  float oa = 0.0;
  float sa = max(fa, oa);
  float hx = (texture2D(uShiva, luv + vec2(uShivaTexel.x, 0.0)).r - texture2D(uShiva, luv - vec2(uShivaTexel.x, 0.0)).r);
  float hy = (texture2D(uShiva, luv + vec2(0.0, uShivaTexel.y)).r - texture2D(uShiva, luv - vec2(0.0, uShivaTexel.y)).r);
  // the relief fades out across the figure's own boundary, so no cut seam is drawn along the cutout
  float inner = smoothstep(0.7, 0.99, sh.b);
  hx *= inner; hy *= inner;
  vec3 nS = normalize(vec3(-hx * 9.0, -hy * 9.0, 1.0));
  vec3 nT = normalize(mix(nP, nS, sa));
  vec3 n = normalize(uE * nT.x + uN * nT.y + up * nT.z);
  float ndv = max(dot(n, V), 0.0);
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  // refraction of the cosmos behind (screen space), stronger through the sculpture
  float bevel = india * (1.0 - smoothstep(0.55, 0.97, m.g));
  // the background bends more through the bevel and the figure (with a touch of colour fringing there)
  // through the figure: the full bend for its fine detail (the face stays crisp), but capped, so the broad
  // dome never shifts the view far enough to show a copy of the coast inside him
  vec2 fo = nT.xy * 0.11 * sa;
  fo *= min(1.0, 0.006 / max(length(fo), 1e-5));
  vec2 off = nT.xy * (0.01 + 0.05 * bevel) + fo + vec2(0.0, 0.004);
  vec3 bg = refractBg(suv, off * (1.0 + 0.6 * bevel));
  // a light that sweeps slowly across, and the quiet studio key
  vec3 L1 = normalize(uKey + uE * 0.6 * sin(uTime * 0.23) + uN * 0.3 * cos(uTime * 0.17));
  vec3 r = reflect(-V, n);
  // highlights: sharp on the flat plate, broader on the sculpture's curves
  float spec = pow(max(dot(r, L1), 0.0), mix(400.0, 110.0, sa)) * mix(0.6, 0.75, sa);
  vec3 col = bg * mix(vec3(1.0), EDGE, 0.35 * bevel) * (1.0 + 0.1 * sa) + vec3(0.6, 0.7, 0.9) * 0.012 * india;
  // a broad soft reflection of a window sliding slowly across the flat top
  float bd = dot(vLL - vec2(80.0, 24.0), normalize(vec2(1.0, -0.75))) - 6.0 * sin(uTime * 0.05);
  float band = smoothstep(-3.5, -1.0, bd) * (1.0 - smoothstep(1.0, 4.0, bd));
  col += WHITE * band * 0.05 * india * (1.0 - 0.6 * sa);
  col += WHITE * (F * 0.35 + spec) * max(india, sa);
  // the sculpture: luminous edges, a little inner light, fine detail as soft etched highlights
  float slope = length(vec2(hx, hy));
  col += WHITE * smoothstep(0.02, 0.1, slope) * 0.42 * sa;
  col += WHITE * 0.012 * sa;
  // the silhouette catches the light like a polished edge (the crisp outline of the head, hair and face)
  float ex = texture2D(uShiva, luv + vec2(uShivaTexel.x * 2.0, 0.0)).b - texture2D(uShiva, luv - vec2(uShivaTexel.x * 2.0, 0.0)).b;
  float ey = texture2D(uShiva, luv + vec2(0.0, uShivaTexel.y * 2.0)).b - texture2D(uShiva, luv - vec2(0.0, uShivaTexel.y * 2.0)).b;
  col += WHITE * smoothstep(0.08, 0.5, length(vec2(ex, ey))) * 0.55 * rev * smoothstep(0.25, 0.8, m.r);
  // fine detail: light on the raised strokes, a darker groove beside them (eyes, malas, serpent, jata)
  col += WHITE * max(0.0, sh.g - 0.55) * 2.4 * fa;
  col *= 1.0 - max(0.0, 0.45 - sh.g) * 1.3 * fa;
  // the plate's bevel and its crisp lip
  float lip = india * (1.0 - smoothstep(0.95, 0.99, m.g));
  float dark = india * smoothstep(0.95, 0.975, m.g) * (1.0 - smoothstep(0.985, 0.998, m.g));
  vec2 en = normalize(vec2(-gx, -gy) + 1e-5);
  float face = 0.25 + 0.75 * pow(max(dot(en, normalize(vec2(-0.55, 0.85)) * vec2(1.0, -1.0) + 0.0), 0.0), 1.5)
             + 0.5 * pow(max(dot(en, normalize(vec2(0.8, -0.4))), 0.0), 3.0);
  col *= 1.0 - 0.45 * dark;
  col += EDGE * (bevel * 0.04 + lip * 0.75 * face) * uGlow;
  // a soft glow around the glass
  float halo = (1.0 - india) * m.b * (1.0 - oa);
  float a = max(india, oa);
  // outside the glass only the glow is added (the background is already there)
  col = mix(WHITE * halo * halo * 0.06 * uGlow, col, a);
  if (a + halo < 0.003) discard;
  gl_FragColor = vec4(col * uOpacity, a * uOpacity);
}`;

export interface Glass {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  ready: Promise<void>;
  /** a lon/lat point at the slab's mid-depth, in the globe's local frame */
  surface(lon: number, lat: number, out?: THREE.Vector3): THREE.Vector3;
}

export function createGlass(data: MapData, R: number, opts: { mobile: boolean }): Glass {
  const tl = new THREE.TextureLoader();
  let left = 2;
  let done: () => void = () => {};
  const ready = new Promise<void>((r) => (done = r));
  const onLoad = () => --left === 0 && done();
  const mask = tl.load('landing/india-glass.webp', onLoad, undefined, onLoad);
  const shiva = tl.load('landing/shiva-glass.webp', onLoad, undefined, onLoad);
  mask.colorSpace = shiva.colorSpace = THREE.NoColorSpace;
  shiva.anisotropy = 8;

  const T = lonLatDir(CENTRE.lon, CENTRE.lat);
  const N = new THREE.Vector3(0, 1, 0).addScaledVector(T, -T.y).normalize();
  const E = new THREE.Vector3().crossVectors(N, T).normalize(); // east
  const uniforms: Record<string, THREE.IUniform> = {
    uT: { value: T }, uE: { value: E }, uN: { value: N }, uR: { value: R * 1.002 },
    uFlat: { value: 0 }, uLift: { value: 0 }, uThick: { value: 0.022 },
    uMask: { value: mask }, uShiva: { value: shiva }, uBg: { value: null }, uScreen: { value: new THREE.Vector2(1, 1) },
    uShivaBox: { value: new THREE.Vector4(SHIVA.lon0, SHIVA.lat0, SHIVA.lon1, SHIVA.lat1) },
    uShivaTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1566) }, uMaskTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
    uKey: { value: new THREE.Vector3(0, 1, 0) }, uCamL: { value: new THREE.Vector3() },
    uOpacity: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 1 }, uDraw: { value: 0 }, uFigOn: { value: 0 },
  };

  // the top: a lon/lat grid over India (cut to her shape in the shader); the walls: every ring of the outline
  const nx = opts.mobile ? 120 : 200, ny = Math.round((nx * (BOX.lat1 - BOX.lat0)) / (BOX.lon1 - BOX.lon0));
  const geo: number[] = [], side: number[] = [], idx: number[] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      geo.push(BOX.lon0 + ((BOX.lon1 - BOX.lon0) * i) / nx, BOX.lat0 + ((BOX.lat1 - BOX.lat0) * j) / ny, 1);
      side.push(0, 0);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  for (const ring of data.outline) {
    const n = ring.length / 2;
    let area = 0;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      area += ring[k * 2] * ring[k2 * 2 + 1] - ring[k2 * 2] * ring[k * 2 + 1];
    }
    const ccw = area > 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const [x0, y0, x1, y1] = [ring[k * 2], ring[k * 2 + 1], ring[k2 * 2], ring[k2 * 2 + 1]];
      let ox = (y1 - y0) * ccw, oy = -(x1 - x0) * ccw;
      const l = Math.hypot(ox, oy) || 1;
      ox /= l;
      oy /= l;
      const base = geo.length / 3;
      geo.push(x0, y0, 1, x1, y1, 1, x0, y0, 0, x1, y1, 0);
      side.push(ox, oy, ox, oy, ox, oy, ox, oy);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aGeo', new THREE.Float32BufferAttribute(geo, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(geo.length), 3));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const place = (fx: number, fy: number, u: THREE.Vector3 | null, out: THREE.Vector3) => {
    const r = uniforms.uR.value as number, f = uniforms.uFlat.value as number, h = -(uniforms.uThick.value as number) * 0.5;
    const flat = T.clone().multiplyScalar(r + h).addScaledVector(E, fx * r).addScaledVector(N, fy * r);
    const sphere = u ? u.clone().multiplyScalar(r + h) : flat.clone();
    return out.copy(sphere).lerp(flat, f).addScaledVector(T, uniforms.uLift.value as number);
  };
  return {
    mesh,
    uniforms,
    ready,
    surface(lon, lat, out = new THREE.Vector3()) {
      const u = lonLatDir(lon, lat);
      return place(u.dot(E), u.dot(N), u, out);
    },
  };
}

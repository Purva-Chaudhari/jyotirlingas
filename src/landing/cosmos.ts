/**
 * "Through the Third Eye" — the landing's 3D journey (Three.js, loaded only on the landing).
 *
 *   Shiva       the Linga that holds the universe (linga.ts, procedural): black glass-stone with a galaxy
 *               inside, the tripundra and a glowing bindu, a gold jalahari, a stream of abhishek
 *   Third Eye   the camera pushes into the bindu on the linga's face; a vermilion-violet flare
 *   Universe    out of the flare: flying through nebula, stars and distant galaxies
 *   Earth       the Sun's light on a small blue world; it turns to night and to India
 *   Bharat      descending on India at night (NASA Black Marble); twelve golden lights
 *   The Twelve  India lights up as glass on the globe
 *   Hub         (hub.h / hub.fig, set by the page) the glass India lifts out of the globe into the cosmos,
 *               flattens and turns to us; Shiva rises in glass on it (glass.ts)
 *
 * The journey is driven by one progress value p ∈ [0, 1] (scroll / touch / keys / auto-play).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createLinga, glowTexture as softGlow, type Linga } from './linga';
import { createGlass, CENTRE, type Glass, type MapData } from './glass';

/** chapter boundaries on p */
export const CH = [0, 0.16, 0.3, 0.55, 0.75, 0.92, 1] as const;
export const chapterOf = (p: number) => Math.max(0, CH.findIndex((c, i) => p >= c && p < (CH[i + 1] ?? 2)));

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const EARTH_R = 3;
const EARTH_POS = new THREE.Vector3(0, 0, -230);
const SPACE_START = -20;

// ---------- shaders ----------
const NOISE = /* glsl */ `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
`;

/** the nebula sky: a sphere around the camera, coloured by direction (layered fbm in violet / indigo / rose) */
const SKY_VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = /* glsl */ `
uniform float uTime, uWarp, uBright; uniform vec3 uShift;
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir) + uShift;
  float n1 = fbm3(d * 2.2 + vec3(0.0, uTime * 0.01, 0.0));
  float n2 = fbm3(d * 4.5 + n1 * 1.8 + 7.0);
  float n3v = fbm3(d * 9.0 + n2 * 2.0 - 3.0);
  float cloud = smoothstep(0.5, 0.95, n2);
  float lanes = smoothstep(0.55, 0.75, n3v) * smoothstep(0.35, 0.75, n1);
  vec3 indigo = vec3(0.05, 0.03, 0.16), violet = vec3(0.36, 0.12, 0.62), rose = vec3(0.78, 0.26, 0.52), teal = vec3(0.10, 0.32, 0.55);
  vec3 col = vec3(0.004, 0.003, 0.012);
  col += indigo * smoothstep(0.45, 0.85, n1) * 1.3;
  col += mix(violet, rose, smoothstep(0.45, 0.85, n3v)) * cloud * cloud * 0.75;
  col += teal * smoothstep(0.6, 0.95, n1 * n2 * 1.8) * 0.35;
  col -= lanes * 0.08;
  // a band of the galaxy across the sky
  float band = exp(-pow(d.y * 2.6 + 0.35 * sin(d.x * 2.0), 2.0) * 3.0);
  col += vec3(0.42, 0.30, 0.55) * band * smoothstep(0.3, 0.8, n3v) * 0.45;
  col *= uBright;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

/** a procedural spiral galaxy, drawn once into a canvas */
function galaxyTexture(seed: number, hue: number) {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  g.translate(s / 2, s / 2);
  g.globalCompositeOperation = 'lighter';
  const core = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.22);
  core.addColorStop(0, 'rgba(255,240,220,0.95)');
  core.addColorStop(0.3, `hsla(${hue + 30},70%,70%,0.35)`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.fillRect(-s / 2, -s / 2, s, s);
  const arms = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < 2600; i++) {
    const arm = i % arms;
    const t = rnd();
    const ang = t * 7 + (arm / arms) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const rad = t * s * 0.46 + (rnd() - 0.5) * 6;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    const a = (1 - t) * 0.5 * rnd();
    g.fillStyle = rnd() < 0.15 ? `hsla(${hue - 40},80%,75%,${a})` : `hsla(${hue},60%,${70 + rnd() * 25}%,${a})`;
    g.fillRect(x, y, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** a soft round glow texture */
/** ॐ, white with a soft glow, on a transparent canvas (for the third-eye passage) */
function omTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${S * 0.62}px "Kohinoor Devanagari", "Devanagari Sangam MN", "Noto Sans Devanagari", "Mangal", serif`;
  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(255,220,160,0.9)';
  for (const b of [S * 0.06, S * 0.02]) { g.shadowBlur = b; g.fillText('ॐ', S / 2, S * 0.54); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.45)'));
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const EARTH_VS = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vView = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const EARTH_FS = /* glsl */ `
uniform sampler2D uDay, uNight; uniform vec3 uSun; uniform float uNightBoost, uFade;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main(){
  float l = dot(normalize(vN), normalize(uSun));
  float day = smoothstep(-0.12, 0.25, l);
  vec3 dc = texture2D(uDay, vUv).rgb;
  vec3 nc = texture2D(uNight, vUv).rgb;
  vec3 lights = pow(nc, vec3(1.6)) * vec3(1.6, 1.15, 0.7) * uNightBoost;
  vec3 col = dc * max(l, 0.0) * 1.25 * day + lights * (1.0 - day);
  float rim = pow(1.0 - max(dot(normalize(vN), vView), 0.0), 3.0);
  col += vec3(0.25, 0.5, 1.0) * rim * (0.25 + 0.75 * day);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

const ATMO_FS = /* glsl */ `
uniform vec3 uSun; uniform float uFade; varying vec3 vN; varying vec3 vView;
void main(){
  // seen from outside through the back faces: brightest just outside the limb, fading to nothing
  float d = dot(normalize(vN), vView);
  float glow = pow(clamp(0.62 + d, 0.0, 1.0), 4.0) * 1.6;
  float lit = smoothstep(-0.5, 0.4, dot(normalize(vN), normalize(uSun)));
  gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * glow * (0.2 + lit) * uFade, 1.0);
}`;

/**
 * The passage through the third eye, drawn over everything: an iris of light opening — fine rings and
 * radiating filaments turning against each other, god-rays, a lotus/yantra of gold hairlines blooming and
 * dissolving, sparks streaking past, a hot white-gold core in a deep violet field, chromatic fringes at the rim.
 */
const FLARE_VS = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FLARE_FS = /* glsl */ `
uniform float uAmt, uOpen, uTime;
uniform sampler2D uOm;
uniform vec2 uRes, uC;
float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }
// the iris at radius r (one colour channel's worth, so it can be sampled at slightly different radii)
float iris(float r, float a, float open){
  float rings = pow(0.5 + 0.5 * sin(r * mix(160.0, 45.0, open) - uTime * 2.2), 10.0) * smoothstep(0.015, 0.06, r) * exp(-r * mix(6.0, 2.6, open));
  float f1 = pow(0.5 + 0.5 * sin(a * 48.0 + uTime * 0.5 + sin(r * 30.0) * 0.4), 8.0);
  float f2 = pow(0.5 + 0.5 * sin(a * 77.0 - uTime * 0.8 - r * 6.0), 12.0);
  float fil = (f1 + 0.7 * f2) * smoothstep(0.02, 0.1, r) * exp(-r * mix(4.5, 2.2, open));
  return rings * 0.3 + fil * 0.55;
}
void main(){
  vec2 p = (gl_FragCoord.xy - uC) / uRes.y;
  float r = length(p), a = atan(p.y, p.x);
  float open = uOpen;
  // the field: deep violet, darkest at the edges
  vec3 col = mix(vec3(0.3, 0.1, 0.66), vec3(0.015, 0.005, 0.05), smoothstep(0.05, 0.75, r));
  // god-rays, flickering
  float rays = pow(0.5 + 0.5 * sin(a * 9.0 + sin(a * 3.0 + uTime * 0.7) * 2.0), 5.0) * (0.75 + 0.25 * sin(uTime * 11.0 + a * 7.0));
  rays += 0.6 * pow(0.5 + 0.5 * sin(a * 23.0 - uTime * 0.4), 9.0);
  col += vec3(1.0, 0.55, 0.25) * rays * exp(-r * 2.4) * 0.45;
  // the iris, with a chromatic fringe (red out, blue in)
  vec3 ir = vec3(iris(r * 1.012, a, open), iris(r, a, open), iris(r * 0.988, a, open));
  col += ir * mix(vec3(1.0, 0.55, 0.18), vec3(0.95, 0.25, 0.12), smoothstep(0.05, 0.3, r)) * 0.9;
  // the hot core
  float core = exp(-r * r * mix(900.0, 40.0, open));
  col += vec3(1.0, 0.93, 0.8) * core * 3.0 + vec3(1.0, 0.6, 0.25) * exp(-r * mix(22.0, 5.0, open)) * 1.2;
  // ॐ blooming out of the light, with a fine ring of gold around it, then dissolving
  float R = mix(0.08, 0.75, open);
  float c1 = 1.0 - smoothstep(0.0, 0.008, abs(r - R * 1.08));
  float bloom = sin(clamp(open, 0.0, 1.0) * 3.14159);
  vec2 ou = p / (min(R, 0.42) * 1.25) * 0.5 + 0.5;
  float om = (ou.x > 0.0 && ou.x < 1.0 && ou.y > 0.0 && ou.y < 1.0) ? texture2D(uOm, ou).a : 0.0;
  col += vec3(1.0, 0.86, 0.6) * om * bloom * 0.85 + vec3(1.0, 0.72, 0.3) * 0.6 * c1 * bloom * 0.3;
  // sparks: gold and violet streaks flying out past us
  float N = 140.0;
  float k = floor((a / 6.2831853 + 0.5) * N);
  for (int j = 0; j < 2; j++) {
    float s = k + float(j) * 0.5;
    float h = hash(s + float(j) * 31.0);
    float sa = (s + 0.5) / N * 6.2831853 - 3.14159265;
    float sr = fract(uTime * (0.25 + 0.6 * h) + h * 7.3) * 1.4;
    float across = abs(sin(a - sa)) * r;
    float along = r - sr;
    float len = 0.04 + 0.12 * sr;
    float sp = exp(-across * across * 60000.0) * smoothstep(-len, 0.0, along) * smoothstep(0.01, 0.0, along) * step(0.45, h);
    col += mix(vec3(1.0, 0.8, 0.42), vec3(0.75, 0.55, 1.0), step(0.75, h)) * sp * 1.3 * smoothstep(0.02, 0.2, sr);
  }
  gl_FragColor = vec4(col * uAmt, uAmt);
}`;

export interface CosmosOptions {
  mobile: boolean;
  /** the twelve temples (lon/lat), for the lights on Earth */
  temples: { lon: number; lat: number }[];
}

export class Cosmos {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points;
  private streaks: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private galaxies = new THREE.Group();
  /** the hero: the linga on its peetha, with its lights */
  private statue = new THREE.Group();
  private linga: Linga;
  private eyeHalo: THREE.Sprite;
  /** the third eye (the bindu), in hero space */
  private eyePos: THREE.Vector3;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private earth = new THREE.Group();
  private globe!: THREE.Mesh;
  /** the hub: India lifted out of the globe as a plate of glass, Shiva in glass on it (glass.ts) */
  private land: Glass | null = null;
  /** hub state, set by the page: h = the lift into the hub (0..1); fig = Shiva rising in (0..1) */
  hub = { h: 0, fig: 0, mx: 0, my: 0, narrow: false, fill: 0.85, scroll: 0 };
  /** the hub map's scroll: how far it scrolls (css px) — 0 when India fits the screen */
  hubExtent = 0;
  private hubLat: [number, number] = [30, 14];
  /** the scroll (0..1) that brings a latitude to the middle of the screen */
  hubScrollFor(lat: number) {
    const [top, bot] = this.hubLat;
    return top > bot ? Math.min(1, Math.max(0, (top - lat) / (top - bot))) : 0;
  }
  private hubPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private earthMat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private sun: THREE.Sprite;
  private sunDir = new THREE.Vector3(-1, 0.25, -0.35).normalize();
  /** yaw that turns India's meridian to face +z */
  private indiaYaw = 0;
  private twelve: THREE.Sprite[] = [];
  private twelveHalo: THREE.Sprite[] = [];
  private rawCam = new THREE.PerspectiveCamera();
  private align: [number, number, number] = [1, 0, 0];
  private dust: THREE.Points;
  private dpr = 1;
  private earthTex: THREE.Texture[] = [];
  private earthReady: Promise<void> = Promise.resolve();
  private targetDpr = 1;
  private slow = 0;
  ready: Promise<void>;
  /** the passage through the third eye (0..1) */
  flare = 0;
  private flareMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  p = 0;

  constructor(private canvas: HTMLCanvasElement, private opts: CosmosOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, powerPreference: 'high-performance', alpha: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.dpr = this.targetDpr = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 1.75);

    // the hero, and its reflections: a cosmic room with product-render softboxes
    this.linga = createLinga({ mobile: opts.mobile });
    this.eyePos = this.linga.eye.clone();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(this.linga.envScene(), 0.015).texture;
    this.scene.environmentIntensity = 1;
    pm.dispose();

    // sky
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VS,
        fragmentShader: SKY_FS,
        uniforms: { uTime: { value: 0 }, uWarp: { value: 0 }, uBright: { value: 1 }, uShift: { value: new THREE.Vector3() } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // stars: a far shell, and a near field along the flight that streaks past
    this.stars = this.starField(opts.mobile ? 2500 : 5000, (v) => v.setFromSphericalCoords(500 + Math.random() * 300, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2), 2.2); // small crisp points, no soft glitter
    this.streaks = this.streakField(opts.mobile ? 2000 : 4000);
    this.scene.add(this.stars, this.streaks);
    this.flareMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: FLARE_VS, fragmentShader: FLARE_FS, transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: { uOm: { value: omTexture() }, uAmt: { value: 0 }, uOpen: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Vector2() } },
      }),
    );
    this.flareMesh.frustumCulled = false;
    this.flareMesh.renderOrder = 1000;
    this.flareMesh.visible = false;
    this.scene.add(this.flareMesh);

    // distant galaxies along the way
    const spots: [number, number, number, number, number][] = [
      [-62, 22, -95, 26, 270], [58, -24, -120, 34, 300], [-18, -26, -140, 22, 210], [22, 20, -165, 30, 330], [-75, 34, -45, 40, 250], [70, 30, -25, 30, 290],
    ];
    spots.forEach(([x, y, z, s, hue], i) => {
      const m = new THREE.SpriteMaterial({ map: galaxyTexture(7 + i * 101, hue), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      sp.material.rotation = i * 1.3;
      this.galaxies.add(sp);
    });
    this.scene.add(this.galaxies);

    // floating motes of gold and violet around the linga
    this.dust = this.starField(opts.mobile ? 260 : 600, (v) => v.set((Math.random() - 0.5) * 7, Math.random() * 4.2 - 0.6, (Math.random() - 0.5) * 6), 1.3, 0xd9b8ff);
    this.scene.add(this.dust);

    // light: a warm key (high, front-left, the side of the diya), cool and violet rims from the cosmos
    const key = new THREE.DirectionalLight(0xffd2a0, 0.3);
    key.position.set(-3.2, 4.5, 4);
    const rim = new THREE.DirectionalLight(0xa070ff, 0.3);
    rim.position.set(4, 2.4, -3.2);
    const rim2 = new THREE.DirectionalLight(0x5f9dff, 0.2);
    rim2.position.set(-4.2, 1.6, -2.8);
    this.statue.add(key, rim, rim2, this.linga.group);
    this.scene.add(this.statue);

    // a soft glow over the bindu that grows as we go in
    this.eyeHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,90,50,1)'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    this.eyeHalo.position.copy(this.eyePos).add(new THREE.Vector3(0, 0, 0.01));
    this.statue.add(this.eyeHalo);

    // post: bloom (the bindu, the flame, the stream, the stars inside), then tone mapping
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: opts.mobile ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Earth
    const tl = new THREE.TextureLoader();
    const res = opts.mobile ? '2k' : '4k';
    let loaded = 0;
    let earthLoaded: () => void = () => {};
    const earthReady = new Promise<void>((r) => (earthLoaded = r));
    const onTex = () => ++loaded === 2 && earthLoaded();
    const day = tl.load(`landing/earth/day-${res}.webp`, onTex, undefined, onTex);
    const night = tl.load(`landing/earth/night-${res}.webp`, onTex, undefined, onTex);
    this.earthTex = [day, night];
    this.earthReady = earthReady;
    day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = night.anisotropy = 4;
    const sunDir = this.sunDir;
    this.earthMat = new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: EARTH_FS, uniforms: { uDay: { value: day }, uNight: { value: night }, uSun: { value: sunDir }, uNightBoost: { value: 1 }, uFade: { value: 1 } } });
    this.atmoMat = new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: ATMO_FS, uniforms: { uSun: { value: sunDir }, uFade: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), this.earthMat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.035, 64, 32), this.atmoMat);
    this.earth.add(globe, atmo);
    this.globe = globe;
    this.earth.position.copy(EARTH_POS);
    // the twelve lights on India
    // gold, not white: a saturated gold halo around a small warm core (kept below the tone curve's shoulder)
    const coreMap = softGlow('rgba(255,220,150,1)', 0.35);
    const haloMap = softGlow('rgba(255,170,50,1)', 0.12);
    for (const t of opts.temples) {
      const at = this.lonLat(t.lon, t.lat, EARTH_R * 1.003);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloMap, color: new THREE.Color(1.3, 0.68, 0.14), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreMap, color: new THREE.Color(2.4, 1.55, 0.55), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      halo.position.copy(at);
      core.position.copy(at);
      globe.add(halo, core);
      this.twelve.push(core);
      this.twelveHalo.push(halo);
    }
    const v = this.lonLat(79, 0, 1);
    this.indiaYaw = Math.atan2(v.x, v.z);
    this.scene.add(this.earth);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,200,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.sun.position.copy(EARTH_POS).addScaledVector(sunDir, 120);
    this.sun.scale.setScalar(70);
    this.scene.add(this.sun);

    // compile the hero first; then warm up the GPU for the later chapters so they don't hitch
    this.ready = this.renderer.compileAsync(this.scene, this.camera).then(() => {
      void this.earthReady.then(() => {
        for (const t of this.earthTex) this.renderer.initTexture(t);
        const vis = [this.earth.visible, this.sun.visible];
        this.earth.visible = this.sun.visible = true;
        void this.renderer.compileAsync(this.scene, this.camera).finally(() => ([this.earth.visible, this.sun.visible] = vis));
      });
    });
    this.resize();
  }

  private starField(n: number, place: (v: THREE.Vector3) => void, size: number, tint = 0xffffff) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      place(v);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(tint).offsetHSL((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.2).multiplyScalar(0.3 + Math.random() * 0.45); // kept under the bloom threshold: crisp points, no glitter halos
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTexture() });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }

  /** the near stars along the flight: sharp lines of light that stretch with speed (white, gold, violet) */
  private streakField(n: number) {
    const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), end = new Float32Array(n * 2);
    const palette = [new THREE.Color(1, 1, 1), new THREE.Color(1, 0.82, 0.5), new THREE.Color(0.75, 0.6, 1)];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 120, y = (Math.random() - 0.5) * 120, z = SPACE_START + 20 - Math.random() * 230;
      const c = palette[Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2].clone().multiplyScalar(0.5 + Math.random() * 0.7);
      pos.set([x, y, z, x, y, z], i * 6);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
      end.set([0, 1], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uLen: { value: 0.05 } },
      vertexShader: 'uniform float uLen; attribute float aEnd; varying vec3 vC; varying float vE; void main(){ vC = color; vE = aEnd; vec3 p = position; p.z += aEnd * uLen; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec3 vC; varying float vE; void main(){ float a = mix(0.55, 0.0, vE); gl_FragColor = vec4(vC * a, a); }',
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    return l;
  }

  private lonLat(lon: number, lat: number, r: number) {
    // three's SphereGeometry: u = 0 at -x going east via -z… (phi from +x towards -z): lon 0 at u = 0.5
    const phi = THREE.MathUtils.degToRad(lon + 180), th = THREE.MathUtils.degToRad(90 - lat);
    return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
  }

  /** India's outline (for the hub's landmass); loads its textures */
  setMapData(data: MapData) {
    if (this.land) return this.land.ready;
    const land = (this.land = createGlass(data, EARTH_R, { mobile: this.opts.mobile }));
    this.globe.add(land.mesh);
    // compile the glass ahead of time (and upload its textures), so the journey doesn't hitch when it appears
    return land.ready.then(async () => {
      for (const k of ['uMask', 'uShiva'] as const) this.renderer.initTexture(land.uniforms[k].value as THREE.Texture);
      const vis = land.mesh.visible;
      land.mesh.visible = true;
      await this.renderer.compileAsync(land.mesh, this.camera, this.scene).catch(() => {});
      land.mesh.visible = vis;
    });
  }

  /** the twelve on the hub's India, on screen (css px) */
  hubAnchors(temples: { lon: number; lat: number }[]): [number, number][] {
    if (!this.land) return [];
    this.earth.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return temples.map((t) => {
      this.land!.surface(t.lon, t.lat, v);
      v.applyMatrix4(this.globe.matrixWorld).project(this.camera);
      return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
    });
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.dpr);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** the camera and everything else at progress p (0..1), time t (s) */
  update(p: number, t: number, dt: number) {
    this.p = p;
    const cam = this.camera;
    const narrow = cam.aspect < 0.8;
    this.sky.material.uniforms.uTime.value = t;

    // chapter weights
    const toEye = ease(span(p, CH[1], CH[2] - 0.025));
    const flareIn = smooth(span(p, CH[2] - 0.035, CH[2] - 0.005));
    const flareOut = smooth(span(p, CH[2] + 0.005, CH[2] + 0.06));
    this.flare = flareIn * (1 - flareOut);
    {
      const fm = this.flareMesh, u = fm.material.uniforms;
      fm.visible = this.flare > 0.002;
      u.uAmt.value = this.flare;
      u.uOpen.value = span(p, CH[2] - 0.035, CH[2] + 0.06);
      u.uTime.value = t;
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      (u.uRes.value as THREE.Vector2).copy(size);
      // centred on the bindu while we approach, drifting to the centre of view as we pass through
      const e = this.eyeOnScreen();
      const k = p >= CH[2] ? 1 : smooth(span(p, CH[2] - 0.02, CH[2]));
      const ex = THREE.MathUtils.lerp(e.x, this.canvas.clientWidth / 2, k), ey = THREE.MathUtils.lerp(e.y, this.canvas.clientHeight / 2, k);
      (u.uC.value as THREE.Vector2).set((ex / this.canvas.clientWidth) * size.x, (1 - ey / this.canvas.clientHeight) * size.y);
    }
    const inSpace = p >= CH[2];
    this.statue.visible = !inSpace;
    this.earth.visible = p >= CH[3] - 0.05;
    this.sun.visible = inSpace;
    this.dust.visible = false; // the floating motes read as glitter; off
    // the flight's light streaks wait unseen until we pass through the eye (idle, they read as glitter)
    this.streaks.visible = p >= CH[2] - 0.02;

    if (!inSpace) {
      // hero: a slow drift, always from above the peetha's rim (never from beneath); then into the bindu
      const drift = Math.sin(t * 0.09) * 0.3;
      const R = narrow ? 7.4 : 5.1;
      const hero = new THREE.Vector3(Math.sin(drift) * R, (narrow ? 2.05 : 2.2) + Math.sin(t * 0.17) * 0.05, Math.cos(drift) * R);
      const look = new THREE.Vector3(0, narrow ? 1.3 : 1.22, 0);
      const eyeW = this.eyePos.clone();
      // come round to face the bindu, then straight in
      const front = eyeW.clone().add(new THREE.Vector3(0, 0.12, 1.6));
      const a1 = smooth(span(toEye, 0, 0.5));
      const a2 = ease(span(toEye, 0.3, 1));
      cam.position.lerpVectors(hero, front, a1).lerp(eyeW.clone().add(new THREE.Vector3(0, 0, 0.015)), a2);
      cam.lookAt(look.lerp(eyeW, smooth(Math.min(1, toEye * 1.8))));
      cam.fov = THREE.MathUtils.lerp(narrow ? 44 : 32, 28, toEye);
      const eg = 0.5 + 0.5 * Math.sin(t * 1.6);
      this.eyeHalo.scale.setScalar(0.1 + 0.02 * eg + toEye * 0.25);
      // the halo would fill the screen on the final approach: it gives way to the open bindu
      (this.eyeHalo.material as THREE.SpriteMaterial).opacity = (0.12 + 0.18 * toEye * toEye) * (1 - smooth(span(toEye, 0.45, 0.75)));
      this.linga.update(t, cam, 1 + 1.2 * toEye, smooth(span(toEye, 0.55, 0.92)));
      this.sky.material.uniforms.uBright.value = THREE.MathUtils.lerp(0.3, 1, toEye);
      this.streaks.material.uniforms.uLen.value = 0.05;
      (this.stars.material as THREE.PointsMaterial).size = THREE.MathUtils.lerp(1.6, 2.4, toEye); // small and crisp behind the linga (no glitter)
    } else {
      // the universe: forward through stars and galaxies, then Earth
      const fly = span(p, CH[2], CH[3]);
      const approach = span(p, CH[3], CH[4]);
      const descend = span(p, CH[4], CH[5]);
      const zFly = THREE.MathUtils.lerp(SPACE_START, -150, smooth(fly));
      const earthDist0 = EARTH_POS.z - -150; // negative
      const dEarth = THREE.MathUtils.lerp(-earthDist0, narrow ? 13 : 10, ease(approach));
      const dNear = THREE.MathUtils.lerp(narrow ? 13 : 10, EARTH_R + (narrow ? 3.4 : 2.5), ease(descend));
      const z = p < CH[3] ? zFly : EARTH_POS.z + (p < CH[4] ? dEarth : dNear);
      const sway = (1 - approach) * 0.6;
      cam.position.set(Math.sin(t * 0.1) * sway, Math.cos(t * 0.13) * sway * 0.6 + descend * 0.6, z);
      const lookEarth = EARTH_POS.clone().add(new THREE.Vector3(0, descend * 0.55, 0));
      const ahead = new THREE.Vector3(cam.position.x * 0.5, cam.position.y * 0.5, z - 50);
      cam.lookAt(ahead.lerp(lookEarth, smooth(span(p, CH[3] - 0.04, CH[3] + 0.06))));
      cam.fov = THREE.MathUtils.lerp(narrow ? 50 : 40, narrow ? 46 : 34, approach);
      // speed streaks while flying
      const speed = Math.sin(Math.PI * fly) * (1 - approach);
      (this.stars.material as THREE.PointsMaterial).size = 4.5;
      // the faster we fly, the longer the lines (the passage's burst gives an extra surge)
      this.streaks.material.uniforms.uLen.value = 0.08 + speed * 7 + 6 * (1 - smooth(span(p, CH[2], CH[2] + 0.08)));
      this.sky.material.uniforms.uBright.value = 1 - 0.55 * ease(descend);
      // Earth turns India towards us, from late afternoon into night
      const spin = THREE.MathUtils.lerp(-1.1, 0, ease(span(p, CH[3], CH[5] - 0.02)));
      // yaw India's meridian to face us, then pitch her latitude (≈ 22° N) to the centre
      this.earth.rotation.set(THREE.MathUtils.degToRad(22) * (0.35 + 0.65 * ease(descend)), -this.indiaYaw + spin, 0, 'XYZ');
      // the Sun swings from behind us (a blue world in daylight) to behind the Earth (night over India)
      const night = ease(span(p, CH[3] + 0.09, CH[4] + 0.05));
      this.sunDir.set(THREE.MathUtils.lerp(-0.55, -1, night), 0.25, THREE.MathUtils.lerp(0.8, -0.35, night)).normalize();
      this.sun.position.copy(EARTH_POS).addScaledVector(this.sunDir, 120);
      // the cities dim a little as the twelve light up, so the twelve stand out
      this.earthMat.uniforms.uNightBoost.value = (0.8 + 1.4 * descend) * (1 - 0.45 * smooth(span(p, CH[4] + 0.05, CH[5])));
      const on = smooth(span(p, CH[4] + 0.03, CH[5] - 0.02));
      this.twelve.forEach((s, i) => {
        const breath = 0.8 + 0.2 * Math.sin(t * 1.8 + i * 1.3);
        (s.material as THREE.SpriteMaterial).opacity = on * breath;
        s.scale.setScalar(0.035 + 0.02 * descend);
        const h = this.twelveHalo[i];
        (h.material as THREE.SpriteMaterial).opacity = on * 0.85 * breath;
        h.scale.setScalar(0.1 + 0.05 * descend);
      });
    }
    this.updateHub(p, t);
    const [k, sx, sy] = this.align;
    cam.zoom = k;
    if (sx || sy) {
      const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
      cam.setViewOffset(w, h, -sx, -sy, w, h);
    } else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.dust.rotation.y = t * 0.02;
    this.dust.position.y = Math.sin(t * 0.3) * 0.05;

    // adaptive resolution: drop the pixel ratio a step when frames run long, recover slowly
    this.slow = this.slow * 0.95 + (dt > 1 / 45 ? 1 : 0) * 0.05;
    if (this.slow > 0.5 && this.targetDpr > 0.75) {
      this.targetDpr = Math.max(0.75, this.targetDpr - 0.25);
      this.slow = 0;
    }
    if (this.targetDpr !== this.dpr) {
      this.dpr = this.targetDpr;
      this.resize();
    }
  }

  /** India lifts out of the globe as glass; the cosmos calms; Shiva rises in the glass */
  private updateHub(p: number, t: number) {
    const cam = this.camera;
    const land = this.land;
    const { h, fig } = this.hub;
    const landIn = smooth(span(p, CH[5] - 0.035, 0.97));
    if (!land) return;
    const u = land.uniforms;
    land.mesh.visible = landIn > 0.001 || h > 0;
    const lift = ease(h);
    u.uOpacity.value = Math.max(landIn, h > 0 ? 1 : 0);
    u.uFlat.value = smooth(span(h, 0.05, 0.75));
    u.uLift.value = 0.5 * lift;
    u.uTime.value = t;
    u.uGlow.value = 0.6 + 0.4 * smooth(span(h, 0.3, 1));
    u.uDraw.value = fig;
    u.uFigOn.value = smooth(span(h, 0.4, 0.8));
    // the Earth gives way to the cosmos
    const fade = (1 - 0.4 * landIn) * (1 - smooth(span(h, 0.05, 0.7)));
    this.earthMat.uniforms.uFade.value = fade;
    this.atmoMat.uniforms.uFade.value = fade;
    this.earthMat.visible = fade > 0.002;
    this.atmoMat.visible = fade > 0.002;
    this.sun.visible = this.sun.visible && fade > 0.05;
    for (let i = 0; i < this.twelve.length; i++) {
      (this.twelve[i].material as THREE.SpriteMaterial).opacity *= 1 - landIn;
      (this.twelveHalo[i].material as THREE.SpriteMaterial).opacity *= 1 - landIn;
    }
    // the cosmos stays behind the glass, a little calmer so the hub reads
    if (h > 0) this.sky.material.uniforms.uBright.value = THREE.MathUtils.lerp(this.sky.material.uniforms.uBright.value, 0.62, ease(h));

    this.earth.updateMatrixWorld(true);
    const m = this.globe.matrixWorld;
    const inv = new THREE.Matrix4().copy(m).invert();
    const T = (u.uT.value as THREE.Vector3), N = (u.uN.value as THREE.Vector3), E = (u.uE.value as THREE.Vector3);
    // the hub's camera: India whole on the screen (as wide as the page allows, never taller than it), looking
    // down with a slight tilt, north up the screen
    if (h > 0) {
      const narrow = this.hub.narrow;
      const fov = narrow ? 44 : 36, tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
      const R = EARTH_R + 0.5;
      const indiaW = R * THREE.MathUtils.degToRad(29.5) * Math.cos(THREE.MathUtils.degToRad(22));
      // far enough to hold her whole width (hub.fill of the screen) — and her whole height too, Ladakh to
      // Kanyakumari: the map is seen entire from the start, never scrolled (scrolling leads on to About)
      const dWide = indiaW / this.hub.fill / (2 * tanV * cam.aspect);
      // her height plus room above Ladakh for the heading (halfDeg ≥ 15.7° already puts top ≤ bot below)
      const dTall = (R * THREE.MathUtils.degToRad(16.6)) / tanV;
      const d = Math.max(dWide, dTall);
      const halfDeg = THREE.MathUtils.radToDeg((d * tanV) / R);
      const top = 36.2 - halfDeg * 0.9, bot = 8.6 + halfDeg * 0.86;
      const scrollable = top > bot;
      // whole: centred a little south, so Ladakh clears the heading and Kanyakumari still shows
      const lat = scrollable ? THREE.MathUtils.lerp(top, bot, this.hub.scroll) : 23.1;
      this.hubExtent = scrollable ? ((top - bot) / (2 * halfDeg)) * this.canvas.clientHeight : 0;
      this.hubLat = [top, bot];
      const c = land.surface(CENTRE.lon + (narrow ? 1.6 : 0.6), lat).applyMatrix4(m);
      const tw = T.clone().transformDirection(m), nw = N.clone().transformDirection(m), ew = E.clone().transformDirection(m);
      const tilt = THREE.MathUtils.degToRad(10);
      // a slow float and the mouse's parallax
      const dr = 0.045 * Math.sin(t * 0.07) + this.hub.mx * 0.04;
      const pos = c.clone().addScaledVector(tw, d * Math.cos(tilt)).addScaledVector(nw, -d * Math.sin(tilt)).addScaledVector(ew, dr * d).addScaledVector(nw, (this.hub.my * 0.03 + 0.01 * Math.sin(t * 0.11)) * d);
      const look = new THREE.Matrix4().lookAt(pos, c, nw);
      this.hubPose.pos.copy(pos);
      this.hubPose.quat.setFromRotationMatrix(look);
      const k = ease(h);
      cam.position.lerp(this.hubPose.pos, k);
      cam.quaternion.slerp(this.hubPose.quat, k);
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, k);
    }
    // the studio key for the glass's reflections: up-left of the camera, in the globe's frame
    const camQ = cam.quaternion;
    (u.uKey.value as THREE.Vector3).set(-0.45, 0.75, 0.55).applyQuaternion(camQ).transformDirection(inv);
    (u.uCamL.value as THREE.Vector3).copy(cam.position).applyMatrix4(inv);
  }

  render() {
    // the glass refracts what is behind it: draw the scene without it into a half-size target first
    const land = this.land;
    if (land && land.mesh.visible && (land.uniforms.uOpacity.value as number) > 0) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.max(2, Math.round(size.x / 2)), h = Math.max(2, Math.round(size.y / 2));
      if (!this.bgRT) this.bgRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      if (this.bgRT.width !== w || this.bgRT.height !== h) this.bgRT.setSize(w, h);
      land.mesh.visible = false;
      this.renderer.setRenderTarget(this.bgRT);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      land.mesh.visible = true;
      land.uniforms.uBg.value = this.bgRT.texture;
      (land.uniforms.uScreen.value as THREE.Vector2).copy(size);
    }
    this.composer.render();
  }
  private bgRT: THREE.WebGLRenderTarget | null = null;

  /** the third eye on screen (css px) */
  eyeOnScreen() {
    const v = this.eyePos.clone().applyMatrix4(this.statue.matrixWorld).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  /**
   * Fit the globe onto the 2D map: zoom by k about the screen centre, then shift by (sx, sy) css px —
   * done in the projection (zoom + view offset), so the picture never slides off the canvas.
   */
  setAlign(k: number, sx: number, sy: number) {
    this.align = [k, sx, sy];
  }

  /** the twelve lights on screen (css px), for aligning the globe with the map as they cross-fade */
  templesOnScreen(): [number, number][] {
    this.earth.updateMatrixWorld(true);
    // as the camera would draw them without the alignment below
    const cam = this.rawCam.copy(this.camera);
    cam.zoom = 1;
    cam.clearViewOffset();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3();
    return this.twelve.map((s) => {
      s.getWorldPosition(v).project(cam);
      return [(v.x * 0.5 + 0.5) * this.canvas.clientWidth, (-v.y * 0.5 + 0.5) * this.canvas.clientHeight];
    });
  }

  dispose() {
    this.renderer.dispose();
  }
}

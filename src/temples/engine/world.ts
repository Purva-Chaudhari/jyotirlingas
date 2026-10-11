import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildMaterials, applyScans, type Materials } from './materials';
import { Physics, type Flames } from './kit';
import type { SiteDef, BuiltSite, Portal } from '../sites/types';
import { detectDevice, pickTier, profileFor, quality, setQuality, type Profile } from './profile';
import { lookGain, STICK_TURN, stickSpeed, stickSteer } from './stick';

const EYE = 1.62;
const RADIUS = 0.3;
const CLIMB = 0.75;
const WALK = 3.4;
const RUN = 7.5;
/** Space jump: take-off speed (m/s) and gravity while airborne (m/s²): apex v²/2g ≈ 0.8 m */
const JUMP_V = 4.2;
const JUMP_G = 11;
/** top of the head above the feet: a jump stops when it meets a ceiling or anything above */
const HEAD = 1.8;
/** ← / → turning speed (rad/s) */
const TURN = 1.9;
/** px a pointer must move before it counts as dragging the view */
const DRAG_SLOP = 6;
/** after the mouse is still this long, walking/turning with keys eases the view back to level */
const LEVEL_AFTER_MS = 900;
const LEVEL_RATE = 3.5;
// default sun placement relative to a site (front-left, west-south-west); its height comes from the HDRI's real sun
const DEFAULT_SUN_AZIMUTH = Math.atan2(-0.78, 0.5);
const HDRI = 'assets/hdri/qwantani_sunset_puresky.hdr';


const FlameShader = {
  vertex: /* glsl */ `
    attribute float phase;
    uniform float time;
    uniform float scale;
    varying float vFlick;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float f = 1.0 + 0.16 * sin(time * 9.0 + phase) + 0.09 * sin(time * 23.0 + phase * 2.3);
      vFlick = f;
      gl_PointSize = 0.16 * f * scale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    varying float vFlick;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5, 0.62);
      p.x *= 2.1;
      p.y *= p.y < 0.0 ? 0.9 : 1.6;
      float d = length(p);
      float core = smoothstep(0.22, 0.0, d);
      float glow = smoothstep(0.5, 0.0, d);
      vec3 c = mix(vec3(1.0, 0.38, 0.04), vec3(1.0, 0.92, 0.7), core);
      float a = glow * 0.9;
      if (a < 0.01) discard;
      gl_FragColor = vec4(c * (2.6 + core * 6.0) * vFlick, a * 0.85);
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 uv = vUv - 0.5;
      c *= 1.0 - dot(uv, uv) * 0.7;
      c += (rand(vUv * vec2(1733.0, 977.0) + fract(time)) - 0.5) * 0.018;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/** default bloom strength (sites may lower it per zone via ctx.setBloom) */
const BLOOM = 0.38;

/**
 * Renders the scene into its own multisampled target that keeps a depth texture, then copies the colour
 * on. The ambient-occlusion pass reads that depth instead of drawing the whole scene a second time.
 */
class ScenePass extends Pass {
  readonly target: THREE.WebGLRenderTarget;
  private copy = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
    vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader,
  }));
  constructor(private scene: THREE.Scene, private camera: THREE.Camera, samples = 4) {
    super();
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(1, 1) });
  }
  setSize(w: number, h: number) { this.target.setSize(w, h); }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    (this.copy.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.render(renderer);
  }
}

/**
 * Walking controls without pointer lock: the cursor stays free for clicking (story controls, aarti,
 * links), and the view turns only while you hold a mouse button (or a finger) down and drag.
 * Same small interface the app used with PointerLockControls: lock() starts walking, unlock()/Esc pauses,
 * with 'lock' / 'unlock' / 'change' events.
 */
class DragLook extends THREE.EventDispatcher<{ lock: object; unlock: object; change: object }> {
  isLocked = false;
  /** the pointer that is dragging the view; `live` once it has really moved (a click's jitter is not a drag) */
  private drag: { id: number; x: number; y: number; x0: number; y0: number; live: boolean } | null = null;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(private camera: THREE.Camera, private el: HTMLElement) {
    super();
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (!this.isLocked || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, live: false };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      // a few px of jitter while clicking or tapping neither turns the view nor stops a Places walk
      if (!this.drag.live) {
        if (Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) < DRAG_SLOP) return;
        this.drag.live = true;
      }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      const k = e.pointerType === 'mouse' ? 0.0042 : lookGain(innerWidth, innerHeight);
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y += dx * k;
      // (a finger tilts a little slower than it turns: easier to keep the horizon while looking round)
      this.euler.x = THREE.MathUtils.clamp(this.euler.x + dy * k * (e.pointerType === 'mouse' ? 1 : 0.8), -1.45, 1.45);
      this.camera.quaternion.setFromEuler(this.euler);
      this.dispatchEvent({ type: 'change' });
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.drag = null;
      el.style.cursor = this.isLocked ? 'grab' : '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape') this.unlock(); });
  }
  lock() {
    if (this.isLocked) return;
    this.isLocked = true;
    this.el.style.cursor = 'grab';
    this.dispatchEvent({ type: 'lock' });
  }
  unlock() {
    if (!this.isLocked) return;
    this.isLocked = false;
    this.drag = null;
    this.el.style.cursor = '';
    this.dispatchEvent({ type: 'unlock' });
  }
}

/** overhead triangles near a jump (world space, 9 floats each), per 1 m cell the offsets of those over it, and per fine cell the lowest small one */
interface Ceiling { tris: Float32Array; cells: Map<number, number[]>; low: Map<number, number> }
/** small overhead triangles are kept only as the lowest point over each FINE-metre cell */
const FINE = 0.25;
/** triangles per run in a geometry's chunk boxes */
const CHUNK = 128;
const chunkCache = new WeakMap<THREE.BufferGeometry, { version: number; boxes: Float32Array }>();
/**
 * Local-space bounding boxes (6 floats) of each run of CHUNK consecutive triangles of a geometry, built once.
 * Merged meshes are concatenated object by object, so consecutive triangles sit together and most runs
 * can be skipped without reading their vertices.
 */
function chunkBoxes(geo: THREE.BufferGeometry): Float32Array {
  const pos = geo.attributes.position, idx = geo.index?.array;
  const version = (pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? (pos as THREE.InterleavedBufferAttribute).data.version : (pos as THREE.BufferAttribute).version;
  const hit = chunkCache.get(geo);
  if (hit && hit.version === version) return hit.boxes;
  const n = idx ? idx.length : pos.count, runs = Math.ceil(n / 3 / CHUNK);
  const boxes = new Float32Array(runs * 6);
  for (let r = 0; r < runs; r++) {
    let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity;
    const end = Math.min(n - (n % 3), (r + 1) * CHUNK * 3);
    for (let t = r * CHUNK * 3; t < end; t++) {
      const i = idx ? idx[t] : t;
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      if (px < lx) lx = px; if (px > hx) hx = px;
      if (py < ly) ly = py; if (py > hy) hy = py;
      if (pz < lz) lz = pz; if (pz > hz) hz = pz;
    }
    boxes.set([lx, ly, lz, hx, hy, hz], r * 6);
  }
  chunkCache.set(geo, { version, boxes });
  return boxes;
}
const cell = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export class TempleWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.05, 3000);
  readonly controls: DragLook;
  private scene = new THREE.Scene();
  private composer: EffectComposer;
  private grade: ShaderPass;
  private bloom?: UnrealBloomPass;
  private ao?: GTAOPass;
  /** render quality for this device (engine/profile.ts): desktops keep 'high', phones get a lighter one */
  profile: Profile;
  private frameNo = 0;
  private phys = new Physics();
  private flames: Flames = { points: [], lights: [] };
  private flameMat!: THREE.ShaderMaterial;
  private built!: BuiltSite;
  private sunAzimuth: number;
  private sun!: THREE.DirectionalLight;
  private root = new THREE.Group();
  /** resolves when the HDRI sky, scanned materials and trees are in */
  readonly ready: Promise<void>;
  private clock = new THREE.Timer();
  private keys = new Set<string>();
  feet = new THREE.Vector3(0, 0, 34);
  private vy = 0;
  /**
   * mid-jump: the floor under you (walls and barricades are tested from it as well as from the raised feet,
   * so a jump never clears or lands on anything walking can't) and the meshes near enough to be a ceiling
   */
  private air: { ground: number; ceil: Ceiling } | null = null;
  private bob = 0;
  private ray = new THREE.Raycaster();
  private running = false;
  private lightBase = new Map<THREE.PointLight, number>();
  /** render resolution: up to 1.5× on retina (1.25 / 1 on phones), lowered in 0.25 steps only while frames run slow */
  private maxPixelRatio: number;
  private pixelRatio: number;
  private perf = { frames: 0, time: 0, good: 0, slow: 0 };
  /** the last measured frame rate (dev/testing) */
  fps = 0;
  /**
   * analog walk from the touch joystick (engine/touch.ts): x turns the view, y walks forward (-1..1), mag 0..1;
   * used when no move key is held
   */
  readonly stick = { x: 0, y: 0, mag: 0 };
  private look = new THREE.Euler(0, 0, 0, 'YXZ');
  /** last time the mouse turned the view (keys only level the view once the mouse has been still a moment) */
  private mouseAt = 0;
  /** the doorway you are standing at, if any (see BuiltSite.portals) */
  private portal: Portal | null = null;
  private portalEl = document.createElement('button');
  private fadeEl = document.createElement('div');
  private passing = false;
  zone = 'courtyard';
  /** dev/testing: walk without pointer lock */
  autopilot = false;
  /**
   * auto-walk (engine/travel.ts): while set and no move key is held, each step asks it for this frame's move
   * (metres in x, z) and walks it with the normal collision and floor following
   */
  drive: ((dt: number) => { x: number; z: number } | null) | null = null;
  /** true while travel.ts walks the pilgrim to a place (stories hold their triggers until arrival) */
  travelling = false;
  onZone: (z: string) => void = () => {};
  /** extra per-frame work (story markers, positional audio): (dt s, elapsed s), run before the render */
  readonly frameHooks: ((dt: number, t: number) => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private site: SiteDef) {
    this.sunAzimuth = site.sunAzimuth ?? DEFAULT_SUN_AZIMUTH;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const device = detectDevice(this.renderer.getContext());
    this.profile = profileFor(pickTier(device, new URLSearchParams(location.search).get('quality')), device.dpr);
    setQuality(this.profile);
    this.maxPixelRatio = this.profile.maxPixelRatio;
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // phones: the sun and nearly everything that casts are still, so the shadow map is redrawn every few frames
    // (needsUpdate stays set until the first frame draws it: until then the shadow map does not exist)
    if (this.profile.shadowEvery > 1) { this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true; }
    this.watchContext(canvas);

    if (site.far) { this.camera.far = site.far; this.camera.updateProjectionMatrix(); }
    this.buildLights();
    const M = buildMaterials();
    const interiorEnv = this.lampLitInterior(M);
    this.scene.add(this.root);
    const pending: Promise<unknown>[] = [];
    this.built = site.build({
      root: this.root, M, P: this.phys, flames: this.flames,
      sunDir: this.sun.position.clone().normalize(), renderer: this.renderer, pending, interiorEnv,
      setBloom: (s) => { if (this.bloom) this.bloom.strength = s ?? BLOOM; },
    });
    this.feet.set(...this.built.spawn.feet);
    // the AO pass re-renders the scene with an override material, which would re-run every
    // Water mirror (a whole extra scene render each); the mirror is already current, so skip it
    // (on phones the mirror is also redrawn only every few frames)
    const waterEvery = this.profile.waterEvery;
    this.root.traverse((o) => {
      if (!(o as { isWater?: boolean }).isWater) return;
      const mirror = o.onBeforeRender;
      const world = this;
      o.onBeforeRender = function (renderer, scene, ...rest) {
        if (scene.overrideMaterial) return;
        if (waterEvery > 1 && world.frameNo % waterEvery !== 0) return;
        mirror.call(this, renderer, scene, ...rest);
      };
    });
    this.buildFlames();
    for (const l of this.flames.lights) this.lightBase.set(l, l.intensity);

    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    const scenePass = new ScenePass(this.scene, this.camera, this.profile.msaa);
    this.composer.addPass(scenePass);
    if (this.profile.ao !== 'off') this.addAO(scenePass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), BLOOM, 0.45, 3.2);
    // phones: the glow is soft anyway; a smaller bloom chain costs a fraction
    const bloomSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w: number, h: number) => {
      const k = quality().bloomScale;
      bloomSize(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)));
    };
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());


    this.controls = new DragLook(this.camera, canvas);
    this.controls.addEventListener('change', () => (this.mouseAt = performance.now()));
    // doorway prompt and the fade used when passing through one
    this.portalEl.id = 'portal-prompt';
    this.portalEl.addEventListener('mousedown', (e) => e.stopPropagation());
    this.portalEl.addEventListener('click', (e) => { e.stopPropagation(); this.usePortal(); });
    this.fadeEl.id = 'portal-fade';
    document.body.append(this.portalEl, this.fadeEl);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && this.controls.isLocked) this.usePortal(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') this.onSpace(e); });
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.placeCamera();
    this.camera.lookAt(...this.built.spawn.look);
    this.ready = Promise.all([this.loadSky(), applyScans(M, this.renderer), this.loadTrees(), ...pending])
      .then(() => this.capAnisotropy())
      .then(() => this.precompile());
  }

  private addAO(scenePass: ScenePass) {
    const ao = (this.ao = new GTAOPass(this.scene, this.camera, 1, 1));
    ao.setGBuffer(scenePass.target.depthTexture!);
    // ambient occlusion is soft and low-frequency: computing it (and its extra scene render) at half
    // resolution looks the same and was the single biggest per-frame cost
    const aoSize = ao.setSize.bind(ao);
    ao.setSize = (w: number, h: number) => aoSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 });
    this.composer.addPass(ao);
  }

  /**
   * Compile every material's shader up front (including objects a site keeps hidden
   * until you walk into a sanctum), so there is no stutter on first view or on entering.
   */
  private async precompile() {
    // sites switch lamps by zone (sanctum lamps on, door glow off...): every light count is a separate
    // shader variant, so besides "everything on" also compile the flipped light state — otherwise the
    // first walk through a doorway stalls for ~0.6 s while every material recompiles
    const lights: [THREE.Light, boolean][] = [];
    this.scene.traverse((o) => { if ((o as THREE.Light).isLight && !(o as THREE.DirectionalLight).isDirectionalLight) lights.push([o as THREE.Light, o.visible]); });
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
      if (lights.some(([, on]) => !on)) {
        // the flipped state (inside a sanctum) and the real starting state, with every mesh still shown
        for (const [l, on] of lights) l.visible = !on;
        await this.renderer.compileAsync(this.scene, this.camera);
        for (const [l, on] of lights) l.visible = on;
        await this.renderer.compileAsync(this.scene, this.camera);
      }
    } catch {
      /* best effort */
    } finally {
      for (const o of hidden) o.visible = false;
      for (const [l, on] of lights) l.visible = on;
    }
  }

  /** phones: cheaper texture filtering (set before the textures are first uploaded, in precompile) */
  private capAnisotropy() {
    const cap = this.profile.anisotropy;
    if (!cap) return;
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        for (const v of Object.values(m)) {
          const t = v as THREE.Texture;
          if (t && t.isTexture && !seen.has(t)) {
            seen.add(t);
            if (t.anisotropy > cap) { t.anisotropy = cap; t.needsUpdate = true; }
          }
        }
      }
    });
  }

  /**
   * iOS Safari (and Android under memory pressure) can take the WebGL context away. Say so, offer a
   * reload, and carry on by itself if the browser gives the context back.
   */
  private watchContext(canvas: HTMLCanvasElement) {
    let box: HTMLElement | null = null;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // ask for it back
      this.renderer.setAnimationLoop(null);
      if (!box) {
        box = document.createElement('div');
        box.id = 'gl-lost';
        box.setAttribute('role', 'alert');
        box.innerHTML = `<p class="t">The temple paused</p>
          <p>Your browser reclaimed the graphics memory (this happens on phones when memory runs low).</p>
          <button type="button" class="gold">Reload the temple</button>
          <p class="small">It may also come back by itself in a moment.</p>`;
        box.querySelector('button')!.addEventListener('click', () => location.reload());
        document.body.append(box);
      }
      box.classList.add('on');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      box?.classList.remove('on');
      this.resize();
      if (this.running) this.renderer.setAnimationLoop((ts) => this.frame(ts));
    });
  }

  private buildLights() {
    this.sun = new THREE.DirectionalLight(this.site.sunColor ?? 0xffd6a8, this.site.sunIntensity ?? 3.2);
    this.setSun(new THREE.Vector3(Math.sin(this.sunAzimuth), 0.2, Math.cos(this.sunAzimuth)).normalize());
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.profile.shadowMap, this.profile.shadowMap);
    const c = this.sun.shadow.camera;
    c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 1; c.far = 300;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    const fog = this.site.fog === undefined ? { color: 0xcdb8a4, near: 120, far: 900 } : this.site.fog;
    this.scene.fog = fog ? new THREE.Fog(fog.color, fog.near, fog.far) : null;
  }

  private setSun(dir: THREE.Vector3) {
    this.sun.position.copy(dir).multiplyScalar(120);
    this.built?.setSun?.(dir);
  }

  /**
   * Metals and polished stone in the underground sanctum should mirror lamplight and
   * dark walls, not the open sky. Give them their own small warm environment.
   */
  private lampLitInterior(M: Materials): THREE.Texture {
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x120a06);
    const glow = (c: number, x: number, y: number, z: number, r: number) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: c }));
      s.position.set(x, y, z);
      room.add(s);
    };
    glow(0xffa24a, -3, 0, -2, 0.7);
    glow(0xffa24a, 3, 0, -2, 0.7);
    glow(0xffc27a, 0, 3, 2, 1.2);
    glow(0x5a2a14, 0, -4, 0, 4);
    const env = new THREE.PMREMGenerator(this.renderer).fromScene(room, 0.04).texture;
    for (const m of [M.silver, M.oldSilver, M.brass, M.lingam, M.marble]) {
      (m as THREE.MeshStandardMaterial).envMap = env;
      (m as THREE.MeshStandardMaterial).envMapIntensity = 1.6;
    }
    return env;
  }

  /** Real photographed sky: background + image-based light, rotated so its sun sits where we want it. */
  private async loadSky() {
    // (phones: half floats, which iOS can filter, at half the memory)
    const half = this.profile.halfFloatSky;
    const hdr = await new HDRLoader().setDataType(half ? THREE.HalfFloatType : THREE.FloatType).loadAsync(this.site.hdri ?? HDRI);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    // find the sun: brightest texel of the equirectangular image
    const { data, width, height } = hdr.image as { data: Float32Array | Uint16Array; width: number; height: number };
    const at = half ? (i: number) => THREE.DataUtils.fromHalfFloat(data[i]) : (i: number) => data[i];
    let best = 0, bi = 0;
    for (let i = 0; i < width * height; i++) {
      const l = at(i * 4) * 0.2126 + at(i * 4 + 1) * 0.7152 + at(i * 4 + 2) * 0.0722;
      if (l > best) { best = l; bi = i; }
    }
    const u = ((bi % width) + 0.5) / width;
    const v = 1 - (Math.floor(bi / width) + 0.5) / height;
    const lon = (u - 0.5) * Math.PI * 2, lat = (v - 0.5) * Math.PI;
    const hdrSun = new THREE.Vector3(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
    const az = this.sunAzimuth;
    const theta = az - Math.atan2(hdrSun.x, hdrSun.z);
    this.scene.background = hdr;
    this.scene.environment = hdr;
    this.scene.backgroundRotation.set(0, theta, 0);
    this.scene.environmentRotation.set(0, theta, 0);
    this.scene.environmentIntensity = 1.0;
    // late-afternoon raking light: at least ~16° up so the courtyard walls don't swallow the scene
    const el = Math.max(lat, THREE.MathUtils.degToRad(this.site.sunElevationMin ?? 28));
    this.setSun(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)));
  }

  /** Photoscanned neem-like trees (Poly Haven tree_small_02, decimated), one clone per spot. */
  /**
   * Photoscanned neem-like trees (Poly Haven tree_small_02, decimated), one LOD per spot:
   * the full model within ~28 m, a ~8× lighter one beyond (it is drawn in every pass —
   * shadow, reflection, AO — so distant full-detail trees were the biggest cost).
   */
  private async loadTrees() {
    if (!this.site.trees?.length) return;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const [hi, lo] = await Promise.all([
      loader.loadAsync('assets/models/neem.glb'),
      loader.loadAsync('assets/models/neem_lod.glb'),
    ]);
    const prep = (src: THREE.Object3D, shadows: boolean) => {
      src.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = shadows;
          m.receiveShadow = true;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; }
        }
      });
      return src;
    };
    const hiSrc = prep(hi.scene, true), loSrc = prep(lo.scene, true);
    const box = new THREE.Box3().setFromObject(hiSrc);
    const h = box.max.y - box.min.y;
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, z, height] of this.site.trees) {
      const lod = new THREE.LOD();
      lod.addLevel(hiSrc.clone(), 0);
      lod.addLevel(loSrc.clone(), 18);
      lod.scale.setScalar(height / h);
      lod.position.set(x, -box.min.y * (height / h), z);
      lod.rotation.y = rnd() * Math.PI * 2;
      this.root.add(lod);
    }
  }

  private buildFlames() {
    const pts = this.flames.points;
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(pts.length).map(() => Math.random() * 20), 1));
    this.flameMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, scale: { value: 800 } },
      vertexShader: FlameShader.vertex,
      fragmentShader: FlameShader.fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Points(g, this.flameMat));
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private placeCamera() {
    this.camera.position.set(this.feet.x, this.feet.y + EYE + Math.sin(this.bob) * 0.03, this.feet.z);
  }

  /** The site's named story points (BuiltSite.stops), if it exports any. */
  get siteStops(): NonNullable<BuiltSite['stops']> {
    return this.built.stops ?? {};
  }

  /** The site's guide paths (BuiltSite.guidePaths), if any. */
  get guidePaths(): NonNullable<BuiltSite['guidePaths']> {
    return this.built.guidePaths ?? [];
  }

  /** The site's walking graph and its named places (BuiltSite.nav / places; engine/travel.ts). */
  get nav(): BuiltSite['nav'] {
    return this.built.nav;
  }
  get places(): NonNullable<BuiltSite['places']> {
    return this.built.places ?? [];
  }

  /**
   * Could the pilgrim walk in a straight line from feet position a to (bx, bz), arriving within 0.8 m of
   * height by? Stepped every 0.2 m with the real collision and floors (no falls of more than a stair's step).
   */
  walkable(a: [number, number, number], b: [number, number, number]): boolean {
    let x = a[0], z = a[2];
    let y = this.floorAt(x, z, a[1] + 0.3);
    if (y === null) return false;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - x, b[2] - z) / 0.2));
    const dx = (b[0] - x) / n, dz = (b[2] - z) / n;
    for (let i = 0; i < n; i++) {
      x += dx; z += dz;
      if (this.blocked(x, z, y)) return false;
      const f = this.floorAt(x, z, y);
      if (f === null || f < y - 0.8) return false;
      y = f;
    }
    return Math.abs(y - b[1]) < 0.8;
  }

  /** one auto-walk move, in steps of ≤ 0.2 m (fast enough to tunnel through a rail otherwise), on the floor */
  private autoMove(dx: number, dz: number, dt: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    for (let i = 0; i < n; i++) {
      const nx = this.feet.x + dx / n;
      if (!this.blockedMove(nx, this.feet.z)) this.feet.x = nx;
      const nz = this.feet.z + dz / n;
      if (!this.blockedMove(this.feet.x, nz)) this.feet.z = nz;
      if (this.air) continue;
      // at speed, follow stairs and ramps at once (up within a step, down within a fall of < 1 m)
      const f = this.floorAt(this.feet.x, this.feet.z, this.feet.y);
      if (f !== null && f > this.feet.y - 1) { this.feet.y = f; this.vy = 0; }
    }
    this.bob += dt * 11;
  }

  /** Add an overlay object (markers...) to the scene outside the site's root. */
  add(o: THREE.Object3D) {
    this.scene.add(o);
  }

  /** Walkable floor height under (x, z) reachable from about `fromY` (null if none). */
  groundAt(x: number, z: number, fromY: number): number | null {
    return this.floorAt(x, z, fromY);
  }

  /** Highest walkable surface under (x, z) that can be reached from `fromY`. */
  private floorAt(x: number, z: number, fromY: number): number | null {
    this.ray.set(new THREE.Vector3(x, fromY + CLIMB + 0.05, z), new THREE.Vector3(0, -1, 0));
    this.ray.far = 60;
    const hit = this.ray.intersectObjects(this.phys.floors, false)[0];
    return hit ? hit.point.y : null;
  }

  private blocked(x: number, z: number, feetY: number): boolean {
    const lo = feetY + 0.35, hi = feetY + 1.75;
    const f = this.floorAt(x, z, feetY);
    for (const b of this.phys.solids) {
      if (b.max.y <= lo || b.min.y >= hi) continue;
      // a solid whose top is a walkable step we are climbing onto (within CLIMB) is not a wall
      if (f !== null && b.max.y <= feetY + CLIMB && b.max.y <= f + 0.06) continue;
      const cx = Math.max(b.min.x, Math.min(x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(z, b.max.z));
      if ((cx - x) ** 2 + (cz - z) ** 2 < RADIUS * RADIUS) return true;
    }
    return f !== null && f > feetY + CLIMB;
  }

  /** Space while walking: jump (never scrolls the page or presses a focused button; typing is left alone) */
  private onSpace(e: KeyboardEvent) {
    if (!this.controls.isLocked && !this.autopilot) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    // a button left focused by a click: drop its focus instead of pressing it (the next Space jumps)
    if (t && t !== document.body && t.closest?.('button, a, [role="button"]')) { t.blur(); return; }
    if (!e.repeat) this.jump();
  }

  /** Jump, if standing on the ground (on stairs and ramps too) and not passing through a doorway. */
  jump(): boolean {
    if (this.air || this.passing) return false;
    const f = this.floorAt(this.feet.x, this.feet.z, this.feet.y);
    if (f === null || Math.abs(this.feet.y - f) > 0.15) return false;
    this.air = { ground: f, ceil: this.ceilingsNear(f) };
    this.feet.y = Math.max(this.feet.y, f);
    this.vy = JUMP_V;
    return true;
  }

  /**
   * What the head could meet during a jump from `ground`, gathered once at take-off: the triangles of every
   * mesh (instanced ones per instance) in the band from just under the head to above it at the apex, within
   * a few metres, in world space and bucketed on a 1 m grid. Merged scenery meshes are huge, so raycasting
   * them every frame is far too slow; a vertical test against the few triangles in one cell is not.
   */
  private ceilingsNear(ground: number): Ceiling {
    const { x, z } = this.feet, reach = 5;
    const zone = new THREE.Box3(new THREE.Vector3(x - reach, ground + HEAD - 0.2, z - reach), new THREE.Vector3(x + reach, ground + HEAD + 1.4, z + reach));
    const box = new THREE.Box3(), local = new THREE.Box3(), inv = new THREE.Matrix4(), mw = new THREE.Matrix4(), im = new THREE.Matrix4();
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const tris: number[] = [];
    const cells = new Map<number, number[]>();
    const low = new Map<number, number>();
    const add = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => {
      const pos = geo.attributes.position;
      if (!pos) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!box.copy(geo.boundingBox!).applyMatrix4(m).intersectsBox(zone)) return;
      local.copy(zone).applyMatrix4(inv.copy(m).invert());
      const { min, max } = local, idx = geo.index?.array, n = idx ? idx.length : pos.count;
      const cb = chunkBoxes(geo);
      for (let c = 0; c < cb.length; c += 6) {
        // skip whole runs of triangles whose box misses the zone (merged meshes are mostly far away)
        if (cb[c + 3] < min.x || cb[c] > max.x || cb[c + 4] < min.y || cb[c + 1] > max.y || cb[c + 5] < min.z || cb[c + 2] > max.z) continue;
        const end = Math.min(n, (c / 6 + 1) * CHUNK * 3);
        for (let t = (c / 6) * CHUNK * 3; t + 2 < end; t += 3) {
          for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx[t + k] : t + k);
          if (Math.max(v[0].x, v[1].x, v[2].x) < min.x || Math.min(v[0].x, v[1].x, v[2].x) > max.x) continue;
          if (Math.max(v[0].y, v[1].y, v[2].y) < min.y || Math.min(v[0].y, v[1].y, v[2].y) > max.y) continue;
          if (Math.max(v[0].z, v[1].z, v[2].z) < min.z || Math.min(v[0].z, v[1].z, v[2].z) > max.z) continue;
          for (const p of v) p.applyMatrix4(m);
          keep();
        }
      }
    };
    /** file the world-space triangle in v */
    const keep = () => {
      const lx = Math.min(v[0].x, v[1].x, v[2].x), hx = Math.max(v[0].x, v[1].x, v[2].x);
      const lz = Math.min(v[0].z, v[1].z, v[2].z), hz = Math.max(v[0].z, v[1].z, v[2].z);
      if (hx - lx < FINE && hz - lz < FINE) {
        // small triangles (carving, lamps, dense scans): just the lowest point over each fine cell they touch
        const ly = Math.min(v[0].y, v[1].y, v[2].y);
        for (let cx = Math.floor(lx / FINE); cx <= Math.floor(hx / FINE); cx++) {
          for (let cz = Math.floor(lz / FINE); cz <= Math.floor(hz / FINE); cz++) {
            const key = cell(cx, cz), old = low.get(key);
            if (old === undefined || ly < old) low.set(key, ly);
          }
        }
        return;
      }
      const id = tris.length;
      tris.push(v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z);
      const cx0 = Math.floor(lx), cx1 = Math.floor(hx), cz0 = Math.floor(lz), cz1 = Math.floor(hz);
      for (let cx = Math.max(cx0, Math.floor(x) - reach); cx <= Math.min(cx1, Math.floor(x) + reach); cx++) {
        for (let cz = Math.max(cz0, Math.floor(z) - reach); cz <= Math.min(cz1, Math.floor(z) + reach); cz++) {
          const key = cell(cx, cz);
          let list = cells.get(key);
          if (!list) cells.set(key, (list = []));
          list.push(id);
        }
      }
    };
    this.root.updateMatrixWorld();
    this.root.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      // the crowd (batched / skinned figures) is not a ceiling
      if (!m.isMesh || (m as unknown as THREE.BatchedMesh).isBatchedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
      const inst = m as unknown as THREE.InstancedMesh;
      if (!inst.isInstancedMesh) return add(m.geometry, m.matrixWorld);
      if (!inst.boundingBox) inst.computeBoundingBox();
      if (!inst.boundingBox || !box.copy(inst.boundingBox).applyMatrix4(m.matrixWorld).intersectsBox(zone)) return;
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, im);
        add(inst.geometry, mw.multiplyMatrices(m.matrixWorld, im));
      }
    });
    return { tris: new Float32Array(tris), cells, low };
  }

  /** highest the feet may rise at (x, z) before the head meets something above it (Infinity if clear) */
  private headroom(): number {
    const { x, y, z } = this.feet;
    let top = Infinity;
    for (const b of this.phys.solids) {
      if (b.min.y < y + HEAD - 0.05) continue;
      const cx = Math.max(b.min.x, Math.min(x, b.max.x)), cz = Math.max(b.min.z, Math.min(z, b.max.z));
      if ((cx - x) ** 2 + (cz - z) ** 2 < RADIUS * RADIUS) top = Math.min(top, b.min.y - HEAD);
    }
    const c = this.air?.ceil;
    if (!c) return top;
    const T = c.tris, from = y + 1.2;
    // the centre and four points around the head: the lowest surface above any of them
    for (const [px, pz] of [[x, z], [x + 0.2, z], [x - 0.2, z], [x, z + 0.2], [x, z - 0.2]]) {
      const ly = c.low.get(cell(Math.floor(px / FINE), Math.floor(pz / FINE)));
      if (ly !== undefined && ly > from && ly - HEAD < top) top = ly - HEAD;
      for (const t of c.cells.get(cell(Math.floor(px), Math.floor(pz))) ?? []) {
        // vertical line through (px, pz) against the triangle, in the xz plane (barycentric)
        const ax = T[t], ay = T[t + 1], az = T[t + 2], bx = T[t + 3] - ax, by = T[t + 4] - ay, bz = T[t + 5] - az;
        const cx = T[t + 6] - ax, cy = T[t + 7] - ay, cz = T[t + 8] - az, qx = px - ax, qz = pz - az;
        const d = bx * cz - bz * cx;
        if (Math.abs(d) < 1e-9) continue; // edge-on (a wall): not overhead
        const u = (qx * cz - qz * cx) / d, w = (bx * qz - bz * qx) / d;
        if (u < 0 || w < 0 || u + w > 1) continue;
        const hy = ay + u * by + w * cy;
        if (hy > from && hy - HEAD < top) top = hy - HEAD;
      }
    }
    return top;
  }

  /** a wall in the way at (x, z): mid-jump, from the floor below as well as from the raised feet */
  private blockedMove(x: number, z: number): boolean {
    if (this.air && this.blocked(x, z, this.air.ground)) return true;
    return this.blocked(x, z, this.feet.y);
  }

  private step(dt: number) {
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    // ← / → turn the view (keyboard-only walking); while you walk or turn with the keys and the mouse is
    // still, the view eases back to level, so it settles on a straight-ahead front view by itself
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    // the touch joystick, when no move key is held
    const st = this.stick, stick = !fwd && !side && st.mag > 0;
    // the joystick steers: left / right turns the view, up / down walks
    const steer = stick ? stickSteer(st) : { turn: 0, fwd: 0 };
    if (turn || fwd || side || stick) {
      this.look.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.look.y += (turn * TURN + steer.turn * STICK_TURN) * dt;
      if (performance.now() - this.mouseAt > LEVEL_AFTER_MS) this.look.x *= Math.exp(-dt * LEVEL_RATE);
      this.camera.quaternion.setFromEuler(this.look);
    }
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN : WALK;
    const auto = fwd || side || stick ? null : this.drive?.(dt) ?? null;
    if (auto) this.autoMove(auto.x, auto.z, dt);
    const walking = fwd || side || (stick && steer.fwd !== 0);
    if (walking) {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      const v = stick ? stickSpeed(Math.abs(steer.fwd)) : speed;
      const move = stick
        ? dir.multiplyScalar(Math.sign(steer.fwd) * v * dt)
        : dir.multiplyScalar(fwd).add(right.multiplyScalar(side)).normalize().multiplyScalar(speed * dt);
      const nx = this.feet.x + move.x;
      if (!this.blockedMove(nx, this.feet.z)) this.feet.x = nx;
      const nz = this.feet.z + move.z;
      if (!this.blockedMove(this.feet.x, nz)) this.feet.z = nz;
      this.bob += dt * (v >= RUN ? 13 : 8.5 * Math.min(1, v / WALK));
    }
    // mid-jump: rise and fall under JUMP_G, stopped by anything overhead, landing on the floor below
    if (this.air) {
      const a = this.air;
      const g = this.floorAt(this.feet.x, this.feet.z, a.ground);
      if (g !== null) a.ground = g;
      this.vy -= JUMP_G * dt;
      let y = this.feet.y + this.vy * dt;
      if (this.vy > 0) {
        const top = this.headroom();
        if (y > top) { y = Math.max(a.ground, top); this.vy = 0; }
      }
      if (y <= a.ground) { y = a.ground; this.vy = 0; this.air = null; }
      this.feet.y = y;
    } else {
      // settle onto the floor: step up instantly, fall with gravity
      const f = this.floorAt(this.feet.x, this.feet.z, this.feet.y);
      if (f !== null && f >= this.feet.y - 0.02) {
        this.feet.y = THREE.MathUtils.lerp(this.feet.y, f, Math.min(1, dt * 18));
        this.vy = 0;
      } else if (f !== null) {
        this.vy -= 9.8 * dt;
        this.feet.y = Math.max(f, this.feet.y + this.vy * dt);
        if (this.feet.y === f) this.vy = 0;
      }
    }
    this.placeCamera();
    this.updateZone();
    this.updatePortal();
  }

  private updatePortal() {
    const f = this.feet;
    const p = this.built.portals?.find((q) => Math.hypot(f.x - q.at[0], f.z - q.at[2]) < q.radius && Math.abs(f.y - q.at[1]) < 2) ?? null;
    if (p === this.portal) return;
    this.portal = p;
    if (p) this.portalEl.innerHTML = `<kbd>E</kbd> <span lang="hi">${p.label.hi}</span> · ${p.label.en}`;
    this.portalEl.classList.toggle('on', !!p);
    document.body.classList.toggle('portal-on', !!p);
  }

  /** open the doorway you stand at and pass through it, behind a short fade */
  private usePortal() {
    const p = this.portal;
    if (!p || this.passing) return;
    this.passing = true;
    p.use?.();
    this.portalEl.classList.remove('on');
    document.body.classList.remove('portal-on');
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      this.pose(...p.to.feet, ...p.to.look);
      this.vy = 0;
      this.air = null;
      this.updateZone();
      this.portal = null;
      this.fadeEl.classList.remove('on');
      this.passing = false;
    }, 650);
  }

  private updateZone() {
    const zone = this.built.zoneAt?.(this.feet) ?? 'courtyard';
    if (zone !== this.zone) {
      this.zone = zone;
      this.built.onZoneChange?.(zone);
      this.onZone(zone);
    }
  }

  /** First frame position and view, as the site defines it. */
  reset() {
    this.feet.set(...this.built.spawn.feet);
    this.vy = 0;
    this.air = null;
    this.placeCamera();
    this.camera.lookAt(...this.built.spawn.look);
  }

  /** Dev helper: stand at feet position (x,y,z) looking at (lx,ly,lz). */
  pose(x: number, y: number, z: number, lx: number, ly: number, lz: number) {
    this.feet.set(x, y, z);
    this.air = null;
    this.placeCamera();
    this.camera.lookAt(lx, ly, lz);
  }

  start() {
    this.canvas.classList.add('on');
    this.resize();
    this.running = true;
    this.clock.reset();
    this.renderer.setAnimationLoop((ts) => this.frame(ts));
  }

  stop() {
    this.running = false;
    this.controls.unlock();
    this.renderer.setAnimationLoop(null);
    this.canvas.classList.remove('on');
  }

  private frame(ts: number) {
    if (!this.running) return;
    this.clock.update(ts);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsed();
    if (this.controls.isLocked || this.autopilot) this.step(dt);
    this.built.update?.(t);
    for (const h of this.frameHooks) h(dt, t);
    this.flameMat.uniforms.time.value = t;
    this.flameMat.uniforms.scale.value = innerHeight * 0.9;
    this.grade.uniforms.time.value = t;
    for (const [l, base] of this.lightBase) {
      l.intensity = base * (0.86 + 0.1 * Math.sin(t * 11 + base) + 0.05 * Math.sin(t * 27 + base * 3));
    }
    this.frameNo++;
    const every = this.profile.shadowEvery;
    if (every > 1 && this.frameNo % every === 0) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
    this.adaptResolution(dt);
  }

  /** switch a running 'mobile' world to the 'low' profile (what can change without a rebuild) */
  private downgrade() {
    const low = profileFor('low', window.devicePixelRatio || 1);
    this.profile = { ...low, msaa: this.profile.msaa, shadowMap: this.profile.shadowMap };
    setQuality(this.profile);
    this.maxPixelRatio = low.maxPixelRatio;
    this.pixelRatio = Math.min(this.pixelRatio, low.minPixelRatio + 0.25);
    this.perf.slow = 0;
    if (this.ao) this.ao.enabled = false;
    console.info('[quality] slow frames on this device: switched to the low profile');
    this.resize();
  }

  /**
   * Keep walking smooth on slower GPUs: if the frame rate sits below ~48 fps, drop the render
   * resolution a notch (down to 1×); when it has headroom again, step back up to full sharpness.
   */
  private adaptResolution(dt: number) {
    if (dt >= 0.05) return; // a hitch or a hidden tab, not a measure of steady speed
    const p = this.perf;
    p.frames++; p.time += dt;
    if (p.time < 1.5) return;
    const fps = p.frames / p.time;
    this.fps = fps;
    p.frames = 0; p.time = 0;
    const floor = this.profile.minPixelRatio;
    if (fps < 48 && this.pixelRatio > floor) {
      this.pixelRatio = Math.max(floor, this.pixelRatio - 0.25);
      p.good = 0;
      this.resize();
    } else if (this.profile.tier === 'mobile' && fps < 28 && ++p.slow >= 2) {
      // fps probe: a phone still slow at its lowest resolution drops to the 'low' profile
      this.downgrade();
    } else if (fps > 57 && this.pixelRatio < this.maxPixelRatio && ++p.good >= 3) {
      this.pixelRatio = Math.min(this.maxPixelRatio, this.pixelRatio + 0.25);
      p.good = 0;
      this.resize();
    }
  }
}

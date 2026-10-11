import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export interface Target {
  lon: number;
  lat: number;
}

/** A camera keyframe: where the camera is and where it looks. */
interface Key {
  lon: number;
  lat: number;
  height: number;
  heading: number; // degrees, clockwise from north
  pitch: number; // degrees, negative = looking down
  t: number; // seconds from start
}

// Diwali evening 2026 over central India: sun low in the west.
const GOLDEN_HOUR = Cesium.JulianDate.fromIso8601('2026-11-08T11:35:00Z');

const GRADE_SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform float time;
uniform float warmth;
in vec2 v_textureCoordinates;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 c = texture(colorTexture, v_textureCoordinates).rgb;
  // gentle filmic S-curve
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
  // warm highlights, cool-violet shadows
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 hi = c * vec3(1.08, 0.98, 0.84);
  vec3 lo = c + vec3(0.015, 0.0, 0.035) * (1.0 - l);
  c = mix(lo, hi, smoothstep(0.0, 0.8, l) * warmth);
  // vignette
  vec2 uv = v_textureCoordinates - 0.5;
  c *= 1.0 - dot(uv, uv) * 0.85;
  // grain
  c += (rand(v_textureCoordinates * vec2(1733.0, 977.0) + fract(time)) - 0.5) * 0.03;
  out_FragColor = vec4(c, 1.0);
}`;

export class CinematicGlobe {
  readonly viewer: Cesium.Viewer;
  private dof: Cesium.PostProcessStageComposite;
  private flare: Cesium.PostProcessStage;
  private flight: Cesium.Event.RemoveCallback | null = null;

  constructor(container: HTMLElement, token?: string) {
    if (token) Cesium.Ion.defaultAccessToken = token;

    this.viewer = new Cesium.Viewer(container, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false,
      infoBox: false, selectionIndicator: false, msaaSamples: 4,
      ...(token
        ? { terrain: Cesium.Terrain.fromWorldTerrain(), baseLayer: Cesium.ImageryLayer.fromWorldImagery({}) }
        : {
            terrain: new Cesium.Terrain(Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
              'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer')),
            baseLayer: new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
              url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
              maximumLevel: 15,
              credit: 'Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)',
            })),
          }),
    });

    const { scene, clock } = this.viewer;
    clock.currentTime = GOLDEN_HOUR.clone();
    clock.shouldAnimate = false;

    scene.highDynamicRange = true;
    scene.globe.enableLighting = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.globe.dynamicAtmosphereLightingFromSun = true;
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.maximumScreenSpaceError = 1.5; // sharper terrain for close shots
    scene.fog.enabled = true;
    scene.fog.density = 2.2e-4;
    scene.fog.minimumBrightness = 0.08;
    scene.atmosphere.saturationShift = 0.08;
    scene.atmosphere.brightnessShift = 0.04;
    scene.light = new Cesium.SunLight({ intensity: 2.4, color: Cesium.Color.fromCssColorString('#ffd9a0') });
    if (scene.skyAtmosphere) scene.skyAtmosphere.saturationShift = 0.1;
    if (scene.sun) scene.sun.glowFactor = 2.5;
    scene.screenSpaceCameraController.enableInputs = false;

    const stages = scene.postProcessStages;
    stages.bloom.enabled = true;
    stages.bloom.uniforms.contrast = 119;
    stages.bloom.uniforms.brightness = -0.35;
    stages.bloom.uniforms.sigma = 3.2;
    stages.bloom.uniforms.delta = 1.0;
    stages.bloom.uniforms.stepSize = 1.2;

    this.flare = Cesium.PostProcessStageLibrary.createLensFlareStage();
    stages.add(this.flare);
    this.flare.uniforms.intensity = 1.6;
    this.flare.uniforms.distortion = 12;
    this.flare.uniforms.ghostDispersal = 0.4;
    this.flare.uniforms.haloWidth = 0.4;
    this.flare.uniforms.earthRadius = Cesium.Ellipsoid.WGS84.maximumRadius;

    this.dof = Cesium.PostProcessStageLibrary.createDepthOfFieldStage();
    stages.add(this.dof);
    this.dof.enabled = false;
    this.dof.uniforms.delta = 1;
    this.dof.uniforms.sigma = 2.5;
    this.dof.uniforms.stepSize = 1.6;

    stages.add(new Cesium.PostProcessStage({
      fragmentShader: GRADE_SHADER,
      uniforms: { time: () => performance.now() / 1000, warmth: 0.85 },
    }));

    this.setPose({ lon: 48, lat: -8, height: 2.1e7, heading: 28, pitch: -88, t: 0 });
  }

  private setPose(k: Key) {
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(k.lon, k.lat, k.height),
      orientation: { heading: Cesium.Math.toRadians(k.heading), pitch: Cesium.Math.toRadians(k.pitch), roll: 0 },
    });
  }

  /** Camera pose looking at a ground target from `range` metres away. */
  private orbit(target: Target, groundH: number, heading: number, pitch: number, range: number, t: number): Key {
    const center = Cesium.Cartesian3.fromDegrees(target.lon, target.lat, groundH);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const h = Cesium.Math.toRadians(heading), p = Cesium.Math.toRadians(pitch);
    const dir = new Cesium.Cartesian3(Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p));
    const local = Cesium.Cartesian3.multiplyByScalar(dir, -range, new Cesium.Cartesian3());
    const world = Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
    const c = Cesium.Cartographic.fromCartesian(world);
    return { lon: Cesium.Math.toDegrees(c.longitude), lat: Cesium.Math.toDegrees(c.latitude), height: c.height, heading, pitch, t };
  }

  async groundHeight(target: Target): Promise<number> {
    try {
      const [p] = await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider,
        [Cesium.Cartographic.fromDegrees(target.lon, target.lat)]);
      return p.height ?? 0;
    } catch {
      return 0;
    }
  }

  /** Screen position of a ground point, for HTML overlays. */
  toScreen(target: Target, groundH: number): { x: number; y: number } | null {
    const p = Cesium.SceneTransforms.worldToWindowCoordinates(this.viewer.scene,
      Cesium.Cartesian3.fromDegrees(target.lon, target.lat, groundH + 40));
    return p ? { x: p.x, y: p.y } : null;
  }

  onFrame(cb: () => void): () => void {
    return this.viewer.scene.postRender.addEventListener(cb);
  }

  /**
   * The choreographed descent: space -> India -> Deccan -> Malwa -> Ujjain -> temple.
   * `onBeat(i)` fires as each keyframe is reached, for captions.
   */
  async fly(target: Target, onBeat: (i: number) => void): Promise<void> {
    const g = await this.groundHeight(target);
    const keys: Key[] = [
      { lon: 48, lat: -8, height: 2.1e7, heading: 28, pitch: -88, t: 0 },
      { lon: 70, lat: 6, height: 7.5e6, heading: 18, pitch: -80, t: 7 },
      { lon: target.lon - 1.2, lat: target.lat - 6.7, height: 1.1e6, heading: 8, pitch: -55, t: 15 },
      this.orbit(target, g, 20, -24, 70_000, 24),
      this.orbit(target, g, 8, -22, 9_000, 31),
      this.orbit(target, g, -4, -17, 1_900, 37),
      this.orbit(target, g, -10, -14, 850, 42),
    ];
    this.cancel();
    this.setPose(keys[0]);

    return new Promise((resolve) => {
      const start = performance.now();
      const total = keys[keys.length - 1].t;
      let beat = 0;
      onBeat(0);
      this.flight = this.viewer.scene.preRender.addEventListener(() => {
        const raw = Math.min((performance.now() - start) / 1000, total);
        const s = smooth(raw / total) * total; // eased timeline shared by camera and captions
        while (beat + 1 < keys.length && s >= keys[beat + 1].t) onBeat(++beat);
        const pose = sample(keys, s, g);
        this.setPose(pose);
        const agl = pose.height - g;
        const low = Math.max(0, 1 - agl / 12_000);
        this.dof.enabled = low > 0.05;
        this.dof.uniforms.focalDistance = Math.max(300, agl * 1.6);
        this.flare.uniforms.intensity = 1.6 * (1 - low * 0.7);
        if (raw >= total) {
          this.cancel();
          resolve();
        }
      });
    });
  }

  cancel() {
    this.flight?.();
    this.flight = null;
  }

  setVisible(v: boolean) {
    this.viewer.useDefaultRenderLoop = v;
    (this.viewer.container as HTMLElement).style.visibility = v ? 'visible' : 'hidden';
  }
}

// ---------- interpolation ----------

const smooth = (x: number) => x * x * (3 - 2 * x);

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/**
 * Catmull-Rom through all keyframes; height interpolated in log space so the
 * descent from orbit feels constant-speed to the eye. The caller eases `s`
 * globally so the start and landing are soft without stopping at keys.
 */
function sample(keys: Key[], s: number, ground: number): Key {
  let i = 0;
  while (i < keys.length - 2 && s > keys[i + 1].t) i++;
  const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, keys.length - 1)];
  const u = (s - k1.t) / (k2.t - k1.t);
  const f = (sel: (k: Key) => number) => catmull(sel(k0), sel(k1), sel(k2), sel(k3), u);
  const logH = f((k) => Math.log(Math.max(k.height - ground, 50)));
  return {
    lon: f((k) => k.lon),
    lat: f((k) => k.lat),
    height: ground + Math.max(Math.exp(logH), 120),
    heading: f((k) => k.heading),
    pitch: f((k) => k.pitch),
    t: s,
  };
}

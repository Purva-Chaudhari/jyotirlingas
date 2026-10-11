import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Story-stop markers: at each stop a glowing lotus drawn on the floor, a small diya flame floating above it
 * and a faint pillar of light, so the stop can be found from ~15 m without looking like a game pickup.
 * All markers of a temple are one InstancedMesh (one draw call); the three parts share one shader.
 */

const PILLAR_H = 2.6;

const vertex = /* glsl */ `
  attribute float part;
  uniform float time;
  uniform float motion;
  varying vec2 vUv;
  varying float vPart;
  varying float vFade;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    vUv = uv;
    vPart = part;
    vColor = instanceColor;
    vec4 centre = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float seed = centre.x * 0.37 + centre.z * 0.71;
    vPulse = 1.0 + motion * 0.18 * sin(time * 1.4 + seed);
    float d = distance(cameraPosition, centre.xyz);
    // clearly visible within ~16 m, gone by 26 m; the pillar thins out when you stand in it
    vFade = 1.0 - smoothstep(16.0, 26.0, d);
    vec4 world;
    if (part > 1.5) {
      // the flame: a camera-facing card floating over the lotus
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up = vec3(0.0, 1.0, 0.0);
      float bob = motion * 0.04 * sin(time * 1.1 + seed);
      world = vec4(centre.xyz + vec3(0.0, 1.05 + bob, 0.0) + right * position.x + up * position.y, 1.0);
    } else {
      world = modelMatrix * instanceMatrix * vec4(position, 1.0);
      if (part < 0.5) vFade *= smoothstep(0.6, 2.2, d);
    }
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const fragment = /* glsl */ `
  uniform float time;
  uniform float motion;
  varying vec2 vUv;
  varying float vPart;
  varying float vFade;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    float a;
    vec3 c = vColor;
    if (vPart < 0.5) {
      // pillar: brightest at the floor, fading upward, soft at both ends
      float y = vUv.y;
      a = pow(1.0 - y, 1.6) * smoothstep(0.0, 0.05, y) * 0.46;
      c = mix(c, vec3(1.0, 0.8, 0.45), y * 0.6);
    } else if (vPart < 1.5) {
      // lotus: eight petals and a ring, drawn on the floor
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);
      float ang = atan(p.y, p.x + 1e-4); // (atan(0, 0) is undefined: NaN would bloom over the whole frame)
      float petal = 0.52 + 0.38 * pow(abs(cos(ang * 4.0)), 0.7);
      float inner = 0.30 + 0.16 * pow(abs(cos(ang * 4.0 + 0.785)), 0.7);
      float outline = smoothstep(0.06, 0.0, abs(r - petal)) + 0.7 * smoothstep(0.05, 0.0, abs(r - inner));
      float ring = smoothstep(0.04, 0.0, abs(r - 0.96)) * 0.6;
      float fill = smoothstep(petal, petal - 0.25, r) * 0.18 + smoothstep(0.16, 0.0, r) * 0.9;
      a = (outline + ring + fill) * 0.8;
    } else {
      // diya flame
      vec2 p = vUv - vec2(0.5, 0.38);
      p.x *= 2.3;
      p.y *= p.y < 0.0 ? 1.0 : 0.62;
      float d = length(p);
      float core = smoothstep(0.2, 0.0, d);
      float glow = smoothstep(0.5, 0.0, d);
      c = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.93, 0.72), core);
      a = glow * 0.75 + core;
      c *= 1.0 + 0.12 * motion * sin(time * 9.0 + vUv.y * 4.0);
    }
    a = clamp(a * vFade * vPulse, 0.0, 2.0);
    if (!(a > 0.004)) discard;
    // 'over' blending so it reads on sunlit paving; HDR colour so it still glows (blooms) in dark sanctums
    gl_FragColor = vec4(c * (vPart > 1.5 ? 3.0 : 1.35), min(a, 0.9));
  }`;

function geometry() {
  const tag = (g: THREE.BufferGeometry, part: number) => {
    g.setAttribute('part', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(part), 1));
    return g;
  };
  const pillar = new THREE.CylinderGeometry(0.42, 0.42, PILLAR_H, 20, 1, true).translate(0, PILLAR_H / 2 + 0.02, 0);
  const lotus = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2).translate(0, 0.025, 0);
  const flame = new THREE.PlaneGeometry(0.16, 0.26).translate(0, 0.05, 0);
  return mergeGeometries([tag(pillar, 0), tag(lotus, 1), tag(flame, 2)]);
}

const GOLD = new THREE.Color(1.0, 0.55, 0.12);
const DONE = new THREE.Color(0.55, 0.42, 0.3);

export class StoryMarkers {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.ShaderMaterial;
  private n: number;
  private reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  /** positions are floor points; `done[i]` dims a marker whose story was already heard/read */
  constructor(positions: THREE.Vector3[]) {
    this.n = positions.length;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, motion: { value: 1 } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geometry(), this.mat, Math.max(1, this.n));
    this.mesh.count = this.n;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'story-markers';
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      this.mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      this.mesh.setColorAt(i, GOLD);
    });
    // the ambient-occlusion pass re-draws the scene with a normals material: markers must not take part
    const n = this.n;
    this.mesh.onBeforeRender = function (_r, scene) {
      (this as THREE.InstancedMesh).count = scene.overrideMaterial ? 0 : n;
    };
  }

  setDone(i: number, done: boolean) {
    if (i < 0 || i >= this.n) return;
    this.mesh.setColorAt(i, done ? DONE : GOLD);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(t: number) {
    this.mat.uniforms.time.value = t;
    this.mat.uniforms.motion.value = this.reduced?.matches ? 0 : 1;
  }
}

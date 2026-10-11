/**
 * The hero of the landing: "the Linga that holds the universe" — fully procedural, no assets.
 *
 *   Linga      a bana (ellipsoid) linga of black polished stone under a glassy clear-coat; looking into
 *              it you see a slowly turning galaxy, nebula and twinkling stars, and on its axis a thin
 *              pillar of golden light (the Lingodbhava) — raymarched inside the stone's own volume
 *   Tripundra  three bands of vibhuti across its face (embossed, finger-drawn), and a kumkum bindu at
 *              their centre that glows softly — the journey goes into it
 *   Peetha     a gold repoussé jalahari: a stepped black-granite plinth, a band of lotus petals, a
 *              beaded rim, water in the basin, and the spout (pranala) to the north, the viewer's right
 *   Abhishek   a thin stream of light-filled water falls from the darkness above onto the crown, runs
 *              down the stone in glistening rivulets, ripples the basin and leaves by the spout
 *   Offerings  bilva leaves, marigolds, a brass diya whose flame is the warm key light
 *
 * Units: the plinth stands on y = 0; the linga's crown is at y ≈ 2.2; the linga faces +z.
 */
import * as THREE from 'three';

// ---------- proportions ----------
/** linga: a shaft tapering a little from R0 (at the water) to R1, then an elliptical dome from YD to the crown YT */
export const R0 = 0.47, R1 = 0.445, YD = 1.62, YT = 2.16;
/** water level in the basin */
export const WATER = 0.775;
/** the bindu (the third eye) on the linga's face */
const EYE_Y = 1.43;
export const lingaRadius = (y: number) => {
  if (y <= YD) return R0 + (R1 - R0) * Math.max(0, (y - WATER) / (YD - WATER));
  const u = (y - YD) / (YT - YD);
  return R1 * Math.sqrt(Math.max(0, 1 - u * u));
};
export const EYE = new THREE.Vector3(0, EYE_Y, lingaRadius(EYE_Y));

// ---------- noise ----------
/** a tileable 3D fbm volume (R8, 64³), so the shaders sample noise instead of computing it */
function noiseVolume(N = 64) {
  const data = new Uint8Array(N * N * N);
  const acc = new Float32Array(N * N * N);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const octs: [number, number][] = [[4, 0.5], [8, 0.27], [16, 0.15], [32, 0.08]];
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (const [P, amp] of octs) {
    const lat = new Float32Array(P * P * P);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const L = (x: number, y: number, z: number) => lat[((z % P) * P + (y % P)) * P + (x % P)];
    for (let z = 0; z < N; z++) {
      const fz = (z * P) / N, iz = Math.floor(fz), tz = sm(fz - iz);
      for (let y = 0; y < N; y++) {
        const fy = (y * P) / N, iy = Math.floor(fy), ty = sm(fy - iy);
        for (let x = 0; x < N; x++) {
          const fx = (x * P) / N, ix = Math.floor(fx), tx = sm(fx - ix);
          const a = L(ix, iy, iz) + (L(ix + 1, iy, iz) - L(ix, iy, iz)) * tx;
          const b = L(ix, iy + 1, iz) + (L(ix + 1, iy + 1, iz) - L(ix, iy + 1, iz)) * tx;
          const c = L(ix, iy, iz + 1) + (L(ix + 1, iy, iz + 1) - L(ix, iy, iz + 1)) * tx;
          const d = L(ix, iy + 1, iz + 1) + (L(ix + 1, iy + 1, iz + 1) - L(ix, iy + 1, iz + 1)) * tx;
          const ab = a + (b - a) * ty, cd = c + (d - c) * ty;
          acc[(z * N + y) * N + x] += (ab + (cd - ab) * tz) * amp;
        }
      }
    }
  }
  // stretch the contrast to the full byte range
  let lo = Infinity, hi = -Infinity;
  for (const v of acc) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  for (let i = 0; i < acc.length; i++) data[i] = Math.round(((acc[i] - lo) / (hi - lo)) * 255);
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

/** shared GLSL: noise lookups and a bump-mapping helper (height in world units → perturbed view normal) */
const GLSL_COMMON = /* glsl */ `
uniform highp sampler3D uNoise;
uniform float uTime;
float nz(vec3 p){ return texture(uNoise, p).r; }
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
vec3 bumpNormal(vec3 n, float H){
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float dHx = dFdx(H), dHy = dFdy(H);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 g = sign(det) * (dHx * r1 + dHy * r2);
  return normalize(abs(det) * n - g);
}
`;

/** object-space position / normal varyings for MeshPhysicalMaterial patches */
function withObjectVaryings(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\nvarying vec3 vObjN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;\nvObjN = normal;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\nvarying vec3 vObjN;');
}

// ---------- the linga ----------
const LINGA_FRAG_HEAD = /* glsl */ `
uniform vec3 uCamObj;
uniform float uInner, uWet, uEyeGlow, uOpen, uSteps;
#define R0 ${R0.toFixed(4)}
#define R1 ${R1.toFixed(4)}
#define YD ${YD.toFixed(4)}
#define YT ${YT.toFixed(4)}
#define WATER ${WATER.toFixed(4)}
#define EYE_Y ${EYE_Y.toFixed(4)}
${GLSL_COMMON}
float gAsh, gBindu, gWet, gH, gSmudge;
const vec3 GC = vec3(0.0, EYE_Y - 0.035, 0.12);

/** the tripundra, the bindu and the water film, in object space */
void lingaMasks(vec3 p){
  float th = atan(p.x, p.z);
  float r = length(p.xz);
  float s = th * r; // arc length from the front
  // ash: three finger-drawn bands, tapering at the ends, grainy along the stroke
  gAsh = 0.0;
  for (int i = -1; i <= 1; i++) {
    float yc = EYE_Y + float(i) * 0.1 + (nz(vec3(th * 0.35, float(i) * 0.31, 0.7)) - 0.5) * 0.018;
    float half_ = 0.015 * smoothstep(1.12, 0.62, abs(th)) * (0.9 + 0.25 * nz(vec3(th * 0.9, float(i) * 0.5 + 0.2, 0.1)));
    float edge = abs(p.y - yc) - half_;
    float wob = (nz(vec3(th * 1.6, p.y * 4.0, float(i) * 0.37)) - 0.5) * 0.006;
    float band = 1.0 - smoothstep(-0.007, 0.005, edge + wob);
    float grain = 0.8 + 0.2 * smoothstep(0.25, 0.75, nz(vec3(th * 5.0, p.y * 40.0, 0.5 + float(i))));
    gAsh = max(gAsh, band * grain);
  }
  // the bindu: a round kumkum dot at the centre of the middle band
  float d = length(vec2(s, (p.y - EYE_Y) * 1.0));
  gBindu = 1.0 - smoothstep(0.03, 0.036, d + (nz(vec3(th * 4.0, p.y * 6.0, 0.9)) - 0.5) * 0.004);
  // the kumkum lies over the ash: under it there is no ash (so when it opens, it opens into the stone)
  gAsh *= 1.0 - gBindu;
  // water: the crown is wet; rivulets run down from it, moving
  float flow = nz(vec3(th * 0.55 + 0.13, p.y * 0.16 + uTime * 0.07, 0.31));
  float riv = smoothstep(0.56, 0.66, flow) * smoothstep(WATER, WATER + 0.5, p.y);
  float crown = smoothstep(YT - 0.24, YT - 0.04, p.y);
  gWet = max(riv, crown) * uWet;
  float ripple = nz(vec3(th * 2.4, p.y * 1.4 + uTime * 0.55, 0.77));
  // polishing smudges in the clear-coat
  gSmudge = nz(p * 0.6 + 0.4);
  gH = 0.0016 * gAsh + 0.0022 * gBindu + 0.0011 * gWet * ripple + 0.00025 * nz(p * 3.0);
}

/** a face-on barred spiral, in disk coordinates (units of the linga) */
vec3 galaxy(vec2 x){
  float rho = length(x);
  // differential rotation: the inner galaxy turns faster
  float a = uTime * 0.06 + 0.5 / (0.25 + rho * 7.0);
  float ca = cos(a), sa = sin(a);
  vec2 xr = vec2(ca * x.x - sa * x.y, sa * x.x + ca * x.y);
  float phi = atan(xr.y, xr.x);
  float wob = (nz(vec3(xr * 2.5, 0.37)) - 0.5) * 1.4;
  float sp = 2.0 * phi - 6.5 * log(rho + 0.02) + wob;
  float arm = pow(0.5 + 0.5 * cos(sp), 3.0);
  float lane = pow(0.5 + 0.5 * cos(sp - 0.75), 14.0);
  float fall = exp(-rho * 7.5);
  float fine = nz(vec3(xr * 9.0, 0.61));
  float knots = smoothstep(0.66, 0.86, nz(vec3(xr * 22.0, 0.13))) * arm;
  vec3 col = vec3(0.0);
  // the disk glow: blue-white arms, a warm core, dark dust lanes along the arms' inner edge
  col += mix(vec3(0.42, 0.58, 1.0), vec3(0.9, 0.86, 1.0), fine) * arm * (0.4 + 0.9 * fine) * fall * 2.6;
  col += vec3(0.25, 0.22, 0.4) * fall * 0.5;
  col *= 1.0 - 0.85 * lane * smoothstep(0.03, 0.08, rho);
  col += vec3(1.0, 0.45, 0.62) * knots * fall * 3.5;
  // the core and a short bar
  vec2 b = vec2(xr.x, xr.y * 3.2);
  col += vec3(1.0, 0.78, 0.48) * (exp(-rho * rho * 1400.0) * 2.6 + exp(-dot(b, b) * 260.0) * 0.9 + exp(-rho * 18.0) * 0.6);
  // resolved stars along the arms
  vec2 c = floor(xr * 180.0);
  vec3 h = hash33(vec3(c, 3.0));
  float d = length(fract(xr * 180.0) - 0.2 - 0.6 * h.xy);
  col += vec3(0.9, 0.95, 1.0) * smoothstep(0.22, 0.0, d) * step(0.55, h.z) * (arm * 0.8 + 0.2) * fall * 4.0;
  return col;
}

vec3 lingaInterior(vec3 ro, vec3 rd){
  // exit through the shaft (a cylinder), or through the dome (half an ellipsoid) above YD
  float A = dot(rd.xz, rd.xz), B = dot(ro.xz, rd.xz), C = dot(ro.xz, ro.xz) - R0 * R0;
  float t1 = (-B + sqrt(max(B * B - A * C, 0.0))) / max(A, 1e-5);
  if (ro.y + rd.y * t1 > YD) {
    vec3 e = vec3(R1, YT - YD, R1);
    vec3 o = (ro - vec3(0.0, YD, 0.0)) / e, d = rd / e;
    float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0;
    t1 = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
  }
  t1 = clamp(t1, 0.0, 1.3);
  if (rd.y < 0.0) t1 = min(t1, max((WATER - ro.y) / rd.y, 0.0));
  // fewer steps when the stone fills the screen (the close approach)
  const int N = 22;
  float dt = t1 / uSteps;
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  float T = 1.0;
  float ct = cos(1.3), st = sin(1.3);
  for (int i = 0; i < N; i++) {
    if (float(i) >= uSteps) break;
    vec3 p = ro + rd * ((float(i) + j) * dt);
    vec3 q = p - GC;
    vec3 qs = vec3(q.x, ct * q.y - st * q.z, st * q.y + ct * q.z);
    float dust = nz(qs * 0.9 + vec3(0.0, uTime * 0.003, 0.0));
    vec3 em = vec3(0.0);
    // nebula through the whole stone
    float neb = smoothstep(0.55, 0.85, nz(qs * 0.55 + vec3(0.3, 0.1, 0.0)));
    em += mix(vec3(0.38, 0.12, 0.85), vec3(0.95, 0.25, 0.45), nz(qs * 1.1 + 2.7)) * neb * neb * 0.6;
    em += vec3(0.08, 0.35, 0.6) * smoothstep(0.7, 0.9, dust) * 0.25;
    // the pillar of light on the axis (Lingodbhava), pulsing upwards
    float pr2 = dot(p.xz, p.xz);
    em += vec3(1.0, 0.8, 0.45) * (exp(-pr2 / 0.00025) * 2.6 + exp(-pr2 / 0.004) * 0.15) * (0.75 + 0.35 * sin(p.y * 13.0 - uTime * 1.4));
    float absorb = 1.5 + smoothstep(0.6, 0.8, dust) * 2.0;
    acc += T * em * dt;
    T *= exp(-absorb * dt);
  }
  // the galaxy: a thin disk, almost face-on, centred behind the bindu — drawn where the ray crosses it
  {
    vec3 nP = vec3(0.0, ct, -st);
    float dn = dot(rd, nP);
    float tp = -dot(ro - GC, nP) / (abs(dn) < 1e-4 ? 1e-4 : dn);
    if (tp > 0.0 && tp < t1) {
      vec3 x = ro + rd * tp - GC;
      vec2 g0 = vec2(x.x, st * x.y + ct * x.z);
      acc += galaxy(g0) * exp(-1.5 * tp);
    }
  }
  // stars at three depths (closest approach of the ray to each cell's star)
  for (int k = 0; k < 3; k++) {
    float s = 0.075 - 0.018 * float(k);
    vec3 p = ro + rd * t1 * (0.2 + 0.3 * float(k));
    vec3 c = floor(p / s);
    vec3 h = hash33(c + float(k) * 17.0);
    vec3 sp = (c + 0.2 + 0.6 * h) * s;
    float dd = length(cross(sp - ro, rd));
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + h.x * 3.0) + h.y * 40.0);
    acc += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.86, 0.65), h.z) * exp(-dd * dd / 0.0000055) * step(0.74, h.x) * tw * 1.5;
  }
  return acc;
}
`;

function lingaGeometry() {
  const pts: THREE.Vector2[] = [];
  const y0 = WATER - 0.04;
  for (let i = 0; i <= 24; i++) {
    const y = y0 + ((YD - y0) * i) / 24;
    pts.push(new THREE.Vector2(lingaRadius(y), y));
  }
  for (let i = 1; i <= 48; i++) {
    const a = (i / 48) * Math.PI / 2;
    pts.push(new THREE.Vector2(i === 48 ? 0 : R1 * Math.cos(a), YD + (YT - YD) * Math.sin(a)));
  }
  return new THREE.LatheGeometry(pts, 160);
}

function lingaMaterial(u: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x050506,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 0.8,
    ior: 1.55,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    withObjectVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${LINGA_FRAG_HEAD}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nlingaMasks(vObjP);')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.91, 0.87), gAsh);
        // kumkum: a powdery vermilion, a little uneven
        vec3 kum = mix(vec3(0.42, 0.012, 0.008), vec3(0.62, 0.05, 0.015), nz(vObjP * 60.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, kum, gBindu * (1.0 - uOpen));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = roughnessFactor * (0.7 + 0.6 * gSmudge);
        roughnessFactor = mix(roughnessFactor, 0.92, gAsh);
        roughnessFactor = mix(roughnessFactor, 0.5, gBindu);
        roughnessFactor = mix(roughnessFactor, 0.03, gWet * (1.0 - gAsh));`,
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(normal, gH);')
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.clearcoat *= 1.0 - 0.95 * max(gAsh, gBindu * (1.0 - uOpen));
        material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.09, gSmudge * gSmudge);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(vViewPosition);
          float F = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 5.0);
          vec3 rd = normalize(vObjP - uCamObj);
          vec3 rdr = refract(rd, normalize(vObjN), 1.0 / 1.55);
          vec3 inner = lingaInterior(vObjP, rdr);
          // as we come close, the bindu opens: we see through it into the galaxy's heart
          float cover = 1.0 - max(gAsh, gBindu * (1.0 - uOpen));
          // the stone is smoky: the universe glows through, deeper near the face, dimmer at the waterline
          float base = smoothstep(WATER, WATER + 0.3, vObjP.y);
          totalEmissiveRadiance += inner * (1.0 - F) * cover * uInner * (0.35 + 0.65 * base);
          float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
          totalEmissiveRadiance += vec3(0.75, 0.025, 0.01) * gBindu * min(uEyeGlow, 1.6) * pulse * (1.0 - uOpen);
          // vibhuti catches every bit of light: a little self-glow keeps it ash-white, not tan
          totalEmissiveRadiance += vec3(0.16, 0.155, 0.15) * gAsh;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'linga-v1';
  return m;
}

// ---------- the peetha (jalahari) ----------
const GOLD_FRAG_HEAD = /* glsl */ `
${GLSL_COMMON}
float gH;
/** lotus petals (two rows) on the bulge, beads on the rim, hammered texture everywhere */
void peethaRelief(vec3 p){
  float th = atan(p.x, p.z);
  float u = th / 6.2831853 * 16.0;
  float v = (p.y - 0.31) / 0.27;
  float h = 0.0;
  if (v > -0.05 && v < 1.05) {
    for (int row = 0; row < 2; row++) {
      float uu = fract(u + 0.5 * float(row)) - 0.5;
      float vv = row == 0 ? v : v * 1.25 + 0.05;
      float w = 0.46 * pow(max(0.0, sin(3.14159 * clamp(vv, 0.0, 1.0) * 0.98)), 0.55) * (1.0 - 0.45 * vv);
      float dd = abs(uu) / max(w, 1e-3);
      float petal = (1.0 - smoothstep(0.82, 1.0, dd)) * step(0.0, vv) * step(vv, 1.0);
      float dome = sqrt(max(0.0, 1.0 - dd * dd)) * (0.6 + 0.4 * sin(3.14159 * clamp(vv, 0.0, 1.0)));
      float rib = (1.0 - smoothstep(0.0, 0.08, abs(uu))) * 0.25 * smoothstep(0.1, 0.5, vv);
      float edge = (smoothstep(0.7, 0.86, dd) - smoothstep(0.86, 1.0, dd)) * 0.35;
      float hp = petal * (dome + rib + edge) * (row == 0 ? 1.0 : 0.55);
      h = max(h, hp);
    }
  }
  // the beaded rim and a twisted rope molding below it
  float beads = (1.0 - smoothstep(0.0, 0.006, abs(p.y - 0.792))) * 0.0 + smoothstep(0.012, 0.0, abs(p.y - 0.765)) * pow(0.5 + 0.5 * cos(th * 150.0), 0.6);
  float rope = smoothstep(0.014, 0.0, abs(p.y - 0.255)) * (0.5 + 0.5 * sin(th * 90.0 + p.y * 300.0));
  float hammer = nz(p * 4.0) * 0.12 + nz(p * 11.0) * 0.06;
  gH = 0.0065 * h + 0.003 * beads + 0.003 * rope + 0.0012 * hammer;
}
`;

function goldMaterial(u: Record<string, THREE.IUniform>, relief: boolean) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.74, 0.34),
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.12,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    withObjectVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GOLD_FRAG_HEAD}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${relief ? 'peethaRelief(vObjP);' : 'gH = 0.0012 * (nz(vObjP * 4.0) * 0.12 + nz(vObjP * 11.0) * 0.06);'}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // burnished on the high points, darker in the recesses (abhishek residue)
        roughnessFactor = mix(0.34, 0.12, smoothstep(0.0, 0.008, gH)) * (0.85 + 0.3 * nz(vObjP * 2.0));`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.006, gH));`,
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(normal, gH);');
  };
  m.customProgramCacheKey = () => (relief ? 'gold-relief' : 'gold-plain');
  return m;
}

/** a lathe profile with crisp corners: each listed corner is doubled */
function lathe(points: [number, number][], segs: number, sx = 1) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x * sx, y)), segs);
}

/** the peetha's horizontal scale against its drawn profile (the jalahari ≈ 2.3× the linga's width) */
const PS = 0.8;
/** the spout's tip (x) */
const X_TIP = 1.64;
/** inner radius of the basin (water's edge) */
const BASIN = 1.215 * PS;

function peethaGeometry() {
  // outer silhouette from the foot up, over the rim, down into the basin
  const P: [number, number][] = [
    [0.0, 0.22], [1.12, 0.22], [1.17, 0.235], [1.18, 0.27], [1.13, 0.29], [1.08, 0.305],
    // the lotus bulge
    [1.1, 0.33], [1.16, 0.38], [1.19, 0.43], [1.17, 0.49], [1.1, 0.54], [1.0, 0.575],
    // the neck
    [0.94, 0.59], [0.93, 0.62], [0.96, 0.635],
    // the flaring rim
    [1.06, 0.655], [1.2, 0.69], [1.3, 0.73], [1.34, 0.755], [1.345, 0.775], [1.34, 0.795], [1.32, 0.805],
    // the lip, then down into the basin
    [1.25, 0.805], [1.22, 0.795], [1.2, 0.76], [1.1, 0.735], [0.6, 0.73], [0.0, 0.73],
  ];
  return lathe(P, 192, PS);
}

function plinthGeometry() {
  const P: [number, number][] = [
    [0, -0.6], [1.62, -0.6], [1.62, 0.0], [1.95, 0.0], [1.98, 0.02], [1.98, 0.085], [1.95, 0.1],
    [1.55, 0.1], [1.57, 0.115], [1.57, 0.2], [1.54, 0.22], [0, 0.22],
  ];
  return lathe(P, 128, PS);
}

/** the pranala (spout) towards +x: a tapering trough with a channel, ending in a rounded lip */
function spoutGeometry() {
  const S = 28, X0 = 0.8, L = X_TIP - 0.8;
  // cross-section (z, y), closed: top with a channel, rounded underside
  const sec = (w: number, h: number): [number, number][] => [
    [-w, 0], [-0.62 * w, 0.004], [-0.5 * w, -0.45 * h], [0, -0.55 * h], [0.5 * w, -0.45 * h], [0.62 * w, 0.004], [w, 0],
    [w * 0.98, -0.3 * h], [w * 0.85, -0.65 * h], [w * 0.55, -0.92 * h], [0, -h], [-w * 0.55, -0.92 * h], [-w * 0.85, -0.65 * h], [-w * 0.98, -0.3 * h],
  ];
  const M = sec(1, 1).length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const w = 0.16 * (1 - 0.55 * s) * (s > 0.9 ? 1 - (s - 0.9) * 2.2 : 1);
    const h = 0.11 * (1 - 0.35 * s);
    const yc = 0.79 - 0.05 * s - (s > 0.85 ? (s - 0.85) * 0.3 : 0);
    for (const [z, y] of sec(w, h)) pos.push(X0 + L * s, yc + y, z);
  }
  for (let i = 0; i < S; i++)
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  // cap the tip
  const tip = pos.length / 3;
  pos.push(X0 + L + 0.005, 0.79 - 0.05 - 0.045 - 0.04, 0);
  for (let j = 0; j < M; j++) idx.push(S * M + j, tip, S * M + ((j + 1) % M));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- water ----------
const WATER_FRAG_HEAD = /* glsl */ `
${GLSL_COMMON}
float gH;
void waterRipples(vec3 p){
  float r = length(p.xz);
  // rings spreading from the linga's foot, and a drift towards the spout (+x)
  float rings = sin(r * 70.0 - uTime * 3.2) * exp(-(r - 0.5) * 3.0) * 0.6;
  float drift = nz(vec3(p.x * 1.5 - uTime * 0.12, p.z * 1.5, uTime * 0.05)) - 0.5;
  gH = 0.0009 * rings + 0.003 * drift;
}
`;
function waterMaterial(u: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x07080a, roughness: 0.03, metalness: 0, ior: 1.33, transparent: true, opacity: 0.9, specularIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    withObjectVaryings(sh);
    sh.vertexShader = sh.vertexShader.replace('vObjP = position;', 'vObjP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_FRAG_HEAD}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nwaterRipples(vObjP);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(normal, gH);');
  };
  m.customProgramCacheKey = () => 'water-v1';
  return m;
}

/** a falling stream: a thin tube, bright at its edges, with light running down it */
const STREAM_VS = /* glsl */ `
uniform float uTime, uWobble;
varying vec3 vN; varying vec3 vV; varying float vY;
void main(){
  vec3 p = position;
  p.x += sin(p.y * 2.7 + uTime * 3.1) * 0.0025 * uWobble + sin(p.y * 11.0 - uTime * 7.0) * 0.0012;
  p.z += cos(p.y * 3.3 + uTime * 2.3) * 0.002 * uWobble;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vY = wp.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const STREAM_FS = /* glsl */ `
uniform float uTime, uFadeTop, uFadeBottom, uSpeed, uOpacity;
uniform highp sampler3D uNoise;
varying vec3 vN; varying vec3 vV; varying float vY;
void main(){
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float edge = pow(1.0 - ndv, 1.6);
  float flow = texture(uNoise, vec3(atan(vN.x, vN.z) * 0.08, vY * 0.9 + uTime * uSpeed, 0.4)).r;
  float glint = smoothstep(0.62, 0.8, flow);
  float a = (0.35 + 0.9 * edge + 1.4 * glint * (0.4 + edge)) * uOpacity;
  a *= smoothstep(uFadeTop, uFadeTop - 1.4, vY) * smoothstep(uFadeBottom, uFadeBottom + 0.05, vY);
  vec3 col = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.93, 0.8), glint) * (0.9 + 1.4 * glint);
  gl_FragColor = vec4(col * a, a);
}`;

/** droplets thrown up where the stream meets the crown, and drops falling from the spout */
const SPLASH_VS = /* glsl */ `
uniform float uTime, uSize;
uniform vec3 uOrigin;
attribute vec4 seed;
varying float vA;
void main(){
  float life = 0.55 + 0.5 * seed.w;
  float age = fract(uTime / life + seed.x);
  float ang = seed.y * 6.2831853;
  float sp = 0.25 + 0.45 * seed.z;
  vec3 v = vec3(cos(ang) * sp, 0.55 + 0.9 * seed.w, sin(ang) * sp);
  vec3 p = uOrigin + v * age * life - vec3(0.0, 4.9, 0.0) * pow(age * life, 2.0);
  // they land on the dome: keep them above the surface
  p.y = max(p.y, uOrigin.y - 0.25 * length(p.xz - uOrigin.xz));
  vA = (1.0 - age) * smoothstep(0.0, 0.08, age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + seed.z) / -mv.z;
}`;
const SPLASH_FS = /* glsl */ `
varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); float a = smoothstep(0.25, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a, a); }`;

// ---------- the diya ----------
const FLAME_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAME_FS = /* glsl */ `
uniform float uTime; uniform highp sampler3D uNoise;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; // x in -1..1, y in -1..1 (base at -1)
  float y = p.y * 0.5 + 0.5;
  float sway = (texture(uNoise, vec3(0.3, uTime * 0.35, 0.1)).r - 0.5) * 0.5 * y * y;
  float x = p.x - sway;
  // teardrop: wide at the base, a long tip
  float w = 0.42 * pow(max(0.0, 1.0 - y), 0.75) * smoothstep(-0.02, 0.25, y);
  float d = abs(x) / max(w, 1e-3);
  float flick = texture(uNoise, vec3(x * 0.3, y * 0.6 - uTime * 1.2, 0.6)).r;
  float body = smoothstep(1.0, 0.25, d + (flick - 0.5) * 0.5 * y);
  float core = smoothstep(0.75, 0.0, d) * smoothstep(0.75, 0.15, y);
  vec3 col = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.72, 0.28), smoothstep(0.7, 0.2, y));
  col = mix(col, vec3(1.0, 0.97, 0.88), core);
  vec3 blue = vec3(0.25, 0.35, 1.0) * smoothstep(0.18, 0.0, y) * smoothstep(1.0, 0.4, d) * 0.6;
  float a = body * (0.85 + 0.15 * flick);
  gl_FragColor = vec4((col * 2.6 + blue) * a, a);
}`;

/** a soft round glow texture */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 0.45) {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, `${mid})`));
  gr.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- offerings ----------
/** a bilva leaflet: a pointed ellipse, slightly cupped along its midrib */
function leafletGeometry(len: number, wid: number) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(wid * 0.9, len * 0.12, wid * 0.75, len * 0.75, 0, len);
  sh.bezierCurveTo(-wid * 0.75, len * 0.75, -wid * 0.9, len * 0.12, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // cup across, arch along
    p.setZ(i, (x * x) / wid * 0.9 - Math.sin((y / len) * Math.PI) * len * 0.06);
  }
  g.computeVertexNormals();
  return g;
}
function bilva(mat: THREE.Material) {
  const g = new THREE.Group();
  const big = leafletGeometry(0.2, 0.075), side = leafletGeometry(0.15, 0.06);
  const mid = new THREE.Mesh(big, mat);
  const l = new THREE.Mesh(side, mat), r = new THREE.Mesh(side, mat);
  l.rotation.z = 1.05;
  r.rotation.z = -1.05;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.09, 6), mat);
  stem.position.set(0, -0.045, 0.002);
  g.add(mid, l, r, stem);
  g.rotation.x = -Math.PI / 2; // lying flat, pointing -z in its own frame
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}
function marigold(mat: THREE.Material, r = 0.055) {
  const g = new THREE.IcosahedronGeometry(r, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    // ruffled petals: many small folds
    const f = 1 + 0.12 * Math.sin(n.x * 40) * Math.sin(n.y * 37) * Math.sin(n.z * 43);
    v.copy(n).multiplyScalar(r * f);
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

export interface Linga {
  group: THREE.Group;
  /** world-space third eye */
  eye: THREE.Vector3;
  update(t: number, camera: THREE.Camera, eyeGlow: number, open?: number): void;
  /** an environment scene for reflections (product-render softboxes in a cosmic room) */
  envScene(): THREE.Scene;
}

export function createLinga(opts: { mobile: boolean }): Linga {
  const noise = noiseVolume(opts.mobile ? 48 : 64);
  const shared = { uNoise: { value: noise }, uTime: { value: 0 } };
  const lu = { ...shared, uCamObj: { value: new THREE.Vector3() }, uInner: { value: 1 }, uWet: { value: 1 }, uEyeGlow: { value: 1 }, uOpen: { value: 0 }, uSteps: { value: 22 } };
  const group = new THREE.Group();

  // the linga
  const linga = new THREE.Mesh(lingaGeometry(), lingaMaterial(lu));
  group.add(linga);

  // the peetha, its spout, the plinth
  const gold = goldMaterial(shared, true);
  const goldPlain = goldMaterial(shared, false);
  const peetha = new THREE.Mesh(peethaGeometry(), gold);
  const spout = new THREE.Mesh(spoutGeometry(), goldPlain);
  const granite = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0a, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  granite.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    withObjectVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.7 + 0.9 * smoothstep(0.55, 0.9, nz(vObjP * 1.7)) + 0.6 * step(0.985, nz(vObjP * 9.0));');
  };
  granite.customProgramCacheKey = () => 'granite';
  const plinth = new THREE.Mesh(plinthGeometry(), granite);
  group.add(peetha, spout, plinth);

  // water in the basin
  const pool = new THREE.Mesh(new THREE.RingGeometry(lingaRadius(WATER) - 0.01, BASIN, 160, 6), waterMaterial(shared));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = WATER;
  group.add(pool);

  // the abhishek: a stream from the dark above onto the crown, splashes, and the outflow at the spout
  const crownY = YT;
  const su = { ...shared, uWobble: { value: 1 }, uFadeTop: { value: 9 }, uFadeBottom: { value: crownY - 0.02 }, uSpeed: { value: 0.9 }, uOpacity: { value: 1 } };
  const streamMat = new THREE.ShaderMaterial({ vertexShader: STREAM_VS, fragmentShader: STREAM_FS, uniforms: su, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const sH = 7;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.0105, sH, 16, 80, true), streamMat);
  stream.position.set(0, crownY + sH / 2 - 0.01, 0);
  group.add(stream);
  const ou = { ...shared, uWobble: { value: 0.5 }, uFadeTop: { value: 0.72 }, uFadeBottom: { value: 0.05 }, uSpeed: { value: 1.6 }, uOpacity: { value: 0.5 } };
  const outMat = streamMat.clone();
  outMat.uniforms = ou;
  const outflow = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 1.2, 12, 30, true), outMat);
  outflow.position.set(X_TIP, 0.69 - 0.6, 0);
  group.add(outflow);
  const nSplash = opts.mobile ? 40 : 90;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nSplash * 3), 3));
  const seeds = new Float32Array(nSplash * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  sg.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 4));
  const splashU = { uTime: { value: 0 }, uSize: { value: opts.mobile ? 14 : 18 }, uOrigin: { value: new THREE.Vector3(0, crownY + 0.005, 0) } };
  const splash = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS, uniforms: splashU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  splash.frustumCulled = false;
  splash.visible = false; // the droplets read as glitter round the crown; off

  // the diya on the plinth's step, front-left: its flame is the warm key
  const brass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.95, 0.66, 0.32), metalness: 1, roughness: 0.28 });
  const diya = new THREE.Group();
  const bowl = lathe([[0, 0], [0.07, 0.0], [0.1, 0.02], [0.13, 0.055], [0.135, 0.065], [0.125, 0.065], [0.1, 0.035], [0, 0.03]], 48);
  diya.add(new THREE.Mesh(bowl, brass));
  const foot = lathe([[0, -0.07], [0.07, -0.07], [0.075, -0.06], [0.03, -0.04], [0.03, 0.0], [0, 0.0]], 32);
  diya.add(new THREE.Mesh(foot, brass));
  const ghee = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshPhysicalMaterial({ color: 0x5a3a0c, roughness: 0.05, clearcoat: 1 }));
  ghee.rotation.x = -Math.PI / 2;
  ghee.position.y = 0.05;
  diya.add(ghee);
  const flameMat = new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.2), flameMat);
  flame.position.set(0.075, 0.155, 0);
  diya.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,80,1)', 0.2), color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
  halo.position.copy(flame.position).y += 0.0;
  halo.scale.setScalar(0.45);
  diya.add(halo);
  const diyaLight = new THREE.PointLight(0xff9a4a, 1.2, 5, 1.6);
  diyaLight.position.set(0.075, 0.2, 0.05);
  diya.add(diyaLight);
  diya.position.set(-0.86, 0.17, 1.1);
  diya.scale.setScalar(0.8);
  diya.rotation.y = 0.3;
  group.add(diya);

  // offerings: bilva on the water at the linga's foot and on the rim, marigolds on the rim
  const leaf = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.06, 0.2, 0.035), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide, sheen: 0.3, sheenColor: new THREE.Color(0.3, 0.6, 0.2) });
  const place = (o: THREE.Object3D, x: number, y: number, z: number, ry: number, tilt = 0) => {
    o.position.set(x, y, z);
    o.rotation.set(tilt, ry, 0);
    group.add(o);
    return o;
  };
  place(bilva(leaf), -0.5, WATER + 0.006, 0.42, 2.4);
  place(bilva(leaf), 0.52, WATER + 0.006, 0.5, -2.2, 0.02);
  place(bilva(leaf), -1.38, 0.105, -0.2, 1.0);
  const mari = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.42, 0.02), roughness: 0.62, sheen: 1, sheenColor: new THREE.Color(1, 0.7, 0.2), sheenRoughness: 0.5 });
  const mari2 = mari.clone();
  mari2.color.setRGB(1.0, 0.62, 0.04);
  place(marigold(mari), -1.36, 0.13, 0.42, 0);
  place(marigold(mari2, 0.048), -1.25, 0.128, 0.62, 0);
  place(marigold(mari), 1.2, 0.13, 0.78, 0);
  place(marigold(mari2, 0.05), 0.68, WATER + 0.012, -0.5, 0);
  // white flowers (jasmine) floating on the water
  const petalMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f1e6, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(1, 1, 0.9), side: THREE.DoubleSide, emissive: new THREE.Color(0.06, 0.055, 0.05) });
  const jasmine = () => {
    const f = new THREE.Group();
    const pg = leafletGeometry(0.045, 0.024);
    for (let k = 0; k < 5; k++) {
      const pm = new THREE.Mesh(pg, petalMat);
      pm.rotation.set(-Math.PI / 2 + 0.25, 0, 0);
      const h = new THREE.Group();
      h.rotation.y = (k / 5) * Math.PI * 2;
      h.add(pm);
      f.add(h);
    }
    return f;
  };
  place(jasmine(), 0.25, WATER + 0.008, 0.72, 0.4);
  place(jasmine(), -0.74, WATER + 0.008, 0.08, 1.1);
  place(jasmine(), 1.05, 0.11, 1.0, 0.3);

  // a faint aura behind (warm at the centre, violet out): separates the black stone from the black sky
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(150,90,255,1)', 0.18), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.16 }));
  aura.position.set(0, 1.45, -1.6);
  aura.scale.set(6.5, 6.5, 1);
  aura.renderOrder = -1;
  group.add(aura);

  const tmp = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  return {
    group,
    eye: EYE.clone(),
    update(t, camera, eyeGlow, open = 0) {
      lu.uOpen.value = open;
      lu.uSteps.value = open > 0 || eyeGlow > 1.3 ? 12 : opts.mobile ? 16 : 22;
      shared.uTime.value = t;
      splashU.uTime.value = t;
      lu.uEyeGlow.value = eyeGlow;
      group.updateMatrixWorld();
      inv.copy(linga.matrixWorld).invert();
      lu.uCamObj.value.copy(camera.position).applyMatrix4(inv);
      // the flame faces the camera (about its vertical axis only)
      flame.getWorldPosition(tmp);
      const cp = camera.position;
      flame.rotation.y = Math.atan2(cp.x - tmp.x, cp.z - tmp.z) - diya.rotation.y;
      diyaLight.intensity = 1.1 + 0.2 * Math.sin(t * 9.0) * Math.sin(t * 5.3 + 1.0);
    },
    envScene() {
      // a dark cosmic room with softboxes: a broad warm key (front-left, high), cool and violet
      // strips behind (long rim highlights down the stone), a low warm card (the diya's side)
      const s = new THREE.Scene();
      const room = new THREE.Mesh(
        new THREE.SphereGeometry(20, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `varying vec3 vD; void main(){ vec3 d = normalize(vD);
            vec3 c = mix(vec3(0.004, 0.003, 0.008), vec3(0.018, 0.012, 0.035), smoothstep(-0.2, 0.8, d.y));
            c += vec3(0.05, 0.02, 0.08) * pow(max(0.0, 1.0 - abs(d.y + 0.05) * 4.0), 4.0);
            // a broad, soft warm bounce from the front and below: gives the gold its body colour
            c += vec3(0.5, 0.34, 0.18) * pow(max(dot(d, normalize(vec3(0.0, -0.45, 1.0))), 0.0), 2.0) * 0.55;
            gl_FragColor = vec4(c, 1.0); }`,
        }),
      );
      s.add(room);
      const box = (w: number, h: number, color: THREE.Color, pos: [number, number, number]) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        m.position.set(...pos);
        m.lookAt(0, 1.2, 0);
        s.add(m);
      };
      box(3.4, 2.2, new THREE.Color(3.0, 2.3, 1.6), [-6, 7, 6]);
      box(0.45, 8, new THREE.Color(1.5, 1.45, 1.6), [-7, 2.5, 3.5]);
      box(0.35, 8, new THREE.Color(1.1, 0.95, 1.5), [7.5, 2.5, 2]);
      box(0.5, 9, new THREE.Color(0.45, 0.65, 1.4), [-8, 2, -5]);
      box(0.5, 9, new THREE.Color(1.0, 0.5, 1.5), [8, 2, -5]);
      box(2.4, 0.6, new THREE.Color(2.4, 1.2, 0.45), [-5, 0.4, 6]);
      box(1.6, 1.6, new THREE.Color(0.5, 0.45, 0.55), [0, 11, 2]);
      return s;
    },
  };
}

import * as THREE from 'three';

/**
 * (Copied from the Rameshwaram site's facade.ts, itself adapted from Trimbakeshwar.) Facades drawn in the shader, in each instanced house's
 * own metres: storey slab lines, windows with light frames and dark grilled panes, chajja shadows,
 * rain streaks, grime at the foot, rolling shutters at street level (unless `upper`), and a flat roof
 * of damp concrete. Instance colour gives each house its paint.
 * The unit geometry is a 1×1×1 box with its base at y = 0; instance scale = (width, height, depth).
 */
export function facadeMaterial(upper: boolean) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
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
            float n = fn(vLoc.xz * 0.7);
            diffuseColor.rgb = vec3(0.5, 0.48, 0.45) * (0.72 + 0.35 * n);
          } else {
            bool alongX = abs(vLN.z) > 0.5;
            float u = alongX ? vLoc.x : vLoc.z;
            float halfW = alongX ? vScl.x * 0.5 : vScl.z * 0.5;
            float y = vLoc.y;
            float storey = floor(y / 3.2), fy = mod(y, 3.2);
            float bayW = 2.5;
            float nb = max(1.0, floor(2.0 * halfW / bayW));
            float bw = 2.0 * halfW / nb;
            float fu = mod(u + halfW, bw) - bw * 0.5;
            float top = vScl.y;
            vec3 c = base;
            float streak = fn(vec2(u * 1.7, y * 0.12 + vSeed * 9.0));
            c *= 0.74 + 0.32 * streak;
            float blot = fn(vec2(u * 0.35 + vSeed * 13.0, y * 0.4));
            c *= 0.86 + 0.18 * blot;
            c = mix(c, vec3(0.32, 0.3, 0.27), 0.22 * smoothstep(0.55, 0.95, fn(vec2(u * 0.9, y * 0.06 + vSeed * 3.0))) * smoothstep(top, top - 2.5, y));
            ${upper ? '' : 'c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 1.2, y));'}
            float slab = step(3.0, fy) + step(top - 0.15, y);
            c = mix(c, vec3(0.93, 0.92, 0.88), slab * 0.85);
            ${upper ? 'if (false) {' : 'if (storey < 0.5 && vSeed > 0.3) {'}
              if (abs(fu) < bw * 0.42 && fy < 2.5) {
                float rib = 0.5 + 0.5 * sin(fy * 70.0);
                c = mix(vec3(0.33, 0.34, 0.35), vec3(0.47, 0.48, 0.49), rib) * (vSeed > 0.75 ? 0.4 : 1.0);
              }
            } else if (y < top - 0.9) {
              float wx = abs(fu), wyc = fy - 1.5;
              if (wx < 0.6 && abs(wyc) < 0.62) {
                bool frame = wx > 0.53 || abs(wyc) > 0.55;
                float grill = step(0.9, fract((fu + 0.6) / 0.15)) + step(0.88, fract((wyc + 0.62) / 0.31));
                vec3 shutter = vSeed > 0.5 ? vec3(0.16, 0.36, 0.5) : vec3(0.45, 0.22, 0.12);
                vec3 pane = mix(vec3(0.06, 0.07, 0.08), shutter, step(0.6, fh(vec2(floor((u + halfW) / bw), storey + vSeed * 7.0))));
                c = frame ? vec3(0.9, 0.89, 0.85) : mix(pane, vec3(0.32), min(1.0, grill) * 0.55);
              }
              if (wx < 0.8 && fy > 2.18 && fy < 2.3) c *= 0.4;
              if (wx < 0.5 && wyc < -0.62) c *= 1.0 - 0.18 * smoothstep(0.0, -1.2, wyc + 0.62) * streak;
            }
            diffuseColor.rgb = c;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'srisailam-facade-' + upper;
  return m;
}

/** Unit box, base at y = 0. */
export const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

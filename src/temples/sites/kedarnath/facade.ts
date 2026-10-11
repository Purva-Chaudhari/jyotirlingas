import * as THREE from 'three';

/**
 * Lodge facades drawn in the shader in each house's own metres (adapted from the Trimbakeshwar
 * town): storey slab lines, rows of framed windows (painted frames, some wooden shutters), rolling
 * shop shutters at street level, chajja shadow lines, rain streaks and stains, grime at the foot.
 * Use on an InstancedMesh of a unit box translated to y ∈ [0, 1]; instance scale = (w, h, d).
 */
export function facadeMaterial() {
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
                vec3 fr = vSeed < 0.25 ? vec3(0.12, 0.3, 0.62) : vSeed < 0.5 ? vec3(0.45, 0.16, 0.12) : vSeed < 0.75 ? vec3(0.15, 0.42, 0.25) : vec3(0.8, 0.78, 0.74);
                bool shut = fract(vSeed * 7.3 + floor((u + halfW) / bw) * 0.37) > 0.72;
                vec3 pane = shut ? vec3(0.32, 0.2, 0.12) * (0.8 + 0.2 * step(0.5, fract(fu * 6.0))) : mix(vec3(0.07, 0.08, 0.09), vec3(0.3), min(1.0, grill) * 0.6);
                c = frame ? fr : pane;
              }
              if (wx < 0.8 && fy > 2.1 && fy < 2.22) c *= 0.45; // chajja shadow line
              // stain running down from the window sill
              if (wx < 0.5 && wyc < -0.62) c *= 1.0 - 0.18 * smoothstep(0.0, -1.2, wyc + 0.62) * streak;
            }
            // weathering: dark damp stains, rust streaks under ledges, corrugated tin cladding patches
            float stain = smoothstep(0.62, 0.85, fn(vec2(u * 0.35 + vSeed * 13.0, y * 0.22)));
            c *= 1.0 - stain * 0.22;
            float rust = smoothstep(0.7, 0.9, fn(vec2(u * 2.3 + vSeed * 7.0, 0.5))) * smoothstep(0.0, 1.0, fy) * (1.0 - smoothstep(1.0, 2.6, fy));
            c = mix(c, vec3(0.45, 0.26, 0.14), rust * 0.35);
            float tin = step(0.78, fn(vec2(floor((u + halfW) / 2.4) + vSeed * 31.0, storey * 3.1)));
            if (tin > 0.5 && storey > 0.5 && abs(fu) > 0.7) {
              float rib = 0.5 + 0.5 * sin(u * 52.0);
              c = mix(vec3(0.55, 0.57, 0.58), vec3(0.4, 0.42, 0.44), rib) * (0.8 + 0.3 * fn(vec2(u * 0.4, y * 0.6)));
              c = mix(c, vec3(0.42, 0.24, 0.12), smoothstep(0.55, 0.85, fn(vec2(u * 1.5, y * 1.2 + 4.0))) * 0.6);
            }
            diffuseColor.rgb = c;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'kedar-facade';
  return m;
}


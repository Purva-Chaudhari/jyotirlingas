import * as THREE from 'three';

/**
 * Somnath's sandstone, made to read as carved and weathered:
 *  - a tileable relief pattern (lotus-petal courses, rows of little arched niches, a lattice band and
 *    rosettes) applied as derivative bump-mapping on top of the scanned block texture, with the grooves
 *    darkened, so every surface carries the dense carving seen in the photographs;
 *  - low-frequency colour variation between stones (honey to pale cream), salt-air grime near the
 *    ground and faint rain streaks.
 */

let carveTex: THREE.CanvasTexture | null = null;

/** Height map of the carving, one tile = `CARVE_TILE` metres. White = proud, black = cut back. */
function carvingTexture() {
  if (carveTex) return carveTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, S, S);
  const shade = (v: number) => `rgb(${v},${v},${v})`;
  // course 1 (top quarter): a row of lotus petals
  for (let i = 0; i < 8; i++) {
    const x = i * 32 + 16;
    const gr = g.createRadialGradient(x, 58, 2, x, 52, 22);
    gr.addColorStop(0, shade(235));
    gr.addColorStop(1, shade(120));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, 40, 13, 22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = shade(40);
  g.fillRect(0, 62, S, 4);
  g.fillStyle = shade(200);
  g.fillRect(0, 66, S, 6);
  // course 2: little arched niches (devakulikas), each with a dark recess and a proud frame
  for (let i = 0; i < 6; i++) {
    const x = i * (S / 6) + S / 12;
    g.fillStyle = shade(210);
    g.beginPath();
    g.moveTo(x - 16, 136); g.lineTo(x - 16, 96); g.quadraticCurveTo(x, 70, x + 16, 96); g.lineTo(x + 16, 136); g.closePath();
    g.fill();
    g.fillStyle = shade(30);
    g.beginPath();
    g.moveTo(x - 10, 132); g.lineTo(x - 10, 100); g.quadraticCurveTo(x, 84, x + 10, 100); g.lineTo(x + 10, 132); g.closePath();
    g.fill();
    // a small figure-like boss in the niche (abstract, no face)
    g.fillStyle = shade(170);
    g.beginPath(); g.ellipse(x, 116, 5, 11, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = shade(40);
  g.fillRect(0, 138, S, 4);
  g.fillStyle = shade(215);
  g.fillRect(0, 142, S, 5);
  // course 3: diamond lattice (jali-like band)
  g.strokeStyle = shade(220);
  g.lineWidth = 5;
  for (let i = -4; i < 12; i++) {
    g.beginPath(); g.moveTo(i * 32, 150); g.lineTo(i * 32 + 48, 196); g.stroke();
    g.beginPath(); g.moveTo(i * 32 + 48, 150); g.lineTo(i * 32, 196); g.stroke();
  }
  g.fillStyle = shade(40);
  g.fillRect(0, 198, S, 4);
  // course 4: rosettes
  for (let i = 0; i < 8; i++) {
    const x = i * 32 + 16;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillStyle = shade(205);
      g.beginPath(); g.ellipse(x + Math.cos(a) * 7, 228 + Math.sin(a) * 7, 5, 3, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = shade(240);
    g.beginPath(); g.arc(x, 228, 4, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = shade(40);
  g.fillRect(0, 252, S, 4);
  carveTex = new THREE.CanvasTexture(c);
  carveTex.wrapS = carveTex.wrapT = THREE.RepeatWrapping;
  carveTex.anisotropy = 8;
  return carveTex;
}

const NOISE = /* glsl */ `
  float sh1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float sn3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sh1(i), sh1(i + vec3(1,0,0)), f.x), mix(sh1(i + vec3(0,1,0)), sh1(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(sh1(i + vec3(0,0,1)), sh1(i + vec3(1,0,1)), f.x), mix(sh1(i + vec3(0,1,1)), sh1(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

/**
 * Add weathering (and optionally carving) to a stone material. `carve` = relief strength (0 = none);
 * `tile` = metres per carving tile.
 */
export function weatherStone(m: THREE.MeshStandardMaterial, carve = 0, tile = 1.1) {
  const tex = carve > 0 ? carvingTexture() : null;
  m.onBeforeCompile = (sh) => {
    if (tex) {
      sh.uniforms.carveMap = { value: tex };
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSWorld;\nvarying vec2 vSUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSUv = uv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let frag = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSWorld;
        varying vec2 vSUv;
        ${tex ? 'uniform sampler2D carveMap;' : ''}
        ${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 wp = vSWorld;
          // stone-to-stone colour variation: pale cream to peach, with each ashlar block a little
          // lighter or darker than its neighbours (±6 %)
          float n1 = sn3(wp * 0.35), n2 = sn3(wp * 1.7 + 7.0);
          vec3 tint = mix(vec3(1.05, 1.0, 0.92), vec3(0.99, 0.93, 0.87), n1);
          float blk = sh1(floor(wp / vec3(0.92, 0.46, 0.92) + 0.5));
          diffuseColor.rgb *= tint * (0.95 + 0.1 * n2) * (0.94 + 0.12 * blk);
          // salt-air grime at the foot of walls and faint rain streaks
          float grime = 1.0 - 0.22 * (1.0 - smoothstep(0.0, 1.6, wp.y)) * step(-0.3, wp.y);
          // salt-air efflorescence: pale, patchy staining creeping up from the base
          float salt = (1.0 - smoothstep(0.3, 2.4, wp.y + sn3(wp * 1.3) * 0.8)) * smoothstep(0.35, 0.7, sn3(wp * 2.2 + 3.0)) * step(-0.3, wp.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.84, 0.8) * dot(diffuseColor.rgb, vec3(0.4, 0.4, 0.2)) * 1.35, salt * 0.45);
          float st = smoothstep(0.62, 0.95, sn3(vec3(wp.x * 3.1 + wp.z * 2.3, wp.y * 0.12, wp.z * 3.1 - wp.x * 1.7)));
          diffuseColor.rgb *= grime * (1.0 - 0.13 * st);
          ${tex ? `float cv = texture2D(carveMap, vSUv / ${tile.toFixed(3)}).r;
          diffuseColor.rgb *= mix(0.56, 1.08, cv * cv * (3.0 - 2.0 * cv));` : ''}
        }`);
    if (tex) {
      frag = frag.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h = texture2D(carveMap, vSUv / ${tile.toFixed(3)}).r * ${carve.toFixed(3)};
          // fade the relief on faces seen edge-on, where the derivative bump would blow up into bright slivers
          float facing = abs(dot(normal, normalize(vViewPosition)));
          vec2 dh = vec2(dFdx(h), dFdy(h)) * smoothstep(0.12, 0.45, facing);
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
    }
    // sunlit faces glow warm peach, shaded ones stay a warm saffron (as in the photographs)
    frag = frag.replace('#include <opaque_fragment>', `{
        float lum = dot(outgoingLight, vec3(0.3, 0.59, 0.11));
        outgoingLight *= mix(vec3(1.0, 0.95, 0.94), vec3(1.05, 0.99, 0.9), smoothstep(0.06, 0.55, lum));
      }
      #include <opaque_fragment>`);
    sh.fragmentShader = frag;
  };
  m.customProgramCacheKey = () => `somnath-stone-${carve}-${tile}`;
  m.needsUpdate = true;
}

/** Copy the scanned maps from `src` onto `dst` once they have loaded. */
export function copyScan(src: THREE.MeshStandardMaterial, dst: THREE.MeshStandardMaterial) {
  dst.map = src.map;
  dst.normalMap = src.normalMap;
  dst.normalScale.copy(src.normalScale);
  dst.aoMap = src.aoMap;
  dst.roughnessMap = src.roughnessMap;
  dst.metalnessMap = src.metalnessMap;
  dst.roughness = src.roughness;
  dst.metalness = src.metalness;
  dst.color.copy(src.color);
  dst.emissive.copy(src.emissive);
  dst.needsUpdate = true;
}

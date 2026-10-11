import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainH, design, compress, fbm } from './terrain';

/**
 * The Bhimashankar sacred grove and the Sahyadri semi-evergreen forest round it: tall straight-boled trees
 * (jamun, mango, hirda, anjani, the big ficus by the courtyard) with dense rounded dark crowns; red-brown
 * flushes of new leaves here and there; thinning to grass on the plateau tops and gone on the cliffs.
 *
 * Each crown is a dark inner mass of lobes wrapped in jagged leaf clumps (real polygons, no alpha cut-outs,
 * so they read correctly in the shadow and ambient-occlusion passes), lit with spherical normals so the
 * whole crown shades as one soft volume. Three rings of detail, each split into angular sectors so whole
 * sectors are frustum-culled; only the near ring casts sun shadows.
 */

type Parts = { pos: number[]; nor: number[]; col: number[]; bark: number[] };

function push(P: Parts, g: THREE.BufferGeometry, col: (p: THREE.Vector3) => [number, number, number], bark: number, sphereC?: THREE.Vector3, sphereK = 0) {
  const ng = g.index ? g.toNonIndexed() : g;
  if (!ng.attributes.normal) ng.computeVertexNormals();
  const p = ng.attributes.position, n = ng.attributes.normal;
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nn.fromBufferAttribute(n, i);
    if (sphereC) {
      // blend toward a normal radiating from the crown centre: soft, volumetric shading
      const s = v.clone().sub(sphereC).multiply(new THREE.Vector3(1, 1.25, 1)).normalize();
      nn.lerp(s, sphereK).normalize();
    }
    P.pos.push(v.x, v.y, v.z);
    P.nor.push(nn.x, nn.y, nn.z);
    P.col.push(...col(v));
    P.bark.push(bark);
  }
}

/** a jagged clump of leaves: a star polygon with leaf-tip lobes, slightly cupped, facing +z */
function clumpGeo(r: number, tips: number, rnd: () => number) {
  const pos: number[] = [];
  const pts: [number, number, number][] = [];
  for (let i = 0; i < tips * 2; i++) {
    const a = (i / (tips * 2)) * Math.PI * 2 + rnd() * 0.2;
    const rr = (i % 2 ? 0.55 + rnd() * 0.15 : 0.9 + rnd() * 0.25) * r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr, -0.18 * r * (rr / r)]);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    pos.push(0, 0, 0.05 * r, ...a, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * One tree, unit scale (crown centre at y ≈ 1.55, radius ≈ 1): `lobes` dark inner masses, `clumps` leaf
 * clumps on the surface, optional trunk with branches into the crown.
 */
function treeGeo(seed: number, lobes: number, clumps: number, trunk: boolean, tips = 6, detail = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const P: Parts = { pos: [], nor: [], col: [], bark: [] };
  const C = new THREE.Vector3(0, 1.55, 0);
  const lobeC: { c: THREE.Vector3; r: number }[] = [];
  for (let k = 0; k < lobes; k++) {
    const a = (k / lobes) * Math.PI * 2 + r();
    const rad = k === 0 ? 0 : 0.4 + r() * 0.22;
    const sc = k === 0 ? 0.72 : 0.46 + r() * 0.16;
    const c = new THREE.Vector3(Math.cos(a) * rad, 1.55 + (k === 0 ? 0.12 : -0.1 + r() * 0.3), Math.sin(a) * rad);
    lobeC.push({ c, r: sc });
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.14 * Math.sin(x * 4.1 + seed + k) * Math.cos(z * 3.7 + y * 2.3);
      p.setXYZ(i, c.x + x * sc * n, c.y + y * sc * 0.78 * n, c.z + z * sc * n);
    }
    let w = mergeVertices(g, 1e-4);
    w.computeVertexNormals();
    w = w.toNonIndexed();
    push(P, w, (v) => { const k2 = 0.32 + 0.3 * Math.min(1, Math.max(0, (v.y - 1.0) / 1.2)); return [k2, k2, k2]; }, 0, C, 0.85);
  }
  // leaf clumps over the outer surface (more on the sunny top and sides than underneath)
  const q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < clumps; i++) {
    const L = lobeC[Math.floor(r() * lobeC.length)];
    const dir = new THREE.Vector3(r() * 2 - 1, r() * 1.6 - 0.5, r() * 2 - 1).normalize();
    const at = L.c.clone().add(dir.clone().multiply(new THREE.Vector3(L.r, L.r * 0.78, L.r)).multiplyScalar(0.92 + r() * 0.12));
    if (at.clone().sub(C).length() < 0.55) continue;
    const g = clumpGeo(0.15 + r() * 0.1, tips, r);
    const face = dir.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
    q.setFromUnitVectors(zAxis, face);
    g.rotateZ(r() * 6.3);
    g.applyQuaternion(q);
    g.translate(at.x, at.y, at.z);
    const hue = r();
    push(P, g, (v) => {
      const k2 = (0.62 + 0.38 * Math.min(1, Math.max(0, (v.y - 0.9) / 1.3))) * (0.85 + hue * 0.3);
      return [k2 * (0.95 + hue * 0.1), k2, k2 * (0.9 + hue * 0.1)];
    }, 0, C, 0.92);
  }
  if (trunk) {
    const t = new THREE.CylinderGeometry(0.04, 0.07, 1.45, 6, 1, true).translate(0, 0.72, 0);
    push(P, t, () => [1, 1, 1], 1);
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + r();
      const br = new THREE.CylinderGeometry(0.018, 0.032, 0.7, 5, 1, true).translate(0, 0.35, 0);
      br.rotateZ(0.7 + r() * 0.3);
      br.rotateY(a);
      br.translate(0, 1.15 + r() * 0.15, 0);
      push(P, br, () => [1, 1, 1], 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
  g.setAttribute('aBark', new THREE.Float32BufferAttribute(P.bark, 1));
  return g;
}

function forestMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBark; varying float vBark; varying vec3 vFW;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vBark = aBark;
        {
          mat4 mm = modelMatrix;
          #ifdef USE_INSTANCING
            mm = modelMatrix * instanceMatrix;
          #endif
          vFW = (mm * vec4(transformed, 1.0)).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vBark; varying vec3 vFW;
        float fh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float fn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          if (vBark > 0.5) diffuseColor.rgb = vec3(0.045, 0.038, 0.032) * (0.6 + 0.8 * fn(vFW * vec3(9.0, 1.2, 9.0)));
          else {
            // individual leaves: fine speckle of lit and shadowed leaves over the clumps
            float cl = fn(vFW * 2.3) * 0.5 + fn(vFW * 7.1) * 0.3 + fn(vFW * 19.0) * 0.2;
            diffuseColor.rgb *= vColor.rgb * (0.62 + 0.6 * smoothstep(0.25, 0.8, cl));
          }
        #endif`);
  };
  m.envMapIntensity = 0.45;
  m.customProgramCacheKey = () => 'bhima-forest2';
  return m;
}

export function buildForest(root: THREE.Group) {
  const mat = forestMaterial();
  const geoB = [treeGeo(51, 3, 5, true, 5, 0)];
  const geoC = [treeGeo(71, 1, 0, false, 6, 0)];
  let seed = 424242;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);

  type Inst = { m: THREE.Matrix4; c: THREE.Color };
  const SECT = 8;
  const rings: { geo: THREE.BufferGeometry[]; r0: number; r1: number; n: number; shadow: boolean; size: [number, number]; sect: Inst[][][]; yOff?: number; dd?: number }[] = [
    { geo: geoB, r0: 430, r1: 700, n: 1800, shadow: false, size: [10, 15], sect: [] },
    { geo: geoC, r0: 700, r1: 4200, n: 8000, shadow: false, size: [15, 22], sect: [] },
  ];
  for (const ring of rings) {
    ring.sect = ring.geo.map(() => Array.from({ length: SECT }, () => [] as Inst[]));
    let placed = 0;
    for (let tries = 0; tries < ring.n * 12 && placed < ring.n; tries++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(ring.r0 * ring.r0 + r() * (ring.r1 * ring.r1 - ring.r0 * ring.r0));
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const [dd] = design(x, z);
      if (dd < (ring.dd ?? 4)) continue;
      const h = terrainH(x, z);
      const e = 5;
      const sl = Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
      if (sl > 1.25) continue;
      const meadow = fbm(x / 300 + 7, z / 300 - 3, 3);
      let dens = 0.95 - Math.max(0, meadow - 0.55) * 2.4 - (sl > 0.9 ? 0.5 : 0);
      if (h < -520) dens = 0.25 + 0.6 * Math.max(0, fbm(x / 160, z / 160, 3) - 0.45) * 2;
      if (dd < 25) dens *= 0.6;
      if (r() > dens) continue;
      if (ring.yOff !== undefined && r() < 0.15) continue;
      const big = ring.r0 < 70 && r() < 0.08;
      const sz = (ring.size[0] + r() * (ring.size[1] - ring.size[0])) * (big ? 1.6 : 1);
      const [cx, cy, cz] = compress(x, h - 0.4 + (ring.yOff ?? 0) * (ring.size[0] + ring.size[1]) * 0.5, z);
      const k = Math.hypot(cx, cz) / Math.max(1, Math.hypot(x, z));
      q.setFromAxisAngle(up, r() * 6.3);
      const tall = 1.05 + r() * 0.45 + (big ? 0.15 : 0);
      m4.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(sz * k, sz * k * tall, sz * k));
      // deep evergreen greens, some yellow-green, a few red-brown flushes of new leaves
      const pick = r();
      if (pick < 0.06) c.setHSL(0.04 + r() * 0.04, 0.4, 0.085 + r() * 0.03);
      else if (pick < 0.22) c.setHSL(0.2 + r() * 0.04, 0.45, 0.09 + r() * 0.04);
      else c.setHSL(0.25 + r() * 0.07, 0.45 + r() * 0.2, 0.07 + r() * 0.05);
      const gi = Math.floor(r() * ring.geo.length);
      const si = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * SECT) % SECT;
      ring.sect[gi][si].push({ m: m4.clone(), c: c.clone() });
      placed++;
    }
  }
  const meshes: THREE.InstancedMesh[] = [];
  for (const ring of rings) {
    ring.geo.forEach((geo, gi) => {
      for (const list of ring.sect[gi]) {
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = ring.shadow;
        im.receiveShadow = ring.r0 < 200;
        im.computeBoundingSphere();
        im.name = 'forest';
        root.add(im);
        meshes.push(im);
      }
    });
  }
  return meshes;
}


/**
 * Monsoon mist: soft cloud banks lying in the valleys below the plateau and drifting along the escarpment.
 * A handful of large alpha-blended sheets with a procedural noise texture (no transmission, no overdraw near
 * the pilgrim).
 */
export function buildMist(root: THREE.Group) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S - 0.5, v = y / S - 0.5;
    const rr = Math.hypot(u, v) * 2;
    const n = fbm(x / 22, y / 22, 5);
    const a = Math.max(0, Math.min(1, (n - 0.35) * 2.2)) * Math.max(0, 1 - Math.pow(rr, 2.2));
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55, color: 0xe4ebec, fog: false, side: THREE.DoubleSide });
  const sheets: THREE.Mesh[] = [];
  let s = 99;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2, rad = 450 + r() * 2600;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const h = terrainH(x, z);
    // lie in the valleys: just above the ground there, below the plateau rim
    const y = Math.min(h + 25 + r() * 60, -30 - r() * 80);
    const [cx, cy, cz] = compress(x, y, z);
    const sz = 500 + r() * 900;
    parts.push(geo.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI), new THREE.Vector3(sz, 1, sz * (0.4 + r() * 0.3)))));
  }
  // one draw for all the banks
  const banks = new THREE.Mesh(mergeGeometries(parts, false)!, mat);
  banks.renderOrder = -1;
  banks.frustumCulled = false;
  root.add(banks);
  sheets.push(banks);
  return {
    update(t: number) {
      for (const m of sheets) m.rotation.y = Math.sin(t * 0.01) * 0.02; // the banks drift, very slowly
    },
  };
}

/**
 * The trees round the hollow (the ~200 nearest the pilgrim) in the leaf-card technique of the Mahakaleshwar
 * site: a tapered trunk with limbs, a dark inner crown volume, and a few hundred alpha-tested cards of
 * painted leaf clusters whose normals radiate from the crown centre, so the crown shades as one soft, lush
 * mass. One trunk, one core and one card geometry per species, instanced.
 */
function leafTexture(seed: number, greens: string[], kind: 'broad' | 'long') {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const leaf = (x: number, y: number, sz: number, a: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col;
    g.beginPath();
    const w = kind === 'broad' ? 0.55 : 0.28;
    g.moveTo(0, 0);
    g.quadraticCurveTo(-sz * w, -sz * 0.9, 0, -sz * 2);
    g.quadraticCurveTo(sz * w, -sz * 0.9, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(15,35,8,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -sz * 1.8); g.stroke();
    g.restore();
  };
  for (let i = 0; i < 95; i++) {
    const rr = Math.sqrt(r()) * 104, a = r() * Math.PI * 2;
    leaf(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 13 + r() * 9, a + Math.PI / 2 + (r() - 0.5) * 1.3, greens[Math.floor(r() * greens.length)]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function cardCrown(seed: number, nCards: number, squash: number, cardScale = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cards: THREE.BufferGeometry[] = [];
  const C = new THREE.Vector3(0, 0.66, 0);
  // a crown of 3–4 overlapping lobes (unit tree 1 m tall, crown radius ~0.36)
  const lobes = [C.clone(), ...[0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + r();
    return new THREE.Vector3(Math.cos(a) * 0.16, 0.62 + r() * 0.08, Math.sin(a) * 0.16);
  })];
  for (let i = 0; i < nCards; i++) {
    const L = lobes[i % lobes.length];
    const dir = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    const rr = 0.26 * (0.55 + 0.45 * Math.pow(r(), 0.6));
    const pos = new THREE.Vector3(L.x + dir.x * rr, L.y + dir.y * rr * squash, L.z + dir.z * rr);
    const size = (0.13 + r() * 0.08) * cardScale;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateZ(r() * Math.PI * 2);
    card.lookAt(dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.5) * 1.2, (r() - 0.5) * 1.2)));
    card.translate(pos.x, pos.y, pos.z);
    const n = card.attributes.normal, p = card.attributes.position;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(p.getX(k) - C.x, (p.getY(k) - C.y) / squash, p.getZ(k) - C.z).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    // the card's index: the shadow pass draws only every few cards (see crownShadowDepth)
    card.setAttribute('aCard', new THREE.Float32BufferAttribute(new Array(p.count).fill(i), 1));
    cards.push(card);
  }
  return mergeGeometries(cards)!;
}

function trunkGeo(seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(0.022 + 0.026 * Math.pow(1 - Math.min(1, t * 4), 2) - 0.008 * t, t * 0.62)); }
  const parts: THREE.BufferGeometry[] = [new THREE.LatheGeometry(prof, 8).toNonIndexed()];
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2 + r();
    const br = new THREE.CylinderGeometry(0.006, 0.013, 0.24, 5, 1, true).translate(0, 0.12, 0);
    br.rotateZ(0.6 + r() * 0.35); br.rotateY(a); br.translate(0, 0.42 + r() * 0.1, 0);
    parts.push(br.toNonIndexed());
  }
  for (const q of parts) q.deleteAttribute('uv');
  const g = mergeGeometries(parts)!;
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.08; uv[i * 2 + 1] = p.getY(i) * 5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * The sun-shadow depth material of the near crowns: every card that is not one in `keep` is collapsed to a
 * point in the vertex shader, so the 4096² shadow map gets a fraction of the leaf-card overdraw (the crowns
 * overlap themselves ~15 deep from the sun) while the shadow still reads as a dappled crown.
 */
const SHADOW_KEEP = 8;
function crownShadowDepth(keep: number) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCard;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (mod(aCard + 0.5, ${keep.toFixed(1)}) > 1.0) transformed = vec3(0.0);`);
  };
  m.customProgramCacheKey = () => 'bhima-crown-shadow' + keep;
  return m;
}

export function buildCardTrees(root: THREE.Group, pending: Promise<unknown>[]) {
  let seed = 9091;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // round 3: a closed canopy out to ~230 m (crown spacing ≤ crown diameter), all leaf cards — no faceted trees
  const spots: { x: number; y: number; z: number; h: number; ry: number; sp: number; hue: number }[] = [];
  const cell = 8, grid = new Map<string, { x: number; z: number }[]>();
  const near = (x: number, z: number, d: number) => {
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const p of grid.get(`${gx + i},${gz + j}`) ?? []) if (Math.hypot(p.x - x, p.z - z) < d) return true;
    }
    return false;
  };
  for (let tries = 0; tries < 60000 && spots.length < 1500; tries++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(17 * 17 + r() * (230 * 230 - 17 * 17));
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const [dd] = design(x, z);
    if (dd < 2.5) continue;
    if (near(x, z, dd < 12 ? 6.5 : 7.2)) continue;
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push({ x, z });
    spots.push({ x, y: terrainH(x, z) - 0.3, z, h: 13 + r() * 8, ry: r() * 6.3, sp: Math.floor(r() * 3), hue: r() });
  }
  const species = [
    // jamun / mango: broad dark-glossy crowns
    { crown: cardCrown(3, 125, 0.75, 1.4), tex: leafTexture(5, ['#2f5a1c', '#3b6e22', '#4a8228', '#579330', '#2a4f18', '#68a238'], 'broad') },
    // hirda / anjani: rounder, brighter
    { crown: cardCrown(7, 120, 0.85, 1.4), tex: leafTexture(11, ['#3f7322', '#4f8a28', '#5f9e30', '#73b23a', '#355f1c'], 'broad') },
    // a few with narrow leaves and a reddish flush of new growth
    { crown: cardCrown(13, 120, 0.7, 1.4), tex: leafTexture(17, ['#3a6a20', '#4c7f26', '#8a5a2a', '#a8683a', '#5a8a2c'], 'long') },
  ];
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 0.95 });
  pending.push(new THREE.TextureLoader().loadAsync('assets/tex/bark_brown_02_diff.webp').then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; bark.map = t; bark.color.set(0x9a9086); bark.needsUpdate = true;
  }));
  const tg = trunkGeo(21);
  const coreGeo = new THREE.SphereGeometry(1, 8, 5).scale(0.26, 0.18, 0.26).translate(0, 0.66, 0);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x1a3010, roughness: 1 });
  const grp = new THREE.Group();
  grp.name = 'card-trees';
  root.add(grp);
  const mats = spots.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), new THREE.Vector3(p.h * (0.95 + (p.ry % 0.3)), p.h, p.h * (0.95 + (p.ry % 0.25)))));
  // only the crowns round the temple and the spawn cast sun shadows; the rest are cheaper, unshadowed and
  // binned in quadrants so whole quadrants are frustum-culled
  const nearSet = spots.map((p) => Math.hypot(p.x, p.z) < 95 || Math.hypot(p.x - 129, p.z + 22) < 45);
  const SECT = 4;
  const sectOf = (p: { x: number; z: number }) => Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI * 2)) * SECT) % SECT;
  // three hue variants per crown: yellow-green (#6f9a3a), mid, and dark (#2f5a22)
  const hues: [number, number, number][] = [[0.23, 0.42, 0.74], [0.27, 0.3, 0.64], [0.3, 0.32, 0.5]];
  const hueOf = (i: number) => {
    const [hh, ss, ll] = hues[Math.floor(spots[i].hue * 3)];
    return new THREE.Color().setHSL(hh + (spots[i].ry % 0.03), ss, ll + (spots[i].h % 0.08));
  };
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, idx: number[], shadow: boolean, colour = false) => {
    if (!idx.length) return;
    const im = new THREE.InstancedMesh(geo, mat, idx.length);
    idx.forEach((i, k) => { im.setMatrixAt(k, mats[i]); if (colour) im.setColorAt(k, hueOf(i)); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    grp.add(im);
    return im;
  };
  const all = spots.map((_, i) => i);
  const shadowDepth = crownShadowDepth(SHADOW_KEEP);
  inst(tg, bark, all.filter((i) => nearSet[i]), true);
  inst(tg, bark, all.filter((i) => !nearSet[i]), false);
  inst(coreGeo, coreMat, all, false);
  species.forEach((sp, si) => {
    const mat = new THREE.MeshStandardMaterial({ map: sp.tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.6 });
    const im = inst(sp.crown, mat, all.filter((i) => nearSet[i] && spots[i].sp === si), true, true);
    if (im) im.customDepthMaterial = shadowDepth;
  });
  {
    const crown = cardCrown(29, 64, 0.78, 1.8);
    const mat = new THREE.MeshStandardMaterial({ map: species[0].tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.6 });
    for (let q = 0; q < SECT; q++) inst(crown, mat, all.filter((i) => !nearSet[i] && sectOf(spots[i]) === q), false, true);
  }
  // round 3: the next ring out (230–440 m) in cheap leaf cards too (no faceted 'lollipops' on the near hills):
  // 48 big cards over a dark core per crown, no trunk (hidden under the closed canopy at this range)
  {
    const crown = cardCrown(23, 32, 0.75, 2.4);
    const core = new THREE.SphereGeometry(1, 6, 4).scale(0.3, 0.2, 0.3).translate(0, 0.62, 0);
    const S2 = 2, sect2 = (p: { x: number; z: number }) => (p.z > 0 ? 1 : 0);
    const lists: THREE.Matrix4[][] = Array.from({ length: S2 }, () => []);
    const cols: THREE.Color[][] = Array.from({ length: S2 }, () => []);
    let n = 0;
    for (let tries = 0; tries < 20000 && n < 1700; tries++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(230 * 230 + r() * (440 * 440 - 230 * 230));
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (design(x, z)[0] < 4) continue;
      const hgt = terrainH(x, z), e = 5;
      const sl = Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
      if (sl > 1.25) continue;
      const h = 15 + r() * 7, q = sect2({ x, z });
      lists[q].push(new THREE.Matrix4().compose(new THREE.Vector3(x, hgt - 0.5, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3), new THREE.Vector3(h * 1.1, h, h * 1.1)));
      const [hh, ss, ll] = hues[Math.floor(r() * 3)];
      cols[q].push(new THREE.Color().setHSL(hh, ss, ll));
      n++;
    }
    const cm = new THREE.MeshStandardMaterial({ map: species[0].tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.5 });
    lists.forEach((l, q) => {
      if (!l.length) return;
      for (const [geo, mat] of [[crown, cm], [core, coreMat]] as const) {
        const im = new THREE.InstancedMesh(geo, mat, l.length);
        l.forEach((m, i) => { im.setMatrixAt(i, m); if (geo === crown) im.setColorAt(i, cols[q][i]); });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.receiveShadow = false;
        im.computeBoundingSphere();
        grp.add(im);
      }
    });
  }
  // the understory: low card shrubs and saplings between the trunks (replaces the faceted shrubs)
  {
    const shrub = cardCrown(19, 50, 0.6, 1.4).translate(0, -0.45, 0);
    const mat = new THREE.MeshStandardMaterial({ map: species[1].tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.5 });
    const list: THREE.Matrix4[][] = Array.from({ length: 2 }, () => []);
    let n = 0;
    for (let tries = 0; tries < 6000 && n < 900; tries++) {
      const a = r() * Math.PI * 2, rad = 15 + Math.sqrt(r()) * 200;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (design(x, z)[0] < 1.5) continue;
      const h = 2 + r() * 3;
      list[z > 0 ? 1 : 0].push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainH(x, z), z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3), new THREE.Vector3(h * 1.3, h, h * 1.3)));
      n++;
    }
    for (const l of list) {
      if (!l.length) continue;
      const im = new THREE.InstancedMesh(shrub, mat, l.length);
      l.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color().setHSL(0.25 + r() * 0.05, 0.35, 0.55 + r() * 0.15)); });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      grp.add(im);
    }
  }
  return spots;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './batch';

/**
 * Offerings that read as real flowers and leaves rather than beads: ruffled marigold heads
 * (genda) in orange–yellow, red rose petals, white tagar blossoms and trifoliate bel leaves.
 * Everything is instanced: one draw call per kind.
 */

const r = rng(97);

/** a marigold head: a dome of many short ruffled petals (≈ 5 cm across before scaling) */
function marigoldGeo() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), e = Math.asin(Math.max(-1, Math.min(1, v.y)));
    const ruffle = 1 + 0.16 * Math.abs(Math.sin(a * 9 + e * 7)) * Math.abs(Math.sin(e * 11 + a * 3)) - 0.08 * Math.abs(Math.sin(a * 23));
    v.multiplyScalar(ruffle);
    if (v.y < 0) v.y *= 0.45; // flattened underside, as the head sits on its calyx
    p.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  g.computeVertexNormals();
  return g.scale(0.026, 0.026, 0.026);
}

/** a trifoliate bel (bilva) leaf: three pointed leaflets on a short stalk */
function belGeo() {
  const leaf = (len: number, wid: number, ang: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(wid, len * 0.45, 0, len);
    s.quadraticCurveTo(-wid, len * 0.45, 0, 0);
    const g = new THREE.ShapeGeometry(s, 6);
    // a little cupping along the midrib
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.35);
    g.rotateZ(ang);
    return g;
  };
  const g = mergeGeometries([leaf(0.075, 0.025, 0), leaf(0.06, 0.022, 1.15), leaf(0.06, 0.022, -1.15)])!;
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** a curled rose petal */
function petalGeo() {
  const g = new THREE.CircleGeometry(0.018, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, (x * x + y * y) * 18);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** small white five-petalled blossom (tagar / kaner) */
function blossomGeo() {
  const s = new THREE.Shape();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const rr = 0.012 + 0.01 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.6);
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ShapeGeometry(s, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

export interface Offerings {
  marigold(pos: THREE.Vector3, scale?: number, normal?: THREE.Vector3): void;
  bel(pos: THREE.Vector3, normal?: THREE.Vector3): void;
  petal(pos: THREE.Vector3, normal?: THREE.Vector3): void;
  blossom(pos: THREE.Vector3, normal?: THREE.Vector3): void;
  /** a strung marigold garland from a to b, sagging, flowers touching; leaves knotted in every so often */
  garland(a: THREE.Vector3, b: THREE.Vector3, sag: number, size?: number): void;
  /** a loop garland around a centre (e.g. round the rock's foot) */
  loop(c: THREE.Vector3, rx: number, rz: number, y: number, size?: number): void;
  flush(): void;
}

export function offerings(parent: THREE.Object3D, env?: THREE.Texture | null): Offerings {
  const mats = {
    marigold: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, emissive: 0x2a0a00, emissiveIntensity: 0.6 }),
    bel: new THREE.MeshStandardMaterial({ color: 0x3d6b22, roughness: 0.45, side: THREE.DoubleSide }),
    petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }),
    blossom: new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x201a10 }),
  };
  if (env) for (const m of Object.values(mats)) { m.envMap = env; m.envMapIntensity = 0.8; }
  type Item = { m: THREE.Matrix4; c?: THREE.Color };
  const lists: Record<keyof typeof mats, Item[]> = { marigold: [], bel: [], petal: [], blossom: [] };
  const up = new THREE.Vector3(0, 1, 0);
  const place = (pos: THREE.Vector3, s: number, normal = up, spin = r() * Math.PI * 2) => {
    const q = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(up, spin));
    return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s));
  };
  const marigoldCol = () => new THREE.Color().setHSL(0.07 + r() * 0.045, 1, 0.42 + r() * 0.1);
  const api: Offerings = {
    marigold(pos, scale = 1, normal) {
      lists.marigold.push({ m: place(pos, scale * (0.85 + r() * 0.3), normal), c: marigoldCol() });
    },
    bel(pos, normal) {
      lists.bel.push({ m: place(pos, 0.9 + r() * 0.4, normal) });
    },
    petal(pos, normal) {
      lists.petal.push({ m: place(pos, 0.8 + r() * 0.5, normal), c: new THREE.Color().setHSL(0.98 + r() * 0.03, 0.85, 0.28 + r() * 0.1) });
    },
    blossom(pos, normal) {
      lists.blossom.push({ m: place(pos, 0.8 + r() * 0.5, normal) });
    },
    garland(a, b, sag, size = 1) {
      const len = a.distanceTo(b) + sag * 1.3;
      const n = Math.max(2, Math.floor(len / (0.042 * size)));
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * sag;
        p.x += (r() - 0.5) * 0.01; p.z += (r() - 0.5) * 0.01;
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        lists.marigold.push({ m: place(p, size * (0.85 + r() * 0.3), dir), c: marigoldCol() });
        if (i % 11 === 5) lists.bel.push({ m: place(p.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.8, dir) });
      }
    },
    loop(c, rx, rz, y, size = 1) {
      const n = Math.floor((Math.PI * (rx + rz)) / (0.042 * size));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const p = new THREE.Vector3(c.x + Math.cos(a) * rx, y + (r() - 0.5) * 0.015, c.z + Math.sin(a) * rz);
        lists.marigold.push({ m: place(p, size * (0.85 + r() * 0.3), new THREE.Vector3(r() - 0.5, 1, r() - 0.5)), c: marigoldCol() });
      }
    },
    flush() {
      const geos = { marigold: marigoldGeo(), bel: belGeo(), petal: petalGeo(), blossom: blossomGeo() };
      for (const k of Object.keys(lists) as (keyof typeof mats)[]) {
        const items = lists[k];
        if (!items.length) continue;
        const inst = new THREE.InstancedMesh(geos[k], mats[k], items.length);
        items.forEach((it, i) => {
          inst.setMatrixAt(i, it.m);
          if (it.c) inst.setColorAt(i, it.c);
        });
        inst.castShadow = false;
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        parent.add(inst);
      }
    },
  };
  return api;
}

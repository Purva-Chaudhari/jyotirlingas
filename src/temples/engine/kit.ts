import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { worldUV } from './materials';

/** Diya flame positions (rendered as flickering sprites) and point lights that flicker with them. */
export interface Flames {
  points: THREE.Vector3[];
  lights: THREE.PointLight[];
}

/** Collision + walkable surfaces collected while building. */
export class Physics {
  solids: THREE.Box3[] = [];
  floors: THREE.Object3D[] = [];
  private floorMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });

  solid(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    this.solids.push(new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ)));
  }

  /** Invisible walkable quad (or ramp) from (x0,y0,z0) to (x1,y1,z1), slope along z. */
  floor(parent: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, y0: number, y1 = y0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      x0, y0, z0, x1, y0, z0, x1, y1, z1, x0, y1, z1,
    ]), 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.floorMat);
    parent.add(m);
    this.floors.push(m);
  }
}

// ---------- basic solids ----------

export function box(
  parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number,
  x: number, y: number, z: number, phys?: Physics, tile = 3,
): THREE.Mesh {
  const bevel = Math.min(0.035, w / 4, h / 4, d / 4);
  const m = new THREE.Mesh(worldUV(new RoundedBoxGeometry(w, h, d, 2, bevel), tile), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  phys?.solid(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
  return m;
}

// ---------- column ----------

/** Maratha-style pillar: square pedestal, banded shaft, bell capital and bracket. */
export function columnGeometry(h: number, r: number): THREE.BufferGeometry {
  const p: [number, number][] = [
    [0, 0], [r * 1.35, 0], [r * 1.35, 0.06 * h], [r * 1.15, 0.08 * h], [r * 1.2, 0.1 * h], [r, 0.13 * h],
  ];
  for (let k = 0; k < 4; k++) {
    const y = 0.22 * h + k * 0.14 * h;
    p.push([r * 0.92, y - 0.02 * h], [r * 1.08, y], [r * 1.08, y + 0.02 * h], [r * 0.9, y + 0.04 * h]);
  }
  p.push([r * 0.86, 0.8 * h], [r * 1.15, 0.85 * h], [r * 1.25, 0.9 * h], [r * 0.95, 0.93 * h], [r * 1.5, 0.95 * h], [r * 1.5, h], [0, h]);
  const lathe = new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), 12);
  const pedestal = new THREE.BoxGeometry(r * 3, 0.07 * h, r * 3).translate(0, 0.035 * h, 0);
  const bracket = new THREE.BoxGeometry(r * 4.2, 0.05 * h, r * 1.6).translate(0, h - 0.025 * h, 0);
  const geo = mergeGeometries([lathe.toNonIndexed(), pedestal.toNonIndexed(), bracket.toNonIndexed()])!;
  return worldUV(geo, 2);
}

export function columns(
  parent: THREE.Object3D, mat: THREE.Material, pts: [number, number][], y: number, h: number, r: number, phys?: Physics,
) {
  const inst = new THREE.InstancedMesh(columnGeometry(h, r), mat, pts.length);
  pts.forEach(([x, z], i) => {
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z));
    phys?.solid(x - r * 1.3, y, z - r * 1.3, x + r * 1.3, y + h, z + r * 1.3);
  });
  inst.castShadow = inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}

// ---------- cusped (multifoil) arch panel ----------

/** A wall panel spanning `span` with a scalloped Maratha arch cut out; lies in the XY plane. */
export function archPanelGeometry(span: number, height: number, depth: number, cusps = 7): THREE.BufferGeometry {
  // one outline: along the scalloped intrados, then round the outside of the panel
  const s = new THREE.Shape();
  const w = span / 2 - 0.04, rise = height * 0.72;
  s.moveTo(-span / 2, 0);
  s.lineTo(-w, 0);
  const N = 70;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const a = Math.PI * (1 - t);
    const bx = Math.cos(a) * w;
    const by = Math.pow(Math.sin(a), 0.8) * rise;
    const cusp = Math.pow(Math.abs(Math.sin(t * Math.PI * cusps)), 0.6) * 0.06 * span;
    s.lineTo(bx * (1 - (cusp / w) * 0.4), Math.max(0.05, by - cusp));
  }
  s.lineTo(w, 0);
  s.lineTo(span / 2, 0);
  s.lineTo(span / 2, height);
  s.lineTo(-span / 2, height);
  s.lineTo(-span / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return worldUV(g, 2);
}

/** Arches filling the bays between consecutive column positions along a straight row. */
export function archRow(
  parent: THREE.Object3D, mat: THREE.Material, pts: [number, number][], y: number, height: number, depth: number, colR: number,
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const span = Math.hypot(x1 - x0, z1 - z0) - colR * 2.2;
    const m = new THREE.Mesh(archPanelGeometry(span, height, depth), mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
  }
}

// ---------- balustrade ----------

export function balustrade(parent: THREE.Object3D, mat: THREE.Material, a: [number, number], b: [number, number], y: number, h = 0.95, phys?: Physics) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.floor(len / 0.22));
  const prof = [[0, 0], [0.06, 0], [0.06, 0.08], [0.04, 0.12], [0.075, 0.3], [0.045, 0.55], [0.035, 0.62], [0.06, 0.7], [0.06, 0.78], [0, 0.78]];
  const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy * h)), 8);
  const inst = new THREE.InstancedMesh(g, mat, n);
  const ang = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(a[0] + (b[0] - a[0]) * t, y + 0.06, a[1] + (b[1] - a[1]) * t));
  }
  inst.castShadow = true;
  parent.add(inst);
  const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
  for (const [yy, hh] of [[y, 0.08], [y + h * 0.8, 0.12]] as const) {
    const rail = new THREE.Mesh(worldUV(new THREE.BoxGeometry(len, hh, 0.2), 2), mat);
    rail.position.set(cx, yy + hh / 2, cz);
    rail.rotation.y = ang;
    rail.castShadow = rail.receiveShadow = true;
    parent.add(rail);
  }
  if (phys) {
    const minX = Math.min(a[0], b[0]) - 0.12, maxX = Math.max(a[0], b[0]) + 0.12;
    const minZ = Math.min(a[1], b[1]) - 0.12, maxZ = Math.max(a[1], b[1]) + 0.12;
    phys.solid(minX, y, minZ, maxX, y + h, maxZ);
  }
}

// ---------- chhajja (sloped eave) ----------

/** Sloping stone eave around a w×d rectangle, projecting `out`, dropping `drop`. */
export function chhajja(parent: THREE.Object3D, mat: THREE.Material, w: number, d: number, y: number, out: number, drop: number, thick = 0.12) {
  const hw = w / 2, hd = d / 2, ow = hw + out, od = hd + out;
  const top = [[-hw, y, -hd], [hw, y, -hd], [hw, y, hd], [-hw, y, hd]];
  const bot = [[-ow, y - drop, -od], [ow, y - drop, -od], [ow, y - drop, od], [-ow, y - drop, od]];
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], dd: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...dd);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(top[i], bot[i], bot[j], top[j]);
    // underside and fascia
    const bi = [bot[i][0], bot[i][1] - thick, bot[i][2]], bj = [bot[j][0], bot[j][1] - thick, bot[j][2]];
    quad(bot[j], bot[i], bi, bj);
    const ti = [top[i][0], top[i][1] - thick * 2, top[i][2]], tj = [top[j][0], top[j][1] - thick * 2, top[j][2]];
    quad(bj, bi, ti, tj);
  }
  // emit every triangle twice (both windings) so the eave is visible from above and below
  // with the caller's own material — no clone, so late-loading scanned maps still apply
  const n = pos.length;
  for (let i = 0; i < n; i += 9) pos.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 6], pos[i + 7], pos[i + 8], pos[i + 3], pos[i + 4], pos[i + 5]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(worldUV(g, 2), mat);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- crown: amalaka, kalash, flag ----------

export function amalaka(parent: THREE.Object3D, mat: THREE.Material, y: number, r: number) {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI;
    prof.push(new THREE.Vector2(r * 0.45 + Math.cos(a) * r * 0.55, y + r * 0.35 + Math.sin(a) * r * 0.35));
  }
  const g = new THREE.LatheGeometry(prof, 64);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const ang = Math.atan2(z, x), rib = 1 + Math.pow(Math.abs(Math.cos(ang * 16)), 3) * 0.06;
    p.setX(i, x * rib);
    p.setZ(i, z * rib);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(worldUV(g, 1), mat);
  m.castShadow = true;
  parent.add(m);
  return y + r * 0.7;
}

export function kalash(parent: THREE.Object3D, gold: THREE.Material, y: number, h: number) {
  const prof: [number, number][] = [[0, 0], [0.32, 0], [0.34, 0.06], [0.22, 0.12], [0.42, 0.3], [0.44, 0.42], [0.3, 0.58],
    [0.16, 0.64], [0.24, 0.7], [0.2, 0.74], [0.1, 0.78], [0.16, 0.86], [0.08, 0.94], [0.03, 1], [0, 1.02]];
  const g = new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r * h, y + yy * h)), 32);
  const m = new THREE.Mesh(g, gold);
  m.castShadow = true;
  parent.add(m);
  return y + h;
}

export class Flag {
  mesh: THREE.Mesh;
  private base: Float32Array;
  constructor(parent: THREE.Object3D, pole: THREE.Material, cloth: THREE.Material, x: number, y: number, z: number, poleH: number) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, poleH, 8), pole);
    p.position.set(x, y + poleH / 2, z);
    parent.add(p);
    // two-tailed saffron dhwaja
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(2.6, -0.3); s.lineTo(1.9, -0.75); s.lineTo(2.4, -1.25); s.lineTo(0, -1.4); s.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(s, 12);
    const seg = new THREE.PlaneGeometry(1, 1); void seg;
    this.mesh = new THREE.Mesh(g, cloth);
    this.mesh.position.set(x + 0.06, y + poleH - 0.05, z);
    this.mesh.castShadow = true;
    parent.add(this.mesh);
    this.base = (g.attributes.position.array as Float32Array).slice();
  }
  update(t: number) {
    const pa = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const bx = this.base[i * 3], by = this.base[i * 3 + 1];
      pa.setZ(i, Math.sin(bx * 2.2 - t * 6 + by) * 0.18 * bx * 0.6);
      pa.setY(i, by - Math.sin(bx * 1.5 - t * 4) * 0.05 * bx);
    }
    pa.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

// ---------- domes and roofs for shrines / chhatris ----------

export function dome(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, r: number, bulb = 1.15) {
  const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, r * 0.1)];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 0.5;
    const rr = r * bulb * Math.cos(a) * (1 - 0.15 * Math.sin(a * 2));
    prof.push(new THREE.Vector2(Math.max(rr, r * 0.08), r * 0.1 + Math.sin(a) * r * 1.2));
  }
  prof.push(new THREE.Vector2(r * 0.18, r * 1.38), new THREE.Vector2(r * 0.05, r * 1.7), new THREE.Vector2(0, r * 1.75));
  const m = new THREE.Mesh(worldUV(new THREE.LatheGeometry(prof, 28), 1.5), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Tiered pyramidal roof (phamsana) like the white shrine roofs beside the temple. */
export function tieredRoof(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, half: number, tiers = 5, tierH = 0.45) {
  let yy = y;
  for (let i = 0; i < tiers; i++) {
    const s = half * (1 - i / (tiers + 1.2));
    const g = new THREE.CylinderGeometry((s * 0.86) * Math.SQRT2, s * Math.SQRT2, tierH, 4, 1).rotateY(Math.PI / 4);
    const m = new THREE.Mesh(worldUV(g, 1.5), mat);
    m.position.set(x, yy + tierH / 2, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    yy += tierH * 1.02;
  }
  const bell = new THREE.Mesh(worldUV(new THREE.SphereGeometry(half * 0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 1), mat);
  bell.position.set(x, yy, z);
  bell.castShadow = true;
  parent.add(bell);
  return yy + half * 0.28;
}

// ---------- marigold garland ----------

export function garland(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, sag: number, beadR = 0.045) {
  const len = a.distanceTo(b);
  const n = Math.floor((len + sag) / (beadR * 1.6));
  const g = new THREE.IcosahedronGeometry(beadR, 1);
  const inst = new THREE.InstancedMesh(g, mat, n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
  }
  parent.add(inst);
  return inst;
}

// ---------- signboard ----------

/** A bilingual signboard sprite (Devanagari line + English line) floating at `pos`. */
export function signSprite(parent: THREE.Object3D, hi: string, en: string, pos: THREE.Vector3, scale = 3.2) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(40,12,4,0.72)';
  g.beginPath();
  g.roundRect(8, 8, 496, 176, 28);
  g.fill();
  g.strokeStyle = '#f5c46b';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#f5c46b';
  g.textAlign = 'center';
  g.font = '800 64px Martel, serif';
  g.fillText(hi, 256, 92, 472); // squeezed, not clipped, when long
  g.fillStyle = '#fbf3e4';
  g.font = '600 38px "Cormorant Garamond", serif';
  g.fillText(en, 256, 150, 472);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(scale, scale * 0.375, 1);
  s.position.copy(pos);
  parent.add(s);
  return s;
}

import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import { lathe, prng, type Merger } from './merge';
import type { SM } from './mats';
import { WALL, TERRACE } from './layout';
import { domeGeo, kalashaGeo, frustum } from './geo';
import { terrainH, compress, designDist, WATER_Y } from './terrain';
import { facadeMaterial } from './facade';
import type { Offerings } from './offerings';

/**
 * Outside the walls: the paved east forecourt with its arched canopy and high-mast light, the temple
 * street of shops running east to Nandi circle (a small yellow Nandi shrine), the blue-roofed queue
 * complex to the south-east, the raised approach to the West gopuram, roads draped on the SRTM
 * ground, and Srisailam town — whitewashed and pastel concrete houses, pilgrim lodges with water
 * tanks on their roofs — spreading over the plateau (instanced; windows drawn in the shader).
 */
export function buildSetting(B: Merger, K: SM, P: Physics, root: THREE.Group, O: Offerings, out: THREE.Group) {
  const rnd = prng(4242);

  // ---- east forecourt and the temple street
  B.span(K.paving, WALL.x1 + 0.95, -0.1, -46, 108, 0, 46);
  B.span(K.paving, 108, -0.1, -10, 222, 0, 10);
  for (const s of [-1, 1]) B.span(K.granite, 108, 0, s > 0 ? 10 : -10.4, 222, 0.15, s > 0 ? 10.4 : -10); // kerbs
  // high-mast light
  B.place(K.steel, new THREE.CylinderGeometry(0.18, 0.4, 28, 10), 98, 14, -30);
  B.place(K.steel, new THREE.TorusGeometry(1.2, 0.08, 6, 16).rotateX(Math.PI / 2), 98, 27.6, -30);
  for (let k = 0; k < 8; k++) B.box(K.lampGlow, 0.5, 0.35, 0.3, 98 + Math.cos(k * 0.785) * 1.2, 27.2, -30 + Math.sin(k * 0.785) * 1.2, false, -k * 0.785);
  P.solid(97.6, 0, -30.4, 98.4, 28, -29.6);
  // signboard arch over the street entrance: "ఓం నమః శివాయ" band on two posts
  for (const s of [-1, 1]) B.box(K.stuccoCream, 0.8, 6.2, 0.8, 112, 0, s * 9.6, true);
  B.box(K.paintedArch, 1.0, 1.2, 20.4, 112, 6.2, 0);
  B.place(K.stuccoCream, frustum(1.0, 20.4, 1.6, 21.2, 0.25), 112, 7.4, 0);
  for (let i = 0; i < 7; i++) B.place(K.gilt, kalashaGeo(0.5, 10), 112, 7.65, -7.5 + i * 2.5);

  // ---- shops along the street (instanced below) with awnings
  const houses: { x: number; z: number; w: number; d: number; h: number; ry: number; c: THREE.Color; tank: boolean }[] = [];
  const shopCols = [0x8a2a22, 0xf0dca8, 0xa8c8dc, 0xf4f1ea, 0xe8b4b4, 0xece6da, 0x9a3428, 0xc8e0b8, 0xf2d48a, 0xb8d4dc];
  const awn: { x: number; z: number; w: number; c: THREE.Color; s: number }[] = [];
  for (const s of [-1, 1]) {
    let x = 116;
    while (x < 214) {
      const w = 4.5 + rnd() * 4;
      const d = 9 + rnd() * 4;
      const fl = 1 + Math.floor(rnd() * 3);
      houses.push({ x: x + w / 2, z: s * (11.2 + d / 2), w, d, h: fl * 3.3 + 0.6, ry: 0, c: new THREE.Color(shopCols[Math.floor(rnd() * shopCols.length)]), tank: rnd() < 0.5 });
      awn.push({ x: x + w / 2, z: s * 11.2, w: w - 0.3, s, c: new THREE.Color([0x2f62b0, 0xb8322a, 0xe8e2d4, 0x2f8a4a][Math.floor(rnd() * 4)]) });
      x += w + (rnd() < 0.15 ? 3 : 0.1);
    }
  }
  for (const s of [-1, 1]) for (let x = 96; x < 107; x += 5) houses.push({ x, z: s * (49 + rnd() * 3), w: 4.6, d: 8, h: 4.0, ry: 0, c: new THREE.Color(shopCols[Math.floor(rnd() * shopCols.length)]), tank: false });

  // ---- Nandi circle: a round plinth with a small yellow domed pavilion sheltering Nandi
  const nx = 236, nr = 9;
  B.place(K.granite, new THREE.CylinderGeometry(nr, nr + 0.3, 0.45, 48), nx, 0.225, 0);
  B.place(K.paving, new THREE.CylinderGeometry(nr + 9, nr + 9, 0.1, 64), nx, -0.05, 0);
  B.box(K.stuccoCream, 4.2, 0.9, 4.2, nx, 0.45, 0, true);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) B.box(K.stuccoCream, 0.45, 3.0, 0.45, nx + a * 1.7, 1.35, b * 1.7);
  B.box(K.stuccoCream, 4.4, 0.45, 4.4, nx, 4.35, 0);
  B.place(K.stuccoCream, frustum(4.4, 4.4, 5.0, 5.0, 0.25), nx, 4.8, 0);
  B.place(K.stuccoCream, domeGeo(1.9, 1.15, 4, 1.06, Math.PI / 4), nx, 5.05, 0);
  B.place(K.gilt, kalashaGeo(0.9, 12), nx, 7.15, 0);
  P.solid(nx - nr, 0, -nr, nx + nr, 0.45, nr);
  P.floor(root, 222, 254, -18, 18, 0);

  // ---- queue complex: blue-roofed sheds south-east of the temple
  const qx0 = 72, qz0 = 22;
  for (let k = 0; k < 4; k++) {
    const x0 = qx0 + k * 15.5, x1 = x0 + 14, z0 = qz0, z1 = qz0 + 58, eave = 6.0, ridge = 8.2;
    for (let z = z0; z <= z1 + 0.01; z += 6) for (const x of [x0, x1]) B.span(K.steel, x - 0.15, 0, z - 0.15, x + 0.15, eave, z + 0.15, true);
    B.span(K.whiteCloth, x0, 0, z0, x1, 1.2, z0 + 0.2);
    for (const s of [-1, 1]) {
      const w = Math.hypot((x1 - x0) / 2 + 0.6, ridge - eave);
      const g = new THREE.PlaneGeometry(w, z1 - z0 + 1.2).rotateX(-Math.PI / 2).rotateZ(s * Math.atan2(ridge - eave, (x1 - x0) / 2));
      B.place(K.blueRoof, g, (x0 + x1) / 2 - s * ((x1 - x0) / 4 + 0.15), (eave + ridge) / 2, (z0 + z1) / 2);
    }
  }
  // the covered corridor from the queue complex to the east gate
  for (let x = 66.5; x <= 72; x += 2.75) for (const z of [14, 20]) B.span(K.steel, x - 0.1, 0, z - 0.1, x + 0.1, 3.6, z + 0.1);
  B.span(K.blueRoof, 66, 3.6, 13.5, 72.5, 3.7, 20.5);

  // ---- raised approach to the West gopuram (terrace level outside the wall)
  const wa = { x0: -124, x1: WALL.x0 - 6.9, z0: -28, z1: -4 };
  B.span(K.granite, wa.x0, 0, wa.z0, wa.x1, TERRACE.h - 0.05, wa.z1);
  B.span(K.paving, wa.x0, TERRACE.h - 0.05, wa.z0, wa.x1, TERRACE.h, wa.z1);
  P.floor(root, wa.x0, wa.x1 + 0.01, wa.z0, wa.z1, TERRACE.h);
  P.floor(root, wa.x1 - 0.01, TERRACE.x0 + 0.01, -18.2, -13.8, TERRACE.h); // through the West gopuram
  B.span(K.paving, wa.x1, TERRACE.h - 0.3, -18.2, TERRACE.x0, TERRACE.h + 0.004, -13.8);
  for (const z of [wa.z0 + 0.2, wa.z1 - 0.2]) P.solid(wa.x0, TERRACE.h, z - 0.2, wa.x1, TERRACE.h + 1.0, z + 0.2);
  // the curved canopy in front of the West gopuram (as photographed, 2025)
  for (const z of [-23.5, -8.5]) for (const x of [wa.x1 - 0.5, wa.x1 - 9]) B.span(K.steel, x - 0.12, TERRACE.h, z - 0.12, x + 0.12, TERRACE.h + 5.2, z + 0.12, true);
  B.place(K.canopy, new THREE.CylinderGeometry(8.6, 8.6, 10.5, 28, 1, true, -1.06, 2.12).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), wa.x1 - 4.8, TERRACE.h + 5.2 - 8.6 * Math.cos(1.06) + 0.1, -16);

  // ---- roads draped on the ground
  const roads: [number, number][][] = [
    [[254, 0], [330, 6], [420, 30], [520, 80], [640, 120], [800, 170], [1000, 240], [1300, 380]],
    [[-400, -150], [-200, -148], [-60, -146], [60, -146], [200, -150], [330, -130], [420, -60], [440, 30], [420, 30]],
    [[-112, 100], [-112, -128], [60, -128], [140, -128], [200, -146]],
    [[-112, 100], [60, 100], [140, 100], [200, 120], [236, 18]],
    [[-112, -16], [-160, -20], [-260, -40], [-400, -150]],
    [[-400, -150], [-600, -180], [-800, -260], [-1100, -300]],
    [[80, 150], [60, 300], [20, 480], [-40, 700], [-120, 1000]],
  ];
  const roadW = 8;
  const roadGeo: THREE.BufferGeometry[] = [];
  const nearRoad = (x: number, z: number, m: number) => {
    for (const r of roads) for (let i = 0; i < r.length - 1; i++) {
      const [ax, az] = r[i], [bx, bz] = r[i + 1];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < m) return true;
    }
    return false;
  };
  for (const r of roads) {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, az] = r[i], [bx, bz] = r[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 6));
      for (let k = 0; k < n; k++) pts.push(new THREE.Vector2(ax + (bx - ax) * (k / n), az + (bz - az) * (k / n)));
    }
    pts.push(new THREE.Vector2(...r[r.length - 1]));
    const pos: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const d = b.clone().sub(a).normalize();
      const nx2 = -d.y * roadW / 2, nz2 = d.x * roadW / 2;
      const P4 = [[a.x - nx2, a.y - nz2], [a.x + nx2, a.y + nz2], [b.x + nx2, b.y + nz2], [b.x - nx2, b.y - nz2]].map(([x, z]) => compress(x, terrainH(x, z) + 0.12, z));
      pos.push(...P4[0], ...P4[1], ...P4[2], ...P4[0], ...P4[2], ...P4[3]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    roadGeo.push(g);
  }
  for (const g of roadGeo) {
    // ensure up-facing triangles
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1), cx = p.getX(i + 2), cz = p.getZ(i + 2);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (ny < 0) {
        const tx = p.getX(i + 1), ty = p.getY(i + 1), tz = p.getZ(i + 1);
        p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
        p.setXYZ(i + 2, tx, ty, tz);
      }
    }
    g.computeVertexNormals();
    B.add(K.road, g);
  }

  // ---- town houses on the plateau
  const occupied: [number, number, number][] = houses.map((h) => [h.x, h.z, Math.max(h.w, h.d) * 0.7]);
  const townCols = [0xf0dcaa, 0xf4f0e4, 0xb4cfe0, 0xecc0bc, 0xf2d898, 0xf6f4ee, 0xe8b894, 0xf4f0e4, 0xd8d0c4, 0xf4f0e4, 0xf0e2b8, 0xeeeae2];
  for (let tries = 0; tries < 60000 && houses.length < 760; tries++) {
    const a = rnd() * Math.PI * 2, rad = 120 + Math.pow(rnd(), 1.4) * 950;
    const x = Math.cos(a) * rad * 1.15, z = Math.sin(a) * rad * 0.95;
    if (designDist(x, z) < 16) continue;
    if (nearRoad(x, z, 9)) continue;
    // buildings cluster along the roads, leaving the tree canopy between
    if (!nearRoad(x, z, 45) && rnd() < 0.85) continue;
    const h0 = terrainH(x, z);
    if (h0 < -45) continue; // not down in the gorge
    const e = 5;
    const sl = Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    if (sl > 0.28) continue;
    // density: the town lies mostly east and south-east, thinning into the forest
    // the town spreads east and south of the temple; west and north are thinner, forest and scrub
    const dirW = x < -150 ? 0.15 : x < 0 ? 0.5 : 1;
    const dirN = z < -250 ? 0.4 : 1;
    const dens = (rad < 500 ? 0.85 : rad < 800 ? 0.4 : 0.12) * dirW * dirN;
    if (rnd() > dens) continue;
    const lodge = rnd() < 0.09;
    const w = lodge ? 18 + rnd() * 16 : 6 + rnd() * 8, d = lodge ? 12 + rnd() * 8 : 6 + rnd() * 7;
    const r0 = Math.max(w, d) * 0.6;
    let clash = false;
    for (const [ox, oz, orr] of occupied) if (Math.abs(ox - x) < r0 + orr && Math.abs(oz - z) < r0 + orr && Math.hypot(ox - x, oz - z) < r0 + orr) { clash = true; break; }
    if (clash) continue;
    occupied.push([x, z, r0]);
    const fl = lodge ? 3 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 3.2);
    houses.push({ x, z, w, d, h: fl * 3.2 + 0.7, ry: Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + (rnd() - 0.5) * 0.15, c: new THREE.Color(townCols[Math.floor(rnd() * townCols.length)]), tank: rnd() < 0.55 });
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const hm = facadeMaterial(false);
  const inst = new THREE.InstancedMesh(box, hm, houses.length);
  const tanks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 10).translate(0, 0.65, 0), new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6 }), houses.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  let nt = 0;
  houses.forEach((h, i) => {
    const y0 = Math.abs(h.z) < 25 && h.x > 90 && h.x < 230 ? 0 : terrainH(h.x, h.z) - 0.5;
    const [cx, cy, cz] = compress(h.x, y0, h.z);
    const k = Math.hypot(cx, cz) / Math.max(1, Math.hypot(h.x, h.z));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.ry);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(h.w * k, (h.h + 0.5) * k, h.d * k));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, h.c);
    if (h.tank) {
      const off = new THREE.Vector3(h.w * 0.25, 0, -h.d * 0.25).applyQuaternion(q);
      m.compose(new THREE.Vector3(cx + off.x * k, cy + (h.h + 0.5) * k, cz + off.z * k), q, new THREE.Vector3(k, k, k));
      tanks.setMatrixAt(nt++, m);
    }
  });
  tanks.count = nt;
  // balconies (a slab with a parapet wall) on the street side of the upper storeys, and roof parapets
  {
    // balconies and roof parapets share one instanced box (base at y = 0, centred)
    const pr = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const parapet = new THREE.InstancedMesh(pr, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), houses.length * 4 + 4000);
    const balcony = parapet;
    let np = 0;
    let nb = 0;
    houses.forEach((h) => {
      if (Math.hypot(h.x, h.z) > 700) return;
      const y0 = Math.abs(h.z) < 25 && h.x > 90 && h.x < 230 ? 0 : terrainH(h.x, h.z) - 0.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.ry);
      const pc = h.c.clone().multiplyScalar(1.04);
      // roof parapet walls (0.9 m) on all four edges
      for (const [ox, oz, sx, sz] of [[0, h.d / 2, h.w, 0.15], [0, -h.d / 2, h.w, 0.15], [h.w / 2, 0, 0.15, h.d], [-h.w / 2, 0, 0.15, h.d]]) {
        const off = new THREE.Vector3(ox, 0, oz).applyQuaternion(q);
        m.compose(new THREE.Vector3(h.x + off.x, y0 + h.h + 0.5, h.z + off.z), q, new THREE.Vector3(sx, 0.9, sz));
        parapet.setMatrixAt(np, m); parapet.setColorAt(np++, pc);
      }
      const storeys = Math.floor(h.h / 3.2);
      for (let s = 1; s < storeys && nb < 4000; s++) {
        if (rnd() < 0.35) continue;
        const bw = Math.min(h.w * 0.6, 4.5);
        const off = new THREE.Vector3((rnd() - 0.5) * (h.w - bw) * 0.6, 0, h.d / 2 + 0.5).applyQuaternion(q);
        m.compose(new THREE.Vector3(h.x + off.x, y0 + 0.5 + s * 3.2 - 0.15, h.z + off.z), q, new THREE.Vector3(bw, 1.05, 1.0));
        balcony.setMatrixAt(np, m); balcony.setColorAt(np++, pc); nb++;
      }
    });
    parapet.count = np;
    for (const im of [parapet]) { im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; if (im.instanceColor) im.instanceColor.needsUpdate = true; out.add(im); }
  }
  for (const im of [inst, tanks]) {
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    out.add(im);
  }
  inst.castShadow = true; // near shops do cast; the shadow camera only covers ±70 m
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  // awnings of the street shops
  const aw = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1.8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), awn.length);
  awn.forEach((a, i) => {
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a.s * 0.25);
    m.compose(new THREE.Vector3(a.x, 2.9, a.z - a.s * 0.85), q, new THREE.Vector3(a.w, 1, 1));
    aw.setMatrixAt(i, m);
    aw.setColorAt(i, a.c);
  });
  aw.castShadow = true;
  out.add(aw);
  // shop counters on the street: flower and offering stalls
  for (const a of awn) {
    if (rnd() < 0.5) continue;
    B.box(K.wood, a.w * 0.7, 0.8, 0.8, a.x, 0, a.z - a.s * 0.6);
    if (rnd() < 0.6) O.heap(a.x, 0.82, a.z - a.s * 0.6, 0.25, 0.08, 18);
  }
  for (const s of [-1, 1]) P.solid(114, 0, s > 0 ? 10.5 : -40, 216, 4, s > 0 ? 40 : -10.5);

  // ---- signboards on the town buildings near the roads (lodges, shops, eateries)
  {
    const near = houses.filter((h) => Math.hypot(h.x, h.z) < 650 && nearRoad(h.x, h.z, 30));
    const sb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x111111 }), near.length * 2);
    const cols = [0xd8282a, 0x1f5fb0, 0xf0c020, 0x2a8a3a, 0xf4f1ea, 0xe86a20, 0x7a2a8a];
    let ns = 0;
    for (const h of near) {
      const y0 = Math.abs(h.z) < 25 && h.x > 90 && h.x < 230 ? 0 : terrainH(h.x, h.z) - 0.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.ry);
      for (const side of h.h > 7 ? [1, -1] : [1]) {
        const bw = Math.min(h.w * 0.8, 7), off = new THREE.Vector3(0, 0, side * (h.d / 2 + 0.06)).applyQuaternion(q);
        m.compose(new THREE.Vector3(h.x + off.x, y0 + 3.5 + (side < 0 ? 3.2 : 0), h.z + off.z), q, new THREE.Vector3(bw, 0.9, 1));
        sb.setMatrixAt(ns, m);
        sb.setColorAt(ns++, new THREE.Color(cols[Math.floor(rnd() * cols.length)]));
      }
    }
    sb.count = ns;
    sb.castShadow = false;
    out.add(sb);
  }

  // ---- kerbs, lamp posts and parked vehicles along the town roads (within ~650 m)
  {
    const lampPts: [number, number, number][] = [], carPts: [number, number, number, number][] = [];
    for (const r of roads) {
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, az] = r[i], [bx, bz] = r[i + 1];
        const len = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        const n = Math.max(1, Math.round(len / 6));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (Math.hypot(x, z) > 650) continue;
          for (const s of [-1, 1]) {
            const kx = x + nx * s * (roadW / 2 + 0.12), kz = z + nz * s * (roadW / 2 + 0.12);
            B.box(K.granite, len / n + 0.02, 0.2, 0.24, kx, terrainH(kx, kz) + 0.02, kz, false, ry);
          }
          if (k % 5 === 0) lampPts.push([x + nx * (roadW / 2 + 0.6) * (k % 10 === 0 ? 1 : -1), z + nz * (roadW / 2 + 0.6) * (k % 10 === 0 ? 1 : -1), ry]);
          if (rnd() < 0.16) { const s = rnd() < 0.5 ? -1 : 1; carPts.push([x + nx * s * (roadW / 2 - 1.1), z + nz * s * (roadW / 2 - 1.1), ry + (rnd() < 0.5 ? 0 : Math.PI), rnd()]); }
        }
      }
    }
    for (let i = 0; i < 18; i++) carPts.push([80 + (i % 9) * 3.0, -38 + Math.floor(i / 9) * 6, Math.PI / 2, rnd()]); // the forecourt parking
    // lamp post: pole, curved arm, lamp head (one instanced draw)
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 7, 8).translate(0, 3.5, 0).toNonIndexed();
    const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6).rotateZ(Math.PI / 2 - 0.25).translate(0.6, 7.0, 0).toNonIndexed();
    const head = new THREE.BoxGeometry(0.5, 0.14, 0.24).translate(1.25, 7.12, 0).toNonIndexed();
    const lampGeo = new THREE.BufferGeometry();
    const lp: number[] = [], ln: number[] = [];
    for (const g of [pole, arm, head]) { lp.push(...(g.attributes.position.array as Float32Array)); ln.push(...(g.attributes.normal.array as Float32Array)); }
    lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lampGeo.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
    const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x5a5e62, metalness: 0.7, roughness: 0.45 }), lampPts.length);
    lampPts.forEach(([x, z, ry], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry + Math.PI / 2);
      m.compose(new THREE.Vector3(x, terrainH(x, z) - 0.1, z), q, new THREE.Vector3(1, 1, 1));
      lamps.setMatrixAt(i, m);
    });
    lamps.castShadow = false;
    out.add(lamps);
    // vehicles: car / jeep body (instance colour), dark glass, black tyres — one instanced draw
    const vparts: [THREE.BufferGeometry, number][] = [
      [new THREE.BoxGeometry(4.1, 0.75, 1.75).translate(0, 0.62, 0), 0],
      [new THREE.BoxGeometry(2.3, 0.62, 1.6).translate(-0.25, 1.3, 0), 1],
      ...[-1.35, 1.35].flatMap((x) => [-0.8, 0.8].map((z) => [new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12).rotateX(Math.PI / 2).translate(x, 0.33, z), 2] as [THREE.BufferGeometry, number])),
    ];
    const vp: number[] = [], vn: number[] = [], va: number[] = [];
    for (const [g0, id] of vparts) { const g = g0.toNonIndexed(); vp.push(...(g.attributes.position.array as Float32Array)); vn.push(...(g.attributes.normal.array as Float32Array)); for (let i = 0; i < g.attributes.position.count; i++) va.push(id); }
    const carGeo = new THREE.BufferGeometry();
    carGeo.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    carGeo.setAttribute('normal', new THREE.Float32BufferAttribute(vn, 3));
    carGeo.setAttribute('aPart', new THREE.Float32BufferAttribute(va, 1));
    const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4 });
    carMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPart;\nvarying float vPart;').replace('#include <color_vertex>', '#include <color_vertex>\nvPart = aPart;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPart;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (vPart > 1.5) diffuseColor.rgb = vec3(0.02); else if (vPart > 0.5) diffuseColor.rgb = vec3(0.04, 0.05, 0.06);');
    };
    carMat.customProgramCacheKey = () => 'srisailam-cars';
    const cars = new THREE.InstancedMesh(carGeo, carMat, carPts.length);
    const carCols = [0xf2f2f2, 0xd8d8d8, 0x9a9ea2, 0x202226, 0xa82a2a, 0x2a4a8a, 0xe8e2d0, 0xf2f2f2];
    carPts.forEach(([x, z, ry, r], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      const y = Math.abs(z) < 50 && x > 60 && x < 262 ? 0 : terrainH(x, z) - 0.05;
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      cars.setMatrixAt(i, m);
      cars.setColorAt(i, new THREE.Color(carCols[Math.floor(r * carCols.length)]));
    });
    cars.castShadow = false;
    out.add(cars);
  }

  // spatial hash of the house footprints, so the forest keeps clear of them
  const cell = 25, hash = new Map<string, [number, number, number][]>();
  for (const o of occupied) {
    const k = `${Math.floor(o[0] / cell)},${Math.floor(o[1] / cell)}`;
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k)!.push(o);
  }
  const avoid = (x: number, z: number) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const [ox, oz, orr] of hash.get(`${cx + i},${cz + j}`) ?? []) if (Math.abs(ox - x) < orr + 2 && Math.abs(oz - z) < orr + 2) return true;
    }
    return Math.hypot(x, z) < 1500 && nearRoad(x, z, 7);
  };
  void WATER_Y;
  void lathe;
  return { avoid };
}

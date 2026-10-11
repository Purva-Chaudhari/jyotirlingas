import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { VM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './offerings';
import { kalashGeo, lathe, tube } from './forms';

/**
 * The garbhagriha of Baba Baidyanath (Ravaneshwar Jyotirlinga).
 *
 * As photographed in the sanctum (PIB, 2022): a square room of whitewashed stone blocks gone grey
 * with smoke and water, small pointed-arch niches, iron brackets carrying chains, brass bells and a
 * wicker basket; a dark stone floor scored into a grid. In the middle, set flush in the floor, the
 * black basalt jalahari — a long keyhole/teardrop with a raised lip and a broad silver rim — and in
 * the round of it the Jyotirlinga itself: a cylinder of about 5 in (≈12.7 cm) rising about 4 in
 * (≈10 cm) from the slab, its top broken and uneven (by tradition, where Ravana pressed it).
 * Pilgrims pour Gangajal carried from Sultanganj; roses ring the lingam and the rim, bel sprigs lie
 * in the basin; a tall silver lamp, a brass water pot and thalis of kumkum and sandal stand by.
 * The pranala (spout) runs north (+x). On the inner ceiling, the eight-petalled Chandrakanta Mani.
 */

export const SANCTUM = {
  /** floor level of the plinth / sanctum */
  F: 0.45,
  /** interior half-width (face of the lining) */
  half: 2.4,
  /** structural wall face behind the lining (niche depth) */
  core: 2.72,
  /** jalahari / lingam centre */
  lx: -0.25,
  lz: -0.15,
  /** door half-width and height */
  doorW: 0.55,
  doorH: 2.05,
  ceil: 4.7,
};

/** Keyhole outline of the jalahari: round of radius R round (0,0), spout to +x ending at x=L. */
function keyhole(R: number, L: number, tipW: number, grow = 0, n = 64): THREE.Vector2[] {
  const r = R + grow, tw = tipW / 2 + grow;
  // tangent from the circle toward the spout: choose the angle where the side lines leave the round
  const a0 = 0.62;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI * 2 - 2 * a0);
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  // lower side → rounded tip → upper side (shape coords: x = east-west along the spout, y = z)
  const last = pts[pts.length - 1];
  const tipC = new THREE.Vector2(L - tw, 0);
  const sideN = 8;
  for (let i = 1; i <= sideN; i++) {
    const t = i / sideN;
    // slightly concave sides, like the carved stone
    const x = THREE.MathUtils.lerp(last.x, tipC.x, t), y = THREE.MathUtils.lerp(last.y, -tw, t) + Math.sin(t * Math.PI) * 0.02;
    pts.push(new THREE.Vector2(x, y));
  }
  for (let i = 1; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push(new THREE.Vector2(tipC.x + Math.cos(a) * tw, Math.sin(a) * tw));
  }
  const first = pts[0];
  for (let i = 0; i < sideN; i++) {
    const t = i / sideN;
    const x = THREE.MathUtils.lerp(tipC.x, first.x, t), y = THREE.MathUtils.lerp(tw, first.y, t) - Math.sin(t * Math.PI) * 0.02;
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

/** Flat ring (outer outline minus inner) extruded `h` up from y=0, in XZ with +x along the spout. */
function rimGeo(outer: THREE.Vector2[], inner: THREE.Vector2[] | null, h: number, bevel = 0) {
  const s = new THREE.Shape(outer);
  if (inner) s.holes.push(new THREE.Path([...inner].reverse()));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4,
  });
  // shape XY → world XZ (shape y = world z), extrusion along +y
  g.rotateX(Math.PI / 2);
  g.translate(0, h, 0);
  g.scale(1, 1, 1);
  g.deleteAttribute('uv');
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

/**
 * The Jyotirlinga: a short cylinder with a broken, uneven, slightly hollowed top.
 * r = radius, h = visible height above the basin.
 */
export function jyotirlingaGeo(r: number, h: number) {
  const prof: [number, number][] = [
    [r * 1.18, -0.01], [r * 1.08, 0.004], [r * 1.02, h * 0.12], [r * 1.0, h * 0.55], [r * 0.99, h * 0.82],
    [r * 0.95, h * 0.93], [r * 0.82, h * 0.99], [r * 0.6, h * 0.97], [r * 0.35, h * 0.9], [r * 0.12, h * 0.86], [0, h * 0.85],
  ];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), rr = Math.hypot(x, z);
    const top = Math.max(0, (y - h * 0.6) / (h * 0.4));
    // broken rim: a chipped notch on one side and an uneven, sloping fracture face
    const chip = Math.exp(-Math.pow((((a - 2.2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / 0.5, 2)) * 0.32;
    const rough = Math.sin(a * 5 + 1.3) * 0.05 + Math.sin(a * 11 + 0.4) * 0.03 + Math.sin(a * 17) * 0.015;
    const slope = Math.cos(a - 0.6) * 0.08;
    const dy = top * h * (rough + slope - chip);
    // the depressed centre is pitted
    const pit = rr < r * 0.6 && y > h * 0.8 ? Math.sin(x * 260) * Math.sin(z * 230) * 0.0025 : 0;
    const sw = 1 + 0.025 * Math.sin(a * 2 + 0.5) + 0.015 * Math.sin(a * 3 + y * 40);
    p.setXYZ(i, x * sw, y + dy + pit, z * sw);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** Pointed (four-centred) arch outline for the little wall niches, w wide, h tall, in XY. */
function nicheArch(w: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0)];
  const spring = h * 0.62, rise = h - spring;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = w / 2 * (1 - t);
    pts.push(new THREE.Vector2(x, spring + rise * Math.pow(Math.sin(t * Math.PI / 2), 0.8) * (0.85 + 0.15 * t)));
  }
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const x = -w / 2 * t;
    pts.push(new THREE.Vector2(x, spring + rise * Math.pow(Math.sin((1 - t) * Math.PI / 2), 0.8) * (0.85 + 0.15 * (1 - t))));
  }
  return pts;
}

export interface SanctumOut {
  lights: THREE.Light[];
  water: THREE.Mesh;
}

/**
 * Build the garbhagriha interior: lining walls with niches, corbelled ceiling, floor, the
 * jalahari and the Jyotirlinga, offerings and lamps. The structural walls/outer skin are built by
 * the temple; this owns everything inside x,z ∈ [-core, core].
 */
export function buildSanctum(root: THREE.Group, B: Merger, V: VM, P: Physics, flames: Flames, O: Offerings): SanctumOut {
  const { F, half, core, lx, lz, doorW, doorH, ceil } = SANCTUM;
  const T = core - half; // lining thickness = niche depth

  // ---- floor: dark stone scored in a grid (its own walkable quad)
  B.span(V.sanctumFloor, -half, F - 0.2, -half, half, F + 0.004, half);
  P.floor(root, -half, half, -half, half, F);

  // ---- lining walls with niches. For each wall: a list of niche centres along it.
  const nicheW = 0.5, nicheH = 0.72, nicheY = F + 1.55;
  const niches: Record<'n' | 's' | 'e' | 'w', number[]> = { n: [-1.2, 1.2], s: [0], w: [-1.1, 1.0], e: [-1.55, 1.55] };
  // spandrel: the solid above the pointed arch inside the niche rectangle
  const curve = nicheArch(nicheW, nicheH).slice(2); // right springing → apex → left springing
  const spShape = new THREE.Shape([...curve, new THREE.Vector2(-nicheW / 2, nicheH + 0.04), new THREE.Vector2(nicheW / 2, nicheH + 0.04)]);
  const spandrel = new THREE.ExtrudeGeometry(spShape, { depth: T, bevelEnabled: false, curveSegments: 2 });
  spandrel.deleteAttribute('uv');
  const wall = (side: 'n' | 's' | 'e' | 'w') => {
    // local frame: u along the wall, inward normal; wall plane at distance `half` from centre
    const place = (geo: THREE.BufferGeometry, u: number, y: number, depthOff: number, mat: THREE.Material) => {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let pos: THREE.Vector3;
      if (side === 's') { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0); pos = new THREE.Vector3(u, y, -core + depthOff); }
      else if (side === 'e') { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); pos = new THREE.Vector3(-u, y, core - depthOff); }
      else if (side === 'n') { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); pos = new THREE.Vector3(core - depthOff, y, u); }
      else { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); pos = new THREE.Vector3(-core + depthOff, y, -u); }
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      B.add(mat, geo, m);
    };
    // a box in wall-local coords: u0..u1 along, y0..y1, depth 0..T from the core face inward
    const lbox = (u0: number, u1: number, y0: number, y1: number, d0 = 0, d1 = T, mat: THREE.Material = V.sanctumWall) => {
      if (u1 - u0 < 0.005 || y1 - y0 < 0.005) return;
      const g = new THREE.BoxGeometry(u1 - u0, y1 - y0, d1 - d0).translate((u0 + u1) / 2, (y0 + y1) / 2, (d0 + d1) / 2);
      place(g, 0, 0, 0, mat);
    };
    const L = core; // the lining spans the full core width so corners close
    const ns = [...niches[side]].sort((a, b) => a - b);
    const door = side === 'e';
    // below the niches
    if (door) { lbox(-L, -doorW, F, nicheY); lbox(doorW, L, F, nicheY); }
    else lbox(-L, L, F, nicheY);
    // niche band: solid between the niches (and either side of the door)
    const bandTop = nicheY + nicheH + 0.04;
    const holes = ns.map((c) => [c - nicheW / 2, c + nicheW / 2] as [number, number]);
    if (door) holes.push([-doorW, doorW]);
    holes.sort((a, b) => a[0] - b[0]);
    let u = -L;
    for (const [a, b] of holes) { lbox(u, a, nicheY, bandTop); u = b; }
    lbox(u, L, nicheY, bandTop);
    for (const c of ns) {
      place(spandrel, c, nicheY, 0, V.sanctumWall);
      // a plaster frame under the niche: a lamp-blackened sill
      lbox(c - nicheW / 2 - 0.07, c + nicheW / 2 + 0.07, nicheY - 0.06, nicheY, T, T + 0.035, V.sanctumWall);
    }
    if (door) lbox(-doorW, doorW, F + doorH, bandTop);
    // above the band to the ceiling springing
    lbox(-L, L, bandTop, ceil);
    // niche backs are the core wall — a thin skin so they read even if the outer wall is elsewhere
    for (const c of ns) lbox(c - nicheW / 2, c + nicheW / 2, nicheY - 0.02, nicheY + nicheH + 0.06, -0.06, 0.001, V.nicheBack);
  };
  for (const s of ['n', 's', 'e', 'w'] as const) wall(s);
  // colliders: the four linings
  P.solid(-core, F, -core, core, F + 4, -half);
  P.solid(-core, F, half, -doorW, F + 4, core);
  P.solid(doorW, F, half, core, F + 4, core);
  P.solid(-core, F, -core, -half, F + 4, core);
  P.solid(half, F, -core, core, F + 4, core);

  // ---- corbelled ceiling stepping in to the Chandrakanta Mani
  let hc = half, yc = ceil;
  for (let i = 0; i < 6; i++) {
    const nh = hc - 0.28;
    B.span(V.sanctumWall, -hc - 0.3, yc, -hc - 0.3, hc + 0.3, yc + 0.34, -nh);
    B.span(V.sanctumWall, -hc - 0.3, yc, nh, hc + 0.3, yc + 0.34, hc + 0.3);
    B.span(V.sanctumWall, -hc - 0.3, yc, -nh, -nh, yc + 0.34, nh);
    B.span(V.sanctumWall, nh, yc, -nh, hc + 0.3, yc + 0.34, nh);
    hc = nh; yc += 0.34;
  }
  B.span(V.sanctumWall, -hc - 0.1, yc, -hc - 0.1, hc + 0.1, yc + 0.3, hc + 0.1);
  // Chandrakanta Mani: an eight-petalled lotus hanging from the crown of the vault
  const lotus: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const petal = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.45, 0.25, 1).translate(0, 0, 0.2);
    petal.rotateY((i / 8) * Math.PI * 2);
    petal.deleteAttribute('uv');
    lotus.push(petal.toNonIndexed());
  }
  const lotusG = mergeGeometries(lotus)!;
  lotusG.rotateX(Math.PI);
  B.place(V.brass, lotusG, 0, yc - 0.005, 0);
  B.place(V.silver, new THREE.SphereGeometry(0.075, 16, 12), 0, yc - 0.09, 0);
  B.place(V.silver, new THREE.TorusGeometry(0.42, 0.025, 8, 48).rotateX(Math.PI / 2), 0, yc - 0.03, 0);

  // ---- iron brackets with chains, bells and a wicker basket (as in the sanctum photos)
  const bracket = (x: number, z: number, along: 'x' | 'z', y: number) => {
    const len = 0.55;
    const dx = along === 'x' ? Math.sign(-x) * len : 0, dz = along === 'z' ? Math.sign(-z) * len : 0;
    B.add(V.iron, tube([new THREE.Vector3(x, y, z), new THREE.Vector3(x + dx, y, z + dz)], 0.015, 2, 5));
    B.add(V.iron, tube([new THREE.Vector3(x, y - 0.3, z), new THREE.Vector3(x + dx * 0.6, y, z + dz * 0.6)], 0.01, 2, 5));
    return new THREE.Vector3(x + dx, y, z + dz);
  };
  const chain = (top: THREE.Vector3, len: number) => {
    const links = Math.round(len / 0.05);
    const g = new THREE.TorusGeometry(0.014, 0.0035, 4, 8);
    for (let i = 0; i < links; i++) {
      const lg = g.clone();
      if (i % 2) lg.rotateY(Math.PI / 2);
      B.place(V.iron, lg, top.x, top.y - i * 0.045, top.z);
    }
    return new THREE.Vector3(top.x, top.y - len, top.z);
  };
  const bellGeo = lathe([[0, 0.17], [0.025, 0.17], [0.04, 0.15], [0.05, 0.1], [0.07, 0.03], [0.085, 0], [0.075, -0.005], [0.06, 0.02], [0.03, 0.12], [0, 0.13]], 24);
  const bell = (p: THREE.Vector3, s = 1) => {
    B.place(V.brass, bellGeo, p.x, p.y - 0.17 * s, p.z, 0, s);
    B.place(V.brass, new THREE.SphereGeometry(0.02, 8, 6), p.x, p.y - 0.17 * s - 0.01, p.z, 0, s);
  };
  const b1 = bracket(half - 0.02, -1.4, 'x', F + 3.6);
  bell(chain(b1, 1.0), 1.0);
  const b2 = bracket(half - 0.02, -0.6, 'x', F + 3.4);
  bell(chain(b2, 0.7), 0.8);
  const b3 = bracket(-half + 0.02, 1.2, 'x', F + 3.5);
  const basketAt = chain(b3, 0.6);
  // wicker basket (for flowers) on four strings
  const basket = lathe([[0, 0], [0.12, 0], [0.17, 0.05], [0.2, 0.22], [0.19, 0.24], [0.16, 0.06], [0, 0.03]], 20);
  B.place(V.wicker, basket, basketAt.x, basketAt.y - 0.5, basketAt.z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    B.add(V.iron, tube([basketAt.clone(), new THREE.Vector3(basketAt.x + Math.cos(a) * 0.19, basketAt.y - 0.27, basketAt.z + Math.sin(a) * 0.19)], 0.003, 2, 3));
  }
  const b4 = bracket(-1.0, -half + 0.02, 'z', F + 3.7);
  bell(chain(b4, 1.2), 1.1);
  // a bell over the doorway on the inside
  bell(chain(new THREE.Vector3(0.2, F + doorH + 0.9, half - 0.15), 0.6), 0.9);

  // red sindoor hand-smears and drips on the walls (as in the photos)
  const smear = (x: number, y: number, z: number, ry: number, w: number, h: number) => {
    // a hand-pressed blot of sindoor with a few runs dripping from it
    let s = Math.abs(Math.sin(x * 12.9 + z * 78.2)) * 1000;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const blob = new THREE.CircleGeometry(0.5, 14);
    const p = blob.attributes.position;
    for (let i = 1; i < p.count; i++) { const k = 0.7 + r() * 0.5; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
    const nx = Math.sin(ry) * 0.004, nz = Math.cos(ry) * 0.004;
    for (let i = 0; i < 3; i++) B.place(V.kumkum, blob, x + (r() - 0.5) * w + nx, y + (r() - 0.5) * h * 2, z + nz, ry, [w * (0.6 + r() * 0.6), h * (1 + r() * 1.5), 1]);
    for (let i = 0; i < 4; i++) {
      const len = 0.08 + r() * 0.3;
      const dx = (r() - 0.5) * w;
      const ox = Math.cos(ry) * dx, oz = -Math.sin(ry) * dx;
      B.place(V.kumkum, new THREE.PlaneGeometry(0.008 + r() * 0.01, len), x + ox + nx, y - len / 2, z + oz + nz, ry);
    }
  };
  smear(half - 0.006, F + 2.6, -0.95, -Math.PI / 2, 0.22, 0.06);
  smear(-1.4, F + 2.4, -half + 0.006, 0, 0.18, 0.05);
  smear(-half + 0.006, F + 2.2, -0.3, Math.PI / 2, 0.16, 0.05);

  // ---- the jalahari
  const R = 0.5, Lsp = 1.25, tipW = 0.34;
  const outline = keyhole(R, Lsp, tipW, 0);
  const lipIn = keyhole(R, Lsp, tipW, -0.13);
  const at = new THREE.Matrix4().makeTranslation(lx, F, lz);
  // a thick rounded black basalt wall (~0.13 m wide, ~0.10 m high) round the basin…
  B.add(V.basalt, rimGeo(outline, lipIn, 0.075, 0.025), at);
  // …hugged outside by a raised half-round silver tube running right round the keyhole and spout
  const tubePts = keyhole(R, Lsp, tipW, 0.05, 120).map((p) => new THREE.Vector3(p.x, 0, p.y));
  const silverTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePts, true), 240, 0.05, 10, true);
  silverTube.deleteAttribute('uv');
  B.add(V.silver, silverTube.toNonIndexed(), new THREE.Matrix4().makeTranslation(lx, F + 0.035, lz));
  // pilgrims stand round it, they do not step on it
  P.solid(lx - 0.62, F, lz - 0.62, lx + 1.36, F + 0.35, lz + 0.62);
  const basinG = rimGeo(lipIn, null, 0.012);
  B.add(V.basalt, basinG, at);
  // the water: a thin glossy film filling the basin and running out down the spout
  const film = new THREE.Mesh(rimGeo(keyhole(R, Lsp, tipW, -0.14), null, 0.002), V.waterFilm);
  film.position.set(lx, F + 0.015, lz);
  film.renderOrder = 2;
  root.add(film);
  // milk from the last abhisheka pooling round the lingam and trailing down the spout
  const milkS = new THREE.Shape();
  const mpts: THREE.Vector2[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    const rr = 0.085 + 0.03 * Math.sin(a * 3 + 1) + 0.02 * Math.sin(a * 5 + 2) + 0.01 * Math.sin(a * 11) + (Math.cos(a) > 0.7 ? (Math.cos(a) - 0.7) * 1.4 : 0);
    mpts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr * 0.9));
  }
  milkS.setFromPoints(mpts);
  const milkG = new THREE.ShapeGeometry(milkS, 2).rotateX(-Math.PI / 2);
  milkG.deleteAttribute('uv');
  const milk = new THREE.Mesh(milkG, V.milk);
  milk.position.set(lx + 0.03, F + 0.0185, lz);
  milk.renderOrder = 3;
  root.add(milk);
  // a thinner milky run down the spout toward the drain
  {
    const run: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; run.push(new THREE.Vector2(0.12 + t * (Lsp - 0.3), 0.02 * Math.sin(t * 9) + 0.022 * (1 - t) + 0.006)); }
    for (let i = 24; i >= 0; i--) { const t = i / 24; run.push(new THREE.Vector2(0.12 + t * (Lsp - 0.3), 0.02 * Math.sin(t * 9) - 0.022 * (1 - t) - 0.006)); }
    const rg = new THREE.ShapeGeometry(new THREE.Shape(run), 1).rotateX(-Math.PI / 2);
    rg.deleteAttribute('uv');
    const rm = new THREE.Mesh(rg, V.milkRun);
    rm.position.set(lx, F + 0.0175, lz);
    rm.renderOrder = 3;
    root.add(rm);
  }
  // the drain hole at the spout tip
  B.place(V.dark, new THREE.CircleGeometry(0.035, 16).rotateX(-Math.PI / 2), lx + Lsp - 0.12, F + 0.0135, lz);

  // ---- the Jyotirlinga: 5 in across, 4 in proud of the slab, the top broken
  const lr = 0.0635, lh = 0.1;
  B.add(V.lingam, jyotirlingaGeo(lr, lh), new THREE.Matrix4().makeTranslation(lx, F + 0.012, lz));

  // ---- offerings
  // a ring of red roses round the lingam, a second looser ring, and two on the broken crown
  const ringRose = (r: number, n: number, y: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + O.rnd() * 0.15;
      O.add('rose', lx + Math.cos(a) * r, y, lz + Math.sin(a) * r, 1.15, i % 3 ? 0x8e0c18 : 0xa8121f);
    }
  };
  ringRose(0.165, 13, F + 0.024);
  ringRose(0.22, 18, F + 0.024);
  // a small heap of white jasmine/mogra (Ø ≈ 8 cm) on the broken crown, a rose and a bel sprig on it
  {
    const top = F + 0.012 + lh * 0.9;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; O.add('mogra', lx + Math.cos(a) * 0.028, top + 0.006, lz + Math.sin(a) * 0.028, 0.85); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; O.add('mogra', lx + Math.cos(a) * 0.012, top + 0.02, lz + Math.sin(a) * 0.012, 0.8); }
    for (let i = 0; i < 26; i++) { const a = O.rnd() * Math.PI * 2, r = O.rnd() * 0.04; O.add('jasmine', lx + Math.cos(a) * r, top + 0.012 + (0.04 - r) * 0.5, lz + Math.sin(a) * r, 1.0, undefined, O.rnd() * 6.3, 0.6); }
    O.add('rose', lx + 0.004, top + 0.034, lz - 0.004, 0.7);
    O.add('bel', lx - 0.03, top + 0.01, lz + 0.02, 1.0, undefined, 0.6, 0.4);
  }
  // roses all along the rim of the jalahari
  const rimPts = keyhole(R, Lsp, tipW, -0.065, 90);
  for (let i = 0; i < rimPts.length; i += 1) {
    const p = rimPts[i];
    O.add('rose', lx + p.x, F + 0.12, lz + p.y, 1.0, i % 4 ? 0x900d19 : 0xb3172a);
  }
  // bel sprigs laid along the basin, pointing down the spout (as the priests lay them)
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const x = 0.22 + t * (Lsp - 0.38), zz = (O.rnd() - 0.5) * 0.12;
    O.add('bel', lx + x, F + 0.02, lz + zz, 1.2, undefined, -Math.PI / 2 + (O.rnd() - 0.5) * 0.5, 0.2);
  }
  for (let k = 0; k < 10; k++) {
    const a = O.rnd() * Math.PI * 2, rr = 0.24 + O.rnd() * 0.16;
    O.add('bel', lx + Math.cos(a) * rr, F + 0.02, lz + Math.sin(a) * rr, 1.1, undefined, a + Math.PI / 2, 0.3);
  }
  O.scatter(lx - 0.35, lx + 0.35, lz - 0.35, lz + 0.35, F + 0.016, 26, 0.2);
  // petals and rice spilled on the floor round about
  O.scatter(lx - 1.2, lx + 1.6, lz - 1.1, lz + 1.1, F + 0.001, 70, 0.25);
  // the floor round the jalahari is always wet: irregular glossy pools of water and milk-water,
  // with bel leaves, rose heads and marigold petals carried out on them
  {
    const pools: THREE.BufferGeometry[] = [];
    let ps = 5;
    const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
    for (const [px, pz, prr] of [[0, 0, 1.35], [0.9, 0.55, 0.7], [-0.9, 0.6, 0.6], [1.5, -0.5, 0.55], [-0.6, -0.9, 0.65], [0.2, 1.3, 0.5]] as const) {
      const pts: THREE.Vector2[] = [];
      const ph = pr() * 6.3;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const rr = prr * (0.78 + 0.14 * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 7 + ph * 2));
        pts.push(new THREE.Vector2(Math.cos(a) * rr * 1.25, Math.sin(a) * rr));
      }
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1).rotateX(-Math.PI / 2);
      g.translate(lx + 0.35 + px, F + 0.006, lz + pz);
      g.deleteAttribute('uv');
      pools.push(g);
    }
    const pool = new THREE.Mesh(mergeGeometries(pools)!, V.puddle);
    pool.renderOrder = 1;
    root.add(pool);
    O.scatter(lx - 1.5, lx + 2.0, lz - 1.4, lz + 1.4, F + 0.008, 90, 0.45);
    for (let i = 0; i < 26; i++) {
      const a = pr() * 6.3, rr = 0.8 + pr() * 0.8;
      O.add(pr() < 0.6 ? 'rose' : 'marigold', lx + 0.3 + Math.cos(a) * rr, F + 0.02, lz + Math.sin(a) * rr, 0.9);
    }
  }
  for (let i = 0; i < 40; i++) O.add('rice', lx - 0.8 + O.rnd() * 1.4, F + 0.003, lz + 0.6 + O.rnd() * 0.5, 1, undefined, O.rnd() * 6, 0.3);

  // ---- lamps and vessels
  // tall silver deepa-stambha with a lit bowl
  const stand = lathe([[0.16, 0], [0.16, 0.03], [0.1, 0.06], [0.05, 0.1], [0.045, 0.3], [0.07, 0.34], [0.045, 0.38], [0.04, 0.7],
    [0.065, 0.74], [0.04, 0.78], [0.035, 1.05], [0.06, 1.1], [0.04, 1.14], [0.04, 1.2], [0.15, 1.24], [0.17, 1.3], [0.15, 1.31], [0.04, 1.26], [0, 1.26]], 24);
  const lampX = 1.85, lampZ = -1.6;
  B.place(V.silver, stand, lampX, F, lampZ);
  flames.points.push(new THREE.Vector3(lampX, F + 1.37, lampZ));
  // ghee diyas on the jalahari's edge
  const diya = lathe([[0, 0], [0.03, 0], [0.045, 0.012], [0.05, 0.03], [0.042, 0.03], [0.03, 0.016], [0, 0.014]], 14);
  for (const [dx, dz] of [[-0.62, 0.2], [-0.6, -0.3]] as const) {
    B.place(V.clay, diya, lx + dx, F, lz + dz);
    flames.points.push(new THREE.Vector3(lx + dx, F + 0.06, lz + dz));
  }
  // brass water pot (Gangajal) and a silver lota
  B.place(V.brass, kalashGeo(0.42), lx + 1.6, F, lz + 1.15);
  B.place(V.silver, kalashGeo(0.2), lx - 0.75, F, lz + 0.62);
  // silver thali with bowls of kumkum, turmeric, sandal paste
  const thali = lathe([[0, 0], [0.28, 0], [0.3, 0.025], [0.29, 0.03], [0.27, 0.008], [0, 0.008]], 32);
  B.place(V.silver, thali, lx - 1.1, F, lz - 0.85);
  const bowl = lathe([[0, 0], [0.04, 0], [0.055, 0.035], [0.05, 0.037], [0.035, 0.008], [0, 0.008]], 16);
  const fills = [V.kumkum, V.marigold, V.ash, V.kumkum];
  [[-0.1, -0.1], [0.1, -0.08], [0.0, 0.11], [0.15, 0.1]].forEach(([dx, dz], i) => {
    B.place(V.silver, bowl, lx - 1.1 + dx, F + 0.008, lz - 0.85 + dz);
    B.place(fills[i], new THREE.CircleGeometry(0.045, 12).rotateX(-Math.PI / 2), lx - 1.1 + dx, F + 0.035, lz - 0.85 + dz);
  });
  // conch-shaped silver arghya (the tall spouted vessel seen beside the lingam)
  // upright: a round foot on a small tray, a tall tapering horn body, a lip and a curled spout
  const arghya = lathe([[0, 0], [0.075, 0], [0.08, 0.012], [0.05, 0.03], [0.034, 0.06], [0.05, 0.09], [0.052, 0.14], [0.042, 0.28],
    [0.03, 0.42], [0.02, 0.52], [0.014, 0.58], [0.008, 0.62], [0, 0.63]], 20);
  const ax = lx - 0.62, az = lz + 0.5;
  B.place(V.silver, lathe([[0, 0], [0.13, 0], [0.14, 0.012], [0.13, 0.016], [0, 0.006]], 24), ax, F, az);
  B.place(V.silver, arghya, ax, F + 0.008, az);
  // a short curled lip near the tip, the conch's spout
  B.add(V.silver, tube([new THREE.Vector3(ax, F + 0.5, az), new THREE.Vector3(ax + 0.03, F + 0.53, az + 0.01), new THREE.Vector3(ax + 0.055, F + 0.52, az + 0.015), new THREE.Vector3(ax + 0.06, F + 0.49, az + 0.015)], 0.008, 8, 6));

  // ---- light: one lamp-warm key over the lingam and a fill by the deepa-stambha (zone-switched)
  const key = new THREE.PointLight(0xffd8a8, 3.4, 8, 1.4);
  key.position.set(lx + 0.4, F + 2.3, lz + 0.9);
  const fill = new THREE.PointLight(0xffc48a, 2.2, 7, 1.6);
  fill.position.set(lampX - 0.1, F + 1.5, lampZ + 0.2);
  // a soft, low, warm-white bounce off the wet floor and walls so the sunken jalahari reads
  const bounce = new THREE.PointLight(0xffe4c4, 1.6, 5, 1.2);
  bounce.position.set(lx + 0.3, F + 0.75, lz + 0.4);
  // a narrow beam from above the door onto the lingam (the darshan view): picks out the wet black
  // stone, the milk and the white flowers on its crown
  const spot = new THREE.SpotLight(0xfff0dc, 3, 6, THREE.MathUtils.degToRad(20), 0.5, 1.2);
  spot.position.set(lx + 0.2, F + 2.6, half - 0.35);
  spot.target.position.set(lx, F + 0.05, lz);
  root.add(key, fill, bounce, spot, spot.target);
  flames.lights.push(fill);
  return { lights: [key, fill, bounce, spot], water: film };
}

import * as THREE from 'three';
import type { Flames, Physics } from '../../engine/kit';
import type { KM } from './mats';
import { Merger } from './merge';
import { lathe, kalashGeo } from './spire';
import { lingamGeo, type Offerings } from './shivling';

/**
 * The garbhagriha of Shri Vishweshwara, from the 2022–24 photographs (PIB / Commons):
 *  - walls sheathed in embossed gold (lotus panels, "ॐ नमः शिवाय" band), twisted gold pilasters at the doors,
 *    gold lattice door leaves standing open on all four sides;
 *  - the Jyotirlinga: a short, smooth black stone (≈ 60 cm tall in all, ≈ 90 cm round; ≈ 30 cm shows)
 *    on a stepped gold pitha with a flat gold pranala, at the bottom of a deep square silver basin
 *    (repoussé rim, onion-knob corner posts) sunk into the marble floor; milky water pools around it;
 *  - bel leaves, marigold and jasmine on and round the lingam, a heap of offerings in a corner,
 *    a hanging silver jaladhari, a silver chhatra, brass lamps, red carpets where the priests sit.
 */

/** half-sizes inside the walls; the floor `depth` below the marble; the coping `rim` above it */
export const BASIN = { hx: 0.82, hz: 0.72, depth: 0.15, rim: 0.32 };

const redInlay = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.45 });

export function buildSanctum(g: THREE.Group, K: KM, P: Physics, flames: Flames, O: Offerings, F: number, gh: number, D: number, GC: number) {
  const S = new Merger(P, 'garbhagriha');
  const { hx, hz, depth, rim } = BASIN;
  const bot = F - depth;
  // the milky water stands high in the basin, lapping at the jaladhari's rim
  const W = bot + 0.06;

  // ---------- gold sheathing ----------
  const gp = 0.03;
  for (const s of [1, -1]) {
    const zin = s * gh, zz0 = s > 0 ? zin - gp : zin, zz1 = s > 0 ? zin : zin + gp;
    S.span(K.goldIn, -gh, F, zz0, -D, GC, zz1);
    S.span(K.goldIn, D, F, zz0, gh, GC, zz1);
    S.span(K.goldIn, -D, F + 2.5, zz0, D, GC, zz1);
    const xx0 = s > 0 ? zin - gp : zin, xx1 = s > 0 ? zin : zin + gp;
    S.span(K.goldIn, xx0, F, -gh, xx1, GC, -D);
    S.span(K.goldIn, xx0, F, D, xx1, GC, gh);
    S.span(K.goldIn, xx0, F + 2.5, -D, xx1, GC, D);
  }
  // door reveals clad in gold
  for (const s of [1, -1]) {
    for (const u of [-D, D]) {
      S.span(K.goldPlain, u - (u < 0 ? 0 : 0.02), F, s > 0 ? gh : -gh - 0.42, u + (u < 0 ? 0.02 : 0), F + 2.5, s > 0 ? gh + 0.42 : -gh);
      S.span(K.goldPlain, s > 0 ? gh : -gh - 0.42, F, u - (u < 0 ? 0 : 0.02), s > 0 ? gh + 0.42 : -gh, F + 2.5, u + (u < 0 ? 0.02 : 0));
    }
  }
  // ceiling: gold with a central inverted lotus
  S.span(K.goldCeil, -gh, GC, -gh, gh, GC + 0.08, gh);
  const lotus = lathe([[0, 0], [0.9, 0], [0.85, -0.06], [0.6, -0.14], [0.35, -0.2], [0.12, -0.3], [0, -0.32]], 32, 16, 0.08);
  S.place(K.goldCeil, lotus, 0, GC, 0);
  // cornice and dado bands
  for (const y of [F + 0.04, GC - 0.18]) {
    for (const s of [1, -1]) {
      S.span(K.goldPlain, -gh, y, s > 0 ? gh - 0.07 : -gh, -D - 0.1, y + 0.14, s > 0 ? gh : -gh + 0.07);
      S.span(K.goldPlain, D + 0.1, y, s > 0 ? gh - 0.07 : -gh, gh, y + 0.14, s > 0 ? gh : -gh + 0.07);
      S.span(K.goldPlain, s > 0 ? gh - 0.07 : -gh, y, -gh, s > 0 ? gh : -gh + 0.07, y + 0.14, -D - 0.1);
      S.span(K.goldPlain, s > 0 ? gh - 0.07 : -gh, y, D + 0.1, s > 0 ? gh : -gh + 0.07, y + 0.14, gh);
    }
  }
  // twisted gold pilasters flanking every doorway (inside): a crisp three-strand rope
  // (36 × 64 segments, rounded strands with sharp grooves), on a moulded base and under a capital
  const TW = 2.23;
  const twist = (() => {
    const c = new THREE.CylinderGeometry(0.08, 0.08, TW, 36, 64, true);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const f = 0.5 + 0.5 * Math.cos(a * 3 - y * 7.5);
      const k = 0.8 + 0.2 * Math.sqrt(f);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    c.deleteAttribute('uv');
    c.computeVertexNormals();
    return c.translate(0, TW / 2, 0);
  })();
  const capTop = lathe([[0.075, 0], [0.13, 0.02], [0.16, 0.07], [0.1, 0.12], [0.16, 0.18], [0.16, 0.22], [0, 0.22]], 32);
  const capBase = lathe([[0.17, 0], [0.17, 0.05], [0.12, 0.09], [0.15, 0.14], [0.11, 0.2], [0.075, 0.22]], 32);
  for (const [x, z] of [[-D - 0.12, gh - 0.12], [D + 0.12, gh - 0.12], [-D - 0.12, -gh + 0.12], [D + 0.12, -gh + 0.12],
    [gh - 0.12, -D - 0.12], [gh - 0.12, D + 0.12], [-gh + 0.12, -D - 0.12], [-gh + 0.12, D + 0.12]]) {
    S.place(K.goldPlain, capBase, x, F, z);
    S.place(K.goldPlain, twist, x, F + 0.22, z);
    S.place(K.goldPlain, capTop, x, F + 0.22 + TW, z);
  }
  // gold lattice door leaves, folded right back against the inner wall beside each doorway
  const leafBars = (cx: number, cz: number, along: 'x' | 'z') => {
    const w = 0.5, h = 2.35, t = 0.035;
    S.offset.set(cx, F, cz);
    const bx = (bw: number, bh: number, u: number, y: number) =>
      S.box(K.goldPlain, along === 'x' ? bw : t, bh, along === 'x' ? t : bw, along === 'x' ? u : 0, y, along === 'z' ? u : 0);
    bx(w, 0.07, 0, 0); bx(w, 0.07, 0, h - 0.07); bx(0.06, h, -w / 2 + 0.03, 0); bx(0.06, h, w / 2 - 0.03, 0);
    bx(w, 0.06, 0, h * 0.62);
    for (let i = 1; i < 7; i++) bx(0.014, h * 0.62 - 0.07, -w / 2 + (i * w) / 7, 0.07);
    for (let j = 1; j < 14; j++) bx(w - 0.08, 0.014, 0, 0.07 + (j * (h * 0.62 - 0.07)) / 14);
    bx(w - 0.08, h * 0.38 - 0.13, 0, h * 0.62 + 0.06);
    S.offset.set(0, 0, 0);
    if (along === 'z') P.solid(cx - 0.04, F, cz - w / 2, cx + 0.04, F + h, cz + w / 2);
    else P.solid(cx - w / 2, F, cz - 0.04, cx + w / 2, F + h, cz + 0.04);
  };
  for (const s of [1, -1]) {
    for (const u of [-1, 1]) {
      leafBars(u * (D + 0.52), s * (gh - 0.09), 'x'); // east/west doors
      leafBars(s * (gh - 0.09), u * (D + 0.52), 'z'); // north/south doors
    }
  }

  // ---------- the silver basin (jalahari) ----------
  // a polished silver box standing a hand's breadth and more above the marble floor: plain outer walls on a
  // moulded plinth, a broad flat coping with a rope moulding, repoussé inside, square posts at the corners
  // carrying onion knobs
  const rw = 0.1; // wall thickness
  const top = F + rim; // the coping's top
  const walls: [number, number, number, number][] = [
    [-hx - rw, hx + rw, hz, hz + rw], [-hx - rw, hx + rw, -hz - rw, -hz], [-hx - rw, -hx, -hz, hz], [hx, hx + rw, -hz, hz],
  ];
  for (const [x0, x1, z0, z1] of walls) S.span(K.silverBright, x0, F - 0.02, z0, x1, top - 0.035, z1);
  // plinth moulding at the foot, the coping (overhanging outside) and the rope on its inner edge
  const o = 0.025;
  for (const [x0, x1, z0, z1] of [
    [-hx - rw - o, hx + rw + o, hz + rw - 0.01, hz + rw + o], [-hx - rw - o, hx + rw + o, -hz - rw - o, -hz - rw + 0.01],
    [-hx - rw - o, -hx - rw + 0.01, -hz - rw, hz + rw], [hx + rw - 0.01, hx + rw + o, -hz - rw, hz + rw],
  ]) S.span(K.silverBright, x0, F, z0, x1, F + 0.045, z1);
  for (const [x0, x1, z0, z1] of [
    [-hx - rw - o, hx + rw + o, hz - 0.01, hz + rw + o], [-hx - rw - o, hx + rw + o, -hz - rw - o, -hz + 0.01],
    [-hx - rw - o, -hx + 0.01, -hz, hz], [hx - 0.01, hx + rw + o, -hz, hz],
  ]) S.span(K.silverBright, x0, top - 0.035, z0, x1, top, z1);
  for (const [x0, x1, z0, z1] of [[-hx, hx, hz - 0.02, hz + 0.01], [-hx, hx, -hz - 0.01, -hz + 0.02], [-hx - 0.01, -hx + 0.02, -hz, hz], [hx - 0.02, hx + 0.01, -hz, hz]]) {
    S.span(K.silverBright, x0, top, z0, x1, top + 0.02, z1);
  }
  // inner walls (repoussé), from the basin floor up to the coping
  const sk = 0.012;
  S.span(K.basinSilver, -hx, bot, hz - sk, hx, top - 0.035, hz);
  S.span(K.basinSilver, -hx, bot, -hz, hx, top - 0.035, -hz + sk);
  S.span(K.basinSilver, -hx, bot, -hz, -hx + sk, top - 0.035, hz);
  S.span(K.basinSilver, hx - sk, bot, -hz, hx, top - 0.035, hz);
  // wet white marble floor under the milk
  S.span(K.whiteMarble, -hx, bot - 0.04, -hz, hx, bot, hz);
  // square corner posts, a little taller than the coping, each with a moulded cap and an onion knob
  const knob = lathe([[0, 0], [0.06, 0], [0.06, 0.04], [0.04, 0.06], [0.075, 0.12], [0.06, 0.17], [0.025, 0.21], [0.03, 0.23], [0, 0.26]], 20, 12, 0.06);
  const pw = 0.15, ptop = top + 0.08;
  for (const [x, z] of [[-hx - rw / 2, -hz - rw / 2], [hx + rw / 2, -hz - rw / 2], [-hx - rw / 2, hz + rw / 2], [hx + rw / 2, hz + rw / 2]]) {
    S.box(K.silverBright, pw, ptop - F, pw, x, F, z);
    S.box(K.silverBright, pw + 0.03, 0.03, pw + 0.03, x, ptop - 0.03, z);
    S.box(K.silverBright, pw + 0.03, 0.05, pw + 0.03, x, F, z);
    S.place(K.silverBright, knob, x, ptop, z, 0, 0.95);
  }
  P.solid(-hx - rw - o, F - 0.5, -hz - rw - o, hx + rw + o, F + 0.7, hz + rw + o);
  // a thin red stone band inlaid in the marble floor, framing the basin
  for (const [x0, x1, z0, z1] of [[-1.42, 1.42, 1.3, 1.36], [-1.42, 1.42, -1.36, -1.3], [-1.42, -1.36, -1.3, 1.3], [1.36, 1.42, -1.3, 1.3]]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), redInlay);
    band.position.set((x0 + x1) / 2, F + 0.003, (z0 + z1) / 2);
    band.receiveShadow = true;
    g.add(band);
  }

  // ---------- gold pitha, pranala and the Jyotirlinga ----------
  const lx = 0.08, lz = 0.12; // the lingam sits a little off-centre, toward the east (front) door
  // broad gold pitha (≈ 2.8 × the linga's diameter) with three raised concentric rings, as in the trust's photographs
  const pitha = lathe([
    [0, 0], [0.42, 0], [0.42, 0.03], [0.405, 0.045], [0.39, 0.055], [0.375, 0.045], [0.35, 0.04],
    [0.33, 0.05], [0.315, 0.068], [0.3, 0.078], [0.285, 0.068], [0.265, 0.062],
    [0.245, 0.07], [0.23, 0.088], [0.215, 0.098], [0.2, 0.09], [0.17, 0.1], [0.15, 0.105], [0, 0.105],
  ], 64);
  // stepped rings as in the trust's darshan photographs: a white marble base, the broad gold pitha,
  // and a raised white marble collar round the lingam
  const pb = 0.035; // gold pitha sits on the marble base
  S.place(K.whiteMarble, lathe([[0, 0], [0.5, 0], [0.5, 0.03], [0.48, 0.04], [0, 0.04]], 64), lx, bot, lz);
  S.place(K.goldPlain, pitha, lx, bot + pb, lz);
  // a raised gold collar round the lingam's foot
  S.place(K.goldPlain, lathe([[0.222, 0.098], [0.222, 0.12], [0.205, 0.136], [0.165, 0.136], [0.148, 0.124], [0.148, 0.1]], 64), lx, bot + pb, lz);
  // the gold pranala: the yoni's long spout, tapering to a point toward the north (+x), with a channel down it
  {
    const out = new THREE.Shape();
    out.moveTo(0.18, -0.24);
    out.quadraticCurveTo(0.5, -0.17, 0.69, 0);
    out.quadraticCurveTo(0.5, 0.17, 0.18, 0.24);
    out.lineTo(0.18, -0.24);
    const slot = new THREE.Path();
    slot.moveTo(0.36, -0.03);
    slot.lineTo(0.62, -0.006);
    slot.lineTo(0.62, 0.006);
    slot.lineTo(0.36, 0.03);
    slot.lineTo(0.36, -0.03);
    const spout = (sh: THREE.Shape, h: number) =>
      new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 }).rotateX(-Math.PI / 2);
    const rimmed = out.clone();
    rimmed.holes.push(slot);
    S.place(K.goldPlain, spout(rimmed, 0.075), lx, bot + pb, lz);
    S.place(K.goldPlain, spout(out, 0.03), lx, bot + pb, lz); // the channel's floor
  }
  const L = lingamGeo(0.142, 0.33, 0.035, 64);
  S.place(K.lingam, L, lx, bot + pb + 0.1, lz);
  const lTop = bot + pb + 0.1 + 0.33;
  // milk film clinging to the pitha, and the pooled milky water
  // a thin trickle of milk running off the pitha toward the pranala
  S.span(K.milk, lx + 0.38, bot + pb + 0.042, lz - 0.015, lx + 0.64, bot + pb + 0.046, lz + 0.015);
  // the basin filled with milk and water, pale and creamy, up to the jaladhari's rim
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2 - 0.02, hz * 2 - 0.02).rotateX(-Math.PI / 2), K.milkFilm);
  pool.position.set(0, W, 0);
  pool.renderOrder = 2;
  g.add(pool);
  // the hanging jaladhari: a silver kalash on three chains, a thin milky stream onto the lingam's crown
  const jy = F + 1.45;
  const jal = lathe([[0, -0.03], [0.04, -0.01], [0.13, 0.06], [0.16, 0.16], [0.12, 0.26], [0.06, 0.3], [0.08, 0.34], [0.07, 0.35], [0, 0.33]], 32);
  S.place(K.silverBright, jal, lx, jy, lz);
  const hook = new THREE.Vector3(lx, F + 2.12, lz);
  const rod = (mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(r, r, len, 5, Math.max(1, Math.round(len / 0.03)));
    // chain links: pinch the rod every 3 cm
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.6 + 0.4 * Math.abs(Math.sin((p.getY(i) / 0.03) * Math.PI)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1));
    S.add(mat, geo, m);
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    rod(K.silverBright, new THREE.Vector3(lx + Math.cos(a) * 0.075, jy + 0.34, lz + Math.sin(a) * 0.075), hook, 0.005);
  }
  const streamGeo = new THREE.CylinderGeometry(0.004, 0.005, jy - 0.03 - lTop, 10, 1, true);
  const st = new THREE.Mesh(streamGeo, K.stream);
  st.position.set(lx, (jy - 0.03 + lTop) / 2, lz);
  st.renderOrder = 3;
  g.add(st);
  // silver chhatra (≈ 0.9 m across): a ribbed lotus with a repoussé underside, a fringe of little bells
  const cy = F + 2.25;
  const chh = lathe([[0, 0.3], [0.12, 0.29], [0.3, 0.2], [0.42, 0.08], [0.45, 0.02], [0.44, -0.01], [0.3, 0.06], [0.12, 0.15], [0, 0.18]], 64, 16, 0.07);
  S.place(K.chhatraSilver, chh, lx, cy, lz);
  S.place(K.silverBright, lathe([[0, -0.06], [0.03, -0.05], [0.04, 0], [0.02, 0.04], [0, 0.04]], 16), lx, cy + 0.14, lz); // bud under the centre
  rod(K.silverBright, new THREE.Vector3(lx, cy + 0.12, lz), hook, 0.006);
  const tinybell = lathe([[0, 0.05], [0.015, 0.05], [0.025, 0.02], [0.03, 0], [0, 0.005]], 10);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    S.place(K.brass, tinybell, lx + Math.cos(a) * 0.43, cy - 0.06, lz + Math.sin(a) * 0.43);
  }
  S.box(K.silverBright, 0.02, GC - cy - 0.3, 0.02, lx, cy + 0.3, lz);

  // ---------- adornment ----------
  // bel leaves (trifoliate) laid on the crown, a white flower and a red rose
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    O.add('bel', lx + Math.cos(a) * 0.05, lTop - 0.01 - (i % 2) * 0.01, lz + Math.sin(a) * 0.05, 1.3, undefined, a + Math.PI, 0.9);
  }
  O.add('rose', lx, lTop + 0.012, lz, 1.1);
  for (let i = 0; i < 6; i++) O.add('jasmine', lx + 0.03 * Math.cos(i), lTop + 0.004, lz + 0.03 * Math.sin(i), 1.2, undefined, i, 1.2);
  // a few flowers at the lingam's foot only, so the pitha's rings show; petals and bel floating on the milk
  for (let i = 0; i < 7; i++) {
    const a = 2.2 + i * 0.32;
    O.add(i % 3 ? 'marigold' : 'mogra', lx + Math.cos(a) * 0.3, bot + pb + 0.11, lz + Math.sin(a) * 0.3, 1);
  }
  O.scatter(-hx + 0.05, hx - 0.05, -hz + 0.05, hz - 0.05, W + 0.002, 14, 0.3);
  // a yellow cloth folded over the coping at the north-west corner, where the priest wipes the lingam
  {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.2), new THREE.MeshStandardMaterial({ color: 0xd8b85a, roughness: 0.95 }));
    cloth.position.set(-hx + 0.12, top + 0.03, -hz - rw / 2 + 0.02);
    cloth.rotation.y = 0.3;
    g.add(cloth);
  }

  // ---------- around the basin ----------
  // red patterned carpets where the priests sit (north-west and south-west), puja vessels
  const carpet = carpetMaterial();
  for (const [x0, x1, z0, z1] of [[-gh + 0.15, -hx - 0.2, -gh + 0.6, gh - 0.6], [hx + 0.2, gh - 0.15, -gh + 0.6, -0.1]]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), carpet);
    c.position.set((x0 + x1) / 2, F + 0.008, (z0 + z1) / 2);
    c.receiveShadow = true;
    g.add(c);
  }
  const lota = lathe([[0, 0], [0.08, 0], [0.12, 0.06], [0.12, 0.12], [0.06, 0.2], [0.05, 0.24], [0.08, 0.27], [0, 0.27]], 24);
  S.place(K.silver, lota, hx + 0.45, F, -0.6);
  S.place(K.brass, lota, hx + 0.7, F, -0.85, 0, 0.8);
  S.place(K.silver, kalashGeo(0.42), -hx - 0.5, F, 0.7);
  const thali = lathe([[0, 0], [0.2, 0], [0.22, 0.03], [0.2, 0.025], [0, 0.01]], 32);
  S.place(K.brass, thali, -hx - 0.55, F, -0.4);
  O.heap(-hx - 0.55, F + 0.03, -0.4, 0.15, 0.06, 14);
  // prasad on a small brass plate: a dozen laddoos and white pedas
  S.place(K.brass, thali, hx + 0.6, F, 0.75, 0, 0.9);
  const laddoo = new THREE.SphereGeometry(0.026, 14, 10);
  const peda = new THREE.CylinderGeometry(0.024, 0.026, 0.016, 16).translate(0, 0.008, 0);
  const lMat = new THREE.MeshStandardMaterial({ color: 0xe0962c, roughness: 0.85 });
  const pMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.8 });
  for (let i = 0; i < 12; i++) {
    const ring = i < 7 ? 0.1 : i < 11 ? 0.05 : 0, a = (i / (i < 7 ? 7 : 4)) * Math.PI * 2;
    const x = hx + 0.6 + Math.cos(a) * ring, z = 0.75 + Math.sin(a) * ring, y = F + 0.009 + (i < 7 ? 0 : i < 11 ? 0.038 : 0.074);
    if (i % 3 === 2 && i < 7) S.place(pMat, peda, x, y, z, a);
    else S.place(lMat, laddoo, x, y + 0.024, z);
  }

  // brass lamp stands in the corners (the lamps flicker), hanging brass lamp chains
  const stand = lathe([[0, 0], [0.16, 0], [0.12, 0.05], [0.03, 0.1], [0.03, 0.85], [0.06, 0.88], [0.14, 0.92], [0.12, 0.96], [0, 0.95]], 16);
  for (const [x, z] of [[1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    S.place(K.brass, stand, x, F, z);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flames.points.push(new THREE.Vector3(x + Math.cos(a) * 0.1, F + 0.99, z + Math.sin(a) * 0.1));
    }
  }
  // the akhand deep in the north-west corner: a silver lamp on a slender stand under a domed silver hood,
  // its single flame never let go out
  {
    const ax = -1.6, az = -1.6;
    S.place(K.silverBright, lathe([[0, 0], [0.14, 0], [0.14, 0.015], [0.1, 0.03], [0.03, 0.05], [0.02, 0.06], [0, 0.06]], 32), ax, F, az); // dish
    S.place(K.silverBright, lathe([[0.018, 0], [0.018, 0.5], [0.03, 0.52], [0.02, 0.56], [0, 0.56]], 16), ax, F + 0.05, az); // stem
    S.place(K.brass, lathe([[0, 0], [0.04, 0], [0.09, 0.04], [0.1, 0.06], [0.085, 0.06], [0, 0.04]], 32), ax, F + 0.61, az); // oil bowl
    // the hood on a bent rod rising from behind the stand
    S.box(K.silverBright, 0.016, 0.42, 0.016, ax - 0.13, F + 0.45, az - 0.13);
    const hood = lathe([[0, 0.17], [0.05, 0.165], [0.14, 0.12], [0.2, 0.05], [0.22, 0], [0.21, -0.01], [0.13, 0.08], [0.04, 0.12], [0, 0.125]], 48, 24, 0.03);
    S.place(K.silverBright, hood, ax, F + 0.87, az);
    S.place(K.silverBright, lathe([[0, 0], [0.03, 0], [0.035, 0.04], [0.015, 0.09], [0, 0.11]], 16), ax, F + 0.87 + 0.17, az); // finial
    flames.points.push(new THREE.Vector3(ax + 0.06, F + 0.69, az));
  }
  S.flush(g, false);
  for (const [x, z] of [[-1.2, 0.6], [1.2, -0.6]]) {
    const l = new THREE.PointLight(0xffa850, 2.6, 6, 1.7);
    l.position.set(x, F + 1.5, z);
    g.add(l);
    flames.lights.push(l);
  }
  return { lingamTop: lTop };
}

/** Maroon temple carpet with a dense small floral/paisley field and a cream border (canvas). */
function carpetMaterial() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6e1016';
  g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#d9c38a';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 244, 500);
  g.fillStyle = '#2b1a3a';
  g.fillRect(14, 14, 228, 10); g.fillRect(14, 488, 228, 10);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 34; y < 480; y += 22) {
    for (let x = 24 + ((y / 22) % 2) * 11; x < 236; x += 22) {
      const a = rnd() * Math.PI;
      g.fillStyle = ['#c8a050', '#e6d6b0', '#b8282a', '#3b5b8a'][Math.floor(rnd() * 4)];
      g.beginPath(); g.ellipse(x, y, 5, 2.6, a, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8c070';
      g.beginPath(); g.arc(x + 4, y - 3, 1.6, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import type { VM } from './mats';
import type { Merger } from './merge';
import type { Offerings } from './offerings';
import { lathe, pennant, ribbon, sagCurve } from './forms';
import { COURT, GATE, kanwar } from './complex';
import { leafTrees } from './trees';

/**
 * Deoghar round Baba Dham: a dense knot of 2–5 storey houses and lodges pressed against the
 * temple walls, flat roofs with black water tanks and rooftop rooms, big hoardings looking into
 * the courtyard, and the approach lane to the Singh Dwar lined with pera shops, puja stalls and
 * kanwar sellers under tarpaulin awnings, electric poles webbed with wires, saffron bunting.
 * No readable text or brands anywhere.
 */

/**
 * Shivganga: the big tank ~300 m north-east of the temple (OSM "Deoghar talab / Shivganga") where
 * pilgrims bathe before darshan — stepped ghats on all sides, lamp posts along the top.
 */
export const SHIVGANGA = { x0: 225, x1: 345, z0: 205, z1: 365 };

/** the approach lane to the east gate */
export const LANE = { x0: -3.6, x1: 3.6, z0: COURT.z1 + 0.7, z1: 118 };
/** the few trees near enough to need the full scanned model (each costs ~8 draw calls) */
export const NEAR_TREES: [number, number, number][] = [[-42, 6, 11], [38, -36, 9], [46, 34, 12], [-20, 62, 10]];
/** every tree spot (the far ones are drawn as cheap instanced canopies) */
export const TOWN_TREES: [number, number, number][] = [
  [-42, 6, 11], [38, -36, 9], [-44, -40, 10], [46, 34, 12], [-20, 62, 10], [24, 88, 9],
  // the tree cover north-west of the compound (+x north, −z west), as in the drone view
  [52, -48, 12], [66, -56, 13], [58, -70, 12], [82, -60, 10], [74, -42, 11], [96, -74, 13], [48, -84, 12], [88, -94, 11],
];

let seed = 31;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function buildTown(root: THREE.Group, B: Merger, V: VM, P: Physics, flames: Flames, O: Offerings) {
  const cx0 = COURT.x0 - COURT.wallT, cx1 = COURT.x1 + COURT.wallT, cz0 = COURT.z0 - COURT.wallT, cz1 = COURT.z1 + COURT.wallT;

  // ---- ground: the lane is walkable, the rest is a visual apron of worn concrete and earth
  // the ground apron, with a hole for the Shivganga tank
  {
    const { x0, x1, z0, z1 } = SHIVGANGA;
    // out to 2.5 km so the haze, not a square plateau edge, ends the town
    const E = 2500;
    B.span(V.road, -E, -0.25, -E, E, -0.03, z0);
    B.span(V.road, -E, -0.25, z1, E, -0.03, E);
    B.span(V.road, -E, -0.25, z0, x0, -0.03, z1);
    B.span(V.road, x1, -0.25, z0, E, -0.03, z1);
  }
  B.span(V.road, LANE.x0, -0.2, LANE.z0, LANE.x1, 0.0, LANE.z1);
  P.floor(root, LANE.x0, LANE.x1, LANE.z0, LANE.z1, 0);
  // a service lane round the outside of the walls (walkable) — out through the north gate
  P.floor(root, cx1, cx1 + 4, cz0, cz1 + 4, -0.03);
  B.span(V.road, cx1, -0.2, cz0, cx1 + 4, -0.02, cz1 + 4);

  const pera: THREE.Matrix4[] = [];
  // shop stock, instanced per prop type: brass/steel lotas, bangle racks, folded cloth and sweet
  // boxes, hanging saffron cloths, and the tinsel tassels / kanwar decorations
  type PropKind = 'lota' | 'bangles' | 'fold' | 'cloth' | 'tassel';
  const props: Record<PropKind, { m: THREE.Matrix4[]; c: THREE.Color[] }> = { lota: { m: [], c: [] }, bangles: { m: [], c: [] }, fold: { m: [], c: [] }, cloth: { m: [], c: [] }, tassel: { m: [], c: [] } };
  const METAL = [0xc9a24a, 0xb8913c, 0xcfcfcf, 0xb5b5b5, 0xb87333];
  const BANGLE = [0xc0182a, 0x1f7a3a, 0xd4a017, 0x2a4fb0, 0xb0157a, 0xe8731a, 0x7a1fa0];
  const CLOTH = [0xe8731a, 0xd65a12, 0xe8731a, 0xc0182a, 0xf2c230, 0xd65a12, 0xf4efe6];
  const BOX = [0xf2ede2, 0xf3d9df, 0xf1e4b8, 0xe9e2d0];
  const pick = (a: number[]) => a[Math.floor(rnd() * a.length)];
  const prop = (k: PropKind, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number, col: number) => {
    props[k].m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz)));
    props[k].c.push(new THREE.Color(col).offsetHSL(0, 0, (rnd() - 0.5) * 0.08));
  };

  // ---- one building
  const house = (x0: number, z0: number, x1: number, z1: number, storeys: number, front: 'x+' | 'x-' | 'z+' | 'z-' | null, shop: boolean) => {
    const fac = V.facades[Math.floor(rnd() * V.facades.length)];
    const H = storeys * 3 + (rnd() < 0.3 ? 0.6 : 0);
    B.span(fac, x0, 0, z0, x1, H, z1);
    P.solid(x0, 0, z0, x1, H, z1);
    // roof slab + parapet
    B.span(V.roof, x0 - 0.12, H, z0 - 0.12, x1 + 0.12, H + 0.18, z1 + 0.12);
    const pt = 0.15, ph = 0.9;
    B.span(fac, x0 - 0.1, H + 0.18, z0 - 0.1, x1 + 0.1, H + ph, z0 + pt);
    B.span(fac, x0 - 0.1, H + 0.18, z1 - pt, x1 + 0.1, H + ph, z1 + 0.1);
    B.span(fac, x0 - 0.1, H + 0.18, z0, x0 + pt, H + ph, z1);
    B.span(fac, x1 - pt, H + 0.18, z0, x1 + 0.1, H + ph, z1);
    // floor-slab projections (chhajjas) on every storey of the front
    const w = x1 - x0, d = z1 - z0;
    for (let s = 1; s < storeys; s++) {
      const y = s * 3;
      if (front === 'x+') B.span(V.roof, x1, y - 0.05, z0, x1 + 0.6, y + 0.1, z1);
      else if (front === 'x-') B.span(V.roof, x0 - 0.6, y - 0.05, z0, x0, y + 0.1, z1);
      else if (front === 'z+') B.span(V.roof, x0, y - 0.05, z1, x1, y + 0.1, z1 + 0.6);
      else if (front === 'z-') B.span(V.roof, x0, y - 0.05, z0 - 0.6, x1, y + 0.1, z0);
    }
    // a balcony with a railing on one upper storey
    if (front && storeys >= 3 && rnd() < 0.6) {
      const y = 3 * (1 + Math.floor(rnd() * (storeys - 1)));
      const along = front === 'x+' || front === 'x-';
      const u0 = (along ? z0 : x0) + w * 0.0 + 0.6, u1 = (along ? z1 : x1) - 0.6;
      const o = front === 'x+' ? x1 + 1.1 : front === 'x-' ? x0 - 1.1 : front === 'z+' ? z1 + 1.1 : z0 - 1.1;
      if (along) { B.span(V.iron, o - 0.04, y + 0.1, u0, o + 0.04, y + 1.0, u1); }
      else { B.span(V.iron, u0, y + 0.1, o - 0.04, u1, y + 1.0, o + 0.04); }
    }
    // black water tanks (and sometimes a stair room) on the roof
    // a blue or teal tarpaulin stretched over part of some roofs
    if (rnd() < 0.15) {
      const tw2 = w * (0.4 + rnd() * 0.5), td = d * (0.4 + rnd() * 0.5);
      const tx0 = x0 + rnd() * (w - tw2), tz0 = z0 + rnd() * (d - td);
      B.span(rnd() < 0.7 ? V.tarpBlue : V.tarpTeal, tx0, H + 2.2, tz0, tx0 + tw2, H + 2.24, tz0 + td);
      for (const [px, pz] of [[tx0, tz0], [tx0 + tw2, tz0], [tx0, tz0 + td], [tx0 + tw2, tz0 + td]]) B.span(V.iron, px - 0.03, H + 0.18, pz - 0.03, px + 0.03, H + 2.2, pz + 0.03);
    }
    const nt = rnd() < 0.75 ? 1 + Math.floor(rnd() * 2) : 0;
    for (let i = 0; i < nt; i++) {
      const tx = x0 + 0.9 + rnd() * Math.max(0.1, w - 1.8), tz = z0 + 0.9 + rnd() * Math.max(0.1, d - 1.8);
      B.place(V.tank, lathe([[0.55, 0], [0.6, 0.08], [0.6, 1.05], [0.5, 1.2], [0.2, 1.25], [0.2, 1.32], [0, 1.32]], 14), tx, H + 0.18 + 0.35, tz);
      B.span(V.iron, tx - 0.6, H + 0.18, tz - 0.6, tx + 0.6, H + 0.53, tz + 0.6);
    }
    if (rnd() < 0.35) {
      const sx = x0 + 0.3, sz = z0 + 0.3;
      B.span(fac, sx, H + 0.18, sz, sx + 2.6, H + 2.8, sz + 3.0);
      B.span(V.roof, sx - 0.1, H + 2.8, sz - 0.1, sx + 2.7, H + 2.95, sz + 3.1);
    }
    // AC units / dish on the sides
    if (rnd() < 0.5) B.span(V.steel, x0 + w * 0.3, 3 * Math.ceil(rnd() * storeys) - 1.2, z1, x0 + w * 0.3 + 0.8, 3 * Math.ceil(rnd() * storeys) - 0.65, z1 + 0.3);
    // ground-floor shopfront on the front
    if (shop && front) {
      const along = front === 'x+' || front === 'x-';
      const ua = along ? z0 : x0, ub = along ? z1 : x1;
      const n = Math.max(1, Math.floor((ub - ua) / 3.2));
      for (let i = 0; i < n; i++) {
        const sa = ua + 0.35 + i * ((ub - ua) / n), sb = sa + (ub - ua) / n - 0.7;
        // dark interior, rolled-up shutter, awning, counter with goods
        const f = front === 'x+' ? x1 : front === 'x-' ? x0 : front === 'z+' ? z1 : z0;
        const sg = front === 'x+' || front === 'z+' ? 1 : -1;
        const box = (a0: number, a1: number, y0: number, y1: number, o0: number, o1: number, mat: THREE.Material, solid = false) => {
          if (along) B.span(mat, Math.min(f + sg * o0, f + sg * o1), y0, a0, Math.max(f + sg * o0, f + sg * o1), y1, a1, solid);
          else B.span(mat, a0, y0, Math.min(f + sg * o0, f + sg * o1), a1, y1, Math.max(f + sg * o0, f + sg * o1), solid);
        };
        // the shop's inside: a tube-lit back wall (~25-30% grey), not a black hole
        box(sa, sb, 0, 2.7, -0.02, 0.01, V.shopBack);
        {
          const um = (sa + sb) / 2;
          box(um - 0.6, um + 0.6, 2.26, 2.3, 0.01, 0.05, V.tube);
        }
        // the stock: one trade per shop, stacked irregularly (±30% sizes)
        const trade = Math.floor(rnd() * 5); // 0 lotas, 1 bangles, 2 cloth, 3 sweets, 4 mixed
        const at = (u: number, o: number) => (along ? [f + sg * o, u] : [u, f + sg * o]) as [number, number];
        const ryW = along ? (sg > 0 ? Math.PI / 2 : -Math.PI / 2) : (sg > 0 ? 0 : Math.PI);
        const shelves = rnd() < 0.5 ? [1.3] : [1.15, 1.75];
        for (const y of shelves) {
          const sy = y + (rnd() - 0.5) * 0.12;
          box(sa + 0.05, sb - 0.05, sy, sy + 0.035, 0.01, 0.3, V.wood);
          const top = sy + 0.035;
          for (let u = sa + 0.15; u < sb - 0.15;) {
            const t = trade === 4 ? Math.floor(rnd() * 4) : trade;
            const j = 0.7 + rnd() * 0.6;
            const [x, z] = at(u, 0.08 + rnd() * 0.14);
            if (t === 0) {
              const c = pick(METAL);
              prop('lota', x, top, z, rnd() * 6, j, j, j, c);
              if (rnd() < 0.35) prop('lota', x + (rnd() - 0.5) * 0.03, top + 0.16 * j, z + (rnd() - 0.5) * 0.03, rnd() * 6, j * 0.75, j * 0.75, j * 0.75, c);
              u += 0.14 * j + 0.03 + rnd() * 0.05;
            } else if (t === 1) {
              prop('bangles', x, top, z, ryW + (rnd() - 0.5) * 0.3, j, 0.8 + rnd() * 0.5, j, pick(BANGLE));
              u += 0.1 * j + 0.03;
            } else if (t === 2) {
              const n = 2 + Math.floor(rnd() * 5);
              let yy = top;
              for (let q = 0; q < n; q++) { const h = 0.7 + rnd() * 0.6; prop('fold', x + (rnd() - 0.5) * 0.03, yy, z + (rnd() - 0.5) * 0.03, ryW + (rnd() - 0.5) * 0.2, j, h, j, pick(CLOTH)); yy += 0.035 * h; }
              u += 0.3 * j + 0.04;
            } else {
              const n = 1 + Math.floor(rnd() * 4);
              let yy = top;
              const c = pick(BOX);
              for (let q = 0; q < n; q++) { prop('fold', x + (rnd() - 0.5) * 0.04, yy, z, ryW + (rnd() - 0.5) * 0.35, j * 0.75, 2.2, j * 0.7, c); yy += 0.077; }
              u += 0.24 * j + 0.05;
            }
            if (rnd() < 0.12) u += 0.2;
          }
        }
        // hanging stock along the front: saffron cloths and vests, tinsel tassels and kanwar trimmings
        if (trade === 2 || trade === 4 || rnd() < 0.3) {
          for (let u = sa + 0.3; u < sb - 0.3; u += 0.42 + rnd() * 0.2) {
            const [x, z] = at(u, 0.55 + rnd() * 0.15);
            if (rnd() < 0.6) prop('cloth', x, 2.3, z, ryW + (rnd() - 0.5) * 0.4, 0.8 + rnd() * 0.4, 0.8 + rnd() * 0.5, 1, pick(CLOTH));
            else prop('tassel', x, 2.3, z, rnd() * 6, 0.8 + rnd() * 0.5, 0.8 + rnd() * 0.6, 0.8 + rnd() * 0.5, pick([0xd4a017, 0xc0182a, 0xe8731a, 0xb0157a]));
          }
        }
        box(sa, sb, 2.35, 2.75, 0.01, 0.14, V.steel);
        // the shop's signboard above the awning (illegible lettering from the banner atlas)
        {
          const g = new THREE.PlaneGeometry(sb - sa + 0.2, 0.7);
          const uv = g.attributes.uv, cell = [12, 13, 12, 13, 1, 9, 3, 15, 10, 14][Math.floor(rnd() * 10)];
          for (let k = 0; k < uv.count; k++) uv.setXY(k, ((cell % 4) + uv.getX(k)) / 4, (Math.floor(cell / 4) + uv.getY(k)) / 4);
          const n = along ? new THREE.Vector3(sg, 0, 0) : new THREE.Vector3(0, 0, sg);
          const cx = along ? f + sg * 0.03 : (sa + sb) / 2, cz = along ? (sa + sb) / 2 : f + sg * 0.03;
          B.add(V.boards, g, new THREE.Matrix4().compose(new THREE.Vector3(cx, 3.35, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(n.x, n.z)), new THREE.Vector3(1, 1, 1)), true);
        }
        const aw = [V.tarpBlue, V.saffron, V.banner, V.tarpTeal][Math.floor(rnd() * 4)];
        // sloped awning: a thin plate tilted out over the lane
        const aG = new THREE.BoxGeometry(along ? 1.5 : sb - sa + 0.3, 0.04, along ? sb - sa + 0.3 : 1.5);
        const ang = 0.28 * sg;
        const cxp = along ? f + sg * 0.75 : (sa + sb) / 2, czp = along ? (sa + sb) / 2 : f + sg * 0.75;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(cxp, 2.75, czp),
          new THREE.Quaternion().setFromEuler(along ? new THREE.Euler(0, 0, -ang) : new THREE.Euler(ang, 0, 0)), new THREE.Vector3(1, 1, 1));
        B.add(aw, aG, m);
        // counter
        box(sa + 0.1, sb - 0.1, 0, 0.85, 0.05, 0.75, V.wood, true);
        // goods on the counter: pera trays (cone stacks), jars and bright packets
        const kind = rnd();
        const ctrY = 0.85;
        for (let g = 0; g < Math.floor((sb - sa) / 0.45); g++) {
          const u = sa + 0.3 + g * 0.45;
          const ox = f + sg * 0.4;
          const px = along ? ox : u, pz = along ? u : ox;
          if (kind < 0.55) {
            // a steel tray piled with pera: a low pyramid of little brown discs
            B.place(V.steel, lathe([[0, 0], [0.18, 0], [0.2, 0.025], [0.17, 0.008], [0, 0.008]], 14), px, ctrY, pz);
            for (let layer = 0; layer < 4; layer++) {
              const rr = 0.15 - layer * 0.035;
              const cnt = Math.max(1, Math.round((Math.PI * 2 * rr) / 0.045));
              for (let q = 0; q < cnt; q++) {
                const a = (q / cnt) * Math.PI * 2 + layer;
                pera.push(new THREE.Matrix4().compose(
                  new THREE.Vector3(px + Math.cos(a) * rr, ctrY + 0.02 + layer * 0.018, pz + Math.sin(a) * rr),
                  new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
              }
              if (rr < 0.05) break;
            }
          } else {
            // the counter: lotas and Gangajal pots, bangle racks or folded saffron cloth by trade
            const t = trade === 4 ? Math.floor(rnd() * 3) : trade % 3;
            for (let q = 0; q < 3; q++) {
              const j = 0.75 + rnd() * 0.6, x = px + (rnd() - 0.5) * 0.3, z = pz + (rnd() - 0.5) * 0.3;
              if (t === 0) prop('lota', x, ctrY, z, rnd() * 6, j * 1.2, j * 1.2, j * 1.2, pick(METAL));
              else if (t === 1) prop('bangles', x, ctrY, z, ryW + (rnd() - 0.5) * 0.6, j, j, j, pick(BANGLE));
              else { let yy = ctrY; for (let k2 = 0; k2 < 2 + Math.floor(rnd() * 3); k2++) { prop('fold', x, yy, z, ryW + (rnd() - 0.5) * 0.3, j, 1, j, pick(CLOTH)); yy += 0.035; } }
            }
          }
        }
        // hanging strings of red-yellow threads, bangles and kanwar bells over the counter
        if (kind >= 0.55 && rnd() < 0.7) {
          const a = along ? new THREE.Vector3(f + sg * 0.95, 2.45, sa + 0.2) : new THREE.Vector3(sa + 0.2, 2.45, f + sg * 0.95);
          const b = along ? new THREE.Vector3(f + sg * 0.95, 2.45, sb - 0.2) : new THREE.Vector3(sb - 0.2, 2.45, f + sg * 0.95);
          O.strand(a, b, 0.25, 1.1);
        }
      }
    }
  };

  // ---- the lane to the Singh Dwar: continuous shop-houses both sides
  for (const side of [-1, 1]) {
    let z = LANE.z0 + 0.4;
    while (z < LANE.z1 - 4) {
      const len = 5 + rnd() * 4;
      const xa = side < 0 ? LANE.x0 - 9 - rnd() * 3 : LANE.x1;
      const xb = side < 0 ? LANE.x0 : LANE.x1 + 9 + rnd() * 3;
      if (z > 62 && z < 66) { z = 66.5; continue; } // a cross lane
      house(xa, z, xb, Math.min(z + len, LANE.z1), 2 + Math.floor(rnd() * 4), side < 0 ? 'x+' : 'x-', true);
      z += len + 0.05;
    }
  }
  // cross lane floor
  B.span(V.road, -60, -0.2, 62, 60, -0.01, 66.5);
  P.floor(root, -60, 60, 62, 66.5, -0.01);

  // ---- the dense town round about (grid of plots, skipping the precinct, lanes and gaps)
  for (let gx = -110; gx < 110; gx += 10) {
    for (let gz = -110; gz < 140; gz += 10) {
      // irregular plots: some narrow, some double-width, gaps of varying size between them
      const wide = rnd() < 0.25;
      const x0 = gx + rnd() * 1.8, z0 = gz + rnd() * 1.8;
      const x1 = gx + (wide ? 9.6 : 5.5 + rnd() * 3.8), z1 = gz + 6 + rnd() * 3.6;
      // keep clear: the precinct + service lane, the approach lane strip, the cross lane, some open plots
      if (x1 > cx0 - 2.5 && x0 < cx1 + 4.5 && z1 > cz0 - 2.5 && z0 < cz1 + 1) continue;
      if (x1 > LANE.x0 - 13 && x0 < LANE.x1 + 13 && z0 > cz1 - 1 && z0 < LANE.z1) continue;
      if (z1 > 61.5 && z0 < 67) continue;
      if (TOWN_TREES.some(([tx, tz]) => tx > x0 - 3 && tx < x1 + 3 && tz > z0 - 3 && tz < z1 + 3)) continue;
      const dist = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2 - 6);
      if (dist > 135) continue;
      // taller lodges next to the temple, lower houses further out
      const st = dist < 55 ? 2 + Math.floor(rnd() * 4.5) : 1 + Math.floor(rnd() * 4);
      // face the nearest open side (towards the precinct where they abut it)
      const fr: 'x+' | 'x-' | 'z+' | 'z-' = Math.abs(gx) > Math.abs(gz - 6) ? (gx > 0 ? 'x-' : 'x+') : (gz > 6 ? 'z-' : 'z+');
      house(x0, z0, x1, z1, st, fr, false);
      // an L-shaped wing on some plots
      if (rnd() < 0.3) {
        const wx0 = rnd() < 0.5 ? x0 : x1 - (x1 - x0) * 0.45;
        house(wx0, z1 + 0.05, wx0 + (x1 - x0) * 0.45, Math.min(gz + 9.9, z1 + 0.85 + rnd() * 2.5), Math.max(1, st - 1 - Math.floor(rnd() * 2)), null, false);
      }
    }
  }

  // ---- hoardings on the rooftops looking into the courtyard (abstract colour fields only)
  const hoard = (x: number, y: number, z: number, ry: number, w: number, h: number, i: number) => {
    B.place(V.hoardings[i % 4], new THREE.PlaneGeometry(w, h), x, y + h / 2 + 1.0, z, ry);
    B.place(V.iron, new THREE.BoxGeometry(w, h, 0.12).translate(0, 0, -0.08), x, y + h / 2 + 1.0, z, ry);
    for (const s of [-0.4, 0.4]) {
      const dx = Math.cos(ry) * s * w, dz = -Math.sin(ry) * s * w;
      B.place(V.iron, new THREE.BoxGeometry(0.1, 1.2, 0.1), x + dx - Math.sin(ry) * 0.3, y + 0.6, z + dz - Math.cos(ry) * 0.3, ry);
    }
  };
  hoard(-6, 15, cz0 - 5, 0, 9, 3.2, 0);
  hoard(12, 15, cz0 - 5, 0, 8, 3, 1);
  hoard(cx1 + 8, 12, -6, -Math.PI / 2, 10, 3.4, 2);
  hoard(cx1 + 8, 15, 22, -Math.PI / 2, 8, 3, 3);
  hoard(cx0 - 6, 12, 2, Math.PI / 2, 9, 3.2, 1);
  hoard(cx0 - 6, 15, 26, Math.PI / 2, 7, 2.6, 0);

  // ---- electric poles along the lane, webbed with sagging wires
  const poles: THREE.Vector3[] = [];
  for (let z = LANE.z0 + 4; z < LANE.z1; z += 14) {
    for (const x of [LANE.x0 + 0.3, LANE.x1 - 0.3]) {
      if ((x < 0) === (Math.floor(z / 14) % 2 === 0)) continue;
      B.place(V.roof, new THREE.CylinderGeometry(0.1, 0.13, 8.5, 6), x, 4.25, z);
      B.span(V.iron, x - 0.7, 7.6, z - 0.05, x + 0.7, 7.7, z + 0.05);
      P.solid(x - 0.15, 0, z - 0.15, x + 0.15, 8, z + 0.15);
      poles.push(new THREE.Vector3(x, 7.7, z));
    }
  }
  for (let i = 0; i < poles.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = poles[i].clone().add(new THREE.Vector3((k - 1.5) * 0.35, -k * 0.1, 0));
      const b = poles[i + 1].clone().add(new THREE.Vector3((k - 1.5) * 0.35, -k * 0.1, 0));
      B.add(V.tank, ribbon(sagCurve(a, b, 0.5 + k * 0.15, 14), 0.025, Math.PI / 2 / 14 * 7));
    }
    // service drops into the houses
    for (let k = 0; k < 2; k++) {
      const a = poles[i].clone();
      const b = new THREE.Vector3(poles[i].x < 0 ? LANE.x0 - 0.1 : LANE.x1 + 0.1, 5.5 + rnd() * 2, poles[i].z + (rnd() - 0.2) * 8);
      B.add(V.tank, ribbon(sagCurve(a, b, 0.3, 8), 0.02, 0.2));
    }
  }
  // saffron bunting across the lane
  for (let z = LANE.z0 + 3; z < LANE.z1 - 5; z += 7) {
    const a = new THREE.Vector3(LANE.x0 - 0.05, 5.6, z), b = new THREE.Vector3(LANE.x1 + 0.05, 5.6, z + 1.5);
    const pts = sagCurve(a, b, 0.6, 18);
    B.add(V.iron, ribbon(pts, 0.012, Math.PI / 2 / 18 * 9));
    const tri = pennant(0.3, 0.35);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      B.place(i % 3 === 0 ? V.banner : V.saffron, tri, p.x, p.y, p.z, -Math.PI / 2 + 0.2 * Math.sin(i * 1.3));
    }
  }
  // kanwars stood against the shop pillars, saffron flags on bamboo
  for (let z = LANE.z0 + 6; z < LANE.z1 - 5; z += 11) {
    const side = Math.floor(z / 11) % 2 ? 1 : -1;
    kanwar(B, V, side * (LANE.x1 - 0.45), z, side < 0 ? 0.1 : Math.PI - 0.1);
  }
  for (const [x, z] of [[-3.2, 47], [3.2, 58], [-3.2, 76], [3.2, 93]] as const) {
    B.place(V.bamboo, new THREE.CylinderGeometry(0.035, 0.04, 6, 6), x, 3, z);
    B.place(V.saffron, pennant(1.1, 0.7), x, 5.9, z, x < 0 ? 0 : Math.PI);
  }
  // a little roadside shrine with a lamp at the lane's mouth
  B.span(V.crimson, -3.55, 0, 44.2, -2.75, 1.4, 45.0, true);
  B.span(V.lime, -3.6, 1.4, 44.15, -2.7, 1.55, 45.05);
  B.span(V.dark, -2.76, 0.4, 44.35, -2.74, 1.1, 44.85);
  flames.points.push(new THREE.Vector3(-2.6, 0.45, 44.6));

  // ---- instanced pera and bright goods
  // ---- far trees (leaf-card crowns, instanced): the listed spots, the north-west gardens, and
  //      crowns scattered over the far town (filled in below, once the far ring is laid out)
  const farTrees: [number, number, number, number, number][] = TOWN_TREES
    .filter((t) => !NEAR_TREES.some((n) => n[0] === t[0] && n[1] === t[1]))
    .map(([x, z, h]) => [x, 0, z, h, 1.1] as [number, number, number, number, number]);
  for (let i = 0; i < 26; i++) farTrees.push([150 + rnd() * 160, 0, -60 - rnd() * 200, 9 + rnd() * 6, 1.0 + rnd() * 0.3]);

  // ---- Shivganga tank: water, ghat steps round it, a walk with lamp posts on top
  {
    const { x0, x1, z0, z1 } = SHIVGANGA;
    for (let i = 0; i < 8; i++) {
      const o = i * 0.9, y = -0.1 - i * 0.3;
      B.span(V.lime, x0 + o, y - 0.3, z0 + o, x1 - o, y, z0 + o + 0.9);
      B.span(V.lime, x0 + o, y - 0.3, z1 - o - 0.9, x1 - o, y, z1 - o);
      B.span(V.lime, x0 + o, y - 0.3, z0 + o, x0 + o + 0.9, y, z1 - o);
      B.span(V.lime, x1 - o - 0.9, y - 0.3, z0 + o, x1 - o, y, z1 - o);
    }
    B.span(V.redBand, x0 - 2, -0.02, z0 - 2, x1 + 2, 0.4, z0);
    B.span(V.redBand, x0 - 2, -0.02, z1, x1 + 2, 0.4, z1 + 2);
    for (let x = x0; x <= x1; x += 15) for (const z of [z0 - 1, z1 + 1]) {
      B.place(V.iron, new THREE.CylinderGeometry(0.06, 0.08, 5, 6), x, 2.5, z);
      B.place(V.glow, new THREE.SphereGeometry(0.18, 8, 6), x, 5.1, z);
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 12, z1 - z0 - 12).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x23423c, roughness: 0.08, metalness: 0.3 }));
    water.position.set((x0 + x1) / 2, -2.2, (z0 + z1) / 2);
    water.name = 'deoghar-far';
    root.add(water);
  }

  // ---- the far town: a ring of blocks from ~140 m out to ~400 m, fading into the haze. Deoghar's
  //      concrete is cream, pink, pale green and grey (lower saturation than the near town), the
  //      street grid turns in patches, black water tanks on many roofs, trees between the houses.
  {
    const mats: THREE.Matrix4[] = [], cols: THREE.Color[] = [], tarps: THREE.Matrix4[] = [], tanks: THREE.Matrix4[] = [];
    const pal = [0xcdbd96, 0xc9a39a, 0xc4a0a4, 0xa3b598, 0xb2bba6, 0x98968f, 0xa8a196, 0xcbb67a, 0xa9a3b4, 0xc8c0b0, 0xc9a882];
    const q = new THREE.Quaternion(), Yax = new THREE.Vector3(0, 1, 0);
    for (let gx = -400; gx < 400; gx += 11) {
      for (let gz = -400; gz < 400; gz += 11) {
        // patches of ~44 m whose street grid is turned up to ±15°
        const px = Math.floor(gx / 44), pz = Math.floor(gz / 44);
        const ph = Math.abs(Math.sin(px * 127.1 + pz * 311.7) * 43758.5453) % 1;
        const ang = (ph - 0.5) * 2 * THREE.MathUtils.degToRad(15);
        const pcx = px * 44 + 22, pcz = pz * 44 + 22;
        const ccx = gx + 5.5, ccz = gz + 5.5;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const cx = pcx + (ccx - pcx) * ca - (ccz - pcz) * sa, cz = pcz + (ccx - pcx) * sa + (ccz - pcz) * ca;
        const dd = Math.hypot(cx, cz - 6);
        if (dd < 138 || dd > 410) continue;
        if (cx > SHIVGANGA.x0 - 14 && cx < SHIVGANGA.x1 + 14 && cz > SHIVGANGA.z0 - 14 && cz < SHIVGANGA.z1 + 14) continue;
        if (Math.abs(cx) < 8 && cz > 110) continue; // the road out
        if (farTrees.some(([tx, , tz]) => Math.abs(tx - cx) < 7 && Math.abs(tz - cz) < 7)) continue;
        if (cx > 40 && cz < -30 && rnd() < 0.55) { if (rnd() < 0.5) farTrees.push([cx, 0, cz, 8 + rnd() * 6, 1.0 + rnd() * 0.3]); continue; } // gardens among the trees to the north-west
        if (rnd() < 0.12) { if (rnd() < 0.6) farTrees.push([cx + (rnd() - 0.5) * 4, 0, cz + (rnd() - 0.5) * 4, 7 + rnd() * 5, 1.0 + rnd() * 0.3]); continue; }
        const w = 5 + rnd() * 5.5, d = 5 + rnd() * 5.5, h = (rnd() < 0.7 ? 4 + rnd() * 8 : 9 + rnd() * 9);
        const ox = (rnd() - 0.5) * (11 - w), oz = (rnd() - 0.5) * (11 - d);
        const x = cx + ox * ca - oz * sa, z = cz + ox * sa + oz * ca;
        const ry = -ang + (rnd() < 0.15 ? (rnd() - 0.5) * 0.3 : 0);
        q.setFromAxisAngle(Yax, ry);
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d)));
        const c = new THREE.Color(pal[Math.floor(rnd() * pal.length)]).offsetHSL(0, -0.03, (rnd() - 0.5) * 0.1);
        cols.push(c);
        // the flat concrete roof slab, grey and weathered (as seen from above, most of the town is roofs)
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.1, z), q, new THREE.Vector3(w + 0.2, 0.22, d + 0.2)));
        cols.push(new THREE.Color(0x77736c).offsetHSL(0, 0, (rnd() - 0.5) * 0.12));
        // a rooftop room on some
        if (rnd() < 0.3) {
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (rnd() - 0.5) * w * 0.4, h + 1.3, z + (rnd() - 0.5) * d * 0.4), q, new THREE.Vector3(w * 0.35, 2.6, d * 0.35)));
          cols.push(c.clone().offsetHSL(0, 0, -0.04));
        }
        if (rnd() < 0.4) {
          const n = rnd() < 0.3 ? 2 : 1;
          for (let k = 0; k < n; k++) tanks.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (rnd() - 0.5) * w * 0.6, h, z + (rnd() - 0.5) * d * 0.6), q, new THREE.Vector3(1, 1, 1)));
        }
        if (rnd() < 0.12) tarps.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.05, z), q, new THREE.Vector3(w * 0.7, 0.1, d * 0.7)));
      }
    }
    const far = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), mats.length);
    mats.forEach((m, i) => { far.setMatrixAt(i, m); far.setColorAt(i, cols[i]); });
    far.instanceMatrix.needsUpdate = true;
    if (far.instanceColor) far.instanceColor.needsUpdate = true;
    far.castShadow = false;
    far.receiveShadow = true;
    far.computeBoundingSphere();
    far.name = 'deoghar-far';
    root.add(far);
    const tp = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), V.tarpBlue, tarps.length);
    tarps.forEach((m, i) => tp.setMatrixAt(i, m));
    tp.instanceMatrix.needsUpdate = true;
    tp.computeBoundingSphere();
    tp.name = 'deoghar-far';
    root.add(tp);
    // black Sintex water tanks on a little stand
    const tankG = lathe([[0.55, 0.35], [0.6, 0.43], [0.6, 1.4], [0.5, 1.55], [0, 1.62]], 8);
    const tk = new THREE.InstancedMesh(tankG, V.tank, tanks.length);
    tanks.forEach((m, i) => tk.setMatrixAt(i, m));
    tk.instanceMatrix.needsUpdate = true;
    tk.computeBoundingSphere();
    tk.castShadow = false;
    tk.name = 'deoghar-far';
    root.add(tk);
  }
  leafTrees(root, farTrees, V.wood, 977, 'deoghar-far');
  if (pera.length) {
    const g = new THREE.SphereGeometry(0.021, 6, 3).scale(1, 0.55, 1);
    const im = new THREE.InstancedMesh(g, V.pera, pera.length);
    im.name = 'deoghar-far';
    pera.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    root.add(im);
  }
  {
    // prop geometries (unit = real size), all y from 0 up (the hanging ones from 0 down)
    const lotaG = lathe([[0, 0], [0.04, 0], [0.05, 0.012], [0.068, 0.05], [0.07, 0.08], [0.056, 0.115], [0.032, 0.13], [0.03, 0.145], [0.04, 0.16], [0, 0.155]], 10);
    // a rack of bangles: a ribbed stack (one lathe, a ridge per bangle) on a rod and a foot
    const bprof: [number, number][] = [[0.05, 0], [0.05, 0.012], [0.008, 0.012], [0.008, 0.028]];
    for (let k = 0; k < 12; k++) { const y = 0.03 + k * 0.017; bprof.push([0.03, y], [0.036, y + 0.0085]); }
    bprof.push([0.008, 0.25], [0.008, 0.3], [0, 0.3]);
    const bangleG = lathe(bprof, 8);
    bangleG.computeVertexNormals();
    // a folded cloth / a sweets box: a soft-edged slab 0.3 × 0.035 × 0.22
    const foldG = new THREE.BoxGeometry(0.3, 0.035, 0.22, 3, 1, 2).translate(0, 0.0175, 0);
    { const p = foldG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + 0.004 * Math.sin(x * 30) * (Math.abs(z) < 0.1 ? 1 : 0.4)); } foldG.computeVertexNormals(); }
    // a hanging cloth (gamchha / vest): a folded drape 0.45 wide, 0.8 long, hanging from y=0
    const clothG = new THREE.PlaneGeometry(0.45, 0.8, 8, 6).translate(0, -0.4, 0);
    { const p = clothG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.035 * Math.sin(x * 28 + y * 2) * (0.4 - y * 0.8)); p.setX(i, x * (1 + y * 0.12)); } clothG.computeVertexNormals(); }
    // a tinsel tassel / kanwar trimming: a fringed cone hanging from a loop
    const tasselParts: THREE.BufferGeometry[] = [new THREE.ConeGeometry(0.07, 0.32, 12, 1, true).rotateX(Math.PI).translate(0, -0.2, 0), new THREE.TorusGeometry(0.03, 0.006, 4, 10).translate(0, -0.02, 0), new THREE.SphereGeometry(0.035, 8, 6).translate(0, -0.06, 0)];
    { const p = tasselParts[0].attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.25 * Math.sin(a * 12); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
    const tasselG = mergeGeometries(tasselParts.map((g) => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g.index ? g.toNonIndexed() : g; }))!;
    tasselG.computeVertexNormals();
    // two draws for all the stock: metal (lotas, bangles, tinsel) and cloth (folded stacks, hangings)
    const prep = (g: THREE.BufferGeometry) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
      return n;
    };
    const groups: [PropKind[], THREE.Material][] = [
      [['lota', 'bangles', 'tassel'], new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.65, roughness: 0.32, side: THREE.DoubleSide })],
      [['fold', 'cloth'], new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, side: THREE.DoubleSide })],
    ];
    const G: Record<PropKind, THREE.BufferGeometry> = { lota: prep(lotaG), bangles: prep(bangleG), fold: prep(foldG), cloth: prep(clothG), tassel: prep(tasselG) };
    for (const [kinds, mat] of groups) {
      const inst = kinds.reduce((a, k) => a + props[k].m.length, 0);
      if (!inst) continue;
      const verts = kinds.reduce((a, k) => a + G[k].attributes.position.count, 0);
      const bm = new THREE.BatchedMesh(inst, verts, 0, mat);
      for (const k of kinds) {
        if (!props[k].m.length) continue;
        const gidK = bm.addGeometry(G[k]);
        props[k].m.forEach((mm, i) => { const id = bm.addInstance(gidK); bm.setMatrixAt(id, mm); bm.setColorAt(id, props[k].c[i]); });
      }
      bm.name = 'deoghar-far';
      bm.castShadow = false;
      bm.receiveShadow = true;
      bm.computeBoundingSphere();
      root.add(bm);
    }
  }
  void GATE;
}

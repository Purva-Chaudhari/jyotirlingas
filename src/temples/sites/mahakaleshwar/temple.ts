import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from '../../engine/materials';
import { worldUV } from '../../engine/materials';
import {
  Physics, box, columns, balustrade, dome, garland, signSprite, archPanelGeometry, type Flames,
} from '../../engine/kit';
import { shikhara } from './shikhara';
import { crown } from './crown';
import { carvedPillars } from './pillars';
import { buildSanctum } from './sanctum';
import { ribbedDome } from './surroundings';
import { panelUV, type MahakalMats } from './mats';
import { fadeNear } from './optimize';
import { VIP_DARSHAN, GM, NH, FRONT } from './mode';
import { carve, buildUpper, OMK_HOLES, NAG_HOLES, NAG, STAIR_UP } from './upper';

/**
 * Shri Mahakaleshwar temple, modelled from reference photographs.
 * Origin = temple centre at courtyard level, +z = front (the entrance side), metres.
 *
 * Massing: a ribbed stone tower over the underground garbhagriha (TOWER, SANCTUM) carries the
 * shikhara; a two-storey pillared hall (ground arcade 0.9-5.35, upper gallery 5.35-9.55) is
 * attached in front. The front doorway opens on a stair down to the antechamber and sanctum;
 * a second stair east of the temple joins the same antechamber.
 */

/** The main stair from the front doorway down to the antechamber: half-width SW, from z = SS (top) to SN (bottom). */
export const STAIR = { SW: 1.1, SS: 5.2, SN: -0.68 };
/** Sanctum floor/ceiling, and its centre (moved north so the stair can reach its south doorway). */
export const SANCTUM = { FLOOR: -3.0, CEIL: 0.5, Z: -5.85 };
/** The tower that carries the shikhara: centred over the garbhagriha, half-width HALF. */
export const TOWER = { Z: -4.3, HALF: 5.15 };

const linspace = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/** Pillar points along the front (z = z1) and both sides (x = ±hx, z from z0 to z1) of a hall. */
function rectPoints(hx: number, z0: number, z1: number, nx: number, nz: number) {
  const front = linspace(-hx, hx, nx).map((x) => [x, z1] as [number, number]);
  const left = linspace(z0, z1, nz).map((z) => [-hx, z] as [number, number]);
  const right = linspace(z0, z1, nz).map((z) => [hx, z] as [number, number]);
  const all = [...front, ...left.slice(0, -1), ...right.slice(0, -1)];
  return { front, left, right, back: [] as [number, number][], all };
}


export function buildMahakal(root: THREE.Group, M: Materials, P: Physics, S: MahakalMats) {
  const g = new THREE.Group();
  g.name = 'mahakaleshwar';
  root.add(g);
  const flames: Flames = { points: [], lights: [] };
  let doorGlow: THREE.PointLight | null = null;

  // Massing after the side elevation (Commons cm12) and the trust's 2025 photographs: a plain,
  // ribbed stone TOWER stands over the underground garbhagriha and carries the shikhara; a
  // two-storey pillared HALL (ground arcade + upper gallery) is attached in front of it.
  const PX = 7.4, PZ = 9.5; // plinth half-extents
  const TZ0 = TOWER.Z, TW = TOWER.HALF; // tower centre (over the sanctum) and half-width
  const HZ0 = TZ0 + TW; // the hall begins where the tower's front face is (z ≈ 0.2)
  const GX = PX - 0.6, GZ = PZ - 0.6; // ground-floor pillar ring (front + sides of the hall)
  const UX = 6.3, UZ = 8.3; // upper-gallery pillar ring
  const UH = 3.8; // upper-gallery pillar height
  const SPIRE_HALF = TW - 0.1, SPIRE_H = 21, TERRACE = 5.35 + UH + 0.4;
  // the third, enclosed storey (Nagchandreshwar shrine) between the hall's terrace and the spire
  const H3 = 3.2, TOP3 = TERRACE + H3;

  // ---------- plinth + front steps ----------
  // the plinth is built round the opening of the main stair (x ±SW, z SN..SS) that descends
  // from the front doorway to the garbhagriha
  const { SW, SN, SS } = STAIR;
  if (VIP_DARSHAN) {
    box(g, S.stone, PX - SW, 0.9, PZ * 2, -(PX + SW) / 2, 0, 0, P);
    box(g, S.stone, PX - SW, 0.9, PZ * 2, (PX + SW) / 2, 0, 0, P);
    box(g, S.stone, SW * 2, 0.9, PZ + SN, 0, 0, (-PZ + SN) / 2, P);
    box(g, S.stone, SW * 2, 0.9, PZ - SS, 0, 0, (PZ + SS) / 2, P);
  } else {
    // general darshan: no stair; the plinth is a shell over the Ganesh Mandapam below the hall
    const { X, Z0, PLINTH } = GM;
    box(g, S.stone, PX - X, 0.9, PZ * 2, -(PX + X) / 2, 0, 0, P);
    box(g, S.stone, PX - X, 0.9, PZ * 2, (PX + X) / 2, 0, 0, P);
    box(g, S.stone, X * 2, 0.9, PZ + Z0, 0, 0, (-PZ + Z0) / 2, P);
    box(g, S.stone, X * 2, 0.9, PZ - PLINTH, 0, 0, (PZ + PLINTH) / 2, P);
    // the shell over the mandapam, open over the front stair (x ±FRONT.W, z FOOT..HEAD) that descends from
    // the doorway into it
    const { W, FOOT, HEAD } = FRONT, T0 = GM.CEIL_HI, TH = 0.9 - GM.CEIL_HI;
    box(g, S.stone, X - W, TH, PLINTH - Z0, -(X + W) / 2, T0, (Z0 + PLINTH) / 2);
    box(g, S.stone, X - W, TH, PLINTH - Z0, (X + W) / 2, T0, (Z0 + PLINTH) / 2);
    box(g, S.stone, W * 2, TH, FOOT - Z0, 0, T0, (Z0 + FOOT) / 2);
    box(g, S.stone, W * 2, TH, PLINTH - HEAD, 0, T0, (HEAD + PLINTH) / 2);
  }
  box(g, S.frieze, PX * 2 + 0.06, 0.32, 0.06, 0, 0.3, PZ);
  box(g, S.frieze, PX * 2 + 0.06, 0.32, 0.06, 0, 0.3, -PZ);
  box(g, S.frieze, 0.06, 0.32, PZ * 2, PX, 0.3, 0);
  box(g, S.frieze, 0.06, 0.32, PZ * 2, -PX, 0.3, 0);
  if (VIP_DARSHAN) {
    P.floor(g, -PX, -SW, -PZ, PZ, 0.9);
    P.floor(g, SW, PX, -PZ, PZ, 0.9);
    P.floor(g, -SW, SW, -PZ, SN, 0.9);
    P.floor(g, -SW, SW, SS, PZ, 0.9);
  } else {
    const { W, FOOT, HEAD } = FRONT;
    P.floor(g, -PX, -W, -PZ, PZ, 0.9);
    P.floor(g, W, PX, -PZ, PZ, 0.9);
    P.floor(g, -W, W, -PZ, FOOT, 0.9);
    P.floor(g, -W, W, HEAD, PZ, 0.9);
  }
  for (let i = 0; i < 5; i++) {
    const d = 1.5 - i * 0.3;
    box(g, S.stone, 6.4, 0.18 * (i + 1), 0.3, 0, 0, PZ + d - 0.15);
  }
  P.floor(g, -3.2, 3.2, PZ + 1.5, PZ, 0, 0.9);
  // steel queue railings flanking the front steps, and the temple's bilingual board (temple_front_2025)
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const x = sx * 3.45;
      for (const yy of [0.55, 1.05]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 5, 6), steel);
        r.rotation.x = Math.PI / 2;
        r.position.set(x, yy, PZ + 3.5);
        g.add(r);
      }
      for (let k = 0; k <= 4; k++) box(g, steel, 0.05, 1.1, 0.05, x, 0, PZ + 1.0 + k * 1.25);
      P.solid(x - 0.06, 0, PZ + 1.0, x + 0.06, 1.1, PZ + 6.0);
    }
    const board = new THREE.Group();
    board.position.set(5.6, 0, PZ + 2.6);
    board.rotation.y = -0.35;
    g.add(board);
    box(board, steel, 0.08, 1.6, 0.08, -0.9, 0, 0);
    box(board, steel, 0.08, 1.6, 0.08, 0.9, 0, 0);
    fadeNear(signSprite(board, 'श्री महाकालेश्वर', 'Shri Mahakaleshwar Jyotirlinga', new THREE.Vector3(0, 1.95, 0), 1.6));
    P.solid(5.6 - 1.0, 0, PZ + 2.4, 5.6 + 1.0, 2.5, PZ + 2.8);
  }

  // ---------- the tower over the garbhagriha ----------
  // solid masonry, hollowed only by the stair passage where it reaches the tower's front
  // grey-black dressed basalt (cm12), up through the third storey to the spire's base (~11.5 m above the plinth)
  // carved out at the plinth level for the Omkareshwar sanctum (over the garbhagriha) and at the top for
  // the Nagchandreshwar room (upper.ts)
  const holes = [...OMK_HOLES, ...NAG_HOLES];
  carve(g, S.basalt, [-TW, 0.9, TZ0 - TW, TW, TOP3, SN], holes, P);
  carve(g, S.basalt, [-TW, 0.9, SN, -SW, TOP3, HZ0], holes, P);
  carve(g, S.basalt, [SW, 0.9, SN, TW, TOP3, HZ0], holes, P);
  carve(g, S.basalt, [-SW, 5.0, SN, SW, TOP3, HZ0], holes);
  towerDetail(g, S, M, TW, TZ0, TOP3);

  // ---------- ground floor of the hall: carved pillars carrying flat lintels ----------
  const G = rectPoints(GX, HZ0 + 0.5, GZ, 6, 4); // 5 bays in front: the entrance is the middle bay
  carvedPillars(g, S.pillar, G.all, 0.9, 3.6, 0.21, P);
  corbels(g, S.pillar, G, 0.9 + 3.6, 0.21);
  const hallD = GZ - HZ0 + 0.3, hallC = (GZ + HZ0) / 2;
  for (const [w, d, x, z] of [[GX * 2 + 0.5, 0.5, 0, GZ], [0.5, hallD, GX, hallC], [0.5, hallD, -GX, hallC]] as const) {
    box(g, S.stone, w, 0.42, d, x, 4.5, z);
    box(g, S.frieze, w + (d > 1 ? 0.04 : 0), 0.3, d + (w > 1 ? 0.04 : 0), x, 4.62, z);
  }
  box(g, S.stone, PX * 2, 0.3, PZ - HZ0, 0, 5.05, (PZ + HZ0) / 2);
  cornice(g, S.stone, -PX, PX, HZ0, PZ, 5.35);

  // the hall's closed inner core, hollowed by the passage to the sanctum stair
  box(g, S.stoneDark, 5 - SW, 4.1, 6 - HZ0, -(5 + SW) / 2, 0.9, (6 + HZ0) / 2, P);
  // (the east half is pierced by the passage to the Omkareshwar sanctum, its doorway on the east aisle)
  carve(g, S.stoneDark, [SW, 0.9, HZ0, 5, 5.0, 6], OMK_HOLES, P);
  box(g, M.plaster, SW * 2, 1.2, 6 - SN, 0, 3.8, (6 + SN) / 2);
  box(g, S.stoneDark, SW * 2, 0.32, 0.3, 0, 3.5, 5.85);
  // the silver doors stand open, swung inward on their hinges (general darshan: the stair starts right at the
  // threshold, so they are swung outward instead, folded flat against the hall's front wall either side)
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    if (VIP_DARSHAN) {
      hinge.position.set(sx * 0.9, 0.9, 5.98);
      hinge.rotation.y = sx * -1.4;
    } else {
      hinge.position.set(sx * 1.17, 0.9, 6.2);
      hinge.rotation.y = Math.PI;
    }
    g.add(hinge);
    const leaf = box(hinge, M.silver, 0.9, 2.58, 0.07, -sx * 0.45, 0, 0);
    leaf.castShadow = true;
    for (const yy of [0.5, 1.3, 2.1]) box(hinge, M.brass, 0.7, 0.05, 0.03, -sx * 0.45, yy, VIP_DARSHAN ? sx * 0.05 : -0.05);
  }
  // general darshan: in the real temple the garbhagriha is closed to general devotees (since 2020); here a
  // waist-high steel barricade gate stands across the open doorway, and the visitor may open it (E / click,
  // see the site's portal): it swings aside on its hinge post and the way in is clear
  let frontGate: { gate: THREE.Group; block: THREE.Box3 } | null = null;
  if (!VIP_DARSHAN) {
    P.solid(-1.1, 0.9, 6.25, 1.1, 2.4, 6.55);
    const block = P.solids[P.solids.length - 1];
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
    // the gate hangs on a post at the doorway's west side (x = -1.0) so it can swing open
    const gate = new THREE.Group();
    gate.position.set(-1.0, 0.9, 6.4);
    g.add(gate);
    box(g, steel, 0.05, 1.05, 0.05, -1.0, 0.9, 6.4);
    for (const x of [0.67, 1.33, 2.0]) box(gate, steel, 0.05, 1.05, 0.05, x, 0, 0);
    for (const y of [0.25, 0.65, 1.0]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6), steel);
      r.rotation.z = Math.PI / 2;
      r.position.set(1.0, y, 0);
      gate.add(r);
    }
    frontGate = { gate, block };
  }
  box(g, M.brass, 2.3, 0.22, 0.2, 0, 3.5, 6.05);
  box(g, M.brass, 0.22, 2.6, 0.2, -1.04, 0.9, 6.05);
  box(g, M.brass, 0.22, 2.6, 0.2, 1.04, 0.9, 6.05);
  for (const x of [-3.4, -2.2, 2.2, 3.4]) box(g, S.frieze, 0.8, 2.2, 0.06, x, 1.4, 6.02);
  garland(g, M.marigold, new THREE.Vector3(-1.3, 3.6, 6.2), new THREE.Vector3(1.3, 3.6, 6.2), 0.45, 0.05);
  // daily marigold dressing on the front: one swag per bay, sag varying, a light fringe over the door bays
  for (let i = 0; i < G.front.length - 1; i++) {
    const [a, b] = [G.front[i][0], G.front[i + 1][0]];
    garland(g, i % 2 ? MARIGOLD_YELLOW : MARIGOLD_ORANGE, new THREE.Vector3(a + 0.35, 4.4, GZ + 0.3), new THREE.Vector3(b - 0.35, 4.4, GZ + 0.3), 0.3 + (i % 3) * 0.15, 0.055);
  }
  marigoldFringe(g, M, S, -2.8, 2.8, GZ + 0.28, 4.45, 0.55);
  // lanterns hung from the front and side brackets
  const lampPts = [...G.front, ...G.left.slice(1), ...G.right.slice(1)];
  const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.08, 0.32, 6), S.lamp, lampPts.length);
  lampPts.forEach(([x, z], i) => {
    const ox = Math.abs(x) > GX - 0.1 ? Math.sign(x) * 0.4 : 0, oz = z > GZ - 0.1 ? 0.4 : 0;
    lamps.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + ox, 3.75, z + oz));
  });
  g.add(lamps);
  // the doorway glows: warm light inside the passage, bells and a sign over the door
  {
    const glow = new THREE.PointLight(0xffb060, 6, 9, 1.5);
    doorGlow = glow;
    glow.position.set(0, 2.9, 5.0);
    g.add(glow);
    flames.lights.push(glow);
    const bellGeo = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.11, 0.03], [0.09, 0.09], [0.07, 0.2], [0.04, 0.23], [0, 0.25]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 16);
    for (const x of [-0.6, 0.6]) {
      const b = new THREE.Mesh(bellGeo, M.brass);
      b.position.set(x, 3.0, 6.25);
      g.add(b);
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), M.brass);
      ch.position.set(x, 3.45, 6.25);
      g.add(ch);
    }
    // the shrines above: Omkareshwar (off the east aisle) and Nagchandreshwar (up the west stair)
    buildUpper(g, M, S, P, flames, glow);
    fadeNear(VIP_DARSHAN
      ? signSprite(g, 'गर्भगृह दर्शन ↓', 'Garbhagriha Darshan', new THREE.Vector3(0, 4.05, 6.5), 1.45)
      : signSprite(g, 'गर्भगृह की ओर ↓', 'To the Garbhagriha ↓ · open to you', new THREE.Vector3(0, 4.05, 6.5), 1.45));
  }

  // ---------- upper gallery of the hall: slim pillars, bracket capitals, shallow cusped arches
  // under flat lintels (cm08 shows the arched bays), the inner wall pierced by doors and windows ----------
  const U = rectPoints(UX, HZ0 + 0.5, UZ, 6, 4);
  carvedPillars(g, S.pillar, U.all, 5.35, UH, 0.17);
  corbels(g, S.pillar, U, 5.35 + UH, 0.17);
  const galD = UZ - HZ0 + 0.3, galC = (UZ + HZ0) / 2;
  for (const [w, d, x, z] of [[UX * 2 + 0.5, 0.45, 0, UZ], [0.45, galD, UX, galC], [0.45, galD, -UX, galC]] as const) {
    box(g, S.stone, w, 0.34, d, x, 5.35 + UH, z);
  }
  for (const row of [U.front, U.left, U.right]) cuspedArches(g, S.stone, row, 5.35 + UH - 0.75, 0.75, 0.22, 0.17);
  box(g, S.stoneDark, 9.2, UH, 5.6 - HZ0, 0, 5.35, (5.6 + HZ0) / 2);
  // doors and windows in the inner wall, one per bay: pale timber doors, dark openings, a barred window
  {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xa89c88, roughness: 0.75 });
    const frameMat = S.pillar;
    const grille = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.4 });
    const dg = new THREE.Group();
    const put = (x: number, z: number, ry: number, kind: number) => {
      const grp = new THREE.Group();
      grp.position.set(x, 5.35, z);
      grp.rotation.y = ry;
      dg.add(grp);
      const W = 1.75, H = 3.0;
      box(grp, S.recess, W, H, 0.1, 0, 0, 0.0);
      box(grp, frameMat, W + 0.3, 0.2, 0.18, 0, H, 0.02);
      box(grp, frameMat, 0.15, H, 0.16, -W / 2 - 0.07, 0, 0.02);
      box(grp, frameMat, 0.15, H, 0.16, W / 2 + 0.07, 0, 0.02);
      if (kind === 0) for (const sx of [-1, 1]) box(grp, doorMat, W / 2 - 0.04, H - 0.06, 0.05, sx * (W / 4), 0.03, 0.06);
      if (kind === 2) {
        for (let k = 0; k < 7; k++) box(grp, grille, 0.025, 1.6, 0.025, -W / 2 + 0.12 + k * ((W - 0.24) / 6), 0.0, 0.12);
        box(grp, grille, W - 0.1, 0.03, 0.03, 0, 1.6, 0.12);
      }
    };
    const fz = 5.6 + 0.06, fx = 4.6 + 0.06;
    U.front.slice(0, -1).forEach(([x], i) => put((x + U.front[i + 1][0]) / 2, fz, 0, i % 3));
    U.left.slice(0, -1).forEach(([, z], i) => {
      const zm = (z + U.left[i + 1][1]) / 2;
      if (zm < 5.0) { put(-fx, zm, -Math.PI / 2, i % 2); put(fx, zm, Math.PI / 2, (i + 1) % 2); }
    });
    g.add(mergeByMaterial(dg));
  }
  const BX = PX - 0.3, BZ = PZ - 0.4;
  jaliRail(g, S, [-BX, BZ], [BX, BZ], 5.35, 1.05);
  jaliRail(g, S, [-BX, HZ0], [-BX, BZ], 5.35, 1.05);
  jaliRail(g, S, [BX, HZ0], [BX, BZ], 5.35, 1.05);
  // a light fringe of marigolds along the gallery's front lintel (heavy only at festivals)
  marigoldFringe(g, M, S, -2.4, 2.4, UZ + 0.25, 5.35 + UH - 0.3, 0.4);
  const TX = UX + 0.55, TZ = UZ + 0.55;
  box(g, S.stone, TX * 2, 0.4, TZ - HZ0, 0, TERRACE - 0.4, (TZ + HZ0) / 2);
  box(g, S.frieze, TX * 2 + 0.04, 0.26, TZ - HZ0, 0, TERRACE - 0.7, (TZ + HZ0) / 2);
  cornice(g, S.stone, -TX, TX, HZ0, TZ, TERRACE);
  // terrace parapet of pierced stone
  jaliRail(g, S, [-TX + 0.1, TZ - 0.1], [TX - 0.1, TZ - 0.1], TERRACE, 0.95);
  // (the west parapet stops short of the tower: the steel stair's top landing comes in there)
  jaliRail(g, S, [-TX + 0.1, STAIR_UP.TOP1 + 0.05], [-TX + 0.1, TZ - 0.1], TERRACE, 0.95);
  jaliRail(g, S, [TX - 0.1, HZ0], [TX - 0.1, TZ - 0.1], TERRACE, 0.95);

  // ---------- the spire group, centred over the garbhagriha ----------
  const sp = new THREE.Group();
  sp.position.set(0, H3, TZ0);
  g.add(sp);
  // tower-top terrace: slab, cornice and a low jali parapet round the spire's base
  box(sp, S.stone, TW * 2 + 0.3, 0.4, TW * 2 + 0.3, 0, TERRACE - 0.4, 0);
  cornice(sp, S.stone, -TW - 0.15, TW + 0.15, -TW - 0.15, TW + 0.15, TERRACE);
  jaliRail(sp, S, [-TW, -TW], [TW, -TW], TERRACE, 0.8);
  jaliRail(sp, S, [-TW, -TW], [-TW, TW - 1.4], TERRACE, 0.8);
  jaliRail(sp, S, [TW, -TW], [TW, TW - 1.4], TERRACE, 0.8);

  // the third storey's front block (temple_front_2025, aerial_1): an enclosed dark-stone storey projecting
  // onto the hall's terrace, three white-framed openings and the Nagchandreshwar board, a parapet on top;
  // the spire group is lifted by H3 so the spire rises from its roof (built in sp's frame: y − H3)
  {
    const y0 = TERRACE - H3, z0 = SPIRE_HALF - 0.3, z1 = SPIRE_HALF + 2.6, hx = TW + 0.1;
    // the block itself, in world metres: hollowed for the Nagchandreshwar room, its middle door and side
    // windows open (upper.ts); its walls are colliders
    carve(g, S.basalt, [-hx, NAG.Y, z0 + TZ0, hx, TOP3, z1 + TZ0], NAG_HOLES, P);
    // moulded bands on the outer faces: a plinth course, a sill course (both broken by the door) and the cornice
    const D = NAG.DOOR + 0.12;
    for (const [yy, hh, out] of [[y0, 0.25, 0.08], [y0 + 1.0, 0.12, 0.05], [y0 + H3 - 0.35, 0.18, 0.12]] as const) {
      const wf = yy > y0 + 2 ? hx * 2 + out * 2 : hx + out - D;
      for (const sx of yy > y0 + 2 ? [0] : [-1, 1]) box(sp, S.frieze, wf, hh, out, sx * (D + wf / 2), yy, z1 + out / 2);
      for (const sx of [-1, 1]) box(sp, S.frieze, out, hh, z1 - z0, sx * (hx + out / 2), yy, (z0 + z1) / 2);
    }
    const white = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.7 });
    const inset = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    void inset; // (the openings are real now: the door and the grilled windows of the room behind)
    for (const [x, w, h, sill] of [[-3.0, 1.2, 1.5, 1.0], [0, 1.3, 2.55, 0], [3.0, 1.2, 1.5, 1.0]] as const) {
      box(sp, white, w + 0.24, 0.12, 0.1, x, y0 + sill + h, z1 + 0.03);
      if (sill > 0) box(sp, white, w + 0.24, 0.08, 0.1, x, y0 + sill - 0.08, z1 + 0.03);
      box(sp, white, 0.12, h, 0.1, x - w / 2 - 0.06, y0 + sill, z1 + 0.03);
      box(sp, white, 0.12, h, 0.1, x + w / 2 + 0.06, y0 + sill, z1 + 0.03);
      // a cusped white arch head over each opening
      const ah = new THREE.Mesh(archPanelGeometry(w, 0.32, 0.08, 5), white);
      ah.position.set(x, y0 + sill + h - 0.32, z1 + 0.05);
      sp.add(ah);
    }
    // the shrine's board over the middle door: "श्री नागचंद्रेश्वर मंदिर"
    {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 96;
      const cx = c.getContext('2d')!;
      cx.fillStyle = '#f3efe4'; cx.fillRect(0, 0, 512, 96);
      cx.strokeStyle = '#a8261c'; cx.lineWidth = 6; cx.strokeRect(4, 4, 504, 88);
      cx.fillStyle = '#a8261c'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.font = '700 52px "Kohinoor Devanagari", "Noto Sans Devanagari", Martel, serif';
      cx.fillText('श्री नागचंद्रेश्वर मंदिर', 256, 50, 480);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      bd.position.set(0, y0 + 2.78, z1 + 0.07);
      sp.add(bd);
    }
    box(sp, S.stone, hx * 2 + 0.3, 0.3, z1 - z0 + 0.3, 0, TERRACE - 0.3, (z0 + z1) / 2);
    jaliRail(sp, S, [-hx, z1 + 0.05], [hx, z1 + 0.05], TERRACE, 0.7);
    jaliRail(sp, S, [-hx, SPIRE_HALF], [-hx, z1], TERRACE, 0.7);
    jaliRail(sp, S, [hx, SPIRE_HALF], [hx, z1], TERRACE, 0.7);
  }

  // ribbed pink domed chhatris (≈2.5 m across on four posts) at the spire's front corners, on the
  // third storey's roof (temple_front_2025, aerial_1)
  for (const sx of [-1, 1]) {
    const x = sx * (TW - 0.9), z = SPIRE_HALF + 1.35, r = 0.95;
    box(sp, S.stone, 2.6, 0.3, 2.6, x, TERRACE, z);
    columns(sp, S.pillar, [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]], TERRACE + 0.3, 1.8, 0.09);
    box(sp, S.stone, 2.7, 0.16, 2.7, x, TERRACE + 2.1, z);
    ribbedDome(sp as THREE.Group, S.spire, x, TERRACE + 2.26, z, 1.2, 12);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), M.gold);
    f.position.set(x, TERRACE + 2.26 + 1.2 * 1.65 + 0.2, z);
    sp.add(f);
  }

  // shikhara and crown
  const { topY, topHalf } = shikhara(sp, S.spire, TERRACE, SPIRE_HALF, SPIRE_H, { dark: S.recess, gold: M.gold, om: S.om, horn: S.horn });
  const { flag } = crown(sp, M, S, topY, topHalf);

  // ---------- Diwali diyas along the plinth edge ----------
  for (const x of linspace(-PX + 0.2, PX - 0.2, 30)) {
    if (Math.abs(x) > 3.3) flames.points.push(new THREE.Vector3(x, 0.95, PZ - 0.15));
  }
  for (const z of linspace(-PZ + 0.2, PZ - 0.2, 38)) {
    flames.points.push(new THREE.Vector3(-PX + 0.15, 0.95, z), new THREE.Vector3(PX - 0.15, 0.95, z));
  }
  for (let i = 0; i < 5; i++) {
    for (const x of [-3.05, 3.05]) flames.points.push(new THREE.Vector3(x, 0.18 * (i + 1) + 0.03, PZ + (1.5 - i * 0.3) - 0.15));
  }

  // the stair's lower reaches, antechamber, corridor and sanctum live in their own group, so the
  // whole exterior can be switched off while the pilgrim is in the garbhagriha
  const ig = new THREE.Group();
  ig.name = 'mahakaleshwar-interior';
  root.add(ig);
  buildDescent(ig, M, S, P, flames);
  return { group: g, interior: ig, flag, flames, doorGlow, frontGate };
}

/** A thin moulded cornice round a rectangle at height y: three stacked bands stepping out to 0.35 m (photos). */
function cornice(parent: THREE.Object3D, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y: number) {
  for (const [dy, out, h] of [[-0.09, 0.35, 0.09], [-0.18, 0.22, 0.09], [-0.27, 0.1, 0.09]] as const) {
    const w = x1 - x0 + out * 2, d = z1 - z0 + out * 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(parent, mat, w, h, out + 0.05, cx, y + dy, z1 + out / 2 - 0.025);
    box(parent, mat, w, h, out + 0.05, cx, y + dy, z0 - out / 2 + 0.025);
    box(parent, mat, out + 0.05, h, d, x1 + out / 2 - 0.025, y + dy, cz);
    box(parent, mat, out + 0.05, h, d, x0 - out / 2 + 0.025, y + dy, cz);
  }
}

/** Shallow cusped arches hung under the lintel between consecutive pillars. */
function cuspedArches(g: THREE.Group, mat: THREE.Material, pts: [number, number][], y: number, h: number, depth: number, colR: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const span = Math.hypot(x1 - x0, z1 - z0) - colR * 2.6;
    const m = new THREE.Mesh(archPanelGeometry(span, h, depth, 5), mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
}

/**
 * The tower's dressed grey-black basalt (cm12): shallow pilaster offsets on the side and rear faces,
 * deep horizontal string courses every ~1.4 m, and projecting balconied jharokhas — a small one on the
 * west face and the tall two-level jharokha bay on the east face.
 */
function towerDetail(g: THREE.Group, S: MahakalMats, M: Materials, TW: number, TZ0: number, top: number) {
  const y0 = 0.9, H = top - 0.6 - y0;
  const ribs: THREE.Matrix4[] = [];
  const faces: [number, number, number, number][] = [ // x, z of face centre, along-x?, outward sign
    [0, TZ0 - TW, 1, -1], [-TW, TZ0, 0, -1], [TW, TZ0, 0, 1],
  ];
  for (const [cx, cz, alongX, sg] of faces) {
    // pilaster offsets: wide, shallow, about every 1.3 m
    const n = Math.round((TW * 2) / 1.3);
    for (let i = 0; i <= n; i++) {
      const t = -TW + (i * TW * 2) / n;
      const x = alongX ? t : cx + sg * 0.07, z = alongX ? cz + sg * 0.07 : TZ0 + t;
      if (!alongX && t > TW - 0.3) continue; // the hall abuts the front
      ribs.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + H / 2, z), new THREE.Quaternion(),
        new THREE.Vector3(alongX ? 0.55 : 0.14, H, alongX ? 0.14 : 0.55)));
    }
  }
  const rib = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(1, 1, 1), 1), S.basalt, ribs.length);
  ribs.forEach((m, i) => rib.setMatrixAt(i, m));
  rib.castShadow = rib.receiveShadow = true;
  g.add(rib);
  // string courses every ~1.4 m: a projecting moulding with a drip below (one instanced unit box each)
  const courses: THREE.Matrix4[] = [];
  for (let y = y0 + 0.25; y < top - 0.3; y += 1.4) {
    for (const [hh, out] of [[0.2, 0.26], [0.08, 0.34]] as const) {
      const yy = y + (out > 0.3 ? 0.2 : 0);
      courses.push(new THREE.Matrix4().compose(new THREE.Vector3(0, yy + hh / 2, TZ0 - TW - out / 2 + 0.05), new THREE.Quaternion(), new THREE.Vector3(TW * 2 + out * 2, hh, out)));
      for (const sx of [-1, 1]) {
        courses.push(new THREE.Matrix4().compose(new THREE.Vector3(sx * (TW + out / 2 - 0.05), yy + hh / 2, TZ0), new THREE.Quaternion(), new THREE.Vector3(out, hh, TW * 2)));
      }
    }
  }
  const crs = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(1, 1, 1), 1), S.basalt, courses.length);
  courses.forEach((m, i) => crs.setMatrixAt(i, m));
  crs.castShadow = crs.receiveShadow = true;
  g.add(crs);
  // west face: a small projecting balcony with two slim columns, a jali parapet and a little ribbed dome
  {
    // (north of the steel stair's landing)
    const sx = -1, x = sx * (TW + 0.55), z = TZ0 - 3.3, y = y0 + H * 0.45;
    box(g, S.basalt, 1.0, 0.22, 2.2, x, y, z);
    for (const dz of [-0.85, 0.85]) box(g, S.pillar, 0.14, 1.6, 0.14, x + sx * 0.38, y + 0.22, z + dz);
    box(g, S.recess, 0.06, 1.5, 1.4, sx * (TW + 0.08), y + 0.25, z);
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), S.jali);
    rail.rotation.y = Math.PI / 2;
    rail.position.set(x + sx * 0.4, y + 0.5, z);
    g.add(rail);
    box(g, S.basalt, 1.1, 0.16, 2.3, x, y + 1.82, z);
    const d = dome(g, S.basalt, x, y + 1.98, z, 0.55, 1.05);
    d.scale.z = 1.6;
  }
  // east face: the tall jharokha bay (cm12 right) — a projecting tower 3.2 m wide, two balconied levels
  // of slim columns under cusped arches, a jali parapet on each, crowned by a ribbed dome
  {
    const xf = TW, D = 1.3, W = 3.2, z = TZ0 + 0.6;
    box(g, S.basalt, D, 2.4, W, xf + D / 2, y0, z);
    for (const [lv, lh] of [[y0 + 2.4, 2.6], [y0 + 5.2, 2.4]] as const) {
      box(g, S.basalt, D + 0.3, 0.2, W + 0.3, xf + D / 2 + 0.05, lv, z);
      box(g, S.recess, 0.06, lh - 0.2, W - 0.6, xf + 0.06, lv + 0.2, z);
      const pts: [number, number][] = [-1.4, -0.47, 0.47, 1.4].map((dz) => [xf + D - 0.12, z + dz]);
      for (const [px, pz] of pts) box(g, S.pillar, 0.14, lh - 0.2, 0.14, px, lv + 0.2, pz);
      cuspedArches(g, S.basalt, pts, lv + lh - 0.55, 0.45, 0.16, 0.07);
      box(g, S.basalt, D + 0.2, 0.18, W + 0.2, xf + D / 2, lv + lh - 0.1, z);
      const rail = new THREE.Mesh(panelUV(new THREE.PlaneGeometry(W - 0.2, 0.55), W - 0.2, 0.55, 0.45), S.jali);
      rail.rotation.y = Math.PI / 2;
      rail.position.set(xf + D + 0.05, lv + 0.5, z);
      g.add(rail);
    }
    const d = dome(g, S.basalt, xf + D / 2, y0 + 7.7, z, 0.75, 1.05);
    d.scale.z = 1.8;
  }
  void M;
}

/** Bake a group's meshes into one merged mesh per material (fewer draw calls for many small boxes). */
function mergeByMaterial(grp: THREE.Group): THREE.Group {
  grp.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  grp.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const mat = m.material as THREE.Material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(geo.index ? geo.toNonIndexed() : geo);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const keys = Object.keys(geos[0].attributes);
    for (const ge of geos) for (const k of Object.keys(ge.attributes)) if (!keys.includes(k)) ge.deleteAttribute(k);
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

/** Curved stone brackets (corbels) under the lintel on both sides of every outer pillar, along the façade. */
function corbels(g: THREE.Group, mat: THREE.Material, ring: { front: [number, number][]; back: [number, number][]; left: [number, number][]; right: [number, number][] }, yTop: number, r: number) {
  const s = new THREE.Shape();
  const L = 0.55, Hh = 0.5;
  s.moveTo(0, 0);
  s.lineTo(L, 0);
  s.lineTo(L, -0.08);
  s.quadraticCurveTo(L * 0.25, -0.12, 0.08, -Hh);
  s.lineTo(0, -Hh);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: r * 1.6, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -r * 0.8);
  const mats: THREE.Matrix4[] = [];
  const along = (row: [number, number][]) => {
    for (const [x, z] of row) {
      const dir = new THREE.Vector3(row[1][0] - row[0][0], 0, row[1][1] - row[0][1]).normalize();
      for (const sg of [-1, 1]) {
        const ry = Math.atan2(-dir.z * sg, dir.x * sg);
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x + dir.x * sg * r * 0.9, yTop - 0.02, z + dir.z * sg * r * 0.9),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
      }
    }
  };
  along(ring.front); along(ring.back); along(ring.left); along(ring.right);
  const inst = new THREE.InstancedMesh(worldUV(geo, 1), mat, mats.length);
  mats.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
}

const MARIGOLD_YELLOW = new THREE.MeshStandardMaterial({ color: 0xd99200, roughness: 0.95 });
/** marigold orange for the outdoor dressing (the sunlit swags read pale with a lighter tone) */
const MARIGOLD_ORANGE = new THREE.MeshStandardMaterial({ color: 0xc23c00, roughness: 0.95 });

/** Vertical strands of marigolds, alternating orange and yellow, hanging from a lintel at height y. */
function marigoldFringe(g: THREE.Group, M: Materials, S: MahakalMats, x0: number, x1: number, z: number, y: number, len: number) {
  const step = 0.18, bead = 0.05;
  const nx = Math.floor((x1 - x0) / step), ny = Math.floor(len / (bead * 1.7));
  const geo = new THREE.IcosahedronGeometry(bead, 0);
  const a = new THREE.InstancedMesh(geo, MARIGOLD_YELLOW, Math.ceil(nx / 2) * ny);
  const b = new THREE.InstancedMesh(geo, MARIGOLD_ORANGE, Math.ceil(nx / 2) * ny);
  let ia = 0, ib = 0;
  for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * step;
    // strands get shorter towards each bay's middle so the fringe scallops
    const n = Math.max(3, Math.round(ny * (0.55 + 0.45 * Math.abs(Math.cos((x / 2.7) * Math.PI)))));
    for (let k = 0; k < n; k++) {
      const m = new THREE.Matrix4().makeTranslation(x, y - k * bead * 1.7, z);
      if (i % 2) a.setMatrixAt(ia++, m); else b.setMatrixAt(ib++, m);
    }
  }
  a.count = ia;
  b.count = ib;
  g.add(a, b);
}

/** Pierced stone (jali) parapet from a to b: posts every ~1.4 m, lattice panels, a coping rail. */
function jaliRail(g: THREE.Group, S: MahakalMats, a: [number, number], b: [number, number], y: number, h: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
  const panel = new THREE.Mesh(panelUV(new THREE.PlaneGeometry(len, h * 0.72), len, h * 0.72, 0.45), S.jali);
  panel.position.set(cx, y + 0.12 + h * 0.36, cz);
  panel.rotation.y = ang;
  panel.castShadow = true;
  g.add(panel);
  for (const [yy, hh, dd] of [[y, 0.12, 0.22], [y + 0.12 + h * 0.72, h * 0.16, 0.26]] as const) {
    const rail = new THREE.Mesh(worldUV(new THREE.BoxGeometry(len + 0.1, hh, dd), 1), S.stone);
    rail.position.set(cx, yy + hh / 2, cz);
    rail.rotation.y = ang;
    rail.castShadow = rail.receiveShadow = true;
    g.add(rail);
  }
  const n = Math.max(1, Math.round(len / 1.4));
  const post = new THREE.InstancedMesh(worldUV(new THREE.BoxGeometry(0.2, h, 0.24).translate(0, h / 2, 0), 1), S.stone, n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    post.setMatrixAt(i, new THREE.Matrix4().makeRotationY(ang).setPosition(a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t));
  }
  post.castShadow = true;
  g.add(post);
}

// ---------- stair, corridor and garbhagriha ----------

/**
 * General darshan: the front stair. As in the real temple, whose garbhagriha lies below the court, the hall's
 * front doorway opens straight onto a flight of white marble steps going down: 17 risers (~0.2 m, treads
 * ~0.26 m) from the threshold through the Ganesh Mandapam, between marble parapets carrying brass hand-rails,
 * to the back edge of the darshan platform, whose open gate leads into the Nandi hall and the sanctum. A diya
 * burns on every other step either side (the way down is lit without a new light); floor arrows carry on
 * from the foot of the stair to the sanctum door.
 */
function frontStair(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames, white: THREE.Material) {
  const { W, WALL, HEAD, FOOT, TOP, BOT, N } = FRONT;
  const rise = (TOP - BOT) / N, run = (HEAD - FOOT) / N, slope = rise / run;
  const GF = GM.FLOOR, CEIL = GM.CEIL_HI;
  for (let i = 1; i <= N; i++) {
    const top = TOP - i * rise, z1 = HEAD - (i - 1) * run;
    box(g, white, W * 2, rise + 0.06, run + 0.02, 0, top - rise - 0.06, z1 - run / 2, undefined, 1.2);
    box(g, M.brass, W * 2 - 0.06, 0.012, 0.04, 0, top, z1 - 0.03);
  }
  P.floor(g, -W, W, HEAD, FOOT, TOP, BOT);
  // (the end wall under its head, and the parapets' outer dado and frieze, are the mandapam's: darshan.ts)
  P.solid(-W - WALL, GF, HEAD, W + WALL, CEIL, HEAD + 0.2);
  // the parapets: solid marble from the mandapam floor, the top following the stair ~1 m above the treads
  // until it meets the ceiling; a brass rail on brackets along the inside of each
  const zMeet = FOOT + (CEIL - BOT - 1.0) / slope;
  const shape = new THREE.Shape();
  shape.moveTo(-FOOT, GF);
  shape.lineTo(-(HEAD + 0.2), GF);
  shape.lineTo(-(HEAD + 0.2), CEIL);
  shape.lineTo(-zMeet, CEIL);
  shape.lineTo(-FOOT, BOT + 1.0);
  shape.closePath();
  // (honed, not polished: a polished face this close to the mandapam's lamp glares)
  const honed = (white as THREE.MeshStandardMaterial).clone();
  honed.roughness = 0.65;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL, bevelEnabled: false });
  geo.rotateY(Math.PI / 2); // shape (u, v) → world (z = -u, y = v), extruded along +x
  worldUV(geo, 1.5);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(geo, honed);
    m.position.x = sx > 0 ? W : -W - WALL;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    P.solid(m.position.x, GF, FOOT, m.position.x + WALL, CEIL, HEAD + 0.2);
    // a marble coping along the sloped top
    const a = new THREE.Vector3(sx * (W + WALL / 2), BOT + 1.03, FOOT), b = new THREE.Vector3(sx * (W + WALL / 2), CEIL + 0.03, zMeet);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL + 0.06, 0.06, a.distanceTo(b)), honed);
    cap.position.copy(a).lerp(b, 0.5);
    cap.rotation.x = -Math.atan2(b.y - a.y, b.z - a.z);
    g.add(cap);
    // the hand-rail, the whole length, 0.9 m over the nosings
    const ra = new THREE.Vector3(sx * (W - 0.06), BOT + 0.9, FOOT + 0.05), rb = new THREE.Vector3(sx * (W - 0.06), TOP + 0.9, HEAD);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ra.distanceTo(rb), 8), M.brass);
    rail.position.copy(ra).add(rb).multiplyScalar(0.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rb.clone().sub(ra).normalize());
    g.add(rail);
    for (let k = 0; k <= 5; k++) {
      const p = ra.clone().lerp(rb, k / 5);
      box(g, M.brass, 0.05, 0.05, 0.04, sx * (W - 0.03), p.y - 0.025, p.z);
    }
    // a diya on every other step, against the parapet: the lit way down
    for (let i = 2; i <= N - 1; i += 2) {
      const top = TOP - i * rise, z = HEAD - (i - 0.5) * run;
      box(g, M.brass, 0.1, 0.04, 0.1, sx * (W - 0.1), top, z);
      flames.points.push(new THREE.Vector3(sx * (W - 0.1), top + 0.09, z));
    }
  }
  // across the far end of the stairwell, at the hall's floor, a brass rail (the passage beyond is not a way on)
  for (const yy of [0.45, 0.95]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, W * 2, 8), M.brass);
    r.rotation.z = Math.PI / 2;
    r.position.set(0, TOP + yy, FOOT + 0.05);
    g.add(r);
  }
  P.solid(-W, TOP, FOOT, W, TOP + 1.0, FOOT + 0.1);
  // a board at the head of the stair, over the way down
  fadeNear(signSprite(g, 'गर्भगृह की ओर ↓', 'To the Garbhagriha ↓', new THREE.Vector3(0, TOP + 2.45, HEAD - 2.6), 1.0), 3.2, 1.6);
  // and over its foot, for the pilgrim coming out from darshan: the real queue goes on up to Omkareshwar
  fadeNear(signSprite(g, 'ओंकारेश्वर महादेव की ओर ↑', 'To Omkareshwar Mahadev ↑', new THREE.Vector3(0, BOT + 1.5, FOOT + 0.2), 1.1), 2.4, 1.1);
  wayArrows(g);
}

/**
 * Small saffron chevrons on the floor along the walk from the foot of the front stair to the sanctum door, and
 * after darshan from the head of the stair through the hall's east aisle to the Omkareshwar doorway
 * (instanced, unlit: one draw, no light). Each is [x, y, z, x, z of the next point it points at].
 */
export const WAY_ARROWS: [number, number, number, number, number][] = [
  [0, 0.9, 7.0, 0, 6.0], // before the doorway's gate
  [-0.35, GM.FLOOR + 0.45, 1.3, -0.85, 0.5], // on the darshan platform, toward its open gate
  [-0.9, GM.FLOOR, 0.0, -0.9, -1.0], // the Nandi hall, round the Nandi's west side
  [-0.9, GM.FLOOR, -1.1, -0.9, -2.0],
  [-0.4, GM.FLOOR, -2.1, 0, -2.8], // into the sanctum door
  // up to Omkareshwar (OMK_WAY in index.ts): out of the doorway and east, up the east aisle, in at its doorway
  [1.9, 0.9, 7.6, 3.0, 7.6],
  [5.8, 0.9, 6.2, 5.8, 5.2],
  [5.8, 0.9, 3.9, 5.8, 2.9],
  [4.6, 0.9, 2.7, 3.6, 2.7],
];

function wayArrows(g: THREE.Group) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.17); s.lineTo(0.15, 0.0); s.lineTo(0.15, -0.08); s.lineTo(0, 0.07);
  s.lineTo(-0.15, -0.08); s.lineTo(-0.15, 0.0); s.closePath();
  const geo = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); // flat on the floor, pointing -z
  const mat = new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const inst = new THREE.InstancedMesh(geo, mat, WAY_ARROWS.length * 2);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (const [x, y, z, tx, tz] of WAY_ARROWS) {
    q.setFromAxisAngle(up, Math.atan2(-(tx - x), -(tz - z)));
    const d = new THREE.Vector3(tx - x, 0, tz - z).normalize();
    for (const k of [0, 1]) {
      inst.setMatrixAt(n++, new THREE.Matrix4().compose(new THREE.Vector3(x + d.x * k * 0.22, y + 0.012, z + d.z * k * 0.22), q, new THREE.Vector3(1, 1, 1)));
    }
  }
  inst.renderOrder = 1;
  g.add(inst);
}

function buildDescent(g: THREE.Group, M: Materials, S: MahakalMats, P: Physics, flames: Flames) {
  const { FLOOR, CEIL, Z: SZ } = SANCTUM;
  const { SW, SS, SN } = STAIR;
  const ANTE_N = SZ + 3.45; // outer face of the sanctum's south wall (z = -2.4)
  const ACEIL = FLOOR + 2.6; // antechamber + corridor ceiling
  const white = new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.32 });
  white.envMap = S.env;
  white.envMapIntensity = 0.8;

  // ---------- main stair: front doorway (y 0.9) north and down to the antechamber ----------
  // (general darshan: not built — the Ganesh Mandapam takes its place below the hall)
  if (VIP_DARSHAN) {
    const N = 21, rise = (0.9 - FLOOR) / N, run = (SS - SN) / N; // rise 0.186 m, tread 0.28 m
    for (let i = 1; i <= N; i++) {
      const top = 0.9 - i * rise, z1 = SS - (i - 1) * run;
      box(g, white, SW * 2 - 0.04, rise + 0.06, run + 0.02, 0, top - rise - 0.06, z1 - run / 2, undefined, 1.2);
      // a darker nosing strip on every tread
      box(g, M.brass, SW * 2 - 0.1, 0.012, 0.04, 0, top, z1 - 0.03);
    }
    box(g, white, SW * 2, 0.1, 6 - SS, 0, 0.8, (6 + SS) / 2);
    P.floor(g, -SW, SW, SS, SN, 0.9, FLOOR);
    P.floor(g, -SW, SW, 6.05, SS, 0.9);
    // side walls below the plinth top, lamp brackets, and hand-rails on both sides
    for (const sx of [-1, 1]) {
      box(g, M.plaster, 0.3, 0.9 - FLOOR + 0.1, SS - SN, sx * (SW + 0.15), FLOOR - 0.1, (SS + SN) / 2, P);
      const a = new THREE.Vector3(sx * (SW - 0.06), 0.9 + 0.9, SS), b = new THREE.Vector3(sx * (SW - 0.06), FLOOR + 0.9, SN);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 8), M.brass);
      rail.position.copy(a).add(b).multiplyScalar(0.5);
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(rail);
      for (let k = 0; k <= 4; k++) {
        const p = a.clone().lerp(b, k / 4);
        box(g, M.brass, 0.04, 0.12, 0.04, sx * SW - sx * 0.02, p.y - 0.06, p.z);
      }
      for (const t of [0.2, 0.55, 0.9]) {
        const p = a.clone().lerp(b, t);
        box(g, M.brass, 0.1, 0.18, 0.14, sx * (SW - 0.02), p.y + 0.6, p.z);
        flames.points.push(new THREE.Vector3(sx * (SW - 0.08), p.y + 0.82, p.z));
      }
    }
    {
      // one warm light half-way down the stair (lights are costly: every lit pixel pays for each)
      const l = new THREE.PointLight(0xffb060, 4.5, 9, 1.5);
      l.position.set(0, -0.4, 1.6);
      g.add(l);
      flames.lights.push(l);
    }
  } else frontStair(g, M, S, P, flames, white);

  // ---------- antechamber (x ±2, z SN..ANTE_N) and the corridor east to the courtyard stair ----------
  const NW = VIP_DARSHAN ? 2.0 : NH; // antechamber / Nandi hall half-width
  P.floor(g, -NW, 12.2, ANTE_N - 0.35, SN, FLOOR);
  P.floor(g, 10, 12.2, SN, 3, FLOOR);
  box(g, white, 12.2 + NW, 0.1, SN - ANTE_N + 0.4, (12.2 - NW) / 2, FLOOR - 0.1, (SN + ANTE_N) / 2 - 0.15);
  box(g, white, 2.2, 0.1, 3 - SN, 11.1, FLOOR - 0.1, (3 + SN) / 2);
  // (general darshan: the Nandi hall below has its own, higher ceiling — this one covers the corridor)
  if (VIP_DARSHAN) box(g, M.plaster, 12.5 + NW, 0.3, SN - ANTE_N, (12.2 - NW - 0.3) / 2, ACEIL, (SN + ANTE_N) / 2);
  else box(g, M.plaster, 12.2 - NH, 0.3, SN - ANTE_N, (12.2 + NH) / 2, ACEIL, (SN + ANTE_N) / 2);
  box(g, M.plaster, 2.4, 0.3, 3 - SN, 11.1, ACEIL, (3 + SN) / 2);
  // west end wall, the south wall either side of the stair, corridor walls
  box(g, M.plaster, 0.3, ACEIL - FLOOR, SN - ANTE_N + 0.3, -NW - 0.15, FLOOR, (SN + ANTE_N - 0.3) / 2, P);
  if (VIP_DARSHAN) {
    box(g, M.plaster, 2.0 - SW, ACEIL - FLOOR, 0.3, -(2.0 + SW) / 2 - 0.15, FLOOR, SN + 0.15, P);
    box(g, M.plaster, 10 - SW - 0.3, ACEIL - FLOOR, 0.3, (10 + SW + 0.3) / 2, FLOOR, SN + 0.15, P);
  } else {
    // general darshan: the antechamber opens south as the Nandi hall, on to the Ganesh Mandapam; the
    // corridor from the east stair meets it at a steel gate that stands open (the virtual yatra goes in)
    const NZ = GM.Z0;
    box(g, M.plaster, 10 - NH - 0.3, ACEIL - FLOOR, 0.3, (10 + NH + 0.3) / 2, FLOOR, SN + 0.15, P);
    const NC = -0.1; // the Nandi hall's ceiling, just under the plinth
    for (const sx of [-1, 1]) box(g, M.plaster, 0.3, NC - FLOOR, NZ - SN, sx * (NH + 0.15), FLOOR, (NZ + SN) / 2, P);
    box(g, M.plaster, 0.3, NC - ACEIL, SN - ANTE_N + 0.3, -NH - 0.15, ACEIL, (SN + ANTE_N - 0.3) / 2);
    box(g, M.plaster, 0.3, NC - ACEIL, SN - ANTE_N, NH + 0.15, ACEIL, (SN + ANTE_N) / 2);
    box(g, M.plaster, NH * 2 + 0.6, 0.3, NZ - ANTE_N + 0.3, 0, NC, (NZ + ANTE_N - 0.3) / 2);
    // the garbhagriha's outer south face, either side of its doorway, clad in silver repoussé (it fills the
    // sides of the view from the darshan platform)
    for (const sx of [-1, 1]) box(g, S.repousse, 2.05, 2.75, 0.04, sx * 2.38, FLOOR, ANTE_N + 0.02);
    box(g, M.gold, 6.9, 0.06, 0.06, 0, FLOOR + 2.75, ANTE_N + 0.05);
    // square LED panels in the Nandi hall's ceiling
    const led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 0.55 });
    for (const lx of [-2.2, 0, 2.2]) for (const lz of [-1.6, -0.1]) box(g, led, 0.5, 0.03, 0.5, lx, NC - 0.03, lz);
    box(g, white, NH * 2, 0.1, NZ - SN + 0.3, 0, FLOOR - 0.1, (NZ + SN) / 2);
    P.floor(g, -NH, NH, SN, NZ, FLOOR);
    const gate = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.8, roughness: 0.4 });
    // the leaf swung back flat against the corridor's south wall
    const GL = SN - ANTE_N - 0.1;
    for (let k = 0; k <= 9; k++) box(g, gate, 0.04, 2.2, 0.04, NH + 0.2 + k * (GL / 9), FLOOR, SN - 0.12);
    for (const yy of [0.15, 1.1, 2.15]) box(g, gate, GL, 0.06, 0.06, NH + 0.2 + GL / 2, FLOOR + yy, SN - 0.12);
  }
  box(g, M.plaster, 12.2 - 3.4, ACEIL - FLOOR, 0.3, (12.2 + 3.4) / 2, FLOOR, ANTE_N - 0.15, P);
  box(g, M.plaster, 0.3, ACEIL - FLOOR, 3 - ANTE_N + 0.3, 12.35, FLOOR, (3 + ANTE_N) / 2, P);
  box(g, M.plaster, 0.3, ACEIL - FLOOR, 3 - SN, 9.85, FLOOR, (3 + SN) / 2 + 0.15, P);
  // lamps along the corridor
  {
    const l = new THREE.PointLight(0xffb060, 3.5, 9, 1.5);
    l.position.set(6.7, ACEIL - 0.4, (SN + ANTE_N) / 2);
    g.add(l);
    flames.lights.push(l);
  }
  for (const x of [5, 8.5]) {
    box(g, M.brass, 0.18, 0.25, 0.12, x, ACEIL - 0.9, SN - 0.05);
    flames.points.push(new THREE.Vector3(x, ACEIL - 0.6, SN - 0.12));
  }
  // a low silver barrier in the antechamber where pilgrims stand for darshan (general mode: its rail is
  // unhooked, the posts stand either side of the way in)
  if (VIP_DARSHAN) box(g, M.silver, 2.4, 0.05, 0.05, 0, FLOOR + 0.9, ANTE_N + 0.55);
  for (const x of [-1.2, 1.2]) box(g, M.silver, 0.06, 0.9, 0.06, x, FLOOR, ANTE_N + 0.55);

  // ---------- the courtyard stair east of the temple, down to the corridor ----------
  const steps = 25;
  for (let i = 0; i < steps; i++) {
    const z = 11 - (i + 1) * (8 / steps);
    const y = FLOOR * ((i + 1) / steps);
    box(g, white, 2.2, 0.08 - FLOOR / steps, 8 / steps + 0.02, 11.1, y - 0.08, z + (8 / steps) / 2, undefined, 1.5);
  }
  P.floor(g, 10, 12.2, 11, 3, 0, FLOOR);
  box(g, M.plaster, 0.3, -FLOOR + 0.2, 8.2, 9.85, FLOOR - 0.1, 7.1, P);
  box(g, M.plaster, 0.3, -FLOOR + 0.2, 8.2, 12.35, FLOOR - 0.1, 7.1, P);
  balustrade(g, M.plaster, [9.85, 3], [9.85, 11], 0, 0.9, P);
  balustrade(g, M.plaster, [12.35, 3], [12.35, 11], 0, 0.9, P);
  box(g, M.plaster, 2.8, -ACEIL, 0.3, 11.1, ACEIL, 3.0);
  columns(g, M.plaster, [[9.95, 11.3], [12.25, 11.3], [9.95, 10.2], [12.25, 10.2]], 0, 3.1, 0.12);
  box(g, M.plaster, 2.8, 0.3, 1.6, 11.1, 3.1, 10.75);
  dome(g, M.plaster, 11.1, 3.4, 10.75, 0.8, 1.0);
  garland(g, M.marigold, new THREE.Vector3(10.0, 2.9, 11.35), new THREE.Vector3(12.2, 2.9, 11.35), 0.35);
  if (!VIP_DARSHAN) {
    // general darshan: in the real temple this stair to the garbhagriha corridor is for VIPs and priests;
    // in the virtual yatra its steel gate stands open, the two leaves swung back against the kiosk posts
    const gate = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.8, roughness: 0.4 });
    for (const [x, sx] of [[9.98, 1], [12.22, -1]] as const) {
      for (let k = 0; k <= 5; k++) box(g, gate, 0.04, 1.5, 0.04, x - sx * 0.08, 0, 11.5 + k * 0.21);
      for (const yy of [0.1, 0.75, 1.45]) box(g, gate, 0.06, 0.06, 1.1, x - sx * 0.08, yy, 12.05);
    }
  }

  // ---------- the garbhagriha, built about its own centre and moved north ----------
  const sg = new THREE.Group();
  sg.position.z = SZ;
  g.add(sg);
  const PS = Object.create(P) as Physics;
  PS.solid = (a, b, c, d, e, f) => P.solid(a, b, c + SZ, d, e, f + SZ);
  const fl: Flames = { points: [], lights: flames.lights };
  buildSanctum(sg, M, S, PS, fl, FLOOR, CEIL, S.env);
  flames.points.push(...fl.points.map((p) => p.add(new THREE.Vector3(0, 0, SZ))));
}

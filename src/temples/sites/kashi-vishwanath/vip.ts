import * as THREE from 'three';
import type { Physics } from '../../engine/kit';
import type { KM } from './mats';
import { Merger } from './merge';
import { board, lettering, TRUST } from './signs';
import { archWallGeo } from './spire';
import { PARISAR, blindArch } from './parisar';
import { DESCENT, PLAZA } from './dham';

/**
 * The Sugam Darshan (VIP) way in, and the security at the Dham's gates:
 *  - Gate No. 4, the Parisar's west gate toward the old city: a sign gantry over the approach, the Sugam Darshan
 *    ticket counter, two door-frame metal detectors and a baggage X-ray scanner outside it; inside, its own
 *    steel-railed lane straight across the west court to the jagati's west steps and the garbhagriha's west door;
 *  - the Ganga Dwar: metal detectors and a scanner in the gateway for those coming up from the ghat;
 *  - a pair of escalators beside the last flight of the stair from the Ganga Dwar plaza.
 * The walking axis through each gate (x = 0) is left open.
 */

const grey = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.45, metalness: 0.2 });
const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 });
const belt = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.85 });
const glass = new THREE.MeshStandardMaterial({ color: 0xbfd4dc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
const cream = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.8 });
const silver = new THREE.MeshStandardMaterial({ color: 0xdcdde0, metalness: 1, roughness: 0.25 });
const red = new THREE.MeshStandardMaterial({ color: 0xc0151c, roughness: 0.5 });
const green = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, side: THREE.DoubleSide });
const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: 0.55, metalness: 0.2 });

/** A door-frame metal detector, the passage along z: two grey side panels with a lit strip, a header. */
function dfmd(B: Merger, P: Physics, x: number, y: number, z: number) {
  for (const s of [-1, 1]) {
    B.span(grey, x + s * 0.45 - 0.06, y, z - 0.3, x + s * 0.45 + 0.06, y + 2.2, z + 0.3);
    B.span(dark, x + s * 0.45 - 0.065, y + 1.2, z - 0.05, x + s * 0.45 + 0.065, y + 1.9, z + 0.05);
    P.solid(x + s * 0.45 - 0.08, y, z - 0.3, x + s * 0.45 + 0.08, y + 2.3, z + 0.3);
  }
  B.span(grey, x - 0.52, y + 2.2, z - 0.32, x + 0.52, y + 2.4, z + 0.32);
  B.span(dark, x - 0.3, y + 2.26, z - 0.33, x + 0.3, y + 2.34, z - 0.32); // the display
}

/** A baggage X-ray scanner along z: the grey cabinet with its tunnel and lead curtains, belts out at both ends. */
function scanner(B: Merger, P: Physics, x: number, y: number, z: number) {
  const L = 2.0, hw = 0.5;
  B.span(grey, x - hw, y + 0.72, z - L / 2, x + hw, y + 1.75, z + L / 2);
  B.span(grey, x - hw, y, z - L / 2, x + hw, y + 0.72, z + L / 2);
  for (const s of [-1, 1]) {
    B.span(dark, x - 0.34, y + 0.75, z + s * L / 2 - 0.01, x + 0.34, y + 1.3, z + s * L / 2 + 0.01); // tunnel mouth
    B.span(belt, x - 0.36, y + 0.7, s > 0 ? z + L / 2 : z - L / 2 - 1.0, x + 0.36, y + 0.76, s > 0 ? z + L / 2 + 1.0 : z - L / 2);
    B.span(grey, x - 0.4, y, s > 0 ? z + L / 2 + 0.9 : z - L / 2 - 1.0, x + 0.4, y + 0.7, s > 0 ? z + L / 2 + 1.0 : z - L / 2 - 0.9);
  }
  B.span(dark, x + hw, y + 1.1, z - 0.3, x + hw + 0.04, y + 1.5, z + 0.3); // the operator's screen
  P.solid(x - hw, y, z - L / 2 - 1.0, x + hw, y + 1.75, z + L / 2 + 1.0);
}

/** A steel barricade from a to b (axis-aligned), two rails on posts. */
export function barricade(B: Merger, K: KM, P: Physics, xa: number, za: number, xb: number, zb: number, y = 0) {
  const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n, z = za + ((zb - za) * i) / n;
    B.box(K.steel, 0.06, 1.05, 0.06, x, y, z);
  }
  for (const h of [0.5, 1.0]) {
    const along = Math.abs(xb - xa) > Math.abs(zb - za);
    B.span(K.steel, Math.min(xa, xb) - (along ? 0 : 0.02), y + h, Math.min(za, zb) - (along ? 0.02 : 0), Math.max(xa, xb) + (along ? 0 : 0.02), y + h + 0.04, Math.max(za, zb) + (along ? 0.02 : 0));
  }
  P.solid(Math.min(xa, xb) - 0.06, y, Math.min(za, zb) - 0.06, Math.max(xa, xb) + 0.06, y + 1.05, Math.max(za, zb) + 0.06);
}

/** Gate No. 4: its archway's centre (x), depth (z0..z1) and opening, on the lane north of the Parisar */
export const GATE4 = { x: 35.2, z0: 17, z1: 21, w: 3.2, h: 5.4 };
/** the Sugam Darshan lane inside: down from the north gate's inner mouth (xIn) then west along z to xEnd */
const VIP = { xIn: 24.8, zStart: 4.7, z: 7.0, hw: 0.7, xEnd: 6.2, gap: [13.6, 17.0] as [number, number] };

/** a run of yellow steel police barricades along x at z (frames with three rails, feet) */
function yellowBarricade(B: Merger, P: Physics, xa: number, xb: number, z: number) {
  for (let x = xa; x < xb - 0.05; x += 2.0) {
    const x1 = Math.min(x + 1.95, xb);
    for (const u of [x + 0.03, x1 - 0.03]) { B.span(yellow, u - 0.03, 0, z - 0.03, u + 0.03, 1.1, z + 0.03); B.span(yellow, u - 0.03, 0, z - 0.25, u + 0.03, 0.04, z + 0.25); }
    for (const y of [0.15, 0.6, 1.05]) B.span(yellow, x, y, z - 0.025, x1, y + 0.05, z + 0.025);
    for (let u = x + 0.2; u < x1 - 0.1; u += 0.2) B.span(yellow, u - 0.012, 0.15, z - 0.012, u + 0.012, 1.05, z + 0.012);
  }
  P.solid(xa, 0, z - 0.25, xb, 1.1, z + 0.25);
}

/** The jagati's west steps start here (the queue lane ends a little short of them). */
const LANE = { z0: -19.2, z1: -8.0, hw: 0.8, gap: [-14.0, -12.4] as [number, number] };

export function buildVip(parisar: THREE.Group, dham: THREE.Group, river: THREE.Group, K: KM, P: Physics) {
  const B = new Merger(P, 'gate-4');
  // ---------- the west gate (toward the old city: the Dhundhiraj route): its security check ----------
  {
    const zo = PARISAR.z0 - 0.6; // the gate's outer face
    const sz = zo - 3.4;
    dfmd(B, P, -1.6, 0, sz);
    dfmd(B, P, 1.6, 0, sz);
    scanner(B, P, 3.7, 0, sz);
    B.span(cream, -3.6, 0, sz - 0.4, -2.6, 0.78, sz + 0.4, true); // the frisking table
    for (const s of [-1, 1]) barricade(B, K, P, s * 5.2, sz - 4.5, s * 5.2, sz + 1.0);
    // inside: its railed lane straight across the west court to the jagati's west steps (a crossing gap halfway)
    for (const s of [-1, 1]) {
      barricade(B, K, P, s * LANE.hw, LANE.z0, s * LANE.hw, LANE.gap[0]);
      barricade(B, K, P, s * LANE.hw, LANE.gap[1], s * LANE.hw, LANE.z1);
    }
  }

  // ---------- Gate No. 4 (Sugam Darshan), on the lane between the Parisar's north wall and the Gyanvapi mosque ----------
  // (from photographs of it: a plain block of pink-buff dressed sandstone with string courses and blind cusped
  //  arches, a great cusped archway with dark wooden doors studded with round bosses, "द्वार ४ / GATE 4" lettered on
  //  the wall beside it under a large silver trishul with a damru, a red दान पात्र, yellow police barricades in front;
  //  the trust's orange ticket-counter kiosk with a green tarpaulin roof nearby)
  {
    const { x: gx, z0: gz0, z1: gz1, w: ow, h: oh } = GATE4;
    const xL = PARISAR.x1 + 1.2, xR = 44, top = 8.6;
    // the block, with its archway (passage along z)
    B.span(K.ashlar, xL, 0, gz0, gx - ow / 2, top, gz1, true);
    B.span(K.ashlar, gx + ow / 2, 0, gz0, xR, top, gz1, true);
    B.span(K.ashlar, gx - ow / 2, oh, gz0, gx + ow / 2, top, gz1, true);
    for (const z of [gz1 + 0.01, gz0 - 0.01]) {
      B.place(K.chunarWall, archWallGeo(ow + 0.9, oh + 0.6, 0.12, ow, oh - 1.5, 1.5, 9), gx, 0, z, z > gz0 ? 0 : Math.PI);
      // string courses and the coping
      for (const [y0, y1, pr] of [[5.9, 6.1, 0.12], [top - 0.3, top, 0.2]] as const) {
        B.span(K.chunar, xL, y0, Math.min(z, z + (z > gz0 ? pr : -pr)), xR, y1, Math.max(z, z + (z > gz0 ? pr : -pr)));
      }
    }
    // a blind cusped arch and a shallow pilaster on the front face, right of the archway
    blindArch(B, K.chunarWall, K.recess, 42.4, 0.6, gz1, 0, 1.9, 3.2, 1.0, 3.4, 4.6, 0.3);
    B.span(K.chunar, gx + ow / 2 + 0.2, 0, gz1, gx + ow / 2 + 0.55, 5.9, gz1 + 0.12);
    // the doors: two dark leaves studded with round bosses, folded back against the passage walls
    const boss = new THREE.SphereGeometry(0.045, 10, 6);
    for (const s of [-1, 1]) {
      const lx = gx + s * (ow / 2 - 0.08), lz0 = gz1 - 0.3 - ow / 2, lz1 = gz1 - 0.3;
      B.span(K.door, lx - 0.06, 0.02, lz0, lx + 0.06, oh - 0.6, lz1);
      for (let y = 0.4; y < oh - 0.8; y += 0.42) for (let z = lz0 + 0.18; z < lz1 - 0.1; z += 0.36) B.place(K.brass, boss, lx - s * 0.07, y, z);
    }
    // "द्वार ४ / GATE 4", the silver trishul and damru above it, the red donation box
    const gl = lettering([['द्वार ४', 120], ['GATE 4', 104]], 1.4, 0.9);
    gl.position.set(38.2, 2.3, gz1 + 0.03);
    gl.renderOrder = 2;
    parisar.add(gl);
    const tx = 39.6;
    B.box(silver, 0.07, 2.2, 0.07, tx, 2.4, gz1 + 0.12);
    for (const u of [-0.32, 0, 0.32]) {
      const prong = new THREE.ConeGeometry(0.06, u === 0 ? 0.7 : 0.55, 10);
      B.add(silver, prong, new THREE.Matrix4().compose(new THREE.Vector3(tx + u * (u === 0 ? 1 : 1.25), 4.95 + (u === 0 ? 0.1 : -0.05), gz1 + 0.12), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -u * 0.6), new THREE.Vector3(1, 1, 0.4)));
    }
    B.add(silver, new THREE.TorusGeometry(0.35, 0.05, 8, 24, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(tx, 4.75, gz1 + 0.12), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI), new THREE.Vector3(1, 1, 1)));
    B.add(silver, new THREE.CylinderGeometry(0.16, 0.08, 0.2, 16).translate(0, 0.1, 0), new THREE.Matrix4().makeTranslation(tx, 3.7, gz1 + 0.25));
    B.add(silver, new THREE.CylinderGeometry(0.08, 0.16, 0.2, 16).translate(0, -0.1, 0), new THREE.Matrix4().makeTranslation(tx, 3.7, gz1 + 0.25));
    B.span(red, 39.9, 0, gz1 + 0.2, 40.7, 1.3, gz1 + 0.8, true); // दान पात्र
    const dp = board([['दान पात्र', 120]], 0.7, 0.22, { bg: '#c0151c', fg: '#ffffff', border: '#ffffff' });
    dp.position.set(40.3, 1.05, gz1 + 0.81);
    parisar.add(dp);
    // yellow police barricades across the approach, open on the walking axis
    for (const [xa, xb] of [[xL + 0.2, gx - 0.9], [gx + 0.9, 37.0]] as const) yellowBarricade(B, P, xa, xb, gz1 + 2.2);
    // security just inside the arch: metal detectors either side of the axis
    dfmd(B, P, gx - 0.95, 0, gz0 + 1.2);
    // the trust's ticket counter and help desk: an orange-boarded kiosk under a green tarpaulin
    const kx = 39.6, kz = gz1 + 7.4;
    B.span(cream, kx - 1.3, 0, kz - 1.0, kx + 1.3, 2.4, kz - 0.85, true);
    B.span(cream, kx - 1.3, 0, kz - 0.85, kx - 1.15, 2.4, kz + 1.0, true);
    B.span(cream, kx + 1.15, 0, kz - 0.85, kx + 1.3, 2.4, kz + 1.0, true);
    B.span(cream, kx - 1.15, 0, kz + 0.85, kx + 1.15, 1.0, kz + 1.0, true);
    B.span(glass, kx - 1.13, 1.0, kz + 0.91, kx + 1.13, 2.0, kz + 0.93);
    B.span(dark, kx - 1.15, 1.0, kz + 0.85, kx + 1.15, 1.04, kz + 1.25);
    P.solid(kx - 1.3, 0, kz - 1.0, kx + 1.3, 2.6, kz + 1.0);
    const tarp = new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2 + 0.18);
    B.add(green, tarp, new THREE.Matrix4().makeTranslation(kx, 2.62, kz + 0.1));
    const tb = board([['SHRI KASHI VISHWANATH TEMPLE TRUST', 44], ['श्री काशी विश्वनाथ मंदिर न्यास', 50], ['टिकट काउंटर  TICKET COUNTER', 64], ['नि:शुल्क लॉकर  FREE LOCKER', 64]], 2.6, 0.95, TRUST);
    tb.position.set(kx, 2.0, kz + 1.02);
    parisar.add(tb);
    const hb = board([['MAY I HELP YOU  ·  हेल्पडेस्क', 70]], 2.2, 0.24, TRUST);
    hb.position.set(kx, 0.72, kz + 1.01);
    parisar.add(hb);

    // inside the court: the Sugam Darshan lane from the north gate round the Gyanvapi mandap to the jagati's north
    // strip and the north door (a crossing gap where the walk to the mandap goes through)
    const zA = VIP.z - VIP.hw, zB = VIP.z + VIP.hw;
    barricade(B, K, P, VIP.xIn - VIP.hw, VIP.zStart, VIP.xIn - VIP.hw, zA);
    barricade(B, K, P, VIP.xIn + VIP.hw, VIP.zStart, VIP.xIn + VIP.hw, zB);
    for (const [xa, xb] of [[VIP.gap[1], VIP.xIn - VIP.hw], [VIP.xEnd, VIP.gap[0]]] as const) barricade(B, K, P, xa, zA, xb, zA);
    for (const [xa, xb] of [[VIP.gap[1], VIP.xIn + VIP.hw], [VIP.xEnd + 0.4, VIP.gap[0]]] as const) barricade(B, K, P, xa, zB, xb, zB);
    const lb = board([['सुगम दर्शन', 120], ['SUGAM DARSHAN', 96]], 1.4, 0.56);
    lb.position.set(VIP.xIn + VIP.hw + 0.06, 1.5, VIP.zStart + 0.9);
    lb.rotation.y = Math.PI / 2;
    parisar.add(lb);
    B.box(K.steel, 0.05, 1.25, 0.05, VIP.xIn + VIP.hw + 0.06, 0, VIP.zStart + 0.9);
    // the north door's lane along the jagati's north strip (an L into the door)
    const J = 0.6;
    barricade(B, K, P, 3.85, 0.85, 3.85, 4.9, J);
    barricade(B, K, P, 4.95, -0.75, 4.95, 4.9, J);
    barricade(B, K, P, 3.4, -0.75, 4.95, -0.75, J);
  }
  // ---------- at the garbhagriha's doors: the sloping steel troughs (from a travel film) down which those who
  // may not go in pour their water and milk, piped through the wall to the Jyotirlinga ----------
  {
    const J = 0.6;
    const trough = (xo: number, zo: number, xi: number, zi: number) => {
      const yo = J + 1.0, yi = J + 0.78;
      const dx = xi - xo, dz = zi - zo, len = Math.hypot(dx, dz);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan2(yo - yi, len), Math.atan2(dx, dz), 0, 'YXZ'));
      const mid = new THREE.Vector3((xo + xi) / 2, (yo + yi) / 2, (zo + zi) / 2);
      const put = (g: THREE.BufferGeometry, ox: number, oy: number) =>
        B.add(K.steel, g, new THREE.Matrix4().compose(mid.clone().add(new THREE.Vector3(ox, oy, 0).applyQuaternion(q)), q, new THREE.Vector3(1, 1, 1)));
      put(new THREE.BoxGeometry(0.46, 0.02, len), 0, 0);
      for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.02, 0.1, len), s * 0.23, 0.05);
      // legs under the outer end, a hand rail along it
      for (const s of [-1, 1]) {
        const lx = xo + (dz / len) * s * 0.2, lz = zo - (dx / len) * s * 0.2;
        B.box(K.steel, 0.04, yo - J, 0.04, lx, J, lz);
      }
      P.solid(Math.min(xo, xi) - 0.3, J, Math.min(zo, zi) - 0.3, Math.max(xo, xi) + 0.3, yo + 0.1, Math.max(zo, zi) + 0.3);
    };
    trough(1.15, 4.7, 1.15, 3.45); // east door, beside the jamb
    trough(1.15, -4.7, 1.15, -3.45); // west door
    trough(4.6, -1.25, 3.45, -1.25); // north door, just outside its lane
  }
  B.flush(parisar, true);

  // ---------- the Ganga Dwar: security in the gateway for those coming up from the ghat ----------
  {
    const B = new Merger(P, 'ganga-dwar-security');
    const y = PLAZA.y, z = 146;
    dfmd(B, P, -1.7, y, z + 1.2);
    dfmd(B, P, 1.7, y, z + 1.2);
    scanner(B, P, -2.75, y, z - 1.0);
    B.flush(river, true);
    const sb = board([['सुरक्षा जाँच', 110], ['SECURITY CHECK', 88]], 1.8, 0.7);
    sb.position.set(0, y + 3.0, z + 3.75);
    river.add(sb);
  }

  // ---------- escalators beside the last flight of the stair (plaza y −10 ↔ the landing at −6.6) ----------
  {
    const B = new Merger(P, 'escalators');
    const za = 133, zb = DESCENT.z1, ya = -6.6, yb = PLAZA.y; // top and foot of the flight
    const ang = Math.atan2(ya - yb, zb - za);
    const len = Math.hypot(zb - za, ya - yb);
    const xs = [DESCENT.x0 + 0.7, DESCENT.x0 + 1.95];
    const tilt = (mat: THREE.Material, w: number, h: number, x: number, yo: number) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, (ya + yb) / 2 + yo, (za + zb) / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang),
        new THREE.Vector3(1, 1, 1),
      );
      B.add(mat, new THREE.BoxGeometry(w, h, len), m);
    };
    for (const x of xs) {
      tilt(grey, 1.2, 0.9, x, -0.1); // the truss
      tilt(belt, 0.8, 0.04, x, 0.37); // the step band
      for (const s of [-1, 1]) {
        tilt(glass, 0.03, 0.9, x + s * 0.5, 0.84); // glass balustrades
        tilt(belt, 0.09, 0.06, x + s * 0.5, 1.3); // black handrails
      }
      // comb plates and newel ends at the top and the foot
      B.span(grey, x - 0.6, ya - 0.02, za - 1.2, x + 0.6, ya + 0.02, za);
      B.span(grey, x - 0.6, yb - 0.02, zb, x + 0.6, yb + 0.02, zb + 1.2);
      for (const s of [-1, 1]) {
        B.span(grey, x + s * 0.5 - 0.06, ya, za - 1.2, x + s * 0.5 + 0.06, ya + 1.0, za - 0.2);
        B.span(grey, x + s * 0.5 - 0.06, yb, zb + 0.2, x + s * 0.5 + 0.06, yb + 1.0, zb + 1.2);
      }
    }
    P.solid(DESCENT.x0, yb, za - 1.2, xs[1] + 0.62, ya + 1.4, zb + 1.2);
    B.flush(dham, false);
  }
}

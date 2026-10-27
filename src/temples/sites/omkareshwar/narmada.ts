import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flames, Physics } from '../../engine/kit';
import { Batch, Instances } from './batch';
import type { OM } from './mats';
import type { CrowdSpots } from './crowd';
import { GHAT } from './layout';

/** the Narmada Aarti platform: built out over the Koti Tirth ghat's river steps, west of the grand stair */
export const AARTI = { x0: -22, x1: -10, z0: GHAT.z1, z1: 36.5, y: GHAT.y };

/**
 * The Narmada Maha-Aarti on Koti Tirth Ghat, as it is offered each evening (video by A TO Z Indrajit): a square
 * stone platform at the river's edge ringed by tall black lantern pillars, each with white X-lattice panels and
 * twin lamps on top, low lantern bollards between, a black railing on the river side; five chowkis in a row
 * facing the river, draped in cream cloth with a red rug on top, a priest in white with a red angavastram on
 * each holding up a tiered brass lamp; a small red-and-white altar to Maa Narmada behind them, rugs where the
 * pilgrims sit. Built for the day (the scene keeps its daylight): the lanterns are lit only faintly.
 */
export function buildNarmadaAarti(g: THREE.Group, K: OM, P: Physics, flames: Flames, C: CrowdSpots) {
  const B = new Batch();
  const { x0, x1, z0, z1, y } = AARTI;
  const cx = (x0 + x1) / 2;

  // ---------- the platform over the steps ----------
  B.span(K.ghat, x0, x1, -16.6, y, z0, z1);
  B.span(K.ghatWet, x0 - 0.05, x1 + 0.05, -16.6, -15.4, z1 - 0.05, z1 + 0.02); // the waterline on its face
  P.floor(g, x0, x1, z0, z1, y);
  // a red carpet where the priests stand, and rugs for those who sit to watch
  const rug = new THREE.MeshStandardMaterial({ color: 0x8a1e22, roughness: 0.95 });
  const rug2 = new THREE.MeshStandardMaterial({ color: 0x6a4a7a, roughness: 0.95 });
  B.span(rug, x0 + 0.8, x1 - 0.8, y, y + 0.01, z1 - 3.4, z1 - 1.0);
  B.span(rug2, x0 + 1.2, cx - 1.0, y, y + 0.01, z0 + 0.6, z0 + 2.4);
  B.span(rug2, cx + 1.0, x1 - 1.2, y, y + 0.01, z0 + 0.6, z0 + 2.4);

  // ---------- black railing on the river face and the sides ----------
  const black = K.railBlack;
  const railRun = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.hypot(bx - ax, bz - az), along = new THREE.Vector3(bx - ax, 0, bz - az).normalize();
    const ang = Math.atan2(bz - az, bx - ax);
    for (const h of [0.15, 1.0]) B.add(black, new THREE.BoxGeometry(L, 0.05, 0.05).rotateY(-ang).translate((ax + bx) / 2, y + h, (az + bz) / 2));
    // lattice infill: diagonal bars between the rails
    for (let t = 0; t < L - 0.3; t += 0.3) {
      for (const s of [1, -1]) {
        const d = new THREE.BoxGeometry(0.42, 0.025, 0.025).rotateZ(s * 0.83).rotateY(-ang);
        d.translate(ax + along.x * (t + 0.15), y + 0.575, az + along.z * (t + 0.15));
        B.add(black, d);
      }
    }
    for (let t = 0; t <= L + 0.01; t += 1.5) B.span(black, ax + along.x * t - 0.03, ax + along.x * t + 0.03, y, y + 1.05, az + along.z * t - 0.03, az + along.z * t + 0.03);
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
    P.solid(minX - 0.08, y, minZ - 0.08, maxX + 0.08, y + 1.1, maxZ + 0.08);
  };
  railRun(x0 + 0.15, z1 - 0.15, x1 - 0.15, z1 - 0.15);
  railRun(x0 + 0.15, z0 + 3.0, x0 + 0.15, z1 - 0.15);
  railRun(x1 - 0.15, z0 + 3.0, x1 - 0.15, z1 - 0.15);

  // ---------- lantern pillars: black frames, white X-lattice panels, twin lamps on top ----------
  const lc = document.createElement('canvas');
  lc.width = 64; lc.height = 256;
  const c = lc.getContext('2d')!;
  c.fillStyle = '#fbf3dc'; c.fillRect(0, 0, 64, 256);
  c.strokeStyle = '#141414'; c.lineWidth = 7;
  c.strokeRect(3, 3, 58, 250);
  for (let k = 0; k < 4; k++) {
    const y0 = 6 + k * 62, y1 = y0 + 62;
    c.beginPath(); c.moveTo(6, y0); c.lineTo(58, y1); c.moveTo(58, y0); c.lineTo(6, y1); c.stroke();
    c.beginPath(); c.moveTo(3, y1); c.lineTo(61, y1); c.stroke();
  }
  const lt = new THREE.CanvasTexture(lc);
  lt.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.MeshStandardMaterial({ map: lt, emissive: 0xffe2a0, emissiveMap: lt, emissiveIntensity: 0.35, roughness: 0.6 });
  const ph = 2.6, pw = 0.36;
  const pillar = new Instances(new THREE.BoxGeometry(pw, ph, pw).translate(0, ph / 2, 0), panel);
  const posts: [number, number][] = [];
  for (let x = x0 + 0.5; x <= x1 - 0.4; x += 2.75) posts.push([x, z1 - 0.55]);
  for (const x of [x0 + 0.5, x1 - 0.5]) for (const z of [z0 + 3.0, z0 + 5.0]) posts.push([x, z]);
  for (const [x, z] of posts) {
    pillar.at(x, y, z);
    B.span(black, x - pw / 2 - 0.04, x + pw / 2 + 0.04, y, y + 0.12, z - pw / 2 - 0.04, z + pw / 2 + 0.04);
    B.span(black, x - pw / 2 - 0.05, x + pw / 2 + 0.05, y + ph, y + ph + 0.08, z - pw / 2 - 0.05, z + pw / 2 + 0.05);
    for (const dx of [-0.1, 0.1]) {
      B.lathe(K.brass, [[0, 0], [0.05, 0], [0.07, 0.05], [0.04, 0.07], [0, 0.07]], x + dx, y + ph + 0.08, z, 10);
      flames.points.push(new THREE.Vector3(x + dx, y + ph + 0.2, z));
    }
    P.solid(x - pw / 2, y, z - pw / 2, x + pw / 2, y + ph, z + pw / 2);
  }
  pillar.flush(g, false);
  // low lantern bollards along the river face between the pillars
  const bollard = new Instances(new THREE.BoxGeometry(0.2, 0.55, 0.2).translate(0, 0.275, 0), panel);
  for (let i = 0; i < posts.length; i++) {
    const [x, z] = posts[i];
    if (z !== z1 - 0.55 || x + 1.4 > x1) continue;
    bollard.at(x + 1.375, y, z1 - 0.55);
  }
  bollard.flush(g, false);

  // ---------- five chowkis in a row, a priest with a tiered lamp on each ----------
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.9 });
  // the tiered aarti lamp (nine, seven, five, three and one cups of flame), one shared geometry; each priest
  // circles his before Maa Narmada (update below), the flames riding on it
  const tiers: [number, number, number][] = [[0.2, 0, 9], [0.155, 0.09, 7], [0.11, 0.18, 5], [0.06, 0.27, 3], [0, 0.35, 1]];
  const lampParts: THREE.BufferGeometry[] = [new THREE.LatheGeometry([[0.016, -0.26], [0.024, -0.22], [0.015, -0.13], [0.022, -0.02], [0.06, 0], [0, 0.005]].map(([a, b]) => new THREE.Vector2(a, b)), 12)];
  const flamePts: number[] = [];
  for (const [r, h, n] of tiers) {
    if (r > 0) lampParts.push(new THREE.LatheGeometry([[0, 0], [r + 0.025, 0], [r + 0.025, 0.014], [0, 0.014]].map(([a, b]) => new THREE.Vector2(a, b)), 24).translate(0, h - 0.014, 0));
    if (h > 0) lampParts.push(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 6).translate(0, h - 0.045, 0));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = Math.cos(a) * r, pz = Math.sin(a) * r;
      lampParts.push(new THREE.LatheGeometry([[0, 0], [0.017, 0], [0.025, 0.013], [0.027, 0.022], [0.02, 0.022], [0, 0.013]].map(([a2, b]) => new THREE.Vector2(a2, b)), 8).translate(px, h, pz));
      flamePts.push(px, h + 0.05, pz);
    }
  }
  const lampGeo = mergeGeometries(lampParts.map((q) => { const n = q.index ? q.toNonIndexed() : q; n.deleteAttribute('uv'); return n; }))!;
  lampGeo.computeVertexNormals();
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute('position', new THREE.Float32BufferAttribute(flamePts, 3));
  const fc = document.createElement('canvas');
  fc.width = fc.height = 64;
  const fg = fc.getContext('2d')!;
  const grd = fg.createRadialGradient(32, 36, 1, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.25, 'rgba(255,200,90,0.95)'); grd.addColorStop(0.6, 'rgba(255,120,20,0.45)'); grd.addColorStop(1, 'rgba(255,80,0,0)');
  fg.fillStyle = grd; fg.fillRect(0, 0, 64, 64);
  const flameMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(fc), size: 0.11, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd28a });
  const lamps: { g: THREE.Group; x: number; y: number; z: number }[] = [];
  const lampAt = (lx: number, ly: number, lz: number) => {
    const lg = new THREE.Group();
    lg.add(new THREE.Mesh(lampGeo, K.brass), new THREE.Points(flameGeo, flameMat));
    lg.position.set(lx, ly, lz);
    g.add(lg);
    lamps.push({ g: lg, x: lx, y: ly, z: lz });
  };
  const W = 1.25, D = 0.85, H = 0.5, zc = z1 - 2.2;
  for (let i = 0; i < 5; i++) {
    const x = x0 + 1.6 + i * ((x1 - x0 - 3.2) / 4);
    // the chowki under a cream cloth falling to the ground, a red rug on top
    B.span(cream, x - W / 2 - 0.03, x + W / 2 + 0.03, y, y + H, zc - D / 2 - 0.03, zc + D / 2 + 0.03);
    B.span(rug, x - W / 2 + 0.06, x + W / 2 - 0.06, y + H, y + H + 0.015, zc - D / 2 + 0.06, zc + D / 2 - 0.06);
    P.solid(x - W / 2, y, zc - D / 2, x + W / 2, y + H, zc + D / 2);
    // the priest facing Maa Narmada, his lamp held before him; a brass stand with a lamp at the chowki's corner
    C.add(x, y + H + 0.015, zc - 0.1, 0, false, 'pujari');
    C.list[C.list.length - 1].pose = 'thali';
    lampAt(x, y + H + 1.08, zc + 0.2);
    B.lathe(K.brass, [[0, 0], [0.09, 0], [0.04, 0.05], [0.02, 0.6], [0.06, 0.62], [0.06, 0.66], [0, 0.66]], x + W / 2 - 0.14, y + H, zc + D / 2 - 0.12, 12);
    flames.points.push(new THREE.Vector3(x + W / 2 - 0.14, y + H + 0.72, zc + D / 2 - 0.12));
  }

  // ---------- the altar to Maa Narmada behind them ----------
  {
    const red = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.8 });
    const az = z0 + 3.4;
    B.span(K.whiteConcrete, cx - 1.0, cx + 1.0, y, y + 0.6, az - 0.5, az + 0.5);
    B.span(red, cx - 1.05, cx + 1.05, y + 0.6, y + 0.66, az - 0.55, az + 0.55);
    for (const dx of [-0.85, 0.85]) B.span(red, cx + dx - 0.05, cx + dx + 0.05, y + 0.66, y + 1.9, az - 0.4, az - 0.3);
    B.span(red, cx - 0.95, cx + 0.95, y + 1.9, y + 2.05, az - 0.55, az - 0.2);
    // the murti draped in red, a brass kalash and a lamp before her
    B.lathe(K.redCloth, [[0, 0], [0.2, 0], [0.22, 0.25], [0.16, 0.5], [0.1, 0.6], [0.12, 0.7], [0, 0.78]], cx, y + 0.66, az - 0.1, 16);
    B.lathe(K.brass, [[0, 0], [0.1, 0], [0.14, 0.1], [0.12, 0.2], [0.06, 0.24], [0.08, 0.28], [0, 0.3]], cx - 0.55, y + 0.66, az + 0.2, 14);
    B.lathe(K.marigold, [[0, 0.28], [0.07, 0.3], [0.05, 0.38], [0, 0.4]], cx - 0.55, y + 0.66, az + 0.2, 10);
    B.lathe(K.brass, [[0, 0], [0.06, 0], [0.08, 0.03], [0, 0.04]], cx + 0.45, y + 0.66, az + 0.25, 10);
    flames.points.push(new THREE.Vector3(cx + 0.45, y + 0.74, az + 0.25));
    P.solid(cx - 1.05, y, az - 0.55, cx + 1.05, y + 2.05, az + 0.55);
  }

  // ---------- pilgrims sitting on the rugs and the ghat behind, facing the river ----------
  for (let i = 0, tries = 0; i < 34 && tries < 600; tries++) {
    const x = x0 + 1.4 + C.rnd() * (x1 - x0 - 2.8), z = z0 + 0.6 + C.rnd() * 1.8;
    if (Math.abs(x - cx) < 1.3) continue;
    if (C.list.some((p) => Math.abs(p.x - x) < 0.6 && Math.abs(p.z - z) < 0.5)) continue;
    C.add(x, y, z, (C.rnd() - 0.5) * 0.4, true);
    i++;
  }
  for (let i = 0, tries = 0; i < 40 && tries < 800; tries++) {
    const x = x0 - 1 + C.rnd() * (x1 - x0 + 2), z = GHAT.z0 + 1.2 + C.rnd() * (GHAT.z1 - GHAT.z0 - 1.6);
    if (C.list.some((p) => Math.abs(p.x - x) < 0.6 && Math.abs(p.z - z) < 0.5)) continue;
    C.add(x, y, z, (C.rnd() - 0.5) * 0.5, C.rnd() < 0.7);
    i++;
  }
  B.flush(g, false);
  return {
    /** the aarti: all five lamps raised and circled together, clockwise in the plane facing the river, a turn every 3.2 s */
    update(t: number) {
      const a = (t * Math.PI * 2) / 3.2;
      for (const l of lamps) {
        l.g.position.set(l.x + Math.sin(a) * 0.32, l.y + 0.18 + Math.cos(a) * 0.32, l.z + 0.06 + 0.04 * Math.sin(a * 2));
        l.g.rotation.set(0.12 * Math.cos(a), a * 0.25, -0.18 * Math.sin(a));
      }
      flameMat.size = 0.1 + 0.015 * Math.sin(t * 23) * Math.sin(t * 7.3);
    },
  };
}

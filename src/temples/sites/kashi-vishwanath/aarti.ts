import * as THREE from 'three';
import type { Flames, Physics } from '../../engine/kit';
import type { CrowdSpots } from './crowd';
import type { KM } from './mats';
import { Merger } from './merge';
import type { Offerings } from './shivling';
import { lathe, kalashGeo } from './spire';
import { GHAT, STEPS } from './riverfront';

/**
 * The Ganga Aarti on the ghat below the Ganga Dwar, as it is offered on the ghats of Varanasi each evening:
 * a row of wooden chowkis on the lower landing, draped in red and saffron, a priest in saffron on each,
 * facing the river and holding up a tiered brass lamp of many flames; a kalash, a conch and a bell on every
 * chowki, tall bamboo poles with hanging lamp baskets behind, marigold garlands strung between them, a line of
 * diyas along the front edge, and pilgrims sitting on the steps above to watch.
 * The walk down the axis (x = 0) to the water is left open.
 */
export function buildGangaAarti(g: THREE.Group, K: KM, P: Physics, flames: Flames, O: Offerings, C: CrowdSpots) {
  const B = new Merger(P, 'ganga-aarti');
  const land = STEPS.filter((s) => s.landing)[1]; // the lower landing, a metre above the water
  const y = land.y, zc = GHAT.Z0 + (land.o0 + land.o1) / 2;
  const W = 1.7, H = 0.45, top = y + H;
  const XS = [-13.5, -9, -4.5, 4.5, 9, 13.5];

  const red = new THREE.MeshStandardMaterial({ color: 0xa3161c, roughness: 0.9 });
  const saffron = new THREE.MeshStandardMaterial({ color: 0xe87a12, roughness: 0.9 });
  const conch = new THREE.MeshStandardMaterial({ color: 0xf1e9dc, roughness: 0.4 });

  // the tiered aarti lamp: a handle, then rings of little oil cups, nine, seven, five, three and one at the top
  const tiers: [number, number, number][] = [[0.17, 0, 9], [0.13, 0.08, 7], [0.09, 0.16, 5], [0.05, 0.24, 3], [0, 0.31, 1]];
  const cup = lathe([[0, 0], [0.015, 0], [0.022, 0.012], [0.024, 0.02], [0.018, 0.02], [0, 0.012]], 10);
  const handle = lathe([[0.016, -0.24], [0.022, -0.2], [0.014, -0.12], [0.02, -0.02], [0.05, 0], [0, 0.005]], 12);
  const lampAt = (cx: number, cy: number, cz: number) => {
    B.place(K.brass, handle, cx, cy, cz);
    for (const [r, h, n] of tiers) {
      if (r > 0) B.place(K.brass, lathe([[0, 0], [r + 0.02, 0], [r + 0.02, 0.012], [0, 0.012]], 24), cx, cy + h - 0.012, cz);
      if (h > 0) B.box(K.brass, 0.012, 0.08, 0.012, cx, cy + h - 0.08, cz);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
        B.place(K.brass, cup, px, cy + h, pz);
        flames.points.push(new THREE.Vector3(px, cy + h + 0.035, pz));
      }
    }
  };

  const bell = lathe([[0, 0.12], [0.012, 0.12], [0.012, 0.09], [0.035, 0.07], [0.05, 0.01], [0.055, 0], [0, 0.002]], 20);
  const shell = new THREE.SphereGeometry(0.06, 16, 10).scale(1.6, 0.8, 1);
  const basket = lathe([[0, -0.2], [0.12, -0.16], [0.2, -0.05], [0.22, 0.08], [0.18, 0.12], [0, 0.12]], 16, 16, 0.08);

  for (const x of XS) {
    // the chowki: a wooden platform on four stout legs, red cloth over it with a saffron border hanging at the front
    B.span(K.door, x - W / 2, top - 0.08, zc - W / 2, x + W / 2, top, zc + W / 2);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(K.door, 0.12, H - 0.08, 0.12, x + u * (W / 2 - 0.08), y, zc + v * (W / 2 - 0.08));
    B.span(red, x - W / 2 - 0.02, top, zc - W / 2 - 0.02, x + W / 2 + 0.02, top + 0.012, zc + W / 2 + 0.02);
    B.span(saffron, x - W / 2 - 0.02, top - 0.2, zc + W / 2 + 0.02, x + W / 2 + 0.02, top + 0.012, zc + W / 2 + 0.03);
    P.solid(x - W / 2, y, zc - W / 2, x + W / 2, top, zc + W / 2);
    // on it: a brass kalash with a coconut, a conch, a bell, a garland along the front edge
    B.place(K.brass, kalashGeo(0.3), x - 0.6, top + 0.012, zc - 0.55);
    B.place(conch, shell, x + 0.6, top + 0.06, zc - 0.55, 0.6);
    B.place(K.brass, bell, x + 0.45, top + 0.012, zc - 0.62);
    O.strand(new THREE.Vector3(x - W / 2, top + 0.02, zc + W / 2 + 0.03), new THREE.Vector3(x + W / 2, top + 0.02, zc + W / 2 + 0.03), 0.14, 1);
    O.heap(x - 0.55, top + 0.014, zc + 0.5, 0.12, 0.05, 8);
    // the priest, standing in the middle facing the Ganga, the lamp held before him
    C.add(x, top + 0.012, zc - 0.1, 0, false, 'kanwariya');
    C.list[C.list.length - 1].pose = 'thali';
    lampAt(x, top + 1.08, zc + 0.2);
    // a tall bamboo pole at the chowki's back corner with a lamp basket hung from its top
    const px = x + W / 2 - 0.1, pz = zc - W / 2 - 0.15, ph = 6.5;
    B.box(K.bamboo, 0.07, ph, 0.07, px, y, pz, true);
    B.place(K.bamboo, basket, px, y + ph - 0.45, pz);
    flames.points.push(new THREE.Vector3(px, y + ph - 0.38, pz));
  }
  // marigold garlands strung pole to pole
  for (let i = 0; i < XS.length - 1; i++) {
    if (XS[i] < 0 && XS[i + 1] > 0) continue; // not across the walk to the water
    const a = new THREE.Vector3(XS[i] + W / 2 - 0.1, y + 5.6, zc - W / 2 - 0.15);
    const b = new THREE.Vector3(XS[i + 1] + W / 2 - 0.1, y + 5.6, zc - W / 2 - 0.15);
    O.strand(a, b, 0.9, 1);
  }
  // a line of diyas along the landing's front edge
  for (let x = -15; x <= 15; x += 0.6) if (Math.abs(x) > 1.4) flames.points.push(new THREE.Vector3(x, y + 0.03, GHAT.Z0 + land.o1 - 0.12));

  // pilgrims sitting on the steps above the landing to watch, families together, facing the river
  const above = STEPS.slice(11, 19);
  for (let i = 0, tries = 0; i < 70 && tries < 900; tries++) {
    const s = above[Math.floor(C.rnd() * above.length)];
    const x = (C.rnd() - 0.5) * 34;
    if (Math.abs(x) < 2.4) continue;
    const z = GHAT.Z0 + (s.o0 + s.o1) / 2;
    if (C.list.some((p) => Math.abs(p.x - x) < 0.55 && Math.abs(p.z - z) < 0.4)) continue;
    C.add(x, s.y, z, (C.rnd() - 0.5) * 0.4, true);
    i++;
  }
  B.flush(g, false);
}

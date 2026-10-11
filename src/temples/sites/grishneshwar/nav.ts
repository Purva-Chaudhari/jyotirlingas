import type { NavEdge, NavGraph, Place } from '../types';
import { F_M, F_G, NANDI } from './temple';
import { KUND, SOUTH_GATE } from './precinct';

type V = [number, number, number];

/**
 * Grishneshwar's walking graph for Places (engine/travel.ts). +z east (the mandapa and the main door), +x north;
 * the court y 0, the plinth / mandapa 1.5, the garbhagriha 0.45 (one goes down to the linga), the village ground
 * just below the court. The way in: the Verul lane → the south gate and its queue shed → the court → the south
 * porch steps (straight through the narrow door in the mandapa's south wall) → the sabhamandapa past Nandi → down into the garbhagriha. Off it: the lane west to the Shivalaya
 * Tirtha and down its steps to the water's edge, round the temple at court level (the plinth has no
 * pradakshina path in the model), the east porch down to the east forecourt (trishul) and out of the east gate.
 * Every edge is walk-checked with `node scripts/navcheck.mjs grishneshwar`.
 */
export function grishneshwarNav(): { nav: NavGraph; places: Place[] } {
  const nodes: Record<string, V> = {
    // the village lane outside the south gate, and the path west to the Shivalaya Tirtha
    spawn: [-41, 0, SOUTH_GATE.z],
    lane: [-35, -0.12, 5],
    'kund-path': [-54, -0.12, -8.5],
    kund: [-56.5, -0.12, -10],
    'kund-steps': [-63, -2.1, -8],
    'kund-water': [-73.5, -5.7, -6],
    // through the south gate and the queue shed into the court; the south porch
    'gate-in': [-27, 0, 18],
    prangan: [-21.5, 0, 25],
    'court-sw': [-14.5, 0, 19.5],
    'shed-e': [-11, 0, 15.5],
    'porch-foot': [-10.9, 0, 14],
    porch: [-16, 0, 14],
    'porch-top': [-4.6, F_M, 14],
    // the sabhamandapa, Nandi, the antarala and the garbhagriha
    'hall-s': [-2.2, F_M, 15.6],
    'hall-c': [-1.5, F_M, 16],
    sabhamandapa: [2.5, F_M, 18],
    'hall-n': [1.5, F_M, 9.6],
    'hall-door': [0.5, F_M, 8.6],
    antarala: [0, 0.63, 3.6],
    darshan: [0, F_G, 1.6],
    garbhagriha: [-0.9, F_G, 1.5],
    // round the temple at court level: south side, behind (west), north side
    'court-s': [-11.5, 0, -5],
    'court-sw2': [-8, 0, -8.5],
    behind: [0, 0, -12],
    'court-nw': [8.5, 0, -8.2],
    'court-n': [10.5, 0, -1.5],
    'court-ne': [14, 0, 12],
    // the east porch down to the east forecourt and the east gate
    'hall-e': [0.5, F_M, 19.5],
    'east-court': [0, 0, 36],
    'east-gate': [0, -0.12, 50],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'gate-in', 'prangan', 'court-sw', 'shed-e', 'porch-foot', 'porch-top', 'hall-s', 'hall-c', 'sabhamandapa', 'hall-n', 'hall-door', 'antarala', 'darshan', 'garbhagriha'),
    ['porch-foot', 'porch'],
    ...chain('spawn', 'lane', 'kund-path', 'kund', 'kund-steps', 'kund-water'),
    ...chain('shed-e', 'court-s', 'court-sw2', 'behind', 'court-nw', 'court-n', 'court-ne', 'east-court'),
    ...chain('sabhamandapa', 'hall-e', 'east-court', 'east-gate'),
  ];
  const look = (x: number, y: number, z: number): V => [x, y, z];
  const places: Place[] = [
    { id: 'lane', node: 'lane', label: { hi: 'वेरूळ गावातील गल्ली', en: 'Verul village lane' }, look: look(-28, 3, 17) },
    { id: 'prangan', node: 'prangan', label: { hi: 'मंदिर प्रांगण', en: 'Temple courtyard' }, look: look(0, 8, 8) },
    { id: 'kund', node: 'kund', label: { hi: 'शिवालय तीर्थ', en: 'Shivalaya Tirtha' }, look: look(KUND.x, -4, KUND.z) },
    { id: 'kund-water', node: 'kund-water', label: { hi: 'शिवालय तीर्थ · पाण्याजवळ', en: "Shivalaya Tirtha · the water's edge" }, look: look(KUND.x, -KUND.depth, KUND.z) },
    { id: 'porch', node: 'porch', label: { hi: 'दक्षिण मुखमंडप', en: 'The south porch' }, look: look(-6, 3, 14) },
    { id: 'sabhamandapa', node: 'hall-c', label: { hi: 'सभामंडप · नंदी', en: 'Sabhamandapa · Nandi' }, look: look(NANDI.x, F_M + 0.9, NANDI.z) },
    { id: 'garbhagriha', node: 'darshan', label: { hi: 'गर्भगृह · श्री घृष्णेश्वर दर्शन', en: 'Garbhagriha · darshan of Grishneshwar' }, look: look(0, F_G + 0.3, 0) },
    { id: 'behind', node: 'behind', label: { hi: 'प्रदक्षिणा · मंदिराच्या मागे', en: 'Pradakshina · behind the temple' }, look: look(0, 9, 0) },
    { id: 'east-court', node: 'east-court', label: { hi: 'पूर्व प्रांगण · त्रिशूळ', en: 'East forecourt · the trishul' }, look: look(0, 6, 10) },
    { id: 'east-gate', node: 'east-gate', label: { hi: 'पूर्व द्वार', en: 'The east gate' }, look: look(0, 8, 10) },
  ];
  return { nav: { nodes, edges }, places };
}

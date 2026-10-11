import type { NavEdge, NavGraph, Place } from '../types';
import { F, GARBHA } from './temple';
import { KUND, NANDI } from './precinct';

type V = [number, number, number];

/**
 * Trimbakeshwar's walking graph for Places (engine/travel.ts). +z east (the Mahadwar, the town), +x north, the
 * sanctum at z −9; the court 0, the jagati and mandapa floor 1.5, the antarala steps 1.5 → 0.45 and the sanctum
 * floor 0.45. It follows the pilgrim's walk: the town street → the Mahadwar → the courtyard → by the Nandi
 * mandapa → the east porch steps → the sabha mandapa → down the antarala steps to the sanctum door (the darshan
 * mirror); plus the darshan queue in its shed along the north side, which leads to the north porch, the south
 * porch, the Amrut Kund and the steps down into it, and the round behind the shikhara. The north gate's doors
 * stand closed (no way out there). Check with `node scripts/navcheck.mjs trimbakeshwar`.
 */
export function trimbakNav(): { nav: NavGraph; places: Place[] } {
  const zc = 3.15; // the side porches' axis
  const kx = (KUND.x0 + KUND.x1) / 2;
  const nodes: Record<string, V> = {
    // the town street, the Mahadwar, the courtyard
    spawn: [0, 0, 72],
    street: [0, 0, 60],
    mahadwar: [0, 0, 46.5],
    courtyard: [-2, 0, 42],
    'court-se': [-17, 0, 36],
    // past the Nandi mandapa (closed; Nandi is seen through its west door) to the east porch steps
    'court-w': [-4.6, 0, 30],
    nandi: [-3.7, 0, NANDI.z],
    'nandi-sw': [-3.7, 0, NANDI.z - NANDI.half - 1.7],
    'nandi-w': [0, 0, NANDI.z - NANDI.half - 1.7],
    'porch-foot': [0, 0, 18.2],
    porch: [0, F, 12],
    mandapa: [0, F, 4],
    'antarala-top': [0, F, -3.2],
    antarala: [0, 0.98, -4.6],
    darshan: [0, GARBHA.floor, -6.4],
    // the north porch and the darshan queue's shed
    'north-porch': [8.5, F, zc],
    'np-foot': [14.6, 0, zc],
    'queue-link': [15, 0, -1.3],
    'queue-out': [17.5, 0, -1.3],
    queue: [17.5, 0, 30],
    'queue-in': [17.5, 0, 34],
    'court-ne': [12, 0, 36],
    // the south porch, the Amrut Kund and its steps
    'south-porch': [-8.5, F, zc],
    'sp-foot': [-14.6, 0, zc],
    kund: [-17, 0, -14],
    'kund-top': [kx, 0, KUND.z1 + 1.0],
    'kund-steps': [kx, -1.14, KUND.z1 - 1.9],
    // behind the shikhara (west)
    'back-s': [-13, 0, -21],
    back: [0, 0, -21],
    'back-n': [13, 0, -21],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'street', 'mahadwar', 'courtyard', 'court-w', 'nandi', 'nandi-sw', 'nandi-w', 'porch-foot', 'porch', 'mandapa', 'antarala-top', 'antarala', 'darshan'),
    ...chain('courtyard', 'court-se', 'court-w'),
    ...chain('mandapa', 'north-porch', 'np-foot', 'queue-link', 'queue-out', 'queue', 'queue-in', 'court-ne', 'courtyard'),
    ...chain('mandapa', 'south-porch', 'sp-foot', 'kund', 'kund-top', 'kund-steps'),
    ...chain('kund', 'back-s', 'back', 'back-n', 'np-foot'),
  ];
  const places: Place[] = [
    { id: 'street', node: 'street', label: { hi: 'त्र्यंबक · महाद्वार के सामने', en: 'Trimbak street · before the Mahadwar' }, look: [0, 9, 0] },
    { id: 'mahadwar', node: 'mahadwar', label: { hi: 'महाद्वार', en: 'Mahadwar (east gate)' }, look: [0, 12, 0] },
    { id: 'courtyard', node: 'courtyard', label: { hi: 'मंदिर प्रांगण', en: 'Temple courtyard' }, look: [0, 14, 0] },
    { id: 'nandi', node: 'nandi', label: { hi: 'नंदी मंडप', en: 'Nandi Mandapa' }, look: [0, 2, NANDI.z] },
    { id: 'porch', node: 'porch', label: { hi: 'पूर्व मुख मंडप', en: 'East porch' }, look: [0, F + 1.5, 0] },
    { id: 'mandapa', node: 'mandapa', label: { hi: 'सभा मंडप', en: 'Sabha Mandapa' }, look: [0, F + 1, -6] },
    { id: 'antarala', node: 'antarala', label: { hi: 'अंतराळ · दर्पण', en: 'Antarala · the darshan mirror' }, look: [0, 0.8, -9] },
    { id: 'darshan', node: 'darshan', label: { hi: 'गर्भगृह · त्र्यंबकेश्वर दर्शन', en: 'Garbhagriha · darshan of Trimbakeshwar' }, look: [-0.08, 0.45, -9] },
    { id: 'queue', node: 'queue', label: { hi: 'दर्शन रांग', en: 'Darshan queue (north shed)' }, look: [17.5, 1.5, 0] },
    { id: 'north-porch', node: 'north-porch', label: { hi: 'उत्तर मुख मंडप', en: 'North porch' }, look: [0, F + 1.5, zc] },
    { id: 'kund', node: 'kund', label: { hi: 'अमृत कुंड', en: 'Amrut Kund' }, look: [kx, -1.5, (KUND.z0 + KUND.z1) / 2] },
    { id: 'kund-steps', node: 'kund-steps', label: { hi: 'अमृत कुंड की सीढ़ियाँ', en: 'Steps down into the Amrut Kund' }, look: [kx, -2.3, KUND.z0] },
    { id: 'pradakshina', node: 'back', label: { hi: 'प्रदक्षिणा · शिखर के पीछे', en: 'Pradakshina · behind the shikhara' }, look: [0, 25, -9] },
  ];
  return { nav: { nodes, edges }, places };
}

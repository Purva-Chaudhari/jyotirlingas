import type { NavEdge, NavGraph, Place } from '../types';
import { JAGATI, FLOOR } from './temple';
import { BAAN, DWAR, STATUE } from './precinct';

type V = [number, number, number];

/**
 * Somnath's walking graph for Places (engine/travel.ts). +z east (the approach), +x north, the garbhagriha at
 * the origin; the court 0, the jagati 1.2, the mandapa and sanctum floors 1.8. It follows the pilgrim's way:
 * the statue plaza → the Digvijay Dwar → the walkway between its rails → the inner court's torana gate → the
 * jagati steps → the mukha, nritya and sabha mandapas → the passage to the garbhagriha; plus the Ganesha
 * devkulika by the approach, the round of the jagati, the sabha mandapa's side porches out to the lawns, the
 * Baan Stambh on the sea wall and the seaside promenade. Check with `node scripts/navcheck.mjs somnath`.
 */
export function somnathNav(): { nav: NavGraph; places: Place[] } {
  const J = JAGATI, F = FLOOR;
  const nodes: Record<string, V> = {
    // the statue plaza outside the gate and the Digvijay Dwar
    statue: [STATUE.x + 6.5, 0, STATUE.z + 5],
    'statue-w': [STATUE.x + 6.5, 0, STATUE.z - 8],
    spawn: [2, 0, 136],
    'dwar-out': [DWAR.x, 0, 122],
    dwar: [DWAR.x, 0, 102],
    // the Ganesha devkulika north of the walkway
    'dwar-n': [10, 0, 102],
    ganesh: [15.6, 0, 86],
    // the walkway and the court's torana gate
    'walk-e': [0, 0, 98],
    'court-gate': [0, 0, 66],
    court: [0, 0, 60.5],
    // the jagati's east steps, the mukha, nritya and sabha mandapas, the passage, the garbhagriha
    'jagati-e': [0, J, 55.2],
    temple: [3.2, J, 54.5],
    mukha: [0, F, 51],
    nritya: [0, F, 40.5],
    sabha: [0, F, 22.5],
    passage: [0, F, 10],
    darshan: [0, F, 2.6],
    garbhagriha: [2.9, F, 3.3],
    // the sabha mandapa's north and south porches, down to the jagati and the court's side gates
    'porch-n': [13, F, 22.5],
    'jag-n': [16.2, J, 22.5],
    'court-n': [21.5, 0, 22.5],
    'gate-n': [27, 0, 22.5],
    'porch-s': [-13, F, 22.5],
    'jag-s': [-16.2, J, 22.5],
    'court-s': [-21.5, 0, 22.5],
    'gate-s': [-27, 0, 22.5],
    // the round of the jagati
    'jag-ne': [15.6, J, 54.5],
    'jag-n-e': [16.1, J, 27.5],
    'jag-n-w': [16.1, J, 17.5],
    'jag-nw': [15.6, J, -12.2],
    'jag-w': [0, J, -12.2],
    'jag-sw': [-15.6, J, -12.2],
    'jag-s-w': [-16.1, J, 17.5],
    'jag-s-e': [-16.1, J, 27.5],
    'jag-se': [-15.6, J, 54.5],
    // outside the court: round its south-west corner to the promenade, and out to the Baan Stambh
    'lawn-sw': [-30, 0, -26],
    sea: [-6, 0, -45],
    baan: [BAAN.x + 5.4, 0, BAAN.z + 1.5],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('statue', 'statue-w', 'spawn', 'dwar-out', 'dwar', 'walk-e', 'court-gate', 'court', 'jagati-e', 'mukha', 'nritya', 'sabha', 'passage', 'darshan', 'garbhagriha'),
    ['jagati-e', 'temple'],
    ...chain('dwar', 'dwar-n', 'ganesh'),
    ...chain('sabha', 'porch-n', 'jag-n', 'court-n', 'gate-n'),
    ...chain('sabha', 'porch-s', 'jag-s', 'court-s', 'gate-s'),
    ...chain('temple', 'jag-ne', 'jag-n-e', 'jag-n', 'jag-n-w', 'jag-nw', 'jag-w', 'jag-sw', 'jag-s-w', 'jag-s', 'jag-s-e', 'jag-se', 'jagati-e'),
    ...chain('gate-s', 'lawn-sw', 'sea'),
    ['gate-s', 'baan'],
  ];
  const places: Place[] = [
    { id: 'patel', node: 'statue', label: { hi: 'सरदार पटेल प्रतिमा', en: 'Sardar Patel statue' }, look: [STATUE.x, 6, STATUE.z] },
    { id: 'dwar', node: 'dwar', label: { hi: 'श्री दिग्विजय द्वार', en: 'Digvijay Dwar' }, look: [0, 10, 40] },
    { id: 'ganesh', node: 'ganesh', label: { hi: 'गणेश देवकुलिका', en: 'Ganesha shrine by the walkway' }, look: [19, 1.6, 86] },
    { id: 'court', node: 'court', label: { hi: 'मंदिर प्रांगण · तोरण द्वार', en: 'Temple court · torana gate' }, look: [0, 14, 20] },
    { id: 'mukha', node: 'mukha', label: { hi: 'मुख मंडप', en: 'Mukha Mandap (entrance porch)' }, look: [0, F + 1.6, 30] },
    { id: 'nritya', node: 'nritya', label: { hi: 'नृत्य मंडप', en: 'Nritya Mandap' }, look: [0, F + 3, 25] },
    { id: 'sabha', node: 'sabha', label: { hi: 'सभा मंडप', en: 'Sabha Mandap' }, look: [0, F + 1.4, 0] },
    { id: 'darshan', node: 'darshan', label: { hi: 'गर्भगृह · सोमनाथ दर्शन', en: 'Garbhagriha · darshan of Somnath' }, look: [0, F + 0.9, 0] },
    { id: 'porch-n', node: 'porch-n', label: { hi: 'उत्तरी मुख मंडप', en: 'North porch' }, look: [30, 2, 22] },
    { id: 'parikrama', node: 'jag-w', label: { hi: 'जगती परिक्रमा · शिखर के पीछे', en: 'Jagati parikrama · behind the shikhara' }, look: [0, 30, 0] },
    { id: 'baan', node: 'baan', label: { hi: 'बाण स्तंभ', en: 'Baan Stambh' }, look: [BAAN.x, 3, BAAN.z] },
    { id: 'sea', node: 'sea', label: { hi: 'समुद्र तट सैरगाह', en: 'Sea-wall promenade' }, look: [-40, 0, -80] },
  ];
  return { nav: { nodes, edges }, places };
}

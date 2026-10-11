import type { NavEdge, NavGraph, Place } from '../types';
import { SPAWN, WALL, SHRINE, NANDI_M } from './layout';
import { BHRAM } from './bhramaramba';
import { GUNDAM } from './court';

type V = [number, number, number];

/**
 * Mallikarjuna's walking graph for Places (engine/travel.ts). +x east (the Rajagopuram, the temple street),
 * −z north (Shivaji Gopuram), origin = the Jyotirlinga; court level y 0, the cloister walks 0.45, the Nandi
 * mandapa 0.75, the Mallikarjuna mandapa / antarala / garbhagriha 0.9, the Bhramaramba terrace 2.4 and her
 * mandapa 3.0. From the street through the Rajagopuram and the queue lane between the railings to the Nandi
 * mandapa, round it to the mukha mandapa steps, down the axis to the antarala door (darshan) and into the
 * garbhagriha; the inner court's west passage to Vriddha Mallikarjuna and the great flight up to Bhramaramba
 * (and on to the West Gopuram); the south passage to the Mallika Gundam, the Sahasra-linga shrine and the South
 * Gopuram; the north passage to the Pandava lingas and the Shivaji Gopuram. The east lane passes between the
 * railings, so the Nandi is reached from the court side. No gates to open. Every edge is walk-checked with
 * `node scripts/navcheck.mjs mallikarjuna`.
 */
export function mallikarjunaNav(): { nav: NavGraph; places: Place[] } {
  const F = SHRINE.plinth, NP = NANDI_M.plinth, T = 2.4, BF = T + BHRAM.plinth, CF = 0.45;
  const nodes: Record<string, V> = {
    // the temple street, the Rajagopuram, the queue lane between the railings
    spawn: [SPAWN.x, 0, SPAWN.z],
    'gate-out': [76, 0, 0.5],
    gopuram: [WALL.x1, 0, 0],
    'lane-e': [57, 0, 0],
    'lane-w': [44.5, 0, 0],
    // the inner court east of the Nandi mandapa, the south-east prakara
    'court-e': [44.5, 0, 8.6],
    court: [42, 0, 9.4],
    'prakara-w': [46.6, 0, 17.2],
    prakara: [55, 0, 18.6],
    'court-ne': [44.5, 0, -8.6],
    // round the Nandi mandapa's south side; its west steps; the mukha mandapa's east steps
    'nandi-s': [34.4, 0, 7.6],
    'court-s': [24, 0, 9.2],
    'nandi-step-w': [27.4, 0, 1.7],
    'nandi-w': [29.6, NP, 0],
    'mandapa-foot': [23.9, 0, 1.8],
    'mandapa-door': [21.5, F, 0.4],
    'mandapa-axis': [18.1, F, 0],
    mandapa: [17.5, F, 3.0],
    antarala: [8, F, 0],
    darshan: [3, F, 0],
    'sanctum-door': [1.9, F, 0],
    sanctum: [1.2, F, 0.5],
    // the court's west passage, Vriddha Mallikarjuna, the flight up to the Bhramaramba terrace
    'court-sw': [-14.8, 0, 6.6],
    'cloister-w': [-18.5, CF, 1.2],
    'court-w': [-26, 0, 1.2],
    'vriddha-s': [-37, 0, 2],
    vriddha: [-38.3, 0, 6],
    'stair-foot': [-51.1, 0, 2],
    'stair-head': [-61, T, 1.5],
    terrace: [-63.5, T, 4.6],
    'devi-step': [-66.3, T, 1.1],
    'devi-mandapa': [-68.4, BF, 0],
    devi: [-78, BF, 0],
    'terrace-nw': [-64.6, T, -12],
    'gopuram-w': [-88.5, T, -16],
    // the court's south passage, the Mallika Gundam, the Sahasra-linga shrine, the South Gopuram
    'cloister-s-in': [12, CF, 18.8],
    'cloister-s-out': [12, 0, 25.6],
    'court-s2': [-29, 0, 28.6],
    gundam: [GUNDAM.x, 0, 38.9],
    'gundam-e': [-34.8, 0, 38.6],
    'sahasra-e': [-35, 0, 57.4],
    sahasra: [-40, 0, 62],
    'gopuram-s': [-34, 0, 82],
    // the court's north passage, the Pandava lingas, the Shivaji Gopuram
    'court-n': [24, 0, -9.2],
    'cloister-n-in': [12, CF, -18.8],
    'cloister-n-out': [12, 0, -25.6],
    pandava: [-21, 0, -41],
    'shivaji-in': [7, 0, -99],
    shivaji: [6, 0, -106],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'gate-out', 'gopuram', 'lane-e', 'lane-w', 'court-e', 'court', 'prakara-w', 'prakara'),
    ...chain('court', 'nandi-s', 'court-s', 'nandi-step-w', 'nandi-w'),
    ['nandi-step-w', 'mandapa-foot'], ['court-s', 'mandapa-foot'],
    ...chain('mandapa-foot', 'mandapa-door', 'mandapa-axis', 'antarala', 'darshan', 'sanctum-door', 'sanctum'),
    ['mandapa-axis', 'mandapa'],
    ...chain('court-s', 'court-sw', 'cloister-w', 'court-w', 'vriddha-s', 'stair-foot', 'stair-head', 'devi-step', 'devi-mandapa', 'devi'),
    ['vriddha-s', 'vriddha'], ['stair-head', 'terrace'],
    ...chain('stair-head', 'terrace-nw', 'gopuram-w'),
    ...chain('court-s', 'cloister-s-in', 'cloister-s-out', 'court-s2', 'gundam'),
    ...chain('court-s2', 'gundam-e', 'sahasra-e', 'sahasra', 'gopuram-s'),
    ['gundam', 'gundam-e'],
    ...chain('lane-w', 'court-ne', 'court-n', 'cloister-n-in', 'cloister-n-out', 'shivaji-in', 'shivaji'),
    ['cloister-n-out', 'pandava'],
  ];
  const places: Place[] = [
    { id: 'approach', node: 'spawn', label: { hi: 'मंदिर वीथि · राजगोपुरम्', en: 'Temple street · the Rajagopuram' }, look: [WALL.x1, 15, 0] },
    { id: 'gopuram', node: 'gopuram', label: { hi: 'राजगोपुरम् · पूर्व द्वार', en: 'Rajagopuram · the east gate' }, look: [34, 3, 0] },
    { id: 'prakara', node: 'prakara', label: { hi: 'प्राकार भित्ति', en: 'The carved prakara walls' }, look: [64, 3.5, 24] },
    { id: 'court', node: 'court', label: { hi: 'मंदिर प्रांगण', en: 'The temple court' }, look: [4, 10, 0] },
    { id: 'nandi', node: 'nandi-w', label: { hi: 'नंदी मंडप', en: 'Nandi Mandapa' }, look: [33.4, NP + 1.8, 0] },
    { id: 'mandapa', node: 'mandapa', label: { hi: 'मुख मंडप', en: 'Mukha Mandapa' }, look: [10, F + 2, 1.5] },
    { id: 'darshan', node: 'darshan', label: { hi: 'अंतराल · दर्शन', en: 'Antarala · darshan' }, look: [0, F + 0.6, 0] },
    { id: 'garbhagriha', node: 'sanctum', label: { hi: 'गर्भगृह · स्पर्श दर्शन', en: 'Garbhagriha · sparsha darshan' }, look: [0, F + 0.4, 0] },
    { id: 'vriddha', node: 'vriddha', label: { hi: 'वृद्ध मल्लिकार्जुन', en: 'Vriddha Mallikarjuna' }, look: [-42, 1, 6] },
    { id: 'bhramaramba', node: 'devi', label: { hi: 'श्री भ्रमराम्बा देवी', en: 'Shri Bhramaramba Devi' }, look: [BHRAM.x, BF + 0.9, 0] },
    { id: 'gundam', node: 'gundam', label: { hi: 'मल्लिका गुंडम', en: 'Mallika Gundam' }, look: [GUNDAM.x, -1, GUNDAM.z] },
    { id: 'sahasra', node: 'sahasra', label: { hi: 'सहस्र लिंग', en: 'Sahasra Linga shrine' }, look: [-44, 1.2, 62] },
    { id: 'pandava', node: 'pandava', label: { hi: 'पंच पांडव लिंग', en: 'The five Pandava lingas' }, look: [-38, 1, -44] },
    { id: 'shivaji', node: 'shivaji', label: { hi: 'शिवाजी गोपुरम्', en: 'Shivaji Gopuram' }, look: [6, 4, -125] },
  ];
  return { nav: { nodes, edges }, places };
}

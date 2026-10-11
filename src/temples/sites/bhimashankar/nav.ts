import type { NavEdge, NavGraph, Place } from '../types';
import { STAIR, STAIR_TOP_X, STAIR_TOP_Y, F, GARBHA, HALL, MOKSHA, KUSHA, BELL, SHANI, DEEPMAL, KAMALAJA, RIM, stairY } from './layout';

type V = [number, number, number];

/**
 * Bhimashankar's walking graph for Places (engine/travel.ts). +x north, +z east; the courtyard floor y 0 at the
 * temple's centre, the mandapa 0.6, the sanctum −0.3, the village ~29.7 m up at the head of the stairway, the east
 * lane (Kamalaja) 2.6. The way in: the village plaza → the long stairway down into the courtyard's north-west
 * corner → round the back of the temple past Mokshakund and Kusharanya → Chimaji Appa's bell → up the mandapa's
 * east steps → past Nandi → the five steps down to the sanctum door. Off it: the Deepmal, and the east gate's
 * steps up to the lane and Kamalaja Devi. (Mokshakund is walled and its steps gated: seen from the rim.)
 * Every edge is walk-checked with `node scripts/navcheck.mjs bhimashankar`.
 */
export function bhimashankarNav(): { nav: NavGraph; places: Place[] } {
  const zm = (STAIR.z0 + STAIR.z1) / 2;
  const nodes: Record<string, V> = {
    // the village plaza and the stairway
    spawn: [STAIR_TOP_X + 18, STAIR_TOP_Y, zm - 0.6],
    village: [126, STAIR_TOP_Y, zm],
    'stair-top': [STAIR_TOP_X + 1.5, STAIR_TOP_Y, zm],
    stairs: [103.8, stairY(103.8), zm],
    'stair-mid': [61.6, stairY(61.6), zm],
    'stair-foot': [14.5, 0, zm],
    // round the back (west) of the temple: Mokshakund's east rim, Kusharanya, along the south side to the bell
    mokshakund: [-3.5, 0, -19.5],
    'moksha-s': [-3.5, 0, -15],
    kusharanya: [-10, 0, -9.2],
    'court-s': [-9, 0, 12.3],
    bell: [BELL.x + 1.8, 0, BELL.z - 1.5],
    shani: [SHANI.x + 1.4, 0, SHANI.z - 2.3],
    // the mandapa: the east steps, the hall, past Nandi, the antarala's five steps down to the sanctum door
    'court-e': [-4.1, 0, 13.5],
    'court-e2': [-1.6, 0, 13.5],
    'hall-steps': [-0.9, 0, 13],
    mandapa: [0, F, 7],
    'hall-1': [2, F, 5.9],
    'hall-2': [2.5, F, 4.9],
    'hall-3': [2.5, F, -1.1],
    antarala: [0, F, -4.1],
    garbhagriha: [0, GARBHA.floor, -6.6],
    // the east court, the Deepmal, the east gate and its steps up to the lane, Kamalaja Devi
    deepmal: [DEEPMAL.x - 3.2, 0, DEEPMAL.z + 2.4],
    gate: [-1.6, 0, 22],
    'gate-top': [1.9, RIM.e, 28.5],
    kamalaja: [KAMALAJA.x, RIM.e, KAMALAJA.z],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'village', 'stair-top', 'stairs', 'stair-mid', 'stair-foot', 'mokshakund', 'moksha-s', 'kusharanya', 'court-s', 'bell', 'court-e', 'court-e2', 'hall-steps', 'mandapa', 'hall-1', 'hall-2', 'hall-3', 'antarala', 'garbhagriha'),
    ['bell', 'shani'],
    ['bell', 'gate'], ['court-e2', 'deepmal'], ['gate', 'deepmal'],
    ...chain('gate', 'gate-top', 'kamalaja'),
  ];
  const look = (x: number, y: number, z: number): V => [x, y, z];
  const places: Place[] = [
    { id: 'village', node: 'village', label: { hi: 'भीमाशंकर गाव · पायरी मार्गाचे प्रवेशद्वार', en: 'Bhimashankar village · head of the stairway' }, look: look(STAIR_TOP_X - 4, STAIR_TOP_Y + 3.2, zm) },
    { id: 'stairs', node: 'stairs', label: { hi: 'पायरी मार्ग', en: 'The stairway' }, look: look(0, 8, -6) },
    { id: 'mokshakund', node: 'mokshakund', label: { hi: 'मोक्षकुंड', en: 'Mokshakund' }, look: look((MOKSHA.x0 + MOKSHA.x1) / 2, -1.6, (MOKSHA.z0 + MOKSHA.z1) / 2) },
    { id: 'kusharanya', node: 'kusharanya', label: { hi: 'कुशारण्य तीर्थ · भीमा उगम', en: 'Kusharanya Tirtha · source of the Bhima' }, look: look(KUSHA.x, -0.5, KUSHA.z) },
    { id: 'bell', node: 'bell', label: { hi: 'चिमाजी अप्पांची घंटा', en: "Chimaji Appa's bell" }, look: look(BELL.x, 1.6, BELL.z) },
    { id: 'shani', node: 'shani', label: { hi: 'शनि मंदिर', en: 'Shani shrine' }, look: look(SHANI.x, 1, SHANI.z) },
    { id: 'mandapa', node: 'mandapa', label: { hi: 'सभामंडप · नंदी', en: 'Sabha Mandapa · Nandi' }, look: look(0, F + 0.9, HALL.zc) },
    { id: 'garbhagriha', node: 'garbhagriha', label: { hi: 'गाभारा · श्री भीमाशंकर दर्शन', en: 'Garbhagriha · darshan of Bhimashankar' }, look: look(-0.32, GARBHA.floor + 0.1, -8.75) },
    { id: 'deepmal', node: 'deepmal', label: { hi: 'दीपमाळ', en: 'Deepmal' }, look: look(DEEPMAL.x, 4, DEEPMAL.z) },
    { id: 'kamalaja', node: 'kamalaja', label: { hi: 'कमलजा देवी', en: 'Kamalaja Devi' }, look: look(KAMALAJA.x, RIM.e + 1.2, KAMALAJA.z + 3.5) },
  ];
  return { nav: { nodes, edges }, places };
}

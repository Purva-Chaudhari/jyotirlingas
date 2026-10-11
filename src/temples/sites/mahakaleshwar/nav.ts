import type { NavEdge, NavGraph, Place } from '../types';
import { SANCTUM } from './temple';
import { GM, FRONT } from './mode';
import { SPAWN, T, PH, EX } from './darshan';
import { OMK, CORE, NAG, STAIR_UP as U } from './upper';
import { CORRIDOR, LAKE_LINK, KAMAL_KUND } from './mahakallok';

type V = [number, number, number];

/**
 * Mahakaleshwar's walking graph for Places (engine/travel.ts), general darshan mode (+x east, +z south, the
 * temple at the origin, court level y 0, the hall's plinth 0.9, the Ganesh Mandapam −3..−2.55, the
 * garbhagriha −3, the Nagchandreshwar storey 9.55). It follows the real darshan route: the Mahakal Lok road →
 * north gate → queue lanes → Tunnel-1 → Ganesh Mandapam → Palki Hall → exit court, plus the front court and
 * the hall (Omkareshwar, the Nag stair), the front stair down through the gate (opened on the way), the
 * kund, and the lakefront path to Shri Mahakal Lok and Kamal Kund (Harsiddhi, across the town, has no walkable
 * way to it in the model: it is seen, not visited). Every edge is walk-checked with
 * `node scripts/navcheck.mjs mahakaleshwar`.
 */
export function mahakalNav(openFrontGate: () => void): { nav: NavGraph; places: Place[] } {
  const B = FRONT.BOT, H = 0.9, G = GM.FLOOR;
  const omkX = (CORE.X0 + CORE.X1) / 2;
  const nodes: Record<string, V> = {
    // Shri Mahakal Lok road, north of the precinct, and the north gate
    spawn: SPAWN.feet,
    road: [-2, 0, -58],
    'road-w1': [-26, 0, -58],
    'road-w2': [-77, 0, -57],
    'road-w3': [-108, 0, -58],
    'road-w4': [-136, 0, -59],
    gate: [-2, 0, -46],
    'gate-in': [-2, 0, -39],
    // the queue lanes (darshan.ts ROUTE) and Mahakal Tunnel-1
    queue: [1.0, 0, -38.4],
    q1: [6, 0, -38],
    q2: [6, 0, -33.6],
    q3: [-10, 0, -33.6],
    q4: [-10, 0, -29.2],
    q5: [6, 0, -29.2],
    q6: [6, 0, -24.8],
    q7: [-10, 0, -24.8],
    q8: [-9.6, 0, -22.4],
    'tunnel-top': [-9, 0, -21],
    'tunnel-bot': [-9, T.FLOOR, -6.5],
    tunnel: [-9, T.FLOOR, 4],
    'tunnel-end': [-9, -2.55, 11.6],
    // the Ganesh Mandapam: back aisle, west aisle, front row, the darshan platform
    'gm-back': [-6, -2.55, 11.6],
    'gm-west': [-6, G, 2.5],
    'row-w': [-2.6, G, 2.5],
    'plat-w': [-2.6, B, 1.0],
    darshan: [0, B, 1.0],
    'plat-e': [2.6, B, 1.0],
    'row-e': [2.6, G, 2.5],
    'gm-east': [6, G, 2.5],
    // the platform's open gate, the Nandi hall and the garbhagriha
    'plat-gate': [-0.9, B, 0.45],
    nandi: [-0.9, G, -0.8],
    'nandi-n': [-0.9, G, -1.95],
    'sanctum-door': [0, G, -2.7],
    sanctum: [1.8, SANCTUM.FLOOR, -3.35],
    // the Palki Hall and the exit ramp up to the front court
    'palki-in': [6, -2.55, 13.8],
    palki: [4.5, PH.Y, 14.8],
    'exit-foot': [(EX.X0 + EX.X1) / 2, PH.Y, 16.5],
    'exit-top': [(EX.X0 + EX.X1) / 2, 0, 28],
    'exit-court': [(EX.X0 + EX.X1) / 2, 0, 31],
    // the front court, the steps up to the hall, the hall's front aisle, the front stair (through the gate)
    'court-front': [0, 0, 13],
    'court-s': [1, 0, 27.5],
    'hall-step': [0, H, 9.6],
    hall: [0, H, 7.6],
    'stair-head': [0, H, FRONT.HEAD - 0.1],
    'stair-foot': [0, B, FRONT.FOOT],
    // the hall's aisles: east to Omkareshwar, west to the Nag stair
    'hall-e': [5.8, H, 7.6],
    'aisle-e': [5.8, H, 2.7],
    'omk-door': [omkX, H, 2.7],
    'omk-pass': [omkX, H, -1.0],
    omkareshwar: [1.3, OMK.Y, -2.4],
    'hall-w': [-5.8, H, 7.6],
    'nag-foot': [-5.8, H, 1.4],
    // (the landing's turn kept to its north half, clear of the end of the rail between the flights)
    'nag-land-a': [(U.A0 + U.A1) / 2, U.MID, U.LAND1 + 0.4],
    'nag-land-b': [(U.B0 + U.B1) / 2, U.MID, U.LAND1 + 0.4],
    'nag-top': [(U.B0 + U.B1) / 2, NAG.Y, 1.15],
    'terrace-w': [-6.25, NAG.Y, 1.3],
    'terrace-w2': [-5.9, NAG.Y, 3.3],
    'terrace-sw': [-4.7, NAG.Y, 4.6],
    'nag-door': [0, NAG.Y, 5.0],
    'nag-in': [0, NAG.Y, 2.4],
    nagchandreshwar: [0.9, NAG.Y, 1.2],
    // outside, round the temple's east side: the north gate to the front court without the queue
    // (past the south end of the queue barricade, through its gap, then up the open east side)
    'east-q0': [4, 0, -38.5],
    'east-q': [6.4, 0, -38.6],
    'east-gate0': [6.5, 0, -39.7],
    'east-gate': [8, 0, -39.7],
    'east-n0': [8, 0, -38.75],
    'east-n': [8.5, 0, -38.5],
    'east-m': [8, 0, 0.5],
    'east-s': [8, 0, 11.5],
    // (along the clear lane south of the front court's rail)
    'east-f0': [4.5, 0, 16.2],
    'east-f': [2.5, 0, 16.2],
    'east-x': [7.5, 0, 26],
    'east-x2': [5.5, 0, 28],
    'east-x3': [1.5, 0, 28],
    // round the temple's west side to the Kotitirtha kund
    'court-w1': [-8.5, 0, 10.3],
    'court-w': [-24.5, 0, 8.2],
    kund: [-34, 0, -1.4],
    // the lakefront path (Rudra Sagar) and Shri Mahakal Lok down to Kamal Kund
    ...Object.fromEntries(LAKE_LINK.slice(1).map(([x, z], i) => [`lake${i + 1}`, [x, 0, z] as V])),
    ...Object.fromEntries(CORRIDOR.slice(1).map(([x, z], i) => [`lok${i + 1}`, [x, 0, z] as V])),
    'kamal-kund': [KAMAL_KUND.x + 6, 0, KAMAL_KUND.z - KAMAL_KUND.r - 4],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'road', 'road-w1', 'road-w2', 'road-w3', 'road-w4', 'lake1', 'lake2', 'lake3', 'lake4', 'lake5'),
    ['lake5', 'lok1'],
    ...chain('lok1', 'lok2', 'lok3', 'lok4', 'lok5', 'lok6', 'lok7', 'lok8', 'lok9', 'kamal-kund'),
    ['spawn', 'gate'], ['road', 'gate'],
    ...chain('gate', 'gate-in', 'queue', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'tunnel-top', 'tunnel-bot', 'tunnel', 'tunnel-end', 'gm-back', 'gm-west', 'row-w', 'plat-w', 'darshan', 'plat-e', 'row-e', 'gm-east', 'palki-in', 'palki', 'exit-foot', 'exit-top', 'exit-court'),
    ['darshan', 'plat-gate'],
    ...chain('plat-gate', 'nandi', 'nandi-n', 'sanctum-door', 'sanctum'),
    ['darshan', 'stair-foot'], ['stair-foot', 'stair-head'],
    // the front doorway's barricade gate: opened on the way through (the site's portal)
    ['stair-head', 'hall', { before: openFrontGate }],
    ...chain('exit-court', 'court-s', 'court-front', 'hall-step', 'hall'),
    ...chain('hall', 'hall-e', 'aisle-e', 'omk-door', 'omk-pass', 'omkareshwar'),
    ...chain('hall', 'hall-w', 'nag-foot', 'nag-land-a', 'nag-land-b', 'nag-top', 'terrace-w', 'terrace-w2', 'terrace-sw', 'nag-door', 'nag-in', 'nagchandreshwar'),
    ...chain('hall-step', 'court-w1', 'court-w', 'kund'),
    ...chain('gate-in', 'east-q0', 'east-q', 'east-gate0', 'east-gate', 'east-n0', 'east-n', 'east-m', 'east-s', 'east-f0', 'east-f', 'court-front'),
    ...chain('east-s', 'east-x', 'east-x2', 'east-x3', 'court-s'),
  ];
  const look = (x: number, y: number, z: number): V => [x, y, z];
  const places: Place[] = [
    { id: 'approach', node: 'spawn', label: { hi: 'महाकाल लोक मार्ग · उत्तर द्वार', en: 'Mahakal Lok road · the north gate' }, look: SPAWN.look },
    { id: 'queue', node: 'queue', label: { hi: 'दर्शन कतार', en: 'Darshan queue' }, look: look(6.2, 1.5, -32.5) },
    { id: 'tunnel', node: 'tunnel', label: { hi: 'महाकाल टनल', en: 'Mahakal Tunnel' }, look: look(-9, T.FLOOR + 1.4, 12) },
    { id: 'darshan', node: 'darshan', label: { hi: 'गणेश मंडपम · दर्शन', en: 'Ganesh Mandapam · darshan' }, look: look(0, SANCTUM.FLOOR + 0.95, SANCTUM.Z) },
    { id: 'nandi', node: 'nandi-n', label: { hi: 'नंदी मंडप', en: 'Nandi Hall' }, look: look(0, SANCTUM.FLOOR + 0.9, SANCTUM.Z) },
    { id: 'garbhagriha', node: 'sanctum', label: { hi: 'गर्भगृह · महाकाल दर्शन', en: 'Garbhagriha · darshan of Mahakal' }, look: look(0, SANCTUM.FLOOR + 0.9, SANCTUM.Z) },
    { id: 'palki', node: 'palki', label: { hi: 'पालकी हॉल', en: 'Palki Hall' }, look: look(0.9, PH.Y + 1.2, 15.2) },
    { id: 'temple', node: 'court-front', label: { hi: 'मंदिर का प्रांगण · मुख्य द्वार', en: 'Temple forecourt · front entrance' }, look: look(0, 9, 0) },
    { id: 'omkareshwar', node: 'omkareshwar', label: { hi: 'श्री ओंकारेश्वर महादेव', en: 'Shri Omkareshwar Mahadev' }, look: look(0, OMK.Y + 0.7, OMK.LZ) },
    { id: 'nagchandreshwar', node: 'nagchandreshwar', label: { hi: 'श्री नागचंद्रेश्वर', en: 'Shri Nagchandreshwar' }, look: look(0, NAG.Y + 1.2, NAG.Z0) },
    { id: 'kund', node: 'kund', label: { hi: 'कोटितीर्थ कुंड', en: 'Kotitirtha Kund' }, look: look(-34, -2.2, -14) },
    { id: 'lakefront', node: 'lake3', label: { hi: 'रुद्र सागर तट', en: 'Rudra Sagar lakefront' }, look: look(-160, 0, 1) },
    { id: 'mahakal-lok', node: 'lok3', label: { hi: 'श्री महाकाल लोक', en: 'Shri Mahakal Lok corridor' }, look: look(-28, 3, 204) },
    { id: 'kamal-kund', node: 'kamal-kund', label: { hi: 'कमल कुंड', en: 'Kamal Kund' }, look: look(KAMAL_KUND.x, 3, KAMAL_KUND.z) },
  ];
  return { nav: { nodes, edges }, places };
}

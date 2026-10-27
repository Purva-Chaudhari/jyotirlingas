import type { NavEdge, NavGraph, Place } from '../types';
import { GARBHA, LINGA, JHOOLA, F1, WATER_Y, MAMLESHWAR } from './layout';

type V = [number, number, number];

/**
 * Omkareshwar's walking graph for Places (engine/travel.ts). +z south (the Narmada), +x east (upstream); the
 * mandapa floor y 0, the -4 galleries and lane, the Koti Tirth ghat -12, the garbhagriha -0.45, the first
 * storey 4.9. It follows the pilgrim's way: the Jhoola pul → the lane along the cliff → the -4 galleries → the
 * grand stair's landing → up to the forecourt → the central queue aisle of the sixty-pillar hall → past Nandi →
 * down into the garbhagriha; and the ways off it: the grand stair down to the ghat (and the lane's stair to the
 * ghat's east end), the river steps, the hall's west aisle and the stair to the first storey (Mahakaleshwar).
 * Mamleshwar, across the river, has no walkable bank in the model: it is seen from the bridge, not visited.
 * Every edge is walk-checked with `node scripts/navcheck.mjs omkareshwar`.
 */
export function omkareshwarNav(): { nav: NavGraph; places: Place[] } {
  const nodes: Record<string, V> = {
    // the Jhoola pul (spawn on its deck, looking at the island) and the lane along the cliff
    spawn: [JHOOLA.x - 0.3, JHOOLA.y, 73.5],
    'bridge-mid': [JHOOLA.x, JHOOLA.y, 120],
    jhoola: [JHOOLA.x, JHOOLA.y, 66],
    'bridge-foot': [JHOOLA.x - 0.2, -4, 22.5],
    'lane-e': [112, -4, 20.5],
    'lane-stair': [49.4, -4, 20.6],
    'darshan-marg': [34, -4, 20.5],
    // the lane's stair down east to the ghat's end, and the ghat along the galleries' foot
    'gstair-top': [49.4, -4, 22.6],
    'gstair-foot': [63.2, -12, 22.6],
    'ghat-e': [62.5, -12, 25],
    'ghat-m': [4.5, -12, 24.9],
    'ghat-m2': [3, -12, 26],
    ghat: [0, -12, 27.5],
    narmada: [0, -14.1, 34],
    // the -4 galleries to the grand stair's landing; flight A down to the ghat, flight B up to the forecourt
    'gal-e': [11.5, -4, 19.5],
    'gal-land': [3.2, -4, 11.2],
    landing: [0, -4, 10.8],
    'stair-a-foot': [0, -12, 25.8],
    court: [0, 0, 2.8],
    // the sixty-pillar hall: the central queue aisle, past Nandi to the garbhagriha door
    temple: [0, 0, 1],
    'aisle-s': [0, 0, -5.6],
    nandi: [4.9, 0, -5.6],
    'queue-e': [7.9, 0, -5.6],
    door: [8.2, 0, GARBHA.doorZ],
    darshan: [10.95, GARBHA.floor, -6.9], // at the silver rail, where the stone shows over it
    garbhagriha: [9.7, GARBHA.floor, -5.3],
    // the hall's west bay, its middle, and the stair along the west wall to the first storey
    'court-w': [-2.6, 0, 2.8],
    'hall-w': [-2.6, 0, -0.5],
    'hall-w2': [-5.0, 0, -0.5],
    'hall-mid': [-5.0, 0, -5.7],
    'up-foot': [-12.2, 0.28, -0.45],
    'up-head': [-12.2, F1, -8.8],
    'up-w': [-8.2, F1, -8],
    upper: [0, F1, -8],
    'upper-shrine': [0, F1, -10.4],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('bridge-mid', 'spawn', 'jhoola', 'bridge-foot', 'lane-e', 'lane-stair', 'darshan-marg', 'gal-e', 'gal-land', 'landing', 'court', 'temple', 'aisle-s', 'nandi', 'queue-e', 'door', 'darshan', 'garbhagriha'),
    ...chain('lane-stair', 'gstair-top', 'gstair-foot', 'ghat-e', 'ghat-m', 'ghat-m2', 'ghat', 'narmada'),
    ['landing', 'stair-a-foot'], ['stair-a-foot', 'ghat'],
    ...chain('court', 'court-w', 'hall-w', 'hall-w2', 'hall-mid'),
    ...chain('hall-w2', 'up-foot', 'up-head', 'up-w', 'upper', 'upper-shrine'),
  ];
  const look = (x: number, y: number, z: number): V => [x, y, z];
  const places: Place[] = [
    { id: 'jhoola', node: 'jhoola', label: { hi: 'झूला पुल', en: 'Jhoola Pul' }, look: look(-6, 6, 8) },
    { id: 'mid-river', node: 'bridge-mid', label: { hi: 'झूला पुल · नर्मदा के बीच, ममलेश्वर की ओर', en: 'Mid-river on the Jhoola Pul · towards Mamleshwar' }, look: look(MAMLESHWAR.x, 4, MAMLESHWAR.z) },
    { id: 'darshan-marg', node: 'darshan-marg', label: { hi: 'दर्शन मार्ग', en: 'Darshan Marg galleries' }, look: look(0, -2, 14) },
    { id: 'ghat', node: 'ghat', label: { hi: 'कोटितीर्थ घाट', en: 'Koti Tirth Ghat' }, look: look(0, -13, 45) },
    { id: 'narmada', node: 'narmada', label: { hi: 'माँ नर्मदा · स्नान की सीढ़ियाँ', en: 'Maa Narmada · the bathing steps' }, look: look(0, WATER_Y, 70) },
    { id: 'stair', node: 'landing', label: { hi: 'मुख्य सीढ़ी', en: 'The grand stair' }, look: look(0, 0, 0) },
    { id: 'temple', node: 'temple', label: { hi: 'श्री ओंकारेश्वर मंदिर · प्रांगण', en: 'Shri Omkareshwar Mandir · forecourt' }, look: look(0, 1.5, -10) },
    { id: 'sabha-mandap', node: 'hall-mid', label: { hi: 'साठ खंभों का सभा मंडप', en: 'The sixty-pillar sabha mandap' }, look: look(-5, 2, -14) },
    { id: 'nandi', node: 'nandi', label: { hi: 'नंदी', en: 'Nandi' }, look: look(5.0, 0.9, GARBHA.doorZ) },
    { id: 'darshan', node: 'darshan', label: { hi: 'गर्भगृह · ओंकारेश्वर ज्योतिर्लिंग दर्शन', en: 'Garbhagriha · darshan of the Jyotirlinga' }, look: look(LINGA.x, GARBHA.floor + 0.2, LINGA.z) },
    { id: 'upper', node: 'upper-shrine', label: { hi: 'ऊपरी मंज़िल · श्री महाकालेश्वर', en: 'Upper storey · Shri Mahakaleshwar' }, look: look(0, F1 + 0.6, -12) },
  ];
  return { nav: { nodes, edges }, places };
}

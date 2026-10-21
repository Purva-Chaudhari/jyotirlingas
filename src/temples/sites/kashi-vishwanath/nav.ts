import type { NavEdge, NavGraph, Place } from '../types';

type V = [number, number, number];

/**
 * Kashi Vishwanath's walking graph for Places (engine/travel.ts). +z east (the chowk, the Ganga), +x north
 * (Gyanvapi); origin = the linga; the Parisar at y 0, the jagati 0.6, the Gyanvapi mandap 0.45, the Dham's
 * stair down the axis (landings −3 and −6.6) to the Ganga Dwar plaza at −10 and Lalita Ghat's steps to the water
 * (−15.3). The way in: the Mandir Chowk → the Parisar's east gate → between the queue rails → the jagati → the
 * east door of the garbhagriha; round the court to the Gyanvapi mandap (Nandi and the well), the verandah and the
 * Sabha Mandap under the gold dome, the shrine under the stone spire, the restored shrines on the south side; and
 * east down the chowk and the stair to the Ganga Dwar and along the ghat's first landing either way. (The ghats
 * beyond the Dham's frontage — Manikarnika, Dashashwamedh — are seen, not walked: the model's walkable steps end
 * at |x| 136.) Checked with `node scripts/navcheck.mjs kashi-vishwanath`.
 */
export function kashiNav(): { nav: NavGraph; places: Place[] } {
  const J = 0.6, LAND = -12.17;
  const nodes: Record<string, V> = {
    // the Mandir Chowk and the Parisar's east gate
    spawn: [0, 0, 42],
    'gate-in': [2.5, 0, 23],
    parisar: [5, 0, 21],
    // between the queue rails to the jagati and the garbhagriha's east door
    lane: [2, 0, 7.4],
    'jagati-e': [0, J, 4.9],
    darshan: [0, J, 2.4],
    cell: [0.5, J, 1.35],
    garbhagriha: [1.35, J, 1.35],
    // the east verandah, the Sabha Mandap under the dome, the shrine under the stone spire
    'ver-e': [-2, J, 4.4],
    verandah: [-3, J, 4.4],
    'ver-m': [-6.15, J, 3.5],
    mandapa: [-6.65, J, 0],
    'ver-s': [-10, J, 4.4],
    'ss-door': [-12.8, J, 3.7],
    'ss-in': [-13.3, J, 3.2],
    'south-shrine': [-13.3, J, 1.2],
    // north across the court to the Gyanvapi mandap
    'court-ne': [7, 0, 19.4],
    'court-view': [14, 0, 16],
    gyanvapi: [17.6, 0.45, 3.4],
    // south across the court to the restored shrines and the south-west corner
    'court-e': [1.5, 0, 22],
    'court-se': [-4.5, 0, 22],
    'court-s': [-7, 0, 19],
    shrines: [-22, 0, 0],
    'court-sw': [-12, 0, -20],
    // the west gate (the Dhundhiraj route): its security outside, its lane across the west court, the jagati's
    // west steps and the garbhagriha's west door
    'w-out': [0, 0, -33.5],
    'w-gate': [0, 0, -23],
    'w-lane': [0, 0, -9.2],
    'jagati-w': [0, J, -5.2],
    'darshan-w': [0, J, -2.4],
    'cell-w': [0.5, J, -1.35],
    'corner-w': [1.35, J, -1.35],
    // Gate No. 4 (Sugam Darshan) on the lane by the Gyanvapi, the Parisar's north gate, the lane inside round the
    // Gyanvapi mandap, the jagati's north strip and the garbhagriha's north door
    'gate-4': [35.2, 0, 25.5],
    'g4-arch': [35.2, 0, 19],
    'g4-lane': [35.2, 0, 4.2],
    'n-gate': [29, 0, 2.2],
    'n-gate-in': [24.8, 0, 3.9],
    'vip-2': [24.8, 0, 7.0],
    'vip-3': [5.9, 0, 7.0],
    'jag-n-step': [4.4, J, 5.2],
    'jag-n': [4.4, J, 0.35],
    'door-n': [3.6, J, 0.0],
    'n-in': [1.4, J, 0.0],
    // down the chowk and the stair to the Ganga Dwar plaza and Lalita Ghat
    chowk: [0, 0, 84],
    'chowk-end': [0, 0, 99],
    'stair-1': [0, -3, 114],
    'stair-2': [0, -6.6, 131.5],
    ganga: [0, -10, 144],
    ghat: [3, -14.33, 166.5],
    // along the ghat's first landing, north (toward Manikarnika) and south (toward Dashashwamedh)
    'ghat-land': [3, LAND, 158],
    'ghat-n1': [22, LAND, 159],
    'ghat-n2': [62.5, -12.26, 159.5],
    'ghat-n3': [118.5, -12.26, 159.5],
    'ghat-n': [120, LAND, 158],
    'ghat-s1': [-21.5, -11.88, 156.5],
    'ghat-s2': [-118.5, -11.88, 156.5],
    'ghat-s': [-120, LAND, 158],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'gate-in', 'parisar', 'lane', 'jagati-e', 'darshan', 'cell', 'garbhagriha'),
    ...chain('jagati-e', 'ver-e', 'verandah', 'ver-m', 'mandapa'),
    ...chain('ver-m', 'ver-s', 'ss-door', 'ss-in', 'south-shrine'),
    ...chain('w-out', 'w-gate', 'w-lane', 'jagati-w', 'darshan-w', 'cell-w', 'corner-w', 'garbhagriha'),
    ...chain('gate-4', 'g4-arch', 'g4-lane', 'n-gate', 'n-gate-in', 'vip-2', 'vip-3', 'jag-n-step', 'jag-n', 'door-n', 'n-in', 'garbhagriha'),
    ...chain('parisar', 'court-ne', 'gyanvapi'),
    ['court-ne', 'court-view'],
    ...chain('gate-in', 'court-e', 'court-se', 'court-s', 'shrines', 'court-sw'),
    ...chain('spawn', 'chowk', 'chowk-end', 'stair-1', 'stair-2', 'ganga', 'ghat'),
    ...chain('ganga', 'ghat-land', 'ghat'),
    ...chain('ghat-land', 'ghat-n1', 'ghat-n2', 'ghat-n3', 'ghat-n'),
    ...chain('ghat-land', 'ghat-s1', 'ghat-s2', 'ghat-s'),
  ];
  const places: Place[] = [
    { id: 'east-gate', node: 'spawn', label: { hi: 'परिसर का पूर्वी द्वार', en: 'The Parisar\'s east gate' }, look: [0, 10, 0] },
    { id: 'parisar', node: 'parisar', label: { hi: 'मंदिर परिसर', en: 'Mandir Parisar' }, look: [0, 8, 0] },
    { id: 'garbhagriha', node: 'darshan', label: { hi: 'गर्भगृह · विश्वेश्वर दर्शन', en: 'Garbhagriha · darshan of Vishweshwara' }, look: [0, 0.5, 0] },
    { id: 'mandapa', node: 'mandapa', label: { hi: 'सभा मंडप', en: 'Sabha Mandap' }, look: [-6.65, 3.5, -2] },
    { id: 'verandah', node: 'verandah', label: { hi: 'मंदिर का बरामदा', en: 'The temple verandah' }, look: [-3, 2, 0] },
    { id: 'south-shrine', node: 'south-shrine', label: { hi: 'दक्षिणी शिवालय', en: 'Shrine under the stone spire' }, look: [-13.3, 0.9, 0] },
    { id: 'gyanvapi', node: 'gyanvapi', label: { hi: 'ज्ञानवापी · नंदी', en: 'Gyanvapi well · Nandi' }, look: [17.6, 1.2, 0] },
    { id: 'shrines', node: 'shrines', label: { hi: 'प्राचीन शिवालय', en: 'Restored shrines of the Parisar' }, look: [-25.5, 1.5, 0] },
    { id: 'gate-4', node: 'gate-4', label: { hi: 'गेट नं. 4 · सुगम दर्शन', en: 'Gate No. 4 · Sugam Darshan (VIP)' }, look: [35.2, 3.5, 17] },
    { id: 'mandir-chowk', node: 'chowk', label: { hi: 'मंदिर चौक · काशी विश्वनाथ धाम', en: 'Mandir Chowk · Kashi Vishwanath Dham' }, look: [0, 0, 140] },
    { id: 'ganga-dwar', node: 'ganga', label: { hi: 'गंगा द्वार', en: 'Ganga Dwar' }, look: [0, -12, 175] },
    { id: 'ghat', node: 'ghat', label: { hi: 'ललिता घाट · माँ गंगा', en: 'Lalita Ghat · at the Ganga' }, look: [0, -15, 220] },
    { id: 'ghat-north', node: 'ghat-n', label: { hi: 'घाट · मणिकर्णिका की ओर', en: 'The ghats toward Manikarnika' }, look: [330, -12, 200] },
    { id: 'ghat-south', node: 'ghat-s', label: { hi: 'घाट · दशाश्वमेध की ओर', en: 'The ghats toward Dashashwamedh' }, look: [-330, -12, 200] },
  ];
  return { nav: { nodes, edges }, places };
}

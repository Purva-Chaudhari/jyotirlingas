import type { NavEdge, NavGraph, Place } from '../types';
import { F, GZ } from './temple';
import { pathY, SAMADHI } from './terrain';

type V = [number, number, number];

/**
 * Kedarnath's walking graph for Places (engine/travel.ts). +z south (the approach), +x east; the square at y 0,
 * the temple floor F (1.0), the Samadhi court 6 m below ground. It follows the pilgrim's way: the last stretch of
 * the trek from Gaurikund through the welcome gate → the approach street → the broad steps into the square →
 * Nandi → the front steps → the Sabha Mandapa → the passage → the garbhagriha; and round the temple's west side
 * to Bhim Shila behind it, then east along the protection wall, through its gateway and down the stair into the
 * Adi Shankaracharya Samadhi. Checked with `node scripts/navcheck.mjs kedarnath`.
 */
export function kedarNav(): { nav: NavGraph; places: Place[] } {
  const p = (x: number, z: number): V => [x, pathY(z), z];
  const S = SAMADHI;
  const nodes: Record<string, V> = {
    // the trek path and the approach street (pathY slopes down to the south)
    trek: p(0, 240),
    welcome: p(0, 196),
    street: p(0, 90),
    spawn: [0, -1.818, 62], // the site's spawn
    'steps-foot': p(0, 55),
    'steps-head': [0, 0, 48],
    // the square
    plaza: [0, 0, 44],
    square: [1.5, 0, 30],
    nandi: [2.2, 0, 16.8],
    'nandi-e': [2.6, 0, 11.3],
    'temple-step': [0, 0, 10.6],
    porch: [0, F, 7.6],
    // the Sabha Mandapa, the passage, the garbhagriha
    'hall-door': [0, F, 4.4],
    mandapa: [1.5, F, 2.5],
    'hall-back': [1.25, F, -2.5],
    'hall-exit': [0, F, -3.1],
    'pass-in': [0, F, -3.6],
    'pass-out': [0, F, GZ + 3.2],
    darshan: [0, F, -8.4],
    garbhagriha: [1.6, F, -8.3],
    // round the west side of the temple to Bhim Shila
    'west-front': [-10.5, 0, 14],
    'west-back': [-10.5, 0, -20],
    bhimshila: [-3, 0, -21],
    'east-back': [10.5, 0, -20],
    // east between the festive gate's pillar and the queue lane's rails, then up the east side
    'gap-w': [4.1, 0, 11.6],
    'east-front': [12.2, 0, 11.4],
    // along the protection wall to its gateway and the Samadhi walk
    'wall-w': [-6, 0, -33],
    'wall-e': [S.x, 0, -33],
    samadhi: [S.x, 0, -44],
    'sam-head': [S.x, 0, S.z + S.r + 1.6],
    'sam-foot': [S.x, -6, S.z + 5.2],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('trek', 'welcome', 'street', 'spawn', 'steps-foot', 'steps-head', 'plaza', 'square', 'nandi', 'nandi-e', 'temple-step', 'porch', 'hall-door', 'mandapa', 'hall-back', 'hall-exit', 'pass-in', 'pass-out', 'darshan', 'garbhagriha'),
    ...chain('square', 'west-front', 'west-back', 'bhimshila'),
    ...chain('west-back', 'wall-w', 'wall-e', 'samadhi', 'sam-head', 'sam-foot'),
    ...chain('nandi-e', 'gap-w', 'east-front', 'east-back', 'bhimshila'),
    ['east-back', 'wall-e'],
  ];
  const places: Place[] = [
    { id: 'trek', node: 'trek', label: { hi: 'गौरीकुंड पैदल मार्ग', en: 'The trek from Gaurikund' }, look: [0, 8, 150] },
    { id: 'kedarpuri', node: 'spawn', label: { hi: 'केदारपुरी मार्ग', en: 'Kedarpuri street' }, look: [0, 9, -6] },
    { id: 'square', node: 'plaza', label: { hi: 'मंदिर चौक', en: 'The temple square' }, look: [0, 9, -6] },
    { id: 'nandi', node: 'nandi', label: { hi: 'नंदी', en: 'Nandi' }, look: [0, 2.5, 6] },
    { id: 'mandapa', node: 'mandapa', label: { hi: 'सभा मंडप', en: 'Sabha Mandapa' }, look: [0, F + 1.4, -3.1] },
    { id: 'garbhagriha', node: 'darshan', label: { hi: 'गर्भगृह · केदारनाथ दर्शन', en: 'Garbhagriha · darshan of Kedarnath' }, look: [0, F + 0.6, GZ] },
    { id: 'parikrama', node: 'west-back', label: { hi: 'परिक्रमा पथ', en: 'Parikrama round the temple' }, look: [0, 12, -11] },
    { id: 'bhimshila', node: 'bhimshila', label: { hi: 'भीम शिला', en: 'Bhim Shila' }, look: [0.6, 1.6, -25.6] },
    { id: 'wall', node: 'wall-e', label: { hi: 'सुरक्षा दीवार · समाधि द्वार', en: 'Protection wall · Samadhi gateway' }, look: [S.x, 1.5, -40] },
    { id: 'samadhi', node: 'samadhi', label: { hi: 'आदि शंकराचार्य समाधि', en: 'Adi Shankaracharya Samadhi' }, look: [S.x, -2, S.z] },
    { id: 'samadhi-court', node: 'sam-foot', label: { hi: 'समाधि प्रांगण · शंकराचार्य प्रतिमा', en: 'Samadhi court · statue of Shankaracharya' }, look: [S.x, -2.5, S.z] },
  ];
  return { nav: { nodes, edges }, places };
}

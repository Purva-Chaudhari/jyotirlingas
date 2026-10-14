import type { NavEdge, NavGraph, Place } from '../types';
import { F, GZ } from './temple';
import { pathY, SAMADHI } from './terrain';
import { QUEUE_WALK, VIP_DARSHAN } from './mode';

type V = [number, number, number];

/**
 * Kedarnath's walking graph for Places (engine/travel.ts). +z south (the approach), +x east; the square at y 0,
 * the temple floor F (1.0), the Samadhi court 6 m below ground. It follows the pilgrim's way: the last stretch of
 * the trek from Gaurikund through the welcome gate → the approach street → the broad steps into the square →
 * Nandi → round the chunri railing and in at its east gap → the front steps → the Sabha Mandapa → the passage → the garbhagriha; and round the temple's west side
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
    // in the square beside the queue pens on its west side
    'queue-path': [-20, 0, 24],
    square: [1.5, 0, 30],
    nandi: [2.2, 0, 16.8],
    // round the chunri railing to its east gap (the VIP way; the queue comes in at the west) and inside it to the
    // foot of the steps: no straight way in
    'front-e': [8.4, 0, 17],
    'gap-out': [8.4, 0, 13.4],
    'gap-in': [4.6, 0, 13.4],
    'step-e': [2.6, 0, 11.6], // inside the torana's east pillar, beside Nandi
    'temple-step': [0, 0, 10.2],
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
    // round the west side of the temple to Bhim Shila: between the queue pens and the chunri railing
    'west-pass': [-7.6, 0, 19.5],
    'west-front': [-7.6, 0, 10.4],
    'west-side': [-10.5, 0, 4],
    'west-back': [-10.5, 0, -20],
    bhimshila: [-3, 0, -21],
    'east-back': [10.5, 0, -20],
    // from the east gap up the east side
    'east-front': [12.2, 0, 11.4],
    // general darshan: the walk through the queue pens (mode.ts QUEUE_WALK, from the head of the steps)
    ...Object.fromEntries(QUEUE_WALK.slice(1, -1).map(([x, z], i) => [`q${i + 1}`, [x, 0, z] as V])),
    // along the protection wall to its gateway and the Samadhi walk
    'wall-w': [-6, 0, -33],
    'wall-e': [S.x, 0, -33],
    samadhi: [S.x, 0, -44],
    'sam-head': [S.x, 0, S.z + S.r + 1.6],
    'sam-foot': [S.x, -6, S.z + 5.2],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('trek', 'welcome', 'street', 'spawn', 'steps-foot', 'steps-head', 'plaza', 'square', 'nandi'),
    // the way in: general darshan along the queue pens; VIP across the square and in at the railing's east gap
    ...(VIP_DARSHAN ? chain('nandi', 'front-e', 'gap-out', 'gap-in', 'step-e', 'temple-step')
      : chain('steps-head', ...QUEUE_WALK.slice(1, -1).map((_, i) => `q${i + 1}`), 'temple-step')),
    ...chain('temple-step', 'porch', 'hall-door', 'mandapa', 'hall-back', 'hall-exit', 'pass-in', 'pass-out', 'darshan', 'garbhagriha'),
    ...chain('square', 'west-pass', 'west-front', 'west-side', 'west-back', 'bhimshila'),
    ...chain('west-back', 'wall-w', 'wall-e', 'samadhi', 'sam-head', 'sam-foot'),
    ...chain('nandi', 'front-e', 'east-front', 'east-back', 'bhimshila'),
    ['square', 'queue-path'],
    ['east-back', 'wall-e'],
  ];
  const places: Place[] = [
    { id: 'trek', node: 'trek', label: { hi: 'गौरीकुंड पैदल मार्ग', en: 'The trek from Gaurikund' }, look: [0, 8, 150] },
    { id: 'kedarpuri', node: 'spawn', label: { hi: 'केदारपुरी मार्ग', en: 'Kedarpuri street' }, look: [0, 9, -6] },
    { id: 'queue', node: VIP_DARSHAN ? 'queue-path' : 'q2', label: { hi: 'दर्शन की कतार', en: 'The darshan queue' }, look: VIP_DARSHAN ? [-20, 1.2, 15] : [-29, 1.5, 30] },
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

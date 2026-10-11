import type { NavEdge, NavGraph, Place } from '../types';
import { PL, SF, STAIR } from './temple';
import { STATUE } from './statue';
import { ARCH, GATE } from './precinct';

type V = [number, number, number];

/**
 * Nageshwar's walking graph for Places (engine/travel.ts). +x east, −z north, the temple's centre at the
 * origin; the parking outside −1, the compound 0, the hall's plinth 0.9, the sanctum floor −0.3. It follows the
 * pilgrim's walk: the parking → the gate steps → the seated Shiva's forecourt and its deck → the forecourt of the
 * temple (also reached through the west arch) → the railed queue lane → the porch → the hall → Nandi → the stair
 * down to the garbhagriha; plus the hall's north and south side doors. The Nageshwar pond, beyond the compound's
 * east wall, has no walkable way to it: it is seen, not visited. Check with `node scripts/navcheck.mjs nageshwar`.
 */
export function nageshwarNav(): { nav: NavGraph; places: Place[] } {
  const gz = (GATE.z0 + GATE.z1) / 2 + 0.2, az = (ARCH.z0 + ARCH.z1) / 2;
  const nodes: Record<string, V> = {
    // the parking and the gate (its six steps up to the compound)
    spawn: [-55, -1, -41],
    dwar: [GATE.x - 4.5, -1, gz],
    'gate-in': [GATE.x + 2.5, 0, gz],
    // the seated Shiva: the foot of the deck stair, and the deck at his feet
    'statue-foot': [STATUE.x - STATUE.deck - 3, 0, STATUE.z],
    deck: [STATUE.x - STATUE.deck + 1.8, STATUE.deckH, STATUE.z],
    'deck-s': [STATUE.x - STATUE.deck + 1.8, STATUE.deckH, STATUE.z + STATUE.deck - 0.8],
    // the forecourt, the west arch, the railed queue lane and the porch
    'court-n': [-40.3, 0, -26],
    'court-w': [-40.3, 0, -15],
    prangan: [-37, 0, -1],
    'arch-out': [ARCH.x - 4, -1, az],
    'arch-in': [ARCH.x + 2.5, 0, az],
    lane: [-31, 0, 0],
    'porch-out': [-26.5, 0, 0],
    porch: [-21, PL, 0],
    // the hall, Nandi and the stair down to the garbhagriha
    hall: [-12, PL, 0],
    'hall-e': [2.5, PL, 1.6],
    nandi: [6.8, PL, 1.4],
    'stair-head': [STAIR.top - 0.4, PL, 0],
    'stair-foot': [STAIR.bot + 0.5, SF, 0],
    darshan: [12.9, SF, 1.0],
    // the hall's side doors (north to the queue shed, south to the court)
    'side-n': [4.5, PL, -10.3],
    'out-n': [5, 0, -16.8],
    'side-s': [4.5, PL, 10.3],
    'out-s': [5, 0, 16.8],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('spawn', 'dwar', 'gate-in', 'statue-foot', 'deck', 'deck-s'),
    ...chain('gate-in', 'court-n', 'court-w', 'prangan'),
    ...chain('prangan', 'lane', 'porch-out', 'porch', 'hall', 'hall-e', 'nandi', 'stair-head', 'stair-foot', 'darshan'),
    ...chain('arch-out', 'arch-in', 'prangan'),
    ['spawn', 'arch-out'],
    ...chain('hall-e', 'side-n', 'out-n'),
    ...chain('hall-e', 'side-s', 'out-s'),
  ];
  const places: Place[] = [
    { id: 'dwar', node: 'dwar', label: { hi: 'प्रवेश द्वार', en: 'Entrance gate' }, look: [-20, 8, -50] },
    { id: 'statue', node: 'statue-foot', label: { hi: 'शिव प्रतिमा', en: 'The seated Shiva' }, look: [STATUE.x, 16, STATUE.z] },
    { id: 'deck', node: 'deck', label: { hi: 'प्रतिमा का चबूतरा', en: 'At the statue’s feet (the deck)' }, look: [STATUE.x, 22, STATUE.z] },
    { id: 'arch', node: 'arch-in', label: { hi: 'मंदिर तोरण द्वार', en: 'Temple arch (west gate)' }, look: [-20, 4, 0] },
    { id: 'prangan', node: 'prangan', label: { hi: 'मंदिर प्रांगण', en: 'Temple forecourt' }, look: [-12, 8, 0] },
    { id: 'porch', node: 'porch', label: { hi: 'मुख मंडप', en: 'Mukha Mandap (west porch)' }, look: [-10, PL + 1.6, 0] },
    { id: 'hall', node: 'hall', label: { hi: 'सभा मंडप', en: 'Sabha Mandap' }, look: [10, PL + 1.6, 0] },
    { id: 'nandi', node: 'nandi', label: { hi: 'नंदी', en: 'Nandi' }, look: [5.4, PL + 0.8, 0] },
    { id: 'darshan', node: 'darshan', label: { hi: 'गर्भगृह · नागेश्वर दर्शन', en: 'Garbhagriha · darshan of Nageshwar' }, look: [14.35, 0.05, 0.15] },
    { id: 'north-door', node: 'out-n', label: { hi: 'उत्तर द्वार · दर्शन कतार', en: 'North door · darshan queue shed' }, look: [-4, 2, -23] },
    { id: 'south-door', node: 'out-s', label: { hi: 'दक्षिण द्वार', en: 'South door' }, look: [5, 2, 30] },
  ];
  return { nav: { nodes, edges }, places };
}

import type { NavEdge, NavGraph, Place } from '../types';
import { SANCTUM } from './sanctum';
import { PARVATI } from './complex';

type V = [number, number, number];

/**
 * Baba Baidyanath Dham's walking graph for Places (engine/travel.ts). +z east (the Singh Dwar and the lane), +x
 * north; origin = the sanctum's centre; the court at y 0, the plinth, porch and sanctum floor 0.45. The way in:
 * up the lane → through the Singh Dwar → down the queue lane between the rails → up the porch steps → the door
 * passage → the garbhagriha; round the main temple (down the porch steps' south end, behind the tower, up its north
 * side) to Maa Parvati's temple and the gathbandhan, and across the court to the shrines of Ganesh, Lakshmi
 * Narayan, Kaal Bhairav and Annapurna. The shrines themselves are solid blocks in the model: their places are at
 * their doors. Checked with `node scripts/navcheck.mjs vaidyanath`.
 */
export function vaidyaNav(): { nav: NavGraph; places: Place[] } {
  const F = SANCTUM.F;
  const nodes: Record<string, V> = {
    // the lane (Baba Dham ki gali) and the Singh Dwar
    'lane-far': [0, 0, 90],
    'lane-cross': [0, 0, 64],
    spawn: [0, 0, 52],
    gate: [0, 0, 40.4],
    prangan: [0, 0, 34],
    // the queue lane to the porch steps, the porch, the passage and the garbhagriha
    'queue-end': [0, 0, 12.6],
    'porch-front': [0, F, 10.2],
    porch: [3.5, F, 8.8],
    'porch-door': [0, F, 6.4],
    'door-in': [0, F, SANCTUM.half - 0.3],
    darshan: [0, F, 1.8],
    garbhagriha: [1.2, F, 1.4],
    // the circuit round Baba's temple: off the porch's south end, behind the tower, up the north side
    'porch-s': [-3, F, 8],
    // (the plinth's sides are a step too high: down the front steps' south end and round)
    'porch-sw': [-5, F, 10.4],
    'porch-n': [5, F, 10.4], // and the north end of the steps, straight to Ganesh and Maa Parvati
    'step-sw': [-5, 0, 12.9],
    'circ-sw0': [-8.8, 0, 12.6],
    'circ-sw': [-8.8, 0, 7.9],
    'circ-s': [-8.3, 0, -6.75],
    tower: [0, 0, -7.8],
    'circ-n': [9.6, 0, -6.75],
    'circ-ne': [9.6, 0, 10.3],
    'circ-ne2': [8.4, 0, 10.9],
    ganesh: [8.4, 0, 12.6],
    'to-parvati': [5, 0, 12.6],
    'to-parvati2': [5, 0, 15],
    'parvati-w': [7.2, 0, 19.5],
    parvati: [9.6, 0, 20],
    // from the Singh Dwar south across the court (the north half is closed off by the queue's serpentine: Maa
    // Parvati is reached round the temple, as on the parikrama)
    'court-s1': [-2, 0, 39],
    'court-s2': [-4.5, 0, 20],
    // across the court to the subsidiary shrines (at their doors)
    'lakshmi-narayan': [13, 0, -3],
    'kaal-bhairav': [-4, 0, -12.5],
    annapurna: [-17.5, 0, 7],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ...chain('lane-far', 'lane-cross', 'spawn', 'gate', 'prangan', 'queue-end', 'porch-front', 'porch-door', 'door-in', 'darshan', 'garbhagriha'),
    ['porch-front', 'porch'],
    ...chain('porch-front', 'porch-s', 'porch-sw', 'step-sw', 'circ-sw0', 'circ-sw', 'circ-s', 'tower', 'circ-n', 'circ-ne', 'circ-ne2', 'ganesh', 'to-parvati', 'to-parvati2', 'parvati-w', 'parvati'),
    ['circ-n', 'lakshmi-narayan'],
    ['circ-s', 'kaal-bhairav'], ['tower', 'kaal-bhairav'],
    ['circ-sw', 'annapurna'],
    ...chain('porch', 'porch-n', 'to-parvati'),
    ...chain('gate', 'court-s1', 'court-s2', 'annapurna'),
  ];
  const places: Place[] = [
    { id: 'lane', node: 'spawn', label: { hi: 'बाबा धाम की गली', en: 'The lane to Baba Dham' }, look: [0, 11, 0] },
    { id: 'singh-dwar', node: 'gate', label: { hi: 'सिंह द्वार', en: 'Singh Dwar' }, look: [0, 9, 0] },
    { id: 'prangan', node: 'prangan', label: { hi: 'मंदिर प्रांगण', en: 'Mandir Prangan' }, look: [0, 10, 0] },
    { id: 'porch', node: 'porch', label: { hi: 'मंदिर का मंडप', en: 'The temple porch' }, look: [0, 1.4, 5.7] },
    { id: 'garbhagriha', node: 'darshan', label: { hi: 'गर्भगृह · बाबा बैद्यनाथ दर्शन', en: 'Garbhagriha · darshan of Baba Baidyanath' }, look: [SANCTUM.lx, F, SANCTUM.lz] },
    { id: 'tower', node: 'tower', label: { hi: 'परिक्रमा · मंदिर के पीछे', en: 'Parikrama · behind the temple' }, look: [0, 14, 0] },
    { id: 'parvati', node: 'parvati', label: { hi: 'माँ पार्वती मंदिर · गठबंधन', en: 'Maa Parvati Mandir · the gathbandhan' }, look: [PARVATI.x, 8, PARVATI.z] },
    { id: 'ganesh', node: 'ganesh', label: { hi: 'गणेश मंदिर', en: 'Ganesh Mandir' }, look: [11.2, 2, 13.2] },
    { id: 'lakshmi-narayan', node: 'lakshmi-narayan', label: { hi: 'लक्ष्मी नारायण मंदिर', en: 'Lakshmi Narayan Mandir' }, look: [18, 3, -3] },
    { id: 'kaal-bhairav', node: 'kaal-bhairav', label: { hi: 'काल भैरव मंदिर', en: 'Kaal Bhairav Mandir' }, look: [-4, 3, -17] },
    { id: 'annapurna', node: 'annapurna', label: { hi: 'माँ अन्नपूर्णा मंदिर', en: 'Maa Annapurna Mandir' }, look: [-22, 3, 7] },
  ];
  return { nav: { nodes, edges }, places };
}

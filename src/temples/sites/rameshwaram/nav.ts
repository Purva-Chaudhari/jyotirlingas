import type { NavEdge, NavGraph, Place } from '../types';
import { BEACH, RAJA, RING, NANDI, VISHWA, AMMAN, GARBHA, PRAK1, OUTER } from './layout';

type V = [number, number, number];

/**
 * Ramanathaswamy's walking graph for Places (engine/travel.ts). +z east (the street, Agni Theertham, the sea),
 * +x north, origin = the Ramalingam; the courts at y 0, the first prakara 0.45, the mandapams 0.9, the
 * garbhagriha door passage 1.35. From Agni Theertham's ghat up Sannidhi Street (across East Car Street) to the
 * entrance portico, over the third corridor's east arm, through the Rajagopuram past the flagstaff to the
 * Nandi, into the Swami shrine (maha mandapam → the brass rail at the garbhagriha door; the Vishwalingam to
 * the north), out to the Amman shrine and the theertham wells court; the whole third corridor ring with its
 * north, south and west (Chokkattan / Sethu) branches to the gopurams. The west court with the Sethu Madhava
 * tank is walled off in the model (no way in), so it isn't offered. No gates to open. Every edge is
 * walk-checked with `node scripts/navcheck.mjs rameshwaram`.
 */
export function rameshwaramNav(): { nav: NavGraph; places: Place[] } {
  const P1 = 0.45, MF = 0.9, GF = GARBHA.floor;
  const { xN, xS, zW, zE } = RING;
  const nodes: Record<string, V> = {
    // the beach and the ghat, Sannidhi Street, the entrance portico
    spawn: [0, 0.02, BEACH.z0 + 0.6],
    agni: [0, -0.76, 342],
    veedhi: [0, 0, 250],
    'car-street': [0, 0, 171],
    portico: [0, 0.15, 125],
    // the third corridor ring (walkway centrelines) and its branches to the gopurams
    'corridor-e': [0, 0, zE],
    'corr-ne': [xN, 0, zE],
    'corr-n': [xN, 0, 0],
    'corr-nw': [xN, 0, zW],
    chokkattan: [0, 0, zW],
    'corr-sw': [xS, 0, zW],
    'corr-s': [xS, 0, 0],
    'corr-se': [xS, 0, zE],
    'north-gate': [OUTER.x1 - 6, 0, 0],
    'south-gate': [OUTER.x0 + 6, 0, 0],
    'west-gate': [0, 0, OUTER.z0 + 6],
    'sethu-end': [0, 0, -31],
    // the Rajagopuram, past the flagstaff and balipitha to the Nandi
    rajagopuram: [0, 0, RAJA.z],
    'dhwaja-n': [2, 0, 71.5],
    'nandi-e': [2.5, 0, 64.5],
    nandi: [5, 0, 62],
    'nandi-w': [5, 0, 46],
    // the Swami shrine: the door step, the maha mandapam, the garbhagriha door; the Vishwalingam
    'prak1-door': [0, P1, PRAK1.z1 - 0.4],
    'prak1-in': [0, P1, 38.5],
    sannidhi: [0, MF, 24],
    darshan: [0, GF, 3.4],
    'mandapa-n': [0.6, MF, 13.4],
    'mandapa-n2': [1, MF, 13.1],
    'prak1-n': [6.5, P1, 11.1],
    vishwanatha: [VISHWA.x, MF, 6.6],
    // out to the Amman shrine, and the theertham wells court (between its two rows of wells)
    'prak1-out': [-1.5, 0, 43.2],
    'amman-court': [-23.5, 0, 42.8],
    'amman-door': [AMMAN.x, P1, AMMAN.z1],
    amman: [AMMAN.x, MF, 3.5],
    'nandi-back': [-9, 0, 63.25],
    'wells-e': [-10.5, 0, 61.75],
    'wells-s': [-33, 0, 45],
    theertham: [-33, 0, 62],
  };
  const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => [ids[i], b]);
  const edges: NavEdge[] = [
    ['spawn', 'agni'],
    ...chain('spawn', 'veedhi', 'car-street', 'portico', 'corridor-e', 'rajagopuram', 'dhwaja-n', 'nandi-e', 'nandi', 'nandi-w', 'prak1-door', 'prak1-in', 'sannidhi', 'darshan'),
    ...chain('sannidhi', 'mandapa-n', 'mandapa-n2', 'prak1-n', 'vishwanatha'),
    ...chain('prak1-door', 'prak1-out', 'amman-court', 'amman-door', 'amman'),
    ...chain('nandi-e', 'nandi-back', 'wells-e', 'theertham', 'wells-s', 'amman-court'),
    ...chain('corridor-e', 'corr-ne', 'corr-n', 'corr-nw', 'chokkattan', 'corr-sw', 'corr-s', 'corr-se', 'corridor-e'),
    ['corr-n', 'north-gate'], ['corr-s', 'south-gate'], ['chokkattan', 'west-gate'], ['chokkattan', 'sethu-end'],
  ];
  const places: Place[] = [
    { id: 'agni', node: 'agni', label: { hi: 'अग्नि तीर्थम्', en: 'Agni Theertham' }, look: [0, 0.5, 420] },
    { id: 'veedhi', node: 'veedhi', label: { hi: 'सन्निधि वीथि', en: 'Sannidhi Street' }, look: [0, 18, RAJA.z] },
    { id: 'portico', node: 'portico', label: { hi: 'पूर्व प्रवेश मण्डपम्', en: 'The east entrance portico' }, look: [0, 20, RAJA.z] },
    { id: 'rajagopuram', node: 'rajagopuram', label: { hi: 'राजगोपुरम्', en: 'Rajagopuram' }, look: [0, 3, NANDI.z] },
    { id: 'corridor', node: 'corr-n', label: { hi: 'तृतीय प्राकारम् · उत्तर गलियारा', en: 'Third corridor · the north arm' }, look: [xN, 3, zW] },
    { id: 'chokkattan', node: 'chokkattan', label: { hi: 'चोक्कट्टान मण्डपम्', en: 'Chokkattan Mandapam' }, look: [xS, 3, zW] },
    { id: 'nandi', node: 'nandi', label: { hi: 'नन्दी मण्डपम्', en: 'Nandi Mandapam' }, look: [0, 3.5, NANDI.z - 2] },
    { id: 'theertham', node: 'theertham', label: { hi: 'तीर्थ कूप', en: 'The theertham wells' }, look: [-24, 0.7, 65] },
    { id: 'sannidhi', node: 'sannidhi', label: { hi: 'महा मण्डपम् · रामनाथ सन्निधि', en: 'Maha Mandapam · Ramanatha Sannidhi' }, look: [0, 1.8, 0] },
    { id: 'darshan', node: 'darshan', label: { hi: 'गर्भगृह · श्री रामलिंगम् दर्शन', en: 'Garbhagriha · darshan of the Ramalingam' }, look: [0, GF + 0.55, 0] },
    { id: 'vishwanatha', node: 'vishwanatha', label: { hi: 'श्री काशी विश्वनाथ · विश्वलिंगम्', en: 'Kasi Viswanathar · the Vishwalingam' }, look: [VISHWA.x, 1.6, VISHWA.z] },
    { id: 'amman', node: 'amman', label: { hi: 'श्री पर्वतवर्धिनी अम्मन', en: 'Parvathavardhini Amman' }, look: [AMMAN.x, 1.9, AMMAN.z] },
    { id: 'north-gopuram', node: 'north-gate', label: { hi: 'उत्तर गोपुरम्', en: 'North Gopuram' }, look: [OUTER.x1 + 20, 6, 0] },
    { id: 'west-gopuram', node: 'west-gate', label: { hi: 'पश्चिम गोपुरम्', en: 'West Gopuram' }, look: [0, 6, OUTER.z0 - 20] },
  ];
  return { nav: { nodes, edges }, places };
}

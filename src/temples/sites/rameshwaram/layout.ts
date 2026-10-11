/**
 * Plan of the Ramanathaswamy temple, Rameswaram, in site metres.
 *
 * Axes: +z = east (the Rajagopuram, the street, Agni Theertham and the sea), +x = north, y up.
 * Origin = centre of the Ramanatha garbhagriha at ground level.
 *
 * Sources: OpenStreetMap outlines (outer wall 263 × 200 m, the third-corridor ring) rotated 6° so the
 * temple's own axis is square to the grid; Fergusson/Burgess plan (1910, as redrawn by Bes & Branfoot,
 * JRAS 2023) for the second prakara, the Rajagopuram, the Ramanatha and Amman shrines and the Nandi;
 * published figures: third corridor 1212 pillars on platforms ~5 ft high, walkway 15–17 ft;
 * Rajagopuram 9 tiers; west gopuram 5 tiers (78 ft); north and south gopurams 5 tiers (91 ft, 2016);
 * Nandi 22 ft long, 17 ft high.
 */

/** outer (third-prakara) wall, outer faces */
export const OUTER = { x0: -99, x1: 101, z0: -144, z1: 121, h: 6.6, t: 1.6 };

/** third corridor ring: walkway centrelines */
export const RING = { xN: 54, xS: -62, zW: -83, zE: 110 };
/** cross-section of a corridor arm, measured from the walkway centreline */
export const ARM = {
  walk: 2.6, // half-width of the sunken walkway (5.2 m ≈ 17 ft)
  plat: 8.2, // platforms run from walk to plat
  wall: 9.0, // wall outer face
  platY: 1.5, // platform top (≈ 5 ft)
  row1: 3.25, // front pillar row
  row2: 6.35, // back pillar row
  pitch: 2.45, // pillar spacing along the corridor
  pillarTop: 6.16,
  beamTop: 7.7,
  ceil: 8.7, // walkway ceiling
  sideCeil: 7.7,
  roof: 9.3,
};

/** second prakara wall */
export const PRAK2 = { x0: -53, x1: 45, z0: -29, z1: 88, h: 7.2 };

/** Rajagopuram (east): plan centre, width (x) and depth (z) of the stone base, height to kalasha tips */
export const RAJA = { x: 0, z: 92, w: 32, d: 18, h: 52, tiers: 9, passW: 4.2, passH: 7.4 };

/** first prakara (Swami shrine) enclosure */
export const PRAK1 = { x0: -16, x1: 19, z0: -14, z1: 42, h: 6.4, floor: 0.9 };

/** Ramanatha garbhagriha: vimana base half-size, inner chamber half-size */
export const GARBHA = { half: 4.8, inner: 1.95, floor: 1.35, rail: 2.3 };
export const MANDAPA = { z0: 4.8, z1: 34, hw: 7, ardhaZ: 11.5, ardhaHW: 3.6 };

/** Kasi Viswanathar (Vishwalingam) shrine, north of Ramanatha */
export const VISHWA = { x: 10.6, z: 1.5, half: 2.9, inner: 1.35 };

/** Parvathavardhini Amman shrine, south of Ramanatha */
export const AMMAN = { x: -32, z: -2, half: 3.8, inner: 1.7, x0: -51, x1: -19, z0: -24, z1: 34 };

/** Nandi, dhwajastambha, balipitha on the main axis */
export const NANDI = { z: 57, plinth: 0.55 };
export const DHWAJA = { z: 74 };
export const BALI = { z: 68 };

/** the theertham court (open to the sky) south of the Nandi mandapam */
export const WELLS = { x0: -51, x1: -15, z0: 44, z1: 86 };

/** Sethu Madhava theertham tank in the west court */
export const TANK = { x0: -50, x1: -18, z0: -72, z1: -40, depth: 3.2 };

/** street east of the temple, the beach and the sea */
export const STREET = { hw: 6.2, z0: 131, z1: 336 };
export const EAST_CAR = { z: 171, hw: 6 };
export const BEACH = { z0: 336, water: 362 };
export const SEA_Y = -1.25;

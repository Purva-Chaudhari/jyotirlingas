/**
 * Site plan (metres). Origin = centre of the old temple's mandapa floor, at the top of the cliff.
 * +z = south (the Narmada, the Mamleshwar bank beyond), +x = east (upstream: Jhoola pul, the dam),
 * -z = north (up the Mandhata hill). The temple's river face looks south over the water.
 */

/** Narmada water surface (≈16 m below the temple floor; the cliff and new galleries fill the drop). */
export const WATER_Y = -15.8;
/** the ghat platform in front of the galleries */
export const GHAT = { y: -12, z0: 24, z1: 31, x0: -78, x1: 70, stepsTo: 38.5 };

/** the new riverfront galleries: column grid, storeys */
export const FRAME = {
  xs: [-39, -31.5, -24, -16.5, -9.75, -3, 3, 9.75, 16.5, 23.25, 29, 34.5],
  zs: [4, 9, 14, 19, 24],
  /** floor levels; the band z >= 14 rises on to 12 (roof) */
  levels: [-12, -8, -4, 0, 4, 8, 12],
  front: 24,
  back: 4,
  bandBack: 14,
};

/** central grand stair: flight A from the ghat to the -4 landing, flight B to the temple forecourt */
export const STAIR = { hw: 2.6, aZ0: 24, aZ1: 12, landZ: 9.5, bZ1: 3.5 };

/** lane along the cliff from the galleries' east end to the Jhoola pul, at the -4 level */
export const LANE = { y: -4, x0: 34.5, x1: 121, z0: 17, z1: 23 };

/** the old temple: sixty-pillar sabha mandapa (ground floor), upper storeys, shikhara */
export const HALL = { x0: -12.9, x1: 8.6, z0: -16.5, z1: 2, h: 4.4 };
export const F1 = 4.9;
export const SHIKHARA = { x: 0, z: -7, y0: 12.6, hw: 5.9, H: 30 };

/** garbhagriha of the Jyotirlinga: to the east of the hall, NOT under the shikhara */
export const GARBHA = { x0: 9.2, x1: 13.4, z0: -9.4, z1: -4.6, floor: -0.45, ceil: 2.2, doorZ: -6.6, doorHW: 0.55 };
/** the Jyotirlinga itself: set low in its silver basin, against the chamber's east side */
export const LINGA = { x: 12.15, z: -7.0 };

/** Jhoola pul (suspension bridge), crossing from the island (north) to the Mamleshwar bank */
export const JHOOLA = { x: 121, z0: 19, z1: 214, y: -4, hw: 1.3, towers: [36, 192] };
/** the south bank (Omkareshwar town, Mamleshwar) */
export const SOUTH_BANK_Z = 190;
export const MAMLESHWAR = { x: -46, z: 212, y: -6 };

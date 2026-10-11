/**
 * Shared plan of the Bhimashankar site. Units metres; y up; +x = north, +z = east.
 * Origin = courtyard floor at the temple's centre (the temple faces east: garbhagriha at −z, mandapa at +z).
 *
 * Grounded on OpenStreetMap (way 443086246 "building=temple", 25 × 14 m, long axis east–west; way 1535268848,
 * the pedestrian stairway that comes down from the village road-head ~130 m to the north) and on the SRTM
 * hollow: the temple sits at ~915 m in the head of the gully where the Bhima rises, the village and the
 * road-head ~30 m higher on its north side, forested hills to the east (to ~1010 m) and west.
 */

/** sunken courtyard round the temple */
export const COURT = { x0: -14, x1: 16, z0: -24, z1: 22 };
/** retaining-wall tops round the courtyard */
export const RIM = { n: 4.5, w: 4.0, e: 2.6, s: -0.6 };

/** the long stairway from the village (north) down into the courtyard's north-west corner */
export const STAIR = {
  z0: -24, z1: -19.5, x0: 16, flights: 15, steps: 12, rise: 0.165, tread: 0.33, landing: 2.4,
};
export const FLIGHT_RUN = STAIR.steps * STAIR.tread;
export const FLIGHT_LEN = FLIGHT_RUN + STAIR.landing;
export const STAIR_TOP_X = STAIR.x0 + STAIR.flights * FLIGHT_LEN;
export const STAIR_TOP_Y = STAIR.flights * STAIR.steps * STAIR.rise;

/** walking height on the stairway at x (nosing line of each flight, flat landings) */
export function stairY(x: number) {
  if (x <= STAIR.x0) return 0;
  if (x >= STAIR_TOP_X) return STAIR_TOP_Y;
  const k = Math.floor((x - STAIR.x0) / FLIGHT_LEN);
  const u = x - STAIR.x0 - k * FLIGHT_LEN;
  const fr = STAIR.steps * STAIR.rise;
  return k * fr + Math.min(1, u / FLIGHT_RUN) * fr;
}

/** the village plaza at the head of the stairs (shops, the arch "श्रीक्षेत्र जय भीमाशंकर") */
export const PLAZA = { x0: STAIR_TOP_X, x1: STAIR_TOP_X + 26, z0: -46, z1: 8 };

/** the temple */
export const F = 0.6; // mandapa floor
export const GARBHA = { cz: -8.75, half: 4.1, inner: 2.05, floor: -0.3, ceil: 4.5 };
export const HALL = { x0: -7.5, x1: 7.5, z0: -3.9, z1: 11.1, zc: 3.6, step: 2.4 };
export const HALL_TOP = 4.2; // soffit of the roof slab (beams 0.35 below)

/** shrines, kunds, lamp towers */
export const MOKSHA = { x0: -12.5, x1: -4.5, z0: -22.5, z1: -15.5, depth: 3.2 };
export const KUSHA = { x: -12.3, z: -6.5, r: 1.3 };
export const DEEPMAL = { x: 9.6, z: 15.2 };
export const DEEPSTAMBH = { x: -3.4, z: 14.6 };
export const SHANI = { x: -11.6, z: 16.5 };
export const BELL = { x: -8.4, z: 16.5 };
export const KAMALAJA = { x: 8, z: 29, y: RIM.e };
export const GATE = { z: COURT.z1, w: 4.2 };

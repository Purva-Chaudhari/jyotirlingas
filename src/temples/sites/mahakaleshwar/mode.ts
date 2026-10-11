/**
 * Darshan mode, read once from the page URL.
 *
 *  - general (default): the free darshan that most pilgrims get. The queue starts on the Mahakal Lok
 *    side (north), goes through Mahakal Tunnel-1 down to the Ganesh Mandapam, gives darshan from behind
 *    the barricade, and leaves by the Palki Hall. The garbhagriha has been closed to general devotees
 *    since COVID, so the front doorway stair and the east corridor are shut.
 *  - `?darshan=vip`: the old sanctum walk (front doorway → stair → garbhagriha → round the jalahari).
 */
export const VIP_DARSHAN: boolean = (() => {
  try { return new URLSearchParams(location.search).get('darshan') === 'vip'; } catch { return false; }
})();

/**
 * The Ganesh Mandapam (general mode): a hall below the front hall's plinth, x ±X, from the tower's
 * front face (z = Z0) south to Z1, with the floor at FLOOR (the front row) stepping up toward the back.
 * Under the plinth (z < PLINTH) its ceiling is CEIL_HI; beyond the plinth, under the courtyard, CEIL_LO.
 */
export const GM = { X: 7, Z0: 0.85, Z1: 12.8, PLINTH: 9.1, FLOOR: -3.0, CEIL_HI: 0.75, CEIL_LO: -0.15 };
/** half-width of the Nandi hall (general mode: as wide as the garbhagriha's south face) */
export const NH = 3.5;
/**
 * General darshan: the front stair. From the threshold of the hall's front doorway (z = HEAD, y = TOP, the plinth
 * top) it runs north, x ±W, down N risers through the Ganesh Mandapam to the back edge of the darshan platform
 * (z = FOOT, y = BOT); walled either side by marble parapets (x W..W + WALL) up to the mandapam's ceiling.
 */
export const FRONT = { W: 1.1, WALL: 0.25, HEAD: 6.0, FOOT: 1.6, TOP: 0.9, BOT: GM.FLOOR + 0.45, N: 17 };

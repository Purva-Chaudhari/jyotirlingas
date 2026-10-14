/**
 * Darshan mode, read once from the page URL (as at Mahakaleshwar).
 *
 *  - general (default): the darshan most pilgrims get. Up the steps into the square, in at the mouth of the queue's
 *    fenced, canopied pens on the west side, along every lane of them beside the waiting line, in at the chunri
 *    railing's west gap and up the front steps.
 *  - `?darshan=vip`: straight across the square and in at the railing's east gap.
 */
export const VIP_DARSHAN: boolean = (() => {
  try { return new URLSearchParams(location.search).get('darshan') === 'vip'; } catch { return false; }
})();

/**
 * The general darshan walk through the queue pens (x, z; all on the square, y 0): from the head of the steps to the
 * mouth, north up the east lane of the corridor, then the three switchbacks along the front (walking each lane on
 * the side away from the waiting line), the railing's west gap, past Nandi to the foot of the front steps.
 */
export const QUEUE_WALK: [number, number][] = [
  [0, 48], [-27.6, 49.0], [-29.0, 48.4], [-29.0, 16.3], [-9.0, 16.3], [-9.0, 14.65],
  [-33.15, 14.65], [-33.15, 13.0], [-8.0, 13.0], [-5.6, 13.0], [-2.6, 11.6], [0, 10.2],
];

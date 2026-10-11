/**
 * The temples that can be entered for now. Each opens at its own address, /<id> (e.g. /mahakaleshwar); the
 * others are "coming soon" on the landing page and their addresses lead back there. Dev tools can still open
 * any temple with ?temple=<id>&preview=1.
 */
export const OPEN_TEMPLES: ReadonlySet<string> = new Set(['mahakaleshwar']);

/** every temple's address (/<id>): the open ones enter, the rest lead back to the landing page */
export const ALL_TEMPLES: readonly string[] = [
  'somnath', 'mallikarjuna', 'mahakaleshwar', 'omkareshwar', 'vaidyanath', 'bhimashankar',
  'rameshwaram', 'nageshwar', 'kashi-vishwanath', 'trimbakeshwar', 'kedarnath', 'grishneshwar',
];

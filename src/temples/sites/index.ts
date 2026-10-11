import type { SiteDef } from './types';

/** Every site is lazy-loaded; open temples.html?temple=<id> to test one. */
export const SITES: Record<string, () => Promise<{ default: SiteDef }>> = {
  mahakaleshwar: () => import('./mahakaleshwar'),
  somnath: () => import('./somnath'),
  kedarnath: () => import('./kedarnath'),
  'kashi-vishwanath': () => import('./kashi-vishwanath'),
  omkareshwar: () => import('./omkareshwar'),
  trimbakeshwar: () => import('./trimbakeshwar'),
  grishneshwar: () => import('./grishneshwar'),
  mallikarjuna: () => import('./mallikarjuna'),
  vaidyanath: () => import('./vaidyanath'),
  bhimashankar: () => import('./bhimashankar'),
  rameshwaram: () => import('./rameshwaram'),
  nageshwar: () => import('./nageshwar'),
};

export const DEFAULT_SITE = 'mahakaleshwar';

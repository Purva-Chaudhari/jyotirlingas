import { JYOTIRLINGAS } from '../temples/stories/catalog';

/**
 * Each Jyotirlinga's position, copied from its site's index.ts (src/temples/sites/<id>/index.ts) so the
 * landing doesn't pull in the 3D site code. tests/landing.test.ts keeps the two in step.
 */
export const POSITIONS: Record<string, { lon: number; lat: number }> = {
  somnath: { lon: 70.4012, lat: 20.888 },
  mallikarjuna: { lon: 78.8682, lat: 16.0741 },
  mahakaleshwar: { lon: 75.7682, lat: 23.1828 },
  omkareshwar: { lon: 76.151, lat: 22.2456 },
  vaidyanath: { lon: 86.7, lat: 24.4925 },
  bhimashankar: { lon: 73.5357, lat: 19.0719 },
  rameshwaram: { lon: 79.3174, lat: 9.2881 },
  nageshwar: { lon: 69.0869, lat: 22.3359 },
  'kashi-vishwanath': { lon: 83.0107, lat: 25.3109 },
  trimbakeshwar: { lon: 73.5307, lat: 19.9322 },
  kedarnath: { lon: 79.0669, lat: 30.7352 },
  grishneshwar: { lon: 75.16992, lat: 20.02497 },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export interface Temple {
  id: string;
  order: number;
  numeral: string;
  name: string;
  hi: string;
  place: string;
  lon: number;
  lat: number;
}

export const TEMPLES: Temple[] = JYOTIRLINGAS.map((j, i) => ({
  id: j.id,
  order: i + 1,
  numeral: ROMAN[i],
  name: j.name.en,
  hi: j.name.hi,
  place: j.place,
  ...POSITIONS[j.id],
}));

const PROGRESS_KEY = 'divya-yatra.progress'; // src/temples/stories/progress.ts (read-only here)

/** the pilgrim's progress from the temple pages: visited, and how many stories heard */
export function readProgress(): Record<string, { visited: boolean; heard: number }> {
  const out: Record<string, { visited: boolean; heard: number }> = {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    const temples = data && typeof data === 'object' && data.temples && typeof data.temples === 'object' ? data.temples : {};
    for (const t of TEMPLES) {
      const p = temples[t.id];
      out[t.id] = { visited: !!p?.visited, heard: Array.isArray(p?.heard) ? p.heard.length : 0 };
    }
  } catch {
    for (const t of TEMPLES) out[t.id] = { visited: false, heard: 0 };
  }
  return out;
}

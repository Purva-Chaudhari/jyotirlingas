import type { Lang } from './types';

/**
 * The pilgrim's progress and preferences, kept on their own device (localStorage, no login).
 * Every read and write is wrapped: private windows, blocked storage or a full quota just mean
 * progress lasts for this visit only.
 */

export const PROGRESS_KEY = 'divya-yatra.progress';
export const PREFS_KEY = 'divya-yatra.prefs';
export const PROGRESS_VERSION = 1;

export interface TempleProgress {
  /** reached the darshan spot or the sanctum (ms since epoch, first time) */
  visited?: number;
  /** stop ids whose narration was played to 85% */
  heard: string[];
  /** stop ids whose card text was shown 20 s or scrolled to the end */
  read: string[];
}

export interface ProgressData {
  v: number;
  temples: Record<string, TempleProgress>;
}

export interface Prefs {
  v: number;
  lang: Lang;
  autoplay: boolean;
  volume: number;
  muted: boolean;
  lyrics: boolean;
  /** story captions at the bottom of the screen */
  captions: boolean;
  /** the guide arrow to the next story / darshan */
  guide: boolean;
  /** story narration playback speed (one of SPEEDS) */
  rate: number;
}

const DEFAULT_PREFS: Prefs = { v: 1, lang: 'en', autoplay: true, volume: 0.9, muted: false, lyrics: false, captions: true, guide: true, rate: 1 };

/** the narration speeds offered, slowest first */
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** a stored speed, if it is one of SPEEDS (anything else, missing or damaged, is 1×) */
export function parseSpeed(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n)) return 1;
  return SPEEDS.find((s) => Math.abs(s - n) < 0.001) ?? 1;
}

/** the next speed up (dir 1) or down (dir -1): stops at the ends, or wraps around when `wrap` (the chip's click cycle) */
export function stepSpeed(cur: number, dir: 1 | -1, wrap = false): number {
  const i = SPEEDS.indexOf(parseSpeed(cur) as (typeof SPEEDS)[number]);
  const j = i + dir;
  if (j < 0) return wrap ? SPEEDS[SPEEDS.length - 1] : SPEEDS[0];
  if (j >= SPEEDS.length) return wrap ? SPEEDS[0] : SPEEDS[SPEEDS.length - 1];
  return SPEEDS[j];
}

/** "1×", "0.75×", "1.5×" */
export const speedLabel = (r: number) => `${r}×`;

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep it in memory for this visit */
  }
}

const uniq = (a: unknown): string[] => (Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === 'string'))] : []);

/** Bring any older (or damaged) stored shape up to the current version. */
export function migrate(raw: unknown): ProgressData {
  const out: ProgressData = { v: PROGRESS_VERSION, temples: {} };
  if (!raw || typeof raw !== 'object') return out;
  const temples = (raw as { temples?: unknown }).temples;
  if (!temples || typeof temples !== 'object') return out;
  for (const [id, t] of Object.entries(temples as Record<string, unknown>)) {
    if (!t || typeof t !== 'object') continue;
    const r = t as Record<string, unknown>;
    out.temples[id] = {
      visited: typeof r.visited === 'number' ? r.visited : r.visited === true ? Date.now() : undefined,
      heard: uniq(r.heard),
      read: uniq(r.read),
    };
  }
  return out;
}

type Listener = () => void;

export class Progress {
  data: ProgressData;
  prefs: Prefs;
  private listeners = new Set<Listener>();

  constructor() {
    this.data = migrate(load(PROGRESS_KEY));
    const p = load<Partial<Prefs>>(PREFS_KEY) ?? {};
    this.prefs = {
      ...DEFAULT_PREFS,
      lang: p.lang === 'hi' ? 'hi' : 'en',
      autoplay: p.autoplay !== false,
      volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : DEFAULT_PREFS.volume,
      muted: p.muted === true,
      lyrics: p.lyrics === true,
      captions: p.captions !== false,
      guide: p.guide !== false,
      rate: parseSpeed(p.rate),
    };
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit() {
    save(PROGRESS_KEY, this.data);
    for (const fn of this.listeners) fn();
  }

  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    this.prefs[k] = v;
    save(PREFS_KEY, this.prefs);
    for (const fn of this.listeners) fn();
  }

  temple(id: string): TempleProgress {
    return (this.data.temples[id] ??= { heard: [], read: [] });
  }

  peek(id: string): TempleProgress | undefined {
    return this.data.temples[id];
  }

  markVisited(id: string) {
    const t = this.temple(id);
    if (t.visited) return false;
    t.visited = Date.now();
    this.commit();
    return true;
  }

  mark(id: string, what: 'heard' | 'read', stop: string) {
    const list = this.temple(id)[what];
    if (list.includes(stop)) return false;
    list.push(stop);
    this.commit();
    return true;
  }

  /** a stop counts once it was heard or read */
  done(id: string, stop: string) {
    const t = this.data.temples[id];
    return !!t && (t.heard.includes(stop) || t.read.includes(stop));
  }

  visitedCount() {
    return Object.values(this.data.temples).filter((t) => t.visited).length;
  }

  reset() {
    this.data = { v: PROGRESS_VERSION, temples: {} };
    this.commit();
  }
}

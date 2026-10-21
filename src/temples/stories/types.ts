/** Bilingual text: English and Hindi. */
export interface Bi {
  en: string;
  hi: string;
}

export type Lang = keyof Bi;

/** One story stop in a temple: a legend, a piece of history or a ritual, told where it happened. */
export interface StoryStop {
  id: string;
  /** where it is told: a zone name from the site's zoneAt(), and/or a feature with a position in anchors.ts */
  at: { zone?: string; feature?: string };
  kind: 'legend' | 'history' | 'ritual';
  title: Bi;
  text: Bi;
  didYouKnow?: Bi;
  sources?: string[];
}

export interface AartiAudio {
  /** absolute, or relative to the site's base (public/) */
  url: string;
  license: string;
  notes?: string;
  /** shown as "Now playing" and credited on screen while it plays */
  title?: string;
  by?: string;
  /** where the recording comes from (linked from the aarti panel) */
  creditUrl?: string;
  /** not openly licensed, but the site owner chose to use it (who/why): played anyway, always credited */
  permission?: string;
}

/**
 * The temple's own aarti on YouTube, played through the official embedded player (never downloaded or
 * rehosted). `recorded` entries are tried in order; a `live` entry (a channel's live stream) is only offered
 * as a "Live now" link.
 */
export interface AartiYouTube {
  /** recorded: the video to embed */
  videoId?: string;
  /** live: the channel whose live stream to link to */
  channelId?: string;
  /** seconds: the aarti portion of the video, looped while the pilgrim stays */
  start?: number;
  end?: number;
  title: string;
  channel: string;
  channelUrl: string;
  /** the temple trust's own channel (true) or a broadcaster (false) */
  official: boolean;
  kind: 'recorded' | 'live';
  url?: string;
  /** how channel ownership was checked */
  verifiedBy?: string;
}

export interface Aarti {
  name: string | Bi;
  schedule?: unknown[];
  lyrics?: { text: string | Bi; source?: string; license?: string };
  audio?: AartiAudio[];
  youtube?: AartiYouTube[];
  youtubeSources?: string[];
  notes?: string;
  /** other aartis heard elsewhere in the temple (e.g. the Ganga Aarti on the ghat), each in its own zones */
  places?: AartiPlace[];
}

/** a recorded aarti heard throughout some zones of the site (not at the darshan spot) */
export interface AartiPlace {
  id: string;
  name: string | Bi;
  /** the site zones (SiteDef.zoneAt) where it is heard */
  zones: string[];
  schedule?: unknown[];
  audio: AartiAudio[];
}

/** src/temples/stories/<id>.json */
export interface TempleStory {
  id: string;
  name: Bi;
  stops: StoryStop[];
  aarti?: Aarti;
}

/**
 * Word timings written by scripts/narrate.py next to each narration clip
 * (public/audio/stories/<id>/<stopId>.<lang>.json).
 */
export interface Narration {
  hash: string;
  voice: string;
  rate: string;
  /** seconds */
  dur: number;
  /** the exact string that was spoken: text, then the "did you know" (if any) */
  said: string;
  /** where each card section sits inside `said` */
  segments: { key: 'text' | 'didYouKnow'; start: number; end: number }[];
  /** [start s, duration s, char start, char end] into `said`; char start is -1 when the word could not be aligned */
  words: [number, number, number, number][];
}

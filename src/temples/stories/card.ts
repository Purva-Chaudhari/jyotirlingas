import { unlockMedia } from './unlock';
import type { Lang, Narration, StoryStop } from './types';
import { stepSpeed, speedLabel } from './progress';
import { detectTouch } from '../engine/profile';

/**
 * The story as you walk: the narration plays, and its words appear as film-style captions at the bottom
 * of the screen, one spoken phrase at a time, with the word being said lit. Captions can be turned off
 * (C) and the choice is remembered. Plain HTML over the canvas; it never takes the pointer lock or the
 * walking keys, so you keep walking while the story is told.
 */

const KIND: Record<StoryStop['kind'], [string, string]> = {
  legend: ['Legend', 'कथा'],
  history: ['History', 'इतिहास'],
  ritual: ['Ritual', 'परंपरा'],
};

export const HEARD_AT = 0.85;
/** how long the story's title stays above the captions once it starts */
const TITLE_FOR_S = 6;
/** captions stay this long after the last word, then fade */
const LINGER_S = 2.5;

export interface CardHost {
  base: string;
  siteId: string;
  lang(): Lang;
  setLang(l: Lang): void;
  autoplay(): boolean;
  setAutoplay(on: boolean): void;
  captions(): boolean;
  setCaptions(on: boolean): void;
  /** narration playback speed (1 = as recorded) */
  speed(): number;
  setSpeed(r: number): void;
  volume(): { volume: number; muted: boolean };
  heard(stop: string): void;
  read(stop: string): void;
  status(stop: string): { heard: boolean; read: boolean };
  /** narration started/stopped (to duck the aarti) */
  speaking(on: boolean): void;
  /** the narration came to its end */
  ended(stop: string): void;
}

/** a spoken phrase shown as one caption: words w0..w1 of the narration, chars c0..c1 of its text */
interface Phrase { w0: number; w1: number; c0: number; c1: number }

/** split the narration into caption-sized phrases: at sentence ends, or at a pause once a line is long enough */
export function phrases(n: Narration, max = 13): Phrase[] {
  const out: Phrase[] = [];
  let w0 = 0;
  for (let i = 0; i < n.words.length; i++) {
    const [, , c0, c1] = n.words[i];
    const count = i - w0 + 1;
    // the character right after this word (and any closing quote) tells us whether a sentence or clause ends
    const after = n.said.slice(c1, c1 + 3);
    const stop = /^[’'"”)]?[.!?।॥]/.test(after);
    const pause = /^[’'"”)]?[,;:—–]/.test(after);
    if (stop || (pause && count >= 7) || count >= max || i === n.words.length - 1) {
      out.push({ w0, w1: i, c0: n.words[w0][2], c1: Math.min(n.said.length, c1 + (/^[.!?।॥’'"”)]+/.exec(after)?.[0].length ?? 0)) });
      w0 = i + 1;
    }
    void c0;
  }
  return out;
}

export class StoryCard {
  readonly el: HTMLElement;
  private capEl: HTMLElement;
  private headEl: HTMLElement;
  private audio = new Audio();
  /** the last play() was refused by the browser (no gesture yet) */
  private blocked = false;
  private stop: StoryStop | null = null;
  private narr: Narration | null = null;
  private phrases: Phrase[] = [];
  private phrase = -1;
  private spans: HTMLElement[] = [];
  private lit = -1;
  private raf = 0;
  private loadToken = 0;
  private hideTimer = 0;
  private cache = new Map<string, Promise<Narration | null>>();
  open = false;

  constructor(private host: CardHost) {
    const el = (this.el = document.createElement('div'));
    el.id = 'story-card';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Story captions');
    el.innerHTML = `
      <div class="cap-head"><span class="kind"></span><span class="title"></span></div>
      <p class="cap" aria-live="polite"></p>
      <div class="cap-tools">
        <button class="play" title="Play / pause (K)" aria-label="Play narration"></button>
        <button class="lang" title="English / हिन्दी (H)" aria-label="Switch language"><b data-l="en">EN</b><b data-l="hi">हिं</b></button>
        <button class="cc" title="Captions on / off (C)" aria-label="Captions">CC</button>
        <button class="speed" title="Narration speed ([ slower · ] faster)" aria-label="Narration speed"></button>
        <button class="x" title="Stop the story (N)" aria-label="Stop the story">×</button>
      </div>`;
    this.capEl = el.querySelector('.cap')!;
    this.headEl = el.querySelector('.cap-head')!;
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    q('.x').addEventListener('click', () => this.close());
    q('.lang').addEventListener('click', () => this.toggleLang());
    q('.play').addEventListener('click', () => this.toggle());
    q('.cc').addEventListener('click', () => this.toggleCaptions());
    q('.speed').addEventListener('click', () => this.stepSpeed(1, true));
    // buttons must not keep focus (Space / keys would re-trigger them) nor let clicks reach the walk overlay
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if ((e.target as HTMLElement).closest('button')) (document.activeElement as HTMLElement | null)?.blur();
    });

    const a = this.audio;
    a.preload = 'auto';
    a.preservesPitch = true;
    a.addEventListener('play', () => { this.syncPlay(); this.host.speaking(true); this.loop(); });
    a.addEventListener('pause', () => { this.syncPlay(); this.host.speaking(false); });
    a.addEventListener('ended', () => {
      this.syncPlay();
      this.host.speaking(false);
      this.checkHeard();
      this.spans.forEach((s) => { s.classList.remove('now'); s.classList.add('said'); });
      if (this.stop) this.host.ended(this.stop.id);
      // the last line lingers a moment, then the captions fade away
      clearTimeout(this.hideTimer);
      this.hideTimer = window.setTimeout(() => this.el.classList.add('done'), LINGER_S * 1000);
    });
    a.addEventListener('timeupdate', () => this.checkHeard());
    a.addEventListener('error', () => this.syncPlay());
    this.applyVolume();
    this.applySpeed();
    this.syncCaptions();
    this.syncPlay();
  }

  get current() {
    return this.stop;
  }

  get playing() {
    return !this.audio.paused && !this.audio.ended;
  }

  /** for tests: the narration element */
  get media() {
    return this.audio;
  }

  applyVolume() {
    const v = this.host.volume();
    this.audio.volume = v.volume;
    this.audio.muted = v.muted;
  }

  /** set the narration speed from the prefs (the captions follow audio.currentTime, so they keep pace) */
  applySpeed() {
    const r = this.host.speed();
    // load() resets playbackRate to defaultPlaybackRate, so set both
    this.audio.defaultPlaybackRate = r;
    this.audio.playbackRate = r;
    this.audio.preservesPitch = true;
    const b = this.el.querySelector('.speed') as HTMLElement;
    b.textContent = speedLabel(r);
    b.classList.toggle('on', r !== 1);
    b.setAttribute('aria-label', `Narration speed ${speedLabel(r)}`);
  }

  /** one speed faster (1) or slower (-1); `wrap` cycles round (the chip's click). Returns the new speed. */
  stepSpeed(dir: 1 | -1, wrap = false) {
    const r = stepSpeed(this.host.speed(), dir, wrap);
    this.host.setSpeed(r);
    this.applySpeed();
    return r;
  }

  private clip(stop: StoryStop, lang: Lang, ext: string) {
    return `${this.host.base}audio/stories/${this.host.siteId}/${encodeURIComponent(stop.id)}.${lang}.${ext}`;
  }

  private narration(stop: StoryStop, lang: Lang) {
    const url = this.clip(stop, lang, 'json');
    let p = this.cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => (r.ok ? (r.json() as Promise<Narration>) : null)).catch(() => null);
      this.cache.set(url, p);
    }
    return p;
  }

  /** warm the narration timings (tiny JSON) so a story starts instantly */
  prefetch(stop: StoryStop) {
    void this.narration(stop, this.host.lang());
  }

  async show(stop: StoryStop, autoplay: boolean) {
    const same = this.stop?.id === stop.id && this.open;
    if (!same) {
      this.audio.pause();
      this.stop = stop;
    }
    this.open = true;
    this.el.classList.add('on');
    this.el.classList.remove('done');
    clearTimeout(this.hideTimer);
    if (!same) await this.render(autoplay);
    else if (autoplay && this.audio.paused) void this.play();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.audio.pause();
    this.el.classList.remove('on');
    cancelAnimationFrame(this.raf);
    clearTimeout(this.hideTimer);
  }

  toggle() {
    if (!this.open) return;
    if (this.audio.paused) {
      this.el.classList.remove('done');
      void this.play();
    } else this.audio.pause();
  }

  /** pause the narration for something else (the aarti); `resume()` carries on from the same word */
  hold() {
    if (!this.open || this.audio.paused) return false;
    this.audio.pause();
    return true;
  }

  resume() {
    if (this.open && this.audio.paused && !this.audio.ended) void this.play();
  }

  replay() {
    if (!this.open || !this.audio.src) return;
    this.audio.currentTime = 0;
    this.el.classList.remove('done');
    void this.play();
  }

  toggleLang() {
    const next: Lang = this.host.lang() === 'en' ? 'hi' : 'en';
    this.host.setLang(next);
    if (!this.stop || !this.open) return this.syncLang();
    const wasPlaying = this.playing;
    this.audio.pause();
    void this.render(wasPlaying);
  }

  toggleCaptions() {
    this.host.setCaptions(!this.host.captions());
    this.syncCaptions();
  }

  private syncCaptions() {
    const on = this.host.captions();
    this.el.classList.toggle('nocap', !on);
    const b = this.el.querySelector('.cc') as HTMLElement;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }

  private syncLang() {
    const lang = this.host.lang();
    this.el.querySelectorAll<HTMLElement>('.lang b').forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
    this.el.lang = lang;
  }

  private async play() {
    try {
      await this.audio.play();
      this.blocked = false;
    } catch {
      /* autoplay blocked until the next user gesture (unlock() then starts it): the play button stays available */
      this.blocked = true;
      this.syncPlay();
    }
  }

  /**
   * From a tap, click or key: a story the browser held back starts now; otherwise the narration element is
   * unlocked so the next story may start by itself as you reach its spot (iOS Safari needs this).
   */
  unlock() {
    if (this.blocked && this.open && this.audio.paused && !this.audio.ended && this.audio.getAttribute('src')) void this.play();
    else unlockMedia(this.audio);
  }

  private async render(autoplay: boolean) {
    const stop = this.stop!;
    const lang = this.host.lang();
    const token = ++this.loadToken;
    this.syncLang();
    const q = (s: string) => this.el.querySelector(s) as HTMLElement;
    q('.kind').textContent = KIND[stop.kind]?.[lang === 'hi' ? 1 : 0] ?? '';
    q('.title').textContent = stop.title[lang] || stop.title.en;
    this.headEl.classList.add('show');
    this.phrases = [];
    this.phrase = -1;
    this.spans = [];
    this.lit = -1;
    this.capEl.textContent = '';
    this.audio.removeAttribute('src');
    this.audio.load();
    this.narr = null;
    this.syncPlay();

    const narr = await this.narration(stop, lang);
    if (token !== this.loadToken) return;
    if (!narr) {
      // nothing recorded yet: show the story's opening as a caption so the stop is not silent and blank
      this.el.classList.add('silent');
      this.capEl.textContent = (stop.text[lang] || stop.text.en).split(/(?<=[.!?।])\s/)[0];
      return;
    }
    this.el.classList.remove('silent');
    this.narr = narr;
    // (phones: shorter phrases, so a caption stays within two lines)
    this.phrases = phrases(narr, detectTouch() ? (Math.min(innerWidth, 720) < 600 ? 8 : 10) : 13);
    this.audio.src = this.clip(stop, lang, 'm4a');
    this.applySpeed();
    this.syncPlay();
    if (autoplay) void this.play();
  }

  /** show phrase p as the caption, built of word spans so the spoken word can be lit */
  private showPhrase(p: number) {
    const n = this.narr!, ph = this.phrases[p];
    this.phrase = p;
    this.spans = [];
    this.capEl.textContent = '';
    if (!ph) return;
    const frag = document.createDocumentFragment();
    let cur = ph.c0;
    for (let i = ph.w0; i <= ph.w1; i++) {
      const [, , c0, c1] = n.words[i];
      if (c0 > cur) frag.append(n.said.slice(cur, c0));
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = n.said.slice(c0, c1);
      frag.append(s);
      this.spans.push(s);
      cur = c1;
    }
    if (cur < ph.c1) frag.append(n.said.slice(cur, ph.c1));
    this.capEl.append(frag);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.highlight();
      if (!this.audio.paused && this.open) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  private highlight() {
    const n = this.narr;
    if (!n || !this.phrases.length) return;
    const t = this.audio.currentTime;
    // the title steps aside once the story is under way
    this.headEl.classList.toggle('show', t < TITLE_FOR_S);
    // last word that has started
    let lo = 0, hi = n.words.length - 1, k = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (n.words[m][0] <= t) { k = m; lo = m + 1; } else hi = m - 1;
    }
    if (k === this.lit) return;
    this.lit = k;
    if (k < 0) return;
    const p = this.phrases.findIndex((ph) => k >= ph.w0 && k <= ph.w1);
    if (p >= 0 && p !== this.phrase) this.showPhrase(p);
    const ph = this.phrases[this.phrase];
    if (!ph) return;
    this.spans.forEach((s, i) => {
      const w = ph.w0 + i;
      s.classList.toggle('said', w < k);
      s.classList.toggle('now', w === k);
    });
  }

  private syncPlay() {
    const btn = this.el.querySelector('.play') as HTMLButtonElement;
    const has = !!this.audio.getAttribute('src');
    btn.disabled = !has;
    const playing = has && !this.audio.paused && !this.audio.ended;
    btn.textContent = playing ? '❚❚' : '▶';
    btn.setAttribute('aria-label', playing ? 'Pause narration' : 'Play narration');
    this.el.classList.toggle('playing', playing);
  }

  /**
   * heard: 85 % of the clip actually played (seeking ahead does not count);
   * read: heard with the captions on, so the words were in front of you as they were spoken
   */
  private checkHeard() {
    const a = this.audio, d = a.duration;
    if (!this.stop || !d || !isFinite(d)) return;
    let played = 0;
    for (let i = 0; i < a.played.length; i++) played += a.played.end(i) - a.played.start(i);
    if (played / d < HEARD_AT && !a.ended) return;
    const s = this.host.status(this.stop.id);
    if (!s.heard) this.host.heard(this.stop.id);
    if (!s.read && this.host.captions()) this.host.read(this.stop.id);
  }

  /** called ~10×/s by the story system (kept for the caller; captions need no polling) */
  tick() {}
}

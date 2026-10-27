import { DUCK_LEVEL, DUCK_TAU, NEAR_TAU, QUIET_STOP } from './aarti';
import type { AartiYouTube } from './types';

/**
 * The temple's real aarti, from the trust's own YouTube channel, through the official YouTube IFrame Player
 * (embedded, never downloaded or rehosted, so the credit and the views stay with the owner).
 *
 * - The API is only loaded when the pilgrim reaches a darshan spot, and the player uses youtube-nocookie.com.
 * - Volume follows the same distance fade and story ducking as the synthesized aarti (player.setVolume 0..100).
 * - The aarti portion (start..end) loops while you stay, and pauses once you have been out of earshot a while.
 * - Anything that goes wrong (offline, API blocked, embedding disabled, video gone) calls `failed`, and the
 *   caller falls back to the synthesized ambience.
 */

// ------------------------------------------------------------ the bits of the IFrame API we use

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getPlayerState(): number;
  loadVideoById(o: { videoId: string; startSeconds?: number; endSeconds?: number }): void;
  cueVideoById(o: { videoId: string; startSeconds?: number; endSeconds?: number }): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window {
    YT?: Partial<YTNamespace>;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YT.PlayerState */
export const YTState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

const API_URL = 'https://www.youtube.com/iframe_api';
const API_TIMEOUT = 12000;
/** time for onReady after the API has loaded */
const READY_TIMEOUT = 15000;
/** playVideo() not playing after this long: autoplay was blocked */
const BLOCKED_AFTER = 3500;
/** the embedded player: at least YouTube's 200 px minimum height, ~16:9 */
export const PLAYER_W = 356;
export const PLAYER_H = 200;

let apiPromise: Promise<YTNamespace> | null = null;

/** load https://www.youtube.com/iframe_api once; rejects when blocked, offline or slow */
export function loadYouTubeApi(timeout = API_TIMEOUT): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT as YTNamespace);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('YouTube API timed out')), timeout);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT as YTNamespace);
      else reject(new Error('YouTube API loaded without YT.Player'));
    };
    const s = document.createElement('script');
    s.src = API_URL;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('YouTube API blocked or offline')); };
    document.head.append(s);
  });
  // a failure is not cached forever: a later darshan visit may try again
  apiPromise.catch(() => (apiPromise = null));
  return apiPromise;
}

// ------------------------------------------------------------ pure helpers (unit tested)

const VIDEO_ID = /^[\w-]{11}$/;

/** the recorded videos to try, in order: the trust's own channels first, then broadcasters */
export function youtubeVideos(list: AartiYouTube[] | undefined): AartiYouTube[] {
  const rec = (list ?? []).filter((v) => v && v.kind !== 'live' && !!v.videoId && VIDEO_ID.test(v.videoId));
  return [...rec.filter((v) => v.official), ...rec.filter((v) => !v.official)];
}

/** the channel's live stream, offered as a "Live now" link */
export function youtubeLive(list: AartiYouTube[] | undefined): AartiYouTube | null {
  return (list ?? []).find((v) => v?.kind === 'live' && (!!v.channelId || !!v.videoId)) ?? null;
}

export function liveUrl(v: AartiYouTube): string {
  if (v.videoId) return `https://www.youtube.com/watch?v=${v.videoId}`;
  return v.url ?? `https://www.youtube.com/channel/${v.channelId}/live`;
}

/** proximity × duck × master volume -> player volume 0..100 */
export function ytVolume(near: number, duck: number, master: number): number {
  const v = Math.round(100 * near * duck * master);
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

/** exponential approach, the same curve as AudioParam.setTargetAtTime */
export function approach(cur: number, target: number, dt: number, tau: number): number {
  return target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);
}

/** where to seek to keep looping the aarti portion, or null to keep playing */
export function loopSeek(t: number, start = 0, end?: number): number | null {
  if (end !== undefined && end > start && t >= end - 0.25) return start;
  return null;
}

/** onError codes: 2 bad id, 5 HTML5 error, 100 removed/private, 101 & 150 embedding disabled */
export function errorText(code: number): string {
  if (code === 101 || code === 150) return 'embedding disabled by the owner';
  if (code === 100) return 'video removed or private';
  if (code === 2) return 'invalid video id';
  if (code === 5) return 'HTML5 player error';
  return `error ${code}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ------------------------------------------------------------ the player

export interface YouTubeHooks {
  /** nothing playable: fall back to the synthesized ambience */
  failed: (why: string) => void;
  /** the playing video changed (chip text) */
  changed: () => void;
}

/** per-temple tuning of how the aarti shares the air (see StoryManager: CALM_AUDIO) */
export interface YouTubeOptions {
  /** level while a story is narrated (default DUCK_LEVEL); 0 = the aarti falls silent under the voice */
  duck?: number;
  /** seconds out of earshot before the video pauses (default QUIET_STOP); long = no re-buffering on return */
  quietStop?: number;
  /** send volume changes at most ~10× a second, in steps (default: every change) */
  smooth?: boolean;
}

export class YouTubeAarti {
  /** the panel: the (hidden by default) video, watch / tap-to-play / live buttons and the attribution */
  readonly el: HTMLElement;
  private host: HTMLElement;
  private player: YTPlayer | null = null;
  private idx = 0;
  private ready = false;
  private dead = false;
  /** we want it playing (the pilgrim is within earshot) */
  private want = false;
  private playing = false;
  private blocked = false;
  private askedAt = 0;
  private quietFor = 0;
  private near = 0;
  private duck = 1;
  private duckTarget = 1;
  private volume = -1;
  private pollAcc = 0;
  private readyTimer = 0;
  private offline = () => this.fail('offline');
  /** last error, for the debug handle */
  lastError = '';
  state = -2;
  private hiddenByUser = false;
  private volAt = 0;

  constructor(private videos: AartiYouTube[], private live: AartiYouTube | null, private hooks: YouTubeHooks, private opts: YouTubeOptions = {}) {
    const el = (this.el = document.createElement('div'));
    // YouTube's embed rules don't allow a hidden / audio-only player: the video shows while it plays,
    // and hiding it pauses the aarti
    el.className = 'yt show';
    el.innerHTML = `
      <div class="yt-frame" aria-hidden="false"><div></div></div>
      <div class="yt-bar">
        <button class="ghost watch" aria-expanded="true" title="Pause and hide the aarti">✕</button>
        <button class="tap" hidden>▶ tap to play aarti</button>
        ${live ? `<a class="live" href="${esc(liveUrl(live))}" target="_blank" rel="noopener" title="${esc(live.title)}">● Live now</a>` : ''}
      </div>
      <small class="via"></small>`;
    this.host = el.querySelector('.yt-frame > div')!;
    el.querySelector('.watch')!.addEventListener('click', (e) => this.toggleWatch((e.currentTarget as HTMLElement)));
    el.querySelector('.tap')!.addEventListener('click', () => this.resume());
    this.renderVia();
    window.addEventListener('offline', this.offline);
    if (!videos.length) {
      queueMicrotask(() => this.fail('no embeddable video'));
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      queueMicrotask(() => this.fail('offline'));
      return;
    }
    loadYouTubeApi().then((YT) => this.create(YT), (e: Error) => this.fail(e.message));
  }

  get current(): AartiYouTube {
    return this.videos[Math.min(this.idx, this.videos.length - 1)];
  }

  /** playing and loud enough to be heard here (a story should not start over it) */
  get audible() {
    return !this.dead && this.playing && this.near * this.duckTarget > 0.25;
  }

  get isPlaying() {
    return this.playing;
  }

  setDuck(on: boolean) {
    this.duckTarget = on ? (this.opts.duck ?? DUCK_LEVEL) : 1;
  }

  /** proximity 0..1, dt in s, master 0..1 (volume slider × mute) */
  update(proximity: number, dt: number, master: number) {
    if (this.dead) return;
    this.near = approach(this.near, proximity, dt, NEAR_TAU);
    this.duck = approach(this.duck, this.duckTarget, dt, DUCK_TAU);
    if (proximity > 0.001) {
      this.quietFor = 0;
      if (!this.want) { this.want = true; this.play(); }
    } else if (this.want && (this.quietFor += dt) > (this.opts.quietStop ?? QUIET_STOP)) {
      this.want = false;
      this.pause();
    }
    const p = this.ready ? this.player : null;
    if (!p) return;
    const v = ytVolume(this.near, this.duck, master);
    // (each setVolume is a message into the player's frame: with `smooth`, a few a second, in small steps,
    // but always the exact value at silence and at full)
    const now = performance.now();
    const send = !this.opts.smooth || v === 0 || v === 100 || (Math.abs(v - this.volume) >= 3 && now - this.volAt > 100);
    if (v !== this.volume && send) {
      this.volume = v;
      this.volAt = now;
      try { p.setVolume(v); } catch { /* player gone */ }
    }
    if ((this.pollAcc += dt) < 0.25) return;
    this.pollAcc = 0;
    // keep the aarti portion looping (the ENDED event covers `end` too; this catches a manual seek past it)
    const cur = this.current;
    try {
      if (this.playing) {
        const seek = loopSeek(p.getCurrentTime(), cur.start, cur.end);
        if (seek !== null) p.seekTo(seek, true);
      }
    } catch { /* ignore */ }
    if (this.want && !this.playing && !this.blocked && this.askedAt && performance.now() - this.askedAt > BLOCKED_AFTER) {
      this.setBlocked(true);
    }
  }

  /** another recording takes the panel (a place's own aarti, out of earshot of this one): stop now, not after the quiet wait */
  yieldPanel() {
    if (this.dead || !this.want || this.audible) return;
    this.want = false;
    this.quietFor = 0;
    this.pause();
  }

  /** after a user gesture: try again (autoplay was blocked) */
  resume() {
    if (this.dead || !this.want) return;
    this.play();
  }

  /** give up on YouTube: the caller falls back to the synthesized aarti */
  fail(why: string) {
    if (this.dead) return;
    this.lastError = why;
    this.dispose();
    this.hooks.failed(why);
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.readyTimer);
    window.removeEventListener('offline', this.offline);
    try { this.player?.destroy(); } catch { /* ignore */ }
    this.player = null;
    this.el.remove();
  }

  debug() {
    return {
      videoId: this.current?.videoId, idx: this.idx, ready: this.ready, state: this.state, playing: this.playing,
      blocked: this.blocked, want: this.want, volume: this.volume, near: +this.near.toFixed(3), duck: +this.duck.toFixed(3),
      time: this.ready ? safe(() => this.player!.getCurrentTime(), -1) : -1, lastError: this.lastError, dead: this.dead,
    };
  }

  // ------------------------------------------------------------ internals

  private create(YT: YTNamespace) {
    if (this.dead) return;
    const v = this.current;
    this.readyTimer = window.setTimeout(() => { if (!this.ready) this.fail('player never became ready'); }, READY_TIMEOUT);
    try {
      this.player = new YT.Player(this.host, {
        host: 'https://www.youtube-nocookie.com',
        width: PLAYER_W,
        height: PLAYER_H,
        videoId: v.videoId,
        playerVars: {
          start: v.start ? Math.floor(v.start) : undefined,
          end: v.end ? Math.ceil(v.end) : undefined,
          autoplay: 0, controls: 1, rel: 0, playsinline: 1, fs: 0, iv_load_policy: 3, disablekb: 1,
          origin: location.origin,
        },
        events: {
          onReady: () => this.onReady(),
          onStateChange: (e: { data: number }) => this.onState(e.data),
          onError: (e: { data: number }) => this.onError(e.data),
        },
      });
    } catch (e) {
      this.fail(`player: ${(e as Error).message}`);
      return;
    }
    // the player replaced the host div with its iframe: give it a title and the autoplay permission
    const f = this.el.querySelector('iframe');
    if (f) {
      f.title = `${v.title} · ${v.channel} (YouTube)`;
      f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    }
  }

  private onReady() {
    if (this.dead) return;
    clearTimeout(this.readyTimer);
    this.ready = true;
    this.volume = -1; // pushed on the next update
    if (this.want) this.play();
  }

  private onState(s: number) {
    if (this.dead) return;
    this.state = s;
    this.playing = s === YTState.PLAYING || s === YTState.BUFFERING;
    if (s === YTState.PLAYING) this.setBlocked(false);
    if (s === YTState.ENDED && this.want) {
      // the end of the aarti portion: loop it
      const v = this.current;
      try { this.player?.seekTo(v.start ?? 0, true); this.player?.playVideo(); } catch { /* ignore */ }
    }
    if (s === YTState.PAUSED && this.want && !this.blocked && this.ready && !this.hiddenByUser) {
      // paused by the visitor in the player: respect it (the tap button resumes)
      this.setBlocked(true);
    }
  }

  private onError(code: number) {
    if (this.dead) return;
    this.lastError = `${this.current.videoId}: ${errorText(code)} (${code})`;
    console.info(`[aarti] YouTube ${this.lastError}`);
    // try the next video, if any
    if (this.idx + 1 < this.videos.length && this.player) {
      this.idx++;
      const v = this.current;
      this.renderVia();
      this.hooks.changed();
      const o = { videoId: v.videoId!, startSeconds: v.start, endSeconds: v.end };
      try {
        if (this.want) { this.player.loadVideoById(o); this.askedAt = performance.now(); }
        else this.player.cueVideoById(o);
      } catch { this.fail(this.lastError); }
      return;
    }
    this.fail(this.lastError);
  }

  private play() {
    if (!this.ready || !this.player || this.hiddenByUser) return;
    this.askedAt = performance.now();
    try { this.player.playVideo(); } catch { /* ignore */ }
  }

  private pause() {
    this.askedAt = 0;
    this.setBlocked(false);
    if (!this.ready || !this.player) return;
    try { this.player.pauseVideo(); } catch { /* ignore */ }
  }

  private setBlocked(on: boolean) {
    this.blocked = on;
    const tap = this.el.querySelector<HTMLButtonElement>('.tap');
    if (tap) tap.hidden = !on;
  }

  private toggleWatch(btn: HTMLElement) {
    const on = this.el.classList.toggle('show');
    btn.textContent = on ? '✕' : '▶ aarti';
    btn.setAttribute('aria-expanded', String(on));
    this.el.querySelector('.yt-frame')!.setAttribute('aria-hidden', String(!on));
    // no audio-only playback: hiding the video pauses it, showing it resumes
    this.hiddenByUser = !on;
    if (on && this.want) this.play();
    else if (!on) { try { this.player?.pauseVideo(); } catch { /* ignore */ } }
    btn.blur();
  }

  private renderVia() {
    const v = this.current;
    const via = this.el.querySelector('.via');
    if (!via || !v) return;
    const watch = v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}${v.start ? `&t=${Math.floor(v.start)}s` : ''}` : v.channelUrl;
    via.innerHTML = `Aarti courtesy: <a href="${esc(v.channelUrl)}" target="_blank" rel="noopener">${esc(v.channel)}</a>${v.official ? ' (official)' : ''} · <a href="${esc(watch)}" target="_blank" rel="noopener">YouTube</a>`;
  }
}

function safe<T>(f: () => T, d: T): T {
  try { return f(); } catch { return d; }
}

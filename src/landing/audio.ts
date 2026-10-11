/**
 * The landing's sound — on by default. It starts as the page opens where the browser allows, and
 * otherwise on the first tap, click or key (browsers hold audio back until then).
 *  - Music slot: if public/audio/landing/theme.mp3 (or .m4a) is deployed, it loops gently (~0.5),
 *    fading in over 2 s, ducking under the opening's captions and fading out on Enter.
 *  - Otherwise, on loop, mridangam and damaru (see music.ts), with a brass ghanta at the bindu and at
 *    the transition (WebAudio only, no recordings).
 * Muting lasts for this visit only, so every new visit opens with the sound on.
 */
import { Drums } from './music';

const MUTE_KEY = 'divya-yatra.landing.muted';
const THEME_URLS = ['audio/landing/theme.mp3', 'audio/landing/theme.m4a'];
const MUSIC_VOL = 0.5;
const DRONE_VOL = 0.12;

async function findTheme(): Promise<string | null> {
  for (const url of THEME_URLS) {
    try {
      // a one-byte GET, not HEAD: Vite's dev server answers HEAD with its HTML fallback even for a
      // real file. A missing file may come back as HTML too, so only a real audio file counts.
      const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')) return url;
    } catch {
      /* offline or blocked: try the next, then fall back to the synth */
    }
  }
  return null;
}

export class LandingAudio {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: GainNode | null = null; // music or drone level (ducking)
  private verb: ConvolverNode | null = null;
  private music: HTMLAudioElement | null = null;
  private synth = false;
  private started = false;
  private theme = findTheme();
  /** resolves to the recorded theme's URL when one is deployed (it then plays instead of the synthesized music) */
  readonly themeFound = this.theme;
  private bellTimer = 0;
  private drums: Drums | null = null;
  onChange: () => void = () => {};

  constructor() {
    let m = false;
    try {
      m = sessionStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* no storage */
    }
    this.muted = m;
  }

  get playing() {
    return this.started && !this.muted;
  }

  /** call from a user gesture */
  async start() {
    if (this.muted) return;
    if (this.started) {
      // already set up but held back by the browser: a gesture lets it run now
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      if (this.music?.paused) void this.music.play().catch(() => {});
      return;
    }
    this.started = true;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    void ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // a gentle limiter so the drum peaks never clip
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -8;
    lim.knee.value = 6;
    lim.ratio.value = 6;
    lim.attack.value = 0.004;
    lim.release.value = 0.25;
    this.master.connect(lim).connect(ctx.destination);
    this.bed = ctx.createGain();
    this.bed.connect(this.master);
    this.onChange();
    const url = await this.theme;
    if (url) {
      const a = (this.music = new Audio(url));
      a.loop = true;
      a.crossOrigin = 'anonymous';
      ctx.createMediaElementSource(a).connect(this.bed);
      this.bed.gain.value = MUSIC_VOL;
      try {
        await a.play();
      } catch {
        this.music = null;
      }
    }
    if (!this.music) this.startSynth(ctx);
    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.7); // ≈2 s fade in
  }

  toggle() {
    this.muted = !this.muted;
    try {
      sessionStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* no storage */
    }
    if (!this.started) {
      if (!this.muted) void this.start();
    } else if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, this.muted ? 0.15 : 0.6);
      if (this.music) void (this.muted ? this.music.pause() : this.music.play().catch(() => {}));
      if (!this.muted) void this.ctx.resume();
    }
    this.onChange();
  }

  /** lower the bed under a caption (on = true) and bring it back */
  duck(on: boolean) {
    if (!this.ctx || !this.bed) return;
    const base = this.music ? MUSIC_VOL : DRONE_VOL;
    this.bed.gain.setTargetAtTime(on ? base * 0.7 : base, this.ctx.currentTime, 0.4);
  }

  /** fade everything out (Enter) */
  fadeOut(ms = 900) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, ms / 3000);
    clearTimeout(this.bellTimer);
    this.drums?.stop();
  }

  /**
   * A struck brass ghanta (synth mode only — music has its own voice): a deep hum, the strike tone and a few
   * inharmonic partials, each pair slightly detuned so the bell beats slowly as it dies away.
   */
  bell(freq = 98, vol = 0.22) {
    if (!this.synth || !this.ctx || !this.master || !this.playing) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    out.connect(tone).connect(this.master);
    if (this.verb) {
      const send = ctx.createGain();
      send.gain.value = 0.7;
      tone.connect(send).connect(this.verb);
    }
    // ratio, amplitude, decay (s)
    const partials: [number, number, number][] = [[0.5, 0.55, 9], [1, 1, 7], [1.19, 0.35, 5], [1.5, 0.3, 4], [2.0, 0.28, 3.2], [2.74, 0.16, 2.2], [3.9, 0.07, 1.2]];
    for (const [ratio, amp, dec] of partials) {
      for (const det of [-0.0016, 0.0016]) {
        const o = ctx.createOscillator();
        o.frequency.value = freq * ratio * (1 + det);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dec + 0.1);
      }
    }
  }

  private startSynth(ctx: AudioContext) {
    this.synth = true;
    this.bed!.gain.value = DRONE_VOL;
    // a stone hall for the bell
    const len = ctx.sampleRate * 4.5;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.verb.connect(wet).connect(this.master!);
    const nlen = ctx.sampleRate;
    const noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    const drySend = ctx.createGain();
    drySend.gain.value = 0.25;
    this.bed!.connect(drySend).connect(this.verb);
    this.drums = new Drums(ctx, this.master!, this.verb, noise);
    void this.drums.start(ctx.currentTime + 0.3);
  }
}

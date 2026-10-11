import type { AartiAudio } from './types';

/**
 * The aarti at the Jyotirlinga, as positional sound: it comes from the lingam, swells as you approach the
 * darshan spot, loops while you stay and fades away as you leave.
 *
 * Source: the temple's own recording from the stories JSON when its licence allows it (CC0, CC-BY or public
 * domain); otherwise an aarti ambience synthesized here from sounds we can freely use: the hand-rung ghanti,
 * the big temple ghanta, shankh (conch) blasts, damaru rolls, nagara/dhol beats and jhanj cymbals.
 */

/** licences we may stream: CC0, CC-BY (no NC/ND/SA) and public domain */
export function usableLicense(license: string | undefined): boolean {
  if (!license) return false;
  const l = license.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (/\b(nc|nd|sa)\b|non.?commercial|no.?deriv|share.?alike|all rights reserved|copyright/.test(l)) return false;
  return /(^|\b)(cc0|cc ?zero|public domain|pdm|cc.?by|creative commons attribution)\b|^pd\b/.test(l);
}

/** the first recording we may play: an open licence, or one the site owner chose to use (credited on screen) */
export function pickAudio(list: AartiAudio[] | undefined, base = ''): AartiAudio | null {
  const a = list?.find((a) => a.url && (usableLicense(a.license) || !!a.permission));
  if (!a) return null;
  return /^[a-z]+:|^\//i.test(a.url) ? a : { ...a, url: base + a.url };
}

/** the aarti's level while a story is narrated, and how fast it ducks / follows proximity (time constants, s) */
export const DUCK_LEVEL = 0.28;
export const DUCK_TAU = 0.4;
export const NEAR_TAU = 0.5;
/** seconds out of earshot before the aarti stops */
export const QUIET_STOP = 3;
/** a recording: a quick fade, then it pauses where it is (and picks up there next time, even after a reload) */
const REC_TAU = 0.12;
const REC_STOP = 0.5;
const POS_KEY = 'aarti-pos:';

const LOOKAHEAD = 0.6; // s of events scheduled ahead
const BPM = 104;

function load(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode: start from the top next time */ }
}

export class AartiPlayer {
  private ctx: AudioContext;
  /** everything the aarti makes goes here, then through the panner */
  private bus: GainNode;
  private panner: PannerNode;
  private near: GainNode; // proximity fade
  private duck: GainNode; // lowered while a story is narrated
  private noise: AudioBuffer;
  private el: HTMLAudioElement | null = null;
  private running = false;
  private nextBeat = 0;
  private beat = 0;
  private quietFor = 0;
  /** the recording failed (CORS, 404...): fall back to the synthesized ambience */
  private fileFailed = false;
  level = 0;

  /**
   * `steady`: a slow frame never bunches the beats up (missed beats are skipped, not crammed in at once) and
   * the panning is the cheap equal-power kind (no HRTF convolution competing with the renderer)
   */
  constructor(ctx: AudioContext, out: AudioNode, private file: AartiAudio | null, private steady = false) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = file ? 0.9 : 0.55;
    this.panner = new PannerNode(ctx, {
      panningModel: steady ? 'equalpower' : 'HRTF', distanceModel: 'inverse', refDistance: 3, rolloffFactor: 0.9, maxDistance: 80,
    });
    this.near = ctx.createGain();
    this.near.gain.value = 0;
    this.duck = ctx.createGain();
    this.bus.connect(this.panner).connect(this.near).connect(this.duck).connect(out);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  get usingFile() {
    return !!this.file && !this.fileFailed;
  }

  /** dev/testing: the recording's state */
  get recording() {
    return this.el ? { src: this.el.src.split('/').pop(), paused: this.el.paused, t: Math.round(this.el.currentTime), ready: this.el.readyState } : null;
  }

  /** the recording is actually heard (playing, near enough, not silenced for a story) */
  get audible() {
    return this.usingFile && this.running && !!this.el && !this.el.paused && this.level * this.duck.gain.value > 0.25;
  }

  setSource(x: number, y: number, z: number) {
    const t = this.ctx.currentTime;
    this.panner.positionX.setValueAtTime(x, t);
    this.panner.positionY.setValueAtTime(y, t);
    this.panner.positionZ.setValueAtTime(z, t);
  }

  /** current duck gain (1 = full, ~0.28 while a story is narrated) */
  get duckLevel() {
    return this.duck.gain.value;
  }

  setDuck(on: boolean) {
    // steady: a recording falls silent under a story (two voices at once clash) rather than ducking
    const low = this.steady && this.usingFile ? 0 : DUCK_LEVEL;
    this.duck.gain.setTargetAtTime(on ? low : 1, this.ctx.currentTime, DUCK_TAU);
  }

  /** proximity 0..1 (0 = out of earshot): starts, fades and stops the aarti */
  update(proximity: number, dt: number) {
    this.level = proximity;
    const rec = this.usingFile;
    this.near.gain.setTargetAtTime(proximity, this.ctx.currentTime, rec ? REC_TAU : NEAR_TAU);
    if (proximity > 0.001) {
      this.quietFor = 0;
      if (!this.running) this.begin();
    } else if (this.running && (this.quietFor += dt) > (rec ? REC_STOP : QUIET_STOP)) {
      this.end();
    }
    if (this.running && !this.usingFile) this.schedule();
  }

  private begin() {
    this.running = true;
    if (this.usingFile) {
      if (!this.el) {
        const el = (this.el = new Audio());
        el.crossOrigin = 'anonymous';
        el.loop = true;
        el.preload = 'auto';
        el.src = this.file!.url;
        // carry on from where this browser left off
        const key = POS_KEY + this.file!.url;
        const saved = Number(load(key));
        el.addEventListener('loadedmetadata', () => {
          if (saved > 0 && saved < el.duration - 1) el.currentTime = saved;
        }, { once: true });
        let lastSave = 0;
        const save = () => { if (el.currentTime > 0) store(key, el.currentTime.toFixed(1)); };
        el.addEventListener('pause', save);
        el.addEventListener('timeupdate', () => {
          const now = performance.now();
          if (now - lastSave > 2000) { lastSave = now; save(); }
        });
        addEventListener('pagehide', save);
        el.addEventListener('error', () => {
          this.fileFailed = true;
          this.bus.gain.value = 0.55;
          if (this.running) this.restartSynth();
        });
        try {
          this.ctx.createMediaElementSource(el).connect(this.bus);
        } catch {
          this.fileFailed = true;
        }
      }
      if (!this.fileFailed) {
        void this.el.play().catch(() => {});
        return;
      }
    }
    this.restartSynth();
  }

  private restartSynth() {
    this.beat = 0;
    this.nextBeat = this.ctx.currentTime + 0.1;
  }

  private end() {
    this.running = false;
    this.el?.pause();
  }

  stop() {
    this.end();
    this.near.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------ synthesized aarti

  /**
   * A 48-beat cycle: three shankh blasts open it, then the nagara keeps the beat, the damaru rolls,
   * the jhanj answers on the off-beats, the ghanti rings continuously and the big ghanta strikes every bar.
   */
  private schedule() {
    const spb = 60 / BPM;
    // after a stall (a long frame), skip the beats that are already past instead of playing them all at once
    if (this.steady && this.nextBeat < this.ctx.currentTime - 0.05) {
      const missed = Math.ceil((this.ctx.currentTime - this.nextBeat) / spb);
      this.nextBeat += missed * spb;
      this.beat += missed;
    }
    while (this.nextBeat < this.ctx.currentTime + LOOKAHEAD) {
      const t = this.nextBeat, b = this.beat % 48;
      if (b === 0) { this.shankh(t, 3.2); this.shankh(t + 4 * spb, 2.4); this.shankh(t + 8 * spb, 3.6); }
      const playing = b >= 4;
      if (playing) {
        // nagara: dha on 1 and 3, a lighter stroke on 4
        if (b % 4 === 0) this.drum(t, 1);
        else if (b % 4 === 2) this.drum(t, 0.7);
        else if (b % 4 === 3) this.drum(t + spb / 2, 0.35);
        // jhanj on the off-beats
        this.jhanj(t + spb / 2, 0.5);
        // damaru: a quick roll every other bar
        if (b % 8 === 6) for (let k = 0; k < 6; k++) this.damaru(t + (k * spb) / 6, 0.6 - k * 0.05);
      }
      // the ghanti never stops: the clapper swings twice a beat, a touch uneven like a hand
      this.ghanti(t + Math.random() * 0.02, 1);
      this.ghanti(t + spb / 2 + Math.random() * 0.03, 0.8);
      // the big ghanta every bar
      if (b % 4 === 0) this.ghanta(t + 0.01, b % 16 === 0 ? 1 : 0.6);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private partials(t: number, base: number, list: [number, number, number][], vol: number) {
    for (const [ratio, amp, decay] of list) {
      const o = this.ctx.createOscillator();
      o.frequency.value = base * ratio;
      const g = this.env(t, amp * vol, 0.004, decay);
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }

  /** small brass hand bell rung by the priest */
  private ghanti(t: number, vol: number) {
    this.partials(t, 1480 * (0.99 + Math.random() * 0.02), [[1, 0.09, 0.7], [2.32, 0.05, 0.45], [4.1, 0.03, 0.25]], vol);
  }

  /** the big temple bell */
  private ghanta(t: number, vol: number) {
    this.partials(t, 392, [[0.5, 0.2, 4], [1, 0.22, 3.2], [2.01, 0.12, 2.4], [2.76, 0.09, 1.8], [5.4, 0.05, 0.9]], vol);
  }

  /** conch: a reedy tone with a slow swell, a slight upward bend and breath noise */
  private shankh(t: number, dur: number) {
    const ctx = this.ctx;
    const f0 = 311;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.5);
    g.gain.setValueAtTime(0.16, t + dur - 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 900;
    formant.Q.value = 1.4;
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 2400;
    formant.connect(body).connect(g).connect(this.bus);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibG = ctx.createGain();
    vibG.gain.value = 3;
    vib.connect(vibG);
    for (const [mult, amp] of [[1, 0.6], [2, 0.3], [3, 0.12]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * mult * 0.97, t);
      o.frequency.exponentialRampToValueAtTime(f0 * mult, t + 0.6);
      vibG.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(formant);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    vib.start(t);
    vib.stop(t + dur + 0.05);
    const breath = ctx.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const bg = ctx.createGain();
    bg.gain.value = 0.05;
    breath.connect(bg).connect(formant);
    breath.start(t);
    breath.stop(t + dur);
  }

  /** nagara / dhol: a pitched thump falling in pitch, with a skin slap */
  private drum(t: number, vol: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
    const g = this.env(t, 0.5 * vol, 0.004, 0.45);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.5);
    this.noiseHit(t, 'bandpass', 1200, 0.08 * vol, 0.05);
  }

  /** damaru: small two-headed drum, quick bright taps */
  private damaru(t: number, vol: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    const g = this.env(t, 0.16 * vol, 0.002, 0.1);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.12);
    this.noiseHit(t, 'bandpass', 2600, 0.06 * vol, 0.04);
  }

  /** jhanj: small hand cymbals */
  private jhanj(t: number, vol: number) {
    this.noiseHit(t, 'highpass', 6000, 0.05 * vol, 0.28);
    this.partials(t, 3100, [[1, 0.02, 0.3], [1.48, 0.015, 0.22]], vol);
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, vol: number, decay: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    const g = this.env(t, vol, 0.002, decay);
    src.connect(filt).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }
}

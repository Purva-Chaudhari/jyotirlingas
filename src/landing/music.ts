/**
 * The landing's drums, synthesized (WebAudio only, no recordings) and looped forever: mridangam and damaru
 * in a keherwa groove (≈ 94 bpm) that breaks into a fast nati for the climax.
 *  - mridangam: keherwa (8 matras: dha ge na ti | na ka dhi na) with fills into each section, then a fast
 *    six for the climax and a tihai onto sam;
 *  - damaru: rolls gathering speed into each section.
 * The drums sway gently from side to side through an HRTF panner (best on headphones).
 * One turn (≈ 96 s): a soft groove → damaru → the groove at full strength, with fills → a damaru roll into
 * the nati climax → tihai → sam → two bars of groove, then again.
 */

/** the mridangam's tonic (the drum's Sa, ≈ A#2) */
const SA = 115.85;
/**
 * The tone of the whole piece, matched by ear-free measurement to a rudra veena + mridangam recording we
 * admire ("Rudra Veena — The Sound Lord Shiva Played Before Time Began"): its long-term spectrum in
 * half-octave bands against ours, the difference applied as an EQ ([Hz, dB]). Nothing of that recording
 * is used — only the shape of its tonal balance: a deep sub, clean low-mids, presence and air on top.
 */
const TONE: [number, number][] = [[50, 4.0], [71, 3.3], [100, -3.5], [141, -1.2], [200, -11.1], [283, -8.5], [400, 0.6], [566, 12.0], [800, 7.5], [1131, 3.4], [1600, 3.4], [2263, 6.2], [3200, 7.1], [4525, 7.0], [6400, 12.0], [9051, 8.0]];
const DRUM_ORBIT = 22;
/** one matra of the keherwa (s): eight to a 2.56 s bar, ≈ 94 bpm counting two to a beat */
const MATRA = 0.32;
/** one matra of the climax's fast six (s): six to a 0.9 s cycle */
const FAST = 0.15;
/** the groove's length in keherwa bars, and the bars that are fills (each leads into a new section) */
const GROOVE_BARS = 27;
const GROOVE_FILLS = new Set([3, 12, 14, 26]);
/** the climax's length in nati cycles */
const NATI_CYCLES = 22;

/**
 * The mridangam, two slots to a matra. M dheem (thom + din), D din, N nam, C chapu, T ta, K ki,
 * O thom, U gumki (thom bending up); lower case = soft.
 * KEHERWA: dha ge na ti | na ka dhi na, sixteen slots; NATI: the climax's fast six, twelve slots.
 */
// the groove, as measured on the crisper rudra veena + mridangam recording: a stroke on every beat
// (the bass on 1), a bass push just before beat 2, and the bright ta on the offbeats of beats 2 and 4
const KEHERWA = [
  'M . . o N . T . D . . . D . T .',
  'M . k o N . T . D . k . D . T k',
  'M . . o N . T . D . . . U . T .',
  'M . k o N . T k D . k t D . T k',
];
const KEHERWA_FILL = 'M . T K D . T K D . T K T K T K';
const NATI = ['M . N k O . M k N . O k', 'M k N k O k M k N k T K'];
const NATI_FILL = 'T K D T K D T K D . . .';

type Ev = [number, (t: number) => void];

export class Drums {
  private ctx: AudioContext;
  private noise: AudioBuffer;
  private drum: GainNode;
  private timer = 0;
  private stopped = false;

  constructor(ctx: AudioContext, dest: AudioNode, verbIn: AudioNode | null, noise: AudioBuffer) {
    // the whole piece — and what it sends to the hall — through one tone-matching EQ (see TONE)
    const tone = (to: AudioNode) => {
      let head: AudioNode = to;
      for (const [f, gain] of [...TONE].reverse()) {
        const b = ctx.createBiquadFilter();
        b.type = 'peaking';
        b.frequency.value = f;
        b.Q.value = 1.4;
        b.gain.value = gain;
        b.connect(head);
        head = b;
      }
      return head;
    };
    const out = tone(dest);
    const verb = verbIn && tone(verbIn);
    this.ctx = ctx;
    this.noise = noise;
    // a source moving on a circle around the listener (one turn in `period` s, `dir` ±1), its height
    // drifting a little — or, with `front`, staying ahead and swaying `radius` m side to side;
    // StereoPanner sweeping side to side where 3D panning isn't there
    const cosine = ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]));
    const orbit = (radius: number, period: number, dir: number, front = false): AudioNode => {
      const lfo = (wave: PeriodicWave | null, depth: number, rate = 1 / period) => {
        const o = ctx.createOscillator();
        if (wave) o.setPeriodicWave(wave);
        o.frequency.value = rate;
        const d = ctx.createGain();
        d.gain.value = depth;
        o.connect(d);
        o.start();
        return d;
      };
      const p = ctx.createPanner();
      if (!p.positionX) {
        const sp = ctx.createStereoPanner();
        lfo(null, (front ? 0.3 : 0.8) * dir).connect(sp.pan);
        sp.connect(out);
        return sp;
      }
      p.panningModel = 'HRTF';
      p.rolloffFactor = 0; // the same loudness all the way round: only the direction moves
      p.positionX.value = 0;
      p.positionY.value = 0;
      p.positionZ.value = 0;
      lfo(null, radius * dir).connect(p.positionX);
      if (front) p.positionZ.value = -1;
      else {
        lfo(cosine, -radius).connect(p.positionZ);
        lfo(null, radius * 0.25, 1 / (period * 1.7)).connect(p.positionY);
      }
      p.connect(out);
      return p;
    };
    const bus = (vol: number, wet: number, spin?: [number, number, number, boolean?]) => {
      const g = ctx.createGain();
      g.gain.value = vol;
      g.connect(spin ? orbit(...spin) : out);
      if (verb && wet) {
        const s = ctx.createGain();
        s.gain.value = wet;
        g.connect(s).connect(verb);
      }
      return g;
    };
    this.drum = bus(0.28, 0.2, [0.45, DRUM_ORBIT, -1, true]);
  }

  private hiss(t: number, f: number, q: number, vol: number, dec: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    src.connect(bp).connect(g).connect(this.drum);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dec + 0.02);
  }

  /** a decaying mode of a drum skin, optionally bending from `from` × f over `bend` s */
  private mode(t: number, f: number, vol: number, dec: number, from = 1, bend = 0.05) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * from, t);
    if (from !== 1) o.frequency.exponentialRampToValueAtTime(f, t + bend);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(this.drum);
    o.start(t);
    o.stop(t + dec + 0.05);
  }

  /** one mridangam stroke (see KEHERWA); `v` scales it */
  private stroke(s: string, t: number, v: number) {
    const ring = (amps: number[], dec: number) => {
      amps.forEach((a, i) => a && this.mode(t, SA * (i + 1) * (1 + 0.002 * i), 0.22 * v * a, dec / (1 + i * 0.35)));
      this.hiss(t, 3200, 1, 0.16 * v, 0.025); // the finger's crack on the skin
    };
    const thom = (from: number, to: number, bend: number, dec: number) => {
      this.mode(t, to, 0.75 * v, dec, from / to, bend);
      this.mode(t, to * 1.5, 0.12 * v, dec * 0.4, from / to, bend);
      this.hiss(t, 160, 1, 0.18 * v, 0.04);
    };
    switch (s) {
      case 'N': ring([0.6, 1, 0.55, 0.3, 0.12], 0.55); break; // nam: the 2nd mode sings
      case 'D': ring([1, 0.45, 0.25, 0.1, 0], 1.1); break; // din: the open fundamental
      case 'C': ring([0.15, 0.3, 0.6, 1, 0.4], 0.8); break; // chapu: the bright high ring
      case 'T': // ta: a firm stroke damped by the palm
        this.hiss(t, 2600, 1.4, 0.45 * v, 0.045);
        this.hiss(t, 5500, 1, 0.18 * v, 0.02);
        this.mode(t, SA * 2, 0.2 * v, 0.1);
        this.mode(t, SA * 3, 0.08 * v, 0.06);
        break;
      case 'K': // ki: a fingertip tap on the black
        this.hiss(t, 3400, 2.5, 0.24 * v, 0.025);
        this.mode(t, SA * 4, 0.06 * v, 0.04);
        break;
      case 'O': thom(100, 65, 0.08, 0.6); break;
      case 'U': thom(60, 95, 0.32, 0.7); break; // gumki: the heel slides, the pitch rises
      case 'A': this.hiss(t, 300, 1.5, 0.4 * v, 0.05); break;
      case 'M': thom(100, 65, 0.08, 0.7); ring([1, 0.5, 0.3, 0.12, 0], 1.0); break;
    }
  }

  /**
   * Damaru: the beads strike each head in turn — a bright pop (two skin modes, a crack), alternating
   * heads a touch apart in pitch, the gaps closing from `g0` to `g1` as the wrist speeds up.
   */
  private damaru(t: number, secs: number, vol = 0.3, g0 = 0.11, g1 = 0.055) {
    let x = t, i = 0;
    while (x < t + secs) {
      const p = (x - t) / secs;
      const head = i % 2 ? 1.07 : 1;
      const v = vol * (0.55 + 0.45 * p) * (i % 2 ? 0.85 : 1);
      const f = 410 * head * (1 + 0.08 * p);
      this.mode(x, f, v * 0.6, 0.11, 1.12, 0.012);
      this.mode(x, f * 1.59, v * 0.22, 0.06);
      this.hiss(x, 2400, 1.8, v * 0.45, 0.02);
      x += g0 + (g1 - g0) * p;
      i++;
    }
    // the closing double stroke on sam
    this.mode(x, 430, vol * 0.75, 0.16, 1.12, 0.012);
    this.mode(x + 0.07, 460, vol * 0.6, 0.14, 1.12, 0.012);
  }

  /** a bar of mridangam, `slot` s per slot */
  private bar(t: number, pat: string, slot: number, v = 1) {
    const n = pat.split(' ');
    n.forEach((c, i) => {
      if (c === '.') return;
      // a little lilt: the off slots lean late
      const at = t + i * slot + (i % 2 ? slot * 0.07 : 0);
      const accent = i === 0 ? 1.1 : i === n.length / 2 ? 0.9 : 0.7;
      this.stroke(c.toUpperCase(), at, v * accent * (c === c.toLowerCase() ? 0.5 : 1));
    });
  }

  /** one turn of the loop as timed events (s from its start), and its length */
  private score(): [Ev[], number] {
    const ev: Ev[] = [];
    const at = (s: number, fn: (t: number) => void) => ev.push([s, fn]);
    const KB = MATRA * 8; // a keherwa bar
    // the mridangam starts softly and the damaru rolls it up to full strength; a short roll leads into
    // each fill's section
    at(KB * 1.5, (x) => this.damaru(x, KB / 2, 0.26));
    for (const k of GROOVE_FILLS) if (k > 3 && k < GROOVE_BARS - 1) at((k + 1) * KB - KB / 4, (x) => this.damaru(x, KB / 4, 0.2, 0.09, 0.05));
    for (let k = 0; k < GROOVE_BARS; k++) {
      const pat = GROOVE_FILLS.has(k) ? KEHERWA_FILL : KEHERWA[k % 4];
      at(k * KB, (x) => this.bar(x, pat, MATRA / 2, k < 2 ? 0.6 : 1));
    }
    // the climax: a damaru roll, then the fast nati, the drum busier
    const climax0 = GROOVE_BARS * KB;
    at(climax0 - KB / 2, (x) => this.damaru(x, KB / 2, 0.28, 0.08, 0.04));
    const NB = FAST * 6; // a nati cycle
    for (let k = 0; k < NATI_CYCLES; k++) {
      const pat = k % 8 === 7 || k === NATI_CYCLES - 1 ? NATI_FILL : NATI[k % 2];
      at(climax0 + k * NB, (x) => this.bar(x, pat, FAST / 2, 1.05));
    }
    // tihai: dha-ki-ta three times, landing on sam
    const th = climax0 + NATI_CYCLES * NB;
    for (let r = 0; r < 3; r++) at(th + r * NB * 0.75, (x) => this.bar(x, 'T K D . . .', FAST / 2, 1.1));
    const sam = th + NB * 2.25;
    at(sam - 0.6, (x) => this.damaru(x, 0.6, 0.3, 0.07, 0.04));
    // and the groove carries on, straight into the next turn
    at(sam, (x) => this.bar(x, KEHERWA[0], MATRA / 2, 1.25));
    at(sam + KB, (x) => this.bar(x, KEHERWA_FILL, MATRA / 2, 0.9));
    const len = sam + 2 * KB;
    return [ev.sort((a, b) => a[0] - b[0]), len];
  }

  /** play from `start` (s, context time), looping forever */
  async start(start: number) {
    const ctx = this.ctx;
    if (this.stopped) return;
    start = Math.max(start, ctx.currentTime + 0.15);
    const [ev, len] = this.score();
    let base = start, i = 0;
    const tick = () => {
      const horizon = ctx.currentTime + 1.5;
      while (base + ev[i][0] < horizon) {
        const t = base + ev[i][0];
        if (t > ctx.currentTime - 0.05) ev[i][1](t);
        if (++i === ev.length) {
          i = 0;
          base += len;
        }
      }
      this.timer = window.setTimeout(tick, 400);
    };
    tick();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}

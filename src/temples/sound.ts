/**
 * Placeholder soundscape synthesized in the browser, used until real temple
 * recordings are supplied: tanpura-like drone, wind during the descent, a
 * whoosh on the golden flash, and temple bells on arrival.
 */
export class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode;
  private drone!: GainNode;
  /** overall level 0..1 (the volume slider × mute) */
  private level = 1;
  private droneShare = 1;
  private droneBase = 0.5;

  /** the audio context once start() ran (other sounds — the aarti — share it and its master volume) */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get output(): AudioNode | null {
    return this.ctx ? this.master : null;
  }

  /** master volume 0..1 for everything in the soundscape (0 = muted) */
  setLevel(level: number) {
    this.level = level;
    if (this.ctx) this.master.gain.setTargetAtTime(0.9 * level, this.ctx.currentTime, 0.08);
  }

  /** Must be called from a user gesture (autoplay policy). */
  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9 * this.level;
    this.master.connect(ctx.destination);

    // drone: Sa + Pa + upper Sa, detuned saws through a soft low-pass, slow swell
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.6;
    lp.connect(this.drone).connect(this.master);
    const sa = 138.6; // C#3
    for (const [f, g] of [[sa / 2, 0.5], [sa * 0.75, 0.35], [sa, 0.3], [sa * 1.001, 0.25]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g * 0.12;
      o.connect(og).connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    this.drone.gain.linearRampToValueAtTime(0.5 * this.droneShare, ctx.currentTime + 6);

    // wind: looping noise through a band-pass
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    noise.connect(bp).connect(this.wind).connect(this.master);
    noise.start();
  }

  /** 0..1 — louder and brighter as the camera plunges through the atmosphere. */
  setWind(level: number) {
    if (!this.ctx) return;
    this.wind.gain.setTargetAtTime(level * 0.22, this.ctx.currentTime, 0.4);
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    f.frequency.exponentialRampToValueAtTime(200, t + 2.2);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    this.setWind(0);
  }

  /** A temple bell: inharmonic partials with long decays. */
  bell(at = 0, pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const base = 520 * pitch;
    for (const [ratio, amp, decay] of [[1, 0.5, 5], [2.01, 0.3, 3.4], [2.76, 0.22, 2.6], [5.4, 0.12, 1.4], [8.93, 0.06, 0.8]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  arrive() {
    this.whoosh();
    this.bell(1.2, 1);
    this.bell(3.4, 0.84);
    this.bell(6.0, 1);
    this.droneBase = 0.8;
    if (this.ctx) this.drone.gain.setTargetAtTime(0.8 * this.droneShare, this.ctx.currentTime + 1, 2);
  }

  /** the tanpura drone's share 0..1 (lowered under a recorded aarti, whose key it would clash with) */
  setDroneShare(k: number) {
    if (!this.ctx) return;
    this.droneShare = k;
    this.drone.gain.setTargetAtTime(this.droneBase * k, this.ctx.currentTime, 0.6);
  }

  reset() {
    if (!this.ctx) return;
    this.droneBase = 0.5;
    this.drone.gain.setTargetAtTime(0.5 * this.droneShare, this.ctx.currentTime, 1);
  }
}

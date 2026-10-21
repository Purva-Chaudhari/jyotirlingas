import * as THREE from 'three';
import type { TempleWorld } from '../engine/world';
import type { Soundscape } from '../sound';
import type { SiteDef } from '../sites/types';
import { STOPS, DARSHAN, type Anchor } from './anchors';
import { AartiPlayer, pickAudio, usableLicense } from './aarti';
import { unlockMedia } from './unlock';
import { StoryCard } from './card';
import { JYOTIRLINGAS, nextOnYatra } from './catalog';
import { AartiChip, ProgressHud, SoundControls } from './hud';
import { YouTubeAarti, youtubeLive, youtubeVideos } from './youtube';
import { StoryMarkers } from './markers';
import { Guide, type GuideTarget } from './guide';
import { leadAlong, orderGoals, type PathGoal } from './path';
import { Progress, speedLabel } from './progress';
import type { AartiAudio, AartiPlace, AartiYouTube, Bi, Lang, StoryStop, TempleStory } from './types';
import { detectTouch } from '../engine/profile';

/** every src/temples/stories/<id>.json, each its own small lazy chunk */
const FILES = import.meta.glob<TempleStory>('./*.json', { import: 'default' });

export async function loadStory(id: string): Promise<TempleStory | null> {
  const load = FILES[`./${id}.json`];
  if (!load) return null;
  try {
    const s = await load();
    return s && Array.isArray(s.stops) ? s : null;
  } catch {
    return null;
  }
}

/** stop counts of every temple that has stories (for "stories y/z") */
async function storyTotals(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(Object.entries(FILES).map(async ([path, load]) => {
    try {
      const s = await load();
      const id = s?.id ?? path.slice(2, -5);
      if (Array.isArray(s?.stops) && JYOTIRLINGAS.some((j) => j.id === id)) out[id] = s.stops.length;
    } catch { /* skip a broken file */ }
  }));
  return out;
}

const bi = (v: string | Bi | undefined, lang: Lang) => (typeof v === 'string' ? v : v?.[lang] || v?.en || '');

/**
 * Temples whose sound is tuned so nothing clashes or stutters: while the recorded (YouTube) aarti is heard, the
 * tanpura drone fades out and stories wait for a tap instead of starting over it; a story you do start silences
 * the aarti for its length; a short walk away keeps the video playing (silently) so it never re-buffers; the
 * synthesized aarti skips beats after a slow frame instead of bunching them. (Mahakal first, then Kashi; others later.)
 */
const CALM_AUDIO = new Set(['mahakaleshwar', 'kashi-vishwanath']);

/** one schedule entry, whatever shape the content uses ("4:00 AM Bhasma Aarti", {name, time}...) */
function scheduleLine(list: unknown[] | undefined, lang: Lang): string {
  if (!list?.length) return '';
  const fmt = (e: unknown): string => {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>;
      const name = typeof o.name === 'object' ? bi(o.name as Bi, lang) : (o.name ?? o.label ?? o.aarti ?? '') as string;
      const time = (o.time ?? o.at ?? o.when ?? '') as string;
      return [name, time].filter(Boolean).join(' ');
    }
    return '';
  };
  const all = list.map(fmt).filter(Boolean);
  // the aartis themselves, not darshan hours or shows, when the schedule says which are which
  const aartis = all.filter((l) => /aarti|aarati|arati|आरती/i.test(l));
  return (aartis.length ? aartis : all).slice(0, 3).join(' · ');
}

interface Live {
  stop: StoryStop;
  anchor: Anchor | null;
  marker: number;
  inside: boolean;
}

/**
 * Story stops, progress and the aarti for one temple. Works with no story file at all (the other
 * temples): then only darshan/visited tracking, the progress HUD and the generic aarti ambience run.
 */
export class StorySystem {
  readonly progress = new Progress();
  readonly card: StoryCard;
  readonly hud: ProgressHud;
  private chip = new AartiChip();
  private soundCtl: SoundControls;
  private markers: StoryMarkers | null = null;
  private stops: Live[] = [];
  private aarti: AartiPlayer | null = null;
  /** the recorded aarti's element, made now so the first tap can unlock it for iOS (see unlock.ts) */
  private aartiEl = new Audio();
  /** the other recorded aartis (aarti.places: e.g. the Ganga Aarti on the ghat), each with its own element */
  private places: { def: AartiPlace; file: AartiAudio | null; el: HTMLAudioElement; player: AartiPlayer | null }[] = [];
  /** the place whose aarti is heard now (null: the darshan aarti, or none) */
  private placeOn: (typeof this.places)[number] | null = null;
  /** the temple's real aarti on YouTube; null before the darshan spot, and after it failed */
  private yt: YouTubeAarti | null = null;
  /** why YouTube was given up on this visit ('' = not given up): the synthesized aarti plays instead */
  private ytFailed = '';
  private opened = new Set<string>();
  private queued: Live | null = null;
  private acc = 0;
  private active = false;
  private chipOn = false;
  private get calm() { return CALM_AUDIO.has(this.site.id); }
  private speaking = false;
  private quietUntil = 0;
  private p = new THREE.Vector3();
  private guide = new Guide();
  private fwd = new THREE.Vector3();
  private volumeHinted = false;

  constructor(private world: TempleWorld, private site: SiteDef, private sound: Soundscape, readonly story: TempleStory | null) {
    const prog = this.progress;
    this.card = new StoryCard({
      base: import.meta.env.BASE_URL,
      siteId: site.id,
      lang: () => prog.prefs.lang,
      setLang: (l) => { prog.setPref('lang', l); this.hud.render(); this.updateChipText(); document.dispatchEvent(new CustomEvent('langchange', { detail: l })); },
      autoplay: () => prog.prefs.autoplay,
      setAutoplay: (on) => prog.setPref('autoplay', on),
      captions: () => prog.prefs.captions,
      setCaptions: (on) => prog.setPref('captions', on),
      speed: () => prog.prefs.rate,
      setSpeed: (r) => prog.setPref('rate', r),
      volume: () => ({ volume: prog.prefs.volume, muted: prog.prefs.muted }),
      heard: (id) => { prog.mark(site.id, 'heard', id); this.refreshMarkers(); },
      read: (id) => { prog.mark(site.id, 'read', id); this.refreshMarkers(); },
      status: (id) => {
        const t = prog.peek(site.id);
        return { heard: !!t?.heard.includes(id), read: !!t?.read.includes(id) };
      },
      speaking: (on) => { this.speaking = on; this.aarti?.setDuck(on); this.yt?.setDuck(on); for (const pl of this.places) pl.player?.setDuck(on); },
      // a breath between one story ending and a waiting one starting
      ended: () => (this.quietUntil = performance.now() + 1500),
    });
    document.body.append(this.card.el);
    this.hud = new ProgressHud(prog, site.id, () => {});
    this.soundCtl = new SoundControls(
      () => ({ volume: prog.prefs.volume, muted: prog.prefs.muted }),
      (v) => {
        if (v.volume !== undefined) prog.setPref('volume', v.volume);
        if (v.muted !== undefined) prog.setPref('muted', v.muted);
        this.applyVolume();
      },
    );
    this.applyVolume();

    // stops, anchors and markers
    const own = STOPS[site.id] ?? {};
    const fromSite = world.siteStops;
    const anchor = (k: string | undefined): Anchor | undefined => {
      if (!k) return undefined;
      if (own[k]) return own[k];
      const s = fromSite[k];
      return s ? [s.feet[0], s.feet[1], s.feet[2], 3] : undefined;
    };
    const pts: THREE.Vector3[] = [];
    for (const stop of story?.stops ?? []) {
      if (!stop?.id || !stop.text) continue;
      const a = anchor(stop.id) ?? anchor(stop.at?.feature) ?? anchor(stop.at?.zone) ?? null;
      let marker = -1;
      if (a) {
        const [x, y, z] = a;
        const floor = world.groundAt(x, z, y + 0.8);
        pts.push(new THREE.Vector3(x, floor !== null && Math.abs(floor - y) < 3 ? floor : y, z));
        marker = pts.length - 1;
      }
      if (a || stop.at?.zone) this.stops.push({ stop, anchor: a, marker, inside: false });
    }
    if (pts.length) {
      this.markers = new StoryMarkers(pts);
      world.add(this.markers.mesh);
      this.refreshMarkers();
    }
    void storyTotals().then((t) => {
      if (story?.stops.length) t[site.id] = story.stops.length;
      this.hud.setTotals(t);
    });
    for (const l of this.stops) this.card.prefetch(l.stop);
    for (const def of story?.aarti?.places ?? []) {
      this.places.push({ def, file: pickAudio(def.audio, import.meta.env.BASE_URL), el: new Audio(), player: null });
    }

    world.frameHooks.push((dt, t) => this.frame(dt, t));
    window.addEventListener('keydown', (e) => this.key(e));
    // an AudioContext made before any gesture starts suspended: wake it on the first one
    const wake = () => {
      void this.sound.context?.resume().catch(() => {});
      // a gesture may also unblock the YouTube aarti
      this.yt?.resume();
      // and lets the narration and the recorded aarti start by themselves later (iOS Safari)
      this.card.unlock();
      unlockMedia(this.aartiEl);
      for (const pl of this.places) unlockMedia(pl.el);
    };
    // (iOS counts a tap's touchend/click as the gesture, not its pointerdown)
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, wake, { passive: true });
  }

  /** start reacting to the pilgrim (after entering the temple) */
  start() {
    this.active = true;
    this.hud.show(true);
    this.soundCtl.show(true);
    this.guide.show(this.progress.prefs.guide);
    this.volumeHint();
  }

  /** the stories are meant to be heard: ask for sound when it is muted or very low */
  private volumeHint() {
    const { volume, muted } = this.progress.prefs;
    if (this.volumeHinted || (!muted && volume >= 0.35)) return;
    this.volumeHinted = true;
    const hi = this.progress.prefs.lang === 'hi';
    const touch = detectTouch();
    this.hud.toast(muted
      ? (touch
        ? (hi ? '🔊 कथाएँ सुनने के लिए आवाज़ चालू करें' : '🔊 Turn the sound on (top right) to hear the stories')
        : (hi ? '🔊 कथाएँ सुनने के लिए आवाज़ चालू करें · <kbd>M</kbd>' : '🔊 Turn the sound on to hear the stories · press <kbd>M</kbd>'))
      : (hi ? '🔊 कथाएँ सुनने के लिए आवाज़ बढ़ाएँ' : '🔊 Turn the volume up to hear the stories'), 8000);
  }

  private applyVolume() {
    const { volume, muted } = this.progress.prefs;
    this.sound.setLevel(muted ? 0 : volume);
    this.card.applyVolume();
    this.soundCtl?.sync();
  }

  private refreshMarkers() {
    if (!this.markers) return;
    for (const l of this.stops) if (l.marker >= 0) this.markers.setDone(l.marker, this.progress.done(this.site.id, l.stop.id));
  }

  private key(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    switch (e.code) {
      case 'KeyN': {
        // as the touch Story button: a story waiting where you stand (e.g. in the sanctum, with the one you
        // walked in with held for the aarti) is played, not the open card closed
        const waiting = this.queued?.inside && this.queued.stop.id !== this.card.current?.id;
        if (this.card.open && !waiting) return this.card.close();
        return this.openHere();
      }
      case 'KeyK': return this.card.toggle();
      case 'KeyH': return this.card.toggleLang();
      case 'KeyC': return this.card.toggleCaptions();
      case 'BracketLeft':
      case 'BracketRight': {
        const r = this.card.stepSpeed(e.code === 'BracketRight' ? 1 : -1);
        return this.hud.toast(`${this.progress.prefs.lang === 'hi' ? 'कथा की गति' : 'Narration speed'} · ${speedLabel(r)}`, 1500);
      }
      case 'KeyG': {
        this.progress.setPref('guide', !this.progress.prefs.guide);
        return this.guide.show(this.active && this.progress.prefs.guide);
      }
      case 'KeyP': return this.hud.toggle();
      case 'KeyM': {
        this.progress.setPref('muted', !this.progress.prefs.muted);
        return this.applyVolume();
      }
      case 'KeyL': {
        this.progress.setPref('lyrics', !this.progress.prefs.lyrics);
        return this.chip.show(this.chipOn, this.progress.prefs.lyrics);
      }
    }
  }

  /** open the story waiting here, or the one you stand in, or the nearest (N; the touch Story button) */
  private openHere() {
    const l = this.queued ?? this.stops.find((s) => s.inside) ?? this.nearest(25) ?? this.stops.find((s) => s.stop.id === this.card.current?.id);
    if (l) this.openStop(l, false);
    else this.hud.toast(this.stops.length ? 'No story here yet · follow the glowing lotus' : 'Stories for this temple are coming soon');
  }

  /**
   * The touch Story button: play / pause the story being told; with none open, open the one here and play
   * it (a waiting story, when you have walked on to it, takes over).
   */
  storyButton() {
    const waiting = this.queued?.inside && this.queued.stop.id !== this.card.current?.id;
    if (this.card.open && !waiting) {
      if (this.card.playing) this.card.toggle();
      else if (this.card.media.ended || this.card.el.classList.contains('done')) this.card.replay();
      else this.card.toggle();
      return;
    }
    const l = this.queued ?? this.stops.find((s) => s.inside) ?? this.nearest(25) ?? this.stops.find((s) => s.stop.id === this.card.current?.id);
    if (l) { this.opened.add(l.stop.id); if (this.queued === l) this.queued = null; void this.card.show(l.stop, true); }
    else this.openHere();
  }

  /** a story is playing (the touch Story button shows pause) */
  get storyPlaying() {
    return this.card.open && this.card.playing;
  }

  private nearest(max: number): Live | null {
    let best: Live | null = null, bd = max;
    const f = this.world.feet;
    for (const l of this.stops) {
      if (!l.anchor) continue;
      const d = Math.hypot(f.x - l.anchor[0], f.z - l.anchor[2]);
      if (d < bd && Math.abs(f.y - l.anchor[1]) < 4) { bd = d; best = l; }
    }
    return best;
  }

  private openStop(l: Live, arriving: boolean) {
    if (this.queued === l) this.queued = null;
    this.opened.add(l.stop.id);
    const heard = this.progress.peek(this.site.id)?.heard.includes(l.stop.id);
    void this.card.show(l.stop, arriving ? this.progress.prefs.autoplay && !heard : this.progress.prefs.autoplay);
  }


  /** a story is being told at a stop you are still standing in */
  private busy() {
    if (performance.now() < this.quietUntil) return true;
    // the recorded aarti is playing here: a story waits for a tap rather than talking over it
    if (this.calm && (this.yt?.audible || this.aarti?.audible || this.places.some((pl) => pl.player?.audible))) return true;
    const cur = this.stops.find((s) => s.stop.id === this.card.current?.id);
    return this.card.open && this.card.playing && !!cur?.inside;
  }

  private arrive(l: Live) {
    const title = l.stop.title[this.progress.prefs.lang] || l.stop.title.en;
    // a story still being told where you stand is not cut off: the new one waits (N, or when it ends);
    // once you have walked away from it, the story of the place you have reached takes over
    if (!this.opened.has(l.stop.id) && !this.busy()) {
      this.openStop(l, true);
    } else if (this.card.current?.id !== l.stop.id || !this.card.open) {
      if (!this.opened.has(l.stop.id)) this.queued = l;
      this.hud.toast(detectTouch()
        ? `<span class="lotus">✿</span> ${title} · ${this.progress.prefs.lang === 'hi' ? '“कथा” दबाएँ' : 'tap Story'}`
        : `<span class="lotus">✿</span> ${title} · press <kbd>N</kbd>`);
    }
  }

  private frame(dt: number, t: number) {
    this.markers?.update(t);
    if (!this.active) return;
    this.updateAarti(dt);
    // trigger checks ~10× a second are plenty at walking speed
    if ((this.acc += dt) < 0.1) return;
    this.acc = 0;
    this.card.tick();
    // being walked to a place (engine/travel.ts): no story starts on the way; the place's own may on arrival
    if (this.world.travelling) return this.updateGuide();
    const f = this.world.feet, zone = this.world.zone;
    const arrived: Live[] = [];
    for (const l of this.stops) {
      const a = l.anchor;
      const inside = (!!a && Math.hypot(f.x - a[0], f.z - a[2]) < a[3] && Math.abs(f.y - a[1]) < 2.5) || (!!l.stop.at?.zone && zone === l.stop.at.zone);
      if (inside && !l.inside) arrived.push(l);
      l.inside = inside;
    }
    for (const l of arrived) this.arrive(l);
    this.updateGuide();
    // a waiting story starts once you have left the one being told (still standing at the waiting one)
    const q = this.queued;
    if (q && this.opened.has(q.stop.id)) this.queued = null;
    else if (q?.inside && !this.busy()) this.openStop(q, true);
    // darshan: reaching the Jyotirlinga marks the temple visited
    const d = DARSHAN[this.site.id];
    const atDarshan = zone === 'garbhagriha' || (!!d && (d.zones.includes(zone) || (Math.hypot(f.x - d.at[0], f.z - d.at[2]) < d.at[3] && Math.abs(f.y - d.at[1]) < 2.5)));
    if (atDarshan && this.progress.markVisited(this.site.id)) {
      const n = this.progress.visitedCount();
      const next = nextOnYatra((id) => !!this.progress.peek(id)?.visited);
      const after = next ? ` · next: ${next.name.en}` : ' · Dwadasha Jyotirlinga yatra complete';
      this.hud.toast(`<span class="lotus">ॐ</span> Darshan of Shri ${this.site.name.en} · Jyotirlinga ${n}/12${after}`, 7000);
    }
  }

  /**
   * The guide points the way a pilgrim walks: to the next story not yet heard, in the temple's walking
   * order (skipping the one you are standing in), with the darshan spot in its place on the route (and,
   * after darshan, the stop the real route goes to next first: DARSHAN[site].then), then nowhere.
   */
  private updateGuide() {
    if (!this.progress.prefs.guide) return;
    const t = this.progress.peek(this.site.id);
    const heard = new Set(t?.heard ?? []);
    const lang = this.progress.prefs.lang;
    const d = DARSHAN[this.site.id];
    const lord = lang === 'hi' ? `श्री ${this.site.name.hi}` : `Shri ${this.site.name.en}`;
    const unheard: PathGoal[] = this.stops
      .filter((l) => l.anchor && !heard.has(l.stop.id) && !l.inside && !(this.card.open && this.card.current?.id === l.stop.id))
      .map((l) => ({ key: l.stop.id, at: l.anchor as [number, number, number, number] }));
    const goals = orderGoals(unheard, !!t?.visited, d ? { key: '', at: d.at } : null, d?.then);
    // on one of the site's walkable ways (e.g. a stair down to the sanctum): lead along it, to the first goal
    // that lies ahead on it; elsewhere, straight at the first goal
    const led = leadAlong(this.world.guidePaths ?? [], this.world.feet, goals);
    const goal = led?.goal ?? goals[0];
    let target: GuideTarget | null = null;
    if (goal) {
      const l = goal.key ? this.stops.find((x) => x.stop.id === goal.key) : undefined;
      target = {
        title: l ? l.stop.title[lang] || l.stop.title.en : lord,
        x: goal.at[0], z: goal.at[2], darshan: !l,
        ...(led ? { aim: led.aim, dist: led.dist } : {}),
      };
    }
    this.world.camera.getWorldDirection(this.fwd);
    this.guide.update(target, this.world.feet, Math.atan2(this.fwd.x, this.fwd.z), lang);
  }

  // ------------------------------------------------------------ aarti

  private updateAarti(dt: number) {
    const ctx = this.sound.context, out = this.sound.output;
    const d = DARSHAN[this.site.id];
    const cam = this.world.camera;
    cam.getWorldPosition(this.p);
    let proximity: number;
    if (d && this.audioFile() && ctx) {
      // the recording: only inside the sanctum, right by the Jyotirlinga; it stops as soon as you step out
      proximity = d.zones.includes(this.world.zone) ? 1 : 0;
    } else if (d) {
      const [sx, sy, sz] = d.source;
      // floors and ceilings muffle: count height difference triple
      const eff = Math.hypot(this.p.x - sx, (this.p.y - sy) * 3, this.p.z - sz);
      proximity = 1 - THREE.MathUtils.smoothstep(eff, 7, 24);
    } else {
      // temples without stories yet: the ambience inside the sanctum only
      proximity = this.world.zone === 'garbhagriha' ? 0.8 : 0;
    }
    if (!this.aarti && !this.yt && proximity > 0) this.startAarti(ctx, out);
    this.yt?.update(proximity, dt, this.master());
    // the other places' recordings (aarti.places: the Ganga Aarti on the ghat): heard alike all through their
    // zones (the sound follows the listener), each pausing where it is when you leave and picking up there
    let place: (typeof this.places)[number] | null = null;
    if (ctx && out) {
      for (const pl of this.places) {
        if (!pl.file) continue;
        const here = pl.def.zones.includes(this.world.zone) ? 1 : 0;
        if (here && !pl.player) {
          pl.player = new AartiPlayer(ctx, out, pl.file, this.calm, pl.el);
          pl.player.setDuck(this.speaking);
        }
        if (!pl.player) continue;
        pl.player.setSource(this.p.x, this.p.y, this.p.z);
        pl.player.update(here, dt);
        if (here) place = pl;
      }
    }
    // a recording (the sanctum's, or a place's) comes first: a story being told as you walk in waits for it
    this.holdForAarti((!!d && !!this.audioFile() && !!ctx && proximity > 0) || !!place);
    if (place !== this.placeOn) {
      this.placeOn = place;
      this.updateChipText();
    }
    // the drone is in its own key: it gives way to a recorded aarti while that is heard
    if (this.calm) this.sound.setDroneShare(place ? 0.05 : this.yt?.isPlaying || this.aarti?.usingFile ? 1 - 0.95 * proximity : 1);
    if (ctx && (this.aarti || place)) {
      // the listener is the camera
      const l = ctx.listener, fwd = cam.getWorldDirection(new THREE.Vector3()), now = ctx.currentTime;
      if (l.positionX) {
        l.positionX.setValueAtTime(this.p.x, now); l.positionY.setValueAtTime(this.p.y, now); l.positionZ.setValueAtTime(this.p.z, now);
        l.forwardX.setValueAtTime(fwd.x, now); l.forwardY.setValueAtTime(fwd.y, now); l.forwardZ.setValueAtTime(fwd.z, now);
        l.upX.setValueAtTime(0, now); l.upY.setValueAtTime(1, now); l.upZ.setValueAtTime(0, now);
      }
    }
    if (this.aarti && ctx) {
      const src = d?.source ?? [this.p.x, this.p.y, this.p.z];
      this.aarti.setSource(src[0], src[1], src[2]);
      this.aarti.update(proximity, dt);
    }
    if (!this.aarti && !this.yt && !this.places.some((pl) => pl.player)) return;
    const on = proximity > 0.05 || !!place;
    if (on !== this.chipOn) {
      this.chipOn = on;
      this.chip.show(on, this.progress.prefs.lyrics);
      // (phones make room for the dock: temples.css)
      document.body.classList.toggle('aarti-on', on);
    }
  }

  /**
   * Inside the sanctum the aarti comes first: a story being told when you step in pauses (no story starts
   * by itself there: busy()), and carries on from the same word once you step out. One you play yourself
   * inside is told, the aarti falling silent under it.
   */
  private inSanctum = false;
  private heldStory: string | null = null;
  private holdForAarti(inside: boolean) {
    if (inside === this.inSanctum) return;
    this.inSanctum = inside;
    if (inside) {
      this.heldStory = this.card.hold() ? this.card.current?.id ?? null : null;
    } else {
      if (this.heldStory && this.card.open && this.card.current?.id === this.heldStory) this.card.resume();
      this.heldStory = null;
    }
  }

  /** the YouTube recordings to try (dev: ?aartiYt=<videoId> swaps in one video, e.g. a bad id to test the fallback) */
  private ytVideos(): AartiYouTube[] {
    const list = youtubeVideos(this.story?.aarti?.youtube);
    const force = import.meta.env.DEV ? new URLSearchParams(location.search).get('aartiYt') : null;
    if (force && list[0]) return [{ ...list[0], videoId: force, start: 0, end: undefined }];
    return list;
  }

  /**
   * At the darshan spot: a recording the story may play (it comes first), else the temple's own aarti on YouTube
   * when the story has one (loaded only now), otherwise, or once YouTube has failed, the synthesized ambience.
   */
  private startAarti(ctx: AudioContext | null, out: AudioNode | null) {
    const file = this.audioFile();
    const videos = DARSHAN[this.site.id] && !this.ytFailed && !(file && ctx) ? this.ytVideos() : [];
    if (videos.length) {
      const yt = (this.yt = new YouTubeAarti(videos, youtubeLive(this.story?.aarti?.youtube), {
        failed: (why) => {
          console.info(`[aarti] YouTube unavailable (${why}): playing the aarti ambience`);
          this.ytFailed = why || 'failed';
          if (this.yt === yt) this.yt = null;
          this.chip.setMedia(null);
          // the next frame starts the synthesized aarti
        },
        changed: () => this.updateChipText(),
      }, this.calm ? { duck: 0, quietStop: 60, smooth: true } : {}));
      yt.setDuck(this.speaking);
      this.chip.setMedia(yt.el);
      this.updateChipText();
      return;
    }
    if (!ctx || !out) return;
    this.aarti = new AartiPlayer(ctx, out, file, this.calm, this.aartiEl);
    this.aarti.setDuck(this.speaking);
    this.updateChipText();
  }

  private recFile: AartiAudio | null | undefined;
  private audioFile() {
    if (this.recFile === undefined) this.recFile = pickAudio(this.story?.aarti?.audio, import.meta.env.BASE_URL);
    return this.recFile;
  }

  /** the volume slider × mute, 0..1 */
  private master() {
    const { volume, muted } = this.progress.prefs;
    return muted ? 0 : volume;
  }

  private updateChipText() {
    const lang = this.progress.prefs.lang;
    const pf = this.placeOn?.file;
    if (pf) {
      // a place's recording (the Ganga Aarti on the ghat): its own title and credit while it plays
      const credit = { text: `Audio: “${pf.title ?? ''}”${pf.by ? ` by ${pf.by}` : ''}${pf.creditUrl && /youtube\.com|youtu\.be/.test(pf.creditUrl) ? ' on YouTube' : ''}`, url: pf.creditUrl };
      this.chip.set((pf.title ?? bi(this.placeOn!.def.name, lang)).split(/ [–-] /)[0], scheduleLine(this.placeOn!.def.schedule, lang), '', null, pf.by, credit);
      return;
    }
    if (!this.aarti && !this.yt) return;
    const a = this.story?.aarti;
    if (this.yt) {
      const v = this.yt.current;
      const lyrYt = a?.lyrics && usableLicense(a.lyrics.license) ? { text: bi(a.lyrics.text, lang), source: a.lyrics.source } : null;
      this.chip.set(v.title, scheduleLine(a?.schedule, lang), '', lyrYt, v.channel);
      return;
    }
    const name = bi(a?.name, lang) || `${this.site.name.en} Shiva Aarti`;
    const lyr = a?.lyrics && usableLicense(a.lyrics.license) ? { text: bi(a.lyrics.text, lang), source: a.lyrics.source } : null;
    const file = this.aarti?.usingFile ? this.audioFile() : null;
    if (file?.title) {
      // a recording: its own title, and the credit (linked to where it comes from) while it plays
      const credit = { text: `Audio: “${file.title}”${file.by ? ` by ${file.by}` : ''}${file.creditUrl && /youtube\.com|youtu\.be/.test(file.creditUrl) ? ' on YouTube' : ''}`, url: file.creditUrl };
      this.chip.set(file.title.split(/ [–-] /)[0], scheduleLine(a?.schedule, lang), '', lyr, file.by, credit);
      return;
    }
    const note = file
      ? `recording: ${file.notes ?? file.url} (${file.license})`
      : 'aarti ambience · ghanti, shankh, damaru & nagara';
    this.chip.set(name, scheduleLine(a?.schedule, lang), note, lyr);
  }

  /** dev/testing handle */
  debug() {
    return { stops: this.stops.map((l) => ({ id: l.stop.id, inside: l.inside, anchor: l.anchor, marker: l.marker })), aarti: this.aarti?.level ?? 0, duck: this.aarti?.duckLevel ?? 1, usingFile: this.aarti?.usingFile ?? false, synth: !!this.aarti, recording: this.aarti?.recording ?? null, yt: this.yt?.debug() ?? null, ytFailed: this.ytFailed, places: this.places.map((pl) => ({ id: pl.def.id, on: pl === this.placeOn, recording: pl.player?.recording ?? null, audible: pl.player?.audible ?? false })) };
  }
}

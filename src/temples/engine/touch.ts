import { knobOffset, stickVector } from './stick';

/**
 * Touch controls for phones and tablets (only built on a finger-first device, see profile.detectTouch):
 *  - right ~40 % of the screen: a virtual joystick that appears where the thumb lands (up / down walks, left / right turns the view; the rim runs)
 *  - the rest of the screen: one-finger drag to look (world.ts DragLook, on the canvas)
 *  - thumb buttons, bottom left: Jump, Story (play / pause), Places
 *  - a first-time gesture hint, and the browser's own gestures (pinch, pull-to-refresh, double-tap zoom) off
 */

export interface TouchWorld {
  controls: { isLocked: boolean; dispatchEvent(e: { type: 'change' }): void };
  /** analog walk input (see world.ts step) */
  stick: { x: number; y: number; mag: number };
  jump(): boolean;
}

export interface TouchHost {
  world: TouchWorld;
  togglePlaces(): void;
  hasPlaces(): boolean;
  /** play / pause the story here (opening the nearest one first) */
  story(): void;
  storyPlaying(): boolean;
  lang(): 'hi' | 'en';
}

const HINT_KEY = 'divya-yatra.touch-hint';
/** knob travel (CSS px) from the centre to the rim */
const RADIUS = 56;

const ICONS = {
  jump: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-6 7h4v6h4v-6h4z" fill="currentColor"/><path d="M6 20h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  places: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>',
};

export class TouchControls {
  readonly pad = document.createElement('div');
  readonly buttons = document.createElement('div');
  private base = document.createElement('div');
  private knob = document.createElement('div');
  private hint = document.createElement('div');
  private storyBtn!: HTMLButtonElement;
  private placesBtn!: HTMLButtonElement;
  private drag: { id: number; x: number; y: number } | null = null;
  private shown = false;

  constructor(private host: TouchHost) {
    document.body.classList.add('touch');
    this.blockBrowserGestures();

    // the joystick zone
    const pad = this.pad;
    pad.id = 'touch-pad';
    this.base.className = 'stick-base';
    this.knob.className = 'stick-knob';
    this.base.append(this.knob);
    pad.append(this.base);
    pad.addEventListener('pointerdown', (e) => this.down(e));
    pad.addEventListener('pointermove', (e) => this.move(e));
    pad.addEventListener('pointerup', (e) => this.up(e));
    pad.addEventListener('pointercancel', (e) => this.up(e));
    pad.addEventListener('lostpointercapture', (e) => this.up(e));

    // thumb buttons
    const b = this.buttons;
    b.id = 'touch-buttons';
    b.innerHTML = `
      <button type="button" class="tb places" aria-label="Places">${ICONS.places}<span></span></button>
      <button type="button" class="tb story" aria-label="Play the story">${ICONS.play}<span></span></button>
      <button type="button" class="tb jump" aria-label="Jump">${ICONS.jump}<span></span></button>`;
    this.storyBtn = b.querySelector('.story')!;
    this.placesBtn = b.querySelector('.places')!;
    // Jump acts on pointerdown (instant; a thumb sliding off still counts). Story and Places act on the tap's
    // click: on iOS only a completed tap may start audio. None of them starts a look-drag (not on the canvas).
    const act = (sel: string, fn: () => void, instant = false) => {
      const el = b.querySelector<HTMLButtonElement>(sel)!;
      el.addEventListener('pointerdown', (e) => {
        el.classList.add('down');
        if (instant) { e.preventDefault(); fn(); }
      });
      const lift = () => el.classList.remove('down');
      el.addEventListener('pointerup', lift);
      el.addEventListener('pointercancel', lift);
      el.addEventListener('pointerleave', lift);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.blur();
        // (a tap already jumped on pointerdown; a keyboard / assistive-tech press has detail 0)
        if (!instant || e.detail === 0) fn();
      });
    };
    act('.jump', () => { if (host.world.controls.isLocked) host.world.jump(); }, true);
    act('.story', () => { host.story(); setTimeout(() => this.sync(), 60); });
    act('.places', () => host.togglePlaces());

    this.hint.id = 'touch-hint';
    this.hint.setAttribute('aria-hidden', 'true');
    document.body.append(pad, b, this.hint);
    this.labels();
    setInterval(() => this.shown && this.sync(), 400);
  }

  /** shown while walking */
  show(on: boolean) {
    this.shown = on;
    this.pad.classList.toggle('on', on);
    this.buttons.classList.toggle('on', on);
    this.placesBtn.hidden = !this.host.hasPlaces();
    if (!on) this.release();
    else { this.sync(); this.firstHint(); }
  }

  /** button captions in the pilgrim's language */
  labels() {
    const hi = this.host.lang() === 'hi';
    const set = (el: Element | null, s: string) => { if (el) el.textContent = s; };
    set(this.buttons.querySelector('.jump span'), hi ? 'कूदें' : 'Jump');
    set(this.buttons.querySelector('.places span'), hi ? 'स्थान' : 'Places');
    set(this.storyBtn.querySelector('span'), hi ? 'कथा' : 'Story');
  }

  private sync() {
    const playing = this.host.storyPlaying();
    if (this.storyBtn.classList.contains('playing') !== playing) {
      this.storyBtn.classList.toggle('playing', playing);
      this.storyBtn.firstElementChild?.remove();
      this.storyBtn.insertAdjacentHTML('afterbegin', playing ? ICONS.pause : ICONS.play);
      this.storyBtn.setAttribute('aria-label', playing ? 'Pause the story' : 'Play the story');
    }
    this.labels();
  }

  private down(e: PointerEvent) {
    if (this.drag || !this.host.world.controls.isLocked) return;
    e.preventDefault();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { this.pad.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    const r = this.pad.getBoundingClientRect();
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.base.classList.add('live');
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.dismissHint();
    // taking the walk back stops a Places auto-walk (engine/travel.ts listens for 'change')
    this.host.world.controls.dispatchEvent({ type: 'change' });
  }

  private move(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const [kx, ky] = knobOffset(dx, dy, RADIUS);
    this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const s = stickVector(dx, dy, RADIUS);
    const st = this.host.world.stick;
    st.x = s.x; st.y = s.y; st.mag = s.mag;
    this.base.classList.toggle('run', s.mag > 0.83);
  }

  private up(e: PointerEvent) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.release();
  }

  private release() {
    this.drag = null;
    const st = this.host.world.stick;
    st.x = 0; st.y = 0; st.mag = 0;
    this.base.classList.remove('live', 'run');
    this.base.style.left = '';
    this.base.style.top = '';
    this.knob.style.transform = '';
  }

  /** the first time on a touch device: how to walk and look, fading on its own or at the first touch */
  private firstHint() {
    let seen = false;
    try { seen = localStorage.getItem(HINT_KEY) === '1'; } catch { /* private mode */ }
    if (seen || this.hint.classList.contains('on')) return;
    const hi = this.host.lang() === 'hi';
    this.hint.innerHTML = `
      <div class="half l"><i class="ring"><b></b></i><span>${hi ? 'ऊपर · चलें, दाएँ / बाएँ · मुड़ें' : 'Up to walk · left / right to turn'}</span><small>${hi ? 'किनारे तक · दौड़ें' : 'push to the rim to run'}</small></div>
      <div class="half r"><i class="swipe"></i><span>${hi ? 'कहीं भी खींचें · देखें' : 'Drag anywhere here to look around'}</span></div>`;
    this.hint.classList.add('on');
    setTimeout(() => this.dismissHint(), 6500);
    window.addEventListener('pointerdown', () => setTimeout(() => this.dismissHint(), 900), { once: true });
  }

  private dismissHint() {
    if (!this.hint.classList.contains('on')) return;
    this.hint.classList.remove('on');
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode */ }
  }

  /**
   * No page scroll, rubber-band, pull-to-refresh, pinch or double-tap zoom while exploring (the canvas and
   * pad are touch-action: none in CSS; this covers iOS Safari, which ignores some of it). Lists in panels
   * still scroll. (Double-tap zoom is off through touch-action: manipulation in temples.css.)
   */
  private blockBrowserGestures() {
    const scrollable = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('#places-panel, #progress-panel, #aarti-chip .lyrics, [data-scroll]');
    document.addEventListener('touchmove', (e) => { if (!scrollable(e.target) && e.cancelable) e.preventDefault(); }, { passive: false });
    for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => e.preventDefault());
    // no long-press callout / selection on the HUD
    document.addEventListener('contextmenu', (e) => { if (!(e.target instanceof HTMLAnchorElement)) e.preventDefault(); });
  }
}

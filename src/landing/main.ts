import './landing.css';
import { copy } from './copy';
import { TEMPLES, readProgress, type Temple } from './temples';
import { LandingAudio } from './audio';
import type { Cosmos } from './cosmos';
import type { MapData } from './glass';
import { OPEN_TEMPLES, TEMPLE_FILES } from '../open';
import { warm } from '../preload';

/**
 * The landing: "Through the Third Eye".
 *   journey — the Linga that holds the universe (a galaxy inside black glass-stone, the tripundra, a glowing
 *             bindu, a stream of abhishek); scrolling (or waiting) pushes into the bindu, out into the
 *             universe, to a small blue world turning to night over India, where twelve lights glow
 *   hub     — India as a plate of clear glass lifted out of the globe into the cosmos, Shiva in dhyana in
 *             glass on it, the twelve as points of light at their true places; thoughts, the list, cards → Enter
 * Everything is drawn by the cosmos (Three.js, loaded here only). Until it is ready the page shows only the dark
 * of space (index.html's boot style); without WebGL the hub is the list alone.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;

/** chapter starts on the journey's progress (mirrors cosmos.ts CH, kept here so the rail needs no Three.js) */
const CH = [0, 0.16, 0.3, 0.55, 0.75, 0.92, 1];
/** auto-play: the whole journey in ~48 s when nobody scrolls */
const AUTO_SECONDS = 48;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const span = (t: number, a: number, b: number) => Math.min(Math.max((t - a) / (b - a), 0), 1);

// ---------- text ----------
document.title = copy.pageTitle;
$('eyebrow').textContent = copy.eyebrow;
$('title').textContent = copy.titleDevanagari ? `${copy.titleHi} · ${copy.title}` : copy.title;
$('subtitle').textContent = copy.subtitle;

// the hub's heading
document.querySelector<HTMLElement>('#mark .en')!.textContent = copy.mark;
document.querySelector<HTMLElement>('#mark .hi')!.textContent = copy.markHi;
$('skip').textContent = copy.skip;
// no replay link: the journey is scrolled (or plays itself), and the opening shows one cue to scroll
$('replay').hidden = true;

// ---------- About / Contribute ----------
const info = $<HTMLDialogElement>('info');
const [aboutBtn, contributeBtn] = document.querySelectorAll<HTMLButtonElement>('#more [data-info]');
aboutBtn.textContent = copy.aboutLink;
contributeBtn.textContent = copy.contributeLink;
document.querySelector<HTMLAnchorElement>('#more .gh')!.textContent = copy.githubLink;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
function openContribute() {
  const body = info.querySelector('.body')!;
  $('info-title').textContent = copy.contribute.title;
  body.innerHTML = `<p>${esc(copy.contribute.intro)}</p><dl>` +
    copy.contribute.ways.map((w) => `<dt>${esc(w.head)}</dt><dd>${esc(w.text)}</dd>`).join('') +
    `</dl><p class="cta"><a href="${copy.repo}/issues/new" target="_blank" rel="noopener">${esc(copy.contribute.cta)} →</a></p>`;
  info.showModal();
}
// the About section, below the India map
$('about-title').textContent = copy.about.title;
document.querySelector('#about .paras')!.innerHTML = copy.about.paras.map((p) => `<p>${esc(p)}</p>`).join('');
document.querySelector('#about .om')!.textContent = copy.about.blessing;
document.querySelector<HTMLButtonElement>('#about [data-info]')!.textContent = copy.contributeLink;
const gh2 = document.querySelector<HTMLAnchorElement>('#about .gh2')!;
gh2.textContent = copy.githubLink;
gh2.href = copy.repo;
document.querySelector('#about [data-info]')!.addEventListener('click', (e) => (e.stopPropagation(), openContribute()));
aboutBtn.addEventListener('click', (e) => (e.stopPropagation(), showAbout()));
document.querySelector('#about .x')!.addEventListener('click', (e) => (e.stopPropagation(), closeAbout()));
contributeBtn.addEventListener('click', (e) => (e.stopPropagation(), openContribute()));
info.querySelector('.x')!.addEventListener('click', () => info.close());
// a click on the backdrop (outside the panel) closes it
info.addEventListener('click', (e) => e.target === info && info.close());
// keep the page's own keys (Esc closes the card, arrows move the journey) out of the open panel
info.addEventListener('keydown', (e) => e.stopPropagation());
$('hint').textContent = copy.scrollHint;
$('list-title').textContent = copy.listTitle;
$('list-toggle').textContent = copy.listOpen;
// no on-screen map / Earth credit: Natural Earth and NASA's imagery are public domain
$('map-credit').hidden = true;
$('music-credit').hidden = true;
$('card-close').setAttribute('aria-label', copy.close);
$('card-enter').textContent = copy.enter;
// the page's styles are in: settle them (with transitions off, so nothing fades from its unstyled state),
// then lift the boot curtain — the canvas and the chrome keep their own hidden states
void getComputedStyle(document.body).opacity;
for (const el of document.body.querySelectorAll<HTMLElement>('body > *')) void getComputedStyle(el).opacity;
document.getElementById('boot')?.remove();

// the journey runs without words: no chapter rail, no chapter lines, no scroll prompts, no thoughts
const railItems: HTMLButtonElement[] = [];

// ---------- which temples open ----------
/** only these can be entered for now; the others say they are coming, and nothing else */
const OPEN = new Set(['mahakaleshwar']);
const isOpen = (t: Temple) => OPEN.has(t.id);
/** a locked temple's note, held a moment on a tap (phones have no hover) */
function flashSoon(el: HTMLElement) {
  el.classList.add('tip');
  clearTimeout(Number(el.dataset.tipTimer));
  el.dataset.tipTimer = String(window.setTimeout(() => el.classList.remove('tip'), 1800));
}

// ---------- progress + the list ----------
const progress = readProgress();
const list = $('list-items');
const rows: Record<string, HTMLButtonElement> = {};
for (const t of TEMPLES) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.className = 'row' + (progress[t.id].visited ? ' visited' : '');
  b.dataset.id = t.id;
  b.innerHTML = `<span class="n">${t.numeral}</span><span class="nm">${t.name}${copy.showDevanagari ? ` <span class="hi" lang="hi">${t.hi}</span>` : ''}</span><span class="pl">${t.place}</span>`;
  b.setAttribute('aria-label', `${t.order}. ${t.name}, ${t.place}${progress[t.id].visited ? `, ${copy.visited}` : ''}`);
  if (!isOpen(t)) {
    b.classList.add('soon');
    // the note takes the place line's spot (second line), so it never runs into the name
    b.querySelector('.pl')!.innerHTML = `<span class="where">${t.place}</span><span class="sn">${copy.soon}</span>`;
    b.setAttribute('aria-disabled', 'true');
    b.setAttribute('aria-label', `${t.order}. ${t.name}, ${t.place}, ${copy.soon}`);
    b.addEventListener('click', () => flashSoon(b));
    li.append(b);
    list.append(li);
    rows[t.id] = b;
    continue;
  }
  b.addEventListener('mouseenter', () => select(t, 'list'));
  b.addEventListener('focus', () => select(t, 'list'));
  b.addEventListener('click', () => {
    // bring the temple to the middle of the screen, then open its card
    if (cosmos) hubScrollTo = cosmos.hubScrollFor(t.lat);
    select(t, 'pin');
    if (document.body.classList.contains('list-open')) $('list-toggle').click();
    $('card-enter').focus();
  });
  li.append(b);
  list.append(li);
  rows[t.id] = b;
}

// ---------- the hub's twelve points of light ----------
const medalLayer = document.createElement('div');
medalLayer.id = 'medals';
medalLayer.setAttribute('aria-hidden', 'true');
const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
leaders.id = 'leaders';
medalLayer.append(leaders);
document.body.insertBefore(medalLayer, $('stage-hit'));
const points: Record<string, { el: HTMLButtonElement; pin: HTMLSpanElement; line: SVGLineElement }> = {};
for (const t of TEMPLES) {
  const el = document.createElement('button');
  el.className = 'jl' + (progress[t.id].visited ? ' visited' : '');
  el.tabIndex = -1;
  el.dataset.id = t.id;
  el.innerHTML = `<span class="nm">${t.name}</span><span class="jy">${copy.jyotirlinga}</span>`;
  const pin = document.createElement('span');
  pin.className = 'pin' + (progress[t.id].visited ? ' visited' : '');
  if (!isOpen(t)) {
    el.classList.add('soon');
    pin.classList.add('soon');
    el.insertAdjacentHTML('beforeend', `<span class="sn">${copy.soon}</span>`);
    for (const target of [el, pin]) {
      target.addEventListener('mouseenter', () => el.classList.add('tip'));
      target.addEventListener('mouseleave', () => el.classList.remove('tip'));
      target.addEventListener('click', (e) => {
        e.stopPropagation();
        flashSoon(el);
      });
    }
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leaders.append(line);
    medalLayer.append(pin, el);
    points[t.id] = { el, pin, line };
    continue;
  }
  for (const target of [el, pin]) {
    target.addEventListener('mouseenter', () => select(t, 'map'));
    target.addEventListener('mouseleave', () => {
      if (!pinned) hideTimer = window.setTimeout(() => !pinned && closeCard(), 450);
    });
    target.addEventListener('click', (e) => {
      e.stopPropagation();
      select(t, 'pin');
    });
  }
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  leaders.append(line);
  medalLayer.append(pin, el);
  points[t.id] = { el, pin, line };
}
/**
 * Each label's place beside its point (px; x < 0: the label sits to the left) — laid out by hand so the
 * Gujarat pair, the Malwa pair and the Maharashtra three stay legible and clear of Shiva's face.
 * (Phones show a label only for the chosen point.)
 */
const LABEL_AT: Record<string, [number, number]> = {
  kedarnath: [14, -8], 'kashi-vishwanath': [12, -16], vaidyanath: [12, 16],
  nageshwar: [-12, -16], somnath: [-14, 6], mahakaleshwar: [-12, -16], omkareshwar: [-14, 8],
  trimbakeshwar: [-10, 28], bhimashankar: [-14, 34], grishneshwar: [12, -14],
  mallikarjuna: [14, 2], rameshwaram: [14, 4],
};
/** each temple's point on screen (css px) — the card sits beside it */
const spots: Record<string, { x: number; y: number }> = {};

function layoutPoints() {
  if (!cosmos || !glassHub) return;
  const a = cosmos.hubAnchors(TEMPLES);
  TEMPLES.forEach((t, i) => {
    const [ax, ay] = a[i];
    const [ox, oy] = desktop ? LABEL_AT[t.id] : [10, -8];
    const p = points[t.id];
    const pop = hubFromJourney ? ease(span(hubT, 3.4 + i * 0.12, 4.1 + i * 0.12)) : reduced ? 1 : ease(span(hubT, 0.8 + i * 0.07, 1.4 + i * 0.07));
    const sel = selected?.id === t.id;
    const x = ax + ox, y = ay + oy;
    p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${ox < 0 ? '-100%' : '0'}, -50%)`;
    p.el.classList.toggle('l', ox < 0);
    p.el.style.opacity = pop.toFixed(3);
    p.el.classList.toggle('sel', sel);
    p.pin.classList.toggle('sel', sel);
    // (the translate property, not transform: the pin's own scale — phones, hover — then shrinks it in place)
    p.pin.style.translate = `${ax.toFixed(1)}px ${ay.toFixed(1)}px`;
    p.pin.style.opacity = Math.min(1, pop * 1.5).toFixed(3);
    // a hairline from the point towards its label
    const L = Math.hypot(ox, oy), k = Math.max(0, (L - 5) / L);
    p.line.setAttribute('x1', (ax + (ox / L) * 5).toFixed(1));
    p.line.setAttribute('y1', (ay + (oy / L) * 5).toFixed(1));
    p.line.setAttribute('x2', (ax + ox * k * 0.82).toFixed(1));
    p.line.setAttribute('y2', (ay + oy * k * 0.82).toFixed(1));
    p.line.style.opacity = (pop * (sel ? 0.9 : 0.45) * (desktop || sel ? 1 : 0)).toFixed(3);
    spots[t.id] = { x: ax, y: ay };
  });
  if (selected && desktop) placeCard(selected);
}

// ---------- layout ----------
let W = innerWidth, H = innerHeight, desktop = W >= 900;
function layout() {
  W = innerWidth;
  H = innerHeight;
  desktop = W >= 900;
  document.body.classList.toggle('desktop', desktop);
  leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
  leaders.setAttribute('width', String(W));
  leaders.setAttribute('height', String(H));
  if (cosmos) {
    cosmos.resize();
    cosmos.hub.narrow = !desktop;
    // India as wide as the page allows: ~90% of the map’s area (left of the list) on desktop; on phones edge to edge (1.12 of the width measure, which counts her widest latitude and the tilt generously)
    cosmos.hub.fill = desktop ? (0.92 * (W - 300)) / W : 1.12;
    // desktop: the glass sits left of the list (the camera's view shifts to centre India there)
    cosmos.setAlign(1, desktop ? -150 : 0, 0);
  }
  // the thought: top left on desktop (the empty sky west of Ladakh), bottom left on phones
  const el = $('thought');
  el.style.left = `${desktop ? Math.max(40, W * 0.04) : 16}px`;
  el.style.top = `${(H * (desktop ? 0.16 : 0.74)).toFixed(0)}px`;
  el.style.maxWidth = desktop ? '260px' : `${Math.max(130, W * 0.42).toFixed(0)}px`;
  if (selected) placeCard(selected);
  dirty = true;
}
addEventListener('resize', layout);

// ---------- state ----------
type Phase = 'journey' | 'hub';
let phase: Phase = 'journey';
let dirty = true;
const audio = new LandingAudio();
// the sound button names what plays when a recording needs credit (the recorded theme);
// the theme's credit also shows in the footer, only when that recording is what plays
let soundCredit = copy.soundCredit;
void audio.themeFound.then((url) => {
  if (!url || !copy.musicCredit) return;
  soundCredit = copy.musicCredit;
  $('music-credit').textContent = copy.musicCredit;
  $('music-credit').hidden = false;
  setSoundPill();
});
let cosmos: Cosmos | null = null;
let cosmosLoading: Promise<Cosmos | null> | null = null;
/** the glass hub (India's outline loaded, its textures ready) */
let glassHub = false;
/** journey progress (eased towards target) */
let jp = 0;
let target = 0;
let idleSince = performance.now();
let hubEnteredAt = 0;
let hubFromJourney = false;
let hubT = 0;
/** the hub map's scroll (0 = Ladakh at the top … 1 = Kanyakumari), eased towards its target */
let hubScroll = 0;
let hubScrollTo = 0;
/** the About section: it rises over the map only when the About link is clicked (never by scrolling) — px risen, eased towards its target */
let about = 0;
let aboutTo = 0;
const aboutH = () => innerHeight;
/** the scroll moves the map; with About open, scrolling up (or Esc, or ×) lowers it again */
const scrollBy = (px: number) => {
  if (aboutTo > 0) {
    if (px < -2) closeAbout();
    return;
  }
  const ext = cosmos?.hubExtent ?? 0;
  hubScrollTo = ext > 0 ? Math.min(Math.max(hubScrollTo + px / ext, 0), 1) : 0;
  dirty = true;
};
/** About fully up and its own text still has room to scroll that way (tall text on a phone): let it */
function aboutScrolls(target: EventTarget | null, dy: number) {
  const el = $('about');
  if (aboutTo < aboutH() - 1 || !(target as Element | null)?.closest?.('#about')) return false;
  return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
}
function showAbout() {
  aboutTo = aboutTo > 0 ? 0 : aboutH();
  dirty = true;
}
function closeAbout() {
  aboutTo = 0;
  dirty = true;
}

function setSoundPill() {
  const pill = $('sound');
  // on only once it is really heard: while the browser still waits for the first gesture it shows off
  const on = audio.audible;
  // the label is what a click does: "Sound off" while it plays, "Sound on" while it is silent
  pill.textContent = `♪ ${on ? copy.soundOff : copy.soundOn}`;
  pill.setAttribute('aria-pressed', String(on));
  pill.classList.toggle('on', on);
  pill.title = soundCredit;
}
audio.onChange = setSoundPill;
setSoundPill();
$('sound').addEventListener('click', (e) => {
  e.stopPropagation();
  audio.toggle();
  setSoundPill();
});
$('sound').addEventListener('pointerdown', (e) => e.stopPropagation());


// India's outline, for the glass
const outline = fetch('data/landing/india.json').then((r) => r.json() as Promise<MapData>);

// ---------- the cosmos (the journey and the hub) ----------
function loadCosmos() {
  cosmosLoading ??= import('./cosmos')
    .then(async (m) => {
      const c = new m.Cosmos($<HTMLCanvasElement>('cosmos'), { mobile, temples: TEMPLES });
      await c.ready;
      cosmos = c;
      document.body.classList.add('cosmos-ready');
      layout();
      // the glass India and Shiva (load in the background while the journey plays)
      void outline
        .then((d) => c.setMapData(d))
        .then(() => {
          glassHub = true;
          // a hub that was waiting for the glass starts its arrival now
          if (phase === 'hub') (hubT = 0), (hubEnteredAt = performance.now());
          document.body.classList.add('glass-hub');
          layout();
        })
        .catch((e) => noGL(e));
      return c;
    })
    .catch((e) => {
      noGL(e);
      return null;
    });
  return cosmosLoading;
}
/** without WebGL (or if the scene fails): the hub is the list alone */
function noGL(e: unknown) {
  console.warn('scene unavailable', e);
  document.body.classList.add('nogl');
  void goHub(true);
}

function startJourney() {
  phase = 'journey';
  jp = target = 0;
  idleSince = performance.now();
  document.body.classList.remove('hub', 'quick', 'swap');
  document.body.classList.add('journey');
  if (cosmos) cosmos.hub.h = cosmos.hub.fig = 0;
  hubScroll = hubScrollTo = 0;
  about = aboutTo = 0;
  layout();
  showThought(null);
  closeCard();
  void loadCosmos();
}

let goingHub = false;
async function goHub(quick: boolean) {
  if (goingHub || (phase === 'hub' && document.body.classList.contains('hub'))) return;
  goingHub = true;
  const fromScene = phase === 'journey' && document.body.classList.contains('cosmos-ready');
  if (quick && fromScene && !reduced) {
    // skipping mid-journey: a quick dip to dark first, then the hub (never a cut between scenes)
    document.body.classList.add('swap');
    await new Promise((r) => setTimeout(r, 380));
  }
  phase = 'hub';
  hubT = 0;
  thoughtAt = -1;
  hubFromJourney = !quick;
  hubEnteredAt = performance.now();
  setChapter(-1);
  if (quick) {
    jp = target = 1;
    void loadCosmos();
  }
  document.body.classList.remove('journey');
  document.body.classList.toggle('quick', quick);
  document.body.classList.add('hub');
  requestAnimationFrame(() => document.body.classList.remove('swap'));
  if (!quick) audio.bell(196, 0.16);
  dirty = true;
  goingHub = false;
}

// input: wheel / trackpad, touch, keys move the journey; Esc or Skip ends it
const advance = (d: number) => {
  if (phase !== 'journey' || gated) return;
  target = Math.min(1, Math.max(0, target + d));
  idleSince = performance.now();
  document.body.classList.add('moved');
};
addEventListener('wheel', (e) => {
  if (phase === 'hub') {
    // the hub: the wheel scrolls through the map (the list panel scrolls itself)
    if ((e.target as Element | null)?.closest?.('#list')) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (aboutScrolls(e.target, dy)) return;
    e.preventDefault();
    scrollBy(dy);
    return;
  }
  if (phase !== 'journey') return;
  e.preventDefault();
  if (gated) return;
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  advance(Math.max(-0.06, Math.min(0.06, dy * 0.00022)));
}, { passive: false });
let touchY: number | null = null;
addEventListener('touchstart', (e) => (touchY = e.touches[0]?.clientY ?? null), { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY === null) return;
  const y = e.touches[0].clientY;
  if (phase === 'hub' && !(e.target as Element | null)?.closest?.('#list')) {
    if (!aboutScrolls(e.target, touchY - y)) scrollBy(touchY - y);
    touchY = y;
    return;
  }
  if (phase !== 'journey') return;
  advance((touchY - y) * 0.0009);
  touchY = y;
}, { passive: true });
// ---------- the opening screen: browsers let a page play sound only after a click, so the visit begins with one ----------
// (only when the landing page opens normally: coming back to the map from a temple (#map) goes straight to it,
// and the sound starts on the first click there)
let gated = location.hash !== '#map';
if (gated) document.body.classList.add('gated');
else $('gate').classList.add('gone');
$('gate-enter').textContent = copy.gateEnter;
function openGate() {
  if (!gated) return;
  gated = false;
  // entering means with sound, even if it was turned off earlier in this visit
  if (audio.muted) audio.toggle();
  else void audio.start();
  setSoundPill();
  document.body.classList.remove('gated');
  $('gate').classList.add('gone');
  // while the journey plays, fetch the open temples' heavy files in the background: entering one is then quick
  setTimeout(() => void warm([...OPEN_TEMPLES].flatMap((id) => [...(TEMPLE_FILES[id] ?? [])]), 2), 4000);
  idleSince = performance.now();
  dirty = true;
}
$('gate-enter').addEventListener('click', (e) => {
  e.stopPropagation();
  openGate();
});
$('gate').addEventListener('pointerdown', (e) => e.stopPropagation());
if (gated) queueMicrotask(() => $('gate-enter').focus());
const firstGesture = () => {
  if (!audio.muted) void audio.start();
};
addEventListener('pointerdown', firstGesture);
addEventListener('touchend', firstGesture, { passive: true });
addEventListener('click', firstGesture);
// sound on by default: try at once (allowed where the visitor has played media here before)
void audio.start();
addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key === 'Shift') return;
  if (gated) {
    if (e.key === 'Enter' || e.key === ' ') e.preventDefault(), openGate();
    return;
  }
  firstGesture();
  if (phase === 'journey') {
    if (['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key)) advance(0.05), e.preventDefault();
    else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) advance(-0.05), e.preventDefault();
    else if (e.key === 'Escape' || e.key === 'Enter') void goHub(true);
  } else if (e.key === 'Escape') aboutTo > 0 ? closeAbout() : closeCard();
  else if (['ArrowDown', 'PageDown', ' '].includes(e.key) && !(document.activeElement instanceof HTMLButtonElement)) scrollBy(e.key === 'ArrowDown' ? 80 : H * 0.8), e.preventDefault();
  else if (['ArrowUp', 'PageUp'].includes(e.key) && !(document.activeElement instanceof HTMLButtonElement)) scrollBy(e.key === 'ArrowUp' ? -80 : -H * 0.8), e.preventDefault();
  else if (e.key === 'Home') (hubScrollTo = 0), (aboutTo = 0), (dirty = true);
  else if (e.key === 'End') (hubScrollTo = 1), (dirty = true);
});
$('skip').addEventListener('click', (e) => {
  e.stopPropagation();
  void goHub(true);
});
$('replay').addEventListener('click', (e) => {
  e.stopPropagation();
  startJourney();
});

// ---------- chapters: the rail and the one line ----------
let chapterIdx = -2;
function setChapter(i: number) {
  if (i === chapterIdx) return;
  chapterIdx = i;
  const el = $('chapter');
  el.classList.remove('on');
  railItems.forEach((b, k) => {
    b.classList.toggle('on', k === i);
    b.classList.toggle('past', k < i);
  });
  el.textContent = '';
}

// ---------- thoughts ----------
/** the thoughts that surface on the map: off — the landing keeps its words to the names */
const SHOW_THOUGHTS = false;
let thoughtAt = -1;
let thoughtIdx = Math.floor(Math.random() * copy.thoughts.length);
let thoughtTimer = 0;
function showThought(th: { text: string; source: string } | null) {
  const el = $('thought');
  el.classList.remove('on');
  clearTimeout(thoughtTimer);
  if (!th) return;
  thoughtTimer = window.setTimeout(() => {
    el.querySelector('.tt')!.textContent = th.text;
    el.querySelector('.ts')!.textContent = `— ${th.source}`;
    el.classList.add('on');
  }, el.textContent?.trim() ? 700 : 0);
}

// ---------- parallax ----------
let mx = 0, my = 0, px = 0, py = 0;
addEventListener('pointermove', (e) => {
  mx = (e.clientX / W) * 2 - 1;
  my = (e.clientY / H) * 2 - 1;
});

// ---------- hub: the card ----------
let selected: Temple | null = null;
let pinned = false;
let hideTimer = 0;
const card = $('card');
card.addEventListener('mouseenter', () => clearTimeout(hideTimer));
card.addEventListener('mouseleave', () => {
  if (!pinned) hideTimer = window.setTimeout(closeCard, 400);
});
$('stage-hit').addEventListener('click', () => phase === 'hub' && closeCard());

function select(t: Temple, how: 'map' | 'list' | 'pin') {
  clearTimeout(hideTimer);
  if (how === 'pin') pinned = true;
  if (selected?.id === t.id) return;
  selected = t;
  for (const id in rows) rows[id].classList.toggle('sel', id === t.id);
  const p = progress[t.id];
  $('card-num').textContent = `${t.numeral} · ${copy.stotramOrder}`;
  $('card-name').innerHTML = `${t.name}${copy.showDevanagari ? ` <span class="hi" lang="hi">${t.hi}</span>` : ''}`;
  $('card-place').textContent = t.place;
  $('card-line').textContent = copy.lines[t.id] ?? '';
  if (copy.templeThoughts[t.id]) {
    showThought({ text: copy.templeThoughts[t.id], source: `${t.name}` });
    thoughtAt = hubT;
  }
  const prog = $('card-progress');
  prog.textContent = p.visited ? `${copy.visited}${p.heard ? ' · ' + copy.storiesHeard(p.heard) : ''}` : p.heard ? copy.storiesHeard(p.heard) : copy.notVisited;
  prog.classList.toggle('visited', p.visited);
  const img = $<HTMLImageElement>('card-img');
  img.classList.remove('loaded');
  img.onload = () => img.classList.add('loaded');
  img.src = `landing/${t.id}.webp`;
  img.alt = `${t.name}`;
  // a hidden card jumps to its place; a visible one glides to the next point
  if (!card.classList.contains('on')) {
    card.style.transition = 'opacity 0.35s ease, visibility 0s';
    placeCard(t);
    void card.offsetWidth;
    requestAnimationFrame(() => (card.style.transition = ''));
  } else placeCard(t);
  card.classList.add('on');
  card.setAttribute('aria-hidden', 'false');
  dirty = true;
}

function placeCard(t: Temple) {
  if (!desktop) {
    card.style.transform = '';
    return;
  }
  const s = spots[t.id] ?? { x: W * 0.4, y: H * 0.5 };
  const cw = card.offsetWidth || 340, ch = card.offsetHeight || 360;
  let x = s.x + 34;
  if (x + cw > W - 300) x = s.x - 34 - cw;
  const y = Math.min(Math.max(s.y - ch * 0.45, 20), H - ch - 20);
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function closeCard() {
  selected = null;
  pinned = false;
  card.classList.remove('on');
  card.setAttribute('aria-hidden', 'true');
  for (const id in rows) rows[id].classList.remove('sel');
  dirty = true;
}
$('card-close').addEventListener('click', closeCard);
$('card-enter').addEventListener('click', () => selected && enter(selected));
$('list-toggle').addEventListener('click', () => {
  const open = document.body.classList.toggle('list-open');
  $('list-toggle').textContent = open ? copy.listClose : copy.listOpen;
  $('list-toggle').setAttribute('aria-expanded', String(open));
});

function enter(t: Temple) {
  document.body.classList.add('leaving');
  audio.fadeOut(900);
  setTimeout(() => (location.href = `${encodeURIComponent(t.id)}`), 950);
}
// coming back with the browser's back button: undo the fade
addEventListener('pageshow', (e) => {
  if (e.persisted) document.body.classList.remove('leaving');
});

// ---------- the frame ----------
let last = performance.now();

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = reduced ? 3 : now / 1000;

  if (phase === 'journey' && cosmos) {
    // auto-play after a few idle seconds
    if (!gated && now - idleSince > 3500) target = Math.min(1, target + dt / AUTO_SECONDS);
    jp += (target - jp) * Math.min(1, dt * 2.2);
    // the scroll cue goes once the journey is moving, scrolled or playing itself
    if (jp > 0.03) document.body.classList.add('moved');
    if (jp > 0.985) void goHub(false);
    const ch = CH.findIndex((c, i) => jp >= c && jp < (CH[i + 1] ?? 2));
    setChapter(Math.min(ch, copy.chapters.length - 1));
    cosmos.update(jp, time, dt);
    cosmos.render();
  } else if (phase === 'hub' && cosmos && glassHub) {
    // the hub: India lifts out of the globe as glass, Shiva rises in it, the twelve arrive
    hubT += dt;
    const h = hubFromJourney ? ease(span(hubT, 0.1, 3.2)) : 1;
    cosmos.hub.h = Math.max(h, 1e-4);
    cosmos.hub.fig = hubFromJourney ? span(hubT, 1.6, 4.4) : reduced ? 1 : span(hubT, 0.1, 1.6);
    if (!reduced) {
      px += (mx * -10 - px) * Math.min(1, dt * 3);
      py += (my * -7 - py) * Math.min(1, dt * 3);
    }
    cosmos.hub.mx = px / -10;
    cosmos.hub.my = py / -7;
    hubScroll += (hubScrollTo - hubScroll) * (reduced ? 1 : Math.min(1, dt * 6));
    if (Math.abs(hubScrollTo - hubScroll) > 1e-4) dirty = true;
    cosmos.hub.scroll = hubScroll;
    document.body.classList.toggle('can-scroll', cosmos.hubExtent > 40 && hubScroll < 0.04);
    // About rises only once the map has settled at its very bottom
    const aboutGoal = aboutTo;
    about += (aboutGoal - about) * (reduced ? 1 : Math.min(1, dt * 6));
    if (Math.abs(aboutGoal - about) > 0.5) dirty = true;
    $('about').style.transform = `translateY(${Math.max(0, aboutH() - about).toFixed(1)}px)`;
    document.body.classList.toggle('about-open', about > aboutH() * 0.35);
    // reduced motion: a still picture, redrawn only when something changes
    if (!reduced || dirty || now - hubEnteredAt < 3000) {
      cosmos.update(1, time, dt);
      cosmos.render();
      layoutPoints();
    }
    // thoughts: one at a time, ~8 s each (a temple's own thought holds while it is chosen)
    if (SHOW_THOUGHTS && !reduced && !selected && (thoughtAt < 0 || hubT - thoughtAt > 9) && hubT > 1.5) {
      thoughtAt = hubT;
      thoughtIdx = (thoughtIdx + 1) % copy.thoughts.length;
      showThought(copy.thoughts[thoughtIdx]);
    } else if (SHOW_THOUGHTS && reduced && thoughtAt < 0) {
      thoughtAt = 0;
      showThought(copy.thoughts[thoughtIdx]);
    }
    dirty = false;
  }
}

// ---------- go ----------
layout();
// every load opens on the Shiva linga and the journey (straight to the map for reduced motion, and when
// coming back from a temple: its "← Map" button links to #map)
if (reduced || location.hash === '#map') {
  phase = 'hub';
  void goHub(true);
} else startJourney();
requestAnimationFrame(frame);
for (const ev of ['pointermove', 'focusin', 'click', 'resize']) addEventListener(ev, () => (dirty = true));

// dev/screenshot hooks
Object.assign(window, { __landing: { seek: (p: number) => ((target = p), (jp = p), (idleSince = performance.now())), goHub, startJourney, get cosmos() { return cosmos; } } });

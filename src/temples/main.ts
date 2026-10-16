import './temples.css';
import type { Target } from './globe';
import { TempleWorld } from './engine/world';
import { Soundscape } from './sound';
import { SITES, DEFAULT_SITE } from './sites';
import type { Caption } from './sites/types';
import { StorySystem, loadStory } from './stories';
import { Travel } from './engine/travel';
import { PlacesPanel } from './engine/places';
import { detectTouch } from './engine/profile';
import { TouchControls } from './engine/touch';
import { DefaultLoadingManager } from 'three';
import { OPEN_TEMPLES, TEMPLE_FILES, TEMPLE_INTRO } from '../open';
import { warm } from '../preload';

const $ = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const params = new URLSearchParams(location.search);

// iOS: this page plays media (like a video), so the ringer's silent switch doesn't mute its Web Audio sound
// (the drone, the bells, the aarti); Safari 16.4+, ignored elsewhere
const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
if (audioSession) audioSession.type = 'playback';

/** Every temple URL opens straight in the temple: no intro screen and no globe flight. */
const useFlight = false;

// the temple: its public address /<id> (e.g. /mahakaleshwar), or ?temple=<id> (old links, dev tools)
const fromPath = location.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/, '') ?? '';
const siteId = params.get('temple') ?? (SITES[fromPath] ? fromPath : DEFAULT_SITE);
if (!OPEN_TEMPLES.has(siteId) && !params.has('preview')) {
  // not open yet ("coming soon" on the landing page): back to the landing page
  location.replace(new URL('./', location.href).href);
  await new Promise(() => {});
} else if (params.has('temple') && !params.has('preview')) {
  // an old temples.html?temple=<id> link: show the temple's own address instead
  params.delete('temple');
  const q = params.toString();
  history.replaceState(null, '', new URL(`./${siteId}${q ? `?${q}` : ''}${location.hash}`, location.href).href);
}
// start the heavy downloads now, while the scene's code loads and builds (the loaders then find them cached)
void warm(TEMPLE_FILES[siteId] ?? [], 8);

// ---------- loading screen: the temple's name, a fact about it at a time, and how far along it is ----------
const loading = (() => {
  const el = $('loading');
  const intro = TEMPLE_INTRO[siteId];
  const fact = el.querySelector('.fact') as HTMLElement;
  const bar = el.querySelector('.bar') as HTMLElement;
  const status = el.querySelector('.status') as HTMLElement;
  let timer = 0;
  if (intro) {
    el.querySelector('h1 .hi')!.textContent = intro.hi;
    el.querySelector('h1 .en')!.textContent = intro.en;
    el.querySelector('.place')!.textContent = intro.place;
    // a different first fact each visit, then the next one every 6 s
    let i = Math.floor(Math.random() * intro.facts.length);
    fact.textContent = intro.facts[i];
    timer = window.setInterval(() => {
      fact.classList.add('out');
      setTimeout(() => {
        i = (i + 1) % intro.facts.length;
        fact.textContent = intro.facts[i];
        fact.classList.remove('out');
      }, 600);
    }, 6000);
  }
  let shown = 0.04;
  const set = (k: number, text?: string) => {
    shown = Math.max(shown, Math.min(1, k));
    (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${shown})`;
    bar.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    if (text) status.textContent = text;
  };
  // the scene's textures, models and sky go through three.js's default loading manager: they fill 90 % of the
  // bar; the rest is building the scene and preparing its shaders
  DefaultLoadingManager.onProgress = (_url, loaded, total) => {
    set(0.1 + 0.8 * (loaded / Math.max(total, 1)), loaded < total ? 'Bringing in the stone and the sky…' : 'Lighting the lamps…');
  };
  return {
    set,
    done() {
      set(1);
      clearInterval(timer);
      DefaultLoadingManager.onProgress = () => {};
      setTimeout(() => el.classList.add('gone'), 350);
    },
  };
})();
const [site, story] = await Promise.all([
  (SITES[siteId] ?? SITES[DEFAULT_SITE])().then((m) => m.default),
  // dev: ?stories=off runs the temple without its stories (A/B performance checks)
  import.meta.env.DEV && params.get('stories') === 'off' ? null : loadStory(SITES[siteId] ? siteId : DEFAULT_SITE),
]);
loading.set(0.1, 'Raising the temple…');
const TEMPLE: Target = { lon: site.lon, lat: site.lat };
document.title = `${site.name.en} Jyotirlinga`;
// the top-left title is the temple's own name, in the chosen language first (EN / हिं)
const brand = (lang: string) => {
  const [main, other] = lang === 'hi' ? [site.name.hi, site.name.en] : [site.name.en, site.name.hi];
  $('chrome').querySelector('.brand')!.innerHTML = `${main} <span>${other}</span>`;
};
document.addEventListener('langchange', (e) => brand((e as CustomEvent<string>).detail));
$('pin').querySelector('.label')!.textContent = site.name.hi;
$('intro').querySelector('.sub')!.innerHTML = `From the edge of space to the doorstep of <em>${site.name.en}</em>`;
document.querySelector('#walk .hi')!.textContent = `श्री ${site.name.hi}`;
document.querySelector('#walk .name')!.textContent = `Shri ${site.name.en}`;

// Cesium (~1 MB gzipped) is only downloaded when the flight is actually used
const globe = useFlight ? new (await import('./globe')).CinematicGlobe($('globe'), import.meta.env.VITE_CESIUM_TOKEN) : null;
const world = new TempleWorld($('stage') as HTMLCanvasElement, site);
const sound = new Soundscape();
// story stops, the pilgrim's progress and the aarti at the Jyotirlinga (works without a story file too)
const stories = new StorySystem(world, site, sound, story);
// "Places" (T): pick a place and be walked there, fast-forwarded, along the site's nav graph
const lang = () => stories.progress.prefs.lang;
brand(lang());
const travel = new Travel(world, lang);
const places = new PlacesPanel(travel, lang);

// ---------- phones and tablets: joystick, drag to look, thumb buttons (engine/touch.ts) ----------
const touch = detectTouch()
  ? new TouchControls({
    world,
    togglePlaces: () => places.toggle(),
    hasPlaces: () => travel.places.length > 0,
    story: () => stories.storyButton(),
    storyPlaying: () => stories.storyPlaying,
    lang,
  })
  : null;
// dev / testing handles
if (import.meta.env.DEV) Object.assign(window, { world, stories, sound, travel, places, touch });
if (touch) {
  document.querySelector('#walk .en')!.textContent = 'Tap to walk in';
  // portrait: suggest turning the phone sideways (never forced; dismissed for this visit)
  const tip = document.createElement('p');
  tip.className = 'rotate-tip';
  tip.innerHTML = `<span class="ico" aria-hidden="true">⟳</span> Best in landscape · turn your phone sideways <button type="button" class="x" aria-label="Dismiss">×</button>`;
  tip.querySelector('.x')!.addEventListener('click', (e) => {
    e.stopPropagation();
    tip.remove();
    try { sessionStorage.setItem('divya-yatra.rotate-tip', '1'); } catch { /* private mode */ }
  });
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('divya-yatra.rotate-tip') === '1'; } catch { /* private mode */ }
  if (!dismissed) $('walk').insertBefore(tip, $('back'));
}

// ---------- captions ----------
const FLIGHT: Record<number, Caption | null> = { ...site.flight, 4: null };
const ZONES: Record<string, Caption> = site.zones;

let captionTimer = 0;
async function caption(c: Caption | null, holdMs = 0) {
  const el = $('caption');
  el.classList.remove('on');
  clearTimeout(captionTimer);
  if (!c) return;
  await wait(600);
  el.querySelector('.hi')!.textContent = c[0];
  el.querySelector('.en')!.textContent = c[1];
  el.querySelector('.sub')!.textContent = c[2];
  el.classList.add('on');
  if (holdMs) captionTimer = window.setTimeout(() => el.classList.remove('on'), holdMs);
}

// ---------- pin riding on the temple during the approach ----------
let pinGround = 0;
let pinOn = false;
globe?.onFrame(() => {
  if (!pinOn || !globe) return;
  const p = globe.toScreen(TEMPLE, pinGround);
  if (p) {
    $('pin').style.left = `${p.x}px`;
    $('pin').style.top = `${p.y}px`;
  }
});

// ---------- sequence ----------
let run = 0; // bumps on replay/skip so stale async steps bail out

async function journey() {
  if (!globe) return enterDirect();
  const id = ++run;
  world.stop();
  globe.setVisible(true);
  sound.reset();
  $('walk').classList.remove('on');
  $('hud').classList.remove('on');
  $('pin').classList.remove('ready');
  $('bars').classList.add('on');
  pinGround = await globe.groundHeight(TEMPLE);

  await globe.fly(TEMPLE, (beat) => {
    if (id !== run) return;
    if (beat in FLIGHT) void caption(FLIGHT[beat]);
    sound.setWind([0.25, 0.55, 0.8, 0.6, 0.4, 0.25, 0.15][beat] ?? 0.2);
    if (beat === 4) {
      pinOn = true;
      $('pin').classList.add('on');
    }
  });
  if (id !== run) return;
  // hover over the temple and wait for the pilgrim to choose to enter
  $('pin').classList.add('ready');
  void caption([site.name.hi, `${site.name.en} awaits`, 'click the diya to enter']);
}

async function enter() {
  const id = ++run;
  $('pin').classList.remove('ready', 'on');
  pinOn = false;
  void caption(null);
  $('flash').classList.add('on');
  sound.arrive();
  await Promise.all([wait(1200), world.ready]);
  if (id !== run) return;
  globe?.cancel();
  globe?.setVisible(false);
  world.reset();
  world.start();
  stories.start();
  places.show(true);
  $('bars').classList.remove('on');
  $('flash').classList.remove('on');
  $('walk').classList.add('on');
}

// ---------- walking ----------
$('walk').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'back') return;
  sound.start(); // first user gesture in direct mode
  world.controls.lock();
});
world.controls.addEventListener('lock', () => {
  $('walk').classList.remove('on');
  $('hud').classList.add('on');
  touch?.show(true);
});
world.controls.addEventListener('unlock', () => {
  if (run && $('stage').classList.contains('on')) $('walk').classList.add('on');
  $('hud').classList.remove('on');
  touch?.show(false);
});
world.onZone = (z) => {
  const c = ZONES[z];
  if (c) void caption(c, 5000);
  if (z === 'garbhagriha') {
    sound.bell(0.2, 1);
    sound.bell(2.4, 0.84);
  }
};

// ---------- chrome ----------
$('begin').addEventListener('click', () => {
  sound.start();
  $('intro').classList.add('gone');
  $('chrome').classList.add('on');
  void journey();
});
$('pin').addEventListener('click', () => void enter());
$('skip').addEventListener('click', () => {
  globe?.cancel();
  void enter();
});

/** Testing mode: straight into the temple, no intro or flight. */
async function enterDirect() {
  ++run;
  $('intro').classList.add('gone');
  $('chrome').classList.add('on');
  globe?.setVisible(false);
  await world.ready;
  loading.done();
  world.reset();
  world.start();
  stories.start();
  places.show(true);
  $('walk').classList.add('on');
  document.body.dataset.ready = '1';
}
$('replay').addEventListener('click', () => void journey());
$('back').addEventListener('click', () => void journey());

// dev: ?at=x,y,z,lx,ly,lz drops straight into the temple at a pose (for screenshots)
const at = import.meta.env.DEV && new URLSearchParams(location.search).get('at');
if (at) {
  const [x, y, z, lx, ly, lz] = at.split(',').map(Number);
  $('intro').classList.add('gone');
  globe?.setVisible(false);
  world.start();
  world.pose(x, y, z, lx, ly, lz);
  Object.assign(window, { world, stories, sound, travel, places, touch });
  stories.start();
  places.show(true);
  void world.ready.then(() => { loading.done(); document.body.dataset.ready = '1'; });
} else if (!useFlight) {
  void enterDirect();
}

import { JYOTIRLINGAS, nextOnYatra } from './catalog';
import type { Progress } from './progress';
import type { Lang } from './types';

/** The progress chip, the twelve-Jyotirlinga panel, the toast, the aarti chip and the sound controls. */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class ProgressHud {
  readonly chip: HTMLButtonElement;
  readonly panel: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  /** stop counts per temple that has stories */
  totals: Record<string, number> = {};

  constructor(private progress: Progress, private here: string, private onOpen: () => void) {
    const chip = (this.chip = document.createElement('button'));
    chip.id = 'progress-chip';
    chip.title = 'Your yatra (P)';
    chip.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    const panel = (this.panel = document.createElement('section'));
    panel.id = 'progress-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Your yatra: the twelve Jyotirlingas');
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = e.target as HTMLElement;
      if (t.closest('.x')) this.toggle(false);
      if (t.closest('.reset') && confirm('Clear your yatra progress on this device?')) progress.reset();
    });
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'story-toast';
    this.toastEl.setAttribute('role', 'status');
    document.body.append(chip, panel, this.toastEl);
    progress.onChange(() => this.render());
    this.render();
  }

  get isOpen() {
    return this.panel.classList.contains('on');
  }

  toggle(on = !this.isOpen) {
    this.panel.classList.toggle('on', on);
    if (on) { this.render(); this.onOpen(); }
  }

  show(on: boolean) {
    this.chip.classList.toggle('on', on);
  }

  setTotals(t: Record<string, number>) {
    this.totals = t;
    this.render();
  }

  toast(html: string, ms = 5000) {
    clearTimeout(this.toastTimer);
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('on');
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('on'), ms);
  }

  render() {
    const p = this.progress;
    const total = Object.values(this.totals).reduce((a, b) => a + b, 0);
    let done = 0;
    for (const id of Object.keys(this.totals)) {
      const t = p.peek(id);
      if (t) done += new Set([...t.heard, ...t.read]).size;
    }
    this.chip.innerHTML = `<span class="om">ॐ</span> <span class="lbl">Jyotirlinga </span><b>${p.visitedCount()}/12</b>${total ? ` · <span class="lbl">stories </span><span class="st" aria-hidden="true">✿</span><b>${Math.min(done, total)}/${total}</b>` : ''}`;
    this.chip.setAttribute('aria-label', `Jyotirlingas visited ${p.visitedCount()} of 12${total ? `, stories ${done} of ${total}` : ''}. Open your yatra.`);
    if (!this.isOpen) return;
    const lang: Lang = p.prefs.lang;
    const hi = lang === 'hi';
    const next = nextOnYatra((id) => !!p.peek(id)?.visited);
    const rows = JYOTIRLINGAS.map((j, i) => {
      const t = p.peek(j.id);
      const note = j.note ? `<em class="note">${esc(hi ? j.note.hi : j.note.en)}</em>` : '';
      const n = this.totals[j.id] ?? 0;
      const heard = t?.heard.length ?? 0, read = t?.read.length ?? 0;
      const pct = (k: number) => (n ? Math.min(100, Math.round((100 * k) / n)) : 0);
      const bars = n
        ? `<div class="bars"><div class="b"><i style="width:${pct(heard)}%"></i></div><small>heard ${Math.min(heard, n)}/${n}</small>
           <div class="b r"><i style="width:${pct(read)}%"></i></div><small>read ${Math.min(read, n)}/${n}</small></div>`
        : `<div class="bars none"><small>stories coming soon</small></div>`;
      return `<li class="${t?.visited ? 'visited' : ''}${j.id === this.here ? ' here' : ''}${j.id === next?.id ? ' next' : ''}">
        <span class="n">${i + 1}</span>
        <span class="name"><b lang="hi">${esc(j.name.hi)}</b> ${esc(j.name.en)}<small>${esc(j.place)}</small>${note}</span>
        ${bars}
        <span class="v" title="${t?.visited ? 'darshan done' : 'not yet visited'}">${t?.visited ? '✓' : ''}</span>
      </li>`;
    }).join('');
    this.panel.innerHTML = `
      <header><h2>${lang === 'hi' ? 'आपकी यात्रा' : 'Your yatra'} <small>${p.visitedCount()}/12 ${lang === 'hi' ? 'ज्योतिर्लिंग दर्शन' : 'Jyotirlingas visited'}</small></h2>
        <button class="x ghost" aria-label="Close">×</button></header>
      <p class="yatra-next">${next
        ? (hi
          ? `आगे की यात्रा: <b>${esc(next.name.hi)}</b> · ${esc(next.place)}`
          : `Next on your yatra: <b>${esc(next.name.en)}</b> · ${esc(next.place)}`)
        : (hi ? 'ॐ द्वादश ज्योतिर्लिंग यात्रा पूर्ण · हर हर महादेव' : 'ॐ Dwadasha Jyotirlinga yatra complete · Har Har Mahadev')}</p>
      <p class="hint">${hi
        ? 'द्वादश ज्योतिर्लिंग स्तोत्र के क्रम में · सोमनाथ से आरंभ, घृष्णेश्वर पर पूर्ण · किसी भी क्रम में दर्शन कर सकते हैं'
        : 'In the order of the Dwadasha Jyotirlinga Stotram · begin at Somnath, complete at Grishneshwar · any order works'} · ${hi ? 'केवल इस डिवाइस पर सहेजा गया' : 'saved on this device only'} · <kbd>P</kbd></p>
      <ol>${rows}</ol>
      <footer><button class="reset ghost">Reset progress</button></footer>`;
  }
}

/**
 * "Now playing" chip for the aarti, with the lyrics when they are public domain. A media panel (the temple's
 * own aarti on YouTube) can sit between the title and the lyrics; it is a persistent element, so updating the
 * text never reloads the player.
 */
export class AartiChip {
  readonly el: HTMLElement;
  private head: HTMLElement;
  private media: HTMLElement;
  private lyricsEl: HTMLElement;
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'aarti-chip';
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.head = document.createElement('div');
    this.head.className = 'head';
    // compact until hovered; a tap (phones) opens / closes the details, a link inside still works
    this.head.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      this.el.classList.toggle('open');
    });
    this.media = document.createElement('div');
    this.media.className = 'media';
    this.lyricsEl = document.createElement('div');
    this.el.append(this.head, this.media, this.lyricsEl);
    document.body.append(this.el);
  }

  set(name: string, schedule: string, note: string, lyrics: { text: string; source?: string } | null, by?: string, credit?: { text: string; url?: string }) {
    const link = credit?.url && /^https:\/\//.test(credit.url) ? credit.url : '';
    this.head.innerHTML = `
      <div class="np"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Now playing: <b>${esc(name)}</b>${by ? ` · ${esc(by)}` : ''}<span class="more">${schedule ? ` · ${esc(schedule)}` : ''}</span></span></div>
      ${note ? `<small class="note more">${esc(note)}</small>` : ''}
      ${credit ? `<small class="credit more">${esc(credit.text)}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link.replace(/^https:\/\/(www\.)?/, ''))}</a>` : ''}</small>` : ''}`;
    this.lyricsEl.innerHTML = lyrics
      ? `<div class="lyrics"><pre>${esc(lyrics.text)}</pre>${lyrics.source ? `<small>${esc(lyrics.source)}</small>` : ''}</div>`
      : '';
  }

  /** the media panel (or none) */
  setMedia(el: HTMLElement | null) {
    this.media.replaceChildren(...(el ? [el] : []));
    this.el.classList.toggle('has-media', !!el);
  }

  show(on: boolean, lyrics: boolean) {
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('lyrics-on', lyrics);
  }
}

/** Mute button and volume slider in the top bar. */
export class SoundControls {
  readonly el: HTMLElement;
  private btn: HTMLButtonElement;
  private range: HTMLInputElement;
  constructor(private get: () => { volume: number; muted: boolean }, set: (v: { volume?: number; muted?: boolean }) => void) {
    const el = (this.el = document.createElement('div'));
    el.id = 'sound-ctl';
    el.innerHTML = `<button class="ghost mute" title="Mute (M)"></button><input type="range" min="0" max="1" step="0.05" aria-label="Volume" />`;
    this.btn = el.querySelector('button')!;
    this.range = el.querySelector('input')!;
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => e.stopPropagation());
    this.btn.addEventListener('click', () => { set({ muted: !get().muted }); this.btn.blur(); });
    this.range.addEventListener('input', () => set({ volume: +this.range.value, muted: false }));
    this.range.addEventListener('change', () => this.range.blur());
    document.body.append(el);
    this.sync();
  }

  sync() {
    const { volume, muted } = this.get();
    this.range.value = String(volume);
    const off = muted || volume === 0;
    this.btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${
      off ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2"/>' : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8"/>'}</svg>`;
    this.btn.setAttribute('aria-label', off ? 'Unmute' : 'Mute');
    this.btn.setAttribute('aria-pressed', String(off));
  }

  show(on: boolean) {
    this.el.classList.toggle('on', on);
  }
}

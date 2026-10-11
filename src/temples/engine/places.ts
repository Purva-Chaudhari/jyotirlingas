import type { Travel } from './travel';
import { detectTouch } from './profile';

/**
 * The "Places" button (top right) and its list: the site's BuiltSite.places, in the pilgrim's language first.
 * Picking one walks you there (engine/travel.ts). T opens / closes it, Esc closes it.
 */
export class PlacesPanel {
  readonly button = document.createElement('button');
  readonly panel = document.createElement('div');
  private list: HTMLElement;
  private shown = false;

  constructor(private travel: Travel, private lang: () => 'hi' | 'en') {
    const b = this.button;
    b.id = 'places-btn';
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('mousedown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); b.blur(); });
    const p = this.panel;
    p.id = 'places-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Places');
    p.innerHTML = `<header><b class="t"></b><button type="button" class="x" aria-label="Close">×</button></header><ul></ul><p class="hint"></p>`;
    this.list = p.querySelector('ul')!;
    p.addEventListener('mousedown', (e) => e.stopPropagation());
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelector('.x')!.addEventListener('click', () => this.close());
    this.list.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (!li) return;
      this.close();
      li.blur();
      this.travel.go(li.dataset.id!);
    });
    document.body.append(b, p);
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.code === 'KeyT' && this.shown) { this.toggle(); return; }
      // Esc closes the list (and doesn't also pause the walk)
      if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); e.preventDefault(); this.close(); }
    }, true);
  }

  get open() { return this.panel.classList.contains('on'); }

  /** show the button (once walking in a temple that has places) */
  show(on: boolean) {
    this.shown = on && this.travel.places.length > 0;
    this.button.classList.toggle('on', this.shown);
    if (!this.shown) this.close();
    this.render();
  }

  toggle() {
    if (this.open) this.close();
    else if (this.shown) {
      this.render();
      this.panel.classList.add('on');
      this.button.setAttribute('aria-expanded', 'true');
      this.list.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }
  }

  close() {
    this.panel.classList.remove('on');
    this.button.setAttribute('aria-expanded', 'false');
    if (this.panel.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  private render() {
    const hi = this.lang() === 'hi';
    this.button.innerHTML = `<span class="pin" aria-hidden="true">◈</span> ${hi ? 'स्थान' : 'Places'} <kbd>T</kbd>`;
    this.panel.querySelector('.t')!.textContent = hi ? 'स्थान · चलकर पहुँचें' : 'Places · walk me there';
    this.panel.querySelector('.hint')!.innerHTML = detectTouch()
      ? (hi ? 'आप तेज़ी से चलकर वहाँ पहुँचेंगे · जॉयस्टिक या खींचना रोक देता है' : 'You are walked there, fast-forwarded · the joystick or a drag stops')
      : hi
      ? 'आप तेज़ी से चलकर वहाँ पहुँचेंगे · कोई भी चलने की कुंजी या <kbd>Esc</kbd> रोक देती है'
      : 'You are walked there, fast-forwarded · any move key or <kbd>Esc</kbd> stops';
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    this.list.innerHTML = this.travel.places.map((p) => {
      const [a, b] = hi ? [p.label.hi, p.label.en] : [p.label.en, p.label.hi];
      return `<li><button type="button" data-id="${esc(p.id)}"><span class="a"${hi ? ' lang="hi"' : ''}>${esc(a)}</span><small${hi ? '' : ' lang="hi"'}>${esc(b)}</small></button></li>`;
    }).join('');
  }
}

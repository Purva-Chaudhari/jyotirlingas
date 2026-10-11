import type { Lang } from './types';

/**
 * The pilgrim's guide: a small pill at the top of the screen with an arrow that turns to point at the
 * next place on the yatra — the next story you have not yet heard (in walking order), and after them the
 * darshan spot — with its name and distance. G hides / shows it (remembered).
 */
export interface GuideTarget {
  title: string;
  x: number;
  z: number;
  darshan: boolean;
  /** where the arrow points instead (the next bend of a guide path on the way to the target) */
  aim?: { x: number; z: number };
  /** the walking distance, when it is not the straight line (along a guide path) */
  dist?: number;
}

export class Guide {
  readonly el: HTMLElement;
  private arrow: HTMLElement;
  private text: HTMLElement;
  private last = '';

  constructor() {
    const el = (this.el = document.createElement('div'));
    el.id = 'guide';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="arrow" aria-hidden="true">➤</span><span class="t"></span><kbd>G</kbd>`;
    this.arrow = el.querySelector('.arrow')!;
    this.text = el.querySelector('.t')!;
    document.body.append(el);
  }

  show(on: boolean) {
    this.el.classList.toggle('on', on);
  }

  /**
   * @param target where to go (null: nothing left — hide)
   * @param from the pilgrim's feet (x, z)
   * @param yaw the camera's heading: atan2 of its forward vector (x, z)
   */
  update(target: GuideTarget | null, from: { x: number; z: number }, yaw: number, lang: Lang) {
    if (!target) {
      this.el.classList.add('none');
      return;
    }
    this.el.classList.remove('none');
    const ax = target.aim?.x ?? target.x, az = target.aim?.z ?? target.z;
    const dx = ax - from.x, dz = az - from.z;
    const dist = target.dist ?? Math.hypot(target.x - from.x, target.z - from.z);
    // bearing of the target relative to where you look; 0 = straight ahead, + = to the right
    let rel = Math.atan2(dx, dz) - yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.arrow.style.transform = `rotate(${(-90 - (rel * 180) / Math.PI).toFixed(1)}deg)`;
    const hi = lang === 'hi';
    const m = dist < 4 ? (hi ? 'यहीं' : 'here') : `${Math.round(dist)} m`;
    const label = target.darshan
      ? (hi ? `दर्शन की ओर · ${target.title}` : `To darshan · ${target.title}`)
      : (hi ? `अगली कथा · ${target.title}` : `Next story · ${target.title}`);
    const s = `${label} · ${m}`;
    if (s !== this.last) { this.text.textContent = s; this.last = s; }
  }
}

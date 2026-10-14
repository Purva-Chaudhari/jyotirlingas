/**
 * iOS Safari lets an <audio> element play by itself (a story starting as you walk up to its spot) only once
 * that same element has been played from a tap. On the first tap, play a moment of silence through it, then
 * hand it back empty; from then on the page may start it whenever it likes.
 */

let silent: string | null = null;

/** a tenth of a second of silence, as a WAV (8 kHz, 8-bit mono) */
function silentClip(): string {
  if (silent) return silent;
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const tag = (at: number, s: string) => { for (let i = 0; i < 4; i++) b[at + i] = s.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE');
  tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  tag(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return (silent = URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
}

const unlocked = new WeakSet<HTMLMediaElement>();

/** call from a tap/click/key handler; does nothing once done, or while the element has its own source */
export function unlockMedia(el: HTMLMediaElement) {
  if (unlocked.has(el) || el.getAttribute('src')) return;
  const clip = silentClip();
  el.src = clip;
  el.play().then(() => {
    unlocked.add(el);
    // (unless the page gave it something real to play meanwhile)
    if (el.src === clip) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }, () => {
    if (el.src === clip) { el.removeAttribute('src'); el.load(); }
  });
}

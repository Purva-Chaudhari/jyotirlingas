/**
 * Virtual-joystick and touch-look math (pure, unit-tested in tests/touch.test.ts).
 */

/** walking and running speeds (m/s), as the keyboard's WALK / RUN in world.ts */
export const WALK_SPEED = 3.4;
export const RUN_SPEED = 7.5;
/** under this share of the ring nothing moves (a resting thumb) */
export const DEAD_ZONE = 0.14;
/** beyond this share of the ring the pilgrim starts to run, reaching full run at the rim */
export const RUN_FROM = 0.86;

export interface Stick {
  /** sideways push, -1 (left) .. 1 (right): turns the view (stickSteer) */
  x: number;
  /** forward, -1 (back) .. 1 (forward) */
  y: number;
  /** 0..1, how far the knob is pushed (0 inside the dead zone) */
  mag: number;
}

/**
 * The knob offset (dx, dy in CSS px, screen y downwards) from where the thumb landed, on a ring of
 * `radius` px: the walking direction and how far it is pushed. The knob never leaves the ring.
 */
export function stickVector(dx: number, dy: number, radius: number): Stick {
  const d = Math.hypot(dx, dy);
  if (!(radius > 0) || d === 0) return { x: 0, y: 0, mag: 0 };
  const raw = Math.min(1, d / radius);
  if (raw < DEAD_ZONE) return { x: 0, y: 0, mag: 0 };
  // rescale past the dead zone so the speed starts from zero at its edge
  const mag = (raw - DEAD_ZONE) / (1 - DEAD_ZONE);
  return { x: (dx / d) * mag, y: (-dy / d) * mag, mag };
}

/** where the knob is drawn: the offset clamped to the ring */
export function knobOffset(dx: number, dy: number, radius: number): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d <= radius || d === 0) return [dx, dy];
  return [(dx / d) * radius, (dy / d) * radius];
}

/** walking speed (m/s) for a push of `mag` (0..1): a slow creep near the centre, a walk, a run at the rim */
export function stickSpeed(mag: number): number {
  if (mag <= 0) return 0;
  const walkAt = (RUN_FROM - DEAD_ZONE) / (1 - DEAD_ZONE);
  if (mag < walkAt) return WALK_SPEED * (0.3 + 0.7 * (mag / walkAt));
  const k = Math.min(1, (mag - walkAt) / (1 - walkAt));
  return WALK_SPEED + (RUN_SPEED - WALK_SPEED) * k;
}

/**
 * Radians of view turn per CSS px of a one-finger drag: a swipe across the short side of the screen
 * turns the view ~135°, whatever the screen size (bounded for tiny and huge screens).
 */
export function lookGain(width: number, height: number): number {
  const short = Math.max(1, Math.min(width, height));
  return Math.min(0.009, Math.max(0.0035, 2.35 / short));
}

/** how fast the joystick turns the view at full side push (rad/s): ~90°/s, an unhurried look round */
export const STICK_TURN = 1.6;
/** forward push under this share is ignored, so a mostly sideways push turns on the spot */
export const STEER_DEAD = 0.18;

/**
 * Steering from the joystick, like a game pad: left / right turns the view (`turn`, +1 = left at full
 * push, curved so small pushes turn gently) and up / down walks forward / back (`fwd`, -1..1).
 */
export function stickSteer(s: Stick): { turn: number; fwd: number } {
  if (s.mag <= 0) return { turn: 0, fwd: 0 };
  const turn = -Math.sign(s.x) * s.x * s.x;
  const a = Math.abs(s.y);
  const fwd = a < STEER_DEAD ? 0 : Math.sign(s.y) * ((a - STEER_DEAD) / (1 - STEER_DEAD));
  return { turn: turn || 0, fwd };
}

import type { GuidePath } from '../sites/types';

type P3 = { x: number; y: number; z: number };

/**
 * Where a point is along a guide path: `s` metres (horizontal) from its start, `d` metres off the line,
 * `dy` the height difference to the path's floor there. The nearest segment wins, preferring one at the
 * right height (so a stair's foot is not mistaken for the floor above it).
 */
export function locate(path: GuidePath, p: P3): { s: number; d: number; dy: number } | null {
  const pts = path.points;
  let best: { s: number; d: number; dy: number } | null = null, score = Infinity, s0 = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1], [bx, by, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const t = len ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (len * len))) : 0;
    const d = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t), dy = p.y - (ay + (by - ay) * t);
    const sc = d + Math.abs(dy) * 2;
    if (sc < score) { score = sc; best = { s: s0 + len * t, d, dy }; }
    s0 += len;
  }
  return best;
}

/** total horizontal length of a path */
export function pathLength(path: GuidePath): number {
  let s = 0;
  for (let i = 1; i < path.points.length; i++) {
    const [ax, , az] = path.points[i - 1], [bx, , bz] = path.points[i];
    s += Math.hypot(bx - ax, bz - az);
  }
  return s;
}

/** the point `s` metres along a path (clamped to its ends) */
export function pointAt(path: GuidePath, s: number): { x: number; z: number } {
  const pts = path.points;
  for (let i = 1; i < pts.length; i++) {
    const [ax, , az] = pts[i - 1], [bx, , bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= len || i === pts.length - 1) {
      const t = len ? Math.max(0, Math.min(1, s / len)) : 1;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
    }
    s -= len;
  }
  const [x, , z] = pts[pts.length - 1] ?? [0, 0, 0];
  return { x, z };
}

export interface PathGoal {
  /** a stable key for the goal (a story id, or 'darshan' / 'end') */
  key: string;
  /** where it is: [x, y, z, radius] */
  at: [number, number, number, number];
}

/**
 * The order the guide visits things in. `unheard` are the stories not yet heard, in the temple's walking order;
 * `darshan` the darshan spot (key ''), null when there is none or it is already done (`visited`); `then` the
 * stop the real route takes the pilgrim to right after darshan (e.g. Mahakaleshwar's queue goes up to the
 * Omkareshwar shrine above the sanctum). Before darshan, darshan comes just before `then` (or last); after it,
 * while `then` is unheard, the walk carries on from there (`then` and the stops after it), then picks up any
 * stories left behind.
 */
export function orderGoals(unheard: PathGoal[], visited: boolean, darshan: PathGoal | null, then?: string): PathGoal[] {
  const i = then ? unheard.findIndex((g) => g.key === then) : -1;
  if (visited) return i < 0 ? unheard : [...unheard.slice(i), ...unheard.slice(0, i)];
  if (!darshan) return unheard;
  return i < 0 ? [...unheard, darshan] : [...unheard.slice(0, i), darshan, ...unheard.slice(i)];
}

/**
 * Leading the pilgrim along the site's guide paths. `goals` are candidate places in priority order (see
 * orderGoals); the first goal that lies ahead of the pilgrim (by distance along it) on a path the pilgrim is
 * on is chosen. Returns null when the pilgrim is not on any path, or no goal lies ahead on theirs. `aim` is a
 * point ~LOOK metres further along the path (or the goal itself when close), `dist` the walking distance left.
 */
export function leadAlong(paths: GuidePath[], feet: P3, goals: PathGoal[], LOOK = 2.5):
  { goal: PathGoal; aim: { x: number; z: number }; dist: number } | null {
  const on = paths
    .map((path) => ({ path, reach: path.reach ?? 1.5, me: locate(path, feet) }))
    .filter((o) => o.me && o.me.d <= o.reach && Math.abs(o.me.dy) <= 1.6);
  if (!on.length) return null;
  for (const g of goals) {
    for (const { path, reach, me } of on) {
      const at = locate(path, { x: g.at[0], y: g.at[1], z: g.at[2] });
      if (!at || at.d > Math.max(reach, g.at[3]) + 0.5 || Math.abs(at.dy) > 2.5) continue;
      if (at.s < me!.s - 0.5) continue; // behind
      const left = Math.max(0, at.s - me!.s);
      const aim = left < LOOK ? { x: g.at[0], z: g.at[2] } : pointAt(path, me!.s + LOOK);
      return { goal: g, aim, dist: left + at.d };
    }
  }
  return null;
}

import * as THREE from 'three';
import { detectTouch } from './profile';
import type { NavGraph, Place } from '../sites/types';

/**
 * PLACES: pick a place and be walked there, fast-forwarded (never teleported).
 *
 * A site describes where one can walk as a small graph on its BuiltSite (src/temples/sites/types.ts):
 *
 *   nav: {
 *     nodes: { gate: [-2, 0, -44], hall: [0, 0.9, 7.6], ... },        // feet positions ON the floor: [x, y, z]
 *     edges: [['gate', 'hall'], ['hall', 'sanctum', { before: () => openGate() }], ...],
 *   },
 *   places: [{ id: 'sanctum', label: { hi: 'गर्भगृह', en: 'Garbhagriha' }, node: 'sanctum', look: [0, 1, -3] }],
 *
 * Authoring rules:
 *  - an edge is a STRAIGHT line the pilgrim can walk both ways with the normal collision (radius 0.3 m): keep it
 *    ≥ 0.4 m clear of walls, rails and pillars; a stair or a ramp is one edge from its foot to its head (start and
 *    end it a step or so beyond the first/last riser); put a node at every bend, every doorway's two sides,
 *    and at every place and story stop;
 *  - `before` runs once when the walk reaches that edge (open a gate / barricade: call the portal's use());
 *    `cost` (metres) makes a way less preferred;
 *  - check it with `node scripts/navcheck.mjs <temple>`: it walks every edge in the browser and then travels to
 *    every place from the spawn, and prints the edges that get stuck.
 *
 * How a trip runs (Travel.go): the start is the nearest nodes the pilgrim can walk to in a straight line
 * (TempleWorld.walkable; else simply the nearest), then A* to the place's node; the polyline gets rounded
 * corners and is followed by pure pursuit through TempleWorld.drive — the real movement, collision and floor
 * following, so stairs are walked up and down — at ~3.5× walking pace (eased in and out, slower on stairs and
 * bends, faster on long straight runs), the view turning smoothly toward where the way goes. Any move key, a
 * drag of the view or Esc stops it. If the pilgrim stalls for 0.8 s (a crowd, a corner) they are put on the next
 * node of the way (nodes are on open floor, so never inside a wall). While travelling, world.travelling is true
 * and the stories hold their triggers; the place's own story may start on arrival.
 */

export type Vec3 = [number, number, number];

// ------------------------------------------------------------------ graph

/** how far apart two feet positions are for walking: height counts double (stairs are slow) */
export function walkCost(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]) + Math.abs(a[1] - b[1]) * 2;
}

interface Link { to: string; cost: number; before?: () => void }

export function adjacency(g: NavGraph): Map<string, Link[]> {
  const adj = new Map<string, Link[]>();
  for (const id of Object.keys(g.nodes)) adj.set(id, []);
  for (const [a, b, o] of g.edges) {
    const A = g.nodes[a], B = g.nodes[b];
    if (!A || !B) continue;
    const cost = walkCost(A, B) + (o?.cost ?? 0);
    adj.get(a)!.push({ to: b, cost, before: o?.before });
    adj.get(b)!.push({ to: a, cost, before: o?.before });
  }
  return adj;
}

/**
 * A* over the graph from any of `starts` (a node and what it costs to reach it) to `goal`.
 * Returns the node ids in walking order (the start node first), or null when the goal can't be reached.
 */
export function astar(g: NavGraph, starts: { node: string; cost: number }[], goal: string, adj = adjacency(g)): string[] | null {
  const G = g.nodes[goal];
  if (!G) return null;
  const h = (id: string) => Math.hypot(g.nodes[id][0] - G[0], g.nodes[id][2] - G[2]);
  const best = new Map<string, number>(), from = new Map<string, string | null>();
  const open: { id: string; f: number }[] = [];
  for (const s of starts) {
    if (!g.nodes[s.node]) continue;
    if ((best.get(s.node) ?? Infinity) <= s.cost) continue;
    best.set(s.node, s.cost);
    from.set(s.node, null);
    open.push({ id: s.node, f: s.cost + h(s.node) });
  }
  const done = new Set<string>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { id } = open.splice(bi, 1)[0];
    if (done.has(id)) continue;
    if (id === goal) {
      const out = [id];
      for (let p = from.get(id); p; p = from.get(p)) out.unshift(p);
      return out;
    }
    done.add(id);
    for (const l of adj.get(id) ?? []) {
      const c = best.get(id)! + l.cost;
      if (c < (best.get(l.to) ?? Infinity)) {
        best.set(l.to, c);
        from.set(l.to, id);
        open.push({ id: l.to, f: c + h(l.to) });
      }
    }
  }
  return null;
}

/** node ids by distance from feet p (height counted triple, so the floor you are on comes first), nearest first */
export function nearestNodes(g: NavGraph, p: { x: number; y: number; z: number }, max = 6, within = Infinity): string[] {
  return Object.entries(g.nodes)
    .map(([id, n]) => ({ id, d: Math.hypot(n[0] - p.x, n[2] - p.z) + Math.abs(n[1] - p.y) * 3 }))
    .filter((e) => e.d <= within)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((e) => e.id);
}

/** the hooks (edge `before`) along a node route: index i = the edge from route[i] to route[i + 1] */
export function routeHooks(g: NavGraph, route: string[], adj = adjacency(g)): ((() => void) | undefined)[] {
  return route.slice(1).map((b, i) => adj.get(route[i])?.find((l) => l.to === b)?.before);
}

// ------------------------------------------------------------------ the polyline

/**
 * Round the corners of a polyline (plan view; heights follow) with quadratic curves of up to `radius` m, never
 * more than 40 % of either neighbouring leg, so the curve stays near the legs (doorways, stairs). `src[i]` is the
 * index of the input point each output point came from (for the corner curves: the corner itself).
 */
export function roundCorners(pts: Vec3[], radius = 0.8, steps = 6): { pts: Vec3[]; src: number[] } {
  const out: Vec3[] = [], src: number[] = [];
  if (!pts.length) return { pts: out, src };
  out.push(pts[0]); src.push(0);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[2] - a[2]), l2 = Math.hypot(c[0] - b[0], c[2] - b[2]);
    const r = Math.min(radius, l1 * 0.4, l2 * 0.4);
    const turn = l1 > 1e-6 && l2 > 1e-6
      ? Math.acos(THREE.MathUtils.clamp(((b[0] - a[0]) * (c[0] - b[0]) + (b[2] - a[2]) * (c[2] - b[2])) / (l1 * l2), -1, 1))
      : 0;
    if (r < 0.05 || turn < 0.08) { out.push(b); src.push(i); continue; }
    const p0: Vec3 = [b[0] - ((b[0] - a[0]) / l1) * r, b[1] - ((b[1] - a[1]) / l1) * r, b[2] - ((b[2] - a[2]) / l1) * r];
    const p2: Vec3 = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r, b[2] + ((c[2] - b[2]) / l2) * r];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      out.push([0, 1, 2].map((j) => u * u * p0[j] + 2 * u * t * b[j] + t * t * p2[j]) as Vec3);
      src.push(i);
    }
  }
  if (pts.length > 1) { out.push(pts[pts.length - 1]); src.push(pts.length - 1); }
  return { pts: out, src };
}

/** a polyline walked by arc length (plan distance), with a speed limit along it */
export class Track {
  readonly s: number[] = [0];
  readonly length: number;
  /** speed cap (m/s) at each point, after braking for what comes next */
  readonly cap: number[];
  /** the cruise speed of each leg i → i + 1 */
  readonly leg: number[] = [];

  constructor(readonly pts: Vec3[], o: { speed?: number; fast?: number; stair?: number; brake?: number; bend?: number } = {}) {
    const speed = o.speed ?? 12, fast = o.fast ?? 26, stair = o.stair ?? 6.5, brake = o.brake ?? 14, bend = o.bend ?? 30;
    for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
    this.length = this.s[this.s.length - 1];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const L = this.s[i + 1] - this.s[i];
      const slope = L > 1e-6 ? Math.abs(pts[i + 1][1] - pts[i][1]) / L : 0;
      // long straight legs (a corridor, a road) go faster still
      this.leg.push(slope > 0.12 ? stair : L > 30 ? Math.min(fast, speed + (L - 30) * 0.3) : speed);
    }
    const cap = new Array<number>(n).fill(Infinity);
    for (let i = 1; i < n - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = this.s[i] - this.s[i - 1], l2 = this.s[i + 1] - this.s[i];
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const cos = ((b[0] - a[0]) * (c[0] - b[0]) + (b[2] - a[2]) * (c[2] - b[2])) / (l1 * l2);
      const turn = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
      // lateral acceleration on the bend's radius (≈ leg / turn)
      if (turn > 0.03) cap[i] = Math.max(3.5, Math.sqrt((bend * Math.min(l1, l2)) / turn));
      cap[i] = Math.min(cap[i], this.leg[i - 1], this.leg[i]);
    }
    cap[0] = Math.min(cap[0], this.leg[0] ?? 0);
    cap[n - 1] = 0;
    for (let i = n - 2; i >= 0; i--) cap[i] = Math.min(cap[i], Math.sqrt(cap[i + 1] ** 2 + 2 * brake * (this.s[i + 1] - this.s[i])));
    this.cap = cap;
    this.brake = brake;
  }
  private brake: number;

  private seg(s: number): number {
    let lo = 0, hi = this.s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    return lo;
  }

  /** the point at arc length s */
  at(s: number): Vec3 {
    const p = this.pts;
    if (p.length === 1 || s <= 0) return p[0];
    if (s >= this.length) return p[p.length - 1];
    const i = this.seg(s), L = this.s[i + 1] - this.s[i], t = L > 1e-9 ? (s - this.s[i]) / L : 0;
    return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t, p[i][2] + (p[i + 1][2] - p[i][2]) * t];
  }

  /** the speed allowed at arc length s: the leg's cruise speed, braking toward the next caps */
  limit(s: number): number {
    if (s >= this.length) return 0;
    const i = this.seg(Math.max(0, s));
    return Math.min(this.leg[i] ?? 0, Math.sqrt(this.cap[i + 1] ** 2 + 2 * this.brake * Math.max(0, this.s[i + 1] - s)));
  }

  /**
   * Arc length of the point of the track nearest p, searched only from s0 - back to s0 + ahead (so a stair that
   * passes over or under another part of the way is not mistaken for it); a height difference of more than
   * 0.8 m counts triple (a level apart, not a landing the polyline's straight slope runs above).
   */
  project(p: { x: number; y: number; z: number }, s0: number, back = 1, ahead = 5): number {
    let best = s0, bd = Infinity;
    const lo = Math.max(0, s0 - back), hi = Math.min(this.length, s0 + ahead);
    for (let i = this.seg(lo); i < this.pts.length - 1 && this.s[i] <= hi; i++) {
      const a = this.pts[i], b = this.pts[i + 1], L = this.s[i + 1] - this.s[i];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      let t = L > 1e-9 ? ((p.x - a[0]) * dx + (p.z - a[2]) * dz) / (L * L) : 0;
      t = THREE.MathUtils.clamp(t, (lo - this.s[i]) / (L || 1), (hi - this.s[i]) / (L || 1));
      t = THREE.MathUtils.clamp(t, 0, 1);
      const x = a[0] + dx * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + dz * t;
      const d = Math.hypot(p.x - x, p.z - z) + Math.max(0, Math.abs(p.y - y) - 0.8) * 3;
      if (d < bd) { bd = d; best = this.s[i] + L * t; }
    }
    return best;
  }
}

// ------------------------------------------------------------------ the walk

/** what Travel needs of the world (TempleWorld) */
export interface TravelWorld {
  feet: THREE.Vector3;
  camera: THREE.Camera;
  controls: { isLocked: boolean; lock(): void; addEventListener(type: 'change' | 'unlock', fn: () => void): void };
  drive: ((dt: number) => { x: number; z: number } | null) | null;
  travelling: boolean;
  readonly nav: NavGraph | undefined;
  readonly places: Place[];
  walkable(a: Vec3, b: Vec3): boolean;
  groundAt(x: number, z: number, fromY: number): number | null;
}

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape']);

export interface TravelInfo { place: Place; from: Vec3; nodes: string[]; length: number; nudges: number; stalls: Vec3[]; t0: number; t1?: number; result?: 'arrived' | 'stopped' }

export class Travel {
  private track: Track | null = null;
  private place: Place | null = null;
  private hooks: { s: number; fn: () => void }[] = [];
  private nodeS: number[] = [];
  private s = 0;
  private v = 0;
  private stall = 0;
  private nudges = 0;
  private sLast = 0;
  private phase: 'walk' | 'face' | null = null;
  private faceT = 0;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private cue = document.createElement('div');
  private ff = document.createElement('div');
  /** called when a trip starts, arrives (true) or is stopped (false) */
  onEnd: (arrived: boolean, place: Place) => void = () => {};
  /** the last trip (dev/testing: navcheck) */
  info: TravelInfo | null = null;

  constructor(private world: TravelWorld, private lang: () => 'hi' | 'en' = () => 'en') {
    this.cue.id = 'travel-cue';
    this.cue.setAttribute('role', 'status');
    this.ff.id = 'travel-ff';
    this.ff.setAttribute('aria-hidden', 'true');
    document.body.append(this.ff, this.cue);
    world.drive = (dt) => this.step(dt);
    // a move key, a drag of the view or Esc takes the walk back (Esc here does not also pause)
    window.addEventListener('keydown', (e) => {
      if (!this.phase || !MOVE_KEYS.has(e.code)) return;
      if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); }
      this.stop();
    }, true);
    world.controls.addEventListener('change', () => this.stop());
    world.controls.addEventListener('unlock', () => this.stop());
  }

  get active() { return !!this.phase; }
  get places(): Place[] { return this.world.nav ? this.world.places : []; }

  /** walk to a place (by id); false if there is no way there */
  go(id: string): boolean {
    const g = this.world.nav, place = this.places.find((p) => p.id === id);
    if (!g || !place || !g.nodes[place.node]) return false;
    const f = this.world.feet, here: Vec3 = [f.x, f.y, f.z];
    const adj = adjacency(g);
    // start from the nodes one can walk to straight from here (the nearest few), else the nearest one
    const near = nearestNodes(g, f, 8, 80);
    let starts = near.filter((id) => this.world.walkable(here, g.nodes[id])).map((id) => ({ node: id, cost: walkCost(here, g.nodes[id]) }));
    if (!starts.length) starts = nearestNodes(g, f, 1).map((id) => ({ node: id, cost: 0 }));
    const route = astar(g, starts, place.node, adj);
    if (!route) return false;
    this.walkRoute(route, place);
    return true;
  }

  /** walk from where you stand along exactly these nodes (navcheck walks single edges with it) */
  walkRoute(route: string[], place: Place = { id: `@${route[route.length - 1]}`, node: route[route.length - 1], label: { hi: route[route.length - 1], en: route[route.length - 1] } }) {
    const g = this.world.nav!, f = this.world.feet, here: Vec3 = [f.x, f.y, f.z];
    this.stop();
    const raw: Vec3[] = [here, ...route.map((id) => g.nodes[id])];
    const { pts, src } = roundCorners(raw);
    const track = new Track(pts);
    // the arc length at which each raw point (here, then the route's nodes) is passed, for hooks and nudges
    this.nodeS = raw.map((_, i) => track.s[src.indexOf(i)] ?? 0);
    const hooks = routeHooks(g, route, adjacency(g));
    // a gate on an edge opens a few metres before it is reached (and at once when it's the first)
    this.hooks = hooks.flatMap((fn, i) => (fn ? [{ s: this.nodeS[i + 1] - 4, fn }] : []));
    this.track = track;
    this.place = place;
    this.info = { place, from: here, nodes: route, length: track.length, nudges: 0, stalls: [], t0: performance.now() };
    this.s = 0; this.v = 0; this.stall = 0; this.nudges = 0;
    this.sLast = 0;
    this.phase = 'walk';
    this.world.travelling = true;
    if (!this.world.controls.isLocked) this.world.controls.lock();
    this.showCue(true);
  }

  /** stop where you are (any move key, a drag, Esc) */
  stop() {
    if (!this.phase) return;
    const p = this.place!;
    if (this.info) { this.info.result = 'stopped'; this.info.t1 = performance.now(); }
    this.end();
    this.onEnd(false, p);
  }

  private end() {
    this.phase = null;
    this.track = null;
    this.world.travelling = false;
    this.showCue(false);
  }

  private showCue(on: boolean) {
    if (on && this.place) {
      const hi = this.lang() === 'hi';
      const name = hi ? this.place.label.hi : this.place.label.en;
      this.cue.innerHTML = detectTouch()
        ? (hi
          ? `<span class="ff" aria-hidden="true">⏩</span> ${name} की ओर · चलें या खींचें — रुकें`
          : `<span class="ff" aria-hidden="true">⏩</span> Walking to ${name} · move or drag to stop`)
        : hi
          ? `<span class="ff" aria-hidden="true">⏩</span> ${name} की ओर · <kbd>Esc</kbd> या चलने की कोई कुंजी — रुकें`
          : `<span class="ff" aria-hidden="true">⏩</span> Walking to ${name} · <kbd>Esc</kbd> / any move key to stop`;
    }
    this.cue.classList.toggle('on', on);
    this.ff.classList.toggle('on', on);
    document.body.classList.toggle('travelling', on);
  }

  /** world.drive: this frame's move */
  private step(dt: number): { x: number; z: number } | null {
    const tr = this.track, f = this.world.feet;
    if (!this.phase || !tr) return null;
    if (this.phase === 'face') {
      this.faceT += dt;
      this.turnToward(this.place!.look ?? null, dt, 5);
      if (this.faceT > 0.9) {
        const p = this.place!;
        this.info!.result = 'arrived';
        this.info!.t1 = performance.now();
        this.end();
        this.onEnd(true, p);
      }
      return null;
    }
    // where on the way we are, and the gates ahead
    this.s = Math.max(this.s, tr.project(f, this.s));
    for (const h of this.hooks) if (this.s >= h.s) { h.fn(); }
    this.hooks = this.hooks.filter((h) => this.s < h.s);
    const end = tr.at(tr.length);
    if (tr.length - this.s < 0.3 || (tr.length - this.s < 1.2 && Math.hypot(f.x - end[0], f.z - end[2]) < 0.35)) {
      this.phase = 'face';
      this.faceT = 0;
      this.v = 0;
      return null;
    }
    // ease in (accelerate), then hold the track's limit (which brakes for bends, stairs and the end)
    const want = Math.max(1.2, tr.limit(this.s));
    this.v = Math.min(want, this.v + 10 * dt);
    const v = Math.max(this.v, 1.2);
    // pure pursuit: head for a point a little further along the way
    const carrot = tr.at(this.s + THREE.MathUtils.clamp(0.45 + v * 0.1, 0.6, 3));
    let dx = carrot[0] - f.x, dz = carrot[2] - f.z;
    const d = Math.hypot(dx, dz) || 1;
    const stepLen = Math.min(v * dt, Math.max(d, 0.05));
    dx = (dx / d) * stepLen; dz = (dz / d) * stepLen;
    // the view turns toward where the way goes (a few metres on), and levels out
    this.turnToward(tr.at(this.s + 2.5 + v * 0.35), dt, 4, true);
    // stuck (a pillar's corner, a pilgrim): after 0.8 s of little progress along the way, step on to the next node
    const progress = this.s - this.sLast;
    this.sLast = this.s;
    this.stall = progress < v * dt * 0.25 ? this.stall + dt : Math.max(0, this.stall - dt);
    if (this.stall > 0.8) this.nudge();
    return { x: dx, z: dz };
  }

  /** put the pilgrim on the next node of the way (on its floor: never inside anything) */
  private nudge() {
    const g = this.world.nav!, route = this.info!.nodes;
    this.stall = 0;
    this.info!.nudges = ++this.nudges;
    this.info!.stalls.push(this.world.feet.toArray().map((v) => Math.round(v * 100) / 100) as Vec3);
    if (this.nudges > 8) { this.stop(); return; }
    const k = this.nodeS.findIndex((s, i) => i > 0 && s > this.s + 0.3);
    if (k < 0) return;
    const n = g.nodes[route[k - 1]];
    const y = this.world.groundAt(n[0], n[2], n[1] + 0.3) ?? n[1];
    this.world.feet.set(n[0], y, n[2]);
    this.sLast = this.nodeS[k];
    this.s = this.nodeS[k];
    for (const h of this.hooks) if (this.s >= h.s) h.fn();
    this.hooks = this.hooks.filter((h) => this.s < h.s);
  }

  /** turn the view toward a point (or, with none, just level it); `level`: look along the way, not at it */
  private turnToward(p: Vec3 | null, dt: number, rate: number, level = false) {
    const cam = this.world.camera;
    this.euler.setFromQuaternion(cam.quaternion, 'YXZ');
    const k = 1 - Math.exp(-dt * rate);
    let yaw = this.euler.y, pitch = this.euler.x;
    if (p) {
      const f = this.world.feet;
      const dx = p[0] - f.x, dz = p[2] - f.z, h = Math.hypot(dx, dz);
      if (h > 0.2) {
        const want = Math.atan2(-dx, -dz);
        yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * k;
      }
      // along the way: a slight downward look, tilted with the slope; at a place: at the thing itself
      const wantPitch = level
        ? THREE.MathUtils.clamp(Math.atan2(p[1] - f.y, Math.max(h, 1)) * 0.6 - 0.04, -0.35, 0.3)
        : Math.atan2(p[1] - (f.y + 1.62), Math.max(h, 0.5));
      pitch += (wantPitch - pitch) * k;
    } else {
      pitch += (0 - pitch) * k;
    }
    this.euler.set(THREE.MathUtils.clamp(pitch, -1.45, 1.45), yaw, 0, 'YXZ');
    cam.quaternion.setFromEuler(this.euler);
  }
}

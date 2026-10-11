import * as THREE from 'three';
import { Merger } from './merge';
import type { SM } from './mats';
import { WALL, GOPURAMS, TERRACE } from './layout';
import { buildGopuram } from './gopuram';
import { mergeAll } from './geo';

/**
 * The outer prakara: 8.5 m walls of unmortared dressed quartzite, carved on the outside with
 * courses of relief panels, plain inside, a coping and a crest of round-topped merlons, broken
 * by the four gopurams. The west wall also retains the Bhramaramba terrace.
 */
export function buildPrakara(B: Merger, K: SM) {
  const { x0, x1, z0, z1, T, H } = WALL;
  const tops: number[] = [];
  // each gopuram's dense sculpture (figures, niches, recess pilasters) goes into its own merger so it can
  // be dropped beyond ~75 m, where the tiers' bays, cornices and miniature shrines carry the form alone
  const details: { m: Merger; x: number; z: number }[] = [];
  for (const g of Object.values(GOPURAMS)) {
    const D = new Merger(B.P, 'gopuram-detail');
    tops.push(buildGopuram(B, K, g, { x: g.x, y: g.y, z: g.z, ry: g.ry }, D).top);
    details.push({ m: D, x: g.x, z: g.z });
  }
  // merlon: a block with a rounded top, 0.8 wide
  const merlon = (() => {
    const box = new THREE.BoxGeometry(0.8, 0.55, T * 0.55).translate(0, 0.275, 0).toNonIndexed();
    const cap = new THREE.CylinderGeometry(0.4, 0.4, T * 0.55, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).toNonIndexed();
    // the half-cylinder spans x ∈ [-0.4, 0.4] after rotation; lift onto the block
    cap.translate(0, 0.55, 0);
    box.deleteAttribute('uv'); cap.deleteAttribute('uv');
    return mergeAll([box, cap]);
  })();

  /** a straight wall run from a to b (along x if horizontal, else along z), outward normal sign */
  const run = (horiz: boolean, c: number, a: number, b: number, out: number, base = 0, extra = 0) => {
    if (b - a < 0.5) return;
    const len = b - a, mid = (a + b) / 2, h = H + extra;
    const half = T / 2;
    // outer carved slab, inner plain slab
    if (horiz) {
      B.box(K.prakaraCarved, len, h, half, mid, base, c + out * half / 2);
      B.box(K.prakara, len, h, half, mid, base, c - out * half / 2);
      B.box(K.prakara, len, 0.45, T + 0.6, mid, base, c); // footing course
      B.box(K.prakara, len, 0.3, T + 0.25, mid, base + h, c); // coping
      B.solid(a, base, c - T / 2 - 0.3, b, base + h + 1.2, c + T / 2 + 0.3);
    } else {
      B.box(K.prakaraCarved, half, h, len, c + out * half / 2, base, mid);
      B.box(K.prakara, half, h, len, c - out * half / 2, base, mid);
      B.box(K.prakara, T + 0.6, 0.45, len, c, base, mid);
      B.box(K.prakara, T + 0.25, 0.3, len, c, base + h, mid);
      B.solid(c - T / 2 - 0.3, base, a, c + T / 2 + 0.3, base + h + 1.2, b);
    }
    const n = Math.floor(len / 1.3);
    for (let i = 0; i < n; i++) {
      const t = a + (i + 0.5) * (len / n);
      if (horiz) B.place(K.prakara, merlon, t, base + h + 0.3, c, 0);
      else B.place(K.prakara, merlon, c, base + h + 0.3, t, Math.PI / 2);
    }
  };
  const e = GOPURAMS.east, n = GOPURAMS.north, s = GOPURAMS.south, w = GOPURAMS.west;
  // north and south walls (horizontal runs along x)
  run(true, z0, x0 - T / 2, n.x - n.W / 2, -1);
  run(true, z0, n.x + n.W / 2, x1 + T / 2, -1);
  run(true, z1, x0 - T / 2, s.x - s.W / 2, 1);
  run(true, z1, s.x + s.W / 2, x1 + T / 2, 1);
  // east wall
  run(false, x1, z0 + T / 2, e.z - e.W / 2, 1);
  run(false, x1, e.z + e.W / 2, z1 - T / 2, 1);
  // west wall: carries the terrace, so it stands higher from the courtyard
  run(false, x0, z0 + T / 2, w.z - w.W / 2, -1, 0, TERRACE.h);
  run(false, x0, w.z + w.W / 2, z1 - T / 2, -1, 0, TERRACE.h);
  return { gopuramTops: tops, details };
}

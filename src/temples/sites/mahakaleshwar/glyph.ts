import * as THREE from 'three';

/**
 * Turn a glyph rasterised on a canvas into smooth extruded geometry:
 * marching squares over the alpha channel (with linear interpolation along cell edges),
 * segments joined into closed loops, loops simplified, then classified into outlines and
 * holes and extruded with a rounded bevel. `size` is the glyph box height in metres.
 */
export function glyphGeometry(text: string, font: string, size: number, depth: number, bevel: number): THREE.BufferGeometry {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font.replace('{px}', String(Math.round(N * 0.82)));
  g.fillText(text, N / 2, N * 0.56);
  const data = g.getImageData(0, 0, N, N).data;
  const v = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : data[(y * N + x) * 4 + 3] / 255);
  const T = 0.5;

  // marching squares: collect segments between interpolated edge points
  const key = (p: [number, number]) => `${Math.round(p[0] * 64)},${Math.round(p[1] * 64)}`;
  const segs: [[number, number], [number, number]][] = [];
  for (let y = -1; y < N; y++) {
    for (let x = -1; x < N; x++) {
      const a = v(x, y), b = v(x + 1, y), cc = v(x + 1, y + 1), d = v(x, y + 1);
      const idx = (a > T ? 8 : 0) | (b > T ? 4 : 0) | (cc > T ? 2 : 0) | (d > T ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const lerp = (p: number, q: number) => (T - p) / (q - p);
      const top: [number, number] = [x + lerp(a, b), y];
      const right: [number, number] = [x + 1, y + lerp(b, cc)];
      const bottom: [number, number] = [x + lerp(d, cc), y + 1];
      const left: [number, number] = [x, y + lerp(a, d)];
      const add = (p: [number, number], q: [number, number]) => segs.push([p, q]);
      switch (idx) {
        case 1: add(left, bottom); break;
        case 2: add(bottom, right); break;
        case 3: add(left, right); break;
        case 4: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: add(top, bottom); break;
        case 7: add(left, top); break;
        case 8: add(top, left); break;
        case 9: add(top, bottom); break;
        case 10: add(top, right); add(left, bottom); break;
        case 11: add(top, right); break;
        case 12: add(left, right); break;
        case 13: add(bottom, right); break;
        case 14: add(left, bottom); break;
      }
    }
  }
  // join segments into loops (undirected adjacency)
  const adj = new Map<string, number[]>();
  segs.forEach(([p, q], i) => {
    for (const k of [key(p), key(q)]) { if (!adj.has(k)) adj.set(k, []); adj.get(k)!.push(i); }
  });
  const used = new Uint8Array(segs.length);
  const loops: THREE.Vector2[][] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const loop: [number, number][] = [segs[s][0], segs[s][1]];
    let cur = segs[s][1];
    for (let guard = 0; guard < 20000; guard++) {
      const next = (adj.get(key(cur)) ?? []).find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = 1;
      const [p, q] = segs[next];
      cur = key(p) === key(cur) ? q : p;
      loop.push(cur);
    }
    if (loop.length > 8) loops.push(simplify(loop.map(([x, y]) => new THREE.Vector2((x / N - 0.5) * size, (0.5 - y / N) * size)), size / N * 0.35));
  }
  // classify: the largest-area loops are outlines; a loop inside another is a hole of it
  const area = (l: THREE.Vector2[]) => THREE.ShapeUtils.area(l);
  const inside = (pt: THREE.Vector2, poly: THREE.Vector2[]) => {
    let c2 = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c2 = !c2;
    }
    return c2;
  };
  const sorted = loops.filter((l) => Math.abs(area(l)) > (size / N) ** 2 * 4).sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
  const depthOf = sorted.map((l, i) => sorted.slice(0, i).filter((o) => inside(l[0], o)).length);
  const shapes: THREE.Shape[] = [];
  sorted.forEach((l, i) => {
    if (depthOf[i] % 2) return;
    const pts = area(l) < 0 ? l.slice().reverse() : l;
    const shape = new THREE.Shape(pts);
    sorted.forEach((h, j) => {
      if (depthOf[j] === depthOf[i] + 1 && inside(h[0], l)) {
        const hp = area(h) > 0 ? h.slice().reverse() : h;
        shape.holes.push(new THREE.Path(hp));
      }
    });
    shapes.push(shape);
  });
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 4,
  });
  geo.computeVertexNormals();
  return geo;
}

/** Ramer–Douglas–Peucker on a closed loop. */
function simplify(pts: THREE.Vector2[], eps: number): THREE.Vector2[] {
  if (pts.length < 4) return pts;
  const rdp = (a: number, b: number, out: THREE.Vector2[]) => {
    let dmax = 0, idx = -1;
    const A = pts[a], B = pts[b];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i].x - dx * pts[i].y + B.x * A.y - B.y * A.x) / len;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps && idx > 0) { rdp(a, idx, out); rdp(idx, b, out); } else out.push(B);
  };
  const mid = Math.floor(pts.length / 2);
  const out: THREE.Vector2[] = [pts[0]];
  rdp(0, mid, out);
  rdp(mid, pts.length - 1, out);
  // drop the duplicated closing point
  if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) < eps) out.pop();
  return out;
}

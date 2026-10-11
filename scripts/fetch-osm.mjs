// Fetches real map data round a temple from OpenStreetMap (Overpass API) and saves it, simplified, to
// public/data/osm/<id>.json for the site's town builder.
//
//   node scripts/fetch-osm.mjs <id> [radius_m=600] [lat lon]
//
// The centre defaults to the site's own `lat`/`lon` in src/temples/sites/<id>/index.ts. Coordinates are
// stored as local metres, east (e) and north (n) of that centre, on an equirectangular tangent plane
// (good to a few cm over 1 km); the site decides how to place them (origin, rotation) in its world.
//
// Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). The output
// carries the attribution; anything that shows it must credit "© OpenStreetMap contributors".
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [id, radiusArg, latArg, lonArg] = process.argv.slice(2);
if (!id) { console.error('usage: node scripts/fetch-osm.mjs <id> [radius_m=600] [lat lon]'); process.exit(1); }
const R = Number(radiusArg ?? 600);
let lat = Number(latArg), lon = Number(lonArg);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  const idx = join('src', 'temples', 'sites', id, 'index.ts');
  if (!existsSync(idx)) { console.error(`no ${idx}; pass lat lon`); process.exit(1); }
  const src = readFileSync(idx, 'utf8');
  lat = Number(src.match(/^\s*lat:\s*([-\d.]+)/m)?.[1]);
  lon = Number(src.match(/^\s*lon:\s*([-\d.]+)/m)?.[1]);
}
if (!Number.isFinite(lat) || !Number.isFinite(lon)) { console.error('could not find lat/lon'); process.exit(1); }

// metres per degree at this latitude (WGS84 ellipsoid)
const φ = (lat * Math.PI) / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ);
const M_LON = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ);
const dLat = R / M_LAT, dLon = R / M_LON;
const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(6)).join(',');
const toEN = (p) => [+((p.lon - lon) * M_LON).toFixed(2), +((p.lat - lat) * M_LAT).toFixed(2)];

const query = `[out:json][timeout:180][bbox:${bbox}];
(
  way["building"]; relation["building"];
  way["building:part"];
  way["highway"];
  way["natural"="water"]; relation["natural"="water"];
  way["water"]; way["landuse"~"reservoir|basin"];
  way["waterway"~"river|canal|stream|riverbank"]; way["waterway"="dock"];
  way["leisure"~"park|garden|playground|pitch|recreation_ground"]; relation["leisure"~"park|garden"];
  way["landuse"~"grass|recreation_ground|forest|village_green|meadow|orchard"];
  way["natural"~"wood|scrub|grassland|tree_row"];
  node["natural"="tree"];
  nwr["amenity"="place_of_worship"];
  nwr["historic"]; nwr["tourism"]; nwr["man_made"~"ghat|tower|water_tower"];
  nwr["name"~"[Gg]hat|घाट|[Kk]und|कुंड|[Ss]agar|सागर|[Dd]war|द्वार|Lok|लोक"];
);
out geom qt;`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(q) {
  for (let round = 0; round < 4; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': 'divya-yatra-fetch-osm/1.0', Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
          signal: AbortSignal.timeout(200000),
        });
        const text = await res.text();
        // (a busy server answers 200 with a partial result and a runtime-error remark: retry those too)
        const remark = text.slice(-600).match(/"remark":\s*"([^"]*)"/)?.[1];
        if (res.ok && text.trimStart().startsWith('{') && !/error/i.test(remark ?? '')) { console.log(`  ${url}: ${(text.length / 1e6).toFixed(1)} MB`); return JSON.parse(text); }
        console.log(`  ${url}: HTTP ${res.status} ${(remark ?? text.slice(0, 200)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120)}`);
      } catch (e) { console.log(`  ${url}: ${e.message}`); }
    }
    await new Promise((r) => setTimeout(r, 8000 * (round + 1)));
  }
  throw new Error('every Overpass endpoint failed');
}

/** Douglas-Peucker on [e, n] points */
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** Sutherland-Hodgman: clip a ring to the square |e|,|n| <= L (big rivers and lakes reach far outside) */
function clipRing(p, L) {
  const edges = [[(q) => q[0] >= -L, (a, b) => (-L - a[0]) / (b[0] - a[0])], [(q) => q[0] <= L, (a, b) => (L - a[0]) / (b[0] - a[0])],
    [(q) => q[1] >= -L, (a, b) => (-L - a[1]) / (b[1] - a[1])], [(q) => q[1] <= L, (a, b) => (L - a[1]) / (b[1] - a[1])]];
  for (const [inside, t] of edges) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length], b = p[i];
      const ia = inside(a), ib = inside(b);
      const cut = () => { const k = t(a, b); return [+(a[0] + (b[0] - a[0]) * k).toFixed(2), +(a[1] + (b[1] - a[1]) * k).toFixed(2)]; };
      if (ib) { if (!ia) out.push(cut()); out.push(b); } else if (ia) out.push(cut());
    }
    p = out;
    if (p.length < 3) return null;
  }
  return p;
}
/** closed ring: drop the repeated last point, simplify, and orient counter-clockwise (e right, n up) */
function ring(geom, tol) {
  let p = geom.map(toEN);
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  // (split at the vertex farthest from the first, so Douglas-Peucker never sees a zero-length chord)
  let k = 0, far = -1;
  p.forEach((q, i) => { const d = Math.hypot(q[0] - p[0][0], q[1] - p[0][1]); if (d > far) { far = d; k = i; } });
  p = [...simplify(p.slice(0, k + 1), tol).slice(0, -1), ...simplify([...p.slice(k), p[0]], tol).slice(0, -1)];
  if (p.length < 3) return null;
  let a = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; }
  if (Math.abs(a) < 0.5) return null;
  if (p.some((q) => Math.abs(q[0]) > R * 1.2 || Math.abs(q[1]) > R * 1.2)) p = clipRing(p, R * 1.2);
  if (!p) return null;
  return a < 0 ? p.reverse() : p;
}
const line = (geom, tol) => simplify(geom.map(toEN), tol);
/** join a relation's member ways into closed rings */
function stitch(ways) {
  const segs = ways.map((w) => w.slice()), rings = [];
  const same = (a, b) => Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9;
  while (segs.length) {
    let cur = segs.shift();
    let grew = true;
    while (!same(cur[0], cur[cur.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], end = cur[cur.length - 1];
        if (same(s[0], end)) cur = cur.concat(s.slice(1));
        else if (same(s[s.length - 1], end)) cur = cur.concat(s.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    if (same(cur[0], cur[cur.length - 1])) rings.push(cur);
  }
  return rings;
}
const inBox = (p) => Math.abs(p[0]) < R * 1.15 && Math.abs(p[1]) < R * 1.15;

/** carriageway width estimate (m) by road class when OSM has no width / lanes */
const ROAD_W = { trunk: 12, primary: 11, secondary: 9, tertiary: 7.5, unclassified: 6, residential: 5.5, living_street: 4.5,
  service: 4, pedestrian: 6, footway: 2.5, path: 2, steps: 2.5, track: 3, cycleway: 2.5, corridor: 2.5 };
const num = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : undefined; };

console.log(`fetch-osm ${id}: centre ${lat}, ${lon}, ±${R} m`);
const data = process.env.OSM_RAW && existsSync(process.env.OSM_RAW) ? JSON.parse(readFileSync(process.env.OSM_RAW, 'utf8')) : await overpass(query);
if (process.env.OSM_RAW && !existsSync(process.env.OSM_RAW)) writeFileSync(process.env.OSM_RAW, JSON.stringify(data)); // (OSM_RAW=file caches the raw answer)
const out = {
  id, source: 'OpenStreetMap via Overpass API', license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors',
  copyright: 'https://www.openstreetmap.org/copyright', fetched: new Date().toISOString().slice(0, 10),
  center: { lat, lon }, radius: R, units: 'metres east (e) / north (n) of the centre',
  buildings: [], roads: [], water: [], waterways: [], green: [], areas: [], trees: [], pois: [],
};
const seen = new Set();
const name = (t) => t['name:en'] || t.name;
for (const el of data.elements) {
  const t = el.tags ?? {}, key = el.type + el.id;
  if (seen.has(key)) continue; seen.add(key);
  const rings = el.type === 'way' && el.geometry ? [el.geometry]
    : el.type === 'relation' && el.members ? stitch(el.members.filter((m) => m.type === 'way' && m.geometry && m.role !== 'inner').map((m) => m.geometry)) : [];
  const holes = el.type === 'relation' && el.members ? stitch(el.members.filter((m) => m.type === 'way' && m.geometry && m.role === 'inner').map((m) => m.geometry)) : [];
  const closed = el.type === 'way' && el.geometry && el.geometry.length > 3 && el.geometry[0].lat === el.geometry.at(-1).lat && el.geometry[0].lon === el.geometry.at(-1).lon;

  // POIs: named places of worship, ghats, gates, sights (nodes, or the centre of an area)
  const isPoi = t.amenity === 'place_of_worship' || t.historic || t.tourism || /ghat|tower/.test(t.man_made ?? '')
    || /[Gg]hat|घाट|[Kk]und|कुंड|[Dd]war|द्वार/.test(t.name ?? '');
  if (isPoi && (t.name || t['name:en'])) {
    let c;
    if (el.type === 'node') c = toEN(el);
    else { const g = rings[0] ?? el.geometry; if (g) { const p = g.map(toEN); c = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length].map((v) => +v.toFixed(1)); } }
    if (c && inBox(c)) out.pois.push({ e: c[0], n: c[1], name: name(t), ...(t.name && t['name:en'] && t.name !== t['name:en'] ? { local: t.name } : {}), ...(t['name:hi'] ? { hi: t['name:hi'] } : {}),
      kind: t.amenity === 'place_of_worship' ? `worship${t.religion ? ':' + t.religion : ''}` : t.historic ? `historic:${t.historic}` : t.tourism ? `tourism:${t.tourism}` : t.man_made ?? 'place', osm: key });
  }
  // named precinct / attraction outlines (a temple's compound, a corridor's extent)
  if ((t.amenity === 'place_of_worship' || t.tourism || t.historic) && (t.name || t['name:en']) && (closed || el.type === 'relation') && !t.building) {
    for (const g of rings) {
      const p = ring(g, 0.4);
      if (p && p.some(inBox)) out.areas.push({ p, kind: t.amenity === 'place_of_worship' ? 'worship' : t.tourism ? `tourism:${t.tourism}` : `historic:${t.historic}`, name: name(t), ...(t.name !== name(t) ? { local: t.name } : {}) });
    }
  }
  if (el.type === 'node') {
    if (t.natural === 'tree') { const p = toEN(el); if (inBox(p)) out.trees.push(p); }
    continue;
  }

  if (t.building || t['building:part']) {
    for (const g of rings) {
      const p = ring(g, 0.25);
      if (!p || !p.some(inBox)) continue;
      const b = { p };
      const lv = num(t['building:levels']), h = num(t.height), mh = num(t['min_height']);
      if (lv) b.lv = lv; if (h) b.h = h; if (mh) b.minH = mh;
      if (t['roof:shape'] && t['roof:shape'] !== 'flat') b.roof = t['roof:shape'];
      const kind = t.building && t.building !== 'yes' ? t.building : t.amenity || t.shop ? (t.amenity || 'shop') : undefined;
      if (kind) b.kind = kind;
      if (t['building:part']) b.part = 1;
      if (name(t)) b.name = name(t);
      if (t.religion || t.amenity === 'place_of_worship') b.worship = 1;
      if (holes.length) b.holes = holes.map((hg) => ring(hg, 0.25)).filter(Boolean);
      out.buildings.push(b);
    }
    continue;
  }
  if (t.highway && el.type === 'way') {
    if (t.area === 'yes' && closed) {
      const p = ring(el.geometry, 0.4);
      if (p && p.some(inBox)) out.green.push({ p, kind: `plaza:${t.highway}`, ...(name(t) ? { name: name(t) } : {}) });
      continue;
    }
    if (/^(proposed|construction|platform|bus_stop|elevator|street_lamp|traffic_signals|crossing)$/.test(t.highway)) continue;
    const p = line(el.geometry, 0.5);
    if (!p.some(inBox)) continue;
    const lanes = num(t.lanes);
    const cls = ROAD_W[t.highway.replace('_link', '')] ?? 4;
    const w = num(t.width) ?? num(t['est_width']) ?? (lanes ? Math.max(lanes * 3.2, cls * 0.75) : cls);
    const r = { p, hw: t.highway, w: +w.toFixed(1) };
    if (name(t)) r.name = name(t);
    if (t.surface) r.surface = t.surface;
    if (t.oneway === 'yes') r.oneway = 1;
    if (t.bridge && t.bridge !== 'no') r.bridge = 1;
    if (t.tunnel && t.tunnel !== 'no') r.tunnel = 1;
    if (t.layer) r.layer = num(t.layer);
    out.roads.push(r);
    continue;
  }
  const watery = t.natural === 'water' || t.water || /reservoir|basin/.test(t.landuse ?? '') || t.waterway === 'riverbank' || t.waterway === 'dock';
  if (watery) {
    for (const g of rings) {
      const p = ring(g, 0.5);
      if (!p || !p.some(inBox)) continue;
      const wv = { p, kind: t.water || t.waterway || t.landuse || 'water' };
      if (name(t)) wv.name = name(t);
      if (t.name && t.name !== wv.name) wv.local = t.name;
      if (holes.length) wv.holes = holes.map((hg) => ring(hg, 0.5)).filter(Boolean);
      out.water.push(wv);
    }
    continue;
  }
  if (t.waterway && el.type === 'way') {
    const p = line(el.geometry, 1);
    if (!p.some(inBox)) continue;
    out.waterways.push({ p, kind: t.waterway, w: num(t.width) ?? (t.waterway === 'river' ? 60 : t.waterway === 'canal' ? 8 : 3), ...(name(t) ? { name: name(t) } : {}) });
    continue;
  }
  const greenKind = t.leisure || (/grass|recreation_ground|forest|village_green|meadow|orchard/.test(t.landuse ?? '') && t.landuse) || (/wood|scrub|grassland/.test(t.natural ?? '') && t.natural);
  if (greenKind) {
    if (t.natural === 'tree_row') { const p = line(el.geometry, 1); if (p.some(inBox)) out.green.push({ p, kind: 'tree_row', line: 1 }); continue; }
    for (const g of rings) {
      const p = ring(g, 0.5);
      if (!p || !p.some(inBox)) continue;
      out.green.push({ p, kind: greenKind, ...(name(t) ? { name: name(t) } : {}) });
    }
  }
}

const dir = join('public', 'data', 'osm');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.json`);
// compact: one feature per line, so diffs stay readable
const lines = ['{'];
const keys = Object.keys(out);
keys.forEach((k, i) => {
  const v = out[k], last = i === keys.length - 1 ? '' : ',';
  if (Array.isArray(v)) {
    lines.push(`"${k}": [`);
    v.forEach((f, j) => lines.push(JSON.stringify(f) + (j < v.length - 1 ? ',' : '')));
    lines.push(']' + last);
  } else lines.push(`"${k}": ${JSON.stringify(v)}${last}`);
});
lines.push('}');
writeFileSync(file, lines.join('\n') + '\n');
console.log(`${file}: ${out.buildings.length} buildings (${out.buildings.filter((b) => b.lv || b.h).length} with levels/height), ${out.roads.length} roads, `
  + `${out.water.length} water, ${out.waterways.length} waterways, ${out.green.length} green, ${out.areas.length} areas, ${out.trees.length} trees, ${out.pois.length} POIs`);
for (const p of out.pois.filter((p) => /worship|ghat|historic|tourism/.test(p.kind)).slice(0, 40)) console.log(`  ${p.kind.padEnd(22)} ${String(p.e).padStart(7)} ${String(p.n).padStart(7)}  ${p.name}${p.local ? ' / ' + p.local : ''}`);

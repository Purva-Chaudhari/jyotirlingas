/**
 * OpenStreetMap data for a site, as written by scripts/fetch-osm.mjs to public/data/osm/<id>.json.
 * Data © OpenStreetMap contributors, ODbL 1.0 — whatever shows it must credit them (see temples.html).
 *
 * Coordinates in the file are metres east (e) and north (n) of the fetch centre. A site places them in
 * its own world with project(): a translation (and, if the site's axes are turned, a rotation).
 * Written to be copied as-is to other sites (sites don't import across folders).
 */

export type EN = [number, number];
export type XZ = [number, number];

export interface OsmBuilding { p: EN[]; lv?: number; h?: number; minH?: number; roof?: string; kind?: string; part?: 1; name?: string; worship?: 1; holes?: EN[][] }
export interface OsmRoad { p: EN[]; hw: string; w: number; name?: string; surface?: string; oneway?: 1; bridge?: 1; tunnel?: 1; layer?: number }
export interface OsmArea { p: EN[]; kind: string; name?: string; local?: string; holes?: EN[][] }
export interface OsmLine { p: EN[]; kind: string; w: number; name?: string }
export interface OsmPoi { e: number; n: number; name: string; local?: string; hi?: string; kind: string; osm: string }

export interface OsmData {
  id: string; license: string; attribution: string; fetched: string;
  center: { lat: number; lon: number }; radius: number;
  buildings: OsmBuilding[]; roads: OsmRoad[]; water: OsmArea[]; waterways: OsmLine[];
  green: (OsmArea & { line?: 1 })[]; areas: OsmArea[]; trees: EN[]; pois: OsmPoi[];
}

/** Fetch public/data/osm/<id>.json (null if it is missing or the fetch fails, e.g. in tests). */
export async function loadOsm(id: string): Promise<OsmData | null> {
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    const r = await fetch(`${base}data/osm/${id}.json`);
    if (!r.ok) return null;
    return (await r.json()) as OsmData;
  } catch {
    return null;
  }
}

/**
 * The site's placement of the data: world x = east, world z = south (three.js, y up). (E0, N0) is the
 * point of the data that becomes the world origin; rotDeg turns the data clockwise seen from above
 * (for sites whose model axes are not true north).
 */
export function projector(E0: number, N0: number, rotDeg = 0) {
  const c = Math.cos((rotDeg * Math.PI) / 180), s = Math.sin((rotDeg * Math.PI) / 180);
  return ([e, n]: EN): XZ => {
    const x = e - E0, z = -(n - N0);
    return [x * c - z * s, x * s + z * c];
  };
}

/** Signed area of a ring in x-z (positive = counter-clockwise with x right, z up the page). */
export function ringArea(p: XZ[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length]; a += x0 * z1 - x1 * z0; }
  return a / 2;
}

export function pointInRing(x: number, z: number, p: XZ[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

import type * as THREE from 'three';
import type { Materials } from '../engine/materials';
import type { Physics, Flames } from '../engine/kit';

/** [Devanagari line, English line, small italic subtitle] */
export type Caption = [string, string, string];

/** What a site's build() gets to work with. */
export interface SiteContext {
  /** add all meshes under this group */
  root: THREE.Group;
  /** shared materials (stone scans, silver, brass, marigold...) — do not mutate shared ones; clone if you need a variant */
  M: Materials;
  /** register colliders (P.solid) and walkable surfaces (P.floor / P.floors.push) */
  P: Physics;
  /** push diya flame positions / flickering point lights here */
  flames: Flames;
  /** initial sun direction (final one arrives via BuiltSite.setSun) */
  sunDir: THREE.Vector3;
  renderer: THREE.WebGLRenderer;
  /** push async loads (textures, models) here; the world waits for them before you enter */
  pending: Promise<unknown>[];
  /**
   * warm lamp-lit reflection environment (PMREM) — assign to your sanctum metals/polished stone:
   * `mat.envMap = ctx.interiorEnv; mat.envMapIntensity = 1.6` so they mirror lamplight, not the sky
   */
  interiorEnv: THREE.Texture;
  /**
   * override the bloom strength (e.g. lower it inside a lamp-lit sanctum so flames and wet stone
   * don't flare); pass null to restore the default
   */
  setBloom(strength: number | null): void;
}

export interface BuiltSite {
  /** where the pilgrim appears: feet position and a point to look at */
  spawn: { feet: [number, number, number]; look: [number, number, number] };
  /** per-frame animation (flags, water...) */
  update?(t: number): void;
  /** called when the real sun direction is known (e.g. to update water glints) */
  setSun?(dir: THREE.Vector3): void;
  /** which named zone the pilgrim's feet are in, or null for the default */
  zoneAt?(feet: THREE.Vector3): string | null;
  /**
   * called when the zone changes — use it to hide the exterior (town, terrain, water,
   * spire) inside closed sanctums/underground passages and to switch interior lights on,
   * so enclosed rooms don't pay for the whole world (see mahakaleshwar lightZones)
   */
  onZoneChange?(zone: string): void;
  /**
   * named points along the pilgrimage (feet position, where to look) for story stops and the darshan spot;
   * src/temples/stories/anchors.ts falls back to these by stop id / feature / zone name
   */
  stops?: Record<string, { feet: [number, number, number]; look: [number, number, number]; note?: string }>;
  /**
   * doorways you can open: standing within `radius` of `at` shows a prompt ("E · <label>"); pressing E
   * (or clicking the prompt) runs `use()` (e.g. swing a barricade aside) and, with a short fade, takes you
   * to `to`
   */
  portals?: Portal[];
  /**
   * walkable ways for the guide pill (src/temples/stories/guide.ts), in walking order. While the pilgrim is on
   * one, the guide leads along it (to the next unheard story ahead on it, else the darshan spot or its end)
   * instead of pointing in a straight line through walls and floors
   */
  guidePaths?: GuidePath[];
  /**
   * the walking graph for "Places" (src/temples/engine/travel.ts): nodes on the walkable floors, edges that can be
   * walked in a straight line. Picking a place walks the pilgrim there along it, fast-forwarded
   */
  nav?: NavGraph;
  /** the places offered in the Places list (T), each at a node of `nav` */
  places?: Place[];
}

/**
 * A site's walking graph (see the comment at the top of src/temples/engine/travel.ts and docs/content/navigation.md).
 * Node: feet position [x, y (the floor), z]. Edge: two node ids, walkable both ways in a straight line (a stair or
 * ramp is fine), optionally with a hook run just before walking it (open a gate) and an extra cost (m) to avoid it.
 */
export interface NavGraph {
  nodes: Record<string, [number, number, number]>;
  edges: NavEdge[];
}
export type NavEdge = [a: string, b: string] | [a: string, b: string, opts: { before?: () => void; cost?: number }];

export interface Place {
  id: string;
  label: { hi: string; en: string };
  /** the nav node it is at */
  node: string;
  /** what to face on arrival */
  look?: [number, number, number];
}

export interface GuidePath {
  /** waypoints [x, y (floor), z] in walking order */
  points: [number, number, number][];
  /** how far (m, horizontally) from the line you still count as on it; default 1.5 */
  reach?: number;
}

export interface Portal {
  at: [number, number, number];
  radius: number;
  label: { hi: string; en: string };
  to: { feet: [number, number, number]; look: [number, number, number] };
  use?(): void;
}

export interface SiteDef {
  id: string;
  name: { en: string; hi: string };
  /** temple coordinates for the globe flight */
  lon: number;
  lat: number;
  /** captions shown at flight beats: 0 = space, 2 = region, 3 = city */
  flight: Partial<Record<number, Caption>>;
  /** caption shown when entering a zone returned by zoneAt(); key 'garbhagriha' also rings bells */
  zones: Record<string, Caption>;
  /** neem/other trees from the shared scanned model: [x, z, height m] */
  trees?: [number, number, number][];
  /** sky HDRI path under public/ (Poly Haven .hdr); default a plains sunset */
  hdri?: string;
  /** colour grade before tone mapping: saturation and brightness (default 1, 1); AgX greys colour, so a site
   * photographed in clear mountain light may want more */
  grade?: { saturation?: number; exposure?: number };
  /** distance fog; default warm { color: 0xcdb8a4, near: 120, far: 900 }; null = no fog */
  fog?: { color: THREE.ColorRepresentation; near: number; far: number } | null;
  /** minimum sun elevation in degrees (raises a low HDRI sun to cut glare); default 28 */
  sunElevationMin?: number;
  /** sun light colour / intensity; default 0xffd6a8 / 3.2 */
  sunColor?: THREE.ColorRepresentation;
  sunIntensity?: number;
  /** camera far plane in metres; default 3000 (raise for distant mountains) */
  far?: number;
  /** where the sun sits relative to the site (radians, atan2(x, z)); default front-left */
  sunAzimuth?: number;
  build(ctx: SiteContext): BuiltSite;
}

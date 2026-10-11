/**
 * Plan of the Srisailam complex, metres. Origin = the Jyotirlinga, at courtyard ground level.
 * +x = east (the main Rajagopuram, the town street), −x = west (Bhramaramba), −z = north
 * (Shivaji gopuram; the Krishna gorge beyond), +z = south (queue complex side).
 *
 * Measured from satellite imagery (≈0.3 m/px) and checked against the published outer-wall
 * size (183 × 152 m, 8.5 m high — Wikipedia): the enclosure here is 158 m E–W × 197 m N–S,
 * the shrine sits ~65 m inside the east wall and ~93 m from the west wall; Bhramaramba stands
 * ~80 m west on a terrace raised above the main court, the north gopuram is nearly in line
 * with the sanctum, the south gopuram ~34 m west of it.
 */
export const WALL = { x0: -93, x1: 65, z0: -112, z1: 85, T: 1.9, H: 8.5 };

export const TERRACE = { x0: -91.05, x1: -60, z0: -27, z1: 27, h: 2.4 };

export interface GopDef { x: number; z: number; y: number; ry: number; W: number; D: number; hb: number; tiers: number; towerH: number; kalashas: number; white?: boolean }
export const GOPURAMS: Record<'east' | 'north' | 'south' | 'west', GopDef> = {
  // the main (Raja) gopuram on the east, whitewashed (on the axis behind Bhramaramba in the 2025 west-side photo), the tallest: 7 storeys
  east: { x: WALL.x1, z: 0, y: 0, ry: Math.PI / 2, W: 25.3, D: 16.1, hb: 11.04, tiers: 7, towerH: 31.05, kalashas: 11, white: true },
  // Shivaji gopuram (1677) on the north
  north: { x: 6, z: WALL.z0, y: 0, ry: Math.PI, W: 17.82, D: 12.65, hb: 10.12, tiers: 5, towerH: 21.27, kalashas: 9 },
  south: { x: -34, z: WALL.z1, y: 0, ry: 0, W: 17.82, D: 12.65, hb: 10.12, tiers: 6, towerH: 24.15, kalashas: 9 },
  // west gopuram behind Bhramaramba, threshold at the terrace level
  west: { x: WALL.x0, z: -16, y: TERRACE.h, ry: -Math.PI / 2, W: 20.7, D: 13.8, hb: 9.89, tiers: 7, towerH: 24.15, kalashas: 9 },
};

/** Mallikarjuna shrine: square sanctum + vimana, antarala, mukha mandapa (east) */
export const SHRINE = {
  half: 4.6, // outer half-width of the sanctum walls
  inner: 1.65, // inner half-width of the garbhagriha
  plinth: 0.9, // floor level of sanctum and mandapa
  wallTop: 5.3, // where the gold begins (granite wall ≈ half the gold height, as photographed)
  antX1: 7.8, // antarala east end
  mandX0: 7.8, mandX1: 22.2, mandZ: 7.2, mandH: 5.6, // mukha mandapa
  doorW: 1.1, doorH: 2.15,
};
export const NANDI_M = { x0: 28.4, x1: 40.4, z: 6.3, plinth: 0.75, h: 5.1 };
export const DHWAJA = { x: 25.0 };
/** inner court with its pillared cloister (north, south, west) */
export const INNER = { x0: -22, x1: 46, z0: -22, z1: 22, depth: 3.6, h: 4.2 };
/** spawn: outside the east gopuram, on the temple street */
export const SPAWN = { x: 92, z: 2.5 };

/**
 * Where story stops sit in each temple, in the site's own metres (read from the site files: spawn,
 * zoneAt() boxes, layout constants). Kept here so the site folders stay untouched.
 *
 * STOPS[site][key] = [x, y, z, radius]: key is a stop id, a stop's `at.feature`, or a zone name (looked up
 * in that order). y is the walking floor there (the marker settles on the real floor below y + 1.5).
 * A stop triggers inside the radius (and within 2.5 m of y), or anywhere in its `at.zone`.
 *
 * Anything not listed falls back to the site's own BuiltSite.stops (feet position, radius 3).
 *
 * DARSHAN[site]: where the Jyotirlinga is seen. Reaching it (radius, or one of its zones) marks the temple
 * visited and plays the aarti from `source` (the lingam).
 */
export type Anchor = [x: number, y: number, z: number, radius: number];

export interface Darshan {
  /** the spot the pilgrim stands at for darshan: [x, y, z, radius] */
  at: Anchor;
  /** zones that also count as having had darshan */
  zones: string[];
  /** the lingam: where the aarti sounds from */
  source: [number, number, number];
  /** the story stop the real route leads to right after darshan (the guide goes there next) */
  then?: string;
}

export const STOPS: Record<string, Record<string, Anchor>> = {
  somnath: {
    // +z east (the Digvijay Dwar approach), +x north; jagati top 1.2, sanctum floor 1.8
    dwar: [2, 0, 101, 5],
    temple: [3.2, 1.2, 54.5, 5], // top of the front steps, off the axis
    garbhagriha: [2.8, 1.8, 2.8, 2.5], // beside, never in front of, the lingam
    baan: [-55, 0, 9, 6],
    sea: [-6, 0, -45, 7],
  },
  mallikarjuna: {
    // +x east (Rajagopuram, temple street), origin = the Jyotirlinga; sanctum/mandapa floor 0.9
    courtyard: [86, 0, 4.5, 5],
    gopuram: [65, 0, 1.8, 4],
    prakara: [55, 0, 18, 5],
    court: [42, 0, 9, 4],
    nandi: [34.4, 0, 7.6, 3],
    mandapa: [19, 0.9, 4.5, 4],
    garbhagriha: [1.2, 0.9, 1.2, 2.2], // reaches the antarala doorway, where darshan is taken
    bhramaramba: [-66, 2.4, 4, 6],
    gundam: [-40, 0, 37, 5],
    shivaji: [6, 0, -104, 4],
  },
  mahakaleshwar: {
    // +z south; the general darshan route (site stops): queue → Tunnel-1 → Ganesh Mandapam → Palki Hall → exit court
    // → the hall (Omkareshwar, then up the west stair to Nagchandreshwar) → kund
    queue: [-2, 0, -46.5, 4], // in the north gate's passage, on the way in from the Mahakal Lok approach
    tunnel: [-9, 0, -20.6, 3], // just inside the portal mouth (-9, 0, -21.6)
    'ganesh-mandapam': [-2.6, -2.55, 2.5, 2.5], // on the front-row walk, beside the darshan platform
    palki: [4.5, -2.55, 14.8, 3],
    courtyard: [3.5, 0, 30, 4], // the exit court
    kund: [-34, 0, -1.4, 5], // Kotitirtha kund, north edge walk
    nandi: [-0.9, -3, -0.6, 1.6], // the Nandi hall, just past the platform's open gate (the threshold story)
    garbhagriha: [1.8, -3, -3.35, 2], // open to all in the virtual yatra; off the lingam's axis
    // the upper levels (upper.ts): Omkareshwar in the tower at the hall's level, off the linga's axis;
    // Nagchandreshwar on the top storey, inside its door, before the barricade
    'omkareshwar-shrine': [1.3, 0.9, -2.4, 2],
    nagchandreshwar: [0.9, 9.55, 1.2, 2.2],
  },
  omkareshwar: {
    // +z south (across the Narmada, the Jhoola Pul), the temple on Mandhata's cliff
    jhoola: [121, -4, 66, 5],
    darshan: [34, -4, 20.5, 4],
    ghat: [0, -12, 27.5, 6],
    temple: [0, 0, 1, 3],
    garbhagriha: [9.7, -0.45, -5.2, 2],
    upper: [0, 4.9, -8, 4],
  },
  nageshwar: {
    // +x east, −z north; outside ground −1, compound 0, hall PL 0.9, sanctum floor SF −0.3; walk: gate → statue → porch → hall → stair
    dwar: [-46, -1, -41, 5], // just outside the gate, by the spawn
    statue: [-25, 0, -58, 5], // the foot of the deck stair, looking up at the seated Shiva
    prangan: [-37, 0, -1, 5], // the forecourt in front of the porch steps
    temple: [-12, 0.9, 0, 4],
    nandi: [6.8, 0.9, 1.4, 2.2], // beside Nandi, at the head of the stair down
    garbhagriha: [12.9, -0.3, 1.0, 1.6], // inside the sanctum door, beside the linga
  },
  trimbakeshwar: {
    // +z east (Mahadwar), +x north; court 0, mandapa F 1.5, antarala steps 1.5 → 0.45, sanctum floor 0.45
    courtyard: [-2, 0, 42, 5], // just inside the Mahadwar (the spawn is in the street outside), the temple and Brahmagiri ahead
    kund: [-17, 0, -14, 5], // the north-east corner of the Amrit Kund
    nandi: [-3.5, 0, 24.5, 3],
    mandapa: [0, 1.5, 4, 4],
    antarala: [0, 1.0, -4.6, 1.0], // on the steps down (the zone there is 'antarala', so the mandapa story yields)
    garbhagriha: [0, 0.45, -6.4, 1.0], // the lower antarala landing, at the sanctum door and its mirror
  },
  kedarnath: {
    // +z south (the approach), +x east; square 0, temple floor 1.0; walk: plaza → round the back (Bhim Shila,
    // the Samadhi through the wall gate) → Nandi → mandapa → sanctum
    plaza: [0, 0, 44, 6], // the head of the steps up from the approach street (the spawn), the temple ahead
    bhimshila: [-3, 0, -21, 4], // between the shrine's back wall and the boulder
    samadhi: [16, 0, -44, 4], // the walk from the wall gate to the head of the stair (the court below is zone 'samadhi')
    nandi: [2.2, 0, 16.8, 3.5], // behind Nandi, looking at the door
    mandapa: [1.5, 1.0, 2.5, 3],
    garbhagriha: [1.6, 1.0, -8.3, 2], // inside the sanctum door, beside the rock's kerb
  },
  grishneshwar: {
    // +z east, +x north; court 0, mandapa 1.5, sanctum floor 0.45; walk: court → out of the south gate → lane →
    // Shivalaya kund → back to the south steps → sabhamandapa → down to the sanctum
    prangan: [-21.5, 0, 25, 6], // inside the south gate (the spawn is in the lane outside it)
    lane: [-35, 0, 5, 5], // the village lane among the flower stalls, south of the gate on the way to the kund (clear of the spawn and the walk in)
    kund: [-56.5, 0, -10, 5], // the kund's east gate, looking down the steps
    porch: [-16, 0, 14, 4.5], // the court before the south porch steps
    sabhamandapa: [2.5, 1.5, 18, 3],
    garbhagriha: [-0.9, 0.45, 1.5, 1.8], // inside the cell, beside the linga
  },
  rameshwaram: {
    // +z east (street, Agni Theertham, the sea), +x north; origin = the Ramalingam; prakara 0.45, mandapams 0.9, garbhagriha 1.35
    agni: [0, 0, 340, 7], // the beach at the spawn
    gopuram: [0, 0, 125, 5], // the east entrance portico, facing the Rajagopuram
    corridor: [0, 0, 110, 5], // where the axis crosses the third corridor's east arm
    theertham: [-30, 0, 66, 6], // the theertham wells court, south of the Nandi mandapam
    nandi: [7, 0, 63, 5],
    vishwanatha: [10.6, 0.9, 6.6, 2.5], // the Kasi Viswanathar porch (Vishwalingam)
    garbhagriha: [0.35, 1.35, 3.9, 1.8], // the door passage, at the brass rail
  },
  'kashi-vishwanath': {
    // +z east (chowk, Ganga), +x north (Gyanvapi); origin = the linga; jagati 0.6, Gyanvapi mandap 0.45
    parisar: [5, 0, 21, 4], // inside the east gate (the zone fires at the gate; the spawn is in the chowk outside)
    chowk: [0, 0, 84, 9], // the river end of the chowk, on the way down to the Ganga Dwar (the spawn is at the parisar end)
    ganga: [0, -10, 144, 6], // the Ganga Dwar plaza
    ghat: [3, -15, 166.5, 5], // the lowest dry treads at Lalita Ghat
    gyanvapi: [17.6, 0.45, 3.4, 3], // beside the Nandi, south of the well
    temple: [-3, 0.6, 4.4, 2.5], // the east verandah, off the door's axis
    garbhagriha: [1.35, 0.6, 1.35, 1.5], // a corner of the cell, beside the basin
  },
  vaidyanath: {
    // +z east (Singh Dwar, the approach lane), +x north; origin = the sanctum's centre; plinth/sanctum floor 0.45
    lane: [0, 0, 50, 6], // the spawn, in the lane
    prangan: [0, 0, 34, 4], // just inside the Singh Dwar
    parvati: [9.6, 0, 20, 3.5], // the west flank of Maa Parvati's temple, under the gathbandhan
    tower: [0, 0, -7.8, 3.5], // behind the main temple, on the circuit
    porch: [3.5, 0.45, 8.8, 3], // on the porch, off the door's axis
    garbhagriha: [1.2, 0.45, 1.4, 1.6], // inside the cell, east of the linga
  },
  bhimashankar: {
    // +z east, +x north; origin = courtyard floor at the temple's centre; mandapa 0.6, sanctum -0.3
    village: [126, 29.7, -21.75, 6], // the spawn at the head of the stairway
    stairs: [103.8, 27.72, -21.75, 3], // the first landing down
    mokshakund: [-3.5, 0, -19.5, 3], // the north rim of the tank, behind the temple
    kusharanya: [-10, 0, -9.2, 2.5], // beside the spring's kerb, on the way round to the front
    bell: [-6.6, 0, 15, 2.5], // in front of Chimaji Appa's bell
    mandapa: [0, 0.6, 7, 3.5],
    garbhagriha: [0, -0.3, -6.6, 1.5], // the foot of the five steps, at the sanctum door
  },
};

export const DARSHAN: Record<string, Darshan> = {
  somnath: { at: [0, 1.8, 2.6, 3.5], zones: ['garbhagriha'], source: [0, 2.6, 0] },
  mallikarjuna: { at: [3, 0.9, 0, 4], zones: ['garbhagriha'], source: [0, 1.5, 0] },
  // the Ganesh Mandapam barricade on the axis of the sanctum door (DARSHAN_SPOT), or inside the sanctum
  // after darshan the daily queue is led upstairs to Omkareshwar, directly above the sanctum
  mahakaleshwar: { at: [0, -2.55, 1.0, 3.5], zones: ['garbhagriha'], source: [0, -2.0, -5.85], then: 'mahakal-omkareshwar' },
  omkareshwar: { at: [9.6, -0.45, -6.6, 3], zones: ['garbhagriha'], source: [12.15, 0, -7] },
  // the sanctum, entered down the stair from the hall; the linga a little west of the chamber's centre
  nageshwar: { at: [13.2, -0.3, 0.9, 2.2], zones: ['garbhagriha'], source: [14.35, 0.05, 0.15] },
  // darshan from the lower antarala at the sanctum door (the queue sees the hollow in the mirror), or inside
  trimbakeshwar: { at: [0, 0.45, -6.4, 1.2], zones: ['garbhagriha'], source: [-0.08, 0.45, -9] },
  // in front of the rock's kerb, inside the sanctum door
  kedarnath: { at: [0, 1.0, -8.4, 2.5], zones: ['garbhagriha'], source: [0, 1.5, -10.6] },
  // the cell below the mandapa, east of the linga (it faces east, to the door)
  grishneshwar: { at: [0, 0.45, 1.6, 2.0], zones: ['garbhagriha'], source: [0, 0.6, 0] },
  // the brass rail in the garbhagriha door passage, reaching back into the ardha mandapam
  rameshwaram: { at: [0, 1.35, 3.6, 3.5], zones: ['garbhagriha'], source: [0, 1.9, 0] },
  // the east door of the cell; the linga sits low in its sunken silver basin
  'kashi-vishwanath': { at: [0, 0.6, 2.4, 2.5], zones: ['garbhagriha'], source: [0, 0.4, 0] },
  // inside the cell, between the east door and the linga in its flush black basin
  vaidyanath: { at: [0, 0.45, 1.8, 2.2], zones: ['garbhagriha'], source: [-0.25, 0.6, -0.15] },
  // the antarala at the foot of the five steps, at the sanctum door; the cleft linga in its silver basin
  bhimashankar: { at: [0, -0.3, -6.6, 2], zones: ['garbhagriha'], source: [-0.32, -0.15, -8.75] },
};

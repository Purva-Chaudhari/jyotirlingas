# Places: walk me there (navigation graphs)

The **Places** button (top right, key **T**) lists a temple's places. Picking one walks the pilgrim there,
fast-forwarded (~3.5× walking pace, faster on long straight runs, slower on stairs and bends), along the real
walkable ways: never a teleport. A "⏩ Walking to …" pill and a faint vignette show while it runs; any move key,
a drag of the view or **Esc** stops it. Stories don't start on the way; the place's own story may start on
arrival.

Code: `src/temples/engine/travel.ts` (graph search, path, driver; the comment at its top is the reference),
`src/temples/engine/places.ts` (button + list), hooks in `TempleWorld` (`drive`, `travelling`, `walkable()`),
the story pause in `src/temples/stories/index.ts`. Mahakaleshwar's graph: `src/temples/sites/mahakaleshwar/nav.ts`.

## Adding Places to a temple

1. In the site's `build()`, return `nav` and `places` on the `BuiltSite` (types in `src/temples/sites/types.ts`):

   ```ts
   nav: {
     nodes: { gate: [0, 0, 40], court: [0, 0, 20], door: [0, 0.9, 9], sanctum: [0, -2, 0] }, // feet [x, floor y, z]
     edges: [['gate', 'court'], ['court', 'door'], ['door', 'sanctum', { before: () => portal.use?.() }]],
   },
   places: [{ id: 'sanctum', node: 'sanctum', label: { hi: 'गर्भगृह', en: 'Garbhagriha' }, look: [0, -1, -3] }],
   ```

2. Rules for nodes and edges:
   - a node is a feet position **on a walkable floor** (`y` = that floor; navcheck flags nodes > 0.3 m off it);
   - an edge is a **straight line walkable both ways** with the normal collision (radius 0.3 m). Keep it clear
     of walls, rails and pillars; put a node at every bend and on both sides of every doorway;
   - a stair or ramp is a single edge from a step beyond its foot to a step beyond its head;
   - a gate/barricade that opens (a `Portal` with `use()`): give the edge through it
     `{ before: () => portal.use?.() }` (called as a method, so `this` is the portal) — it runs a few metres
     before the walk reaches it;
   - `cost` (metres) on an edge makes the search prefer other ways;
   - cover every story stop and the darshan spot, and give each place a `look` (what to face on arrival);
   - leave out what can't be walked to (e.g. Harsiddhi at Mahakaleshwar: no floor across the town).
3. Check it (dev server running):

   ```sh
   node scripts/navcheck.mjs <temple> static   # floors under nodes, straight-line walkability (seconds)
   node scripts/navcheck.mjs <temple> edges    # walks every edge both ways in real time (VERBOSE=1 for each)
   node scripts/navcheck.mjs <temple> places   # travels from the spawn to every place: arrival, time, zone
   node scripts/navcheck.mjs <temple> route x,y,z x,y,z [margin]   # suggests nodes between two points
   ```

   `route` grid-searches the real collision between two feet positions and pulls the result tight into
   straight legs: use its points as nodes (nudge them a little away from walls). `--only=id,id` limits
   `edges`/`places`. All modes exit non-zero on problems.

## How a trip runs

Start: the nearest nodes (within 80 m) reachable in a straight line from the feet, else the nearest node. A* (cost
= plan distance + 2× climb + edge cost) to the place's node. The polyline gets rounded corners (≤ 0.8 m, ≤ 40 %
of a leg), a speed profile (12 m/s cruise, up to 26 m/s on legs > 30 m, 6.5 m/s on stairs, braking at 14 m/s² for
bends and the end), and is followed by pure pursuit through `TempleWorld.drive` (≤ 0.2 m collision sub-steps,
floor snapping for stairs). If progress stalls for 0.8 s the pilgrim is put on the next node (on open floor),
at most 8 times. On arrival the view turns to the place's `look`.

import * as THREE from 'three';
import { signSprite } from '../../engine/kit';
import type { SiteDef } from '../types';
import { buildMahakal, SANCTUM, STAIR } from './temple';
import { mahakalMats } from './mats';
import { mergeStatic, lightZones, cameraProbe, fadeNear } from './optimize';
import { buildComplex, TREE_SPOTS } from './precinct';
import { buildDarshan, sunLid, routeZone, deepUnderground, pavingHoles, SPAWN, ROUTE, DARSHAN_SPOT, T, PH, EX } from './darshan';
import type { BuiltSite } from '../types';
import { buildCrowd, type CrowdSpot } from './crowd';
import { VIP_DARSHAN, GM, FRONT } from './mode';
import { upperZone, upperIndoor, upperShut, upperNagRoom, CORE } from './upper';
import { mahakalNav } from './nav';

/**
 * After darshan (general mode): from the foot of the front stair up to the hall, out of the front doorway, east
 * along the front of the hall's core, north up the east aisle, in at the Omkareshwar doorway and north through
 * its passage into the shrine (the story's anchor). Walk-tested with scripts/walk.mjs.
 */
const OMK_WAY: [number, number, number][] = [
  [0, FRONT.BOT, FRONT.FOOT], [0, FRONT.TOP, FRONT.HEAD], [0, 0.9, 7.6], [5.8, 0.9, 7.6], [5.8, 0.9, 2.7],
  [(CORE.X0 + CORE.X1) / 2, 0.9, 2.7], [(CORE.X0 + CORE.X1) / 2, 0.9, -1.0], [1.3, 0.9, -2.4],
];

/** distance from (px, pz) to the segment a-b */
function segDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

const site: SiteDef = {
  id: 'mahakaleshwar',
  name: { en: 'Mahakaleshwar', hi: 'महाकालेश्वर' },
  lon: 75.7682,
  lat: 23.1828,
  // warm, clear Malwa air: little haze, far fog (the default grey-white haze bleached the colours)
  // near 140 m so the town fades into haze well before its edge (the ground ends at ~600 m)
  fog: { color: 0xd9c4a6, near: 140, far: 620 },
  // a higher sun cuts the glare looking east across the court
  sunElevationMin: 55,
  flight: {
    0: ['भारत', 'Bhārat', ''],
    2: ['मालवा', 'Malwa', 'Madhya Pradesh'],
    3: ['उज्जैन', 'Ujjain', 'on the banks of the Shipra'],
  },
  zones: {
    approach: ['श्री महाकाल लोक', 'Shri Mahakal Lok', 'the way to the north gate · Mansarovar'],
    queue: ['दर्शन कतार', 'Darshan Queue', 'general darshan · from Shri Mahakal Lok'],
    tunnel: ['महाकाल टनल - 1', 'Mahakal Tunnel', 'दर्शन मार्ग · the way down to darshan'],
    'ganesh-mandapam': ['गणेश मंडपम', 'Ganesh Mandapam', 'darshan of Shri Mahakal from the barricade'],
    palki: ['पालकी हॉल · निर्गम', 'Palki Hall · Exit', 'back up to the courtyard'],
    nandi: ['नंदी मंडप', 'Nandi Hall', 'in reality VIPs & priests only · open to you in this virtual yatra'],
    temple: ['महाकालेश्वर मंदिर', 'Mahakaleshwar Mandir', 'Jyotirlinga · Ujjain'],
    descent: ['गर्भगृह की ओर', 'Toward the Garbhagriha', 'the sanctum lies below the earth'],
    garbhagriha: ['श्री महाकालेश्वर', 'Jyotirlinga', 'Dakshinamukhi · facing south'],
    kund: ['कोटितीर्थ कुंड', 'Kotitirtha Kund', 'the sacred tank'],
    lakefront: ['रुद्र सागर', 'Rudra Sagar', 'the lakefront path · Shri Mahakal Lok'],
    'lok-corridor': ['श्री महाकाल लोक', 'Shri Mahakal Lok', '108 stambhas · the Shiva Purana mural wall'],
    'kamal-kund': ['कमल कुंड', 'Kamal Kund', 'the lotus pond · Nandi Dwar and Pinaki Dwar'],
    'omkareshwar-shrine': ['श्री ओंकारेश्वर महादेव', 'Shri Omkareshwar Mahadev', 'the second shrine · above Mahakal, on the earth'],
    'nag-stair': ['नागचंद्रेश्वर की सीढ़ी', 'The Stair to Nagchandreshwar', 'in reality open only on Nag Panchami · open to you here'],
    'temple-terrace': ['मंदिर की छत', 'The Temple Terrace', 'before the Nagchandreshwar shrine'],
    nagchandreshwar: ['श्री नागचंद्रेश्वर', 'Shri Nagchandreshwar', 'the third shrine · opens once a year, on Nag Panchami'],
  },
  trees: TREE_SPOTS,
  build({ root, M, P, flames, sunDir, pending, interiorEnv, renderer, setBloom }) {
    const S = mahakalMats(pending, interiorEnv, renderer);
    const t = buildMahakal(root, M, P, S);
    flames.points.push(...t.flames.points);
    flames.lights.push(...t.flames.lights);
    const { water, group: precinct, crowd } = buildComplex(root, M, P, flames, sunDir, pending, pavingHoles());
    // the general darshan route: queue → Mahakal Tunnel-1 → Ganesh Mandapam → Palki Hall
    const d = buildDarshan(root, M, S, P, S.env);
    flames.points.push(...d.flames);
    // the route's pilgrims: everyone ≥1.8 m from the walking line (guards stand behind their gates)
    const isGuard = (c: CrowdSpot) => c.kind === 'kurta' && c.pose === 'stand';
    const spots = d.spots.filter((c) => isGuard(c) || ROUTE.every((a, i) => i === 0 || segDist(c.x, c.z, ROUTE[i - 1], a) >= 1.8));
    const pilgrims = buildCrowd(root, spots, { seed: 211, kanwariyaShare: 0.12, nearDistance: 8 });
    sunLid(root);
    // performance: bake static meshes per material, trim shadow casters, zone the point lights
    const keep = new Set<THREE.Object3D>([...P.floors, t.flag.mesh, water, ...(t.frontGate ? [t.frontGate.gate] : [])]);
    mergeStatic(t.group, keep);
    mergeStatic(t.interior, keep);
    mergeStatic(precinct, keep);
    mergeStatic(d.surface, keep);
    mergeStatic(d.under, keep);
    mergeStatic(d.portals, keep);
    const interior: THREE.PointLight[] = [...d.lights];
    for (const grp of [t.group, t.interior]) grp.traverse((o) => { if ((o as THREE.PointLight).isPointLight && o !== t.doorGlow) interior.push(o as THREE.PointLight); });
    lightZones(root, interior, t.doorGlow ? [t.doorGlow] : [],
      (p) => !upperIndoor(p) && (p.y < 0.6 || (Math.abs(p.x) < 1.6 && p.z < 6.3 && p.z > -3 && p.y < 4.5)));
    // in the garbhagriha, the tunnel or the Ganesh Mandapam nothing outside can be seen: stop drawing
    // the exterior, the precinct and the queue sheds (camera-driven, so it also holds for fixed viewpoints)
    let inSanctum = false, hidden = false, nearScreens = false, viewCam: THREE.Camera | null = null;
    const look = new THREE.Vector3();
    cameraProbe(root, (p, cam) => {
      viewCam = cam;
      const now = p.y < SANCTUM.CEIL && Math.abs(p.x) < 3.4 && Math.abs(p.z - SANCTUM.Z) < 3.3;
      // general darshan: on the lower front stair, the platform or the front row, looking back (or up) the stair,
      // the passage and the doorway above it (the exterior groups) are in view through the stairwell
      cam.getWorldDirection(look);
      const upStair = !VIP_DARSHAN && p.y > -1.6 && Math.abs(p.x) < 3.5 && p.z > 0.3 && p.z < FRONT.HEAD + 0.5
        && ((look.z > 0.4 && Math.abs(p.x) < 2.2) || look.y > 0.4);
      // (from below, through the stairwell and the doorway only the passage and the hall's arcade show: the
      // temple group is drawn, the precinct and the queue sheds stay off)
      const below = now || deepUnderground(p);
      const deep = below && !upStair;
      if (deep !== hidden) { hidden = deep; t.group.visible = precinct.visible = !deep; }
      // deep in the Omkareshwar sanctum (inside the tower) the precinct can't be seen either
      const shut = upperShut(p);
      // (on the stair itself, looking up, the court shows through the doorway)
      const onStair = upStair && Math.abs(p.x) < FRONT.W && p.z > FRONT.FOOT;
      precinct.visible = !hidden && !shut && (!below || onStair);
      if (now !== inSanctum) {
        inSanctum = now;
        // the silver room under LED panels: keep bloom low so lamps and wet stone don't flare
        setBloom(now ? 0.22 : null);
      }
      nearScreens = !VIP_DARSHAN && p.y < 0 && Math.abs(p.x) < 10.6 && p.z > GM.Z0 - 2 && p.z < GM.Z1 + 0.5;
      // the underground halls are drawn only below ground or where they can be seen into: the tunnel
      // mouth from the queue, and the exit ramp from the front court
      // from the front court, straight before the temple, its hall and tower hide the queue sheds and the
      // tunnel's portal behind it: don't draw them there (VIP mode starts here)
      const front = p.z > 9.6 && Math.abs(p.x) < 3 && p.y > -0.5;
      // outside the north wall (the Mahakal Lok approach) the kund is out of sight: skip its water and the
      // mirror render it costs
      const nagRoom = upperNagRoom(p);
      water.visible = !(p.z < -41.4 && p.y > -0.5) && !shut && !nagRoom;
      d.surface.visible = !below && !front && !shut && !nagRoom;
      if (VIP_DARSHAN) d.portals.visible = !front;
      // (and from the hall's front doorway and its stair, down into the Ganesh Mandapam)
      const intoStair = !VIP_DARSHAN && Math.abs(p.x) < 3 && p.z > FRONT.FOOT && p.z < 9.8 && p.y < 4.5;
      d.under.visible = p.y < 0.3 || intoStair || (p.x > -12.5 && p.x < 8.5 && p.z > -40 && p.z < -7) || (!VIP_DARSHAN && p.x > -4 && p.x < 11 && p.z > 11 && p.z < 38);
    });
    fadeNear(VIP_DARSHAN
      ? signSprite(root, 'गर्भगृह ↓', 'Garbhagriha · Darshan', new THREE.Vector3(11.1, 5.0, 10.75), 1.9)
      : signSprite(root, 'गर्भगृह ↓ · वास्तव में वीआईपी', 'Open to you in this virtual yatra', new THREE.Vector3(11.1, 5.0, 10.75), 1.9));

    // the mandapam's LED screens show the lingam live: a small render from the sanctum doorway every few
    // seconds while the pilgrim is near them (only the interior is drawn; same shader variants as the
    // half-float scene pass, so nothing compiles)
    const ledRT = new THREE.WebGLRenderTarget(640, 360, { type: THREE.HalfFloatType, samples: 4 });
    if (d.ledMat) { d.ledMat.map = ledRT.texture; d.ledMat.color.setScalar(0.9); }
    const ledCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 20);
    ledCam.position.set(0, SANCTUM.FLOOR + 1.62, SANCTUM.Z + 2.95);
    ledCam.lookAt(0, SANCTUM.FLOOR + 0.92, SANCTUM.Z);
    let scene: THREE.Object3D = root;
    while (scene.parent) scene = scene.parent;
    let lastShot = -1e9, warmStep = 0, loaded = false, toastShown = false;
    // (the frame loop runs while the world is still loading: warm up only once the site's loads and the
    // sky's environment are in, or the variants compiled would not be the ones drawn)
    Promise.all([...pending]).then(() => { loaded = true; }, () => { loaded = true; });
    // Once running, compile every material again for the lights as they really are outdoors, in the
    // background. (The engine's precompile un-hides every hidden object, the switched-off interior lamps
    // too, so it compiles "all lamps on" and its flip, never the outdoor state with the lamps off: the
    // first look at each new part of the precinct stalled, ~1.7 s on the first turn at the queue.)
    const warm = (cam: THREE.Camera) => {
      const shown: THREE.Object3D[] = [];
      scene.traverse((o) => { if (!o.visible && !(o as THREE.Light).isLight) { shown.push(o); o.visible = true; } });
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(ledRT);
      renderer.compileAsync(scene, cam).catch(() => {});
      renderer.setRenderTarget(prev);
      for (const o of shown) o.visible = false;
      // and queue every texture for upload, a few per frame, so turning round doesn't stall on them
      const set = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture && !(v as THREE.Texture).isRenderTargetTexture) set.add(v as THREE.Texture);
          for (const u of Object.values((m as THREE.ShaderMaterial).uniforms ?? {})) if ((u.value as THREE.Texture)?.isTexture && !(u.value as THREE.Texture).isRenderTargetTexture) set.add(u.value);
        }
      });
      texQueue = [...set];
    };
    // every object drawn once into a tiny target (culling off): uploads all geometry and textures and
    // links the exact per-object shader variants up front instead of on the first look at them
    const warmRT = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType });
    const drawAll = (cam: THREE.Camera, insideLights: boolean) => {
      // (second pass: with the interior lamps on and the door glow off, as below ground)
      const was = [...interior, ...(t.doorGlow ? [t.doorGlow] : [])].map((l) => [l, l.visible] as const);
      if (insideLights) { for (const l of interior) l.visible = true; if (t.doorGlow) t.doorGlow.visible = false; }
      const shown: THREE.Object3D[] = [], culled: THREE.Object3D[] = [], batched: THREE.BatchedMesh[] = [];
      scene.traverse((o) => {
        if (!o.visible && !(o as THREE.Light).isLight) { shown.push(o); o.visible = true; }
        if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
        const b = o as THREE.BatchedMesh;
        if (b.isBatchedMesh && b.perObjectFrustumCulled) { batched.push(b); b.perObjectFrustumCulled = false; }
      });
      const auto = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget();
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(warmRT);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
      renderer.shadowMap.autoUpdate = auto;
      for (const o of shown) o.visible = false;
      for (const o of culled) o.frustumCulled = true;
      for (const b of batched) b.perObjectFrustumCulled = true;
      for (const [l, v] of was) l.visible = v;
    };
    let texQueue: THREE.Texture[] | null = null;
    const uploadSome = () => {
      const t0 = performance.now();
      while (texQueue!.length && performance.now() - t0 < 6) {
        const t = texQueue!.pop()!;
        const img = t.image as { width?: number; data?: unknown } | null;
        if (img && (img.width || img.data)) renderer.initTexture(t);
      }
      if (!texQueue!.length) texQueue = null;
    };
    const shoot = () => {
      const vis = root.children.map((c) => c.visible);
      // only the interior is drawn; lights keep their state (the same light count as the main view, so
      // the sanctum's shader variants are shared)
      root.children.forEach((c) => { c.visible = c === t.interior || (c as THREE.Light).isLight ? c.visible : false; });
      const auto = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget();
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(ledRT);
      renderer.render(scene, ledCam);
      renderer.setRenderTarget(prev);
      renderer.shadowMap.autoUpdate = auto;
      root.children.forEach((c, i) => { c.visible = vis[i]; });
    };
    // the queue creeps forward: each pilgrim in the lanes steps ~0.3 m ahead, then eases back over the rest
    // of a 7 s cycle, the step travelling back down the line like a real queue's ripple; the sevaks at the
    // platform turn to wave the line on (per-instance matrices of the crowd's BatchedMesh)
    const mesh = pilgrims.mesh;
    const movers: { id: number; base: THREE.Matrix4; fx: number; fz: number; ph: number }[] = [];
    const turners: { id: number; base: THREE.Matrix4; ph: number }[] = [];
    spots.forEach((c, id) => {
      if (d.queueSpots.has(c)) {
        const ry = Math.round(c.ry / (Math.PI / 2)) * (Math.PI / 2);
        const base = new THREE.Matrix4(); mesh.getMatrixAt(id, base);
        movers.push({ id, base, fx: Math.sin(ry), fz: Math.cos(ry), ph: -(c.x * Math.sin(ry) + c.z * 0.37) / 3.5 });
      } else if (d.sevaks.includes(c)) {
        const base = new THREE.Matrix4(); mesh.getMatrixAt(id, base);
        turners.push({ id, base, ph: c.x });
      }
    });
    const tmpM = new THREE.Matrix4(), rotM = new THREE.Matrix4();
    // (each update re-uploads the crowd's matrix texture, which stalls when the GPU is behind: update every
    // third frame, and pause for a moment after a sudden big turn of the view)
    let animFrame = 0, quiet = 0;
    const lastDir = new THREE.Vector3(), dir = new THREE.Vector3();
    const animateCrowd = (time: number, cam: THREE.Vector3 | null) => {
      if (!cam || !viewCam) return;
      (viewCam as THREE.Camera).getWorldDirection(dir);
      if (dir.dot(lastDir) < 0.94) quiet = 12;
      lastDir.copy(dir);
      if (quiet > 0) { quiet--; return; }
      if (++animFrame % 3) return;
      if (cam.y > -1 && cam.z < -15 && cam.z > -45) {
        for (const m of movers) {
          const f = (((time / 7 + m.ph) % 1) + 1) % 1;
          const k = f < 0.18 ? THREE.MathUtils.smoothstep(f, 0, 0.18) : 1 - THREE.MathUtils.smoothstep(f, 0.3, 1);
          tmpM.copy(m.base);
          tmpM.elements[12] += m.fx * 0.3 * k;
          tmpM.elements[14] += m.fz * 0.3 * k;
          mesh.setMatrixAt(m.id, tmpM);
        }
      }
      if (cam.y < -1 && cam.z > -1 && cam.z < 6 && Math.abs(cam.x) < 7.5) {
        for (const tr of turners) {
          const a = Math.sin(time * 1.6 + tr.ph) * 0.55 + Math.sin(time * 0.7 + tr.ph) * 0.2;
          const px = tr.base.elements[12], py = tr.base.elements[13], pz = tr.base.elements[14];
          rotM.makeRotationY(a);
          tmpM.makeTranslation(-px, -py, -pz).premultiply(rotM).premultiply(new THREE.Matrix4().makeTranslation(px, py, pz)).multiply(tr.base);
          mesh.setMatrixAt(tr.id, tmpM);
        }
      }
    };
    const built: BuiltSite & { stops: Record<string, { feet: [number, number, number]; look: [number, number, number]; note: string }> } = {
      /**
       * Story hooks: world-space stops along the pilgrimage (feet position, where to look). Walkable unless
       * the note says it is a fixed viewpoint. Aarti audio: source at the lingam, (0, SANCTUM.FLOOR + 1.0,
       * SANCTUM.Z); the general listener is stops.darshan.
       */
      stops: {
        approach: { feet: SPAWN.feet, look: SPAWN.look, note: 'general spawn, on the Mahakal Lok approach outside the north gate, facing it' },
        queueEntrance: { feet: [1.0, 0, -38.4], look: [6.2, 1.5, -32.5], note: 'just inside the north gate, at the queue arch' },
        tunnel: { feet: [(T.X0 + T.X1) / 2, T.FLOOR, -2], look: [(T.X0 + T.X1) / 2, T.FLOOR + 1.4, 8], note: 'Mahakal Tunnel-1, mid-way under the court; the portal is at (-9, 0, -21.6)' },
        darshan: { feet: DARSHAN_SPOT.feet, look: DARSHAN_SPOT.look, note: 'Ganesh Mandapam darshan platform, on the sanctum axis' },
        palkiHall: { feet: [4.5, PH.Y, 14.8], look: [0.9, PH.Y + 1.2, 15.2], note: 'Palki Hall, beside the silver palki' },
        exitCourt: { feet: [(EX.X0 + EX.X1) / 2, 0, 30], look: [0, 6, 6], note: 'front court at the exit arch, facing the temple' },
        kund: { feet: [-34, 0, -1.4], look: [-34, -2.2, -14], note: 'Kotitirtha kund, south rim' },
        topStorey: { feet: [0, 9.55, 7.6], look: [0, 11.2, 3.3], note: 'fixed viewpoint (not walkable): hall terrace facing the Nagchandreshwar storey' },
        sanctum: { feet: [0, SANCTUM.FLOOR, SANCTUM.Z + 2.5], look: [0, SANCTUM.FLOOR + 0.9, SANCTUM.Z], note: 'garbhagriha (VIP mode only: ?darshan=vip)' },
      },
      // general darshan: at the queue entrance inside the north (Mahakal Lok) gate, facing into the lanes;
      // VIP: 10 m in front of the south arcade, so turning round shows the gateway and the court
      spawn: VIP_DARSHAN ? { feet: [1.5, 0, 28], look: [0, 11, 0] } : SPAWN,
      // the front doorway: in reality the garbhagriha is VIPs and priests only; here the visitor may open the
      // barricade gate and go in. As in the real temple the garbhagriha lies below the court, so the gate opens
      // onto the head of the stair just inside the doorway: you walk down the steps yourself to the linga
      // (the gate stays open: the prompt goes once it is used)
      portals: t.frontGate ? [{
        at: [0, 0.9, 7.2], radius: 1.8,
        label: { hi: 'द्वार खोलें · सीढ़ियाँ उतरकर गर्भगृह', en: 'Open the gate · steps down to the garbhagriha' },
        to: { feet: [0, 0.9, FRONT.HEAD + 0.3], look: [0, FRONT.BOT + 0.6, FRONT.FOOT - 0.6] },
        use() {
          const fg = t.frontGate!;
          fg.gate.rotation.y = -1.45; // swung back against the doorway's west jamb
          fg.block.makeEmpty();
          this.radius = 0;
        },
      }] : undefined,
      // general darshan: the way in from the front doorway — down the stair onto the darshan platform (the
      // Ganesh Mandapam story), through its open gate round the Nandi's west side (the threshold story) and in at
      // the sanctum door; then, after darshan, the way the real queue goes on: back up the stair and through
      // the hall's east aisle to the Omkareshwar shrine above the sanctum (from the sanctum, or from either end
      // of the front-row walk). The guide leads along them rather than straight through floors and walls
      guidePaths: VIP_DARSHAN ? undefined : [
        {
          reach: 1.6,
          points: [
            [0, 0.9, 9.6], [0, 0.9, FRONT.HEAD], [0, FRONT.BOT, FRONT.FOOT], [-0.8, FRONT.BOT, 1.0], [-0.9, FRONT.BOT, 0.45],
            [-0.9, GM.FLOOR, -0.6], [-0.9, GM.FLOOR, -1.95], [0, GM.FLOOR, -2.7], [0, GM.FLOOR, -3.6],
          ],
        },
        {
          reach: 1.6,
          points: [
            [0, GM.FLOOR, -3.6], [0, GM.FLOOR, -2.7], [-0.9, GM.FLOOR, -1.95], [-0.9, GM.FLOOR, -0.6],
            [-0.9, FRONT.BOT, 0.45], [-0.8, FRONT.BOT, 1.0], ...OMK_WAY,
          ],
        },
        { reach: 1.6, points: [[-2.6, FRONT.BOT, 2.5], [-2.6, FRONT.BOT, 1.0], [-0.4, FRONT.BOT, 1.0], ...OMK_WAY] },
        { reach: 1.6, points: [[2.6, FRONT.BOT, 2.5], [2.6, FRONT.BOT, 1.0], [0.4, FRONT.BOT, 1.0], ...OMK_WAY] },
      ],
      update(time) {
        t.flag.update(time);
        water.material.uniforms.time.value = time * 0.6;
        crowd.update(time);
        pilgrims.update(time);
        animateCrowd(time, viewCam ? (viewCam as THREE.Camera).position : null);
        // start-up warm-up, one step per frame: compile, then draw everything once in each light state
        if (viewCam && warmStep < 3 && loaded && (scene as THREE.Scene).environment) {
          if (warmStep === 0) warm(viewCam); else drawAll(viewCam, warmStep === 2);
          warmStep++;
        }
        if (texQueue) uploadSome();
        if (d.ledMat && nearScreens && time - lastShot > 3) { lastShot = time; shoot(); }
      },
      setSun(dir: THREE.Vector3) {
        water.material.uniforms.sunDirection.value.copy(dir);
      },
      // the first time in the sanctum, the real rule as a toast (the story HUD's toast element, if present)
      onZoneChange(zone) {
        if (zone !== 'garbhagriha' || VIP_DARSHAN || toastShown) return;
        toastShown = true;
        const el = document.getElementById('story-toast');
        if (!el) return;
        el.innerHTML = '<span class="lotus">ॐ</span> वास्तव में गर्भगृह केवल वीआईपी व पुजारियों के लिए · '
          + 'Really VIPs &amp; priests only. Here, you may enter.';
        el.classList.add('on');
        const mine = el.innerHTML;
        setTimeout(() => { if (el.innerHTML === mine) el.classList.remove('on'); }, 7000);
      },
      zoneAt(feet) {
        const { x, y, z } = feet;
        if (y < SANCTUM.FLOOR + 1 && Math.abs(x) < 3.3 && Math.abs(z - SANCTUM.Z) < 3.3) return 'garbhagriha';
        const r = routeZone(feet);
        if (r) return r;
        const u = upperZone(feet);
        if (u) return u;
        // the main stair from the front doorway, the antechamber and the corridor from the east stair
        if (VIP_DARSHAN && y < 0.85 && Math.abs(x) < STAIR.SW + 0.2 && z > STAIR.SN - 0.1 && z < STAIR.SS + 0.1) return 'descent';
        if (!VIP_DARSHAN && y < 0.85 && Math.abs(x) < FRONT.W + 0.2 && z > FRONT.FOOT - 0.1 && z < FRONT.HEAD + 0.1) return 'descent';
        if (y < -0.3 && z < 3.2 && z > SANCTUM.Z + 3.3) return 'descent';
        if (y < -0.3 && x > 9.5) return 'descent';
        if (y > 0.5 && Math.abs(x) < 8.6 && Math.abs(z) < 9.6) return 'temple';
        if (x < -21 && x > -47 && z < -1 && z > -27) return 'kund';
        return null;
      },
    };
    // Places (engine/travel.ts): the walking graph; a walk through the front doorway opens its gate (the portal)
    if (!VIP_DARSHAN) Object.assign(built, mahakalNav(() => { const p = built.portals?.[0]; if (p?.radius) p.use?.(); }));
    return built;
  },
};

export default site;

import * as THREE from 'three';
import { worldUV, type Materials } from '../../engine/materials';
import { Physics, archPanelGeometry, type Flames } from '../../engine/kit';
import { Batch, M4, rng, fbm, icoSphere } from './batch';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KMats } from './mats';
import { pathY, scatterBoulders, SAMADHI } from './terrain';
import { nandiMesh } from './nandi';
import { offerings, type Offerings } from './flowers';
import { shankaracharya } from './statue';
import { facadeMaterial } from './facade';

/**
 * The temple square (rebuilt 2014-23): grey stone paving, the broad flight of steps up from
 * the approach street, the Nandi before the door, Bhim Shila behind the shrine, the
 * protection wall against the moraine, and the town's tin-roofed lodges and shops.
 */

const PLAZA = { x: 34, z0: -36, z1: 50 };

export function buildPrecinct(root: THREE.Group, M: Materials, K: KMats, P: Physics, flames: Flames) {
  const g = new THREE.Group();
  g.name = 'kedarnath-precinct';
  root.add(g);
  const B = new Batch(g, P);
  const r = rng(7);

  // ---------- paving ----------
  {
    const geo = new THREE.PlaneGeometry(PLAZA.x * 2, PLAZA.z1 - PLAZA.z0, 1, 1).rotateX(-Math.PI / 2)
      .translate(0, 0, (PLAZA.z0 + PLAZA.z1) / 2);
    B.add(K.paving, geo);
    P.floor(g, -PLAZA.x, PLAZA.x, PLAZA.z0, PLAZA.z1, 0);
    // kerb around the square
    for (const s of [-1, 1]) B.box(K.stoneDark, 0.5, 0.25, PLAZA.z1 - PLAZA.z0, s * (PLAZA.x + 0.25), -0.15, (PLAZA.z0 + PLAZA.z1) / 2);
  }
  // broad flight of steps down to the approach street (z 50 → 53.6, 8 risers of 0.18)
  for (let i = 0; i < 8; i++) {
    const y = -(i + 1) * 0.18;
    B.box(K.stoneDark, 30, 0.18 + 0.4, 0.45, 0, y - 0.4, 50 + i * 0.45 + 0.225);
  }
  P.floor(g, -15, 15, 50, 53.6, 0, -1.44);
  // retaining wall either side of the steps, along the square's south edge
  for (const s of [-1, 1]) {
    B.box(K.stoneDark, 19, 1.6, 0.6, s * 24.5, -1.6, 50.3);
    B.box(K.stone, 19, 0.6, 0.45, s * 24.5, 0, 50.3);
    // stone balustrade along the square's front edge: square posts and a moulded top rail
    for (let i = 0; i <= 19; i++) B.box(K.stone, 0.32, 0.55, 0.32, s * (15.2 + i), 0.6, 50.3);
    B.box(K.carved, 19, 0.16, 0.42, s * 24.5, 1.15, 50.3);
    P.solid(s > 0 ? 15 : -34, -2, 50, s > 0 ? 34 : -15, 1.5, 50.6);
    B.box(K.carved, 0.6, 1.4, 0.6, s * 15.2, 0, 50.3); // pier at the head of the steps
    // cheeks of the flight
    B.box(K.stone, 0.5, 0.6, 3.8, s * 15.25, -1.44, 51.8);
    P.solid(s > 0 ? 8 : -15.5, -30, 53.6, s > 0 ? 15.5 : -8, 5, 54.2);
    P.solid(s > 0 ? 15 : -15.5, -3, 50, s > 0 ? 15.5 : -15, 1.5, 53.6);
  }
  // the approach street: paved ramp z 53.6 → 200
  {
    const z0 = 53.6, z1 = 200;
    const geo = new THREE.PlaneGeometry(16, z1 - z0, 1, 8).rotateX(-Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, pathY(p.getZ(i)));
    geo.computeVertexNormals();
    B.add(K.paving, geo);
    P.floor(g, -8, 8, z0, z1, pathY(z0), pathY(z1));
    for (const s of [-1, 1]) P.solid(s * 8, -30, z0, s * 8.5, 5, z1);
    trekPath(B, K, M, P, g, z1);
  }
  // boundary of the square (invisible rails behind the lodges and the wall)
  P.solid(-PLAZA.x - 1, -1, PLAZA.z0, -PLAZA.x, 4, PLAZA.z1);
  P.solid(PLAZA.x, -1, PLAZA.z0, PLAZA.x + 1, 4, PLAZA.z1);

  // ---------- protection wall north of the temple ----------
  // (with a gateway through to the Samadhi court)
  const GX0 = SAMADHI.x - 4, GX1 = SAMADHI.x + 4;
  for (const [xa, xb] of [[-34, GX0], [GX1, 34]]) {
    const w = xb - xa, cx = (xa + xb) / 2;
    for (let i = 0; i < 3; i++) {
      B.box(K.stoneDark, w, 1.3, 1.6 - i * 0.35, cx, i * 1.3, PLAZA.z0 - 0.8 - i * 0.25 - 1.0);
    }
    B.box(K.stone, w, 0.2, 1.2, cx, 3.9, PLAZA.z0 - 2.2);
    P.solid(xa, 0, PLAZA.z0 - 3, xb, 5, PLAZA.z0 - 0.2);
    // gate piers
    B.box(K.stone, 1.0, 4.6, 2.0, xa === -34 ? xb - 0.5 : xa + 0.5, 0, PLAZA.z0 - 1.6);
  }
  samadhi(B, K, M, g, P, flames);

  // ---------- Bhim Shila: the boulder that shielded the temple in June 2013 ----------
  // an angular, slab-faced block ~8.6 m long and ~3.5 m high, its south face blackened by
  // lamp soot and ghee, with sindoor daubed on and coins pressed into it, bedded in cobbles,
  // a dhuni fire in front
  {
    const base = icoSphere(3);
    const p = base.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fbm(x * 1.7 + 4, y * 1.7 + z * 1.3, 4) + (fbm(x * 6 + 1, y * 6 - z * 5, 2) - 0.5) * 0.25;
      const k = 1 + (n - 0.5) * 0.3;
      const bx = Math.sign(x) * Math.pow(Math.abs(x), 0.45), by = Math.sign(y) * Math.pow(Math.abs(y), 0.5), bz = Math.sign(z) * Math.pow(Math.abs(z), 0.45);
      p.setXYZ(i, bx * 4.3 * k, by * 1.8 * k + (y > 0 ? -Math.abs(x) * 0.12 : 0), bz * 1.9 * k);
    }
    const geo = base.toNonIndexed();
    geo.computeVertexNormals(); // flat facets
    worldUV(geo);
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    const col = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i) + 1.7, nz = nn.getZ(i);
      const c = new THREE.Color(1, 1, 1);
      // soot and ghee on the lower south face where lamps are lit
      const soot = (1 - THREE.MathUtils.smoothstep(y, 0.6, 2.4)) * THREE.MathUtils.smoothstep(nz, -0.1, 0.5);
      c.multiplyScalar(0.8 * (1 - soot * 0.8));
      // sindoor daubs on the south face
      const blob = THREE.MathUtils.smoothstep(fbm(x * 2.2 + 7, y * 2.2 - 3, 3), 0.6, 0.66) * (1 - THREE.MathUtils.smoothstep(Math.hypot((x - 0.6) / 1.6, (y - 1.8) / 0.7), 0.6, 1.0));
      const sind = THREE.MathUtils.smoothstep(nz, 0.3, 0.6) * blob;
      c.lerp(new THREE.Color(1.5, 0.5, 0.12), sind * 0.9);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const rock = new THREE.Mesh(geo, K.bhim);
    rock.position.set(0.6, 1.7, -25.6);
    rock.rotation.set(0.03, 0.1, -0.04);
    rock.castShadow = rock.receiveShadow = true;
    g.add(rock);
    P.solid(-3.7, 0, -27.6, 4.9, 3.6, -23.6);
    // coins pressed into the stone
    const coin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 10).rotateX(Math.PI / 2), M.brass, 60);
    for (let i = 0; i < 60; i++) coin.setMatrixAt(i, M4(-0.8 + r() * 2.4, 0.8 + r() * 1.6, -23.68 + r() * 0.05, r() * 0.4 - 0.2));
    g.add(coin);
    // a bed of loose cobbles round it
    const cobGeo = icoSphere(1);
    cobGeo.computeVertexNormals();
    worldUV(cobGeo);
    const cob = new THREE.InstancedMesh(cobGeo, K.boulder, 520);
    let n = 0;
    for (let i = 0; i < 2000 && n < 520; i++) {
      const x = -6 + r() * 13.5, z = -30 + r() * 8.6;
      if (x > -3.9 && x < 5.0 && z > -27.8 && z < -23.4) continue;
      const sz = 0.06 + Math.pow(r(), 2) * 0.16;
      cob.setMatrixAt(n++, new THREE.Matrix4().compose(new THREE.Vector3(x, sz * 0.4, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 6, r() * 3)), new THREE.Vector3(sz * (1 + r() * 0.5), sz * 0.7, sz)));
    }
    cob.count = n;
    cob.receiveShadow = true;
    g.add(cob);
    // dhuni: a ring of stones, charred logs, ash and fire
    const dx = 2.6, dz = -21.9;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      B.geo(K.boulder, new THREE.DodecahedronGeometry(0.13, 0), M4(dx + Math.cos(a) * 0.45, 0.08, dz + Math.sin(a) * 0.45, a), false);
    }
    B.geo(K.ash, new THREE.CylinderGeometry(0.4, 0.42, 0.06, 16), M4(dx, 0.03, dz), false);
    for (let i = 0; i < 4; i++) B.geo(K.black, new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6).rotateZ(Math.PI / 2), M4(dx, 0.12, dz, (i * Math.PI) / 4), false);
    for (let i = 0; i < 5; i++) flames.points.push(new THREE.Vector3(dx + (r() - 0.5) * 0.3, 0.2 + r() * 0.1, dz + (r() - 0.5) * 0.3));
    P.solid(dx - 0.55, 0, dz - 0.55, dx + 0.55, 0.5, dz + 0.55);
    // lamps at its foot
    B.box(K.stoneDark, 2.2, 0.25, 0.8, 0.0, 0, -22.95);
    for (let i = 0; i < 6; i++) flames.points.push(new THREE.Vector3(-0.9 + i * 0.36, 0.33, -22.95 + (i % 2) * 0.15));
    // smaller boulders, rubble
    for (let i = 0; i < 9; i++) {
      const bg = icoSphere(2);
      const bp = bg.attributes.position;
      for (let k = 0; k < bp.count; k++) {
        const f = 1 + (fbm(bp.getX(k) * 1.8 + i, bp.getY(k) * 1.8, 3) - 0.5) * 0.6;
        bp.setXYZ(k, bp.getX(k) * f, bp.getY(k) * f, bp.getZ(k) * f);
      }
      bg.computeVertexNormals();
      worldUV(bg);
      bg.scale(0.4 + r() * 0.8, 0.4 + r() * 0.8, 0.4 + r() * 0.8);
      const b = new THREE.Mesh(bg, K.boulder);
      const x = -16 + r() * 34, z = -30 - r() * 4;
      b.position.set(x, 0.1, z);
      b.scale.set(1 + r() * 0.6, 0.6 + r() * 0.4, 1 + r() * 0.5);
      b.rotation.set(r(), r() * 6, r());
      b.castShadow = b.receiveShadow = true;
      g.add(b);
    }
  }

  {
    const bg = icoSphere(1);
    const bp = bg.attributes.position;
    for (let k = 0; k < bp.count; k++) {
      const f = 1 + (fbm(bp.getX(k) * 1.6 + 3, bp.getY(k) * 1.6 + bp.getZ(k), 3) - 0.5) * 0.7;
      bp.setXYZ(k, bp.getX(k) * f, bp.getY(k) * f, bp.getZ(k) * f);
    }
    bg.computeVertexNormals();
    worldUV(bg);
    scatterBoulders(g, K.boulder, bg);
  }

  // ---------- Nandi before the door, facing the sanctum ----------
  const O = offerings(g);
  O.garland(new THREE.Vector3(-2.4, 3.0, -23.6), new THREE.Vector3(3.2, 2.9, -23.6), 1.0, 1.2);
  nandi(B, K, g, P, O);

  // ---------- lodges, priests' houses and shops ----------
  town(B, K, M, r, g);
  canopies(B, K, P, r);
  // the approach street's bazaar: stalls along both sides under umbrellas and tarps, heaped with
  // marigolds, prasad boxes, rudraksha and brassware, garlands hanging from the awning rails,
  // overhead cables strung between the lodges with bunting
  {
    const um = [0x44709c, 0x8a4a40, 0x5a7262, 0xb49e62, 0xdcdad4, 0x6a7680, 0x3c6890].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }));
    const pole = new THREE.MeshStandardMaterial({ color: 0x77797c, metalness: 0.5, roughness: 0.5 });
    const cloth = [0xb0261c, 0xe8b830, 0x2a5aa0, 0xd8d0c0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const goods = [0xff8c10, 0xffb020, 0xd02020, 0xf2e6c8, 0x6a3a1a, 0xc9923a, 0xe85a9a, 0x2a8a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
    const So = offerings(g);
    const heap = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let z = 57; z < 197; z += 3.2 + r() * 1.6) {
        const y = pathY(z), x = side * (7.0 + r() * 0.3);
        // table with a cloth and heaped goods
        B.geo(cloth[Math.floor(r() * cloth.length)], new THREE.BoxGeometry(1.0, 0.8, 2.2), M4(x, y + 0.4, z), false);
        for (let k = 0; k < 5; k++) {
          const gz = z - 0.85 + k * 0.42, gm = goods[Math.floor(r() * goods.length)];
          const big = r() < 0.5;
          B.geo(gm, heap.clone().scale(big ? 0.24 : 0.16, big ? 0.18 : 0.1, big ? 0.22 : 0.16), M4(x + (r() - 0.5) * 0.4, y + 0.8, gz), false);
        }
        // shade: umbrella or a sloping tarp on poles
        if (r() < 0.55) {
          B.geo(pole, new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), M4(x - side * 0.2, y + 1.2, z), false);
          B.geo(um[Math.floor(r() * um.length)], new THREE.ConeGeometry(1.25 + r() * 0.3, 0.5, 10, 1, true), M4(x - side * 0.2, y + 2.45, z), false);
        } else {
          B.geo(um[Math.floor(r() * um.length)], new THREE.PlaneGeometry(2.0, 3.2).rotateX(-Math.PI / 2).rotateZ(side * 0.22), M4(x - side * 0.1, y + 2.45, z), false);
          for (const dz of [-1.5, 1.5]) B.geo(pole, new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M4(x - side * 0.95, y + 1.15, z + dz), false);
        }
        // marigold strings hanging from the shade rail
        if (r() < 0.7) {
          for (let k = 0; k < 3; k++) {
            const hz = z - 0.9 + k * 0.9, hx = x - side * 0.85;
            So.garland(new THREE.Vector3(hx, y + 2.25, hz), new THREE.Vector3(hx, y + 1.25 + r() * 0.3, hz + 0.01), 0.0, 1.0);
          }
        }
        P.solid(x - 0.6, y, z - 1.2, x + 0.6, y + 2.2, z + 1.2);
      }
    }
    // overhead cables between the lodges, sagging, some with triangular bunting
    const wire = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const flagM = [0xd02020, 0xffc020, 0x2a6ad0, 0x2a9a4a, 0xf0f0f0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }));
    for (let z = 60; z < 196; z += 6 + r() * 6) {
      const y = pathY(z), za = z + (r() - 0.5) * 3, zb = z + (r() - 0.5) * 3;
      const a = new THREE.Vector3(-8.6, y + 6.2 + r() * 1.2, za), b = new THREE.Vector3(8.6, y + 6.2 + r() * 1.2, zb);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.9 - r() * 0.6, 0));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      B.geo(wire, new THREE.TubeGeometry(curve, 16, 0.012, 4, false), M4(), false);
      if (r() < 0.45) {
        for (let k = 1; k < 28; k++) {
          const pt = curve.getPoint(k / 28);
          const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.16, 0, 0), new THREE.Vector3(0.16, 0, 0), new THREE.Vector3(0, -0.32, 0)]);
          tri.computeVertexNormals();
          B.geo(flagM[k % flagM.length], tri, M4(pt.x, pt.y, pt.z, Math.atan2(b.z - a.z, b.x - a.x) * -1), false);
        }
      }
    }
    // a few lengthwise cables along each frontage
    for (const side of [-1, 1]) {
      for (let z = 56; z < 190; z += 22) {
        const y0 = pathY(z), y1 = pathY(z + 22);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * 8.4, y0 + 5.4, z), new THREE.Vector3(side * 8.3, (y0 + y1) / 2 + 4.7, z + 11), new THREE.Vector3(side * 8.4, y1 + 5.4, z + 22));
        B.geo(wire, new THREE.TubeGeometry(curve, 12, 0.012, 4, false), M4(), false);
      }
    }
    So.flush();
  }

  // ---------- wet patches, grit and dropped flowers on the paving ----------
  {
    const blobs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 46; i++) {
      const x = (r() - 0.5) * PLAZA.x * 1.9, z = PLAZA.z0 + 2 + r() * (PLAZA.z1 - PLAZA.z0 - 4);
      if (Math.abs(x) < 8 && z > -16 && z < 11) continue;
      const sh = new THREE.Shape(), n = 18, R0 = 0.6 + r() * 2.2, ph = r() * 9;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2, rr = R0 * (0.7 + 0.3 * Math.sin(a * 3 + ph) + 0.15 * Math.sin(a * 5 + ph * 2));
        if (k === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.7);
      }
      blobs.push(new THREE.ShapeGeometry(sh, 2).rotateX(-Math.PI / 2).rotateY(r() * 6).translate(x, 0.012, z));
    }
    const wet = new THREE.MeshStandardMaterial({ color: 0x4a4844, roughness: 0.12, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const wm = new THREE.Mesh(mergeGeometries(blobs)!, wet);
    wm.receiveShadow = true;
    wm.renderOrder = 1;
    g.add(wm);
    // grit and small stones
    const pg = icoSphere(0);
    pg.computeVertexNormals();
    worldUV(pg);
    const peb = new THREE.InstancedMesh(pg, K.boulder, 420);
    let n = 0;
    for (let i = 0; i < 1200 && n < 420; i++) {
      const x = (r() - 0.5) * PLAZA.x * 1.95, z = PLAZA.z0 + r() * (PLAZA.z1 - PLAZA.z0);
      if (Math.abs(x) < 7.5 && z > -15 && z < 10.5) continue;
      const sz = 0.015 + Math.pow(r(), 3) * 0.06;
      peb.setMatrixAt(n++, new THREE.Matrix4().compose(new THREE.Vector3(x, sz * 0.3, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 6, r() * 3)), new THREE.Vector3(sz * 1.3, sz * 0.6, sz)));
    }
    peb.count = n;
    peb.receiveShadow = true;
    g.add(peb);
    // marigolds and petals dropped round the foot of the steps and the Nandi
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 9, z = 10.2 + r() * 6;
      if (Math.abs(x) < 1.0 && z > 11.8 && z < 14.6) continue;
      const pp = new THREE.Vector3(x, 0.012, z);
      if (r() < 0.55) O.marigold(pp, 0.9); else O.petal(pp);
    }
  }

  // ---------- lamp posts ----------
  const posts: [number, number][] = [];
  for (let z = 60; z < 196; z += 16) posts.push([-7.4, z], [7.4, z + 8]);
  for (const x of [-30, -15, 15, 30]) posts.push([x, 47]);
  for (const z of [-20, 0, 20, 38]) posts.push([-31.5, z], [31.5, z]);
  for (const [x, z] of posts) {
    const y = z > 50 ? pathY(z) : 0;
    B.geo(K.black, new THREE.CylinderGeometry(0.07, 0.11, 4.2, 8), M4(x, y + 2.1, z), false);
    B.geo(K.black, new THREE.CylinderGeometry(0.2, 0.22, 0.4, 8), M4(x, y + 0.2, z), false);
    B.geo(K.black, new THREE.BoxGeometry(1.1, 0.06, 0.06), M4(x, y + 4.0, z), false);
    for (const dx of [-0.55, 0, 0.55]) {
      B.geo(K.glassDark, new THREE.SphereGeometry(0.16, 10, 8), M4(x + dx, y + 4.25, z), false);
    }
    P.solid(x - 0.15, y, z - 0.15, x + 0.15, y + 4, z + 0.15);
  }

  B.flush();
  O.flush();
}

// ---------------------------------------------------------------------------------------------

function nandi(B: Batch, K: KMats, g: THREE.Group, P: Physics, O: Offerings) {
  const z = 13.2;
  // pedestal: painted yellow with blue edges, as today
  B.box(K.yellow, 1.7, 0.95, 2.7, 0, 0, z, true);
  B.box(K.blue, 1.84, 0.1, 2.84, 0, 0.95, z);
  B.box(K.blue, 1.84, 0.12, 2.84, 0, 0, z);
  const y = 1.05;
  // the recumbent bull (signed-distance sculpture), head toward the door (−z)
  const bullMesh = nandiMesh(K.nandi);
  bullMesh.position.set(0, y, z);
  g.add(bullMesh);
  const bz = (v: number) => z + v;
  // bell collar, red cloth on the back, garland
  // brass bell on a cord at the throat, red cloth over the back, marigold garland round the neck
  B.geo(K.goldLeaf, new THREE.TorusGeometry(0.24, 0.018, 6, 28), M4(0, y + 0.82, bz(-0.78), 0, 1.15, 0), false);
  B.geo(K.goldLeaf, new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, 2.2), M4(0, y + 0.56, bz(-0.92)), false);
  B.geo(K.red, new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, 0.75).scale(0.44, 0.36, 0.5), M4(0, y + 0.47, bz(0.15)), false);
  for (let i = 0; i < 2; i++) {
    const a = new THREE.Vector3(-0.3, y + 0.98 - i * 0.06, bz(-0.78 - i * 0.04));
    const b = new THREE.Vector3(0.3, y + 0.98 - i * 0.06, bz(-0.78 - i * 0.04));
    O.garland(a, b, 0.5 - i * 0.08, 1.15);
    for (const sx of [-1, 1]) O.garland(new THREE.Vector3(sx * 0.3, y + 0.98 - i * 0.06, bz(-0.78)), new THREE.Vector3(sx * 0.2, y + 1.02, bz(-0.95)), 0.02, 1.1);
  }
  // the tall brass trishul with its damaru, planted at the bull's shoulder
  {
    const tx = 0.66, tz = z - 0.95, ty = 1.05;
    B.geo(K.goldLeaf, new THREE.CylinderGeometry(0.045, 0.055, 2.1, 10), M4(tx, ty + 1.05, tz), false);
    B.geo(K.goldLeaf, new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12), M4(tx, ty + 0.06, tz), false);
    // damaru: two drums tip to tip
    for (const sgn of [-1, 1]) B.geo(K.goldLeaf, new THREE.ConeGeometry(0.11, 0.13, 16, 1, true).rotateX(sgn > 0 ? Math.PI : 0), M4(tx, ty + 1.35 + sgn * 0.065, tz), false);
    // prongs: the centre blade and two curving side blades
    B.geo(K.goldLeaf, flameBlade(0.5, 0.11), M4(tx, ty + 2.1, tz), false);
    for (const sgn of [-1, 1]) {
      const arc = new THREE.TorusGeometry(0.19, 0.045, 8, 16, Math.PI * 0.75);
      B.geo(K.goldLeaf, arc, M4(tx + sgn * 0.17, ty + 2.1, tz, Math.PI / 2 - Math.PI / 2, 0, sgn > 0 ? Math.PI * 0.05 : Math.PI * 0.2), false);
      B.geo(K.goldLeaf, flameBlade(0.3, 0.09), M4(tx + sgn * 0.34, ty + 2.18, tz, 0, 0, -sgn * 0.3), false);
    }
    B.geo(K.goldLeaf, new THREE.TorusGeometry(0.06, 0.02, 6, 12), M4(tx, ty + 2.08, tz, 0, Math.PI / 2, 0), false);
    // red and saffron cloths tied below the prongs
    B.geo(K.red, new THREE.CylinderGeometry(0.06, 0.09, 0.3, 8, 1, true), M4(tx, ty + 1.85, tz), false);
    B.geo(K.orange, new THREE.PlaneGeometry(0.12, 0.45), M4(tx + 0.05, ty + 1.6, tz, 0.4), false);
  }
  {
    const cop = new THREE.MeshStandardMaterial({ color: 0xb8683c, metalness: 0.75, roughness: 0.45 });
    const bx = -0.55, bz2 = z - 0.95;
    B.geo(cop, new THREE.BoxGeometry(0.5, 0.35, 0.4), M4(bx, 1.05 + 0.175, bz2), false);
    B.geo(cop, new THREE.CylinderGeometry(0.03, 0.38, 0.18, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.8), M4(bx, 1.05 + 0.44, bz2), false);
    B.geo(K.goldLeaf, new THREE.BoxGeometry(0.2, 0.02, 0.04), M4(bx, 1.05 + 0.36, bz2 + 0.2), false);
  }
  P.solid(-0.85, 0, z - 1.35, 0.85, 2.6, z + 1.35);
}

/** a wavy, flame-like blade: a flat lens extruded thick, wiggling as it tapers */
function flameBlade(h: number, w: number) {
  const s = new THREE.Shape();
  const n = 12;
  s.moveTo(-w / 2, 0);
  for (let i = 1; i <= n; i++) {
    const t = i / n, ww = (w / 2) * (1 - t) ** 0.8, wig = Math.sin(t * Math.PI * 3) * w * 0.18;
    s.lineTo(-ww + wig, t * h);
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = i / n, ww = (w / 2) * (1 - t) ** 0.8, wig = Math.sin(t * Math.PI * 3) * w * 0.18;
    s.lineTo(ww + wig, t * h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  g.translate(0, 0, -0.02);
  return g;
}

// ---------------------------------------------------------------------------------------------

function town(B: Batch, K: KMats, M: Materials, r: () => number, g: THREE.Group) {
  const walls = [0xf2efe8, 0xece9e2, 0xe2e0da, 0xd8d6d0, 0xdedcd6, 0xd2d5d6, 0xe8e4da, 0xc8c6c0].map((c) => {
    const m = M.plaster.clone();
    m.color.set(c);
    return m;
  });
  const tins = [0x5a6e82, 0x6a7a88, 0x7a8288, 0x8a8e90, 0x56687a, 0x6e767c, 0x8c867c, 0x5e7080].map((c) => {
    const m = K.roof.clone();
    m.color.set(c);
    m.metalness = 0.35;
    m.roughness = 0.5;
    return m;
  });
  const slate = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.85 });
  const trims = [K.blue, K.green, K.maroon, K.sky, K.orange].map((m) => m);
  const signs = signMaterials();
  const rail = new THREE.MeshStandardMaterial({ color: 0x6d7378, metalness: 0.6, roughness: 0.45 });

  const lodges: THREE.Matrix4[] = [], lodgeCols: THREE.Color[] = [];
  const pastel = [0xe6e3dc, 0xdedad2, 0xd4d2cc, 0xcfd3d6, 0xe8e6e0, 0xc9c5bc, 0xbfc3c6, 0xd9d4c8, 0xf0eee8, 0xc4c8c4];
  /** a lodge: rectangular block, windows, pitched tin roof (ridge parallel to the street) */
  const house = (cx: number, cz: number, w: number, d: number, floors: number, baseY: number, faceX: number, stoneClad: boolean) => {
    const h = floors * 3.0;
    const wall = stoneClad ? K.stone : walls[Math.floor(r() * walls.length)];
    B.box(K.stoneDark, w + 0.2, 0.6, d + 0.2, cx, baseY - 0.6, cz);
    if (stoneClad) {
      B.box(wall, w, h, d, cx, baseY, cz);
      for (let f = 1; f < floors; f++) B.box(K.stoneDark, w + 0.12, 0.18, d + 0.12, cx, baseY + f * 3.0 - 0.1, cz);
    } else {
      lodges.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, baseY, cz), new THREE.Quaternion(), new THREE.Vector3(w, h, d)));
      lodgeCols.push(new THREE.Color(pastel[Math.floor(r() * pastel.length)]).offsetHSL(0, -0.04, (r() - 0.5) * 0.08));
    }
    // windows / shop fronts on the side facing the street (faceX = ±1 → face at cx + faceX*w/2)
    const fx = cx + (faceX * w) / 2;
    const n = Math.max(1, Math.floor(d / 2.6));
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const z = cz - d / 2 + (i + 0.5) * (d / n);
        if (f === 0 && !stoneClad) {
          // shop: awning and a board over the (shader-drawn) shutter
          if (r() < 0.7) B.slab(tins[Math.floor(r() * tins.length)], 1.0, 0.06, d / n - 0.3, fx + faceX * 0.5, baseY + 2.55, z);
          if (r() < 0.75) {
            const sg = new THREE.PlaneGeometry(d / n - 0.4, 0.55).rotateY(faceX * Math.PI / 2);
            B.geo(signs[Math.floor(r() * signs.length)], sg, M4(fx + faceX * 0.06, baseY + 2.95, z), false);
          }
        } else if (stoneClad) {
          B.slab(K.glassDark, 0.06, 1.3, 1.1, fx + faceX * 0.02, baseY + f * 3.0 + 0.9, z);
          // painted frame round each window
          const tm = trims[(Math.floor(cx * 7 + cz) >>> 0) % trims.length];
          B.slab(tm, 0.05, 0.1, 1.3, fx + faceX * 0.04, baseY + f * 3.0 + 2.2, z);
          for (const t of [-0.6, 0.6]) B.slab(tm, 0.05, 1.4, 0.1, fx + faceX * 0.04, baseY + f * 3.0 + 0.85, z + t);
          B.slab(K.wood, 0.08, 0.1, 1.3, fx + faceX * 0.04, baseY + f * 3.0 + 0.82, z);
        }
      }
    }
    // balcony running along an upper floor, steel railing
    if (!stoneClad && floors > 1 && r() < 0.65) {
      const f = 1 + Math.floor(r() * (floors - 1));
      const by = baseY + f * 3.0;
      B.box(K.paving, 1.1, 0.14, d - 0.6, fx + faceX * 0.55, by - 0.08, cz);
      B.slab(rail, 0.05, 0.05, d - 0.6, fx + faceX * 1.07, by + 0.95, cz);
      B.slab(rail, 0.05, 0.05, d - 0.6, fx + faceX * 1.07, by + 0.45, cz);
      for (let zz = cz - d / 2 + 0.35; zz < cz + d / 2 - 0.3; zz += 0.9) B.slab(rail, 0.04, 1.0, 0.04, fx + faceX * 1.07, by, zz);
    }
    // pitched roof, ridge along z
    const roofMat = stoneClad ? slate : tins[Math.floor(r() * tins.length)];
    const rise = w * 0.32, half = w / 2 + 0.5, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [-1, 1]) {
      B.geo(roofMat, new THREE.BoxGeometry(len, 0.08, d + 0.9), M4(cx + (s * half) / 2, baseY + h + rise / 2, cz, 0, 0, -s * ang));
    }
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2, 0); gable.lineTo(w / 2, 0); gable.lineTo(0, rise - 0.05); gable.lineTo(-w / 2, 0);
    const gm = stoneClad ? wall : walls[Math.floor(r() * walls.length)];
    for (const s of [-1, 1]) {
      B.geo(gm, new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), M4(cx, baseY + h, cz + s * (d / 2) - 0.1));
    }
  };

  // along the approach street, both sides
  for (const side of [-1, 1]) {
    let z = 58;
    while (z < 200) {
      const d = 9 + r() * 6;
      const w = 8 + r() * 4;
      const zc = z + d / 2;
      house(side * (8.6 + w / 2), zc, w, d, 1 + Math.floor(r() * 4), pathY(zc) - 0.0, -side, r() < 0.25);
      z += d + 0.6 + r() * 1.5;
    }
  }
  // flanking the square: the rebuilt priests' houses — stone-clad, slate roofs
  for (const side of [-1, 1]) {
    for (let z = -30; z < 46; z += 15.5) {
      house(side * 41, z + 7, 13, 14, 2 + (z > 10 ? 1 : 0), 0, -side, z < -10);
    }
  }
  // a row of lodges south-west and south-east beyond the steps
  for (const side of [-1, 1]) {
    for (let x = 18; x < 34; x += 12.5) {
      house(side * (x + 5.5), 58, 11, 7.5, 2 + Math.floor(r() * 2), pathY(58) - 0.2, -side, false);
    }
  }
  // tin sheds and huts out on the moraine (north-west, north-east)
  for (let i = 0; i < 12; i++) {
    const x = (r() < 0.5 ? -1 : 1) * (60 + r() * 140), z = -50 - r() * 120;
    const w = 4 + r() * 4, d = 6 + r() * 6;
    const m = walls[Math.floor(r() * walls.length)];
    B.box(m, w, 2.6, d, x, -0.3 + Math.max(0, -z - 40) * 0.025, z);
    const tin = tins[Math.floor(r() * tins.length)];
    B.geo(tin, new THREE.BoxGeometry(w + 0.8, 0.08, d + 0.8), M4(x, 2.4 + Math.max(0, -z - 40) * 0.025, z, 0, 0, 0.12));
  }
  const lodgeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), facadeMaterial(), lodges.length);
  lodges.forEach((m, i) => { lodgeMesh.setMatrixAt(i, m); lodgeMesh.setColorAt(i, lodgeCols[i]); });
  lodgeMesh.receiveShadow = true;
  lodgeMesh.castShadow = true;
  lodgeMesh.computeBoundingSphere();
  g.add(lodgeMesh);
}

/**
 * Adi Shankaracharya's Samadhi, rebuilt in 2021 behind the temple: a deep circular court sunk
 * ~6 m into the moraine, walled in plain board-marked concrete open to the sky, low concentric
 * steps at the bottom round a shallow pool, and in the pool a column carrying a lotus pedestal
 * with the 12-ft black stone statue seated on it. A straight stair leads down from the gateway
 * in the protection wall.
 */
function samadhi(B: Batch, K: KMats, M: Materials, g: THREE.Group, P: Physics, flames: Flames) {
  const { x: cx, z: cz, r: R } = SAMADHI;
  const FLOOR = -6.0;
  // plain board-marked grey concrete (≈ #9a9a98) with formwork tie-holes
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd9dadb, map: boardMarks(), roughness: 0.92 });
  // walk from the gateway in the protection wall to the head of the stair
  B.box(K.paving, 8, 0.05, 10, cx, -0.04, -42.5);
  P.floor(g, cx - 4, cx + 4, -47.5, -35.9, 0); // (to the square: no hole under the gateway)
  P.solid(cx - 4.5, -1, -48, cx - 4, 2, -37.5);
  P.solid(cx + 4, -1, -48, cx + 4.5, 2, -37.5);
  // the circular wall, faced inwards, rising to a parapet 0.9 m above ground
  {
    const top = 0.9, h = top - FLOOR;
    const wallG = new THREE.CylinderGeometry(R, R, h, 96, 1, true);
    const ix = wallG.index!.array as Uint16Array | Uint32Array;
    for (let k = 0; k < ix.length; k += 3) { const tmp = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = tmp; }
    const nn = wallG.attributes.normal;
    for (let k = 0; k < nn.count; k++) nn.setXYZ(k, -nn.getX(k), 0, -nn.getZ(k));
    // board-marked UVs: u along the circumference (m), v up the wall (m)
    const uv = wallG.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.PI * 2 * R, uv.getY(k) * h);
    const w = new THREE.Mesh(wallG, concrete);
    w.position.set(cx, FLOOR + h / 2, cz);
    w.receiveShadow = true;
    g.add(w);
    // coping and the outer face of the parapet
    const cop = new THREE.RingGeometry(R, R + 0.45, 96, 1).rotateX(-Math.PI / 2);
    B.geo(K.stone, cop, M4(cx, top, cz));
    const outer = new THREE.CylinderGeometry(R + 0.45, R + 0.45, top, 96, 1, true);
    B.geo(K.stone, outer, M4(cx, top / 2, cz));
    // keep walkers out of the drop except by the stair
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const x = cx + Math.cos(a) * (R + 0.2), z = cz + Math.sin(a) * (R + 0.2);
      if (Math.abs(x - cx) < 2.2 && z > cz) continue;
      P.solid(x - 0.9, -1, z - 0.9, x + 0.9, 1.5, z + 0.9);
    }
    // paved collar round the rim
    const collar = new THREE.Mesh(worldUV(new THREE.RingGeometry(R + 0.45, R + 4.5, 72, 1).rotateX(-Math.PI / 2)), K.paving);
    collar.position.set(cx, 0.01, cz);
    collar.receiveShadow = true;
    g.add(collar);
    P.floors.push(collar);
  }
  // the stair down from the south: 33 risers of 0.18 m between flanking walls
  {
    const zTop = cz + R + 1.0, zBot = cz + 5.6, n = 33, run = (zTop - zBot) / n;
    for (let i = 0; i < n; i++) {
      const y = -(i + 1) * (-FLOOR / n);
      B.box(K.stoneDark, 2.6, y - FLOOR + 0.0001, run + 0.01, cx, FLOOR, zTop - (i + 0.5) * run);
      B.box(K.stone, 2.6, 0.04, run + 0.02, cx, y - 0.04, zTop - (i + 0.5) * run);
    }
    P.floor(g, cx - 1.3, cx + 1.3, zTop + 1.0, zTop, 0);
    P.floor(g, cx - 1.3, cx + 1.3, zTop, zBot, 0, FLOOR);
    for (const s of [-1, 1]) {
      // side walls of the stair, stepping down with it, and railings
      const wx = cx + s * 1.5;
      const geo = new THREE.BoxGeometry(0.35, 1, 1);
      const pp = geo.attributes.position;
      for (let k = 0; k < pp.count; k++) {
        const zz = pp.getZ(k) + 0.5; // 0 (north/bottom) … 1 (south/top)
        const yTop = FLOOR + (0 - FLOOR) * zz + 1.0;
        pp.setXYZ(k, pp.getX(k), pp.getY(k) > 0 ? yTop : FLOOR, zBot + zz * (zTop - zBot));
      }
      geo.computeVertexNormals();
      B.geo(concrete, geo, M4(wx, 0, 0));
      P.solid(wx - 0.2, FLOOR, zBot, wx + 0.2, 1.5, zTop + 1.0);
    }
  }
  // the court floor: concentric low steps rising outwards round the pool
  const rings: [number, number, number][] = [[3.2, 6.0, FLOOR], [6.0, 8.4, FLOOR + 0.3], [8.4, R, FLOOR + 0.6]];
  for (const [r0, r1, y] of rings) {
    const m = new THREE.Mesh(worldUV(new THREE.RingGeometry(r0, r1, 96, 1).rotateX(-Math.PI / 2)), K.paving);
    m.position.set(cx, y, cz);
    m.receiveShadow = true;
    g.add(m);
    P.floors.push(m);
    const riser = new THREE.CylinderGeometry(r0, r0, 0.3, 96, 1, true);
    B.geo(K.stone, riser, M4(cx, y - 0.15, cz));
  }
  // the pool
  {
    const rim = new THREE.CylinderGeometry(3.2, 3.2, 0.35, 72, 1, true);
    B.geo(K.stoneDark, rim, M4(cx, FLOOR - 0.12, cz));
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1b2a2c, roughness: 0.06, metalness: 0.2 }));
    water.position.set(cx, FLOOR - 0.12, cz);
    g.add(water);
    P.solid(cx - 2.2, FLOOR - 1, cz - 2.2, cx + 2.2, FLOOR + 6, cz + 2.2);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = cx + Math.cos(a) * 2.9, z = cz + Math.sin(a) * 2.9;
      P.solid(x - 0.5, FLOOR - 1, z - 0.5, x + 0.5, FLOOR + 1, z + 0.5);
    }
  }
  // column, lotus pedestal and the statue (sam1/sam2): a plain ≈0.6 m column ≈1.2 m tall rising
  // from the pool, a 16-petalled lotus ≈2.4 m across, and the 3.7 m seated figure on it
  const stone = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.35, metalness: 0.05 });
  {
    const colH = 1.2, y0 = FLOOR - 0.12;
    B.geo(stone, new THREE.CylinderGeometry(0.3, 0.34, colH, 28), M4(cx, y0 + colH / 2, cz), false);
    B.geo(stone, new THREE.CylinderGeometry(0.42, 0.42, 0.12, 28), M4(cx, y0 + colH - 0.06, cz), false);
    // lotus: a bowl of 16 broad petals with up-curled tips, a second inner row, flat seat on top
    const H = 0.85, top = y0 + colH;
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const tt = i / 24;
      prof.push(new THREE.Vector2(0.38 + 0.82 * Math.pow(Math.sin(tt * Math.PI * 0.5), 0.8), tt * H));
    }
    prof.push(new THREE.Vector2(1.12, H), new THREE.Vector2(0, H));
    const lotus = new THREE.LatheGeometry(prof, 128);
    const lp = lotus.attributes.position;
    for (let k = 0; k < lp.count; k++) {
      const x = lp.getX(k), y = lp.getY(k), z = lp.getZ(k);
      const a = Math.atan2(z, x), rr = Math.hypot(x, z);
      if (rr < 0.01 || y >= H - 1e-3) continue;
      // petal lobes: bulge in the middle of each petal, a crease between them, tips curling out
      const ph = Math.abs(Math.cos(a * 8)), t = y / H;
      const k1 = 1 + 0.07 * Math.pow(ph, 0.5) * Math.sin(t * Math.PI) + 0.05 * Math.pow(ph, 4) * Math.pow(t, 3);
      lp.setXYZ(k, x * k1, y + 0.06 * Math.pow(ph, 6) * Math.pow(t, 2), z * k1);
    }
    lotus.computeVertexNormals();
    B.geo(stone, lotus, M4(cx, top, cz), false);
    const inner = new THREE.LatheGeometry([new THREE.Vector2(0.75, 0), new THREE.Vector2(0.95, 0.12), new THREE.Vector2(1.0, 0.2), new THREE.Vector2(0, 0.2)], 64);
    const ip = inner.attributes.position;
    for (let k = 0; k < ip.count; k++) {
      const a = Math.atan2(ip.getZ(k), ip.getX(k));
      const f = 1 + 0.06 * Math.pow(Math.abs(Math.cos(a * 8 + Math.PI / 2)), 0.6);
      ip.setXYZ(k, ip.getX(k) * f, ip.getY(k), ip.getZ(k) * f);
    }
    inner.computeVertexNormals();
    B.geo(stone, inner, M4(cx, top + H - 0.05, cz), false);
    const fig = shankaracharya(stone, 4.0);
    fig.position.set(cx, top + H + 0.12, cz);
    fig.rotation.y = 0; // faces the stair (south, +z)
    g.add(fig);
  }
  // lamps on the lowest step
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = cx + Math.cos(a) * 4.5, z = cz + Math.sin(a) * 4.5;
    B.geo(M.brass, new THREE.CylinderGeometry(0.06, 0.035, 0.04, 10), M4(x, FLOOR + 0.02, z), false);
    flames.points.push(new THREE.Vector3(x, FLOOR + 0.1, z));
  }
}

/** board-marked concrete: horizontal shutter boards and tie-hole rows, faint staining */
function boardMarks() {
  const W = 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b4b1aa'; g.fillRect(0, 0, W, H);
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y += 16) {
    const v = 150 + r() * 30;
    g.fillStyle = `rgba(${v},${v - 2},${v - 7},0.5)`;
    g.fillRect(0, y, W, 16);
    g.fillStyle = 'rgba(90,88,84,0.5)'; g.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 128) { g.fillStyle = 'rgba(80,78,74,0.6)'; g.fillRect(x, 0, 2, H); }
  for (let y = 24; y < H; y += 64) for (let x = 32; x < W; x += 64) { g.fillStyle = '#6a6862'; g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(70,68,64,0.12)'; g.fillRect(r() * W, 0, 2 + r() * 6, H); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 4, 1 / 4);
  return t;
}

/** shop boards: coloured panels with a pale "lettering" band — deliberately unreadable */
function signMaterials() {
  const cols: [string, string][] = [['#c4161c', '#ffe9a8'], ['#1d5fc4', '#ffffff'], ['#f0b624', '#7a1a10'], ['#1f8a52', '#fff4d0'], ['#f07a1a', '#ffffff'], ['#6a1e18', '#f6c344']];
  let seed = 41;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return cols.map(([bg, fg]) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = bg; g.fillRect(0, 0, 256, 48);
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(3, 3, 250, 42);
    g.fillStyle = fg;
    // a row of glyph-like blocks with a headline bar (reads as Devanagari at a distance)
    let x = 18;
    g.fillRect(14, 14, 228, 3);
    while (x < 236) {
      const w = 6 + r() * 12;
      g.fillRect(x, 17, w * 0.35, 16 + r() * 6);
      g.beginPath(); g.arc(x + w * 0.6, 26, w * 0.32, 0, Math.PI * 2); g.fill();
      x += w + 4 + (r() < 0.15 ? 10 : 0);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  });
}

/**
 * Canopies typical of the square: blue and orange tarpaulin stalls (prasad, flowers, puja items)
 * and a striped shamiana for pilgrims to rest under.
 */
function canopies(B: Batch, K: KMats, P: Physics, r: () => number) {
  const tarp = [0x3e6f9e, 0xe4e4e0, 0x5a7c9c, 0xa8aeb2].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, side: THREE.DoubleSide }));
  const pole = new THREE.MeshStandardMaterial({ color: 0x8a8f94, metalness: 0.6, roughness: 0.5 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xb0261c, roughness: 0.85 });
  const goods = [K.orange, K.red, K.yellow, K.goldLeaf, K.green].map((m) => m);
  /** a stall: 4 poles, sagging sloped tarp, a cloth-covered counter with heaped goods */
  const stall = (x: number, z: number, w: number, d: number, rot: number) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const [lx, lz, h] of [[-w / 2, -d / 2, 2.6], [w / 2, -d / 2, 2.6], [-w / 2, d / 2, 2.2], [w / 2, d / 2, 2.2]]) {
      const [px, pz] = at(lx, lz);
      B.geo(pole, new THREE.CylinderGeometry(0.03, 0.03, h, 6), M4(px, h / 2, pz), false);
    }
    const g = new THREE.PlaneGeometry(w + 0.3, Math.hypot(d + 0.3, 0.4), 6, 4).rotateX(-Math.PI / 2 + Math.atan2(0.4, d));
    const pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const u = pp.getX(i) / (w / 2), v = pp.getZ(i) / (d / 2);
      pp.setY(i, pp.getY(i) - 0.12 * (1 - u * u) * (1 - v * v));
    }
    g.computeVertexNormals();
    B.geo(tarp[Math.floor(r() * tarp.length)], g, M4(x, 2.42, z, rot), false);
    // counter
    const [cx, cz] = at(0, d / 2 - 0.5);
    B.geo(cloth, new THREE.BoxGeometry(w - 0.3, 0.85, 0.7), M4(cx, 0.425, cz, rot), false);
    for (let i = 0; i < 6; i++) {
      const [gx, gz] = at(-w / 2 + 0.5 + i * ((w - 1) / 5), d / 2 - 0.5);
      B.geo(goods[Math.floor(r() * goods.length)], new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(gx, 0.85, gz), false);
    }
    const [mx, mz] = [x, z];
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2;
    P.solid(mx - hw, 0, mz - hd, mx + hw, 2.6, mz + hd);
  };
  // along the west and east edges of the square, facing inwards
  for (const z of [-4, 4, 26, 34]) stall(-29.5, z, 3.2, 2.6, -Math.PI / 2);
  for (const z of [0, 8, 30]) stall(29.5, z, 3.2, 2.6, Math.PI / 2);
  // two by the head of the steps
  stall(-19, 46.5, 3.4, 2.4, 0);
  stall(19, 46.5, 3.4, 2.4, 0);
  // striped shamiana (rest tent) on the west side
  {
    const x = -24, z = 17, w = 9, d = 6;
    const stripes = [new THREE.MeshStandardMaterial({ color: 0xe6e4de, roughness: 0.8, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0xdcdcd6, roughness: 0.8, side: THREE.DoubleSide })];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const lx0 = -w / 2 + (i * w) / n;
      for (const sgn of [-1, 1]) {
        const g = new THREE.PlaneGeometry(w / n, Math.hypot(d / 2, 1.0)).rotateX(-Math.PI / 2 + sgn * Math.atan2(1.0, d / 2));
        B.geo(stripes[i % 2], g, M4(x + lx0 + w / (2 * n), 3.5, z + (sgn * d) / 4), false);
      }
    }
    // valance
    for (let i = 0; i < 24; i++) {
      const t = -w / 2 + (i + 0.5) * (w / 24);
      for (const sgn of [-1, 1]) B.geo(stripes[i % 2], new THREE.PlaneGeometry(w / 24, 0.4), M4(x + t, 2.8, z + (sgn * d) / 2), false);
    }
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) {
      B.geo(pole, new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6), M4(x + lx, 1.5, z + lz), false);
      P.solid(x + lx - 0.1, 0, z + lz - 0.1, x + lx + 0.1, 3, z + lz + 0.1);
    }
    B.geo(pole, new THREE.CylinderGeometry(0.06, 0.06, 4.0, 6), M4(x, 2.0, z), false);
    // durrie on the ground
    B.geo(new THREE.MeshStandardMaterial({ color: 0x5e3a34, roughness: 0.95 }), new THREE.PlaneGeometry(w - 1, d - 1).rotateX(-Math.PI / 2), M4(x, 0.02, z), false);
  }
  // flat tarps on poles at the corners of the square (pilgrims' rest, prasad and help desks):
  // blue and white plastic sheet lashed over a steel frame, sagging between the poles
  const tentCols = [tarp[0], tarp[1], tarp[2], tarp[1]];
  for (const [cx, cz] of [[-28, -26], [27, -27], [-27, 41], [26, 42]]) {
    for (let k = 0; k < 3; k++) {
      const x = cx + (k - 1) * 3.8, z = cz + (r() - 0.5) * 1.5, w = 3.4, d = 3.0, h = 2.3 + r() * 0.3;
      const tg = new THREE.PlaneGeometry(w + 0.3, d + 0.3, 6, 6).rotateX(-Math.PI / 2);
      const tp = tg.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const u = tp.getX(i) / (w / 2), v = tp.getZ(i) / (d / 2);
        tp.setY(i, -0.14 * (1 - u * u) * (1 - v * v) + v * 0.15);
      }
      tg.computeVertexNormals();
      B.geo(tentCols[Math.floor(r() * tentCols.length)], tg, M4(x, h, z, (r() - 0.5) * 0.2), false);
      for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        B.geo(pole, new THREE.CylinderGeometry(0.03, 0.03, h, 6), M4(x + lx, h / 2, z + lz), false);
      }
      P.solid(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2);
    }
  }
  queueRails(B, K, P);
}

/**
 * Crowd control as photographed in 2022-24: steel queue barricades (1.1 m) running up the east side
 * of the square to the temple steps, and a steel railing wrapped in red cloth in front of the facade.
 */
function queueRails(B: Batch, K: KMats, P: Physics) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, metalness: 0.85, roughness: 0.35 });
  const H = 1.1;
  const run = (ax: number, az: number, bx: number, bz: number, cloth: THREE.Material | null) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (const y of [H, H * 0.55, 0.12]) B.geo(steel, new THREE.CylinderGeometry(0.025, 0.025, len, 6).rotateX(Math.PI / 2), M4(mx, y, mz, ry), false);
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.geo(steel, new THREE.CylinderGeometry(0.03, 0.03, H, 6), M4(ax + (bx - ax) * t, H / 2, az + (bz - az) * t), false);
    }
    if (cloth) B.geo(cloth, new THREE.BoxGeometry(0.03, 0.5, len), M4(mx, H - 0.3, mz, ry), false);
    const hx = Math.abs(bx - ax) / 2 + 0.06, hz = Math.abs(bz - az) / 2 + 0.06;
    P.solid(mx - hx, 0, mz - hz, mx + hx, H, mz + hz);
  };
  // the queue lane up the east side: two rails 1.4 m apart, z 44 → 12.6, then west to the steps
  run(9.0, 44, 9.0, 13.8, null);
  run(10.4, 44, 10.4, 12.4, null);
  run(10.4, 12.4, 4.4, 12.4, null);
  run(9.0, 13.8, 4.4, 13.8, null);
  // red cloth over the railing along the foot of the facade
  const red = new THREE.MeshStandardMaterial({ color: 0xa8201c, roughness: 0.85 });
  run(-7.6, 10.7, -4.3, 10.7, red);
  run(4.3, 10.7, 7.6, 10.7, red);
}

/**
 * The end of the 16 km trek from Gaurikund: a 5 m stone-paved path with steel railings and lamp
 * posts climbing the last stretch into Kedarpuri, an arched welcome gate where it meets the town
 * street, direction boards (helipad, temple) and a pony stand off to the side.
 */
function trekPath(B: Batch, K: KMats, M: Materials, P: Physics, g: THREE.Group, zStart: number) {
  const z0 = zStart, z1 = 330, HW = 2.5;
  {
    const geo = new THREE.PlaneGeometry(HW * 2, z1 - z0, 1, 16).rotateX(-Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, pathY(p.getZ(i)) + 0.02);
    geo.computeVertexNormals();
    B.add(K.paving, geo);
    P.floor(g, -HW, HW, z0, z1, pathY(z0), pathY(z1));
    // kerbs, railings (two steel rails on posts), solids keep walkers on the path
    const rail = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.6, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const x = s * (HW + 0.1);
      for (let z = z0; z < z1; z += 2.0) {
        const y = pathY(z);
        B.box(K.stoneDark, 0.25, 0.22, 2.0, x, y - 0.05, z + 1.0);
        B.geo(rail, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), M4(x, y + 0.5, z), false);
        for (const hy of [0.55, 0.95]) {
          const ya = y + hy, yb = pathY(z + 2) + hy;
          const len = Math.hypot(2, yb - ya);
          B.geo(rail, new THREE.CylinderGeometry(0.022, 0.022, len, 6).rotateX(Math.PI / 2), M4(x, (ya + yb) / 2, z + 1, 0, Math.atan2(ya - yb, 2)), false);
        }
      }
      P.solid(s > 0 ? HW : -HW - 0.4, -40, z0, s > 0 ? HW + 0.4 : -HW, 5, z1);
    }
    P.solid(-HW, -40, z1, HW, 5, z1 + 0.5);
    for (const s of [-1, 1]) P.solid(s > 0 ? HW : -8.5, -40, z0 - 0.3, s > 0 ? 8.5 : -HW, 5, z0 + 0.2);
    // lamp posts every 20 m, alternating sides
    for (let z = z0 + 10, k = 0; z < z1; z += 20, k++) {
      const x = (k % 2 ? 1 : -1) * (HW + 0.45), y = pathY(z);
      B.geo(K.black, new THREE.CylinderGeometry(0.06, 0.1, 4.0, 8), M4(x, y + 2.0, z), false);
      B.geo(K.black, new THREE.BoxGeometry(0.9, 0.05, 0.05), M4(x - Math.sign(x) * 0.4, y + 3.9, z), false);
      B.geo(K.glassDark, new THREE.SphereGeometry(0.15, 10, 8), M4(x - Math.sign(x) * 0.8, y + 3.78, z), false);
    }
  }
  // the welcome gate where the trek path meets the street: two stone-clad piers and a painted arch
  {
    const z = z0 + 3, y = pathY(z);
    for (const s of [-1, 1]) {
      B.box(K.stone, 1.2, 5.4, 1.2, s * 3.6, y - 0.2, z, true);
      B.box(K.carved, 1.4, 0.4, 1.4, s * 3.6, y + 5.2, z);
      B.geo(K.goldLeaf, new THREE.ConeGeometry(0.3, 0.8, 4).rotateY(Math.PI / 4), M4(s * 3.6, y + 6.0, z), false);
    }
    B.box(K.maroon, 8.4, 1.1, 0.7, 0, y + 5.6, z);
    B.box(K.yellow, 8.6, 0.12, 0.8, 0, y + 6.7, z);
    B.geo(K.blue, archPanelGeometry(6.0, 1.3, 0.5, 7), M4(0, y + 4.3, z));
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const gx = c.getContext('2d')!;
    gx.fillStyle = '#7a1a14'; gx.fillRect(0, 0, 512, 96);
    gx.fillStyle = '#ffd36a'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
    gx.font = '800 56px Martel, "Noto Sans Devanagari", serif';
    gx.fillText('श्री केदारनाथ धाम', 256, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    for (const side of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      pl.position.set(0, y + 6.15, z + side * 0.36);
      pl.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(pl);
    }
    for (let i = 0; i < 4; i++) {
      // marigold swags
      const xa = -3.0 + i * 1.5;
      B.geo(M.marigold, new THREE.TorusGeometry(0.75, 0.05, 6, 16, Math.PI), M4(xa + 0.75, y + 5.05, z + 0.4, 0, Math.PI, 0), false);
    }
  }
  // direction boards on posts: arrow plates in blue and green (lettering abstract)
  {
    const boards = signArrows();
    for (const [z, x, k, flip] of [[z0 + 9, 3.4, 0, false], [z0 + 9.5, 3.4, 1, true], [z0 + 26, -3.4, 2, false]] as [number, number, number, boolean][]) {
      const y = pathY(z);
      B.geo(K.black, new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), M4(x, y + 1.4, z), false);
      const pl = new THREE.PlaneGeometry(1.6, 0.4);
      if (flip) pl.scale(-1, 1, 1);
      B.geo(boards[k], pl, M4(x + (flip ? -0.7 : 0.7) * Math.sign(-x) * -1, y + 2.5 - (k === 1 ? 0.45 : 0), z, Math.PI / 2), false);
      const back = new THREE.PlaneGeometry(1.6, 0.4).rotateY(Math.PI);
      B.geo(K.paving, back, M4(x + (flip ? -0.7 : 0.7) * Math.sign(-x) * -1, y + 2.5 - (k === 1 ? 0.45 : 0), z, Math.PI / 2), false);
    }
  }
  // pony stand off the path to the east: a levelled yard, hitching rails, a water trough, a tin shelter
  {
    const zc = z0 + 40, y = pathY(zc), xc = 12;
    const yard = new THREE.PlaneGeometry(14, 18).rotateX(-Math.PI / 2);
    B.geo(K.paving, yard, M4(xc, y + 0.03, zc));
    for (let i = 0; i < 3; i++) {
      const zz = zc - 6 + i * 6;
      for (const xx of [xc - 4.5, xc + 4.5]) B.geo(K.wood, new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), M4(xx, y + 0.6, zz), false);
      B.geo(K.wood, new THREE.CylinderGeometry(0.05, 0.05, 9, 6).rotateZ(Math.PI / 2), M4(xc, y + 1.1, zz), false);
    }
    B.box(K.stoneDark, 4, 0.6, 0.8, xc, y, zc + 8);
    B.geo(new THREE.MeshStandardMaterial({ color: 0x3a4c4e, roughness: 0.1 }), new THREE.PlaneGeometry(3.8, 0.6).rotateX(-Math.PI / 2), M4(xc, y + 0.55, zc + 8), false);
    for (const [xx, zz] of [[xc + 6, zc - 8], [xc + 6, zc + 8], [xc + 3, zc - 8], [xc + 3, zc + 8]]) B.geo(K.black, new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), M4(xx, y + 1.3, zz), false);
    const tin = K.roof.clone();
    tin.color.set(0x7e8488);
    B.geo(tin, new THREE.BoxGeometry(4, 0.06, 17), M4(xc + 4.5, y + 2.6, zc, 0, 0, 0.12), false);
  }
}

/** direction-board faces: coloured plate, arrow, abstract lettering */
function signArrows() {
  return [['#1f5aa8', 1], ['#2a7a4a', -1], ['#1f5aa8', 1]].map(([bg, dir]) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = bg as string; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 58);
    g.fillStyle = '#ffffff';
    const ax = (dir as number) > 0 ? 220 : 36, s = dir as number;
    g.beginPath(); g.moveTo(ax + s * 22, 32); g.lineTo(ax - s * 4, 12); g.lineTo(ax - s * 4, 52); g.closePath(); g.fill();
    g.fillRect(Math.min(ax - s * 4, ax - s * 30), 27, 26, 10);
    let x = (dir as number) > 0 ? 16 : 70;
    g.fillRect(x, 18, 130, 3);
    while (x < ((dir as number) > 0 ? 170 : 236)) { const w = 6 + ((x * 37) % 11); g.fillRect(x, 21, w * 0.35, 18); g.beginPath(); g.arc(x + w * 0.6, 29, w * 0.3, 0, 6.3); g.fill(); x += w + 4; }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  });
}

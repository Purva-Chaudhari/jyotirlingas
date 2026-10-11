import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Tamil temple garlands as they are strung today: a heavy rope (8–10 cm thick) of fine jasmine buds
 * (≈1 cm each), banded every 30 cm with 12 cm of red roses; swags of green tulsi; marigold ropes.
 * Each garland is a tube whose surface is a canvas bud texture (colour + bump), with ~1 cm instanced
 * jasmine buds over the jasmine runs so the silhouette breaks up when seen at the darshan rail.
 */
export type GarlandKind = 'jasmineRose' | 'tulsi' | 'marigold';

/** texture period along the garland: 0.30 m of jasmine, 0.12 m of roses */
const PERIOD = 0.42, ROSE = 0.12;

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D, hgt: boolean) => void) {
  const out: THREE.CanvasTexture[] = [];
  for (const hgt of [false, true]) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    draw(x, hgt);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!hgt) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    out.push(t);
  }
  return { map: out[0], bump: out[1] };
}

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** u (canvas x) runs along the garland over one PERIOD; v (canvas y) runs once round it. */
function jasmineTex() {
  const W = 1024, H = 256, roseX = W * (1 - ROSE / PERIOD);
  return canvasTex(W, H, (x, hgt) => {
    seed = 11;
    x.fillStyle = hgt ? '#202020' : '#a9a493';
    x.fillRect(0, 0, W, H);
    // jasmine: tight rows of buds, pointing roughly along the string, cream-white with green-tinged bases
    for (let i = 0; i < 2600; i++) {
      const bx = rnd() * roseX, by = rnd() * H, a = (rnd() - 0.5) * 1.2;
      x.save(); x.translate(bx, by); x.rotate(a);
      x.fillStyle = hgt ? '#d8d8d8' : (rnd() < 0.15 ? '#e9ead6' : '#fbf9f0');
      x.beginPath(); x.ellipse(0, 0, 13, 5, 0, 0, 7); x.fill();
      if (!hgt) { x.fillStyle = 'rgba(150,160,110,0.55)'; x.beginPath(); x.ellipse(-10, 0, 4, 3, 0, 0, 7); x.fill(); }
      x.restore();
    }
    // the rose band
    x.fillStyle = hgt ? '#303030' : '#5e0814';
    x.fillRect(roseX, 0, W - roseX, H);
    for (let i = 0; i < 70; i++) {
      const bx = roseX + 14 + rnd() * (W - roseX - 28), by = rnd() * H, r = 15 + rnd() * 7;
      for (let k = 0; k < 4; k++) {
        const l = hgt ? 140 + k * 30 : 0;
        x.fillStyle = hgt ? `rgb(${l},${l},${l})` : ['#7d0a1c', '#b0102a', '#c8243c', '#9a0c22'][k];
        x.beginPath(); x.arc(bx + (rnd() - 0.5) * 3, by + (rnd() - 0.5) * 3, r * (1 - k * 0.22), 0, 7); x.fill();
      }
    }
  });
}

function tulsiTex() {
  const W = 512, H = 256;
  return canvasTex(W, H, (x, hgt) => {
    seed = 23;
    x.fillStyle = hgt ? '#202020' : '#1c3a17';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const bx = rnd() * W, by = rnd() * H, a = rnd() * Math.PI;
      const g = 0.7 + rnd() * 0.5;
      const l = Math.round(150 + rnd() * 90);
      x.fillStyle = hgt ? `rgb(${l},${l},${l})` : `rgb(${Math.round(48 * g)},${Math.round(104 * g)},${Math.round(40 * g)})`;
      x.save(); x.translate(bx, by); x.rotate(a);
      x.beginPath(); x.ellipse(0, 0, 9, 4, 0, 0, 7); x.fill();
      x.restore();
    }
    // the purple flower spikes
    for (let i = 0; i < 120; i++) {
      x.fillStyle = hgt ? '#e0e0e0' : '#5a3a5c';
      x.fillRect(rnd() * W, rnd() * H, 3, 10);
    }
  });
}

function marigoldTex() {
  const W = 512, H = 256;
  return canvasTex(W, H, (x, hgt) => {
    seed = 37;
    x.fillStyle = hgt ? '#202020' : '#8a3a00';
    x.fillRect(0, 0, W, H);
    const cols = ['#ff9a00', '#ffb300', '#ff7a00', '#f06000'];
    for (let i = 0; i < 260; i++) {
      const bx = rnd() * W, by = rnd() * H, r = 12 + rnd() * 5, col = cols[Math.floor(rnd() * 4)];
      for (let k = 0; k < 9; k++) {
        const a = rnd() * 7, d = rnd() * r * 0.8;
        const l = Math.round(150 + rnd() * 100);
        x.fillStyle = hgt ? `rgb(${l},${l},${l})` : col;
        x.beginPath(); x.arc(bx + Math.cos(a) * d, by + Math.sin(a) * d, r * 0.35, 0, 7); x.fill();
      }
    }
  });
}

export class Garlands {
  private geos = new Map<GarlandKind, THREE.BufferGeometry[]>();
  private buds: THREE.Matrix4[] = [];

  /** A garland along `curve`, radius r (m). */
  add(curve: THREE.Curve<THREE.Vector3>, kind: GarlandKind, r: number) {
    const len = curve.getLength();
    const seg = Math.max(8, Math.ceil(len / 0.025));
    const g = new THREE.TubeGeometry(curve, seg, r, 10, false);
    // texture repeats every PERIOD along, once round (scaled so buds keep their size on thin garlands)
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const per = kind === 'jasmineRose' ? PERIOD : 0.25;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / per, uv.getY(i) * Math.max(1, Math.round((2 * Math.PI * r) / 0.2)));
    let l = this.geos.get(kind);
    if (!l) this.geos.set(kind, (l = []));
    l.push(g);
    if (kind !== 'jasmineRose') return;
    // loose buds standing proud of the jasmine runs
    const n = Math.ceil(len / 0.016);
    const fr = curve.computeFrenetFrames(n, false);
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3(), m = new THREE.Matrix4();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (((t * len) % PERIOD) / PERIOD > 1 - ROSE / PERIOD) continue;
      curve.getPointAt(t, p);
      const T = fr.tangents[i], N = fr.normals[i], Bn = fr.binormals[i];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i * 0.9 + rnd() * 0.5;
        d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
        const pos = p.clone().addScaledVector(d, r * 1.02);
        // bud axis mostly along the string, tipped outward
        const axis = T.clone().multiplyScalar(0.8).addScaledVector(d, 0.6).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
        const sc = 0.85 + rnd() * 0.3;
        s.set(sc, sc, sc);
        this.buds.push(m.compose(pos, q, s).clone());
      }
    }
  }

  flush(parent: THREE.Object3D) {
    const out: THREE.Object3D[] = [];
    const tex = { jasmineRose: jasmineTex(), tulsi: tulsiTex(), marigold: marigoldTex() };
    for (const [kind, gs] of this.geos) {
      const t = tex[kind];
      const mat = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.5, roughness: 0.72 });
      // jasmine glows white in lamplight; let it carry a little of its own colour
      if (kind === 'jasmineRose') { mat.emissiveMap = t.map; mat.emissive.set(0x2a2820); }
      const mesh = new THREE.Mesh(mergeGeometries(gs, false)!, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      parent.add(mesh);
      out.push(mesh);
    }
    if (this.buds.length) {
      const bud = new THREE.IcosahedronGeometry(0.0055, 0).scale(1, 1, 2.0);
      const im = new THREE.InstancedMesh(bud, new THREE.MeshStandardMaterial({ color: 0xfbf9f0, roughness: 0.6, emissive: 0x24221c }), this.buds.length);
      this.buds.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere();
      im.castShadow = false;
      parent.add(im);
      out.push(im);
    }
    return out;
  }
}

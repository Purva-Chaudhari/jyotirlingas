import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Physics } from '../../engine/kit';
import type { KM } from './mats';

/**
 * Where the statue stands: on the upper terrace beyond the chowk's eastern gateway, beside the white shrine, its
 * back to the plain end wall of the northern Ganga-view gallery, facing the stair down to the Ganga Dwar.
 */
export const AHILYA = { x: 13.3, z: 112.5 };

/**
 * Punyashlok Ahilyabai Holkar, who built the present temple in 1780: the Dham's bronze of her seated, the pallu
 * over her head, a small Shiva linga held at her breast, a marigold garland in her hands, on a stepped black
 * granite pedestal on a round base, with a brass name plate.
 */
export function buildAhilya(root: THREE.Group, K: KM, P: Physics) {
  const g = new THREE.Group();
  g.name = 'ahilya';
  root.add(g);
  const { x, z } = AHILYA;
  // the pedestal's front faces -x (the stair); local +z of the statue model → world -x
  const ry = -Math.PI / 2;
  g.position.set(x, 0, z);
  g.rotation.y = ry;

  // ---------- black granite pedestal: round base, two square steps, the block, a cap ----------
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(1.15, 1.2, 0.26, 48).translate(0, 0.13, 0),
    new THREE.BoxGeometry(1.75, 0.3, 1.75).translate(0, 0.26 + 0.15, 0),
    new THREE.BoxGeometry(1.55, 0.12, 1.55).translate(0, 0.56 + 0.06, 0),
    new THREE.BoxGeometry(1.32, 0.5, 1.32).translate(0, 0.68 + 0.25, 0),
    new THREE.BoxGeometry(1.46, 0.08, 1.46).translate(0, 1.18 + 0.04, 0),
  ];
  const top = 1.26;
  for (const p of parts) {
    const m = new THREE.Mesh(p, K.blackStone);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  P.solid(x - 1.2, 0, z - 1.2, x + 1.2, 3.4, z + 1.2);

  // brass name plate on the block's front
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const cx = c.getContext('2d')!;
  cx.fillStyle = '#b08a3e'; cx.fillRect(0, 0, 512, 192);
  cx.strokeStyle = '#6e5420'; cx.lineWidth = 8; cx.strokeRect(10, 10, 492, 172);
  cx.fillStyle = '#3a2a10'; cx.textAlign = 'center';
  cx.font = 'bold 40px "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif';
  cx.fillText('पुण्यश्लोक अहिल्याबाई होळकर', 256, 88);
  cx.font = '30px serif';
  cx.fillText('1725 – 1795', 256, 146);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.29), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.45 }));
  plate.position.set(0, 0.93, 0.661);
  g.add(plate);

  // ---------- the statue, reconstructed (TripoSR) from a front view of it in the Dham (see CREDITS.md); the photo's
  // light and shade kept per vertex: the bronze is shaded by it and the garland keeps its colours. 1.75 m tall,
  // seat at the origin, facing +z ----------
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/models/ahilyabai.glb').then((gl) => {
    const cast = new THREE.MeshStandardMaterial({ color: 0x2c2620, metalness: 0.55, roughness: 0.42, vertexColors: true, envMapIntensity: 1.9 });
    cast.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
        vec3 pc = vColor.rgb;
        float hi = max(max(pc.r, pc.g), pc.b), lo = min(min(pc.r, pc.g), pc.b);
        float sat = (hi - lo) / (hi + 0.001);
        // the garland: saturated and warm (orange, yellow, red); everything else is bronze
        float flower = smoothstep(0.34, 0.5, sat) * step(pc.b + 0.06, pc.r);
        float l = dot(pc, vec3(0.299, 0.587, 0.114));
        vec3 bronze = diffuseColor.rgb * (0.35 + 2.4 * pow(clamp(l, 0.001, 1.0), 1.1));
        // (the reconstruction stores sRGB colours that three reads as linear: decoded for the flowers)
        diffuseColor.rgb = mix(bronze, pow(clamp(pc, 0.0, 1.0), vec3(2.2)) * 1.3, flower);`);
    };
    cast.customProgramCacheKey = () => 'ahilya-cast';
    gl.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = cast;
      // (a degenerate triangle gives a NaN normal, and one NaN pixel turns the whole post-processed frame black)
      const nr = mesh.geometry.attributes.normal;
      if (nr) for (let i = 0; i < nr.count; i++) if (!Number.isFinite(nr.getX(i) + nr.getY(i) + nr.getZ(i))) nr.setXYZ(i, 0, 1, 0);
      mesh.castShadow = mesh.receiveShadow = true;
    });
    gl.scene.scale.setScalar(1.1);
    gl.scene.position.set(0, top, 0);
    gl.scene.name = 'ahilyabai';
    g.add(gl.scene);
  }).catch(() => undefined);
}

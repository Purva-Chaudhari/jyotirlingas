import type * as THREE from 'three';
import { buildCrowd as build, type CrowdSpot, type CrowdOpts } from '../../engine/crowd';

/**
 * Pilgrims at Kedarnath: the shared crowd kit (engine/crowd.ts) in its 'mountain' dress. At 3,583 m everyone
 * is wrapped up: women in a saree or salwar with a woollen shawl (some over the head) and cardigan sleeves,
 * men in padded jackets, dark trousers and knitted caps, sadhus in saffron with a blanket; shoes for all.
 */
export { CrowdSpots } from '../../engine/crowd';
export type { CrowdSpot, CrowdOpts, Kind } from '../../engine/crowd';

export function buildCrowd(root: THREE.Object3D, spots: CrowdSpot[], opts: CrowdOpts = {}) {
  return build(root, spots, { outfit: 'mountain', ...opts });
}

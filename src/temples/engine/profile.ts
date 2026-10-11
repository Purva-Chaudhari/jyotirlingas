/**
 * Device detection and the render-quality profile.
 *
 * Desktops keep the full renderer ('high', exactly as before). Phones and tablets get a lighter one:
 * 'mobile' for recent devices, 'low' for older / low-memory ones (and as the fallback the frame-rate probe
 * drops to when a 'mobile' device still runs slow at its lowest resolution). ?quality=high|mobile|low
 * forces a tier, ?touch=1 / ?touch=0 forces the touch controls (testing).
 *
 * The profile is a module singleton: the world picks it before the site is built, so the site kits
 * (crowd counts, LOD distances) read the same one.
 */

export type Tier = 'high' | 'mobile' | 'low';

export interface DeviceInfo {
  ua: string;
  /** primary input is a finger (coarse pointer, no hover) */
  touch: boolean;
  /** navigator.maxTouchPoints */
  touchPoints: number;
  cores?: number;
  /** navigator.deviceMemory (GB, Chrome/Android only) */
  memory?: number;
  dpr: number;
  /** unmasked WebGL renderer string, when the browser shares it */
  gpu?: string;
}

export interface Profile {
  tier: Tier;
  /** render resolution: the adaptive resolution moves between these (in 0.25 steps) */
  maxPixelRatio: number;
  minPixelRatio: number;
  /** ambient occlusion: computed at half resolution, or not at all */
  ao: 'half' | 'off';
  /** MSAA samples of the scene target */
  msaa: number;
  /** sun shadow map size, and how often (in frames) it is re-rendered */
  shadowMap: number;
  shadowEvery: number;
  /** bloom target scale (1 = UnrealBloomPass's own half resolution) */
  bloomScale: number;
  /** share of crowd figures kept, and the scale of their LOD distances */
  crowdShare: number;
  lodScale: number;
  /** water mirrors re-render every N frames */
  waterEvery: number;
  /** cap on texture anisotropy (0 = leave as the site set it) */
  anisotropy: number;
  /** HDR sky / environment as half floats (filterable on iOS, half the memory) */
  halfFloatSky: boolean;
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i;
/** older / weak mobile GPUs */
const WEAK_GPU = /Mali-(T|G5[0-9]|G7[0-6]\b|G31|G51|G52|G57)|Adreno \(TM\) [3-5]\d\d|Adreno [3-5]\d\d|PowerVR|Apple A(9|10|11|12)\b|SwiftShader|llvmpipe|Software/i;

/** a phone or tablet by its user agent (iPadOS reports itself as a Mac, but has touch points) */
export function isMobileUA(ua: string, touchPoints = 0): boolean {
  return MOBILE_UA.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

/** which tier a device gets (pure: see detectDevice for the inputs) */
export function pickTier(d: DeviceInfo, override?: string | null): Tier {
  if (override === 'high' || override === 'mobile' || override === 'low') return override;
  const mobile = isMobileUA(d.ua, d.touchPoints) || d.touch;
  if (!mobile) return 'high';
  if (d.gpu && WEAK_GPU.test(d.gpu)) return 'low';
  if (d.memory !== undefined && d.memory <= 3) return 'low';
  if (d.cores !== undefined && d.cores <= 4) return 'low';
  return 'mobile';
}

export function profileFor(tier: Tier, dpr: number): Profile {
  switch (tier) {
    case 'high':
      return {
        tier, maxPixelRatio: Math.min(dpr, 1.5), minPixelRatio: 1, ao: 'half', msaa: 4, shadowMap: 4096, shadowEvery: 1,
        bloomScale: 1, crowdShare: 1, lodScale: 1, waterEvery: 1, anisotropy: 0, halfFloatSky: false,
      };
    case 'mobile':
      return {
        tier, maxPixelRatio: Math.min(dpr, 1.25), minPixelRatio: Math.min(dpr, 0.75), ao: 'off', msaa: 2, shadowMap: 2048, shadowEvery: 3,
        bloomScale: 0.5, crowdShare: 0.6, lodScale: 0.6, waterEvery: 2, anisotropy: 4, halfFloatSky: true,
      };
    case 'low':
      return {
        tier, maxPixelRatio: Math.min(dpr, 1), minPixelRatio: Math.min(dpr, 0.6), ao: 'off', msaa: 0, shadowMap: 1024, shadowEvery: 6,
        bloomScale: 0.5, crowdShare: 0.35, lodScale: 0.45, waterEvery: 3, anisotropy: 2, halfFloatSky: true,
      };
  }
}

/** finger-first device: a coarse primary pointer without hover */
export function detectTouch(): boolean {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('touch') : null;
  if (q === '1') return true;
  if (q === '0') return false;
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
}

export function detectDevice(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let gpu: string | undefined;
  try {
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch { /* not shared */ }
  return {
    ua: nav.userAgent,
    touch: detectTouch(),
    touchPoints: nav.maxTouchPoints ?? 0,
    cores: nav.hardwareConcurrency || undefined,
    memory: nav.deviceMemory,
    dpr: window.devicePixelRatio || 1,
    gpu,
  };
}

let current: Profile = profileFor('high', typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

/** the active profile (sites read it while they build) */
export function quality(): Profile {
  return current;
}

export function setQuality(p: Profile) {
  current = p;
}

/**
 * Keep a deterministic, evenly spread share of a list (golden-ratio sequence): thinning a crowd keeps
 * figures everywhere rather than dropping one end of it.
 */
export function thin<T>(list: T[], share: number): T[] {
  if (share >= 1) return list;
  if (share <= 0) return [];
  return list.filter((_, i) => ((i + 1) * 0.6180339887) % 1 < share);
}

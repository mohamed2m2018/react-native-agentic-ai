import { logger } from '../../utils/logger';
import { getDeviceId } from '../telemetry/device';

const LOG_TAG = 'FlagService';

/**
 * MurmurHash3 (32-bit) implementation
 */
function murmurhash3_32_gc(key: string, seed: number = 0): number {
  let remainder, bytes, h1, h1b, c1, c2, k1, i;
  
  remainder = key.length & 3; // key.length % 4
  bytes = key.length - remainder;
  h1 = seed;
  c1 = 0xcc9e2d51;
  c2 = 0x1b873593;
  i = 0;
  
  while (i < bytes) {
  	  k1 = 
  	  	((key.charCodeAt(i) & 0xff)) |
  	  	((key.charCodeAt(++i) & 0xff) << 8) |
  	  	((key.charCodeAt(++i) & 0xff) << 16) |
  	  	((key.charCodeAt(++i) & 0xff) << 24);
  	  ++i;
  	  
  	  k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
  	  k1 = (k1 << 15) | (k1 >>> 17);
  	  k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;
  
  	  h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
  	  h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
  	  h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
  }
  
  if (remainder >= 1) {
    k1 = 0;
    if (remainder >= 3) k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    if (remainder >= 2) k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    k1 ^= (key.charCodeAt(i) & 0xff);
    k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= k1;
  }
  
  h1 ^= key.length;
  
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
  h1 ^= h1 >>> 16;
  
  return h1 >>> 0;
}

export interface FeatureFlagPayload {
  key: string;
  variants: string[];
  rollout: number[];
}

export class FlagService {
  private assignments: Record<string, string> = {};
  private fetched: boolean = false;

  constructor(private hostUrl: string) {}

  /**
   * Fetch feature flags from the dashboard backend
   */
  async fetch(analyticsKey: string, userId?: string): Promise<void> {
    try {
      // Avoid fetching if already loaded, unless explicitly forced? 
      // For now, allow refetching just in case.
      const res = await fetch(`${this.hostUrl}/api/v1/flags/sync?key=${analyticsKey}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch flags: ${res.status}`);
      }

      const data = await res.json();
      const flags: FeatureFlagPayload[] = data.flags || [];
      
      this.assignAll(flags, userId);
      this.fetched = true;
      logger.info(LOG_TAG, `Fetched ${flags.length} flags`);
    } catch (err: any) {
      logger.warn(LOG_TAG, `Could not sync feature flags: ${err.message}`);
    }
  }

  /**
   * Deterministically assign a variant using murmurhash.
   */
  private assignVariant(userIdentifier: string, flagKey: string, variants: string[], rollout: number[]): string {
    const hash = murmurhash3_32_gc(`${userIdentifier}_${flagKey}`) % 100;
    let cumulative = 0;
    
    for (let i = 0; i < rollout.length; i++) {
      cumulative += rollout[i]!;
      if (hash < cumulative) {
        return variants[i]!;
      }
    }
    
    // Fallback if rollout doesn't equal exactly 100 or edge case
    return variants[0]!
  }

  private assignAll(flags: FeatureFlagPayload[], userId?: string) {
    const identifier = userId || getDeviceId();
    
    const newAssignments: Record<string, string> = {};
    for (const flag of flags) {
      if (flag.variants.length > 0 && flag.rollout.length === flag.variants.length) {
        newAssignments[flag.key] = this.assignVariant(identifier, flag.key, flag.variants, flag.rollout);
      }
    }
    
    this.assignments = newAssignments;
  }

  /** Get a specific flag value */
  getFlag(key: string, defaultValue?: string): string {
    if (!this.fetched) {
      logger.debug(LOG_TAG, `getFlag("${key}") called before flags were fetched. Returning default.`);
    }
    return this.assignments[key] ?? defaultValue ?? '';
  }

  /** Get all active assignments for telemetry */
  getAllFlags(): Record<string, string> {
    return { ...this.assignments };
  }
}

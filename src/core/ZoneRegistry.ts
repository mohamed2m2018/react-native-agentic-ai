import React, { createContext } from 'react';
import type { AIZoneConfig, RegisteredZone } from './types';

export class ZoneRegistry {
  private zones = new Map<string, RegisteredZone>();

  register(config: AIZoneConfig, ref: React.RefObject<any>): void {
    if (this.zones.has(config.id)) {
      console.warn(`[MobileAI] Zone ID "${config.id}" is already registered on this screen. Overwriting.`);
    }
    this.zones.set(config.id, { ...config, ref });
  }

  unregister(id: string): void {
    this.zones.delete(id);
  }

  get(id: string): RegisteredZone | undefined {
    return this.zones.get(id);
  }

  getAll(): RegisteredZone[] {
    return Array.from(this.zones.values());
  }

  isActionAllowed(zoneId: string, action: 'highlight' | 'hint' | 'simplify' | 'card' | 'block'): boolean {
    const zone = this.get(zoneId);
    if (!zone) return false;

    switch (action) {
      case 'highlight': return !!zone.allowHighlight;
      case 'hint': return !!zone.allowInjectHint;
      case 'simplify': return !!zone.allowSimplify;
      case 'card': return !!zone.allowInjectCard || !!zone.allowInjectBlock;
      case 'block': return !!zone.allowInjectBlock || !!zone.allowInjectCard;
      default: return false;
    }
  }
}

// Global registry instance shared across the Agent session
export const globalZoneRegistry = new ZoneRegistry();

// Export context so AIZone components can register themselves
export const ZoneRegistryContext = createContext<ZoneRegistry>(globalZoneRegistry);

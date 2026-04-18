import React, { createContext } from 'react';
import type { BlockDefinition } from './types';

function isPropTypeValid(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return !!value && typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}

export class BlockRegistry {
  private blocks = new Map<string, BlockDefinition>();

  register(definition: BlockDefinition): void {
    this.blocks.set(definition.name, definition);
  }

  registerMany(definitions: BlockDefinition[]): void {
    definitions.forEach((definition) => this.register(definition));
  }

  unregister(name: string): void {
    this.blocks.delete(name);
  }

  clear(): void {
    this.blocks.clear();
  }

  get(name: string): BlockDefinition | undefined {
    return this.blocks.get(name);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.blocks.values());
  }

  getForPlacement(placement: 'chat' | 'zone'): BlockDefinition[] {
    return this.getAll().filter((definition) =>
      definition.allowedPlacements.includes(placement)
    );
  }

  getAllowed(zoneAllowlist?: BlockDefinition[], placement?: 'chat' | 'zone'): BlockDefinition[] {
    const candidates = Array.isArray(zoneAllowlist) && zoneAllowlist.length > 0
      ? zoneAllowlist
      : this.getAll();

    return placement
      ? candidates.filter((definition) => definition.allowedPlacements.includes(placement))
      : candidates;
  }

  validateProps(name: string, props: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const definition = this.get(name);
    if (!definition?.propSchema) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    for (const [key, spec] of Object.entries(definition.propSchema)) {
      const value = props[key];
      if (spec.required && value === undefined) {
        errors.push(`Missing required prop "${key}"`);
        continue;
      }
      if (value !== undefined && !isPropTypeValid(value, spec.type)) {
        errors.push(`Invalid prop "${key}": expected ${spec.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const globalBlockRegistry = new BlockRegistry();
export const BlockRegistryContext = createContext<BlockRegistry>(globalBlockRegistry);

export function toBlockDefinition(
  component: React.ComponentType<any>,
  defaults?: Partial<Omit<BlockDefinition, 'name' | 'component'>>
): BlockDefinition {
  return {
    name: component.displayName || component.name,
    component,
    allowedPlacements: defaults?.allowedPlacements || ['chat', 'zone'],
    interventionEligible: defaults?.interventionEligible ?? false,
    interventionType: defaults?.interventionType ?? 'none',
    propSchema: defaults?.propSchema,
    previewTextBuilder: defaults?.previewTextBuilder,
    styleSlots: defaults?.styleSlots,
  };
}

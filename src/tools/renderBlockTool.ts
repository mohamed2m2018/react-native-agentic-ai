import React from 'react';
import type { ToolDefinition, AIRichBlockLifecycle, BlockDefinition } from '../core/types';
import { globalBlockRegistry } from '../core/BlockRegistry';
import { globalZoneRegistry } from '../core/ZoneRegistry';
import { logger } from '../utils/logger';

function sanitizePropValue(value: unknown): unknown {
  if (
    value == null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizePropValue(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, sanitizePropValue(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }

  return undefined;
}

function parsePropsArg(rawProps: unknown): Record<string, unknown> {
  if (rawProps == null || rawProps === '') {
    return {};
  }

  const parsed = typeof rawProps === 'string' ? JSON.parse(rawProps) : rawProps;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('props must be a JSON object');
  }

  return sanitizePropValue(parsed) as Record<string, unknown>;
}

function getAllowedZoneBlocks(zone: any): BlockDefinition[] {
  const explicitBlocks = Array.isArray(zone.blocks) ? zone.blocks : [];
  if (explicitBlocks.length > 0) {
    return explicitBlocks;
  }

  const legacyTemplates = Array.isArray(zone.templates) ? zone.templates : [];
  return legacyTemplates
    .map((template: React.ComponentType<any>) => {
      const name = template.displayName || template.name;
      if (!name) return null;
      return globalBlockRegistry.get(name) || {
        name,
        component: template,
        allowedPlacements: ['chat', 'zone'] as const,
        interventionEligible: true,
        interventionType: 'contextual_help' as const,
      };
    })
    .filter((definition: BlockDefinition | null): definition is BlockDefinition => !!definition);
}

export function createRenderBlockTool(): ToolDefinition {
  return {
    name: 'render_block',
    description:
      'Render a registered UI block into a specific AIZone as a temporary contextual intervention. Use this only when a local in-screen block helps the user decide, fix, or proceed faster than chat.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'The ID of the AIZone where the block should be rendered',
        required: true,
      },
      blockType: {
        type: 'string',
        description: 'The registered block name to render',
        required: true,
      },
      props: {
        type: 'string',
        description: 'JSON object string of props to pass into the selected block',
        required: false,
      },
      lifecycle: {
        type: 'string',
        description: 'Optional lifecycle: "dismissible" or "persistent"',
        required: false,
        enum: ['dismissible', 'persistent'],
      },
    },
    execute: async (args) => {
      const zoneId = String(args.zoneId);
      const blockType = String(args.blockType);
      const lifecycle =
        args.lifecycle === 'persistent' ? 'persistent' : 'dismissible';

      if (!globalZoneRegistry.isActionAllowed(zoneId, 'block')) {
        return `❌ Cannot render block into zone "${zoneId}": Zone does not exist or allowInjectBlock is false.`;
      }

      const zone = globalZoneRegistry.get(zoneId) as any;
      if (!zone) {
        return `❌ Cannot render block into zone "${zoneId}": Zone does not exist.`;
      }

      const allowedBlocks = getAllowedZoneBlocks(zone);
      if (allowedBlocks.length === 0) {
        return `❌ Cannot render block into zone "${zoneId}": No blocks are registered for this zone.`;
      }

      const blockDefinition =
        allowedBlocks.find((candidate) => candidate.name === blockType)
        || globalBlockRegistry.get(blockType);

      if (!blockDefinition) {
        const availableBlocks = allowedBlocks.map((candidate) => candidate.name).join(', ');
        return `❌ Cannot render block into zone "${zoneId}": Block "${blockType}" is not registered for this zone. Available blocks: ${availableBlocks || 'none'}.`;
      }

      const zoneAllowsIntervention =
        zone.interventionEligible === true
        || zone.allowInjectCard === true
        || (Array.isArray(zone.templates) && zone.templates.length > 0);
      const blockAllowsIntervention =
        blockDefinition.interventionEligible !== false;

      if (!zoneAllowsIntervention || !blockAllowsIntervention) {
        return `❌ Cannot render block "${blockType}" into zone "${zoneId}": Block or zone is not eligible for screen intervention.`;
      }

      let sanitizedProps: Record<string, unknown>;
      try {
        sanitizedProps = parsePropsArg(args.props);
      } catch (error: any) {
        return `❌ Cannot render block into zone "${zoneId}": Invalid props JSON. ${error.message}`;
      }

      const validation = globalBlockRegistry.validateProps(blockDefinition.name, sanitizedProps);
      if (!validation.valid) {
        return `❌ Cannot render block into zone "${zoneId}": ${validation.errors.join(' ')}`;
      }

      if (!zone._controller?.renderBlock && !zone._controller?.injectCard) {
        return `❌ Cannot render block into zone "${zoneId}": Controller not attached. Is the zone currently rendered on screen?`;
      }

      const blockElement = React.createElement(blockDefinition.component, sanitizedProps);
      if (zone._controller?.renderBlock) {
        zone._controller.renderBlock(
          blockElement,
          lifecycle as AIRichBlockLifecycle
        );
      } else {
        zone._controller.injectCard(blockElement);
      }
      logger.info('RenderBlockTool', `Rendered ${blockDefinition.name} into zone: ${zoneId}`);

      return `✅ Rendered "${blockDefinition.name}" in zone "${zoneId}". Tell the user where to look on screen.`;
    },
  };
}

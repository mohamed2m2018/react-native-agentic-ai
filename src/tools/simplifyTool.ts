import type { ToolDefinition } from '../core/types';
import { globalZoneRegistry } from '../core/ZoneRegistry';
import { logger } from '../utils/logger';

export function createSimplifyTool(): ToolDefinition {
  return {
    name: 'simplify_zone',
    description: 'Simplify the UI in a specific Zone by telling it to hide elements marked as aiPriority="low". Use this when a screen zone looks cluttered and you want to reduce cognitive load for the user.',
    parameters: {
      zoneId: { 
        type: 'string', 
        description: 'The ID of the AIZone you want to simplify (e.g. from the screen layout context)',
        required: true,
      }
    },
    execute: async (args) => {
      const zoneId = String(args.zoneId);

      if (!globalZoneRegistry.isActionAllowed(zoneId, 'simplify')) {
        return `❌ Cannot simplify zone "${zoneId}": Zone does not exist or allowSimplify is false.`;
      }

      const zone = globalZoneRegistry.get(zoneId) as any;
      if (zone && zone._controller) {
        zone._controller.simplify();
        logger.info('SimplifyTool', `Simplified zone: ${zoneId}`);
        return `✅ Successfully requested simplification for zone "${zoneId}".`;
      }

      return `❌ Cannot simplify zone "${zoneId}": Controller not attached. Is the zone currently rendered on screen?`;
    },
  };
}

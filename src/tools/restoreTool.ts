import type { ToolDefinition } from '../core/types';
import { globalZoneRegistry } from '../core/ZoneRegistry';
import { logger } from '../utils/logger';

export function createRestoreTool(): ToolDefinition {
  return {
    name: 'restore_zone',
    description: 'Restore a specific Zone to its default state, reversing any previous simplify_zone or inject_card operations.',
    parameters: {
      zoneId: { 
        type: 'string', 
        description: 'The ID of the AIZone to restore',
        required: true,
      }
    },
    execute: async (args) => {
      const zoneId = String(args.zoneId);

      const zone = globalZoneRegistry.get(zoneId) as any;
      if (!zone) {
        return `❌ Cannot restore zone "${zoneId}": Zone does not exist.`;
      }

      if (zone._controller) {
        zone._controller.restore();
        logger.info('RestoreTool', `Restored zone: ${zoneId}`);
        return `✅ Successfully restored zone "${zoneId}" to its default state.`;
      }

      return `❌ Cannot restore zone "${zoneId}": Controller not attached.`;
    },
  };
}

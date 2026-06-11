import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

export function createRestoreTool(context: ToolContext): ToolDefinition {
  return {
    name: 'restore_zone',
    description: 'Restore a specific Zone to its default state, reversing any previous simplify_zone, render_block, or inject_card operations.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'The ID of the AIZone to restore',
        required: true,
      },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'restore_zone',
        zoneId: String(args.zoneId),
      }),
  };
}

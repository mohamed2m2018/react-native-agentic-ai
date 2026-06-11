import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

export function createSimplifyTool(context: ToolContext): ToolDefinition {
  return {
    name: 'simplify_zone',
    description: 'Simplify the UI in a specific Zone by telling it to hide elements marked as aiPriority="low". Use this when a screen zone looks cluttered and you want to reduce cognitive load for the user.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'The ID of the AIZone you want to simplify (e.g. from the screen layout context)',
        required: true,
      },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'simplify_zone',
        zoneId: String(args.zoneId),
      }),
  };
}

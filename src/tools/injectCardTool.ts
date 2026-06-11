import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

export function createInjectCardTool(context: ToolContext): ToolDefinition {
  return {
    name: 'inject_card',
    description:
      'Deprecated compatibility alias for render_block(). Inject a pre-built React card template into a specific AIZone.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'The ID of the AIZone where the card should be rendered',
        required: true,
      },
      templateName: {
        type: 'string',
        description: 'The displayName of the whitelisted card template to render in that zone',
        required: true,
      },
      props: {
        type: 'string',
        description: 'JSON object string of props to pass into the selected template',
        required: false,
      },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'inject_card',
        zoneId: String(args.zoneId),
        templateName: String(args.templateName),
        props: args.props,
      }),
  };
}

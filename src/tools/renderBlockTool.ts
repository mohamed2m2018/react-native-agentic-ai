import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

export function createRenderBlockTool(context: ToolContext): ToolDefinition {
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
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'render_block',
        zoneId: String(args.zoneId),
        blockType: String(args.blockType),
        props: args.props,
        lifecycle: args.lifecycle === 'persistent' ? 'persistent' : 'dismissible',
      }),
  };
}

import type { AgentTool, ToolContext } from './types';

export function createTapTool(context: ToolContext): AgentTool {
  return {
    name: 'tap',
    description: 'Tap an interactive element by its index. Works universally on buttons, radios, switches, and custom components.',
    parameters: {
      index: { type: 'number', description: 'The index of the element to tap', required: true },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'tap',
        index: Number(args.index),
      }),
  };
}

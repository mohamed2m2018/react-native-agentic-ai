import type { AgentTool, ToolContext } from './types';

export function createScrollTool(context: ToolContext): AgentTool {
  return {
    name: 'scroll',
    description: 'Scroll the current screen to reveal more content. Use when you need to see items that are not yet visible, e.g. in lazy-loaded lists, long forms, or paginated content. If the screen has multiple scrollable areas, specify containerIndex to target a specific one.',
    parameters: {
      direction: {
        type: 'string',
        description: "Scroll direction: 'down' or 'up'",
        required: true,
        enum: ['down', 'up'],
      },
      amount: {
        type: 'string',
        description: "How far to scroll: 'page' (default, ~one screenful), 'toEnd' (jump to bottom), or 'toStart' (jump to top)",
        required: false,
        enum: ['page', 'toEnd', 'toStart'],
      },
      containerIndex: {
        type: 'number',
        description: 'Index of the scrollable container to scroll (0-based). Use when the screen has multiple scrollable areas. Default: 0 (the main/first scrollable area).',
        required: false,
      },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'scroll',
        direction: args.direction === 'up' ? 'up' : 'down',
        amount: args.amount,
        containerIndex:
          typeof args.containerIndex === 'number' ? args.containerIndex : undefined,
      }),
  };
}

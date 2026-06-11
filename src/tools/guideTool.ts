import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

export function createGuideTool(context: ToolContext): ToolDefinition {
  return {
    name: 'guide_user',
    description: 'Highlight a specific element to draw the user\'s attention. Use when you want to show the user where to tap next. Auto-dismisses after a few seconds.',
    parameters: {
      index: {
        type: 'number',
        description: 'Fiber element index from the screen layout',
        required: true,
      },
      message: {
        type: 'string',
        description: 'Short instruction shown near the highlighted element (e.g. "Tap here to continue")',
        required: true,
      },
      autoRemoveAfterMs: {
        type: 'number',
        description: 'Auto-dismiss after this many milliseconds. Default: 5000',
        required: false,
      },
    },
    execute: async (args: Record<string, any>) =>
      context.platformAdapter.executeAction({
        type: 'guide_user',
        index: Number(args.index),
        message: String(args.message ?? ''),
        autoRemoveAfterMs:
          typeof args.autoRemoveAfterMs === 'number'
            ? args.autoRemoveAfterMs
            : undefined,
      }),
  };
}

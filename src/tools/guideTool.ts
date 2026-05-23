import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';

const ACTIONS = ['tap', 'read', 'type', 'verify', 'scroll', 'fill', 'wait'] as const;
type HighlightAction = typeof ACTIONS[number];

function normalizeAction(value: unknown): HighlightAction | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  return (ACTIONS as readonly string[]).includes(v) ? (v as HighlightAction) : undefined;
}

export function createGuideTool(context: ToolContext): ToolDefinition {
  return {
    name: 'guide_user',
    description: 'Show a blue ring + tooltip overlay on a specific element so the user can see what you are looking at or about to do. CALL THIS EAGERLY whenever you read data from the screen — every order detail, total, fee, status, or field you inspect should be highlighted with action="read" or action="verify" BEFORE you mention it in your reply. Use action="tap" when guiding the user to tap. Use action="type" when typing. Auto-dismisses after ~5s.',
    parameters: {
      index: {
        type: 'number',
        description: 'Fiber element index from the screen layout',
        required: true,
      },
      message: {
        type: 'string',
        description: 'Short instruction shown near the highlighted element (e.g. "Tap here to continue"). Optional when `action` is set — a default label is used.',
        required: false,
      },
      action: {
        type: 'string',
        description: 'Optional action tag: "tap" | "read" | "type" | "verify" | "scroll" | "fill" | "wait". Adds a leading glyph to the tooltip and a default label.',
        required: false,
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
        action: normalizeAction(args.action),
        autoRemoveAfterMs:
          typeof args.autoRemoveAfterMs === 'number'
            ? args.autoRemoveAfterMs
            : undefined,
      }),
  };
}

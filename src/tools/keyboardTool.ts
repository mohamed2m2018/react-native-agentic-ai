import type { AgentTool, ToolContext } from './types';

export function createKeyboardTool(context: ToolContext): AgentTool {
  return {
    name: 'dismiss_keyboard',
    description: 'Dismiss the on-screen keyboard. Use after typing into a text input when the keyboard is blocking other elements.',
    parameters: {},
    execute: async () =>
      context.platformAdapter.executeAction({
        type: 'dismiss_keyboard',
      }),
  };
}

import type { AgentTool, ToolContext } from './types';

export function createPickerTool(context: ToolContext): AgentTool {
  return {
    name: 'select_picker',
    description: 'Select a value from a picker/dropdown by its index. Provide the exact value string to select.',
    parameters: {
      index: { type: 'number', description: 'The index of the picker element', required: true },
      value: { type: 'string', description: 'The value to select (must match an available option)', required: true },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'select_picker',
        index: Number(args.index),
        value: String(args.value ?? ''),
      }),
  };
}

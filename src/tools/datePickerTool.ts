import type { AgentTool, ToolContext } from './types';

export function createDatePickerTool(context: ToolContext): AgentTool {
  return {
    name: 'set_date',
    description: 'Set the value of a date/time picker. Provide the date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).',
    parameters: {
      index: { type: 'number', description: 'The index of the date picker element', required: true },
      date: { type: 'string', description: 'Date in ISO 8601 format, e.g., "2025-03-25" or "2025-03-25T14:30:00"', required: true },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'set_date',
        index: Number(args.index),
        date: String(args.date ?? ''),
      }),
  };
}

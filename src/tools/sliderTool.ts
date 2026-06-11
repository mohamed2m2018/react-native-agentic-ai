import type { AgentTool, ToolContext } from './types';

export function createSliderTool(context: ToolContext): AgentTool {
  return {
    name: 'adjust_slider',
    description: 'Adjust a slider to a specific position. Use for sliders, seek bars, and range selectors. Value is normalized 0.0 (minimum) to 1.0 (maximum).',
    parameters: {
      index: { type: 'number', description: 'The index of the slider element', required: true },
      value: { type: 'number', description: 'Target position from 0.0 (min) to 1.0 (max)', required: true },
    },
    execute: async (args) =>
      context.platformAdapter.executeAction({
        type: 'adjust_slider',
        index: Number(args.index),
        value: Number(args.value),
      }),
  };
}

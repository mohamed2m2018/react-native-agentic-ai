/**
 * Slider Tool — Adjust slider/seekbar values.
 *
 * Pattern from Detox:
 * - adjustSliderToPosition(normalizedPosition) — 0.0 to 1.0
 * - UISlider+DetoxUtils: value = normalized * (max - min) + min
 *
 * In JS: calls onValueChange(actualValue) then onSlidingComplete(actualValue).
 * Reads min/max from props (minimumValue/maximumValue).
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

export function createSliderTool(context: ToolContext): AgentTool {
  return {
    name: 'adjust_slider',
    description: 'Adjust a slider to a specific position. Use for sliders, seek bars, and range selectors. Value is normalized 0.0 (minimum) to 1.0 (maximum).',
    parameters: {
      index: { type: 'number', description: 'The index of the slider element', required: true },
      value: { type: 'number', description: 'Target position from 0.0 (min) to 1.0 (max)', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.rootRef, context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found.`;
      }

      // Validate normalized value
      const normalizedValue = Number(args.value);
      if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 1) {
        return `❌ Slider value must be between 0.0 and 1.0, got ${args.value}`;
      }

      // Find onValueChange (Slider's primary callback)
      const onValueChange = element.props.onValueChange;
      if (!onValueChange || typeof onValueChange !== 'function') {
        return `❌ Element [${args.index}] "${element.label}" is not a slider (no onValueChange handler).`;
      }

      // Calculate actual value from normalized position
      // Pattern from Detox UISlider+DetoxUtils:
      // actualValue = normalized * (max - min) + min
      const min = element.props.minimumValue ?? 0;
      const max = element.props.maximumValue ?? 1;
      const actualValue = normalizedValue * (max - min) + min;

      try {
        // Call onValueChange (continuous feedback)
        onValueChange(actualValue);

        // Call onSlidingComplete if available (final value callback)
        if (element.props.onSlidingComplete && typeof element.props.onSlidingComplete === 'function') {
          element.props.onSlidingComplete(actualValue);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        return `✅ Adjusted slider [${args.index}] "${element.label}" to ${Math.round(normalizedValue * 100)}% (value: ${actualValue.toFixed(2)})`;
      } catch (error: any) {
        return `❌ Error adjusting slider: ${error.message}`;
      }
    },
  };
}

/**
 * Picker Tool — Select values from picker/dropdown components.
 *
 * Pattern from Detox: setColumnToValue(column, value)
 *
 * In JS: calls onValueChange(itemValue, itemIndex).
 * Reads available options from props.children (Picker.Item) or props.items array.
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

/**
 * Extract available options from a picker element's props.
 * Handles multiple picker libraries:
 * - RN Picker: children are Picker.Item with { label, value } props
 * - RNPickerSelect: items prop is array of { label, value }
 * - DropDownPicker: items prop is array of { label, value }
 */
function extractPickerOptions(element: any): Array<{ label: string; value: any }> {
  const props = element.props || {};
  const options: Array<{ label: string; value: any }> = [];

  // Pattern 1: items prop (RNPickerSelect, DropDownPicker)
  if (Array.isArray(props.items)) {
    for (const item of props.items) {
      if (item && item.label !== undefined) {
        options.push({ label: String(item.label), value: item.value });
      }
    }
    return options;
  }

  // Pattern 2: options prop (some custom pickers)
  if (Array.isArray(props.options)) {
    for (const item of props.options) {
      if (typeof item === 'string') {
        options.push({ label: item, value: item });
      } else if (item && item.label !== undefined) {
        options.push({ label: String(item.label), value: item.value });
      }
    }
    return options;
  }

  // Pattern 3: Fiber children (RN Picker with Picker.Item children)
  const fiberNode = element.fiberNode;
  if (fiberNode?.child) {
    let child = fiberNode.child;
    while (child) {
      const childProps = child.memoizedProps || {};
      if (childProps.label !== undefined && childProps.value !== undefined) {
        options.push({ label: String(childProps.label), value: childProps.value });
      }
      child = child.sibling;
    }
  }

  return options;
}

export function createPickerTool(context: ToolContext): AgentTool {
  return {
    name: 'select_picker',
    description: 'Select a value from a picker/dropdown by its index. Provide the exact value string to select.',
    parameters: {
      index: { type: 'number', description: 'The index of the picker element', required: true },
      value: { type: 'string', description: 'The value to select (must match an available option)', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.rootRef, context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found.`;
      }

      const onValueChange = element.props.onValueChange;
      if (!onValueChange || typeof onValueChange !== 'function') {
        return `❌ Element [${args.index}] "${element.label}" is not a picker (no onValueChange handler).`;
      }

      // Find available options
      const options = extractPickerOptions(element);

      if (options.length > 0) {
        // Find matching option (case-insensitive)
        const match = options.find(
          opt => String(opt.value) === args.value ||
                 opt.label.toLowerCase() === args.value.toLowerCase()
        );
        if (!match) {
          const available = options.map(o => `"${o.label}" (${o.value})`).join(', ');
          return `❌ Value "${args.value}" not found in picker. Available: ${available}`;
        }
        try {
          const matchIndex = options.indexOf(match);
          onValueChange(match.value, matchIndex);
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Selected "${match.label}" in picker [${args.index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error selecting picker value: ${error.message}`;
        }
      }

      // No options found — try direct value pass
      try {
        onValueChange(args.value, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        return `✅ Set picker [${args.index}] "${element.label}" to "${args.value}"`;
      } catch (error: any) {
        return `❌ Error setting picker value: ${error.message}`;
      }
    },
  };
}

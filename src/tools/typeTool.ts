/**
 * Type Tool — Text input via onChangeText.
 *
 * Handles TextInput components by calling their onChangeText prop directly.
 * Also supports onSubmitEditing for form submission.
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

export function createTypeTool(context: ToolContext): AgentTool {
  return {
    name: 'type',
    description: 'Type text into a text-input element by its index.',
    parameters: {
      index: { type: 'number', description: 'The index of the text-input element', required: true },
      text: { type: 'string', description: 'The text to type', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.rootRef, context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found.`;
      }
      if (!element.props.onChangeText) {
        return `❌ Element [${args.index}] "${element.label}" is not a text input.`;
      }
      try {
        element.props.onChangeText(args.text);
        await new Promise(resolve => setTimeout(resolve, 500));
        return `✅ Typed "${args.text}" into [${args.index}] "${element.label}"`;
      } catch (error: any) {
        return `❌ Error typing: ${error.message}`;
      }
    },
  };
}

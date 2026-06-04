/**
 * Long Press Tool — Extended press interaction via onLongPress.
 *
 * Pattern from:
 * - Detox: longPress(point, duration)
 * - Maestro: longPress(point)
 *
 * In JS fiber level: calls onLongPress prop (available on Pressable/TouchableOpacity).
 * Bubbles up fiber tree if direct element doesn't have onLongPress.
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

export function createLongPressTool(context: ToolContext): AgentTool {
  return {
    name: 'long_press',
    description: 'Long-press an interactive element by its index. Use for actions that require a longer touch, such as showing context menus, reordering items, or triggering secondary actions.',
    parameters: {
      index: { type: 'number', description: 'The index of the element to long-press', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.getRootRef(), context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
      }

      // Strategy 1: Direct onLongPress
      if (element.props.onLongPress && typeof element.props.onLongPress === 'function') {
        try {
          element.props.onLongPress();
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Long-pressed [${args.index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error long-pressing [${args.index}]: ${error.message}`;
        }
      }

      // Strategy 2: Bubble up fiber tree
      let fiber = element.fiberNode?.return;
      let bubbleDepth = 0;
      while (fiber && bubbleDepth < 5) {
        const parentProps = fiber.memoizedProps || {};
        if (parentProps.onLongPress && typeof parentProps.onLongPress === 'function') {
          try {
            parentProps.onLongPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Long-pressed parent of [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error long-pressing parent of [${args.index}]: ${error.message}`;
          }
        }
        fiber = fiber.return;
        bubbleDepth++;
      }

      return `❌ Element [${args.index}] "${element.label}" has no long-press handler. Try using tap instead.`;
    },
  };
}

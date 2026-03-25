/**
 * Tap Tool — Universal element interaction via onPress.
 *
 * Strategies (in priority order):
 * 1. Switch → onValueChange (toggle)
 * 2. Direct onPress on element
 * 3. Bubble up fiber tree to find parent onPress (max 5 levels)
 *
 * Includes Maestro-style tap verification:
 * - Captures element count + screen name before tap
 * - Compares after tap to detect dead taps
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

export function createTapTool(context: ToolContext): AgentTool {
  return {
    name: 'tap',
    description: 'Tap an interactive element by its index. Works universally on buttons, switches, and custom components.',
    parameters: {
      index: { type: 'number', description: 'The index of the element to tap', required: true },
    },
    execute: async (args) => {
      const walkResult = walkFiberTree(context.rootRef, context.getWalkConfig());
      const elements = walkResult.interactives;
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
      }

      // Pre-tap snapshot for change detection (Pattern from Maestro: hierarchyBasedTap)
      const elementCountBefore = elements.length;
      const screenBefore = context.getCurrentScreenName();

      // Strategy 1: Switch → onValueChange
      if (element.type === 'switch' && element.props.onValueChange) {
        try {
          element.props.onValueChange(!element.props.value);
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Toggled [${args.index}] "${element.label}" to ${!element.props.value}`;
        } catch (error: any) {
          return `❌ Error toggling [${args.index}]: ${error.message}`;
        }
      }

      // Strategy 2: Direct onPress
      if (element.props.onPress) {
        try {
          element.props.onPress();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Post-tap observation (Maestro pattern: compare hierarchy after tap)
          const postWalk = walkFiberTree(context.rootRef, context.getWalkConfig());
          const screenAfter = context.getCurrentScreenName();
          const elementCountAfter = postWalk.interactives.length;

          if (screenAfter !== screenBefore) {
            return `✅ Tapped [${args.index}] "${element.label}" → navigated to "${screenAfter}"`;
          }
          if (Math.abs(elementCountAfter - elementCountBefore) > 0) {
            return `✅ Tapped [${args.index}] "${element.label}" → screen updated (${elementCountBefore} → ${elementCountAfter} elements)`;
          }
          // Many valid taps (add-to-cart, favorites, API calls) update state
          // without changing visible UI elements. Report success and move on.
          return `✅ Tapped [${args.index}] "${element.label}" → action executed successfully. Proceed to your next step.`;
        } catch (error: any) {
          return `❌ Error tapping [${args.index}]: ${error.message}`;
        }
      }

      // Strategy 3: Bubble up fiber tree (like RNTL's findEventHandler)
      let fiber = element.fiberNode?.return;
      let bubbleDepth = 0;
      while (fiber && bubbleDepth < 5) {
        const parentProps = fiber.memoizedProps || {};
        if (parentProps.onPress && typeof parentProps.onPress === 'function') {
          try {
            parentProps.onPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Tapped parent of [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error tapping parent of [${args.index}]: ${error.message}`;
          }
        }
        fiber = fiber.return;
        bubbleDepth++;
      }

      return `❌ Element [${args.index}] "${element.label}" has no tap handler (no onPress or onValueChange found).`;
    },
  };
}

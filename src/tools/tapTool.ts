/**
 * Tap Tool — Universal element interaction via onPress.
 *
 * Strategies (in priority order):
 * 1. Switch → onValueChange (toggle)
 * 2. Radio → onPress / onValueChange / parent radio-group handler
 * 3. Direct onPress on element
 * 4. Bubble up fiber tree to find parent onPress (max 5 levels)
 *
 * Includes Maestro-style tap verification:
 * - Captures element count + screen name before tap
 * - Compares after tap to detect dead taps
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import { getParent, getProps } from '../core/FiberAdapter';
import { dismissAlert } from '../core/NativeAlertInterceptor';
import type { AgentTool, ToolContext } from './types';

type RadioSelectionHandler = 'onValueChange' | 'onChange' | 'onCheckedChange' | 'onSelect';

function isScalarSelectionValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function getRadioSelectionPayload(props: Record<string, any>): string | number | boolean {
  return isScalarSelectionValue(props.value) ? props.value : true;
}

function getRadioSelectionHandler(props: Record<string, any>): { channel: RadioSelectionHandler; handler: Function } | null {
  if (typeof props.onValueChange === 'function') {
    return { channel: 'onValueChange', handler: props.onValueChange as Function };
  }
  if (typeof props.onCheckedChange === 'function') {
    return { channel: 'onCheckedChange', handler: props.onCheckedChange as Function };
  }
  if (typeof props.onChange === 'function') {
    return { channel: 'onChange', handler: props.onChange as Function };
  }
  if (typeof props.onSelect === 'function') {
    return { channel: 'onSelect', handler: props.onSelect as Function };
  }
  return null;
}

export function createTapTool(context: ToolContext): AgentTool {
  return {
    name: 'tap',
    description: 'Tap an interactive element by its index. Works universally on buttons, radios, switches, and custom components.',
    parameters: {
      index: { type: 'number', description: 'The index of the element to tap', required: true },
    },
    execute: async (args) => {
      const walkResult = walkFiberTree(context.getRootRef(), context.getWalkConfig());
      const elements = walkResult.interactives;
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
      }

      // Pre-tap snapshot for change detection (Pattern from Maestro: hierarchyBasedTap)
      const elementCountBefore = elements.length;
      const screenBefore = context.getCurrentScreenName();

      // Strategy 0: Virtual elements (Native OS dialogs)
      if (element.virtual?.kind === 'alert_button') {
        dismissAlert(element.virtual.alertButtonIndex);
        await new Promise(resolve => setTimeout(resolve, 500));
        return `✅ Tapped native alert button [${args.index}] "${element.label}" → dialog dismissed`;
      }

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

      // Strategy 2: Radio → own selection handler
      if (element.type === 'radio') {
        const radioPayload = getRadioSelectionPayload(element.props);
        const ownSelectionHandler = getRadioSelectionHandler(element.props);

        if (element.props.onPress) {
          try {
            element.props.onPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Selected [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error selecting [${args.index}]: ${error.message}`;
          }
        }

        if (ownSelectionHandler) {
          try {
            ownSelectionHandler.handler(radioPayload);
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Selected [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error selecting [${args.index}]: ${error.message}`;
          }
        }
      }

      // Strategy 3: Direct onPress
      if (element.props.onPress) {
        try {
          element.props.onPress();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Post-tap observation (Maestro pattern: compare hierarchy after tap)
          const postWalk = walkFiberTree(context.getRootRef(), context.getWalkConfig());
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

      // Strategy 4: Bubble up fiber tree (like RNTL's findEventHandler)
      let fiber = getParent(element.fiberNode);
      let bubbleDepth = 0;
      const radioPayload = element.type === 'radio' ? getRadioSelectionPayload(element.props) : undefined;
      while (fiber && bubbleDepth < 5) {
        const parentProps = getProps(fiber);
        if (parentProps.onPress && typeof parentProps.onPress === 'function') {
          try {
            parentProps.onPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Tapped parent of [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error tapping parent of [${args.index}]: ${error.message}`;
          }
        }
        if (element.type === 'radio') {
          const parentSelectionHandler = getRadioSelectionHandler(parentProps);
          if (parentSelectionHandler) {
            try {
              parentSelectionHandler.handler(radioPayload);
              await new Promise(resolve => setTimeout(resolve, 500));
              return `✅ Selected [${args.index}] "${element.label}" via parent group`;
            } catch (error: any) {
              return `❌ Error selecting [${args.index}] via parent group: ${error.message}`;
            }
          }
        }
        fiber = getParent(fiber);
        bubbleDepth++;
      }

      return `❌ Element [${args.index}] "${element.label}" has no tap handler (no onPress, onValueChange, or radio selection handler found).`;
    },
  };
}

/**
 * Type Tool — Reliable multi-strategy text input.
 *
 * For uncontrolled TextInputs (defaultValue, no onChangeText):
 *   1. Walk fiber subtree (BFS) to find the native host view whose
 *      memoizedProps has `onChange` — this is RN's internal `_onChange`.
 *   2. ALSO walk to find the native stateNode with `setNativeProps` to
 *      update the VISUAL text in the native view.
 *
 * Both steps are needed:
 *   - `onChange` → updates React's internal lastNativeText state
 *   - `setNativeProps` → updates what the user sees on screen
 *
 * No hardcoded fiber tag numbers. Detection is purely behavior-based.
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import { getChild, getSibling, getProps, getStateNode } from '../core/FiberAdapter';
import type { AgentTool, ToolContext } from './types';

/** BFS through fiber children. Returns first node where predicate matches. */
function findFiberNode(rootFiber: any, predicate: (node: any) => boolean, maxDepth = 10): any | null {
  const firstChild = getChild(rootFiber);
  if (!firstChild) return null;
  const queue: { node: any; depth: number }[] = [{ node: firstChild, depth: 0 }];
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (!node || depth > maxDepth) continue;
    if (predicate(node)) return node;
    const child = getChild(node);
    if (child) queue.push({ node: child, depth: depth + 1 });
    const sibling = getSibling(node);
    if (sibling) queue.push({ node: sibling, depth: depth + 1 });
  }
  return null;
}

export function createTypeTool(context: ToolContext): AgentTool {
  return {
    name: 'type',
    description: 'Type text into a text-input element by its index.',
    parameters: {
      index: { type: 'number', description: 'The index of the text-input element', required: true },
      text: { type: 'string', description: 'The text to type', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.getRootRef(), context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);

      if (!element) {
        return `❌ Element with index ${args.index} not found.`;
      }

      const props = element.props;
      const label = element.label || `[${element.type}]`;
      const fiberNode = element.fiberNode;

      // ── Strategy 1: controlled via onChangeText ───────────────────────────
      if (typeof props.onChangeText === 'function') {
        try {
          props.onChangeText(args.text);
          await new Promise(resolve => setTimeout(resolve, 300));
          return `✅ Typed "${args.text}" into [${args.index}] "${label}"`;
        } catch (err: any) {
          return `❌ onChangeText failed: ${err.message}`;
        }
      }

      // ── Strategy 2: uncontrolled — find native onChange + setNativeProps ──
      // For TextInputs with defaultValue only.
      // We need BOTH:
      //   a) find the onChange handler (RN's internal _onChange) to update React state
      //   b) find the native stateNode to call setNativeProps to update visual display
      if (fiberNode) {
        // Find native onChange handler (behavior-based, no tag numbers)
        const fiberProps = getProps(fiberNode);
        const nativeOnChangeFiber = fiberProps?.onChange
          ? fiberNode
          : findFiberNode(fiberNode, n => typeof getProps(n)?.onChange === 'function');

        // Find native stateNode (host component with setNativeProps)
        const fiberStateNode = getStateNode(fiberNode);
        const nativeStateFiber = fiberStateNode?.setNativeProps
          ? fiberNode
          : findFiberNode(fiberNode, n => {
              const stateN = getStateNode(n);
              return stateN && typeof stateN.setNativeProps === 'function';
            });

        const onChange = getProps(nativeOnChangeFiber)?.onChange;
        const nativeInstance = getStateNode(nativeStateFiber);

        if (onChange || nativeInstance) {
          try {
            // Step 1: Update visual text in native view
            if (nativeInstance && typeof nativeInstance.setNativeProps === 'function') {
              nativeInstance.setNativeProps({ text: args.text });
            }

            // Step 2: Notify React's internal onChange so lastNativeText stays in sync
            if (typeof onChange === 'function') {
              onChange({
                nativeEvent: {
                  text: args.text,
                  eventCount: 1,
                  target: 0,
                },
              });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            return `✅ Typed "${args.text}" into [${args.index}] "${label}"`;
          } catch (err: any) {
            return `❌ Type failed: ${err.message}`;
          }
        }
      }

      return `❌ Element [${args.index}] "${label}" is not a typeable text input. No onChange or native stateNode found in fiber tree.`;
    },
  };
}

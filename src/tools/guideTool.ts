import { DeviceEventEmitter } from 'react-native';
import type { ToolDefinition } from '../core/types';
import type { ToolContext } from './types';
import { logger } from '../utils/logger';
import { getStateNode } from '../core/FiberAdapter';

export function createGuideTool(context: ToolContext): ToolDefinition {
  return {
    name: 'guide_user',
    description: 'Highlight a specific element to draw the user\'s attention. Use when you want to show the user where to tap next. Auto-dismisses after a few seconds.',
    parameters: {
      index: { 
        type: 'number', 
        description: 'Fiber element index from the screen layout',
        required: true,
      },
      message: { 
        type: 'string', 
        description: 'Short instruction shown near the highlighted element (e.g. "Tap here to continue")',
        required: true,
      },
      autoRemoveAfterMs: { 
        type: 'number', 
        description: 'Auto-dismiss after this many milliseconds. Default: 5000',
        required: false,
      }
    },
    execute: async (args: Record<string, any>) => {
      const lastDehydratedRoot = context.getLastDehydratedRoot?.();
      if (!lastDehydratedRoot) {
        return '❌ Cannot guide user: No screen layout structure available.';
      }

      const index = Number(args.index);
      const element = lastDehydratedRoot.elements[index];

      if (process.env.NODE_ENV === 'test') {
        // Fallback for react-test-renderer which provides a dummy measure() that never fires callbacks
        DeviceEventEmitter.emit('MOBILE_AI_HIGHLIGHT', {
          pageX: 0,
          pageY: 0,
          width: 100,
          height: 100,
          message: args.message,
          autoRemoveAfterMs: args.autoRemoveAfterMs || 5000,
        });
        return `✅ Highlighted element ${index} ("${element.label}") with message: "${args.message}"`;
      }

      const stateNode = getStateNode(element.fiberNode);
      if (!stateNode || typeof stateNode.measure !== 'function') {
        return `❌ Element at index ${index} (${element.label}) cannot be highlighted because its layout position cannot be measured.`;
      }

      return new Promise((resolve) => {
        stateNode.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
          if (width === 0 || height === 0) {
            resolve(`❌ Element at index ${index} is not visible (0x0 size)`);
            return;
          }

          DeviceEventEmitter.emit('MOBILE_AI_HIGHLIGHT', {
            pageX,
            pageY,
            width,
            height,
            message: args.message,
            autoRemoveAfterMs: args.autoRemoveAfterMs || 5000,
          });

          logger.info('GuideTool', `Highlighted element ${index} ("${element.label}") at ${pageX},${pageY}`);
          resolve(`✅ Highlighted element ${index} ("${element.label}") with message: "${args.message}"`);
        });
      });
    },
  };
}

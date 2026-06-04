/**
 * Keyboard Tool — Dismiss the on-screen keyboard.
 *
 * Pattern from:
 * - Maestro: hideKeyboard
 * - Detox: closeSoftKeyboard
 *
 * Uses React Native's Keyboard.dismiss() API.
 * This is a global action — no element index needed.
 */

import { Keyboard } from 'react-native';
import type { AgentTool } from './types';

export function createKeyboardTool(): AgentTool {
  return {
    name: 'dismiss_keyboard',
    description: 'Dismiss the on-screen keyboard. Use after typing into a text input when the keyboard is blocking other elements.',
    parameters: {},
    execute: async () => {
      try {
        Keyboard.dismiss();
        await new Promise(resolve => setTimeout(resolve, 300));
        return '✅ Keyboard dismissed.';
      } catch (error: any) {
        return `❌ Error dismissing keyboard: ${error.message}`;
      }
    },
  };
}

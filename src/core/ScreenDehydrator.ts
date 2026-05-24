/**
 * ScreenDehydrator — Converts discovered interactive elements into
 * a text representation for the LLM.
 *
 * Output example:
 * ```
 * Screen: Home | Available screens: Home, Menu, Cart
 * Interactive elements:
 * [0]<pressable>🍕 Pizzas</>
 * [1]<pressable>🍔 Burgers</>
 * [2]<pressable>🥤 Drinks</>
 * [3]<pressable>🛒 View Cart</>
 * ```
 */

import type { InteractiveElement, DehydratedScreen } from './types';

/**
 * Dehydrate the current screen state into a text format for the LLM.
 */
export function dehydrateScreen(
  screenName: string,
  availableScreens: string[],
  elementsText: string,
  elements: InteractiveElement[],
): DehydratedScreen {
  const lines: string[] = [];

  // Header
  lines.push(`Screen: ${screenName} | Available screens: ${availableScreens.join(', ')}`);
  lines.push('');

  if (!elementsText || elementsText.trim().length === 0) {
    if (elements.length === 0) {
      lines.push('No interactive elements or visible text detected on this screen.');
    } else {
      lines.push('Interactive elements:');
      lines.push(elementsText);
    }
  } else {
    lines.push('Screen Layout & Elements:');
    lines.push(elementsText);
  }

  const finalElementsText = lines.join('\n');

  return {
    screenName,
    availableScreens,
    elementsText: finalElementsText,
    elements,
  };
}

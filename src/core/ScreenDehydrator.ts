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

import type { InteractiveElement, DehydratedScreen, ScreenSnapshot } from './types';

/**
 * Dehydrate the current screen state into a text format for the LLM.
 */
export function dehydrateScreen(
  screenName: string,
  availableScreens: string[],
  elementsText: string,
  elements: InteractiveElement[],
): DehydratedScreen;
export function dehydrateScreen(snapshot: ScreenSnapshot): DehydratedScreen;
export function dehydrateScreen(
  screenOrSnapshot: string | ScreenSnapshot,
  availableScreens?: string[],
  elementsText?: string,
  elements?: InteractiveElement[],
): DehydratedScreen {
  const screenName =
    typeof screenOrSnapshot === 'string'
      ? screenOrSnapshot
      : screenOrSnapshot.screenName;
  const resolvedAvailableScreens =
    typeof screenOrSnapshot === 'string'
      ? (availableScreens || [])
      : screenOrSnapshot.availableScreens;
  const resolvedElementsText =
    typeof screenOrSnapshot === 'string'
      ? (elementsText || '')
      : screenOrSnapshot.elementsText;
  const resolvedElements =
    typeof screenOrSnapshot === 'string'
      ? (elements || [])
      : screenOrSnapshot.elements;
  const lines: string[] = [];

  // Header
  lines.push(`Screen: ${screenName} | Available screens: ${resolvedAvailableScreens.join(', ')}`);
  lines.push('');

  if (!resolvedElementsText || resolvedElementsText.trim().length === 0) {
    if (resolvedElements.length === 0) {
      lines.push('No interactive elements or visible text detected on this screen.');
    } else {
      lines.push('Interactive elements:');
      lines.push(resolvedElementsText);
    }
  } else {
    lines.push('Screen Layout & Elements:');
    lines.push(resolvedElementsText);
  }

  const finalElementsText = lines.join('\n');

  return {
    screenName,
    availableScreens: resolvedAvailableScreens,
    elementsText: finalElementsText,
    elements: resolvedElements,
  };
}

/**
 * ScreenDehydrator tests.
 *
 * Covers: basic dehydration, empty elements, available screens header.
 */

import { dehydrateScreen } from '../../core/ScreenDehydrator';
import type { InteractiveElement } from '../../core/types';

describe('ScreenDehydrator', () => {
  it('dehydrates a screen with elements and available screens', () => {
    const elements: InteractiveElement[] = [
      { index: 0, type: 'pressable' as const, label: 'Pizzas', fiberNode: {}, props: {} },
      { index: 1, type: 'pressable' as const, label: 'Burgers', fiberNode: {}, props: {} },
    ];
    const elementsText = '[0]<pressable>Pizzas />\n[1]<pressable>Burgers />\n';

    const result = dehydrateScreen('Home', ['Home', 'Menu', 'Cart'], elementsText, elements);

    expect(result.screenName).toBe('Home');
    expect(result.availableScreens).toEqual(['Home', 'Menu', 'Cart']);
    expect(result.elementsText).toContain('Screen: Home | Available screens: Home, Menu, Cart');
    expect(result.elementsText).toContain('Screen Layout & Elements:');
    expect(result.elementsText).toContain('Pizzas');
    expect(result.elementsText).toContain('Burgers');
    expect(result.elements).toEqual(elements);
  });

  it('shows "No interactive elements" when no elements detected', () => {
    const result = dehydrateScreen('Settings', ['Home', 'Settings'], '', []);

    expect(result.elementsText).toContain('No interactive elements or visible text detected');
    expect(result.elements).toEqual([]);
  });

  it('includes all available screens in the header', () => {
    const result = dehydrateScreen('Home', ['Home', 'Menu', 'Cart', 'Profile'], 'some content', []);

    expect(result.elementsText).toContain('Home, Menu, Cart, Profile');
  });
});

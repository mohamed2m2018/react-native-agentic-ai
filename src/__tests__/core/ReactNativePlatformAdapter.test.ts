import { NativeModules } from 'react-native';
import { ReactNativePlatformAdapter } from '../../core/ReactNativePlatformAdapter';
import { globalBlockRegistry } from '../../core/BlockRegistry';
import { globalZoneRegistry } from '../../core/ZoneRegistry';
import type { InteractiveElement } from '../../core/types';

jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn(),
  findScrollableContainers: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('base64-screenshot'),
}));

import { walkFiberTree } from '../../core/FiberTreeWalker';
import { captureRef } from 'react-native-view-shot';

const mockWalkFiberTree = walkFiberTree as jest.MockedFunction<
  typeof walkFiberTree
>;
const mockCaptureRef = captureRef as jest.MockedFunction<typeof captureRef>;

function createElement(
  index: number,
  label: string,
  overrides: Partial<InteractiveElement> = {}
): InteractiveElement {
  return {
    index,
    type: 'pressable',
    label,
    fiberNode: {},
    analyticsLabel: label,
    analyticsElementKind: 'button',
    analyticsLabelConfidence: 'high',
    analyticsAncestorPath: ['ProductActions'],
    analyticsComponentName: 'BuyButton',
    ...overrides,
    props: {
      ...(overrides.props || {}),
    },
  };
}

function mockWalk(elements: InteractiveElement[], elementsText?: string) {
  mockWalkFiberTree.mockReturnValueOnce({
    elementsText:
      elementsText ||
      elements
        .map(
          (element) => `[${element.index}]<${element.type}>${element.label} />`
        )
        .join('\n'),
    interactives: elements,
  });
}

function createAdapter() {
  return new ReactNativePlatformAdapter({
    getRootRef: () => ({ child: null }),
    getWalkConfig: () => ({ screenName: 'Product' }),
    getCurrentScreenName: () => 'Product',
  });
}

async function resolveTimedAction(promise: Promise<string>, ms = 2000) {
  await jest.advanceTimersByTimeAsync(ms);
  return promise;
}

function FactCard() {
  return null;
}

describe('ReactNativePlatformAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalBlockRegistry.clear();
    globalZoneRegistry.unregister('test-zone');
  });

  it('skips screenshot capture when RNViewShot native module is unavailable', async () => {
    const previousViewShot = (NativeModules as any).RNViewShot;
    delete (NativeModules as any).RNViewShot;

    const adapter = new ReactNativePlatformAdapter({
      getRootRef: () => ({ child: null }),
      getWalkConfig: () => ({ screenName: 'Home' }),
      getCurrentScreenName: () => 'Home',
    });

    await expect(adapter.captureScreenshot()).resolves.toBeUndefined();
    expect(mockCaptureRef).not.toHaveBeenCalled();

    if (previousViewShot) {
      (NativeModules as any).RNViewShot = previousViewShot;
    }
  });

  it('maps Fiber output into a normalized screen snapshot', () => {
    mockWalkFiberTree.mockReturnValue({
      elementsText: '[0]<pressable>Checkout />\n',
      interactives: [
        {
          index: 0,
          type: 'pressable' as const,
          label: 'Checkout',
          fiberNode: {},
          props: {},
        },
      ],
    });

    const adapter = new ReactNativePlatformAdapter({
      getRootRef: () => ({ child: null }),
      getWalkConfig: () => ({ screenName: 'Cart' }),
      navRef: {
        isReady: () => true,
        getRootState: () => ({
          routeNames: ['Home', 'Cart'],
          routes: [{ name: 'Cart' }],
          index: 0,
        }),
        getState: () => ({
          routeNames: ['Home', 'Cart'],
          routes: [{ name: 'Cart' }],
          index: 0,
        }),
        getCurrentRoute: () => ({ name: 'Cart' }),
      },
      getCurrentScreenName: () => 'Cart',
    });

    const snapshot = adapter.getScreenSnapshot();

    expect(snapshot.screenName).toBe('Cart');
    expect(snapshot.availableScreens).toEqual(['Home', 'Cart']);
    expect(snapshot.elementsText).toContain('Checkout');
    expect(snapshot.elements).toHaveLength(1);
  });

  it('renders registered blocks into existing zone controllers through adapter actions', async () => {
    const renderBlock = jest.fn();

    globalBlockRegistry.register({
      name: 'FactCard',
      component: FactCard,
      allowedPlacements: ['chat', 'zone'],
      interventionEligible: true,
      interventionType: 'contextual_help',
    });

    globalZoneRegistry.register(
      {
        id: 'test-zone',
        allowInjectBlock: true,
        interventionEligible: true,
        blocks: [
          {
            name: 'FactCard',
            component: FactCard,
            allowedPlacements: ['chat', 'zone'],
            interventionEligible: true,
            interventionType: 'contextual_help',
          },
        ],
      },
      { current: null } as any
    );

    const zone = globalZoneRegistry.get('test-zone') as any;
    zone._controller = { renderBlock };

    const adapter = new ReactNativePlatformAdapter({
      getRootRef: () => ({ child: null }),
      getWalkConfig: () => ({ screenName: 'Checkout' }),
      getCurrentScreenName: () => 'Checkout',
    });

    const result = await adapter.executeAction({
      type: 'render_block',
      zoneId: 'test-zone',
      blockType: 'FactCard',
      props: JSON.stringify({ title: 'Delivery', body: 'Arrives in 25 min' }),
      lifecycle: 'persistent',
    });

    expect(result).toContain('✅');
    expect(renderBlock).toHaveBeenCalledTimes(1);
    expect(renderBlock.mock.calls[0][1]).toBe('persistent');
  });

  describe('stale snapshot guard', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('preserves direct index execution when no previous snapshot exists', async () => {
      const onPress = jest.fn();
      const current = createElement(0, 'Checkout', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([current]);
      mockWalk([current]);

      const resultPromise = adapter.executeAction({ type: 'tap', index: 0 });
      const result = await resolveTimedAction(resultPromise);

      expect(result).toContain('✅ Tapped [0] "Checkout"');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('executes when the same index still matches the observed target', async () => {
      const onPress = jest.fn();
      const observed = createElement(3, 'Buy now', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const current = createElement(3, 'Buy now', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      mockWalk([current]);
      mockWalk([current]);

      const resultPromise = adapter.executeAction({ type: 'tap', index: 3 });
      const result = await resolveTimedAction(resultPromise);

      expect(result).toContain('✅ Tapped [3] "Buy now"');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('blocks a dangerous same-index semantic mismatch', async () => {
      const buyPress = jest.fn();
      const deletePress = jest.fn();
      const observed = createElement(3, 'Buy now', {
        props: { onPress: buyPress, accessibilityRole: 'button' },
      });
      const current = createElement(3, 'Delete account', {
        props: { onPress: deletePress, accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      mockWalk([current]);

      const result = await adapter.executeAction({ type: 'tap', index: 3 });

      expect(result).toContain('STALE_TARGET');
      expect(buyPress).not.toHaveBeenCalled();
      expect(deletePress).not.toHaveBeenCalled();
    });

    it('relocates when the observed target moves to a new index after an inserted element', async () => {
      const onPress = jest.fn();
      const observed = createElement(3, 'Buy now', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const inserted = createElement(3, 'Product photo', {
        props: { onPress: jest.fn(), accessibilityRole: 'button' },
      });
      const relocated = createElement(4, 'Buy now', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      mockWalk([inserted, relocated]);
      mockWalk([inserted, relocated]);

      const resultPromise = adapter.executeAction({ type: 'tap', index: 3 });
      const result = await resolveTimedAction(resultPromise);

      expect(result).toContain('✅ Tapped [4] "Buy now"');
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(inserted.props.onPress).not.toHaveBeenCalled();
    });

    it('blocks relocation when the fresh screen has multiple matching targets', async () => {
      const observed = createElement(3, 'Buy now', {
        props: { onPress: jest.fn(), accessibilityRole: 'button' },
      });
      const firstMatch = createElement(4, 'Buy now', {
        props: { onPress: jest.fn(), accessibilityRole: 'button' },
      });
      const secondMatch = createElement(5, 'Buy now', {
        props: { onPress: jest.fn(), accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      mockWalk([firstMatch, secondMatch]);

      const result = await adapter.executeAction({ type: 'tap', index: 3 });

      expect(result).toContain('STALE_TARGET');
      expect(firstMatch.props.onPress).not.toHaveBeenCalled();
      expect(secondMatch.props.onPress).not.toHaveBeenCalled();
    });

    it('blocks execution when the screen changes between observe and act', async () => {
      let screenName = 'Product';
      const onPress = jest.fn();
      const observed = createElement(3, 'Save', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const current = createElement(3, 'Save', {
        props: { onPress, accessibilityRole: 'button' },
      });
      const adapter = new ReactNativePlatformAdapter({
        getRootRef: () => ({ child: null }),
        getWalkConfig: () => ({ screenName }),
        getCurrentScreenName: () => screenName,
      });

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      screenName = 'Settings';
      mockWalk([current]);

      const result = await adapter.executeAction({ type: 'tap', index: 3 });

      expect(result).toContain('STALE_TARGET');
      expect(result).toContain('Product');
      expect(result).toContain('Settings');
      expect(onPress).not.toHaveBeenCalled();
    });

    it('relocates without developer ids using label, role, zone, and component context', async () => {
      const onPress = jest.fn();
      const observed = createElement(2, 'Apply coupon', {
        zoneId: 'checkout-actions',
        analyticsZoneId: 'checkout-actions',
        analyticsAncestorPath: ['CheckoutActions'],
        analyticsComponentName: 'CouponButton',
        props: { onPress, accessibilityRole: 'button' },
      });
      const current = createElement(6, 'Apply coupon', {
        zoneId: 'checkout-actions',
        analyticsZoneId: 'checkout-actions',
        analyticsAncestorPath: ['CheckoutActions'],
        analyticsComponentName: 'CouponButton',
        props: { onPress, accessibilityRole: 'button' },
      });
      const adapter = createAdapter();

      mockWalk([observed]);
      adapter.getScreenSnapshot();
      mockWalk([current]);
      mockWalk([current]);

      const resultPromise = adapter.executeAction({ type: 'tap', index: 2 });
      const result = await resolveTimedAction(resultPromise);

      expect(result).toContain('✅ Tapped [6] "Apply coupon"');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('guards all index-based element actions before delegating to handlers', async () => {
      const longPress = jest.fn();
      const changeText = jest.fn();
      const sliderChange = jest.fn();
      const pickerChange = jest.fn();
      const dateChange = jest.fn();

      const cases: Array<{
        observed: InteractiveElement;
        current: InteractiveElement;
        intent: Parameters<ReactNativePlatformAdapter['executeAction']>[0];
        handler: jest.Mock;
        expected: string;
        timerMs?: number;
      }> = [
        {
          observed: createElement(1, 'More options', {
            props: { onLongPress: longPress },
          }),
          current: createElement(1, 'More options', {
            props: { onLongPress: longPress },
          }),
          intent: { type: 'long_press', index: 1 },
          handler: longPress,
          expected: 'Long-pressed',
        },
        {
          observed: createElement(2, 'Email', {
            type: 'text-input',
            props: { onChangeText: changeText },
          }),
          current: createElement(2, 'Email', {
            type: 'text-input',
            props: { onChangeText: changeText },
          }),
          intent: { type: 'type', index: 2, text: 'hello@example.com' },
          handler: changeText,
          expected: 'Typed',
          timerMs: 600,
        },
        {
          observed: createElement(3, 'Volume', {
            type: 'slider',
            props: { onValueChange: sliderChange },
          }),
          current: createElement(3, 'Volume', {
            type: 'slider',
            props: { onValueChange: sliderChange },
          }),
          intent: { type: 'adjust_slider', index: 3, value: 0.5 },
          handler: sliderChange,
          expected: 'Adjusted slider',
        },
        {
          observed: createElement(4, 'Size', {
            type: 'picker',
            props: { onValueChange: pickerChange, options: ['M'] },
          }),
          current: createElement(4, 'Size', {
            type: 'picker',
            props: { onValueChange: pickerChange, options: ['M'] },
          }),
          intent: { type: 'select_picker', index: 4, value: 'M' },
          handler: pickerChange,
          expected: 'Selected "M"',
        },
        {
          observed: createElement(5, 'Delivery date', {
            type: 'date-picker',
            props: { onChange: dateChange },
          }),
          current: createElement(5, 'Delivery date', {
            type: 'date-picker',
            props: { onChange: dateChange },
          }),
          intent: { type: 'set_date', index: 5, date: '2026-05-03' },
          handler: dateChange,
          expected: 'Set date picker',
        },
      ];

      for (const testCase of cases) {
        const adapter = createAdapter();
        mockWalk([testCase.observed]);
        adapter.getScreenSnapshot();
        mockWalk([testCase.current]);

        const resultPromise = adapter.executeAction(testCase.intent);
        const result = await resolveTimedAction(
          resultPromise,
          testCase.timerMs || 1000
        );

        expect(result).toContain(testCase.expected);
        expect(testCase.handler).toHaveBeenCalled();
      }
    });
  });
});

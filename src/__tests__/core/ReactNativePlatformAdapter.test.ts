import React from 'react';
import { ReactNativePlatformAdapter } from '../../core/ReactNativePlatformAdapter';
import { globalBlockRegistry } from '../../core/BlockRegistry';
import { globalZoneRegistry } from '../../core/ZoneRegistry';

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

import { walkFiberTree } from '../../core/FiberTreeWalker';

const mockWalkFiberTree = walkFiberTree as jest.MockedFunction<typeof walkFiberTree>;

function FactCard() {
  return null;
}

describe('ReactNativePlatformAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalBlockRegistry.clear();
    globalZoneRegistry.unregister('test-zone');
  });

  it('maps Fiber output into a normalized screen snapshot', () => {
    mockWalkFiberTree.mockReturnValue({
      elementsText: '[0]<pressable>Checkout />\n',
      interactives: [
        { index: 0, type: 'pressable' as const, label: 'Checkout', fiberNode: {}, props: {} },
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
      { current: null } as any,
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
});

/**
 * AIZone + Card Injection Integration (E2E) Test
 *
 * This test exercises the full chain that spans multiple systems:
 *   1. ZoneRegistry receives zone on mount (SDK core)
 *   2. _controller is attached and usable (SDK tools integration)
 *   3. AI simplification changes context broadcast to children
 *   4. Card injection + user dismiss completes the interaction loop
 *   5. restore() fully reverts all AI modifications
 *
 * This is "E2E" in the sense that it tests the real component pipeline
 * with no mocked state — only the ZoneRegistryContext is provided inline.
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/e2e/AIZone.e2e.test.tsx
 */

import React, { useContext } from 'react';
import { Text } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';

// Use the real ZoneRegistry — no mocking in E2E
import { ZoneRegistry, ZoneRegistryContext } from '../../core/ZoneRegistry';
import { AIZone, AIZoneStateContext } from '../../components/AIZone';
import { InfoCard } from '../../components/cards/InfoCard';
import { ReviewSummary } from '../../components/cards/ReviewSummary';

jest.setTimeout(30_000);

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/**
 * Simulates the injectCardTool security lookup:
 *   - Resolves template by displayName
 *   - Strips function-valued props
 *   - Returns createElement result
 */
function simulateInjectCard(
  registry: ZoneRegistry,
  zoneId: string,
  templateName: string,
  props: Record<string, unknown>
): void {
  const zone = (registry as unknown as { zones: Map<string, { templates?: React.ComponentType<Record<string, unknown>>[] }> })
    .zones.get(zoneId);

  if (!zone?.templates) throw new Error(`Zone "${zoneId}" has no templates`);

  const Template = zone.templates.find((T) => T.displayName === templateName);
  if (!Template) throw new Error(`Template "${templateName}" not registered in zone "${zoneId}"`);

  // Sanitize: strip function values (XSS / code injection defense)
  const sanitizedProps = Object.fromEntries(
    Object.entries(props).filter(([, v]) => typeof v !== 'function')
  );

  const card = React.createElement(Template, sanitizedProps);

  // Inject via _controller
  const zoneEntry = (registry as unknown as { zones: Map<string, { _controller?: { injectCard: (el: React.ReactElement) => void } }> })
    .zones.get(zoneId);
  zoneEntry?._controller?.injectCard(card);
}

// ─── Shared test app ──────────────────────────────────────────────────────────

function TestApp({ registry }: { registry: ZoneRegistry }) {
  return (
    <ZoneRegistryContext.Provider value={registry}>
      <AIZone
        id="product-detail"
        allowHighlight
        allowSimplify
        allowInjectCard
        templates={[InfoCard as React.ComponentType<Record<string, unknown>>, ReviewSummary as React.ComponentType<Record<string, unknown>>]}
      >
        <Text testID="primary-content">Primary product info</Text>
        <Text testID="secondary-content">Advanced options</Text>
      </AIZone>
    </ZoneRegistryContext.Provider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIZone + Card Injection — Integration E2E', () => {
  let registry: ZoneRegistry;

  beforeEach(() => {
    registry = new ZoneRegistry();
  });

  // ── 1. Registry integration ────────────────────────────────────

  it('registers zone with all declared permissions', () => {
    render(<TestApp registry={registry} />);

    const zone = registry.get('product-detail');
    expect(zone).toBeDefined();
    expect(zone?.allowHighlight).toBe(true);
    expect(zone?.allowSimplify).toBe(true);
    expect(zone?.allowInjectCard).toBe(true);
    expect(zone?.templates).toHaveLength(2);
  });

  it('correctly identifies allowed actions via isActionAllowed()', () => {
    render(<TestApp registry={registry} />);

    expect(registry.isActionAllowed('product-detail', 'highlight')).toBe(true);
    expect(registry.isActionAllowed('product-detail', 'simplify')).toBe(true);
    expect(registry.isActionAllowed('product-detail', 'card')).toBe(true);
    // hint was not declared
    expect(registry.isActionAllowed('product-detail', 'hint')).toBe(false);
  });

  // ── 2. Simplification lifecycle ────────────────────────────────

  it('broadcasts simplified=true to children when simplified via _controller', () => {
    let capturedSimplified = false;

    function ContextReader() {
      const { simplified } = useContext(AIZoneStateContext);
      capturedSimplified = simplified;
      return null;
    }

    render(
      <ZoneRegistryContext.Provider value={registry}>
        <AIZone id="product-detail" allowSimplify templates={[]}>
          <ContextReader />
        </AIZone>
      </ZoneRegistryContext.Provider>
    );

    act(() => {
      const zone = (registry as unknown as { zones: Map<string, { _controller?: { simplify: () => void } }> })
        .zones.get('product-detail');
      zone?._controller?.simplify();
    });

    expect(capturedSimplified).toBe(true);
  });

  it('user tapping "Show all" restores unsimplified state', () => {
    const { getByText, queryByText } = render(<TestApp registry={registry} />);

    act(() => {
      const zone = (registry as unknown as { zones: Map<string, { _controller?: { simplify: () => void } }> })
        .zones.get('product-detail');
      zone?._controller?.simplify();
    });

    expect(getByText('Show all options')).toBeTruthy();
    fireEvent.press(getByText('Show all options'));
    expect(queryByText('Show all options')).toBeNull();
  });

  // ── 3. Card injection security ─────────────────────────────────

  it('injects InfoCard by displayName lookup and renders its content', () => {
    const { getByText } = render(<TestApp registry={registry} />);

    act(() => {
      simulateInjectCard(registry, 'product-detail', 'InfoCard', {
        title: 'Free Delivery',
        body: 'Orders over $20 get free delivery.',
        icon: '🚚',
      });
    });

    expect(getByText('Free Delivery')).toBeTruthy();
    expect(getByText('Orders over $20 get free delivery.')).toBeTruthy();
  });

  it('injects ReviewSummary by displayName lookup and renders stars', () => {
    const { getByText } = render(<TestApp registry={registry} />);

    act(() => {
      simulateInjectCard(registry, 'product-detail', 'ReviewSummary', {
        rating: 4,
        reviewCount: 250,
        headline: 'AI Review Summary',
      });
    });

    expect(getByText('AI Review Summary')).toBeTruthy();
    expect(getByText('★★★★☆')).toBeTruthy();
  });

  it('strips function props from inject payload (XSS defense)', () => {
    const { getByText } = render(<TestApp registry={registry} />);

    act(() => {
      // onPress is a function — it should be stripped before render
      simulateInjectCard(registry, 'product-detail', 'InfoCard', {
        title: 'Safe Card',
        onPress: () => { throw new Error('XSS!'); }, // should be stripped
      });
    });

    // Card renders without crashing — function prop was stripped
    expect(getByText('Safe Card')).toBeTruthy();
  });

  it('throws when template name is not registered in the zone', () => {
    render(<TestApp registry={registry} />);

    expect(() => {
      act(() => {
        simulateInjectCard(registry, 'product-detail', 'MaliciousTemplate', {});
      });
    }).toThrow('Template "MaliciousTemplate" not registered');
  });

  // ── 4. User dismissal ──────────────────────────────────────────

  it('user tapping × removes the injected card', () => {
    const { getByText, queryByText } = render(<TestApp registry={registry} />);

    act(() => {
      simulateInjectCard(registry, 'product-detail', 'InfoCard', {
        title: 'Dismissible Card',
      });
    });

    expect(getByText('Dismissible Card')).toBeTruthy();
    fireEvent.press(getByText('×'));
    expect(queryByText('Dismissible Card')).toBeNull();
  });

  // ── 5. Full restore ────────────────────────────────────────────

  it('restore() reverts both simplification and card injection', () => {
    const { queryByText } = render(<TestApp registry={registry} />);

    act(() => {
      const zone = (registry as unknown as { zones: Map<string, { _controller?: { simplify: () => void; injectCard: (el: React.ReactElement) => void; restore: () => void } }> })
        .zones.get('product-detail');
      zone?._controller?.simplify();
      zone?._controller?.injectCard(React.createElement(Text, null, 'Some Card'));
      zone?._controller?.restore();
    });

    expect(queryByText('Show all options')).toBeNull();
    expect(queryByText('Some Card')).toBeNull();
  });

  // ── 6. Unregister on unmount ────────────────────────────────────

  it('unregisters zone when component unmounts', () => {
    const { unmount } = render(<TestApp registry={registry} />);

    expect(registry.get('product-detail')).toBeDefined();
    unmount();
    expect(registry.get('product-detail')).toBeUndefined();
  });
});

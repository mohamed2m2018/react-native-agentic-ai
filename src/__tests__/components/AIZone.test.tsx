/**
 * AIZone unit tests
 *
 * Covers: zone registration on mount, unregistration on unmount,
 * simplification state + "Show all" button, card injection + dismiss,
 * and the _controller attachment to the registry.
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/components/AIZone.test.tsx
 */

import React, { useContext } from 'react';
import { Text } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRegister = jest.fn();
const mockUnregister = jest.fn();
const mockGet = jest.fn();

jest.mock('../../core/ZoneRegistry', () => {
  const React = require('react');
  const registry = {
    register: (...args: unknown[]) => mockRegister(...args),
    unregister: (...args: unknown[]) => mockUnregister(...args),
    get: (...args: unknown[]) => mockGet(...args),
    getAll: () => [],
    isActionAllowed: () => true,
  };
  return {
    ZoneRegistryContext: React.createContext(registry),
    ZoneRegistry: jest.fn(() => registry),
  };
});

import { AIZone, AIZoneStateContext } from '../../components/AIZone';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderZone(props: Partial<React.ComponentProps<typeof AIZone>> = {}) {
  return render(
    <AIZone id="test-zone" {...props}>
      <Text>Child content</Text>
    </AIZone>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIZone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue({}); // default: zone exists in registry
  });

  // ── Registration lifecycle ─────────────────────────────────────

  describe('registration lifecycle', () => {
    it('registers zone on mount with correct id and permissions', () => {
      renderZone({ allowHighlight: true, allowSimplify: true });

      expect(mockRegister).toHaveBeenCalledTimes(1);
      const [config] = mockRegister.mock.calls[0];
      expect(config.id).toBe('test-zone');
      expect(config.allowHighlight).toBe(true);
      expect(config.allowSimplify).toBe(true);
    });

    it('unregisters zone on unmount', () => {
      const { unmount } = renderZone();
      unmount();

      expect(mockUnregister).toHaveBeenCalledWith('test-zone');
    });

    it('attaches _controller to registry on mount', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      renderZone({ allowSimplify: true });

      expect(fakeZone._controller).toBeDefined();
      const ctrl = fakeZone._controller as {
        simplify: () => void;
        restore: () => void;
        injectCard: (el: React.ReactElement) => void;
      };
      expect(typeof ctrl.simplify).toBe('function');
      expect(typeof ctrl.restore).toBe('function');
      expect(typeof ctrl.injectCard).toBe('function');
    });
  });

  // ── Children render ────────────────────────────────────────────

  describe('children rendering', () => {
    it('renders children without modification', () => {
      const { getByText } = renderZone();
      expect(getByText('Child content')).toBeTruthy();
    });

    it('does not render "Show all" button when not simplified', () => {
      const { queryByText } = renderZone({ allowSimplify: true });
      expect(queryByText('Show all options')).toBeNull();
    });
  });

  // ── Simplification ─────────────────────────────────────────────

  describe('simplification via _controller', () => {
    it('shows "Show all" button when simplified via _controller.simplify()', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      const { getByText } = renderZone({ allowSimplify: true });

      // Simulate AI tool calling simplify
      act(() => {
        (fakeZone._controller as { simplify: () => void }).simplify();
      });

      expect(getByText('Show all options')).toBeTruthy();
    });

    it('hides "Show all" button after user taps it', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      const { getByText, queryByText } = renderZone({ allowSimplify: true });

      act(() => {
        (fakeZone._controller as { simplify: () => void }).simplify();
      });

      fireEvent.press(getByText('Show all options'));

      expect(queryByText('Show all options')).toBeNull();
    });

    it('broadcasts simplified=true via AIZoneStateContext', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      let capturedSimplified = false;

      function Consumer() {
        const { simplified } = useContext(AIZoneStateContext);
        capturedSimplified = simplified;
        return null;
      }

      render(
        <AIZone id="test-zone" allowSimplify>
          <Consumer />
        </AIZone>
      );

      act(() => {
        (fakeZone._controller as { simplify: () => void }).simplify();
      });

      expect(capturedSimplified).toBe(true);
    });
  });

  // ── Card injection ─────────────────────────────────────────────

  describe('card injection via _controller', () => {
    it('renders injected card and dismiss button', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      const { getByText } = renderZone({ allowInjectCard: true });

      act(() => {
        const ctrl = fakeZone._controller as { injectCard: (el: React.ReactElement) => void };
        ctrl.injectCard(<Text>Injected Card Content</Text>);
      });

      expect(getByText('Injected Card Content')).toBeTruthy();
      expect(getByText('×')).toBeTruthy(); // dismiss ×
    });

    it('removes injected card when × is tapped', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      const { getByText, queryByText } = renderZone({ allowInjectCard: true });

      act(() => {
        const ctrl = fakeZone._controller as { injectCard: (el: React.ReactElement) => void };
        ctrl.injectCard(<Text>Card to dismiss</Text>);
      });

      fireEvent.press(getByText('×'));

      expect(queryByText('Card to dismiss')).toBeNull();
    });

    it('restore() removes injected card and restores simplified state', () => {
      const fakeZone: Record<string, unknown> = {};
      mockGet.mockReturnValue(fakeZone);

      const { getByText, queryByText } = renderZone({ allowSimplify: true, allowInjectCard: true });

      act(() => {
        const ctrl = fakeZone._controller as {
          simplify: () => void;
          injectCard: (el: React.ReactElement) => void;
          restore: () => void;
        };
        ctrl.simplify();
        ctrl.injectCard(<Text>Some card</Text>);
        ctrl.restore();
      });

      expect(queryByText('Show all options')).toBeNull();
      expect(queryByText('Some card')).toBeNull();
    });
  });
});

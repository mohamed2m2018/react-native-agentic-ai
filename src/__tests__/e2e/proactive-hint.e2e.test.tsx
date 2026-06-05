/**
 * ProactiveHint & IdleDetector E2E Test
 *
 * Verifies that the AI Agent correctly detects user hesitation (via mocked timers)
 * and renders the pulsing and badger UI sequence. Also verifies user dismissal.
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/e2e/proactive-hint.e2e.test.tsx
 */

import React from 'react';
import { Text } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { AIAgent } from '../../components/AIAgent';

// We just mock the telemetry module so the Agent mounts quietly
jest.mock('../../services/telemetry', () => {
  return {
    TelemetryService: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      track: jest.fn(),
      setScreen: jest.fn(),
      setAgentActing: jest.fn(),
    })),
    bindTelemetryService: jest.fn(),
  };
});

// Mock VoiceService to bypass @google/genai ESM import errors since Voice is unrelated here
jest.mock('../../services/VoiceService', () => {
  return {
    VoiceService: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
});

describe('ProactiveHint E2E', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Helpers ──

  function renderAgent(overrides?: any) {
    return render(
      <AIAgent
        apiKey="test_key"
        proactiveHelp={{
          enabled: true,
          pulseAfterMinutes: 1, // 60s
          badgeAfterMinutes: 2, // 120s
          badgeText: 'Are you stuck?',
          ...overrides,
        }}
      >
        <Text testID="app-content">App Content</Text>
      </AIAgent>
    );
  }

  // ── Tests ──

  it('renders children correctly and hides proactive UI initially', () => {
    const { getByTestId, queryByText } = renderAgent();

    expect(getByTestId('app-content')).toBeTruthy();
    // Badge shouldn't be there at 0ms
    expect(queryByText('Are you stuck?')).toBeNull();
  });

  it('shows badge after pulse and badge timers elapse', () => {
    const { getByText, queryByText } = renderAgent();

    // Advance 60s -> pulse (no text yet, just animation node rendering under the hood)
    act(() => {
      jest.advanceTimersByTime(61_000);
    });
    expect(queryByText('Are you stuck?')).toBeNull();

    // Advance another 60s -> badge appears
    act(() => {
      jest.advanceTimersByTime(60_000); // 121s total
    });

    // Badge text should now be fully rendered and visible
    expect(getByText('Are you stuck?')).toBeTruthy();
    expect(getByText('×')).toBeTruthy(); // close button
  });

  it('user dismissing the badge permanently removes it', () => {
    const { getByText, queryByText } = renderAgent();

    // Trigger the badge
    act(() => {
      jest.advanceTimersByTime(125_000); // push past both timers
    });

    expect(getByText('Are you stuck?')).toBeTruthy();

    // User taps the "x"
    act(() => {
      fireEvent.press(getByText('×'));
    });

    // Badge disappears instantly
    expect(queryByText('Are you stuck?')).toBeNull();

    // Wait another hour -- it should not come back because the instance is `dismissed`
    act(() => {
      jest.advanceTimersByTime(3600_000);
    });
    expect(queryByText('Are you stuck?')).toBeNull();
  });

  it('does not start timers if proactiveHelp.enabled is false', () => {
    const { queryByText } = renderAgent({ enabled: false });

    // Advance 3 minutes
    act(() => {
      jest.advanceTimersByTime(180_000);
    });

    // Badge never shows up
    expect(queryByText('Are you stuck?')).toBeNull();
  });
});

/**
 * Edge Cases & Stress Tests
 *
 * Tests library behavior under boundary conditions.
 * Uses ScriptedProvider for deterministic behavior tests (budgets, concurrency).
 * Uses real LLM for stress tests (100+ elements, large screens).
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  requireApiKey, renderToFiber, createScriptedRuntime,
  createLiveRuntime, executeGoalLive,
  makeTap, makeDone, makeType, makeExpensiveCall,
} from './e2e-helpers';
import { walkFiberTree } from '../../core/FiberTreeWalker';
import { StressScreen, CartScreen, SettingsScreen } from './test-app/screens';
import { ZButton, ZText, DishCard } from './test-app/components';

jest.setTimeout(120_000);

describe('Edge Cases — Scripted (deterministic)', () => {

  // ─── Null root ref ────────────────────────────────────────────

  it('handles null fiber gracefully', () => {
    const result = walkFiberTree(null);
    expect(result.interactives).toHaveLength(0);
    expect(result.elementsText).toBeDefined();
  });

  // ─── Empty screen ─────────────────────────────────────────────

  it('handles a screen with no interactive elements', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Text, null, 'Welcome to FeedYum'),
        React.createElement(Text, null, 'No buttons here'),
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    expect(result.interactives).toHaveLength(0);
    expect(result.elementsText).toContain('Welcome to FeedYum');
  });

  // ─── Concurrent execution rejection ───────────────────────────

  it('rejects concurrent execute() calls', async () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Pressable, { onPress: jest.fn() },
          React.createElement(Text, null, 'Button')
        )
      )
    );

    // Use a slow scripted provider that creates a delay
    const { runtime } = createScriptedRuntime({
      fiber,
      responses: [
        makeTap(0), makeTap(0), makeTap(0), makeDone('done'),
      ],
      config: { maxSteps: 5, stepDelay: 200 },
    });

    // Start first execution
    const exec1 = runtime.execute('Do something');
    // Immediately try second
    const exec2 = runtime.execute('Do something else');

    const [r1, r2] = await Promise.all([exec1, exec2]);
    unmount();

    // One should succeed, one should fail with "already running"
    const results = [r1, r2];
    const failedResult = results.find(r => r.message.includes('already running'));
    expect(failedResult).toBeDefined();
  });

  // ─── Max steps exhausted ──────────────────────────────────────

  it('stops after maxSteps and returns failure', async () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Pressable, { onPress: jest.fn() },
          React.createElement(Text, null, 'Button')
        )
      )
    );

    const { runtime } = createScriptedRuntime({
      fiber,
      // Never calls done — keeps tapping
      responses: [makeTap(0), makeTap(0), makeTap(0), makeTap(0), makeTap(0)],
      config: { maxSteps: 3 },
    });

    const result = await runtime.execute('Keep tapping');
    unmount();

    expect(result.success).toBe(false);
    expect(result.steps.length).toBeLessThanOrEqual(3);
  });

  // ─── Token budget exceeded ────────────────────────────────────

  it('stops when token budget is exceeded', async () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Pressable, { onPress: jest.fn() },
          React.createElement(Text, null, 'Button')
        )
      )
    );

    const { runtime } = createScriptedRuntime({
      fiber,
      responses: [
        makeExpensiveCall('tap', { index: 0 }, 10000, 0.05),
        makeExpensiveCall('tap', { index: 0 }, 10000, 0.05),
        makeDone('done'),
      ],
      config: { maxSteps: 10, maxTokenBudget: 5000 },
    });

    const result = await runtime.execute('Do something');
    unmount();

    expect(result.success).toBe(false);
    expect(result.tokenUsage).toBeDefined();
    expect(result.tokenUsage!.totalTokens).toBeGreaterThanOrEqual(5000);
  });

  // ─── Cost budget exceeded ─────────────────────────────────────

  it('stops when cost budget is exceeded', async () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Pressable, { onPress: jest.fn() },
          React.createElement(Text, null, 'Button')
        )
      )
    );

    const { runtime } = createScriptedRuntime({
      fiber,
      responses: [
        makeExpensiveCall('tap', { index: 0 }, 5000, 0.50),
        makeDone('done'),
      ],
      config: { maxSteps: 10, maxCostUSD: 0.10 },
    });

    const result = await runtime.execute('Do something');
    unmount();

    expect(result.success).toBe(false);
  });

  // ─── Invalid tool index ───────────────────────────────────────

  it('handles tap on out-of-range index gracefully', async () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(Pressable, { onPress: jest.fn() },
          React.createElement(Text, null, 'Only Button')
        )
      )
    );

    const { runtime } = createScriptedRuntime({
      fiber,
      responses: [
        makeTap(99), // Out of range
        makeDone('Gave up'),
      ],
      config: { maxSteps: 5 },
    });

    const result = await runtime.execute('Tap something');
    unmount();

    // Should not crash — the error is captured in step output
    expect(result).toBeDefined();
    const failStep = result.steps.find(s => s.action.output.includes('❌'));
    expect(failStep).toBeDefined();
  });
});

describe('Stress Tests — Real LLM', () => {

  beforeAll(() => {
    requireApiKey();
  });

  // ─── Large FlatList (100+ elements) ───────────────────────────

  it('handles a screen with 50 interactive elements', async () => {
    const onItemPress = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(StressScreen, { itemCount: 50, onItemPress }),
      'Tap on the first item in the list',
      { maxSteps: 8 },
    );

    unmount();

    expect(result.success).toBe(true);
    expect(onItemPress).toHaveBeenCalled();
  });

  // ─── Deeply nested text extraction ────────────────────────────

  it('LLM reads text through 5 levels of View nesting', async () => {
    const { result, unmount } = await executeGoalLive(
      React.createElement(View, null,
        React.createElement(View, null,
          React.createElement(View, null,
            React.createElement(View, null,
              React.createElement(View, null,
                React.createElement(Text, null, 'The secret code is ALPHA-7')
              )
            )
          )
        )
      ),
      'What is the secret code displayed on this screen?',
      { maxSteps: 3 },
    );

    unmount();

    expect(result.success).toBe(true);
    expect(result.message).toContain('ALPHA-7');
  });
});

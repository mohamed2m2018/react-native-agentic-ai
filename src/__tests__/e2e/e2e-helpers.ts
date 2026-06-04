/**
 * E2E Test Helpers — Real LLM integration testing for react-native-ai-agent
 *
 * Tests use REAL GeminiProvider with a REAL API key to verify the full pipeline:
 * Real RN Components → Real Fiber Tree → Real FiberTreeWalker → Real ScreenDehydrator
 * → Real LLM (Gemini) → Real AgentRuntime → Real Tool Execution → Verified Callbacks
 *
 * The API key is loaded from .env at the library root.
 */

import path from 'path';
import { config as loadEnv } from 'dotenv';
import React from 'react';
import { act, create, ReactTestRenderer as RTR } from 'react-test-renderer';
import { AgentRuntime } from '../../core/AgentRuntime';
import { GeminiProvider } from '../../providers/GeminiProvider';
import type {
  AIProvider,
  ProviderResult,
  AgentReasoning,
  ToolDefinition,
  AgentStep,
  AgentConfig,
  ExecutionResult,
  TokenUsage,
} from '../../core/types';

// Load .env from library root
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/** Skip test if no API key. Call at top of describe block. */
export function requireApiKey(): void {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY not found in .env — E2E tests require a real API key.\n' +
      'Add GEMINI_API_KEY=your_key to /react-native-ai-agent/.env'
    );
  }
}

/** Get the API key or throw. */
export function getApiKey(): string {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }
  return GEMINI_API_KEY;
}

// ─── Render to Fiber ────────────────────────────────────────────

export interface RenderResult {
  fiber: any;
  renderer: RTR;
  unmount: () => void;
}

/**
 * Renders real React Native JSX and returns the fiber root.
 * Uses react-test-renderer → React reconciler creates real fiber nodes.
 */
export function renderToFiber(element: React.ReactElement): RenderResult {
  let renderer: RTR;
  act(() => {
    renderer = create(element);
  });
  const fiber = (renderer!.root as any)._fiber;
  if (!fiber) {
    throw new Error('Could not access _fiber from renderer.root');
  }
  return {
    fiber,
    renderer: renderer!,
    unmount: () => act(() => renderer!.unmount()),
  };
}

// ─── Mock Navigation Ref ────────────────────────────────────────

export interface MockNavRefConfig {
  currentScreen?: string;
  routeNames?: string[];
}

/**
 * Simulated navigation ref for AgentRuntime.
 * Tracks navigate() calls for test assertions.
 */
export function createMockNavRef(config: MockNavRefConfig = {}) {
  const {
    currentScreen = 'Home',
    routeNames = ['Home', 'Menu', 'DishDetail', 'Cart', 'Checkout', 'Search', 'Profile', 'Settings', 'Chat', 'WriteReview'],
  } = config;

  let _currentScreen = currentScreen;
  const navigateLog: Array<{ screen: string; params?: any }> = [];

  return {
    isReady: () => true,
    getState: () => ({
      routeNames,
      routes: routeNames.map(name => ({ name })),
      index: routeNames.indexOf(_currentScreen),
    }),
    getRootState: () => ({
      routeNames,
      routes: routeNames.map(name => ({ name })),
      index: routeNames.indexOf(_currentScreen),
    }),
    navigate: (screen: string, params?: any) => {
      navigateLog.push({ screen, params });
      _currentScreen = screen;
    },
    goBack: jest.fn(),
    getCurrentRoute: () => ({ name: _currentScreen }),
    // Test inspection
    get navigateLog() { return navigateLog; },
    get currentScreen() { return _currentScreen; },
    setCurrentScreen: (name: string) => { _currentScreen = name; },
  };
}

// ─── Live Test Runtime ──────────────────────────────────────────

export interface LiveTestConfig {
  /** Fiber root from renderToFiber() */
  fiber: any;
  /** Navigation config */
  nav?: MockNavRefConfig;
  /** AgentConfig overrides */
  config?: Partial<AgentConfig>;
}

/**
 * Creates a fully wired AgentRuntime with:
 * - REAL GeminiProvider (makes actual API calls to Gemini)
 * - Real FiberTreeWalker (via fiber root)
 * - MockNavRef (simulated navigation)
 */
export function createLiveRuntime(opts: LiveTestConfig) {
  const apiKey = getApiKey();
  const provider = new GeminiProvider(apiKey, 'gemini-2.5-flash');
  const navRef = createMockNavRef(opts.nav);

  const runtime = new AgentRuntime(
    provider,
    {
      maxSteps: 10,
      stepDelay: 0,
      // Force React to flush state updates between agent steps.
      // In production, the native event loop + stepDelay handle this.
      // In test-renderer, setState from tool execution (tap/type) doesn't
      // flush without act(), so the walker re-reads stale fiber state.
      onAfterStep: async () => {
        await act(async () => {});
      },
      ...opts.config,
    },
    opts.fiber,
    navRef,
  );

  return { runtime, provider, navRef };
}

/**
 * Full convenience: render JSX → create runtime → execute goal → return result.
 * This is the main entry point for E2E tests.
 */
export async function executeGoalLive(
  element: React.ReactElement,
  goal: string,
  runtimeConfig?: Partial<AgentConfig>,
  navConfig?: MockNavRefConfig,
): Promise<{
  result: ExecutionResult;
  navRef: ReturnType<typeof createMockNavRef>;
  unmount: () => void;
}> {
  const { fiber, unmount } = renderToFiber(element);
  const { runtime, navRef } = createLiveRuntime({
    fiber,
    nav: navConfig,
    config: runtimeConfig,
  });

  const result = await runtime.execute(goal);

  return { result, navRef, unmount };
}

// ─── Scripted Provider (for deterministic edge-case tests) ──────

/**
 * Mock AI provider that returns pre-scripted responses.
 * Used only for edge-case / budget / concurrent tests where
 * the LLM decision doesn't matter — we test library behavior.
 */
export class ScriptedProvider implements AIProvider {
  private responses: ProviderResult[];
  private callIndex = 0;

  constructor(responses: ProviderResult[]) {
    this.responses = responses;
  }

  async generateContent(
    _systemPrompt: string,
    _userMessage: string,
    _tools: ToolDefinition[],
    _history: AgentStep[],
    _screenshot?: string,
  ): Promise<ProviderResult> {
    if (this.callIndex >= this.responses.length) {
      return makeDone('Scripted responses exhausted', true);
    }
    return this.responses[this.callIndex++]!;
  }
}

// ─── Response Builders (for ScriptedProvider) ───────────────────

const DEFAULT_REASONING: AgentReasoning = {
  previousGoalEval: 'Proceeding',
  memory: 'Executing step',
  plan: 'Next action',
};

export function makeToolCall(name: string, args: Record<string, any>, tokenUsage?: Partial<TokenUsage>): ProviderResult {
  return {
    toolCalls: [{ name, args }],
    reasoning: DEFAULT_REASONING,
    tokenUsage: {
      promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUSD: 0.001,
      ...tokenUsage,
    },
  };
}

export function makeDone(text: string, success = true): ProviderResult {
  return makeToolCall('done', { text, success });
}

export function makeTap(index: number): ProviderResult {
  return makeToolCall('tap', { index });
}

export function makeType(index: number, text: string): ProviderResult {
  return makeToolCall('type', { index, text });
}

export function makeExpensiveCall(name: string, args: Record<string, any>, tokens: number, cost: number): ProviderResult {
  return makeToolCall(name, args, {
    promptTokens: Math.floor(tokens * 0.7),
    completionTokens: Math.floor(tokens * 0.3),
    totalTokens: tokens,
    estimatedCostUSD: cost,
  });
}

export function createScriptedRuntime(opts: {
  fiber: any;
  responses: ProviderResult[];
  nav?: MockNavRefConfig;
  config?: Partial<AgentConfig>;
}) {
  const provider = new ScriptedProvider(opts.responses);
  const navRef = createMockNavRef(opts.nav);
  const runtime = new AgentRuntime(
    provider,
    {
      maxSteps: 25,
      stepDelay: 0,
      onAfterStep: async () => {
        await act(async () => {});
      },
      ...opts.config,
    },
    opts.fiber,
    navRef,
  );
  return { runtime, provider, navRef };
}

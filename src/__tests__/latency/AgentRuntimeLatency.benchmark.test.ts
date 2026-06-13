/**
 * Benchmark-style latency coverage for the AgentRuntime loop.
 *
 * This measures the real actionSafety runtime path with fake providers and a
 * fake guard classifier so production behavior stays unchanged.
 */

jest.mock('../../core/systemPrompt', () => ({
  buildSystemPrompt: jest.fn().mockReturnValue('Mock system prompt'),
  buildCompanionPrompt: jest.fn().mockReturnValue('Mock companion prompt'),
  buildVoiceSystemPrompt: jest.fn().mockReturnValue('Mock voice prompt'),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setEnabled: jest.fn(),
  },
}));

import { AgentRuntime } from '../../core/AgentRuntime';
import type {
  ActionIntent,
  ActionSafetyClassifier,
  ActionSafetyDecision,
  AgentConfig,
  AgentTraceEvent,
  AIProvider,
  InteractiveNode,
  PlatformAdapter,
  ProviderResult,
  ScreenSafetyInput,
  ScreenSnapshot,
  TokenUsage,
} from '../../core/types';

jest.setTimeout(45000);

type GuardScenario =
  | { kind: 'none' }
  | { kind: 'deterministic' }
  | { kind: 'cached'; screenDelayMs?: number }
  | { kind: 'fallback'; delayMs: number }
  | { kind: 'timeout'; delayMs: number; timeoutMs: number };

interface LatencyMetrics {
  scenario: string;
  totalMs: number;
  userToFirstProviderResponseMs: number;
  providerResponseToToolSelectedMs: number;
  executeToolSafelyMs: number;
  screenDehydrationMs: number;
  targetResolutionMs: number;
  guardDecisionMs: number;
  preclassificationMs: number;
  firstStepMs: number;
  guardTimedOut: boolean;
  classifyActionCalls: number;
}

const now = () => Date.now();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createToolResponse(
  actionName: string,
  args: Record<string, any> = {},
  tokenUsage?: Partial<TokenUsage>
): ProviderResult {
  return {
    toolCalls: [{ name: actionName, args }],
    reasoning: {
      previousGoalEval: 'Success',
      memory: 'latency benchmark',
      plan: `Execute ${actionName}`,
    },
    tokenUsage: {
      promptTokens: tokenUsage?.promptTokens ?? 100,
      completionTokens: tokenUsage?.completionTokens ?? 50,
      totalTokens: tokenUsage?.totalTokens ?? 150,
      estimatedCostUSD: tokenUsage?.estimatedCostUSD ?? 0.001,
    },
  };
}

function createTextResponse(text: string): ProviderResult {
  return {
    text,
    toolCalls: [],
    reasoning: {
      previousGoalEval: 'Success',
      memory: 'latency benchmark complete',
      plan: 'Finish',
    },
    tokenUsage: {
      promptTokens: 50,
      completionTokens: 10,
      totalTokens: 60,
      estimatedCostUSD: 0.0002,
    },
  };
}

class LatencyRecorder {
  readonly traceTimes: Record<string, number[]> = {};
  startMs = 0;
  endMs = 0;
  firstProviderResponseMs = 0;
  screenDehydrationMs = 0;
  targetResolutionMs = 0;
  guardDecisionMs = 0;
  preclassificationMs = 0;
  guardTimedOut = false;
  classifyActionCalls = 0;

  markTrace(event: AgentTraceEvent): void {
    if (!this.traceTimes[event.stage]) {
      this.traceTimes[event.stage] = [];
    }
    this.traceTimes[event.stage]!.push(now());
    if (event.stage === 'action_safety_decision') {
      const toolStarted = this.first('tool_execution_started');
      if (toolStarted > 0 && this.guardDecisionMs === 0) {
        this.guardDecisionMs = now() - toolStarted;
      }
      if (event.data?.source === 'timeout') {
        this.guardTimedOut = true;
      }
    }
  }

  first(stage: string): number {
    return this.traceTimes[stage]?.[0] ?? 0;
  }

  toMetrics(scenario: string): LatencyMetrics {
    const toolStarted = this.first('tool_execution_started');
    const toolFinished = this.first('tool_execution_finished');
    const stepStarted = this.first('step_started');
    const toolResult = this.first('tool_result');
    const toolSelected = this.first('tool_selected');

    return {
      scenario,
      totalMs: this.endMs - this.startMs,
      userToFirstProviderResponseMs: this.firstProviderResponseMs - this.startMs,
      providerResponseToToolSelectedMs: toolSelected - this.firstProviderResponseMs,
      executeToolSafelyMs: toolFinished - toolStarted,
      screenDehydrationMs: this.screenDehydrationMs,
      targetResolutionMs: this.targetResolutionMs,
      guardDecisionMs: this.guardDecisionMs,
      preclassificationMs: this.preclassificationMs,
      firstStepMs: toolResult - stepStarted,
      guardTimedOut: this.guardTimedOut,
      classifyActionCalls: this.classifyActionCalls,
    };
  }
}

class TimedProvider implements AIProvider {
  private callCount = 0;

  constructor(
    private readonly recorder: LatencyRecorder,
    private readonly firstResponseDelayMs = 40
  ) {}

  async generateContent(): Promise<ProviderResult> {
    const isFirstCall = this.callCount === 0;
    if (isFirstCall) {
      await delay(this.firstResponseDelayMs);
    }
    const response = isFirstCall
      ? createToolResponse('tap', { index: 0 })
      : createTextResponse('Prepared checkout without committing anything.');
    this.callCount++;
    if (isFirstCall) {
      this.recorder.firstProviderResponseMs = now();
    }
    return response;
  }
}

class BenchmarkSafetyClassifier implements ActionSafetyClassifier {
  constructor(
    private readonly scenario: Exclude<GuardScenario, { kind: 'none' | 'deterministic' }>,
    private readonly recorder: LatencyRecorder
  ) {}

  async classifyScreen(input: ScreenSafetyInput) {
    const started = now();
    try {
      if (this.scenario.kind === 'cached') {
        await delay(this.scenario.screenDelayMs ?? 0);
        return {
          screenSignature: input.screenSignature,
          decisions: {
            0: {
              decision: 'allow',
              confidence: 0.98,
              reason: 'Preclassified visible element as safe.',
            },
          },
        };
      }
      return {
        screenSignature: input.screenSignature,
        decisions: {},
      };
    } finally {
      this.recorder.preclassificationMs += now() - started;
    }
  }

  async classifyAction(): Promise<ActionSafetyDecision> {
    this.recorder.classifyActionCalls += 1;
    switch (this.scenario.kind) {
      case 'fallback':
        await delay(this.scenario.delayMs);
        return {
          decision: 'allow',
          confidence: 0.96,
          reason: `Fallback guard model returned after ${this.scenario.delayMs}ms.`,
        };
      case 'timeout':
        await delay(this.scenario.delayMs);
        return {
          decision: 'allow',
          confidence: 0.96,
          reason: 'This result should arrive after the runtime timeout.',
        };
      case 'cached':
        return {
          decision: 'allow',
          confidence: 0.98,
          reason: 'Unexpected fallback from cached scenario.',
        };
    }
  }
}

function createBenchmarkAdapter(recorder: LatencyRecorder): PlatformAdapter {
  const elements: InteractiveNode[] = [
    {
      index: 0,
      type: 'pressable',
      label: 'Open Details',
      requiresConfirmation: false,
      fiberNode: {},
      props: {},
    },
  ];
  const snapshot: ScreenSnapshot = {
    screenName: 'ProductDetail',
    availableScreens: ['ProductDetail', 'Cart'],
    elementsText: 'Screen: ProductDetail\n[0]<pressable>Open Details />\n',
    elements,
  };
  let lastSnapshot: ScreenSnapshot | null = null;

  return {
    getScreenSnapshot: () => {
      const started = now();
      lastSnapshot = snapshot;
      recorder.screenDehydrationMs += now() - started;
      return snapshot;
    },
    getNavigationSnapshot: () => ({
      currentScreenName: 'ProductDetail',
      availableScreens: ['ProductDetail', 'Cart'],
    }),
    getLastScreenSnapshot: () => lastSnapshot,
    captureScreenshot: jest.fn().mockResolvedValue(undefined),
    executeAction: async (intent: ActionIntent) => {
      if (intent.type !== 'tap') {
        return '❌ Unsupported benchmark action.';
      }

      const resolveStarted = now();
      const target = snapshot.elements.find((element) => element.index === intent.index);
      recorder.targetResolutionMs += now() - resolveStarted;

      if (!target) {
        return `❌ Element with index ${intent.index} not found.`;
      }
      return `✅ Tapped [${intent.index}] "${target.label}"`;
    },
  };
}

async function runBenchmark(
  scenarioName: string,
  guardScenario: GuardScenario
): Promise<LatencyMetrics> {
  const recorder = new LatencyRecorder();
  const provider = new TimedProvider(recorder);
  const actionSafety =
    guardScenario.kind === 'none'
      ? undefined
      : guardScenario.kind === 'deterministic'
        ? { enabled: true }
        : {
            enabled: true,
            classifierTimeoutMs:
              guardScenario.kind === 'timeout' ? guardScenario.timeoutMs : 300,
            classifier: new BenchmarkSafetyClassifier(guardScenario, recorder),
          };
  const config: AgentConfig = {
    interactionMode: 'autopilot',
    maxSteps: 3,
    stepDelay: 0,
    platformAdapter: createBenchmarkAdapter(recorder),
    actionSafety,
    toolStabilization: {
      enabled: true,
      maxMs: 1000,
      stableFrames: 2,
    },
    onAskUser: jest.fn().mockResolvedValue('__APPROVAL_GRANTED__'),
    onTrace: (event) => recorder.markTrace(event),
  };
  const runtime = new AgentRuntime(provider, config, {}, {});

  recorder.startMs = now();
  const result = await runtime.execute('Buy this item');
  recorder.endMs = now();

  expect(result.success).toBe(true);
  return recorder.toMetrics(scenarioName);
}

describe('AgentRuntime latency benchmark', () => {
  it('measures baseline, cached guard, fallback guard, and timeout overhead', async () => {
    const scenarios: Array<[string, GuardScenario]> = [
      ['baseline:no_guard', { kind: 'none' }],
      ['guard:deterministic_allow', { kind: 'deterministic' }],
      ['guard:cached_allow', { kind: 'cached', screenDelayMs: 0 }],
      ['guard:model_100ms', { kind: 'fallback', delayMs: 100 }],
      ['guard:model_250ms', { kind: 'fallback', delayMs: 250 }],
      ['guard:model_500ms', { kind: 'fallback', delayMs: 500 }],
      ['guard:timeout_300ms', { kind: 'timeout', delayMs: 500, timeoutMs: 300 }],
    ];

    const metrics: LatencyMetrics[] = [];
    for (const [name, scenario] of scenarios) {
      metrics.push(await runBenchmark(name, scenario));
    }

    const byScenario = Object.fromEntries(
      metrics.map((entry) => [entry.scenario, entry])
    ) as Record<string, LatencyMetrics>;

    console.info(
      '[AgentRuntime latency benchmark]',
      JSON.stringify(metrics, null, 2)
    );

    expect(byScenario['baseline:no_guard']!.totalMs).toBeLessThan(2000);
    expect(byScenario['baseline:no_guard']!.userToFirstProviderResponseMs).toBeGreaterThanOrEqual(35);
    expect(byScenario['baseline:no_guard']!.providerResponseToToolSelectedMs).toBeGreaterThanOrEqual(0);
    expect(byScenario['baseline:no_guard']!.executeToolSafelyMs).toBeLessThan(250);
    expect(byScenario['baseline:no_guard']!.screenDehydrationMs).toBeGreaterThanOrEqual(0);
    expect(byScenario['baseline:no_guard']!.targetResolutionMs).toBeGreaterThanOrEqual(0);

    expect(byScenario['guard:deterministic_allow']!.guardDecisionMs).toBeLessThan(25);
    expect(byScenario['guard:cached_allow']!.guardDecisionMs).toBeLessThan(50);
    expect(byScenario['guard:cached_allow']!.classifyActionCalls).toBe(0);

    expect(byScenario['guard:model_100ms']!.guardDecisionMs).toBeGreaterThanOrEqual(80);
    expect(byScenario['guard:model_100ms']!.guardDecisionMs).toBeLessThan(180);
    expect(byScenario['guard:model_250ms']!.guardDecisionMs).toBeGreaterThanOrEqual(200);
    expect(byScenario['guard:model_250ms']!.guardDecisionMs).toBeLessThan(330);
    expect(byScenario['guard:model_500ms']!.guardDecisionMs).toBeGreaterThanOrEqual(250);
    expect(byScenario['guard:model_500ms']!.guardDecisionMs).toBeLessThan(380);

    expect(byScenario['guard:timeout_300ms']!.guardTimedOut).toBe(true);
    expect(byScenario['guard:timeout_300ms']!.guardDecisionMs).toBeGreaterThanOrEqual(250);
    expect(byScenario['guard:timeout_300ms']!.guardDecisionMs).toBeLessThan(380);
  });
});

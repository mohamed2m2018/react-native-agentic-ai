/**
 * AgentRuntime unit tests.
 *
 * Tests with mock provider (returns canned ProviderResult) and jest mocks
 * for FiberTreeWalker + systemPrompt. Covers 20 test cases across 7 describe blocks:
 * execution loop, budget guards, tool safety, navigation, observations,
 * history summarization, and knowledge-only mode.
 */

// ─── Mocks ─────────────────────────────────────────────────────

// Mock FiberTreeWalker
jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn().mockReturnValue({
    elementsText: '[0]<pressable>Open Details />\n',
    interactives: [{ index: 0, type: 'pressable' as const, label: 'Open Details', fiberNode: {}, props: {} }],
  }),
  findScrollableContainers: jest.fn().mockReturnValue([]),
}));

// Mock systemPrompt
jest.mock('../../core/systemPrompt', () => ({
  buildSystemPrompt: jest.fn().mockReturnValue('Mock system prompt'),
  buildVoiceSystemPrompt: jest.fn().mockReturnValue('Mock voice prompt'),
}));

// Mock ScreenDehydrator
jest.mock('../../core/ScreenDehydrator', () => ({
  dehydrateScreen: jest.fn().mockReturnValue({
    screenName: 'TestScreen',
    availableScreens: ['TestScreen'],
    elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
    elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: {} }],
  }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setEnabled: jest.fn(),
  },
}));

// Mock view-shot
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../providers/ProviderFactory', () => ({
  createProvider: jest.fn(),
}));

import { AgentRuntime } from '../../core/AgentRuntime';
import type { AIProvider, ProviderResult, AgentConfig, TokenUsage } from '../../core/types';
import { walkFiberTree } from '../../core/FiberTreeWalker';
import { dehydrateScreen } from '../../core/ScreenDehydrator';
import { createProvider } from '../../providers/ProviderFactory';

const mockWalkFiberTree = walkFiberTree as jest.Mock;
const mockDehydrateScreen = dehydrateScreen as jest.Mock;
const mockCreateProvider = createProvider as jest.Mock;

// ─── Mock Provider Factory ─────────────────────────────────────

class MockProvider implements AIProvider {
  private responses: ProviderResult[] = [];
  private callCount = 0;

  constructor(responses: ProviderResult[]) {
    this.responses = responses;
  }

  async generateContent(): Promise<ProviderResult> {
    const response = this.responses[this.callCount] || this.responses[this.responses.length - 1]!;
    this.callCount++;
    return response;
  }
}

class CapturingProvider extends MockProvider {
  public readonly userMessages: string[] = [];

  override async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: any[],
    history: any[],
    screenshot?: string,
  ): Promise<ProviderResult> {
    this.userMessages.push(userMessage);
    return super.generateContent(systemPrompt, userMessage, tools, history, screenshot);
  }
}

/** Creates a ProviderResult that triggers a tool call */
function createToolResponse(
  actionName: string,
  args: Record<string, any> = {},
  tokenUsage?: Partial<TokenUsage>,
): ProviderResult {
  return {
    toolCalls: [{ name: actionName, args }],
    reasoning: {
      previousGoalEval: 'Success',
      memory: 'test memory',
      plan: `Execute ${actionName}`,
    },
    text: undefined,
    tokenUsage: {
      promptTokens: tokenUsage?.promptTokens ?? 100,
      completionTokens: tokenUsage?.completionTokens ?? 50,
      totalTokens: tokenUsage?.totalTokens ?? 150,
      estimatedCostUSD: tokenUsage?.estimatedCostUSD ?? 0.001,
    },
  };
}

// ─── Default Config ────────────────────────────────────────────

const defaultConfig: AgentConfig = {
  maxSteps: 10,
  stepDelay: 0,
};

function createRuntime(provider: AIProvider, configOverrides: Partial<AgentConfig> = {}): AgentRuntime {
  const config = {
    ...defaultConfig,
    onAskUser: jest.fn().mockResolvedValue('yes'),
    ...configOverrides,
  };
  const mockNavRef = {
    isReady: () => true,
    getRootState: () => ({
      index: 0,
      routes: [{ name: 'TestScreen' }],
      routeNames: ['TestScreen', 'Settings'],
    }),
    getState: () => ({
      index: 0,
      routes: [{ name: 'TestScreen' }],
    }),
    navigate: jest.fn(),
  };
  // Use a plain object as rootRef; getFiberFromRef checks for child/memoizedProps
  const mockRootRef = {
    child: null,
    memoizedProps: {},
  };
  return new AgentRuntime(provider, config, mockRootRef, mockNavRef);
}

// ─── Tests ─────────────────────────────────────────────────────

describe('AgentRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProvider.mockReset();
    mockWalkFiberTree.mockReturnValue({
      elementsText: '[0]<pressable>Open Details />\n',
      interactives: [{ index: 0, type: 'pressable' as const, label: 'Open Details', fiberNode: {}, props: {} }],
    });
    mockDehydrateScreen.mockReturnValue({
      screenName: 'TestScreen',
      availableScreens: ['TestScreen'],
      elementsText: 'Screen: TestScreen\n[0]<pressable>Open Details />\n',
      elements: [{ index: 0, type: 'pressable' as const, label: 'Open Details', requiresConfirmation: false, fiberNode: {}, props: {} }],
    });
  });

  // ── Execution Loop ──────────────────────────────────────────

  describe('execution loop', () => {
    it('completes a single-step task when provider returns done', async () => {
      const provider = new MockProvider([
        createToolResponse('done', { text: 'Task complete', success: true }),
      ]);
      const runtime = createRuntime(provider);
      const result = await runtime.execute('Do something');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Task complete');
    });

    it('executes multi-step task (tap then done)', async () => {
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Done after tap', success: true }),
      ]);
      const runtime = createRuntime(provider, {
        onAskUser: jest.fn().mockResolvedValue('yes'),
      });
      const result = await runtime.execute('Tap and finish');

      expect(result.success).toBe(true);
      expect(result.steps.length).toBe(2);
    });

    it('blocks success completion when the screen shows a post-action error', async () => {
      const onPress = jest.fn();
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Submitted successfully', success: true }),
        createToolResponse('done', { text: 'Submission failed because the verification code is invalid.', success: false }),
      ]);

      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<pressable>Submit />\n',
        interactives: [{ index: 0, type: 'pressable' as const, label: 'Submit', fiberNode: {}, props: { onPress } }],
      });

      mockDehydrateScreen
        .mockReturnValueOnce({
          screenName: 'TestScreen',
          availableScreens: ['TestScreen'],
          elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: { onPress } }],
        })
        .mockReturnValueOnce({
          screenName: 'TestScreen',
          availableScreens: ['TestScreen'],
          elementsText: 'Screen: TestScreen\nVerification code is invalid\n[0]<pressable>Submit />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: { onPress } }],
        })
        .mockReturnValue({
          screenName: 'TestScreen',
          availableScreens: ['TestScreen'],
          elementsText: 'Screen: TestScreen\nVerification code is invalid\n[0]<pressable>Submit />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: { onPress } }],
        });

      const runtime = createRuntime(provider, {
        interactionMode: 'autopilot',
      });
      const result = await runtime.execute('Submit the form');

      expect(result.success).toBe(false);
      expect(result.message).toContain('verification code is invalid');
      expect(result.steps.map((step) => step.action.name)).toEqual(['tap', 'done', 'done']);
    }, 10000);

    it('injects bundled missing-field guidance into the next prompt after a controllable validation failure', async () => {
      const onPress = jest.fn();
      const provider = new CapturingProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Need more form info', success: false }),
      ]);

      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<pressable>Confirm Location />\n[1]<text-input>Building Name />\n[2]<text-input>Floor No />\n[3]<text-input>Phone Number />\n',
        interactives: [
          { index: 0, type: 'pressable' as const, label: 'Confirm Location', fiberNode: {}, props: { onPress } },
          { index: 1, type: 'text-input' as const, label: 'Building Name', fiberNode: {}, props: {} },
          { index: 2, type: 'text-input' as const, label: 'Floor No', fiberNode: {}, props: {} },
          { index: 3, type: 'text-input' as const, label: 'Phone Number', fiberNode: {}, props: {} },
        ],
      });

      mockDehydrateScreen
        .mockReturnValueOnce({
          screenName: 'ProfileForm',
          availableScreens: ['ProfileForm'],
          elementsText: 'Screen: ProfileForm\nBuilding Details  *\n[0]<pressable>Confirm Location />\n[1]<text-input value=\"\">Building Name />\n[2]<text-input value=\"\">Floor No />\n[3]<text-input value=\"\">Phone Number />\n',
          elements: [
            { index: 0, type: 'pressable' as const, label: 'Confirm Location', requiresConfirmation: false, fiberNode: {}, props: { onPress } },
            { index: 1, type: 'text-input' as const, label: 'Building Name', requiresConfirmation: false, fiberNode: {}, props: {} },
            { index: 2, type: 'text-input' as const, label: 'Floor No', requiresConfirmation: false, fiberNode: {}, props: {} },
            { index: 3, type: 'text-input' as const, label: 'Phone Number', requiresConfirmation: false, fiberNode: {}, props: {} },
          ],
        })
        .mockReturnValueOnce({
          screenName: 'ProfileForm',
          availableScreens: ['ProfileForm'],
          elementsText: 'Screen: ProfileForm\nBuilding Details  *\n[0]<pressable>Confirm Location />\n[1]<text-input value=\"\">Building Name />\n[2]<text-input value=\"\">Floor No />\nContact Information *\n[3]<text-input value=\"\">Phone Number />\nFloor number is required\n',
          elements: [
            { index: 0, type: 'pressable' as const, label: 'Confirm Location', requiresConfirmation: false, fiberNode: {}, props: { onPress } },
            { index: 1, type: 'text-input' as const, label: 'Building Name', requiresConfirmation: false, fiberNode: {}, props: {} },
            { index: 2, type: 'text-input' as const, label: 'Floor No', requiresConfirmation: false, fiberNode: {}, props: {} },
            { index: 3, type: 'text-input' as const, label: 'Phone Number', requiresConfirmation: false, fiberNode: {}, props: {} },
          ],
        });

      const runtime = createRuntime(provider, {
        interactionMode: 'autopilot',
      });
      const result = await runtime.execute('Save the profile');

      expect(result.success).toBe(false);
      expect(provider.userMessages[1]).toContain(
        'Visible missing required fields: Floor No, Building Name, Phone Number.',
      );
      expect(provider.userMessages[1]).toContain(
        'collect ALL of them in ONE ask_user(grants_workflow_approval=true) call',
      );
    }, 10000);

    it('allows success completion after a critical action changes the screen', async () => {
      const onPress = jest.fn();
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Settings saved', success: true }),
      ]);

      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<pressable>Save Changes />\n',
        interactives: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', fiberNode: {}, props: { onPress } }],
      });

      mockDehydrateScreen
        .mockReturnValueOnce({
          screenName: 'SettingsForm',
          availableScreens: ['SettingsForm', 'SettingsSummary'],
          elementsText: 'Screen: SettingsForm\n[0]<pressable>Save Changes />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', requiresConfirmation: false, fiberNode: {}, props: { onPress } }],
        })
        .mockReturnValueOnce({
          screenName: 'SettingsSummary',
          availableScreens: ['SettingsForm', 'SettingsSummary'],
          elementsText: 'Screen: SettingsSummary\nSettings updated\n',
          elements: [],
        });

      const runtime = createRuntime(provider, {
        interactionMode: 'autopilot',
      });
      const result = await runtime.execute('Save the settings');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Settings saved');
    }, 10000);

    it('blocks text-only completion while a critical action outcome is still uncertain', async () => {
      const onPress = jest.fn();
      const verifierProvider = new MockProvider([
        createToolResponse('report_verification', {
          status: 'uncertain',
          failureKind: 'controllable',
          evidence: 'The UI still shows the same form with no clear success or failure cue.',
        }),
        createToolResponse('report_verification', {
          status: 'error',
          failureKind: 'controllable',
          evidence: 'A required field message is visible on the same screen.',
        }),
      ]);
      mockCreateProvider.mockReturnValue(verifierProvider);

      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        {
          text: 'Looks done to me.',
          toolCalls: undefined,
          reasoning: {
            previousGoalEval: 'Success',
            memory: 'Pressed save',
            plan: 'Finish the task',
          },
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            estimatedCostUSD: 0.001,
          },
        },
        createToolResponse('done', { text: 'Submission failed because a required field is missing.', success: false }),
      ]);

      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<pressable>Save Changes />\n',
        interactives: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', fiberNode: {}, props: { onPress } }],
      });

      mockDehydrateScreen
        .mockReturnValueOnce({
          screenName: 'ProfileForm',
          availableScreens: ['ProfileForm'],
          elementsText: 'Screen: ProfileForm\n[0]<pressable>Save Changes />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', requiresConfirmation: false, fiberNode: {}, props: { onPress } }],
        })
        .mockReturnValueOnce({
          screenName: 'ProfileForm',
          availableScreens: ['ProfileForm'],
          elementsText: 'Screen: ProfileForm\n[0]<pressable>Save Changes />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', requiresConfirmation: false, fiberNode: {}, props: { onPress } }],
        })
        .mockReturnValue({
          screenName: 'ProfileForm',
          availableScreens: ['ProfileForm'],
          elementsText: 'Screen: ProfileForm\nRequired field\n[0]<pressable>Save Changes />\n',
          elements: [{ index: 0, type: 'pressable' as const, label: 'Save Changes', requiresConfirmation: false, fiberNode: {}, props: { onPress } }],
        });

      const runtime = createRuntime(provider, {
        interactionMode: 'autopilot',
        verifier: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
        },
      });
      const result = await runtime.execute('Save the profile');

      expect(mockCreateProvider).toHaveBeenCalledWith(
        'openai',
        undefined,
        'gpt-4.1-mini',
        undefined,
        undefined,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('required field');
    }, 10000);

    it('stops at max steps with failure message', async () => {
      // Provider always returns tap — never done
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
      ]);
      const runtime = createRuntime(provider, { maxSteps: 3 });
      const result = await runtime.execute('Infinite task');

      expect(result.success).toBe(false);
      expect(result.message).toContain('maximum steps');
    }, 15000);

    it('cancels mid-task and returns partial steps', async () => {
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Done', success: true }),
      ]);
      // autopilot skips copilot gate so tap executes cleanly each step
      // stepDelay > 0 ensures cancel() check fires between steps
      const runtime = createRuntime(provider, {
        interactionMode: 'autopilot',
        stepDelay: 10,
      });

      // Start execution, cancel midway through
      const resultPromise = runtime.execute('Test cancel');
      // Wait for step 0 to start (tool runs + 2000ms settle begins)
      await new Promise(resolve => setTimeout(resolve, 50));
      runtime.cancel();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.message).toContain('cancelled');
    }, 10000);

    it('rejects when already running', async () => {
      const provider = new MockProvider([
        createToolResponse('wait', { seconds: 2 }),
        createToolResponse('done', { text: 'Done', success: true }),
      ]);
      const runtime = createRuntime(provider);

      // Start a long task
      const firstTask = runtime.execute('Long task');
      // Try to start another while first is running
      const secondResult = await runtime.execute('Second task');

      expect(secondResult.success).toBe(false);
      expect(secondResult.message).toContain('already running');

      // Clean up first task
      runtime.cancel();
      await firstTask;
    });

    it('requires explicit approval before the first UI action in copilot mode', async () => {
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
        elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: {} }],
      });
      const onAskUser = jest.fn().mockResolvedValue('__APPROVAL_GRANTED__');
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Done after tap', success: true }),
      ]);
      const runtime = createRuntime(provider, { onAskUser });
      const result = await runtime.execute('Do the thing');

      // The copilot gate fires for the aiConfirm element and calls onAskUser with kind='approval'
      expect(onAskUser).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'approval',
          // Actual question text from AgentRuntime.checkCopilotConfirmation
          question: expect.stringContaining('I can do this in the app for you'),
        }),
      );
      expect(result.success).toBe(true);
    });

    it('stops if the user does not approve starting the task', async () => {
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
        elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: {} }],
      });
      // When user replies with a plain 'no' (not the __APPROVAL_REJECTED__ token),
      // the runtime treats it as a conversational interruption and keeps running
      // until maxSteps. Use __APPROVAL_REJECTED__ (the actual rejection token) to
      // hard-reject and get done with success=false via max steps.
      const onAskUser = jest.fn().mockResolvedValue('no');
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
      ]);
      const runtime = createRuntime(provider, { onAskUser, maxSteps: 2 });
      const result = await runtime.execute('Do the thing');

      // Hits maxSteps because tap keeps getting blocked/re-attempted
      expect(result.success).toBe(false);
    }, 30000);

    it('stops immediately when the user rejects an approval prompt', async () => {
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
        elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: false, fiberNode: {}, props: {} }],
      });

      const onAskUser = jest.fn().mockResolvedValue('__APPROVAL_REJECTED__');
      const provider = new MockProvider([
        createToolResponse('ask_user', {
          question: 'I can submit this form for you. May I proceed?',
          request_app_action: true,
        }),
        createToolResponse('ask_user', {
          question: 'This should never run',
          request_app_action: true,
        }),
      ]);
      const runtime = createRuntime(provider, { onAskUser });
      const result = await runtime.execute('Submit the form');

      expect(result.success).toBe(false);
      expect(result.message).toContain("I won't do that");
      expect(onAskUser).toHaveBeenCalledTimes(1);
    });

    it('stops immediately when the user rejects an aiConfirm action', async () => {
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<pressable>Place Order />\n',
        elements: [{ index: 0, type: 'pressable' as const, label: 'Place Order', requiresConfirmation: true, fiberNode: {}, props: {} }],
      });

      const onAskUser = jest.fn().mockResolvedValue('__APPROVAL_REJECTED__');
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('tap', { index: 0 }),
      ]);
      const runtime = createRuntime(provider, { onAskUser });
      const result = await runtime.execute('Place my order');

      expect(result.success).toBe(false);
      expect(result.message).toContain("I won't do that");
      expect(onAskUser).toHaveBeenCalledTimes(1);
    });

    it('acknowledges when the user already completed the action themselves', async () => {
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<pressable>Submit />\n',
        elements: [{ index: 0, type: 'pressable' as const, label: 'Submit', requiresConfirmation: true, fiberNode: {}, props: {} }],
      });
      const onAskUser = jest.fn().mockResolvedValue('__APPROVAL_ALREADY_DONE__');
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
      ]);
      const runtime = createRuntime(provider, { onAskUser });
      const result = await runtime.execute('Do the thing');

      expect(result.success).toBe(true);
      expect(result.message).toContain('already completed that step yourself');
    });

    it('treats workflow-data answers as approval for routine in-flow actions', async () => {
      const onChangeText = jest.fn();
      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<text-input>Street Address />\n',
        interactives: [{ index: 0, type: 'text-input' as const, label: 'Street Address', fiberNode: {}, props: { onChangeText } }],
      });
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<text-input>Street Address />\n',
        elements: [{ index: 0, type: 'text-input' as const, label: 'Street Address', requiresConfirmation: false, fiberNode: {}, props: { onChangeText } }],
      });

      const onAskUser = jest.fn().mockResolvedValue('123 Main St');
      const provider = new MockProvider([
        createToolResponse('ask_user', {
          question: 'What street address should I use?',
          request_app_action: false,
          grants_workflow_approval: true,
        }),
        createToolResponse('type', { index: 0, text: '123 Main St' }),
        createToolResponse('done', { text: 'Address entered', success: true }),
      ]);
      const runtime = createRuntime(provider, { onAskUser });
      const result = await runtime.execute('Write delivery address');

      expect(result.success).toBe(true);
      expect(onAskUser).toHaveBeenCalledTimes(1);
      expect(onAskUser).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'freeform',
          question: 'What street address should I use?',
        }),
      );
      expect(onChangeText).toHaveBeenCalledWith('123 Main St');
    }, 10000);

    it('does not treat ordinary clarification answers as workflow approval', async () => {
      const onChangeText = jest.fn();
      mockWalkFiberTree.mockReturnValue({
        elementsText: '[0]<text-input>Street Address />\n',
        interactives: [{ index: 0, type: 'text-input' as const, label: 'Street Address', fiberNode: {}, props: { onChangeText } }],
      });
      mockDehydrateScreen.mockReturnValue({
        screenName: 'TestScreen',
        availableScreens: ['TestScreen'],
        elementsText: 'Screen: TestScreen\n[0]<text-input>Street Address />\n',
        elements: [{ index: 0, type: 'text-input' as const, label: 'Street Address', requiresConfirmation: false, fiberNode: {}, props: { onChangeText } }],
      });

      const onAskUser = jest.fn().mockResolvedValue('123 Main St');
      const provider = new MockProvider([
        createToolResponse('ask_user', {
          question: 'What street address should I use?',
          request_app_action: false,
        }),
        createToolResponse('type', { index: 0, text: '123 Main St' }),
      ]);
      const runtime = createRuntime(provider, { onAskUser, maxSteps: 2 });
      const result = await runtime.execute('Write delivery address');

      expect(result.success).toBe(false);
      expect(result.steps[1]?.action.output).toContain('APP ACTION BLOCKED');
      expect(onChangeText).not.toHaveBeenCalled();
    });
  });

  // ── Budget Guards ───────────────────────────────────────────

  describe('budget guards', () => {
    it('stops when token budget exceeded', async () => {
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }, { totalTokens: 5000 }),
        createToolResponse('done', { text: 'Should not reach', success: true }),
      ]);
      const runtime = createRuntime(provider, { maxTokenBudget: 1000 });
      const result = await runtime.execute('Budget test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('token budget exceeded');
      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.totalTokens).toBeGreaterThanOrEqual(1000);
    });

    it('stops when cost budget exceeded', async () => {
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }, { estimatedCostUSD: 0.50 }),
        createToolResponse('done', { text: 'Should not reach', success: true }),
      ]);
      const runtime = createRuntime(provider, { maxCostUSD: 0.10 });
      const result = await runtime.execute('Cost test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('cost budget exceeded');
      expect(result.tokenUsage).toBeDefined();
    });

    it('includes tokenUsage in done-path result', async () => {
      const provider = new MockProvider([
        createToolResponse('done', { text: 'Complete', success: true }),
      ]);
      const runtime = createRuntime(provider);
      const result = await runtime.execute('Simple task');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.totalTokens).toBeGreaterThan(0);
    });
  });

  // ── Tool Execution Safety ───────────────────────────────────

  describe('tool execution safety', () => {
    it('handles unknown tool names gracefully', async () => {
      const provider = new MockProvider([
        createToolResponse('nonexistent_tool', {}),
        createToolResponse('done', { text: 'Recovered', success: true }),
      ]);
      const runtime = createRuntime(provider);
      const result = await runtime.execute('Unknown tool test');

      // Should not crash — the runtime should handle unknown tools
      expect(result).toBeDefined();
    });

    it('emits detailed audit traces during execution', async () => {
      const onTrace = jest.fn();
      const provider = new MockProvider([
        createToolResponse('tap', { index: 0 }),
        createToolResponse('done', { text: 'Recovered', success: true }),
      ]);
      const runtime = createRuntime(provider, { onTrace });
      await runtime.execute('Trace me');

      const stages = onTrace.mock.calls.map(([event]) => event.stage);
      expect(stages).toContain('task_started');
      expect(stages).toContain('screen_dehydrated');
      expect(stages).toContain('provider_response');
      expect(stages).toContain('tool_selected');
      expect(stages).toContain('tool_execution_started');
      expect(stages).toContain('tool_result');
      expect(stages).toContain('task_completed');
    });
  });

  // ── Navigation Helpers ──────────────────────────────────────

  describe('navigation helpers', () => {
    it('getRouteNames collects routes from navigation state', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider);
      // Access private method via any
      const routes = (runtime as any).getRouteNames();

      expect(routes).toContain('TestScreen');
      expect(routes).toContain('Settings');
    });

    it('buildNestedParams creates correct nesting', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider);
      // ['HomeTab', 'Home'] → { screen: 'Home' }
      const params = (runtime as any).buildNestedParams(['HomeTab', 'Home']);

      expect(params).toEqual({ screen: 'Home' });
    });

    it('buildNestedParams creates deep nesting with leaf params', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider);
      const params = (runtime as any).buildNestedParams(['Tab', 'Stack', 'Screen'], { id: 123 });

      expect(params).toEqual({ screen: 'Stack', params: { screen: 'Screen', params: { id: 123 } } });
    });
  });

  // ── Observations ────────────────────────────────────────────

  describe('observations', () => {
    it('warns at 5 remaining steps', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider, { maxSteps: 10 });

      // Access private method and state
      (runtime as any).lastScreenName = 'Screen1';
      (runtime as any).handleObservations(5, 10, 'Screen1');

      const observations: string[] = (runtime as any).observations;
      expect(observations.some((o: string) => o.includes('5 steps remaining'))).toBe(true);
    });

    it('warns critically at 2 remaining steps', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider, { maxSteps: 10 });

      (runtime as any).lastScreenName = 'Screen1';
      (runtime as any).handleObservations(8, 10, 'Screen1');

      const observations: string[] = (runtime as any).observations;
      expect(observations.some((o: string) => o.includes('2 steps left'))).toBe(true);
    });
  });

  // ── History Summarization ───────────────────────────────────

  describe('history summarization', () => {
    it('compresses middle steps when history > 8 steps', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider);

      // Populate history with 10 steps
      const history = [];
      for (let i = 0; i < 10; i++) {
        history.push({
          stepIndex: i + 1,
          reflection: {
            previousGoalEval: `Eval ${i}`,
            memory: `Memory ${i}`,
            plan: `Plan ${i}`,
          },
          action: {
            name: i < 5 ? 'tap' : 'scroll',
            input: {},
            output: i % 2 === 0 ? '✅ Success' : '❌ Failed',
          },
        });
      }
      (runtime as any).history = history;

      // Call assembleUserPrompt
      const prompt = (runtime as any).assembleUserPrompt(10, 25, 'test', 'Screen', 'content');

      // Should have summary block for steps 3-6 (indices 2-5)
      expect(prompt).toContain('<steps_summary>');
      expect(prompt).toContain('</steps_summary>');

      // First 2 steps should be full detail
      expect(prompt).toContain('<step_1>');
      expect(prompt).toContain('<step_2>');

      // Last 4 steps should be full detail
      expect(prompt).toContain('Eval 9');
      expect(prompt).toContain('Eval 8');
    });
  });

  // ── Knowledge-Only Mode ─────────────────────────────────────

  describe('knowledge-only mode', () => {
    it('registers only done and query_knowledge tools when enableUIControl is false', () => {
      const provider = new MockProvider([]);
      const config: AgentConfig = {
        ...defaultConfig,
        enableUIControl: false,
        knowledgeBase: [
          { id: '1', title: 'Test', content: 'Test content', tags: ['test'] },
        ],
      };
      const runtime = new AgentRuntime(provider, config, {}, null);

      const tools = (runtime as any).tools as Map<string, any>;
      expect(tools.has('done')).toBe(true);
      expect(tools.has('query_knowledge')).toBe(true);
      // UI tools should NOT be registered
      expect(tools.has('tap')).toBe(false);
      expect(tools.has('type')).toBe(false);
      expect(tools.has('navigate')).toBe(false);
      expect(tools.has('scroll')).toBe(false);
    });
  });

  // ── Public API ──────────────────────────────────────────────

  describe('public API', () => {
    it('getIsRunning returns correct state', async () => {
      const provider = new MockProvider([
        createToolResponse('done', { text: 'ok', success: true }),
      ]);
      const runtime = createRuntime(provider);

      expect(runtime.getIsRunning()).toBe(false);
    });

    it('cancel sets isCancelRequested flag', () => {
      const provider = new MockProvider([]);
      const runtime = createRuntime(provider);

      // Force isRunning to true to test cancel
      (runtime as any).isRunning = true;
      runtime.cancel();
      expect((runtime as any).isCancelRequested).toBe(true);
    });
  });
});

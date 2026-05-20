/**
 * AgentRuntime — The main agent loop, inspired by page-agent.js.
 *
 * Flow:
 * 1. Walk Fiber tree → detect interactive elements
 * 2. Dehydrate screen → text for LLM
 * 3. Send to AI provider with tools
 * 4. Parse tool call → execute (tap, type, navigate, done)
 * 5. If not done, repeat from step 1 (re-dehydrate after UI change)
 */

import { logger } from '../utils/logger';
import { walkFiberTree } from './FiberTreeWalker';
import type { WalkConfig } from './FiberTreeWalker';
import { dehydrateScreen } from './ScreenDehydrator';
import type {
  AIProvider,
  AgentConfig,
  AgentStep,
  ExecutionResult,
  ToolDefinition,
  ActionDefinition,
} from './types';

const DEFAULT_MAX_STEPS = 10;

// ─── System Prompt ─────────────────────────────────────────────

function buildSystemPrompt(language: string): string {
  const isArabic = language === 'ar';

  return `You are an AI agent that controls a React Native mobile app. You operate in an iterative loop to accomplish user requests.

${isArabic ? 'Respond to the user in Arabic.' : 'Respond to the user in English.'}

<input>
At every step you receive:
1. <screen_state>: Current screen name, available screens, and interactive elements indexed for actions.
2. <agent_history>: Your previous steps and their results.
3. <user_request>: The user's original request.
</input>

<screen_state>
Interactive elements are listed as [index]<type attrs>label</>
- index: numeric identifier for interaction
- type: element type (pressable, text-input, switch)
- label: visible text content of the element

Only elements with [index] are interactive. Use the index to tap or type into them.
</screen_state>

<tools>
Available tools:
- tap(index): Tap an interactive element by its index. This triggers its onPress handler.
- type(index, text): Type text into a text-input element by its index.
- navigate(screen, params): Navigate to a specific screen. params is optional JSON object.
- done(text, success): Complete the task. text is your response to the user.
- ask_user(question): Ask the user for clarification if needed.
</tools>

<rules>
- Only interact with elements that have an [index].
- After tapping an element, the screen may change. Wait for the next step to see updated elements.
- If the current screen doesn't have what you need, use navigate() to go to another screen.
- If you're stuck or need more info, use ask_user().
- When the task is complete, ALWAYS call done() with a summary.
- Be efficient — complete tasks in as few steps as possible.
- If a tap navigates to another screen, the next step will show the new screen's elements.
</rules>`;
}

// ─── Agent Runtime ─────────────────────────────────────────────

export class AgentRuntime {
  private provider: AIProvider;
  private config: AgentConfig;
  private rootRef: any;
  private navRef: any;
  private tools: Map<string, ToolDefinition> = new Map();
  private actions: Map<string, ActionDefinition> = new Map();
  private history: AgentStep[] = [];
  private isRunning = false;
  private lastAskUserQuestion: string | null = null;

  constructor(
    provider: AIProvider,
    config: AgentConfig,
    rootRef: any,
    navRef: any,
  ) {
    this.provider = provider;
    this.config = config;
    this.rootRef = rootRef;
    this.navRef = navRef;

    this.registerBuiltInTools();

    // Apply customTools — mirrors page-agent: null = remove, otherwise override
    if (config.customTools) {
      for (const [name, tool] of Object.entries(config.customTools)) {
        if (tool === null) {
          this.tools.delete(name);
          logger.info('AgentRuntime', `Removed tool: ${name}`);
        } else {
          this.tools.set(name, tool);
          logger.info('AgentRuntime', `Overrode tool: ${name}`);
        }
      }
    }
  }

  // ─── Tool Registration ─────────────────────────────────────

  private registerBuiltInTools(): void {
    // tap — tap an interactive element by index
    this.tools.set('tap', {
      name: 'tap',
      description: 'Tap an interactive element by its index to trigger its onPress handler.',
      parameters: {
        index: { type: 'number', description: 'The index of the element to tap', required: true },
      },
      execute: async (args) => {
        const { interactives: elements } = walkFiberTree(this.rootRef, this.getWalkConfig());
        const element = elements.find(el => el.index === args.index);
        if (!element) {
          return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
        }
        if (!element.props.onPress) {
          return `❌ Element [${args.index}] "${element.label}" does not have an onPress handler.`;
        }
        try {
          element.props.onPress();
          // Wait for UI to update after tap
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Tapped [${args.index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error tapping [${args.index}]: ${error.message}`;
        }
      },
    });

    // type — type text into a TextInput
    this.tools.set('type', {
      name: 'type',
      description: 'Type text into a text-input element by its index.',
      parameters: {
        index: { type: 'number', description: 'The index of the text-input element', required: true },
        text: { type: 'string', description: 'The text to type', required: true },
      },
      execute: async (args) => {
        const { interactives: elements } = walkFiberTree(this.rootRef, this.getWalkConfig());
        const element = elements.find(el => el.index === args.index);
        if (!element) {
          return `❌ Element with index ${args.index} not found.`;
        }
        if (!element.props.onChangeText) {
          return `❌ Element [${args.index}] "${element.label}" is not a text input.`;
        }
        try {
          element.props.onChangeText(args.text);
          return `✅ Typed "${args.text}" into [${args.index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error typing: ${error.message}`;
        }
      },
    });

    // navigate — navigate to a screen
    this.tools.set('navigate', {
      name: 'navigate',
      description: 'Navigate to a specific screen in the app.',
      parameters: {
        screen: { type: 'string', description: 'Screen name to navigate to', required: true },
        params: { type: 'string', description: 'Optional JSON params object', required: false },
      },
      execute: async (args) => {
        if (!this.navRef) {
          return '❌ Navigation ref not available.';
        }
        // Per React Navigation docs: must check isReady() before navigate
        // https://reactnavigation.org/docs/navigating-without-navigation-prop#handling-initialization
        if (!this.navRef.isReady()) {
          // Wait a bit and retry — navigator may still be mounting
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!this.navRef.isReady()) {
            return '❌ Navigation is not ready yet. The navigator may not have finished mounting.';
          }
        }
        try {
          const params = args.params ? (typeof args.params === 'string' ? JSON.parse(args.params) : args.params) : undefined;
          this.navRef.navigate(args.screen, params);
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Navigated to "${args.screen}"${params ? ` with params: ${JSON.stringify(params)}` : ''}`;
        } catch (error: any) {
          return `❌ Navigation error: ${error.message}. Available screens: ${this.getRouteNames().join(', ')}`;
        }
      },
    });

    // done — complete the task
    this.tools.set('done', {
      name: 'done',
      description: 'Complete the task with a message to the user.',
      parameters: {
        text: { type: 'string', description: 'Response message to the user', required: true },
        success: { type: 'boolean', description: 'Whether the task was completed successfully', required: true },
      },
      execute: async (args) => {
        return args.text;
      },
    });

    // ask_user — ask for clarification
    this.tools.set('ask_user', {
      name: 'ask_user',
      description: 'Ask the user for clarification or more information.',
      parameters: {
        question: { type: 'string', description: 'Question to ask the user', required: true },
      },
      execute: async (args) => {
        return `❓ ${args.question}`;
      },
    });
  }

  // ─── Action Registration (useAction hook) ──────────────────

  registerAction(action: ActionDefinition): void {
    this.actions.set(action.name, action);
    logger.info('AgentRuntime', `Registered action: ${action.name}`);
  }

  unregisterAction(name: string): void {
    this.actions.delete(name);
  }

  // ─── Navigation Helpers ────────────────────────────────────

  private getRouteNames(): string[] {
    try {
      if (!this.navRef?.isReady?.()) return [];
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (state?.routeNames) return state.routeNames;
      if (state?.routes) return state.routes.map((r: any) => r.name);
      return [];
    } catch {
      return [];
    }
  }

  private getCurrentScreenName(): string {
    try {
      if (!this.navRef?.isReady?.()) return 'Unknown';
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state) return 'Unknown';
      const route = state.routes[state.index];
      return route?.name || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  // ─── Build Tools Array for Provider ────────────────────────

  private buildToolsForProvider(): ToolDefinition[] {
    const allTools = [...this.tools.values()];

    // Add registered actions as tools
    for (const action of this.actions.values()) {
      allTools.push({
        name: action.name,
        description: action.description,
        parameters: Object.fromEntries(
          Object.entries(action.parameters).map(([key, typeStr]) => [
            key,
            { type: typeStr as any, description: key, required: true },
          ]),
        ),
        execute: async (args) => {
          try {
            const result = action.handler(args);
            return typeof result === 'string' ? result : JSON.stringify(result);
          } catch (error: any) {
            return `❌ Action "${action.name}" failed: ${error.message}`;
          }
        },
      });
    }

    return allTools;
  }

  // ─── Walk Config (passes security settings to FiberTreeWalker) ─

  private getWalkConfig(): WalkConfig {
    return {
      interactiveBlacklist: this.config.interactiveBlacklist,
      interactiveWhitelist: this.config.interactiveWhitelist,
    };
  }

  // ─── Instructions (mirrors page-agent #getInstructions) ───────

  private getInstructions(screenName: string): string {
    const { instructions } = this.config;
    if (!instructions) return '';

    let result = '';
    if (instructions.system?.trim()) {
      result += `<system_instructions>\n${instructions.system.trim()}\n</system_instructions>\n`;
    }

    if (instructions.getScreenInstructions) {
      try {
        const screenInstructions = instructions.getScreenInstructions(screenName)?.trim();
        if (screenInstructions) {
          result += `<screen_instructions>\n${screenInstructions}\n</screen_instructions>\n`;
        }
      } catch (error) {
        logger.error('AgentRuntime', 'Failed to get screen instructions:', error);
      }
    }

    return result ? `<instructions>\n${result}</instructions>\n\n` : '';
  }

  // ─── Main Execution Loop (mirrors PageAgentCore.execute) ───────

  async execute(userMessage: string): Promise<ExecutionResult> {
    if (this.isRunning) {
      return { success: false, message: 'Agent is already running.', steps: [] };
    }

    this.isRunning = true;
    this.history = [];
    const maxSteps = this.config.maxSteps || DEFAULT_MAX_STEPS;
    const stepDelay = this.config.stepDelay ?? 300;

    // Inject conversational context if we are answering the AI's question
    let contextualMessage = userMessage;
    if (this.lastAskUserQuestion) {
      contextualMessage = `(Note: You just asked the user: "${this.lastAskUserQuestion}")\n\nUser replied: ${userMessage}`;
      this.lastAskUserQuestion = null; // Consume the question
    }

    logger.info('AgentRuntime', `Starting execution: "${contextualMessage}"`);

    // Lifecycle: onBeforeTask (mirrors page-agent)
    await this.config.onBeforeTask?.();

    try {
      for (let step = 0; step < maxSteps; step++) {
        logger.info('AgentRuntime', `===== Step ${step + 1}/${maxSteps} =====`);

        // Lifecycle: onBeforeStep (mirrors page-agent)
        await this.config.onBeforeStep?.(step);

        // 1. Walk Fiber tree with security config and dehydrate screen
        const walkResult = walkFiberTree(this.rootRef, this.getWalkConfig());
        const screenName = this.getCurrentScreenName();
        const screen = dehydrateScreen(
          screenName,
          this.getRouteNames(),
          walkResult.elementsText,
          walkResult.interactives,
        );

        logger.info('AgentRuntime', `Screen: ${screen.screenName}`);
        logger.debug('AgentRuntime', `Dehydrated:\n${screen.elementsText}`);

        // 2. Apply transformScreenContent (mirrors page-agent transformPageContent)
        let screenContent = screen.elementsText;
        if (this.config.transformScreenContent) {
          screenContent = await this.config.transformScreenContent(screenContent);
        }

        // 3. Build context message with instructions + screen state
        const instructionsBlock = this.getInstructions(screenName);
        const contextMessage = step === 0
          ? `${instructionsBlock}<user_request>${contextualMessage}</user_request>\n\n<screen_state>\n${screenContent}\n</screen_state>`
          : `${instructionsBlock}<screen_state>\n${screenContent}\n</screen_state>`;

        // 4. Send to AI provider
        const systemPrompt = buildSystemPrompt(this.config.language || 'en');
        const tools = this.buildToolsForProvider();

        logger.info('AgentRuntime', `Sending to AI with ${tools.length} tools...`);

        const response = await this.provider.generateContent(
          systemPrompt,
          contextMessage,
          tools,
          this.history,
        );

        // 5. Process tool calls
        if (!response.toolCalls || response.toolCalls.length === 0) {
          logger.warn('AgentRuntime', 'No tool calls in response. Text:', response.text);
          const result: ExecutionResult = {
            success: true,
            message: response.text || 'Task completed.',
            steps: this.history,
          };
          await this.config.onAfterTask?.(result);
          return result;
        }

        for (const toolCall of response.toolCalls) {
          logger.info('AgentRuntime', `Tool: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

          // Find and execute the tool
          const tool = this.tools.get(toolCall.name) ||
            this.buildToolsForProvider().find(t => t.name === toolCall.name);

          let output: string;
          if (tool) {
            output = await tool.execute(toolCall.args);
          } else {
            output = `❌ Unknown tool: ${toolCall.name}`;
          }

          logger.info('AgentRuntime', `Result: ${output}`);

          // Record step
          const agentStep: AgentStep = {
            stepIndex: step,
            reflection: {
              evaluationPreviousGoal: step > 0 ? 'Evaluating...' : 'First step',
              memory: '',
              nextGoal: '',
            },
            action: {
              name: toolCall.name,
              input: toolCall.args,
              output,
            },
          };
          this.history.push(agentStep);

          // Lifecycle: onAfterStep (mirrors page-agent)
          await this.config.onAfterStep?.(this.history);

          // Check if done
          if (toolCall.name === 'done') {
            const result: ExecutionResult = {
              success: toolCall.args.success !== false,
              message: output,
              steps: this.history,
            };
            logger.info('AgentRuntime', `Task completed: ${output}`);
            await this.config.onAfterTask?.(result);
            return result;
          }

          // Check if asking user
          if (toolCall.name === 'ask_user') {
            this.lastAskUserQuestion = toolCall.args.question || output;
            
            const result: ExecutionResult = {
              success: true,
              message: output,
              steps: this.history,
            };
            await this.config.onAfterTask?.(result);
            return result;
          }
        }

        // Step delay (mirrors page-agent stepDelay)
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }

      // Max steps reached
      const result: ExecutionResult = {
        success: false,
        message: `Reached maximum steps (${maxSteps}) without completing the task.`,
        steps: this.history,
      };
      await this.config.onAfterTask?.(result);
      return result;
    } catch (error: any) {
      logger.error('AgentRuntime', 'Execution error:', error);
      const result: ExecutionResult = {
        success: false,
        message: `Error: ${error.message}`,
        steps: this.history,
      };
      await this.config.onAfterTask?.(result);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /** Update refs (called when component re-renders) */
  updateRefs(rootRef: any, navRef: any): void {
    this.rootRef = rootRef;
    this.navRef = navRef;
  }

  /** Check if agent is currently executing */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

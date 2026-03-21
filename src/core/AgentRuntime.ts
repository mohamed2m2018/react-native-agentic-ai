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
import { buildSystemPrompt } from './systemPrompt';
import type {
  AIProvider,
  AgentConfig,
  AgentStep,
  ExecutionResult,
  ToolDefinition,
  ActionDefinition,
} from './types';

const DEFAULT_MAX_STEPS = 10;

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
    // tap — universal interaction (mirrors RNTL's dispatchEvent pattern)
    this.tools.set('tap', {
      name: 'tap',
      description: 'Tap an interactive element by its index. Works universally on buttons, switches, and custom components.',
      parameters: {
        index: { type: 'number', description: 'The index of the element to tap', required: true },
      },
      execute: async (args) => {
        const { interactives: elements } = walkFiberTree(this.rootRef, this.getWalkConfig());
        const element = elements.find(el => el.index === args.index);
        if (!element) {
          return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
        }

        // Strategy 1: Switch — call onValueChange (like RNTL's fireEvent('valueChange'))
        if (element.type === 'switch' && element.props.onValueChange) {
          try {
            element.props.onValueChange(!element.props.value);
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Toggled [${args.index}] "${element.label}" to ${!element.props.value}`;
          } catch (error: any) {
            return `❌ Error toggling [${args.index}]: ${error.message}`;
          }
        }

        // Strategy 2: Direct onPress (covers Pressable, Button, custom components)
        if (element.props.onPress) {
          try {
            element.props.onPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Tapped [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error tapping [${args.index}]: ${error.message}`;
          }
        }

        // Strategy 3: Bubble up Fiber tree (like RNTL's findEventHandler → element.parent)
        let fiber = element.fiberNode?.return;
        let bubbleDepth = 0;
        while (fiber && bubbleDepth < 5) {
          const parentProps = fiber.memoizedProps || {};
          if (parentProps.onPress && typeof parentProps.onPress === 'function') {
            try {
              parentProps.onPress();
              await new Promise(resolve => setTimeout(resolve, 500));
              return `✅ Tapped parent of [${args.index}] "${element.label}"`;
            } catch (error: any) {
              return `❌ Error tapping parent of [${args.index}]: ${error.message}`;
            }
          }
          fiber = fiber.return;
          bubbleDepth++;
        }

        return `❌ Element [${args.index}] "${element.label}" has no tap handler (no onPress or onValueChange found).`;
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

    // navigate — navigate to a screen (supports React Navigation + Expo Router)
    this.tools.set('navigate', {
      name: 'navigate',
      description: 'Navigate to a specific screen in the app.',
      parameters: {
        screen: { type: 'string', description: 'Screen name or path to navigate to', required: true },
        params: { type: 'string', description: 'Optional JSON params object', required: false },
      },
      execute: async (args) => {
        // Expo Router path: use router.push()
        if (this.config.router) {
          try {
            const path = args.screen.startsWith('/') ? args.screen : `/${args.screen}`;
            this.config.router.push(path);
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Navigated to "${path}"`;
          } catch (error: any) {
            return `❌ Navigation error: ${error.message}`;
          }
        }

        // React Navigation path: use navRef.navigate()
        if (!this.navRef) {
          return '❌ Navigation ref not available.';
        }
        if (!this.navRef.isReady()) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!this.navRef.isReady()) {
            return '❌ Navigation is not ready yet.';
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

    // ask_user — ask for clarification (mirrors page-agent: blocks until user responds)
    this.tools.set('ask_user', {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
      parameters: {
        question: { type: 'string', description: 'Question to ask the user', required: true },
      },
      execute: async (args) => {
        if (this.config.onAskUser) {
          // Page-agent pattern: block until user responds, then continue the loop
          this.config.onStatusUpdate?.('Waiting for your answer...');
          const answer = await this.config.onAskUser(args.question);
          return `User answered: ${answer}`;
        }
        // Legacy fallback: break the loop (context will be lost)
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

  /**
   * Recursively collect ALL screen names from the navigation state tree.
   * This handles tabs, drawers, and nested stacks.
   */
  private getRouteNames(): string[] {
    try {
      if (!this.navRef?.isReady?.()) return [];
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state) return [];
      return this.collectRouteNames(state);
    } catch {
      return [];
    }
  }

  private collectRouteNames(state: any): string[] {
    const names: string[] = [];
    if (state?.routes) {
      for (const route of state.routes) {
        names.push(route.name);
        // Recurse into nested navigator states
        if (route.state) {
          names.push(...this.collectRouteNames(route.state));
        }
      }
    }
    return [...new Set(names)];
  }

  /**
   * Recursively find the deepest active screen name.
   * For tabs: follows active tab → active screen inside that tab.
   */
  private getCurrentScreenName(): string {
    // Expo Router: use pathname
    if (this.config.pathname) {
      const segments = this.config.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || 'Unknown';
    }

    try {
      if (!this.navRef?.isReady?.()) return 'Unknown';
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state) return 'Unknown';
      return this.getDeepestScreenName(state);
    } catch {
      return 'Unknown';
    }
  }

  private getDeepestScreenName(state: any): string {
    if (!state?.routes || state.index == null) return 'Unknown';
    const route = state.routes[state.index];
    if (!route) return 'Unknown';
    // If this route has a nested state, recurse deeper
    if (route.state) {
      return this.getDeepestScreenName(route.state);
    }
    return route.name || 'Unknown';
  }

  /** Maps a tool call to a user-friendly status label for the loading overlay. */
  private getToolStatusLabel(toolName: string, args: Record<string, any>): string {
    switch (toolName) {
      case 'tap':
        return `Tapping element ${args.index ?? ''}...`;
      case 'type':
        return `Typing into field...`;
      case 'navigate':
        return `Navigating to ${args.screen || 'screen'}...`;
      case 'done':
        return 'Wrapping up...';
      case 'ask_user':
        return 'Asking you a question...';
      default:
        return `Running ${toolName}...`;
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

  // ─── Observation System (mirrors PageAgentCore.#handleObservations) ──

  private observations: string[] = [];
  private lastScreenName: string = '';

  private handleObservations(step: number, maxSteps: number, screenName: string): void {
    // Screen change detection
    if (this.lastScreenName && screenName !== this.lastScreenName) {
      this.observations.push(`Screen navigated to → ${screenName}`);
    }
    this.lastScreenName = screenName;

    // Remaining steps warning
    const remaining = maxSteps - step;
    if (remaining === 5) {
      this.observations.push(
        `⚠️ Only ${remaining} steps remaining. Consider wrapping up or calling done with partial results.`
      );
    } else if (remaining === 2) {
      this.observations.push(
        `⚠️ Critical: Only ${remaining} steps left! You must finish the task or call done immediately.`
      );
    }
  }

  // ─── User Prompt Assembly (mirrors PageAgentCore.#assembleUserPrompt) ──

  private assembleUserPrompt(
    step: number,
    maxSteps: number,
    contextualMessage: string,
    screenName: string,
    screenContent: string,
  ): string {
    let prompt = '';

    // 1. <instructions> (optional system/screen instructions)
    prompt += this.getInstructions(screenName);

    // 2. <agent_state> — user request + step info (mirrors page-agent)
    prompt += '<agent_state>\n';
    prompt += '<user_request>\n';
    prompt += `${contextualMessage}\n`;
    prompt += '</user_request>\n';
    prompt += '<step_info>\n';
    prompt += `Step ${step + 1} of ${maxSteps} max possible steps\n`;
    prompt += '</step_info>\n';
    prompt += '</agent_state>\n\n';

    // 3. <agent_history> — structured per-step history (mirrors page-agent)
    prompt += '<agent_history>\n';

    let stepIndex = 0;
    for (const event of this.history) {
      stepIndex++;
      prompt += `<step_${stepIndex}>\n`;
      prompt += `Previous Goal Eval: ${event.reflection.previousGoalEval}\n`;
      prompt += `Memory: ${event.reflection.memory}\n`;
      prompt += `Plan: ${event.reflection.plan}\n`;
      prompt += `Action Result: ${event.action.output}\n`;
      prompt += `</step_${stepIndex}>\n`;
    }

    // Inject system observations
    for (const obs of this.observations) {
      prompt += `<sys>${obs}</sys>\n`;
    }
    this.observations = [];

    prompt += '</agent_history>\n\n';

    // 4. <screen_state> — dehydrated screen content
    prompt += '<screen_state>\n';
    prompt += `Current Screen: ${screenName}\n`;
    prompt += screenContent + '\n';
    prompt += '</screen_state>\n';

    return prompt;
  }

  // ─── Main Execution Loop ──────────────────────────────────────

  async execute(userMessage: string): Promise<ExecutionResult> {
    if (this.isRunning) {
      return { success: false, message: 'Agent is already running.', steps: [] };
    }

    this.isRunning = true;
    this.history = [];
    this.observations = [];
    this.lastScreenName = '';
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

        // 3. Handle observations (mirrors page-agent #handleObservations)
        this.handleObservations(step, maxSteps, screenName);

        // 4. Assemble structured user prompt (mirrors page-agent #assembleUserPrompt)
        const contextMessage = this.assembleUserPrompt(
          step, maxSteps, contextualMessage, screenName, screenContent,
        );

        // 5. Send to AI provider
        this.config.onStatusUpdate?.('Analyzing screen...');
        const systemPrompt = buildSystemPrompt(this.config.language || 'en');
        const tools = this.buildToolsForProvider();

        logger.info('AgentRuntime', `Sending to AI with ${tools.length} tools...`);

        const response = await this.provider.generateContent(
          systemPrompt,
          contextMessage,
          tools,
          this.history,
        );

        // 6. Process tool calls
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

        // 7. Structured reasoning from provider (no regex parsing needed)
        const { reasoning } = response;
        logger.info('AgentRuntime', `🧠 Plan: ${reasoning.plan}`);
        if (reasoning.memory) {
          logger.debug('AgentRuntime', `💾 Memory: ${reasoning.memory}`);
        }

        // Only process the FIRST tool call per step (one action per step).
        // After one action, the loop re-reads the screen with fresh indexes.
        const toolCall = response.toolCalls[0]!;
        if (response.toolCalls.length > 1) {
          logger.warn('AgentRuntime', `AI returned ${response.toolCalls.length} tool calls, executing only the first one.`);
        }

        logger.info('AgentRuntime', `Tool: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

        // Dynamic status update based on tool being executed
        const statusLabel = this.getToolStatusLabel(toolCall.name, toolCall.args);
        this.config.onStatusUpdate?.(statusLabel);

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

        // Record step with structured reasoning
        const agentStep: AgentStep = {
          stepIndex: step,
          reflection: reasoning,
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
            message: toolCall.args.text || output,
            steps: this.history,
          };
          logger.info('AgentRuntime', `Task completed: ${result.message}`);
          await this.config.onAfterTask?.(result);
          return result;
        }

        // Check if asking user (legacy path — only breaks loop when onAskUser is NOT set)
        if (toolCall.name === 'ask_user' && !this.config.onAskUser) {
          this.lastAskUserQuestion = toolCall.args.question || output;

          const result: ExecutionResult = {
            success: true,
            message: output,
            steps: this.history,
          };
          await this.config.onAfterTask?.(result);
          return result;
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

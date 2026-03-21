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
      prompt += `Evaluation of Previous Step: ${event.reflection.evaluationPreviousGoal}\n`;
      prompt += `Memory: ${event.reflection.memory}\n`;
      prompt += `Next Goal: ${event.reflection.nextGoal}\n`;
      prompt += `Action Results: ${event.action.output}\n`;
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

  // ─── Parse Reasoning from AI Text (extract evaluation/memory/next_goal) ──

  private parseReasoning(text?: string): { evaluation: string; memory: string; nextGoal: string } {
    if (!text) return { evaluation: '', memory: '', nextGoal: '' };

    let evaluation = '';
    let memory = '';
    let nextGoal = '';

    // Parse "Evaluation:" or "1." pattern
    const evalMatch = text.match(/(?:Evaluation|1\.)\s*:?\s*(.+?)(?=(?:Memory|Next Goal|2\.|3\.|\n\n|$))/is);
    if (evalMatch?.[1]) evaluation = evalMatch[1].trim();

    // Parse "Next Goal:" or "2." pattern
    const goalMatch = text.match(/(?:Next Goal|2\.)\s*:?\s*(.+?)(?=(?:\n\n|$))/is);
    if (goalMatch?.[1]) nextGoal = goalMatch[1].trim();

    return { evaluation, memory, nextGoal };
  }

  // ─── Main Execution Loop (mirrors PageAgentCore.execute) ───────

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

        // 7. Parse reasoning from text response (mirrors page-agent reflection)
        const reasoning = this.parseReasoning(response.text);

        // Only process the FIRST tool call per step (page-agent principle: one action per step).
        // After one action, the loop re-reads the screen with fresh indexes.
        // Processing multiple tool calls would cause index drift after UI re-renders.
        const toolCall = response.toolCalls[0]!;
        if (response.toolCalls.length > 1) {
          logger.warn('AgentRuntime', `AI returned ${response.toolCalls.length} tool calls, executing only the first one.`);
        }

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

        // Record step with reasoning metadata
        const agentStep: AgentStep = {
          stepIndex: step,
          reflection: {
            evaluationPreviousGoal: reasoning.evaluation || (step > 0 ? 'Evaluating...' : 'First step'),
            memory: reasoning.memory,
            nextGoal: reasoning.nextGoal,
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
            message: toolCall.args.text || output,
            steps: this.history,
          };
          logger.info('AgentRuntime', `Task completed: ${result.message}`);
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

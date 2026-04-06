/**
 * GeminiProvider — Gemini API integration via @google/genai SDK.
 *
 * Uses the official Google GenAI SDK for:
 * - generateContent with structured function calling (agent_step)
 * - inlineData for vision (base64 screenshots)
 * - System instructions
 *
 * Implements the AIProvider interface so it can be swapped
 * with OpenAIProvider, AnthropicProvider, etc.
 */

import { logger } from '../utils/logger';

/**
 * Lazy-loads @google/genai on first call.
 * Using require() instead of a static import allows:
 *  1. Older Metro bundlers (RN 0.72-0.73) to bundle the library without
 *     choking on the SDK's ESM sub-path exports.
 *  2. Users who pick OpenAI to never pay the SDK startup cost.
 *
 * NOTE: We do NOT cache the result in module-scope variables because that
 * would break Jest's mock isolation — jest.mock() replaces the module in the
 * require registry, so every call to require() in a test sees the mock.
 * Node's own require() cache handles de-duplication in production.
 */
function loadGenAI() {
  try {
    const mod = require('@google/genai');
    return {
      GoogleGenAI: mod.GoogleGenAI as typeof import('@google/genai').GoogleGenAI,
      FunctionCallingConfigMode: mod.FunctionCallingConfigMode as typeof import('@google/genai').FunctionCallingConfigMode,
      Type: mod.Type as typeof import('@google/genai').Type,
    };
  } catch (e: any) {
    throw new Error(
      '[mobileai] @google/genai is required for the Gemini provider. ' +
      'Install it: npm install @google/genai'
    );
  }
}

import type {
  AIProvider,
  ToolDefinition,
  AgentStep,
  ProviderResult,
  AgentReasoning,
  TokenUsage,
} from '../core/types';

// ─── Constants ─────────────────────────────────────────────────

const AGENT_STEP_FN = 'agent_step';

// ─── Provider ──────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private ai: any; // GoogleGenAI instance, loaded lazily
  private model: string;

  constructor(
    apiKey?: string,
    model: string = 'gemini-2.5-flash',
    proxyUrl?: string,
    proxyHeaders?: Record<string, string>
  ) {
    const config: any = {};

    if (proxyUrl) {
      config.apiKey = 'proxy-key'; // Dummy key to bypass local validation
      config.httpOptions = {
        baseUrl: proxyUrl,
        headers: proxyHeaders || {},
      };
    } else if (apiKey) {
      config.apiKey = apiKey;
    } else {
      throw new Error(
        '[mobileai] You must provide either "apiKey" or "proxyUrl" to AIAgent.'
      );
    }

    const { GoogleGenAI } = loadGenAI();
    this.ai = new GoogleGenAI(config);
    this.model = model;
  }

  async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
    screenshot?: string
  ): Promise<ProviderResult> {
    logger.info(
      'GeminiProvider',
      `Sending request. Model: ${this.model}, Tools: ${tools.length}${screenshot ? ', with screenshot' : ''}`
    );

    // Build single agent_step function declaration
    const agentStepDeclaration = this.buildAgentStepDeclaration(tools);

    // Build contents (user message + optional screenshot)
    const contents = this.buildContents(userMessage, history, screenshot);

    const startTime = Date.now();

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: [agentStepDeclaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: loadGenAI().FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [AGENT_STEP_FN],
            },
          },
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });

      const elapsed = Date.now() - startTime;
      logger.info('GeminiProvider', `Response received in ${elapsed}ms`);

      // Extract token usage from SDK response
      const tokenUsage = this.extractTokenUsage(response);
      if (tokenUsage) {
        logger.info(
          'GeminiProvider',
          `Tokens: ${tokenUsage.promptTokens} in / ${tokenUsage.completionTokens} out / $${tokenUsage.estimatedCostUSD.toFixed(6)}`
        );
      }

      const result = this.parseAgentStepResponse(response, tools);
      result.tokenUsage = tokenUsage;
      return result;
    } catch (error: any) {
      logger.error('GeminiProvider', 'Request failed:', error.message);

      if (error.status) {
        throw new Error(this.formatProviderError(error.status, error.message));
      }
      throw error;
    }
  }

  // ─── Build agent_step Declaration ──────────────────────────

  /**
   * Builds a single `agent_step` function declaration that keeps Gemini's
   * served schema intentionally narrow:
   * - Structured reasoning fields
   * - action_name (enum of all available tool names)
   * - action_input as a JSON object string
   *
   * Flattening every tool parameter into top-level properties can trigger
   * Gemini's "too much branching for serving" error once the toolset grows.
   */
  private buildAgentStepDeclaration(tools: ToolDefinition[]): any {
    const toolNames = tools.map((t) => t.name);

    // Build tool descriptions for the action_name enum
    const toolDescriptions = tools
      .map((t) => {
        const params = Object.keys(t.parameters);
        const inputGuide =
          params.length === 0
            ? 'Use {} for action_input.'
            : `Provide action_input as a JSON object string with keys: ${params.join(', ')}.`;
        return `- ${t.name}: ${t.description} ${inputGuide}`;
      })
      .join('\n');

    const { Type } = loadGenAI();

    return {
      name: AGENT_STEP_FN,
      description: `Execute one agent step. Choose an action and provide reasoning.\n\nAvailable actions:\n${toolDescriptions}`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          previous_goal_eval: {
            type: Type.STRING,
            description:
              'One-sentence assessment of your last action. State success, failure, or uncertain. Skip on first step.',
          },
          memory: {
            type: Type.STRING,
            description:
              'Key facts to remember for future steps: progress made, items found, counters, field values already collected.',
          },
          plan: {
            type: Type.STRING,
            description:
              'Your immediate next goal — what action you will take and why.',
          },
          action_name: {
            type: Type.STRING,
            description: 'Which action to execute.',
            enum: toolNames,
          },
          action_input: {
            type: Type.STRING,
            description:
              'JSON object string containing only the arguments for action_name. Use "{}" when the action takes no parameters.',
          },
        },
        required: ['plan', 'action_name'],
      },
    };
  }

  // ─── Build Contents ────────────────────────────────────────

  /**
   * Builds contents for the generateContent call.
   * Single-turn: user message + optional screenshot as inlineData.
   */
  private buildContents(
    userMessage: string,
    _history: AgentStep[],
    screenshot?: string
  ): any[] {
    const parts: any[] = [{ text: userMessage }];

    // Append screenshot as inlineData for Gemini vision
    if (screenshot) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: screenshot,
        },
      });
    }

    return [{ role: 'user', parts }];
  }

  // ─── Parse Response ────────────────────────────────────────

  /**
   * Parses the SDK response expecting a single agent_step function call.
   * Extracts structured reasoning + action.
   */
  private parseAgentStepResponse(
    response: any,
    tools: ToolDefinition[]
  ): ProviderResult {
    const candidates = response.candidates || [];

    if (candidates.length === 0) {
      logger.warn('GeminiProvider', 'No candidates in response');
      return {
        toolCalls: [
          {
            name: 'done',
            args: { text: 'No response generated.', success: false },
          },
        ],
        reasoning: { previousGoalEval: '', memory: '', plan: '' },
        text: 'No response generated.',
      };
    }

    const candidate = candidates[0];
    const parts = candidate.content?.parts || [];

    // Find the function call part
    const fnCallPart = parts.find((p: any) => p.functionCall);
    const textPart = parts.find((p: any) => p.text);

    if (!fnCallPart?.functionCall) {
      logger.warn(
        'GeminiProvider',
        'No function call in response. Text:',
        textPart?.text
      );
      return {
        toolCalls: [
          {
            name: 'done',
            args: {
              text: textPart?.text || 'No action taken.',
              success: false,
            },
          },
        ],
        reasoning: { previousGoalEval: '', memory: '', plan: '' },
        text: textPart?.text,
      };
    }

    const args = fnCallPart.functionCall.args || {};

    // Extract reasoning fields
    const reasoning: AgentReasoning = {
      previousGoalEval: args.previous_goal_eval || '',
      memory: args.memory || '',
      plan: args.plan || '',
    };

    // Extract action
    const actionName = args.action_name;
    if (!actionName) {
      logger.warn(
        'GeminiProvider',
        'No action_name in agent_step. Falling back to done.'
      );
      return {
        toolCalls: [
          {
            name: 'done',
            args: { text: 'Agent did not choose an action.', success: false },
          },
        ],
        reasoning,
        text: textPart?.text,
      };
    }

    const matchedTool = tools.find((t) => t.name === actionName);
    let actionArgs: Record<string, any> = {};
    const rawActionInput = args.action_input;

    if (
      typeof rawActionInput === 'string' &&
      rawActionInput.trim().length > 0
    ) {
      try {
        const parsed = JSON.parse(rawActionInput);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          actionArgs = parsed as Record<string, any>;
        }
      } catch (error) {
        logger.warn(
          'GeminiProvider',
          `Invalid action_input JSON for ${actionName}: ${(error as Error).message}`
        );
      }
    }

    if (matchedTool) {
      actionArgs = Object.fromEntries(
        Object.entries(actionArgs).filter(
          ([key]) => key in matchedTool.parameters
        )
      );
    } else {
      actionArgs = {};
    }

    logger.info(
      'GeminiProvider',
      `Parsed: action=${actionName}, plan="${reasoning.plan}"`
    );

    return {
      toolCalls: [{ name: actionName, args: actionArgs }],
      reasoning,
      text: textPart?.text,
    };
  }

  // ─── Token Usage Extraction ─────────────────────────────────

  /**
   * Extracts token usage from SDK response and calculates estimated cost.
   *
   * Pricing (Gemini 2.5 Flash):
   * - Input:  $0.30 / 1M tokens
   * - Output: $2.50 / 1M tokens
   */
  private extractTokenUsage(response: any): TokenUsage | undefined {
    const meta = response?.usageMetadata;
    if (!meta) return undefined;

    const promptTokens = meta.promptTokenCount ?? 0;
    const completionTokens = meta.candidatesTokenCount ?? 0;
    const totalTokens = meta.totalTokenCount ?? promptTokens + completionTokens;

    // Cost estimation based on Gemini 2.5 Flash pricing
    const INPUT_COST_PER_M = 0.3;
    const OUTPUT_COST_PER_M = 2.5;

    const estimatedCostUSD =
      (promptTokens / 1_000_000) * INPUT_COST_PER_M +
      (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;

    return { promptTokens, completionTokens, totalTokens, estimatedCostUSD };
  }

  // ─── Error Formatting ──────────────────────────────────────

  /**
   * Converts raw API errors into clean, user-friendly messages.
   * Parses JSON error bodies and maps HTTP codes to plain language.
   */
  private formatProviderError(status: number, rawMessage: string): string {
    // Try to extract the human-readable message from JSON body
    let humanMessage = '';
    let errorCode = '';
    try {
      const parsed = JSON.parse(rawMessage);
      humanMessage = parsed?.error?.message || parsed?.message || '';
      errorCode = parsed?.error?.code || parsed?.code || '';
    } catch {
      // rawMessage may contain JSON embedded in a string like "503: {json}"
      const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          humanMessage = parsed?.error?.message || parsed?.message || '';
          errorCode = parsed?.error?.code || parsed?.code || '';
        } catch {
          /* ignore */
        }
      }
    }

    if (errorCode === 'proxy_blocked') {
      logger.error('GeminiProvider', 'Proxy blocked: Credit limit reached or budget exhausted.');
      return 'The AI assistant is temporarily unavailable. Please try again later.';
    }

    // Map status codes to friendly descriptions
    switch (status) {
      case 429:
        return (
          humanMessage ||
          'Too many requests. Please wait a moment and try again.'
        );
      case 503:
        return (
          humanMessage ||
          'The AI service is temporarily unavailable. Please try again shortly.'
        );
      case 500:
        return (
          humanMessage ||
          'The AI service encountered an internal error. Please try again.'
        );
      case 401:
        return 'Authentication failed. Please check your API key.';
      case 403:
        return 'Access denied. Your API key may not have the required permissions.';
      default:
        return (
          humanMessage || `Something went wrong (${status}). Please try again.`
        );
    }
  }
}

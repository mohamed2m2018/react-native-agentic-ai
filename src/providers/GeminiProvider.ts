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
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const RATE_LIMIT_BACKOFF_MS = 3000;

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  tag: string,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error.status ?? error.httpCode ?? 0;
      const msg = String(error.message || '');
      const isRateLimit = status === 429 || msg.includes('device_rate_limited') || msg.includes('token_rate_limited');
      const isRetryable = isRateLimit || status === 503;
      if (!isRetryable || attempt === maxRetries) throw error;

      const base = isRateLimit ? RATE_LIMIT_BACKOFF_MS : BASE_BACKOFF_MS;
      const delay = base * Math.pow(2, attempt);
      logger.warn(tag, `${status} — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── Provider ──────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private ai: any; // GoogleGenAI instance, loaded lazily
  private model: string;

  private enableWebSearch: boolean;

  constructor(
    apiKey?: string,
    model: string = 'gemini-2.5-flash',
    proxyUrl?: string,
    proxyHeaders?: Record<string, string>,
    enableWebSearch?: boolean,
  ) {
    this.enableWebSearch = enableWebSearch ?? false;
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

  /**
   * Returns a web_search tool that makes a separate Gemini call with
   * Google Search grounding. This avoids the limitation where built-in
   * tools (googleSearch) cannot be combined with function calling.
   */
  createWebSearchTool(): ToolDefinition | null {
    if (!this.enableWebSearch) return null;

    const ai = this.ai;
    const model = this.model;

    return {
      name: 'web_search',
      description:
        'Search the web for real-time, domain-relevant information that is NOT available '
        + 'on screen or in the knowledge base. Use ONLY for app-related queries: product info, '
        + 'current promotions, store/restaurant details, delivery status from external sources, '
        + 'dietary or allergen info for menu items, etc. '
        + 'Do NOT use for general knowledge questions unrelated to the app.',
      parameters: {
        query: {
          type: 'string' as const,
          description: 'The search query — should be specific and related to the app domain',
          required: true,
        },
      },
      execute: async (args: Record<string, any>) => {
        const query = args.query;
        if (!query?.trim()) return 'Error: search query is required.';

        logger.info('WebSearch', `Searching: "${query}"`);
        try {
          const response: any = await retryWithBackoff(
            () => ai.models.generateContent({
              model,
              contents: query,
              config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
                maxOutputTokens: 1024,
              },
            }),
            'WebSearch',
          );

          const text = response?.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text)
            ?.map((p: any) => p.text)
            ?.join('\n');

          if (!text) {
            logger.warn('WebSearch', 'No text in search response');
            return 'Web search returned no results for this query.';
          }

          logger.info('WebSearch', `Got ${text.length} chars`);
          return `Web search results for "${query}":\n\n${text}`;
        } catch (error: any) {
          logger.error('WebSearch', `Failed: ${error.message}`);
          return `Web search failed: ${error.message}. Try answering from available app data instead.`;
        }
      },
    };
  }

  async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
    screenshot?: string,
    signal?: AbortSignal,
    userImages?: Array<{ base64: string; mimeType: string }>,
  ): Promise<ProviderResult> {
    logger.info(
      'GeminiProvider',
      `Sending request. Model: ${this.model}, Tools: ${tools.length}${screenshot ? ', with screenshot' : ''}${userImages?.length ? `, with ${userImages.length} user image(s)` : ''}`
    );

    // Build single agent_step function declaration
    const agentStepDeclaration = this.buildAgentStepDeclaration(tools);

    // Build contents (user message + optional screenshot + user images)
    const contents = this.buildContents(userMessage, history, screenshot, userImages);

    const startTime = Date.now();

    try {
      const response = await retryWithBackoff(
        () => this.ai.models.generateContent({
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
            abortSignal: signal,
          },
        }),
        'GeminiProvider',
      );

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
  private buildAgentStepDeclaration(tools: ToolDefinition[]) {
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
    screenshot?: string,
    userImages?: Array<{ base64: string; mimeType: string }>,
  ): any[] {
    const parts: any[] = [{ text: userMessage }];

    if (userImages?.length) {
      for (const img of userImages) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        });
      }
      parts.push({ text: '\n[The user attached the above image(s) to their message. Describe what you see if relevant to their request.]' });
    }

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
    const groundingMeta = candidate.groundingMetadata;

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
    const actionName = args.action_name as string;
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
          actionArgs = parsed;
        }
      } catch (error: any) {
        logger.warn(
          'GeminiProvider',
          `Invalid action_input JSON for ${actionName}: ${error.message}`
        );
      }
    } else if (
      rawActionInput &&
      typeof rawActionInput === 'object' &&
      !Array.isArray(rawActionInput)
    ) {
      actionArgs = rawActionInput as Record<string, any>;
    } else if (matchedTool) {
      for (const paramName of Object.keys(matchedTool.parameters)) {
        if (args[paramName] !== undefined) {
          actionArgs[paramName] = args[paramName];
        }
      }
    }

    if (matchedTool) {
      actionArgs = Object.fromEntries(
        Object.entries(actionArgs).filter(([key]) => key in matchedTool.parameters)
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
      groundingMetadata: groundingMeta,
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

    if (errorCode === 'budget_exhausted' || errorCode === 'proxy_blocked') {
      logger.error(
        'GeminiProvider',
        'Proxy blocked: project has run out of hosted proxy credits.'
      );
      return 'This project has run out of AI credits. Add more credits in the MobileAI dashboard to continue.';
    }
    if (errorCode === 'hosted_proxy_disabled') {
      return 'The MobileAI hosted proxy is not enabled for this project yet.';
    }
    if (errorCode === 'invalid_auth_key') {
      return 'This MobileAI key is invalid. Use the publishable key from your dashboard project settings.';
    }

    // Map status codes to friendly descriptions
    switch (status) {
      case 429:
        return humanMessage || 'Too many requests. Please wait a moment and try again.';
      case 503:
        return humanMessage || 'The AI service is temporarily unavailable. Please try again shortly.';
      case 500:
        return humanMessage || 'The AI service encountered an internal error. Please try again.';
      case 401:
        return 'Authentication failed. Please check your API key.';
      case 403:
        return 'Access denied. Your API key may not have the required permissions.';
      default:
        return humanMessage || `Something went wrong (${status}). Please try again.`;
    }
  }
}

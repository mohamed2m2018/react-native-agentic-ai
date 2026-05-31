/**
 * OpenAIProvider — OpenAI Chat Completions API via raw fetch.
 *
 * Uses the same flat `agent_step` function pattern as GeminiProvider:
 * - Reasoning fields (previous_goal_eval, memory, plan) + action in one tool call
 * - `tool_choice: "required"` forces a tool call every step
 * - `strict: true` guarantees schema adherence
 *
 * No SDK dependency — raw fetch for full React Native compatibility.
 * Implements the AIProvider interface so it can be swapped with GeminiProvider.
 */

import { logger } from '../utils/logger';
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
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const REASONING_FIELDS = ['previous_goal_eval', 'memory', 'plan'] as const;

// ─── Provider ──────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  private model: string;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(
    apiKey?: string,
    model: string = 'gpt-4.1-mini',
    proxyUrl?: string,
    proxyHeaders?: Record<string, string>,
  ) {
    if (proxyUrl) {
      this.baseUrl = proxyUrl.endsWith('/')
        ? `${proxyUrl}v1/chat/completions`
        : proxyUrl;
      this.headers = {
        'Content-Type': 'application/json',
        ...(proxyHeaders || {}),
      };
    } else if (apiKey) {
      this.baseUrl = OPENAI_API_URL;
      this.headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
    } else {
      throw new Error(
        '[mobileai] You must provide either "apiKey" or "proxyUrl" to use OpenAI provider.',
      );
    }

    this.model = model;
  }

  async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    _history: AgentStep[],
    screenshot?: string,
  ): Promise<ProviderResult> {
    logger.info(
      'OpenAIProvider',
      `Sending request. Model: ${this.model}, Tools: ${tools.length}${screenshot ? ', with screenshot' : ''}`,
    );

    const agentStepTool = this.buildAgentStepTool(tools);
    const messages = this.buildMessages(systemPrompt, userMessage, screenshot);

    const startTime = Date.now();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          tools: [agentStepTool],
          tool_choice: 'required',
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      logger.info('OpenAIProvider', `Response received in ${elapsed}ms`);

      const tokenUsage = this.extractTokenUsage(data);
      if (tokenUsage) {
        logger.info(
          'OpenAIProvider',
          `Tokens: ${tokenUsage.promptTokens} in / ${tokenUsage.completionTokens} out / $${tokenUsage.estimatedCostUSD.toFixed(6)}`,
        );
      }

      const result = this.parseAgentStepResponse(data, tools);
      result.tokenUsage = tokenUsage;
      return result;
    } catch (error: any) {
      logger.error('OpenAIProvider', 'Request failed:', error.message);
      throw error;
    }
  }

  // ─── Build agent_step Tool ──────────────────────────────────

  /**
   * Builds the OpenAI tool definition for `agent_step`.
   * Same flat pattern as Gemini — reasoning fields + action in one function.
   * Uses `strict: true` for guaranteed schema adherence.
   */
  private buildAgentStepTool(tools: ToolDefinition[]): any {
    const toolNames = tools.map((t) => t.name);

    // Collect all unique parameter fields across all tools
    const actionProperties: Record<string, any> = {};
    for (const tool of tools) {
      for (const [paramName, param] of Object.entries(tool.parameters)) {
        if (actionProperties[paramName]) continue;
        actionProperties[paramName] = {
          type: param.type,
          description: param.description,
          ...(param.enum ? { enum: param.enum } : {}),
        };
      }
    }

    // Build tool descriptions for enum
    const toolDescriptions = tools
      .map((t) => {
        const params = Object.keys(t.parameters).join(', ');
        return `- ${t.name}(${params}): ${t.description}`;
      })
      .join('\n');

    // OpenAI strict mode requires additionalProperties: false
    // and ALL properties in `required` array
    const allProperties: Record<string, any> = {
      previous_goal_eval: {
        type: 'string',
        description:
          'One-sentence assessment of your last action. State success, failure, or uncertain. Skip on first step.',
      },
      memory: {
        type: 'string',
        description:
          'Key facts to remember for future steps: progress made, items found, counters, field values already collected.',
      },
      plan: {
        type: 'string',
        description:
          'Your immediate next goal — what action you will take and why.',
      },
      action_name: {
        type: 'string',
        description: 'Which action to execute.',
        enum: toolNames,
      },
      ...actionProperties,
    };

    return {
      type: 'function',
      function: {
        name: AGENT_STEP_FN,
        description: `Execute one agent step. Choose an action and provide reasoning.\n\nAvailable actions:\n${toolDescriptions}`,
        parameters: {
          type: 'object',
          properties: allProperties,
          required: Object.keys(allProperties),
          additionalProperties: false,
        },
        strict: true,
      },
    };
  }

  // ─── Build Messages ────────────────────────────────────────

  private buildMessages(
    systemPrompt: string,
    userMessage: string,
    screenshot?: string,
  ): any[] {
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // User message — text or multimodal with screenshot
    if (screenshot) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${screenshot}`,
              detail: 'low',
            },
          },
        ],
      });
    } else {
      messages.push({ role: 'user', content: userMessage });
    }

    return messages;
  }

  // ─── Parse Response ────────────────────────────────────────

  private parseAgentStepResponse(
    data: any,
    tools: ToolDefinition[],
  ): ProviderResult {
    const choice = data.choices?.[0];

    if (!choice) {
      logger.warn('OpenAIProvider', 'No choices in response');
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

    const message = choice.message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall?.function) {
      logger.warn(
        'OpenAIProvider',
        'No tool call in response. Text:',
        message?.content,
      );
      return {
        toolCalls: [
          {
            name: 'done',
            args: {
              text: message?.content || 'No action taken.',
              success: false,
            },
          },
        ],
        reasoning: { previousGoalEval: '', memory: '', plan: '' },
        text: message?.content,
      };
    }

    // OpenAI returns arguments as a JSON STRING — must parse
    let args: Record<string, any>;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (err) {
      logger.error(
        'OpenAIProvider',
        'Failed to parse tool arguments:',
        toolCall.function.arguments,
      );
      return {
        toolCalls: [
          {
            name: 'done',
            args: { text: 'Failed to parse AI response.', success: false },
          },
        ],
        reasoning: { previousGoalEval: '', memory: '', plan: '' },
      };
    }

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
        'OpenAIProvider',
        'No action_name in agent_step. Falling back to done.',
      );
      return {
        toolCalls: [
          {
            name: 'done',
            args: { text: 'Agent did not choose an action.', success: false },
          },
        ],
        reasoning,
        text: message?.content,
      };
    }

    // Build action args: extract only the params that belong to the matched tool
    const actionArgs: Record<string, any> = {};
    const reservedKeys = new Set([...REASONING_FIELDS, 'action_name']);

    const matchedTool = tools.find((t) => t.name === actionName);
    if (matchedTool) {
      for (const paramName of Object.keys(matchedTool.parameters)) {
        if (args[paramName] !== undefined) {
          actionArgs[paramName] = args[paramName];
        }
      }
    } else {
      for (const [key, value] of Object.entries(args)) {
        if (!reservedKeys.has(key)) {
          actionArgs[key] = value;
        }
      }
    }

    logger.info(
      'OpenAIProvider',
      `Parsed: action=${actionName}, plan="${reasoning.plan}"`,
    );

    return {
      toolCalls: [{ name: actionName, args: actionArgs }],
      reasoning,
      text: message?.content,
    };
  }

  // ─── Token Usage Extraction ─────────────────────────────────

  /**
   * Extracts token usage from OpenAI response and calculates estimated cost.
   *
   * Pricing (GPT-4.1-mini):
   * - Input:  $0.40 / 1M tokens
   * - Output: $1.60 / 1M tokens
   */
  private extractTokenUsage(data: any): TokenUsage | undefined {
    const usage = data?.usage;
    if (!usage) return undefined;

    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;

    // Cost estimation based on GPT-4.1-mini pricing
    const INPUT_COST_PER_M = 0.4;
    const OUTPUT_COST_PER_M = 1.6;

    const estimatedCostUSD =
      (promptTokens / 1_000_000) * INPUT_COST_PER_M +
      (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;

    return { promptTokens, completionTokens, totalTokens, estimatedCostUSD };
  }
}

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

import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';
import { logger } from '../utils/logger';
import type { AIProvider, ToolDefinition, AgentStep, ProviderResult, AgentReasoning, TokenUsage } from '../core/types';

// ─── Constants ─────────────────────────────────────────────────

const AGENT_STEP_FN = 'agent_step';

// Reasoning fields always present in the agent_step schema
const REASONING_FIELDS = ['previous_goal_eval', 'memory', 'plan'] as const;

// ─── Provider ──────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
    screenshot?: string,
  ): Promise<ProviderResult> {

    logger.info('GeminiProvider', `Sending request. Model: ${this.model}, Tools: ${tools.length}${screenshot ? ', with screenshot' : ''}`);

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
              mode: FunctionCallingConfigMode.ANY,
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
        logger.info('GeminiProvider', `Tokens: ${tokenUsage.promptTokens} in / ${tokenUsage.completionTokens} out / $${tokenUsage.estimatedCostUSD.toFixed(6)}`);
      }

      const result = this.parseAgentStepResponse(response, tools);
      result.tokenUsage = tokenUsage;
      return result;
    } catch (error: any) {
      logger.error('GeminiProvider', 'Request failed:', error.message);

      // Preserve HTTP error format for backward compatibility with tests
      if (error.status) {
        throw new Error(`Gemini API error ${error.status}: ${error.message}`);
      }
      throw error;
    }
  }

  // ─── Build agent_step Declaration ──────────────────────────

  /**
   * Builds a single `agent_step` function declaration that combines:
   * - Structured reasoning fields (previous_goal_eval, memory, plan)
   * - action_name (enum of all available tool names)
   * - All tool parameter fields as flat top-level properties
   *
   * Flat schema avoids Gemini's "deeply nested schema" rejection in ANY mode.
   */
  private buildAgentStepDeclaration(tools: ToolDefinition[]): any {
    const toolNames = tools.map(t => t.name);

    // Collect all unique parameter fields across all tools
    const actionProperties: Record<string, any> = {};
    for (const tool of tools) {
      for (const [paramName, param] of Object.entries(tool.parameters)) {
        if (actionProperties[paramName]) continue;
        actionProperties[paramName] = {
          type: this.mapParamType(param.type),
          description: param.description,
          ...(param.enum ? { enum: param.enum } : {}),
        };
      }
    }

    // Build tool descriptions for the action_name enum
    const toolDescriptions = tools
      .map(t => {
        const params = Object.keys(t.parameters).join(', ');
        return `- ${t.name}(${params}): ${t.description}`;
      })
      .join('\n');

    return {
      name: AGENT_STEP_FN,
      description: `Execute one agent step. Choose an action and provide reasoning.\n\nAvailable actions:\n${toolDescriptions}`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          previous_goal_eval: {
            type: Type.STRING,
            description: 'One-sentence assessment of your last action. State success, failure, or uncertain. Skip on first step.',
          },
          memory: {
            type: Type.STRING,
            description: 'Key facts to remember for future steps: progress made, items found, counters, field values already collected.',
          },
          plan: {
            type: Type.STRING,
            description: 'Your immediate next goal — what action you will take and why.',
          },
          action_name: {
            type: Type.STRING,
            description: 'Which action to execute.',
            enum: toolNames,
          },
          ...actionProperties,
        },
        required: ['plan', 'action_name'],
      },
    };
  }

  private mapParamType(type: string): string {
    switch (type) {
      case 'number': return Type.NUMBER;
      case 'integer': return Type.INTEGER;
      case 'boolean': return Type.BOOLEAN;
      case 'string':
      default: return Type.STRING;
    }
  }

  // ─── Build Contents ────────────────────────────────────────

  /**
   * Builds contents for the generateContent call.
   * Single-turn: user message + optional screenshot as inlineData.
   */
  private buildContents(userMessage: string, _history: AgentStep[], screenshot?: string): any[] {
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
  private parseAgentStepResponse(response: any, tools: ToolDefinition[]): ProviderResult {
    const candidates = response.candidates || [];

    if (candidates.length === 0) {
      logger.warn('GeminiProvider', 'No candidates in response');
      return {
        toolCalls: [{ name: 'done', args: { text: 'No response generated.', success: false } }],
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
      logger.warn('GeminiProvider', 'No function call in response. Text:', textPart?.text);
      return {
        toolCalls: [{ name: 'done', args: { text: textPart?.text || 'No action taken.', success: false } }],
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
      logger.warn('GeminiProvider', 'No action_name in agent_step. Falling back to done.');
      return {
        toolCalls: [{ name: 'done', args: { text: 'Agent did not choose an action.', success: false } }],
        reasoning,
        text: textPart?.text,
      };
    }

    // Build action args: extract only the params that belong to the matched tool
    const actionArgs: Record<string, any> = {};
    const reservedKeys = new Set([...REASONING_FIELDS, 'action_name']);

    const matchedTool = tools.find(t => t.name === actionName);
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

    logger.info('GeminiProvider', `Parsed: action=${actionName}, plan="${reasoning.plan}"`);

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
    const totalTokens = meta.totalTokenCount ?? (promptTokens + completionTokens);

    // Cost estimation based on Gemini 2.5 Flash pricing
    const INPUT_COST_PER_M = 0.30;
    const OUTPUT_COST_PER_M = 2.50;

    const estimatedCostUSD =
      (promptTokens / 1_000_000) * INPUT_COST_PER_M +
      (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;

    return { promptTokens, completionTokens, totalTokens, estimatedCostUSD };
  }
}

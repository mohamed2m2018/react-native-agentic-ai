/**
 * GeminiProvider — Gemini API integration with structured action pattern.
 *
 * Uses a single forced function call (`agent_step`) that bundles
 * structured reasoning (evaluation, memory, plan) alongside the action.
 * This replaces free-form text + separate tool calls for stability.
 */

import { logger } from '../utils/logger';
import type { AIProvider, ToolDefinition, AgentStep, ProviderResult, AgentReasoning } from '../core/types';

// ─── Constants ─────────────────────────────────────────────────

const AGENT_STEP_FN = 'agent_step';

// Reasoning fields that are always present in the agent_step schema
const REASONING_FIELDS = ['previous_goal_eval', 'memory', 'plan'] as const;

// ─── Gemini API Types ──────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    functionCall?: { name: string; args: any };
    functionResponse?: { name: string; response: any };
  }>;
}

// ─── Provider ──────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
  ): Promise<ProviderResult> {

    logger.info('GeminiProvider', `Sending request. Model: ${this.model}, Tools: ${tools.length}`);

    // Build single agent_step function declaration
    const agentStepDeclaration = this.buildAgentStepDeclaration(tools);

    // Build conversation history with proper function call/response pairs
    const contents = this.buildContents(userMessage, history);

    // Make API request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body: any = {
      contents,
      tools: [{ functionDeclarations: [agentStepDeclaration] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Force the model to always call agent_step
      tool_config: {
        function_calling_config: {
          mode: 'ANY',
          allowed_function_names: [AGENT_STEP_FN],
        },
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const elapsed = Date.now() - startTime;
      logger.info('GeminiProvider', `Response received in ${elapsed}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GeminiProvider', `API error ${response.status}: ${errorText}`);
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      return this.parseAgentStepResponse(data, tools);
    } catch (error: any) {
      logger.error('GeminiProvider', 'Request failed:', error.message);
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
        // Skip if already added (shared field names like 'text', 'index')
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
        type: 'OBJECT',
        properties: {
          // ── Reasoning fields ──
          previous_goal_eval: {
            type: 'STRING',
            description: 'One-sentence assessment of your last action. State success, failure, or uncertain. Skip on first step.',
          },
          memory: {
            type: 'STRING',
            description: 'Key facts to remember for future steps: progress made, items found, counters, field values already collected.',
          },
          plan: {
            type: 'STRING',
            description: 'Your immediate next goal — what action you will take and why.',
          },
          // ── Action selection ──
          action_name: {
            type: 'STRING',
            description: 'Which action to execute.',
            enum: toolNames,
          },
          // ── Action parameters (flat) ──
          ...actionProperties,
        },
        required: ['plan', 'action_name'],
      },
    };
  }

  private mapParamType(type: string): string {
    switch (type) {
      case 'number': return 'NUMBER';
      case 'integer': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'string':
      default: return 'STRING';
    }
  }

  // ─── Build Contents ────────────────────────────────────────

  /**
   * Builds Gemini conversation contents.
   * 
   * Each step is a STATELESS single-turn request (matching page-agent's approach):
   * - System prompt has general instructions
   * - User message contains full context: task, history, screen state
   * - Model responds with agent_step function call
   * 
   * History is embedded as text in assembleUserPrompt (via <agent_history>),
   * NOT as functionCall/functionResponse pairs. This avoids Gemini's
   * conversation format requirements and thought_signature complexity.
   */
  private buildContents(userMessage: string, _history: AgentStep[]): GeminiContent[] {
    return [{
      role: 'user',
      parts: [{ text: userMessage }],
    }];
  }

  // ─── Parse Response ────────────────────────────────────────

  /**
   * Parses the Gemini response expecting a single agent_step function call.
   * Extracts structured reasoning + action, and determines which tool to execute.
   */
  private parseAgentStepResponse(data: any, tools: ToolDefinition[]): ProviderResult {
    if (!data.candidates || data.candidates.length === 0) {
      logger.warn('GeminiProvider', 'No candidates in response');
      return {
        toolCalls: [{ name: 'done', args: { text: 'No response generated.', success: false } }],
        reasoning: { previousGoalEval: '', memory: '', plan: '' },
        text: 'No response generated.',
      };
    }

    const candidate = data.candidates[0];
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

    // Build action args: everything except reasoning fields and action_name
    const actionArgs: Record<string, any> = {};
    const reservedKeys = new Set([...REASONING_FIELDS, 'action_name']);

    // Find the matching tool to know which params belong to it
    const matchedTool = tools.find(t => t.name === actionName);
    if (matchedTool) {
      for (const paramName of Object.keys(matchedTool.parameters)) {
        if (args[paramName] !== undefined) {
          actionArgs[paramName] = args[paramName];
        }
      }
    } else {
      // Custom/registered tool — grab all non-reserved fields
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
}

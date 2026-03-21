/**
 * GeminiProvider — Simplified Gemini API integration.
 * Sends dehydrated screen state + tools to Gemini and parses tool call responses.
 */

import { logger } from '../utils/logger';
import type { AIProvider, ToolDefinition, AgentStep } from '../core/types';

// ─── Gemini API Types ──────────────────────────────────────────

interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: { name: string; args: any }; functionResponse?: { name: string; response: any } }>;
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
  ): Promise<{ toolCalls: Array<{ name: string; args: Record<string, any> }>; text?: string }> {

    logger.info('GeminiProvider', `Sending request. Model: ${this.model}, Tools: ${tools.length}`);

    // Build Gemini tools
    const geminiTools = this.buildGeminiTools(tools);

    // Build conversation history
    const contents = this.buildContents(userMessage, history);

    // Make API request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body: any = {
      contents,
      tools: geminiTools.length > 0 ? geminiTools : undefined,
      systemInstruction: { parts: [{ text: systemPrompt }] },
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

      // Parse response
      return this.parseResponse(data);
    } catch (error: any) {
      logger.error('GeminiProvider', 'Request failed:', error.message);
      throw error;
    }
  }

  // ─── Build Gemini Tools ────────────────────────────────────

  private buildGeminiTools(tools: ToolDefinition[]): GeminiTool[] {
    const declarations: GeminiFunctionDeclaration[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: this.mapParamType(param.type),
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          ]),
        ),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required !== false)
          .map(([key]) => key),
      },
    }));

    return [{ functionDeclarations: declarations }];
  }

  private mapParamType(type: string): string {
    switch (type) {
      case 'number': return 'NUMBER';
      case 'boolean': return 'BOOLEAN';
      case 'string':
      default: return 'STRING';
    }
  }

  // ─── Build Contents ────────────────────────────────────────

  private buildContents(userMessage: string, history: AgentStep[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    // Add history as conversation turns
    for (const step of history) {
      // User turn (screen state was sent)
      contents.push({
        role: 'user',
        parts: [{ text: `Step ${step.stepIndex + 1} result: ${step.action.output}` }],
      });
    }

    // Current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Ensure alternating roles (Gemini requirement)
    return this.ensureAlternatingRoles(contents);
  }

  private ensureAlternatingRoles(contents: GeminiContent[]): GeminiContent[] {
    if (contents.length <= 1) return contents;

    const merged: GeminiContent[] = [contents[0]!];

    for (let i = 1; i < contents.length; i++) {
      const prev = merged[merged.length - 1]!;
      const curr = contents[i]!;

      if (prev.role === curr.role) {
        // Merge same-role messages
        prev.parts.push(...curr.parts);
      } else {
        merged.push(curr);
      }
    }

    return merged;
  }

  // ─── Parse Response ────────────────────────────────────────

  private parseResponse(data: any): { toolCalls: Array<{ name: string; args: Record<string, any> }>; text?: string } {
    const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];
    let text: string | undefined;

    if (!data.candidates || data.candidates.length === 0) {
      logger.warn('GeminiProvider', 'No candidates in response');
      return { toolCalls, text: 'No response generated.' };
    }

    const candidate = data.candidates[0];
    const parts = candidate.content?.parts || [];

    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
      if (part.text) {
        text = (text || '') + part.text;
      }
    }

    logger.info('GeminiProvider', `Parsed: ${toolCalls.length} tool calls, text: ${text ? 'yes' : 'no'}`);

    return { toolCalls, text };
  }


}

/**
 * Builds the runtime config for tasks sent by the MCP server.
 *
 * MCP tasks are plain app automation driven by the developer's own AI key:
 * no hosted proxy, no support persona or escalation tools, no dashboard-managed
 * actions or knowledge. Only what the developer passed to <AIAgent> directly is kept.
 */

import type {
  AgentConfig,
  AIProviderName,
  KnowledgeBaseConfig,
  ToolDefinition,
} from './types';

export const MCP_PROVIDERS: readonly AIProviderName[] = ['gemini', 'openai'];

export interface MCPProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

/** Validates a provider config received over the bridge. Returns null when invalid. */
export function parseMCPProviderConfig(data: any): MCPProviderConfig | null {
  if (!data || typeof data.apiKey !== 'string' || !data.apiKey.trim())
    return null;
  if (!MCP_PROVIDERS.includes(data.provider)) return null;
  const model =
    typeof data.model === 'string' && data.model.trim()
      ? data.model.trim()
      : undefined;
  return { provider: data.provider, apiKey: data.apiKey.trim(), model };
}

export interface MCPDeveloperOptions {
  /** The developer's own `customTools` prop (dashboard and support tools excluded). */
  customTools?: Record<string, ToolDefinition | null>;
  /** The developer's own `instructions` prop. */
  instructions?: AgentConfig['instructions'];
  /** The developer's own `knowledgeBase` prop. */
  knowledgeBase?: KnowledgeBaseConfig;
}

export function buildMCPRuntimeConfig(
  base: AgentConfig,
  ai: MCPProviderConfig,
  developer: MCPDeveloperOptions
): AgentConfig {
  return {
    ...base,
    apiKey: ai.apiKey,
    model: ai.model,
    proxyUrl: undefined,
    proxyHeaders: undefined,
    voiceProxyUrl: undefined,
    voiceProxyHeaders: undefined,
    outboundCalls: undefined,
    supportStyle: undefined,
    allowedActionNames: undefined,
    customTools: developer.customTools,
    instructions: developer.instructions,
    knowledgeBase: developer.knowledgeBase,
  };
}

/**
 * ProviderFactory — Creates the appropriate AI provider based on config.
 *
 * Centralizes provider instantiation so AIAgent.tsx doesn't need to
 * know about individual provider implementations.
 */

import type { AIProvider, AIProviderName } from '../core/types';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';

export function createProvider(
  provider: AIProviderName = 'gemini',
  apiKey?: string,
  model?: string,
  proxyUrl?: string,
  proxyHeaders?: Record<string, string>,
): AIProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(
        apiKey,
        model || 'gpt-4.1-mini',
        proxyUrl,
        proxyHeaders,
      );
    case 'gemini':
    default:
      return new GeminiProvider(
        apiKey,
        model || 'gemini-2.5-flash',
        proxyUrl,
        proxyHeaders,
      );
  }
}

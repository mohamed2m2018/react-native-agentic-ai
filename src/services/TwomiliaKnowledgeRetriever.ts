import type { KnowledgeRetriever } from '../core/types';
import { logger } from '../utils/logger';

export interface TwomiliaKnowledgeRetrieverOptions {
  analyticsKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  limit?: number;
}

function normalizeBaseUrl(baseUrl?: string) {
  if (!baseUrl) return 'https://twomilia.com';
  const trimmed = baseUrl.replace(/\/$/, '');
  return trimmed.endsWith('/api/v1/analytics')
    ? trimmed.replace(/\/api\/v1\/analytics$/, '')
    : trimmed;
}

export function createTwomiliaKnowledgeRetriever(
  options: TwomiliaKnowledgeRetrieverOptions
): KnowledgeRetriever {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const url = `${baseUrl}/api/v1/knowledge/query`;

  return {
    async retrieve(query, screenName) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.analyticsKey}`,
            ...(options.headers ?? {}),
          },
          body: JSON.stringify({
            query,
            screenName,
            limit: options.limit,
          }),
        });

        if (!response.ok) {
          logger.warn(
            'TwomiliaKnowledge',
            `Knowledge query failed: HTTP ${response.status}`
          );
          return [];
        }

        const payload = await response.json();
        return Array.isArray(payload?.entries) ? payload.entries : [];
      } catch (error: any) {
        logger.error(
          'TwomiliaKnowledge',
          `Knowledge query failed: ${error?.message ?? 'unknown error'}`
        );
        return [];
      }
    },
  };
}

import type { HelpTopic, HelpArticle } from './types';

export interface RankedTopic extends HelpTopic {
  isContextual: boolean;
}

export function rankTopics(
  topics: HelpTopic[],
  currentScreen: string
): RankedTopic[] {
  const contextual: RankedTopic[] = [];
  const rest: RankedTopic[] = [];

  for (const topic of topics) {
    const isContextual = topic.contextTrigger?.(currentScreen) ?? false;
    if (isContextual) {
      contextual.push({ ...topic, isContextual });
    } else {
      rest.push({ ...topic, isContextual });
    }
  }

  return [...contextual, ...rest];
}

export function searchArticles(
  topics: HelpTopic[],
  query: string
): Array<{ topic: HelpTopic; article: HelpArticle }> {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];

  const results: Array<{ topic: HelpTopic; article: HelpArticle }> = [];

  for (const topic of topics) {
    for (const article of topic.articles) {
      const haystack = [
        article.question,
        ...(article.tags ?? []),
        topic.label,
      ]
        .join(' ')
        .toLowerCase();

      if (haystack.includes(lower)) {
        results.push({ topic, article });
      }
    }
  }

  return results;
}

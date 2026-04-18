import {
  createAIMessage,
  normalizeExecutionResult,
  normalizeRichContent,
  richContentToPlainText,
} from '../../core/richContent';

describe('richContent helpers', () => {
  it('wraps legacy strings as text nodes', () => {
    expect(normalizeRichContent('hello')).toEqual([
      { type: 'text', content: 'hello', id: undefined },
    ]);
  });

  it('builds preview text from rich blocks', () => {
    const text = richContentToPlainText([
      {
        type: 'block',
        blockType: 'FactCard',
        id: 'fact-1',
        props: {
          title: 'Delivery',
          body: 'Arrives in 25 min',
        },
      },
    ]);

    expect(text).toContain('Delivery');
    expect(text).toContain('Arrives in 25 min');
  });

  it('creates AI messages with derived preview text', () => {
    const message = createAIMessage({
      id: 'assistant-1',
      role: 'assistant',
      content: 'hello there',
      timestamp: 123,
    });

    expect(message.previewText).toBe('hello there');
    expect(message.content[0]?.type).toBe('text');
  });

  it('normalizes execution results with rich replies', () => {
    const result = normalizeExecutionResult({
      success: true,
      message: 'fallback',
      reply: [
        {
          type: 'block',
          blockType: 'FactCard',
          id: 'fact-1',
          props: { title: 'Title', body: 'Body' },
        },
      ],
      steps: [],
    });

    expect(result.previewText).toContain('Title');
    expect(result.reply).toHaveLength(1);
  });
});

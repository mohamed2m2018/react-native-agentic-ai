/**
 * OpenAIProvider unit tests.
 *
 * Tests the raw fetch-based OpenAI implementation to ensure:
 * 1. Basic request building without screenshot
 * 2. Screenshot as image_url part
 * 3. Response parsing (tool call from choices[0].message.tool_calls)
 * 4. JSON parse error fallback to done
 * 5. HTTP error + network failure handling
 * 6. Model configuration defaults
 */

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { OpenAIProvider } from '../../providers/OpenAIProvider';
import type { ToolDefinition } from '../../core/types';

// ─── Helpers ───────────────────────────────────────────────────

const createSuccessResponse = (
  actionName: string,
  args: Record<string, any> = {},
  plan = 'test plan',
) => ({
  choices: [{
    message: {
      tool_calls: [{
        id: 'call_123',
        type: 'function',
        function: {
          name: 'agent_step',
          arguments: JSON.stringify({
            action_name: actionName,
            previous_goal_eval: 'Success',
            memory: 'test memory',
            plan,
            ...args,
          }),
        },
      }],
    },
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
});

const createProvider = (model = 'gpt-4.1-mini') =>
  new OpenAIProvider('test-api-key', model);

const sampleTools: ToolDefinition[] = [
  {
    name: 'tap',
    description: 'Tap an element',
    parameters: {
      index: { type: 'number', description: 'Element index', required: true },
    },
    execute: jest.fn(),
  },
  {
    name: 'done',
    description: 'Complete task',
    parameters: {
      text: { type: 'string', description: 'Result', required: true },
      success: { type: 'boolean', description: 'Success', required: true },
    },
    execute: jest.fn(),
  },
];

// ─── Tests ─────────────────────────────────────────────────────

describe('OpenAIProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('request building', () => {
    it('builds correct request without screenshot', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('done', { text: 'ok', success: true })),
      });

      const provider = createProvider();
      await provider.generateContent('system prompt', 'user message', sampleTools, []);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-4.1-mini');
      expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'user message' });
      expect(body.tool_choice).toBe('required');
    });

    it('includes screenshot as image_url part', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('done', { text: 'ok', success: true })),
      });

      const provider = createProvider();
      await provider.generateContent('sys', 'msg', sampleTools, [], 'base64screenshot');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = body.messages[1];
      expect(userMessage.content).toBeInstanceOf(Array);
      expect(userMessage.content[0]).toEqual({ type: 'text', text: 'msg' });
      expect(userMessage.content[1].type).toBe('image_url');
      expect(userMessage.content[1].image_url.url).toContain('base64screenshot');
    });
  });

  describe('response parsing', () => {
    it('parses tool call from choices[0].message.tool_calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('tap', { index: 3 }, 'Tap the button')),
      });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('tap');
      expect(result.toolCalls![0].args).toEqual({ index: 3 });
      expect(result.reasoning.plan).toBe('Tap the button');
      expect(result.reasoning.previousGoalEval).toBe('Success');
      expect(result.reasoning.memory).toBe('test memory');
    });

    it('falls back to done on JSON parse error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  name: 'agent_step',
                  arguments: 'INVALID JSON{{{',
                },
              }],
            },
          }],
        }),
      });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('done');
      expect(result.toolCalls![0].args.success).toBe(false);
    });

    it('falls back to done when no choices returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls![0].name).toBe('done');
    });
  });

  describe('error handling', () => {
    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      const provider = createProvider();
      await expect(
        provider.generateContent('sys', 'msg', sampleTools, [])
      ).rejects.toThrow('OpenAI API error 429');
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const provider = createProvider();
      await expect(
        provider.generateContent('sys', 'msg', sampleTools, [])
      ).rejects.toThrow('Network error');
    });
  });

  describe('configuration', () => {
    it('uses default model when not specified', () => {
      const provider = new OpenAIProvider('test-key');
      expect((provider as any).model).toBe('gpt-4.1-mini');
    });

    it('uses proxy URL when provided', () => {
      const provider = new OpenAIProvider(undefined, 'gpt-4.1-mini', 'https://proxy.com/api', { 'X-Auth': 'token' });
      expect((provider as any).baseUrl).toBe('https://proxy.com/api');
      expect((provider as any).headers['X-Auth']).toBe('token');
    });

    it('throws when neither apiKey nor proxyUrl provided', () => {
      expect(() => new OpenAIProvider()).toThrow('apiKey');
    });

    it('extracts token usage from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createSuccessResponse('done', { text: 'ok', success: true })),
      });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.promptTokens).toBe(100);
      expect(result.tokenUsage!.completionTokens).toBe(50);
      expect(result.tokenUsage!.totalTokens).toBe(150);
      expect(result.tokenUsage!.estimatedCostUSD).toBeGreaterThan(0);
    });
  });
});

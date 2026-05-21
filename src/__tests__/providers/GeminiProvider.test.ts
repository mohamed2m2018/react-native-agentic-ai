/**
 * GeminiProvider unit tests.
 *
 * Tests the @google/genai SDK implementation to ensure:
 * 1. Basic generateContent works with text-only
 * 2. Screenshot (inlineData) is appended when provided
 * 3. Tool declarations are built correctly
 * 4. Response parsing extracts action + reasoning
 * 5. Error handling works
 */

// Mock @google/genai SDK
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
  FunctionCallingConfigMode: { ANY: 'ANY' },
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
  },
}));

import { GeminiProvider } from '../../providers/GeminiProvider';
import type { ToolDefinition } from '../../core/types';

// ─── Helpers ───────────────────────────────────────────────────

const mockSuccessResponse = (actionName: string, args: Record<string, any> = {}, plan = 'test plan') => ({
  candidates: [{
    content: {
      parts: [{
        functionCall: {
          name: 'agent_step',
          args: {
            action_name: actionName,
            plan,
            previous_goal_eval: 'Success',
            memory: 'test memory',
            ...args,
          },
        },
      }],
    },
  }],
});

const createProvider = (model = 'gemini-2.5-flash') =>
  new GeminiProvider('test-api-key', model);

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
      text: { type: 'string', description: 'Result message', required: true },
      success: { type: 'boolean', description: 'Whether successful', required: true },
    },
    execute: jest.fn(),
  },
];

// ─── Tests ─────────────────────────────────────────────────────

describe('GeminiProvider', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  describe('generateContent — text-only mode', () => {
    it('sends correct SDK request without screenshot', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'Task done', success: true })
      );

      const provider = createProvider();
      await provider.generateContent('system prompt', 'user message', sampleTools, []);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const callArgs = mockGenerateContent.mock.calls[0][0];

      // Verify model
      expect(callArgs.model).toBe('gemini-2.5-flash');

      // Should have text-only parts (no inlineData)
      expect(callArgs.contents[0].parts).toHaveLength(1);
      expect(callArgs.contents[0].parts[0].text).toBe('user message');

      // System instruction
      expect(callArgs.config.systemInstruction).toBe('system prompt');

      // Tool config forces ANY mode
      expect(callArgs.config.toolConfig.functionCallingConfig.mode).toBe('ANY');
    });
  });

  describe('generateContent — with screenshot (vision)', () => {
    it('appends screenshot as inlineData JPEG part', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'I see a donut', success: true })
      );

      const provider = createProvider();
      const fakeScreenshot = 'base64encodedscreenshotdata';

      await provider.generateContent('system prompt', 'user message', sampleTools, [], fakeScreenshot);

      const callArgs = mockGenerateContent.mock.calls[0][0];

      // Should have 2 parts: text + inlineData
      expect(callArgs.contents[0].parts).toHaveLength(2);
      expect(callArgs.contents[0].parts[0].text).toBe('user message');
      expect(callArgs.contents[0].parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: fakeScreenshot,
      });
    });

    it('omits inlineData when screenshot is undefined', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'done', success: true })
      );

      const provider = createProvider();
      await provider.generateContent('sys', 'msg', sampleTools, [], undefined);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents[0].parts).toHaveLength(1);
    });
  });

  describe('response parsing', () => {
    it('extracts action_name + reasoning from agent_step', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('tap', { index: 3 }, 'Tap the pizza button')
      );

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('tap');
      expect(result.toolCalls[0].args).toEqual({ index: 3 });

      expect(result.reasoning.plan).toBe('Tap the pizza button');
      expect(result.reasoning.previousGoalEval).toBe('Success');
      expect(result.reasoning.memory).toBe('test memory');
    });

    it('falls back to done when no candidates', async () => {
      mockGenerateContent.mockResolvedValueOnce({ candidates: [] });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls[0].name).toBe('done');
      expect(result.toolCalls[0].args.success).toBe(false);
    });

    it('falls back to done when no function call in response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{ content: { parts: [{ text: 'Some text response' }] } }],
      });

      const provider = createProvider();
      const result = await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(result.toolCalls[0].name).toBe('done');
      expect(result.text).toBe('Some text response');
    });
  });

  describe('tool declaration building', () => {
    it('builds agent_step with correct action_name enum', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'ok', success: true })
      );

      const provider = createProvider();
      await provider.generateContent('sys', 'msg', sampleTools, []);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const agentStep = callArgs.config.tools[0].functionDeclarations[0];

      expect(agentStep.name).toBe('agent_step');

      // action_name should have enum of tool names
      expect(agentStep.parameters.properties.action_name.enum).toEqual(['tap', 'done']);

      // Reasoning fields should be present
      expect(agentStep.parameters.properties.plan).toBeDefined();
      expect(agentStep.parameters.properties.previous_goal_eval).toBeDefined();
      expect(agentStep.parameters.properties.memory).toBeDefined();

      // Tool params should be flattened into properties
      expect(agentStep.parameters.properties.index).toBeDefined();
      expect(agentStep.parameters.properties.text).toBeDefined();
      expect(agentStep.parameters.properties.success).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws on SDK error with status', async () => {
      const apiError = new Error('Rate limited');
      (apiError as any).status = 429;
      mockGenerateContent.mockRejectedValueOnce(apiError);

      const provider = createProvider();
      await expect(
        provider.generateContent('sys', 'msg', sampleTools, [])
      ).rejects.toThrow('Gemini API error 429');
    });

    it('throws on network failure', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Network offline'));

      const provider = createProvider();
      await expect(
        provider.generateContent('sys', 'msg', sampleTools, [])
      ).rejects.toThrow('Network offline');
    });
  });

  describe('model configuration', () => {
    it('uses custom model', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'ok', success: true })
      );

      const provider = createProvider('gemini-2.0-flash');
      await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(mockGenerateContent.mock.calls[0][0].model).toBe('gemini-2.0-flash');
    });

    it('defaults to gemini-2.5-flash', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        mockSuccessResponse('done', { text: 'ok', success: true })
      );

      const provider = new GeminiProvider('key');
      await provider.generateContent('sys', 'msg', sampleTools, []);

      expect(mockGenerateContent.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    });
  });
});

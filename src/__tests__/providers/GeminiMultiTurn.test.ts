/**
 * Gemini multi-turn replay: prior steps become functionCall/functionResponse
 * turns carrying the model's thoughtSignature (Gemini 3.x continuity).
 */
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { GeminiProvider } from '../../providers/GeminiProvider';
import type { AgentStep } from '../../core/types';

const build = (history: AgentStep[], screenshot?: string) =>
  (new GeminiProvider('test-key') as any).buildContents('CURRENT SCREEN', history, screenshot);

const step = (overrides: Partial<AgentStep> = {}): AgentStep => ({
  stepIndex: 0,
  reflection: { previousGoalEval: '', memory: '', plan: '' } as any,
  action: { name: 'tap', input: { index: 1 }, output: '✅ Tapped' },
  userTurnText: 'FIRST SCREEN',
  modelArgs: { action_name: 'tap', action_input: { index: 1 } },
  thoughtSignature: 'sig-1',
  ...overrides,
});

describe('GeminiProvider multi-turn replay', () => {
  it('sends a single user turn when there is no replayable history', () => {
    const contents = build([], 'base64img');
    expect(contents).toHaveLength(1);
    expect(contents[0].role).toBe('user');
    expect(contents[0].parts[0]).toEqual({ text: 'CURRENT SCREEN' });
    expect(contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'base64img' } });
  });

  it('replays steps as functionCall + functionResponse with the thought signature', () => {
    const contents = build([step(), step({ stepIndex: 1, thoughtSignature: undefined, action: { name: 'scroll', input: {}, output: '✅ Scrolled' } })]);

    expect(contents.map((c: any) => c.role)).toEqual(['user', 'model', 'user', 'model', 'user', 'user']);
    expect(contents[0].parts[0].text).toBe('FIRST SCREEN');
    expect(contents[1].parts[0]).toEqual({
      functionCall: { name: 'agent_step', args: { action_name: 'tap', action_input: { index: 1 } } },
      thoughtSignature: 'sig-1',
    });
    expect(contents[2].parts[0].functionResponse.response).toEqual({ result: '✅ Tapped' });
    expect(contents[3].parts[0].thoughtSignature).toBeUndefined();
    expect(contents[5].parts[0]).toEqual({ text: 'CURRENT SCREEN' });
  });

  it('skips steps without replay data (e.g. history from before this version)', () => {
    const contents = build([step({ modelArgs: undefined })]);
    expect(contents).toHaveLength(1);
  });
});

/**
 * typeTool tests.
 *
 * Covers: onChangeText call, non-text-input error, element not found.
 */

import { createTypeTool } from '../../tools/typeTool';
import type { ToolContext } from '../../tools/types';

jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn(),
}));

import { walkFiberTree } from '../../core/FiberTreeWalker';
const mockWalkFiberTree = walkFiberTree as jest.MockedFunction<typeof walkFiberTree>;

function createMockContext(): ToolContext {
  return {
    rootRef: {},
    getWalkConfig: () => ({}),
    getCurrentScreenName: () => 'TestScreen',
  };
}

describe('typeTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onChangeText with the provided text', async () => {
    const onChangeText = jest.fn();
    const elements = [
      { index: 0, type: 'text-input' as const, label: 'Email', props: { onChangeText }, fiberNode: {} },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTypeTool(createMockContext());
    const result = await tool.execute({ index: 0, text: 'user@example.com' });

    expect(onChangeText).toHaveBeenCalledWith('user@example.com');
    expect(result).toContain('✅');
    expect(result).toContain('user@example.com');
  });

  it('returns error for non-text-input element', async () => {
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Submit', props: {}, fiberNode: {} },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTypeTool(createMockContext());
    const result = await tool.execute({ index: 0, text: 'hello' });

    expect(result).toContain('❌');
    expect(result).toContain('not a text input');
  });

  it('returns error when element index not found', async () => {
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: [] });

    const tool = createTypeTool(createMockContext());
    const result = await tool.execute({ index: 99, text: 'hello' });

    expect(result).toContain('❌');
    expect(result).toContain('not found');
  });
});

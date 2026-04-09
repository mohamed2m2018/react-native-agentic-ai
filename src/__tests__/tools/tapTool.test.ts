/**
 * tapTool tests.
 *
 * Covers: direct onPress, switch toggle, radio selection, bubble-up, element not found, no handler.
 */

import { createTapTool } from '../../tools/tapTool';
import type { ToolContext } from '../../tools/types';

// ─── Mock Context Factory ──────────────────────────────────────

function createMockContext(): ToolContext {
  return {
    getRootRef: () => ({}),
    getWalkConfig: () => ({}),
    getCurrentScreenName: () => 'TestScreen',
  };
}

// Mock FiberTreeWalker to return controlled elements
jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn(),
}));

import { walkFiberTree } from '../../core/FiberTreeWalker';
const mockWalkFiberTree = walkFiberTree as jest.MockedFunction<typeof walkFiberTree>;

describe('tapTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onPress on a pressable element and returns success', async () => {
    const onPress = jest.fn();
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Add to Cart', props: { onPress }, fiberNode: {} },
    ];
    // First call: pre-tap walk. Second call: post-tap verification walk
    mockWalkFiberTree
      .mockReturnValueOnce({ elementsText: '', interactives: elements })
      .mockReturnValueOnce({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(result).toContain('✅');
    expect(result).toContain('Add to Cart');
  });

  it('toggles a switch via onValueChange', async () => {
    const onValueChange = jest.fn();
    const elements = [
      { index: 0, type: 'switch' as const, label: 'Notifications', props: { onValueChange, value: false }, fiberNode: {} },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(result).toContain('✅');
    expect(result).toContain('Toggled');
  });

  it('selects a radio item via its own onPress handler', async () => {
    const onPress = jest.fn();
    const elements = [
      { index: 0, type: 'radio' as const, label: 'English', props: { onPress, checked: false, value: 'en' }, fiberNode: {} },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(result).toContain('✅');
    expect(result).toContain('Selected');
  });

  it('selects a radio item through a parent group onValueChange using the item value', async () => {
    const onValueChange = jest.fn();
    const parentFiber = { memoizedProps: { onValueChange }, return: null };
    const elements = [
      { index: 0, type: 'radio' as const, label: 'Arabic', props: { value: 'ar', checked: false }, fiberNode: { return: parentFiber } },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(onValueChange).toHaveBeenCalledWith('ar');
    expect(result).toContain('✅');
    expect(result).toContain('parent group');
  });

  it('returns error when element index not found', async () => {
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Button', props: {}, fiberNode: {} },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 5 });

    expect(result).toContain('❌');
    expect(result).toContain('not found');
    expect(result).toContain('0'); // Available indexes
  });

  it('bubbles up fiber tree to find parent onPress', async () => {
    const parentOnPress = jest.fn();
    const parentFiber = { memoizedProps: { onPress: parentOnPress }, return: null };
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Icon', props: {}, fiberNode: { return: parentFiber } },
    ];
    // Pre-tap walk
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(parentOnPress).toHaveBeenCalledTimes(1);
    expect(result).toContain('✅');
    expect(result).toContain('parent');
  });

  it('returns error when no tap handler found', async () => {
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Dead Button', props: {}, fiberNode: { return: null } },
    ];
    mockWalkFiberTree.mockReturnValue({ elementsText: '', interactives: elements });

    const tool = createTapTool(createMockContext());
    const result = await tool.execute({ index: 0 });

    expect(result).toContain('❌');
    expect(result).toContain('no tap handler');
  });
});

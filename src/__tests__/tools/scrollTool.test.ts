/**
 * scrollTool tests.
 *
 * Covers: no container, PagerView rejection, edge detection, successful scroll.
 */

import { createScrollTool } from '../../tools/scrollTool';
import type { ToolContext } from '../../tools/types';

jest.mock('../../core/FiberTreeWalker', () => ({
  findScrollableContainers: jest.fn(),
}));

import { findScrollableContainers } from '../../core/FiberTreeWalker';
const mockFindContainers = findScrollableContainers as jest.MockedFunction<typeof findScrollableContainers>;

function createMockContext(): ToolContext {
  return {
    getRootRef: () => ({}),
    getWalkConfig: () => ({}),
    getCurrentScreenName: () => 'TestScreen',
  };
}

describe('scrollTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns error when no scrollable containers found', async () => {
    mockFindContainers.mockReturnValue([]);

    const tool = createScrollTool(createMockContext());
    const result = await tool.execute({ direction: 'down' });

    expect(result).toContain('❌');
    expect(result).toContain('No scrollable container');
  });

  it('rejects PagerView/TabView containers with descriptive message', async () => {
    mockFindContainers.mockReturnValue([
      {
        index: 0,
        componentName: 'RNCViewPager',
        label: 'Categories',
        fiberNode: {},
        stateNode: {},
        isPagerLike: true,
      },
    ]);

    const tool = createScrollTool(createMockContext());
    const result = await tool.execute({ direction: 'down' });

    expect(result).toContain('⚠️');
    expect(result).toContain('RNCViewPager');
    expect(result).toContain('tab/page container');
  });

  it('warns when already at bottom edge', async () => {
    mockFindContainers.mockReturnValue([
      {
        index: 0,
        componentName: 'FlatList',
        label: 'MenuList',
        fiberNode: {},
        stateNode: {
          scrollToOffset: jest.fn(),
          _scrollMetrics: { offset: 900, contentLength: 1000, visibleLength: 800 },
        },
        isPagerLike: false,
      },
    ]);

    const tool = createScrollTool(createMockContext());
    const result = await tool.execute({ direction: 'down' });

    expect(result).toContain('⚠️');
    expect(result).toContain('Already at the bottom');
  });

  it('scrolls successfully and returns confirmation', async () => {
    const metrics = { offset: 0, contentLength: 2000, visibleLength: 800 };
    const scrollToOffset = jest.fn().mockImplementation(({ offset }: { offset: number }) => {
      // Simulate actual scroll — update metrics so post-scroll check sees movement
      metrics.offset = offset;
    });
    mockFindContainers.mockReturnValue([
      {
        index: 0,
        componentName: 'FlatList',
        label: 'MenuList',
        fiberNode: {},
        stateNode: {
          scrollToOffset,
          _scrollMetrics: metrics,
        },
        isPagerLike: false,
      },
    ]);

    const tool = createScrollTool(createMockContext());
    const result = await tool.execute({ direction: 'down' });

    expect(scrollToOffset).toHaveBeenCalled();
    expect(result).toContain('✅');
    expect(result).toContain('Scrolled');
  });
});

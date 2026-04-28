import { createScrollTool } from '../../tools/scrollTool';
import type { ToolContext } from '../../tools/types';

function createMockContext(): ToolContext {
  return {
    platformAdapter: {
      getScreenSnapshot: jest.fn(),
      getNavigationSnapshot: jest.fn(),
      getLastScreenSnapshot: jest.fn(),
      captureScreenshot: jest.fn(),
      executeAction: jest.fn().mockResolvedValue('✅ Scrolled down'),
    },
  };
}

describe('scrollTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates scroll intents to the platform adapter', async () => {
    const context = createMockContext();
    const tool = createScrollTool(context);

    const result = await tool.execute({ direction: 'down', amount: 'page', containerIndex: 1 });

    expect(context.platformAdapter.executeAction).toHaveBeenCalledWith({
      type: 'scroll',
      direction: 'down',
      amount: 'page',
      containerIndex: 1,
    });
    expect(result).toContain('✅');
  });
});

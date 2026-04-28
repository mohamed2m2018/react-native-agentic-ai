import { createTapTool } from '../../tools/tapTool';
import type { ToolContext } from '../../tools/types';

function createMockContext(): ToolContext {
  return {
    platformAdapter: {
      getScreenSnapshot: jest.fn(),
      getNavigationSnapshot: jest.fn(),
      getLastScreenSnapshot: jest.fn(),
      captureScreenshot: jest.fn(),
      executeAction: jest.fn().mockResolvedValue('✅ Tapped [0] "Add to Cart"'),
    },
  };
}

describe('tapTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates tap intents to the platform adapter', async () => {
    const context = createMockContext();
    const tool = createTapTool(context);

    const result = await tool.execute({ index: 3 });

    expect(context.platformAdapter.executeAction).toHaveBeenCalledWith({
      type: 'tap',
      index: 3,
    });
    expect(result).toContain('✅');
  });
});

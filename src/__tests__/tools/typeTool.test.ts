import { createTypeTool } from '../../tools/typeTool';
import type { ToolContext } from '../../tools/types';

function createMockContext(): ToolContext {
  return {
    platformAdapter: {
      getScreenSnapshot: jest.fn(),
      getNavigationSnapshot: jest.fn(),
      getLastScreenSnapshot: jest.fn(),
      captureScreenshot: jest.fn(),
      executeAction: jest.fn().mockResolvedValue('✅ Typed "user@example.com" into [0] "Email"'),
    },
  };
}

describe('typeTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates type intents to the platform adapter', async () => {
    const context = createMockContext();
    const tool = createTypeTool(context);

    const result = await tool.execute({ index: 0, text: 'user@example.com' });

    expect(context.platformAdapter.executeAction).toHaveBeenCalledWith({
      type: 'type',
      index: 0,
      text: 'user@example.com',
    });
    expect(result).toContain('✅');
  });
});

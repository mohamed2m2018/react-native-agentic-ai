import { createInjectCardTool } from '../../tools/injectCardTool';
import type { ToolContext } from '../../tools/types';

function createMockContext(): ToolContext {
  return {
    platformAdapter: {
      getScreenSnapshot: jest.fn(),
      getNavigationSnapshot: jest.fn(),
      getLastScreenSnapshot: jest.fn(),
      captureScreenshot: jest.fn(),
      executeAction: jest.fn().mockResolvedValue('✅ Injected "InfoCard" in zone "dish-detail-summary". inject_card() is deprecated; prefer render_block().'),
    },
  };
}

describe('injectCardTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates inject_card intents to the platform adapter', async () => {
    const context = createMockContext();
    const tool = createInjectCardTool(context);

    const result = await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
      props: JSON.stringify({ title: 'Free Delivery' }),
    });

    expect(context.platformAdapter.executeAction).toHaveBeenCalledWith({
      type: 'inject_card',
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
      props: JSON.stringify({ title: 'Free Delivery' }),
    });
    expect(result).toContain('deprecated');
  });
});

import { createRenderBlockTool } from '../../tools/renderBlockTool';
import type { ToolContext } from '../../tools/types';

function createMockContext(): ToolContext {
  return {
    platformAdapter: {
      getScreenSnapshot: jest.fn(),
      getNavigationSnapshot: jest.fn(),
      getLastScreenSnapshot: jest.fn(),
      captureScreenshot: jest.fn(),
      executeAction: jest.fn().mockResolvedValue('✅ Rendered "FactCard" in zone "checkout-zone".'),
    },
  };
}

describe('renderBlockTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates render_block intents to the platform adapter', async () => {
    const context = createMockContext();
    const tool = createRenderBlockTool(context);

    const result = await tool.execute({
      zoneId: 'checkout-zone',
      blockType: 'FactCard',
      props: JSON.stringify({ title: 'Delivery', body: 'Arrives in 25 min' }),
      lifecycle: 'persistent',
    });

    expect(context.platformAdapter.executeAction).toHaveBeenCalledWith({
      type: 'render_block',
      zoneId: 'checkout-zone',
      blockType: 'FactCard',
      props: JSON.stringify({ title: 'Delivery', body: 'Arrives in 25 min' }),
      lifecycle: 'persistent',
    });
    expect(result).toContain('✅');
  });
});

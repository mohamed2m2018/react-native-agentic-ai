import React from 'react';
import { createRenderBlockTool } from '../../tools/renderBlockTool';

const mockIsActionAllowed = jest.fn();
const mockGet = jest.fn();

jest.mock('../../core/ZoneRegistry', () => ({
  globalZoneRegistry: {
    isActionAllowed: (...args: unknown[]) => mockIsActionAllowed(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

function FactCard() {
  return null;
}

describe('renderBlockTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an eligible block into an intervention-eligible zone', async () => {
    const renderBlock = jest.fn();
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      allowInjectBlock: true,
      interventionEligible: true,
      blocks: [
        {
          name: 'FactCard',
          component: FactCard,
          allowedPlacements: ['chat', 'zone'],
          interventionEligible: true,
          interventionType: 'contextual_help',
        },
      ],
      _controller: { renderBlock },
    });

    const tool = createRenderBlockTool();
    const result = await tool.execute({
      zoneId: 'checkout-zone',
      blockType: 'FactCard',
      props: JSON.stringify({ title: 'Delivery', body: 'Arrives in 25 min' }),
    });

    expect(result).toContain('✅');
    expect(renderBlock).toHaveBeenCalledTimes(1);
    expect(renderBlock.mock.calls[0][1]).toBe('dismissible');
  });

  it('rejects blocks that are not intervention eligible', async () => {
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      allowInjectBlock: true,
      interventionEligible: true,
      blocks: [
        {
          name: 'FactCard',
          component: FactCard,
          allowedPlacements: ['chat', 'zone'],
          interventionEligible: false,
          interventionType: 'none',
        },
      ],
      _controller: { renderBlock: jest.fn() },
    });

    const tool = createRenderBlockTool();
    const result = await tool.execute({
      zoneId: 'checkout-zone',
      blockType: 'FactCard',
      props: '{}',
    });

    expect(result).toContain('❌');
    expect(result).toContain('not eligible for screen intervention');
  });
});

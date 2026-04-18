import React from 'react';
import { createInjectCardTool } from '../../tools/injectCardTool';

const mockIsActionAllowed = jest.fn();
const mockGet = jest.fn();
const mockInfo = jest.fn();

jest.mock('../../core/ZoneRegistry', () => ({
  globalZoneRegistry: {
    isActionAllowed: (...args: unknown[]) => mockIsActionAllowed(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockInfo(...args),
  },
}));

function InfoCard() {
  return null;
}
InfoCard.displayName = 'InfoCard';

describe('injectCardTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects a whitelisted template into the zone', async () => {
    const injectCard = jest.fn();
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      templates: [InfoCard],
      _controller: { injectCard },
    });

    const tool = createInjectCardTool();
    const result = await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
      props: JSON.stringify({
        title: 'Free Delivery',
        body: 'Orders over $20 get free delivery.',
      }),
    });

    expect(result).toContain('✅');
    expect(injectCard).toHaveBeenCalledTimes(1);
    const injectedElement = injectCard.mock.calls[0][0];
    expect(injectedElement.type.displayName).toBe('InfoCard');
    expect(injectedElement.props).toMatchObject({
      title: 'Free Delivery',
      body: 'Orders over $20 get free delivery.',
    });
  });

  it('returns an error when the zone does not allow card injection', async () => {
    mockIsActionAllowed.mockReturnValue(false);

    const tool = createInjectCardTool();
    const result = await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
    });

    expect(result).toContain('❌');
    expect(result).toContain('allowInjectCard is false');
  });

  it('returns an error when the template is not registered', async () => {
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      templates: [InfoCard],
      _controller: { injectCard: jest.fn() },
    });

    const tool = createInjectCardTool();
    const result = await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'ReviewSummary',
    });

    expect(result).toContain('❌');
    expect(result).toContain('Template "ReviewSummary" is not registered');
    expect(result).toContain('InfoCard');
  });

  it('returns an error when props are invalid JSON', async () => {
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      templates: [InfoCard],
      _controller: { injectCard: jest.fn() },
    });

    const tool = createInjectCardTool();
    const result = await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
      props: '{"title":',
    });

    expect(result).toContain('❌');
    expect(result).toContain('Invalid props JSON');
  });

  it('sanitizes non-serializable props before injection', async () => {
    const injectCard = jest.fn();
    mockIsActionAllowed.mockReturnValue(true);
    mockGet.mockReturnValue({
      templates: [InfoCard],
      _controller: { injectCard },
    });

    const tool = createInjectCardTool();
    await tool.execute({
      zoneId: 'dish-detail-summary',
      templateName: 'InfoCard',
      props: {
        title: 'Safe Card',
        onPress: () => 'nope',
        nested: {
          body: 'hello',
          handler: () => 'nope',
        },
      },
    });

    const injectedElement = injectCard.mock.calls[0][0];
    expect(injectedElement.props).toEqual({
      title: 'Safe Card',
      nested: {
        body: 'hello',
      },
    });
  });
});

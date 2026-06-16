import { createOutboundCallTool } from '../../support/outboundCallTool';

describe('start_ai_call tool', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requires fresh approval metadata for the runtime safety gate', () => {
    const tool = createOutboundCallTool({
      analyticsKey: 'twomilia_pub_test',
    });

    expect(tool.name).toBe('start_ai_call');
    expect(tool.effect).toBe('support');
    expect(tool.requiresFreshApproval).toBe(true);
    expect(tool.description).toContain('trusted contact');
    expect(tool.description).toContain('Never provide or infer a phone number');
  });

  it('rejects phone-number-shaped target IDs before making a network request', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const tool = createOutboundCallTool({
      analyticsKey: 'twomilia_pub_test',
    });

    await expect(
      tool.execute({
        targetType: 'merchant',
        targetId: '+18166806230',
        reason: 'Order is stuck',
        callGoal: 'Get ETA',
        contextSummary: 'Customer is waiting',
      })
    ).resolves.toContain('targetId must be a semantic trusted-contact ID');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts an outbound call through the Twomilia backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'AI call started to Basil & Brick.',
        call: {
          id: 'call_123',
          status: 'queued',
          targetDisplayName: 'Basil & Brick',
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const tool = createOutboundCallTool({
      analyticsKey: 'twomilia_pub_test',
      getCurrentScreen: () => 'OrderDetails',
      userContext: { userId: 'user_1' },
    });

    const result = await tool.execute({
      targetType: 'merchant',
      targetId: 'restaurant_basil_brick',
      reason: 'Order is stuck',
      callGoal: 'Confirm pickup ETA',
      contextSummary: 'Order ord_1001 has not moved for 20 minutes.',
      urgency: 'urgent',
    });

    expect(result).toContain('AI_CALL_STARTED');
    expect(result).toContain('call_123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://twomilia.com/api/v1/outbound-calls',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer twomilia_pub_test',
        }),
      })
    );
  });
});

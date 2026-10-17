import fs from 'fs';
import path from 'path';

import { createEscalateTool } from '../../support/escalateTool';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const baseDeps = {
  getContext: () => ({
    currentScreen: 'BillingHistory',
    originalQuery: 'connect me to a human',
    stepsBeforeEscalation: 2,
  }),
  getHistory: () => [
    { role: 'user', content: 'I was charged twice' },
    { role: 'assistant', content: 'Let me check your billing history.' },
  ],
};

describe('human escalation policy', () => {
  it('does not keep a hidden keyword auto-escalation gate in AIAgent', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../components/AIAgent.tsx'),
      'utf8'
    );

    expect(source).not.toContain('HIGH_RISK_ESCALATION_REGEX');
    expect(source).not.toContain('FRUSTRATION_REGEX');
    expect(source).not.toContain('auto-escalating to human');
    expect(source).not.toContain('business_escalation');
  });

  it('hands off through onEscalate with the full context', async () => {
    const onEscalate = jest.fn();
    const tool = createEscalateTool({
      ...baseDeps,
      config: { onEscalate },
      getScreenFlow: () => ['Home', 'BillingHistory'],
      getToolCalls: () => [
        { name: 'tap', input: { index: 3 }, output: '✅ Tapped' },
      ],
      userContext: { userId: 'u1', email: 'a@example.com' },
    });

    await expect(
      tool.execute({
        reason: 'User explicitly asked for a human',
        handoffTriggerType: 'user_request',
      })
    ).resolves.toMatch(/^ESCALATED:/);

    expect(onEscalate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationSummary: 'User explicitly asked for a human',
        currentScreen: 'BillingHistory',
        originalQuery: 'connect me to a human',
        stepsBeforeEscalation: 2,
        handoffTriggerType: 'user_request',
        history: baseDeps.getHistory(),
        screenFlow: ['Home', 'BillingHistory'],
        toolCalls: [{ name: 'tap', input: { index: 3 }, output: '✅ Tapped' }],
        userContext: { userId: 'u1', email: 'a@example.com' },
        device: expect.objectContaining({ platform: expect.any(String) }),
      })
    );
  });

  it('tells the agent human support is unavailable when onEscalate is missing', async () => {
    const tool = createEscalateTool({ ...baseDeps, config: {} });
    const result = await tool.execute({ reason: 'needs a human' });
    expect(result).not.toMatch(/^ESCALATED:/);
    expect(result).toContain('not available');
  });

  it('reports a failed handoff when onEscalate throws', async () => {
    const tool = createEscalateTool({
      ...baseDeps,
      config: { onEscalate: () => Promise.reject(new Error('widget offline')) },
    });
    const result = await tool.execute({ reason: 'needs a human' });
    expect(result).not.toMatch(/^ESCALATED:/);
    expect(result).toContain('failed');
  });

  it('documents billing and order issues as investigation-first, not escalation-first', () => {
    const escalateTool = createEscalateTool({ ...baseDeps, config: {} });
    expect(escalateTool.description).toContain('investigate first');
    expect(escalateTool.description).toContain(
      'billing, payment, charges, refunds, or order problems'
    );
  });
});

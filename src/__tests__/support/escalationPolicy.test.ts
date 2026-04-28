import fs from 'fs';
import path from 'path';

import { createEscalateTool } from '../../support/escalateTool';
import { createReportIssueTool } from '../../support/reportIssueTool';

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

  it('keeps explicit human escalation available', async () => {
    const onEscalate = jest.fn();
    const tool = createEscalateTool({
      config: {
        provider: 'custom',
        onEscalate,
      },
      getContext: () => ({
        currentScreen: 'BillingHistory',
        originalQuery: 'connect me to a human',
        stepsBeforeEscalation: 2,
      }),
      getHistory: () => [],
    });

    await expect(
      tool.execute({ reason: 'User explicitly asked for a human' })
    ).resolves.toMatch(/^ESCALATED:/);

    expect(onEscalate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationSummary: 'User explicitly asked for a human',
        currentScreen: 'BillingHistory',
      })
    );
  });

  it('documents billing and order issues as investigation-first, not escalation-first', () => {
    const escalateTool = createEscalateTool({
      config: { provider: 'custom' },
      getContext: () => ({
        currentScreen: 'BillingHistory',
        originalQuery: '',
        stepsBeforeEscalation: 0,
      }),
      getHistory: () => [],
    });
    const reportIssueTool = createReportIssueTool({
      analyticsKey: 'mobileai_pub_test',
      getCurrentScreen: () => 'BillingHistory',
      getHistory: () => [],
    });

    expect(escalateTool.description).toContain('investigate first');
    expect(escalateTool.description).toContain(
      'billing, payment, charges, refunds, or order problems'
    );
    expect(reportIssueTool?.description).toContain(
      'cannot investigate or resolve with available tools'
    );
  });
});

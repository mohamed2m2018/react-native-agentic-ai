import type { ToolDefinition } from '../core/types';
import {
  DEFAULT_OUTBOUND_CALL_TARGET_TYPES,
  startOutboundAiCall,
} from '../services/OutboundCallService';
import type { OutboundCallConfig } from '../services/OutboundCallService';

export interface OutboundCallToolDeps {
  analyticsKey: string;
  config?: OutboundCallConfig;
  getCurrentScreen?: () => string;
  getHistory?: () => Array<{ role: string; content: string }>;
  userContext?: Record<string, unknown>;
}

function summarizeRecentHistory(history: Array<{ role: string; content: string }>) {
  return history
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n')
    .slice(0, 3000);
}

export function createOutboundCallTool(deps: OutboundCallToolDeps): ToolDefinition {
  const allowedTargetTypes =
    deps.config?.allowedTargetTypes?.length
      ? deps.config.allowedTargetTypes
      : [...DEFAULT_OUTBOUND_CALL_TARGET_TYPES];

  return {
    name: 'start_ai_call',
    effect: 'support',
    requiresFreshApproval: true,
    description:
      'Start an outbound AI phone call from the company-owned MobileAI phone number to a trusted contact configured in the dashboard. ' +
      'Use this only after investigating the issue and deciding a real human/vendor/partner phone call is needed, such as a stuck order, delivery coordination, appointment confirmation, booking partner follow-up, billing/fraud escalation, or external vendor status check. ' +
      'Never provide or infer a phone number; pass only targetType and targetId so MobileAI can look up the trusted contact. This tool requires explicit user approval before dialing.',
    parameters: {
      targetType: {
        type: 'string',
        description: 'Trusted contact category configured in MobileAI.',
        enum: allowedTargetTypes,
        required: true,
      },
      targetId: {
        type: 'string',
        description: 'Stable app/business ID for the trusted contact. Do not send a phone number.',
        required: true,
      },
      reason: {
        type: 'string',
        description: 'Brief reason the call is needed.',
        required: true,
      },
      callGoal: {
        type: 'string',
        description: 'Specific outcome the AI caller should try to get from the external party.',
        required: true,
      },
      contextSummary: {
        type: 'string',
        description: 'Important context to give the AI caller before dialing.',
        required: true,
      },
      urgency: {
        type: 'string',
        description: 'Call urgency.',
        enum: ['normal', 'urgent'],
        required: false,
      },
    },
    execute: async (args) => {
      const targetId = String(args.targetId ?? '').trim();
      if (/^\+?[1-9]\d{7,14}$/.test(targetId)) {
        return '❌ start_ai_call rejected: targetId must be a semantic trusted-contact ID, not a phone number.';
      }

      const contextFromHistory = summarizeRecentHistory(deps.getHistory?.() ?? []);
      const result = await startOutboundAiCall({
        analyticsKey: deps.analyticsKey,
        config: deps.config,
        currentScreen: deps.getCurrentScreen?.(),
        userContext: deps.userContext,
        request: {
          targetType: String(args.targetType ?? '').trim(),
          targetId,
          reason: String(args.reason ?? '').trim(),
          callGoal: String(args.callGoal ?? '').trim(),
          contextSummary:
            String(args.contextSummary ?? '').trim() ||
            contextFromHistory ||
            'No additional conversation context was provided.',
          urgency: args.urgency === 'urgent' ? 'urgent' : 'normal',
        },
      });

      if (!result.ok) {
        return `❌ Outbound AI call could not start: ${result.error || 'Unknown error'}. Fall back to human escalation or messaging.`;
      }

      return [
        'AI_CALL_STARTED',
        `Call ID: ${result.callId ?? 'unknown'}`,
        `Status: ${result.status ?? 'started'}`,
        `Target: ${result.targetDisplayName ?? targetId}`,
        result.message ? `Message: ${result.message}` : '',
        'Continue helping the user; call transcript and outcome will appear in the MobileAI dashboard.',
      ].filter(Boolean).join('\n');
    },
  };
}

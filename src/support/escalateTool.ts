/**
 * Escalate tool — hands off the conversation to a human agent.
 *
 * Providers:
 * - 'mobileai' (default when analyticsKey present):
 *   POSTs to MobileAI /api/v1/escalations → gets ticketId + wsUrl
 *   Opens WebSocket via EscalationSocket → agent reply pushed in real time
 * - 'custom': fires the consumer's onEscalate callback (backward compatible)
 */

import type { ToolDefinition } from '../core/types';
import type { EscalationConfig, EscalationContext } from './types';
import { EscalationSocket } from './EscalationSocket';

const MOBILEAI_HOST = 'https://api.mobileai.dev';

export interface EscalationToolDeps {
  config: EscalationConfig;
  analyticsKey?: string;
  getContext: () => Omit<EscalationContext, 'conversationSummary'>;
  getHistory: () => Array<{ role: string; content: string }>;
  onHumanReply?: (reply: string) => void;
}

export function createEscalateTool(deps: EscalationToolDeps): ToolDefinition;
/** @deprecated Use createEscalateTool({ config, analyticsKey, getContext, getHistory }) */
export function createEscalateTool(
  config: EscalationConfig,
  getContext: () => Omit<EscalationContext, 'conversationSummary'>
): ToolDefinition;
export function createEscalateTool(
  depsOrConfig: EscalationToolDeps | EscalationConfig,
  legacyGetContext?: () => Omit<EscalationContext, 'conversationSummary'>
): ToolDefinition {
  // Normalise both call signatures
  let deps: EscalationToolDeps;
  if (legacyGetContext) {
    deps = {
      config: depsOrConfig as EscalationConfig,
      getContext: legacyGetContext,
      getHistory: () => [],
    };
  } else {
    deps = depsOrConfig as EscalationToolDeps;
  }

  const { config, analyticsKey, getContext, getHistory, onHumanReply } = deps;

  // Determine effective provider
  const provider = config.provider ?? (analyticsKey ? 'mobileai' : 'custom');

  // Socket instance kept here — one per tool instance
  let socket: EscalationSocket | null = null;

  return {
    name: 'escalate_to_human',
    description:
      'Hand off the conversation to a human support agent. ' +
      'Use this when: (1) the user explicitly asks for a human, ' +
      '(2) you cannot resolve the issue after multiple attempts, or ' +
      '(3) the topic requires human judgment (billing disputes, account issues).',
    parameters: {
      reason: {
        type: 'string',
        description: 'Brief summary of why escalation is needed and what has been tried',
        required: true,
      },
    },
    execute: async (args: Record<string, unknown>) => {
      const reason = String(args.reason ?? 'User requested human support');
      const context = getContext();

      if (provider === 'mobileai') {
        if (!analyticsKey) {
          console.warn('[Escalation] provider=mobileai but no analyticsKey — falling back to custom');
        } else {
          try {
            const history = getHistory().slice(-20); // last 20 messages for context
            const res = await fetch(`${MOBILEAI_HOST}/api/v1/escalations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                analyticsKey,
                reason,
                screen: context.currentScreen,
                history,
                stepsBeforeEscalation: context.stepsBeforeEscalation,
              }),
            });

            if (res.ok) {
              const { ticketId, wsUrl } = await res.json();
              console.log(`[Escalation] Ticket created: ${ticketId}`);

              // Connect WebSocket for real-time reply
              socket?.disconnect();
              socket = new EscalationSocket({
                onReply: (reply) => {
                  console.log(`[Escalation] Human reply received for ticket ${ticketId}`);
                  onHumanReply?.(reply);
                  socket?.disconnect();
                  socket = null;
                },
                onError: (err) => {
                  console.error('[Escalation] WebSocket error:', err);
                },
              });
              socket.connect(wsUrl);
            } else {
              console.error('[Escalation] Failed to create ticket:', res.status);
            }
          } catch (err) {
            console.error('[Escalation] Network error:', (err as Error).message);
          }

          const message = config.escalationMessage ?? 'Connecting you to a human agent...';
          return `ESCALATED: ${message}`;
        }
      }

      // 'custom' provider — fire callback
      const escalationContext: EscalationContext = {
        conversationSummary: reason,
        currentScreen: context.currentScreen,
        originalQuery: context.originalQuery,
        stepsBeforeEscalation: context.stepsBeforeEscalation,
      };
      config.onEscalate?.(escalationContext);

      const message = config.escalationMessage ?? 'Connecting you to a human agent...';
      return `ESCALATED: ${message}`;
    },
  };
}

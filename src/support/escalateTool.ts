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

import { ENDPOINTS } from '../config/endpoints';
import { getDeviceId } from '../services/telemetry/device';
import { getDeviceMetadata } from '../services/telemetry/deviceMetadata';
import { logger } from '../utils/logger';

const MOBILEAI_HOST = ENDPOINTS.escalation;

export interface EscalationToolDeps {
  config: EscalationConfig;
  analyticsKey?: string;
  getContext: () => Omit<EscalationContext, 'conversationSummary'>;
  getHistory: () => Array<{ role: string; content: string }>;
  getToolCalls?: () => Array<{ name: string; input: Record<string, unknown>; output: string }>;
  getScreenFlow?: () => string[];
  onHumanReply?: (reply: string, ticketId?: string) => void;
  onEscalationStarted?: (ticketId: string, socket: EscalationSocket) => void;
  onTypingChange?: (isTyping: boolean) => void;
  onTicketClosed?: (ticketId?: string) => void;
  userContext?: {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    plan?: string;
    custom?: Record<string, string | number | boolean>;
  };
  pushToken?: string;
  pushTokenType?: 'fcm' | 'expo' | 'apns';
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

  const { config, analyticsKey, getContext, getHistory, getToolCalls, onHumanReply, onEscalationStarted, onTypingChange, onTicketClosed, userContext, pushToken, pushTokenType, getScreenFlow } = deps;

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
          logger.warn('Escalation', 'provider=mobileai but no analyticsKey — falling back to custom');
        } else {
          try {
            const history = getHistory().slice(-20); // last 20 messages for context
            logger.info('Escalation', '★★★ Creating ticket — reason:', reason, '| deviceId:', getDeviceId());
            const res = await fetch(`${MOBILEAI_HOST}/api/v1/escalations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                analyticsKey,
                reason,
                screen: context.currentScreen,
                history,
                stepsBeforeEscalation: context.stepsBeforeEscalation,
                userContext: {
                  ...userContext,
                  device: getDeviceMetadata(),
                },
                screenFlow: getScreenFlow?.() ?? [],
                toolCalls: getToolCalls?.() ?? [],
                pushToken,
                pushTokenType,
                deviceId: getDeviceId(),
              }),
            });

            if (res.ok) {
              const { ticketId, wsUrl } = await res.json();
              logger.info('Escalation', '★★★ Ticket created:', ticketId, '| wsUrl:', wsUrl);

              // Connect WebSocket for real-time reply
              socket?.disconnect();
              socket = new EscalationSocket({
                onReply: (reply, replyTicketId) => {
                  logger.info('Escalation', '★★★ Human reply for ticket', ticketId, ':', reply.substring(0, 80));
                  onHumanReply?.(reply, replyTicketId || ticketId);
                },
                onTypingChange: (v) => {
                  logger.info('Escalation', '★★★ Agent typing:', v);
                  onTypingChange?.(v);
                },
                onTicketClosed: (closedTicketId) => {
                  logger.info('Escalation', '★★★ Ticket closed:', ticketId);
                  onTicketClosed?.(closedTicketId || ticketId);
                },
                onError: (err) => {
                  logger.error('Escalation', '★★★ WebSocket error:', err);
                },
              });
              socket.connect(wsUrl);
              logger.info('Escalation', '★★★ WebSocket connecting...');

              // Pass the socket to UI
              logger.info('Escalation', '★★★ Calling onEscalationStarted for ticket:', ticketId);
              onEscalationStarted?.(ticketId, socket);
              logger.info('Escalation', '★★★ onEscalationStarted DONE');
            } else {
              logger.error('Escalation', 'Failed to create ticket:', res.status);
            }
          } catch (err) {
            logger.error('Escalation', 'Network error:', (err as Error).message);
          }

          const message =
            config.escalationMessage ??
            "Your request has been sent to our support team. A human agent will reply here as soon as possible.";
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

      const message =
        config.escalationMessage ??
        "Your request has been sent to our support team. A human agent will reply here as soon as possible.";
      return `ESCALATED: ${message}`;
    },
  };
}

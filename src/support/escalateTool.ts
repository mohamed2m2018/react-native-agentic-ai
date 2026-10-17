/**
 * Escalate tool — hands the conversation to a human through the app's
 * `onEscalate` callback (Intercom, Zendesk, email, your own API, …).
 */

import type { ToolDefinition } from '../core/types';
import type {
  EscalationConfig,
  EscalationContext,
  EscalationUserContext,
} from './types';
import { getDeviceMetadata } from '../services/telemetry/deviceMetadata';
import { logger } from '../utils/logger';

const DEFAULT_ESCALATION_MESSAGE =
  'Your request has been sent to our support team. A human agent will reply as soon as possible.';
const HISTORY_LIMIT = 20;

export interface EscalationToolDeps {
  config: EscalationConfig;
  getContext: () => Pick<
    EscalationContext,
    'currentScreen' | 'originalQuery' | 'stepsBeforeEscalation'
  >;
  getHistory: () => Array<{ role: string; content: string }>;
  getToolCalls?: () => Array<{
    name: string;
    input: Record<string, unknown>;
    output: string;
  }>;
  getScreenFlow?: () => string[];
  userContext?: EscalationUserContext;
}

export function createEscalateTool(deps: EscalationToolDeps): ToolDefinition;
/** @deprecated Use createEscalateTool({ config, getContext, getHistory }) */
export function createEscalateTool(
  config: EscalationConfig,
  getContext: EscalationToolDeps['getContext']
): ToolDefinition;
export function createEscalateTool(
  depsOrConfig: EscalationToolDeps | EscalationConfig,
  legacyGetContext?: EscalationToolDeps['getContext']
): ToolDefinition {
  const deps: EscalationToolDeps = legacyGetContext
    ? {
        config: depsOrConfig as EscalationConfig,
        getContext: legacyGetContext,
        getHistory: () => [],
      }
    : (depsOrConfig as EscalationToolDeps);
  const {
    config,
    getContext,
    getHistory,
    getToolCalls,
    getScreenFlow,
    userContext,
  } = deps;

  return {
    name: 'escalate_to_human',
    description:
      'Hand off the conversation to a human support agent. ' +
      'Use this when: (1) the user explicitly asks for a human, ' +
      '(2) you have investigated with the available app data/tools and still cannot resolve the issue, or ' +
      '(3) direct customer follow-up or human judgment is required. ' +
      'Do not use this just because the user mentions billing, payment, charges, refunds, or order problems; investigate first.',
    parameters: {
      reason: {
        type: 'string',
        description:
          'Brief summary of why escalation is needed and what has been tried',
        required: true,
      },
      handoffTriggerType: {
        type: 'string',
        description:
          'What triggered the handoff (e.g. tool_call, user_request, auto)',
        required: false,
      },
    },
    execute: async (args: Record<string, unknown>) => {
      const reason = String(args.reason ?? 'User requested human support');
      const context = getContext();

      if (!config.onEscalate) {
        logger.warn(
          'Escalation',
          'escalate_to_human was called but supportMode.escalation.onEscalate is not set. ' +
            'Pass onEscalate to hand the conversation to your support tool.'
        );
        return 'Human support is not available in this app right now. Tell the user and offer to keep helping.';
      }

      const escalationContext: EscalationContext = {
        conversationSummary: reason,
        currentScreen: context.currentScreen,
        originalQuery: context.originalQuery,
        stepsBeforeEscalation: context.stepsBeforeEscalation,
        handoffTriggerType: String(args.handoffTriggerType ?? 'tool_call'),
        history: getHistory().slice(-HISTORY_LIMIT),
        screenFlow: getScreenFlow?.() ?? [],
        toolCalls: getToolCalls?.() ?? [],
        userContext,
        device: getDeviceMetadata(),
      };

      try {
        await config.onEscalate(escalationContext);
      } catch (err) {
        logger.error(
          'Escalation',
          `onEscalate threw: ${err instanceof Error ? err.message : String(err)}`
        );
        return 'The handoff to a human agent failed. Apologize to the user and offer to keep helping.';
      }

      return `ESCALATED: ${config.escalationMessage ?? DEFAULT_ESCALATION_MESSAGE}`;
    },
  };
}

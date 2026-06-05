/**
 * Escalate tool — hands off the conversation to a human agent.
 *
 * When the AI determines it cannot resolve the user's issue
 * (or when the user explicitly asks for a human), this tool
 * triggers the escalation callback with full conversation context.
 */

import type { ToolDefinition } from '../core/types';
import type { EscalationConfig, EscalationContext } from './types';

/**
 * Create the escalate_to_human tool.
 *
 * @param escalationConfig - Consumer's escalation configuration
 * @param getContext - Function that returns current conversation context
 */
export function createEscalateTool(
  escalationConfig: EscalationConfig,
  getContext: () => Omit<EscalationContext, 'conversationSummary'>
): ToolDefinition {
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
    execute: async (args: Record<string, any>) => {
      const context = getContext();

      const escalationContext: EscalationContext = {
        conversationSummary: String(args.reason ?? 'User requested human support'),
        currentScreen: context.currentScreen,
        originalQuery: context.originalQuery,
        stepsBeforeEscalation: context.stepsBeforeEscalation,
      };

      // Trigger the consumer's escalation callback
      escalationConfig.onEscalate(escalationContext);

      const message =
        escalationConfig.escalationMessage ??
        'Connecting you to a human agent...';

      return `ESCALATED: ${message}`;
    },
  };
}

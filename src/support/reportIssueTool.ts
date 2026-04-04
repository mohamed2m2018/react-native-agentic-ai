import type { ToolDefinition } from '../core/types';
import { ENDPOINTS } from '../config/endpoints';
import { getDeviceId } from '../services/telemetry/device';
import { logger } from '../utils/logger';
import type { ReportedIssueCustomerStatus } from './types';

const MOBILEAI_HOST = ENDPOINTS.escalation;

const DEFAULT_STATUS_MESSAGES: Record<ReportedIssueCustomerStatus, string> = {
  acknowledged: 'We’ve logged your issue and are reviewing it.',
  investigating: 'We’re checking this and will update you if needed.',
  answered: 'We reviewed your issue and confirmed what happened.',
  resolved: 'We found the issue and applied a fix.',
  escalated: 'A human support agent will reply here shortly.',
};

export interface ReportIssueToolDeps {
  analyticsKey?: string;
  getCurrentScreen: () => string;
  getHistory: () => Array<{ role: string; content: string }>;
  getScreenFlow?: () => string[];
  userContext?: {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    plan?: string;
    custom?: Record<string, string | number | boolean>;
  };
}

export function createReportIssueTool({
  analyticsKey,
  getCurrentScreen,
  getHistory,
  getScreenFlow,
  userContext,
}: ReportIssueToolDeps): ToolDefinition | null {
  if (!analyticsKey) return null;

  return {
    name: 'report_issue',
    description:
      'Create an AI-verified reported issue when the complaint is supported by app evidence you can already see or infer from the current UI flow. ' +
      'Use this for verified late orders, overcharges, broken subscription states, missing loyalty points, gift failures, notification mismatches, or account friction. ' +
      'Do not use it for anger alone. If you need customer follow-up, a sensitive explanation, or a human was explicitly requested, use escalate_to_human instead.',
    parameters: {
      issueType: {
        type: 'string',
        description:
          'Short issue type like late_order, overcharge, loyalty_points_missing, notification_mismatch',
        required: true,
      },
      complaintSummary: {
        type: 'string',
        description: 'One-sentence summary of the customer problem',
        required: true,
      },
      verificationStatus: {
        type: 'string',
        description: 'verified, likely_verified, or unverified',
        required: true,
      },
      severity: {
        type: 'string',
        description: 'low, medium, high, or critical',
        required: true,
      },
      confidence: {
        type: 'number',
        description: 'Confidence between 0 and 1',
        required: false,
      },
      evidenceSummary: {
        type: 'string',
        description: 'What app evidence supports the issue',
        required: true,
      },
      aiSummary: {
        type: 'string',
        description:
          'Short operator-facing summary of what you checked and found',
        required: true,
      },
      metadata: {
        type: 'string',
        description:
          'Optional JSON string with extra fields like recommendedAction, sourceScreens, orderId, chargeId, subscriptionId, giftId, customerStatus, customerMessage, confidence',
        required: false,
      },
    },
    execute: async (args) => {
      let metadata: Record<string, unknown> = {};
      if (
        typeof args.metadata === 'string' &&
        args.metadata.trim().length > 0
      ) {
        try {
          const parsed = JSON.parse(args.metadata);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            metadata = parsed as Record<string, unknown>;
          }
        } catch (error) {
          logger.warn(
            'ReportIssue',
            `Invalid metadata JSON: ${(error as Error).message}`
          );
        }
      }

      const status =
        typeof metadata.customerStatus === 'string' &&
        metadata.customerStatus in DEFAULT_STATUS_MESSAGES
          ? (metadata.customerStatus as ReportedIssueCustomerStatus)
          : 'acknowledged';
      const customerMessage =
        typeof metadata.customerMessage === 'string' &&
        metadata.customerMessage.trim().length > 0
          ? metadata.customerMessage.trim()
          : DEFAULT_STATUS_MESSAGES[status];

      const sourceScreens =
        typeof metadata.sourceScreens === 'string' &&
        metadata.sourceScreens.trim().length > 0
          ? metadata.sourceScreens
              .split(',')
              .map((screen) => screen.trim())
              .filter(Boolean)
          : [getCurrentScreen()];

      try {
        const res = await fetch(`${MOBILEAI_HOST}/api/v1/reported-issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analyticsKey,
            issueType: args.issueType,
            complaintSummary: args.complaintSummary,
            verificationStatus: args.verificationStatus,
            severity: args.severity,
            confidence:
              typeof metadata.confidence === 'number'
                ? metadata.confidence
                : undefined,
            screen: getCurrentScreen(),
            evidenceSummary: args.evidenceSummary,
            aiSummary: args.aiSummary,
            recommendedAction:
              typeof metadata.recommendedAction === 'string'
                ? metadata.recommendedAction
                : undefined,
            sourceScreens,
            screenFlow: getScreenFlow?.() ?? [],
            userContext,
            deviceId: getDeviceId(),
            orderId:
              typeof metadata.orderId === 'string'
                ? metadata.orderId
                : undefined,
            chargeId:
              typeof metadata.chargeId === 'string'
                ? metadata.chargeId
                : undefined,
            subscriptionId:
              typeof metadata.subscriptionId === 'string'
                ? metadata.subscriptionId
                : undefined,
            giftId:
              typeof metadata.giftId === 'string' ? metadata.giftId : undefined,
            customerStatus: status,
            customerMessage,
            history: getHistory().slice(-10),
          }),
        });

        if (!res.ok) {
          logger.warn(
            'ReportIssue',
            `Failed to create reported issue: ${res.status}`
          );
          return customerMessage;
        }

        const data = await res.json();
        logger.info('ReportIssue', 'Created reported issue', data.issueId);
        const firstHistoryId =
          Array.isArray(data.history) &&
          data.history[0] &&
          typeof data.history[0].id === 'string'
            ? data.history[0].id
            : '';
        return `ISSUE_REPORTED:${String(data.issueId)}:${firstHistoryId}:${customerMessage}`;
      } catch (error) {
        logger.error('ReportIssue', 'Network error:', (error as Error).message);
        return customerMessage;
      }
    },
  };
}

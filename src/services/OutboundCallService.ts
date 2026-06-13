import { ENDPOINTS } from '../config/endpoints';
import { getDeviceId, initDeviceId } from './telemetry/device';
import { getDeviceMetadata } from './telemetry/deviceMetadata';
import { logger } from '../utils/logger';
import {
  OutboundCallWatcher,
  type OutboundCallEvent,
  type OutboundCallTerminal,
} from '../support/OutboundCallWatcher';

export type { OutboundCallEvent, OutboundCallTerminal };

const LOG_TAG = 'OutboundCallService';

export const DEFAULT_OUTBOUND_CALL_TARGET_TYPES = [
  'merchant',
  'vendor',
  'carrier',
  'driver',
  'technician',
  'billing_team',
  'fraud_team',
  'external_partner',
] as const;

export type OutboundCallUrgency = 'normal' | 'urgent';

export type OutboundCallRequest = {
  targetType: string;
  targetId: string;
  reason: string;
  callGoal: string;
  contextSummary: string;
  urgency?: OutboundCallUrgency;
  linkedEscalationTicketId?: string;
  linkedReportedIssueId?: string;
};

export type StartOutboundCallResult = {
  ok: boolean;
  callId?: string;
  status?: string;
  targetDisplayName?: string;
  message?: string;
  error?: string;
};

export type OutboundCallConfig = {
  /** Default: true when analyticsKey is present. */
  enabled?: boolean;
  /** Optional MobileAI-compatible backend root. Defaults to https://mobileai.cloud. */
  proxyUrl?: string;
  /** Optional extra headers sent to the outbound-call endpoint. */
  headers?: Record<string, string>;
  /** Optional client-side target allowlist. Backend remains the source of truth. */
  allowedTargetTypes?: string[];
  /**
   * Optional live event callback. Fires for each transcript line, status change,
   * tool call, and the terminal completion. Useful to surface real-time call
   * progress in the host UI while the agent is blocked on the tool result.
   */
  onCallEvent?: (event: OutboundCallEvent) => void;
  /** Hard cap on watcher wait time. Default 30 min (matches max call duration). */
  watcherTimeoutMs?: number;
};

export function watchOutboundCall(params: {
  callId: string;
  analyticsKey: string;
  proxyUrl?: string;
  timeoutMs?: number;
  onEvent?: (event: OutboundCallEvent) => void;
}): { promise: Promise<OutboundCallTerminal>; close: () => void } {
  const watcher = new OutboundCallWatcher({
    callId: params.callId,
    analyticsKey: params.analyticsKey,
    proxyUrl: params.proxyUrl,
    timeoutMs: params.timeoutMs,
    onEvent: params.onEvent,
  });
  return { promise: watcher.start(), close: () => watcher.close() };
}

function resolveMobileAIBase(baseUrl?: string): string {
  return (baseUrl ?? ENDPOINTS.escalation)
    .replace(/\/$/, '')
    .replace(/\/api\/v1\/analytics$/, '');
}

export async function startOutboundAiCall(params: {
  analyticsKey: string;
  request: OutboundCallRequest;
  config?: OutboundCallConfig;
  currentScreen?: string;
  userContext?: Record<string, unknown>;
}): Promise<StartOutboundCallResult> {
  const { analyticsKey, request, config, currentScreen, userContext } = params;

  if (!analyticsKey) {
    return { ok: false, error: 'MobileAI analyticsKey is required for outbound AI calls.' };
  }

  const allowedTargetTypes = config?.allowedTargetTypes;
  if (allowedTargetTypes?.length && !allowedTargetTypes.includes(request.targetType)) {
    return {
      ok: false,
      error: `Target type "${request.targetType}" is not allowed by this SDK configuration.`,
    };
  }

  await initDeviceId();
  const root = resolveMobileAIBase(config?.proxyUrl);

  try {
    const response = await fetch(`${root}/api/v1/outbound-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${analyticsKey}`,
        ...(config?.headers ?? {}),
      },
      body: JSON.stringify({
        ...request,
        currentScreen,
        userContext: {
          ...(userContext ?? {}),
          deviceId: getDeviceId(),
          device: getDeviceMetadata(),
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof payload?.error === 'string'
            ? payload.error
            : `Outbound AI call failed with HTTP ${response.status}.`,
      };
    }

    return {
      ok: true,
      callId: payload?.call?.id,
      status: payload?.call?.status,
      targetDisplayName: payload?.call?.targetDisplayName,
      message: payload?.message,
    };
  } catch (error: any) {
    logger.error(LOG_TAG, `Network error: ${error?.message || String(error)}`);
    return { ok: false, error: error?.message || 'Network error starting outbound AI call.' };
  }
}

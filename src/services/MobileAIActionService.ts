import { getDeviceId, initDeviceId } from './telemetry/device';
import { logger } from '../utils/logger';
import { ENDPOINTS } from '../config/endpoints';

const LOG_TAG = 'MobileAIActionService';

export type RemoteActionExecutionType = 'webhook' | 'app_code';

export interface RemoteConfiguredAction {
  name: string;
  description: string;
  triggerHint: string;
  limitPerUser: number;
  globalLimit: number;
  executionType: RemoteActionExecutionType;
}

export interface ExecuteConfiguredActionResult {
  allowed: boolean;
  executed: boolean;
  executionType: RemoteActionExecutionType;
  message?: string;
  output?: unknown;
  error?: string;
}

function resolveMobileAIBase(baseUrl?: string): string {
  return (baseUrl ?? ENDPOINTS.escalation)
    .replace(/\/$/, '')
    .replace(/\/api\/v1\/analytics$/, '');
}

export async function fetchConfiguredActions(params: {
  analyticsKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}): Promise<RemoteConfiguredAction[]> {
  const { analyticsKey, baseUrl, headers } = params;
  try {
    const root = resolveMobileAIBase(baseUrl);
    const url = `${root}/api/v1/actions/sync?key=${encodeURIComponent(analyticsKey)}`;
    const response = await fetch(url, {
      headers: headers ?? {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch configured actions: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload.actions)
      ? (payload.actions as RemoteConfiguredAction[])
      : [];
  } catch (error: any) {
    logger.warn(LOG_TAG, `Could not sync configured actions: ${error.message}`);
    return [];
  }
}

export async function executeConfiguredAction(params: {
  analyticsKey: string;
  actionName: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  args?: Record<string, unknown>;
  currentScreen?: string;
  userContext?: Record<string, unknown>;
}): Promise<ExecuteConfiguredActionResult> {
  const {
    analyticsKey,
    actionName,
    baseUrl,
    headers,
    args = {},
    currentScreen,
    userContext,
  } = params;

  await initDeviceId();
  const deviceId = getDeviceId() ?? 'unknown';
  const root = resolveMobileAIBase(baseUrl);

  try {
    const response = await fetch(`${root}/api/v1/actions/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${analyticsKey}`,
        ...(headers ?? {}),
      },
      body: JSON.stringify({
        actionName,
        deviceId,
        args,
        currentScreen,
        userContext,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        allowed: false,
        executed: false,
        executionType: payload.executionType ?? 'app_code',
        error:
          payload.error ??
          `Action '${actionName}' failed with HTTP ${response.status}`,
      };
    }

    return {
      allowed: payload.allowed === true,
      executed: payload.executed === true,
      executionType: payload.executionType ?? 'app_code',
      message: payload.message,
      output: payload.output,
    };
  } catch (error: any) {
    logger.error(
      LOG_TAG,
      `executeConfiguredAction network error: ${error.message}`
    );
    return {
      allowed: false,
      executed: false,
      executionType: 'app_code',
      error: error.message,
    };
  }
}

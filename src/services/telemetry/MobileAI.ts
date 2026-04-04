/**
 * MobileAI — Public static API for consumer event tracking.
 *
 * Usage:
 *   import { MobileAI } from '@mobileai/react-native';
 *   MobileAI.track('purchase_complete', { total: 29.99 });
 *
 * The TelemetryService instance is injected by the <AIAgent> component.
 * If no analyticsKey is configured, all calls are no-ops.
 */

import type { TelemetryService } from './TelemetryService';
import { logger } from '../../utils/logger';
import { getDeviceId } from './device';
import { ENDPOINTS } from '../../config/endpoints';

const LOG_TAG = 'MobileAI';

let service: TelemetryService | null = null;

export const MobileAI = {
  /**
   * Track a custom business event.
   * @param eventName - Name of the event (e.g., 'purchase_complete')
   * @param data - Event-specific key-value data
   */
  track(eventName: string, data: Record<string, unknown> = {}): void {
    if (!service) {
      logger.debug(LOG_TAG, `track('${eventName}') ignored — no analyticsKey configured`);
      return;
    }
    service.track(eventName, data);
  },

  /**
   * Identify the current user (optional, for user-level analytics).
   * @param userId - Unique user identifier (hashed by consumer)
   * @param traits - Optional user traits (plan, role, etc.)
   */
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    if (!service) {
      logger.debug(LOG_TAG, 'identify() ignored — no analyticsKey configured');
      return;
    }
    service.track('identify', { user_id: userId, ...traits });
  },

  /**
   * Get an assigned feature flag variation for the current device.
   * Deterministic via murmurhash. Call after MobileAI has initialized.
   * @param key Flag key
   * @param defaultValue Fallback if not assigned
   */
  getFlag(key: string, defaultValue?: string): string {
    if (!service) {
      return defaultValue ?? '';
    }
    return service.flags.getFlag(key, defaultValue);
  },

  /**
   * Helper function to securely consume a global WOW action limit (like a discount)
   * natively on the MobileAI Server to prevent prompt injection bypasses.
   * @param actionName - The exact registered name of the WOW action
   * @returns true if allowed, false if rejected or error
   */
  async consumeWowAction(actionName: string): Promise<boolean> {
    if (!service || !service.config.analyticsKey) {
      logger.warn(LOG_TAG, 'consumeWowAction failed: SDK not initialized with analyticsKey or publishableKey in AIAgent');
      return false;
    }

    try {
      const baseUrl = (service.config.analyticsProxyUrl ?? ENDPOINTS.escalation).replace(/\/$/, '').replace(/\/api\/v1\/analytics$/, '');
      const url = `${baseUrl}/api/v1/wow-actions/consume`;
      const deviceId = getDeviceId() ?? 'unknown';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${service.config.analyticsKey}`,
          ...(service.config.analyticsProxyHeaders ?? {}),
        },
        body: JSON.stringify({ actionName, deviceId }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          logger.info(LOG_TAG, `consumeWowAction denied: Global limit reached for '${actionName}'`);
        } else {
          logger.warn(LOG_TAG, `consumeWowAction failed: HTTP ${res.status}`);
        }
        return false;
      }

      const data = await res.json();
      return data.allowed === true;
    } catch (e: any) {
      logger.error(LOG_TAG, `consumeWowAction network error: ${e.message}`);
      return false;
    }
  },
};

/**
 * Internal: Bind the TelemetryService instance (called by AIAgent on mount).
 * Not exported to consumers.
 */
export function bindTelemetryService(instance: TelemetryService | null): void {
  service = instance;
}

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
};

/**
 * Internal: Bind the TelemetryService instance (called by AIAgent on mount).
 * Not exported to consumers.
 */
export function bindTelemetryService(instance: TelemetryService | null): void {
  service = instance;
}

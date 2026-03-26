/**
 * Telemetry module barrel export.
 */

export { TelemetryService } from './TelemetryService';
export { MobileAI, bindTelemetryService } from './MobileAI';
export type {
  TelemetryEvent,
  TelemetryBatch,
  TelemetryConfig,
  AutoEventType,
  EventType,
} from './types';

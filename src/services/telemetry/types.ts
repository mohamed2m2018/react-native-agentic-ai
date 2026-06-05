/**
 * Telemetry types for the MobileAI analytics module.
 *
 * Events are split into two categories:
 * 1. Auto-captured: SDK captures these without consumer code
 * 2. Consumer-tracked: via MobileAI.track() API
 */

// ─── Event Types ──────────────────────────────────────────────

/** Auto-captured event types */
export type AutoEventType =
  | 'screen_view'
  | 'user_action'
  | 'scroll_depth'
  | 'idle_detected'
  | 'session_start'
  | 'session_end'
  | 'agent_request'
  | 'agent_step'
  | 'agent_complete'
  | 'escalation'
  | 'knowledge_query'
  | 'knowledge_miss'
  | 'csat_response';

/** All event types (auto + custom) */
export type EventType = AutoEventType | string;

// ─── Event Payload ────────────────────────────────────────────

export interface TelemetryEvent {
  /** Event type identifier */
  type: EventType;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** ISO 8601 timestamp (auto-set by SDK) */
  timestamp: string;
  /** Current screen name (auto-attached) */
  screen: string;
  /** Session ID (auto-generated per app lifecycle) */
  sessionId: string;
}

// ─── Batch Payload (sent to cloud) ────────────────────────────

export interface TelemetryBatch {
  /** Publishable analytics key */
  analyticsKey: string;
  /** App identifier (bundle ID / package name) */
  appId: string;
  /** Hashed user/device identifier */
  deviceId: string;
  /** SDK version */
  sdkVersion: string;
  /** Batch of events */
  events: TelemetryEvent[];
}

// ─── Configuration ────────────────────────────────────────────

export interface TelemetryConfig {
  /** Publishable analytics key (mobileai_pub_xxx) */
  analyticsKey?: string;
  /** Proxy URL for enterprise customers (replaces direct cloud API) */
  analyticsProxyUrl?: string;
  /** Custom headers for proxy requests */
  analyticsProxyHeaders?: Record<string, string>;
  /** Flush interval in ms (default: 30000) */
  flushIntervalMs?: number;
  /** Max events before auto-flush (default: 50) */
  maxBatchSize?: number;
  /** Enable debug logging for telemetry (default: false) */
  debug?: boolean;
}

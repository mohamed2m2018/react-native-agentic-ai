/**
 * Telemetry event types emitted through the onEvent callback.
 *
 * All events are captured by the SDK; the app receives them via onEvent.
 */

// ─── Event Types ──────────────────────────────────────────────

/** Auto-captured event types */
export type AutoEventType =
  | 'screen_view'
  | 'user_action'
  | 'user_interaction'
  | 'scroll_depth'
  | 'idle_detected'
  | 'session_start'
  | 'session_end'
  | 'agent_request'
  | 'agent_step'
  | 'agent_trace'
  | 'agent_complete'
  | 'escalation'
  | 'knowledge_query'
  | 'knowledge_miss'
  | 'csat_response'
  | 'ces_response'
  | 'nps_response'
  | 'agent_first_response'
  | 'human_first_response'
  | 'fcr_achieved'
  | 'engagement_signal'
  | 'health_signal'
  | 'onboarding_step'
  | 'business_escalation'
  | 'dead_click'
  | 'dead_click_detected'
  | 'rage_click'
  | 'rage_click_detected'
  | 'error_screen'
  | 'repeated_navigation'
  | 'checkout_started'
  | 'purchase_complete'
  | 'purchase_completed'
  | 'wireframe_snapshot';

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

// ─── Configuration ────────────────────────────────────────────

/** Emits one SDK event (wired to TelemetryService.track by AIAgent). */
export type TrackEvent = (type: string, data?: Record<string, unknown>) => void;

export interface TelemetryConfig {
  /** Receives every SDK event. Telemetry is off when this is not set. */
  onEvent?: (event: TelemetryEvent) => void;
  /** Log each event to the console (default: false) */
  debug?: boolean;
}

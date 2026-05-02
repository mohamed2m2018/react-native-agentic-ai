/**
 * TelemetryService — Batches and sends analytics events to MobileAI Cloud.
 *
 * Features:
 * - Event batching (flush every N seconds or N events)
 * - In-memory offline queue with retry on reconnect
 * - Lightweight — no native dependencies
 * - Opt-in only (requires analyticsKey or analyticsProxyUrl)
 */

import { AppState, Platform } from 'react-native';
import { logger } from '../../utils/logger';
import { ENDPOINTS } from '../../config/endpoints';
import type {
  TelemetryEvent,
  TelemetryBatch,
  TelemetryConfig,
} from './types';
import { scrubPII } from './PiiScrubber';
import { FlagService } from '../flags/FlagService';

// ─── Constants ─────────────────────────────────────────────────

const CLOUD_API_URL = ENDPOINTS.telemetryIngest;
const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
const DEFAULT_MAX_BATCH_SIZE = 50;
const SDK_VERSION = '0.10.0';
const LOG_TAG = 'Telemetry';

// ─── Utility ───────────────────────────────────────────────────

function generateSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

import { getDeviceId } from './device';
import { humanizeScreenName } from '../../utils/humanizeScreenName';

// ─── Service ───────────────────────────────────────────────────

export class TelemetryService {
  private queue: TelemetryEvent[] = [];
  public config: TelemetryConfig;
  private sessionId: string;
  private currentScreen = 'Unknown';
  private screenFlow: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private wireframesSent = new Set<string>();

  get screen(): string {
    return this.currentScreen;
  }

  getScreenFlow(): string[] {
    return [...this.screenFlow];
  }

  /**
   * True while the AI agent is executing a tool (tap, type, navigate, etc.).
   * The touch interceptor checks this flag to avoid double-counting AI actions
   * as human interactions. Agent steps are already tracked as agent_step events.
   */
  isAgentActing = false;
  
  public flags: FlagService;

  /** Set by AgentRuntime before/after each tool execution. */
  setAgentActing(active: boolean): void {
    this.isAgentActing = active;
  }

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.sessionId = generateSessionId();
    
    // Extract base URL for flags API (e.g. drop /v1/events)
    let baseUrl = new URL(ENDPOINTS.escalation).origin;
    try {
      if (config.analyticsProxyUrl) {
        baseUrl = new URL(config.analyticsProxyUrl).origin;
      }
    } catch {}
    this.flags = new FlagService(baseUrl);
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /** Start the telemetry service (call on mount) */
  async start(): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug(LOG_TAG, 'Disabled — no analyticsKey or proxyUrl');
      return;
    }

    // Fetch feature flags asynchronously (do not block startup)
    if (this.config.analyticsKey) {
      this.flags.fetch(this.config.analyticsKey).catch((e) => 
        logger.warn(LOG_TAG, `Could not sync flags: ${e.message}`)
      );
    }

    // Start periodic flush
    const interval = this.config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.flushTimer = setInterval(() => this.flush(), interval);

    // Flush on app background
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'background' || state === 'inactive') {
          this.flush();
        }
      }
    );

    // Track session start
    this.track('session_start', {
      device: Platform.OS,
      os: String(Platform.Version),
      sdk_version: SDK_VERSION,
    });

    logger.info(LOG_TAG, `Started (session: ${this.sessionId})`);
  }

  /** Stop the telemetry service (call on unmount) */
  async stop(): Promise<void> {
    if (!this.isEnabled()) return;

    // Track session end
    this.track('session_end', {
      events_count: this.queue.length,
    });

    // Final flush
    await this.flush();

    // Cleanup
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    logger.info(LOG_TAG, 'Stopped');
  }

  // ─── Public API ─────────────────────────────────────────────

  /** Track an event (auto or custom) */
  track(type: string, data: Record<string, unknown> = {}): void {
    if (!this.isEnabled()) return;

    // Sanitize any string values in the data payload to remove PII
    const sanitizedData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        typeof v === 'string' ? scrubPII(v) : v,
      ])
    );

    // Auto-append active feature flags
    sanitizedData.$flags = this.flags.getAllFlags();

    const event: TelemetryEvent = {
      type,
      data: sanitizedData,
      timestamp: new Date().toISOString(),
      screen: this.currentScreen,
      sessionId: this.sessionId,
    };

    this.queue.push(event);

    if (this.config.onEvent) {
      this.config.onEvent(event);
    }

    if (this.config.debug) {
      logger.debug(LOG_TAG, `→ ${type}`, data);
    }

    // Auto-flush if batch is full
    const maxSize = this.config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    if (this.queue.length >= maxSize) {
      this.flush();
    }
  }

  /** Update current screen (called by AIAgent on navigation) */
  setScreen(rawScreenName: string): void {
    const screenName = humanizeScreenName(rawScreenName);
    
    // If it's a layout component or catch-all, skip it
    if (!screenName) return;

    if (this.currentScreen !== screenName) {
      const prevScreen = this.currentScreen === 'Unknown' ? undefined : this.currentScreen;
      this.currentScreen = screenName;
      this.screenFlow.push(screenName);

      this.track('screen_view', {
        screen: screenName,
        prev_screen: prevScreen,
      });
    }
  }

  /**
   * Track a wireframe snapshot.
   * Deduped per session (only one wireframe per screen over a session).
   */
  trackWireframe(snapshot: import('../../core/types').WireframeSnapshot): void {
    if (!this.isEnabled()) return;
    
    // Only send once per screen per session
    if (this.wireframesSent.has(snapshot.screen)) return;
    
    this.wireframesSent.add(snapshot.screen);
    this.track('wireframe_snapshot', snapshot as unknown as Record<string, unknown>);
  }

  // ─── Flush ──────────────────────────────────────────────────

  /** Send queued events to the cloud API */
  async flush(): Promise<void> {
    if (!this.isEnabled() || this.isFlushing) return;

    // Extract any pending SDK debug logs to sink them natively to the backend
    const unflushedLogs = logger.extractUnflushedLines();
    if (unflushedLogs.length > 0) {
      this.track('sdk_trace_dump', {
        logs: unflushedLogs.join('\n'),
      });
    }

    if (this.queue.length === 0) return;

    this.isFlushing = true;
    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      const url = this.config.analyticsProxyUrl ?? CLOUD_API_URL;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.config.analyticsProxyHeaders ?? {}),
      };

      const batch: TelemetryBatch = {
        analyticsKey: this.config.analyticsKey ?? '',
        appId: Platform.OS, // Consumer can override via config later
        deviceId: getDeviceId() ?? 'unknown',
        sdkVersion: SDK_VERSION,
        events: eventsToSend,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      logger.info(LOG_TAG, `Flushed ${eventsToSend.length} events`);
    } catch (error: any) {
      // Re-queue failed events for retry
      this.queue = [...eventsToSend, ...this.queue];

      logger.warn(LOG_TAG, `Flush failed (${eventsToSend.length} events re-queued): ${error.message}`);
    } finally {
      this.isFlushing = false;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  /** Check if telemetry is configured */
  private isEnabled(): boolean {
    return !!(this.config.analyticsKey || this.config.analyticsProxyUrl);
  }
}

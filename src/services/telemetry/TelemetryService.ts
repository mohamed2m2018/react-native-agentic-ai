/**
 * TelemetryService — emits SDK events to the host app's `onEvent` callback.
 *
 * Nothing leaves the device from here: the app decides where events go
 * (Segment, Amplitude, its own API, …). Disabled unless `onEvent` is set,
 * so apps that don't listen pay no cost.
 */

import { Platform } from 'react-native';
import { logger } from '../../utils/logger';
import type { TelemetryEvent, TelemetryConfig } from './types';
import { scrubPII } from './PiiScrubber';
import { humanizeScreenName } from '../../utils/humanizeScreenName';
import { SDK_VERSION } from '../../config/version';

const LOG_TAG = 'Telemetry';

function generateSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class TelemetryService {
  public config: TelemetryConfig;
  private sessionId: string;
  private currentScreen = 'Unknown';
  private screenFlow: string[] = [];
  private wireframesSent = new Set<string>();
  private eventsCount = 0;

  /**
   * True while the AI agent is executing a tool (tap, type, navigate, etc.).
   * The touch interceptor checks this flag to avoid double-counting AI actions
   * as human interactions. Agent steps are already tracked as agent_step events.
   */
  isAgentActing = false;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.sessionId = generateSessionId();
  }

  get screen(): string {
    return this.currentScreen;
  }

  getScreenFlow(): string[] {
    return [...this.screenFlow];
  }

  /** Set by AgentRuntime before/after each tool execution. */
  setAgentActing(active: boolean): void {
    this.isAgentActing = active;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  start(): void {
    if (!this.isEnabled()) return;
    this.track('session_start', {
      device: Platform.OS,
      os: String(Platform.Version),
      sdk_version: SDK_VERSION,
    });
    logger.info(LOG_TAG, `Started (session: ${this.sessionId})`);
  }

  stop(): void {
    if (!this.isEnabled()) return;
    this.track('session_end', { events_count: this.eventsCount });
    logger.info(LOG_TAG, 'Stopped');
  }

  // ─── Public API ─────────────────────────────────────────────

  /** Emit an event to the app's onEvent callback. String values are PII-scrubbed. */
  track(type: string, data: Record<string, unknown> = {}): void {
    if (!this.isEnabled()) return;

    const sanitizedData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        typeof v === 'string' ? scrubPII(v) : v,
      ])
    );

    const event: TelemetryEvent = {
      type,
      data: sanitizedData,
      timestamp: new Date().toISOString(),
      screen: this.currentScreen,
      sessionId: this.sessionId,
    };
    this.eventsCount++;

    try {
      this.config.onEvent?.(event);
    } catch (err) {
      logger.warn(
        LOG_TAG,
        `onEvent threw for "${type}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (this.config.debug) {
      logger.debug(LOG_TAG, `→ ${type}`, data);
    }
  }

  /** Update current screen (called by AIAgent on navigation) */
  setScreen(rawScreenName: string): void {
    const screenName = humanizeScreenName(rawScreenName);
    if (!screenName) return;

    if (this.currentScreen !== screenName) {
      const prevScreen =
        this.currentScreen === 'Unknown' ? undefined : this.currentScreen;
      this.currentScreen = screenName;
      this.screenFlow.push(screenName);
      this.track('screen_view', {
        screen: screenName,
        prev_screen: prevScreen,
      });
    }
  }

  /** Track a wireframe snapshot, once per screen per session. */
  trackWireframe(snapshot: import('../../core/types').WireframeSnapshot): void {
    if (!this.isEnabled()) return;
    if (this.wireframesSent.has(snapshot.screen)) return;
    this.wireframesSent.add(snapshot.screen);
    this.track(
      'wireframe_snapshot',
      snapshot as unknown as Record<string, unknown>
    );
  }

  /** Track an onboarding step with optional metadata */
  trackOnboardingStep(step: string, metadata?: Record<string, unknown>): void {
    this.track('onboarding_step', { step, ...metadata });
  }

  /** Track an engagement signal with optional metadata */
  trackEngagement(signal: string, metadata?: Record<string, unknown>): void {
    this.track('engagement_signal', { signal, ...metadata });
  }

  isEnabled(): boolean {
    return typeof this.config.onEvent === 'function';
  }
}

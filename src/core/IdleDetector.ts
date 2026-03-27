export interface IdleDetectorConfig {
  /** Time in ms before the agent pulses subtly (e.g. 120_000 for 2m) */
  pulseAfterMs: number;
  /** Time in ms before the agent shows a badge (e.g. 240_000 for 4m) */
  badgeAfterMs: number;
  /** Callback fired when the user is idle enough for a subtle pulse */
  onPulse: () => void;
  /** Callback fired when the user is idle enough for a proactive badge. Receives the context suggestion. */
  onBadge: (suggestion: string) => void;
  /** Callback fired when the user interacts, cancelling idle states */
  onReset: () => void;
  /** Dynamic context suggestion generator based on current screen */
  generateSuggestion?: () => string;
}

export class IdleDetector {
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private badgeTimer: ReturnType<typeof setTimeout> | null = null;
  private dismissed = false;
  private config: IdleDetectorConfig | null = null;

  start(config: IdleDetectorConfig): void {
    this.config = config;
    this.dismissed = false;
    this.resetTimers();
  }

  reset(): void {
    if (!this.config || this.dismissed) return;
    this.config.onReset();
    this.resetTimers();
  }

  dismiss(): void {
    this.dismissed = true;
    this.clearTimers();
    if (this.config) {
      this.config.onReset();
    }
  }

  destroy(): void {
    this.clearTimers();
    this.config = null;
  }

  private resetTimers(): void {
    this.clearTimers();

    if (!this.config || this.dismissed) return;

    this.pulseTimer = setTimeout(() => {
      this.config?.onPulse();
    }, this.config.pulseAfterMs);

    this.badgeTimer = setTimeout(() => {
      const suggestion = this.config?.generateSuggestion?.() ?? "Need help with this screen?";
      this.config?.onBadge(suggestion);
    }, this.config.badgeAfterMs);
  }

  private clearTimers(): void {
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (this.badgeTimer) {
      clearTimeout(this.badgeTimer);
      this.badgeTimer = null;
    }
  }
}

/**
 * IdleDetector unit tests
 *
 * Verifies timer lifecycle, callback sequencing, dismissal, and
 * independent state across instances (regression on the former
 * module-level `dismissed` flag bug).
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/core/IdleDetector.test.ts
 */

import { IdleDetector, type IdleDetectorConfig } from '../../core/IdleDetector';

// Use fake timers so tests don't actually wait 2+ minutes
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('IdleDetector', () => {

  // ─── Helpers ──────────────────────────────────────────────────

  function makeConfig(overrides?: Partial<IdleDetectorConfig>) {
    const onPulse = jest.fn();
    const onBadge = jest.fn();
    const onReset = jest.fn();
    return {
      config: {
        pulseAfterMs: 2_000,
        badgeAfterMs: 4_000,
        onPulse,
        onBadge,
        onReset,
        ...overrides,
      },
      onPulse,
      onBadge,
      onReset,
    };
  }

  // ─── Timer sequencing ─────────────────────────────────────────

  describe('timer sequencing', () => {
    it('fires onPulse after pulseAfterMs', () => {
      const { config, onPulse } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      jest.advanceTimersByTime(2_000);

      expect(onPulse).toHaveBeenCalledTimes(1);
    });

    it('fires onBadge after badgeAfterMs', () => {
      const { config, onBadge } = makeConfig();
      const generateSuggestion = jest.fn().mockReturnValue('Need help?');
      const detector = new IdleDetector();
      detector.start({ ...config, generateSuggestion });

      jest.advanceTimersByTime(4_000);

      expect(onBadge).toHaveBeenCalledTimes(1);
      expect(onBadge).toHaveBeenCalledWith('Need help?');
    });

    it('uses default badge text when generateSuggestion is not provided', () => {
      const { config, onBadge } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      jest.advanceTimersByTime(4_000);

      expect(onBadge).toHaveBeenCalledWith('Need help with this screen?');
    });

    it('fires both pulse then badge in order', () => {
      const callOrder: string[] = [];
      const config = makeConfig({
        onPulse: () => callOrder.push('pulse'),
        onBadge: () => callOrder.push('badge'),
      }).config;

      const detector = new IdleDetector();
      detector.start(config);

      jest.advanceTimersByTime(2_000);
      jest.advanceTimersByTime(2_000); // total = 4_000

      expect(callOrder).toEqual(['pulse', 'badge']);
    });
  });

  // ─── reset() ─────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears timers and restarts them', () => {
      const { config, onPulse } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      // Advance 1.5s — no pulse yet
      jest.advanceTimersByTime(1_500);
      expect(onPulse).not.toHaveBeenCalled();

      // Reset — timer should restart from 0
      detector.reset();

      // Another 1.5s — still no pulse (timer was restarted)
      jest.advanceTimersByTime(1_500);
      expect(onPulse).not.toHaveBeenCalled();

      // Full 2s after reset — pulse fires
      jest.advanceTimersByTime(500);
      expect(onPulse).toHaveBeenCalledTimes(1);
    });

    it('calls onReset when reset() is called while active', () => {
      const { config, onReset } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      detector.reset();

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  // ─── dismiss() ───────────────────────────────────────────────

  describe('dismiss()', () => {
    it('prevents onPulse from firing after dismiss', () => {
      const { config, onPulse } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      detector.dismiss();
      jest.advanceTimersByTime(10_000);

      expect(onPulse).not.toHaveBeenCalled();
    });

    it('prevents onBadge from firing after dismiss', () => {
      const { config, onBadge } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      detector.dismiss();
      jest.advanceTimersByTime(10_000);

      expect(onBadge).not.toHaveBeenCalled();
    });

    it('prevents reset() from restarting timers after dismiss', () => {
      const { config, onPulse } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      detector.dismiss();
      detector.reset(); // should be a no-op because dismissed
      jest.advanceTimersByTime(10_000);

      expect(onPulse).not.toHaveBeenCalled();
    });
  });

  // ─── destroy() ───────────────────────────────────────────────

  describe('destroy()', () => {
    it('clears timers without firing callbacks', () => {
      const { config, onPulse, onBadge } = makeConfig();
      const detector = new IdleDetector();
      detector.start(config);

      detector.destroy();
      jest.advanceTimersByTime(10_000);

      expect(onPulse).not.toHaveBeenCalled();
      expect(onBadge).not.toHaveBeenCalled();
    });
  });

  // ─── Instance isolation (regression) ─────────────────────────

  describe('instance isolation', () => {
    it('dismissed state from one instance does not affect another', () => {
      const detector1 = new IdleDetector();
      const detector2 = new IdleDetector();

      const { config: config1, onPulse: pulse1 } = makeConfig();
      const { config: config2, onPulse: pulse2 } = makeConfig();

      detector1.start(config1);
      detector2.start(config2);

      // Dismiss detector1
      detector1.dismiss();

      // Advance timers — only detector2 should fire
      jest.advanceTimersByTime(2_000);

      expect(pulse1).not.toHaveBeenCalled();
      expect(pulse2).toHaveBeenCalledTimes(1);
    });

    it('re-starting with start() resets the dismissed flag', () => {
      const { config, onPulse } = makeConfig();
      const detector = new IdleDetector();

      detector.start(config);
      detector.dismiss();

      // Restart the same instance — dismissed should reset
      detector.start(config);
      jest.advanceTimersByTime(2_000);

      expect(onPulse).toHaveBeenCalledTimes(1);
    });
  });
});

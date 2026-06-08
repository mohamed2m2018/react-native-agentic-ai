/**
 * NativeAlertInterceptor — Gray-box interception for React Native Alert dialogs.
 *
 * Pattern: same approach used by Jest/RNTL (jest.spyOn(Alert, 'alert')) and
 * inspired by Detox's gray-box native dialog detection.
 *
 * How it works:
 * 1. install()  — patches Alert.alert / Alert.prompt at agent execution start
 * 2. The patched function STILL calls the original (so the user sees the native alert)
 *    AND captures the metadata (title, message, buttons) into a registry.
 * 3. FiberTreeWalker reads hasActiveAlert() / getActiveAlert() and injects
 *    virtual elements into the dehydrated screen so the LLM can see them.
 * 4. tapTool routes virtual alert element taps to dismissAlert().
 * 5. uninstall() — restores originals at execution end (in finally block).
 *
 * Safety:
 * - Patch is ONLY active while the agent is running.
 * - Original Alert is always restored — even on unhandled errors.
 * - Active alert auto-clears after ALERT_AUTO_CLEAR_MS to prevent stale state.
 */

import { logger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  /** Original onPress callback from the app */
  onPress?: () => void;
}

export interface ActiveAlert {
  title: string;
  message: string;
  buttons: AlertButton[];
  /** Timestamp when the alert appeared */
  capturedAt: number;
}

// Auto-clear after 60 seconds — prevents stale state if user dismissed manually
const ALERT_AUTO_CLEAR_MS = 60_000;

// ─── Module-level state ──────────────────────────────────────────────────────

let _installed = false;
let _activeAlert: ActiveAlert | null = null;
let _autoClearTimer: ReturnType<typeof setTimeout> | null = null;

/** Original Alert methods, saved during install() and restored during uninstall() */
let _originalAlert: ((...args: any[]) => void) | null = null;
let _originalPrompt: ((...args: any[]) => void) | null = null;

// ─── Internal helpers ────────────────────────────────────────────────────────

function _clearAutoTimer(): void {
  if (_autoClearTimer) {
    clearTimeout(_autoClearTimer);
    _autoClearTimer = null;
  }
}

function _setActiveAlert(alert: ActiveAlert): void {
  _activeAlert = alert;
  _clearAutoTimer();
  _autoClearTimer = setTimeout(() => {
    logger.debug('NativeAlertInterceptor', 'Auto-clearing stale alert');
    _activeAlert = null;
  }, ALERT_AUTO_CLEAR_MS);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Install the Alert interceptor.
 * Patches Alert.alert and Alert.prompt — stores originals for restoration.
 * Safe to call multiple times (idempotent).
 */
export function installAlertInterceptor(): void {
  if (_installed) return;

  let AlertModule: any;
  try {
    const rn = require('react-native');
    AlertModule = rn.Alert;
  } catch {
    logger.warn('NativeAlertInterceptor', 'react-native not available — skipping install');
    return;
  }

  if (!AlertModule?.alert) {
    logger.warn('NativeAlertInterceptor', 'Alert.alert not found — skipping install');
    return;
  }

  // Save originals
  _originalAlert = AlertModule.alert.bind(AlertModule);
  _originalPrompt = AlertModule.prompt?.bind(AlertModule) ?? null;

  // Patch Alert.alert
  AlertModule.alert = function interceptedAlert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    ...rest: any[]
  ) {
    const normalizedButtons: AlertButton[] = Array.isArray(buttons) && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default' }];

    _setActiveAlert({
      title: title ?? '',
      message: message ?? '',
      buttons: normalizedButtons,
      capturedAt: Date.now(),
    });

    logger.info(
      'NativeAlertInterceptor',
      `Alert captured: "${title}" | buttons: [${normalizedButtons.map(b => b.text).join(', ')}]`
    );

    // Always call original — user MUST see the alert
    _originalAlert!(title, message, buttons, ...rest);
  };

  // Patch Alert.prompt (iOS only — Android ignores it)
  if (_originalPrompt && AlertModule.prompt) {
    AlertModule.prompt = function interceptedPrompt(
      title: string,
      message?: string,
      callbackOrButtons?: any,
      ...rest: any[]
    ) {
      const buttons: AlertButton[] = Array.isArray(callbackOrButtons)
        ? callbackOrButtons
        : [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'default' }];

      _setActiveAlert({
        title: title ?? '',
        message: message ?? '',
        buttons,
        capturedAt: Date.now(),
      });

      logger.info('NativeAlertInterceptor', `Alert.prompt captured: "${title}"`);
      _originalPrompt!(title, message, callbackOrButtons, ...rest);
    };
  }

  _installed = true;
  logger.info('NativeAlertInterceptor', '✅ Alert interceptor installed');
}

/**
 * Uninstall the Alert interceptor — restores original Alert methods.
 * Called in the agent's finally block after execution ends.
 */
export function uninstallAlertInterceptor(): void {
  if (!_installed) return;

  try {
    const rn = require('react-native');
    const AlertModule = rn.Alert;

    if (AlertModule && _originalAlert) {
      AlertModule.alert = _originalAlert;
    }
    if (AlertModule && _originalPrompt && AlertModule.prompt) {
      AlertModule.prompt = _originalPrompt;
    }
  } catch {
    // Best effort — RN module might not be available
  }

  _originalAlert = null;
  _originalPrompt = null;
  _activeAlert = null;
  _installed = false;
  _clearAutoTimer();

  logger.info('NativeAlertInterceptor', '✅ Alert interceptor uninstalled');
}

/** Returns the currently active alert metadata, or null if no alert is showing. */
export function getActiveAlert(): ActiveAlert | null {
  return _activeAlert;
}

/** Returns true if a native alert is currently intercepted and active. */
export function hasActiveAlert(): boolean {
  return _activeAlert !== null;
}

/**
 * Dismiss the active alert by calling the button's onPress callback.
 * @param buttonIndex - 0-based index of the button to tap
 * @returns true if successfully dismissed, false if no alert or invalid index
 */
export function dismissAlert(buttonIndex: number): boolean {
  if (!_activeAlert) {
    logger.warn('NativeAlertInterceptor', 'dismissAlert called but no active alert');
    return false;
  }

  const button = _activeAlert.buttons[buttonIndex];
  if (!button) {
    logger.warn(
      'NativeAlertInterceptor',
      `dismissAlert: invalid buttonIndex ${buttonIndex} (${_activeAlert.buttons.length} buttons)`
    );
    return false;
  }

  logger.info('NativeAlertInterceptor', `Dismissing alert via button: "${button.text}"`);

  // Clear state BEFORE calling onPress — prevents re-entrancy
  _activeAlert = null;
  _clearAutoTimer();

  // Call the app's original button handler
  try {
    button.onPress?.();
  } catch (err: any) {
    logger.warn('NativeAlertInterceptor', `Error in button onPress: ${err?.message}`);
  }

  return true;
}

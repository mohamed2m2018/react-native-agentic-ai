/**
 * FloatingOverlayWrapper — Cross-platform elevated overlay.
 *
 * Platform strategy (in priority order):
 *
 * iOS:
 *   1. `FullWindowOverlay` from react-native-screens (optional peer dep).
 *      Creates a separate UIWindow at UIWindow.Level.alert+1.
 *      Renders ABOVE all native Modals, system alerts, and navigation chrome.
 *   2. Falls back to plain View if react-native-screens is not installed.
 *
 * Android (both Old and New Architecture):
 *   1. Native `MobileAIFloatingOverlay` ViewManager (bundled in this library).
 *      Creates a Dialog window with TYPE_APPLICATION_PANEL (z=1000),
 *      above normal app Dialog windows (TYPE_APPLICATION, z=2).
 *      No SYSTEM_ALERT_WINDOW permission needed — scoped to app's own window.
 *   2. Falls back to plain View if the app hasn't been rebuilt after install
 *      (graceful degradation with DEV warning).
 *
 * Usage:
 *   <FloatingOverlayWrapper fallbackStyle={styles.floatingLayer}>
 *     <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
 *       {chatBar}
 *       {consentDialog} ← must be INSIDE the wrapper, AFTER the chat bar in JSX
 *     </View>
 *   </FloatingOverlayWrapper>
 *
 * Note: FullWindowOverlay on iOS does NOT officially accept style props in its TS definition, 
 * but passing StyleSheet.absoluteFill is often necessary to prevent dimensions collapsing conditionally.
 */

// imports consolidated above

// ─── iOS: FullWindowOverlay (react-native-screens optional peer dep) ──────────

let FullWindowOverlay: React.ComponentType<{ children?: React.ReactNode }> | null = null;

if (Platform.OS === 'ios') {
  try {
    // Literal string required by Metro bundler — try/catch handles MODULE_NOT_FOUND
    const screens = require('react-native-screens');
    FullWindowOverlay = screens.FullWindowOverlay ?? null;
  } catch {
    // react-native-screens not installed — falls back to View
  }
}

// ─── Android: MobileAIFloatingOverlay (native module bundled in this library) ──

let NativeFloatingOverlay: React.ComponentType<{
  children?: React.ReactNode;
  style?: any;
}> | null = null;

if (Platform.OS === 'android') {
  try {
    const { requireNativeComponent } = require('react-native');
    // Throws if ViewManager is not registered (app hasn't been rebuilt after install)
    NativeFloatingOverlay = requireNativeComponent(
      'MobileAIFloatingOverlay'
    ) as React.ComponentType<any>;
  } catch {
    if (__DEV__) {
      console.warn(
        '[MobileAI] MobileAIFloatingOverlay native module not found on Android.\n' +
          'The chat bar may appear behind native Modals.\n' +
          'Fix: rebuild the app with `npx react-native run-android` or `npx expo run:android`.'
      );
    }
  }
}

// ─── Export: whether a true elevated overlay is active ───────────────────────

/**
 * True when a native elevated overlay is available on the current platform.
 * Used by AIConsentDialog to decide whether to render as View vs Modal.
 *
 * iOS + react-native-screens installed → true
 * Android + native rebuild done        → true
 * Everything else (fallback)           → false
 */
export const isNativeOverlayActive: boolean =
  (Platform.OS === 'ios' && !!FullWindowOverlay) ||
  (Platform.OS === 'android' && !!NativeFloatingOverlay);

// ─── Component ────────────────────────────────────────────────────────────────

interface FloatingOverlayWrapperProps {
  children: React.ReactNode;
  /**
   * Style applied to the View wrapper when no native overlay is available.
   * Ignored on iOS (FullWindowOverlay creates its own UIWindow) and
   * Android (native module creates its own Dialog window).
   */
  fallbackStyle?: any;
}

import { Platform, View, StyleSheet } from 'react-native';

export function FloatingOverlayWrapper({
  children,
  fallbackStyle,
}: FloatingOverlayWrapperProps): React.ReactElement {
  // iOS: FullWindowOverlay — separate UIWindow above everything
  if (Platform.OS === 'ios' && FullWindowOverlay) {
    // @ts-ignore - Some versions of react-native-screens don't type 'style'
    return <FullWindowOverlay style={StyleSheet.absoluteFill}>{children}</FullWindowOverlay>;
  }

  // Android: native elevated Dialog window (TYPE_APPLICATION_PANEL)
  if (Platform.OS === 'android' && NativeFloatingOverlay) {
    return <NativeFloatingOverlay>{children}</NativeFloatingOverlay>;
  }

  // Fallback: regular View — same behavior as before this overlay feature
  return <View style={fallbackStyle}>{children}</View>;
}

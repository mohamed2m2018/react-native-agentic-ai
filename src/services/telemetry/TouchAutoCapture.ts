/**
 * TouchAutoCapture — Extracts a human-readable label from a React Native
 * touch event target by walking up the native view hierarchy.
 *
 * Used by AIAgent to auto-track every tap in the app without
 * any developer code changes (zero-config analytics).
 *
 * Strategy:
 * 1. Read the touched element's accessibilityLabel (best signal).
 * 2. If none, use React Native's internal _children to find nested text.
 * 3. Fallback to the component's testID.
 * 4. Last resort: "Unknown Element".
 */

// React Native imports not needed — we use Fiber internals directly
import type { TelemetryService } from './TelemetryService';

// ─── Rage Click Detection ──────────────────────────────────────────
//
// Industry-standard approach (FullStory, PostHog, LogRocket):
// - 3+ taps on the SAME element within a SHORT window
// - Must be on the SAME screen (screen changes = intentional navigation)
// - Navigation-style labels ("Next", "Continue") are excluded
// - 1-second window (PostHog standard) instead of 2s to reduce false positives

interface TapRecord {
  label: string;
  screen: string;
  ts: number;
}

const recentTaps: TapRecord[] = [];
const RAGE_WINDOW_MS = 1000; // PostHog uses 1s — tighter = fewer false positives
const RAGE_THRESHOLD = 3;
const MAX_TAP_BUFFER = 8;

// Labels that are naturally tapped multiple times in sequence (wizards, onboarding, etc.)
const NAVIGATION_LABELS = new Set([
  'next', 'continue', 'skip', 'back', 'done', 'ok', 'cancel',
  'previous', 'dismiss', 'close', 'got it', 'confirm', 'proceed',
  'التالي', 'متابعة', 'تخطي', 'رجوع', 'تم', 'إلغاء', 'إغلاق', 'حسناً',
]);

function isNavigationLabel(label: string): boolean {
  return NAVIGATION_LABELS.has(label.toLowerCase().trim());
}

/**
 * Checks if the user is rage-tapping an element.
 *
 * Industry best-practice criteria:
 * 1. Same label tapped 3+ times within 1 second
 * 2. Taps must be on the SAME screen (screen change = not rage, it's navigation)
 * 3. Navigation labels ("Next", "Skip", etc.) are excluded
 */
export function checkRageClick(label: string, telemetry: TelemetryService): void {
  // Skip navigation-style labels — sequential tapping is by design
  if (isNavigationLabel(label)) return;

  const now = Date.now();
  const currentScreen = telemetry.screen;

  recentTaps.push({ label, screen: currentScreen, ts: now });

  // Keep buffer bounded
  if (recentTaps.length > MAX_TAP_BUFFER) recentTaps.shift();

  // Count taps on the SAME label AND SAME screen within the time window
  const matching = recentTaps.filter(
    (t) =>
      t.label === label &&
      t.screen === currentScreen &&
      now - t.ts < RAGE_WINDOW_MS
  );

  if (matching.length >= RAGE_THRESHOLD) {
    telemetry.track('rage_click', {
      canonical_type: 'rage_click_detected',
      label,
      element_label: label,
      count: matching.length,
      screen: currentScreen,
    });
    // Reset buffer after emitting to avoid duplicate rage events
    recentTaps.length = 0;
  }
}

/**
 * Extract a label from a GestureResponderEvent.
 *
 * @param event - The GestureResponderEvent from onStartShouldSetResponderCapture
 * @returns A descriptive label string for the tapped element
 */
export function extractTouchLabel(event: any): string {
  const target = event?.nativeEvent?.target;
  if (!target) return 'Unknown Element';

  try {
    let fiber = event?._targetInst || getFiberFromNativeTag(target);
    if (fiber) {
      let current: any = fiber;
      let depth = 0;
      const MAX_DEPTH = 12;

      let bestLabel: string | null = null;
      let detectedRole: string | null = null;

      while (current && depth < MAX_DEPTH) {
        // 1. Detect Component Type Context
        if (!detectedRole) {
          if (current.memoizedProps?.accessibilityRole) {
            detectedRole = current.memoizedProps.accessibilityRole;
          } else if (current.memoizedProps?.onValueChange && typeof current.memoizedProps?.value === 'boolean') {
            detectedRole = 'Toggle/Switch';
          } else if (current.memoizedProps?.onChangeText) {
            detectedRole = 'TextInput';
          } else if (current.memoizedProps?.onPress) {
            detectedRole = 'Button';
          } else if (current.type?.name || current.type?.displayName) {
             const name = current.type.name || current.type.displayName;
             if (typeof name === 'string' && name.length > 2 && !name.toLowerCase().includes('wrapper') && !name.startsWith('RCT')) {
               detectedRole = name;
             }
          }
        }

        // 2. Detect String Label Output
        if (!bestLabel) {
          if (current.memoizedProps?.accessibilityLabel) {
            bestLabel = current.memoizedProps.accessibilityLabel;
          } else if (current.memoizedProps?.testID) {
            bestLabel = current.memoizedProps.testID;
          } else if (current.memoizedProps?.title) {
            bestLabel = current.memoizedProps.title;
          } else if (current.memoizedProps?.placeholder) {
            bestLabel = current.memoizedProps.placeholder;
          } else if (typeof current.memoizedProps?.children === 'string' && current.memoizedProps.children.trim()) {
            bestLabel = current.memoizedProps.children.trim();
          } else if (Array.isArray(current.memoizedProps?.children)) {
            bestLabel = findTextInChildren(current.memoizedProps.children);
          } else if (current.memoizedProps?.children && typeof current.memoizedProps.children === 'object') {
            bestLabel = findTextInChildren([current.memoizedProps.children]);
          }
        }

        current = current.return;
        depth++;
      }

      if (bestLabel) {
        if (detectedRole && detectedRole.toLowerCase() !== 'text' && detectedRole.toLowerCase() !== 'view') {
           const formattedRole = detectedRole.charAt(0).toUpperCase() + detectedRole.slice(1);
           return `[${formattedRole}] ${bestLabel}`;
        }
        return bestLabel;
      }
    }
  } catch {
    // Fiber access failed — fall back gracefully
  }

  return 'Unknown Element';
}

/**
 * Find the first string text in a React children tree (recursive, max 3 levels).
 */
function findTextInChildren(children: any[], depth = 0): string | null {
  if (depth > 3) return null;

  for (const child of children) {
    if (typeof child === 'string' && child.trim()) {
      return child.trim();
    }
    if (typeof child === 'number') {
      return String(child);
    }
    // React element with props.children
    if (child?.props?.children) {
      if (typeof child.props.children === 'string' && child.props.children.trim()) {
        return child.props.children.trim();
      }
      if (Array.isArray(child.props.children)) {
        const found = findTextInChildren(child.props.children, depth + 1);
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Attempt to get the Fiber node from a native tag (React Native internal).
 * This uses the same technique as React DevTools and testing libraries.
 */
function getFiberFromNativeTag(nativeTag: number): any {
  try {
    // React Native stores a reference from native tag → Fiber
    // via the __internalInstanceHandle on the native node
    const instance = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (instance?.renderers) {
      for (const [, renderer] of instance.renderers) {
        if (renderer?.findFiberByHostInstance) {
          // Try to find via the devtools hook
          const fiber = renderer.findFiberByHostInstance(nativeTag);
          if (fiber) return fiber;
        }
      }
    }
  } catch {
    // DevTools hook not available — expected in production
  }

  return null;
}

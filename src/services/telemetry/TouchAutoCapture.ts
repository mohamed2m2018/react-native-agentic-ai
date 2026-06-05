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

const recentTaps: { label: string; ts: number }[] = [];
const RAGE_WINDOW_MS = 2000;
const RAGE_THRESHOLD = 3;

/**
 * Checks if the user is repeatedly tapping the same element in frustration.
 * If rage click detected, emits 'rage_click' event to telemetry.
 */
export function checkRageClick(label: string, telemetry: TelemetryService): void {
  const now = Date.now();
  recentTaps.push({ label, ts: now });
  
  // Keep buffer unbounded size of 5
  if (recentTaps.length > 5) recentTaps.shift();

  const recent = recentTaps.filter(t => t.label === label && now - t.ts < RAGE_WINDOW_MS);
  if (recent.length >= RAGE_THRESHOLD) {
    telemetry.track('rage_click', { 
      label, 
      count: recent.length, 
      screen: telemetry.screen 
    });
    recentTaps.length = 0; // reset buffer after emitting to avoid spam
  }
}

/**
 * Extract a label from a GestureResponderEvent's native target.
 *
 * @param nativeEvent - The nativeEvent from onStartShouldSetResponderCapture
 * @param rootRef - The root View ref (to resolve relative positions)
 * @returns A descriptive label string for the tapped element
 */
export function extractTouchLabel(nativeEvent: any): string {
  // Try accessible properties first (most reliable)
  const target = nativeEvent?.target;

  if (!target) return 'Unknown Element';

  // React Native internal: _internalFiberInstanceHandleDEV or _nativeTag
  // We can walk the Fiber tree from the target to find text
  try {
    // Strategy 1: Walk up the Fiber tree from the touched element
    let fiber = getFiberFromNativeTag(target);
    if (fiber) {
      // Walk up looking for text content or accessibility labels
      let current: any = fiber;
      let depth = 0;
      const MAX_DEPTH = 10;

      while (current && depth < MAX_DEPTH) {
        // Check for accessibilityLabel
        if (current.memoizedProps?.accessibilityLabel) {
          return current.memoizedProps.accessibilityLabel;
        }

        // Check for testID
        if (current.memoizedProps?.testID) {
          return current.memoizedProps.testID;
        }

        // Check for title (Button component)
        if (current.memoizedProps?.title) {
          return current.memoizedProps.title;
        }

        // Check for placeholder (TextInput)
        if (current.memoizedProps?.placeholder) {
          return `Input: ${current.memoizedProps.placeholder}`;
        }

        // Check if this is a Text node with children string
        if (
          typeof current.memoizedProps?.children === 'string' &&
          current.memoizedProps.children.trim()
        ) {
          return current.memoizedProps.children.trim();
        }

        // Check for nested text in children array
        if (Array.isArray(current.memoizedProps?.children)) {
          const textChild = findTextInChildren(current.memoizedProps.children);
          if (textChild) return textChild;
        }

        current = current.return;
        depth++;
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

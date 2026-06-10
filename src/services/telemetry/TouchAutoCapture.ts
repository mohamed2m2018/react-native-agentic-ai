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
import type { AnalyticsTargetMetadata } from './analyticsLabeling';
import {
  chooseBestAnalyticsTarget,
  getAnalyticsElementKind,
} from './analyticsLabeling';
import {
  getChild,
  getDisplayName,
  getParent,
  getProps,
  getSibling,
  getType,
} from '../../core/FiberAdapter';

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
  'next',
  'continue',
  'skip',
  'back',
  'done',
  'ok',
  'cancel',
  'previous',
  'dismiss',
  'close',
  'got it',
  'confirm',
  'proceed',
  'التالي',
  'متابعة',
  'تخطي',
  'رجوع',
  'تم',
  'إلغاء',
  'إغلاق',
  'حسناً',
]);

const INTERACTIVE_PROP_KEYS = new Set([
  'onPress',
  'onPressIn',
  'onPressOut',
  'onLongPress',
  'onValueChange',
  'onChangeText',
  'onChange',
  'onBlur',
  'onFocus',
  'onSubmitEditing',
  'onScrollToTop',
  'onDateChange',
  'onValueChangeComplete',
  'onSlidingComplete',
  'onRefresh',
  'onEndEditing',
  'onSelect',
  'onCheckedChange',
]);

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'menuitem',
  'tab',
  'checkbox',
  'switch',
  'radio',
  'slider',
  'search',
  'text',
  'textbox',
]);

const RN_INTERNAL_NAMES = new Set([
  'View',
  'RCTView',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'ScrollView',
  'RCTScrollView',
  'FlatList',
  'SectionList',
  'SafeAreaView',
  'RNCSafeAreaView',
  'KeyboardAvoidingView',
  'Modal',
  'StatusBar',
  'Text',
  'RCTText',
  'AnimatedComponent',
  'AnimatedComponentWrapper',
  'Animated',
]);

function isInteractiveNode(props: any, typeName: string | undefined): boolean {
  if (!props || typeof props !== 'object') return false;

  for (const key of Object.keys(props)) {
    if (INTERACTIVE_PROP_KEYS.has(key) && typeof props[key] === 'function') {
      return true;
    }
  }

  const role = props.accessibilityRole;
  if (typeof role === 'string' && INTERACTIVE_ROLES.has(role.toLowerCase())) {
    return true;
  }

  if (!typeName) return false;
  const normalizedType = typeName.toLowerCase();
  return (
    normalizedType.includes('pressable') ||
    normalizedType.includes('touchable') ||
    normalizedType.includes('button') ||
    normalizedType.includes('textfield') ||
    normalizedType.includes('textinput') ||
    normalizedType.includes('switch') ||
    normalizedType.includes('checkbox') ||
    normalizedType.includes('slider') ||
    normalizedType.includes('picker') ||
    normalizedType.includes('datepicker')
  );
}

function getComponentName(fiber: any): string | null {
  const type = getType(fiber);
  if (!type) return null;
  if (typeof type === 'string') return type;

  const displayName = getDisplayName(fiber);
  if (displayName) return displayName;
  if (type.name) return type.name;
  if (type.render?.displayName) return type.render.displayName;
  if (type.render?.name) return type.render.name;

  return null;
}

function getZoneId(fiber: any, maxDepth: number = 8): string | null {
  let current = fiber;
  let depth = 0;

  while (current && depth < maxDepth) {
    const name = getComponentName(current);
    const props = getProps(current);
    if (
      name === 'AIZone' &&
      typeof props.id === 'string' &&
      props.id.trim().length > 0
    ) {
      return props.id.trim();
    }
    current = getParent(current);
    depth++;
  }

  return null;
}

function getAncestorPath(fiber: any, maxDepth: number = 6): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  let current = getParent(fiber);
  let depth = 0;

  while (current && depth < maxDepth) {
    const name = getComponentName(current);
    const props = getProps(current);
    const candidate =
      name === 'AIZone' && typeof props.id === 'string' && props.id.trim()
        ? props.id.trim()
        : name;

    if (
      candidate &&
      !RN_INTERNAL_NAMES.has(candidate) &&
      !seen.has(candidate)
    ) {
      labels.push(candidate);
      seen.add(candidate);
    }

    current = getParent(current);
    depth++;
  }

  return labels;
}

function getLabelForFiberNode(fiber: any): string | null {
  const props = getProps(fiber);
  return chooseBestAnalyticsTarget(
    [
      { text: props.accessibilityLabel, source: 'accessibility' },
      { text: props.title, source: 'title' },
      { text: props.placeholder, source: 'placeholder' },
      { text: props.testID, source: 'test-id' },
      {
        text:
          typeof props.children === 'string'
            ? props.children
            : Array.isArray(props.children)
              ? findTextInChildren(props.children)
              : props.children && typeof props.children === 'object'
                ? findTextInChildren([props.children])
                : null,
        source: 'deep-text',
      },
    ],
    getAnalyticsElementKind(props.accessibilityRole || getComponentName(fiber))
  ).label;
}

function getSiblingLabels(fiber: any, maxLabels: number = 6): string[] {
  const parent = getParent(fiber);
  if (!parent) return [];

  const labels: string[] = [];
  const seen = new Set<string>();
  let sibling = getChild(parent);

  while (sibling) {
    if (sibling !== fiber) {
      const siblingProps = getProps(sibling);
      const siblingName = getComponentName(sibling) || undefined;
      if (isInteractiveNode(siblingProps, siblingName)) {
        const label = getLabelForFiberNode(sibling);
        if (label && !seen.has(label.toLowerCase())) {
          labels.push(label);
          seen.add(label.toLowerCase());
          if (labels.length >= maxLabels) break;
        }
      }
    }
    sibling = getSibling(sibling);
  }

  return labels;
}

function addCandidatesFromProps(
  candidates: Array<{
    text?: string | null;
    source: 'accessibility' | 'deep-text' | 'placeholder' | 'title' | 'test-id';
    isInteractiveContext?: boolean;
  }>,
  props: any,
  isInteractiveContext = false
): void {
  if (!props) return;

  const candidateSources = [
    { source: 'accessibility', text: props.accessibilityLabel },
    { source: 'title', text: props.title },
    { source: 'placeholder', text: props.placeholder },
    { source: 'test-id', text: props.testID },
  ] as const;

  for (const item of candidateSources) {
    if (!item.text) continue;
    candidates.push({
      text: item.text,
      source: item.source,
      isInteractiveContext,
    });
  }

  if (typeof props.children === 'string' && props.children.trim()) {
    candidates.push({
      text: props.children.trim(),
      source: 'deep-text',
      isInteractiveContext,
    });
  } else if (Array.isArray(props.children)) {
    const text = findTextInChildren(props.children);
    if (text) {
      candidates.push({
        text,
        source: 'deep-text',
        isInteractiveContext,
      });
    }
  } else if (props.children && typeof props.children === 'object') {
    const text = findTextInChildren([props.children]);
    if (text) {
      candidates.push({
        text,
        source: 'deep-text',
        isInteractiveContext,
      });
    }
  }
}

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
export function checkRageClick(
  target: AnalyticsTargetMetadata & { x: number; y: number },
  telemetry: TelemetryService
): void {
  const label = target.label;
  if (!label) return;

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
      element_kind: target.elementKind,
      label_confidence: target.labelConfidence,
      zone_id: target.zoneId,
      ancestor_path: target.ancestorPath,
      sibling_labels: target.siblingLabels,
      component_name: target.componentName,
      count: matching.length,
      screen: currentScreen,
      x: target.x,
      y: target.y,
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
export function extractTouchTargetMetadata(
  event: any
): AnalyticsTargetMetadata {
  const target = event?.nativeEvent?.target;
  if (!target) {
    return {
      label: null,
      elementKind: 'unknown',
      labelConfidence: 'low',
    };
  }

  try {
    let fiber = event?._targetInst || getFiberFromNativeTag(target);
    if (fiber) {
      let current: any = fiber;
      let depth = 0;
      const MAX_DEPTH = 12;
      let foundInteractive = false;

      const candidates: Array<{
        text?: string | null;
        source:
          | 'accessibility'
          | 'deep-text'
          | 'placeholder'
          | 'title'
          | 'test-id';
        isInteractiveContext?: boolean;
      }> = [];
      let detectedKind = getAnalyticsElementKind(null);
      let interactiveFiber: any = null;

      while (current && depth < MAX_DEPTH) {
        const props = current.memoizedProps;
        const typeName = current.type?.name || current.type?.displayName;
        const nodeInteractive = isInteractiveNode(props, typeName);

        if (nodeInteractive) {
          foundInteractive = true;
          interactiveFiber = current;
        }
        // 1. Detect Component Type Context
        if (detectedKind === 'unknown') {
          if (props?.accessibilityRole) {
            detectedKind = getAnalyticsElementKind(props.accessibilityRole);
          } else if (
            props?.onValueChange &&
            typeof props?.value === 'boolean'
          ) {
            detectedKind = 'toggle';
          } else if (props?.onChangeText) {
            detectedKind = 'text_input';
          } else if (props?.onPress) {
            detectedKind = 'button';
          } else if (typeName) {
            detectedKind = getAnalyticsElementKind(typeName);
          }
        }

        if (!props) {
          break;
        }

        addCandidatesFromProps(candidates, props, nodeInteractive);

        // Stop at the nearest interactive node. If this node does not provide a
        // usable label, still allow a child text fallback from descendants.
        if (foundInteractive) {
          break;
        }

        current = current.return;
        depth++;
      }

      if (!foundInteractive) {
        return {
          label: null,
          elementKind: detectedKind,
          labelConfidence: 'low',
        };
      }

      // Prioritize nearest interactive context when available.
      const resolved = chooseBestAnalyticsTarget(candidates, detectedKind);
      const sourceFiber = interactiveFiber || fiber;
      return {
        ...resolved,
        zoneId: getZoneId(sourceFiber),
        ancestorPath: getAncestorPath(sourceFiber),
        siblingLabels: getSiblingLabels(sourceFiber),
        componentName: getComponentName(sourceFiber),
      };
    }
  } catch {
    // Fiber access failed — fall back gracefully
  }

  return {
    label: null,
    elementKind: 'unknown',
    labelConfidence: 'low',
  };
}

export function extractTouchLabel(event: any): string {
  return extractTouchTargetMetadata(event).label ?? 'Unknown Element';
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
      if (
        typeof child.props.children === 'string' &&
        child.props.children.trim()
      ) {
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

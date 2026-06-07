/**
 * FiberTreeWalker — Traverses React's Fiber tree to discover interactive elements.
 *
 * Walks the React Native fiber tree to extract a text representation of the UI.
 * Instead of traversing HTML nodes, we traverse React Fiber nodes and detect
 * interactive elements by their type and props (onPress, onChangeText, etc.).
 *
 */

import { logger } from '../utils/logger';
import type { InteractiveElement, ElementType } from './types';

// ─── Walk Configuration ─────────

export interface WalkConfig {
  /** React refs of elements to exclude */
  interactiveBlacklist?: React.RefObject<any>[];
  /** If set, only these elements are interactive */
  interactiveWhitelist?: React.RefObject<any>[];
  /** Optional screen name to scope interactives to the active screen */
  screenName?: string;
}

// ─── Fiber Node Type Detection ─────────────────────────────────

/** React Native component names that are inherently interactive */
const PRESSABLE_TYPES = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Button',
]);

const TEXT_INPUT_TYPES = new Set(['TextInput', 'RCTSinglelineTextInputView', 'RCTMultilineTextInputView']);
const SWITCH_TYPES = new Set(['Switch', 'RCTSwitch']);
const SLIDER_TYPES = new Set(['Slider', 'RNCSlider', 'RCTSlider']);
const PICKER_TYPES = new Set(['Picker', 'RNCPicker', 'RNPickerSelect', 'DropDownPicker', 'SelectDropdown']);
const DATE_PICKER_TYPES = new Set(['DateTimePicker', 'RNDateTimePicker', 'DatePicker', 'RNDatePicker']);
const TEXT_TYPES = new Set(['Text', 'RCTText']);

// Media component types for Component-Context Media Inference
const IMAGE_TYPES = new Set([
  'Image', 'RCTImageView', 'ExpoImage', 'FastImage', 'CachedImage',
]);
const VIDEO_TYPES = new Set([
  'Video', 'ExpoVideo', 'RCTVideo', 'VideoPlayer', 'VideoView',
]);



// Known RN internal component names to skip when walking up for context
const RN_INTERNAL_NAMES = new Set([
  'View', 'RCTView', 'Pressable', 'TouchableOpacity', 'TouchableHighlight',
  'ScrollView', 'RCTScrollView', 'FlatList', 'SectionList',
  'SafeAreaView', 'RNCSafeAreaView', 'KeyboardAvoidingView',
  'Modal', 'StatusBar', 'Text', 'RCTText', 'AnimatedComponent',
  'AnimatedComponentWrapper', 'Animated',
]);

const LOW_SIGNAL_RUNTIME_LABELS = new Set([
  'button', 'buttons', 'label', 'labels', 'title', 'titles', 'name',
  'text', 'value', 'values', 'content', 'card', 'cards', 'row', 'rows',
  'item', 'items', 'component', 'screen',
]);

// ─── State Extraction ──

/** Props to extract as state attributes — covers lazy devs who skip accessibility */
const STATE_PROPS = ['value', 'checked', 'selected', 'active', 'on', 'isOn', 'toggled', 'enabled'];

/**
 * Extract state attributes from a fiber node's props.
 * Extracts meaningful state from a fiber node.
 * Priority: accessibilityState > accessibilityRole > direct scalar props.
 */
function extractStateAttributes(props: any): string {
  const parts: string[] = [];

  // Priority 1: accessibilityState (proper ARIA equivalent)
  if (props.accessibilityState && typeof props.accessibilityState === 'object') {
    for (const [k, v] of Object.entries(props.accessibilityState)) {
      if (v !== undefined) parts.push(`${k}="${v}"`);
    }
  }

  // Priority 2: accessibilityRole
  if (props.accessibilityRole) {
    parts.push(`role="${props.accessibilityRole}"`);
  }

  // Priority 3: Direct scalar props fallback (lazy developer support)
  for (const key of STATE_PROPS) {
    if (props[key] !== undefined && typeof props[key] !== 'function' && typeof props[key] !== 'object') {
      parts.push(`${key}="${props[key]}"`);
    }
  }

  return parts.join(' ');
}

/**
 * Check if a node has ANY event handler prop (on* function).
 * Mirrors RNTL's getEventHandlerFromProps pattern.
 */
export function hasAnyEventHandler(props: any): boolean {
  if (!props || typeof props !== 'object') return false;
  for (const key of Object.keys(props)) {
    if (key.startsWith('on') && typeof props[key] === 'function') {
      return true;
    }
  }
  return false;
}

/**
 * Walk UP the Fiber tree to find the nearest custom (user-defined) component name.
 * Skips known React Native internal component names.
 * This provides semantic context for media elements (e.g., an Image inside "ProfileHeader").
 */
function getNearestCustomComponentName(fiber: any, maxDepth: number = 8): string | null {
  let current = fiber?.return;
  let depth = 0;
  while (current && depth < maxDepth) {
    const name = getComponentName(current);
    if (name && !RN_INTERNAL_NAMES.has(name) && !PRESSABLE_TYPES.has(name)) {
      return name;
    }
    current = current.return;
    depth++;
  }
  return null;
}

// ─── Fiber Node Helpers ────────────────────────────────────────

/**
 * Get the display name of a Fiber node's component type.
 */
function getComponentName(fiber: any): string | null {
  if (!fiber || !fiber.type) return null;

  // Host components (View, Text, etc.) — type is a string
  if (typeof fiber.type === 'string') return fiber.type;

  // Function/Class components — type has displayName or name
  if (fiber.type.displayName) return fiber.type.displayName;
  if (fiber.type.name) return fiber.type.name;

  // ForwardRef components
  if (fiber.type.render?.displayName) return fiber.type.render.displayName;
  if (fiber.type.render?.name) return fiber.type.render.name;

  return null;
}

/**
 * Check if a fiber node represents an interactive element.
 */
function getElementType(fiber: any): ElementType | null {
  const name = getComponentName(fiber);
  const props = fiber.memoizedProps || {};

  // Check by component name (known React Native types)
  if (name && PRESSABLE_TYPES.has(name)) return 'pressable';
  if (name && TEXT_INPUT_TYPES.has(name)) return 'text-input';
  if (name && SWITCH_TYPES.has(name)) return 'switch';
  if (name && SLIDER_TYPES.has(name)) return 'slider';
  if (name && PICKER_TYPES.has(name)) return 'picker';
  if (name && DATE_PICKER_TYPES.has(name)) return 'date-picker';

  // Check by accessibilityRole (covers custom components with proper ARIA)
  const role = props.accessibilityRole || props.role;
  if (role === 'switch') return 'switch';
  if (role === 'adjustable') return 'slider';
  if (role === 'button' || role === 'link' || role === 'checkbox' || role === 'radio') {
    return 'pressable';
  }

  // Check by props — any component with onPress is interactive
  if (props.onPress && typeof props.onPress === 'function') return 'pressable';

  // TextInput detection by props
  if (props.onChangeText && typeof props.onChangeText === 'function') return 'text-input';

  // Slider detection by props (has both onValueChange AND min/max values)
  if (props.onSlidingComplete && typeof props.onSlidingComplete === 'function') return 'slider';
  if (props.onValueChange && typeof props.onValueChange === 'function' &&
      (props.minimumValue !== undefined || props.maximumValue !== undefined)) return 'slider';

  // DatePicker detection by props
  if (props.onChange && typeof props.onChange === 'function' &&
      (props.mode === 'date' || props.mode === 'time' || props.mode === 'datetime')) return 'date-picker';

  // Switch detection by props (custom switches with onValueChange — no min/max)
  if (props.onValueChange && typeof props.onValueChange === 'function') return 'switch';

  return null;
}

/**
 * Check if element is disabled.
 */
function isDisabled(fiber: any): boolean {
  const props = fiber.memoizedProps || {};
  return props.disabled === true || props.editable === false;
}

/**
 * Recursively extract ALL text content from a fiber's children.
 * Pierces through nested interactive elements — unlike typical tree walkers
 * that stop at inner Pressable/TouchableOpacity boundaries.
 * 
 * This is critical for wrapper components (e.g. ZButton → internal
 * TouchableOpacity → Text) where stopping at nested interactives
 * would lose the text label entirely.
 */
function extractDeepTextContent(fiber: any, maxDepth: number = 10): string {
  if (!fiber || maxDepth <= 0) return '';

  const parts: string[] = [];

  let child = fiber.child;
  while (child) {
    const childName = getComponentName(child);
    const childProps = child.memoizedProps || {};

    // Text node — extract content
    if (childName && TEXT_TYPES.has(childName)) {
      const text = extractRawText(childProps.children);
      // Filter out icon font glyphs (Private Use Area unicode chars U+E000–U+F8FF)
      // Icon libraries (Ionicons, MaterialIcons, etc.) render as <Text> with
      // single-char glyphs that look blank in output but block icon name fallback
      if (text && !isIconGlyph(text)) {
        parts.push(text);
      }
    } else {
      // Recurse into ALL children, including nested interactives
      const nestedText = extractDeepTextContent(child, maxDepth - 1);
      if (nestedText) parts.push(nestedText);
    }

    child = child.sibling;
  }

  return parts.join(' ').trim();
}

/**
 * Check if a string is an icon font glyph character.
 * Icon fonts use Unicode Private Use Area (PUA) characters:
 * - Basic PUA: U+E000–U+F8FF
 * - Supplementary PUA-A: U+F0000–U+FFFFD
 * - Supplementary PUA-B: U+100000–U+10FFFD
 */
function isIconGlyph(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 2) return false; // Glyphs are 1-2 chars (surrogate pairs)
  const code = trimmed.codePointAt(0) || 0;
  return (code >= 0xE000 && code <= 0xF8FF) ||
         (code >= 0xF0000 && code <= 0xFFFFF) ||
         (code >= 0x100000 && code <= 0x10FFFF);
}

function normalizeRuntimeLabel(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function scoreRuntimeLabel(text: string, source: 'accessibility' | 'deep-text' | 'placeholder' | 'icon' | 'test-id' | 'context'): number {
  const normalized = normalizeRuntimeLabel(text);
  if (!normalized) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const words = normalized.split(/\s+/).filter(Boolean);
  const lowered = normalized.toLowerCase();

  if (source === 'deep-text') score += 70;
  if (source === 'accessibility') score += 80;
  if (source === 'placeholder') score += 25;
  if (source === 'context') score += 10;
  if (source === 'icon') score -= 10;
  if (source === 'test-id') score -= 25;

  if (normalized.length >= 3 && normalized.length <= 32) score += 20;
  else if (normalized.length > 60) score -= 10;

  if (words.length >= 2 && words.length <= 8) score += 20;
  else if (words.length === 1) score += 5;

  if (/^[A-Z]/.test(normalized)) score += 8;
  if (/[A-Za-z]/.test(normalized) && !/[_./]/.test(normalized)) score += 12;
  if (/[_./]/.test(normalized)) score -= 20;
  if (LOW_SIGNAL_RUNTIME_LABELS.has(lowered)) score -= 120;
  if (source === 'accessibility' && !LOW_SIGNAL_RUNTIME_LABELS.has(lowered)) score += 15;

  return score;
}

function chooseBestRuntimeLabel(candidates: Array<{
  text: string | null | undefined;
  source: 'accessibility' | 'deep-text' | 'placeholder' | 'icon' | 'test-id' | 'context';
}>): string | null {
  const best = candidates
    .map(candidate => ({
      text: normalizeRuntimeLabel(candidate.text),
      score: scoreRuntimeLabel(String(candidate.text || ''), candidate.source),
    }))
    .filter(candidate => candidate.text)
    .sort((a, b) => b.score - a.score)[0];

  return best?.text || null;
}

/**
 * Extract raw text from React children prop.
 * Handles strings, numbers, arrays, and nested structures.
 */
function extractRawText(children: any): string {
  if (children == null) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);

  if (Array.isArray(children)) {
    return children
      .map(child => extractRawText(child))
      .filter(Boolean)
      .join(' ');
  }

  // React element — try to extract text from its props
  if (children && typeof children === 'object' && children.props) {
    return extractRawText(children.props.children);
  }

  return '';
}

/**
 * Recursively search a fiber subtree for icon/symbol components and
 * return their `name` prop as a semantic label.
 * 
 * Works generically: any non-RN-internal child component with a string
 * `name` prop is treated as an icon (covers Ionicons, MaterialIcons,
 * FontAwesome, custom SVG wrappers, etc. — no hardcoded list needed).
 * 
 * e.g. a TouchableOpacity wrapping <Ionicons name="add-circle" /> → "icon:add-circle"
 */
function extractIconName(fiber: any, maxDepth: number = 5): string {
  if (!fiber || maxDepth <= 0) return '';

  let child = fiber.child;
  while (child) {
    const componentName = getComponentName(child);
    const childProps = child.memoizedProps || {};

    // Generic icon detection: non-RN-internal component with a string `name` prop
    if (
      componentName &&
      !RN_INTERNAL_NAMES.has(componentName) &&
      !PRESSABLE_TYPES.has(componentName) &&
      !TEXT_INPUT_TYPES.has(componentName) &&
      typeof childProps.name === 'string' &&
      childProps.name.length > 0
    ) {
      return `icon:${childProps.name}`;
    }

    // Recurse into ALL children (pierce through nested interactives)
    const found = extractIconName(child, maxDepth - 1);
    if (found) return found;

    child = child.sibling;
  }
  return '';
}

/**
 * Get the Fiber root node via __REACT_DEVTOOLS_GLOBAL_HOOK__.
 *
 * This hook is injected by React in development builds so React DevTools
 * can inspect the component tree. It is NOT available in release/production.
 * Used as a last-resort fallback when ref-based strategies fail.
 */
function getFiberRootFromDevTools(): any | null {
  try {
    const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      const renderers = hook.renderers;
      if (renderers && renderers.size > 0) {
        for (const [rendererId] of renderers) {
          const roots = hook.getFiberRoots(rendererId);
          if (roots && roots.size > 0) {
            const fiberRoot = roots.values().next().value;
            if (fiberRoot && fiberRoot.current) {
              logger.debug('FiberTreeWalker', 'Accessed Fiber tree via DevTools hook');
              return fiberRoot.current;
            }
          }
        }
      }
    }
  } catch (e) {
    logger.debug('FiberTreeWalker', 'DevTools hook not available:', e);
  }

  return null;
}

/**
 * Resolve a Fiber node from a React ref.
 *
 * Strategy order prioritizes ref-based access (works in BOTH dev and release)
 * over the DevTools hook (dev-only):
 *
 * 1. __reactFiber$ keys — React attaches these to native host nodes in both
 *    dev and release. This is how the reconciler maps native nodes back to
 *    their Fiber. Most reliable for <View ref={...}> refs.
 * 2. _reactInternals — available on class component instances.
 * 3. _reactInternalInstance — legacy React (pre-Fiber) pattern.
 * 4. Direct fiber properties — ref IS already a Fiber node (e.g. in tests).
 * 5. __REACT_DEVTOOLS_GLOBAL_HOOK__ — dev-only last resort. Finds the root
 *    Fiber regardless of what ref is, but stripped in production builds.
 */
function getFiberFromRef(ref: any): any | null {
  if (!ref) return null;

  // Strategy 1: __reactFiber$ keys (React DOM/RN style)
  // Works in both dev AND release builds — primary strategy.
  try {
    const keys = Object.keys(ref);
    const fiberKey = keys.find(
      key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'),
    );
    if (fiberKey) {
      logger.debug('FiberTreeWalker', 'Accessed Fiber tree via __reactFiber$ key');
      return (ref as any)[fiberKey];
    }
  } catch {
    // Object.keys may fail on some native nodes
  }

  // Strategy 2: _reactInternals (class components)
  if (ref._reactInternals) return ref._reactInternals;

  // Strategy 3: _reactInternalInstance (older React)
  if (ref._reactInternalInstance) return ref._reactInternalInstance;

  // Strategy 4: Direct fiber node properties (ref IS a fiber — used in tests)
  if (ref.child || ref.memoizedProps) return ref;

  // Strategy 5: DevTools hook (dev-only last resort)
  // Guarded by __DEV__ to ensure production builds never reference
  // __REACT_DEVTOOLS_GLOBAL_HOOK__ — avoids App Store automated scanner flags.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const rootFiber = getFiberRootFromDevTools();
    if (rootFiber) return rootFiber;
  }

  console.warn(
    '[AIAgent] Could not access React Fiber tree. ' +
    'The AI agent will not be able to detect interactive elements. ' +
    'Ensure the rootRef is attached to a rendered <View>.'
  );
  logger.warn('FiberTreeWalker', 'All Fiber access strategies failed');
  return null;
}

// ─── Blacklist/Whitelist Matching ──────────────────────────────

/**
 * Check if a Fiber node matches any ref in the given list.
 * Checks if an element is excluded from AI interaction
 * We compare the Fiber's stateNode (native instance) against ref.current.
 */
function matchesRefList(node: any, refs?: React.RefObject<any>[]): boolean {
  if (!refs || refs.length === 0) return false;
  const stateNode = node.stateNode;
  if (!stateNode) return false;

  for (const ref of refs) {
    if (ref.current && ref.current === stateNode) return true;
  }
  return false;
}

export interface WalkResult {
  elementsText: string;
  interactives: InteractiveElement[];
}

// ─── Note on overlays ──────────────────────────────────────────
// Toasts, modals, and dialogs are now captured naturally because
// walkFiberTree starts from the root Fiber and prunes only
// display:none nodes (inactive screens). No separate overlay scan needed.

// ─── Main Tree Walker ──────────────────────────────────────────

/**
 * Walk the React Fiber tree from a root and collect all interactive elements
 * as well as a hierarchical layout representation for the LLM.
 */
export function walkFiberTree(rootRef: any, config?: WalkConfig): WalkResult {
  const fiber = getFiberFromRef(rootRef);
  if (!fiber) {
    logger.warn('FiberTreeWalker', 'Could not access Fiber tree from ref');
    return { elementsText: '', interactives: [] };
  }

  // Always walk from the root Fiber — inactive screens are pruned inside
  // processNode by checking for display:none, which React Navigation applies
  // to all inactive screens. This ensures navigation chrome (tab bar, header)
  // is always included without hardcoding any component names.
  const startNode = fiber;
  if (config?.screenName) {
    logger.debug('FiberTreeWalker', `Walk active for screen "${config.screenName}" (inactive screens pruned via display:none)`);
  }

  // Overlay detection is superseded by root-level walk — all visible nodes
  // (toasts, modals, overlays) are included naturally since they aren't hidden.
  const overlayNodes: any[] = [];

  const interactives: InteractiveElement[] = [];
  let currentIndex = 0;
  const hasWhitelist = config?.interactiveWhitelist && (config.interactiveWhitelist.length ?? 0) > 0;

  function processNode(
    node: any, 
    depth: number = 0, 
    isInsideInteractive: boolean = false, 
    ancestorOnPress: any = null,
    currentZoneId: string | undefined = undefined
  ): string {
    if (!node) return '';

    const props = node.memoizedProps || {};

    // ── Prune inactive screens ──────────────────────────────────
    // Two mechanisms cover all React Navigation setups:
    //
    // 1. react-native-screens (Expo default, recommended):
    //    React Navigation sets activityState=0 on inactive tab screens.
    //    Stack screens retain activityState=2 even in the background (NativeStack
    //    never decreases activityState — confirmed from react-native-screens source).
    //    Those are kept as useful navigation history context for the agent.
    //
    // 2. ResourceSavingScene (React Navigation fallback without react-native-screens):
    //    Wraps inactive screen content with pointerEvents="none". Prune any such wrapper.
    //
    // Both are prop-based — no component names, no CSS display property.
    if (props.activityState === 0) return '';
    if (props.pointerEvents === 'none') return '';

    // ── Security Constraints ──
    if (props.aiIgnore === true) return '';
    if (matchesRefList(node, config?.interactiveBlacklist)) {
      let childText = '';
      let currentChild = node.child;
      while (currentChild) {
        childText += processNode(currentChild, depth, isInsideInteractive);
        currentChild = currentChild.sibling;
      }
      return childText;
    }

    // Interactive check — nested interactives with a DIFFERENT onPress than
    // their ancestor are separate actions (e.g. "+" button inside a dish card).
    // Only suppress true wrapper duplicates (same onPress reference).
    const isWhitelisted = matchesRefList(node, config?.interactiveWhitelist);
    const elementType = getElementType(node);
    let shouldInclude = false;
    if (hasWhitelist) {
      shouldInclude = isWhitelisted;
    } else if (elementType && !isDisabled(node)) {
      if (!isInsideInteractive) {
        shouldInclude = true;
      } else {
        // Inside an ancestor interactive — only include if onPress is DIFFERENT
        const ownOnPress = props.onPress;
        shouldInclude = !!ownOnPress && ownOnPress !== ancestorOnPress;
      }
    }

    // Track the onPress for descendant dedup
    const nextAncestorOnPress = shouldInclude ? (props.onPress || ancestorOnPress) : ancestorOnPress;

    // Determine if this node produces visible output (affects depth for children)
    // Only visible nodes (interactives, text, images, videos) should increment
    // depth. Structural View wrappers are transparent — they pass through the
    // same depth so indentation stays flat and doesn't waste LLM tokens.
    const typeStr = node.type && typeof node.type === 'string' ? node.type : 
                   (node.elementType && typeof node.elementType === 'string' ? node.elementType : null);
    const componentName = getComponentName(node);
    const isTextNode = typeStr === 'RCTText' || typeStr === 'Text';
    const isImageNode = !!(componentName && IMAGE_TYPES.has(componentName));
    const isVideoNode = !!(componentName && VIDEO_TYPES.has(componentName));
    const producesOutput = shouldInclude || isTextNode || isImageNode || isVideoNode;
    const childDepth = producesOutput ? depth + 1 : depth;

    const nextZoneId = componentName === 'AIZone' && props.id ? props.id : currentZoneId;

    const indent = '  '.repeat(depth);

    // ── Zone Header Emission ──────────────────────────────────
    // When entering an AIZone boundary, emit a section header so the agent
    // knows this zone exists, what its id is, and what it's allowed to do.
    // This is what lets the agent call simplify_zone / guide_user proactively.
    let zoneHeader = '';
    if (componentName === 'AIZone' && props.id) {
      const permissions: string[] = [];
      if (props.allowSimplify) permissions.push('simplify');
      if (props.allowHighlight) permissions.push('highlight');
      if (props.allowInjectHint) permissions.push('hint');
      if (props.allowInjectCard) permissions.push('card');
      const permStr = permissions.length ? ` | permissions: ${permissions.join(', ')}` : '';
      zoneHeader = `${indent}[zone: ${props.id}${permStr}]\n`;
    }

    // Process children
    let childrenText = '';
    let currentChild = node.child;
    while (currentChild) {
      childrenText += processNode(
        currentChild,
        childDepth,
        isInsideInteractive || !!shouldInclude,
        nextAncestorOnPress,
        nextZoneId,
      );
      currentChild = currentChild.sibling;
    }

    // Prepend zone header before children if this is a zone root
    if (zoneHeader) {
      childrenText = zoneHeader + childrenText;
    }

    if (shouldInclude) {
      const resolvedType = elementType || 'pressable';
      const parentContext = getNearestCustomComponentName(node);
      const label = chooseBestRuntimeLabel([
        { text: props.accessibilityLabel, source: 'accessibility' },
        { text: extractDeepTextContent(node), source: 'deep-text' },
        { text: resolvedType === 'text-input' ? props.placeholder : null, source: 'placeholder' },
        { text: extractIconName(node), source: 'icon' },
        { text: props.testID || props.nativeID, source: 'test-id' },
        {
          text: parentContext && !new Set([
            'ScrollViewContext', 'VirtualizedListContext', 'ViewabilityHelper',
            'ScrollResponder', 'AnimatedComponent', 'TouchableOpacity',
          ]).has(parentContext) ? parentContext : null,
          source: 'context',
        },
      ]);

      interactives.push({
        index: currentIndex,
        type: resolvedType,
        label: label || `[${resolvedType}]`,
        aiPriority: props.aiPriority,
        zoneId: currentZoneId,
        fiberNode: node,
        props: { ...props },
        requiresConfirmation: props.aiConfirm === true,
      });

      // Build output tag with state attributes
      const stateAttrs = extractStateAttributes(props);
      let attrStr = stateAttrs ? ` ${stateAttrs}` : '';
      if (props.aiPriority) {
        attrStr += ` aiPriority="${props.aiPriority}"`;
        if (currentZoneId) attrStr += ` zoneId="${currentZoneId}"`;
      }
      
      if (props.aiConfirm === true) {
        attrStr += ' aiConfirm';
      }
      
      const textContent = label || '';
      const elementOutput = `${indent}[${currentIndex}]<${resolvedType}${attrStr}>${textContent} />${childrenText.trim() ? '\n' + childrenText : ''}\n`;
      currentIndex++;
      return elementOutput;
    }

    // Non-interactive structural nodes — collapse view chains to reduce noise
    // Only emit text content; structural <view> wrappers are transparent
    if (isTextNode) {
      const textContent = extractRawText(props.children);
      if (textContent && textContent.trim() !== '') {
        const priorityTag = props.aiPriority ? ` (aiPriority="${props.aiPriority}"${currentZoneId ? ` zoneId="${currentZoneId}"` : ''})` : '';
        return `${indent}${textContent.trim()}${priorityTag}\n`;
      }
    }

    // ── Media Detection: Component-Context Media Inference ──
    if (isImageNode) {
      const context = getNearestCustomComponentName(node);
      const alt = props.alt || props.accessibilityLabel || '';
      // Emit the full URI so Gemini can use vision to analyze the image
      const src = typeof props.source === 'object' && props.source?.uri
        ? props.source.uri
        : '';
      const attrs = [
        context ? `in="${context}"` : '',
        alt ? `alt="${alt}"` : '',
        src ? `src="${src}"` : '',
      ].filter(Boolean).join(' ');
      return `${indent}[image${attrs ? ' ' + attrs : ''}]\n`;
    }

    if (isVideoNode) {
      const context = getNearestCustomComponentName(node);
      const paused = props.paused !== undefined ? props.paused : props.shouldPlay !== undefined ? !props.shouldPlay : null;
      // Capture video source URI and poster image
      const src = typeof props.source === 'object' && props.source?.uri
        ? props.source.uri
        : '';
      const poster = props.posterSource?.uri || props.poster || '';
      const attrs = [
        context ? `in="${context}"` : '',
        paused !== null ? `state="${paused ? 'paused' : 'playing'}"` : '',
        src ? `src="${src}"` : '',
        poster ? `poster="${poster}"` : '',
      ].filter(Boolean).join(' ');
      return `${indent}[video${attrs ? ' ' + attrs : ''}]\n`;
    }

    // Structural views: pass children through without adding <view> wrapper
    // This collapses the 50+ nesting levels into flat, readable output
    return childrenText;
  }

  let elementsText = processNode(startNode, 0);

  // Second pass: walk overlay nodes (toasts, dialogs, modals)
  // These render outside the screen subtree — detected by findOverlayNodes()
  if (overlayNodes.length > 0) {
    let overlayText = '';
    for (const overlay of overlayNodes) {
      const name = getComponentName(overlay);
      overlayText += `\n--- ${name || 'Overlay'} ---\n`;
      overlayText += processNode(overlay, 0);
    }
    if (overlayText.trim()) {
      elementsText += '\n' + overlayText;
      logger.info('FiberTreeWalker', `Included ${overlayNodes.length} overlay(s) in screen context`);
    }
  }

  // Clean up excessive blank lines
  elementsText = elementsText.replace(/\n{3,}/g, '\n\n');
  
  logger.info('FiberTreeWalker', `Found ${interactives.length} interactive elements`);
  return { elementsText: elementsText.trim(), interactives };
}

// ─── Scrollable Container Detection ────────────────────────────

/** React Native component names that are scrollable containers */
const SCROLLABLE_TYPES = new Set([
  'ScrollView', 'RCTScrollView',
  'FlatList', 'SectionList', 'VirtualizedList',
]);

/**
 * React Native component names that are pager/tab containers.
 * These look scrollable but use page-based navigation internally.
 * Scrolling them directly causes native assertion crashes (e.g. setPage(NSNull)).
 * Pattern: Detox's ScrollToIndexAction.getConstraints() rejects these entirely.
 */
const PAGER_TYPES = new Set([
  'RNCViewPager', 'PagerView', 'ViewPager',
  'RNViewPager', 'TabView', 'MaterialTabView',
  'ScrollableTabView', 'RNTabView',
]);

export interface ScrollableContainer {
  /** Index for identification when multiple scrollables exist */
  index: number;
  /** Component name (e.g., 'FlatList', 'ScrollView') */
  componentName: string;
  /** Contextual label — nearest custom component name or text header */
  label: string;
  /** The Fiber node */
  fiberNode: any;
  /** The native stateNode (has scrollToOffset, scrollToEnd, etc.) */
  stateNode: any;
  /**
   * True if this container is a PagerView/TabView.
   * These must NOT be scrolled — use tap on tab labels instead.
   * Pattern from Detox: ScrollToIndexAction rejects non-ScrollView types.
   */
  isPagerLike: boolean;
}

/**
 * Find the fiber node whose component name matches the given screen name.
 * Matches by checking if the component name starts with or equals the screen name.
 * e.g., screenName "Menu" matches component "MenuScreen" or "Menu".
 *
 * Returns the first (deepest active) match found via depth-first search.
 */
function findScreenFiberNode(rootFiber: any, screenName: string): any | null {
  if (!rootFiber || !screenName) return null;

  const lowerScreen = screenName.toLowerCase();

  function search(node: any): any | null {
    if (!node) return null;

    const name = getComponentName(node);
    if (name) {
      const lowerName = name.toLowerCase();
      // Match: "MenuScreen" starts with "menu", or "Menu" equals "menu"
      if (lowerName.startsWith(lowerScreen) || lowerScreen.startsWith(lowerName)) {
        return node;
      }
    }

    // Depth-first: search children first, then siblings
    let child = node.child;
    while (child) {
      const found = search(child);
      if (found) return found;
      child = child.sibling;
    }

    return null;
  }

  return search(rootFiber);
}

/**
 * Walk the Fiber tree to discover scrollable containers.
 * Returns native stateNodes that expose scrollToOffset(), scrollToEnd(), scrollTo().
 *
 * When `screenName` is provided, the search is scoped to the matching screen's
 * subtree — this prevents finding containers from other mounted screens
 * (React Navigation keeps all stack screens in the tree).
 *
 * For FlatList: the Fiber's stateNode is a VirtualizedList instance.
 * Its underlying scroll view can be accessed via getNativeScrollRef() or
 * getScrollRef(), which returns the native ScrollView with scrollTo/scrollToEnd.
 *
 * For ScrollView: the stateNode IS the native scroll view directly.
 */
export function findScrollableContainers(rootRef: any, screenName?: string): ScrollableContainer[] {
  const fiber = getFiberFromRef(rootRef);
  if (!fiber) {
    logger.warn('FiberTreeWalker', 'Could not access Fiber tree for scroll detection');
    return [];
  }

  // Scope to the active screen's subtree when screenName is provided
  let startNode = fiber;
  if (screenName) {
    const screenFiber = findScreenFiberNode(fiber, screenName);
    if (screenFiber) {
      startNode = screenFiber;
      logger.debug('FiberTreeWalker', `Scroll scoped to screen "${screenName}" (component: ${getComponentName(screenFiber)})`);
    } else {
      logger.debug('FiberTreeWalker', `Screen "${screenName}" not found in Fiber tree — searching entire tree`);
    }
  }

  const containers: ScrollableContainer[] = [];
  let currentIndex = 0;

  function walk(node: any): void {
    if (!node) return;

    const name = getComponentName(node);
    const isScrollable = name && SCROLLABLE_TYPES.has(name);
    const isPagerLike = name ? PAGER_TYPES.has(name) : false;

    if (isScrollable || isPagerLike) {
      // Get context: nearest custom parent component name
      const contextLabel = getNearestCustomComponentName(node) || name || 'Unknown';

      // For scrollable containers, we need the native scroll ref.
      // FlatList Fiber stateNode may be the component instance — 
      // we need to find the underlying native ScrollView.
      let scrollRef = isPagerLike ? node.stateNode : resolveNativeScrollRef(node);

      if (scrollRef) {
        containers.push({
          index: currentIndex++,
          componentName: name || 'Unknown',
          label: contextLabel,
          fiberNode: node,
          stateNode: scrollRef,
          isPagerLike,
        });
      }
    }

    // Recurse into children and siblings
    let child = node.child;
    while (child) {
      walk(child);
      child = child.sibling;
    }
  }

  walk(startNode);
  logger.info('FiberTreeWalker', `Found ${containers.length} scrollable container(s)${screenName ? ` for screen "${screenName}"` : ''}`);
  return containers;
}

/**
 * Resolve the native scroll view reference from a Fiber node.
 * 
 * Handles multiple React Native internals:
 * - RCTScrollView: stateNode IS the native scroll view
 * - FlatList/VirtualizedList: stateNode is a component instance,
 *   need to find the inner ScrollView via getNativeScrollRef() or
 *   by walking down the Fiber tree to find the RCTScrollView child
 */
function resolveNativeScrollRef(fiberNode: any): any {
  const stateNode = fiberNode.stateNode;

  // Case 1: stateNode has scrollTo (native ScrollView or RCTScrollView)
  if (stateNode && typeof stateNode.scrollTo === 'function') {
    return stateNode;
  }

  // Case 2: stateNode has getNativeScrollRef (FlatList / VirtualizedList)
  if (stateNode && typeof stateNode.getNativeScrollRef === 'function') {
    try {
      const ref = stateNode.getNativeScrollRef();
      if (ref && typeof ref.scrollTo === 'function') return ref;
    } catch { /* fall through */ }
  }

  // Case 3: stateNode has getScrollRef (another VirtualizedList pattern)
  if (stateNode && typeof stateNode.getScrollRef === 'function') {
    try {
      const ref = stateNode.getScrollRef();
      if (ref && typeof ref.scrollTo === 'function') return ref;
      // getScrollRef might return another wrapper — try getNativeScrollRef on it
      if (ref && typeof ref.getNativeScrollRef === 'function') {
        const nativeRef = ref.getNativeScrollRef();
        if (nativeRef && typeof nativeRef.scrollTo === 'function') return nativeRef;
      }
    } catch { /* fall through */ }
  }

  // Case 4: stateNode has scrollToOffset directly (VirtualizedList instance)
  if (stateNode && typeof stateNode.scrollToOffset === 'function') {
    return stateNode;
  }

  // Case 5: Walk down Fiber tree to find an RCTScrollView child
  let child = fiberNode.child;
  while (child) {
    const childName = getComponentName(child);
    if (childName === 'RCTScrollView' && child.stateNode) {
      return child.stateNode;
    }
    // Go one level deeper for wrapper patterns
    if (child.child) {
      const grandchildName = getComponentName(child.child);
      if (grandchildName === 'RCTScrollView' && child.child.stateNode) {
        return child.child.stateNode;
      }
    }
    child = child.sibling;
  }

  logger.debug('FiberTreeWalker', 'Could not resolve native scroll ref — returning stateNode as fallback');
  return stateNode;
}

/**
 * FiberTreeWalker — Traverses React's Fiber tree to discover interactive elements.
 *
 * This is the React Native equivalent of page-agent.js reading the DOM.
 * Instead of traversing HTML nodes, we traverse React Fiber nodes and detect
 * interactive elements by their type and props (onPress, onChangeText, etc.).
 *
 * Architecture inspired by: https://github.com/alibaba/page-agent
 */

import { logger } from '../utils/logger';
import type { InteractiveElement, ElementType } from './types';

// ─── Walk Configuration (mirrors page-agent DomConfig) ─────────

export interface WalkConfig {
  /** React refs of elements to exclude — mirrors page-agent interactiveBlacklist */
  interactiveBlacklist?: React.RefObject<any>[];
  /** If set, only these elements are interactive — mirrors page-agent interactiveWhitelist */
  interactiveWhitelist?: React.RefObject<any>[];
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
const TEXT_TYPES = new Set(['Text', 'RCTText']);
// ScrollView/FlatList/SectionList detection can be added later for scroll tool

// ─── State Extraction (mirrors page-agent DEFAULT_INCLUDE_ATTRIBUTES) ──

/** Props to extract as state attributes — covers lazy devs who skip accessibility */
const STATE_PROPS = ['value', 'checked', 'selected', 'active', 'on', 'isOn', 'toggled', 'enabled'];

/**
 * Extract state attributes from a fiber node's props.
 * Mirrors page-agent's DEFAULT_INCLUDE_ATTRIBUTES extraction.
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

  // Check by accessibilityRole (covers custom components with proper ARIA)
  const role = props.accessibilityRole || props.role;
  if (role === 'switch') return 'switch';
  if (role === 'button' || role === 'link' || role === 'checkbox' || role === 'radio') {
    return 'pressable';
  }

  // Check by props — any component with onPress is interactive
  if (props.onPress && typeof props.onPress === 'function') return 'pressable';

  // TextInput detection by props
  if (props.onChangeText && typeof props.onChangeText === 'function') return 'text-input';

  // Switch detection by props (custom switches with onValueChange)
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

// ─── Text Extraction ───────────────────────────────────────────

/**
 * Recursively extract text content from a fiber's children.
 * Stops at the next interactive element to avoid capturing text from nested buttons.
 */
function extractTextContent(fiber: any, maxDepth: number = 10): string {
  if (!fiber || maxDepth <= 0) return '';

  const parts: string[] = [];

  let child = fiber.child;
  while (child) {
    const childName = getComponentName(child);
    const childProps = child.memoizedProps || {};

    // Stop at nested interactive elements
    if (getElementType(child) !== null && child !== fiber) {
      child = child.sibling;
      continue;
    }

    // Text node — extract content
    if (childName && TEXT_TYPES.has(childName)) {
      const text = extractRawText(childProps.children);
      if (text) parts.push(text);
    } else {
      // Recurse into non-interactive children
      const nestedText = extractTextContent(child, maxDepth - 1);
      if (nestedText) parts.push(nestedText);
    }

    child = child.sibling;
  }

  return parts.join(' ').trim();
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
 * Get the Fiber root node.
 * 
 * In React Native, a View ref gives a native node, NOT a Fiber node.
 * We use __REACT_DEVTOOLS_GLOBAL_HOOK__ (available in dev builds) to
 * access getFiberRoots(), which is the same API React DevTools uses.
 * 
 * Falls back to probing the ref's internal keys for Fiber references.
 */
function getFiberRoot(): any | null {
  // Strategy 1: __REACT_DEVTOOLS_GLOBAL_HOOK__ (most reliable in dev)
  try {
    const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      // hook.renderers is a Map of renderer ID → renderer
      // hook.getFiberRoots(rendererId) returns a Set of FiberRoot objects
      const renderers = hook.renderers;
      if (renderers && renderers.size > 0) {
        for (const [rendererId] of renderers) {
          const roots = hook.getFiberRoots(rendererId);
          if (roots && roots.size > 0) {
            // Get the first (and usually only) root
            const fiberRoot = roots.values().next().value;
            if (fiberRoot && fiberRoot.current) {
              logger.debug('FiberTreeWalker', 'Accessed Fiber tree via DevTools hook');
              return fiberRoot.current; // This is the root Fiber node
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

function getFiberFromRef(ref: any): any | null {
  // First try the DevTools hook (works regardless of what ref is)
  const rootFiber = getFiberRoot();
  if (rootFiber) return rootFiber;

  if (!ref) return null;

  // Fallback: Try known internal Fiber access patterns on the ref itself

  // Pattern 1: _reactInternals (class components)
  if (ref._reactInternals) return ref._reactInternals;

  // Pattern 2: _reactInternalInstance (older React)
  if (ref._reactInternalInstance) return ref._reactInternalInstance;

  // Pattern 3: __reactFiber$ keys (React DOM/RN style) 
  try {
    const keys = Object.keys(ref);
    const fiberKey = keys.find(
      key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'),
    );
    if (fiberKey) return (ref as any)[fiberKey];
  } catch {
    // Object.keys may fail on some native nodes
  }

  // Pattern 4: Direct fiber node properties
  if (ref.child || ref.memoizedProps) return ref;

  logger.warn('FiberTreeWalker', 'All Fiber access strategies failed');
  return null;
}

// ─── Blacklist/Whitelist Matching ──────────────────────────────

/**
 * Check if a Fiber node matches any ref in the given list.
 * Mirrors page-agent.js: `interactiveBlacklist.includes(element)`
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

  const interactives: InteractiveElement[] = [];
  let currentIndex = 0;
  const hasWhitelist = config?.interactiveWhitelist && (config.interactiveWhitelist.length ?? 0) > 0;

  function processNode(node: any, depth: number = 0, isInsideInteractive: boolean = false): string {
    if (!node) return '';

    const props = node.memoizedProps || {};

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

    // Interactive check — skip if already inside an interactive ancestor (dedup nested TextInput layers)
    const isWhitelisted = matchesRefList(node, config?.interactiveWhitelist);
    const elementType = getElementType(node);
    const shouldInclude = !isInsideInteractive && (hasWhitelist ? isWhitelisted : (elementType && !isDisabled(node)));

    // Process children — if this node IS interactive, children won't register as separate interactives
    let childrenText = '';
    let currentChild = node.child;
    while (currentChild) {
      childrenText += processNode(currentChild, depth + 1, isInsideInteractive || !!shouldInclude);
      currentChild = currentChild.sibling;
    }

    const indent = '  '.repeat(depth);

    if (shouldInclude) {
      const resolvedType = elementType || 'pressable';
      let label = props.accessibilityLabel || extractTextContent(node);
      if (!label && resolvedType === 'text-input' && props.placeholder) {
        label = props.placeholder;
      }

      interactives.push({
        index: currentIndex,
        type: resolvedType,
        label: label || `[${resolvedType}]`,
        fiberNode: node,
        props: { ...props },
      });

      // Build output tag with state attributes (mirrors page-agent format)
      const stateAttrs = extractStateAttributes(props);
      const attrStr = stateAttrs ? ` ${stateAttrs}` : '';
      const textContent = label || '';
      const elementOutput = `${indent}[${currentIndex}]<${resolvedType}${attrStr}>${textContent} />${childrenText.trim() ? '\n' + childrenText : ''}\n`;
      currentIndex++;
      return elementOutput;
    }

    // Non-interactive structural nodes
    const typeStr = node.type && typeof node.type === 'string' ? node.type : 
                   (node.elementType && typeof node.elementType === 'string' ? node.elementType : null);

    if (typeStr === 'RCTText' || typeStr === 'Text') {
      const textContent = extractRawText(props.children);
      if (textContent && textContent.trim() !== '') {
        return `${indent}<text>${textContent.trim()}</text>\n`;
      }
    }

    if (childrenText.trim() !== '') {
      return `${indent}<view>\n${childrenText}${indent}</view>\n`;
    }

    return '';
  }

  let elementsText = processNode(fiber, 0);

  // Clean up empty views and excessive newlines
  elementsText = elementsText.replace(/<view>\s*<\/view>\n?/g, '');
  
  logger.info('FiberTreeWalker', `Found ${interactives.length} interactive elements`);
  return { elementsText: elementsText.trim(), interactives };
}

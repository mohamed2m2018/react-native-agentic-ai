/**
 * AST-based content extractor for React Native screen files.
 * Parses JSX to extract interactive elements, text labels, and navigation links.
 *
 * Supports comprehensive component detection via category-based classification:
 *  - Inputs:   TextInput, *Input
 *  - Toggles:  Switch, *Toggle
 *  - Buttons:  Button, Pressable, TouchableOpacity, *Button, *Btn
 *  - Images:   Image, FastImage, *Avatar, *Image
 *  - Lists:    FlatList, SectionList, ScrollView, VirtualizedList
 *  - Modals:   Modal, *Modal, *Sheet, *Dialog, *BottomSheet
 *  - Icons:    Ionicons, MaterialIcon, FontAwesome, *_Dark, *_Light (skipped — noise)
 *  - Custom:   Any PascalCase component not matched above
 *
 * Also captures navigation links from:
 *  - Expo Router: <Link href="..." />, router.navigate/push/replace
 *  - React Navigation: navigation.navigate/push/replace, <Link screen="..." />
 */

import { parse } from '@babel/parser';
import * as _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (_traverse as any).default || _traverse;

export interface ExtractedContent {
  elements: string[];
  navigationLinks: string[];
}

// ─── Component classification ────────────────────────────────

/** RN layout primitives we always skip (they carry no semantic meaning) */
const LAYOUT_PRIMITIVES = new Set([
  'View', 'SafeAreaView', 'Fragment', 'KeyboardAvoidingView',
  'StatusBar', 'LinearGradient', 'Animated',
]);

/** Exact-match icon component names */
const ICON_EXACT = new Set([
  'Ionicons', 'MaterialIcon', 'MaterialCommunityIcons',
  'FontAwesome', 'FontAwesome5', 'Feather', 'Entypo',
  'AntDesign', 'EvilIcons', 'Foundation', 'Octicons',
  'SimpleLineIcons', 'Zocial', 'MaterialIcons',
]);

/** Exact-match pressable component names */
const PRESSABLE_EXACT = new Set([
  'Pressable', 'TouchableOpacity', 'TouchableHighlight',
  'TouchableWithoutFeedback', 'TouchableNativeFeedback',
]);

/** Exact-match list component names */
const LIST_EXACT = new Set([
  'FlatList', 'SectionList', 'VirtualizedList',
]);

/** Exact-match image component names */
const IMAGE_EXACT = new Set([
  'Image', 'FastImage', 'ImageBackground',
]);

type ComponentCategory =
  | 'input' | 'toggle' | 'button' | 'image'
  | 'list' | 'modal' | 'icon' | 'navigation'
  | 'custom' | 'skip';

/**
 * Classify a JSX element name into a semantic category.
 * Order matters: more specific checks first, custom catch-all last.
 */
function classifyComponent(name: string): ComponentCategory {
  // Skip layout primitives
  if (LAYOUT_PRIMITIVES.has(name)) return 'skip';
  // Skip RN text wrappers (we extract text content, not the wrapper)
  if (name === 'Text' || name === 'ScrollView') return 'skip';

  // Exact matches
  if (name === 'TextInput') return 'input';
  if (name === 'Switch') return 'toggle';
  if (name === 'Button') return 'button';
  if (name === 'Modal') return 'modal';
  if (name === 'Link' || name === 'Redirect') return 'navigation';
  if (PRESSABLE_EXACT.has(name)) return 'button';
  if (LIST_EXACT.has(name)) return 'list';
  if (IMAGE_EXACT.has(name)) return 'image';
  if (ICON_EXACT.has(name)) return 'icon';

  // Pattern matches (suffix/contains)
  if (name.endsWith('Input') || name.endsWith('Field')) return 'input';
  if (name.endsWith('Toggle')) return 'toggle';
  if (name.endsWith('Button') || name.endsWith('Btn')) return 'button';
  if (name.endsWith('Image') || name.endsWith('Avatar') || name.endsWith('Photo')) return 'image';
  if (name.endsWith('List')) return 'list';
  if (name.endsWith('Modal') || name.endsWith('Sheet') || name.endsWith('Dialog') || name.includes('BottomSheet')) return 'modal';

  // Icon patterns: ends with Icon, or SVG asset convention (*_Dark, *_Light)
  if (name.endsWith('Icon') || name.endsWith('_Dark') || name.endsWith('_Light')) return 'icon';

  // If it's PascalCase (starts with uppercase) and not a known primitive, it's a custom component
  if (name[0] === name[0]?.toUpperCase() && name[0] !== name[0]?.toLowerCase()) {
    return 'custom';
  }

  return 'skip';
}

// ─── Core extraction ──────────────────────────────────────────

/**
 * Extract interactive elements and navigation links from a screen file's source code.
 */
export function extractContentFromAST(sourceCode: string, filePath: string): ExtractedContent {
  const elements: string[] = [];
  const navigationLinks: string[] = [];

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    console.warn(`[generate-map] Failed to parse ${filePath}, skipping AST extraction`);
    return { elements, navigationLinks };
  }

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const nameNode = path.node.name;
      const elementName = getJSXElementName(nameNode);
      if (!elementName) return;

      const category = classifyComponent(elementName);

      switch (category) {
        case 'input': {
          const placeholder = getStringAttribute(path.node, 'placeholder');
          elements.push(placeholder ? `${placeholder} (text-input)` : 'text input (text-input)');
          break;
        }

        case 'toggle': {
          const label = findSiblingTextLabel(path);
          elements.push(label ? `${label} (switch)` : 'toggle (switch)');
          break;
        }

        case 'button': {
          // RN built-in Button uses `title` prop
          if (elementName === 'Button') {
            const title = getStringAttribute(path.node, 'title');
            elements.push(title ? `${title} (button)` : 'button (button)');

            // React Navigation: <Button screen="Details" />
            const screenTarget = getStringAttribute(path.node, 'screen');
            if (screenTarget) navigationLinks.push(screenTarget);
          } else {
            // Pressable/TouchableOpacity — find text label in children
            const buttonLabel = findChildTextContentRecursive(path);
            if (buttonLabel) {
              elements.push(`${buttonLabel} (button)`);
            }
          }
          break;
        }

        case 'image': {
          const alt = getStringAttribute(path.node, 'alt')
            || getStringAttribute(path.node, 'accessibilityLabel');
          elements.push(alt ? `${alt} (image)` : `${elementName} (image)`);
          break;
        }

        case 'list': {
          elements.push(`${elementName} (list)`);
          break;
        }

        case 'modal': {
          const title = getStringAttribute(path.node, 'title');
          elements.push(title ? `${title} (modal)` : `${elementName} (modal)`);
          break;
        }

        case 'navigation': {
          // Expo Router: <Link href="..." /> or <Redirect href="..." />
          const target = extractRouteFromAttribute(path.node, 'href');
          if (target) navigationLinks.push(target);
          // React Navigation: <Link screen="Details" />
          const screenTarget = getStringAttribute(path.node, 'screen');
          if (screenTarget) navigationLinks.push(screenTarget);
          break;
        }

        case 'custom': {
          // Extract a meaningful label from common props
          const label = getStringAttribute(path.node, 'title')
            || getStringAttribute(path.node, 'label')
            || getStringAttribute(path.node, 'placeholder')
            || getStringAttribute(path.node, 'text');
          elements.push(label ? `${label} (${elementName})` : `${elementName} (component)`);
          break;
        }

        case 'icon':
        case 'skip':
          // Intentionally ignored
          break;
      }
    },

    // ─── Navigation link extraction from imperative calls ─────
    CallExpression(path: any) {
      const target = extractRouteFromCall(path.node);
      if (Array.isArray(target)) navigationLinks.push(...target);
      else if (target) navigationLinks.push(target);
    },
  });

  return {
    elements: deduplicateAndPrioritize(elements),
    navigationLinks: [...new Set(navigationLinks)],
  };
}

/**
 * Build a description string from extracted content.
 */
export function buildDescription(extracted: ExtractedContent): string {
  const parts: string[] = [];
  if (extracted.elements.length > 0) {
    parts.push(extracted.elements.join(', '));
  }
  return parts.join('. ') || 'Screen content';
}

// ─── Deduplication & prioritization ──────────────────────────

/** Priority order for element categories (lower = higher priority) */
const CATEGORY_PRIORITY: Record<string, number> = {
  'text-input': 0,
  'switch': 1,
  'button': 2,
  'modal': 3,
  'list': 4,
  'image': 5,
  'component': 6,
};

const MAX_ELEMENTS = 8;

function deduplicateAndPrioritize(elements: string[]): string[] {
  // Deduplicate
  const unique = [...new Set(elements)];

  // Sort by category priority (interactive first)
  unique.sort((a, b) => {
    const catA = extractCategoryTag(a);
    const catB = extractCategoryTag(b);
    return (CATEGORY_PRIORITY[catA] ?? 99) - (CATEGORY_PRIORITY[catB] ?? 99);
  });

  // Cap to avoid overly long descriptions
  return unique.slice(0, MAX_ELEMENTS);
}

function extractCategoryTag(element: string): string {
  const match = element.match(/\(([^)]+)\)$/);
  return match ? match[1]! : 'unknown';
}

// ─── Route extraction helpers ─────────────────────────────────

/**
 * Extract a route target from a JSX attribute that can be:
 *   - String literal:         href="/path"
 *   - Template literal:       href={`/path/${id}`}
 *   - Object with pathname:   href={{ pathname: '/path/[id]', params: {...} }}
 */
function extractRouteFromAttribute(node: t.JSXOpeningElement, attrName: string): string | null {
  for (const attr of node.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name) || attr.name.name !== attrName) {
      continue;
    }

    // href="/about" — plain string
    if (t.isStringLiteral(attr.value)) {
      return attr.value.value;
    }

    // href={expression}
    if (t.isJSXExpressionContainer(attr.value)) {
      return extractRouteFromExpression(attr.value.expression);
    }
  }
  return null;
}

/**
 * Extract a route target from an imperative call expression:
 *   router.push('/path')            | router.navigate({...})
 *   navigation.navigate('Screen')   | navigation.push('Screen', params)
 *
 * Methods matched: navigate, push, replace
 */
function extractRouteFromCall(node: t.CallExpression): string | string[] | null {
  const callee = node.callee;

  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    const method = callee.property.name;

    // navigation.navigate/push/replace('Screen')
    if (['navigate', 'push', 'replace'].includes(method)) {
      const firstArg = node.arguments[0];
      if (!firstArg) return null;
      return extractRouteFromExpression(firstArg);
    }

    // navigation.reset({ routes: [{ name: 'Screen' }] })
    if (method === 'reset') {
      const firstArg = node.arguments[0];
      if (t.isObjectExpression(firstArg)) {
        for (const prop of firstArg.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            prop.key.name === 'routes' &&
            t.isArrayExpression(prop.value)
          ) {
            const routes: string[] = [];
            for (const el of prop.value.elements) {
              if (t.isObjectExpression(el)) {
                for (const rp of el.properties) {
                  if (t.isObjectProperty(rp) && t.isIdentifier(rp.key) && rp.key.name === 'name') {
                    const route = extractRouteFromExpression(rp.value);
                    if (route) routes.push(route);
                  }
                }
              }
            }
            return routes.length > 0 ? routes : null;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract a route string from any expression type:
 *   - StringLiteral: '/path'
 *   - TemplateLiteral: `/path/${id}`  →  '/path/[param]'
 *   - ObjectExpression with pathname: { pathname: '/path/[id]' }
 */
function extractRouteFromExpression(expr: any): string | null {
  if (!expr) return null;

  // String literal: '/about' or 'Details'
  if (t.isStringLiteral(expr)) {
    return expr.value;
  }

  // Template literal: `/item-reviews/${id}` → '/item-reviews/[param]'
  if (t.isTemplateLiteral(expr) && expr.quasis.length > 0) {
    return expr.quasis.map((q: any) => q.value.raw).join('[param]');
  }

  // MemberExpression: StackNav.Register → 'Register'
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
    return expr.property.name;
  }

  // Identifier: navigate(screenName) → '{screenName}'
  if (t.isIdentifier(expr)) {
    return `{${expr.name}}`;
  }

  // Object with pathname: { pathname: '/user/[id]', params: {...} }
  if (t.isObjectExpression(expr)) {
    for (const prop of expr.properties) {
      if (
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === 'pathname'
      ) {
        if (t.isStringLiteral(prop.value)) {
          return prop.value.value;
        }
        if (t.isTemplateLiteral(prop.value) && prop.value.quasis.length > 0) {
          return prop.value.quasis.map((q: any) => q.value.raw).join('[param]');
        }
      }
    }
  }

  return null;
}

// ─── JSX helpers ──────────────────────────────────────────────

function getJSXElementName(nameNode: t.JSXOpeningElement['name']): string {
  if (t.isJSXIdentifier(nameNode)) return nameNode.name;
  if (t.isJSXMemberExpression(nameNode) && t.isJSXIdentifier(nameNode.property)) {
    return nameNode.property.name;
  }
  return '';
}

function getStringAttribute(node: t.JSXOpeningElement, attrName: string): string | null {
  for (const attr of node.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === attrName) {
      if (t.isStringLiteral(attr.value)) return attr.value.value;
      if (t.isJSXExpressionContainer(attr.value)) {
        return extractSemanticHint(attr.value.expression);
      }
    }
  }
  return null;
}

/**
 * Recursively unwrap a dynamic JS expression to extract a semantic label.
 *
 * Handles:
 *   StringLiteral            → "Full Name"
 *   MemberExpression         → strings.auth.fullName → "fullName"
 *   ConditionalExpression    → cond ? a : b → try a, fallback b
 *   LogicalExpression (||)   → a || b → try a, fallback b
 *   TemplateLiteral          → `Hello ${name}` → "Hello ..."
 *   CallExpression           → t('loginBtn') → "loginBtn"
 */
function extractSemanticHint(node: any, depth: number = 0): string | null {
  if (depth > 5 || !node) return null;

  // Direct string literal
  if (t.isStringLiteral(node)) return node.value;

  // Numeric literal — sometimes used as placeholder (e.g. placeholder={0})
  if (t.isNumericLiteral(node)) return String(node.value);

  // MemberExpression: strings.fullName, i18n.auth.loginButton → deepest property
  if (t.isMemberExpression(node) && t.isIdentifier(node.property)) {
    return camelToWords(node.property.name);
  }

  // Ternary: condition ? consequent : alternate — try consequent first
  if (t.isConditionalExpression(node)) {
    return extractSemanticHint(node.consequent, depth + 1)
      || extractSemanticHint(node.alternate, depth + 1);
  }

  // Logical OR: a || b — try left first
  if (t.isLogicalExpression(node) && node.operator === '||') {
    return extractSemanticHint(node.left, depth + 1)
      || extractSemanticHint(node.right, depth + 1);
  }

  // Logical AND: a && b — the right side is the "real" value
  if (t.isLogicalExpression(node) && node.operator === '&&') {
    return extractSemanticHint(node.right, depth + 1);
  }

  // Template literal: `Hello ${name}` → "Hello ..."
  if (t.isTemplateLiteral(node) && node.quasis.length > 0) {
    const staticParts = node.quasis.map((q: any) => q.value.raw).filter(Boolean);
    if (staticParts.length > 0) return staticParts.join('...').trim() || null;
  }

  // Call expression: t('key'), i18n.t('loginBtn'), translate('email')
  if (t.isCallExpression(node) && node.arguments.length > 0) {
    const firstArg = node.arguments[0];
    if (t.isStringLiteral(firstArg)) return camelToWords(firstArg.value);
  }

  return null;
}

/**
 * Convert camelCase/PascalCase to readable words: "fullName" → "full Name", "loginButton" → "login Button"
 * Keeps it simple — just inserts spaces before uppercase letters.
 */
function camelToWords(str: string): string {
  if (!str) return str;
  // Don't transform if it's already sentence-like or a single word
  if (str.includes(' ') || str.includes('_') || str.includes('-')) return str;
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Find the nearest sibling <Text> element to determine a label for a Switch/toggle.
 */
function findSiblingTextLabel(switchPath: any): string | null {
  const parent = switchPath.parentPath?.parentPath; // Go up to the View containing the Switch
  if (!parent?.node || !t.isJSXElement(parent.node)) return null;

  for (const child of parent.node.children) {
    if (t.isJSXElement(child)) {
      const text = extractTextRecursive(child);
      if (text) return text;
    }
  }
  return null;
}

/**
 * Recursively find text content inside a Pressable/TouchableOpacity.
 * Searches through nested Views and custom text-like components.
 */
function findChildTextContentRecursive(pressablePath: any): string | null {
  const jsxElement = pressablePath.parent;
  if (!t.isJSXElement(jsxElement)) return null;
  return extractTextRecursive(jsxElement);
}

/**
 * Recursively extract human-readable text from a JSX tree.
 * Stops at the first meaningful text found to avoid noise.
 */
function extractTextRecursive(element: t.JSXElement, depth: number = 0): string | null {
  if (depth > 4) return null; // Safety: don't recurse too deep

  for (const child of element.children) {
    // Direct text node
    if (t.isJSXText(child)) {
      const text = child.value.trim();
      if (text) return text;
    }

    // String or dynamic expression: {"Sign In"}, {strings.editProfile}, {t('key')}
    if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      const hint = extractSemanticHint(child.expression);
      if (hint) return hint;
    }

    // Recurse into child JSX elements (e.g. <View><Text>Sign In</Text></View>)
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      // Skip icons inside buttons
      if (ICON_EXACT.has(childName) || childName.endsWith('Icon') ||
          childName.endsWith('_Dark') || childName.endsWith('_Light')) {
        continue;
      }
      const text = extractTextRecursive(child, depth + 1);
      if (text) return text;
    }
  }
  return null;
}

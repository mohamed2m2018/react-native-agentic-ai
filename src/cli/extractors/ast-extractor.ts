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
  visibleText?: string[];
  structuralHints?: string[];
}

interface LabelCandidate {
  text: string;
  source: 'text' | 'expression' | 'prop';
  order: number;
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

const TEXT_BEARING_PROPS = ['title', 'label', 'placeholder', 'text', 'accessibilityLabel'];
const LOW_SIGNAL_LABELS = new Set([
  'title', 'label', 'labels', 'name', 'text', 'value', 'values', 'content',
  'button', 'buttons', 'component', 'components', 'item', 'items', 'entry',
  'entries', 'screen', 'screens', 'icon', 'icons', 'image', 'images', 'modal',
  'dialog', 'sheet', 'card', 'cards', 'row', 'rows', 'data', 'details',
  'category', 'categories', 'subtitle', 'description', 'descriptions', 'price',
  'prices', 'route', 'routes',
]);
const MAX_LABEL_VALUES = 6;

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
  const visibleTextCandidates: LabelCandidate[] = [];
  const structuralHints: string[] = [];

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
          const placeholder = selectBestLabel(getStringAttributeCandidates(path.node, path, 'placeholder'));
          elements.push(placeholder ? `${placeholder} (text-input)` : 'text input (text-input)');
          break;
        }

        case 'toggle': {
          const labels = findSiblingTextLabels(path);
          if (labels.length > 0) {
            labels.forEach(label => elements.push(`${label} (switch)`));
          } else {
            elements.push('toggle (switch)');
          }
          break;
        }

        case 'button': {
          // RN built-in Button uses `title` prop
          if (elementName === 'Button') {
            const titles = getStringAttributeCandidates(path.node, path, 'title');
            const bestTitle = selectBestLabel(titles);
            const buttonLabels = titles.length > 0 ? titles : bestTitle ? [bestTitle] : [];
            if (buttonLabels.length > 0) {
              buttonLabels.forEach(label => elements.push(`${label} (button)`));
            } else {
              elements.push('button (button)');
            }

            // React Navigation: <Button screen="Details" />
            const screenTarget = getStringAttribute(path.node, 'screen');
            if (screenTarget) navigationLinks.push(screenTarget);
          } else {
            // Pressable/TouchableOpacity — find text label in children
            const buttonLabels = findChildTextContentRecursive(path);
            if (buttonLabels.length > 0) {
              buttonLabels.forEach(label => elements.push(`${label} (button)`));
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
          structuralHints.push(...analyzeListStructure(path));
          break;
        }

        case 'modal': {
          const title = selectBestLabel(getStringAttributeCandidates(path.node, path, 'title'));
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
          const labels = collectBestLabelsFromElement(path.parentPath, TEXT_BEARING_PROPS);
          if (labels.length > 0) {
            labels.forEach(label => elements.push(`${label} (${elementName})`));
          } else {
            elements.push(`${elementName} (component)`);
          }
          break;
        }

        case 'icon':
        case 'skip':
          // Intentionally ignored
          break;
      }
    },

    JSXElement(path: any) {
      const elementName = getJSXElementName(path.node.openingElement.name);
      if (elementName !== 'Text') return;

      const parentElement = path.parentPath?.findParent((p: any) => p.isJSXElement());
      const parentName = parentElement ? getJSXElementName(parentElement.node.openingElement.name) : '';
      if (parentName && (ICON_EXACT.has(parentName) || parentName.endsWith('Icon'))) {
        return;
      }

      const labels = collectBestLabelsFromElement(path);
      if (labels.length === 0) return;

      for (const label of labels) {
        visibleTextCandidates.push({
          text: label,
          source: 'text',
          order: visibleTextCandidates.length,
        });
      }
    },

    // ─── Navigation link extraction from imperative calls ─────
    CallExpression(path: any) {
      const target = extractRouteFromCall(path.node, path.scope);
      if (Array.isArray(target)) navigationLinks.push(...target);
      else if (target) navigationLinks.push(target);
    },
  });

  return {
    elements: deduplicateAndPrioritize(elements),
    navigationLinks: [...new Set(navigationLinks)],
    visibleText: selectBestVisibleText(visibleTextCandidates),
    structuralHints: dedupeLabels(structuralHints),
  };
}

/**
 * Build a description string from extracted content.
 */
export function buildDescription(extracted: ExtractedContent): string {
  if (extracted.elements.length > 0 && extracted.elements.every(element => extractCategoryTag(element) === 'component')) {
    return extracted.visibleText?.length
      ? summarizeVisibleText(extracted.visibleText)
      : extracted.structuralHints?.length
        ? extracted.structuralHints.join(', ')
        : 'Screen content';
  }

  const parts: string[] = [];
  if (extracted.elements.length > 0) {
    parts.push(extracted.elements.join(', '));
  }
  if (parts.length === 0 && extracted.visibleText?.length) {
    parts.push(summarizeVisibleText(extracted.visibleText));
  }
  if (extracted.structuralHints?.length) {
    const structuralSummary = extracted.structuralHints.join(', ');
    if (!parts.some(part => part.includes(structuralSummary))) {
      parts.push(structuralSummary);
    }
  }
  return parts.join('. ') || 'Screen content';
}

function summarizeVisibleText(visibleText: string[]): string {
  const unique = dedupeLabels(visibleText);
  const summary = unique.slice(0, 6);
  return summary.join(', ');
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

function analyzeListStructure(listPath: any): string[] {
  const hints = ['scrollable list'];
  const renderItemAttr = listPath.node.attributes.find((attr: any) =>
    t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'renderItem'
  );

  if (!renderItemAttr || !t.isJSXAttribute(renderItemAttr) || !t.isJSXExpressionContainer(renderItemAttr.value)) {
    return hints;
  }

  const renderItemExpression = renderItemAttr.value.expression;
  if (!t.isArrowFunctionExpression(renderItemExpression) && !t.isFunctionExpression(renderItemExpression)) {
    return hints;
  }

  const routeTargets = new Set<string>();
  let hasSelectableRows = false;

  const bodyPath = listPath.get('attributes').find((attrPath: any) =>
    attrPath.node === renderItemAttr
  )?.get('value');
  const expressionPath = bodyPath?.get('expression');

  expressionPath?.traverse({
    JSXOpeningElement(path: any) {
      const elementName = getJSXElementName(path.node.name);
      if (!elementName) return;

      const category = classifyComponent(elementName);
      if (category === 'button') hasSelectableRows = true;

      if (category === 'navigation') {
        const hrefTarget = extractRouteFromAttribute(path.node, 'href');
        if (hrefTarget) routeTargets.add(hrefTarget);
        const screenTarget = getStringAttribute(path.node, 'screen');
        if (screenTarget) routeTargets.add(screenTarget);
      }
    },
    CallExpression(path: any) {
      const target = extractRouteFromCall(path.node, path.scope);
      if (Array.isArray(target)) target.forEach(route => routeTargets.add(route));
      else if (target) routeTargets.add(target);
    },
  });

  if (hasSelectableRows) {
    hints.push('list with selectable rows');
  }
  if (routeTargets.size > 0) {
    hints.push(`rows navigate to ${[...routeTargets].join(', ')}`);
  }

  return hints;
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
function extractRouteFromCall(node: t.CallExpression, scope?: any): string | string[] | null {
  const callee = node.callee;

  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    const method = callee.property.name;

    // navigation.navigate/push/replace('Screen')
    if (['navigate', 'push', 'replace'].includes(method)) {
      const firstArg = node.arguments[0];
      if (!firstArg) return null;
      const resolvedRoutes = dedupeLabels(resolveExpressionCandidates(firstArg, scope));
      if (resolvedRoutes.length > 0) {
        return resolvedRoutes;
      }
      return extractRouteFromExpression(firstArg, scope);
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
                    const route = extractRouteFromExpression(rp.value, scope);
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
function extractRouteFromExpression(expr: any, scope?: any): string | null {
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
    const resolved = resolveExpressionCandidates(expr, scope);
    return resolved[0] || expr.property.name;
  }

  // Identifier: navigate(screenName) → '{screenName}'
  if (t.isIdentifier(expr)) {
    const resolved = resolveExpressionCandidates(expr, scope);
    return resolved[0] || `{${expr.name}}`;
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
  return selectBestLabel(getStringAttributeCandidates(node, null, attrName));
}

function getStringAttributeCandidates(
  node: t.JSXOpeningElement,
  path: any,
  attrName: string
): string[] {
  const candidates: string[] = [];
  for (const attr of node.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === attrName) {
      if (t.isStringLiteral(attr.value)) {
        candidates.push(attr.value.value);
      }
      if (t.isJSXExpressionContainer(attr.value)) {
        candidates.push(...resolveExpressionCandidates(attr.value.expression, path?.scope));
      }
    }
  }
  return dedupeLabels(candidates);
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
    const propertyHint = camelToWords(node.property.name);
    return isLowSignalLabel(propertyHint) ? null : propertyHint;
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
function findSiblingTextLabels(switchPath: any): string[] {
  const parent = switchPath.parentPath?.parentPath; // Go up to the View containing the Switch
  if (!parent?.node || !t.isJSXElement(parent.node)) return [];

  const candidates: LabelCandidate[] = [];
  let order = 0;
  for (const child of parent.node.children) {
    if (t.isJSXElement(child)) {
      const childPath = findChildElementPath(parent, child);
      if (!childPath) continue;
      candidates.push(...collectLabelCandidatesFromElement(childPath, [], order));
      order = candidates.length;
    }
  }
  return selectBestLabelGroup(candidates);
}

/**
 * Recursively find text content inside a Pressable/TouchableOpacity.
 * Searches through nested Views and custom text-like components.
 */
function findChildTextContentRecursive(pressablePath: any): string[] {
  return collectBestLabelsFromElement(pressablePath.parentPath);
}

/**
 * Collect human-readable text candidates from a JSX subtree, then select
 * the strongest user-facing label group rather than the first match.
 */
function collectBestLabelsFromElement(elementPath: any, propNames: string[] = []): string[] {
  if (!elementPath?.node || !t.isJSXElement(elementPath.node)) return [];
  const candidates = collectLabelCandidatesFromElement(elementPath, propNames);
  return selectBestLabelGroup(candidates);
}

function collectLabelCandidatesFromElement(
  elementPath: any,
  propNames: string[] = [],
  startOrder: number = 0
): LabelCandidate[] {
  if (!elementPath?.node || !t.isJSXElement(elementPath.node)) return [];

  const candidates: LabelCandidate[] = [];
  let order = startOrder;

  for (const propName of propNames) {
    const values = getStringAttributeCandidates(elementPath.node.openingElement, elementPath, propName);
    if (values.length > 0) {
      for (const value of values) {
        candidates.push({ text: value, source: 'prop', order });
      }
      order += 1;
    }
  }

  elementPath.traverse({
    JSXElement(path: any) {
      if (path === elementPath) return;
      const childName = getJSXElementName(path.node.openingElement.name);
      if (ICON_EXACT.has(childName) || childName.endsWith('Icon') ||
          childName.endsWith('_Dark') || childName.endsWith('_Light')) {
        path.skip();
      }
    },
    JSXText(path: any) {
      const text = normalizeLabel(path.node.value);
      if (text) {
        candidates.push({ text, source: 'text', order: order++ });
      }
    },
    JSXExpressionContainer(path: any) {
      if (path.parentPath?.isJSXAttribute()) return;
      if (t.isJSXEmptyExpression(path.node.expression)) return;
      const values = resolveExpressionCandidates(path.node.expression, path.scope);
      if (values.length === 0) return;
      for (const value of values) {
        candidates.push({ text: value, source: 'expression', order });
      }
      order += 1;
    },
  });

  return candidates;
}

function selectBestLabelGroup(candidates: LabelCandidate[]): string[] {
  if (candidates.length === 0) return [];

  const groups = new Map<number, LabelCandidate[]>();
  for (const candidate of candidates) {
    if (!groups.has(candidate.order)) {
      groups.set(candidate.order, []);
    }
    groups.get(candidate.order)!.push(candidate);
  }

  const bestGroup = [...groups.entries()]
    .map(([order, group]) => ({
      order,
      group: dedupeCandidateGroup(group),
      score: scoreCandidateGroup(group, order),
    }))
    .filter(entry => entry.group.length > 0)
    .sort((a, b) => b.score - a.score)[0];

  return bestGroup ? bestGroup.group.map(candidate => candidate.text).slice(0, MAX_LABEL_VALUES) : [];
}

function dedupeCandidateGroup(group: LabelCandidate[]): LabelCandidate[] {
  const seen = new Set<string>();
  return group.filter(candidate => {
    const normalized = candidate.text.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function scoreCandidateGroup(group: LabelCandidate[], order: number): number {
  const bestCandidateScore = Math.max(...group.map(scoreLabelCandidate));
  return bestCandidateScore - order * 3;
}

function scoreLabelCandidate(candidate: LabelCandidate): number {
  const text = normalizeLabel(candidate.text);
  if (!text) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);

  if (candidate.source === 'text') score += 55;
  if (candidate.source === 'expression') score += 25;
  if (candidate.source === 'prop') score += 15;

  if (text.length >= 3 && text.length <= 32) score += 30;
  else if (text.length <= 60) score += 10;
  else score -= 10;
  if (text.length <= 2) score -= 40;

  if (words.length >= 2 && words.length <= 6) score += 25;
  else if (words.length === 1) score += 10;
  else if (words.length > 10) score -= 20;

  if (/^[A-Z]/.test(text)) score += 10;
  if (/[A-Za-z]/.test(text) && !/[{}[\]]/.test(text)) score += 10;
  if (/^[a-z]+$/.test(text) && words.length === 1) score -= 12;
  if (candidate.source === 'expression' && /^[a-z]+$/.test(text) && words.length === 1) score -= 25;
  if (/[_./]/.test(text)) score -= 20;
  if (/^[^A-Za-z]+$/.test(text)) score -= 60;
  if (/^\$?\d/.test(text)) score -= 35;
  if (isLowSignalLabel(text)) score -= 120;

  return score;
}

function resolveExpressionCandidates(node: any, scope: any, depth: number = 0): string[] {
  if (!node || depth > 6) return [];

  if (t.isStringLiteral(node)) return dedupeLabels([node.value]);
  if (t.isNumericLiteral(node)) return [String(node.value)];

  if (t.isTemplateLiteral(node)) {
    const staticParts = node.quasis.map((q: any) => q.value.raw).filter(Boolean);
    const templateHint = staticParts.join(' ').trim();
    return hasHumanReadableContent(templateHint) ? dedupeLabels([templateHint]) : [];
  }

  if (t.isConditionalExpression(node)) {
    return dedupeLabels([
      ...resolveExpressionCandidates(node.consequent, scope, depth + 1),
      ...resolveExpressionCandidates(node.alternate, scope, depth + 1),
    ]);
  }

  if (t.isLogicalExpression(node)) {
    return dedupeLabels([
      ...resolveExpressionCandidates(node.left, scope, depth + 1),
      ...resolveExpressionCandidates(node.right, scope, depth + 1),
    ]);
  }

  if (t.isIdentifier(node)) {
    return resolveBindingCandidates(node.name, scope, depth + 1);
  }

  if (t.isMemberExpression(node)) {
    const resolved = resolveMemberExpressionCandidates(node, scope, depth + 1);
    if (resolved.length > 0) return resolved;
    const hint = extractSemanticHint(node, depth + 1);
    return hint ? [hint] : [];
  }

  if (t.isCallExpression(node) && node.arguments.length > 0) {
    const firstArg = node.arguments[0];
    if (t.isStringLiteral(firstArg)) {
      return dedupeLabels([camelToWords(firstArg.value)]);
    }
  }

  const hint = extractSemanticHint(node, depth + 1);
  return hint ? [hint] : [];
}

function resolveBindingCandidates(name: string, scope: any, depth: number): string[] {
  if (!scope || depth > 6) return [];
  const binding = scope.getBinding?.(name);
  if (!binding?.path) return [];

  if (binding.path.isVariableDeclarator()) {
    return resolveExpressionCandidates(binding.path.node.init, binding.path.scope, depth + 1);
  }

  if (binding.path.isIdentifier() && binding.path.listKey === 'params') {
    const paramValues = resolveFunctionParamValues(binding.path, depth + 1);
    return paramValues.flatMap((valueNode: t.Node) =>
      resolveExpressionCandidates(valueNode, binding.path.scope, depth + 1)
    );
  }

  if (binding.path.isObjectPattern() && binding.path.listKey === 'params') {
    const propertyName = findObjectPatternPropertyName(binding.path.node, name);
    if (!propertyName) return [];

    const paramValues = resolveFunctionParamValues(binding.path, depth + 1);
    return dedupeLabels(paramValues.flatMap((valueNode: t.Node) => {
      const resolvedProperty = resolvePropertyCandidates(valueNode, propertyName, binding.path.scope, depth + 1);
      if (resolvedProperty.length > 0) return resolvedProperty;
      if (propertyName === 'item') {
        return resolveExpressionCandidates(valueNode, binding.path.scope, depth + 1);
      }
      return [];
    }));
  }

  if (binding.path.isIdentifier() && binding.path.parentPath?.isObjectProperty() && binding.path.parentPath.parentPath?.isObjectPattern()) {
    const propertyName = getObjectPropertyName(binding.path.parentPath.node.key);
    if (!propertyName) return [];

    const paramValues = resolveFunctionParamValues(binding.path.parentPath.parentPath, depth + 1);
    return dedupeLabels(paramValues.flatMap((valueNode: t.Node) => {
      const resolvedProperty = resolvePropertyCandidates(valueNode, propertyName, binding.path.scope, depth + 1);
      if (resolvedProperty.length > 0) return resolvedProperty;
      if (propertyName === 'item') {
        return resolveExpressionCandidates(valueNode, binding.path.scope, depth + 1);
      }
      return [];
    }));
  }

  if (binding.path.isObjectProperty() && binding.path.parentPath?.isObjectPattern()) {
    const propertyName = getObjectPropertyName(binding.path.node.key);
    if (!propertyName) return [];

    const paramValues = resolveFunctionParamValues(binding.path.parentPath, depth + 1);
    return dedupeLabels(paramValues.flatMap((valueNode: t.Node) => {
      const resolvedProperty = resolvePropertyCandidates(valueNode, propertyName, binding.path.scope, depth + 1);
      if (resolvedProperty.length > 0) return resolvedProperty;
      if (propertyName === 'item') {
        return resolveExpressionCandidates(valueNode, binding.path.scope, depth + 1);
      }
      return [];
    }));
  }

  return [];
}

function resolveMemberExpressionCandidates(node: t.MemberExpression, scope: any, depth: number): string[] {
  if (depth > 6) return [];
  const propertyName = getMemberPropertyName(node);
  if (!propertyName) return [];

  const objectNodes = resolveExpressionValueNodes(node.object, scope, depth + 1);
  const values = objectNodes.flatMap((objectNode: t.Node) =>
    resolvePropertyCandidates(objectNode, propertyName, scope, depth + 1)
  );

  return dedupeLabels(values);
}

function resolvePropertyCandidates(
  node: t.Node,
  propertyName: string,
  scope: any,
  depth: number
): string[] {
  if (depth > 6) return [];

  if (t.isObjectExpression(node)) {
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop)) continue;
      const keyName = getObjectPropertyName(prop.key);
      if (keyName === propertyName) {
        return resolveExpressionCandidates(prop.value, scope, depth + 1);
      }
    }
  }

  return [];
}

function resolveExpressionValueNodes(node: t.Node | null | undefined, scope: any, depth: number): t.Node[] {
  if (!node || depth > 6) return [];

  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isObjectExpression(node) ||
    t.isArrayExpression(node) ||
    t.isTemplateLiteral(node)
  ) {
    return [node];
  }

  if (t.isIdentifier(node)) {
    const binding = scope?.getBinding?.(node.name);
    if (!binding?.path) return [];

    if (binding.path.isVariableDeclarator()) {
      return resolveExpressionValueNodes(binding.path.node.init, binding.path.scope, depth + 1);
    }

    if (binding.path.isIdentifier() && binding.path.listKey === 'params') {
      return resolveFunctionParamValues(binding.path, depth + 1);
    }

    if (binding.path.isObjectPattern() && binding.path.listKey === 'params') {
      const propertyName = findObjectPatternPropertyName(binding.path.node, node.name);
      if (!propertyName) return [];

      const paramValues = resolveFunctionParamValues(binding.path, depth + 1);
      return paramValues.flatMap((valueNode: t.Node) => {
        if (propertyName === 'item') return [valueNode];
        return resolvePropertyValueNodes(valueNode, propertyName);
      });
    }

    if (binding.path.isIdentifier() && binding.path.parentPath?.isObjectProperty() && binding.path.parentPath.parentPath?.isObjectPattern()) {
      const propertyName = getObjectPropertyName(binding.path.parentPath.node.key);
      if (!propertyName) return [];

      const paramValues = resolveFunctionParamValues(binding.path.parentPath.parentPath, depth + 1);
      return paramValues.flatMap((valueNode: t.Node) => {
        if (propertyName === 'item') return [valueNode];
        return resolvePropertyValueNodes(valueNode, propertyName);
      });
    }

    if (binding.path.isObjectProperty() && binding.path.parentPath?.isObjectPattern()) {
      const propertyName = getObjectPropertyName(binding.path.node.key);
      if (!propertyName) return [];

      const paramValues = resolveFunctionParamValues(binding.path.parentPath, depth + 1);
      const resolvedNodes = paramValues.flatMap((valueNode: t.Node) => {
        if (propertyName === 'item') return [valueNode];
        return resolvePropertyValueNodes(valueNode, propertyName);
      });
      return resolvedNodes;
    }
  }

  if (t.isConditionalExpression(node)) {
    return [
      ...resolveExpressionValueNodes(node.consequent, scope, depth + 1),
      ...resolveExpressionValueNodes(node.alternate, scope, depth + 1),
    ];
  }

  if (t.isLogicalExpression(node)) {
    return [
      ...resolveExpressionValueNodes(node.left, scope, depth + 1),
      ...resolveExpressionValueNodes(node.right, scope, depth + 1),
    ];
  }

  return [];
}

function resolveFunctionParamValues(paramPath: any, depth: number): t.Node[] {
  if (depth > 6) return [];
  const functionPath = paramPath.findParent((p: any) => p.isFunction());
  const callPath = functionPath?.parentPath;
  if (callPath?.isCallExpression()) {
    const callee = callPath.node.callee;
    if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) return [];
    if (!['map', 'flatMap'].includes(callee.property.name)) return [];

    const sourceValues = resolveExpressionValueNodes(callee.object, callPath.scope, depth + 1);
    const results: t.Node[] = [];

    for (const sourceNode of sourceValues) {
      if (!t.isArrayExpression(sourceNode)) continue;
      for (const element of sourceNode.elements) {
        if (element && !t.isSpreadElement(element)) {
          results.push(element);
        }
      }
    }

    return results;
  }

  const jsxAttributePath = functionPath?.parentPath;
  if (jsxAttributePath?.isJSXExpressionContainer() && jsxAttributePath.parentPath?.isJSXAttribute()) {
    const attrName = jsxAttributePath.parentPath.node.name;
    if (t.isJSXIdentifier(attrName) && attrName.name === 'renderItem') {
      const openingElementPath = jsxAttributePath.parentPath.parentPath;
      if (!openingElementPath?.isJSXOpeningElement()) return [];
      const dataAttribute = openingElementPath.node.attributes.find((attr: any) =>
        t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'data'
      );
      if (!dataAttribute || !t.isJSXAttribute(dataAttribute) || !t.isJSXExpressionContainer(dataAttribute.value)) {
        return [];
      }

      const sourceValues = resolveExpressionValueNodes(dataAttribute.value.expression, openingElementPath.scope, depth + 1);
      const results: t.Node[] = [];

      for (const sourceNode of sourceValues) {
        if (!t.isArrayExpression(sourceNode)) continue;
        for (const element of sourceNode.elements) {
          if (element && !t.isSpreadElement(element)) {
            results.push(element);
          }
        }
      }

      return results;
    }
  }

  return [];
}

function resolvePropertyValueNodes(node: t.Node, propertyName: string): t.Node[] {
  if (t.isObjectExpression(node)) {
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop)) continue;
      const keyName = getObjectPropertyName(prop.key);
      if (keyName === propertyName) {
        return [prop.value];
      }
    }
  }

  return [];
}

function getMemberPropertyName(node: t.MemberExpression): string | null {
  if (t.isIdentifier(node.property) && !node.computed) return node.property.name;
  if (t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function getObjectPropertyName(key: t.ObjectProperty['key']): string | null {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
}

function findObjectPatternPropertyName(pattern: t.ObjectPattern, bindingName: string): string | null {
  for (const property of pattern.properties) {
    if (!t.isObjectProperty(property)) continue;
    if (t.isRestElement(property.value)) continue;

    const keyName = getObjectPropertyName(property.key);
    if (!keyName) continue;

    if (t.isIdentifier(property.value) && property.value.name === bindingName) {
      return keyName;
    }

    if (t.isAssignmentPattern(property.value) && t.isIdentifier(property.value.left) && property.value.left.name === bindingName) {
      return keyName;
    }
  }

  return null;
}

function findChildElementPath(parentPath: any, childNode: t.JSXElement): any {
  const container = parentPath.get('children');
  if (!Array.isArray(container)) return null;
  return container.find((childPath: any) => childPath.node === childNode) || null;
}

function selectBestLabel(candidates: string[]): string | null {
  const scored = dedupeLabels(candidates)
    .map(text => ({ text, score: scoreLabelCandidate({ text, source: 'expression', order: 0 }) }))
    .sort((a, b) => b.score - a.score)[0];
  return scored?.score !== undefined && scored.score > Number.NEGATIVE_INFINITY ? scored.text : null;
}

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of labels) {
    const normalized = normalizeLabel(label);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeLabel(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

function isLowSignalLabel(text: string): boolean {
  const normalized = normalizeLabel(text).toLowerCase();
  return LOW_SIGNAL_LABELS.has(normalized);
}

function hasHumanReadableContent(text: string): boolean {
  return /[A-Za-z]/.test(normalizeLabel(text));
}

function selectBestVisibleText(candidates: LabelCandidate[]): string[] {
  return dedupeLabels(candidates.map(candidate => candidate.text))
    .filter(text => hasHumanReadableContent(text))
    .map(text => ({ text, score: scoreVisibleText(text) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(entry => entry.text);
}

function scoreVisibleText(text: string): number {
  const normalized = normalizeLabel(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  let score = 0;

  if (normalized.length >= 4 && normalized.length <= 36) score += 30;
  else if (normalized.length <= 80) score += 12;
  else score -= 12;

  if (words.length >= 2 && words.length <= 8) score += 22;
  else if (words.length === 1) score += 8;
  else if (words.length > 14) score -= 16;

  if (/^[A-Z]/.test(normalized)) score += 10;
  if (/^\$?\d/.test(normalized)) score -= 25;
  if (/^[^A-Za-z]+$/.test(normalized)) score -= 80;
  if (isLowSignalLabel(normalized)) score -= 120;

  return score;
}

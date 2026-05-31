/**
 * AST-based content extractor for React Native screen files.
 * Parses JSX to extract interactive elements, text labels, and navigation links.
 *
 * Captures navigation links from all patterns:
 *
 * Expo Router:
 *   <Link href="/path" />
 *   <Link href={`/path/${id}`} />
 *   <Link href={{ pathname: '/path/[id]', params: {...} }} />
 *   <Redirect href="/path" />
 *   router.navigate('/path') / router.push() / router.replace()
 *   router.navigate(`/path/${id}`)
 *   router.navigate({ pathname: '/path/[id]', params: {...} })
 *
 * React Navigation:
 *   <Link screen="Details" />
 *   <Button screen="Details" />
 *   navigation.navigate('Screen') / navigation.push() / navigation.replace()
 *   navigation.navigate('Screen', { id: 1 })
 */

import { parse } from '@babel/parser';
import * as _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (_traverse as any).default || _traverse;

export interface ExtractedContent {
  elements: string[];
  navigationLinks: string[];
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

      // Extract Switch/toggle elements
      if (elementName === 'Switch') {
        const label = findSiblingTextLabel(path);
        elements.push(label ? `${label} (switch)` : 'toggle (switch)');
      }

      // Extract TextInput elements
      if (elementName === 'TextInput') {
        const placeholder = getStringAttribute(path.node, 'placeholder');
        elements.push(placeholder ? `${placeholder} (text-input)` : 'text input (text-input)');
      }

      // Extract Button elements (React Native built-in)
      if (elementName === 'Button') {
        const title = getStringAttribute(path.node, 'title');
        elements.push(title ? `${title} (button)` : 'button (button)');

        // React Navigation: <Button screen="Details" />
        const screenTarget = getStringAttribute(path.node, 'screen');
        if (screenTarget) {
          navigationLinks.push(screenTarget);
        }
      }

      // Extract Pressable/TouchableOpacity with Text children as buttons
      if (isPressableElement(elementName)) {
        const buttonLabel = findChildTextContent(path);
        if (buttonLabel) {
          elements.push(`${buttonLabel} (button)`);
        }
      }

      // ─── Navigation link extraction from JSX components ─────

      // Expo Router: <Link href="..." /> or <Redirect href="..." />
      if (elementName === 'Link' || elementName === 'Redirect') {
        const target = extractRouteFromAttribute(path.node, 'href');
        if (target) {
          navigationLinks.push(target);
        }
        // React Navigation: <Link screen="Details" />
        const screenTarget = getStringAttribute(path.node, 'screen');
        if (screenTarget) {
          navigationLinks.push(screenTarget);
        }
      }
    },

    // ─── Navigation link extraction from imperative calls ─────
    CallExpression(path: any) {
      const target = extractRouteFromCall(path.node);
      if (target) {
        navigationLinks.push(target);
      }
    },
  });

  return {
    elements: [...new Set(elements)],
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
function extractRouteFromCall(node: t.CallExpression): string | null {
  const callee = node.callee;

  // Match: something.navigate('...') / something.push('...') / something.replace('...')
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    const method = callee.property.name;
    if (!['navigate', 'push', 'replace'].includes(method)) return null;

    const firstArg = node.arguments[0];
    if (!firstArg) return null;

    return extractRouteFromExpression(firstArg);
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

function isPressableElement(name: string): boolean {
  return ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'].includes(name);
}

function getStringAttribute(node: t.JSXOpeningElement, attrName: string): string | null {
  for (const attr of node.attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === attrName) {
      if (t.isStringLiteral(attr.value)) return attr.value.value;
      if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
        return attr.value.expression.value;
      }
    }
  }
  return null;
}

/**
 * Find the nearest sibling <Text> element to determine a label for a Switch/toggle.
 */
function findSiblingTextLabel(switchPath: any): string | null {
  const parent = switchPath.parentPath?.parentPath; // Go up to the View containing the Switch
  if (!parent?.node || !t.isJSXElement(parent.node)) return null;

  for (const child of parent.node.children) {
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (childName === 'Text') {
        return extractTextFromJSXElement(child);
      }
    }
  }
  return null;
}

/**
 * Find the first <Text> child inside a Pressable/TouchableOpacity.
 */
function findChildTextContent(pressablePath: any): string | null {
  const jsxElement = pressablePath.parent;
  if (!t.isJSXElement(jsxElement)) return null;

  for (const child of jsxElement.children) {
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (childName === 'Text') {
        return extractTextFromJSXElement(child);
      }
    }
  }
  return null;
}

function extractTextFromJSXElement(element: t.JSXElement): string | null {
  for (const child of element.children) {
    if (t.isJSXText(child)) {
      const text = child.value.trim();
      if (text) return text;
    }
    if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
      return child.expression.value;
    }
  }
  return null;
}

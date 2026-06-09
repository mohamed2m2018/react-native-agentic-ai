#!/usr/bin/env node

/**
 * Screen Map Generator CLI (CJS wrapper)
 * 
 * This script runs in Node.js CommonJS mode.
 * Bob compiles src/ to ESM for React Native Metro bundler,
 * but CLI tools need to run in Node.js directly.
 * 
 * Usage:
 *   npx react-native-ai-agent generate-map
 *   npx react-native-ai-agent generate-map --ai --provider=gemini --key=YOUR_KEY
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const _traverse = require('@babel/traverse');
const traverse = _traverse.default || _traverse;
const t = require('@babel/types');

// ─── AST Extractor ──────────────────────────────────────────────

// Component classification sets
const LAYOUT_PRIMITIVES = new Set([
  'View', 'SafeAreaView', 'Fragment', 'KeyboardAvoidingView',
  'StatusBar', 'LinearGradient', 'Animated',
]);

const ICON_EXACT = new Set([
  'Ionicons', 'MaterialIcon', 'MaterialCommunityIcons',
  'FontAwesome', 'FontAwesome5', 'Feather', 'Entypo',
  'AntDesign', 'EvilIcons', 'Foundation', 'Octicons',
  'SimpleLineIcons', 'Zocial', 'MaterialIcons',
]);

const PRESSABLE_EXACT = new Set([
  'Pressable', 'TouchableOpacity', 'TouchableHighlight',
  'TouchableWithoutFeedback', 'TouchableNativeFeedback',
]);

const LIST_EXACT = new Set(['FlatList', 'SectionList', 'VirtualizedList']);
const IMAGE_EXACT = new Set(['Image', 'FastImage', 'ImageBackground']);

function classifyComponent(name) {
  if (LAYOUT_PRIMITIVES.has(name)) return 'skip';
  if (name === 'Text' || name === 'ScrollView') return 'skip';

  if (name === 'TextInput') return 'input';
  if (name === 'Switch') return 'toggle';
  if (name === 'Button') return 'button';
  if (name === 'Modal') return 'modal';
  if (name === 'Link' || name === 'Redirect') return 'navigation';
  if (PRESSABLE_EXACT.has(name)) return 'button';
  if (LIST_EXACT.has(name)) return 'list';
  if (IMAGE_EXACT.has(name)) return 'image';
  if (ICON_EXACT.has(name)) return 'icon';

  if (name.endsWith('Input') || name.endsWith('Field')) return 'input';
  if (name.endsWith('Toggle')) return 'toggle';
  if (name.endsWith('Button') || name.endsWith('Btn')) return 'button';
  if (name.endsWith('Image') || name.endsWith('Avatar') || name.endsWith('Photo')) return 'image';
  if (name.endsWith('List')) return 'list';
  if (name.endsWith('Modal') || name.endsWith('Sheet') || name.endsWith('Dialog') || name.includes('BottomSheet')) return 'modal';
  if (name.endsWith('Icon') || name.endsWith('_Dark') || name.endsWith('_Light')) return 'icon';

  if (name[0] === name[0]?.toUpperCase() && name[0] !== name[0]?.toLowerCase()) return 'custom';
  return 'skip';
}

const CATEGORY_PRIORITY = {
  'text-input': 0, 'switch': 1, 'button': 2, 'modal': 3,
  'list': 4, 'image': 5, 'component': 6,
};
const MAX_ELEMENTS = 8;

function deduplicateAndPrioritize(elements) {
  const unique = [...new Set(elements)];
  unique.sort((a, b) => {
    const catA = (a.match(/\(([^)]+)\)$/) || [])[1] || 'unknown';
    const catB = (b.match(/\(([^)]+)\)$/) || [])[1] || 'unknown';
    return (CATEGORY_PRIORITY[catA] ?? 99) - (CATEGORY_PRIORITY[catB] ?? 99);
  });
  return unique.slice(0, MAX_ELEMENTS);
}

function extractContentFromAST(sourceCode, filePath) {
  const elements = [];
  const navigationLinks = [];
  const visibleText = [];

  let ast;
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
    JSXOpeningElement(astPath) {
      const nameNode = astPath.node.name;
      const elementName = getJSXElementName(nameNode);
      if (!elementName) return;

      const category = classifyComponent(elementName);

      switch (category) {
        case 'input': {
          const placeholder = getStringAttribute(astPath.node, 'placeholder');
          elements.push(placeholder ? `${placeholder} (text-input)` : 'text input (text-input)');
          break;
        }
        case 'toggle': {
          const label = findSiblingTextLabel(astPath);
          elements.push(label ? `${label} (switch)` : 'toggle (switch)');
          break;
        }
        case 'button': {
          if (elementName === 'Button') {
            const title = getStringAttribute(astPath.node, 'title');
            elements.push(title ? `${title} (button)` : 'button (button)');
            const screenTarget = getStringAttribute(astPath.node, 'screen');
            if (screenTarget) navigationLinks.push(screenTarget);
          } else {
            const buttonLabels = findChildTextContentRecursive(astPath);
            for (const buttonLabel of buttonLabels) {
              elements.push(`${buttonLabel} (button)`);
            }
          }
          break;
        }
        case 'image': {
          const alt = getStringAttribute(astPath.node, 'alt')
            || getStringAttribute(astPath.node, 'accessibilityLabel');
          elements.push(alt ? `${alt} (image)` : `${elementName} (image)`);
          break;
        }
        case 'list': {
          elements.push(`${elementName} (list)`);
          break;
        }
        case 'modal': {
          const title = getStringAttribute(astPath.node, 'title');
          elements.push(title ? `${title} (modal)` : `${elementName} (modal)`);
          break;
        }
        case 'navigation': {
          const target = extractRouteFromAttribute(astPath.node, 'href');
          if (target) navigationLinks.push(target);
          const screenTarget = getStringAttribute(astPath.node, 'screen');
          if (screenTarget) navigationLinks.push(screenTarget);
          break;
        }
        case 'custom': {
          const label = getStringAttribute(astPath.node, 'title')
            || getStringAttribute(astPath.node, 'label')
            || getStringAttribute(astPath.node, 'placeholder')
            || getStringAttribute(astPath.node, 'text');
          elements.push(label ? `${label} (${elementName})` : `${elementName} (component)`);
          break;
        }
        case 'icon':
        case 'skip':
          break;
      }
    },

    CallExpression(astPath) {
      const target = extractRouteFromCall(astPath.node);
      if (Array.isArray(target)) navigationLinks.push(...target);
      else if (target) navigationLinks.push(target);
    },

    JSXElement(astPath) {
      const elementName = getJSXElementName(astPath.node.openingElement.name);
      if (elementName !== 'Text') return;
      const labels = extractTextCandidatesRecursive(astPath.node, astPath.scope);
      for (const label of labels) {
        visibleText.push(label);
      }
    },
  });

  return {
    elements: deduplicateAndPrioritize(elements),
    navigationLinks: [...new Set(navigationLinks)],
    visibleText: dedupeLabels(visibleText).slice(0, 6),
  };
}

// Extract route from JSX attribute (href, screen) — handles string, template literal, object
function extractRouteFromAttribute(node, attrName) {
  for (const attr of node.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name) || attr.name.name !== attrName) continue;
    if (t.isStringLiteral(attr.value)) return attr.value.value;
    if (t.isJSXExpressionContainer(attr.value)) return extractRouteFromExpression(attr.value.expression);
  }
  return null;
}

// Extract route from imperative call: router.push/navigate/replace, navigation.navigate/push
function extractRouteFromCall(node) {
  const callee = node.callee;
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    const method = callee.property.name;

    // navigation.navigate/push/replace('Screen')
    if (['navigate', 'push', 'replace'].includes(method)) {
      const firstArg = node.arguments[0];
      return firstArg ? extractRouteFromExpression(firstArg) : null;
    }

    // navigation.reset({ routes: [{ name: 'Screen' }] })
    if (method === 'reset') {
      const firstArg = node.arguments[0];
      if (t.isObjectExpression(firstArg)) {
        for (const prop of firstArg.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'routes' && t.isArrayExpression(prop.value)) {
            const routes = [];
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

function extractRouteFromExpression(expr) {
  if (!expr) return null;
  if (t.isStringLiteral(expr)) return expr.value;
  if (t.isTemplateLiteral(expr) && expr.quasis.length > 0) {
    return expr.quasis.map(q => q.value.raw).join('[param]');
  }
  // MemberExpression: StackNav.Register → 'Register'
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
    return expr.property.name;
  }
  // Identifier: navigate(screenName) → '{screenName}'
  if (t.isIdentifier(expr)) {
    return `{${expr.name}}`;
  }
  if (t.isObjectExpression(expr)) {
    for (const prop of expr.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'pathname') {
        if (t.isStringLiteral(prop.value)) return prop.value.value;
        if (t.isTemplateLiteral(prop.value) && prop.value.quasis.length > 0) {
          return prop.value.quasis.map(q => q.value.raw).join('[param]');
        }
      }
    }
  }
  return null;
}

// ─── Global Navigate Index (component-level navigation) ─────────

const NAVIGATE_REGEX = /navigation\.(navigate|push|replace|reset)\s*\(|\.navigate\s*\(/;

// A real UI component navigates to at most a few screens.
// Files exceeding this are infrastructure (NavigationService, deep link handlers, routing hubs).
const MAX_COMPONENT_NAV_TARGETS = 8;;

/**
 * Build a global index: { absoluteFilePath: [route1, route2, ...] }
 * Fast two-pass: regex pre-filter → Babel parse only matching files.
 */
function buildGlobalNavigateIndex(projectRoot) {
  const index = new Map(); // filePath → Set<route>
  const srcDir = path.join(projectRoot, 'src');
  const scanRoot = fs.existsSync(srcDir) ? srcDir : projectRoot;
  const allFiles = getAllSourceFiles(scanRoot);

  for (const filePath of allFiles) {
    const source = fs.readFileSync(filePath, 'utf-8');
    // Fast regex pre-filter — skip files without any navigate calls
    if (!NAVIGATE_REGEX.test(source)) continue;

    try {
      const ast = parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });

      const routes = new Set();
      traverse(ast, {
        CallExpression(astPath) {
          const target = extractRouteFromCall(astPath.node);
          if (Array.isArray(target)) target.forEach(r => routes.add(r));
          else if (target) routes.add(target);
        },
      });

      if (routes.size > 0 && routes.size <= MAX_COMPONENT_NAV_TARGETS) {
        index.set(filePath, routes);
      }
    } catch {
      // Skip files that fail to parse
    }
  }
  return index;
}

/**
 * Recursively collect all .js/.jsx/.ts/.tsx files, skipping node_modules and dotfiles.
 */
function getAllSourceFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' ||
        entry.name === '__tests__' || entry.name === '__mocks__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(full));
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract import source paths from a file's AST.
 * Returns resolved absolute paths.
 */
// Set by main() — used by extractImportPaths for module alias resolution
let _projectRoot = '';

function extractImportPaths(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const importPaths = [];

  // Fast regex extraction — no need for full Babel parse
  const importRegex = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath) continue;

    if (importPath.startsWith('.')) {
      // Relative import
      const dir = path.dirname(filePath);
      const resolved = resolveFilePath(dir, importPath);
      if (resolved) importPaths.push(resolved);
    } else if (_projectRoot && !importPath.startsWith('@') && !importPath.includes('node_modules')) {
      // Non-relative: try module alias resolution (baseUrl patterns)
      // Common: src/components/X, or projectRoot/components/X
      const srcDir = path.join(_projectRoot, 'src');
      const resolved = resolveFilePath(srcDir, importPath) || resolveFilePath(_projectRoot, importPath);
      if (resolved) importPaths.push(resolved);
    }
  }
  return importPaths;
}

/**
 * BFS through the import graph to collect all transitively imported files.
 * Capped at MAX_DEPTH hops to avoid runaway traversal.
 */
const _transitiveCache = new Map();
function getTransitiveImports(filePath, maxDepth = 10) {
  const resolved = path.resolve(filePath);
  if (_transitiveCache.has(resolved)) return _transitiveCache.get(resolved);

  const visited = new Set();
  const queue = [{ file: resolved, depth: 0 }];

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    if (visited.has(file) || depth > maxDepth) continue;
    visited.add(file);

    let imports;
    try { imports = extractImportPaths(file); } catch { continue; }

    for (const imp of imports) {
      const impResolved = path.resolve(imp);
      if (!visited.has(impResolved)) {
        queue.push({ file: impResolved, depth: depth + 1 });
      }
    }
  }

  // Remove the root file itself
  visited.delete(resolved);
  _transitiveCache.set(resolved, visited);
  return visited;
}

/**
 * Resolve a relative import to an absolute file path.
 * Tries: exact, .js, .jsx, .ts, .tsx, /index.js, /index.tsx
 */
function resolveFilePath(fromDir, importPath) {
  const base = path.resolve(fromDir, importPath);
  const extensions = ['', '.js', '.jsx', '.ts', '.tsx'];
  for (const ext of extensions) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  // Try index files
  for (const idx of ['index.js', 'index.jsx', 'index.ts', 'index.tsx']) {
    const candidate = path.join(base, idx);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Enrich screen navigation links by following imports into child components.
 * For each screen → get its imports → check if any import has navigate calls → merge routes.
 */
function enrichScreensWithComponentNavLinks(screens, globalIndex, navigatorFiles) {
  let totalAdded = 0;
  const navigatorSet = new Set(navigatorFiles.map(f => path.resolve(f)));
  // Screen files' navigate calls belong to themselves, not to screens that import them
  const screenFileSet = new Set(screens.map(s => path.resolve(s.filePath)));

  // If multiple screens share the same filePath, it's a route registry — not a real component file
  const filePathCounts = new Map();
  for (const s of screens) {
    const resolved = path.resolve(s.filePath);
    filePathCounts.set(resolved, (filePathCounts.get(resolved) || 0) + 1);
  }
  const sharedFilePaths = new Set(
    [...filePathCounts.entries()].filter(([, count]) => count > 1).map(([fp]) => fp)
  );

  for (const screen of screens) {
    if (!fs.existsSync(screen.filePath)) continue;
    const resolvedPath = path.resolve(screen.filePath);

    // Determine the file to BFS from
    let rootFile = resolvedPath;
    const isNavigator = navigatorSet.has(resolvedPath);
    const isShared = sharedFilePaths.has(resolvedPath);

    if (isNavigator || isShared) {
      // Fallback: screen's filePath is a navigator (e.g. component={FadeInX} is a local wrapper).
      // Try to find the actual component by matching routeName against the navigator's imports.
      const navImports = extractImportPaths(resolvedPath);
      const lowerRouteName = screen.routeName.toLowerCase();
      const matchedImport = navImports.find(imp => {
        const base = path.basename(imp, path.extname(imp)).toLowerCase();
        return base === lowerRouteName || base.includes(lowerRouteName);
      });
      if (matchedImport) {
        rootFile = path.resolve(matchedImport);
      } else {
        continue; // Can't resolve — skip
      }
    }

    const importedFiles = getTransitiveImports(rootFile);
    const existingLinks = new Set(screen.navigationLinks);

    // Also check the rootFile itself for navigation calls
    const rootRoutes = globalIndex.get(rootFile);
    if (rootRoutes) {
      for (const route of rootRoutes) {
        existingLinks.add(route);
        totalAdded++;
      }
    }

    for (const importedFile of importedFiles) {
      // Skip navigator files and other screen files
      if (navigatorSet.has(importedFile) || screenFileSet.has(importedFile)) continue;

      const componentRoutes = globalIndex.get(importedFile);
      if (!componentRoutes) continue;

      for (const route of componentRoutes) {
        if (!existingLinks.has(route)) {
          existingLinks.add(route);
          totalAdded++;
        }
      }
    }

    screen.navigationLinks = [...existingLinks];
  }

  return totalAdded;
}

function buildDescription(extracted) {
  if (extracted.elements.length > 0) {
    return extracted.elements.join(', ');
  }
  if (extracted.visibleText?.length) {
    return extracted.visibleText.join(', ');
  }
  return 'Screen content';
}

function getJSXElementName(nameNode) {
  if (t.isJSXIdentifier(nameNode)) return nameNode.name;
  if (t.isJSXMemberExpression(nameNode) && t.isJSXIdentifier(nameNode.property)) {
    return nameNode.property.name;
  }
  return '';
}

function getStringAttribute(node, attrName) {
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

function extractSemanticHint(node, depth = 0) {
  if (depth > 5 || !node) return null;
  if (t.isStringLiteral(node)) return node.value;
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isMemberExpression(node) && t.isIdentifier(node.property)) {
    return camelToWords(node.property.name);
  }
  if (t.isConditionalExpression(node)) {
    return extractSemanticHint(node.consequent, depth + 1)
      || extractSemanticHint(node.alternate, depth + 1);
  }
  if (t.isLogicalExpression(node) && node.operator === '||') {
    return extractSemanticHint(node.left, depth + 1)
      || extractSemanticHint(node.right, depth + 1);
  }
  if (t.isLogicalExpression(node) && node.operator === '&&') {
    return extractSemanticHint(node.right, depth + 1);
  }
  if (t.isTemplateLiteral(node) && node.quasis.length > 0) {
    const staticParts = node.quasis.map(q => q.value.raw).filter(Boolean);
    if (staticParts.length > 0) return staticParts.join('...').trim() || null;
  }
  if (t.isCallExpression(node) && node.arguments.length > 0) {
    const firstArg = node.arguments[0];
    if (t.isStringLiteral(firstArg)) return camelToWords(firstArg.value);
  }
  return null;
}

function camelToWords(str) {
  if (!str) return str;
  if (str.includes(' ') || str.includes('_') || str.includes('-')) return str;
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function findSiblingTextLabel(switchPath) {
  const parent = switchPath.parentPath?.parentPath;
  if (!parent?.node || !t.isJSXElement(parent.node)) return null;
  for (const child of parent.node.children) {
    if (t.isJSXElement(child)) {
      const text = extractTextCandidatesRecursive(child, parent.scope)[0];
      if (text) return text;
    }
  }
  return null;
}

function findChildTextContentRecursive(pressablePath) {
  const jsxElement = pressablePath.parent;
  if (!t.isJSXElement(jsxElement)) return [];
  return extractTextCandidatesRecursive(jsxElement, pressablePath.scope);
}

function extractTextCandidatesRecursive(element, scope, depth = 0) {
  if (depth > 4) return [];
  const labels = [];
  for (const child of element.children) {
    if (t.isJSXText(child)) {
      const text = normalizeLabel(child.value);
      if (text) labels.push(text);
    }
    if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      labels.push(...resolveExpressionCandidates(child.expression, scope));
    }
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (ICON_EXACT.has(childName) || childName.endsWith('Icon') ||
          childName.endsWith('_Dark') || childName.endsWith('_Light')) continue;
      labels.push(...extractTextCandidatesRecursive(child, scope, depth + 1));
    }
  }
  return dedupeLabels(labels);
}

function resolveExpressionCandidates(node, scope, depth = 0) {
  if (!node || depth > 6) return [];
  if (t.isStringLiteral(node)) return [node.value];
  if (t.isNumericLiteral(node)) return [String(node.value)];
  if (t.isTemplateLiteral(node) && node.quasis.length > 0) {
    const text = normalizeLabel(node.quasis.map(q => q.value.raw).join(' '));
    return text ? [text] : [];
  }
  if (t.isIdentifier(node)) {
    return resolveBindingCandidates(node.name, scope, depth + 1);
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
  const hint = extractSemanticHint(node, depth + 1);
  return hint ? [hint] : [];
}

function resolveBindingCandidates(name, scope, depth) {
  if (!scope || depth > 6) return [];
  const binding = scope.getBinding?.(name);
  if (!binding?.path) return [];

  if (binding.path.isVariableDeclarator()) {
    return resolveExpressionCandidates(binding.path.node.init, binding.path.scope, depth + 1);
  }

  if (binding.path.isIdentifier() && binding.path.listKey === 'params') {
    return dedupeLabels(
      resolveFunctionParamValues(binding.path, depth + 1).flatMap(valueNode =>
        resolveExpressionCandidates(valueNode, binding.path.scope, depth + 1)
      )
    );
  }

  return [];
}

function resolveFunctionParamValues(paramPath, depth) {
  if (depth > 6) return [];
  const functionPath = paramPath.findParent(p => p.isFunction());
  const callPath = functionPath?.parentPath;
  if (!callPath?.isCallExpression()) return [];

  const callee = callPath.node.callee;
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) return [];
  if (!['map', 'flatMap'].includes(callee.property.name)) return [];

  const sourceValues = resolveExpressionValueNodes(callee.object, callPath.scope, depth + 1);
  const results = [];

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

function resolveExpressionValueNodes(node, scope, depth) {
  if (!node || depth > 6) return [];
  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isArrayExpression(node) ||
    t.isTemplateLiteral(node)
  ) {
    return [node];
  }
  if (t.isIdentifier(node)) {
    const binding = scope?.getBinding?.(node.name);
    if (binding?.path?.isVariableDeclarator()) {
      return resolveExpressionValueNodes(binding.path.node.init, binding.path.scope, depth + 1);
    }
  }
  return [];
}

function normalizeLabel(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function dedupeLabels(labels) {
  const seen = new Set();
  const result = [];
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


// ─── Expo Router Scanner ──────────────────────────────────────

function findAppDir(projectRoot) {
  const srcApp = path.join(projectRoot, 'src', 'app');
  if (fs.existsSync(srcApp)) return srcApp;
  const app = path.join(projectRoot, 'app');
  if (fs.existsSync(app)) return app;
  return null;
}

function filePathToRouteName(filePath, appRoot) {
  let relative = path.relative(appRoot, filePath);
  relative = relative.replace(/\.(tsx?|jsx?)$/, '');
  relative = relative.split(path.sep).join('/');
  return relative;
}

function extractLayoutTitles(dir, appRoot, titles) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      extractLayoutTitles(fullPath, appRoot, titles);
      continue;
    }
    if (entry.name === '_layout.tsx' || entry.name === '_layout.ts') {
      const sourceCode = fs.readFileSync(fullPath, 'utf-8');
      const dirRelative = path.relative(appRoot, dir);
      const prefix = dirRelative ? dirRelative.split(path.sep).join('/') + '/' : '';
      extractTitlesFromLayout(sourceCode, prefix, titles);
    }
  }
}

function extractTitlesFromLayout(sourceCode, routePrefix, titles) {
  let ast;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return; }

  traverse(ast, {
    JSXOpeningElement(astPath) {
      const nameNode = astPath.node.name;
      if (!t.isJSXMemberExpression(nameNode)) return;
      if (!t.isJSXIdentifier(nameNode.property) || nameNode.property.name !== 'Screen') return;

      let screenName = null, screenTitle = null;
      for (const attr of astPath.node.attributes) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
        if (attr.name.name === 'name' && t.isStringLiteral(attr.value)) {
          screenName = attr.value.value;
        }
        if (attr.name.name === 'options' && t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (t.isObjectExpression(expr)) {
            for (const prop of expr.properties) {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'title' && t.isStringLiteral(prop.value)) {
                screenTitle = prop.value.value;
              }
            }
          }
        }
      }
      if (screenName && screenTitle) {
        titles.set(routePrefix + screenName, screenTitle);
      }
    },
  });
}

function scanExpoRouterApp(projectRoot) {
  const appDir = findAppDir(projectRoot);
  if (!appDir) throw new Error('Could not find app/ or src/app/ directory.');
  console.log(`[generate-map] Scanning Expo Router app: ${appDir}`);

  const screens = [];
  const layoutTitles = new Map();
  const extractedCache = new Map();
  const resolvedImplementationCache = new Map();
  extractLayoutTitles(appDir, appDir, layoutTitles);
  scanDirectory(appDir, appDir, screens, layoutTitles, projectRoot, extractedCache, resolvedImplementationCache);
  return screens;
}

function scanDirectory(dir, appRoot, screens, layoutTitles, projectRoot, extractedCache, resolvedImplementationCache) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      scanDirectory(fullPath, appRoot, screens, layoutTitles, projectRoot, extractedCache, resolvedImplementationCache);
      continue;
    }
    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;
    if (entry.name === '_layout.tsx' || entry.name === '_layout.ts') continue;
    if (entry.name.startsWith('+') || entry.name.startsWith('_')) continue;

    const routeName = filePathToRouteName(fullPath, appRoot);
    const title = layoutTitles.get(routeName);
    const routeCandidate = buildScreenCandidate(routeName, title, fullPath, extractedCache);
    const resolvedImplementation = resolvedImplementationCache.get(fullPath) || resolveProxyScreenFile(fullPath, projectRoot);
    resolvedImplementationCache.set(fullPath, resolvedImplementation);
    const implementationCandidate = resolvedImplementation !== fullPath
      ? buildScreenCandidate(routeName, title, resolvedImplementation, extractedCache)
      : routeCandidate;
    const chosenCandidate = scoreScreenCandidate(implementationCandidate) > scoreScreenCandidate(routeCandidate)
      ? implementationCandidate
      : routeCandidate;

    screens.push({
      routeName: chosenCandidate.routeName,
      filePath: chosenCandidate.filePath,
      title: chosenCandidate.title,
      description: chosenCandidate.description,
      navigationLinks: chosenCandidate.navigationLinks,
    });
  }
}

function buildScreenCandidate(routeName, title, filePath, extractedCache) {
  let extracted = extractedCache.get(filePath);
  if (!extracted) {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    extracted = extractContentFromAST(sourceCode, filePath);
    extractedCache.set(filePath, extracted);
  }

  return {
    routeName,
    filePath,
    title,
    description: buildDescription(extracted),
    navigationLinks: extracted.navigationLinks,
  };
}

function scoreScreenCandidate(screen) {
  let score = 0;

  if (fs.existsSync(screen.filePath)) score += 20;
  if (screen.description && screen.description !== 'Screen content') score += 80;
  if (screen.navigationLinks.length > 0) score += 12;
  if (screen.title) score += 4;

  const describedElements = screen.description
    .split(',')
    .map(part => part.trim())
    .filter(part => part && part !== 'Screen content').length;
  score += Math.min(describedElements, 8) * 6;

  const componentOnlyElements = screen.description
    .split(',')
    .map(part => part.trim())
    .filter(part => part.endsWith('(component)')).length;
  if (componentOnlyElements > 0) score -= componentOnlyElements * 20;
  if (describedElements > 0 && componentOnlyElements === describedElements) score -= 120;

  return score;
}

// ─── React Navigation Scanner ─────────────────────────────────

const NAVIGATOR_FUNCTIONS = [
  'createStackNavigator', 'createNativeStackNavigator',
  'createBottomTabNavigator', 'createDrawerNavigator',
  'createMaterialBottomTabNavigator', 'createMaterialTopTabNavigator',
  'createSwitchNavigator', // v4
];

function scanReactNavigationApp(projectRoot) {
  console.log(`[generate-map] Scanning React Navigation project: ${projectRoot}`);
  const navigatorFiles = findNavigatorFiles(projectRoot);
  if (navigatorFiles.length === 0) {
    throw new Error('Could not find any React Navigation navigator definitions.');
  }
  console.log(`[generate-map] Found ${navigatorFiles.length} navigator file(s)`);

  const screens = [];
  const processedRoutes = new Set();
  const fileAstCache = new Map();

  for (const navFile of navigatorFiles) {
    const sourceCode = fs.readFileSync(navFile, 'utf-8');
    const screenDefs = extractScreenDefinitions(sourceCode, navFile, projectRoot);
    for (const def of screenDefs) {
      if (processedRoutes.has(def.routeName)) continue;
      processedRoutes.add(def.routeName);

      if (fs.existsSync(def.filePath)) {
        let extracted;
        if (fileAstCache.has(def.filePath)) {
          extracted = fileAstCache.get(def.filePath);
        } else {
          const screenSource = fs.readFileSync(def.filePath, 'utf-8');
          extracted = extractContentFromAST(screenSource, def.filePath);
          fileAstCache.set(def.filePath, extracted);
        }

        screens.push({
          routeName: def.routeName, filePath: def.filePath, title: def.title,
          description: buildDescription(extracted), navigationLinks: extracted.navigationLinks,
        });
      } else {
        screens.push({
          routeName: def.routeName, filePath: def.filePath, title: def.title,
          description: 'Screen content', navigationLinks: [],
        });
      }
    }
  }
  return screens;
}

function findNavigatorFiles(projectRoot) {
  const result = [];
  const srcDir = path.join(projectRoot, 'src');
  const searchDir = fs.existsSync(srcDir) ? srcDir : projectRoot;
  walkAndSearch(searchDir, result);
  return result;
}

function walkAndSearch(dir, result) {
  const skipDirs = ['node_modules', '.git', 'lib', 'build', 'dist', '__tests__', '__mocks__', 'android', 'ios'];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name) || entry.name.startsWith('.')) continue;
      walkAndSearch(fullPath, result);
      continue;
    }
    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;
    const content = fs.readFileSync(fullPath, 'utf-8');
    if (NAVIGATOR_FUNCTIONS.some(fn => content.includes(fn))) result.push(fullPath);
  }
}

// Extract require() path from an arrow/function body (for getComponent lazy-loading)
// Handles: () => require('../screens/home').default
//          () => { X = X || require('../screens/home').default; return X; }
function extractRequirePathFromBody(body) {
  function findRequire(node) {
    if (!node) return null;
    // require('path')
    if (t.isCallExpression(node) && t.isIdentifier(node.callee) && node.callee.name === 'require' && node.arguments[0] && t.isStringLiteral(node.arguments[0])) {
      return node.arguments[0].value;
    }
    // require('path').default
    if (t.isMemberExpression(node)) return findRequire(node.object);
    // X || require('path').default  (logical expression)
    if (t.isLogicalExpression(node)) return findRequire(node.right) || findRequire(node.left);
    // Assignment: X = require('path')
    if (t.isAssignmentExpression(node)) return findRequire(node.right);
    return null;
  }

  // Expression body: () => require(...)
  if (!t.isBlockStatement(body)) return findRequire(body);

  // Block body: () => { ...; return X; }
  for (const stmt of body.body) {
    if (t.isReturnStatement(stmt)) {
      const r = findRequire(stmt.argument);
      if (r) return r;
    }
    if (t.isExpressionStatement(stmt)) {
      const r = findRequire(stmt.expression);
      if (r) return r;
    }
  }
  return null;
}

// Resolve a require() path relative to the navigator file
function resolveRequirePath(requirePath, fromFile) {
  if (!requirePath.startsWith('.')) return null; // skip node_modules
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, requirePath);
  const exts = ['.tsx', '.ts', '.js', '.jsx'];
  for (const ext of exts) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  for (const ext of exts) {
    const indexPath = path.join(resolved, `index${ext}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }
  if (fs.existsSync(resolved)) return resolved;
  return null;
}

function extractScreenDefinitions(sourceCode, filePath, projectRoot) {
  const screens = [];
  const imports = new Map();
  let ast;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return screens; }

  traverse(ast, {
    ImportDeclaration(nodePath) {
      const source = nodePath.node.source.value;
      for (const spec of nodePath.node.specifiers) {
        if (t.isImportDefaultSpecifier(spec) || t.isImportSpecifier(spec)) {
          imports.set(spec.local.name, source);
        }
      }
    },
    JSXOpeningElement(nodePath) {
      const nameNode = nodePath.node.name;
      if (!t.isJSXMemberExpression(nameNode)) return;
      if (!t.isJSXIdentifier(nameNode.property) || nameNode.property.name !== 'Screen') return;
      let screenName = null, componentName = null, title = null, screenFilePath = null;
      for (const attr of nodePath.node.attributes) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
        if (attr.name.name === 'name') {
          if (t.isStringLiteral(attr.value)) {
            screenName = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            const expr = attr.value.expression;
            if (t.isStringLiteral(expr)) {
               screenName = expr.value;
            } else if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
               screenName = expr.property.name;
            } else if (t.isIdentifier(expr)) {
               screenName = expr.name;
            }
          }
        }
        if (attr.name.name === 'component' && t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (t.isIdentifier(expr)) {
            componentName = expr.name;
          } else if (t.isMemberExpression(expr)) {
            if (t.isIdentifier(expr.object) && t.isIdentifier(expr.property)) {
               componentName = `${expr.object.name}.${expr.property.name}`;
            }
          }
        }
        // getComponent={() => require('../screens/home').default} (lazy-loading)
        if (attr.name.name === 'getComponent' && t.isJSXExpressionContainer(attr.value)) {
          const fn = attr.value.expression;
          if (t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) {
            const requirePath = extractRequirePathFromBody(fn.body);
            if (requirePath) {
              const resolvedPath = resolveRequirePath(requirePath, filePath);
              if (resolvedPath) {
                componentName = '__getComponent__'; // sentinel — filePath override below
                screenFilePath = resolvedPath;
              }
            }
          }
        }
        if (attr.name.name === 'options' && t.isJSXExpressionContainer(attr.value)) {
          title = extractTitleFromOptions(attr.value.expression);
        }
      }
      if (screenName && (componentName || screenFilePath)) {
        const resolvedFile = screenFilePath || resolveComponentPath(componentName, imports, filePath);
        screens.push({ routeName: screenName, componentName: componentName || screenName, filePath: resolvedFile, title: title || undefined });
      }
    },
    CallExpression(nodePath) {
      const callee = nodePath.node.callee;
      if (!t.isIdentifier(callee) || !NAVIGATOR_FUNCTIONS.includes(callee.name)) return;
      const firstArg = nodePath.node.arguments[0];
      if (!t.isObjectExpression(firstArg)) return;

      // v5+: routes nested under `screens` key
      // v4:  routes are direct top-level properties (no `screens` wrapper)
      let routeProps = null;
      for (const prop of firstArg.properties) {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'screens' && t.isObjectExpression(prop.value)) {
          routeProps = prop.value.properties;
          break;
        }
      }

      // v4 fallback: treat all top-level properties as routes (skip known config keys)
      const V4_CONFIG_KEYS = new Set([
        'initialRouteName', 'headerMode', 'defaultNavigationOptions', 'navigationOptions',
        'mode', 'cardStyle', 'transitionConfig', 'onTransitionStart', 'onTransitionEnd',
        'contentComponent', 'drawerPosition', 'drawerWidth', 'overlayColor', 'drawerType',
        'lazy', 'tabBarOptions', 'tabBarComponent', 'backBehavior', 'order',
      ]);
      if (!routeProps) {
        routeProps = firstArg.properties.filter(p =>
          t.isObjectProperty(p) && ((t.isIdentifier(p.key) && !V4_CONFIG_KEYS.has(p.key.name)) || t.isStringLiteral(p.key))
        );
      }

      if (!routeProps) return;

      for (const screenProp of routeProps) {
        if (!t.isObjectProperty(screenProp)) continue;
        let screenName = null;
        if (!screenProp.computed) {
          if (t.isIdentifier(screenProp.key)) screenName = screenProp.key.name;
          else if (t.isStringLiteral(screenProp.key)) screenName = screenProp.key.value;
        } else {
          if (t.isIdentifier(screenProp.key)) screenName = screenProp.key.name;
          else if (t.isMemberExpression(screenProp.key) && t.isIdentifier(screenProp.key.property)) {
            screenName = screenProp.key.property.name;
          }
        }
        if (!screenName) continue;
        let componentName = null, title;
        if (t.isIdentifier(screenProp.value)) {
          componentName = screenProp.value.name;
        } else if (t.isMemberExpression(screenProp.value)) {
          if (t.isIdentifier(screenProp.value.object) && t.isIdentifier(screenProp.value.property)) {
            componentName = `${screenProp.value.object.name}.${screenProp.value.property.name}`;
          }
        }
        if (t.isObjectExpression(screenProp.value)) {
          for (const inner of screenProp.value.properties) {
            if (!t.isObjectProperty(inner) || !t.isIdentifier(inner.key)) continue;
            if (inner.key.name === 'screen' && t.isIdentifier(inner.value)) componentName = inner.value.name;
            if (inner.key.name === 'options' || inner.key.name === 'navigationOptions') title = extractTitleFromOptions(inner.value) || undefined;
          }
        }
        if (componentName) {
          screens.push({ routeName: screenName, componentName, filePath: resolveComponentPath(componentName, imports, filePath), title });
        }
      }
    },
  });
  return screens;
}

function extractTitleFromOptions(optionsNode) {
  if (!t.isObjectExpression(optionsNode)) return null;
  for (const prop of optionsNode.properties) {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'title' && t.isStringLiteral(prop.value)) {
      return prop.value.value;
    }
  }
  return null;
}

const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const DEFAULT_PROXY_HOPS = 10;
const moduleProxyInfoCache = new Map();
const tsConfigResolutionCache = new Map();

function resolveComponentPath(componentName, imports, currentFile) {
  const parts = componentName.split('.');
  const baseComponent = parts[0];
  const property = parts[1];

  if (!baseComponent) return currentFile;

  const importPath = imports.get(baseComponent);
  if (!importPath) return currentFile;

  const resolvedBase = resolveImportSpecifier(importPath, currentFile, _projectRoot);
  if (!resolvedBase) return currentFile;

  if (!property || resolvedBase === currentFile) return resolvedBase;

  return traceExportProperty(resolvedBase, property, _projectRoot) || resolvedBase;
}

function resolveProxyScreenFile(entryFile, projectRoot, maxHops = DEFAULT_PROXY_HOPS) {
  let currentFile = path.resolve(entryFile);
  let exportName = 'default';
  const visited = new Set();

  for (let hop = 0; hop < maxHops; hop++) {
    const visitKey = `${currentFile}::${exportName}`;
    if (visited.has(visitKey)) return currentFile;
    visited.add(visitKey);

    const next = resolveExportTarget(currentFile, exportName, projectRoot);
    if (!next) return currentFile;
    if (next.filePath === currentFile && next.exportName === exportName) return currentFile;

    currentFile = next.filePath;
    exportName = next.exportName;
  }

  return currentFile;
}

function resolveExportTarget(filePath, exportName, projectRoot) {
  const info = getModuleProxyInfo(filePath);
  if (!info) return null;

  if (exportName === 'default') {
    if (info.defaultExportLocal) {
      const imported = info.imports.get(info.defaultExportLocal);
      if (imported) {
        const resolved = resolveImportSpecifier(imported.source, filePath, projectRoot);
        if (resolved) {
          return { filePath: resolved, exportName: imported.importedName };
        }
      }
      return null;
    }

    if (info.hasLocalDefaultExport) return null;
  }

  const link = info.exportLinks.find(candidate => candidate.exportedName === exportName);
  if (!link) return null;

  if (link.source) {
    const resolved = resolveImportSpecifier(link.source, filePath, projectRoot);
    if (!resolved) return null;
    return { filePath: resolved, exportName: link.importedName || 'default' };
  }

  if (link.localName) {
    const imported = info.imports.get(link.localName);
    if (imported) {
      const resolved = resolveImportSpecifier(imported.source, filePath, projectRoot);
      if (!resolved) return null;
      return { filePath: resolved, exportName: imported.importedName };
    }

    if (info.localBindings.has(link.localName)) return null;
  }

  return null;
}

function traceExportProperty(filePath, propertyName, projectRoot) {
  if (!fs.existsSync(filePath)) return null;
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return null; }

  const imports = new Map();
  let importName = null;

  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      const source = node.source.value;
      for (const specifier of node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          imports.set(specifier.local.name, source);
        } else if (t.isImportSpecifier(specifier)) {
          imports.set(specifier.local.name, t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value);
        }
      }
      continue;
    }

    if (t.isVariableDeclaration(node)) {
      for (const declaration of node.declarations) {
        if (t.isIdentifier(declaration.id) && t.isObjectExpression(declaration.init)) {
          for (const property of declaration.init.properties) {
            if (
              t.isObjectProperty(property) &&
              !property.computed &&
              t.isIdentifier(property.key) &&
              property.key.name === propertyName &&
              t.isIdentifier(property.value)
            ) {
              importName = property.value.name;
            }
          }
        }
      }
    }
  }

  if (!importName) return null;

  const importPath = imports.get(importName);
  if (!importPath) return null;

  return resolveImportSpecifier(importPath, filePath, projectRoot);
}

function resolveImportSpecifier(importPath, currentFile, projectRoot) {
  const direct = resolveImportCandidate(importPath, currentFile, projectRoot);
  return direct ? path.resolve(direct) : null;
}

function resolveImportCandidate(importPath, currentFile, projectRoot) {
  if (!importPath || importPath.includes('node_modules')) return null;

  if (importPath.startsWith('.')) {
    return resolveFilePath(path.dirname(currentFile), importPath);
  }

  const tsConfig = getTsConfigResolution(projectRoot);
  for (const alias of tsConfig.aliases) {
    const wildcardValue = matchAlias(importPath, alias.keyPrefix, alias.keySuffix);
    if (wildcardValue === null) continue;
    const target = `${alias.targetPrefix}${wildcardValue}${alias.targetSuffix}`;
    const resolved = resolveFilePath(projectRoot, target);
    if (resolved) return resolved;
  }

  if (tsConfig.baseUrl) {
    const resolved = resolveFilePath(tsConfig.baseUrl, importPath);
    if (resolved) return resolved;
  }

  const srcResolved = resolveFilePath(path.join(projectRoot, 'src'), importPath);
  if (srcResolved) return srcResolved;

  const rootResolved = resolveFilePath(projectRoot, importPath);
  if (rootResolved) return rootResolved;

  return null;
}

function resolveFilePath(baseDir, rawPath) {
  const candidateBase = path.resolve(baseDir, rawPath);

  if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
    return candidateBase;
  }

  for (const extension of FILE_EXTENSIONS) {
    const withExtension = `${candidateBase}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }

  for (const extension of FILE_EXTENSIONS) {
    const indexPath = path.join(candidateBase, `index${extension}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return null;
}

function getTsConfigResolution(projectRoot) {
  const cached = tsConfigResolutionCache.get(projectRoot);
  if (cached) return cached;

  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const resolution = { aliases: [], baseUrl: undefined };

  try {
    if (fs.existsSync(tsConfigPath)) {
      const raw = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      const compilerOptions = (raw && raw.compilerOptions) || {};
      if (typeof compilerOptions.baseUrl === 'string') {
        resolution.baseUrl = path.resolve(projectRoot, compilerOptions.baseUrl);
      }
      resolution.aliases = normalizePathAliases(compilerOptions.paths || {});
    }
  } catch {
    // Ignore malformed tsconfig and fall back to conventional resolution.
  }

  tsConfigResolutionCache.set(projectRoot, resolution);
  return resolution;
}

function normalizePathAliases(pathsConfig) {
  const aliases = [];
  for (const [key, values] of Object.entries(pathsConfig)) {
    const target = values && values[0];
    if (!target) continue;
    const [keyPrefix, keySuffix] = splitAliasPattern(key);
    const [targetPrefix, targetSuffix] = splitAliasPattern(target);
    aliases.push({ keyPrefix, keySuffix, targetPrefix, targetSuffix });
  }
  return aliases;
}

function splitAliasPattern(pattern) {
  const starIndex = pattern.indexOf('*');
  if (starIndex === -1) return [pattern, ''];
  return [pattern.slice(0, starIndex), pattern.slice(starIndex + 1)];
}

function matchAlias(value, prefix, suffix) {
  if (!value.startsWith(prefix)) return null;
  if (suffix && !value.endsWith(suffix)) return null;
  return value.slice(prefix.length, suffix ? value.length - suffix.length : undefined);
}

function getModuleProxyInfo(filePath) {
  const cached = moduleProxyInfoCache.get(filePath);
  if (cached !== undefined) return cached;

  if (!fs.existsSync(filePath)) {
    moduleProxyInfoCache.set(filePath, null);
    return null;
  }

  let ast;
  try {
    ast = parse(fs.readFileSync(filePath, 'utf-8'), {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    moduleProxyInfoCache.set(filePath, null);
    return null;
  }

  const info = {
    imports: new Map(),
    exportLinks: [],
    localBindings: new Set(),
    defaultExportLocal: undefined,
    hasLocalDefaultExport: false,
  };

  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      const source = node.source.value;
      for (const specifier of node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          info.imports.set(specifier.local.name, { source, importedName: 'default' });
        } else if (t.isImportSpecifier(specifier)) {
          info.imports.set(specifier.local.name, {
            source,
            importedName: t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value,
          });
        }
      }
      continue;
    }

    if (t.isExportDefaultDeclaration(node)) {
      if (t.isIdentifier(node.declaration)) {
        info.defaultExportLocal = node.declaration.name;
      } else {
        info.hasLocalDefaultExport = true;
        collectLocalBindingNames(node.declaration, info.localBindings);
      }
      continue;
    }

    if (t.isExportNamedDeclaration(node)) {
      if (node.declaration) {
        collectLocalBindingNames(node.declaration, info.localBindings);
      }

      for (const specifier of node.specifiers) {
        if (!t.isExportSpecifier(specifier)) continue;

        info.exportLinks.push({
          exportedName: getModuleExportedName(specifier.exported),
          source: node.source ? node.source.value : undefined,
          importedName: node.source ? getModuleExportedName(specifier.local) : undefined,
          localName: node.source ? undefined : getModuleExportedName(specifier.local),
        });
      }
    }
  }

  moduleProxyInfoCache.set(filePath, info);
  return info;
}

function getModuleExportedName(node) {
  return t.isIdentifier(node) ? node.name : node.value;
}

function collectLocalBindingNames(node, bindings) {
  if (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) {
    if (node.id) bindings.add(node.id.name);
    return;
  }

  if (t.isVariableDeclaration(node)) {
    for (const declaration of node.declarations) {
      collectBindingNamesFromPattern(declaration.id, bindings);
    }
  }
}

function collectBindingNamesFromPattern(pattern, bindings) {
  if (t.isIdentifier(pattern)) {
    bindings.add(pattern.name);
    return;
  }

  if (t.isObjectPattern(pattern)) {
    for (const property of pattern.properties) {
      if (t.isRestElement(property)) {
        collectBindingNamesFromPattern(property.argument, bindings);
      } else if (t.isObjectProperty(property)) {
        collectBindingNamesFromPattern(property.value, bindings);
      }
    }
    return;
  }

  if (t.isArrayPattern(pattern)) {
    for (const element of pattern.elements) {
      if (element) collectBindingNamesFromPattern(element, bindings);
    }
    return;
  }

  if (t.isAssignmentPattern(pattern)) {
    collectBindingNamesFromPattern(pattern.left, bindings);
    return;
  }

  if (t.isRestElement(pattern)) {
    collectBindingNamesFromPattern(pattern.argument, bindings);
  }
}

// ─── Main ──────────────────────────────────────────────────────





function detectFramework(projectRoot) {
  const srcApp = path.join(projectRoot, 'src', 'app');
  const appDir = path.join(projectRoot, 'app');
  if (fs.existsSync(srcApp) || fs.existsSync(appDir)) {
    const layoutInSrc = path.join(srcApp, '_layout.tsx');
    const layoutInApp = path.join(appDir, '_layout.tsx');
    if (fs.existsSync(layoutInSrc) || fs.existsSync(layoutInApp)) return 'expo-router';
  }
  return 'react-navigation';
}

function parseArgs(argv) {
  const args = {
    dir: '',
    watch: false,
    include: [],
    exclude: [],
  };
  for (const arg of argv) {
    if (arg === '--watch' || arg === '-w') args.watch = true;
    if (arg.startsWith('--dir=')) args.dir = arg.split('=')[1];
    if (arg.startsWith('--include=')) {
      args.include = arg.slice('--include='.length).split(',').map((entry) => entry.trim()).filter(Boolean);
    }
    if (arg.startsWith('--exclude=')) {
      args.exclude = arg.slice('--exclude='.length).split(',').map((entry) => entry.trim()).filter(Boolean);
    }
  }
  return args;
}

function routeMatchesPattern(routeName, pattern) {
  if (!pattern) return false;
  if (pattern === routeName) return true;
  if (!pattern.includes('*')) {
    return routeName === pattern;
  }
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\\\*/g, '.*')}$`);
  return regex.test(routeName);
}

function routeMatchesAnyPattern(routeName, patterns) {
  return patterns.some((pattern) => routeMatchesPattern(routeName, pattern));
}

function filterScreensByRoutePatterns(screens, args) {
  return screens.filter((screen) => {
    if (args.include.length > 0 && !routeMatchesAnyPattern(screen.routeName, args.include)) {
      return false;
    }
    if (args.exclude.length > 0 && routeMatchesAnyPattern(screen.routeName, args.exclude)) {
      return false;
    }
    return true;
  });
}

async function generate(args, projectRoot) {
  _projectRoot = projectRoot; // for module alias resolution in extractImportPaths
  _transitiveCache.clear(); // reset cache for fresh scan
  const framework = detectFramework(projectRoot);
  console.log(`📱 Framework: ${framework}`);

  const scannedScreens = framework === 'expo-router'
    ? scanExpoRouterApp(projectRoot)
    : scanReactNavigationApp(projectRoot);
  const filteredScreens = filterScreensByRoutePatterns(scannedScreens, args);

  console.log(`📄 Found ${filteredScreens.length} screen(s)`);

  // Enrich navigation links with component-level navigation
  console.log('🔍 Scanning components for navigation calls...');
  const globalIndex = buildGlobalNavigateIndex(projectRoot);
  const navigatorFiles = framework === 'react-navigation' ? findNavigatorFiles(projectRoot) : [];
  const added = enrichScreensWithComponentNavLinks(filteredScreens, globalIndex, navigatorFiles);
  console.log(`   Found ${globalIndex.size} component(s) with navigation, added ${added} link(s)`);


  // Build output — per-screen navigatesTo, filtered to known routes only
  const allRouteSet = new Set(filteredScreens.map(s => s.routeName));

  // Build basename lookup for fuzzy matching (e.g. "Chat" → "screens/Chat")
  const basenameMap = new Map(); // basename → full route (shortest path wins)
  for (const route of allRouteSet) {
    const base = route.includes('/') ? route.substring(route.lastIndexOf('/') + 1) : route;
    if (!basenameMap.has(base) || route.length < basenameMap.get(base).length) {
      basenameMap.set(base, route);
    }
  }

  function resolveNavLink(link) {
    // 1. Exact match
    if (allRouteSet.has(link)) return link;
    // 2. Strip leading slash and match
    const stripped = link.replace(/^\/+/, '');
    if (stripped && allRouteSet.has(stripped)) return stripped;
    // 3. Basename match (e.g. "Chat" → "screens/Chat")
    if (basenameMap.has(link)) return basenameMap.get(link);
    if (basenameMap.has(stripped)) return basenameMap.get(stripped);
    return null;
  }

  const screenMap = { generatedAt: new Date().toISOString(), framework, screens: {} };
  for (const screen of filteredScreens) {
    const validLinks = screen.navigationLinks.map(link => resolveNavLink(link)).filter(Boolean);
    // Deduplicate (two different raw links may resolve to the same route)
    const uniqueLinks = [...new Set(validLinks)];
    if (screen.navigationLinks.length > 0) {
      const noise = screen.navigationLinks.length - validLinks.length;
      console.log(`  🔗 ${screen.routeName} → ${uniqueLinks.join(', ')}${noise > 0 ? ` (${noise} noise filtered)` : ''}`);
    }
    screenMap.screens[screen.routeName] = {
      title: screen.title || undefined,
      description: screen.description,
      navigatesTo: uniqueLinks.length > 0 ? uniqueLinks : undefined,
    };
  }

  const outputPath = path.join(projectRoot, 'ai-screen-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(screenMap, null, 2));

  const linkedCount = filteredScreens.filter(s => s.navigationLinks.map(l => resolveNavLink(l)).some(Boolean)).length;
  console.log('━'.repeat(40));
  console.log(`✅ Generated ${outputPath}`);
  console.log(`   ${Object.keys(screenMap.screens).length} screens, ${linkedCount} with navigation links`);

  if (!args.watch) {
    console.log('\n💡 Import in your app:');
    console.log("   import screenMap from './ai-screen-map.json';");
    console.log('   <AIAgent screenMap={screenMap} />');
  }

  return outputPath;
}

function startWatch(args, projectRoot, outputPath) {
  // Determine which directory to watch
  const framework = detectFramework(projectRoot);
  let watchDir;
  if (framework === 'expo-router') {
    const srcApp = path.join(projectRoot, 'app');
    const srcSrcApp = path.join(projectRoot, 'src', 'app');
    watchDir = fs.existsSync(srcSrcApp) ? srcSrcApp : srcApp;
  } else {
    const src = path.join(projectRoot, 'src');
    watchDir = fs.existsSync(src) ? src : projectRoot;
  }

  console.log(`\n👀 Watching ${path.relative(process.cwd(), watchDir)} for changes...`);
  console.log('   Press Ctrl+C to stop.\n');

  let debounceTimer = null;
  const DEBOUNCE_MS = 500;
  const SCREEN_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);
  const IGNORE_DIRS = ['node_modules', '.expo', '.git', '__tests__'];

  fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    // Skip non-screen files
    const ext = path.extname(filename);
    if (!SCREEN_EXTENSIONS.has(ext)) return;

    // Skip ignored directories
    if (IGNORE_DIRS.some(dir => filename.includes(dir))) return;

    // Skip the output file itself
    if (filename.includes('ai-screen-map.json')) return;

    // Debounce — regenerate after 500ms of no changes
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log(`\n🔄 Change detected: ${filename}`);
      console.log('━'.repeat(40));
      try {
        await generate(args, projectRoot);
        console.log('\n👀 Watching for changes...');
      } catch (err) {
        console.error('❌ Regeneration failed:', err.message);
        console.log('\n👀 Still watching...');
      }
    }, DEBOUNCE_MS);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args.dir || process.cwd();

  console.log('🗺️  Screen Map Generator');
  console.log('━'.repeat(40));

  const outputPath = await generate(args, projectRoot);

  if (args.watch) {
    startWatch(args, projectRoot, outputPath);
  }
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });

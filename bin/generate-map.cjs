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
            const buttonLabel = findChildTextContentRecursive(astPath);
            if (buttonLabel) elements.push(`${buttonLabel} (button)`);
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
  });

  return {
    elements: deduplicateAndPrioritize(elements),
    navigationLinks: [...new Set(navigationLinks)],
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
function extractImportPaths(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const importPaths = [];

  // Fast regex extraction — no need for full Babel parse
  const importRegex = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath || !importPath.startsWith('.')) continue; // Skip non-relative (npm packages)

    const dir = path.dirname(filePath);
    const resolved = resolveFilePath(dir, importPath);
    if (resolved) importPaths.push(resolved);
  }
  return importPaths;
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
    // Skip screens whose file is a navigator or a shared route registry
    if (navigatorSet.has(resolvedPath) || sharedFilePaths.has(resolvedPath)) continue;

    const importedFiles = extractImportPaths(screen.filePath);
    const existingLinks = new Set(screen.navigationLinks);

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
      const text = extractTextRecursive(child);
      if (text) return text;
    }
  }
  return null;
}

function findChildTextContentRecursive(pressablePath) {
  const jsxElement = pressablePath.parent;
  if (!t.isJSXElement(jsxElement)) return null;
  return extractTextRecursive(jsxElement);
}

function extractTextRecursive(element, depth = 0) {
  if (depth > 4) return null;
  for (const child of element.children) {
    if (t.isJSXText(child)) {
      const text = child.value.trim();
      if (text) return text;
    }
    if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      const hint = extractSemanticHint(child.expression);
      if (hint) return hint;
    }
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (ICON_EXACT.has(childName) || childName.endsWith('Icon') ||
          childName.endsWith('_Dark') || childName.endsWith('_Light')) continue;
      const text = extractTextRecursive(child, depth + 1);
      if (text) return text;
    }
  }
  return null;
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
  extractLayoutTitles(appDir, appDir, layoutTitles);
  scanDirectory(appDir, appDir, screens, layoutTitles);
  return screens;
}

function scanDirectory(dir, appRoot, screens, layoutTitles) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      scanDirectory(fullPath, appRoot, screens, layoutTitles);
      continue;
    }
    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;
    if (entry.name === '_layout.tsx' || entry.name === '_layout.ts') continue;
    if (entry.name.startsWith('+') || entry.name.startsWith('_')) continue;

    const routeName = filePathToRouteName(fullPath, appRoot);
    const sourceCode = fs.readFileSync(fullPath, 'utf-8');
    const extracted = extractContentFromAST(sourceCode, fullPath);
    const title = layoutTitles.get(routeName);

    screens.push({
      routeName, filePath: fullPath, title,
      description: buildDescription(extracted),
      navigationLinks: extracted.navigationLinks,
    });
  }
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
      let screenName = null, componentName = null, title = null;
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
        if (attr.name.name === 'options' && t.isJSXExpressionContainer(attr.value)) {
          title = extractTitleFromOptions(attr.value.expression);
        }
      }
      if (screenName && componentName) {
        screens.push({ routeName: screenName, componentName, filePath: resolveComponentPath(componentName, imports, filePath), title: title || undefined });
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

function resolveComponentPath(componentName, imports, currentFile) {
  const parts = componentName.split('.');
  const baseComponent = parts[0];
  const property = parts[1];

  const importPath = imports.get(baseComponent);
  if (!importPath) return currentFile;

  let resolvedBase = currentFile;
  if (importPath.startsWith('.')) {
    const dir = path.dirname(currentFile);
    const resolved = path.resolve(dir, importPath);
    let found = false;
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      if (fs.existsSync(resolved + ext)) {
        resolvedBase = resolved + ext;
        found = true; break;
      }
    }
    if (!found) {
      for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
        const idx = path.join(resolved, `index${ext}`);
        if (fs.existsSync(idx)) {
          resolvedBase = idx;
          found = true; break;
        }
      }
    }
    if (!found) resolvedBase = resolved;
  }

  if (!property || resolvedBase === currentFile) return resolvedBase;

  return traceExportProperty(resolvedBase, baseComponent, property) || resolvedBase;
}

function traceExportProperty(filePath, objectName, propertyName) {
  if (!fs.existsSync(filePath)) return null;
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return null; }

  const innerImports = new Map(); // identifier → import path
  const localVarInits = new Map(); // identifier → AST node (for const X = React.lazy(...))
  let targetNode = null; // The AST node for the property value

  traverse(ast, {
    ImportDeclaration(nodePath) {
      const source = nodePath.node.source.value;
      for (const specifier of nodePath.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier) || t.isImportSpecifier(specifier)) {
          innerImports.set(specifier.local.name, source);
        }
      }
    },
    VariableDeclarator(nodePath) {
      const id = nodePath.node.id;
      const init = nodePath.node.init;
      if (!t.isIdentifier(id)) return;

      // Collect the StackRoute = { ... } object and find the target property
      if (id.name === objectName && t.isObjectExpression(init)) {
        for (const prop of init.properties) {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === propertyName) {
            targetNode = prop.value;
          }
        }
      }

      // Also collect all local variable assignments for later unwrapping
      if (init) {
        localVarInits.set(id.name, init);
      }
    }
  });

  if (!targetNode) return null;

  // Unwrap the target to find the component source
  const ref = unwrapToComponentRef(targetNode, innerImports, localVarInits);
  if (!ref) return null;

  const dir = path.dirname(filePath);
  const resolved = path.resolve(dir, ref);
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const idx = path.join(resolved, `index${ext}`);
    if (fs.existsSync(idx)) return idx;
  }
  return resolved;
}

/**
 * Recursively unwrap AST nodes to find the original component import path.
 * Handles: Identifier (import lookup), React.lazy(() => import('path')),
 * React.memo(X), connect(mapState)(X), observer(X), withX(X), etc.
 * Returns the relative import path string or null.
 */
function unwrapToComponentRef(node, imports, localVars, depth = 0) {
  if (!node || depth > 5) return null; // safety: prevent infinite recursion

  // Direct identifier: look up in imports first, then local vars
  if (t.isIdentifier(node)) {
    const importPath = imports.get(node.name);
    if (importPath && importPath.startsWith('.')) return importPath;

    // Check if it's a local variable (const X = React.lazy(...))
    const localInit = localVars.get(node.name);
    if (localInit) return unwrapToComponentRef(localInit, imports, localVars, depth + 1);

    return null;
  }

  // CallExpression: React.lazy(), React.memo(), connect()(), observer(), withX()
  if (t.isCallExpression(node)) {
    // React.lazy(() => import('./path')) — extract dynamic import path
    const callee = node.callee;
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: 'lazy' })) {
      const arrowFn = node.arguments[0];
      if (t.isArrowFunctionExpression(arrowFn) || t.isFunctionExpression(arrowFn)) {
        const body = t.isBlockStatement(arrowFn.body)
          ? arrowFn.body.body.find(s => t.isReturnStatement(s))?.argument
          : arrowFn.body;
        if (body && t.isCallExpression(body) && t.isImport(body.callee)) {
          const importArg = body.arguments[0];
          if (t.isStringLiteral(importArg)) return importArg.value;
        }
      }
    }

    // For HOCs: React.memo(X), observer(X), withNavigation(X)
    // The component is typically the first argument
    if (node.arguments.length > 0) {
      const result = unwrapToComponentRef(node.arguments[0], imports, localVars, depth + 1);
      if (result) return result;
    }

    // Chained HOC: connect(mapState)(Component) — callee is itself a CallExpression
    if (t.isCallExpression(callee) && node.arguments.length > 0) {
      return unwrapToComponentRef(node.arguments[0], imports, localVars, depth + 1);
    }

    return null;
  }

  return null;
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
  const args = { dir: '', watch: false };
  for (const arg of argv) {
    if (arg === '--watch' || arg === '-w') args.watch = true;
    if (arg.startsWith('--dir=')) args.dir = arg.split('=')[1];
  }
  return args;
}

async function generate(args, projectRoot) {
  const framework = detectFramework(projectRoot);
  console.log(`📱 Framework: ${framework}`);

  const scannedScreens = framework === 'expo-router'
    ? scanExpoRouterApp(projectRoot)
    : scanReactNavigationApp(projectRoot);

  console.log(`📄 Found ${scannedScreens.length} screen(s)`);

  // Enrich navigation links with component-level navigation
  console.log('🔍 Scanning components for navigation calls...');
  const globalIndex = buildGlobalNavigateIndex(projectRoot);
  const navigatorFiles = framework === 'react-navigation' ? findNavigatorFiles(projectRoot) : [];
  const added = enrichScreensWithComponentNavLinks(scannedScreens, globalIndex, navigatorFiles);
  console.log(`   Found ${globalIndex.size} component(s) with navigation, added ${added} link(s)`);


  // Build output — per-screen navigatesTo, filtered to known routes only
  const allRouteSet = new Set(scannedScreens.map(s => s.routeName));
  const screenMap = { generatedAt: new Date().toISOString(), framework, screens: {} };
  for (const screen of scannedScreens) {
    const validLinks = screen.navigationLinks.filter(link => allRouteSet.has(link));
    if (screen.navigationLinks.length > 0) {
      console.log(`  🔗 ${screen.routeName} → ${validLinks.join(', ')}${screen.navigationLinks.length !== validLinks.length ? ` (${screen.navigationLinks.length - validLinks.length} noise filtered)` : ''}`);
    }
    screenMap.screens[screen.routeName] = {
      title: screen.title || undefined,
      description: screen.description,
      navigatesTo: validLinks.length > 0 ? validLinks : undefined,
    };
  }

  const outputPath = path.join(projectRoot, 'ai-screen-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(screenMap, null, 2));

  const linkedCount = scannedScreens.filter(s => s.navigationLinks.some(l => allRouteSet.has(l))).length;
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

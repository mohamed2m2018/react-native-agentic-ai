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

      if (elementName === 'Switch') {
        const label = findSiblingTextLabel(astPath);
        elements.push(label ? `${label} (switch)` : 'toggle (switch)');
      }

      if (elementName === 'TextInput') {
        const placeholder = getStringAttribute(astPath.node, 'placeholder');
        elements.push(placeholder ? `${placeholder} (text-input)` : 'text input (text-input)');
      }

      if (elementName === 'Button') {
        const title = getStringAttribute(astPath.node, 'title');
        elements.push(title ? `${title} (button)` : 'button (button)');
        // React Navigation: <Button screen="Details" />
        const screenTarget = getStringAttribute(astPath.node, 'screen');
        if (screenTarget) navigationLinks.push(screenTarget);
      }

      if (['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'].includes(elementName)) {
        const buttonLabel = findChildTextContent(astPath);
        if (buttonLabel) {
          elements.push(`${buttonLabel} (button)`);
        }
      }

      // Expo Router: <Link href="..."> or <Redirect href="...">
      if (elementName === 'Link' || elementName === 'Redirect') {
        const target = extractRouteFromAttribute(astPath.node, 'href');
        if (target) navigationLinks.push(target);
        // React Navigation: <Link screen="Details" />
        const screenTarget = getStringAttribute(astPath.node, 'screen');
        if (screenTarget) navigationLinks.push(screenTarget);
      }
    },

    CallExpression(astPath) {
      const target = extractRouteFromCall(astPath.node);
      if (target) navigationLinks.push(target);
    },
  });

  return {
    elements: [...new Set(elements)],
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
    if (!['navigate', 'push', 'replace'].includes(method)) return null;
    const firstArg = node.arguments[0];
    return firstArg ? extractRouteFromExpression(firstArg) : null;
  }
  return null;
}

// Unified: extract route from any expression (StringLiteral, TemplateLiteral, ObjectExpression)
function extractRouteFromExpression(expr) {
  if (!expr) return null;
  if (t.isStringLiteral(expr)) return expr.value;
  if (t.isTemplateLiteral(expr) && expr.quasis.length > 0) {
    return expr.quasis.map(q => q.value.raw).join('[param]');
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
      if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
        return attr.value.expression.value;
      }
    }
  }
  return null;
}

function findSiblingTextLabel(switchPath) {
  const parent = switchPath.parentPath?.parentPath;
  if (!parent?.node || !t.isJSXElement(parent.node)) return null;
  for (const child of parent.node.children) {
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (childName === 'Text') return extractTextFromJSXElement(child);
    }
  }
  return null;
}

function findChildTextContent(pressablePath) {
  const jsxElement = pressablePath.parent;
  if (!t.isJSXElement(jsxElement)) return null;
  for (const child of jsxElement.children) {
    if (t.isJSXElement(child)) {
      const childName = getJSXElementName(child.openingElement.name);
      if (childName === 'Text') return extractTextFromJSXElement(child);
    }
  }
  return null;
}

function extractTextFromJSXElement(element) {
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
            if (t.isIdentifier(expr.object)) {
               componentName = expr.object.name;
            } else if (t.isIdentifier(expr.property)) {
               componentName = expr.property.name;
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
      for (const prop of firstArg.properties) {
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key) || prop.key.name !== 'screens') continue;
        if (!t.isObjectExpression(prop.value)) continue;
        for (const screenProp of prop.value.properties) {
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
            if (t.isIdentifier(screenProp.value.object)) {
              componentName = screenProp.value.object.name;
            } else if (t.isIdentifier(screenProp.value.property)) {
              componentName = screenProp.value.property.name;
            }
          }
          if (t.isObjectExpression(screenProp.value)) {
            for (const inner of screenProp.value.properties) {
              if (!t.isObjectProperty(inner) || !t.isIdentifier(inner.key)) continue;
              if (inner.key.name === 'screen' && t.isIdentifier(inner.value)) componentName = inner.value.name;
              if (inner.key.name === 'options') title = extractTitleFromOptions(inner.value) || undefined;
            }
          }
          if (componentName) {
            screens.push({ routeName: screenName, componentName, filePath: resolveComponentPath(componentName, imports, filePath), title });
          }
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
  const importPath = imports.get(componentName);
  if (!importPath) return currentFile;
  if (importPath.startsWith('.')) {
    const dir = path.dirname(currentFile);
    const resolved = path.resolve(dir, importPath);
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      if (fs.existsSync(resolved + ext)) return resolved + ext;
    }
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      const idx = path.join(resolved, `index${ext}`);
      if (fs.existsSync(idx)) return idx;
    }
    return resolved;
  }
  return currentFile;
}

// ─── Chain Analyzer ────────────────────────────────────────────

function buildNavigationGraph(screenLinks, knownRoutes) {
  const edges = new Map();
  const routes = knownRoutes || Object.keys(screenLinks);
  for (const [route, links] of Object.entries(screenLinks)) {
    if (!edges.has(route)) edges.set(route, new Set());
    for (const link of links) {
      const resolved = resolveLink(link, route, routes);
      if (resolved && resolved !== route) edges.get(route).add(resolved);
    }
  }
  return { edges };
}

// Resolve a raw nav link to a known route, handling dynamic segments
function resolveLink(link, fromRoute, knownRoutes) {
  let normalized = link;
  if (normalized.startsWith('http') || normalized.startsWith('mailto')) return null;
  // Handle relative routes
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    const fromDir = fromRoute.includes('/') ? fromRoute.substring(0, fromRoute.lastIndexOf('/')) : '';
    if (normalized.startsWith('./')) {
      normalized = fromDir ? `${fromDir}/${normalized.slice(2)}` : normalized.slice(2);
    } else {
      const parentDir = fromDir.includes('/') ? fromDir.substring(0, fromDir.lastIndexOf('/')) : '';
      normalized = parentDir ? `${parentDir}/${normalized.slice(3)}` : normalized.slice(3);
    }
  }
  normalized = normalized.replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;
  // Exact match
  if (knownRoutes.includes(normalized)) return normalized;
  // Fuzzy match for dynamic segments: [param] matches [id], concrete values match [id]
  const linkSegs = normalized.split('/');
  for (const route of knownRoutes) {
    const routeSegs = route.split('/');
    if (routeSegs.length !== linkSegs.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegs.length; i++) {
      if (routeSegs[i] === linkSegs[i]) continue;
      if (routeSegs[i].startsWith('[') && routeSegs[i].endsWith(']')) continue;
      if (linkSegs[i].startsWith('[') && linkSegs[i].endsWith(']') && routeSegs[i].startsWith('[') && routeSegs[i].endsWith(']')) continue;
      ok = false; break;
    }
    if (ok) return route;
  }
  return null;
}

function extractChains(graph, allRoutes) {
  const hasIncoming = new Set();
  for (const targets of graph.edges.values()) {
    for (const target of targets) hasIncoming.add(target);
  }
  const roots = allRoutes.filter(r => !hasIncoming.has(r) && graph.edges.has(r));
  const chains = [];

  function dfs(current, currentPath, visited) {
    const neighbors = graph.edges.get(current);
    if (!neighbors || neighbors.size === 0) {
      if (currentPath.length > 1) chains.push([...currentPath]);
      return;
    }
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        currentPath.push(next);
        dfs(next, currentPath, visited);
        currentPath.pop();
        visited.delete(next);
      }
    }
  }

  for (const root of roots) dfs(root, [root], new Set([root]));

  // Deduplicate — keep longest chains
  chains.sort((a, b) => b.length - a.length);
  const result = [];
  for (const chain of chains) {
    const key = chain.join(' → ');
    const isSubset = result.some(kept => kept.join(' → ').includes(key));
    if (!isSubset) result.push(chain);
  }
  return result;
}

// ─── AI Extractor ──────────────────────────────────────────────

async function extractContentWithAI(sourceCode, routeName, config) {
  const prompt = `You are analyzing a React Native screen component.
Summarize this screen in ONE concise sentence.
Include: the screen's purpose, all interactive elements (buttons, toggles, inputs), and key content sections.
Route name: "${routeName}"
Source code:
\`\`\`tsx
${sourceCode}
\`\`\`
Respond with ONLY the one-sentence description, nothing else.`;

  if (config.provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 150 } }) }
    );
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Screen content';
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 150 })
    });
    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Screen content';
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
  const args = { ai: false, provider: 'gemini', key: '', dir: '', watch: false };
  for (const arg of argv) {
    if (arg === '--ai') args.ai = true;
    if (arg === '--watch' || arg === '-w') args.watch = true;
    if (arg.startsWith('--provider=')) args.provider = arg.split('=')[1];
    if (arg.startsWith('--key=')) args.key = arg.split('=')[1];
    if (arg.startsWith('--dir=')) args.dir = arg.split('=')[1];
  }
  if (args.ai && !args.key) { console.error('❌ --ai requires --key=YOUR_API_KEY'); process.exit(1); }
  return args;
}

async function generate(args, projectRoot) {
  const framework = detectFramework(projectRoot);
  console.log(`📱 Framework: ${framework}`);

  const scannedScreens = framework === 'expo-router'
    ? scanExpoRouterApp(projectRoot)
    : scanReactNavigationApp(projectRoot);

  console.log(`📄 Found ${scannedScreens.length} screen(s)`);

  if (args.ai && args.key) {
    console.log(`🤖 Enhancing descriptions with AI (${args.provider})...`);
    for (const screen of scannedScreens) {
      try {
        const sourceCode = fs.readFileSync(screen.filePath, 'utf-8');
        screen.description = await extractContentWithAI(sourceCode, screen.routeName, { provider: args.provider, apiKey: args.key });
        console.log(`  ✓ ${screen.routeName}`);
      } catch (err) {
        console.warn(`  ✗ ${screen.routeName}: ${err.message}`);
      }
    }
  }

  // Build navigation chains
  const screenLinks = {};
  for (const screen of scannedScreens) {
    screenLinks[screen.routeName] = screen.navigationLinks;
    if (screen.navigationLinks.length > 0) {
      console.log(`  🔗 ${screen.routeName} → ${screen.navigationLinks.join(', ')}`);
    }
  }
  const allRoutes = scannedScreens.map(s => s.routeName);
  const graph = buildNavigationGraph(screenLinks, allRoutes);
  const chains = extractChains(graph, allRoutes);

  // Build output
  const screenMap = { generatedAt: new Date().toISOString(), framework, screens: {}, chains };
  for (const screen of scannedScreens) {
    screenMap.screens[screen.routeName] = { title: screen.title, description: screen.description };
  }

  const outputPath = path.join(projectRoot, 'ai-screen-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(screenMap, null, 2));

  console.log('━'.repeat(40));
  console.log(`✅ Generated ${outputPath}`);
  console.log(`   ${Object.keys(screenMap.screens).length} screens, ${chains.length} navigation chain(s)`);

  if (chains.length > 0) {
    console.log('\n📍 Navigation chains:');
    for (const chain of chains) console.log(`   ${chain.join(' → ')}`);
  }

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

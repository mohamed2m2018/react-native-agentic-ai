/**
 * React Navigation scanner.
 * Discovers screens by parsing navigation config files.
 * Supports v5/v6 (dynamic JSX) and v7 (static object) patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import * as _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (_traverse as any).default || _traverse;
import { extractContentFromAST, buildDescription } from '../extractors/ast-extractor';

export interface ScannedScreen {
  routeName: string;
  filePath: string;
  title?: string;
  description: string;
  navigationLinks: string[];
}

const NAVIGATOR_FUNCTIONS = [
  'createStackNavigator',
  'createNativeStackNavigator',
  'createBottomTabNavigator',
  'createDrawerNavigator',
  'createMaterialBottomTabNavigator',
  'createMaterialTopTabNavigator',
];

/**
 * Scan a React Navigation project and return all screens.
 */
export function scanReactNavigationApp(projectRoot: string): ScannedScreen[] {
  console.log(`[generate-map] Scanning React Navigation project: ${projectRoot}`);

  // Find all JS/TS files that contain navigator creation
  const navigatorFiles = findNavigatorFiles(projectRoot);

  if (navigatorFiles.length === 0) {
    throw new Error(
      'Could not find any React Navigation navigator definitions. ' +
      'Searched for createStackNavigator, createNativeStackNavigator, etc.'
    );
  }

  console.log(`[generate-map] Found ${navigatorFiles.length} navigator file(s)`);

  const screens: ScannedScreen[] = [];
  const processedRoutes = new Set<string>();
  const fileAstCache = new Map<string, any>();

  for (const navFile of navigatorFiles) {
    const sourceCode = fs.readFileSync(navFile, 'utf-8');
    const screenDefs = extractScreenDefinitions(sourceCode, navFile, projectRoot);

    for (const screenDef of screenDefs) {
      if (processedRoutes.has(screenDef.routeName)) continue;
      processedRoutes.add(screenDef.routeName);

      // Read and extract content from the screen component file
      if (fs.existsSync(screenDef.filePath)) {
        let extracted: any;
        if (fileAstCache.has(screenDef.filePath)) {
          extracted = fileAstCache.get(screenDef.filePath);
        } else {
          const screenSource = fs.readFileSync(screenDef.filePath, 'utf-8');
          extracted = extractContentFromAST(screenSource, screenDef.filePath);
          fileAstCache.set(screenDef.filePath, extracted);
        }

        screens.push({
          routeName: screenDef.routeName,
          filePath: screenDef.filePath,
          title: screenDef.title,
          description: buildDescription(extracted),
          navigationLinks: extracted.navigationLinks,
        });
      } else {
        // Component defined in same file or import not resolved
        screens.push({
          routeName: screenDef.routeName,
          filePath: screenDef.filePath,
          title: screenDef.title,
          description: 'Screen content',
          navigationLinks: [],
        });
      }
    }
  }

  return screens;
}

interface ScreenDefinition {
  routeName: string;
  componentName: string;
  filePath: string;
  title?: string;
}

/**
 * Find all files containing navigator creation functions.
 */
function findNavigatorFiles(projectRoot: string): string[] {
  const result: string[] = [];
  const srcDir = path.join(projectRoot, 'src');
  const searchDirs = [
    fs.existsSync(srcDir) ? srcDir : projectRoot,
  ];

  for (const dir of searchDirs) {
    walkAndSearch(dir, result, projectRoot);
  }

  return result;
}

function walkAndSearch(dir: string, result: string[], projectRoot: string) {
  // Skip common non-source directories
  const skipDirs = ['node_modules', '.git', 'lib', 'build', 'dist', '__tests__', '__mocks__', 'android', 'ios'];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name) || entry.name.startsWith('.')) continue;
      walkAndSearch(fullPath, result, projectRoot);
      continue;
    }

    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;

    // Quick text search before expensive parsing
    const content = fs.readFileSync(fullPath, 'utf-8');
    const hasNavigator = NAVIGATOR_FUNCTIONS.some(fn => content.includes(fn));
    if (hasNavigator) {
      result.push(fullPath);
    }
  }
}

/**
 * Extract screen definitions from a navigator file.
 * Handles both static (v7) and dynamic (v5/v6/v7) patterns.
 */
function extractScreenDefinitions(
  sourceCode: string,
  filePath: string,
  projectRoot: string
): ScreenDefinition[] {
  const screens: ScreenDefinition[] = [];
  const imports = new Map<string, string>(); // componentName → import path

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    console.warn(`[generate-map] Failed to parse ${filePath}`);
    return screens;
  }

  // First pass: collect all imports
  traverse(ast, {
    ImportDeclaration(nodePath: any) {
      const source = nodePath.node.source.value;
      for (const specifier of nodePath.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier) || t.isImportSpecifier(specifier)) {
          imports.set(specifier.local.name, source);
        }
      }
    },
  });

  // Second pass: find screen definitions
  traverse(ast, {
    // Dynamic config: <Stack.Screen name="Home" component={HomeScreen} />
    JSXOpeningElement(nodePath: any) {
      const nameNode = nodePath.node.name;
      if (!t.isJSXMemberExpression(nameNode)) return;
      if (!t.isJSXIdentifier(nameNode.property) || nameNode.property.name !== 'Screen') return;

      let screenName: string | null = null;
      let componentName: string | null = null;
      let title: string | null = null;

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

      console.log(`[DEBUG-AST-Raw] Checked Screen. screenName: ${screenName}, componentName: ${componentName}`);

      if (screenName && componentName) {
        console.log(`[DEBUG-AST] Found Dynamic Screen: ${screenName} -> component: ${componentName}`);
        screens.push({
          routeName: screenName,
          componentName,
          filePath: resolveComponentPath(componentName, imports, filePath, projectRoot),
          title: title || undefined,
        });
      }
    },

    // Static config (v7): createNativeStackNavigator({ screens: { Home: HomeScreen } })
    CallExpression(nodePath: any) {
      const callee = nodePath.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (!NAVIGATOR_FUNCTIONS.includes(callee.name)) return;

      const firstArg = nodePath.node.arguments[0];
      if (!t.isObjectExpression(firstArg)) return;

      // Find the 'screens' property
      for (const prop of firstArg.properties) {
        if (!t.isObjectProperty(prop)) continue;
        if (!t.isIdentifier(prop.key) || prop.key.name !== 'screens') continue;
        if (!t.isObjectExpression(prop.value)) continue;

        for (const screenProp of prop.value.properties) {
          if (!t.isObjectProperty(screenProp)) continue;

          let screenName: string | null = null;

          if (!screenProp.computed) {
            if (t.isIdentifier(screenProp.key)) screenName = screenProp.key.name;
            else if (t.isStringLiteral(screenProp.key)) screenName = screenProp.key.value;
          } else {
            // Calculated key: [StackNav.Home]: HomeScreen
            if (t.isIdentifier(screenProp.key)) screenName = screenProp.key.name;
            else if (t.isMemberExpression(screenProp.key) && t.isIdentifier(screenProp.key.property)) {
              screenName = screenProp.key.property.name;
            }
          }

          if (!screenName) continue;

          let componentName: string | null = null;
          let title: string | undefined;

          // Simple: Home: HomeScreen (or StackRoute.HomeScreen)
          if (t.isIdentifier(screenProp.value)) {
            componentName = screenProp.value.name;
          } else if (t.isMemberExpression(screenProp.value)) {
            if (t.isIdentifier(screenProp.value.object) && t.isIdentifier(screenProp.value.property)) {
              componentName = `${screenProp.value.object.name}.${screenProp.value.property.name}`;
            }
          }

          // Object: Home: { screen: HomeScreen, options: { title: 'Home' } }
          if (t.isObjectExpression(screenProp.value)) {
            for (const inner of screenProp.value.properties) {
              if (!t.isObjectProperty(inner) || !t.isIdentifier(inner.key)) continue;

              if (inner.key.name === 'screen' && t.isIdentifier(inner.value)) {
                componentName = inner.value.name;
              }
              if (inner.key.name === 'options') {
                title = extractTitleFromOptions(inner.value) || undefined;
              }
            }
          }

          if (componentName) {
            screens.push({
              routeName: screenName,
              componentName,
              filePath: resolveComponentPath(componentName, imports, filePath, projectRoot),
              title,
            });
          }
        }
      }
    },
  });

  return screens;
}

function extractTitleFromOptions(optionsNode: any): string | null {
  if (!t.isObjectExpression(optionsNode)) return null;

  for (const prop of optionsNode.properties) {
    if (
      t.isObjectProperty(prop) &&
      t.isIdentifier(prop.key) &&
      prop.key.name === 'title' &&
      t.isStringLiteral(prop.value)
    ) {
      return prop.value.value;
    }
  }
  return null;
}

/**
 * Resolve a component name to its source file path via imports.
 * Also handles dot-notation intermediate tracing (e.g., StackRoute.Login)
 */
function resolveComponentPath(
  componentName: string,
  imports: Map<string, string>,
  currentFile: string,
  _projectRoot: string
): string {
  const parts = componentName.split('.');
  const baseComponent: string | undefined = parts[0];
  const property: string | undefined = parts[1];

  if (!baseComponent) return currentFile;

  const importPath = imports.get(baseComponent);
  if (!importPath) return currentFile;

  let resolvedBase = currentFile;
  if (importPath.startsWith('.')) {
    const dir = path.dirname(currentFile);
    const resolved = path.resolve(dir, importPath);

    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    let found = false;
    for (const ext of extensions) {
      if (fs.existsSync(resolved + ext)) {
        resolvedBase = resolved + ext;
        found = true;
        break;
      }
    }
    if (!found) {
      for (const ext of extensions) {
        const indexPath = path.join(resolved, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          resolvedBase = indexPath;
          found = true;
          break;
        }
      }
    }
    if (!found) resolvedBase = resolved;
  }

  if (!property || resolvedBase === currentFile) return resolvedBase;

  return traceExportProperty(resolvedBase, baseComponent, property) || resolvedBase;
}

/**
 * Traces an exported object property through an intermediate file to its deep source file.
 */
function traceExportProperty(filePath: string, objectName: string, propertyName: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch { return null; }

  const innerImports = new Map<string, string>();
  let targetIdentifier: string | null = null;

  traverse(ast, {
    ImportDeclaration(nodePath: any) {
      const source = nodePath.node.source.value;
      for (const specifier of nodePath.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier) || t.isImportSpecifier(specifier)) {
          innerImports.set(specifier.local.name, source);
        }
      }
    },
    VariableDeclarator(nodePath: any) {
      if (t.isIdentifier(nodePath.node.id) && nodePath.node.id.name === objectName) {
        if (t.isObjectExpression(nodePath.node.init)) {
          for (const prop of nodePath.node.init.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              const keyName = prop.key.name;
              if (keyName === propertyName) {
                if (t.isIdentifier(prop.value)) {
                  targetIdentifier = prop.value.name;
                }
              }
            }
          }
        }
      }
    }
  });

  if (!targetIdentifier) return null;

  const importPath = innerImports.get(targetIdentifier);
  if (!importPath || !importPath.startsWith('.')) return null;

  const dir = path.dirname(filePath);
  const resolved = path.resolve(dir, importPath);
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  for (const ext of extensions) {
    const indexPath = path.join(resolved, `index${ext}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }
  return resolved;
}

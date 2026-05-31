/**
 * Expo Router scanner.
 * Discovers screens by walking the app/ or src/app/ directory.
 * Maps file paths to route names following Expo Router conventions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractContentFromAST, buildDescription } from '../extractors/ast-extractor';
import { parse } from '@babel/parser';
import * as _traverse from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (_traverse as any).default || _traverse;

export interface ScannedScreen {
  routeName: string;
  filePath: string;
  title?: string;
  description: string;
  navigationLinks: string[];
}

/**
 * Scan an Expo Router app directory and return all screens.
 */
export function scanExpoRouterApp(projectRoot: string): ScannedScreen[] {
  // Find app directory: src/app/ first, then app/
  const appDir = findAppDir(projectRoot);
  if (!appDir) {
    throw new Error('Could not find app/ or src/app/ directory. Is this an Expo Router project?');
  }

  console.log(`[generate-map] Scanning Expo Router app: ${appDir}`);

  const screens: ScannedScreen[] = [];
  const layoutTitles = new Map<string, string>(); // routeName → title from _layout.tsx

  // First pass: extract titles from _layout.tsx files
  extractLayoutTitles(appDir, appDir, layoutTitles);

  // Second pass: scan screen files
  scanDirectory(appDir, appDir, screens, layoutTitles);

  return screens;
}

function findAppDir(projectRoot: string): string | null {
  const srcApp = path.join(projectRoot, 'src', 'app');
  if (fs.existsSync(srcApp)) return srcApp;

  const app = path.join(projectRoot, 'app');
  if (fs.existsSync(app)) return app;

  return null;
}

function scanDirectory(
  dir: string,
  appRoot: string,
  screens: ScannedScreen[],
  layoutTitles: Map<string, string>
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      scanDirectory(fullPath, appRoot, screens, layoutTitles);
      continue;
    }

    // Only process .tsx and .ts files (not .js — Expo Router uses TS by default)
    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;

    // Skip layout files, special files, and API routes
    if (entry.name === '_layout.tsx' || entry.name === '_layout.ts') continue;
    if (entry.name.startsWith('+')) continue; // +not-found, +html, +api, etc.
    if (entry.name.startsWith('_')) continue; // Other special files

    const routeName = filePathToRouteName(fullPath, appRoot);
    const sourceCode = fs.readFileSync(fullPath, 'utf-8');
    const extracted = extractContentFromAST(sourceCode, fullPath);
    const title = layoutTitles.get(routeName);

    screens.push({
      routeName,
      filePath: fullPath,
      title,
      description: buildDescription(extracted),
      navigationLinks: extracted.navigationLinks,
    });
  }
}

/**
 * Convert a file path to an Expo Router route name.
 * Examples:
 *   app/categories.tsx → categories
 *   app/item-reviews/[id].tsx → item-reviews/[id]
 *   app/(tabs)/index.tsx → (tabs)/index
 *   app/product/[id].tsx → product/[id]
 */
function filePathToRouteName(filePath: string, appRoot: string): string {
  let relative = path.relative(appRoot, filePath);

  // Remove extension
  relative = relative.replace(/\.(tsx?|jsx?)$/, '');

  // Normalize path separators (Windows compat)
  relative = relative.split(path.sep).join('/');

  return relative;
}

/**
 * Parse _layout.tsx files to extract screen titles from Stack.Screen options.
 */
function extractLayoutTitles(
  dir: string,
  appRoot: string,
  titles: Map<string, string>
) {
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

/**
 * Extract screen names and titles from a layout file's JSX.
 * Looks for patterns like: <Stack.Screen name="categories" options={{ title: 'Categories' }} />
 */
function extractTitlesFromLayout(sourceCode: string, routePrefix: string, titles: Map<string, string>) {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    return;
  }

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const nameNode = path.node.name;
      // Match *.Screen
      if (!t.isJSXMemberExpression(nameNode)) return;
      if (!t.isJSXIdentifier(nameNode.property) || nameNode.property.name !== 'Screen') return;

      // Get name prop
      let screenName: string | null = null;
      let screenTitle: string | null = null;

      for (const attr of path.node.attributes) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;

        if (attr.name.name === 'name' && t.isStringLiteral(attr.value)) {
          screenName = attr.value.value;
        }

        if (attr.name.name === 'options' && t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (t.isObjectExpression(expr)) {
            for (const prop of expr.properties) {
              if (
                t.isObjectProperty(prop) &&
                t.isIdentifier(prop.key) &&
                prop.key.name === 'title' &&
                t.isStringLiteral(prop.value)
              ) {
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

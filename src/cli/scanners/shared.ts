import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';

export interface ScannedScreenCandidate {
  filePath: string;
  description: string;
  navigationLinks: string[];
  title?: string;
}

interface ImportBinding {
  source: string;
  importedName: string;
}

interface ExportLink {
  exportedName: string;
  source?: string;
  importedName?: string;
  localName?: string;
}

interface ModuleProxyInfo {
  imports: Map<string, ImportBinding>;
  exportLinks: ExportLink[];
  localBindings: Set<string>;
  defaultExportLocal?: string;
  hasLocalDefaultExport: boolean;
}

interface TsConfigPathAlias {
  keyPrefix: string;
  keySuffix: string;
  targetPrefix: string;
  targetSuffix: string;
}

interface TsConfigResolution {
  aliases: TsConfigPathAlias[];
  baseUrl?: string;
}

const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const DEFAULT_PROXY_HOPS = 10;
const moduleProxyInfoCache = new Map<string, ModuleProxyInfo | null>();
const tsConfigResolutionCache = new Map<string, TsConfigResolution>();

export function scoreScreenCandidate(screen: ScannedScreenCandidate): number {
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

export function resolveComponentPath(
  componentName: string,
  imports: Map<string, string>,
  currentFile: string,
  projectRoot: string
): string {
  const parts = componentName.split('.');
  const baseComponent = parts[0];
  const property = parts[1];

  if (!baseComponent) return currentFile;

  const importPath = imports.get(baseComponent);
  if (!importPath) return currentFile;

  const resolvedBase = resolveImportSpecifier(importPath, currentFile, projectRoot);
  if (!resolvedBase) return currentFile;

  if (!property || resolvedBase === currentFile) return resolvedBase;

  return traceExportProperty(resolvedBase, property, projectRoot) || resolvedBase;
}

export function resolveProxyScreenFile(
  entryFile: string,
  projectRoot: string,
  maxHops: number = DEFAULT_PROXY_HOPS
): string {
  let currentFile = path.resolve(entryFile);
  let exportName = 'default';
  const visited = new Set<string>();

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

function resolveExportTarget(
  filePath: string,
  exportName: string,
  projectRoot: string
): { filePath: string; exportName: string } | null {
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

function traceExportProperty(
  filePath: string,
  propertyName: string,
  projectRoot: string
): string | null {
  if (!fs.existsSync(filePath)) return null;

  const sourceCode = fs.readFileSync(filePath, 'utf-8');
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(sourceCode, { sourceType: 'module', plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch {
    return null;
  }

  const imports = new Map<string, string>();
  let importName: string | null = null;

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

    if (
      t.isVariableDeclaration(node) &&
      node.declarations.length > 0
    ) {
      for (const declaration of node.declarations) {
        if (
          t.isIdentifier(declaration.id) &&
          t.isObjectExpression(declaration.init)
        ) {
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

function resolveImportSpecifier(
  importPath: string,
  currentFile: string,
  projectRoot: string
): string | null {
  const direct = resolveImportCandidate(importPath, currentFile, projectRoot);
  return direct ? path.resolve(direct) : null;
}

function resolveImportCandidate(
  importPath: string,
  currentFile: string,
  projectRoot: string
): string | null {
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

function resolveFilePath(baseDir: string, rawPath: string): string | null {
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

function getTsConfigResolution(projectRoot: string): TsConfigResolution {
  const cached = tsConfigResolutionCache.get(projectRoot);
  if (cached) return cached;

  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const resolution: TsConfigResolution = { aliases: [] };

  try {
    if (fs.existsSync(tsConfigPath)) {
      const raw = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      const compilerOptions = raw?.compilerOptions ?? {};
      const baseUrl = typeof compilerOptions.baseUrl === 'string'
        ? path.resolve(projectRoot, compilerOptions.baseUrl)
        : undefined;
      const aliases = normalizePathAliases(compilerOptions.paths ?? {});

      resolution.baseUrl = baseUrl;
      resolution.aliases = aliases;
    }
  } catch {
    // Ignore malformed tsconfig and fall back to conventional resolution.
  }

  tsConfigResolutionCache.set(projectRoot, resolution);
  return resolution;
}

function normalizePathAliases(pathsConfig: Record<string, string[]>): TsConfigPathAlias[] {
  const aliases: TsConfigPathAlias[] = [];

  for (const [key, values] of Object.entries(pathsConfig)) {
    const target = values[0];
    if (!target) continue;

    const [keyPrefix, keySuffix] = splitAliasPattern(key);
    const [targetPrefix, targetSuffix] = splitAliasPattern(target);
    aliases.push({ keyPrefix, keySuffix, targetPrefix, targetSuffix });
  }

  return aliases;
}

function splitAliasPattern(pattern: string): [string, string] {
  const starIndex = pattern.indexOf('*');
  if (starIndex === -1) return [pattern, ''];
  return [pattern.slice(0, starIndex), pattern.slice(starIndex + 1)];
}

function matchAlias(value: string, prefix: string, suffix: string): string | null {
  if (!value.startsWith(prefix)) return null;
  if (suffix && !value.endsWith(suffix)) return null;
  return value.slice(prefix.length, suffix ? value.length - suffix.length : undefined);
}

function getModuleProxyInfo(filePath: string): ModuleProxyInfo | null {
  const cached = moduleProxyInfoCache.get(filePath);
  if (cached !== undefined) return cached;

  if (!fs.existsSync(filePath)) {
    moduleProxyInfoCache.set(filePath, null);
    return null;
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(fs.readFileSync(filePath, 'utf-8'), {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch {
    moduleProxyInfoCache.set(filePath, null);
    return null;
  }

  const info: ModuleProxyInfo = {
    imports: new Map(),
    exportLinks: [],
    localBindings: new Set(),
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
          source: node.source?.value,
          importedName: node.source ? getModuleExportedName(specifier.local) : undefined,
          localName: node.source ? undefined : getModuleExportedName(specifier.local),
        });
      }
    }
  }

  moduleProxyInfoCache.set(filePath, info);
  return info;
}

function getModuleExportedName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value;
}

function collectLocalBindingNames(node: t.Node, bindings: Set<string>): void {
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

function collectBindingNamesFromPattern(pattern: t.LVal, bindings: Set<string>): void {
  if (t.isIdentifier(pattern)) {
    bindings.add(pattern.name);
    return;
  }

  if (t.isObjectPattern(pattern)) {
    for (const property of pattern.properties) {
      if (t.isRestElement(property)) {
        collectBindingNamesFromPattern(property.argument, bindings);
      } else if (t.isObjectProperty(property)) {
        collectBindingNamesFromPattern(property.value as t.LVal, bindings);
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

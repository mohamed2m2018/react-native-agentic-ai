const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root so Metro can resolve the library source
config.watchFolders = [monorepoRoot];

// 2. Ensure Metro resolves shared dependencies from the monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Prevent duplicate React / React Native from workspace hoisting
//    Also: resolve the library from src/ directly so bob-build race doesn't break Metro
const pkg = require('../package.json');
config.resolver.extraNodeModules = {
  [pkg.name]: path.resolve(monorepoRoot, 'src'),
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
};

// 4. Resolve the library's package name imports to src/ for development
//    This bypasses the "exports" field in package.json that points to lib/module/
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === pkg.name || moduleName.startsWith(pkg.name + '/')) {
    const subPath = moduleName.replace(pkg.name, '');
    const srcPath = path.resolve(monorepoRoot, 'src', subPath || 'index');
    return context.resolveRequest(context, srcPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 5. Block the library's own node_modules copies of shared deps
const { makeMetroConfig } = (() => {
  try {
    return require('react-native-monorepo-config');
  } catch {
    return { makeMetroConfig: null };
  }
})();

module.exports = config;

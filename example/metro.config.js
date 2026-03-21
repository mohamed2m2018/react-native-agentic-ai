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
const pkg = require('../package.json');
config.resolver.extraNodeModules = {
  [pkg.name]: path.resolve(monorepoRoot),
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
};

// 4. Block the library's own node_modules copies of shared deps
const { makeMetroConfig } = (() => {
  try {
    return require('react-native-monorepo-config');
  } catch {
    return { makeMetroConfig: null };
  }
})();

module.exports = config;

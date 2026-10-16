const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const pkg = require('../package.json');

const config = getDefaultConfig(projectRoot);

// Watch the parent library source so Metro picks up changes
config.watchFolders = [monorepoRoot];

// Ensure the example's node_modules are resolved first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent duplicates: force react, react-native, etc. to resolve
// from THIS project's node_modules (not the parent library's).
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-reanimated': path.resolve(projectRoot, 'node_modules/react-native-reanimated'),
  [pkg.name]: monorepoRoot,
};

// Resolve @mobileai/react-native directly from src/ — no rebuild needed on change
const SDK_NAMES = [pkg.name, '@mobileai/react-native'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const matched = SDK_NAMES.find(n => moduleName === n || moduleName.startsWith(n + '/'));
  if (matched) {
    const subPath = moduleName.replace(matched, '');
    const srcPath = path.resolve(monorepoRoot, 'src', subPath || 'index');
    return context.resolveRequest(context, srcPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Block the parent's node_modules versions of react/react-native
// from being resolved via watchFolders
config.resolver.blockList = [
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react/.*').replace(/[/\\\\]/g, '[/\\\\\\\\]')),
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react-native/.*').replace(/[/\\\\]/g, '[/\\\\\\\\]')),
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react-native-reanimated/.*').replace(/[/\\\\]/g, '[/\\\\\\\\]')),
];

module.exports = config;


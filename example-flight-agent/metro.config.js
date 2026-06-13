const { execSync } = require('child_process');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

try {
  execSync(`node "${path.resolve(monorepoRoot, 'bin/generate-map.cjs')}" --dir="${projectRoot}"`, {
    stdio: 'inherit',
  });
} catch (error) {
  console.warn('[SkyForge] Screen map auto-generation failed:', error.message);
}

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-reanimated': path.resolve(projectRoot, 'node_modules/react-native-reanimated'),
  'react-native-agentic-ai': monorepoRoot,
};

const SDK_NAMES = ['react-native-agentic-ai', '@mobileai/react-native'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const matched = SDK_NAMES.find((name) => moduleName === name || moduleName.startsWith(name + '/'));
  if (matched) {
    const subPath = moduleName.replace(matched, '');
    const srcPath = path.resolve(monorepoRoot, 'src', subPath || 'index');
    return context.resolveRequest(context, srcPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react/.*').replace(/[/\\]/g, '[/\\\\]')),
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react-native/.*').replace(/[/\\]/g, '[/\\\\]')),
  new RegExp(path.resolve(monorepoRoot, 'node_modules/react-native-reanimated/.*').replace(/[/\\]/g, '[/\\\\]')),
];

module.exports = config;

#!/usr/bin/env node

/**
 * Screen Map Generator CLI
 *
 * Scans React Native screen files and generates a JSON map
 * that the AI agent uses for intelligent navigation.
 *
 * Pure AST — no LLM calls, no API key needed. Runs in ~2 seconds.
 *
 * Usage:
 *   npx react-native-ai-agent generate-map
 *   npx react-native-ai-agent generate-map --watch
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildNavigationGraph, extractChains } from './analyzers/chain-analyzer';
import { scanExpoRouterApp } from './scanners/expo-scanner';
import { scanReactNavigationApp } from './scanners/rn-scanner';

interface ScreenMapEntry {
  title?: string;
  description: string;
  navigatesTo?: string[];
}

interface ScreenMap {
  generatedAt: string;
  framework: 'expo-router' | 'react-navigation';
  screens: Record<string, ScreenMapEntry>;
  chains?: string[][];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args.dir || process.cwd();

  console.log('🗺️  Screen Map Generator');
  console.log('━'.repeat(40));

  // Detect framework
  const framework = detectFramework(projectRoot);
  console.log(`📱 Framework: ${framework}`);

  // Scan screens
  const scannedScreens = framework === 'expo-router'
    ? scanExpoRouterApp(projectRoot)
    : scanReactNavigationApp(projectRoot);

  console.log(`📄 Found ${scannedScreens.length} screen(s)`);

  // Build output — per-screen navigatesTo, filtered to known routes only
  const allRouteSet = new Set(scannedScreens.map(s => s.routeName));
  const screenMap: ScreenMap = {
    generatedAt: new Date().toISOString(),
    framework,
    screens: {},
  };

  const screenLinks = Object.fromEntries(
    scannedScreens.map(screen => [screen.routeName, screen.navigationLinks])
  );
  const navigationGraph = buildNavigationGraph(screenLinks, [...allRouteSet]);

  for (const screen of scannedScreens) {
    const validLinks = [...(navigationGraph.edges.get(screen.routeName) ?? new Set<string>())];
    if (screen.navigationLinks.length > 0) {
      const noise = screen.navigationLinks.length - validLinks.length;
      console.log(`  🔗 ${screen.routeName} → ${validLinks.join(', ')}${noise > 0 ? ` (${noise} noise filtered)` : ''}`);
    }
    screenMap.screens[screen.routeName] = {
      title: screen.title || undefined,
      description: screen.description,
      navigatesTo: validLinks.length > 0 ? validLinks : undefined,
    };
  }
  const chains = extractChains(navigationGraph, [...allRouteSet]);
  if (chains.length > 0) {
    screenMap.chains = chains;
  }

  // Write output
  const outputPath = path.join(projectRoot, 'ai-screen-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(screenMap, null, 2));

  const linkedCount = Object.values(screenMap.screens).filter(screen => (screen.navigatesTo?.length || 0) > 0).length;
  console.log('━'.repeat(40));
  console.log(`✅ Generated ${outputPath}`);
  console.log(`   ${Object.keys(screenMap.screens).length} screens, ${linkedCount} with navigation links`);

  console.log('\n💡 Import in your app:');
  console.log('   import screenMap from \'./ai-screen-map.json\';');
  console.log('   <AIAgent screenMap={screenMap} />');
}

function detectFramework(projectRoot: string): 'expo-router' | 'react-navigation' {
  const srcApp = path.join(projectRoot, 'src', 'app');
  const appDir = path.join(projectRoot, 'app');

  if (fs.existsSync(srcApp) || fs.existsSync(appDir)) {
    const layoutInSrc = path.join(srcApp, '_layout.tsx');
    const layoutInApp = path.join(appDir, '_layout.tsx');
    if (fs.existsSync(layoutInSrc) || fs.existsSync(layoutInApp)) {
      return 'expo-router';
    }
  }

  return 'react-navigation';
}

interface CLIArgs {
  dir: string;
  watch: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    dir: '',
    watch: false,
  };

  for (const arg of argv) {
    if (arg === '--watch' || arg === '-w') args.watch = true;
    if (arg.startsWith('--dir=')) args.dir = arg.split('=')[1]!;
  }

  return args;
}

// Run
main();

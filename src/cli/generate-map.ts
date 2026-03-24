#!/usr/bin/env node

/**
 * Screen Map Generator CLI
 *
 * Scans React Native screen files and generates a JSON map
 * that the AI agent uses for intelligent navigation.
 *
 * Usage:
 *   npx react-native-ai-agent generate-map
 *   npx react-native-ai-agent generate-map --ai --provider=gemini --key=YOUR_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanExpoRouterApp } from './scanners/expo-scanner';
import { scanReactNavigationApp } from './scanners/rn-scanner';
import { extractFullContentWithAI } from './extractors/ai-extractor';
import type { AIExtractorConfig } from './extractors/ai-extractor';
import { buildNavigationGraph, extractChains } from './analyzers/chain-analyzer';

interface ScreenMapEntry {
  title?: string;
  description: string;
}

interface ScreenMap {
  generatedAt: string;
  framework: 'expo-router' | 'react-navigation';
  screens: Record<string, ScreenMapEntry>;
  chains: string[][];
}

async function main() {
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

  // If AI mode, enhance descriptions with LLM
  if (args.ai && args.key) {
    console.log(`🤖 Enhancing descriptions with AI (${args.provider})...`);
    const aiConfig: AIExtractorConfig = {
      provider: args.provider as 'gemini' | 'openai',
      apiKey: args.key,
    };

    for (const screen of scannedScreens) {
      try {
        const sourceCode = fs.readFileSync(screen.filePath, 'utf-8');
        const aiResult = await extractFullContentWithAI(sourceCode, screen.routeName, aiConfig);
        screen.description = aiResult.description;
        // Merge AI-extracted nav links with AST-extracted ones
        if (aiResult.navigationLinks.length > 0) {
          const merged = new Set([...screen.navigationLinks, ...aiResult.navigationLinks]);
          screen.navigationLinks = [...merged];
        }
        console.log(`  ✓ ${screen.routeName}`);
      } catch (err: any) {
        console.warn(`  ✗ ${screen.routeName}: ${err.message}`);
        // Keep AST description as fallback
      }
    }
  }

  // Build navigation chains
  const screenLinks: Record<string, string[]> = {};
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
  const screenMap: ScreenMap = {
    generatedAt: new Date().toISOString(),
    framework,
    screens: {},
    chains,
  };

  for (const screen of scannedScreens) {
    screenMap.screens[screen.routeName] = {
      title: screen.title,
      description: screen.description,
    };
  }

  // Write output
  const outputPath = path.join(projectRoot, 'ai-screen-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(screenMap, null, 2));

  console.log('━'.repeat(40));
  console.log(`✅ Generated ${outputPath}`);
  console.log(`   ${Object.keys(screenMap.screens).length} screens, ${chains.length} navigation chain(s)`);

  if (chains.length > 0) {
    console.log('\n📍 Navigation chains:');
    for (const chain of chains) {
      console.log(`   ${chain.join(' → ')}`);
    }
  }

  console.log('\n💡 Import in your app:');
  console.log('   import screenMap from \'./ai-screen-map.json\';');
  console.log('   <AIAgent screenMap={screenMap} />');
}

function detectFramework(projectRoot: string): 'expo-router' | 'react-navigation' {
  // Check for Expo Router (file-based routing)
  const srcApp = path.join(projectRoot, 'src', 'app');
  const appDir = path.join(projectRoot, 'app');

  if (fs.existsSync(srcApp) || fs.existsSync(appDir)) {
    // Verify it's actually Expo Router by checking for _layout.tsx
    const layoutInSrc = path.join(srcApp, '_layout.tsx');
    const layoutInApp = path.join(appDir, '_layout.tsx');
    if (fs.existsSync(layoutInSrc) || fs.existsSync(layoutInApp)) {
      return 'expo-router';
    }
  }

  return 'react-navigation';
}

interface CLIArgs {
  ai: boolean;
  provider: string;
  key: string;
  dir: string;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    ai: false,
    provider: 'gemini',
    key: '',
    dir: '',
  };

  for (const arg of argv) {
    if (arg === '--ai') args.ai = true;
    if (arg.startsWith('--provider=')) args.provider = arg.split('=')[1]!;
    if (arg.startsWith('--key=')) args.key = arg.split('=')[1]!;
    if (arg.startsWith('--dir=')) args.dir = arg.split('=')[1]!;
  }

  if (args.ai && !args.key) {
    console.error('❌ --ai requires --key=YOUR_API_KEY');
    process.exit(1);
  }

  return args;
}

// Run
main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

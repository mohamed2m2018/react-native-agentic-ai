import type { ConfigPlugin } from 'expo/config-plugins';
import * as path from 'path';
import * as fs from 'fs';
import { extractIntentsFromAST } from '../cli/generate-intents';
import { generateSwiftCode } from '../cli/generate-swift';

interface PluginOptions {
  /** The source directory to scan for useAction calls. Defaults to 'src' */
  scanDirectory?: string;
  /** App scheme for deep links. Defaults to the scheme in app.json */
  appScheme?: string;
}

const withAppIntents: ConfigPlugin<PluginOptions | void> = (config, options) => {
  let withXcodeProject: ((config: any, action: (config: any) => any) => any) | undefined;
  try {
    ({ withXcodeProject } = require('expo/config-plugins'));
  } catch {
    console.warn(
      '[MobileAI] `withAppIntents` requires `expo/config-plugins`. ' +
      'Skipping App Intents generation because Expo config plugins are not available.'
    );
    return config;
  }

  if (!withXcodeProject) {
    return config;
  }

  const applyWithXcodeProject = withXcodeProject;

  return applyWithXcodeProject(config, async (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName || config.name;
    const projectRoot = config.modRequest.projectRoot;

    const scanDir = (options as PluginOptions)?.scanDirectory || 'src';
    const appScheme = (options as PluginOptions)?.appScheme || (Array.isArray(config.scheme) ? config.scheme[0] : config.scheme) || 'mobileai';

    try {
      // 1. Scan and Extract
      const scanPath = path.resolve(projectRoot, scanDir);
      console.log(`\n🤖 [MobileAI] Scanning ${scanPath} for AI Actions...`);
      const intents = extractIntentsFromAST(scanPath);
      
      console.log(`🤖 [MobileAI] Found ${intents.length} actions.`);

      // 2. Generate Swift Code
      // We write a temporary manifest to disk to use the CLI function,
      // or we can just adapt generateSwiftCode to take the object directly, 
      // but the CLI expects a file path. Let's write a temporary file.
      const tmpManifestPath = path.join(projectRoot, '.mobileai-intent-manifest.tmp.json');
      fs.writeFileSync(tmpManifestPath, JSON.stringify(intents, null, 2));

      const swiftCode = generateSwiftCode(tmpManifestPath, appScheme);
      
      // Clean up tmp manifest
      if (fs.existsSync(tmpManifestPath)) {
        fs.unlinkSync(tmpManifestPath);
      }

      // 3. Write Swift File to iOS Project Directory
      const targetFilePath = path.join(projectRoot, 'ios', projectName, 'MobileAIAppIntents.swift');
      
      // Ensure directory exists
      const targetDir = path.dirname(targetFilePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetFilePath, swiftCode);
      console.log(`🤖 [MobileAI] Generated ${targetFilePath}`);

      // 4. Link in Xcode
      const groupKey = project.findPBXGroupKey({ name: projectName });
      if (!groupKey) {
        console.warn(`🤖 [MobileAI] Warning: Could not find main PBXGroup for ${projectName}. You may need to manually add MobileAIAppIntents.swift to Xcode.`);
        return config;
      }

      // Check if already added
      const relativeFilePath = `${projectName}/MobileAIAppIntents.swift`;
      const fileAdded = project.hasFile(relativeFilePath);
      
      if (!fileAdded) {
        project.addSourceFile(relativeFilePath, null, groupKey);
        console.log(`🤖 [MobileAI] Linked MobileAIAppIntents.swift to Xcode project.`);
      }

    } catch (error) {
      console.error('🤖 [MobileAI] AppIntents generation failed:', error);
    }

    return config;
  });
};

export default withAppIntents;

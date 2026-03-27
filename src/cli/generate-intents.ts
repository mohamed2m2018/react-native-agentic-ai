#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
// @ts-ignore - no types installed
import glob from 'glob';

// Define the schema format for our extracted intents
export interface ExtractedIntent {
  name: string;
  description: string;
  parameters: Record<string, any>;
  sourceFile: string;
}

/**
 * Validates and statically extracts `useAction` and `registerAction` definitions
 * from a target directory by parsing the AST of all TS/JS files.
 */
export function extractIntentsFromAST(sourceDir: string): ExtractedIntent[] {
  const files = glob.sync(`${sourceDir}/**/*.{ts,tsx,js,jsx}`, {
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/__tests__/**']
  });

  const intents: ExtractedIntent[] = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    
    // Quick heuristic: ignore files that don't even talk about useAction
    if (!code.includes('useAction') && !code.includes('registerAction')) {
      continue;
    }

    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      traverse(ast, {
        CallExpression(pathNode: any) {
          const callee = pathNode.node.callee;
          if (
            callee.type === 'Identifier' &&
            (callee.name === 'useAction' || callee.name === 'registerAction')
          ) {
            const args = pathNode.node.arguments;
            if (args.length >= 2) {
              const nameArg = args[0];
              const descArg = args[1];
              const schemaArg = args[2];

              // We only process if name and desc are static string literals
              if (nameArg.type === 'StringLiteral' && descArg.type === 'StringLiteral') {
                const name = nameArg.value;
                const description = descArg.value;
                let parameters: Record<string, any> = {};

                // Parse schema object if provided
                if (schemaArg && schemaArg.type === 'ObjectExpression') {
                  parameters = parseObjectExpression(schemaArg);
                }

                intents.push({
                  name,
                  description,
                  parameters,
                  sourceFile: path.relative(process.cwd(), file)
                });
              }
            }
          }
        }
      });
    } catch (error: any) {
      console.warn(`[WARN] Skipping file ${file} due to parse error: ${error.message}`);
    }
  }

  return intents;
}

/**
 * Naively converts an AST ObjectExpression back to a JS Runtime object.
 * Assumes the schema is statically defined (no variables/computed keys).
 */
function parseObjectExpression(node: any): any {
  const result: any = {};
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
      const key = prop.key.name;
      
      if (prop.value.type === 'StringLiteral') {
        result[key] = prop.value.value;
      } else if (prop.value.type === 'NumericLiteral') {
        result[key] = prop.value.value;
      } else if (prop.value.type === 'BooleanLiteral') {
        result[key] = prop.value.value;
      } else if (prop.value.type === 'ObjectExpression') {
        result[key] = parseObjectExpression(prop.value);
      } else if (prop.value.type === 'ArrayExpression') {
        result[key] = prop.value.elements.map((el: any) => {
          if (el.type === 'StringLiteral') return el.value;
          if (el.type === 'NumericLiteral') return el.value;
          return null;
        }).filter(Boolean);
      }
    }
  }
  return result;
}

async function main() {
  const sourceDir = process.argv[2] || 'src';
  const outPath = process.argv[3] || 'intent-manifest.json';
  
  const absoluteSource = path.resolve(process.cwd(), sourceDir);
  const absoluteOut = path.resolve(process.cwd(), outPath);

  console.log(`Scanning ${absoluteSource} for AI Actions...`);
  
  const intents = extractIntentsFromAST(absoluteSource);
  
  console.log(`Found ${intents.length} actions.`);
  intents.forEach(i => console.log(`  - ${i.name} (from ${i.sourceFile})`));
  
  fs.writeFileSync(absoluteOut, JSON.stringify(intents, null, 2));
  console.log(`\n✅ Wrote intent manifest to ${outPath}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

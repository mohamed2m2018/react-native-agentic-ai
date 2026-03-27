/**
 * Tool Module Types — shared interfaces for all agent tools.
 *
 * Each tool is a standalone module that exports a factory function
 * returning an AgentTool. This enables:
 *  - Clean separation of concerns (one file per interaction type)
 *  - Shared context via ToolContext (fiber tree, navigation, screen)
 *  - Consistent parameter validation via ToolParameter schema
 */

import type { WalkConfig } from '../core/FiberTreeWalker';

// ─── Tool Parameter Schema ─────────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
}

// ─── Agent Tool Interface ───────────────────────────────────

export interface AgentTool {
  /** Unique tool name (used as key in tools map) */
  name: string;
  /** Description shown to the AI model for tool selection */
  description: string;
  /** Parameter schema for the AI model */
  parameters: Record<string, ToolParameter>;
  /** Execute the tool with validated args */
  execute: (args: any) => Promise<string>;
}

// ─── Tool Context (shared dependencies injected by AgentRuntime) ──

export interface ToolContext {
  /** Root React ref for fiber tree access (getter to avoid stale closure) */
  getRootRef: () => any;
  /** Walk configuration (blacklist/whitelist/screen scoping) */
  getWalkConfig: () => WalkConfig;
  /** Get the current active screen name */
  getCurrentScreenName: () => string;
  /** Navigation ref getter (React Navigation / Expo Router) */
  getNavRef?: () => any;
  /** Expo Router ref */
  routerRef?: any;
  /** Get available route names */
  getRouteNames?: () => string[];
  /** Find nested screen path */
  findScreenPath?: (screenName: string) => string[];
  /** Build nested navigation params */
  buildNestedParams?: (path: string[], params?: any) => any;
  /** Capture screenshot (optional) */
  captureScreenshot?: () => Promise<string | null>;
  /** Get the most recently dehydrated screen (with layout coords) */
  getLastDehydratedRoot?: () => any;
}

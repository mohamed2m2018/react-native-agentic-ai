/**
 * MCP tools. Each one forwards to the running React Native app over the bridge.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { AppBridge } from './bridge.js';

const TASK_TIMEOUT_MS = 120_000;
const QUICK_TIMEOUT_MS = 20_000;

function text(value: unknown, isError = false): CallToolResult {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text: body }], ...(isError ? { isError: true } : {}) };
}

/** Runs a bridge request; app-side `{ error }` payloads and bridge failures become tool errors. */
async function forward(
  bridge: AppBridge,
  message: Record<string, unknown>,
  timeoutMs: number,
  pick: (payload: any) => unknown
): Promise<CallToolResult> {
  try {
    const payload: any = await bridge.request(message, timeoutMs);
    if (payload && typeof payload.error === 'string') return text(payload.error, true);
    return text(pick(payload));
  } catch (err) {
    return text(err instanceof Error ? err.message : String(err), true);
  }
}

export function registerTools(mcp: McpServer, bridge: AppBridge): void {
  mcp.registerTool(
    'execute_task',
    {
      title: 'Run a task in the app',
      description:
        'Give the in-app agent a task in plain language (e.g. "Add 2 lemonades to the cart and open checkout"). ' +
        'It reads the live screen, taps, types and navigates until done, then returns what it did. ' +
        'Uses the AI provider configured for this MCP server when one is set.',
      inputSchema: { command: z.string().min(1).describe('The task, in plain language.') },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ command }) => {
      try {
        const result: any = await bridge.request({ type: 'request', command }, TASK_TIMEOUT_MS);
        return text(result, result?.success === false);
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }
    }
  );

  mcp.registerTool(
    'get_app_status',
    {
      title: 'App connection status',
      description: 'Shows whether the app is connected and which AI provider MCP tasks use.',
      annotations: { readOnlyHint: true },
    },
    async () => text(bridge.status())
  );

  mcp.registerTool(
    'get_screen',
    {
      title: 'Read the current screen',
      description:
        'Returns the current screen as the agent sees it: visible text and interactive elements with their indexes. ' +
        'Use the indexes with call_app_tool (e.g. tap). Available in development builds.',
      annotations: { readOnlyHint: true },
    },
    async () => forward(bridge, { type: 'screen/state' }, QUICK_TIMEOUT_MS, (p) => p?.screen ?? p)
  );

  mcp.registerTool(
    'list_app_tools',
    {
      title: 'List app actions',
      description:
        'Lists the actions the app exposes (tap, type, scroll, navigate and any custom app actions) with their parameters. ' +
        'Available in development builds.',
      annotations: { readOnlyHint: true },
    },
    async () => forward(bridge, { type: 'tools/list' }, QUICK_TIMEOUT_MS, (p) => p?.tools ?? p)
  );

  mcp.registerTool(
    'call_app_tool',
    {
      title: 'Run one app action',
      description:
        'Runs one action from list_app_tools directly, without the in-app AI (no API key needed). ' +
        'Read get_screen first to find element indexes. Available in development builds.',
      inputSchema: {
        name: z.string().min(1).describe('Action name from list_app_tools, e.g. "tap".'),
        arguments: z.record(z.string(), z.unknown()).optional().describe('Action parameters, e.g. { "index": 3 }.'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ name, arguments: args }) =>
      forward(bridge, { type: 'tools/call', name, arguments: args ?? {} }, TASK_TIMEOUT_MS, (p) => p?.result ?? p)
  );
}

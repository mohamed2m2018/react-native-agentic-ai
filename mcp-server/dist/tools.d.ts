/**
 * MCP tools. Each one forwards to the running React Native app over the bridge.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppBridge } from './bridge.js';
export declare function registerTools(mcp: McpServer, bridge: AppBridge): void;

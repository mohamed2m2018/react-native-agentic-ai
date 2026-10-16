/**
 * @twomilia/mcp-server — connects MCP clients (Claude Code, Claude Desktop, Cursor, …)
 * to a running React Native app that uses <AIAgent mcpServerUrl=… />.
 */

import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AppBridge } from './bridge.js';
import { ConfigError, loadConfig, type ServerConfig } from './config.js';
import { log } from './log.js';
import { registerTools } from './tools.js';

const SERVER_INFO = { name: 'twomilia-react-native', version: '2.0.0' };

function createMcp(bridge: AppBridge): McpServer {
  const mcp = new McpServer(SERVER_INFO);
  registerTools(mcp, bridge);
  return mcp;
}

async function startStdio(bridge: AppBridge): Promise<void> {
  await createMcp(bridge).connect(new StdioServerTransport());
  log('MCP ready on stdio.');
}

function startHttp(bridge: AppBridge, port: number): void {
  const http = createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end('Not found. MCP endpoint is /mcp');
      return;
    }
    // Stateless: a fresh server + transport per request, as the SDK recommends for this mode.
    const mcp = createMcp(bridge);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      log(`HTTP request failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) res.writeHead(500).end('Internal error');
    }
  });
  http.listen(port, '127.0.0.1', () => log(`MCP ready on http://localhost:${port}/mcp`));
}

export async function main(): Promise<void> {
  let config: ServerConfig;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      log(`Config error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  log(
    config.ai
      ? `AI provider: ${config.ai.provider}${config.ai.model ? ` (${config.ai.model})` : ''}`
      : 'No AI_API_KEY set: execute_task uses the provider configured in the app.'
  );

  const bridge = new AppBridge(config.wsPort, config.ai);
  const shutdown = () => {
    bridge.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (config.transport === 'http') startHttp(bridge, config.httpPort);
  else await startStdio(bridge);
}

/**
 * MCPBridge — Connects the React Native app to the local MCP Server bridge.
 *
 * Flow:
 * - Connects via WebSocket to the Node.js MCP server
 * - Listens for 'request' messages containing an MCP command
 * - Forwards the command to AgentRuntime.execute()
 * - Sends the ExecutionResult back via WebSocket as a 'response'
 * - Accepts a 'config' message (provider + API key from the MCP server); MCP tasks
 *   then run on a separate runtime built with that key (dev builds only)
 */

import { logger } from '../utils/logger';
import type { AgentRuntime } from './AgentRuntime';
import {
  parseMCPProviderConfig,
  type MCPProviderConfig,
} from './mcpRuntimeConfig';

export interface MCPBridgeOptions {
  /** Builds the runtime MCP tasks use when the server sends a provider config. */
  createTaskRuntime?: (config: MCPProviderConfig) => AgentRuntime;
}

export class MCPBridge {
  private url: string;
  private ws: WebSocket | null = null;
  private runtime: AgentRuntime;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private createTaskRuntime?: MCPBridgeOptions['createTaskRuntime'];
  /** Runtime built from the MCP server's provider config; null = use the app's runtime. */
  private taskRuntime: AgentRuntime | null = null;

  constructor(
    url: string,
    runtime: AgentRuntime,
    options: MCPBridgeOptions = {}
  ) {
    this.url = url;
    this.runtime = runtime;
    this.createTaskRuntime = options.createTaskRuntime;
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;

    logger.info('MCPBridge', `Connecting to MCP bridge at ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      logger.info('MCPBridge', '✅ Connected to MCP bridge.');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const serverMode = this.runtime.getConfig().mcpServerMode ?? 'auto';
        const serverEnabled =
          serverMode === 'enabled' || (serverMode !== 'disabled' && __DEV__);

        switch (data.type) {
          case 'config': {
            this.applyProviderConfig(data, serverEnabled);
            break;
          }

          case 'request': {
            if (!data.command || !data.requestId) return;
            logger.info(
              'MCPBridge',
              `Received task from MCP: "${data.command}"`
            );
            const taskRuntime = this.taskRuntime ?? this.runtime;

            if (this.runtime.getIsRunning() || taskRuntime.getIsRunning()) {
              this.sendResponse(data.requestId, {
                success: false,
                message: 'Agent is already running a task. Please wait.',
                steps: [],
              });
              return;
            }

            // Execute the task using the SDK's existing runtime loop
            const result = await taskRuntime.execute(data.command);

            // Send result back to MCP server
            this.sendResponse(data.requestId, result);
            break;
          }

          case 'tools/list': {
            if (!serverEnabled) {
              this.sendResponse(data.requestId, {
                error: 'MCP server mode is disabled.',
              });
              break;
            }

            const tools = this.runtime.getTools().map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: {
                type: 'object',
                properties: t.parameters || {},
                required: Object.entries(t.parameters || {})
                  .filter(([_, p]: [string, any]) => p.required !== false)
                  .map(([k]) => k),
              },
            }));

            this.sendResponse(data.requestId, { tools });
            break;
          }

          case 'tools/call': {
            if (!serverEnabled) {
              this.sendResponse(data.requestId, {
                error: 'MCP server mode is disabled.',
              });
              break;
            }
            try {
              const result = await this.runtime.executeTool(
                data.name,
                data.arguments || {}
              );
              this.sendResponse(data.requestId, { result });
            } catch (err: any) {
              this.sendResponse(data.requestId, { error: err.message });
            }
            break;
          }

          case 'screen/state': {
            if (!serverEnabled) {
              this.sendResponse(data.requestId, {
                error: 'MCP server mode is disabled.',
              });
              break;
            }
            const screen = this.runtime.getScreenContext();
            this.sendResponse(data.requestId, { screen });
            break;
          }
        }
      } catch (err) {
        logger.error('MCPBridge', 'Error handling message:', err);
      }
    };

    this.ws.onclose = () => {
      if (!this.isDestroyed) {
        logger.warn(
          'MCPBridge',
          'Disconnected from MCP bridge. Reconnecting in 5s...'
        );
        this.ws = null;
        this.taskRuntime = null;
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => {
      logger.warn('MCPBridge', 'WebSocket error:', e);
      // onclose will handle reconnect
    };
  }

  private applyProviderConfig(data: any, serverEnabled: boolean) {
    const reject = (reason: string) => {
      logger.warn(
        'MCPBridge',
        `Ignored provider config from MCP server: ${reason}`
      );
      this.send({ type: 'config_ack', accepted: false, reason });
    };
    if (!serverEnabled)
      return reject('MCP server mode is disabled (production build).');
    if (!this.createTaskRuntime)
      return reject('This app does not accept a provider from the MCP server.');
    const config = parseMCPProviderConfig(data);
    if (!config)
      return reject(
        'Invalid config: needs provider ("gemini" or "openai") and a non-empty apiKey.'
      );

    this.taskRuntime = this.createTaskRuntime(config);
    logger.info(
      'MCPBridge',
      `MCP tasks now use ${config.provider}${config.model ? ` (${config.model})` : ''} from the MCP server.`
    );
    this.send({
      type: 'config_ack',
      accepted: true,
      provider: config.provider,
    });
  }

  private send(message: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendResponse(requestId: string, payload: any) {
    this.send({ type: 'response', requestId, payload });
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.taskRuntime = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * MCPBridge — Connects the React Native app to the local MCP Server bridge.
 * 
 * Flow:
 * - Connects via WebSocket to the Node.js MCP server
 * - Listens for 'request' messages containing an MCP command
 * - Forwards the command to AgentRuntime.execute()
 * - Sends the ExecutionResult back via WebSocket as a 'response'
 */

import { logger } from '../utils/logger';
import type { AgentRuntime } from './AgentRuntime';

export class MCPBridge {
  private url: string;
  private ws: WebSocket | null = null;
  private runtime: AgentRuntime;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor(url: string, runtime: AgentRuntime) {
    this.url = url;
    this.runtime = runtime;
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
        if (data.type === 'request' && data.command && data.requestId) {
          logger.info('MCPBridge', `Received task from MCP: "${data.command}"`);
          
          if (this.runtime.getIsRunning()) {
            this.sendResponse(data.requestId, {
              success: false,
              message: 'Agent is already running a task. Please wait.',
              steps: [],
            });
            return;
          }

          // Execute the task using the SDK's existing runtime loop
          const result = await this.runtime.execute(data.command);
          
          // Send result back to MCP server
          this.sendResponse(data.requestId, result);
        }
      } catch (err) {
        logger.error('MCPBridge', 'Error handling message:', err);
      }
    };

    this.ws.onclose = () => {
      if (!this.isDestroyed) {
        logger.warn('MCPBridge', 'Disconnected from MCP bridge. Reconnecting in 5s...');
        this.ws = null;
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => {
      logger.warn('MCPBridge', 'WebSocket error:', e);
      // onclose will handle reconnect
    };
  }

  private sendResponse(requestId: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'response',
        requestId,
        payload,
      }));
    }
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

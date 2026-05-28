import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
const HTTP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3100;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3101;
// ─── WebSocket Server (Bridge to React Native) ─────────────────
const wss = new WebSocketServer({ port: WS_PORT });
let activeAppConnection = null;
let pendingRequests = new Map();
wss.on('connection', (ws) => {
    console.log('[WS] React Native App connected!');
    activeAppConnection = ws;
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`[WS] Received:`, data);
            if (data.type === 'response' && data.requestId) {
                // Resolve pending request from MCP tool
                const resolve = pendingRequests.get(data.requestId);
                if (resolve) {
                    resolve(data.payload);
                    pendingRequests.delete(data.requestId);
                }
            }
        }
        catch (err) {
            console.error('[WS] Failed to parse message:', err);
        }
    });
    ws.on('close', () => {
        console.log('[WS] React Native App disconnected.');
        if (activeAppConnection === ws) {
            activeAppConnection = null;
        }
    });
});
console.log(`[WS] WebSocket server listening on ws://localhost:${WS_PORT}`);
// ─── Helper: Send command to React Native app ──────────────────
async function executeTaskInApp(command) {
    if (!activeAppConnection || activeAppConnection.readyState !== WebSocket.OPEN) {
        throw new Error('React Native app is not connected to the MCP bridge.');
    }
    const requestId = Math.random().toString(36).substring(7);
    return new Promise((resolve, reject) => {
        // Timeout after 60 seconds (mobile AI tasks can take a while)
        const timeout = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('Task execution timed out after 60 seconds.'));
        }, 60000);
        pendingRequests.set(requestId, (result) => {
            clearTimeout(timeout);
            resolve(result);
        });
        activeAppConnection.send(JSON.stringify({
            type: 'request',
            requestId,
            command,
        }));
        console.log(`[WS] Forwarded command to app: "${command}" (req: ${requestId})`);
    });
}
// ─── MCP Tools Registration ───────────────────────────────────
function registerTools(mcp) {
    mcp.tool('execute_task', 'Execute a natural language task in the connected React Native mobile app', {
        command: z.string().describe('The natural language command to execute, e.g. "Order 2 lemonades"'),
    }, async ({ command }) => {
        console.log(`[MCP] Tool invoked: execute_task("${command}")`);
        try {
            const result = await executeTaskInApp(command);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: `Error executing task: ${error.message}`,
                    },
                ],
            };
        }
    });
    mcp.tool('get_app_status', 'Check if the React Native app is currently connected to the bridge', async () => {
        const isConnected = activeAppConnection !== null && activeAppConnection.readyState === WebSocket.OPEN;
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        connected: isConnected,
                        pendingRequests: pendingRequests.size,
                    }, null, 2),
                },
            ],
        };
    });
}
// ─── HTTP Server Setup ──────────────────────────────────────────
const app = express();
app.use(cors());
// ─── Streamable HTTP Transport (Modern MCP - single /mcp endpoint) ──
app.all('/mcp', async (req, res) => {
    // Create a new MCP server + transport per session
    const mcp = new McpServer({
        name: 'react-native-ai-agent-bridge',
        version: '1.0.0',
    });
    registerTools(mcp);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
});
// ─── Legacy SSE Transport (backwards compatibility) ─────────────
const legacyMcp = new McpServer({
    name: 'react-native-ai-agent-bridge',
    version: '1.0.0',
});
registerTools(legacyMcp);
let sseTransport = null;
app.get('/mcp/sse', async (_req, res) => {
    console.log('[HTTP] New SSE connection established.');
    sseTransport = new SSEServerTransport('/mcp/messages', res);
    await legacyMcp.connect(sseTransport);
});
app.post('/mcp/messages', async (req, res) => {
    if (!sseTransport) {
        res.status(400).send('SSE connection not established yet.');
        return;
    }
    await sseTransport.handlePostMessage(req, res);
});
// ─── Start Server ──────────────────────────────────────────────
app.listen(HTTP_PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║          @mobileai/mcp-server  ready! 🚀             ║
╠══════════════════════════════════════════════════════╣
║  MCP Streamable HTTP  →  http://localhost:${HTTP_PORT}/mcp     ║
║  MCP Legacy SSE       →  http://localhost:${HTTP_PORT}/mcp/sse ║
║  React Native Bridge  →  ws://localhost:${WS_PORT}          ║
╠══════════════════════════════════════════════════════╣
║  Waiting for your React Native app to connect...     ║
║  Add  mcpServerUrl="ws://localhost:${WS_PORT}"  to AIAgent  ║
╚══════════════════════════════════════════════════════╝
  `);
});

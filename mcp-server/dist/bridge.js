/**
 * WebSocket bridge to the running React Native app.
 *
 * The app connects with <AIAgent mcpServerUrl="ws://localhost:3101" />.
 * On connect, the bridge sends the provider config (if any) so MCP tasks
 * run with the key given to this server.
 */
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { log } from './log.js';
export class AppBridge {
    port;
    ai;
    wss;
    app = null;
    pending = new Map();
    appUsesServerProvider = false;
    constructor(port, ai) {
        this.port = port;
        this.ai = ai;
        this.wss = new WebSocketServer({ port });
        this.wss.on('connection', (ws) => this.onConnection(ws));
        this.wss.on('error', (err) => log(`Bridge error: ${err.message}`));
        log(`Waiting for the app on ws://localhost:${port}`);
    }
    get isConnected() {
        return this.app !== null && this.app.readyState === WebSocket.OPEN;
    }
    status() {
        return {
            connected: this.isConnected,
            bridgeUrl: `ws://localhost:${this.port}`,
            provider: this.ai ? { name: this.ai.provider, model: this.ai.model ?? 'default' } : null,
            appUsesServerProvider: this.isConnected && this.appUsesServerProvider,
            pendingRequests: this.pending.size,
        };
    }
    /** Send a message to the app and wait for its response payload. */
    request(message, timeoutMs) {
        const app = this.app;
        if (!app || app.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error(`The React Native app is not connected. Run the app in dev mode with <AIAgent mcpServerUrl="ws://localhost:${this.port}" />.`));
        }
        const requestId = randomUUID();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`The app did not answer within ${Math.round(timeoutMs / 1000)} seconds.`));
            }, timeoutMs);
            this.pending.set(requestId, { resolve, reject, timer });
            app.send(JSON.stringify({ ...message, requestId }));
        });
    }
    close() {
        this.failAll('MCP server is shutting down.');
        this.wss.close();
    }
    onConnection(ws) {
        if (this.app && this.app !== ws) {
            log('A new app connection replaced the previous one.');
            this.app.close();
            this.failAll('The app reconnected before answering.');
        }
        this.app = ws;
        this.appUsesServerProvider = false;
        log('App connected.');
        if (this.ai) {
            ws.send(JSON.stringify({ type: 'config', provider: this.ai.provider, apiKey: this.ai.apiKey, model: this.ai.model }));
        }
        ws.on('message', (raw) => this.onMessage(raw.toString()));
        ws.on('close', () => {
            if (this.app !== ws)
                return;
            this.app = null;
            this.appUsesServerProvider = false;
            this.failAll('The app disconnected before answering.');
            log('App disconnected.');
        });
    }
    onMessage(raw) {
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            log('Ignored a message from the app that was not JSON.');
            return;
        }
        if (data?.type === 'config_ack') {
            this.appUsesServerProvider = data.accepted === true;
            log(this.appUsesServerProvider ? 'App accepted the provider config.' : `App refused the provider config: ${data.reason ?? 'no reason given'}`);
            return;
        }
        if (data?.type === 'response' && typeof data.requestId === 'string') {
            const entry = this.pending.get(data.requestId);
            if (!entry)
                return;
            clearTimeout(entry.timer);
            this.pending.delete(data.requestId);
            entry.resolve(data.payload);
        }
    }
    failAll(reason) {
        for (const [id, entry] of this.pending) {
            clearTimeout(entry.timer);
            entry.reject(new Error(reason));
            this.pending.delete(id);
        }
    }
}

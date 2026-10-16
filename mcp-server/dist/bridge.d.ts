/**
 * WebSocket bridge to the running React Native app.
 *
 * The app connects with <AIAgent mcpServerUrl="ws://localhost:3101" />.
 * On connect, the bridge sends the provider config (if any) so MCP tasks
 * run with the key given to this server.
 */
import type { ProviderConfig } from './config.js';
export declare class AppBridge {
    private port;
    private ai;
    private wss;
    private app;
    private pending;
    private appUsesServerProvider;
    constructor(port: number, ai: ProviderConfig | null);
    get isConnected(): boolean;
    status(): {
        connected: boolean;
        bridgeUrl: string;
        provider: {
            name: "gemini" | "openai";
            model: string;
        } | null;
        appUsesServerProvider: boolean;
        pendingRequests: number;
    };
    /** Send a message to the app and wait for its response payload. */
    request(message: Record<string, unknown>, timeoutMs: number): Promise<unknown>;
    close(): void;
    private onConnection;
    private onMessage;
    private failAll;
}

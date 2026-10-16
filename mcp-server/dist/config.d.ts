/**
 * Server configuration, read once from environment variables.
 *
 * Only what the MCP needs:
 *   AI_PROVIDER   gemini | openai           (required when AI_API_KEY is set)
 *   AI_API_KEY    key for that provider      (optional: without it the app uses its own provider)
 *   AI_MODEL      model id                   (optional: provider default)
 *   WS_PORT       app bridge port            (default 3101)
 *   MCP_TRANSPORT stdio | http               (default stdio)
 *   MCP_PORT      HTTP port when MCP_TRANSPORT=http (default 3100)
 */
export declare const SUPPORTED_PROVIDERS: readonly ["gemini", "openai"];
export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];
export interface ProviderConfig {
    provider: ProviderName;
    apiKey: string;
    model?: string;
}
export interface ServerConfig {
    ai: ProviderConfig | null;
    wsPort: number;
    transport: 'stdio' | 'http';
    httpPort: number;
}
export declare class ConfigError extends Error {
}
export declare function loadConfig(): ServerConfig;

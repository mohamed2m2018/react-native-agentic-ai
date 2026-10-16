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
export const SUPPORTED_PROVIDERS = ['gemini', 'openai'];
export class ConfigError extends Error {
}
function readPort(name, fallback) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigError(`${name} must be a port number (1-65535), got "${raw}".`);
    }
    return port;
}
function readProvider() {
    const apiKey = process.env.AI_API_KEY?.trim();
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const model = process.env.AI_MODEL?.trim() || undefined;
    if (!apiKey) {
        if (provider) {
            throw new ConfigError('AI_PROVIDER is set but AI_API_KEY is missing. Set both, or neither.');
        }
        return null;
    }
    if (!provider) {
        throw new ConfigError(`AI_API_KEY is set but AI_PROVIDER is missing. Use one of: ${SUPPORTED_PROVIDERS.join(', ')}.`);
    }
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        throw new ConfigError(`AI_PROVIDER "${provider}" is not supported. Use one of: ${SUPPORTED_PROVIDERS.join(', ')}.`);
    }
    return { provider: provider, apiKey, model };
}
export function loadConfig() {
    const transport = (process.env.MCP_TRANSPORT?.trim().toLowerCase() || 'stdio');
    if (transport !== 'stdio' && transport !== 'http') {
        throw new ConfigError(`MCP_TRANSPORT must be "stdio" or "http", got "${transport}".`);
    }
    return {
        ai: readProvider(),
        wsPort: readPort('WS_PORT', 3101),
        transport,
        httpPort: readPort('MCP_PORT', 3100),
    };
}

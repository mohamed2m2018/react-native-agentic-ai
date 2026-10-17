/**
 * Shown when a provider has neither apiKey nor proxyUrl. Providers report it
 * on the first model call instead of throwing at construction, so the app
 * still renders (and an MCP server can supply the key in development).
 */
export const MISSING_PROVIDER_CONFIG_MESSAGE =
  '[react-native-agentic-ai] No model access configured: pass "apiKey" (development) or "proxyUrl" (production) to <AIAgent>.';

/**
 * SDK Endpoint Configuration
 *
 * All MobileAI backend URLs live here.
 * Change these to point to a self-hosted or staging server.
 *
 * Enterprise customers: use the `analyticsProxyUrl` prop on <AIAgent>
 * to route telemetry through your own backend without touching this file.
 */

const MOBILEAI_BASE =
  process.env.EXPO_PUBLIC_MOBILEAI_BASE_URL ||
  process.env.NEXT_PUBLIC_MOBILEAI_BASE_URL ||
  'https://mobileai.cloud';

function toWebSocketBase(url: string): string {
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
  return url;
}

export const ENDPOINTS = {
  /** Hosted MobileAI text proxy — used by default when analyticsKey is set */
  hostedTextProxy: `${MOBILEAI_BASE}/api/v1/hosted-proxy/text`,

  /** Hosted MobileAI voice proxy — used by default when analyticsKey is set */
  hostedVoiceProxy: `${toWebSocketBase(MOBILEAI_BASE)}/ws/hosted-proxy/voice`,

  /** Telemetry event ingest — receives batched SDK events */
  telemetryIngest: `${MOBILEAI_BASE}/api/v1/events`,

  /** Feature flag sync — fetches remote flags for this analyticsKey */
  featureFlags: `${MOBILEAI_BASE}/api/v1/flags`,

  /** Live agent escalation (support handoff) */
  escalation: `${MOBILEAI_BASE}`,

  /** AI conversation history — save and retrieve per-user AI chat sessions */
  conversations: `${MOBILEAI_BASE}/api/v1/conversations`,
} as const;

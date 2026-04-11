/**
 * SDK Endpoint Configuration
 *
 * All MobileAI backend URLs live here.
 * Change these to point to a self-hosted or staging server.
 *
 * Enterprise customers: use the `analyticsProxyUrl` prop on <AIAgent>
 * to route telemetry through your own backend without touching this file.
 */

import { Platform } from 'react-native';

function resolveMobileAIBase(): string {
  const configuredBase =
    process.env.EXPO_PUBLIC_MOBILEAI_BASE_URL ||
    process.env.NEXT_PUBLIC_MOBILEAI_BASE_URL ||
    'https://mobileai.cloud';

  // Android emulators cannot reach the host machine via localhost/127.0.0.1.
  // Translate those hostnames to 10.0.2.2 so the Expo example can talk to the
  // local dashboard/backend without affecting iOS.
  if (Platform.OS === 'android') {
    return configuredBase.replace(
      /^http:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/,
      'http://10.0.2.2',
    );
  }

  return configuredBase;
}

const MOBILEAI_BASE = resolveMobileAIBase();

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

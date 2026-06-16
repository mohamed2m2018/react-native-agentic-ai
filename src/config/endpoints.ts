/**
 * SDK Endpoint Configuration
 *
 * All Twomilia backend URLs live here.
 * Change these to point to a self-hosted or staging server.
 *
 * Enterprise customers: use the `analyticsProxyUrl` prop on <AIAgent>
 * to route telemetry through your own backend without touching this file.
 */

import { Platform } from 'react-native';

function resolveTwomiliaBase(): string {
  const configuredBase =
    process.env.EXPO_PUBLIC_MOBILEAI_BASE_URL ||
    process.env.NEXT_PUBLIC_MOBILEAI_BASE_URL ||
    'https://twomilia.com';

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

const TWOMILIA_BASE = resolveTwomiliaBase();

function toWebSocketBase(url: string): string {
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
  return url;
}

export const ENDPOINTS = {
  /** Hosted Twomilia text proxy — used by default when analyticsKey is set */
  hostedTextProxy: `${TWOMILIA_BASE}/api/v1/hosted-proxy/text`,

  /** Hosted Twomilia voice proxy — used by default when analyticsKey is set */
  hostedVoiceProxy: `${toWebSocketBase(TWOMILIA_BASE)}/ws/hosted-proxy/voice`,

  /** Proxy session token exchange — exchanges analyticsKey for short-lived session token */
  proxySession: `${TWOMILIA_BASE}/api/v1/proxy-session`,

  /** Telemetry event ingest — receives batched SDK events */
  telemetryIngest: `${TWOMILIA_BASE}/api/v1/events`,

  /** Feature flag sync — fetches remote flags for this analyticsKey */
  featureFlags: `${TWOMILIA_BASE}/api/v1/flags`,

  /** Live agent escalation (support handoff) */
  escalation: `${TWOMILIA_BASE}`,

  /** AI conversation history — save and retrieve per-user AI chat sessions */
  conversations: `${TWOMILIA_BASE}/api/v1/conversations`,

  /** Proactive outreach — triggers and messages for user engagement */
  proactiveOutreach: `${TWOMILIA_BASE}/api/v1/outreach`,
} as const;

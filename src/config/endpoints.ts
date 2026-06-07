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

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

const getDevLocalhost = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
};

const MOBILEAI_BASE =
  process.env.EXPO_PUBLIC_MOBILEAI_BASE_URL ||
  process.env.NEXT_PUBLIC_MOBILEAI_BASE_URL ||
  (isDev ? getDevLocalhost() : 'https://api.mobileai.dev');

export const ENDPOINTS = {
  /** Telemetry event ingest — receives batched SDK events */
  telemetryIngest: `${MOBILEAI_BASE}/api/v1/events`,

  /** Feature flag sync — fetches remote flags for this analyticsKey */
  featureFlags: `${MOBILEAI_BASE}/api/v1/flags`,

  /** Live agent escalation (support handoff) */
  escalation: `${MOBILEAI_BASE}`,

  /** AI conversation history — save and retrieve per-user AI chat sessions */
  conversations: `${MOBILEAI_BASE}/api/v1/conversations`,
} as const;

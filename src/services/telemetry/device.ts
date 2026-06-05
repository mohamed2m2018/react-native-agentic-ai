import { Platform } from 'react-native';

/**
 * Deterministic device ID based on platform info.
 * This ensures analytics and flags remain consistent across sessions
 * without collecting PII hardware identifiers.
 */
export function getDeviceId(): string {
  const raw = `${Platform.OS}_${Platform.Version}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `dev_${Math.abs(hash).toString(36)}`;
}

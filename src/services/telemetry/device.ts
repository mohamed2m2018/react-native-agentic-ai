/**
 * Session device ID — a UUID generated once per app process.
 * Stable for the current JS runtime and sent with MobileAI telemetry.
 */

let _cachedId: string | null = null;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the session device ID synchronously (from cache).
 * Returns null if not yet initialized.
 */
export function getDeviceId(): string | null {
  return _cachedId;
}

/**
 * Initializes or retrieves the session device ID.
 * Call once on app startup. Subsequent getDeviceId() calls are synchronous.
 */
export async function initDeviceId(): Promise<string> {
  if (_cachedId) return _cachedId;

  const newId = generateUUID();
  _cachedId = newId;
  return newId;
}

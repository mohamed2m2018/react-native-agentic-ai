/**
 * Persistent device ID — a UUID generated on first launch and stored in AsyncStorage.
 * Unique per app install, survives across sessions.
 *
 * AsyncStorage is an optional peer dependency — if not installed, the ID
 * persists only in memory for the current session.
 */

const STORAGE_KEY = '@mobileai:device_id';

let _cachedId: string | null = null;
let _storageLoaded = false;
let _storage: any = null;

function loadStorage(): any {
  if (_storageLoaded) return _storage;
  _storageLoaded = true;
  try {
    // Suppress the RN red box that AsyncStorage triggers when its native module
    // isn't linked ("NativeModule: AsyncStorage is null").
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('AsyncStorage')) return;
      origError.apply(console, args);
    };
    try {
      const mod = require('@react-native-async-storage/async-storage');
      const candidate = mod.default ?? mod;
      if (candidate && typeof candidate.getItem === 'function') {
        _storage = candidate;
      }
    } finally {
      console.error = origError;
    }
  } catch {
    // Not installed — device ID won't persist across restarts
  }
  return _storage;
}

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
 * Returns the persistent device ID synchronously (from cache).
 * Returns null if not yet initialized.
 */
export function getDeviceId(): string | null {
  return _cachedId;
}

/**
 * Initializes or retrieves the persistent device ID.
 * Call once on app startup. Subsequent getDeviceId() calls are synchronous.
 */
export async function initDeviceId(): Promise<string> {
  if (_cachedId) return _cachedId;

  const storage = loadStorage();
  if (storage) {
    try {
      const stored: string | null = await storage.getItem(STORAGE_KEY);
      if (stored) {
        _cachedId = stored;
        return stored;
      }
    } catch {
      // Storage read failed — continue with new ID
    }
  }

  const newId = generateUUID();
  _cachedId = newId;

  if (storage) {
    try {
      await storage.setItem(STORAGE_KEY, newId);
    } catch {
      // Storage write failed — ID works for this session only
    }
  }

  return newId;
}

/**
 * TicketStore — persists the active support ticket across app restarts.
 *
 * Uses @react-native-async-storage/async-storage as an optional peer dependency.
 * If AsyncStorage is not installed, all methods silently no-op and the feature
 * degrades gracefully (tickets are still shown while the app is open, just not
 * restored after a restart).
 *
 * Usage:
 *   await TicketStore.save(ticketId, analyticsKey);   // on escalation start
 *   const pending = await TicketStore.get();           // on AIAgent mount
 *   await TicketStore.clear();                         // on modal close / ticket closed
 */

const STORAGE_KEY = '@mobileai_pending_ticket';

interface PendingTicket {
  ticketId: string;
  analyticsKey: string;
}

/** Try to load AsyncStorage at runtime. Optional peer dep — not bundled. */
function getAsyncStorage(): any | null {
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
      const candidate = mod?.default ?? mod?.AsyncStorage ?? null;
      if (candidate && typeof candidate.getItem === 'function') {
        return candidate;
      }
      return null;
    } finally {
      console.error = origError;
    }
  } catch {
    return null;
  }
}

export const TicketStore = {
  /**
   * Persist the active ticket so it survives an app restart.
   */
  async save(ticketId: string, analyticsKey: string): Promise<void> {
    const AS = getAsyncStorage();
    if (!AS) {
      console.warn(
        '[TicketStore] @react-native-async-storage/async-storage is not installed — ' +
        'ticket will not persist across app restarts. ' +
        'Run: npx expo install @react-native-async-storage/async-storage'
      );
      return;
    }
    try {
      await AS.setItem(STORAGE_KEY, JSON.stringify({ ticketId, analyticsKey }));
      console.log('[TicketStore] Ticket saved:', ticketId);
    } catch (err) {
      console.error('[TicketStore] Failed to save ticket:', err);
    }
  },

  /**
   * Retrieve the persisted pending ticket, if any.
   * Returns null if nothing is stored or AsyncStorage is unavailable.
   */
  async get(): Promise<PendingTicket | null> {
    const AS = getAsyncStorage();
    if (!AS) return null;
    try {
      const raw = await AS.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PendingTicket;
    } catch (err) {
      console.error('[TicketStore] Failed to read ticket:', err);
      return null;
    }
  },

  /**
   * Remove the stored ticket (ticket closed or user dismissed modal).
   */
  async clear(): Promise<void> {
    const AS = getAsyncStorage();
    if (!AS) return;
    try {
      await AS.removeItem(STORAGE_KEY);
      console.log('[TicketStore] Pending ticket cleared');
    } catch (err) {
      console.error('[TicketStore] Failed to clear ticket:', err);
    }
  },
};

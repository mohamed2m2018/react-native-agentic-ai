/**
 * Logger utility — prefixed console output for easy filtering.
 *
 * Disabled by default. Enable via `logger.setEnabled(true)` or
 * pass `debug={true}` to the <AIAgent> component.
 *
 * Production logging:
 * In release builds, console.log is invisible (no Metro terminal).
 * When enabled, logs are routed to the native logging system:
 * - iOS: os_log → visible in Xcode Console app (Window → Devices)
 * - Android: Logcat → visible via `adb logcat *:S ReactNativeJS:V`
 *
 * This uses React Native's built-in native logging bridge, which
 * calls through to NSLog (iOS) and android.util.Log (Android).
 * No additional native dependencies required.
 */
const TAG = '[AIAgent]';
const MAX_ENTRIES = 2000;

let enabled = false;

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  context: string;
  args: any[];
  timestamp: number;
  message: string;
}

const entries: LogEntry[] = [];
const unflushedEntries: LogEntry[] = [];

// ─── Native Logging Transport ──────────────────────────────────
// Routes logs to os_log (iOS) / Logcat (Android) in release builds.
// Uses React Native's global.nativeLoggingHook if available, which
// is the same mechanism React Native uses internally for console.*
// in bridgeless mode. Falls back to console.* otherwise.

/**
 * Write a message to the native logging system.
 * In release builds without Metro, this is the only way to see logs
 * in Xcode Console or `adb logcat`.
 *
 * nativeLoggingHook levels: 0=log, 1=warn, 2=error
 */
const LOG_LEVEL_MAP = { info: 0, warn: 1, error: 2, debug: 0 } as const;

function nativeLog(level: keyof typeof LOG_LEVEL_MAP, message: string): void {
  try {
    // Strategy 1: nativeLoggingHook — React Native's internal bridge to NSLog/Logcat.
    // Present in both dev and release builds. This is what console.* ultimately
    // calls in React Native's JS environment.
    const hook = (globalThis as any).nativeLoggingHook;
    if (typeof hook === 'function') {
      hook(message, LOG_LEVEL_MAP[level]);
      return;
    }

    // Strategy 2: Hermes console — in Hermes release builds, console methods
    // may still route to the native log system depending on the build config.
    // This is a fallback if nativeLoggingHook isn't available.
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  } catch {
    // Silently fail — never crash the app due to logging
  }
}

function formatArg(arg: any): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg !== 'object') return String(arg);
  
  try {
    // Highly performant O(1) depth-1 stringifier to prevent JS thread freezes
    return JSON.stringify(arg, (key, value) => {
      // Allow the root object (where key is empty string)
      if (key === '') return value;
      // For any nested objects/arrays, summarize them instantly without recursion
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) return `[Array(${value.length})]`;
        return '{...}';
      }
      // For primitive values (strings, numbers, booleans)
      if (typeof value === 'string' && value.length > 200) {
         return value.substring(0, 200) + '...';
      }
      return value;
    });
  } catch {
    return '[unserializable]';
  }
}

function formatArgs(args: any[]): string {
  return args.map(formatArg).join(' ');
}

function record(level: LogEntry['level'], context: string, args: any[]): LogEntry {
  const entry: LogEntry = {
    level,
    context,
    args,
    timestamp: Date.now(),
    message: `${TAG} [${context}] ${formatArgs(args)}`.trim(),
  };

  entries.push(entry);
  
  // Systemic anti-recursion: Do not buffer Telemetry's own logs for extraction.
  // This physically prevents TelemetryService from harvesting its own diagnostic
  // logs (like "Flush failed") into SDK trace dumps, eliminating infinite queue loops.
  if (context !== 'Telemetry') {
    unflushedEntries.push(entry);
  }
  
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  if (unflushedEntries.length > MAX_ENTRIES) {
    unflushedEntries.splice(0, unflushedEntries.length - MAX_ENTRIES);
  }

  try {
    (globalThis as any).__MOBILEAI_LOGS__ = entries;
  } catch {
    // ignore global write failures
  }

  return entry;
}

// ─── Output helpers ────────────────────────────────────────────

/** Route a log message to the appropriate output based on environment. */
function emit(level: LogEntry['level'], formattedMessage: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Dev mode: use console.* (visible in Metro terminal)
    switch (level) {
      case 'error': console.error(formattedMessage); break;
      case 'warn': console.warn(formattedMessage); break;
      default: console.log(formattedMessage);
    }
  } else {
    // Release mode: route to native logging system (os_log / Logcat)
    nativeLog(level, formattedMessage);
  }
}

export const logger = {
  /** Enable or disable all SDK logging. */
  setEnabled: (value: boolean) => {
    enabled = value;
  },

  /** Check if logging is enabled. */
  isEnabled: () => enabled,

  /** Return a snapshot of recent SDK log entries. */
  getEntries: (): LogEntry[] => [...entries],

  /** Return recent entries as plain text lines, newest last. */
  getRecentLines: (limit: number = 200): string[] =>
    entries.slice(-Math.max(0, limit)).map((entry) => {
      const iso = new Date(entry.timestamp).toISOString();
      return `${iso} ${entry.message}`;
    }),

  /** Extract unflushed entries as plain text and clear the unflushed buffer. */
  extractUnflushedLines: (): string[] => {
    if (unflushedEntries.length === 0) return [];
    const lines = unflushedEntries.map((entry) => {
      const iso = new Date(entry.timestamp).toISOString();
      return `${iso} ${entry.message}`;
    });
    unflushedEntries.length = 0;
    return lines;
  },

  /** Clear the in-memory SDK log history. */
  clearEntries: () => {
    entries.length = 0;
    try {
      (globalThis as any).__MOBILEAI_LOGS__ = entries;
    } catch {
      // ignore global write failures
    }
  },

  info: (context: string, ...args: any[]) => {
    record('info', context, args);
    if (enabled) emit('info', `${TAG} [${context}] ${formatArgs(args)}`);
  },

  warn: (context: string, ...args: any[]) => {
    record('warn', context, args);
    if (enabled) emit('warn', `${TAG} [${context}] ${formatArgs(args)}`);
  },

  error: (context: string, ...args: any[]) => {
    record('error', context, args);
    // Errors always log regardless of enabled flag
    emit('error', `${TAG} [${context}] ${formatArgs(args)}`);
  },

  debug: (context: string, ...args: any[]) => {
    record('debug', context, args);
    if (enabled) emit('debug', `${TAG} [${context}] 🐛 ${formatArgs(args)}`);
  },
};

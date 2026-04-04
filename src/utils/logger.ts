/**
 * Logger utility — prefixed console output for easy filtering.
 *
 * Disabled by default. Enable via `logger.setEnabled(true)` or
 * pass `debug={true}` to the <AIAgent> component.
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

function formatArgs(args: any[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
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
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  try {
    (globalThis as any).__MOBILEAI_LOGS__ = entries;
  } catch {
    // ignore global write failures
  }

  return entry;
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
    if (enabled) console.log(`${TAG} [${context}]`, ...args);
  },

  warn: (context: string, ...args: any[]) => {
    record('warn', context, args);
    if (enabled) console.warn(`${TAG} [${context}]`, ...args);
  },

  error: (context: string, ...args: any[]) => {
    record('error', context, args);
    // Errors always log regardless of enabled flag
    console.error(`${TAG} [${context}]`, ...args);
  },

  debug: (context: string, ...args: any[]) => {
    record('debug', context, args);
    if (enabled && __DEV__) {
      console.log(`${TAG} [${context}] 🐛`, ...args);
    }
  },
};

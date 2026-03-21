/**
 * Logger utility — prefixed console output for easy filtering.
 *
 * Disabled by default. Enable via `logger.setEnabled(true)` or
 * pass `debug={true}` to the <AIAgent> component.
 */
const TAG = '[AIAgent]';

let enabled = false;

export const logger = {
  /** Enable or disable all SDK logging. */
  setEnabled: (value: boolean) => {
    enabled = value;
  },

  /** Check if logging is enabled. */
  isEnabled: () => enabled,

  info: (context: string, ...args: any[]) => {
    if (enabled) console.log(`${TAG} [${context}]`, ...args);
  },

  warn: (context: string, ...args: any[]) => {
    if (enabled) console.warn(`${TAG} [${context}]`, ...args);
  },

  error: (context: string, ...args: any[]) => {
    // Errors always log regardless of enabled flag
    console.error(`${TAG} [${context}]`, ...args);
  },

  debug: (context: string, ...args: any[]) => {
    if (enabled && __DEV__) {
      console.log(`${TAG} [${context}] 🐛`, ...args);
    }
  },
};

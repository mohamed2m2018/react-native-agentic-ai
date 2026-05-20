/**
 * Logger utility — prefixed console output for easy filtering.
 */
const TAG = '[AIAgent]';

export const logger = {
  info: (context: string, ...args: any[]) =>
    console.log(`${TAG} [${context}]`, ...args),

  warn: (context: string, ...args: any[]) =>
    console.warn(`${TAG} [${context}]`, ...args),

  error: (context: string, ...args: any[]) =>
    console.error(`${TAG} [${context}]`, ...args),

  debug: (context: string, ...args: any[]) => {
    if (__DEV__) {
      console.log(`${TAG} [${context}] 🐛`, ...args);
    }
  },
};

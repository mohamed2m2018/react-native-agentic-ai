type ActionResultRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ActionResultRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatActionToolResult(
  result: unknown,
  fallbackMessage: string
): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result == null) {
    return fallbackMessage;
  }

  if (isRecord(result)) {
    const success =
      typeof result.success === 'boolean' ? result.success : undefined;
    const message =
      typeof result.message === 'string' ? result.message.trim() : '';
    const hasOutput = Object.prototype.hasOwnProperty.call(result, 'output');
    const output = hasOutput ? result.output : undefined;
    const prefix = success === false ? '❌ ' : success === true ? '✅ ' : '';

    if (message && hasOutput) {
      return `${prefix}${message}\nOutput: ${safeStringify(output)}`;
    }

    if (message) {
      return `${prefix}${message}`;
    }

    if (hasOutput) {
      return `${prefix}Output: ${safeStringify(output)}`;
    }
  }

  return safeStringify(result);
}

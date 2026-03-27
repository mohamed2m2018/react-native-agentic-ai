const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/g;
const CARD_RE = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;

/**
 * Scrubs common PII patterns from strings.
 * Used by TelemetryService to sanitize auto-captured touch labels.
 */
export function scrubPII(value: string): string {
  if (typeof value !== 'string') return value;
  
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(CARD_RE, '[card]')
    // Phone numbers are tricky, we rely on the 7+ digit regex
    .replace(PHONE_RE, '[phone]');
}

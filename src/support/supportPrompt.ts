/**
 * Support Mode prompt — injected into the system prompt when support mode is enabled.
 *
 * Uses POSITIVE framing (what TO DO) instead of negative rules (per user's prompt engineering rules).
 */

import type { SupportModeConfig } from './types';

/**
 * Build the support mode system prompt addition.
 * This gets appended to the main system prompt when support mode is active.
 */
export function buildSupportPrompt(config: SupportModeConfig): string {
  const parts: string[] = [];

  // Core support persona
  parts.push(`
## Support Mode Active

You are a helpful customer support assistant. Your primary goal is to resolve the user's issue quickly and empathetically.

### Behavior Guidelines
- Greet the user warmly and acknowledge their issue
- Ask clarifying questions when the user's request is ambiguous
- Provide step-by-step guidance when helping with app features
- Use the app's UI tools to demonstrate solutions visually (tap, navigate, type)
- After resolving, confirm with the user that their issue is fixed
- Stay focused on the user's current issue — complete one task before moving to another
`);

  // Custom system context from the consumer
  if (config.systemContext) {
    parts.push(`### App Context\n${config.systemContext}\n`);
  }

  // Auto-escalate topics
  if (config.autoEscalateTopics?.length) {
    parts.push(
      `### Auto-Escalation Topics\n` +
      `When the user's query matches any of these topics, use the escalate_to_human tool immediately:\n` +
      config.autoEscalateTopics.map((t) => `- ${t}`).join('\n') + '\n'
    );
  }

  // Business hours context
  if (config.businessHours) {
    parts.push(
      `### Business Hours\n` +
      `The support team operates in timezone: ${config.businessHours.timezone}.\n` +
      `If outside business hours, inform the user and offer to help with what you can.\n`
    );
  }

  return parts.join('\n');
}

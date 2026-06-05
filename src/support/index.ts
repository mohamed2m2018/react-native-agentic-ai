/**
 * Support Mode — barrel export.
 */

// Types
export type {
  SupportModeConfig,
  QuickReply,
  EscalationConfig,
  EscalationContext,
  CSATConfig,
  CSATRating,
  BusinessHoursConfig,
} from './types';

// Prompt injection
export { buildSupportPrompt } from './supportPrompt';

// Escalation tool + WebSocket manager
export { createEscalateTool } from './escalateTool';
export { EscalationSocket } from './EscalationSocket';
export type { SocketReplyHandler } from './EscalationSocket';

// UI Components
export { SupportGreeting } from './SupportGreeting';
export { CSATSurvey } from './CSATSurvey';


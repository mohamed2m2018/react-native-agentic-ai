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

// Escalation tool
export { createEscalateTool } from './escalateTool';

// UI Components
export { SupportGreeting } from './SupportGreeting';
export { CSATSurvey } from './CSATSurvey';

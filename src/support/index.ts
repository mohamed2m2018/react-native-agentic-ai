/**
 * Support Mode — barrel export.
 */

// Types
export type {
  SupportModeConfig,
  QuickReply,
  EscalationConfig,
  EscalationContext,
  EscalationUserContext,
  CSATConfig,
  CSATRating,
  BusinessHoursConfig,
  QuickActionsConfig,
  HelpTopic,
  HelpArticle,
} from './types';
export type { SupportStyle } from './supportStyle';

// Prompt injection
export { buildSupportPrompt } from './supportPrompt';

// Escalation tool (hands off through supportMode.escalation.onEscalate)
export { createEscalateTool } from './escalateTool';

// UI Components
export { CSATSurvey } from './CSATSurvey';
export { QuickActionsSheet } from './QuickActionsSheet';
export { HelpArticleView } from './HelpArticleView';

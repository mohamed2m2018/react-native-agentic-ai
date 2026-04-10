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
  SupportTicket,
  ReportedIssue,
  ReportedIssueCustomerStatus,
  ReportedIssueStatusUpdate,
} from './types';
export type { SupportStyle } from './supportStyle';

// Prompt injection
export { buildSupportPrompt } from './supportPrompt';

// Escalation tool + WebSocket manager
export { createEscalateTool } from './escalateTool';
export { createReportIssueTool } from './reportIssueTool';
export { EscalationSocket } from './EscalationSocket';
export type { SocketReplyHandler } from './EscalationSocket';
export { EscalationEventSource } from './EscalationEventSource';

// UI Components
export { SupportGreeting } from './SupportGreeting';
export { CSATSurvey } from './CSATSurvey';

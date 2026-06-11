/**
 * @mobileai/react-native
 *
 * Zero-wrapper AI agent for React Native.
 * Auto-detects interactive elements via React Fiber tree traversal.
 */

// ─── Components ──────────────────────────────────────────────
export { AIAgent } from './components/AIAgent';
export { AIZone } from './components/AIZone';
export { AIConsentDialog, useAIConsent } from './components/AIConsentDialog';
export { RichContentRenderer } from './components/rich-content/RichContentRenderer';
export { RichUIProvider } from './components/rich-content/RichUIContext';
// Built-in compatibility wrappers and rich blocks
export { InfoCard } from './components/cards/InfoCard';
export { ReviewSummary } from './components/cards/ReviewSummary';
export {
  FactCard,
  ProductCard,
  ActionCard,
  ComparisonCard,
  FormCard,
} from './components/blocks';
export {
  CardSurface,
  MediaFrame,
  PriceTag,
  BadgeRow,
  MetaRow,
  ActionRow,
  FieldRow,
  SectionTitle,
} from './components/blocks/primitives';

// ─── Providers ───────────────────────────────────────────────
export { GeminiProvider } from './providers/GeminiProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { createProvider } from './providers/ProviderFactory';
export { ReactNativePlatformAdapter } from './core/ReactNativePlatformAdapter';

// ─── Hooks ───────────────────────────────────────────────────
export { useAction, useData, useAI } from './hooks/useAction';

// ─── Services ────────────────────────────────────────────────
export { VoiceService } from './services/VoiceService';
export { AudioInputService } from './services/AudioInputService';
export { AudioOutputService } from './services/AudioOutputService';
export { KnowledgeBaseService } from './services/KnowledgeBaseService';
export { createMobileAIKnowledgeRetriever } from './services/MobileAIKnowledgeRetriever';

// ─── Analytics ───────────────────────────────────────────────
export { MobileAI } from './services/telemetry';

// ─── Utilities ───────────────────────────────────────────────
export { logger } from './utils/logger';

// ─── Types ───────────────────────────────────────────────────
export type {
  AgentConfig,
  AgentMode,
  ActionIntent,
  ExecutionResult,
  InteractiveNode,
  InteractiveElement,
  DehydratedScreen,
  NavigationSnapshot,
  PlatformAdapter,
  ScreenSnapshot,
  ZoneSnapshot,
  ToolDefinition,
  ActionDefinition,
  DataDefinition,
  DataFieldDef,
  DataQueryContext,
  TokenUsage,
  KnowledgeEntry,
  KnowledgeRetriever,
  KnowledgeBaseConfig,
  ChatBarTheme,
  AIMessage,
  AIRichNode,
  BlockDefinition,
  AIProviderName,
  ScreenMap,
  ScreenMapEntry,
  InteractionMode,
  ConversationSummary,
} from './core/types';
export type { RichUITheme, RichUIThemeOverride } from './theme/RichUITheme';

export type { MobileAIKnowledgeRetrieverOptions } from './services/MobileAIKnowledgeRetriever';

export type { AIConsentConfig } from './components/AIConsentDialog';

export type {
  VoiceServiceConfig,
  VoiceServiceCallbacks,
  VoiceStatus,
} from './services/VoiceService';

export type { TelemetryConfig, TelemetryEvent } from './services/telemetry';

// ─── Support Mode ────────────────────────────────────────────
// CSATSurvey and buildSupportPrompt work standalone (no backend)
// createEscalateTool works with provider='custom' (no backend)
// EscalationSocket and provider='mobileai' require api.mobileai.dev
export {
  CSATSurvey,
  buildSupportPrompt,
  createEscalateTool,
  EscalationSocket,
} from './support';
export { createReportIssueTool } from './support';

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
} from './support';
export type { SupportStyle } from './support';

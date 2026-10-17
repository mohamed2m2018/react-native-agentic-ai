/**
 * react-native-agentic-ai
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
  ActionSafetyCapability,
  ActionSafetyClassifier,
  ActionSafetyClassifierSetting,
  ActionSafetyConfig,
  ActionSafetyDecision,
  ActionSafetyRisk,
  ActionSafetyScope,
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
  AIRichImageNode,
  UserImage,
  BlockDefinition,
  AIProviderName,
  ScreenMap,
  ScreenMapEntry,
  InteractionMode,
  ConversationSummary,
  ConversationMessage,
  ConversationStore,
} from './core/types';
export type { RichUITheme, RichUIThemeOverride } from './theme/RichUITheme';

export type { AIConsentConfig } from './components/AIConsentDialog';

export type {
  VoiceServiceConfig,
  VoiceServiceCallbacks,
  VoiceStatus,
} from './services/VoiceService';

export type { TelemetryEvent, TrackEvent } from './services/telemetry';

// ─── Support Mode ────────────────────────────────────────────
// Everything here runs in the app; escalation hands off through onEscalate.
export {
  CSATSurvey,
  QuickActionsSheet,
  HelpArticleView,
  buildSupportPrompt,
  createEscalateTool,
} from './support';

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
} from './support';
export type { SupportStyle } from './support';

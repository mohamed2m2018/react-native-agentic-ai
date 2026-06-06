/**
 * @mobileai/react-native
 *
 * Zero-wrapper AI agent for React Native.
 * Auto-detects interactive elements via React Fiber tree traversal.
 */

// ─── Components ──────────────────────────────────────────────
export { AIAgent } from './components/AIAgent';
export { AIZone } from './components/AIZone';
// Built-in card templates for AIZone injection
// Note: displayName is set explicitly on each — required for minification-safe template lookup.
export { InfoCard } from './components/cards/InfoCard';
export { ReviewSummary } from './components/cards/ReviewSummary';

// ─── Providers ───────────────────────────────────────────────
export { GeminiProvider } from './providers/GeminiProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { createProvider } from './providers/ProviderFactory';

// ─── Hooks ───────────────────────────────────────────────────
export { useAction, useAI } from './hooks/useAction';

// ─── Services ────────────────────────────────────────────────
export { VoiceService } from './services/VoiceService';
export { AudioInputService } from './services/AudioInputService';
export { AudioOutputService } from './services/AudioOutputService';
export { KnowledgeBaseService } from './services/KnowledgeBaseService';

// ─── Analytics ───────────────────────────────────────────────
export { MobileAI } from './services/telemetry';

// ─── Utilities ───────────────────────────────────────────────
export { logger } from './utils/logger';

// ─── Types ───────────────────────────────────────────────────
export type {
  AgentConfig,
  AgentMode,
  ExecutionResult,
  InteractiveElement,
  DehydratedScreen,
  ToolDefinition,
  ActionDefinition,
  TokenUsage,
  KnowledgeEntry,
  KnowledgeRetriever,
  KnowledgeBaseConfig,
  ChatBarTheme,
  AIMessage,
  AIProviderName,
  ScreenMap,
  ScreenMapEntry,
} from './core/types';

export type {
  VoiceServiceConfig,
  VoiceServiceCallbacks,
  VoiceStatus,
} from './services/VoiceService';

export type {
  TelemetryConfig,
  TelemetryEvent,
} from './services/telemetry';

// ─── Support Mode ────────────────────────────────────────────
// SupportGreeting, CSATSurvey, buildSupportPrompt work standalone (no backend)
// createEscalateTool works with provider='custom' (no backend)
// EscalationSocket and provider='mobileai' require api.mobileai.dev
export { SupportGreeting, CSATSurvey, buildSupportPrompt, createEscalateTool, EscalationSocket } from './support';

export type {
  SupportModeConfig,
  QuickReply,
  EscalationConfig,
  EscalationContext,
  CSATConfig,
  CSATRating,
  BusinessHoursConfig,
  SupportTicket,
} from './support';

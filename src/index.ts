/**
 * @mobileai/react-native
 *
 * Zero-wrapper AI agent for React Native.
 * Auto-detects interactive elements via React Fiber tree traversal.
 */

// ─── Components ──────────────────────────────────────────────
export { AIAgent } from './components/AIAgent';

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
} from './core/types';

export type {
  VoiceServiceConfig,
  VoiceServiceCallbacks,
  VoiceStatus,
} from './services/VoiceService';

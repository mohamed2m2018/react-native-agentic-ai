/**
 * @mobileai/react-native — Page-Agent Architecture
 *
 * Zero-wrapper AI agent for React Native.
 * Auto-detects interactive elements via React Fiber tree traversal.
 */

// ─── Components ──────────────────────────────────────────────
export { AIAgent } from './components/AIAgent';

// ─── Hooks ───────────────────────────────────────────────────
export { useAction } from './hooks/useAction';

// ─── Types ───────────────────────────────────────────────────
export type {
  AgentConfig,
  ExecutionResult,
  InteractiveElement,
  DehydratedScreen,
  ToolDefinition,
  ActionDefinition,
} from './core/types';

/**
 * useAction — Register non-UI actions for the AI agent.
 * useAI    — Bridge hook to read AIAgent's state (send, isLoading, status).
 *
 * Both hooks consume AgentContext, which is provided by <AIAgent>.
 */

import { useEffect, useContext, createContext, useCallback, useRef } from 'react';
import type { AgentRuntime } from '../core/AgentRuntime';
import type { ExecutionResult, AIMessage } from '../core/types';

// ─── Context ──────────────────────────────────────────────────

export interface AgentContextValue {
  runtime: AgentRuntime | null;
  /** Send a text message to the agent (same as typing in the chat bar). */
  send: (message: string, options?: { onResult?: (result: ExecutionResult) => void }) => void;
  /** Whether the agent is currently executing (thinking / tapping / navigating). */
  isLoading: boolean;
  /** Live status text — e.g. "Analyzing screen...", "Tapping element 3..." */
  status: string;
  /** The result of the last completed execution. */
  lastResult: ExecutionResult | null;
  /** The full conversation history for custom chat UIs. */
  messages: AIMessage[];
  /** Clear the conversation history. */
  clearMessages: () => void;
  /** Cancel the currently running task. */
  cancel: () => void;
}

const DEFAULT_CONTEXT: AgentContextValue = {
  runtime: null,
  send: () => {},
  isLoading: false,
  status: '',
  lastResult: null,
  messages: [],
  clearMessages: () => {},
  cancel: () => {},
};

export const AgentContext = createContext<AgentContextValue>(DEFAULT_CONTEXT);

// ─── useAction ────────────────────────────────────────────────

export function useAction(
  name: string,
  description: string,
  parameters: Record<string, string>,
  handler: (args: Record<string, any>) => any,
): void {
  const { runtime: agentRuntime } = useContext(AgentContext);

  useEffect(() => {
    if (!agentRuntime) return;

    agentRuntime.registerAction({
      name,
      description,
      parameters,
      handler,
    });

    return () => {
      agentRuntime.unregisterAction(name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description]);
}

// ─── useAI ────────────────────────────────────────────────────

/**
 * Bridge hook — reads the parent <AIAgent>'s state.
 *
 * Must be used inside an <AIAgent> tree.
 *
 * ```tsx
 * <AIAgent showChatBar={false} apiKey="..." navRef={navRef}>
 *   <MyApp />
 * </AIAgent>
 *
 * // Inside any screen:
 * const { send, isLoading, status, lastResult } = useAI({ enableUIControl: false }); // knowledge-only for this screen
 * ```
 */
export function useAI(options?: {
  /** 
   * Dynamically override the global `enableUIControl` setting.
   * Useful to force "knowledge-only" mode for a specific screen without changing root layout props.
   */
  enableUIControl?: boolean;
  /**
   * Override the global `onResult` callback for tasks triggered from this hook.
   * Useful for navigating the user back to this specific screen after the AI finishes.
   */
  onResult?: (result: ExecutionResult) => void;
}) {
  const ctx = useContext(AgentContext);

  useEffect(() => {
    if (options?.enableUIControl !== undefined && ctx.runtime) {
      ctx.runtime.setUIControlOverride(options.enableUIControl);
      
      // Cleanup: revert to global config when unmounted
      return () => {
        ctx.runtime?.setUIControlOverride(undefined);
      };
    }
    return undefined;
  }, [options?.enableUIControl, ctx.runtime]);

  // Track the latest onResult callback in a ref to keep `send`'s identity perfectly stable.
  // This prevents infinite render loops if `send` is used as a dependency in child useEffects.
  const onResultRef = useRef(options?.onResult);
  useEffect(() => {
    onResultRef.current = options?.onResult;
  }, [options?.onResult]);

  const send = useCallback((message: string) => {
    ctx.send(message, { onResult: onResultRef.current });
  }, [ctx]);

  return {
    /** Send a message to the AI agent. */
    send,
    /** Whether the agent is currently executing. */
    isLoading: ctx.isLoading,
    /** Live status text (e.g. "Navigating to profile..."). */
    status: ctx.status,
    /** Result of the last completed execution. */
    lastResult: ctx.lastResult,
    /** The full conversation history. */
    messages: ctx.messages,
    /** Clear the conversation history. */
    clearMessages: ctx.clearMessages,
    /** Cancel the currently running task. The current step will complete before stopping. */
    cancel: ctx.cancel,
  };
}

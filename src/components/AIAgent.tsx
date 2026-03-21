/**
 * AIAgent — Root provider component for the AI agent.
 *
 * Wraps the app and provides:
 * - Fiber tree root ref for element auto-detection
 * - Navigation ref for auto-navigation
 * - Floating chat bar for user input
 * - Agent runtime context for useAction hooks
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { AgentRuntime } from '../core/AgentRuntime';
import { GeminiProvider } from '../providers/GeminiProvider';
import { AgentContext } from '../hooks/useAction';
import { AgentChatBar } from './AgentChatBar';
import { AgentOverlay } from './AgentOverlay';
import { logger } from '../utils/logger';
import { MCPBridge } from '../core/MCPBridge';
import type { AgentConfig, ExecutionResult, ToolDefinition, AgentStep } from '../core/types';

// ─── Context ───────────────────────────────────────────────────


// ─── Props ─────────────────────────────────────────────────────

interface AIAgentProps {
  /** Gemini API key */
  apiKey: string;
  /** Gemini model name */
  model?: string;
  /** Navigation container ref (from useNavigationContainerRef) */
  navRef?: any;
  /** UI language */
  language?: 'en' | 'ar';
  /** Max agent steps per request */
  maxSteps?: number;
  /** Show/hide the chat bar */
  showChatBar?: boolean;
  /** Children — the actual app */
  children: React.ReactNode;
  /** Callback when agent completes */
  onResult?: (result: ExecutionResult) => void;

  // ── Security (mirrors page-agent.js) ──────────────────────

  /** Refs of elements the AI must NOT interact with */
  interactiveBlacklist?: React.RefObject<any>[];
  /** If set, AI can ONLY interact with these elements */
  interactiveWhitelist?: React.RefObject<any>[];
  /** Called before each step */
  onBeforeStep?: (stepCount: number) => Promise<void> | void;
  /** Called after each step */
  onAfterStep?: (history: AgentStep[]) => Promise<void> | void;
  /** Called before task starts */
  onBeforeTask?: () => Promise<void> | void;
  /** Called after task completes */
  onAfterTask?: (result: ExecutionResult) => Promise<void> | void;
  /** Transform screen content before LLM sees it (for data masking) */
  transformScreenContent?: (content: string) => Promise<string> | string;
  /** Override or remove built-in tools (null = remove) */
  customTools?: Record<string, ToolDefinition | null>;
  /** Instructions to guide agent behavior */
  instructions?: {
    system?: string;
    getScreenInstructions?: (screenName: string) => string | undefined | null;
  };
  /** Delay between steps in ms */
  stepDelay?: number;
  /** WebSocket URL to companion MCP server bridge (e.g., ws://localhost:3101) */
  mcpServerUrl?: string;
  /** Expo Router instance (from useRouter()) */
  router?: {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
  };
  /** Expo Router pathname (from usePathname()) */
  pathname?: string;
}

// ─── Component ─────────────────────────────────────────────────

export function AIAgent({
  apiKey,
  model = 'gemini-2.5-flash',
  navRef,
  language = 'en',
  maxSteps = 10,
  showChatBar = true,
  children,
  onResult,
  // Security props
  interactiveBlacklist,
  interactiveWhitelist,
  onBeforeStep,
  onAfterStep,
  onBeforeTask,
  onAfterTask,
  transformScreenContent,
  customTools,
  instructions,
  stepDelay,
  mcpServerUrl,
  router,
  pathname,
}: AIAgentProps) {
  const rootViewRef = useRef<any>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

  // Ref-based resolver for ask_user — stays alive across renders
  const askUserResolverRef = useRef<((answer: string) => void) | null>(null);

  // ─── Create Runtime ──────────────────────────────────────────

  const config: AgentConfig = useMemo(() => ({
    apiKey,
    model,
    language,
    maxSteps,
    interactiveBlacklist,
    interactiveWhitelist,
    onBeforeStep,
    onAfterStep,
    onBeforeTask,
    onAfterTask,
    transformScreenContent,
    customTools,
    instructions,
    stepDelay,
    mcpServerUrl,
    router,
    pathname,
    onStatusUpdate: setStatusText,
    // Page-agent pattern: block the agent loop until user responds
    onAskUser: (question: string) => {
      return new Promise<string>((resolve) => {
        askUserResolverRef.current = resolve;
        // Show question in chat bar, allow user input
        setLastResult({ success: true, message: `❓ ${question}`, steps: [] });
        setIsThinking(false);
        setStatusText('');
      });
    },
  }), [
    apiKey, model, language, maxSteps,
    interactiveBlacklist, interactiveWhitelist,
    onBeforeStep, onAfterStep, onBeforeTask, onAfterTask,
    transformScreenContent, customTools, instructions, stepDelay,
    mcpServerUrl, router, pathname,
  ]);

  const provider = useMemo(() => new GeminiProvider(apiKey, model), [apiKey, model]);

  const runtime = useMemo(
    () => new AgentRuntime(provider, config, rootViewRef.current, navRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, config],
  );

  // Update refs when they change
  useEffect(() => {
    runtime.updateRefs(rootViewRef.current, navRef);
  }, [runtime, navRef]);

  // ─── MCP Bridge ──────────────────────────────────────────────

  useEffect(() => {
    if (!mcpServerUrl) return;

    logger.info('AIAgent', `Setting up MCP bridge at ${mcpServerUrl}`);
    const bridge = new MCPBridge(mcpServerUrl, runtime);

    return () => {
      bridge.destroy();
    };
  }, [mcpServerUrl, runtime]);

  // ─── Execute ──────────────────────────────────────────────────

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim()) return;

    logger.info('AIAgent', `User message: "${message}"`);

    // If there's a pending ask_user, resolve it instead of starting a new execution
    if (askUserResolverRef.current) {
      const resolver = askUserResolverRef.current;
      askUserResolverRef.current = null;
      setIsThinking(true);
      setStatusText('Processing your answer...');
      setLastResult(null);
      resolver(message);
      return;
    }

    // Normal execution — new task
    setIsThinking(true);
    setStatusText('Thinking...');
    setLastResult(null);

    try {
      // Ensure we have the latest Fiber tree ref
      runtime.updateRefs(rootViewRef.current, navRef);

      const result = await runtime.execute(message);

      setLastResult(result);
      onResult?.(result);

      logger.info('AIAgent', `Result: ${result.success ? '✅' : '❌'} ${result.message}`);
    } catch (error: any) {
      logger.error('AIAgent', 'Execution failed:', error);
      setLastResult({
        success: false,
        message: `Error: ${error.message}`,
        steps: [],
      });
    } finally {
      setIsThinking(false);
      setStatusText('');
    }
  }, [runtime, navRef, onResult]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <AgentContext.Provider value={runtime}>
      <View ref={rootViewRef} style={styles.root} collapsable={false}>
        {children}
      </View>

      {/* Overlay (shown while thinking) */}
      <AgentOverlay visible={isThinking} statusText={statusText} />

      {/* Chat bar */}
      {showChatBar && (
        <AgentChatBar
          onSend={handleSend}
          isThinking={isThinking}
          lastResult={lastResult}
          language={language}
          onDismiss={() => setLastResult(null)}
        />
      )}
    </AgentContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

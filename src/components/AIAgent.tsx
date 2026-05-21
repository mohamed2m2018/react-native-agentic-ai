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
import { VoiceService } from '../services/VoiceService';
import { AudioInputService } from '../services/AudioInputService';
import { AudioOutputService } from '../services/AudioOutputService';
import type { AgentConfig, AgentMode, ExecutionResult, ToolDefinition, AgentStep, TokenUsage } from '../core/types';

// ─── Context ───────────────────────────────────────────────────
console.log('🚀 AIAgent.tsx MODULE LOADED');

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
  /** Enable voice mode (requires expo-av) */
  enableVoice?: boolean;
  /** Enable live mode (requires expo-av + react-native-view-shot) */
  enableLive?: boolean;
  /** Called after each step with token usage data */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** Enable SDK debug logging (disabled by default) */
  debug?: boolean;
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
  enableVoice = false,
  enableLive = false,
  onTokenUsage,
  debug = false,
}: AIAgentProps) {
  // Configure logger based on debug prop
  React.useEffect(() => {
    console.log('[AIAgent] DEBUG PROP =', debug, '— enabling logger');
    logger.setEnabled(debug);
    if (debug) {
      logger.info('AIAgent', '🔧 Debug logging enabled');
    }
  }, [debug]);

  const rootViewRef = useRef<any>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

  // ─── Voice/Live Mode State ──────────────────────────────────
  const [mode, setMode] = useState<AgentMode>('text');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  const voiceServiceRef = useRef<VoiceService | null>(null);
  const audioInputRef = useRef<AudioInputService | null>(null);
  const audioOutputRef = useRef<AudioOutputService | null>(null);

  // Compute available modes from props
  const availableModes: AgentMode[] = useMemo(() => {
    const modes: AgentMode[] = ['text'];
    if (enableVoice) modes.push('voice');
    if (enableLive) modes.push('live');
    logger.info('AIAgent', `Available modes: ${modes.join(', ')}`);
    return modes;
  }, [enableVoice, enableLive]);

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
    onTokenUsage,
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
    mcpServerUrl, router, pathname, onTokenUsage,
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

  // ─── Voice/Live Service Initialization ──────────────────────

  // Initialize voice services when mode changes to voice or live
  useEffect(() => {
    if (mode === 'text') {
      logger.info('AIAgent', 'Text mode — skipping voice service init');
      return;
    }

    logger.info('AIAgent', `Mode changed to "${mode}" — initializing voice services...`);

    // Create VoiceService with runtime's built-in tools (navigate, tap, type, done, etc.)
    if (!voiceServiceRef.current) {
      logger.info('AIAgent', 'Creating VoiceService...');
      const runtimeTools = runtime.getTools();
      logger.info('AIAgent', `Registering ${runtimeTools.length} tools with VoiceService: ${runtimeTools.map(t => t.name).join(', ')}`);
      voiceServiceRef.current = new VoiceService({
        apiKey,
        systemPrompt: instructions?.system,
        tools: runtimeTools,
      });
      logger.info('AIAgent', 'VoiceService created with tools');
    }

    // Create AudioOutputService if not exists
    if (!audioOutputRef.current) {
      logger.info('AIAgent', 'Creating AudioOutputService...');
      audioOutputRef.current = new AudioOutputService({
        onError: (err) => logger.error('AIAgent', `AudioOutput error: ${err}`),
      });
      audioOutputRef.current.initialize().then((ok) => {
        logger.info('AIAgent', `AudioOutputService initialized: ${ok}`);
      });
    }

    // Create AudioInputService if not exists
    if (!audioInputRef.current) {
      logger.info('AIAgent', 'Creating AudioInputService...');
      audioInputRef.current = new AudioInputService({
        // Default 16kHz — Gemini Live API input standard
        onAudioChunk: (chunk) => {
          logger.debug('AIAgent', `Mic chunk: ${chunk.length} chars`);
          voiceServiceRef.current?.sendAudio(chunk);
        },
        onError: (err) => logger.error('AIAgent', `AudioInput error: ${err}`),
        onPermissionDenied: () => logger.warn('AIAgent', 'Mic permission denied by user'),
      });
    }

    // Connect VoiceService
    logger.info('AIAgent', 'Connecting VoiceService...');
    voiceServiceRef.current.connect({
      onAudioResponse: (audio) => {
        logger.info('AIAgent', `Received audio response (${audio.length} chars)`);
        setIsAISpeaking(true);
        audioOutputRef.current?.enqueue(audio);
      },
      onStatusChange: (status) => {
        logger.info('AIAgent', `Voice status: ${status}`);
        const connected = status === 'connected';
        setIsVoiceConnected(connected);
        if (connected) {
          logger.info('AIAgent', '✅ VoiceService connected — auto-starting mic...');
          // Auto-start mic streaming once WebSocket is ready
          audioInputRef.current?.start().then((ok) => {
            if (ok) {
              setIsMicActive(true);
              logger.info('AIAgent', '🎙️ Mic auto-started after connection');
            }
          });
          // Start live mode — push screen context (Fiber tree + routes) to Gemini
          // This gives the voice AI the same screen awareness as text mode
          logger.info('AIAgent', '📡 Starting live mode (screen context streaming)...');
          runtime.startLiveMode(voiceServiceRef.current!, 2000);
        }
      },
      onTranscript: (text, isFinal, role) => {
        logger.info('AIAgent', `Transcript [${role}] (final=${isFinal}): "${text}"`);
      },
      onToolCall: async (toolCall) => {
        logger.info('AIAgent', `Voice tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
        // Execute the tool via AgentRuntime and send result back to Gemini
        const result = await runtime.executeTool(toolCall.name, toolCall.args);
        logger.info('AIAgent', `Voice tool result: ${result}`);
        voiceServiceRef.current?.sendFunctionResponse(toolCall.name, toolCall.id, { result });
      },
      onError: (err) => {
        logger.error('AIAgent', `VoiceService error: ${err}`);
      },
      onTurnComplete: () => {
        logger.info('AIAgent', 'AI turn complete');
        setIsAISpeaking(false);
      },
    });

    // Cleanup on mode change back to text
    return () => {
      logger.info('AIAgent', `Cleaning up voice services (leaving "${mode}" mode)`);
      runtime.stopLiveMode();
      voiceServiceRef.current?.disconnect();
      voiceServiceRef.current = null; // Ensure fresh instance on next connect
      audioInputRef.current?.stop();
      setIsMicActive(false);
      setIsAISpeaking(false);
      setIsVoiceConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiKey, runtime]);

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
          availableModes={availableModes}
          mode={mode}
          onModeChange={(newMode) => {
            logger.info('AIAgent', `Mode change: ${mode} → ${newMode}`);
            setMode(newMode);
          }}
          isMicActive={isMicActive}
          isSpeakerMuted={isSpeakerMuted}
          isLiveActive={isLiveActive}
          isAISpeaking={isAISpeaking}
          isVoiceConnected={isVoiceConnected}
          onMicToggle={(active) => {
            if (active && !isVoiceConnected) {
              logger.warn('AIAgent', 'Cannot toggle mic — VoiceService not connected yet');
              return;
            }
            logger.info('AIAgent', `Mic toggle: ${active ? 'ON' : 'OFF'}`);
            setIsMicActive(active);
            if (active) {
              logger.info('AIAgent', 'Starting AudioInput...');
              audioInputRef.current?.start().then((ok) => {
                logger.info('AIAgent', `AudioInput start result: ${ok}`);
              });
            } else {
              logger.info('AIAgent', 'Stopping AudioInput...');
              audioInputRef.current?.stop();
            }
          }}
          onSpeakerToggle={(muted) => {
            logger.info('AIAgent', `Speaker toggle: ${muted ? 'MUTED' : 'UNMUTED'}`);
            setIsSpeakerMuted(muted);
            if (muted) {
              audioOutputRef.current?.mute();
            } else {
              audioOutputRef.current?.unmute();
            }
          }}
          onLiveToggle={(active) => {
            logger.info('AIAgent', `Live toggle: ${active ? 'ON' : 'OFF'}`);
            setIsLiveActive(active);
          }}
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

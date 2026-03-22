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
import { buildVoiceSystemPrompt } from '../core/systemPrompt';
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
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  const voiceServiceRef = useRef<VoiceService | null>(null);
  const audioInputRef = useRef<AudioInputService | null>(null);
  const audioOutputRef = useRef<AudioOutputService | null>(null);
  const toolLockRef = useRef<boolean>(false);
  const userHasSpokenRef = useRef<boolean>(false);
  const lastScreenContextRef = useRef<string>('');
  const screenPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute available modes from props
  const availableModes: AgentMode[] = useMemo(() => {
    const modes: AgentMode[] = ['text'];
    if (enableVoice) modes.push('voice');
    logger.info('AIAgent', `Available modes: ${modes.join(', ')}`);
    return modes;
  }, [enableVoice]);

  // Ref-based resolver for ask_user — stays alive across renders
  const askUserResolverRef = useRef<((answer: string) => void) | null>(null);

  // ─── Create Runtime ──────────────────────────────────────────

  const config: AgentConfig = useMemo(() => ({
    apiKey,
    model,
    language: 'en',
    maxSteps,
    interactiveBlacklist,
    interactiveWhitelist,
    onBeforeStep,
    onAfterStep,
    onBeforeTask,
    onAfterTask,
    customTools: mode === 'voice' ? { ...customTools, ask_user: null } : customTools,
    instructions,
    stepDelay,
    mcpServerUrl,
    router,
    pathname,
    onStatusUpdate: setStatusText,
    onTokenUsage,
    // Page-agent pattern: block the agent loop until user responds
    onAskUser: mode === 'voice' ? undefined : ((question: string) => {
      return new Promise<string>((resolve) => {
        askUserResolverRef.current = resolve;
        // Show question in chat bar, allow user input
        setLastResult({ success: true, message: `❓ ${question}`, steps: [] });
        setIsThinking(false);
        setStatusText('');
      });
    }),
  }), [
    mode, apiKey, model, maxSteps,
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

    // Track async audio output init — mic MUST wait for this
    let audioOutputInitPromise: Promise<void> = Promise.resolve();

    // Create VoiceService with runtime's built-in tools (navigate, tap, type, done, etc.)
    if (!voiceServiceRef.current) {
      logger.info('AIAgent', 'Creating VoiceService...');
      const runtimeTools = runtime.getTools();
      logger.info('AIAgent', `Registering ${runtimeTools.length} tools with VoiceService: ${runtimeTools.map(t => t.name).join(', ')}`);
      // Use voice-adapted system prompt — same core rules as text mode
      // but without agent-loop directives that trigger autonomous actions
      const voicePrompt = buildVoiceSystemPrompt('en', instructions?.system);
      logger.info('AIAgent', `📝 Voice system prompt (${voicePrompt.length} chars):\n${voicePrompt}`);
      voiceServiceRef.current = new VoiceService({
        apiKey,
        systemPrompt: voicePrompt,
        tools: runtimeTools,
        language: 'en',
      });
      logger.info('AIAgent', `VoiceService created with ${runtimeTools.length} tools: ${runtimeTools.map(t => t.name).join(', ')}`);
    }

    // Create AudioOutputService if not exists
    if (!audioOutputRef.current) {
      logger.info('AIAgent', 'Creating AudioOutputService...');
      audioOutputRef.current = new AudioOutputService({
        onError: (err) => logger.error('AIAgent', `AudioOutput error: ${err}`),
      });
      // IMPORTANT: Must await initialize() BEFORE starting mic.
      // initialize() calls setAudioSessionOptions which reconfigures the
      // audio hardware. If the mic starts before this finishes, the native
      // audio session change kills the recorder's device handle.
      audioOutputInitPromise = audioOutputRef.current.initialize().then((ok) => {
        logger.info('AIAgent', `AudioOutputService initialized: ${ok}`);
      });
    }

    // Create AudioInputService if not exists
    if (!audioInputRef.current) {
      logger.info('AIAgent', 'Creating AudioInputService...');
      audioInputRef.current = new AudioInputService({
        // Default 16kHz — Gemini Live API input standard
        onAudioChunk: (chunk) => {
          logger.info('AIAgent', `🎤 onAudioChunk: ${chunk.length} chars, voiceService=${!!voiceServiceRef.current}, connected=${voiceServiceRef.current?.isConnected}`);
          voiceServiceRef.current?.sendAudio(chunk);
        },
        onError: (err) => logger.error('AIAgent', `AudioInput error: ${err}`),
        onPermissionDenied: () => logger.warn('AIAgent', 'Mic permission denied by user'),
      });
    }

    // Connect VoiceService (async — SDK's ai.live.connect returns a Promise)
    logger.info('AIAgent', 'Connecting VoiceService...');
    void voiceServiceRef.current.connect({
      onAudioResponse: (audio) => {
        logger.info('AIAgent', `🔊 Audio response: ${audio.length} chars, audioOutputRef=${!!audioOutputRef.current}`);
        setIsAISpeaking(true);
        if (!audioOutputRef.current) {
          logger.error('AIAgent', '❌ audioOutputRef.current is NULL — cannot play audio!');
          return;
        }
        audioOutputRef.current.enqueue(audio);
      },
      onStatusChange: (status) => {
        logger.info('AIAgent', `Voice status: ${status}`);
        const connected = status === 'connected';
        setIsVoiceConnected(connected);
        if (connected) {
          logger.info('AIAgent', '✅ VoiceService connected — waiting for audio session init before starting mic...');
          // Wait for audio session config to finish BEFORE starting mic.
          // If mic starts while setAudioSessionOptions is in flight,
          // the native audio device gets killed (AudioDeviceStop error).
          audioOutputInitPromise.then(() => {
            logger.info('AIAgent', '✅ Audio session ready — starting mic now...');
            audioInputRef.current?.start().then((ok) => {
              if (ok) {
                setIsMicActive(true);
                logger.info('AIAgent', '🎙️ Mic auto-started after connection');
              }
            });
          });
        }

        // Handle unexpected disconnection — auto-reconnect ONLY if not intentional
        if (
          status === 'disconnected' &&
          mode === 'voice' &&
          voiceServiceRef.current &&
          !voiceServiceRef.current.intentionalDisconnect
        ) {
          // Stop mic & audio immediately so user isn't stuck
          audioInputRef.current?.stop();
          audioOutputRef.current?.stop();
          setIsMicActive(false);
          setIsAISpeaking(false);

          logger.warn('AIAgent', '⚠️ Voice connection dropped unexpectedly — attempting reconnect in 2s...');

          // Auto-reconnect after short delay
          setTimeout(() => {
            if (
              mode === 'voice' &&
              voiceServiceRef.current &&
              !voiceServiceRef.current.intentionalDisconnect &&
              voiceServiceRef.current.lastCallbacks
            ) {
              logger.info('AIAgent', '🔄 Reconnecting VoiceService...');
              void voiceServiceRef.current.connect(voiceServiceRef.current.lastCallbacks);
            }
          }, 2000);
        }
      },
      onTranscript: (text, isFinal, role) => {
        logger.info('AIAgent', `Transcript [${role}] (final=${isFinal}): "${text}"`);
        if (role === 'user') {
          userHasSpokenRef.current = true;
        }
      },
      onSetupComplete: () => {
        logger.info('AIAgent', '✅ SDK setup complete — sending initial screen context now');
        userHasSpokenRef.current = false;
        const initialContext = runtime.getScreenContext();
        lastScreenContextRef.current = initialContext; // Seed for screen change detection
        const passiveContext = `[SYSTEM CONTEXT — THIS IS NOT A USER REQUEST. DO NOT RESPOND. DO NOT NAVIGATE. DO NOT CALL ANY TOOLS. DO NOT SPEAK. Just silently read and memorize this screen layout. You will use it when the user speaks their first voice command.]\n\n${initialContext}`;
        logger.info('AIAgent', `📡 Initial screen context (${passiveContext.length} chars):\n${passiveContext}`);
        voiceServiceRef.current?.sendScreenContext(passiveContext);
        logger.info('AIAgent', '📡 Initial screen context sent (turnComplete=true)');
      },
      onToolCall: async (toolCall) => {
        logger.info('AIAgent', `🔧 Voice tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)}) [id=${toolCall.id}]`);

        // Code-level gate: reject tool calls before the user has spoken.
        // The model sometimes auto-navigates on receiving screen context.
        if (!userHasSpokenRef.current) {
          logger.warn('AIAgent', `🚫 Rejected tool call ${toolCall.name} — user hasn't spoken yet`);
          voiceServiceRef.current?.sendFunctionResponse(toolCall.name, toolCall.id, {
            result: 'Action rejected: wait for the user to speak before performing any actions.',
          });
          return;
        }

        // CRITICAL: Gate audio input during tool execution.
        // The Gemini Live API crashes (code 1008) if sendRealtimeInput
        // (audio) is called while a tool call is pending. Stop the mic
        // before executing the tool and resume after the response is sent.
        audioInputRef.current?.stop();
        logger.info('AIAgent', `🔇 Mic paused for tool execution: ${toolCall.name}`);

        // One-tool-at-a-time enforcement (mirrors text mode's line 752).
        if (toolLockRef.current) {
          logger.warn('AIAgent', `⏳ Tool locked — waiting for previous tool to finish before executing ${toolCall.name}`);
          while (toolLockRef.current) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        toolLockRef.current = true;

        try {
          // Execute the tool via AgentRuntime and send result back to Gemini
          const result = await runtime.executeTool(toolCall.name, toolCall.args);
          logger.info('AIAgent', `🔧 Tool result for ${toolCall.name}: ${result}`);

          // Step delay — matches text mode's stepDelay (line 820 in AgentRuntime).
          await new Promise(resolve => setTimeout(resolve, 300));

          // Include updated screen context IN the tool response
          const updatedContext = runtime.getScreenContext();
          lastScreenContextRef.current = updatedContext; // Sync with poll tracker
          logger.info('AIAgent', `📡 Updated screen context after ${toolCall.name} (${updatedContext.length} chars):\n${updatedContext}`);
          const enrichedResult = `${result}\n\n<updated_screen>\n${updatedContext}\n</updated_screen>`;
          logger.info('AIAgent', `📡 Enriched tool response (${enrichedResult.length} chars):\n${enrichedResult}`);

          voiceServiceRef.current?.sendFunctionResponse(toolCall.name, toolCall.id, { result: enrichedResult });
          logger.info('AIAgent', `📡 Tool response sent for ${toolCall.name} [id=${toolCall.id}]`);
        } finally {
          toolLockRef.current = false;
          // Resume mic after tool response is sent
          if (voiceServiceRef.current?.isConnected) {
            audioInputRef.current?.start().then((ok) => {
              if (ok) {
                setIsMicActive(true);
                logger.info('AIAgent', `🔊 Mic resumed after tool execution: ${toolCall.name}`);
              }
            });
          }
        }
      },
      onError: (err) => {
        logger.error('AIAgent', `VoiceService error: ${err}`);
        // Stop mic & audio on error to prevent stale state
        audioInputRef.current?.stop();
        audioOutputRef.current?.stop();
        setIsMicActive(false);
        setIsAISpeaking(false);
      },
      onTurnComplete: () => {
        logger.info('AIAgent', 'AI turn complete');
        setIsAISpeaking(false);
        // No cool-down or echo gate needed — hardware AEC handles everything.
        // Mic stays active and ready for the next voice command immediately.
      },
    });

    // ─── Screen Change Detection ───────────────────────────────
    // Poll the Fiber tree every 5s and resend context if the screen meaningfully changed.
    // This gives voice mode the same screen-awareness as text mode's per-step re-read.
    const SCREEN_POLL_INTERVAL = 5000;
    const MIN_DIFF_RATIO = 0.05; // Ignore changes smaller than 5% of total length (animation flicker)

    screenPollIntervalRef.current = setInterval(() => {
      if (!voiceServiceRef.current?.isConnected) return;
      // Skip during tool execution — the enriched tool response handles that
      if (toolLockRef.current) {
        logger.debug('AIAgent', '🔄 Screen poll skipped — tool lock active');
        return;
      }

      try {
        const currentContext = runtime.getScreenContext();
        if (currentContext === lastScreenContextRef.current) return; // No change

        // Check if the change is meaningful (not just animation/cursor flicker)
        const lastLen = lastScreenContextRef.current.length;
        const diff = Math.abs(currentContext.length - lastLen);
        const diffRatio = lastLen > 0 ? diff / lastLen : 1;

        if (diffRatio < MIN_DIFF_RATIO) {
          logger.debug('AIAgent', `🔄 Screen poll: minor change ignored (${diff} chars, ${(diffRatio * 100).toFixed(1)}% < ${MIN_DIFF_RATIO * 100}% threshold)`);
          return;
        }

        logger.info('AIAgent', `🔄 Screen change detected (${lastLen} → ${currentContext.length} chars, ${(diffRatio * 100).toFixed(1)}% diff)`);
        lastScreenContextRef.current = currentContext;
        const passiveUpdate = `[SCREEN UPDATE — The UI has changed. Here is the current screen layout. This is not a user request — do not act unless the user asks.]\n\n${currentContext}`;
        voiceServiceRef.current?.sendScreenContext(passiveUpdate);
        logger.info('AIAgent', '🔄 Updated screen context sent to voice model');
      } catch (err) {
        logger.warn('AIAgent', `🔄 Screen poll error: ${err}`);
      }
    }, SCREEN_POLL_INTERVAL);

    // Cleanup on mode change back to text
    return () => {
      logger.info('AIAgent', `Cleaning up voice services (leaving "${mode}" mode)`);
      // Stop screen change polling
      if (screenPollIntervalRef.current) {
        clearInterval(screenPollIntervalRef.current);
        screenPollIntervalRef.current = null;
        logger.info('AIAgent', '🔄 Screen poll stopped');
      }
      lastScreenContextRef.current = '';
      voiceServiceRef.current?.disconnect();
      voiceServiceRef.current = null;
      audioInputRef.current?.stop();
      setIsMicActive(false);
      setIsAISpeaking(false);
      setIsVoiceConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiKey, runtime, instructions]);

  // ─── Stop Voice Session (full cleanup) ─────────────────────

  const stopVoiceSession = useCallback(() => {
    logger.info('AIAgent', '🛑 Stopping voice session (full cleanup)...');
    // 1. Stop mic input
    audioInputRef.current?.stop();
    // 2. Stop audio output (clear queued chunks)
    audioOutputRef.current?.stop();
    // 3. Disconnect WebSocket
    voiceServiceRef.current?.disconnect();
    voiceServiceRef.current = null;
    // 4. Reset state
    setIsMicActive(false);
    setIsAISpeaking(false);
    setIsVoiceConnected(false);
    // 6. Switch back to text mode (triggers cleanup effect naturally)
    setMode('text');
    logger.info('AIAgent', '🛑 Voice session fully stopped');
  }, [runtime]);

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

        {/* Overlay (shown while thinking) */}
        <AgentOverlay visible={isThinking} statusText={statusText} />

        {/* Chat bar */}
        {showChatBar && (
          <AgentChatBar
            onSend={handleSend}
            isThinking={isThinking}
            lastResult={lastResult}
            language={'en'}
            onDismiss={() => setLastResult(null)}
            availableModes={availableModes}
            mode={mode}
            onModeChange={(newMode) => {
              logger.info('AIAgent', `Mode change: ${mode} → ${newMode}`);
              setMode(newMode);
            }}
            isMicActive={isMicActive}
            isSpeakerMuted={isSpeakerMuted}
            isAISpeaking={isAISpeaking}
            onStopSession={stopVoiceSession}
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

          />
        )}
      </View>
    </AgentContext.Provider>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

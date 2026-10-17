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
import {
  View,
  StyleSheet,
  InteractionManager,
  Platform,
  NativeModules,
} from 'react-native';
import { AgentRuntime } from '../core/AgentRuntime';
import { ReactNativePlatformAdapter } from '../core/ReactNativePlatformAdapter';
import { dataRegistry } from '../core/DataRegistry';
import { captureWireframe } from '../core/FiberTreeWalker';
import { humanizeScreenName } from '../utils/humanizeScreenName';
import { createProvider } from '../providers/ProviderFactory';
import { AgentContext } from '../hooks/useAction';
import { AgentChatBar } from './AgentChatBar';
import { AgentOverlay } from './AgentOverlay';
import { useAIConsent } from './AIConsentDialog';
import type { AIConsentConfig } from './AIConsentDialog';
import { FloatingOverlayWrapper } from './FloatingOverlayWrapper';
import type { FloatingOverlayWrapperHandle } from './FloatingOverlayWrapper';
import { logger } from '../utils/logger';
import { buildVoiceSystemPrompt } from '../core/systemPrompt';
import { MCPBridge } from '../core/MCPBridge';
import { buildMCPRuntimeConfig } from '../core/mcpRuntimeConfig';
import { VoiceService } from '../services/VoiceService';
import { AudioInputService } from '../services/AudioInputService';
import { AudioOutputService } from '../services/AudioOutputService';
import { TelemetryService } from '../services/telemetry';
import type { TelemetryEvent } from '../services/telemetry';
import {
  extractTouchTargetMetadata,
  checkRageClick,
} from '../services/telemetry/TouchAutoCapture';
import { initDeviceId } from '../services/telemetry/device';
import type {
  AgentConfig,
  AgentMode,
  ExecutionResult,
  ToolDefinition,
  AgentStep,
  TokenUsage,
  KnowledgeBaseConfig,
  ChatBarTheme,
  AIMessage,
  AIProviderName,
  ScreenMap,
  ProactiveHelpConfig,
  InteractionMode,
  CustomerSuccessConfig,
  OnboardingConfig,
  ConversationSummary,
  ConversationStore,
  AgentTraceEvent,
  VerifierConfig,
  SupportStyle,
  ActionSafetyConfig,
  ToolStabilizationConfig,
} from '../core/types';
import { AgentErrorBoundary } from './AgentErrorBoundary';
import { HighlightOverlay } from './HighlightOverlay';
import { IdleDetector } from '../core/IdleDetector';
import { ProactiveHint } from './ProactiveHint';
import { createEscalateTool } from '../support/escalateTool';
import { QuickActionsSheet } from '../support/QuickActionsSheet';
import type { SupportModeConfig, CSATRating, EscalationUserContext } from '../support/types';
import { CSATSurvey } from '../support/CSATSurvey';
import * as ConversationService from '../services/ConversationService';
import {
  createAIMessage,
  createImageNode,
  normalizeExecutionResult,
  normalizeRichContent,
} from '../core/richContent';
import type { UserImage } from '../core/types';
import { RichUIProvider } from './rich-content/RichUIContext';
import type { BlockActionHandler } from '../core/ActionBridge';
import { ActionBridgeProvider } from '../core/ActionBridge';
import type { RichUIThemeOverride } from '../theme/RichUITheme';
import type { BlockDefinition } from '../core/types';
import {
  ActionCardDefinition,
  ComparisonCardDefinition,
  FactCardDefinition,
  FormCardDefinition,
  ProductCardDefinition,
} from './blocks';

type AndroidWindowMetrics = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const UI_ACTION_TOOL_NAMES = new Set([
  'tap',
  'type',
  'scroll',
  'navigate',
  'long_press',
  'adjust_slider',
  'select_picker',
  'set_date',
  'dismiss_keyboard',
]);

const VOICE_PERMISSION_TOOL_NAME = 'ask_user_permission_voice_mode';
const VOICE_OUTPUT_SAMPLE_RATE = 24000;
const VOICE_OUTPUT_BYTES_PER_SAMPLE = 2;
const VOICE_PLAYBACK_MIN_CHUNK_MS = 60;
const VOICE_PLAYBACK_DRAIN_GRACE_MS = 650;
const VOICE_PERMISSION_TOOL: ToolDefinition = {
  name: VOICE_PERMISSION_TOOL_NAME,
  description:
    'Voice mode only. Ask the user for explicit permission before performing an app action. This shows Allow and Don’t Allow buttons and waits for the user to tap one.',
  parameters: {
    question: {
      type: 'string',
      description:
        'Short permission question to show to the user, for example: "I can open Profile. May I proceed?"',
      required: true,
    },
  },
  execute: async () =>
    'Voice permission requests are handled directly by the voice UI.',
};

function cleanVoiceTranscript(text: string): string {
  return text
    .replace(/<ctrl\d+>/gi, '')
    .replace(/(?:<|\[|\()(?:noise|silence|inaudible|music|laughs?|applause|crosstalk|background noise)(?:>|\]|\))/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSuppressVoiceTranscript(
  text: string,
  role: 'user' | 'model'
): boolean {
  const normalized = text.trim();
  if (!normalized) return true;
  if (role !== 'model') return false;

  const lower = normalized.toLowerCase();
  const bareToken = lower.replace(/^[\s"'`(){}\[\].,!?:;]+|[\s"'`(){}\[\].,!?:;]+$/g, '');
  return (
    bareToken === 'done' ||
    lower === 'ask_tool' ||
    lower.includes(VOICE_PERMISSION_TOOL_NAME) ||
    lower.includes('function_call') ||
    lower.includes('tool_call') ||
    lower.includes('tool call') ||
    /^done\s*[\({]/.test(lower) ||
    /^ask[_\s-]?tool\b/.test(lower)
  );
}

function buildVoiceActionPermissionQuestion(
  toolName: string,
  args: Record<string, any>
): string {
  if (toolName === 'navigate' && typeof args.screen === 'string' && args.screen.trim()) {
    return `I can open ${args.screen.trim()}. May I proceed?`;
  }
  if (toolName === 'tap') {
    return 'I need to tap something in the app to continue. May I proceed?';
  }
  if (toolName === 'type') {
    return 'I need to type into the app to continue. May I proceed?';
  }
  if (toolName === 'scroll') {
    return 'I need to scroll the app to continue. May I proceed?';
  }
  return 'I need permission to interact with the app. May I proceed?';
}

function estimateVoiceOutputDurationMs(base64Audio: string): number {
  const compact = base64Audio.replace(/\s+/g, '');
  if (!compact) return 0;
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
  const sampleCount = Math.floor(byteLength / VOICE_OUTPUT_BYTES_PER_SAMPLE);
  if (sampleCount <= 0) return 0;
  return (sampleCount / VOICE_OUTPUT_SAMPLE_RATE) * 1000;
}

// ─── Context ───────────────────────────────────────────────────

let discoveryTooltipSeenInSession = false;
let onboardingCompletedInSession = false;

function sanitizeWireframeScreenshot(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const base64 = trimmed.startsWith('data:')
    ? trimmed.split(',')[1] ?? ''
    : trimmed;

  return base64.length > 0 ? base64 : null;
}

function resolveRouteKeyFromPath(path: string | null | undefined): string {
  if (!path) return '';

  let route = path;
  route = route.replace(/\([^)]+\)\//g, '');
  route = route.replace(/^\/|\/$/g, '');

  if (!route) return 'index';
  if (route.includes('_layout') || route.includes('[...')) return '';
  if (route.endsWith('/index')) {
    route = route.replace(/\/index$/, '');
  }
  if (!route) return 'index';

  const segments = route
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/\[([^\]]+)\]/g, '$1'));

  return segments[segments.length - 1] || 'index';
}

async function captureHeatmapScreenshot(
  rootView: unknown,
): Promise<string | null> {
  try {
    if (!rootView) return null;
    if (!(NativeModules as any)?.RNViewShot) return null;

    const viewShot = require('react-native-view-shot');
    const captureRef = viewShot.captureRef || viewShot.default?.captureRef;
    if (!captureRef || typeof captureRef !== 'function') return null;

    const raw = await captureRef(rootView, {
      format: 'jpg',
      quality: 0.28,
      result: 'base64',
    });

    return sanitizeWireframeScreenshot(raw);
  } catch {
    return null;
  }
}

// ─── Props ─────────────────────────────────────────────────────

interface AIAgentProps {
  /**
   * API key (for local prototyping only).
   * Do not ship API keys in your production app bundle.
   */
  apiKey?: string;
  /**
   * Which LLM provider to use for text mode.
   * Default: 'gemini'
   */
  provider?: AIProviderName;
  /**
   * The URL of your secure backend proxy (for production).
   * Routes all Gemini API traffic through your server.
   */
  proxyUrl?: string;
  /**
   * Headers to send to your backend proxy (e.g., auth tokens).
   */
  proxyHeaders?: Record<string, string>;
  /**
   * Optional specific URL for Voice Mode (WebSockets).
   * If voiceProxyUrl isn't provided, it safely falls back to using proxyUrl for everything.
   */
  voiceProxyUrl?: string;
  /**
   * Optional specific headers for voiceProxyUrl.
   */
  voiceProxyHeaders?: Record<string, string>;
  /** LLM model name (provider-specific) */
  model?: string;
  /** Support personality preset, used only when supportMode.enabled is true. Default: 'warm-concise'. */
  supportStyle?: SupportStyle;
  /** Optional outcome verifier configuration for critical actions. */
  verifier?: VerifierConfig;
  /**
   * Semantic guardrails for generic app actions. The runtime remains the final
   * authority and uses the optional classifier to allow, ask, or block.
   */
  actionSafety?: ActionSafetyConfig;
  /** UI stabilization after tool actions without a fixed post-tool sleep. */
  toolStabilization?: ToolStabilizationConfig;
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

  // ── Security ──────────────────────

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
  /** Enable web search grounding — Gemini uses Google Search, OpenAI uses web_search_preview. Text mode only. Default: true. */
  enableWebSearch?: boolean;
  /** Called after each step with token usage data */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** Enable SDK debug logging (disabled by default) */
  debug?: boolean;
  /**
   * Domain knowledge the AI can query via the query_knowledge tool.
   * Pass a static KnowledgeEntry[] or a { retrieve(query, screen) } function
   * (for example one that calls your own search API).
   */
  knowledgeBase?: KnowledgeBaseConfig;
  /** Max token budget for knowledge retrieval (default: 2000) */
  knowledgeMaxTokens?: number;
  /**
   * Enable or disable UI control (tap, type, navigate).
   * When false, the AI operates as a knowledge-only assistant.
   * Default: true
   */
  enableUIControl?: boolean;
  /**
   * Quick accent color for the chat bar.
   * Tints the FAB, send button, and active states.
   * Overridden by theme.primaryColor if both are provided.
   */
  accentColor?: string;
  /**
   * Full theme customization for the chat bar popup.
   * Overrides accentColor for any specified key.
   */
  theme?: ChatBarTheme;
  /** Global rich blocks available to chat and zone rendering. */
  blocks?: Array<BlockDefinition | React.ComponentType<any>>;
  /** Rich UI token overrides for built-in blocks and rich rendering. */
  richUITheme?: RichUIThemeOverride;
  /** Optional per-surface rich UI token overrides. */
  richUISurfaceThemes?: Partial<Record<'chat' | 'zone' | 'support', RichUIThemeOverride>>;
  /** App-defined action handlers for interactive rich blocks. */
  blockActionHandlers?: Record<string, BlockActionHandler>;
  /**
   * Pre-generated screen map from `npx react-native-ai-agent generate-map`.
   * Gives the AI knowledge of all screens, their content, and navigation chains.
   */
  screenMap?: ScreenMap;
  /**
   * Maximum total tokens (prompt + completion) allowed per task.
   * The agent loop auto-stops when this budget is exceeded.
   */
  maxTokenBudget?: number;
  /**
   * Maximum estimated cost (USD) allowed per task.
   * The agent loop auto-stops when this budget is exceeded.
   */
  maxCostUSD?: number;

  /**
   * Whether to include the screen map in the AI prompt.
   * Set to `false` to disable navigation intelligence without removing the `screenMap` prop.
   * @default true
   */
  useScreenMap?: boolean;
  /** Whether to surface native alert buttons as interactive elements to the AI. */
  interceptNativeAlerts?: boolean;

  // ── Events & history (your backend) ──

  /**
   * Receives every SDK event (screen views, agent steps, taps, escalations,
   * ratings, …). Forward them to Segment, Amplitude or your own API.
   * Event tracking is off when this is not set.
   */
  onEvent?: (event: TelemetryEvent) => void;
  /**
   * Persists chat history in your own storage so users can browse and resume
   * past conversations. Without it, history lives in memory for the session.
   */
  conversationStore?: ConversationStore;

  /**
   * Proactive agent configuration (detects user hesitation)
   */
  proactiveHelp?: ProactiveHelpConfig;

  // ── Support Configuration ────────────

  /**
   * Full support mode configuration — greeting, quick actions, escalation, CSAT.
   * When quickActions.enabled is true, a self-service help screen appears before
   * the AI chat, allowing users to browse categorized Q&A at zero LLM cost.
   */
  supportMode?: SupportModeConfig;

  /**
   * Identity of the logged-in user. Passed to supportMode.escalation.onEscalate
   * and to conversationStore so you can link conversations to your users.
   */
  userContext?: EscalationUserContext;

  /**
   * Controls how the agent handles app actions.
   * 'companion': Screen-aware guidance only. AI can read the current screen and tell
   * the user what to do. Non-UI tools are allowed, but UI-control tools are blocked.
   * 'copilot' (default): AI may ask once before entering an app-action flow, then works
   * silently through routine steps and pauses again only for irreversible final commits
   * (place order, delete, submit, pay, cancel).
   * 'autopilot': Full autonomy — all actions execute without confirmation.
   *
   * In copilot mode, the AI can collect low-risk workflow details, request one approval
   * to start routine app actions when needed, execute navigation/fill/selection steps
   * silently, and then request a separate confirmation only before an irreversible
   * commit. Elements with aiConfirm={true} also trigger a code-level confirmation gate
   * as a safety net.
   */
  interactionMode?: InteractionMode;

  /**
   * Show a one-time discovery tooltip above the chat FAB.
   * Tells new users the AI can navigate and interact with the app.
   * Default: true (shows once per app session)
   */
  showDiscoveryTooltip?: boolean;
  /**
   * Custom discovery tooltip copy shown above the chat FAB.
   * Pass a string to override the default onboarding message for this app.
   */
  discoveryTooltipMessage?: string;

  // ── Customer Success ────────────────────────────────────────

  /**
   * Health score configuration. Enable to track feature adoption and success
   * milestones as health_signal events (delivered through onEvent).
   */
  customerSuccess?: CustomerSuccessConfig;

  /**
   * Onboarding journey configuration.
   * Proactively guides users through structured steps when the app launches.
   */
  onboarding?: OnboardingConfig;

  /**
   * AI consent configuration (Apple Guideline 5.1.2(i)).
   * Consent is REQUIRED by default — a consent dialog is shown before
   * the first AI interaction. The agent will NOT send any data to
   * the AI provider until the user explicitly consents.
   * To opt out: `consent={{ required: false }}`.
   */
  consent?: AIConsentConfig;
}

// ─── Component ─────────────────────────────────────────────────

export function AIAgent({
  apiKey,
  proxyUrl,
  proxyHeaders,
  voiceProxyUrl,
  voiceProxyHeaders,
  provider: providerName = 'gemini',
  model,
  supportStyle,
  verifier,
  actionSafety,
  toolStabilization,
  navRef,

  maxSteps = 40,
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
  interceptNativeAlerts,
  enableVoice = false,
  enableWebSearch = true,
  onTokenUsage,
  debug = false,
  knowledgeBase,
  knowledgeMaxTokens,
  enableUIControl,
  accentColor,
  theme,
  blocks,
  richUITheme,
  richUISurfaceThemes,
  blockActionHandlers,
  screenMap,
  useScreenMap = true,
  maxTokenBudget,
  maxCostUSD,
  onEvent,
  conversationStore,
  proactiveHelp,
  supportMode,
  userContext,
  interactionMode,
  showDiscoveryTooltip: showDiscoveryTooltipProp = true,
  discoveryTooltipMessage,
  customerSuccess,
  onboarding,
  consent,
}: AIAgentProps) {
  // Consent is ALWAYS required by default — only disabled if explicitly set to false.
  // No consent prop at all → gate is active with default dialog config.
  const consentRequired = consent?.required !== false;
  const consentConfig: AIConsentConfig = consent ?? {
    required: true,
    persist: false,
  };

  // ─── AI Consent State (Apple Guideline 5.1.2(i)) ─────────────
  const [hasConsented, grantConsent, , isConsentLoading] = useAIConsent(
    consentConfig.persist
  );
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const pendingConsentSendRef = useRef<{
    message: string;
    images?: UserImage[];
    options?: { onResult?: (result: ExecutionResult) => void };
  } | null>(null);
  const pendingFollowUpAfterApprovalRef = useRef<{
    message: string;
    images?: UserImage[];
    options?: { onResult?: (result: ExecutionResult) => void };
  } | null>(null);

  const consentGateActive =
    consentRequired && !hasConsented && !isConsentLoading;
  // Configure logger based on debug prop
  React.useEffect(() => {
    logger.setEnabled(debug);
    if (debug) {
      logger.info('AIAgent', '🔧 Debug logging enabled');
      logger.info(
        'AIAgent',
        `⚙️ Initial config: interactionMode=${interactionMode || 'copilot(default)'} enableVoice=${enableVoice} useScreenMap=${useScreenMap} events=${!!onEvent} history=${!!conversationStore}`
      );
    }
  }, [debug]);

  const rootViewRef = useRef<any>(null);

  const [isThinking, setIsThinking] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [registeredDataRevision, setRegisteredDataRevision] = useState(0);
  const [showCSAT, setShowCSAT] = useState(false);
  const conversationStartRef = useRef<number>(Date.now());
  // Mirror of messages for safe reading inside async callbacks (avoids setMessages abuse)
  const messagesRef = useRef<AIMessage[]>([]);

  // ── Conversation History State ────────────────────────────────
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const lastSavedMessageCountRef = useRef(0);
  const appendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPersistingConversationRef = useRef(false);
  const pendingConversationPersistRef = useRef(false);
  const conversationGenerationRef = useRef(0);

  // Keep messagesRef always in sync — used by async save callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearPendingConversationSave = useCallback(() => {
    if (appendDebounceRef.current) {
      clearTimeout(appendDebounceRef.current);
      appendDebounceRef.current = null;
    }
    pendingConversationPersistRef.current = false;
  }, []);

  const persistConversationMessages = useCallback(async () => {
    if (!conversationStore) return;

    if (isPersistingConversationRef.current) {
      pendingConversationPersistRef.current = true;
      return;
    }

    isPersistingConversationRef.current = true;
    const persistGeneration = conversationGenerationRef.current;
    try {
      do {
        pendingConversationPersistRef.current = false;
        const deviceId = await initDeviceId();
        if (persistGeneration !== conversationGenerationRef.current) return;
        const currentMsgs = messagesRef.current;
        const newMsgs = currentMsgs.slice(lastSavedMessageCountRef.current);

        if (newMsgs.length === 0) continue;

        const lastMessage = currentMsgs[currentMsgs.length - 1];
        const preview = (lastMessage?.previewText || '').slice(0, 100);
        const previewRole = lastMessage?.role || 'assistant';

        if (!activeConversationIdRef.current) {
          const id = await ConversationService.saveMessages({
            store: conversationStore,
            userId: userContext?.userId,
            deviceId,
            messages: newMsgs,
          });
          if (persistGeneration !== conversationGenerationRef.current) return;
          if (!id) continue;

          activeConversationIdRef.current = id;
          lastSavedMessageCountRef.current = currentMsgs.length;
          const newSummary: ConversationSummary = {
            id,
            title:
              currentMsgs
                .find((m) => m.role === 'user')
                ?.previewText?.slice(0, 80) || 'New conversation',
            preview,
            previewRole,
            messageCount: currentMsgs.length,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setConversations((prev) => [newSummary, ...prev]);
          logger.info('AIAgent', `Conversation created: ${id}`);
          continue;
        }

        const saved = await ConversationService.saveMessages({
          store: conversationStore,
          conversationId: activeConversationIdRef.current,
          userId: userContext?.userId,
          deviceId,
          messages: newMsgs,
        });
        if (persistGeneration !== conversationGenerationRef.current) return;
        if (!saved) continue;

        lastSavedMessageCountRef.current = currentMsgs.length;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationIdRef.current
              ? {
                  ...c,
                  preview,
                  previewRole,
                  updatedAt: Date.now(),
                  messageCount: currentMsgs.length,
                }
              : c
          )
        );
        logger.info(
          'AIAgent',
          `Conversation appended: ${activeConversationIdRef.current}`
        );
      } while (pendingConversationPersistRef.current);
    } catch (err) {
      logger.warn('AIAgent', 'Failed to persist conversation:', err);
    } finally {
      isPersistingConversationRef.current = false;
    }
  }, [conversationStore, userContext?.userId]);

  useEffect(() => {
    if (!conversationStore || messages.length <= lastSavedMessageCountRef.current) {
      return;
    }

    if (appendDebounceRef.current) {
      clearTimeout(appendDebounceRef.current);
    }
    appendDebounceRef.current = setTimeout(() => {
      appendDebounceRef.current = null;
      void persistConversationMessages();
    }, 150);
  }, [conversationStore, messages.length, persistConversationMessages]);

  useEffect(() => {
    return dataRegistry.onChange(() => {
      setRegisteredDataRevision((prev) => prev + 1);
    });
  }, []);


  const [autoExpandTrigger, setAutoExpandTrigger] = useState(0);
  const agentFrtFiredRef = useRef<boolean>(false);
  // ── Onboarding Journey State ────────────────────────────────
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentOnboardingIndex, setCurrentOnboardingIndex] = useState(0);
  const [androidWindowMetrics, setAndroidWindowMetrics] =
    useState<AndroidWindowMetrics | null>(null);
  const androidWindowMetricsRef = useRef<AndroidWindowMetrics | null>(null);
  const floatingOverlayRef = useRef<FloatingOverlayWrapperHandle | null>(null);

  useEffect(() => {
    if (!onboarding?.enabled) return;
    if (onboarding.firstLaunchOnly !== false) {
      if (!onboardingCompletedInSession) setIsOnboardingActive(true);
    } else {
      setIsOnboardingActive(true);
    }
  }, [onboarding?.enabled, onboarding?.firstLaunchOnly]);

  const advanceOnboarding = useCallback(() => {
    if (!onboarding?.steps) return;
    if (currentOnboardingIndex >= onboarding.steps.length - 1) {
      setIsOnboardingActive(false);
      onboardingCompletedInSession = true;
      onboarding.onComplete?.();
    } else {
      setCurrentOnboardingIndex((prev) => prev + 1);
    }
  }, [onboarding, currentOnboardingIndex]);

  // ── Discovery Tooltip (one-time) ──────────────────────────
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    if (!showDiscoveryTooltipProp) return;
    if (!discoveryTooltipSeenInSession) setTooltipVisible(true);
  }, [showDiscoveryTooltipProp]);

  const handleTooltipDismiss = useCallback(() => {
    discoveryTooltipSeenInSession = true;
    setTooltipVisible(false);
  }, []);

  useEffect(() => {
    if (!showChatBar) {
      androidWindowMetricsRef.current = null;
      setAndroidWindowMetrics(null);
    }
  }, [showChatBar]);

  const handleAndroidWindowMetricsChange = useCallback(
    (metrics: AndroidWindowMetrics) => {
      if (Platform.OS !== 'android') {
        return;
      }

      if (!showChatBar) {
        androidWindowMetricsRef.current = null;
        setAndroidWindowMetrics(null);
        return;
      }

      const previousMetrics = androidWindowMetricsRef.current;
      if (
        previousMetrics &&
        previousMetrics.x === metrics.x &&
        previousMetrics.y === metrics.y &&
        previousMetrics.width === metrics.width &&
        previousMetrics.height === metrics.height
      ) {
        return;
      }

      androidWindowMetricsRef.current = metrics;

      if (floatingOverlayRef.current && previousMetrics) {
        floatingOverlayRef.current.setAndroidWindowMetrics(metrics);
        return;
      }

      setAndroidWindowMetrics(metrics);
    },
    [showChatBar]
  );

  const handleAndroidWindowDragEnd = useCallback(
    (metrics: AndroidWindowMetrics) => {
      if (Platform.OS !== 'android') {
        return;
      }

      if (!showChatBar) {
        androidWindowMetricsRef.current = null;
        setAndroidWindowMetrics(null);
        return;
      }

      androidWindowMetricsRef.current = metrics;
      setAndroidWindowMetrics((prev) => {
        if (
          prev &&
          prev.x === metrics.x &&
          prev.y === metrics.y &&
          prev.width === metrics.width &&
          prev.height === metrics.height
        ) {
          return prev;
        }
        return metrics;
      });
    },
    [showChatBar]
  );

  // CRITICAL: clearSupport uses REFS and functional setters — never closure values.
  // This function is captured by long-lived callbacks (escalation sockets, restored
  // sockets) that may hold stale references. Using refs guarantees the current
  // selectedTicketId and supportSocket are always read, not snapshot values.
  const clearMessages = useCallback(() => {
    if (activeConversationIdRef.current) {
      ConversationService.endConversation(conversationStore, activeConversationIdRef.current);
    }
    clearPendingConversationSave();
    conversationGenerationRef.current += 1;
    activeConversationIdRef.current = null;
    lastSavedMessageCountRef.current = 0;
    setMessages([]);
    setLastResult(null);
  }, [clearPendingConversationSave, conversationStore]);

  const getDeepestRouteName = useCallback((state: any): string | null => {
    if (!state || !Array.isArray(state.routes) || state.index == null) {
      return null;
    }

    const route = state.routes[state.index];
    if (!route) return null;

    const nested = route.state;
    if (nested) {
      const nestedName = getDeepestRouteName(nested);
      if (nestedName) return nestedName;
    }

    return typeof route.name === 'string' ? route.name : null;
  }, []);

  const resolveRawScreenName = useCallback(() => {
    if (pathname) {
      const routeKey = resolveRouteKeyFromPath(pathname === '/' ? 'index' : pathname);
      if (routeKey) return routeKey;
    }

    const navState = (navRef as any)?.getRootState?.() ?? (navRef as any)?.getState?.();
    const deepestFromState = getDeepestRouteName(navState);
    if (deepestFromState) {
      return deepestFromState;
    }

    const routeName = (navRef as any)?.getCurrentRoute?.()?.name;
    if (typeof routeName === 'string' && routeName.trim().length > 0) {
      return routeName;
    }

    const telemetryScreen = telemetryRef.current?.screen;
    if (
      typeof telemetryScreen === 'string' &&
      telemetryScreen !== 'Unknown' &&
      telemetryScreen.trim().length > 0
    ) {
      return telemetryScreen;
    }

    return 'unknown';
  }, [pathname, navRef, getDeepestRouteName]);

  const resolveScreenName = useCallback(() => {
    const rawScreenName = resolveRawScreenName();
    if (rawScreenName === 'unknown') return rawScreenName;

    const humanized = humanizeScreenName(rawScreenName);
    return humanized || rawScreenName;
  }, [resolveRawScreenName]);

  const syncTelemetryScreen = useCallback(() => {
    const screen = resolveScreenName();
    if (screen === 'unknown') {
      return screen;
    }
    telemetryRef.current?.setScreen(screen);
    return screen;
  }, [resolveScreenName]);

  const getResolvedScreenName = useCallback(() => resolveScreenName(), [
    resolveScreenName,
  ]);

  const getRawScreenName = useCallback(() => resolveRawScreenName(), [
    resolveRawScreenName,
  ]);

  const platformAdapter = useMemo(
    () =>
      new ReactNativePlatformAdapter({
        getRootRef: () => rootViewRef.current,
        getWalkConfig: () => ({
          interactiveBlacklist,
          interactiveWhitelist,
          screenName: getRawScreenName(),
          interceptNativeAlerts,
        }),
        navRef,
        router,
        pathname,
        getCurrentScreenName: getRawScreenName,
      }),
    [
      getRawScreenName,
      interactiveBlacklist,
      interactiveWhitelist,
      interceptNativeAlerts,
      navRef,
      pathname,
      router,
    ]
  );

  // ─── Escalation tool ───────────────────────────────────────────
  // Created when supportMode.escalation.onEscalate is set and the app has not
  // provided its own escalate_to_human tool. The handoff itself is the app's.
  const autoEscalateTool = useMemo(() => {
    const escalation = supportMode?.escalation;
    const onEscalate = escalation?.onEscalate;
    if (!onEscalate) return null;
    if (customTools?.['escalate_to_human']) return null; // consumer overrides
    return createEscalateTool({
      config: {
        ...escalation,
        onEscalate: async (context) => {
          telemetryRef.current?.track('escalation', {
            reason: context.conversationSummary,
            screen: context.currentScreen,
            trigger: context.handoffTriggerType,
          });
          await onEscalate(context);
        },
      },
      getContext: () => ({
        currentScreen: getResolvedScreenName(),
        originalQuery:
          messages.find((m) => m.role === 'user')?.previewText ?? '',
        stepsBeforeEscalation: messages.reduce(
          (count, m) => count + (m.result?.steps?.length ?? 0),
          0
        ),
      }),
      getHistory: () =>
        messages.map((m) => ({ role: m.role, content: m.previewText })),
      getToolCalls: () =>
        messages.flatMap((m) =>
          (m.result?.steps ?? [])
            .map((step) => step.action)
            .filter(
              (action) =>
                action &&
                action.name !== 'done' &&
                action.name !== 'agent_step' &&
                action.name !== 'escalate_to_human'
            )
        ),
      getScreenFlow: () => telemetryRef.current?.getScreenFlow() ?? [],
      userContext,
    });
  }, [customTools, getResolvedScreenName, messages, supportMode?.escalation, userContext]);

  // ─── Load conversation history on mount ─────────────────────────
  useEffect(() => {
    if (!conversationStore) return;

    let cancelled = false;
    void (async () => {
      setIsLoadingHistory(true);
      const deviceId = await initDeviceId();
      const list = await ConversationService.listConversations({
        store: conversationStore,
        userId: userContext?.userId,
        deviceId,
      });
      if (!cancelled) {
        setConversations(list);
        setIsLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationStore, userContext?.userId]);

  const registeredDataInstructions = useMemo(() => {
    const sources = dataRegistry.getAll();
    if (sources.length === 0) return "";

    const lines = sources.map((source) => {
      const schema = source.schema
        ? Object.entries(source.schema)
            .map(([key, value]) => {
              if (typeof value === 'string') {
                return `${key}: ${value}`;
              }
              return `${key}: ${value.type || 'string'} - ${value.description}`;
            })
            .join('; ')
        : '';

      return schema.length > 0
        ? `- Data source \`${source.name}\`: ${source.description}. Fields: ${schema}`
        : `- Data source \`${source.name}\`: ${source.description}`;
    });

    return [
      "### Registered Data Sources",
      "The app exposes live data sources you can query with `query_data(source, query)`.",
      "Use them for recommendations, catalog lookup, live pricing, inventory, order status, or any structured data that is better fetched directly than inferred from the current screen.",
      ...lines,
    ].join("\n");
  }, [registeredDataRevision]);

  const resolvedInstructions = useMemo(() => {
    const combinedSystem = [
      instructions?.system?.trim(),
      registeredDataInstructions.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!combinedSystem && !instructions?.getScreenInstructions) {
      return instructions;
    }

    return {
      ...instructions,
      system: combinedSystem || undefined,
    };
  }, [instructions, registeredDataInstructions]);

  const mergedCustomTools = useMemo(() => {
    return {
      ...(autoEscalateTool ? { escalate_to_human: autoEscalateTool } : {}),
      ...customTools,
    };
  }, [autoEscalateTool, customTools]);

  // ─── Voice/Live Mode State ──────────────────────────────────
  const [mode, setMode] = useState<AgentMode>('text');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [voiceTranscripts, setVoiceTranscripts] = useState<
    Array<{ id: string; role: 'user' | 'model'; text: string }>
  >([]);

  const voiceServiceRef = useRef<VoiceService | null>(null);
  const audioInputRef = useRef<AudioInputService | null>(null);
  const audioOutputRef = useRef<AudioOutputService | null>(null);
  const toolLockRef = useRef<boolean>(false);
  const isMicActiveRef = useRef<boolean>(false);
  const isAISpeakingRef = useRef<boolean>(false);
  const voicePlaybackDrainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const voicePlaybackDrainUntilRef = useRef(0);
  const userHasSpokenRef = useRef<boolean>(false);
  const voiceTranscriptSeqRef = useRef(0);
  const voiceSessionActiveRef = useRef(false);
  const voiceSessionGenerationRef = useRef(0);
  const lastScreenContextRef = useRef<string>('');
  const screenPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const voiceReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastAgentErrorRef = useRef<string | null>(null);

  const appendVoiceTranscript = useCallback(
    (role: 'user' | 'model', text: string) => {
      const normalized = cleanVoiceTranscript(text);
      if (shouldSuppressVoiceTranscript(normalized, role)) {
        logger.debug(
          'AIAgent',
          `Transcript suppressed [${role}]: "${text}"`
        );
        return;
      }

      const id = `voice-transcript-${Date.now()}-${voiceTranscriptSeqRef.current++}`;
      setVoiceTranscripts((prev) => [
        ...prev,
        { id, role, text: normalized },
      ]);
    },
    []
  );

  const availableModes: AgentMode[] = useMemo(() => {
    const modes: AgentMode[] = ['text'];
    if (enableVoice) modes.push('voice');
    return modes;
  }, [enableVoice]);

  // Ref-based resolver for ask_user — stays alive across renders
  const askUserResolverRef = useRef<((answer: string) => void) | null>(null);
  const pendingAskUserKindRef = useRef<'freeform' | 'approval' | null>(null);
  // Tracks whether we're waiting for a BUTTON tap (not just any text answer).
  // Set true when kind='approval' is issued; cleared ONLY on actual button tap.
  // Forces kind='approval' on all subsequent ask_user calls until resolved.
  const pendingAppApprovalRef = useRef<boolean>(false);
  const pendingVoicePermissionToolRef = useRef<{
    name: string;
    id: string;
  } | null>(null);
  const pendingVoiceActionToolRef = useRef<{
    name: string;
    id: string;
    args: Record<string, any>;
  } | null>(null);
  // Stores a message typed by the user while the agent is still thinking (mid-approval flow).
  // Auto-resolved into the next ask_user call to prevent the message being lost.
  const queuedApprovalAnswerRef = useRef<string | null>(null);
  const [pendingApprovalQuestion, setPendingApprovalQuestion] = useState<
    string | null
  >(null);
  const latestVoiceModelTranscript = useMemo(() => {
    for (let i = voiceTranscripts.length - 1; i >= 0; i--) {
      const transcript = voiceTranscripts[i];
      if (transcript?.role === 'model' && transcript.text.trim()) {
        return transcript.text.trim();
      }
    }
    return '';
  }, [voiceTranscripts]);
  const voiceSpeakingStatusText =
    mode === 'voice' && isAISpeaking
      ? latestVoiceModelTranscript || statusText || 'Speaking...'
      : '';
  const overlayVisible =
    isThinking ||
    isActing ||
    !!statusText.trim() ||
    !!pendingApprovalQuestion ||
    (mode === 'voice' && isAISpeaking);
  const overlayStatusText = pendingApprovalQuestion
    ? 'Waiting for your approval...'
    : voiceSpeakingStatusText || statusText;

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    isAISpeakingRef.current = isAISpeaking;
  }, [isAISpeaking]);

  const clearVoicePlaybackDrainTimer = useCallback(() => {
    if (voicePlaybackDrainTimerRef.current) {
      clearTimeout(voicePlaybackDrainTimerRef.current);
      voicePlaybackDrainTimerRef.current = null;
    }
  }, []);

  const setVoiceAISpeaking = useCallback((speaking: boolean) => {
    isAISpeakingRef.current = speaking;
    setIsAISpeaking(speaking);
    if (!speaking) {
      voicePlaybackDrainUntilRef.current = 0;
    }
  }, []);

  const scheduleVoicePlaybackDrain = useCallback(() => {
    clearVoicePlaybackDrainTimer();
    const now = Date.now();
    const estimatedDelay = Math.max(
      VOICE_PLAYBACK_DRAIN_GRACE_MS,
      voicePlaybackDrainUntilRef.current - now + VOICE_PLAYBACK_DRAIN_GRACE_MS
    );
    logger.info(
      'AIAgent',
      `AI turn complete — waiting ${Math.ceil(estimatedDelay)}ms for local playback drain`
    );
    voicePlaybackDrainTimerRef.current = setTimeout(() => {
      voicePlaybackDrainTimerRef.current = null;
      logger.info('AIAgent', 'AI local playback drain complete');
      setVoiceAISpeaking(false);
    }, estimatedDelay);
  }, [clearVoicePlaybackDrainTimer, setVoiceAISpeaking]);

  const markVoicePlaybackChunkQueued = useCallback(
    (audio: string) => {
      clearVoicePlaybackDrainTimer();
      const now = Date.now();
      const chunkDurationMs = Math.max(
        VOICE_PLAYBACK_MIN_CHUNK_MS,
        estimateVoiceOutputDurationMs(audio)
      );
      voicePlaybackDrainUntilRef.current =
        Math.max(now, voicePlaybackDrainUntilRef.current) + chunkDurationMs;
      setVoiceAISpeaking(true);
      scheduleVoicePlaybackDrain();
    },
    [clearVoicePlaybackDrainTimer, scheduleVoicePlaybackDrain, setVoiceAISpeaking]
  );

  const resetVoicePlaybackState = useCallback(() => {
    clearVoicePlaybackDrainTimer();
    setVoiceAISpeaking(false);
  }, [clearVoicePlaybackDrainTimer, setVoiceAISpeaking]);

  // The support persona and style apply only in support mode; otherwise the
  // agent uses the general app-assistant prompt.
  const effectiveSupportStyle: SupportStyle | undefined = supportMode?.enabled
    ? supportStyle ?? 'warm-concise'
    : undefined;

  // Model traffic goes to the provider with apiKey, or through the app's own proxy.
  const resolvedVoiceProxyUrl = voiceProxyUrl ?? proxyUrl;

  // ─── Create Runtime ──────────────────────────────────────────

  const config: AgentConfig = useMemo(
    () => ({
      apiKey,
      proxyUrl,
      proxyHeaders,
      voiceProxyUrl: resolvedVoiceProxyUrl,
      voiceProxyHeaders,
      model,
      supportStyle: effectiveSupportStyle,
      enableWebSearch,
      verifier,
      actionSafety,
      toolStabilization,
      language: 'en',
      maxSteps,
      interactiveBlacklist,
      interactiveWhitelist,
      onBeforeStep,
      onAfterStep,
      onBeforeTask,
      onAfterTask,
      customTools:
        mode === 'voice'
          ? { ...mergedCustomTools, ask_user: null }
          : mergedCustomTools,
      instructions: resolvedInstructions,
      stepDelay,
      mcpServerUrl,
      router,
      pathname,
      interceptNativeAlerts,
      onStatusUpdate: setStatusText,
      trackEvent: (type, data) => telemetryRef.current?.track(type, data),
      onInlineMessage: ({ text }) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.role === 'assistant' &&
            (last.previewText || '').trim() === trimmed
          ) {
            return prev;
          }
          return [
            ...prev,
            createAIMessage({
              id: `assistant-inline-${Date.now()}-${Math.random()}`,
              role: 'assistant',
              content: trimmed,
              previewText: trimmed,
              timestamp: Date.now(),
            }),
          ];
        });
        setAutoExpandTrigger((prev) => prev + 1);
      },
      onTokenUsage,
      knowledgeBase,
      knowledgeMaxTokens,
      enableUIControl,
      screenMap: useScreenMap ? screenMap : undefined,
      maxTokenBudget,
      maxCostUSD,
      interactionMode,
      platformAdapter,
      // Block the agent loop until user responds
      onAskUser:
        mode === 'voice'
          ? undefined
          : (request) => {
              return new Promise<string>((resolve) => {
                const normalized =
                  typeof request === 'string'
                    ? { question: request, kind: 'freeform' as const }
                    : request;
                const question = normalized.question;
                const kind = normalized.kind || 'freeform';
                logger.info(
                  'AIAgent',
                  `❓ onAskUser invoked in ${mode} mode: "${question}"`
                );
                telemetryRef.current?.track('agent_trace', {
                  stage: 'ask_user_prompt_rendered',
                  question,
                  mode,
                  kind,
                });
                askUserResolverRef.current = resolve;
                logger.info(
                  'AIAgent',
                  `📌 askUserResolverRef SET (resolver stored) | kind=${kind} | pendingAppApprovalRef=${pendingAppApprovalRef.current}`
                );
                // If we're already waiting for a button tap, force approval kind regardless
                // of what the model passed — the user must tap a button to proceed.
                const forcedKind = pendingAppApprovalRef.current
                  ? 'approval'
                  : kind;
                pendingAskUserKindRef.current = forcedKind;
                if (forcedKind === 'approval') {
                  pendingAppApprovalRef.current = true;
                }

                // If the user typed a message while we were thinking (queued answer),
                // resolve immediately with that message instead of blocking on a new prompt.
                const queued = queuedApprovalAnswerRef.current;
                if (queued !== null) {
                  queuedApprovalAnswerRef.current = null;
                  logger.info(
                    'AIAgent',
                    `⚡ Auto-resolving ask_user with queued message: "${queued}"`
                  );
                  setAutoExpandTrigger((prev) => prev + 1);
                  // Show the AI question in chat, clear the approval buttons (no resolver for them),
                  // then immediately resolve the Promise with the queued message.
                  setMessages((prev) => [
                    ...prev,
                    createAIMessage({
                      id: `assistant-ask-${Date.now()}`,
                      role: 'assistant' as const,
                      content: question,
                      previewText: question,
                      timestamp: Date.now(),
                      promptKind:
                        forcedKind === 'approval' ? 'approval' : undefined,
                    }),
                  ]);
                  askUserResolverRef.current = null;
                  pendingAskUserKindRef.current = null;
                  pendingAppApprovalRef.current = false; // CRITICAL FIX: Unlock the agent state
                  setPendingApprovalQuestion(null); // clear any stale buttons — buttons with no resolver = dead tap
                  resolve(queued);
                  return;
                }

                setPendingApprovalQuestion(
                  forcedKind === 'approval' ? question : null
                );
                setAutoExpandTrigger((prev) => prev + 1);
                // Add AI question to the message thread so it appears in chat
                setMessages((prev) => [
                  ...prev,
                  createAIMessage({
                    id: `assistant-ask-${Date.now()}`,
                    role: 'assistant' as const,
                    content: question,
                    previewText: question,
                    timestamp: Date.now(),
                    promptKind: kind === 'approval' ? 'approval' : undefined,
                  }),
                ]);
                setLastResult({
                  success: true,
                  message: question,
                  previewText: question,
                  reply: normalizeRichContent(question),
                  steps: [],
                });
                setIsThinking(false);
                setStatusText('');
              });
            },
      // Toggle isAgentActing flag on TelemetryService before/after every tool
      // so that AI-driven taps are never tracked as user_interaction events.
      onToolExecute: (active: boolean, toolName?: string) => {
        setIsActing(active && !!toolName && UI_ACTION_TOOL_NAMES.has(toolName));
        telemetryRef.current?.setAgentActing(active);
      },
      onTrace: (event: AgentTraceEvent) => {
        if (
          debug &&
          (
            event.stage.startsWith('action_safety') ||
            event.stage.startsWith('app_action_gate') ||
            event.stage.startsWith('confirmation') ||
            event.stage.startsWith('tool_stabilization')
          )
        ) {
          logger.info('AIAgent', `[trace:${event.stage}]`, JSON.stringify(event.data ?? {}));
        }
        telemetryRef.current?.track('agent_trace', {
          traceId: event.traceId,
          stage: event.stage,
          stepIndex: event.stepIndex,
          screenName: event.screenName,
          ...(event.data ?? {}),
        });
      },
    }),
    [
      mode,
      apiKey,
      proxyUrl,
      proxyHeaders,
      resolvedVoiceProxyUrl,
      voiceProxyHeaders,
      model,
      maxSteps,
      interactiveBlacklist,
      interactiveWhitelist,
      onBeforeStep,
      onAfterStep,
      onBeforeTask,
      onAfterTask,
      transformScreenContent,
      mergedCustomTools,
      resolvedInstructions,
      stepDelay,
      actionSafety,
      toolStabilization,
      mcpServerUrl,
      router,
      pathname,
      onTokenUsage,
      knowledgeBase,
      knowledgeMaxTokens,
      enableUIControl,
      screenMap,
      useScreenMap,
      maxTokenBudget,
      maxCostUSD,
      interactionMode,
      platformAdapter,
      verifier,
      effectiveSupportStyle,
    ]
  );

  useEffect(() => {
    logger.info(
      'AIAgent',
      `⚙️ Runtime config recomputed: mode=${mode} interactionMode=${interactionMode || 'copilot(default)'} onAskUser=${mode !== 'voice'} mergedTools=${Object.keys(mergedCustomTools).join(', ') || '(none)'}`
    );
  }, [mode, interactionMode, mergedCustomTools]);

  const provider = useMemo(
    () =>
      createProvider(
        providerName,
        apiKey,
        model,
        proxyUrl,
        proxyHeaders,
        enableWebSearch
      ),
    [providerName, apiKey, model, proxyUrl, proxyHeaders, enableWebSearch]
  );

  const runtime = useMemo(
    () => new AgentRuntime(provider, config, rootViewRef.current, navRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, config]
  );
  const activeRuntimeRef = useRef<AgentRuntime | null>(null);

  // Update refs when they change
  useEffect(() => {
    runtime.updateRefs(rootViewRef.current, navRef);
  }, [runtime, navRef]);

  // ─── Telemetry ─────────────────────────────────────────────

  const telemetryRef = useRef<TelemetryService | null>(null);
  // Latest app onEvent, read at emit time so a new callback never restarts telemetry.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Telemetry is local: events feed proactive help and customer-success
    // signals, then go to the app's onEvent callback when one is set.
    let cancelled = false;
    initDeviceId().then(() => {
      if (cancelled) return;
      const telemetry = new TelemetryService({
        debug,
        onEvent: (event) => {
          // Proactive behavior triggers
          if (
            event.type === 'rage_tap' ||
            event.type === 'rage_click' ||
            event.type === 'rage_click_detected' ||
            event.type === 'error_screen' ||
            event.type === 'repeated_navigation'
          ) {
            idleDetectorRef.current?.triggerBehavior(event.type, event.screen);
          }

          // Customer Success features
          if (
            customerSuccess?.enabled &&
            (event.type === 'user_interaction' ||
              event.type === 'user_action') &&
            event.data
          ) {
            const action = String(event.data.label || event.data.action || '');

            // Check milestones
            customerSuccess.successMilestones?.forEach((m) => {
              if (m.action && m.action === action) {
                telemetry.track('health_signal', {
                  type: 'success_milestone',
                  milestone: m.name,
                });
              }
            });

            // Check key feature adoption
            customerSuccess.keyFeatures?.forEach((feature) => {
              if (action.includes(feature) || action === feature) {
                telemetry.track('health_signal', {
                  type: 'feature_adoption',
                  feature,
                });
              }
            });
          }

          onEventRef.current?.(event);
        },
      });
      telemetryRef.current = telemetry;
      telemetry.start();
      // NavigationContainer is a child of AIAgent, so navRef may not be
      // ready yet when this effect runs. Poll briefly until it is.
      const resolveInitialScreen = () => {
        let attempts = 0;
        const maxAttempts = 15; // 15 × 200ms = 3s max wait
        const timer = setInterval(() => {
          attempts++;
          const cleanName = syncTelemetryScreen();
          if (cleanName !== 'unknown') {
            clearInterval(timer);
          } else if (attempts >= maxAttempts) {
            clearInterval(timer);
          }
        }, 200);
      };
      resolveInitialScreen();
    }); // initDeviceId
    return () => {
      cancelled = true;
      telemetryRef.current?.stop();
      telemetryRef.current = null;
    };
  }, [debug, navRef, syncTelemetryScreen]);

  // ─── Security warnings ──────────────────────────────────────

  useEffect(() => {
    // @ts-ignore
    if (
      typeof __DEV__ !== 'undefined' &&
      !__DEV__ &&
      apiKey &&
      !proxyUrl
    ) {
      logger.warn(
        '[react-native-agentic-ai] ⚠️ SECURITY WARNING: You are using `apiKey` directly in a production build. ' +
          'This exposes your LLM provider key in the app binary. ' +
          'Use `proxyUrl` to route requests through your backend instead. ' +
          'See docs for details.'
      );
    }
  }, [apiKey, proxyUrl]);

  // Track screen changes via navRef
  useEffect(() => {
    if (!navRef?.addListener || !telemetryRef.current) return;

    const checkScreenMilestone = (screenName: string): void => {
      telemetryRef.current?.setScreen(screenName);

      // Auto-capture wireframe snapshot for privacy-safe heatmaps, only when
      // the app listens to events (it includes a screenshot, so skip otherwise).
      // Deferred: wait for all animations/interactions to finish, then
      // wait one more frame for layout to settle.
      if (rootViewRef.current && onEventRef.current) {
        const handle = InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            Promise.all([
              captureWireframe(rootViewRef, { screenName }),
              captureHeatmapScreenshot(rootViewRef.current),
            ])
              .then(([wireframe, screenshot]) => {
                if (wireframe && telemetryRef.current) {
                  telemetryRef.current.trackWireframe({
                    ...wireframe,
                    screenshot: screenshot || undefined,
                  });
                }
              })
              .catch((err) => {
                if (debug)
                  logger.debug('AIAgent', 'Wireframe capture failed:', err);
              });
          });
        });
        void handle;
      }

      if (customerSuccess?.enabled) {
        customerSuccess.successMilestones?.forEach((m) => {
          if (m.screen && m.screen === screenName) {
            telemetryRef.current?.track('health_signal', {
              type: 'success_milestone',
              milestone: m.name,
            });
          }
        });
      }

      if (isOnboardingActive && onboarding?.steps) {
        const step = onboarding.steps[currentOnboardingIndex];
        if (step && step.screen === screenName) {
          telemetryRef.current?.track('onboarding_step', {
            step_index: currentOnboardingIndex,
            screen: screenName,
            action: step.action || 'view',
          });

          // Pop the onboarding badge instantly
          setTimeout(() => {
            setProactiveBadgeText(step.message);
            setProactiveStage('badge');
            // Stop typical idle timers so it stays until dismissed or advanced
            idleDetectorRef.current?.dismiss();

            // Auto advance logic
            advanceOnboarding();
          }, 300);
        }
      }
    };

    const unsubscribe = navRef.addListener('state', () => {
      const cleanName = resolveScreenName();
      if (cleanName) {
        checkScreenMilestone(cleanName);
      }
    });

    return () => unsubscribe?.();
  }, [
    navRef,
    resolveScreenName,
    customerSuccess,
    isOnboardingActive,
    onboarding,
    currentOnboardingIndex,
    advanceOnboarding,
  ]);

  // ─── MCP Bridge ──────────────────────────────────────────────

  useEffect(() => {
    if (!mcpServerUrl) return;

    logger.info('AIAgent', `Setting up MCP bridge at ${mcpServerUrl}`);
    const bridge = new MCPBridge(mcpServerUrl, runtime, {
      // MCP tasks run with the key given to the MCP server, without dashboard or support features.
      createTaskRuntime: (ai) =>
        new AgentRuntime(
          createProvider(
            ai.provider,
            ai.apiKey,
            ai.model,
            undefined,
            undefined,
            enableWebSearch
          ),
          buildMCPRuntimeConfig(config, ai, {
            customTools,
            instructions,
            knowledgeBase,
          }),
          rootViewRef.current,
          navRef
        ),
    });

    return () => {
      bridge.destroy();
    };
  }, [
    mcpServerUrl,
    runtime,
    config,
    customTools,
    instructions,
    knowledgeBase,
    enableWebSearch,
    navRef,
  ]);

  // ─── Proactive Idle Agent ────────────────────────────────────

  const idleDetectorRef = useRef<IdleDetector | null>(null);
  const [proactiveStage, setProactiveStage] = useState<
    'hidden' | 'pulse' | 'badge'
  >('hidden');
  const [proactiveBadgeText, setProactiveBadgeText] = useState('');

  useEffect(() => {
    if (proactiveHelp?.enabled === false) {
      idleDetectorRef.current?.destroy();
      idleDetectorRef.current = null;
      setProactiveStage('hidden');
      return;
    }

    if (!idleDetectorRef.current) {
      idleDetectorRef.current = new IdleDetector();
    }

    idleDetectorRef.current.start({
      pulseAfterMs: (proactiveHelp?.pulseAfterMinutes || 2) * 60000,
      badgeAfterMs: (proactiveHelp?.badgeAfterMinutes || 4) * 60000,
      onPulse: () => setProactiveStage('pulse'),
      onBadge: (suggestion: string) => {
        setProactiveBadgeText(suggestion);
        setProactiveStage('badge');
      },
      onReset: () => setProactiveStage('hidden'),
      generateSuggestion: () =>
        proactiveHelp?.generateSuggestion?.(
          telemetryRef.current?.screen || 'Home'
        ) ||
        proactiveHelp?.badgeText ||
        'Need help with this screen?',
      behaviorTriggers: proactiveHelp?.behaviorTriggers,
    });

    return () => {
      idleDetectorRef.current?.destroy();
      idleDetectorRef.current = null;
    };
  }, [proactiveHelp, telemetryRef]);

  // ─── Voice/Live Service Initialization ──────────────────────

  // Initialize voice services when mode changes to voice
  useEffect(() => {
    if (mode !== 'voice') {
      logger.info('AIAgent', `Mode ${mode} — skipping voice service init`);
      voiceSessionActiveRef.current = false;
      pendingVoicePermissionToolRef.current = null;
      pendingVoiceActionToolRef.current = null;
      return;
    }

    voiceSessionActiveRef.current = true;
    const sessionGeneration = voiceSessionGenerationRef.current + 1;
    voiceSessionGenerationRef.current = sessionGeneration;
    userHasSpokenRef.current = false;
    voiceTranscriptSeqRef.current = 0;
    setVoiceTranscripts([]);
    const isCurrentVoiceSession = () =>
      voiceSessionActiveRef.current &&
      voiceSessionGenerationRef.current === sessionGeneration;

    logger.info(
      'AIAgent',
      `Mode changed to "${mode}" — initializing voice services...`
    );

    // Track async audio output init — mic MUST wait for this
    let audioOutputInitPromise: Promise<boolean> = Promise.resolve(true);

    // Create VoiceService with runtime's built-in tools (navigate, tap, type, done, etc.)
    if (!voiceServiceRef.current) {
      logger.info('AIAgent', 'Creating VoiceService...');
      const runtimeTools = [...runtime.getTools(), VOICE_PERMISSION_TOOL];
      logger.info(
        'AIAgent',
        `Registering ${runtimeTools.length} tools with VoiceService: ${runtimeTools.map((t) => t.name).join(', ')}`
      );
      // Use voice-adapted system prompt — same core rules as text mode
      // but without agent-loop directives that trigger autonomous actions
      const voicePrompt = buildVoiceSystemPrompt(
        'en',
        instructions?.system,
        !!knowledgeBase,
        effectiveSupportStyle
      );
      logger.info(
        'AIAgent',
        `📝 Voice system prompt (${voicePrompt.length} chars):\n${voicePrompt}`
      );
      voiceServiceRef.current = new VoiceService({
        apiKey,
        proxyUrl: resolvedVoiceProxyUrl,
        proxyHeaders: voiceProxyHeaders || proxyHeaders,
        systemPrompt: voicePrompt,
        tools: runtimeTools,
        language: 'en',
      });
      logger.info(
        'AIAgent',
        `VoiceService created with ${runtimeTools.length} tools: ${runtimeTools.map((t) => t.name).join(', ')}`
      );
    }

    // Create AudioOutputService if not exists
    if (!audioOutputRef.current) {
      logger.info('AIAgent', 'Creating AudioOutputService...');
      audioOutputRef.current = new AudioOutputService({
        onError: (err) =>
          logger.warn('AIAgent', `AudioOutput error/disabled: ${err}`),
      });
      // IMPORTANT: Must await initialize() BEFORE starting mic.
      // initialize() calls setAudioSessionOptions which reconfigures the
      // audio hardware. If the mic starts before this finishes, the native
      // audio session change kills the recorder's device handle.
      audioOutputInitPromise = audioOutputRef.current
        .initialize()
        .then((ok) => {
          logger.info('AIAgent', `AudioOutputService initialized: ${ok}`);
          return ok;
        })
        .catch((err) => {
          logger.warn(
            'AIAgent',
            `AudioOutputService initialization failed: ${err?.message || err}`
          );
          return false;
        });
    }

    // Create AudioInputService if not exists
    if (!audioInputRef.current) {
      logger.info('AIAgent', 'Creating AudioInputService...');
      audioInputRef.current = new AudioInputService({
        // Default 16kHz — Gemini Live API input standard
        onAudioChunk: (chunk) => {
          if (!voiceSessionActiveRef.current) {
            logger.debug('AIAgent', '🎤 Audio chunk ignored after voice stop');
            return;
          }
          logger.info(
            'AIAgent',
            `🎤 onAudioChunk: ${chunk.length} chars, voiceService=${!!voiceServiceRef.current}, connected=${voiceServiceRef.current?.isConnected}`
          );
          if (
            toolLockRef.current ||
            pendingVoicePermissionToolRef.current ||
            pendingVoiceActionToolRef.current
          ) {
            if (!pendingVoicePermissionToolRef.current) {
              setStatusText((current) => current || 'Thinking...');
            }
            logger.debug(
              'AIAgent',
              '🎤 Audio chunk ignored while voice tool/approval is pending'
            );
            return;
          }
          if (isAISpeakingRef.current) {
            logger.debug(
              'AIAgent',
              '🎤 Audio chunk ignored while AI is speaking'
            );
            return;
          }
          voiceServiceRef.current?.sendAudio(chunk);
        },
        onError: (err) =>
          logger.warn('AIAgent', `AudioInput error/disabled: ${err}`),
        onPermissionDenied: () =>
          logger.warn('AIAgent', 'Mic permission denied by user'),
      });
    }

    // Connect VoiceService (async — SDK's ai.live.connect returns a Promise)
    logger.info('AIAgent', 'Connecting VoiceService...');
    void voiceServiceRef.current.connect({
      onAudioResponse: (audio) => {
        if (!isCurrentVoiceSession()) return;
        logger.info(
          'AIAgent',
          `🔊 Audio response: ${audio.length} chars, audioOutputRef=${!!audioOutputRef.current}`
        );
        if (!audioOutputRef.current) {
          logger.error(
            'AIAgent',
            '❌ audioOutputRef.current is NULL — cannot play audio!'
          );
          return;
        }
        markVoicePlaybackChunkQueued(audio);
        audioOutputRef.current.enqueue(audio);
      },
      onStatusChange: (status) => {
        if (!isCurrentVoiceSession() && status !== 'disconnected') return;
        logger.info('AIAgent', `Voice status: ${status}`);
        const connected = status === 'connected';
        setIsVoiceConnected(connected);
        if (connected) {
          logger.info(
            'AIAgent',
            '✅ VoiceService connected — waiting for audio session init before starting mic...'
          );
          // Wait for audio session config to finish BEFORE starting mic.
          // If mic starts while setAudioSessionOptions is in flight,
          // the native audio device gets killed (AudioDeviceStop error).
          audioOutputInitPromise.then((ok) => {
            if (!isCurrentVoiceSession()) return;
            if (!ok) {
              logger.warn(
                'AIAgent',
                'Audio session unavailable — mic auto-start skipped'
              );
              return;
            }
            logger.info(
              'AIAgent',
              '✅ Audio session ready — starting mic now...'
            );
            audioInputRef.current?.start().then((ok) => {
              if (ok && isCurrentVoiceSession()) {
                setIsMicActive(true);
                logger.info('AIAgent', '🎙️ Mic auto-started after connection');
              }
            });
          });
        }

        // Handle unexpected disconnection — auto-reconnect ONLY if not intentional
        if (
          status === 'disconnected' &&
          isCurrentVoiceSession() &&
          mode === 'voice' &&
          voiceServiceRef.current &&
          !voiceServiceRef.current.intentionalDisconnect
        ) {
          // Stop mic & audio immediately so user isn't stuck
          audioInputRef.current?.stop();
          audioOutputRef.current?.stop();
          setIsMicActive(false);
          resetVoicePlaybackState();

          logger.warn(
            'AIAgent',
            '⚠️ Voice connection dropped unexpectedly — attempting reconnect in 2s...'
          );

          // Auto-reconnect after short delay
          if (voiceReconnectTimeoutRef.current) return;
          voiceReconnectTimeoutRef.current = setTimeout(() => {
            voiceReconnectTimeoutRef.current = null;
            if (
              isCurrentVoiceSession() &&
              mode === 'voice' &&
              voiceServiceRef.current &&
              !voiceServiceRef.current.intentionalDisconnect &&
              voiceServiceRef.current.lastCallbacks
            ) {
              logger.info('AIAgent', '🔄 Reconnecting VoiceService...');
              void voiceServiceRef.current.connect(
                voiceServiceRef.current.lastCallbacks
              );
            }
          }, 2000);
        }
      },
      onTranscript: (text, isFinal, role) => {
        if (!isCurrentVoiceSession()) return;
        logger.info(
          'AIAgent',
          `Transcript [${role}] (final=${isFinal}): "${text}"`
        );
        if (isFinal) appendVoiceTranscript(role, text);
        if (role === 'user') {
          userHasSpokenRef.current = true;
        }
      },
      onSetupComplete: () => {
        if (!isCurrentVoiceSession()) return;
        logger.info(
          'AIAgent',
          '✅ SDK setup complete — sending initial screen context now'
        );
        const initialContext = runtime.getScreenContext();
        lastScreenContextRef.current = initialContext; // Seed for screen change detection
        const passiveContext = `[SYSTEM CONTEXT — THIS IS NOT A USER REQUEST. DO NOT RESPOND. DO NOT NAVIGATE. DO NOT CALL ANY TOOLS. DO NOT SPEAK. Just silently read and memorize this screen layout. You will use it when the user speaks their first voice command.]\n\n${initialContext}`;
        logger.info(
          'AIAgent',
          `📡 Initial screen context (${passiveContext.length} chars):\n${passiveContext}`
        );
        voiceServiceRef.current?.sendScreenContext(passiveContext);
        logger.info(
          'AIAgent',
          '📡 Initial screen context sent (passive, turnComplete=false)'
        );
      },
      onToolCall: async (toolCall) => {
        if (!isCurrentVoiceSession()) return;
        logger.info(
          'AIAgent',
          `🔧 Voice tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)}) [id=${toolCall.id}]`
        );

        if (toolCall.name === VOICE_PERMISSION_TOOL_NAME) {
          const rawQuestion = toolCall.args?.question;
          const question =
            typeof rawQuestion === 'string' && rawQuestion.trim()
              ? rawQuestion.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim()
              : 'The AI agent is requesting permission to perform this action.';

          pendingVoicePermissionToolRef.current = {
            name: toolCall.name,
            id: toolCall.id,
          };
          audioInputRef.current?.stop();
          setIsMicActive(false);
          setPendingApprovalQuestion(question);
          setAutoExpandTrigger((prev) => prev + 1);
          setIsThinking(false);
          setIsActing(false);
          setStatusText('');
          telemetryRef.current?.track('agent_trace', {
            stage: 'voice_permission_prompt_rendered',
            question,
            toolName: toolCall.name,
            toolCallId: toolCall.id,
          });
          return;
        }

        // Code-level gate: reject tool calls before the user has spoken.
        // The model sometimes auto-navigates on receiving screen context.
        if (!userHasSpokenRef.current) {
          logger.warn(
            'AIAgent',
            `🚫 Rejected tool call ${toolCall.name} — user hasn't spoken yet`
          );
          voiceServiceRef.current?.sendFunctionResponse(
            toolCall.name,
            toolCall.id,
            {
              result:
                'Action rejected: wait for the user to speak before performing any actions.',
            }
          );
          return;
        }

        if (
          UI_ACTION_TOOL_NAMES.has(toolCall.name) &&
          !runtime.hasVoiceWorkflowApproval()
        ) {
          const args = toolCall.args ?? {};
          pendingVoiceActionToolRef.current = {
            name: toolCall.name,
            id: toolCall.id,
            args,
          };
          audioInputRef.current?.stop();
          setIsMicActive(false);
          const question = buildVoiceActionPermissionQuestion(toolCall.name, args);
          setPendingApprovalQuestion(question);
          setAutoExpandTrigger((prev) => prev + 1);
          setIsThinking(false);
          setIsActing(false);
          setStatusText('');
          telemetryRef.current?.track('agent_trace', {
            stage: 'voice_direct_app_action_permission_rendered',
            toolName: toolCall.name,
            toolCallId: toolCall.id,
          });
          return;
        }

        // CRITICAL: Gate audio input during tool execution.
        // The Gemini Live API crashes (code 1008) if sendRealtimeInput
        // (audio) is called while a tool call is pending. Stop the mic
        // before executing the tool and resume after the response is sent.
        // One-tool-at-a-time enforcement (mirrors text mode's line 752).
        if (toolLockRef.current) {
          logger.warn(
            'AIAgent',
            `⏳ Tool locked — waiting for previous tool to finish before executing ${toolCall.name}`
          );
          while (toolLockRef.current) {
            if (!isCurrentVoiceSession()) return;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (!isCurrentVoiceSession()) return;
        }
        toolLockRef.current = true;
        await audioInputRef.current?.stop();
        if (!isCurrentVoiceSession()) {
          toolLockRef.current = false;
          return;
        }
        setIsMicActive(false);
        logger.info(
          'AIAgent',
          `🔇 Mic paused for tool execution: ${toolCall.name}`
        );

        try {
          // Trigger visual 'thinking' overlay down to ChatBar so user knows action is happening
          setIsThinking(true);
          setIsActing(UI_ACTION_TOOL_NAMES.has(toolCall.name));
          const toolNameFriendly = toolCall.name.replace(/_/g, ' ');
          setStatusText(`Executing ${toolNameFriendly}...`);

          // Execute the tool via AgentRuntime and send result back to Gemini
          const result = await runtime.executeTool(
            toolCall.name,
            toolCall.args
          );
          if (!isCurrentVoiceSession()) return;
          logger.info(
            'AIAgent',
            `🔧 Tool result for ${toolCall.name}: ${result}`
          );

          // Brief pause so the app can commit the tool result before sending context.
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (!isCurrentVoiceSession()) return;

          // Include updated screen context IN the tool response
          const updatedContext = runtime.getScreenContext();
          lastScreenContextRef.current = updatedContext; // Sync with poll tracker
          logger.info(
            'AIAgent',
            `📡 Updated screen context after ${toolCall.name} (${updatedContext.length} chars):\n${updatedContext}`
          );
          const enrichedResult = `${result}\n\n<updated_screen>\n${updatedContext}\n</updated_screen>`;
          logger.info(
            'AIAgent',
            `📡 Enriched tool response (${enrichedResult.length} chars):\n${enrichedResult}`
          );

          voiceServiceRef.current?.sendFunctionResponse(
            toolCall.name,
            toolCall.id,
            { result: enrichedResult }
          );
          logger.info(
            'AIAgent',
            `📡 Tool response sent for ${toolCall.name} [id=${toolCall.id}]`
          );
        } finally {
          toolLockRef.current = false;
          setIsActing(false);
          setIsThinking(false);
          setStatusText('');

          // Resume mic after tool response is sent
          if (voiceServiceRef.current?.isConnected) {
            audioInputRef.current?.start().then((ok) => {
              if (ok && isCurrentVoiceSession()) {
                setIsMicActive(true);
                logger.info(
                  'AIAgent',
                  `🔊 Mic resumed after tool execution: ${toolCall.name}`
                );
              }
            });
          }
        }
      },
      onError: (err) => {
        if (!isCurrentVoiceSession()) return;
        const isRecoverableConnectionLoss =
          typeof err === 'string' &&
          /Connection lost \(code: (1001|1008|1011)\)/.test(err);
        if (isRecoverableConnectionLoss) {
          logger.warn('AIAgent', `VoiceService connection closed: ${err}`);
        } else {
          logger.error('AIAgent', `VoiceService error: ${err}`);
        }
        // Stop mic & audio on error to prevent stale state
        audioInputRef.current?.stop();
        audioOutputRef.current?.stop();
        setIsMicActive(false);
        resetVoicePlaybackState();
      },
      onTurnComplete: () => {
        if (!isCurrentVoiceSession()) return;
        logger.info('AIAgent', 'AI turn complete');
        if (isAISpeakingRef.current || voicePlaybackDrainUntilRef.current > Date.now()) {
          scheduleVoicePlaybackDrain();
          return;
        }
        resetVoicePlaybackState();
      },
    });

    // ─── Screen Change Detection ───────────────────────────────
    // Poll the Fiber tree every 5s and resend context if the screen meaningfully changed.
    // This gives voice mode the same screen-awareness as text mode's per-step re-read.
    const SCREEN_POLL_INTERVAL = 5000;
    const MIN_DIFF_RATIO = 0.05; // Ignore changes smaller than 5% of total length (animation flicker)

    screenPollIntervalRef.current = setInterval(() => {
      if (!isCurrentVoiceSession()) return;
      if (!voiceServiceRef.current?.isConnected) return;
      if (isMicActiveRef.current || isAISpeakingRef.current) {
        logger.debug(
          'AIAgent',
          '🔄 Screen poll skipped — realtime voice input/output active'
        );
        return;
      }
      // Skip during tool execution — the enriched tool response handles that
      if (
        toolLockRef.current ||
        pendingVoicePermissionToolRef.current ||
        pendingVoiceActionToolRef.current
      ) {
        logger.debug('AIAgent', '🔄 Screen poll skipped — voice tool/approval pending');
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
          logger.debug(
            'AIAgent',
            `🔄 Screen poll: minor change ignored (${diff} chars, ${(diffRatio * 100).toFixed(1)}% < ${MIN_DIFF_RATIO * 100}% threshold)`
          );
          return;
        }

        logger.info(
          'AIAgent',
          `🔄 Screen change detected (${lastLen} → ${currentContext.length} chars, ${(diffRatio * 100).toFixed(1)}% diff)`
        );
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
      logger.info(
        'AIAgent',
        `Cleaning up voice services (leaving "${mode}" mode)`
      );
      // Stop screen change polling
      if (screenPollIntervalRef.current) {
        clearInterval(screenPollIntervalRef.current);
        screenPollIntervalRef.current = null;
        logger.info('AIAgent', '🔄 Screen poll stopped');
      }
      if (voiceReconnectTimeoutRef.current) {
        clearTimeout(voiceReconnectTimeoutRef.current);
        voiceReconnectTimeoutRef.current = null;
      }
      lastScreenContextRef.current = '';
      voiceSessionActiveRef.current = false;
      pendingVoicePermissionToolRef.current = null;
      pendingVoiceActionToolRef.current = null;
      voiceServiceRef.current?.disconnect();
      voiceServiceRef.current = null;
      audioInputRef.current?.stop();
      audioInputRef.current = null;
      audioOutputRef.current?.stop();
      audioOutputRef.current?.cleanup();
      audioOutputRef.current = null;
      setIsMicActive(false);
      resetVoicePlaybackState();
      setIsVoiceConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    apiKey,
    resolvedVoiceProxyUrl,
    voiceProxyHeaders,
    proxyHeaders,
    runtime,
    resolvedInstructions,
    effectiveSupportStyle,
    knowledgeBase,
    appendVoiceTranscript,
  ]);

  // ─── Stop Voice Session (full cleanup) ─────────────────────

  const stopVoiceSession = useCallback(() => {
    logger.info('AIAgent', '🛑 Stopping voice session (full cleanup)...');
    const pendingVoicePermission = pendingVoicePermissionToolRef.current;
    const pendingVoiceAction = pendingVoiceActionToolRef.current;
    if (pendingVoicePermission || pendingVoiceAction) {
      runtime.rejectVoiceWorkflowApproval();
      const pendingTool = pendingVoicePermission ?? pendingVoiceAction;
      if (pendingTool && voiceServiceRef.current?.isConnected) {
        voiceServiceRef.current.sendFunctionResponse(pendingTool.name, pendingTool.id, {
          result: 'User declined the requested app action. Do not perform it.',
        });
      }
    }
    voiceSessionActiveRef.current = false;
    voiceSessionGenerationRef.current += 1;
    toolLockRef.current = false;
    if (screenPollIntervalRef.current) {
      clearInterval(screenPollIntervalRef.current);
      screenPollIntervalRef.current = null;
    }
    if (voiceReconnectTimeoutRef.current) {
      clearTimeout(voiceReconnectTimeoutRef.current);
      voiceReconnectTimeoutRef.current = null;
    }
    // 1. Stop mic input
    audioInputRef.current?.stop();
    audioInputRef.current = null;
    // 2. Stop audio output (clear queued chunks)
    audioOutputRef.current?.stop();
    audioOutputRef.current?.cleanup();
    audioOutputRef.current = null;
    // 3. Disconnect WebSocket
    voiceServiceRef.current?.disconnect();
    voiceServiceRef.current = null;
    // 4. Reset state
    setIsMicActive(false);
    resetVoicePlaybackState();
    setIsVoiceConnected(false);
    pendingVoicePermissionToolRef.current = null;
    pendingVoiceActionToolRef.current = null;
    setPendingApprovalQuestion(null);
    setIsThinking(false);
    setIsActing(false);
    setStatusText('');
    // 6. Switch back to text mode (triggers cleanup effect naturally)
    setMode('text');
    logger.info('AIAgent', '🛑 Voice session fully stopped');
  }, [runtime, resetVoicePlaybackState]);

  // ─── Execute ──────────────────────────────────────────────────

  const handleSend = useCallback(
    async (
      message: string,
      imagesOrOptions?: UserImage[] | { onResult?: (result: ExecutionResult) => void },
      maybeOptions?: { onResult?: (result: ExecutionResult) => void },
    ) => {
      const images = Array.isArray(imagesOrOptions) ? imagesOrOptions : undefined;
      const options = Array.isArray(imagesOrOptions) ? maybeOptions : imagesOrOptions;
      if (!message.trim() && (!images || images.length === 0)) return;

      // When the user sends images while the agent is mid-task (e.g. initial
      // greeting), cancel the running execution so we can start a fresh one
      // that includes the images as inlineData.
      if (isThinking && images?.length) {
        logger.info('AIAgent', 'User sent images while agent thinking — cancelling current task to start fresh with images');
        const targetRuntime = activeRuntimeRef.current ?? runtime;
        await targetRuntime.cancelAndWait();
        setIsThinking(false);
        setStatusText('');
      } else if (isThinking) {
        return;
      }

      // ── Apple Guideline 5.1.2(i): Consent gate ──────────────────
      // If consent is required but not yet granted, show the consent dialog
      // instead of sending data to the AI provider.
      if (consentGateActive) {
        pendingConsentSendRef.current = {
          message: message.trim(),
          images,
          options,
        };
        setShowConsentDialog(true);
        return;
      }

      logger.info('AIAgent', `User message: "${message}"`);
      setLastUserMessage(message.trim());

      // Append user message to AI thread (with image nodes if present)
      const userContentNodes: import('../core/types').AIRichNode[] = [];
      if (images?.length) {
        for (const img of images) {
          userContentNodes.push(createImageNode(`data:${img.mimeType};base64,${img.base64}`, img.mimeType, img.base64, `img-${Date.now()}-${Math.random()}`));
        }
      }
      userContentNodes.push({ type: 'text', content: message.trim(), id: `text-${Date.now()}` });
      setMessages((prev) => [
        ...prev,
        createAIMessage({
          id: Date.now().toString() + Math.random(),
          role: 'user',
          content: userContentNodes,
          previewText: message.trim() || '[Image]',
          timestamp: Date.now(),
        }),
      ]);

      // If there's a pending ask_user, resolve it instead of starting a new execution.
      // EXCEPTION: when the user attaches images, skip the resolver and start a fresh
      // execution so the images reach the provider as inlineData (the resolver only
      // passes plain text back to the running agent loop).
      if (askUserResolverRef.current && !images?.length) {
        if (pendingAskUserKindRef.current === 'approval') {
          const resolver = askUserResolverRef.current;
          askUserResolverRef.current = null;
          pendingAskUserKindRef.current = null;
          pendingAppApprovalRef.current = false; // CRITICAL FIX: Unlock the agent state
          setPendingApprovalQuestion(null);

          // Pass the user's conversational message directly back to the active prompt resolver.
          // It will NOT be treated as a rejection! It will be passed back to the LLM.
          telemetryRef.current?.track('agent_trace', {
            stage: 'approval_interrupted_by_user_question',
            message: message.trim(),
          });

          setIsThinking(true);
          setStatusText('Thinking...');
          setLastResult(null);
          resolver(message.trim());
          return;
        }
        const resolver = askUserResolverRef.current;
        askUserResolverRef.current = null;
        pendingAskUserKindRef.current = null;
        pendingAppApprovalRef.current = false; // CRITICAL FIX: Unlock the agent state
        setPendingApprovalQuestion(null);
        setIsThinking(true);
        setStatusText('Thinking...');
        setLastResult(null);
        logger.info(
          'AIAgent',
          `✅ Resolving pending ask_user with: "${message.trim()}"`
        );
        telemetryRef.current?.track('agent_trace', {
          stage: 'ask_user_answer_submitted',
          answer: message.trim(),
          mode,
        });
        resolver(message);
        return;
      }
      // When images are present during a pending ask_user, resolve the
      // promise (unblocking the execution loop), cancel+wait for it to
      // finish, then fall through to start a fresh execution with images.
      if (askUserResolverRef.current && images?.length) {
        logger.info('AIAgent', 'Bypassing ask_user resolver — user attached images, starting fresh execution');
        const resolver = askUserResolverRef.current;
        askUserResolverRef.current = null;
        pendingAskUserKindRef.current = null;
        pendingAppApprovalRef.current = false;
        setPendingApprovalQuestion(null);
        resolver('__CANCELLED__');
        const targetRuntime = activeRuntimeRef.current ?? runtime;
        await targetRuntime.cancelAndWait();
      }

      // Guard: if we're mid-approval flow (waiting for button tap) but no resolver exists yet
      // (agent is still thinking between ask_user calls), do NOT start a new task —
      // that would spawn two concurrent agent loops and freeze the app.
      // Instead, store the message as a queued answer that will auto-resolve on the next ask_user.
      if (pendingAppApprovalRef.current) {
        logger.warn(
          'AIAgent',
          '⚠️ User typed during active approval flow — queuing message, not spawning new task'
        );
        queuedApprovalAnswerRef.current = message.trim();
        return;
      }

      // Normal execution — new task
      // Reset approval gate refs so previous conversations don't bleed state
      pendingAppApprovalRef.current = false;
      queuedApprovalAnswerRef.current = null;
      setIsThinking(true);
      setStatusText('Looking at your screen...');
      setLastResult(null);
      const requestStartedAt = Date.now();
      logger.info(
        'AIAgent',
        `📨 New user request received in ${mode} mode | interactionMode=${interactionMode || 'copilot(default)'} | text="${message.trim()}"`
      );

      // Telemetry: track agent request
      telemetryRef.current?.track('agent_request', {
        canonical_type: 'ai_question_asked',
        query: message.trim(),
        transcript: message.trim(),
        request_topic: message.trim().slice(0, 120),
        mode,
      });
      telemetryRef.current?.track('agent_trace', {
        stage: 'request_received',
        query: message.trim(),
        mode,
        interactionMode: interactionMode || 'copilot',
      });

      try {
        // Ensure we have the latest Fiber tree ref
        const executingRuntime = runtime;
        activeRuntimeRef.current = executingRuntime;
        executingRuntime.updateRefs(rootViewRef.current, navRef);

        const result = await executingRuntime.execute(
          message,
          messages.map((entry) => ({
            role: entry.role,
            content: entry.previewText,
          })),
          images,
        );
        const normalizedResult = normalizeExecutionResult(result);

        // Telemetry: track agent completion and per-step details
        if (telemetryRef.current) {
          if (!agentFrtFiredRef.current) {
            agentFrtFiredRef.current = true;
            telemetryRef.current.track('agent_first_response', {
              canonical_type: 'ai_first_response_sent',
            });
          }

          for (const step of normalizedResult.steps ?? []) {
            telemetryRef.current.track('agent_step', {
              stepIndex: step.stepIndex,
              tool: step.action.name,
              args: step.action.input,
              result:
                typeof step.action.output === 'string'
                  ? step.action.output
                  : String(step.action.output),
              plan: step.reflection.plan,
              memory: step.reflection.memory,
              previousGoalEval: step.reflection.previousGoalEval,
            });
          }
          telemetryRef.current.track('agent_complete', {
            canonical_type: normalizedResult.success
              ? 'ai_answer_completed'
              : 'ai_answer_failed',
            success: normalizedResult.success,
            resolved: normalizedResult.success,
            resolution_type: normalizedResult.success
              ? 'ai_resolved'
              : 'needs_follow_up',
            latency_ms: Date.now() - requestStartedAt,
            request_topic: message.trim().slice(0, 120),
            steps: normalizedResult.steps?.length ?? 0,
            tokens: normalizedResult.tokenUsage?.totalTokens ?? 0,
            cost: normalizedResult.tokenUsage?.estimatedCostUSD ?? 0,
            response: normalizedResult.message,
            conversation: {
              user: message.trim(),
              assistant: normalizedResult.message,
            },
          });
        }

        logger.info(
          'AIAgent',
          '★ handleSend — SETTING lastResult:',
          normalizedResult.message.substring(0, 80),
          '| mode:',
          mode
        );

        // No satisfaction survey after a handoff to a human.
        const stepsHadEscalation = normalizedResult.steps?.some(
          (s) => s.action.name === 'escalate_to_human'
        );
        setLastResult(normalizedResult);

        const assistantMsg: AIMessage = createAIMessage({
          id: Date.now().toString() + Math.random(),
          role: 'assistant',
          content: normalizedResult.reply || normalizedResult.message,
          previewText: normalizedResult.previewText || normalizedResult.message,
          timestamp: Date.now(),
          result: normalizedResult,
        });

        // Skip if this exact text was already mirrored mid-loop (e.g. the
        // scroll-loop convergence reuses the last guide_user finding as its
        // reply) — avoids a duplicate bubble.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.role === 'assistant' &&
            (last.previewText || '').trim() ===
              (assistantMsg.previewText || '').trim()
          ) {
            return prev;
          }
          return [...prev, assistantMsg];
        });

        if (options?.onResult) {
          options.onResult(normalizedResult);
        } else {
          onResult?.(normalizedResult);
        }

        // ─── CSAT survey trigger ─────────────────────────────────
        if (
          normalizedResult.success &&
          supportMode?.csat?.enabled !== false &&
          supportMode?.enabled &&
          !stepsHadEscalation
        ) {
          const idleDelay = (supportMode.csat?.showAfterIdleSeconds ?? 10) * 1000;
          setTimeout(() => setShowCSAT(true), idleDelay);
        }

        logger.info(
          'AIAgent',
          `Result: ${normalizedResult.success ? '✅' : '❌'} ${normalizedResult.message}`
        );
      } catch (error: any) {
        logger.error('AIAgent', 'Execution failed:', error);

        // Telemetry: track agent failure
        telemetryRef.current?.track('agent_complete', {
          canonical_type: 'ai_answer_failed',
          success: false,
          resolved: false,
          resolution_type: 'execution_error',
          latency_ms: Date.now() - requestStartedAt,
          request_topic: message.trim().slice(0, 120),
          error: error.message,
          response: `Error: ${error.message}`,
          conversation: {
            user: message.trim(),
            assistant: `Error: ${error.message}`,
          },
        });

        setLastResult({
          success: false,
          message: `Error: ${error.message}`,
          steps: [],
        });
      } finally {
        if (activeRuntimeRef.current === runtime) {
          activeRuntimeRef.current = null;
        }
        setIsActing(false);
        setIsThinking(false);
        setStatusText('');
      }
    },
    [runtime, navRef, onResult, messages, isThinking, consentGateActive]
  );

  useEffect(() => {
    if (consentGateActive) return;
    const pending = pendingConsentSendRef.current;
    if (!pending) return;

    pendingConsentSendRef.current = null;
    void handleSend(pending.message, pending.images, pending.options);
  }, [consentGateActive, handleSend]);

  useEffect(() => {
    if (isThinking) return;
    const pending = pendingFollowUpAfterApprovalRef.current;
    if (!pending) return;

    pendingFollowUpAfterApprovalRef.current = null;
    void handleSend(pending.message, pending.images, pending.options);
  }, [isThinking, handleSend]);

  // ─── Context value (for useAI bridge) ─────────────────────────

  const handleCancel = useCallback(() => {
    const targetRuntime = activeRuntimeRef.current ?? runtime;

    if (pendingApprovalQuestion) {
      const resolver = askUserResolverRef.current;
      const pendingVoicePermission = pendingVoicePermissionToolRef.current;
      const pendingVoiceAction = pendingVoiceActionToolRef.current;
      targetRuntime.cancel();

      askUserResolverRef.current = null;
      pendingAskUserKindRef.current = null;
      pendingAppApprovalRef.current = false;
      queuedApprovalAnswerRef.current = null;
      pendingVoicePermissionToolRef.current = null;
      pendingVoiceActionToolRef.current = null;
      setPendingApprovalQuestion(null);
      setIsThinking(false);
      setIsActing(false);
      setStatusText('');

      if (pendingVoicePermission || pendingVoiceAction) {
        targetRuntime.rejectVoiceWorkflowApproval();
        const pendingTool = pendingVoicePermission ?? pendingVoiceAction;
        if (pendingTool) {
          voiceServiceRef.current?.sendFunctionResponse(
            pendingTool.name,
            pendingTool.id,
            {
              result:
                'User declined the requested app action. Do not perform it.',
            }
          );
        }
        if (mode === 'voice') {
          stopVoiceSession();
        }
        return;
      }

      resolver?.('__APPROVAL_REJECTED__');
      return;
    }

    if (mode === 'voice') {
      targetRuntime.cancel();
      stopVoiceSession();
      return;
    }

    targetRuntime.cancel();
    setStatusText('Stopping...');
  }, [mode, pendingApprovalQuestion, runtime, stopVoiceSession]);

  // ─── Conversation History Handlers ─────────────────────────────

  const handleConversationSelect = useCallback(
    async (conversationId: string) => {
      const msgs = await ConversationService.loadConversation(
        conversationStore,
        conversationId
      );
      if (!msgs) return;
      clearPendingConversationSave();
      conversationGenerationRef.current += 1;
      activeConversationIdRef.current = conversationId;
      lastSavedMessageCountRef.current = msgs.length;
      setMessages(msgs);
      setLastResult(null);
    },
    [conversationStore, clearPendingConversationSave]
  );

  const handleNewConversation = useCallback(() => {
    clearMessages();
    setLastUserMessage(null);
  }, [clearMessages]);

  const handlePendingApprovalAction = useCallback(
    async (action: 'approve' | 'reject') => {
      const resolver = askUserResolverRef.current;
      const pendingVoicePermission = pendingVoicePermissionToolRef.current;
      const pendingVoiceAction = pendingVoiceActionToolRef.current;
      logger.info(
        'AIAgent',
        `🔘 Approval button tapped: action=${action} | resolver=${resolver ? 'EXISTS' : 'NULL'} | voiceTool=${pendingVoicePermission ? 'EXISTS' : 'NULL'} | voiceAction=${pendingVoiceAction ? 'EXISTS' : 'NULL'} | pendingApprovalQuestion="${pendingApprovalQuestion}" | pendingAppApprovalRef=${pendingAppApprovalRef.current}`
      );

      if (!resolver && !pendingVoicePermission && !pendingVoiceAction) {
        logger.warn(
          'AIAgent',
          'Ignoring stale approval button tap; approval was already resolved.'
        );
        return;
      }

      askUserResolverRef.current = null;
      pendingAskUserKindRef.current = null;
      pendingAppApprovalRef.current = false;
      queuedApprovalAnswerRef.current = null;
      pendingVoicePermissionToolRef.current = null;
      pendingVoiceActionToolRef.current = null;
      setPendingApprovalQuestion(null);

      const approvalLabel = action === 'approve' ? 'Allow' : "Don’t Allow";
      if (!pendingVoicePermission && !pendingVoiceAction) {
        setLastUserMessage(approvalLabel);
        setMessages((prev) => [
          ...prev,
          createAIMessage({
            id: `user-approval-${Date.now()}`,
            role: 'user',
            content: approvalLabel,
            previewText: approvalLabel,
            timestamp: Date.now(),
            promptKind: 'approval',
          }),
        ]);
      }

      const response =
        action === 'approve'
          ? '__APPROVAL_GRANTED__'
          : '__APPROVAL_REJECTED__';
      if (action === 'approve') {
        setIsThinking(true);
        setStatusText('Thinking...');
      }
      telemetryRef.current?.track('agent_trace', {
        stage: 'approval_button_pressed',
        action,
        renderedAnswer: approvalLabel,
      });

      if (pendingVoiceAction) {
        if (action !== 'approve') {
          runtime.rejectVoiceWorkflowApproval();
          voiceServiceRef.current?.sendFunctionResponse(
            pendingVoiceAction.name,
            pendingVoiceAction.id,
            {
              result:
                'User declined the requested app action. Do not perform it.',
            }
          );
          return;
        }

        runtime.grantVoiceWorkflowApproval();
        const actionGeneration = voiceSessionGenerationRef.current;
        const isSameVoiceSession = () =>
          voiceSessionActiveRef.current &&
          voiceSessionGenerationRef.current === actionGeneration;
        toolLockRef.current = true;
        setIsActing(UI_ACTION_TOOL_NAMES.has(pendingVoiceAction.name));
        const toolNameFriendly = pendingVoiceAction.name.replace(/_/g, ' ');
        setStatusText(`Executing ${toolNameFriendly}...`);

        try {
          const result = await runtime.executeTool(
            pendingVoiceAction.name,
            pendingVoiceAction.args
          );
          if (!isSameVoiceSession()) return;
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (!isSameVoiceSession()) return;
          const updatedContext = runtime.getScreenContext();
          lastScreenContextRef.current = updatedContext;
          const enrichedResult = `${result}\n\n<updated_screen>\n${updatedContext}\n</updated_screen>`;
          voiceServiceRef.current?.sendFunctionResponse(
            pendingVoiceAction.name,
            pendingVoiceAction.id,
            { result: enrichedResult }
          );
        } finally {
          toolLockRef.current = false;
          setIsActing(false);
          setIsThinking(false);
          setStatusText('');

          if (isSameVoiceSession() && voiceServiceRef.current?.isConnected) {
            audioInputRef.current?.start().then((ok) => {
              if (ok && isSameVoiceSession()) {
                setIsMicActive(true);
                logger.info(
                  'AIAgent',
                  `🔊 Mic resumed after approved voice action: ${pendingVoiceAction.name}`
                );
              }
            });
          }
        }
        return;
      }

      if (pendingVoicePermission) {
        if (action === 'approve') {
          runtime.grantVoiceWorkflowApproval();
        } else {
          runtime.rejectVoiceWorkflowApproval();
        }
        voiceServiceRef.current?.sendFunctionResponse(
          pendingVoicePermission.name,
          pendingVoicePermission.id,
          {
            result:
              action === 'approve'
                ? 'User approved the requested app action. Continue with the approved action.'
                : 'User declined the requested app action. Do not perform it.',
          }
        );
        if (voiceServiceRef.current?.isConnected) {
          audioInputRef.current?.start().then((ok) => {
            if (ok && voiceSessionActiveRef.current) {
              setIsMicActive(true);
            }
          });
        }
        return;
      }

      resolver?.(response);
    },
    [pendingApprovalQuestion, runtime]
  );

  const contextValue = useMemo(
    () => ({
      runtime,
      send: handleSend,
      isLoading: isThinking,
      status: statusText,
      lastResult,
      messages,
      clearMessages,
      cancel: handleCancel,
    }),
    [
      runtime,
      handleSend,
      handleCancel,
      isThinking,
      statusText,
      lastResult,
      messages,
      clearMessages,
    ]
  );
  const richBlocks = useMemo(
    () => [
      FactCardDefinition,
      ProductCardDefinition,
      ActionCardDefinition,
      ComparisonCardDefinition,
      FormCardDefinition,
      ...(blocks || []),
    ],
    [blocks]
  );

  // ─── CSAT survey element ────────────────────────────────────

  const csatElement = showCSAT && supportMode?.csat ? (
    <CSATSurvey
      config={{
        ...supportMode.csat,
        onSubmit: (rating: CSATRating) => {
          supportMode.csat!.onSubmit?.(rating);
          telemetryRef.current?.track('csat_submitted', {
            score: rating.score,
            surveyType: supportMode.csat!.surveyType ?? 'csat',
          });
        },
      }}
      metadata={{
        conversationDuration: Date.now() - conversationStartRef.current,
        stepsCount: messages.filter((m) => m.role === 'assistant').length,
        wasEscalated: messages.some((m) =>
          m.result?.steps?.some((step) => step.action.name === 'escalate_to_human')
        ),
        screen: getResolvedScreenName(),
      }}
      onDismiss={() => setShowCSAT(false)}
      onTrack={(type, data) => telemetryRef.current?.track(type, data)}
    />
  ) : null;

  // ─── Render ──────────────────────────────────────────────────

  return (
    <AgentContext.Provider value={contextValue}>
      <RichUIProvider
        blocks={richBlocks}
        theme={richUITheme}
        surfaceThemes={richUISurfaceThemes}
      >
        <ActionBridgeProvider handlers={blockActionHandlers}>
      <View style={styles.root}>
        {/* App content — rootViewRef captures Fiber tree for element detection */}
        <View
          ref={rootViewRef}
          style={styles.root}
          collapsable={false}
          onStartShouldSetResponderCapture={(event) => {
            // Auto-capture every tap for analytics (zero-config)
            // Skip if the AI agent is currently executing a tool — those are
            // already tracked as `agent_step` events with full context.
            if (telemetryRef.current && !telemetryRef.current.isAgentActing) {
              syncTelemetryScreen();
              const target = extractTouchTargetMetadata(event);
              const pageX = Math.round(event.nativeEvent.pageX);
              const pageY = Math.round(event.nativeEvent.pageY);

              if (target.label) {
                telemetryRef.current.track('user_action', {
                  canonical_type: 'button_tapped',
                  type: 'tap',
                  action: target.label,
                  label: target.label,
                  element_label: target.label,
                  element_kind: target.elementKind,
                  label_confidence: target.labelConfidence,
                  zone_id: target.zoneId,
                  ancestor_path: target.ancestorPath,
                  sibling_labels: target.siblingLabels,
                  component_name: target.componentName,
                  actor: 'user',
                  x: pageX,
                  y: pageY,
                });

                // Track if user is rage-tapping this specific element
                checkRageClick(
                  { ...target, x: pageX, y: pageY },
                  telemetryRef.current
                );
              } else {
                // Tapped an unlabelled/empty area
                telemetryRef.current.track('dead_click', {
                  canonical_type: 'dead_click_detected',
                  x: pageX,
                  y: pageY,
                  screen: telemetryRef.current.screen,
                  screen_area: 'unknown',
                  zone_id: target.zoneId,
                  ancestor_path: target.ancestorPath,
                  sibling_labels: target.siblingLabels,
                  component_name: target.componentName,
                });
              }
            }
            // IMPORTANT: return false so we don't steal the touch from the actual button
            return false;
          }}
        >
          <AgentErrorBoundary
            telemetryRef={telemetryRef}
            onError={(error, componentStack) => {
              const errorMsg = `⚠️ A rendering error occurred: ${error.message}`;
              lastAgentErrorRef.current = errorMsg;
              logger.warn(
                'AIAgent',
                `🛡️ Error caught by boundary: ${error.message}\n${componentStack || ''}`
              );
            }}
          >
            {children}
          </AgentErrorBoundary>
        </View>

        {/* Highlight Overlay (always active, listens to events) */}
        <HighlightOverlay />

        {/* Chat bar */}
        {showChatBar && (
          <FloatingOverlayWrapper
            ref={Platform.OS === 'android' ? floatingOverlayRef : undefined}
            androidWindowMetrics={
              Platform.OS === 'android'
                ? (androidWindowMetricsRef.current ?? androidWindowMetrics)
                : null
            }
            onAndroidWindowDragEnd={
              Platform.OS === 'android' ? handleAndroidWindowDragEnd : undefined
            }
            fallbackStyle={styles.floatingLayer}
          >
            {Platform.OS === 'android' ? (
              <AgentChatBar
                onSend={handleSend}
                onCancel={handleCancel}
                isThinking={isThinking}
                isActing={isActing}
                statusText={overlayStatusText}
                lastResult={lastResult}
                lastUserMessage={lastUserMessage}
                chatMessages={messages}
                voiceTranscripts={voiceTranscripts}
                pendingApprovalQuestion={pendingApprovalQuestion}
                onPendingApprovalAction={handlePendingApprovalAction}
                language={'en'}
                onDismiss={() => {
                  setLastResult(null);
                  setLastUserMessage(null);
                }}
                theme={
                  accentColor || theme
                    ? {
                        ...(accentColor ? { primaryColor: accentColor } : {}),
                        ...theme,
                      }
                    : undefined
                }
                availableModes={availableModes}
                mode={mode}
                onModeChange={(newMode) => {
                  logger.info(
                    'AIAgent',
                    '★ onModeChange:',
                    mode,
                    '→',
                    newMode,
                  );
                  setMode(newMode);
                }}
                isMicActive={isMicActive}
                isSpeakerMuted={isSpeakerMuted}
                isAISpeaking={isAISpeaking}
                onStopSession={stopVoiceSession}
                isVoiceConnected={isVoiceConnected}
                onMicToggle={(active) => {
                  if (active && !isVoiceConnected) {
                    logger.warn(
                      'AIAgent',
                      'Cannot toggle mic — VoiceService not connected yet'
                    );
                    return;
                  }
                  logger.info(
                    'AIAgent',
                    `Mic toggle: ${active ? 'ON' : 'OFF'}`
                  );
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
                  logger.info(
                    'AIAgent',
                    `Speaker toggle: ${muted ? 'MUTED' : 'UNMUTED'}`
                  );
                  setIsSpeakerMuted(muted);
                  if (muted) {
                    audioOutputRef.current?.mute();
                  } else {
                    audioOutputRef.current?.unmute();
                  }
                }}
                autoExpandTrigger={autoExpandTrigger}
                showDiscoveryTooltip={tooltipVisible}
                discoveryTooltipMessage={discoveryTooltipMessage}
                onTooltipDismiss={handleTooltipDismiss}
                conversations={conversations}
                isLoadingHistory={isLoadingHistory}
                onConversationSelect={handleConversationSelect}
                onNewConversation={handleNewConversation}
                renderMode="android-native-window"
                windowMetrics={
                  androidWindowMetricsRef.current ?? androidWindowMetrics
                }
                onWindowMetricsChange={handleAndroidWindowMetricsChange}
                consentVisible={showConsentDialog}
                consentProvider={providerName}
                consentConfig={consentConfig}
                onConsentApprove={async () => {
                  await grantConsent();
                  setShowConsentDialog(false);
                  consentConfig.onConsent?.();
                  logger.info('AIAgent', '✅ AI consent granted by user');
                }}
                onConsentDecline={() => {
                  setShowConsentDialog(false);
                  consentConfig.onDecline?.();
                  logger.info('AIAgent', '❌ AI consent declined by user');
                }}
                onQuickActionsPress={
                  supportMode?.quickActions?.enabled
                    ? () => setShowQuickActions(true)
                    : undefined
                }
                afterMessagesContent={csatElement}
              />
            ) : (
              <ProactiveHint
                stage={proactiveStage}
                badgeText={proactiveBadgeText}
                onDismiss={() => idleDetectorRef.current?.dismiss()}
              >
                <AgentChatBar
                  onSend={handleSend}
                  onCancel={handleCancel}
                  isThinking={isThinking}
                  isActing={isActing}
                  statusText={overlayStatusText}
                  lastResult={lastResult}
                  lastUserMessage={lastUserMessage}
                  chatMessages={messages}
                  voiceTranscripts={voiceTranscripts}
                  pendingApprovalQuestion={pendingApprovalQuestion}
                  onPendingApprovalAction={handlePendingApprovalAction}
                  language={'en'}
                  onDismiss={() => {
                    setLastResult(null);
                    setLastUserMessage(null);
                  }}
                  theme={
                    accentColor || theme
                      ? {
                          ...(accentColor ? { primaryColor: accentColor } : {}),
                          ...theme,
                        }
                      : undefined
                  }
                  availableModes={availableModes}
                  mode={mode}
                  onModeChange={(newMode) => {
                    logger.info(
                      'AIAgent',
                      '★ onModeChange:',
                      mode,
                      '→',
                      newMode,
                    );
                    setMode(newMode);
                  }}
                  isMicActive={isMicActive}
                  isSpeakerMuted={isSpeakerMuted}
                  isAISpeaking={isAISpeaking}
                  onStopSession={stopVoiceSession}
                  isVoiceConnected={isVoiceConnected}
                  onMicToggle={(active) => {
                    if (active && !isVoiceConnected) {
                      logger.warn(
                        'AIAgent',
                        'Cannot toggle mic — VoiceService not connected yet'
                      );
                      return;
                    }
                    logger.info(
                      'AIAgent',
                      `Mic toggle: ${active ? 'ON' : 'OFF'}`
                    );
                    setIsMicActive(active);
                    if (active) {
                      logger.info('AIAgent', 'Starting AudioInput...');
                      audioInputRef.current?.start().then((ok) => {
                        logger.info(
                          'AIAgent',
                          `AudioInput start result: ${ok}`
                        );
                      });
                    } else {
                      logger.info('AIAgent', 'Stopping AudioInput...');
                      audioInputRef.current?.stop();
                    }
                  }}
                  onSpeakerToggle={(muted) => {
                    logger.info(
                      'AIAgent',
                      `Speaker toggle: ${muted ? 'MUTED' : 'UNMUTED'}`
                    );
                    setIsSpeakerMuted(muted);
                    if (muted) {
                      audioOutputRef.current?.mute();
                    } else {
                      audioOutputRef.current?.unmute();
                    }
                  }}
                  autoExpandTrigger={autoExpandTrigger}
                  showDiscoveryTooltip={tooltipVisible}
                  discoveryTooltipMessage={discoveryTooltipMessage}
                  onTooltipDismiss={handleTooltipDismiss}
                  conversations={conversations}
                  isLoadingHistory={isLoadingHistory}
                  onConversationSelect={handleConversationSelect}
                  onNewConversation={handleNewConversation}
                  renderMode="default"
                  consentVisible={showConsentDialog}
                  consentProvider={providerName}
                  consentConfig={consentConfig}
                  onConsentApprove={async () => {
                    await grantConsent();
                    setShowConsentDialog(false);
                    consentConfig.onConsent?.();
                    logger.info('AIAgent', '✅ AI consent granted by user');
                  }}
                  onConsentDecline={() => {
                    setShowConsentDialog(false);
                    consentConfig.onDecline?.();
                    logger.info('AIAgent', '❌ AI consent declined by user');
                  }}
                  onQuickActionsPress={
                    supportMode?.quickActions?.enabled
                      ? () => setShowQuickActions(true)
                      : undefined
                  }
                  afterMessagesContent={csatElement}
                />
              </ProactiveHint>
            )}
          </FloatingOverlayWrapper>
        )}

        {/* Overlay (shown while thinking) — render after chat UI so it stays on top */}
        <AgentOverlay
          visible={overlayVisible}
          statusText={overlayStatusText}
          onCancel={handleCancel}
        />

        {/* Quick Actions self-service sheet */}
        {supportMode?.quickActions?.enabled && (
          <QuickActionsSheet
            visible={showQuickActions}
            config={supportMode.quickActions}
            currentScreen={getResolvedScreenName()}
            onClose={() => setShowQuickActions(false)}
            onChatWithAI={(context) => {
              setShowQuickActions(false);
              if (context?.topicId) {
                const topic = supportMode.quickActions!.topics.find(
                  (t) => t.id === context.topicId
                );
                const prefill = topic
                  ? `I was browsing help topic "${topic.label}"${
                      context.articleQuestion
                        ? ` — specifically "${context.articleQuestion}"`
                        : ''
                    }. I need more help.`
                  : undefined;
                if (prefill) {
                  handleSend(prefill);
                }
              }
            }}
          />
        )}

      </View>
        </ActionBridgeProvider>
      </RichUIProvider>
    </AgentContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  floatingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
});

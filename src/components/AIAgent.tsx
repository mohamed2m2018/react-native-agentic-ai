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
import { createProvider } from '../providers/ProviderFactory';
import { AgentContext } from '../hooks/useAction';
import { AgentChatBar } from './AgentChatBar';
import { AgentOverlay } from './AgentOverlay';
import { AIConsentDialog, useAIConsent } from './AIConsentDialog';
import type { AIConsentConfig } from './AIConsentDialog';
import { FloatingOverlayWrapper } from './FloatingOverlayWrapper';
import { logger } from '../utils/logger';
import { buildVoiceSystemPrompt } from '../core/systemPrompt';
import { MCPBridge } from '../core/MCPBridge';
import { VoiceService } from '../services/VoiceService';
import { AudioInputService } from '../services/AudioInputService';
import { AudioOutputService } from '../services/AudioOutputService';
import { TelemetryService, bindTelemetryService } from '../services/telemetry';
import { extractTouchLabel, checkRageClick } from '../services/telemetry/TouchAutoCapture';
import { initDeviceId, getDeviceId } from '../services/telemetry/device';
import type { AgentConfig, AgentMode, ExecutionResult, ToolDefinition, AgentStep, TokenUsage, KnowledgeBaseConfig, ChatBarTheme, AIMessage, AIProviderName, ScreenMap, ProactiveHelpConfig, InteractionMode, CustomerSuccessConfig, OnboardingConfig, ConversationSummary, AgentTraceEvent } from '../core/types';
import { AgentErrorBoundary } from './AgentErrorBoundary';
import { HighlightOverlay } from './HighlightOverlay';
import { IdleDetector } from '../core/IdleDetector';
import { ProactiveHint } from './ProactiveHint';
import { createEscalateTool } from '../support/escalateTool';
import { createReportIssueTool } from '../support/reportIssueTool';
import { EscalationSocket } from '../support/EscalationSocket';
import { EscalationEventSource } from '../support/EscalationEventSource';
import { ReportedIssueEventSource } from '../support/ReportedIssueEventSource';
import { SupportChatModal } from '../support/SupportChatModal';
import { ENDPOINTS } from '../config/endpoints';
import type { ReportedIssue } from '../support/types';
import * as ConversationService from '../services/ConversationService';
import { createMobileAIKnowledgeRetriever } from '../services/MobileAIKnowledgeRetriever';

// ─── Context ───────────────────────────────────────────────────

// ─── AsyncStorage Helper (same pattern as TicketStore) ─────────

/** Try to load AsyncStorage for tooltip persistence. Optional peer dep. */
function getTooltipStorage(): any | null {
  try {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('AsyncStorage')) return;
      origError.apply(console, args);
    };
    try {
      const mod = require('@react-native-async-storage/async-storage');
      const candidate = mod?.default ?? mod?.AsyncStorage ?? null;
      if (candidate && typeof candidate.getItem === 'function') return candidate;
      return null;
    } finally {
      console.error = origError;
    }
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
  /** Called after each step with token usage data */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** Enable SDK debug logging (disabled by default) */
  debug?: boolean;
  /**
   * Domain knowledge the AI can query via the query_knowledge tool.
   * Pass a static KnowledgeEntry[] or a { retrieve(query, screen) } function.
   * If omitted and analyticsKey is configured, the SDK will query the project
   * knowledge configured in the MobileAI dashboard automatically.
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

  // ── Analytics (opt-in) ──

  /**
   * Publishable analytics key (mobileai_pub_xxx).
   */
  analyticsKey?: string;
  /**
   * Proxy URL for enterprise customers — routes events through your backend.
   */
  analyticsProxyUrl?: string;
  /**
   * Custom headers for analyticsProxyUrl (e.g., auth tokens).
   */
  analyticsProxyHeaders?: Record<string, string>;

  /**
   * Proactive agent configuration (detects user hesitation)
   */
  proactiveHelp?: ProactiveHelpConfig;

  // ── Support Configuration ────────────

  /**
   * Identity of the logged-in user.
   * If provided, this enforces "one ticket per user" and shows the user profile
   * in the Dashboard (name, email, plan, etc.).
   */
  userContext?: {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    plan?: string;
    custom?: Record<string, string | number | boolean>;
  };

  /**
   * Device push token for offline support replies.
   * Use '@react-native-firebase/messaging' or 'expo-notifications' to get this.
   */
  pushToken?: string;

  /**
   * The type of push token provided.
   * "fcm" is recommended for universal bare/Expo support.
   */
  pushTokenType?: 'fcm' | 'expo' | 'apns';

  /**
   * Controls how the agent handles irreversible UI actions.
   * 'copilot' (default): AI pauses before final commit actions (place order, delete, submit).
   * 'autopilot': Full autonomy — all actions execute without confirmation.
   *
   * In copilot mode, the AI works silently (navigates, fills forms, scrolls) and
   * pauses ONCE before the final irreversible action. Elements with aiConfirm={true}
   * also trigger a code-level confirmation gate as a safety net.
   */
  interactionMode?: InteractionMode;

  /**
   * Show a one-time discovery tooltip above the chat FAB.
   * Tells new users the AI can navigate and interact with the app.
   * Default: true (shows once, then remembered via AsyncStorage)
   */
  showDiscoveryTooltip?: boolean;
  /**
   * Custom discovery tooltip copy shown above the chat FAB.
   * Pass a string to override the default onboarding message for this app.
   */
  discoveryTooltipMessage?: string;

  // ── Customer Success ────────────────────────────────────────

  /**
   * Health score configuration. Enable to automatically track screen
   * flow, feature adoption, and success milestones for the MobileAI Dashboard.
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
  navRef,

  maxSteps = 25,
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
  knowledgeBase,
  knowledgeMaxTokens,
  enableUIControl,
  accentColor,
  theme,
  screenMap,
  useScreenMap = true,
  maxTokenBudget,
  maxCostUSD,
  analyticsKey,
  analyticsProxyUrl,
  analyticsProxyHeaders,
  proactiveHelp,
  userContext,
  pushToken,
  pushTokenType,
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
  const consentConfig: AIConsentConfig = consent ?? { required: true, persist: false };

  // ─── AI Consent State (Apple Guideline 5.1.2(i)) ─────────────
  const [hasConsented, grantConsent, , isConsentLoading] = useAIConsent(consentConfig.persist);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const pendingConsentSendRef = useRef<{
    message: string;
    options?: { onResult?: (result: ExecutionResult) => void };
  } | null>(null);
  const pendingFollowUpAfterApprovalRef = useRef<{
    message: string;
    options?: { onResult?: (result: ExecutionResult) => void };
  } | null>(null);

  const consentGateActive = consentRequired && !hasConsented && !isConsentLoading;
  // Configure logger based on debug prop
  React.useEffect(() => {
    logger.setEnabled(debug);
    if (debug) {
      logger.info('AIAgent', '🔧 Debug logging enabled');
      logger.info(
        'AIAgent',
        `⚙️ Initial config: interactionMode=${interactionMode || 'copilot(default)'} enableVoice=${enableVoice} useScreenMap=${useScreenMap} analytics=${!!analyticsKey}`
      );
    }
  }, [debug]);

  const rootViewRef = useRef<any>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [supportMessages, setSupportMessages] = useState<AIMessage[]>([]);
  const [chatScrollTrigger, setChatScrollTrigger] = useState(0);
  // Mirror of messages for safe reading inside async callbacks (avoids setMessages abuse)
  const messagesRef = useRef<AIMessage[]>([]);

  // ── Conversation History State ────────────────────────────────
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const lastSavedMessageCountRef = useRef(0);
  const appendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep messagesRef always in sync — used by async save callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Increment scroll trigger when messages change to auto-scroll chat modal
  useEffect(() => {
    if (messages.length > 0) {
      setChatScrollTrigger(prev => prev + 1);
    }
  }, [messages.length]);

  // ── Support Modal State ──
  const [tickets, setTickets] = useState<import('../support/types').SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [supportSocket, setSupportSocket] = useState<EscalationSocket | null>(null);
  const [isLiveAgentTyping, setIsLiveAgentTyping] = useState(false);
  const [autoExpandTrigger, setAutoExpandTrigger] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const seenReportedIssueUpdatesRef = useRef<Set<string>>(new Set());
  // Ref mirrors selectedTicketId — lets socket callbacks access current value
  // without stale closures (sockets are long-lived, closures capture old state).
  const selectedTicketIdRef = useRef<string | null>(null);
  useEffect(() => { selectedTicketIdRef.current = selectedTicketId; }, [selectedTicketId]);
  // Cache of live sockets by ticketId — keeps sockets alive even when user
  // navigates back to the ticket list, so new messages still trigger badge updates.
  const pendingSocketsRef = useRef<Map<string, EscalationSocket>>(new Map());
  // SSE connections per ticket — reliable fallback for ticket_closed events
  // when the WebSocket is disconnected. EventSource auto-reconnects.
  const sseRef = useRef<Map<string, EscalationEventSource>>(new Map());
  const reportedIssuesSSERef = useRef<ReportedIssueEventSource | null>(null);
  const agentFrtFiredRef = useRef<boolean>(false);
  const humanFrtFiredRef = useRef<Record<string, boolean>>({});

  // ── Onboarding Journey State ────────────────────────────────
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentOnboardingIndex, setCurrentOnboardingIndex] = useState(0);

  useEffect(() => {
    if (!onboarding?.enabled) return;
    if (onboarding.firstLaunchOnly !== false) {
      void (async () => {
        try {
          const AS = getTooltipStorage();
          if (!AS) { setIsOnboardingActive(true); return; }
          const completed = await AS.getItem('@mobileai_onboarding_completed');
          if (!completed) setIsOnboardingActive(true);
        } catch { setIsOnboardingActive(true); }
      })();
    } else {
      setIsOnboardingActive(true);
    }
  }, [onboarding?.enabled, onboarding?.firstLaunchOnly]);

  const advanceOnboarding = useCallback(() => {
    if (!onboarding?.steps) return;
    if (currentOnboardingIndex >= onboarding.steps.length - 1) {
      setIsOnboardingActive(false);
      onboarding.onComplete?.();
      void (async () => {
        try {
          const AS = getTooltipStorage();
          await AS?.setItem('@mobileai_onboarding_completed', 'true');
        } catch { /* graceful */ }
      })();
    } else {
      setCurrentOnboardingIndex(prev => prev + 1);
    }
  }, [onboarding, currentOnboardingIndex]);

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  // ── Discovery Tooltip (one-time) ──────────────────────────
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    if (!showDiscoveryTooltipProp) return;
    void (async () => {
      try {
        const AS = getTooltipStorage();
        if (!AS) { setTooltipVisible(true); return; }
        const seen = await AS.getItem('@mobileai_tooltip_seen');
        if (!seen) setTooltipVisible(true);
      } catch {
        setTooltipVisible(true);
      }
    })();
  }, [showDiscoveryTooltipProp]);

  const handleTooltipDismiss = useCallback(() => {
    setTooltipVisible(false);
    void (async () => {
      try {
        const AS = getTooltipStorage();
        await AS?.setItem('@mobileai_tooltip_seen', 'true');
      } catch { /* graceful */ }
    })();
  }, []);

  // CRITICAL: clearSupport uses REFS and functional setters — never closure values.
  // This function is captured by long-lived callbacks (escalation sockets, restored
  // sockets) that may hold stale references. Using refs guarantees the current
  // selectedTicketId and supportSocket are always read, not snapshot values.
  const clearSupport = useCallback((ticketId?: string) => {
    if (ticketId) {
      // Remove specific ticket + its cached socket and SSE
      const cached = pendingSocketsRef.current.get(ticketId);
      if (cached) { cached.disconnect(); pendingSocketsRef.current.delete(ticketId); }
      const sse = sseRef.current.get(ticketId);
      if (sse) { sse.disconnect(); sseRef.current.delete(ticketId); }
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setUnreadCounts(prev => { const n = { ...prev }; delete n[ticketId]; return n; });

      // If user was viewing this ticket, close the support modal + switch to ticket list
      if (selectedTicketIdRef.current === ticketId) {
        setSupportSocket(prev => { prev?.disconnect(); return null; });
        setSelectedTicketId(null);
        setIsLiveAgentTyping(false);
        setMessages([]);
      }

      // If no tickets remain, switch back to text mode
      setTickets(prev => {
        if (prev.length === 0) {
          setMode('text');
        }
        return prev;
      });
    } else {
      // Clear all — disconnect every cached socket and SSE
      pendingSocketsRef.current.forEach(s => s.disconnect());
      pendingSocketsRef.current.clear();
      sseRef.current.forEach(s => s.disconnect());
      sseRef.current.clear();
      setSupportSocket(prev => { prev?.disconnect(); return null; });
      setSelectedTicketId(null);
      setTickets([]);
      setUnreadCounts({});
      setIsLiveAgentTyping(false);
      setMode('text');
    }
  }, []);

  const openSSE = useCallback((ticketId: string) => {
    if (sseRef.current.has(ticketId)) return;
    if (!analyticsKey) return;

    const sseUrl = `${ENDPOINTS.escalation}/api/v1/escalations/events?analyticsKey=${encodeURIComponent(analyticsKey)}&ticketId=${encodeURIComponent(ticketId)}`;
    const sse = new EscalationEventSource({
      url: sseUrl,
      onTicketClosed: (tid) => {
        logger.info('AIAgent', 'SSE: ticket_closed received for', tid);
        setUnreadCounts(prev => {
          const next = { ...prev };
          delete next[tid];
          return next;
        });
        clearSupport(tid);
      },
      onConnected: (tid) => {
        logger.info('AIAgent', 'SSE: connected for ticket', tid);
      },
    });
    sse.connect();
    sseRef.current.set(ticketId, sse);
    logger.info('AIAgent', 'SSE opened for ticket:', ticketId);
  }, [analyticsKey, clearSupport]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastResult(null);
  }, []);

  const applyReportedIssueUpdates = useCallback((
    nextIssues: ReportedIssue[],
    options?: { replayToChat?: boolean }
  ) => {
    const replayToChat = options?.replayToChat ?? true;

    nextIssues.forEach((issue) => {
      const history = Array.isArray(issue.statusHistory) ? issue.statusHistory : [];
      history.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const id = typeof entry.id === 'string' ? entry.id : null;
        const message = typeof entry.message === 'string' ? entry.message : null;
        if (!id || !message) return;

        if (seenReportedIssueUpdatesRef.current.has(id)) return;
        seenReportedIssueUpdatesRef.current.add(id);

        if (!replayToChat) return;

        const entryTimestamp =
          typeof entry.timestamp === 'string'
            ? new Date(entry.timestamp).getTime()
            : NaN;

        setMessages((prev) => {
          if (prev.some((msg) => msg.id === `reported-${id}`)) return prev;
          return [
            ...prev,
            {
              id: `reported-${id}`,
              role: 'assistant',
              content: message,
              timestamp: Number.isFinite(entryTimestamp) ? entryTimestamp : Date.now(),
            },
          ];
        });
      });
    });
  }, []);

  const getResolvedScreenName = useCallback(() => {
    const routeName = (navRef as any)?.getCurrentRoute?.()?.name;
    if (typeof routeName === 'string' && routeName.trim().length > 0) {
      return routeName;
    }

    const telemetryScreen = telemetryRef.current?.screen;
    if (typeof telemetryScreen === 'string' && telemetryScreen !== 'Unknown') {
      return telemetryScreen;
    }

    return 'unknown';
  }, [navRef]);

  const resolvedKnowledgeBase = useMemo(() => {
    if (knowledgeBase) return knowledgeBase;
    if (!analyticsKey) return undefined;

    return createMobileAIKnowledgeRetriever({
      publishableKey: analyticsKey,
      baseUrl: analyticsProxyUrl ?? ENDPOINTS.escalation,
      headers: analyticsProxyHeaders,
    });
  }, [analyticsKey, analyticsProxyHeaders, analyticsProxyUrl, knowledgeBase]);

  // ─── Auto-create MobileAI escalation tool ─────────────────────
  // When analyticsKey is present and consumer hasn't provided their own
  // escalate_to_human tool, auto-wire the MobileAI platform provider.
  // Human replies from the dashboard inbox are injected into chat messages.
  const autoEscalateTool = useMemo(() => {
    if (!analyticsKey) return null;
    if (customTools?.['escalate_to_human']) return null; // consumer overrides
    return createEscalateTool({
      config: { provider: 'mobileai' },
      analyticsKey,
      getContext: () => ({
        currentScreen: getResolvedScreenName(),
        originalQuery: '',
        stepsBeforeEscalation: 0,
      }),
      getHistory: () =>
        messages.map((m) => ({ role: m.role, content: m.content })),
      getToolCalls: () => {
        const toolCalls: Array<{ name: string; input: Record<string, unknown>; output: string }> = [];
        messages.forEach(m => {
          if (m.result?.steps) {
            m.result.steps.forEach(step => {
              if (step.action && step.action.name !== 'done' && step.action.name !== 'agent_step' && step.action.name !== 'escalate_to_human') {
                toolCalls.push(step.action);
              }
            });
          }
        });
        return toolCalls;
      },
      getScreenFlow: () => telemetryRef.current?.getScreenFlow() ?? [],
      userContext,
      pushToken,
      pushTokenType,
      onEscalationStarted: (tid, socket) => {
        logger.info('AIAgent', '★★★ onEscalationStarted FIRED — ticketId:', tid);
        // Cache the live socket so handleTicketSelect can reuse it without reconnecting
        pendingSocketsRef.current.set(tid, socket);
        // Open SSE for reliable ticket_closed delivery
        openSSE(tid);

        const currentScreen = getResolvedScreenName();
        setTickets(prev => {
          if (prev.find(t => t.id === tid)) {
            logger.info('AIAgent', '★★★ Ticket already in list, skipping add');
            return prev;
          }
          const newList = [{ id: tid, reason: 'Connecting to agent...', screen: currentScreen, status: 'open', history: [], createdAt: new Date().toISOString(), wsUrl: '' }, ...prev];
          logger.info('AIAgent', '★★★ Tickets updated, new length:', newList.length);
          return newList;
        });

        // Fetch real ticket data from backend to replace the placeholder
        void (async () => {
          try {
            const res = await fetch(`${ENDPOINTS.escalation}/api/v1/escalations/${tid}?analyticsKey=${encodeURIComponent(analyticsKey!)}`);
            if (res.ok) {
              const data = await res.json();
              setTickets(prev => prev.map(t => {
                if (t.id !== tid) return t;
                return {
                  ...t,
                  reason: data.reason || t.reason,
                  screen: data.screen || t.screen,
                  status: data.status || t.status,
                  history: Array.isArray(data.history) ? data.history : t.history,
                };
              }));
            }
          } catch {
            // Best-effort — placeholder is still usable
          }
        })();

        // Switch to human mode so the ticket LIST is visible — do NOT auto-select
        setMode('human');
        setAutoExpandTrigger(prev => {
          const next = prev + 1;
          logger.info('AIAgent', '★★★ autoExpandTrigger:', prev, '→', next);
          return next;
        });
        logger.info('AIAgent', '★★★ setMode("human") called from onEscalationStarted');
      },
      onHumanReply: (reply: string, ticketId?: string) => {
        if (ticketId) {
          if (!humanFrtFiredRef.current[ticketId]) {
            humanFrtFiredRef.current[ticketId] = true;
            telemetryRef.current?.track('human_first_response', { ticketId });
          }

          // Always update the ticket's history (source of truth for ticket cards)
          setTickets(prev => prev.map(t => {
            if (t.id !== ticketId) return t;
            return {
              ...t,
              history: [...(t.history || []), { role: 'live_agent', content: reply, timestamp: new Date().toISOString() }],
            };
          }));

          // Route via ref: only push to messages[] if user is viewing THIS ticket
          if (selectedTicketIdRef.current === ticketId) {
            const humanMsg: AIMessage = {
              id: `human-${Date.now()}`,
              role: 'live_agent' as any,
              content: reply,
              timestamp: Date.now(),
            };
            setSupportMessages((prev) => [...prev, humanMsg]);
            setLastResult({ success: true, message: `👤 ${reply}`, steps: [] });
          } else {
            // Not viewing this ticket — increment unread badge
            setUnreadCounts(prev => ({
              ...prev,
              [ticketId]: (prev[ticketId] || 0) + 1,
            }));
          }
        }
      },
      onTypingChange: (isTyping: boolean) => {
        setIsLiveAgentTyping(isTyping);
      },
      onTicketClosed: (ticketId?: string) => {
        logger.info('AIAgent', 'Ticket closed by agent — removing from list');
        if (ticketId) {
          setUnreadCounts(prev => {
            const next = { ...prev };
            delete next[ticketId];
            return next;
          });
        }
        clearSupport(ticketId);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsKey, customTools, getResolvedScreenName, navRef, openSSE, userContext, pushToken, pushTokenType, messages, clearSupport]);

  const autoReportIssueTool = useMemo(() => {
    if (!analyticsKey) return null;
    if (customTools?.['report_issue']) return null;
    return createReportIssueTool({
      analyticsKey,
      getCurrentScreen: getResolvedScreenName,
      getHistory: () => messages.map((m) => ({ role: m.role, content: m.content })),
      getScreenFlow: () => telemetryRef.current?.getScreenFlow() ?? [],
      userContext,
    });
  }, [analyticsKey, customTools, getResolvedScreenName, messages, userContext]);

  // ─── Load conversation history on mount ─────────────────────────
  useEffect(() => {
    if (!analyticsKey) return;

    void (async () => {
      try {
        setIsLoadingHistory(true);
        await initDeviceId();
        const deviceId = getDeviceId();
        const list = await ConversationService.fetchConversations({
          analyticsKey,
          userId: userContext?.userId,
          deviceId: deviceId || undefined,
        });
        setConversations(list);
      } catch (err) {
        logger.warn('AIAgent', 'Failed to load conversation history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsKey, userContext?.userId]);

  // ─── Restore pending tickets on app start ──────────────────────
  useEffect(() => {
    if (!analyticsKey) return;

    void (async () => {
      try {
        // Wait for the device ID to be initialised before reading it.
        // getDeviceId() is synchronous but returns null on cold start until
        // initDeviceId() resolves — awaiting here prevents an early bail-out
        // that would leave the Human tab hidden after an app refresh.
        await initDeviceId();
        const deviceId = getDeviceId();

        logger.info('AIAgent', '★ Restore check — analyticsKey:', !!analyticsKey, 'userId:', userContext?.userId, 'pushToken:', !!pushToken, 'deviceId:', deviceId);
        if (!userContext?.userId && !pushToken && !deviceId) return;

        const query = new URLSearchParams({ analyticsKey });
        if (userContext?.userId) query.append('userId', userContext.userId);
        if (pushToken) query.append('pushToken', pushToken);
        if (deviceId) query.append('deviceId', deviceId);

        const url = `${ENDPOINTS.escalation}/api/v1/escalations/mine?${query.toString()}`;
        logger.info('AIAgent', '★ Restore — fetching:', url);
        const res = await fetch(url);

        logger.info('AIAgent', '★ Restore — response status:', res.status);
        if (!res.ok) return;

        const data = await res.json();
        const fetchedTickets: import('../support/types').SupportTicket[] = data.tickets ?? [];
        logger.info('AIAgent', '★ Restore — found', fetchedTickets.length, 'active tickets');

        if (fetchedTickets.length === 0) return;

        // Initialize unread counts from backend (set together with tickets for instant badge)
        const initialUnreadCounts: Record<string, number> = {};
        for (const ticket of fetchedTickets) {
          if (ticket.unreadCount && ticket.unreadCount > 0) {
            initialUnreadCounts[ticket.id] = ticket.unreadCount;
          }
        }
        setTickets(fetchedTickets);
        setUnreadCounts(initialUnreadCounts);

        // Show the ticket list without auto-selecting — user taps in (Intercom-style).
        // setMode switches the widget to human mode so the list is immediately visible.
        setMode('human');
        setAutoExpandTrigger(prev => prev + 1);

        // Open SSE for every restored ticket — reliable ticket_closed delivery
        for (const t of fetchedTickets) {
          openSSE(t.id);
        }

        // If there is exactly one ticket, pre-wire its WebSocket so it is ready
        // the moment the user taps the card (no extra connect delay).
        if (fetchedTickets.length === 1) {
          const ticket = fetchedTickets[0]!;

          if (ticket.history?.length) {
            const restored: AIMessage[] = ticket.history.map(
              (entry: { role: string; content: string; timestamp?: string }, i: number) => ({
                id: `restored-${ticket.id}-${i}`,
                role: (entry.role === 'live_agent' ? 'assistant' : entry.role) as any,
                content: entry.content,
                timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
              })
            );
            setMessages(restored);
          }

          const socket = new EscalationSocket({
            onReply: (reply: string) => {
              const tid = ticket.id;
              // Always update ticket history
              setTickets(prev => prev.map(t => {
                if (t.id !== tid) return t;
                return {
                  ...t,
                  history: [...(t.history || []), { role: 'live_agent', content: reply, timestamp: new Date().toISOString() }],
                };
              }));

              // Route via ref: only push to messages[] if user is viewing THIS ticket
              if (selectedTicketIdRef.current === tid) {
                const msg: AIMessage = {
                  id: `human-${Date.now()}`,
                  role: 'assistant',
                  content: reply,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, msg]);
                setLastResult({ success: true, message: `👤 ${reply}`, steps: [] });
              } else {
                setUnreadCounts(prev => ({
                  ...prev,
                  [tid]: (prev[tid] || 0) + 1,
                }));
              }
            },
            onTypingChange: setIsLiveAgentTyping,
            onTicketClosed: () => clearSupport(ticket.id),
            onError: (err) => logger.error('AIAgent', '★ Restored socket error:', err),
          });
          if (ticket.wsUrl) {
            socket.connect(ticket.wsUrl);
          } else {
            logger.warn('AIAgent', '★ Restored ticket has no wsUrl — skipping socket connect:', ticket.id);
          }
          // Cache in pendingSocketsRef so handleTicketSelect reuses it without reconnecting
          pendingSocketsRef.current.set(ticket.id, socket);
          logger.info('AIAgent', '★ Single ticket restored and socket cached:', ticket.id);
        }
      } catch (err) {
        logger.error('AIAgent', '★ Failed to restore tickets:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsKey]);

  useEffect(() => {
    if (!analyticsKey) return;

    let isCancelled = false;

    const syncIssues = async () => {
      try {
        await initDeviceId();
        const deviceId = getDeviceId();
        if (!userContext?.userId && !deviceId) return;

        const query = new URLSearchParams({ analyticsKey });
        if (userContext?.userId) query.append('userId', userContext.userId);
        if (deviceId) query.append('deviceId', deviceId);

        const res = await fetch(`${ENDPOINTS.escalation}/api/v1/reported-issues/mine?${query.toString()}`);
        if (!res.ok || isCancelled) return;

        const data = await res.json();
        const nextIssues: ReportedIssue[] = Array.isArray(data.issues) ? data.issues : [];
        applyReportedIssueUpdates(nextIssues, { replayToChat: false });
      } catch (error) {
        logger.warn('AIAgent', 'Failed to sync reported issues:', error);
      }
    };

    void syncIssues();

    void (async () => {
      await initDeviceId();
      const deviceId = getDeviceId();
      if (!userContext?.userId && !deviceId) return;

      const query = new URLSearchParams({ analyticsKey });
      if (userContext?.userId) query.append('userId', userContext.userId);
      if (deviceId) query.append('deviceId', deviceId);

      reportedIssuesSSERef.current?.disconnect();
      const sse = new ReportedIssueEventSource({
        url: `${ENDPOINTS.escalation}/api/v1/reported-issues/events?${query.toString()}`,
        onIssueUpdate: (issue) => {
          applyReportedIssueUpdates([issue], { replayToChat: true });
        },
        onError: (error) => {
          logger.warn('AIAgent', 'Reported issue SSE error:', error.message);
        },
      });
      sse.connect();
      reportedIssuesSSERef.current = sse;
    })();

    return () => {
      isCancelled = true;
      reportedIssuesSSERef.current?.disconnect();
      reportedIssuesSSERef.current = null;
    };
  }, [analyticsKey, applyReportedIssueUpdates, userContext?.userId]);

  // ─── Ticket selection handlers ────────────────────────────────
  const handleTicketSelect = useCallback(async (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Cache (not disconnect!) the previous ticket's socket so it keeps
    // receiving messages in the background and can update unread counts.
    if (supportSocket && selectedTicketId && selectedTicketId !== ticketId) {
      pendingSocketsRef.current.set(selectedTicketId, supportSocket);
      setSupportSocket(null);
    }

    setSelectedTicketId(ticketId);
    setMode('human');

    // Clear unread count when user opens a ticket
    setUnreadCounts(prev => {
      if (!prev[ticketId]) return prev;
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });

    // Mark ticket as read on backend (source of truth)
    (async () => {
      try {
        await fetch(
          `${ENDPOINTS.escalation}/api/v1/escalations/${ticketId}/read?analyticsKey=${analyticsKey}`,
          { method: 'POST' }
        );
        logger.info('AIAgent', '★ Marked ticket as read:', ticketId);
      } catch (err) {
        logger.warn('AIAgent', '★ Failed to mark ticket as read:', err);
      }
    })();

    // Trigger scroll to bottom when modal opens
    setChatScrollTrigger(prev => prev + 1);

    // Capture the fresh wsUrl returned by the server — it is the canonical value.
    // The local `ticket` snapshot may have an empty wsUrl if it was a placeholder
    // created before the WS URL was known (e.g. via onEscalationStarted).
    let freshWsUrl = ticket.wsUrl;

    // Fetch latest history from server — this is the source of truth and catches
    // any messages that arrived while the socket was disconnected (modal closed,
    // app backgrounded, etc.)
    try {
      const res = await fetch(
        `${ENDPOINTS.escalation}/api/v1/escalations/${ticketId}?analyticsKey=${analyticsKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.wsUrl) {
          freshWsUrl = data.wsUrl; // always prefer the live server value
        }
        const history: Array<{ role: string; content: string; timestamp?: string }> =
          Array.isArray(data.history) ? data.history : [];
        const restored: AIMessage[] = history.map((entry, i) => ({
          id: `restored-${ticketId}-${i}`,
          role: (entry.role === 'live_agent' ? 'assistant' : entry.role) as any,
          content: entry.content,
          timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
        }));
        setSupportMessages(restored);
        // Update ticket in local list with fresh history + wsUrl
        if (data.wsUrl) {
          setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, history, wsUrl: data.wsUrl } : t));
        }
      } else {
        // Fallback to local ticket history
        if (ticket.history?.length) {
          const restored: AIMessage[] = ticket.history.map(
            (entry: { role: string; content: string; timestamp?: string }, i: number) => ({
              id: `restored-${ticketId}-${i}`,
              role: (entry.role === 'live_agent' ? 'assistant' : entry.role) as any,
              content: entry.content,
              timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
            })
          );
          setSupportMessages(restored);
        } else {
          setSupportMessages([]);
        }
      }
    } catch (err) {
      logger.warn('AIAgent', '★ Failed to fetch ticket history, using local:', err);
      if (ticket.history?.length) {
        const restored: AIMessage[] = ticket.history.map(
          (entry: { role: string; content: string; timestamp?: string }, i: number) => ({
            id: `restored-${ticketId}-${i}`,
            role: (entry.role === 'live_agent' ? 'assistant' : entry.role) as any,
            content: entry.content,
            timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
          })
        );
        setSupportMessages(restored);
      } else {
        setSupportMessages([]);
      }
    }

    // Reuse the already-connected socket if escalation just happened,
    // otherwise create a fresh connection from the ticket's stored wsUrl.
    const cached = pendingSocketsRef.current.get(ticketId);
    if (cached) {
      // If the socket errored (not just cleanly disconnected), discard it and
      // fall through to create a fresh one — reusing an errored socket causes
      // sendText to silently return false → "Connection lost" on every message.
      if (cached.hasErrored) {
        logger.warn('AIAgent', '★ Cached socket errored — discarding and creating fresh socket for ticket:', ticketId);
        cached.disconnect();
        pendingSocketsRef.current.delete(ticketId);
        // Fall through to fresh socket creation below
      } else {
        pendingSocketsRef.current.delete(ticketId);
        // If the cached socket was created before wsUrl was available (e.g. during
        // on-mount restore), it may never have connected. Reconnect it now.
        if (!cached.isConnected && freshWsUrl) {
          logger.info('AIAgent', '★ Cached socket not connected — reconnecting with wsUrl:', freshWsUrl);
          cached.connect(freshWsUrl);
        }
        setSupportSocket(cached);
        logger.info('AIAgent', '★ Reusing cached escalation socket for ticket:', ticketId);
        return;
      }
    }

    const socket = new EscalationSocket({
      onReply: (reply: string) => {
        // Always update ticket history
        setTickets(prev => prev.map(t => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            history: [...(t.history || []), { role: 'live_agent', content: reply, timestamp: new Date().toISOString() }],
          };
        }));

        // Route via ref: only push to messages[] if user is viewing THIS ticket
        if (selectedTicketIdRef.current === ticketId) {
          const msg: AIMessage = {
            id: `human-${Date.now()}`,
            role: 'assistant',
            content: reply,
            timestamp: Date.now(),
          };
          setSupportMessages(prev => [...prev, msg]);
          setLastResult({ success: true, message: `👤 ${reply}`, steps: [] });
        } else {
          setUnreadCounts(prev => ({
            ...prev,
            [ticketId]: (prev[ticketId] || 0) + 1,
          }));
        }
      },
      onTypingChange: setIsLiveAgentTyping,
      onTicketClosed: (closedTicketId?: string) => {
        if (closedTicketId) {
          setUnreadCounts(prev => {
            const next = { ...prev };
            delete next[closedTicketId];
            return next;
          });
        }
        clearSupport(ticketId);
      },
      onError: (err) => logger.error('AIAgent', '★ Socket error on select:', err),
    });
    if (freshWsUrl) {
      socket.connect(freshWsUrl);
    } else {
      logger.warn('AIAgent', '★ Ticket has no wsUrl — skipping socket connect for ticket:', ticketId);
    }
    setSupportSocket(socket);
  }, [tickets, supportSocket, selectedTicketId, analyticsKey, clearSupport]);

  const handleBackToTickets = useCallback(() => {
    // Cache socket in pendingSocketsRef instead of disconnecting —
    // keeps the WS alive so new messages update unreadCounts in real time.
    const currentTicketId = selectedTicketIdRef.current;
    // Use functional setter to read + cache the current socket without closure dependency
    setSupportSocket(prev => {
      if (prev && currentTicketId) {
        pendingSocketsRef.current.set(currentTicketId, prev);
        logger.info('AIAgent', '★ Socket cached for ticket:', currentTicketId, '— stays alive for badge updates');
      }
      return null;
    });
    logger.info('AIAgent', '★ Back to tickets');
    setSelectedTicketId(null);
    setSupportMessages([]);
    setIsLiveAgentTyping(false);
  }, []); // No dependencies — uses refs/functional setters

  const mergedCustomTools = useMemo(() => {
    return {
      ...(autoEscalateTool ? { escalate_to_human: autoEscalateTool } : {}),
      ...(autoReportIssueTool ? { report_issue: autoReportIssueTool } : {}),
      ...customTools,
    };
  }, [autoEscalateTool, autoReportIssueTool, customTools]);

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
  const lastAgentErrorRef = useRef<string | null>(null);

  const availableModes: AgentMode[] = useMemo(() => {
    const modes: AgentMode[] = ['text'];
    if (enableVoice) modes.push('voice');
    if (tickets.length > 0) modes.push('human');
    logger.info('AIAgent', '★ availableModes recomputed:', modes, '| tickets:', tickets.length, '| ticketIds:', tickets.map(t => t.id));
    return modes;
  }, [enableVoice, tickets]);

  // Ref-based resolver for ask_user — stays alive across renders
  const askUserResolverRef = useRef<((answer: string) => void) | null>(null);
  const pendingAskUserKindRef = useRef<'freeform' | 'approval' | null>(null);
  // Tracks whether we're waiting for a BUTTON tap (not just any text answer).
  // Set true when kind='approval' is issued; cleared ONLY on actual button tap.
  // Forces kind='approval' on all subsequent ask_user calls until resolved.
  const pendingAppApprovalRef = useRef<boolean>(false);
  // Stores a message typed by the user while the agent is still thinking (mid-approval flow).
  // Auto-resolved into the next ask_user call to prevent the message being lost.
  const queuedApprovalAnswerRef = useRef<string | null>(null);
  const [pendingApprovalQuestion, setPendingApprovalQuestion] = useState<string | null>(null);
  const overlayVisible = isThinking || !!pendingApprovalQuestion;
  const overlayStatusText = pendingApprovalQuestion
    ? 'Waiting for your approval...'
    : statusText;

  // ─── Create Runtime ──────────────────────────────────────────

  const config: AgentConfig = useMemo(() => ({
    apiKey,
    proxyUrl,
    proxyHeaders,
    voiceProxyUrl,
    voiceProxyHeaders,
    model,
    language: 'en',
    maxSteps,
    interactiveBlacklist,
    interactiveWhitelist,
    onBeforeStep,
    onAfterStep,
    onBeforeTask,
    onAfterTask,
    customTools: mode === 'voice' ? { ...mergedCustomTools, ask_user: null } : mergedCustomTools,
    instructions,
    stepDelay,
    mcpServerUrl,
    router,
    pathname,
    onStatusUpdate: setStatusText,
    onTokenUsage,
    knowledgeBase: resolvedKnowledgeBase,
    knowledgeMaxTokens,
    enableUIControl,
    screenMap: useScreenMap ? screenMap : undefined,
    maxTokenBudget,
    maxCostUSD,
    interactionMode,
    // Block the agent loop until user responds
    onAskUser: mode === 'voice' ? undefined : ((request) => {
      return new Promise<string>((resolve) => {
        const normalized = typeof request === 'string'
          ? { question: request, kind: 'freeform' as const }
          : request;
        const question = normalized.question;
        const kind = normalized.kind || 'freeform';
        logger.info('AIAgent', `❓ onAskUser invoked in ${mode} mode: "${question}"`);
        telemetryRef.current?.track('agent_trace', {
          stage: 'ask_user_prompt_rendered',
          question,
          mode,
          kind,
        });
        askUserResolverRef.current = resolve;
        logger.info('AIAgent', `📌 askUserResolverRef SET (resolver stored) | kind=${kind} | pendingAppApprovalRef=${pendingAppApprovalRef.current}`);
        // If we're already waiting for a button tap, force approval kind regardless
        // of what the model passed — the user must tap a button to proceed.
        const forcedKind = pendingAppApprovalRef.current ? 'approval' : kind;
        pendingAskUserKindRef.current = forcedKind;
        if (forcedKind === 'approval') {
          pendingAppApprovalRef.current = true;
        }

        // If the user typed a message while we were thinking (queued answer),
        // resolve immediately with that message instead of blocking on a new prompt.
        const queued = queuedApprovalAnswerRef.current;
        if (queued !== null) {
          queuedApprovalAnswerRef.current = null;
          logger.info('AIAgent', `⚡ Auto-resolving ask_user with queued message: "${queued}"`);
          // Show the AI question in chat, clear the approval buttons (no resolver for them),
          // then immediately resolve the Promise with the queued message.
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-ask-${Date.now()}`,
              role: 'assistant' as const,
              content: question,
              timestamp: Date.now(),
              promptKind: forcedKind === 'approval' ? 'approval' : undefined,
            },
          ]);
          askUserResolverRef.current = null;
          pendingAskUserKindRef.current = null;
          pendingAppApprovalRef.current = false; // CRITICAL FIX: Unlock the agent state
          setPendingApprovalQuestion(null); // clear any stale buttons — buttons with no resolver = dead tap
          resolve(queued);
          return;
        }

        setPendingApprovalQuestion(forcedKind === 'approval' ? question : null);
        // Add AI question to the message thread so it appears in chat
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-ask-${Date.now()}`,
            role: 'assistant' as const,
            content: question,
            timestamp: Date.now(),
            promptKind: kind === 'approval' ? 'approval' : undefined,
          },
        ]);
        setLastResult({ success: true, message: question, steps: [] });
        setIsThinking(false);
        setStatusText('');
      });
    }),
    // Toggle isAgentActing flag on TelemetryService before/after every tool
    // so that AI-driven taps are never tracked as user_interaction events.
    onToolExecute: (active: boolean) => {
      telemetryRef.current?.setAgentActing(active);
    },
    onTrace: (event: AgentTraceEvent) => {
      telemetryRef.current?.track('agent_trace', {
        traceId: event.traceId,
        stage: event.stage,
        stepIndex: event.stepIndex,
        screenName: event.screenName,
        ...(event.data ?? {}),
      });
    },
  }), [
    mode, apiKey, proxyUrl, proxyHeaders, voiceProxyUrl, voiceProxyHeaders, model, maxSteps,
    interactiveBlacklist, interactiveWhitelist,
    onBeforeStep, onAfterStep, onBeforeTask, onAfterTask,
    transformScreenContent, customTools, instructions, stepDelay,
    mcpServerUrl, router, pathname, onTokenUsage,
    resolvedKnowledgeBase, knowledgeMaxTokens, enableUIControl, screenMap, useScreenMap,
    maxTokenBudget, maxCostUSD, interactionMode,
  ]);

  useEffect(() => {
    logger.info(
      'AIAgent',
      `⚙️ Runtime config recomputed: mode=${mode} interactionMode=${interactionMode || 'copilot(default)'} onAskUser=${mode !== 'voice'} mergedTools=${Object.keys(mergedCustomTools).join(', ') || '(none)'}`
    );
  }, [mode, interactionMode, mergedCustomTools]);

  const provider = useMemo(
    () => createProvider(providerName, apiKey, model, proxyUrl, proxyHeaders),
    [providerName, apiKey, model, proxyUrl, proxyHeaders]
  );

  const runtime = useMemo(
    () => new AgentRuntime(provider, config, rootViewRef.current, navRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, config],
  );

  // Update refs when they change
  useEffect(() => {
    runtime.updateRefs(rootViewRef.current, navRef);
  }, [runtime, navRef]);

  // ─── Telemetry ─────────────────────────────────────────────

  const telemetryRef = useRef<TelemetryService | null>(null);

  useEffect(() => {
    if (!analyticsKey && !analyticsProxyUrl) {
      bindTelemetryService(null);
      return;
    }

    // Initialize persistent device ID before telemetry starts
    initDeviceId().then(() => {

      const telemetry = new TelemetryService({
        analyticsKey,
        analyticsProxyUrl,
        analyticsProxyHeaders,
        debug,
        onEvent: (event) => {
          // Proactive behavior triggers
          if (
            event.type === 'rage_tap' ||
            event.type === 'error_screen' ||
            event.type === 'repeated_navigation'
          ) {
            idleDetectorRef.current?.triggerBehavior(event.type, event.screen);
          }

          // Customer Success features
          if (customerSuccess?.enabled && event.type === 'user_interaction' && event.data) {
            const action = String(event.data.label || event.data.action || '');

            // Check milestones
            customerSuccess.successMilestones?.forEach(m => {
              if (m.action && m.action === action) {
                telemetry.track('health_signal', {
                  type: 'success_milestone',
                  milestone: m.name,
                });
              }
            });

            // Check key feature adoption
            customerSuccess.keyFeatures?.forEach(feature => {
              if (action.includes(feature) || action === feature) {
                telemetry.track('health_signal', {
                  type: 'feature_adoption',
                  feature,
                });
              }
            });
          }
        },
      });
      telemetryRef.current = telemetry;
      bindTelemetryService(telemetry);
      telemetry.start();

      const initialRoute = navRef?.getCurrentRoute?.();
      if (initialRoute?.name) {
        telemetry.setScreen(initialRoute.name);
      }
    }); // initDeviceId
  }, [analyticsKey, analyticsProxyUrl, analyticsProxyHeaders, bindTelemetryService, debug, navRef]);

  // ─── Security warnings ──────────────────────────────────────

  useEffect(() => {
    // @ts-ignore
    if (typeof __DEV__ !== 'undefined' && !__DEV__ && apiKey && !proxyUrl) {
      logger.warn(
        '[MobileAI] ⚠️ SECURITY WARNING: You are using `apiKey` directly in a production build. ' +
        'This exposes your LLM provider key in the app binary. ' +
        'Use `apiProxyUrl` to route requests through your backend instead. ' +
        'See docs for details.'
      );
    }
  }, [apiKey, proxyUrl]);

  // Track screen changes via navRef
  useEffect(() => {
    if (!navRef?.addListener || !telemetryRef.current) return;

    const checkScreenMilestone = (screenName: string) => {
      telemetryRef.current?.setScreen(screenName);

      if (customerSuccess?.enabled) {
        customerSuccess.successMilestones?.forEach(m => {
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
      const currentRoute = navRef.getCurrentRoute?.();
      if (currentRoute?.name) {
        checkScreenMilestone(currentRoute.name);
      }
    });

    return () => unsubscribe?.();
  }, [navRef, customerSuccess, isOnboardingActive, onboarding, currentOnboardingIndex, advanceOnboarding]);

  // ─── MCP Bridge ──────────────────────────────────────────────

  useEffect(() => {
    if (!mcpServerUrl) return;

    logger.info('AIAgent', `Setting up MCP bridge at ${mcpServerUrl}`);
    const bridge = new MCPBridge(mcpServerUrl, runtime);

    return () => {
      bridge.destroy();
    };
  }, [mcpServerUrl, runtime]);

  // ─── Proactive Idle Agent ────────────────────────────────────

  const idleDetectorRef = useRef<IdleDetector | null>(null);
  const [proactiveStage, setProactiveStage] = useState<'hidden' | 'pulse' | 'badge'>('hidden');
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
      generateSuggestion: () => proactiveHelp?.generateSuggestion?.(telemetryRef.current?.screen || 'Home') || proactiveHelp?.badgeText || "Need help with this screen?",
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
      const voicePrompt = buildVoiceSystemPrompt('en', instructions?.system, !!knowledgeBase);
      logger.info('AIAgent', `📝 Voice system prompt (${voicePrompt.length} chars):\n${voicePrompt}`);
      voiceServiceRef.current = new VoiceService({
        apiKey,
        proxyUrl: voiceProxyUrl || proxyUrl,
        proxyHeaders: voiceProxyHeaders || proxyHeaders,
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
        onError: (err) => logger.warn('AIAgent', `AudioOutput error/disabled: ${err}`),
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
        onError: (err) => logger.warn('AIAgent', `AudioInput error/disabled: ${err}`),
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
          // Trigger visual 'thinking' overlay down to ChatBar so user knows action is happening
          setIsThinking(true);
          const toolNameFriendly = toolCall.name.replace(/_/g, ' ');
          setStatusText(`Executing ${toolNameFriendly}...`);

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
          setIsThinking(false);
          setStatusText('');
          
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
  }, [mode, apiKey, proxyUrl, proxyHeaders, voiceProxyUrl, voiceProxyHeaders, runtime, instructions]);

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

  const handleSend = useCallback(async (
    message: string,
    options?: { onResult?: (result: ExecutionResult) => void }
  ) => {
    if (!message.trim() || isThinking) return;

    // ── Apple Guideline 5.1.2(i): Consent gate ──────────────────
    // If consent is required but not yet granted, show the consent dialog
    // instead of sending data to the AI provider.
    // EXCEPTION: bypass consent when talking to a human agent —
    // this is a person-to-person chat, not AI data processing.
    const isHumanAgentChat = !!(selectedTicketId && supportSocket);
    if (consentGateActive && !isHumanAgentChat) {
      pendingConsentSendRef.current = {
        message: message.trim(),
        options,
      };
      setShowConsentDialog(true);
      return;
    }

    logger.info('AIAgent', `User message: "${message}"`);
    setLastUserMessage(message.trim());

    // Intercom-style transparent intercept:
    // If we're connected to a human agent, all text input goes directly to them.
    if (selectedTicketId && supportSocket) {
      // Gate: do not allow sending if the ticket is closed/resolved.
      const activeTicket = tickets.find(t => t.id === selectedTicketId);
      const CLOSED_STATUSES = ['closed', 'resolved'];
      if (activeTicket && CLOSED_STATUSES.includes(activeTicket.status)) {
        setLastResult({
          success: false,
          message: 'This conversation is closed. Please start a new request.',
          steps: [],
        });
        return;
      }

      if (supportSocket.sendText(message)) {
        setSupportMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', content: message.trim(), timestamp: Date.now() },
        ]);
        setIsThinking(true);
        setStatusText('Sending to agent...');
        setTimeout(() => {
          setIsThinking(false);
          setStatusText('');
        }, 800);
      } else {
        setLastResult({
          success: false,
          message: 'Failed to send message to support agent. Connection lost.',
          steps: [],
        });
      }
      return;
    }

    // Append user message to AI thread
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
      },
    ]);

    // If there's a pending ask_user, resolve it instead of starting a new execution
    if (askUserResolverRef.current) {
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
        setStatusText('Answering your question...');
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
      setStatusText('Processing your answer...');
      setLastResult(null);
      logger.info('AIAgent', `✅ Resolving pending ask_user with: "${message.trim()}"`);
      telemetryRef.current?.track('agent_trace', {
        stage: 'ask_user_answer_submitted',
        answer: message.trim(),
        mode,
      });
      resolver(message);
      return;
    }

    // Guard: if we're mid-approval flow (waiting for button tap) but no resolver exists yet
    // (agent is still thinking between ask_user calls), do NOT start a new task —
    // that would spawn two concurrent agent loops and freeze the app.
    // Instead, store the message as a queued answer that will auto-resolve on the next ask_user.
    if (pendingAppApprovalRef.current) {
      logger.warn('AIAgent', '⚠️ User typed during active approval flow — queuing message, not spawning new task');
      queuedApprovalAnswerRef.current = message.trim();
      return;
    }

    // Normal execution — new task
    // Reset approval gate refs so previous conversations don't bleed state
    pendingAppApprovalRef.current = false;
    queuedApprovalAnswerRef.current = null;
    setIsThinking(true);
    setStatusText('Thinking...');
    setLastResult(null);
    logger.info(
      'AIAgent',
      `📨 New user request received in ${mode} mode | interactionMode=${interactionMode || 'copilot(default)'} | text="${message.trim()}"`
    );

    // Telemetry: track agent request
    telemetryRef.current?.track('agent_request', {
      query: message.trim(),
      transcript: message.trim(),
      mode,
    });
    telemetryRef.current?.track('agent_trace', {
      stage: 'request_received',
      query: message.trim(),
      mode,
      interactionMode: interactionMode || 'copilot',
    });

    try {
      // ─── Business-grade escalation policy ───
      const FRUSTRATION_REGEX = /\b(angry|frustrated|useless|terrible|hate|worst|ridiculous|awful)\b/i;
      const HIGH_RISK_ESCALATION_REGEX = /\b(human|agent|representative|supervisor|manager|refund|chargeback|charged|billing|payment|fraud|scam|lawsuit|attorney|lawyer|sue|legal|privacy|data breach|account locked|can't log in|cannot log in)\b/i;
      const escalateTool = customTools?.['escalate_to_human'] || autoEscalateTool;
      const priorFrustrationCount = messages.filter(
        (m) => m.role === 'user' && typeof m.content === 'string' && FRUSTRATION_REGEX.test(m.content)
      ).length;

      if (escalateTool && !selectedTicketId) {
        if (HIGH_RISK_ESCALATION_REGEX.test(message)) {
          logger.warn('AIAgent', 'High-risk support signal detected — auto-escalating to human');
          telemetryRef.current?.track('business_escalation', { message, trigger: 'high_risk' });

          const escalationResult = await escalateTool.execute({
            reason: `Customer needs human support: ${message.trim()}`,
          });

          const customerMessage =
            typeof escalationResult === 'string' && escalationResult.trim().length > 0
              ? escalationResult.replace(/^ESCALATED:\s*/i, '')
              : 'Your request has been sent to our support team. A human agent will reply here as soon as possible.';

          const res: ExecutionResult = {
            success: true,
            message: customerMessage,
            steps: [{
              stepIndex: 0,
              reflection: {
                previousGoalEval: '',
                memory: '',
                plan: 'Escalate to human support for a high-risk or explicitly requested issue',
              },
              action: {
                name: 'escalate_to_human',
                input: { reason: 'business_escalation' },
                output: 'Escalated',
              },
            }],
          };

          setLastResult(res);
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: res.message,
              timestamp: Date.now(),
              result: res,
            },
          ]);

          setIsThinking(false);
          setStatusText('');
          return;
        }

        if (FRUSTRATION_REGEX.test(message)) {
          const frustrationMessage =
            priorFrustrationCount > 0
              ? "I'm sorry this has been frustrating. I can keep helping here, or I can connect you with a human support agent if you'd prefer."
              : "I'm sorry this has been frustrating. Tell me what went wrong, and I'll do my best to fix it.";

          const res: ExecutionResult = {
            success: true,
            message: frustrationMessage,
            steps: [{
              stepIndex: 0,
              reflection: {
                previousGoalEval: '',
                memory: '',
                plan:
                  priorFrustrationCount > 0
                    ? 'Acknowledge repeated frustration and offer escalation without forcing a handoff'
                    : 'Acknowledge first-time frustration and continue trying to resolve the issue',
              },
              action: {
                name: 'done',
                input: {},
                output: frustrationMessage,
              },
            }],
          };

          setLastResult(res);
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: frustrationMessage,
              timestamp: Date.now(),
              result: res,
            },
          ]);

          setIsThinking(false);
          setStatusText('');
          return;
        }
      }

      // Ensure we have the latest Fiber tree ref
      runtime.updateRefs(rootViewRef.current, navRef);

      const result = await runtime.execute(message, messages);
      let normalizedResult = result;

      const reportStep = result.steps?.find((step) => step.action.name === 'report_issue');
      if (reportStep && typeof reportStep.action.output === 'string') {
        const match = /^ISSUE_REPORTED:([^:]+):([^:]*):([\s\S]+)$/i.exec(reportStep.action.output);
        if (match) {
          const [, _issueId, historyId, customerMessage] = match;
          const resolvedCustomerMessage = customerMessage || reportStep.action.output;
          if (historyId) {
            seenReportedIssueUpdatesRef.current.add(historyId);
          }
          normalizedResult = {
            ...result,
            message: resolvedCustomerMessage,
            steps: result.steps.map((step) =>
              step === reportStep
                ? {
                  ...step,
                  action: {
                    ...step.action,
                    output: resolvedCustomerMessage,
                  },
                }
                : step
            ),
          };
        }
      }

      // Telemetry: track agent completion and per-step details
      if (telemetryRef.current) {
        if (!agentFrtFiredRef.current) {
          agentFrtFiredRef.current = true;
          telemetryRef.current.track('agent_first_response');
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
          success: normalizedResult.success,
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

      logger.info('AIAgent', '★ handleSend — SETTING lastResult:', normalizedResult.message.substring(0, 80), '| mode:', mode);
      logger.info('AIAgent', '★ handleSend — tickets:', tickets.length, 'selectedTicketId:', selectedTicketId);

      // Don't overwrite lastResult if escalation already switched us to human mode
      // (mode in this closure is stale — the actual mode may have changed during async execution)
      const stepsHadEscalation = normalizedResult.steps?.some(s => s.action.name === 'escalate_to_human');
      if (!stepsHadEscalation) {
        setLastResult(normalizedResult);
      }

      const assistantMsg: AIMessage = {
        id: Date.now().toString() + Math.random(),
        role: 'assistant',
        content: normalizedResult.message,
        timestamp: Date.now(),
        result: normalizedResult,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // ── Persist to backend (debounced 600ms) ─────────────────────
      if (analyticsKey) {
        if (appendDebounceRef.current) clearTimeout(appendDebounceRef.current);
        appendDebounceRef.current = setTimeout(async () => {
          try {
            await initDeviceId();
            const deviceId = getDeviceId();
            // Read current messages directly from ref — never use setMessages() to read state
            const currentMsgs = messagesRef.current;
            const newMsgs = currentMsgs.slice(lastSavedMessageCountRef.current);

            if (newMsgs.length === 0) return;

            if (!activeConversationIdRef.current) {
              // First exchange — create a new conversation
              const id = await ConversationService.startConversation({
                analyticsKey: analyticsKey!,
                userId: userContext?.userId,
                deviceId: deviceId || undefined,
                messages: newMsgs,
              });
              if (id) {
                activeConversationIdRef.current = id;
                lastSavedMessageCountRef.current = currentMsgs.length;
                const newSummary: ConversationSummary = {
                  id,
                  title: newMsgs.find(m => m.role === 'user')?.content?.slice(0, 80) || 'New conversation',
                  preview: assistantMsg.content.slice(0, 100),
                  previewRole: 'assistant',
                  messageCount: newMsgs.length,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                setConversations(prev => [newSummary, ...prev]);
                logger.info('AIAgent', `Conversation created: ${id}`);
              }
            } else {
              // Subsequent turns — append only new messages
              await ConversationService.appendMessages({
                conversationId: activeConversationIdRef.current!,
                analyticsKey: analyticsKey!,
                messages: newMsgs,
              });
              lastSavedMessageCountRef.current = currentMsgs.length;
              setConversations(prev => prev.map(c =>
                c.id === activeConversationIdRef.current
                  ? { ...c, preview: assistantMsg.content.slice(0, 100), updatedAt: Date.now(), messageCount: c.messageCount + newMsgs.length }
                  : c
              ));
              logger.info('AIAgent', `Conversation appended: ${activeConversationIdRef.current}`);
            }
          } catch (err) {
            logger.warn('AIAgent', 'Failed to persist conversation:', err);
          }
        }, 600);
      }

      if (options?.onResult) {
        options.onResult(normalizedResult);
      } else {
        onResult?.(normalizedResult);
      }

      logger.info('AIAgent', `Result: ${normalizedResult.success ? '✅' : '❌'} ${normalizedResult.message}`);
    } catch (error: any) {
      logger.error('AIAgent', 'Execution failed:', error);

      // Telemetry: track agent failure
      telemetryRef.current?.track('agent_complete', {
        success: false,
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
      setIsThinking(false);
      setStatusText('');
    }
  }, [runtime, navRef, onResult, messages, isThinking, consentGateActive]);

  useEffect(() => {
    if (consentGateActive) return;
    const pending = pendingConsentSendRef.current;
    if (!pending) return;

    pendingConsentSendRef.current = null;
    void handleSend(pending.message, pending.options);
  }, [consentGateActive, handleSend]);

  useEffect(() => {
    if (isThinking) return;
    const pending = pendingFollowUpAfterApprovalRef.current;
    if (!pending) return;

    pendingFollowUpAfterApprovalRef.current = null;
    void handleSend(pending.message, pending.options);
  }, [isThinking, handleSend]);

  // ─── Context value (for useAI bridge) ─────────────────────────

  const handleCancel = useCallback(() => {
    runtime.cancel();
    setIsThinking(false);
    setStatusText('');
  }, [runtime]);

  // ─── Conversation History Handlers ─────────────────────────────

  const handleConversationSelect = useCallback(async (conversationId: string) => {
    if (!analyticsKey) return;
    try {
      const msgs = await ConversationService.fetchConversation({ conversationId, analyticsKey });
      if (msgs) {
        activeConversationIdRef.current = conversationId;
        lastSavedMessageCountRef.current = msgs.length;
        setMessages(msgs);
        setLastResult(null);
      }
    } catch (err) {
      logger.warn('AIAgent', 'Failed to load conversation:', err);
    }
  }, [analyticsKey]);

  const handleNewConversation = useCallback(() => {
    activeConversationIdRef.current = null;
    lastSavedMessageCountRef.current = 0;
    setMessages([]);
    setLastResult(null);
    setLastUserMessage(null);
  }, []);

  const contextValue = useMemo(() => ({
    runtime,
    send: handleSend,
    isLoading: isThinking,
    status: statusText,
    lastResult,
    messages,
    clearMessages,
    cancel: handleCancel,
  }), [runtime, handleSend, handleCancel, isThinking, statusText, lastResult, messages, clearMessages]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <AgentContext.Provider value={contextValue}>
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
              const label = extractTouchLabel(event);
              if (label && label !== 'Unknown Element' && label !== '[pressable]') {
                telemetryRef.current.track('user_interaction', {
                  type: 'tap',
                  label,
                  actor: 'user',
                  x: Math.round(event.nativeEvent.pageX),
                  y: Math.round(event.nativeEvent.pageY),
                });

                // Track if user is rage-tapping this specific element
                checkRageClick(label, telemetryRef.current);
              } else {
                // Tapped an unlabelled/empty area
                telemetryRef.current.track('dead_click', {
                  x: Math.round(event.nativeEvent.pageX),
                  y: Math.round(event.nativeEvent.pageY),
                  screen: telemetryRef.current.screen,
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
              logger.warn('AIAgent', `🛡️ Error caught by boundary: ${error.message}\n${componentStack || ''}`);
            }}
          >
            {children}
          </AgentErrorBoundary>
        </View>

        {/* Floating UI — absolute-positioned View that passes touches pass-through unless interacting */}
        <FloatingOverlayWrapper fallbackStyle={styles.floatingLayer}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Highlight Overlay (always active, listens to events) */}
          <HighlightOverlay />

          {/* Chat bar wrapped in Proactive Hint */}
          {showChatBar && (
            <ProactiveHint
              stage={proactiveStage}
              badgeText={proactiveBadgeText}
              onDismiss={() => idleDetectorRef.current?.dismiss()}
            >
              <AgentChatBar
                onSend={handleSend}
                isThinking={isThinking}
                statusText={overlayStatusText}
                lastResult={lastResult}
                lastUserMessage={lastUserMessage}
                chatMessages={messages}
                pendingApprovalQuestion={pendingApprovalQuestion}
                onPendingApprovalAction={(action) => {
                  const resolver = askUserResolverRef.current;
                  logger.info('AIAgent', `🔘 Approval button tapped: action=${action} | resolver=${resolver ? 'EXISTS' : 'NULL'} | pendingApprovalQuestion="${pendingApprovalQuestion}" | pendingAppApprovalRef=${pendingAppApprovalRef.current}`);
                  if (!resolver) {
                    logger.error('AIAgent', '🚫 ABORT: resolver is null when button was tapped — this means ask_user Promise was already resolved without clearing the buttons. This is a state sync bug.');
                    return;
                  }
                  askUserResolverRef.current = null;
                  pendingAskUserKindRef.current = null;
                  // Button was actually tapped — clear the approval gate and any queued message
                  pendingAppApprovalRef.current = false;
                  queuedApprovalAnswerRef.current = null;
                  setPendingApprovalQuestion(null);
                  const response =
                    action === 'approve'
                      ? '__APPROVAL_GRANTED__'
                      : '__APPROVAL_REJECTED__';
                  // Restore the thinking overlay so the user can see the agent working
                  // after approval. onAskUser set isThinking=false when buttons appeared,
                  // but the agent is still running — restore the visual indicator.
                  if (action === 'approve') {
                    setIsThinking(true);
                    setStatusText('Working...');
                  }
                  telemetryRef.current?.track('agent_trace', {
                    stage: 'approval_button_pressed',
                    action,
                  });
                  resolver(response);
                }}
                language={'en'}
                onDismiss={() => { setLastResult(null); setLastUserMessage(null); }}
                theme={accentColor || theme ? {
                  ...(accentColor ? { primaryColor: accentColor } : {}),
                  ...theme,
                } : undefined}
                availableModes={availableModes}
                mode={mode}
                onModeChange={(newMode) => {
                  logger.info('AIAgent', '★ onModeChange:', mode, '→', newMode, '| tickets:', tickets.length, 'selectedTicketId:', selectedTicketId);
                  setMode(newMode);
                }}
                isMicActive={isMicActive}
                isSpeakerMuted={isSpeakerMuted}
                isAISpeaking={isAISpeaking}
                isAgentTyping={isLiveAgentTyping}
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
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                onTicketSelect={handleTicketSelect}
                onBackToTickets={handleBackToTickets}
                autoExpandTrigger={autoExpandTrigger}
                unreadCounts={unreadCounts}
                totalUnread={totalUnread}
                showDiscoveryTooltip={tooltipVisible}
                discoveryTooltipMessage={discoveryTooltipMessage}
                onTooltipDismiss={handleTooltipDismiss}
                conversations={conversations}
                isLoadingHistory={isLoadingHistory}
                onConversationSelect={handleConversationSelect}
                onNewConversation={handleNewConversation}
              />
            </ProactiveHint>
          )}

          {/* Overlay (shown while thinking) — render after chat UI so it stays on top */}
          <AgentOverlay visible={overlayVisible} statusText={overlayStatusText} onCancel={handleCancel} />

          {/* Support chat modal — opens when user taps a ticket */}
          <SupportChatModal
            visible={mode === 'human' && !!selectedTicketId}
            messages={supportMessages}
            onSend={handleSend}
            onClose={handleBackToTickets}
            isAgentTyping={isLiveAgentTyping}
            isThinking={isThinking}
            scrollToEndTrigger={chatScrollTrigger}
            ticketStatus={tickets.find(t => t.id === selectedTicketId)?.status}
          />

          {/* AI Consent Dialog (Apple Guideline 5.1.2(i)) — always rendered */}
          <AIConsentDialog
            visible={showConsentDialog}
            provider={providerName}
            config={consentConfig}
            language={'en'}
            onConsent={async () => {
              await grantConsent();
              setShowConsentDialog(false);
              consentConfig.onConsent?.();
              logger.info('AIAgent', '✅ AI consent granted by user');
            }}
            onDecline={() => {
              setShowConsentDialog(false);
              consentConfig.onDecline?.();
              logger.info('AIAgent', '❌ AI consent declined by user');
            }}
          />
          </View>
        </FloatingOverlayWrapper>
      </View>
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

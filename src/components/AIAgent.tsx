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
import { logger } from '../utils/logger';
import { buildVoiceSystemPrompt } from '../core/systemPrompt';
import { MCPBridge } from '../core/MCPBridge';
import { VoiceService } from '../services/VoiceService';
import { AudioInputService } from '../services/AudioInputService';
import { AudioOutputService } from '../services/AudioOutputService';
import { TelemetryService, bindTelemetryService } from '../services/telemetry';
import { extractTouchLabel, checkRageClick } from '../services/telemetry/TouchAutoCapture';
import { initDeviceId, getDeviceId } from '../services/telemetry/device';
import type { AgentConfig, AgentMode, ExecutionResult, ToolDefinition, AgentStep, TokenUsage, KnowledgeBaseConfig, ChatBarTheme, AIMessage, AIProviderName, ScreenMap, ProactiveHelpConfig } from '../core/types';
import { AgentErrorBoundary } from './AgentErrorBoundary';
import { HighlightOverlay } from './HighlightOverlay';
import { IdleDetector } from '../core/IdleDetector';
import { ProactiveHint } from './ProactiveHint';
import { createEscalateTool } from '../support/escalateTool';
import { EscalationSocket } from '../support/EscalationSocket';
import { EscalationEventSource } from '../support/EscalationEventSource';
import { SupportChatModal } from '../support/SupportChatModal';
import { ENDPOINTS } from '../config/endpoints';

// ─── Context ───────────────────────────────────────────────────

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
}: AIAgentProps) {
  // Configure logger based on debug prop
  React.useEffect(() => {
    logger.setEnabled(debug);
    if (debug) {
      logger.info('AIAgent', '🔧 Debug logging enabled');
    }
  }, [debug]);

  const rootViewRef = useRef<any>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [chatScrollTrigger, setChatScrollTrigger] = useState(0);

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

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

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
            setMessages((prev) => [...prev, humanMsg]);
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
          socket.connect(ticket.wsUrl);
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

    // Fetch latest history from server — this is the source of truth and catches
    // any messages that arrived while the socket was disconnected (modal closed,
    // app backgrounded, etc.)
    try {
      const res = await fetch(
        `${ENDPOINTS.escalation}/api/v1/escalations/${ticketId}?analyticsKey=${analyticsKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const history: Array<{ role: string; content: string; timestamp?: string }> =
          Array.isArray(data.history) ? data.history : [];
        const restored: AIMessage[] = history.map((entry, i) => ({
          id: `restored-${ticketId}-${i}`,
          role: (entry.role === 'live_agent' ? 'assistant' : entry.role) as any,
          content: entry.content,
          timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
        }));
        setMessages(restored);
        // Update ticket in local list with fresh history
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
          setMessages(restored);
        } else {
          setMessages([]);
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
        setMessages(restored);
      } else {
        setMessages([]);
      }
    }

    // Reuse the already-connected socket if escalation just happened,
    // otherwise create a fresh connection from the ticket's stored wsUrl.
    const cached = pendingSocketsRef.current.get(ticketId);
    if (cached) {
      pendingSocketsRef.current.delete(ticketId);
      setSupportSocket(cached);
      logger.info('AIAgent', '★ Reusing cached escalation socket for ticket:', ticketId);
      return;
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
          setMessages(prev => [...prev, msg]);
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
    socket.connect(ticket.wsUrl);
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
    setSelectedTicketId(null);
    setMessages([]);
    setIsLiveAgentTyping(false);
  }, []); // No dependencies — uses refs/functional setters

  const mergedCustomTools = useMemo(() => {
    if (!autoEscalateTool) return customTools;
    return { escalate_to_human: autoEscalateTool, ...customTools };
  }, [autoEscalateTool, customTools]);

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
    knowledgeBase,
    knowledgeMaxTokens,
    enableUIControl,
    screenMap: useScreenMap ? screenMap : undefined,
    maxTokenBudget,
    maxCostUSD,
    // Block the agent loop until user responds
    onAskUser: mode === 'voice' ? undefined : ((question: string) => {
      return new Promise<string>((resolve) => {
        askUserResolverRef.current = resolve;
        // Show question in chat bar, allow user input
        setLastResult({ success: true, message: `❓ ${question}`, steps: [] });
        setIsThinking(false);
        setStatusText('');
      });
    }),
    // Toggle isAgentActing flag on TelemetryService before/after every tool
    // so that AI-driven taps are never tracked as user_interaction events.
    onToolExecute: (active: boolean) => {
      telemetryRef.current?.setAgentActing(active);
    },
  }), [
    mode, apiKey, proxyUrl, proxyHeaders, voiceProxyUrl, voiceProxyHeaders, model, maxSteps,
    interactiveBlacklist, interactiveWhitelist,
    onBeforeStep, onAfterStep, onBeforeTask, onAfterTask,
    transformScreenContent, customTools, instructions, stepDelay,
    mcpServerUrl, router, pathname, onTokenUsage,
    knowledgeBase, knowledgeMaxTokens, enableUIControl, screenMap, useScreenMap,
    maxTokenBudget, maxCostUSD,
  ]);

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

    const unsubscribe = navRef.addListener('state', () => {
      const currentRoute = navRef.getCurrentRoute?.();
      if (currentRoute?.name) {
        telemetryRef.current?.setScreen(currentRoute.name);
      }
    });

    return () => unsubscribe?.();
  }, [navRef]);

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
        setMessages((prev) => [
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

    // Telemetry: track agent request
    telemetryRef.current?.track('agent_request', {
      query: message.trim(),
    });

    try {
      // Ensure we have the latest Fiber tree ref
      runtime.updateRefs(rootViewRef.current, navRef);

      const result = await runtime.execute(message, messages);

      // Telemetry: track agent completion and per-step details
      if (telemetryRef.current) {
        for (const step of result.steps ?? []) {
          telemetryRef.current.track('agent_step', {
            tool: step.action.name,
            args: step.action.input,
            result: typeof step.action.output === 'string'
              ? step.action.output.substring(0, 200)
              : String(step.action.output),
          });
        }
        telemetryRef.current.track('agent_complete', {
          success: result.success,
          steps: result.steps?.length ?? 0,
          tokens: result.tokenUsage?.totalTokens ?? 0,
          cost: result.tokenUsage?.estimatedCostUSD ?? 0,
        });
      }

      logger.info('AIAgent', '★ handleSend — SETTING lastResult:', result.message.substring(0, 80), '| mode:', mode);
      logger.info('AIAgent', '★ handleSend — tickets:', tickets.length, 'selectedTicketId:', selectedTicketId);

      // Don't overwrite lastResult if escalation already switched us to human mode
      // (mode in this closure is stale — the actual mode may have changed during async execution)
      const stepsHadEscalation = result.steps?.some(s => s.action.name === 'escalate_to_human');
      if (!stepsHadEscalation) {
        setLastResult(result);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
          result,
        },
      ]);

      if (options?.onResult) {
        options.onResult(result);
      } else {
        onResult?.(result);
      }

      logger.info('AIAgent', `Result: ${result.success ? '✅' : '❌'} ${result.message}`);
    } catch (error: any) {
      logger.error('AIAgent', 'Execution failed:', error);

      // Telemetry: track agent failure
      telemetryRef.current?.track('agent_complete', {
        success: false,
        error: error.message,
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
  }, [runtime, navRef, onResult, messages, isThinking]);

  // ─── Context value (for useAI bridge) ─────────────────────────

  const handleCancel = useCallback(() => {
    runtime.cancel();
    setIsThinking(false);
    setStatusText('');
  }, [runtime]);

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
              const label = extractTouchLabel(event.nativeEvent);
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
        <View style={styles.floatingLayer} pointerEvents="box-none">
          {/* Highlight Overlay (always active, listens to events) */}
          <HighlightOverlay />

          {/* Overlay (shown while thinking) */}
          <AgentOverlay visible={isThinking} statusText={statusText} onCancel={handleCancel} />

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
                lastResult={lastResult}
                lastUserMessage={lastUserMessage}
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
              />
            </ProactiveHint>
          )}

          {/* Support chat modal — opens when user taps a ticket */}
          <SupportChatModal
            visible={mode === 'human' && !!selectedTicketId}
            messages={messages}
            onSend={handleSend}
            onClose={handleBackToTickets}
            isAgentTyping={isLiveAgentTyping}
            isThinking={isThinking}
            scrollToEndTrigger={chatScrollTrigger}
            ticketStatus={tickets.find(t => t.id === selectedTicketId)?.status}
          />
        </View>
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

/**
 * Support Mode — types and configuration.
 *
 * Transforms the AI agent into a customer support assistant with:
 * - Custom greeting message
 * - Quick reply suggestions
 * - Human escalation capability
 * - CSAT (Customer Satisfaction) collection after conversation
 */

// ─── Support Mode Config ──────────────────────────────────

export interface SupportModeConfig {
  /** Enable support mode. Default: false */
  enabled: boolean;

  /** Greeting message shown when the chat opens */
  greeting?: {
    /** Main greeting text (e.g., "Hi! 👋 How can I help you today?") */
    message: string;
    /** Agent name shown above the greeting (e.g., "MobileAI Support") */
    agentName?: string;
    /** Avatar URL for the support agent */
    avatarUrl?: string;
  };

  /** Quick reply buttons shown below the greeting */
  quickReplies?: QuickReply[];

  /** Escalation configuration */
  escalation?: EscalationConfig;

  /** CSAT survey configuration */
  csat?: CSATConfig;

  /** Business hours (optional — shows offline message outside hours) */
  businessHours?: BusinessHoursConfig;

  /**
   * Additional system prompt context for the support persona.
   * Merged with the base system prompt.
   * Example: "You are a friendly support agent for FeedYum food delivery app."
   */
  systemContext?: string;

  /**
   * Topics the AI should NOT attempt to resolve — escalate immediately.
   * Example: ['billing dispute', 'account deletion', 'legal']
   */
  autoEscalateTopics?: string[];
}

// ─── Quick Replies ────────────────────────────────────────

export interface QuickReply {
  /** Display text on the button */
  label: string;
  /** Message sent when tapped (defaults to label if not set) */
  message?: string;
  /** Icon emoji (optional) */
  icon?: string;
}

// ─── Escalation ───────────────────────────────────────────

export interface EscalationConfig {
  /**
   * Where to route the escalation.
   * - 'mobileai' (default when analyticsKey is set): ticket goes to MobileAI
   *   dashboard inbox via POST /api/v1/escalations + WebSocket reply delivery.
   * - 'custom': fires the onEscalate callback — wire to Intercom, Zendesk, etc.
   */
  provider?: 'mobileai' | 'custom';

  /**
   * Callback when user requests human support (required when provider='custom').
   * Use this to open a live chat widget, send email, etc.
   */
  onEscalate?: (context: EscalationContext) => void;

  /** Label for the escalate button. Default: "Talk to a human" */
  buttonLabel?: string;

  /** Message shown to user when escalated. Default: "Connecting you to a human agent..." */
  escalationMessage?: string;
}

export interface EscalationContext {
  /** Summary of the conversation so far */
  conversationSummary: string;
  /** Current screen the user is on */
  currentScreen: string;
  /** User's original question/issue */
  originalQuery: string;
  /** Number of AI steps taken before escalation */
  stepsBeforeEscalation: number;
}

// ─── CSAT (Customer Satisfaction) ─────────────────────────

export interface CSATConfig {
  /** Enable CSAT survey after conversation. Default: true if support mode enabled */
  enabled?: boolean;

  /** Question text. Default: "How was your experience?" */
  question?: string;

  /** Rating type. Default: 'emoji' */
  ratingType?: 'stars' | 'emoji' | 'thumbs';

  /** Callback when user submits rating */
  onSubmit: (rating: CSATRating) => void;

  /** Show after N seconds of inactivity. Default: 10 */
  showAfterIdleSeconds?: number;
}

export interface CSATRating {
  /** Numeric score (1-5 for stars/emoji, 0-1 for thumbs) */
  score: number;
  /** Optional text feedback */
  feedback?: string;
  /** Conversation metadata */
  metadata: {
    conversationDuration: number;
    stepsCount: number;
    wasEscalated: boolean;
    screen: string;
  };
}

// ─── Business Hours ───────────────────────────────────────

export interface BusinessHoursConfig {
  /** Timezone (IANA format, e.g., 'Africa/Cairo') */
  timezone: string;
  /** Schedule per day of week (0=Sunday, 6=Saturday) */
  schedule: Record<number, { start: string; end: string } | null>;
  /** Message shown outside business hours */
  offlineMessage?: string;
}

// ─── Support Ticket ───────────────────────────────────────

export interface SupportTicket {
  id: string;
  reason: string;
  screen: string;
  status: string;
  history: Array<{ role: string; content: string; timestamp?: string }>;
  createdAt: string;
  wsUrl: string;
  /** Number of unread messages (computed by backend = history.length - readMessageCount) */
  unreadCount?: number;
}

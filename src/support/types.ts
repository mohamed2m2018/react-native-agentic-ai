/**
 * Support Mode — types and configuration.
 *
 * Transforms the AI agent into a customer support assistant with:
 * - Custom greeting message
 * - Quick reply suggestions
 * - Human escalation capability
 * - CSAT (Customer Satisfaction) collection after conversation
 */

import type { SupportStyle } from './supportStyle';

// ─── Support Mode Config ──────────────────────────────────

export interface SupportModeConfig {
  /** Enable support mode. Default: false */
  enabled: boolean;

  /** Greeting message shown when the chat opens */
  greeting?: {
    /** Main greeting text (e.g., "Hi! 👋 How can I help you today?") */
    message: string;
    /** Agent name shown above the greeting (e.g., "Acme Support") */
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
   * Locale / language code for the support conversation (e.g. 'es', 'fr', 'ar').
   * When set, the AI responds in this language unless the user switches.
   */
  locale?: string;

  /**
   * Topics the AI should NOT attempt to resolve — escalate immediately.
   * Example: ['billing dispute', 'account deletion', 'legal']
   */
  autoEscalateTopics?: string[];

  /**
   * Options for the AI's persona and tone.
   */
  persona?: {
    /** Preset support personality. Default: 'warm-concise'. */
    preset?: SupportStyle;
    /** The agent's name to use in conversation. */
    agentName?: string;
    /** The tone of the AI (e.g., 'professional', 'casual', 'empathetic'). Default: 'empathetic' */
    tone?: string;
    /** How the AI signs off at the end of a resolution (e.g., 'Best, Support Team') */
    signOff?: string;
  };

  /**
   * Self-service layer — shows categorized help topics with pre-defined answers
   * before the user reaches the AI agent. Zero LLM cost for resolved queries.
   */
  quickActions?: QuickActionsConfig;

  /**
   * Consumer-defined "WOW actions" — special tools the AI can use to surprise/delight
   * the user (e.g. apply discount, extend trial) when they've had a frustrating experience.
   */
  wowActions?: Array<{
    /** Internal name for the tool (e.g., 'apply_discount') */
    name: string;
    /** What the action does */
    description: string;
    /** Instructions specifying exactly when the AI should trigger this action */
    triggerHint: string;
    /** Callback when the AI executes this action */
    handler: (args: Record<string, any>) => Promise<string | void>;
  }>;
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

// ─── Quick Actions (Self-Service Layer) ──────────────────

export interface HelpArticle {
  /** Question text displayed in the list */
  question: string;
  /** Answer content (supports markdown) */
  answer: string;
  /** Deep link to navigate user to a relevant screen */
  deepLink?: string;
  /** Tags for search matching */
  tags?: string[];
}

export interface HelpTopic {
  /** Unique identifier */
  id: string;
  /** Display label (e.g., "Orders", "Payments") */
  label: string;
  /** Icon emoji */
  icon?: string;
  /** Pre-defined Q&A articles */
  articles: HelpArticle[];
  /**
   * Context trigger — return true when this topic is relevant to the given screen.
   * Used to sort relevant topics first and optionally show a "Suggested" badge.
   */
  contextTrigger?: (screenName: string) => boolean;
}

export interface QuickActionsConfig {
  /** Enable the self-service layer before AI chat. Default: false */
  enabled: boolean;
  /** Categorized help topics with pre-defined answers */
  topics: HelpTopic[];
  /** Show a search bar to filter across all articles. Default: true */
  showSearchBar?: boolean;
  /** Label for the fallback button that opens AI chat. Default: "Chat with AI" */
  otherLabel?: string;
  /** Track which topics/articles users view. Default: true when analyticsKey is set */
  analyticsOnView?: boolean;
  /** Called when user taps "Did this help?" → Yes on an article */
  onArticleHelpful?: (topicId: string, article: HelpArticle) => void;
  /** Called when user taps "Did this help?" → No on an article */
  onArticleNotHelpful?: (topicId: string, article: HelpArticle) => void;
}

// ─── Escalation ───────────────────────────────────────────

export interface EscalationConfig {
  /**
   * Called when the AI hands the conversation to a human. Required for
   * escalation: open your live chat widget (Intercom, Zendesk, …), send an
   * email, or create a ticket in your own backend.
   */
  onEscalate?: (context: EscalationContext) => void | Promise<void>;

  /** Label for the escalate button. Default: "Talk to a human" */
  buttonLabel?: string;

  /** Message shown to user when escalated. */
  escalationMessage?: string;
}

export interface EscalationUserContext {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  plan?: string;
  custom?: Record<string, string | number | boolean>;
}

export interface EscalationContext {
  /** The AI's summary of why it is escalating and what it tried */
  conversationSummary: string;
  /** Current screen the user is on */
  currentScreen: string;
  /** User's original question/issue */
  originalQuery: string;
  /** Number of AI steps taken before escalation */
  stepsBeforeEscalation: number;
  /** What triggered the handoff (tool_call, user_request, auto) */
  handoffTriggerType: string;
  /** Last messages of the conversation (up to 20) */
  history: Array<{ role: string; content: string }>;
  /** Screens the user visited this session, in order */
  screenFlow: string[];
  /** Tools the agent ran before escalating */
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output: string;
  }>;
  /** The userContext prop passed to <AIAgent> */
  userContext?: EscalationUserContext;
  /** Platform and OS version */
  device: { platform: string; osVersion: string };
}

// ─── CSAT (Customer Satisfaction) ─────────────────────────

export interface CSATConfig {
  /** Enable CSAT survey after conversation. Default: true if support mode enabled */
  enabled?: boolean;

  /** Which survey to show. 'csat' = Customer Satisfaction, 'ces' = Customer Effort Score, 'nps' = Net Promoter Score. Default: 'csat' */
  surveyType?: 'csat' | 'ces' | 'nps';

  /** Question text. Default varies by surveyType ("How was your experience?" or "How easy was it to resolve your issue?") */
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
    ticketId?: string;
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

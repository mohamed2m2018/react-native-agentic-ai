/**
 * Core types for the React Native AI SDK.
 */
import type React from 'react';

// ─── Agent Modes ──────────────────────────────────────────────

export type AgentMode = 'text' | 'voice' | 'human';

/**
 * Controls how the agent handles app actions.
 * 'companion': Screen-aware guidance only — AI reads the UI and tells the user what to do,
 *   but cannot tap, type, navigate, or invoke UI-control tools.
 * 'copilot' (default): AI pauses before final commit actions (place order, delete, submit).
 *   The prompt instructs the AI to ask_user before the final irreversible step.
 *   Elements with aiConfirm={true} also trigger a code-level confirmation gate.
 * 'autopilot': Full autonomy — all actions execute without confirmation.
 */
export type InteractionMode = 'companion' | 'copilot' | 'autopilot';

// ─── Provider Names ──────────────────────────────────────────

export type AIProviderName = 'gemini' | 'openai';
export type SupportStyle =
  | 'warm-concise'
  | 'wow-service'
  | 'neutral-professional';

export interface VerifierConfig {
  enabled?: boolean;
  mode?: 'critical-actions';
  provider?: AIProviderName;
  model?: string;
  proxyUrl?: string;
  proxyHeaders?: Record<string, string>;
  maxFollowupSteps?: number;
}

// ─── Interactive Element (discovered from Fiber tree) ─────────

export type ElementType =
  | 'pressable'
  | 'text-input'
  | 'switch'
  | 'radio'
  | 'scrollable'
  | 'slider'
  | 'picker'
  | 'date-picker';

export type AnalyticsElementKind =
  | 'button'
  | 'text_input'
  | 'toggle'
  | 'slider'
  | 'picker'
  | 'link'
  | 'tab'
  | 'list_item'
  | 'image'
  | 'icon'
  | 'text'
  | 'card'
  | 'modal'
  | 'sheet'
  | 'scroll_area'
  | 'unknown';
export type AnalyticsLabelConfidence = 'high' | 'low';

export interface InteractiveElement {
  /** Unique index assigned during tree walk */
  index: number;
  /** Element type */
  type: ElementType;
  /** Human-readable label (extracted from Text children or accessibilityLabel) */
  label: string;
  /** Declarative AI priority explicitly set by the developer */
  aiPriority?: 'high' | 'low';
  /** The nearest enclosing AIZone ID (if any) */
  zoneId?: string;
  /** Reference to the Fiber node for execution */
  fiberNode: any;
  /**
   * Props snapshot from the fiber node.
   * Record<string, any> because RN components have diverse props:
   * - Pressable: onPress, onLongPress
   * - Slider: onValueChange, onSlidingComplete, minimumValue, maximumValue
   * - Picker: onValueChange, items, selectedValue
   * - DatePicker: onChange, onDateChange, mode
   * - Switch: onValueChange, value
   * - Radio: onPress, onValueChange/onChange, value, checked
   */
  props: Record<string, any>;
  /**
   * If true, AI interaction with this element requires user confirmation (copilot safety net).
   * Set automatically by the FiberTreeWalker when the element has aiConfirm={true} prop.
   */
  requiresConfirmation?: boolean;
  /**
   * If set, this is a virtual element injected by NativeAlertInterceptor.
   * Not backed by a real Fiber node — tapTool routes it to the interceptor instead.
   */
  virtual?: {
    kind: 'alert_button';
    /** 0-based index of the button in the active alert */
    alertButtonIndex: number;
  };
  /** Sanitized analytics label used for telemetry and wireframes. */
  analyticsLabel?: string | null;
  /** Generic analytics-facing element kind. */
  analyticsElementKind?: AnalyticsElementKind;
  /** Confidence that the analytics label is user-facing. */
  analyticsLabelConfidence?: AnalyticsLabelConfidence;
  /** Nearest enclosing AI zone id, preserved for analytics/debugging. */
  analyticsZoneId?: string | null;
  /** Nearest custom component ancestry above the interactive node. */
  analyticsAncestorPath?: string[];
  /** Nearby sibling interactive labels from the same parent group. */
  analyticsSiblingLabels?: string[];
  /** Concrete component name for the matched interactive host. */
  analyticsComponentName?: string | null;
}

// ─── Wireframe Snapshots (Telemetry Layer) ────────────────────

export interface WireframeComponent {
  type: ElementType;
  label: string;
  elementKind?: AnalyticsElementKind;
  labelConfidence?: AnalyticsLabelConfidence;
  zoneId?: string | null;
  ancestorPath?: string[];
  siblingLabels?: string[];
  componentName?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WireframeSnapshot {
  screen: string;
  components: WireframeComponent[];
  deviceWidth: number;
  deviceHeight: number;
  capturedAt: string;
  /**
   * Optional JPEG screenshot captured at the same moment as this wireframe.
   * Base64 payload (without data URI prefix) to avoid embedding UI-dependent
   * image schemes in analytics payloads.
   */
  screenshot?: string | null;
}

// ─── Dehydrated Screen State ──────────────────────────────────

export interface DehydratedScreen {
  /** Current screen name (from navigation state) */
  screenName: string;
  /** All available screen names (from routeNames) */
  availableScreens: string[];
  /** Indexed interactive elements as text */
  elementsText: string;
  /** Raw elements array */
  elements: InteractiveElement[];
}

export type InteractiveNode = InteractiveElement;

export interface ZoneSnapshot {
  id: string;
  allowHighlight?: boolean;
  allowInjectHint?: boolean;
  allowSimplify?: boolean;
  allowInjectBlock?: boolean;
  interventionEligible?: boolean;
  proactiveIntervention?: boolean;
}

export interface NavigationSnapshot {
  currentScreenName: string;
  availableScreens: string[];
}

export interface ScreenSnapshot {
  screenName: string;
  availableScreens: string[];
  elementsText: string;
  elements: InteractiveNode[];
}

export type ActionIntent =
  | { type: 'tap'; index: number }
  | { type: 'long_press'; index: number }
  | { type: 'type'; index: number; text: string }
  | { type: 'scroll'; direction: 'down' | 'up'; amount?: 'page' | 'toEnd' | 'toStart'; containerIndex?: number }
  | { type: 'adjust_slider'; index: number; value: number }
  | { type: 'select_picker'; index: number; value: string }
  | { type: 'set_date'; index: number; date: string }
  | { type: 'dismiss_keyboard' }
  | { type: 'guide_user'; index: number; message: string; autoRemoveAfterMs?: number }
  | { type: 'simplify_zone'; zoneId: string }
  | { type: 'render_block'; zoneId: string; blockType: string; props?: unknown; lifecycle?: AIRichBlockLifecycle }
  | { type: 'inject_card'; zoneId: string; templateName: string; props?: unknown }
  | { type: 'restore_zone'; zoneId: string }
  | { type: 'navigate'; screen: string; params?: unknown };

export interface PlatformAdapter {
  getScreenSnapshot(): ScreenSnapshot;
  getNavigationSnapshot(): NavigationSnapshot;
  getLastScreenSnapshot(): ScreenSnapshot | null;
  executeAction(intent: ActionIntent): Promise<string>;
  captureScreenshot(): Promise<string | undefined>;
}

// ─── Screen Map (generated by CLI) ───────────────────────────

export interface ScreenMapEntry {
  title?: string;
  description: string;
  navigatesTo?: string[];
}

export interface ScreenMap {
  generatedAt: string;
  framework: 'expo-router' | 'react-navigation';
  screens: Record<string, ScreenMapEntry>;
  chains?: string[][];
}

// ─── Agent Types ──────────────────────────────────────────────

export interface AgentStep {
  stepIndex: number;
  reflection: AgentReasoning;
  action: {
    name: string;
    input: Record<string, any>;
    output: string;
  };
}

export interface AgentTraceEvent {
  traceId: string;
  stage: string;
  timestamp?: string;
  stepIndex?: number;
  screenName?: string;
  data?: Record<string, unknown>;
}

export interface AskUserRequest {
  question: string;
  kind?: 'freeform' | 'approval';
}

export interface AgentConfig {
  /**
   * Which LLM provider to use for text mode.
   * Default: 'gemini'
   */
  provider?: AIProviderName;

  /**
   * API key (for prototyping only).
   * Do not use in production. Use proxyUrl instead.
   */
  apiKey?: string;

  /**
   * The URL of your secure backend proxy (for production).
   * Routes all Gemini API requests through your server.
   */
  proxyUrl?: string;

  /**
   * Optional headers to send to your proxyUrl (e.g., auth tokens).
   */
  proxyHeaders?: Record<string, string>;

  /**
   * Optional specific URL for Voice Mode (WebSockets).
   * Useful if you use Serverless for text, but need a dedicated server for voice.
   */
  voiceProxyUrl?: string;

  /**
   * Optional specific headers for voiceProxyUrl.
   */
  voiceProxyHeaders?: Record<string, string>;

  model?: string;

  /**
   * Support personality preset used when the agent is handling support-style requests.
   * Default: 'warm-concise'
   */
  supportStyle?: SupportStyle;

  /**
   * Optional outcome verifier settings for critical app-changing actions.
   * Defaults to enabled critical-action verification using the main provider.
   */
  verifier?: VerifierConfig;

  /** Maximum steps per task */
  maxSteps?: number;

 /**
  * Controls how the agent handles app actions.
   * 'companion': Screen-aware guidance only; non-UI tools are allowed, UI-control tools are blocked.
   * 'copilot' (default): AI pauses before final commit actions.
   * 'autopilot': Full autonomy, no pauses.
   */
  interactionMode?: InteractionMode;

  /**
   * MCP server mode — controls whether external agents can discover and invoke actions.
   * 'auto' (default): enabled in __DEV__, disabled in production
   * 'enabled': always on (opt-in for production)
   * 'disabled': always off
   */
  mcpServerMode?: 'auto' | 'enabled' | 'disabled';

  // ─── Element Gating ──

  /**
   * React refs of elements the AI must NOT interact with.
   * Refs of elements the AI must NOT interact with.
   * The Fiber walker skips any node whose ref matches one in this list.
   */
  interactiveBlacklist?: React.RefObject<any>[];

  /**
   * If set, the AI can ONLY interact with these elements.
   * If set, AI can ONLY interact with these elements.
   */
  interactiveWhitelist?: React.RefObject<any>[];

  // ─── Lifecycle Hooks ───────

  /** Called before each agent step. */
  onBeforeStep?: (stepCount: number) => Promise<void> | void;

  /** Called after each agent step with full history. */
  onAfterStep?: (history: AgentStep[]) => Promise<void> | void;

  /** Called before task execution starts. */
  onBeforeTask?: () => Promise<void> | void;

  /** Called after task completes (success or failure). */
  onAfterTask?: (result: ExecutionResult) => Promise<void> | void;

  // ─── Content Masking ──────────

  /**
   * Transform dehydrated screen text before sending to LLM.
   * Use to mask sensitive data (credit cards, PII, etc).
   * Transform screen content before the LLM sees it (for data masking).
   */
  transformScreenContent?: (content: string) => Promise<string> | string;

  // ─── Custom Tools ─────────────────────

  /**
   * Override or remove built-in tools.
   * Set tool to `null` to remove it (e.g., `{ navigate: null }`).
   * Override or remove built-in tools (null = remove).
   */
  customTools?: Record<string, ToolDefinition | null>;

  // ─── Instructions ────────────────────

  /** Instructions to guide the agent's behavior. */
  instructions?: {
    /** Global system-level instructions, applied to all tasks. */
    system?: string;
    /**
     * Dynamic per-screen instructions callback.
     * Called before each step to get instructions for the current screen.
     * Per-screen instructions callback.
     */
    getScreenInstructions?: (screenName: string) => string | undefined | null;
  };

  /**
   * Enable or disable UI control tools (tap, type, navigate, ask_user, capture_screenshot).
   * When false, the AI operates as a knowledge-only assistant — it can read the screen
   * and answer questions via query_knowledge, but cannot interact with UI elements.
   * Default: true
   */
  enableUIControl?: boolean;

  /**
   * Optional allowlist of action names that may be exposed from useAction()/ActionRegistry.
   * When provided, unlisted app-code actions are hidden from the model.
   */
  allowedActionNames?: string[];

  /** Delay between steps in ms. */
  stepDelay?: number;

  // ─── Screen Map ───────────────────────────────────────────────────────────

  /**
   * Pre-generated screen map from `npx react-native-ai-agent generate-map`.
   * Gives the AI knowledge of all screens, their content, and navigation chains.
   * Without this, the AI only sees the currently rendered screen.
   */
  screenMap?: ScreenMap;

  // ─── Status Updates ──────────────────────────────────────────────────────

  /**
   * Called with a human-readable status string at each step.
   * Use this to show dynamic loading text (e.g., "Tapping 'Add'...").
   */
  onStatusUpdate?: (status: string) => void;

  /**
   * Called after each step with token usage data.
   * Use to track cost, enforce budgets, or display usage to the user.
   * NOTE: Estimated costs are raw provider rates. They do not include the
   * dashboard's hosted proxy tier multiplier.
   */
  onTokenUsage?: (usage: TokenUsage) => void;

  /**
   * Callback for when agent needs user input (ask_user tool).
   * The agent loop blocks until the user responds.
   * If not set, ask_user tool will break the loop (legacy behavior).
   * @example onAskUser: (q) => new Promise(resolve => showPrompt(q, resolve))
   */
  onAskUser?: (request: AskUserRequest | string) => Promise<string>;

  /**
   * Called immediately before and after each agent tool execution.
   * Used by AIAgent to toggle isAgentActing on TelemetryService so that
   * AI-driven taps are not double-counted as user interactions.
   * @param active - true = agent is acting, false = agent finished acting
   */
  onToolExecute?: (active: boolean, toolName?: string) => void;

  /**
   * Called whenever the runtime emits a detailed audit trace event.
   * Intended for backend persistence of high-signal execution trails.
   */
  onTrace?: (event: AgentTraceEvent) => void;

  // ─── Expo Router Support ─────────────────────────────────────────────────

  /**
   * Expo Router instance (from useRouter()).
   * When provided, the navigate tool uses router.push('/path') instead of navRef.navigate().
   */
  router?: {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
  };

  /**
   * Current pathname from Expo Router (from usePathname()).
   * Used to determine the current screen when using Expo Router.
   */
  pathname?: string;

  // ─── Knowledge Base ────────────────────────────────────────────────────────

  /**
   * Domain knowledge the AI can query via the query_knowledge tool.
   * Pass a static array of KnowledgeEntry[] (SDK handles keyword matching),
   * or a KnowledgeRetriever with a custom async retrieve() function.
   */
  knowledgeBase?: KnowledgeBaseConfig;

  /** Max tokens for knowledge retrieval results (~4 chars per token). Default: 2000 */
  knowledgeMaxTokens?: number;

  // ─── Budget Guards ──────────────────────────────────────────────────────

  /**
   * Maximum total tokens (prompt + completion) allowed per task.
   * The agent loop auto-stops when this budget is exceeded, returning partial results.
   */
  maxTokenBudget?: number;

  /**
   * Maximum estimated cost (USD) allowed per task.
   * The agent loop auto-stops when this budget is exceeded, returning partial results.
   * Cost is estimated based on the provider's pricing (see provider source for rates).
   * NOTE: This represents raw provider cost (Gemini's base pricing).
   * It does NOT include the MobileAI dashboard tier-based markup multiplier.
   */
  maxCostUSD?: number;

  // ─── MCP Bridge Integration ──────────────────────────────────────────────

  /**
   * Optional URL of the companion Node.js MCP server bridge (e.g. ws://localhost:3101).
   * If set, the SDK will connect to this server and listen for execution requests
   * from external AI agents (like OpenClaw, Claude Desktop, etc).
   */
  mcpServerUrl?: string;

  /**
   * When true, the agent monkey-patches Alert.alert and Alert.prompt during execution
   * to capture native dialog metadata and inject virtual elements into the Fiber tree.
   * This lets the agent see and tap alert buttons that are normally invisible.
   *
   * Default: false (opt-in — only enable if your app uses Alert dialogs the agent needs
   * to interact with)
   */
  interceptNativeAlerts?: boolean;

  /**
   * Internal platform adapter used by the runtime to inspect screens and execute actions.
   * AIAgent provides this automatically for React Native apps.
   */
  platformAdapter?: PlatformAdapter;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  /** Preview text used for history, search, and notifications */
  previewText?: string;
  /** Structured reply content rendered in chat surfaces */
  reply?: AIRichNode[];
  steps: AgentStep[];
  /** Accumulated token usage for the entire task */
  tokenUsage?: TokenUsage;
}

// ─── Tool Types ───────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  execute: (args: Record<string, any>) => Promise<string>;
}

export interface ToolParam {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
}

// ─── Action (optional useAction hook) ─────────────────────────

export interface ActionParameterDef {
  /** The primitive type of the parameter. Maps to MCP schemas and native iOS/Android types. */
  type: 'string' | 'number' | 'boolean';
  /** A clear description of what the parameter is for (read by the AI). */
  description: string;
  /** Whether the AI must provide this parameter. Defaults to true. */
  required?: boolean;
  /** If provided, the AI is restricted to these specific string values. */
  enum?: string[];
}

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, string | ActionParameterDef>;
  handler: (args: Record<string, any>) => any;
}

export interface DataFieldDef {
  /** Human-readable description of this field */
  description: string;
  /** Expected value type. Defaults to string when omitted. */
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

export interface DataQueryContext {
  /** What the user is asking for */
  query: string;
  /** Resolved current screen name, if available */
  screenName: string;
}

export interface DataDefinition {
  name: string;
  description: string;
  schema?: Record<string, string | DataFieldDef>;
  handler: (context: DataQueryContext) => Promise<unknown> | unknown;
}

// ─── Knowledge Base ───────────────────────────────────────────

/** A single knowledge entry the AI can retrieve. */
export interface KnowledgeEntry {
  /** Unique identifier */
  id: string;
  /** Human-readable title (also used for keyword matching) */
  title: string;
  /** The knowledge text content */
  content: string;
  /** Optional tags for keyword matching (e.g., ['refund', 'policy']) */
  tags?: string[];
  /** Optional: only surface this entry on these screens */
  screens?: string[];
  /** Priority 0-10 — higher = preferred when multiple match (default: 5) */
  priority?: number;
}

/** Async retriever function — consumer brings their own retrieval logic. */
export interface KnowledgeRetriever {
  retrieve: (query: string, screenName: string) => Promise<KnowledgeEntry[]>;
}

/**
 * Knowledge base configuration — accepts either:
 * - A static array of KnowledgeEntry[] (SDK handles keyword matching)
 * - A KnowledgeRetriever object with a custom retrieve() function
 */
export type KnowledgeBaseConfig = KnowledgeEntry[] | KnowledgeRetriever;

// ─── Chat Messages ───────────────────────────────────────────

export type AIRichBlockPlacement = 'chat' | 'zone';
export type AIRichBlockLifecycle = 'persistent' | 'dismissible';
export type BlockInterventionType =
  | 'error_prevention'
  | 'decision_support'
  | 'contextual_help'
  | 'recovery'
  | 'none';

export interface AIRichTextNode {
  type: 'text';
  content: string;
  id?: string;
}

export interface AIRichBlockNode {
  type: 'block';
  blockType: string;
  props: Record<string, unknown>;
  id: string;
  placement?: AIRichBlockPlacement;
  lifecycle?: AIRichBlockLifecycle;
}

export type AIRichNode = AIRichTextNode | AIRichBlockNode;

export interface BlockPropDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  description?: string;
}

export interface BlockDefinition {
  name: string;
  component: React.ComponentType<any>;
  allowedPlacements: AIRichBlockPlacement[];
  propSchema?: Record<string, BlockPropDefinition>;
  previewTextBuilder?: (props: Record<string, unknown>) => string;
  interventionType?: BlockInterventionType;
  interventionEligible?: boolean;
  styleSlots?: string[];
}

/** A single message in the conversation history. */
export interface AIMessage {
  /** Unique message ID */
  id: string;
  /** Who sent this message */
  role: 'user' | 'assistant';
  /** Structured rich content */
  content: AIRichNode[];
  /** Preview text used for transcript previews/history */
  previewText: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Attached execution result (assistant messages only) */
  result?: ExecutionResult;
  /** Optional UI hint for rendering assistant prompts */
  promptKind?: 'approval';
}

// ─── Conversation History ─────────────────────────────────────

/**
 * A past conversation session summary returned by the history list endpoint.
 * Used to populate the history panel in AgentChatBar.
 */
export interface ConversationSummary {
  /** Unique conversation ID (backend cuid) */
  id: string;
  /** Auto-generated title from the first user message */
  title: string;
  /** Preview text — last message content, truncated */
  preview: string;
  /** Role of the last message ('user' | 'assistant') */
  previewRole: string;
  /** Total number of messages in the conversation */
  messageCount: number;
  /** Unix ms — when the conversation was created */
  createdAt: number;
  /** Unix ms — when it was last updated */
  updatedAt: number;
}

// ─── Chat Bar Theme ──────────────────────────────────────────

/** Color customization for the floating chat bar / popup. */
export interface ChatBarTheme {
  /** Primary accent color — FAB background, send button, active tab indicator.
   *  Default: '#1a1a2e' */
  primaryColor?: string;
  /** Expanded popup background color. Default: 'rgba(26, 26, 46, 0.95)' */
  backgroundColor?: string;
  /** Text and icon color. Default: '#ffffff' */
  textColor?: string;
  /** User input field background. Default: 'rgba(255, 255, 255, 0.1)' */
  inputBackgroundColor?: string;
  /** Success result bubble background. Default: 'rgba(40, 167, 69, 0.2)' */
  successColor?: string;
  /** Error result bubble background. Default: 'rgba(220, 53, 69, 0.2)' */
  errorColor?: string;
}

// ─── Provider Interface ──────────────────────────────────────

/** Structured reasoning returned per step via the agent_step tool. */
export interface AgentReasoning {
  /** Assessment of whether the previous action succeeded or failed. */
  previousGoalEval: string;
  /** What to remember for future steps (progress, items found, etc). */
  memory: string;
  /** The immediate next goal and why. */
  plan: string;
}

// ─── Token Usage ──────────────────────────────────────────────

/** Token usage metrics for cost tracking. */
export interface TokenUsage {
  /** Tokens in the input prompt */
  promptTokens: number;
  /** Tokens generated by the model */
  completionTokens: number;
  /** Total tokens (prompt + completion) */
  totalTokens: number;
  /** Estimated cost in USD (based on model pricing) */
  estimatedCostUSD: number;
}

/** Result from the AI provider's generateContent call. */
export interface ProviderResult {
  /** Extracted action tool call (action_name + params). */
  toolCalls: Array<{ name: string; args: Record<string, any> }>;
  /** Structured reasoning from MacroTool (evaluation, memory, next_goal). */
  reasoning: AgentReasoning;
  /** Raw text response (if any). */
  text?: string;
  /** Token usage for this specific call */
  tokenUsage?: TokenUsage;
}

export interface AIProvider {
  generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
    /** Optional base64-encoded JPEG screenshot for vision */
    screenshot?: string
  ): Promise<ProviderResult>;
}

// ─── AI-Native UI (Pillar B) ───────────────────────────────────────────────────

/**
 * Configuration for an AIZone declarative boundary.
 */
export interface AIZoneConfig {
  /** Unique identifier for this zone on the current screen */
  id: string;
  /** Whether the AI is allowed to use guide_user() to highlight elements here */
  allowHighlight?: boolean;
  /** Whether the AI is allowed to inject tooltip hints here */
  allowInjectHint?: boolean;
  /** Whether the AI is allowed to hide children marked with aiPriority="low" */
  allowSimplify?: boolean;
  /** Whether the AI is allowed to inject structured blocks here */
  allowInjectBlock?: boolean;
  /** Whether this zone may be used for screen interventions */
  interventionEligible?: boolean;
  /** Whether proactive screen interventions are allowed in this zone */
  proactiveIntervention?: boolean;
  /**
   * Whitelist of registered UI blocks the AI can instantiate in this zone.
   * IMPORTANT: The AI only receives the block names and prop schema.
   */
  blocks?: BlockDefinition[];
  /** @deprecated Use allowInjectBlock */
  allowInjectCard?: boolean;
  /**
   * @deprecated Use blocks.
   */
  templates?: React.ComponentType<any>[];
}

/**
 * Internal representation of a registered zone.
 */
export interface RegisteredZone extends AIZoneConfig {
  /** React ref to the zone's container View */
  ref: React.RefObject<any>;
}

export interface ProactiveHelpConfig {
  /** Enable proactive help (default: true) */
  enabled?: boolean;
  /** Time in minutes before a subtle pulse (default: 2) */
  pulseAfterMinutes?: number;
  /** Time in minutes before showing a help badge (default: 4) */
  badgeAfterMinutes?: number;
  /** Default text for the badge (default: "Need help with this screen?") */
  badgeText?: string;
  /** If true, dismissing the badge disables proactive help for the rest of the session (default: true) */
  dismissForSession?: boolean;
  /** Dynamic context suggestion generator based on current screen */
  generateSuggestion?: (screenName: string) => string;
  /**
   * Behavior-based triggers to detect user struggle (e.g., rage tapping) and show help instantly.
   */
  behaviorTriggers?: Array<{
    /** Exact screen name or '*' for all screens */
    screen: string;
    /** Type of struggle behavior to detect */
    type: 'rage_tap' | 'error_screen' | 'repeated_navigation';
    /** Custom badge message when triggered */
    message?: string;
    /** Delay before showing badge once triggered (ms) */
    delayMs?: number;
  }>;
}

export interface CustomerSuccessConfig {
  /** Enable background collection of health and adoption signals */
  enabled: boolean;
  /** Key features to track adoption for */
  keyFeatures?: string[];
  /** Milestones that indicate the user is "succeeding" */
  successMilestones?: Array<{
    name: string;
    /** Screen or action that indicates this milestone */
    screen?: string;
    action?: string;
  }>;
}

export interface OnboardingConfig {
  /** Automatically guide the user through these steps */
  enabled: boolean;
  /** Steps in the onboarding journey */
  steps: Array<{
    screen: string;
    message: string;
    /** Element index to highlight via guide tool (optional) */
    highlightIndex?: number;
    /** Auto-complete action if user agrees (optional) */
    action?: string;
  }>;
  /** Only show on the very first time the app is launched. Default: true */
  firstLaunchOnly?: boolean;
  /** Callback fired when the final step is completed */
  onComplete?: () => void;
}

/**
 * Core types for the React Native AI SDK.
 */

// ─── Agent Modes ──────────────────────────────────────────────

export type AgentMode = 'text' | 'voice';

// ─── Interactive Element (discovered from Fiber tree) ─────────

export type ElementType = 'pressable' | 'text-input' | 'switch' | 'scrollable';

export interface InteractiveElement {
  /** Unique index assigned during tree walk */
  index: number;
  /** Element type */
  type: ElementType;
  /** Human-readable label (extracted from Text children or accessibilityLabel) */
  label: string;
  /** Reference to the Fiber node for execution */
  fiberNode: any;
  /** Key props snapshot */
  props: {
    onPress?: (...args: any[]) => void;
    onChangeText?: (text: string) => void;
    onValueChange?: (value: boolean) => void;
    value?: string | boolean;
    placeholder?: string;
    checked?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
  };
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

export interface AgentConfig {
  apiKey: string;
  model?: string;


  /** Maximum steps per task */
  maxSteps?: number;

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

  /** Delay between steps in ms. */
  stepDelay?: number;

  // ─── Status Updates ──────────────────────────────────────────────────────

  /**
   * Called with a human-readable status string at each step.
   * Use this to show dynamic loading text (e.g., "Tapping 'Add'...").
   */
  onStatusUpdate?: (status: string) => void;

  /**
   * Called after each step with token usage data.
   * Use to track cost, enforce budgets, or display usage to the user.
   */
  onTokenUsage?: (usage: TokenUsage) => void;

  /**
   * Callback for when agent needs user input (ask_user tool).
   * The agent loop blocks until the user responds.
   * If not set, ask_user tool will break the loop (legacy behavior).
   * @example onAskUser: (q) => new Promise(resolve => showPrompt(q, resolve))
   */
  onAskUser?: (question: string) => Promise<string>;

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

  // ─── MCP Bridge Integration ──────────────────────────────────────────────

  /**
   * Optional URL of the companion Node.js MCP server bridge (e.g. ws://localhost:3101).
   * If set, the SDK will connect to this server and listen for execution requests
   * from external AI agents (like OpenClaw, Claude Desktop, etc).
   */
  mcpServerUrl?: string;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
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

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
  handler: (args: Record<string, any>) => any;
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
    screenshot?: string,
  ): Promise<ProviderResult>;
}

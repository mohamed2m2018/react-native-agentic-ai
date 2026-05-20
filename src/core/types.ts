/**
 * Core types for the page-agent-style React Native AI SDK.
 */

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
    value?: string;
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
  reflection: {
    evaluationPreviousGoal: string;
    memory: string;
    nextGoal: string;
  };
  action: {
    name: string;
    input: Record<string, any>;
    output: string;
  };
}

export interface AgentConfig {
  apiKey: string;
  model?: string;
  language?: 'en' | 'ar';

  /** Maximum steps per task (page-agent default: 40) */
  maxSteps?: number;

  // ─── Element Gating (mirrors page-agent interactiveBlacklist/Whitelist) ──

  /**
   * React refs of elements the AI must NOT interact with.
   * Mirrors page-agent.js `interactiveBlacklist: Element[]`.
   * The Fiber walker skips any node whose ref matches one in this list.
   */
  interactiveBlacklist?: React.RefObject<any>[];

  /**
   * If set, the AI can ONLY interact with these elements.
   * Mirrors page-agent.js `interactiveWhitelist: Element[]`.
   */
  interactiveWhitelist?: React.RefObject<any>[];

  // ─── Lifecycle Hooks (mirrors page-agent onBefore/AfterStep/Task) ───────

  /** Called before each agent step. */
  onBeforeStep?: (stepCount: number) => Promise<void> | void;

  /** Called after each agent step with full history. */
  onAfterStep?: (history: AgentStep[]) => Promise<void> | void;

  /** Called before task execution starts. */
  onBeforeTask?: () => Promise<void> | void;

  /** Called after task completes (success or failure). */
  onAfterTask?: (result: ExecutionResult) => Promise<void> | void;

  // ─── Content Masking (mirrors page-agent transformPageContent) ──────────

  /**
   * Transform dehydrated screen text before sending to LLM.
   * Use to mask sensitive data (credit cards, PII, etc).
   * Mirrors page-agent.js `transformPageContent`.
   */
  transformScreenContent?: (content: string) => Promise<string> | string;

  // ─── Custom Tools (mirrors page-agent customTools) ─────────────────────

  /**
   * Override or remove built-in tools.
   * Set tool to `null` to remove it (e.g., `{ navigate: null }`).
   * Mirrors page-agent.js `customTools: Record<string, Tool | null>`.
   */
  customTools?: Record<string, ToolDefinition | null>;

  // ─── Instructions (mirrors page-agent instructions) ────────────────────

  /** Instructions to guide the agent's behavior. */
  instructions?: {
    /** Global system-level instructions, applied to all tasks. */
    system?: string;
    /**
     * Dynamic per-screen instructions callback.
     * Called before each step to get instructions for the current screen.
     * Mirrors page-agent.js `getPageInstructions(url)`.
     */
    getScreenInstructions?: (screenName: string) => string | undefined | null;
  };

  /** Delay between steps in ms (page-agent default: 400ms). */
  stepDelay?: number;

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

export interface AIProvider {
  generateContent(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    history: AgentStep[],
  ): Promise<{
    toolCalls: Array<{ name: string; args: Record<string, any> }>;
    text?: string;
  }>;
}

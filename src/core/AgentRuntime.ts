/**
 * AgentRuntime — The main agent loop.
 *
 * Flow:
 * 1. Walk Fiber tree → detect interactive elements
 * 2. Dehydrate screen → text for LLM
 * 3. Send to AI provider with tools
 * 4. Parse tool call → execute (tap, type, navigate, done)
 * 5. If not done, repeat from step 1 (re-dehydrate after UI change)
 */

import { logger } from '../utils/logger';
import { walkFiberTree } from './FiberTreeWalker';
import type { WalkConfig } from './FiberTreeWalker';
import { dehydrateScreen } from './ScreenDehydrator';
import { buildSystemPrompt, buildKnowledgeOnlyPrompt } from './systemPrompt';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { installAlertInterceptor, uninstallAlertInterceptor } from './NativeAlertInterceptor';
import {
  createTapTool,
  createLongPressTool,
  createTypeTool,
  createScrollTool,
  createSliderTool,
  createPickerTool,
  createDatePickerTool,
  createKeyboardTool,
  createGuideTool,
  createSimplifyTool,
  createRestoreTool,
} from '../tools';
import type { ToolContext } from '../tools';
import type {
  AIProvider,
  AgentConfig,
  AgentTraceEvent,
  AgentStep,
  ExecutionResult,
  ToolDefinition,
  TokenUsage,
} from './types';
import { actionRegistry } from './ActionRegistry';

const DEFAULT_MAX_STEPS = 25;

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}


const APPROVAL_GRANTED_TOKEN = '__APPROVAL_GRANTED__';
const APPROVAL_REJECTED_TOKEN = '__APPROVAL_REJECTED__';
const APPROVAL_ALREADY_DONE_TOKEN = '__APPROVAL_ALREADY_DONE__';
const USER_ALREADY_COMPLETED_MESSAGE = '✅ It looks like you already completed that step yourself. Great — let me know if you want help with anything else.';

const ACTION_NOT_APPROVED_MESSAGE = "Okay — I won't do that. If you'd like, I can help with something else instead.";

// ─── Agent Runtime ─────────────────────────────────────────────

export class AgentRuntime {
  private provider: AIProvider;
  private config: AgentConfig;
  private rootRef: any;
  private navRef: any;
  private tools: Map<string, ToolDefinition> = new Map();
  private history: AgentStep[] = [];
  private isRunning = false;
  private isCancelRequested = false;
  private lastAskUserQuestion: string | null = null;
  private knowledgeService: KnowledgeBaseService | null = null;
  private uiControlOverride?: boolean;
  private lastDehydratedRoot: any = null;
  private currentTraceId: string | null = null;

  // ─── Task-scoped error suppression ──────────────────────────
  // Installed once at execute() start, removed after grace period.
  // Catches ALL async errors (useEffect, native callbacks, PagerView)
  // that would otherwise crash the host app during agent execution.
  private originalErrorHandler: ((error: Error, isFatal?: boolean) => void) | null = null;
  private lastSuppressedError: Error | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private originalReportErrorsAsExceptions: boolean | undefined = undefined;

  // ─── App-action approval gate ────────────────────────────────
  // Tracks whether the support consent flow (ask_user + request_app_action=true)
  // has been issued and whether the user has explicitly approved it via button tap.
  // Only UI-altering tools are gated; informational tools (done, query_knowledge) are not.
  private appActionApproved = false;        // true only after __APPROVAL_GRANTED__ received
  // Tools that physically alter the app — must be gated by appAction approval
  private static readonly APP_ACTION_TOOLS = new Set([
    'tap', 'type', 'scroll', 'navigate', 'long_press', 'slider', 'picker', 'date_picker', 'keyboard',
  ]);

  public getConfig(): AgentConfig {
    return this.config;
  }

  constructor(
    provider: AIProvider,
    config: AgentConfig,
    rootRef: any,
    navRef: any,
  ) {
    this.provider = provider;
    this.config = config;
    this.rootRef = rootRef;
    this.navRef = navRef;
    logger.debug('AgentRuntime', 'constructor: config.screenMap exists:', !!config.screenMap);

    // Initialize knowledge base service if configured
    if (config.knowledgeBase) {
      this.knowledgeService = new KnowledgeBaseService(
        config.knowledgeBase,
        config.knowledgeMaxTokens
      );
    }

    // Register tools based on mode
    if (config.enableUIControl === false) {
      this.registerKnowledgeOnlyTools();
    } else {
      this.registerBuiltInTools();
    }

    // Apply customTools
    if (config.customTools) {
      for (const [name, tool] of Object.entries(config.customTools)) {
        if (tool === null) {
          this.tools.delete(name);
          logger.info('AgentRuntime', `Removed tool: ${name}`);
        } else {
          this.tools.set(name, tool);
          logger.info('AgentRuntime', `Overrode tool: ${name}`);
        }
      }
    }
  }

  // ─── Tool Registration ─────────────────────────────────────

  private registerBuiltInTools(): void {
    // ── Tool Context — shared dependencies for modular tools ──
    const toolContext: ToolContext = {
      getRootRef: () => this.rootRef,
      getWalkConfig: () => this.getWalkConfig(),
      getCurrentScreenName: () => this.getCurrentScreenName(),
      getNavRef: () => this.navRef,
      routerRef: this.config.router,
      getRouteNames: () => this.getRouteNames(),
      findScreenPath: (name: string) => this.findScreenPath(name),
      buildNestedParams: (path: string[], params?: any) => this.buildNestedParams(path, params),
      captureScreenshot: async () => (await this.captureScreenshot()) ?? null,
      getLastDehydratedRoot: () => this.lastDehydratedRoot,
    };

    // ── Register modular tools (extracted to src/tools/) ──
    const modularTools = [
      createTapTool(toolContext),
      createLongPressTool(toolContext),
      createTypeTool(toolContext),
      createScrollTool(toolContext),
      createSliderTool(toolContext),
      createPickerTool(toolContext),
      createDatePickerTool(toolContext),
      createKeyboardTool(),
      createGuideTool(toolContext),
      createSimplifyTool(),
      createRestoreTool(),
    ];

    for (const tool of modularTools) {
      this.tools.set(tool.name, tool);
    }


    // navigate — navigate to a screen (supports React Navigation + Expo Router)
    this.tools.set('navigate', {
      name: 'navigate',
      description: 'Navigate to a top-level screen by name. ONLY use this for top-level screens that do NOT require route params (e.g. Login, Settings, Cart, TabBar). NEVER use this for parameterized screens that require an ID or selection (e.g. DishDetail, SelectCategory, ProfileDetail, OrderDetails) — those screens will crash without required params. For parameterized screens, always navigate by TAPPING the relevant item in the parent screen instead.',
      parameters: {
        screen: { type: 'string', description: 'Top-level screen name to navigate to (must not require route params)', required: true },
        params: { type: 'string', description: 'Optional JSON params object for screens that accept them', required: false },
      },
      execute: async (args) => {
        // Expo Router path: use router.push()
        if (this.config.router) {
          try {
            const path = args.screen.startsWith('/') ? args.screen : `/${args.screen}`;
            this.config.router.push(path);
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Navigated to "${path}"`;
          } catch (error: any) {
            return `❌ Navigation error: ${error.message}`;
          }
        }

        // React Navigation path: use navRef
        if (!this.navRef) {
          return '❌ Navigation ref not available.';
        }
        if (!this.navRef.isReady()) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!this.navRef.isReady()) {
            return '❌ Navigation is not ready yet.';
          }
        }
        try {
          const params = args.params ? (typeof args.params === 'string' ? JSON.parse(args.params) : args.params) : undefined;
          // Case-insensitive screen name matching
          const availableRoutes = this.getRouteNames();
          logger.info('AgentRuntime', `🧭 Navigate requested: "${args.screen}" | Available: [${availableRoutes.join(', ')}] | Params: ${JSON.stringify(params)}`);
          const matchedScreen = availableRoutes.find(
            r => r.toLowerCase() === args.screen.toLowerCase()
          );

          // Guard: screen must exist in the navigation tree
          if (!matchedScreen) {
            const errMsg = `❌ "${args.screen}" is not a screen — it may be content within a screen. Available screens: ${availableRoutes.join(', ')}. Look at the current screen context for "${args.screen}" as a section, category, or element, and scroll/tap to find it. If it's on a different screen, navigate to the correct screen first.`;
            logger.warn('AgentRuntime', `🧭 Navigate REJECTED: ${errMsg}`);
            return errMsg;
          }
          logger.info('AgentRuntime', `🧭 Navigate matched: "${args.screen}" → "${matchedScreen}"`);

          // Find the path to the screen (handles nested navigators)
          const screenPath = this.findScreenPath(matchedScreen);
          if (screenPath.length > 1) {
            // Nested screen: navigate using parent → { screen: child } pattern
            // e.g. navigate('HomeTab', { screen: 'Home', params })
            logger.info('AgentRuntime', `Nested navigation: ${screenPath.join(' → ')}`);
            const nestedParams = this.buildNestedParams(screenPath, params);
            this.navRef.navigate(screenPath[0], nestedParams);
          } else {
            // Top-level screen: direct navigate
            this.navRef.navigate(matchedScreen, params);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Navigated to "${matchedScreen}"${params ? ` with params: ${JSON.stringify(params)}` : ''}`;
        } catch (error: any) {
          return `❌ Navigation error: ${error.message}. Available screens: ${this.getRouteNames().join(', ')}`;
        }
      },
    });

    // done — complete the task
    this.tools.set('done', {
      name: 'done',
      description: 'Complete the task with a message to the user.',
      parameters: {
        text: { type: 'string', description: 'Response message to the user', required: true },
        message: { type: 'string', description: 'Alternative to text parameter', required: false },
        success: { type: 'boolean', description: 'Whether the task was completed successfully', required: true },
      },
      execute: async (args) => {
        let cleanText = args.text || args.message || '';
        if (typeof cleanText === 'string') {
          // Strip bracketed indices safely avoiding regex stack overflows on large strings
          cleanText = cleanText.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();
        }
        return cleanText;
      },
    });

    // wait — explicitly wait for loading states
    this.tools.set('wait', {
      name: 'wait',
      description: 'Wait for a specified number of seconds before taking the next action. Use this when the screen explicitly shows "Loading...", "Please wait", or loading skeletons, to give the app time to fetch data.',
      parameters: {
        seconds: { type: 'number', description: 'Number of seconds to wait (max 5)', required: true },
      },
      execute: async (args) => {
        const seconds = Math.min(Number(args.seconds) || 2, 5);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return `⏳ Waited ${seconds} seconds for the screen to update.`;
      },
    });

    // ask_user — ask for clarification
    this.tools.set('ask_user', {
      name: 'ask_user',
      description: 'Communicate with the user. Use this to ask questions, request permission for app actions, OR answer a question the user asked.',
      parameters: {
        question: { type: 'string', description: 'The message or question to say to the user', required: true },
        request_app_action: { type: 'boolean', description: 'Set to true when requesting permission to take an action in the app (navigate, tap, investigate). Shows explicit approval buttons to the user.', required: true },
      },
      execute: async (args) => {
        // Strip any leaked bracketed indices like [41] safely
        let cleanQuestion = args.question || '';
        if (typeof cleanQuestion === 'string') {
          cleanQuestion = cleanQuestion.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();
        }
        const kind = args.request_app_action ? 'approval' : 'freeform';

        // Mark that the support approval flow has been initiated
        if (args.request_app_action) {
          this.appActionApproved = false; // reset until user taps Allow
          logger.info('AgentRuntime', '🔒 App action gate: approval requested, UI tools now BLOCKED until granted');
        }

        logger.info('AgentRuntime', `❓ ask_user emitted (kind=${kind}): "${cleanQuestion}"`);
        if (this.config.onAskUser) {
          // Block until user responds, then continue the loop
          this.config.onStatusUpdate?.('Waiting for your answer...');
          logger.info('AgentRuntime', `⏸️ Waiting for user response via onAskUser callback (kind=${kind})`);
          const answer = await this.config.onAskUser({ question: cleanQuestion, kind });
          logger.info('AgentRuntime', `✅ ask_user resolved with: "${String(answer)}"`);

          // Resolve approval gate based on button response
          if (answer === '__APPROVAL_GRANTED__') {
            this.appActionApproved = true;
            logger.info('AgentRuntime', '✅ App action gate: APPROVED — UI tools unblocked');
          } else if (answer === '__APPROVAL_REJECTED__') {
            this.appActionApproved = false;
            logger.info('AgentRuntime', '🚫 App action gate: REJECTED — UI tools remain blocked');
          }
          // Any other text answer (conversational interruption) leaves appActionApproved as-is

          return `User answered: ${answer}`;
        }
        // Legacy fallback: break the loop (context will be lost)
        logger.warn('AgentRuntime', '⚠️ ask_user has no onAskUser callback; returning legacy fallback');
        return `❓ ${cleanQuestion}`;
      },
    });

    // capture_screenshot — on-demand visual capture (for image/video content questions)
    this.tools.set('capture_screenshot', {
      name: 'capture_screenshot',
      description: 'Capture a screenshot of the current screen. Use when the user asks about visual content (images, videos, colors, layout appearance) that cannot be determined from the element tree alone.',
      parameters: {},
      execute: async () => {
        const screenshot = await this.captureScreenshot();
        if (screenshot) {
          return `✅ Screenshot captured (${Math.round(screenshot.length / 1024)}KB). Visual content is now available for analysis.`;
        }
        return '❌ Screenshot capture failed. react-native-view-shot may not be installed.';
      },
    });




    // query_knowledge — retrieve domain-specific knowledge (only if knowledgeBase is configured)
    if (this.knowledgeService) {
      this.tools.set('query_knowledge', {
        name: 'query_knowledge',
        description:
          'Search the app knowledge base for domain-specific information '
          + '(policies, FAQs, product details, delivery areas, allergens, etc). '
          + 'Use when the user asks about the business or app and the answer is NOT visible on screen.',
        parameters: {
          question: {
            type: 'string',
            description: 'The question or topic to search for',
            required: true,
          },
        },
        execute: async (args) => {
          const screenName = this.getCurrentScreenName();
          return this.knowledgeService!.retrieve(args.question, screenName);
        },
      });
    }
  }

  /**
   * Register only knowledge-assistant tools (no UI control).
   * Used when enableUIControl = false — the AI can only answer questions.
   */
  private registerKnowledgeOnlyTools(): void {
    // done — complete the task
    this.tools.set('done', {
      name: 'done',
      description: 'Complete the task with a message to the user.',
      parameters: {
        text: { type: 'string', description: 'Response message to the user', required: true },
        success: { type: 'boolean', description: 'Whether the task was completed successfully', required: true },
      },
      execute: async (args) => {
        return args.text;
      },
    });

    // query_knowledge — retrieve domain-specific knowledge (only if knowledgeBase is configured)
    if (this.knowledgeService) {
      this.tools.set('query_knowledge', {
        name: 'query_knowledge',
        description:
          'Search the app knowledge base for domain-specific information '
          + '(policies, FAQs, product details, delivery areas, allergens, etc). '
          + 'Use when the user asks about the business or app and the answer is NOT visible on screen.',
        parameters: {
          question: {
            type: 'string',
            description: 'The question or topic to search for',
            required: true,
          },
        },
        execute: async (args) => {
          const screenName = this.getCurrentScreenName();
          return this.knowledgeService!.retrieve(args.question, screenName);
        },
      });
    }
  }

  // ─── Navigation Helpers ────────────────────────────────────

  /**
   * Recursively collect ALL screen names from the navigation state tree.
   * This handles tabs, drawers, and nested stacks.
   */
  private getRouteNames(): string[] {
    try {
      if (!this.navRef?.isReady?.()) return [];
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state) return [];
      const names = this.collectRouteNames(state);
      logger.debug('AgentRuntime', 'Available routes:', names.join(', '));
      return names;
    } catch {
      return [];
    }
  }

  private collectRouteNames(state: any): string[] {
    const names: string[] = [];
    // routeNames contains ALL defined screens (including unvisited)
    if (state?.routeNames) {
      names.push(...state.routeNames);
    }
    if (state?.routes) {
      for (const route of state.routes) {
        names.push(route.name);
        // Recurse into nested navigator states
        if (route.state) {
          names.push(...this.collectRouteNames(route.state));
        }
      }
    }
    return [...new Set(names)];
  }

  /**
   * Find the path from root navigator to a target screen.
   * Returns [parentTab, screen] for nested screens, or [screen] for top-level.
   * Example: findScreenPath('Home') → ['HomeTab', 'Home']
   */
  private findScreenPath(targetScreen: string): string[] {
    try {
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state?.routes) return [targetScreen];

      // Check if target is a direct top-level route
      if (state.routes.some((r: any) => r.name === targetScreen)) {
        return [targetScreen];
      }

      // Search nested navigators
      for (const route of state.routes) {
        const nestedNames = route.state ? this.collectRouteNames(route.state) : [];
        if (nestedNames.includes(targetScreen)) {
          return [route.name, targetScreen];
        }
      }

      return [targetScreen]; // Fallback: try direct
    } catch {
      return [targetScreen];
    }
  }


  /**
   * Build nested params for React Navigation nested screen navigation.
   * ['HomeTab', 'Home'] → { screen: 'Home', params }
   * ['Tab', 'Stack', 'Screen'] → { screen: 'Stack', params: { screen: 'Screen', params } }
   */
  private buildNestedParams(path: string[], leafParams?: any): any {
    // Build from the end: innermost screen gets the leafParams
    let result = leafParams;
    for (let i = path.length - 1; i >= 1; i--) {
      result = { screen: path[i], ...(result !== undefined ? { params: result } : {}) };
    }
    return result;
  }

  /**
   * Recursively find the deepest active screen name.
   * For tabs: follows active tab → active screen inside that tab.
   */
  private getCurrentScreenName(): string {
    // Expo Router: use pathname
    if (this.config.pathname) {
      const segments = this.config.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || 'Unknown';
    }

    try {
      if (!this.navRef?.isReady?.()) return 'Unknown';
      const state = this.navRef?.getRootState?.() || this.navRef?.getState?.();
      if (!state) return 'Unknown';
      return this.getDeepestScreenName(state);
    } catch {
      return 'Unknown';
    }
  }

  private getDeepestScreenName(state: any): string {
    if (!state?.routes || state.index == null) return 'Unknown';
    const route = state.routes[state.index];
    if (!route) return 'Unknown';
    // If this route has a nested state, recurse deeper
    if (route.state) {
      return this.getDeepestScreenName(route.state);
    }
    return route.name || 'Unknown';
  }

  // ─── Dynamic Config Overrides ────────────────────────────────

  public setUIControlOverride(enabled: boolean | undefined) {
    this.uiControlOverride = enabled;
  }

  private isUIEnabled(): boolean {
    if (this.uiControlOverride !== undefined) return this.uiControlOverride;
    return this.config.enableUIControl !== false; // defaults to true
  }

  /** Maps a tool call to a user-friendly status label for the loading overlay. */
  private getToolStatusLabel(toolName: string, args: Record<string, any>): string {
    switch (toolName) {
      case 'tap':
        return 'Tapping a button...';
      case 'type':
        return 'Typing into a field...';
      case 'navigate':
        return `Navigating to ${args.screen || 'another screen'}...`;
      case 'done':
        return 'Wrapping up...';
      case 'ask_user':
        return 'Asking you a question...';
      case 'query_knowledge':
        return 'Searching knowledge base...';
      case 'scroll':
        return `Scrolling ${args.direction || 'down'}...`;
      case 'wait':
        return 'Waiting for the screen to load...';
      case 'long_press':
        return 'Long-pressing an element...';
      case 'adjust_slider':
        return `Adjusting slider to ${Math.round((args.value ?? 0) * 100)}%...`;
      case 'select_picker':
        return `Selecting "${args.value || ''}" from a dropdown...`;
      case 'set_date':
        return `Setting date to ${args.date || ''}...`;
      case 'dismiss_keyboard':
        return 'Dismissing keyboard...';
      default:
        return `Running ${toolName}...`;
    }
  }

  // ─── Screenshot Capture (optional react-native-view-shot) ─────

  /**
   * Captures the current screen as a base64 JPEG for Gemini vision.
   * Uses react-native-view-shot as an optional peer dependency.
   * Returns null if the library is not installed (graceful fallback).
   */
  private async captureScreenshot(): Promise<string | undefined> {
    try {
      // Static require — Metro needs a literal string; the try/catch handles MODULE_NOT_FOUND.
      const viewShot = require('react-native-view-shot');
      const captureRef = viewShot.captureRef || viewShot.default?.captureRef;
      if (!captureRef || !this.rootRef) return undefined;

      const uri = await captureRef(this.rootRef, {
        format: 'jpg',
        quality: 0.4,
        width: 720,
        result: 'base64',
      });

      logger.info('AgentRuntime', `Screenshot captured (${Math.round((uri?.length || 0) / 1024)}KB base64)`);
      return uri || undefined;
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND' || error.message?.includes('unknown module')) {
        logger.warn('AgentRuntime', 'Screenshot requires react-native-view-shot. Install with: npx expo install react-native-view-shot');
      } else {
        logger.debug('AgentRuntime', `Screenshot skipped: ${error.message}`);
      }
      return undefined;
    }
  }

  // ─── Screen Context for Voice Mode ──────────────────────

  /**
   * Get current screen context as formatted text.
   * Used by voice mode: sent once at connect + after each tool call.
   * Tree goes in user prompt, not system instructions.
   */
  public getScreenContext(): string {
    try {
      logger.debug('AgentRuntime', 'getScreenContext called');
      logger.debug('AgentRuntime', 'config.screenMap exists:', !!this.config.screenMap);
      if (this.config.screenMap) {
        logger.debug('AgentRuntime', 'screenMap.screens count:', Object.keys(this.config.screenMap.screens).length);
        logger.debug('AgentRuntime', 'screenMap.chains count:', this.config.screenMap.chains?.length);
      }

      const walkResult = walkFiberTree(this.rootRef, this.getWalkConfig());
      const screenName = this.getCurrentScreenName();
      logger.debug('AgentRuntime', 'current screen:', screenName);

      const screen = dehydrateScreen(
        screenName,
        this.getRouteNames(),
        walkResult.elementsText,
        walkResult.interactives,
      );

      const routeNames = this.getRouteNames();
      logger.debug('AgentRuntime', 'routeNames:', routeNames);
      let availableScreensText: string;
      let appMapText = '';

      if (this.config.screenMap) {
        const map = this.config.screenMap;
        logger.debug('AgentRuntime', 'USING SCREEN MAP - enriching context');

        const screenLines = routeNames.map(name => {
          const entry = map.screens[name];
          if (entry) {
            const title = entry.title ? ` (${entry.title})` : '';
            const line = `- ${name}${title}: ${entry.description}`;
            logger.debug('AgentRuntime', 'matched:', line);
            return line;
          }
          logger.debug('AgentRuntime', 'NO MATCH for route:', name);
          return `- ${name}`;
        });
        availableScreensText = `Available Screens:\n${screenLines.join('\n')}`;

        if (map.chains && map.chains.length > 0) {
          const chainLines = map.chains.map(chain => `  ${chain.join(' → ')}`);
          appMapText = `\nNavigation Chains:\n${chainLines.join('\n')}`;
          logger.debug('AgentRuntime', 'chains:', chainLines.length);
        }

        this.detectStaleMap(routeNames, map);
      } else {
        logger.debug('AgentRuntime', 'NO SCREEN MAP - using flat list');
        availableScreensText = `Available Screens: ${routeNames.join(', ')}`;
      }

      const context = `<screen_update>
Current Screen: ${screenName}
${availableScreensText}${appMapText}

${screen.elementsText}
</screen_update>`;
      logger.debug('AgentRuntime', 'FULL CONTEXT:', context.substring(0, 500));
      return context;
    } catch (error: any) {
      logger.debug('AgentRuntime', 'getScreenContext ERROR:', error.message);
      logger.error('AgentRuntime', `getScreenContext failed: ${error.message}`);
      return '<screen_update>Error reading screen</screen_update>';
    }
  }
  // ─── Stale Map Detection ─────────────────────────────────────

  private staleMapWarned = false;

  private detectStaleMap(routeNames: string[], map: { screens: Record<string, any> }) {
    if (this.staleMapWarned) return; // Only warn once

    const mapScreens = new Set(Object.keys(map.screens));
    const missing = routeNames.filter(r => !mapScreens.has(r));

    if (missing.length > 0) {
      this.staleMapWarned = true;
      console.warn(
        `⚠️ [AIAgent] Screens not in map: "${missing.join('", "')}". ` +
        `Run 'npx react-native-ai-agent generate-map' to update.`
      );
    }
  }

  // ─── Build Tools Array for Provider ────────────────────────

  private buildToolsForProvider(): ToolDefinition[] {
    const allTools = [...this.tools.values()];

    // Add registered actions as tools
    for (const action of actionRegistry.getAll()) {
      const toolParams: Record<string, any> = {};
      for (const [key, val] of Object.entries(action.parameters)) {
        if (typeof val === 'string') {
          toolParams[key] = { type: 'string', description: val, required: true };
        } else {
          toolParams[key] = {
            type: val.type,
            description: val.description,
            required: val.required !== false,
            enum: val.enum
          };
        }
      }

      allTools.push({
        name: action.name,
        description: action.description,
        parameters: toolParams,
        execute: async (args) => {
          try {
            const result = await action.handler(args);
            logger.info('AgentRuntime', `Action "${action.name}" result:`, JSON.stringify(result));
            return typeof result === 'string' ? result : JSON.stringify(result);
          } catch (error: any) {
            return `❌ Action "${action.name}" failed: ${error.message}`;
          }
        },
      });
    }

    return allTools;
  }

  /** Public accessor for voice mode — returns all registered tool definitions. */
  public getTools(): ToolDefinition[] {
    return this.buildToolsForProvider();
  }

  /** Execute a tool by name (for voice mode tool calls from WebSocket). */
  public async executeTool(name: string, args: Record<string, any>): Promise<string> {
    const tool = this.tools.get(name) ||
      this.buildToolsForProvider().find(t => t.name === name);
    if (!tool) {
      return `❌ Unknown tool: ${name}`;
    }
    return this.executeToolSafely(tool, args, name);
  }
  /**
   * Start 3-layer error suppression for the agent task lifecycle.
   *
   * Layer 1 — ErrorUtils: Catches non-React async errors (setTimeout, fetch, native callbacks).
   * Layer 2 — console.reportErrorsAsExceptions: React Native dev-mode flag. When false,
   *           console.error calls don't trigger ExceptionsManager.handleException(),
   *           preventing the red "Render Error" screen for errors that React surfaces
   *           via console.error (useEffect, lifecycle, invariant violations).
   * Layer 3 — Grace period (in _stopErrorSuppression): Keeps suppression active
   *           for N ms after task completion, covering delayed useEffect effects.
   *
   * Same compound approach used by Sentry React Native SDK (ErrorUtils + ExceptionsManager override).
   */
  private _startErrorSuppression(): void {
    // Cancel any pending grace timer from a previous task
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }

    // Layer 1: ErrorUtils global handler
    const ErrorUtils = (global as any).ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      this.originalErrorHandler = ErrorUtils.getGlobalHandler?.() ?? null;
      this.lastSuppressedError = null;
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        this.lastSuppressedError = error;
        logger.warn(
          'AgentRuntime',
          `🛡️ Suppressed ${isFatal ? 'FATAL' : 'non-fatal'} error during agent task: ${error.message}`
        );
        // Don't re-throw — suppress the crash entirely.
      });
    }

    // Layer 2: Suppress dev-mode red screen
    // In RN dev mode, useEffect errors trigger console.error → ExceptionsManager → red screen.
    // This flag is the official RN mechanism to disable that pipeline.
    const consoleAny = console as any;
    if (consoleAny.reportErrorsAsExceptions !== undefined) {
      this.originalReportErrorsAsExceptions = consoleAny.reportErrorsAsExceptions;
      consoleAny.reportErrorsAsExceptions = false;
    }
  }

  /**
   * Stop error suppression after a grace period.
   * The grace period covers delayed React side-effects (useEffect, PagerView onPageSelected,
   * scrollToIndex) that can fire AFTER execute() returns.
   */
  private _stopErrorSuppression(gracePeriodMs: number = 0): void {
    const restore = () => {
      // Restore Layer 1: ErrorUtils
      const ErrorUtils = (global as any).ErrorUtils;
      if (ErrorUtils?.setGlobalHandler && this.originalErrorHandler) {
        ErrorUtils.setGlobalHandler(this.originalErrorHandler);
        this.originalErrorHandler = null;
      }
      this.lastSuppressedError = null;

      // Restore Layer 2: console.reportErrorsAsExceptions
      const consoleAny = console as any;
      if (this.originalReportErrorsAsExceptions !== undefined) {
        consoleAny.reportErrorsAsExceptions = this.originalReportErrorsAsExceptions;
        this.originalReportErrorsAsExceptions = undefined;
      }

      this.graceTimer = null;
    };

    if (gracePeriodMs > 0) {
      this.graceTimer = setTimeout(restore, gracePeriodMs);
    } else {
      restore();
    }
  }

  /**
   * Execute a tool with safety checks.
   * Validates args before execution (Detox/Appium pattern).
   * Checks for async errors that were suppressed during the settle window.
   * The global ErrorUtils handler is task-scoped (installed in execute()),
   * so this method only needs to CHECK for errors, not install/remove.
   */
  private async executeToolSafely(
    tool: { execute: (args: any) => Promise<string> },
    args: any,
    toolName: string,
    stepIndex?: number,
  ): Promise<string> {
    // Clear any previous suppressed error before this tool
    this.lastSuppressedError = null;

    // Signal analytics that the AGENT is acting (not the user).
    // This prevents AI-driven taps from being tracked as user_interaction events.
    this.config.onToolExecute?.(true);

    try {
      this.emitTrace('tool_execution_started', {
        tool: toolName,
        args,
      }, stepIndex);

      // ── Argument Validation (Pattern from Detox/Appium: typeof checks before native dispatch) ──
      const validationError = this.validateToolArgs(args, toolName);
      if (validationError) {
        logger.warn('AgentRuntime', `🛡️ Arg validation rejected "${toolName}": ${validationError}`);
        this.emitTrace('tool_validation_rejected', {
          tool: toolName,
          args,
          validationError,
        }, stepIndex);
        return validationError;
      }

      // ── Copilot aiConfirm gate ──────────────────────────────────
      // In copilot mode, elements marked with aiConfirm={true} require
      // user confirmation before execution. This is the code-level safety net
      // complementing the prompt-level copilot instructions.
      if (this.config.interactionMode !== 'autopilot') {
        logger.info('AgentRuntime', `🛡️ Checking copilot confirmation for ${toolName}(${JSON.stringify(args)})`);
        const confirmResult = await this.checkCopilotConfirmation(toolName, args, stepIndex);
        if (confirmResult) return confirmResult;
      } else {
        logger.info('AgentRuntime', `🚀 interactionMode=autopilot, skipping copilot confirmation for "${toolName}"`);
        this.emitTrace('confirmation_skipped_autopilot', {
          tool: toolName,
          args,
        }, stepIndex);
      }

      // ── App-action approval gate ────────────────────────────────────────
      // Mandate explicit ask_user approval for all UI-altering tools ONLY if we are in
      // copilot mode AND the host app has provided an onAskUser callback.
      // If the model tries to use a UI tool without explicitly getting approval, we block it.
      if (
        this.config.interactionMode !== 'autopilot' &&
        this.config.onAskUser &&
        AgentRuntime.APP_ACTION_TOOLS.has(toolName) &&
        !this.appActionApproved
      ) {
        const blockedMsg = `🚫 APP ACTION BLOCKED: You are attempting to use "${toolName}" but have not yet received explicit user approval. You MUST first call ask_user(request_app_action=true) and wait for the user to explicitly tap 'Allow' before executing ANY UI actions (including navigate, tap, scroll, etc).`;
        logger.warn('AgentRuntime', blockedMsg);
        this.emitTrace('app_action_gate_blocked', { tool: toolName, args }, stepIndex);
        return blockedMsg;
      }

      const result = await tool.execute(args);

      // Settle window for async side-effects (useEffect, native callbacks)
      // The global ErrorUtils handler catches any errors during this window
      await new Promise(resolve => setTimeout(resolve, 2000));

      const suppressedError = this.lastSuppressedError as Error | null;
      if (suppressedError) {
        logger.warn('AgentRuntime', `🛡️ Tool "${toolName}" caused async error (suppressed): ${suppressedError.message}`);
        this.lastSuppressedError = null;
        this.emitTrace('tool_async_error_suppressed', {
          tool: toolName,
          args,
          result,
          error: suppressedError.message,
        }, stepIndex);
        return `${result} (⚠️ a background error was safely caught: ${suppressedError.message})`;
      }
      this.emitTrace('tool_execution_finished', {
        tool: toolName,
        args,
        result,
      }, stepIndex);
      return result;
    } catch (error: any) {
      logger.error('AgentRuntime', `Tool "${toolName}" threw: ${error.message}`);
      this.emitTrace('tool_execution_failed', {
        tool: toolName,
        args,
        error: error?.message ?? String(error),
      }, stepIndex);
      return `❌ Tool "${toolName}" failed: ${error.message}`;
    } finally {
      // Always restore the flag — even on error or validation rejection
      this.config.onToolExecute?.(false);
    }
  }

  /**
   * Validate tool arguments before execution.
   * Pattern from Detox: `typeof index !== 'number' → throw Error`
   * Pattern from Appium: `_.isFinite(x) && _.isFinite(y)` for coordinates
   * Returns error string if validation fails, null if valid.
   */
  private validateToolArgs(args: any, toolName: string): string | null {
    if (!args || typeof args !== 'object') return null;

    // Reject any null/undefined values that could crash native components
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) {
        return `❌ Argument "${key}" is undefined for tool "${toolName}". Provide a valid value.`;
      }
    }

    // Tool-specific number validation (like Detox's typeof checks)
    const numericArgs = ['containerIndex', 'index', 'x', 'y', 'offset'];
    for (const key of numericArgs) {
      if (key in args && args[key] !== null && args[key] !== undefined) {
        const val = args[key];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          return `❌ Argument "${key}" must be a finite number for tool "${toolName}", got ${typeof val}: ${val}`;
        }
      }
    }

    return null;
  }

  private emitTrace(
    stage: string,
    data: Record<string, unknown> = {},
    stepIndex?: number,
  ): void {
    if (!this.currentTraceId || !this.config.onTrace) return;
    const event: AgentTraceEvent = {
      traceId: this.currentTraceId,
      stage,
      timestamp: new Date().toISOString(),
      stepIndex,
      screenName: this.getCurrentScreenName(),
      data,
    };
    this.config.onTrace(event);
  }

  // ─── Copilot Confirmation ─────────────────────────────────────

  /** Write tools that can mutate state — only these are checked for aiConfirm */
  private static readonly WRITE_TOOLS = new Set([
    'tap', 'type', 'long_press', 'adjust_slider', 'select_picker', 'set_date',
  ]);


  /**
   * Check if a tool call targets an aiConfirm element and request user confirmation.
   * Returns null if the action should proceed, or an error string if rejected.
   */
  private async checkCopilotConfirmation(
    toolName: string,
    args: Record<string, any>,
    stepIndex?: number,
  ): Promise<string | null> {
    // Only gate write tools
    if (!AgentRuntime.WRITE_TOOLS.has(toolName)) {
      logger.info('AgentRuntime', `🛡️ No confirmation needed for "${toolName}" because it is not a write tool`);
      this.emitTrace('confirmation_not_needed', {
        tool: toolName,
        reason: 'not_write_tool',
        args,
      }, stepIndex);
      return null;
    }

    // Look up the target element by index
    const index = args.index;
    if (typeof index !== 'number') {
      logger.info('AgentRuntime', `🛡️ No confirmation needed for "${toolName}" because no element index was provided`);
      this.emitTrace('confirmation_not_needed', {
        tool: toolName,
        reason: 'missing_index',
        args,
      }, stepIndex);
      return null;
    }

    const screen = this.lastDehydratedRoot as import('./types').DehydratedScreen | null;
    if (!screen?.elements) {
      logger.warn('AgentRuntime', `🛡️ Could not evaluate confirmation for "${toolName}" because no dehydrated screen was available`);
      this.emitTrace('confirmation_not_evaluated', {
        tool: toolName,
        reason: 'missing_dehydrated_screen',
        args,
      }, stepIndex);
      return null;
    }

    const element = screen.elements.find(e => e.index === index);
    if (!element) {
      logger.warn('AgentRuntime', `🛡️ Could not find element index ${index} for "${toolName}" on screen "${screen.screenName}"`);
      this.emitTrace('confirmation_not_evaluated', {
        tool: toolName,
        reason: 'element_not_found',
        args,
        index,
      }, stepIndex);
      return null;
    }

    logger.info(
      'AgentRuntime',
      `🛡️ Copilot gate inspect: tool="${toolName}" index=${index} label="${element.label}" type="${element.type}" aiConfirm=${element.requiresConfirmation === true}`
    );

    if (!element.requiresConfirmation) {
      logger.info('AgentRuntime', `🛡️ No confirmation needed for "${toolName}" on "${element.label}" because aiConfirm is not set`);
      this.emitTrace('confirmation_not_needed', {
        tool: toolName,
        reason: 'aiConfirm_not_set',
        args,
        elementLabel: element.label,
        elementType: element.type,
        index,
      }, stepIndex);
      return null;
    }

    // Element has aiConfirm — request user confirmation
    const label = element.label || `[${element.type}]`;
    const description = this.getToolStatusLabel(toolName, args);
    const question = `I can do this in the app for you by tapping and typing where needed, and ${description} on "${label}". If you'd rather do it yourself, I can guide you step by step instead.`;

    logger.info('AgentRuntime', `🛡️ Copilot: aiConfirm gate triggered for "${toolName}" on "${label}"`);
    this.emitTrace('confirmation_required', {
      tool: toolName,
      args,
      elementLabel: label,
      elementType: element.type,
      index,
      question,
    }, stepIndex);

    // Use onAskUser if available (integrated into chat UI), otherwise Alert.alert
    if (this.config.onAskUser) {
      logger.info('AgentRuntime', `🛡️ Requesting explicit confirmation via ask_user for "${label}"`);
      this.emitTrace('confirmation_prompted', {
        tool: toolName,
        elementLabel: label,
        elementType: element.type,
        question,
        channel: 'ask_user',
      }, stepIndex);
      const response = await this.config.onAskUser({ question, kind: 'approval' });
      logger.info('AgentRuntime', `🛡️ Confirmation response for "${label}": "${String(response)}"`);
      this.emitTrace('confirmation_response_received', {
        tool: toolName,
        elementLabel: label,
        response: String(response),
      }, stepIndex);
      if (response === APPROVAL_ALREADY_DONE_TOKEN) {
        this.emitTrace('confirmation_already_done', {
          tool: toolName,
          elementLabel: label,
        }, stepIndex);
        return APPROVAL_ALREADY_DONE_TOKEN;
      }
      if (response === APPROVAL_GRANTED_TOKEN) {
        logger.info('AgentRuntime', `✅ User approved "${toolName}" on "${label}"`);
        this.emitTrace('confirmation_approved', {
          tool: toolName,
          elementLabel: label,
          response: 'explicit_button',
        }, stepIndex);
        return null;
      }
      if (response === APPROVAL_REJECTED_TOKEN) {
        logger.info('AgentRuntime', `🛑 User rejected "${toolName}" on "${label}"`);
        this.emitTrace('confirmation_rejected', {
          tool: toolName,
          elementLabel: label,
          response: 'explicit_button',
        }, stepIndex);
        return ACTION_NOT_APPROVED_MESSAGE;
      }

      // If it's conversational input (e.g. "Why?"), pause the action and pass the user's question back to the LLM so it can answer it!
      this.emitTrace('confirmation_interrupted', {
        tool: toolName,
        elementLabel: label,
        response: String(response),
      }, stepIndex);
      return `Action paused because the user interrupted with this message: "${response}". Please answer the user by fully explaining your logic.`;
    }

    // Fallback: React Native Alert
    const { Alert } = require('react-native');
    logger.info('AgentRuntime', `🛡️ Requesting explicit confirmation via native Alert for "${label}"`);
    this.emitTrace('confirmation_prompted', {
      tool: toolName,
      elementLabel: label,
      elementType: element.type,
      question,
      channel: 'native_alert',
    }, stepIndex);
    const approved = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Confirm Action',
        question,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });

    if (!approved) {
      logger.info('AgentRuntime', `🛑 User rejected "${toolName}" on "${label}"`);
      this.emitTrace('confirmation_rejected', {
        tool: toolName,
        elementLabel: label,
        response: 'cancel',
      }, stepIndex);
      return ACTION_NOT_APPROVED_MESSAGE;
    }

    logger.info('AgentRuntime', `✅ User approved "${toolName}" on "${label}" via native Alert`);
    this.emitTrace('confirmation_approved', {
      tool: toolName,
      elementLabel: label,
      response: 'continue',
    }, stepIndex);
    return null;
  }

  // ─── Walk Config (passes security settings to FiberTreeWalker) ─

  private getWalkConfig(): WalkConfig {
    return {
      interactiveBlacklist: this.config.interactiveBlacklist,
      interactiveWhitelist: this.config.interactiveWhitelist,
      screenName: this.getCurrentScreenName(),
      interceptNativeAlerts: this.config.interceptNativeAlerts,
    };
  }

  // ─── Instructions ───────

  private getInstructions(screenName: string): string {
    const { instructions } = this.config;
    if (!instructions) return '';

    let result = '';
    if (instructions.system?.trim()) {
      result += `<system_instructions>\n${instructions.system.trim()}\n</system_instructions>\n`;
    }

    if (instructions.getScreenInstructions) {
      try {
        const screenInstructions = instructions.getScreenInstructions(screenName)?.trim();
        if (screenInstructions) {
          result += `<screen_instructions>\n${screenInstructions}\n</screen_instructions>\n`;
        }
      } catch (error) {
        logger.error('AgentRuntime', 'Failed to get screen instructions:', error);
      }
    }

    return result ? `<instructions>\n${result}</instructions>\n\n` : '';
  }

  // ─── Observation System ──

  private observations: string[] = [];
  private lastScreenName: string = '';

  private handleObservations(step: number, maxSteps: number, screenName: string): void {
    // Screen change detection
    if (this.lastScreenName && screenName !== this.lastScreenName) {
      this.observations.push(`Screen navigated to → ${screenName}`);
    }
    this.lastScreenName = screenName;

    // Remaining steps warning
    const remaining = maxSteps - step;
    if (remaining === 5) {
      this.observations.push(
        `⚠️ Only ${remaining} steps remaining. Consider wrapping up or calling done with partial results.`
      );
    } else if (remaining === 2) {
      this.observations.push(
        `⚠️ Critical: Only ${remaining} steps left! You must finish the task or call done immediately.`
      );
    }
  }

  // ─── User Prompt Assembly ──

  private assembleUserPrompt(
    step: number,
    maxSteps: number,
    contextualMessage: string,
    screenName: string,
    screenContent: string,
    chatHistory?: { role: string; content: string }[]
  ): string {
    let prompt = '';

    // 1. <instructions> (optional system/screen instructions)
    prompt += this.getInstructions(screenName);

    // 2. <agent_state> — user request + step info
    prompt += '<agent_state>\n';
    prompt += '<user_request>\n';
    prompt += `${contextualMessage}\n`;
    prompt += '</user_request>\n';

    if (chatHistory && chatHistory.length > 0) {
      prompt += '<chat_history>\n';
      // Only include the last 10 messages to manage context length
      const recentHistory = chatHistory.slice(-10);
      for (const msg of recentHistory) {
        prompt += `[${msg.role}]: ${msg.content}\n`;
      }
      prompt += '</chat_history>\n';
    }

    prompt += '<step_info>\n';
    prompt += `Step ${step + 1} of ${maxSteps} max possible steps\n`;
    prompt += '</step_info>\n';
    prompt += '</agent_state>\n\n';

    // 3. <agent_history> — structured per-step history
    prompt += '<agent_history>\n';

    // History summarization: when steps > 8, compress middle steps
    // to bound prompt growth for long tasks (approaching 25-step limit).
    // Keep first 2 (initial context) + last 4 (recent context) as full detail.
    const SUMMARIZE_THRESHOLD = 8;
    const KEEP_HEAD = 2;
    const KEEP_TAIL = 4;
    const shouldSummarize = this.history.length > SUMMARIZE_THRESHOLD;

    let stepIndex = 0;
    for (let i = 0; i < this.history.length; i++) {
      const event = this.history[i]!;
      stepIndex++;

      if (shouldSummarize && i >= KEEP_HEAD && i < this.history.length - KEEP_TAIL) {
        // First compressed step emits the summary block
        if (i === KEEP_HEAD) {
          prompt += '<steps_summary>\n';
          for (let j = KEEP_HEAD; j < this.history.length - KEEP_TAIL; j++) {
            const h = this.history[j]!;
            const actionName = h.action.name || 'unknown';
            const succeeded = h.action.output?.startsWith('✅') ? 'success' : 'fail';
            prompt += `Step ${j + 1}: ${actionName} → ${succeeded}\n`;
          }
          prompt += '</steps_summary>\n';
        }
        continue; // Skip full detail for middle steps
      }

      prompt += `<step_${stepIndex}>\n`;
      prompt += `Previous Goal Eval: ${event.reflection.previousGoalEval}\n`;
      prompt += `Memory: ${event.reflection.memory}\n`;
      prompt += `Plan: ${event.reflection.plan}\n`;
      prompt += `Action Result: ${event.action.output}\n`;
      prompt += `</step_${stepIndex}>\n`;
    }

    // Inject system observations
    for (const obs of this.observations) {
      prompt += `<sys>${obs}</sys>\n`;
    }
    this.observations = [];

    prompt += '</agent_history>\n\n';

    // 4. <screen_state> — dehydrated screen content + screen map enrichment
    logger.debug('AgentRuntime', 'assembleUserPrompt: screenMap exists:', !!this.config.screenMap);
    prompt += '<screen_state>\n';
    prompt += `Current Screen: ${screenName}\n`;

    // Inject screen map descriptions & navigation chains if available
    if (this.config.screenMap) {
      const map = this.config.screenMap;
      const routeNames = this.getRouteNames();
      logger.debug('AgentRuntime', 'ENRICHING prompt with screenMap for screen:', screenName);

      // Build enriched screen list with descriptions
      const screenLines = routeNames.map(name => {
        const entry = map.screens[name];
        if (entry) {
          const title = entry.title ? ` (${entry.title})` : '';
          return `- ${name}${title}: ${entry.description}`;
        }
        return `- ${name}`;
      });
      prompt += `\nAvailable Screens:\n${screenLines.join('\n')}\n`;

      // Add navigation chains
      if (map.chains && map.chains.length > 0) {
        const chainLines = map.chains.map(chain => `  ${chain.join(' → ')}`);
        prompt += `\nNavigation Chains:\n${chainLines.join('\n')}\n`;
      }
    } else {
      // Flat list fallback
      const routeNames = this.getRouteNames();
      prompt += `Available Screens: ${routeNames.join(', ')}\n`;
    }

    prompt += '\n' + screenContent + '\n';
    prompt += '</screen_state>\n';

    return prompt;
  }

  // ─── Main Execution Loop ──────────────────────────────────────

  async execute(userMessage: string, chatHistory?: { role: string; content: string }[]): Promise<ExecutionResult> {
    if (this.isRunning) {
      return { success: false, message: 'Agent is already running.', steps: [] };
    }

    this.isRunning = true;
    this.isCancelRequested = false;
    this.history = [];
    this.currentTraceId = generateTraceId();
    this.observations = [];
    this.lastScreenName = '';
    // Reset app-action approval gate for each new task
    this.appActionApproved = false;
    const maxSteps = this.config.maxSteps || DEFAULT_MAX_STEPS;
    const stepDelay = this.config.stepDelay ?? 300;

    // Token usage accumulator for the entire task
    const sessionUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    };

    // Inject conversational context if we are answering the AI's question
    let contextualMessage = userMessage;
    if (this.lastAskUserQuestion) {
      contextualMessage = `(Note: You just asked the user: "${this.lastAskUserQuestion}")\n\nUser replied: ${userMessage}`;
      this.lastAskUserQuestion = null; // Consume the question
    }

    logger.info('AgentRuntime', `Starting execution: "${contextualMessage}"`);

    // Lifecycle: onBeforeTask
    await this.config.onBeforeTask?.();

    try {
      this.emitTrace('task_started', {
        message: userMessage,
        contextualMessage,
        maxSteps,
        interactionMode: this.config.interactionMode || 'copilot',
        enableUIControl: this.config.enableUIControl !== false,
        chatHistoryLength: chatHistory?.length ?? 0,
      });
      
      // ── Start interceptors & error suppression ──────────────────
      if (this.config.interceptNativeAlerts) {
        installAlertInterceptor();
      }
      this._startErrorSuppression();

      // ─── Knowledge-only fast path ─────────────────────────────────
      // Skip fiber walk, dehydration, screenshots, and multi-step loop.
      // Only sends the user question → single LLM call → done.
      if (!this.isUIEnabled()) {
        this.config.onStatusUpdate?.('Thinking...');
        const hasKnowledge = !!this.knowledgeService;
        const systemPrompt = buildKnowledgeOnlyPrompt(
          'en', hasKnowledge, this.config.instructions?.system,
        );
        const tools = this.buildToolsForProvider();
        const screenName = this.getCurrentScreenName();

        // Minimal user prompt — just the question + screen name for context
        const userPrompt = `Current screen: ${screenName}\n\nUser: ${contextualMessage}`;

        const response = await this.provider.generateContent(
          systemPrompt, userPrompt, tools, [], undefined,
        );

        // Track token usage
        if (response.tokenUsage) {
          sessionUsage.promptTokens += response.tokenUsage.promptTokens;
          sessionUsage.completionTokens += response.tokenUsage.completionTokens;
          sessionUsage.totalTokens += response.tokenUsage.totalTokens;
          sessionUsage.estimatedCostUSD += response.tokenUsage.estimatedCostUSD;
          this.config.onTokenUsage?.(response.tokenUsage);
        }

        // Execute tool calls (done / query_knowledge)
        let message = response.text || '';
        if (response.toolCalls) {
          for (const tc of response.toolCalls) {
            const tool = this.tools.get(tc.name);
            if (tool) {
              const result = await this.executeToolSafely(tool, tc.args, tc.name);
              if (tc.name === 'done') {
                message = result;
              } else if (tc.name === 'query_knowledge') {
                // Knowledge retrieved — need a second call with the results
                const followUp = `Knowledge result:\n${result}\n\nUser question: ${contextualMessage}\n\nAnswer the user based on this knowledge. Call done() with your answer.`;
                const followUpResponse = await this.provider.generateContent(
                  systemPrompt, followUp, tools, [], undefined,
                );
                if (followUpResponse.tokenUsage) {
                  sessionUsage.promptTokens += followUpResponse.tokenUsage.promptTokens;
                  sessionUsage.completionTokens += followUpResponse.tokenUsage.completionTokens;
                  sessionUsage.totalTokens += followUpResponse.tokenUsage.totalTokens;
                  sessionUsage.estimatedCostUSD += followUpResponse.tokenUsage.estimatedCostUSD;
                  this.config.onTokenUsage?.(followUpResponse.tokenUsage);
                }
                if (followUpResponse.toolCalls) {
                  for (const ftc of followUpResponse.toolCalls) {
                    if (ftc.name === 'done') {
                      const doneResult = await this.tools.get('done')!.execute(ftc.args);
                      message = doneResult;
                    }
                  }
                }
                if (!message && followUpResponse.text) {
                  message = followUpResponse.text;
                }
              }
            }
          }
        }

        const result: ExecutionResult = {
          success: true,
          message: message || 'I could not find an answer.',
          steps: [],
          tokenUsage: sessionUsage,
        };
        await this.config.onAfterTask?.(result);
        return result;
      }

      // ─── Full agent loop (UI control enabled) ─────────────────────
      for (let step = 0; step < maxSteps; step++) {
        // ── Cancel check ──
        if (this.isCancelRequested) {
          logger.info('AgentRuntime', `Task cancelled by user at step ${step + 1}`);
          this.emitTrace('task_cancelled', { reason: 'user_cancelled' }, step);
          const cancelResult: ExecutionResult = {
            success: false,
            message: 'Task was cancelled.',
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          await this.config.onAfterTask?.(cancelResult);
          return cancelResult;
        }
        logger.info('AgentRuntime', `===== Step ${step + 1}/${maxSteps} =====`);
        this.emitTrace('step_started', {
          maxSteps,
          historyLength: this.history.length,
        }, step);
        logger.info(
          'AgentRuntime',
          `⚙️ Effective mode: interactionMode=${this.config.interactionMode || 'copilot(default)'} | onAskUser=${!!this.config.onAskUser} | enableUIControl=${this.config.enableUIControl !== false}`
        );

        // Lifecycle: onBeforeStep
        await this.config.onBeforeStep?.(step);

        // 1. Walk Fiber tree with security config and dehydrate screen
        const walkResult = walkFiberTree(this.rootRef, this.getWalkConfig());
        const screenName = this.getCurrentScreenName();
        const screen = dehydrateScreen(
          screenName,
          this.getRouteNames(),
          walkResult.elementsText,
          walkResult.interactives,
        );

        // Store root for tooling access (e.g., GuideTool measuring)
        this.lastDehydratedRoot = screen;
        this.emitTrace('screen_dehydrated', {
          screenName: screen.screenName,
          elementCount: screen.elements.length,
          elementsTextLength: screen.elementsText.length,
        }, step);

        logger.info('AgentRuntime', `Screen: ${screen.screenName}`);

        // 2. Apply transformScreenContent
        let screenContent = screen.elementsText;
        if (this.config.transformScreenContent) {
          screenContent = await this.config.transformScreenContent(screenContent);
        }

        // 3. Handle observations
        this.handleObservations(step, maxSteps, screenName);

        // 4. Assemble structured user prompt
        const contextMessage = this.assembleUserPrompt(
          step, maxSteps, contextualMessage, screenName, screenContent, chatHistory
        );

        // 4.5. Capture screenshot for Gemini vision (optional)
        const screenshot = await this.captureScreenshot();

        // 5. Send to AI provider
        this.config.onStatusUpdate?.('Thinking...');
        const hasKnowledge = !!this.knowledgeService;
        const isCopilot = this.config.interactionMode !== 'autopilot';
        const systemPrompt = buildSystemPrompt('en', hasKnowledge, isCopilot);
        const tools = this.buildToolsForProvider();

        logger.info('AgentRuntime', `Sending to AI with ${tools.length} tools...`);
        logger.debug('AgentRuntime', 'System prompt length:', systemPrompt.length);
        logger.debug('AgentRuntime', 'User context message:', contextMessage.substring(0, 300));

        const response = await this.provider.generateContent(
          systemPrompt,
          contextMessage,
          tools,
          this.history,
          screenshot,
        );
        this.emitTrace('provider_response', {
          text: response.text,
          toolCalls: response.toolCalls,
          tokenUsage: response.tokenUsage,
        }, step);

        logger.info(
          'AgentRuntime',
          `🤖 Provider response: textLength=${response.text?.length || 0} toolCalls=${response.toolCalls?.length || 0}`
        );
        if (response.toolCalls?.length) {
          response.toolCalls.forEach((toolCall, idx) => {
            logger.info('AgentRuntime', `🤖 Tool call[${idx}]: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          });
        } else if (response.text) {
          logger.info('AgentRuntime', `🤖 Provider text response: ${response.text}`);
        }

        // Accumulate token usage
        if (response.tokenUsage) {
          sessionUsage.promptTokens += response.tokenUsage.promptTokens;
          sessionUsage.completionTokens += response.tokenUsage.completionTokens;
          sessionUsage.totalTokens += response.tokenUsage.totalTokens;
          sessionUsage.estimatedCostUSD += response.tokenUsage.estimatedCostUSD;
          this.config.onTokenUsage?.(response.tokenUsage);
        }

        // ── Budget Guards ──────────────────────────────────────
        if (this.config.maxTokenBudget && sessionUsage.totalTokens >= this.config.maxTokenBudget) {
          logger.warn('AgentRuntime', `Token budget exceeded: ${sessionUsage.totalTokens} >= ${this.config.maxTokenBudget}`);
          this.emitTrace('task_stopped_budget', {
            budgetType: 'tokens',
            used: sessionUsage.totalTokens,
            limit: this.config.maxTokenBudget,
          }, step);
          const budgetResult: ExecutionResult = {
            success: false,
            message: `Task stopped: token budget exceeded (used ${sessionUsage.totalTokens.toLocaleString()} of ${this.config.maxTokenBudget.toLocaleString()} tokens)`,
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          await this.config.onAfterTask?.(budgetResult);
          return budgetResult;
        }
        if (this.config.maxCostUSD && sessionUsage.estimatedCostUSD >= this.config.maxCostUSD) {
          logger.warn('AgentRuntime', `Cost budget exceeded: $${sessionUsage.estimatedCostUSD.toFixed(4)} >= $${this.config.maxCostUSD}`);
          this.emitTrace('task_stopped_budget', {
            budgetType: 'cost_usd',
            used: sessionUsage.estimatedCostUSD,
            limit: this.config.maxCostUSD,
          }, step);
          const budgetResult: ExecutionResult = {
            success: false,
            message: `Task stopped: cost budget exceeded ($${sessionUsage.estimatedCostUSD.toFixed(4)} of $${this.config.maxCostUSD.toFixed(2)} max)`,
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          await this.config.onAfterTask?.(budgetResult);
          return budgetResult;
        }

        // 6. Process tool calls
        if (!response.toolCalls || response.toolCalls.length === 0) {
          logger.warn('AgentRuntime', 'No tool calls in response. Text:', response.text);
          this.emitTrace('task_completed_without_tool', {
            responseText: response.text,
          }, step);
          const result: ExecutionResult = {
            success: true,
            message: response.text || 'Task completed.',
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          await this.config.onAfterTask?.(result);
          return result;
        }

        // 7. Structured reasoning from provider (no regex parsing needed)
        const { reasoning } = response;
        logger.info('AgentRuntime', `🧠 Plan: ${reasoning.plan}`);
        if (reasoning.memory) {
          logger.debug('AgentRuntime', `💾 Memory: ${reasoning.memory}`);
        }

        // Only process the FIRST tool call per step (one action per step).
        // After one action, the loop re-reads the screen with fresh indexes.
        const toolCall = response.toolCalls[0]!;
        if (response.toolCalls.length > 1) {
          logger.warn('AgentRuntime', `AI returned ${response.toolCalls.length} tool calls, executing only the first one.`);
        }

        logger.info('AgentRuntime', `Tool: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
        this.emitTrace('tool_selected', {
          tool: toolCall.name,
          args: toolCall.args,
          reasoning,
        }, step);


        if (toolCall.name !== 'ask_user' && this.config.interactionMode !== 'autopilot') {
          logger.info('AgentRuntime', `🛡️ Tool "${toolCall.name}" chosen without prompt-level pause; relying on model plan-following and aiConfirm safeguards if present`);
        }

        // Dynamic status update based on tool being executed + Reasoning
        const statusLabel = this.getToolStatusLabel(toolCall.name, toolCall.args);
        // Prefer the human-readable plan over the raw tool status if available to avoid double statuses
        const statusDisplay = reasoning.plan || statusLabel;
        this.config.onStatusUpdate?.(statusDisplay);

        // Find and execute the tool
        const tool = this.tools.get(toolCall.name) ||
          this.buildToolsForProvider().find(t => t.name === toolCall.name);

        let output: string;
        if (tool) {
          output = await this.executeToolSafely(tool, toolCall.args, toolCall.name, step);
        } else {
          this.emitTrace('tool_unknown', {
            tool: toolCall.name,
            args: toolCall.args,
          }, step);
          output = `❌ Unknown tool: ${toolCall.name}`;
        }

        logger.info('AgentRuntime', `Result: ${output}`);
        this.emitTrace('tool_result', {
          tool: toolCall.name,
          args: toolCall.args,
          output,
        }, step);

        if (output === APPROVAL_ALREADY_DONE_TOKEN) {
          const result: ExecutionResult = {
            success: true,
            message: USER_ALREADY_COMPLETED_MESSAGE,
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          await this.config.onAfterTask?.(result);
          return result;
        }

        // Record step with structured reasoning
        const agentStep: AgentStep = {
          stepIndex: step,
          reflection: reasoning,
          action: {
            name: toolCall.name,
            input: toolCall.args,
            output,
          },
        };
        this.history.push(agentStep);

        // Lifecycle: onAfterStep
        await this.config.onAfterStep?.(this.history);

        // Check if done
        if (toolCall.name === 'done') {
          const result: ExecutionResult = {
            success: toolCall.args.success !== false,
            message: toolCall.args.text || toolCall.args.message || output || reasoning.plan || (toolCall.args.success === false ? 'Action stopped.' : 'Action completed.'),
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          logger.info('AgentRuntime', `Task completed: ${result.message}`);
          this.emitTrace('task_completed', {
            success: result.success,
            message: result.message,
            steps: this.history.length,
            tokenUsage: sessionUsage,
          }, step);
          await this.config.onAfterTask?.(result);
          return result;
        }

        // Check if asking user (legacy path — only breaks loop when onAskUser is NOT set)
        if (toolCall.name === 'ask_user' && !this.config.onAskUser) {
          let rawQuestion = toolCall.args.question || output || '';
          if (typeof rawQuestion === 'string') {
            rawQuestion = rawQuestion.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();
          }
          this.lastAskUserQuestion = rawQuestion;

          const result: ExecutionResult = {
            success: true,
            message: this.lastAskUserQuestion || '',
            steps: this.history,
            tokenUsage: sessionUsage,
          };
          this.emitTrace('task_paused_for_user', {
            question: this.lastAskUserQuestion || '',
          }, step);
          await this.config.onAfterTask?.(result);
          return result;
        }

        // Step delay
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }

      // Max steps reached
      const result: ExecutionResult = {
        success: false,
        message: `Reached maximum steps (${maxSteps}) without completing the task.`,
        steps: this.history,
        tokenUsage: sessionUsage,
      };

      // Dev warning: remind developers to add aiConfirm for extra safety
      if (__DEV__ && this.config.interactionMode !== 'autopilot') {
        logger.info('AgentRuntime',
          'ℹ️ Copilot mode active. Tip: Add aiConfirm={true} to critical buttons (e.g. "Place Order", "Delete") for extra safety.'
        );
      }

      this.emitTrace('task_failed_max_steps', {
        success: false,
        steps: this.history.length,
        message: result.message,
      });
      await this.config.onAfterTask?.(result);
      return result;
    } catch (error: any) {
      logger.error('AgentRuntime', 'Execution error:', error);
      this.emitTrace('task_failed_error', {
        error: error?.message ?? String(error),
        steps: this.history.length,
      });
      const result: ExecutionResult = {
        success: false,
        message: `Error: ${error.message}`,
        steps: this.history,
        tokenUsage: sessionUsage,
      };
      await this.config.onAfterTask?.(result);
      return result;
    } finally {
      this.isRunning = false;
      this.currentTraceId = null;
      if (this.config.interceptNativeAlerts) {
        uninstallAlertInterceptor();
      }
      // ── Grace period: keep error suppression for delayed side-effects ──
      // useEffect callbacks, PagerView onPageSelected, scrollToIndex, etc.
      // can fire AFTER execute() returns. Keep suppression active for 10s.
      this._stopErrorSuppression(10000);
    }
  }

  /** Update refs (called when component re-renders) */
  updateRefs(rootRef: any, navRef: any): void {
    this.rootRef = rootRef;
    this.navRef = navRef;
  }

  /** Check if agent is currently executing */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Cancel the currently running task.
   * The agent loop checks this flag at the start of each step,
   * so the current step will complete before the task stops.
   */
  cancel(): void {
    if (this.isRunning) {
      this.isCancelRequested = true;
      logger.info('AgentRuntime', 'Cancel requested — will stop after current step completes');
    }
  }
}

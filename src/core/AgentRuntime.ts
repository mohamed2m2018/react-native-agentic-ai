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
import { walkFiberTree, findScrollableContainers } from './FiberTreeWalker';
import type { WalkConfig } from './FiberTreeWalker';
import { dehydrateScreen } from './ScreenDehydrator';
import { buildSystemPrompt, buildKnowledgeOnlyPrompt } from './systemPrompt';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import type {
  AIProvider,
  AgentConfig,
  AgentStep,
  ExecutionResult,
  ToolDefinition,
  ActionDefinition,
  TokenUsage,
} from './types';

const DEFAULT_MAX_STEPS = 25;

// ─── Agent Runtime ─────────────────────────────────────────────

export class AgentRuntime {
  private provider: AIProvider;
  private config: AgentConfig;
  private rootRef: any;
  private navRef: any;
  private tools: Map<string, ToolDefinition> = new Map();
  private actions: Map<string, ActionDefinition> = new Map();
  private history: AgentStep[] = [];
  private isRunning = false;
  private lastAskUserQuestion: string | null = null;
  private knowledgeService: KnowledgeBaseService | null = null;
  private uiControlOverride?: boolean;

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
    // tap — universal interaction (mirrors RNTL's dispatchEvent pattern)
    this.tools.set('tap', {
      name: 'tap',
      description: 'Tap an interactive element by its index. Works universally on buttons, switches, and custom components.',
      parameters: {
        index: { type: 'number', description: 'The index of the element to tap', required: true },
      },
      execute: async (args) => {
        const { interactives: elements } = walkFiberTree(this.rootRef, this.getWalkConfig());
        const element = elements.find(el => el.index === args.index);
        if (!element) {
          return `❌ Element with index ${args.index} not found. Available indexes: ${elements.map(e => e.index).join(', ')}`;
        }

        // Strategy 1: Switch — call onValueChange (like RNTL's fireEvent('valueChange'))
        if (element.type === 'switch' && element.props.onValueChange) {
          try {
            element.props.onValueChange(!element.props.value);
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Toggled [${args.index}] "${element.label}" to ${!element.props.value}`;
          } catch (error: any) {
            return `❌ Error toggling [${args.index}]: ${error.message}`;
          }
        }

        // Strategy 2: Direct onPress (covers Pressable, Button, custom components)
        if (element.props.onPress) {
          try {
            element.props.onPress();
            await new Promise(resolve => setTimeout(resolve, 500));
            return `✅ Tapped [${args.index}] "${element.label}"`;
          } catch (error: any) {
            return `❌ Error tapping [${args.index}]: ${error.message}`;
          }
        }

        // Strategy 3: Bubble up Fiber tree (like RNTL's findEventHandler → element.parent)
        let fiber = element.fiberNode?.return;
        let bubbleDepth = 0;
        while (fiber && bubbleDepth < 5) {
          const parentProps = fiber.memoizedProps || {};
          if (parentProps.onPress && typeof parentProps.onPress === 'function') {
            try {
              parentProps.onPress();
              await new Promise(resolve => setTimeout(resolve, 500));
              return `✅ Tapped parent of [${args.index}] "${element.label}"`;
            } catch (error: any) {
              return `❌ Error tapping parent of [${args.index}]: ${error.message}`;
            }
          }
          fiber = fiber.return;
          bubbleDepth++;
        }

        return `❌ Element [${args.index}] "${element.label}" has no tap handler (no onPress or onValueChange found).`;
      },
    });

    // type — type text into a TextInput
    this.tools.set('type', {
      name: 'type',
      description: 'Type text into a text-input element by its index.',
      parameters: {
        index: { type: 'number', description: 'The index of the text-input element', required: true },
        text: { type: 'string', description: 'The text to type', required: true },
      },
      execute: async (args) => {
        const { interactives: elements } = walkFiberTree(this.rootRef, this.getWalkConfig());
        const element = elements.find(el => el.index === args.index);
        if (!element) {
          return `❌ Element with index ${args.index} not found.`;
        }
        if (!element.props.onChangeText) {
          return `❌ Element [${args.index}] "${element.label}" is not a text input.`;
        }
        try {
          element.props.onChangeText(args.text);
          // Wait for React to process the state update and re-render
          // (same pattern as navigate tool's 500ms post-action delay)
          await new Promise(resolve => setTimeout(resolve, 500));
          return `✅ Typed "${args.text}" into [${args.index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error typing: ${error.message}`;
        }
      },
    });

    // navigate — navigate to a screen (supports React Navigation + Expo Router)
    this.tools.set('navigate', {
      name: 'navigate',
      description: 'Navigate to a specific screen in the app.',
      parameters: {
        screen: { type: 'string', description: 'Screen name or path to navigate to', required: true },
        params: { type: 'string', description: 'Optional JSON params object', required: false },
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
        success: { type: 'boolean', description: 'Whether the task was completed successfully', required: true },
      },
      execute: async (args) => {
        return args.text;
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
      description: 'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
      parameters: {
        question: { type: 'string', description: 'Question to ask the user', required: true },
      },
      execute: async (args) => {
        if (this.config.onAskUser) {
          // Block until user responds, then continue the loop
          this.config.onStatusUpdate?.('Waiting for your answer...');
          const answer = await this.config.onAskUser(args.question);
          return `User answered: ${answer}`;
        }
        // Legacy fallback: break the loop (context will be lost)
        return `❓ ${args.question}`;
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

    // scroll — programmatic scroll for lazy-loaded lists and long screens
    this.tools.set('scroll', {
      name: 'scroll',
      description: 'Scroll the current screen to reveal more content. Use when you need to see items that are not yet visible, e.g. in lazy-loaded lists, long forms, or paginated content. If the screen has multiple scrollable areas, specify containerIndex to target a specific one.',
      parameters: {
        direction: {
          type: 'string',
          description: "Scroll direction: 'down' or 'up'",
          required: true,
          enum: ['down', 'up'],
        },
        amount: {
          type: 'string',
          description: "How far to scroll: 'page' (default, ~one screenful), 'toEnd' (jump to bottom), or 'toStart' (jump to top)",
          required: false,
          enum: ['page', 'toEnd', 'toStart'],
        },
        containerIndex: {
          type: 'number',
          description: 'Index of the scrollable container to scroll (0-based). Use when the screen has multiple scrollable areas. Default: 0 (the main/first scrollable area).',
          required: false,
        },
      },
      execute: async (args) => {
        const screenName = this.getCurrentScreenName();
        const containers = findScrollableContainers(this.rootRef, screenName);

        if (containers.length === 0) {
          return `❌ No scrollable container found on screen "${screenName}". Content may still be loading — wait and try again.`;
        }

        const targetIndex = args.containerIndex ?? 0;
        const container = containers[targetIndex];
        if (!container) {
          const available = containers.map(c => `[${c.index}] ${c.label} (${c.componentName})`).join(', ');
          return `❌ Container index ${targetIndex} not found. Available on "${screenName}": ${available}`;
        }

        const direction: string = args.direction || 'down';
        const amount: string = args.amount || 'page';
        const scrollRef = container.stateNode;

        try {
          if (amount === 'toEnd') {
            if (typeof scrollRef.scrollToEnd === 'function') {
              scrollRef.scrollToEnd({ animated: true });
            } else if (typeof scrollRef.scrollTo === 'function') {
              scrollRef.scrollTo({ y: 999999, animated: true });
            }
          } else if (amount === 'toStart') {
            if (typeof scrollRef.scrollTo === 'function') {
              scrollRef.scrollTo({ y: 0, animated: true });
            } else if (typeof scrollRef.scrollToOffset === 'function') {
              scrollRef.scrollToOffset({ offset: 0, animated: true });
            }
          } else {
            // Page scroll — move ~800px (roughly one screen height)
            const PAGE_OFFSET = 800;

            if (typeof scrollRef.scrollToOffset === 'function') {
              // VirtualizedList — scrollToOffset is absolute
              scrollRef.scrollToOffset({
                offset: direction === 'down' ? PAGE_OFFSET : 0,
                animated: true,
              });
            } else if (typeof scrollRef.scrollTo === 'function') {
              scrollRef.scrollTo({
                y: direction === 'down' ? PAGE_OFFSET : 0,
                animated: true,
              });
            }
          }

          // Wait for scroll animation + onEndReached + lazy load + re-render
          await new Promise(resolve => setTimeout(resolve, 1500));

          const amountLabel = amount === 'toEnd' ? 'to end' : amount === 'toStart' ? 'to start' : `${direction} one page`;
          return `✅ Scrolled ${amountLabel} in ${container.label} (${container.componentName}). Check the updated screen content for newly loaded items.`;
        } catch (error: any) {
          return `❌ Scroll failed: ${error.message}`;
        }
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

  // ─── Action Registration (useAction hook) ──────────────────

  registerAction(action: ActionDefinition): void {
    this.actions.set(action.name, action);
    logger.info('AgentRuntime', `Registered action: ${action.name}`);
  }

  unregisterAction(name: string): void {
    this.actions.delete(name);
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
        return `Tapping element ${args.index ?? ''}...`;
      case 'type':
        return `Typing into field...`;
      case 'navigate':
        return `Navigating to ${args.screen || 'screen'}...`;
      case 'done':
        return 'Wrapping up...';
      case 'ask_user':
        return 'Asking you a question...';
      case 'query_knowledge':
        return 'Searching knowledge base...';
      case 'scroll':
        return `Scrolling ${args.direction || 'down'}...`;
      case 'wait':
        return `Waiting for ${args.seconds || 2} seconds...`;
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
      // Use variable to prevent Metro from statically resolving this optional dep.
      // A bare `require('react-native-view-shot')` is traced at bundle time
      // and crashes with "unknown module" when the package isn't installed.
      const moduleName = ['react-native', 'view-shot'].join('-');
      const viewShot = require(moduleName);
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
    for (const action of this.actions.values()) {
      allTools.push({
        name: action.name,
        description: action.description,
        parameters: Object.fromEntries(
          Object.entries(action.parameters).map(([key, typeStr]) => [
            key,
            { type: typeStr as any, description: key, required: true },
          ]),
        ),
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
   * Execute a tool with global error safety.
   * Overrides ErrorUtils.setGlobalHandler during execution to catch
   * ALL errors (JS, native-to-JS, Fabric JSI) and prevent app crashes.
   * This is the same pattern used by Sentry/Bugsnag crash SDKs.
   */
  private async executeToolSafely(
    tool: { execute: (args: any) => Promise<string> },
    args: any,
    toolName: string
  ): Promise<string> {
    // Get the global ErrorUtils (available in all RN architectures)
    const ErrorUtils = (global as any).ErrorUtils;
    const originalHandler = ErrorUtils?.getGlobalHandler?.();
    const errorRef: { error: Error | null } = { error: null };

    // Install safety handler — catch errors instead of crashing
    if (ErrorUtils?.setGlobalHandler) {
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        errorRef.error = error;
        logger.warn(
          'AgentRuntime',
          `🛡️ Caught ${isFatal ? 'FATAL' : 'non-fatal'} error during "${toolName}": ${error.message}`
        );
        // Don't re-throw — suppress the crash
      });
    }

    try {
      const result = await tool.execute(args);
      // Brief settle window for async side-effects (useEffect, native callbacks)
      await new Promise(resolve => setTimeout(resolve, 100));

      if (errorRef.error) {
        logger.warn('AgentRuntime', `🛡️ Tool "${toolName}" succeeded but caused a side-effect error: ${errorRef.error.message}`);
        return `${result} (⚠️ a background error was safely caught: ${errorRef.error.message})`;
      }
      return result;
    } catch (error: any) {
      logger.error('AgentRuntime', `Tool "${toolName}" threw: ${error.message}`);
      return `❌ Tool "${toolName}" failed: ${error.message}`;
    } finally {
      // Restore original handler
      if (ErrorUtils?.setGlobalHandler && originalHandler) {
        ErrorUtils.setGlobalHandler(originalHandler);
      }
    }
  }

  // ─── Walk Config (passes security settings to FiberTreeWalker) ─

  private getWalkConfig(): WalkConfig {
    return {
      interactiveBlacklist: this.config.interactiveBlacklist,
      interactiveWhitelist: this.config.interactiveWhitelist,
      screenName: this.getCurrentScreenName(),
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

    let stepIndex = 0;
    for (const event of this.history) {
      stepIndex++;
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
    this.history = [];
    this.observations = [];
    this.lastScreenName = '';
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
        logger.info('AgentRuntime', `===== Step ${step + 1}/${maxSteps} =====`);

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

        logger.info('AgentRuntime', `Screen: ${screen.screenName}`);
        logger.debug('AgentRuntime', `Dehydrated:\n${screen.elementsText}`);

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
        this.config.onStatusUpdate?.('Analyzing screen...');
        const hasKnowledge = !!this.knowledgeService;
        const systemPrompt = buildSystemPrompt('en', hasKnowledge);
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

        // Accumulate token usage
        if (response.tokenUsage) {
          sessionUsage.promptTokens += response.tokenUsage.promptTokens;
          sessionUsage.completionTokens += response.tokenUsage.completionTokens;
          sessionUsage.totalTokens += response.tokenUsage.totalTokens;
          sessionUsage.estimatedCostUSD += response.tokenUsage.estimatedCostUSD;
          this.config.onTokenUsage?.(response.tokenUsage);
        }

        // 6. Process tool calls
        if (!response.toolCalls || response.toolCalls.length === 0) {
          logger.warn('AgentRuntime', 'No tool calls in response. Text:', response.text);
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

        // Dynamic status update based on tool being executed + Reasoning
        const statusLabel = this.getToolStatusLabel(toolCall.name, toolCall.args);
        // Prefer the human-readable plan over the raw tool status if available to avoid double statuses
        const statusDisplay = reasoning.plan ? `🤔 ${reasoning.plan}` : `👆 ${statusLabel}`;
        this.config.onStatusUpdate?.(statusDisplay);

        // Find and execute the tool
        const tool = this.tools.get(toolCall.name) ||
          this.buildToolsForProvider().find(t => t.name === toolCall.name);

        let output: string;
        if (tool) {
          output = await this.executeToolSafely(tool, toolCall.args, toolCall.name);
        } else {
          output = `❌ Unknown tool: ${toolCall.name}`;
        }

        logger.info('AgentRuntime', `Result: ${output}`);

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
            message: toolCall.args.text || output,
            steps: this.history,
          };
          logger.info('AgentRuntime', `Task completed: ${result.message}`);
          await this.config.onAfterTask?.(result);
          return result;
        }

        // Check if asking user (legacy path — only breaks loop when onAskUser is NOT set)
        if (toolCall.name === 'ask_user' && !this.config.onAskUser) {
          this.lastAskUserQuestion = toolCall.args.question || output;

          const result: ExecutionResult = {
            success: true,
            message: output,
            steps: this.history,
          };
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
      await this.config.onAfterTask?.(result);
      return result;
    } catch (error: any) {
      logger.error('AgentRuntime', 'Execution error:', error);
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
}

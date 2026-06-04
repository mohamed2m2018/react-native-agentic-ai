/**
 * Scroll Tool — Direction-based scrolling with safety checks.
 *
 * Patterns implemented:
 * - Detox: ScrollHelper.perform(direction, amountInDP) — relative scroll
 * - Detox: scrollableProbe.atScrollingEdge() — pre-scroll edge detection
 * - Detox: ScrollToIndexAction.getConstraints() — PagerView rejection
 * - Appium: mobileScrollGesture returns boolean (canScrollMore)
 * - Maestro: hierarchy diff post-scroll (no-op detection)
 */

import { findScrollableContainers } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

export function createScrollTool(context: ToolContext): AgentTool {
  return {
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
      const screenName = context.getCurrentScreenName();
      const containers = findScrollableContainers(context.getRootRef(), screenName);

      if (containers.length === 0) {
        return `❌ No scrollable container found on screen "${screenName}". Content may still be loading — wait and try again.`;
      }

      const targetIndex = args.containerIndex ?? 0;
      const container = containers[targetIndex];
      if (!container) {
        const available = containers
          .filter(c => !c.isPagerLike)
          .map(c => `[${c.index}] ${c.label} (${c.componentName})`)
          .join(', ');
        return `❌ Container index ${targetIndex} not found. Available scrollable containers on "${screenName}": ${available}`;
      }

      // PagerView/TabView Rejection (Detox: getConstraints() rejects ViewPager)
      if (container.isPagerLike) {
        const scrollableAlts = containers
          .filter(c => !c.isPagerLike)
          .map(c => `[${c.index}] ${c.label} (${c.componentName})`)
          .join(', ');
        const suggestion = scrollableAlts
          ? `Try scrolling a content container instead: ${scrollableAlts}`
          : 'Use tap on the tab labels to switch tabs instead of scrolling.';
        return `⚠️ Container [${targetIndex}] "${container.label}" is a ${container.componentName} (tab/page container). ` +
          `Scrolling pager containers directly causes native crashes. ${suggestion}`;
      }

      const direction: string = args.direction || 'down';
      const amount: string = args.amount || 'page';
      const scrollRef = container.stateNode;

      // Edge Detection (Detox: scrollableProbe.atScrollingEdge())
      if (amount === 'page' && typeof scrollRef.scrollToOffset === 'function') {
        const metrics = scrollRef._scrollMetrics;
        if (metrics) {
          const { offset, contentLength, visibleLength } = metrics;
          const isAtBottom = offset + visibleLength >= contentLength - 2;
          const isAtTop = offset <= 0;

          if (direction === 'down' && isAtBottom) {
            return `⚠️ Already at the bottom of ${container.label} (${container.componentName}). No more content to scroll to. All items are visible.`;
          }
          if (direction === 'up' && isAtTop) {
            return `⚠️ Already at the top of ${container.label} (${container.componentName}). Cannot scroll further up.`;
          }
        }
      }

      // Track position for no-op detection (Maestro: hierarchy diff)
      const offsetBefore = typeof scrollRef.scrollToOffset === 'function'
        ? scrollRef._scrollMetrics?.offset ?? 0
        : 0;

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
          // Direction-based relative scroll (Detox: ScrollHelper, Appium: percent)
          const FALLBACK_PAGE_HEIGHT = 800;

          if (typeof scrollRef.scrollToOffset === 'function') {
            const metrics = scrollRef._scrollMetrics;
            const currentOffset = metrics?.offset ?? 0;
            const visibleLength = metrics?.visibleLength ?? FALLBACK_PAGE_HEIGHT;
            const scrollAmount = Math.round(visibleLength * 0.8);

            const newOffset = direction === 'down'
              ? currentOffset + scrollAmount
              : Math.max(0, currentOffset - scrollAmount);

            scrollRef.scrollToOffset({ offset: newOffset, animated: true });
          } else if (typeof scrollRef.scrollTo === 'function') {
            const currentY = scrollRef._nativeRef?.contentOffset?.y ?? 0;
            const scrollAmount = FALLBACK_PAGE_HEIGHT;

            scrollRef.scrollTo({
              y: direction === 'down'
                ? currentY + scrollAmount
                : Math.max(0, currentY - scrollAmount),
              animated: true,
            });
          }
        }

        // Wait for scroll animation + onEndReached + lazy load
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Post-scroll no-op detection
        const offsetAfter = typeof scrollRef.scrollToOffset === 'function'
          ? scrollRef._scrollMetrics?.offset ?? 0
          : -1;

        if (offsetAfter >= 0 && Math.abs(offsetAfter - offsetBefore) < 2) {
          const edge = direction === 'down' ? 'bottom' : 'top';
          return `⚠️ Scroll had no effect — already at the ${edge} of ${container.label}. All visible content has been loaded.`;
        }

        const amountLabel = amount === 'toEnd' ? 'to end' : amount === 'toStart' ? 'to start' : `${direction} one page`;
        return `✅ Scrolled ${amountLabel} in ${container.label} (${container.componentName}). Check the updated screen content for newly loaded items.`;
      } catch (error: any) {
        return `❌ Scroll failed: ${error.message}`;
      }
    },
  };
}

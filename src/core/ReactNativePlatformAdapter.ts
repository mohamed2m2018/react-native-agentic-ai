import React from 'react';
import { DeviceEventEmitter, Keyboard, NativeModules } from 'react-native';
import { dehydrateScreen } from './ScreenDehydrator';
import { walkFiberTree, findScrollableContainers } from './FiberTreeWalker';
import type { WalkConfig } from './FiberTreeWalker';
import { getChild, getSibling, getProps, getStateNode, getParent } from './FiberAdapter';
import { dismissAlert } from './NativeAlertInterceptor';
import { globalBlockRegistry } from './BlockRegistry';
import { globalZoneRegistry } from './ZoneRegistry';
import { logger } from '../utils/logger';
import type {
  ActionIntent,
  AIRichBlockLifecycle,
  BlockDefinition,
  InteractiveElement,
  NavigationSnapshot,
  PlatformAdapter,
  ScreenSnapshot,
} from './types';

function isScalarSelectionValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function getRadioSelectionPayload(props: Record<string, any>): string | number | boolean {
  return isScalarSelectionValue(props.value) ? props.value : true;
}

function getRadioSelectionHandler(props: Record<string, any>): { channel: string; handler: Function } | null {
  if (typeof props.onValueChange === 'function') {
    return { channel: 'onValueChange', handler: props.onValueChange as Function };
  }
  if (typeof props.onCheckedChange === 'function') {
    return { channel: 'onCheckedChange', handler: props.onCheckedChange as Function };
  }
  if (typeof props.onChange === 'function') {
    return { channel: 'onChange', handler: props.onChange as Function };
  }
  if (typeof props.onSelect === 'function') {
    return { channel: 'onSelect', handler: props.onSelect as Function };
  }
  return null;
}

function findFiberNode(rootFiber: any, predicate: (node: any) => boolean, maxDepth = 10): any | null {
  const firstChild = getChild(rootFiber);
  if (!firstChild) return null;
  const queue: { node: any; depth: number }[] = [{ node: firstChild, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!current.node || current.depth > maxDepth) continue;
    if (predicate(current.node)) return current.node;
    const child = getChild(current.node);
    if (child) queue.push({ node: child, depth: current.depth + 1 });
    const sibling = getSibling(current.node);
    if (sibling) queue.push({ node: sibling, depth: current.depth + 1 });
  }
  return null;
}

function extractPickerOptions(element: any): Array<{ label: string; value: any }> {
  const props = element.props || {};
  const options: Array<{ label: string; value: any }> = [];

  if (Array.isArray(props.items)) {
    for (const item of props.items) {
      if (item && item.label !== undefined) {
        options.push({ label: String(item.label), value: item.value });
      }
    }
    return options;
  }

  if (Array.isArray(props.options)) {
    for (const item of props.options) {
      if (typeof item === 'string') {
        options.push({ label: item, value: item });
      } else if (item && item.label !== undefined) {
        options.push({ label: String(item.label), value: item.value });
      }
    }
    return options;
  }

  const fiberNode = element.fiberNode;
  const firstChild = getChild(fiberNode);
  if (firstChild) {
    let child = firstChild;
    while (child) {
      const childProps = getProps(child);
      if (childProps.label !== undefined && childProps.value !== undefined) {
        options.push({ label: String(childProps.label), value: childProps.value });
      }
      child = getSibling(child);
    }
  }

  return options;
}

function sanitizePropValue(value: unknown): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePropValue(item)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, sanitizePropValue(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }
  return undefined;
}

function parsePropsArg(rawProps: unknown): Record<string, unknown> {
  if (rawProps == null || rawProps === '') return {};
  const parsed = typeof rawProps === 'string' ? JSON.parse(rawProps) : rawProps;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('props must be a JSON object');
  }
  return sanitizePropValue(parsed) as Record<string, unknown>;
}

function getAllowedZoneBlocks(zone: any): BlockDefinition[] {
  const explicitBlocks = Array.isArray(zone.blocks) ? zone.blocks : [];
  if (explicitBlocks.length > 0) {
    return explicitBlocks;
  }

  const legacyTemplates = Array.isArray(zone.templates) ? zone.templates : [];
  return legacyTemplates
    .map((template: React.ComponentType<any>) => {
      const name = template.displayName || template.name;
      if (!name) return null;
      return globalBlockRegistry.get(name) || {
        name,
        component: template,
        allowedPlacements: ['chat', 'zone'] as const,
        interventionEligible: true,
        interventionType: 'contextual_help' as const,
      };
    })
    .filter((definition: BlockDefinition | null): definition is BlockDefinition => !!definition);
}

interface ReactNativePlatformAdapterOptions {
  getRootRef: () => any;
  getWalkConfig: () => WalkConfig;
  navRef?: any;
  router?: {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
  };
  pathname?: string;
  getCurrentScreenName?: () => string;
}

export class ReactNativePlatformAdapter implements PlatformAdapter {
  private lastSnapshot: ScreenSnapshot | null = null;

  constructor(private options: ReactNativePlatformAdapterOptions) {}

  getLastScreenSnapshot(): ScreenSnapshot | null {
    return this.lastSnapshot;
  }

  getNavigationSnapshot(): NavigationSnapshot {
    return {
      currentScreenName: this.getCurrentScreenName(),
      availableScreens: this.getRouteNames(),
    };
  }

  getScreenSnapshot(): ScreenSnapshot {
    const walkResult = walkFiberTree(this.options.getRootRef(), this.options.getWalkConfig());
    const navigation = this.getNavigationSnapshot();
    const dehydrated = dehydrateScreen({
      screenName: navigation.currentScreenName,
      availableScreens: navigation.availableScreens,
      elementsText: walkResult.elementsText,
      elements: walkResult.interactives,
    });

    const snapshot: ScreenSnapshot = {
      screenName: dehydrated.screenName,
      availableScreens: dehydrated.availableScreens,
      elementsText: dehydrated.elementsText,
      elements: dehydrated.elements,
    };
    this.lastSnapshot = snapshot;
    return snapshot;
  }

  async captureScreenshot(): Promise<string | undefined> {
    try {
      if (!(NativeModules as any)?.RNViewShot) {
        logger.debug(
          'ReactNativePlatformAdapter',
          'Screenshot skipped: RNViewShot native module is unavailable'
        );
        return undefined;
      }

      const viewShot = require('react-native-view-shot');
      const captureRef = viewShot.captureRef || viewShot.default?.captureRef;
      const rootRef = this.options.getRootRef();
      if (!captureRef || !rootRef) return undefined;

      const uri = await captureRef(rootRef, {
        format: 'jpg',
        quality: 0.4,
        width: 720,
        result: 'base64',
      });

      logger.info('ReactNativePlatformAdapter', `Screenshot captured (${Math.round((uri?.length || 0) / 1024)}KB base64)`);
      return uri || undefined;
    } catch (error: any) {
      if (
        error.message?.includes('Cannot find module')
        || error.code === 'MODULE_NOT_FOUND'
        || error.message?.includes('unknown module')
      ) {
        logger.warn(
          'ReactNativePlatformAdapter',
          'Screenshot requires react-native-view-shot. Install it in the host app with: npx expo install react-native-view-shot'
        );
      } else {
        logger.debug('ReactNativePlatformAdapter', `Screenshot skipped: ${error.message}`);
      }
      return undefined;
    }
  }

  async executeAction(intent: ActionIntent): Promise<string> {
    switch (intent.type) {
      case 'tap':
        return this.tap(intent.index);
      case 'long_press':
        return this.longPress(intent.index);
      case 'type':
        return this.typeText(intent.index, intent.text);
      case 'scroll':
        return this.scroll(intent.direction, intent.amount, intent.containerIndex);
      case 'adjust_slider':
        return this.adjustSlider(intent.index, intent.value);
      case 'select_picker':
        return this.selectPicker(intent.index, intent.value);
      case 'set_date':
        return this.setDate(intent.index, intent.date);
      case 'dismiss_keyboard':
        return this.dismissKeyboard();
      case 'guide_user':
        return this.guideUser(intent.index, intent.message, intent.autoRemoveAfterMs);
      case 'simplify_zone':
        return this.simplifyZone(intent.zoneId);
      case 'render_block':
        return this.renderBlock(intent.zoneId, intent.blockType, intent.props, intent.lifecycle);
      case 'inject_card':
        return this.injectCard(intent.zoneId, intent.templateName, intent.props);
      case 'restore_zone':
        return this.restoreZone(intent.zoneId);
      case 'navigate':
        return this.navigate(intent.screen, intent.params);
      default:
        return '❌ Unsupported action intent.';
    }
  }

  private getCurrentScreenName(): string {
    if (this.options.getCurrentScreenName) {
      return this.options.getCurrentScreenName();
    }

    if (this.options.pathname) {
      return this.options.pathname === '/' ? 'index' : this.options.pathname;
    }

    const routeName = this.options.navRef?.getCurrentRoute?.()?.name;
    if (typeof routeName === 'string' && routeName.trim().length > 0) {
      return routeName;
    }

    return 'unknown';
  }

  private getRouteNames(): string[] {
    try {
      const navRef = this.options.navRef;
      if (!navRef?.isReady?.()) return [];
      const state = navRef?.getRootState?.() || navRef?.getState?.();
      if (!state) return [];
      const names = this.collectRouteNames(state);
      logger.debug('ReactNativePlatformAdapter', 'Available routes:', names.join(', '));
      return names;
    } catch {
      return [];
    }
  }

  private collectRouteNames(state: any): string[] {
    const names: string[] = [];
    if (state?.routeNames) {
      names.push(...state.routeNames);
    }
    if (state?.routes) {
      for (const route of state.routes) {
        names.push(route.name);
        if (route.state) {
          names.push(...this.collectRouteNames(route.state));
        }
      }
    }
    return [...new Set(names)];
  }

  private findScreenPath(targetScreen: string): string[] {
    try {
      const state = this.options.navRef?.getRootState?.() || this.options.navRef?.getState?.();
      if (!state?.routes) return [targetScreen];

      if (state.routes.some((r: any) => r.name === targetScreen)) {
        return [targetScreen];
      }

      for (const route of state.routes) {
        const nestedNames = route.state ? this.collectRouteNames(route.state) : [];
        if (nestedNames.includes(targetScreen)) {
          return [route.name, targetScreen];
        }
      }
      return [targetScreen];
    } catch {
      return [targetScreen];
    }
  }

  private buildNestedParams(path: string[], leafParams?: any): any {
    if (path.length === 1) return leafParams;
    let params = leafParams;
    for (let i = path.length - 1; i > 0; i--) {
      params = { screen: path[i], params };
    }
    return params;
  }

  private getInteractiveElements(): InteractiveElement[] {
    const snapshot = this.getScreenSnapshot();
    return snapshot.elements;
  }

  private findInteractiveElement(index: number): InteractiveElement | undefined {
    return this.getInteractiveElements().find((element) => element.index === index);
  }

  private async tap(index: number): Promise<string> {
    const elements = this.getInteractiveElements();
    const element = elements.find((el) => el.index === index);
    if (!element) {
      return `❌ Element with index ${index} not found. Available indexes: ${elements.map((e) => e.index).join(', ')}`;
    }

    const elementCountBefore = elements.length;
    const screenBefore = this.getCurrentScreenName();

    if (element.virtual?.kind === 'alert_button') {
      dismissAlert(element.virtual.alertButtonIndex);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `✅ Tapped native alert button [${index}] "${element.label}" → dialog dismissed`;
    }

    if (element.type === 'switch' && element.props.onValueChange) {
      try {
        element.props.onValueChange(!element.props.value);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return `✅ Toggled [${index}] "${element.label}" to ${!element.props.value}`;
      } catch (error: any) {
        return `❌ Error toggling [${index}]: ${error.message}`;
      }
    }

    if (element.type === 'radio') {
      const radioPayload = getRadioSelectionPayload(element.props);
      const ownSelectionHandler = getRadioSelectionHandler(element.props);

      if (element.props.onPress) {
        try {
          element.props.onPress();
          await new Promise((resolve) => setTimeout(resolve, 500));
          return `✅ Selected [${index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error selecting [${index}]: ${error.message}`;
        }
      }

      if (ownSelectionHandler) {
        try {
          ownSelectionHandler.handler(radioPayload);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return `✅ Selected [${index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error selecting [${index}]: ${error.message}`;
        }
      }
    }

    if (element.props.onPress) {
      try {
        element.props.onPress();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const postElements = this.getInteractiveElements();
        const screenAfter = this.getCurrentScreenName();
        const elementCountAfter = postElements.length;

        if (screenAfter !== screenBefore) {
          return `✅ Tapped [${index}] "${element.label}" → navigated to "${screenAfter}"`;
        }
        if (Math.abs(elementCountAfter - elementCountBefore) > 0) {
          return `✅ Tapped [${index}] "${element.label}" → screen updated (${elementCountBefore} → ${elementCountAfter} elements)`;
        }
        return `✅ Tapped [${index}] "${element.label}" → action executed successfully. Proceed to your next step.`;
      } catch (error: any) {
        return `❌ Error tapping [${index}]: ${error.message}`;
      }
    }

    let fiber = getParent(element.fiberNode);
    let bubbleDepth = 0;
    const radioPayload = element.type === 'radio' ? getRadioSelectionPayload(element.props) : undefined;
    while (fiber && bubbleDepth < 5) {
      const parentProps = getProps(fiber);
      if (parentProps.onPress && typeof parentProps.onPress === 'function') {
        try {
          parentProps.onPress();
          await new Promise((resolve) => setTimeout(resolve, 500));
          return `✅ Tapped parent of [${index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error tapping parent of [${index}]: ${error.message}`;
        }
      }
      if (element.type === 'radio') {
        const parentSelectionHandler = getRadioSelectionHandler(parentProps);
        if (parentSelectionHandler) {
          try {
            parentSelectionHandler.handler(radioPayload);
            await new Promise((resolve) => setTimeout(resolve, 500));
            return `✅ Selected [${index}] "${element.label}" via parent group`;
          } catch (error: any) {
            return `❌ Error selecting [${index}] via parent group: ${error.message}`;
          }
        }
      }
      fiber = getParent(fiber);
      bubbleDepth++;
    }

    return `❌ Element [${index}] "${element.label}" has no tap handler (no onPress, onValueChange, or radio selection handler found).`;
  }

  private async longPress(index: number): Promise<string> {
    const elements = this.getInteractiveElements();
    const element = elements.find((el) => el.index === index);
    if (!element) {
      return `❌ Element with index ${index} not found. Available indexes: ${elements.map((e) => e.index).join(', ')}`;
    }

    if (element.props.onLongPress && typeof element.props.onLongPress === 'function') {
      try {
        element.props.onLongPress();
        await new Promise((resolve) => setTimeout(resolve, 500));
        return `✅ Long-pressed [${index}] "${element.label}"`;
      } catch (error: any) {
        return `❌ Error long-pressing [${index}]: ${error.message}`;
      }
    }

    let fiber = getParent(element.fiberNode);
    let bubbleDepth = 0;
    while (fiber && bubbleDepth < 5) {
      const parentProps = getProps(fiber);
      if (parentProps.onLongPress && typeof parentProps.onLongPress === 'function') {
        try {
          parentProps.onLongPress();
          await new Promise((resolve) => setTimeout(resolve, 500));
          return `✅ Long-pressed parent of [${index}] "${element.label}"`;
        } catch (error: any) {
          return `❌ Error long-pressing parent of [${index}]: ${error.message}`;
        }
      }
      fiber = getParent(fiber);
      bubbleDepth++;
    }

    return `❌ Element [${index}] "${element.label}" has no long-press handler. Try using tap instead.`;
  }

  private async typeText(index: number, text: string): Promise<string> {
    const elements = this.getInteractiveElements();
    const element = elements.find((el) => el.index === index);
    if (!element) {
      return `❌ Element with index ${index} not found.`;
    }

    const props = element.props;
    const label = element.label || `[${element.type}]`;
    const fiberNode = element.fiberNode;

    if (typeof props.onChangeText === 'function') {
      try {
        props.onChangeText(text);
        await new Promise((resolve) => setTimeout(resolve, 300));
        return `✅ Typed "${text}" into [${index}] "${label}"`;
      } catch (err: any) {
        return `❌ onChangeText failed: ${err.message}`;
      }
    }

    if (fiberNode) {
      const innerTextInputFiber = findFiberNode(
        fiberNode,
        (node) => typeof getProps(node)?.onChangeText === 'function',
        15
      );
      if (innerTextInputFiber) {
        const innerProps = getProps(innerTextInputFiber);
        try {
          innerProps.onChangeText(text);
          await new Promise((resolve) => setTimeout(resolve, 300));
          return `✅ Typed "${text}" into wrapped component [${index}] "${label}"`;
        } catch {}
      }
    }

    if (fiberNode) {
      const fiberProps = getProps(fiberNode);
      const nativeOnChangeFiber = fiberProps?.onChange
        ? fiberNode
        : findFiberNode(fiberNode, (node) => typeof getProps(node)?.onChange === 'function');

      const fiberStateNode = getStateNode(fiberNode);
      const nativeStateFiber = fiberStateNode?.setNativeProps
        ? fiberNode
        : findFiberNode(fiberNode, (node) => {
            const stateNode = getStateNode(node);
            return stateNode && typeof stateNode.setNativeProps === 'function';
          });

      const onChange = getProps(nativeOnChangeFiber)?.onChange;
      const nativeInstance = getStateNode(nativeStateFiber);

      if (onChange || nativeInstance) {
        try {
          let visualUpdated = false;
          if (nativeInstance && typeof nativeInstance.setNativeProps === 'function') {
            nativeInstance.setNativeProps({ text });
            visualUpdated = true;
          }

          if (typeof onChange === 'function') {
            onChange({
              nativeEvent: {
                text,
                eventCount: 1,
                target: 0,
              },
            });
          }

          if (!visualUpdated) {
            return `❌ Type failed: Cannot locate native host node to explicitly inject visual text into uncontrolled element [${index}].`;
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
          return `✅ Typed "${text}" into [${index}] "${label}"`;
        } catch (err: any) {
          return `❌ Type failed: ${err.message}`;
        }
      }
    }

    return `❌ Element [${index}] "${label}" is not a typeable text input. No onChange or native stateNode found in fiber tree.`;
  }

  private async scroll(
    direction: 'down' | 'up',
    amount: 'page' | 'toEnd' | 'toStart' = 'page',
    containerIndex = 0
  ): Promise<string> {
    const screenName = this.getCurrentScreenName();
    const containers = findScrollableContainers(this.options.getRootRef(), screenName);

    if (containers.length === 0) {
      return `❌ No scrollable container found on screen "${screenName}". Content may still be loading — wait and try again.`;
    }

    const container = containers[containerIndex];
    if (!container) {
      const available = containers
        .filter((entry) => !entry.isPagerLike)
        .map((entry) => `[${entry.index}] ${entry.label} (${entry.componentName})`)
        .join(', ');
      return `❌ Container index ${containerIndex} not found. Available scrollable containers on "${screenName}": ${available}`;
    }

    if (container.isPagerLike) {
      const scrollableAlts = containers
        .filter((entry) => !entry.isPagerLike)
        .map((entry) => `[${entry.index}] ${entry.label} (${entry.componentName})`)
        .join(', ');
      const suggestion = scrollableAlts
        ? `Try scrolling a content container instead: ${scrollableAlts}`
        : 'Use tap on the tab labels to switch tabs instead of scrolling.';
      return `⚠️ Container [${containerIndex}] "${container.label}" is a ${container.componentName} (tab/page container). Scrolling pager containers directly causes native crashes. ${suggestion}`;
    }

    const scrollRef = container.stateNode;
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

    const offsetBefore =
      typeof scrollRef.scrollToOffset === 'function'
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
        const FALLBACK_PAGE_HEIGHT = 800;
        if (typeof scrollRef.scrollToOffset === 'function') {
          const metrics = scrollRef._scrollMetrics;
          const currentOffset = metrics?.offset ?? 0;
          const visibleLength = metrics?.visibleLength ?? FALLBACK_PAGE_HEIGHT;
          const scrollAmount = Math.round(visibleLength * 0.8);
          const newOffset =
            direction === 'down'
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

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const offsetAfter =
        typeof scrollRef.scrollToOffset === 'function'
          ? scrollRef._scrollMetrics?.offset ?? 0
          : -1;

      if (offsetAfter >= 0 && Math.abs(offsetAfter - offsetBefore) < 2) {
        const edge = direction === 'down' ? 'bottom' : 'top';
        return `⚠️ Scroll had no effect — already at the ${edge} of ${container.label}. All visible content has been loaded.`;
      }

      const amountLabel =
        amount === 'toEnd' ? 'to end' : amount === 'toStart' ? 'to start' : `${direction} one page`;
      return `✅ Scrolled ${amountLabel} in ${container.label} (${container.componentName}). Check the updated screen content for newly loaded items.`;
    } catch (error: any) {
      return `❌ Scroll failed: ${error.message}`;
    }
  }

  private async adjustSlider(index: number, value: number): Promise<string> {
    const element = this.findInteractiveElement(index);
    if (!element) {
      return `❌ Element with index ${index} not found.`;
    }
    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 1) {
      return `❌ Slider value must be between 0.0 and 1.0, got ${value}`;
    }

    const onValueChange = element.props.onValueChange;
    if (!onValueChange || typeof onValueChange !== 'function') {
      return `❌ Element [${index}] "${element.label}" is not a slider (no onValueChange handler).`;
    }

    const min = element.props.minimumValue ?? 0;
    const max = element.props.maximumValue ?? 1;
    const actualValue = normalizedValue * (max - min) + min;

    try {
      onValueChange(actualValue);
      if (element.props.onSlidingComplete && typeof element.props.onSlidingComplete === 'function') {
        element.props.onSlidingComplete(actualValue);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `✅ Adjusted slider [${index}] "${element.label}" to ${Math.round(normalizedValue * 100)}% (value: ${actualValue.toFixed(2)})`;
    } catch (error: any) {
      return `❌ Error adjusting slider: ${error.message}`;
    }
  }

  private async selectPicker(index: number, value: string): Promise<string> {
    const element = this.findInteractiveElement(index);
    if (!element) {
      return `❌ Element with index ${index} not found.`;
    }

    const onValueChange = element.props.onValueChange;
    if (!onValueChange || typeof onValueChange !== 'function') {
      return `❌ Element [${index}] "${element.label}" is not a picker (no onValueChange handler).`;
    }

    const options = extractPickerOptions(element);
    if (options.length > 0) {
      const match = options.find(
        (option) => String(option.value) === value || option.label.toLowerCase() === value.toLowerCase()
      );
      if (!match) {
        const available = options.map((option) => `"${option.label}" (${option.value})`).join(', ');
        return `❌ Value "${value}" not found in picker. Available: ${available}`;
      }

      try {
        const matchIndex = options.indexOf(match);
        onValueChange(match.value, matchIndex);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return `✅ Selected "${match.label}" in picker [${index}] "${element.label}"`;
      } catch (error: any) {
        return `❌ Error selecting picker value: ${error.message}`;
      }
    }

    try {
      onValueChange(value, 0);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `✅ Set picker [${index}] "${element.label}" to "${value}"`;
    } catch (error: any) {
      return `❌ Error setting picker value: ${error.message}`;
    }
  }

  private async setDate(index: number, date: string): Promise<string> {
    const element = this.findInteractiveElement(index);
    if (!element) {
      return `❌ Element with index ${index} not found.`;
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return `❌ Invalid date format: "${date}". Use ISO 8601 format (e.g., "2025-03-25" or "2025-03-25T14:30:00").`;
    }

    const onChange = element.props.onChange || element.props.onDateChange || element.props.onConfirm;
    if (!onChange || typeof onChange !== 'function') {
      return `❌ Element [${index}] "${element.label}" is not a date picker (no onChange/onDateChange handler).`;
    }

    try {
      const syntheticEvent = {
        type: 'set',
        nativeEvent: {
          timestamp: dateObj.getTime(),
          utcOffset: 0,
        },
      };
      onChange(syntheticEvent, dateObj);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `✅ Set date picker [${index}] "${element.label}" to ${dateObj.toLocaleDateString()}`;
    } catch (error: any) {
      return `❌ Error setting date: ${error.message}`;
    }
  }

  private async dismissKeyboard(): Promise<string> {
    try {
      Keyboard.dismiss();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return '✅ Keyboard dismissed.';
    } catch (error: any) {
      return `❌ Error dismissing keyboard: ${error.message}`;
    }
  }

  private async guideUser(index: number, message: string, autoRemoveAfterMs?: number): Promise<string> {
    const snapshot = this.lastSnapshot || this.getScreenSnapshot();
    const element = snapshot.elements.find((entry) => entry.index === index);
    if (!element) {
      return `❌ Cannot guide user: Element ${index} not found.`;
    }

    if (process.env.NODE_ENV === 'test') {
      DeviceEventEmitter.emit('MOBILE_AI_HIGHLIGHT', {
        pageX: 0,
        pageY: 0,
        width: 100,
        height: 100,
        message,
        autoRemoveAfterMs: autoRemoveAfterMs || 5000,
      });
      return `✅ Highlighted element ${index} ("${element.label}") with message: "${message}"`;
    }

    const stateNode = getStateNode(element.fiberNode);
    if (!stateNode || typeof stateNode.measure !== 'function') {
      return `❌ Element at index ${index} (${element.label}) cannot be highlighted because its layout position cannot be measured.`;
    }

    return new Promise((resolve) => {
      stateNode.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
        if (width === 0 || height === 0) {
          resolve(`❌ Element at index ${index} is not visible (0x0 size)`);
          return;
        }

        DeviceEventEmitter.emit('MOBILE_AI_HIGHLIGHT', {
          pageX,
          pageY,
          width,
          height,
          message,
          autoRemoveAfterMs: autoRemoveAfterMs || 5000,
        });

        logger.info('ReactNativePlatformAdapter', `Highlighted element ${index} ("${element.label}") at ${pageX},${pageY}`);
        resolve(`✅ Highlighted element ${index} ("${element.label}") with message: "${message}"`);
      });
    });
  }

  private async simplifyZone(zoneId: string): Promise<string> {
    if (!globalZoneRegistry.isActionAllowed(zoneId, 'simplify')) {
      return `❌ Cannot simplify zone "${zoneId}": Zone does not exist or allowSimplify is false.`;
    }
    const zone = globalZoneRegistry.get(zoneId) as any;
    if (zone && zone._controller) {
      zone._controller.simplify();
      logger.info('ReactNativePlatformAdapter', `Simplified zone: ${zoneId}`);
      return `✅ Successfully requested simplification for zone "${zoneId}".`;
    }
    return `❌ Cannot simplify zone "${zoneId}": Controller not attached. Is the zone currently rendered on screen?`;
  }

  private async renderBlock(
    zoneId: string,
    blockType: string,
    rawProps?: unknown,
    lifecycle: AIRichBlockLifecycle = 'dismissible'
  ): Promise<string> {
    if (!globalZoneRegistry.isActionAllowed(zoneId, 'block')) {
      return `❌ Cannot render block into zone "${zoneId}": Zone does not exist or allowInjectBlock is false.`;
    }

    const zone = globalZoneRegistry.get(zoneId) as any;
    if (!zone) {
      return `❌ Cannot render block into zone "${zoneId}": Zone does not exist.`;
    }

    const allowedBlocks = getAllowedZoneBlocks(zone);
    if (allowedBlocks.length === 0) {
      return `❌ Cannot render block into zone "${zoneId}": No blocks are registered for this zone.`;
    }

    const blockDefinition =
      allowedBlocks.find((candidate) => candidate.name === blockType)
      || globalBlockRegistry.get(blockType);

    if (!blockDefinition) {
      const availableBlocks = allowedBlocks.map((candidate) => candidate.name).join(', ');
      return `❌ Cannot render block into zone "${zoneId}": Block "${blockType}" is not registered for this zone. Available blocks: ${availableBlocks || 'none'}.`;
    }

    const zoneAllowsIntervention =
      zone.interventionEligible === true
      || zone.allowInjectCard === true
      || (Array.isArray(zone.templates) && zone.templates.length > 0);
    const blockAllowsIntervention = blockDefinition.interventionEligible !== false;
    if (!zoneAllowsIntervention || !blockAllowsIntervention) {
      return `❌ Cannot render block "${blockType}" into zone "${zoneId}": Block or zone is not eligible for screen intervention.`;
    }

    let sanitizedProps: Record<string, unknown>;
    try {
      sanitizedProps = parsePropsArg(rawProps);
    } catch (error: any) {
      return `❌ Cannot render block into zone "${zoneId}": Invalid props JSON. ${error.message}`;
    }

    const validation = globalBlockRegistry.validateProps(blockDefinition.name, sanitizedProps);
    if (!validation.valid) {
      return `❌ Cannot render block into zone "${zoneId}": ${validation.errors.join(' ')}`;
    }

    if (!zone._controller?.renderBlock && !zone._controller?.injectCard) {
      return `❌ Cannot render block into zone "${zoneId}": Controller not attached. Is the zone currently rendered on screen?`;
    }

    const blockElement = React.createElement(blockDefinition.component, sanitizedProps);
    if (zone._controller?.renderBlock) {
      zone._controller.renderBlock(blockElement, lifecycle);
    } else {
      zone._controller.injectCard(blockElement);
    }
    logger.info('ReactNativePlatformAdapter', `Rendered ${blockDefinition.name} into zone: ${zoneId}`);
    return `✅ Rendered "${blockDefinition.name}" in zone "${zoneId}". Tell the user where to look on screen.`;
  }

  private async injectCard(zoneId: string, templateName: string, rawProps?: unknown): Promise<string> {
    let result = await this.renderBlock(zoneId, templateName, rawProps, 'dismissible');
    result = result
      .replace('allowInjectBlock is false', 'allowInjectCard is false')
      .replace(`Block "${templateName}" is not registered for this zone.`, `Template "${templateName}" is not registered for this zone.`)
      .replace('Cannot render block', 'Cannot inject card')
      .replace('Rendered', 'Injected');
    if (result.startsWith('✅')) {
      return `${result} inject_card() is deprecated; prefer render_block().`;
    }
    return result;
  }

  private async restoreZone(zoneId: string): Promise<string> {
    const zone = globalZoneRegistry.get(zoneId) as any;
    if (!zone) {
      return `❌ Cannot restore zone "${zoneId}": Zone does not exist.`;
    }

    if (zone._controller) {
      zone._controller.restore();
      logger.info('ReactNativePlatformAdapter', `Restored zone: ${zoneId}`);
      return `✅ Successfully restored zone "${zoneId}" to its default state.`;
    }

    return `❌ Cannot restore zone "${zoneId}": Controller not attached.`;
  }

  private async navigate(screen: string, rawParams?: unknown): Promise<string> {
    if (this.options.router) {
      try {
        const path = screen.startsWith('/') ? screen : `/${screen}`;
        this.options.router.push(path);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return `✅ Navigated to "${path}"`;
      } catch (error: any) {
        return `❌ Navigation error: ${error.message}`;
      }
    }

    const navRef = this.options.navRef;
    if (!navRef) {
      return '❌ Navigation ref not available.';
    }
    if (!navRef.isReady()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!navRef.isReady()) {
        return '❌ Navigation is not ready yet.';
      }
    }

    try {
      const params =
        rawParams
          ? (typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams)
          : undefined;
      const availableRoutes = this.getRouteNames();
      logger.info('ReactNativePlatformAdapter', `🧭 Navigate requested: "${screen}" | Available: [${availableRoutes.join(', ')}] | Params: ${JSON.stringify(params)}`);
      const matchedScreen = availableRoutes.find((route) => route.toLowerCase() === screen.toLowerCase());

      if (!matchedScreen) {
        return `❌ "${screen}" is not a screen — it may be content within a screen. Available screens: ${availableRoutes.join(', ')}. Look at the current screen context for "${screen}" as a section, category, or element, and scroll/tap to find it. If it's on a different screen, navigate to the correct screen first.`;
      }

      const screenPath = this.findScreenPath(matchedScreen);
      if (screenPath.length > 1) {
        const nestedParams = this.buildNestedParams(screenPath, params);
        navRef.navigate(screenPath[0], nestedParams);
      } else {
        navRef.navigate(matchedScreen, params);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `✅ Navigated to "${matchedScreen}"${params ? ` with params: ${JSON.stringify(params)}` : ''}`;
    } catch (error: any) {
      return `❌ Navigation error: ${error.message}. Available screens: ${this.getRouteNames().join(', ')}`;
    }
  }
}

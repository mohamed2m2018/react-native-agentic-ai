/**
 * AgentErrorBoundary — Catches React rendering errors caused by AI agent actions.
 *
 * When the AI taps, scrolls, or navigates, the action itself may succeed
 * but trigger async side-effects (useEffect, onViewableItemsChanged) that
 * crash during the next React render cycle. This boundary catches those
 * errors, preventing red screen crashes and auto-recovering the UI.
 *
 * Recovery strategy:
 * 1. Catch the error via getDerivedStateFromError
 * 2. Log it and report to agent runtime via onError callback
 * 3. Auto-reset after a brief delay — remounts children cleanly
 */

import React from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: React.ReactNode;
  /** Called when an error is caught — reports back to agent runtime */
  onError?: (error: Error, componentStack?: string) => void;
  telemetryRef?: React.RefObject<any>; // Using any to avoid circular import, we duck-type track()
}

interface State {
  hasError: boolean;
}

export class AgentErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const componentStack = errorInfo?.componentStack || '';
    logger.warn(
      'AgentErrorBoundary',
      `🛡️ Caught rendering error: ${error.message}\n${componentStack}`
    );
    this.props.onError?.(error, componentStack);

    // Track the render error silently in analytics
    if (this.props.telemetryRef?.current?.track) {
      this.props.telemetryRef.current.track('render_error', {
        message: error.message,
        component: componentStack?.split('\n')[1]?.trim() ?? 'unknown',
        screen: this.props.telemetryRef.current.screen,
      });
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    // Auto-recover: reset error state after brief delay to remount children
    if (this.state.hasError && !prevState.hasError) {
      this.resetTimer = setTimeout(() => {
        this.setState({ hasError: false });
      }, 50);
    }
  }

  componentWillUnmount(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Return null briefly — children will remount on next tick
      // when hasError resets to false via componentDidUpdate
      return null;
    }
    return this.props.children;
  }
}

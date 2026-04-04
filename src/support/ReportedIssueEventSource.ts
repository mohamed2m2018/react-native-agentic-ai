import { logger } from '../utils/logger';
import type { ReportedIssue } from './types';

export interface ReportedIssueEventSourceOptions {
  url: string;
  onIssueUpdate?: (issue: ReportedIssue) => void;
  onConnected?: () => void;
  onError?: (error: Error) => void;
}

export class ReportedIssueEventSource {
  private abortController: AbortController | null = null;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectAttempts = 5;
  private readonly options: ReportedIssueEventSourceOptions;

  constructor(options: ReportedIssueEventSourceOptions) {
    this.options = options;
  }

  connect(): void {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async openConnection(): Promise<void> {
    if (this.intentionalClose) return;

    this.abortController = new AbortController();

    try {
      const response = await fetch(this.options.url, {
        signal: this.abortController.signal,
        headers: { Accept: 'text/event-stream' },
      });

      if (!response.ok) {
        this.scheduleReconnect();
        return;
      }

      if (!response.body) {
        await this.readFullResponse(response);
        return;
      }

      this.reconnectAttempts = 0;
      await this.readStream(response.body);
    } catch (error) {
      if (this.intentionalClose) return;
      if ((error as Error).name === 'AbortError') return;
      this.options.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let currentData = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentEvent) {
            this.handleEvent(currentEvent, currentData);
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (error) {
      if (this.intentionalClose) return;
      if ((error as Error).name === 'AbortError') return;
      logger.warn(
        'ReportedIssueSSE',
        'Stream read error:',
        (error as Error).message
      );
    }

    if (!this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private async readFullResponse(response: Response): Promise<void> {
    try {
      const text = await response.text();
      let currentEvent = '';
      let currentData = '';

      for (const line of text.split('\n')) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim();
        } else if (line === '' && currentEvent) {
          this.handleEvent(currentEvent, currentData);
          currentEvent = '';
          currentData = '';
        }
      }
    } catch (error) {
      if (this.intentionalClose) return;
      logger.warn(
        'ReportedIssueSSE',
        'Full response read error:',
        (error as Error).message
      );
    }

    if (!this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private handleEvent(event: string, data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (event === 'connected') {
        this.options.onConnected?.();
        return;
      }

      if (event === 'reported_issue_update' && parsed?.issue) {
        this.options.onIssueUpdate?.(parsed.issue as ReportedIssue);
      }
    } catch {
      // ignore bad payload
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        'ReportedIssueSSE',
        'Max reconnect attempts reached — giving up'
      );
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 16_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.openConnection().catch(() => {
        // Connection errors are handled inside openConnection.
      });
    }, delay);
  }
}

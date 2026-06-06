/**
 * EscalationEventSource — SSE client using fetch + ReadableStream.
 *
 * Uses only the fetch API (available in all React Native runtimes)
 * to consume Server-Sent Events — no EventSource polyfill needed.
 * Provides a reliable, auto-reconnecting channel for server-push
 * events like `ticket_closed` that complements the bidirectional
 * WebSocket used for chat.
 *
 * Lifecycle:
 * 1. SDK calls connect() → fetch with streaming response
 * 2. Server holds connection open, pushes `ticket_closed` when agent resolves
 * 3. On disconnect, auto-reconnects with exponential backoff (max 5 attempts)
 * 4. If ticket is already closed, server responds immediately with the event
 */

import { logger } from '../utils/logger';

export interface EscalationEventSourceOptions {
  url: string;
  onTicketClosed?: (ticketId: string) => void;
  onConnected?: (ticketId: string) => void;
  onError?: (error: Error) => void;
}

export class EscalationEventSource {
  private abortController: AbortController | null = null;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectAttempts = 5;
  private readonly options: EscalationEventSourceOptions;

  constructor(options: EscalationEventSourceOptions) {
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
        logger.warn('EscalationSSE', 'Non-OK response:', response.status);
        this.scheduleReconnect();
        return;
      }

      if (!response.body) {
        logger.warn('EscalationSSE', 'No readable body — falling back to reading full response');
        await this.readFullResponse(response);
        return;
      }

      this.reconnectAttempts = 0;
      await this.readStream(response.body);
    } catch (err) {
      if (this.intentionalClose) return;
      if ((err as Error).name === 'AbortError') return;
      logger.warn('EscalationSSE', 'Connection error:', (err as Error).message);
      this.options.onError?.(err as Error);
      this.scheduleReconnect();
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentEvent && currentData) {
            this.handleEvent(currentEvent, currentData);
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      if (this.intentionalClose) return;
      if ((err as Error).name === 'AbortError') return;
      logger.warn('EscalationSSE', 'Stream read error:', (err as Error).message);
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
        } else if (line === '' && currentEvent && currentData) {
          this.handleEvent(currentEvent, currentData);
          currentEvent = '';
          currentData = '';
        }
      }
    } catch (err) {
      if (this.intentionalClose) return;
      logger.warn('EscalationSSE', 'Full response read error:', (err as Error).message);
    }

    if (!this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private handleEvent(event: string, data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (event === 'connected') {
        logger.info('EscalationSSE', 'Connected for ticket:', parsed.ticketId);
        this.options.onConnected?.(parsed.ticketId);
      } else if (event === 'ticket_closed') {
        logger.info('EscalationSSE', 'Ticket closed event:', parsed.ticketId);
        this.options.onTicketClosed?.(parsed.ticketId);
        this.intentionalClose = true;
        this.abortController?.abort();
      }
    } catch {
      // ignore parse error
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('EscalationSSE', 'Max reconnect attempts reached — giving up');
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 16_000);
    this.reconnectAttempts++;
    logger.info('EscalationSSE', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.openConnection();
    }, delay);
  }
}

/**
 * EscalationSocket — manages a WebSocket connection to the MobileAI platform
 * for receiving real-time replies from human support agents.
 *
 * Lifecycle:
 * 1. SDK calls escalate_to_human → POST /api/v1/escalations → gets { ticketId, wsUrl }
 * 2. EscalationSocket.connect(wsUrl) opens a WS connection
 * 3. Platform pushes { type: 'reply', ticketId, reply } when agent responds
 * 4. onReply callback fires → shown in chat UI as "👤 Human Agent: <reply>"
 * 5. disconnect() on chat close / unmount
 *
 * Handles:
 * - Server heartbeat pings (type: 'ping') — acknowledged silently
 * - Auto-reconnect on unexpected close (max 3 attempts, exponential backoff)
 * - Message queue — buffers sendText calls while connecting, flushes on open
 */

export type SocketReplyHandler = (reply: string, ticketId?: string) => void;

interface EscalationSocketOptions {
  onReply: SocketReplyHandler;
  onError?: (error: Event) => void;
  onTypingChange?: (isTyping: boolean) => void;
  onTicketClosed?: (ticketId?: string) => void;
  maxReconnectAttempts?: number;
}

export class EscalationSocket {
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private _hasErrored = false;

  /** Messages buffered while the socket is connecting / reconnecting. */
  private messageQueue: string[] = [];

  private readonly onReply: SocketReplyHandler;
  private readonly onError?: (error: Event) => void;
  private readonly onTypingChange?: (isTyping: boolean) => void;
  private readonly onTicketClosed?: (ticketId?: string) => void;
  private readonly maxReconnectAttempts: number;

  constructor(options: EscalationSocketOptions) {
    this.onReply = options.onReply;
    this.onError = options.onError;
    this.onTypingChange = options.onTypingChange;
    this.onTicketClosed = options.onTicketClosed;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
  }

  connect(wsUrl: string): void {
    this.wsUrl = wsUrl;
    this.intentionalClose = false;
    this._hasErrored = false;
    this.openConnection();
  }

  /** True if the underlying WebSocket is open and ready to send. */
  get isConnected(): boolean {
    return this.ws?.readyState === 1; // WebSocket.OPEN
  }

  /** True if the socket encountered an error (and may not be reliable to reuse). */
  get hasErrored(): boolean {
    return this._hasErrored;
  }

  /**
   * Send a text message to the live agent.
   *
   * If the socket is currently connecting or reconnecting, the message is
   * buffered and sent automatically once the connection is established.
   * Returns `true` in both cases (connected send + queued send).
   * Returns `false` only if the socket has no URL (was never connected).
   */
  sendText(text: string): boolean {
    if (!this.wsUrl) {
      // No URL at all — nothing we can do.
      return false;
    }

    if (this.ws?.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify({ type: 'user_message', content: text }));
      return true;
    }

    // Socket is connecting (CONNECTING=0) or reconnecting (CLOSED=3 → scheduleReconnect).
    // Queue the message so it is flushed as soon as onopen fires.
    console.log('[EscalationSocket] ⏳ Socket not open — queuing message for when connected');
    this.messageQueue.push(JSON.stringify({ type: 'user_message', content: text }));

    // If the socket is fully closed (not just connecting), kick off a reconnect now
    // rather than waiting for scheduleReconnect's timeout to fire.
    const state = this.ws?.readyState;
    if (state === undefined || state === 3 /* CLOSED */) {
      console.log('[EscalationSocket] Socket CLOSED — initiating reconnect to flush queue');
      this.openConnection();
    }

    return true; // optimistic — message is queued
  }

  sendTypingStatus(isTyping: boolean): boolean {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: isTyping ? 'typing_start' : 'typing_stop' }));
      return true;
    }
    return false;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.messageQueue = []; // drop queued messages on intentional close
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private flushQueue(): void {
    if (this.messageQueue.length === 0) return;
    console.log(`[EscalationSocket] 🚀 Flushing ${this.messageQueue.length} queued message(s)`);
    const queue = this.messageQueue.splice(0); // drain atomically
    for (const payload of queue) {
      try {
        this.ws?.send(payload);
      } catch (err) {
        console.error('[EscalationSocket] Failed to flush queued message:', err);
      }
    }
  }

  private openConnection(): void {
    if (!this.wsUrl) return;

    // Don't open a second socket if one is already connecting
    if (this.ws && this.ws.readyState === 0 /* CONNECTING */) {
      console.log('[EscalationSocket] Already connecting — skipping duplicate openConnection');
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (err) {
      console.error('[EscalationSocket] Failed to open WebSocket:', err);
      return;
    }

    this.ws.onopen = () => {
      console.log('[EscalationSocket] ✅ Connected to:', this.wsUrl);
      this.reconnectAttempts = 0;
      this._hasErrored = false;
      this.flushQueue(); // send any messages that arrived while connecting
    };

    this.ws.onmessage = (event) => {
      try {
        const rawData = String(event.data);
        console.log('[EscalationSocket] Message received:', rawData);
        const msg = JSON.parse(rawData);
        if (msg.type === 'ping') {
          console.log('[EscalationSocket] Heartbeat ping received');
          return;
        }
        if (msg.type === 'reply' && msg.reply) {
          console.log('[EscalationSocket] Human reply received:', msg.reply);
          this.onTypingChange?.(false);
          this.onReply(msg.reply, msg.ticketId);
        } else if (msg.type === 'typing_start') {
          this.onTypingChange?.(true);
        } else if (msg.type === 'typing_stop') {
          this.onTypingChange?.(false);
        } else if (msg.type === 'ticket_closed') {
          console.log('[EscalationSocket] Ticket closed by agent');
          this.onTypingChange?.(false);
          this.onTicketClosed?.(msg.ticketId);
          this.intentionalClose = true;
          this.ws?.close();
        }
      } catch {
        // Non-JSON message — ignore
      }
    };

    this.ws.onerror = (event) => {
      console.error('[EscalationSocket] ❌ WebSocket error. URL was:', this.wsUrl, event);
      this._hasErrored = true;
      this.onError?.(event);
    };

    this.ws.onclose = (event) => {
      console.warn(`[EscalationSocket] Connection closed. Code=${event.code} Reason="${event.reason}" Intentional=${this.intentionalClose}`);
      if (this.intentionalClose) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[EscalationSocket] Max reconnect attempts reached — giving up');
      this.messageQueue = []; // drop queued messages — connection is permanently lost
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 16_000);
    this.reconnectAttempts++;
    console.log(
      `[EscalationSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );
    this.reconnectTimer = setTimeout(() => {
      this._hasErrored = false; // clear error flag before reconnect attempt
      this.openConnection();
    }, delay);
  }
}

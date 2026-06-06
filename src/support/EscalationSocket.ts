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
 */

export type SocketReplyHandler = (reply: string) => void;

interface EscalationSocketOptions {
  onReply: SocketReplyHandler;
  onError?: (error: Event) => void;
  onTypingChange?: (isTyping: boolean) => void;
  maxReconnectAttempts?: number;
}

export class EscalationSocket {
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  private readonly onReply: SocketReplyHandler;
  private readonly onError?: (error: Event) => void;
  private readonly onTypingChange?: (isTyping: boolean) => void;
  private readonly maxReconnectAttempts: number;

  constructor(options: EscalationSocketOptions) {
    this.onReply = options.onReply;
    this.onError = options.onError;
    this.onTypingChange = options.onTypingChange;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
  }

  connect(wsUrl: string): void {
    this.wsUrl = wsUrl;
    this.intentionalClose = false;
    this.openConnection();
  }

  sendText(text: string): boolean {
    if (this.ws?.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify({ type: 'user_message', content: text }));
      return true;
    }
    return false;
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private openConnection(): void {
    if (!this.wsUrl) return;

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (err) {
      console.error('[EscalationSocket] Failed to open WebSocket:', err);
      return;
    }

    this.ws.onopen = () => {
      console.log('[EscalationSocket] ✅ Connected to:', this.wsUrl);
      this.reconnectAttempts = 0;
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
          this.onReply(msg.reply);
        } else if (msg.type === 'typing_start') {
          this.onTypingChange?.(true);
        } else if (msg.type === 'typing_stop') {
          this.onTypingChange?.(false);
        }
      } catch {
        // Non-JSON message — ignore
      }
    };

    this.ws.onerror = (event) => {
      console.error('[EscalationSocket] ❌ WebSocket error. URL was:', this.wsUrl, event);
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
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 16_000);
    this.reconnectAttempts++;
    console.log(
      `[EscalationSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );
    this.reconnectTimer = setTimeout(() => {
      this.openConnection();
    }, delay);
  }
}

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
  private readonly maxReconnectAttempts: number;

  constructor(options: EscalationSocketOptions) {
    this.onReply = options.onReply;
    this.onError = options.onError;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
  }

  connect(wsUrl: string): void {
    this.wsUrl = wsUrl;
    this.intentionalClose = false;
    this.openConnection();
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
      console.log('[EscalationSocket] Connected:', this.wsUrl);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'ping') return; // heartbeat — ignore
        if (msg.type === 'reply' && msg.reply) {
          this.onReply(msg.reply);
        }
      } catch {
        // Non-JSON message — ignore
      }
    };

    this.ws.onerror = (event) => {
      console.error('[EscalationSocket] Error:', event);
      this.onError?.(event);
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) return;
      console.warn('[EscalationSocket] Connection closed unexpectedly');
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

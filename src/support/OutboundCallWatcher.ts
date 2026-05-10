import { ENDPOINTS } from '../config/endpoints';
import { logger } from '../utils/logger';

const LOG_TAG = 'OutboundCallWatcher';

export type OutboundCallEvent =
  | { type: 'status'; status: string; startedAt?: string; twilioCallSid?: string }
  | { type: 'transcript'; role: 'caller' | 'ai' | 'system'; text: string; at: string }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | {
      type: 'completed';
      status: 'completed' | 'failed';
      durationSeconds?: number;
      outcome?: Record<string, unknown>;
      transcript?: Array<Record<string, unknown>>;
      billedCostUsd?: number;
      failureReason?: string;
    };

export type OutboundCallTerminal = {
  status: 'completed' | 'failed';
  durationSeconds?: number;
  outcome?: Record<string, unknown>;
  transcript: Array<{ role: string; text: string; at?: string }>;
  failureReason?: string;
  billedCostUsd?: number;
};

function resolveWsBase(proxyUrl?: string): string {
  const root = (proxyUrl ?? ENDPOINTS.escalation)
    .replace(/\/$/, '')
    .replace(/\/api\/v1\/analytics$/, '');
  if (root.startsWith('https://')) return `wss://${root.slice('https://'.length)}`;
  if (root.startsWith('http://')) return `ws://${root.slice('http://'.length)}`;
  return root;
}

export type OutboundCallWatcherOptions = {
  callId: string;
  analyticsKey: string;
  proxyUrl?: string;
  /** Hard cap in ms before the watcher resolves with whatever it has. */
  timeoutMs?: number;
  onEvent?: (event: OutboundCallEvent) => void;
};

export class OutboundCallWatcher {
  private readonly callId: string;
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly onEvent?: (event: OutboundCallEvent) => void;
  private socket: WebSocket | null = null;
  private terminalResolve: ((terminal: OutboundCallTerminal) => void) | null = null;
  private terminalReject: ((err: Error) => void) | null = null;
  private terminalPromise: Promise<OutboundCallTerminal> | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private collectedTranscript: Array<{ role: string; text: string; at?: string }> = [];
  private latestStatus: string | undefined;
  private resolved = false;

  constructor(opts: OutboundCallWatcherOptions) {
    this.callId = opts.callId;
    const base = resolveWsBase(opts.proxyUrl);
    const key = encodeURIComponent(opts.analyticsKey);
    this.url = `${base}/ws/outbound-calls/${encodeURIComponent(opts.callId)}/events?key=${key}`;
    this.timeoutMs = Math.max(10_000, opts.timeoutMs ?? 30 * 60_000);
    this.onEvent = opts.onEvent;
  }

  start(): Promise<OutboundCallTerminal> {
    if (this.terminalPromise) return this.terminalPromise;
    this.terminalPromise = new Promise<OutboundCallTerminal>((resolve, reject) => {
      this.terminalResolve = resolve;
      this.terminalReject = reject;
    });

    try {
      this.socket = new WebSocket(this.url);
    } catch (err: any) {
      this.failOnce(new Error(`Failed to open watcher socket: ${err?.message || String(err)}`));
      return this.terminalPromise;
    }

    this.socket.onmessage = (ev) => {
      let data: OutboundCallEvent;
      try {
        data = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      this.handleEvent(data);
    };
    this.socket.onerror = () => {
      logger.warn(LOG_TAG, `socket error for ${this.callId}`);
    };
    this.socket.onclose = () => {
      if (!this.resolved) {
        this.resolveOnce({
          status: this.latestStatus === 'completed' ? 'completed' : 'failed',
          transcript: this.collectedTranscript,
          failureReason:
            this.latestStatus === 'completed' ? undefined : 'socket_closed_before_terminal',
        });
      }
    };

    this.timeoutHandle = setTimeout(() => {
      if (this.resolved) return;
      this.resolveOnce({
        status: 'failed',
        transcript: this.collectedTranscript,
        failureReason: 'watcher_timeout',
      });
      this.close();
    }, this.timeoutMs);

    return this.terminalPromise;
  }

  close() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    try {
      this.socket?.close();
    } catch {
      // ignore
    }
    this.socket = null;
  }

  private handleEvent(event: OutboundCallEvent) {
    try {
      this.onEvent?.(event);
    } catch (err: any) {
      logger.warn(LOG_TAG, `onEvent handler threw: ${err?.message || String(err)}`);
    }

    if (event.type === 'transcript') {
      this.collectedTranscript.push({ role: event.role, text: event.text, at: event.at });
      return;
    }
    if (event.type === 'status') {
      this.latestStatus = event.status;
      return;
    }
    if (event.type === 'completed') {
      this.latestStatus = event.status;
      const transcript =
        Array.isArray(event.transcript) && event.transcript.length > 0
          ? event.transcript.map((e) => ({
              role: typeof (e as any).role === 'string' ? String((e as any).role) : 'unknown',
              text: typeof (e as any).text === 'string' ? String((e as any).text) : '',
              at: typeof (e as any).at === 'string' ? String((e as any).at) : undefined,
            }))
          : this.collectedTranscript;
      this.resolveOnce({
        status: event.status,
        durationSeconds: event.durationSeconds,
        outcome: event.outcome,
        transcript,
        failureReason: event.failureReason,
        billedCostUsd: event.billedCostUsd,
      });
      this.close();
    }
  }

  private resolveOnce(terminal: OutboundCallTerminal) {
    if (this.resolved) return;
    this.resolved = true;
    this.terminalResolve?.(terminal);
  }

  private failOnce(err: Error) {
    if (this.resolved) return;
    this.resolved = true;
    this.terminalReject?.(err);
  }
}

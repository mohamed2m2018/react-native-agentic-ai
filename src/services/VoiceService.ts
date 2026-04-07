/**
 * VoiceService — @google/genai SDK Live API connection.
 *
 * Uses the official `ai.live.connect()` method instead of raw WebSocket.
 * This fixes function calling reliability: the SDK handles protocol details
 * (binary framing, message transforms, model name prefixes) that our
 * previous raw WebSocket implementation missed.
 *
 * Handles bidirectional audio streaming between the app and Gemini:
 * - Sends PCM 16kHz 16-bit audio chunks (mic input)
 * - Receives PCM 24kHz 16-bit audio chunks (AI responses)
 * - Receives function calls (tap, navigate, etc.) for agentic actions
 * - Sends screen context (DOM text) for live mode
 */

// @ts-ignore — TS can't find declarations for the deep path at build time
// Platform-specific import: Metro can't resolve '@google/genai/web' sub-path
// so we use the full path to the web bundle (works because RN's WebSocket = browser API).
import type { Session } from '@google/genai/dist/web/index.mjs';

function loadVoiceGenAI() {
  try {
    const mod = require('@google/genai/dist/web/index.mjs');
    return { GoogleGenAI: mod.GoogleGenAI, Modality: mod.Modality };
  } catch (e: any) {
    throw new Error(
      '[mobileai] @google/genai is required for Voice Mode. ' +
      'Install it: npm install @google/genai'
    );
  }
}
import { logger } from '../utils/logger';
import type { ToolDefinition } from '../core/types';

// ─── Types ─────────────────────────────────────────────────────

export interface VoiceServiceConfig {
  apiKey?: string;
  proxyUrl?: string;
  proxyHeaders?: Record<string, string>;
  model?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  /** Audio sample rate for mic input (default: 16000) */
  inputSampleRate?: number;
  /** Language for Gemini speech generation (e.g., 'en', 'ar') */
  language?: string;
}

export interface VoiceServiceCallbacks {
  onAudioResponse?: (base64Audio: string) => void;
  onToolCall?: (toolCall: { name: string; args: Record<string, any>; id: string }) => void;
  onTranscript?: (text: string, isFinal: boolean, role: 'user' | 'model') => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: string) => void;
  /** Called when AI turn is complete (all audio sent) */
  onTurnComplete?: () => void;
  /** Called when SDK setup is complete — safe to send screen context */
  onSetupComplete?: () => void;
}

export type VoiceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const DEFAULT_INPUT_SAMPLE_RATE = 16000;

// ─── Service ───────────────────────────────────────────────────

export class VoiceService {
  private session: Session | null = null;
  private config: VoiceServiceConfig;
  private callbacks: VoiceServiceCallbacks = {};
  public lastCallbacks: VoiceServiceCallbacks | null = null;
  private _status: VoiceStatus = 'disconnected';
  public intentionalDisconnect = false;

  constructor(config: VoiceServiceConfig) {
    this.config = config;
  }

  // ─── Connection ────────────────────────────────────────────

  /**
   * Connect to Gemini Live API via the official SDK.
   * Now async because `ai.live.connect()` returns a Promise.
   */
  async connect(callbacks: VoiceServiceCallbacks): Promise<void> {
    if (this.session) {
      logger.info('VoiceService', 'Already connected');
      return;
    }

    this.callbacks = callbacks;
    this.lastCallbacks = callbacks;
    this.setStatus('connecting');
    this.intentionalDisconnect = false;

    const model = this.config.model || DEFAULT_MODEL;
    logger.info('VoiceService', `Connecting via SDK (model: ${model})`);

    try {
      const genAiConfig: any = {};

      if (this.config.proxyUrl) {
        // The @google/genai SDK sends apiKey as ?key=<value> in the WebSocket URL.
        // For HTTP text proxy, the Authorization header carries the secret key.
        // For WebSocket voice proxy, browser WS APIs don't support custom headers —
        // the only way to pass auth is via the URL query string.
        // So we extract the real secret key from proxyHeaders and use it as apiKey,
        // which the SDK will append as ?key=<secret> in the WS URL.
        // Our proxy reads it there, validates it, then replaces it with the real
        // Gemini API key before forwarding upstream.
        const authHeader = this.config.proxyHeaders?.['Authorization'] ?? this.config.proxyHeaders?.['authorization'];
        const secretKey = authHeader?.startsWith('Bearer ')
          ? authHeader.replace('Bearer ', '').trim()
          : authHeader ?? 'proxy-key';

        genAiConfig.apiKey = secretKey;
        genAiConfig.httpOptions = {
          baseUrl: this.config.proxyUrl,
          headers: this.config.proxyHeaders || {},
        };
      } else if (this.config.apiKey) {
        genAiConfig.apiKey = this.config.apiKey;
      } else {
        throw new Error('[mobileai] Must provide apiKey or proxyUrl');
      }

      const { GoogleGenAI, Modality } = loadVoiceGenAI();
      const ai = new GoogleGenAI(genAiConfig);

      const toolDeclarations = this.buildToolDeclarations();

      // Build SDK config matching the official docs pattern
      const sdkConfig: Record<string, any> = {
        responseModalities: [Modality.AUDIO],
      };

      // Enable transcription for debugging and UX
      sdkConfig.inputAudioTranscription = {};
      sdkConfig.outputAudioTranscription = {};
      logger.info('VoiceService', 'Transcription enabled');

      if (this.config.systemPrompt) {
        sdkConfig.systemInstruction = {
          parts: [{ text: this.config.systemPrompt }],
        };
      }

      if (toolDeclarations.length > 0) {
        sdkConfig.tools = [{ functionDeclarations: toolDeclarations }];
      }

      // FULL CONFIG DUMP — see exactly what we send to SDK
      const configDump = JSON.stringify({
        ...sdkConfig,
        systemInstruction: sdkConfig.systemInstruction ? '(present)' : '(none)',
        tools: sdkConfig.tools ? `${toolDeclarations.length} declarations` : '(none)',
      });
      logger.info('VoiceService', `📋 SDK config: ${configDump}`);
      logger.info('VoiceService', `📋 Tool names: ${toolDeclarations.map((t: any) => t.name).join(', ')}`);

      const session = await ai.live.connect({
        model: model,
        config: sdkConfig,
        callbacks: {
          onopen: () => {
            logger.info('VoiceService', '✅ SDK session connected');
            this.setStatus('connected');
          },
          onmessage: (message: any) => {
            this.handleSDKMessage(message);
          },
          onerror: (error: any) => {
            const errDetail = error
              ? JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 500)
              : 'null';
            logger.error('VoiceService', `SDK error: ${errDetail}`);
            this.setStatus('error');
            this.callbacks.onError?.(error?.message || 'SDK connection error');
          },
          onclose: (event: any) => {
            const closeDetail = event
              ? JSON.stringify(event, Object.getOwnPropertyNames(event)).substring(0, 500)
              : 'null';
            if (this.intentionalDisconnect) {
              logger.info('VoiceService', `SDK session closed (intentional)`);
            } else {
              logger.error('VoiceService', `SDK session closed UNEXPECTEDLY — code: ${event?.code}, reason: ${event?.reason}, detail: ${closeDetail}`);
              this.callbacks.onError?.(`Connection lost (code: ${event?.code || 'unknown'})`);
            }
            this.session = null;
            this.setStatus('disconnected');
          },
        },
      });

      this.session = session;
      logger.info('VoiceService', 'SDK session established');

    } catch (error: any) {
      logger.error('VoiceService', `Connection failed: ${error.message}`);
      this.setStatus('error');
      this.callbacks.onError?.(error.message || 'Failed to connect');
    }
  }

  disconnect(): void {
    if (this.session) {
      logger.info('VoiceService', 'Disconnecting (intentional)...');
      this.intentionalDisconnect = true;
      this.session.close();
      this.session = null;
      this.setStatus('disconnected');
    }
  }

  get isConnected(): boolean {
    return this.session !== null && this._status === 'connected';
  }

  get currentStatus(): VoiceStatus {
    return this._status;
  }

  // ─── Send Audio ────────────────────────────────────────────

  /** Send PCM audio chunk (base64 encoded) via SDK's sendRealtimeInput */
  private sendCount = 0;
  sendAudio(base64Audio: string): void {
    this.sendCount++;
    if (!this.isConnected || !this.session) {
      if (this.sendCount % 20 === 0) {
        logger.warn('VoiceService', `sendAudio #${this.sendCount} DROPPED — not connected`);
      }
      return;
    }

    const mimeType = `audio/pcm;rate=${this.config.inputSampleRate || DEFAULT_INPUT_SAMPLE_RATE}`;

    // DEBUG: log every send call
    if (this.sendCount <= 5 || this.sendCount % 10 === 0) {
      logger.info('VoiceService', `📡 sendAudio #${this.sendCount}: len=${base64Audio.length}, mime=${mimeType}, preview=${base64Audio.substring(0, 30)}...`);
    }

    try {
      this.session.sendRealtimeInput({
        audio: { data: base64Audio, mimeType },
      });
      // Log every 50th successful send to confirm data is reaching WebSocket
      if (this.sendCount % 50 === 0) {
        logger.info('VoiceService', `✅ sendAudio #${this.sendCount} OK — session.isOpen=${!!this.session}`);
      }
    } catch (error: any) {
      logger.error('VoiceService', `❌ sendAudio EXCEPTION: ${error.message}\n${error.stack?.substring(0, 300)}`);
      this.session = null;
      this.setStatus('disconnected');
    }
  }

  // ─── Send Text ─────────────────────────────────────────────

  /** Send text message via SDK's sendClientContent */
  sendText(text: string): void {
    if (!this.isConnected || !this.session) return;

    logger.info('VoiceService', `🗣️ USER (text): "${text}"`);
    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
    } catch (error: any) {
      logger.error('VoiceService', `sendText failed: ${error.message}`);
    }
  }

  /**
   * Send DOM tree as passive context during live conversation.
   * Uses turnComplete: false — the model receives context without responding.
   */
  sendScreenContext(domText: string): void {
    if (!this.isConnected || !this.session) return;

    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: domText }] }],
        turnComplete: true,
      });
      logger.info('VoiceService', `📤 Screen context sent (${domText.length} chars)`);
    } catch (error: any) {
      logger.error('VoiceService', `sendScreenContext failed: ${error.message}`);
    }
  }

  // ─── Send Function Response ────────────────────────────────

  /** Send function call result back via SDK's sendToolResponse */
  sendFunctionResponse(name: string, id: string, result: any): void {
    if (!this.isConnected || !this.session) return;

    logger.info('VoiceService', `📤 Sending tool response for ${name} (id=${id})`);

    try {
      this.session.sendToolResponse({
        functionResponses: [{ name, id, response: result }],
      });
    } catch (error: any) {
      logger.error('VoiceService', `sendFunctionResponse failed: ${error.message}`);
    }
  }

  // ─── Internal: Tool Declarations ───────────────────────────

  /**
   * Builds function declarations from configured tools.
   * Converts BOOLEAN params to STRING (native audio model limitation).
   */
  private buildToolDeclarations(): any[] {
    if (!this.config.tools?.length) return [];

    const validTools = this.config.tools.filter(t => t.name !== 'capture_screenshot');
    if (validTools.length === 0) return [];

    return validTools.map(tool => {
      const hasParams = Object.keys(tool.parameters || {}).length > 0;
      const functionDecl: any = {
        name: tool.name,
        description: tool.description,
      };

      if (hasParams) {
        functionDecl.parameters = {
          type: 'OBJECT',
          properties: Object.fromEntries(
            Object.entries(tool.parameters).map(([key, param]) => {
              let paramType = param.type.toUpperCase();
              let desc = param.description;
              if (paramType === 'BOOLEAN') {
                paramType = 'STRING';
                desc = `${desc} (use "true" or "false")`;
              }
              return [key, { type: paramType, description: desc }];
            })
          ),
          required: Object.entries(tool.parameters)
            .filter(([, param]) => param.required)
            .map(([key]) => key),
        };
      }
      return functionDecl;
    });
  }

  // ─── Internal: Message Handling ────────────────────────────

  /**
   * Handle messages from the SDK's onmessage callback.
   * The SDK parses binary/JSON automatically — we get clean objects.
   *
   * Per official docs, tool calls come at the top level as
   * `response.toolCall.functionCalls`.
   */
  private handleSDKMessage(message: any): void {
    try {
      // RAW MESSAGE DUMP — full session visibility
      const msgKeys = Object.keys(message || {}).join(', ');
      logger.info('VoiceService', `📨 SDK message keys: [${msgKeys}]`);

      // Full raw dump for non-audio messages (audio is too large)
      if (!message.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)) {
        const rawDump = JSON.stringify(message).substring(0, 1000);
        logger.info('VoiceService', `📨 RAW: ${rawDump}`);
      }

      // Tool calls — top-level (per official docs)
      if (message.toolCall?.functionCalls) {
        this.handleToolCalls(message.toolCall.functionCalls);
        return;
      }

      // Server content (audio, text, transcripts, turn events)
      if (message.serverContent) {
        this.handleServerContent(message.serverContent);
      }

      // Setup complete acknowledgment
      if (message.setupComplete !== undefined) {
        logger.info('VoiceService', '✅ Setup complete — ready for audio');
        this.callbacks.onSetupComplete?.();
      }

      // Error messages
      if (message.error) {
        logger.error('VoiceService', `Server error: ${JSON.stringify(message.error)}`);
        this.callbacks.onError?.(message.error.message || 'Server error');
      }
    } catch (error: any) {
      logger.error('VoiceService', `Error handling SDK message: ${error.message}`);
    }
  }

  /** Process tool calls from the model */
  private handleToolCalls(functionCalls: any[]): void {
    for (const fn of functionCalls) {
      logger.info('VoiceService', `🎯 Tool call: ${fn.name}(${JSON.stringify(fn.args)}) [id=${fn.id}]`);
      this.callbacks.onToolCall?.({
        name: fn.name,
        args: fn.args || {},
        id: fn.id,
      });
    }
  }

  private audioResponseCount = 0;

  /** Process server content (audio responses, transcripts, turn events) */
  private handleServerContent(content: any): void {
    // Log all keys for full visibility
    const contentKeys = Object.keys(content || {}).join(', ');
    logger.debug('VoiceService', `📦 serverContent keys: [${contentKeys}]`);

    // Turn complete
    if (content.turnComplete) {
      logger.info('VoiceService', `🏁 Turn complete (audioChunks sent: ${this.audioResponseCount})`);
      this.audioResponseCount = 0;
      this.callbacks.onTurnComplete?.();
    }

    // Model output parts (audio + optional thinking text)
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.audioResponseCount++;
          if (this.audioResponseCount <= 3 || this.audioResponseCount % 20 === 0) {
            logger.info('VoiceService', `🔊 Audio chunk #${this.audioResponseCount}: ${part.inlineData.data.length} b64 chars, mime=${part.inlineData.mimeType || 'unknown'}`);
          }
          this.callbacks.onAudioResponse?.(part.inlineData.data);
        }
        if (part.text) {
          logger.info('VoiceService', `🤖 MODEL: "${part.text}"`);
          this.callbacks.onTranscript?.(part.text, true, 'model');
        }
      }
    }

    // Input transcription (user's speech-to-text)
    if (content.inputTranscription?.text) {
      logger.info('VoiceService', `🗣️ USER (voice): "${content.inputTranscription.text}"`);
      this.callbacks.onTranscript?.(content.inputTranscription.text, true, 'user');
    }

    // Output transcription (model's speech-to-text)
    if (content.outputTranscription?.text) {
      logger.info('VoiceService', `🤖 MODEL (voice): "${content.outputTranscription.text}"`);
      this.callbacks.onTranscript?.(content.outputTranscription.text, true, 'model');
    }

    // Tool calls inside serverContent (some SDK versions deliver here)
    if (content.toolCall?.functionCalls) {
      this.handleToolCalls(content.toolCall.functionCalls);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private setStatus(newStatus: VoiceStatus): void {
    this._status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }
}

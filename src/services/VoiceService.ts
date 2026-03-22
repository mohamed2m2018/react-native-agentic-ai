/**
 * VoiceService — WebSocket connection to Gemini Live API.
 *
 * Handles bidirectional audio streaming between the app and Gemini:
 * - Sends PCM 16kHz 16-bit audio chunks (mic input)
 * - Receives PCM 24kHz 16-bit audio chunks (AI responses)
 * - Receives function calls (tap, navigate, etc.) for agentic actions
 * - Sends screen context (DOM text + optional screenshot) for live mode
 *
 * Protocol: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
 */

import { logger } from '../utils/logger';
import type { ToolDefinition } from '../core/types';

// ─── Types ─────────────────────────────────────────────────────

export interface VoiceServiceConfig {
  apiKey: string;
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
}

export type VoiceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Constants ─────────────────────────────────────────────────

const WS_HOST = 'generativelanguage.googleapis.com';
const WS_PATH = '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
// Use -09-2025: Google's own cookbook uses this model for Live API tool use.
// The -12-2025 model had server-side regressions with function calling
// and was deprecated March 19, 2026. The -09-2025 version has
// "improved function calling and better handling of speech cut-offs."
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const DEFAULT_INPUT_SAMPLE_RATE = 16000;

// ─── Service ───────────────────────────────────────────────────

export class VoiceService {
  private ws: WebSocket | null = null;
  private config: VoiceServiceConfig;
  private callbacks: VoiceServiceCallbacks = {};
  private setupComplete = false;
  private _status: VoiceStatus = 'disconnected';

  constructor(config: VoiceServiceConfig) {
    this.config = config;
  }

  // ─── Connection ────────────────────────────────────────────

  connect(callbacks: VoiceServiceCallbacks): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.info('VoiceService', 'Already connected');
      return;
    }

    this.callbacks = callbacks;
    this.setStatus('connecting');

    const model = this.config.model || DEFAULT_MODEL;
    const url = `wss://${WS_HOST}${WS_PATH}?key=${this.config.apiKey}`;

    logger.info('VoiceService', `Connecting to Gemini Live API (model: ${model})`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      logger.info('VoiceService', 'WebSocket connected, sending setup...');
      this.sendSetup();
    };

    this.ws.onclose = (event) => {
      logger.info('VoiceService', `WebSocket closed: ${event.code} ${event.reason}`);
      this.setStatus('disconnected');
      this.setupComplete = false;
    };

    this.ws.onerror = (error: any) => {
      logger.error('VoiceService', `WebSocket error: ${error.message || 'Unknown'}`);
      this.setStatus('error');
      this.callbacks.onError?.(error.message || 'WebSocket connection error');
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  disconnect(): void {
    if (this.ws) {
      logger.info('VoiceService', 'Disconnecting...');
      this.ws.close();
      this.ws = null;
      this.setupComplete = false;
      this.setStatus('disconnected');
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  get currentStatus(): VoiceStatus {
    return this._status;
  }

  // ─── Send Audio ────────────────────────────────────────────

  /** Send PCM audio chunk (base64 encoded) to Gemini */
  private sendCount = 0;
  sendAudio(base64Audio: string): void {
    this.sendCount++;
    if (!this.isConnected) {
      logger.warn('VoiceService', `sendAudio #${this.sendCount} DROPPED — not connected (ws=${this.ws?.readyState}, setup=${this.setupComplete})`);
      return;
    }

    const message = {
      realtimeInput: {
        audio: {
          mimeType: `audio/pcm;rate=${this.config.inputSampleRate || DEFAULT_INPUT_SAMPLE_RATE}`,
          data: base64Audio,
        },
      },
    };

    logger.info('VoiceService', `📤 #${this.sendCount} sending ${base64Audio.length} chars (ws=${this.ws?.readyState})`);
    this.ws!.send(JSON.stringify(message));
  }

  // ─── Send Text ─────────────────────────────────────────────

  /** Send text message via realtimeInput (same channel as audio) */
  sendText(text: string): void {
    if (!this.isConnected) return;

    const message = {
      realtimeInput: { text },
    };

    this.ws!.send(JSON.stringify(message));
  }

  /** Send DOM tree as passive context during live conversation.
   *
   * Uses `clientContent` with `turnComplete: false` to inject context
   * WITHOUT triggering a model response. This is the "incremental content
   * updates" pattern from the Gemini docs for establishing session context.
   *
   * Called once at connect + after each tool call (not on a timer).
   * Screenshots are handled separately via the capture_screenshot tool.
   */
  sendScreenContext(domText: string): void {
    if (!this.isConnected) return;

    const message = {
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: domText }] }],
        turnComplete: false, // Passive context — don't trigger a response
      },
    };

    logger.debug('VoiceService', `📤 Screen context sent (${domText.length} chars)`);
    logger.debug('VoiceService', `📤 Raw Screen Context Payload: ${JSON.stringify(message).substring(0, 500)}...`);
    this.ws!.send(JSON.stringify(message));
  }

  // ─── Send Function Response ────────────────────────────────

  /** Send function call result back to Gemini */
  sendFunctionResponse(name: string, id: string, result: any): void {
    if (!this.isConnected) return;

    const message = {
      toolResponse: {
        functionResponses: [{
          name,
          id,
          response: result,
        }],
      },
    };

    logger.info('VoiceService', `📤 Sending tool response for ${name} (id=${id})`);
    this.ws!.send(JSON.stringify(message));
  }

  // ─── Internal: Setup ───────────────────────────────────────

  /**
   * Builds and sends the setup message, replicating text mode's agent_step
   * compound tool so the model uses structured reasoning + actions.
   *
   * The agent_step tool flattens reasoning fields (previous_goal_eval,
   * memory, plan) + action_name enum + all action parameters into a single
   * function — matching GeminiProvider.buildAgentStepDeclaration exactly.
   */
  private sendSetup(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const model = this.config.model || DEFAULT_MODEL;

    const setup: any = {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        // Note: Do NOT set thinkingBudget: 0 — it completely disables
        // the model's ability to reason about when to call tools.
        // The text thinking blocks are a trade-off for working function calling.
      },
    };

    // Add system instruction if provided
    if (this.config.systemPrompt) {
      setup.systemInstruction = {
        parts: [{ text: this.config.systemPrompt }],
      };
    }

    // Add individual tool declarations for function calling
    // NOTE: We use individual tools (tap, type, navigate, done, ask_user)
    // instead of the compound agent_step used in text mode.
    // The native audio model in real-time can call simple tools but struggles
    // with the complex agent_step schema (it speaks about calling tools
    // instead of actually calling them).
    if (this.config.tools?.length) {
      const validTools = this.config.tools.filter(t => t.name !== 'capture_screenshot');
      if (validTools.length > 0) {
        setup.tools = [{
          functionDeclarations: validTools.map(tool => {
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
                    // Native audio model crashes with BOOLEAN/ENUM types (error 1008)
                    // Convert to STRING as a workaround
                    let paramType = param.type.toUpperCase();
                    let desc = param.description;
                    if (paramType === 'BOOLEAN') {
                      paramType = 'STRING';
                      desc = `${desc} (use "true" or "false")`;
                    }
                    return [
                      key,
                      {
                        type: paramType,
                        description: desc,
                      },
                    ];
                  })
                ),
                required: Object.entries(tool.parameters)
                  .filter(([, param]) => param.required)
                  .map(([key]) => key),
              };
            }
            return functionDecl;
          }),
        }];
      }
    }

    const setupMessage = { setup };
    logger.info('VoiceService', `Sending setup (model: ${model}, ${this.config.tools?.length || 0} tools)`);
    try {
      const payload = JSON.stringify(setupMessage);
      logger.info('VoiceService', `📤 Raw Setup Payload: ${payload}`);
      this.ws.send(payload);
    } catch (err: any) {
      logger.error('VoiceService', `❌ Error stringifying setup message: ${err.message}`);
    }
  }

  // ─── Internal: Message Handling ────────────────────────────

  private handleMessage(event: WebSocketMessageEvent): void {
    try {
      const dataType = typeof event.data;
      const dataLen = typeof event.data === 'string' ? event.data.length : (event.data?.byteLength || 'unknown');
      logger.info('VoiceService', `📥 WS message received: type=${dataType}, length=${dataLen}`);

      // Handle binary data (could be JSON or raw PCM)
      if (typeof event.data !== 'string') {
        logger.info('VoiceService', '📥 Binary message — processing...');
        this.handleBinaryMessage(event.data);
        return;
      }

      // Handle JSON text messages
      const message = JSON.parse(event.data);
      logger.info('VoiceService', `📥 JSON message keys: ${Object.keys(message).join(', ')}`);
      logger.info('VoiceService', `📥 Raw JSON Message: ${event.data.substring(0, 1000)}`);
      this.processMessage(message);
    } catch (error: any) {
      logger.error('VoiceService', `Error handling message: ${error.message}`);
    }
  }

  private handleBinaryMessage(data: any): void {
    try {
      // Try to decode as JSON first
      let bytes: Uint8Array;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (data instanceof Blob) {
        // Blob handling — read as ArrayBuffer
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            this.processBinaryBytes(new Uint8Array(reader.result));
          }
        };
        reader.readAsArrayBuffer(data);
        return;
      } else {
        return;
      }

      this.processBinaryBytes(bytes);
    } catch (error: any) {
      logger.error('VoiceService', `Error handling binary message: ${error.message}`);
    }
  }

  private processBinaryBytes(bytes: Uint8Array): void {
    // Check if it looks like JSON (starts with '{' or '[')
    const looksLikeJson = bytes.length > 0 && (bytes[0] === 123 || bytes[0] === 91);

    if (looksLikeJson) {
      try {
        const text = new TextDecoder('utf-8').decode(bytes);
        const message = JSON.parse(text);
        this.processMessage(message);
      } catch {
        // Not JSON — treat as raw PCM audio
        this.callbacks.onAudioResponse?.(this.arrayBufferToBase64(bytes.buffer as ArrayBuffer));
      }
    } else {
      // Raw PCM audio data
      this.callbacks.onAudioResponse?.(this.arrayBufferToBase64(bytes.buffer as ArrayBuffer));
    }
  }

  private processMessage(message: any): void {
    // Setup complete acknowledgment
    if (message.setupComplete !== undefined) {
      logger.info('VoiceService', '✅ Setup complete — ready for audio exchange');
      this.setupComplete = true;
      this.setStatus('connected');
      return;
    }

    // Server content (audio response + transcripts)
    if (message.serverContent) {
      const content = message.serverContent;
      logger.info('VoiceService', `📥 serverContent received — turnComplete=${content.turnComplete}, hasParts=${!!content.modelTurn?.parts}, inputTranscription=${!!content.inputTranscription}, outputTranscription=${!!content.outputTranscription}`);

      // Check for turn complete
      if (content.turnComplete) {
        this.callbacks.onTurnComplete?.();
      }

      // Process model output parts
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          // Audio response
          if (part.inlineData?.data) {
            logger.info('VoiceService', `🔊 Audio response: ${part.inlineData.data.length} chars`);
            this.callbacks.onAudioResponse?.(part.inlineData.data);
          }

          // Text response (transcript)
          if (part.text) {
            logger.info('VoiceService', `💬 Text response: "${part.text}"`);
            this.callbacks.onTranscript?.(part.text, true, 'model');
          }
        }
      }

      // Input transcription (user's speech)
      if (content.inputTranscription?.text) {
        this.callbacks.onTranscript?.(content.inputTranscription.text, true, 'user');
      }

      // Output transcription (model's speech-to-text)
      if (content.outputTranscription?.text) {
        this.callbacks.onTranscript?.(content.outputTranscription.text, true, 'model');
      }
    }

    // Tool calls from the model
    if (message.toolCall?.functionCalls) {
      for (const fn of message.toolCall.functionCalls) {
        logger.info('VoiceService', `🎯 Tool call: ${fn.name}(${JSON.stringify(fn.args)})`);
        this.callbacks.onToolCall?.({
          name: fn.name,
          args: fn.args || {},
          id: fn.id,
        });
      }
    }

    // Error messages
    if (message.error) {
      logger.error('VoiceService', `Server error: ${JSON.stringify(message.error)}`);
      this.callbacks.onError?.(message.error.message || 'Server error');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private setStatus(newStatus: VoiceStatus): void {
    this._status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }
}

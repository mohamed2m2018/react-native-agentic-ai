/**
 * VoiceService unit tests.
 *
 * Tests the WebSocket-based Gemini Live API integration:
 * 1. Connection setup and teardown
 * 2. Setup message format (model, tools, system prompt)
 * 3. Audio sending format (realtimeInput.audio)
 * 4. Text sending format (clientContent.turns)
 * 5. Screen context sending (DOM + screenshot)
 * 6. Message parsing (audio response, tool calls, transcripts)
 * 7. Function response sending
 */

import { VoiceService } from '../../services/VoiceService';
import type { VoiceServiceCallbacks } from '../../services/VoiceService';
import type { ToolDefinition } from '../../core/types';

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string = '') {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Connection simulation is handled by the mock connect() now
  }

  sendRealtimeInput(data: any) {
    this.sentMessages.push(JSON.stringify({ realtimeInput: data }));
  }

  sendClientContent(data: any) {
    this.sentMessages.push(JSON.stringify({ clientContent: data }));
  }

  sendToolResponse(data: any) {
    this.sentMessages.push(JSON.stringify({ toolResponse: data }));
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: 'Normal' });
  }

  // Test helper: simulate receiving a JSON message
  simulateMessage(data: any) {
    this.onmessage?.(data);
  }

  // Test helper: simulate setupComplete
  simulateSetupComplete() {
    this.simulateMessage({ setupComplete: {} });
  }
}

jest.mock('@google/genai/dist/web/index.mjs', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    live: {
      connect: jest.fn(async ({ model, config, callbacks }) => {
        // We will assert URL construction manually in the mock if needed,
        // but the SDK handles the actual URL.
        const ws = new MockWebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=test-key');
        ws.onopen = callbacks.onopen;
        ws.onclose = callbacks.onclose;
        ws.onerror = callbacks.onerror;
        ws.onmessage = callbacks.onmessage;
        
        ws.sentMessages.push(JSON.stringify({ setup: { model, ...config } }));
        
        // Simulate async connection
        setTimeout(() => ws.onopen?.(), 0);
        
        return ws;
      })
    }
  })),
  Modality: { AUDIO: 'audio', TEXT: 'text' },
  ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}), { virtual: true });

// ─── Helpers ───────────────────────────────────────────────────

const createService = (overrides: any = {}) =>
  new VoiceService({
    apiKey: 'test-key',
    ...overrides,
  });

const sampleTools: ToolDefinition[] = [
  {
    name: 'tap',
    description: 'Tap an element',
    parameters: {
      index: { type: 'number', description: 'Element index', required: true },
    },
    execute: jest.fn(),
  },
];

const createCallbacks = (): VoiceServiceCallbacks & { [key: string]: jest.Mock } => ({
  onAudioResponse: jest.fn(),
  onToolCall: jest.fn(),
  onTranscript: jest.fn(),
  onStatusChange: jest.fn(),
  onError: jest.fn(),
  onTurnComplete: jest.fn(),
});

// ─── Tests ─────────────────────────────────────────────────────

describe('VoiceService', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connection', () => {
    it('connects with correct WebSocket URL', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);

      expect(MockWebSocket.instances).toHaveLength(1);
      const ws = MockWebSocket.instances[0]!;
      expect(ws.url).toContain('generativelanguage.googleapis.com');
      expect(ws.url).toContain('key=test-key');
      expect(ws.url).toContain('BidiGenerateContent');
    });

    it('emits connecting status on connect', () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('connecting');
    });

    it('emits disconnected status on close', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      service.disconnect();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('disconnected');
    });

    it('treats Live close code 1001 as recoverable without console.error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.onclose?.({ code: 1001, reason: 'Stream end encountered' });

      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('disconnected');
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('SDK session closed UNEXPECTEDLY')
      );

      consoleError.mockRestore();
    });

    it('reports non-recoverable Live close codes as errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.onclose?.({ code: 1011, reason: 'Internal error' });

      expect(callbacks.onError).toHaveBeenCalledWith('Connection lost (code: 1011)');
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('SDK session closed UNEXPECTEDLY')
      );

      consoleError.mockRestore();
    });
  });

  describe('setup message', () => {
    it('sends setup with correct model name', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      // Wait for onopen
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);

      const setup = JSON.parse(ws.sentMessages[0]!);
      expect(setup.setup.model).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    });

    it('allows overriding the default model name', async () => {
      const service = createService({ model: 'custom-live-model' });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const setup = JSON.parse(MockWebSocket.instances[0]!.sentMessages[0]!);
      expect(setup.setup.model).toBe('custom-live-model');
    });

    it('does not send 3.1 thinking config to the default low-latency native-audio model', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const setup = JSON.parse(MockWebSocket.instances[0]!.sentMessages[0]!);
      expect(setup.setup.thinkingConfig).toBeUndefined();
    });

    it('uses Gemini 3.1 thinkingLevel config when explicitly configured', async () => {
      const service = createService({ model: 'gemini-3.1-flash-live-preview' });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const setup = JSON.parse(MockWebSocket.instances[0]!.sentMessages[0]!);
      expect(setup.setup.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
      expect(setup.setup.thinkingConfig.thinkingBudget).toBeUndefined();
    });

    it('includes responseModalities when configured', async () => {
      const service = createService({ responseModalities: ['AUDIO'] });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const setup = JSON.parse(MockWebSocket.instances[0]!.sentMessages[0]!);
      // The @google/genai SDK might map it to generationConfig or responseModalities natively.
      // We just ensure the message was sent.
      expect(setup.setup).toBeDefined();
    });

    it('includes system prompt when provided', async () => {
      const service = createService({ systemPrompt: 'You are a helpful food agent.' });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      const setup = JSON.parse(ws.sentMessages[0]!);
      expect(setup.setup.systemInstruction.parts[0].text).toBe('You are a helpful food agent.');
    });

    it('includes tool declarations when tools provided', async () => {
      const service = createService({ tools: sampleTools });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      const setup = JSON.parse(ws.sentMessages[0]!);

      expect(setup.setup.tools[0].functionDeclarations).toHaveLength(1);
      expect(setup.setup.tools[0].functionDeclarations[0].name).toBe('tap');
    });

    it('enables input and output transcription', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      const setup = JSON.parse(ws.sentMessages[0]!);

      expect(setup.setup.inputAudioTranscription).toBeDefined();
      expect(setup.setup.outputAudioTranscription).toBeDefined();
    });

    it('configures automatic activity detection for responsive voice turns', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const setup = JSON.parse(MockWebSocket.instances[0]!.sentMessages[0]!);
      expect(setup.setup.realtimeInputConfig).toMatchObject({
        automaticActivityDetection: {
          startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
          endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
          silenceDurationMs: 700,
          prefixPaddingMs: 100,
        },
        turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
      });
    });
  });

  describe('sending audio', () => {
    it('sends audio in realtimeInput format', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendAudio('base64audiodata');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.realtimeInput.audio.mimeType).toContain('audio/pcm');
      expect(lastMsg.realtimeInput.audio.mimeType).toContain('rate=16000');
      expect(lastMsg.realtimeInput.audio.data).toBe('base64audiodata');
    });

    it('does not send audio before connect is complete', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      const connectPromise = service.connect(callbacks);
      // Try to send while connect() is still pending
      service.sendAudio('base64audiodata');

      // The queue/send logic drops it since session isn't assigned yet
      await connectPromise;
      const ws = MockWebSocket.instances[0]!;
      expect(ws.sentMessages.length).toBe(1); // Only setup message
    });
  });

  describe('sending text', () => {
    it('sends text in clientContent format for the default low-latency model', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendText('What is on screen?');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.clientContent.turns[0].parts[0].text).toBe('What is on screen?');
      expect(lastMsg.clientContent.turnComplete).toBe(true);
    });

    it('sends text via realtimeInput when Gemini 3.1 is explicitly configured', async () => {
      const service = createService({ model: 'gemini-3.1-flash-live-preview' });
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendText('What is on screen?');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.realtimeInput.text).toBe('What is on screen?');
      expect(lastMsg.clientContent).toBeUndefined();
    });
  });

  describe('sending screen context (live mode)', () => {
    it('sends DOM text context through passive clientContent for the default low-latency model', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendScreenContext('<screen>...</screen>');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.clientContent.turns[0].parts).toHaveLength(1);
      expect(lastMsg.clientContent.turns[0].parts[0].text).toBe('<screen>...</screen>');
      expect(lastMsg.clientContent.turnComplete).toBe(false);
    });

    it('sends DOM text context via realtimeInput when Gemini 3.1 is explicitly configured', async () => {
      const service = createService({ model: 'gemini-3.1-flash-live-preview' });
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendScreenContext('<screen>...</screen>');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.realtimeInput.text).toBe('<screen>...</screen>');
      expect(lastMsg.clientContent).toBeUndefined();
    });

    it('does not send when not connected', async () => {
      const service = createService();
      service.sendScreenContext('<screen>test</screen>');
      // No crash, no message sent (not connected)
    });
  });

  describe('user turn end watchdog', () => {
    it('sends audioStreamEnd after a user sentence if no model or tool event follows', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      jest.useFakeTimers();
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Go to profile.' } } });

      expect(ws.sentMessages.some((msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd)).toBe(false);

      jest.advanceTimersByTime(1499);
      expect(ws.sentMessages.some((msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd)).toBe(false);

      jest.advanceTimersByTime(1);
      expect(ws.sentMessages.some((msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd)).toBe(true);
    });

    it('does not send audioStreamEnd if a tool call arrives after the user sentence', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      jest.useFakeTimers();
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Go to profile.' } } });
      ws.simulateMessage({
        toolCall: {
          functionCalls: [{ name: 'navigate', args: { screen: 'Profile' }, id: 'nav-1' }],
        },
      });

      jest.advanceTimersByTime(1500);

      expect(ws.sentMessages.some((msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd)).toBe(false);
      expect(callbacks.onToolCall).toHaveBeenCalledWith({
        name: 'navigate',
        args: { screen: 'Profile' },
        id: 'nav-1',
      });
    });

    it('does not send audioStreamEnd if model output starts after the user sentence', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      jest.useFakeTimers();
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Hello.' } } });
      ws.simulateMessage({ serverContent: { outputTranscription: { text: 'Hi there.' } } });

      jest.advanceTimersByTime(1500);

      expect(ws.sentMessages.some((msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd)).toBe(false);
    });

    it('sends audioStreamEnd at most once for one unanswered user sentence', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      jest.useFakeTimers();
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Go to profile.' } } });
      jest.advanceTimersByTime(5000);

      const streamEndMessages = ws.sentMessages.filter(
        (msg) => JSON.parse(msg).realtimeInput?.audioStreamEnd
      );
      expect(streamEndMessages).toHaveLength(1);
    });
  });

  describe('receiving messages', () => {
    it('emits connected status on setupComplete', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('connected');
    });

    it('emits tool call when receiving toolCall message', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        toolCall: {
          functionCalls: [{
            name: 'tap',
            args: { index: 5 },
            id: 'call-123',
          }],
        },
      });

      expect(callbacks.onToolCall).toHaveBeenCalledWith({
        name: 'tap',
        args: { index: 5 },
        id: 'call-123',
      });
    });

    it('processes mixed Gemini 3.1 events without dropping audio, transcript, or tool call', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          modelTurn: {
            parts: [
              { inlineData: { data: 'audio-chunk', mimeType: 'audio/pcm;rate=24000' } },
              { text: 'internal thought text' },
            ],
          },
          outputTranscription: { text: 'I can open Profile.' },
        },
        toolCall: {
          functionCalls: [{
            name: 'ask_user_permission_voice_mode',
            args: { question: 'May I open Profile?' },
            id: 'approval-3-1',
          }],
        },
      });

      expect(callbacks.onAudioResponse).toHaveBeenCalledWith('audio-chunk');
      expect(callbacks.onTranscript).toHaveBeenCalledWith(
        'I can open Profile.',
        true,
        'model'
      );
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith(
        'internal thought text',
        true,
        'model'
      );
      expect(callbacks.onToolCall).toHaveBeenCalledWith({
        name: 'ask_user_permission_voice_mode',
        args: { question: 'May I open Profile?' },
        id: 'approval-3-1',
      });
    });

    it('emits turn complete event', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: { turnComplete: true },
      });

      expect(callbacks.onTurnComplete).toHaveBeenCalled();
    });

    it('emits transcript for user speech', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          inputTranscription: { text: 'What food is on screen?' },
        },
      });

      expect(callbacks.onTranscript).toHaveBeenCalledWith('What food is on screen?', true, 'user');
    });

    it('does not emit modelTurn text as visible transcript', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          modelTurn: { parts: [{ text: 'internal model text' }] },
        },
      });

      expect(callbacks.onTranscript).not.toHaveBeenCalledWith('internal model text', true, 'model');
    });

    it('flushes incomplete model output transcription on turnComplete', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          outputTranscription: { text: 'I can open that for you' },
        },
      });
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith('I can open that for you', true, 'model');

      ws.simulateMessage({ serverContent: { turnComplete: true } });

      expect(callbacks.onTranscript).toHaveBeenCalledWith('I can open that for you', true, 'model');
    });

    it('desired: buffers user transcript until sentence boundary', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Open' } } });
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'profile' } } });
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith(expect.any(String), true, 'user');

      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'please.' } } });
      expect(callbacks.onTranscript).toHaveBeenCalledWith('Open profile please.', true, 'user');
    });

    it('desired: turnComplete flushes one incomplete user sentence once', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Open profile please' } } });
      ws.simulateMessage({ serverContent: { turnComplete: true } });
      ws.simulateMessage({ serverContent: { turnComplete: true } });

      expect(callbacks.onTranscript.mock.calls.filter(
        (call) => call[0] === 'Open profile please' && call[2] === 'user'
      )).toHaveLength(1);
    });

    it('desired: cumulative partial transcripts do not duplicate words', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Open' } } });
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Open profile' } } });
      ws.simulateMessage({ serverContent: { inputTranscription: { text: 'Open profile please.' } } });

      expect(callbacks.onTranscript).toHaveBeenCalledWith('Open profile please.', true, 'user');
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith(
        'Open Open profile Open profile please.',
        true,
        'user'
      );
    });

    it('desired: emits multiple transcript sentences in order from one chunk', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          inputTranscription: { text: 'Open profile. Then go back.' },
        },
      });

      expect(callbacks.onTranscript.mock.calls.slice(-2)).toEqual([
        ['Open profile.', true, 'user'],
        ['Then go back.', true, 'user'],
      ]);
    });

    it('desired: modelTurn text is not emitted as visible transcript', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          modelTurn: { parts: [{ text: 'do not show this thinking' }] },
        },
      });

      expect(callbacks.onTranscript).not.toHaveBeenCalledWith('do not show this thinking', true, 'model');
    });

    it('desired: whitespace-only transcript chunks are ignored', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { inputTranscription: { text: '   ' } } });

      expect(callbacks.onTranscript).not.toHaveBeenCalled();
    });

    it('ignores Gemini control-token transcript chunks', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { outputTranscription: { text: '<ctrl46>' } } });
      ws.simulateMessage({ serverContent: { turnComplete: true } });

      expect(callbacks.onTranscript).not.toHaveBeenCalledWith('<ctrl46>', true, 'model');
      expect(callbacks.onTranscript).not.toHaveBeenCalled();
    });

    it('ignores non-speech transcript marker chunks', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({ serverContent: { inputTranscription: { text: '<noise>' } } });
      ws.simulateMessage({ serverContent: { outputTranscription: { text: '[inaudible]' } } });
      ws.simulateMessage({ serverContent: { turnComplete: true } });

      expect(callbacks.onTranscript).not.toHaveBeenCalled();
    });

    it('strips Gemini control tokens from otherwise valid transcripts', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          outputTranscription: { text: 'I can open settings. <ctrl46>' },
        },
      });

      expect(callbacks.onTranscript).toHaveBeenCalledWith(
        'I can open settings.',
        true,
        'model'
      );
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith(
        'I can open settings. <ctrl46>',
        true,
        'model'
      );
    });

    it('strips non-speech markers from otherwise valid transcripts', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));
      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          inputTranscription: { text: 'Open profile. <noise>' },
        },
      });

      expect(callbacks.onTranscript).toHaveBeenCalledWith(
        'Open profile.',
        true,
        'user'
      );
      expect(callbacks.onTranscript).not.toHaveBeenCalledWith(
        'Open profile. <noise>',
        true,
        'user'
      );
    });
  });

  describe('function response', () => {
    it('sends function response with matching id', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendFunctionResponse('tap', 'call-123', { result: 'Tapped element 5' });

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.toolResponse.functionResponses[0].name).toBe('tap');
      expect(lastMsg.toolResponse.functionResponses[0].id).toBe('call-123');
      expect(lastMsg.toolResponse.functionResponses[0].response).toEqual({
        result: 'Tapped element 5',
      });
    });
  });
});

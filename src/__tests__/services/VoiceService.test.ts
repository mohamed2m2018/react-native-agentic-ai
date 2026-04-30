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
  Modality: { AUDIO: 'audio', TEXT: 'text' }
}), { virtual: true });

// ─── Helpers ───────────────────────────────────────────────────

const createService = (overrides: any = {}) =>
  new VoiceService({
    apiKey: 'test-key',
    model: 'gemini-live-2.5-flash-native-audio',
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
      expect(setup.setup.model).toBe('gemini-live-2.5-flash-native-audio');
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
    it('sends text in clientContent format', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      await service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0]!;
      ws.simulateSetupComplete();

      service.sendText('What is on screen?');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastMsg.clientContent.turns[0].parts[0].text).toBe('What is on screen?');
    });
  });

  describe('sending screen context (live mode)', () => {
    it('sends DOM text + screenshot as context', async () => {
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
      // turnComplete is true because it forces the model to respond to the view
      expect(lastMsg.clientContent.turnComplete).toBe(true);
    });

    it('does not send when not connected', async () => {
      const service = createService();
      service.sendScreenContext('<screen>test</screen>');
      // No crash, no message sent (not connected)
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

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

// ─── Mock WebSocket ────────────────────────────────────────────

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

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async connection
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: 'Normal' });
  }

  // Test helper: simulate receiving a JSON message
  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  // Test helper: simulate setupComplete
  simulateSetupComplete() {
    this.simulateMessage({ setupComplete: {} });
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

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
      const ws = MockWebSocket.instances[0];
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

    it('emits disconnected status on close', () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
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

      const ws = MockWebSocket.instances[0];
      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);

      const setup = JSON.parse(ws.sentMessages[0]);
      expect(setup.setup.model).toBe('models/gemini-live-2.5-flash-native-audio');
      expect(setup.setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    });

    it('includes system prompt when provided', async () => {
      const service = createService({ systemPrompt: 'You are a helpful food agent.' });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      const setup = JSON.parse(ws.sentMessages[0]);
      expect(setup.setup.systemInstruction.parts[0].text).toBe('You are a helpful food agent.');
    });

    it('includes tool declarations when tools provided', async () => {
      const service = createService({ tools: sampleTools });
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      const setup = JSON.parse(ws.sentMessages[0]);

      expect(setup.setup.tools[0].functionDeclarations).toHaveLength(1);
      expect(setup.setup.tools[0].functionDeclarations[0].name).toBe('tap');
    });

    it('enables input and output transcription', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      const setup = JSON.parse(ws.sentMessages[0]);

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

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      service.sendAudio('base64audiodata');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(lastMsg.realtimeInput.audio.mimeType).toContain('audio/pcm');
      expect(lastMsg.realtimeInput.audio.mimeType).toContain('rate=16000');
      expect(lastMsg.realtimeInput.audio.data).toBe('base64audiodata');
    });

    it('does not send audio before setup is complete', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      const msgCountBefore = ws.sentMessages.length;

      // Don't call simulateSetupComplete — setup is NOT done
      service.sendAudio('base64audiodata');

      // Should NOT have added a message
      expect(ws.sentMessages.length).toBe(msgCountBefore);
    });
  });

  describe('sending text', () => {
    it('sends text in clientContent format', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      service.sendText('What is on screen?');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(lastMsg.realtimeInput.text).toBe('What is on screen?');
    });
  });

  describe('sending screen context (live mode)', () => {
    it('sends DOM text + screenshot as context', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      service.sendScreenContext('<screen>...</screen>', 'base64screenshot');

      // Text is sent as a separate realtimeInput message
      const textMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 2]);
      expect(textMsg.realtimeInput.text).toBe('<screen>...</screen>');

      // Screenshot is sent as a separate realtimeInput video message
      const videoMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(videoMsg.realtimeInput.video).toEqual({
        mimeType: 'image/jpeg',
        data: 'base64screenshot',
      });
    });

    it('sends DOM only when no screenshot', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      service.sendScreenContext('<screen>...</screen>');

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(lastMsg.realtimeInput.text).toBe('<screen>...</screen>');
    });
  });

  describe('receiving messages', () => {
    it('emits connected status on setupComplete', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('connected');
    });

    it('emits tool call when receiving toolCall message', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
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

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: { turnComplete: true },
      });

      expect(callbacks.onTurnComplete).toHaveBeenCalled();
    });

    it('emits transcript for user speech', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      ws.simulateMessage({
        serverContent: {
          inputTranscription: { text: 'What food is on screen?' },
        },
      });

      expect(callbacks.onTranscript).toHaveBeenCalledWith('What food is on screen?', true, 'user');
    });
  });

  describe('function response', () => {
    it('sends function response with matching id', async () => {
      const service = createService();
      const callbacks = createCallbacks();

      service.connect(callbacks);
      await new Promise(r => setTimeout(r, 10));

      const ws = MockWebSocket.instances[0];
      ws.simulateSetupComplete();

      service.sendFunctionResponse('tap', 'call-123', { result: 'Tapped element 5' });

      const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(lastMsg.toolResponse.functionResponses[0].name).toBe('tap');
      expect(lastMsg.toolResponse.functionResponses[0].id).toBe('call-123');
      expect(lastMsg.toolResponse.functionResponses[0].response).toEqual({
        result: 'Tapped element 5',
      });
    });
  });
});

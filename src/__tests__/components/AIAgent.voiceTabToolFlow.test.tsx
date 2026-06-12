import { waitFor } from '@testing-library/react-native';
import {
  audioInputInstances,
  deferAudioInputStop,
  emitConnected,
  emitToolCall,
  flushPromises,
  renderVoiceAgent,
  resetVoiceHarness,
  switchToVoice,
  voiceInstances,
  waitForAudioInput,
  waitForVoiceService,
} from './voiceTabHarness';

async function markUserSpoken() {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await voice.lastCallbacks?.onTranscript?.('Open profile', true, 'user');
  await flushPromises();
}

describe('AIAgent voice tab tool flow', () => {
  beforeEach(() => {
    resetVoiceHarness();
  });

  it('rejects tool calls before user speech without executing runtime tool', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await emitToolCall('tap', { index: 0 }, 'tap-before-user');

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'tap',
      'tap-before-user',
      expect.objectContaining({
        result: expect.stringContaining('wait for the user to speak'),
      })
    );
  });

  it('desired: tool execution waits for mic stop before function response', async () => {
    const stop = deferAudioInputStop();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    let pending: Promise<void> | undefined;
    try {
      pending = voice.lastCallbacks.onToolCall({
        name: 'done',
        args: { text: 'Done', success: true },
        id: 'done-1',
      });
      await flushPromises();

      expect(audioInput.stop).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(voice.sendFunctionResponse).not.toHaveBeenCalled();

      stop.resolve();
      await pending;
      await waitFor(() => expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1));
    } finally {
      stop.resolve();
      await pending?.catch(() => undefined);
    }
  });

  it('desired: mic restarts once after function response if still connected', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    audioInput.start.mockClear();

    await emitToolCall('done', { text: 'Done', success: true }, 'done-2');

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(audioInput.start).toHaveBeenCalledTimes(1);
  });

  it('desired: mic does not restart after tool response if service disconnected during tool', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    audioInput.start.mockClear();
    voice.connected = false;

    await emitToolCall('done', { text: 'Done', success: true }, 'done-3');

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(audioInput.start).not.toHaveBeenCalled();
  });

  it('desired: unknown tools return a safe function response without crash', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitToolCall('unknown_tool', {}, 'unknown-1');

    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'unknown_tool',
      'unknown-1',
      expect.objectContaining({
        result: expect.stringContaining('Unknown tool'),
      })
    );
  });

  it('desired: concurrent tool calls are serialized', async () => {
    const stop = deferAudioInputStop();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    const first = voice.lastCallbacks.onToolCall({
      name: 'done',
      args: { text: 'First', success: true },
      id: 'first',
    });
    const second = voice.lastCallbacks.onToolCall({
      name: 'done',
      args: { text: 'Second', success: true },
      id: 'second',
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).not.toHaveBeenCalledWith(
      'done',
      'second',
      expect.anything()
    );
    stop.resolve();
    await first;
    await second;

    expect(voice.sendFunctionResponse.mock.calls.map((call) => call[1])).toEqual([
      'first',
      'second',
    ]);
  });

  it('desired: audio chunks are not forwarded while a tool call is pending', async () => {
    const stop = deferAudioInputStop();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    const pending = voice.lastCallbacks.onToolCall({
      name: 'done',
      args: { text: 'Done', success: true },
      id: 'pending-tool',
    });
    audioInput.config.onAudioChunk('chunk-while-pending');
    await flushPromises();

    expect(voice.sendAudio).not.toHaveBeenCalledWith('chunk-while-pending');

    stop.resolve();
    await pending;
  });
});

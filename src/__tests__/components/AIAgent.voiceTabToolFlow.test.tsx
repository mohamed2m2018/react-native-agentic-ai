import { act, fireEvent, waitFor } from '@testing-library/react-native';
import {
  audioInputInstances,
  deferAudioInputStop,
  emitAudioResponse,
  emitConnected,
  emitTranscript,
  emitToolCall,
  emitTurnComplete,
  flushPromises,
  renderVoiceAgent,
  resetVoiceHarness,
  switchToVoice,
  waitForAudioInput,
  waitForAudioOutput,
  waitForVoiceService,
} from './voiceTabHarness';

jest.setTimeout(15000);

async function markUserSpoken() {
  await emitTranscript('Open profile', true, 'user');
}

describe('AIAgent voice tab tool flow', () => {
  beforeEach(() => {
    jest.useRealTimers();
    resetVoiceHarness();
  });

  afterEach(() => {
    jest.useRealTimers();
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
      await act(async () => {
        pending = voice.lastCallbacks.onToolCall({
          name: 'done',
          args: { text: 'Done', success: true },
          id: 'done-1',
        });
        await Promise.resolve();
      });
      await flushPromises();

      expect(audioInput.stop).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(voice.sendFunctionResponse).not.toHaveBeenCalled();

      await act(async () => {
        stop.resolve();
        await pending;
      });
      await waitFor(() => expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1));
    } finally {
      await act(async () => {
        stop.resolve();
        await pending?.catch(() => undefined);
      });
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

  it('renders approval UI when a voice UI action arrives before workflow approval', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    await emitToolCall('navigate', { screen: 'Profile' }, 'navigate-direct');

    expect(audioInput.stop).toHaveBeenCalled();
    expect(utils.getByText('I can open Profile. May I proceed?')).toBeTruthy();
    expect(utils.getByText('Open profile')).toBeTruthy();
    expect(utils.getByText('Allow')).toBeTruthy();
    expect(utils.getByText('Don’t Allow')).toBeTruthy();
    expect(voice.sendFunctionResponse).not.toHaveBeenCalled();
  });

  it('executes the original voice UI action after Allow', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitToolCall('navigate', { screen: 'Profile' }, 'navigate-after-allow');
    await act(async () => {
      fireEvent.press(utils.getByText('Allow'));
    });

    await waitFor(
      () =>
        expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
          'navigate',
          'navigate-after-allow',
          expect.objectContaining({
            result: expect.not.stringContaining('APP ACTION BLOCKED'),
          })
        ),
      { timeout: 5000 }
    );
  });

  it('rejects the original voice UI action after Don’t Allow', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitToolCall('navigate', { screen: 'Profile' }, 'navigate-denied');
    await act(async () => {
      fireEvent.press(utils.getByText('Don’t Allow'));
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'navigate',
      'navigate-denied',
      expect.objectContaining({
        result: expect.stringContaining('declined'),
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

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = voice.lastCallbacks.onToolCall({
        name: 'done',
        args: { text: 'First', success: true },
        id: 'first',
      });
      second = voice.lastCallbacks.onToolCall({
        name: 'done',
        args: { text: 'Second', success: true },
        id: 'second',
      });
      await Promise.resolve();
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).not.toHaveBeenCalledWith(
      'done',
      'second',
      expect.anything()
    );
    await act(async () => {
      stop.resolve();
      await first;
      await second;
    });

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

    let pending!: Promise<void>;
    await act(async () => {
      pending = voice.lastCallbacks.onToolCall({
        name: 'done',
        args: { text: 'Done', success: true },
        id: 'pending-tool',
      });
      await Promise.resolve();
    });
    await act(async () => {
      audioInput.config.onAudioChunk('chunk-while-pending');
    });
    await flushPromises();

    expect(voice.sendAudio).not.toHaveBeenCalledWith('chunk-while-pending');

    await act(async () => {
      stop.resolve();
      await pending;
    });
  });

  it('Stop during pending tool execution prevents function response and mic restart', async () => {
    const stop = deferAudioInputStop();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    audioInput.start.mockClear();

    let pending!: Promise<void>;
    await act(async () => {
      pending = voice.lastCallbacks.onToolCall({
        name: 'done',
        args: { text: 'Done', success: true },
        id: 'stop-during-tool',
      });
      await Promise.resolve();
    });
    await flushPromises();

    await act(async () => {
      fireEvent.press(utils.getByLabelText('Stop recording'));
      stop.resolve();
      await pending;
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).not.toHaveBeenCalledWith(
      'done',
      'stop-during-tool',
      expect.anything()
    );
    expect(audioInput.start).not.toHaveBeenCalled();
  });

  it('does not forward raw mic chunks while AI is speaking', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    const audioOutput = await waitForAudioOutput();

    await act(async () => {
      voice.lastCallbacks.onAudioResponse('assistant-audio');
      audioInput.config.onAudioChunk('barge-in-audio');
    });
    await flushPromises();

    expect(audioOutput.stop).not.toHaveBeenCalled();
    expect(voice.sendAudio).not.toHaveBeenCalledWith('barge-in-audio');
  });

  it('keeps mic audio blocked after turnComplete until queued AI playback drains', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    voice.sendAudio.mockClear();

    jest.useFakeTimers();

    await emitAudioResponse('assistant-audio');
    await emitTurnComplete();

    await act(async () => {
      audioInput.config.onAudioChunk('assistant-echo-after-turn-complete');
    });
    expect(voice.sendAudio).not.toHaveBeenCalledWith(
      'assistant-echo-after-turn-complete'
    );

    await act(async () => {
      jest.advanceTimersByTime(901);
    });

    await act(async () => {
      audioInput.config.onAudioChunk('user-after-playback-drain');
    });
    expect(voice.sendAudio).toHaveBeenCalledWith('user-after-playback-drain');
  });

  it('does not block mic audio on turnComplete when no AI audio was queued', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    voice.sendAudio.mockClear();

    await emitTurnComplete();

    await act(async () => {
      audioInput.config.onAudioChunk('user-after-text-only-turn');
    });

    expect(voice.sendAudio).toHaveBeenCalledWith('user-after-text-only-turn');
  });

  it('clears AI speaking guard from queued playback even if turnComplete never arrives', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    voice.sendAudio.mockClear();

    jest.useFakeTimers();

    await emitAudioResponse('assistant-audio-without-turn-complete');

    await act(async () => {
      audioInput.config.onAudioChunk('blocked-while-audio-drains');
    });
    expect(voice.sendAudio).not.toHaveBeenCalledWith(
      'blocked-while-audio-drains'
    );

    await act(async () => {
      jest.advanceTimersByTime(711);
    });

    await act(async () => {
      audioInput.config.onAudioChunk('heard-after-fallback-drain');
    });
    expect(voice.sendAudio).toHaveBeenCalledWith('heard-after-fallback-drain');
  });
});

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import {
  emitAudioResponse,
  emitConnected,
  emitTranscript,
  flushPromises,
  renderVoiceAgent,
  resetVoiceHarness,
  switchToVoice,
  voiceInstances,
  waitForAudioInput,
  waitForAudioOutput,
  waitForVoiceService,
} from './voiceTabHarness';

async function markUserSpoken() {
  await emitTranscript('Open profile', true, 'user');
}

async function emitApprovalToolCall(id = 'approval-1') {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  let pending!: Promise<void>;
  await act(async () => {
    pending = voice.lastCallbacks.onToolCall({
      name: 'ask_user_permission_voice_mode',
      args: {
        question: 'I can open Profile. May I proceed?',
      },
      id,
    });
    await Promise.resolve();
  });
  await flushPromises();
  return pending;
}

describe('AIAgent voice tab approval behavior', () => {
  beforeEach(() => {
    resetVoiceHarness();
  });

  it('voice permission tool renders Allow and Don’t Allow', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const audioInput = await waitForAudioInput();

    await emitApprovalToolCall();

    expect(utils.getByText('I can open Profile. May I proceed?')).toBeTruthy();
    expect(utils.getByText('Allow')).toBeTruthy();
    expect(utils.getByText('Don’t Allow')).toBeTruthy();
    expect(utils.getByText(/permission/i)).toBeTruthy();
    expect(audioInput.stop).toHaveBeenCalled();
  });

  it('registers the voice-only permission tool instead of ask_user', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    const toolNames = voice.config.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('ask_user_permission_voice_mode');
    expect(toolNames).not.toContain('ask_user');
  });

  it('no function response is sent before user taps approval', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall();

    expect(voice.sendFunctionResponse).not.toHaveBeenCalled();
  });

  it('speech during unresolved approval is locally held and not forwarded to Gemini', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    await emitApprovalToolCall('approval-hold');
    await act(async () => {
      audioInput.config.onAudioChunk('speech-during-approval');
    });
    await flushPromises();

    expect(voice.sendAudio).not.toHaveBeenCalledWith('speech-during-approval');
    expect(utils.getByText('Waiting for your approval...')).toBeTruthy();
    expect(voice.sendFunctionResponse).not.toHaveBeenCalled();
  });

  it('Allow sends exactly one human-readable function response with original id', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-allow');
    await act(async () => {
      fireEvent.press(utils.getByText('Allow'));
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'ask_user_permission_voice_mode',
      'approval-allow',
      expect.objectContaining({
        result: expect.not.stringContaining('__APPROVAL_GRANTED__'),
      })
    );
  });

  it('double tapping Allow still sends one response and keeps prior transcript visible', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-double-allow');
    await act(async () => {
      fireEvent.press(utils.getByText('Allow'));
      fireEvent.press(utils.getByText('Allow'));
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(utils.queryByText('Allow')).toBeNull();
    expect(utils.getByText('Open profile')).toBeTruthy();
  });

  it('Don’t Allow sends exactly one rejection response', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-deny');
    await act(async () => {
      fireEvent.press(utils.getByText('Don’t Allow'));
    });
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'ask_user_permission_voice_mode',
      'approval-deny',
      expect.objectContaining({
        result: expect.not.stringContaining('__APPROVAL_REJECTED__'),
      })
    );
  });

  it('approval does not stop audio output, reconnect voice, or restart mic repeatedly', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    const audioOutput = await waitForAudioOutput();
    await emitAudioResponse('existing-audio');
    audioInput.start.mockClear();
    voice.connect.mockClear();

    await emitApprovalToolCall('approval-stability');

    expect(audioOutput.stop).not.toHaveBeenCalled();
    expect(voice.connect).not.toHaveBeenCalled();
    expect(audioInput.start).not.toHaveBeenCalled();
    expect(audioOutput.enqueue).toHaveBeenCalledTimes(1);
  });

  it('approval keeps existing chat history visible', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();

    await emitApprovalToolCall('approval-history');

    expect(utils.getByText('Home Screen')).toBeTruthy();
    expect(utils.getByText('Open profile')).toBeTruthy();
    expect(utils.getByText('I can open Profile. May I proceed?')).toBeTruthy();
    expect(utils.getByText('Allow')).toBeTruthy();
  });

  it('closing overlay rejects once, stops voice, and ignores late audio', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();
    const audioOutput = await waitForAudioOutput();

    await emitApprovalToolCall('approval-cancel');
    audioOutput.enqueue.mockClear();
    await act(async () => {
      fireEvent.press(utils.getByLabelText('Stop AI Agent request'));
    });
    await flushPromises();
    await emitAudioResponse('late-audio-after-stop');

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(audioOutput.enqueue).not.toHaveBeenCalled();
    expect(utils.queryByText('Allow')).toBeNull();
  });

  it('stale approval button clears safely without deadlock', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-stale');
    voice.sendFunctionResponse.mockClear();
    await act(async () => {
      fireEvent.press(utils.getByText('Allow'));
      fireEvent.press(utils.getByText('Allow'));
    });
    await flushPromises();

    expect(voice.sendFunctionResponse.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

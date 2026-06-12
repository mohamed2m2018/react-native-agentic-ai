import { fireEvent, waitFor } from '@testing-library/react-native';
import {
  emitAudioResponse,
  emitConnected,
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
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await voice.lastCallbacks?.onTranscript?.('Open profile', true, 'user');
  await flushPromises();
}

async function emitApprovalToolCall(id = 'approval-1', requestAppAction: any = true) {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  const pending = voice.lastCallbacks.onToolCall({
    name: 'ask_user',
    args: {
      question: 'I can open Profile. May I proceed?',
      request_app_action: requestAppAction,
    },
    id,
  });
  await flushPromises();
  return pending;
}

describe('AIAgent voice tab approval desired behavior', () => {
  beforeEach(() => {
    resetVoiceHarness();
  });

  it('desired: voice ask_user approval renders Allow and Don’t Allow', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();

    await emitApprovalToolCall();

    expect(utils.getByText('Allow')).toBeTruthy();
    expect(utils.getByText('Don’t Allow')).toBeTruthy();
    expect(utils.getByText(/permission/i)).toBeTruthy();
  });

  it('desired: string true request_app_action also renders approval', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();

    await emitApprovalToolCall('approval-string', 'true');

    expect(utils.getByText('Allow')).toBeTruthy();
    expect(utils.getByText('Don’t Allow')).toBeTruthy();
  });

  it('desired: no function response is sent before user taps approval', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall();

    expect(voice.sendFunctionResponse).not.toHaveBeenCalled();
  });

  it('desired: Allow sends exactly one human-readable function response with original id', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-allow');
    fireEvent.press(utils.getByText('Allow'));
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'ask_user',
      'approval-allow',
      expect.objectContaining({
        result: expect.not.stringContaining('__APPROVAL_GRANTED__'),
      })
    );
  });

  it('desired: double tapping Allow still sends one response and one visible user answer', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-double-allow');
    fireEvent.press(utils.getByText('Allow'));
    fireEvent.press(utils.getByText('Allow'));
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(utils.getAllByText('Allow')).toHaveLength(1);
  });

  it('desired: Don’t Allow sends exactly one rejection response', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-deny');
    fireEvent.press(utils.getByText('Don’t Allow'));
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(voice.sendFunctionResponse).toHaveBeenCalledWith(
      'ask_user',
      'approval-deny',
      expect.objectContaining({
        result: expect.not.stringContaining('__APPROVAL_REJECTED__'),
      })
    );
  });

  it('desired: approval does not stop audio output, reconnect voice, or restart mic repeatedly', async () => {
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

  it('desired: approval keeps existing chat history visible', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();

    await emitApprovalToolCall('approval-history');

    expect(utils.getByText('Home Screen')).toBeTruthy();
    expect(utils.getByText('Allow')).toBeTruthy();
  });

  it('desired: closing overlay rejects once and clears approval UI', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-cancel');
    fireEvent.press(utils.getByLabelText('Stop AI Agent request'));
    await flushPromises();

    expect(voice.sendFunctionResponse).toHaveBeenCalledTimes(1);
    expect(utils.queryByText('Allow')).toBeNull();
  });

  it('desired: stale approval button clears safely without deadlock', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await markUserSpoken();
    const voice = await waitForVoiceService();

    await emitApprovalToolCall('approval-stale');
    voice.sendFunctionResponse.mockClear();
    fireEvent.press(utils.getByText('Allow'));
    fireEvent.press(utils.getByText('Allow'));
    await flushPromises();

    expect(voice.sendFunctionResponse.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

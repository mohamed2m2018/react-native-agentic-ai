import { fireEvent, waitFor } from '@testing-library/react-native';
import {
  audioInputInstances,
  audioOutputInstances,
  deferAudioOutputInitialize,
  emitConnected,
  emitDisconnected,
  emitVoiceError,
  flushPromises,
  renderVoiceAgent,
  resetVoiceHarness,
  setAudioInputStartResult,
  switchToText,
  switchToVoice,
  voiceInstances,
  waitForAudioInput,
  waitForAudioOutput,
  waitForVoiceService,
} from './voiceTabHarness';

describe('AIAgent voice tab lifecycle desired behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetVoiceHarness();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not create duplicate services on rerender while still in voice mode', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await waitForVoiceService();

    fireEvent.press(utils.getByLabelText('Minimize AI Agent'));
    fireEvent.press(utils.getByLabelText('Open AI Agent Chat'));

    expect(voiceInstances).toHaveLength(1);
    expect(audioInputInstances).toHaveLength(1);
    expect(audioOutputInstances).toHaveLength(1);
  });

  it('waits for audio output initialization before auto-starting mic', async () => {
    const init = deferAudioOutputInitialize();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioInput = await waitForAudioInput();

    await emitConnected();
    expect(audioInput.start).not.toHaveBeenCalled();

    init.resolve(true);
    await waitFor(() => expect(audioInput.start).toHaveBeenCalledTimes(1));
  });

  it('keeps mic inactive when auto-start resolves false', async () => {
    setAudioInputStartResult(false);
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    await waitForAudioInput();

    expect(utils.queryByLabelText('Stop recording')).toBeNull();
    expect(utils.getByLabelText('Start recording')).toBeTruthy();
  });

  it('does not crash or loop when audio output initialization rejects', async () => {
    const init = deferAudioOutputInitialize();
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioInput = await waitForAudioInput();
    const voice = await waitForVoiceService();

    await emitConnected();
    init.reject(new Error('audio init failed'));
    await Promise.resolve();

    expect(voice.disconnect).not.toHaveBeenCalled();
    expect(audioInput.start).not.toHaveBeenCalled();
  });

  it('manual mic toggle starts only when connected', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioInput = await waitForAudioInput();

    expect(utils.getByLabelText('Connecting...')).toBeTruthy();
    expect(audioInput.start).not.toHaveBeenCalled();

    await emitConnected();
    await waitFor(() => expect(audioInput.start).toHaveBeenCalledTimes(1));
  });

  it('rapid mic taps do not create overlapping start loops', async () => {
    setAudioInputStartResult(false);
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioInput = await waitForAudioInput();

    await emitConnected();
    audioInput.start.mockClear();
    setAudioInputStartResult(true);

    const micButton = utils.getByLabelText('Start recording');
    fireEvent.press(micButton);
    fireEvent.press(micButton);
    await waitFor(() => expect(audioInput.start.mock.calls.length).toBeLessThanOrEqual(1));
  });

  it('does not send screen polling context while realtime mic audio is streaming', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    await emitConnected();
    await waitFor(() => expect(audioInput.start).toHaveBeenCalledTimes(1));
    await flushPromises();
    voice.sendScreenContext.mockClear();

    jest.advanceTimersByTime(5000);
    await flushPromises();

    expect(voice.sendScreenContext).not.toHaveBeenCalled();
  });

  it('voice error stops mic and audio once without clearing history', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const audioInput = await waitForAudioInput();
    const audioOutput = await waitForAudioOutput();

    await emitVoiceError('connection failed');

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(audioOutput.stop).toHaveBeenCalledTimes(1);
    expect(utils.getByText('Home Screen')).toBeTruthy();
  });

  it('does not show a console error overlay for recoverable 1001 voice closes', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();

    await emitVoiceError('Connection lost (code: 1001)');

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('VoiceService error: Connection lost (code: 1001)')
    );

    consoleError.mockRestore();
  });

  it('desired: switching away from voice stops and cleans audio output once', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioOutput = await waitForAudioOutput();

    await switchToText(utils);

    expect(audioOutput.stop).toHaveBeenCalledTimes(1);
    expect(audioOutput.cleanup).toHaveBeenCalledTimes(1);
  });

  it('unexpected disconnect schedules one reconnect and uses last callbacks', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await emitDisconnected(false);
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(voice.connect).toHaveBeenCalledTimes(2);
    expect(voice.connect.mock.calls[1][0]).toBe(voice.lastCallbacks);
  });

  it('intentional disconnect does not reconnect', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await emitDisconnected(true);
    jest.advanceTimersByTime(3000);

    expect(voice.connect).toHaveBeenCalledTimes(1);
  });

  it('leaving voice before reconnect timer fires cancels reconnect', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await emitDisconnected(false);
    await switchToText(utils);
    jest.advanceTimersByTime(3000);

    expect(voice.connect).toHaveBeenCalledTimes(1);
  });
});

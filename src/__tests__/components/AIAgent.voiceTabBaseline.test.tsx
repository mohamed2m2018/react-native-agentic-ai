import { fireEvent, waitFor } from '@testing-library/react-native';
import {
  audioInputInstances,
  audioOutputInstances,
  emitConnected,
  emitSetupComplete,
  flushPromises,
  renderVoiceAgent,
  resetVoiceHarness,
  switchToText,
  switchToVoice,
  voiceInstances,
  waitForAudioInput,
  waitForAudioOutput,
  waitForVoiceService,
} from './voiceTabHarness';

describe('AIAgent voice tab current baseline', () => {
  beforeEach(() => {
    resetVoiceHarness();
  });

  it('currently omits ask_user from voice tool declarations', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    const toolNames = voice.config.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('tap');
    expect(toolNames).not.toContain('ask_user');
  });

  it('creates one voice service, audio input service, and audio output service on first voice entry', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await waitForVoiceService();
    await waitForAudioInput();
    await waitForAudioOutput();

    expect(voiceInstances).toHaveLength(1);
    expect(audioInputInstances).toHaveLength(1);
    expect(audioOutputInstances).toHaveLength(1);
    expect(voiceInstances[0]!.connect).toHaveBeenCalledTimes(1);
  });

  it('marks connected and starts mic after audio output initialization', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const audioOutput = await waitForAudioOutput();
    const audioInput = await waitForAudioInput();

    await emitConnected();

    expect(audioOutput.initialize).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(audioInput.start).toHaveBeenCalledTimes(1));
    expect(utils.getByLabelText('Stop recording')).toBeTruthy();
  });

  it('sends initial passive screen context on setup complete', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await emitSetupComplete();

    expect(voice.sendScreenContext).toHaveBeenCalledTimes(1);
    expect(voice.sendScreenContext.mock.calls[0][0]).toContain('SYSTEM CONTEXT');
    expect(voice.sendScreenContext.mock.calls[0][0]).toContain('Screen: Home');
  });

  it('renders final voice transcript bubbles in voice mode', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    await voice.lastCallbacks?.onTranscript?.('Open profile.', true, 'user');
    await voice.lastCallbacks?.onTranscript?.('I can open that.', true, 'model');
    await flushPromises();

    expect(utils.getByText('Open profile.')).toBeTruthy();
    expect(utils.getByText('I can open that.')).toBeTruthy();
  });

  it('current baseline: switching away from voice disconnects and stops mic but does not clean audio output', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    const audioOutput = await waitForAudioOutput();

    await switchToText(utils);

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(audioOutput.stop).not.toHaveBeenCalled();
    expect(audioOutput.cleanup).not.toHaveBeenCalled();
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
  });

  it('stop button performs full cleanup and returns to text mode', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    fireEvent.press(utils.getByLabelText('Stop recording'));

    await waitFor(() => expect(voice.disconnect).toHaveBeenCalledTimes(1));
    expect(audioInput.stop).toHaveBeenCalled();
    expect(utils.getByLabelText('Switch to Voice mode')).toBeTruthy();
  });

  it('unmount cleans up voice resources once', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    utils.unmount();

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
  });
});

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import {
  audioInputInstances,
  audioOutputInstances,
  emitAudioResponse,
  emitConnected,
  emitSetupComplete,
  emitTranscript,
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

  it('uses the voice-only permission tool instead of text-mode ask_user', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();

    const toolNames = voice.config.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('tap');
    expect(toolNames).toContain('ask_user_permission_voice_mode');
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

    await emitTranscript('Open profile.', true, 'user');
    await emitTranscript('I can open that.', true, 'model');

    expect(utils.getByText('Open profile.')).toBeTruthy();
    expect(utils.getByText('I can open that.')).toBeTruthy();
  });

  it('keeps voice transcripts when setup completes again during the same voice session', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await emitSetupComplete();
    await emitTranscript('Open profile.', true, 'user');
    await emitTranscript('I can open that.', true, 'model');
    await emitSetupComplete();

    expect(utils.getByText('Open profile.')).toBeTruthy();
    expect(utils.getByText('I can open that.')).toBeTruthy();
  });

  it('keeps the overlay visible with model transcript while AI is speaking', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await emitAudioResponse();
    expect(utils.getByText('Speaking...')).toBeTruthy();

    await emitTranscript('I can open your order details.', true, 'model');
    expect(utils.getAllByText('I can open your order details.').length).toBeGreaterThanOrEqual(2);
  });

  it('does not render Gemini control-token transcript bubbles', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await emitTranscript('<ctrl46>', true, 'model');
    await emitTranscript('Opening settings. <ctrl46>', true, 'model');

    expect(utils.queryByText('<ctrl46>')).toBeNull();
    expect(utils.queryByText('Opening settings. <ctrl46>')).toBeNull();
    expect(utils.getByText('Opening settings.')).toBeTruthy();
  });

  it('does not render non-speech transcript markers', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await emitTranscript('<noise>', true, 'user');
    await emitTranscript('[inaudible]', true, 'model');
    await emitTranscript('Open profile. <noise>', true, 'user');

    expect(utils.queryByText('<noise>')).toBeNull();
    expect(utils.queryByText('[inaudible]')).toBeNull();
    expect(utils.getByText('Open profile.')).toBeTruthy();
  });

  it('does not render Gemini tool/protocol text as chat bubbles', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);

    await emitTranscript('ask_tool', true, 'model');
    await emitTranscript('ask_user_permission_voice_mode(question)', true, 'model');
    await emitTranscript('done', true, 'model');
    await emitTranscript('done({"success":true})', true, 'model');
    await emitTranscript('Done.', true, 'model');
    await emitTranscript('I am done checking that.', true, 'model');
    await emitTranscript('done', true, 'user');

    expect(utils.queryByText('ask_tool')).toBeNull();
    expect(utils.queryByText('ask_user_permission_voice_mode(question)')).toBeNull();
    expect(utils.queryByText('done({"success":true})')).toBeNull();
    expect(utils.queryByText('Done.')).toBeNull();
    expect(utils.getByText('I am done checking that.')).toBeTruthy();
    expect(utils.getByText('done')).toBeTruthy();
  });

  it('switching away from voice disconnects and cleans up audio services', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();
    const audioOutput = await waitForAudioOutput();

    await switchToText(utils);

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(audioOutput.stop).toHaveBeenCalledTimes(1);
    expect(audioOutput.cleanup).toHaveBeenCalledTimes(1);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
  });

  it('stop button performs full cleanup and returns to text mode', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    await emitConnected();
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    await act(async () => {
      fireEvent.press(utils.getByLabelText('Stop recording'));
    });

    await waitFor(() => expect(voice.disconnect).toHaveBeenCalledTimes(1));
    expect(audioInput.stop).toHaveBeenCalled();
    expect(utils.getByLabelText('Switch to Voice mode')).toBeTruthy();
  });

  it('unmount cleans up voice resources once', async () => {
    const utils = renderVoiceAgent();
    await switchToVoice(utils);
    const voice = await waitForVoiceService();
    const audioInput = await waitForAudioInput();

    await act(async () => {
      utils.unmount();
    });

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
  });
});

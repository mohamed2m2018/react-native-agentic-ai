import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AgentChatBar } from '../../components/AgentChatBar';

const previousMessages = [
  {
    id: 'u-1',
    role: 'user' as const,
    content: [{ type: 'text' as const, content: 'Open my profile' }],
    previewText: 'Open my profile',
    timestamp: 1,
  },
  {
    id: 'a-1',
    role: 'assistant' as const,
    content: [{ type: 'text' as const, content: 'I can help with that' }],
    previewText: 'I can help with that',
    timestamp: 2,
  },
];

function renderChatBar(overrides: Partial<React.ComponentProps<typeof AgentChatBar>> = {}) {
  return render(
    <AgentChatBar
      onSend={jest.fn()}
      isThinking={false}
      lastResult={null}
      language="en"
      availableModes={['text', 'voice']}
      mode="text"
      chatMessages={previousMessages}
      {...overrides}
    />
  );
}

function expand(utils: ReturnType<typeof renderChatBar>) {
  const open = utils.queryByLabelText('Open AI Agent Chat');
  if (open) {
    fireEvent.press(open);
  }
}

describe('AgentChatBar voice mode', () => {
  it('shows Voice only when voice mode is available', () => {
    const withVoice = renderChatBar();
    expand(withVoice);
    expect(withVoice.getByText('Voice')).toBeTruthy();
    expect(withVoice.getByText('Text')).toBeTruthy();

    const withoutVoice = renderChatBar({ availableModes: ['text'] });
    expand(withoutVoice);
    expect(withoutVoice.queryByText('Voice')).toBeNull();
    expect(withoutVoice.queryByText('Text')).toBeNull();
  });

  it('renders voice controls after switching to Voice and hides the text input row', () => {
    const onModeChange = jest.fn();
    const utils = renderChatBar({ onModeChange });
    expand(utils);

    fireEvent.press(utils.getByLabelText('Switch to Voice mode'));
    expect(onModeChange).toHaveBeenCalledWith('voice');

    utils.rerender(
      <AgentChatBar
        onSend={jest.fn()}
        isThinking={false}
        lastResult={null}
        language="en"
        availableModes={['text', 'voice']}
        mode="voice"
        chatMessages={previousMessages}
      />
    );
    expand(utils);

    expect(utils.getByLabelText('Connecting...')).toBeTruthy();
    expect(utils.getByLabelText('Mute speaker')).toBeTruthy();
    expect(utils.queryByPlaceholderText('Ask AI...')).toBeNull();
  });

  it('keeps existing chat history visible when switching to Voice', () => {
    const utils = renderChatBar({ mode: 'voice' });
    expand(utils);

    expect(utils.getByText('Open my profile')).toBeTruthy();
    expect(utils.getByText('I can help with that')).toBeTruthy();
  });

  it('minimizes and re-expands in Voice mode without losing controls', () => {
    const utils = renderChatBar({ mode: 'voice', isVoiceConnected: true });
    expand(utils);
    expect(utils.getByLabelText('Start recording')).toBeTruthy();

    fireEvent.press(utils.getByLabelText('Minimize AI Agent'));
    expect(utils.queryByLabelText('Start recording')).toBeNull();

    expand(utils);
    expect(utils.getByLabelText('Start recording')).toBeTruthy();
  });

  it('does not render the empty transcript placeholder in voice mode', () => {
    const utils = renderChatBar({ mode: 'voice' } as any);
    expand(utils);

    expect(utils.queryByText('Speak and transcript will appear here')).toBeNull();
  });

  it('desired: renders voice transcript bubbles using chat styling', () => {
    const utils = renderChatBar({
      mode: 'voice',
      voiceTranscripts: [
        { id: 'vt-user', role: 'user', text: 'Open profile.' },
        { id: 'vt-model', role: 'model', text: 'I can open that.' },
      ],
    } as any);
    expand(utils);

    expect(utils.getByText('Open profile.')).toBeTruthy();
    expect(utils.getByText('I can open that.')).toBeTruthy();
  });

  it('desired: renders approval controls alongside history and transcripts', () => {
    const utils = renderChatBar({
      mode: 'voice',
      pendingApprovalQuestion: 'I can open Profile. May I proceed?',
      onPendingApprovalAction: jest.fn(),
      voiceTranscripts: [{ id: 'vt-user', role: 'user', text: 'Open profile.' }],
    } as any);
    expand(utils);

    expect(utils.getByText('Open my profile')).toBeTruthy();
    expect(utils.getByText('Open profile.')).toBeTruthy();
    expect(utils.getByText('Allow')).toBeTruthy();
    expect(utils.getByText('Don’t Allow')).toBeTruthy();
  });

  it('desired: voice thinking does not insert loading dots into chat history', () => {
    const utils = renderChatBar({ mode: 'voice', isThinking: true, statusText: 'Working...' });
    expand(utils);

    expect(utils.getByText('Open my profile')).toBeTruthy();
    expect(utils.queryByText('Working...')).toBeNull();
  });
});

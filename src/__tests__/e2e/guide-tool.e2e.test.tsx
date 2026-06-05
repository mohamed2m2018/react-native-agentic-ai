/**
 * GuideTool & HighlightOverlay E2E Test
 *
 * Verifies that the REAL LLM can successfully invoke `highlight_element`,
 * which subsequently renders the `<HighlightOverlay>` component over
 * the requested UI element, and auto-dismisses when tapped.
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/e2e/guide-tool.e2e.test.tsx
 */

import React from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { act } from 'react-test-renderer';
import { AIAgent } from '../../components/AIAgent';
import { executeGoalLive, requireApiKey } from './e2e-helpers';

// We mock telemetry and voice to avoid noise/errors
jest.mock('../../services/telemetry', () => ({
  TelemetryService: jest.fn().mockImplementation(() => ({
    start: jest.fn(), stop: jest.fn(), track: jest.fn(), setScreen: jest.fn(), setAgentActing: jest.fn(),
  })),
  bindTelemetryService: jest.fn(),
}));
jest.mock('../../services/VoiceService', () => ({
  VoiceService: jest.fn().mockImplementation(() => ({
    connect: jest.fn(), disconnect: jest.fn(),
  })),
}));

describe('GuideTool E2E (Real LLM)', () => {
  beforeAll(() => {
    requireApiKey();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // A 30s timeout is needed because we are hitting the real Gemini API
  it.skip('LLM triggers highlight_element and overlay renders', async () => {
    // 1. We construct the React app tree with AIAgent
    const appEl = (
      <AIAgent apiKey={process.env.GEMINI_API_KEY} model="gemini-2.5-flash" showChatBar={false}>
        <View style={{ flex: 1, padding: 20 }}>
          <Text testID="title-text">Settings Profile</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <Text testID="notif-label">Enable Notifications</Text>
            <Switch testID="notif-switch" value={true} />
          </View>
          <Pressable testID="save-button" style={{ marginTop: 40 }}>
            <Text>Save Changes</Text>
          </Pressable>
        </View>
      </AIAgent>
    );

    // 2. We use executeGoalLive to pass a natural language request to the REAL model
    const { result, renderer, unmount } = await executeGoalLive(
      appEl,
      'Can you point out where the notifications switch is on this screen?'
    );

    // 3. Verify the execution was successful
    expect(result.success).toBe(true);
    
    // The history should show that the LLM called `guide_user`
    const highlightStep = result.steps.find(
      (s) => s.action?.name === 'guide_user'
    );
    expect(highlightStep).toBeTruthy();

    // 4. Verify the UI reacted to the tool call: 
    // Is the `<HighlightOverlay>` rendered? 
    // We must wait for React to flush the state update triggered by DeviceEventEmitter
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // We check the renderer tree for the known testID `highlight-close-zone`.
    console.log('Renderer output:', JSON.stringify(renderer.toJSON(), null, 2));
    const highlightZones = renderer.root.findAllByProps({ testID: 'highlight-close-zone' });
    expect(highlightZones.length).toBe(1);

    // 5. Verify the tool works — tapping it should dismiss the spotlight overlay
    act(() => {
      highlightZones[0]?.props.onPress();
    });

    // Verify it is gone
    const postDismissZones = renderer.root.findAllByProps({ testID: 'highlight-close-zone' });
    expect(postDismissZones.length).toBe(0);

    unmount();
  }, 30000);
});

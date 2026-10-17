import { buildSystemPrompt, buildVoiceSystemPrompt } from '../../core/systemPrompt';

describe('system prompt mode', () => {
  it('uses the general app-assistant identity by default', () => {
    const prompt = buildSystemPrompt('en');
    expect(prompt).toContain("You are the AI assistant built into this app.");
    expect(prompt).toContain('You are an AI assistant embedded within a React Native mobile application.');
    expect(prompt).toContain("I'm this app's assistant — here to help you get things done.");
    expect(prompt).not.toContain('Customer Support Agent');
  });

  it('adds the support persona only when a support style is passed', () => {
    const prompt = buildSystemPrompt('en', false, true, 'warm-concise');
    expect(prompt).toContain('You are a professional Customer Support Agent');
    expect(prompt).toContain("I'm your support assistant");
  });

  it('switches the voice prompt the same way', () => {
    expect(buildVoiceSystemPrompt('en')).toContain('You are a voice-controlled AI assistant');
    expect(buildVoiceSystemPrompt('en', undefined, false, 'neutral-professional')).toContain(
      'You are a professional voice-controlled Customer Support Agent'
    );
  });

  it('never mentions removed tools or the old brand', () => {
    for (const prompt of [
      buildSystemPrompt('en'),
      buildSystemPrompt('en', true, true, 'warm-concise'),
      buildVoiceSystemPrompt('en'),
      buildVoiceSystemPrompt('en', undefined, true, 'warm-concise'),
    ]) {
      expect(prompt).not.toMatch(/report_issue|start_ai_call|Twomilia/);
    }
  });
});

import { buildSupportPrompt } from '../../support/supportPrompt';
import { buildSystemPrompt, buildVoiceSystemPrompt } from '../../core/systemPrompt';

describe('support style presets', () => {
  it('defaults support prompts to warm-concise behavior', () => {
    const prompt = buildSupportPrompt({
      enabled: true,
    });

    expect(prompt).toContain('Support Style: Warm Concise');
    expect(prompt).toContain('calm, kind, and capable');
  });

  it('applies wow-service style when explicitly selected', () => {
    const prompt = buildSupportPrompt({
      enabled: true,
      persona: {
        preset: 'wow-service',
      },
    });

    expect(prompt).toContain('Support Style: WOW Service');
    expect(prompt).toContain('Deliver memorable service');
    expect(prompt).toContain('warm, humble, upbeat, and service-first');
  });

  it('threads supportStyle through the core text prompt', () => {
    const prompt = buildSystemPrompt('en', false, true, 'wow-service');

    expect(prompt).toContain('Support Style: WOW Service');
  });

  it('threads supportStyle through the voice prompt', () => {
    const prompt = buildVoiceSystemPrompt('en', undefined, false, 'neutral-professional');

    expect(prompt).toContain('Support Style: Neutral Professional');
  });
});

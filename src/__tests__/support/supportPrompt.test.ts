import { buildSupportPrompt } from '../../support/supportPrompt';
import { buildCompanionPrompt, buildSystemPrompt, buildVoiceSystemPrompt } from '../../core/systemPrompt';

describe('support style presets', () => {
  it('defaults support prompts to warm-concise behavior', () => {
    const prompt = buildSupportPrompt({
      enabled: true,
    });

    expect(prompt).toContain('Support Style: Warm Concise');
    expect(prompt).toContain('Speak like a calm, caring human teammate.');
    expect(prompt).toContain('Lead with warmth before action.');
  });

  it('applies wow-service style when explicitly selected', () => {
    const prompt = buildSupportPrompt({
      enabled: true,
      persona: {
        preset: 'wow-service',
      },
    });

    expect(prompt).toContain('Support Style: WOW Service');
    expect(prompt).toContain('Deliver genuinely memorable service');
    expect(prompt).toContain('warm, proactive, and genuinely service-first tone');
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

describe('copilot approval guidance', () => {
  it('tells the model to ask once for the routine flow and stay silent through intermediate steps', () => {
    const prompt = buildSystemPrompt('en');

    expect(prompt).toContain(
      'ACTION requests → clarify if needed, get one workflow approval, execute routine steps silently, confirm only irreversible final commits',
    );
    expect(prompt).toContain(
      'Do NOT ask again to open an item, tap Add to Cart, choose a variant the user already specified, or move through routine screens in the same approved flow.',
    );
    expect(prompt).toContain(
      'For action requests: get one workflow approval when app action is needed → execute routine steps silently → confirm only irreversible final commits.',
    );
  });

  it('uses action examples that avoid repeated intermediate confirmations', () => {
    const prompt = buildSystemPrompt('en');

    expect(prompt).toContain('User: "buy pigeon"');
    expect(prompt).toContain("I'll open the pigeon item and add it to your cart. May I proceed?");
    expect(prompt).toContain('[opens the item and taps Add to Cart silently]');
    expect(prompt).not.toContain("I've selected GBP. Would you like me to press Save to apply?");
  });

  it('keeps a separate confirmation right before irreversible final commits', () => {
    const prompt = buildSystemPrompt('en');

    expect(prompt).toContain('User: "place my order"');
    expect(prompt).toContain("I'll tap 'Place Order' for 350 EGP now. Confirm?");
    expect(prompt).toContain(
      'Do NOT use ask_user for routine confirmations the user already gave. If they said "place my order", proceed to the commit step and confirm there immediately before submitting.',
    );
  });

  it('tells the model to bundle visible missing form fields after validation failures', () => {
    const prompt = buildSystemPrompt('en');

    expect(prompt).toContain(
      'If multiple visible required fields are missing, ask for all of them in ONE ask_user(grants_workflow_approval=true) call.',
    );
    expect(prompt).toContain(
      'When visible validation feedback reveals missing low-risk form fields, include any other visible empty required form fields from the same screen and bundle them into a single ask_user(grants_workflow_approval=true) question instead of asking one field at a time.',
    );
  });

  it('preserves support-flow approval requirements for app investigation', () => {
    const prompt = buildSystemPrompt('en', false, true);

    expect(prompt).toContain('SUPPORT FLOW — APP ACTION GATE (HARD RULE, NO EXCEPTIONS):');
    expect(prompt).toContain(
      'Use ask_user with request_app_action=true to request permission.',
    );
    expect(prompt).toContain(
      'The user MUST tap the button. If the user types a text reply instead of tapping:',
    );
  });
});

describe('companion mode guidance', () => {
  it('keeps planning language out of user-facing companion answers', () => {
    const prompt = buildCompanionPrompt('en', true);

    expect(prompt).toContain('Speak to the user directly as "you"; never describe them as "the user".');
    expect(prompt).toContain('The plan field is internal only.');
    expect(prompt).toContain('Bad: "The user is reporting a late order.');
    expect(prompt).toContain('Better: "Sorry your order is late.');
  });

  it('frames companion mode as problem solving, not just navigation tips', () => {
    const prompt = buildCompanionPrompt('en', true);

    expect(prompt).toContain('Navigation guidance is only one tactic.');
    expect(prompt).toContain('Do not reduce every answer to "tap this tab".');
    expect(prompt).toContain('Do not make navigation the whole answer unless the user only asked where something is.');
    expect(prompt).toContain('For support problems, acknowledge the issue, explain what information matters, then suggest the safest next step.');
    expect(prompt).toContain('Other non-UI tools may be available.');
    expect(prompt).toContain('You may use available non-UI tools for read-only data, support reporting, ticket handoff, diagnostics, recommendations, or backend lookups.');
    expect(prompt).toContain('If the user explicitly asks for a human and escalate_to_human is available, call escalate_to_human.');
    expect(prompt).toContain('Never claim a human handoff happened unless the escalate_to_human tool actually ran successfully.');
    expect(prompt).toContain('For comparison or choice questions, compare visible options and give a practical recommendation.');
  });
});

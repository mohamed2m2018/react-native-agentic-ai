import {
  OutcomeVerifier,
  buildVerificationAction,
  createVerificationSnapshot,
} from '../../core/OutcomeVerifier';
import type { AIProvider, AgentConfig, ProviderResult } from '../../core/types';

class VerifierProvider implements AIProvider {
  public readonly userMessages: string[] = [];

  constructor(
    private readonly args: Record<string, any>,
    private readonly plan = '',
  ) {}

  async generateContent(_systemPrompt: string, userMessage: string): Promise<ProviderResult> {
    this.userMessages.push(userMessage);
    return {
      toolCalls: [
        {
          name: 'report_verification',
          args: this.args,
        },
      ],
      reasoning: {
        previousGoalEval: '',
        memory: '',
        plan: this.plan,
      },
    };
  }
}

describe('OutcomeVerifier', () => {
  it('uses verifier-model judgment to extract visible missing fields from validation feedback', async () => {
    const provider = new VerifierProvider({
      status: 'error',
      failureKind: 'controllable',
      evidence: 'The post-action UI shows phone number validation.',
      missingFields: ['Phone Number'],
      validationMessages: ['Phone number is required'],
    });
    const verifier = new OutcomeVerifier(provider, {} as AgentConfig);
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Save Changes', fiberNode: {}, props: {} },
      { index: 1, type: 'text-input' as const, label: 'Phone Number', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Save the profile form',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Save Changes'),
      preAction: createVerificationSnapshot(
        'ProfileForm',
        'Screen: ProfileForm\n[0]<pressable>Save Changes />\n[1]<text-input value="">Phone Number />\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'ProfileForm',
        'Screen: ProfileForm\n[0]<pressable>Save Changes />\n[1]<text-input value="">Phone Number />\n[image]\nPhone number is required\n',
        elements,
      ),
    });

    expect(result.status).toBe('error');
    expect(result.source).toBe('llm');
    expect(result.failureKind).toBe('controllable');
    expect(result.missingFields).toEqual(['Phone Number']);
    expect(result.validationMessages).toEqual(['Phone number is required']);
    expect(provider.userMessages[0]).toContain('<pre_action screen="ProfileForm">');
    expect(provider.userMessages[0]).toContain('<post_action screen="ProfileForm">');
  });

  it('accepts JSON-string missing fields from verifier-model judgment', async () => {
    const verifier = new OutcomeVerifier(
      new VerifierProvider({
        status: 'error',
        failureKind: 'controllable',
        evidence: 'The post-action UI shows two required-field messages.',
        missingFields: JSON.stringify(['Phone Number', 'Apartment Number']),
        validationMessages: JSON.stringify([
          'Phone number is required',
          'Apartment number is required',
        ]),
      }),
      {} as AgentConfig
    );
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Confirm Location', fiberNode: {}, props: {} },
      { index: 1, type: 'text-input' as const, label: 'Phone Number', fiberNode: {}, props: {} },
      { index: 2, type: 'text-input' as const, label: 'Apartment Number', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Save the address',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Confirm Location'),
      preAction: createVerificationSnapshot(
        'AddressForm',
        'Screen: AddressForm\n[0]<pressable>Confirm Location />\n[1]<text-input value="">Phone Number />\n[2]<text-input value="">Apartment Number />\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'AddressForm',
        'Screen: AddressForm\n[0]<pressable>Confirm Location />\n[1]<text-input value="">Phone Number />\n[2]<text-input value="">Apartment Number />\nPhone number is required\nApartment number is required\n',
        elements,
      ),
    });

    expect(result.status).toBe('error');
    expect(result.missingFields).toEqual(['Phone Number', 'Apartment Number']);
    expect(result.validationMessages).toEqual([
      'Phone number is required',
      'Apartment number is required',
    ]);
  });

  it('lets verifier-model judgment add other visible empty required fields from the same form section', async () => {
    const verifier = new OutcomeVerifier(
      new VerifierProvider({
        status: 'error',
        failureKind: 'controllable',
        evidence: 'The form section still has visible empty required fields.',
        missingFields: ['Floor No', 'Building Name', 'Phone Number'],
        validationMessages: ['Floor number is required'],
      }),
      {} as AgentConfig
    );
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Confirm Location', fiberNode: {}, props: {} },
      { index: 1, type: 'text-input' as const, label: 'Building Name', fiberNode: {}, props: {} },
      { index: 2, type: 'text-input' as const, label: 'Apartment No', fiberNode: {}, props: {} },
      { index: 3, type: 'text-input' as const, label: 'Floor No', fiberNode: {}, props: {} },
      { index: 4, type: 'text-input' as const, label: 'Contact Information *', fiberNode: {}, props: {} },
      { index: 5, type: 'text-input' as const, label: 'Phone Number', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Save the address',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Confirm Location'),
      preAction: createVerificationSnapshot(
        'AddressForm',
        'Screen: AddressForm\n[0]<pressable>Confirm Location />\n[1]<text-input value="">Building Name />\n[2]<text-input value="7">Apartment No />\n[3]<text-input value="">Floor No />\n[4]<text-input value="">Contact Information * />\n[5]<text-input value="">Phone Number />\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'AddressForm',
        [
          'Screen: AddressForm',
          'Building Details  *',
          '[1]<text-input value="">Building Name />',
          '[2]<text-input value="7">Apartment No />',
          '[3]<text-input value="">Floor No />',
          '[4]<text-input value="">Contact Information * />',
          '[5]<text-input value="">Phone Number />',
          'Floor number is required',
          '',
        ].join('\n'),
        elements,
      ),
    });

    expect(result.status).toBe('error');
    expect(result.missingFields).toEqual(['Floor No', 'Building Name', 'Phone Number']);
    expect(result.validationMessages).toEqual(['Floor number is required']);
  });

  it('does not treat informational failed-renewal copy as a submission error', async () => {
    const verifier = new OutcomeVerifier(
      new VerifierProvider({
        status: 'uncertain',
        failureKind: 'controllable',
        evidence: 'No explicit success or failure is visible yet.',
      }),
      {} as AgentConfig
    );
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Review cancellation request', fiberNode: {}, props: {} },
      { index: 1, type: 'pressable' as const, label: 'Submit cancellation review', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Submit the cancellation review',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Review cancellation request'),
      preAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\n[0]<pressable>Review cancellation request />\nSmart retry is active for failed renewals\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\n[1]<pressable>Submit cancellation review />\nSmart retry is active for failed renewals\n',
        elements,
      ),
    });

    expect(result.status).toBe('uncertain');
    expect(result.evidence).toBe('No explicit success or failure is visible yet.');
  });

  it('uses verifier-model judgment for explicit submission failure text', async () => {
    const verifier = new OutcomeVerifier(
      new VerifierProvider({
        status: 'error',
        failureKind: 'controllable',
        evidence: 'The post-action UI says the submission failed because the account is locked.',
        validationMessages: ['Submission failed because the account is locked'],
      }),
      {} as AgentConfig
    );
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Submit cancellation review', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Submit the cancellation review',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Submit cancellation review'),
      preAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\n[0]<pressable>Submit cancellation review />\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\nSubmission failed because the account is locked\n',
        elements,
      ),
    });

    expect(result.status).toBe('error');
    expect(result.failureKind).toBe('controllable');
    expect(result.validationMessages).toEqual(['Submission failed because the account is locked']);
  });

  it('falls back to verifier reasoning when report args are malformed', async () => {
    const verifier = new OutcomeVerifier(
      new VerifierProvider(
        {},
        'The UI clearly indicates that the cancellation review has been created and the subscription state changed to Cancellation requested.',
      ),
      {} as AgentConfig
    );
    const elements = [
      { index: 0, type: 'pressable' as const, label: 'Submit cancellation review', fiberNode: {}, props: {} },
    ];

    const result = await verifier.verify({
      goal: 'Submit the cancellation review',
      action: buildVerificationAction('tap', { index: 0 }, elements, 'Submit cancellation review'),
      preAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\n[0]<pressable>Submit cancellation review />\n',
        elements,
      ),
      postAction: createVerificationSnapshot(
        'SubscriptionCancellation',
        'Screen: SubscriptionCancellation\nCurrent state: Cancellation requested\nCancellation review created.\n',
        elements,
      ),
    });

    expect(result.status).toBe('success');
    expect(result.source).toBe('llm');
    expect(result.evidence).toContain('cancellation review has been created');
  });
});

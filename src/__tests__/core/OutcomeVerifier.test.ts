import {
  OutcomeVerifier,
  buildVerificationAction,
  createVerificationSnapshot,
} from '../../core/OutcomeVerifier';
import type { AIProvider, AgentConfig, ProviderResult } from '../../core/types';

class StubProvider implements AIProvider {
  async generateContent(): Promise<ProviderResult> {
    throw new Error('LLM verification should not run in deterministic verifier tests');
  }
}

describe('OutcomeVerifier', () => {
  it('extracts visible missing fields from validation feedback', async () => {
    const verifier = new OutcomeVerifier(new StubProvider(), {} as AgentConfig);
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
    expect(result.failureKind).toBe('controllable');
    expect(result.missingFields).toEqual(['Phone Number']);
    expect(result.validationMessages).toEqual(['Phone number is required']);
  });

  it('collects multiple missing fields when several validation messages are visible', async () => {
    const verifier = new OutcomeVerifier(new StubProvider(), {} as AgentConfig);
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

  it('adds other visible empty required fields from the same form section after validation fails', async () => {
    const verifier = new OutcomeVerifier(new StubProvider(), {} as AgentConfig);
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
});

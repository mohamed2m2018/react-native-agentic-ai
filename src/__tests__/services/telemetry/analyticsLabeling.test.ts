import {
  chooseBestAnalyticsTarget,
  getAnalyticsElementKind,
  getFallbackAnalyticsLabel,
} from '../../../services/telemetry/analyticsLabeling';

describe('analyticsLabeling', () => {
  it('rejects internal React Native labels and falls back to a human analytics label', () => {
    const result = chooseBestAnalyticsTarget(
      [
        { text: 'TextImplLegacy', source: 'deep-text' },
        { text: 'RCTText', source: 'accessibility' },
        { text: 'component', source: 'title' },
      ],
      'button'
    );

    expect(result.label).toBe('Primary action');
    expect(result.elementKind).toBe('button');
    expect(result.labelConfidence).toBe('low');
  });

  it('prefers visible human-facing text over weaker identifiers', () => {
    const result = chooseBestAnalyticsTarget(
      [
        { text: 'checkout_cta_primary', source: 'test-id' },
        { text: 'Complete purchase', source: 'deep-text' },
      ],
      'button'
    );

    expect(result.label).toBe('Complete purchase');
    expect(result.labelConfidence).toBe('high');
  });

  it('maps a broader set of semantic element kinds', () => {
    expect(getAnalyticsElementKind('link')).toBe('link');
    expect(getAnalyticsElementKind('tab')).toBe('tab');
    expect(getAnalyticsElementKind('scrollview')).toBe('scroll_area');
  });

  it('provides reasonable fallback labels for broader kinds', () => {
    expect(getFallbackAnalyticsLabel('sheet')).toBe('Bottom sheet');
    expect(getFallbackAnalyticsLabel('scroll_area')).toBe('Scrollable area');
  });
});

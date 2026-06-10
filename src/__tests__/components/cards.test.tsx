/**
 * InfoCard and ReviewSummary unit tests
 *
 * Tests component rendering and the critical `displayName` export
 * that makes template lookup work in minified production builds.
 *
 * Run: cd react-native-ai-agent && yarn test src/__tests__/components/cards.test.tsx
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { InfoCard } from '../../components/cards/InfoCard';
import { ReviewSummary } from '../../components/cards/ReviewSummary';

// ─── InfoCard ─────────────────────────────────────────────────────────────────

describe('InfoCard', () => {

  // ── displayName (CRITICAL for injectCardTool template lookup) ──

  it('has an explicit displayName matching exactly "InfoCard"', () => {
    // This test would fail after minification if displayName was not set explicitly,
    // because function.name gets mangled to a single char like "a".
    expect(InfoCard.displayName).toBe('InfoCard');
  });

  // ── Rendering ──────────────────────────────────────────────────

  it('renders with default props', () => {
    const { getByText } = render(<InfoCard />);
    expect(getByText('Info')).toBeTruthy();
    expect(getByText('Helpful facts will appear here.')).toBeTruthy();
  });

  it('renders custom title and body', () => {
    const { getByText } = render(
      <InfoCard title="Delivery Info" body="Your order arrives in 30 minutes." icon="🚚" />
    );
    expect(getByText('Delivery Info')).toBeTruthy();
    expect(getByText('Your order arrives in 30 minutes.')).toBeTruthy();
  });

  it('does not render body element when body is empty', () => {
    const { queryByText } = render(<InfoCard title="Title" body="" />);
    // Empty string body → null rendered (conditional in JSX)
    expect(queryByText('')).toBeNull();
  });
});

// ─── ReviewSummary ────────────────────────────────────────────────────────────

describe('ReviewSummary', () => {

  // ── displayName (CRITICAL for injectCardTool template lookup) ──

  it('has an explicit displayName matching exactly "ReviewSummary"', () => {
    expect(ReviewSummary.displayName).toBe('ReviewSummary');
  });

  // ── Rendering ──────────────────────────────────────────────────

  it('renders with default props', () => {
    const { getByText } = render(<ReviewSummary />);
    expect(getByText('Customer Reviews')).toBeTruthy();
  });

  it('renders rating and review count in the compatibility subtitle', () => {
    const { getByText } = render(<ReviewSummary rating={4} reviewCount={120} />);
    expect(getByText('4.0 · 120 reviews')).toBeTruthy();
  });

  it('renders correct rating and review count in meta text', () => {
    const { getByText } = render(<ReviewSummary rating={4.7} reviewCount={1234} />);
    expect(getByText('4.7 · 1,234 reviews')).toBeTruthy();
  });

  it('renders out-of-range rating values without crashing', () => {
    const { getByText } = render(<ReviewSummary rating={10} />);
    expect(getByText('10.0 · 0 reviews')).toBeTruthy();
  });

  it('renders custom headline', () => {
    const { getByText } = render(<ReviewSummary headline="AI Summary" />);
    expect(getByText('AI Summary')).toBeTruthy();
  });

  // ── displayName uniqueness ──────────────────────────────────────

  it('InfoCard and ReviewSummary have distinct displayNames', () => {
    expect(InfoCard.displayName).not.toBe(ReviewSummary.displayName);
  });
});

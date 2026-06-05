import { View, Text, StyleSheet } from 'react-native';

interface ReviewSummaryProps {
  rating?: number;    // 0-5
  reviewCount?: number;
  headline?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Built-in card template that shows a product/service review summary.
 * Injected by the AI agent to surface social proof at decision points.
 *
 * IMPORTANT: displayName is set explicitly to survive minification.
 * The injectCardTool resolves templates by `T.displayName`, not `T.name`.
 */
export function ReviewSummary({
  rating = 0,
  reviewCount = 0,
  headline = 'Customer Reviews',
  sentiment = 'neutral',
}: ReviewSummaryProps) {
  const stars = Math.round(Math.min(5, Math.max(0, rating)));
  const filled = '★'.repeat(stars);
  const empty = '☆'.repeat(5 - stars);

  const sentimentColor: Record<ReviewSummaryProps['sentiment'] & string, string> = {
    positive: '#16a34a',
    neutral: '#6b7280',
    negative: '#dc2626',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>{headline}</Text>
      <View style={styles.row}>
        <Text style={[styles.stars, { color: sentimentColor[sentiment] }]}>
          {filled}{empty}
        </Text>
        <Text style={styles.meta}>
          {rating.toFixed(1)} · {reviewCount.toLocaleString()} reviews
        </Text>
      </View>
    </View>
  );
}

// Explicit — function.name is mangled in minified production builds.
ReviewSummary.displayName = 'ReviewSummary';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
  },
  headline: {
    fontWeight: '600',
    fontSize: 13,
    color: '#1a1a2e',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    fontSize: 18,
    letterSpacing: 1,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
  },
});

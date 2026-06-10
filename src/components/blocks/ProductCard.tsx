import { StyleSheet, Text, View } from 'react-native';
import type { BlockDefinition } from '../../core/types';
import { useActionBridge } from '../../core/ActionBridge';
import { useRichUITheme } from '../rich-content/RichUIContext';
import {
  ActionRow,
  CardSurface,
  MediaFrame,
  PriceTag,
  type BlockAppearance,
} from './primitives';

export interface ProductCardProps {
  title: string;
  name?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  price?: string;
  compareAtPrice?: string;
  badges?: string[];
  actions?: Array<{ id: string; label: string; variant?: 'primary' | 'secondary' | 'chip' }>;
  appearance?: BlockAppearance;
}

export function ProductCard({
  title,
  name,
  subtitle,
  description,
  imageUrl,
  image,
  price,
  compareAtPrice,
  badges = [],
  actions = [],
  appearance,
}: ProductCardProps) {
  const theme = useRichUITheme();
  const bridge = useActionBridge();
  const resolvedTitle = title || name || 'Recommended item';
  const resolvedImageUrl = imageUrl || image;
  const palette = {
    text: appearance?.textColor || theme.colors.primaryText,
    muted: appearance?.mutedTextColor || theme.colors.secondaryText,
    accent: appearance?.accentColor || theme.colors.primaryAccent,
  };
  const heroPriceAppearance: BlockAppearance = {
    ...appearance,
    priceBackgroundColor: 'rgba(23, 20, 17, 0.86)',
    priceTextColor: theme.colors.inverseText,
  };

  return (
    <CardSurface appearance={appearance}>
      <View style={styles.mediaWrap}>
        <MediaFrame uri={resolvedImageUrl} appearance={appearance} />
        <View style={styles.heroScrim} />
        {price ? <View style={styles.floatingPrice}><PriceTag label={price} strikeThrough={compareAtPrice} appearance={heroPriceAppearance} /></View> : null}
        <View style={styles.heroContent}>
          {subtitle ? (
            <Text style={[styles.subtitleEyebrow, { color: theme.colors.inverseText }]}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.heroTitle, { color: theme.colors.inverseText }]}>
            {resolvedTitle}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.content,
          {
            gap: theme.spacing.sm,
            backgroundColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
            borderColor: appearance?.borderColor || theme.colors.subtleBorder,
          },
        ]}
      >
        <View style={styles.kickerRow}>
          <View style={[styles.kickerBar, { backgroundColor: palette.accent }]} />
          <Text style={[styles.kickerText, { color: palette.muted }]}>
            AI pick
          </Text>
        </View>
        {description ? (
          <Text
            style={[
              styles.description,
              { color: palette.text },
            ]}
          >
            {description}
          </Text>
        ) : null}
        {badges.length ? (
          <View style={[styles.badgesRow, { gap: theme.spacing.xs }]}>
            {badges.map((badge) => (
              <View
                key={badge}
                style={[
                  styles.badge,
                  {
                    backgroundColor: theme.colors.blockSurface,
                    borderColor: theme.colors.subtleBorder,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: palette.text }]}>{badge}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {!price && compareAtPrice ? <Text style={[styles.compareAtPrice, { color: theme.colors.strikeThroughPrice }]}>{compareAtPrice}</Text> : null}
      </View>
      <ActionRow
        actions={actions}
        appearance={appearance}
        onAction={(actionId) => {
          bridge.invoke({ actionId });
        }}
      />
    </CardSurface>
  );
}

ProductCard.displayName = 'ProductCard';

export const ProductCardDefinition: BlockDefinition = {
  name: 'ProductCard',
  component: ProductCard,
  allowedPlacements: ['chat', 'zone'],
  interventionType: 'decision_support',
  interventionEligible: true,
  propSchema: {
    title: { type: 'string', required: true },
    name: { type: 'string' },
    subtitle: { type: 'string' },
    description: { type: 'string' },
    imageUrl: { type: 'string' },
    image: { type: 'string' },
    price: { type: 'string' },
    compareAtPrice: { type: 'string' },
    badges: { type: 'array' },
    actions: { type: 'array' },
  },
  previewTextBuilder: (props) =>
    [props.title, props.price, props.description].filter((part): part is string => typeof part === 'string').join(' — '),
  styleSlots: ['surface', 'media', 'price', 'actions'],
};

const styles = StyleSheet.create({
  mediaWrap: {
    position: 'relative',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 10, 8, 0.16)',
  },
  floatingPrice: {
    position: 'absolute',
    right: 14,
    bottom: 14,
  },
  heroContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 6,
  },
  subtitleEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    opacity: 0.88,
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    maxWidth: '74%',
  },
  content: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerBar: {
    width: 28,
    height: 4,
    borderRadius: 999,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compareAtPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
});

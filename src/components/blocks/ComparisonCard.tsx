import { Image, StyleSheet, Text, View } from 'react-native';
import type { BlockDefinition } from '../../core/types';
import { useRichUITheme } from '../rich-content/RichUIContext';
import {
  BadgeRow,
  CardSurface,
  PriceTag,
  SectionTitle,
  type BlockAppearance,
} from './primitives';

export interface ComparisonCardItem {
  title: string;
  name?: string;
  subtitle?: string;
  price?: string;
  badges?: string[];
  summary?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
}

export interface ComparisonCardProps {
  title?: string;
  items?: ComparisonCardItem[];
  appearance?: BlockAppearance;
}

export function ComparisonCard({
  title = 'Compare options',
  items = [],
  appearance,
}: ComparisonCardProps) {
  const theme = useRichUITheme();
  const accentColor = appearance?.accentColor || theme.colors.primaryAccent;
  return (
    <CardSurface appearance={appearance}>
      <View style={styles.header}>
        <View style={[styles.headerBar, { backgroundColor: accentColor }]} />
        <SectionTitle title={title} appearance={appearance} />
      </View>
      <View style={styles.list}>
        {items.map((item, index) => (
          <View
            key={item.title || item.name || `item-${index}`}
            style={[
              styles.item,
              {
                borderColor: appearance?.borderColor || theme.colors.subtleBorder,
                backgroundColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
              },
            ]}
          >
            {(item.imageUrl || item.image) ? (
              <Image
                source={{ uri: item.imageUrl || item.image }}
                style={[styles.itemImage, { borderColor: theme.colors.mediaBorder }]}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.itemTopRow}>
              <View style={styles.itemTitleWrap}>
                <Text style={[styles.rank, { color: appearance?.mutedTextColor || theme.colors.mutedText }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.itemCopy}>
                  <SectionTitle
                    title={item.title || item.name || `Option ${index + 1}`}
                    subtitle={item.subtitle}
                    appearance={appearance}
                  />
                </View>
              </View>
              <PriceTag label={item.price} appearance={appearance} />
            </View>
            {(item.summary || item.description) ? (
              <Text style={[styles.summary, { color: appearance?.textColor || theme.colors.primaryText }]}>
                {item.summary || item.description}
              </Text>
            ) : null}
            <BadgeRow badges={item.badges} appearance={appearance} />
          </View>
        ))}
      </View>
    </CardSurface>
  );
}

ComparisonCard.displayName = 'ComparisonCard';

export const ComparisonCardDefinition: BlockDefinition = {
  name: 'ComparisonCard',
  component: ComparisonCard,
  allowedPlacements: ['chat', 'zone'],
  interventionType: 'decision_support',
  interventionEligible: true,
  propSchema: {
    title: { type: 'string' },
    items: { type: 'array', required: true },
  },
  previewTextBuilder: (props) =>
    [props.title].filter((part): part is string => typeof part === 'string').join(' — '),
  styleSlots: ['surface', 'comparisonItems', 'price'],
};

const styles = StyleSheet.create({
  header: {
    gap: 12,
  },
  headerBar: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
  list: {
    gap: 12,
  },
  item: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1.8,
    borderRadius: 16,
    borderWidth: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitleWrap: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  itemCopy: {
    flex: 1,
  },
  rank: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});

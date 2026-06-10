import { StyleSheet, Text, View } from 'react-native';
import type { BlockDefinition } from '../../core/types';
import { useRichUITheme } from '../rich-content/RichUIContext';
import {
  BadgeRow,
  CardSurface,
  MetaRow,
  SectionTitle,
  type BlockAppearance,
} from './primitives';

export interface FactCardProps {
  title?: string;
  subtitle?: string;
  body?: string;
  facts?: Array<{ label: string; value: string }>;
  badges?: string[];
  appearance?: BlockAppearance;
}

export function FactCard({
  title = 'Key details',
  subtitle,
  body,
  facts = [],
  badges = [],
  appearance,
}: FactCardProps) {
  const theme = useRichUITheme();
  const textColor = appearance?.textColor || theme.colors.primaryText;
  const mutedTextColor = appearance?.mutedTextColor || theme.colors.mutedText;
  const accentColor = appearance?.accentColor || theme.colors.primaryAccent;
  const surfaceColor = appearance?.raisedSurfaceColor || theme.colors.raisedSurface;

  return (
    <CardSurface appearance={appearance}>
      <View
        style={[
          styles.headerPanel,
          {
            backgroundColor: surfaceColor,
            borderColor: appearance?.borderColor || theme.colors.subtleBorder,
          },
        ]}
      >
        <View style={styles.kickerRow}>
          <View style={[styles.kickerBar, { backgroundColor: accentColor }]} />
          <Text style={[styles.kickerText, { color: mutedTextColor }]}>Quick brief</Text>
        </View>
        <SectionTitle title={title} subtitle={subtitle} appearance={appearance} />
      </View>
      {body ? (
        <Text style={[styles.body, { color: textColor }]}>
          {body}
        </Text>
      ) : null}
      {facts.length ? (
        <View
          style={[
            styles.factsPanel,
            {
              backgroundColor: surfaceColor,
              borderColor: appearance?.borderColor || theme.colors.subtleBorder,
            },
          ]}
        >
          <MetaRow items={facts} appearance={appearance} />
        </View>
      ) : null}
      <BadgeRow badges={badges} appearance={appearance} />
      {!facts.length && !badges.length && !body ? (
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: surfaceColor,
              borderColor: appearance?.borderColor || theme.colors.subtleBorder,
            },
          ]}
        >
          <Text style={[styles.placeholderText, { color: textColor }]}>
            Helpful facts will appear here.
          </Text>
        </View>
      ) : null}
    </CardSurface>
  );
}

FactCard.displayName = 'FactCard';

export const FactCardDefinition: BlockDefinition = {
  name: 'FactCard',
  component: FactCard,
  allowedPlacements: ['chat', 'zone'],
  interventionType: 'contextual_help',
  interventionEligible: true,
  propSchema: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    body: { type: 'string' },
    facts: { type: 'array' },
    badges: { type: 'array' },
  },
  previewTextBuilder: (props) =>
    [props.title, props.subtitle, props.body].filter((part): part is string => typeof part === 'string').join(' — '),
  styleSlots: ['surface', 'text', 'meta', 'badges'],
};

const styles = StyleSheet.create({
  headerPanel: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
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
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
  },
  factsPanel: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  placeholder: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

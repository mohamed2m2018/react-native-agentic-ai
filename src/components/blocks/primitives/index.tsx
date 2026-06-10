import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRichUITheme } from '../../rich-content/RichUIContext';

export interface BlockAppearance {
  surfaceColor?: string;
  raisedSurfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  accentColor?: string;
  priceBackgroundColor?: string;
  priceTextColor?: string;
}

function useAppearance(appearance?: BlockAppearance) {
  const theme = useRichUITheme();
  return {
    surfaceColor: appearance?.surfaceColor || theme.colors.blockSurface,
    raisedSurfaceColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
    borderColor: appearance?.borderColor || theme.colors.border,
    textColor: appearance?.textColor || theme.colors.primaryText,
    mutedTextColor: appearance?.mutedTextColor || theme.colors.mutedText,
    accentColor: appearance?.accentColor || theme.colors.primaryAccent,
    priceBackgroundColor:
      appearance?.priceBackgroundColor || theme.colors.priceTagBackground,
    priceTextColor: appearance?.priceTextColor || theme.colors.priceTagText,
  };
}

export function CardSurface({
  children,
  appearance,
}: {
  children: React.ReactNode;
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  return (
    <View
      style={[
        styles.cardSurface,
        {
          backgroundColor: palette.surfaceColor,
          borderColor: theme.colors.subtleBorder,
          borderRadius: theme.shape.cardRadius,
          padding: theme.spacing.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function MediaFrame({
  uri,
  appearance,
}: {
  uri?: string;
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  return uri ? (
    <Image
      source={{ uri }}
      style={[
        styles.media,
        {
          borderRadius: theme.shape.mediaRadius,
          borderColor: theme.colors.mediaBorder,
        },
      ]}
      resizeMode="cover"
    />
  ) : (
    <View
      style={[
        styles.media,
        {
          borderRadius: theme.shape.mediaRadius,
          backgroundColor: theme.colors.imagePlaceholder,
          borderColor: theme.colors.mediaBorder,
        },
      ]}
    />
  );
}

export function PriceTag({
  label,
  strikeThrough,
  appearance,
}: {
  label?: string;
  strikeThrough?: string;
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  if (!label) return null;

  return (
    <View
      style={[
        styles.priceTag,
        {
          backgroundColor: palette.priceBackgroundColor,
          borderColor: theme.colors.priceTagBorder,
        },
      ]}
    >
      <Text style={[styles.priceText, { color: palette.priceTextColor }]}>
        {label}
      </Text>
      {strikeThrough ? (
        <Text style={[styles.strikeText, { color: theme.colors.strikeThroughPrice }]}>
          {strikeThrough}
        </Text>
      ) : null}
    </View>
  );
}

export function BadgeRow({
  badges = [],
  appearance,
}: {
  badges?: string[];
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  if (!badges.length) return null;
  return (
    <View style={[styles.row, { gap: theme.spacing.xs, flexWrap: 'wrap' }]}>
      {badges.map((badge) => (
        <View
          key={badge}
          style={[
            styles.badge,
            {
              backgroundColor: theme.colors.chipFilledBackground,
              borderRadius: theme.shape.chipRadius,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: palette.textColor }]}>
            {badge}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function MetaRow({
  items = [],
  appearance,
}: {
  items?: Array<{ label: string; value: string }>;
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  if (!items.length) return null;
  return (
    <View style={[styles.column, { gap: theme.spacing.xs }]}>
      {items.map((item) => (
        <View key={item.label} style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: palette.mutedTextColor }]}>
            {item.label}
          </Text>
          <Text style={[styles.metaValue, { color: palette.textColor }]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ActionRow({
  actions = [],
  appearance,
  onAction,
}: {
  actions?: Array<{ id: string; label: string; variant?: 'primary' | 'secondary' | 'chip' }>;
  appearance?: BlockAppearance;
  onAction?: (actionId: string) => void;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  if (!actions.length) return null;
  return (
    <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
      {actions.map((action) => {
        const isPrimary = action.variant !== 'secondary' && action.variant !== 'chip';
        return (
          <Pressable
            key={action.id}
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  action.variant === 'chip'
                    ? theme.colors.chipOutlinedBorder
                    : isPrimary
                      ? palette.accentColor
                      : palette.raisedSurfaceColor,
                borderColor: palette.borderColor,
                borderRadius: action.variant === 'chip' ? theme.shape.chipRadius : theme.shape.controlRadius,
              },
            ]}
            onPress={() => onAction?.(action.id)}
          >
            <Text
              style={[
                styles.actionLabel,
                {
                  color:
                    action.variant === 'secondary'
                      ? palette.textColor
                      : theme.colors.inverseText,
                },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FieldRow({
  label,
  value,
  placeholder,
  appearance,
  onChangeText,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  appearance?: BlockAppearance;
  onChangeText?: (value: string) => void;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  return (
    <View style={[styles.column, { gap: theme.spacing.xs }]}>
      <Text style={[styles.metaLabel, { color: palette.mutedTextColor }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.placeholder}
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.fieldBackground,
            borderColor: theme.colors.fieldBorder,
            color: palette.textColor,
            borderRadius: theme.shape.controlRadius,
          },
        ]}
      />
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
  appearance,
}: {
  title: string;
  subtitle?: string;
  appearance?: BlockAppearance;
}) {
  const theme = useRichUITheme();
  const palette = useAppearance(appearance);
  return (
    <View style={[styles.column, { gap: theme.spacing.xxs }]}>
      <Text style={[styles.title, { color: palette.textColor }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.mutedTextColor }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardSurface: {
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  media: {
    width: '100%',
    aspectRatio: 1.35,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
  },
  priceTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  strikeText: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  actionButton: {
    minHeight: 42,
    minWidth: 88,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  field: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import type { BlockDefinition } from '../../core/types';
import { useActionBridge } from '../../core/ActionBridge';
import { useRichUITheme } from '../rich-content/RichUIContext';
import {
  ActionRow,
  CardSurface,
  SectionTitle,
  type BlockAppearance,
} from './primitives';

export interface ActionCardProps {
  title?: string;
  body?: string;
  actions?: Array<{ id: string; label: string; variant?: 'primary' | 'secondary' | 'chip' }>;
  appearance?: BlockAppearance;
}

export function ActionCard({
  title = 'Suggested next step',
  body,
  actions = [],
  appearance,
}: ActionCardProps) {
  const bridge = useActionBridge();
  const theme = useRichUITheme();
  const accentColor = appearance?.accentColor || theme.colors.primaryAccent;
  return (
    <CardSurface appearance={appearance}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
            borderColor: appearance?.borderColor || theme.colors.subtleBorder,
          },
        ]}
      >
        <View style={[styles.accentOrb, { backgroundColor: accentColor }]} />
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: appearance?.mutedTextColor || theme.colors.mutedText }]}>
            Suggested next step
          </Text>
          <SectionTitle title={title} appearance={appearance} />
        </View>
      </View>
      {body ? (
        <Text style={[styles.body, { color: appearance?.textColor || theme.colors.primaryText }]}>
          {body}
        </Text>
      ) : null}
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

ActionCard.displayName = 'ActionCard';

export const ActionCardDefinition: BlockDefinition = {
  name: 'ActionCard',
  component: ActionCard,
  allowedPlacements: ['chat', 'zone'],
  interventionType: 'recovery',
  interventionEligible: true,
  propSchema: {
    title: { type: 'string' },
    body: { type: 'string' },
    actions: { type: 'array' },
  },
  previewTextBuilder: (props) =>
    [props.title, props.body].filter((part): part is string => typeof part === 'string').join(' — '),
  styleSlots: ['surface', 'actions'],
};

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  accentOrb: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginTop: 6,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
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
});

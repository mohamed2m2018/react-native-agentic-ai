import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BlockDefinition } from '../../core/types';
import { useActionBridge } from '../../core/ActionBridge';
import { useRichUITheme } from '../rich-content/RichUIContext';
import {
  ActionRow,
  CardSurface,
  FieldRow,
  SectionTitle,
  type BlockAppearance,
} from './primitives';

export interface FormField {
  id: string;
  label: string;
  placeholder?: string;
  value?: string;
}

export interface FormCardProps {
  title?: string;
  description?: string;
  fields?: FormField[];
  submitActionId?: string;
  cancelActionId?: string;
  appearance?: BlockAppearance;
}

export function FormCard({
  title = 'Complete the details',
  description,
  fields = [],
  submitActionId,
  cancelActionId,
  appearance,
}: FormCardProps) {
  const theme = useRichUITheme();
  const bridge = useActionBridge();
  const accentColor = appearance?.accentColor || theme.colors.primaryAccent;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, field.value || '']))
  );

  const actions = useMemo(
    () =>
      [
        submitActionId ? { id: submitActionId, label: 'Submit', variant: 'primary' as const } : null,
        cancelActionId ? { id: cancelActionId, label: 'Cancel', variant: 'secondary' as const } : null,
      ].filter(Boolean) as Array<{ id: string; label: string; variant?: 'primary' | 'secondary' | 'chip' }>,
    [submitActionId, cancelActionId]
  );

  return (
    <CardSurface appearance={appearance}>
      <View
        style={[
          styles.headerPanel,
          {
            backgroundColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
            borderColor: appearance?.borderColor || theme.colors.subtleBorder,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.headerDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.headerEyebrow, { color: appearance?.mutedTextColor || theme.colors.mutedText }]}>
            Quick input
          </Text>
        </View>
        <SectionTitle title={title} appearance={appearance} />
      </View>
      {description ? (
        <Text style={[styles.description, { color: appearance?.textColor || theme.colors.primaryText }]}>
          {description}
        </Text>
      ) : null}
      <View
        style={[
          styles.fields,
          {
            backgroundColor: appearance?.raisedSurfaceColor || theme.colors.raisedSurface,
            borderColor: appearance?.borderColor || theme.colors.subtleBorder,
          },
        ]}
      >
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            label={field.label}
            placeholder={field.placeholder}
            value={values[field.id] || ''}
            appearance={appearance}
            onChangeText={(nextValue) => {
              setValues((prev) => ({ ...prev, [field.id]: nextValue }));
            }}
          />
        ))}
      </View>
      <ActionRow
        actions={actions}
        appearance={appearance}
        onAction={(actionId) => {
          bridge.invoke({
            actionId,
            values,
          });
        }}
      />
    </CardSurface>
  );
}

FormCard.displayName = 'FormCard';

export const FormCardDefinition: BlockDefinition = {
  name: 'FormCard',
  component: FormCard,
  allowedPlacements: ['chat', 'zone'],
  interventionType: 'error_prevention',
  interventionEligible: true,
  propSchema: {
    title: { type: 'string' },
    description: { type: 'string' },
    fields: { type: 'array', required: true },
    submitActionId: { type: 'string' },
    cancelActionId: { type: 'string' },
  },
  previewTextBuilder: (props) =>
    [props.title, props.description].filter((part): part is string => typeof part === 'string').join(' — '),
  styleSlots: ['surface', 'fields', 'actions'],
};

const styles = StyleSheet.create({
  headerPanel: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  headerEyebrow: {
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
  fields: {
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});

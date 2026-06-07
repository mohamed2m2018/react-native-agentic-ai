import { Pressable, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function SubscriptionOptionChip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7dbe7',
    backgroundColor: '#f5f6fb',
  },
  chipSelected: {
    backgroundColor: '#1a1a2e',
    borderColor: '#1a1a2e',
  },
  chipText: {
    color: '#495057',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
});

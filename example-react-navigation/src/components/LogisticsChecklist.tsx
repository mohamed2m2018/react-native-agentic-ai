import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type Props = {
  items: ChecklistItem[];
  onToggle: (id: string, checked: boolean) => void;
};

export function LogisticsChecklist({ items, onToggle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mandatory Checks</Text>
      <Text style={styles.subtitle}>Before initiating an investigation or refund, verify the following:</Text>

      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.row, item.checked && styles.rowChecked]}
          onPress={() => onToggle(item.id, !item.checked)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.label, item.checked && styles.labelChecked]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowChecked: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
  },
  labelChecked: {
    color: '#166534',
    fontWeight: '500',
  },
});

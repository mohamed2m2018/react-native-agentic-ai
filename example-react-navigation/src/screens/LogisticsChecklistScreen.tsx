import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { LogisticsChecklist } from '../components/LogisticsChecklist';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LogisticsChecklist'>;

export default function LogisticsChecklistScreen({ navigation, route }: Props) {
  const { disputeId } = route.params;
  
  const [checks, setChecks] = useState([
    { id: 'c1', label: 'I checked around the main entrance / lobby', checked: false },
    { id: 'c2', label: 'I verified the drop-off address is correct', checked: false },
    { id: 'c3', label: 'I asked neighbors / leasing office', checked: false },
  ]);

  const handleToggleCheck = (id: string, checked: boolean) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, checked } : c));
  };

  const allChecked = checks.every(c => c.checked);

  return (
    <View style={styles.main}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <LogisticsChecklist items={checks} onToggle={handleToggleCheck} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.primaryButton, !allChecked && styles.primaryButtonDisabled]} 
          onPress={() => navigation.navigate('LogisticsResolution', { disputeId })}
          disabled={!allChecked}
        >
          <Text style={styles.primaryButtonText}>Next: Select Resolution</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16 },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: '#ec4899',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

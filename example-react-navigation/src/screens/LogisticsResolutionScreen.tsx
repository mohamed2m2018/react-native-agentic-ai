import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { fetchLogisticsDispute, LogisticsDisputeRecord } from '../supportData';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LogisticsResolution'>;

export default function LogisticsResolutionScreen({ navigation, route }: Props) {
  const { disputeId } = route.params;
  const [record, setRecord] = useState<LogisticsDisputeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);

  useEffect(() => {
    fetchLogisticsDispute(disputeId).then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, [disputeId]);

  const handleSubmit = () => {
    if (!selectedResolution) {
      Alert.alert('Selection Required', 'Please select a resolution option.');
      return;
    }
    Alert.alert('Dispute Submitted', 'Your request has been processed.', [
      { text: 'Done', onPress: () => navigation.navigate('Profile') }
    ]);
  };

  if (loading || !record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.resolutionContainer}>
            <Text style={styles.resolutionTitle}>Select Resolution</Text>
            <Text style={styles.resolutionSubtitle}>We verified your checks. Select how you would like us to make this right.</Text>
            
            {record.resolutionOptions.map(opt => {
              const isSelected = selectedResolution === opt.type;
              return (
                <TouchableOpacity 
                  key={opt.type} 
                  style={[styles.resOption, isSelected && styles.resOptionSelected]}
                  onPress={() => setSelectedResolution(opt.type)}
                >
                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <Text style={[styles.resOptionTitle, isSelected && styles.resOptionTitleSelected]}>
                      {opt.type === 'refund' && 'Refund to original payment'}
                      {opt.type === 'credit' && 'App Wallet Credit (Instant)'}
                      {opt.type === 'reorder' && 'Reorder exact items'}
                    </Text>
                    {opt.value > 0 && (
                      <Text style={styles.resOptionValue}>${opt.value.toFixed(2)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleSubmit}
        >
          <Text style={styles.primaryButtonText}>Submit Claim</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16 },
  resolutionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resolutionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  resolutionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  resOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  resOptionSelected: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#059669',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#059669',
  },
  resOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  resOptionTitleSelected: {
    color: '#065f46',
  },
  resOptionValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
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
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

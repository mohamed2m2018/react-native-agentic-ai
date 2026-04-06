import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { fetchFraudInvestigation, FraudInvestigationRecord } from '../supportData';
import { FraudDeviceList } from '../components/FraudDeviceList';
import { FraudStepIndicator } from '../components/FraudStepIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FraudDevice'>;

export default function FraudDeviceScreen({ navigation }: Props) {
  const [record, setRecord] = useState<FraudInvestigationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFraudInvestigation('usr_abc123').then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, []);

  const handleToggleDevice = (deviceId: string, revoke: boolean) => {
    if (!record) return;
    const nextDevices = record.recentDevices.map(d => 
      d.id === deviceId ? { ...d, status: revoke ? ('revoked' as const) : ('active' as const) } : d
    );
    setRecord({ ...record, recentDevices: nextDevices });
  };

  const handleNext = () => {
    navigation.navigate('FraudResolution', { 
      revokedCount: record?.recentDevices.filter(d => d.status === 'revoked').length || 0 
    });
  };

  if (loading || !record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <FraudStepIndicator 
        currentStep={2} 
        totalSteps={3} 
        labels={['Identity Quiz', 'Device Audit', 'Resolution']} 
      />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <FraudDeviceList 
          devices={record.recentDevices} 
          onToggleDevice={handleToggleDevice} 
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>Confirm Devices</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16 },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
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

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchFraudInvestigation, FraudInvestigationRecord } from '../supportData';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FraudLockdown'>;

export default function FraudLockdownScreen({ navigation }: Props) {
  const [record, setRecord] = useState<FraudInvestigationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFraudInvestigation('usr_abc123').then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, []);

  if (loading || !record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <View style={styles.header}>
        <Text style={styles.lockdownAlert}>⚠ ACCOUNT LOCKED</Text>
        <Text style={styles.lockReason}>{record.lockReason}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Action Required</Text>
        <Text style={styles.body}>
          We detected suspicious activity on your account. For your protection, all payment methods and ordering capabilities have been disabled.
        </Text>
        <Text style={styles.body}>
          To restore access, you must complete the highly-secure 3-step Identity Verification process.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => navigation.navigate('FraudQuiz')}
        >
          <Text style={styles.primaryButtonText}>Start Verification Wizard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  lockdownAlert: {
    color: '#991b1b',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  lockReason: {
    color: '#7f1d1d',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 16,
  },
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

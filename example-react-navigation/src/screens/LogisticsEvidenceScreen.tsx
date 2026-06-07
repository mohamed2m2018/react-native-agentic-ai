import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchLogisticsDispute, LogisticsDisputeRecord } from '../supportData';
import { LogisticsEvidenceViewer } from '../components/LogisticsEvidenceViewer';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LogisticsEvidence'>;

export default function LogisticsEvidenceScreen({ navigation, route }: Props) {
  const { disputeId } = route.params;
  const [record, setRecord] = useState<LogisticsDisputeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogisticsDispute(disputeId).then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, [disputeId]);

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
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Order #{record.orderId} Missing</Text>
          <Text style={styles.headerSubtitle}>Courier: {record.courierName}</Text>
        </View>

        <LogisticsEvidenceViewer record={record} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => navigation.navigate('LogisticsChecklist', { disputeId })}
        >
          <Text style={styles.primaryButtonText}>Next: Complete Checks</Text>
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
  headerBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
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

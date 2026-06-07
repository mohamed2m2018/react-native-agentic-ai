import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AdvancedSupportDashboard'>;

export default function AdvancedSupportDashboardScreen({ navigation }: Props) {
  return (
    <View style={styles.main}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>Escalations & Investigations</Text>
        <Text style={styles.sectionSubtitle}>Select an issue below to start the complex resolution workflow.</Text>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('FraudLockdown')}
        >
          <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Account Security Hold</Text>
            <Text style={styles.cardDesc}>Resolve suspicious logins through advanced identity verification and device revocation.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('LogisticsEvidence', { disputeId: 'log_8001' })}
        >
          <View style={[styles.iconBox, { backgroundColor: '#fce7f3' }]}>
            <Text style={styles.iconText}>📦</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Delivery Forensic Dispute</Text>
            <Text style={styles.cardDesc}>Review driver GPS logs and complete a mandatory checklist to resolve a missing order claim.</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});

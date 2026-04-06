import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Alert } from 'react-native';
import { FraudStepIndicator } from '../components/FraudStepIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FraudResolution'>;

export default function FraudResolutionScreen({ navigation, route }: Props) {
  const { revokedCount } = route.params;

  const handleComplete = () => {
    Alert.alert('Account Verified', 'Your account access has been restored.', [
      { text: 'OK', onPress: () => navigation.navigate('Profile') }
    ]);
  };

  return (
    <View style={styles.main}>
      <FraudStepIndicator 
        currentStep={3} 
        totalSteps={3} 
        labels={['Identity Quiz', 'Device Audit', 'Resolution']} 
      />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.resolutionContainer}>
          <Text style={styles.resolutionTitle}>Final Review</Text>
          <Text style={styles.resolutionText}>Your identity passes our automated checks. By unlocking your account, you agree that you are responsible for any future actions taken by the devices you left active.</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>Devices revoked: {revokedCount}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
          <Text style={styles.primaryButtonText}>Unlock Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8fafc' },
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
  resolutionContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resolutionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#0f172a',
  },
  resolutionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  }
});

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { fetchFraudInvestigation, FraudInvestigationRecord } from '../supportData';
import { FraudIdentityQuiz } from '../components/FraudIdentityQuiz';
import { FraudStepIndicator } from '../components/FraudStepIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FraudQuiz'>;

export default function FraudQuizScreen({ navigation }: Props) {
  const [record, setRecord] = useState<FraudInvestigationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchFraudInvestigation('usr_abc123').then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, []);

  const handleAnswerQuiz = (qId: string, optIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const handleNext = () => {
    if (!record) return;
    
    const allAnswered = record.securityQuestions.every(q => quizAnswers[q.id] !== undefined);
    if (!allAnswered) {
      Alert.alert('Incomplete', 'Please answer all identity questions.');
      return;
    }
    
    navigation.navigate('FraudDevice');
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
        currentStep={1} 
        totalSteps={3} 
        labels={['Identity Quiz', 'Device Audit', 'Resolution']} 
      />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <FraudIdentityQuiz 
          questions={record.securityQuestions} 
          answers={quizAnswers} 
          onAnswer={handleAnswerQuiz} 
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>Verify Identity</Text>
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

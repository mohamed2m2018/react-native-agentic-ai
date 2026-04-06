import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Question = {
  id: string;
  question: string;
  options: string[];
};

type Props = {
  questions: Question[];
  answers: Record<string, number>;
  onAnswer: (questionId: string, optionIndex: number) => void;
};

export function FraudIdentityQuiz({ questions, answers, onAnswer }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Identity Verification Quiz</Text>
      <Text style={styles.subtitle}>Please answer the following questions to verify you own this account.</Text>

      {questions.map((q, qIndex) => (
        <View key={q.id} style={styles.questionBlock}>
          <Text style={styles.questionText}>{qIndex + 1}. {q.question}</Text>
          {q.options.map((opt, optIndex) => {
            const isSelected = answers[q.id] === optIndex;
            return (
              <TouchableOpacity
                key={optIndex}
                style={[styles.optionRow, isSelected && styles.optionSelected]}
                onPress={() => onAnswer(q.id, optIndex)}
              >
                <View style={[styles.radio, isSelected && styles.radioActive]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  questionBlock: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  optionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
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
    borderColor: '#3b82f6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  optionText: {
    fontSize: 15,
    color: '#475569',
  },
  optionTextSelected: {
    color: '#1e3a8a',
    fontWeight: '500',
  },
});

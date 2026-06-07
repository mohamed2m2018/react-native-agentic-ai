import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  currentStep: number;
  totalSteps: number;
  labels: string[];
};

export function FraudStepIndicator({ currentStep, totalSteps, labels }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>
      <View style={styles.labelsContainer}>
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isPassed = stepNum < currentStep;
          return (
            <View key={stepNum} style={styles.labelBlock}>
              <View style={[styles.circle, isActive && styles.circleActive, isPassed && styles.circlePassed]}>
                <Text style={[styles.circleText, (isActive || isPassed) && styles.circleTextActive]}>{stepNum}</Text>
              </View>
              <Text style={[styles.labelText, isActive && styles.labelTextActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginBottom: 16,
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelBlock: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  circleActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  circlePassed: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  circleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  circleTextActive: {
    color: '#fff',
  },
  labelText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  labelTextActive: {
    color: '#1e3a8a',
    fontWeight: '600',
  },
});

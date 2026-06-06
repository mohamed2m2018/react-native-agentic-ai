import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'ReportIssue'>;

export default function ReportIssueScreen({ route }: Props) {
  // Params are fully optional — screen must never crash when navigated to without context
  const itemName = route.params?.itemName ?? 'this item';
  const itemId   = route.params?.itemId   ?? 'N/A';

  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const ISSUE_TYPES = ['Inaccurate Information', 'Spam', 'Offensive Content', 'Other'];

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successText}>
          Thank you for your report about "{itemName}". We'll review it shortly.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Report Issue</Text>
      <Text style={styles.subtitle}>
        {itemId !== 'N/A'
          ? `Report a problem with "${itemName}" (ID: ${itemId})`
          : 'Report a problem'}
      </Text>

      <Text style={styles.label}>Issue Type</Text>
      {ISSUE_TYPES.map(type => (
        <Pressable
          key={type}
          style={[styles.option, issueType === type && styles.optionSelected]}
          onPress={() => setIssueType(type)}
        >
          <Text style={[styles.optionText, issueType === type && styles.optionTextSelected]}>{type}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the issue in detail..."
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Pressable
        style={[styles.submitButton, (!issueType || !description) && styles.submitDisabled]}
        onPress={() => { if (issueType && description) setSubmitted(true); }}
      >
        <Text style={styles.submitText}>Submit Report</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', padding: 40 },
  scrollContainer: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginTop: 16, marginBottom: 8 },
  option: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionSelected: { borderColor: '#1a1a2e', backgroundColor: '#f0f0ff' },
  optionText: { fontSize: 15, color: '#495057' },
  optionTextSelected: { color: '#1a1a2e', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  submitButton: { backgroundColor: '#dc3545', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successIcon: { fontSize: 48, color: '#28a745', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  successText: { fontSize: 16, color: '#6c757d', textAlign: 'center', lineHeight: 24 },
});

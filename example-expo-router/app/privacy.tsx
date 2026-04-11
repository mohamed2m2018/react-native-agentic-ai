import { StyleSheet, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: March 2026</Text>

      <Text style={styles.heading}>Data Collection</Text>
      <Text style={styles.body}>
        This demo app does not collect or store any personal data. All interactions with the AI agent
        are processed in real-time and are not persisted.
      </Text>

      <Text style={styles.heading}>AI Agent</Text>
      <Text style={styles.body}>
        The AI agent reads your screen's UI hierarchy to understand context and perform actions.
        It does not access any data marked with content masking or security gating.
      </Text>

      <Text style={styles.heading}>Third-Party Services</Text>
      <Text style={styles.body}>
        This app sends AI requests through the MobileAI dashboard proxy, which forwards them to
        the configured Gemini model. Please refer to your MobileAI deployment and Gemini privacy
        policies for details about how request data is handled.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold' },
  updated: { fontSize: 13, color: '#6c757d', marginTop: 4, marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, color: '#555' },
});

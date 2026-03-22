import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';

const FAQ = [
  { q: 'How does the AI agent work?', a: 'The AI reads your screen\'s UI tree and performs actions like tapping, scrolling, and navigating — just like a human user.' },
  { q: 'Is it safe?', a: 'Yes. Sensitive elements can be hidden from the AI using content masking, and critical actions require human confirmation via the useAction hook.' },
  { q: 'What screens can the AI navigate to?', a: 'The AI can navigate to any screen registered in your navigation tree. It discovers available routes automatically.' },
  { q: 'Does it work with Expo Router?', a: 'Yes! This demo app uses Expo Router. The AIAgent component wraps your root layout and works seamlessly with file-based routing.' },
];

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help Center</Text>
      <Text style={styles.subtitle}>Frequently Asked Questions</Text>

      {FAQ.map((item, i) => (
        <View key={i} style={styles.faqCard}>
          <Text style={styles.question}>{item.q}</Text>
          <Text style={styles.answer}>{item.a}</Text>
        </View>
      ))}

      <Pressable style={styles.contactBtn}>
        <Text style={styles.contactBtnText}>Contact Support</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#6c757d', marginTop: 4, marginBottom: 24 },
  faqCard: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.08)', marginBottom: 12 },
  question: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  answer: { fontSize: 14, lineHeight: 20, color: '#555' },
  contactBtn: { backgroundColor: '#3498DB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  contactBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

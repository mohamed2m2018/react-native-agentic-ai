import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';

const FAQ = [
  {
    q: 'How does the AI support flow work?',
    a: 'Ask any delivery question, and the AI will use order context to give a relevant next step, from ETA checks to support article references.',
  },
  {
    q: 'Can it handle refunds and late deliveries?',
    a: 'Yes. It can file missing-item, late-delivery, and refund issues and escalate with the order metadata already attached.',
  },
  {
    q: 'What are escalation triggers?',
    a: 'Courier safety, food allergy concerns, duplicate charges, and undelivered complaints are treated as high-sensitivity cases.',
  },
  {
    q: 'How do I test a flow quickly?',
    a: 'From Home → pick a restaurant → add to cart → checkout → open order tracking → tap Need Help.',
  },
];

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Support Center</Text>
      <Text style={styles.subtitle}>Food support scenarios and escalation behavior</Text>

      {FAQ.map((item, i) => (
        <View key={i} style={styles.faqCard}>
          <Text style={styles.question}>{item.q}</Text>
          <Text style={styles.answer}>{item.a}</Text>
        </View>
      ))}

      <Pressable style={styles.contactBtn}>
        <Text style={styles.contactBtnText}>Open Live Support</Text>
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
  contactBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  contactBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

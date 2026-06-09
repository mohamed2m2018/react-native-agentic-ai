import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { paymentMethods, currentPaymentMethod, setPaymentMethod } = useFoodDelivery();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Payment Methods</Text>
      {paymentMethods.map((method) => {
        const selected = method === currentPaymentMethod;
        return (
          <Pressable
            key={method}
            style={[styles.row, selected && styles.selected]}
            onPress={() => {
              setPaymentMethod(method);
              router.back();
            }}
          >
            <Text style={styles.text}>{method}</Text>
            {selected ? <Text style={styles.selectedText}>Default</Text> : null}
          </Pressable>
        );
      })}
      <Pressable style={styles.note} onPress={() => Alert.alert('Payment methods', 'Use Card/Apple Pay/PayPal integrations in real app.')}>
        <Text style={styles.noteText}>In real app, add/remove methods from account profile.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 12 },
  row: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selected: { borderColor: '#2563EB', backgroundColor: 'rgba(59,130,246,0.12)' },
  text: { fontSize: 16, fontWeight: '600' },
  selectedText: { color: '#1D4ED8', fontWeight: '700' },
  note: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  noteText: { color: '#475569' },
});

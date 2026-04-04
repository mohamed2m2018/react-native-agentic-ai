import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';
import { fetchCharges, type ChargeRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BillingHistory'>;

export default function BillingHistoryScreen({ navigation }: Props) {
  const [charges, setCharges] = useState<ChargeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharges().then((nextCharges) => {
      setCharges(nextCharges);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading billing history...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Billing History</Text>
      <Text style={styles.subtitle}>
        Review recent charges, receipts, and payment status.
      </Text>
      {charges.map((charge) => (
        <Pressable
          key={charge.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate('ChargeDetails', { chargeId: charge.id })
          }
        >
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{charge.label}</Text>
              <Text style={styles.cardMeta}>
                {charge.id} · {charge.status}
              </Text>
            </View>
            <Text style={styles.amount}>${charge.amount.toFixed(2)}</Text>
          </View>
          <Text style={styles.summary}>
            {charge.breakdown.length} line items recorded for this charge.
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 14,
    color: '#6c757d',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6c757d' },
  amount: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  summary: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

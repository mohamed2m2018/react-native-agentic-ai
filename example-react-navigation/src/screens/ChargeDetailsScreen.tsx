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
import { fetchCharge, type ChargeRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChargeDetails'>;

export default function ChargeDetailsScreen({ route, navigation }: Props) {
  const [charge, setCharge] = useState<ChargeRecord | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharge(route.params.chargeId).then((nextCharge) => {
      setCharge(nextCharge);
      setLoading(false);
    });
  }, [route.params.chargeId]);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading charge details...</Text>
      </View>
    );
  }

  if (!charge) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Charge not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{charge.label}</Text>
        <Text style={styles.heroMeta}>
          {charge.id} · {charge.status}
        </Text>
        <Text style={styles.heroAmount}>${charge.amount.toFixed(2)}</Text>
        <Text style={styles.issueSummary}>
          Review the line items below to confirm the final amount.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Charge Breakdown</Text>
        {charge.breakdown.map((line) => (
          <View key={line.label} style={styles.lineRow}>
            <Text style={styles.lineLabel}>{line.label}</Text>
            <Text style={styles.lineAmount}>${line.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {charge.orderId ? (
        <Pressable
          style={styles.linkButton}
          onPress={() =>
            navigation.navigate('OrderDetails', { orderId: charge.orderId! })
          }
        >
          <Text style={styles.linkButtonText}>Open Linked Order</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  heroCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  heroTitle: { fontSize: 21, fontWeight: '700', color: '#1a1a2e' },
  heroMeta: { marginTop: 6, fontSize: 12, color: '#6c757d' },
  heroAmount: {
    marginTop: 14,
    fontSize: 30,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  issueSummary: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
  },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineLabel: { fontSize: 14, color: '#495057' },
  lineAmount: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  linkButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  linkButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

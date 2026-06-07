import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';
import { fetchGift, type GiftRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GiftDetails'>;

export default function GiftDetailsScreen({ route }: Props) {
  const [gift, setGift] = useState<GiftRecord | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGift(route.params.giftId).then((nextGift) => {
      setGift(nextGift);
      setLoading(false);
    });
  }, [route.params.giftId]);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading gift details...</Text>
      </View>
    );
  }

  if (!gift) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Gift record not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{gift.rewardName}</Text>
        <Text style={styles.meta}>
          {gift.id} · {gift.sentAt}
        </Text>
        <Text style={styles.status}>{gift.deliveryStatus}</Text>
        <Text style={styles.detailLabel}>Recipient</Text>
        <Text style={styles.detailValue}>{gift.recipientEmail}</Text>
        <Text style={styles.detailLabel}>Ops note</Text>
        <Text style={styles.detailValue}>
          Recipient email contains a typo and the bounce webhook was received
          after send.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  meta: { fontSize: 12, color: '#6c757d' },
  status: { marginTop: 10, fontSize: 14, fontWeight: '700', color: '#3498db' },
  detailLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
  },
  detailValue: { fontSize: 14, lineHeight: 20, color: '#1a1a2e' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

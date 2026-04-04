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
import { fetchGiftHistory, type GiftRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GiftHistory'>;

export default function GiftHistoryScreen({ navigation }: Props) {
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGiftHistory().then((nextGifts) => {
      setGifts(nextGifts);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading gift history...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Gift History</Text>
      <Text style={styles.subtitle}>
        Review sent gift cards and delivery status.
      </Text>
      {gifts.map((gift) => (
        <Pressable
          key={gift.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate('GiftDetails', { giftId: gift.id })
          }
        >
          <Text style={styles.cardTitle}>{gift.rewardName}</Text>
          <Text style={styles.cardMeta}>
            {gift.recipientEmail} · {gift.deliveryStatus}
          </Text>
          <Text style={styles.summary}>Sent {gift.sentAt}</Text>
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
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  cardMeta: { marginTop: 6, fontSize: 12, color: '#6c757d' },
  summary: {
    marginTop: 12,
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

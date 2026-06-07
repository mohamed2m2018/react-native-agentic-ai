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
import { fetchLoyaltyActivity, type LoyaltyEntry } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LoyaltyActivity'>;

export default function LoyaltyActivityScreen(_: Props) {
  const [entries, setEntries] = useState<LoyaltyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyaltyActivity().then((nextEntries) => {
      setEntries(nextEntries);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading loyalty ledger...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Loyalty Activity</Text>
        <Text style={styles.bannerBody}>
          Points usually post after orders and bonus activity sync shortly
          afterward.
        </Text>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{entry.title}</Text>
              <Text style={styles.cardMeta}>{entry.happenedAt}</Text>
            </View>
            <Text
              style={[styles.points, entry.points < 0 && styles.pointsNegative]}
            >
              {entry.points > 0 ? '+' : ''}
              {entry.points} pts
            </Text>
          </View>
          <Text style={styles.status}>{entry.status}</Text>
          {entry.relatedOrderId ? (
            <Text style={styles.relatedOrder}>
              Linked order: {entry.relatedOrderId}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  banner: {
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#1b5e20' },
  bannerBody: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#2e7d32' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6c757d' },
  points: { fontSize: 16, fontWeight: '800', color: '#27ae60' },
  pointsNegative: { color: '#c0392b' },
  status: { marginTop: 12, fontSize: 13, color: '#b9770e', fontWeight: '700' },
  relatedOrder: { marginTop: 6, fontSize: 12, color: '#6c757d' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

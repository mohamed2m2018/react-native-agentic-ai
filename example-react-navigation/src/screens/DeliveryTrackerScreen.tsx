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
import { fetchOrder, type OrderRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DeliveryTracker'>;

export default function DeliveryTrackerScreen({ route }: Props) {
  const [order, setOrder] = useState<OrderRecord | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder(route.params.orderId).then((nextOrder) => {
      setOrder(nextOrder);
      setLoading(false);
    });
  }, [route.params.orderId]);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Tracking courier updates...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Tracker unavailable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>ETA {order.etaWindow}</Text>
        <Text style={styles.bannerBody}>
          {order.status} · {order.courierStatus}
        </Text>
      </View>
      {order.timelines.map((entry, index) => (
        <View key={entry.id} style={styles.timelineRow}>
          <View style={styles.timelineDotWrap}>
            <View
              style={[
                styles.timelineDot,
                index === order.timelines.length - 1 && styles.timelineDotAlert,
              ]}
            />
            {index < order.timelines.length - 1 ? (
              <View style={styles.timelineLine} />
            ) : null}
          </View>
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>{entry.title}</Text>
            <Text style={styles.timelineTime}>{entry.timestamp}</Text>
            <Text style={styles.timelineDetail}>{entry.detail}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  banner: {
    backgroundColor: '#fff3cd',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe69c',
  },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: '#7d6608' },
  bannerBody: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#7d6608' },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  timelineDotWrap: { alignItems: 'center' },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2ecc71',
    marginTop: 6,
  },
  timelineDotAlert: { backgroundColor: '#f39c12' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#dfe6e9', marginTop: 6 },
  timelineCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  timelineTime: { marginTop: 4, fontSize: 12, color: '#6c757d' },
  timelineDetail: {
    marginTop: 8,
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

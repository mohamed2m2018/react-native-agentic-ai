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
import { fetchOrders, type OrderRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'OrdersList'>;

export default function OrdersListScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders().then((nextOrders) => {
      setOrders(nextOrders);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading recent orders...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Recent Orders</Text>
      <Text style={styles.subtitle}>
        Review recent orders, delivery timing, and item details.
      </Text>

      {orders.map((order) => (
        <Pressable
          key={order.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate('OrderDetails', { orderId: order.id })
          }
        >
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{order.restaurant}</Text>
              <Text style={styles.cardMeta}>
                {order.id} · {order.status}
              </Text>
            </View>
            <Text style={styles.total}>${order.total.toFixed(2)}</Text>
          </View>
          <Text style={styles.snapshot}>ETA {order.etaWindow}</Text>
          <Text style={styles.snapshotMeta}>
            {order.itemCount} items · Placed {order.placedAt}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a2e' },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  cardMeta: { fontSize: 13, color: '#6c757d', marginTop: 4 },
  total: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  snapshot: {
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
    marginTop: 14,
  },
  snapshotMeta: { fontSize: 13, color: '#6c757d', marginTop: 6 },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

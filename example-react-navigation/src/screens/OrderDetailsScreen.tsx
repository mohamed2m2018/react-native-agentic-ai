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
import { fetchOrder, type OrderRecord } from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'OrderDetails'>;

export default function OrderDetailsScreen({ route, navigation }: Props) {
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
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Order not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{order.restaurant}</Text>
        <Text style={styles.heroMeta}>
          {order.id} · {order.status}
        </Text>
        <Text style={styles.heroSummary}>
          Placed {order.placedAt} with an ETA of {order.etaWindow}.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Snapshot</Text>
        <Text style={styles.bodyText}>Status: {order.status}</Text>
        <Text style={styles.bodyText}>Placed: {order.placedAt}</Text>
        <Text style={styles.bodyText}>ETA: {order.etaWindow}</Text>
        <Text style={styles.bodyText}>
          Latest update: {order.courierStatus}
        </Text>
        <Text style={styles.bodyText}>Total: ${order.total.toFixed(2)}</Text>
        {order.missingItem ? (
          <Text style={styles.alertText}>
            Missing item reported: {order.missingItem}
          </Text>
        ) : null}
        {order.allergyNote ? (
          <Text style={styles.alertText}>
            Special note: {order.allergyNote}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.name} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {item.qty}x {item.name}
              </Text>
              {item.note ? (
                <Text style={styles.itemNote}>{item.note}</Text>
              ) : null}
            </View>
            <Text style={styles.itemPrice}>
              ${(item.price * item.qty).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() =>
          navigation.navigate('DeliveryTracker', { orderId: order.id })
        }
      >
        <Text style={styles.primaryButtonText}>Open Delivery Tracker</Text>
      </Pressable>

      {order.chargeId ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('ChargeDetails', { chargeId: order.chargeId! })
          }
        >
          <Text style={styles.secondaryButtonText}>Open Linked Charge</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  heroMeta: { marginTop: 6, fontSize: 13, color: '#6c757d' },
  heroSummary: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#495057' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  bodyText: { fontSize: 14, color: '#495057', lineHeight: 20 },
  alertText: {
    fontSize: 14,
    color: '#b9770e',
    fontWeight: '600',
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  itemNote: { marginTop: 4, fontSize: 12, color: '#6c757d' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  primaryButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dfe6e9',
  },
  secondaryButtonText: { color: '#1a1a2e', fontSize: 16, fontWeight: '700' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

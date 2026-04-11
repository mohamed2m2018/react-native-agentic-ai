import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { useFoodDelivery, type OrderStatus } from '@/app/lib/delivery-demo';

export default function TrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrderById } = useFoodDelivery();
  const order = getOrderById(id);

  if (!order) {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Text style={styles.title}>Order not found</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/orders')}>
          <Text style={styles.primaryText}>Go to Orders</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const statusColor: Record<OrderStatus | 'Undelivered', string> = {
    'Order Placed': '#0EA5E9',
    Preparing: '#8B5CF6',
    'Out for Delivery': '#0F766E',
    Delivered: '#16A34A',
    Undelivered: '#DC2626',
  };

  return (
    <AIZone id="order-tracking">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Order {order.id}</Text>
        <Text style={styles.sub}>{order.restaurantName}</Text>
        <Text style={styles.sub}>{order.address}</Text>
        <Text style={styles.badgeText}>
          <Text style={{ color: statusColor[order.status] }}>[</Text>
          <Text>{order.status}</Text>
          <Text style={{ color: statusColor[order.status] }}>]</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Summary</Text>
          <Text style={styles.row}>Expected ETA: {order.expectedMinutes} min</Text>
          {typeof order.actualMinutes === 'number' ? <Text style={styles.row}>Actual: {order.actualMinutes} min</Text> : null}
          <Text style={styles.row}>Payment: {order.paymentMethod}</Text>
          <Text style={styles.row}>Total: ${order.total.toFixed(2)}</Text>
        </View>

        <Text style={styles.section}>Live Timeline</Text>
        <FlatList
          data={order.tracking}
          keyExtractor={(step) => step.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.timelineRow}>
              <Text style={[styles.timelineStatus, { color: item.complete ? '#16A34A' : '#64748B' }]}>{item.status}</Text>
              <Text style={styles.timelineMessage}>{item.message}</Text>
              <Text style={styles.timelineTime}>{item.timestamp}</Text>
            </View>
          )}
        />

        <View style={styles.actions}>
          <Link href={`/order/${order.id}/help`} asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Open Support</Text>
            </Pressable>
          </Link>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/orders')}>
            <Text style={styles.primaryText}>Back to Orders</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AIZone>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800' },
  sub: { color: '#475569', marginTop: 4 },
  badgeText: { marginTop: 12, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(241,245,249,0.6)',
  },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
  row: { color: '#334155' },
  section: { marginTop: 6, marginBottom: -4, fontSize: 18, fontWeight: '700' },
  timelineRow: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  timelineStatus: { fontWeight: '700', marginBottom: 4 },
  timelineMessage: { marginBottom: 4 },
  timelineTime: { color: '#64748B', fontSize: 12 },
  actions: { marginTop: 12, gap: 10 },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '700', color: '#334155' },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

function getStatusColor(status: string): string {
  if (status === 'Delivered') return '#16A34A';
  if (status === 'Undelivered') return '#DC2626';
  return '#2563EB';
}

export default function OrdersScreen() {
  const { activeOrders } = useFoodDelivery();
  const [longLoading, setLongLoading] = useState(false);
  const active = activeOrders.filter((order) => order.status !== 'Delivered' && order.status !== 'Undelivered');
  const completed = activeOrders.filter((order) => order.status === 'Delivered' || order.status === 'Undelivered');
  const orders = longLoading ? [] : [...active, ...completed];

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => setLongLoading(false), 6000);
      setLongLoading(true);

      return () => {
        clearTimeout(timeout);
        setLongLoading(false);
      };
    }, [])
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(order) => order.id}
      ListHeaderComponent={() => (
        <View>
          <Text style={styles.title}>Your Orders</Text>
          <Text style={styles.subtitle}>Track active deliveries and review support-ready history.</Text>
          <View style={[styles.loadingCard, longLoading && styles.loadingCardActive]}>
            <View style={styles.loadingTitleRow}>
              <Text style={styles.loadingTitle}>
                {longLoading ? 'Loading Orders' : 'Orders Loaded'}
              </Text>
              {longLoading ? <ActivityIndicator color="#0F766E" /> : null}
            </View>
            <Text style={styles.loadingText}>
              {longLoading
                ? 'Fetching your latest orders.'
                : 'The focus-triggered orders load is complete.'}
            </Text>
          </View>
        </View>
      )}
      renderItem={({ item }) => {
        const drift = item.actualMinutes !== undefined ? item.actualMinutes - item.expectedMinutes : 0;
        return (
          <View style={styles.card}>
            <View style={styles.rowHeader}>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.restaurant}>{item.restaurantName}</Text>
            <Text style={styles.meta}>
              {item.items.length} item{item.items.length > 1 ? 's' : ''} · ${item.total.toFixed(2)}
            </Text>
            <Text style={styles.meta}>
              ETA expected {item.expectedMinutes} min
              {drift ? ` · Drift ${drift > 0 ? '+' : ''}${drift}m` : ''}
            </Text>
            <View style={styles.row}>
              <Link href={`/order/${item.id}/tracking`} asChild>
                <Pressable style={styles.primaryBtn}>
                  <Text style={styles.primaryText}>Track</Text>
                </Pressable>
              </Link>
              <Link href={`/order/${item.id}/help`} asChild>
                <Pressable style={styles.secondaryBtn}>
                  <Text style={styles.secondaryText}>Need Help</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={() => (
        longLoading
          ? null
          : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recent orders yet.</Text>
              <Link href="/" asChild>
                <Pressable style={styles.secondaryBtn}><Text style={styles.secondaryText}>Start an order</Text></Pressable>
              </Link>
            </View>
          )
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#64748B', marginBottom: 16 },
  loadingCard: {
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 16,
  },
  loadingCardActive: { backgroundColor: '#CCFBF1', borderColor: '#2DD4BF' },
  loadingTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  loadingTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  loadingText: { color: '#475569', fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    backgroundColor: 'rgba(241,245,249,0.9)',
    padding: 16,
    marginBottom: 12,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 17, fontWeight: '700' },
  restaurant: { marginTop: 6, marginBottom: 4, fontSize: 15 },
  meta: { color: '#475569', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  badge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  primaryBtn: { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryText: { color: '#0F172A', fontWeight: '700' },
  empty: { marginTop: 30, alignItems: 'center' },
  emptyText: { marginBottom: 12, color: '#64748B' },
});

import { Link } from 'expo-router';
import { StyleSheet, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function OrderHistoryScreen() {
  const { activeOrders } = useFoodDelivery();
  const history = [...activeOrders]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .map((order) => ({
      id: order.id,
      date: new Date(order.placedAt).toLocaleDateString(),
      total: order.total,
      items: order.items.length,
      status: order.status,
    }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order History</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={`/order/${item.id}/tracking`} asChild>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'Delivered' ? '#27AE60' : '#E67E22' }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.details}>{item.items} item{item.items > 1 ? 's' : ''} · ${item.total}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.08)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  date: { fontSize: 13, color: '#6c757d', marginTop: 4 },
  details: { fontSize: 15, fontWeight: '500', marginTop: 8 },
});

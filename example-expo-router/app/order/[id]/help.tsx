import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { OrderIssueType, useFoodDelivery } from '@/app/lib/delivery-demo';

const ISSUE_OPTIONS: Array<{ id: OrderIssueType; label: string }> = [
  { id: 'late-delivery', label: 'Late delivery' },
  { id: 'missing-item', label: 'Missing item' },
  { id: 'wrong-item', label: 'Wrong item' },
  { id: 'refund-request', label: 'Refund request' },
  { id: 'delivery-instructions', label: 'Update delivery instructions' },
  { id: 'duplicate-charge', label: 'Duplicate charge' },
  { id: 'allergy-safety', label: 'Food allergy / safety' },
  { id: 'courier-safety', label: 'Courier safety concern' },
];

export default function OrderHelpScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrderById, createSupportContextForOrder, activeIssueTypes } = useFoodDelivery();
  const order = getOrderById(id);

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Order not found</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/orders')}>
          <Text style={styles.primaryText}>Go to Orders</Text>
        </Pressable>
      </View>
    );
  }

  const existingIssueTypes = activeIssueTypes(order.id);

  const buildArticleContext = (issueType: OrderIssueType): Record<string, string> => ({
    orderId: order.id,
    restaurant: order.restaurantName,
    issueType,
    screen: 'order-help',
  });

  const openSupportForIssue = (issueType: OrderIssueType) => {
    createSupportContextForOrder(order.id, issueType, order.items.map((item) => item.itemName), {
      source: 'order-help',
      screen: 'order-help',
    });
    router.push({
      pathname: '/support',
      params: buildArticleContext(issueType),
    });
  };

  return (
    <AIZone id="order-help" allowSimplify>
      <View style={styles.container}>
        <Text style={styles.title}>Need Help With Order</Text>
        <Text style={styles.subtitle}>Order {order.id}</Text>
        <Text style={styles.subtle}>{order.restaurantName}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick issue launch</Text>
          <Text style={styles.cardText}>Choose one option to open AI support with this order attached.</Text>
          {ISSUE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={[styles.itemBtn, existingIssueTypes.includes(option.id) && styles.itemBtnAccent]}
              onPress={() => openSupportForIssue(option.id)}
            >
              <Text style={styles.itemText}>{option.label}</Text>
              {existingIssueTypes.includes(option.id) ? <Text style={styles.itemMeta}>Previously reported</Text> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need broader help?</Text>
          <Text style={styles.cardText}>Browse the article library for specific scenarios.</Text>
          <Link href="/support/article/delivery-delays" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkText}>Delivery delays</Text>
            </Pressable>
          </Link>
          <Link href="/support/article/missing-items" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkText}>Missing items</Text>
            </Pressable>
          </Link>
        </View>

        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/support')}>
          <Text style={styles.secondaryText}>Go to Live Support Tab</Text>
        </Pressable>
      </View>
    </AIZone>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#475569', marginTop: 4, marginBottom: 2 },
  subtle: { color: '#64748B', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(241,245,249,0.6)',
  },
  cardTitle: { fontWeight: '700', fontSize: 16 },
  cardText: { color: '#334155' },
  itemBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    marginBottom: 8,
  },
  itemBtnAccent: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' },
  itemText: { fontWeight: '700' },
  itemMeta: { color: '#B45309', marginTop: 4, fontSize: 12 },
  linkBtn: {
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: { color: '#1D4ED8', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: { fontWeight: '700', color: '#334155' },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

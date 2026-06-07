import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import type { ProfileStackParamList } from '../App';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

const shortcuts: Array<{
  route: Exclude<
    keyof ProfileStackParamList,
    | 'Profile'
    | 'OrderDetails'
    | 'DeliveryTracker'
    | 'ChargeDetails'
    | 'GiftDetails'
  >;
  title: string;
  subtitle: string;
}> = [
  {
    route: 'OrdersList',
    title: 'Orders & delivery',
    subtitle: 'Late orders, missing items, allergy notes, tracker mismatches',
  },
  {
    route: 'BillingHistory',
    title: 'Billing history',
    subtitle: 'Overcharges, refunds, and linked order receipts',
  },
  {
    route: 'SubscriptionManagement',
    title: 'Subscriptions',
    subtitle: 'Unexpected renewals and cancellation disputes',
  },
  {
    route: 'LoyaltyActivity',
    title: 'Loyalty activity',
    subtitle: 'Missing points, delayed sync, reward redemptions',
  },
  {
    route: 'GiftHistory',
    title: 'Gift history',
    subtitle: 'Gift card delivery failures and resend scenarios',
  },
  {
    route: 'AccountSecurity',
    title: 'Account security',
    subtitle: 'Login friction, 2FA, notification mismatch',
  },
];

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { cart, getTotal } = useCart();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Guest'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{cart.length}</Text>
            <Text style={styles.statLabel}>Cart Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${getTotal()}</Text>
            <Text style={styles.statLabel}>Cart Total</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Support test areas</Text>
      {shortcuts.map((shortcut) => (
        <Pressable
          key={shortcut.route}
          style={styles.shortcutCard}
          onPress={() => navigation.navigate(shortcut.route)}
        >
          <Text style={styles.shortcutTitle}>{shortcut.title}</Text>
          <Text style={styles.shortcutSubtitle}>{shortcut.subtitle}</Text>
        </Pressable>
      ))}

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 24, paddingBottom: 60 },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  email: { fontSize: 14, color: '#6c757d', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 32, marginTop: 26 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: 12, color: '#6c757d', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  shortcutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  shortcutTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  shortcutSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6c757d',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

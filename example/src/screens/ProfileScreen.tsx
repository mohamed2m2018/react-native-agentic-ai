import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { cart, getTotal } = useCart();

  return (
    <View style={styles.container}>
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

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  stats: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 32,
    marginBottom: 40,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: 12, color: '#6c757d', marginTop: 4 },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

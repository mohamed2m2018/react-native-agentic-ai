import { StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>JS</Text>
      </View>
      <Text style={styles.name}>John Smith</Text>
      <Text style={styles.email}>john.smith@example.com</Text>

      <View style={styles.section}>
        <Link href="/edit-profile" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Edit Profile</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/favorites" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Favorites</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/order-history" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Order History</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/addresses" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Saved Addresses</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { alignItems: 'center', paddingTop: 32, paddingBottom: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  email: { fontSize: 14, color: '#6c757d', marginTop: 4 },
  section: { width: '100%', marginTop: 24, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  rowText: { fontSize: 16 },
  chevron: { fontSize: 22, color: '#6c757d' },
});

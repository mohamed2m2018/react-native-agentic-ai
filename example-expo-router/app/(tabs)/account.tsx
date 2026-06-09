import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AccountScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>My Account</Text>
        <Text style={styles.subtitle}>Jasmine Carter · jasmine@dashbite.app</Text>
      </View>

      <View style={styles.section}>
        <Link href="/edit-profile" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Edit Profile</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/addresses" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Saved Addresses</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/payment-methods" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Payment Methods</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/favorites" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Saved Restaurants</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Link href="/notifications" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Notification Preferences</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/language" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Language</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Link href="/help" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Support Center</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 40 },
  card: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 14, backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 4, color: '#475569' },
  section: { marginTop: 20, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.24)',
  },
  rowText: { fontSize: 16 },
  chevron: { fontSize: 24, color: '#64748B' },
});

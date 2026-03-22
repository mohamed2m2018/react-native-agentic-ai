import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <Link href="/notifications" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/appearance" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Appearance</Text>
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
        <Text style={styles.sectionTitle}>Support</Text>
        <Link href="/about" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>About</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/privacy" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        <Link href="/help" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowText}>Help Center</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  rowText: { fontSize: 16 },
  chevron: { fontSize: 22, color: '#6c757d' },
});

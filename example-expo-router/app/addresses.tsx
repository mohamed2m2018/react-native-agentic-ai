import { StyleSheet, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';

const ADDRESSES = [
  { id: '1', label: 'Home', address: '123 Main Street, Apt 4B, New York, NY 10001' },
  { id: '2', label: 'Work', address: '456 Business Ave, Suite 200, New York, NY 10018' },
  { id: '3', label: 'Mom\'s House', address: '789 Oak Lane, Brooklyn, NY 11201' },
];

export default function AddressesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Addresses</Text>
      <FlatList
        data={ADDRESSES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.address}>{item.address}</Text>
          </View>
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
  label: { fontSize: 16, fontWeight: '600' },
  address: { fontSize: 14, color: '#6c757d', marginTop: 4, lineHeight: 20 },
});

import { useMemo } from 'react';
import { Pressable, StyleSheet, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function AddressesScreen() {
  const { addresses, currentAddress, setAddress } = useFoodDelivery();
  const activeId = currentAddress.id;
  const rows = useMemo(() => addresses ?? [], [addresses]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Addresses</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, item.id === activeId && styles.activeCard]}
            onPress={() => setAddress(item.id)}
          >
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.address}>{item.line}</Text>
            {item.id === activeId ? <Text style={styles.check}>Used for checkout</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCard: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  label: { fontSize: 16, fontWeight: '600' },
  address: { fontSize: 14, color: '#6c757d', marginTop: 4, lineHeight: 20 },
  check: { marginTop: 8, color: '#2563EB', fontWeight: '700', fontSize: 12 },
});

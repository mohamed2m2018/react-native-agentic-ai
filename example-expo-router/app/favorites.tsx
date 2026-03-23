import { StyleSheet, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';

const FAVORITES = [
  { id: '1', name: 'Wireless Headphones', price: 79.99 },
  { id: '3', name: 'Laptop Stand', price: 49.99 },
  { id: '5', name: 'Yoga Mat', price: 39.99 }, // 🐛 BUG: price is 39.99 here but 34.99 on home/detail page
];

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Favorites</Text>
      <FlatList
        data={FAVORITES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>${item.price}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  name: { fontSize: 16, flex: 1 },
  price: { fontSize: 16, fontWeight: '600', color: '#27AE60' },
});

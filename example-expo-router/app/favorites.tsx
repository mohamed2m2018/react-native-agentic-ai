import { Link } from 'expo-router';
import { StyleSheet, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function FavoritesScreen() {
  const { restaurants } = useFoodDelivery();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Restaurants</Text>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={`/store/${item.id}`} asChild>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.cuisine}>{item.cuisine}</Text>
              </View>
              <Text style={styles.price}>{item.rating.toFixed(1)}★</Text>
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
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  name: { fontSize: 16, flex: 1 },
  cuisine: { fontSize: 12, color: '#6c757d', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '600', color: '#0F766E' },
});

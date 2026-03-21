import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { useCart } from '../CartContext';
import { ALL_MENU_ITEMS } from '../menuData';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// SearchScreen is standalone (in tab), but we navigate to detail via parent
type Props = NativeStackScreenProps<any>;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { addToCart } = useCart();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_MENU_ITEMS.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search dishes..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />

      {query.trim() === '' ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>Search across all categories</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => `${item.category}-${item.name}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('HomeTab', {
                  screen: 'DishDetail',
                  params: { dish: item },
                })
              }
            >
              <Text style={styles.cardEmoji}>{item.emoji || '🍽️'}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
                <Text style={styles.itemPrice}>${item.price}</Text>
              </View>
              <Pressable
                style={styles.addButton}
                onPress={() => addToCart(item.name, item.price, 1)}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </Pressable>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  searchInput: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#6c757d' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardEmoji: { fontSize: 32, marginRight: 12 },
  cardInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  itemCategory: { fontSize: 12, color: '#6c757d' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#28a745', marginTop: 2 },
  addButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

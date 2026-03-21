import { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useCart } from '../CartContext';
import { ALL_MENU_ITEMS } from '../menuData';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any>;

const PAGE_SIZE = 10;
const FAKE_NETWORK_DELAY = 800;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const { addToCart } = useCart();

  // Reset page and trigger loading when query changes
  useEffect(() => {
    if (!query.trim()) {
      setIsLoading(false);
      setPage(1);
      return;
    }

    setIsLoading(true);
    setPage(1);
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, FAKE_NETWORK_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle fake load more
  const handleLoadMore = () => {
    setIsLoading(true);
    setTimeout(() => {
      setPage(p => p + 1);
      setIsLoading(false);
    }, FAKE_NETWORK_DELAY);
  };

  const allFilteredResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_MENU_ITEMS.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query]);

  const visibleResults = useMemo(() => {
    return allFilteredResults.slice(0, page * PAGE_SIZE);
  }, [allFilteredResults, page]);

  const hasMore = visibleResults.length < allFilteredResults.length;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search dishes..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search input"
      />

      {query.trim() === '' ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>Search across all categories</Text>
        </View>
      ) : isLoading && page === 1 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#1a1a2e" accessibilityLabel="Loading search results" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : visibleResults.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={visibleResults}
          keyExtractor={item => `${item.category}-${item.name}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('HomeTab', {
                  screen: 'DishDetail',
                  params: { dish: item },
                })
              }
              accessibilityLabel={`View ${item.name}`}
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
                accessibilityLabel={`Add ${item.name} to cart`}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </Pressable>
          )}
          ListFooterComponent={() => (
            hasMore ? (
              <Pressable 
                style={styles.loadMoreButton} 
                onPress={handleLoadMore}
                accessibilityLabel="Load more items"
              >
                {isLoading ? (
                  <ActivityIndicator color="#1a1a2e" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </Pressable>
            ) : null
          )}
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
  loadingText: { fontSize: 14, color: '#6c757d', marginTop: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
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
  loadMoreButton: {
    padding: 16,
    marginVertical: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  loadMoreText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Image, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useCart } from '../CartContext';
import { ALL_MENU_ITEMS } from '../menuData';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any>;

const PAGE_SIZE = 6;
const FAKE_NETWORK_DELAY = 1000;

// Fake food images for visual richness
const FOOD_IMAGES: Record<string, string> = {
  Pizzas: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
  Burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
  Drinks: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200',
  Desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200',
  Salads: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200',
  Sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200',
  Breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=200',
  Tacos: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200',
};

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  // Lazy loading: auto-load next page when user scrolls near bottom
  const handleEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      setPage(p => p + 1);
      setIsLoadingMore(false);
    }, FAKE_NETWORK_DELAY);
  }, [hasMore, isLoadingMore]);

  const renderItem = useCallback(({ item }: { item: typeof ALL_MENU_ITEMS[0] }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate('HomeTab', {
          screen: 'DishDetail',
          params: { dish: item },
        })
      }
    >
      <Image
        source={{ uri: FOOD_IMAGES[item.category] || FOOD_IMAGES.Pizzas }}
        style={styles.cardImage}
      />
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
  ), [navigation, addToCart]);

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1a1a2e" />
        <Text style={styles.footerText}>Loading more dishes...</Text>
      </View>
    );
  }, [hasMore]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search dishes..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
      />

      {query.trim() === '' ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>Search across all categories</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#1a1a2e" />
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
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoadingMore ? renderFooter : undefined}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {visibleResults.length} of {allFilteredResults.length} results
            </Text>
          }
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
  resultCount: { fontSize: 13, color: '#6c757d', marginBottom: 8 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
    marginRight: 12,
  },
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
  footerLoader: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#6c757d',
    fontSize: 13,
  },
});

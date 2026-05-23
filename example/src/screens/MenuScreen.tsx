import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useAction } from '@mobileai/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';
import { useCart } from '../CartContext';
import { MENUS } from '../menuData';
import type { MenuItem } from '../menuData';

type Props = NativeStackScreenProps<HomeStackParamList, 'Menu'>;

const PAGE_SIZE = 10;
const INITIAL_LOAD_DELAY = 5000; // 5s — long delay to test voice agent behavior during loading
const LAZY_LOAD_DELAY = 2000;   // 2s per page load

// ─── Component ──────────────────────────────────────────────

export default function MenuScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const allItems = MENUS[category] || [];
  const { addToCart } = useCart();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Simulate network loading when screen opens
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), INITIAL_LOAD_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const displayedItems = useMemo(
    () => allItems.slice(0, visibleCount),
    [allItems, visibleCount],
  );
  const hasMore = visibleCount < allItems.length;

  // Scroll-based lazy loading
  const handleEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + PAGE_SIZE);
      setIsLoadingMore(false);
    }, LAZY_LOAD_DELAY);
  }, [hasMore, isLoadingMore]);

  // useAction — optional non-UI action for the AI to add items by name
  useAction('addToCart', 'Add a food item to the shopping cart', {
    itemName: 'string',
    quantity: 'number',
  }, ({ itemName, quantity }) => {
    const item = allItems.find(i => i.name.toLowerCase() === String(itemName).toLowerCase());
    if (!item) {
      return { success: false, message: `"${itemName}" not found. Available: ${allItems.map(i => i.name).join(', ')}` };
    }
    const qty = Number(quantity) || 1;
    addToCart(item.name, item.price, qty);
    return `Added ${qty}x ${item.name} ($${item.price * qty})`;
  });

  const renderItem = ({ item }: { item: MenuItem }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('DishDetail', { dish: item })}
    >
      <View style={styles.cardBullet}><Text style={styles.cardBulletText}>${item.price}</Text></View>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDesc}>{item.description}</Text>
        <Text style={styles.itemPrice}>${item.price}</Text>
      </View>
      <Pressable
        style={styles.addButton}
        onPress={() => {
          addToCart(item.name, item.price, 1);
          Alert.alert('Added!', `${item.name} added to cart.`);
        }}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </Pressable>
    </Pressable>
  );

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1a1a2e" />
        <Text style={styles.footerText}>Loading more burgers...</Text>
      </View>
    );
  }, [isLoadingMore]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{category}</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a1a2e" />
          <Text style={styles.loadingText}>Loading {category}...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{category}</Text>
      <Text style={styles.countLabel}>
        Showing {displayedItems.length} of {allItems.length} items
      </Text>
      <FlatList
        data={displayedItems}
        keyExtractor={item => item.name}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  title: { fontSize: 28, fontWeight: 'bold', padding: 24, paddingBottom: 4, color: '#1a1a2e' },
  countLabel: { fontSize: 12, color: '#6c757d', paddingHorizontal: 24, paddingBottom: 8 },
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
  cardBullet: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a2e', justifyContent: 'center' as const, alignItems: 'center' as const, marginRight: 12 },
  cardBulletText: { color: '#fff', fontSize: 12, fontWeight: '700' as const },
  cardInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#1a1a2e' },
  itemDesc: { fontSize: 14, color: '#6c757d' },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#28a745', marginTop: 4 },
  addButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadMoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
    marginTop: 4,
  },
  loadMoreText: { color: '#1a1a2e', fontSize: 14, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: '#6c757d', marginTop: 8 },
  footerLoader: { padding: 20, alignItems: 'center', gap: 8 },
  footerText: { color: '#6c757d', fontSize: 13 },
});

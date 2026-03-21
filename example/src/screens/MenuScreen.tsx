import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { useAction } from '@mobileai/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';
import { useCart } from '../CartContext';
import { MENUS } from '../menuData';
import type { MenuItem } from '../menuData';

type Props = NativeStackScreenProps<HomeStackParamList, 'Menu'>;

const PAGE_SIZE = 4;

// ─── Component ──────────────────────────────────────────────

export default function MenuScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const allItems = MENUS[category] || [];
  const { addToCart } = useCart();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const displayedItems = useMemo(
    () => allItems.slice(0, visibleCount),
    [allItems, visibleCount],
  );
  const hasMore = visibleCount < allItems.length;

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
      <Text style={styles.cardEmoji}>{item.emoji || '🍽️'}</Text>
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
        ListFooterComponent={
          hasMore ? (
            <Pressable
              style={styles.loadMoreButton}
              onPress={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </Pressable>
          ) : undefined
        }
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
  cardEmoji: { fontSize: 32, marginRight: 12 },
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
});

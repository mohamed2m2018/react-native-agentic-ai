import { StyleSheet, FlatList, Pressable } from 'react-native';
// import { AIZone } from 'experimental-stuff'; // old
import { AIZone } from '@mobileai/react-native';

import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';

const PRODUCTS = [
  { id: '1', name: 'Wireless Headphones', price: 79.99, category: 'Electronics' },
  { id: '2', name: 'Running Shoes', price: 129.99, category: 'Footwear' },
  { id: '3', name: 'Laptop Stand', price: 45.99, category: 'Accessories' }, // 🐛 BUG: price is 45.99 here but 49.99 on detail page
  { id: '4', name: 'Coffee Maker', price: 89.99, category: 'Kitchen' },
  { id: '5', name: 'Yoga Mat', price: 34.99, category: 'Fitness' },
  { id: '6', name: 'Desk Lamp', price: 44.99, category: 'Home Office' },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      {/* Hero banner — low priority: AI can simplify this section */}
      <AIZone id="hero-banner" allowSimplify>
        <Text style={styles.header}>Welcome to ShopApp</Text>
        <Text style={styles.subtitle}>Browse our products</Text>
      </AIZone>

      {/* Product list — high priority: AI can highlight items and simplify */}
      <AIZone id="product-list" allowHighlight allowSimplify>
        <FlatList
          data={PRODUCTS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/product/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <View style={[styles.badge, { backgroundColor: getCategoryColor(item.category) }]}>
                  <Text style={styles.badgeText}>{item.category.charAt(0)}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardCategory}>{item.category}</Text>
                </View>
                <Text style={styles.cardPrice}>${item.price}</Text>
              </Pressable>
            </Link>
          )}
        />

        <Link href="/categories" asChild>
          <Pressable style={styles.browseButton}>
            <Text style={styles.browseButtonText}>Browse All Categories</Text>
          </Pressable>
        </Link>
      </AIZone>
    </View>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Electronics: '#3498DB',
    Footwear: '#E74C3C',
    Accessories: '#9B59B6',
    Kitchen: '#E67E22',
    Fitness: '#27AE60',
    'Home Office': '#1ABC9C',
  };
  return colors[category] || '#6c757d';
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  header: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6c757d', paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  badge: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardContent: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardCategory: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#27AE60' },
  browseButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3498DB',
    alignItems: 'center',
  },
  browseButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

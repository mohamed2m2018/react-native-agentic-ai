import { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';
import { useCart } from '../CartContext';
import { CATEGORIES, ALL_MENU_ITEMS, type MenuItem } from '../menuData';
import MediaReel from '../components/MediaReel';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const FEATURED_PAGE_SIZE = 4;
const LOAD_DELAY = 800;

const CATEGORY_IMAGES: Record<string, string> = {
  Pizzas: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300',
  Burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300',
  Drinks: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300',
  Desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300',
  Salads: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300',
  Sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300',
  Breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=300',
  Tacos: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300',
};

export default function HomeScreen({ navigation }: Props) {
  const { cart, getTotal, addToCart } = useCart();
  const [featuredPage, setFeaturedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Simulate initial page load
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoading(false), LOAD_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Shuffled featured dishes (deterministic)
  const allFeatured = ALL_MENU_ITEMS.filter((_, i) => i % 3 === 0);
  const visibleFeatured = allFeatured.slice(0, featuredPage * FEATURED_PAGE_SIZE);
  const hasMoreFeatured = visibleFeatured.length < allFeatured.length;

  const handleLoadMoreFeatured = useCallback(() => {
    if (!hasMoreFeatured || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setFeaturedPage(p => p + 1);
      setIsLoadingMore(false);
    }, LOAD_DELAY);
  }, [hasMoreFeatured, isLoadingMore]);

  const renderFeaturedItem = useCallback(({ item }: { item: MenuItem }) => (
    <Pressable
      style={styles.featuredCard}
      onPress={() => navigation.navigate('DishDetail', { dish: item })}
    >
      <Image
        source={{ uri: CATEGORY_IMAGES[item.category] || CATEGORY_IMAGES.Pizzas }}
        style={styles.featuredImage}
      />
      <View style={styles.featuredInfo}>
        <Text style={styles.featuredName}>{item.name}</Text>
        <Text style={styles.featuredCategory}>{item.category}</Text>
        <Text style={styles.featuredPrice}>${item.price}</Text>
      </View>
      <Pressable
        style={styles.quickAddBtn}
        onPress={() => addToCart(item.name, item.price, 1)}
      >
        <Text style={styles.quickAddText}>+</Text>
      </Pressable>
    </Pressable>
  ), [navigation, addToCart]);

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Preparing your menu...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={visibleFeatured}
      keyExtractor={item => `featured-${item.category}-${item.name}`}
      renderItem={renderFeaturedItem}
      onEndReached={handleLoadMoreFeatured}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>FoodApp</Text>
          <Text style={styles.subtitle}>What are you craving?</Text>

          <MediaReel />

          {/* Category Grid */}
          <View style={styles.categories}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                style={styles.categoryCard}
                onPress={() => navigation.navigate('Menu', { category: cat })}
              >
                <Image
                  source={{ uri: CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.Pizzas }}
                  style={styles.categoryImage}
                />
                <Text style={styles.categoryText}>{cat}</Text>
              </Pressable>
            ))}
          </View>

          {cart.length > 0 && (
            <View style={styles.cartBanner}>
              <Text style={styles.cartBannerText}>
                🛒 {cart.length} item{cart.length !== 1 ? 's' : ''} · ${getTotal()}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>‎</Text>
        </View>
      }
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color="#1a1a2e" />
            <Text style={styles.footerText}>Loading more...</Text>
          </View>
        ) : hasMoreFeatured ? (
          <Pressable style={styles.loadMoreBtn} onPress={handleLoadMoreFeatured}>
            <Text style={styles.loadMoreText}>Load More Dishes</Text>
          </Pressable>
        ) : (
          <Text style={styles.endText}>You've seen all featured dishes!</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', gap: 12 },
  loadingText: { fontSize: 16, color: '#6c757d' },
  title: { fontSize: 32, fontWeight: 'bold', marginTop: 40, color: '#1a1a2e', paddingHorizontal: 24 },
  subtitle: { fontSize: 16, color: '#6c757d', marginTop: 4, marginBottom: 16, paddingHorizontal: 24 },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryCard: {
    width: '47%' as any,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  categoryImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#e9ecef',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    padding: 12,
    textAlign: 'center',
  },
  cartBanner: {
    margin: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  cartBannerText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  featuredCard: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  featuredImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
    marginRight: 12,
  },
  featuredInfo: { flex: 1, gap: 2 },
  featuredName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  featuredCategory: { fontSize: 12, color: '#6c757d' },
  featuredPrice: { fontSize: 14, fontWeight: '700', color: '#28a745', marginTop: 2 },
  quickAddBtn: {
    backgroundColor: '#1a1a2e',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  footerLoader: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerText: { color: '#6c757d', fontSize: 13 },
  loadMoreBtn: {
    marginHorizontal: 24,
    marginVertical: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loadMoreText: { color: '#1a1a2e', fontSize: 16, fontWeight: '600' },
  endText: {
    textAlign: 'center',
    color: '#6c757d',
    fontSize: 13,
    paddingVertical: 24,
  },
});

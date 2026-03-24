import { View, Text, Image, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useCart } from '../CartContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'DishDetail'>;

export default function DishDetailScreen({ route, navigation }: Props) {
  const { dish } = route.params;
  const { addToCart } = useCart();
  const [favorite, setFavorite] = useState(false);

  const handleAddToCart = (qty: number) => {
    addToCart(dish.name, dish.price, qty);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dish Image */}
      <View style={styles.imagePlaceholder}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800' }}
          style={styles.dishImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.details}>
        <Text style={styles.name}>{dish.name}</Text>
        <Text style={styles.description}>{dish.description}</Text>
        <Text style={styles.price}>${dish.price}</Text>

        {dish.ingredients && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.sectionText}>{dish.ingredients}</Text>
          </View>
        )}

        {/* ACTION: Add to Favorites (level 3 action) */}
        <View style={styles.favoriteRow}>
          <Text style={styles.favoriteLabel}>Add to Favorites</Text>
          <Switch value={favorite} onValueChange={setFavorite} />
        </View>

        {/* Reviews link */}
        <Pressable
          style={styles.reviewsButton}
          onPress={() => navigation.navigate('DishReviews', { dishName: dish.name })}
        >
          <Text style={styles.reviewsButtonText}>View Reviews & Questions</Text>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* Quantity buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.addButton} onPress={() => handleAddToCart(1)}>
            <Text style={styles.addButtonText}>Add 1 to Cart - ${dish.price}</Text>
          </Pressable>
          <Pressable style={styles.addMoreButton} onPress={() => handleAddToCart(2)}>
            <Text style={styles.addMoreText}>Add 2 - ${dish.price * 2}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 100 },
  imagePlaceholder: {
    height: 220,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
  },
  dishImage: { width: '100%', height: '100%' },
  details: { padding: 24, gap: 8 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e' },
  description: { fontSize: 16, color: '#6c757d', lineHeight: 24 },
  price: { fontSize: 24, fontWeight: '700', color: '#28a745', marginTop: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  sectionText: { fontSize: 14, color: '#6c757d', lineHeight: 22 },
  actions: { marginTop: 24, gap: 12 },
  addButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  addMoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  addMoreText: { color: '#1a1a2e', fontSize: 16, fontWeight: '600' },
  reviewsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  reviewsButtonText: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  arrow: { fontSize: 22, color: '#adb5bd' },
  favoriteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  favoriteLabel: { fontSize: 16, fontWeight: '500', color: '#1a1a2e' },
});

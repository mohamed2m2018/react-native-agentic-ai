import { StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useState } from 'react';

const ITEM_DETAILS: Record<string, {
  name: string; price: number; rating: number;
  description: string; specs: string[];
}> = {
  p1: { name: 'Galaxy S24 Ultra', price: 1199.99, rating: 4.8, description: 'The ultimate smartphone with AI-powered features, 200MP camera, and S Pen.', specs: ['6.8" QHD+ AMOLED', 'Snapdragon 8 Gen 3', '12GB RAM', '5000mAh battery'] },
  p2: { name: 'iPhone 16 Pro', price: 999.99, rating: 4.9, description: 'Pro camera system with 5x optical zoom and A18 Pro chip.', specs: ['6.3" Super Retina XDR', 'A18 Pro', '8GB RAM', '3577mAh battery'] },
  p3: { name: 'Pixel 9 Pro', price: 899.99, rating: 4.7, description: 'Google AI built in with the best Pixel camera ever.', specs: ['6.3" LTPO OLED', 'Tensor G4', '16GB RAM', '4700mAh battery'] },
  l1: { name: 'MacBook Air M3', price: 1099.99, rating: 4.9, description: 'Supercharged by M3 chip. Up to 18 hours battery life.', specs: ['13.6" Liquid Retina', 'M3 chip', '8-core GPU', '18hr battery'] },
  l2: { name: 'ThinkPad X1 Carbon', price: 1449.99, rating: 4.6, description: 'Enterprise-grade ultrabook with legendary keyboard.', specs: ['14" 2.8K OLED', 'Intel Core Ultra 7', '32GB RAM', '57Wh battery'] },
  a1: { name: 'AirPods Pro 3', price: 249.99, rating: 4.8, description: 'Adaptive audio with personalized spatial audio and hearing health features.', specs: ['Active noise cancellation', 'H2 chip', '6hr battery', 'USB-C case'] },
  a2: { name: 'Sony WH-1000XM5', price: 349.99, rating: 4.7, description: 'Industry-leading noise cancellation with exceptional sound quality.', specs: ['30hr battery', '30mm drivers', 'LDAC', 'Multipoint'] },
  w1: { name: 'Apple Watch Ultra 2', price: 799.99, rating: 4.8, description: 'The most rugged Apple Watch for extreme adventures.', specs: ['49mm titanium', 'S9 SiP', '72hr battery', '100m water resistant'] },
  w2: { name: 'Galaxy Watch 7', price: 299.99, rating: 4.5, description: 'Advanced health monitoring with BioActive sensor.', specs: ['44mm aluminum', 'Exynos W1000', 'Wear OS 5', '40hr battery'] },
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = ITEM_DETAILS[id];
  const [wishlisted, setWishlisted] = useState(false);

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Item Not Found</Text>
        <Text style={styles.description}>This item does not exist in our catalog.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageBox}>
        <Text style={styles.imagePlaceholder}>📦</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.header}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>${item.price}</Text>
          <Text style={styles.rating}>★ {item.rating}</Text>
        </View>

        <Text style={styles.description}>{item.description}</Text>

        <Text style={styles.specTitle}>Specifications</Text>
        {item.specs.map((spec, i) => (
          <View key={i} style={styles.specRow}>
            <Text style={styles.specBullet}>•</Text>
            <Text style={styles.specText}>{spec}</Text>
          </View>
        ))}

        {/* ACTION: Add to Wishlist toggle (level 5 action) */}
        <View style={styles.wishlistRow}>
          <Text style={styles.wishlistLabel}>Add to Wishlist</Text>
          <Switch value={wishlisted} onValueChange={setWishlisted} />
        </View>

        <Link href={`/item-reviews/${id}`} asChild>
          <Pressable style={styles.reviewsButton}>
            <Text style={styles.reviewsButtonText}>View Reviews & Questions</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </Link>

        <Pressable style={styles.addToCart}>
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageBox: {
    height: 220,
    backgroundColor: 'rgba(150,150,150,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: { fontSize: 80 },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  price: { fontSize: 22, fontWeight: '700', color: '#27AE60' },
  rating: { fontSize: 16, color: '#F39C12' },
  description: { fontSize: 15, color: '#6c757d', lineHeight: 22, marginBottom: 20 },
  specTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  specRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  specBullet: { fontSize: 15, color: '#6c757d', marginRight: 8, marginTop: 1 },
  specText: { fontSize: 15, flex: 1 },
  reviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginTop: 20,
  },
  reviewsButtonText: { flex: 1, fontSize: 16, fontWeight: '600' },
  arrow: { fontSize: 22, color: '#6c757d' },
  addToCart: {
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  addToCartText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  wishlistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginTop: 20,
  },
  wishlistLabel: { fontSize: 16, fontWeight: '500' },
});

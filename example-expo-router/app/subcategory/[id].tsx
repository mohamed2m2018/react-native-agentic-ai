import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';

const ITEMS: Record<string, { id: string; name: string; price: number; rating: number }[]> = {
  phones: [
    { id: 'p1', name: 'Galaxy S24 Ultra', price: 1199.99, rating: 4.8 },
    { id: 'p2', name: 'iPhone 16 Pro', price: 999.99, rating: 4.9 },
    { id: 'p3', name: 'Pixel 9 Pro', price: 899.99, rating: 4.7 },
  ],
  laptops: [
    { id: 'l1', name: 'MacBook Air M3', price: 1099.99, rating: 4.9 },
    { id: 'l2', name: 'ThinkPad X1 Carbon', price: 1449.99, rating: 4.6 },
  ],
  audio: [
    { id: 'a1', name: 'AirPods Pro 3', price: 249.99, rating: 4.8 },
    { id: 'a2', name: 'Sony WH-1000XM5', price: 349.99, rating: 4.7 },
  ],
  wearables: [
    { id: 'w1', name: 'Apple Watch Ultra 2', price: 799.99, rating: 4.8 },
    { id: 'w2', name: 'Galaxy Watch 7', price: 299.99, rating: 4.5 },
  ],
  mens: [
    { id: 'm1', name: 'Slim Fit Blazer', price: 189.99, rating: 4.4 },
    { id: 'm2', name: 'Classic Oxford Shirt', price: 59.99, rating: 4.6 },
  ],
  womens: [
    { id: 'wm1', name: 'Wrap Midi Dress', price: 79.99, rating: 4.5 },
    { id: 'wm2', name: 'Cashmere Sweater', price: 149.99, rating: 4.7 },
  ],
  shoes: [
    { id: 's1', name: 'Running Shoes Pro', price: 129.99, rating: 4.6 },
    { id: 's2', name: 'Leather Chelsea Boots', price: 179.99, rating: 4.8 },
  ],
  furniture: [
    { id: 'f1', name: 'Ergonomic Office Chair', price: 549.99, rating: 4.7 },
    { id: 'f2', name: 'Standing Desk', price: 399.99, rating: 4.5 },
  ],
  kitchen: [
    { id: 'k1', name: 'Espresso Machine', price: 699.99, rating: 4.8 },
    { id: 'k2', name: 'Air Fryer XL', price: 129.99, rating: 4.6 },
  ],
  garden: [
    { id: 'g1', name: 'Robot Lawn Mower', price: 999.99, rating: 4.4 },
    { id: 'g2', name: 'Garden Tool Set', price: 89.99, rating: 4.3 },
  ],
  fitness: [
    { id: 'ft1', name: 'Adjustable Dumbbell Set', price: 349.99, rating: 4.7 },
    { id: 'ft2', name: 'Yoga Mat Premium', price: 49.99, rating: 4.5 },
  ],
  outdoor: [
    { id: 'o1', name: 'Hiking Backpack 65L', price: 189.99, rating: 4.6 },
    { id: 'o2', name: 'Camping Tent 4P', price: 259.99, rating: 4.4 },
  ],
  teamsports: [
    { id: 'ts1', name: 'Basketball Official', price: 39.99, rating: 4.5 },
    { id: 'ts2', name: 'Soccer Cleats Pro', price: 149.99, rating: 4.6 },
  ],
  fiction: [
    { id: 'b1', name: 'The Last Algorithm', price: 14.99, rating: 4.8 },
    { id: 'b2', name: 'Quantum Dreams', price: 12.99, rating: 4.5 },
  ],
  nonfiction: [
    { id: 'n1', name: 'AI Revolution', price: 24.99, rating: 4.7 },
    { id: 'n2', name: 'Deep Work', price: 16.99, rating: 4.9 },
  ],
  education: [
    { id: 'e1', name: 'React Native Masterclass', price: 44.99, rating: 4.6 },
    { id: 'e2', name: 'System Design Interview', price: 39.99, rating: 4.8 },
  ],
};

const SUB_NAMES: Record<string, string> = {
  phones: 'Smartphones', laptops: 'Laptops & Tablets', audio: 'Audio & Headphones',
  wearables: 'Wearables', mens: "Men's Clothing", womens: "Women's Clothing",
  shoes: 'Shoes', furniture: 'Furniture', kitchen: 'Kitchen', garden: 'Garden Tools',
  fitness: 'Fitness Equipment', outdoor: 'Outdoor Gear', teamsports: 'Team Sports',
  fiction: 'Fiction', nonfiction: 'Non-Fiction', education: 'Educational',
};

export default function SubcategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const items = ITEMS[id] || [];
  const subName = SUB_NAMES[id] || id;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{subName}</Text>
      <Text style={styles.subtitle}>{items.length} products available</Text>

      <View style={styles.list}>
        {items.map((item) => (
          <Link key={item.id} href={`/item/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardRating}>★ {item.rating}</Text>
              </View>
              <Text style={styles.cardPrice}>${item.price}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  header: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6c757d', paddingHorizontal: 20, marginBottom: 20 },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardRating: { fontSize: 13, color: '#F39C12', marginTop: 4 },
  cardPrice: { fontSize: 17, fontWeight: '700', color: '#27AE60' },
});

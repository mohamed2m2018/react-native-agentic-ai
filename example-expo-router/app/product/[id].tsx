import { StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';

const PRODUCTS: Record<string, { name: string; price: number; category: string; description: string; specs: string[] }> = {
  '1': { name: 'Wireless Headphones', price: 79.99, category: 'Electronics', description: 'Premium noise-cancelling wireless headphones with 30-hour battery life and ultra-comfortable ear cushions.', specs: ['Bluetooth 5.3', '30hr Battery', 'Active Noise Cancelling', 'USB-C Charging'] },
  '2': { name: 'Running Shoes', price: 129.99, category: 'Footwear', description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper for maximum comfort.', specs: ['Sizes 6-13', 'Mesh Upper', 'Rubber Outsole', 'Responsive Foam'] },
  '3': { name: 'Laptop Stand', price: 49.99, category: 'Accessories', description: 'Adjustable aluminum laptop stand with ventilated design for optimal airflow and ergonomic positioning.', specs: ['Aluminum Build', 'Adjustable Height', 'Anti-Slip Pads', 'Foldable Design'] },
  '4': { name: 'Coffee Maker', price: 89.99, category: 'Kitchen', description: 'Programmable 12-cup coffee maker with thermal carafe to keep your coffee hot for hours.', specs: ['12-Cup Capacity', 'Thermal Carafe', 'Programmable Timer', 'Auto Shut-Off'] },
  '5': { name: 'Yoga Mat', price: 34.99, category: 'Fitness', description: 'Extra thick non-slip yoga mat made from eco-friendly materials. Perfect for all types of workouts.', specs: ['6mm Thick', 'Non-Slip Surface', 'Eco-Friendly', '72" x 24"'] },
  '6': { name: 'Desk Lamp', price: 44.99, category: 'Home Office', description: 'LED desk lamp with adjustable brightness, color temperature, and a built-in USB charging port.', specs: ['LED Light', '5 Brightness Levels', '3 Color Temps', 'USB Port'] },
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = PRODUCTS[id || '1'];

  if (!product) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Product not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: getCategoryColor(product.category) }]}>
        <Text style={styles.heroText}>{product.category.charAt(0)}</Text>
      </View>

      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.category}>{product.category}</Text>
      <Text style={styles.price}>${product.price}</Text>
      <Text style={styles.description}>{product.description}</Text>

      <Text style={styles.specTitle}>Specifications</Text>
      {product.specs.map((spec, i) => (
        <View key={i} style={styles.specRow}>
          <View style={styles.specDot} />
          <Text style={styles.specText}>{spec}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Electronics: '#3498DB', Footwear: '#E74C3C', Accessories: '#9B59B6',
    Kitchen: '#E67E22', Fitness: '#27AE60', 'Home Office': '#1ABC9C',
  };
  return colors[category] || '#6c757d';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  hero: { height: 180, justifyContent: 'center', alignItems: 'center' },
  heroText: { fontSize: 64, fontWeight: '800', color: 'rgba(255,255,255,0.3)' },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 20 },
  category: { fontSize: 14, color: '#6c757d', paddingHorizontal: 20, marginTop: 4 },
  price: { fontSize: 22, fontWeight: '700', color: '#27AE60', paddingHorizontal: 20, marginTop: 8 },
  description: { fontSize: 15, lineHeight: 22, color: '#555', paddingHorizontal: 20, marginTop: 16 },
  specTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  specRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  specDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3498DB', marginRight: 12 },
  specText: { fontSize: 15 },
});

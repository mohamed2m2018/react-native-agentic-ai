import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';

const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', icon: '⚡', count: 24 },
  { id: 'fashion', name: 'Fashion', icon: '👗', count: 58 },
  { id: 'home', name: 'Home & Garden', icon: '🏠', count: 31 },
  { id: 'sports', name: 'Sports & Outdoors', icon: '⚽', count: 19 },
  { id: 'books', name: 'Books & Media', icon: '📚', count: 42 },
];

export default function CategoriesScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>All Categories</Text>
      <Text style={styles.subtitle}>Browse by department</Text>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => (
          <Link key={cat.id} href={`/category/${cat.id}`} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.icon}>{cat.icon}</Text>
              <Text style={styles.cardTitle}>{cat.name}</Text>
              <Text style={styles.cardCount}>{cat.count} items</Text>
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
  grid: { paddingHorizontal: 16, gap: 12 },
  card: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(150,150,150,0.08)',
    alignItems: 'center',
  },
  icon: { fontSize: 36, marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  cardCount: { fontSize: 13, color: '#6c757d' },
});

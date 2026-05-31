import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';

const SUBCATEGORIES: Record<string, { id: string; name: string; count: number }[]> = {
  electronics: [
    { id: 'phones', name: 'Smartphones', count: 8 },
    { id: 'laptops', name: 'Laptops & Tablets', count: 6 },
    { id: 'audio', name: 'Audio & Headphones', count: 5 },
    { id: 'wearables', name: 'Wearables', count: 5 },
  ],
  fashion: [
    { id: 'mens', name: "Men's Clothing", count: 20 },
    { id: 'womens', name: "Women's Clothing", count: 25 },
    { id: 'shoes', name: 'Shoes', count: 13 },
  ],
  home: [
    { id: 'furniture', name: 'Furniture', count: 12 },
    { id: 'kitchen', name: 'Kitchen', count: 10 },
    { id: 'garden', name: 'Garden Tools', count: 9 },
  ],
  sports: [
    { id: 'fitness', name: 'Fitness Equipment', count: 7 },
    { id: 'outdoor', name: 'Outdoor Gear', count: 6 },
    { id: 'teamsports', name: 'Team Sports', count: 6 },
  ],
  books: [
    { id: 'fiction', name: 'Fiction', count: 15 },
    { id: 'nonfiction', name: 'Non-Fiction', count: 14 },
    { id: 'education', name: 'Educational', count: 13 },
  ],
};

const CATEGORY_NAMES: Record<string, string> = {
  electronics: 'Electronics',
  fashion: 'Fashion',
  home: 'Home & Garden',
  sports: 'Sports & Outdoors',
  books: 'Books & Media',
};

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subs = SUBCATEGORIES[id] || [];
  const categoryName = CATEGORY_NAMES[id] || id;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{categoryName}</Text>
      <Text style={styles.subtitle}>Choose a subcategory</Text>

      <View style={styles.list}>
        {subs.map((sub) => (
          <Link key={sub.id} href={`/subcategory/${sub.id}`} asChild>
            <Pressable style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{sub.name}</Text>
                <Text style={styles.rowCount}>{sub.count} items</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
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
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowCount: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  arrow: { fontSize: 22, color: '#6c757d', fontWeight: '300' },
});

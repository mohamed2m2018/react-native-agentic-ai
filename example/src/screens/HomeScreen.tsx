import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';
import { useCart } from '../CartContext';
import { CATEGORIES } from '../menuData';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const CATEGORY_EMOJIS: Record<string, string> = {
  Pizzas: '🍕',
  Burgers: '🍔',
  Drinks: '🥤',
  Desserts: '🍰',
};

export default function HomeScreen({ navigation }: Props) {
  const { cart, getTotal } = useCart();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🍽️ FoodApp</Text>
      <Text style={styles.subtitle}>What are you craving?</Text>

      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={styles.card}
            onPress={() => navigation.navigate('Menu', { category: cat })}
          >
            <Text style={styles.cardEmoji}>{CATEGORY_EMOJIS[cat] || '🍽️'}</Text>
            <Text style={styles.cardText}>{cat}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginTop: 20, color: '#1a1a2e' },
  subtitle: { fontSize: 16, color: '#6c757d', marginTop: 4, marginBottom: 32 },
  categories: { gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardEmoji: { fontSize: 36 },
  cardText: { fontSize: 20, fontWeight: '600', color: '#1a1a2e' },
  cartBanner: {
    marginTop: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  cartBannerText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

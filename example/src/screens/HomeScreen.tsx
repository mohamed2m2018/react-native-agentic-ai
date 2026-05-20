import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🍽️ FoodApp</Text>
      <Text style={styles.subtitle}>What are you craving?</Text>

      <View style={styles.categories}>
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('Menu', { category: 'Pizzas' })}
        >
          <Text style={styles.cardEmoji}>🍕</Text>
          <Text style={styles.cardText}>Pizzas</Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('Menu', { category: 'Burgers' })}
        >
          <Text style={styles.cardEmoji}>🍔</Text>
          <Text style={styles.cardText}>Burgers</Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('Menu', { category: 'Drinks' })}
        >
          <Text style={styles.cardEmoji}>🥤</Text>
          <Text style={styles.cardText}>Drinks</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.cartButton}
        onPress={() => navigation.navigate('Cart')}
      >
        <Text style={styles.cartButtonText}>🛒 View Cart</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8f9fa' },
  title: { fontSize: 32, fontWeight: 'bold', marginTop: 40, color: '#1a1a2e' },
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
  cartButton: {
    marginTop: 32,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  cartButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

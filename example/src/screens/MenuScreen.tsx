import { View, Text, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { useAction } from '@mobileai/react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useCart } from '../CartContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

// ─── Menu Data ──────────────────────────────────────────────

interface MenuItem {
  name: string;
  price: number;
  description: string;
}

const MENUS: Record<string, MenuItem[]> = {
  Pizzas: [
    { name: 'Margherita', price: 10, description: 'Classic tomato & mozzarella' },
    { name: 'BBQ Chicken', price: 14, description: 'BBQ sauce, chicken & red onion' },
    { name: 'Veggie Supreme', price: 12, description: 'Bell peppers, mushrooms & olives' },
  ],
  Burgers: [
    { name: 'Classic Smash', price: 11, description: 'Beef patty, lettuce & tomato' },
    { name: 'Cheese Burger', price: 13, description: 'Double cheese, pickles & onion' },
    { name: 'Chicken Burger', price: 12, description: 'Crispy chicken with mayo' },
  ],
  Drinks: [
    { name: 'Coke', price: 3, description: 'Coca-Cola 330ml' },
    { name: 'Lemonade', price: 4, description: 'Fresh squeezed lemonade' },
    { name: 'Water', price: 2, description: 'Still mineral water' },
  ],
};

// ─── Component ──────────────────────────────────────────────

export default function MenuScreen({ route }: Props) {
  const { category } = route.params;
  const menu = MENUS[category] || [];
  const { addToCart } = useCart();

  // useAction — optional non-UI action for the AI to add items by name
  useAction('addToCart', 'Add a food item to the shopping cart', {
    itemName: 'string',
    quantity: 'number',
  }, ({ itemName, quantity }) => {
    const item = menu.find(i => i.name.toLowerCase() === String(itemName).toLowerCase());
    if (!item) {
      return { success: false, message: `"${itemName}" not found. Available: ${menu.map(i => i.name).join(', ')}` };
    }
    const qty = Number(quantity) || 1;
    addToCart(item.name, item.price, qty);
    return `Added ${qty}x ${item.name} ($${item.price * qty})`;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{category}</Text>
      <FlatList
        data={menu}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDesc}>{item.description}</Text>
              <Text style={styles.itemPrice}>${item.price}</Text>
            </View>
            <Pressable
              style={styles.addButton}
              onPress={() => {
                addToCart(item.name, item.price, 1);
                Alert.alert('Added!', `${item.name} added to cart.`);
              }}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  title: { fontSize: 28, fontWeight: 'bold', padding: 24, paddingBottom: 8, color: '#1a1a2e' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#1a1a2e' },
  itemDesc: { fontSize: 14, color: '#6c757d' },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#28a745', marginTop: 4 },
  addButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

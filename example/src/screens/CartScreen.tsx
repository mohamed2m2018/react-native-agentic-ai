import { View, Text, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { useAction } from '@mobileai/react-native';
import { useCart } from '../CartContext';

export default function CartScreen() {
  const { cart, removeFromCart, clearCart, getTotal } = useCart();

  // Expose checkout to the AI as a non-UI action with HARD SECURITY confirmation
  useAction('checkout', 'Place the order and checkout', {}, async () => {
    if (cart.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }
    const total = getTotal();

    // 🔒 SECURITY: The AI's execution is paused here until the human actively confirms via Alert.
    return new Promise((resolve) => {
      Alert.alert(
        'Confirm Order by AI 🤖',
        `Do you want the AI to place your order for $${total}?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel', 
            onPress: () => resolve({ success: false, message: 'User denied the checkout.' }) 
          },
          { 
            text: 'Confirm', 
            style: 'default',
            onPress: () => {
              clearCart();
              Alert.alert('Success! 🎉', `Your order of $${total} is completed.`);
              resolve({ success: true, message: `Order placed! Total: $${total}` });
            }
          }
        ]
      );
    });
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛒 Your Cart</Text>

      {cart.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cart is empty</Text>
          <Text style={styles.emptySubtext}>Ask the AI to add items!</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item, index }) => (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.itemName}>
                    {item.quantity}x {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>${item.price * item.quantity}</Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeFromCart(index)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </Pressable>
              </View>
            )}
            contentContainerStyle={styles.list}
          />

          <View style={styles.footer}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentLabel}>Payment Method</Text>
              <Text style={styles.paymentCard}>Mastercard **** **** **** 4242</Text>
            </View>
            <Text style={styles.total}>Total: ${getTotal()}</Text>
            <Pressable
              style={styles.checkoutButton}
              onPress={() => {
                const total = getTotal();
                clearCart();
                Alert.alert('Order Placed! 🎉', `Your order of $${total} has been placed.`);
              }}
              // @ts-ignore - custom prop read by the Agent runtime
              aiIgnore={true} // 🔒 SECURITY: AI cannot tap this. Must use the secure checkout action.
            >
              <Text style={styles.checkoutText}>Checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  title: { fontSize: 28, fontWeight: 'bold', padding: 24, paddingBottom: 8, color: '#1a1a2e' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 20, fontWeight: '600', color: '#6c757d' },
  emptySubtext: { fontSize: 14, color: '#adb5bd' },
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
  cardInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  itemPrice: { fontSize: 14, color: '#28a745', marginTop: 2 },
  removeButton: {
    backgroundColor: '#dc3545',
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 16,
  },
  total: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  checkoutButton: {
    backgroundColor: '#28a745',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  paymentInfo: { marginBottom: 12 },
  paymentLabel: { fontSize: 14, color: '#6c757d', fontWeight: '600' },
  paymentCard: { fontSize: 16, color: '#1a1a2e', marginTop: 4, letterSpacing: 1 },
});

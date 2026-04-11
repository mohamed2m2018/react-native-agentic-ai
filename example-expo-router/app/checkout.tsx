import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, currentSubtotal, deliveryFee, promoCode, minimumOrderThreshold, placeOrder, currentAddress, currentPaymentMethod } = useFoodDelivery();

  const subtotal = useMemo(() => Number(currentSubtotal.toFixed(2)), [currentSubtotal]);
  const discount = useMemo(() => {
    if (!promoCode) return 0;
    const value = promoCode === 'dashbite10' ? 0.1 : promoCode === 'hungry20' ? 0.2 : 0;
    return Number((subtotal * value).toFixed(2));
  }, [promoCode, subtotal]);
  const total = useMemo(() => Number((subtotal + deliveryFee - discount).toFixed(2)), [deliveryFee, discount, subtotal]);
  const restaurantName = cart[0]?.restaurantName ?? 'your restaurant';

  const canCheckout = cart.length > 0 && subtotal >= minimumOrderThreshold;

  const doPlaceOrder = () => {
    const result = placeOrder();
    if (!result.success) {
      Alert.alert('Checkout', result.error ?? 'Unable to place order');
      return;
    }
    router.replace(`/order/${result.orderId}/tracking`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AIZone id="checkout-screen">
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtle}>Delivery from {restaurantName}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          <Text style={styles.cardText}>{currentAddress.line}</Text>
          <Link href="/addresses" asChild>
            <Pressable style={styles.linkRow}>
              <Text style={styles.linkText}>Change address</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment method</Text>
          <Text style={styles.cardText}>{currentPaymentMethod}</Text>
          <Link href="/payment-methods" asChild>
            <Pressable style={styles.linkRow}>
              <Text style={styles.linkText}>Change payment method</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Delivery fee</Text>
            <Text>${deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Promo ({promoCode || 'none'})</Text>
            <Text>${discount.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalText}>${total.toFixed(2)}</Text>
          </View>

          {!canCheckout ? (
            <Text style={styles.warningText}>Minimum order: ${minimumOrderThreshold.toFixed(2)} required.</Text>
          ) : null}
        </View>

        <Pressable
          style={[styles.placeBtn, !canCheckout && styles.disabled]}
          onPress={doPlaceOrder}
          disabled={!canCheckout}
        >
          <Text style={styles.placeBtnText}>Place Order</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/cart')}>
          <Text style={styles.secondaryText}>Back to Cart</Text>
        </Pressable>
      </AIZone>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800' },
  subtle: { color: '#475569', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(241,245,249,0.6)',
  },
  cardTitle: { fontWeight: '700', fontSize: 16 },
  cardText: { color: '#334155', lineHeight: 20 },
  linkRow: { marginTop: 6 },
  linkText: { color: '#0F766E', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  totalRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.4)', paddingTop: 8 },
  totalText: { fontWeight: '700', fontSize: 16 },
  warningText: { marginTop: 10, color: '#DC2626', fontWeight: '600' },
  placeBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#4F46E5',
  },
  placeBtnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  secondaryBtn: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '700' },
});

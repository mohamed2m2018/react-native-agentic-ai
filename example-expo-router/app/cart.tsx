import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { useFoodDelivery, type CartLineItem } from '@/app/lib/delivery-demo';

export default function CartScreen() {
  const router = useRouter();
  const { cart, updateCartQuantity, removeCartLine, applyPromo, currentSubtotal, deliveryFee, promoCode, estimatedDeliveryMinutes } = useFoodDelivery();
  const [enteredPromo, setEnteredPromo] = useState('');

  const subtotal = useMemo(() => Number(currentSubtotal.toFixed(2)), [currentSubtotal]);
  const discount = useMemo(() => {
    if (!promoCode) return 0;
    const normalized = promoCode.toLowerCase();
    if (normalized === 'dashbite10') return Number((subtotal * 0.1).toFixed(2));
    if (normalized === 'hungry20') return Number((subtotal * 0.2).toFixed(2));
    return 0;
  }, [promoCode, subtotal]);
  const total = Number((subtotal + deliveryFee - discount).toFixed(2));

  const applyPromoCode = () => {
    const result = applyPromo(enteredPromo);
    if (!result.success) {
      Alert.alert('Promo code', result.reason ?? 'Code not valid');
      return;
    }
    Alert.alert('Promo code', `Applied ${enteredPromo.toUpperCase()} (${Math.round((result.discountPercent ?? 0) * 100)}% off).`);
    setEnteredPromo('');
  };

  const renderItem = ({ item }: { item: CartLineItem }) => (
    <View style={styles.line}>
      <View style={styles.lineTop}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.itemPrice}>${item.lineTotal.toFixed(2)}</Text>
      </View>
      {!!item.modifiers?.length && <Text style={styles.meta}>{item.modifiers.join(' • ')}</Text>}
      {!!item.notes && <Text style={styles.note}>{item.notes}</Text>}
      <View style={styles.controls}>
        <Pressable onPress={() => updateCartQuantity(item.id, item.quantity - 1)} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnText}>−</Text>
        </Pressable>
        <Text style={styles.qty}>{item.quantity}</Text>
        <Pressable onPress={() => updateCartQuantity(item.id, item.quantity + 1)} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnText}>+</Text>
        </Pressable>
        <Pressable onPress={() => removeCartLine(item.id)} style={styles.removeBtn}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <AIZone id="cart-screen" allowHighlight>
      <View style={styles.container}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.subtitle}>Estimated delivery: {estimatedDeliveryMinutes} min</Text>

        <FlatList
          data={cart}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No items in your cart yet.</Text>
              <Link href="/" asChild>
                <Pressable style={styles.secondary}>
                  <Text style={styles.secondaryText}>Browse Restaurants</Text>
                </Pressable>
              </Link>
            </View>
          )}
          contentContainerStyle={styles.list}
        />

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Promo Code</Text>
          <View style={styles.promoRow}>
            <TextInput
              value={enteredPromo}
              onChangeText={setEnteredPromo}
              style={styles.promoInput}
              placeholder="dashbite10 / hungry20"
              placeholderTextColor="#94A3B8"
            />
            <Pressable style={styles.promoBtn} onPress={applyPromoCode}>
              <Text style={styles.promoBtnText}>Apply</Text>
            </Pressable>
          </View>
          {promoCode ? <Text style={styles.activePromo}>Active: {promoCode}</Text> : null}

          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Delivery Fee</Text>
            <Text>${deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Promo Discount</Text>
            <Text>${discount.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalText}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.checkoutBtn, cart.length === 0 && styles.disabled]}
          onPress={() => router.push('/checkout')}
          disabled={cart.length === 0}
        >
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
        </Pressable>
      </View>
    </AIZone>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#475569', marginTop: 4 },
  list: { paddingTop: 16, paddingBottom: 20 },
  line: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    marginBottom: 12,
  },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '700', flex: 1 },
  itemPrice: { fontWeight: '700', color: '#0F766E' },
  meta: { color: '#64748B', marginTop: 6, fontSize: 12 },
  note: { color: '#64748B', marginTop: 6, fontSize: 12 },
  controls: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { backgroundColor: '#E2E8F0', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: '#0F172A' },
  qty: { width: 24, textAlign: 'center', fontWeight: '700' },
  removeBtn: { marginLeft: 'auto' },
  removeText: { color: '#DC2626', fontWeight: '700' },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: '700', marginBottom: 4 },
  promoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: '#0F172A',
  },
  promoBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  promoBtnText: { color: '#fff', fontWeight: '700' },
  activePromo: { color: '#16A34A', marginBottom: 4, fontWeight: '600', marginTop: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  totalRow: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.35)' },
  totalText: { fontWeight: '700', fontSize: 16 },
  checkoutBtn: {
    marginTop: 'auto',
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { color: '#64748B' },
  secondary: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryText: { fontWeight: '700' },
});

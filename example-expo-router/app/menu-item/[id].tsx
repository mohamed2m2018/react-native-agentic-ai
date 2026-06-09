import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function MenuItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMenuItemById, addToCart } = useFoodDelivery();
  const item = getMenuItemById(id);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});

  const requiredMissing = useMemo(() => item?.modifiers.some((mod) => mod.required && !selected[mod.id]), [item?.modifiers, selected]);

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Item not found</Text>
        <Link href="/" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.linkText}>Return Home</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const add = () => {
    const options = item.modifiers.map((group) => ({ groupId: group.id, optionId: selected[group.id] })).filter((entry) => entry.optionId);
    if (requiredMissing) return;
    const result = addToCart(item.id, options, quantity, notes.trim());
    if (result.success) {
      router.push('/cart');
      return;
    }
    alert(result.error ?? 'Could not add item');
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>{item.image}</Text>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.desc}>{item.description}</Text>
      <Text style={styles.meta}>
        {item.dietary.join(' · ')} · {item.spiceLevel} · {item.calories} cal
      </Text>
      <Text style={styles.price}>${item.price.toFixed(2)}</Text>

      <Text style={styles.sectionTitle}>Modifiers</Text>
      {item.modifiers.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupRow}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            {group.required ? <Text style={styles.required}>Required</Text> : null}
          </View>
          {group.options.map((option) => {
            const isChecked = selected[group.id] === option.id;
            return (
              <Pressable key={option.id} style={styles.modifierRow} onPress={() => setSelected((prev) => ({ ...prev, [group.id]: option.id }))}>
                <Text style={styles.modifierText}>
                  {option.label} {option.extraCost > 0 ? `(+ $${option.extraCost.toFixed(2)})` : ''}
                </Text>
                <Switch
                  value={isChecked}
                  onValueChange={() => setSelected((prev) => ({ ...prev, [group.id]: isChecked ? '' : option.id }))}
                />
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.qtyRow}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={styles.qtyControl}>
          <Pressable onPress={() => setQuantity((value) => Math.max(1, value - 1))}><Text style={styles.qtyBtn}>−</Text></Pressable>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <Pressable onPress={() => setQuantity((value) => value + 1)}><Text style={styles.qtyBtn}>+</Text></Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="No onions, extra sauce, ring bell..."
        style={styles.input}
        multiline
      />

      <Pressable style={requiredMissing ? styles.disabledBtn : styles.primaryBtn} onPress={add} disabled={requiredMissing}>
        <Text style={styles.btnText}>{requiredMissing ? 'Select required options' : 'Add to Cart'}</Text>
      </Pressable>

      <Link href={`/store/${item.restaurantId}`} asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>Back to menu</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 14 },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  desc: { color: '#475569', marginTop: 8, lineHeight: 22 },
  meta: { color: '#64748B', marginTop: 8 },
  price: { fontSize: 24, color: '#0F766E', marginTop: 10, fontWeight: '700' },
  sectionTitle: { marginTop: 8, fontSize: 18, fontWeight: '700' },
  groupCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  groupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontSize: 16, fontWeight: '700' },
  required: { fontSize: 12, color: '#B91C1C', fontWeight: '700' },
  modifierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modifierText: { fontSize: 14, flex: 1, paddingVertical: 8 },
  qtyRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, minWidth: 28, textAlign: 'center' },
  qtyValue: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: 'rgba(148,163,184,0.4)', borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: 'top' },
  primaryBtn: { marginTop: 12, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center', paddingVertical: 14 },
  disabledBtn: { marginTop: 12, borderRadius: 12, backgroundColor: '#CBD5E1', alignItems: 'center', paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700' },
  linkBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  linkText: { fontWeight: '700', color: '#334155' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
});

import { Link, useLocalSearchParams } from 'expo-router';
import { AIZone } from '@mobileai/react-native';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRestaurantById, getMenuByRestaurant } = useFoodDelivery();
  const restaurant = getRestaurantById(id);
  const menu = getMenuByRestaurant(id);

  if (!restaurant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Store not found</Text>
        <Link href="/" asChild>
          <Pressable style={styles.backBtn}>
            <Text style={styles.backText}>Back to Home</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <AIZone id={`store-${restaurant.id}`} allowHighlight>
        <View style={styles.header}>
          <Text style={styles.storeName}>{restaurant.name}</Text>
          <Text style={styles.storeMeta}>
            {restaurant.cuisine} · ⭐ {restaurant.rating.toFixed(1)} · Min ${restaurant.minimumOrder.toFixed(2)}
          </Text>
          <Text style={styles.storeMeta}>Delivery fee ${restaurant.deliveryFee.toFixed(2)} · ETA {restaurant.deliveryMinutes}m</Text>
          <Text style={styles.address}>{restaurant.address}</Text>
        </View>

        <Text style={styles.sectionTitle}>Menu</Text>
        <FlatList
          data={menu}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/menu-item/${item.id}`} asChild>
              <Pressable style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemIcon}>{item.image}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                    <Text style={styles.itemMeta}>{item.spiceLevel} • {item.calories} cal</Text>
                  </View>
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                </View>
                {!item.isAvailable && <Text style={styles.unavailable}>Unavailable: {item.unavailableReason}</Text>}
              </Pressable>
            </Link>
          )}
        />
      </AIZone>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.24)' },
  storeName: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  storeMeta: { color: '#475569', marginBottom: 4 },
  address: { color: '#475569', marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', margin: 16 },
  list: { padding: 16, paddingTop: 0, gap: 10 },
  itemCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: { fontSize: 28 },
  itemName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  itemDescription: { color: '#475569', marginBottom: 6 },
  itemMeta: { color: '#64748B', fontSize: 12 },
  itemPrice: { fontWeight: '700', color: '#0F766E', fontSize: 16 },
  unavailable: { marginTop: 8, color: '#DC2626', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  title: { fontSize: 20, fontWeight: '700' },
  backBtn: { backgroundColor: '#4F46E5', borderRadius: 10, padding: 12 },
  backText: { color: '#fff', fontWeight: '700' },
});

import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

const CUISINES = ['Italian', 'Asian', 'Healthy', 'Desserts', 'Fast Bites'];

export default function HomeScreen() {
  const router = useRouter();
  const { restaurants } = useFoodDelivery();
  const [cuisine, setCuisine] = useState<string | null>(null);

  const restaurantsToShow = useMemo(() => {
    if (!cuisine) return restaurants;
    return restaurants.filter((restaurant) => restaurant.cuisine === cuisine);
  }, [cuisine, restaurants]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AIZone id="dashbite-home" allowHighlight>
        <View style={styles.hero}>
          <Text style={styles.brand}>DashBite</Text>
          <Text style={styles.tagline}>Find food fast. Fix issues with support instantly.</Text>
        </View>
      </AIZone>

      <View style={styles.quickRow}>
        <Pressable style={styles.helperCard} onPress={() => router.push('/support')}>
          <Text style={styles.helperTitle}>Need help?</Text>
          <Text style={styles.helperText}>Ask about delivery windows, restaurant items, refunds, fees.</Text>
        </Pressable>
        <Pressable style={[styles.helperCard, styles.cartLink]} onPress={() => router.push('/cart')}>
          <Text style={styles.helperTitle}>Open Cart</Text>
          <Text style={styles.helperText}>Review your order and check out.</Text>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        <Pressable style={[styles.helperCard, styles.testLabCard]} onPress={() => router.push('/test-ui')}>
          <Text style={styles.helperTitle}>Bottom Sheet Test</Text>
          <Text style={styles.helperText}>Open the UI lab and launch the native bottom sheet.</Text>
        </Pressable>
        <Pressable style={[styles.helperCard, styles.modalTestCard]} onPress={() => router.push('/test-ui')}>
          <Text style={styles.helperTitle}>Modal Component Test</Text>
          <Text style={styles.helperText}>Open the UI lab and launch the React Native modal component.</Text>
        </Pressable>
      </View>

      <AIZone id="cuisine-filter">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          <Pressable
            key="all"
            style={[styles.pill, cuisine === null ? styles.pillActive : styles.pillIdle]}
            onPress={() => setCuisine(null)}
          >
            <Text style={[styles.pillText, cuisine === null ? styles.pillTextActive : styles.pillTextIdle]}>All</Text>
          </Pressable>
          {CUISINES.map((item) => (
            <Pressable
              key={item}
              style={[styles.pill, cuisine === item ? styles.pillActive : styles.pillIdle]}
              onPress={() => setCuisine(item)}
            >
              <Text style={[styles.pillText, cuisine === item ? styles.pillTextActive : styles.pillTextIdle]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </AIZone>

      <AIZone id="restaurant-list" allowSimplify>
        {restaurantsToShow.map((restaurant) => (
          <Link key={restaurant.id} href={`/store/${restaurant.id}`} asChild>
            <Pressable style={styles.storeCard}>
              <View style={styles.storeTitleRow}>
                <Text style={styles.storeName}>{restaurant.name}</Text>
                <Text style={styles.eta}>ETA {restaurant.deliveryMinutes}m</Text>
              </View>
              <Text style={styles.storeMeta}>
                {restaurant.cuisine} · ⭐ {restaurant.rating.toFixed(1)} · Delivery fee ${restaurant.deliveryFee.toFixed(2)}
              </Text>
              <Text style={styles.storeMeta}>Min order ${restaurant.minimumOrder.toFixed(2)}</Text>
            </Pressable>
          </Link>
        ))}
      </AIZone>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 40 },
  hero: { padding: 20 },
  brand: { fontSize: 34, fontWeight: '800' },
  tagline: { marginTop: 6, color: '#64748B', fontSize: 15 },
  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 10 },
  helperCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  cartLink: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  testLabCard: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  modalTestCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  helperTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  helperText: { color: '#475569', fontSize: 13, lineHeight: 18 },
  pillRow: { marginHorizontal: 12, marginTop: 16, marginBottom: 14 },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, marginRight: 10 },
  pillActive: { backgroundColor: '#111827' },
  pillIdle: { backgroundColor: '#F1F5F9' },
  pillText: { fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  pillTextIdle: { color: '#1E293B' },
  storeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  storeTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  storeName: { fontSize: 18, fontWeight: '700' },
  eta: { fontSize: 13, color: '#0EA5E9' },
  storeMeta: { color: '#334155', marginBottom: 4 },
});

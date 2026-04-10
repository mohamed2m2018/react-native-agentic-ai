import { StyleSheet, FlatList, Pressable, Button, Switch } from 'react-native';
// import { AIZone } from 'experimental-stuff'; // old
import { AIZone } from '@mobileai/react-native';

import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useRef, useCallback, useState } from 'react';

const PRODUCTS = [
  { id: '1', name: 'Wireless Headphones', price: 79.99, category: 'Electronics' },
  { id: '2', name: 'Running Shoes', price: 129.99, category: 'Footwear' },
  { id: '3', name: 'Laptop Stand', price: 45.99, category: 'Accessories' }, // 🐛 BUG: price is 45.99 here but 49.99 on detail page
  { id: '4', name: 'Coffee Maker', price: 89.99, category: 'Kitchen' },
  { id: '5', name: 'Yoga Mat', price: 34.99, category: 'Fitness' },
  { id: '6', name: 'Desk Lamp', price: 44.99, category: 'Home Office' },
];

export default function HomeScreen() {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  
  // Draft State
  const [draftAddress, setDraftAddress] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftZip, setDraftZip] = useState('');
  const [isExpress, setIsExpress] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Saved Final State
  const [savedConfig, setSavedConfig] = useState<any>(null);

  const handleSave = () => {
    const trimmedAddress = draftAddress.trim();
    const trimmedCity = draftCity.trim();
    const trimmedZip = draftZip.trim();

    if (!trimmedAddress || !trimmedCity || !trimmedZip) {
      setDeliveryError('Delivery confirmation failed. Please complete the full shipping address before checkout.');
      return;
    }

    if (!/^\d{5}$/.test(trimmedZip)) {
      setDeliveryError('Delivery confirmation error: enter a valid 5-digit postal code before checkout.');
      return;
    }

    if (isExpress && trimmedZip !== '12345') {
      setDeliveryError('Express delivery confirmation failed. Use postal code 12345 for this demo checkout.');
      return;
    }

    setDeliveryError('');
    setSavedConfig({
      address: trimmedAddress,
      city: trimmedCity,
      zip: trimmedZip,
      express: isExpress,
      gift: giftWrap
    });
    bottomSheetModalRef.current?.dismiss();
  };

  const handlePresentModalPress = useCallback(() => {
    setDeliveryError('');
    bottomSheetModalRef.current?.present();
  }, []);

  return (
    <View style={styles.container}>
      {/* Hero banner — low priority: AI can simplify this section */}
      <AIZone id="hero-banner" allowSimplify>
        <Text style={styles.header}>Welcome to ShopApp</Text>
        <Text style={styles.subtitle}>Browse our products</Text>
      </AIZone>

      <Link href="/test-ui" asChild>
        <Pressable style={styles.testNavButton}>
          <Text style={styles.openSheetButtonText}>🧪 Exhaustive UI Test Screen</Text>
        </Pressable>
      </Link>

      <Pressable style={styles.openSheetButton} onPress={handlePresentModalPress}>
        <Text style={styles.openSheetButtonText}>Advanced Shipping Options</Text>
      </Pressable>

      {/* Render Saved Info */}
      {savedConfig && (
        <View style={styles.savedOverlay}>
          <Text style={styles.savedTitle}>Saved Shipping Details</Text>
          <Text style={styles.savedText}>📍 {savedConfig.address || 'No Address'}, {savedConfig.city || 'No City'} {savedConfig.zip}</Text>
          <Text style={styles.savedText}>🏎️ Express: {savedConfig.express ? 'Yes' : 'No'}</Text>
          <Text style={styles.savedText}>🎁 Gift Wrap: {savedConfig.gift ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {/* Product list — high priority: AI can highlight items and simplify */}
      <AIZone id="product-list" allowHighlight allowSimplify>
        <FlatList
          data={PRODUCTS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/product/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <View style={[styles.badge, { backgroundColor: getCategoryColor(item.category) }]}>
                  <Text style={styles.badgeText}>{item.category.charAt(0)}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardCategory}>{item.category}</Text>
                </View>
                <Text style={styles.cardPrice}>${item.price}</Text>
              </Pressable>
            </Link>
          )}
        />

        <Link href="/categories" asChild>
          <Pressable style={styles.browseButton}>
            <Text style={styles.browseButtonText}>Browse All Categories</Text>
          </Pressable>
        </Link>
      </AIZone>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={['75%', '95%']}
        index={0}
      >
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sheetHeader}>Shipping Configuration</Text>
          <Text style={styles.sheetSub}>Customize your delivery preferences</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <BottomSheetTextInput
              placeholder="Street Address"
              style={styles.input}
              value={draftAddress}
              onChangeText={(value) => {
                setDraftAddress(value);
                if (deliveryError) setDeliveryError('');
              }}
            />
            <BottomSheetTextInput
              placeholder="City"
              style={styles.input}
              value={draftCity}
              onChangeText={(value) => {
                setDraftCity(value);
                if (deliveryError) setDeliveryError('');
              }}
            />
            <BottomSheetTextInput
              placeholder="Zip / Postal Code"
              style={styles.input}
              keyboardType="numeric"
              value={draftZip}
              onChangeText={(value) => {
                setDraftZip(value);
                if (deliveryError) setDeliveryError('');
              }}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upgrades</Text>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleText}>Express Delivery</Text>
                <Text style={styles.toggleSub}>Arrives in 1-2 business days (+$12.99)</Text>
              </View>
              <Switch value={isExpress} onValueChange={setIsExpress} />
            </View>
            <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <View>
                <Text style={styles.toggleText}>Gift Wrapping</Text>
                <Text style={styles.toggleSub}>Include a personalized message (+$4.99)</Text>
              </View>
              <Switch value={giftWrap} onValueChange={setGiftWrap} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Set Destinations</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.destinationButton, { flex: 1 }]} onPress={() => { setDraftAddress('15 Rue de Rivoli'); setDraftCity('Paris'); setDraftZip('75001'); }}>
                <Text style={styles.destinationButtonText}>France (EU)</Text>
              </Pressable>
              <Pressable style={[styles.destinationButton, { flex: 1, backgroundColor: '#2C3E50' }]} onPress={() => { setDraftAddress('Alexanderplatz 1'); setDraftCity('Berlin'); setDraftZip('10178'); }}>
                <Text style={styles.destinationButtonText}>Germany (EU)</Text>
              </Pressable>
            </View>
          </View>

          {deliveryError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTitle}>Delivery Confirmation Error</Text>
              <Text style={styles.errorBannerText}>{deliveryError}</Text>
            </View>
          ) : null}

          <Pressable style={styles.submitButton} onPress={handleSave}>
             <Text style={styles.submitButtonText}>Save Details and Checkout</Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Electronics: '#3498DB',
    Footwear: '#E74C3C',
    Accessories: '#9B59B6',
    Kitchen: '#E67E22',
    Fitness: '#27AE60',
    'Home Office': '#1ABC9C',
  };
  return colors[category] || '#6c757d';
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  header: { fontSize: 28, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#6c757d', paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  badge: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardContent: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardCategory: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#27AE60' },
  browseButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3498DB',
    alignItems: 'center',
  },
  browseButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  openSheetButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  testNavButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  openSheetButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  savedOverlay: {
    backgroundColor: '#E8F6F3',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1ABC9C'
  },
  savedTitle: { color: '#16A085', fontWeight: '800', marginBottom: 8, fontSize: 15 },
  savedText: { color: '#2C3E50', fontSize: 14, marginBottom: 4, fontWeight: '500' },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sheetHeader: { fontSize: 26, fontWeight: '800', marginTop: 10 },
  sheetSub: { fontSize: 15, color: '#6c757d', marginBottom: 24, marginTop: 4 },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(150,150,150,0.05)',
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6c757d',textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    backgroundColor: '#fff',
    marginBottom: 10,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  toggleText: { fontSize: 16, fontWeight: '600' },
  toggleSub: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  destinationButton: {
    backgroundColor: '#3498DB',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  destinationButtonText: { color: '#fff', fontWeight: '700' },
  submitButton: {
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  errorBanner: {
    backgroundColor: '#FDECEC',
    borderColor: '#E74C3C',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  errorBannerTitle: {
    color: '#C0392B',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  errorBannerText: {
    color: '#922B21',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});

import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, NavButton, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function ReviewScreen() {
  const router = useRouter();
  const {
    selectedOffer,
    selectedSeat,
    traveler,
    payment,
    acknowledgedRestrictions,
    bookingAttemptCount,
    acknowledgeRestrictions,
    finalAvailabilityCheck,
    submitBooking,
  } = useFlightDemo();

  const total = (selectedOffer?.livePrice ?? 0) + (selectedSeat?.price ?? 0);

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="booking-review-screen" allowHighlight>
          <Eyebrow>Checkout</Eyebrow>
          <Title>Booking Review</Title>
          <Body>Review your itinerary, traveler details, seat, payment, and fare rules before ticketing.</Body>

          <Card>
            <Text style={styles.sectionTitle}>Itinerary</Text>
            <Text style={styles.meta}>{selectedOffer ? `${selectedOffer.airline} ${selectedOffer.flightNo}` : 'No flight selected'}</Text>
            <Text style={styles.meta}>Fare: {selectedOffer?.fareClass ?? 'missing'} - ${selectedOffer?.livePrice ?? 0}</Text>
            <Text style={styles.meta}>Seat: {selectedSeat ? `${selectedSeat.id} (${selectedSeat.kind}, $${selectedSeat.price})` : 'No held seat'}</Text>
            <Text style={styles.meta}>Traveler: {traveler.fullName}</Text>
            <Text style={styles.total}>Current total: ${total}</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Checkout checklist</Text>
            <View style={styles.pills}>
              <StatusPill status={selectedOffer?.lockId ? 'ready' : 'blocked'} label={selectedOffer?.lockId ? 'Fare locked' : 'Fare missing'} />
              <StatusPill status={selectedSeat?.status === 'held' ? 'ready' : 'blocked'} label={selectedSeat?.status === 'held' ? 'Seat held' : 'Seat not held'} />
              <StatusPill status={payment.verified ? 'ready' : 'blocked'} label={payment.verified ? 'Payment verified' : 'Payment pending'} />
              <StatusPill status={acknowledgedRestrictions ? 'ready' : 'warning'} label={acknowledgedRestrictions ? 'Rules acknowledged' : 'Rules not acknowledged'} />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Fare restrictions</Text>
            <Text style={styles.restriction}>{selectedOffer?.restriction ?? 'No fare selected.'}</Text>
            <Text style={styles.meta}>Refund and change conditions are shown for the selected fare.</Text>
            <Pressable style={styles.secondary} onPress={acknowledgeRestrictions}>
              <Text style={styles.secondaryText}>I Understand These Rules</Text>
            </Pressable>
          </Card>

          <Pressable
            style={styles.secondary}
            onPress={() => {
              const result = finalAvailabilityCheck();
              Alert.alert('Final availability', result.message);
            }}
          >
            <Text style={styles.secondaryText}>Refresh Price and Availability</Text>
          </Pressable>

          <Pressable
            style={styles.primary}
            onPress={() => {
              const result = submitBooking();
              Alert.alert('Submit booking', result.message);
              if (result.success) router.push('/confirmation');
            }}
          >
            <Text style={styles.primaryText}>
              {bookingAttemptCount === 0 ? 'Book This Trip' : 'Try Booking Again'}
            </Text>
          </Pressable>

          <NavButton href="/ops" label="Open Activity" />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: palette.muted, lineHeight: 20 },
  total: { color: palette.ink, fontWeight: '900', fontSize: 18 },
  restriction: { color: palette.red, fontWeight: '800', lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  secondary: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: palette.ink, fontWeight: '900', textAlign: 'center' },
});

import { ScrollView, StyleSheet, Text } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, NavButton, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function ConfirmationScreen() {
  const { bookingRecord, selectedOffer, selectedSeat, payment, idempotencyKey } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="confirmation-screen" allowHighlight>
          <Eyebrow>Trip booked</Eyebrow>
          <Title>Confirmation</Title>
          <Body>
            Your ticket, receipt, payment authorization, and mobile itinerary are ready.
          </Body>

          <Card>
            {bookingRecord ? (
              <>
                <StatusPill status="success" label="PNR settled" />
                <Text style={styles.pnr}>PNR {bookingRecord.pnr}</Text>
                <Text style={styles.meta}>Ticket {bookingRecord.ticketNumber}</Text>
                <Text style={styles.meta}>Receipt {bookingRecord.receiptId}</Text>
                <Text style={styles.meta}>{bookingRecord.downstreamStatus}</Text>
              </>
            ) : (
              <>
                <StatusPill status="blocked" label="No PNR yet" />
                <Text style={styles.meta}>Return to Review to complete ticketing.</Text>
              </>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Final itinerary state</Text>
            <Text style={styles.meta}>{selectedOffer ? `${selectedOffer.airline} ${selectedOffer.flightNo}` : 'No flight selected'}</Text>
            <Text style={styles.meta}>Seat {selectedSeat?.id ?? 'none'}</Text>
            <Text style={styles.meta}>Payment auth {payment.authId ?? 'none'}</Text>
            <Text style={styles.meta}>Order reference {idempotencyKey}</Text>
          </Card>

          <NavButton href="/ops" label="Open Activity" primary />
          <NavButton href="/" label="Back to Home" />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  pnr: { color: palette.ink, fontSize: 34, fontWeight: '900' },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: palette.muted, lineHeight: 20 },
});

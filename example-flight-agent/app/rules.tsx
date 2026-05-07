import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Card, NavButton, Page, StatusPill } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

const LEGAL_CHECKS = [
  ['Fare changes', 'Price changes are shown before ticketing.'],
  ['Seat changes', 'Paid seats and substitutions are reviewed before purchase.'],
  ['Card verification', 'Bank verification may be required at checkout.'],
  ['Final purchase', 'Ticketing starts only from the booking review screen.'],
];

export default function RulesScreen() {
  const { selectedOffer, payment, acknowledgedRestrictions, bookingAttemptCount } = useFlightDemo();

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AIZone id="fare-rules-screen" allowHighlight>
          <Card>
            <Text style={styles.kicker}>Fare rules</Text>
            <Text style={styles.title}>Before You Book</Text>
            <Text style={styles.copy}>Review refundability, fare changes, payment requirements, and ticketing conditions.</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Selected fare</Text>
            <Text style={styles.copy}>{selectedOffer ? `${selectedOffer.airline} ${selectedOffer.flightNo} - ${selectedOffer.fareClass}` : 'No fare selected yet.'}</Text>
            <Text style={styles.warning}>{selectedOffer?.restriction ?? 'Select a fare to view restrictions.'}</Text>
            <View style={styles.pills}>
              <StatusPill status={selectedOffer?.refundable ? 'ready' : 'blocked'} label={selectedOffer?.refundable ? 'refundable' : 'non-refundable'} />
              <StatusPill status={acknowledgedRestrictions ? 'ready' : 'warning'} label={acknowledgedRestrictions ? 'acknowledged' : 'needs acknowledgement'} />
              <StatusPill status={payment.verified ? 'ready' : 'idle'} label={payment.verified ? 'payment ready' : 'payment pending'} />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Purchase safeguards</Text>
            {LEGAL_CHECKS.map(([label, value]) => (
              <View key={label} style={styles.guardrail}>
                <View style={styles.guardrailBar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guardrailTitle}>{label}</Text>
                  <Text style={styles.copy}>{value}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Ticketing attempts</Text>
            <Text style={styles.copy}>Booking attempts so far: {bookingAttemptCount}</Text>
            <Text style={styles.copy}>If ticketing does not complete, the booking stays pending until it is retried or canceled.</Text>
          </Card>

          <NavButton href="/review" label="Continue to review" primary />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 34 },
  kicker: { color: palette.teal, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 28, fontWeight: '900' },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  copy: { color: palette.muted, lineHeight: 20 },
  warning: { color: palette.orange, fontWeight: '900', lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guardrail: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  guardrailBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: palette.teal },
  guardrailTitle: { color: palette.ink, fontWeight: '900' },
});

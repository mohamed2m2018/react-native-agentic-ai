import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Card, NavButton, Page, StatusPill } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

const STAGES = [
  { key: 'search', title: 'Shopping', route: '/search', detail: 'Compare flight times, baggage, and refundability.' },
  { key: 'fare', title: 'Fare hold', route: '/results', detail: 'Hold the selected fare before checkout.' },
  { key: 'traveler', title: 'Traveler', route: '/traveler', detail: 'Validate passport, KTN, and loyalty rules.' },
  { key: 'seat', title: 'Seat', route: '/seats', detail: 'Choose and hold your preferred seat.' },
  { key: 'payment', title: 'Payment', route: '/payment', detail: 'Authorize the saved card.' },
  { key: 'review', title: 'Review', route: '/review', detail: 'Confirm the itinerary before ticketing.' },
];

export default function TripsScreen() {
  const { selectedOffer, selectedSeat, payment, acknowledgedRestrictions, bookingRecord } = useFlightDemo();

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AIZone id="trip-hub-screen" allowHighlight>
          <View style={styles.headerCard}>
            <Text style={styles.kicker}>Active itinerary</Text>
            <Text style={styles.title}>Cairo to London</Text>
            <Text style={styles.subtitle}>Next Friday morning - 1 adult - Economy - refundable preferred</Text>
            <View style={styles.headerStats}>
              <MiniStat label="Carrier" value={selectedOffer?.airline ?? 'Open'} />
              <MiniStat label="Seat" value={selectedSeat?.id ?? 'None'} />
              <MiniStat label="PNR" value={bookingRecord?.pnr ?? 'Pending'} />
            </View>
          </View>

          <Card>
            <View style={styles.sectionTop}>
              <View>
                <Text style={styles.sectionTitle}>Workflow board</Text>
                <Text style={styles.sectionSub}>Complete each step before ticketing.</Text>
              </View>
              <StatusPill status={bookingRecord ? 'success' : 'warning'} label={bookingRecord ? 'settled' : 'open'} />
            </View>
            {STAGES.map((stage, index) => {
              const ready =
                (stage.key === 'search' && true) ||
                (stage.key === 'fare' && !!selectedOffer?.lockId) ||
                (stage.key === 'traveler' && !!selectedOffer) ||
                (stage.key === 'seat' && selectedSeat?.status === 'held') ||
                (stage.key === 'payment' && payment.verified) ||
                (stage.key === 'review' && acknowledgedRestrictions);
              return (
                <Link key={stage.key} href={stage.route as any} asChild>
                  <Pressable style={styles.stageRow}>
                    <View style={[styles.stageIndex, ready && styles.stageIndexReady]}>
                      <Text style={[styles.stageIndexText, ready && styles.stageIndexTextReady]}>{index + 1}</Text>
                    </View>
                    <View style={styles.stageBody}>
                      <Text style={styles.stageTitle}>{stage.title}</Text>
                      <Text style={styles.stageDetail}>{stage.detail}</Text>
                    </View>
                    <Text style={styles.stageArrow}>Open</Text>
                  </Pressable>
                </Link>
              );
            })}
          </Card>

          <NavButton href="/ops" label="Open activity" primary />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 34 },
  headerCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 18, gap: 12, borderWidth: 1, borderColor: '#e4e8f0' },
  kicker: { color: palette.teal, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: palette.muted, lineHeight: 21 },
  headerStats: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 12 },
  miniLabel: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  miniValue: { color: palette.ink, fontWeight: '900', marginTop: 4 },
  sectionTop: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  sectionSub: { color: palette.muted, marginTop: 3, lineHeight: 19 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  stageIndex: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' },
  stageIndexReady: { backgroundColor: '#dcfce7' },
  stageIndexText: { color: palette.muted, fontWeight: '900' },
  stageIndexTextReady: { color: palette.green },
  stageBody: { flex: 1 },
  stageTitle: { color: palette.ink, fontWeight: '900' },
  stageDetail: { color: palette.muted, marginTop: 2, lineHeight: 19 },
  stageArrow: { color: palette.blue, fontWeight: '900' },
  copy: { color: palette.muted, lineHeight: 20 },
});

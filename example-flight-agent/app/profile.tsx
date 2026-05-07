import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Card, NavButton, Page, StatusPill } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function ProfileScreen() {
  const { traveler, payment, search } = useFlightDemo();

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AIZone id="traveler-profile-screen" allowHighlight>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>MS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{traveler.fullName}</Text>
              <Text style={styles.meta}>Travel Pro member - Cairo base</Text>
            </View>
          </View>

          <Card>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <PrefRow label="Cabin" value={search.cabin} />
            <PrefRow label="Seat" value="Aisle preferred" />
            <PrefRow label="Refundability" value={search.refundableOnly ? 'Refundable only' : 'Any fare'} />
            <PrefRow label="Budget guardrail" value={`$${search.budget}`} />
          </Card>

          <Card>
            <View style={styles.sectionTop}>
              <Text style={styles.sectionTitle}>Wallet</Text>
              <StatusPill status={payment.verified ? 'ready' : 'idle'} label={payment.verified ? 'authorized' : 'available'} />
            </View>
            <PrefRow label="Card" value={payment.cardLabel} />
            <PrefRow label="Billing ZIP" value={payment.billingZip} />
            <Text style={styles.note}>Some purchases may require bank verification at checkout.</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Loyalty accounts</Text>
            <PrefRow label="Nova Airways" value={traveler.loyalty} />
            <PrefRow label="Status" value={traveler.loyalty === 'NV-MOHAMED-118' ? 'Verified' : 'Needs review'} />
          </Card>

          <NavButton href="/documents" label="Open documents" primary />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.prefRow}>
      <Text style={styles.prefLabel}>{label}</Text>
      <Text style={styles.prefValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 34 },
  profileHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e4e8f0' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  name: { color: palette.ink, fontSize: 24, fontWeight: '900' },
  meta: { color: palette.muted, marginTop: 3 },
  sectionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 2 },
  prefLabel: { color: palette.muted, flex: 1 },
  prefValue: { color: palette.ink, fontWeight: '900', flex: 1, textAlign: 'right' },
  note: { color: palette.muted, lineHeight: 20 },
});

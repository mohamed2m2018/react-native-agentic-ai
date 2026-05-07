import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Card, NavButton, Page, StatusPill } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

const REQUIREMENTS = [
  ['Passport', 'Required for ticketing and Secure Flight data.'],
  ['Known traveler number', 'Optional and matched against passenger identity.'],
  ['Loyalty account', 'Airline-specific validation can reject name or fare class.'],
  ['Refund rule acknowledgement', 'Required before final purchase.'],
];

export default function DocumentsScreen() {
  const { traveler, acknowledgedRestrictions, selectedOffer } = useFlightDemo();

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AIZone id="documents-screen" allowHighlight>
          <Card>
            <Text style={styles.kicker}>Travel documents</Text>
            <Text style={styles.title}>Identity and compliance</Text>
            <Text style={styles.copy}>Passport, trusted traveler, and loyalty details used for airline validation.</Text>
          </Card>

          <Card>
            <View style={styles.docRow}>
              <View>
                <Text style={styles.docTitle}>Passport</Text>
                <Text style={styles.docDetail}>{traveler.passport.slice(0, 1)}******{traveler.passport.slice(-2)}</Text>
              </View>
              <StatusPill status="ready" label="on file" />
            </View>
            <View style={styles.docRow}>
              <View>
                <Text style={styles.docTitle}>Known traveler</Text>
                <Text style={styles.docDetail}>{traveler.knownTraveler}</Text>
              </View>
              <StatusPill status="ready" label="stored" />
            </View>
            <View style={styles.docRow}>
              <View>
                <Text style={styles.docTitle}>Loyalty account</Text>
                <Text style={styles.docDetail}>{traveler.loyalty}</Text>
              </View>
              <StatusPill status={traveler.loyalty === 'NV-MOHAMED-118' ? 'ready' : 'warning'} label={traveler.loyalty === 'NV-MOHAMED-118' ? 'valid' : 'needs check'} />
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Airline requirements</Text>
            {REQUIREMENTS.map(([title, detail]) => (
              <View key={title} style={styles.requirement}>
                <View style={styles.bullet} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle}>{title}</Text>
                  <Text style={styles.copy}>{detail}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Selected fare rule</Text>
            <Text style={styles.copy}>{selectedOffer?.restriction ?? 'No fare selected yet.'}</Text>
            <StatusPill status={acknowledgedRestrictions ? 'ready' : 'warning'} label={acknowledgedRestrictions ? 'acknowledged' : 'not acknowledged'} />
          </Card>

          <NavButton href="/traveler" label="Edit traveler profile" primary />
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
  docRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  docTitle: { color: palette.ink, fontWeight: '900' },
  docDetail: { color: palette.muted, marginTop: 3 },
  requirement: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.teal, marginTop: 6 },
  reqTitle: { color: palette.ink, fontWeight: '900' },
});

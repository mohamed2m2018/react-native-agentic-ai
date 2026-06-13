import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, NavButton, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function OpsLogScreen() {
  const { opsLog, tripSummary } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="ops-log-screen" allowHighlight>
          <Eyebrow>Trip activity</Eyebrow>
          <Title>Trip Activity</Title>
          <Body>Recent updates for fare holds, seat holds, payment, and ticketing.</Body>

          <Card>
            <Text style={styles.sectionTitle}>Current trip status</Text>
            {tripSummary.map((line) => (
              <Text key={line} style={styles.meta}>{line}</Text>
            ))}
          </Card>

          {opsLog.map((event) => (
            <Card key={event.id}>
              <View style={styles.eventTop}>
                <Text style={styles.system}>{event.system}</Text>
                <Text style={styles.time}>{event.at}</Text>
              </View>
              <StatusPill status={event.status} label={event.status} />
              <Text style={styles.meta}>{event.message}</Text>
            </Card>
          ))}

          <NavButton href="/review" label="Return to Review" primary />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  system: { color: palette.ink, fontWeight: '900', flex: 1 },
  time: { color: palette.muted, fontSize: 12 },
  meta: { color: palette.muted, lineHeight: 20 },
});

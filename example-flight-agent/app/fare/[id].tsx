import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, NavButton, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function FareDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { offers, selectedOffer, selectOffer, lockFare } = useFlightDemo();
  const offer = selectedOffer?.id === id ? selectedOffer : offers.find((candidate) => candidate.id === id);

  if (!offer) {
    return (
      <Page>
        <Title>Fare not found</Title>
        <NavButton href="/results" label="Back to Results" />
      </Page>
    );
  }

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="fare-details-screen" allowHighlight>
          <Eyebrow>Fare details</Eyebrow>
          <Title>{offer.airline} {offer.flightNo}</Title>
          <Body>Review price, baggage, refundability, and change conditions.</Body>

          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Current price</Text>
              <Text style={styles.value}>${offer.livePrice}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Fare class</Text>
              <Text style={styles.value}>{offer.fareClass}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Baggage</Text>
              <Text style={styles.value}>{offer.baggage}</Text>
            </View>
            <View style={styles.pills}>
              <StatusPill status={offer.refundable ? 'ready' : 'blocked'} label={offer.refundable ? 'Refundable' : 'Non-refundable'} />
              <StatusPill status={offer.lockId ? 'ready' : 'warning'} label={offer.lockId ? `Locked ${offer.lockId}` : 'No fare lock'} />
            </View>
            <Text style={styles.restriction}>{offer.restriction}</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Fare conditions</Text>
            <Text style={styles.meta}>Change fee: ${offer.changeFee}</Text>
            <Text style={styles.meta}>Price may change by ${offer.priceDrift} before the fare is held.</Text>
            {offer.lockExpiresAt ? <Text style={styles.meta}>Lock expires: {offer.lockExpiresAt}</Text> : null}
          </Card>

          <Pressable
            style={styles.primary}
            onPress={() => {
              selectOffer(offer.id);
              const result = lockFare();
              Alert.alert('Fare lock', result.message);
            }}
          >
            <Text style={styles.primaryText}>Hold Fare</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => {
              selectOffer(offer.id);
              router.push('/traveler');
            }}
          >
            <Text style={styles.secondaryText}>Continue to Traveler Info</Text>
          </Pressable>
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: palette.muted },
  value: { color: palette.ink, fontWeight: '900' },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: palette.muted, lineHeight: 20 },
  restriction: { color: palette.red, fontWeight: '800', lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: palette.ink, fontWeight: '900' },
});

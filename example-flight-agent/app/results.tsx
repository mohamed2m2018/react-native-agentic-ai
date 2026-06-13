import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, NavButton, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function ResultsScreen() {
  const { offers, search, selectOffer } = useFlightDemo();
  const budget = Number(search.budget || 0);

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="flight-results-screen" allowHighlight>
          <Eyebrow>Available fares</Eyebrow>
          <Title>Flight Results</Title>
          <Body>Compare price, refundability, baggage, loyalty eligibility, and schedule.</Body>

          {offers.map((offer) => {
            const overBudget = budget > 0 && offer.livePrice > budget;
            return (
              <Card key={offer.id}>
                <View style={styles.offerTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.airline}>{offer.airline}</Text>
                    <Text style={styles.meta}>{offer.flightNo} - {offer.depart} to {offer.arrive} - {offer.duration}</Text>
                  </View>
                  <Text style={styles.price}>${offer.livePrice}</Text>
                </View>
                <View style={styles.pills}>
                  <StatusPill status={offer.refundable ? 'ready' : 'blocked'} label={offer.refundable ? 'Refundable' : 'Non-refundable'} />
                  <StatusPill status={offer.loyaltyEligible ? 'ready' : 'warning'} label={offer.loyaltyEligible ? 'Loyalty eligible' : 'No loyalty'} />
                  <StatusPill status={overBudget ? 'warning' : 'ready'} label={overBudget ? 'Over budget' : 'Within budget'} />
                </View>
                <Text style={styles.meta}>Fare {offer.fareClass}. {offer.baggage}. Change fee ${offer.changeFee}.</Text>
                <Text style={styles.warning}>{offer.restriction}</Text>
                <Link href={`/fare/${offer.id}`} asChild>
                  <Pressable style={styles.select} onPress={() => selectOffer(offer.id)}>
                    <Text style={styles.selectText}>View Fare Details</Text>
                  </Pressable>
                </Link>
              </Card>
            );
          })}

          <NavButton href="/ops" label="Open Activity" />
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  offerTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  airline: { fontSize: 18, fontWeight: '900', color: palette.ink },
  meta: { color: palette.muted, lineHeight: 20 },
  price: { color: palette.ink, fontWeight: '900', fontSize: 24 },
  warning: { color: palette.amber, lineHeight: 20, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  select: { backgroundColor: palette.navy, borderRadius: 8, alignItems: 'center', padding: 13 },
  selectText: { color: '#fff', fontWeight: '900' },
});

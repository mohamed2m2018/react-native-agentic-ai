import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, Page, StatusPill, Title } from '@/lib/ui';
import { palette, Seat, useFlightDemo } from '@/lib/flight-demo';

export default function SeatsScreen() {
  const router = useRouter();
  const { seats, selectedSeat, selectSeat, holdSeat } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="seat-map-screen" allowHighlight>
          <Eyebrow>Seat selection</Eyebrow>
          <Title>Seat Map</Title>
          <Body>Choose a seat and request a temporary hold with the airline.</Body>

          <Card>
            <View style={styles.grid}>
              {seats.map((seat) => (
                <SeatButton
                  key={seat.id}
                  seat={seat}
                  selected={selectedSeat?.id === seat.id}
                  onPress={() => selectSeat(seat.id)}
                />
              ))}
            </View>
            <View style={styles.legend}>
              <StatusPill status="ready" label="available" />
              <StatusPill status="warning" label="held" />
              <StatusPill status="blocked" label="taken" />
            </View>
          </Card>

          <Pressable
            style={styles.primary}
            onPress={() => {
              const result = holdSeat();
              Alert.alert('Seat hold', result.message);
              if (result.success) router.push('/payment');
            }}
          >
            <Text style={styles.primaryText}>Request Airline Seat Hold</Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.push('/payment')}>
            <Text style={styles.secondaryText}>Continue to Payment</Text>
          </Pressable>
        </AIZone>
      </ScrollView>
    </Page>
  );
}

function SeatButton({ seat, selected, onPress }: { seat: Seat; selected: boolean; onPress: () => void }) {
  const disabled = seat.status === 'taken';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.seat,
        seat.status === 'taken' && styles.seatTaken,
        seat.status === 'held' && styles.seatHeld,
        selected && styles.seatSelected,
      ]}
    >
      <Text style={[styles.seatText, disabled && styles.seatTakenText]}>{seat.id}</Text>
      <Text style={[styles.seatKind, disabled && styles.seatTakenText]}>{seat.kind}</Text>
      <Text style={[styles.seatKind, disabled && styles.seatTakenText]}>{seat.price ? `$${seat.price}` : 'free'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  seat: {
    width: '30%',
    minHeight: 86,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 3,
  },
  seatHeld: { backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
  seatTaken: { backgroundColor: '#f2f4f7', borderColor: '#d0d5dd' },
  seatSelected: { borderColor: palette.blue, borderWidth: 2 },
  seatText: { color: palette.ink, fontWeight: '900', fontSize: 18 },
  seatKind: { color: palette.muted, fontSize: 12 },
  seatTakenText: { color: '#98a2b3' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: palette.ink, fontWeight: '900' },
});

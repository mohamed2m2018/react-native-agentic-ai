import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, Page, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function TravelerScreen() {
  const router = useRouter();
  const { selectedOffer, traveler, updateTraveler, validateTraveler } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="traveler-info-screen" allowHighlight>
          <Eyebrow>Passenger details</Eyebrow>
          <Title>Traveler Info</Title>
          <Body>Keep your legal name, passport, trusted traveler number, and loyalty account up to date.</Body>

          <Card>
            <Text style={styles.sectionTitle}>Selected fare</Text>
            <Text style={styles.meta}>{selectedOffer ? `${selectedOffer.airline} ${selectedOffer.flightNo} - ${selectedOffer.fareClass}` : 'No fare selected yet.'}</Text>
          </Card>

          <Card>
            <Field label="Full legal name" value={traveler.fullName} onChangeText={(fullName) => updateTraveler({ fullName })} />
            <Field label="Passport number" value={traveler.passport} onChangeText={(passport) => updateTraveler({ passport })} />
            <Field label="Loyalty number" value={traveler.loyalty} onChangeText={(loyalty) => updateTraveler({ loyalty })} />
            <Field label="Known traveler number" value={traveler.knownTraveler} onChangeText={(knownTraveler) => updateTraveler({ knownTraveler })} />
          </Card>

          <Pressable
            style={styles.primary}
            onPress={() => {
              const result = validateTraveler();
              Alert.alert('Traveler validation', result.message);
              if (result.success) router.push('/seats');
            }}
          >
            <Text style={styles.primaryText}>Validate Traveler and Loyalty</Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.push('/seats')}>
            <Text style={styles.secondaryText}>Continue to Seat Map</Text>
          </Pressable>
        </AIZone>
      </ScrollView>
    </Page>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor="#98a2b3" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: palette.muted, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: palette.ink, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    color: palette.ink,
    backgroundColor: '#fff',
  },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: palette.ink, fontWeight: '900' },
});

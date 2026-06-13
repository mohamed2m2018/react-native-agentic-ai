import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, Page, Title } from '@/lib/ui';
import { Cabin, palette, useFlightDemo } from '@/lib/flight-demo';

const CABINS: Cabin[] = ['Economy', 'Premium Economy', 'Business'];

export default function SearchScreen() {
  const router = useRouter();
  const { search, updateSearch, runSearch } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="trip-search-screen" allowHighlight>
          <Eyebrow>Flight search</Eyebrow>
          <Title>Trip Search</Title>
          <Body>Choose your route, dates, passengers, cabin, and fare preferences.</Body>

          <Card>
            <Field label="Origin" value={search.origin} onChangeText={(origin) => updateSearch({ origin })} />
            <Field label="Destination" value={search.destination} onChangeText={(destination) => updateSearch({ destination })} />
            <Field label="Departure window" value={search.departDate} onChangeText={(departDate) => updateSearch({ departDate })} />
            <Field label="Return window" value={search.returnDate} onChangeText={(returnDate) => updateSearch({ returnDate })} />
            <Field label="Passengers" value={search.passengers} onChangeText={(passengers) => updateSearch({ passengers })} />
            <Field label="Budget USD" keyboardType="numeric" value={search.budget} onChangeText={(budget) => updateSearch({ budget })} />

            <Text style={styles.label}>Cabin</Text>
            <View style={styles.segmentRow}>
              {CABINS.map((cabin) => (
                <Pressable
                  key={cabin}
                  style={[styles.segment, search.cabin === cabin && styles.segmentActive]}
                  onPress={() => updateSearch({ cabin })}
                >
                  <Text style={[styles.segmentText, search.cabin === cabin && styles.segmentTextActive]}>{cabin}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Refundable only</Text>
                <Text style={styles.hint}>Show flexible fares with refund options.</Text>
              </View>
              <Switch value={search.refundableOnly} onValueChange={(refundableOnly) => updateSearch({ refundableOnly })} />
            </View>
          </Card>

          <Pressable
            style={styles.primary}
            onPress={() => {
              runSearch();
              router.push('/results');
            }}
          >
            <Text style={styles.primaryText}>Search Flights</Text>
          </Pressable>
        </AIZone>
      </ScrollView>
    </Page>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
        placeholder={label}
        placeholderTextColor="#98a2b3"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  field: { gap: 6 },
  label: { color: palette.ink, fontWeight: '800' },
  hint: { color: palette.muted, fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    color: palette.ink,
    backgroundColor: '#fff',
  },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10 },
  segmentActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  segmentText: { color: palette.ink, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
});

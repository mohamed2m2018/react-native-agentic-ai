import { Link, useRouter } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Page, StatusPill } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80';

const SHORTCUTS = [
  { href: '/trips', label: 'Trips', detail: 'Active itinerary' },
  { href: '/profile', label: 'Wallet', detail: 'Cards and miles' },
  { href: '/documents', label: 'Docs', detail: 'Passport ready' },
  { href: '/rules', label: 'Rules', detail: 'Fare policy' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { search, offers, selectedOffer, selectedSeat, payment, bookingRecord } = useFlightDemo();
  const featuredOffer = selectedOffer ?? offers[1];
  const total = (selectedOffer?.livePrice ?? featuredOffer.livePrice) + (selectedSeat?.price ?? 0);

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AIZone id="skyforge-home" allowHighlight>
          <ImageBackground source={{ uri: HERO_IMAGE }} imageStyle={styles.heroImage} style={styles.hero}>
            <View style={styles.heroShade} />
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.kicker}>SkyForge Travel</Text>
                <Text style={styles.heroTitle}>London weekend</Text>
              </View>
            </View>
            <Link href="/profile" asChild>
              <Pressable style={styles.avatar}>
                <Text style={styles.avatarText}>MS</Text>
              </Pressable>
            </Link>
            <View style={styles.statusAnchor}>
              <StatusPill status={bookingRecord ? 'success' : selectedOffer ? 'warning' : 'idle'} label={bookingRecord ? 'Booked' : selectedOffer ? 'Draft' : 'Planning'} />
            </View>
          </ImageBackground>

          <View style={styles.searchPanel}>
            <View style={styles.routeRow}>
              <Airport code="CAI" city="Cairo" />
              <View style={styles.routeTrack}>
                <View style={styles.trackLine} />
                <View style={styles.trackBadge}>
                  <Text style={styles.trackBadgeText}>SF</Text>
                </View>
              </View>
              <Airport code="LHR" city="London" right />
            </View>

            <View style={styles.searchFacts}>
              <Fact label="Date" value="Next Friday" />
              <Fact label="Who" value={search.passengers} />
              <Fact label="Cabin" value={search.cabin} />
            </View>

            <Pressable style={styles.primaryButton} onPress={() => router.push('/search')}>
              <Text style={styles.primaryButtonText}>Search flights</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutRail}>
            {SHORTCUTS.map((item) => (
              <Link key={item.href} href={item.href as any} asChild>
                <Pressable style={styles.shortcut}>
                  <Text style={styles.shortcutLabel}>{item.label}</Text>
                  <Text style={styles.shortcutDetail}>{item.detail}</Text>
                </Pressable>
              </Link>
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Best match</Text>
              <Text style={styles.sectionSubtitle}>Refundable fare matching your saved profile</Text>
            </View>
            <Link href="/results" asChild>
              <Pressable>
                <Text style={styles.linkText}>All</Text>
              </Pressable>
            </Link>
          </View>

          <Link href={`/fare/${featuredOffer.id}`} asChild>
            <Pressable style={styles.offerCard}>
              <View style={styles.offerHeader}>
                <View style={styles.airlineMark}>
                  <Text style={styles.airlineMarkText}>NV</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.airline}>{featuredOffer.airline}</Text>
                  <Text style={styles.flightMeta}>{featuredOffer.flightNo} - {featuredOffer.duration}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.price}>${featuredOffer.livePrice}</Text>
                  <Text style={styles.priceNote}>per adult</Text>
                </View>
              </View>

              <View style={styles.timeRow}>
                <View>
                  <Text style={styles.time}>{featuredOffer.depart}</Text>
                  <Text style={styles.city}>CAI</Text>
                </View>
                <View style={styles.timeTrack}>
                  <View style={styles.timeLine} />
                </View>
                <View style={styles.arrival}>
                  <Text style={styles.time}>{featuredOffer.arrive}</Text>
                  <Text style={styles.city}>LHR</Text>
                </View>
              </View>

              <View style={styles.tags}>
                <Tag label={featuredOffer.refundable ? 'Refundable' : 'Non-refundable'} />
                <Tag label={featuredOffer.baggage} />
                <Tag label="Aisle seats available" />
              </View>
            </Pressable>
          </Link>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Before checkout</Text>
                <Text style={styles.sectionSubtitle}>Trip readiness</Text>
              </View>
              <Text style={styles.total}>${total}</Text>
            </View>
            <Readiness label="Traveler" value="Passport and KTN saved" ready />
            <Readiness label="Seat" value={selectedSeat ? `${selectedSeat.id} ${selectedSeat.status}` : 'Pick after fare lock'} ready={selectedSeat?.status === 'held'} />
            <Readiness label="Payment" value={payment.verified ? 'Card authorized' : 'Verify at checkout'} ready={payment.verified} />
          </View>

        </AIZone>
      </ScrollView>
    </Page>
  );
}

function Airport({ code, city, right }: { code: string; city: string; right?: boolean }) {
  return (
    <View style={right ? styles.airportRight : styles.airport}>
      <Text style={styles.airportCode}>{code}</Text>
      <Text style={styles.airportCity}>{city}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function Readiness({ label, value, ready }: { label: string; value: string; ready?: boolean }) {
  return (
    <View style={styles.readyRow}>
      <View style={StyleSheet.flatten([styles.readyDot, ready && styles.readyDotOn])} />
      <View style={{ flex: 1 }}>
        <Text style={styles.readyLabel}>{label}</Text>
        <Text style={styles.readyValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 34 },
  hero: {
    height: 270,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: palette.navy,
  },
  heroImage: { borderRadius: 30 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 12, 31, 0.42)' },
  heroTop: { paddingRight: 58 },
  kicker: { color: '#d1fae5', fontWeight: '900', textTransform: 'uppercase', fontSize: 12 },
  heroTitle: { color: '#fff', fontSize: 32, lineHeight: 37, fontWeight: '900', marginTop: 6 },
  avatar: { position: 'absolute', top: 18, right: 18, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.navy, fontWeight: '900' },
  statusAnchor: { position: 'absolute', left: 20, bottom: 54 },
  searchPanel: {
    marginTop: -34,
    marginHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#e4e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  airport: { minWidth: 76 },
  airportRight: { minWidth: 76, alignItems: 'flex-end' },
  airportCode: { color: palette.ink, fontSize: 30, fontWeight: '900' },
  airportCity: { color: palette.muted, fontWeight: '800' },
  routeTrack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trackLine: { height: 2, alignSelf: 'stretch', backgroundColor: '#dbe4f0' },
  trackBadge: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  trackBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  searchFacts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 11 },
  factLabel: { color: palette.muted, fontSize: 11, fontWeight: '900' },
  factValue: { color: palette.ink, fontWeight: '900', marginTop: 4 },
  primaryButton: { backgroundColor: palette.navy, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  shortcutRail: { gap: 10, paddingHorizontal: 2 },
  shortcut: { width: 138, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e4e8f0' },
  shortcutLabel: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  shortcutDetail: { color: palette.muted, marginTop: 18, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: palette.muted, marginTop: 3, lineHeight: 19 },
  linkText: { color: palette.blue, fontWeight: '900' },
  offerCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, gap: 16, borderWidth: 1, borderColor: '#e4e8f0' },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  airlineMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  airlineMarkText: { color: palette.blue, fontWeight: '900' },
  airline: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  flightMeta: { color: palette.muted, marginTop: 3 },
  priceWrap: { alignItems: 'flex-end' },
  price: { color: palette.ink, fontSize: 25, fontWeight: '900' },
  priceNote: { color: palette.muted, fontWeight: '700', fontSize: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  time: { color: palette.ink, fontSize: 23, fontWeight: '900' },
  city: { color: palette.muted, fontWeight: '800' },
  arrival: { alignItems: 'flex-end' },
  timeTrack: { flex: 1 },
  timeLine: { height: 2, backgroundColor: '#dbe4f0' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: '#e4e8f0' },
  total: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readyDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#dbe4f0' },
  readyDotOn: { backgroundColor: palette.green },
  readyLabel: { color: palette.ink, fontWeight: '900' },
  readyValue: { color: palette.muted, marginTop: 2 },
});

import { StyleSheet, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>About DashBite</Text>
      <Text style={styles.subtitle}>Food delivery support demo powered by @mobileai/react-native.</Text>

      <Text style={styles.heading}>What this app demonstrates</Text>
      <Text style={styles.body}>
        DashBite is a mock food-delivery marketplace used to show AI assisted support flows for real order
        pain points: late deliveries, missing items, wrong substitutions, and post-order escalations.
      </Text>

      <Text style={styles.heading}>Support behavior</Text>
      <Text style={styles.body}>
        The AI can navigate app screens, validate cart and order state, and open live support context with
        rich metadata before escalation.
      </Text>

      <Text style={styles.heading}>Offline and local mode</Text>
      <Text style={styles.body}>
        All menu, cart, and order data is mocked to keep the example deterministic and easy to test.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#6c757d', marginTop: 4, marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, color: '#475569' },
});

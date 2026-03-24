import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'GiftConfirmation'>;

export default function GiftConfirmationScreen({ route, navigation }: Props) {
  const { rewardName, recipientEmail } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Gift Card Sent!</Text>
      <Text style={styles.subtitle}>
        Your {rewardName} has been sent to {recipientEmail}. They'll receive it shortly.
      </Text>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>Gifts Sent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>500</Text>
          <Text style={styles.statLabel}>Points Used</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>150</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      <Pressable style={styles.homeButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.homeText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6c757d', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  statsCard: {
    flexDirection: 'row', width: '100%', padding: 16, borderRadius: 14,
    backgroundColor: '#fff', marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: 12, color: '#6c757d', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#e9ecef' },
  homeButton: {
    backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12,
    width: '100%', alignItems: 'center',
  },
  homeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

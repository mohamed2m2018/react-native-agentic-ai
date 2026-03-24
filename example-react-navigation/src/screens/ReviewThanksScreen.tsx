import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'ReviewThanks'>;

export default function ReviewThanksScreen({ route, navigation }: Props) {
  const { dishName } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Review Submitted!</Text>
      <Text style={styles.subtitle}>
        Thanks for reviewing {dishName}. Your feedback helps others decide.
      </Text>

      <View style={styles.rewardBanner}>
        <Text style={styles.rewardEmoji}>🎁</Text>
        <Text style={styles.rewardTitle}>You earned 50 loyalty points!</Text>
        <Text style={styles.rewardText}>Earn rewards by reviewing, referring friends, and more.</Text>
        <Pressable
          style={styles.rewardButton}
          onPress={() => navigation.navigate('LoyaltyProgram')}
        >
          <Text style={styles.rewardButtonText}>View Loyalty Program</Text>
        </Pressable>
      </View>

      <Pressable style={styles.backButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.backText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6c757d', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  rewardBanner: {
    width: '100%', padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(243,156,18,0.08)', borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.2)', alignItems: 'center', marginBottom: 20,
  },
  rewardEmoji: { fontSize: 32, marginBottom: 8 },
  rewardTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  rewardText: { fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 16 },
  rewardButton: { backgroundColor: '#F39C12', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  rewardButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backButton: {
    padding: 14, borderRadius: 10, borderWidth: 1,
    borderColor: '#e9ecef', width: '100%', alignItems: 'center',
  },
  backText: { fontSize: 15, color: '#6c757d', fontWeight: '600' },
});

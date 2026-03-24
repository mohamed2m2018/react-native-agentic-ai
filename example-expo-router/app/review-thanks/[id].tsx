import { StyleSheet, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';

export default function ReviewThanksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Review Submitted!</Text>
      <Text style={styles.subtitle}>
        Thank you for sharing your experience. Your review helps other shoppers make better decisions.
      </Text>

      <View style={styles.rewardBanner}>
        <Text style={styles.rewardEmoji}>🎁</Text>
        <Text style={styles.rewardTitle}>You earned 50 reward points!</Text>
        <Text style={styles.rewardText}>Reviewers get exclusive rewards. Manage your points and earn more.</Text>
        <Link href="/rewards" asChild>
          <Pressable style={styles.rewardButton}>
            <Text style={styles.rewardButtonText}>View Rewards Program</Text>
          </Pressable>
        </Link>
      </View>

      <Link href={`/item-reviews/${id}`} asChild>
        <Pressable style={styles.backButton}>
          <Text style={styles.backText}>Back to Reviews</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6c757d', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  rewardBanner: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(243,156,18,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.2)',
    alignItems: 'center',
    marginBottom: 20,
  },
  rewardEmoji: { fontSize: 32, marginBottom: 8 },
  rewardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  rewardText: { fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  rewardButton: {
    backgroundColor: '#F39C12',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rewardButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    width: '100%',
    alignItems: 'center',
  },
  backText: { fontSize: 15, color: '#6c757d', fontWeight: '600' },
});

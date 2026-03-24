import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'RedeemReward'>;

const REWARDS = [
  { id: 'free-dish', emoji: '🍕', name: 'Free Dish', cost: 200, description: 'Any dish on the menu' },
  { id: 'gift-card-5', emoji: '💳', name: '$5 Gift Card', cost: 100, description: 'Send to a friend' },
  { id: 'gift-card-10', emoji: '💳', name: '$10 Gift Card', cost: 180, description: 'Send to a friend' },
  { id: 'free-delivery', emoji: '🚚', name: 'Free Delivery', cost: 50, description: 'On your next order' },
];

export default function RedeemRewardScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Redeem Rewards</Text>
      <Text style={styles.subtitle}>You have 150 points. Choose a reward:</Text>

      {REWARDS.map(reward => (
        <Pressable
          key={reward.id}
          style={styles.rewardCard}
          onPress={() => navigation.navigate('GiftCard', {
            rewardName: reward.name,
            pointCost: reward.cost,
          })}
        >
          <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            <Text style={styles.rewardDesc}>{reward.description}</Text>
          </View>
          <View style={styles.costBadge}>
            <Text style={styles.costText}>{reward.cost} pts</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  header: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 20 },
  rewardCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14,
    backgroundColor: '#fff', marginBottom: 12, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  rewardEmoji: { fontSize: 32 },
  rewardName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  rewardDesc: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  costBadge: {
    backgroundColor: 'rgba(40,167,69,0.1)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8,
  },
  costText: { fontSize: 13, fontWeight: '700', color: '#28a745' },
});

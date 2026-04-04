import {
  View,
  Text,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'LoyaltyProgram'>;

export default function LoyaltyProgramScreen({ navigation }: Props) {
  const [loyaltyNotifs, setLoyaltyNotifs] = useState(false);
  const [weeklyDeals, setWeeklyDeals] = useState(false);
  const [milestoneAlerts, setMilestoneAlerts] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>Your Loyalty Points</Text>
        <Text style={styles.pointsValue}>150</Text>
        <Text style={styles.pointsSub}>
          50 points until your next free dish
        </Text>
      </View>

      <Text style={styles.sectionTitle}>How to Earn</Text>
      <View style={styles.earnCard}>
        <Text style={styles.earnRow}>📝 Write a review — 50 pts</Text>
        <Text style={styles.earnRow}>📸 Upload a food photo — 25 pts</Text>
        <Text style={styles.earnRow}>👥 Refer a friend — 100 pts</Text>
        <Text style={styles.earnRow}>🛒 Every $10 spent — 10 pts</Text>
      </View>

      <Text style={styles.sectionTitle}>Loyalty Notifications</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>New Reward Opportunities</Text>
        <Switch value={loyaltyNotifs} onValueChange={setLoyaltyNotifs} />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Weekly Exclusive Deals</Text>
        <Switch value={weeklyDeals} onValueChange={setWeeklyDeals} />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Milestone Alerts</Text>
        <Switch value={milestoneAlerts} onValueChange={setMilestoneAlerts} />
      </View>

      <Pressable
        style={styles.redeemButton}
        onPress={() => navigation.navigate('RedeemReward')}
      >
        <Text style={styles.redeemEmoji}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.redeemTitle}>Redeem Rewards</Text>
          <Text style={styles.redeemSub}>
            Use your points for free dishes & gift cards
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <Pressable
        style={styles.activityButton}
        onPress={() =>
          navigation
            .getParent()
            ?.navigate('Profile', { screen: 'LoyaltyActivity' } as never)
        }
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.redeemTitle}>View Loyalty Activity</Text>
          <Text style={styles.redeemSub}>
            Inspect posted, pending, and missing point records
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  pointsCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(40,167,69,0.08)',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(40,167,69,0.15)',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 4,
  },
  pointsValue: { fontSize: 48, fontWeight: 'bold', color: '#28a745' },
  pointsSub: { fontSize: 13, color: '#6c757d', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
    marginTop: 8,
  },
  earnCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  earnRow: { fontSize: 15, lineHeight: 20, color: '#1a1a2e' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  settingLabel: { fontSize: 16, color: '#1a1a2e' },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    marginTop: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  activityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    marginTop: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  redeemEmoji: { fontSize: 32 },
  redeemTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  redeemSub: { fontSize: 13, color: '#6c757d' },
  arrow: { fontSize: 24, color: '#adb5bd' },
});

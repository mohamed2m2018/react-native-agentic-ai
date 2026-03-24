import { StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useState } from 'react';

export default function RewardsScreen() {
  const [rewardNotifs, setRewardNotifs] = useState(false);
  const [weeklyDeals, setWeeklyDeals] = useState(false);
  const [milestoneAlerts, setMilestoneAlerts] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Your Reward Points</Text>
          <Text style={styles.pointsValue}>150</Text>
          <Text style={styles.pointsSub}>50 points until your next $5 discount</Text>
        </View>

        <Text style={styles.sectionTitle}>How to Earn</Text>
        <View style={styles.earnCard}>
          <Text style={styles.earnRow}>📝 Write a review — 50 points</Text>
          <Text style={styles.earnRow}>📸 Upload a photo — 25 points</Text>
          <Text style={styles.earnRow}>❓ Answer a question — 15 points</Text>
          <Text style={styles.earnRow}>👥 Refer a friend — 100 points</Text>
        </View>

        <Text style={styles.sectionTitle}>Reward Notifications</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>New Reward Opportunities</Text>
          <Switch value={rewardNotifs} onValueChange={setRewardNotifs} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Weekly Exclusive Deals</Text>
          <Switch value={weeklyDeals} onValueChange={setWeeklyDeals} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Milestone Alerts</Text>
          <Switch value={milestoneAlerts} onValueChange={setMilestoneAlerts} />
        </View>

        <Link href="/invite-friends" asChild>
          <Pressable style={styles.inviteButton}>
            <Text style={styles.inviteEmoji}>👥</Text>
            <View>
              <Text style={styles.inviteTitle}>Invite Friends</Text>
              <Text style={styles.inviteSubtitle}>Earn 100 points per referral</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  pointsCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(39,174,96,0.08)',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.15)',
  },
  pointsLabel: { fontSize: 14, color: '#27AE60', fontWeight: '600', marginBottom: 4 },
  pointsValue: { fontSize: 48, fontWeight: 'bold', color: '#27AE60' },
  pointsSub: { fontSize: 13, color: '#6c757d', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  earnCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.06)',
    gap: 10,
    marginBottom: 24,
  },
  earnRow: { fontSize: 15, lineHeight: 20 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  settingLabel: { fontSize: 16, flex: 1 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(52,152,219,0.08)',
    marginTop: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.15)',
  },
  inviteEmoji: { fontSize: 32 },
  inviteTitle: { fontSize: 16, fontWeight: '700' },
  inviteSubtitle: { fontSize: 13, color: '#6c757d' },
  arrow: { fontSize: 24, color: '#6c757d', marginLeft: 'auto' },
});

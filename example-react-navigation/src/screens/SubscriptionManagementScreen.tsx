import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';
import { fetchSubscriptions, type SubscriptionRecord } from '../supportData';
import { SubscriptionSectionCard } from '../components/subscriptions/SubscriptionSectionCard';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'SubscriptionManagement'
>;

export default function SubscriptionManagementScreen({ navigation }: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions().then((nextSubscriptions) => {
      setSubscriptions(nextSubscriptions);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading subscription workspace...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Subscription command center</Text>
        <Text style={styles.title}>Deep billing, renewal, and rescue flows</Text>
        <Text style={styles.subtitle}>
          This workspace is intentionally layered so the AI has to navigate nested
          controls, settings, dialogs, and long forms instead of a flat shortcut.
        </Text>
      </View>

      <SubscriptionSectionCard
        title="Escalation-sensitive checkpoints"
        subtitle="These cards create long vertical scroll paths and force the agent to inspect state before acting."
      >
        <View style={styles.signalRow}>
          <View style={styles.signalCard}>
            <Text style={styles.signalValue}>2</Text>
            <Text style={styles.signalLabel}>Plans needing review</Text>
          </View>
          <View style={styles.signalCard}>
            <Text style={styles.signalValue}>3</Text>
            <Text style={styles.signalLabel}>Pending changes</Text>
          </View>
          <View style={styles.signalCard}>
            <Text style={styles.signalValue}>14d</Text>
            <Text style={styles.signalLabel}>Longest grace window</Text>
          </View>
        </View>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Active plan workspaces"
        subtitle="Open a workspace to reach advanced controls, pause scheduling, billing-anchor selection, and cancellation review."
      >
        {subscriptions.map((subscription) => (
          <Pressable
            key={subscription.id}
            style={styles.planCard}
            onPress={() =>
              navigation.navigate('SubscriptionWorkspace', {
                subscriptionId: subscription.id,
              })
            }
          >
            <View style={styles.planTopRow}>
              <Text style={styles.planTitle}>{subscription.planName}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{subscription.status}</Text>
              </View>
            </View>
            <Text style={styles.planMeta}>
              {subscription.id} · Renews {subscription.nextRenewalAt}
            </Text>
            <Text style={styles.planIssue}>{subscription.issueHeadline}</Text>
            <Text style={styles.planSummary}>{subscription.issueSummary}</Text>
            <View style={styles.planFooter}>
              <Text style={styles.planPrice}>${subscription.monthlyPrice.toFixed(2)}/mo</Text>
              <Text style={styles.planAction}>Open workspace ›</Text>
            </View>
          </Pressable>
        ))}
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="What this flow contains"
        subtitle="Everything below is reachable by taps only, with no hidden shortcuts."
      >
        {[
          'Nested workspace > controls > pause/cancel journeys',
          'Dialog-driven billing anchor and backup payment selectors',
          'Long forms with switches, chips, steppers, and text inputs',
          'A custom date-picker dialog for scheduling a pause window',
          'Final confirmation dialogs before high-impact subscription actions',
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </SubscriptionSectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 20, paddingBottom: 72 },
  hero: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#c8cbff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    lineHeight: 21,
  },
  signalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  signalCard: {
    flex: 1,
    backgroundColor: '#f5f7ff',
    borderRadius: 16,
    padding: 14,
  },
  signalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  signalLabel: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#6c757d',
  },
  planCard: {
    backgroundColor: '#f8f9fc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eceef6',
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  planTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  badge: {
    backgroundColor: '#e9edff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#4253c7',
    fontSize: 11,
    fontWeight: '700',
  },
  planMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#8a8fa3',
  },
  planIssue: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  planSummary: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#5f6678',
  },
  planFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planPrice: {
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: '700',
  },
  planAction: {
    color: '#4253c7',
    fontSize: 13,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: '#4253c7',
    fontSize: 16,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    color: '#4b5263',
    fontSize: 13,
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f7fb',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

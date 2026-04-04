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
import { fetchSubscription, type DetailedSubscriptionRecord } from '../supportData';
import { SubscriptionSectionCard } from '../components/subscriptions/SubscriptionSectionCard';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'SubscriptionWorkspace'
>;

export default function SubscriptionWorkspaceScreen({ navigation, route }: Props) {
  const [subscription, setSubscription] = useState<DetailedSubscriptionRecord | undefined>();

  useEffect(() => {
    void fetchSubscription(route.params.subscriptionId).then(setSubscription);
  }, [route.params.subscriptionId]);

  if (!subscription) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Opening subscription workspace...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>{subscription.planTier}</Text>
        <Text style={styles.title}>{subscription.planName}</Text>
        <Text style={styles.subtitle}>
          Billing anchor {subscription.billingAnchor} · Manager {subscription.managerEmail}
        </Text>
      </View>

      <SubscriptionSectionCard
        title="Current state"
        subtitle="These values update after actions in deeper screens."
      >
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{subscription.workspaceSeats}</Text>
            <Text style={styles.metricLabel}>Workspace seats</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{subscription.deliveryBoostsRemaining}</Text>
            <Text style={styles.metricLabel}>Delivery boosts</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{subscription.monthlyUsageCap}</Text>
            <Text style={styles.metricLabel}>Usage cap</Text>
          </View>
        </View>
        <Text style={styles.summaryLabel}>Pending changes</Text>
        {subscription.pendingChanges.map((entry) => (
          <Text key={entry} style={styles.summaryText}>
            • {entry}
          </Text>
        ))}
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Action tunnels"
        subtitle="Each tunnel contains nested controls, scrolling sections, and confirmation points."
      >
        <Pressable
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('SubscriptionControls', {
              subscriptionId: subscription.id,
            })
          }
        >
          <Text style={styles.actionTitle}>Control room</Text>
          <Text style={styles.actionText}>
            Workspace limits, billing anchor selector, fallback payment dialog,
            smart retry toggles, and credit handling rules.
          </Text>
          <Text style={styles.actionLink}>Open controls ›</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('SubscriptionPause', {
              subscriptionId: subscription.id,
            })
          }
        >
          <Text style={styles.actionTitle}>Pause planner</Text>
          <Text style={styles.actionText}>
            Custom date picker, seat freeze controls, invoice handling, and a
            review dialog before scheduling.
          </Text>
          <Text style={styles.actionLink}>Plan a pause ›</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('SubscriptionCancellation', {
              subscriptionId: subscription.id,
            })
          }
        >
          <Text style={styles.actionTitle}>Cancellation review</Text>
          <Text style={styles.actionText}>
            Multi-part retention form, credits disposition, dialog confirmation,
            and loss-of-benefits acknowledgement.
          </Text>
          <Text style={styles.actionLink}>Open cancellation flow ›</Text>
        </Pressable>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Included benefits"
        subtitle={`Risk level: ${subscription.cancellationRisk.toUpperCase()} · Grace period ends ${subscription.gracePeriodEndsAt}`}
      >
        {subscription.benefits.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <Text style={styles.benefitDot}>•</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
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
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  kicker: {
    color: '#6d74c9',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#6c757d',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#f4f6ff',
    borderRadius: 16,
    padding: 14,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6c757d',
  },
  summaryLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5f6678',
  },
  actionCard: {
    backgroundColor: '#f8f9fc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eceef6',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  actionText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: '#5f6678',
  },
  actionLink: {
    marginTop: 10,
    color: '#4253c7',
    fontSize: 13,
    fontWeight: '700',
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  benefitDot: {
    color: '#4253c7',
    fontSize: 16,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5263',
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

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../App';
import {
  fetchSubscription,
  submitSubscriptionCancellation,
  type DetailedSubscriptionRecord,
} from '../supportData';
import { SubscriptionDialog } from '../components/subscriptions/SubscriptionDialog';
import { SubscriptionOptionChip } from '../components/subscriptions/SubscriptionOptionChip';
import { SubscriptionSectionCard } from '../components/subscriptions/SubscriptionSectionCard';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'SubscriptionCancellation'
>;

const REASONS = [
  'Unexpected renewal',
  'Too expensive',
  'Moving to competitor',
  'Features not used enough',
];

const CONTACT_PREFS = ['Email review', 'Phone callback', 'No retention outreach'];
const CREDIT_OPTIONS = [
  'Apply remaining credits before closing',
  'Move credits to team wallet',
  'Forfeit remaining credits',
];

export default function SubscriptionCancellationScreen({ route }: Props) {
  const [subscription, setSubscription] = useState<DetailedSubscriptionRecord | undefined>();
  const [reason, setReason] = useState(REASONS[0]);
  const [contactPreference, setContactPreference] = useState(CONTACT_PREFS[0]);
  const [creditDisposition, setCreditDisposition] = useState(CREDIT_OPTIONS[0]);
  const [detail, setDetail] = useState('');
  const [acknowledgedLossOfBenefits, setAcknowledgedLossOfBenefits] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');

  useEffect(() => {
    void fetchSubscription(route.params.subscriptionId).then(setSubscription);
  }, [route.params.subscriptionId]);

  const handleSubmit = async () => {
    if (!subscription || !acknowledgedLossOfBenefits) return;
    setSaving(true);
    const updated = await submitSubscriptionCancellation(subscription.id, {
      reason,
      detail,
      contactPreference,
      creditDisposition,
      acknowledgedLossOfBenefits,
    });
    setSubscription(updated);
    setSaving(false);
    setShowConfirmDialog(false);
    setSaveState('Cancellation review created. The workspace now shows a pending cancellation state.');
  };

  if (!subscription) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading cancellation review…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Cancellation review</Text>
        <Text style={styles.heroSubtitle}>
          This is the deepest branch in the flow. It combines chips, text entry,
          toggles, and a final confirmation dialog before changing the subscription state.
        </Text>
      </View>

      <SubscriptionSectionCard
        title="Why is this subscription being cancelled?"
        subtitle="Choose the headline reason first."
      >
        <View style={styles.chipWrap}>
          {REASONS.map((item) => (
            <SubscriptionOptionChip
              key={item}
              label={item}
              selected={reason === item}
              onPress={() => setReason(item)}
            />
          ))}
        </View>
        <Text style={styles.label}>Additional context</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={detail}
          onChangeText={setDetail}
          placeholder="Add any notes about refund timing, accidental renewal, account state, or support promises."
          multiline
        />
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Retention and credit routing"
        subtitle="These selections determine how support follows up and what happens to remaining credits."
      >
        <Text style={styles.label}>Contact preference</Text>
        <View style={styles.chipWrap}>
          {CONTACT_PREFS.map((item) => (
            <SubscriptionOptionChip
              key={item}
              label={item}
              selected={contactPreference === item}
              onPress={() => setContactPreference(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>Credits disposition</Text>
        <View style={styles.chipWrap}>
          {CREDIT_OPTIONS.map((item) => (
            <SubscriptionOptionChip
              key={item}
              label={item}
              selected={creditDisposition === item}
              onPress={() => setCreditDisposition(item)}
            />
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>I understand benefits end after cancellation review</Text>
            <Text style={styles.switchHelp}>
              This acknowledges the loss of delivery boosts, support priority, and rollover pricing.
            </Text>
          </View>
          <Switch
            value={acknowledgedLossOfBenefits}
            onValueChange={setAcknowledgedLossOfBenefits}
          />
        </View>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="What support will see"
        subtitle="This intentionally sits lower in the form to require additional downward scrolling."
      >
        <Text style={styles.summaryText}>Plan: {subscription.planName}</Text>
        <Text style={styles.summaryText}>Current state: {subscription.cancelState}</Text>
        <Text style={styles.summaryText}>Grace period ends: {subscription.gracePeriodEndsAt}</Text>
        <Text style={styles.summaryText}>Risk level: {subscription.cancellationRisk.toUpperCase()}</Text>
      </SubscriptionSectionCard>

      {!!saveState && <Text style={styles.saveState}>{saveState}</Text>}

      <Pressable
        style={[
          styles.reviewButton,
          (!acknowledgedLossOfBenefits || saving) && styles.reviewButtonDisabled,
        ]}
        onPress={() => setShowConfirmDialog(true)}
        disabled={!acknowledgedLossOfBenefits || saving}
      >
        <Text style={styles.reviewButtonText}>Review cancellation request</Text>
      </Pressable>

      <SubscriptionDialog
        visible={showConfirmDialog}
        title="Final cancellation confirmation"
        subtitle="The app asks for one last explicit confirmation before opening cancellation review."
        onClose={() => setShowConfirmDialog(false)}
      >
        <Text style={styles.reviewLine}>Reason: {reason}</Text>
        <Text style={styles.reviewLine}>Contact: {contactPreference}</Text>
        <Text style={styles.reviewLine}>Credits: {creditDisposition}</Text>
        <Text style={styles.reviewLine}>
          Benefits acknowledged: {acknowledgedLossOfBenefits ? 'Yes' : 'No'}
        </Text>
        <Pressable
          style={[styles.confirmButton, saving && styles.reviewButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.confirmButtonText}>
            {saving ? 'Submitting…' : 'Submit cancellation review'}
          </Text>
        </Pressable>
      </SubscriptionDialog>
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
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#6c757d',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  input: {
    backgroundColor: '#f5f6fb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  switchHelp: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#6c757d',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4e5566',
  },
  saveState: {
    marginBottom: 12,
    color: '#2f8f5b',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewButton: {
    backgroundColor: '#a52d37',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reviewButtonDisabled: {
    opacity: 0.45,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1a1a2e',
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: '#a52d37',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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

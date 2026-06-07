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
  scheduleSubscriptionPause,
  type DetailedSubscriptionRecord,
} from '../supportData';
import { SubscriptionDialog } from '../components/subscriptions/SubscriptionDialog';
import { SubscriptionOptionChip } from '../components/subscriptions/SubscriptionOptionChip';
import { SubscriptionSectionCard } from '../components/subscriptions/SubscriptionSectionCard';
import { SubscriptionStepper } from '../components/subscriptions/SubscriptionStepper';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SubscriptionPause'>;

const DATE_OPTIONS = [
  'Apr 12, 2026',
  'Apr 18, 2026',
  'Apr 25, 2026',
  'May 3, 2026',
  'May 10, 2026',
];

const REASONS = [
  'Seasonal travel',
  'Budget reset',
  'Too many unused boosts',
  'Need a billing break',
];

export default function SubscriptionPauseScreen({ route }: Props) {
  const [subscription, setSubscription] = useState<DetailedSubscriptionRecord | undefined>();
  const [startDate, setStartDate] = useState(DATE_OPTIONS[0]);
  const [endDate, setEndDate] = useState(DATE_OPTIONS[2]);
  const [reason, setReason] = useState(REASONS[0]);
  const [seatFreezeCount, setSeatFreezeCount] = useState(2);
  const [keepManagerAlerts, setKeepManagerAlerts] = useState(true);
  const [preservePromoPricing, setPreservePromoPricing] = useState(true);
  const [pauseInvoices, setPauseInvoices] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchSubscription(route.params.subscriptionId).then((next) => {
      setSubscription(next);
      if (!next) return;
      setStartDate(next.pauseScheduledFor || DATE_OPTIONS[0]);
      setEndDate(next.pauseResumeOn || DATE_OPTIONS[2]);
    });
  }, [route.params.subscriptionId]);

  const handleSchedule = async () => {
    if (!subscription) return;
    setSaving(true);
    const updated = await scheduleSubscriptionPause(subscription.id, {
      startDate,
      endDate,
      reason,
      seatFreezeCount,
      keepManagerAlerts,
      preservePromoPricing,
      pauseInvoices,
      internalNote,
    });
    setSubscription(updated);
    setSaving(false);
    setShowReviewDialog(false);
    setSaveState(`Pause scheduled from ${startDate} until ${endDate}.`);
  };

  if (!subscription) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading pause planner…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Pause planner</Text>
        <Text style={styles.heroSubtitle}>
          Pick a custom date window, choose how many seats to freeze, and review
          the full pause plan before it is scheduled.
        </Text>
      </View>

      <SubscriptionSectionCard
        title="Pause window"
        subtitle="Open each selector to use the custom date-picker dialog."
      >
        <Pressable style={styles.selectorRow} onPress={() => setPickerTarget('start')}>
          <View>
            <Text style={styles.selectorLabel}>Pause starts</Text>
            <Text style={styles.selectorValue}>{startDate}</Text>
          </View>
          <Text style={styles.selectorAction}>Pick date ›</Text>
        </Pressable>
        <Pressable style={styles.selectorRow} onPress={() => setPickerTarget('end')}>
          <View>
            <Text style={styles.selectorLabel}>Resume on</Text>
            <Text style={styles.selectorValue}>{endDate}</Text>
          </View>
          <Text style={styles.selectorAction}>Pick date ›</Text>
        </Pressable>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Pause shape"
        subtitle="This section is intentionally long so the user has to scroll downward through multiple control types."
      >
        <Text style={styles.label}>Pause reason</Text>
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

        <SubscriptionStepper
          label="Seats to freeze during pause"
          value={seatFreezeCount}
          min={0}
          max={subscription.workspaceSeats}
          onChange={setSeatFreezeCount}
        />

        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Keep manager alerts on</Text>
            <Text style={styles.switchHelp}>
              Retain renewal and retention notices even while the workspace is paused.
            </Text>
          </View>
          <Switch value={keepManagerAlerts} onValueChange={setKeepManagerAlerts} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Preserve promo pricing</Text>
            <Text style={styles.switchHelp}>
              Attempt to resume on the current promo rate instead of recalculating at market price.
            </Text>
          </View>
          <Switch value={preservePromoPricing} onValueChange={setPreservePromoPricing} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Pause invoice generation</Text>
            <Text style={styles.switchHelp}>
              Hold monthly invoice creation entirely during the pause period.
            </Text>
          </View>
          <Switch value={pauseInvoices} onValueChange={setPauseInvoices} />
        </View>

        <Text style={styles.label}>Internal note</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={internalNote}
          onChangeText={setInternalNote}
          placeholder="Explain why this pause exists or what support should watch for on resume."
          multiline
        />
      </SubscriptionSectionCard>

      {!!saveState && <Text style={styles.saveState}>{saveState}</Text>}

      <Pressable style={styles.reviewButton} onPress={() => setShowReviewDialog(true)}>
        <Text style={styles.reviewButtonText}>Review pause plan</Text>
      </Pressable>

      <SubscriptionDialog
        visible={pickerTarget !== null}
        title={pickerTarget === 'start' ? 'Choose pause start' : 'Choose resume date'}
        subtitle="These date options are intentionally inside a modal to add another interaction layer."
        onClose={() => setPickerTarget(null)}
      >
        {DATE_OPTIONS.map((option) => (
          <SubscriptionOptionChip
            key={option}
            label={option}
            selected={pickerTarget === 'start' ? startDate === option : endDate === option}
            onPress={() => {
              if (pickerTarget === 'start') {
                setStartDate(option);
              } else {
                setEndDate(option);
              }
              setPickerTarget(null);
            }}
          />
        ))}
      </SubscriptionDialog>

      <SubscriptionDialog
        visible={showReviewDialog}
        title="Review pause request"
        subtitle="High-impact actions require a final review dialog."
        onClose={() => setShowReviewDialog(false)}
      >
        <Text style={styles.reviewLine}>Pause window: {startDate} → {endDate}</Text>
        <Text style={styles.reviewLine}>Reason: {reason}</Text>
        <Text style={styles.reviewLine}>Seats frozen: {seatFreezeCount}</Text>
        <Text style={styles.reviewLine}>
          Invoice handling: {pauseInvoices ? 'Hold invoices' : 'Continue invoices'}
        </Text>
        <Text style={styles.reviewLine}>
          Promo pricing: {preservePromoPricing ? 'Preserve current rate' : 'Recalculate on resume'}
        </Text>
        <Pressable
          style={[styles.confirmButton, saving && styles.reviewButtonDisabled]}
          onPress={handleSchedule}
          disabled={saving}
        >
          <Text style={styles.confirmButtonText}>
            {saving ? 'Scheduling…' : 'Schedule pause'}
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
  selectorRow: {
    borderRadius: 16,
    backgroundColor: '#f5f6fb',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#7b8192',
  },
  selectorValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  selectorAction: {
    color: '#4253c7',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  input: {
    backgroundColor: '#f5f6fb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  saveState: {
    marginBottom: 12,
    color: '#2f8f5b',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reviewButtonDisabled: {
    opacity: 0.5,
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
    backgroundColor: '#1a1a2e',
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

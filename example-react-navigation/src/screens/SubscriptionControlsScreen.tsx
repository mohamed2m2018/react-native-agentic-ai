import { useEffect, useMemo, useState } from 'react';
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
  updateSubscriptionControls,
  type DetailedSubscriptionRecord,
} from '../supportData';
import { SubscriptionDialog } from '../components/subscriptions/SubscriptionDialog';
import { SubscriptionOptionChip } from '../components/subscriptions/SubscriptionOptionChip';
import { SubscriptionSectionCard } from '../components/subscriptions/SubscriptionSectionCard';
import { SubscriptionStepper } from '../components/subscriptions/SubscriptionStepper';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'SubscriptionControls'
>;

const BILLING_ANCHORS = [
  '1st of each month · 8:00 AM',
  '15th of each month · 9:30 AM',
  '28th of each month · 11:45 AM',
  '30th of each month · 9:02 AM',
];

const BACKUP_METHODS = [
  'PayPal Backup Wallet',
  'Visa •••• 1192',
  'Corporate invoice fallback',
  'No backup payment set',
];

export default function SubscriptionControlsScreen({ navigation, route }: Props) {
  const [subscription, setSubscription] = useState<DetailedSubscriptionRecord | undefined>();
  const [managerEmail, setManagerEmail] = useState('');
  const [workspaceSeats, setWorkspaceSeats] = useState(0);
  const [monthlyUsageCap, setMonthlyUsageCap] = useState(0);
  const [smartRetryEnabled, setSmartRetryEnabled] = useState(false);
  const [invoiceConsolidationEnabled, setInvoiceConsolidationEnabled] = useState(false);
  const [autoApplyCredits, setAutoApplyCredits] = useState(false);
  const [billingAnchor, setBillingAnchor] = useState('');
  const [backupPaymentLabel, setBackupPaymentLabel] = useState('');
  const [showAnchorDialog, setShowAnchorDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');

  useEffect(() => {
    void fetchSubscription(route.params.subscriptionId).then((next) => {
      setSubscription(next);
      if (!next) return;
      setManagerEmail(next.managerEmail);
      setWorkspaceSeats(next.workspaceSeats);
      setMonthlyUsageCap(next.monthlyUsageCap);
      setSmartRetryEnabled(next.smartRetryEnabled);
      setInvoiceConsolidationEnabled(next.invoiceConsolidationEnabled);
      setAutoApplyCredits(next.autoApplyCredits);
      setBillingAnchor(next.billingAnchor);
      setBackupPaymentLabel(next.backupPaymentLabel);
    });
  }, [route.params.subscriptionId]);

  const dirty = useMemo(() => {
    if (!subscription) return false;
    return (
      managerEmail !== subscription.managerEmail ||
      workspaceSeats !== subscription.workspaceSeats ||
      monthlyUsageCap !== subscription.monthlyUsageCap ||
      smartRetryEnabled !== subscription.smartRetryEnabled ||
      invoiceConsolidationEnabled !== subscription.invoiceConsolidationEnabled ||
      autoApplyCredits !== subscription.autoApplyCredits ||
      billingAnchor !== subscription.billingAnchor ||
      backupPaymentLabel !== subscription.backupPaymentLabel
    );
  }, [
    autoApplyCredits,
    backupPaymentLabel,
    billingAnchor,
    invoiceConsolidationEnabled,
    managerEmail,
    monthlyUsageCap,
    smartRetryEnabled,
    subscription,
    workspaceSeats,
  ]);

  const handleSave = async () => {
    if (!subscription || !dirty) return;
    setSaving(true);
    setSaveState('');
    const updated = await updateSubscriptionControls(subscription.id, {
      managerEmail,
      workspaceSeats,
      monthlyUsageCap,
      smartRetryEnabled,
      invoiceConsolidationEnabled,
      autoApplyCredits,
      billingAnchor,
      backupPaymentLabel,
    });
    setSubscription(updated);
    setSaving(false);
    setSaveState('Controls saved. Workspace state updated below.');
  };

  if (!subscription) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading control room…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Nested control room</Text>
        <Text style={styles.heroTitle}>Subscription controls</Text>
        <Text style={styles.heroSubtitle}>
          Change billing anchor, fallback payment behavior, workspace limits,
          and automation safeguards before going deeper into pause or cancellation.
        </Text>
      </View>

      <SubscriptionSectionCard
        title="Owner and billing routing"
        subtitle="These fields intentionally live high in the screen so the rest of the flow requires further scrolling."
      >
        <Text style={styles.label}>Manager email</Text>
        <TextInput
          style={styles.input}
          value={managerEmail}
          onChangeText={setManagerEmail}
          placeholder="owner@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable style={styles.selectorRow} onPress={() => setShowAnchorDialog(true)}>
          <View>
            <Text style={styles.selectorLabel}>Billing anchor</Text>
            <Text style={styles.selectorValue}>{billingAnchor}</Text>
          </View>
          <Text style={styles.selectorAction}>Choose ›</Text>
        </Pressable>

        <Pressable style={styles.selectorRow} onPress={() => setShowBackupDialog(true)}>
          <View>
            <Text style={styles.selectorLabel}>Backup payment method</Text>
            <Text style={styles.selectorValue}>{backupPaymentLabel}</Text>
          </View>
          <Text style={styles.selectorAction}>Edit ›</Text>
        </Pressable>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Workspace limits"
        subtitle="Use the steppers to adjust values without leaving this screen."
      >
        <SubscriptionStepper
          label="Seat cap"
          value={workspaceSeats}
          min={1}
          max={25}
          onChange={setWorkspaceSeats}
        />
        <SubscriptionStepper
          label="Monthly usage cap"
          value={monthlyUsageCap}
          min={200}
          max={5000}
          onChange={setMonthlyUsageCap}
        />
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Safeguards and credits"
        subtitle="Toggles below intentionally create a long mid-screen area the user must scroll through."
      >
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Smart retry</Text>
            <Text style={styles.switchHelp}>
              Retry failed renewals on multiple intervals before the plan downgrades.
            </Text>
          </View>
          <Switch value={smartRetryEnabled} onValueChange={setSmartRetryEnabled} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Consolidated invoices</Text>
            <Text style={styles.switchHelp}>
              Roll seat adjustments and delivery boosts into a single monthly invoice.
            </Text>
          </View>
          <Switch
            value={invoiceConsolidationEnabled}
            onValueChange={setInvoiceConsolidationEnabled}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchLabel}>Auto-apply credits</Text>
            <Text style={styles.switchHelp}>
              Automatically consume earned credits before charging the payment method on file.
            </Text>
          </View>
          <Switch value={autoApplyCredits} onValueChange={setAutoApplyCredits} />
        </View>
      </SubscriptionSectionCard>

      <SubscriptionSectionCard
        title="Go deeper"
        subtitle="These actions push into even deeper nested flows."
      >
        <Pressable
          style={styles.deepAction}
          onPress={() =>
            navigation.navigate('SubscriptionPause', { subscriptionId: subscription.id })
          }
        >
          <Text style={styles.deepActionTitle}>Open pause planner</Text>
          <Text style={styles.deepActionText}>
            Choose a date window, freeze seats, and review the pause plan in a dialog.
          </Text>
        </Pressable>
        <Pressable
          style={styles.deepAction}
          onPress={() =>
            navigation.navigate('SubscriptionCancellation', {
              subscriptionId: subscription.id,
            })
          }
        >
          <Text style={styles.deepActionTitle}>Open cancellation review</Text>
          <Text style={styles.deepActionText}>
            Go through retention decisions, refund routing, and a final confirmation gate.
          </Text>
        </Pressable>
      </SubscriptionSectionCard>

      {!!saveState && <Text style={styles.saveState}>{saveState}</Text>}

      <Pressable
        style={[styles.saveButton, (!dirty || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!dirty || saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving controls…' : 'Save control changes'}
        </Text>
      </Pressable>

      <SubscriptionDialog
        visible={showAnchorDialog}
        title="Choose billing anchor"
        subtitle="Changing this date affects the next full renewal cycle."
        onClose={() => setShowAnchorDialog(false)}
      >
        {BILLING_ANCHORS.map((anchor) => (
          <SubscriptionOptionChip
            key={anchor}
            label={anchor}
            selected={billingAnchor === anchor}
            onPress={() => {
              setBillingAnchor(anchor);
              setShowAnchorDialog(false);
            }}
          />
        ))}
      </SubscriptionDialog>

      <SubscriptionDialog
        visible={showBackupDialog}
        title="Fallback payment path"
        subtitle="This dialog forces the agent to select among multiple backup payment policies."
        onClose={() => setShowBackupDialog(false)}
      >
        {BACKUP_METHODS.map((method) => (
          <SubscriptionOptionChip
            key={method}
            label={method}
            selected={backupPaymentLabel === method}
            onPress={() => {
              setBackupPaymentLabel(method);
              setShowBackupDialog(false);
            }}
          />
        ))}
      </SubscriptionDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 20, paddingBottom: 72 },
  hero: {
    backgroundColor: '#1a1a2e',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: '#c8cbff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
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
  deepAction: {
    backgroundColor: '#f7f8fd',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ebedf8',
  },
  deepActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  deepActionText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#606779',
  },
  saveState: {
    marginBottom: 12,
    color: '#2f8f5b',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
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

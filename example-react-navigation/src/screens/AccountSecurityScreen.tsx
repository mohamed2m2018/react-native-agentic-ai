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
import {
  fetchAccountSecurity,
  fetchNotificationAudit,
  type AccountSecurityRecord,
  type NotificationAudit,
} from '../supportData';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSecurity'>;

export default function AccountSecurityScreen({ navigation }: Props) {
  const [security, setSecurity] = useState<AccountSecurityRecord | null>(null);
  const [notifications, setNotifications] = useState<NotificationAudit | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAccountSecurity(), fetchNotificationAudit()]).then(
      ([nextSecurity, nextNotifications]) => {
        setSecurity(nextSecurity);
        setNotifications(nextNotifications);
        setLoading(false);
      }
    );
  }, []);

  if (loading || !security || !notifications) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text style={styles.loadingText}>Loading account security...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Account access</Text>
        <Text style={styles.summary}>
          Review recent sign-in, reset, and two-factor activity.
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Password reset:</Text>{' '}
          {security.passwordResetStatus}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>2FA:</Text> {security.twoFactorState}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Trusted device:</Text>{' '}
          {security.rememberedDevice}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Lock reason:</Text> {security.lockReason}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Last failed login:</Text>{' '}
          {security.lastFailedLoginAt}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Marketing notifications</Text>
        <Text style={styles.summary}>
          Review SMS marketing preferences and recent campaign delivery.
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Top-level SMS promos:</Text>{' '}
          {notifications.topLevelSmsPromos ? 'On' : 'Off'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Channel-level SMS promos:</Text>{' '}
          {notifications.channelLevelSmsPromos ? 'On' : 'Off'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Last marketing text:</Text>{' '}
          {notifications.lastMarketingTextAt}
        </Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('ProfileNotificationPrefs')}
      >
        <Text style={styles.buttonText}>Open Notification Preferences</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  summary: { fontSize: 14, lineHeight: 20, color: '#495057' },
  row: { fontSize: 14, lineHeight: 20, color: '#1a1a2e' },
  label: { fontWeight: '700' },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  loadingText: { color: '#6c757d', fontSize: 15 },
});

import { StyleSheet, Pressable, TextInput, Share } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useState } from 'react';

const REFERRAL_CODE = 'FRIEND2024';

export default function InviteFriendsScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on ShopApp! Use my referral code ${REFERRAL_CODE} to get $10 off your first order. Download: https://example.com/app`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Invite Friends</Text>
        <Text style={styles.subtitle}>Share your referral code and earn 100 points for each friend who joins</Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <Text style={styles.code}>{REFERRAL_CODE}</Text>
          <Pressable style={styles.copyButton}>
            <Text style={styles.copyText}>Copy Code</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Send Invite via Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Friend's email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.sendButton, !email && styles.sendDisabled]}
          onPress={() => { if (email) { setSent(true); setEmail(''); } }}
        >
          <Text style={styles.sendText}>{sent ? '✓ Invite Sent!' : 'Send Invite'}</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareText}>📤 Share via Other Apps</Text>
        </Pressable>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Friends Invited</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>200</Text>
            <Text style={styles.statLabel}>Points Earned</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24, lineHeight: 20 },
  codeCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(52,152,219,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.15)',
  },
  codeLabel: { fontSize: 13, color: '#6c757d', marginBottom: 8 },
  code: { fontSize: 32, fontWeight: 'bold', letterSpacing: 4, marginBottom: 12 },
  copyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3498DB',
  },
  copyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    backgroundColor: 'rgba(150,150,150,0.04)',
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#27AE60',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  shareButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignItems: 'center',
    marginTop: 12,
  },
  shareText: { fontSize: 15, fontWeight: '600' },
  statsCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.06)',
    marginTop: 24,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#6c757d', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(150,150,150,0.2)' },
});

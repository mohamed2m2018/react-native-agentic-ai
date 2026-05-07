import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AIZone } from 'react-native-agentic-ai';
import { Body, Card, Eyebrow, Page, StatusPill, Title } from '@/lib/ui';
import { palette, useFlightDemo } from '@/lib/flight-demo';

export default function PaymentScreen() {
  const router = useRouter();
  const { payment, updatePayment, sendPaymentChallenge, verifyPayment } = useFlightDemo();

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content}>
        <AIZone id="payment-verification-screen" allowHighlight>
          <Eyebrow>Secure checkout</Eyebrow>
          <Title>Payment</Title>
          <Body>Authorize your saved card to continue with ticketing.</Body>

          <Card>
            <Text style={styles.sectionTitle}>Saved card</Text>
            <Text style={styles.meta}>{payment.cardLabel}</Text>
            <Text style={styles.meta}>Billing ZIP {payment.billingZip}</Text>
            <StatusPill status={payment.verified ? 'ready' : payment.challengeSent ? 'warning' : 'idle'} label={payment.verified ? 'Authorized' : payment.challengeSent ? 'Verification pending' : 'Not verified'} />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Card verification</Text>
            <TextInput
              value={payment.otp}
              onChangeText={(otp) => updatePayment({ otp })}
              keyboardType="numeric"
              placeholder="Enter verification code"
              placeholderTextColor="#98a2b3"
              style={styles.input}
            />
            <Text style={styles.meta}>Check your banking app or SMS for the verification code.</Text>
          </Card>

          <Pressable style={styles.secondary} onPress={sendPaymentChallenge}>
            <Text style={styles.secondaryText}>Send Verification Code</Text>
          </Pressable>

          <Pressable
            style={styles.primary}
            onPress={() => {
              const result = verifyPayment();
              Alert.alert('Payment verification', result.message);
              if (result.success) router.push('/review');
            }}
          >
            <Text style={styles.primaryText}>Verify Payment</Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.push('/review')}>
            <Text style={styles.secondaryText}>Continue to Review</Text>
          </Pressable>
        </AIZone>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 32 },
  sectionTitle: { color: palette.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: palette.muted, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    color: palette.ink,
    backgroundColor: '#fff',
  },
  primary: { backgroundColor: palette.navy, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: palette.ink, fontWeight: '900' },
});

import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../App';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.successIcon}>📧</Text>
        <Text style={styles.successTitle}>Check Your Email</Text>
        <Text style={styles.successText}>We've sent a reset link to {email}</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.replace('Login')}>
          <Text style={styles.backText}>Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your email to receive a password reset link</Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Pressable
        style={[styles.submitButton, !email && styles.submitDisabled]}
        onPress={() => { if (email) setSent(true); }}
      >
        <Text style={styles.submitText}>Send Reset Link</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Back to Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6c757d', marginBottom: 32, lineHeight: 22 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  submitButton: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkText: { color: '#6c757d', fontSize: 15, textAlign: 'center', marginTop: 8 },
  successIcon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  successText: { fontSize: 16, color: '#6c757d', textAlign: 'center', marginBottom: 24 },
  backButton: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center' },
  backText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

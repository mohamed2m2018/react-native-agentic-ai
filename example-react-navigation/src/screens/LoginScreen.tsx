import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../App';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const result = login(email.trim(), password.trim());
    if (!result.success) {
      Alert.alert('Login Failed', result.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🍽️</Text>
      <Text style={styles.title}>FoodApp</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Pressable style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </Pressable>

        {/* Corner case: navigation.navigate() in auth flow */}
        <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgotLink}>Forgot Password?</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.signupLink}>
          Don't have an account? <Text style={styles.signupLinkBold}>Sign Up</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1a1a2e' },
  subtitle: { fontSize: 16, color: '#6c757d', marginBottom: 40 },
  form: { width: '100%', gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loginButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  signupLink: { color: '#6c757d', fontSize: 14, marginTop: 24 },
  signupLinkBold: { color: '#1a1a2e', fontWeight: '700' },
  forgotLink: { color: '#6c757d', fontSize: 14, textAlign: 'center', marginTop: 12 },
});

import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'GiftCard'>;

export default function GiftCardScreen({ route, navigation }: Props) {
  const { rewardName, pointCost } = route.params;
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Send Gift Card</Text>
      <Text style={styles.subtitle}>Redeeming: {rewardName} ({pointCost} points)</Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewEmoji}>🎁</Text>
        <Text style={styles.previewTitle}>{rewardName}</Text>
        <Text style={styles.previewText}>From FoodApp with ❤️</Text>
      </View>

      <Text style={styles.label}>Recipient Email</Text>
      <TextInput
        style={styles.input}
        placeholder="friend@email.com"
        value={recipientEmail}
        onChangeText={setRecipientEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Personal Message (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Add a personal note..."
        value={personalMessage}
        onChangeText={setPersonalMessage}
        multiline
      />

      <Pressable
        style={[styles.sendBtn, !recipientEmail && styles.sendDisabled]}
        onPress={() => navigation.navigate('GiftConfirmation', {
          rewardName,
          recipientEmail,
        })}
      >
        <Text style={styles.sendText}>Send Gift Card</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  header: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24 },
  previewCard: {
    padding: 24, borderRadius: 16, backgroundColor: 'rgba(52,152,219,0.06)',
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(52,152,219,0.15)', marginBottom: 24,
  },
  previewEmoji: { fontSize: 48, marginBottom: 8 },
  previewTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  previewText: { fontSize: 14, color: '#6c757d' },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef',
    borderRadius: 10, padding: 14, fontSize: 15, color: '#1a1a2e',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sendBtn: {
    backgroundColor: '#3498DB', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
